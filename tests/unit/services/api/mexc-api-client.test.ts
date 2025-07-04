/**
 * Unit tests for MexcApiClient
 * Tests modular API client composition, HTTP methods, service delegation, and configuration management
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MexcApiClient } from '../../../../src/services/api/mexc-api-client';
import { MexcAuthService } from '../../../../src/services/api/mexc-auth-service';
import { MexcRequestService } from '../../../../src/services/api/mexc-request-service';
import { MexcRetryService } from '../../../../src/services/api/mexc-retry-service';
import { MexcTradingService } from '../../../../src/services/api/mexc-trading-service';
import type { UnifiedMexcConfig } from '@/src/schemas/unified/mexc-api-schemas';
import type { MexcRequestCache } from '../../../../src/services/api/mexc-request-cache';
import type { CircuitBreaker } from '../../../../src/services/risk/circuit-breaker';

// Mock the service dependencies
vi.mock('../../../../src/services/api/mexc-auth-service');
vi.mock('../../../../src/services/api/mexc-request-service');
vi.mock('../../../../src/services/api/mexc-retry-service');
vi.mock('../../../../src/services/api/mexc-trading-service');

describe('MexcApiClient', () => {
  let config: Required<UnifiedMexcConfig>;
  let mockCache: MexcRequestCache;
  let mockReliabilityManager: CircuitBreaker;
  let client: MexcApiClient;
  let mockAuthService: any;
  let mockRequestService: any;
  let mockRetryService: any;
  let mockTradingService: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock config
    config = {
      apiKey: 'test-api-key',
      secretKey: 'test-secret-key',
      baseUrl: 'https://api.mexc.com',
      passphrase: 'test-passphrase',
      enabledFlags: {
        trading: true,
        marketData: true,
        portfolioSync: true,
        realTimeUpdates: true,
        performanceOptimization: true,
        advancedErrorHandling: true,
        circuitBreaker: true,
        adaptiveRateLimit: true,
        webhookSupport: true,
        experimentalFeatures: false,
      },
      timeout: 5000,
      maxRetries: 3,
      retryDelay: 1000,
      rateLimit: {
        maxRequestsPerSecond: 10,
        burstLimit: 20,
        cooldownPeriod: 60000,
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 30000,
        monitoringWindow: 60000,
      },
    };

    // Create mock cache
    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      size: 0,
    } as any;

    // Create mock reliability manager
    mockReliabilityManager = {
      execute: vi.fn().mockImplementation((fn) => fn()),
      getState: vi.fn().mockReturnValue('CLOSED'),
      getStats: vi.fn().mockReturnValue({ failures: 0, successes: 0 }),
    } as any;

    // Create mock services
    mockAuthService = {
      hasCredentials: vi.fn().mockReturnValue(true),
    };

    mockRequestService = {
      executeHttpRequestWithContext: vi.fn().mockResolvedValue({ success: true, data: {} }),
      createRequestContext: vi.fn().mockReturnValue({ requestId: 'test-123' }),
    };

    mockRetryService = {
      withRetry: vi.fn().mockImplementation((fn) => fn()),
    };

    mockTradingService = {
      placeOrder: vi.fn().mockResolvedValue({ success: true, orderId: 'order-123' }),
      getOrderBook: vi.fn().mockResolvedValue({ success: true, bids: [], asks: [] }),
      getOrderStatus: vi.fn().mockResolvedValue({ success: true, status: 'FILLED' }),
      cancelOrder: vi.fn().mockResolvedValue({ success: true }),
      getOpenOrders: vi.fn().mockResolvedValue({ success: true, orders: [] }),
      getAccountInfo: vi.fn().mockResolvedValue({ success: true, balances: [] }),
      testCredentials: vi.fn().mockResolvedValue({ isValid: true, hasConnection: true }),
    };

    // Mock the constructors
    (MexcAuthService as any).mockImplementation(() => mockAuthService);
    (MexcRequestService as any).mockImplementation(() => mockRequestService);
    (MexcRetryService as any).mockImplementation(() => mockRetryService);
    (MexcTradingService as any).mockImplementation(() => mockTradingService);

    // Create client instance
    client = new MexcApiClient(config, mockCache, mockReliabilityManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('MexcApiClient Construction', () => {
    it('should create client with all required dependencies', () => {
      expect(client).toBeDefined();
      expect(MexcAuthService).toHaveBeenCalledWith(config);
      expect(MexcRequestService).toHaveBeenCalledWith(config);
      expect(MexcRetryService).toHaveBeenCalledWith({
        maxRetries: config.maxRetries,
        baseDelay: config.retryDelay,
      });
      expect(MexcTradingService).toHaveBeenCalledWith(client);
    });

    it('should initialize with default statistics', () => {
      const stats = client.getStats();
      
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
      const clientConfig = client.getConfig();
      
      expect(clientConfig).toEqual(config);
    });

    it('should handle optional parameters', () => {
      const enhancedCache = {} as any;
      const performanceMonitoring = {} as any;
      
      const clientWithOptional = new MexcApiClient(
        config,
        mockCache,
        mockReliabilityManager,
        enhancedCache,
        performanceMonitoring
      );
      
      expect(clientWithOptional).toBeDefined();
    });
  });

  describe('HTTP Methods', () => {
    it('should delegate GET requests to request service', async () => {
      const endpoint = '/api/v3/test';
      const params = { symbol: 'BTCUSDT' };
      const options = { timeout: 3000 };
      
      const result = await client.get(endpoint, params, options);
      
      expect(mockRequestService.executeHttpRequestWithContext).toHaveBeenCalledWith(
        { method: 'GET', endpoint, params, ...options },
        { requestId: 'test-123' }
      );
      expect(mockRequestService.createRequestContext).toHaveBeenCalledWith(endpoint);
      expect(result).toEqual({ success: true, data: {} });
    });

    it('should delegate POST requests to request service', async () => {
      const endpoint = '/api/v3/order';
      const params = { symbol: 'BTCUSDT', side: 'BUY' };
      
      const result = await client.post(endpoint, params);
      
      expect(mockRequestService.executeHttpRequestWithContext).toHaveBeenCalledWith(
        { method: 'POST', endpoint, params },
        { requestId: 'test-123' }
      );
      expect(result).toEqual({ success: true, data: {} });
    });

    it('should delegate PUT requests to request service', async () => {
      const endpoint = '/api/v3/order/modify';
      const params = { orderId: '123', quantity: 1.5 };
      
      const result = await client.put(endpoint, params);
      
      expect(mockRequestService.executeHttpRequestWithContext).toHaveBeenCalledWith(
        { method: 'PUT', endpoint, params },
        { requestId: 'test-123' }
      );
      expect(result).toEqual({ success: true, data: {} });
    });

    it('should delegate DELETE requests to request service', async () => {
      const endpoint = '/api/v3/order';
      const params = { orderId: '123' };
      
      const result = await client.delete(endpoint, params);
      
      expect(mockRequestService.executeHttpRequestWithContext).toHaveBeenCalledWith(
        { method: 'DELETE', endpoint, params },
        { requestId: 'test-123' }
      );
      expect(result).toEqual({ success: true, data: {} });
    });

    it('should handle HTTP method calls without parameters', async () => {
      const endpoint = '/api/v3/time';
      
      const result = await client.get(endpoint);
      
      expect(mockRequestService.executeHttpRequestWithContext).toHaveBeenCalledWith(
        { method: 'GET', endpoint, params: undefined },
        { requestId: 'test-123' }
      );
      expect(result).toEqual({ success: true, data: {} });
    });

    it('should handle HTTP method calls without options', async () => {
      const endpoint = '/api/v3/order';
      const params = { symbol: 'ETHUSDT' };
      
      const result = await client.post(endpoint, params);
      
      expect(mockRequestService.executeHttpRequestWithContext).toHaveBeenCalledWith(
        { method: 'POST', endpoint, params },
        { requestId: 'test-123' }
      );
      expect(result).toEqual({ success: true, data: {} });
    });
  });

  describe('Authentication Methods', () => {
    it('should delegate hasCredentials to auth service', () => {
      const result = client.hasCredentials();
      
      expect(mockAuthService.hasCredentials).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should handle auth service returning false', () => {
      mockAuthService.hasCredentials.mockReturnValue(false);
      
      const result = client.hasCredentials();
      
      expect(result).toBe(false);
    });
  });

  describe('Trading Methods', () => {
    it('should delegate placeOrder to trading service', async () => {
      const orderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'MARKET',
        quantity: 1.0,
      };
      
      const result = await client.placeOrder(orderParams);
      
      expect(mockTradingService.placeOrder).toHaveBeenCalledWith(orderParams);
      expect(result).toEqual({ success: true, orderId: 'order-123' });
    });

    it('should delegate getOrderBook to trading service', async () => {
      const symbol = 'BTCUSDT';
      const limit = 50;
      
      const result = await client.getOrderBook(symbol, limit);
      
      expect(mockTradingService.getOrderBook).toHaveBeenCalledWith(symbol, limit);
      expect(result).toEqual({ success: true, bids: [], asks: [] });
    });

    it('should use default limit for getOrderBook', async () => {
      const symbol = 'ETHUSDT';
      
      const result = await client.getOrderBook(symbol);
      
      expect(mockTradingService.getOrderBook).toHaveBeenCalledWith(symbol, 100);
      expect(result).toEqual({ success: true, bids: [], asks: [] });
    });

    it('should delegate getOrderStatus to trading service', async () => {
      const symbol = 'BTCUSDT';
      const orderId = 'order-456';
      
      const result = await client.getOrderStatus(symbol, orderId);
      
      expect(mockTradingService.getOrderStatus).toHaveBeenCalledWith(symbol, orderId);
      expect(result).toEqual({ success: true, status: 'FILLED' });
    });

    it('should delegate cancelOrder to trading service', async () => {
      const symbol = 'BTCUSDT';
      const orderId = 'order-789';
      
      const result = await client.cancelOrder(symbol, orderId);
      
      expect(mockTradingService.cancelOrder).toHaveBeenCalledWith(symbol, orderId);
      expect(result).toEqual({ success: true });
    });

    it('should delegate getOpenOrders to trading service with symbol', async () => {
      const symbol = 'BTCUSDT';
      
      const result = await client.getOpenOrders(symbol);
      
      expect(mockTradingService.getOpenOrders).toHaveBeenCalledWith(symbol);
      expect(result).toEqual({ success: true, orders: [] });
    });

    it('should delegate getOpenOrders to trading service without symbol', async () => {
      const result = await client.getOpenOrders();
      
      expect(mockTradingService.getOpenOrders).toHaveBeenCalledWith(undefined);
      expect(result).toEqual({ success: true, orders: [] });
    });

    it('should delegate getAccountInfo to trading service', async () => {
      const result = await client.getAccountInfo();
      
      expect(mockTradingService.getAccountInfo).toHaveBeenCalled();
      expect(result).toEqual({ success: true, balances: [] });
    });

    it('should delegate testCredentials to trading service', async () => {
      const result = await client.testCredentials();
      
      expect(mockTradingService.testCredentials).toHaveBeenCalled();
      expect(result).toEqual({ isValid: true, hasConnection: true });
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should return copy of stats to prevent mutation', () => {
      const stats1 = client.getStats();
      const stats2 = client.getStats();
      
      expect(stats1).toEqual(stats2);
      expect(stats1).not.toBe(stats2); // Different objects
    });

    it('should return copy of config to prevent mutation', () => {
      const config1 = client.getConfig();
      const config2 = client.getConfig();
      
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different objects
    });

    it('should maintain immutable config', () => {
      const clientConfig = client.getConfig();
      const originalApiKey = clientConfig.apiKey;
      
      // Attempt to modify config
      clientConfig.apiKey = 'modified-key';
      
      // Config should remain unchanged
      const freshConfig = client.getConfig();
      expect(freshConfig.apiKey).toBe(originalApiKey);
    });

    it('should maintain immutable stats', () => {
      const stats = client.getStats();
      const originalTotal = stats.totalRequests;
      
      // Attempt to modify stats
      stats.totalRequests = 999;
      
      // Stats should remain unchanged
      const freshStats = client.getStats();
      expect(freshStats.totalRequests).toBe(originalTotal);
    });
  });

  describe('Service Integration', () => {
    it('should properly initialize all service dependencies', () => {
      expect(MexcAuthService).toHaveBeenCalledTimes(1);
      expect(MexcRequestService).toHaveBeenCalledTimes(1);
      expect(MexcRetryService).toHaveBeenCalledTimes(1);
      expect(MexcTradingService).toHaveBeenCalledTimes(1);
    });

    it('should pass correct parameters to retry service', () => {
      expect(MexcRetryService).toHaveBeenCalledWith({
        maxRetries: config.maxRetries,
        baseDelay: config.retryDelay,
      });
    });

    it('should pass client instance to trading service', () => {
      expect(MexcTradingService).toHaveBeenCalledWith(client);
    });

    it('should maintain service references for delegation', () => {
      // Verify that the client can successfully delegate to all services
      expect(() => client.hasCredentials()).not.toThrow();
      expect(() => client.getStats()).not.toThrow();
      expect(() => client.getConfig()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle request service errors gracefully', async () => {
      const error = new Error('Request failed');
      mockRequestService.executeHttpRequestWithContext.mockRejectedValue(error);
      
      await expect(client.get('/test')).rejects.toThrow('Request failed');
    });

    it('should handle trading service errors gracefully', async () => {
      const error = new Error('Trading service error');
      mockTradingService.placeOrder.mockRejectedValue(error);
      
      await expect(client.placeOrder({})).rejects.toThrow('Trading service error');
    });

    it('should handle auth service errors gracefully', () => {
      const error = new Error('Auth error');
      mockAuthService.hasCredentials.mockImplementation(() => {
        throw error;
      });
      
      expect(() => client.hasCredentials()).toThrow('Auth error');
    });
  });

  describe('Configuration Validation', () => {
    it('should work with minimal valid configuration', () => {
      const minimalConfig = {
        ...config,
        passphrase: undefined,
      };
      
      expect(() => new MexcApiClient(
        minimalConfig as any,
        mockCache,
        mockReliabilityManager
      )).not.toThrow();
    });

    it('should handle configuration edge cases', () => {
      const edgeCaseConfig = {
        ...config,
        timeout: 0,
        maxRetries: 0,
        retryDelay: 0,
      };
      
      const edgeClient = new MexcApiClient(
        edgeCaseConfig,
        mockCache,
        mockReliabilityManager
      );
      
      expect(edgeClient.getConfig().timeout).toBe(0);
      expect(edgeClient.getConfig().maxRetries).toBe(0);
      expect(edgeClient.getConfig().retryDelay).toBe(0);
    });
  });

  describe('Performance Characteristics', () => {
    it('should create client instances efficiently', () => {
      const startTime = Date.now();
      const clientCount = 100;

      for (let i = 0; i < clientCount; i++) {
        new MexcApiClient(config, mockCache, mockReliabilityManager);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should create 100 clients in under 1 second
    });

    it('should handle method calls efficiently', async () => {
      const startTime = Date.now();
      const callCount = 100;

      const promises = [];
      for (let i = 0; i < callCount; i++) {
        promises.push(client.get(`/test/${i}`));
      }

      await Promise.all(promises);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(200); // Should handle 100 calls in under 200ms
    });
  });

  describe('Type Safety and Exports', () => {
    it('should export all required types and classes', () => {
      // Verify that the main exports are available
      expect(MexcApiClient).toBeDefined();
      expect(typeof MexcApiClient).toBe('function');
      
      // These are verified by the import statements not failing
      expect(MexcAuthService).toBeDefined();
      expect(MexcRequestService).toBeDefined();
      expect(MexcRetryService).toBeDefined();
      expect(MexcTradingService).toBeDefined();
    });

    it('should maintain type safety for method parameters', async () => {
      // TypeScript compilation will catch type errors
      // This test verifies runtime behavior matches types
      
      const orderParams = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'MARKET',
        quantity: 1.0,
      };
      
      // Should accept properly typed parameters
      await expect(client.placeOrder(orderParams)).resolves.toBeDefined();
      
      // Should handle undefined/optional parameters
      await expect(client.getOpenOrders()).resolves.toBeDefined();
      await expect(client.getOpenOrders('BTCUSDT')).resolves.toBeDefined();
    });
  });
});