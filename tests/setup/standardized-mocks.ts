/**
 * Standardized Mock Setup Utilities
 * 
 * This file provides standardized mocking patterns to be used across all test files.
 * It helps ensure consistency and reduces mocking-related issues.
 */

import { vi } from 'vitest';
import type { ActivityData } from '@/src/schemas/unified/mexc-api-schemas';
import type { CalendarEntry, SymbolEntry } from '@/src/services/mexc-unified-exports';

// ============================================================================
// Standard Mock Data
// ============================================================================

export const standardMockData = {
  // Standard activity data for testing
  highPriorityActivity: {
    activityId: 'mock-activity-001',
    currency: 'TESTCOIN',
    currencyId: 'test-currency-id',
    activityType: 'SUN_SHINE'
  } as ActivityData,

  // Standard symbol entry for ready state testing
  readyStateSymbol: {
    sts: 2,
    st: 2,
    tt: 4,
    cd: 'TESTCOINUSDT',
    ca: 50000,
    ps: 10000,
    qs: 5000
  } as SymbolEntry,

  // Standard calendar entry for advance launch testing
  advanceLaunchEntry: {
    symbol: 'ADVANCETESTUSDT',
    vcoinId: 'advance-test-vcoin',
    firstOpenTime: Date.now() + (4 * 60 * 60 * 1000), // 4 hours future
    projectName: 'Advanced Test Project'
  } as CalendarEntry,

  // Standard MEXC API response format
  mexcResponse: {
    success: true,
    timestamp: Date.now(),
    executionTimeMs: 100
  },

  // Standard trading order data
  tradingOrder: {
    orderId: 'order-mock-123',
    symbol: 'TESTCOINUSDT',
    status: 'FILLED',
    price: '0.001',
    quantity: '1000000'
  }
};

// ============================================================================
// Activity Integration Module Mocks Setup
// ============================================================================

/**
 * Setup activity integration module mocks
 */
export function setupActivityIntegrationMocks() {
  // Return mock factory instead of using vi.mock directly
  return {
    getActivityDataForSymbol: vi
      .fn()
      .mockResolvedValue([{
        activityId: 'mock-activity-001',
        currency: 'TESTCOIN',
        currencyId: 'test-currency-id',
        activityType: 'SUN_SHINE'
      }]),
    hasActivityData: vi.fn().mockResolvedValue(true),
    getActivitySummary: vi.fn().mockResolvedValue({
      totalActivities: 1,
      activityTypes: ["SUN_SHINE"],
      hasRecentActivity: true,
      activities: [{
        activityId: 'mock-activity-001',
        currency: 'TESTCOIN',
        currencyId: 'test-currency-id',
        activityType: 'SUN_SHINE'
      }],
    }),
    extractBaseCurrency: vi.fn().mockImplementation((symbol: string) => 
      symbol.replace(/USDT$|BTC$|ETH$|BNB$/, "")
    ),
  };
}

// Remove duplicate - keeping the implementation above

// ============================================================================
// UnifiedMexcServiceV2 Mocks
// ============================================================================

/**
 * Setup standardized MEXC service mocks
 * @param mexcService - Instance of UnifiedMexcServiceV2 to mock
 */
export function setupMexcServiceMocks(mexcService: any) {
  // Safely mock activity data methods only if they exist
  if (mexcService && typeof mexcService.getActivityData === 'function') {
    vi.spyOn(mexcService, "getActivityData").mockImplementation(
      async (currency: string) => ({
        ...standardMockData.mexcResponse,
        data: [standardMockData.highPriorityActivity],
      }),
    );
  } else if (mexcService) {
    // Add missing method if service exists but method doesn't
    mexcService.getActivityData = vi.fn().mockImplementation(
      async (currency: string) => ({
        ...standardMockData.mexcResponse,
        data: [standardMockData.highPriorityActivity],
      }),
    );
  }

  if (mexcService && typeof mexcService.hasRecentActivity === 'function') {
    vi.spyOn(mexcService, "hasRecentActivity").mockResolvedValue(true);
  } else if (mexcService) {
    mexcService.hasRecentActivity = vi.fn().mockResolvedValue(true);
  }

  if (mexcService && typeof mexcService.getBulkActivityData === 'function') {
    vi.spyOn(mexcService, "getBulkActivityData").mockImplementation(
      async (currencies: string[]) => ({
        ...standardMockData.mexcResponse,
        data: currencies.map(() => [standardMockData.highPriorityActivity]),
      }),
    );
  } else if (mexcService) {
    mexcService.getBulkActivityData = vi.fn().mockImplementation(
      async (currencies: string[]) => ({
        ...standardMockData.mexcResponse,
        data: currencies.map(() => [standardMockData.highPriorityActivity]),
      }),
    );
  }

  // Mock symbol and market data methods
  if (mexcService && typeof mexcService.getSymbolData === 'function') {
    vi.spyOn(mexcService, "getSymbolData").mockImplementation(
      async (symbol: string) => ({
        ...standardMockData.mexcResponse,
        data: {
          symbol,
          lastPrice: symbol.includes("TEST") || symbol.includes("AUTOSNIPER") ? "0.001" : "50000",
          price: symbol.includes("TEST") || symbol.includes("AUTOSNIPER") ? "0.001" : "50000",
          priceChange: "0.000001",
          priceChangePercent: "5.5",
          volume: "1000000",
          quoteVolume: "1000",
          openPrice: symbol.includes("TEST") || symbol.includes("AUTOSNIPER") ? "0.0009" : "47500",
          highPrice: symbol.includes("TEST") || symbol.includes("AUTOSNIPER") ? "0.0012" : "52000",
          lowPrice: symbol.includes("TEST") || symbol.includes("AUTOSNIPER") ? "0.0008" : "46000",
          count: "12500",
        },
      }),
    );
  } else if (mexcService) {
    mexcService.getSymbolData = vi.fn().mockImplementation(
      async (symbol: string) => ({
        ...standardMockData.mexcResponse,
        data: {
          symbol,
          lastPrice: symbol.includes("TEST") || symbol.includes("AUTOSNIPER") ? "0.001" : "50000",
          price: symbol.includes("TEST") || symbol.includes("AUTOSNIPER") ? "0.001" : "50000",
          priceChange: "0.000001",
          priceChangePercent: "5.5",
          volume: "1000000",
          quoteVolume: "1000",
          openPrice: symbol.includes("TEST") || symbol.includes("AUTOSNIPER") ? "0.0009" : "47500",
          highPrice: symbol.includes("TEST") || symbol.includes("AUTOSNIPER") ? "0.0012" : "52000",
          lowPrice: symbol.includes("TEST") || symbol.includes("AUTOSNIPER") ? "0.0008" : "46000",
          count: "12500",
        },
      }),
    );
  }

  if (mexcService && typeof mexcService.getAllSymbols === 'function') {
    vi.spyOn(mexcService, "getAllSymbols").mockResolvedValue({
      ...standardMockData.mexcResponse,
      data: [standardMockData.readyStateSymbol],
    });
  } else if (mexcService) {
    mexcService.getAllSymbols = vi.fn().mockResolvedValue({
      ...standardMockData.mexcResponse,
      data: [standardMockData.readyStateSymbol],
    });
  }

  // Add missing getSymbolInfoBasic method
  if (mexcService && typeof mexcService.getSymbolInfoBasic === 'function') {
    vi.spyOn(mexcService, "getSymbolInfoBasic").mockResolvedValue({
      ...standardMockData.mexcResponse,
      data: {
        symbol: "TESTUSDT",
        baseAsset: "TEST",
        quoteAsset: "USDT",
        status: "TRADING",
        tickSize: "0.000001",
        stepSize: "0.001",
        minQty: "0.001",
        maxQty: "1000000",
        minNotional: "5",
      },
    });
  } else if (mexcService) {
    mexcService.getSymbolInfoBasic = vi.fn().mockResolvedValue({
      ...standardMockData.mexcResponse,
      data: {
        symbol: "TESTUSDT",
        baseAsset: "TEST",
        quoteAsset: "USDT",
        status: "TRADING",
        tickSize: "0.000001",
        stepSize: "0.001",
        minQty: "0.001",
        maxQty: "1000000",
        minNotional: "5",
      },
    });
  }

  // Add missing getTicker method
  if (mexcService && typeof mexcService.getTicker === 'function') {
    vi.spyOn(mexcService, "getTicker").mockImplementation(async (symbol: string) => ({
      ...standardMockData.mexcResponse,
      data: {
        symbol,
        lastPrice: symbol.includes("TEST") || symbol.includes("AUTOSNIPER") ? "0.001" : "50000",
        price: symbol.includes("TEST") || symbol.includes("AUTOSNIPER") ? "0.001" : "50000",
        priceChange: "0.000001",
        priceChangePercent: "5.5",
        volume: "1000000",
        quoteVolume: "1000",
        count: "12500",
      },
    }));
  } else if (mexcService) {
    mexcService.getTicker = vi.fn().mockImplementation(async (symbol: string) => ({
      ...standardMockData.mexcResponse,
      data: {
        symbol,
        lastPrice: symbol.includes("TEST") || symbol.includes("AUTOSNIPER") ? "0.001" : "50000",
        price: symbol.includes("TEST") || symbol.includes("AUTOSNIPER") ? "0.001" : "50000",
        priceChange: "0.000001",
        priceChangePercent: "5.5",
        volume: "1000000",
        quoteVolume: "1000",
        count: "12500",
      },
    }));
  }

  // Add missing getAccountBalances method
  if (mexcService && typeof mexcService.getAccountBalances === 'function') {
    vi.spyOn(mexcService, "getAccountBalances").mockResolvedValue({
      ...standardMockData.mexcResponse,
      data: [
        { asset: "USDT", free: "1000.00", locked: "0.00" },
        { asset: "BTC", free: "0.1", locked: "0.0" },
      ],
    });
  } else if (mexcService) {
    mexcService.getAccountBalances = vi.fn().mockResolvedValue({
      ...standardMockData.mexcResponse,
      data: [
        { asset: "USDT", free: "1000.00", locked: "0.00" },
        { asset: "BTC", free: "0.1", locked: "0.0" },
      ],
    });
  }

  // Add missing hasValidCredentials method
  if (mexcService && typeof mexcService.hasValidCredentials === 'function') {
    vi.spyOn(mexcService, "hasValidCredentials").mockReturnValue(true);
  } else if (mexcService) {
    mexcService.hasValidCredentials = vi.fn().mockReturnValue(true);
  }

  if (mexcService && typeof mexcService.getSymbolsByVcoinId === 'function') {
    vi.spyOn(mexcService, "getSymbolsByVcoinId").mockResolvedValue({
      ...standardMockData.mexcResponse,
      data: [standardMockData.readyStateSymbol],
    });
  } else if (mexcService) {
    mexcService.getSymbolsByVcoinId = vi.fn().mockResolvedValue({
      ...standardMockData.mexcResponse,
      data: [standardMockData.readyStateSymbol],
    });
  }

  if (mexcService && typeof mexcService.getCalendarListings === 'function') {
    vi.spyOn(mexcService, "getCalendarListings").mockResolvedValue({
      ...standardMockData.mexcResponse,
      data: [standardMockData.advanceLaunchEntry],
    });
  } else if (mexcService) {
    mexcService.getCalendarListings = vi.fn().mockResolvedValue({
      ...standardMockData.mexcResponse,
      data: [standardMockData.advanceLaunchEntry],
    });
  }

  // Mock server time
  if (mexcService && typeof mexcService.getServerTime === 'function') {
    vi.spyOn(mexcService, "getServerTime").mockResolvedValue({
      ...standardMockData.mexcResponse,
      data: Date.now(),
    });
  } else if (mexcService) {
    mexcService.getServerTime = vi.fn().mockResolvedValue({
      ...standardMockData.mexcResponse,
      data: Date.now(),
    });
  }

  // Mock symbol info - check if method exists first
  if (mexcService.getSymbolInfoBasic && typeof mexcService.getSymbolInfoBasic === 'function') {
    vi.spyOn(mexcService, "getSymbolInfoBasic").mockImplementation(
      async (symbolName: string) => ({
        ...standardMockData.mexcResponse,
        data: {
          symbol: symbolName,
          status: 'TRADING',
          baseAsset: symbolName.replace('USDT', ''),
          quoteAsset: 'USDT',
          baseAssetPrecision: 8,
          quotePrecision: 8,
        },
      }),
    );
  } else {
    console.warn('[Mock Setup] getSymbolInfoBasic method not found on mexcService');
  }

  // Mock activity data
  if (mexcService.getActivityData && typeof mexcService.getActivityData === 'function') {
    vi.spyOn(mexcService, "getActivityData").mockImplementation(
      async (currency: string) => ({
        ...standardMockData.mexcResponse,
        data: [{
          activityId: `mock-activity-${currency}`,
          currency: currency,
          currencyId: `${currency.toLowerCase()}-id`,
          activityType: 'SUN_SHINE',
          status: 'active',
          timestamp: Date.now()
        }],
      }),
    );
  } else {
    console.warn('[Mock Setup] getActivityData method not found on mexcService');
  }
}

// ============================================================================
// Pattern Detection Core Mocks
// ============================================================================

/**
 * Setup pattern detection core mocks
 * @param patternEngine - Instance of PatternDetectionCore to mock
 */
export function setupPatternDetectionMocks(patternEngine: any) {
  // Mock pattern detection methods
  vi.spyOn(patternEngine, "detectReadyStatePattern").mockResolvedValue([
    {
      patternType: "ready_state",
      confidence: 85,
      symbol: standardMockData.readyStateSymbol.cd, // Fixed: use symbol field instead of data
      recommendation: "immediate_action",
      data: standardMockData.readyStateSymbol,
      timestamp: Date.now(),
    },
  ]);

  vi.spyOn(patternEngine, "detectAdvanceOpportunities").mockResolvedValue([
    {
      patternType: "launch_sequence",
      confidence: 80,
      advanceNoticeHours: 4,
      recommendation: "prepare_entry",
      data: standardMockData.advanceLaunchEntry,
      timestamp: Date.now(),
    },
  ]);

  // Mock enhanced analysis methods if they exist
  if (typeof patternEngine.enhanceWithActivity === 'function') {
    vi.spyOn(patternEngine, "enhanceWithActivity").mockResolvedValue({
      enhancedConfidence: 90,
      activityBoost: 5,
      reasoning: "High activity detected for symbol",
    });
  }
}

// ============================================================================
// AI Service Mocks
// ============================================================================

/**
 * Setup global AI service mocks to prevent external API calls
 */
export function setupGlobalAIMocks() {
  // Mock AI Intelligence Service globally
  if (typeof global !== "undefined") {
    (global as any).aiIntelligenceService = {
      enhanceConfidence: vi.fn().mockResolvedValue({
        enhancedConfidence: 90,
        boost: 5,
        reasoning: "Mock AI confidence enhancement",
      }),
      enhancePatternWithAI: vi.fn().mockResolvedValue({
        symbolName: "TESTUSDT",
        type: "ready_state" as const,
        confidence: 85,
        aiContext: {
          marketSentiment: "neutral",
          opportunityScore: 85,
          researchInsights: ["Mock AI insight"],
          timeframe: "immediate",
          volumeProfile: "medium",
          liquidityScore: 0.75,
        },
      }),
    };

    // Mock Activity Service
    (global as any).activityService = {
      getRecentActivity: vi.fn().mockResolvedValue([standardMockData.highPriorityActivity]),
    };

    // Mock Multi-Phase Trading Service
    (global as any).multiPhaseTradingService = {
      getHistoricalSuccessRates: vi.fn().mockResolvedValue({
        timeframeDays: 30,
        totalTrades: 120,
        successRate: 0.82,
        averageReturn: 0.148,
      }),
    };
  }
}

// ============================================================================
// Singleton Reset Utilities
// ============================================================================

/**
 * Reset singleton instances to prevent test interference
 */
export function resetSingletons() {
  // Reset PatternDetectionCore singleton
  try {
    const { PatternDetectionCore } = require("../../src/core/pattern-detection/pattern-detection-core.ts");
    if (PatternDetectionCore && PatternDetectionCore.getInstance) {
      (PatternDetectionCore as any).instance = undefined;
    }
  } catch (error) {
    console.warn("[Mock Setup] Could not reset PatternDetectionCore singleton:", error.message);
  }

  // Reset other singletons if they exist
  try {
    const { clearSingletonInstances } = require("../../src/lib/singleton-manager");
    if (typeof clearSingletonInstances === 'function') {
      clearSingletonInstances();
    }
  } catch (error) {
    // Singleton manager doesn't exist, skip
  }
}

// ============================================================================
// Standard Cleanup Function
// ============================================================================

/**
 * Standard cleanup function to be used in afterEach
 */
export function standardTestCleanup() {
  vi.clearAllMocks();
  // vi.resetAllMocks() is not available in this vitest version
  resetSingletons();
}

// ============================================================================
// Complete Test Setup Function
// ============================================================================

/**
 * Complete standardized test setup - call this in beforeAll
 * @param options - Configuration options for test setup
 */
export function setupStandardizedTests(options: {
  enableActivityMocks?: boolean;
  enableAIMocks?: boolean;
  enableDatabaseMocks?: boolean;
} = {}) {
  const {
    enableActivityMocks = true,
    enableAIMocks = true,
    enableDatabaseMocks = false
  } = options;

  if (enableActivityMocks) {
    setupActivityIntegrationMocks();
  }

  if (enableAIMocks) {
    setupGlobalAIMocks();
  }

  if (enableDatabaseMocks) {
    // Database mocks are handled by vitest-setup.ts globally
    console.log('📦 Database mocks enabled via global setup');
  }

  console.log('✅ Standardized test mocks configured');
}

/**
 * Service-specific setup for tests that need specific service instances
 * @param services - Object containing service instances to mock
 */
export function setupServiceMocks(services: {
  mexcService?: any;
  patternEngine?: any;
  tradingBot?: any;
  riskEngine?: any;
  safetyCoordinator?: any;
}) {
  const { mexcService, patternEngine, tradingBot, riskEngine, safetyCoordinator } = services;

  if (mexcService) {
    setupMexcServiceMocks(mexcService);
  }

  if (patternEngine) {
    setupPatternDetectionMocks(patternEngine);
  }

  // Add more service-specific mocks as needed
  if (tradingBot) {
    vi.spyOn(tradingBot, "calculateOptimalEntry").mockReturnValue({
      entryPrice: 0.001,
      confidence: 80,
      adjustments: [],
    });

    vi.spyOn(tradingBot, "initializePosition").mockReturnValue(undefined);
    
    vi.spyOn(tradingBot, "onPriceUpdate").mockReturnValue({
      status: "monitoring",
      currentPrice: 0.001,
      unrealizedPnL: 0,
    });

    vi.spyOn(tradingBot, "getPositionInfo").mockReturnValue({
      symbol: "TESTCOINUSDT",
      entryPrice: 0.001,
      amount: 1000000,
      status: "active",
    });
  }

  if (riskEngine) {
    vi.spyOn(riskEngine, "validatePositionSize").mockResolvedValue({
      approved: true,
      adjustedPositionSize: 10000,
      reasoning: "Position size within limits",
    });

    vi.spyOn(riskEngine, "isEmergencyStopActive").mockReturnValue(false);
    
    vi.spyOn(riskEngine, "updatePortfolioMetrics").mockResolvedValue(undefined);
  }

  if (safetyCoordinator) {
    vi.spyOn(safetyCoordinator, "assessSystemSafety").mockResolvedValue({
      overallRisk: "low",
      emergencyAction: false,
      alerts: [],
    });

    // Mock event emitter methods if they exist
    if (typeof safetyCoordinator.on === 'function') {
      vi.spyOn(safetyCoordinator, "on").mockImplementation(() => {});
    }
  }

  console.log('✅ Service-specific mocks configured');
}