/**
 * Authentication Test Utilities
 *
 * Provides helper functions and fixtures for testing authentication flows
 * across unit, integration, and E2E tests.
 */

import { afterEach, beforeEach, vi } from 'vitest';

// Mock user fixtures for different test scenarios
export const mockUsers = {
  authenticated: {
    id: 'test-user-123',
    email: 'test@mexcsniper.com',
    given_name: 'Test',
    family_name: 'User',
    picture: 'https://example.com/avatar.jpg',
    username: 'testuser',
  },
  admin: {
    id: 'admin-user-456',
    email: 'admin@mexcsniper.com',
    given_name: 'Admin',
    family_name: 'User',
    picture: 'https://example.com/admin-avatar.jpg',
    username: 'adminuser',
  },
  newUser: {
    id: 'new-user-789',
    email: 'newuser@mexcsniper.com',
    given_name: 'New',
    family_name: 'User',
    picture: null,
    username: null,
  },
  unauthorized: null
};

// Mock permissions for different user types
export const mockPermissions = {
  'test-user-123': {
    permissions: ['read:metrics', 'read:dashboard'],
    orgCode: 'mexc-test-org',
  },
  'admin-user-456': {
    permissions: ['read:metrics', 'read:dashboard', 'write:admin', 'manage:users'],
    orgCode: 'mexc-admin-org',
  },
  'new-user-789': {
    permissions: ['read:dashboard'],
    orgCode: 'mexc-basic-org',
  },
};

// Test state management
let currentTestUser: any = null;
let isCurrentlyAuthenticated = false;

/**
 * Test utilities for setting up different authentication scenarios
 */
export const authTestUtils = {
  /**
   * Set up an authenticated user scenario
   */
  setAuthenticated: (userType: keyof typeof mockUsers = 'authenticated') => {
    if (userType === 'unauthorized') {
      currentTestUser = null;
      isCurrentlyAuthenticated = false;
    } else {
      currentTestUser = mockUsers[userType];
      isCurrentlyAuthenticated = true;
    }
  },

  /**
   * Set up an unauthenticated scenario
   */
  setUnauthenticated: () => {
    currentTestUser = null;
    isCurrentlyAuthenticated = false;
  },

  /**
   * Set up an admin user scenario
   */
  setAdmin: () => {
    currentTestUser = mockUsers.admin;
    isCurrentlyAuthenticated = true;
  },

  /**
   * Set up a new user scenario
   */
  setNewUser: () => {
    currentTestUser = mockUsers.newUser;
    isCurrentlyAuthenticated = true;
  },

  /**
   * Get current test user
   */
  getCurrentUser: () => currentTestUser,

  /**
   * Check if currently authenticated in test
   */
  isAuthenticated: () => isCurrentlyAuthenticated,

  /**
   * Reset authentication state
   */
  reset: () => {
    currentTestUser = null;
    isCurrentlyAuthenticated = false;
  }
};

/**
 * Environment variable helpers for testing
 */
export const envTestUtils = {
  /**
   * Store original environment variables
   */
  originalEnv: process.env,

  /**
   * Set up test environment variables
   */
  setupTestEnv: () => {
    process.env = {
      ...envTestUtils.originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://test-project.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      SUPABASE_JWT_SECRET: 'test-jwt-secret',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3008',
      NODE_ENV: 'test',
      SKIP_AUTH_IN_TESTS: 'true'
    };
  },

  /**
   * Set up environment with missing variables
   */
  setupMissingEnv: (missingVars: string[]) => {
    envTestUtils.setupTestEnv();
    missingVars.forEach(varName => {
      delete process.env[varName];
    });
  },

  /**
   * Restore original environment
   */
  restoreEnv: () => {
    process.env = envTestUtils.originalEnv;
  }
};

/**
 * Mock Supabase SDK for testing
 */
export const mockSupabaseSDK = {
  /**
   * Create a successful Supabase session mock
   */
  createSuccessfulMock: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: isCurrentlyAuthenticated ? {
            user: {
              id: currentTestUser?.id,
              email: currentTestUser?.email,
              user_metadata: {
                full_name: `${currentTestUser?.given_name} ${currentTestUser?.family_name}`,
                picture: currentTestUser?.picture
              },
              email_confirmed_at: '2024-01-01T00:00:00Z'
            },
            access_token: 'mock-access-token'
          } : null
        },
        error: null
      }),
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: isCurrentlyAuthenticated ? {
            id: currentTestUser?.id,
            email: currentTestUser?.email,
            user_metadata: {
              full_name: `${currentTestUser?.given_name} ${currentTestUser?.family_name}`,
              picture: currentTestUser?.picture
            },
            email_confirmed_at: '2024-01-01T00:00:00Z'
          } : null
        },
        error: null
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null, data: { url: 'mock-oauth-url' } }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: currentTestUser, session: { access_token: 'mock-token' } },
        error: null
      }),
      signUp: vi.fn().mockResolvedValue({
        data: { user: currentTestUser, session: null },
        error: null
      })
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: currentTestUser, error: null })
    })
  }),

  /**
   * Create a failed Supabase session mock
   */
  createFailedMock: (errorMessage = 'Supabase SDK error') => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: new Error(errorMessage)
      }),
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: new Error(errorMessage)
      }),
      signOut: vi.fn().mockResolvedValue({ error: new Error(errorMessage) }),
      signInWithOAuth: vi.fn().mockResolvedValue({ error: new Error(errorMessage), data: null }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: null,
        error: new Error(errorMessage)
      }),
      signUp: vi.fn().mockResolvedValue({
        data: null,
        error: new Error(errorMessage)
      })
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockRejectedValue(new Error(errorMessage))
    })
  })
};

/**
 * Standard test setup and teardown functions
 */
export const authTestSetup = {
  /**
   * Standard beforeEach setup for auth tests
   */
  beforeEach: () => {
    // Reset authentication state
    authTestUtils.reset();

    // Setup test environment
    envTestUtils.setupTestEnv();

    // Clear all mocks
    vi.clearAllMocks();
  },

  /**
   * Standard afterEach cleanup for auth tests
   */
  afterEach: () => {
    // Reset authentication state
    authTestUtils.reset();

    // Restore environment
    envTestUtils.restoreEnv();

    // Clear all mocks
    vi.clearAllMocks();
  }
};

/**
 * Helper to create authenticated API requests for integration tests
 */
export const createAuthenticatedRequest = async (
  url: string,
  options: RequestInit = {},
  userType: keyof typeof mockUsers = 'authenticated'
) => {
  // Set up authentication state
  authTestUtils.setAuthenticated(userType);

  // Add authentication headers (mock Supabase session)
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer supabase-mock-token-${userType}`,
    'Cookie': `sb-test-auth-token=mock-session-${userType}`,
    ...options.headers
  };

  return fetch(url, {
    ...options,
    headers
  });
};

/**
 * Helper to create unauthenticated API requests for integration tests
 */
export const createUnauthenticatedRequest = async (
  url: string,
  options: RequestInit = {}
) => {
  // Set up unauthenticated state
  authTestUtils.setUnauthenticated();

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
};

/**
 * Wait for authentication state changes in tests
 */
export const waitForAuthState = async (
  expectedState: boolean,
  timeout = 5000
): Promise<boolean> => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (authTestUtils.isAuthenticated() === expectedState) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return false;
};

/**
 * Database helpers for auth testing
 */
export const authDbTestUtils = {
  /**
   * Create test user in database
   */
  createTestUser: async (userData = mockUsers.authenticated) => {
    // This would interact with your database to create a test user
    // Implementation depends on your database setup
    return userData;
  },

  /**
   * Clean up test users from database
   */
  cleanupTestUsers: async () => {
    // This would clean up test users from the database
    // Implementation depends on your database setup
  }
};