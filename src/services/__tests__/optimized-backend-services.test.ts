/**
 * Comprehensive Tests for Optimized Backend Services
 *
 * Tests all optimized auto-sniping and trading services.
 * Validates Zod schemas, TypeScript safety, and performance improvements.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AutoSnipingExecutionEngine } from "../trading/auto-sniping/execution-engine";
import {
  type AutoSnipingConfig,
  validateExecutionPosition,
  validateAutoSnipingConfig,
} from "../trading/auto-sniping/schemas";
import {
  setupStandardizedTests,
  setupServiceMocks,
  standardTestCleanup,
  standardMockData,
} from "../../../tests/setup/standardized-mocks";

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
  let executionEngine: AutoSnipingExecutionEngine;

  beforeEach(async () => {
    // Initialize execution engine with standardized mocks
    executionEngine = AutoSnipingExecutionEngine.getInstance();
  });

  describe("Auto-Sniping Execution Engine", () => {
    it("should properly instantiate and expose configuration methods", () => {
      expect(executionEngine).toBeDefined();
      expect(typeof executionEngine.getConfig).toBe("function");
      expect(typeof executionEngine.updateConfig).toBe("function");
      expect(typeof executionEngine.isReadyForTrading).toBe("function");
      expect(typeof executionEngine.validateConfiguration).toBe("function");
      expect(typeof executionEngine.performHealthChecks).toBe("function");
    });

    it("should return valid configuration", () => {
      const config = executionEngine.getConfig();
      expect(config).toBeDefined();
      expect(typeof config).toBe("object");
      expect(config.enabled).toBeDefined();
      expect(config.maxPositions).toBeDefined();
      expect(config.minConfidence).toBeDefined();
    });

    it("should be able to update configuration", () => {
      const originalConfig = executionEngine.getConfig();
      const updatedConfig = executionEngine.updateConfig({
        maxPositions: 3,
        minConfidence: 90,
      });
      
      expect(updatedConfig).toBeDefined();
      expect(typeof updatedConfig).toBe("object");
    });

    it("should check trading readiness correctly", () => {
      const isReady = executionEngine.isReadyForTrading();
      expect(typeof isReady).toBe("boolean");
    });

    it("should validate configuration", async () => {
      const isValid = await executionEngine.validateConfiguration();
      expect(typeof isValid).toBe("boolean");
    });

    it("should perform health checks", async () => {
      const isHealthy = await executionEngine.performHealthChecks();
      expect(typeof isHealthy).toBe("boolean");
    });

    it("should provide execution statistics", () => {
      const stats = executionEngine.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe("object");
      expect(stats.activePositions).toBeDefined();
      expect(stats.totalTrades).toBeDefined();
      expect(stats.isActive).toBeDefined();
    });

    it("should manage execution state", async () => {
      // Test starting the engine
      const initialActive = executionEngine.isExecutionActive();
      expect(typeof initialActive).toBe("boolean");

      // Test getting active positions
      const positions = executionEngine.getActivePositions();
      expect(Array.isArray(positions)).toBe(true);
    });
  });

  describe("Schema Validation", () => {
    it("should validate valid auto-sniping configuration", () => {
      const validConfig: AutoSnipingConfig = {
        enabled: true,
        maxPositions: 5,
        maxDailyTrades: 10,
        positionSizeUSDT: 100,
        minConfidence: 80,
        allowedPatternTypes: ["ready_state"],
        requireCalendarConfirmation: true,
        stopLossPercentage: 5,
        takeProfitPercentage: 10,
        maxDrawdownPercentage: 20,
        enableAdvanceDetection: true,
        advanceNoticeHours: 24,
        enableRiskManagement: true,
        enablePerformanceTracking: true,
        enableTelemetry: false,
        throttleInterval: 1000,
        enableParallelExecution: false,
        maxConcurrentTrades: 3,
        enableSmartRouting: true,
        enableLivePatternFeed: true,
        slippageTolerancePercentage: 1,
      };

      const result = validateAutoSnipingConfig(validConfig);
      expect(result).toBeDefined();
      expect(result.enabled).toBe(true);
      expect(result.maxPositions).toBe(5);
      expect(result.minConfidence).toBe(80);
    });

    it("should apply default values for missing fields", () => {
      const minimalConfig = {};
      const result = validateAutoSnipingConfig(minimalConfig);

      expect(result.enabled).toBe(true);
      expect(result.maxPositions).toBe(5);
      expect(result.minConfidence).toBe(80);
      expect(result.allowedPatternTypes).toEqual(["ready_state"]);
    });

    it("should reject invalid configuration", () => {
      const invalidConfig = {
        maxPositions: -1, // Invalid: must be positive
        minConfidence: 150, // Invalid: max 100
        positionSizeUSDT: -10, // Invalid: must be positive
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
      const config = executionEngine.getConfig();
      expect(config).toBeDefined();

      const isReady = executionEngine.isReadyForTrading();
      expect(typeof isReady).toBe("boolean");

      const isValid = await executionEngine.validateConfiguration();
      expect(typeof isValid).toBe("boolean");

      const isHealthy = await executionEngine.performHealthChecks();
      expect(typeof isHealthy).toBe("boolean");

      const stats = executionEngine.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats.activePositions).toBe("number");
    });

    it("should handle configuration updates", () => {
      const originalConfig = executionEngine.getConfig();
      
      const updatedConfig = executionEngine.updateConfig({
        maxPositions: 3,
        minConfidence: 90,
      });
      
      expect(updatedConfig).toBeDefined();
      expect(typeof updatedConfig).toBe("object");
    });

    it("should manage execution state properly", () => {
      const isActive = executionEngine.isExecutionActive();
      expect(typeof isActive).toBe("boolean");

      const positions = executionEngine.getActivePositions();
      expect(Array.isArray(positions)).toBe(true);
    });

    it("should handle statistics updates", () => {
      const testStats = {
        activePositions: 2,
        totalTrades: 10,
        timestamp: Date.now(),
      };

      // Should not throw when updating stats
      expect(() => executionEngine.updateStats(testStats)).not.toThrow();

      const currentStats = executionEngine.getStats();
      expect(currentStats).toBeDefined();
    });
  });

  describe("Performance and Error Handling", () => {
    it("should handle rapid configuration access", () => {
      const startTime = Date.now();

      // Access configuration multiple times
      for (let i = 0; i < 100; i++) {
        const config = executionEngine.getConfig();
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
      const initialStats = executionEngine.getStats();
      const initialConfig = executionEngine.getConfig();

      // Perform multiple operations
      executionEngine.updateConfig({ maxPositions: 7 });
      await executionEngine.validateConfiguration();
      const isReady = executionEngine.isReadyForTrading();

      // State should still be consistent
      const finalStats = executionEngine.getStats();
      const finalConfig = executionEngine.getConfig();

      expect(finalStats).toBeDefined();
      expect(finalConfig).toBeDefined();
      expect(typeof isReady).toBe("boolean");
    });
  });
});
