/**
 * Unit tests for MexcMarketDataClient
 * Tests market data retrieval, calendar listings, symbol information, price data, caching, and connectivity
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  MexcMarketDataClient,
} from '@/services/api/mexc-market-data';
import type {
  CalendarEntry,
  ExchangeSymbol,
  SymbolEntry,
  Ticker,
  UnifiedMexcConfig,
  UnifiedMexcResponse,
} from '@/services/api/mexc-client-types';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '@utils/timeout-utilities';

// Mock dependencies
vi.mock('@/services/risk/mexc-error-recovery-service', () => ({
  getGlobalErrorRecoveryService: vi.fn(() => ({
    executeWithRecovery: vi.fn(),
  })),
}));

vi.mock('../../../../src/services/api/mexc-client-types', () => ({
  CalendarEntrySchema: {
    parse: vi.fn((data) => data),
  },
  ExchangeSymbolSchema: {
    parse: vi.fn((data) => data),
  },
  SymbolEntrySchema: {
    parse: vi.fn((data) => data),
  },
  TickerSchema: {
    parse: vi.fn((data) => data),
  },
}));

describe('MexcMarketDataClient', () => {
  let marketDataClient: MexcMarketDataClient;
  let mockErrorRecoveryService: any;
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

    // Setup mock error recovery service
    mockErrorRecoveryService = {
      executeWithRecovery: vi.fn(),
    };
    const { getGlobalErrorRecoveryService } = require('../../../../src/services/risk/mexc-error-recovery-service');
    getGlobalErrorRecoveryService.mockReturnValue(mockErrorRecoveryService);

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
    };

    marketDataClient = new MexcMarketDataClient(mockConfig);
    
    // Mock the makeRequest method
    (marketDataClient as any).makeRequest = vi.fn();
  });

  afterEach(async () => {
    // TIMEOUT ELIMINATION: Ensure all promises are flushed before cleanup
    await flushPromises();
    vi.restoreAllMocks();
  
  });

  describe('Constructor', () => {
    it('should create market data client with configuration', () => {
      expect(marketDataClient).toBeDefined();
      expect(marketDataClient).toBeInstanceOf(MexcMarketDataClient);
    });

    it('should extend MexcClientCore', () => {
      expect(marketDataClient.constructor.name).toBe('MexcMarketDataClient');
    });

    it('should initialize cache properties', () => {
      expect(marketDataClient.getCachedSymbolsCount()).toBe(0);
      expect(marketDataClient.isExchangeCacheValid()).toBe(false);
    });
  });

  describe('Calendar Listings', () => {
    describe('getCalendarListings', () => {
      it('should get calendar listings successfully with newCoins structure', async () => {
        const mockCalendarData = {
          data: {
            newCoins: [
              {
                vcoinId: 'TESTCOIN',
                vcoinName: 'TEST',
                vcoinNameFull: 'Test Coin',
                firstOpenTime: 1640995200000,
              },
              {
                vcoinId: 'ANOTHERCOIN',
                vcoinName: 'ANOTHER',
                vcoinNameFull: 'Another Coin',
                firstOpenTime: 1641081600000,
              },
            ],
          },
        };

        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: mockCalendarData,
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getCalendarListings();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
        expect(result.data[0]).toMatchObject({
          vcoinId: 'TESTCOIN',
          symbol: 'TEST',
          projectName: 'Test Coin',
          firstOpenTime: 1640995200000,
        });
        expect((marketDataClient as any).makeRequest).toHaveBeenCalledWith(
          expect.stringContaining('https://www.mexc.com/api/operation/new_coin_calendar?timestamp=')
        );
      });

      it('should get calendar listings with fallback data structure', async () => {
        const mockCalendarData = {
          data: [
            {
              vcoinId: 'TESTCOIN',
              symbol: 'TEST',
              projectName: 'Test Coin',
              firstOpenTime: 1640995200000,
            },
          ],
        };

        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: mockCalendarData,
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getCalendarListings();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toMatchObject({
          vcoinId: 'TESTCOIN',
          symbol: 'TEST',
          projectName: 'Test Coin',
          firstOpenTime: 1640995200000,
        });
      });

      it('should handle API request failure', async () => {
        const mockResponse: UnifiedMexcResponse<any> = {
          success: false,
          data: null,
          error: 'Network error',
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getCalendarListings();

        expect(result.success).toBe(false);
        expect(result.data).toEqual([]);
        expect(result.error).toBe('Network error');
      });

      it('should handle empty calendar data', async () => {
        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: { data: { newCoins: [] } },
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getCalendarListings();

        expect(result.success).toBe(true);
        expect(result.data).toEqual([]);
      });

      it('should filter out invalid calendar entries', async () => {
        const mockCalendarData = {
          data: {
            newCoins: [
              {
                vcoinId: 'VALID',
                vcoinName: 'VALID',
                firstOpenTime: 1640995200000,
              },
              {
                vcoinId: '', // Invalid - empty vcoinId
                vcoinName: 'INVALID',
                firstOpenTime: 1640995200000,
              },
              {
                vcoinId: 'VALID2',
                vcoinName: 'VALID2',
                // Missing firstOpenTime
              },
            ],
          },
        };

        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: mockCalendarData,
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getCalendarListings();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data[0].vcoinId).toBe('VALID');
      });

      it('should handle schema validation errors', async () => {
        const { CalendarEntrySchema } = require('../../../../src/services/api/mexc-client-types');
        CalendarEntrySchema.parse.mockImplementation(() => {
          throw new Error('Schema validation failed');
        });

        const mockCalendarData = {
          data: {
            newCoins: [
              {
                vcoinId: 'TEST',
                vcoinName: 'TEST',
                firstOpenTime: 1640995200000,
              },
            ],
          },
        };

        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: mockCalendarData,
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getCalendarListings();

        expect(result.success).toBe(true);
        expect(result.data).toEqual([]); // Invalid entries filtered out
        expect(mockConsole.warn).toHaveBeenCalledWith(
          '[MexcMarketData] Invalid calendar entry:',
          expect.any(Object)
        );
      });

      it('should handle exceptions gracefully', async () => {
        (marketDataClient as any).makeRequest.mockRejectedValue(new Error('Network timeout'));

        const result = await marketDataClient.getCalendarListings();

        expect(result.success).toBe(false);
        expect(result.data).toEqual([]);
        expect(result.error).toBe('Network timeout');
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[MexcMarketData] Calendar listings failed:',
          expect.any(Error)
        );
      });

      it('should handle non-Error thrown values', async () => {
        (marketDataClient as any).makeRequest.mockRejectedValue('String error');

        const result = await marketDataClient.getCalendarListings();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Unknown error');
      });
    });
  });

  describe('Symbol Information', () => {
    describe('getSymbolsV2', () => {
      it('should get symbols data successfully', async () => {
        const mockSymbolsData = {
          data: {
            symbols: [
              {
                cd: 'BTCUSDT',
                sts: 1,
                st: 1,
                tt: 1,
                ca: { symbol: 'BTC' },
                ps: { precision: 8 },
                qs: { precision: 2 },
                ot: { status: 'active' },
              },
              {
                cd: 'ETHUSDT',
                sts: 1,
                st: 1,
                tt: 1,
                ca: { symbol: 'ETH' },
                ps: { precision: 8 },
                qs: { precision: 2 },
                ot: { status: 'active' },
              },
            ],
          },
        };

        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: mockSymbolsData,
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getSymbolsV2();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
        expect(result.data[0]).toMatchObject({
          cd: 'BTCUSDT',
          sts: 1,
          st: 1,
          tt: 1,
        });
        expect((marketDataClient as any).makeRequest).toHaveBeenCalledWith(
          '/api/platform/spot/market-v2/web/symbolsV2'
        );
      });

      it('should filter symbols by vcoinId when provided', async () => {
        const mockSymbolsData = {
          data: {
            symbols: [
              {
                cd: 'BTCUSDT',
                sts: 1,
                st: 1,
                tt: 1,
                ca: {},
                ps: {},
                qs: {},
                ot: {},
              },
              {
                cd: 'ETHUSDT',
                sts: 1,
                st: 1,
                tt: 1,
                ca: {},
                ps: {},
                qs: {},
                ot: {},
              },
            ],
          },
        };

        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: mockSymbolsData,
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getSymbolsV2('BTCUSDT');

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data[0].cd).toBe('BTCUSDT');
      });

      it('should handle API request failure', async () => {
        const mockResponse: UnifiedMexcResponse<any> = {
          success: false,
          data: null,
          error: 'API error',
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getSymbolsV2();

        expect(result.success).toBe(false);
        expect(result.data).toEqual([]);
        expect(result.error).toBe('API error');
      });

      it('should handle invalid symbol entries', async () => {
        const mockSymbolsData = {
          data: {
            symbols: [
              {
                cd: 'VALID',
                sts: 1,
                st: 1,
                tt: 1,
                ca: {},
                ps: {},
                qs: {},
                ot: {},
              },
              {
                // Missing required fields
                cd: '',
                sts: undefined,
              },
            ],
          },
        };

        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: mockSymbolsData,
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getSymbolsV2();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data[0].cd).toBe('VALID');
      });

      it('should handle schema validation errors', async () => {
        const { SymbolEntrySchema } = require('../../../../src/services/api/mexc-client-types');
        SymbolEntrySchema.parse.mockImplementation(() => {
          throw new Error('Schema validation failed');
        });

        const mockSymbolsData = {
          data: {
            symbols: [
              {
                cd: 'TEST',
                sts: 1,
                st: 1,
                tt: 1,
                ca: {},
                ps: {},
                qs: {},
                ot: {},
              },
            ],
          },
        };

        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: mockSymbolsData,
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getSymbolsV2();

        expect(result.success).toBe(false); // No valid symbols
        expect(result.data).toEqual([]);
        expect(mockConsole.warn).toHaveBeenCalledWith(
          '[MexcMarketData] Invalid symbol entry:',
          expect.any(Object)
        );
      });

      it('should handle exceptions gracefully', async () => {
        (marketDataClient as any).makeRequest.mockRejectedValue(new Error('Network error'));

        const result = await marketDataClient.getSymbolsV2();

        expect(result.success).toBe(false);
        expect(result.data).toEqual([]);
        expect(result.error).toBe('Network error');
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[MexcMarketData] Symbols data failed:',
          expect.any(Error)
        );
      });
    });
  });

  describe('Exchange Information', () => {
    describe('getExchangeInfo', () => {
      it('should get exchange info successfully and cache results', async () => {
        const mockExchangeData = {
          symbols: [
            {
              symbol: 'BTCUSDT',
              status: '1',
              baseAsset: 'BTC',
              quoteAsset: 'USDT',
              baseAssetPrecision: 8,
              quotePrecision: 2,
              quoteAssetPrecision: 2,
            },
            {
              symbol: 'ETHUSDT',
              status: '1',
              baseAsset: 'ETH',
              quoteAsset: 'USDT',
              baseAssetPrecision: 8,
              quotePrecision: 2,
              quoteAssetPrecision: 2,
            },
            {
              symbol: 'BTCETH',
              status: '1',
              baseAsset: 'BTC',
              quoteAsset: 'ETH', // Filtered out - not USDT
              baseAssetPrecision: 8,
              quotePrecision: 2,
              quoteAssetPrecision: 2,
            },
          ],
        };

        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: mockExchangeData,
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getExchangeInfo();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2); // Only USDT pairs
        expect(result.data[0].symbol).toBe('BTCUSDT');
        expect(result.data[1].symbol).toBe('ETHUSDT');
        expect(marketDataClient.getCachedSymbolsCount()).toBe(2);
        expect(marketDataClient.isExchangeCacheValid()).toBe(true);
        expect((marketDataClient as any).makeRequest).toHaveBeenCalledWith('/api/v3/exchangeInfo');
      });

      it('should return cached data when cache is valid', async () => {
        // First request - populate cache
        const mockExchangeData = {
          symbols: [
            {
              symbol: 'BTCUSDT',
              status: '1',
              baseAsset: 'BTC',
              quoteAsset: 'USDT',
              baseAssetPrecision: 8,
              quotePrecision: 2,
              quoteAssetPrecision: 2,
            },
          ],
        };

        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: mockExchangeData,
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        await marketDataClient.getExchangeInfo();

        // Second request - should use cache
        (marketDataClient as any).makeRequest.mockClear();
        const cachedResult = await marketDataClient.getExchangeInfo();

        expect(cachedResult.success).toBe(true);
        expect(cachedResult.cached).toBe(true);
        expect(cachedResult.data).toHaveLength(1);
        expect((marketDataClient as any).makeRequest).not.toHaveBeenCalled();
      });

      it('should handle API request failure', async () => {
        const mockResponse: UnifiedMexcResponse<any> = {
          success: false,
          data: null,
          error: 'Exchange info failed',
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getExchangeInfo();

        expect(result.success).toBe(false);
        expect(result.data).toEqual([]);
        expect(result.error).toBe('Exchange info failed');
      });

      it('should handle invalid response structure', async () => {
        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: { symbols: null }, // Invalid - symbols not array
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getExchangeInfo();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid exchange info response');
      });

      it('should filter symbols by status and quote asset', async () => {
        const mockExchangeData = {
          symbols: [
            {
              symbol: 'BTCUSDT',
              status: '1', // Active
              baseAsset: 'BTC',
              quoteAsset: 'USDT',
              baseAssetPrecision: 8,
              quotePrecision: 2,
              quoteAssetPrecision: 2,
            },
            {
              symbol: 'ETHUSDT',
              status: '0', // Inactive - filtered out
              baseAsset: 'ETH',
              quoteAsset: 'USDT',
              baseAssetPrecision: 8,
              quotePrecision: 2,
              quoteAssetPrecision: 2,
            },
          ],
        };

        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: mockExchangeData,
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getExchangeInfo();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data[0].symbol).toBe('BTCUSDT');
      });

      it('should handle schema validation errors', async () => {
        const { ExchangeSymbolSchema } = require('../../../../src/services/api/mexc-client-types');
        ExchangeSymbolSchema.parse.mockImplementation(() => {
          throw new Error('Schema validation failed');
        });

        const mockExchangeData = {
          symbols: [
            {
              symbol: 'BTCUSDT',
              status: '1',
              baseAsset: 'BTC',
              quoteAsset: 'USDT',
              baseAssetPrecision: 8,
              quotePrecision: 2,
              quoteAssetPrecision: 2,
            },
          ],
        };

        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: mockExchangeData,
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getExchangeInfo();

        expect(result.success).toBe(true);
        expect(result.data).toEqual([]); // Invalid symbols filtered out
        expect(mockConsole.warn).toHaveBeenCalledWith(
          '[MexcMarketData] Invalid exchange symbol:',
          expect.any(Object)
        );
      });

      it('should handle exceptions gracefully', async () => {
        (marketDataClient as any).makeRequest.mockRejectedValue(new Error('Network error'));

        const result = await marketDataClient.getExchangeInfo();

        expect(result.success).toBe(false);
        expect(result.data).toEqual([]);
        expect(result.error).toBe('Network error');
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[MexcMarketData] Exchange info failed:',
          expect.any(Error)
        );
      });
    });
  });

  describe('Cache Management', () => {
    describe('clearExchangeCache', () => {
      it('should clear exchange cache', async () => {
        // First populate cache
        const mockExchangeData = {
          symbols: [
            {
              symbol: 'BTCUSDT',
              status: '1',
              baseAsset: 'BTC',
              quoteAsset: 'USDT',
              baseAssetPrecision: 8,
              quotePrecision: 2,
              quoteAssetPrecision: 2,
            },
          ],
        };

        (marketDataClient as any).makeRequest.mockResolvedValue({
          success: true,
          data: mockExchangeData,
          timestamp: new Date().toISOString(),
        });

        await marketDataClient.getExchangeInfo();
        expect(marketDataClient.getCachedSymbolsCount()).toBe(1);
        expect(marketDataClient.isExchangeCacheValid()).toBe(true);

        // Clear cache
        marketDataClient.clearExchangeCache();

        expect(marketDataClient.getCachedSymbolsCount()).toBe(0);
        expect(marketDataClient.isExchangeCacheValid()).toBe(false);
        expect(mockConsole.info).toHaveBeenCalledWith(
          '[MexcMarketData] Exchange symbols cache cleared'
        );
      });
    });

    describe('getCachedSymbolsCount', () => {
      it('should return correct cached symbols count', () => {
        expect(marketDataClient.getCachedSymbolsCount()).toBe(0);
      });
    });

    describe('isExchangeCacheValid', () => {
      it('should return false for invalid cache', () => {
        expect(marketDataClient.isExchangeCacheValid()).toBe(false);
      });
    });
  });

  describe('Price and Ticker Data', () => {
    describe('get24hrTicker', () => {
      it('should get 24hr ticker for specific symbol', async () => {
        const mockTickerData = {
          symbol: 'BTCUSDT',
          lastPrice: '50000.00',
          priceChangePercent: '2.50',
          volume: '1000000',
        };

        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: mockTickerData,
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.get24hrTicker('BTCUSDT');

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toMatchObject(mockTickerData);
        expect((marketDataClient as any).makeRequest).toHaveBeenCalledWith(
          '/api/v3/ticker/24hr?symbol=BTCUSDT'
        );
      });

      it('should get 24hr ticker for all symbols', async () => {
        const mockTickerData = [
          {
            symbol: 'BTCUSDT',
            lastPrice: '50000.00',
            priceChangePercent: '2.50',
            volume: '1000000',
          },
          {
            symbol: 'ETHUSDT',
            lastPrice: '3000.00',
            priceChangePercent: '1.50',
            volume: '500000',
          },
        ];

        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: mockTickerData,
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.get24hrTicker();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
        expect(result.data[0].symbol).toBe('BTCUSDT');
        expect(result.data[1].symbol).toBe('ETHUSDT');
        expect((marketDataClient as any).makeRequest).toHaveBeenCalledWith('/api/v3/ticker/24hr');
      });

      it('should handle API request failure', async () => {
        const mockResponse: UnifiedMexcResponse<any> = {
          success: false,
          data: null,
          error: 'Ticker data failed',
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.get24hrTicker('BTCUSDT');

        expect(result.success).toBe(false);
        expect(result.data).toEqual([]);
        expect(result.error).toBe('Ticker data failed');
      });

      it('should handle schema validation errors', async () => {
        const { TickerSchema } = require('../../../../src/services/api/mexc-client-types');
        TickerSchema.parse.mockImplementation(() => {
          throw new Error('Schema validation failed');
        });

        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: { symbol: 'BTCUSDT' },
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.get24hrTicker('BTCUSDT');

        expect(result.success).toBe(true);
        expect(result.data).toEqual([]); // Invalid tickers filtered out
        expect(mockConsole.warn).toHaveBeenCalledWith(
          '[MexcMarketData] Invalid ticker data:',
          expect.any(Object)
        );
      });

      it('should handle exceptions gracefully', async () => {
        (marketDataClient as any).makeRequest.mockRejectedValue(new Error('Network error'));

        const result = await marketDataClient.get24hrTicker('BTCUSDT');

        expect(result.success).toBe(false);
        expect(result.data).toEqual([]);
        expect(result.error).toBe('Network error');
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[MexcMarketData] 24hr ticker failed:',
          expect.any(Error)
        );
      });
    });

    describe('getPrice', () => {
      it('should get price for specific symbol', async () => {
        const mockPriceData = {
          symbol: 'BTCUSDT',
          price: '50000.00',
        };

        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: mockPriceData,
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getPrice('BTCUSDT');

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toMatchObject(mockPriceData);
        expect((marketDataClient as any).makeRequest).toHaveBeenCalledWith(
          '/api/v3/ticker/price?symbol=BTCUSDT'
        );
      });

      it('should get prices for all symbols', async () => {
        const mockPriceData = [
          {
            symbol: 'BTCUSDT',
            price: '50000.00',
          },
          {
            symbol: 'ETHUSDT',
            price: '3000.00',
          },
        ];

        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: mockPriceData,
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getPrice();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
        expect(result.data[0].symbol).toBe('BTCUSDT');
        expect(result.data[1].symbol).toBe('ETHUSDT');
        expect((marketDataClient as any).makeRequest).toHaveBeenCalledWith('/api/v3/ticker/price');
      });

      it('should handle API request failure', async () => {
        const mockResponse: UnifiedMexcResponse<any> = {
          success: false,
          data: null,
          error: 'Price data failed',
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getPrice('BTCUSDT');

        expect(result.success).toBe(false);
        expect(result.data).toEqual([]);
        expect(result.error).toBe('Price data failed');
      });

      it('should handle exceptions gracefully', async () => {
        (marketDataClient as any).makeRequest.mockRejectedValue(new Error('Network error'));

        const result = await marketDataClient.getPrice('BTCUSDT');

        expect(result.success).toBe(false);
        expect(result.data).toEqual([]);
        expect(result.error).toBe('Network error');
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[MexcMarketData] Price data failed:',
          expect.any(Error)
        );
      });
    });
  });

  describe('Klines Data', () => {
    describe('getKlines', () => {
      it('should get klines data successfully', async () => {
        const mockKlinesData = [
          [1640995200000, '50000.00', '50100.00', '49900.00', '50050.00', '100.0', 1640998799999, '5005000.0', 1000, '50.0', '2502500.0'],
          [1641081600000, '50050.00', '50200.00', '49950.00', '50150.00', '150.0', 1641085199999, '7522500.0', 1500, '75.0', '3761250.0'],
        ];

        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: mockKlinesData,
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getKlines('BTCUSDT', '1d', 500);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
        expect(result.data[0][0]).toBe(1640995200000); // Open time
        expect(result.data[0][1]).toBe('50000.00'); // Open price
        expect((marketDataClient as any).makeRequest).toHaveBeenCalledWith(
          '/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=500'
        );
      });

      it('should get klines with time range parameters', async () => {
        const mockKlinesData = [];

        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: mockKlinesData,
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const startTime = 1640995200000;
        const endTime = 1641081600000;
        
        const result = await marketDataClient.getKlines(
          'BTCUSDT',
          '1h',
          100,
          startTime,
          endTime
        );

        expect(result.success).toBe(true);
        expect((marketDataClient as any).makeRequest).toHaveBeenCalledWith(
          `/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=100&startTime=${startTime}&endTime=${endTime}`
        );
      });

      it('should handle API request failure', async () => {
        const mockResponse: UnifiedMexcResponse<any> = {
          success: false,
          data: null,
          error: 'Klines data failed',
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getKlines('BTCUSDT');

        expect(result.success).toBe(false);
        expect(result.data).toEqual([]);
        expect(result.error).toBe('Klines data failed');
      });

      it('should handle invalid response format', async () => {
        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: { invalid: 'format' }, // Not an array
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getKlines('BTCUSDT');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid klines response format');
      });

      it('should handle exceptions gracefully', async () => {
        (marketDataClient as any).makeRequest.mockRejectedValue(new Error('Network error'));

        const result = await marketDataClient.getKlines('BTCUSDT');

        expect(result.success).toBe(false);
        expect(result.data).toEqual([]);
        expect(result.error).toBe('Network error');
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[MexcMarketData] Klines data failed:',
          expect.any(Error)
        );
      });
    });
  });

  describe('Order Book Data', () => {
    describe('getOrderBook', () => {
      it('should get order book successfully', async () => {
        const mockOrderBookData = {
          bids: [
            ['49900.00', '1.5'],
            ['49850.00', '2.0'],
          ],
          asks: [
            ['50100.00', '1.2'],
            ['50150.00', '1.8'],
          ],
          lastUpdateId: 123456789,
        };

        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: mockOrderBookData,
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getOrderBook('BTCUSDT', 100);

        expect(result.success).toBe(true);
        expect(result.data.bids).toHaveLength(2);
        expect(result.data.asks).toHaveLength(2);
        expect(result.data.lastUpdateId).toBe(123456789);
        expect((marketDataClient as any).makeRequest).toHaveBeenCalledWith(
          '/api/v3/depth?symbol=BTCUSDT&limit=100'
        );
      });

      it('should use default limit when not specified', async () => {
        const mockOrderBookData = {
          bids: [],
          asks: [],
          lastUpdateId: 123456789,
        };

        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: mockOrderBookData,
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getOrderBook('BTCUSDT');

        expect(result.success).toBe(true);
        expect((marketDataClient as any).makeRequest).toHaveBeenCalledWith(
          '/api/v3/depth?symbol=BTCUSDT&limit=100'
        );
      });

      it('should handle API request failure', async () => {
        const mockResponse: UnifiedMexcResponse<any> = {
          success: false,
          data: null,
          error: 'Order book failed',
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getOrderBook('BTCUSDT');

        expect(result.success).toBe(false);
        expect(result.data).toMatchObject({
          bids: [],
          asks: [],
          lastUpdateId: 0,
        });
        expect(result.error).toBe('Order book failed');
      });

      it('should handle invalid response format', async () => {
        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: {
            bids: null, // Invalid format
            asks: [],
          },
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getOrderBook('BTCUSDT');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid order book response format');
      });

      it('should handle missing lastUpdateId', async () => {
        const mockOrderBookData = {
          bids: [['49900.00', '1.5']],
          asks: [['50100.00', '1.2']],
          // Missing lastUpdateId
        };

        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: mockOrderBookData,
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getOrderBook('BTCUSDT');

        expect(result.success).toBe(true);
        expect(result.data.lastUpdateId).toBeGreaterThan(0); // Fallback to timestamp
      });

      it('should handle exceptions gracefully', async () => {
        (marketDataClient as any).makeRequest.mockRejectedValue(new Error('Network error'));

        const result = await marketDataClient.getOrderBook('BTCUSDT');

        expect(result.success).toBe(false);
        expect(result.data).toMatchObject({
          bids: [],
          asks: [],
          lastUpdateId: 0,
        });
        expect(result.error).toBe('Network error');
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[MexcMarketData] Order book fetch failed for BTCUSDT:',
          expect.any(Error)
        );
      });
    });
  });

  describe('Connectivity and Health', () => {
    describe('testConnectivity', () => {
      it('should test connectivity successfully', async () => {
        const mockExecuteResult = {
          success: true,
          data: { success: true },
          requestId: 'test-123',
        };

        mockErrorRecoveryService.executeWithRecovery.mockResolvedValue(mockExecuteResult);

        const result = await marketDataClient.testConnectivity();

        expect(result.success).toBe(true);
        expect(result.data.status).toBe('connected');
        expect(result.requestId).toBe('test-123');
        expect(mockErrorRecoveryService.executeWithRecovery).toHaveBeenCalledWith(
          expect.any(Function),
          undefined,
          'Connectivity Test'
        );
      });

      it('should handle connectivity test failure', async () => {
        const mockExecuteResult = {
          success: false,
          error: 'Connection failed',
        };

        mockErrorRecoveryService.executeWithRecovery.mockResolvedValue(mockExecuteResult);

        const result = await marketDataClient.testConnectivity();

        expect(result.success).toBe(false);
        expect(result.data.status).toBe('failed');
        expect(result.error).toBe('Connection failed');
      });

      it('should handle exceptions gracefully', async () => {
        mockErrorRecoveryService.executeWithRecovery.mockRejectedValue(new Error('Service error'));

        const result = await marketDataClient.testConnectivity();

        expect(result.success).toBe(false);
        expect(result.data.status).toBe('failed');
        expect(result.error).toBe('Service error');
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[MexcMarketData] Connectivity test failed:',
          expect.any(Error)
        );
      });
    });

    describe('getServerTime', () => {
      it('should get server time successfully', async () => {
        const serverTime = Date.now();
        const mockResponse: UnifiedMexcResponse<any> = {
          success: true,
          data: { serverTime },
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getServerTime();

        expect(result.success).toBe(true);
        expect(result.data.serverTime).toBe(serverTime);
        expect((marketDataClient as any).makeRequest).toHaveBeenCalledWith('/api/v3/time');
      });

      it('should handle API request failure with fallback', async () => {
        const mockResponse: UnifiedMexcResponse<any> = {
          success: false,
          data: null,
          error: 'Server time failed',
          timestamp: new Date().toISOString(),
        };

        (marketDataClient as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await marketDataClient.getServerTime();

        expect(result.success).toBe(false);
        expect(result.data.serverTime).toBeGreaterThan(0); // Fallback to local time
        expect(result.error).toBe('Server time failed');
      });

      it('should handle exceptions gracefully', async () => {
        (marketDataClient as any).makeRequest.mockRejectedValue(new Error('Network error'));

        const result = await marketDataClient.getServerTime();

        expect(result.success).toBe(false);
        expect(result.data.serverTime).toBeGreaterThan(0); // Fallback to local time
        expect(result.error).toBe('Network error');
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[MexcMarketData] Failed to get server time:',
          expect.any(Error)
        );
      });
    });
  });
});