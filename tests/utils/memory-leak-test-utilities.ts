/**
 * Memory Leak Test Utilities
 * 
 * Utilities for testing and debugging memory leaks in the test environment.
 * Provides tools to monitor EventEmitter usage and detect potential leaks.
 */

import { processEventManager } from '../../src/lib/process-event-manager';

export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  heapUtilization: number;
  processListeners: Record<string, number>;
  eventManagerInfo: any;
}

export class MemoryLeakTestUtilities {
  private static snapshots: MemorySnapshot[] = [];

  /**
   * Take a memory snapshot for comparison
   */
  static takeSnapshot(label?: string): MemorySnapshot {
    const memUsage = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      heapUtilization: memUsage.heapUsed / memUsage.heapTotal,
      processListeners: this.getProcessListenerCounts(),
      eventManagerInfo: processEventManager.getHandlerInfo()
    };

    this.snapshots.push(snapshot);
    
    if (label) {
      console.log(`📸 Memory snapshot '${label}':`, {
        heapUsed: Math.round(snapshot.heapUsed / 1024 / 1024) + 'MB',
        heapUtilization: Math.round(snapshot.heapUtilization * 100) + '%',
        processListeners: snapshot.processListeners,
        eventManagerHandlers: snapshot.eventManagerInfo.handlerCount
      });
    }

    return snapshot;
  }

  /**
   * Compare two memory snapshots
   */
  static compareSnapshots(before: MemorySnapshot, after: MemorySnapshot): {
    heapGrowth: number;
    heapGrowthMB: number;
    listenerChanges: Record<string, number>;
    potentialLeak: boolean;
    summary: string;
  } {
    const heapGrowth = after.heapUsed - before.heapUsed;
    const heapGrowthMB = heapGrowth / 1024 / 1024;
    
    const listenerChanges: Record<string, number> = {};
    const allEventTypes = new Set([
      ...Object.keys(before.processListeners),
      ...Object.keys(after.processListeners)
    ]);

    for (const eventType of allEventTypes) {
      const beforeCount = before.processListeners[eventType] || 0;
      const afterCount = after.processListeners[eventType] || 0;
      const change = afterCount - beforeCount;
      if (change !== 0) {
        listenerChanges[eventType] = change;
      }
    }

    const potentialLeak = heapGrowthMB > 10 || Object.values(listenerChanges).some(change => change > 0);
    
    const summary = potentialLeak 
      ? `⚠️  Potential memory leak detected: ${heapGrowthMB.toFixed(2)}MB heap growth, listener changes: ${JSON.stringify(listenerChanges)}`
      : `✅ Memory usage stable: ${heapGrowthMB.toFixed(2)}MB heap growth, no significant listener changes`;

    return {
      heapGrowth,
      heapGrowthMB,
      listenerChanges,
      potentialLeak,
      summary
    };
  }

  /**
   * Get current process listener counts by event type
   */
  private static getProcessListenerCounts(): Record<string, number> {
    const eventTypes = ['unhandledRejection', 'uncaughtException', 'SIGINT', 'SIGTERM', 'beforeExit'];
    const counts: Record<string, number> = {};

    for (const eventType of eventTypes) {
      counts[eventType] = process.listenerCount(eventType);
    }

    return counts;
  }

  /**
   * Check for potential EventEmitter memory leaks
   */
  static checkForMemoryLeaks(): {
    hasLeaks: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check process listener counts
    const listenerCounts = this.getProcessListenerCounts();
    for (const [eventType, count] of Object.entries(listenerCounts)) {
      if (count > 5) {
        issues.push(`High listener count for ${eventType}: ${count} listeners`);
        recommendations.push(`Review ${eventType} listener registration and cleanup`);
      }
    }

    // Check heap utilization
    const memUsage = process.memoryUsage();
    const heapUtilization = memUsage.heapUsed / memUsage.heapTotal;
    if (heapUtilization > 0.8) {
      issues.push(`High heap utilization: ${Math.round(heapUtilization * 100)}%`);
      recommendations.push('Consider forcing garbage collection or reducing memory usage');
    }

    // Check EventManager state
    const eventManagerInfo = processEventManager.getHandlerInfo();
    if (eventManagerInfo.handlerCount > 10) {
      issues.push(`High EventManager handler count: ${eventManagerInfo.handlerCount}`);
      recommendations.push('Review registered handlers and ensure proper cleanup');
    }

    return {
      hasLeaks: issues.length > 0,
      issues,
      recommendations
    };
  }

  /**
   * Run a memory leak test around a function
   */
  static async testForMemoryLeaks<T>(
    testFn: () => Promise<T> | T,
    testName: string,
    options: {
      expectNoLeaks?: boolean;
      maxHeapGrowthMB?: number;
      maxListenerIncrease?: number;
    } = {}
  ): Promise<{
    result: T;
    memoryReport: ReturnType<typeof MemoryLeakTestUtilities.compareSnapshots>;
    passed: boolean;
  }> {
    const { expectNoLeaks = true, maxHeapGrowthMB = 5, maxListenerIncrease = 0 } = options;
    
    // Force garbage collection before test
    if (global.gc) {
      global.gc();
      // Wait a bit for GC to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const beforeSnapshot = this.takeSnapshot(`${testName}-before`);
    
    const result = await testFn();
    
    // Force garbage collection after test
    if (global.gc) {
      global.gc();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const afterSnapshot = this.takeSnapshot(`${testName}-after`);
    const memoryReport = this.compareSnapshots(beforeSnapshot, afterSnapshot);

    const listenerIncreaseCount = Math.max(...Object.values(memoryReport.listenerChanges), 0);
    
    const passed = expectNoLeaks ? 
      memoryReport.heapGrowthMB <= maxHeapGrowthMB && listenerIncreaseCount <= maxListenerIncrease :
      true;

    if (!passed) {
      console.error(`❌ Memory leak test failed for ${testName}:`, {
        heapGrowthMB: memoryReport.heapGrowthMB,
        maxAllowed: maxHeapGrowthMB,
        listenerIncrease: listenerIncreaseCount,
        maxListenerIncrease,
        summary: memoryReport.summary
      });
    } else {
      console.log(`✅ Memory leak test passed for ${testName}: ${memoryReport.summary}`);
    }

    return {
      result,
      memoryReport,
      passed
    };
  }

  /**
   * Clear all stored snapshots
   */
  static clearSnapshots(): void {
    this.snapshots = [];
  }

  /**
   * Get all snapshots
   */
  static getSnapshots(): MemorySnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Force garbage collection if available
   */
  static forceGC(): void {
    if (global.gc) {
      console.log('🗑️ Forcing garbage collection...');
      global.gc();
    } else {
      console.warn('⚠️ Garbage collection not available (run with --expose-gc)');
    }
  }

  /**
   * Get current memory usage summary
   */
  static getMemorySummary(): {
    heapUsed: string;
    heapTotal: string;
    heapUtilization: string;
    processListeners: Record<string, number>;
    eventManagerHandlers: number;
  } {
    const memUsage = process.memoryUsage();
    const listenerCounts = this.getProcessListenerCounts();
    const eventManagerInfo = processEventManager.getHandlerInfo();

    return {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
      heapUtilization: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100) + '%',
      processListeners: listenerCounts,
      eventManagerHandlers: eventManagerInfo.handlerCount
    };
  }
}

/**
 * Helper function to wrap test functions with memory leak detection
 */
export function withMemoryLeakDetection<T extends (...args: any[]) => any>(
  testFn: T,
  testName: string = 'unnamed-test'
): T {
  return (async (...args: any[]) => {
    const { result, passed } = await MemoryLeakTestUtilities.testForMemoryLeaks(
      () => testFn(...args),
      testName
    );
    
    if (!passed) {
      throw new Error(`Memory leak detected in test: ${testName}`);
    }
    
    return result;
  }) as T;
}

/**
 * Vitest helper to assert no memory leaks in a test
 */
export function expectNoMemoryLeaks(): void {
  const leakCheck = MemoryLeakTestUtilities.checkForMemoryLeaks();
  
  if (leakCheck.hasLeaks) {
    const errorMessage = [
      'Memory leaks detected:',
      ...leakCheck.issues.map(issue => `  - ${issue}`),
      '',
      'Recommendations:',
      ...leakCheck.recommendations.map(rec => `  - ${rec}`)
    ].join('\n');
    
    throw new Error(errorMessage);
  }
}