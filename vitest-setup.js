import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock environment variables for testing
process.env.OPENAI_API_KEY = 'test-openai-key'
process.env.MEXC_API_KEY = 'test-mexc-key'
process.env.MEXC_SECRET_KEY = 'test-mexc-secret'
process.env.MEXC_BASE_URL = 'https://api.mexc.com'

// Mock AbortSignal.timeout for Node environments that don't support it
if (!AbortSignal.timeout) {
  AbortSignal.timeout = (delay) => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), delay)
    return controller.signal
  }
}

// Mock better-sqlite3 to avoid Node ABI issues
vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      pragma: vi.fn(),
      prepare: vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue({ test: 1 }),
        all: vi.fn().mockReturnValue([]),
        run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 })
      }),
      close: vi.fn()
    }))
  }
})

// Mock fetch for testing
global.fetch = vi.fn()

// Mock drizzle-orm functions
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  desc: vi.fn(),
  and: vi.fn(),
}))

// Mock the database module
vi.mock('@/src/db', () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{
      id: 'test-id',
      userId: 'default',
      systemStatus: 'stopped',
      lastUpdate: new Date('2024-01-01T00:00:00.000Z'),
      activeWorkflows: '[]',
      readyTokens: 0,
      totalDetections: 0,
      successfulSnipes: 0,
      totalProfit: 0,
      successRate: 0,
      averageROI: 0,
      bestTrade: 0,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  }

  return {
    db: mockDb,
    workflowSystemStatus: {},
    workflowActivity: {},
    userPreferences: {},
    initializeDatabase: vi.fn().mockResolvedValue(true),
    closeDatabase: vi.fn(),
  }
})