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

// Global test configuration
globalThis.__TEST_ENV__ = true
globalThis.__TEST_START_TIME__ = Date.now()

// Mock external dependencies
beforeAll(async () => {
  console.log('🧪 Setting up Vitest global environment...')
  
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
  
  // Mock database functions for isolated testing
  vi.mock('@/src/db', () => {
    const mockDb = {
      execute: vi.fn().mockResolvedValue([{ test_value: 1, count: '1' }]),
      query: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'mock-id' }])
        })
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
          limit: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn().mockResolvedValue([])
        })
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([])
        })
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([])
      }),
      transaction: vi.fn().mockImplementation(async (cb) => {
        return cb(mockDb)
      })
    }
    
    return {
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
    }
  })
  
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
  
  // Mock fetch for API calls
  global.fetch = vi.fn().mockImplementation((url, options) => {
    // Default mock response
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({ 
        success: true, 
        data: null,
        message: 'Mock API response'
      }),
      text: () => Promise.resolve('Mock response text'),
      headers: new Headers()
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
  
  // Close database connections
  try {
    if (db) {
      // Add database cleanup if needed
      console.log('📦 Database connections closed')
    }
  } catch (error) {
    console.warn('⚠️ Database cleanup warning:', error.message)
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