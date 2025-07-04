/**
 * Mock Async Helpers - Fix Promise Resolution in Unit Tests
 * 
 * This utility provides proper mock handling for async operations:
 * - Correct promise resolution/rejection patterns
 * - Proper async function testing
 * - Timer management for fake timers
 * - Mock cleanup and restoration
 */

import { vi, MockedFunction, beforeEach, afterEach } from "vitest";

/**
 * Create a mock that properly handles async operations
 * FIXES: Mock functions that don't properly resolve/reject promises
 */
export function createAsyncMock<T extends (...args: any[]) => any>(
  implementation?: T,
  defaultResolvedValue?: Awaited<ReturnType<T>>
): MockedFunction<T> {
  const mock = vi.fn(implementation) as MockedFunction<T>;
  
  if (defaultResolvedValue !== undefined) {
    mock.mockResolvedValue(defaultResolvedValue);
  }
  
  return mock;
}

/**
 * Create a mock that rejects with a specific error
 */
export function createAsyncRejectMock<T extends (...args: any[]) => any>(
  error: Error | string = new Error('Mock rejection')
): MockedFunction<T> {
  const mock = vi.fn() as MockedFunction<T>;
  mock.mockRejectedValue(error instanceof Error ? error : new Error(error));
  return mock;
}

/**
 * Create a mock that can be controlled for testing different scenarios
 */
export function createControlledAsyncMock<T extends (...args: any[]) => any>() {
  const mock = vi.fn() as MockedFunction<T>;
  let currentBehavior: 'resolve' | 'reject' | 'pending' = 'resolve';
  let resolveValue: any;
  let rejectValue: any;
  let pendingPromises: Array<{ resolve: (value: any) => void; reject: (error: any) => void }> = [];

  mock.mockImplementation((...args) => {
    return new Promise((resolve, reject) => {
      if (currentBehavior === 'resolve') {
        resolve(resolveValue);
      } else if (currentBehavior === 'reject') {
        reject(rejectValue);
      } else {
        // pending - store resolvers for manual control
        pendingPromises.push({ resolve, reject });
      }
    });
  });

  return {
    mock,
    setResolve: (value: any) => {
      currentBehavior = 'resolve';
      resolveValue = value;
    },
    setReject: (error: any) => {
      currentBehavior = 'reject';
      rejectValue = error;
    },
    setPending: () => {
      currentBehavior = 'pending';
    },
    resolvePending: (value: any) => {
      pendingPromises.forEach(({ resolve }) => resolve(value));
      pendingPromises = [];
    },
    rejectPending: (error: any) => {
      pendingPromises.forEach(({ reject }) => reject(error));
      pendingPromises = [];
    },
    getPendingCount: () => pendingPromises.length
  };
}

/**
 * Properly test async functions that should not throw
 * FIXES: expect(...).not.toThrow() patterns on async functions
 */
export async function expectAsyncNotToThrow<T>(asyncFn: () => Promise<T>): Promise<T> {
  try {
    return await asyncFn();
  } catch (error) {
    throw new Error(`Expected async function not to throw, but it threw: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Properly test async functions that should throw
 */
export async function expectAsyncToThrow<T>(
  asyncFn: () => Promise<T>, 
  expectedErrorMessage?: string | RegExp
): Promise<void> {
  let threwError = false;
  let caughtError: any;

  try {
    await asyncFn();
  } catch (error) {
    threwError = true;
    caughtError = error;
  }

  if (!threwError) {
    throw new Error('Expected async function to throw, but it did not');
  }

  if (expectedErrorMessage) {
    const errorMessage = caughtError instanceof Error ? caughtError.message : String(caughtError);
    
    if (typeof expectedErrorMessage === 'string') {
      if (!errorMessage.includes(expectedErrorMessage)) {
        throw new Error(`Expected error to contain "${expectedErrorMessage}", but got: ${errorMessage}`);
      }
    } else if (expectedErrorMessage instanceof RegExp) {
      if (!expectedErrorMessage.test(errorMessage)) {
        throw new Error(`Expected error to match ${expectedErrorMessage}, but got: ${errorMessage}`);
      }
    }
  }
}

/**
 * Create a mock confidence calculator with realistic behavior
 * FIXES: Confidence calculator mocks that cause test failures
 */
export function createMockConfidenceCalculator() {
  const mockCalculator = {
    calculateReadyStateConfidence: createAsyncMock(
      async (symbol: any) => {
        if (!symbol) return 0;
        // Return high confidence for ready state symbols
        if (symbol.sts === 2 && symbol.st === 2 && symbol.tt === 4) {
          return 90;
        }
        return 70; // Below threshold
      }
    ),
    
    calculateAdvanceOpportunityConfidence: createAsyncMock(
      async (entry: any, advanceHours: number) => {
        if (!entry) return 0;
        // Return confidence based on advance hours for realistic testing
        if (advanceHours >= 3.5) {
          return 75;
        }
        return 60; // Below threshold
      }
    ),
    
    calculatePreReadyScore: createAsyncMock(
      async () => ({
        isPreReady: true,
        confidence: 70,
        estimatedTimeToReady: 2,
      })
    ),
    
    // Additional methods that might be called
    calculateConfidence: createAsyncMock(async () => 80),
    assessRisk: createAsyncMock(async () => ({ level: 'low', score: 20 })),
  };

  return mockCalculator;
}

/**
 * Setup proper timer management for tests
 * FIXES: Timer-related test issues
 */
export function setupTimerMocks() {
  const originalDateNow = Date.now;
  const originalSetTimeout = global.setTimeout;
  const originalSetInterval = global.setInterval;
  const originalClearTimeout = global.clearTimeout;
  const originalClearInterval = global.clearInterval;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  return {
    advanceTime: (ms: number) => vi.advanceTimersByTime(ms),
    runAllTimers: () => vi.runAllTimers(),
    runOnlyPendingTimers: () => vi.runOnlyPendingTimers(),
    setSystemTime: (time: Date | number | string) => vi.setSystemTime(time)
  };
}

/**
 * Create a comprehensive mock setup for common test scenarios
 */
export function createTestMockSuite() {
  const mocks = {
    fetch: vi.fn(),
    console: {
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    },
    process: {
      exit: vi.spyOn(process, 'exit').mockImplementation(() => undefined as never),
    }
  };

  // Setup fetch mock with proper async behavior
  global.fetch = mocks.fetch.mockImplementation(async (url: string) => {
    if (typeof url === 'string' && url.includes('/api/health')) {
      return Promise.resolve(new Response('OK', { status: 200 }));
    }
    return Promise.resolve(new Response('Not Found', { status: 404 }));
  });

  const cleanup = () => {
    vi.restoreAllMocks();
    Object.values(mocks.console).forEach(spy => spy.mockRestore());
    mocks.process.exit.mockRestore();
  };

  return {
    mocks,
    cleanup
  };
}

/**
 * Helper to test promise chains properly
 */
export async function testPromiseChain<T>(
  promises: Array<() => Promise<T>>,
  shouldAllSucceed: boolean = true
): Promise<T[]> {
  if (shouldAllSucceed) {
    // All promises should succeed
    const results = await Promise.all(promises.map(p => p()));
    return results;
  } else {
    // Test that handles both success and failure
    const results = await Promise.allSettled(promises.map(p => p()));
    return results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        throw result.reason;
      }
    });
  }
}

/**
 * Create a mock service with consistent async patterns
 */
export function createMockService<T extends Record<string, (...args: any[]) => any>>(
  methods: T,
  defaultBehavior: 'resolve' | 'reject' = 'resolve'
): { [K in keyof T]: MockedFunction<T[K]> } {
  const mockService = {} as { [K in keyof T]: MockedFunction<T[K]> };

  for (const [methodName, originalMethod] of Object.entries(methods)) {
    const mock = vi.fn() as MockedFunction<T[typeof methodName]>;
    
    if (defaultBehavior === 'resolve') {
      mock.mockResolvedValue(undefined);
    } else {
      mock.mockRejectedValue(new Error(`Mock ${methodName} rejection`));
    }
    
    mockService[methodName as keyof T] = mock;
  }

  return mockService;
}

/**
 * Utility to ensure all promises in a test are properly awaited
 */
export async function waitForAllPromises(): Promise<void> {
  // Use multiple setImmediate calls to ensure all promises are resolved
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
}