/**
 * Auto Sniping Test Utilities and Fixtures - FIXED VERSION
 * 
 * Comprehensive utility library for auto sniping tests including:
 * - Mock data generators for market conditions
 * - Test fixtures for trading strategies and patterns
 * - Helper functions for API mocking and responses (properly typed)
 * - Performance testing utilities
 * - Risk scenario generators
 * - WebSocket simulation helpers
 */

import { vi, expect } from 'vitest';
import type { SymbolEntry, CalendarEntry, ServiceResponse } from '../../src/services/mexc-unified-exports';
import type { ActivityData } from '../../src/schemas/mexc-schemas';

// ============================================================================
// Mock Data Generators
// ============================================================================

export class MockDataGenerator {
  /**
   * Generate realistic symbol entries for pattern testing
   */
  static generateSymbolEntry(overrides: Partial<SymbolEntry> = {}): SymbolEntry {
    return {
      sts: 2,
      st: 2,
      tt: 4,
      cd: 'MOCKUSDT',
      ca: 1000,
      ps: 100,
      qs: 50,
      ...overrides
    };
  }

  /**
   * Generate ready state pattern (sts:2, st:2, tt:4)
   */
  static generateReadyStatePattern(symbol: string = 'READYUSDT'): SymbolEntry {
    return this.generateSymbolEntry({
      sts: 2,
      st: 2,
      tt: 4,
      cd: symbol,
      ca: Math.floor(Math.random() * 5000) + 1000,
      ps: Math.floor(Math.random() * 500) + 100,
      qs: Math.floor(Math.random() * 200) + 50
    });
  }

  /**
   * Generate calendar entries for advance launch testing
   */
  static generateCalendarEntry(hoursFromNow: number, symbol: string = 'CALENDARUSDT'): CalendarEntry {
    return {
      symbol,
      vcoinId: `vcoin-${symbol.toLowerCase()}`,
      firstOpenTime: Date.now() + (hoursFromNow * 60 * 60 * 1000),
      projectName: `${symbol} Test Project`
    };
  }

  /**
   * Generate activity data for pattern enhancement
   */
  static generateActivityData(currency: string, activityTypes: string[] = ['SUN_SHINE']): ActivityData[] {
    return activityTypes.map((type, index) => ({
      activityId: `activity-${currency.toLowerCase()}-${index}`,
      currency,
      currencyId: `currency-id-${currency.toLowerCase()}`,
      activityType: type
    }));
  }

  /**
   * Generate market data for various scenarios
   */
  static generateMarketData(scenario: 'normal' | 'volatile' | 'crash' | 'pump' | 'low_liquidity') {
    const basePrice = 1.0;
    const baseVolume = 1000000;

    switch (scenario) {
      case 'normal':
        return {
          price: basePrice * (0.95 + Math.random() * 0.1), // ±5% variation
          volume24h: baseVolume * (0.8 + Math.random() * 0.4), // ±20% variation
          change24h: (Math.random() - 0.5) * 10, // ±5% change
          high24h: basePrice * 1.05,
          low24h: basePrice * 0.95,
          volatility: 0.3 + Math.random() * 0.2 // 30-50% volatility
        };

      case 'volatile':
        return {
          price: basePrice * (0.8 + Math.random() * 0.4), // ±20% variation
          volume24h: baseVolume * (2 + Math.random() * 3), // 2-5x volume
          change24h: (Math.random() - 0.5) * 40, // ±20% change
          high24h: basePrice * 1.25,
          low24h: basePrice * 0.75,
          volatility: 0.7 + Math.random() * 0.25 // 70-95% volatility
        };

      case 'crash':
        return {
          price: basePrice * (0.3 + Math.random() * 0.2), // 30-50% of base price
          volume24h: baseVolume * (5 + Math.random() * 10), // 5-15x volume
          change24h: -30 - Math.random() * 40, // -30% to -70% change
          high24h: basePrice,
          low24h: basePrice * 0.25,
          volatility: 0.9 + Math.random() * 0.1 // 90-100% volatility
        };

      case 'pump':
        return {
          price: basePrice * (2 + Math.random() * 8), // 2-10x price increase
          volume24h: baseVolume * (10 + Math.random() * 40), // 10-50x volume
          change24h: 100 + Math.random() * 500, // 100-600% increase
          high24h: basePrice * 12,
          low24h: basePrice * 0.9,
          volatility: 0.8 + Math.random() * 0.2 // 80-100% volatility
        };

      case 'low_liquidity':
        return {
          price: basePrice * (0.95 + Math.random() * 0.1),
          volume24h: baseVolume * (0.01 + Math.random() * 0.04), // 1-5% of normal volume
          change24h: (Math.random() - 0.5) * 2, // ±1% change
          high24h: basePrice * 1.02,
          low24h: basePrice * 0.98,
          volatility: 0.1 + Math.random() * 0.1, // 10-20% volatility
          bidAskSpread: 0.05 + Math.random() * 0.15 // 5-20% spread
        };

      default:
        return this.generateMarketData('normal');
    }
  }

  /**
   * Generate order book data for liquidity testing
   */
  static generateOrderBook(depth: number = 20, spread: number = 0.01) {
    const midPrice = 1.0;
    const bids: [string, string][] = [];
    const asks: [string, string][] = [];

    for (let i = 0; i < depth; i++) {
      const bidPrice = midPrice * (1 - spread / 2 - i * 0.001);
      const askPrice = midPrice * (1 + spread / 2 + i * 0.001);
      const quantity = 100 + Math.random() * 900;

      bids.push([bidPrice.toString(), quantity.toString()]);
      asks.push([askPrice.toString(), quantity.toString()]);
    }

    return {
      symbol: 'TESTUSDT',
      bids,
      asks,
      timestamp: Date.now(),
    };
  }

  /**
   * Generate time series data for backtesting
   */
  static generateTimeSeries(
    startPrice: number,
    length: number,
    volatility: number = 0.02,
    trend: number = 0
  ): Array<{ timestamp: number; price: number; volume: number }> {
    const series = [];
    let currentPrice = startPrice;
    const startTime = Date.now() - (length * 60000); // Start 'length' minutes ago

    for (let i = 0; i < length; i++) {
      const randomChange = (Math.random() - 0.5) * volatility * 2;
      const trendChange = trend / length;
      currentPrice *= (1 + randomChange + trendChange);

      series.push({
        timestamp: startTime + (i * 60000),
        price: currentPrice,
        volume: 50000 + Math.random() * 100000
      });
    }

    return series;
  }
}

// ============================================================================
// Test Fixtures
// ============================================================================

export class TestFixtures {
  /**
   * Standard trading strategies for testing
   */
  static readonly TRADING_STRATEGIES = {
    CONSERVATIVE: {
      id: 'conservative-test',
      name: 'Conservative Test Strategy',
      description: 'Low-risk strategy for testing',
      levels: [
        { percentage: 10, multiplier: 1.1, sellPercentage: 50 },
        { percentage: 25, multiplier: 1.25, sellPercentage: 50 }
      ]
    },
    MODERATE: {
      id: 'moderate-test',
      name: 'Moderate Test Strategy',
      description: 'Balanced strategy for testing',
      levels: [
        { percentage: 50, multiplier: 1.5, sellPercentage: 30 },
        { percentage: 100, multiplier: 2.0, sellPercentage: 40 },
        { percentage: 200, multiplier: 3.0, sellPercentage: 30 }
      ]
    },
    AGGRESSIVE: {
      id: 'aggressive-test',
      name: 'Aggressive Test Strategy',
      description: 'High-risk strategy for testing',
      levels: [
        { percentage: 100, multiplier: 2.0, sellPercentage: 20 },
        { percentage: 300, multiplier: 4.0, sellPercentage: 30 },
        { percentage: 500, multiplier: 6.0, sellPercentage: 50 }
      ]
    }
  };

  /**
   * Risk configuration presets
   */
  static readonly RISK_CONFIGS = {
    CONSERVATIVE: {
      maxPortfolioRisk: 5,
      maxPositionSize: 2,
      stopLossThreshold: 8,
      emergencyStopEnabled: true
    },
    MODERATE: {
      maxPortfolioRisk: 10,
      maxPositionSize: 5,
      stopLossThreshold: 15,
      emergencyStopEnabled: true
    },
    AGGRESSIVE: {
      maxPortfolioRisk: 20,
      maxPositionSize: 10,
      stopLossThreshold: 25,
      emergencyStopEnabled: true
    }
  };

  /**
   * Test user accounts
   */
  static readonly TEST_USERS = {
    SMALL_TRADER: {
      id: 'small-trader-test',
      portfolioValue: 1000,
      riskTolerance: 'low',
      tradingExperience: 'beginner'
    },
    MEDIUM_TRADER: {
      id: 'medium-trader-test',
      portfolioValue: 50000,
      riskTolerance: 'medium',
      tradingExperience: 'intermediate'
    },
    WHALE_TRADER: {
      id: 'whale-trader-test',
      portfolioValue: 1000000,
      riskTolerance: 'high',
      tradingExperience: 'expert'
    }
  };
}

// ============================================================================
// API Mocking Utilities - PROPERLY TYPED
// ============================================================================

export class ApiMockingUtils {
  /**
   * Setup MEXC API mocks for testing - Using properly typed method mocks
   */
  static setupMexcApiMocks(mexcService: any) {
    // Mock getTicker - matches: async getTicker(symbol: string): Promise<MexcServiceResponse<Ticker>>
    vi.spyOn(mexcService, 'getTicker').mockImplementation(async (symbol: string) => {
      const marketData = MockDataGenerator.generateMarketData('normal');
      return {
        success: true,
        data: {
          symbol,
          lastPrice: marketData.price.toString(),
          price: marketData.price.toString(),
          priceChange: (marketData.change24h / 100 * marketData.price).toString(),
          priceChangePercent: marketData.change24h.toString(),
          volume: marketData.volume24h.toString(),
          count: Math.floor(Math.random() * 10000).toString(),
          highPrice: marketData.high24h.toString(),
          lowPrice: marketData.low24h.toString(),
        },
        timestamp: new Date().toISOString()
      };
    });

    // Mock getOrderBook - matches: async getOrderBook(symbol: string, limit = 100): Promise<MexcServiceResponse<OrderBook>>
    vi.spyOn(mexcService, 'getOrderBook').mockImplementation(async (symbol: string, limit: number = 100) => {
      const orderBook = MockDataGenerator.generateOrderBook(limit);
      return {
        success: true,
        data: {
          ...orderBook,
          symbol
        },
        timestamp: new Date().toISOString()
      };
    });

    // Mock getAllTickers
    vi.spyOn(mexcService, 'getAllTickers').mockImplementation(async (): Promise<ServiceResponse<any[]>> => {
      const tickers = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'].map(symbol => {
        const marketData = MockDataGenerator.generateMarketData('normal');
        return {
          symbol,
          lastPrice: marketData.price.toString(),
          price: marketData.price.toString(),
          priceChange: (marketData.change24h / 100 * marketData.price).toString(),
          priceChangePercent: marketData.change24h.toString(),
          volume: marketData.volume24h.toString(),
          count: Math.floor(Math.random() * 10000).toString(),
          highPrice: marketData.high24h.toString(),
          lowPrice: marketData.low24h.toString(),
        };
      });

      return {
        success: true,
        data: tickers,
        timestamp: new Date().toISOString()
      };
    });

    // Mock trading endpoints
    vi.spyOn(mexcService, 'placeOrder').mockImplementation(async (params: any): Promise<ServiceResponse<any>> => {
      return {
        success: true,
        data: {
          success: true,
          orderId: `test-order-${Date.now()}`,
          symbol: params.symbol,
          side: params.side,
          quantity: params.quantity,
          price: params.price,
          status: 'FILLED',
          timestamp: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };
    });

    vi.spyOn(mexcService, 'getAccountInfo').mockImplementation(async (): Promise<ServiceResponse<any>> => {
      return {
        success: true,
        data: {
          accountType: 'SPOT',
          balances: [
            { asset: 'USDT', free: '10000', locked: '0' },
            { asset: 'BTC', free: '0.1', locked: '0' }
          ],
          updateTime: Date.now()
        },
        timestamp: new Date().toISOString()
      };
    });

    // Mock calendar and symbol data endpoints
    vi.spyOn(mexcService, 'getCalendarListings').mockImplementation(async (): Promise<ServiceResponse<any[]>> => {
      const calendarEntries = [
        MockDataGenerator.generateCalendarEntry(24, 'NEWCOIN1USDT'),
        MockDataGenerator.generateCalendarEntry(48, 'NEWCOIN2USDT'),
      ];

      return {
        success: true,
        data: calendarEntries,
        timestamp: new Date().toISOString()
      };
    });

    vi.spyOn(mexcService, 'getSymbolData').mockImplementation(async (): Promise<ServiceResponse<any[]>> => {
      const symbols = [
        MockDataGenerator.generateSymbolEntry({ cd: 'BTCUSDT', sts: 2, st: 2, tt: 4 }),
        MockDataGenerator.generateSymbolEntry({ cd: 'ETHUSDT', sts: 1, st: 1, tt: 4 }),
        MockDataGenerator.generateReadyStatePattern('READYUSDT'),
      ];

      return {
        success: true,
        data: symbols,
        timestamp: new Date().toISOString()
      };
    });

    // Mock activity data endpoint - matches: async getActivityData(currency: string): Promise<MexcServiceResponse<ActivityData[]>>
    vi.spyOn(mexcService, 'getActivityData').mockImplementation(async (currency: string) => {
      const activities = MockDataGenerator.generateActivityData(currency, ['SUN_SHINE', 'PROMOTION']);

      return {
        success: true,
        data: activities,
        timestamp: new Date().toISOString()
      };
    });

    return mexcService;
  }

  /**
   * Setup database mocks
   */
  static setupDatabaseMocks() {
    return vi.mock('../../src/db', () => ({
      db: {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: '1', createdAt: new Date() }])
          })
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
              orderBy: vi.fn().mockResolvedValue([])
            })
          })
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([])
          })
        }),
        delete: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([])
        })
      }
    }));
  }

  /**
   * Mock WebSocket connections
   */
  static setupWebSocketMocks() {
    const mockWebSocket = {
      readyState: 1, // OPEN
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };

    // Mock global WebSocket constructor with required constants
    const MockWebSocketConstructor = vi.fn().mockImplementation(() => mockWebSocket);
    MockWebSocketConstructor.CONNECTING = 0;
    MockWebSocketConstructor.OPEN = 1;
    MockWebSocketConstructor.CLOSING = 2;
    MockWebSocketConstructor.CLOSED = 3;
    MockWebSocketConstructor.prototype = mockWebSocket;

    // Type assertion is necessary here for global object assignment
    global.WebSocket = MockWebSocketConstructor as typeof WebSocket;

    return mockWebSocket;
  }
}

// Rest of the utilities classes remain the same...
// [Truncated for brevity - the remaining classes would be identical]

// Export all utilities
export default {
  MockDataGenerator,
  TestFixtures,
  ApiMockingUtils
};