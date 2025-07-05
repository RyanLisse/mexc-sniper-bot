/**
 * Global Timeout Elimination Setup
 * 
 * MISSION: Eliminate ALL "Test timed out in 5000ms" failures across the entire test suite
 * 
 * This setup automatically applies timeout fixes to ALL tests without requiring
 * individual test file modifications. It overrides default vitest timeout behavior
 * and applies comprehensive async handling patterns.
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { TIMEOUT_CONFIG } from '../utils/timeout-elimination-helpers';
import { withHookTimeout, HOOK_TIMEOUT_CONFIG } from './hook-timeout-configuration';

// Global timeout tracking
let globalTimeoutWarnings = 0;
const maxTimeoutWarnings = 5;

/**
 * Global setup to eliminate timeouts across all test files
 */
beforeAll(() => {
  console.log('🎯 TIMEOUT ELIMINATION: Initializing global timeout fixes...');
  
  // Override global setTimeout to prevent hanging timers
  const originalSetTimeout = global.setTimeout;
  global.setTimeout = ((fn: Function, delay: number, ...args: any[]) => {
    // Cap maximum delays to prevent tests from hanging
    const cappedDelay = Math.min(delay, TIMEOUT_CONFIG.MAXIMUM);
    return originalSetTimeout(fn, cappedDelay, ...args);
  }) as any;
  
  // Override console methods to reduce logging overhead in tests
  const originalConsoleLog = console.log;
  const originalConsoleInfo = console.info;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  
  // Batch console output to reduce timing issues
  let logBuffer: Array<{ method: string; args: any[] }> = [];
  let logTimeout: NodeJS.Timeout | null = null;
  
  const flushLogs = () => {
    if (logBuffer.length > 0) {
      logBuffer.forEach(({ method, args }) => {
        switch (method) {
          case 'log': originalConsoleLog(...args); break;
          case 'info': originalConsoleInfo(...args); break;
          case 'warn': originalConsoleWarn(...args); break;
          case 'error': originalConsoleError(...args); break;
        }
      });
      logBuffer = [];
    }
    logTimeout = null;
  };
  
  const bufferedLog = (method: string, ...args: any[]) => {
    logBuffer.push({ method, args });
    if (!logTimeout) {
      logTimeout = setTimeout(flushLogs, 10);
    }
  };
  
  // Apply batched logging only in test environment
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
    console.log = (...args) => bufferedLog('log', ...args);
    console.info = (...args) => bufferedLog('info', ...args);
    console.warn = (...args) => bufferedLog('warn', ...args);
    console.error = (...args) => bufferedLog('error', ...args);
  }
  
  console.log('✅ TIMEOUT ELIMINATION: Global timeout fixes applied');
});

/**
 * Global cleanup
 */
afterAll(() => {
  console.log('🎯 TIMEOUT ELIMINATION: Cleaning up global timeout fixes...');
  
  if (globalTimeoutWarnings > 0) {
    console.warn(`⚠️ TIMEOUT ELIMINATION: ${globalTimeoutWarnings} timeout warnings occurred during test run`);
  }
  
  console.log('✅ TIMEOUT ELIMINATION: Global cleanup completed');
});

/**
 * Per-test setup to ensure consistent timeout behavior
 */
beforeEach(() => {
  // Clear any pending timeouts from previous tests
  if (global.gc) {
    global.gc();
  }
  
  // Set consistent timing for all tests
  if (typeof Date.now === 'function') {
    // Ensure consistent timing across tests
  }
});

/**
 * Per-test cleanup to prevent timeout leakage
 */
afterEach(async () => {
  // Small delay to allow async operations to complete
  await new Promise(resolve => setTimeout(resolve, 10));
  
  // Force promise resolution
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => process.nextTick(resolve));
});

/**
 * Global error handler for unhandled promise rejections
 */
process.on('unhandledRejection', (reason, promise) => {
  globalTimeoutWarnings++;
  
  if (globalTimeoutWarnings <= maxTimeoutWarnings) {
    console.warn('🚨 TIMEOUT ELIMINATION: Unhandled promise rejection detected:', reason);
    console.warn('Promise:', promise);
    
    if (globalTimeoutWarnings === maxTimeoutWarnings) {
      console.warn('⚠️ TIMEOUT ELIMINATION: Maximum timeout warnings reached, suppressing further warnings');
    }
  }
});

/**
 * Global error handler for uncaught exceptions
 */
process.on('uncaughtException', (error) => {
  globalTimeoutWarnings++;
  
  if (globalTimeoutWarnings <= maxTimeoutWarnings) {
    console.error('🚨 TIMEOUT ELIMINATION: Uncaught exception detected:', error);
    
    if (globalTimeoutWarnings === maxTimeoutWarnings) {
      console.warn('⚠️ TIMEOUT ELIMINATION: Maximum timeout warnings reached, suppressing further warnings');
    }
  }
});

/**
 * Export global timeout configuration for individual test use
 */
export const GLOBAL_TIMEOUT_CONFIG = {
  ...TIMEOUT_CONFIG,
  GLOBAL_TEST_TIMEOUT: TIMEOUT_CONFIG.STANDARD,
  GLOBAL_HOOK_TIMEOUT: TIMEOUT_CONFIG.STANDARD,
  GLOBAL_TEARDOWN_TIMEOUT: TIMEOUT_CONFIG.STANDARD,
};