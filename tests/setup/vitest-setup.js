/**
 * Vitest Global Setup Configuration
 *
 * This file provides unified setup for all Vitest tests including:
 * - Database initialization and cleanup
 * - Mock configurations
 * - Environment variable setup
 * - Test utilities and helpers
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { db } from '@/src/db'
import '@testing-library/jest-dom'
import { globalTimeoutMonitor } from '../utils/timeout-utilities'

// Global test configuration
globalThis.__TEST_ENV__ = true
globalThis.__TEST_START_TIME__ = Date.now()

// Initialize timeout monitoring
if (process.env.ENABLE_TIMEOUT_MONITORING === 'true') {
  console.log('🕐 Timeout monitoring enabled for test suite')
}

// Mock external dependencies
beforeAll(async () => {
  console.log('🧪 Setting up Vitest global environment...')
  
  // Determine if this is an integration test that needs real database
  // Check various sources for integration test detection
  const testFilePath = global.process?.env?.VITEST_FILE_PATH || '';
  const testCommand = process.argv.join(' ');
  const vitest_file = process.env.VITEST_POOL_ID || '';
  const pool_worker = process.env.VITEST_WORKER_ID || '';
  
  // Simple fallback: use environment variable for explicit control
  const isIntegrationTest = process.env.USE_REAL_DATABASE === 'true' ||
                           testFilePath.includes('integration') || 
                           testFilePath.includes('pattern-to-database-bridge') ||
                           testCommand.includes('integration') ||
                           testCommand.includes('pattern-to-database-bridge') ||
                           vitest_file.includes('integration') ||
                           vitest_file.includes('pattern-to-database-bridge') ||
                           process.env.VITEST_MODE === 'integration' || 
                           process.env.npm_command === 'test:integration';
  
  console.log('🔍 Test detection:', {
    testFilePath,
    testCommand: testCommand.slice(0, 100),
    vitest_file,
    pool_worker,
    USE_REAL_DATABASE: process.env.USE_REAL_DATABASE,
    isIntegrationTest
  });
  
  if (!isIntegrationTest) {
    // Unit tests use mocked database
    process.env.FORCE_MOCK_DB = 'true'
    process.env.SKIP_DB_CONNECTION = 'true'
    process.env.USE_MOCK_DATABASE = 'true'
    console.log('🧪 Unit test mode: Using mocked database')
  } else {
    // Integration tests use real database
    process.env.FORCE_MOCK_DB = 'false'
    process.env.SKIP_DB_CONNECTION = 'false'
    process.env.USE_MOCK_DATABASE = 'false'
    console.log('🔗 Integration test mode: Using real database connections')
  }

  // Mock OpenAI API for testing
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
            embedding: new Array(1536).fill(0.1) // Mock 1536-dimension embedding
          }]
        })
      }
    }))
  }))

  // Mock MEXC API client
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
  }))

  // Mock Inngest client
  vi.mock('@/src/inngest/client', () => ({
    inngest: {
      send: vi.fn().mockResolvedValue({ ids: ['mock-event-id'] }),
      createFunction: vi.fn()
    }
  }))

  // Mock Kinde Auth SDK to prevent real network calls
  vi.mock('@kinde-oss/kinde-auth-nextjs/server', () => ({
    getKindeServerSession: vi.fn(() => ({
      isAuthenticated: vi.fn().mockResolvedValue(false),
      getUser: vi.fn().mockResolvedValue(null),
      getPermissions: vi.fn().mockResolvedValue({ permissions: [] }),
      getPermission: vi.fn().mockResolvedValue({ isGranted: false }),
      getOrganization: vi.fn().mockResolvedValue(null),
      getUserOrganizations: vi.fn().mockResolvedValue({ orgCodes: [] }),
      getClaim: vi.fn().mockResolvedValue({ name: 'test', value: null }),
      getAccessToken: vi.fn().mockResolvedValue(null),
      refreshTokens: vi.fn().mockRejectedValue(new Error('Not authenticated')),
      getBooleanFlag: vi.fn().mockResolvedValue({ value: false, isDefault: true }),
      getFlag: vi.fn().mockResolvedValue({ value: null, isDefault: true }),
      getIdToken: vi.fn().mockResolvedValue(null),
      getIdTokenRaw: vi.fn().mockResolvedValue(null),
      getStringFlag: vi.fn().mockResolvedValue({ value: '', isDefault: true }),
      getIntegerFlag: vi.fn().mockResolvedValue({ value: 0, isDefault: true }),
      getAccessTokenRaw: vi.fn().mockResolvedValue(null),
      getRoles: vi.fn().mockResolvedValue({ roles: [] }),
      logout: vi.fn().mockResolvedValue(null),
      createOrg: vi.fn().mockResolvedValue(null)
    }))
  }))

  // Mock Kinde Auth client-side SDK as well
  vi.mock('@kinde-oss/kinde-auth-nextjs', () => ({
    useKindeBrowserClient: vi.fn(() => ({
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null,
      getUser: vi.fn().mockReturnValue(null),
      getUserOrganizations: vi.fn().mockReturnValue({ orgCodes: [] }),
      getPermissions: vi.fn().mockReturnValue({ permissions: [] }),
      getPermission: vi.fn().mockReturnValue({ isGranted: false }),
      getOrganization: vi.fn().mockReturnValue(null),
      getClaim: vi.fn().mockReturnValue({ name: 'test', value: null }),
      getAccessToken: vi.fn().mockReturnValue(null),
      getBooleanFlag: vi.fn().mockReturnValue({ value: false, isDefault: true }),
      getFlag: vi.fn().mockReturnValue({ value: null, isDefault: true }),
      getStringFlag: vi.fn().mockReturnValue({ value: '', isDefault: true }),
      getIntegerFlag: vi.fn().mockReturnValue({ value: 0, isDefault: true })
    })),
    getKindeServerSession: vi.fn(() => ({
      isAuthenticated: vi.fn().mockResolvedValue(false),
      getUser: vi.fn().mockResolvedValue(null),
      getPermissions: vi.fn().mockResolvedValue({ permissions: [] }),
      getPermission: vi.fn().mockResolvedValue({ isGranted: false }),
      getOrganization: vi.fn().mockResolvedValue(null),
      getUserOrganizations: vi.fn().mockResolvedValue({ orgCodes: [] }),
      getClaim: vi.fn().mockResolvedValue({ name: 'test', value: null }),
      getAccessToken: vi.fn().mockResolvedValue(null),
      refreshTokens: vi.fn().mockRejectedValue(new Error('Not authenticated')),
      getBooleanFlag: vi.fn().mockResolvedValue({ value: false, isDefault: true }),
      getFlag: vi.fn().mockResolvedValue({ value: null, isDefault: true }),
      getIdToken: vi.fn().mockResolvedValue(null),
      getIdTokenRaw: vi.fn().mockResolvedValue(null),
      getStringFlag: vi.fn().mockResolvedValue({ value: '', isDefault: true }),
      getIntegerFlag: vi.fn().mockResolvedValue({ value: 0, isDefault: true }),
      getAccessTokenRaw: vi.fn().mockResolvedValue(null),
      getRoles: vi.fn().mockResolvedValue({ roles: [] }),
      logout: vi.fn().mockResolvedValue(null),
      createOrg: vi.fn().mockResolvedValue(null)
    }))
  }))

  // Mock Neon API and Branch Manager
  vi.mock('@/src/lib/neon-branch-manager', () => {
    const mockBranches = new Map()
    let branchIdCounter = 1

    return {
      NeonBranchManager: vi.fn().mockImplementation(() => ({
        createTestBranch: vi.fn().mockImplementation(async (options = {}) => {
          const branchId = `mock-branch-${branchIdCounter++}`
          const branchName = options.name || `test-${Date.now()}`
          const connectionString = `postgresql://mock_user:mock_pass@mock-endpoint-${branchId}.mock.neon.tech:5432/neondb?sslmode=require`

          const branch = {
            id: branchId,
            name: branchName,
            connectionString,
            projectId: 'mock-project-id',
            createdAt: new Date(),
            endpoint: {
              id: `mock-endpoint-${branchId}`,
              host: `mock-endpoint-${branchId}.mock.neon.tech`,
              port: 5432
            }
          }

          mockBranches.set(branchId, branch)
          return branch
        }),
        deleteTestBranch: vi.fn().mockImplementation(async (branchId) => {
          mockBranches.delete(branchId)
          return Promise.resolve()
        }),
        getBranchConnectionString: vi.fn().mockImplementation(async (branchId) => {
          const branch = mockBranches.get(branchId)
          return branch ? branch.connectionString : `postgresql://mock_user:mock_pass@mock-endpoint-${branchId}.mock.neon.tech:5432/neondb?sslmode=require`
        }),
        listTestBranches: vi.fn().mockResolvedValue([]),
        cleanupOldTestBranches: vi.fn().mockResolvedValue(),
        cleanupAllTrackedBranches: vi.fn().mockResolvedValue(),
        getActiveBranchCount: vi.fn().mockReturnValue(0),
        getActiveBranches: vi.fn().mockReturnValue([]),
        getProject: vi.fn().mockResolvedValue({
          id: 'mock-project-id',
          name: 'Mock Project',
          database_host: 'mock-host.neon.tech',
          database_name: 'neondb',
          database_user: 'neondb_owner',
          database_password: 'mock-password'
        })
      })),
      neonBranchManager: {
        createTestBranch: vi.fn().mockImplementation(async (options = {}) => {
          const branchId = `mock-branch-${Date.now()}`
          const branchName = options.name || `test-${Date.now()}`
          const connectionString = `postgresql://mock_user:mock_pass@mock-endpoint-${branchId}.mock.neon.tech:5432/neondb?sslmode=require`

          return {
            id: branchId,
            name: branchName,
            connectionString,
            projectId: 'mock-project-id',
            createdAt: new Date(),
            endpoint: {
              id: `mock-endpoint-${branchId}`,
              host: `mock-endpoint-${branchId}.mock.neon.tech`,
              port: 5432
            }
          }
        }),
        deleteTestBranch: vi.fn().mockResolvedValue(),
        getBranchConnectionString: vi.fn().mockResolvedValue('postgresql://mock_user:mock_pass@mock-endpoint.mock.neon.tech:5432/neondb?sslmode=require'),
        listTestBranches: vi.fn().mockResolvedValue([]),
        cleanupOldTestBranches: vi.fn().mockResolvedValue(),
        cleanupAllTrackedBranches: vi.fn().mockResolvedValue(),
        getActiveBranchCount: vi.fn().mockReturnValue(0),
        getActiveBranches: vi.fn().mockReturnValue([])
      }
    }
  })

  // Mock test-branch-setup utilities
  vi.mock('@/src/lib/test-branch-setup', () => {
    let mockTestBranchContext = null

    const mockSetupTestBranch = vi.fn().mockImplementation(async (options = {}) => {
      const branchId = `mock-test-branch-${Date.now()}`
      const branchName = `${options.testSuite || 'test'}-${Date.now()}`
      const connectionString = `postgresql://mock_user:mock_pass@mock-test-endpoint-${branchId}.mock.neon.tech:5432/neondb?sslmode=require`

      mockTestBranchContext = {
        branchId,
        branchName,
        connectionString,
        originalDatabaseUrl: process.env.DATABASE_URL || 'postgresql://original@host/db',
        cleanup: vi.fn().mockResolvedValue()
      }

      return mockTestBranchContext
    })

    const mockCleanupTestBranch = vi.fn().mockResolvedValue()
    const mockMigrateTestBranch = vi.fn().mockResolvedValue()

    return {
      setupTestBranch: mockSetupTestBranch,
      cleanupTestBranch: mockCleanupTestBranch,
      getCurrentTestBranch: vi.fn().mockImplementation(() => mockTestBranchContext),
      withTestBranch: vi.fn().mockImplementation(async (testFn, options) => {
        const context = await mockSetupTestBranch(options)
        try {
          return await testFn(context)
        } finally {
          await mockCleanupTestBranch(context)
        }
      }),
      setupVitestBranch: vi.fn().mockImplementation(async () => {
        return mockSetupTestBranch({ testSuite: 'vitest', timeout: 120000 })
      }),
      cleanupAllTestBranches: vi.fn().mockResolvedValue(),
      migrateTestBranch: mockMigrateTestBranch,
      checkTestBranchHealth: vi.fn().mockResolvedValue(true),
      createIntegrationTestDb: vi.fn().mockImplementation(async () => {
        const context = await mockSetupTestBranch({ testSuite: 'integration', timeout: 180000 })
        await mockMigrateTestBranch(context)
        return context
      }),
      createUnitTestDb: vi.fn().mockImplementation(async () => {
        return mockSetupTestBranch({ testSuite: 'unit', timeout: 60000 })
      }),
      recoverFromBranchError: vi.fn().mockResolvedValue()
    }
  })

  // In-memory data store for database mocks
  const mockDataStore = {
    snipeTargets: [],
    user: [],
    apiCredentials: [],
    userPreferences: [],
    patternEmbeddings: [],
    coinActivities: [],
    executionHistory: [],
    transactionLocks: [],
    workflowActivity: [],
    monitoredListings: [],
    tradingStrategies: [],
    transactions: [],
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

  // Mock database functions with persistent in-memory storage
  const createMockDb = () => ({
    execute: vi.fn().mockResolvedValue([{ test_value: 1, count: '1' }]),
    query: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockImplementation((table) => ({
      values: vi.fn().mockImplementation((data) => ({
        returning: vi.fn().mockImplementation(async () => {
          // Determine which table we're inserting into using Drizzle table schema
          const tableName = table?._?.name || table?.name || 'unknown';
          
          if (tableName === 'snipe_targets') {
            const insertedData = Array.isArray(data) ? data : [data];
            const results = insertedData.map((item, index) => ({
              id: `mock-snipe-${Date.now()}-${index}`,
              userId: 'test-user-id',
              symbolName: 'TESTUSDT',
              status: 'pending',
              priority: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
              ...item
            }));
            mockDataStore.snipeTargets.push(...results);
            return results;
          } else if (tableName === 'user') {
            const insertedData = Array.isArray(data) ? data : [data];
            const results = insertedData.map((item, index) => ({
              id: `mock-user-${Date.now()}-${index}`,
              email: 'test@example.com',
              createdAt: new Date(),
              updatedAt: new Date(),
              ...item
            }));
            mockDataStore.user.push(...results);
            return results;
          } else if (tableName === 'coin_activities') {
            const insertedData = Array.isArray(data) ? data : [data];
            const results = insertedData.map((item, index) => ({
              id: `mock-activity-${Date.now()}-${index}`,
              vcoinId: 'test-coin',
              currency: 'TEST',
              createdAt: new Date(),
              ...item
            }));
            mockDataStore.coinActivities.push(...results);
            return results;
          } else if (tableName === 'user_preferences') {
            const insertedData = Array.isArray(data) ? data : [data];
            const results = insertedData.map((item, index) => ({
              id: `mock-pref-${Date.now()}-${index}`,
              userId: 'test-user-id',
              updatedAt: new Date(),
              createdAt: new Date(),
              ...item
            }));
            mockDataStore.userPreferences.push(...results);
            return results;
          } else if (tableName === 'pattern_embeddings') {
            const insertedData = Array.isArray(data) ? data : [data];
            const results = insertedData.map((item, index) => ({
              id: `mock-pattern-${Date.now()}-${index}`,
              symbolName: 'TESTUSDT',
              patternType: 'ready_state',
              confidence: 85.0,
              isActive: true,
              createdAt: new Date(),
              ...item
            }));
            mockDataStore.patternEmbeddings.push(...results);
            return results;
          } else if (tableName === 'execution_history') {
            const insertedData = Array.isArray(data) ? data : [data];
            const results = insertedData.map((item, index) => ({
              id: `mock-execution-${Date.now()}-${index}`,
              userId: 'test-user-id',
              symbolName: 'TESTUSDT',
              executedAt: new Date(),
              createdAt: new Date(),
              ...item
            }));
            mockDataStore.executionHistory.push(...results);
            return results;
          } else if (tableName === 'transaction_locks') {
            const insertedData = Array.isArray(data) ? data : [data];
            const results = insertedData.map((item, index) => ({
              id: `mock-lock-${Date.now()}-${index}`,
              resourceId: 'test-resource',
              status: 'active',
              expiresAt: new Date(Date.now() + 60000),
              createdAt: new Date(),
              ...item
            }));
            mockDataStore.transactionLocks.push(...results);
            return results;
          } else if (tableName === 'workflow_activity') {
            const insertedData = Array.isArray(data) ? data : [data];
            const results = insertedData.map((item, index) => ({
              id: `mock-workflow-${Date.now()}-${index}`,
              userId: 'test-user-id',
              timestamp: new Date(),
              type: 'test',
              ...item
            }));
            mockDataStore.workflowActivity.push(...results);
            return results;
          } else if (tableName === 'monitored_listings') {
            const insertedData = Array.isArray(data) ? data : [data];
            const results = insertedData.map((item, index) => ({
              id: `mock-listing-${Date.now()}-${index}`,
              hasReadyPattern: false,
              status: 'monitoring',
              confidence: 0.0,
              createdAt: new Date(),
              ...item
            }));
            mockDataStore.monitoredListings.push(...results);
            return results;
          } else if (tableName === 'trading_strategies') {
            const insertedData = Array.isArray(data) ? data : [data];
            const results = insertedData.map((item, index) => ({
              id: `mock-strategy-${Date.now()}-${index}`,
              userId: 'test-user-id',
              status: 'active',
              updatedAt: new Date(),
              createdAt: new Date(),
              ...item
            }));
            mockDataStore.tradingStrategies.push(...results);
            return results;
          } else if (tableName === 'transactions') {
            const insertedData = Array.isArray(data) ? data : [data];
            const results = insertedData.map((item, index) => ({
              id: `mock-transaction-${Date.now()}-${index}`,
              userId: 'test-user-id',
              status: 'completed',
              createdAt: new Date(),
              ...item
            }));
            mockDataStore.transactions.push(...results);
            return results;
          }
          
          // Default fallback for any other table
          return Array.isArray(data) ? data.map((item, index) => ({ id: `mock-id-${index}`, ...item })) : [{ id: 'mock-id', ...data }];
        })
      }))
    })),
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation((table) => ({
        where: vi.fn().mockImplementation((condition) => ({
          orderBy: vi.fn().mockImplementation(() => {
            // Determine which table we're selecting from using Drizzle table schema
            const tableName = table?._?.name || table?.name || 'unknown';
            
            if (tableName === 'snipe_targets') {
              return Promise.resolve(mockDataStore.snipeTargets);
            } else if (tableName === 'user') {
              return Promise.resolve(mockDataStore.user);
            } else if (tableName === 'coin_activities') {
              return Promise.resolve(mockDataStore.coinActivities);
            } else if (tableName === 'user_preferences') {
              return Promise.resolve(mockDataStore.userPreferences);
            } else if (tableName === 'pattern_embeddings') {
              return Promise.resolve(mockDataStore.patternEmbeddings);
            } else if (tableName === 'execution_history') {
              return Promise.resolve(mockDataStore.executionHistory);
            } else if (tableName === 'transaction_locks') {
              return Promise.resolve(mockDataStore.transactionLocks);
            } else if (tableName === 'workflow_activity') {
              return Promise.resolve(mockDataStore.workflowActivity);
            } else if (tableName === 'monitored_listings') {
              return Promise.resolve(mockDataStore.monitoredListings);
            } else if (tableName === 'trading_strategies') {
              return Promise.resolve(mockDataStore.tradingStrategies);
            } else if (tableName === 'transactions') {
              return Promise.resolve(mockDataStore.transactions);
            }
            
            return Promise.resolve([]);
          }),
          limit: vi.fn().mockImplementation(() => {
            // Determine which table we're selecting from using Drizzle table schema
            const tableName = table?._?.name || table?.name || 'unknown';
            
            if (tableName === 'snipe_targets') {
              return Promise.resolve(mockDataStore.snipeTargets);
            } else if (tableName === 'user') {
              return Promise.resolve(mockDataStore.user);
            } else if (tableName === 'coin_activities') {
              return Promise.resolve(mockDataStore.coinActivities);
            } else if (tableName === 'user_preferences') {
              return Promise.resolve(mockDataStore.userPreferences);
            } else if (tableName === 'pattern_embeddings') {
              return Promise.resolve(mockDataStore.patternEmbeddings);
            } else if (tableName === 'execution_history') {
              return Promise.resolve(mockDataStore.executionHistory);
            } else if (tableName === 'transaction_locks') {
              return Promise.resolve(mockDataStore.transactionLocks);
            } else if (tableName === 'workflow_activity') {
              return Promise.resolve(mockDataStore.workflowActivity);
            } else if (tableName === 'monitored_listings') {
              return Promise.resolve(mockDataStore.monitoredListings);
            } else if (tableName === 'trading_strategies') {
              return Promise.resolve(mockDataStore.tradingStrategies);
            } else if (tableName === 'transactions') {
              return Promise.resolve(mockDataStore.transactions);
            }
            
            return Promise.resolve([]);
          })
        })),
        limit: vi.fn().mockImplementation(() => {
          // Determine which table we're selecting from using Drizzle table schema
          const tableName = table?._?.name || table?.name || 'unknown';
          
          if (tableName === 'snipe_targets') {
            return Promise.resolve(mockDataStore.snipeTargets);
          } else if (tableName === 'user') {
            return Promise.resolve(mockDataStore.user);
          } else if (tableName === 'coin_activities') {
            return Promise.resolve(mockDataStore.coinActivities);
          } else if (tableName === 'user_preferences') {
            return Promise.resolve(mockDataStore.userPreferences);
          } else if (tableName === 'pattern_embeddings') {
            return Promise.resolve(mockDataStore.patternEmbeddings);
          } else if (tableName === 'execution_history') {
            return Promise.resolve(mockDataStore.executionHistory);
          } else if (tableName === 'transaction_locks') {
            return Promise.resolve(mockDataStore.transactionLocks);
          } else if (tableName === 'workflow_activity') {
            return Promise.resolve(mockDataStore.workflowActivity);
          } else if (tableName === 'monitored_listings') {
            return Promise.resolve(mockDataStore.monitoredListings);
          } else if (tableName === 'trading_strategies') {
            return Promise.resolve(mockDataStore.tradingStrategies);
          } else if (tableName === 'transactions') {
            return Promise.resolve(mockDataStore.transactions);
          }
          
          return Promise.resolve([]);
        }),
        orderBy: vi.fn().mockImplementation(() => {
          // Determine which table we're selecting from using Drizzle table schema
          const tableName = table?._?.name || table?.name || 'unknown';
          
          if (tableName === 'snipe_targets') {
            return Promise.resolve(mockDataStore.snipeTargets);
          } else if (tableName === 'user') {
            return Promise.resolve(mockDataStore.user);
          } else if (tableName === 'coin_activities') {
            return Promise.resolve(mockDataStore.coinActivities);
          } else if (tableName === 'user_preferences') {
            return Promise.resolve(mockDataStore.userPreferences);
          } else if (tableName === 'pattern_embeddings') {
            return Promise.resolve(mockDataStore.patternEmbeddings);
          } else if (tableName === 'execution_history') {
            return Promise.resolve(mockDataStore.executionHistory);
          } else if (tableName === 'transaction_locks') {
            return Promise.resolve(mockDataStore.transactionLocks);
          } else if (tableName === 'workflow_activity') {
            return Promise.resolve(mockDataStore.workflowActivity);
          } else if (tableName === 'monitored_listings') {
            return Promise.resolve(mockDataStore.monitoredListings);
          } else if (tableName === 'trading_strategies') {
            return Promise.resolve(mockDataStore.tradingStrategies);
          } else if (tableName === 'transactions') {
            return Promise.resolve(mockDataStore.transactions);
          }
          
          return Promise.resolve([]);
        })
      }))
    })),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([])
      })
    }),
    delete: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(async (condition) => {
        // Clear all data for delete operations in tests
        mockDataStore.reset();
        return [];
      })
    })),
    transaction: vi.fn().mockImplementation(async (cb) => {
      return cb(createMockDb())
    })
  })

  const mockDb = createMockDb()
  
  // Make mockDataStore globally accessible for test cleanup
  global.mockDataStore = mockDataStore

  // Mock Drizzle table schemas
  const mockTableSchemas = {
    snipeTargets: { 
      _: { name: 'snipe_targets' },
      name: 'snipe_targets',
      userId: { name: 'user_id' },
      symbolName: { name: 'symbol_name' },
      vcoinId: { name: 'vcoin_id' },
      status: { name: 'status' },
      priority: { name: 'priority' },
      createdAt: { name: 'created_at' }
    },
    user: { 
      _: { name: 'user' },
      name: 'user',
      id: { name: 'id' },
      email: { name: 'email' },
      createdAt: { name: 'created_at' },
      updatedAt: { name: 'updated_at' }
    },
    userPreferences: { 
      _: { name: 'user_preferences' },
      name: 'user_preferences',
      userId: { name: 'user_id' },
      updatedAt: { name: 'updated_at' },
      createdAt: { name: 'created_at' }
    },
    coinActivities: { 
      _: { name: 'coin_activities' },
      name: 'coin_activities',
      vcoinId: { name: 'vcoin_id' },
      currency: { name: 'currency' },
      createdAt: { name: 'created_at' }
    },
    patternEmbeddings: {
      _: { name: 'pattern_embeddings' },
      name: 'pattern_embeddings',
      symbolName: { name: 'symbol_name' },
      patternType: { name: 'pattern_type' },
      confidence: { name: 'confidence' },
      isActive: { name: 'is_active' },
      createdAt: { name: 'created_at' }
    },
    executionHistory: {
      _: { name: 'execution_history' },
      name: 'execution_history',
      userId: { name: 'user_id' },
      symbolName: { name: 'symbol_name' },
      executedAt: { name: 'executed_at' },
      createdAt: { name: 'created_at' }
    },
    transactionLocks: {
      _: { name: 'transaction_locks' },
      name: 'transaction_locks',
      resourceId: { name: 'resource_id' },
      status: { name: 'status' },
      expiresAt: { name: 'expires_at' },
      createdAt: { name: 'created_at' }
    },
    workflowActivity: {
      _: { name: 'workflow_activity' },
      name: 'workflow_activity',
      userId: { name: 'user_id' },
      timestamp: { name: 'timestamp' },
      type: { name: 'type' }
    },
    monitoredListings: {
      _: { name: 'monitored_listings' },
      name: 'monitored_listings',
      hasReadyPattern: { name: 'has_ready_pattern' },
      status: { name: 'status' },
      confidence: { name: 'confidence' },
      createdAt: { name: 'created_at' }
    },
    tradingStrategies: {
      _: { name: 'trading_strategies' },
      name: 'trading_strategies',
      userId: { name: 'user_id' },
      status: { name: 'status' },
      updatedAt: { name: 'updated_at' },
      createdAt: { name: 'created_at' }
    },
    transactions: {
      _: { name: 'transactions' },
      name: 'transactions',
      userId: { name: 'user_id' },
      status: { name: 'status' },
      createdAt: { name: 'created_at' }
    }
  };

  // Only mock database for unit tests, not integration tests
  if (!isIntegrationTest) {
    vi.mock('@/src/db/schema', () => ({
      snipeTargets: mockTableSchemas.snipeTargets,
      user: mockTableSchemas.user,
      userPreferences: mockTableSchemas.userPreferences,
      coinActivities: mockTableSchemas.coinActivities,
      patternEmbeddings: mockTableSchemas.patternEmbeddings,
      executionHistory: mockTableSchemas.executionHistory,
      transactionLocks: mockTableSchemas.transactionLocks,
      workflowActivity: mockTableSchemas.workflowActivity,
      monitoredListings: mockTableSchemas.monitoredListings,
      tradingStrategies: mockTableSchemas.tradingStrategies,
      transactions: mockTableSchemas.transactions
    }))

    vi.mock('@/src/db', () => ({
      db: mockDb,
      getDb: vi.fn().mockReturnValue(mockDb),
      clearDbCache: vi.fn().mockImplementation(() => {
        // Mock implementation - no actual cache to clear
      }),
      initializeDatabase: vi.fn().mockResolvedValue(true),
      healthCheck: vi.fn().mockResolvedValue({
        status: 'healthy',
        responseTime: 50,
        database: 'mock-neondb',
        timestamp: new Date().toISOString()
      }),
      executeWithRetry: vi.fn().mockImplementation(async (queryFn) => {
        return queryFn()
      }),
      closeDatabase: vi.fn().mockImplementation(() => {
        // Mock implementation - no actual database to close
      }),
      // Database optimization functions
      executeOptimizedSelect: vi.fn().mockImplementation(async (queryFn, cacheKey, cacheTTL) => {
        return queryFn()
      }),
      executeOptimizedWrite: vi.fn().mockImplementation(async (queryFn, invalidatePatterns) => {
        return queryFn()
      }),
      executeBatchOperations: vi.fn().mockImplementation(async (operations, invalidatePatterns) => {
        return Promise.all(operations.map(op => op()))
      }),
      monitoredQuery: vi.fn().mockImplementation(async (queryName, queryFn, options) => {
        return queryFn()
      })
    }))
  } else {
    console.log('🔗 Skipping database mocks for integration tests')
    // Ensure any existing mocks are cleared for integration tests
    vi.unmock('@/src/db')
    vi.unmock('@/src/db/schema')
  }

  // Mock database-connection-pool to re-export the same mocked db (only for unit tests)
  if (!isIntegrationTest) {
    vi.mock('@/src/lib/database-connection-pool', () => ({
      db: mockDb,
      databaseConnectionPool: {
        executeSelect: vi.fn().mockImplementation(async (queryFn) => queryFn()),
        executeWrite: vi.fn().mockImplementation(async (queryFn) => queryFn()),
        executeBatch: vi.fn().mockImplementation(async (operations) => 
          Promise.all(operations.map(op => op()))
        ),
        shutdown: vi.fn(),
        getMetrics: vi.fn().mockReturnValue({
          totalConnections: 1,
          activeConnections: 1,
          connectionPoolHealth: 'healthy'
        })
      }
    }))
  } else {
    // Ensure database-connection-pool is not mocked for integration tests
    vi.unmock('@/src/lib/database-connection-pool')
  }

  // Mock AI Intelligence Service for fast, deterministic test results
  vi.mock('@/src/services/ai-intelligence-service', () => ({
    aiIntelligenceService: {
      enhancePatternWithAI: vi.fn().mockResolvedValue({
        cohereEmbedding: new Array(1024).fill(0.1), // Mock Cohere embedding
        perplexityInsights: {
          marketSentiment: 'bullish',
          volumeInsights: 'increasing',
          newsImpact: 'positive',
          researchSummary: 'Mock research summary for testing'
        },
        aiContext: {
          marketSentiment: 'neutral',
          opportunityScore: 85,
          researchInsights: ['Mock AI insight for testing'],
          timeframe: 'immediate',
          volumeProfile: 'medium',
          liquidityScore: 0.75
        }
      }),
      calculateAIEnhancedConfidence: vi.fn().mockResolvedValue({
        enhancedConfidence: 85,
        components: {
          basePattern: 75,
          aiResearch: 5,
          marketSentiment: 3,
          technicalAlignment: 2,
          riskAdjustment: 0
        },
        aiInsights: ['Mock AI confidence insight'],
        recommendations: ['Mock AI recommendation']
      }),
      generateCohereEmbedding: vi.fn().mockResolvedValue([new Array(1024).fill(0.1)]),
      generatePatternEmbedding: vi.fn().mockResolvedValue(new Array(1024).fill(0.1)),
      researchWithPerplexity: vi.fn().mockResolvedValue({
        summary: 'Mock Perplexity research summary',
        insights: ['Mock insight 1', 'Mock insight 2'],
        marketSentiment: 'neutral',
        confidence: 0.8
      })
    },
    AIIntelligenceService: vi.fn().mockImplementation(() => ({
      enhancePatternWithAI: vi.fn().mockResolvedValue({
        cohereEmbedding: new Array(1024).fill(0.1),
        perplexityInsights: {
          marketSentiment: 'bullish',
          volumeInsights: 'increasing',
          newsImpact: 'positive',
          researchSummary: 'Mock research summary'
        }
      }),
      calculateAIEnhancedConfidence: vi.fn().mockResolvedValue({
        enhancedConfidence: 85,
        components: { basePattern: 75, aiResearch: 5, marketSentiment: 3, technicalAlignment: 2, riskAdjustment: 0 },
        aiInsights: ['Mock insight'],
        recommendations: ['Mock recommendation']
      })
    }))
  }))

  // Mock Pattern Embedding Service for fast test execution
  vi.mock('@/src/services/pattern-embedding-service', () => ({
    patternEmbeddingService: {
      storePattern: vi.fn().mockResolvedValue({ id: 'mock-pattern-id' }),
      findSimilarPatterns: vi.fn().mockResolvedValue([
        {
          id: 'mock-similar-1',
          symbolName: 'MOCKUSDT',
          cosineSimilarity: 0.85,
          confidence: 80,
          createdAt: new Date()
        }
      ]),
      calculatePatternConfidenceScore: vi.fn().mockResolvedValue({
        confidence: 80,
        factors: {
          similarity: 0.8,
          historicalSuccess: 0.75,
          marketAlignment: 0.7
        },
        recommendations: ['Mock pattern recommendation']
      }),
      generateEmbedding: vi.fn().mockResolvedValue(new Array(1024).fill(0.1))
    },
    PatternEmbeddingService: vi.fn().mockImplementation(() => ({
      storePattern: vi.fn().mockResolvedValue({ id: 'mock-pattern-id' }),
      findSimilarPatterns: vi.fn().mockResolvedValue([]),
      calculatePatternConfidenceScore: vi.fn().mockResolvedValue({ confidence: 80 })
    }))
  }))

  // Note: Not mocking encryption service globally so unit tests can test actual implementation
  // Individual tests can mock if needed

  // Mock WebSocket connections
  global.WebSocket = vi.fn().mockImplementation(() => ({
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: 1 // OPEN
  }))

  // Mock browser APIs only if window is available (e.g., in jsdom environment)
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      }
    })

    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      }
    })
  } else {
    // In Node.js environment, create global mocks for localStorage/sessionStorage
    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    }

    global.sessionStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    }
  }

  // Mock fetch for API calls with special handling for Kinde URLs and MEXC API
  global.fetch = vi.fn().mockImplementation((url, options) => {
    // Convert URL to string if it's a URL object
    const urlString = typeof url === 'string' ? url : url.toString();

    // Handle Kinde-specific endpoints
    if (urlString.includes('kinde.com') || urlString.includes('kinde')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({
          keys: [], // Mock JWKS response
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
      // Activity API endpoint
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

      // Exchange Info endpoint
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

      // Default MEXC API response
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

    // Default mock response for all other URLs
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
    })
  })

  console.log('✅ Global mocks configured')
})

// Database setup for each test
beforeEach(async () => {
  // Reset database state if needed
  if (process.env.RESET_DB_PER_TEST === 'true') {
    console.log('🗄️ Resetting database for test...')
    // Add database reset logic here if needed
  }
})

// Cleanup after each test
afterEach(async () => {
  // Clear all mocks
  vi.clearAllMocks()

  // Reset in-memory database store
  if (global.mockDataStore && global.mockDataStore.reset) {
    global.mockDataStore.reset()
  }

  // Cleanup timeout monitors to prevent memory leaks
  globalTimeoutMonitor.cleanup()
  
  // Report any hanging timeouts in monitoring mode
  if (process.env.ENABLE_TIMEOUT_MONITORING === 'true') {
    const activeCount = globalTimeoutMonitor.getActiveCount()
    if (activeCount.timeouts > 0 || activeCount.intervals > 0) {
      console.warn(`⚠️ Cleaned up ${activeCount.timeouts} timeouts and ${activeCount.intervals} intervals after test`)
    }
  }

  // Reset any global state
  if (global.testCleanupFunctions) {
    for (const cleanup of global.testCleanupFunctions) {
      await cleanup()
    }
    global.testCleanupFunctions = []
  }
})

// Global cleanup
afterAll(async () => {
  console.log('🧹 Cleaning up Vitest environment...')

  // Final timeout cleanup
  globalTimeoutMonitor.cleanup()
  const finalActiveCount = globalTimeoutMonitor.getActiveCount()
  if (finalActiveCount.timeouts > 0 || finalActiveCount.intervals > 0) {
    console.warn(`⚠️ Final cleanup: ${finalActiveCount.timeouts} timeouts and ${finalActiveCount.intervals} intervals`)
  }

  // Close database connections with timeout
  try {
    if (db && typeof db.closeDatabase === 'function') {
      await Promise.race([
        db.closeDatabase(),
        new Promise((resolve) => setTimeout(() => {
          console.warn('⚠️ Database cleanup timed out')
          resolve(undefined)
        }, 5000))
      ])
      console.log('📦 Database connections closed')
    }
  } catch (error) {
    console.warn('⚠️ Database cleanup warning:', error.message)
  }

  // Force close any remaining connections
  try {
    // Clear any cached database instances
    if (typeof clearDbCache === 'function') {
      clearDbCache()
    }
  } catch (error) {
    console.warn('⚠️ Database cache cleanup warning:', error.message)
  }

  // Restore all mocks
  vi.restoreAllMocks()

  const testDuration = Date.now() - globalThis.__TEST_START_TIME__
  console.log(`✅ Vitest environment cleaned up (${testDuration}ms)`)
})

// Utility functions for tests
global.testUtils = {
  // Create a test user
  createTestUser: (overrides = {}) => ({
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  // Create test API credentials
  createTestApiCredentials: (overrides = {}) => ({
    id: 'test-creds-id',
    userId: 'test-user-id',
    mexcApiKey: 'encrypted_test-api-key',
    mexcSecretKey: 'encrypted_test-secret-key',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  // Create test trading data
  createTestTradingData: (overrides = {}) => ({
    symbol: 'BTCUSDT',
    price: '50000.00',
    quantity: '0.001',
    side: 'BUY',
    type: 'MARKET',
    timestamp: Date.now(),
    ...overrides
  }),

  // Wait for async operations
  waitFor: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Generate unique test IDs
  generateTestId: () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,

  // Mock API response helper
  mockApiResponse: (data, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers({
      'content-type': 'application/json'
    })
  }),

  // MEXC API specific mock response helper
  mockMexcApiResponse: (data, status = 200, extraHeaders = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers({
      'content-type': 'application/json',
      'x-ratelimit-remaining': '100',
      'x-ratelimit-limit': '1000',
      ...extraHeaders
    })
  }),

  // Validate fetch mock structure (helps catch missing headers in tests)
  validateFetchMock: (mockResponse) => {
    const required = ['ok', 'status', 'headers', 'json'];
    const missing = required.filter(prop => !(prop in mockResponse));
    if (missing.length > 0) {
      throw new Error(`Fetch mock missing required properties: ${missing.join(', ')}. Use testUtils.mockApiResponse() or testUtils.mockMexcApiResponse() helpers.`);
    }
    
    // Validate headers is a proper Headers object or has forEach method
    if (!mockResponse.headers || typeof mockResponse.headers.forEach !== 'function') {
      throw new Error('Fetch mock headers must be a Headers object with forEach method. Use new Headers({...}) or testUtils.mockApiResponse() helper.');
    }
    
    return true;
  },

  // Register cleanup function
  registerCleanup: (fn) => {
    if (!global.testCleanupFunctions) {
      global.testCleanupFunctions = []
    }
    global.testCleanupFunctions.push(fn)
  }
}

// Error handling for uncaught exceptions in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection in test:', reason)
  console.error('Promise:', promise)
})

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception in test:', error)
})

console.log('🚀 Vitest setup completed successfully')