/**
 * Enhanced Feature Flag Manager
 *
 * Advanced feature flag system with rollout controls, A/B testing,
 * monitoring, and dynamic configuration management.
 *
 * Phase 3 Enhancement Features:
 * - Percentage-based user rollouts
 * - A/B testing framework
 * - Feature flag analytics
 * - Dynamic rollout adjustments
 * - Safety monitoring and rollback
 * - Environment-specific configurations
 */

import { metrics, trace } from "@opentelemetry/api";
import { z } from "zod";

// Rollout strategy types
export const RolloutStrategySchema = z.enum([
  "all_users", // Enable for all users
  "percentage", // Enable for X% of users
  "user_list", // Enable for specific users
  "a_b_test", // A/B testing configuration
  "gradual", // Gradual rollout over time
  "canary", // Canary deployment
  "disabled", // Completely disabled
]);

export type RolloutStrategy = z.infer<typeof RolloutStrategySchema>;

// A/B test configuration
export const ABTestConfigSchema = z.object({
  enabled: z.boolean(),
  groups: z.record(
    z.object({
      percentage: z.number().min(0).max(100),
      flags: z.record(z.boolean()),
    })
  ),
  conversionMetric: z.string().optional(),
  significance: z.number().min(0).max(1).default(0.95),
});

export type ABTestConfig = z.infer<typeof ABTestConfigSchema>;

// Gradual rollout configuration
export const GradualRolloutConfigSchema = z.object({
  enabled: z.boolean(),
  startPercentage: z.number().min(0).max(100),
  targetPercentage: z.number().min(0).max(100),
  incrementPercentage: z.number().min(1).max(100),
  incrementIntervalHours: z.number().min(1),
  startTime: z.string().datetime(),
  maxUsers: z.number().optional(),
  rollbackThreshold: z.object({
    errorRate: z.number().min(0).max(1),
    performanceDegradation: z.number().min(0).max(1),
  }),
});

export type GradualRolloutConfig = z.infer<typeof GradualRolloutConfigSchema>;

// Enhanced feature flag configuration
export const EnhancedFeatureFlagConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  strategy: RolloutStrategySchema,
  enabled: z.boolean(),

  // Rollout configurations
  percentage: z.number().min(0).max(100).optional(),
  userList: z.array(z.string()).optional(),
  abTest: ABTestConfigSchema.optional(),
  gradualRollout: GradualRolloutConfigSchema.optional(),

  // Targeting
  environments: z.array(z.string()).optional(),
  userAttributes: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),

  // Monitoring
  trackingEnabled: z.boolean().default(true),
  metricsNamespace: z.string().optional(),

  // Safety
  killSwitchEnabled: z.boolean().default(true),
  rollbackOnError: z.boolean().default(true),
  maxErrorRate: z.number().min(0).max(1).default(0.05),

  // Metadata
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string(),
  tags: z.array(z.string()).default([]),
});

export type EnhancedFeatureFlagConfig = z.infer<typeof EnhancedFeatureFlagConfigSchema>;

// User context for feature flag evaluation
export const UserContextSchema = z.object({
  userId: z.string(),
  portfolioId: z.string().optional(),
  email: z.string().email().optional(),
  userType: z.enum(["free", "premium", "enterprise"]).optional(),
  registrationDate: z.string().datetime().optional(),
  country: z.string().optional(),
  tradingExperience: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  riskTolerance: z.enum(["low", "medium", "high"]).optional(),
  customAttributes: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export type UserContext = z.infer<typeof UserContextSchema>;

// Feature flag evaluation result
export interface FeatureFlagEvaluation {
  flagName: string;
  enabled: boolean;
  strategy: RolloutStrategy;
  userInTargetGroup: boolean;
  abTestGroup?: string;
  evaluationTime: Date;
  metadata: {
    percentage?: number;
    userHash?: string;
    experimentId?: string;
    rolloutPhase?: string;
  };
}

/**
 * Enhanced Feature Flag Manager
 * Provides advanced feature flag capabilities with rollout controls
 */
export class EnhancedFeatureFlagManager {
  private meter = metrics.getMeter("feature-flags", "1.0.0");
  private tracer = trace.getTracer("feature-flags", "1.0.0");

  private flagConfigurations = new Map<string, EnhancedFeatureFlagConfig>();
  private evaluationCache = new Map<string, FeatureFlagEvaluation>();
  private evaluationMetrics = new Map<string, { evaluations: number; enabled: number }>();

  // Metrics
  private evaluationCounter = this.meter.createCounter("feature_flags_evaluations_total", {
    description: "Total number of feature flag evaluations",
  });

  private enabledCounter = this.meter.createCounter("feature_flags_enabled_total", {
    description: "Total number of times feature flags were enabled",
  });

  private abTestParticipantCounter = this.meter.createCounter("ab_test_participants_total", {
    description: "Total number of A/B test participants",
  });

  constructor() {
    this.initializeDefaultFlags();
    this.startBackgroundTasks();
  }

  /**
   * Evaluate feature flag for a user
   */
  async evaluateFlag(
    flagName: string,
    userContext: UserContext,
    defaultValue: boolean = false
  ): Promise<FeatureFlagEvaluation> {
    const span = this.tracer.startSpan("feature_flag.evaluate", {
      attributes: {
        "feature_flag.name": flagName,
        "user.id": userContext.userId,
      },
    });

    try {
      const config = this.flagConfigurations.get(flagName);

      if (!config) {
        span.setAttributes({ "feature_flag.found": false });
        return {
          flagName,
          enabled: defaultValue,
          strategy: "disabled",
          userInTargetGroup: false,
          evaluationTime: new Date(),
          metadata: {},
        };
      }

      // Check if flag is globally disabled
      if (!config.enabled) {
        return this.createEvaluation(flagName, false, "disabled", false, {});
      }

      // Evaluate based on strategy
      let enabled = false;
      let userInTargetGroup = false;
      const metadata: any = {};

      switch (config.strategy) {
        case "all_users":
          enabled = true;
          userInTargetGroup = true;
          break;

        case "percentage": {
          const userHash = this.hashUser(userContext.userId, flagName);
          const userPercentile = userHash % 100;
          enabled = userPercentile < (config.percentage || 0);
          userInTargetGroup = enabled;
          metadata.percentage = config.percentage;
          metadata.userHash = userHash.toString();
          break;
        }

        case "user_list":
          enabled = config.userList?.includes(userContext.userId) || false;
          userInTargetGroup = enabled;
          break;

        case "a_b_test": {
          const abResult = this.evaluateABTest(config.abTest!, userContext);
          enabled = abResult.enabled;
          userInTargetGroup = abResult.inTargetGroup;
          metadata.abTestGroup = abResult.group;
          metadata.experimentId = `${flagName}_ab_test`;

          if (abResult.inTargetGroup) {
            this.abTestParticipantCounter.add(1, {
              flag_name: flagName,
              group: abResult.group,
            });
          }
          break;
        }

        case "gradual": {
          const gradualResult = this.evaluateGradualRollout(config.gradualRollout!, userContext);
          enabled = gradualResult.enabled;
          userInTargetGroup = gradualResult.inTargetGroup;
          metadata.rolloutPhase = gradualResult.phase;
          metadata.currentPercentage = gradualResult.currentPercentage;
          break;
        }

        case "canary":
          enabled = this.evaluateCanaryDeployment(config, userContext);
          userInTargetGroup = enabled;
          break;
        default:
          enabled = false;
          userInTargetGroup = false;
          break;
      }

      // Apply environment filtering
      if (config.environments && config.environments.length > 0) {
        const currentEnv = process.env.NODE_ENV || "development";
        if (!config.environments.includes(currentEnv)) {
          enabled = false;
          userInTargetGroup = false;
        }
      }

      // Apply user attribute targeting
      if (config.userAttributes && enabled) {
        const meetsTargeting = this.evaluateUserTargeting(config.userAttributes, userContext);
        if (!meetsTargeting) {
          enabled = false;
          userInTargetGroup = false;
        }
      }

      const evaluation = this.createEvaluation(
        flagName,
        enabled,
        config.strategy,
        userInTargetGroup,
        metadata
      );

      // Track metrics
      this.recordEvaluation(flagName, enabled);

      // Cache evaluation
      const cacheKey = `${flagName}:${userContext.userId}`;
      this.evaluationCache.set(cacheKey, evaluation);

      span.setAttributes({
        "feature_flag.enabled": enabled,
        "feature_flag.strategy": config.strategy,
        "feature_flag.user_in_target": userInTargetGroup,
      });

      return evaluation;
    } finally {
      span.end();
    }
  }

  /**
   * Register a new feature flag
   */
  registerFlag(config: EnhancedFeatureFlagConfig): void {
    const validatedConfig = EnhancedFeatureFlagConfigSchema.parse(config);
    this.flagConfigurations.set(config.name, validatedConfig);
  }

  /**
   * Update feature flag configuration
   */
  updateFlag(flagName: string, updates: Partial<EnhancedFeatureFlagConfig>): void {
    const existing = this.flagConfigurations.get(flagName);
    if (!existing) {
      throw new Error(`Feature flag '${flagName}' not found`);
    }

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const validatedConfig = EnhancedFeatureFlagConfigSchema.parse(updated);
    this.flagConfigurations.set(flagName, validatedConfig);

    // Clear cache for this flag
    this.clearFlagCache(flagName);
  }

  /**
   * Get feature flag analytics
   */
  getAnalytics(flagName?: string): {
    evaluations: number;
    enabledCount: number;
    enabledRate: number;
    lastEvaluated: Date | null;
  } {
    if (flagName) {
      const metrics = this.evaluationMetrics.get(flagName) || { evaluations: 0, enabled: 0 };
      return {
        evaluations: metrics.evaluations,
        enabledCount: metrics.enabled,
        enabledRate: metrics.evaluations > 0 ? metrics.enabled / metrics.evaluations : 0,
        lastEvaluated: this.getLastEvaluationTime(flagName),
      };
    }

    // Aggregate analytics for all flags
    let totalEvaluations = 0;
    let totalEnabled = 0;
    const lastEvaluated: Date | null = null;

    for (const [, metrics] of this.evaluationMetrics) {
      totalEvaluations += metrics.evaluations;
      totalEnabled += metrics.enabled;
    }

    return {
      evaluations: totalEvaluations,
      enabledCount: totalEnabled,
      enabledRate: totalEvaluations > 0 ? totalEnabled / totalEvaluations : 0,
      lastEvaluated,
    };
  }

  /**
   * Emergency disable flag (kill switch)
   */
  emergencyDisable(flagName: string, reason: string): void {
    const config = this.flagConfigurations.get(flagName);
    if (!config) {
      throw new Error(`Feature flag '${flagName}' not found`);
    }

    if (!config.killSwitchEnabled) {
      throw new Error(`Kill switch is disabled for flag '${flagName}'`);
    }

    this.updateFlag(flagName, {
      enabled: false,
      strategy: "disabled",
    });

    console.warn(`[Feature Flag] Emergency disabled: ${flagName}. Reason: ${reason}`);

    // Send alert notification
    this.sendEmergencyAlert(flagName, reason);
  }

  /**
   * Start gradual rollout for a flag
   */
  startGradualRollout(flagName: string, config: GradualRolloutConfig): void {
    this.updateFlag(flagName, {
      strategy: "gradual",
      gradualRollout: {
        ...config,
        enabled: true,
        startTime: new Date().toISOString(),
      },
    });
  }

  /**
   * Get all registered flags
   */
  getAllFlags(): Record<string, EnhancedFeatureFlagConfig> {
    return Object.fromEntries(this.flagConfigurations);
  }

  // Private helper methods

  private createEvaluation(
    flagName: string,
    enabled: boolean,
    strategy: RolloutStrategy,
    userInTargetGroup: boolean,
    metadata: any
  ): FeatureFlagEvaluation {
    return {
      flagName,
      enabled,
      strategy,
      userInTargetGroup,
      evaluationTime: new Date(),
      metadata,
    };
  }

  private hashUser(userId: string, salt: string = ""): number {
    let hash = 0;
    const str = userId + salt;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private evaluateABTest(
    config: ABTestConfig,
    userContext: UserContext
  ): {
    enabled: boolean;
    inTargetGroup: boolean;
    group: string;
  } {
    if (!config.enabled) {
      return { enabled: false, inTargetGroup: false, group: "control" };
    }

    const userHash = this.hashUser(userContext.userId, "ab_test");
    const userPercentile = userHash % 100;

    let currentPercentile = 0;
    for (const [groupName, groupConfig] of Object.entries(config.groups)) {
      if (
        userPercentile >= currentPercentile &&
        userPercentile < currentPercentile + groupConfig.percentage
      ) {
        return {
          enabled: groupConfig.flags.enabled || false,
          inTargetGroup: true,
          group: groupName,
        };
      }
      currentPercentile += groupConfig.percentage;
    }

    return { enabled: false, inTargetGroup: false, group: "control" };
  }

  private evaluateGradualRollout(
    config: GradualRolloutConfig,
    userContext: UserContext
  ): {
    enabled: boolean;
    inTargetGroup: boolean;
    phase: string;
    currentPercentage: number;
  } {
    if (!config.enabled) {
      return { enabled: false, inTargetGroup: false, phase: "disabled", currentPercentage: 0 };
    }

    const now = new Date();
    const startTime = new Date(config.startTime);
    const hoursElapsed = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    const incrementsCompleted = Math.floor(hoursElapsed / config.incrementIntervalHours);
    const currentPercentage = Math.min(
      config.startPercentage + incrementsCompleted * config.incrementPercentage,
      config.targetPercentage
    );

    const userHash = this.hashUser(userContext.userId, "gradual");
    const userPercentile = userHash % 100;
    const enabled = userPercentile < currentPercentage;

    return {
      enabled,
      inTargetGroup: enabled,
      phase: `increment_${incrementsCompleted}`,
      currentPercentage,
    };
  }

  private evaluateCanaryDeployment(
    _config: EnhancedFeatureFlagConfig,
    userContext: UserContext
  ): boolean {
    // Implement canary logic - enable for specific user types or environments
    const isCanaryUser =
      userContext.userType === "enterprise" || userContext.tradingExperience === "advanced";

    if (isCanaryUser) {
      const userHash = this.hashUser(userContext.userId, "canary");
      return userHash % 100 < 10; // 10% of canary users
    }

    return false;
  }

  private evaluateUserTargeting(
    targetAttributes: Record<string, any>,
    userContext: UserContext
  ): boolean {
    for (const [key, targetValue] of Object.entries(targetAttributes)) {
      const userValue = (userContext as any)[key] || userContext.customAttributes?.[key];

      if (userValue !== targetValue) {
        return false;
      }
    }

    return true;
  }

  private recordEvaluation(flagName: string, enabled: boolean): void {
    this.evaluationCounter.add(1, { flag_name: flagName });

    if (enabled) {
      this.enabledCounter.add(1, { flag_name: flagName });
    }

    const metrics = this.evaluationMetrics.get(flagName) || { evaluations: 0, enabled: 0 };
    metrics.evaluations++;
    if (enabled) {
      metrics.enabled++;
    }
    this.evaluationMetrics.set(flagName, metrics);
  }

  private clearFlagCache(flagName: string): void {
    for (const [key] of this.evaluationCache) {
      if (key.startsWith(`${flagName}:`)) {
        this.evaluationCache.delete(key);
      }
    }
  }

  private getLastEvaluationTime(flagName: string): Date | null {
    for (const [key, evaluation] of this.evaluationCache) {
      if (key.startsWith(`${flagName}:`)) {
        return evaluation.evaluationTime;
      }
    }
    return null;
  }

  private initializeDefaultFlags(): void {
    // Initialize with trading domain flags
    const tradingFlags: EnhancedFeatureFlagConfig[] = [
      {
        name: "clean_architecture_trading",
        description: "Enable Clean Architecture trading implementation",
        strategy: "gradual",
        enabled: true,
        gradualRollout: {
          enabled: true,
          startPercentage: 0,
          targetPercentage: 100,
          incrementPercentage: 10,
          incrementIntervalHours: 24,
          startTime: new Date().toISOString(),
          rollbackThreshold: {
            errorRate: 0.05,
            performanceDegradation: 0.2,
          },
        },
        environments: ["development", "staging", "production"],
        trackingEnabled: true,
        killSwitchEnabled: true,
        rollbackOnError: true,
        maxErrorRate: 0.05,
        metricsNamespace: "trading_domain",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: "system",
        tags: ["trading", "architecture", "gradual"],
      },
      {
        name: "enhanced_monitoring",
        description: "Enable enhanced performance monitoring",
        strategy: "percentage",
        enabled: true,
        percentage: 50,
        trackingEnabled: true,
        killSwitchEnabled: true,
        rollbackOnError: true,
        maxErrorRate: 0.05,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: "system",
        tags: ["monitoring", "performance"],
      },
    ];

    tradingFlags.forEach((flag) => this.registerFlag(flag));
  }

  private startBackgroundTasks(): void {
    // Monitor gradual rollouts
    setInterval(() => {
      this.monitorGradualRollouts();
    }, 60000); // Every minute

    // Check error rates and auto-rollback if needed
    setInterval(() => {
      this.monitorErrorRates();
    }, 30000); // Every 30 seconds
  }

  private monitorGradualRollouts(): void {
    for (const [_flagName, config] of this.flagConfigurations) {
      if (config.strategy === "gradual" && config.gradualRollout?.enabled) {
        // Check if rollout should progress automatically
        // Implementation would check current metrics and decide whether to continue
      }
    }
  }

  private monitorErrorRates(): void {
    for (const [_flagName, config] of this.flagConfigurations) {
      if (config.rollbackOnError) {
        // Check error rates and rollback if threshold exceeded
        // Implementation would integrate with error monitoring
      }
    }
  }

  private async sendEmergencyAlert(flagName: string, reason: string): Promise<void> {
    try {
      const config = this.flagConfigurations.get(flagName);
      const alertPayload = {
        text: `🚨 FEATURE FLAG EMERGENCY ALERT 🚨`,
        attachments: [{
          color: 'danger',
          title: 'Feature Flag Emergency Disabled',
          text: `Feature flag "${flagName}" has been emergency disabled.`,
          fields: [
            { title: "Flag Name", value: flagName, short: true },
            { title: "Reason", value: reason, short: true },
            { title: "Previous Strategy", value: config?.strategy || "unknown", short: true },
            { title: "Action", value: "Kill switch activated", short: true },
            { title: "Impact", value: "Feature immediately disabled for all users", short: false }
          ],
          ts: Math.floor(Date.now() / 1000)
        }]
      };

      // Send to webhook if configured
      const webhookUrl = process.env.FEATURE_FLAG_WEBHOOK_URL || process.env.EMERGENCY_WEBHOOK_URL;
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alertPayload)
        });
      }

      // Send email if configured
      const emailEndpoint = process.env.FEATURE_FLAG_EMAIL_ENDPOINT;
      if (emailEndpoint) {
        await fetch(emailEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: process.env.FEATURE_FLAG_EMAIL_TO,
            subject: `EMERGENCY: Feature Flag "${flagName}" Disabled`,
            body: `Feature flag "${flagName}" was emergency disabled.\n\nReason: ${reason}\n\nTimestamp: ${new Date().toISOString()}\n\nThis requires immediate attention.`
          })
        });
      }

      // Emit internal event for monitoring systems
      process.nextTick(() => {
        const eventData = {
          flagName,
          reason,
          timestamp: new Date().toISOString(),
          config: config || null
        };
        
        // Store in global for monitoring systems to pick up
        if (typeof globalThis !== 'undefined') {
          (globalThis as any).lastFeatureFlagEmergencyDisabled = eventData;
        }
      });

    } catch (error) {
      console.error('[Feature Flag Manager] Failed to send emergency alert:', error);
    }
  }
}

// Global enhanced feature flag manager instance
export const enhancedFeatureFlagManager = new EnhancedFeatureFlagManager();

// Convenience functions for common patterns
export const evaluateFeatureFlag = async (
  flagName: string,
  userContext: UserContext,
  defaultValue: boolean = false
): Promise<boolean> => {
  const evaluation = await enhancedFeatureFlagManager.evaluateFlag(
    flagName,
    userContext,
    defaultValue
  );
  return evaluation.enabled;
};

export const isFeatureEnabled = async (
  flagName: string,
  userId: string,
  defaultValue: boolean = false
): Promise<boolean> => {
  const userContext: UserContext = { userId };
  return evaluateFeatureFlag(flagName, userContext, defaultValue);
};
