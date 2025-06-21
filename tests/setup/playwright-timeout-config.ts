/**
 * Playwright Timeout Configuration for E2E Tests
 * 
 * Enhanced timeout management for Playwright E2E tests to prevent hanging
 * tests and ensure CI/CD pipeline reliability.
 */

import type { PlaywrightTestConfig } from '@playwright/test';

/**
 * E2E Test Timeout Configuration
 */
export const E2E_TIMEOUTS = {
  // Test timeouts (per test)
  TEST_TIMEOUT: parseInt(process.env.TEST_TIMEOUT_E2E || '120000', 10), // 2 minutes
  
  // Navigation timeouts
  NAVIGATION_TIMEOUT: 30000, // 30 seconds for page navigation
  
  // Action timeouts
  ACTION_TIMEOUT: 10000, // 10 seconds for user actions
  
  // Assertion timeouts
  ASSERTION_TIMEOUT: 5000, // 5 seconds for expect assertions
  
  // Global setup/teardown timeouts
  GLOBAL_SETUP_TIMEOUT: 60000, // 1 minute for global setup
  GLOBAL_TEARDOWN_TIMEOUT: 30000, // 30 seconds for global teardown
  
  // Specific operation timeouts
  AUTH_FLOW_TIMEOUT: 45000, // 45 seconds for authentication flows
  DASHBOARD_LOAD_TIMEOUT: 20000, // 20 seconds for dashboard loading
  API_RESPONSE_TIMEOUT: 15000, // 15 seconds for API responses
  STAGEHAND_OPERATION_TIMEOUT: 60000, // 1 minute for Stagehand AI operations
  
  // Browser timeouts
  BROWSER_LAUNCH_TIMEOUT: 30000, // 30 seconds for browser launch
  PAGE_LOAD_TIMEOUT: 30000, // 30 seconds for page load
};

/**
 * Get timeout configuration for different E2E test categories
 */
export function getE2ETimeout(category: 'auth' | 'dashboard' | 'api' | 'stagehand' | 'standard'): number {
  switch (category) {
    case 'auth':
      return E2E_TIMEOUTS.AUTH_FLOW_TIMEOUT;
    case 'dashboard':
      return E2E_TIMEOUTS.DASHBOARD_LOAD_TIMEOUT;
    case 'api':
      return E2E_TIMEOUTS.API_RESPONSE_TIMEOUT;
    case 'stagehand':
      return E2E_TIMEOUTS.STAGEHAND_OPERATION_TIMEOUT;
    case 'standard':
    default:
      return E2E_TIMEOUTS.TEST_TIMEOUT;
  }
}

/**
 * Enhanced Playwright configuration with comprehensive timeout settings
 */
export const playwrightTimeoutConfig: Partial<PlaywrightTestConfig> = {
  // Global test timeout
  timeout: E2E_TIMEOUTS.TEST_TIMEOUT,
  
  // Global setup/teardown timeouts
  globalTimeout: E2E_TIMEOUTS.GLOBAL_SETUP_TIMEOUT + E2E_TIMEOUTS.GLOBAL_TEARDOWN_TIMEOUT,
  
  // Browser and page timeouts
  use: {
    // Navigation timeout
    navigationTimeout: E2E_TIMEOUTS.NAVIGATION_TIMEOUT,
    
    // Action timeout (click, fill, etc.)
    actionTimeout: E2E_TIMEOUTS.ACTION_TIMEOUT,
  },
  
  // Expect assertion timeout
  expect: {
    timeout: E2E_TIMEOUTS.ASSERTION_TIMEOUT,
  },
  
  // Projects configuration can override these timeouts per browser
  projects: [
    {
      name: 'chromium',
      use: {
        navigationTimeout: E2E_TIMEOUTS.NAVIGATION_TIMEOUT,
        actionTimeout: E2E_TIMEOUTS.ACTION_TIMEOUT,
      },
    },
    {
      name: 'firefox',
      use: {
        // Firefox might need longer timeouts
        navigationTimeout: E2E_TIMEOUTS.NAVIGATION_TIMEOUT + 10000,
        actionTimeout: E2E_TIMEOUTS.ACTION_TIMEOUT + 5000,
      },
    },
  ],
};

/**
 * Timeout wrapper for Playwright test operations
 */
export async function withPlaywrightTimeout<T>(
  operation: () => Promise<T>,
  timeout: number,
  description: string
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`E2E ${description} timed out after ${timeout}ms`));
      }, timeout);
    })
  ]);
}

/**
 * Retry wrapper for flaky E2E operations
 */
export async function withE2ERetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    timeout?: number;
    retryDelay?: number;
    description?: string;
  } = {}
): Promise<T> {
  const maxRetries = options.maxRetries || 3;
  const timeout = options.timeout || E2E_TIMEOUTS.TEST_TIMEOUT;
  const retryDelay = options.retryDelay || 2000;
  const description = options.description || 'E2E operation';
  
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await withPlaywrightTimeout(operation, timeout, `${description} (attempt ${attempt})`);
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw new Error(`${description} failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  throw lastError!;
}

/**
 * Page load timeout wrapper
 */
export async function withPageLoadTimeout(
  page: any,
  url: string,
  timeout: number = E2E_TIMEOUTS.PAGE_LOAD_TIMEOUT
): Promise<void> {
  return withPlaywrightTimeout(
    () => page.goto(url, { waitUntil: 'networkidle' }),
    timeout,
    `page load for ${url}`
  );
}

/**
 * Authentication flow timeout wrapper
 */
export async function withAuthTimeout<T>(
  operation: () => Promise<T>,
  timeout: number = E2E_TIMEOUTS.AUTH_FLOW_TIMEOUT
): Promise<T> {
  return withPlaywrightTimeout(operation, timeout, 'authentication flow');
}

/**
 * Stagehand operation timeout wrapper
 */
export async function withStagehandTimeout<T>(
  operation: () => Promise<T>,
  timeout: number = E2E_TIMEOUTS.STAGEHAND_OPERATION_TIMEOUT
): Promise<T> {
  return withPlaywrightTimeout(operation, timeout, 'Stagehand AI operation');
}

/**
 * API response timeout wrapper for E2E tests
 */
export async function withE2EApiTimeout<T>(
  operation: () => Promise<T>,
  timeout: number = E2E_TIMEOUTS.API_RESPONSE_TIMEOUT
): Promise<T> {
  return withPlaywrightTimeout(operation, timeout, 'API response');
}

/**
 * Dashboard load timeout wrapper
 */
export async function withDashboardTimeout<T>(
  operation: () => Promise<T>,
  timeout: number = E2E_TIMEOUTS.DASHBOARD_LOAD_TIMEOUT
): Promise<T> {
  return withPlaywrightTimeout(operation, timeout, 'dashboard load');
}

/**
 * Configure test timeouts based on test file patterns
 */
export function configureTestTimeout(testFilePath: string): number {
  if (testFilePath.includes('auth')) {
    return E2E_TIMEOUTS.AUTH_FLOW_TIMEOUT;
  }
  
  if (testFilePath.includes('dashboard')) {
    return E2E_TIMEOUTS.DASHBOARD_LOAD_TIMEOUT;
  }
  
  if (testFilePath.includes('stagehand')) {
    return E2E_TIMEOUTS.STAGEHAND_OPERATION_TIMEOUT;
  }
  
  if (testFilePath.includes('api')) {
    return E2E_TIMEOUTS.API_RESPONSE_TIMEOUT;
  }
  
  return E2E_TIMEOUTS.TEST_TIMEOUT;
}

/**
 * Enhanced error reporting for timeout failures
 */
export function createTimeoutError(operation: string, timeout: number, additionalInfo?: string): Error {
  let message = `E2E ${operation} timed out after ${timeout}ms`;
  
  if (additionalInfo) {
    message += `\nAdditional info: ${additionalInfo}`;
  }
  
  message += '\n\nTroubleshooting tips:';
  message += '\n- Check if the application is running on the expected port';
  message += '\n- Verify network connectivity';
  message += '\n- Check browser console for errors';
  message += '\n- Ensure test data is properly set up';
  
  const error = new Error(message);
  error.name = 'E2ETimeoutError';
  return error;
}

/**
 * Timeout operation tracking interface
 */
interface TimeoutOperation {
  name: string;
  duration: number;
  timestamp: number;
}

/**
 * Monitor E2E test performance and report slow operations
 */
export class E2EPerformanceMonitor {
  private startTime: number = Date.now();
  private operations: TimeoutOperation[] = [];
  
  markOperation(name: string): void {
    const now = Date.now();
    const duration = now - this.startTime;
    this.operations.push({ name, duration, timestamp: now });
    
    // Log slow operations (>70% of expected timeout)
    const expectedTimeout = this.getExpectedTimeout(name);
    if (duration > expectedTimeout * 0.7) {
      console.warn(`⚠️ Slow E2E operation: ${name} took ${duration}ms (expected <${expectedTimeout}ms)`);
    }
    
    this.startTime = now;
  }
  
  private getExpectedTimeout(this: E2EPerformanceMonitor, operationName: string): number {
    if (operationName.includes('auth')) return E2E_TIMEOUTS.AUTH_FLOW_TIMEOUT;
    if (operationName.includes('dashboard')) return E2E_TIMEOUTS.DASHBOARD_LOAD_TIMEOUT;
    if (operationName.includes('stagehand')) return E2E_TIMEOUTS.STAGEHAND_OPERATION_TIMEOUT;
    if (operationName.includes('api')) return E2E_TIMEOUTS.API_RESPONSE_TIMEOUT;
    return E2E_TIMEOUTS.ACTION_TIMEOUT;
  }
  
  getReport(): { totalDuration: number; operations: TimeoutOperation[]; slowOperations: TimeoutOperation[] } {
    const totalDuration = this.operations.reduce((sum, op) => sum + op.duration, 0);
    const slowOperations = this.operations.filter(op => 
      op.duration > this.getExpectedTimeout(op.name) * 0.7
    );
    
    return { totalDuration, operations: this.operations, slowOperations };
  }
  
  reset(): void {
    this.startTime = Date.now();
    this.operations = [];
  }
}