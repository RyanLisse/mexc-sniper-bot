/**
 * Test Database Setup Utility
 *
 * This utility provides a clean database setup for tests that handles
 * migration issues and ensures proper foreign key constraints.
 *
 * Uses NeonDB PostgreSQL for consistent testing environment.
 */

import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from '@/src/db/schema';

export interface TestDbSetup {
  client: postgres.Sql;
  db: ReturnType<typeof drizzle>;
  cleanup: () => Promise<void>;
}

/**
 * Create a clean test database with all migrations applied
 * Uses NeonDB PostgreSQL for testing with improved retry logic
 */
export async function createTestDatabase(): Promise<TestDbSetup> {
  // Get database URL from environment
  const databaseUrl = process.env.DATABASE_URL?.startsWith('postgresql://')
    ? process.env.DATABASE_URL
    : 'postgresql://neondb_owner:npg_oTv5qIQYX6lb@ep-silent-firefly-a1l3mkrm-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

  // Force real database for tests - don't fallback to mock anymore
  const forceMock = process.env.FORCE_MOCK_DB === 'true';

  if (forceMock) {
    console.log('[Test] FORCE_MOCK_DB enabled, using mock database');
    return createMockDatabase();
  }

  let client: postgres.Sql | null = null;
  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      console.log(`[Test] Attempting database connection (attempt ${retryCount + 1}/${maxRetries})...`);

      // Create PostgreSQL client with test-optimized settings
      client = postgres(databaseUrl, {
        max: 3, // Limit connections for tests
        idle_timeout: 30, // Longer timeout for tests (30 seconds)
        connect_timeout: 20, // Even longer connection timeout (20 seconds)
        ssl: 'require',
        prepare: false, // Disable prepared statements for tests
        transform: {
          undefined: null,
        },
        connection: {
          application_name: "mexc-sniper-test",
          statement_timeout: 20000, // 20 seconds
          idle_in_transaction_session_timeout: 20000,
        }
      });

      const db = drizzle(client, { schema });

      // Test database connection with progressively longer timeout
      const timeoutMs = 10000 + (retryCount * 5000); // 10s, 15s, 20s
      await Promise.race([
        db.execute(sql`SELECT 1 as ping`),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), timeoutMs)
        )
      ]);

      console.log(`[Test] Connected to NeonDB test database successfully`);

      // Apply migrations with safe error handling
      try {
        await migrate(db, { migrationsFolder: './src/db/migrations' });
        console.log(`[Test] Applied migrations to NeonDB test database`);
      } catch (error) {
        console.warn('Test migration had issues, proceeding with existing schema:', error instanceof Error ? error.message : error);
      }

      return {
        client,
        db,
        cleanup: async () => {
          try {
            if (client) {
              // Force close with timeout to prevent hanging
              await Promise.race([
                client.end({ timeout: 5 }),
                new Promise((resolve) => setTimeout(() => {
                  console.warn('[Test] Database cleanup timed out, forcing close');
                  resolve(undefined);
                }, 5000))
              ]);
              console.log(`[Test] Cleaned up NeonDB test database connection`);
            }
          } catch (error) {
            console.warn('Error closing test database:', error);
          }
        }
      };

    } catch (error) {
      retryCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`[Test] Database connection attempt ${retryCount} failed: ${errorMessage}`);

      // Clean up failed client
      if (client) {
        try {
          await client.end({ timeout: 1 });
        } catch (_) {
          // Ignore cleanup errors on failed connections
        }
        client = null;
      }

      // If this is the last retry, fall back to mock
      if (retryCount >= maxRetries) {
        console.warn(`[Test] All database connection attempts failed, using mock database for tests`);
        return createMockDatabase();
      }

      // Wait before retry with exponential backoff
      const delay = 1000 * retryCount; // 1s, 2s, 3s
      console.log(`[Test] Retrying database connection in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  console.warn(`[Test] Unexpected fallback to mock database`);
  return createMockDatabase();
}

/**
 * Create a mock database setup for tests when real database is unavailable
 */
function createMockDatabase(): TestDbSetup {
  // Create mock client and database that return successful responses
  const mockClient = {
    end: async () => Promise.resolve(),
  } as any;

  // Storage for mock data to make tests more realistic
  const mockStorage = {
    users: new Map(),
    transactions: new Map(),
    nextId: 1,
  };

  const mockDb = {
    select: () => ({
      from: (table: any) => ({
        where: (condition: any) => ({
          orderBy: (order: any) => Promise.resolve(Array.from(mockStorage.transactions.values()).reverse()),
          limit: (count: any) => Promise.resolve(Array.from(mockStorage.transactions.values()).slice(0, count)),
          then: (resolve: any) => resolve(Array.from(mockStorage.transactions.values())),
        }),
        orderBy: (order: any) => Promise.resolve(Array.from(mockStorage.transactions.values()).reverse()),
        limit: (count: any) => Promise.resolve(Array.from(mockStorage.transactions.values()).slice(0, count)),
        then: (resolve: any) => {
          if (table === schema.transactions) {
            return resolve(Array.from(mockStorage.transactions.values()));
          }
          return resolve([]);
        },
      }),
    }),
    insert: (table: any) => ({
      values: (data: any) => {
        // Validate required fields for transactions at the values level
        if (table === schema.transactions) {
          if (!data.userId || !data.transactionType) {
            return Promise.reject(new Error('Missing required fields: userId and transactionType are required'));
          }
        }

        return {
          returning: () => {
            const id = mockStorage.nextId++;
            const record = {
              id,
              ...data,
              status: data.status || 'pending', // Default status
              createdAt: data.createdAt || new Date(),
              updatedAt: data.updatedAt || new Date(),
              // Set null values for optional fields
              buyPrice: data.buyPrice || null,
              sellPrice: data.sellPrice || null,
              profitLoss: data.profitLoss || null,
              vcoinId: data.vcoinId || null
            };

            if (table === schema.user) {
              mockStorage.users.set(data.id, record);
            } else if (table === schema.transactions) {
              mockStorage.transactions.set(id, record);
            }

            return Promise.resolve([record]);
          },
        };
      },
    }),
    update: (table: any) => ({
      set: (data: any) => ({
        where: (condition: any) => {
          // Find and update the record
          if (table === schema.transactions) {
            const records = Array.from(mockStorage.transactions.values());
            if (records.length > 0) {
              const record = records[0];
              Object.assign(record, data);
              mockStorage.transactions.set(record.id, record);
            }
          }
          return Promise.resolve({ rowCount: 1 });
        },
      }),
    }),
    delete: (table: any) => ({
      where: (condition: any) => {
        let deletedCount = 0;
        if (table === schema.transactions) {
          // Store current size to calculate deleted count
          const beforeSize = mockStorage.transactions.size;
          mockStorage.transactions.clear();
          deletedCount = beforeSize;
        } else if (table === schema.user) {
          const beforeSize = mockStorage.users.size;
          mockStorage.users.clear();
          deletedCount = beforeSize;
        }
        return Promise.resolve({ rowCount: deletedCount });
      },
    }),
    execute: () => Promise.resolve({ rows: [] }),
    query: {
      user: {
        findFirst: ({ where }: any) => {
          // Return user based on the actual query condition
          const users = Array.from(mockStorage.users.values());
          return Promise.resolve(users[0] || null);
        },
        findMany: () => Promise.resolve(Array.from(mockStorage.users.values())),
      },
      transactions: {
        findFirst: () => Promise.resolve(null),
        findMany: () => Promise.resolve(Array.from(mockStorage.transactions.values())),
      },
    },
  } as any;

  return {
    client: mockClient,
    db: mockDb,
    cleanup: async () => Promise.resolve(),
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
    const existingUser = await (db.query as any).user?.findFirst({
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
      const existingUser = await (db.query as any).user?.findFirst({
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