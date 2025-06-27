/**
 * Pattern to Database Bridge - User Preferences Integration Tests
 * 
 * Tests integration with user preferences for position sizing,
 * risk management, and fallback to default values.
 */

import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PatternMatch } from "../../../core/pattern-detection/interfaces";
import { db } from "../../../db";
import { snipeTargets } from "../../../db/schema";
import { PatternToDatabaseBridge } from "../../data/pattern-detection/pattern-to-database-bridge";
import {
  TestContext,
  cleanupAllTestData,
  cleanupTestRecords,
  createTestContext,
  setupTestData,
  verifyDatabaseConnection,
} from "./test-setup";

describe("Pattern to Database Bridge - User Preferences Integration", () => {
  let testContext: TestContext;
  const testUserId = "test-user-bridge-prefs";

  beforeAll(async () => {
    console.log("🚀 Starting User Preferences Integration test suite");
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

  it("should use user preferences for position sizing and risk management", async () => {
    await testContext.bridge.startListening();

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
            and(eq(snipeTargets.userId, testUserId), eq(snipeTargets.symbolName, "PREFTEST1USDT"))
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
    const target = targets[0];

    // Should use user preferences from setup
    expect(target.positionSizeUsdt).toBe(250); // From user preferences
    expect(target.takeProfitLevel).toBe(3); // From user preferences
    expect(target.stopLossPercent).toBe(12); // From user preferences
  });

  it("should fall back to default values when user preferences are not found", async () => {
    // Stop current bridge first
    testContext.bridge.stopListening();

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

    testContext.patternCore.emit("patterns_detected", {
      patternType: "ready_state",
      matches: [pattern],
      metadata: {
        duration: 100,
        source: "unknown_source",
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
          .where(eq(snipeTargets.symbolName, "DEFAULTTEST1USDT"));

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
    const target = targets[0];

    // Should use default values from bridge config
    expect(target.positionSizeUsdt).toBe(150);
    expect(target.takeProfitLevel).toBe(2);
    expect(target.stopLossPercent).toBe(20);

    bridgeWithUnknownUser.stopListening();

    // Restore original bridge configuration for subsequent tests
    testContext.bridge = PatternToDatabaseBridge.getInstance({
      enabled: true,
      minConfidenceThreshold: 70,
      maxTargetsPerUser: 5,
      defaultPositionSizeUsdt: 100,
      userIdMapping: { test_source: testUserId },
      batchProcessing: false,
    });
  });
});