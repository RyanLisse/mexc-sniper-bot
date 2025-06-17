/**
 * Authentication Test Utilities
 * 
 * Provides helper functions and fixtures for testing authentication flows
 * across unit, integration, and E2E tests.
 */

import { beforeEach, afterEach, vi } from 'vitest';

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
      KINDE_CLIENT_ID: 'test-client-id',
      KINDE_CLIENT_SECRET: 'test-client-secret',
      KINDE_ISSUER_URL: 'https://test.kinde.com',
      KINDE_SITE_URL: 'http://localhost:3008',
      KINDE_POST_LOGOUT_REDIRECT_URL: 'http://localhost:3008',
      KINDE_POST_LOGIN_REDIRECT_URL: 'http://localhost:3008/dashboard',
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
 * Mock Kinde SDK for testing
 */
export const mockKindeSDK = {
  /**
   * Create a successful Kinde session mock
   */
  createSuccessfulMock: () => ({
    getUser: vi.fn().mockResolvedValue(currentTestUser),
    isAuthenticated: vi.fn().mockResolvedValue(isCurrentlyAuthenticated),
    getPermissions: vi.fn().mockResolvedValue(
      currentTestUser ? mockPermissions[currentTestUser.id] || { permissions: [] } : { permissions: [] }
    ),
    getPermission: vi.fn().mockImplementation(async (permission: string) => {
      if (!currentTestUser) return { isGranted: false };
      const userPermissions = mockPermissions[currentTestUser.id]?.permissions || [];
      return { isGranted: userPermissions.includes(permission) };
    }),
    getOrganization: vi.fn().mockResolvedValue(
      currentTestUser ? { orgCode: mockPermissions[currentTestUser.id]?.orgCode } : null
    ),
    getUserOrganizations: vi.fn().mockResolvedValue(
      currentTestUser ? { orgCodes: [mockPermissions[currentTestUser.id]?.orgCode || 'default-org'] } : { orgCodes: [] }
    ),
    getClaim: vi.fn().mockImplementation(async (claim: string) => {
      if (!currentTestUser) return { name: claim, value: null };
      const claims: Record<string, any> = {
        email: currentTestUser.email,
        given_name: currentTestUser.given_name,
        family_name: currentTestUser.family_name,
        picture: currentTestUser.picture,
      };
      return { name: claim, value: claims[claim] || null };
    }),
    getAccessToken: vi.fn().mockResolvedValue(isCurrentlyAuthenticated ? 'mock-access-token' : null),
    refreshTokens: vi.fn().mockImplementation(async () => {
      if (!isCurrentlyAuthenticated) {
        throw new Error('Not authenticated');
      }
      return { access_token: 'new-mock-access-token' };
    })
  }),

  /**
   * Create a failed Kinde session mock
   */
  createFailedMock: (errorMessage = 'Kinde SDK error') => ({
    getUser: vi.fn().mockRejectedValue(new Error(errorMessage)),
    isAuthenticated: vi.fn().mockRejectedValue(new Error(errorMessage)),
    getPermissions: vi.fn().mockRejectedValue(new Error(errorMessage)),
    getPermission: vi.fn().mockRejectedValue(new Error(errorMessage)),
    getOrganization: vi.fn().mockRejectedValue(new Error(errorMessage)),
    getUserOrganizations: vi.fn().mockRejectedValue(new Error(errorMessage)),
    getClaim: vi.fn().mockRejectedValue(new Error(errorMessage)),
    getAccessToken: vi.fn().mockRejectedValue(new Error(errorMessage)),
    refreshTokens: vi.fn().mockRejectedValue(new Error(errorMessage))
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
  
  // Add authentication headers (mock)
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer mock-token-${userType}`,
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