/**
 * Simplified Vitest Setup Configuration
 *
 * Consolidated setup for all Vitest tests including:
 * - Essential mock configurations
 * - Environment setup
 * - Clean test utilities
 * - Simplified database mocks
 */

import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import React from 'react';

// Make React globally available for JSX
global.React = React;

// Import simplified components
import { initializeSimplifiedMocks } from './simplified-mocks';
import { initializeTestUtilities } from './test-utilities';

// Simplified global test configuration
declare global {
  var __TEST_ENV__: boolean;
  var __TEST_START_TIME__: number;
  var mockDataStore: {
    [tableName: string]: any[];
    reset(): void;
    addRecord(tableName: string, record: any): any;
    findRecords(tableName: string, condition: (record: any) => boolean): any[];
  };
  var testUtils: {
    createTestUser: (overrides?: Record<string, any>) => any;
    createTestApiCredentials: (overrides?: Record<string, any>) => any;
    waitFor: (ms: number) => Promise<void>;
    generateTestId: () => string;
    mockApiResponse: (data: any, status?: number) => any;
  };
}

// Initialize simplified global configuration
globalThis.__TEST_ENV__ = true;
globalThis.__TEST_START_TIME__ = Date.now();

// ============================================================================
// Simplified Test Setup and Teardown
// ============================================================================

// Simplified global setup
beforeAll(async () => {
  if (process.env.VERBOSE_TESTS === 'true') {
    console.log('🧪 Setting up simplified Vitest environment...');
  }
  
  // Detect test type
  const isIntegrationTest = process.env.USE_REAL_DATABASE === 'true' ||
                           process.argv.join(' ').includes('integration') ||
                           process.env.npm_command === 'test:integration';
  
  // Configure environment
  if (!isIntegrationTest) {
    process.env.FORCE_MOCK_DB = 'true';
    process.env.SKIP_DB_CONNECTION = 'true';
  }

  // Initialize mocks and utilities
  initializeSimplifiedMocks(isIntegrationTest);
  initializeTestUtilities();

  if (process.env.VERBOSE_TESTS === 'true') {
    console.log('✅ Simplified test setup completed');
  }
});

// Simple cleanup after each test
afterEach(() => {
  // Essential cleanup only
  vi.clearAllMocks();

  if (global.mockDataStore && global.mockDataStore.reset) {
    global.mockDataStore.reset();
  }
});

// Simple global cleanup
afterAll(() => {
  if (process.env.VERBOSE_TESTS === 'true') {
    const testDuration = Date.now() - globalThis.__TEST_START_TIME__;
    console.log(`✅ Test cleanup completed (${testDuration}ms)`);
  }

  vi.restoreAllMocks();
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

// ============================================================================
// Simplified Error Handling
// ============================================================================

// Basic error handling for tests
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection in test:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception in test:', error);
});

if (process.env.VERBOSE_TESTS === 'true') {
  console.log('🚀 Simplified Vitest setup completed');
}

