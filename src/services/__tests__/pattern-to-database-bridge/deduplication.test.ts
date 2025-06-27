/**
 * Pattern to Database Bridge - Deduplication Tests
 * 
 * Tests deduplication functionality to prevent duplicate patterns
 * and database-level duplicate entries.
 */

import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PatternMatch } from "../../../core/pattern-detection/interfaces";
import { db } from "../../../db";
import { snipeTargets } from "../../../db/schema";
import {
  TestContext,
  cleanupAllTestData,
  cleanupTestRecords,
  createTestContext,
  setupTestData,
  verifyDatabaseConnection,
} from "./test-setup";

describe("Pattern to Database Bridge - Deduplication", () => {
  let testContext: TestContext;
  const testUserId = "test-user-bridge-dedup";

  beforeAll(async () => {
    console.log("🚀 Starting Deduplication test suite");
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

  it("should prevent duplicate patterns from being inserted", async () => {
    await testContext.bridge.startListening();

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
    testContext.patternCore.emit("patterns_detected", {
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
    testContext.patternCore.emit("patterns_detected", {
      patternType: "ready_state",
      matches: [basePattern],
      metadata: {
        duration: 100,
        source: "test_source",
        averageConfidence: 85,
        highConfidenceCount: 1,
      },
    });

    // Poll for the database record with timeout (wait for async processing to complete)
    let targets = [];
    let attempts = 0;
    const maxAttempts = 20; // 10 seconds total with 500ms intervals

    while (attempts < maxAttempts) {
      try {
        targets = await db
          .select()
          .from(snipeTargets)
          .where(
            and(eq(snipeTargets.userId, testUserId), eq(snipeTargets.symbolName, "DUPTEST1USDT"))
          );

        if (targets.length > 0) {
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

    await testContext.bridge.startListening();

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

    testContext.patternCore.emit("patterns_detected", {
      patternType: "ready_state",
      matches: [pattern],
      metadata: {
        duration: 100,
        source: "test_source",
        averageConfidence: 85,
        highConfidenceCount: 1,
      },
    });

    // Wait a moment for processing to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

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