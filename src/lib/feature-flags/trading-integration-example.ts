/**
 * Trading Integration Example
 *
 * Demonstrates how to integrate enhanced feature flags with the trading system
 * for controlled rollouts and A/B testing of new trading features.
 */

import {
  type EnhancedFeatureFlagConfig,
  enhancedFeatureFlagManager,
  evaluateFeatureFlag,
  type UserContext,
} from "./enhanced-feature-flag-manager";
import { tradingDomainFeatureFlags } from "./trading-domain-flags";

/**
 * Trading-specific feature flag configurations
 */
export const TRADING_FEATURE_FLAGS: EnhancedFeatureFlagConfig[] = [
  {
    name: "enhanced_pattern_detection",
    description: "Enable AI-enhanced pattern detection with machine learning algorithms",
    strategy: "gradual",
    enabled: true,
    gradualRollout: {
      enabled: true,
      startPercentage: 5,
      targetPercentage: 100,
      incrementPercentage: 10,
      incrementIntervalHours: 24,
      startTime: new Date().toISOString(),
      rollbackThreshold: {
        errorRate: 0.03,
        performanceDegradation: 0.15,
      },
    },
    environments: ["development", "staging", "production"],
    userAttributes: {
      tradingExperience: "advanced",
    },
    trackingEnabled: true,
    metricsNamespace: "trading_pattern_detection",
    killSwitchEnabled: true,
    rollbackOnError: true,
    maxErrorRate: 0.05,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "trading_team",
    tags: ["trading", "ai", "pattern-detection", "gradual-rollout"],
  },

  {
    name: "advanced_risk_management",
    description: "Enhanced risk management with real-time portfolio monitoring",
    strategy: "a_b_test",
    enabled: true,
    abTest: {
      enabled: true,
      groups: {
        control: {
          percentage: 50,
          flags: { enabled: false },
        },
        treatment: {
          percentage: 50,
          flags: { enabled: true },
        },
      },
      conversionMetric: "portfolio_performance",
      significance: 0.95,
    },
    environments: ["production"],
    userAttributes: {
      userType: "premium",
    },
    trackingEnabled: true,
    metricsNamespace: "risk_management",
    killSwitchEnabled: true,
    rollbackOnError: true,
    maxErrorRate: 0.05,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "risk_team",
    tags: ["trading", "risk", "a-b-test"],
  },

  {
    name: "smart_order_routing",
    description: "Intelligent order routing for optimal execution",
    strategy: "canary",
    enabled: true,
    percentage: 15,
    environments: ["production"],
    userAttributes: {
      riskTolerance: "high",
      tradingExperience: "advanced",
    },
    trackingEnabled: true,
    killSwitchEnabled: true,
    rollbackOnError: true,
    maxErrorRate: 0.05,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "execution_team",
    tags: ["trading", "execution", "canary"],
  },
];

/**
 * Initialize trading feature flags
 */
export function initializeTradingFeatureFlags(): void {
  TRADING_FEATURE_FLAGS.forEach((config) => {
    enhancedFeatureFlagManager.registerFlag(config);
  });
}

/**
 * Trading feature flag evaluation wrapper
 */
export class TradingFeatureFlagService {
  /**
   * Check if enhanced pattern detection is enabled for a user
   */
  async isEnhancedPatternDetectionEnabled(userContext: UserContext): Promise<boolean> {
    return evaluateFeatureFlag("enhanced_pattern_detection", userContext, false);
  }

  /**
   * Check if advanced risk management is enabled for a user
   */
  async isAdvancedRiskManagementEnabled(userContext: UserContext): Promise<boolean> {
    return evaluateFeatureFlag("advanced_risk_management", userContext, false);
  }

  /**
   * Check if smart order routing is enabled for a user
   */
  async isSmartOrderRoutingEnabled(userContext: UserContext): Promise<boolean> {
    return evaluateFeatureFlag("smart_order_routing", userContext, false);
  }

  /**
   * Get user context from trading session
   */
  getUserContextFromSession(userId: string, additionalData?: any): UserContext {
    return {
      userId,
      portfolioId: additionalData?.portfolioId,
      email: additionalData?.email,
      userType: additionalData?.subscriptionLevel || "free",
      registrationDate: additionalData?.registrationDate,
      country: additionalData?.country,
      tradingExperience: this.determineTradingExperience(additionalData),
      riskTolerance: this.determineRiskTolerance(additionalData),
      customAttributes: {
        totalTrades: additionalData?.totalTrades || 0,
        portfolioValue: additionalData?.portfolioValue || 0,
        avgWinRate: additionalData?.avgWinRate || 0,
      },
    };
  }

  /**
   * Evaluate multiple flags for efficient bulk checking
   */
  async evaluateAllTradingFlags(userContext: UserContext): Promise<{
    enhancedPatternDetection: boolean;
    advancedRiskManagement: boolean;
    smartOrderRouting: boolean;
  }> {
    const [enhancedPatternDetection, advancedRiskManagement, smartOrderRouting] = await Promise.all(
      [
        this.isEnhancedPatternDetectionEnabled(userContext),
        this.isAdvancedRiskManagementEnabled(userContext),
        this.isSmartOrderRoutingEnabled(userContext),
      ]
    );

    return {
      enhancedPatternDetection,
      advancedRiskManagement,
      smartOrderRouting,
    };
  }

  /**
   * Feature flag-aware trading configuration
   */
  async getTradingConfiguration(userContext: UserContext): Promise<{
    useCleanArchitecture: boolean;
    patternDetectionEngine: "legacy" | "enhanced";
    riskManagementLevel: "basic" | "advanced";
    orderRoutingStrategy: "simple" | "smart";
    monitoringLevel: "basic" | "enhanced";
  }> {
    // Get traditional trading domain flags
    const useCleanArchitecture = tradingDomainFeatureFlags.isCleanArchitectureTradingEnabled();

    // Get enhanced feature flags
    const flags = await this.evaluateAllTradingFlags(userContext);

    return {
      useCleanArchitecture,
      patternDetectionEngine: flags.enhancedPatternDetection ? "enhanced" : "legacy",
      riskManagementLevel: flags.advancedRiskManagement ? "advanced" : "basic",
      orderRoutingStrategy: flags.smartOrderRouting ? "smart" : "simple",
      monitoringLevel: tradingDomainFeatureFlags.isPerformanceMonitoringEnabled()
        ? "enhanced"
        : "basic",
    };
  }

  // Private helper methods
  private determineTradingExperience(userData: any): "beginner" | "intermediate" | "advanced" {
    const totalTrades = userData?.totalTrades || 0;
    const accountAge = userData?.accountAgeDays || 0;

    if (totalTrades > 1000 && accountAge > 365) {
      return "advanced";
    } else if (totalTrades > 100 && accountAge > 90) {
      return "intermediate";
    }
    return "beginner";
  }

  private determineRiskTolerance(userData: any): "low" | "medium" | "high" {
    const maxPositionSize = userData?.maxPositionSizePercent || 0;
    const avgLeverage = userData?.avgLeverage || 1;

    if (maxPositionSize > 20 || avgLeverage > 5) {
      return "high";
    } else if (maxPositionSize > 10 || avgLeverage > 2) {
      return "medium";
    }
    return "low";
  }
}

/**
 * Example usage in trading components
 */
export class ExampleTradingService {
  private featureFlagService = new TradingFeatureFlagService();

  async executeTradeWithFeatureFlags(
    userId: string,
    tradeData: any,
    userSessionData: any
  ): Promise<any> {
    // Get user context
    const userContext = this.featureFlagService.getUserContextFromSession(userId, userSessionData);

    // Get trading configuration based on feature flags
    const config = await this.featureFlagService.getTradingConfiguration(userContext);

    console.log("Trading configuration for user:", {
      userId,
      config,
    });

    // Use clean architecture if enabled
    if (config.useCleanArchitecture) {
      return this.executeTradeWithCleanArchitecture(tradeData, config);
    } else {
      return this.executeTradeWithLegacySystem(tradeData);
    }
  }

  async analyzePatternWithFeatureFlags(
    userId: string,
    symbolData: any,
    userSessionData: any
  ): Promise<any> {
    const userContext = this.featureFlagService.getUserContextFromSession(userId, userSessionData);
    const useEnhanced =
      await this.featureFlagService.isEnhancedPatternDetectionEnabled(userContext);

    if (useEnhanced) {
      console.log("Using enhanced AI pattern detection for user:", userId);
      return this.analyzePatternWithAI(symbolData);
    } else {
      console.log("Using legacy pattern detection for user:", userId);
      return this.analyzePatternLegacy(symbolData);
    }
  }

  // Mock implementations
  private async executeTradeWithCleanArchitecture(_tradeData: any, config: any): Promise<any> {
    // Implementation would use clean architecture with feature-specific logic
    return { status: "executed", method: "clean_architecture", config };
  }

  private async executeTradeWithLegacySystem(_tradeData: any): Promise<any> {
    // Implementation would use legacy trading system
    return { status: "executed", method: "legacy" };
  }

  private async analyzePatternWithAI(_symbolData: any): Promise<any> {
    // Implementation would use AI-enhanced pattern detection
    return { pattern: "bullish_reversal", confidence: 0.87, method: "ai_enhanced" };
  }

  private async analyzePatternLegacy(_symbolData: any): Promise<any> {
    // Implementation would use traditional pattern detection
    return { pattern: "bullish_reversal", confidence: 0.65, method: "legacy" };
  }
}

// Global service instance
export const tradingFeatureFlagService = new TradingFeatureFlagService();

// Initialize on module load
initializeTradingFeatureFlags();
