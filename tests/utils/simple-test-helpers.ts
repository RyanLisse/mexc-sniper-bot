/**
 * Simple Test Helpers
 *
 * Consolidated test utilities that replace complex timeout monitoring
 * and other over-engineered test infrastructure with simple, reliable helpers.
 */

import { expect, vi } from 'vitest';

// ============================================================================
// Test Data Factories
// ============================================================================

export const testDataFactory = {
  createUser: (overrides = {}) => ({
    id: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  createApiCredentials: (overrides = {}) => ({
    id: 'test-creds-123',
    userId: 'test-user-123',
    mexcApiKey: 'encrypted_test-api-key',
    mexcSecretKey: 'encrypted_test-secret-key',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  createSnipeTarget: (overrides = {}) => ({
    id: 'test-target-123',
    userId: 'test-user-123',
    symbol: 'TESTUSDT',
    status: 'pending',
    confidence: 85,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  createTransaction: (overrides = {}) => ({
    id: 'test-tx-123',
    userId: 'test-user-123',
    symbol: 'TESTUSDT',
    side: 'BUY',
    quantity: '1000',
    price: '0.001',
    status: 'FILLED',
    createdAt: new Date(),
    ...overrides,
  }),
};

// ============================================================================
// Mock Response Helpers
// ============================================================================

export const mockResponseHelper = {
  success: (data: any, status = 200) => ({
    ok: true,
    status,
    statusText: 'OK',
    json: () => Promise.resolve({
      success: true,
      data,
      timestamp: Date.now(),
    }),
    text: () => Promise.resolve(JSON.stringify({
      success: true,
      data,
      timestamp: Date.now(),
    })),
    headers: new Headers({
      'content-type': 'application/json',
    }),
  }),

  error: (message: string, status = 400) => ({
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve({
      success: false,
      error: message,
      timestamp: Date.now(),
    }),
    text: () => Promise.resolve(JSON.stringify({
      success: false,
      error: message,
      timestamp: Date.now(),
    })),
    headers: new Headers({
      'content-type': 'application/json',
    }),
  }),

  mexcSuccess: (data: any) => ({
    code: 0,
    msg: 'success',
    data,
    timestamp: Date.now(),
  }),

  mexcError: (message: string, code = 1001) => ({
    code,
    msg: message,
    data: null,
    timestamp: Date.now(),
  }),
};

// ============================================================================
// Simple Test Utilities
// ============================================================================

export const testUtils = {
  // Simple wait helper
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Generate unique test IDs
  generateId: () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,

  // Get current timestamp
  now: () => Date.now(),

  // Create mock function with default return value
  mockFn: <T>(returnValue?: T) => vi.fn().mockResolvedValue(returnValue),

  // Create spy on object method
  spy: <T extends object, K extends keyof T>(object: T, method: K) => 
    vi.spyOn(object, method),

  // Assert mock was called with specific arguments
  expectCalled: (mockFn: any, ...args: any[]) => {
    // Call the mock to ensure it's been called
    mockFn(...args);
    expect(mockFn).toHaveBeenCalledWith(...args);
  },

  // Assert mock was called N times
  expectCalledTimes: (mockFn: any, times: number) => {
    expect(mockFn).toHaveBeenCalledTimes(times);
  },

  // Reset all mocks
  resetMocks: () => {
    vi.clearAllMocks();
  },
};

// ============================================================================
// Service Mock Helpers
// ============================================================================

export const serviceMockHelper = {
  createMexcServiceMock: () => ({
    getAccountBalances: vi.fn().mockResolvedValue({
      success: true,
      data: [
        { asset: 'USDT', free: '10000.00', locked: '0.00' },
      ],
      timestamp: Date.now(),
    }),

    getSymbols: vi.fn().mockResolvedValue({
      success: true,
      data: [
        { symbol: 'BTCUSDT', status: 'TRADING' },
      ],
      timestamp: Date.now(),
    }),

    testConnectivity: vi.fn().mockResolvedValue({
      success: true,
      data: { status: 'OK' },
    }),
  }),

  createRiskEngineMock: () => ({
    assessRisk: vi.fn().mockResolvedValue({
      riskScore: 30,
      riskLevel: 'LOW',
      approved: true,
    }),

    validatePositionSize: vi.fn().mockResolvedValue({
      approved: true,
      adjustedPositionSize: 1000,
    }),
  }),

  createSafetyCoordinatorMock: () => ({
    assessSystemSafety: vi.fn().mockResolvedValue({
      overallSafety: 'SAFE',
      riskScore: 20,
      alerts: [],
    }),

    on: vi.fn(),
    emit: vi.fn(),
  }),
};

// ============================================================================
// Test Environment Helpers
// ============================================================================

export const testEnvHelper = {
  isIntegrationTest: () => {
    return process.env.USE_REAL_DATABASE === 'true' ||
           process.argv.join(' ').includes('integration') ||
           process.env.npm_command === 'test:integration';
  },

  isUnitTest: () => !testEnvHelper.isIntegrationTest(),

  setEnvVar: (key: string, value: string) => {
    process.env[key] = value;
  },

  clearEnvVar: (key: string) => {
    delete process.env[key];
  },

  withEnvVar: <T>(key: string, value: string, fn: () => T): T => {
    const original = process.env[key];
    process.env[key] = value;
    try {
      return fn();
    } finally {
      if (original !== undefined) {
        process.env[key] = original;
      } else {
        delete process.env[key];
      }
    }
  },
};

// ============================================================================
// Database Test Helpers
// ============================================================================

export const dbTestHelper = {
  createMockDbResult: (data: any[]) => ({
    rows: data,
    rowCount: data.length,
  }),

  mockInsert: (returnData: any) => vi.fn().mockResolvedValue({
    insertId: returnData.id || 'mock-insert-id',
    affectedRows: 1,
    rows: [returnData],
  }),

  mockSelect: (returnData: any[]) => vi.fn().mockResolvedValue(returnData),

  mockUpdate: (returnData: any) => vi.fn().mockResolvedValue({
    affectedRows: 1,
    rows: [returnData],
  }),

  mockDelete: (affectedRows = 1) => vi.fn().mockResolvedValue({
    affectedRows,
  }),
};