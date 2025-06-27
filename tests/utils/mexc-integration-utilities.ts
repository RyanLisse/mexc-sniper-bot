/**
 * MEXC Integration Test Utilities
 * 
 * Provides standardized MEXC service mocking and configuration
 * for integration tests to ensure consistent behavior and prevent
 * synchronization issues between test files.
 */

import { vi, type MockedFunction } from 'vitest';
import type { UnifiedMexcServiceV2 } from '@/src/services/api/unified-mexc-service-v2';
import type { SymbolEntry, CalendarEntry } from '@/src/services/api/mexc-unified-exports';
import type { ActivityData } from '@/src/schemas/unified/mexc-api-schemas';

// ============================================================================
// Environment Configuration
// ============================================================================

/**
 * Standardized MEXC environment variable configuration for tests
 */
export function configureMexcTestEnvironment(): void {
  // Set consistent test environment variables
  process.env.MEXC_API_KEY = 'mx_test_api_key_123456789abcdef';
  process.env.MEXC_SECRET_KEY = 'test_secret_key_123456789abcdef';
  process.env.MEXC_BASE_URL = 'https://api.mexc.com';
  process.env.MEXC_RATE_LIMIT = '1200'; // requests per minute
  process.env.MEXC_TIMEOUT = '30000'; // 30 seconds
  // NODE_ENV is read-only in test environment, skip setting it
  if (!process.env.NODE_ENV) {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'test',
      writable: false,
      enumerable: true,
      configurable: true
    });
  }
}

/**
 * Clean up MEXC environment variables after tests
 */
export function cleanupMexcTestEnvironment(): void {
  delete process.env.MEXC_API_KEY;
  delete process.env.MEXC_SECRET_KEY;
  delete process.env.MEXC_BASE_URL;
  delete process.env.MEXC_RATE_LIMIT;
  delete process.env.MEXC_TIMEOUT;
}

// ============================================================================
// Mock Data Generators
// ============================================================================

/**
 * Generate standardized mock symbol data for tests
 */
export function createMockSymbolEntry(overrides: Partial<SymbolEntry> = {}): SymbolEntry {
  return {
    sts: 2,
    st: 2,
    tt: 4,
    cd: 'TESTUSDT',
    ca: "0x1000",
    ps: 100,
    qs: 50,
    ...overrides
  };
}

/**
 * Generate standardized mock calendar entry for tests
 */
export function createMockCalendarEntry(overrides: Partial<CalendarEntry> = {}): CalendarEntry {
  return {
    symbol: 'TESTUSDT',
    vcoinId: 'test-vcoin-id',
    firstOpenTime: Date.now() + (3 * 60 * 60 * 1000), // 3 hours from now
    projectName: 'Test Project',
    ...overrides
  };
}

/**
 * Generate standardized mock activity data for tests
 */
export function createMockActivityData(overrides: Partial<ActivityData> = {}): ActivityData {
  return {
    activityId: 'test-activity-123',
    currency: 'TEST',
    currencyId: 'test-currency-id',
    activityType: 'SUN_SHINE',
    ...overrides
  };
}

// ============================================================================
// MEXC Service Mock Factory
// ============================================================================

// Type for vitest mocked service
type MockedMexcService = {
  [K in keyof UnifiedMexcServiceV2]: MockedFunction<UnifiedMexcServiceV2[K]>;
};

/**
 * Create a standardized mock MEXC service instance
 */
export function createMockMexcService(): MockedMexcService {
  return {
    // Market Data Methods
    getSymbolData: vi.fn().mockResolvedValue({
      success: true,
      data: {
        symbol: 'TESTUSDT',
        lastPrice: '1.0000',
        price: '1.0000',
        priceChange: '0.0001',
        priceChangePercent: '1.5',
        volume: '1000000',
        quoteVolume: '1000000',
        openPrice: '0.9999',
        highPrice: '1.0005',
        lowPrice: '0.9995',
        count: '5000'
      },
      timestamp: Date.now(),
      executionTimeMs: 100
    }),

    getTicker: vi.fn().mockResolvedValue({
      success: true,
      data: {
        symbol: 'TESTUSDT',
        lastPrice: '1.0000',
        price: '1.0000',
        priceChange: '0.0001',
        priceChangePercent: '1.5',
        volume: '1000000',
        quoteVolume: '1000000',
        openPrice: '0.9999',
        highPrice: '1.0005',
        lowPrice: '0.9995',
        count: '5000'
      },
      timestamp: Date.now(),
      executionTimeMs: 150
    }),

    getServerTime: vi.fn().mockResolvedValue({
      success: true,
      data: Date.now(),
      timestamp: Date.now(),
      executionTimeMs: 50
    }),

    // Activity Methods
    getActivityData: vi.fn().mockResolvedValue({
      success: true,
      data: [createMockActivityData()],
      timestamp: Date.now(),
      executionTimeMs: 200
    }),

    hasRecentActivity: vi.fn().mockResolvedValue(true),

    // Trading Methods
    placeOrder: vi.fn().mockResolvedValue({
      success: true,
      data: {
        orderId: `order-${Date.now()}`,
        symbol: 'TESTUSDT',
        status: 'FILLED',
        price: '1.0000',
        quantity: '1000'
      },
      timestamp: Date.now(),
      executionTimeMs: 250
    }),

    // Calendar Methods
    getCalendarListings: vi.fn().mockResolvedValue({
      success: true,
      data: [createMockCalendarEntry()],
      timestamp: Date.now(),
      executionTimeMs: 300
    }),

    // Account Methods
    getAccountInfo: vi.fn().mockResolvedValue({
      success: true,
      data: {
        balances: [
          { asset: 'USDT', free: '10000.00', locked: '0.00' },
          { asset: 'BTC', free: '0.1', locked: '0.0' }
        ]
      },
      timestamp: Date.now(),
      executionTimeMs: 180
    }),

    // Health and Status
    testConnectivity: vi.fn().mockResolvedValue({
      success: true,
      data: { status: 'OK', timestamp: Date.now() },
      timestamp: Date.now(),
      executionTimeMs: 75
    }),

    // Cache Management
    clearCache: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockImplementation(() => {})
  } as any;
}

// ============================================================================
// Timing and Synchronization Utilities
// ============================================================================

/**
 * Wait for MEXC service operations to complete
 */
export async function waitForMexcOperation(timeoutMs: number = 2000): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, Math.min(timeoutMs, 100)));
}

/**
 * Ensure all MEXC service mocks are properly reset
 */
export function resetMexcServiceMocks(mexcService: MockedMexcService): void {
  Object.values(mexcService).forEach(method => {
    if (typeof method === 'function' && 'mockClear' in method) {
      (method as MockedFunction<any>).mockClear();
    }
  });
}

// ============================================================================
// Error Simulation Utilities
// ============================================================================

/**
 * Configure MEXC service to simulate API failures for testing error handling
 */
export function simulateMexcApiFailures(
  mexcService: MockedMexcService,
  failureCount: number = 2
): void {
  let callCount = 0;

  // Mock getSymbolData to fail initially then succeed
  mexcService.getSymbolData.mockImplementation(async () => {
    callCount++;
    if (callCount <= failureCount) {
      throw new Error('MEXC API temporarily unavailable');
    }
    return {
      success: true,
      data: {
        symbol: 'TESTUSDT',
        lastPrice: '1.0000',
        price: '1.0000',
        priceChange: '0.0001',
        priceChangePercent: '1.5',
        volume: '1000000',
        quoteVolume: '1000000',
        openPrice: '0.9999',
        highPrice: '1.0005',
        lowPrice: '0.9995',
        count: '5000'
      },
      timestamp: Date.now(),
      executionTimeMs: 150
    };
  });
}

/**
 * Configure MEXC service to simulate network timeout
 */
export function simulateMexcNetworkTimeout(
  mexcService: MockedMexcService,
  timeoutMs: number = 5000
): void {
  mexcService.testConnectivity.mockImplementation(async () => {
    await new Promise(resolve => setTimeout(resolve, timeoutMs));
    throw new Error('Network timeout');
  });
}

// ============================================================================
// Integration Test Setup and Teardown
// ============================================================================

/**
 * Complete setup for MEXC integration tests
 */
export function setupMexcIntegrationTest(): {
  mexcService: MockedMexcService;
  cleanup: () => void;
} {
  // Configure environment
  configureMexcTestEnvironment();

  // Create mock service
  const mexcService = createMockMexcService();

  // Setup cleanup function
  const cleanup = () => {
    resetMexcServiceMocks(mexcService);
    cleanupMexcTestEnvironment();
    vi.clearAllMocks();
  };

  return { mexcService, cleanup };
}

/**
 * Standardized teardown for MEXC integration tests
 */
export function teardownMexcIntegrationTest(mexcService?: MockedMexcService): void {
  if (mexcService) {
    resetMexcServiceMocks(mexcService);
  }
  cleanupMexcTestEnvironment();
  vi.clearAllMocks();
}

// ============================================================================
// Performance Testing Utilities
// ============================================================================

/**
 * Measure MEXC service operation performance
 */
export async function measureMexcPerformance<T>(
  operation: () => Promise<T>,
  label: string = 'MEXC Operation'
): Promise<{ result: T; executionTime: number }> {
  const startTime = performance.now();
  const result = await operation();
  const executionTime = performance.now() - startTime;
  
  console.log(`${label} completed in ${executionTime.toFixed(2)}ms`);
  
  return { result, executionTime };
}

/**
 * Validate MEXC service performance meets requirements
 */
export function validateMexcPerformance(
  executionTime: number,
  maxAllowedTime: number,
  operation: string
): void {
  if (executionTime > maxAllowedTime) {
    console.warn(`${operation} took ${executionTime.toFixed(2)}ms, exceeding ${maxAllowedTime}ms limit`);
  } else {
    console.log(`${operation} performance OK: ${executionTime.toFixed(2)}ms`);
  }
}