/**
 * Pattern to Database Bridge - Pattern Filtering Tests
 *
 * Tests pattern filtering functionality including confidence thresholds,
 * supported pattern types, and risk-based filtering.
 */

import { eq } from "drizzle-orm";
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

describe("Pattern to Database Bridge - Pattern Filtering", () => {
  let testContext: TestContext;
  const testUserId = "test-user-bridge-filtering";

  beforeAll(async () => {
    console.log("🚀 Starting Pattern Filtering test suite");
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

  it("should filter patterns by confidence threshold", async () => {
    await testContext.bridge.startListening();

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

    testContext.patternCore.emit("patterns_detected", eventData);

    // Poll for the database record with timeout (wait for async processing to complete)
    let targets = [];
    let attempts = 0;
    const maxAttempts = 20; // 10 seconds total with 500ms intervals

    while (attempts < maxAttempts) {
      try {
        targets = await db.select().from(snipeTargets).where(eq(snipeTargets.userId, testUserId));

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
    expect(targets[0].symbolName).toBe("HIGH1USDT");
    expect(targets[0].confidenceScore).toBe(95);
  });

  it("should filter unsupported pattern types", async () => {
    // Configure bridge to only support ready_state patterns
    testContext.bridge.updateConfig({
      supportedPatternTypes: ["ready_state"],
    });
    await testContext.bridge.startListening();

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

    testContext.patternCore.emit("patterns_detected", eventData);

    // Poll for the database record with timeout (wait for async processing to complete)
    let targets = [];
    let attempts = 0;
    const maxAttempts = 20; // 10 seconds total with 500ms intervals

    while (attempts < maxAttempts) {
      try {
        targets = await db.select().from(snipeTargets).where(eq(snipeTargets.userId, testUserId));

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
    expect(targets[0].symbolName).toBe("SUPPORTED1USDT");

    // Restore original bridge configuration
    testContext.bridge.updateConfig({
      supportedPatternTypes: ["ready_state", "pre_ready", "launch_sequence"],
    });
  });

  it("should filter high-risk patterns when risk filtering is enabled", async () => {
    testContext.bridge.updateConfig({
      enableRiskFiltering: true,
    });
    await testContext.bridge.startListening();

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

    testContext.patternCore.emit("patterns_detected", eventData);

    // Poll for the database record with timeout (wait for async processing to complete)
    let targets = [];
    let attempts = 0;
    const maxAttempts = 20; // 10 seconds total with 500ms intervals

    while (attempts < maxAttempts) {
      try {
        targets = await db.select().from(snipeTargets).where(eq(snipeTargets.userId, testUserId));

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
    expect(targets[0].symbolName).toBe("LOWRISK1USDT");
    expect(targets[0].riskLevel).toBe("low");

    // Restore original bridge configuration
    testContext.bridge.updateConfig({
      enableRiskFiltering: false,
    });
  });
});
