/**
 * Unified Test Setup
 * 
 * This file replaces the fragmented mock setup across multiple files and provides
 * a single, comprehensive mock configuration for all tests. It uses the 
 * consolidated-mocks.ts system to ensure consistent mocking across the test suite.
 */

import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { getGlobalMockStore, initializeUnifiedMocks, type MockConfiguration } from './unified-mock-system';

// ============================================================================
// Global Test Configuration
// ============================================================================

// Global mock setup - configure all external dependencies
let mockSetup: { store: any; cleanup: () => void };

// ============================================================================
// Global Test Setup and Teardown
// ============================================================================

beforeAll(async () => {
  console.log('[Test Setup] Initializing unified test environment...');
  
  // Set test environment variables
  if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'test') {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', configurable: true });
  }
  process.env.VITEST = 'true';
  
  // Mock environment variables for testing
  process.env.MEXC_API_KEY = 'test-api-key';
  process.env.MEXC_SECRET_KEY = 'test-secret-key';
  process.env.MEXC_PASSPHRASE = 'test-passphrase';
  process.env.OPENAI_API_KEY = 'test-openai-key';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-supabase-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-supabase-service-role-key';
  process.env.SUPABASE_JWT_SECRET = 'test-supabase-jwt-secret';
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-supabase-key';
  process.env.REDIS_URL = 'redis://localhost:6379';
  
  // Initialize global state
  global.__VITEST__ = true;
  global.__TEST_MODE__ = true;
  
  // Initialize unified mock system with global utilities
  mockSetup = await initializeUnifiedMocks({
    enableDatabase: true,
    enableAPI: true,
    enableBrowser: true,
    isIntegrationTest: false
  });
  
  console.log('[Test Setup] Unified test environment initialized');
});

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
  
  // Reset mock store
  if (mockSetup?.store) {
    mockSetup.store.reset();
  }
  
  // Reset timers if needed
  vi.clearAllTimers();
  
  // Reset fetch mock calls
  if (global.fetch && vi.isMockFunction(global.fetch)) {
    (global.fetch as any).mockClear();
  }
});

afterEach(() => {
  // Clean up any test-specific state
  vi.restoreAllMocks();
  
  // Clear any pending timers
  vi.clearAllTimers();
  
  // Reset console mocks if used
  if (global.console && vi.isMockFunction(global.console.log)) {
    (global.console.log as any).mockClear();
    (global.console.warn as any).mockClear();
    (global.console.error as any).mockClear();
  }
});

afterAll(() => {
  console.log('[Test Setup] Cleaning up unified test environment...');
  
  // Cleanup mock setup
  if (mockSetup?.cleanup) {
    mockSetup.cleanup();
  }
  
  // Clean up global utilities
  delete global.mockDataStore;
  delete global.testUtils;
  
  // Reset global state
  delete global.__VITEST__;
  delete global.__TEST_MODE__;
  
  console.log('[Test Setup] Test environment cleanup completed');
});

// ============================================================================
// Test Utilities Export
// ============================================================================

/**
 * Get the global mock setup for test-specific customization
 */
export function getTestMockSetup() {
  return mockSetup;
}

/**
 * Setup test-specific mocks with custom options
 */
export function setupTestMocks(options: Partial<MockConfiguration> = {}) {
  return initializeUnifiedMocks({
    enableDatabase: true,
    enableAPI: true,
    enableBrowser: true,
    isIntegrationTest: false,
    ...options,
  });
}

/**
 * Utility to create integration test environment
 * (disables certain mocks for integration testing)
 */
export function setupIntegrationTestMocks() {
  return initializeUnifiedMocks({
    enableDatabase: false, // Use real database for integration tests
    enableAPI: true,       // Keep API mocked for now
    enableBrowser: true,   // Keep browser APIs mocked
    isIntegrationTest: true,
  });
}

/**
 * Utility to create unit test environment
 * (mocks all external dependencies)
 */
export function setupUnitTestMocks() {
  return initializeUnifiedMocks({
    enableDatabase: true,
    enableAPI: true,
    enableBrowser: true,
    isIntegrationTest: false,
  });
}

// ============================================================================
// Mock Data Helpers
// ============================================================================

/**
 * Helper to add test data to mock store
 */
export function addTestData(tableName: string, data: Record<string, any>) {
  return (global.mockDataStore || getGlobalMockStore()).addRecord(tableName, data);
}

/**
 * Helper to set up test user data
 */
export function setupTestUser(userData: Partial<any> = {}) {
  const testUser = {
    id: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    supabaseId: 'supabase-test-user',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...userData,
  };
  
  return (global.mockDataStore || getGlobalMockStore()).addRecord('user', testUser);
}

/**
 * Helper to set up test API credentials
 */
export function setupTestCredentials(credData: Partial<any> = {}) {
  const testCredentials = {
    id: 'test-creds-123',
    userId: 'test-user-123',
    mexcApiKey: 'encrypted_test-api-key',
    mexcSecretKey: 'encrypted_test-secret-key',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...credData,
  };
  
  return (global.mockDataStore || getGlobalMockStore()).addRecord('apiCredentials', testCredentials);
}

/**
 * Helper to set up test snipe targets
 */
export function setupTestSnipeTargets(targets: Array<Partial<any>> = []) {
  const defaultTarget = {
    id: 'test-target-123',
    symbol: 'TESTCOINUSDT',
    userId: 'test-user-123',
    strategy: 'aggressive',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  const targetData = targets.length > 0 ? targets : [defaultTarget];
  
  return targetData.map((target, index) => 
    (global.mockDataStore || getGlobalMockStore()).addRecord('snipeTargets', {
      ...defaultTarget,
      id: `test-target-${123 + index}`,
      ...target,
    })
  );
}

// ============================================================================
// Test Environment Checks
// ============================================================================

/**
 * Check if running in test environment
 */
export function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test' || !!process.env.VITEST;
}

/**
 * Check if running unit tests
 */
export function isUnitTest(): boolean {
  return isTestEnvironment() && !process.env.INTEGRATION_TEST;
}

/**
 * Check if running integration tests
 */
export function isIntegrationTest(): boolean {
  return isTestEnvironment() && !!process.env.INTEGRATION_TEST;
}

// ============================================================================
// Performance Testing Utilities
// ============================================================================

/**
 * Measure execution time of a function
 */
export async function measureExecutionTime<T>(
  name: string,
  fn: () => Promise<T> | T
): Promise<{ result: T; executionTime: number }> {
  const start = performance.now();
  const result = await fn();
  const executionTime = performance.now() - start;
  
  console.log(`[Performance] ${name}: ${executionTime.toFixed(2)}ms`);
  
  return { result, executionTime };
}

/**
 * Create a performance benchmark
 */
export function createBenchmark(name: string, maxExecutionTime: number = 1000) {
  return {
    async run<T>(fn: () => Promise<T> | T): Promise<T> {
      const { result, executionTime } = await measureExecutionTime(name, fn);
      
      if (executionTime > maxExecutionTime) {
        console.warn(
          `[Performance Warning] ${name} exceeded max execution time: ${executionTime.toFixed(2)}ms > ${maxExecutionTime}ms`
        );
      }
      
      return result;
    }
  };
}

// ============================================================================
// Debugging Utilities
// ============================================================================

/**
 * Debug mock state
 */
export function debugMockState(tableName?: string) {
  const store = global.mockDataStore || getGlobalMockStore();
  if (tableName) {
    console.log(`[Debug] Mock table '${tableName}':`, store.getTable(tableName));
  } else {
    console.log('[Debug] All mock tables:', {
      snipeTargets: store.getTable('snipeTargets').length,
      user: store.getTable('user').length,
      apiCredentials: store.getTable('apiCredentials').length,
      // ... add more tables as needed
    });
  }
}

/**
 * Debug mock calls
 */
export function debugMockCalls(mockFunction: any, name: string) {
  if (vi.isMockFunction(mockFunction)) {
    console.log(`[Debug] ${name} mock calls:`, mockFunction.mock.calls);
    console.log(`[Debug] ${name} mock results:`, mockFunction.mock.results);
  }
}

// ============================================================================
// Export Global Mocks for Test Access
// ============================================================================

/**
 * Get the global mock store for direct access
 */
export function getGlobalMockStoreForTest() {
  return global.mockDataStore || getGlobalMockStore();
}

/**
 * Get global test utilities
 */
export function getGlobalTestUtils() {
  return global.testUtils;
}

/**
 * Export cleanup function
 */
export function globalCleanup() {
  if (mockSetup?.cleanup) {
    mockSetup.cleanup();
  }
}