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