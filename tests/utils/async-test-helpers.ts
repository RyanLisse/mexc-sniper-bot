/**
 * Async Test Helpers - Fix Promise and Timeout Issues
 * 
 * This utility provides robust async handling for all test scenarios:
 * - Proper server startup/shutdown with real promise rejection
 * - Timeout handling with cancellation
 * - Resource cleanup with proper awaiting
 * - Race condition prevention
 */

import { spawn, ChildProcess } from "child_process";
import { vi } from "vitest";

export interface ServerConfig {
  port: number;
  timeout: number;
  maxAttempts: number;
  checkInterval: number;
  baseUrl?: string;
  env?: Record<string, string>;
}

export interface ServerStartupResult {
  process: ChildProcess;
  isReady: boolean;
  url: string;
  cleanup: () => Promise<void>;
}

/**
 * Robust server startup with proper promise rejection
 * FIXES: "promise resolved undefined instead of rejecting"
 */
export async function startTestServer(config: ServerConfig): Promise<ServerStartupResult> {
  const { port, timeout, maxAttempts, checkInterval, env = {} } = config;
  const baseUrl = config.baseUrl || `http://localhost:${port}`;

  return new Promise<ServerStartupResult>((resolve, reject) => {
    const serverProcess = spawn("bun", ["run", "dev"], {
      env: { 
        ...process.env, 
        ...env,
        PORT: port.toString(),
        NODE_ENV: "test"
      },
      stdio: "pipe"
    });

    let isResolved = false;
    let attempts = 0;
    let checkInterval_: NodeJS.Timeout | null = null;
    let timeout_: NodeJS.Timeout | null = null;

    // Setup cleanup function
    const cleanup = async (): Promise<void> => {
      if (checkInterval_) clearInterval(checkInterval_);
      if (timeout_) clearTimeout(timeout_);
      
      if (serverProcess && !serverProcess.killed) {
        return new Promise<void>((resolveCleanup) => {
          serverProcess.kill("SIGTERM");
          
          // Force kill after 3 seconds if not terminated
          const forceKillTimeout = setTimeout(() => {
            if (!serverProcess.killed) {
              serverProcess.kill("SIGKILL");
            }
            resolveCleanup();
          }, 3000);

          serverProcess.on('exit', () => {
            clearTimeout(forceKillTimeout);
            resolveCleanup();
          });
        });
      }
    };

    // Handle server process errors
    serverProcess.on('error', (error) => {
      if (!isResolved) {
        isResolved = true;
        cleanup().finally(() => {
          reject(new Error(`Server process failed to start: ${error.message}`));
        });
      }
    });

    serverProcess.on('exit', (code, signal) => {
      if (!isResolved && code !== 0) {
        isResolved = true;
        cleanup().finally(() => {
          reject(new Error(`Server exited unexpectedly with code ${code}, signal ${signal}`));
        });
      }
    });

    // Set overall timeout
    timeout_ = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        cleanup().finally(() => {
          reject(new Error(`Server startup timeout after ${timeout}ms`));
        });
      }
    }, timeout);

    // Check server readiness
    const checkReady = async () => {
      if (isResolved) return;
      
      attempts++;
      
      try {
        const response = await fetch(`${baseUrl}/api/health`, {
          signal: AbortSignal.timeout(2000) // 2 second timeout per check
        });
        
        if (response.ok) {
          if (!isResolved) {
            isResolved = true;
            if (checkInterval_) clearInterval(checkInterval_);
            if (timeout_) clearTimeout(timeout_);
            
            resolve({
              process: serverProcess,
              isReady: true,
              url: baseUrl,
              cleanup
            });
          }
        } else if (attempts >= maxAttempts) {
          if (!isResolved) {
            isResolved = true;
            cleanup().finally(() => {
              reject(new Error(`Server health check failed after ${maxAttempts} attempts. Last status: ${response.status}`));
            });
          }
        }
      } catch (error) {
        if (attempts >= maxAttempts) {
          if (!isResolved) {
            isResolved = true;
            cleanup().finally(() => {
              reject(new Error(`Server health check failed after ${maxAttempts} attempts: ${error instanceof Error ? error.message : String(error)}`));
            });
          }
        }
      }
    };

    // Start checking after initial delay
    setTimeout(() => {
      if (!isResolved) {
        checkInterval_ = setInterval(checkReady, checkInterval);
        checkReady(); // Check immediately too
      }
    }, 2000); // 2 second initial delay
  });
}

/**
 * Utility for tests that need proper async validation
 * FIXES: Incorrect expect(...).not.toThrow() patterns on async functions
 */
export async function expectAsyncNotToThrow<T>(asyncFn: () => Promise<T>): Promise<T> {
  try {
    return await asyncFn();
  } catch (error) {
    throw new Error(`Expected async function not to throw, but it threw: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Utility for proper async error expectations
 */
export async function expectAsyncToThrow<T>(asyncFn: () => Promise<T>, expectedError?: string | RegExp): Promise<void> {
  try {
    await asyncFn();
    throw new Error('Expected async function to throw, but it did not');
  } catch (error) {
    if (error instanceof Error && error.message.includes('Expected async function to throw')) {
      throw error;
    }
    
    if (expectedError) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (typeof expectedError === 'string') {
        if (!errorMessage.includes(expectedError)) {
          throw new Error(`Expected error to contain "${expectedError}", but got: ${errorMessage}`);
        }
      } else if (expectedError instanceof RegExp) {
        if (!expectedError.test(errorMessage)) {
          throw new Error(`Expected error to match ${expectedError}, but got: ${errorMessage}`);
        }
      }
    }
  }
}

/**
 * Utility for waiting with cancellation support
 * FIXES: Timeout issues in tests
 */
export function waitWithTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage?: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}

/**
 * Utility for retrying async operations with exponential backoff
 */
export async function retryAsync<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  backoffMultiplier: number = 2
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(backoffMultiplier, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Create proper mock functions that handle promises correctly
 * FIXES: Mock function promise resolution issues
 */
export function createAsyncMock<T = any>(resolveValue?: T, shouldReject: boolean = false): ReturnType<typeof vi.fn> {
  return vi.fn(() => {
    if (shouldReject) {
      return Promise.reject(resolveValue || new Error('Mock rejection'));
    }
    return Promise.resolve(resolveValue);
  });
}

/**
 * Utility for proper test cleanup with timeout
 */
export async function cleanupWithTimeout(cleanupFn: () => Promise<void>, timeoutMs: number = 5000): Promise<void> {
  return waitWithTimeout(cleanupFn(), timeoutMs, `Cleanup timed out after ${timeoutMs}ms`);
}

/**
 * Utility for handling fetch operations with proper error handling
 */
export async function safeFetch(url: string, options?: RequestInit, timeoutMs: number = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Fetch timeout after ${timeoutMs}ms for URL: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Utility for creating deterministic delays in tests
 */
export function createTestDelay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}