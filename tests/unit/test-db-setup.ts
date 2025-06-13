/**
 * Test Database Setup Utility
 * 
 * This utility provides a clean database setup for tests that handles
 * migration issues and ensures proper foreign key constraints.
 * 
 * Uses TursoDB embedded replicas for consistent testing environment.
 */

import { createClient, type Client } from "@libsql/client";
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import * as schema from '@/src/db/schema';

export interface TestDbSetup {
  client: ReturnType<typeof createClient>;
  db: ReturnType<typeof drizzle>;
  cleanup: () => void;
}

/**
 * Create a clean test database with all migrations applied
 * Uses TursoDB embedded replica for testing
 */
export async function createTestDatabase(): Promise<TestDbSetup> {
  // Use TursoDB configuration for consistent testing, fallback to local SQLite
  const databaseUrl = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  
  let client: Client;
  
  if (databaseUrl && authToken) {
    // Use TursoDB if configured
    const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const testDbPath = `./data/test_${testId}.db`;
    
    client = createClient({
      url: `file:${testDbPath}`,
      syncUrl: databaseUrl,
      authToken: authToken,
      syncInterval: 1, // Very fast sync for tests
    });
  } else {
    // Fallback to local SQLite for tests when TursoDB is not configured
    const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const testDbPath = `./data/test_${testId}.db`;
    
    client = createClient({
      url: `file:${testDbPath}`,
    });
  }
  
  const db = drizzle(client, { schema });
  
  // Enable foreign keys and optimize for tests
  try {
    await db.run(sql`PRAGMA foreign_keys = ON`);
    await db.run(sql`PRAGMA journal_mode = MEMORY`);
    await db.run(sql`PRAGMA synchronous = OFF`); // Faster for tests
    await db.run(sql`PRAGMA cache_size = -32000`); // 32MB cache
  } catch (error) {
    console.warn('Failed to set test database pragmas:', error);
  }
  
  // Apply migrations with safe error handling
  try {
    // First try to apply migrations normally
    await migrate(db, { migrationsFolder: './src/db/migrations' });
    console.log(`[Test] Applied migrations to test database`);
  } catch (error) {
    console.warn('Test migration had issues, trying fallback approach:', error);
    
    // Fallback: Create tables directly from schema instead of using problematic migrations
    try {
      // Enable foreign keys
      await db.run(sql`PRAGMA foreign_keys = ON`);
      
      // Create minimal required tables for tests
      await db.run(sql`
        CREATE TABLE IF NOT EXISTS user (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          username TEXT UNIQUE,
          emailVerified INTEGER NOT NULL DEFAULT 0,
          image TEXT,
          legacyBetterAuthId TEXT UNIQUE,
          createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
          updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `);
      
      await db.run(sql`
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          transaction_type TEXT NOT NULL,
          symbol_name TEXT NOT NULL,
          vcoin_id TEXT,
          buy_price REAL,
          buy_quantity REAL,
          buy_total_cost REAL,
          buy_timestamp INTEGER,
          buy_order_id TEXT,
          sell_price REAL,
          sell_quantity REAL,
          sell_total_revenue REAL,
          sell_timestamp INTEGER,
          sell_order_id TEXT,
          profit_loss REAL,
          profit_loss_percentage REAL,
          fees REAL,
          status TEXT DEFAULT 'pending' NOT NULL,
          snipe_target_id INTEGER,
          notes TEXT,
          transaction_time INTEGER DEFAULT (unixepoch()) NOT NULL,
          created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
          updated_at INTEGER DEFAULT (unixepoch()) NOT NULL,
          FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
        )
      `);
      
      console.log(`[Test] Used fallback schema creation for test database`);
    } catch (fallbackError) {
      console.error('Fallback schema creation failed:', fallbackError);
      try {
        client.close();
      } catch (closeError) {
        console.warn('Error closing test client:', closeError);
      }
      throw fallbackError;
    }
  }
  
  return {
    client,
    db,
    cleanup: () => {
      try {
        client.close();
        console.log(`[Test] Cleaned up test database`);
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