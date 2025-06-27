/**
 * Vitest Global Setup Configuration
 *
 * Refactored modular setup for all Vitest tests including:
 * - Database initialization and cleanup  
 * - Mock configurations
 * - Environment variable setup
 * - Test utilities and helpers
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../../src/db';
import '@testing-library/jest-dom';
import { globalTimeoutMonitor } from '../utils/timeout-utilities';
import React from 'react';

// Make React globally available for JSX
global.React = React;

// Import modular components
import { 
  initializeTestMocks, 
  initializeDatabaseMocks 
} from './vitest-mocks';
import { 
  initializeTestUtilities,
  initializeGlobalTestConfig,
  detectTestEnvironment,
  configureEnvironmentVariables,
  setupErrorHandling
} from './vitest-utilities';

// Global test configuration
declare global {
  var __TEST_ENV__: boolean;
  var __TEST_START_TIME__: number;
  var mockDataStore: {
    snipeTargets: any[];
    user: any[];
    apiCredentials: any[];
    userPreferences: any[];
    patternEmbeddings: any[];
    coinActivities: any[];
    executionHistory: any[];
    transactionLocks: any[];
    workflowActivity: any[];
    monitoredListings: any[];
    tradingStrategies: any[];
    transactions: any[];
    reset(): void;
  };
  var testCleanupFunctions: Array<() => Promise<void>>;
  var testUtils: {
    createTestUser: (overrides?: Record<string, any>) => any;
    createTestApiCredentials: (overrides?: Record<string, any>) => any;
    createTestTradingData: (overrides?: Record<string, any>) => any;
    waitFor: (ms: number) => Promise<void>;
    generateTestId: () => string;
    mockApiResponse: (data: any, status?: number) => any;
    mockMexcApiResponse: (data: any, status?: number, extraHeaders?: Record<string, string>) => any;
    validateFetchMock: (mockResponse: any) => boolean;
    registerCleanup: (fn: () => Promise<void>) => void;
  };
}

// Initialize global configuration
initializeGlobalTestConfig();

// Initialize timeout monitoring
if (process.env.ENABLE_TIMEOUT_MONITORING === 'true') {
  console.log('🕐 Timeout monitoring enabled for test suite');
}

// ============================================================================
// Test Setup and Teardown
// ============================================================================

// Global setup before all tests
beforeAll(async () => {
  console.log('🧪 Setting up Vitest global environment...');
  
  // Detect test environment and configure
  const { isIntegrationTest, testInfo } = detectTestEnvironment();
  
  console.log('🔍 Test detection:', {
    ...testInfo,
    isIntegrationTest
  });
  
  // Configure environment variables
  configureEnvironmentVariables(isIntegrationTest);

  // Initialize test utilities and mocks
  await initializeTestMocks();
  await initializeDatabaseMocks(isIntegrationTest);

  // Initialize test utilities
  initializeTestUtilities();

  console.log('✅ Global mocks configured');
});

// Database setup for each test
beforeEach(async () => {
  if (process.env.RESET_DB_PER_TEST === 'true') {
    console.log('🗄️ Resetting database for test...');
  }
});

// Cleanup after each test
afterEach(async () => {
  vi.clearAllMocks();

  if (global.mockDataStore && global.mockDataStore.reset) {
    global.mockDataStore.reset();
  }

  globalTimeoutMonitor.cleanup();
  
  if (process.env.ENABLE_TIMEOUT_MONITORING === 'true') {
    const activeCount = globalTimeoutMonitor.getActiveCount();
    if (activeCount.timeouts > 0 || activeCount.intervals > 0) {
      console.warn(`⚠️ Cleaned up ${activeCount.timeouts} timeouts and ${activeCount.intervals} intervals after test`);
    }
  }

  if (global.testCleanupFunctions) {
    for (const cleanup of global.testCleanupFunctions) {
      await cleanup();
    }
    global.testCleanupFunctions = [];
  }
});

// Global cleanup after all tests
afterAll(async () => {
  console.log('🧹 Cleaning up Vitest environment...');

  // Clean up timeout monitoring
  globalTimeoutMonitor.cleanup();
  const finalActiveCount = globalTimeoutMonitor.getActiveCount();
  if (finalActiveCount.timeouts > 0 || finalActiveCount.intervals > 0) {
    console.warn(`⚠️ Final cleanup: ${finalActiveCount.timeouts} timeouts and ${finalActiveCount.intervals} intervals`);
  }

  // Enhanced database cleanup with forced closure
  try {
    if (db && typeof (db as any).closeDatabase === 'function') {
      await Promise.race([
        (db as any).closeDatabase(),
        new Promise((resolve) => setTimeout(() => {
          console.warn('⚠️ Database cleanup timed out');
          resolve(undefined);
        }, 3000))
      ]);
      console.log('📦 Database connections closed');
    }

    // Force close any remaining database connections
    if (typeof (global as any).__db_close_all__ === 'function') {
      await (global as any).__db_close_all__();
    }
  } catch (error) {
    console.warn('⚠️ Database cleanup warning:', (error as Error).message);
  }

  try {
    // Clear any cached database instances
    const clearDbCache = (global as any).clearDbCache;
    if (typeof clearDbCache === 'function') {
      clearDbCache();
    }
  } catch (error) {
    console.warn('⚠️ Database cache cleanup warning:', (error as Error).message);
  }

  // Clean up file handles and network connections
  try {
    // Close any open WebSocket connections
    if (global.WebSocket && typeof global.WebSocket.close === 'function') {
      global.WebSocket.close();
    }

    // Clean up fetch mock
    if (global.fetch && typeof global.fetch.cleanup === 'function') {
      global.fetch.cleanup();
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  } catch (error) {
    console.warn('⚠️ Connection cleanup warning:', (error as Error).message);
  }

  vi.restoreAllMocks();

  const testDuration = Date.now() - globalThis.__TEST_START_TIME__;
  console.log(`✅ Vitest environment cleaned up (${testDuration}ms)`);

  // Force exit after cleanup to prevent hanging
  setTimeout(() => {
    console.log('🔄 Forcing process cleanup to prevent hanging...');
    process.exitCode = 0;
  }, 100);
});

// ============================================================================
// Error Handling
// ============================================================================

// Set up error handling for uncaught exceptions in tests
setupErrorHandling();

console.log('🚀 Vitest setup completed successfully');

