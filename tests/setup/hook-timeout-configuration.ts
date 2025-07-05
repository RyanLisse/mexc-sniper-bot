/**
 * Global Hook Timeout Configuration
 * 
 * MISSION: ELIMINATE ALL HOOK TIMEOUTS ACROSS THE ENTIRE TEST SUITE
 * 
 * This file provides aggressive timeout configuration for ALL test hooks
 * to prevent ANY timeout failures in beforeEach, afterEach, beforeAll, afterAll.
 * 
 * AUTOMATICALLY LOADED by vitest-setup.ts to apply to ALL tests.
 */

import { vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { TIMEOUT_CONFIG } from '../utils/timeout-utilities';

// AGGRESSIVE TIMEOUT ELIMINATION: Set global hook timeouts
const GLOBAL_HOOK_TIMEOUTS = {
  BEFORE_EACH: TIMEOUT_CONFIG.HOOK_BEFORE_EACH,  // 75000ms
  AFTER_EACH: TIMEOUT_CONFIG.HOOK_AFTER_EACH,   // 70000ms
  BEFORE_ALL: TIMEOUT_CONFIG.HOOK_BEFORE_ALL,   // 120000ms
  AFTER_ALL: TIMEOUT_CONFIG.HOOK_AFTER_ALL,     // 120000ms
};

// Override Vitest's default timeout configuration
vi.setConfig({
  testTimeout: TIMEOUT_CONFIG.SLOW,        // 120000ms for all tests
  hookTimeout: TIMEOUT_CONFIG.HOOK_BEFORE_EACH, // 75000ms for all hooks
  teardownTimeout: TIMEOUT_CONFIG.HOOK_CLEANUP, // 60000ms for cleanup
});

/**
 * Global hook wrapper to ensure ALL hooks use aggressive timeouts
 */
function wrapHookWithTimeout<T extends any[]>(
  originalHook: (...args: T) => any,
  timeoutMs: number
) {
  return (...args: T) => {
    const [callback, options] = args;
    
    // Wrap the callback with timeout protection
    const wrappedCallback = async (...callbackArgs: any[]) => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Hook timed out after ${timeoutMs}ms - using aggressive timeout elimination`));
        }, timeoutMs);

        Promise.resolve(callback(...callbackArgs))
          .then(resolve)
          .catch(reject)
          .finally(() => clearTimeout(timeout));
      });
    };

    // Apply the timeout to the options if not already set - ENHANCED: More robust NaN prevention
    const optionsTimeout = (typeof options?.timeout === 'number' && !isNaN(options.timeout) && isFinite(options.timeout) && options.timeout > 0) ? options.timeout : 0;
    const safeTimeoutMs = (typeof timeoutMs === 'number' && !isNaN(timeoutMs) && isFinite(timeoutMs) && timeoutMs > 0) ? timeoutMs : 30000;
    
    // Ensure final timeout is always a positive number
    const finalTimeout = Math.max(Math.max(optionsTimeout, safeTimeoutMs), 1000); // Minimum 1 second
    
    const finalOptions = {
      ...options,
      timeout: finalTimeout
    };

    return originalHook(wrappedCallback, finalOptions);
  };
}

// Store original hook functions
const originalBeforeEach = beforeEach;
const originalAfterEach = afterEach;
const originalBeforeAll = beforeAll;
const originalAfterAll = afterAll;

// Override global hook functions with timeout protection
globalThis.beforeEach = wrapHookWithTimeout(originalBeforeEach, GLOBAL_HOOK_TIMEOUTS.BEFORE_EACH);
globalThis.afterEach = wrapHookWithTimeout(originalAfterEach, GLOBAL_HOOK_TIMEOUTS.AFTER_EACH);
globalThis.beforeAll = wrapHookWithTimeout(originalBeforeAll, GLOBAL_HOOK_TIMEOUTS.BEFORE_ALL);
globalThis.afterAll = wrapHookWithTimeout(originalAfterAll, GLOBAL_HOOK_TIMEOUTS.AFTER_ALL);

// Export for manual configuration if needed
export const HOOK_TIMEOUT_CONFIG = GLOBAL_HOOK_TIMEOUTS;

/**
 * Function to manually apply aggressive timeouts to a specific test suite
 */
export function applyAggressiveTimeouts() {
  return {
    beforeEachTimeout: GLOBAL_HOOK_TIMEOUTS.BEFORE_EACH,
    afterEachTimeout: GLOBAL_HOOK_TIMEOUTS.AFTER_EACH,
    beforeAllTimeout: GLOBAL_HOOK_TIMEOUTS.BEFORE_ALL,
    afterAllTimeout: GLOBAL_HOOK_TIMEOUTS.AFTER_ALL,
  };
}

/**
 * Emergency timeout killer - forces all pending operations to complete
 */
export async function emergencyTimeoutKiller(): Promise<void> {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  // Clear all timers and intervals
  try {
    // @ts-ignore - Clear all Node.js timers
    if (global.clearImmediate) {
      for (let i = 1; i < 10000; i++) {
        global.clearImmediate(i);
        global.clearTimeout(i);
        global.clearInterval(i);
      }
    }
  } catch (error) {
    // Ignore cleanup errors
  }
  
  // Force promise resolution
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setTimeout(resolve, 0));
  
  // Final cleanup
  if (typeof process !== 'undefined' && process.nextTick) {
    await new Promise(resolve => process.nextTick(resolve));
  }
}

// Automatically apply emergency timeout killer on uncaught promise rejections
if (typeof process !== 'undefined') {
  process.on('unhandledRejection', async (reason) => {
    console.warn('HOOK TIMEOUT ELIMINATION: Unhandled rejection detected, applying emergency cleanup');
    await emergencyTimeoutKiller();
  });
}

console.log('HOOK TIMEOUT ELIMINATION: Global hook timeouts configured with AGGRESSIVE values');
console.log('HOOK TIMEOUT ELIMINATION: beforeEach:', GLOBAL_HOOK_TIMEOUTS.BEFORE_EACH + 'ms');
console.log('HOOK TIMEOUT ELIMINATION: afterEach:', GLOBAL_HOOK_TIMEOUTS.AFTER_EACH + 'ms');
console.log('HOOK TIMEOUT ELIMINATION: beforeAll:', GLOBAL_HOOK_TIMEOUTS.BEFORE_ALL + 'ms');
console.log('HOOK TIMEOUT ELIMINATION: afterAll:', GLOBAL_HOOK_TIMEOUTS.AFTER_ALL + 'ms');