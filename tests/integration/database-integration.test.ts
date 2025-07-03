/**
 * Database Integration Tests
 * 
 * Tests actual database connectivity, operations, and data persistence
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { db } from "../../src/db";
import { 
  coinCalendarEntries, 
  snipeTargets, 
  userPreferences,
  portfolioSnapshots,
  executionHistory
} from "../../src/db/schemas";
import { eq, and, isNull } from "drizzle-orm";

// Set environment for real database testing
process.env.USE_REAL_DATABASE = "true";
process.env.FORCE_MOCK_DB = "false";

describe("Database Integration Tests", () => {
  const testUserId = `test-user-${Date.now()}`;
  const testCleanupIds: string[] = [];

  beforeAll(async () => {
    console.log("🔗 Starting database integration tests with real database connection...");
    
    // Verify database connection
    try {
      await db.execute({ sql: "SELECT 1", args: [] });
      console.log("✅ Database connection verified");
    } catch (error) {
      console.error("❌ Database connection failed:", error);
      throw new Error("Database connection required for integration tests");
    }
  });

  afterAll(async () => {
    console.log("🧹 Cleaning up test data...");
    
    try {
      // Clean up test data
      await db.delete(executionHistory).where(eq(executionHistory.userId, testUserId));
      await db.delete(portfolioSnapshots).where(eq(portfolioSnapshots.userId, testUserId));
      await db.delete(snipeTargets).where(eq(snipeTargets.userId, testUserId));
      await db.delete(userPreferences).where(eq(userPreferences.userId, testUserId));
      
      // Clean up any specific test IDs
      for (const id of testCleanupIds) {
        try {
          await db.delete(coinCalendarEntries).where(eq(coinCalendarEntries.id, id));
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      
      console.log("✅ Test data cleanup completed");
    } catch (error) {
      console.warn("⚠️ Cleanup warning:", error);
    }
  });

  describe("Database Connectivity", () => {
    it("should successfully connect to database", async () => {
      const result = await db.execute({ sql: "SELECT 1 as test", args: [] });
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toHaveProperty("test", 1);
    });

    it("should handle database health check", async () => {
      const result = await db.execute({ 
        sql: "SELECT current_timestamp as now", 
        args: [] 
      });
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toHaveProperty("now");
    });

    it("should check database schema exists", async () => {
      const result = await db.execute({
        sql: `SELECT table_name FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name IN ('coin_calendar_entries', 'snipe_targets', 'user_preferences')`,
        args: []
      });
      
      expect(result.rows.length).toBeGreaterThan(0);
      const tableNames = result.rows.map(row => row.table_name);
      expect(tableNames).toContain("coin_calendar_entries");
      expect(tableNames).toContain("snipe_targets");
      expect(tableNames).toContain("user_preferences");
    });
  });

  describe("User Preferences CRUD Operations", () => {
    it("should create user preferences", async () => {
      const preferences = {
        userId: testUserId,
        preferredCurrency: "USDT",
        riskTolerance: "medium" as const,
        maxPositionSize: 1000,
        enableNotifications: true,
        autoSnipingEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.insert(userPreferences).values(preferences).returning();
      
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(testUserId);
      expect(result[0].preferredCurrency).toBe("USDT");
      expect(result[0].riskTolerance).toBe("medium");
    });

    it("should read user preferences", async () => {
      const result = await db.select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, testUserId));

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(testUserId);
      expect(result[0].preferredCurrency).toBe("USDT");
    });

    it("should update user preferences", async () => {
      const result = await db.update(userPreferences)
        .set({ 
          riskTolerance: "high",
          maxPositionSize: 2000,
          updatedAt: new Date()
        })
        .where(eq(userPreferences.userId, testUserId))
        .returning();

      expect(result).toHaveLength(1);
      expect(result[0].riskTolerance).toBe("high");
      expect(result[0].maxPositionSize).toBe(2000);
    });
  });

  describe("Snipe Targets Management", () => {
    const testSymbol = "TEST_SYMBOL_INTEGRATION";

    it("should create snipe target", async () => {
      const target = {
        userId: testUserId,
        symbolName: testSymbol,
        positionSizeUsdt: 500,
        entryStrategy: "market" as const,
        status: "pending" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.insert(snipeTargets).values(target).returning();
      
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(testUserId);
      expect(result[0].symbolName).toBe(testSymbol);
      expect(result[0].status).toBe("pending");
    });

    it("should query snipe targets by user", async () => {
      const result = await db.select()
        .from(snipeTargets)
        .where(eq(snipeTargets.userId, testUserId));

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].userId).toBe(testUserId);
      expect(result[0].symbolName).toBe(testSymbol);
    });

    it("should update snipe target status", async () => {
      const result = await db.update(snipeTargets)
        .set({ 
          status: "executed",
          executedAt: new Date(),
          updatedAt: new Date()
        })
        .where(and(
          eq(snipeTargets.userId, testUserId),
          eq(snipeTargets.symbolName, testSymbol)
        ))
        .returning();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("executed");
      expect(result[0].executedAt).toBeTruthy();
    });
  });

  describe("Coin Calendar Entries", () => {
    it("should insert calendar entry", async () => {
      const entryId = `test-calendar-${Date.now()}`;
      testCleanupIds.push(entryId);

      const entry = {
        id: entryId,
        symbol: "TESTCOIN",
        date: new Date(),
        description: "Test coin launch",
        category: "listing",
        launchTime: new Date(Date.now() + 3600000), // 1 hour from now
        exchange: "MEXC",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.insert(coinCalendarEntries).values(entry).returning();
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(entryId);
      expect(result[0].symbol).toBe("TESTCOIN");
    });

    it("should query recent calendar entries", async () => {
      const result = await db.select()
        .from(coinCalendarEntries)
        .where(eq(coinCalendarEntries.symbol, "TESTCOIN"))
        .limit(10);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].symbol).toBe("TESTCOIN");
    });
  });

  describe("Portfolio Snapshots", () => {
    it("should create portfolio snapshot", async () => {
      const snapshot = {
        userId: testUserId,
        totalValue: 10000.50,
        totalPnl: 250.75,
        activePositions: 3,
        snapshotData: JSON.stringify({
          holdings: [
            { symbol: "BTC", amount: 0.1, value: 5000 },
            { symbol: "ETH", amount: 2.5, value: 5000.50 }
          ]
        }),
        createdAt: new Date(),
      };

      const result = await db.insert(portfolioSnapshots).values(snapshot).returning();
      
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(testUserId);
      expect(result[0].totalValue).toBe(10000.50);
      expect(result[0].totalPnl).toBe(250.75);
    });

    it("should query latest portfolio snapshots", async () => {
      const result = await db.select()
        .from(portfolioSnapshots)
        .where(eq(portfolioSnapshots.userId, testUserId))
        .orderBy(portfolioSnapshots.createdAt)
        .limit(5);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].userId).toBe(testUserId);
      expect(typeof result[0].snapshotData).toBe("string");
    });
  });

  describe("Execution History Tracking", () => {
    it("should record trade execution", async () => {
      const execution = {
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "buy" as const,
        quantity: 0.001,
        price: 50000,
        executedAt: new Date(),
        orderId: "test-order-123",
        status: "filled" as const,
        fees: 2.5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.insert(executionHistory).values(execution).returning();
      
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(testUserId);
      expect(result[0].symbol).toBe("BTCUSDT");
      expect(result[0].status).toBe("filled");
    });

    it("should query execution history by user", async () => {
      const result = await db.select()
        .from(executionHistory)
        .where(eq(executionHistory.userId, testUserId))
        .orderBy(executionHistory.executedAt);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].userId).toBe(testUserId);
    });
  });

  describe("Database Transactions", () => {
    it("should handle transaction rollback on error", async () => {
      try {
        await db.transaction(async (tx) => {
          // Insert valid data
          await tx.insert(userPreferences).values({
            userId: `tx-test-${Date.now()}`,
            preferredCurrency: "USDT",
            riskTolerance: "medium",
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Force an error to trigger rollback
          throw new Error("Intentional transaction error");
        });
      } catch (error) {
        expect(error.message).toBe("Intentional transaction error");
      }

      // Verify data was not persisted
      const result = await db.select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, `tx-test-${Date.now()}`));
      
      expect(result).toHaveLength(0);
    });

    it("should handle successful transaction commit", async () => {
      const txUserId = `tx-success-${Date.now()}`;
      
      await db.transaction(async (tx) => {
        await tx.insert(userPreferences).values({
          userId: txUserId,
          preferredCurrency: "USDT",
          riskTolerance: "low",
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await tx.insert(snipeTargets).values({
          userId: txUserId,
          symbolName: "TX_TEST_SYMBOL",
          positionSizeUsdt: 100,
          entryStrategy: "limit",
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      // Verify both records were persisted
      const prefsResult = await db.select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, txUserId));
      
      const targetsResult = await db.select()
        .from(snipeTargets)
        .where(eq(snipeTargets.userId, txUserId));

      expect(prefsResult).toHaveLength(1);
      expect(targetsResult).toHaveLength(1);
      
      // Cleanup
      await db.delete(snipeTargets).where(eq(snipeTargets.userId, txUserId));
      await db.delete(userPreferences).where(eq(userPreferences.userId, txUserId));
    });
  });

  describe("Database Performance and Constraints", () => {
    it("should handle concurrent operations", async () => {
      const concurrentUserIds = Array.from({ length: 5 }, (_, i) => 
        `concurrent-${Date.now()}-${i}`
      );

      // Create multiple users concurrently
      const promises = concurrentUserIds.map(userId =>
        db.insert(userPreferences).values({
          userId,
          preferredCurrency: "USDT",
          riskTolerance: "medium",
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning()
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toHaveLength(1);
        expect(result[0].preferredCurrency).toBe("USDT");
      });

      // Cleanup
      for (const userId of concurrentUserIds) {
        await db.delete(userPreferences).where(eq(userPreferences.userId, userId));
      }
    });

    it("should enforce unique constraints", async () => {
      const duplicateUserId = `duplicate-test-${Date.now()}`;
      
      // First insert should succeed
      await db.insert(userPreferences).values({
        userId: duplicateUserId,
        preferredCurrency: "USDT",
        riskTolerance: "medium",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Second insert with same userId should fail
      await expect(
        db.insert(userPreferences).values({
          userId: duplicateUserId,
          preferredCurrency: "BTC",
          riskTolerance: "high",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      ).rejects.toThrow();

      // Cleanup
      await db.delete(userPreferences).where(eq(userPreferences.userId, duplicateUserId));
    });
  });
});