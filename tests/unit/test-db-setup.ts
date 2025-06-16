/**
 * Test Database Setup Utility
 * 
 * This utility provides a clean database setup for tests that handles
 * migration issues and ensures proper foreign key constraints.
 * 
 * Uses NeonDB PostgreSQL for consistent testing environment.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { eq, sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '@/src/db/schema';

export interface TestDbSetup {
  client: postgres.Sql;
  db: ReturnType<typeof drizzle>;
  cleanup: () => Promise<void>;
}

/**
 * Create a clean test database with all migrations applied
 * Uses NeonDB PostgreSQL for testing
 */
export async function createTestDatabase(): Promise<TestDbSetup> {
  // Use NeonDB PostgreSQL for testing
  const databaseUrl = process.env.DATABASE_URL?.startsWith('postgresql://') 
    ? process.env.DATABASE_URL 
    : 'postgresql://neondb_owner:npg_oTv5qIQYX6lb@ep-silent-firefly-a1l3mkrm-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
  
  // Create PostgreSQL client with test-optimized settings
  const client = postgres(databaseUrl, {
    max: 2, // Limit connections for tests
    idle_timeout: 10,
    connect_timeout: 15,
    ssl: 'require'
  });
  
  const db = drizzle(client, { schema });
  
  // Test database connection
  try {
    await db.execute(sql`SELECT 1 as ping`);
    console.log(`[Test] Connected to NeonDB test database`);
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    await client.end();
    throw error;
  }
  
  // Apply migrations with safe error handling
  try {
    // Try to apply migrations normally
    await migrate(db, { migrationsFolder: './src/db/migrations' });
    console.log(`[Test] Applied migrations to NeonDB test database`);
  } catch (error) {
    console.warn('Test migration had issues, checking if tables exist:', error);
    
    // Check if tables already exist (migrations may have been applied already)
    try {
      const tablesResult = await db.execute(sql`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);
      const tables = tablesResult.map((row: any) => row.table_name);
      
      if (tables.length > 0) {
        console.log(`[Test] Found ${tables.length} existing tables, skipping migration`);
      } else {
        console.error('[Test] No tables found and migration failed');
        await client.end();
        throw error;
      }
    } catch (checkError) {
      console.error('Failed to check existing tables:', checkError);
      await client.end();
      throw checkError;
    }
  }
  
  return {
    client,
    db,
    cleanup: async () => {
      try {
        await client.end();
        console.log(`[Test] Cleaned up NeonDB test database connection`);
      } catch (error) {
        console.warn('Error closing test database:', error);
      }
    }
  };
}

/**
 * Create a test user for foreign key requirements
 * Handles existing users to prevent duplicate key violations
 */
export async function createTestUser(
  db: ReturnType<typeof drizzle>, 
  userId: string = 'test-user'
) {
  try {
    // Check if user already exists
    const existingUser = await db.query.user?.findFirst({
      where: eq(schema.user.id, userId)
    });
    
    if (existingUser) {
      console.log(`[Test] User ${userId} already exists, returning existing user`);
      return [existingUser];
    }
    
    // Create new user if doesn't exist
    return await db.insert(schema.user).values({
      id: userId,
      name: 'Test User',
      email: `${userId}@example.com`,
      emailVerified: false,
    }).returning();
  } catch (error: any) {
    // If duplicate key error, try to fetch existing user
    if (error?.message?.includes('duplicate key') || error?.message?.includes('unique constraint')) {
      console.log(`[Test] User ${userId} exists (duplicate key), fetching existing user`);
      const existingUser = await db.query.user?.findFirst({
        where: eq(schema.user.id, userId)
      });
      return existingUser ? [existingUser] : [];
    }
    throw error;
  }
}

/**
 * Clean up test data by user ID with safe table checking
 */
export async function cleanupTestData(
  db: ReturnType<typeof drizzle>,
  userId: string,
  tableNames: Array<keyof typeof schema> = [],
  preserveUser: boolean = false
) {
  // Default tables to clean (in dependency order)
  const defaultTables: Array<keyof typeof schema> = [
    'transactions',
    'executionHistory', 
    'snipeTargets',
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
          case 'strategyPhaseExecutions':
            // Handle strategies schema table
            if ('strategyPhaseExecutions' in schema) {
              await db.delete((schema as any).strategyPhaseExecutions).where(eq((schema as any).strategyPhaseExecutions.userId, userId));
            }
            break;
          case 'tradingStrategies':
            // Handle strategies schema table
            if ('tradingStrategies' in schema) {
              await db.delete((schema as any).tradingStrategies).where(eq((schema as any).tradingStrategies.userId, userId));
            }
            break;
          // Skip tables that may not exist in all environments
          case 'userPreferences':
          case 'apiCredentials':
            // These tables might not exist in test environment - skip them
            console.log(`[Test] Skipping cleanup of ${tableName} (table may not exist in test environment)`);
            break;
        }
      } catch (error: any) {
        // Only warn for actual errors, not "table doesn't exist" errors
        if (!error?.message?.includes('does not exist')) {
          console.warn(`Failed to clean ${tableName}:`, error);
        }
      }
    }
  }
  
  // Clean user last (after dependencies) - only if not preserving
  if (!preserveUser) {
    try {
      await db.delete(schema.user).where(eq(schema.user.id, userId));
    } catch (error) {
      console.warn('Failed to clean user:', error);
    }
  }
}

/**
 * Create a clean test schema (for PostgreSQL)
 * This ensures we have a fresh test environment
 */
export async function createTestSchema(db: ReturnType<typeof drizzle>) {
  try {
    // Clean existing test data (be careful in production!)
    if (process.env.NODE_ENV === 'test') {
      // Only clean test data if we're in test environment
      const testUserIds = await db.execute(sql`
        SELECT id FROM "user" WHERE email LIKE '%@example.com' OR email LIKE '%test%'
      `);
      
      for (const user of testUserIds) {
        await cleanupTestData(db, (user as any).id, [], false);
      }
    }
    
    console.log('[Test] Test schema prepared');
  } catch (error) {
    console.warn('Error preparing test schema:', error);
  }
}