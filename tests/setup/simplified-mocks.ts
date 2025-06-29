/**
 * Simplified Mock System for Vitest Tests
 *
 * Consolidated, maintainable mock setup that replaces the complex
 * multi-file mock system with a single, clean implementation.
 */

import { vi } from 'vitest';

// ============================================================================
// Simple Mock Data Store
// ============================================================================

export function createSimpleMockDataStore() {
  const tables: Record<string, any[]> = {
    snipeTargets: [],
    user: [],
    apiCredentials: [],
    userPreferences: [],
    executionHistory: [],
    transactionLocks: [],
    transactions: [],
    workflowActivity: [],
  };

  return {
    ...tables,
    reset(): void {
      Object.keys(tables).forEach(key => {
        tables[key] = [];
      });
    },

    addRecord(tableName: string, record: any): any {
      if (!tables[tableName]) {
        tables[tableName] = [];
      }
      const newRecord = {
        id: record.id || `mock-${tableName}-${Date.now()}`,
        ...record,
        createdAt: record.createdAt || new Date(),
        updatedAt: record.updatedAt || new Date(),
      };
      tables[tableName].push(newRecord);
      return newRecord;
    },

    findRecords(tableName: string, condition: (record: any) => boolean): any[] {
      if (!tables[tableName]) return [];
      return tables[tableName].filter(condition);
    },
  };
}

// ============================================================================
// Simplified Database Mocks
// ============================================================================

export function createSimpleDatabaseMock(store: any) {
  // Create a chainable query builder that resolves to empty arrays for tests
  const createQueryBuilder = () => {
    const builder = {
      where: vi.fn().mockImplementation(() => builder),
      limit: vi.fn().mockImplementation(() => builder),
      execute: vi.fn().mockResolvedValue([]),
      then: vi.fn().mockImplementation((resolve: any) => resolve([])), // Make it thenable for await
    };
    // Make it a promise-like object
    Object.setPrototypeOf(builder, Promise.prototype);
    return builder;
  };

  return {
    // Core database operations
    select: vi.fn().mockImplementation((columns?: any) => ({
      from: vi.fn().mockImplementation((table: any) => createQueryBuilder()),
    })),

    insert: vi.fn().mockImplementation((table: any) => ({
      values: vi.fn().mockImplementation((data: any) => ({
        returning: vi.fn().mockResolvedValue([data]),
        execute: vi.fn().mockResolvedValue({ insertId: 'mock-id' }),
      })),
    })),

    update: vi.fn().mockImplementation((table: any) => ({
      set: vi.fn().mockImplementation((data: any) => ({
        where: vi.fn().mockResolvedValue([{ ...data, id: 'mock-id' }]),
      })),
    })),

    delete: vi.fn().mockImplementation((table: any) => ({
      where: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    })),

    transaction: vi.fn().mockImplementation(async (cb: (tx: any) => any) => {
      const txMock = createSimpleDatabaseMock(store);
      return await cb(txMock);
    }),

    execute: vi.fn().mockResolvedValue([]),
  };
}

// ============================================================================
// Essential API Mocks
// ============================================================================

export function initializeEssentialApiMocks() {
  // Mock Next.js navigation
  vi.mock('next/navigation', () => ({
    useRouter: vi.fn(() => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      refresh: vi.fn(),
    })),
    usePathname: vi.fn(() => '/'),
    useSearchParams: vi.fn(() => new URLSearchParams()),
    redirect: vi.fn(),
  }));

  // Mock Kinde Auth
  vi.mock('@kinde-oss/kinde-auth-nextjs/server', () => ({
    getKindeServerSession: vi.fn(() => ({
      isAuthenticated: vi.fn().mockResolvedValue(false),
      getUser: vi.fn().mockResolvedValue(null),
    })),
  }));

  // Mock OpenAI
  vi.mock('openai', () => ({
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{
              message: { content: '{"success": true, "confidence": 0.85}' }
            }]
          })
        }
      }
    }))
  }));

  // Mock WebSocket
  global.WebSocket = vi.fn().mockImplementation(() => ({
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1,
    addEventListener: vi.fn(),
  })) as any;

  // Mock localStorage
  global.localStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  } as any;

  // Simplified fetch mock
  global.fetch = vi.fn().mockImplementation((url: string) => {
    const mockResponse = {
      success: true,
      data: null,
      timestamp: Date.now(),
    };

    if (url.includes('api.mexc.com')) {
      mockResponse.data = { serverTime: Date.now() };
    }

    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
  }) as any;
}

// ============================================================================
// Simplified MEXC Service Mocks
// ============================================================================

export function createSimpleMexcServiceMock() {
  const mock = {
    getAccountBalances: vi.fn().mockResolvedValue({
      success: true,
      data: [
        { asset: 'USDT', free: '10000.00', locked: '0.00' },
        { asset: 'BTC', free: '0.1', locked: '0.0' },
      ],
      timestamp: Date.now(),
    }),

    getSymbols: vi.fn().mockResolvedValue({
      success: true,
      data: [
        { symbol: 'BTCUSDT', status: 'TRADING' },
        { symbol: 'ETHUSDT', status: 'TRADING' },
      ],
      timestamp: Date.now(),
    }),

    getCalendarListings: vi.fn().mockResolvedValue({
      success: true,
      data: [],
      timestamp: Date.now(),
    }),

    testConnectivity: vi.fn().mockResolvedValue({
      success: true,
      data: { status: 'OK' },
      timestamp: Date.now(),
    }),

    getServerTime: vi.fn().mockResolvedValue({
      success: true,
      data: Date.now(),
      timestamp: Date.now(),
    }),

    // Trading methods
    placeOrder: vi.fn().mockResolvedValue({
      success: true,
      data: {
        orderId: 12345,
        clientOrderId: 'test-order-123',
        symbol: 'TESTUSDT',
        side: 'BUY',
        type: 'MARKET',
        origQty: '100.0',
        price: '1.0',
        status: 'FILLED',
        executedQty: '100.0',
        cummulativeQuoteQty: '100.0',
        transactTime: Date.now(),
      },
      timestamp: Date.now(),
    }),

    getTickerPrice: vi.fn().mockResolvedValue({
      success: true,
      data: {
        symbol: 'TESTUSDT',
        price: '1.0',
        lastPrice: '1.0',
      },
      timestamp: Date.now(),
    }),

    getTicker: vi.fn().mockResolvedValue({
      success: true,
      data: {
        symbol: 'TESTUSDT',
        price: '1.0',
        lastPrice: '1.0',
        priceChange: '0.05',
        priceChangePercent: '5.0',
        volume: '1000.0',
        quoteVolume: '1000.0',
        openPrice: '0.95',
        highPrice: '1.05',
        lowPrice: '0.90',
        prevClosePrice: '0.95',
        count: 100,
      },
      timestamp: Date.now(),
    }),

    getRecentActivity: vi.fn().mockResolvedValue({
      success: true,
      data: {
        activities: [
          {
            timestamp: Date.now() - 60000,
            activityType: 'large_trade',
            volume: 1000,
            price: 1.0,
            significance: 0.8,
          },
        ],
        totalActivities: 1,
        activityScore: 0.8,
      },
      timestamp: Date.now(),
    }),

    // Additional methods that might be called
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    updateConfig: vi.fn().mockResolvedValue(undefined),
    executeTrade: vi.fn().mockResolvedValue({
      success: true,
      data: {
        orderId: 'mock-order-123',
        symbol: 'TESTUSDT',
        side: 'BUY',
        type: 'MARKET',
        quantity: '100.0',
        price: '1.0',
        status: 'FILLED',
        executedQty: '100.0',
        timestamp: new Date().toISOString(),
      },
    }),
    getCurrentPrice: vi.fn().mockResolvedValue(1.0),
    canTrade: vi.fn().mockResolvedValue(true),
  };

  // Set the constructor name for proper instanceof checks
  Object.defineProperty(mock, 'constructor', {
    value: { name: 'UnifiedMexcServiceV2' },
    writable: false,
  });

  return mock;
}

// ============================================================================
// Master Initialization Function
// ============================================================================

export function initializeSimplifiedMocks(isIntegrationTest: boolean = false) {
  // Create global mock data store
  global.mockDataStore = createSimpleMockDataStore();

  // Initialize essential API mocks
  initializeEssentialApiMocks();

  // Use enhanced database mocks for better Drizzle ORM support
  if (!isIntegrationTest) {
    // Import and initialize enhanced database mocks
    try {
      const { initializeEnhancedDatabaseMocks } = require('./database-mocks-enhanced');
      initializeEnhancedDatabaseMocks();
    } catch (error) {
      console.warn('Enhanced database mocks not available, using basic mocks:', error.message);
      // Fallback to basic mocking
      global.mockDataStore = {
        reset: () => {},
        addRecord: () => ({}),
        findRecords: () => [],
      };
    }
  }

  // Mock the patterns schema with coinActivities
  vi.mock('@/src/db/schemas/patterns', () => ({
    coinActivities: { _: { name: 'coin_activities' } },
    monitoredListings: { _: { name: 'monitored_listings' } },
    patternEmbeddings: { _: { name: 'pattern_embeddings' } },
    patternSimilarityCache: { _: { name: 'pattern_similarity_cache' } },
  }));

  // Mock drizzle-orm functions
  vi.mock('drizzle-orm', () => ({
    and: vi.fn().mockImplementation((...conditions: any[]) => ({ _type: 'and', conditions })),
    or: vi.fn().mockImplementation((...conditions: any[]) => ({ _type: 'or', conditions })),
    eq: vi.fn().mockImplementation((column: any, value: any) => ({ _type: 'eq', column, value })),
    sql: vi.fn(),
  }));

  // Mock MEXC service with factory function to avoid hoisting issues
  vi.mock('@/src/services/api/unified-mexc-service-v2', () => ({
    UnifiedMexcServiceV2: vi.fn().mockImplementation(() => createSimpleMexcServiceMock()),
    unifiedMexcService: createSimpleMexcServiceMock(),
  }));

  vi.mock('@/src/services/mexc-unified-exports', () => ({
    getRecommendedMexcService: vi.fn().mockImplementation(() => createSimpleMexcServiceMock()),
  }));

  // Mock risk management services with simple implementations
  vi.mock('@/src/services/risk/comprehensive-safety-coordinator', () => ({
    ComprehensiveSafetyCoordinator: vi.fn().mockImplementation(() => ({
      assessSystemSafety: vi.fn().mockResolvedValue({
        overallSafety: 'SAFE',
        riskScore: 20,
        alerts: [],
      }),
      getStatus: vi.fn().mockReturnValue({
        overall: { safetyLevel: 'safe' },
        riskScore: 20,
        alerts: [],
      }),
      on: vi.fn(),
      emit: vi.fn(),
    })),
  }));

  vi.mock('@/src/services/risk/advanced-risk-engine', () => ({
    AdvancedRiskEngine: vi.fn().mockImplementation(() => ({
      assessRisk: vi.fn().mockResolvedValue({
        riskScore: 30,
        riskLevel: 'LOW',
        factors: [],
      }),
      validatePositionSize: vi.fn().mockResolvedValue({
        approved: true,
        adjustedPositionSize: 1000,
      }),
      updatePortfolioMetrics: vi.fn().mockResolvedValue({
        success: true,
        metrics: {
          totalValue: 10000,
          totalExposure: 5000,
          diversificationScore: 80,
          concentrationRisk: 20,
        },
      }),
      isEmergencyStopActive: vi.fn().mockReturnValue(false),
      initialize: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
      updateConfig: vi.fn().mockResolvedValue(undefined),
    })),
  }));

  if (process.env.VERBOSE_TESTS === 'true') {
    console.log('✅ Simplified mocks initialized');
  }
}