/**
 * EMERGENCY TEST PERFORMANCE OPTIMIZATIONS
 * 
 * Critical performance circuit breakers and optimizations to prevent
 * hanging tests and excessive execution times.
 */

import { vi } from 'vitest';

// Global performance monitoring
let testStartTime: number;
let activeTestTimeouts: Set<NodeJS.Timeout> = new Set();
let testKillSwitch = false;

export const EMERGENCY_TIMEOUTS = {
  GLOBAL_TEST_TIMEOUT: 300000, // 5 minutes maximum for entire test suite
  INDIVIDUAL_TEST_TIMEOUT: 10000, // 10 seconds maximum per test
  CLEANUP_TIMEOUT: 2000, // 2 seconds maximum for cleanup
  DATABASE_TIMEOUT: 1000, // 1 second maximum for database operations
} as const;

/**
 * Initialize emergency performance monitoring
 */
export function initializeEmergencyPerformanceMonitoring(): void {
  testStartTime = Date.now();

  // Global test suite timeout
  const globalTimeout = setTimeout(() => {
    console.error('🚨 EMERGENCY: Test suite exceeded 5 minutes, force terminating!');
    testKillSwitch = true;
    process.exit(1);
  }, EMERGENCY_TIMEOUTS.GLOBAL_TEST_TIMEOUT);

  activeTestTimeouts.add(globalTimeout);

  // Memory leak detection
  const memoryMonitor = setInterval(() => {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    if (heapUsedMB > 512) { // 512MB threshold
      console.warn(`⚠️ High memory usage detected: ${heapUsedMB}MB`);
    }
    
    if (heapUsedMB > 1024) { // 1GB emergency threshold
      console.error('🚨 EMERGENCY: Memory usage exceeded 1GB, force terminating!');
      testKillSwitch = true;
      process.exit(1);
    }
  }, 10000); // Check every 10 seconds

  activeTestTimeouts.add(memoryMonitor);
}

/**
 * Emergency test timeout wrapper
 */
export function withEmergencyTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number = EMERGENCY_TIMEOUTS.INDIVIDUAL_TEST_TIMEOUT,
  description: string = 'operation'
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (testKillSwitch) {
      reject(new Error('Test suite killed by emergency circuit breaker'));
      return;
    }

    let completed = false;
    
    const timeout = setTimeout(() => {
      if (!completed) {
        completed = true;
        console.error(`🚨 EMERGENCY TIMEOUT: ${description} exceeded ${timeoutMs}ms`);
        reject(new Error(`Emergency timeout: ${description} exceeded ${timeoutMs}ms`));
      }
    }, timeoutMs);

    activeTestTimeouts.add(timeout);

    operation()
      .then((result) => {
        if (!completed) {
          completed = true;
          clearTimeout(timeout);
          activeTestTimeouts.delete(timeout);
          resolve(result);
        }
      })
      .catch((error) => {
        if (!completed) {
          completed = true;
          clearTimeout(timeout);
          activeTestTimeouts.delete(timeout);
          reject(error);
        }
      });
  });
}

/**
 * Emergency database cleanup with forced termination
 */
export async function emergencyDatabaseCleanup(): Promise<void> {
  return withEmergencyTimeout(async () => {
    // Force close all database connections
    if (global.gc) {
      global.gc();
    }
    
    // Clear any hanging database connections
    if (typeof (global as any).__emergency_db_cleanup__ === 'function') {
      await (global as any).__emergency_db_cleanup__();
    }
  }, EMERGENCY_TIMEOUTS.DATABASE_TIMEOUT, 'database cleanup');
}

/**
 * Emergency mock cleanup
 */
export function emergencyMockCleanup(): void {
  try {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.restoreAllMocks();
    
    // Clear global mock data store
    if (global.mockDataStore && global.mockDataStore.reset) {
      global.mockDataStore.reset();
    }
  } catch (error) {
    console.warn('⚠️ Emergency mock cleanup warning:', (error as Error).message);
  }
}

/**
 * Emergency cleanup of all resources
 */
export async function emergencyCleanupAll(): Promise<void> {
  console.log('🚨 Running emergency cleanup...');
  
  // Stop all active timeouts
  for (const timeout of activeTestTimeouts) {
    clearTimeout(timeout);
  }
  activeTestTimeouts.clear();
  
  // Emergency mock cleanup
  emergencyMockCleanup();
  
  // Emergency database cleanup
  try {
    await emergencyDatabaseCleanup();
  } catch (error) {
    console.warn('⚠️ Emergency database cleanup failed:', (error as Error).message);
  }
  
  console.log('✅ Emergency cleanup completed');
}

/**
 * Force terminate hanging processes - DISABLED for database tests
 */
export function forceTerminateHangingProcesses(): void {
  // DISABLED: This was causing premature process exits during database operations
  // Database operations can take longer than 100ms especially during cleanup
  console.log('🔄 Force termination disabled - allowing database operations to complete...');
  
  // Only force terminate after much longer delay and only if truly hanging
  setTimeout(() => {
    if (!testKillSwitch) {
      const metrics = getPerformanceMetrics();
      if (metrics.elapsedTimeMs > EMERGENCY_TIMEOUTS.GLOBAL_TEST_TIMEOUT) {
        console.error('🚨 EMERGENCY: Test suite truly hanging after 5+ minutes, force terminating!');
        process.exit(1);
      }
    }
  }, 30000); // 30 seconds instead of 100ms
}

/**
 * Get performance metrics
 */
export function getPerformanceMetrics(): {
  elapsedTimeMs: number;
  memoryUsageMB: number;
  activeTimeouts: number;
} {
  const memUsage = process.memoryUsage();
  return {
    elapsedTimeMs: Date.now() - testStartTime,
    memoryUsageMB: Math.round(memUsage.heapUsed / 1024 / 1024),
    activeTimeouts: activeTestTimeouts.size,
  };
}

// Export kill switch for external access
export { testKillSwitch };