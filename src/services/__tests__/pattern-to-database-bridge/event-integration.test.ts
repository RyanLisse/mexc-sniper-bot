/**
 * Pattern to Database Bridge - Event Integration Tests
 *
 * Tests the event handling and basic integration between pattern detection and database storage.
 */

import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type {
  PatternDetectionEventData,
  PatternMatch,
} from "../../../core/pattern-detection/interfaces";
import { db } from "../../../db";
import { snipeTargets } from "../../../db/schema";
import {
  cleanupAllTestData,
  cleanupTestRecords,
  createTestContext,
  setupTestData,
  type TestContext,
  verifyDatabaseConnection,
} from "./test-setup";

describe("Pattern to Database Bridge - Event Integration", () => {
  let testContext: TestContext;
  const testUserId = "test-user-bridge-events";

  beforeAll(async () => {
    console.log("🚀 Starting Event Integration test suite");
    await cleanupAllTestData(testUserId);
    await setupTestData(testUserId);
  });

  afterAll(async () => {
    await cleanupAllTestData(testUserId);
  });

  beforeEach(async () => {
    await cleanupTestRecords(testUserId);
    testContext = createTestContext(testUserId);
    await verifyDatabaseConnection(testUserId);
  });

  afterEach(async () => {
    if (testContext?.bridge) {
      testContext.bridge.stopListening();
      testContext.bridge.clearCache();
    }
    await cleanupTestRecords(testUserId);
  });

  it("should successfully start and stop listening to pattern events", async () => {
    // Test starting event listener
    await testContext.bridge.startListening();
    const initialStatus = testContext.bridge.getStatus();
    expect(initialStatus.isListening).toBe(true);

    // Test stopping event listener
    testContext.bridge.stopListening();
    const finalStatus = testContext.bridge.getStatus();
    expect(finalStatus.isListening).toBe(false);
  });

  it("should handle pattern detection events and create database records", async () => {
    await testContext.bridge.startListening();

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

    // Emit pattern event
    console.log("🔍 Test: Emitting pattern event");
    testContext.patternCore.emit("patterns_detected", eventData);

    // Poll for the database record with timeout (wait for async processing to complete)
    let targets = [];
    let attempts = 0;
    const maxAttempts = 20; // 10 seconds total with 500ms intervals

    while (attempts < maxAttempts) {
      console.log(
        `🔍 Test: Polling attempt ${attempts + 1}/${maxAttempts} for records with userId: ${testUserId}, symbolName: TESTUSDT`
      );

      try {
        targets = await db
          .select()
          .from(snipeTargets)
          .where(and(eq(snipeTargets.userId, testUserId), eq(snipeTargets.symbolName, "TESTUSDT")));

        console.log(`🔍 Test: Found ${targets.length} records on attempt ${attempts + 1}`);

        if (targets.length > 0) {
          console.log(`✅ Test: Records found after ${attempts + 1} attempts:`, targets);
          break; // Records found, exit polling loop
        }
      } catch (error) {
        console.error(`❌ Test: Database query error on attempt ${attempts + 1}:`, error);
      }

      attempts++;
      if (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500)); // Wait 500ms between attempts
      }
    }

    // If still no records found, log debug info and fail the test
    if (targets.length === 0) {
      console.error(`❌ Test: No records found after ${maxAttempts} attempts`);

      // Check bridge status for debugging
      const bridgeStatus = testContext.bridge.getStatus();
      console.log("🔍 Test: Bridge status:", bridgeStatus);

      // Check if any records exist for this user (regardless of symbol)
      const allUserTargets = await db
        .select()
        .from(snipeTargets)
        .where(eq(snipeTargets.userId, testUserId));
      console.log(`🔍 Test: All records for user ${testUserId}:`, allUserTargets);

      // Check if any records exist at all
      const allTargets = await db.select().from(snipeTargets);
      console.log(`🔍 Test: All records in snipe_targets table:`, allTargets);
    }

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
    await testContext.bridge.startListening();

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

    console.log("🔥 About to emit patterns_detected event");
    testContext.patternCore.emit("patterns_detected", eventData);
    console.log("🔥 Event emitted, waiting for processing...");

    // Poll for all 3 database records with timeout
    let targets = [];
    let attempts = 0;
    const maxAttempts = 20; // 10 seconds total with 500ms intervals

    while (attempts < maxAttempts) {
      console.log(
        `🔍 Test: Polling attempt ${attempts + 1}/${maxAttempts} for all records with userId: ${testUserId}`
      );

      try {
        targets = await db.select().from(snipeTargets).where(eq(snipeTargets.userId, testUserId));

        console.log(`🔍 Test: Found ${targets.length} records on attempt ${attempts + 1}`);

        if (targets.length >= 3) {
          console.log(`✅ Test: All 3 records found after ${attempts + 1} attempts:`, targets);
          break; // All records found, exit polling loop
        }
      } catch (error) {
        console.error(`❌ Test: Database query error on attempt ${attempts + 1}:`, error);
      }

      attempts++;
      if (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500)); // Wait 500ms between attempts
      }
    }

    // If not all records found, log debug info
    if (targets.length < 3) {
      console.error(
        `❌ Test: Only found ${targets.length}/3 records after ${maxAttempts} attempts`
      );

      // Check bridge status for debugging
      const bridgeStatus = testContext.bridge.getStatus();
      console.log("🔍 Test: Bridge status:", bridgeStatus);

      // Show what records we did find
      console.log(`🔍 Test: Records found:`, targets);
    }

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
