/**
 * TDD Test Suite for MEXC Core Client
 * 
 * Following TDD principles to ensure the core client works correctly
 * before integrating with the larger unified service.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { 
  MexcCoreClient, 
  createMexcCoreClient, 
  getMexcCoreClient, 
  resetMexcCoreClient 
} from './mexc-core-client';
import type { UnifiedMexcConfig } from './mexc-api-types';

describe('MexcCoreClient - TDD', () => {
  let client: MexcCoreClient;
  let mockConfig: UnifiedMexcConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMexcCoreClient();
    
    mockConfig = {
      apiKey: 'test-api-key-123',
      secretKey: 'test-secret-key-456',
      baseUrl: 'https://api.mexc.com',
      timeout: 10000,
      maxRetries: 3,
      retryDelay: 1000,
      rateLimitDelay: 100,
      enableCaching: true,
      cacheTTL: 30000,
      enableCircuitBreaker: true,
      enableMetrics: true,
      enableEnhancedCaching: true,
      enablePerformanceMonitoring: true,
      apiResponseTTL: 1500,
    };

    // Mock fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Client Initialization', () => {
    it('should create client with valid configuration', () => {
      expect(() => {
        client = createMexcCoreClient(mockConfig);
      }).not.toThrow();
      
      expect(client).toBeInstanceOf(MexcCoreClient);
      expect(client.isConfigured()).toBe(true);
    });

    it('should throw error with missing API credentials', () => {
      const invalidConfig = { ...mockConfig, apiKey: '', secretKey: '' };
      
      expect(() => {
        createMexcCoreClient(invalidConfig);
      }).toThrow('MEXC API credentials are required');
    });

    it('should use environment variables as fallback', () => {
      process.env.MEXC_API_KEY = 'env-api-key';
      process.env.MEXC_SECRET_KEY = 'env-secret-key';
      
      const configWithoutKeys = { ...mockConfig };
      delete configWithoutKeys.apiKey;
      delete configWithoutKeys.secretKey;
      
      expect(() => {
        client = createMexcCoreClient(configWithoutKeys);
      }).not.toThrow();
      
      expect(client.isConfigured()).toBe(true);
    });

    it('should merge with default configuration', () => {
      const minimalConfig = {
        apiKey: 'test-key',
        secretKey: 'test-secret',
      };
      
      client = createMexcCoreClient(minimalConfig);
      const config = client.getConfig();
      
      expect(config.baseUrl).toBe('https://api.mexc.com');
      expect(config.timeout).toBe(10000);
      expect(config.maxRetries).toBe(3);
      expect(config.enableCaching).toBe(true);
    });
  });

  describe('Calendar Listings API', () => {
    beforeEach(() => {
      client = createMexcCoreClient(mockConfig);
    });

    it('should fetch calendar listings successfully', async () => {
      // Arrange
      const mockResponse = {
        data: [
          {
            symbol: 'BTCUSDT',
            baseAsset: 'BTC',
            quoteAsset: 'USDT',
            tradingStartTime: Date.now(),
            status: 'TRADING' as const,
          }
        ]
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        headers: new Headers(),
      });

      // Act
      const result = await client.getCalendarListings();

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].symbol).toBe('BTCUSDT');
      expect(result.error).toBeUndefined();
    });

    it('should handle validation errors gracefully', async () => {
      // Arrange - Invalid response data
      const invalidResponse = {
        data: [
          {
            symbol: '', // Invalid: empty symbol
            baseAsset: 'BTC',
            // Missing required fields
          }
        ]
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(invalidResponse),
        headers: new Headers(),
      });

      // Act
      const result = await client.getCalendarListings();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Calendar validation failed');
      expect(result.data).toBeUndefined();
    });

    it('should handle network errors', async () => {
      // Arrange
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      // Act
      const result = await client.getCalendarListings();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(result.data).toBeUndefined();
    });
  });

  describe('Exchange Symbols API', () => {
    beforeEach(() => {
      client = createMexcCoreClient(mockConfig);
    });

    it('should fetch exchange symbols successfully', async () => {
      // Arrange
      const mockResponse = {
        symbols: [
          {
            symbol: 'BTCUSDT',
            status: 'TRADING' as const,
            baseAsset: 'BTC',
            quoteAsset: 'USDT',
          }
        ]
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        headers: new Headers(),
      });

      // Act
      const result = await client.getExchangeSymbols();

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].symbol).toBe('BTCUSDT');
    });
  });

  describe('Ticker API', () => {
    beforeEach(() => {
      client = createMexcCoreClient(mockConfig);
    });

    it('should fetch ticker data successfully', async () => {
      // Arrange
      const mockTicker = {
        symbol: 'BTCUSDT',
        priceChange: '100.00',
        priceChangePercent: '1.23',
        weightedAvgPrice: '45000.00',
        prevClosePrice: '44900.00',
        lastPrice: '45000.00',
        lastQty: '0.1',
        bidPrice: '44999.00',
        bidQty: '0.5',
        askPrice: '45001.00',
        askQty: '0.3',
        openPrice: '44900.00',
        highPrice: '45100.00',
        lowPrice: '44800.00',
        volume: '1000.0',
        quoteVolume: '45000000.00',
        openTime: Date.now() - 86400000,
        closeTime: Date.now(),
        firstId: 1,
        lastId: 1000,
        count: 1000,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTicker),
        headers: new Headers(),
      });

      // Act
      const result = await client.getTicker('BTCUSDT');

      // Assert
      expect(result.success).toBe(true);
      expect(result.data!.symbol).toBe('BTCUSDT');
      expect(result.data!.lastPrice).toBe('45000.00');
    });
  });

  describe('Server Time API', () => {
    beforeEach(() => {
      client = createMexcCoreClient(mockConfig);
    });

    it('should fetch server time successfully', async () => {
      // Arrange
      const mockTime = { serverTime: Date.now() };
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTime),
        headers: new Headers(),
      });

      // Act
      const result = await client.getServerTime();

      // Assert
      expect(result.success).toBe(true);
      expect(result.data!.serverTime).toBe(mockTime.serverTime);
    });
  });

  describe('Error Handling and Resilience', () => {
    beforeEach(() => {
      client = createMexcCoreClient(mockConfig);
    });

    it('should retry on network failures', async () => {
      // Arrange
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Network failure'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ serverTime: Date.now() }),
          headers: new Headers(),
        });
      });

      // Act
      const result = await client.getServerTime();

      // Assert
      expect(callCount).toBe(3);
      expect(result.success).toBe(true);
    });

    it('should handle HTTP error responses', async () => {
      // Arrange
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      // Act
      const result = await client.getCalendarListings();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 400: Bad Request');
    });

    it('should timeout requests appropriately', async () => {
      // Arrange
      global.fetch = vi.fn().mockImplementation(() => 
        new Promise(() => {}) // Never resolves
      );

      // Act & Assert
      await expect(client.getServerTime()).rejects.toThrow();
    });
  });

  describe('Factory Functions', () => {
    it('should create and cache global client instance', () => {
      // Act
      const client1 = getMexcCoreClient(mockConfig);
      const client2 = getMexcCoreClient();

      // Assert
      expect(client1).toBe(client2);
      expect(client1.isConfigured()).toBe(true);
    });

    it('should throw error when accessing uninitialized global client', () => {
      // Act & Assert
      expect(() => getMexcCoreClient()).toThrow(
        'MexcCoreClient not initialized. Call with config first.'
      );
    });

    it('should reset global client instance', () => {
      // Arrange
      getMexcCoreClient(mockConfig);

      // Act
      resetMexcCoreClient();

      // Assert
      expect(() => getMexcCoreClient()).toThrow();
    });
  });
});