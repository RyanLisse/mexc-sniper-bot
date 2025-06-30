/**
 * Simplified Vitest Setup Configuration
 *
 * Consolidated setup for all Vitest tests including:
 * - Essential mock configurations
 * - Environment setup
 * - Clean test utilities
 * - Simplified database mocks
 */

import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import React from 'react';

// Make React globally available for JSX
global.React = React;

// Mock React hooks for testing with proper useState implementation
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useState: vi.fn((initial) => {
      const state = { current: initial };
      const setState = vi.fn((newValue) => {
        if (typeof newValue === 'function') {
          state.current = newValue(state.current);
        } else {
          state.current = newValue;
        }
      });
      return [state.current, setState];
    }),
    useEffect: vi.fn((fn, deps) => fn()),
    useCallback: vi.fn((fn) => fn),
    useMemo: vi.fn((fn) => fn()),
    useRef: vi.fn(() => ({ current: null })),
    useContext: vi.fn(() => ({})),
    useReducer: vi.fn((reducer, initial) => [initial, vi.fn()]),
  };
});

// Import simplified components
import { initializeSimplifiedMocks } from './simplified-mocks';
import { initializeTestUtilities } from './test-utilities';

// Simplified global test configuration
declare global {
  var __TEST_ENV__: boolean;
  var __TEST_START_TIME__: number;
  var mockDataStore: {
    [tableName: string]: any[];
    reset(): void;
    addRecord(tableName: string, record: any): any;
    findRecords(tableName: string, condition: (record: any) => boolean): any[];
  };
  var testUtils: {
    createTestUser: (overrides?: Record<string, any>) => any;
    createTestApiCredentials: (overrides?: Record<string, any>) => any;
    waitFor: (ms: number) => Promise<void>;
    generateTestId: () => string;
    mockApiResponse: (data: any, status?: number, customHeaders?: Record<string, string>) => any;
  };
}

// Initialize simplified global configuration
globalThis.__TEST_ENV__ = true;
globalThis.__TEST_START_TIME__ = Date.now();

// Fix EventEmitter memory leak warnings by increasing max listeners
if (process.setMaxListeners) {
  process.setMaxListeners(50);
}

// Fix potential worker thread issues
if (global.Worker) {
  // Mock Worker to avoid worker thread errors
  global.Worker = vi.fn().mockImplementation(() => ({
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onerror: null,
    onmessage: null,
    onmessageerror: null,
  })) as any;
}

// Mock MessagePort to fix port.addListener errors
if (global.MessagePort) {
  global.MessagePort = vi.fn().mockImplementation(() => ({
    postMessage: vi.fn(),
    start: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onmessage: null,
    onmessageerror: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
  })) as any;
}

// ============================================================================
// Simplified Test Setup and Teardown
// ============================================================================

// Simplified global setup
beforeAll(async () => {
  if (process.env.VERBOSE_TESTS === 'true') {
    console.log('🧪 Setting up simplified Vitest environment...');
  }
  
  // Detect test type
  const isIntegrationTest = process.env.USE_REAL_DATABASE === 'true' ||
                           process.argv.join(' ').includes('integration') ||
                           process.env.npm_command === 'test:integration';
  
  // Configure environment
  if (!isIntegrationTest) {
    process.env.FORCE_MOCK_DB = 'true';
    process.env.SKIP_DB_CONNECTION = 'true';
  }

  // Ensure encryption key is available for tests
  if (!process.env.ENCRYPTION_MASTER_KEY) {
    process.env.ENCRYPTION_MASTER_KEY = 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcwo=';
  }

  // Mock critical service dependencies that may fail initialization
  vi.mock('@/src/services/api/secure-encryption-service', () => ({
    getEncryptionService: vi.fn(() => ({
      encrypt: vi.fn((data: string) => `encrypted_${data}`),
      decrypt: vi.fn((data: string) => data.replace('encrypted_', '')),
      isValidEncryptedFormat: vi.fn(() => true),
    })),
    SecureEncryptionService: vi.fn().mockImplementation(() => ({
      encrypt: vi.fn((data: string) => `encrypted_${data}`),
      decrypt: vi.fn((data: string) => data.replace('encrypted_', '')),
      isValidEncryptedFormat: vi.fn(() => true),
    })),
  }));

  // Mock database operations that may fail in test environment - STRONG MOCK
  vi.mock('@/src/db', () => {
    const mockQueryBuilder = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(), 
      limit: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      then: vi.fn().mockResolvedValue([]),
    };
    
    return {
      db: {
        select: vi.fn().mockReturnValue(mockQueryBuilder),
        insert: vi.fn().mockReturnValue(mockQueryBuilder), 
        delete: vi.fn().mockReturnValue(mockQueryBuilder),
        update: vi.fn().mockReturnValue(mockQueryBuilder),
      },
      user: {
        id: vi.fn(),
        email: vi.fn(),
        name: vi.fn(),
        createdAt: vi.fn(),
        updatedAt: vi.fn(),
      },
      apiCredentials: {
        id: vi.fn(),
        userId: vi.fn(),
        provider: vi.fn(),
        encryptedApiKey: vi.fn(),
        encryptedSecretKey: vi.fn(),
        isActive: vi.fn(),
        createdAt: vi.fn(),
        updatedAt: vi.fn(),
      },
      clearDbCache: vi.fn(),
      getDbClient: vi.fn().mockReturnValue({
        query: vi.fn().mockResolvedValue({ rows: [] }),
      }),
      getDb: vi.fn().mockReturnValue({
        query: vi.fn().mockResolvedValue({ rows: [] }),
        select: vi.fn().mockReturnValue(mockQueryBuilder),
        insert: vi.fn().mockReturnValue(mockQueryBuilder),
        delete: vi.fn().mockReturnValue(mockQueryBuilder),
        update: vi.fn().mockReturnValue(mockQueryBuilder),
      }),
      hasSupabaseConfig: vi.fn().mockReturnValue(true),
      executeWithRetry: vi.fn().mockImplementation(async (fn) => await fn()),
      withTransaction: vi.fn().mockImplementation(async (fn) => await fn(mockQueryBuilder)),
    };
  });

  // DISABLED: Problematic Zod mock causing schema validation failures
  // The mock was breaking z.string().default() chains, causing test failures
  // Real Zod library works correctly for validation tests
  // vi.mock('zod', () => { ... });

  // Mock drizzle ORM to prevent real database connections
  vi.mock('drizzle-orm/postgres-js', () => ({
    drizzle: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        having: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
        then: vi.fn().mockImplementation((resolve) => Promise.resolve([]).then(resolve)),
      }),
      insert: vi.fn().mockReturnValue({
        into: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        onConflictDoNothing: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockReturnThis(),
        returning: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
      }),
      update: vi.fn().mockReturnValue({
        table: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
      }),
      delete: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue([]),
      }),
      transaction: vi.fn().mockImplementation(async (cb) => {
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([]),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([]),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([]),
          }),
          delete: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue([]),
          }),
        };
        return await cb(tx);
      }),
    })),
  }));

  // Mock postgres connection
  vi.mock('postgres', () => {
    const mockConnection = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      end: vi.fn().mockResolvedValue(undefined),
      begin: vi.fn().mockImplementation(async (cb) => {
        const tx = {
          query: vi.fn().mockResolvedValue({ rows: [] }),
          savepoint: vi.fn().mockResolvedValue(undefined),
          release: vi.fn().mockResolvedValue(undefined),
          rollback: vi.fn().mockResolvedValue(undefined),
        };
        if (cb) {
          return await cb(tx);
        }
        return tx;
      }),
      listen: vi.fn(),
      notify: vi.fn(),
      unlisten: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    
    return {
      default: vi.fn(() => mockConnection),
      postgres: vi.fn(() => mockConnection),
    };
  });

  // Mock Supabase to prevent multiple client instances
  vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
      auth: {
        getSession: vi.fn().mockResolvedValue({ 
          data: { session: null }, 
          error: null 
        }),
        getUser: vi.fn().mockResolvedValue({ 
          data: { user: null }, 
          error: null 
        }),
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: { message: 'Test environment - authentication disabled' }
        }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        onAuthStateChange: vi.fn(() => ({ 
          data: { subscription: { unsubscribe: vi.fn() } }
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
      realtime: {
        channel: vi.fn(() => ({
          on: vi.fn().mockReturnThis(),
          subscribe: vi.fn().mockReturnThis(),
          unsubscribe: vi.fn(),
        })),
      },
    })),
  }));

  // Mock Next.js cookies for Supabase
  vi.mock('next/headers', () => ({
    cookies: vi.fn(() => ({
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    })),
  }));

  // Initialize mocks and utilities
  try {
    await initializeSimplifiedMocks(isIntegrationTest);
    initializeTestUtilities();
  } catch (error) {
    console.warn('Warning: Failed to initialize some mocks:', error.message);
  }

  if (process.env.VERBOSE_TESTS === 'true') {
    console.log('✅ Simplified test setup completed');
  }
});

// Simple cleanup after each test
afterEach(() => {
  // Essential cleanup only
  vi.clearAllMocks();

  if (global.mockDataStore && global.mockDataStore.reset) {
    global.mockDataStore.reset();
  }
});

// Simple global cleanup
afterAll(() => {
  if (process.env.VERBOSE_TESTS === 'true') {
    const testDuration = Date.now() - globalThis.__TEST_START_TIME__;
    console.log(`✅ Test cleanup completed (${testDuration}ms)`);
  }

  vi.restoreAllMocks();
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

// ============================================================================
// Simplified Error Handling
// ============================================================================

// Basic error handling for tests
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection in test:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception in test:', error);
});

if (process.env.VERBOSE_TESTS === 'true') {
  console.log('🚀 Simplified Vitest setup completed');
}

