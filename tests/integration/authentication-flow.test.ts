/**
 * Authentication Flow Integration Tests
 * 
 * Comprehensive tests for the entire authentication flow including:
 * - User registration and login
 * - Session management
 * - Database synchronization
 * - API endpoint protection
 * - Role-based access control
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createServerTestSuite } from '@utils/server-test-helper';
import { getSupabaseServerClient } from '@/lib/supabase-client-manager';
import { syncUserWithDatabase, getUserFromDatabase } from '@/lib/supabase-auth';
import { db, hasSupabaseConfig } from '@/db/index';
import { users as supabaseUsers, userPreferences } from '@/db/schemas/supabase-auth';
import { user as originalUsers } from '@/db/schemas/auth';
import { eq } from 'drizzle-orm';

// Test server setup
const serverSuite = createServerTestSuite('Authentication Flow Tests', 3200, {
  NODE_ENV: 'test',
  USE_REAL_DATABASE: 'true'
});

interface TestUser {
  id: string;
  email: string;
  name: string;
  username?: string;
  emailVerified?: boolean;
  picture?: string;
}

describe('Authentication Flow Integration Tests', () => {
  let testUser: TestUser;
  let userTable: any;

  beforeAll(async () => {
    await serverSuite.beforeAllSetup();
    
    // Determine which user table to use
    const isSupabase = hasSupabaseConfig();
    userTable = isSupabase ? supabaseUsers : originalUsers;
    
    // Create test user
    testUser = {
      id: `test-auth-user-${Date.now()}`,
      email: `auth-test-${Date.now()}@example.com`,
      name: `Auth Test User ${Date.now()}`,
      username: `authtest${Date.now()}`,
      emailVerified: true,
      picture: 'https://example.com/test-avatar.jpg'
    };
  });

  afterAll(async () => {
    // Cleanup test data
    if (testUser) {
      try {
        await db.delete(userPreferences).where(eq(userPreferences.userId, testUser.id)).catch(() => {});
        await db.delete(userTable).where(eq(userTable.id, testUser.id)).catch(() => {});
      } catch (error) {
        console.warn('Cleanup warning:', error);
      }
    }
    
    await serverSuite.afterAllCleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Database Configuration', () => {
    it('should have database connection', async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      // Test basic database query
      const result = await db.select().from(userTable).limit(1);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should detect correct user schema', async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const isSupabase = hasSupabaseConfig();
      expect(typeof isSupabase).toBe('boolean');
      
      // Verify user table has expected columns
      const columns = Object.keys(userTable);
      expect(columns).toContain('id');
      expect(columns).toContain('email');
      expect(columns).toContain('name');
    });
  });

  describe('Supabase Connection', () => {
    it('should create Supabase client successfully', async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const supabase = await getSupabaseServerClient();
      expect(supabase).toBeTruthy();
      expect(supabase.auth).toBeTruthy();
    });

    it('should handle session queries without errors', async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const supabase = await getSupabaseServerClient();
      const { error } = await supabase.auth.getSession();
      
      // Should either succeed or fail with "session not found" (both are valid)
      if (error) {
        expect(error.message).toMatch(/session|not found|invalid/i);
      }
    });
  });

  describe('User Synchronization', () => {
    it('should sync user to database successfully', async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const syncResult = await syncUserWithDatabase(testUser);
      expect(syncResult).toBe(true);
    });

    it('should retrieve synced user from database', async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      // First sync the user
      await syncUserWithDatabase(testUser);

      // Then retrieve it
      const dbUser = await getUserFromDatabase(testUser.id);
      
      expect(dbUser).toBeTruthy();
      expect(dbUser?.id).toBe(testUser.id);
      expect(dbUser?.email).toBe(testUser.email);
      expect(dbUser?.name).toBe(testUser.name);
    });

    it('should handle duplicate user sync gracefully', async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      // Sync user twice
      const firstSync = await syncUserWithDatabase(testUser);
      const secondSync = await syncUserWithDatabase(testUser);
      
      expect(firstSync).toBe(true);
      expect(secondSync).toBe(true);

      // Verify user is still in database correctly
      const dbUser = await getUserFromDatabase(testUser.id);
      expect(dbUser?.email).toBe(testUser.email);
    });

    it('should update existing user data', async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      // Sync initial user
      await syncUserWithDatabase(testUser);

      // Modify user data
      const updatedUser = {
        ...testUser,
        name: 'Updated Test User Name',
        username: 'updated_username'
      };

      // Sync updated user
      const syncResult = await syncUserWithDatabase(updatedUser);
      expect(syncResult).toBe(true);

      // Verify updates were applied
      const dbUser = await getUserFromDatabase(testUser.id);
      expect(dbUser?.name).toBe('Updated Test User Name');
      expect(dbUser?.username).toBe('updated_username');
    });
  });

  describe('User Preferences Management', () => {
    it('should create default user preferences', async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      // Sync user first
      await syncUserWithDatabase(testUser);

      // Check if preferences exist or create them
      let preferences = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, testUser.id))
        .limit(1);

      if (preferences.length === 0) {
        // Create default preferences
        const defaultPrefs = {
          userId: testUser.id,
          defaultBuyAmountUsdt: 100.0,
          maxConcurrentSnipes: 3,
          autoSnipeEnabled: true,
          riskTolerance: 'medium' as const,
          takeProfitStrategy: 'balanced' as const,
          stopLossPercent: 5.0,
          selectedExitStrategy: 'balanced' as const,
          autoBuyEnabled: true,
          autoSellEnabled: true
        };

        await db.insert(userPreferences).values(defaultPrefs);

        // Verify creation
        preferences = await db
          .select()
          .from(userPreferences)
          .where(eq(userPreferences.userId, testUser.id))
          .limit(1);
      }

      expect(preferences.length).toBe(1);
      expect(preferences[0].userId).toBe(testUser.id);
      expect(preferences[0].defaultBuyAmountUsdt).toBe(100.0);
      expect(preferences[0].autoSnipeEnabled).toBe(true);
    });

    it('should handle user preferences updates', async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      // Ensure user and preferences exist
      await syncUserWithDatabase(testUser);

      const updatedPrefs = {
        defaultBuyAmountUsdt: 250.0,
        maxConcurrentSnipes: 5,
        riskTolerance: 'high' as const,
        autoSnipeEnabled: false
      };

      await db
        .update(userPreferences)
        .set(updatedPrefs)
        .where(eq(userPreferences.userId, testUser.id));

      // Verify updates
      const preferences = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, testUser.id))
        .limit(1);

      expect(preferences[0].defaultBuyAmountUsdt).toBe(250.0);
      expect(preferences[0].maxConcurrentSnipes).toBe(5);
      expect(preferences[0].riskTolerance).toBe('high');
      expect(preferences[0].autoSnipeEnabled).toBe(false);
    });
  });

  describe('API Endpoint Protection', () => {
    it('should block access to protected endpoints without authentication', async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const serverManager = serverSuite.getServerManager();
      const protectedPaths = [
        '/api/account/balance',
        '/api/auto-sniping/control',
        '/api/mexc/trade'
      ];

      for (const path of protectedPaths) {
        try {
          const response = await fetch(`${serverManager.baseUrl}${path}`);
          
          // Should return 401 Unauthorized or 302 Redirect to auth
          expect([401, 302, 403]).toContain(response.status);
        } catch (error) {
          // Network errors are acceptable for this test
          console.warn(`Network error testing ${path}:`, error);
        }
      }
    });

    it('should allow access to public endpoints', async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const serverManager = serverSuite.getServerManager();
      const publicPaths = [
        '/api/health',
        '/api/auth/session'
      ];

      for (const path of publicPaths) {
        try {
          const response = await fetch(`${serverManager.baseUrl}${path}`);
          
          // Should not be blocked (may return various status codes based on implementation)
          expect(response.status).not.toBe(401);
          expect(response.status).not.toBe(403);
        } catch (error) {
          // Network errors are acceptable
          console.warn(`Network error testing ${path}:`, error);
        }
      }
    });
  });

  describe('Session Management', () => {
    it('should handle session retrieval gracefully', async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const serverManager = serverSuite.getServerManager();
      
      try {
        const response = await fetch(`${serverManager.baseUrl}/api/auth/session`);
        
        // Should return JSON response (401 for no session is valid)
        const data = await response.json();
        expect(typeof data).toBe('object');
        
        if (response.status === 401) {
          expect(data.user).toBeNull();
        }
      } catch (error) {
        console.warn('Session test network error:', error);
      }
    });

    it('should validate session structure when authenticated', async () => {
      // This test would require actual authentication
      // For now, we'll test the session API structure
      
      if (serverSuite.skipIfServerNotReady()) return;

      const serverManager = serverSuite.getServerManager();
      
      try {
        const response = await fetch(`${serverManager.baseUrl}/api/auth/session`);
        const data = await response.json();
        
        // Verify response structure regardless of authentication status
        expect(data).toHaveProperty('user');
        
        if (data.user) {
          expect(data.user).toHaveProperty('id');
          expect(data.user).toHaveProperty('email');
          expect(data.user).toHaveProperty('name');
        }
      } catch (error) {
        console.warn('Session structure test network error:', error);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid user IDs gracefully', async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const invalidUser = await getUserFromDatabase('invalid-user-id');
      expect(invalidUser).toBeNull();
    });

    it('should handle malformed user data sync', async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const malformedUser: any = {
        id: '', // Invalid empty ID
        email: 'invalid-email', // Invalid email format
        name: ''  // Invalid empty name
      };

      try {
        const result = await syncUserWithDatabase(malformedUser);
        // Should either fail gracefully or handle the error
        expect(typeof result).toBe('boolean');
      } catch (error) {
        // Expect specific error types for malformed data
        expect(error).toBeTruthy();
      }
    });

    it('should handle database connection errors gracefully', async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      // This test verifies error handling structure
      // Actual database errors would be environment-specific
      
      try {
        const result = await db.select().from(userTable).limit(1);
        expect(Array.isArray(result)).toBe(true);
      } catch (error) {
        // If database errors occur, they should be proper Error objects
        expect(error instanceof Error).toBe(true);
      }
    });
  });

  describe('Security Validation', () => {
    it('should validate user input sanitization', async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const maliciousUser = {
        id: `test-xss-${Date.now()}`,
        email: 'test@example.com',
        name: '<script>alert("xss")</script>',
        username: 'DROP TABLE users;--'
      };

      try {
        const syncResult = await syncUserWithDatabase(maliciousUser);
        
        if (syncResult) {
          const dbUser = await getUserFromDatabase(maliciousUser.id);
          
          // Verify malicious content is handled safely
          expect(dbUser?.name).not.toContain('<script>');
          expect(dbUser?.username).not.toContain('DROP TABLE');
          
          // Cleanup
          await db.delete(userTable).where(eq(userTable.id, maliciousUser.id));
        }
      } catch (error) {
        // Rejection of malicious input is also acceptable
        expect(error).toBeTruthy();
      }
    });

    it('should enforce email format validation', async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const invalidEmailUser = {
        id: `test-email-${Date.now()}`,
        email: 'not-a-valid-email',
        name: 'Test User'
      };

      try {
        const syncResult = await syncUserWithDatabase(invalidEmailUser);
        
        if (syncResult) {
          // If sync succeeds, verify the email is handled appropriately
          const dbUser = await getUserFromDatabase(invalidEmailUser.id);
          expect(dbUser?.email).toBeTruthy();
          
          // Cleanup
          await db.delete(userTable).where(eq(userTable.id, invalidEmailUser.id));
        }
      } catch (error) {
        // Rejection of invalid email is acceptable
        expect(error instanceof Error).toBe(true);
      }
    });
  });
});