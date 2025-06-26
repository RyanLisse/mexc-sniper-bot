/**
 * Vitest Mock Configurations
 *
 * Extracted from vitest-setup.ts for better modularity.
 * Contains all external dependency mocks and API mocks.
 */

import { vi } from 'vitest';

// ============================================================================
// External API Mocks
// ============================================================================

/**
 * Initialize OpenAI API mocks
 */
export function initializeOpenAIMocks(): void {
  vi.mock('openai', () => ({
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  success: true,
                  message: 'Mock OpenAI response for testing',
                  confidence: 0.85
                })
              }
            }]
          })
        }
      },
      embeddings: {
        create: vi.fn().mockResolvedValue({
          data: [{
            embedding: new Array(1536).fill(0.1)
          }]
        })
      }
    }))
  }));
}

/**
 * Initialize MEXC API client mocks
 */
export function initializeMexcApiMocks(): void {
  vi.mock('@/src/services/mexc-api-client', () => ({
    MexcApiClient: vi.fn().mockImplementation(() => ({
      getServerTime: vi.fn().mockResolvedValue({ serverTime: Date.now() }),
      getSymbols: vi.fn().mockResolvedValue([
        { symbol: 'BTCUSDT', status: 'TRADING' },
        { symbol: 'ETHUSDT', status: 'TRADING' }
      ]),
      getAccountInfo: vi.fn().mockResolvedValue({
        balances: [
          { asset: 'USDT', free: '1000.00', locked: '0.00' }
        ]
      }),
      testConnectivity: vi.fn().mockResolvedValue(true)
    }))
  }));
}

/**
 * Initialize WebSocket mocks
 */
export function initializeWebSocketMocks(): void {
  global.WebSocket = vi.fn().mockImplementation(() => ({
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: 1 // OPEN
  })) as any;
}

// ============================================================================
// Browser API Mocks
// ============================================================================

/**
 * Initialize browser API mocks (localStorage, sessionStorage)
 */
export function initializeBrowserMocks(): void {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      }
    });

    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      }
    });
  } else {
    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    } as any;

    global.sessionStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    } as any;
  }
}

// ============================================================================
// Fetch API Mocks
// ============================================================================

/**
 * Initialize fetch mock with MEXC and Kinde API handling
 */
export function initializeFetchMock(): void {
  global.fetch = vi.fn().mockImplementation((url: string | URL, options?: RequestInit) => {
    const urlString = typeof url === 'string' ? url : url.toString();

    // Handle Kinde-specific endpoints
    if (urlString.includes('kinde.com') || urlString.includes('kinde')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({
          keys: [],
          success: true,
          message: 'Mock Kinde API response'
        }),
        text: () => Promise.resolve('{}'),
        headers: new Headers({
          'content-type': 'application/json'
        })
      });
    }

    // Handle MEXC API endpoints
    if (urlString.includes('api.mexc.com') || urlString.includes('mexc')) {
      if (urlString.includes('/api/operateactivity/activity/list/by/currencies')) {
        const mockActivityResponse = {
          code: 0,
          msg: 'success',
          data: [
            {
              activityId: 'mock-activity-1',
              currency: 'FCAT',
              currencyId: 'mock-currency-id',
              activityType: 'SUN_SHINE',
            }
          ],
          timestamp: Date.now()
        };
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve(mockActivityResponse),
          text: () => Promise.resolve(JSON.stringify(mockActivityResponse)),
          headers: new Headers({
            'content-type': 'application/json'
          })
        });
      }

      if (urlString.includes('/api/v3/exchangeInfo')) {
        const mockExchangeInfo = {
          timezone: 'UTC',
          serverTime: Date.now(),
          symbols: [
            { symbol: 'BTCUSDT', status: 'TRADING' },
            { symbol: 'ETHUSDT', status: 'TRADING' }
          ]
        };
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve(mockExchangeInfo),
          text: () => Promise.resolve(JSON.stringify(mockExchangeInfo)),
          headers: new Headers({
            'content-type': 'application/json'
          })
        });
      }

      const defaultMexcResponse = {
        code: 0,
        msg: 'success',
        data: null,
        timestamp: Date.now()
      };
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve(defaultMexcResponse),
        text: () => Promise.resolve(JSON.stringify(defaultMexcResponse)),
        headers: new Headers({
          'content-type': 'application/json'
        })
      });
    }

    // Default mock response
    const defaultResponse = {
      success: true,
      data: null,
      message: 'Mock API response'
    };
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve(defaultResponse),
      text: () => Promise.resolve(JSON.stringify(defaultResponse)),
      headers: new Headers({
        'content-type': 'application/json'
      })
    });
  }) as any;
}

// ============================================================================
// Database Mocks
// ============================================================================

/**
 * Initialize database mocks for unit tests
 */
export async function initializeDatabaseMocks(isIntegrationTest: boolean): Promise<void> {
  if (isIntegrationTest) {
    console.log('🔗 Skipping database mocks for integration tests');
    vi.unmock('@/src/db');
    vi.unmock('@/src/db/schema');
    return;
  }

  // In-memory data store for database mocks
  const mockDataStore = {
    snipeTargets: [] as any[],
    user: [] as any[],
    apiCredentials: [] as any[],
    userPreferences: [] as any[],
    patternEmbeddings: [] as any[],
    coinActivities: [] as any[],
    executionHistory: [] as any[],
    transactionLocks: [] as any[],
    workflowActivity: [] as any[],
    monitoredListings: [] as any[],
    tradingStrategies: [] as any[],
    transactions: [] as any[],
    reset() {
      this.snipeTargets = [];
      this.user = [];
      this.apiCredentials = [];
      this.userPreferences = [];
      this.patternEmbeddings = [];
      this.coinActivities = [];
      this.executionHistory = [];
      this.transactionLocks = [];
      this.workflowActivity = [];
      this.monitoredListings = [];
      this.tradingStrategies = [];
      this.transactions = [];
    }
  };

  global.mockDataStore = mockDataStore;

  // Create mock database with proper TypeScript types
  const createMockDb = () => ({
    execute: vi.fn().mockResolvedValue([{ test_value: 1, count: '1' }]),
    query: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockImplementation((table: any) => ({
      values: vi.fn().mockImplementation((data: any) => ({
        returning: vi.fn().mockImplementation(async () => {
          const tableName = table?._?.name || table?.name || 'unknown';
          const insertedData = Array.isArray(data) ? data : [data];
          
          // Handle different table types with mock data
          const results = insertedData.map((item: any, index: number) => ({
            id: `mock-${tableName}-${Date.now()}-${index}`,
            ...item,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));
          
          // Store in appropriate mock data store
          if (tableName in mockDataStore) {
            (mockDataStore as any)[tableName].push(...results);
          }
          
          return results;
        })
      }))
    })),
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation((table: any) => ({
        where: vi.fn().mockImplementation(() => ({
          orderBy: vi.fn().mockImplementation(() => {
            const tableName = table?._?.name || table?.name || 'unknown';
            return Promise.resolve((mockDataStore as any)[tableName] || []);
          }),
          limit: vi.fn().mockImplementation(() => {
            const tableName = table?._?.name || table?.name || 'unknown';
            return Promise.resolve((mockDataStore as any)[tableName] || []);
          })
        })),
        limit: vi.fn().mockImplementation(() => {
          const tableName = table?._?.name || table?.name || 'unknown';
          return Promise.resolve((mockDataStore as any)[tableName] || []);
        }),
        orderBy: vi.fn().mockImplementation(() => {
          const tableName = table?._?.name || table?.name || 'unknown';
          return Promise.resolve((mockDataStore as any)[tableName] || []);
        })
      }))
    })),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([])
      })
    }),
    delete: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(async () => {
        mockDataStore.reset();
        return [];
      })
    })),
    transaction: vi.fn().mockImplementation(async (cb: (tx: any) => any) => {
      return cb(createMockDb());
    })
  });

  const mockDb = createMockDb();

  // Mock database modules
  vi.mock('@/src/db', () => ({
    db: mockDb,
    getDb: vi.fn().mockReturnValue(mockDb),
    clearDbCache: vi.fn(),
    initializeDatabase: vi.fn().mockResolvedValue(true),
    healthCheck: vi.fn().mockResolvedValue({
      status: 'healthy',
      responseTime: 50,
      database: 'mock-neondb',
      timestamp: new Date().toISOString()
    })
  }));
}

// ============================================================================
// Master Mock Initializer
// ============================================================================

/**
 * Initialize all test mocks for external dependencies
 */
export async function initializeTestMocks(): Promise<void> {
  // Initialize all external API mocks
  initializeOpenAIMocks();
  initializeMexcApiMocks();
  initializeWebSocketMocks();
  
  // Initialize browser API mocks
  initializeBrowserMocks();
  
  // Initialize fetch mock
  initializeFetchMock();
}