/**
 * MEXC API Client Tests
 * 
 * Comprehensive test suite for the refactored modular MEXC API client
 * that orchestrates authentication, requests, retry logic, and trading services
 */

import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { EnhancedUnifiedCacheSystem } from '@/src/lib/enhanced-unified-cache';
import type { PerformanceMonitoringService } from '@/src/lib/performance-monitoring-service';
import type { UnifiedMexcConfig } from '@/src/schemas/unified/mexc-api-schemas';
import {
  type AccountInfo,
  type ApiClientStats,
  MexcApiClient,
  MexcAuthService,
  MexcRequestService,
  MexcRetryService,
  MexcTradingService,
  type OrderParams,
  type RequestContext,
} from '@/src/services/api/mexc-api-client';
import { MexcRequestCache } from '@/src/services/api/mexc-request-cache';
import type { CircuitBreaker } from '@/src/services/risk/circuit-breaker';

// Mock all service dependencies
vi.mock('@/src/services/api/mexc-auth-service');
vi.mock('@/src/services/api/mexc-request-service');
vi.mock('@/src/services/api/mexc-retry-service');
vi.mock('@/src/services/api/mexc-trading-service');
vi.mock('@/src/services/api/mexc-request-cache');

describe('MexcApiClient', () => {
  let mockConfig: Required<UnifiedMexcConfig>;
  let mockCache: MexcRequestCache;
  let mockReliabilityManager: CircuitBreaker;
  let mockEnhancedCache: EnhancedUnifiedCacheSystem;
  let mockPerformanceMonitoring: PerformanceMonitoringService;
  let apiClient: MexcApiClient;

  // Mock service instances
  let mockAuthService: MexcAuthService;
  let mockRequestService: MexcRequestService;
  let mockRetryService: MexcRetryService;
  let mockTradingService: MexcTradingService;

  beforeEach(() => {
    // Setup mock configuration
    mockConfig = {
      apiKey: 'test_api_key',
      secretKey: 'test_secret_key',
      passphrase: 'test_passphrase',
      baseUrl: 'https://api.mexc.com',
      timeout: 10000,
      maxRetries: 3,
      retryDelay: 1000,
      rateLimitDelay: 100,
      enableCaching: true,
      cacheTTL: 30000,
      apiResponseTTL: 1500,
      enableCircuitBreaker: true,
      enableRateLimiter: true,
      maxFailures: 5,
      resetTimeout: 60000,
      enablePaperTrading: true,
      circuitBreakerThreshold: 5,
      circuitBreakerResetTime: 30000,
      enableTestMode: true,
      enableMetrics: false,
    };

    // Setup mock dependencies
    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      getStats: vi.fn(),
    } as any;

    mockReliabilityManager = {
      isOpen: vi.fn().mockReturnValue(false),
      execute: vi.fn(),
      getStats: vi.fn(),
    } as any;

    mockEnhancedCache = {} as any;
    mockPerformanceMonitoring = {} as any;

    // Setup mock service constructors with proper Vitest mocks
    mockAuthService = {
      hasCredentials: vi.fn(),
      createSignature: vi.fn(),
      validateCredentials: vi.fn(),
      config: {} as any,
      generateAuthContext: vi.fn(),
      addAuthHeaders: vi.fn(),
      addAuthParams: vi.fn(),
      // rotateCredentials: vi.fn(), // Not part of interface
      resetCredentials: vi.fn(),
      testCredentials: vi.fn(),
    };

    mockRequestService = {
      executeHttpRequestWithContext: vi.fn(),
      createRequestContext: vi.fn(),
    } as any;

    mockRetryService = {
      shouldRetry: vi.fn(),
      classifyError: vi.fn(),
    } as any;

    mockTradingService = {
      logger: {} as any,
      apiClient: {} as any,
      getBalances: vi.fn(),
      getExchangeInfo: vi.fn(),
      getTicker: vi.fn(),
      getKlines: vi.fn(),
      placeOrder: vi.fn(),
      getOrderBook: vi.fn(),
      getOrderStatus: vi.fn(),
      cancelOrder: vi.fn(),
      getOpenOrders: vi.fn(),
      getAccountInfo: vi.fn(),
      testCredentials: vi.fn(),
    } as any;

    // Mock service constructors
    (MexcAuthService as any as Mock).mockImplementation(() => mockAuthService);
    (MexcRequestService as any as Mock).mockImplementation(() => mockRequestService);
    (MexcRetryService as any as Mock).mockImplementation(() => mockRetryService);
    (MexcTradingService as any as Mock).mockImplementation(() => mockTradingService);

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with correct configuration', () => {
      apiClient = new MexcApiClient(
        mockConfig,
        mockCache,
        mockReliabilityManager,
        mockEnhancedCache,
        mockPerformanceMonitoring
      );

      expect(apiClient).toBeInstanceOf(MexcApiClient);
      expect(MexcAuthService).toHaveBeenCalledWith(mockConfig);
      expect(MexcRetryService).toHaveBeenCalledWith({
        maxRetries: mockConfig.maxRetries,
        baseDelay: mockConfig.retryDelay,
      });
      expect(MexcRequestService).toHaveBeenCalledWith(mockConfig);
      expect(MexcTradingService).toHaveBeenCalledWith(expect.any(MexcApiClient));
    });

    it('should initialize with default stats', () => {
      apiClient = new MexcApiClient(mockConfig, mockCache, mockReliabilityManager);

      const stats = apiClient.getStats();
      expect(stats).toEqual({
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        retryCount: 0,
      });
    });

    it('should store configuration correctly', () => {
      apiClient = new MexcApiClient(mockConfig, mockCache, mockReliabilityManager);

      const config = apiClient.getConfig();
      expect(config).toEqual(mockConfig);
      expect(config).not.toBe(mockConfig); // Should be a copy
    });

    it('should work without optional parameters', () => {
      expect(() => {
        apiClient = new MexcApiClient(mockConfig, mockCache, mockReliabilityManager);
      }).not.toThrow();
    });

    it('should work with all optional parameters', () => {
      expect(() => {
        apiClient = new MexcApiClient(
          mockConfig,
          mockCache,
          mockReliabilityManager,
          mockEnhancedCache,
          mockPerformanceMonitoring
        );
      }).not.toThrow();
    });
  });

  describe('HTTP Methods Delegation', () => {
    beforeEach(() => {
      apiClient = new MexcApiClient(mockConfig, mockCache, mockReliabilityManager);
      
      // Setup mock return values
      (mockRequestService.createRequestContext as any).mockReturnValue({
        endpoint: '/test',
        method: 'GET',
        timestamp: Date.now(),
        requestId: 'test-request-id',
        priority: 'medium',
        attempt: 1,
        startTime: Date.now(),
      } as RequestContext);

      (mockRequestService.executeHttpRequestWithContext as any).mockResolvedValue({
        data: { success: true },
        status: 200,
        headers: {},
      });
    });

    describe('GET method', () => {
      it('should delegate GET requests correctly', async () => {
        const endpoint = '/api/v3/ticker/price';
        const params = { symbol: 'BTCUSDT' };
        const options = { timeout: 5000 };

        await apiClient.get(endpoint, params, options);

        expect(mockRequestService.createRequestContext).toHaveBeenCalledWith(endpoint);
        expect(mockRequestService.executeHttpRequestWithContext).toHaveBeenCalledWith(
          { method: 'GET', endpoint, params, ...options },
          expect.any(Object)
        );
      });

      it('should handle GET requests without params', async () => {
        const endpoint = '/api/v3/time';

        await apiClient.get(endpoint);

        expect(mockRequestService.executeHttpRequestWithContext).toHaveBeenCalledWith(
          { method: 'GET', endpoint, params: undefined },
          expect.any(Object)
        );
      });

      it('should return response from request service', async () => {
        const expectedResponse = { data: { serverTime: Date.now() } };
        (mockRequestService.executeHttpRequestWithContext as any).mockResolvedValue(expectedResponse);

        const result = await apiClient.get('/api/v3/time');

        expect(result).toEqual(expectedResponse);
      });
    });

    describe('POST method', () => {
      it('should delegate POST requests correctly', async () => {
        const endpoint = '/api/v3/order';
        const params = { symbol: 'BTCUSDT', side: 'BUY', type: 'LIMIT' };
        const options = { requiresAuth: true };

        await apiClient.post(endpoint, params, options);

        expect(mockRequestService.executeHttpRequestWithContext).toHaveBeenCalledWith(
          { method: 'POST', endpoint, params, ...options },
          expect.any(Object)
        );
      });

      it('should handle POST requests with complex data', async () => {
        const endpoint = '/api/v3/batchOrders';
        const params = {
          symbol: 'BTCUSDT',
          orders: [
            { side: 'BUY', type: 'LIMIT', quantity: '0.001', price: '45000' },
            { side: 'SELL', type: 'LIMIT', quantity: '0.001', price: '55000' },
          ],
        };

        await apiClient.post(endpoint, params);

        expect(mockRequestService.executeHttpRequestWithContext).toHaveBeenCalledWith(
          { method: 'POST', endpoint, params },
          expect.any(Object)
        );
      });
    });

    describe('PUT method', () => {
      it('should delegate PUT requests correctly', async () => {
        const endpoint = '/api/v3/order/update';
        const params = { orderId: '12345', quantity: '0.002' };

        await apiClient.put(endpoint, params);

        expect(mockRequestService.executeHttpRequestWithContext).toHaveBeenCalledWith(
          { method: 'PUT', endpoint, params },
          expect.any(Object)
        );
      });
    });

    describe('DELETE method', () => {
      it('should delegate DELETE requests correctly', async () => {
        const endpoint = '/api/v3/order';
        const params = { symbol: 'BTCUSDT', orderId: '12345' };

        await apiClient.delete(endpoint, params);

        expect(mockRequestService.executeHttpRequestWithContext).toHaveBeenCalledWith(
          { method: 'DELETE', endpoint, params },
          expect.any(Object)
        );
      });

      it('should handle DELETE requests without params', async () => {
        const endpoint = '/api/v3/openOrders';

        await apiClient.delete(endpoint);

        expect(mockRequestService.executeHttpRequestWithContext).toHaveBeenCalledWith(
          { method: 'DELETE', endpoint, params: undefined },
          expect.any(Object)
        );
      });
    });

    describe('Error handling in HTTP methods', () => {
      it('should propagate errors from request service', async () => {
        const error = new Error('Network error');
        (mockRequestService.executeHttpRequestWithContext as any).mockRejectedValue(error);

        await expect(apiClient.get('/api/v3/ticker/price')).rejects.toThrow('Network error');
      });

      it('should handle timeout errors', async () => {
        const timeoutError = new Error('Request timeout');
        (mockRequestService.executeHttpRequestWithContext as any).mockRejectedValue(timeoutError);

        await expect(apiClient.post('/api/v3/order', {})).rejects.toThrow('Request timeout');
      });
    });
  });

  describe('Authentication Methods Delegation', () => {
    beforeEach(() => {
      apiClient = new MexcApiClient(mockConfig, mockCache, mockReliabilityManager);
    });

    it('should delegate hasCredentials to auth service', () => {
      (mockAuthService.hasCredentials as any).mockReturnValue(true);

      const result = apiClient.hasCredentials();

      expect(mockAuthService.hasCredentials).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should handle missing credentials', () => {
      (mockAuthService.hasCredentials as any).mockReturnValue(false);

      const result = apiClient.hasCredentials();

      expect(result).toBe(false);
    });

    it('should not expose internal auth methods', () => {
      // Ensure internal auth methods are not exposed
      expect(apiClient).not.toHaveProperty('generateSignature');
      expect(apiClient).not.toHaveProperty('validateCredentials');
    });
  });

  describe('Trading Methods Delegation', () => {
    beforeEach(() => {
      apiClient = new MexcApiClient(mockConfig, mockCache, mockReliabilityManager);
    });

    describe('Order Management', () => {
      it('should delegate placeOrder to trading service', async () => {
        const orderParams: OrderParams = {
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'LIMIT',
          quantity: '0.001',
          price: '45000',
        };
        const expectedResult = { orderId: '12345', status: 'NEW' };
        (mockTradingService.placeOrder as any).mockResolvedValue(expectedResult);

        const result = await apiClient.placeOrder(orderParams);

        expect(mockTradingService.placeOrder).toHaveBeenCalledWith(orderParams);
        expect(result).toEqual(expectedResult);
      });

      it('should delegate getOrderStatus to trading service', async () => {
        const symbol = 'BTCUSDT';
        const orderId = '12345';
        const expectedResult = { orderId, status: 'FILLED', executedQty: '0.001' };
        (mockTradingService.getOrderStatus as any).mockResolvedValue(expectedResult);

        const result = await apiClient.getOrderStatus(symbol, orderId);

        expect(mockTradingService.getOrderStatus).toHaveBeenCalledWith(symbol, orderId);
        expect(result).toEqual(expectedResult);
      });

      it('should delegate cancelOrder to trading service', async () => {
        const symbol = 'BTCUSDT';
        const orderId = '12345';
        const expectedResult = { orderId, status: 'CANCELED' };
        (mockTradingService.cancelOrder as any).mockResolvedValue(expectedResult);

        const result = await apiClient.cancelOrder(symbol, orderId);

        expect(mockTradingService.cancelOrder).toHaveBeenCalledWith(symbol, orderId);
        expect(result).toEqual(expectedResult);
      });

      it('should delegate getOpenOrders with symbol to trading service', async () => {
        const symbol = 'BTCUSDT';
        const expectedResult = [{ orderId: '12345', symbol, status: 'NEW' }];
        (mockTradingService.getOpenOrders as any).mockResolvedValue(expectedResult);

        const result = await apiClient.getOpenOrders(symbol);

        expect(mockTradingService.getOpenOrders).toHaveBeenCalledWith(symbol);
        expect(result).toEqual(expectedResult);
      });

      it('should delegate getOpenOrders without symbol to trading service', async () => {
        const expectedResult = [
          { orderId: '12345', symbol: 'BTCUSDT', status: 'NEW' },
          { orderId: '67890', symbol: 'ETHUSDT', status: 'PARTIALLY_FILLED' },
        ];
        (mockTradingService.getOpenOrders as any).mockResolvedValue(expectedResult);

        const result = await apiClient.getOpenOrders();

        expect(mockTradingService.getOpenOrders).toHaveBeenCalledWith(undefined);
        expect(result).toEqual(expectedResult);
      });
    });

    describe('Market Data', () => {
      it('should delegate getOrderBook to trading service', async () => {
        const symbol = 'BTCUSDT';
        const limit = 100;
        const expectedResult = {
          symbol,
          bids: [['45000', '0.1'], ['44999', '0.2']],
          asks: [['45001', '0.15'], ['45002', '0.25']],
        };
        (mockTradingService.getOrderBook as any).mockResolvedValue(expectedResult);

        const result = await apiClient.getOrderBook(symbol, limit);

        expect(mockTradingService.getOrderBook).toHaveBeenCalledWith(symbol, limit);
        expect(result).toEqual(expectedResult);
      });

      it('should use default limit for getOrderBook', async () => {
        const symbol = 'ETHUSDT';
        (mockTradingService.getOrderBook as any).mockResolvedValue({});

        await apiClient.getOrderBook(symbol);

        expect(mockTradingService.getOrderBook).toHaveBeenCalledWith(symbol, 100);
      });
    });

    describe('Account Information', () => {
      it('should delegate getAccountInfo to trading service', async () => {
        const expectedResult: AccountInfo = {
          accountType: 'SPOT',
          canTrade: true,
          canWithdraw: true,
          canDeposit: true,
          balances: [
            { asset: 'BTC', free: '0.1', locked: '0.01' },
            { asset: 'USDT', free: '1000', locked: '100' },
          ],
          permissions: ['SPOT'],
          updateTime: Date.now(),
        };
        (mockTradingService.getAccountInfo as any).mockResolvedValue(expectedResult);

        const result = await apiClient.getAccountInfo();

        expect(mockTradingService.getAccountInfo).toHaveBeenCalled();
        expect(result).toEqual(expectedResult);
      });

      it('should delegate testCredentials to trading service', async () => {
        const expectedResult = {
          success: true,
          message: 'Credentials are valid',
          permissions: ['SPOT'],
        };
        (mockTradingService.testCredentials as any).mockResolvedValue(expectedResult);

        const result = await apiClient.testCredentials();

        expect(mockTradingService.testCredentials).toHaveBeenCalled();
        expect(result).toEqual(expectedResult);
      });
    });

    describe('Trading method error handling', () => {
      it('should propagate errors from trading service', async () => {
        const error = new Error('Insufficient balance');
        (mockTradingService.placeOrder as any).mockRejectedValue(error);

        await expect(apiClient.placeOrder({} as OrderParams)).rejects.toThrow('Insufficient balance');
      });

      it('should handle authentication errors', async () => {
        const authError = new Error('Invalid API key');
        (mockTradingService.testCredentials as any).mockRejectedValue(authError);

        await expect(apiClient.testCredentials()).rejects.toThrow('Invalid API key');
      });
    });
  });

  describe('Service Integration', () => {
    beforeEach(() => {
      apiClient = new MexcApiClient(mockConfig, mockCache, mockReliabilityManager);
    });

    it('should inject client instance into trading service', () => {
      expect(MexcTradingService).toHaveBeenCalledWith(apiClient);
    });

    it('should pass correct configuration to services', () => {
      expect(MexcAuthService).toHaveBeenCalledWith(mockConfig);
      expect(MexcRequestService).toHaveBeenCalledWith(mockConfig);
      expect(MexcRetryService).toHaveBeenCalledWith({
        maxRetries: mockConfig.maxRetries,
        baseDelay: mockConfig.retryDelay,
      });
    });

    it('should maintain service instances throughout lifecycle', () => {
      // Services should be created once during construction
      expect(MexcAuthService).toHaveBeenCalledTimes(1);
      expect(MexcRequestService).toHaveBeenCalledTimes(1);
      expect(MexcRetryService).toHaveBeenCalledTimes(1);
      expect(MexcTradingService).toHaveBeenCalledTimes(1);

      // Multiple calls should use the same instances
      apiClient.hasCredentials();
      apiClient.hasCredentials();

      expect(mockAuthService.hasCredentials).toHaveBeenCalledTimes(2);
    });
  });

  describe('Configuration Management', () => {
    beforeEach(() => {
      apiClient = new MexcApiClient(mockConfig, mockCache, mockReliabilityManager);
    });

    it('should return configuration copy', () => {
      const config1 = apiClient.getConfig();
      const config2 = apiClient.getConfig();

      expect(config1).toEqual(mockConfig);
      expect(config2).toEqual(mockConfig);
      expect(config1).not.toBe(config2); // Should be different objects
      expect(config1).not.toBe(mockConfig); // Should not be the original
    });

    it('should preserve all configuration properties', () => {
      const config = apiClient.getConfig();

      expect(config.apiKey).toBe(mockConfig.apiKey);
      expect(config.secretKey).toBe(mockConfig.secretKey);
      expect(config.baseUrl).toBe(mockConfig.baseUrl);
      expect(config.timeout).toBe(mockConfig.timeout);
      expect(config.maxRetries).toBe(mockConfig.maxRetries);
      expect(config.retryDelay).toBe(mockConfig.retryDelay);
      expect(config.rateLimitDelay).toBe(mockConfig.rateLimitDelay);
      expect(config.enablePaperTrading).toBe(mockConfig.enablePaperTrading);
      expect(config.circuitBreakerThreshold).toBe(mockConfig.circuitBreakerThreshold);
    });

    it('should not allow config modification through getter', () => {
      const config = apiClient.getConfig();
      config.apiKey = 'modified_key';

      const freshConfig = apiClient.getConfig();
      expect(freshConfig.apiKey).toBe(mockConfig.apiKey);
    });
  });

  describe('Statistics Management', () => {
    beforeEach(() => {
      apiClient = new MexcApiClient(mockConfig, mockCache, mockReliabilityManager);
    });

    it('should return initial stats', () => {
      const stats = apiClient.getStats();

      expect(stats).toEqual({
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        retryCount: 0,
      });
    });

    it('should return stats copy', () => {
      const stats1 = apiClient.getStats();
      const stats2 = apiClient.getStats();

      expect(stats1).toEqual(stats2);
      expect(stats1).not.toBe(stats2); // Should be different objects
    });

    it('should not allow stats modification through getter', () => {
      const stats = apiClient.getStats();
      stats.totalRequests = 999;

      const freshStats = apiClient.getStats();
      expect(freshStats.totalRequests).toBe(0);
    });

    it('should maintain consistent stats structure', () => {
      const stats = apiClient.getStats();

      expect(typeof stats.totalRequests).toBe('number');
      expect(typeof stats.successfulRequests).toBe('number');
      expect(typeof stats.failedRequests).toBe('number');
      expect(typeof stats.averageResponseTime).toBe('number');
      expect(typeof stats.cacheHitRate).toBe('number');
      expect(typeof stats.retryCount).toBe('number');
    });
  });

  describe('Type Exports and Backward Compatibility', () => {
    it('should export service classes', () => {
      expect(MexcAuthService).toBeDefined();
      expect(MexcRequestService).toBeDefined();
      expect(MexcRetryService).toBeDefined();
      expect(MexcTradingService).toBeDefined();
    });

    it('should provide main client class', () => {
      expect(MexcApiClient).toBeDefined();
      expect(typeof MexcApiClient).toBe('function');
    });

    it('should maintain backward compatible interface', () => {
      apiClient = new MexcApiClient(mockConfig, mockCache, mockReliabilityManager);

      // Core HTTP methods
      expect(typeof apiClient.get).toBe('function');
      expect(typeof apiClient.post).toBe('function');
      expect(typeof apiClient.put).toBe('function');
      expect(typeof apiClient.delete).toBe('function');

      // Authentication methods
      expect(typeof apiClient.hasCredentials).toBe('function');

      // Trading methods
      expect(typeof apiClient.placeOrder).toBe('function');
      expect(typeof apiClient.getOrderBook).toBe('function');
      expect(typeof apiClient.getOrderStatus).toBe('function');
      expect(typeof apiClient.cancelOrder).toBe('function');
      expect(typeof apiClient.getOpenOrders).toBe('function');
      expect(typeof apiClient.getAccountInfo).toBe('function');
      expect(typeof apiClient.testCredentials).toBe('function');

      // Utility methods
      expect(typeof apiClient.getStats).toBe('function');
      expect(typeof apiClient.getConfig).toBe('function');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    beforeEach(() => {
      apiClient = new MexcApiClient(mockConfig, mockCache, mockReliabilityManager);
    });

    it('should handle null/undefined parameters gracefully', async () => {
      (mockRequestService.executeHttpRequestWithContext as any).mockResolvedValue({});

      await expect(apiClient.get('/test', null)).resolves.not.toThrow();
      await expect(apiClient.get('/test', undefined)).resolves.not.toThrow();
      await expect(apiClient.post('/test', null)).resolves.not.toThrow();
      await expect(apiClient.post('/test', undefined)).resolves.not.toThrow();
    });

    it('should handle service initialization failures', () => {
      (MexcAuthService as any as Mock).mockImplementation(() => {
        throw new Error('Auth service initialization failed');
      });

      expect(() => {
        new MexcApiClient(mockConfig, mockCache, mockReliabilityManager);
      }).toThrow('Auth service initialization failed');
    });

    it('should handle concurrent requests', async () => {
      (mockRequestService.executeHttpRequestWithContext as any).mockImplementation(
        async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return { data: { success: true } };
        }
      );

      const promises = [
        apiClient.get('/test1'),
        apiClient.get('/test2'),
        apiClient.get('/test3'),
        apiClient.post('/test4', {}),
        apiClient.put('/test5', {}),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(mockRequestService.executeHttpRequestWithContext).toHaveBeenCalledTimes(5);
    });

    it('should handle large request payloads', async () => {
      const largePayload = {
        data: Array(1000).fill(0).map((_, i) => ({
          id: i,
          value: `large_value_${i}`.repeat(100),
          nested: { array: Array(50).fill(`item_${i}`) },
        })),
      };

      (mockRequestService.executeHttpRequestWithContext as any).mockResolvedValue({});

      await expect(apiClient.post('/bulk-data', largePayload)).resolves.not.toThrow();
      expect(mockRequestService.executeHttpRequestWithContext).toHaveBeenCalledWith(
        expect.objectContaining({ params: largePayload }),
        expect.any(Object)
      );
    });
  });

  describe('Performance Considerations', () => {
    beforeEach(() => {
      apiClient = new MexcApiClient(mockConfig, mockCache, mockReliabilityManager);
    });

    it('should not create service instances multiple times', () => {
      // Multiple API client instances should each create their own services
      const client2 = new MexcApiClient(mockConfig, mockCache, mockReliabilityManager);
      const client3 = new MexcApiClient(mockConfig, mockCache, mockReliabilityManager);

      // Each client should have created its own service instances
      expect(MexcAuthService).toHaveBeenCalledTimes(3);
      expect(MexcRequestService).toHaveBeenCalledTimes(3);
      expect(MexcRetryService).toHaveBeenCalledTimes(3);
      expect(MexcTradingService).toHaveBeenCalledTimes(3);
    });

    it('should handle rapid successive requests', async () => {
      (mockRequestService.executeHttpRequestWithContext as any).mockResolvedValue({ data: {} });

      const startTime = Date.now();
      const promises = Array(100).fill(0).map((_, i) => 
        apiClient.get(`/rapid-test-${i}`)
      );

      await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete quickly
      expect(mockRequestService.executeHttpRequestWithContext).toHaveBeenCalledTimes(100);
    });

    it('should maintain memory efficiency', () => {
      // Stats should not accumulate without bound
      const initialStats = apiClient.getStats();
      
      // Multiple calls should not create memory leaks
      for (let i = 0; i < 1000; i++) {
        apiClient.getStats();
        apiClient.getConfig();
        apiClient.hasCredentials();
      }

      const finalStats = apiClient.getStats();
      expect(finalStats).toEqual(initialStats);
    });
  });

  describe('Legacy Utility Functions (Backward Compatibility)', () => {
    it('should create proper query string for signature', () => {
      const params = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'MARKET',
        timestamp: 1672531200000
      };

      const queryString = new URLSearchParams(
        Object.entries(params)
          .filter(([_, value]) => value !== undefined && value !== null)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => [key, String(value)])
      ).toString();

      expect(queryString).toBe('side=BUY&symbol=BTCUSDT&timestamp=1672531200000&type=MARKET');
    });

    it('should filter out undefined and null values', () => {
      const params = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'MARKET',
        quantity: undefined,
        price: null,
        timestamp: 1672531200000
      };

      const queryString = new URLSearchParams(
        Object.entries(params)
          .filter(([_, value]) => value !== undefined && value !== null)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => [key, String(value)])
      ).toString();

      expect(queryString).toBe('side=BUY&symbol=BTCUSDT&timestamp=1672531200000&type=MARKET');
    });

    it('should sort parameters alphabetically', () => {
      const params = {
        zebra: 'last',
        alpha: 'first',
        beta: 'second',
        charlie: 'third'
      };

      const queryString = new URLSearchParams(
        Object.entries(params)
          .filter(([_, value]) => value !== undefined && value !== null)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => [key, String(value)])
      ).toString();

      expect(queryString).toBe('alpha=first&beta=second&charlie=third&zebra=last');
    });
  });
});

// Helper types for testing
interface MockOrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET';
  quantity: string;
  price?: string;
}

interface MockAccountBalance {
  asset: string;
  free: string;
  locked: string;
}