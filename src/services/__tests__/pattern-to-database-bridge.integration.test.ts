/**
 * Pattern to Database Bridge Integration Tests
 *
 * Comprehensive integration tests for pattern-to-database conversion functionality.
 * Tests the complete data flow pipeline from pattern detection events to database insertion.
 */

import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PatternDetectionEventData,
  PatternMatch,
} from "../../core/pattern-detection/interfaces";
import { EnhancedPatternDetectionCore } from "../../core/pattern-detection/pattern-detection-core-enhanced";
import { snipeTargets, userPreferences } from "../../db/schema";
import { db } from "../../lib/database-connection-pool";
// Test utilities
import {
  cleanupTestData,
  createTestUser,
  createTestUserPreferences,
} from "../../test-utils/database-helpers";
import { PatternToDatabaseBridge } from "../pattern-to-database-bridge";

describe("PatternToDatabaseBridge Integration Tests", () => {
  let bridge: PatternToDatabaseBridge;
  let patternCore: EnhancedPatternDetectionCore;
  let testUserId: string;

  beforeAll(async () => {
    // Setup test database state
    testUserId = "test-user-bridge-integration";
    await createTestUser(testUserId);
    await createTestUserPreferences(testUserId, {
      defaultBuyAmountUsdt: 250,
      defaultTakeProfitLevel: 3,
      stopLossPercent: 12,
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData(testUserId);
  });

  beforeEach(async () => {
    // Initialize fresh bridge instance for each test
    bridge = PatternToDatabaseBridge.getInstance({
      enabled: true,
      minConfidenceThreshold: 70,
      maxTargetsPerUser: 5,
      defaultPositionSizeUsdt: 100,
      userIdMapping: { test_source: testUserId },
      batchProcessing: false, // Disable for easier testing
    });

    patternCore = EnhancedPatternDetectionCore.getInstance();

    // Clear any existing processed patterns cache
    bridge.clearCache();
  });

  afterEach(async () => {
    // Stop bridge and clear test snipe targets
    bridge.stopListening();
    await db.delete(snipeTargets).where(eq(snipeTargets.userId, testUserId));
  });

  describe("Event Integration", () => {
    it("should successfully start and stop listening to pattern events", async () => {
      // Test starting event listener
      await bridge.startListening();
      const initialStatus = bridge.getStatus();
      expect(initialStatus.isListening).toBe(true);

      // Test stopping event listener
      bridge.stopListening();
      const finalStatus = bridge.getStatus();
      expect(finalStatus.isListening).toBe(false);
    });

    it("should handle pattern detection events and create database records", async () => {
      await bridge.startListening();

      // Create test pattern match
      const testPatternMatch: PatternMatch = {
        patternType: "ready_state",
        confidence: 85,
        symbol: "TESTUSDT",
        vcoinId: "test-vcoin-123",
        indicators: { sts: 2, st: 2, tt: 4 },
        activityInfo: {
          activities: [],
          activityBoost: 1.2,
          hasHighPriorityActivity: true,
          activityTypes: ["test_source"],
        },
        detectedAt: new Date(),
        advanceNoticeHours: 0,
        riskLevel: "medium",
        recommendation: "immediate_action",
      };

      // Create test event data
      const eventData: PatternDetectionEventData = {
        patternType: "ready_state",
        matches: [testPatternMatch],
        metadata: {
          duration: 100,
          source: "test_source",
          averageConfidence: 85,
          highConfidenceCount: 1,
        },
      };

      // Emit pattern event and wait for processing
      patternCore.emit("patterns_detected", eventData);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify database record was created
      const targets = await db
        .select()
        .from(snipeTargets)
        .where(and(eq(snipeTargets.userId, testUserId), eq(snipeTargets.symbolName, "TESTUSDT")));

      expect(targets).toHaveLength(1);
      const target = targets[0];

      expect(target.vcoinId).toBe("test-vcoin-123");
      expect(target.confidenceScore).toBe(85);
      expect(target.status).toBe("ready"); // ready_state patterns should be "ready"
      expect(target.riskLevel).toBe("medium");
      expect(target.positionSizeUsdt).toBe(250); // From user preferences
      expect(target.stopLossPercent).toBe(12); // From user preferences
      expect(target.takeProfitLevel).toBe(3); // From user preferences
    });

    it("should handle multiple pattern types with different statuses", async () => {
      await bridge.startListening();

      const patterns: PatternMatch[] = [
        {
          patternType: "ready_state",
          confidence: 90,
          symbol: "READY1USDT",
          vcoinId: "ready-1",
          indicators: { sts: 2, st: 2, tt: 4 },
          activityInfo: {
            activities: [],
            activityBoost: 1.0,
            hasHighPriorityActivity: false,
            activityTypes: ["test_source"],
          },
          detectedAt: new Date(),
          advanceNoticeHours: 0,
          riskLevel: "low",
          recommendation: "immediate_action",
        },
        {
          patternType: "pre_ready",
          confidence: 75,
          symbol: "PRE1USDT",
          vcoinId: "pre-1",
          indicators: { sts: 1, st: 1, tt: 3 },
          activityInfo: {
            activities: [],
            activityBoost: 1.0,
            hasHighPriorityActivity: false,
            activityTypes: ["test_source"],
          },
          detectedAt: new Date(),
          advanceNoticeHours: 1,
          riskLevel: "medium",
          recommendation: "prepare_entry",
        },
        {
          patternType: "launch_sequence",
          confidence: 80,
          symbol: "LAUNCH1USDT",
          vcoinId: "launch-1",
          indicators: { sts: 1, st: 1, tt: 2, advanceHours: 4 },
          activityInfo: {
            activities: [],
            activityBoost: 1.0,
            hasHighPriorityActivity: false,
            activityTypes: ["test_source"],
          },
          detectedAt: new Date(),
          advanceNoticeHours: 4,
          riskLevel: "low",
          recommendation: "monitor_closely",
        },
      ];

      const eventData: PatternDetectionEventData = {
        patternType: "patterns_detected",
        matches: patterns,
        metadata: {
          duration: 150,
          source: "test_source",
          averageConfidence: 81.67,
          highConfidenceCount: 2,
        },
      };

      patternCore.emit("patterns_detected", eventData);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify all patterns were processed correctly
      const targets = await db
        .select()
        .from(snipeTargets)
        .where(eq(snipeTargets.userId, testUserId));

      expect(targets).toHaveLength(3);

      // Verify ready_state pattern
      const readyTarget = targets.find((t) => t.symbolName === "READY1USDT");
      expect(readyTarget?.status).toBe("ready");
      expect(readyTarget?.priority).toBe(1); // High confidence, ready state should get highest priority

      // Verify pre_ready pattern
      const preReadyTarget = targets.find((t) => t.symbolName === "PRE1USDT");
      expect(preReadyTarget?.status).toBe("pending");
      expect(preReadyTarget?.targetExecutionTime).toBeDefined();

      // Verify launch_sequence pattern
      const launchTarget = targets.find((t) => t.symbolName === "LAUNCH1USDT");
      expect(launchTarget?.status).toBe("pending");
      expect(launchTarget?.targetExecutionTime).toBeDefined();
    });
  });

  describe("Pattern Filtering", () => {
    it("should filter patterns by confidence threshold", async () => {
      await bridge.startListening();

      const patterns: PatternMatch[] = [
        {
          patternType: "ready_state",
          confidence: 95, // Above threshold (70)
          symbol: "HIGH1USDT",
          vcoinId: "high-1",
          indicators: {},
          activityInfo: {
            activities: [],
            activityBoost: 1.0,
            hasHighPriorityActivity: false,
            activityTypes: ["test_source"],
          },
          detectedAt: new Date(),
          advanceNoticeHours: 0,
          riskLevel: "low",
          recommendation: "immediate_action",
        },
        {
          patternType: "ready_state",
          confidence: 65, // Below threshold (70)
          symbol: "LOW1USDT",
          vcoinId: "low-1",
          indicators: {},
          activityInfo: {
            activities: [],
            activityBoost: 1.0,
            hasHighPriorityActivity: false,
            activityTypes: ["test_source"],
          },
          detectedAt: new Date(),
          advanceNoticeHours: 0,
          riskLevel: "low",
          recommendation: "immediate_action",
        },
      ];

      const eventData: PatternDetectionEventData = {
        patternType: "ready_state",
        matches: patterns,
        metadata: {
          duration: 100,
          source: "test_source",
          averageConfidence: 80,
          highConfidenceCount: 1,
        },
      };

      patternCore.emit("patterns_detected", eventData);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Only high confidence pattern should be in database
      const targets = await db
        .select()
        .from(snipeTargets)
        .where(eq(snipeTargets.userId, testUserId));

      expect(targets).toHaveLength(1);
      expect(targets[0].symbolName).toBe("HIGH1USDT");
      expect(targets[0].confidenceScore).toBe(95);
    });

    it("should filter unsupported pattern types", async () => {
      // Configure bridge to only support ready_state patterns
      bridge.updateConfig({
        supportedPatternTypes: ["ready_state"],
      });
      await bridge.startListening();

      const patterns: PatternMatch[] = [
        {
          patternType: "ready_state", // Supported
          confidence: 85,
          symbol: "SUPPORTED1USDT",
          vcoinId: "supported-1",
          indicators: {},
          activityInfo: {
            activities: [],
            activityBoost: 1.0,
            hasHighPriorityActivity: false,
            activityTypes: ["test_source"],
          },
          detectedAt: new Date(),
          advanceNoticeHours: 0,
          riskLevel: "low",
          recommendation: "immediate_action",
        },
        {
          patternType: "risk_warning", // Not supported
          confidence: 90,
          symbol: "UNSUPPORTED1USDT",
          vcoinId: "unsupported-1",
          indicators: {},
          activityInfo: {
            activities: [],
            activityBoost: 1.0,
            hasHighPriorityActivity: false,
            activityTypes: ["test_source"],
          },
          detectedAt: new Date(),
          advanceNoticeHours: 0,
          riskLevel: "high",
          recommendation: "avoid",
        },
      ];

      const eventData: PatternDetectionEventData = {
        patternType: "patterns_detected",
        matches: patterns,
        metadata: {
          duration: 100,
          source: "test_source",
          averageConfidence: 87.5,
          highConfidenceCount: 2,
        },
      };

      patternCore.emit("patterns_detected", eventData);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Only supported pattern should be in database
      const targets = await db
        .select()
        .from(snipeTargets)
        .where(eq(snipeTargets.userId, testUserId));

      expect(targets).toHaveLength(1);
      expect(targets[0].symbolName).toBe("SUPPORTED1USDT");
    });

    it("should filter high-risk patterns when risk filtering is enabled", async () => {
      bridge.updateConfig({
        enableRiskFiltering: true,
      });
      await bridge.startListening();

      const patterns: PatternMatch[] = [
        {
          patternType: "ready_state",
          confidence: 85,
          symbol: "LOWRISK1USDT",
          vcoinId: "low-risk-1",
          indicators: {},
          activityInfo: {
            activities: [],
            activityBoost: 1.0,
            hasHighPriorityActivity: false,
            activityTypes: ["test_source"],
          },
          detectedAt: new Date(),
          advanceNoticeHours: 0,
          riskLevel: "low",
          recommendation: "immediate_action",
        },
        {
          patternType: "ready_state",
          confidence: 85,
          symbol: "HIGHRISK1USDT",
          vcoinId: "high-risk-1",
          indicators: {},
          activityInfo: {
            activities: [],
            activityBoost: 1.0,
            hasHighPriorityActivity: false,
            activityTypes: ["test_source"],
          },
          detectedAt: new Date(),
          advanceNoticeHours: 0,
          riskLevel: "high", // Should be filtered out
          recommendation: "immediate_action",
        },
      ];

      const eventData: PatternDetectionEventData = {
        patternType: "ready_state",
        matches: patterns,
        metadata: {
          duration: 100,
          source: "test_source",
          averageConfidence: 85,
          highConfidenceCount: 2,
        },
      };

      patternCore.emit("patterns_detected", eventData);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Only low-risk pattern should be in database
      const targets = await db
        .select()
        .from(snipeTargets)
        .where(eq(snipeTargets.userId, testUserId));

      expect(targets).toHaveLength(1);
      expect(targets[0].symbolName).toBe("LOWRISK1USDT");
      expect(targets[0].riskLevel).toBe("low");
    });
  });

  describe("Deduplication", () => {
    it("should prevent duplicate patterns from being inserted", async () => {
      await bridge.startListening();

      const basePattern: PatternMatch = {
        patternType: "ready_state",
        confidence: 85,
        symbol: "DUPTEST1USDT",
        vcoinId: "dup-test-1",
        indicators: {},
        activityInfo: {
          activities: [],
          activityBoost: 1.0,
          hasHighPriorityActivity: false,
          activityTypes: ["test_source"],
        },
        detectedAt: new Date(),
        advanceNoticeHours: 0,
        riskLevel: "medium",
        recommendation: "immediate_action",
      };

      // First event
      patternCore.emit("patterns_detected", {
        patternType: "ready_state",
        matches: [basePattern],
        metadata: {
          duration: 100,
          source: "test_source",
          averageConfidence: 85,
          highConfidenceCount: 1,
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Second event with same pattern (should be deduplicated)
      patternCore.emit("patterns_detected", {
        patternType: "ready_state",
        matches: [basePattern],
        metadata: {
          duration: 100,
          source: "test_source",
          averageConfidence: 85,
          highConfidenceCount: 1,
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should only have one record despite two events
      const targets = await db
        .select()
        .from(snipeTargets)
        .where(
          and(eq(snipeTargets.userId, testUserId), eq(snipeTargets.symbolName, "DUPTEST1USDT"))
        );

      expect(targets).toHaveLength(1);
    });

    it("should prevent database-level duplicates for pending targets", async () => {
      // Manually insert a pending target
      await db.insert(snipeTargets).values({
        userId: testUserId,
        vcoinId: "manual-test-1",
        symbolName: "DBDUPTEST1USDT",
        entryStrategy: "market",
        positionSizeUsdt: 100,
        takeProfitLevel: 2,
        stopLossPercent: 15,
        status: "pending",
        priority: 5,
        confidenceScore: 80,
        riskLevel: "medium",
      });

      await bridge.startListening();

      // Try to insert the same symbol via pattern event
      const pattern: PatternMatch = {
        patternType: "ready_state",
        confidence: 85,
        symbol: "DBDUPTEST1USDT", // Same symbol
        vcoinId: "pattern-test-1",
        indicators: {},
        activityInfo: {
          activities: [],
          activityBoost: 1.0,
          hasHighPriorityActivity: false,
          activityTypes: ["test_source"],
        },
        detectedAt: new Date(),
        advanceNoticeHours: 0,
        riskLevel: "medium",
        recommendation: "immediate_action",
      };

      patternCore.emit("patterns_detected", {
        patternType: "ready_state",
        matches: [pattern],
        metadata: {
          duration: 100,
          source: "test_source",
          averageConfidence: 85,
          highConfidenceCount: 1,
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should still only have one record (the original manual insert)
      const targets = await db
        .select()
        .from(snipeTargets)
        .where(
          and(eq(snipeTargets.userId, testUserId), eq(snipeTargets.symbolName, "DBDUPTEST1USDT"))
        );

      expect(targets).toHaveLength(1);
      expect(targets[0].vcoinId).toBe("manual-test-1"); // Original record preserved
    });
  });

  describe("User Preferences Integration", () => {
    it("should use user preferences for position sizing and risk management", async () => {
      await bridge.startListening();

      const pattern: PatternMatch = {
        patternType: "ready_state",
        confidence: 85,
        symbol: "PREFTEST1USDT",
        vcoinId: "pref-test-1",
        indicators: {},
        activityInfo: {
          activities: [],
          activityBoost: 1.0,
          hasHighPriorityActivity: false,
          activityTypes: ["test_source"],
        },
        detectedAt: new Date(),
        advanceNoticeHours: 0,
        riskLevel: "medium",
        recommendation: "immediate_action",
      };

      patternCore.emit("patterns_detected", {
        patternType: "ready_state",
        matches: [pattern],
        metadata: {
          duration: 100,
          source: "test_source",
          averageConfidence: 85,
          highConfidenceCount: 1,
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const targets = await db
        .select()
        .from(snipeTargets)
        .where(
          and(eq(snipeTargets.userId, testUserId), eq(snipeTargets.symbolName, "PREFTEST1USDT"))
        );

      expect(targets).toHaveLength(1);
      const target = targets[0];

      // Should use user preferences from setup
      expect(target.positionSizeUsdt).toBe(250); // From user preferences
      expect(target.takeProfitLevel).toBe(3); // From user preferences
      expect(target.stopLossPercent).toBe(12); // From user preferences
    });

    it("should fall back to default values when user preferences are not found", async () => {
      // Create bridge with mapping to non-existent user
      const bridgeWithUnknownUser = PatternToDatabaseBridge.getInstance({
        enabled: true,
        minConfidenceThreshold: 70,
        defaultPositionSizeUsdt: 150,
        defaultTakeProfitLevel: 2,
        defaultStopLossPercent: 20,
        userIdMapping: { unknown_source: "non-existent-user" },
      });

      await bridgeWithUnknownUser.startListening();

      const pattern: PatternMatch = {
        patternType: "ready_state",
        confidence: 85,
        symbol: "DEFAULTTEST1USDT",
        vcoinId: "default-test-1",
        indicators: {},
        activityInfo: {
          activities: [],
          activityBoost: 1.0,
          hasHighPriorityActivity: false,
          activityTypes: ["unknown_source"],
        },
        detectedAt: new Date(),
        advanceNoticeHours: 0,
        riskLevel: "medium",
        recommendation: "immediate_action",
      };

      patternCore.emit("patterns_detected", {
        patternType: "ready_state",
        matches: [pattern],
        metadata: {
          duration: 100,
          source: "unknown_source",
          averageConfidence: 85,
          highConfidenceCount: 1,
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const targets = await db
        .select()
        .from(snipeTargets)
        .where(eq(snipeTargets.symbolName, "DEFAULTTEST1USDT"));

      expect(targets).toHaveLength(1);
      const target = targets[0];

      // Should use default values from bridge config
      expect(target.positionSizeUsdt).toBe(150);
      expect(target.takeProfitLevel).toBe(2);
      expect(target.stopLossPercent).toBe(20);

      bridgeWithUnknownUser.stopListening();
    });
  });

  describe("Priority Calculation", () => {
    it("should calculate correct priorities based on confidence and pattern type", async () => {
      await bridge.startListening();

      const patterns: PatternMatch[] = [
        {
          patternType: "ready_state",
          confidence: 95, // Very high confidence
          symbol: "HIPRI1USDT",
          vcoinId: "high-pri-1",
          indicators: {},
          activityInfo: {
            activities: [],
            activityBoost: 1.0,
            hasHighPriorityActivity: false,
            activityTypes: ["test_source"],
          },
          detectedAt: new Date(),
          advanceNoticeHours: 0,
          riskLevel: "low", // Low risk should boost priority
          recommendation: "immediate_action",
        },
        {
          patternType: "pre_ready",
          confidence: 75, // Medium confidence
          symbol: "MEDPRI1USDT",
          vcoinId: "med-pri-1",
          indicators: {},
          activityInfo: {
            activities: [],
            activityBoost: 1.0,
            hasHighPriorityActivity: false,
            activityTypes: ["test_source"],
          },
          detectedAt: new Date(),
          advanceNoticeHours: 1,
          riskLevel: "medium",
          recommendation: "prepare_entry",
        },
        {
          patternType: "ready_state",
          confidence: 70, // Lower confidence
          symbol: "LOWPRI1USDT",
          vcoinId: "low-pri-1",
          indicators: {},
          activityInfo: {
            activities: [],
            activityBoost: 1.0,
            hasHighPriorityActivity: false,
            activityTypes: ["test_source"],
          },
          detectedAt: new Date(),
          advanceNoticeHours: 0,
          riskLevel: "high", // High risk should lower priority
          recommendation: "immediate_action",
        },
      ];

      patternCore.emit("patterns_detected", {
        patternType: "patterns_detected",
        matches: patterns,
        metadata: {
          duration: 100,
          source: "test_source",
          averageConfidence: 80,
          highConfidenceCount: 2,
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      const targets = await db
        .select()
        .from(snipeTargets)
        .where(eq(snipeTargets.userId, testUserId));

      expect(targets).toHaveLength(3);

      // Find targets by symbol
      const highPriTarget = targets.find((t) => t.symbolName === "HIPRI1USDT");
      const medPriTarget = targets.find((t) => t.symbolName === "MEDPRI1USDT");
      const lowPriTarget = targets.find((t) => t.symbolName === "LOWPRI1USDT");

      // High confidence + ready state + low risk should get highest priority (lowest number)
      expect(highPriTarget?.priority).toBe(1);

      // Medium confidence + pre_ready should get medium priority
      expect(medPriTarget?.priority).toBeGreaterThan(1);
      expect(medPriTarget?.priority).toBeLessThan(lowPriTarget?.priority);

      // Lower confidence + high risk should get lowest priority (highest number)
      expect(lowPriTarget?.priority).toBeGreaterThan(highPriTarget?.priority);
    });
  });

  describe("User Limit Enforcement", () => {
    it("should enforce per-user target limits", async () => {
      // Configure with low limit for testing
      bridge.updateConfig({
        maxTargetsPerUser: 2,
      });
      await bridge.startListening();

      // Create 3 patterns (should only create 2 targets due to limit)
      const patterns: PatternMatch[] = Array.from({ length: 3 }, (_, i) => ({
        patternType: "ready_state",
        confidence: 85,
        symbol: `LIMIT${i + 1}USDT`,
        vcoinId: `limit-${i + 1}`,
        indicators: {},
        activityInfo: {
          activities: [],
          activityBoost: 1.0,
          hasHighPriorityActivity: false,
          activityTypes: ["test_source"],
        },
        detectedAt: new Date(),
        advanceNoticeHours: 0,
        riskLevel: "medium",
        recommendation: "immediate_action",
      }));

      patternCore.emit("patterns_detected", {
        patternType: "ready_state",
        matches: patterns,
        metadata: {
          duration: 100,
          source: "test_source",
          averageConfidence: 85,
          highConfidenceCount: 3,
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should only have 2 targets due to limit
      const targets = await db
        .select()
        .from(snipeTargets)
        .where(eq(snipeTargets.userId, testUserId));

      expect(targets).toHaveLength(2);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid pattern data gracefully", async () => {
      await bridge.startListening();

      // Create pattern with missing required fields
      const invalidPattern = {
        patternType: "ready_state",
        confidence: 85,
        // Missing symbol and vcoinId
        indicators: {},
        activityInfo: {
          activities: [],
          activityBoost: 1.0,
          hasHighPriorityActivity: false,
          activityTypes: ["test_source"],
        },
        detectedAt: new Date(),
        advanceNoticeHours: 0,
        riskLevel: "medium",
        recommendation: "immediate_action",
      } as PatternMatch;

      patternCore.emit("patterns_detected", {
        patternType: "ready_state",
        matches: [invalidPattern],
        metadata: {
          duration: 100,
          source: "test_source",
          averageConfidence: 85,
          highConfidenceCount: 1,
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not create any targets due to invalid data
      const targets = await db
        .select()
        .from(snipeTargets)
        .where(eq(snipeTargets.userId, testUserId));

      expect(targets).toHaveLength(0);
    });

    it("should continue processing valid patterns when some are invalid", async () => {
      await bridge.startListening();

      const patterns: PatternMatch[] = [
        {
          patternType: "ready_state",
          confidence: 85,
          symbol: "VALID1USDT", // Valid pattern
          vcoinId: "valid-1",
          indicators: {},
          activityInfo: {
            activities: [],
            activityBoost: 1.0,
            hasHighPriorityActivity: false,
            activityTypes: ["test_source"],
          },
          detectedAt: new Date(),
          advanceNoticeHours: 0,
          riskLevel: "medium",
          recommendation: "immediate_action",
        },
        {
          patternType: "ready_state",
          confidence: 85,
          // Missing symbol - invalid pattern
          vcoinId: "invalid-1",
          indicators: {},
          activityInfo: {
            activities: [],
            activityBoost: 1.0,
            hasHighPriorityActivity: false,
            activityTypes: ["test_source"],
          },
          detectedAt: new Date(),
          advanceNoticeHours: 0,
          riskLevel: "medium",
          recommendation: "immediate_action",
        } as PatternMatch,
        {
          patternType: "ready_state",
          confidence: 85,
          symbol: "VALID2USDT", // Valid pattern
          vcoinId: "valid-2",
          indicators: {},
          activityInfo: {
            activities: [],
            activityBoost: 1.0,
            hasHighPriorityActivity: false,
            activityTypes: ["test_source"],
          },
          detectedAt: new Date(),
          advanceNoticeHours: 0,
          riskLevel: "medium",
          recommendation: "immediate_action",
        },
      ];

      patternCore.emit("patterns_detected", {
        patternType: "ready_state",
        matches: patterns,
        metadata: {
          duration: 100,
          source: "test_source",
          averageConfidence: 85,
          highConfidenceCount: 3,
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should create 2 targets from valid patterns
      const targets = await db
        .select()
        .from(snipeTargets)
        .where(eq(snipeTargets.userId, testUserId));

      expect(targets).toHaveLength(2);
      expect(targets.map((t) => t.symbolName).sort()).toEqual(["VALID1USDT", "VALID2USDT"]);
    });
  });

  describe("Complete End-to-End Pipeline", () => {
    it("should complete the full pipeline from pattern detection to database insertion", async () => {
      // Start the bridge
      await bridge.startListening();

      // Verify initial state
      const initialTargets = await db
        .select()
        .from(snipeTargets)
        .where(eq(snipeTargets.userId, testUserId));
      expect(initialTargets).toHaveLength(0);

      // Create comprehensive pattern data
      const comprehensivePattern: PatternMatch = {
        patternType: "ready_state",
        confidence: 88,
        symbol: "FULLTEST1USDT",
        vcoinId: "full-test-123",
        indicators: {
          sts: 2,
          st: 2,
          tt: 4,
          marketConditions: {
            volume: "high",
            volatility: "normal",
          },
        },
        activityInfo: {
          activities: [
            {
              symbol: "FULLTEST1USDT",
              activityType: "listing_announcement",
              priority: "high",
              timestamp: new Date().toISOString(),
              description: "New listing announcement",
            },
          ],
          activityBoost: 1.5,
          hasHighPriorityActivity: true,
          activityTypes: ["test_source"],
        },
        detectedAt: new Date(),
        advanceNoticeHours: 0,
        riskLevel: "low",
        recommendation: "immediate_action",
        similarPatterns: [],
        historicalSuccess: 0.75,
      };

      // Create event data
      const eventData: PatternDetectionEventData = {
        patternType: "ready_state",
        matches: [comprehensivePattern],
        metadata: {
          symbolsAnalyzed: 1,
          duration: 125,
          source: "test_source",
          averageConfidence: 88,
          highConfidenceCount: 1,
        },
      };

      // Emit the pattern event
      patternCore.emit("patterns_detected", eventData);

      // Wait for async processing to complete
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Verify the complete pipeline result
      const finalTargets = await db
        .select()
        .from(snipeTargets)
        .where(
          and(eq(snipeTargets.userId, testUserId), eq(snipeTargets.symbolName, "FULLTEST1USDT"))
        );

      expect(finalTargets).toHaveLength(1);
      const target = finalTargets[0];

      // Verify all fields are correctly mapped
      expect(target.vcoinId).toBe("full-test-123");
      expect(target.symbolName).toBe("FULLTEST1USDT");
      expect(target.confidenceScore).toBe(88);
      expect(target.status).toBe("ready");
      expect(target.riskLevel).toBe("low");
      expect(target.entryStrategy).toBe("market");

      // Verify user preferences integration
      expect(target.positionSizeUsdt).toBe(250); // From test user preferences
      expect(target.takeProfitLevel).toBe(3); // From test user preferences
      expect(target.stopLossPercent).toBe(12); // From test user preferences

      // Verify priority calculation (high confidence + ready state + low risk = high priority)
      expect(target.priority).toBe(1);

      // Verify timestamps
      expect(target.createdAt).toBeDefined();
      expect(target.updatedAt).toBeDefined();
      expect(target.targetExecutionTime).toBeDefined();

      // Verify bridge status
      const bridgeStatus = bridge.getStatus();
      expect(bridgeStatus.isListening).toBe(true);
      expect(bridgeStatus.processedPatternsCount).toBeGreaterThan(0);

      console.log("✅ Complete end-to-end pipeline test passed successfully");
      console.log(
        `Created target: ${target.symbolName} with confidence ${target.confidenceScore}% and priority ${target.priority}`
      );
    });
  });
});
