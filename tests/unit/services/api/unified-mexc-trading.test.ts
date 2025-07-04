/**
 * Unit tests for Unified MEXC Trading Module
 * Tests TradingService interface implementation, order placement, market data, analysis, and activity detection
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  UnifiedMexcTradingModule,
  type TradingOrderData,
  type SymbolTickerData,
  type OrderBookData,
  type RecentActivityData,
} from '../../../../src/services/api/unified-mexc-trading';
import type { MexcServiceResponse } from '../../../../src/services/data/modules/mexc-api-types';
import type { MexcCacheLayer } from '../../../../src/services/data/modules/mexc-cache-layer';
import type { MexcCoreClient } from '../../../../src/services/data/modules/mexc-core-client';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../../utils/timeout-elimination-helpers';

describe('Unified MEXC Trading Module', () => {
  let tradingModule: UnifiedMexcTradingModule;
  let mockCoreClient: any;
  let mockCacheLayer: any;
  let mockConsole: any;
  let originalEnv: NodeJS.ProcessEnv;

  // Mock data
  const mockSymbolTickerData: SymbolTickerData = {
    symbol: 'BTCUSDT',
    price: '45000.00',
    lastPrice: '45000.00',
    priceChange: '500.00',
    priceChangePercent: '1.12',
    volume: '1234.56',
    quoteVolume: '55556666.78',
    openPrice: '44500.00',
    highPrice: '45500.00',
    lowPrice: '44000.00',
    prevClosePrice: '44500.00',
    count: 12345,
  };

  const mockOrderBookData: OrderBookData = {
    bids: [
      ['44999.99', '0.5'],
      ['44999.98', '1.0'],
      ['44999.97', '0.75'],
    ],
    asks: [
      ['45000.01', '0.6'],
      ['45000.02', '0.8'],
      ['45000.03', '0.9'],
    ],
    lastUpdateId: 123456789,
  };

  const mockRecentActivityData: RecentActivityData = {
    activities: [
      {
        timestamp: Date.now() - 300000,
        activityType: 'large_trade',
        volume: 5000,
        price: 45000,
        significance: 0.8,
      },
      {
        timestamp: Date.now() - 600000,
        activityType: 'normal_trade',
        volume: 1000,
        price: 44950,
        significance: 0.5,
      },
    ],
    totalActivities: 2,
    activityScore: 0.65,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Store original environment
    originalEnv = { ...process.env };

    // Mock console methods
    mockConsole = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    global.console.info = mockConsole.info;
    global.console.warn = mockConsole.warn;
    global.console.error = mockConsole.error;
    global.console.debug = mockConsole.debug;

    // Create mock core client
    mockCoreClient = {
      placeOrder: vi.fn(),
      getTicker: vi.fn(),
      getOrderBook: vi.fn(),
      getHttpClient: vi.fn(() => ({
        makeRequest: vi.fn(),
      })),
      getConfig: vi.fn(() => ({
        baseUrl: 'https://api.mexc.com',
      })),
    };

    // Create mock cache layer
    mockCacheLayer = {
      getOrSet: vi.fn(),
    };

    // Initialize trading module with mocks
    tradingModule = new UnifiedMexcTradingModule(mockCoreClient, mockCacheLayer);
  });

  afterEach(async () => {
    // TIMEOUT ELIMINATION: Ensure all promises are flushed before cleanup
    await flushPromises();
    vi.restoreAllMocks();
    
    // Restore original environment
    process.env = originalEnv;
  
  });

  describe('Constructor and Initialization', () => {
    it('should create trading module instance successfully', () => {
      expect(tradingModule).toBeDefined();
      expect(tradingModule).toBeInstanceOf(UnifiedMexcTradingModule);
    });

    it('should have logger methods defined', () => {
      expect(tradingModule['logger']).toBeDefined();
      expect(typeof tradingModule['logger'].info).toBe('function');
      expect(typeof tradingModule['logger'].warn).toBe('function');
      expect(typeof tradingModule['logger'].error).toBe('function');
      expect(typeof tradingModule['logger'].debug).toBe('function');
    });

    it('should initialize with core client and cache layer', () => {
      expect(tradingModule['coreClient']).toBe(mockCoreClient);
      expect(tradingModule['cacheLayer']).toBe(mockCacheLayer);
    });
  });

  describe('Trading Operations - placeOrder', () => {
    const mockOrderData: TradingOrderData = {
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'LIMIT',
      quantity: '0.001',
      price: '45000.00',
      timeInForce: 'GTC',
    };

    it('should place order successfully', async () => {
      const mockResponse: MexcServiceResponse<Record<string, unknown>> = {
        success: true,
        data: {
          orderId: '12345',
          clientOrderId: 'client_123',
          status: 'NEW',
        },
        timestamp: Date.now(),
        source: 'mexc-core-client',
      };

      mockCoreClient.placeOrder.mockResolvedValue(mockResponse);

      const result = await tradingModule.placeOrder(mockOrderData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse.data);
      expect(mockCoreClient.placeOrder).toHaveBeenCalledWith(mockOrderData);
    });

    it('should handle order placement failure', async () => {
      const mockError = new Error('Insufficient balance');
      mockCoreClient.placeOrder.mockRejectedValue(mockError);

      const result = await tradingModule.placeOrder(mockOrderData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient balance');
      expect(result.source).toBe('unified-mexc-trading');
      expect(typeof result.timestamp).toBe('number');
    });

    it('should handle non-Error rejection', async () => {
      mockCoreClient.placeOrder.mockRejectedValue('String error');

      const result = await tradingModule.placeOrder(mockOrderData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to place order');
    });
  });

  describe('Trading Operations - createOrder', () => {
    it('should be alias for placeOrder', async () => {
      const mockOrderData: TradingOrderData = {
        symbol: 'ETHUSDT',
        side: 'SELL',
        type: 'MARKET',
        quantity: '0.1',
      };

      const mockResponse: MexcServiceResponse<Record<string, unknown>> = {
        success: true,
        data: { orderId: '67890' },
        timestamp: Date.now(),
        source: 'mexc-core-client',
      };

      mockCoreClient.placeOrder.mockResolvedValue(mockResponse);

      const result = await tradingModule.createOrder(mockOrderData);

      expect(result.success).toBe(true);
      expect(mockCoreClient.placeOrder).toHaveBeenCalledWith(mockOrderData);
    });
  });

  describe('Market Data - getSymbolTicker', () => {
    it('should get symbol ticker successfully with cache', async () => {
      const mockResponse: MexcServiceResponse<SymbolTickerData> = {
        success: true,
        data: mockSymbolTickerData,
        timestamp: Date.now(),
        source: 'mexc-core-client',
      };

      mockCacheLayer.getOrSet.mockResolvedValue(mockResponse);

      const result = await tradingModule.getSymbolTicker('BTCUSDT');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSymbolTickerData);
      expect(mockCacheLayer.getOrSet).toHaveBeenCalledWith(
        'ticker:BTCUSDT',
        expect.any(Function),
        'realTime'
      );
    });

    it('should ensure backward compatibility with price fields', async () => {
      const tickerWithoutLastPrice = {
        ...mockSymbolTickerData,
        price: '45000.00',
      };
      delete (tickerWithoutLastPrice as any).lastPrice;

      const mockResponse: MexcServiceResponse<SymbolTickerData> = {
        success: true,
        data: tickerWithoutLastPrice as any,
        timestamp: Date.now(),
        source: 'mexc-core-client',
      };

      mockCacheLayer.getOrSet.mockResolvedValue(mockResponse);

      const result = await tradingModule.getSymbolTicker('BTCUSDT');

      expect(result.success).toBe(true);
      expect(result.data?.lastPrice).toBe('45000.00');
      expect(result.data?.price).toBe('45000.00');
    });

    it('should handle missing price fields gracefully', async () => {
      const tickerWithoutPrices = { ...mockSymbolTickerData };
      delete (tickerWithoutPrices as any).price;
      delete (tickerWithoutPrices as any).lastPrice;

      const mockResponse: MexcServiceResponse<SymbolTickerData> = {
        success: true,
        data: tickerWithoutPrices as any,
        timestamp: Date.now(),
        source: 'mexc-core-client',
      };

      mockCacheLayer.getOrSet.mockResolvedValue(mockResponse);

      const result = await tradingModule.getSymbolTicker('BTCUSDT');

      expect(result.success).toBe(true);
      expect(result.data?.price).toBe('0');
      expect(result.data?.lastPrice).toBe('0');
    });

    it('should handle failed ticker retrieval', async () => {
      const mockResponse: MexcServiceResponse<SymbolTickerData> = {
        success: false,
        error: 'Symbol not found',
        timestamp: Date.now(),
        source: 'mexc-core-client',
      };

      mockCacheLayer.getOrSet.mockResolvedValue(mockResponse);

      const result = await tradingModule.getSymbolTicker('INVALID');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Symbol not found');
    });
  });

  describe('Market Data - getTicker', () => {
    it('should be alias for getSymbolTicker', async () => {
      const mockResponse: MexcServiceResponse<SymbolTickerData> = {
        success: true,
        data: mockSymbolTickerData,
        timestamp: Date.now(),
        source: 'mexc-core-client',
      };

      mockCacheLayer.getOrSet.mockResolvedValue(mockResponse);

      const result = await tradingModule.getTicker('ETHUSDT');

      expect(result.success).toBe(true);
      expect(mockCacheLayer.getOrSet).toHaveBeenCalledWith(
        'ticker:ETHUSDT',
        expect.any(Function),
        'realTime'
      );
    });
  });

  describe('Market Data - getOrderBook', () => {
    it('should get order book successfully with default limit', async () => {
      const mockResponse: MexcServiceResponse<OrderBookData> = {
        success: true,
        data: mockOrderBookData,
        timestamp: Date.now(),
        source: 'mexc-core-client',
      };

      mockCacheLayer.getOrSet.mockResolvedValue(mockResponse);

      const result = await tradingModule.getOrderBook('BTCUSDT');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockOrderBookData);
      expect(mockCacheLayer.getOrSet).toHaveBeenCalledWith(
        'orderbook:BTCUSDT:20',
        expect.any(Function),
        'realTime'
      );
    });

    it('should get order book with custom limit', async () => {
      const mockResponse: MexcServiceResponse<OrderBookData> = {
        success: true,
        data: mockOrderBookData,
        timestamp: Date.now(),
        source: 'mexc-core-client',
      };

      mockCacheLayer.getOrSet.mockResolvedValue(mockResponse);

      const result = await tradingModule.getOrderBook('BTCUSDT', 50);

      expect(result.success).toBe(true);
      expect(mockCacheLayer.getOrSet).toHaveBeenCalledWith(
        'orderbook:BTCUSDT:50',
        expect.any(Function),
        'realTime'
      );
    });
  });

  describe('Activity Detection - getRecentActivity', () => {
    beforeEach(() => {
      // Reset environment to production
      delete process.env.NODE_ENV;
      delete process.env.VITEST;
      delete (global as any).__VITEST__;
    });

    it('should return mock data in test environment', async () => {
      // Set test environment
      process.env.NODE_ENV = 'test';

      const result = await tradingModule.getRecentActivity('BTCUSDT', 24);

      expect(result.success).toBe(true);
      expect(result.data?.activities).toBeDefined();
      expect(result.data?.totalActivities).toBeGreaterThan(0);
      expect(result.data?.activityScore).toBeGreaterThan(0);
      expect(result.source).toBe('unified-mexc-trading-mock');
    });

    it('should generate mock data for test symbols', async () => {
      process.env.VITEST = 'true';

      const result = await tradingModule.getRecentActivity('TESTSYMBOL', 24);

      expect(result.success).toBe(true);
      expect(result.data?.activities).toHaveLength(3); // TEST symbol gets 3 activities
      expect(result.data?.activityScore).toBe(0.7); // TEST symbol gets 0.7 base score
    });

    it('should generate mock data for high activity symbols', async () => {
      (global as any).__VITEST__ = true;

      const result = await tradingModule.getRecentActivity('HIGHVOLUME', 24);

      expect(result.success).toBe(true);
      expect(result.data?.activities).toHaveLength(5); // HIGH symbol gets 5 activities
      expect(result.data?.activityScore).toBe(0.9); // HIGH symbol gets 0.9 base score
    });

    it('should generate mock data for low activity symbols', async () => {
      process.env.NODE_ENV = 'test';

      const result = await tradingModule.getRecentActivity('LOWVOLUME', 24);

      expect(result.success).toBe(true);
      expect(result.data?.activities).toHaveLength(1); // LOW symbol gets 1 activity
      expect(result.data?.activityScore).toBe(0.3); // LOW symbol gets 0.3 base score
    });
  });

  describe('Market Analysis - analyzeSymbol', () => {
    beforeEach(() => {
      // Mock successful ticker response
      mockCacheLayer.getOrSet.mockImplementation((key, fn, ttl) => {
        if (key.startsWith('ticker:')) {
          return Promise.resolve({
            success: true,
            data: mockSymbolTickerData,
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        if (key.startsWith('orderbook:')) {
          return Promise.resolve({
            success: true,
            data: mockOrderBookData,
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        return fn();
      });
    });

    it('should analyze symbol successfully', async () => {
      const result = await tradingModule.analyzeSymbol('BTCUSDT');

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        symbol: 'BTCUSDT',
        currentPrice: 45000,
        priceChange24h: 1.12,
        volume24h: 1234.56,
        orderBookSpread: expect.any(Number),
        liquidityScore: expect.any(Number),
        volatilityScore: expect.any(Number),
        recommendedAction: expect.any(String),
        confidence: expect.any(Number),
      });
    });

    it('should handle ticker failure in analysis', async () => {
      mockCacheLayer.getOrSet.mockImplementation((key, fn, ttl) => {
        if (key.startsWith('ticker:')) {
          return Promise.resolve({
            success: false,
            error: 'Failed to get ticker data',
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        return fn();
      });

      const result = await tradingModule.analyzeSymbol('INVALID');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to get ticker data');
    });

    it('should handle order book failure in analysis', async () => {
      mockCacheLayer.getOrSet.mockImplementation((key, fn, ttl) => {
        if (key.startsWith('ticker:')) {
          return Promise.resolve({
            success: true,
            data: mockSymbolTickerData,
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        if (key.startsWith('orderbook:')) {
          return Promise.resolve({
            success: false,
            error: 'Failed to get order book data',
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        return fn();
      });

      const result = await tradingModule.analyzeSymbol('BTCUSDT');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to get order book data');
    });

    it('should calculate order book spread correctly', async () => {
      const result = await tradingModule.analyzeSymbol('BTCUSDT');

      expect(result.success).toBe(true);
      // Spread = (ask - bid) / ask * 100
      // (45000.01 - 44999.99) / 45000.01 * 100 ≈ 0.0044%
      expect(result.data?.orderBookSpread).toBeCloseTo(0.0044, 3);
    });

    it('should recommend BUY for strong upward movement', async () => {
      const bullishTicker = {
        ...mockSymbolTickerData,
        priceChangePercent: '8.5', // Strong upward movement
        volume: '50000', // High volume
      };

      mockCacheLayer.getOrSet.mockImplementation((key, fn, ttl) => {
        if (key.startsWith('ticker:')) {
          return Promise.resolve({
            success: true,
            data: bullishTicker,
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        if (key.startsWith('orderbook:')) {
          return Promise.resolve({
            success: true,
            data: mockOrderBookData,
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        return fn();
      });

      const result = await tradingModule.analyzeSymbol('BTCUSDT');

      expect(result.success).toBe(true);
      expect(result.data?.recommendedAction).toBe('BUY');
      expect(result.data?.confidence).toBe(0.7);
    });

    it('should recommend SELL for strong downward movement', async () => {
      const bearishTicker = {
        ...mockSymbolTickerData,
        priceChangePercent: '-7.2', // Strong downward movement
        volume: '40000', // High volume
      };

      mockCacheLayer.getOrSet.mockImplementation((key, fn, ttl) => {
        if (key.startsWith('ticker:')) {
          return Promise.resolve({
            success: true,
            data: bearishTicker,
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        if (key.startsWith('orderbook:')) {
          return Promise.resolve({
            success: true,
            data: mockOrderBookData,
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        return fn();
      });

      const result = await tradingModule.analyzeSymbol('BTCUSDT');

      expect(result.success).toBe(true);
      expect(result.data?.recommendedAction).toBe('SELL');
      expect(result.data?.confidence).toBe(0.7);
    });

    it('should recommend HOLD for neutral conditions', async () => {
      const neutralTicker = {
        ...mockSymbolTickerData,
        priceChangePercent: '1.5', // Neutral movement
        volume: '1000', // Lower volume
      };

      mockCacheLayer.getOrSet.mockImplementation((key, fn, ttl) => {
        if (key.startsWith('ticker:')) {
          return Promise.resolve({
            success: true,
            data: neutralTicker,
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        if (key.startsWith('orderbook:')) {
          return Promise.resolve({
            success: true,
            data: mockOrderBookData,
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        return fn();
      });

      const result = await tradingModule.analyzeSymbol('BTCUSDT');

      expect(result.success).toBe(true);
      expect(result.data?.recommendedAction).toBe('HOLD');
      expect(result.data?.confidence).toBe(0.5);
    });
  });

  describe('Market Analysis - isGoodTradingSymbol', () => {
    beforeEach(() => {
      mockCacheLayer.getOrSet.mockImplementation((key, fn, ttl) => {
        if (key.startsWith('ticker:')) {
          return Promise.resolve({
            success: true,
            data: mockSymbolTickerData,
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        if (key.startsWith('orderbook:')) {
          return Promise.resolve({
            success: true,
            data: mockOrderBookData,
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        return fn();
      });
    });

    it('should return true for good trading symbols', async () => {
      const result = await tradingModule.isGoodTradingSymbol('BTCUSDT');

      expect(result).toBe(true);
    });

    it('should return false when analysis fails', async () => {
      mockCacheLayer.getOrSet.mockImplementation((key, fn, ttl) => {
        if (key.startsWith('ticker:')) {
          return Promise.resolve({
            success: false,
            error: 'Analysis failed',
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        return fn();
      });

      const result = await tradingModule.isGoodTradingSymbol('INVALID');

      expect(result).toBe(false);
    });

    it('should return false for low liquidity symbols', async () => {
      const lowLiquidityTicker = {
        ...mockSymbolTickerData,
        volume: '10', // Very low volume
      };

      mockCacheLayer.getOrSet.mockImplementation((key, fn, ttl) => {
        if (key.startsWith('ticker:')) {
          return Promise.resolve({
            success: true,
            data: lowLiquidityTicker,
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        if (key.startsWith('orderbook:')) {
          return Promise.resolve({
            success: true,
            data: {
              ...mockOrderBookData,
              bids: [['44999.99', '0.001']], // Very low bid volume
              asks: [['45000.01', '0.001']], // Very low ask volume
            },
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        return fn();
      });

      const result = await tradingModule.isGoodTradingSymbol('LOWLIQ');

      expect(result).toBe(false);
    });

    it('should handle errors gracefully and log warning', async () => {
      mockCacheLayer.getOrSet.mockRejectedValue(new Error('Cache error'));

      const result = await tradingModule.isGoodTradingSymbol('ERROR');

      expect(result).toBe(false);
      expect(mockConsole.warn).toHaveBeenCalledWith(
        'Failed to check if ERROR is good for trading:',
        expect.any(Error)
      );
    });
  });

  describe('TradingService Interface - executeTrade', () => {
    beforeEach(() => {
      // Mock successful order placement
      mockCoreClient.placeOrder.mockResolvedValue({
        success: true,
        data: {
          orderId: '123456789',
          clientOrderId: 'client_123',
          status: 'NEW',
          executedQty: '0.001',
        },
        timestamp: Date.now(),
        source: 'mexc-core-client',
      });
    });

    it('should execute trade successfully with all parameters', async () => {
      const tradeParams = {
        symbol: 'BTCUSDT',
        side: 'BUY' as const,
        type: 'LIMIT' as const,
        quantity: 0.001,
        price: 45000,
        timeInForce: 'GTC' as const,
        isAutoSnipe: true,
        confidenceScore: 0.85,
        paperTrade: false,
      };

      const result = await tradingModule.executeTrade(tradeParams);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        orderId: '123456789',
        clientOrderId: 'client_123',
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: '0.001',
        price: '45000',
        status: 'NEW',
        executedQty: '0.001',
        timestamp: expect.any(String),
      });
      expect(typeof result.executionTime).toBe('number');
    });

    it('should execute paper trade successfully', async () => {
      const tradeParams = {
        symbol: 'ETHUSDT',
        side: 'SELL' as const,
        type: 'MARKET' as const,
        quantity: 0.1,
        paperTrade: true,
      };

      const result = await tradingModule.executeTrade(tradeParams);

      expect(result.success).toBe(true);
      expect(result.data?.orderId).toMatch(/^paper_\d+$/);
      expect(result.data?.clientOrderId).toMatch(/^client_\d+$/);
      expect(result.data?.symbol).toBe('ETHUSDT');
      expect(result.data?.side).toBe('SELL');
      expect(result.data?.type).toBe('MARKET');
      expect(result.data?.status).toBe('FILLED');
      expect(typeof result.executionTime).toBe('number');

      // Should not call actual placeOrder for paper trades
      expect(mockCoreClient.placeOrder).not.toHaveBeenCalled();
    });

    it('should handle quoteOrderQty parameter', async () => {
      const tradeParams = {
        symbol: 'BTCUSDT',
        side: 'BUY' as const,
        type: 'MARKET' as const,
        quoteOrderQty: 100, // $100 worth
      };

      const result = await tradingModule.executeTrade(tradeParams);

      expect(result.success).toBe(true);
      expect(mockCoreClient.placeOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: '100',
        })
      );
    });

    it('should handle STOP_LIMIT order type conversion', async () => {
      const tradeParams = {
        symbol: 'BTCUSDT',
        side: 'SELL' as const,
        type: 'STOP_LIMIT' as const,
        quantity: 0.001,
        price: 44000,
        stopPrice: 44500,
      };

      const result = await tradingModule.executeTrade(tradeParams);

      expect(result.success).toBe(true);
      expect(mockCoreClient.placeOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'LIMIT', // STOP_LIMIT converted to LIMIT
        })
      );
    });

    it('should handle trade execution failure', async () => {
      mockCoreClient.placeOrder.mockResolvedValue({
        success: false,
        error: 'Insufficient balance',
        timestamp: Date.now(),
        source: 'mexc-core-client',
      });

      const tradeParams = {
        symbol: 'BTCUSDT',
        side: 'BUY' as const,
        type: 'MARKET' as const,
        quantity: 0.001,
      };

      const result = await tradingModule.executeTrade(tradeParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient balance');
      expect(typeof result.executionTime).toBe('number');
    });

    it('should handle execution exceptions', async () => {
      mockCoreClient.placeOrder.mockRejectedValue(new Error('Network timeout'));

      const tradeParams = {
        symbol: 'BTCUSDT',
        side: 'BUY' as const,
        type: 'LIMIT' as const,
        quantity: 0.001,
        price: 45000,
      };

      const result = await tradingModule.executeTrade(tradeParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
      expect(typeof result.executionTime).toBe('number');
    });

    it('should handle missing order data gracefully', async () => {
      mockCoreClient.placeOrder.mockResolvedValue({
        success: true,
        data: {}, // Empty data
        timestamp: Date.now(),
        source: 'mexc-core-client',
      });

      const tradeParams = {
        symbol: 'BTCUSDT',
        side: 'BUY' as const,
        type: 'MARKET' as const,
        quantity: 0.001,
      };

      const result = await tradingModule.executeTrade(tradeParams);

      expect(result.success).toBe(true);
      expect(result.data?.orderId).toMatch(/^order_\d+$/); // Fallback orderId
      expect(result.data?.status).toBe('NEW');
      expect(result.data?.executedQty).toBe('0');
    });

    it('should handle null/undefined data fields gracefully', async () => {
      mockCoreClient.placeOrder.mockResolvedValue({
        success: true,
        data: {
          orderId: null,
          clientOrderId: undefined,
          status: null,
          executedQty: null,
        },
        timestamp: Date.now(),
        source: 'mexc-core-client',
      });

      const tradeParams = {
        symbol: 'ETHUSDT',
        side: 'SELL' as const,
        type: 'LIMIT' as const,
        quantity: 0.1,
        price: 3000,
      };

      const result = await tradingModule.executeTrade(tradeParams);

      expect(result.success).toBe(true);
      expect(result.data?.orderId).toMatch(/^order_\d+$/);
      expect(result.data?.clientOrderId).toBeUndefined();
      expect(result.data?.status).toBe('NEW');
      expect(result.data?.executedQty).toBe('0');
    });
  });

  describe('TradingService Interface - getCurrentPrice', () => {
    it('should get current price successfully', async () => {
      mockCacheLayer.getOrSet.mockResolvedValue({
        success: true,
        data: mockSymbolTickerData,
        timestamp: Date.now(),
        source: 'mexc-core-client',
      });

      const price = await tradingModule.getCurrentPrice('BTCUSDT');

      expect(price).toBe(45000);
      expect(mockCacheLayer.getOrSet).toHaveBeenCalledWith(
        'ticker:BTCUSDT',
        expect.any(Function),
        'realTime'
      );
    });

    it('should use lastPrice when available', async () => {
      const tickerData = {
        ...mockSymbolTickerData,
        lastPrice: '46000.00',
        price: '45000.00',
      };

      mockCacheLayer.getOrSet.mockResolvedValue({
        success: true,
        data: tickerData,
        timestamp: Date.now(),
        source: 'mexc-core-client',
      });

      const price = await tradingModule.getCurrentPrice('BTCUSDT');

      expect(price).toBe(46000); // Should use lastPrice
    });

    it('should fallback to price when lastPrice not available', async () => {
      const tickerData = {
        ...mockSymbolTickerData,
        price: '47000.00',
      };
      delete (tickerData as any).lastPrice;

      mockCacheLayer.getOrSet.mockResolvedValue({
        success: true,
        data: tickerData,
        timestamp: Date.now(),
        source: 'mexc-core-client',
      });

      const price = await tradingModule.getCurrentPrice('BTCUSDT');

      expect(price).toBe(47000); // Should use price
    });

    it('should return 0 for ticker failure', async () => {
      mockCacheLayer.getOrSet.mockResolvedValue({
        success: false,
        error: 'Symbol not found',
        timestamp: Date.now(),
        source: 'mexc-core-client',
      });

      const price = await tradingModule.getCurrentPrice('INVALID');

      expect(price).toBe(0);
      expect(mockConsole.error).toHaveBeenCalledWith(
        'Failed to get current price for INVALID:',
        expect.stringContaining('Failed to get ticker data')
      );
    });

    it('should return 0 for missing ticker data', async () => {
      mockCacheLayer.getOrSet.mockResolvedValue({
        success: true,
        data: null,
        timestamp: Date.now(),
        source: 'mexc-core-client',
      });

      const price = await tradingModule.getCurrentPrice('BTCUSDT');

      expect(price).toBe(0);
    });

    it('should handle exceptions gracefully', async () => {
      mockCacheLayer.getOrSet.mockRejectedValue(new Error('Cache error'));

      const price = await tradingModule.getCurrentPrice('BTCUSDT');

      expect(price).toBe(0);
      expect(mockConsole.error).toHaveBeenCalledWith(
        'Failed to get current price for BTCUSDT:',
        expect.any(Error)
      );
    });
  });

  describe('TradingService Interface - canTrade', () => {
    beforeEach(() => {
      mockCacheLayer.getOrSet.mockImplementation((key, fn, ttl) => {
        if (key.startsWith('ticker:')) {
          return Promise.resolve({
            success: true,
            data: mockSymbolTickerData,
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        if (key.startsWith('orderbook:')) {
          return Promise.resolve({
            success: true,
            data: mockOrderBookData,
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        return fn();
      });
    });

    it('should return true for tradeable symbols', async () => {
      const canTrade = await tradingModule.canTrade('BTCUSDT');

      expect(canTrade).toBe(true);
    });

    it('should return false for non-tradeable symbols', async () => {
      mockCacheLayer.getOrSet.mockImplementation((key, fn, ttl) => {
        if (key.startsWith('ticker:')) {
          return Promise.resolve({
            success: true,
            data: {
              ...mockSymbolTickerData,
              volume: '1', // Very low volume
            },
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        if (key.startsWith('orderbook:')) {
          return Promise.resolve({
            success: true,
            data: {
              ...mockOrderBookData,
              bids: [['44999.99', '0.001']], // Very low liquidity
              asks: [['45100.01', '0.001']], // High spread
            },
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        return fn();
      });

      const canTrade = await tradingModule.canTrade('LOWLIQ');

      expect(canTrade).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockCacheLayer.getOrSet.mockRejectedValue(new Error('Analysis failed'));

      const canTrade = await tradingModule.canTrade('ERROR');

      expect(canTrade).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith(
        'Failed to check if can trade ERROR:',
        expect.any(Error)
      );
    });
  });

  describe('Real API Integration - getRecentActivity', () => {
    beforeEach(() => {
      // Reset environment to production
      delete process.env.NODE_ENV;
      delete process.env.VITEST;
      delete (global as any).__VITEST__;

      // Mock HTTP client and successful responses
      mockCoreClient.getHttpClient.mockReturnValue({
        makeRequest: vi.fn().mockResolvedValue({
          data: [
            {
              T: Date.now() - 300000, // 5 minutes ago
              q: '1.5', // quantity
              p: '45000', // price
            },
            {
              T: Date.now() - 600000, // 10 minutes ago
              q: '2.0', // quantity
              p: '44950', // price
            },
          ],
        }),
      });

      mockCacheLayer.getOrSet.mockResolvedValue({
        success: true,
        data: mockSymbolTickerData,
        timestamp: Date.now(),
        source: 'mexc-core-client',
      });
    });

    it('should fetch real activity data in production', async () => {
      const result = await tradingModule.getRecentActivity('BTCUSDT', 1);

      expect(result.success).toBe(true);
      expect(result.data?.activities).toHaveLength(2);
      expect(result.data?.totalActivities).toBe(2);
      expect(result.data?.activityScore).toBeGreaterThan(0);
      expect(result.source).toBe('unified-mexc-trading');

      expect(mockCoreClient.getHttpClient).toHaveBeenCalled();
    });

    it('should handle invalid trades response format', async () => {
      mockCoreClient.getHttpClient.mockReturnValue({
        makeRequest: vi.fn().mockResolvedValue({
          data: null, // Invalid format
        }),
      });

      const result = await tradingModule.getRecentActivity('BTCUSDT', 1);

      expect(result.success).toBe(true); // Should use fallback
      expect(result.data?.activities).toBeDefined();
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get detailed activity data'),
        expect.any(Error)
      );
    });

    it('should handle ticker failure during activity analysis', async () => {
      mockCacheLayer.getOrSet.mockResolvedValue({
        success: false,
        error: 'Ticker not available',
        timestamp: Date.now(),
        source: 'mexc-core-client',
      });

      const result = await tradingModule.getRecentActivity('BTCUSDT', 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to get recent activity');
    });

    it('should use fallback when detailed data fails', async () => {
      mockCoreClient.getHttpClient.mockReturnValue({
        makeRequest: vi.fn().mockRejectedValue(new Error('API error')),
      });

      const result = await tradingModule.getRecentActivity('BTCUSDT', 1);

      expect(result.success).toBe(true); // Should use fallback
      expect(result.data?.activities).toBeDefined();
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get detailed activity data'),
        expect.any(Error)
      );
    });

    it('should calculate activity types based on volume', async () => {
      const avgVolume = parseFloat(mockSymbolTickerData.volume) / (24 * 60); // per minute

      mockCoreClient.getHttpClient.mockReturnValue({
        makeRequest: vi.fn().mockResolvedValue({
          data: [
            {
              T: Date.now() - 300000,
              q: (avgVolume * 6).toString(), // Large trade (6x average)
              p: '45000',
            },
            {
              T: Date.now() - 600000,
              q: (avgVolume * 3).toString(), // Medium trade (3x average)
              p: '44950',
            },
            {
              T: Date.now() - 900000,
              q: avgVolume.toString(), // Normal trade
              p: '44900',
            },
          ],
        }),
      });

      const result = await tradingModule.getRecentActivity('BTCUSDT', 1);

      expect(result.success).toBe(true);
      expect(result.data?.activities[0].activityType).toBe('large_trade');
      expect(result.data?.activities[1].activityType).toBe('medium_trade');
      expect(result.data?.activities[2].activityType).toBe('normal_trade');
    });

    it('should create fallback activity from ticker data', async () => {
      mockCoreClient.getHttpClient.mockReturnValue({
        makeRequest: vi.fn().mockRejectedValue(new Error('API unavailable')),
      });

      const volatileTicker = {
        ...mockSymbolTickerData,
        priceChangePercent: '7.5', // High volatility
        volume: '50000', // High volume
      };

      mockCacheLayer.getOrSet.mockResolvedValue({
        success: true,
        data: volatileTicker,
        timestamp: Date.now(),
        source: 'mexc-core-client',
      });

      const result = await tradingModule.getRecentActivity('BTCUSDT', 1);

      expect(result.success).toBe(true);
      expect(result.data?.activities).toHaveLength(2); // Price surge + volume spike
      expect(result.data?.activities.some(a => a.activityType === 'price_surge')).toBe(true);
      expect(result.data?.activities.some(a => a.activityType === 'volume_spike')).toBe(true);
    });

    it('should handle fallback ticker failure', async () => {
      mockCoreClient.getHttpClient.mockReturnValue({
        makeRequest: vi.fn().mockRejectedValue(new Error('API unavailable')),
      });

      mockCacheLayer.getOrSet.mockResolvedValue({
        success: false,
        error: 'Ticker unavailable',
        timestamp: Date.now(),
        source: 'mexc-core-client',
      });

      const result = await tradingModule.getRecentActivity('BTCUSDT', 1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to get recent activity');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed ticker data gracefully', async () => {
      const malformedTicker = {
        symbol: 'BTCUSDT',
        // Missing required fields
      };

      mockCacheLayer.getOrSet.mockResolvedValue({
        success: true,
        data: malformedTicker,
        timestamp: Date.now(),
        source: 'mexc-core-client',
      });

      const result = await tradingModule.analyzeSymbol('BTCUSDT');

      expect(result.success).toBe(true); // Should handle gracefully
      expect(result.data?.currentPrice).toBe(0);
      expect(result.data?.priceChange24h).toBe(0);
      expect(result.data?.volume24h).toBe(0);
    });

    it('should handle malformed order book data gracefully', async () => {
      const malformedOrderBook = {
        bids: [], // Empty bids
        asks: [], // Empty asks
        lastUpdateId: 123456789,
      };

      mockCacheLayer.getOrSet.mockImplementation((key, fn, ttl) => {
        if (key.startsWith('ticker:')) {
          return Promise.resolve({
            success: true,
            data: mockSymbolTickerData,
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        if (key.startsWith('orderbook:')) {
          return Promise.resolve({
            success: true,
            data: malformedOrderBook,
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        return fn();
      });

      const result = await tradingModule.analyzeSymbol('BTCUSDT');

      expect(result.success).toBe(true);
      expect(result.data?.orderBookSpread).toBe(0); // Should default to 0
      expect(result.data?.liquidityScore).toBe(0); // Should default to 0
    });

    it('should handle empty activity response gracefully', async () => {
      process.env.NODE_ENV = 'production';

      mockCoreClient.getHttpClient.mockReturnValue({
        makeRequest: vi.fn().mockResolvedValue({
          data: [], // Empty trades
        }),
      });

      mockCacheLayer.getOrSet.mockResolvedValue({
        success: true,
        data: mockSymbolTickerData,
        timestamp: Date.now(),
        source: 'mexc-core-client',
      });

      const result = await tradingModule.getRecentActivity('BTCUSDT', 1);

      expect(result.success).toBe(true);
      expect(result.data?.activities).toHaveLength(0);
      expect(result.data?.totalActivities).toBe(0);
      expect(result.data?.activityScore).toBe(0);
    });

    it('should handle undefined cache layer responses', async () => {
      mockCacheLayer.getOrSet.mockResolvedValue(undefined);

      const result = await tradingModule.getSymbolTicker('BTCUSDT');

      expect(result).toBeUndefined();
    });

    it('should handle core client exceptions in placeOrder', async () => {
      mockCoreClient.placeOrder.mockImplementation(() => {
        throw new Error('Core client error');
      });

      const orderData: TradingOrderData = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'MARKET',
        quantity: '0.001',
      };

      const result = await tradingModule.placeOrder(orderData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Core client error');
    });
  });

  describe('Type Safety and Interface Compliance', () => {
    it('should maintain proper TradingOrderData interface', () => {
      const orderData: TradingOrderData = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: '0.001',
        price: '45000.00',
        timeInForce: 'GTC',
      };

      expect(orderData.symbol).toBe('BTCUSDT');
      expect(orderData.side).toBe('BUY');
      expect(orderData.type).toBe('LIMIT');
      expect(typeof orderData.quantity).toBe('string');
      expect(typeof orderData.price).toBe('string');
    });

    it('should maintain proper SymbolTickerData interface', () => {
      const ticker: SymbolTickerData = mockSymbolTickerData;

      expect(typeof ticker.symbol).toBe('string');
      expect(typeof ticker.price).toBe('string');
      expect(typeof ticker.lastPrice).toBe('string');
      expect(typeof ticker.priceChange).toBe('string');
      expect(typeof ticker.priceChangePercent).toBe('string');
      expect(typeof ticker.volume).toBe('string');
      expect(typeof ticker.count).toBe('number');
    });

    it('should maintain proper OrderBookData interface', () => {
      const orderBook: OrderBookData = mockOrderBookData;

      expect(Array.isArray(orderBook.bids)).toBe(true);
      expect(Array.isArray(orderBook.asks)).toBe(true);
      expect(typeof orderBook.lastUpdateId).toBe('number');

      orderBook.bids.forEach(bid => {
        expect(Array.isArray(bid)).toBe(true);
        expect(bid.length).toBe(2);
        expect(typeof bid[0]).toBe('string'); // price
        expect(typeof bid[1]).toBe('string'); // quantity
      });
    });

    it('should maintain proper RecentActivityData interface', () => {
      const activity: RecentActivityData = mockRecentActivityData;

      expect(Array.isArray(activity.activities)).toBe(true);
      expect(typeof activity.totalActivities).toBe('number');
      expect(typeof activity.activityScore).toBe('number');

      activity.activities.forEach(item => {
        expect(typeof item.timestamp).toBe('number');
        expect(typeof item.activityType).toBe('string');
        expect(typeof item.volume).toBe('number');
        expect(typeof item.price).toBe('number');
        expect(typeof item.significance).toBe('number');
      });
    });

    it('should implement TradingService interface correctly', async () => {
      // Test that the module implements all required TradingService methods
      expect(typeof tradingModule.executeTrade).toBe('function');
      expect(typeof tradingModule.getCurrentPrice).toBe('function');
      expect(typeof tradingModule.canTrade).toBe('function');

      // Test return types
      const tradeResult = await tradingModule.executeTrade({
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'MARKET',
        quantity: 0.001,
        paperTrade: true,
      });

      expect(typeof tradeResult.success).toBe('boolean');
      expect(typeof tradeResult.executionTime).toBe('number');

      mockCacheLayer.getOrSet.mockResolvedValue({
        success: true,
        data: mockSymbolTickerData,
        timestamp: Date.now(),
        source: 'mexc-core-client',
      });

      const price = await tradingModule.getCurrentPrice('BTCUSDT');
      expect(typeof price).toBe('number');

      const canTrade = await tradingModule.canTrade('BTCUSDT');
      expect(typeof canTrade).toBe('boolean');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete trading workflow', async () => {
      // Setup successful responses
      mockCacheLayer.getOrSet.mockImplementation((key, fn, ttl) => {
        if (key.startsWith('ticker:')) {
          return Promise.resolve({
            success: true,
            data: mockSymbolTickerData,
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        if (key.startsWith('orderbook:')) {
          return Promise.resolve({
            success: true,
            data: mockOrderBookData,
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        return fn();
      });

      mockCoreClient.placeOrder.mockResolvedValue({
        success: true,
        data: {
          orderId: '987654321',
          status: 'FILLED',
          executedQty: '0.001',
        },
        timestamp: Date.now(),
        source: 'mexc-core-client',
      });

      // Step 1: Check if symbol is good for trading
      const canTrade = await tradingModule.canTrade('BTCUSDT');
      expect(canTrade).toBe(true);

      // Step 2: Get current price
      const currentPrice = await tradingModule.getCurrentPrice('BTCUSDT');
      expect(currentPrice).toBe(45000);

      // Step 3: Analyze symbol
      const analysis = await tradingModule.analyzeSymbol('BTCUSDT');
      expect(analysis.success).toBe(true);

      // Step 4: Execute trade
      const tradeResult = await tradingModule.executeTrade({
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: 0.001,
        price: currentPrice,
      });

      expect(tradeResult.success).toBe(true);
      expect(tradeResult.data?.orderId).toBe('987654321');
    });

    it('should handle degraded service scenario', async () => {
      // Simulate partial service availability
      mockCacheLayer.getOrSet.mockImplementation((key, fn, ttl) => {
        if (key.startsWith('ticker:')) {
          return Promise.resolve({
            success: true,
            data: mockSymbolTickerData,
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        if (key.startsWith('orderbook:')) {
          return Promise.resolve({
            success: false,
            error: 'Order book service unavailable',
            timestamp: Date.now(),
            source: 'mexc-core-client',
          });
        }
        return fn();
      });

      // Price should still work
      const currentPrice = await tradingModule.getCurrentPrice('BTCUSDT');
      expect(currentPrice).toBe(45000);

      // Analysis should fail due to order book unavailability
      const analysis = await tradingModule.analyzeSymbol('BTCUSDT');
      expect(analysis.success).toBe(false);

      // But canTrade should handle the failure gracefully
      const canTrade = await tradingModule.canTrade('BTCUSDT');
      expect(canTrade).toBe(false);
    });

    it('should handle complete service failure gracefully', async () => {
      // Simulate complete service failure
      mockCacheLayer.getOrSet.mockRejectedValue(new Error('Cache service down'));
      mockCoreClient.placeOrder.mockRejectedValue(new Error('Trading service down'));

      // All operations should handle errors gracefully
      const currentPrice = await tradingModule.getCurrentPrice('BTCUSDT');
      expect(currentPrice).toBe(0);

      const canTrade = await tradingModule.canTrade('BTCUSDT');
      expect(canTrade).toBe(false);

      const analysis = await tradingModule.analyzeSymbol('BTCUSDT');
      expect(analysis.success).toBe(false);

      const tradeResult = await tradingModule.executeTrade({
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'MARKET',
        quantity: 0.001,
      });
      expect(tradeResult.success).toBe(false);

      // Verify error logging
      expect(mockConsole.error).toHaveBeenCalledTimes(4);
    });
  });
});