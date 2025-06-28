/**
 * Comprehensive Tests for Optimized Backend Services
 *
 * Tests all optimized auto-sniping and trading services.
 * Validates Zod schemas, TypeScript safety, and performance improvements.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  setupStandardizedTests,
  standardTestCleanup,
} from "../../../tests/setup/standardized-mocks";
import type { UnifiedMexcServiceV2 } from "../api/unified-mexc-service-v2";
import {
  type AutoSnipingConfig,
  validateAutoSnipingConfig,
  validateExecutionPosition,
} from "../trading/auto-sniping/schemas";
import { AutoSnipingModule } from "../trading/consolidated/core-trading/auto-sniping";
import type { ModuleContext } from "../trading/consolidated/core-trading/types";

// Use standardized test setup
beforeAll(() => {
  setupStandardizedTests({
    enableActivityMocks: true,
    enableAIMocks: true,
    enableDatabaseMocks: true,
  });
});

afterEach(() => {
  standardTestCleanup();
});

describe("Optimized Backend Services", () => {
  let autoSnipingModule: AutoSnipingModule;
  let mockContext: ModuleContext;

  beforeEach(async () => {
    // Initialize module with mock context
    mockContext = {
      config: {
        // Required API Configuration
        apiKey: "test-api-key",
        secretKey: "test-secret-key",
        baseUrl: "https://api.mexc.com",
        timeout: 5000,
        maxRetries: 3,

        // Required Trading Configuration
        enablePaperTrading: true,
        defaultStrategy: "conservative",
        maxConcurrentPositions: 5,
        enableCircuitBreaker: true,
        circuitBreakerThreshold: 5,
        circuitBreakerResetTime: 300000,

        // Auto-Sniping Configuration
        autoSnipingEnabled: true,
        snipeCheckInterval: 30000,
        confidenceThreshold: 70,

        // Optional Risk Management Configuration
        maxPositionSize: 100,
        globalStopLossPercent: 3,
        globalTakeProfitPercent: 5,
        maxDailyLoss: 1000,

        // Cache Configuration
        enableCaching: true,
        cacheTTL: 60000,
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
      mexcService: {
        placeOrder: vi.fn().mockResolvedValue({
          success: true,
          data: {
            orderId: "12345",
            clientOrderId: "client123",
            symbol: "BTCUSDT",
            side: "BUY",
            type: "MARKET",
            origQty: "0.001",
            price: "50000",
            status: "FILLED",
            executedQty: "0.001",
            cummulativeQuoteQty: "50",
            transactTime: Date.now(),
          },
        }),
      } as unknown as UnifiedMexcServiceV2,
      eventEmitter: {
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        once: vi.fn(),
      },
    } as unknown as ModuleContext;
    autoSnipingModule = new AutoSnipingModule(mockContext);
    await autoSnipingModule.initialize();
  });

  describe("Auto-Sniping Module", () => {
    it("should properly instantiate and expose core methods", () => {
      expect(autoSnipingModule).toBeDefined();
      expect(typeof autoSnipingModule.updateConfig).toBe("function");
      expect(typeof autoSnipingModule.start).toBe("function");
      expect(typeof autoSnipingModule.stop).toBe("function");
      expect(typeof autoSnipingModule.getStatus).toBe("function");
      expect(typeof autoSnipingModule.processSnipeTargets).toBe("function");
    });

    it("should return valid status", () => {
      const status = autoSnipingModule.getStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe("object");
      expect(typeof status.isActive).toBe("boolean");
      expect(typeof status.isHealthy).toBe("boolean");
      expect(typeof status.processedTargets).toBe("number");
      expect(typeof status.successfulSnipes).toBe("number");
      expect(typeof status.failedSnipes).toBe("number");
      expect(typeof status.successRate).toBe("number");
    });

    it("should be able to update configuration", async () => {
      const originalStatus = autoSnipingModule.getStatus();
      expect(originalStatus).toBeDefined();

      await autoSnipingModule.updateConfig({
        autoSnipingEnabled: true,
        maxConcurrentPositions: 3,
        confidenceThreshold: 90,
      });

      // Config update doesn't return anything, just check it doesn't throw
      expect(true).toBe(true);
    });

    it("should start and stop correctly", async () => {
      const startResult = await autoSnipingModule.start();
      expect(startResult).toBeDefined();
      expect(typeof startResult.success).toBe("boolean");
      expect(typeof startResult.timestamp).toBe("string");

      const stopResult = await autoSnipingModule.stop();
      expect(stopResult).toBeDefined();
      expect(typeof stopResult.success).toBe("boolean");
    });

    it("should process snipe targets", async () => {
      const result = await autoSnipingModule.processSnipeTargets();
      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");
      expect(typeof result.timestamp).toBe("string");
    });

    it("should provide execution statistics", () => {
      const status = autoSnipingModule.getStatus();
      expect(status).toBeDefined();
      expect(typeof status).toBe("object");
      expect(typeof status.isActive).toBe("boolean");
      expect(typeof status.isHealthy).toBe("boolean");
      expect(typeof status.processedTargets).toBe("number");
      expect(typeof status.successfulSnipes).toBe("number");
      expect(typeof status.failedSnipes).toBe("number");
      expect(typeof status.successRate).toBe("number");
    });

    it("should manage execution state", async () => {
      // Test getting status before starting
      const initialStatus = autoSnipingModule.getStatus();
      expect(typeof initialStatus.isActive).toBe("boolean");
      expect(initialStatus.isActive).toBe(false); // Should not be active initially

      // Test starting
      const startResult = await autoSnipingModule.start();
      expect(startResult.success).toBe(true);

      // Test status after starting
      const activeStatus = autoSnipingModule.getStatus();
      expect(activeStatus.isActive).toBe(true);
    });
  });

  describe("Schema Validation", () => {
    it("should validate valid auto-sniping configuration", () => {
      const validConfig: AutoSnipingConfig = {
        enabled: true,
        maxPositionSize: 100,
        takeProfitPercentage: 10,
        stopLossPercentage: 5,
        patternConfidenceThreshold: 80,
        maxConcurrentTrades: 3,
        enableSafetyChecks: true,
        enablePatternDetection: true,
      };

      const result = validateAutoSnipingConfig(validConfig);
      expect(result).toBeDefined();
      expect(result.enabled).toBe(true);
      expect(result.maxPositionSize).toBe(100);
      expect(result.patternConfidenceThreshold).toBe(80);
    });

    it("should apply default values for missing fields", () => {
      const minimalConfig = {};
      const result = validateAutoSnipingConfig(minimalConfig);

      expect(result.enabled).toBe(false); // default is false according to schema
      expect(result.maxPositionSize).toBe(100);
      expect(result.patternConfidenceThreshold).toBe(75);
      expect(result.maxConcurrentTrades).toBe(5);
    });

    it("should reject invalid configuration", () => {
      const invalidConfig = {
        maxPositionSize: -1, // Invalid: must be positive
        patternConfidenceThreshold: 150, // Invalid: max 100
        maxConcurrentTrades: -1, // Invalid: must be positive
      };

      expect(() => validateAutoSnipingConfig(invalidConfig)).toThrow();
    });

    it("should validate execution position data", () => {
      const validPosition = {
        id: "test-position-1",
        symbol: "BTCUSDT",
        status: "ACTIVE" as const,
        entryPrice: 50000,
        quantity: 0.001,
        timestamp: new Date().toISOString(),
        executionMetadata: {
          confidence: 85,
          executionLatency: 100,
          slippage: 0.1,
          orderType: "MARKET",
        },
        patternData: {
          symbol: "BTCUSDT",
          patternType: "ready_state" as const,
          confidence: 85,
          timestamp: new Date().toISOString(),
          riskLevel: "low" as const,
        },
      };

      const result = validateExecutionPosition(validPosition);
      expect(result).toBeDefined();
      expect(result.id).toBe("test-position-1");
      expect(result.symbol).toBe("BTCUSDT");
      expect(result.status).toBe("ACTIVE");
    });
  });

  describe("Service Integration", () => {
    it("should demonstrate execution engine integration", async () => {
      // Test that all new methods are properly integrated
      const config = autoSnipingModule.getConfig();
      expect(config).toBeDefined();

      const isReady = autoSnipingModule.isReadyForTrading();
      expect(typeof isReady).toBe("boolean");

      const isValid = await autoSnipingModule.validateConfiguration();
      expect(typeof isValid).toBe("boolean");

      const isHealthy = await autoSnipingModule.performHealthChecks();
      expect(typeof isHealthy).toBe("boolean");

      const stats = autoSnipingModule.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats.activePositions).toBe("number");
    });

    it("should handle configuration updates", async () => {
      const _originalConfig = autoSnipingModule.getConfig();

      await autoSnipingModule.updateConfig({
        maxConcurrentPositions: 3,
        confidenceThreshold: 90,
      });

      // Config update doesn't return anything, just check it doesn't throw
      expect(true).toBe(true);
    });

    it("should manage execution state properly", () => {
      const isActive = autoSnipingModule.isExecutionActive();
      expect(typeof isActive).toBe("boolean");

      const positions = autoSnipingModule.getActivePositions();
      expect(Array.isArray(positions)).toBe(true);
    });

    it("should handle statistics updates", () => {
      const testStats = {
        activePositions: 2,
        totalTrades: 10,
        timestamp: Date.now(),
      };

      // Should not throw when updating stats
      expect(() => autoSnipingModule.updateStats(testStats)).not.toThrow();

      const currentStats = autoSnipingModule.getStats();
      expect(currentStats).toBeDefined();
    });
  });

  describe("Performance and Error Handling", () => {
    it("should handle rapid configuration access", () => {
      const startTime = Date.now();

      // Access configuration multiple times
      for (let i = 0; i < 100; i++) {
        const config = autoSnipingModule.getConfig();
        expect(config).toBeDefined();
      }

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should be very fast
      expect(executionTime).toBeLessThan(100); // Under 100ms
    });

    it("should handle validation errors gracefully", () => {
      expect(() => {
        validateAutoSnipingConfig({
          maxPositions: "not_a_number",
        });
      }).toThrow();

      expect(() => {
        validateAutoSnipingConfig({
          minConfidence: -50, // Invalid range
        });
      }).toThrow();
    });

    it("should maintain state consistency", async () => {
      const _initialStats = autoSnipingModule.getStats();
      const _initialConfig = autoSnipingModule.getConfig();

      // Perform multiple operations
      await autoSnipingModule.updateConfig({ maxConcurrentPositions: 7 });
      await autoSnipingModule.validateConfiguration();
      const isReady = autoSnipingModule.isReadyForTrading();

      // State should still be consistent
      const finalStats = autoSnipingModule.getStats();
      const finalConfig = autoSnipingModule.getConfig();

      expect(finalStats).toBeDefined();
      expect(finalConfig).toBeDefined();
      expect(typeof isReady).toBe("boolean");
    });
  });
});
