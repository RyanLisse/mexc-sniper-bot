/**
 * Vitest Mock Configurations
 *
 * Extracted from vitest-setup.ts for better modularity.
 * Contains all external dependency mocks and API mocks.
 */

import { vi } from 'vitest';
import { 
  createMockMexcService, 
  configureMexcTestEnvironment, 
  createMockSymbolEntry,
  createMockCalendarEntry,
  createMockActivityData 
} from '../utils/mexc-integration-utilities';

// ============================================================================
// Next.js Router Mocks
// ============================================================================

/**
 * Initialize Next.js navigation mocks
 */
export function initializeNextJSMocks(): void {
  vi.mock('next/navigation', () => ({
    useRouter: vi.fn(() => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    })),
    usePathname: vi.fn(() => '/'),
    useSearchParams: vi.fn(() => new URLSearchParams()),
    useParams: vi.fn(() => ({})),
    notFound: vi.fn(),
    redirect: vi.fn(),
  }));
}

// ============================================================================
// Kinde Auth SDK Mocks (to prevent Node.js environment errors)
// ============================================================================

/**
 * Initialize Kinde TypeScript SDK mocks to prevent Node.js environment check failures
 */
export function initializeKindeSDKMocks(): void {
  // Mock core Kinde TypeScript SDK
  vi.mock('@kinde-oss/kinde-typescript-sdk', () => ({
    createKindeServerClient: vi.fn(() => ({
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
    })),
    createKindeBrowserClient: vi.fn(() => ({
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null
    }))
  }));

  // Mock Kinde Auth NextJS server
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
  }));

  // Mock Kinde Auth NextJS client
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
  }));
}

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
 * Initialize MEXC API client mocks with standardized utilities
 */
export function initializeMexcApiMocks(): void {
  // Configure environment variables for consistent testing
  configureMexcTestEnvironment();

  vi.mock('@/src/services/mexc-api-client', () => ({
    MexcApiClient: vi.fn().mockImplementation(() => ({
      getServerTime: vi.fn().mockResolvedValue({ serverTime: Date.now() }),
      getSymbols: vi.fn().mockResolvedValue([
        { symbol: 'BTCUSDT', status: 'TRADING' },
        { symbol: 'ETHUSDT', status: 'TRADING' },
        { symbol: 'TESTUSDT', status: 'TRADING' }
      ]),
      getAccountInfo: vi.fn().mockResolvedValue({
        balances: [
          { asset: 'USDT', free: '10000.00', locked: '0.00' },
          { asset: 'BTC', free: '0.1', locked: '0.0' }
        ]
      }),
      testConnectivity: vi.fn().mockResolvedValue(true)
    }))
  }));

  // Mock safety coordinator and risk management services
  vi.mock('@/src/services/risk/comprehensive-safety-coordinator', () => ({
    ComprehensiveSafetyCoordinator: vi.fn().mockImplementation(() => ({
      assessSystemSafety: vi.fn().mockResolvedValue({
        overallSafety: 'SAFE',
        riskScore: 20,
        alerts: [],
        recommendations: []
      }),
      activateEmergencyProcedures: vi.fn().mockResolvedValue({
        success: true,
        proceduresActivated: ['circuit_breaker', 'position_halt']
      }),
      checkSystemHealth: vi.fn().mockResolvedValue({
        status: 'healthy',
        uptime: 99.9,
        criticalIssues: []
      }),
      monitorAgentBehavior: vi.fn().mockResolvedValue({
        agentHealth: 'good',
        anomalies: []
      }),
      coordinateRiskAssessment: vi.fn().mockResolvedValue({
        riskLevel: 'LOW',
        assessmentScore: 25
      }),
      validateSystemReadiness: vi.fn().mockResolvedValue({
        ready: true,
        validationResults: []
      }),
      initiateSafetyShutdown: vi.fn().mockResolvedValue({
        success: true,
        shutdownTime: Date.now()
      }),
      // Add EventEmitter methods required by integration tests
      on: vi.fn(),
      emit: vi.fn(),
      off: vi.fn(),
      removeListener: vi.fn(),
      removeAllListeners: vi.fn(),
      // Add methods used in integration tests  
      getStatus: vi.fn().mockReturnValue({
        overall: 'healthy',
        alerts: [],
        metrics: {},
        lastCheck: Date.now(),
        emergencyProceduresActive: false
      }),
      createAlert: vi.fn().mockResolvedValue('alert-123'),
      triggerEmergencyProcedure: vi.fn().mockResolvedValue(undefined),
      isEmergencyActive: vi.fn().mockReturnValue(false),
      // Enhanced event emitter simulation for better integration testing
      listeners: vi.fn().mockReturnValue([]),
      listenerCount: vi.fn().mockReturnValue(0),
      eventNames: vi.fn().mockReturnValue(['emergency_stop', 'safety_alert']),
      once: vi.fn(),
      prependListener: vi.fn(),
      prependOnceListener: vi.fn(),
      setMaxListeners: vi.fn(),
      getMaxListeners: vi.fn().mockReturnValue(10),
      rawListeners: vi.fn().mockReturnValue([]),
      // Add safety assessment methods
      assessEmergencyConditions: vi.fn().mockResolvedValue({
        shouldTriggerEmergency: false,
        riskLevel: 'LOW',
        triggers: []
      }),
      coordinateSystemShutdown: vi.fn().mockResolvedValue({
        success: true,
        shutdownTime: Date.now()
      })
    }))
  }));

  vi.mock('@/src/services/risk/advanced-risk-engine', () => ({
    AdvancedRiskEngine: vi.fn().mockImplementation(() => ({
      assessRisk: vi.fn().mockResolvedValue({
        riskScore: 30,
        riskLevel: 'LOW',
        factors: []
      }),
      validatePosition: vi.fn().mockResolvedValue({
        valid: true,
        warnings: []
      }),
      calculateMaxPosition: vi.fn().mockResolvedValue({
        maxSize: 1000,
        currency: 'USDT'
      }),
      // Add methods required by integration tests
      validatePositionSize: vi.fn().mockResolvedValue({
        approved: true,
        adjustedPositionSize: 1000,
        warnings: [],
        riskScore: 25
      }),
      updatePortfolioRisk: vi.fn().mockResolvedValue(undefined),
      updatePortfolioMetrics: vi.fn().mockImplementation(async (metrics: any) => {
        // Simulate emergency stop activation for significant portfolio decline
        const portfolioDecline = Math.abs(metrics.unrealizedPnL || 0) / 100000;
        if (portfolioDecline > 0.15) { // 15% decline threshold
          // Update the mock to return emergency active state
          (vi.mocked(vi.fn().mockReturnValue(true)) as any).mockReturnValue(true);
        }
        return undefined;
      }),
      isEmergencyStopActive: vi.fn().mockImplementation(() => {
        // Default to false, but can be overridden by updatePortfolioMetrics
        return false;
      }),
      assessTradeRisk: vi.fn().mockResolvedValue({
        approved: true,
        riskScore: 30,
        reasons: [],
        warnings: [],
        maxAllowedSize: 1000,
        estimatedImpact: 0.1,
        advancedMetrics: {}
      }),
      // Add emergency coordination methods
      activateEmergencyStop: vi.fn().mockImplementation(() => {
        // Set emergency active state when called
        return { success: true, timestamp: Date.now() };
      }),
      getEmergencyStatus: vi.fn().mockReturnValue({
        active: false,
        reason: null,
        activatedAt: null
      }),
      calculatePortfolioRisk: vi.fn().mockResolvedValue({
        totalRisk: 0.25,
        riskLevel: 'MODERATE',
        riskFactors: []
      }),
      // Portfolio monitoring
      monitorPortfolioHealth: vi.fn().mockResolvedValue({
        healthy: true,
        issues: [],
        recommendations: []
      })
    }))
  }));

  vi.mock('@/src/services/trading/multi-phase-trading-bot', () => ({
    MultiPhaseTradingBot: vi.fn().mockImplementation(() => ({
      executeStrategy: vi.fn().mockResolvedValue({
        success: true,
        result: {
          orderId: 'mock-order-123',
          status: 'FILLED'
        }
      }),
      getPositions: vi.fn().mockResolvedValue([]),
      updatePosition: vi.fn().mockResolvedValue({
        success: true
      }),
      // Add methods required by integration tests
      calculateOptimalEntry: vi.fn().mockReturnValue({
        entryPrice: 0.001,
        confidence: 85,
        adjustments: ['market_conditions_favorable'],
        symbol: 'TESTUSDT'
      }),
      initializePosition: vi.fn().mockReturnValue({
        success: true,
        details: {
          symbol: 'TESTUSDT',
          entryPrice: 0.001,
          amount: 1000,
          timestamp: new Date().toISOString()
        },
        message: 'Position initialized successfully'
      }),
      onPriceUpdate: vi.fn().mockReturnValue({
        actions: ['MONITOR'],
        status: { 
          priceIncrease: 0,
          summary: { completedPhases: 0, totalRemaining: 1000, realizedProfit: 0, unrealizedProfit: 0 },
          nextTarget: '25% gain'
        }
      }),
      getPositionInfo: vi.fn().mockReturnValue({
        hasPosition: true,
        symbol: 'TESTUSDT',
        entryPrice: 0.001,
        currentPosition: 1000,
        realizedPnL: 0,
        unrealizedPnL: 0,
        phases: {
          total: 3,
          completed: 0,
          active: 1,
          remaining: 3
        }
      }),
      getPhaseStatus: vi.fn().mockReturnValue({
        phaseDetails: [{ status: 'pending' }],
        completedPhases: 0
      }),
      handlePartialFill: vi.fn().mockReturnValue({
        success: true,
        executedAmount: 200,
        remainingAmount: 800
      }),
      performMaintenanceCleanup: vi.fn().mockReturnValue({
        success: true,
        cleanupTime: Date.now()
      }),
      getPendingPersistenceOperations: vi.fn().mockReturnValue({
        hasPending: false,
        operations: [],
        count: 0,
        lastAttempt: null
      })
    }))
  }));

  // Mock the unified MEXC service using standardized utilities
  vi.mock('@/src/services/api/unified-mexc-service-v2', () => {
    const baseMockService = createMockMexcService();
    
    return {
      UnifiedMexcServiceV2: vi.fn().mockImplementation(() => ({
        ...baseMockService,
        // Additional methods needed by integration tests
        getSymbols: vi.fn().mockResolvedValue({
          success: true,
          data: [
            { symbol: 'BTCUSDT', status: 'TRADING' },
            { symbol: 'ETHUSDT', status: 'TRADING' },
            { symbol: 'AUTOSNIPERXUSDT', status: 'TRADING' },
            { symbol: 'ADVANCEAUTOSNIPEUSDT', status: 'TRADING' },
            { symbol: 'TESTUSDT', status: 'TRADING' }
          ],
          timestamp: Date.now(),
          executionTimeMs: 120
        }),
        getAccountBalance: vi.fn().mockResolvedValue({
          success: true,
          data: [
            { asset: 'USDT', free: '10000.00', locked: '0.00' },
            { asset: 'BTC', free: '1.00000000', locked: '0.00000000' }
          ],
          timestamp: Date.now(),
          executionTimeMs: 180
        }),
        getAccountBalances: vi.fn().mockResolvedValue({
          success: true,
          data: [
            { asset: 'USDT', free: '10000.00', locked: '0.00' },
            { asset: 'BTC', free: '1.00000000', locked: '0.00000000' },
            { asset: 'ETH', free: '10.00000000', locked: '0.00000000' }
          ],
          timestamp: Date.now(),
          executionTimeMs: 180
        }),
        getRecentActivity: vi.fn().mockResolvedValue({
          success: true,
          data: {
            activities: [createMockActivityData({ currency: 'AUTOSNIPER' })]
          },
          timestamp: Date.now(),
          executionTimeMs: 200
        }),
        getPortfolio: vi.fn().mockResolvedValue({
          success: true,
          data: {
            totalValue: 10000,
            assets: [
              { asset: 'USDT', amount: 10000, value: 10000 }
            ]
          },
          timestamp: Date.now(),
          executionTimeMs: 150
        })
      })),
    
    // Factory functions
    createUnifiedMexcServiceV2: vi.fn().mockImplementation(() => ({
      getRecentActivity: vi.fn().mockResolvedValue({
        success: true,
        data: { activities: [] }
      }),
      getSymbols: vi.fn().mockResolvedValue({
        success: true,
        data: []
      }),
      getAccountInfo: vi.fn().mockResolvedValue({
        success: true,
        data: { balances: [] }
      }),
      getAccountBalance: vi.fn().mockResolvedValue({
        success: true,
        data: []
      }),
      getAccountBalances: vi.fn().mockResolvedValue({
        success: true,
        data: []
      }),
      testConnectivity: vi.fn().mockResolvedValue({
        success: true,
        data: { status: 'OK' }
      })
    })),
    
    getUnifiedMexcServiceV2: vi.fn().mockImplementation(() => ({
      getRecentActivity: vi.fn().mockResolvedValue({
        success: true,
        data: { activities: [] }
      }),
      getSymbols: vi.fn().mockResolvedValue({
        success: true,
        data: []
      }),
      getAccountInfo: vi.fn().mockResolvedValue({
        success: true,
        data: { balances: [] }
      }),
      getAccountBalance: vi.fn().mockResolvedValue({
        success: true,
        data: []
      }),
      getAccountBalances: vi.fn().mockResolvedValue({
        success: true,
        data: []
      }),
      testConnectivity: vi.fn().mockResolvedValue({
        success: true,
        data: { status: 'OK' }
      })
    })),
    
    // Export singleton instance
    unifiedMexcService: {
      getRecentActivity: vi.fn().mockResolvedValue({
        success: true,
        data: {
          activities: [
            {
              activityId: 'mock-activity-global',
              currency: 'AUTOSNIPER',
              currencyId: 'autosniper-global-id',
              activityType: 'SUN_SHINE'
            }
          ]
        }
      }),
      getSymbols: vi.fn().mockResolvedValue({
        success: true,
        data: [
          { symbol: 'BTCUSDT', status: 'TRADING' },
          { symbol: 'ETHUSDT', status: 'TRADING' }
        ]
      }),
      getAccountInfo: vi.fn().mockResolvedValue({
        success: true,
        data: {
          balances: [
            { asset: 'USDT', free: '10000.00', locked: '0.00' }
          ]
        }
      }),
      getAccountBalance: vi.fn().mockResolvedValue({
        success: true,
        data: []
      }),
      getAccountBalances: vi.fn().mockResolvedValue({
        success: true,
        data: []
      }),
      testConnectivity: vi.fn().mockResolvedValue({
        success: true,
        data: { status: 'OK', timestamp: Date.now() }
      }),
      clearCache: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockImplementation(() => {})
    }
  };
});

  // Mock the unified MEXC service exports (this is critical for calendar agent)
  vi.mock('@/src/services/api/mexc-unified-exports', () => ({
    // Mock the main factory function that creates service instances
    getRecommendedMexcService: vi.fn().mockImplementation(() => ({
      // Calendar methods - THIS IS THE KEY METHOD NEEDED BY CALENDAR AGENT
      getCalendarListings: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            vcoinId: 'test-coin-id',
            symbol: 'TESTCOIN',
            projectName: 'Test Coin Project',
            firstOpenTime: Date.now() + 3600000, // 1 hour from now
            vcoinName: 'TestCoin',
            vcoinNameFull: 'Test Coin Full Name',
            zone: 'innovation'
          }
        ],
        timestamp: Date.now(),
        source: 'mock-calendar-service'
      }),

      // Other essential methods that might be called
      getSymbolsByVcoinId: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        timestamp: Date.now()
      }),

      getAllSymbols: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        timestamp: Date.now()
      }),

      getSymbolsData: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        timestamp: Date.now()
      }),

      getSymbolsForVcoins: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        timestamp: Date.now()
      }),

      getServerTime: vi.fn().mockResolvedValue({
        success: true,
        data: Date.now(),
        timestamp: Date.now()
      }),

      getSymbolInfoBasic: vi.fn().mockResolvedValue({
        success: true,
        data: { symbol: 'TESTUSDT', status: 'TRADING' },
        timestamp: Date.now()
      }),

      getActivityData: vi.fn().mockResolvedValue({
        success: true,
        data: { activities: [] },
        timestamp: Date.now()
      }),

      detectReadyStatePatterns: vi.fn().mockResolvedValue({
        success: true,
        data: { readyStateCount: 0, totalSymbols: 0 },
        timestamp: Date.now()
      }),

      getMarketOverview: vi.fn().mockResolvedValue({
        success: true,
        data: { overview: 'market stable' },
        timestamp: Date.now()
      }),

      getAccountBalances: vi.fn().mockResolvedValue({
        success: true,
        data: { balances: [] },
        timestamp: Date.now()
      }),

      performHealthCheck: vi.fn().mockResolvedValue({
        healthy: true,
        timestamp: new Date().toISOString(),
        checks: {
          api: 'healthy',
          database: 'healthy',
          cache: 'healthy'
        }
      }),

      getMetrics: vi.fn().mockResolvedValue({
        requests: { total: 100, success: 95, failed: 5 },
        latency: { avg: 150, p95: 300, p99: 500 },
        cache: { hits: 80, misses: 20, hitRate: 0.8 }
      }),

      getCacheStats: vi.fn().mockResolvedValue({
        success: true,
        data: { hits: 80, misses: 20, size: 100 },
        timestamp: Date.now()
      }),

      getCircuitBreakerStatus: vi.fn().mockResolvedValue({
        success: true,
        data: { status: 'closed', failures: 0 },
        timestamp: Date.now()
      })
    })),

    // Mock other exports from the module
    getMexcService: vi.fn().mockImplementation(() => ({
      getCalendarListings: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        timestamp: Date.now()
      })
    })),

    createMexcService: vi.fn().mockImplementation(() => ({
      getCalendarListings: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        timestamp: Date.now()
      })
    })),

    getMexcClient: vi.fn().mockImplementation(() => ({
      getCalendarListings: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        timestamp: Date.now()
      })
    })),

    getUnifiedMexcClient: vi.fn().mockImplementation(() => ({
      getCalendarListings: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        timestamp: Date.now()
      }),
      getAccountBalances: vi.fn().mockResolvedValue({
        success: true,
        data: {
          balances: [],
          totalUsdtValue: 1000,
          totalValue: 1000,
          totalValueBTC: 0.1,
          allocation: {},
          performance24h: { change: 0, changePercent: 0 }
        },
        timestamp: Date.now()
      }),
      getAccountBalance: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        timestamp: Date.now()
      })
    })),

    // Type exports (these don't need mocking but included for completeness)
    ServiceResponse: {},
    MexcServiceResponse: {},
    CalendarEntry: {},
    SymbolEntry: {},
    BalanceEntry: {}
  }));

  // Mock the unified MEXC service factory module
  vi.mock('@/src/services/api/unified-mexc-service-factory', () => ({
    getUnifiedMexcService: vi.fn().mockResolvedValue({
      hasCredentials: vi.fn().mockReturnValue(true),
      getAccountBalances: vi.fn().mockResolvedValue({
        success: true,
        data: {
          balances: [
            { asset: 'USDT', free: '10000.00', locked: '0.00', total: 10000.0, usdtValue: 10000.0 },
            { asset: 'BTC', free: '0.001', locked: '0.000', total: 0.001, usdtValue: 50.0 }
          ],
          totalUsdtValue: 10050.0,
          lastUpdated: new Date().toISOString(),
          hasUserCredentials: true,
          credentialsType: "user-specific"
        },
        metadata: {
          requestDuration: "100ms",
          balanceCount: 2,
          credentialSource: "user-database"
        }
      }),
      testConnectivity: vi.fn().mockResolvedValue(true),
      getAccountInfo: vi.fn().mockResolvedValue({
        success: true,
        data: { balances: [] }
      }),
      getConfig: vi.fn().mockReturnValue({
        enabled: true,
        maxPositions: 5,
        maxDailyTrades: 10,
        positionSizeUSDT: 100,
        minConfidence: 80,
        allowedPatternTypes: ["ready_state"],
        emergencyStopEnabled: true,
        riskManagement: {
          maxDrawdown: 10,
          maxDailyLoss: 5,
          positionSizing: "fixed"
        }
      }),
      getExecutionReport: vi.fn().mockResolvedValue({
        status: 'idle',
        stats: { 
          totalTrades: 0, 
          successfulTrades: 0, 
          failedTrades: 0,
          currentDrawdown: 0,
          maxDrawdown: 0,
          successRate: 75,
          averageSlippage: 0.1,
          totalPnl: "0"
        },
        activePositions: [],
        recentExecutions: [],
        config: {},
        systemHealth: { apiConnection: true },
        health: { overall: 'healthy', apiConnection: true, patternEngine: true }
      }),
    })
  }));

  // Mock the mexc-client-factory module
  vi.mock('@/src/services/api/mexc-client-factory', () => ({
    UnifiedMexcClient: vi.fn().mockImplementation(() => ({
      getAccountBalances: vi.fn().mockResolvedValue({
        success: true,
        data: {
          balances: [],
          totalUsdtValue: 1000,
          totalValue: 1000,
          totalValueBTC: 0.1,
          allocation: {},
          performance24h: { change: 0, changePercent: 0 }
        },
        timestamp: Date.now()
      }),
      getAccountBalance: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        timestamp: Date.now()
      }),
      getCalendarListings: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        timestamp: Date.now()
      })
    })),
    getUnifiedMexcClient: vi.fn().mockImplementation(() => ({
      getAccountBalances: vi.fn().mockResolvedValue({
        success: true,
        data: {
          balances: [],
          totalUsdtValue: 1000,
          totalValue: 1000,
          totalValueBTC: 0.1,
          allocation: {},
          performance24h: { change: 0, changePercent: 0 }
        },
        timestamp: Date.now()
      }),
      getAccountBalance: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        timestamp: Date.now()
      }),
      getCalendarListings: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        timestamp: Date.now()
      })
    })),
    resetUnifiedMexcClient: vi.fn()
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

    // Handle API routes that need authentication (internal API)
    if (urlString.includes('/api/') && !urlString.includes('api.mexc.com') && !urlString.includes('kinde')) {
      // Mock successful authentication for internal API routes
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({
          success: true,
          data: {},
          message: 'Mock API response'
        }),
        text: () => Promise.resolve(JSON.stringify({
          success: true,
          data: {},
          message: 'Mock API response'
        })),
        headers: new Headers({
          'content-type': 'application/json',
          'authorization': 'Bearer mock-token'
        })
      });
    }

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
 * Initialize database mocks for unit tests with enhanced Drizzle ORM support
 */
export async function initializeDatabaseMocks(isIntegrationTest: boolean): Promise<void> {
  if (isIntegrationTest) {
    console.log('🔗 Skipping database mocks for integration tests');
    vi.unmock('@/src/db');
    vi.unmock('@/src/db/schema');
    return;
  }

  // Use enhanced database mocking system
  const { initializeEnhancedDatabaseMocks } = await import('./enhanced-database-mocks');
  initializeEnhancedDatabaseMocks();
}

// ============================================================================
// Master Mock Initializer
// ============================================================================

/**
 * Initialize all test mocks for external dependencies
 */
export async function initializeTestMocks(): Promise<void> {
  // Initialize Next.js navigation mocks
  initializeNextJSMocks();
  
  // Initialize Kinde Auth SDK mocks (must be first to prevent Node.js environment errors)
  initializeKindeSDKMocks();
  
  // Initialize all external API mocks
  initializeOpenAIMocks();
  initializeMexcApiMocks();
  initializeWebSocketMocks();
  
  // Initialize browser API mocks
  initializeBrowserMocks();
  
  // Initialize fetch mock
  initializeFetchMock();
}