import { neonBranchManager } from "./neon-branch-manager";

/**
 * Test Branch Setup Utility
 *
 * Provides utilities for setting up isolated database branches for testing.
 * Each test run gets its own database branch to ensure complete isolation.
 */

export interface TestBranchContext {
  branchId: string;
  branchName: string;
  connectionString: string;
  originalDatabaseUrl: string;
  cleanup: () => Promise<void>;
}

let currentTestBranch: TestBranchContext | null = null;

/**
 * Setup a test branch before running tests
 */
export async function setupTestBranch(
  options: {
    testSuite?: string;
    timeout?: number;
  } = {}
): Promise<TestBranchContext> {
  const { testSuite = "vitest", timeout = 120000 } = options;

  try {
    console.log(`[TestBranch] Setting up isolated database branch for ${testSuite}...`);

    // Store original DATABASE_URL
    const originalDatabaseUrl = process.env.DATABASE_URL || "";

    if (!originalDatabaseUrl) {
      throw new Error("DATABASE_URL environment variable is required");
    }

    // Check if required Neon credentials are available
    const neonApiKey = process.env.NEON_API_KEY;
    if (!neonApiKey || neonApiKey === "test-neon-key" || neonApiKey === "") {
      console.warn(`[TestBranch] Neon API key not properly configured. Skipping branch creation.`);
      throw new Error("NEON_API_KEY not configured for branch testing");
    }

    // Create a new branch
    const branch = await Promise.race([
      neonBranchManager.createTestBranch({
        name: `${testSuite}-${Date.now()}`,
        waitForEndpoint: true,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Branch creation timeout")), timeout)
      ),
    ]);

    // Update DATABASE_URL to point to the test branch
    process.env.DATABASE_URL = branch.connectionString;

    // Clear any cached database instances
    const { clearDbCache } = await import("@/src/db");
    clearDbCache();

    const context: TestBranchContext = {
      branchId: branch.id,
      branchName: branch.name,
      connectionString: branch.connectionString,
      originalDatabaseUrl,
      cleanup: async () => {
        await cleanupTestBranch(context);
      },
    };

    currentTestBranch = context;

    console.log(`[TestBranch] Test branch ready: ${branch.name} (${branch.id})`);
    console.log(
      `[TestBranch] Connection: ${branch.connectionString.replace(/\/\/.*@/, "//***:***@")}`
    );

    return context;
  } catch (error) {
    console.error("[TestBranch] Failed to setup test branch:", error);
    throw new Error(`Test branch setup failed: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Cleanup test branch after tests complete
 */
export async function cleanupTestBranch(context: TestBranchContext): Promise<void> {
  try {
    console.log(`[TestBranch] Cleaning up test branch: ${context.branchName}`);

    // Restore original DATABASE_URL
    process.env.DATABASE_URL = context.originalDatabaseUrl;

    // Clear cached database instances
    const { clearDbCache } = await import("@/src/db");
    clearDbCache();

    // Delete the branch
    await neonBranchManager.deleteTestBranch(context.branchId);

    // Clear current context
    if (currentTestBranch === context) {
      currentTestBranch = null;
    }

    console.log(`[TestBranch] Test branch cleaned up: ${context.branchName}`);
  } catch (error) {
    console.error(`[TestBranch] Failed to cleanup test branch ${context.branchName}:`, error);
    // Don't throw - cleanup should be best effort
  }
}

/**
 * Get current test branch context
 */
export function getCurrentTestBranch(): TestBranchContext | null {
  return currentTestBranch;
}

/**
 * Run a function with an isolated test branch
 */
export async function withTestBranch<T>(
  testFn: (context: TestBranchContext) => Promise<T>,
  options?: {
    testSuite?: string;
    timeout?: number;
  }
): Promise<T> {
  const context = await setupTestBranch(options);

  try {
    return await testFn(context);
  } finally {
    await cleanupTestBranch(context);
  }
}

/**
 * Setup test branch for Vitest global setup
 */
export async function setupVitestBranch(): Promise<TestBranchContext> {
  return setupTestBranch({ testSuite: "vitest", timeout: 120000 });
}

/**
 * Cleanup all test branches (emergency cleanup)
 */
export async function cleanupAllTestBranches(): Promise<void> {
  try {
    console.log("[TestBranch] Emergency cleanup: removing all test branches...");

    // Cleanup tracked branches
    await neonBranchManager.cleanupAllTrackedBranches();

    // Cleanup old branches by pattern
    await neonBranchManager.cleanupOldTestBranches(0); // Clean all test branches

    console.log("[TestBranch] Emergency cleanup completed");
  } catch (error) {
    console.error("[TestBranch] Emergency cleanup failed:", error);
  }
}

/**
 * Migrate database schema in test branch
 */
export async function migrateTestBranch(context: TestBranchContext): Promise<void> {
  try {
    console.log(`[TestBranch] Running migrations on test branch: ${context.branchName}`);

    // Ensure DATABASE_URL points to test branch
    const originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = context.connectionString;

    try {
      // Import and run migrations
      const { getDb } = await import("@/src/db");
      const { migrate } = await import("drizzle-orm/postgres-js/migrator");
      const db = getDb();

      // Run migrations from the migrations folder
      await migrate(db, { migrationsFolder: "./src/db/migrations" });

      console.log(`[TestBranch] Migrations completed for branch: ${context.branchName}`);
    } finally {
      // Restore original URL
      process.env.DATABASE_URL = originalUrl;
    }
  } catch (error) {
    console.error(`[TestBranch] Migration failed for branch ${context.branchName}:`, error);
    throw new Error(`Migration failed: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Test branch health check
 */
export async function checkTestBranchHealth(context: TestBranchContext): Promise<boolean> {
  try {
    // Temporarily switch to test branch
    const originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = context.connectionString;

    try {
      const { getDb } = await import("@/src/db");
      const { sql } = await import("drizzle-orm");
      const db = getDb();

      // Simple health check query
      await db.execute(sql`SELECT 1 as health_check`);
      return true;
    } finally {
      process.env.DATABASE_URL = originalUrl;
    }
  } catch (error) {
    console.error(`[TestBranch] Health check failed for branch ${context.branchName}:`, error);
    return false;
  }
}

/**
 * Create test database for integration tests
 */
export async function createIntegrationTestDb(): Promise<TestBranchContext> {
  const context = await setupTestBranch({
    testSuite: "integration",
    timeout: 180000, // 3 minutes for integration tests
  });

  // Run migrations
  await migrateTestBranch(context);

  // Verify health
  const isHealthy = await checkTestBranchHealth(context);
  if (!isHealthy) {
    await cleanupTestBranch(context);
    throw new Error("Integration test database health check failed");
  }

  return context;
}

/**
 * Create test database for unit tests (minimal setup)
 */
export async function createUnitTestDb(): Promise<TestBranchContext> {
  return setupTestBranch({
    testSuite: "unit",
    timeout: 60000, // 1 minute for unit tests
  });
}

/**
 * Error recovery: cleanup orphaned branches
 */
export async function recoverFromBranchError(): Promise<void> {
  try {
    console.log("[TestBranch] Recovering from branch creation error...");

    // Reset environment
    if (currentTestBranch) {
      process.env.DATABASE_URL = currentTestBranch.originalDatabaseUrl;
      currentTestBranch = null;
    }

    // Clear database cache
    const { clearDbCache } = await import("@/src/db");
    clearDbCache();

    // Cleanup any orphaned branches
    await neonBranchManager.cleanupOldTestBranches(60000); // Clean branches older than 1 minute

    console.log("[TestBranch] Recovery completed");
  } catch (error) {
    console.error("[TestBranch] Recovery failed:", error);
  }
}
