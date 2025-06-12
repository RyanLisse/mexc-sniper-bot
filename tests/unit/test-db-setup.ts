/**
 * Test Database Setup Utility
 * 
 * This utility provides a clean database setup for tests that handles
 * migration issues and ensures proper foreign key constraints.
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import * as schema from '@/src/db/schema';

export interface TestDbSetup {
  testDb: InstanceType<typeof Database>;
  db: ReturnType<typeof drizzle>;
  cleanup: () => void;
}

/**
 * Create a clean test database with all migrations applied
 */
export async function createTestDatabase(): Promise<TestDbSetup> {
  // Create in-memory database
  const testDb = new Database(':memory:');
  
  // Enable foreign keys for proper constraint checking
  testDb.pragma('foreign_keys = ON');
  testDb.pragma('journal_mode = MEMORY'); // Faster for tests
  
  const db = drizzle(testDb, { schema });
  
  // Apply migrations with error handling
  try {
    await migrate(db, { migrationsFolder: './src/db/migrations' });
  } catch (error) {
    console.error('Migration failed:', error);
    // Close database and re-throw
    testDb.close();
    throw error;
  }
  
  return {
    testDb,
    db,
    cleanup: () => {
      try {
        testDb.close();
      } catch (error) {
        console.warn('Error closing test database:', error);
      }
    }
  };
}

/**
 * Create a test user for foreign key requirements
 */
export async function createTestUser(
  db: ReturnType<typeof drizzle>, 
  userId: string = 'test-user'
) {
  return await db.insert(schema.user).values({
    id: userId,
    name: 'Test User',
    email: `${userId}@example.com`,
    emailVerified: false,
  }).returning();
}

/**
 * Clean up test data by user ID
 */
export async function cleanupTestData(
  db: ReturnType<typeof drizzle>,
  userId: string,
  tableNames: Array<keyof typeof schema> = []
) {
  // Default tables to clean (in dependency order)
  const defaultTables: Array<keyof typeof schema> = [
    'transactions',
    'executionHistory', 
    'snipeTargets',
    'userPreferences',
    'apiCredentials',
  ];
  
  const tablesToClean = tableNames.length > 0 ? tableNames : defaultTables;
  
  for (const tableName of tablesToClean) {
    const table = schema[tableName];
    if (table) {
      try {
        // Type-safe deletion based on known tables
        switch (tableName) {
          case 'transactions':
            await db.delete(schema.transactions).where(eq(schema.transactions.userId, userId));
            break;
          case 'executionHistory':
            await db.delete(schema.executionHistory).where(eq(schema.executionHistory.userId, userId));
            break;
          case 'snipeTargets':
            await db.delete(schema.snipeTargets).where(eq(schema.snipeTargets.userId, userId));
            break;
          case 'userPreferences':
            await db.delete(schema.userPreferences).where(eq(schema.userPreferences.userId, userId));
            break;
          case 'apiCredentials':
            await db.delete(schema.apiCredentials).where(eq(schema.apiCredentials.userId, userId));
            break;
        }
      } catch (error) {
        console.warn(`Failed to clean ${tableName}:`, error);
      }
    }
  }
  
  // Clean user last (after dependencies)
  try {
    await db.delete(schema.user).where(eq(schema.user.id, userId));
  } catch (error) {
    console.warn('Failed to clean user:', error);
  }
}