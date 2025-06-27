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
import { 
  initializeEmergencyPerformanceMonitoring,
  withEmergencyTimeout,
  emergencyCleanupAll,
  forceTerminateHangingProcesses,
  getPerformanceMetrics 
} from './emergency-test-optimizations';

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

// Global setup before all tests - emergency performance optimized
beforeAll(async () => {
  // Initialize emergency performance monitoring FIRST
  initializeEmergencyPerformanceMonitoring();
  
  if (process.env.VERBOSE_TESTS === 'true') {
    console.log('🧪 Setting up Vitest global environment with emergency optimizations...');
  }
  
  // Wrap entire setup in emergency timeout
  await withEmergencyTimeout(async () => {
    // Detect test environment and configure
    const { isIntegrationTest, testInfo } = detectTestEnvironment();
    
    if (process.env.VERBOSE_TESTS === 'true') {
      console.log('🔍 Test detection:', {
        ...testInfo,
        isIntegrationTest
      });
    }
    
    // Configure environment variables
    configureEnvironmentVariables(isIntegrationTest);

    // Initialize test utilities and mocks in parallel for speed
    await Promise.all([
      initializeTestMocks(),
      initializeDatabaseMocks(isIntegrationTest),
      Promise.resolve(initializeTestUtilities())
    ]);

    if (process.env.VERBOSE_TESTS === 'true') {
      console.log('✅ Global mocks configured');
    }
  }, 30000, 'global test setup');
});

// Database setup for each test
beforeEach(async () => {
  if (process.env.RESET_DB_PER_TEST === 'true') {
    console.log('🗄️ Resetting database for test...');
  }
});

// Cleanup after each test - optimized for performance
afterEach(async () => {
  // Fast cleanup - only essential operations
  vi.clearAllMocks();

  if (global.mockDataStore && global.mockDataStore.reset) {
    global.mockDataStore.reset();
  }

  // Only run timeout monitoring cleanup if enabled and verbose
  if (process.env.ENABLE_TIMEOUT_MONITORING === 'true') {
    globalTimeoutMonitor.cleanup();
    if (process.env.VERBOSE_TESTS === 'true') {
      const activeCount = globalTimeoutMonitor.getActiveCount();
      if (activeCount.timeouts > 0 || activeCount.intervals > 0) {
        console.warn(`⚠️ Cleaned up ${activeCount.timeouts} timeouts and ${activeCount.intervals} intervals after test`);
      }
    }
  }

  // Run cleanup functions in parallel for speed
  if (global.testCleanupFunctions && global.testCleanupFunctions.length > 0) {
    await Promise.allSettled(global.testCleanupFunctions.map(cleanup => cleanup()));
    global.testCleanupFunctions = [];
  }
});

// Global cleanup after all tests - emergency performance optimized
afterAll(async () => {
  if (process.env.VERBOSE_TESTS === 'true') {
    console.log('🧹 Running emergency cleanup...');
    const metrics = getPerformanceMetrics();
    console.log('📊 Performance metrics:', metrics);
  }

  // Use emergency cleanup instead of manual cleanup
  try {
    await emergencyCleanupAll();
  } catch (error) {
    console.error('🚨 Emergency cleanup failed:', (error as Error).message);
  }

  // Clean up timeout monitoring
  if (process.env.ENABLE_TIMEOUT_MONITORING === 'true') {
    globalTimeoutMonitor.cleanup();
    if (process.env.VERBOSE_TESTS === 'true') {
      const finalActiveCount = globalTimeoutMonitor.getActiveCount();
      if (finalActiveCount.timeouts > 0 || finalActiveCount.intervals > 0) {
        console.warn(`⚠️ Final cleanup: ${finalActiveCount.timeouts} timeouts and ${finalActiveCount.intervals} intervals`);
      }
    }
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
    if (global.WebSocket && global.WebSocket.CLOSED !== undefined) {
      // WebSocket constants are available
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
  if (process.env.VERBOSE_TESTS === 'true') {
    console.log(`✅ Emergency cleanup completed (${testDuration}ms)`);
  }

  // Force terminate hanging processes immediately
  forceTerminateHangingProcesses();
});

// ============================================================================
// Error Handling
// ============================================================================

// Set up error handling for uncaught exceptions in tests
setupErrorHandling();

if (process.env.VERBOSE_TESTS === 'true') {
  console.log('🚀 Vitest setup completed successfully');
}

