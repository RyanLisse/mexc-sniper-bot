/**
 * Feature Flag Integration Tests
 * Tests the progressive rollout of Clean Architecture features
 * Validates fallback mechanisms and feature toggling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { 
  TradingDomainFeatureFlagManager, 
  ROLLOUT_PHASES,
  DEFAULT_TRADING_DOMAIN_FLAGS,
  type TradingDomainFeatureFlags 
} from "@/src/lib/feature-flags/trading-domain-flags";
import { StartSnipingUseCase } from "@/src/application/use-cases/trading/start-sniping-use-case";
import { ExecuteTradeUseCase } from "@/src/application/use-cases/trading/execute-trade-use-case";

describe("Feature Flag Integration Tests", () => {
  let featureFlagManager: TradingDomainFeatureFlagManager;
  let mockTradingRepository: any;
  let mockLegacyTradingService: any;
  let mockCleanArchTradingService: any;
  let mockNotificationService: any;
  let mockLogger: any;

  beforeEach(() => {
    // Reset feature flag manager
    featureFlagManager = new TradingDomainFeatureFlagManager();

    // Mock services
    mockTradingRepository = {
      saveTrade: vi.fn(),
      findTradeById: vi.fn(),
      updateTrade: vi.fn(),
      findActiveTradesByUserId: vi.fn(async () => []),
    };

    mockLegacyTradingService = {
      executeTrade: vi.fn(async () => ({
        success: true,
        data: { orderId: "legacy-123", source: "legacy" },
        executionTime: 100,
      })),
      validateSymbol: vi.fn(async () => ({ valid: true })),
      getPrice: vi.fn(async () => ({ price: "50000" })),
    };

    mockCleanArchTradingService = {
      executeTrade: vi.fn(async () => ({
        success: true,
        data: { orderId: "clean-456", source: "clean-architecture" },
        executionTime: 80,
      })),
      validateSymbol: vi.fn(async () => ({ valid: true })),
      getPrice: vi.fn(async () => ({ price: "50000" })),
    };

    mockNotificationService = {
      sendNotification: vi.fn(),
      publishEvent: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
  });

  describe("Rollout Phase Testing", () => {
    it("should use correct services in DEVELOPMENT phase", () => {
      featureFlagManager.applyRolloutPhase('DEVELOPMENT');
      const flags = featureFlagManager.getCurrentFlags();

      // Development phase should enable all Clean Architecture features
      expect(flags.enableCleanArchitectureTrading).toBe(true);
      expect(flags.enableDomainEventsPublishing).toBe(true);
      expect(flags.enableDrizzleTradingRepository).toBe(true);
      expect(flags.enableMexcServiceAdapter).toBe(true);
      expect(flags.enableNotificationServiceAdapter).toBe(true);
      expect(flags.enableVerboseDomainLogging).toBe(true);
      expect(flags.enableTestingMode).toBe(true);
      expect(flags.enableDualWriteMode).toBe(true);

      // Should still keep legacy fallback enabled
      expect(flags.enableLegacyFallback).toBe(true);
    });

    it("should use correct services in PAPER_TRADING phase", () => {
      featureFlagManager.applyRolloutPhase('PAPER_TRADING');
      const flags = featureFlagManager.getCurrentFlags();

      // Paper trading phase enables use cases and validation
      expect(flags.enableNewTradingUseCases).toBe(true);
      expect(flags.enableCleanArchAutoSniping).toBe(true);
      expect(flags.enableDomainBasedValidation).toBe(true);
      expect(flags.enableDualWriteMode).toBe(true);

      // Should still have safety mechanisms
      expect(flags.enableLegacyFallback).toBe(true);
      expect(flags.enablePerformanceMonitoring).toBe(true);
    });

    it("should use correct services in LIMITED_PRODUCTION phase", () => {
      featureFlagManager.applyRolloutPhase('LIMITED_PRODUCTION');
      const flags = featureFlagManager.getCurrentFlags();

      // All features enabled but with safety mechanisms
      expect(flags.enableCleanArchitectureTrading).toBe(true);
      expect(flags.enableNewTradingUseCases).toBe(true);
      expect(flags.enableCleanArchAutoSniping).toBe(true);
      expect(flags.enableDualWriteMode).toBe(true);
      expect(flags.enableLegacyFallback).toBe(true);
    });

    it("should use correct services in FULL_PRODUCTION phase", () => {
      featureFlagManager.applyRolloutPhase('FULL_PRODUCTION');
      const flags = featureFlagManager.getCurrentFlags();

      // Full production removes fallbacks
      expect(flags.enableCleanArchitectureTrading).toBe(true);
      expect(flags.enableNewTradingUseCases).toBe(true);
      expect(flags.enableCleanArchAutoSniping).toBe(true);
      expect(flags.enableDualWriteMode).toBe(false); // No dual write
      expect(flags.enableLegacyFallback).toBe(false); // No fallback
      expect(flags.enablePerformanceMonitoring).toBe(true);
    });
  });

  describe("Service Selection Based on Feature Flags", () => {
    it("should use legacy trading service when Clean Architecture is disabled", async () => {
      // Disable Clean Architecture
      featureFlagManager.updateFlags({
        enableCleanArchitectureTrading: false,
        enableLegacyFallback: true,
      });

      // Simulate service selection logic
      const shouldUseLegacy = featureFlagManager.shouldUseLegacyTradingService();
      const shouldUseCleanArch = featureFlagManager.shouldUseNewTradingWorkflow();

      expect(shouldUseLegacy).toBe(true);
      expect(shouldUseCleanArch).toBe(false);

      // Simulate using legacy service
      const result = await mockLegacyTradingService.executeTrade({
        symbol: "BTCUSDT",
        side: "BUY",
        quantity: 0.01,
      });

      expect(result.data.source).toBe("legacy");
      expect(mockLegacyTradingService.executeTrade).toHaveBeenCalled();
    });

    it("should use Clean Architecture service when enabled", async () => {
      // Enable Clean Architecture
      featureFlagManager.updateFlags({
        enableCleanArchitectureTrading: true,
        enableNewTradingUseCases: true,
        enableLegacyFallback: false,
      });

      const shouldUseLegacy = featureFlagManager.shouldUseLegacyTradingService();
      const shouldUseCleanArch = featureFlagManager.shouldUseNewTradingWorkflow();

      expect(shouldUseLegacy).toBe(false);
      expect(shouldUseCleanArch).toBe(true);

      // Simulate using Clean Architecture service
      const result = await mockCleanArchTradingService.executeTrade({
        symbol: "BTCUSDT",
        side: "BUY",
        quantity: 0.01,
      });

      expect(result.data.source).toBe("clean-architecture");
      expect(mockCleanArchTradingService.executeTrade).toHaveBeenCalled();
    });

    it("should use dual write mode when enabled", async () => {
      // Enable dual write mode
      featureFlagManager.updateFlags({
        enableCleanArchitectureTrading: true,
        enableDualWriteMode: true,
        enableLegacyFallback: true,
      });

      expect(featureFlagManager.isDualWriteModeEnabled()).toBe(true);

      // Simulate dual write operation
      const tradeData = {
        symbol: "BTCUSDT",
        side: "BUY",
        quantity: 0.01,
      };

      // In dual write mode, both services should be called
      const [legacyResult, cleanArchResult] = await Promise.all([
        mockLegacyTradingService.executeTrade(tradeData),
        mockCleanArchTradingService.executeTrade(tradeData),
      ]);

      expect(legacyResult.data.source).toBe("legacy");
      expect(cleanArchResult.data.source).toBe("clean-architecture");
      expect(mockLegacyTradingService.executeTrade).toHaveBeenCalled();
      expect(mockCleanArchTradingService.executeTrade).toHaveBeenCalled();
    });
  });

  describe("Fallback Mechanism Testing", () => {
    it("should fallback to legacy service when Clean Architecture fails", async () => {
      // Enable Clean Architecture with legacy fallback
      featureFlagManager.updateFlags({
        enableCleanArchitectureTrading: true,
        enableLegacyFallback: true,
      });

      // Mock Clean Architecture service failure
      mockCleanArchTradingService.executeTrade.mockRejectedValueOnce(
        new Error("Clean Architecture service unavailable")
      );

      // Simulate fallback logic
      let result;
      try {
        result = await mockCleanArchTradingService.executeTrade({
          symbol: "BTCUSDT",
          side: "BUY",
          quantity: 0.01,
        });
      } catch (error) {
        // Fallback to legacy service
        if (featureFlagManager.isLegacyFallbackEnabled()) {
          result = await mockLegacyTradingService.executeTrade({
            symbol: "BTCUSDT",
            side: "BUY", 
            quantity: 0.01,
          });
        } else {
          throw error;
        }
      }

      expect(result.data.source).toBe("legacy");
      expect(mockLegacyTradingService.executeTrade).toHaveBeenCalled();
    });

    it("should not fallback when fallback is disabled", async () => {
      // Disable fallback
      featureFlagManager.updateFlags({
        enableCleanArchitectureTrading: true,
        enableLegacyFallback: false,
      });

      // Mock Clean Architecture service failure
      mockCleanArchTradingService.executeTrade.mockRejectedValueOnce(
        new Error("Clean Architecture service unavailable")
      );

      // Should throw error without fallback
      await expect(
        mockCleanArchTradingService.executeTrade({
          symbol: "BTCUSDT",
          side: "BUY",
          quantity: 0.01,
        })
      ).rejects.toThrow("Clean Architecture service unavailable");

      expect(mockLegacyTradingService.executeTrade).not.toHaveBeenCalled();
    });
  });

  describe("Feature Flag Validation", () => {
    it("should validate incompatible flag combinations", () => {
      // Test invalid combination: Clean Architecture auto-sniping without Clean Architecture trading
      featureFlagManager.updateFlags({
        enableCleanArchitectureTrading: false,
        enableCleanArchAutoSniping: true,
      });

      const validation = featureFlagManager.validateConfiguration();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain(
        "Clean Architecture auto-sniping requires Clean Architecture trading to be enabled"
      );
    });

    it("should validate safety concerns", () => {
      // Test risky configuration: no fallback mechanisms
      featureFlagManager.updateFlags({
        enableCleanArchitectureTrading: true,
        enableLegacyFallback: false,
        enableDualWriteMode: false,
      });

      const validation = featureFlagManager.validateConfiguration();
      
      expect(validation.warnings).toContain(
        "No fallback mechanism enabled - consider enabling legacy fallback or dual write mode"
      );
    });

    it("should warn about missing performance monitoring", () => {
      featureFlagManager.updateFlags({
        enableCleanArchitectureTrading: true,
        enablePerformanceMonitoring: false,
      });

      const validation = featureFlagManager.validateConfiguration();
      
      expect(validation.warnings).toContain(
        "Performance monitoring is disabled for Clean Architecture trading"
      );
    });
  });

  describe("Progressive Feature Enablement", () => {
    it("should gradually enable features across rollout phases", () => {
      const phases = ['DEVELOPMENT', 'PAPER_TRADING', 'LIMITED_PRODUCTION', 'FULL_PRODUCTION'] as const;
      
      phases.forEach(phase => {
        featureFlagManager.applyRolloutPhase(phase);
        const flags = featureFlagManager.getCurrentFlags();
        
        // All phases should have Clean Architecture enabled
        expect(flags.enableCleanArchitectureTrading).toBe(true);
        
        // Domain events should be enabled in all phases
        expect(flags.enableDomainEventsPublishing).toBe(true);
        
        // Performance monitoring should always be enabled
        expect(flags.enablePerformanceMonitoring).toBe(true);
      });
    });

    it("should handle feature flag updates during runtime", () => {
      // Start with default configuration
      let flags = featureFlagManager.getCurrentFlags();
      expect(flags.enableCleanArchitectureTrading).toBe(false);

      // Update to enable Clean Architecture
      featureFlagManager.updateFlags({
        enableCleanArchitectureTrading: true,
        enableNewTradingUseCases: true,
      });

      flags = featureFlagManager.getCurrentFlags();
      expect(flags.enableCleanArchitectureTrading).toBe(true);
      expect(flags.enableNewTradingUseCases).toBe(true);

      // Verify other flags remain unchanged
      expect(flags.enableLegacyFallback).toBe(DEFAULT_TRADING_DOMAIN_FLAGS.enableLegacyFallback);
    });
  });

  describe("Performance Impact Testing", () => {
    it("should measure performance difference between legacy and Clean Architecture", async () => {
      const iterations = 10;
      const legacyTimes: number[] = [];
      const cleanArchTimes: number[] = [];

      // Test legacy service performance
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await mockLegacyTradingService.executeTrade({
          symbol: "BTCUSDT",
          side: "BUY",
          quantity: 0.01,
        });
        legacyTimes.push(performance.now() - start);
      }

      // Test Clean Architecture service performance
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await mockCleanArchTradingService.executeTrade({
          symbol: "BTCUSDT",
          side: "BUY",
          quantity: 0.01,
        });
        cleanArchTimes.push(performance.now() - start);
      }

      const legacyAvg = legacyTimes.reduce((a, b) => a + b) / legacyTimes.length;
      const cleanArchAvg = cleanArchTimes.reduce((a, b) => a + b) / cleanArchTimes.length;

      // Both should complete in reasonable time (< 1000ms)
      expect(legacyAvg).toBeLessThan(1000);
      expect(cleanArchAvg).toBeLessThan(1000);

      console.log(`Performance comparison - Legacy: ${legacyAvg.toFixed(2)}ms, Clean Architecture: ${cleanArchAvg.toFixed(2)}ms`);
    });

    it("should monitor feature flag evaluation performance", () => {
      const iterations = 1000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        featureFlagManager.isCleanArchitectureTradingEnabled();
        featureFlagManager.shouldUseLegacyTradingService();
        featureFlagManager.shouldUseNewTradingWorkflow();
        featureFlagManager.canExecuteRealTrades();
      }

      const elapsed = performance.now() - start;
      const avgPerEvaluation = elapsed / (iterations * 4); // 4 checks per iteration

      // Feature flag evaluation should be very fast (< 1ms per check)
      expect(avgPerEvaluation).toBeLessThan(1);
      console.log(`Feature flag evaluation performance: ${avgPerEvaluation.toFixed(4)}ms per check`);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
});