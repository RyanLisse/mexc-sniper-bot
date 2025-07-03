/**
 * Unified Mock System
 * 
 * Central mock system that replaces 4500+ lines of redundant mock configurations
 * across multiple test files. Provides consistent mocking for all external dependencies.
 */

import { vi } from 'vitest';

// ============================================================================
// Type Definitions
// ============================================================================

export interface MockConfiguration {
  enableDatabase?: boolean;
  enableAPI?: boolean;
  enableBrowser?: boolean;
  isIntegrationTest?: boolean;
}

export interface MockDataStore {
  reset(): void;
  addRecord(table: string, data: Record<string, any>): any;
  getTable(table: string): any[];
  removeRecord(table: string, id: string): void;
  updateRecord(table: string, id: string, data: Record<string, any>): void;
  clear(): void;
}

// ============================================================================
// Global Mock Data Store
// ============================================================================

class GlobalMockStore implements MockDataStore {
  private data: Map<string, any[]> = new Map();

  reset(): void {
    this.data.clear();
    this.seedDefaultData();
  }

  addRecord(table: string, data: Record<string, any>): any {
    if (!this.data.has(table)) {
      this.data.set(table, []);
    }
    const records = this.data.get(table)!;
    const record = { ...data, id: data.id || `mock-${Date.now()}-${Math.random()}` };
    records.push(record);
    return record;
  }

  getTable(table: string): any[] {
    return this.data.get(table) || [];
  }

  removeRecord(table: string, id: string): void {
    const records = this.data.get(table);
    if (records) {
      const index = records.findIndex(r => r.id === id);
      if (index >= 0) {
        records.splice(index, 1);
      }
    }
  }

  updateRecord(table: string, id: string, data: Record<string, any>): void {
    const records = this.data.get(table);
    if (records) {
      const index = records.findIndex(r => r.id === id);
      if (index >= 0) {
        records[index] = { ...records[index], ...data };
      }
    }
  }

  clear(): void {
    this.data.clear();
  }

  private seedDefaultData(): void {
    // Default test user
    this.addRecord('user', {
      id: 'test-user-123',
      email: 'test@example.com',
      name: 'Test User',
      supabaseId: 'supabase-test-user',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Default API credentials
    this.addRecord('apiCredentials', {
      id: 'test-creds-123',
      userId: 'test-user-123',
      mexcApiKey: 'encrypted_test-api-key',
      mexcSecretKey: 'encrypted_test-secret-key',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Default snipe target
    this.addRecord('snipeTargets', {
      id: 'test-target-123',
      symbol: 'TESTCOINUSDT',
      userId: 'test-user-123',
      strategy: 'aggressive',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
}

const globalMockStore = new GlobalMockStore();

// ============================================================================
// Mock System Initialization
// ============================================================================

export async function initializeUnifiedMocks(config: MockConfiguration = {}) {
  const {
    enableDatabase = true,
    enableAPI = true,
    enableBrowser = true,
    isIntegrationTest = false
  } = config;

  // Reset store
  globalMockStore.reset();

  // Make globally available
  global.mockDataStore = globalMockStore;

  // Database mocks
  if (enableDatabase && !isIntegrationTest) {
    mockDatabase();
  }

  // API mocks
  if (enableAPI) {
    mockAPIs();
  }

  // Browser mocks
  if (enableBrowser) {
    mockBrowserAPIs();
  }

  // Mock external services
  mockExternalServices();

  const cleanup = () => {
    globalMockStore.clear();
    vi.restoreAllMocks();
  };

  return {
    store: globalMockStore,
    cleanup
  };
}

// ============================================================================
// Database Mocking
// ============================================================================

function mockDatabase() {
  // Mock Drizzle ORM
  vi.mock('@/src/db', () => ({
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
          limit: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn().mockResolvedValue([])
        })
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'mock-id' }])
        })
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: 'mock-id' }])
        })
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 'mock-id' }])
        })
    },
    clearDbCache: vi.fn()
  }));

  // Mock Supabase
  vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null })
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null })
      }))
    }))
  }));
}

// ============================================================================
// API Mocking
// ============================================================================

function mockAPIs() {
  // Mock fetch
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: vi.fn().mockResolvedValue({}),
    text: vi.fn().mockResolvedValue(''),
    headers: new Headers()
  });

  // Mock MEXC API
  vi.mock('@/src/services/api/mexc-api-client', () => ({
    MexcApiClient: vi.fn(() => ({
      getAccountInfo: vi.fn().mockResolvedValue({ success: true, data: {} }),
      getExchangeInfo: vi.fn().mockResolvedValue({ success: true, data: {} }),
      getKlines: vi.fn().mockResolvedValue({ success: true, data: [] }),
      testConnectivity: vi.fn().mockResolvedValue({ success: true })
    }))
  }));

  // Mock OpenAI
  vi.mock('openai', () => ({
    default: vi.fn(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'Mock AI response' } }]
          })
        }
      }
    }))
  }));
}

// ============================================================================
// Browser API Mocking
// ============================================================================

function mockBrowserAPIs() {
  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn()
  };
  global.localStorage = localStorageMock;

  // Mock sessionStorage
  global.sessionStorage = localStorageMock;

  // Mock WebSocket
  global.WebSocket = vi.fn(() => ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1
  }));

  // Mock window location
  Object.defineProperty(window, 'location', {
    value: {
      href: 'http://localhost:3000',
      origin: 'http://localhost:3000',
      pathname: '/',
      search: '',
      hash: ''
    },
    writable: true
  });
}

// ============================================================================
// External Services Mocking
// ============================================================================

function mockExternalServices() {
  // Mock Next.js modules
  vi.mock('next/navigation', () => ({
    useRouter: vi.fn(() => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn()
    })),
    useSearchParams: vi.fn(() => ({
      get: vi.fn(),
      has: vi.fn()
    })),
    usePathname: vi.fn(() => '/'),
    notFound: vi.fn()
  }));

  vi.mock('next/headers', () => ({
    headers: vi.fn(() => new Headers()),
    cookies: vi.fn(() => ({
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn()
    }))
  }));

  // Mock React Toast
  vi.mock('@/src/hooks/use-toast', () => ({
    useToast: vi.fn(() => ({
      toast: vi.fn(),
      dismiss: vi.fn()
    }))
  }));

  // Mock React hooks
  vi.mock('react', async () => {
    const actual = await vi.importActual('react');
    return {
      ...actual,
      useState: vi.fn((initial) => [initial, vi.fn()]),
      useEffect: vi.fn((fn) => fn()),
      useMemo: vi.fn((fn) => fn()),
      useCallback: vi.fn((fn) => fn)
    };
  });
}

// ============================================================================
// Data Management Functions
// ============================================================================

export function getGlobalMockStore(): MockDataStore {
  return globalMockStore;
}

export function resetMockSystem(): void {
  globalMockStore.reset();
}

export function seedMockData(scenario: string = 'basic'): void {
  globalMockStore.reset();
  
  if (scenario === 'basic') {
    // Basic scenario is already seeded in reset()
    return;
  }
  
  if (scenario === 'advanced') {
    // Add more complex test data
    globalMockStore.addRecord('snipeTargets', {
      id: 'test-target-advanced',
      symbol: 'BTCUSDT',
      userId: 'test-user-123',
      strategy: 'conservative',
      isActive: true,
      targetPrice: 50000,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
}

export function setupTestData(scenario: string = 'basic'): void {
  seedMockData(scenario);
}

// ============================================================================
// Utility Functions
// ============================================================================

export function createMockResponse(data: any, status: number = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers({ 'content-type': 'application/json' })
  };
}

export function mockApiCall(endpoint: string, response: any) {
  if (global.fetch && vi.isMockFunction(global.fetch)) {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes(endpoint)) {
        return Promise.resolve(createMockResponse(response));
      }
      return Promise.resolve(createMockResponse({}));
    });
  }
}

// ============================================================================
// Export for Global Access
// ============================================================================

// Make functions globally available for tests
global.mockDataStore = globalMockStore;

export default {
  initializeUnifiedMocks,
  getGlobalMockStore,
  resetMockSystem,
  seedMockData,
  setupTestData,
  createMockResponse,
  mockApiCall
};