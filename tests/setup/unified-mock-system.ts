/**
 * UNIFIED MOCK SYSTEM - Mock System & Environment Configuration Agent
 * 
 * Mission: Eliminate ALL mock system issues and environment configuration warnings
 * 
 * This centralized mock system provides:
 * - Consistent mock implementations across all test types
 * - GoTrueClient singleton pattern to prevent multiple instance warnings
 * - Unified environment configuration
 * - Optimized mock performance and reliability
 */

import { vi, type MockedFunction } from 'vitest'
import type { NextRequest } from 'next/server'

// Global mock store for consistent data across tests
export const mockStore = {
  users: new Map<string, any>(),
  sessions: new Map<string, any>(),
  apiCredentials: new Map<string, any>(),
  supabaseClients: new Map<string, any>(),
  
  reset() {
    this.users.clear()
    this.sessions.clear()
    this.apiCredentials.clear()
    this.supabaseClients.clear()
  },
  
  getOrCreate<T>(store: Map<string, T>, key: string, factory: () => T): T {
    if (!store.has(key)) {
      store.set(key, factory())
    }
    return store.get(key)!
  }
}

// SUPABASE CLIENT SINGLETON PATTERN - Eliminates GoTrueClient multiple instance warnings
let mockSupabaseBrowserClient: any = null
let mockSupabaseServerClient: any = null

const createMockSupabaseClient = (type: 'browser' | 'server') => {
  const mockAuth = {
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
      error: null
    }),
    signUp: vi.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: null
    }),
    signOut: vi.fn().mockResolvedValue({
      error: null
    }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    }),
    updateUser: vi.fn().mockResolvedValue({
      data: { user: null },
      error: null
    }),
    refreshSession: vi.fn().mockResolvedValue({
      data: { session: null },
      error: null
    }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({
      error: null
    })
  }

  const mockDatabase = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    contained: vi.fn().mockReturnThis(),
    rangeGt: vi.fn().mockReturnThis(),
    rangeGte: vi.fn().mockReturnThis(),
    rangeLt: vi.fn().mockReturnThis(),
    rangeLte: vi.fn().mockReturnThis(),
    rangeAdjacent: vi.fn().mockReturnThis(),
    overlaps: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    csv: vi.fn().mockResolvedValue({ data: '', error: null }),
    explain: vi.fn().mockResolvedValue({ data: null, error: null })
  }

  return {
    auth: mockAuth,
    from: vi.fn(() => mockDatabase),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: null, error: null }),
        download: vi.fn().mockResolvedValue({ data: null, error: null }),
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/file' } })
      }))
    },
    realtime: {
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnValue(Promise.resolve('SUBSCRIBED')),
        unsubscribe: vi.fn().mockReturnValue(Promise.resolve('UNSUBSCRIBED'))
      }),
      removeChannel: vi.fn()
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null })
    }
  }
}

// Singleton Supabase client instances - PREVENTS MULTIPLE GoTrueClient INSTANCES
export const getMockSupabaseBrowserClient = () => {
  if (!mockSupabaseBrowserClient) {
    mockSupabaseBrowserClient = createMockSupabaseClient('browser')
  }
  return mockSupabaseBrowserClient
}

export const getMockSupabaseServerClient = () => {
  if (!mockSupabaseServerClient) {
    mockSupabaseServerClient = createMockSupabaseClient('server')
  }
  return mockSupabaseServerClient
}

// UNIFIED MOCK IMPLEMENTATIONS

// Supabase SSR Mocks - ENHANCED SINGLETON PATTERN FOR TESTS
export const mockSupabaseSSR = () => {
  vi.doMock('@supabase/ssr', () => ({
    createBrowserClient: vi.fn(() => getMockSupabaseBrowserClient()),
    createServerClient: vi.fn(() => getMockSupabaseServerClient())
  }))
  
  // Mock the centralized client manager to prevent conflicts
  vi.doMock('@/src/lib/supabase-client-manager', () => ({
    getSupabaseBrowserClient: vi.fn(() => getMockSupabaseBrowserClient()),
    getSupabaseServerClient: vi.fn(() => Promise.resolve(getMockSupabaseServerClient())),
    getSupabaseAdminClient: vi.fn(() => getMockSupabaseServerClient()),
    getSupabaseMiddlewareClient: vi.fn(() => getMockSupabaseServerClient()),
    cleanupSupabaseClients: vi.fn(),
    validateSupabaseEnvironment: vi.fn(() => ({
      isValid: true,
      config: {
        url: 'https://test.supabase.co',
        hasAnonKey: true,
        hasServiceRoleKey: true
      }
    })),
    getSupabaseClientStatus: vi.fn(() => ({
      browser: { exists: true, envSignature: 'test' },
      server: { exists: true, cookieSignature: 'test' },
      admin: { exists: true }
    }))
  }))
  
  // Mock the legacy browser client
  vi.doMock('@/src/lib/supabase-browser-client', () => ({
    getSupabaseBrowserClient: vi.fn(() => getMockSupabaseBrowserClient()),
    createSupabaseBrowserClient: vi.fn(() => getMockSupabaseBrowserClient())
  }))
  
  // Mock the auth client
  vi.doMock('@/src/lib/supabase-auth', () => ({
    createSupabaseServerClient: vi.fn(() => Promise.resolve(getMockSupabaseServerClient())),
    createSupabaseAdminClient: vi.fn(() => getMockSupabaseServerClient()),
    getSession: vi.fn().mockResolvedValue({
      user: null,
      isAuthenticated: false
    }),
    getUser: vi.fn().mockResolvedValue(null),
    isAuthenticated: vi.fn().mockResolvedValue(false),
    syncUserWithDatabase: vi.fn().mockResolvedValue(true),
    getUserFromDatabase: vi.fn().mockResolvedValue(null),
    requireAuth: vi.fn().mockRejectedValue(new Error('Authentication required'))
  }))
  
  // Mock the middleware
  vi.doMock('@/src/lib/supabase-middleware', () => ({
    updateSession: vi.fn().mockImplementation((request) => {
      return Promise.resolve(new Response(null, { status: 200 }))
    }),
    middleware: vi.fn().mockImplementation((request) => {
      return Promise.resolve(new Response(null, { status: 200 }))
    })
  }))
}

// Next.js Framework Mocks
export const mockNextJs = () => {
  // Headers mock
  vi.doMock('next/headers', () => ({
    cookies: vi.fn(() => ({
      get: vi.fn((name: string) => {
        const mockCookies: Record<string, string> = {
          'sb-access-token': 'mock-access-token',
          'sb-refresh-token': 'mock-refresh-token'
        }
        return mockCookies[name] ? { value: mockCookies[name] } : undefined
      }),
      set: vi.fn(),
      delete: vi.fn(),
      has: vi.fn(),
      clear: vi.fn(),
      getAll: vi.fn(() => [])
    })),
    headers: vi.fn(() => ({
      get: vi.fn(),
      set: vi.fn(),
      has: vi.fn(),
      delete: vi.fn(),
      forEach: vi.fn(),
      entries: vi.fn(() => [])
    }))
  }))

  // Navigation mock
  vi.doMock('next/navigation', () => ({
    useRouter: vi.fn(() => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn()
    })),
    usePathname: vi.fn(() => '/'),
    useSearchParams: vi.fn(() => new URLSearchParams()),
    notFound: vi.fn(() => {
      throw new Error('NEXT_NOT_FOUND')
    }),
    redirect: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT: ${url}`)
    })
  }))

  // Server actions mock
  vi.doMock('next/server', () => ({
    NextRequest: vi.fn(),
    NextResponse: {
      json: vi.fn((data: any, init?: ResponseInit) => 
        new Response(JSON.stringify(data), {
          ...init,
          headers: {
            'content-type': 'application/json',
            ...init?.headers
          }
        })
      ),
      redirect: vi.fn((url: string) => 
        new Response(null, {
          status: 302,
          headers: { location: url }
        })
      ),
      next: vi.fn((init?: ResponseInit) => new Response(null, init))
    }
  }))
}

// Database Mocks
export const mockDatabase = () => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
    then: vi.fn((callback) => callback([])),
    catch: vi.fn((callback) => callback),
    transaction: vi.fn((callback) => callback(mockDb))
  }

  vi.doMock('@/src/db', () => ({
    db: mockDb,
    hasSupabaseConfig: vi.fn(() => true),
    clearDbCache: vi.fn().mockResolvedValue(true)
  }))

  vi.doMock('drizzle-orm', () => ({
    eq: vi.fn(),
    and: vi.fn(),
    or: vi.fn(),
    not: vi.fn(),
    gt: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    lte: vi.fn(),
    like: vi.fn(),
    ilike: vi.fn(),
    inArray: vi.fn(),
    notInArray: vi.fn(),
    isNull: vi.fn(),
    isNotNull: vi.fn(),
    exists: vi.fn(),
    notExists: vi.fn(),
    between: vi.fn(),
    notBetween: vi.fn(),
    sql: vi.fn()
  }))
}

// External API Mocks
export const mockExternalAPIs = () => {
  // MEXC API Mock
  global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    const urlString = url.toString()
    
    if (urlString.includes('mexc.com')) {
      return Promise.resolve(new Response(JSON.stringify({
        code: 200,
        data: { success: true },
        message: 'Mock MEXC API response'
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }))
    }
    
    if (urlString.includes('openai.com')) {
      return Promise.resolve(new Response(JSON.stringify({
        choices: [{ message: { content: 'Mock OpenAI response' } }]
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }))
    }
    
    // Default mock response
    return Promise.resolve(new Response(JSON.stringify({
      success: true,
      data: null
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }))
  })

  // WebSocket Mock
  global.WebSocket = vi.fn().mockImplementation(() => ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1, // OPEN
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
  })) as any
}

// Browser API Mocks
export const mockBrowserAPIs = () => {
  // LocalStorage Mock
  const localStorageMock = {
    getItem: vi.fn((key: string) => mockStore.getOrCreate(
      new Map(), 
      key, 
      () => null
    )),
    setItem: vi.fn((key: string, value: string) => {
      const storage = new Map()
      storage.set(key, value)
    }),
    removeItem: vi.fn(),
    clear: vi.fn()
  }
  Object.defineProperty(global, 'localStorage', { value: localStorageMock })

  // SessionStorage Mock
  Object.defineProperty(global, 'sessionStorage', { value: localStorageMock })

  // Document Mock
  Object.defineProperty(global, 'document', {
    value: {
      cookie: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      createElement: vi.fn(() => ({
        style: {},
        setAttribute: vi.fn(),
        getAttribute: vi.fn(),
        appendChild: vi.fn(),
        removeChild: vi.fn()
      })),
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
      getElementById: vi.fn()
    }
  })

  // Window Mock
  Object.defineProperty(global, 'window', {
    value: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      location: {
        href: 'http://localhost:3000',
        pathname: '/',
        search: '',
        hash: ''
      },
      history: {
        pushState: vi.fn(),
        replaceState: vi.fn(),
        back: vi.fn(),
        forward: vi.fn()
      },
      navigator: {
        userAgent: 'Mozilla/5.0 (Test Environment)',
        language: 'en-US'
      },
      crypto: {
        randomUUID: vi.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9))
      }
    }
  })
}

// React Testing Mocks
export const mockReactTesting = () => {
  vi.doMock('@testing-library/react', async () => {
    const actual = await vi.importActual('@testing-library/react')
    return {
      ...actual,
      render: vi.fn((component) => ({
        container: document.createElement('div'),
        getByText: vi.fn(),
        getByRole: vi.fn(),
        getByTestId: vi.fn(),
        queryByText: vi.fn(),
        queryByRole: vi.fn(),
        queryByTestId: vi.fn(),
        findByText: vi.fn(),
        findByRole: vi.fn(),
        findByTestId: vi.fn(),
        rerender: vi.fn(),
        unmount: vi.fn()
      }))
    }
  })
}

// Test Data Factories
export const createTestUser = (overrides: any = {}) => ({
  id: 'test-user-' + Math.random().toString(36).substr(2, 9),
  email: 'test@example.com',
  name: 'Test User',
  username: 'testuser',
  emailVerified: true,
  image: 'https://example.com/avatar.jpg',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
})

export const createTestSession = (user: any = null) => ({
  user: user || createTestUser(),
  isAuthenticated: true,
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresAt: new Date(Date.now() + 3600000)
})

export const createTestApiCredentials = (overrides: any = {}) => ({
  id: 'test-creds-' + Math.random().toString(36).substr(2, 9),
  userId: 'test-user-123',
  mexcApiKey: 'encrypted_test-api-key',
  mexcSecretKey: 'encrypted_test-secret-key',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
})

// MAIN INITIALIZATION FUNCTION
export const initializeUnifiedMockSystem = (options: {
  testType?: 'unit' | 'integration' | 'e2e'
  skipSupabase?: boolean
  skipDatabase?: boolean
  skipExternalAPIs?: boolean
  skipBrowserAPIs?: boolean
  skipReactTesting?: boolean
} = {}) => {
  const {
    testType = 'unit',
    skipSupabase = false,
    skipDatabase = false,
    skipExternalAPIs = false,
    skipBrowserAPIs = false,
    skipReactTesting = false
  } = options

  console.log(`🔧 Initializing unified mock system for ${testType} tests...`)

  // Reset mock store
  mockStore.reset()

  // Initialize mocks based on test type and options
  if (!skipSupabase) {
    mockSupabaseSSR()
  }

  if (!skipDatabase && testType !== 'integration') {
    mockDatabase()
  }

  if (!skipExternalAPIs) {
    mockExternalAPIs()
  }

  if (!skipBrowserAPIs) {
    mockBrowserAPIs()
  }

  if (!skipReactTesting && testType === 'unit') {
    mockReactTesting()
  }

  // Always mock Next.js for consistent behavior
  mockNextJs()

  console.log('✅ Unified mock system initialized successfully')

  return {
    mockStore,
    getMockSupabaseBrowserClient,
    getMockSupabaseServerClient,
    createTestUser,
    createTestSession,
    createTestApiCredentials
  }
}

// Cleanup function - ENHANCED FOR CLIENT MANAGER
export const cleanupUnifiedMockSystem = () => {
  console.log('🧹 Cleaning up unified mock system...')
  
  // Reset singleton clients
  mockSupabaseBrowserClient = null
  mockSupabaseServerClient = null
  
  // Clean up real client manager if available (for integration tests)
  try {
    const clientManager = require('@/src/lib/supabase-client-manager')
    if (clientManager.cleanupSupabaseClients) {
      clientManager.cleanupSupabaseClients()
      console.log('🧹 Real Supabase client manager cleaned up')
    }
  } catch (error) {
    // Expected in unit tests where real client manager is mocked
    console.debug('Client manager cleanup skipped (using mocks)')
  }
  
  // Reset mock store
  mockStore.reset()
  
  // Clear all mocks
  vi.clearAllMocks()
  
  console.log('✅ Unified mock system cleaned up')
}

// Export for global availability
if (typeof global !== 'undefined') {
  (global as any).unifiedMockSystem = {
    initializeUnifiedMockSystem,
    cleanupUnifiedMockSystem,
    mockStore,
    getMockSupabaseBrowserClient,
    getMockSupabaseServerClient,
    createTestUser,
    createTestSession,
    createTestApiCredentials
  }
}

export default {
  initializeUnifiedMockSystem,
  cleanupUnifiedMockSystem,
  mockStore,
  getMockSupabaseBrowserClient,
  getMockSupabaseServerClient,
  createTestUser,
  createTestSession,
  createTestApiCredentials
}