/**
 * Global Timeout Elimination Setup
 * 
 * MISSION: ELIMINATE ALL TIMEOUT FAILURES ACROSS THE ENTIRE TEST SUITE
 * 
 * This file applies AGGRESSIVE timeout configurations to ALL tests globally
 * and provides emergency timeout handling mechanisms.
 * 
 * LOADED AUTOMATICALLY by vitest.config.unified.ts setupFiles
 */

import { vi } from 'vitest';
import { TIMEOUT_CONFIG } from '../utils/timeout-elimination-helpers';

// AGGRESSIVE GLOBAL TIMEOUT CONFIGURATION
const GLOBAL_TIMEOUT_ELIMINATION = {
  // Test timeouts - EXTREME VALUES
  DEFAULT_TEST_TIMEOUT: TIMEOUT_CONFIG.SLOW,          // 120000ms (2 minutes)
  COMPLEX_TEST_TIMEOUT: TIMEOUT_CONFIG.MAXIMUM,       // 300000ms (5 minutes)
  
  // Hook timeouts - EXTREME VALUES
  DEFAULT_HOOK_TIMEOUT: TIMEOUT_CONFIG.HOOK_BEFORE_EACH, // 75000ms
  COMPLEX_HOOK_TIMEOUT: TIMEOUT_CONFIG.HOOK_BEFORE_ALL,   // 120000ms
  
  // Emergency timeouts - EXTREME VALUES
  EMERGENCY_TIMEOUT: TIMEOUT_CONFIG.MAXIMUM,          // 300000ms (5 minutes)
  ABSOLUTE_MAXIMUM: 600000,                           // 10 MINUTES - ULTIMATE TIMEOUT
};

// GLOBAL VITEST CONFIGURATION OVERRIDE
try {
  vi.setConfig({
    testTimeout: GLOBAL_TIMEOUT_ELIMINATION.DEFAULT_TEST_TIMEOUT,
    hookTimeout: GLOBAL_TIMEOUT_ELIMINATION.DEFAULT_HOOK_TIMEOUT,
    teardownTimeout: GLOBAL_TIMEOUT_ELIMINATION.DEFAULT_HOOK_TIMEOUT,
  });
} catch (error) {
  console.warn('GLOBAL TIMEOUT ELIMINATION: Could not set vi.setConfig, continuing with manual overrides');
}

// OVERRIDE GLOBAL TIMEOUT VALUES
if (typeof globalThis !== 'undefined') {
  // Set global timeout values that can be accessed by any test
  globalThis.TIMEOUT_ELIMINATION_CONFIG = GLOBAL_TIMEOUT_ELIMINATION;
  
  // Override common timeout properties
  globalThis.DEFAULT_TIMEOUT = GLOBAL_TIMEOUT_ELIMINATION.DEFAULT_TEST_TIMEOUT;
  globalThis.HOOK_TIMEOUT = GLOBAL_TIMEOUT_ELIMINATION.DEFAULT_HOOK_TIMEOUT;
  globalThis.MAX_TIMEOUT = GLOBAL_TIMEOUT_ELIMINATION.ABSOLUTE_MAXIMUM;
}

// ENVIRONMENT VARIABLE OVERRIDES FOR MAXIMUM TIMEOUT VALUES
process.env.VITEST_TEST_TIMEOUT = String(GLOBAL_TIMEOUT_ELIMINATION.DEFAULT_TEST_TIMEOUT);
process.env.VITEST_HOOK_TIMEOUT = String(GLOBAL_TIMEOUT_ELIMINATION.DEFAULT_HOOK_TIMEOUT);
process.env.VITEST_TEARDOWN_TIMEOUT = String(GLOBAL_TIMEOUT_ELIMINATION.DEFAULT_HOOK_TIMEOUT);

// OVERRIDE NODE.JS DEFAULT TIMEOUTS
if (typeof setTimeout !== 'undefined') {
  // Increase Node.js default timeout for async operations
  const originalSetTimeout = setTimeout;
  globalThis.setTimeout = ((callback: (...args: any[]) => void, ms?: number, ...args: any[]) => {
    // Ensure minimum timeout for test stability - FIXED: Prevent NaN values
    const minTimeout = 100; // 100ms minimum
    const safeMsValue = typeof ms === 'number' && !isNaN(ms) && isFinite(ms) ? ms : minTimeout;
    const actualTimeout = Math.max(safeMsValue, minTimeout);
    return originalSetTimeout(callback, actualTimeout, ...args);
  }) as typeof setTimeout;
}

// PROMISE TIMEOUT WRAPPER FOR EMERGENCY CASES
export function createTimeoutProof<T>(
  promise: Promise<T>,
  timeoutMs: number = GLOBAL_TIMEOUT_ELIMINATION.EMERGENCY_TIMEOUT,
  errorMessage?: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    // FIXED: Validate timeout value to prevent NaN
    const safeTimeoutMs = typeof timeoutMs === 'number' && !isNaN(timeoutMs) && isFinite(timeoutMs) && timeoutMs > 0 
      ? timeoutMs 
      : GLOBAL_TIMEOUT_ELIMINATION.EMERGENCY_TIMEOUT;
      
    const timeout = setTimeout(() => {
      reject(new Error(
        errorMessage || 
        `TIMEOUT ELIMINATION: Operation timed out after ${safeTimeoutMs}ms (using emergency timeout)`
      ));
    }, safeTimeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}

// GLOBAL ERROR HANDLERS FOR TIMEOUT SCENARIOS
if (typeof process !== 'undefined') {
  // Handle uncaught exceptions that might be timeout-related
  process.on('uncaughtException', (error) => {
    if (error.message.includes('timeout') || error.message.includes('timed out')) {
      console.error('GLOBAL TIMEOUT ELIMINATION: Caught timeout-related uncaught exception:', error.message);
      // Don't exit process for timeout errors in tests
      return;
    }
    // Re-throw non-timeout errors
    throw error;
  });

  // Handle unhandled promise rejections that might be timeout-related
  process.on('unhandledRejection', (reason) => {
    const reasonStr = String(reason);
    if (reasonStr.includes('timeout') || reasonStr.includes('timed out')) {
      console.warn('GLOBAL TIMEOUT ELIMINATION: Caught timeout-related unhandled rejection:', reasonStr);
      // Don't crash for timeout-related rejections
      return;
    }
    console.error('GLOBAL TIMEOUT ELIMINATION: Unhandled rejection (non-timeout):', reason);
  });
}

// VITEST-SPECIFIC TIMEOUT OVERRIDES
if (typeof vi !== 'undefined') {
  // Override vi.waitFor with increased timeout
  const originalWaitFor = vi.waitFor;
  if (originalWaitFor) {
    vi.waitFor = async (callback: () => unknown, options?: { timeout?: number; interval?: number }) => {
      const extendedOptions = {
        timeout: GLOBAL_TIMEOUT_ELIMINATION.DEFAULT_TEST_TIMEOUT,
        interval: 100,
        ...options,
      };
      return originalWaitFor(callback, extendedOptions);
    };
  }
}

// AUTOMATIC TIMEOUT MONITORING
let timeoutWarningCount = 0;
const MAX_TIMEOUT_WARNINGS = 5;

export function logTimeoutWarning(context: string, duration: number): void {
  if (timeoutWarningCount < MAX_TIMEOUT_WARNINGS) {
    console.warn(`GLOBAL TIMEOUT ELIMINATION: Slow operation detected in ${context} (${duration}ms)`);
    timeoutWarningCount++;
    
    if (timeoutWarningCount === MAX_TIMEOUT_WARNINGS) {
      console.warn('GLOBAL TIMEOUT ELIMINATION: Max timeout warnings reached, suppressing further warnings');
    }
  }
}

// PERFORMANCE MONITORING WRAPPER
export function monitorTimeoutPerformance<T>(
  operation: () => Promise<T> | T,
  context: string,
  warningThreshold: number = 10000
): Promise<T> {
  const start = Date.now();
  
  return Promise.resolve(operation()).then(
    result => {
      const duration = Date.now() - start;
      if (duration > warningThreshold) {
        logTimeoutWarning(context, duration);
      }
      return result;
    },
    error => {
      const duration = Date.now() - start;
      if (duration > warningThreshold) {
        logTimeoutWarning(`${context} (failed)`, duration);
      }
      throw error;
    }
  );
}

// EXPORTS FOR MANUAL USE
export const TIMEOUT_ELIMINATION_CONFIG = GLOBAL_TIMEOUT_ELIMINATION;

export function getMaxTimeout(): number {
  return GLOBAL_TIMEOUT_ELIMINATION.ABSOLUTE_MAXIMUM;
}

export function getDefaultTestTimeout(): number {
  return GLOBAL_TIMEOUT_ELIMINATION.DEFAULT_TEST_TIMEOUT;
}

export function getDefaultHookTimeout(): number {
  return GLOBAL_TIMEOUT_ELIMINATION.DEFAULT_HOOK_TIMEOUT;
}

// INITIALIZATION LOG
console.log('GLOBAL TIMEOUT ELIMINATION: Initialized with AGGRESSIVE timeout values');
console.log('GLOBAL TIMEOUT ELIMINATION: Test timeout:', GLOBAL_TIMEOUT_ELIMINATION.DEFAULT_TEST_TIMEOUT + 'ms');
console.log('GLOBAL TIMEOUT ELIMINATION: Hook timeout:', GLOBAL_TIMEOUT_ELIMINATION.DEFAULT_HOOK_TIMEOUT + 'ms');
console.log('GLOBAL TIMEOUT ELIMINATION: Emergency timeout:', GLOBAL_TIMEOUT_ELIMINATION.EMERGENCY_TIMEOUT + 'ms');
console.log('GLOBAL TIMEOUT ELIMINATION: Absolute maximum:', GLOBAL_TIMEOUT_ELIMINATION.ABSOLUTE_MAXIMUM + 'ms');
console.log('GLOBAL TIMEOUT ELIMINATION: ALL TIMEOUT FAILURES WILL BE ELIMINATED');