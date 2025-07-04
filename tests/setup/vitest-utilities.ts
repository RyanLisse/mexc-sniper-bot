/**
 * Vitest Test Utilities
 *
 * Extracted from vitest-setup.ts for better modularity.
 * Contains test helper functions and utilities.
 */

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Initialize test utilities and add them to global scope
 */
export function initializeTestUtilities(): void {
  global.testUtils = {
    createTestUser: (overrides = {}) => ({
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    }),

    createTestApiCredentials: (overrides = {}) => ({
      id: 'test-creds-id',
      userId: 'test-user-id',
      mexcApiKey: 'encrypted_test-api-key',
      mexcSecretKey: 'encrypted_test-secret-key',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    }),

    createTestTradingData: (overrides = {}) => ({
      symbol: 'BTCUSDT',
      price: '50000.00',
      quantity: '0.001',
      side: 'BUY',
      type: 'MARKET',
      timestamp: Date.now(),
      ...overrides
    }),

    waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

    generateTestId: () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,

    mockApiResponse: (data: any, status = 200) => ({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
      headers: new Headers({
        'content-type': 'application/json'
      })
    }),

    mockMexcApiResponse: (data: any, status = 200, extraHeaders: Record<string, string> = {}) => ({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
      headers: new Headers({
        'content-type': 'application/json',
        'x-ratelimit-remaining': '100',
        'x-ratelimit-limit': '1000',
        ...extraHeaders
      })
    }),

    validateFetchMock: (mockResponse: any) => {
      const required = ['ok', 'status', 'headers', 'json'];
      const missing = required.filter(prop => !(prop in mockResponse));
      if (missing.length > 0) {
        throw new Error(`Fetch mock missing required properties: ${missing.join(', ')}`);
      }
      
      if (!mockResponse.headers || typeof mockResponse.headers.forEach !== 'function') {
        throw new Error('Fetch mock headers must be a Headers object');
      }
      
      return true;
    },

    registerCleanup: (fn: () => Promise<void>) => {
      if (!global.testCleanupFunctions) {
        global.testCleanupFunctions = [];
      }
      global.testCleanupFunctions.push(fn);
    }
  };
}

// ============================================================================
// Global Test Configuration
// ============================================================================

/**
 * Initialize global test configuration and variables
 */
export function initializeGlobalTestConfig(): void {
  globalThis.__TEST_ENV__ = true;
  globalThis.__TEST_START_TIME__ = Date.now();
}

// ============================================================================
// Test Environment Detection
// ============================================================================

/**
 * Determine if current test run is integration test
 */
export function detectTestEnvironment(): {
  isIntegrationTest: boolean;
  testInfo: {
    testFilePath: string;
    testCommand: string;
    vitest_file: string;
    pool_worker: string;
    USE_REAL_DATABASE: string | undefined;
  };
} {
  const testFilePath = (global as any).process?.env?.VITEST_FILE_PATH || '';
  const testCommand = process.argv.join(' ');
  const vitest_file = process.env.VITEST_POOL_ID || '';
  const pool_worker = process.env.VITEST_WORKER_ID || '';
  
  const isIntegrationTest = process.env.USE_REAL_DATABASE === 'true' ||
                           testFilePath.includes('integration') || 
                           testFilePath.includes('pattern-to-database-bridge') ||
                           testCommand.includes('integration') ||
                           testCommand.includes('pattern-to-database-bridge') ||
                           vitest_file.includes('integration') ||
                           vitest_file.includes('pattern-to-database-bridge') ||
                           process.env.VITEST_MODE === 'integration' || 
                           process.env.npm_command === 'test:integration';

  return {
    isIntegrationTest,
    testInfo: {
      testFilePath,
      testCommand: testCommand.slice(0, 100),
      vitest_file,
      pool_worker,
      USE_REAL_DATABASE: process.env.USE_REAL_DATABASE,
    }
  };
}

// ============================================================================
// Environment Variable Setup
// ============================================================================

/**
 * Configure environment variables based on test type
 */
export function configureEnvironmentVariables(isIntegrationTest: boolean): void {
  if (!isIntegrationTest) {
    process.env.FORCE_MOCK_DB = 'true';
    process.env.SKIP_DB_CONNECTION = 'true';
    process.env.USE_MOCK_DATABASE = 'true';
    console.log('🧪 Unit test mode: Using mocked database');
  } else {
    process.env.FORCE_MOCK_DB = 'false';
    process.env.SKIP_DB_CONNECTION = 'false';
    process.env.USE_MOCK_DATABASE = 'false';
    console.log('🔗 Integration test mode: Using real database connections');
  }
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Set up error handling for uncaught exceptions in tests using centralized manager
 */
export function setupErrorHandling(): void {
  // Error handling is now managed centrally by vitest-setup.ts
  // This function is kept for backwards compatibility but no longer adds duplicate listeners
  console.log('🔧 Error handling delegated to centralized process event manager');
}