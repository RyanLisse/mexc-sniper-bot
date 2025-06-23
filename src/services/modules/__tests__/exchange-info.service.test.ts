/**
 * Exchange Info Service Tests
 * 
 * TDD tests for the modular exchange info service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  ExchangeInfoService, 
  type ExchangeInfoConfig,
  ExchangeInfoSchema,
  ExchangeInfoResponseSchema,
  SymbolFilterSchema,
  createExchangeInfoService,
} from '../exchange-info.service';

describe('ExchangeInfoService', () => {
  let service: ExchangeInfoService;
  let mockApiClient: any;
  let mockCache: any;
  let mockCircuitBreaker: any;
  let mockPerformanceMonitor: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock dependencies
    mockApiClient = {
      get: vi.fn(),
    };

    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
    };

    mockCircuitBreaker = {
      execute: vi.fn().mockImplementation((fn) => fn()),
    };

    mockPerformanceMonitor = {
      recordMetric: vi.fn(),
    };

    const config: ExchangeInfoConfig = {
      apiClient: mockApiClient,
      cache: mockCache,
      circuitBreaker: mockCircuitBreaker,
      performanceMonitor: mockPerformanceMonitor,
      cacheTTL: 60000,
    };

    service = new ExchangeInfoService(config);
  });

  describe('Schema Validation', () => {
    it('should validate ExchangeInfo schema correctly', () => {
      const validExchangeInfo = {
        timezone: 'UTC',
        serverTime: Date.now(),
        symbols: [{
          symbol: 'BTCUSDT',
          status: 'TRADING' as const,
          baseAsset: 'BTC',
          baseAssetPrecision: 8,
          quoteAsset: 'USDT',
          quotePrecision: 2,
          quoteAssetPrecision: 8,
          orderTypes: ['LIMIT' as const, 'MARKET' as const],
        }],
      };

      expect(() => ExchangeInfoSchema.parse(validExchangeInfo)).not.toThrow();
    });

    it('should reject invalid ExchangeInfo', () => {
      const invalidExchangeInfo = {
        timezone: '', // Invalid: empty string
        serverTime: -1, // Invalid: negative timestamp
        symbols: [{
          symbol: '', // Invalid: empty symbol
          status: 'INVALID_STATUS',
          baseAsset: 'BTC',
        }],
      };

      expect(() => ExchangeInfoSchema.parse(invalidExchangeInfo)).toThrow();
    });

    it('should validate SymbolFilter schema correctly', () => {
      const validFilter = {
        symbol: 'BTCUSDT',
        status: 'TRADING' as const,
        isSpotTradingAllowed: true,
      };

      expect(() => SymbolFilterSchema.parse(validFilter)).not.toThrow();
    });
  });

  describe('getExchangeInfo', () => {
    it('should return cached data when available', async () => {
      const cachedResponse = {
        success: true,
        data: {
          timezone: 'UTC',
          serverTime: Date.now(),
          symbols: [],
        },
        cached: true,
        timestamp: Date.now(),
      };

      mockCache.get.mockResolvedValue(cachedResponse);

      const result = await service.getExchangeInfo();

      expect(result).toEqual(cachedResponse);
      expect(mockCache.get).toHaveBeenCalled();
      expect(mockApiClient.get).not.toHaveBeenCalled();
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        'cache_hit',
        1,
        { operation: 'getExchangeInfo', service: 'exchange-info' }
      );
    });

    it('should fetch from API when cache miss', async () => {
      mockCache.get.mockResolvedValue(null);
      mockApiClient.get.mockResolvedValue({
        timezone: 'UTC',
        serverTime: Date.now(),
        symbols: [{
          symbol: 'BTCUSDT',
          status: 'TRADING',
          baseAsset: 'BTC',
          baseAssetPrecision: 8,
          quoteAsset: 'USDT',
          quotePrecision: 2,
          quoteAssetPrecision: 8,
          orderTypes: ['LIMIT', 'MARKET'],
        }],
      });

      const result = await service.getExchangeInfo();

      expect(result.success).toBe(true);
      expect(result.data.symbols).toHaveLength(1);
      expect(result.data.symbols[0].symbol).toBe('BTCUSDT');
      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v3/exchangeInfo');
      expect(mockCache.set).toHaveBeenCalled();
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        'cache_miss',
        1,
        { operation: 'getExchangeInfo', service: 'exchange-info' }
      );
    });

    it('should handle API errors gracefully', async () => {
      mockCache.get.mockResolvedValue(null);
      mockApiClient.get.mockRejectedValue(new Error('API Error'));

      const result = await service.getExchangeInfo();

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
      expect(result.data.symbols).toEqual([]);
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        'error_count',
        1,
        expect.objectContaining({ operation: 'getExchangeInfo' })
      );
    });

    it('should use circuit breaker for API calls', async () => {
      mockCache.get.mockResolvedValue(null);
      mockApiClient.get.mockResolvedValue({
        timezone: 'UTC',
        serverTime: Date.now(),
        symbols: [],
      });

      await service.getExchangeInfo();

      expect(mockCircuitBreaker.execute).toHaveBeenCalled();
    });
  });

  describe('getSymbolTradingRules', () => {
    it('should return specific symbol trading rules', async () => {
      const mockExchangeInfo = {
        success: true,
        data: {
          timezone: 'UTC',
          serverTime: Date.now(),
          symbols: [
            {
              symbol: 'BTCUSDT',
              status: 'TRADING' as const,
              baseAsset: 'BTC',
              baseAssetPrecision: 8,
              quoteAsset: 'USDT',
              quotePrecision: 2,
              quoteAssetPrecision: 8,
              orderTypes: ['LIMIT' as const, 'MARKET' as const],
            },
            {
              symbol: 'ETHUSDT',
              status: 'TRADING' as const,
              baseAsset: 'ETH',
              baseAssetPrecision: 8,
              quoteAsset: 'USDT',
              quotePrecision: 2,
              quoteAssetPrecision: 8,
              orderTypes: ['LIMIT' as const, 'MARKET' as const],
            },
          ],
        },
        timestamp: Date.now(),
      };

      vi.spyOn(service, 'getExchangeInfo').mockResolvedValue(mockExchangeInfo);

      const result = await service.getSymbolTradingRules('BTCUSDT');

      expect(result.success).toBe(true);
      expect(result.data.symbols).toHaveLength(1);
      expect(result.data.symbols[0].symbol).toBe('BTCUSDT');
    });

    it('should handle invalid symbol input', async () => {
      const result = await service.getSymbolTradingRules('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid symbol provided');
      expect(result.data.symbols).toEqual([]);
    });

    it('should return empty result for non-existent symbol', async () => {
      const mockExchangeInfo = {
        success: true,
        data: {
          timezone: 'UTC',
          serverTime: Date.now(),
          symbols: [],
        },
        timestamp: Date.now(),
      };

      vi.spyOn(service, 'getExchangeInfo').mockResolvedValue(mockExchangeInfo);

      const result = await service.getSymbolTradingRules('NONEXISTENT');

      expect(result.success).toBe(true);
      expect(result.data.symbols).toEqual([]);
    });
  });

  describe('getFilteredSymbols', () => {
    const mockExchangeInfo = {
      success: true,
      data: {
        timezone: 'UTC',
        serverTime: Date.now(),
        symbols: [
          {
            symbol: 'BTCUSDT',
            status: 'TRADING' as const,
            baseAsset: 'BTC',
            baseAssetPrecision: 8,
            quoteAsset: 'USDT',
            quotePrecision: 2,
            quoteAssetPrecision: 8,
            orderTypes: ['LIMIT' as const, 'MARKET' as const],
            isSpotTradingAllowed: true,
            isMarginTradingAllowed: false,
          },
          {
            symbol: 'ETHUSDT',
            status: 'TRADING' as const,
            baseAsset: 'ETH',
            baseAssetPrecision: 8,
            quoteAsset: 'USDT',
            quotePrecision: 2,
            quoteAssetPrecision: 8,
            orderTypes: ['LIMIT' as const, 'MARKET' as const],
            isSpotTradingAllowed: true,
            isMarginTradingAllowed: true,
          },
          {
            symbol: 'BTCETH',
            status: 'HALT' as const,
            baseAsset: 'BTC',
            baseAssetPrecision: 8,
            quoteAsset: 'ETH',
            quotePrecision: 8,
            quoteAssetPrecision: 8,
            orderTypes: ['LIMIT' as const],
            isSpotTradingAllowed: false,
            isMarginTradingAllowed: false,
          },
        ],
      },
      timestamp: Date.now(),
    };

    beforeEach(() => {
      vi.spyOn(service, 'getExchangeInfo').mockResolvedValue(mockExchangeInfo);
    });

    it('should filter by symbol', async () => {
      const result = await service.getFilteredSymbols({ symbol: 'BTCUSDT' });

      expect(result.success).toBe(true);
      expect(result.data.symbols).toHaveLength(1);
      expect(result.data.symbols[0].symbol).toBe('BTCUSDT');
    });

    it('should filter by base asset', async () => {
      const result = await service.getFilteredSymbols({ baseAsset: 'BTC' });

      expect(result.success).toBe(true);
      expect(result.data.symbols).toHaveLength(2);
      expect(result.data.symbols.every(s => s.baseAsset === 'BTC')).toBe(true);
    });

    it('should filter by quote asset', async () => {
      const result = await service.getFilteredSymbols({ quoteAsset: 'USDT' });

      expect(result.success).toBe(true);
      expect(result.data.symbols).toHaveLength(2);
      expect(result.data.symbols.every(s => s.quoteAsset === 'USDT')).toBe(true);
    });

    it('should filter by status', async () => {
      const result = await service.getFilteredSymbols({ status: 'TRADING' });

      expect(result.success).toBe(true);
      expect(result.data.symbols).toHaveLength(2);
      expect(result.data.symbols.every(s => s.status === 'TRADING')).toBe(true);
    });

    it('should filter by spot trading allowed', async () => {
      const result = await service.getFilteredSymbols({ isSpotTradingAllowed: true });

      expect(result.success).toBe(true);
      expect(result.data.symbols).toHaveLength(2);
      expect(result.data.symbols.every(s => s.isSpotTradingAllowed === true)).toBe(true);
    });

    it('should filter by margin trading allowed', async () => {
      const result = await service.getFilteredSymbols({ isMarginTradingAllowed: true });

      expect(result.success).toBe(true);
      expect(result.data.symbols).toHaveLength(1);
      expect(result.data.symbols[0].symbol).toBe('ETHUSDT');
    });

    it('should handle multiple filter criteria', async () => {
      const result = await service.getFilteredSymbols({
        quoteAsset: 'USDT',
        status: 'TRADING',
        isSpotTradingAllowed: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.symbols).toHaveLength(2);
    });

    it('should handle validation errors', async () => {
      const invalidFilter = { status: 'INVALID_STATUS' };
      
      const result = await service.getFilteredSymbols(invalidFilter as any);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid enum value');
    });
  });

  describe('getTradingSymbols', () => {
    it('should filter for TRADING status only', async () => {
      const spy = vi.spyOn(service, 'getFilteredSymbols');
      
      await service.getTradingSymbols();
      
      expect(spy).toHaveBeenCalledWith({ status: 'TRADING' });
    });
  });

  describe('getSymbolsByBaseAsset', () => {
    it('should filter by base asset', async () => {
      const spy = vi.spyOn(service, 'getFilteredSymbols');
      
      await service.getSymbolsByBaseAsset('BTC');
      
      expect(spy).toHaveBeenCalledWith({ baseAsset: 'BTC' });
    });

    it('should handle invalid base asset input', async () => {
      const result = await service.getSymbolsByBaseAsset('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid base asset provided');
    });

    it('should convert to uppercase', async () => {
      const spy = vi.spyOn(service, 'getFilteredSymbols');
      
      await service.getSymbolsByBaseAsset('btc');
      
      expect(spy).toHaveBeenCalledWith({ baseAsset: 'BTC' });
    });
  });

  describe('getSymbolsByQuoteAsset', () => {
    it('should filter by quote asset', async () => {
      const spy = vi.spyOn(service, 'getFilteredSymbols');
      
      await service.getSymbolsByQuoteAsset('USDT');
      
      expect(spy).toHaveBeenCalledWith({ quoteAsset: 'USDT' });
    });

    it('should handle invalid quote asset input', async () => {
      const result = await service.getSymbolsByQuoteAsset('');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid quote asset provided');
    });
  });

  describe('clearCache', () => {
    it('should clear exchange info cache', async () => {
      await service.clearCache();

      expect(mockCache.set).toHaveBeenCalledWith('mexc:exchange-info:full', null, 0);
    });

    it('should handle missing cache gracefully', async () => {
      const serviceWithoutCache = new ExchangeInfoService({
        apiClient: mockApiClient,
      });

      await expect(serviceWithoutCache.clearCache()).resolves.toBeUndefined();
    });
  });

  describe('Factory Function', () => {
    it('should create service instance using factory', () => {
      const config: ExchangeInfoConfig = {
        apiClient: mockApiClient,
      };

      const createdService = createExchangeInfoService(config);

      expect(createdService).toBeInstanceOf(ExchangeInfoService);
    });
  });

  describe('Performance Monitoring', () => {
    it('should record response time metrics', async () => {
      mockCache.get.mockResolvedValue(null);
      mockApiClient.get.mockResolvedValue({
        timezone: 'UTC',
        serverTime: Date.now(),
        symbols: [],
      });

      await service.getExchangeInfo();

      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        'response_time',
        expect.any(Number),
        { operation: 'getExchangeInfo', service: 'exchange-info' }
      );
    });

    it('should record cache hit metrics', async () => {
      mockCache.get.mockResolvedValue({
        success: true,
        data: { timezone: 'UTC', serverTime: Date.now(), symbols: [] },
        cached: true,
      });

      await service.getExchangeInfo();

      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        'cache_hit',
        1,
        { operation: 'getExchangeInfo', service: 'exchange-info' }
      );
    });
  });

  describe('Error Handling', () => {
    it('should convert errors to safe error objects', async () => {
      mockCache.get.mockResolvedValue(null);
      const customError = new Error('Custom API Error');
      customError.name = 'CustomError';
      mockApiClient.get.mockRejectedValue(customError);

      const result = await service.getExchangeInfo();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Custom API Error');
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        'error_count',
        1,
        expect.objectContaining({ error: 'CustomError' })
      );
    });
  });
});