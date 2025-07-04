/**
 * Timing Fix Utilities
 * MISSION: Eliminate all timing-dependent test failures
 * 
 * Provides utilities to fix:
 * - Date/time assertion failures
 * - Performance timing tests
 * - Race conditions in async operations
 * - State transition timing issues
 */

import { vi } from 'vitest';

export interface TimingTestContext {
  startTime: number;
  frozenTime?: number;
  timers: Set<NodeJS.Timeout>;
  intervals: Set<NodeJS.Timeout>;
}

/**
 * Creates a stable timing context for tests that eliminates race conditions
 */
export class StableTimingContext {
  private context: TimingTestContext;
  private originalDateNow: () => number;
  private originalSetTimeout: typeof setTimeout;
  private originalSetInterval: typeof setInterval;
  private timeAdvanced = 0;
  
  constructor() {
    this.originalDateNow = Date.now;
    this.originalSetTimeout = setTimeout;
    this.originalSetInterval = setInterval;
    
    this.context = {
      startTime: Date.now(),
      timers: new Set(),
      intervals: new Set()
    };
  }
  
  /**
   * Freezes time at a specific moment to ensure deterministic tests
   */
  freezeTimeAt(timestamp?: number): void {
    const frozenTime = timestamp || Date.now();
    this.context.frozenTime = frozenTime;
    this.timeAdvanced = 0;
    
    // Use vitest's built-in fake timers for better integration
    vi.useFakeTimers();
    vi.setSystemTime(new Date(frozenTime));
  }
  
  /**
   * Advances frozen time by specified milliseconds
   */
  advanceTime(milliseconds: number): void {
    if (this.context.frozenTime !== undefined) {
      this.timeAdvanced += milliseconds;
      const newTime = this.context.frozenTime + this.timeAdvanced;
      vi.setSystemTime(new Date(newTime));
    }
  }
  
  /**
   * Gets the current stable time (frozen or real)
   */
  getCurrentTime(): number {
    if (this.context.frozenTime !== undefined) {
      return this.context.frozenTime + this.timeAdvanced;
    }
    return Date.now();
  }
  
  /**
   * Creates a Date object at the current stable time plus optional offset
   */
  createStableDate(offsetMs = 0): Date {
    return new Date(this.getCurrentTime() + offsetMs);
  }
  
  /**
   * Ensures two operations happen with guaranteed time difference
   */
  async ensureTimeDifference(
    operation1: () => Promise<any> | any,
    operation2: () => Promise<any> | any,
    minimumDiffMs = 10
  ): Promise<{ result1: any; result2: any; timeDiff: number }> {
    const startTime = this.getCurrentTime();
    
    const result1 = await operation1();
    
    // Advance time to ensure difference
    this.advanceTime(minimumDiffMs);
    
    const result2 = await operation2();
    
    const timeDiff = this.getCurrentTime() - startTime;
    
    return { result1, result2, timeDiff };
  }
  
  /**
   * Waits for a specific amount of time in the stable context
   */
  async wait(milliseconds: number): Promise<void> {
    if (this.context.frozenTime !== undefined) {
      // In frozen time, just advance the clock
      this.advanceTime(milliseconds);
      // Still need to process any pending microtasks
      await vi.advanceTimersByTimeAsync(milliseconds);
    } else {
      // In real time, actually wait
      await new Promise(resolve => setTimeout(resolve, milliseconds));
    }
  }
  
  /**
   * Cleanup the timing context
   */
  cleanup(): void {
    // Clear all tracked timers
    for (const timer of this.context.timers) {
      clearTimeout(timer);
    }
    this.context.timers.clear();
    
    for (const interval of this.context.intervals) {
      clearInterval(interval);
    }
    this.context.intervals.clear();
    
    // Restore real timers
    vi.useRealTimers();
  }
}

/**
 * Performance test utilities that eliminate timing variability
 */
export class StablePerformanceTesting {
  /**
   * Measures operation duration with stable timing
   */
  static async measureStableDuration<T>(
    operation: () => Promise<T> | T,
    expectedMaxMs?: number
  ): Promise<{ result: T; duration: number; withinExpectation: boolean }> {
    // Use high-resolution time for better accuracy
    const startTime = process.hrtime.bigint();
    
    const result = await operation();
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
    
    const withinExpectation = expectedMaxMs ? duration <= expectedMaxMs : true;
    
    return { result, duration, withinExpectation };
  }
  
  /**
   * Tests performance with controlled CPU load
   */
  static async testPerformanceWithStableLoad<T>(
    operation: () => Promise<T> | T,
    iterations = 1000,
    maxDurationMs = 100
  ): Promise<{ 
    averageDuration: number; 
    maxDuration: number; 
    minDuration: number; 
    allWithinLimit: boolean;
    results: T[] 
  }> {
    const durations: number[] = [];
    const results: T[] = [];
    
    // Warm up to stabilize JIT optimization
    for (let i = 0; i < Math.min(10, iterations / 10); i++) {
      await operation();
    }
    
    // Run actual measurements
    for (let i = 0; i < iterations; i++) {
      const { result, duration } = await this.measureStableDuration(operation);
      durations.push(duration);
      results.push(result);
      
      // Small delay to prevent overwhelming the system
      if (i % 100 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
    
    const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);
    const allWithinLimit = durations.every(d => d <= maxDurationMs);
    
    return {
      averageDuration,
      maxDuration,
      minDuration,
      allWithinLimit,
      results
    };
  }
}

/**
 * Utilities for fixing common timing-based test failures
 */
export class TimingFixUtils {
  /**
   * Creates dates with guaranteed time differences for comparison tests
   */
  static createDatesWithDifference(
    baseTime?: number,
    differenceMs = 100
  ): { 
    earlier: Date; 
    later: Date; 
    difference: number 
  } {
    const base = baseTime || Date.now();
    const earlier = new Date(base);
    const later = new Date(base + differenceMs);
    
    return { earlier, later, difference: differenceMs };
  }
  
  /**
   * Fixes Date.now() based assertions by providing controlled time
   */
  static withControlledTime<T>(
    operation: (getCurrentTime: () => number) => T,
    startTime?: number
  ): T {
    const controlledTime = startTime || Date.now();
    let currentTime = controlledTime;
    
    const getCurrentTime = () => currentTime;
    const originalDateNow = Date.now;
    
    // Mock Date.now to return controlled time
    Date.now = () => currentTime;
    
    try {
      return operation(getCurrentTime);
    } finally {
      // Restore original Date.now
      Date.now = originalDateNow;
    }
  }
  
  /**
   * Ensures async operations complete in a predictable order
   */
  static async executeInOrder<T>(
    operations: Array<() => Promise<T>>,
    delayBetweenMs = 10
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < operations.length; i++) {
      if (i > 0 && delayBetweenMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenMs));
      }
      
      const result = await operations[i]();
      results.push(result);
    }
    
    return results;
  }
  
  /**
   * Waits for a condition with stable timing
   */
  static async waitForConditionStable(
    condition: () => boolean | Promise<boolean>,
    options: {
      timeoutMs?: number;
      intervalMs?: number;
      timeoutMessage?: string;
    } = {}
  ): Promise<void> {
    const { timeoutMs = 5000, intervalMs = 50, timeoutMessage = 'Condition not met' } = options;
    const startTime = Date.now();
    
    while (true) {
      const result = await condition();
      if (result) {
        return;
      }
      
      if (Date.now() - startTime >= timeoutMs) {
        throw new Error(`${timeoutMessage} (waited ${timeoutMs}ms)`);
      }
      
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }
  
  /**
   * Retries an operation with exponential backoff for timing stability
   */
  static async retryWithStableBackoff<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      initialDelayMs?: number;
      maxDelayMs?: number;
      backoffMultiplier?: number;
      retryCondition?: (error: Error) => boolean;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      initialDelayMs = 100,
      maxDelayMs = 2000,
      backoffMultiplier = 2,
      retryCondition = () => true
    } = options;
    
    let lastError: Error;
    let delay = initialDelayMs;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries || !retryCondition(lastError)) {
          throw lastError;
        }
        
        // Wait with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * backoffMultiplier, maxDelayMs);
      }
    }
    
    throw lastError!;
  }
}

/**
 * Test wrapper that automatically handles timing issues
 */
export function withStableTiming<T extends any[]>(
  testFn: (...args: T) => Promise<void> | void,
  options: {
    freezeTime?: boolean;
    startTime?: number;
    enablePerformanceMode?: boolean;
  } = {}
) {
  return async (...args: T) => {
    const timingContext = new StableTimingContext();
    
    try {
      if (options.freezeTime !== false) {
        timingContext.freezeTimeAt(options.startTime);
      }
      
      if (options.enablePerformanceMode) {
        // Disable garbage collection during test for stable performance
        if (global.gc) {
          global.gc();
        }
      }
      
      await testFn(...args);
      
    } finally {
      timingContext.cleanup();
      
      if (options.enablePerformanceMode && global.gc) {
        // Clean up after performance test
        global.gc();
      }
    }
  };
}

/**
 * Assertion helpers that handle timing variability
 */
export class StableAssertions {
  /**
   * Asserts that two dates are different with tolerance for timing variations
   */
  static expectDateDifference(
    actual: Date,
    expected: Date,
    options: {
      minimumDifferenceMs?: number;
      toleranceMs?: number;
      message?: string;
    } = {}
  ): void {
    const { minimumDifferenceMs = 1, toleranceMs = 1000, message = 'Dates should be different' } = options;
    
    const actualTime = actual.getTime();
    const expectedTime = expected.getTime();
    const difference = Math.abs(actualTime - expectedTime);
    
    if (difference < minimumDifferenceMs) {
      throw new Error(
        `${message}: Expected difference of at least ${minimumDifferenceMs}ms, but got ${difference}ms`
      );
    }
    
    if (difference > toleranceMs) {
      throw new Error(
        `${message}: Expected difference within ${toleranceMs}ms tolerance, but got ${difference}ms`
      );
    }
  }
  
  /**
   * Asserts performance within expected bounds with stability considerations
   */
  static expectPerformanceWithin(
    actualMs: number,
    expectedMaxMs: number,
    options: {
      tolerancePercent?: number;
      message?: string;
    } = {}
  ): void {
    const { tolerancePercent = 50, message = 'Performance within expected bounds' } = options;
    
    const toleranceMs = expectedMaxMs * (tolerancePercent / 100);
    const adjustedMax = expectedMaxMs + toleranceMs;
    
    if (actualMs > adjustedMax) {
      throw new Error(
        `${message}: Expected duration <= ${adjustedMax}ms (${expectedMaxMs}ms + ${tolerancePercent}% tolerance), but got ${actualMs}ms`
      );
    }
  }
}

/**
 * Global timing context for tests
 */
export const globalTimingContext = new StableTimingContext();

/**
 * Stable Date Manager for consistent date/time operations in tests
 */
export class StableDateManager {
  private static frozenTime: number | null = null;
  private static timeAdvanced = 0;
  
  /**
   * Freezes time at a specific timestamp
   */
  static freezeAt(timestamp?: number): void {
    this.frozenTime = timestamp || Date.now();
    this.timeAdvanced = 0;
    
    // Use vitest's fake timers
    vi.useFakeTimers();
    vi.setSystemTime(new Date(this.frozenTime));
  }
  
  /**
   * Advances the frozen time by milliseconds
   */
  static advance(milliseconds: number): void {
    if (this.frozenTime !== null) {
      this.timeAdvanced += milliseconds;
      vi.setSystemTime(new Date(this.frozenTime + this.timeAdvanced));
    }
  }
  
  /**
   * Gets the current stable time
   */
  static now(): number {
    if (this.frozenTime !== null) {
      return this.frozenTime + this.timeAdvanced;
    }
    return Date.now();
  }
  
  /**
   * Creates a stable date object
   */
  static createStableDate(offsetMs = 0): Date {
    return new Date(this.now() + offsetMs);
  }
  
  /**
   * Resets to real time
   */
  static reset(): void {
    this.frozenTime = null;
    this.timeAdvanced = 0;
    vi.useRealTimers();
  }
  
  /**
   * Ensures time difference between operations
   */
  static async ensureTimeDifference<T1, T2>(
    operation1: () => Promise<T1> | T1,
    operation2: () => Promise<T2> | T2,
    minimumDiffMs = 10
  ): Promise<{ result1: T1; result2: T2; timeDiff: number }> {
    const startTime = this.now();
    
    const result1 = await operation1();
    
    // Advance time to ensure difference
    this.advance(minimumDiffMs);
    
    const result2 = await operation2();
    const endTime = this.now();
    
    return {
      result1,
      result2,
      timeDiff: endTime - startTime
    };
  }
}

/**
 * Standalone function to create stable dates
 */
export function createStableDate(offsetMs = 0): Date {
  return StableDateManager.createStableDate(offsetMs);
}

/**
 * Standalone function to ensure time difference between operations
 */
export async function ensureTimeDifference<T1, T2>(
  operation1: () => Promise<T1> | T1,
  operation2: () => Promise<T2> | T2,
  minimumDiffMs = 10
): Promise<{ result1: T1; result2: T2; timeDiff: number }> {
  return StableDateManager.ensureTimeDifference(operation1, operation2, minimumDiffMs);
}