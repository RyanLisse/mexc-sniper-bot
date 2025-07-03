import { config } from 'dotenv';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';

// Load Supabase test environment
config({ path: '.env.test.supabase', override: true });

// Global test setup for Supabase integration
beforeAll(async () => {
  console.log('🧪 Setting up Supabase test environment...');
  
  // Validate required environment variables
  const requiredEnvVars = [
    'DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn(`⚠️ Missing environment variables: ${missingVars.join(', ')}`);
    console.warn('Some tests may use mock implementations');
  } else {
    console.log('✅ All required Supabase environment variables loaded');
  }
  
  // Set up global test configuration
  if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'test') {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', configurable: true });
  }
  process.env.SUPABASE_TEST_MODE = 'true';
  
  // Configure mock behavior
  if (process.env.FORCE_MOCK_DB === 'true') {
    console.log('🔧 Running with mocked database');
  } else {
    console.log('🔗 Running with real Supabase connection');
  }
});

// Clean up after all tests
afterAll(async () => {
  console.log('🧹 Cleaning up Supabase test environment...');
  
  // Clean up any test data if needed
  if (process.env.CLEANUP_AFTER_TESTS === 'true') {
    console.log('🗑️ Cleaning up test data...');
    // Add cleanup logic here if needed
  }
  
  console.log('✅ Supabase test cleanup completed');
});

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  
  // Reset any global state
  if (typeof global !== 'undefined') {
    // Clear any cached database instances
    if ((global as any).__test_db_cache__) {
      delete (global as any).__test_db_cache__;
    }
  }
});

// Clean up after each test
afterEach(() => {
  vi.restoreAllMocks();
});

// Global mock configurations for Supabase testing
vi.mock('@supabase/ssr', () => {
  const mockClient = {
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } }
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  };

  return {
    createServerClient: vi.fn(() => mockClient),
    createBrowserClient: vi.fn(() => mockClient),
  };
});

// Mock Next.js cookies
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn((name: string) => {
      // Return mock cookie values for testing
      const mockCookies: Record<string, string> = {
        'sb-access-token': 'mock-access-token',
        'sb-refresh-token': 'mock-refresh-token',
      };
      return mockCookies[name] ? { value: mockCookies[name] } : undefined;
    }),
    set: vi.fn(),
    delete: vi.fn(),
  })),
  headers: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

// Helper functions for testing
export const createMockSupabaseUser = (overrides: Partial<any> = {}) => ({
  id: crypto.randomUUID(),
  email: 'test@example.com',
  user_metadata: {
    full_name: 'Test User',
    username: 'testuser',
    picture: 'https://example.com/avatar.jpg',
  },
  email_confirmed_at: '2024-01-01T00:00:00Z',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

export const createMockSupabaseSession = (user: any = null) => ({
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: user || createMockSupabaseUser(),
});

export const createMockRequest = (url: string, options: RequestInit = {}) => {
  return new Request(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });
};

// Test utilities for database operations
export const expectUUID = (value: string) => {
  expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
};

export const expectSupabaseTimestamp = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value;
  expect(date).toBeInstanceOf(Date);
  expect(date.getTime()).toBeGreaterThan(0);
};

// Authentication test helpers
export const mockAuthenticatedUser = () => {
  const mockUser = createMockSupabaseUser();
  const mockSession = createMockSupabaseSession(mockUser);
  
  return { mockUser, mockSession };
};

export const mockUnauthenticatedUser = () => {
  return {
    mockUser: null,
    mockSession: null,
  };
};

// Database test helpers
export const createTestUserId = () => crypto.randomUUID();

export const createTestUserData = (overrides: Partial<any> = {}) => ({
  id: createTestUserId(),
  email: 'test@example.com',
  name: 'Test User',
  username: 'testuser',
  emailVerified: true,
  image: 'https://example.com/avatar.jpg',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Error simulation helpers
export const simulateSupabaseError = (message: string, code?: string) => ({
  message,
  code: code || 'SUPABASE_ERROR',
  details: null,
  hint: null,
});

export const simulateNetworkError = () => {
  throw new Error('Network request failed');
};

// Console helpers for test output
export const logTestInfo = (message: string) => {
  if (process.env.VERBOSE_TESTS === 'true') {
    console.log(`ℹ️ ${message}`);
  }
};

export const logTestWarning = (message: string) => {
  console.warn(`⚠️ ${message}`);
};

export const logTestSuccess = (message: string) => {
  if (process.env.VERBOSE_TESTS === 'true') {
    console.log(`✅ ${message}`);
  }
};

console.log('🔧 Supabase test setup loaded successfully');