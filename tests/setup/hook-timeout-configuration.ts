/**
 * Hook Timeout Configuration
 * 
 * MISSION: Eliminate ALL "Hook timed out in 10000ms" failures across the test suite
 * 
 * This configuration provides comprehensive timeout management for all test hooks:
 * - beforeAll/afterAll hooks
 * - beforeEach/afterEach hooks
 * - Custom timeout helpers for problematic test scenarios
 * - Async operation management in hooks
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { TIMEOUT_CONFIG } from '../utils/timeout-elimination-helpers';

// Global hook timeout tracking
const hookTimeouts = new Map<string, NodeJS.Timeout>();
let hookExecutionLog: Array<{ hook: string; start: number; duration?: number; status: 'started' | 'completed' | 'timeout' }> = [];

/**
 * Hook timeout wrapper that prevents hooks from hanging
 */
export function withHookTimeout<T>(
  hookFunction: () => Promise<T> | T,
  timeoutMs: number = TIMEOUT_CONFIG.STANDARD,
  hookName: string = 'anonymous'
): () => Promise<T> {
  return async (): Promise<T> => {
    const startTime = Date.now();
    hookExecutionLog.push({ hook: hookName, start: startTime, status: 'started' });
    
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        hookExecutionLog.push({ 
          hook: hookName, 
          start: startTime, 
          duration: Date.now() - startTime,
          status: 'timeout' 
        });
        reject(new Error(`Hook "${hookName}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      
      hookTimeouts.set(hookName, timeoutId);

      Promise.resolve(hookFunction())
        .then((result) => {
          clearTimeout(timeoutId);
          hookTimeouts.delete(hookName);
          hookExecutionLog.push({ 
            hook: hookName, 
            start: startTime, 
            duration: Date.now() - startTime,
            status: 'completed' 
          });
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          hookTimeouts.delete(hookName);
          hookExecutionLog.push({ 
            hook: hookName, 
            start: startTime, 
            duration: Date.now() - startTime,
            status: 'timeout' 
          });
          reject(error);
        });
    });
  };
}

/**
 * Enhanced beforeEach wrapper with timeout protection
 */
export function timeoutSafeBeforeEach(
  hookFunction: () => Promise<void> | void,
  timeoutMs: number = TIMEOUT_CONFIG.STANDARD
): void {
  beforeEach(withHookTimeout(hookFunction, timeoutMs, 'beforeEach'), timeoutMs);
}

/**
 * Enhanced afterEach wrapper with timeout protection
 */
export function timeoutSafeAfterEach(
  hookFunction: () => Promise<void> | void,
  timeoutMs: number = TIMEOUT_CONFIG.QUICK
): void {
  afterEach(withHookTimeout(hookFunction, timeoutMs, 'afterEach'), timeoutMs);
}

/**
 * Enhanced beforeAll wrapper with timeout protection
 */
export function timeoutSafeBeforeAll(
  hookFunction: () => Promise<void> | void,
  timeoutMs: number = TIMEOUT_CONFIG.SLOW
): void {
  beforeAll(withHookTimeout(hookFunction, timeoutMs, 'beforeAll'), timeoutMs);
}

/**
 * Enhanced afterAll wrapper with timeout protection
 */
export function timeoutSafeAfterAll(
  hookFunction: () => Promise<void> | void,
  timeoutMs: number = TIMEOUT_CONFIG.SLOW
): void {
  afterAll(withHookTimeout(hookFunction, timeoutMs, 'afterAll'), timeoutMs);
}

/**
 * Async operation wrapper for use in hooks
 */
export async function withAsyncHookOperation<T>(
  operation: () => Promise<T>,
  timeoutMs: number = TIMEOUT_CONFIG.STANDARD,
  operationName: string = 'async-operation'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Async operation "${operationName}" in hook timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    operation()
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Mock setup helper that prevents hook timeouts during mock initialization
 */
export async function timeoutSafeMockSetup(
  setupFunction: () => void | Promise<void>,
  timeoutMs: number = TIMEOUT_CONFIG.QUICK
): Promise<void> {
  return withAsyncHookOperation(
    async () => {
      await Promise.resolve(setupFunction());
    },
    timeoutMs,
    'mock-setup'
  );
}

/**
 * Cleanup helper that prevents hook timeouts during cleanup
 */
export async function timeoutSafeCleanup(
  cleanupFunction: () => void | Promise<void>,
  timeoutMs: number = TIMEOUT_CONFIG.QUICK
): Promise<void> {
  return withAsyncHookOperation(
    async () => {
      await Promise.resolve(cleanupFunction());
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    },
    timeoutMs,
    'cleanup'
  );
}

/**
 * Global hook monitoring setup
 */
beforeAll(() => {
  console.log('🎯 HOOK TIMEOUT CONFIGURATION: Initializing comprehensive hook timeout protection...');
  hookExecutionLog = [];
});

afterAll(() => {
  console.log('🎯 HOOK TIMEOUT CONFIGURATION: Hook execution summary:');
  
  const timeouts = hookExecutionLog.filter(log => log.status === 'timeout');
  const completed = hookExecutionLog.filter(log => log.status === 'completed');
  
  console.log(`✅ Completed hooks: ${completed.length}`);
  console.log(`❌ Timed out hooks: ${timeouts.length}`);
  
  if (timeouts.length > 0) {
    console.warn('⚠️ Hook timeouts detected:');
    timeouts.forEach(log => {
      console.warn(`   - ${log.hook}: ${log.duration}ms`);
    });
  }
  
  // Clear any remaining timeouts
  hookTimeouts.forEach((timeoutId) => {
    clearTimeout(timeoutId);
  });
  hookTimeouts.clear();
});

/**
 * Emergency timeout cleaner for problematic hooks
 */
export function emergencyTimeoutCleanup(): void {
  hookTimeouts.forEach((timeoutId, hookName) => {
    console.warn(`🚨 EMERGENCY: Clearing stuck timeout for hook: ${hookName}`);
    clearTimeout(timeoutId);
  });
  hookTimeouts.clear();
}

/**
 * Hook execution diagnostics
 */
export function getHookExecutionDiagnostics(): {
  totalHooks: number;
  completedHooks: number;
  timedOutHooks: number;
  averageDuration: number;
  slowestHook: { hook: string; duration: number } | null;
} {
  const completed = hookExecutionLog.filter(log => log.status === 'completed' && log.duration !== undefined);
  const timedOut = hookExecutionLog.filter(log => log.status === 'timeout');
  
  const averageDuration = completed.length > 0 
    ? completed.reduce((sum, log) => sum + (log.duration || 0), 0) / completed.length 
    : 0;
    
  const slowestHook = completed.length > 0
    ? completed.reduce((slowest, current) => 
        (current.duration || 0) > (slowest.duration || 0) ? current : slowest
      )
    : null;

  return {
    totalHooks: hookExecutionLog.length,
    completedHooks: completed.length,
    timedOutHooks: timedOut.length,
    averageDuration,
    slowestHook: slowestHook ? { hook: slowestHook.hook, duration: slowestHook.duration || 0 } : null
  };
}

// Export timeout configurations for direct use
export const HOOK_TIMEOUT_CONFIG = {
  BEFORE_EACH: TIMEOUT_CONFIG.STANDARD,
  AFTER_EACH: TIMEOUT_CONFIG.QUICK,
  BEFORE_ALL: TIMEOUT_CONFIG.SLOW,
  AFTER_ALL: TIMEOUT_CONFIG.SLOW,
  ASYNC_OPERATION: TIMEOUT_CONFIG.STANDARD,
  MOCK_SETUP: TIMEOUT_CONFIG.QUICK,
  CLEANUP: TIMEOUT_CONFIG.QUICK,
} as const;