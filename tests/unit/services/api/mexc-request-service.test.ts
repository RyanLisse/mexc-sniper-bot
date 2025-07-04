/**
 * Unit tests for MexcRequestService
 * Tests HTTP request execution, timeout management, URL building, error handling, and performance metrics
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as crypto from 'node:crypto';
import {
  MexcRequestService,
} from '../../../../src/services/api/mexc-request-service';
import type { UnifiedMexcConfig } from '@/src/schemas/unified/mexc-api-schemas';
import type {
  ApiRequestConfig,
  RequestContext,
  TimeoutConfig,
} from '../../../../src/services/api/mexc-api-types';

// Mock crypto module
vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-123'),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the error utility
vi.mock('../../../../src/lib/error-type-utils', () => ({
  toSafeError: vi.fn((error) => ({
    message: error instanceof Error ? error.message : String(error),
  })),
}));

describe('MexcRequestService', () => {
  let requestService: MexcRequestService;
  let config: Required<UnifiedMexcConfig>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();

    // Create test configuration
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

    requestService = new MexcRequestService(config);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should create request service with configuration', () => {
      expect(requestService).toBeDefined();
      expect(requestService).toBeInstanceOf(MexcRequestService);
    });

    it('should initialize timeout configuration correctly', () => {
      const timeoutConfig = requestService.getTimeoutConfig();

      expect(timeoutConfig).toMatchObject({
        defaultTimeout: 5000,
        connectTimeout: 10000,
        readTimeout: 20000,
        adaptiveTimeout: true,
        endpointTimeouts: expect.objectContaining({
          '/api/v3/ping': 5000,
          '/api/v3/time': 5000,
          '/api/v3/depth': 15000,
          '/api/v3/account': 30000,
          '/api/v3/order': 45000,
          '/api/v3/openOrders': 30000,
        }),
      });
    });

    it('should update timeout configuration', () => {
      const updates = {
        defaultTimeout: 10000,
        endpointTimeouts: {
          '/api/v3/custom': 8000,
        },
      };

      requestService.updateTimeoutConfig(updates);
      const updatedConfig = requestService.getTimeoutConfig();

      expect(updatedConfig.defaultTimeout).toBe(10000);
      expect(updatedConfig.endpointTimeouts['/api/v3/custom']).toBe(8000);
      expect(updatedConfig.endpointTimeouts['/api/v3/ping']).toBe(5000); // Should preserve existing
    });

    it('should return copy of timeout config to prevent mutation', () => {
      const config1 = requestService.getTimeoutConfig();
      const config2 = requestService.getTimeoutConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different objects
    });
  });

  describe('Request Context Creation', () => {
    it('should create request context with basic parameters', () => {
      const context = requestService.createRequestContext('/api/v3/ping');

      expect(context).toMatchObject({
        requestId: 'test-uuid-123',
        priority: 'low',
        endpoint: '/api/v3/ping',
        attempt: 1,
        startTime: expect.any(Number),
      });
      expect(context.correlationId).toBeUndefined();
      expect(context.metadata).toBeUndefined();
    });

    it('should create request context with all parameters', () => {
      const metadata = { source: 'test' };
      const context = requestService.createRequestContext(
        '/api/v3/order',
        'correlation-123',
        metadata
      );

      expect(context).toMatchObject({
        requestId: 'test-uuid-123',
        correlationId: 'correlation-123',
        priority: 'critical',
        endpoint: '/api/v3/order',
        attempt: 1,
        startTime: expect.any(Number),
        metadata,
      });
    });

    it('should generate unique request IDs', () => {
      (crypto.randomUUID as any)
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2');

      const context1 = requestService.createRequestContext('/api/v3/ping');
      const context2 = requestService.createRequestContext('/api/v3/time');

      expect(context1.requestId).toBe('uuid-1');
      expect(context2.requestId).toBe('uuid-2');
    });
  });

  describe('Priority Determination', () => {
    it('should assign critical priority to account operations', () => {
      expect(requestService.determinePriority('/api/v3/account')).toBe('critical');
      expect(requestService.determinePriority('/api/v3/order')).toBe('critical');
      expect(requestService.determinePriority('/api/v3/order/status')).toBe('critical');
    });

    it('should assign high priority to real-time data', () => {
      expect(requestService.determinePriority('/api/v3/depth')).toBe('high');
      expect(requestService.determinePriority('/api/v3/ticker/24hr')).toBe('high');
      expect(requestService.determinePriority('/api/v3/balance')).toBe('high');
    });

    it('should assign medium priority to market data', () => {
      expect(requestService.determinePriority('/api/v3/exchangeInfo')).toBe('medium');
      expect(requestService.determinePriority('/api/v3/klines')).toBe('medium');
      expect(requestService.determinePriority('/api/v3/trades')).toBe('medium');
    });

    it('should assign low priority to static data', () => {
      expect(requestService.determinePriority('/api/v3/ping')).toBe('low');
      expect(requestService.determinePriority('/api/v3/time')).toBe('low');
      expect(requestService.determinePriority('/api/v3/unknown')).toBe('low');
    });
  });

  describe('Timeout Calculation', () => {
    it('should use request-specific timeout when provided', () => {
      const requestConfig: ApiRequestConfig = {
        method: 'GET',
        endpoint: '/api/v3/test',
        timeout: 15000,
      };

      const timeout = requestService.calculateTimeout(requestConfig);
      expect(timeout).toBe(15000);
    });

    it('should use endpoint-specific timeout', () => {
      const requestConfig: ApiRequestConfig = {
        method: 'GET',
        endpoint: '/api/v3/order',
      };

      const timeout = requestService.calculateTimeout(requestConfig);
      expect(timeout).toBe(45000); // From endpointTimeouts
    });

    it('should use method-specific timeout for write operations', () => {
      const postConfig: ApiRequestConfig = {
        method: 'POST',
        endpoint: '/api/v3/custom',
      };

      const putConfig: ApiRequestConfig = {
        method: 'PUT',
        endpoint: '/api/v3/custom',
      };

      const deleteConfig: ApiRequestConfig = {
        method: 'DELETE',
        endpoint: '/api/v3/custom',
      };

      expect(requestService.calculateTimeout(postConfig)).toBe(7500); // 5000 * 1.5
      expect(requestService.calculateTimeout(putConfig)).toBe(7500);
      expect(requestService.calculateTimeout(deleteConfig)).toBe(7500);
    });

    it('should use default timeout for GET requests', () => {
      const requestConfig: ApiRequestConfig = {
        method: 'GET',
        endpoint: '/api/v3/custom',
      };

      const timeout = requestService.calculateTimeout(requestConfig);
      expect(timeout).toBe(5000); // Default timeout
    });
  });

  describe('URL Building', () => {
    it('should build URL with endpoint', () => {
      const requestConfig: ApiRequestConfig = {
        method: 'GET',
        endpoint: '/api/v3/ping',
      };

      // Access private method via type assertion
      const url = (requestService as any).buildUrl(requestConfig);
      expect(url).toBe('https://api.mexc.com/api/v3/ping');
    });

    it('should handle endpoint without leading slash', () => {
      const requestConfig: ApiRequestConfig = {
        method: 'GET',
        endpoint: 'api/v3/ping',
      };

      const url = (requestService as any).buildUrl(requestConfig);
      expect(url).toBe('https://api.mexc.com/api/v3/ping');
    });

    it('should handle base URL with trailing slash', () => {
      const configWithSlash = { ...config, baseUrl: 'https://api.mexc.com/' };
      const serviceWithSlash = new MexcRequestService(configWithSlash);

      const requestConfig: ApiRequestConfig = {
        method: 'GET',
        endpoint: '/api/v3/ping',
      };

      const url = (serviceWithSlash as any).buildUrl(requestConfig);
      expect(url).toBe('https://api.mexc.com/api/v3/ping');
    });

    it('should add query parameters for GET requests', () => {
      const requestConfig: ApiRequestConfig = {
        method: 'GET',
        endpoint: '/api/v3/depth',
        params: {
          symbol: 'BTCUSDT',
          limit: 100,
        },
      };

      const url = (requestService as any).buildUrl(requestConfig);
      expect(url).toBe('https://api.mexc.com/api/v3/depth?symbol=BTCUSDT&limit=100');
    });

    it('should handle array parameters', () => {
      const requestConfig: ApiRequestConfig = {
        method: 'GET',
        endpoint: '/api/v3/test',
        params: {
          symbols: ['BTCUSDT', 'ETHUSDT'],
          numbers: [1, 2, 3],
        },
      };

      const url = (requestService as any).buildUrl(requestConfig);
      expect(url).toContain('symbols=BTCUSDT%2CETHUSDT');
      expect(url).toContain('numbers=1%2C2%2C3');
    });

    it('should skip null and undefined parameters', () => {
      const requestConfig: ApiRequestConfig = {
        method: 'GET',
        endpoint: '/api/v3/test',
        params: {
          symbol: 'BTCUSDT',
          limit: null,
          offset: undefined,
          active: true,
        },
      };

      const url = (requestService as any).buildUrl(requestConfig);
      expect(url).toContain('symbol=BTCUSDT');
      expect(url).toContain('active=true');
      expect(url).not.toContain('limit');
      expect(url).not.toContain('offset');
    });

    it('should not add query parameters for non-GET requests', () => {
      const requestConfig: ApiRequestConfig = {
        method: 'POST',
        endpoint: '/api/v3/order',
        params: {
          symbol: 'BTCUSDT',
          side: 'BUY',
        },
      };

      const url = (requestService as any).buildUrl(requestConfig);
      expect(url).toBe('https://api.mexc.com/api/v3/order');
    });
  });

  describe('HTTP Request Execution', () => {
    const createMockResponse = (data: any, status = 200, statusText = 'OK') => ({
      ok: status >= 200 && status < 300,
      status,
      statusText,
      headers: new Headers({
        'content-type': 'application/json',
        'x-request-id': 'req-123',
      }),
      json: vi.fn().mockResolvedValue(data),
    });

    it('should execute successful GET request', async () => {
      const mockData = { symbol: 'BTCUSDT', price: '50000' };
      const mockResponse = createMockResponse(mockData);
      mockFetch.mockResolvedValue(mockResponse);

      const requestConfig: ApiRequestConfig = {
        method: 'GET',
        endpoint: '/api/v3/ticker/price',
        params: { symbol: 'BTCUSDT' },
      };

      const context = requestService.createRequestContext('/api/v3/ticker/price');
      const result = await requestService.executeHttpRequestWithContext(requestConfig, context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(result.requestId).toBe('test-uuid-123');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata?.status).toBe(200);
      expect(result.metadata?.endpoint).toBe('/api/v3/ticker/price');
      expect(result.metadata?.method).toBe('GET');
    });

    it('should execute successful POST request with body', async () => {
      const mockData = { orderId: '12345', status: 'NEW' };
      const mockResponse = createMockResponse(mockData);
      mockFetch.mockResolvedValue(mockResponse);

      const requestConfig: ApiRequestConfig = {
        method: 'POST',
        endpoint: '/api/v3/order',
        params: {
          symbol: 'BTCUSDT',
          side: 'BUY',
          quantity: 1.0,
        },
      };

      const context = requestService.createRequestContext('/api/v3/order');
      const result = await requestService.executeHttpRequestWithContext(requestConfig, context);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mexc.com/api/v3/order',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'mexc-sniper-bot/1.0',
          }),
          body: JSON.stringify({
            symbol: 'BTCUSDT',
            side: 'BUY',
            quantity: 1.0,
          }),
          signal: expect.any(AbortSignal),
        })
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
    });

    it('should handle HTTP error responses', async () => {
      const errorData = { code: -1001, msg: 'Invalid symbol' };
      const mockResponse = createMockResponse(errorData, 400, 'Bad Request');
      mockFetch.mockResolvedValue(mockResponse);

      const requestConfig: ApiRequestConfig = {
        method: 'GET',
        endpoint: '/api/v3/ticker/price',
        params: { symbol: 'INVALID' },
      };

      const context = requestService.createRequestContext('/api/v3/ticker/price');
      const result = await requestService.executeHttpRequestWithContext(requestConfig, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 400: Bad Request');
      expect(result.code).toBe('400');
      expect(result.requestId).toBe('test-uuid-123');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network connection failed'));

      const requestConfig: ApiRequestConfig = {
        method: 'GET',
        endpoint: '/api/v3/ping',
      };

      const context = requestService.createRequestContext('/api/v3/ping');
      const result = await requestService.executeHttpRequestWithContext(requestConfig, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network connection failed');
      expect(result.requestId).toBe('test-uuid-123');
    });

    it('should handle request timeout', async () => {
      // Mock AbortController
      const mockAbortController = {
        signal: { aborted: false },
        abort: vi.fn(),
      };
      global.AbortController = vi.fn(() => mockAbortController) as any;

      // Mock fetch to hang until timeout
      mockFetch.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Long delay
        return createMockResponse({});
      });

      const requestConfig: ApiRequestConfig = {
        method: 'GET',
        endpoint: '/api/v3/ping',
      };

      const context = requestService.createRequestContext('/api/v3/ping');
      
      // Start request and advance timers to trigger timeout
      const resultPromise = requestService.executeHttpRequestWithContext(requestConfig, context);
      vi.advanceTimersByTime(5000); // Trigger timeout
      
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Request timeout after 5000ms');
    });

    it('should not add body for GET requests', async () => {
      const mockResponse = createMockResponse({});
      mockFetch.mockResolvedValue(mockResponse);

      const requestConfig: ApiRequestConfig = {
        method: 'GET',
        endpoint: '/api/v3/ping',
        params: { test: 'value' },
      };

      const context = requestService.createRequestContext('/api/v3/ping');
      await requestService.executeHttpRequestWithContext(requestConfig, context);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'GET',
          body: undefined, // No body for GET
        })
      );
    });

    it('should parse response headers correctly', async () => {
      const mockHeaders = new Headers({
        'content-type': 'application/json',
        'X-RateLimit-Remaining': '100',
        'X-Request-ID': 'req-456',
      });

      const mockResponse = {
        ...createMockResponse({}),
        headers: mockHeaders,
      };
      mockFetch.mockResolvedValue(mockResponse);

      const requestConfig: ApiRequestConfig = {
        method: 'GET',
        endpoint: '/api/v3/ping',
      };

      const context = requestService.createRequestContext('/api/v3/ping');
      const result = await requestService.executeHttpRequestWithContext(requestConfig, context);

      expect(result.metadata?.headers).toEqual({
        'content-type': 'application/json',
        'x-ratelimit-remaining': '100',
        'x-request-id': 'req-456',
      });
    });
  });

  describe('Error Code Extraction', () => {
    it('should extract HTTP status codes', () => {
      const error = new Error('HTTP 429: Too Many Requests');
      const code = (requestService as any).extractErrorCode(error);
      expect(code).toBe('429');
    });

    it('should extract MEXC error codes', () => {
      const error = new Error('API Error: {"code": -1001, "msg": "Invalid symbol"}');
      const code = (requestService as any).extractErrorCode(error);
      expect(code).toBe('-1001');
    });

    it('should detect timeout errors', () => {
      const error = new Error('Request timeout after 5000ms');
      const code = (requestService as any).extractErrorCode(error);
      expect(code).toBe('TIMEOUT');
    });

    it('should detect network errors', () => {
      const error = new Error('Network connection failed');
      const code = (requestService as any).extractErrorCode(error);
      expect(code).toBe('NETWORK_ERROR');
    });

    it('should detect unauthorized errors', () => {
      const error = new Error('Unauthorized access');
      const code = (requestService as any).extractErrorCode(error);
      expect(code).toBe('UNAUTHORIZED');
    });

    it('should detect rate limit errors', () => {
      const error = new Error('Rate limit exceeded');
      const code = (requestService as any).extractErrorCode(error);
      expect(code).toBe('RATE_LIMIT');
    });

    it('should return undefined for unknown errors', () => {
      const error = new Error('Unknown error occurred');
      const code = (requestService as any).extractErrorCode(error);
      expect(code).toBeUndefined();
    });
  });

  describe('Performance Metrics', () => {
    it('should create performance metrics', () => {
      const requestConfig: ApiRequestConfig = {
        method: 'POST',
        endpoint: '/api/v3/order',
        params: { symbol: 'BTCUSDT', side: 'BUY' },
      };

      const context: RequestContext = {
        requestId: 'test-123',
        priority: 'critical',
        endpoint: '/api/v3/order',
        attempt: 2,
        startTime: Date.now() - 150,
      };

      const response = {
        data: { orderId: '12345' },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        config: requestConfig,
      };

      const metrics = requestService.createPerformanceMetrics(
        requestConfig,
        context,
        response,
        false
      );

      expect(metrics).toMatchObject({
        responseTime: expect.any(Number),
        requestSize: expect.any(Number),
        responseSize: expect.any(Number),
        cacheHit: false,
        retryCount: 1, // attempt - 1
        endpoint: '/api/v3/order',
        method: 'POST',
        timestamp: expect.any(Number),
      });

      expect(metrics.responseTime).toBeGreaterThan(0);
      expect(metrics.requestSize).toBeGreaterThan(0);
      expect(metrics.responseSize).toBeGreaterThan(0);
    });

    it('should estimate request size correctly', () => {
      const smallConfig: ApiRequestConfig = {
        method: 'GET',
        endpoint: '/ping',
      };

      const largeConfig: ApiRequestConfig = {
        method: 'POST',
        endpoint: '/api/v3/order',
        params: {
          symbol: 'BTCUSDT',
          side: 'BUY',
          quantity: 1.0,
          price: 50000,
          timeInForce: 'GTC',
        },
      };

      const smallSize = (requestService as any).estimateRequestSize(smallConfig);
      const largeSize = (requestService as any).estimateRequestSize(largeConfig);

      expect(smallSize).toBeGreaterThan(0);
      expect(largeSize).toBeGreaterThan(smallSize);
    });

    it('should estimate response size correctly', () => {
      const smallResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as ApiRequestConfig,
      };

      const largeResponse = {
        data: {
          symbol: 'BTCUSDT',
          orders: Array.from({ length: 100 }, (_, i) => ({
            orderId: `order-${i}`,
            side: 'BUY',
            quantity: Math.random(),
          })),
        },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        config: {} as ApiRequestConfig,
      };

      const smallSize = (requestService as any).estimateResponseSize(smallResponse);
      const largeSize = (requestService as any).estimateResponseSize(largeResponse);

      expect(smallSize).toBeGreaterThan(0);
      expect(largeSize).toBeGreaterThan(smallSize);
    });

    it('should track cache hits correctly', () => {
      const requestConfig: ApiRequestConfig = {
        method: 'GET',
        endpoint: '/api/v3/ping',
      };

      const context: RequestContext = {
        requestId: 'test-123',
        priority: 'low',
        endpoint: '/api/v3/ping',
        attempt: 1,
        startTime: Date.now(),
      };

      const response = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: requestConfig,
      };

      const metricsWithCache = requestService.createPerformanceMetrics(
        requestConfig,
        context,
        response,
        true
      );

      const metricsWithoutCache = requestService.createPerformanceMetrics(
        requestConfig,
        context,
        response,
        false
      );

      expect(metricsWithCache.cacheHit).toBe(true);
      expect(metricsWithoutCache.cacheHit).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty response body', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: vi.fn().mockResolvedValue(null),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const requestConfig: ApiRequestConfig = {
        method: 'GET',
        endpoint: '/api/v3/ping',
      };

      const context = requestService.createRequestContext('/api/v3/ping');
      const result = await requestService.executeHttpRequestWithContext(requestConfig, context);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should handle JSON parsing errors', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const requestConfig: ApiRequestConfig = {
        method: 'GET',
        endpoint: '/api/v3/ping',
      };

      const context = requestService.createRequestContext('/api/v3/ping');
      const result = await requestService.executeHttpRequestWithContext(requestConfig, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid JSON');
    });

    it('should handle non-Error thrown values', async () => {
      mockFetch.mockRejectedValue('String error');

      const requestConfig: ApiRequestConfig = {
        method: 'GET',
        endpoint: '/api/v3/ping',
      };

      const context = requestService.createRequestContext('/api/v3/ping');
      const result = await requestService.executeHttpRequestWithContext(requestConfig, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown error during request');
    });

    it('should handle empty parameters object', () => {
      const requestConfig: ApiRequestConfig = {
        method: 'GET',
        endpoint: '/api/v3/ping',
        params: {},
      };

      const url = (requestService as any).buildUrl(requestConfig);
      expect(url).toBe('https://api.mexc.com/api/v3/ping');
    });

    it('should handle special characters in parameters', () => {
      const requestConfig: ApiRequestConfig = {
        method: 'GET',
        endpoint: '/api/v3/test',
        params: {
          symbol: 'BTC/USDT',
          filter: 'price>50000&volume>1000',
        },
      };

      const url = (requestService as any).buildUrl(requestConfig);
      expect(url).toContain('symbol=BTC%2FUSDT');
      expect(url).toContain('filter=price%3E50000%26volume%3E1000');
    });

    it('should measure response time accurately', async () => {
      const mockResponse = createMockResponse({});
      
      // Mock delayed response
      mockFetch.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return mockResponse;
      });

      const requestConfig: ApiRequestConfig = {
        method: 'GET',
        endpoint: '/api/v3/ping',
      };

      const context = requestService.createRequestContext('/api/v3/ping');
      
      const startTime = Date.now();
      vi.advanceTimersByTime(100);
      const result = await requestService.executeHttpRequestWithContext(requestConfig, context);
      
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle zero-byte responses', () => {
      const response = {
        data: '',
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as ApiRequestConfig,
      };

      const size = (requestService as any).estimateResponseSize(response);
      expect(size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Configuration Management', () => {
    it('should preserve original configuration when updating timeouts', () => {
      const originalConfig = requestService.getTimeoutConfig();
      const originalDefault = originalConfig.defaultTimeout;

      requestService.updateTimeoutConfig({ defaultTimeout: 10000 });

      const updatedConfig = requestService.getTimeoutConfig();
      expect(updatedConfig.defaultTimeout).toBe(10000);

      // Original should remain unchanged
      expect(originalConfig.defaultTimeout).toBe(originalDefault);
    });

    it('should handle partial timeout config updates', () => {
      const update = {
        connectTimeout: 15000,
      };

      requestService.updateTimeoutConfig(update);
      const config = requestService.getTimeoutConfig();

      expect(config.connectTimeout).toBe(15000);
      expect(config.defaultTimeout).toBe(5000); // Should remain unchanged
      expect(config.readTimeout).toBe(20000); // Should remain unchanged
    });
  });
});