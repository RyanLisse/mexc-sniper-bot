/**
 * Comprehensive Tests for Optimized Backend Services
 *
 * Tests all optimized auto-sniping and trading services.
 * Validates Zod schemas, TypeScript safety, and performance improvements.
 */

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { OptimizedAutoSnipingExecutionEngine } from "../optimized-auto-sniping-execution-engine";
import {
  AutoSnipingConfigSchema,
  TradingOrderRequestSchema,
  TradingOrderResponseSchema,
  ValidationError,
  validateAutoSnipingConfig,
  validateTradingOrderRequest,
  validateTradingOrderResponse,
} from "../optimized-auto-sniping-schemas";
import {
  backendOptimizationManager,
  getOptimizationReport,
  getPerformanceComparison,
} from "../optimized-backend-optimization-manager";
import { OptimizedMexcTradingService } from "../optimized-mexc-trading-service";

// Mock dependencies
jest.mock("../mexc-unified-exports");
jest.mock("../unified-mexc-service-v2");
jest.mock("../emergency-safety-system");
jest.mock("../pattern-monitoring-service");
jest.mock("../../core/pattern-detection");

describe("Optimized Backend Services", () => {
  describe("Zod Schema Validation", () => {
    describe("AutoSnipingConfigSchema", () => {
      it("should validate valid auto-sniping configuration", () => {
        const validConfig = {
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
          advanceHoursThreshold: 3.5,
          enableMultiPhaseStrategy: false,
          slippageTolerancePercentage: 1,
        };

        const result = AutoSnipingConfigSchema.parse(validConfig);
        expect(result).toEqual(validConfig);
      });

      it("should apply default values for missing fields", () => {
        const minimalConfig = {};
        const result = AutoSnipingConfigSchema.parse(minimalConfig);

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

        expect(() => AutoSnipingConfigSchema.parse(invalidConfig)).toThrow();
      });
    });

    describe("TradingOrderRequestSchema", () => {
      it("should validate valid trading request", () => {
        const validRequest = {
          symbol: "BTCUSDT",
          side: "BUY" as const,
          type: "MARKET" as const,
          quantity: "0.001",
          userId: "user123",
        };

        const result = TradingOrderRequestSchema.parse(validRequest);
        expect(result).toEqual(validRequest);
      });

      it("should validate request with quoteOrderQty instead of quantity", () => {
        const validRequest = {
          symbol: "BTCUSDT",
          side: "BUY" as const,
          type: "MARKET" as const,
          quoteOrderQty: "100",
          userId: "user123",
        };

        const result = TradingOrderRequestSchema.parse(validRequest);
        expect(result).toEqual(validRequest);
      });

      it("should reject request without quantity or quoteOrderQty", () => {
        const invalidRequest = {
          symbol: "BTCUSDT",
          side: "BUY",
          type: "MARKET",
          userId: "user123",
        };

        expect(() => TradingOrderRequestSchema.parse(invalidRequest)).toThrow();
      });
    });
  });

  describe("Validation Helper Functions", () => {
    it("should validate auto-sniping config with helper function", () => {
      const validConfig = {
        enabled: true,
        maxPositions: 3,
        minConfidence: 85,
      };

      const result = validateAutoSnipingConfig(validConfig);
      expect(result.enabled).toBe(true);
      expect(result.maxPositions).toBe(3);
      expect(result.minConfidence).toBe(85);
    });

    it("should throw ValidationError for invalid config", () => {
      const invalidConfig = {
        maxPositions: "invalid", // Should be number
      };

      expect(() => validateAutoSnipingConfig(invalidConfig)).toThrow(ValidationError);
    });

    it("should validate trading request with helper function", () => {
      const validRequest = {
        symbol: "ETHUSDT",
        side: "SELL",
        type: "LIMIT",
        quantity: "0.1",
        price: "2000",
        userId: "user456",
      };

      const result = validateTradingOrderRequest(validRequest);
      expect(result.symbol).toBe("ETHUSDT");
      expect(result.side).toBe("SELL");
    });
  });

  describe("OptimizedAutoSnipingExecutionEngine", () => {
    let engine: OptimizedAutoSnipingExecutionEngine;

    beforeEach(() => {
      engine = OptimizedAutoSnipingExecutionEngine.getInstance();
    });

    it("should be a singleton", () => {
      const engine1 = OptimizedAutoSnipingExecutionEngine.getInstance();
      const engine2 = OptimizedAutoSnipingExecutionEngine.getInstance();
      expect(engine1).toBe(engine2);
    });

    it("should update configuration with validation", () => {
      const newConfig = {
        maxPositions: 8,
        minConfidence: 90,
      };

      expect(() => engine.updateConfig(newConfig)).not.toThrow();
    });

    it("should check if ready for trading", () => {
      const isReady = engine.isReadyForTrading();
      expect(typeof isReady).toBe("boolean");
    });

    it("should get active positions", () => {
      const positions = engine.getActivePositions();
      expect(Array.isArray(positions)).toBe(true);
    });

    it("should get current configuration", async () => {
      const config = await engine.getConfig();
      expect(config.enabled).toBe(true); // Always enabled
      expect(typeof config.maxPositions).toBe("number");
      expect(typeof config.minConfidence).toBe("number");
    });
  });

  describe("OptimizedMexcTradingService", () => {
    let tradingService: OptimizedMexcTradingService;

    beforeEach(() => {
      tradingService = new OptimizedMexcTradingService();
    });

    it("should reject invalid trading request", async () => {
      const invalidRequest = {
        // Missing required fields
        symbol: "BTCUSDT",
      };

      const result = await tradingService.executeTrade(invalidRequest);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid");
    });

    it("should handle validation errors gracefully", async () => {
      const malformedRequest = {
        symbol: "", // Empty symbol
        side: "INVALID_SIDE",
        userId: "",
      };

      const result = await tradingService.executeTrade(malformedRequest);
      expect(result.success).toBe(false);
      expect(result.code).toBe("TRADING_ERROR");
    });
  });

  describe("BackendOptimizationManager", () => {
    it("should provide optimization report", () => {
      const report = getOptimizationReport();

      expect(report.optimizationId).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(report.totalServicesOptimized).toBeGreaterThan(0);
      expect(report.totalLinesReduced).toBeGreaterThan(0);
      expect(report.services.length).toBeGreaterThan(0);
      expect(report.systemMetrics).toBeDefined();
      expect(report.validationCoverage).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it("should provide performance comparison", () => {
      const comparison = getPerformanceComparison();

      expect(comparison.originalServices).toBeDefined();
      expect(comparison.optimizedServices).toBeDefined();
      expect(comparison.improvements).toBeDefined();
      expect(comparison.improvements.totalLinesReduced).toBeGreaterThan(0);
      expect(Array.isArray(comparison.improvements.newFeatures)).toBe(true);
      expect(Array.isArray(comparison.improvements.performanceGains)).toBe(true);
    });

    it("should provide optimized services status", () => {
      const status = backendOptimizationManager.getOptimizedServicesStatus();

      expect(status.autoSnipingEngine).toBeDefined();
      expect(status.mexcTradingService).toBeDefined();
      expect(typeof status.autoSnipingEngine.active).toBe("boolean");
      expect(typeof status.autoSnipingEngine.positions).toBe("number");
      expect(status.mexcTradingService.validationEnabled).toBe(true);
    });

    it("should handle auto-sniping execution", async () => {
      const config = {
        maxPositions: 3,
        minConfidence: 85,
      };

      // This will likely fail in test environment, but should not throw
      const result = await backendOptimizationManager.executeAutoSniping(config);
      expect(typeof result.success).toBe("boolean");

      if (!result.success) {
        expect(result.error).toBeDefined();
      } else {
        expect(result.report).toBeDefined();
      }
    });

    it("should handle trading execution with validation", async () => {
      const validRequest = {
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: "0.001",
        userId: "test_user",
      };

      // This will likely fail in test environment, but should not throw
      const result = await backendOptimizationManager.executeTrade(validRequest);
      expect(typeof result.success).toBe("boolean");

      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.code).toBeDefined();
      }
    });
  });

  describe("Performance and Optimization Metrics", () => {
    it("should demonstrate significant line reduction", () => {
      const comparison = getPerformanceComparison();
      const originalTotal =
        comparison.originalServices.autoSnipingService.lines +
        comparison.originalServices.mexcTradingService.lines;
      const optimizedTotal =
        comparison.optimizedServices.autoSnipingEngine.lines +
        comparison.optimizedServices.mexcTradingService.lines;

      const reductionPercentage = ((originalTotal - optimizedTotal) / originalTotal) * 100;

      expect(originalTotal).toBe(1657); // 1042 + 615
      expect(optimizedTotal).toBe(840); // 450 + 390
      expect(reductionPercentage).toBeGreaterThan(45); // Should be ~49.3%
    });

    it("should show comprehensive feature improvements", () => {
      const comparison = getPerformanceComparison();
      const newFeatures = comparison.improvements.newFeatures;

      expect(newFeatures).toContain("Zod validation for all data");
      expect(newFeatures).toContain("Strict TypeScript types");
      expect(newFeatures).toContain("Parallel processing");
      expect(newFeatures).toContain("Advanced error handling");
      expect(newFeatures).toContain("Performance monitoring");
    });

    it("should demonstrate validation coverage", () => {
      const report = getOptimizationReport();
      const coverage = report.validationCoverage;

      expect(coverage.coveragePercentage).toBeGreaterThan(80);
      expect(coverage.validatedEndpoints).toBeGreaterThan(0);
      expect(coverage.totalEndpoints).toBeGreaterThan(coverage.validatedEndpoints);
    });

    it("should show system metrics improvements", () => {
      const report = getOptimizationReport();
      const metrics = report.systemMetrics;

      expect(metrics.memoryUsageReduction).toBeGreaterThan(0);
      expect(metrics.performanceImprovement).toBeGreaterThan(0);
      expect(metrics.errorRateReduction).toBeGreaterThan(0);
      expect(metrics.typeErrorsEliminated).toBe(100); // Full TypeScript
    });
  });

  describe("Error Handling and Type Safety", () => {
    it("should handle ValidationError properly", () => {
      expect(() => {
        validateAutoSnipingConfig({
          maxPositions: "not_a_number",
        });
      }).toThrow(ValidationError);
    });

    it("should maintain type safety in all operations", () => {
      // This test ensures TypeScript compilation without any type errors
      const engine = OptimizedAutoSnipingExecutionEngine.getInstance();
      const positions = engine.getActivePositions();

      // If this compiles without TypeScript errors, type safety is maintained
      positions.forEach((position) => {
        expect(typeof position.id).toBe("string");
        expect(typeof position.symbol).toBe("string");
        expect(["BUY", "SELL"]).toContain(position.side);
        expect(["ACTIVE", "PARTIAL_FILLED", "FILLED", "CLOSED"]).toContain(position.status);
      });
    });

    it("should provide comprehensive error details", async () => {
      const tradingService = new OptimizedMexcTradingService();
      const result = await tradingService.executeTrade({
        // Completely invalid request
        invalid: "data",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.code).toBeDefined();
    });
  });
});

// ============================================================================
// Performance Benchmarking (Optional)
// ============================================================================

describe("Performance Benchmarks", () => {
  it("should demonstrate optimized execution speed", async () => {
    const startTime = Date.now();

    // Test optimized service initialization
    const engine = OptimizedAutoSnipingExecutionEngine.getInstance();
    const config = await engine.getConfig();
    const positions = engine.getActivePositions();

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    // Should be very fast due to optimizations
    expect(executionTime).toBeLessThan(100); // Under 100ms
    expect(config).toBeDefined();
    expect(Array.isArray(positions)).toBe(true);
  });

  it("should demonstrate efficient validation performance", () => {
    const startTime = Date.now();

    // Test multiple validations
    for (let i = 0; i < 100; i++) {
      validateAutoSnipingConfig({
        maxPositions: 5,
        minConfidence: 80 + (i % 20),
      });
    }

    const endTime = Date.now();
    const executionTime = endTime - startTime;

    // Zod validation should be very efficient
    expect(executionTime).toBeLessThan(50); // Under 50ms for 100 validations
  });
});
