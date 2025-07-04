/**
 * Unit tests for MexcTradingService
 * Tests trading operations, order management, account info, market data, and credential validation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  MexcTradingService,
  type OrderParams,
  type OrderResult,
  type OrderBook,
  type AccountInfo,
  type CredentialTestResult,
} from '../../../../src/services/api/mexc-trading-service';
import type { MexcApiClient } from '../../../../src/services/api/mexc-api-client';
import type { MexcServiceResponse } from '@/src/schemas/unified/mexc-api-schemas';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../../utils/timeout-elimination-helpers';

// Mock the error utility
vi.mock('../../../../src/lib/error-type-utils', () => ({
  toSafeError: vi.fn((error) => ({
    message: error instanceof Error ? error.message : String(error),
  })),
}));

describe('MexcTradingService', () => {
  let tradingService: MexcTradingService;
  let mockApiClient: MexcApiClient;
  let mockConsole: any;

  beforeEach(() => {
    vi.clearAllMocks();

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

    // Create mock API client
    mockApiClient = {
      hasCredentials: vi.fn().mockReturnValue(true),
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    } as any;

    tradingService = new MexcTradingService(mockApiClient);
  });

  afterEach(async () => {
    // TIMEOUT ELIMINATION: Ensure all promises are flushed before cleanup
    await flushPromises();
    vi.restoreAllMocks();
  
  });

  describe('Constructor', () => {
    it('should create trading service with API client', () => {
      expect(tradingService).toBeDefined();
      expect(tradingService).toBeInstanceOf(MexcTradingService);
    });

    it('should store API client reference', () => {
      // Verify that the API client is being used (indirectly through method calls)
      expect(() => tradingService.testCredentials()).not.toThrow();
    });
  });

  describe('Order Management', () => {
    describe('placeOrder', () => {
      const validOrderParams: OrderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: 1.0,
        price: 50000,
        timeInForce: 'GTC',
      };

      const mockOrderResponse = {
        success: true,
        data: {
          orderId: '12345',
          symbol: 'BTCUSDT',
          side: 'BUY',
          origQty: '1.0',
          price: '50000',
          status: 'NEW',
        },
        timestamp: new Date().toISOString(),
        requestId: 'req-123',
        responseTime: 150,
      };

      it('should place order successfully', async () => {
        mockApiClient.post = vi.fn().mockResolvedValue(mockOrderResponse);

        const result = await tradingService.placeOrder(validOrderParams);

        expect(mockApiClient.post).toHaveBeenCalledWith('/api/v3/order', {
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'LIMIT',
          quantity: 1.0,
          price: 50000,
          timeInForce: 'GTC',
          newOrderRespType: 'RESULT',
        });

        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
          orderId: '12345',
          symbol: 'BTCUSDT',
          side: 'BUY',
          quantity: '1.0',
          price: '50000',
          status: 'NEW',
        });
      });

      it('should use default order parameters', async () => {
        const minimalParams: OrderParams = {
          symbol: 'ETHUSDT',
          side: 'SELL',
          quantity: 2.0,
        };

        mockApiClient.post = vi.fn().mockResolvedValue(mockOrderResponse);

        await tradingService.placeOrder(minimalParams);

        expect(mockApiClient.post).toHaveBeenCalledWith('/api/v3/order', {
          symbol: 'ETHUSDT',
          side: 'SELL',
          type: 'LIMIT',
          quantity: 2.0,
          price: undefined,
          timeInForce: 'GTC',
          newOrderRespType: 'RESULT',
        });
      });

      it('should include optional parameters when provided', async () => {
        const complexParams: OrderParams = {
          symbol: 'ADAUSDT',
          side: 'BUY',
          type: 'STOP_LOSS_LIMIT',
          quantity: 100,
          price: 1.5,
          stopPrice: 1.4,
          icebergQty: 10,
          timeInForce: 'IOC',
          newOrderRespType: 'FULL',
        };

        mockApiClient.post = vi.fn().mockResolvedValue(mockOrderResponse);

        await tradingService.placeOrder(complexParams);

        expect(mockApiClient.post).toHaveBeenCalledWith('/api/v3/order', {
          symbol: 'ADAUSDT',
          side: 'BUY',
          type: 'STOP_LOSS_LIMIT',
          quantity: 100,
          price: 1.5,
          timeInForce: 'IOC',
          newOrderRespType: 'FULL',
          stopPrice: 1.4,
          icebergQty: 10,
        });
      });

      it('should handle order failure gracefully', async () => {
        const errorResponse = {
          success: false,
          error: 'Insufficient balance',
          timestamp: new Date().toISOString(),
        };

        mockApiClient.post = vi.fn().mockResolvedValue(errorResponse);

        const result = await tradingService.placeOrder(validOrderParams);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Insufficient balance');
      });

      it('should handle API client exceptions', async () => {
        mockApiClient.post = vi.fn().mockRejectedValue(new Error('Network error'));

        const result = await tradingService.placeOrder(validOrderParams);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to place order: Network error');
      });

      it('should require credentials for placing orders', async () => {
        mockApiClient.hasCredentials = vi.fn().mockReturnValue(false);

        const result = await tradingService.placeOrder(validOrderParams);

        expect(result.success).toBe(false);
        expect(result.error).toBe('API credentials are required for placing orders');
        expect(mockApiClient.post).not.toHaveBeenCalled();
      });

      it('should handle different order ID formats', async () => {
        const responseWithId = {
          ...mockOrderResponse,
          data: {
            ...mockOrderResponse.data,
            id: 67890, // Different ID field
            orderId: undefined,
          },
        };

        mockApiClient.post = vi.fn().mockResolvedValue(responseWithId);

        const result = await tradingService.placeOrder(validOrderParams);

        expect(result.data?.orderId).toBe('67890');
      });
    });

    describe('getOrderStatus', () => {
      it('should get order status successfully', async () => {
        const mockResponse = {
          success: true,
          data: { orderId: '123', status: 'FILLED' },
          timestamp: new Date().toISOString(),
        };

        mockApiClient.get = vi.fn().mockResolvedValue(mockResponse);

        const result = await tradingService.getOrderStatus('BTCUSDT', '123');

        expect(mockApiClient.get).toHaveBeenCalledWith('/api/v3/order', {
          symbol: 'BTCUSDT',
          orderId: '123',
        });
        expect(result).toEqual(mockResponse);
      });

      it('should require credentials for order status', async () => {
        mockApiClient.hasCredentials = vi.fn().mockReturnValue(false);

        const result = await tradingService.getOrderStatus('BTCUSDT', '123');

        expect(result.success).toBe(false);
        expect(result.error).toBe('API credentials are required for order status');
        expect(mockApiClient.get).not.toHaveBeenCalled();
      });
    });

    describe('cancelOrder', () => {
      it('should cancel order successfully', async () => {
        const mockResponse = {
          success: true,
          data: { orderId: '123', status: 'CANCELED' },
          timestamp: new Date().toISOString(),
        };

        mockApiClient.delete = vi.fn().mockResolvedValue(mockResponse);

        const result = await tradingService.cancelOrder('BTCUSDT', '123');

        expect(mockApiClient.delete).toHaveBeenCalledWith('/api/v3/order', {
          symbol: 'BTCUSDT',
          orderId: '123',
        });
        expect(result).toEqual(mockResponse);
      });

      it('should require credentials for canceling orders', async () => {
        mockApiClient.hasCredentials = vi.fn().mockReturnValue(false);

        const result = await tradingService.cancelOrder('BTCUSDT', '123');

        expect(result.success).toBe(false);
        expect(result.error).toBe('API credentials are required for canceling orders');
        expect(mockApiClient.delete).not.toHaveBeenCalled();
      });
    });

    describe('getOpenOrders', () => {
      it('should get open orders for specific symbol', async () => {
        const mockResponse = {
          success: true,
          data: [{ orderId: '123', symbol: 'BTCUSDT', status: 'NEW' }],
          timestamp: new Date().toISOString(),
        };

        mockApiClient.get = vi.fn().mockResolvedValue(mockResponse);

        const result = await tradingService.getOpenOrders('BTCUSDT');

        expect(mockApiClient.get).toHaveBeenCalledWith('/api/v3/openOrders', {
          symbol: 'BTCUSDT',
        });
        expect(result).toEqual(mockResponse);
      });

      it('should get all open orders when no symbol provided', async () => {
        const mockResponse = {
          success: true,
          data: [
            { orderId: '123', symbol: 'BTCUSDT', status: 'NEW' },
            { orderId: '456', symbol: 'ETHUSDT', status: 'PARTIALLY_FILLED' },
          ],
          timestamp: new Date().toISOString(),
        };

        mockApiClient.get = vi.fn().mockResolvedValue(mockResponse);

        const result = await tradingService.getOpenOrders();

        expect(mockApiClient.get).toHaveBeenCalledWith('/api/v3/openOrders', {});
        expect(result).toEqual(mockResponse);
      });

      it('should require credentials for getting open orders', async () => {
        mockApiClient.hasCredentials = vi.fn().mockReturnValue(false);

        const result = await tradingService.getOpenOrders();

        expect(result.success).toBe(false);
        expect(result.error).toBe('API credentials are required for getting open orders');
        expect(mockApiClient.get).not.toHaveBeenCalled();
      });
    });
  });

  describe('Market Data', () => {
    describe('getOrderBook', () => {
      const mockDepthResponse = {
        success: true,
        data: {
          bids: [
            ['50000.00', '1.0'],
            ['49999.00', '2.0'],
          ],
          asks: [
            ['50001.00', '1.5'],
            ['50002.00', '0.5'],
          ],
        },
        timestamp: new Date().toISOString(),
      };

      it('should get order book successfully with array format', async () => {
        mockApiClient.get = vi.fn().mockResolvedValue(mockDepthResponse);

        const result = await tradingService.getOrderBook('BTCUSDT', 50);

        expect(mockApiClient.get).toHaveBeenCalledWith('/api/v3/depth', {
          symbol: 'BTCUSDT',
          limit: 50,
        });

        expect(result).toMatchObject({
          symbol: 'BTCUSDT',
          bids: [
            { price: '50000.00', quantity: '1.0' },
            { price: '49999.00', quantity: '2.0' },
          ],
          asks: [
            { price: '50001.00', quantity: '1.5' },
            { price: '50002.00', quantity: '0.5' },
          ],
          timestamp: expect.any(Number),
        });
      });

      it('should handle object format bids/asks', async () => {
        const objectFormatResponse = {
          success: true,
          data: {
            bids: [
              { price: '50000.00', quantity: '1.0' },
              { price: '49999.00', quantity: '2.0' },
            ],
            asks: [
              { price: '50001.00', quantity: '1.5' },
              { price: '50002.00', quantity: '0.5' },
            ],
          },
          timestamp: new Date().toISOString(),
        };

        mockApiClient.get = vi.fn().mockResolvedValue(objectFormatResponse);

        const result = await tradingService.getOrderBook('ETHUSDT');

        expect(result.bids).toEqual([
          { price: '50000.00', quantity: '1.0' },
          { price: '49999.00', quantity: '2.0' },
        ]);
        expect(result.asks).toEqual([
          { price: '50001.00', quantity: '1.5' },
          { price: '50002.00', quantity: '0.5' },
        ]);
      });

      it('should use default limit of 100', async () => {
        mockApiClient.get = vi.fn().mockResolvedValue(mockDepthResponse);

        await tradingService.getOrderBook('BTCUSDT');

        expect(mockApiClient.get).toHaveBeenCalledWith('/api/v3/depth', {
          symbol: 'BTCUSDT',
          limit: 100,
        });
      });

      it('should handle API failures gracefully', async () => {
        mockApiClient.get = vi.fn().mockResolvedValue({
          success: false,
          error: 'Symbol not found',
        });

        const result = await tradingService.getOrderBook('INVALID');

        expect(result).toMatchObject({
          symbol: 'INVALID',
          bids: [],
          asks: [],
          timestamp: expect.any(Number),
        });
        expect(mockConsole.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to get order book for INVALID'),
          'Symbol not found'
        );
      });

      it('should handle network exceptions', async () => {
        mockApiClient.get = vi.fn().mockRejectedValue(new Error('Network error'));

        const result = await tradingService.getOrderBook('BTCUSDT');

        expect(result).toMatchObject({
          symbol: 'BTCUSDT',
          bids: [],
          asks: [],
          timestamp: expect.any(Number),
        });
        expect(mockConsole.error).toHaveBeenCalled();
      });

      it('should handle missing bids/asks in response', async () => {
        const emptyResponse = {
          success: true,
          data: {},
          timestamp: new Date().toISOString(),
        };

        mockApiClient.get = vi.fn().mockResolvedValue(emptyResponse);

        const result = await tradingService.getOrderBook('BTCUSDT');

        expect(result.bids).toEqual([]);
        expect(result.asks).toEqual([]);
      });
    });
  });

  describe('Account Information', () => {
    describe('getAccountInfo', () => {
      const mockAccountResponse = {
        success: true,
        data: {
          accountType: 'SPOT',
          canTrade: true,
          canWithdraw: true,
          canDeposit: true,
          balances: [
            { asset: 'BTC', free: '1.0', locked: '0.0' },
            { asset: 'USDT', free: '10000.0', locked: '500.0' },
          ],
          permissions: ['SPOT'],
          updateTime: 1640995200000,
        },
        timestamp: new Date().toISOString(),
        requestId: 'req-456',
        responseTime: 200,
      };

      it('should get account info successfully', async () => {
        mockApiClient.get = vi.fn().mockResolvedValue(mockAccountResponse);

        const result = await tradingService.getAccountInfo();

        expect(mockApiClient.get).toHaveBeenCalledWith('/api/v3/account');
        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
          accountType: 'SPOT',
          canTrade: true,
          canWithdraw: true,
          canDeposit: true,
          balances: [
            { asset: 'BTC', free: '1.0', locked: '0.0' },
            { asset: 'USDT', free: '10000.0', locked: '500.0' },
          ],
          permissions: ['SPOT'],
          updateTime: 1640995200000,
        });
      });

      it('should apply default values for missing fields', async () => {
        const minimalResponse = {
          success: true,
          data: {},
          timestamp: new Date().toISOString(),
        };

        mockApiClient.get = vi.fn().mockResolvedValue(minimalResponse);

        const result = await tradingService.getAccountInfo();

        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
          accountType: 'SPOT',
          canTrade: true,
          canWithdraw: true,
          canDeposit: true,
          balances: [],
          permissions: ['SPOT'],
          updateTime: expect.any(Number),
        });
      });

      it('should handle API failures', async () => {
        const errorResponse = {
          success: false,
          error: 'Invalid signature',
          timestamp: new Date().toISOString(),
        };

        mockApiClient.get = vi.fn().mockResolvedValue(errorResponse);

        const result = await tradingService.getAccountInfo();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid signature');
      });

      it('should handle exceptions gracefully', async () => {
        mockApiClient.get = vi.fn().mockRejectedValue(new Error('Request timeout'));

        const result = await tradingService.getAccountInfo();

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to get account info: Request timeout');
      });

      it('should require credentials for account info', async () => {
        mockApiClient.hasCredentials = vi.fn().mockReturnValue(false);

        const result = await tradingService.getAccountInfo();

        expect(result.success).toBe(false);
        expect(result.error).toBe('API credentials are required for account information');
        expect(mockApiClient.get).not.toHaveBeenCalled();
      });
    });

    describe('getBalances', () => {
      it('should extract balances from account info', async () => {
        const mockAccountResponse = {
          success: true,
          data: {
            accountType: 'SPOT',
            balances: [
              { asset: 'BTC', free: '1.0', locked: '0.0' },
              { asset: 'ETH', free: '10.0', locked: '2.0' },
            ],
            permissions: ['SPOT'],
            updateTime: Date.now(),
          },
          timestamp: new Date().toISOString(),
          requestId: 'req-789',
          responseTime: 150,
        };

        // Mock getAccountInfo
        vi.spyOn(tradingService, 'getAccountInfo').mockResolvedValue(mockAccountResponse);

        const result = await tradingService.getBalances();

        expect(result.success).toBe(true);
        expect(result.data).toEqual([
          { asset: 'BTC', free: '1.0', locked: '0.0' },
          { asset: 'ETH', free: '10.0', locked: '2.0' },
        ]);
        expect(result.requestId).toBe('req-789');
        expect(result.responseTime).toBe(150);
      });

      it('should handle account info failure', async () => {
        const errorResponse = {
          success: false,
          error: 'Account info failed',
          timestamp: new Date().toISOString(),
        };

        vi.spyOn(tradingService, 'getAccountInfo').mockResolvedValue(errorResponse);

        const result = await tradingService.getBalances();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Account info failed');
      });
    });
  });

  describe('Public Market Data', () => {
    describe('getExchangeInfo', () => {
      it('should get exchange info', async () => {
        const mockResponse = { success: true, data: { symbols: [] } };
        mockApiClient.get = vi.fn().mockResolvedValue(mockResponse);

        const result = await tradingService.getExchangeInfo();

        expect(mockApiClient.get).toHaveBeenCalledWith('/api/v3/exchangeInfo');
        expect(result).toEqual(mockResponse);
      });
    });

    describe('getServerTime', () => {
      it('should get server time', async () => {
        const mockResponse = { success: true, data: { serverTime: 1640995200000 } };
        mockApiClient.get = vi.fn().mockResolvedValue(mockResponse);

        const result = await tradingService.getServerTime();

        expect(mockApiClient.get).toHaveBeenCalledWith('/api/v3/time');
        expect(result).toEqual(mockResponse);
      });
    });

    describe('ping', () => {
      it('should ping API successfully', async () => {
        const mockResponse = { success: true, data: {} };
        mockApiClient.get = vi.fn().mockResolvedValue(mockResponse);

        const result = await tradingService.ping();

        expect(mockApiClient.get).toHaveBeenCalledWith('/api/v3/ping');
        expect(result).toEqual(mockResponse);
      });
    });

    describe('get24hrTicker', () => {
      it('should get 24hr ticker for specific symbol', async () => {
        const mockResponse = { success: true, data: { symbol: 'BTCUSDT', priceChange: '100' } };
        mockApiClient.get = vi.fn().mockResolvedValue(mockResponse);

        const result = await tradingService.get24hrTicker('BTCUSDT');

        expect(mockApiClient.get).toHaveBeenCalledWith('/api/v3/ticker/24hr', { symbol: 'BTCUSDT' });
        expect(result).toEqual(mockResponse);
      });

      it('should get 24hr ticker for all symbols', async () => {
        const mockResponse = { success: true, data: [{ symbol: 'BTCUSDT' }] };
        mockApiClient.get = vi.fn().mockResolvedValue(mockResponse);

        const result = await tradingService.get24hrTicker();

        expect(mockApiClient.get).toHaveBeenCalledWith('/api/v3/ticker/24hr', {});
        expect(result).toEqual(mockResponse);
      });
    });

    describe('getSymbolPriceTicker', () => {
      it('should get price ticker for specific symbol', async () => {
        const mockResponse = { success: true, data: { symbol: 'BTCUSDT', price: '50000' } };
        mockApiClient.get = vi.fn().mockResolvedValue(mockResponse);

        const result = await tradingService.getSymbolPriceTicker('BTCUSDT');

        expect(mockApiClient.get).toHaveBeenCalledWith('/api/v3/ticker/price', { symbol: 'BTCUSDT' });
        expect(result).toEqual(mockResponse);
      });

      it('should get price ticker for all symbols', async () => {
        const mockResponse = { success: true, data: [{ symbol: 'BTCUSDT', price: '50000' }] };
        mockApiClient.get = vi.fn().mockResolvedValue(mockResponse);

        const result = await tradingService.getSymbolPriceTicker();

        expect(mockApiClient.get).toHaveBeenCalledWith('/api/v3/ticker/price', {});
        expect(result).toEqual(mockResponse);
      });
    });

    describe('getBookTicker', () => {
      it('should get book ticker for specific symbol', async () => {
        const mockResponse = { success: true, data: { symbol: 'BTCUSDT', bidPrice: '49999' } };
        mockApiClient.get = vi.fn().mockResolvedValue(mockResponse);

        const result = await tradingService.getBookTicker('BTCUSDT');

        expect(mockApiClient.get).toHaveBeenCalledWith('/api/v3/ticker/bookTicker', { symbol: 'BTCUSDT' });
        expect(result).toEqual(mockResponse);
      });

      it('should get book ticker for all symbols', async () => {
        const mockResponse = { success: true, data: [{ symbol: 'BTCUSDT', bidPrice: '49999' }] };
        mockApiClient.get = vi.fn().mockResolvedValue(mockResponse);

        const result = await tradingService.getBookTicker();

        expect(mockApiClient.get).toHaveBeenCalledWith('/api/v3/ticker/bookTicker', {});
        expect(result).toEqual(mockResponse);
      });
    });
  });

  describe('Credential Testing', () => {
    describe('testCredentials', () => {
      it('should test credentials successfully', async () => {
        const mockPingResponse = { success: true, data: {} };
        const mockAccountResponse = {
          success: true,
          data: {
            accountType: 'SPOT',
            permissions: ['SPOT', 'MARGIN'],
          },
        };

        // Add artificial delay to ensure responseTime > 0
        vi.spyOn(tradingService, 'ping').mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 1));
          return mockPingResponse;
        });
        vi.spyOn(tradingService, 'getAccountInfo').mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 1));
          return mockAccountResponse;
        });

        const result = await tradingService.testCredentials();

        expect(result.isValid).toBe(true);
        expect(result.hasConnection).toBe(true);
        expect(result.accountType).toBe('SPOT');
        expect(result.permissions).toEqual(['SPOT', 'MARGIN']);
        expect(result.responseTime).toBeGreaterThan(0);
        expect(result.error).toBeUndefined();
      });

      it('should handle no credentials', async () => {
        mockApiClient.hasCredentials = vi.fn().mockReturnValue(false);

        // Add small delay to ensure responseTime > 0
        await new Promise(resolve => setTimeout(resolve, 1));
        const result = await tradingService.testCredentials();

        expect(result.isValid).toBe(false);
        expect(result.hasConnection).toBe(false);
        expect(result.error).toBe('No API credentials configured');
        expect(result.responseTime).toBeGreaterThanOrEqual(0);
      });

      it('should handle connection failure', async () => {
        const mockPingResponse = { success: false, error: 'Network error' };

        vi.spyOn(tradingService, 'ping').mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 1));
          return mockPingResponse;
        });

        const result = await tradingService.testCredentials();

        expect(result.isValid).toBe(false);
        expect(result.hasConnection).toBe(false);
        expect(result.error).toBe('Cannot connect to MEXC API');
        expect(result.responseTime).toBeGreaterThan(0);
      });

      it('should handle invalid credentials', async () => {
        const mockPingResponse = { success: true, data: {} };
        const mockAccountResponse = {
          success: false,
          error: 'Invalid API key',
        };

        vi.spyOn(tradingService, 'ping').mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 1));
          return mockPingResponse;
        });
        vi.spyOn(tradingService, 'getAccountInfo').mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 1));
          return mockAccountResponse;
        });

        const result = await tradingService.testCredentials();

        expect(result.isValid).toBe(false);
        expect(result.hasConnection).toBe(true);
        expect(result.error).toBe('Invalid API key');
        expect(result.responseTime).toBeGreaterThan(0);
      });

      it('should handle exceptions during testing', async () => {
        vi.spyOn(tradingService, 'ping').mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 1));
          throw new Error('Network timeout');
        });

        const result = await tradingService.testCredentials();

        expect(result.isValid).toBe(false);
        expect(result.hasConnection).toBe(false);
        expect(result.error).toBe('Network timeout');
        expect(result.responseTime).toBeGreaterThan(0);
      });

      it('should handle successful ping but failed account info', async () => {
        const mockPingResponse = { success: true, data: {} };

        vi.spyOn(tradingService, 'ping').mockResolvedValue(mockPingResponse);
        vi.spyOn(tradingService, 'getAccountInfo').mockResolvedValue({
          success: false,
          error: 'Signature verification failed',
          timestamp: new Date().toISOString(),
        });

        const result = await tradingService.testCredentials();

        expect(result.hasConnection).toBe(true);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Signature verification failed');
      });

      it('should handle account info with missing error field', async () => {
        const mockPingResponse = { success: true, data: {} };
        const mockAccountResponse = {
          success: false,
          timestamp: new Date().toISOString(),
        };

        vi.spyOn(tradingService, 'ping').mockResolvedValue(mockPingResponse);
        vi.spyOn(tradingService, 'getAccountInfo').mockResolvedValue(mockAccountResponse);

        const result = await tradingService.testCredentials();

        expect(result.error).toBe('Invalid credentials');
      });
    });
  });

  describe('Trading History', () => {
    describe('getTradeHistory', () => {
      it('should get trade history for symbol', async () => {
        const mockResponse = {
          success: true,
          data: [
            { id: 1, symbol: 'BTCUSDT', price: '50000', qty: '1.0' },
            { id: 2, symbol: 'BTCUSDT', price: '49999', qty: '0.5' },
          ],
        };

        mockApiClient.get = vi.fn().mockResolvedValue(mockResponse);

        const result = await tradingService.getTradeHistory('BTCUSDT', 100);

        expect(mockApiClient.get).toHaveBeenCalledWith('/api/v3/myTrades', {
          symbol: 'BTCUSDT',
          limit: 100,
        });
        expect(result).toEqual(mockResponse);
      });

      it('should use default limit of 500', async () => {
        const mockResponse = { success: true, data: [] };
        mockApiClient.get = vi.fn().mockResolvedValue(mockResponse);

        await tradingService.getTradeHistory('ETHUSDT');

        expect(mockApiClient.get).toHaveBeenCalledWith('/api/v3/myTrades', {
          symbol: 'ETHUSDT',
          limit: 500,
        });
      });

      it('should require credentials for trade history', async () => {
        mockApiClient.hasCredentials = vi.fn().mockReturnValue(false);

        const result = await tradingService.getTradeHistory('BTCUSDT');

        expect(result.success).toBe(false);
        expect(result.error).toBe('API credentials are required for trade history');
        expect(mockApiClient.get).not.toHaveBeenCalled();
      });
    });

    describe('getOrderHistory', () => {
      it('should get order history for symbol', async () => {
        const mockResponse = {
          success: true,
          data: [
            { orderId: '123', symbol: 'BTCUSDT', status: 'FILLED' },
            { orderId: '124', symbol: 'BTCUSDT', status: 'CANCELED' },
          ],
        };

        mockApiClient.get = vi.fn().mockResolvedValue(mockResponse);

        const result = await tradingService.getOrderHistory('BTCUSDT', 200);

        expect(mockApiClient.get).toHaveBeenCalledWith('/api/v3/allOrders', {
          symbol: 'BTCUSDT',
          limit: 200,
        });
        expect(result).toEqual(mockResponse);
      });

      it('should use default limit of 500', async () => {
        const mockResponse = { success: true, data: [] };
        mockApiClient.get = vi.fn().mockResolvedValue(mockResponse);

        await tradingService.getOrderHistory('ETHUSDT');

        expect(mockApiClient.get).toHaveBeenCalledWith('/api/v3/allOrders', {
          symbol: 'ETHUSDT',
          limit: 500,
        });
      });

      it('should require credentials for order history', async () => {
        mockApiClient.hasCredentials = vi.fn().mockReturnValue(false);

        const result = await tradingService.getOrderHistory('BTCUSDT');

        expect(result.success).toBe(false);
        expect(result.error).toBe('API credentials are required for order history');
        expect(mockApiClient.get).not.toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed API responses gracefully', async () => {
      mockApiClient.get = vi.fn().mockResolvedValue(null);

      const result = await tradingService.getOrderBook('BTCUSDT');

      expect(result).toMatchObject({
        symbol: 'BTCUSDT',
        bids: [],
        asks: [],
        timestamp: expect.any(Number),
      });
    });

    it('should handle string numeric values in order parameters', async () => {
      const stringParams: OrderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: '1.5',
        price: '50000.00',
      };

      const mockResponse = {
        success: true,
        data: { orderId: '123' },
        timestamp: new Date().toISOString(),
      };

      mockApiClient.post = vi.fn().mockResolvedValue(mockResponse);

      const result = await tradingService.placeOrder(stringParams);

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/v3/order', expect.objectContaining({
        quantity: '1.5',
        price: '50000.00',
      }));
      expect(result.success).toBe(true);
    });

    it('should handle empty order book response gracefully', async () => {
      const emptyResponse = {
        success: true,
        data: {
          bids: undefined,
          asks: null,
        },
        timestamp: new Date().toISOString(),
      };

      mockApiClient.get = vi.fn().mockResolvedValue(emptyResponse);

      const result = await tradingService.getOrderBook('BTCUSDT');

      expect(result.bids).toEqual([]);
      expect(result.asks).toEqual([]);
    });

    it('should handle different error response formats', async () => {
      // Error as string
      mockApiClient.post = vi.fn().mockRejectedValue('Network failure');

      const result = await tradingService.placeOrder({
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to place order: Network failure');
    });

    it('should calculate response time correctly during credential testing', async () => {
      vi.useFakeTimers();
      
      // Mock delayed responses
      vi.spyOn(tradingService, 'ping').mockImplementation(async () => {
        vi.advanceTimersByTime(100);
        return { success: true, data: {} };
      });
      
      vi.spyOn(tradingService, 'getAccountInfo').mockImplementation(async () => {
        vi.advanceTimersByTime(50);
        return { success: true, data: { accountType: 'SPOT' }, timestamp: new Date().toISOString() };
      });

      const resultPromise = tradingService.testCredentials();
      vi.advanceTimersByTime(200);
      const result = await resultPromise;

      expect(result.responseTime).toBeGreaterThan(0);
      
      vi.useRealTimers();
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle multiple concurrent order operations', async () => {
      const orderParams: OrderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 1,
      };

      const mockResponse = {
        success: true,
        data: { orderId: '123' },
        timestamp: new Date().toISOString(),
      };

      mockApiClient.post = vi.fn().mockResolvedValue(mockResponse);

      const promises = Array.from({ length: 10 }, (_, i) =>
        tradingService.placeOrder({ ...orderParams, quantity: i + 1 })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      expect(mockApiClient.post).toHaveBeenCalledTimes(10);
    });

    it('should efficiently handle multiple market data requests', async () => {
      const mockResponse = { success: true, data: { symbol: 'BTCUSDT' } };
      mockApiClient.get = vi.fn().mockResolvedValue(mockResponse);

      const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT'];
      const promises = symbols.map(symbol => tradingService.get24hrTicker(symbol));

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(5);
      expect(duration).toBeLessThan(100); // Should complete quickly with mocked responses
      expect(mockApiClient.get).toHaveBeenCalledTimes(5);
    });
  });
});