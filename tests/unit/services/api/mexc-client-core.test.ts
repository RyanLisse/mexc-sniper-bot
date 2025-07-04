/**
 * Unit tests for MexcClientCore
 * Tests core request infrastructure, authentication, caching, rate limiting, and error handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as crypto from 'node:crypto';
import {
  MexcClientCore,
} from '../../../../src/services/api/mexc-client-core';
import type {
  UnifiedMexcConfig,
  UnifiedMexcResponse,
} from '../../../../src/services/api/mexc-client-types';
import { MexcClientError } from '../../../../src/services/api/mexc-client-types';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../../utils/timeout-elimination-helpers';

// Mock crypto module
vi.mock('node:crypto', () => ({
  createHmac: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => 'mocked-signature'),
  })),
}));

// Mock circuit breaker
vi.mock('../../../../src/services/risk/circuit-breaker', () => ({
  mexcApiBreaker: {
    execute: vi.fn(async (fn, fallback) => {
      try {
        return await fn();
      } catch (error) {
        return await fallback();
      }
    }),
  },
}));

// Mock request cache
vi.mock('../../../../src/services/api/mexc-request-cache', () => ({
  MexcRequestCache: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
    getStats: vi.fn(() => ({
      hits: 0,
      misses: 0,
      size: 0,
    })),
  })),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock AbortController
global.AbortController = vi.fn(() => ({
  signal: { aborted: false },
  abort: vi.fn(),
})) as any;

describe('MexcClientCore', () => {
  let clientCore: MexcClientCore;
  let mockConsole: any;
  let mockCache: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();

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

    // Create mock cache instance
    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
      clear: vi.fn(),
      getStats: vi.fn(() => ({
        hits: 5,
        misses: 10,
        size: 15,
      })),
    };

    // Mock the MexcRequestCache constructor to return our mock
    const { MexcRequestCache } = require('../../../../src/services/api/mexc-request-cache');
    MexcRequestCache.mockImplementation(() => mockCache);

    // Clear environment variables
    delete process.env.MEXC_API_KEY;
    delete process.env.MEXC_SECRET_KEY;
    delete process.env.MEXC_BASE_URL;
  });

  afterEach(async () => {
    // TIMEOUT ELIMINATION: Ensure all promises are flushed before cleanup
    await flushPromises();
    vi.useRealTimers();
    vi.restoreAllMocks();
  
  });

  describe('Constructor and Configuration', () => {
    it('should create client with default configuration', () => {
      clientCore = new MexcClientCore();

      expect(clientCore).toBeDefined();
      expect(clientCore).toBeInstanceOf(MexcClientCore);
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[MexcClientCore] Initialized with config:',
        expect.objectContaining({
          hasApiKey: false,
          hasSecretKey: false,
          baseUrl: 'https://api.mexc.com',
          timeout: 10000,
          maxRetries: 3,
          enableCaching: true,
        })
      );
    });

    it('should create client with custom configuration', () => {
      const config: UnifiedMexcConfig = {
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
        baseUrl: 'https://api.custom.com',
        timeout: 15000,
        maxRetries: 5,
        retryDelay: 2000,
        rateLimitDelay: 200,
        enableCaching: false,
        cacheTTL: 120000,
      };

      clientCore = new MexcClientCore(config);

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[MexcClientCore] Initialized with config:',
        expect.objectContaining({
          hasApiKey: true,
          hasSecretKey: true,
          baseUrl: 'https://api.custom.com',
          timeout: 15000,
          maxRetries: 5,
          enableCaching: false,
        })
      );
    });

    it('should use environment variables for credentials', () => {
      process.env.MEXC_API_KEY = 'env-api-key';
      process.env.MEXC_SECRET_KEY = 'env-secret-key';
      process.env.MEXC_BASE_URL = 'https://env.mexc.com';

      clientCore = new MexcClientCore();

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[MexcClientCore] Initialized with config:',
        expect.objectContaining({
          hasApiKey: true,
          hasSecretKey: true,
          baseUrl: 'https://env.mexc.com',
        })
      );
    });

    it('should prioritize config over environment variables', () => {
      process.env.MEXC_API_KEY = 'env-api-key';
      process.env.MEXC_SECRET_KEY = 'env-secret-key';

      clientCore = new MexcClientCore({
        apiKey: 'config-api-key',
        secretKey: 'config-secret-key',
      });

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[MexcClientCore] Initialized with config:',
        expect.objectContaining({
          hasApiKey: true,
          hasSecretKey: true,
        })
      );
    });

    it('should initialize cache with correct capacity', () => {
      const { MexcRequestCache } = require('../../../../src/services/api/mexc-request-cache');
      
      clientCore = new MexcClientCore();

      expect(MexcRequestCache).toHaveBeenCalledWith(1000);
    });
  });

  describe('Credential Management', () => {
    it('should return true when credentials are present', () => {
      clientCore = new MexcClientCore({
        apiKey: 'test-key',
        secretKey: 'test-secret',
      });

      expect(clientCore.hasCredentials()).toBe(true);
    });

    it('should return false when credentials are missing', () => {
      clientCore = new MexcClientCore();

      expect(clientCore.hasCredentials()).toBe(false);
    });

    it('should return false when only API key is present', () => {
      clientCore = new MexcClientCore({
        apiKey: 'test-key',
      });

      expect(clientCore.hasCredentials()).toBe(false);
    });

    it('should return false when only secret key is present', () => {
      clientCore = new MexcClientCore({
        secretKey: 'test-secret',
      });

      expect(clientCore.hasCredentials()).toBe(false);
    });
  });

  describe('Configuration Management', () => {
    it('should return safe configuration without credentials', () => {
      clientCore = new MexcClientCore({
        apiKey: 'secret-key',
        secretKey: 'secret-secret',
        baseUrl: 'https://api.mexc.com',
        timeout: 5000,
      });

      const config = clientCore.getConfig();

      expect(config).toEqual({
        baseUrl: 'https://api.mexc.com',
        timeout: 5000,
        maxRetries: 3,
        retryDelay: 1000,
        rateLimitDelay: 100,
        enableCaching: true,
        cacheTTL: 60000,
      });
      expect(config).not.toHaveProperty('apiKey');
      expect(config).not.toHaveProperty('secretKey');
    });
  });

  describe('Cache Management', () => {
    beforeEach(() => {
      clientCore = new MexcClientCore();
    });

    it('should get cache statistics', () => {
      const stats = clientCore.getCacheStats();

      expect(stats).toEqual({
        hits: 5,
        misses: 10,
        size: 15,
      });
      expect(mockCache.getStats).toHaveBeenCalled();
    });

    it('should clear cache', () => {
      clientCore.clearCache();

      expect(mockCache.clear).toHaveBeenCalled();
    });
  });

  describe('Connectivity Testing', () => {
    beforeEach(() => {
      clientCore = new MexcClientCore();
    });

    it('should test connectivity successfully', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({}),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await clientCore.testConnectivity();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ status: 'connected' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mexc.com/api/v3/ping',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'MEXC-Sniper-Bot-Unified/1.0',
          }),
        })
      );
    });

    it('should handle connectivity test failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await clientCore.testConnectivity();

      expect(result.success).toBe(false);
      expect(result.data).toEqual({ status: 'failed' });
      expect(result.error).toBe('Network error');
    });

    it('should get server time successfully', async () => {
      const mockServerTime = { serverTime: 1640995200000 };
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockServerTime),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await clientCore.getServerTime();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockServerTime);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mexc.com/api/v3/time',
        expect.any(Object)
      );
    });
  });

  describe('Public Requests', () => {
    beforeEach(() => {
      clientCore = new MexcClientCore();
    });

    it('should make successful public request', async () => {
      const mockData = { symbol: 'BTCUSDT', price: '50000' };
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockData),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // Access protected method via type assertion
      const result = await (clientCore as any).makeRequest('/api/v3/ticker/price', { symbol: 'BTCUSDT' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(result.cached).toBe(false);
      expect(result.requestId).toMatch(/^req_\d+_\d+$/);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mexc.com/api/v3/ticker/price?symbol=BTCUSDT',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'MEXC-Sniper-Bot-Unified/1.0',
          }),
        })
      );
    });

    it('should handle API error responses', async () => {
      const errorResponse = { code: -1001, msg: 'Invalid symbol' };
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: vi.fn().mockResolvedValue(JSON.stringify(errorResponse)),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await (clientCore as any).makeRequest('/api/v3/ticker/price', { symbol: 'INVALID' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid symbol');
      expect(result.requestId).toBeDefined();
    });

    it('should handle network errors with retry', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network connection failed'))
        .mockRejectedValueOnce(new Error('Network connection failed'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: vi.fn().mockResolvedValue({ status: 'ok' }),
        });

      const promise = (clientCore as any).makeRequest('/api/v3/ping');
      
      // Advance timers to complete retry delays
      vi.advanceTimersByTime(1000);
      vi.advanceTimersByTime(2000);
      
      const result = await promise;

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent network error'));

      const promise = (clientCore as any).makeRequest('/api/v3/ping');
      
      // Advance timers to complete all retry delays
      vi.advanceTimersByTime(1000);
      vi.advanceTimersByTime(2000);
      vi.advanceTimersByTime(4000);
      
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Persistent network error');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';
      mockFetch.mockRejectedValue(timeoutError);

      const promise = (clientCore as any).makeRequest('/api/v3/ping');
      
      // Advance timers to complete retry delays
      vi.advanceTimersByTime(1000);
      vi.advanceTimersByTime(2000);
      vi.advanceTimersByTime(4000);
      
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout after 10000ms');
    });
  });

  describe('Authenticated Requests', () => {
    beforeEach(() => {
      clientCore = new MexcClientCore({
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
      });
    });

    it('should make successful authenticated GET request (account endpoint)', async () => {
      const mockData = { balances: [] };
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockData),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await (clientCore as any).makeRequest('/api/v3/account', {}, true);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v3/account'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-MEXC-APIKEY': 'test-api-key',
            'User-Agent': 'MEXC-Sniper-Bot-Unified/1.0',
          }),
        })
      );

      // Verify signature generation was called
      expect(crypto.createHmac).toHaveBeenCalledWith('sha256', 'test-secret-key');
    });

    it('should make successful authenticated POST request (trading endpoint)', async () => {
      const mockData = { orderId: '12345', status: 'NEW' };
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockData),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await (clientCore as any).makeRequest('/api/v3/order', {
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 1.0,
      }, true);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.mexc.com/api/v3/order',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-MEXC-APIKEY': 'test-api-key',
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
          body: expect.any(String),
        })
      );
    });

    it('should throw error for authenticated request without credentials', async () => {
      const clientWithoutCreds = new MexcClientCore();

      const result = await (clientWithoutCreds as any).makeRequest('/api/v3/account', {}, true);

      expect(result.success).toBe(false);
      expect(result.error).toContain('MEXC API credentials not configured');
    });

    it('should not cache authenticated requests', async () => {
      const mockData = { balances: [] };
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockData),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await (clientCore as any).makeRequest('/api/v3/account', {}, true);

      expect(mockCache.set).not.toHaveBeenCalled();
    });
  });

  describe('Caching Behavior', () => {
    beforeEach(() => {
      clientCore = new MexcClientCore({ enableCaching: true });
    });

    it('should return cached response when available', async () => {
      const cachedData = { symbol: 'BTCUSDT', price: '50000' };
      mockCache.get.mockReturnValue(cachedData);

      const result = await (clientCore as any).makeRequest('/api/v3/ticker/price', { symbol: 'BTCUSDT' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(cachedData);
      expect(result.cached).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('Cache hit for /api/v3/ticker/price'),
      );
    });

    it('should cache successful responses', async () => {
      const mockData = { symbol: 'BTCUSDT', price: '50000' };
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockData),
      };
      mockFetch.mockResolvedValue(mockResponse);
      mockCache.get.mockReturnValue(null);

      await (clientCore as any).makeRequest('/api/v3/ticker/price', { symbol: 'BTCUSDT' });

      expect(mockCache.set).toHaveBeenCalledWith(
        '/api/v3/ticker/price_{"symbol":"BTCUSDT"}',
        mockData,
        60000
      );
    });

    it('should skip cache when disabled', async () => {
      const clientNoCaching = new MexcClientCore({ enableCaching: false });
      const mockData = { symbol: 'BTCUSDT', price: '50000' };
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockData),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await (clientNoCaching as any).makeRequest('/api/v3/ticker/price', { symbol: 'BTCUSDT' });

      expect(result.cached).toBe(false);
      expect(mockCache.get).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('should skip cache when explicitly requested', async () => {
      const mockData = { symbol: 'BTCUSDT', price: '50000' };
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockData),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await (clientCore as any).makeRequest('/api/v3/ticker/price', { symbol: 'BTCUSDT' }, false, true);

      expect(result.cached).toBe(false);
      expect(mockCache.get).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      clientCore = new MexcClientCore({ rateLimitDelay: 1000 });
    });

    it('should enforce rate limiting between requests', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({}),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // First request
      const startTime = Date.now();
      vi.setSystemTime(startTime);
      const promise1 = (clientCore as any).makeRequest('/api/v3/ping');
      
      // Simulate request completion
      vi.advanceTimersByTime(100);
      await promise1;

      // Second request immediately after
      vi.setSystemTime(startTime + 500); // 500ms later
      const promise2 = (clientCore as any).makeRequest('/api/v3/time');
      
      // Should wait for remaining rate limit delay
      vi.advanceTimersByTime(500); // Complete the rate limit delay
      await promise2;

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not delay when enough time has passed', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({}),
      };
      mockFetch.mockResolvedValue(mockResponse);

      // First request
      const startTime = Date.now();
      vi.setSystemTime(startTime);
      await (clientCore as any).makeRequest('/api/v3/ping');

      // Second request after rate limit delay
      vi.setSystemTime(startTime + 1500); // 1.5 seconds later
      await (clientCore as any).makeRequest('/api/v3/time');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Circuit Breaker Integration', () => {
    beforeEach(() => {
      clientCore = new MexcClientCore();
    });

    it('should use circuit breaker fallback on failure', async () => {
      const { mexcApiBreaker } = require('../../../../src/services/risk/circuit-breaker');
      
      // Mock circuit breaker to trigger fallback
      mexcApiBreaker.execute.mockImplementation(async (fn, fallback) => {
        return await fallback();
      });

      const result = await (clientCore as any).makeRequest('/api/v3/ping');

      expect(result.success).toBe(false);
      expect(result.error).toContain('circuit breaker is open');
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker fallback triggered')
      );
    });
  });

  describe('Signature Generation', () => {
    beforeEach(() => {
      clientCore = new MexcClientCore({
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
      });
    });

    it('should generate signature for authenticated requests', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({}),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await (clientCore as any).makeRequest('/api/v3/account', { test: 'value' }, true);

      expect(crypto.createHmac).toHaveBeenCalledWith('sha256', 'test-secret-key');
    });

    it('should handle missing secret key', async () => {
      const clientNoSecret = new MexcClientCore({
        apiKey: 'test-api-key',
        // No secret key
      });

      const result = await (clientNoSecret as any).makeRequest('/api/v3/account', {}, true);

      expect(result.success).toBe(false);
      expect(result.error).toContain('MEXC secret key not configured');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      clientCore = new MexcClientCore();
    });

    it('should handle non-JSON error responses', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockResolvedValue('Server temporarily unavailable'),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await (clientCore as any).makeRequest('/api/v3/ping');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Server temporarily unavailable');
    });

    it('should handle JSON parsing errors', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const promise = (clientCore as any).makeRequest('/api/v3/ping');
      
      // Advance timers to complete retry delays if needed
      vi.advanceTimersByTime(8000);
      
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid JSON');
    });

    it('should not retry client errors (4xx)', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: vi.fn().mockResolvedValue(JSON.stringify({ code: -1001, msg: 'Invalid symbol' })),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await (clientCore as any).makeRequest('/api/v3/ping');

      expect(result.success).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries for client errors
    });

    it('should handle AbortError as timeout', async () => {
      const abortError = new Error('Request aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      const promise = (clientCore as any).makeRequest('/api/v3/ping');
      
      // Advance timers to complete retry delays
      vi.advanceTimersByTime(8000);
      
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout after 10000ms');
    });
  });

  describe('Request ID Generation', () => {
    beforeEach(() => {
      clientCore = new MexcClientCore();
    });

    it('should generate unique request IDs', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({}),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result1 = await (clientCore as any).makeRequest('/api/v3/ping');
      const result2 = await (clientCore as any).makeRequest('/api/v3/time');

      expect(result1.requestId).toMatch(/^req_\d+_\d+$/);
      expect(result2.requestId).toMatch(/^req_\d+_\d+$/);
      expect(result1.requestId).not.toBe(result2.requestId);
    });

    it('should increment request counter', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({}),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result1 = await (clientCore as any).makeRequest('/api/v3/ping');
      const result2 = await (clientCore as any).makeRequest('/api/v3/time');

      expect(result1.requestId).toMatch(/_1$/);
      expect(result2.requestId).toMatch(/_2$/);
    });
  });
});