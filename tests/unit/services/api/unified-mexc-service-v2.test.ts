/**
 * Unit tests for Unified MEXC Service v2
 * Tests the orchestration service that coordinates multiple modules and implements service interfaces
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  UnifiedMexcServiceV2,
  createUnifiedMexcServiceV2,
  getUnifiedMexcServiceV2,
  resetUnifiedMexcServiceV2,
} from '../../../../src/services/api/unified-mexc-service-v2';

// Mock dependencies
vi.mock('../../../data/modules/mexc-core-client', () => ({
  MexcCoreClient: vi.fn().mockImplementation(() => ({
    getOrderStatus: vi.fn(),
    cancelOrder: vi.fn(),
    getUserTrades: vi.fn(),
    getOpenOrders: vi.fn(),
  })),
}));

vi.mock('../../../data/modules/mexc-cache-layer', () => ({
  MexcCacheLayer: vi.fn().mockImplementation(() => ({
    invalidateCalendar: vi.fn(() => 5),
    invalidateSymbols: vi.fn(() => 10),
    invalidateUserData: vi.fn(() => 3),
    getMetrics: vi.fn(() => ({
      hits: 100,
      misses: 20,
      size: 50,
      hitRate: 0.83,
    })),
    destroy: vi.fn(),
  })),
}));

vi.mock('../../../../src/services/api/unified-mexc-config', () => ({
  mergeConfig: vi.fn((config) => ({
    apiKey: 'test-api-key',
    secretKey: 'test-secret-key',
    passphrase: '',
    baseUrl: 'https://api.mexc.com',
    timeout: 5000,
    maxRetries: 3,
    retryDelay: 1000,
    rateLimitDelay: 100,
    enableCaching: true,
    cacheTTL: 60000,
    apiResponseTTL: 1500,
    enableCircuitBreaker: true,
    enableEnhancedFeatures: true,
    ...config,
  })),
  hasValidCredentials: vi.fn(() => true),
}));

vi.mock('../../../../src/services/api/unified-mexc-core', () => ({
  UnifiedMexcCoreModule: vi.fn().mockImplementation(() => ({
    getCalendarListings: vi.fn(),
    getSymbolsByVcoinId: vi.fn(),
    getAllSymbols: vi.fn(),
    getServerTime: vi.fn(),
    getSymbolInfoBasic: vi.fn(),
    getActivityData: vi.fn(),
    getSymbolData: vi.fn(),
    getSymbolsForVcoins: vi.fn(),
    getSymbolsData: vi.fn(),
    getBulkActivityData: vi.fn(),
    testConnectivity: vi.fn(),
    testConnectivityWithResponse: vi.fn(),
  })),
}));

vi.mock('../../../../src/services/api/unified-mexc-portfolio', () => ({
  UnifiedMexcPortfolioModule: vi.fn().mockImplementation(() => ({
    getAccountBalance: vi.fn(),
    getAccountBalances: vi.fn(),
    getAccountInfo: vi.fn(),
    getTotalPortfolioValue: vi.fn(),
    getTopAssets: vi.fn(),
    hasSufficientBalance: vi.fn(),
    getAssetBalance: vi.fn(),
  })),
}));

vi.mock('../../../../src/services/api/unified-mexc-trading', () => ({
  UnifiedMexcTradingModule: vi.fn().mockImplementation(() => ({
    executeTrade: vi.fn(),
    getTicker: vi.fn(),
    getSymbolTicker: vi.fn(),
    getOrderBook: vi.fn(),
    getRecentActivity: vi.fn(),
    placeOrder: vi.fn(),
    createOrder: vi.fn(),
  })),
}));

describe('UnifiedMexcServiceV2', () => {
  let service: UnifiedMexcServiceV2;
  let mockConsole: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset global state
    resetUnifiedMexcServiceV2();

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

    service = new UnifiedMexcServiceV2();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetUnifiedMexcServiceV2();
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(UnifiedMexcServiceV2);
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        apiKey: 'custom-key',
        secretKey: 'custom-secret',
        baseUrl: 'https://custom.api.com',
      };

      const customService = new UnifiedMexcServiceV2(customConfig);
      
      expect(customService).toBeDefined();
    });

    it('should initialize all required modules', () => {
      const { MexcCoreClient } = require('../../../data/modules/mexc-core-client');
      const { MexcCacheLayer } = require('../../../data/modules/mexc-cache-layer');
      const { UnifiedMexcCoreModule } = require('../../../../src/services/api/unified-mexc-core');
      const { UnifiedMexcPortfolioModule } = require('../../../../src/services/api/unified-mexc-portfolio');
      const { UnifiedMexcTradingModule } = require('../../../../src/services/api/unified-mexc-trading');

      expect(MexcCoreClient).toHaveBeenCalled();
      expect(MexcCacheLayer).toHaveBeenCalled();
      expect(UnifiedMexcCoreModule).toHaveBeenCalled();
      expect(UnifiedMexcPortfolioModule).toHaveBeenCalled();
      expect(UnifiedMexcTradingModule).toHaveBeenCalled();
    });
  });

  describe('TradingService Interface', () => {
    describe('executeTrade', () => {
      it('should execute trade successfully', async () => {
        const mockTradeResult = {
          success: true,
          data: {
            orderId: '12345',
            symbol: 'BTCUSDT',
            side: 'BUY',
            type: 'LIMIT',
            quantity: '0.001',
            price: '50000',
            status: 'NEW',
          },
        };

        service['tradingModule'].executeTrade = vi.fn().mockResolvedValue(mockTradeResult);

        const tradeParams = {
          symbol: 'BTCUSDT',
          side: 'BUY' as const,
          type: 'LIMIT' as const,
          quantity: 0.001,
          price: 50000,
        };

        const result = await service.executeTrade(tradeParams);

        expect(result.success).toBe(true);
        expect(result.data?.orderId).toBe('12345');
        expect(result.data?.symbol).toBe('BTCUSDT');
        expect(result.data?.side).toBe('BUY');
        expect(result.data?.price).toBe('50000');
        expect(result.data?.executedQty).toBe('0.001');
        expect(result.data?.timestamp).toBeDefined();

        expect(service['tradingModule'].executeTrade).toHaveBeenCalledWith({
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'LIMIT',
          quantity: 0.001,
          price: 50000,
          stopPrice: undefined,
          timeInForce: undefined,
        });
      });

      it('should handle trade execution failure', async () => {
        const mockTradeResult = {
          success: false,
          error: 'Insufficient balance',
        };

        service['tradingModule'].executeTrade = vi.fn().mockResolvedValue(mockTradeResult);

        const tradeParams = {
          symbol: 'BTCUSDT',
          side: 'BUY' as const,
          type: 'LIMIT' as const,
          quantity: 0.001,
          price: 50000,
        };

        const result = await service.executeTrade(tradeParams);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Insufficient balance');
      });

      it('should handle optional trade parameters', async () => {
        const mockTradeResult = {
          success: true,
          data: {
            orderId: '12346',
            symbol: 'ETHUSDT',
            side: 'SELL',
            type: 'STOP_LIMIT',
            quantity: '0.1',
            price: '3000',
            status: 'NEW',
          },
        };

        service['tradingModule'].executeTrade = vi.fn().mockResolvedValue(mockTradeResult);

        const tradeParams = {
          symbol: 'ETHUSDT',
          side: 'SELL' as const,
          type: 'STOP_LIMIT' as const,
          quantity: 0.1,
          price: 3000,
          stopPrice: 2950,
          timeInForce: 'GTC' as const,
          isAutoSnipe: true,
          confidenceScore: 0.85,
          paperTrade: false,
        };

        const result = await service.executeTrade(tradeParams);

        expect(result.success).toBe(true);
        expect(service['tradingModule'].executeTrade).toHaveBeenCalledWith({
          symbol: 'ETHUSDT',
          side: 'SELL',
          type: 'STOP_LIMIT',
          quantity: 0.1,
          price: 3000,
          stopPrice: 2950,
          timeInForce: 'GTC',
        });
      });
    });

    describe('getOrderStatus', () => {
      it('should get order status successfully', async () => {
        const mockOrderStatus = {
          success: true,
          data: {
            orderId: 12345,
            symbol: 'BTCUSDT',
            status: 'FILLED',
            side: 'BUY',
            type: 'LIMIT',
            quantity: '0.001',
            price: '50000',
            executedQty: '0.001',
            cummulativeQuoteQty: '50',
            timeInForce: 'GTC',
          },
        };

        service['coreClient'].getOrderStatus = vi.fn().mockResolvedValue(mockOrderStatus);

        const result = await service.getOrderStatus('12345');

        expect(result.success).toBe(true);
        expect(result.data?.orderId).toBe('12345');
        expect(result.data?.symbol).toBe('BTCUSDT');
        expect(result.data?.status).toBe('FILLED');
        expect(result.data?.side).toBe('BUY');
        expect(result.data?.executedQuantity).toBe('0.001');
        expect(result.data?.cummulativeQuoteQuantity).toBe('50');
        expect(result.data?.timestamp).toBeDefined();

        expect(service['coreClient'].getOrderStatus).toHaveBeenCalledWith('', 12345);
      });

      it('should handle order status request failure', async () => {
        const mockOrderStatus = {
          success: false,
          error: 'Order not found',
        };

        service['coreClient'].getOrderStatus = vi.fn().mockResolvedValue(mockOrderStatus);

        const result = await service.getOrderStatus('99999');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Order not found');
        expect(result.data).toBeUndefined();
      });

      it('should handle network errors', async () => {
        service['coreClient'].getOrderStatus = vi.fn().mockRejectedValue(
          new Error('Network timeout')
        );

        const result = await service.getOrderStatus('12345');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Error: Network timeout');
      });

      it('should handle null/undefined values in order data', async () => {
        const mockOrderStatus = {
          success: true,
          data: {
            orderId: null,
            symbol: 'BTCUSDT',
            status: 'FILLED',
            side: 'BUY',
            type: 'LIMIT',
            quantity: null,
            executedQty: undefined,
            cummulativeQuoteQty: null,
          },
        };

        service['coreClient'].getOrderStatus = vi.fn().mockResolvedValue(mockOrderStatus);

        const result = await service.getOrderStatus('12345');

        expect(result.success).toBe(true);
        expect(result.data?.orderId).toBe('12345'); // Falls back to provided orderId
        expect(result.data?.quantity).toBe('0'); // Default for null quantity
        expect(result.data?.executedQuantity).toBe('0'); // Default for undefined
        expect(result.data?.cummulativeQuoteQuantity).toBe('0'); // Default for null
      });
    });

    describe('cancelOrder', () => {
      it('should cancel order successfully', async () => {
        const mockCancelResult = {
          success: true,
          data: {
            orderId: 12345,
            symbol: 'BTCUSDT',
            status: 'CANCELED',
          },
        };

        service['coreClient'].cancelOrder = vi.fn().mockResolvedValue(mockCancelResult);

        const result = await service.cancelOrder('12345', 'BTCUSDT');

        expect(result.success).toBe(true);
        expect(result.data?.orderId).toBe('12345');
        expect(result.data?.symbol).toBe('BTCUSDT');
        expect(result.data?.status).toBe('CANCELED');

        expect(service['coreClient'].cancelOrder).toHaveBeenCalledWith('BTCUSDT', 12345);
      });

      it('should cancel order without symbol', async () => {
        const mockCancelResult = {
          success: true,
          data: {
            orderId: 12345,
            status: 'CANCELED',
          },
        };

        service['coreClient'].cancelOrder = vi.fn().mockResolvedValue(mockCancelResult);

        const result = await service.cancelOrder('12345');

        expect(result.success).toBe(true);
        expect(result.data?.orderId).toBe('12345');
        expect(result.data?.symbol).toBe(''); // Empty when not provided
        expect(result.data?.status).toBe('CANCELED');

        expect(service['coreClient'].cancelOrder).toHaveBeenCalledWith('', 12345);
      });

      it('should handle cancel order failure', async () => {
        const mockCancelResult = {
          success: false,
          error: 'Order already filled',
        };

        service['coreClient'].cancelOrder = vi.fn().mockResolvedValue(mockCancelResult);

        const result = await service.cancelOrder('12345', 'BTCUSDT');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Order already filled');
        expect(result.data).toBeUndefined();
      });

      it('should handle network errors', async () => {
        service['coreClient'].cancelOrder = vi.fn().mockRejectedValue(
          new Error('Connection lost')
        );

        const result = await service.cancelOrder('12345', 'BTCUSDT');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Error: Connection lost');
      });
    });

    describe('getTradeHistory', () => {
      it('should get trade history successfully', async () => {
        const mockTradeHistory = {
          success: true,
          data: [
            {
              id: 'trade-1',
              orderId: 12345,
              symbol: 'BTCUSDT',
              side: 'BUY',
              qty: '0.001',
              price: '50000',
              commission: '0.1',
              commissionAsset: 'USDT',
              time: 1640995200000,
            },
            {
              tradeId: 'trade-2',
              orderId: 12346,
              symbol: 'BTCUSDT',
              side: 'SELL',
              quantity: '0.001',
              price: '51000',
              fee: '0.051',
              feeAsset: 'USDT',
              timestamp: 1640995300000,
            },
          ],
        };

        service['coreClient'].getUserTrades = vi.fn().mockResolvedValue(mockTradeHistory);

        const result = await service.getTradeHistory('BTCUSDT', 50);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
        
        // Check first trade mapping
        expect(result.data![0].id).toBe('trade-1');
        expect(result.data![0].orderId).toBe('12345');
        expect(result.data![0].symbol).toBe('BTCUSDT');
        expect(result.data![0].side).toBe('BUY');
        expect(result.data![0].quantity).toBe('0.001');
        expect(result.data![0].price).toBe('50000');
        expect(result.data![0].commission).toBe('0.1');
        expect(result.data![0].commissionAsset).toBe('USDT');
        expect(result.data![0].timestamp).toBe(1640995200000);

        // Check second trade mapping (different field names)
        expect(result.data![1].id).toBe('trade-2');
        expect(result.data![1].quantity).toBe('0.001');
        expect(result.data![1].commission).toBe('0.051');
        expect(result.data![1].commissionAsset).toBe('USDT');

        expect(service['coreClient'].getUserTrades).toHaveBeenCalledWith({
          symbol: 'BTCUSDT',
          limit: 50,
          startTime: expect.any(Number),
        });
      });

      it('should get trade history with default parameters', async () => {
        const mockTradeHistory = {
          success: true,
          data: [],
        };

        service['coreClient'].getUserTrades = vi.fn().mockResolvedValue(mockTradeHistory);

        const result = await service.getTradeHistory();

        expect(result.success).toBe(true);
        expect(result.data).toEqual([]);

        expect(service['coreClient'].getUserTrades).toHaveBeenCalledWith({
          symbol: undefined,
          limit: 100,
          startTime: expect.any(Number),
        });
      });

      it('should handle trade history request failure', async () => {
        const mockTradeHistory = {
          success: false,
          error: 'API rate limit exceeded',
        };

        service['coreClient'].getUserTrades = vi.fn().mockResolvedValue(mockTradeHistory);

        const result = await service.getTradeHistory('BTCUSDT');

        expect(result.success).toBe(false);
        expect(result.error).toBe('API rate limit exceeded');
      });

      it('should handle trade history with missing data fields', async () => {
        const mockTradeHistory = {
          success: true,
          data: [
            {
              // Missing most fields to test defaults
              symbol: 'ETHUSDT',
            },
          ],
        };

        service['coreClient'].getUserTrades = vi.fn().mockResolvedValue(mockTradeHistory);

        const result = await service.getTradeHistory('ETHUSDT');

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data![0].id).toMatch(/^\d+-\d+\.\d+$/); // Generated ID pattern
        expect(result.data![0].orderId).toBe('');
        expect(result.data![0].symbol).toBe('ETHUSDT');
        expect(result.data![0].side).toBe('BUY'); // Default
        expect(result.data![0].quantity).toBe('0');
        expect(result.data![0].price).toBe('0');
        expect(result.data![0].commission).toBe('0');
        expect(result.data![0].commissionAsset).toBe('USDT');
      });

      it('should handle trade history errors', async () => {
        service['coreClient'].getUserTrades = vi.fn().mockRejectedValue(
          new Error('Database error')
        );

        const result = await service.getTradeHistory('BTCUSDT');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Database error');
        expect(mockConsole.error).toHaveBeenCalledWith(
          'Trade history retrieval failed',
          expect.objectContaining({
            symbol: 'BTCUSDT',
            error: 'Database error',
          })
        );
      });
    });

    describe('getOpenOrders', () => {
      it('should get open orders successfully', async () => {
        const mockOpenOrders = {
          success: true,
          data: [
            {
              orderId: 12345,
              symbol: 'BTCUSDT',
              side: 'BUY',
              type: 'LIMIT',
              quantity: '0.001',
              price: '50000',
              status: 'NEW',
              timestamp: 1640995200000,
            },
            {
              orderId: 12346,
              symbol: 'ETHUSDT',
              side: 'SELL',
              type: 'LIMIT',
              quantity: '0.1',
              price: '3000',
              status: 'PARTIALLY_FILLED',
              timestamp: 1640995300000,
            },
          ],
        };

        service['coreClient'].getOpenOrders = vi.fn().mockResolvedValue(mockOpenOrders);

        const result = await service.getOpenOrders('BTCUSDT');

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
        expect(result.data![0].orderId).toBe('12345');
        expect(result.data![0].symbol).toBe('BTCUSDT');
        expect(result.data![0].side).toBe('BUY');
        expect(result.data![0].type).toBe('LIMIT');
        expect(result.data![0].quantity).toBe('0.001');
        expect(result.data![0].price).toBe('50000');
        expect(result.data![0].status).toBe('NEW');

        expect(service['coreClient'].getOpenOrders).toHaveBeenCalledWith('BTCUSDT');
      });

      it('should get open orders without symbol filter', async () => {
        const mockOpenOrders = {
          success: true,
          data: [],
        };

        service['coreClient'].getOpenOrders = vi.fn().mockResolvedValue(mockOpenOrders);

        const result = await service.getOpenOrders();

        expect(result.success).toBe(true);
        expect(result.data).toEqual([]);

        expect(service['coreClient'].getOpenOrders).toHaveBeenCalledWith(undefined);
      });

      it('should handle open orders request failure', async () => {
        const mockOpenOrders = {
          success: false,
          error: 'Authentication failed',
        };

        service['coreClient'].getOpenOrders = vi.fn().mockResolvedValue(mockOpenOrders);

        const result = await service.getOpenOrders('BTCUSDT');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Authentication failed');
        expect(result.data).toBeUndefined();
      });

      it('should handle null/undefined values in open orders', async () => {
        const mockOpenOrders = {
          success: true,
          data: [
            {
              orderId: null,
              symbol: 'BTCUSDT',
              side: 'BUY',
              type: 'LIMIT',
              quantity: null,
              status: 'NEW',
            },
          ],
        };

        service['coreClient'].getOpenOrders = vi.fn().mockResolvedValue(mockOpenOrders);

        const result = await service.getOpenOrders('BTCUSDT');

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data![0].orderId).toBe(''); // Default for null
        expect(result.data![0].quantity).toBe('0'); // Default for null
        expect(result.data![0].timestamp).toBeDefined(); // Auto-generated
      });

      it('should handle open orders errors', async () => {
        service['coreClient'].getOpenOrders = vi.fn().mockRejectedValue(
          new Error('Server error')
        );

        const result = await service.getOpenOrders('BTCUSDT');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Error: Server error');
      });
    });
  });

  describe('MarketService Interface', () => {
    describe('getExchangeInfo', () => {
      it('should get exchange info successfully', async () => {
        const mockSymbols = {
          success: true,
          data: [
            {
              symbol: 'BTCUSDT',
              status: 'TRADING',
              baseAsset: 'BTC',
              quoteAsset: 'USDT',
            },
            {
              symbol: 'ETHUSDT',
              status: 'TRADING',
              baseAsset: 'ETH',
              quoteAsset: 'USDT',
            },
          ],
        };

        service['coreModule'].getAllSymbols = vi.fn().mockResolvedValue(mockSymbols);

        const result = await service.getExchangeInfo();

        expect(result.success).toBe(true);
        expect(result.data?.symbols).toHaveLength(2);
        expect(result.data?.symbols![0].symbol).toBe('BTCUSDT');
        expect(result.data?.symbols![0].status).toBe('TRADING');
        expect(result.data?.symbols![0].baseAsset).toBe('BTC');
        expect(result.data?.symbols![0].quoteAsset).toBe('USDT');

        expect(service['coreModule'].getAllSymbols).toHaveBeenCalled();
      });

      it('should handle exchange info request failure', async () => {
        const mockSymbols = {
          success: false,
          error: 'API unavailable',
        };

        service['coreModule'].getAllSymbols = vi.fn().mockResolvedValue(mockSymbols);

        const result = await service.getExchangeInfo();

        expect(result.success).toBe(false);
        expect(result.error).toBe('API unavailable');
      });

      it('should handle exchange info errors', async () => {
        service['coreModule'].getAllSymbols = vi.fn().mockRejectedValue(
          new Error('Connection failed')
        );

        const result = await service.getExchangeInfo();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Connection failed');
      });

      it('should handle missing symbol data', async () => {
        const mockSymbols = {
          success: true,
          data: [
            {
              // Missing fields to test defaults
            },
          ],
        };

        service['coreModule'].getAllSymbols = vi.fn().mockResolvedValue(mockSymbols);

        const result = await service.getExchangeInfo();

        expect(result.success).toBe(true);
        expect(result.data?.symbols).toHaveLength(1);
        expect(result.data?.symbols![0].symbol).toBe('');
        expect(result.data?.symbols![0].status).toBe('UNKNOWN');
        expect(result.data?.symbols![0].baseAsset).toBe('');
        expect(result.data?.symbols![0].quoteAsset).toBe('');
      });
    });

    describe('getTicker24hr', () => {
      it('should get 24hr ticker for single symbol', async () => {
        const mockTicker = {
          success: true,
          data: {
            symbol: 'BTCUSDT',
            price: '50000',
            lastPrice: '50000',
            priceChangePercent: '2.5',
            volume: '1000000',
          },
        };

        service['tradingModule'].getTicker = vi.fn().mockResolvedValue(mockTicker);

        const result = await service.getTicker24hr(['BTCUSDT']);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data![0].symbol).toBe('BTCUSDT');
        expect(result.data![0].price).toBe('50000');
        expect(result.data![0].lastPrice).toBe('50000');
        expect(result.data![0].priceChangePercent).toBe('2.5');
        expect(result.data![0].volume).toBe('1000000');

        expect(service['tradingModule'].getTicker).toHaveBeenCalledWith('BTCUSDT');
      });

      it('should return empty array for no symbols', async () => {
        const result = await service.getTicker24hr([]);

        expect(result.success).toBe(true);
        expect(result.data).toEqual([]);
      });

      it('should handle multiple symbols with batching', async () => {
        const mockTicker1 = {
          success: true,
          data: {
            symbol: 'BTCUSDT',
            price: '50000',
            lastPrice: '50000',
            priceChangePercent: '2.5',
            volume: '1000000',
          },
        };

        const mockTicker2 = {
          success: true,
          data: {
            symbol: 'ETHUSDT',
            price: '3000',
            lastPrice: '3000',
            priceChangePercent: '1.5',
            volume: '500000',
          },
        };

        service['tradingModule'].getTicker = vi.fn()
          .mockResolvedValueOnce(mockTicker1)
          .mockResolvedValueOnce(mockTicker2);

        // Mock setTimeout for batching delay
        vi.spyOn(global, 'setTimeout').mockImplementation((fn) => {
          fn();
          return {} as any;
        });

        const result = await service.getTicker24hr(['BTCUSDT', 'ETHUSDT']);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
        expect(result.data![0].symbol).toBe('BTCUSDT');
        expect(result.data![1].symbol).toBe('ETHUSDT');

        expect(service['tradingModule'].getTicker).toHaveBeenCalledTimes(2);
      });

      it('should handle ticker request failures', async () => {
        const mockTicker = {
          success: false,
          error: 'Symbol not found',
        };

        service['tradingModule'].getTicker = vi.fn().mockResolvedValue(mockTicker);

        const result = await service.getTicker24hr(['INVALID']);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Symbol not found');
      });

      it('should filter out failed ticker requests in batch mode', async () => {
        const mockTicker1 = {
          success: true,
          data: {
            symbol: 'BTCUSDT',
            price: '50000',
            volume: '1000000',
          },
        };

        const mockTicker2 = {
          success: false,
          error: 'Symbol not found',
        };

        service['tradingModule'].getTicker = vi.fn()
          .mockResolvedValueOnce(mockTicker1)
          .mockResolvedValueOnce(mockTicker2);

        const result = await service.getTicker24hr(['BTCUSDT', 'INVALID']);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1); // Only successful ticker
        expect(result.data![0].symbol).toBe('BTCUSDT');
        expect(mockConsole.warn).toHaveBeenCalledWith(
          'Failed to get ticker for INVALID',
          expect.any(Object)
        );
      });

      it('should handle ticker errors in batch mode', async () => {
        service['tradingModule'].getTicker = vi.fn()
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValueOnce({
            success: true,
            data: { symbol: 'ETHUSDT', price: '3000' },
          });

        const result = await service.getTicker24hr(['BTCUSDT', 'ETHUSDT']);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1); // Only successful ticker
        expect(result.data![0].symbol).toBe('ETHUSDT');
        expect(mockConsole.warn).toHaveBeenCalledWith(
          'Failed to get ticker for BTCUSDT',
          expect.any(Object)
        );
      });
    });

    describe('getTicker', () => {
      it('should get single ticker successfully', async () => {
        const mockTicker = {
          success: true,
          data: {
            symbol: 'BTCUSDT',
            price: '50000',
            lastPrice: '50000',
            priceChangePercent: '2.5',
            volume: '1000000',
          },
        };

        service['tradingModule'].getTicker = vi.fn().mockResolvedValue(mockTicker);

        const result = await service.getTicker('BTCUSDT');

        expect(result.success).toBe(true);
        expect(result.data?.symbol).toBe('BTCUSDT');
        expect(result.data?.price).toBe('50000');
        expect(result.data?.lastPrice).toBe('50000');
        expect(result.data?.priceChangePercent).toBe('2.5');
        expect(result.data?.volume).toBe('1000000');

        expect(service['tradingModule'].getTicker).toHaveBeenCalledWith('BTCUSDT');
      });

      it('should handle ticker request failure', async () => {
        const mockTicker = {
          success: false,
          error: 'Rate limit exceeded',
        };

        service['tradingModule'].getTicker = vi.fn().mockResolvedValue(mockTicker);

        const result = await service.getTicker('BTCUSDT');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Rate limit exceeded');
      });

      it('should handle missing ticker data fields', async () => {
        const mockTicker = {
          success: true,
          data: {
            symbol: 'BTCUSDT',
            // Missing price fields
          },
        };

        service['tradingModule'].getTicker = vi.fn().mockResolvedValue(mockTicker);

        const result = await service.getTicker('BTCUSDT');

        expect(result.success).toBe(true);
        expect(result.data?.symbol).toBe('BTCUSDT');
        expect(result.data?.price).toBe('0'); // Default
        expect(result.data?.lastPrice).toBe('0'); // Default
        expect(result.data?.priceChangePercent).toBe('0'); // Default
        expect(result.data?.volume).toBe('0'); // Default
      });
    });

    describe('getSymbolStatus', () => {
      it('should get symbol status successfully', async () => {
        const mockExchangeInfo = {
          success: true,
          data: {
            symbols: [
              {
                symbol: 'BTCUSDT',
                status: 'TRADING',
                baseAsset: 'BTC',
                quoteAsset: 'USDT',
              },
            ],
          },
        };

        service.getExchangeInfo = vi.fn().mockResolvedValue(mockExchangeInfo);

        const result = await service.getSymbolStatus('BTCUSDT');

        expect(result.status).toBe('TRADING');
        expect(result.trading).toBe(true);
      });

      it('should handle symbol not found', async () => {
        const mockExchangeInfo = {
          success: true,
          data: {
            symbols: [
              {
                symbol: 'ETHUSDT',
                status: 'TRADING',
                baseAsset: 'ETH',
                quoteAsset: 'USDT',
              },
            ],
          },
        };

        service.getExchangeInfo = vi.fn().mockResolvedValue(mockExchangeInfo);

        const result = await service.getSymbolStatus('BTCUSDT');

        expect(result.status).toBe('NOT_FOUND');
        expect(result.trading).toBe(false);
      });

      it('should handle exchange info failure', async () => {
        service.getExchangeInfo = vi.fn().mockResolvedValue({
          success: false,
          error: 'API error',
        });

        const result = await service.getSymbolStatus('BTCUSDT');

        expect(result.status).toBe('ERROR');
        expect(result.trading).toBe(false);
      });

      it('should handle errors gracefully', async () => {
        service.getExchangeInfo = vi.fn().mockRejectedValue(
          new Error('Network error')
        );

        const result = await service.getSymbolStatus('BTCUSDT');

        expect(result.status).toBe('ERROR');
        expect(result.trading).toBe(false);
      });

      it('should identify non-trading symbols', async () => {
        const mockExchangeInfo = {
          success: true,
          data: {
            symbols: [
              {
                symbol: 'BTCUSDT',
                status: 'HALTED',
                baseAsset: 'BTC',
                quoteAsset: 'USDT',
              },
            ],
          },
        };

        service.getExchangeInfo = vi.fn().mockResolvedValue(mockExchangeInfo);

        const result = await service.getSymbolStatus('BTCUSDT');

        expect(result.status).toBe('HALTED');
        expect(result.trading).toBe(false);
      });
    });

    describe('getOrderBookDepth', () => {
      it('should get order book depth successfully', async () => {
        const mockOrderBook = {
          success: true,
          data: {
            bids: [['50000', '0.1'], ['49999', '0.2']],
            asks: [['50001', '0.1'], ['50002', '0.2']],
            lastUpdateId: 123456789,
          },
        };

        service['tradingModule'].getOrderBook = vi.fn().mockResolvedValue(mockOrderBook);

        const result = await service.getOrderBookDepth('BTCUSDT', 100);

        expect(result.success).toBe(true);
        expect(result.data?.bids).toHaveLength(2);
        expect(result.data?.asks).toHaveLength(2);
        expect(result.data?.lastUpdateId).toBe(123456789);
        expect(result.data?.bids[0]).toEqual(['50000', '0.1']);
        expect(result.data?.asks[0]).toEqual(['50001', '0.1']);

        expect(service['tradingModule'].getOrderBook).toHaveBeenCalledWith('BTCUSDT', 100);
      });

      it('should use default limit when not provided', async () => {
        const mockOrderBook = {
          success: true,
          data: {
            bids: [],
            asks: [],
            lastUpdateId: 123456789,
          },
        };

        service['tradingModule'].getOrderBook = vi.fn().mockResolvedValue(mockOrderBook);

        const result = await service.getOrderBookDepth('BTCUSDT');

        expect(result.success).toBe(true);
        expect(service['tradingModule'].getOrderBook).toHaveBeenCalledWith('BTCUSDT', 100);
      });

      it('should handle order book request failure', async () => {
        const mockOrderBook = {
          success: false,
          error: 'Symbol not supported',
        };

        service['tradingModule'].getOrderBook = vi.fn().mockResolvedValue(mockOrderBook);

        const result = await service.getOrderBookDepth('BTCUSDT');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Symbol not supported');
      });

      it('should handle missing order book data', async () => {
        const mockOrderBook = {
          success: true,
          data: {
            // Missing bids, asks, lastUpdateId
          },
        };

        service['tradingModule'].getOrderBook = vi.fn().mockResolvedValue(mockOrderBook);

        const result = await service.getOrderBookDepth('BTCUSDT');

        expect(result.success).toBe(true);
        expect(result.data?.bids).toEqual([]);
        expect(result.data?.asks).toEqual([]);
        expect(result.data?.lastUpdateId).toBeDefined(); // Auto-generated
      });
    });
  });

  describe('Cache Management', () => {
    it('should invalidate calendar cache', () => {
      const result = service.invalidateCalendarCache();
      
      expect(result).toBe(5);
      expect(service['cacheLayer'].invalidateCalendar).toHaveBeenCalled();
    });

    it('should invalidate symbols cache', () => {
      const result = service.invalidateSymbolsCache();
      
      expect(result).toBe(10);
      expect(service['cacheLayer'].invalidateSymbols).toHaveBeenCalled();
    });

    it('should invalidate user cache', () => {
      const result = service.invalidateUserCache();
      
      expect(result).toBe(3);
      expect(service['cacheLayer'].invalidateUserData).toHaveBeenCalled();
    });

    it('should get cache metrics', () => {
      const metrics = service.getCacheMetrics();
      
      expect(metrics).toEqual({
        hits: 100,
        misses: 20,
        size: 50,
        hitRate: 0.83,
      });
      expect(service['cacheLayer'].getMetrics).toHaveBeenCalled();
    });
  });

  describe('Status and Configuration', () => {
    it('should check valid credentials', () => {
      const result = service.hasValidCredentials();
      
      expect(result).toBe(true);
      
      const { hasValidCredentials } = require('../../../../src/services/api/unified-mexc-config');
      expect(hasValidCredentials).toHaveBeenCalledWith(service['config']);
    });

    it('should get service status', () => {
      const status = service.getStatus();
      
      expect(status).toEqual({
        config: {
          baseUrl: 'https://api.mexc.com',
          cachingEnabled: true,
          circuitBreakerEnabled: true,
          enhancedFeaturesEnabled: true,
        },
        cache: {
          hits: 100,
          misses: 20,
          size: 50,
          hitRate: 0.83,
        },
        timestamp: expect.any(Number),
      });
    });
  });

  describe('Utility Methods', () => {
    describe('getCurrentPrice', () => {
      it('should get current price successfully', async () => {
        const mockTicker = {
          success: true,
          data: {
            symbol: 'BTCUSDT',
            lastPrice: '50000.123',
          },
        };

        service.getTicker = vi.fn().mockResolvedValue(mockTicker);

        const result = await service.getCurrentPrice('BTCUSDT');

        expect(result).toBe(50000.123);
        expect(service.getTicker).toHaveBeenCalledWith('BTCUSDT');
      });

      it('should return 0 when ticker fails', async () => {
        service.getTicker = vi.fn().mockResolvedValue({
          success: false,
          error: 'Symbol not found',
        });

        const result = await service.getCurrentPrice('INVALID');

        expect(result).toBe(0);
      });

      it('should return 0 when no price data', async () => {
        service.getTicker = vi.fn().mockResolvedValue({
          success: true,
          data: {
            symbol: 'BTCUSDT',
            // No lastPrice
          },
        });

        const result = await service.getCurrentPrice('BTCUSDT');

        expect(result).toBe(0);
      });

      it('should handle errors gracefully', async () => {
        service.getTicker = vi.fn().mockRejectedValue(
          new Error('Network error')
        );

        const result = await service.getCurrentPrice('BTCUSDT');

        expect(result).toBe(0);
      });
    });

    describe('canTrade', () => {
      it('should return true for trading symbols', async () => {
        service.getExchangeInfo = vi.fn().mockResolvedValue({
          success: true,
          data: {
            symbols: [
              {
                symbol: 'BTCUSDT',
                status: 'TRADING',
              },
            ],
          },
        });

        const result = await service.canTrade('BTCUSDT');

        expect(result).toBe(true);
      });

      it('should return false for non-trading symbols', async () => {
        service.getExchangeInfo = vi.fn().mockResolvedValue({
          success: true,
          data: {
            symbols: [
              {
                symbol: 'BTCUSDT',
                status: 'HALTED',
              },
            ],
          },
        });

        const result = await service.canTrade('BTCUSDT');

        expect(result).toBe(false);
      });

      it('should return false when symbol not found', async () => {
        service.getExchangeInfo = vi.fn().mockResolvedValue({
          success: true,
          data: {
            symbols: [],
          },
        });

        const result = await service.canTrade('BTCUSDT');

        expect(result).toBe(false);
      });

      it('should return false when exchange info fails', async () => {
        service.getExchangeInfo = vi.fn().mockResolvedValue({
          success: false,
          error: 'API error',
        });

        const result = await service.canTrade('BTCUSDT');

        expect(result).toBe(false);
      });

      it('should handle errors gracefully', async () => {
        service.getExchangeInfo = vi.fn().mockRejectedValue(
          new Error('Network error')
        );

        const result = await service.canTrade('BTCUSDT');

        expect(result).toBe(false);
      });
    });

    describe('getSymbolPriceTicker', () => {
      it('should get symbol price ticker successfully', async () => {
        const mockTicker = {
          success: true,
          data: {
            symbol: 'BTCUSDT',
            price: '50000',
            lastPrice: '50000.123',
            priceChangePercent: '2.5',
            volume: '1000000',
          },
        };

        service.getTicker = vi.fn().mockResolvedValue(mockTicker);

        const result = await service.getSymbolPriceTicker('BTCUSDT');

        expect(result.success).toBe(true);
        expect(result.data?.symbol).toBe('BTCUSDT');
        expect(result.data?.price).toBe('50000.123'); // Uses lastPrice
        expect(result.data?.lastPrice).toBe('50000.123');
        expect(result.data?.priceChangePercent).toBe('2.5');
        expect(result.data?.volume).toBe('1000000');
      });

      it('should fallback to price when lastPrice missing', async () => {
        const mockTicker = {
          success: true,
          data: {
            symbol: 'BTCUSDT',
            price: '50000',
            // No lastPrice
          },
        };

        service.getTicker = vi.fn().mockResolvedValue(mockTicker);

        const result = await service.getSymbolPriceTicker('BTCUSDT');

        expect(result.success).toBe(true);
        expect(result.data?.price).toBe('50000'); // Uses price
        expect(result.data?.lastPrice).toBe('50000'); // Falls back to price
      });

      it('should handle ticker failure', async () => {
        service.getTicker = vi.fn().mockResolvedValue({
          success: false,
          error: 'Symbol not found',
        });

        const result = await service.getSymbolPriceTicker('INVALID');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Symbol not found');
      });
    });

    describe('hasRecentActivity', () => {
      it('should detect recent activity', async () => {
        const recentTimestamp = Date.now() - 1000 * 60 * 60; // 1 hour ago

        service.getActivityData = vi.fn().mockResolvedValue({
          success: true,
          data: { someData: 'value' },
          timestamp: recentTimestamp,
        });

        const result = await service.hasRecentActivity('BTC');

        expect(result).toBe(true);
        expect(service.getActivityData).toHaveBeenCalledWith('BTC');
      });

      it('should detect no recent activity', async () => {
        const oldTimestamp = Date.now() - 1000 * 60 * 60 * 48; // 48 hours ago

        service.getActivityData = vi.fn().mockResolvedValue({
          success: true,
          data: { someData: 'value' },
          timestamp: oldTimestamp,
        });

        const result = await service.hasRecentActivity('BTC');

        expect(result).toBe(false);
      });

      it('should handle custom timeframe', async () => {
        const recentTimestamp = Date.now() - 1000 * 60 * 30; // 30 minutes ago
        const customTimeframe = 1000 * 60 * 60; // 1 hour

        service.getActivityData = vi.fn().mockResolvedValue({
          success: true,
          data: { someData: 'value' },
          timestamp: recentTimestamp,
        });

        const result = await service.hasRecentActivity('BTC', customTimeframe);

        expect(result).toBe(true);
      });

      it('should handle string timestamps', async () => {
        const recentTimestamp = new Date(Date.now() - 1000 * 60 * 60).toISOString();

        service.getActivityData = vi.fn().mockResolvedValue({
          success: true,
          data: { someData: 'value' },
          timestamp: recentTimestamp,
        });

        const result = await service.hasRecentActivity('BTC');

        expect(result).toBe(true);
      });

      it('should return false when activity data fails', async () => {
        service.getActivityData = vi.fn().mockResolvedValue({
          success: false,
          error: 'Currency not found',
        });

        const result = await service.hasRecentActivity('INVALID');

        expect(result).toBe(false);
      });

      it('should handle activity data errors', async () => {
        service.getActivityData = vi.fn().mockRejectedValue(
          new Error('Network error')
        );

        const result = await service.hasRecentActivity('BTC');

        expect(result).toBe(false);
        expect(mockConsole.warn).toHaveBeenCalledWith(
          'Failed to check recent activity for BTC:',
          expect.any(Error)
        );
      });
    });

    it('should destroy cache layer on destroy', () => {
      service.destroy();
      
      expect(service['cacheLayer'].destroy).toHaveBeenCalled();
    });
  });

  describe('Factory Functions', () => {
    describe('createUnifiedMexcServiceV2', () => {
      it('should create new service instance', () => {
        const newService = createUnifiedMexcServiceV2();
        
        expect(newService).toBeInstanceOf(UnifiedMexcServiceV2);
        expect(newService).not.toBe(service);
      });

      it('should create service with configuration', () => {
        const config = {
          apiKey: 'custom-key',
          baseUrl: 'https://custom.api.com',
        };
        
        const newService = createUnifiedMexcServiceV2(config);
        
        expect(newService).toBeInstanceOf(UnifiedMexcServiceV2);
      });
    });

    describe('getUnifiedMexcServiceV2', () => {
      it('should create global service on first call', () => {
        const globalService = getUnifiedMexcServiceV2();
        
        expect(globalService).toBeInstanceOf(UnifiedMexcServiceV2);
      });

      it('should return same instance on subsequent calls', () => {
        const service1 = getUnifiedMexcServiceV2();
        const service2 = getUnifiedMexcServiceV2();
        
        expect(service1).toBe(service2);
      });

      it('should create service with configuration on first call', () => {
        resetUnifiedMexcServiceV2();
        
        const config = {
          apiKey: 'global-key',
          baseUrl: 'https://global.api.com',
        };
        
        const globalService = getUnifiedMexcServiceV2(config);
        
        expect(globalService).toBeInstanceOf(UnifiedMexcServiceV2);
      });
    });

    describe('resetUnifiedMexcServiceV2', () => {
      it('should reset global service instance', () => {
        const service1 = getUnifiedMexcServiceV2();
        resetUnifiedMexcServiceV2();
        const service2 = getUnifiedMexcServiceV2();
        
        expect(service1).not.toBe(service2);
      });

      it('should call destroy on existing instance', () => {
        const globalService = getUnifiedMexcServiceV2();
        const destroySpy = vi.spyOn(globalService, 'destroy');
        
        resetUnifiedMexcServiceV2();
        
        expect(destroySpy).toHaveBeenCalled();
      });

      it('should handle reset when no global instance exists', () => {
        resetUnifiedMexcServiceV2();
        
        expect(() => resetUnifiedMexcServiceV2()).not.toThrow();
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle module delegation errors gracefully', async () => {
      // Test when core module methods throw errors
      service['coreModule'].getAllSymbols = vi.fn().mockRejectedValue(
        new Error('Core module error')
      );

      const result = await service.getExchangeInfo();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Core module error');
    });

    it('should handle missing module data gracefully', async () => {
      // Test when modules return null/undefined data
      service['coreModule'].getAllSymbols = vi.fn().mockResolvedValue({
        success: true,
        data: null,
      });

      const result = await service.getExchangeInfo();

      expect(result.success).toBe(true);
      expect(result.data?.symbols).toEqual([]);
    });

    it('should handle invalid numeric conversions', async () => {
      service['coreClient'].getOrderStatus = vi.fn().mockResolvedValue({
        success: true,
        data: {
          orderId: 'invalid-number',
        },
      });

      const result = await service.getOrderStatus('invalid');

      expect(result.success).toBe(true);
      expect(result.data?.orderId).toBe('invalid'); // Falls back to input
    });

    it('should handle promise rejections in batch operations', async () => {
      // Test batch ticker operations with some failures
      service['tradingModule'].getTicker = vi.fn()
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({
          success: true,
          data: { symbol: 'ETHUSDT', price: '3000' },
        });

      const result = await service.getTicker24hr(['BTCUSDT', 'ETHUSDT']);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1); // Only successful one
      expect(mockConsole.warn).toHaveBeenCalled();
    });
  });
});