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
  return {
    // Core database operations
    select: vi.fn().mockImplementation((columns?: any) => ({
      from: vi.fn().mockImplementation((table: any) => ({
        where: vi.fn().mockResolvedValue([]),
        limit: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
        execute: vi.fn().mockResolvedValue([]),
      })),
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
  return {
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
  };
}

// ============================================================================
// Master Initialization Function
// ============================================================================

export function initializeSimplifiedMocks(isIntegrationTest: boolean = false) {
  // Create global mock data store
  global.mockDataStore = createSimpleMockDataStore();

  // Initialize essential API mocks
  initializeEssentialApiMocks();

  // Mock database with proper hoisting support
  if (!isIntegrationTest) {
    vi.mock('@/src/db', () => {
      // Create mock database inside the mock factory to avoid hoisting issues
      const mockDb = createSimpleDatabaseMock(global.mockDataStore);
      
      return {
        db: mockDb,
        // Export mock table references
        snipeTargets: { _: { name: 'snipe_targets' } },
        user: { _: { name: 'user' } },
        apiCredentials: { _: { name: 'api_credentials' } },
        userPreferences: { _: { name: 'user_preferences' } },
        executionHistory: { _: { name: 'execution_history' } },
        transactions: { _: { name: 'transactions' } },
      };
    });
  }

  // Mock MEXC service
  const mexcServiceMock = createSimpleMexcServiceMock();
  
  vi.mock('@/src/services/api/unified-mexc-service-v2', () => ({
    UnifiedMexcServiceV2: vi.fn().mockImplementation(() => mexcServiceMock),
  }));

  vi.mock('@/src/services/mexc-unified-exports', () => ({
    getRecommendedMexcService: vi.fn().mockImplementation(() => mexcServiceMock),
  }));

  // Mock risk management services with simple implementations
  vi.mock('@/src/services/risk/comprehensive-safety-coordinator', () => ({
    ComprehensiveSafetyCoordinator: vi.fn().mockImplementation(() => ({
      assessSystemSafety: vi.fn().mockResolvedValue({
        overallSafety: 'SAFE',
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
    })),
  }));

  if (process.env.VERBOSE_TESTS === 'true') {
    console.log('✅ Simplified mocks initialized');
  }
}