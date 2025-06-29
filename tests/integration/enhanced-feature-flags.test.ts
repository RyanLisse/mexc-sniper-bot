/**
 * Enhanced Feature Flags Integration Tests
 * 
 * Tests the enhanced feature flag system with rollout controls,
 * A/B testing, and integration with trading domain.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { 
  EnhancedFeatureFlagConfig,
  EnhancedFeatureFlagManager,
  evaluateFeatureFlag,
  UserContext,
} from "@/src/lib/feature-flags/enhanced-feature-flag-manager";
import { 
  TRADING_FEATURE_FLAGS,
  TradingFeatureFlagService,
} from "@/src/lib/feature-flags/trading-integration-example";

describe("Enhanced Feature Flags Integration Tests", () => {
  let featureFlagManager: EnhancedFeatureFlagManager;
  let tradingService: TradingFeatureFlagService;
  
  const mockUserContext: UserContext = {
    userId: "user_123",
    portfolioId: "portfolio_456",
    email: "test@example.com",
    userType: "premium",
    registrationDate: "2024-01-01T00:00:00Z",
    country: "US",
    tradingExperience: "advanced",
    riskTolerance: "high",
    customAttributes: {
      totalTrades: 500,
      portfolioValue: 50000,
      avgWinRate: 0.65,
    },
  };

  beforeEach(() => {
    featureFlagManager = new EnhancedFeatureFlagManager();
    tradingService = new TradingFeatureFlagService();
    
    // Register test flags
    TRADING_FEATURE_FLAGS.forEach(config => {
      featureFlagManager.registerFlag(config);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Feature Flag Registration and Management", () => {
    it("should register feature flags correctly", () => {
      const testFlag: EnhancedFeatureFlagConfig = {
        name: 'test_feature',
        description: 'Test feature for unit tests',
        strategy: 'percentage',
        enabled: true,
        percentage: 50,
        environments: ['test'],
        trackingEnabled: true,
        killSwitchEnabled: true,
        rollbackOnError: true,
        maxErrorRate: 0.05,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'test',
        tags: ['test'],
      };

      featureFlagManager.registerFlag(testFlag);
      const flags = featureFlagManager.getAllFlags();
      
      expect(flags['test_feature']).toBeDefined();
      expect(flags['test_feature'].name).toBe('test_feature');
      expect(flags['test_feature'].strategy).toBe('percentage');
    });

    it("should update feature flag configuration", () => {
      const testFlag: EnhancedFeatureFlagConfig = {
        name: 'test_update',
        description: 'Test flag for updates',
        strategy: 'percentage',
        enabled: false,
        percentage: 25,
        environments: ['test'],
        trackingEnabled: true,
        killSwitchEnabled: true,
        rollbackOnError: true,
        maxErrorRate: 0.05,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'test',
        tags: ['test'],
      };

      featureFlagManager.registerFlag(testFlag);
      
      featureFlagManager.updateFlag('test_update', {
        enabled: true,
        percentage: 75,
      });

      const flags = featureFlagManager.getAllFlags();
      expect(flags['test_update'].enabled).toBe(true);
      expect(flags['test_update'].percentage).toBe(75);
    });

    it("should handle emergency disable", () => {
      const testFlag: EnhancedFeatureFlagConfig = {
        name: 'emergency_test',
        description: 'Test emergency disable',
        strategy: 'all_users',
        enabled: true,
        environments: ['test'],
        trackingEnabled: true,
        killSwitchEnabled: true,
        rollbackOnError: true,
        maxErrorRate: 0.05,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'test',
        tags: ['test'],
      };

      featureFlagManager.registerFlag(testFlag);
      
      featureFlagManager.emergencyDisable('emergency_test', 'Test emergency');
      
      const flags = featureFlagManager.getAllFlags();
      expect(flags['emergency_test'].enabled).toBe(false);
      expect(flags['emergency_test'].strategy).toBe('disabled');
    });
  });

  describe("Rollout Strategy Evaluation", () => {
    it("should evaluate percentage rollout correctly", async () => {
      const testFlag: EnhancedFeatureFlagConfig = {
        name: 'percentage_test',
        description: 'Test percentage rollout',
        strategy: 'percentage',
        enabled: true,
        percentage: 50,
        environments: ['test'],
        trackingEnabled: true,
        killSwitchEnabled: true,
        rollbackOnError: true,
        maxErrorRate: 0.05,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'test',
        tags: ['test'],
      };

      featureFlagManager.registerFlag(testFlag);

      // Test multiple users to verify percentage distribution
      const results: boolean[] = [];
      for (let i = 0; i < 100; i++) {
        const userContext = { ...mockUserContext, userId: `user_${i}` };
        const evaluation = await featureFlagManager.evaluateFlag('percentage_test', userContext);
        results.push(evaluation.enabled);
      }

      // With 50% rollout, we expect roughly 50% enabled (allowing for variance)
      const enabledCount = results.filter(Boolean).length;
      expect(enabledCount).toBeGreaterThan(30);
      expect(enabledCount).toBeLessThan(70);
    });

    it("should respect user attribute targeting", async () => {
      const testFlag: EnhancedFeatureFlagConfig = {
        name: 'targeting_test',
        description: 'Test user targeting',
        strategy: 'all_users',
        enabled: true,
        userAttributes: {
          userType: 'premium',
          tradingExperience: 'advanced',
        },
        environments: ['test'],
        trackingEnabled: true,
        killSwitchEnabled: true,
        rollbackOnError: true,
        maxErrorRate: 0.05,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'test',
        tags: ['test'],
      };

      featureFlagManager.registerFlag(testFlag);

      // Should be enabled for matching user
      const matchingUser = { ...mockUserContext };
      const evaluation1 = await featureFlagManager.evaluateFlag('targeting_test', matchingUser);
      expect(evaluation1.enabled).toBe(true);

      // Should be disabled for non-matching user
      const nonMatchingUser = { ...mockUserContext, userType: 'free' as const };
      const evaluation2 = await featureFlagManager.evaluateFlag('targeting_test', nonMatchingUser);
      expect(evaluation2.enabled).toBe(false);
    });

    it("should handle A/B test configuration", async () => {
      const testFlag: EnhancedFeatureFlagConfig = {
        name: 'ab_test',
        description: 'Test A/B testing',
        strategy: 'a_b_test',
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
          conversionMetric: 'test_metric',
          significance: 0.95,
        },
        environments: ['test'],
        trackingEnabled: true,
        killSwitchEnabled: true,
        rollbackOnError: true,
        maxErrorRate: 0.05,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'test',
        tags: ['test'],
      };

      featureFlagManager.registerFlag(testFlag);

      const evaluation = await featureFlagManager.evaluateFlag('ab_test', mockUserContext);
      
      expect(evaluation.strategy).toBe('a_b_test');
      expect(evaluation.userInTargetGroup).toBe(true);
      expect(evaluation.abTestGroup).toMatch(/^(control|treatment)$/);
      expect(evaluation.metadata.experimentId).toBe('ab_test_ab_test');
    });
  });

  describe("Trading Feature Flag Integration", () => {
    it("should determine user context from session data", () => {
      const sessionData = {
        portfolioId: 'portfolio_123',
        email: 'trader@example.com',
        subscriptionLevel: 'premium',
        totalTrades: 1500,
        portfolioValue: 100000,
        avgWinRate: 0.72,
        accountAgeDays: 400,
        maxPositionSizePercent: 25,
        avgLeverage: 3,
      };

      const userContext = tradingService.getUserContextFromSession('user_123', sessionData);

      expect(userContext.userId).toBe('user_123');
      expect(userContext.portfolioId).toBe('portfolio_123');
      expect(userContext.userType).toBe('premium');
      expect(userContext.tradingExperience).toBe('advanced');
      expect(userContext.riskTolerance).toBe('high');
      expect(userContext.customAttributes?.totalTrades).toBe(1500);
    });

    it("should evaluate enhanced pattern detection flag", async () => {
      const enabled = await tradingService.isEnhancedPatternDetectionEnabled(mockUserContext);
      
      // The flag should be evaluated based on gradual rollout configuration
      expect(typeof enabled).toBe('boolean');
    });

    it("should evaluate advanced risk management flag", async () => {
      const enabled = await tradingService.isAdvancedRiskManagementEnabled(mockUserContext);
      
      // The flag should be evaluated based on A/B test configuration
      expect(typeof enabled).toBe('boolean');
    });

    it("should get comprehensive trading configuration", async () => {
      const config = await tradingService.getTradingConfiguration(mockUserContext);

      expect(config).toHaveProperty('useCleanArchitecture');
      expect(config).toHaveProperty('patternDetectionEngine');
      expect(config).toHaveProperty('riskManagementLevel');
      expect(config).toHaveProperty('orderRoutingStrategy');
      expect(config).toHaveProperty('monitoringLevel');

      expect(['legacy', 'enhanced']).toContain(config.patternDetectionEngine);
      expect(['basic', 'advanced']).toContain(config.riskManagementLevel);
      expect(['simple', 'smart']).toContain(config.orderRoutingStrategy);
    });

    it("should handle bulk flag evaluation efficiently", async () => {
      const startTime = Date.now();
      
      const flags = await tradingService.evaluateAllTradingFlags(mockUserContext);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(flags).toHaveProperty('enhancedPatternDetection');
      expect(flags).toHaveProperty('advancedRiskManagement');
      expect(flags).toHaveProperty('smartOrderRouting');
      
      // Should complete quickly (under 100ms for bulk evaluation)
      expect(duration).toBeLessThan(100);
    });
  });

  describe("Feature Flag Analytics", () => {
    it("should track flag evaluations", async () => {
      const testFlag: EnhancedFeatureFlagConfig = {
        name: 'analytics_test',
        description: 'Test analytics tracking',
        strategy: 'percentage',
        enabled: true,
        percentage: 50,
        environments: ['test'],
        trackingEnabled: true,
        killSwitchEnabled: true,
        rollbackOnError: true,
        maxErrorRate: 0.05,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'test',
        tags: ['test'],
      };

      featureFlagManager.registerFlag(testFlag);

      // Perform several evaluations
      for (let i = 0; i < 10; i++) {
        const userContext = { ...mockUserContext, userId: `user_${i}` };
        await featureFlagManager.evaluateFlag('analytics_test', userContext);
      }

      const analytics = featureFlagManager.getAnalytics('analytics_test');
      
      expect(analytics.evaluations).toBe(10);
      expect(analytics.enabledCount).toBeGreaterThanOrEqual(0);
      expect(analytics.enabledCount).toBeLessThanOrEqual(10);
      expect(analytics.enabledRate).toBeGreaterThanOrEqual(0);
      expect(analytics.enabledRate).toBeLessThanOrEqual(1);
    });

    it("should provide aggregate analytics", async () => {
      // Register multiple test flags
      const flags = ['test1', 'test2', 'test3'].map(name => ({
        name,
        description: `Test flag ${name}`,
        strategy: 'all_users' as const,
        enabled: true,
        environments: ['test'],
        trackingEnabled: true,
        killSwitchEnabled: true,
        rollbackOnError: true,
        maxErrorRate: 0.05,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'test',
        tags: ['test'],
      }));

      flags.forEach(flag => featureFlagManager.registerFlag(flag));

      // Evaluate each flag
      for (const flag of flags) {
        await featureFlagManager.evaluateFlag(flag.name, mockUserContext);
      }

      const analytics = featureFlagManager.getAnalytics();
      
      expect(analytics.evaluations).toBeGreaterThanOrEqual(3);
      expect(analytics.enabledCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Environment and Safety Controls", () => {
    it("should respect environment restrictions", async () => {
      const testFlag: EnhancedFeatureFlagConfig = {
        name: 'env_test',
        description: 'Test environment restrictions',
        strategy: 'all_users',
        enabled: true,
        environments: ['production'], // Only enabled in production
        trackingEnabled: true,
        killSwitchEnabled: true,
        rollbackOnError: true,
        maxErrorRate: 0.05,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'test',
        tags: ['test'],
      };

      featureFlagManager.registerFlag(testFlag);

      // Should be disabled in test environment
      const evaluation = await featureFlagManager.evaluateFlag('env_test', mockUserContext);
      expect(evaluation.enabled).toBe(false);
    });

    it("should handle gradual rollout progression", async () => {
      const testFlag: EnhancedFeatureFlagConfig = {
        name: 'gradual_test',
        description: 'Test gradual rollout',
        strategy: 'gradual',
        enabled: true,
        gradualRollout: {
          enabled: true,
          startPercentage: 0,
          targetPercentage: 100,
          incrementPercentage: 50,
          incrementIntervalHours: 1,
          startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          rollbackThreshold: {
            errorRate: 0.05,
            performanceDegradation: 0.20,
          },
        },
        environments: ['test'],
        trackingEnabled: true,
        killSwitchEnabled: true,
        rollbackOnError: true,
        maxErrorRate: 0.05,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'test',
        tags: ['test'],
      };

      featureFlagManager.registerFlag(testFlag);

      const evaluation = await featureFlagManager.evaluateFlag('gradual_test', mockUserContext);
      
      expect(evaluation.strategy).toBe('gradual');
      expect(evaluation.metadata.rolloutPhase).toBeDefined();
      expect(evaluation.metadata.currentPercentage).toBeGreaterThanOrEqual(0);
    });
  });
});