/**
 * Database Test Helpers
 *
 * Utility functions for setting up and cleaning up test data in integration tests.
 */

import { eq } from "drizzle-orm";
import { db } from "../db";
import { snipeTargets, user, userPreferences } from "../db/schema";

/**
 * Creates a test user in the database
 */
export async function createTestUser(userId: string): Promise<void> {
  try {
    // Check if user already exists
    const existingUser = await db.select().from(user).where(eq(user.id, userId)).limit(1);

    if (existingUser.length === 0) {
      await db.insert(user).values({
        id: userId,
        email: `${userId}@test.example.com`,
        name: `Test User ${userId}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  } catch (error) {
    // If table doesn't exist or user creation fails, continue silently
    // This allows tests to run even if user management isn't fully implemented
    console.warn(
      `Test user creation warning: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Creates test user preferences
 */
export async function createTestUserPreferences(
  userId: string,
  preferences: {
    defaultBuyAmountUsdt?: number;
    defaultTakeProfitLevel?: number;
    stopLossPercent?: number;
    takeProfitCustom?: number;
  }
): Promise<void> {
  try {
    // Delete existing preferences first
    await db.delete(userPreferences).where(eq(userPreferences.userId, userId));

    // Insert new preferences
    await db.insert(userPreferences).values({
      userId,
      defaultBuyAmountUsdt: preferences.defaultBuyAmountUsdt ?? 100,
      defaultTakeProfitLevel: preferences.defaultTakeProfitLevel ?? 2,
      stopLossPercent: preferences.stopLossPercent ?? 15,
      takeProfitCustom: preferences.takeProfitCustom,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (error) {
    console.warn(
      `Test user preferences creation warning: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Cleans up all test data for a user
 */
export async function cleanupTestData(userId: string): Promise<void> {
  try {
    // Clean up snipe targets
    await db.delete(snipeTargets).where(eq(snipeTargets.userId, userId));

    // Clean up user preferences
    await db.delete(userPreferences).where(eq(userPreferences.userId, userId));

    // Clean up user (if exists)
    try {
      await db.delete(user).where(eq(user.id, userId));
    } catch (error) {
      // User table might not exist, ignore
    }
  } catch (error) {
    console.warn(
      `Test cleanup warning: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Gets all snipe targets for a user
 */
export async function getTestUserSnipeTargets(userId: string) {
  try {
    return await db.select().from(snipeTargets).where(eq(snipeTargets.userId, userId));
  } catch (error) {
    console.warn(
      `Get test targets warning: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    return [];
  }
}

/**
 * Creates a test snipe target
 */
export async function createTestSnipeTarget(
  userId: string,
  targetData: {
    symbolName: string;
    vcoinId: string;
    confidenceScore: number;
    status?: string;
    positionSizeUsdt?: number;
    priority?: number;
    riskLevel?: string;
  }
) {
  try {
    const target = await db
      .insert(snipeTargets)
      .values({
        userId,
        vcoinId: targetData.vcoinId,
        symbolName: targetData.symbolName,
        entryStrategy: "market",
        positionSizeUsdt: targetData.positionSizeUsdt ?? 100,
        takeProfitLevel: 2,
        stopLossPercent: 15,
        status: targetData.status ?? "pending",
        priority: targetData.priority ?? 5,
        confidenceScore: targetData.confidenceScore,
        riskLevel: targetData.riskLevel ?? "medium",
      })
      .returning();

    return target[0];
  } catch (error) {
    console.warn(
      `Create test target warning: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    return null;
  }
}

/**
 * Waits for async database operations to complete
 */
export async function waitForDatabase(ms: number = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Counts records in a table with optional where clause
 */
export async function countRecords(
  tableName: "snipe_targets" | "user_preferences" | "user",
  whereClause?: any
): Promise<number> {
  try {
    let query;

    switch (tableName) {
      case "snipe_targets":
        query = db.select().from(snipeTargets);
        break;
      case "user_preferences":
        query = db.select().from(userPreferences);
        break;
      case "user":
        query = db.select().from(user);
        break;
      default:
        return 0;
    }

    if (whereClause) {
      query = query.where(whereClause);
    }

    const results = await query;
    return results.length;
  } catch (error) {
    console.warn(
      `Count records warning: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    return 0;
  }
}

/**
 * Sets up a clean test environment
 */
export async function setupTestEnvironment(): Promise<void> {
  // This function can be extended to set up any global test state
  // Currently just ensures a clean starting point
}

/**
 * Tears down test environment
 */
export async function teardownTestEnvironment(): Promise<void> {
  // Clean up any global test state
  // This is called after all tests complete
}

/**
 * Creates multiple test patterns for bulk testing
 */
export function createTestPatterns(count: number, baseSymbol: string = "TEST") {
  return Array.from({ length: count }, (_, i) => ({
    patternType: "ready_state" as const,
    confidence: 75 + i * 5, // Varying confidence scores
    symbol: `${baseSymbol}${i + 1}USDT`,
    vcoinId: `test-${baseSymbol.toLowerCase()}-${i + 1}`,
    indicators: { sts: 2, st: 2, tt: 4 },
    activityInfo: {
      activities: [],
      activityBoost: 1.0,
      hasHighPriorityActivity: false,
      activityTypes: ["test_source"],
    },
    detectedAt: new Date(),
    advanceNoticeHours: 0,
    riskLevel: ["low", "medium", "high"][i % 3] as "low" | "medium" | "high",
    recommendation: "immediate_action" as const,
  }));
}

/**
 * Verifies that a pattern was correctly converted to a database record
 */
export function verifyPatternToRecordConversion(
  pattern: any,
  record: any,
  userPrefs: any = null
): boolean {
  try {
    // Check basic mapping
    if (record.symbolName !== pattern.symbol) return false;
    if (record.vcoinId !== (pattern.vcoinId || pattern.symbol)) return false;
    if (record.confidenceScore !== Math.round(pattern.confidence)) return false;
    if (record.riskLevel !== pattern.riskLevel) return false;

    // Check status mapping
    const expectedStatus = pattern.patternType === "ready_state" ? "ready" : "pending";
    if (record.status !== expectedStatus) return false;

    // Check user preferences integration
    if (userPrefs) {
      if (record.positionSizeUsdt !== userPrefs.defaultBuyAmountUsdt) return false;
      if (record.takeProfitLevel !== userPrefs.defaultTakeProfitLevel) return false;
      if (record.stopLossPercent !== userPrefs.stopLossPercent) return false;
    }

    return true;
  } catch (error) {
    console.warn(
      `Pattern verification warning: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    return false;
  }
}
