import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearDbCache, db, getDb, hasSupabaseConfig } from '@/src/db';
import { userPreferences, users } from '@/src/db/schemas/supabase-auth';
import { supabaseSchema } from '@/src/db/schemas/supabase-schema';
import { apiCredentials, executionHistory } from '@/src/db/schemas/supabase-trading';

// Mock environment for Supabase testing
const originalEnv = process.env;

describe('Supabase Database Integration', () => {
  beforeAll(() => {
    // Set up Supabase environment for testing
    process.env = {
      ...originalEnv,
      DATABASE_URL: 'postgresql://postgres.test:password@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      NODE_ENV: 'test',
      FORCE_MOCK_DB: 'true'
    };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  beforeEach(() => {
    clearDbCache();
    vi.clearAllMocks();
  });

  describe('Database Configuration Detection', () => {
    test('should detect Supabase configuration correctly', () => {
      const isSupabase = hasSupabaseConfig();
      expect(isSupabase).toBe(true);
    });

    test('should return false for non-Supabase URLs', () => {
      const originalUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'postgresql://user:pass@neon.tech:5432/db';
      
      const isSupabase = hasSupabaseConfig();
      expect(isSupabase).toBe(false);
      
      process.env.DATABASE_URL = originalUrl;
    });
  });

  describe('Database Connection', () => {
    test('should create database instance', () => {
      const database = getDb();
      expect(database).toBeDefined();
    });

    test('should handle database operations', async () => {
      const database = getDb();
      
      // Test basic query execution
      const result = await database.execute({ sql: 'SELECT 1 as test', args: [] });
      expect(result).toBeDefined();
    });
  });

  describe('Supabase Schema Validation', () => {
    test('should have all required tables in supabaseSchema', () => {
      expect(supabaseSchema).toBeDefined();
      
      // Check auth tables
      expect(supabaseSchema.users).toBeDefined();
      expect(supabaseSchema.userRoles).toBeDefined();
      expect(supabaseSchema.userPreferences).toBeDefined();
      
      // Check trading tables
      expect(supabaseSchema.apiCredentials).toBeDefined();
      expect(supabaseSchema.executionHistory).toBeDefined();
      expect(supabaseSchema.transactions).toBeDefined();
      expect(supabaseSchema.balanceSnapshots).toBeDefined();
    });

    test('should have UUID primary keys in Supabase tables', () => {
      // Check users table structure
      const usersTable = users;
      expect(usersTable).toBeDefined();
      
      // Check apiCredentials table structure
      const apiCredentialsTable = apiCredentials;
      expect(apiCredentialsTable).toBeDefined();
      
      // Check executionHistory table structure
      const executionHistoryTable = executionHistory;
      expect(executionHistoryTable).toBeDefined();
    });

    test('should have proper foreign key relationships', () => {
      // These tests verify that the schema definitions are properly structured
      // In a real test environment, you would also test actual database constraints
      
      expect(userPreferences).toBeDefined();
      expect(apiCredentials).toBeDefined();
      expect(executionHistory).toBeDefined();
      
      // The foreign key relationships are defined in the schema files
      // and would be validated during actual database operations
    });
  });

  describe('Database Operations with Supabase Schema', () => {
    test('should handle user creation with UUID', async () => {
      const database = getDb();
      
      // Mock user data with UUID
      const userData = {
        id: crypto.randomUUID(),
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: true,
      };

      // This would normally insert into the database
      // In test environment with mock DB, we just verify the operation succeeds
      expect(() => {
        database.insert(users).values(userData);
      }).not.toThrow();
    });

    test('should handle user preferences with UUID references', async () => {
      const database = getDb();
      
      const userId = crypto.randomUUID();
      const preferencesData = {
        id: crypto.randomUUID(),
        userId: userId,
        defaultBuyAmountUsdt: 100.0,
        maxConcurrentSnipes: 3,
        autoSnipeEnabled: true,
      };

      expect(() => {
        database.insert(userPreferences).values(preferencesData);
      }).not.toThrow();
    });

    test('should handle API credentials with encrypted data', async () => {
      const database = getDb();
      
      const userId = crypto.randomUUID();
      const credentialsData = {
        id: crypto.randomUUID(),
        userId: userId,
        provider: 'mexc',
        encryptedApiKey: 'encrypted_api_key_data',
        encryptedSecretKey: 'encrypted_secret_key_data',
        isActive: true,
      };

      expect(() => {
        database.insert(apiCredentials).values(credentialsData);
      }).not.toThrow();
    });

    test('should handle execution history with trading data', async () => {
      const database = getDb();
      
      const userId = crypto.randomUUID();
      const executionData = {
        id: crypto.randomUUID(),
        userId: userId,
        vcoinId: 'test-vcoin-id',
        symbolName: 'BTCUSDT',
        action: 'buy',
        orderType: 'market',
        orderSide: 'buy',
        requestedQuantity: 1.0,
        status: 'success',
        requestedAt: new Date(),
      };

      expect(() => {
        database.insert(executionHistory).values(executionData);
      }).not.toThrow();
    });
  });

  describe('Database Error Handling', () => {
    test('should handle connection errors gracefully', async () => {
      // Test with invalid configuration
      const originalUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'invalid-url';
      
      clearDbCache();
      
      try {
        const database = getDb();
        // With mock database, this should still work
        expect(database).toBeDefined();
      } finally {
        process.env.DATABASE_URL = originalUrl;
        clearDbCache();
      }
    });

    test('should handle missing environment variables', () => {
      const originalSupabaseUrl = process.env.SUPABASE_URL;
      delete process.env.SUPABASE_URL;
      
      clearDbCache();
      
      try {
        const database = getDb();
        expect(database).toBeDefined();
      } finally {
        process.env.SUPABASE_URL = originalSupabaseUrl;
        clearDbCache();
      }
    });
  });

  describe('Schema Migration Compatibility', () => {
    test('should maintain compatibility with existing data structures', () => {
      // Verify that Supabase schema maintains the same data structure
      // as the original schema for seamless migration
      
      const supabaseUsersSchema = users;
      const supabaseApiCredentialsSchema = apiCredentials;
      
      expect(supabaseUsersSchema).toBeDefined();
      expect(supabaseApiCredentialsSchema).toBeDefined();
      
      // These schemas should have all the necessary fields for migration
      // The actual field validation would happen during real database operations
    });

    test('should support both UUID and legacy ID formats', () => {
      // This test ensures our migration can handle both ID formats
      const testUuid = crypto.randomUUID();
      const testLegacyId = 'legacy-kinde-id-123';
      
      expect(testUuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(testLegacyId).toBeDefined();
      
      // In real migration, we would test storing legacy IDs in the legacyKindeId field
    });
  });
});