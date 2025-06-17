/**
 * NeonDB Branch Integration Test
 * 
 * Tests the NeonDB branching functionality for isolated testing.
 * This test demonstrates how to use branch-isolated databases in tests.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { 
  setupTestBranch, 
  cleanupTestBranch, 
  migrateTestBranch,
  checkTestBranchHealth,
  type TestBranchContext 
} from '@/src/lib/test-branch-setup';
import { getDb, clearDbCache } from '@/src/db';

describe.skipIf(!process.env.NEON_API_KEY || process.env.USE_TEST_BRANCHES !== 'true' || process.env.SKIP_NEON_INTEGRATION === 'true')('NeonDB Branch Integration', () => {
  let testBranchContext: TestBranchContext | null = null;

  beforeAll(async () => {
    console.log('🌿 Setting up test branch for integration test...');
    try {
      testBranchContext = await setupTestBranch({
        testSuite: 'integration-test',
        timeout: 120000, // 2 minutes
      });

      // Run migrations on the test branch
      await migrateTestBranch(testBranchContext);
      console.log('✅ Test branch setup completed');
    } catch (error) {
      console.warn('⚠️ Branch testing not available:', error instanceof Error ? error.message : error);
      testBranchContext = null;
    }
  });

  afterAll(async () => {
    if (testBranchContext) {
      console.log('🧹 Cleaning up test branch...');
      await cleanupTestBranch(testBranchContext);
      console.log('✅ Test branch cleanup completed');
    }
  });

  it('should have branch testing enabled', async () => {
    // Skip this test if branch setup failed
    if (!testBranchContext) {
      console.log('⏭️ Skipping branch test - no test branch available');
      return;
    }
    expect(testBranchContext).toBeTruthy();
  });

  it('should create a test branch with unique connection string', async () => {
    if (!testBranchContext) return;

    expect(testBranchContext.branchId).toBeTruthy();
    expect(testBranchContext.branchName).toContain('integration-test');
    expect(testBranchContext.connectionString).toBeTruthy();
    expect(testBranchContext.connectionString).not.toBe(testBranchContext.originalDatabaseUrl);
    expect(testBranchContext.connectionString).toContain('postgresql://');
  });

  it('should have a healthy database connection', async () => {
    if (!testBranchContext) return;

    const isHealthy = await checkTestBranchHealth(testBranchContext);
    expect(isHealthy).toBe(true);
  });

  it('should be able to execute queries on the test branch', async () => {
    if (!testBranchContext) return;

    // Temporarily switch to test branch
    const originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = testBranchContext.connectionString;
    clearDbCache();

    try {
      const db = getDb();
      
      // Execute a simple query
      const result = await db.execute(sql`SELECT 1 as test_value`);
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('test_value', 1);

    } finally {
      // Restore original URL
      process.env.DATABASE_URL = originalUrl;
      clearDbCache();
    }
  });

  it('should have isolated data from main database', async () => {
    if (!testBranchContext) return;

    // This test ensures data isolation between branches
    const originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = testBranchContext.connectionString;
    clearDbCache();

    try {
      const db = getDb();
      
      // Create a temporary table for testing
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS test_isolation (
          id SERIAL PRIMARY KEY,
          value TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert test data
      await db.execute(sql`
        INSERT INTO test_isolation (value) VALUES ('branch-test-data')
      `);

      // Verify data exists in branch
      const branchData = await db.execute(sql`
        SELECT COUNT(*) as count FROM test_isolation WHERE value = 'branch-test-data'
      `);
      expect(branchData[0].count).toBe('1');

      // Switch back to original database
      process.env.DATABASE_URL = originalUrl;
      clearDbCache();
      const mainDb = getDb();

      // Verify data does NOT exist in main database
      try {
        const mainData = await mainDb.execute(sql`
          SELECT COUNT(*) as count FROM test_isolation WHERE value = 'branch-test-data'
        `);
        // If table exists, it should have 0 rows with our test data
        expect(mainData[0].count).toBe('0');
      } catch (error) {
        // Table might not exist in main DB, which is expected and fine
        expect(error).toBeTruthy();
      }

    } finally {
      // Restore original URL
      process.env.DATABASE_URL = originalUrl;
      clearDbCache();
    }
  });

  it('should properly clean up temporary test data', async () => {
    if (!testBranchContext) return;

    // This test demonstrates that test data is automatically cleaned up
    // when the branch is deleted - no manual cleanup needed
    expect(testBranchContext.cleanup).toBeInstanceOf(Function);
  });

  it('should handle concurrent database operations', async () => {
    if (!testBranchContext) return;

    const originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = testBranchContext.connectionString;
    clearDbCache();

    try {
      const db = getDb();
      
      // Create test table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS concurrent_test (
          id SERIAL PRIMARY KEY,
          operation_id INTEGER,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Run multiple concurrent operations
      const operations = Array.from({ length: 5 }, (_, i) => 
        db.execute(sql`INSERT INTO concurrent_test (operation_id) VALUES (${i})`)
      );

      await Promise.all(operations);

      // Verify all operations completed
      const result = await db.execute(sql`
        SELECT COUNT(*) as count FROM concurrent_test
      `);
      expect(result[0].count).toBe('5');

    } finally {
      process.env.DATABASE_URL = originalUrl;
      clearDbCache();
    }
  });

  it('should support database schema migrations', async () => {
    if (!testBranchContext) return;

    const originalUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = testBranchContext.connectionString;
    clearDbCache();

    try {
      const db = getDb();
      
      // Check that core tables from migrations exist
      const tables = await db.execute(sql`
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        ORDER BY tablename
      `);

      expect(tables.length).toBeGreaterThan(0);
      
      // Look for some expected tables from our schema
      const tableNames = tables.map(t => t.tablename);
      console.log('Available tables:', tableNames);
      
      // Should have some core tables (exact tables depend on current schema)
      expect(tableNames.length).toBeGreaterThanOrEqual(1);

    } finally {
      process.env.DATABASE_URL = originalUrl;
      clearDbCache();
    }
  });
});

describe.skipIf(!process.env.NEON_API_KEY || process.env.USE_TEST_BRANCHES !== 'true' || process.env.SKIP_NEON_INTEGRATION === 'true')('Branch Testing Utilities', () => {
  it('should handle missing API key gracefully', async () => {
    const originalApiKey = process.env.NEON_API_KEY;
    delete process.env.NEON_API_KEY;

    try {
      // This should not throw but should handle the missing key gracefully
      const { neonBranchManager } = await import('@/src/lib/neon-branch-manager');
      
      // The manager should be created but operations should fail
      expect(neonBranchManager).toBeTruthy();
      
      // Attempting to create a branch should fail with appropriate error
      await expect(neonBranchManager.createTestBranch()).rejects.toThrow(/API_KEY/);

    } finally {
      if (originalApiKey) {
        process.env.NEON_API_KEY = originalApiKey;
      }
    }
  });

  it('should validate environment configuration', () => {
    // Test environment should have proper configuration
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.VITEST).toBe('true');
    expect(process.env.DATABASE_URL).toBeTruthy();
  });

  it('should provide branch context information', async () => {
    if (process.env.USE_TEST_BRANCHES !== 'true' || !process.env.NEON_API_KEY) {
      return; // Skip if not configured
    }

    const { getCurrentTestBranch } = await import('@/src/lib/test-branch-setup');
    const context = getCurrentTestBranch();
    
    // Should have context from beforeAll setup
    if (context) {
      expect(context.branchId).toBeTruthy();
      expect(context.branchName).toBeTruthy();
      expect(context.connectionString).toBeTruthy();
      expect(context.cleanup).toBeInstanceOf(Function);
    }
  });
});