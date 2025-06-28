/**
 * Test Database Manager
 *
 * Provides comprehensive database management for tests including:
 * - Proper connection pooling
 * - Transaction isolation
 * - Data cleanup between tests
 * - Performance monitoring
 */

import { sql } from "drizzle-orm";
import { getLogger } from "../lib/error-type-utils";
import { closeDatabase, db } from "./index";
import { emergencyTransactionCleanup, testTransaction } from "./transaction-helpers";

export interface TestDatabaseManager {
  setup(): Promise<void>;
  cleanup(): Promise<void>;
  isolateTest<T>(testFn: () => Promise<T>): Promise<T>;
  createTestUser(userId: string): Promise<void>;
  cleanupTestData(userId: string): Promise<void>;
  getConnectionInfo(): Promise<DatabaseConnectionInfo>;
}

export interface DatabaseConnectionInfo {
  activeConnections: number;
  totalConnections: number;
  maxConnections: number;
  connectionHealth: "healthy" | "degraded" | "critical";
}

/**
 * Create a test database manager instance
 */
export function createTestDatabaseManager(): TestDatabaseManager {
  let setupComplete = false;
  const logger = getLogger();

  return {
    async setup(): Promise<void> {
      if (setupComplete) {
        return;
      }

      try {
        logger.info("[TestDB] Setting up test database environment...");

        // Test basic connectivity
        await db.execute(sql`SELECT 1 as health_check`);

        // Ensure test-friendly settings
        await db.execute(sql`SET statement_timeout = '10s'`);
        await db.execute(sql`SET lock_timeout = '5s'`);
        await db.execute(sql`SET idle_in_transaction_session_timeout = '5s'`);

        setupComplete = true;
        logger.info("[TestDB] Test database setup completed");
      } catch (error) {
        logger.error("[TestDB] Database setup failed:", error);
        throw error;
      }
    },

    async cleanup(): Promise<void> {
      try {
        logger.info("[TestDB] Starting database cleanup...");

        // Emergency transaction cleanup
        await emergencyTransactionCleanup();

        // Close database connections
        await closeDatabase();

        setupComplete = false;
        logger.info("[TestDB] Database cleanup completed");
      } catch (error) {
        logger.warn("[TestDB] Cleanup error (non-fatal):", error);
      }
    },

    async isolateTest<T>(testFn: () => Promise<T>): Promise<T> {
      // Run test in a transaction that will be rolled back
      return testTransaction(async (tx) => {
        // Create a savepoint for the test
        await tx.execute(sql`SAVEPOINT test_isolation`);

        try {
          // Execute the test function
          const result = await testFn();

          // Rollback to savepoint to undo any changes
          await tx.execute(sql`ROLLBACK TO SAVEPOINT test_isolation`);

          return result;
        } catch (error) {
          // Rollback to savepoint on error too
          try {
            await tx.execute(sql`ROLLBACK TO SAVEPOINT test_isolation`);
          } catch (rollbackError) {
            logger.warn("[TestDB] Savepoint rollback failed:", rollbackError);
          }
          throw error;
        }
      });
    },

    async createTestUser(userId: string): Promise<void> {
      try {
        // Create user if not exists
        await db.execute(sql`
          INSERT INTO users (id, email, name, avatar_url, created_at, updated_at)
          VALUES (${userId}, ${`${userId}@test.com`}, ${"Test User"}, '', NOW(), NOW())
          ON CONFLICT (id) DO NOTHING
        `);

        logger.debug(`[TestDB] Test user created: ${userId}`);
      } catch (error) {
        logger.warn(`[TestDB] Failed to create test user ${userId}:`, error);
        // Don't throw - user might already exist or table might not exist
      }
    },

    async cleanupTestData(userId: string): Promise<void> {
      try {
        // Clean up in dependency order to avoid foreign key constraints
        const cleanupQueries = [
          sql`DELETE FROM execution_history WHERE user_id = ${userId}`,
          sql`DELETE FROM snipe_targets WHERE user_id = ${userId}`,
          sql`DELETE FROM transactions WHERE user_id = ${userId}`,
          sql`DELETE FROM user_preferences WHERE user_id = ${userId}`,
          sql`DELETE FROM api_credentials WHERE user_id = ${userId}`,
          sql`DELETE FROM workflow_activity WHERE user_id = ${userId}`,
          sql`DELETE FROM trading_strategies WHERE user_id = ${userId}`,
          sql`DELETE FROM users WHERE id = ${userId}`,
        ];

        for (const query of cleanupQueries) {
          try {
            await db.execute(query);
          } catch (error) {
            // Log but continue - table might not exist
            logger.debug(`[TestDB] Cleanup query failed (table might not exist):`, error);
          }
        }

        logger.debug(`[TestDB] Test data cleaned for user: ${userId}`);
      } catch (error) {
        logger.warn(`[TestDB] Cleanup failed for user ${userId}:`, error);
      }
    },

    async getConnectionInfo(): Promise<DatabaseConnectionInfo> {
      try {
        const result = await db.execute(sql`
          SELECT 
            count(*) as active_connections,
            (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
          FROM pg_stat_activity 
          WHERE state = 'active'
        `);

        const row = (result as any)[0];
        const activeConnections = parseInt(row.active_connections || "0");
        const maxConnections = parseInt(row.max_connections || "100");
        const totalConnections = activeConnections; // Simplified for now

        let connectionHealth: "healthy" | "degraded" | "critical" = "healthy";
        const utilization = activeConnections / maxConnections;

        if (utilization > 0.8) {
          connectionHealth = "critical";
        } else if (utilization > 0.6) {
          connectionHealth = "degraded";
        }

        return {
          activeConnections,
          totalConnections,
          maxConnections,
          connectionHealth,
        };
      } catch (error) {
        logger.warn("[TestDB] Failed to get connection info:", error);
        return {
          activeConnections: 0,
          totalConnections: 0,
          maxConnections: 100,
          connectionHealth: "critical",
        };
      }
    },
  };
}

/**
 * Global test database manager instance
 */
let globalTestDbManager: TestDatabaseManager | null = null;

/**
 * Get or create the global test database manager
 */
export function getTestDatabaseManager(): TestDatabaseManager {
  if (!globalTestDbManager) {
    globalTestDbManager = createTestDatabaseManager();
  }
  return globalTestDbManager;
}

/**
 * Test utility: Run a test with automatic database isolation
 */
export async function withDatabaseIsolation<T>(
  testFn: () => Promise<T>,
  userId?: string
): Promise<T> {
  const manager = getTestDatabaseManager();

  // Setup if needed
  await manager.setup();

  // Create test user if provided
  if (userId) {
    await manager.createTestUser(userId);
  }

  try {
    // Run test in isolation
    return await manager.isolateTest(testFn);
  } finally {
    // Cleanup test data if user provided
    if (userId) {
      await manager.cleanupTestData(userId);
    }
  }
}

/**
 * Test utility: Ensure clean database state for tests
 */
export async function ensureCleanDatabaseState(): Promise<void> {
  const manager = getTestDatabaseManager();

  try {
    // Check connection health
    const connectionInfo = await manager.getConnectionInfo();

    if (connectionInfo.connectionHealth === "critical") {
      getLogger().warn("[TestDB] Critical connection state detected, performing cleanup...");
      await manager.cleanup();
      await manager.setup();
    }

    // Emergency cleanup
    await emergencyTransactionCleanup();
  } catch (error) {
    getLogger().warn("[TestDB] Failed to ensure clean state:", error);
  }
}

/**
 * Register cleanup hooks for test environment
 */
if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
  process.on("exit", async () => {
    if (globalTestDbManager) {
      await globalTestDbManager.cleanup();
    }
  });

  process.on("SIGINT", async () => {
    if (globalTestDbManager) {
      await globalTestDbManager.cleanup();
    }
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    if (globalTestDbManager) {
      await globalTestDbManager.cleanup();
    }
    process.exit(0);
  });
}
