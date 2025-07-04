/**
 * Unit tests for MEXC Trading API Client
 * Tests order placement, order management, validation, and trading utilities
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MexcTradingApiClient } from '../../../../src/services/api/mexc-trading-api';
import type {
  UnifiedMexcConfig,
  OrderParameters,
  OrderResult,
  UnifiedMexcResponse,
} from '../../../../src/services/api/mexc-client-types';

// Mock the parent class
vi.mock('../../../../src/services/api/mexc-account-api', () => ({
  MexcAccountApiClient: class MockMexcAccountApiClient {
    config: any;
    
    constructor(config: any = {}) {
      this.config = {
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
        baseUrl: 'https://api.mexc.com',
        timeout: 5000,
        maxRetries: 3,
        retryDelay: 1000,
        rateLimitDelay: 100,
        enableCaching: true,
        cacheTTL: 60000,
        ...config,
      };
    }
    
    makeRequest = vi.fn();
    getExchangeInfo = vi.fn();
    get24hrTicker = vi.fn();
    hasSufficientBalance = vi.fn();
  },
}));

describe('MexcTradingApiClient', () => {
  let tradingClient: MexcTradingApiClient;
  let mockConsole: any;
  let mockConfig: Required<UnifiedMexcConfig>;

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

    // Create test configuration
    mockConfig = {
      apiKey: 'test-api-key',
      secretKey: 'test-secret-key',
      baseUrl: 'https://api.mexc.com',
      timeout: 5000,
      maxRetries: 3,
      retryDelay: 1000,
      rateLimitDelay: 100,
      enableCaching: true,
      cacheTTL: 60000,
      passphrase: '',
      enableCircuitBreaker: true,
      enableRateLimiter: true,
      maxFailures: 5,
      resetTimeout: 60000,
      enablePaperTrading: false,
      circuitBreakerThreshold: 5,
      circuitBreakerResetTime: 30000,
      enableMetrics: true,
      apiResponseTTL: 1500,
      enableTestMode: false,
    };

    tradingClient = new MexcTradingApiClient(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create trading client with configuration', () => {
      expect(tradingClient).toBeDefined();
      expect(tradingClient).toBeInstanceOf(MexcTradingApiClient);
    });

    it('should create client with default configuration', () => {
      const client = new MexcTradingApiClient();
      expect(client).toBeDefined();
    });

    it('should inherit from MexcAccountApiClient', () => {
      expect(tradingClient.config).toBeDefined();
      expect(tradingClient.config.apiKey).toBe('test-api-key');
    });
  });

  describe('Order Placement', () => {
    describe('placeOrder', () => {
      const validOrderParams: OrderParameters = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: '0.001',
        price: '50000',
        timeInForce: 'GTC',
      };

      it('should place order successfully', async () => {
        const mockApiResponse = {
          success: true,
          data: {
            orderId: 12345,
            symbol: 'BTCUSDT',
            side: 'BUY',
            origQty: '0.001',
            price: '50000',
            status: 'NEW',
          },
          timestamp: new Date().toISOString(),
          requestId: 'req-123',
        };

        tradingClient.makeRequest = vi.fn().mockResolvedValue(mockApiResponse);

        const result = await tradingClient.placeOrder(validOrderParams);

        expect(result.success).toBe(true);
        expect(result.data.success).toBe(true);
        expect(result.data.orderId).toBe('12345');
        expect(result.data.symbol).toBe('BTCUSDT');
        expect(result.data.side).toBe('BUY');
        expect(result.data.quantity).toBe('0.001');
        expect(result.data.price).toBe('50000');
        expect(result.data.status).toBe('NEW');

        expect(tradingClient.makeRequest).toHaveBeenCalledWith(
          '/api/v3/order',
          expect.objectContaining({
            symbol: 'BTCUSDT',
            side: 'BUY',
            type: 'LIMIT',
            quantity: '0.001',
            price: '50000',
            timeInForce: 'GTC',
          }),
          true,
          true
        );

        expect(mockConsole.info).toHaveBeenCalledWith(
          '[MexcTradingApi] Placing BUY order: BTCUSDT, quantity: 0.001'
        );
        expect(mockConsole.info).toHaveBeenCalledWith(
          '[MexcTradingApi] Order placed successfully:',
          expect.any(Object)
        );
      });

      it('should handle order with quote order quantity', async () => {
        const orderParamsWithQuote: OrderParameters = {
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'MARKET',
          quantity: '0.001',
          quoteOrderQty: '50',
        };

        const mockApiResponse = {
          success: true,
          data: {
            orderId: 12346,
            symbol: 'BTCUSDT',
            side: 'BUY',
            executedQty: '0.001',
            status: 'FILLED',
          },
          timestamp: new Date().toISOString(),
        };

        tradingClient.makeRequest = vi.fn().mockResolvedValue(mockApiResponse);

        const result = await tradingClient.placeOrder(orderParamsWithQuote);

        expect(result.success).toBe(true);
        expect(tradingClient.makeRequest).toHaveBeenCalledWith(
          '/api/v3/order',
          expect.objectContaining({
            quoteOrderQty: '50',
          }),
          true,
          true
        );
      });

      it('should fail when credentials are not configured', async () => {
        const clientWithoutCreds = new MexcTradingApiClient({
          apiKey: '',
          secretKey: '',
        });

        const result = await clientWithoutCreds.placeOrder(validOrderParams);

        expect(result.success).toBe(false);
        expect(result.error).toBe('MEXC API credentials not configured for trading');
        expect(result.data.success).toBe(false);
        expect(result.data.error).toBe('MEXC API credentials not configured for trading');
      });

      it('should fail when order validation fails', async () => {
        const invalidOrderParams: OrderParameters = {
          symbol: '',
          side: 'INVALID' as any,
          type: 'LIMIT',
          quantity: '0',
          price: '0',
        };

        const result = await tradingClient.placeOrder(invalidOrderParams);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Order validation failed');
        expect(result.data.success).toBe(false);
      });

      it('should handle API request failure', async () => {
        const mockApiResponse = {
          success: false,
          error: 'Insufficient balance',
          timestamp: new Date().toISOString(),
        };

        tradingClient.makeRequest = vi.fn().mockResolvedValue(mockApiResponse);

        const result = await tradingClient.placeOrder(validOrderParams);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Insufficient balance');
        expect(result.data.success).toBe(false);
        expect(result.data.error).toBe('Insufficient balance');
      });

      it('should handle network errors', async () => {
        tradingClient.makeRequest = vi.fn().mockRejectedValue(
          new Error('Network error')
        );

        const result = await tradingClient.placeOrder(validOrderParams);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Network error');
        expect(result.data.success).toBe(false);
        expect(result.data.error).toBe('Network error');
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[MexcTradingApi] Order placement failed:',
          expect.any(Error)
        );
      });

      it('should handle non-Error exceptions', async () => {
        tradingClient.makeRequest = vi.fn().mockRejectedValue('String error');

        const result = await tradingClient.placeOrder(validOrderParams);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Unknown trading error');
      });
    });

    describe('placeTestOrder', () => {
      const validOrderParams: OrderParameters = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: '0.001',
        price: '50000',
      };

      it('should place test order successfully', async () => {
        const mockApiResponse = {
          success: true,
          data: {},
          timestamp: new Date().toISOString(),
          requestId: 'req-test-123',
        };

        tradingClient.makeRequest = vi.fn().mockResolvedValue(mockApiResponse);

        const result = await tradingClient.placeTestOrder(validOrderParams);

        expect(result.success).toBe(true);
        expect(result.data.success).toBe(true);
        expect(result.data.orderId).toMatch(/^test_\d+$/);
        expect(result.data.symbol).toBe('BTCUSDT');
        expect(result.data.side).toBe('BUY');
        expect(result.data.quantity).toBe('0.001');
        expect(result.data.price).toBe('50000');
        expect(result.data.status).toBe('TEST_FILLED');

        expect(tradingClient.makeRequest).toHaveBeenCalledWith(
          '/api/v3/order/test',
          expect.objectContaining({
            symbol: 'BTCUSDT',
            side: 'BUY',
            type: 'LIMIT',
            quantity: '0.001',
            price: '50000',
          }),
          true,
          true
        );

        expect(mockConsole.info).toHaveBeenCalledWith(
          '[MexcTradingApi] Placing TEST BUY order: BTCUSDT, quantity: 0.001'
        );
        expect(mockConsole.info).toHaveBeenCalledWith(
          '[MexcTradingApi] Test order successful'
        );
      });

      it('should fail when credentials are not configured', async () => {
        const clientWithoutCreds = new MexcTradingApiClient({
          apiKey: '',
          secretKey: '',
        });

        const result = await clientWithoutCreds.placeTestOrder(validOrderParams);

        expect(result.success).toBe(false);
        expect(result.error).toBe('MEXC API credentials not configured for test trading');
        expect(result.data.error).toBe('MEXC API credentials not configured for test trading');
      });

      it('should fail when test order validation fails', async () => {
        const invalidOrderParams: OrderParameters = {
          symbol: '',
          side: 'BUY',
          type: 'LIMIT',
          quantity: '0',
          price: '',
        };

        const result = await tradingClient.placeTestOrder(invalidOrderParams);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Test order validation failed');
      });

      it('should handle test API request failure', async () => {
        const mockApiResponse = {
          success: false,
          error: 'Test order validation failed',
          timestamp: new Date().toISOString(),
        };

        tradingClient.makeRequest = vi.fn().mockResolvedValue(mockApiResponse);

        const result = await tradingClient.placeTestOrder(validOrderParams);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Test order validation failed');
        expect(result.data.error).toBe('Test order validation failed');
      });

      it('should handle test order network errors', async () => {
        tradingClient.makeRequest = vi.fn().mockRejectedValue(
          new Error('Test network error')
        );

        const result = await tradingClient.placeTestOrder(validOrderParams);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Test network error');
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[MexcTradingApi] Test order failed:',
          expect.any(Error)
        );
      });
    });
  });

  describe('Order Query Methods', () => {
    describe('getOpenOrders', () => {
      it('should get open orders for all symbols', async () => {
        const mockApiResponse = {
          success: true,
          data: [
            {
              orderId: 12345,
              symbol: 'BTCUSDT',
              side: 'BUY',
              origQty: '0.001',
              price: '50000',
              status: 'NEW',
            },
            {
              orderId: 12346,
              symbol: 'ETHUSDT',
              side: 'SELL',
              origQty: '0.1',
              price: '3000',
              status: 'PARTIALLY_FILLED',
            },
          ],
          timestamp: new Date().toISOString(),
          requestId: 'req-open-123',
        };

        tradingClient.makeRequest = vi.fn().mockResolvedValue(mockApiResponse);

        const result = await tradingClient.getOpenOrders();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
        expect(result.data[0].orderId).toBe(12345);
        expect(result.data[1].symbol).toBe('ETHUSDT');

        expect(tradingClient.makeRequest).toHaveBeenCalledWith(
          '/api/v3/openOrders',
          {},
          true,
          true
        );
      });

      it('should get open orders for specific symbol', async () => {
        const mockApiResponse = {
          success: true,
          data: [
            {
              orderId: 12345,
              symbol: 'BTCUSDT',
              side: 'BUY',
              origQty: '0.001',
              price: '50000',
              status: 'NEW',
            },
          ],
          timestamp: new Date().toISOString(),
        };

        tradingClient.makeRequest = vi.fn().mockResolvedValue(mockApiResponse);

        const result = await tradingClient.getOpenOrders('BTCUSDT');

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data[0].symbol).toBe('BTCUSDT');

        expect(tradingClient.makeRequest).toHaveBeenCalledWith(
          '/api/v3/openOrders',
          { symbol: 'BTCUSDT' },
          true,
          true
        );
      });

      it('should fail when credentials are not configured', async () => {
        const clientWithoutCreds = new MexcTradingApiClient({
          apiKey: '',
          secretKey: '',
        });

        const result = await clientWithoutCreds.getOpenOrders();

        expect(result.success).toBe(false);
        expect(result.data).toEqual([]);
        expect(result.error).toBe('MEXC API credentials not configured');
      });

      it('should handle API request failure', async () => {
        const mockApiResponse = {
          success: false,
          error: 'Rate limit exceeded',
          timestamp: new Date().toISOString(),
        };

        tradingClient.makeRequest = vi.fn().mockResolvedValue(mockApiResponse);

        const result = await tradingClient.getOpenOrders();

        expect(result.success).toBe(false);
        expect(result.data).toEqual([]);
        expect(result.error).toBe('Rate limit exceeded');
      });

      it('should handle network errors', async () => {
        tradingClient.makeRequest = vi.fn().mockRejectedValue(
          new Error('Connection timeout')
        );

        const result = await tradingClient.getOpenOrders();

        expect(result.success).toBe(false);
        expect(result.data).toEqual([]);
        expect(result.error).toBe('Connection timeout');
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[MexcTradingApi] Failed to get open orders:',
          expect.any(Error)
        );
      });
    });

    describe('getOrderHistory', () => {
      it('should get order history with default limit', async () => {
        const mockApiResponse = {
          success: true,
          data: [
            {
              orderId: 12345,
              symbol: 'BTCUSDT',
              side: 'BUY',
              origQty: '0.001',
              price: '50000',
              status: 'FILLED',
            },
          ],
          timestamp: new Date().toISOString(),
          requestId: 'req-history-123',
        };

        tradingClient.makeRequest = vi.fn().mockResolvedValue(mockApiResponse);

        const result = await tradingClient.getOrderHistory('BTCUSDT');

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data[0].symbol).toBe('BTCUSDT');

        expect(tradingClient.makeRequest).toHaveBeenCalledWith(
          '/api/v3/allOrders',
          { symbol: 'BTCUSDT', limit: 50 },
          true,
          true
        );
      });

      it('should get order history with custom limit', async () => {
        const mockApiResponse = {
          success: true,
          data: [],
          timestamp: new Date().toISOString(),
        };

        tradingClient.makeRequest = vi.fn().mockResolvedValue(mockApiResponse);

        const result = await tradingClient.getOrderHistory('BTCUSDT', 100);

        expect(tradingClient.makeRequest).toHaveBeenCalledWith(
          '/api/v3/allOrders',
          { symbol: 'BTCUSDT', limit: 100 },
          true,
          true
        );
      });

      it('should enforce maximum limit of 1000', async () => {
        const mockApiResponse = {
          success: true,
          data: [],
          timestamp: new Date().toISOString(),
        };

        tradingClient.makeRequest = vi.fn().mockResolvedValue(mockApiResponse);

        const result = await tradingClient.getOrderHistory('BTCUSDT', 2000);

        expect(tradingClient.makeRequest).toHaveBeenCalledWith(
          '/api/v3/allOrders',
          { symbol: 'BTCUSDT', limit: 1000 },
          true,
          true
        );
      });

      it('should fail when credentials are not configured', async () => {
        const clientWithoutCreds = new MexcTradingApiClient({
          apiKey: '',
          secretKey: '',
        });

        const result = await clientWithoutCreds.getOrderHistory('BTCUSDT');

        expect(result.success).toBe(false);
        expect(result.data).toEqual([]);
        expect(result.error).toBe('MEXC API credentials not configured');
      });

      it('should handle network errors', async () => {
        tradingClient.makeRequest = vi.fn().mockRejectedValue(
          new Error('Database error')
        );

        const result = await tradingClient.getOrderHistory('BTCUSDT');

        expect(result.success).toBe(false);
        expect(result.data).toEqual([]);
        expect(result.error).toBe('Database error');
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[MexcTradingApi] Failed to get order history:',
          expect.any(Error)
        );
      });
    });

    describe('cancelOrder', () => {
      it('should cancel order successfully', async () => {
        const mockApiResponse = {
          success: true,
          data: {
            orderId: 12345,
            symbol: 'BTCUSDT',
            status: 'CANCELED',
          },
          timestamp: new Date().toISOString(),
          requestId: 'req-cancel-123',
        };

        tradingClient.makeRequest = vi.fn().mockResolvedValue(mockApiResponse);

        const result = await tradingClient.cancelOrder('BTCUSDT', '12345');

        expect(result.success).toBe(true);
        expect(result.data.orderId).toBe(12345);
        expect(result.data.status).toBe('CANCELED');

        expect(tradingClient.makeRequest).toHaveBeenCalledWith(
          '/api/v3/order',
          { symbol: 'BTCUSDT', orderId: '12345' },
          true,
          true
        );
      });

      it('should fail when credentials are not configured', async () => {
        const clientWithoutCreds = new MexcTradingApiClient({
          apiKey: '',
          secretKey: '',
        });

        const result = await clientWithoutCreds.cancelOrder('BTCUSDT', '12345');

        expect(result.success).toBe(false);
        expect(result.data).toBeNull();
        expect(result.error).toBe('MEXC API credentials not configured');
      });

      it('should handle API request failure', async () => {
        const mockApiResponse = {
          success: false,
          error: 'Order not found',
          timestamp: new Date().toISOString(),
        };

        tradingClient.makeRequest = vi.fn().mockResolvedValue(mockApiResponse);

        const result = await tradingClient.cancelOrder('BTCUSDT', '12345');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Order not found');
      });

      it('should handle network errors', async () => {
        tradingClient.makeRequest = vi.fn().mockRejectedValue(
          new Error('Server error')
        );

        const result = await tradingClient.cancelOrder('BTCUSDT', '12345');

        expect(result.success).toBe(false);
        expect(result.data).toBeNull();
        expect(result.error).toBe('Server error');
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[MexcTradingApi] Failed to cancel order:',
          expect.any(Error)
        );
      });
    });
  });

  describe('Order Validation', () => {
    describe('validateOrderParameters', () => {
      it('should validate correct order parameters', () => {
        const validParams: OrderParameters = {
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'LIMIT',
          quantity: '0.001',
          price: '50000',
          timeInForce: 'GTC',
        };

        const result = tradingClient.validateOrderParameters(validParams);

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should validate market order without price', () => {
        const marketOrderParams: OrderParameters = {
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'MARKET',
          quantity: '0.001',
        };

        const result = tradingClient.validateOrderParameters(marketOrderParams);

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should detect missing required fields', () => {
        const incompleteParams: OrderParameters = {
          symbol: '',
          side: '',
          type: '',
          quantity: '',
        };

        const result = tradingClient.validateOrderParameters(incompleteParams);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Symbol is required');
        expect(result.errors).toContain('Side (BUY/SELL) is required');
        expect(result.errors).toContain('Order type is required');
        expect(result.errors).toContain('Valid quantity is required');
      });

      it('should require price for LIMIT orders', () => {
        const limitOrderWithoutPrice: OrderParameters = {
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'LIMIT',
          quantity: '0.001',
          price: '',
        };

        const result = tradingClient.validateOrderParameters(limitOrderWithoutPrice);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Price is required for LIMIT orders');
      });

      it('should validate side values', () => {
        const invalidSideParams: OrderParameters = {
          symbol: 'BTCUSDT',
          side: 'INVALID' as any,
          type: 'LIMIT',
          quantity: '0.001',
          price: '50000',
        };

        const result = tradingClient.validateOrderParameters(invalidSideParams);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Side must be BUY or SELL');
      });

      it('should validate order type values', () => {
        const invalidTypeParams: OrderParameters = {
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'INVALID' as any,
          quantity: '0.001',
          price: '50000',
        };

        const result = tradingClient.validateOrderParameters(invalidTypeParams);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Order type must be LIMIT or MARKET');
      });

      it('should validate time in force values', () => {
        const invalidTifParams: OrderParameters = {
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'LIMIT',
          quantity: '0.001',
          price: '50000',
          timeInForce: 'INVALID' as any,
        };

        const result = tradingClient.validateOrderParameters(invalidTifParams);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Time in force must be GTC, IOC, or FOK');
      });

      it('should validate quantity as positive number', () => {
        const zeroQuantityParams: OrderParameters = {
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'LIMIT',
          quantity: '0',
          price: '50000',
        };

        const negativeQuantityParams: OrderParameters = {
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'LIMIT',
          quantity: '-0.001',
          price: '50000',
        };

        const zeroResult = tradingClient.validateOrderParameters(zeroQuantityParams);
        const negativeResult = tradingClient.validateOrderParameters(negativeQuantityParams);

        expect(zeroResult.valid).toBe(false);
        expect(zeroResult.errors).toContain('Valid quantity is required');
        expect(negativeResult.valid).toBe(false);
        expect(negativeResult.errors).toContain('Valid quantity is required');
      });

      it('should validate price as positive number for LIMIT orders', () => {
        const zeroPriceParams: OrderParameters = {
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'LIMIT',
          quantity: '0.001',
          price: '0',
        };

        const negativePriceParams: OrderParameters = {
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'LIMIT',
          quantity: '0.001',
          price: '-50000',
        };

        const zeroResult = tradingClient.validateOrderParameters(zeroPriceParams);
        const negativeResult = tradingClient.validateOrderParameters(negativePriceParams);

        expect(zeroResult.valid).toBe(false);
        expect(zeroResult.errors).toContain('Price is required for LIMIT orders');
        expect(negativeResult.valid).toBe(false);
        expect(negativeResult.errors).toContain('Price is required for LIMIT orders');
      });
    });
  });

  describe('Trading Utilities', () => {
    describe('getMinOrderSize', () => {
      it('should get minimum order size from exchange info', async () => {
        const mockExchangeInfo = {
          success: true,
          data: [
            {
              symbol: 'BTCUSDT',
              baseAsset: 'BTC',
              quoteAsset: 'USDT',
              filters: [],
            },
          ],
        };

        tradingClient.getExchangeInfo = vi.fn().mockResolvedValue(mockExchangeInfo);

        const result = await tradingClient.getMinOrderSize('BTCUSDT');

        expect(result).toBe(0.001);
        expect(tradingClient.getExchangeInfo).toHaveBeenCalled();
      });

      it('should return null when exchange info request fails', async () => {
        tradingClient.getExchangeInfo = vi.fn().mockResolvedValue({
          success: false,
          error: 'API error',
        });

        const result = await tradingClient.getMinOrderSize('BTCUSDT');

        expect(result).toBeNull();
      });

      it('should return null when symbol not found', async () => {
        const mockExchangeInfo = {
          success: true,
          data: [
            {
              symbol: 'ETHUSDT',
              baseAsset: 'ETH',
              quoteAsset: 'USDT',
            },
          ],
        };

        tradingClient.getExchangeInfo = vi.fn().mockResolvedValue(mockExchangeInfo);

        const result = await tradingClient.getMinOrderSize('BTCUSDT');

        expect(result).toBeNull();
      });

      it('should handle errors gracefully', async () => {
        tradingClient.getExchangeInfo = vi.fn().mockRejectedValue(
          new Error('Network error')
        );

        const result = await tradingClient.getMinOrderSize('BTCUSDT');

        expect(result).toBeNull();
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[MexcTradingApi] Failed to get min order size:',
          expect.any(Error)
        );
      });
    });

    describe('calculateOrderValue', () => {
      it('should calculate order value correctly', () => {
        const result = tradingClient.calculateOrderValue('0.001', '50000');
        expect(result).toBe(50);
      });

      it('should handle decimal calculations', () => {
        const result = tradingClient.calculateOrderValue('1.5', '100.25');
        expect(result).toBe(150.375);
      });

      it('should handle invalid input gracefully', () => {
        const result1 = tradingClient.calculateOrderValue('invalid', '50000');
        const result2 = tradingClient.calculateOrderValue('0.001', 'invalid');

        expect(result1).toBe(0);
        expect(result2).toBe(0);
        expect(mockConsole.error).toHaveBeenCalledTimes(2);
      });
    });

    describe('canAffordOrder', () => {
      it('should check buy order affordability', async () => {
        const buyOrderParams: OrderParameters = {
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'LIMIT',
          quantity: '0.001',
          price: '50000',
        };

        tradingClient.hasSufficientBalance = vi.fn().mockResolvedValue(true);

        const result = await tradingClient.canAffordOrder(buyOrderParams);

        expect(result).toBe(true);
        expect(tradingClient.hasSufficientBalance).toHaveBeenCalledWith('USDT', 50);
      });

      it('should check sell order affordability', async () => {
        const sellOrderParams: OrderParameters = {
          symbol: 'BTCUSDT',
          side: 'SELL',
          type: 'LIMIT',
          quantity: '0.001',
          price: '50000',
        };

        tradingClient.hasSufficientBalance = vi.fn().mockResolvedValue(true);

        const result = await tradingClient.canAffordOrder(sellOrderParams);

        expect(result).toBe(true);
        expect(tradingClient.hasSufficientBalance).toHaveBeenCalledWith('BTC', 0.001);
      });

      it('should check market buy order with quote quantity', async () => {
        const marketBuyParams: OrderParameters = {
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'MARKET',
          quantity: '0.001',
          quoteOrderQty: '100',
        };

        tradingClient.hasSufficientBalance = vi.fn().mockResolvedValue(true);

        const result = await tradingClient.canAffordOrder(marketBuyParams);

        expect(result).toBe(true);
        expect(tradingClient.hasSufficientBalance).toHaveBeenCalledWith('USDT', 100);
      });

      it('should handle insufficient balance', async () => {
        const buyOrderParams: OrderParameters = {
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'LIMIT',
          quantity: '0.001',
          price: '50000',
        };

        tradingClient.hasSufficientBalance = vi.fn().mockResolvedValue(false);

        const result = await tradingClient.canAffordOrder(buyOrderParams);

        expect(result).toBe(false);
      });

      it('should handle errors gracefully', async () => {
        const buyOrderParams: OrderParameters = {
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'LIMIT',
          quantity: '0.001',
          price: '50000',
        };

        tradingClient.hasSufficientBalance = vi.fn().mockRejectedValue(
          new Error('Balance check failed')
        );

        const result = await tradingClient.canAffordOrder(buyOrderParams);

        expect(result).toBe(false);
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[MexcTradingApi] Failed to check order affordability:',
          expect.any(Error)
        );
      });
    });

    describe('getRecommendedOrderType', () => {
      it('should recommend MARKET for stable, high volume symbols', async () => {
        const mockTicker = {
          success: true,
          data: [
            {
              symbol: 'BTCUSDT',
              priceChangePercent: '1.5',
              volume: '2000000',
            },
          ],
        };

        tradingClient.get24hrTicker = vi.fn().mockResolvedValue(mockTicker);

        const result = await tradingClient.getRecommendedOrderType('BTCUSDT');

        expect(result).toBe('MARKET');
        expect(tradingClient.get24hrTicker).toHaveBeenCalledWith('BTCUSDT');
      });

      it('should recommend LIMIT for volatile symbols', async () => {
        const mockTicker = {
          success: true,
          data: [
            {
              symbol: 'ALTCOIN',
              priceChangePercent: '15.5',
              volume: '2000000',
            },
          ],
        };

        tradingClient.get24hrTicker = vi.fn().mockResolvedValue(mockTicker);

        const result = await tradingClient.getRecommendedOrderType('ALTCOIN');

        expect(result).toBe('LIMIT');
      });

      it('should recommend LIMIT for low volume symbols', async () => {
        const mockTicker = {
          success: true,
          data: [
            {
              symbol: 'LOWVOL',
              priceChangePercent: '1.0',
              volume: '100000',
            },
          ],
        };

        tradingClient.get24hrTicker = vi.fn().mockResolvedValue(mockTicker);

        const result = await tradingClient.getRecommendedOrderType('LOWVOL');

        expect(result).toBe('LIMIT');
      });

      it('should default to LIMIT when ticker request fails', async () => {
        tradingClient.get24hrTicker = vi.fn().mockResolvedValue({
          success: false,
          error: 'API error',
        });

        const result = await tradingClient.getRecommendedOrderType('BTCUSDT');

        expect(result).toBe('LIMIT');
      });

      it('should default to LIMIT when no ticker data', async () => {
        tradingClient.get24hrTicker = vi.fn().mockResolvedValue({
          success: true,
          data: [],
        });

        const result = await tradingClient.getRecommendedOrderType('BTCUSDT');

        expect(result).toBe('LIMIT');
      });

      it('should handle errors gracefully', async () => {
        tradingClient.get24hrTicker = vi.fn().mockRejectedValue(
          new Error('Network error')
        );

        const result = await tradingClient.getRecommendedOrderType('BTCUSDT');

        expect(result).toBe('LIMIT');
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[MexcTradingApi] Failed to get recommended order type:',
          expect.any(Error)
        );
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing makeRequest method gracefully', async () => {
      // Remove makeRequest method to test error handling
      delete (tradingClient as any).makeRequest;

      const orderParams: OrderParameters = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: '0.001',
        price: '50000',
      };

      const result = await tradingClient.placeOrder(orderParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown trading error');
    });

    it('should handle partial API response data', async () => {
      const orderParams: OrderParameters = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: '0.001',
        price: '50000',
      };

      // Mock API response with minimal data
      const mockApiResponse = {
        success: true,
        data: {
          orderId: 12345,
          // Missing other fields like symbol, side, etc.
        },
        timestamp: new Date().toISOString(),
      };

      tradingClient.makeRequest = vi.fn().mockResolvedValue(mockApiResponse);

      const result = await tradingClient.placeOrder(orderParams);

      expect(result.success).toBe(true);
      expect(result.data.orderId).toBe('12345');
      expect(result.data.symbol).toBe('BTCUSDT'); // Fallback to params
      expect(result.data.side).toBe('BUY'); // Fallback to params
    });

    it('should handle floating point precision in calculations', () => {
      const result = tradingClient.calculateOrderValue('0.1', '0.2');
      expect(result).toBeCloseTo(0.02, 10);
    });

    it('should handle empty or null string inputs in validation', () => {
      const emptyParams: OrderParameters = {
        symbol: null as any,
        side: undefined as any,
        type: '',
        quantity: null as any,
        price: undefined as any,
      };

      const result = tradingClient.validateOrderParameters(emptyParams);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});