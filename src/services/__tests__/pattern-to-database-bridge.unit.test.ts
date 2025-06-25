/**
 * Pattern to Database Bridge Unit Tests
 *
 * Unit tests for individual components of the PatternToDatabaseBridge service.
 * These tests focus on business logic and don't require database connectivity.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PatternMatch } from "../../core/pattern-detection/interfaces";
import { PatternToDatabaseBridge } from "../pattern-to-database-bridge";

// Mock dependencies
vi.mock("../../lib/database-connection-pool", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../core/pattern-detection/pattern-detection-core-enhanced", () => ({
  EnhancedPatternDetectionCore: {
    getInstance: vi.fn(() => ({
      on: vi.fn(),
      removeAllListeners: vi.fn(),
    })),
  },
}));

describe("PatternToDatabaseBridge Unit Tests", () => {
  let bridge: PatternToDatabaseBridge;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Get bridge instance (singleton pattern means we need to reset config explicitly)
    bridge = PatternToDatabaseBridge.getInstance();

    // Reset configuration to test defaults (since singleton persists config between tests)
    bridge.updateConfig({
      enabled: true,
      minConfidenceThreshold: 75,
      maxTargetsPerUser: 10,
      defaultPositionSizeUsdt: 100,
      supportedPatternTypes: ["ready_state", "pre_ready", "launch_sequence"],
      enableRiskFiltering: true,
      autoAssignPriority: true,
    });

    // Clear processed patterns cache to ensure clean state between tests
    bridge.clearCache();
  });

  describe("Configuration Management", () => {
    it("should initialize with default configuration", () => {
      const status = bridge.getStatus();

      expect(status.config.enabled).toBe(true);
      expect(status.config.minConfidenceThreshold).toBe(75);
      expect(status.config.supportedPatternTypes).toContain("ready_state");
      expect(status.config.enableRiskFiltering).toBe(true);
    });

    it("should update configuration correctly", () => {
      bridge.updateConfig({
        minConfidenceThreshold: 80,
        maxTargetsPerUser: 5,
        enableRiskFiltering: false,
      });

      const status = bridge.getStatus();
      expect(status.config.minConfidenceThreshold).toBe(80);
      expect(status.config.maxTargetsPerUser).toBe(5);
      expect(status.config.enableRiskFiltering).toBe(false);
    });

    it("should validate configuration updates", () => {
      expect(() => {
        bridge.updateConfig({
          minConfidenceThreshold: 150, // Invalid: > 100
        });
      }).toThrow();

      expect(() => {
        bridge.updateConfig({
          maxTargetsPerUser: 0, // Invalid: < 1
        });
      }).toThrow();
    });
  });

  describe("Pattern Filtering Logic", () => {
    const createTestPattern = (overrides: Partial<PatternMatch> = {}): PatternMatch => ({
      patternType: "ready_state",
      confidence: 85,
      symbol: "TESTUSDT",
      vcoinId: "test-123",
      indicators: { sts: 2, st: 2, tt: 4 },
      activityInfo: {
        activities: [],
        activityBoost: 1.0,
        hasHighPriorityActivity: false,
        activityTypes: ["test"],
      },
      detectedAt: new Date(),
      advanceNoticeHours: 0,
      riskLevel: "medium",
      recommendation: "immediate_action",
      ...overrides,
    });

    it("should filter patterns by confidence threshold", () => {
      const patterns = [
        createTestPattern({ confidence: 90, symbol: "HIGH1USDT" }), // Above threshold
        createTestPattern({ confidence: 70, symbol: "LOW1USDT" }), // Below threshold
        createTestPattern({ confidence: 75, symbol: "EXACT1USDT" }), // Exactly at threshold
      ];

      // Use reflection to access private method for testing
      const bridgeAny = bridge as any;
      const filtered = bridgeAny.filterPatternMatches(patterns);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((p: PatternMatch) => p.symbol)).toEqual(["HIGH1USDT", "EXACT1USDT"]);
    });

    it("should filter unsupported pattern types", () => {
      bridge.updateConfig({
        supportedPatternTypes: ["ready_state", "pre_ready"],
      });

      const patterns = [
        createTestPattern({ patternType: "ready_state", symbol: "SUPPORTED1USDT" }),
        createTestPattern({ patternType: "risk_warning", symbol: "UNSUPPORTED1USDT" }),
        createTestPattern({ patternType: "pre_ready", symbol: "SUPPORTED2USDT" }),
      ];

      const bridgeAny = bridge as any;
      const filtered = bridgeAny.filterPatternMatches(patterns);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((p: PatternMatch) => p.symbol)).toEqual([
        "SUPPORTED1USDT",
        "SUPPORTED2USDT",
      ]);
    });

    it("should filter high-risk patterns when risk filtering is enabled", () => {
      const patterns = [
        createTestPattern({ riskLevel: "low", symbol: "LOW1USDT" }),
        createTestPattern({ riskLevel: "medium", symbol: "MED1USDT" }),
        createTestPattern({ riskLevel: "high", symbol: "HIGH1USDT" }), // Should be filtered
      ];

      const bridgeAny = bridge as any;
      const filtered = bridgeAny.filterPatternMatches(patterns);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((p: PatternMatch) => p.symbol)).toEqual(["LOW1USDT", "MED1USDT"]);
    });

    it("should allow high-risk patterns when risk filtering is disabled", () => {
      bridge.updateConfig({ enableRiskFiltering: false });

      const patterns = [
        createTestPattern({ riskLevel: "low", symbol: "LOW1USDT" }),
        createTestPattern({ riskLevel: "high", symbol: "HIGH1USDT" }),
      ];

      const bridgeAny = bridge as any;
      const filtered = bridgeAny.filterPatternMatches(patterns);

      expect(filtered).toHaveLength(2);
    });

    it("should filter patterns with missing required fields", () => {
      const patterns = [
        createTestPattern({ symbol: "VALID1USDT" }), // Valid
        createTestPattern({ symbol: "", vcoinId: "test" }), // Invalid: empty symbol
        createTestPattern({ symbol: "VALID2USDT", vcoinId: "" }), // Invalid: empty vcoinId
        { ...createTestPattern(), symbol: undefined } as PatternMatch, // Invalid: undefined symbol
      ];

      const bridgeAny = bridge as any;
      const filtered = bridgeAny.filterPatternMatches(patterns);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].symbol).toBe("VALID1USDT");
    });
  });

  describe("Priority Calculation", () => {
    const createTestPattern = (overrides: Partial<PatternMatch> = {}): PatternMatch => ({
      patternType: "ready_state",
      confidence: 85,
      symbol: "TESTUSDT",
      vcoinId: "test-123",
      indicators: {},
      activityInfo: {
        activities: [],
        activityBoost: 1.0,
        hasHighPriorityActivity: false,
        activityTypes: ["test"],
      },
      detectedAt: new Date(),
      advanceNoticeHours: 0,
      riskLevel: "medium",
      recommendation: "immediate_action",
      ...overrides,
    });

    it("should calculate priority based on confidence level", () => {
      const bridgeAny = bridge as any;

      const highConfidence = createTestPattern({ confidence: 95 });
      const mediumConfidence = createTestPattern({ confidence: 80 });
      const lowConfidence = createTestPattern({ confidence: 70 });

      // Note: All patterns use "ready_state" which gives -1 priority adjustment
      // High: 1 (confidence >= 90) → 1 (ready_state: max(1, 1-1)) = 1
      // Medium: 2 (confidence >= 80) → 1 (ready_state: max(1, 2-1)) = 1
      // Low: 4 (confidence >= 70) → 3 (ready_state: max(1, 4-1)) = 3
      expect(bridgeAny.calculatePriority(highConfidence)).toBe(1); // Highest priority
      expect(bridgeAny.calculatePriority(mediumConfidence)).toBe(1); // Also gets ready_state boost
      expect(bridgeAny.calculatePriority(lowConfidence)).toBe(3); // Lower confidence, ready_state boost
    });

    it("should adjust priority based on pattern type", () => {
      const bridgeAny = bridge as any;

      const readyPattern = createTestPattern({ patternType: "ready_state", confidence: 80 });
      const preReadyPattern = createTestPattern({ patternType: "pre_ready", confidence: 80 });
      const launchPattern = createTestPattern({ patternType: "launch_sequence", confidence: 80 });

      const readyPriority = bridgeAny.calculatePriority(readyPattern);
      const preReadyPriority = bridgeAny.calculatePriority(preReadyPattern);
      const launchPriority = bridgeAny.calculatePriority(launchPattern);

      // Ready state and launch sequence should get priority boost
      expect(readyPriority).toBeLessThan(preReadyPriority);
      expect(launchPriority).toBeLessThan(preReadyPriority);
    });

    it("should adjust priority based on risk level", () => {
      const bridgeAny = bridge as any;

      const lowRisk = createTestPattern({ riskLevel: "low", confidence: 80 });
      const mediumRisk = createTestPattern({ riskLevel: "medium", confidence: 80 });
      const highRisk = createTestPattern({ riskLevel: "high", confidence: 80 });

      const lowPriority = bridgeAny.calculatePriority(lowRisk);
      const mediumPriority = bridgeAny.calculatePriority(mediumRisk);
      const highPriority = bridgeAny.calculatePriority(highRisk);

      // With confidence 80 and ready_state pattern:
      // Low: 2 → ready_state (-1) = 1 → low risk (-1) = max(1, 0) = 1
      // Medium: 2 → ready_state (-1) = 1 → no adjustment = 1
      // High: 2 → ready_state (-1) = 1 → high risk (+1) = min(10, 2) = 2
      expect(lowPriority).toBe(1); // Lowest number = highest priority
      expect(mediumPriority).toBe(1); // Same as low risk due to ready_state boost
      expect(highPriority).toBe(2); // Higher number = lower priority
      expect(highPriority).toBeGreaterThan(lowPriority);
      expect(highPriority).toBeGreaterThan(mediumPriority);
    });

    it("should return default priority when auto-assignment is disabled", () => {
      bridge.updateConfig({ autoAssignPriority: false });
      const bridgeAny = bridge as any;

      const pattern = createTestPattern({ confidence: 95, riskLevel: "low" });
      expect(bridgeAny.calculatePriority(pattern)).toBe(5); // Default priority
    });

    it("should ensure priority stays within valid range (1-10)", () => {
      const bridgeAny = bridge as any;

      // Test extreme values that might push priority out of bounds
      const extremePattern = createTestPattern({
        confidence: 100,
        patternType: "ready_state",
        riskLevel: "low",
      });

      const priority = bridgeAny.calculatePriority(extremePattern);
      expect(priority).toBeGreaterThanOrEqual(1);
      expect(priority).toBeLessThanOrEqual(10);
    });
  });

  describe("Execution Time Calculation", () => {
    const createTestPattern = (overrides: Partial<PatternMatch> = {}): PatternMatch => ({
      patternType: "ready_state",
      confidence: 85,
      symbol: "TESTUSDT",
      vcoinId: "test-123",
      indicators: {},
      activityInfo: {
        activities: [],
        activityBoost: 1.0,
        hasHighPriorityActivity: false,
        activityTypes: ["test"],
      },
      detectedAt: new Date(),
      advanceNoticeHours: 0,
      riskLevel: "medium",
      recommendation: "immediate_action",
      ...overrides,
    });

    it("should return immediate execution for ready_state patterns", () => {
      const bridgeAny = bridge as any;
      const pattern = createTestPattern({ patternType: "ready_state" });

      const executionTime = bridgeAny.calculateExecutionTime(pattern);

      expect(executionTime).toBeInstanceOf(Date);
      // Should be very close to current time (within 1 second)
      expect(Math.abs(executionTime.getTime() - Date.now())).toBeLessThan(1000);
    });

    it("should calculate future execution time for launch_sequence patterns", () => {
      const bridgeAny = bridge as any;
      const pattern = createTestPattern({
        patternType: "launch_sequence",
        advanceNoticeHours: 2,
      });

      const executionTime = bridgeAny.calculateExecutionTime(pattern);

      expect(executionTime).toBeInstanceOf(Date);
      // Should be approximately 2 hours from now
      const hoursFromNow = (executionTime.getTime() - Date.now()) / (1000 * 60 * 60);
      expect(hoursFromNow).toBeCloseTo(2, 0); // Within 1 hour tolerance
    });

    it("should calculate execution time for pre_ready patterns", () => {
      const bridgeAny = bridge as any;
      const pattern = createTestPattern({ patternType: "pre_ready" });

      const executionTime = bridgeAny.calculateExecutionTime(pattern);

      expect(executionTime).toBeInstanceOf(Date);
      // Should be approximately 30 minutes from now
      const minutesFromNow = (executionTime.getTime() - Date.now()) / (1000 * 60);
      expect(minutesFromNow).toBeCloseTo(30, 5); // Within 5 minutes tolerance
    });

    it("should return undefined for patterns without specific execution timing", () => {
      const bridgeAny = bridge as any;
      const pattern = createTestPattern({ patternType: "risk_warning" });

      const executionTime = bridgeAny.calculateExecutionTime(pattern);

      expect(executionTime).toBeUndefined();
    });
  });

  describe("User ID Mapping", () => {
    it("should use configured user mapping for pattern sources", () => {
      bridge.updateConfig({
        userIdMapping: {
          calendar_source: "calendar-user-123",
          symbol_source: "symbol-user-456",
        },
      });

      const bridgeAny = bridge as any;

      const calendarPattern = {
        activityInfo: { activityTypes: ["calendar_source"] },
      };
      const symbolPattern = {
        activityInfo: { activityTypes: ["symbol_source"] },
      };
      const unknownPattern = {
        activityInfo: { activityTypes: ["unknown_source"] },
      };

      expect(bridgeAny.getUserIdForPattern(calendarPattern)).toBe("calendar-user-123");
      expect(bridgeAny.getUserIdForPattern(symbolPattern)).toBe("symbol-user-456");
      expect(bridgeAny.getUserIdForPattern(unknownPattern)).toBe("system"); // Fallback
    });

    it("should use environment variable fallback for unmapped sources", () => {
      const originalEnv = process.env.DEFAULT_USER_ID;
      process.env.DEFAULT_USER_ID = "env-user-123";

      const bridgeAny = bridge as any;
      const pattern = { activityInfo: { activityTypes: ["unmapped_source"] } };

      expect(bridgeAny.getUserIdForPattern(pattern)).toBe("env-user-123");

      // Restore original environment
      if (originalEnv !== undefined) {
        process.env.DEFAULT_USER_ID = originalEnv;
      } else {
        delete process.env.DEFAULT_USER_ID;
      }
    });

    it("should use default fallback when no mapping or environment variable", () => {
      const originalEnv = process.env.DEFAULT_USER_ID;
      delete process.env.DEFAULT_USER_ID;

      const bridgeAny = bridge as any;
      const pattern = { activityInfo: { activityTypes: ["unmapped_source"] } };

      expect(bridgeAny.getUserIdForPattern(pattern)).toBe("system");

      // Restore original environment
      if (originalEnv !== undefined) {
        process.env.DEFAULT_USER_ID = originalEnv;
      }
    });
  });

  describe("Cache Management", () => {
    it("should track processed patterns count", () => {
      const initialStatus = bridge.getStatus();
      expect(initialStatus.processedPatternsCount).toBe(0);

      // Clear cache should reset count to 0
      bridge.clearCache();
      const clearedStatus = bridge.getStatus();
      expect(clearedStatus.processedPatternsCount).toBe(0);
    });

    it("should provide cache statistics", () => {
      const status = bridge.getStatus();

      expect(status.cacheSize).toBeDefined();
      expect(typeof status.cacheSize).toBe("number");
      expect(status.cacheSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Status Reporting", () => {
    it("should provide comprehensive status information", () => {
      const status = bridge.getStatus();

      expect(status).toHaveProperty("isListening");
      expect(status).toHaveProperty("config");
      expect(status).toHaveProperty("processedPatternsCount");
      expect(status).toHaveProperty("cacheSize");

      expect(typeof status.isListening).toBe("boolean");
      expect(typeof status.processedPatternsCount).toBe("number");
      expect(typeof status.cacheSize).toBe("number");
    });

    it("should reflect configuration changes in status", () => {
      bridge.updateConfig({
        minConfidenceThreshold: 90,
        maxTargetsPerUser: 3,
      });

      const status = bridge.getStatus();
      expect(status.config.minConfidenceThreshold).toBe(90);
      expect(status.config.maxTargetsPerUser).toBe(3);
    });
  });

  describe("Error Handling", () => {
    it("should handle configuration validation errors gracefully", () => {
      expect(() => {
        bridge.updateConfig({
          minConfidenceThreshold: -10, // Invalid
        });
      }).toThrow();

      // Bridge should continue to work with previous valid config
      const status = bridge.getStatus();
      expect(status.config.minConfidenceThreshold).toBe(75); // Original value
    });

    it("should validate pattern data structure", () => {
      const bridgeAny = bridge as any;

      // Test patterns with missing fields - need to provide detectedAt to avoid getTime() error
      const basePattern = {
        detectedAt: new Date(),
        activityInfo: {
          activityTypes: ["test"],
          activities: [],
          activityBoost: 1.0,
          hasHighPriorityActivity: false,
        },
        riskLevel: "medium",
        recommendation: "immediate_action",
        indicators: {},
      };

      const invalidPatterns = [
        { ...basePattern }, // Missing required fields (patternType, confidence, symbol, vcoinId)
        { ...basePattern, patternType: "ready_state" }, // Missing confidence, symbol, vcoinId
        { ...basePattern, confidence: 85 }, // Missing patternType, symbol, vcoinId
        { ...basePattern, patternType: "ready_state", confidence: 85 }, // Missing symbol, vcoinId
        { ...basePattern, patternType: "ready_state", confidence: 85, symbol: "" }, // Empty symbol
        { ...basePattern, patternType: "ready_state", confidence: 85, symbol: "TEST", vcoinId: "" }, // Empty vcoinId
      ];

      invalidPatterns.forEach((pattern) => {
        const filtered = bridgeAny.filterPatternMatches([pattern]);
        expect(filtered).toHaveLength(0);
      });
    });
  });
});
