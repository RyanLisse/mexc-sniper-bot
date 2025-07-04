/**
 * Promise & Error Test Helpers - Comprehensive Fix for ~60+ Test Failures
 * 
 * This utility provides robust patterns for fixing promise rejection expectation 
 * mismatches, error handling logic problems, exception throwing test issues, 
 * and try-catch block test failures.
 * 
 * MISSION: Fix all promise/error handling failures in the test suite
 */

import { vi, MockedFunction, expect, type Assertion } from "vitest";

/**
 * PATTERN 1: Fix Promise Rejection Expectation Mismatches
 * 
 * Common issue: expect(asyncFn()).rejects.toThrow() not working properly
 * Solution: Proper async/await patterns with error catching
 */
export async function expectAsyncToReject<T>(
  asyncFn: () => Promise<T>,
  expectedError?: string | RegExp | Error | ErrorConstructor
): Promise<void> {
  let caughtError: any = null;
  let didThrow = false;

  try {
    await asyncFn();
  } catch (error) {
    didThrow = true;
    caughtError = error;
  }

  if (!didThrow) {
    throw new Error('Expected promise to reject, but it resolved');
  }

  if (expectedError) {
    if (typeof expectedError === 'string') {
      const errorMessage = caughtError instanceof Error ? caughtError.message : String(caughtError);
      if (!errorMessage.includes(expectedError)) {
        throw new Error(`Expected error to contain "${expectedError}", but got: ${errorMessage}`);
      }
    } else if (expectedError instanceof RegExp) {
      const errorMessage = caughtError instanceof Error ? caughtError.message : String(caughtError);
      if (!expectedError.test(errorMessage)) {
        throw new Error(`Expected error to match ${expectedError}, but got: ${errorMessage}`);
      }
    } else if (typeof expectedError === 'function') {
      // Error constructor check
      if (!(caughtError instanceof expectedError)) {
        throw new Error(`Expected error to be instance of ${expectedError.name}, but got: ${caughtError.constructor.name}`);
      }
    } else if (expectedError instanceof Error) {
      if (caughtError.message !== expectedError.message) {
        throw new Error(`Expected error message "${expectedError.message}", but got: ${caughtError.message}`);
      }
    }
  }
}

/**
 * PATTERN 2: Fix Promise Resolution Expectation Mismatches
 * 
 * Common issue: expect(asyncFn()).not.toThrow() not working with async functions
 * Solution: Proper async execution with explicit success/failure tracking
 */
export async function expectAsyncToResolve<T>(
  asyncFn: () => Promise<T>
): Promise<T> {
  try {
    return await asyncFn();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Expected promise to resolve, but it rejected with: ${errorMessage}`);
  }
}

/**
 * PATTERN 3: Fix Mock Function Promise Resolution Issues
 * 
 * Common issue: vi.fn().mockResolvedValue() not working as expected
 * Solution: Explicit promise creation with proper resolution/rejection
 */
export function createReliableAsyncMock<T = any>(
  resolveValue?: T,
  shouldReject: boolean = false,
  rejectError?: Error | string
): MockedFunction<() => Promise<T>> {
  const mock = vi.fn() as MockedFunction<() => Promise<T>>;
  
  if (shouldReject) {
    const error = rejectError instanceof Error 
      ? rejectError 
      : new Error(rejectError || 'Mock rejection');
    mock.mockImplementation(() => Promise.reject(error));
  } else {
    mock.mockImplementation(() => Promise.resolve(resolveValue as T));
  }
  
  return mock;
}

/**
 * PATTERN 4: Fix Try-Catch Block Test Failures
 * 
 * Common issue: Tests expecting catch blocks to execute but they don't
 * Solution: Controlled error injection with verification
 */
export async function testTryCatchBehavior<T>(
  asyncFn: () => Promise<T>,
  shouldThrow: boolean,
  expectedError?: string | RegExp
): Promise<{ result?: T; error?: Error; didCatch: boolean }> {
  let result: T | undefined;
  let error: Error | undefined;
  let didCatch = false;

  try {
    result = await asyncFn();
  } catch (caughtError) {
    didCatch = true;
    error = caughtError instanceof Error ? caughtError : new Error(String(caughtError));
  }

  // Validate expectations
  if (shouldThrow && !didCatch) {
    throw new Error('Expected function to throw, but it succeeded');
  }
  
  if (!shouldThrow && didCatch) {
    throw new Error(`Expected function to succeed, but it threw: ${error?.message}`);
  }

  if (shouldThrow && expectedError && error) {
    if (typeof expectedError === 'string') {
      if (!error.message.includes(expectedError)) {
        throw new Error(`Expected error to contain "${expectedError}", but got: ${error.message}`);
      }
    } else if (expectedError instanceof RegExp) {
      if (!expectedError.test(error.message)) {
        throw new Error(`Expected error to match ${expectedError}, but got: ${error.message}`);
      }
    }
  }

  return { result, error, didCatch };
}

/**
 * PATTERN 5: Fix Error Handling Logic Problems
 * 
 * Common issue: Error handling paths not being tested properly
 * Solution: Systematic error injection and validation
 */
export class ErrorScenarioTester {
  private scenarios: Array<{
    name: string;
    error: Error;
    expectedBehavior: 'catch' | 'rethrow' | 'log';
    expectedResult?: any;
  }> = [];

  addScenario(
    name: string,
    error: Error,
    expectedBehavior: 'catch' | 'rethrow' | 'log',
    expectedResult?: any
  ): this {
    this.scenarios.push({ name, error, expectedBehavior, expectedResult });
    return this;
  }

  async testAllScenarios<T>(
    asyncFn: (shouldThrow: boolean, error?: Error) => Promise<T>
  ): Promise<void> {
    for (const scenario of this.scenarios) {
      try {
        if (scenario.expectedBehavior === 'catch') {
          // Should handle error gracefully
          const result = await asyncFn(true, scenario.error);
          if (scenario.expectedResult !== undefined) {
            expect(result).toEqual(scenario.expectedResult);
          }
        } else if (scenario.expectedBehavior === 'rethrow') {
          // Should rethrow the error
          await expectAsyncToReject(() => asyncFn(true, scenario.error), scenario.error.message);
        }
        // For 'log' behavior, the test should verify logging separately
      } catch (testError) {
        throw new Error(`Scenario "${scenario.name}" failed: ${testError}`);
      }
    }
  }
}

/**
 * PATTERN 6: Fix Dynamic Import Mocking Issues
 * 
 * Common issue: Dynamic imports not being mocked properly in async functions
 * Solution: Comprehensive mocking for both static and dynamic imports
 */
export function setupDynamicImportMock(
  modulePath: string,
  mockImplementation: any
): void {
  // Mock static import
  vi.mock(modulePath, () => mockImplementation);
  
  // Mock dynamic import
  vi.doMock(modulePath, () => mockImplementation);
  
  // For relative paths, also mock the relative version
  if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
    vi.doMock(modulePath, () => mockImplementation);
  }
}

/**
 * PATTERN 7: Fix Console/Logger Spy Validation Issues
 * 
 * Common issue: expect(consoleSpy.error).toHaveBeenCalled() failing
 * Solution: Proper spy setup and validation patterns
 */
export function createReliableConsoleSpy() {
  const spies = {
    info: vi.spyOn(console, 'info').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
  };

  const expectCalled = (method: keyof typeof spies, message?: string | RegExp) => {
    expect(spies[method]).toHaveBeenCalled();
    if (message) {
      if (typeof message === 'string') {
        expect(spies[method]).toHaveBeenCalledWith(expect.stringContaining(message));
      } else {
        expect(spies[method]).toHaveBeenCalledWith(expect.stringMatching(message));
      }
    }
  };

  const expectNotCalled = (method: keyof typeof spies) => {
    expect(spies[method]).not.toHaveBeenCalled();
  };

  const cleanup = () => {
    Object.values(spies).forEach(spy => spy.mockRestore());
  };

  return {
    spies,
    expectCalled,
    expectNotCalled,
    cleanup,
  };
}

/**
 * PATTERN 8: Fix Timeout and Async Operation Issues
 * 
 * Common issue: Tests timing out or not waiting for async operations
 * Solution: Proper timing control and promise orchestration
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    })
  ]);
}

/**
 * PATTERN 9: Fix Promise Chain Testing Issues
 * 
 * Common issue: Complex promise chains not being tested properly
 * Solution: Systematic promise chain validation
 */
export async function testPromiseChain<T>(
  operations: Array<() => Promise<T>>,
  expectedResults?: T[],
  shouldAllSucceed: boolean = true
): Promise<T[]> {
  const results: T[] = [];
  const errors: Error[] = [];

  for (let i = 0; i < operations.length; i++) {
    try {
      const result = await operations[i]();
      results.push(result);
      
      if (expectedResults && expectedResults[i] !== undefined) {
        expect(result).toEqual(expectedResults[i]);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(err);
      
      if (shouldAllSucceed) {
        throw new Error(`Promise chain failed at step ${i + 1}: ${err.message}`);
      }
    }
  }

  return results;
}

/**
 * PATTERN 10: Fix Race Condition Issues in Tests
 * 
 * Common issue: Race conditions causing flaky test failures
 * Solution: Controlled execution order and state synchronization
 */
export async function eliminateRaceConditions<T>(
  asyncOperations: Array<() => Promise<T>>,
  mode: 'sequential' | 'parallel' = 'sequential'
): Promise<T[]> {
  if (mode === 'sequential') {
    const results: T[] = [];
    for (const operation of asyncOperations) {
      results.push(await operation());
    }
    return results;
  } else {
    return Promise.all(asyncOperations.map(op => op()));
  }
}

/**
 * COMPREHENSIVE TEST SUITE HELPER
 * 
 * Combines all patterns for complete promise/error handling test coverage
 */
export class PromiseErrorTestSuite {
  private consoleSpy = createReliableConsoleSpy();
  private errorTester = new ErrorScenarioTester();

  setupTest(): void {
    vi.clearAllMocks();
  }

  teardownTest(): void {
    this.consoleSpy.cleanup();
    vi.restoreAllMocks();
  }

  async testAsyncFunction<T>(
    asyncFn: () => Promise<T>,
    options: {
      shouldSucceed?: boolean;
      expectedResult?: T;
      expectedError?: string | RegExp;
      shouldLogError?: boolean;
      shouldLogWarning?: boolean;
      timeout?: number;
    } = {}
  ): Promise<void> {
    const {
      shouldSucceed = true,
      expectedResult,
      expectedError,
      shouldLogError = false,
      shouldLogWarning = false,
      timeout = 5000
    } = options;

    if (shouldSucceed) {
      const result = await withTimeout(
        expectAsyncToResolve(asyncFn),
        timeout
      );
      
      if (expectedResult !== undefined) {
        expect(result).toEqual(expectedResult);
      }
    } else {
      await withTimeout(
        expectAsyncToReject(asyncFn, expectedError),
        timeout
      );
    }

    if (shouldLogError) {
      this.consoleSpy.expectCalled('error');
    }

    if (shouldLogWarning) {
      this.consoleSpy.expectCalled('warn');
    }
  }

  getConsoleSpy() {
    return this.consoleSpy;
  }

  getErrorTester() {
    return this.errorTester;
  }
}

export default PromiseErrorTestSuite;