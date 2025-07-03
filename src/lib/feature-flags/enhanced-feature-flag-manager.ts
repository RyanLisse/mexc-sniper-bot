/**
 * Enhanced Feature Flag Manager
 * Minimal implementation for build optimization
 */

import { z } from "zod";

export const UserContextSchema = z.object({
  userId: z.string(),
  email: z.string().optional(),
  plan: z.string().optional(),
  region: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type UserContext = z.infer<typeof UserContextSchema>;

export const GradualRolloutConfigSchema = z.object({
  enabled: z.boolean(),
  percentage: z.number().min(0).max(100),
  stages: z
    .array(
      z.object({
        percentage: z.number().min(0).max(100),
        duration: z.number().min(0),
      })
    )
    .optional(),
});

export type GradualRolloutConfig = z.infer<typeof GradualRolloutConfigSchema>;

export const EnhancedFeatureFlagConfigSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean(),
  strategy: z.enum(["simple", "gradual", "targeted"]).default("simple"),
  targetGroups: z.array(z.string()).optional(),
  gradualRollout: GradualRolloutConfigSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
});

export type EnhancedFeatureFlagConfig = z.infer<
  typeof EnhancedFeatureFlagConfigSchema
>;

export interface FlagEvaluation {
  flagName: string;
  enabled: boolean;
  strategy: string;
  userInTargetGroup: boolean;
  evaluationTime: Date;
  metadata?: Record<string, any>;
}

class EnhancedFeatureFlagManager {
  private flags: Map<string, EnhancedFeatureFlagConfig> = new Map();
  private analytics: Map<string, any> = new Map();

  registerFlag(config: EnhancedFeatureFlagConfig): void {
    this.flags.set(config.name, config);
  }

  getAllFlags(): Record<string, EnhancedFeatureFlagConfig> {
    const result: Record<string, EnhancedFeatureFlagConfig> = {};
    for (const [name, config] of this.flags) {
      result[name] = config;
    }
    return result;
  }

  async evaluateFlag(
    flagName: string,
    userContext: UserContext,
    defaultValue: boolean = false
  ): Promise<FlagEvaluation> {
    const flag = this.flags.get(flagName);

    if (!flag) {
      return {
        flagName,
        enabled: defaultValue,
        strategy: "default",
        userInTargetGroup: false,
        evaluationTime: new Date(),
        metadata: { reason: "flag_not_found" },
      };
    }

    const enabled = this.evaluateFlagForUser(flag, userContext);

    return {
      flagName,
      enabled,
      strategy: flag.strategy,
      userInTargetGroup: enabled,
      evaluationTime: new Date(),
      metadata: { userId: userContext.userId },
    };
  }

  private evaluateFlagForUser(
    flag: EnhancedFeatureFlagConfig,
    userContext: UserContext
  ): boolean {
    if (!flag.enabled) return false;

    switch (flag.strategy) {
      case "simple":
        return flag.enabled;
      case "gradual":
        return this.evaluateGradualRollout(flag, userContext);
      case "targeted":
        return this.evaluateTargetedFlag(flag, userContext);
      default:
        return flag.enabled;
    }
  }

  private evaluateGradualRollout(
    flag: EnhancedFeatureFlagConfig,
    userContext: UserContext
  ): boolean {
    if (!flag.gradualRollout) return flag.enabled;

    const hash = this.hashUser(userContext.userId);
    const percentage = flag.gradualRollout.percentage;

    return hash < percentage;
  }

  private evaluateTargetedFlag(
    flag: EnhancedFeatureFlagConfig,
    userContext: UserContext
  ): boolean {
    if (!flag.targetGroups || flag.targetGroups.length === 0) {
      return flag.enabled;
    }

    const userPlan = userContext.plan || "free";
    return flag.targetGroups.includes(userPlan);
  }

  private hashUser(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100;
  }

  updateFlag(
    flagName: string,
    updates: Partial<EnhancedFeatureFlagConfig>
  ): void {
    const flag = this.flags.get(flagName);
    if (flag) {
      const updatedFlag = {
        ...flag,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.flags.set(flagName, updatedFlag);
    }
  }

  emergencyDisable(flagName: string, reason: string): void {
    const flag = this.flags.get(flagName);
    if (flag) {
      this.updateFlag(flagName, {
        enabled: false,
        description: `${flag.description || ""} [EMERGENCY DISABLED: ${reason}]`,
      });
    }
  }

  startGradualRollout(flagName: string, config: GradualRolloutConfig): void {
    this.updateFlag(flagName, {
      strategy: "gradual",
      gradualRollout: config,
    });
  }

  getAnalytics(flagName?: string): any {
    if (flagName) {
      return this.analytics.get(flagName) || {};
    }

    const result: Record<string, any> = {};
    for (const [name, analytics] of this.analytics) {
      result[name] = analytics;
    }
    return result;
  }
}

export const enhancedFeatureFlagManager = new EnhancedFeatureFlagManager();
