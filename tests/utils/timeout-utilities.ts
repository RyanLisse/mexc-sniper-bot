/**
 * Test Timeout Utilities
 * 
 * Comprehensive timeout management for different test types to prevent hanging tests
 * and ensure CI/CD pipeline reliability.
 */

import { vi } from 'vitest';

export interface TimeoutConfig {
  testType: 'unit' | 'integration' | 'auto-sniping' | 'performance' | 'safety' | 'agents' | 'e2e';
  timeout?: number;
  warningThreshold?: number;
  enableMonitoring?: boolean;
}

export interface TimeoutResult<T> {
  result: T;
  duration: number;
  timedOut: boolean;
  warnings: string[];
}

/**
 * Get appropriate timeout for test type from environment or defaults
 */
export function getTestTimeout(testType: TimeoutConfig['testType']): number {
  const defaults = {
    unit: 10000,
    integration: 45000,
    'auto-sniping': 30000,
    performance: 60000,
    safety: 45000,
    agents: 30000,
    e2e: 120000
  };

  const envVariables = {
    unit: process.env.TEST_TIMEOUT_UNIT,
    integration: process.env.TEST_TIMEOUT_INTEGRATION,
    'auto-sniping': process.env.TEST_TIMEOUT_AUTO_SNIPING,
    performance: process.env.TEST_TIMEOUT_PERFORMANCE,
    safety: process.env.TEST_TIMEOUT_SAFETY,
    agents: process.env.TEST_TIMEOUT_AGENTS,
    e2e: process.env.TEST_TIMEOUT_E2E
  };

  const envValue = envVariables[testType];
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    // Return parsed value only if it's a valid positive number
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return defaults[testType];
}

/**
 * Create a timeout wrapper for async operations
 */
export function withTimeout<T>(
  operation: () => Promise<T>,
  config: TimeoutConfig
): Promise<TimeoutResult<T>> {
  const timeout = config.timeout || getTestTimeout(config.testType);
  const warningThreshold = config.warningThreshold || parseFloat(process.env.TIMEOUT_WARNING_THRESHOLD || '0.8');
  const enableMonitoring = config.enableMonitoring ?? (process.env.ENABLE_TIMEOUT_MONITORING === 'true');
  
  const startTime = Date.now();
  const warnings: string[] = [];
  
  let warningTimer: NodeJS.Timeout | undefined;
  
  if (enableMonitoring) {
    // Set warning timer
    warningTimer = setTimeout(() => {
      const warningMessage = `⚠️ Test approaching timeout (${Math.round(warningThreshold * 100)}% of ${timeout}ms)`;
      warnings.push(warningMessage);
      if (process.env.TIMEOUT_ERROR_REPORTING === 'true') {
        console.warn(warningMessage);
      }
    }, timeout * warningThreshold);
  }

  return Promise.race([
    operation().then(result => {
      if (warningTimer) clearTimeout(warningTimer);
      const duration = Date.now() - startTime;
      return {
        result,
        duration,
        timedOut: false,
        warnings
      };
    }),
    new Promise<TimeoutResult<T>>((_, reject) => {
      setTimeout(() => {
        if (warningTimer) clearTimeout(warningTimer);
        const duration = Date.now() - startTime;
        const error = new Error(`Test timed out after ${timeout}ms (${config.testType} test)`);
        error.name = 'TestTimeoutError';
        reject(error);
      }, timeout);
    })
  ]).catch(error => {
    if (warningTimer) clearTimeout(warningTimer);
    const duration = Date.now() - startTime;
    
    if (error.name === 'TestTimeoutError') {
      // This is our timeout error
      throw error;
    }
    
    // Re-throw other errors with timeout context
    throw error;
  });
}

/**
 * Create a timeout promise that can be used with Promise.race
 */
export function createTimeoutPromise(timeout: number, testType: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      const error = new Error(`Operation timed out after ${timeout}ms (${testType})`);
      error.name = 'OperationTimeoutError';
      reject(error);
    }, timeout);
  });
}

/**
 * Wrapper for database operations with timeout
 */
export async function withDatabaseTimeout<T>(
  operation: () => Promise<T>,
  customTimeout?: number
): Promise<T> {
  const timeout = customTimeout || parseInt(process.env.TEST_DB_TIMEOUT || '20000', 10);
  
  return Promise.race([
    operation(),
    createTimeoutPromise(timeout, 'database operation')
  ]);
}

/**
 * Wrapper for API operations with timeout
 */
export async function withApiTimeout<T>(
  operation: () => Promise<T>,
  customTimeout?: number
): Promise<T> {
  const timeout = customTimeout || 15000; // 15 seconds default for API calls
  
  return Promise.race([
    operation(),
    createTimeoutPromise(timeout, 'API operation')
  ]);
}

/**
 * Wrapper for WebSocket operations with timeout
 */
export async function withWebSocketTimeout<T>(
  operation: () => Promise<T>,
  customTimeout?: number
): Promise<T> {
  const timeout = customTimeout || 10000; // 10 seconds default for WebSocket operations
  
  return Promise.race([
    operation(),
    createTimeoutPromise(timeout, 'WebSocket operation')
  ]);
}

/**
 * Enhanced setTimeout wrapper with cleanup tracking
 */
export function createTestTimeout(callback: () => void, delay: number): () => void {
  const timeoutId = setTimeout(callback, delay);
  
  // Return cleanup function
  return () => {
    clearTimeout(timeoutId);
  };
}

/**
 * Test timeout monitoring for long-running operations
 */
export class TimeoutMonitor {
  private timeouts: Set<NodeJS.Timeout> = new Set();
  private intervals: Set<NodeJS.Timeout> = new Set();
  
  setTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    const timeoutId = setTimeout(() => {
      this.timeouts.delete(timeoutId);
      callback();
    }, delay);
    
    this.timeouts.add(timeoutId);
    return timeoutId;
  }
  
  setInterval(callback: () => void, delay: number): NodeJS.Timeout {
    const intervalId = setInterval(callback, delay);
    this.intervals.add(intervalId);
    return intervalId;
  }
  
  clearTimeout(timeoutId: NodeJS.Timeout): void {
    clearTimeout(timeoutId);
    this.timeouts.delete(timeoutId);
  }
  
  clearInterval(intervalId: NodeJS.Timeout): void {
    clearInterval(intervalId);
    this.intervals.delete(intervalId);
  }
  
  cleanup(): void {
    // Clear all tracked timeouts
    for (const timeoutId of this.timeouts) {
      clearTimeout(timeoutId);
    }
    this.timeouts.clear();
    
    // Clear all tracked intervals
    for (const intervalId of this.intervals) {
      clearInterval(intervalId);
    }
    this.intervals.clear();
  }
  
  getActiveCount(): { timeouts: number; intervals: number } {
    return {
      timeouts: this.timeouts.size,
      intervals: this.intervals.size
    };
  }
}

/**
 * Global timeout monitor instance for test cleanup
 */
export const globalTimeoutMonitor = new TimeoutMonitor();

/**
 * Retry wrapper with timeout for flaky operations
 */
export async function withRetryTimeout<T>(
  operation: () => Promise<T>,
  config: {
    maxRetries?: number;
    timeout?: number;
    retryDelay?: number;
    testType?: TimeoutConfig['testType'];
  } = {}
): Promise<T> {
  const maxRetries = config.maxRetries || 3;
  const timeout = config.timeout || getTestTimeout(config.testType || 'unit');
  const retryDelay = config.retryDelay || 1000;
  
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await Promise.race([
        operation(),
        createTimeoutPromise(timeout, `retry attempt ${attempt}`)
      ]);
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw new Error(`Operation failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
      }
      
      // Wait before retry (except timeout errors which should fail fast)
      if (lastError.name !== 'OperationTimeoutError' && lastError.name !== 'TestTimeoutError') {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  throw lastError!;
}

/**
 * Utility to set test timeout in vitest describe/it blocks
 */
export function setTestTimeout(testType: TimeoutConfig['testType'], customTimeout?: number): number {
  const timeout = customTimeout || getTestTimeout(testType);
  
  if (process.env.ENABLE_TIMEOUT_MONITORING === 'true') {
    console.log(`🕐 Setting ${testType} test timeout: ${timeout}ms`);
  }
  
  return timeout;
}

/**
 * Enhanced promise wrapper with detailed timeout reporting
 */
export async function timeoutPromise<T>(
  promise: Promise<T>,
  timeout: number,
  description = 'Operation'
): Promise<T> {
  const startTime = Date.now();
  
  return Promise.race([
    promise.then(result => {
      const duration = Date.now() - startTime;
      if (process.env.ENABLE_TIMEOUT_MONITORING === 'true' && duration > timeout * 0.7) {
        console.warn(`⚠️ ${description} took ${duration}ms (${Math.round(duration/timeout*100)}% of timeout)`);
      }
      return result;
    }),
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        const error = new Error(`${description} timed out after ${timeout}ms`);
        error.name = 'TimeoutError';
        reject(error);
      }, timeout);
    })
  ]);
}