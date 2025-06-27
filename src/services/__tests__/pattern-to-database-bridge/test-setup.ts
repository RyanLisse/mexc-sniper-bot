/**
 * Shared test setup utilities for Pattern to Database Bridge tests
 */

import { and, eq } from "drizzle-orm";
import type {
  PatternDetectionEventData,
  PatternMatch,
} from "../../../core/pattern-detection/interfaces";
import { EnhancedPatternDetectionCore } from "../../../core/pattern-detection/pattern-detection-core-enhanced";
import { db } from "../../../db";
import { snipeTargets, userPreferences } from "../../../db/schema";
import {
  cleanupTestData,
  createTestUser,
  createTestUserPreferences,
} from "../../../test-utils/database-helpers";
import { PatternToDatabaseBridge } from "../../data/pattern-detection/pattern-to-database-bridge";

export interface TestContext {
  bridge: PatternToDatabaseBridge;
  patternCore: EnhancedPatternDetectionCore;
  testUserId: string;
}

export const TEST_SYMBOLS = [
  "TESTUSDT",
  "READY1USDT",
  "PRE1USDT",
  "LAUNCH1USDT",
  "HIGH1USDT",
  "LOW1USDT",
  "SUPPORTED1USDT",
  "UNSUPPORTED1USDT",
  "LOWRISK1USDT",
  "HIGHRISK1USDT",
  "DUPTEST1USDT",
  "DBDUPTEST1USDT",
  "PREFTEST1USDT",
  "DEFAULTTEST1USDT",
  "HIPRI1USDT",
  "MEDPRI1USDT",
  "LOWPRI1USDT",
  "LIMIT1USDT",
  "LIMIT2USDT",
  "LIMIT3USDT",
  "VALID1USDT",
  "VALID2USDT",
  "FULLTEST1USDT",
  "CONNTEST",
];

export const DEFAULT_BRIDGE_CONFIG = {
  enabled: true,
  minConfidenceThreshold: 70,
  maxTargetsPerUser: 5,
  defaultPositionSizeUsdt: 100,
  batchProcessing: false, // Disable for easier testing
};

export async function setupTestData(testUserId: string): Promise<void> {
  console.log(`🔧 Setting up test data for user: ${testUserId}`);

  try {
    // Create main test user
    await createTestUser(testUserId);
    console.log(`✅ Test user created: ${testUserId}`);

    await createTestUserPreferences(testUserId, {
      defaultBuyAmountUsdt: 250,
      defaultTakeProfitLevel: 3,
      stopLossPercent: 12,
    });
    console.log(`✅ Test user preferences created: ${testUserId}`);

    // Create the "non-existent-user" for fallback tests
    await createTestUser("non-existent-user");
    console.log(`✅ Fallback test user created: non-existent-user`);

    await createTestUserPreferences("non-existent-user", {
      defaultBuyAmountUsdt: 150,
      defaultTakeProfitLevel: 2,
      stopLossPercent: 20,
    });
    console.log(`✅ Fallback test user preferences created: non-existent-user`);
  } catch (error) {
    console.error(`❌ Test setup failed:`, error);
    throw error;
  }
}

export async function cleanupAllTestData(testUserId: string): Promise<void> {
  console.log("🧹 Cleaning up all test data");

  // Clean up test users
  await cleanupTestData(testUserId);
  await cleanupTestData("non-existent-user");

  // Clean up test symbols
  for (const symbol of TEST_SYMBOLS) {
    await db.delete(snipeTargets).where(eq(snipeTargets.symbolName, symbol));
  }
}

export async function cleanupTestRecords(testUserId: string): Promise<void> {
  console.log("🧹 Cleaning up test records");

  // Delete all records for test users
  await db.delete(snipeTargets).where(eq(snipeTargets.userId, testUserId));
  await db.delete(snipeTargets).where(eq(snipeTargets.userId, "non-existent-user"));

  // Clean up test symbols
  for (const symbol of TEST_SYMBOLS) {
    await db.delete(snipeTargets).where(eq(snipeTargets.symbolName, symbol));
  }
}

export function createTestContext(testUserId: string): TestContext {
  const bridge = PatternToDatabaseBridge.getInstance({
    ...DEFAULT_BRIDGE_CONFIG,
    userIdMapping: { test_source: testUserId },
  });

  const patternCore = EnhancedPatternDetectionCore.getInstance();
  bridge.clearCache();

  return {
    bridge,
    patternCore,
    testUserId,
  };
}

export async function verifyDatabaseConnection(testUserId: string): Promise<void> {
  console.log("🔍 Verifying database connection consistency");

  // Insert a test record
  const testRecord = await db
    .insert(snipeTargets)
    .values({
      userId: testUserId,
      vcoinId: "connection-test",
      symbolName: "CONNTEST",
      entryStrategy: "market",
      positionSizeUsdt: 100,
      takeProfitLevel: 2,
      stopLossPercent: 15,
      status: "pending",
      priority: 5,
      confidenceScore: 75,
      riskLevel: "medium",
    })
    .returning();

  console.log("🔍 Inserted test record:", testRecord[0]);

  // Verify the bridge can see this record
  const bridgeCanSee = await db
    .select()
    .from(snipeTargets)
    .where(and(eq(snipeTargets.userId, testUserId), eq(snipeTargets.symbolName, "CONNTEST")));

  console.log(`🔍 Bridge can see test record: ${bridgeCanSee.length > 0}`, bridgeCanSee);

  // Clean up the test record
  await db.delete(snipeTargets).where(eq(snipeTargets.symbolName, "CONNTEST"));
}

export function createMockPatternEventData(
  overrides: Partial<PatternDetectionEventData> = {}
): PatternDetectionEventData {
  return {
    source: "test_source",
    timestamp: Date.now(),
    patterns: [
      {
        vcoinId: "test-coin-123",
        symbol: "TESTUSDT",
        patternType: "binance_listing_detected",
        confidence: 85,
        metadata: {
          exchange: "binance",
          listingTime: Date.now() + 300000, // 5 minutes from now
          status: "ready",
          riskLevel: "low",
        },
        detectedAt: Date.now(),
      },
    ],
    detectionReason: "automated_scan",
    ...overrides,
  };
}

export function createMockPattern(overrides: Partial<PatternMatch> = {}): PatternMatch {
  return {
    vcoinId: "test-coin-123",
    symbol: "TESTUSDT",
    patternType: "binance_listing_detected",
    confidence: 85,
    metadata: {
      exchange: "binance",
      listingTime: Date.now() + 300000,
      status: "ready",
      riskLevel: "low",
    },
    detectedAt: Date.now(),
    ...overrides,
  };
}
