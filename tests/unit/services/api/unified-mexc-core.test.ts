/**
 * Unit tests for Unified MEXC Core Module
 * Tests calendar, symbols, market data, activity data, connectivity, and helper methods
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { UnifiedMexcCoreModule } from '../../../../src/services/api/unified-mexc-core';
import type {
  ActivityData,
  ActivityQueryOptionsType,
} from '@/src/schemas/unified/mexc-api-schemas';
import type {
  CalendarEntry,
  MexcServiceResponse,
  SymbolEntry,
} from '../../../../src/services/data/modules/mexc-api-types';
import type { MexcCacheLayer } from '../../../../src/services/data/modules/mexc-cache-layer';
import type { MexcCoreClient } from '../../../../src/services/data/modules/mexc-core-client';

describe('Unified MEXC Core Module', () => {
  let mockConsole: any;
  let coreModule: UnifiedMexcCoreModule;
  let mockCoreClient: jest.Mocked<MexcCoreClient>;
  let mockCacheLayer: jest.Mocked<MexcCacheLayer>;

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

    // Mock core client
    mockCoreClient = {
      getCalendarListings: vi.fn(),
      getSymbolsByVcoinId: vi.fn(),
      getAllSymbols: vi.fn(),
      getServerTime: vi.fn(),
      getSymbolInfoBasic: vi.fn(),
      getActivityData: vi.fn(),
    } as any;

    // Mock cache layer
    mockCacheLayer = {
      getOrSet: vi.fn(),
      getOrSetWithCustomTTL: vi.fn(),
    } as any;

    coreModule = new UnifiedMexcCoreModule(mockCoreClient, mockCacheLayer);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should create core module with dependencies', () => {
      expect(coreModule).toBeDefined();
      expect(coreModule).toBeInstanceOf(UnifiedMexcCoreModule);
    });

    it('should initialize with proper logger', () => {
      // Logger is private, but we can test it indirectly through methods that use it
      expect(coreModule).toBeDefined();
    });
  });

  describe('Calendar & Listings', () => {
    describe('getCalendarListings', () => {
      it('should fetch calendar listings successfully', async () => {
        const mockCalendarData: CalendarEntry[] = [
          {
            id: 'cal-1',
            name: 'Bitcoin Listing',
            symbol: 'BTC',
            date: '2024-01-01T00:00:00Z',
            status: 'active',
          },
        ];

        const mockResponse: MexcServiceResponse<CalendarEntry[]> = {
          success: true,
          data: mockCalendarData,
          timestamp: Date.now(),
          source: 'test',
        };

        mockCacheLayer.getOrSet.mockResolvedValue(mockResponse);

        const result = await coreModule.getCalendarListings();

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockCalendarData);
        expect(mockCacheLayer.getOrSet).toHaveBeenCalledWith(
          'calendar:listings',
          expect.any(Function),
          'semiStatic'
        );
      });

      it('should handle calendar listings fetch error', async () => {
        const error = new Error('Calendar fetch failed');
        mockCacheLayer.getOrSet.mockRejectedValue(error);

        const result = await coreModule.getCalendarListings();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Calendar fetch failed');
        expect(result.source).toBe('unified-mexc-core');
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[unified-mexc-core]',
          'Calendar listings fetch error:',
          expect.objectContaining({
            error: 'Calendar fetch failed',
            operationType: 'calendar-fetch',
          })
        );
      });

      it('should handle non-Error exceptions', async () => {
        mockCacheLayer.getOrSet.mockRejectedValue('String error');

        const result = await coreModule.getCalendarListings();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Calendar listings fetch failed');
      });
    });
  });

  describe('Symbols & Market Data', () => {
    describe('getSymbolsByVcoinId', () => {
      it('should fetch symbols by vcoin ID', async () => {
        const mockSymbols: SymbolEntry[] = [
          { symbol: 'BTCUSDT', vcoinId: 'btc-id', status: 'TRADING' },
        ];

        const mockResponse: MexcServiceResponse<SymbolEntry[]> = {
          success: true,
          data: mockSymbols,
          timestamp: Date.now(),
          source: 'test',
        };

        mockCacheLayer.getOrSet.mockResolvedValue(mockResponse);

        const result = await coreModule.getSymbolsByVcoinId('btc-id');

        expect(result).toEqual(mockResponse);
        expect(mockCacheLayer.getOrSet).toHaveBeenCalledWith(
          'symbols:btc-id',
          expect.any(Function),
          'semiStatic'
        );
      });
    });

    describe('getAllSymbols', () => {
      it('should fetch all symbols', async () => {
        const mockSymbols: SymbolEntry[] = [
          { symbol: 'BTCUSDT', vcoinId: 'btc-id', status: 'TRADING' },
          { symbol: 'ETHUSDT', vcoinId: 'eth-id', status: 'TRADING' },
        ];

        const mockResponse: MexcServiceResponse<SymbolEntry[]> = {
          success: true,
          data: mockSymbols,
          timestamp: Date.now(),
          source: 'test',
        };

        mockCacheLayer.getOrSet.mockResolvedValue(mockResponse);

        const result = await coreModule.getAllSymbols();

        expect(result).toEqual(mockResponse);
        expect(mockCacheLayer.getOrSet).toHaveBeenCalledWith(
          'symbols:all',
          expect.any(Function),
          'semiStatic'
        );
      });
    });

    describe('getServerTime', () => {
      it('should fetch server time successfully', async () => {
        const mockTime = Date.now();
        const mockResponse: MexcServiceResponse<number> = {
          success: true,
          data: mockTime,
          timestamp: Date.now(),
          source: 'test',
        };

        mockCacheLayer.getOrSet.mockResolvedValue(mockResponse);

        const result = await coreModule.getServerTime();

        expect(result).toEqual(mockResponse);
        expect(mockCacheLayer.getOrSet).toHaveBeenCalledWith(
          'server:time',
          expect.any(Function),
          'realTime'
        );
        expect(mockConsole.debug).toHaveBeenCalledWith(
          '[unified-mexc-core]',
          'Server time fetched',
          expect.objectContaining({
            serverTime: mockTime,
            localTime: expect.any(Number),
            timeDiff: expect.any(Number),
          })
        );
      });

      it('should handle server time fetch error', async () => {
        const error = new Error('Server time unavailable');
        mockCacheLayer.getOrSet.mockRejectedValue(error);

        const result = await coreModule.getServerTime();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Server time unavailable');
        expect(result.source).toBe('unified-mexc-core');
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[unified-mexc-core]',
          'Server time fetch error:',
          expect.objectContaining({
            error: 'Server time unavailable',
            operationType: 'server-time-fetch',
          })
        );
      });
    });

    describe('getSymbolInfoBasic', () => {
      it('should fetch basic symbol info', async () => {
        const mockSymbolInfo = { symbol: 'BTCUSDT', price: '50000' };
        const mockResponse: MexcServiceResponse<Record<string, unknown>> = {
          success: true,
          data: mockSymbolInfo,
          timestamp: Date.now(),
          source: 'test',
        };

        mockCacheLayer.getOrSet.mockResolvedValue(mockResponse);

        const result = await coreModule.getSymbolInfoBasic('BTCUSDT');

        expect(result).toEqual(mockResponse);
        expect(mockCacheLayer.getOrSet).toHaveBeenCalledWith(
          'symbol:basic:BTCUSDT',
          expect.any(Function),
          'semiStatic'
        );
      });
    });

    describe('getSymbolData', () => {
      it('should fetch symbol data (alias for getSymbolInfoBasic)', async () => {
        const mockSymbolData = { symbol: 'ETHUSDT', price: '3000' };
        const mockResponse: MexcServiceResponse<Record<string, unknown>> = {
          success: true,
          data: mockSymbolData,
          timestamp: Date.now(),
          source: 'test',
        };

        mockCacheLayer.getOrSet.mockResolvedValue(mockResponse);

        const result = await coreModule.getSymbolData('ETHUSDT');

        expect(result).toEqual(mockResponse);
        expect(mockCacheLayer.getOrSet).toHaveBeenCalledWith(
          'symbol:data:ETHUSDT',
          expect.any(Function),
          'semiStatic'
        );
      });
    });
  });

  describe('Activity Data Operations', () => {
    describe('getActivityData', () => {
      it('should fetch activity data successfully', async () => {
        const mockActivityData: ActivityData[] = [
          {
            activityId: 'act-1',
            currency: 'BTC',
            currencyId: 'btc-id',
            activityType: 'TRADE',
            timestamp: Date.now(),
            amount: 1.5,
            price: 50000,
            volume: 75000,
            significance: 0.8,
          },
        ];

        const mockResponse: MexcServiceResponse<ActivityData[]> = {
          success: true,
          data: mockActivityData,
          timestamp: Date.now(),
          source: 'test',
          cached: false,
          executionTimeMs: 100,
        };

        mockCacheLayer.getOrSetWithCustomTTL.mockResolvedValue(mockResponse);

        const result = await coreModule.getActivityData('btc');

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockActivityData);
        expect(mockCacheLayer.getOrSetWithCustomTTL).toHaveBeenCalledWith(
          'activity:BTC',
          expect.any(Function),
          undefined
        );
      });

      it('should handle activity data validation error', async () => {
        const result = await coreModule.getActivityData('');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid currency');
        expect(result.source).toBe('unified-mexc-core');
      });

      it('should handle currency normalization', async () => {
        const mockResponse: MexcServiceResponse<ActivityData[]> = {
          success: true,
          data: [],
          timestamp: Date.now(),
          source: 'test',
        };

        mockCacheLayer.getOrSetWithCustomTTL.mockImplementation(async (key, fn) => {
          await fn();
          return mockResponse;
        });

        await coreModule.getActivityData('  btc  ');

        expect(mockCacheLayer.getOrSetWithCustomTTL).toHaveBeenCalledWith(
          'activity:BTC',
          expect.any(Function),
          undefined
        );
      });

      it('should handle cache layer error', async () => {
        const error = new Error('Cache error');
        mockCacheLayer.getOrSetWithCustomTTL.mockRejectedValue(error);

        const result = await coreModule.getActivityData('BTC');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Cache error');
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[unified-mexc-core]',
          'Activity data validation error:',
          expect.objectContaining({
            error: 'Cache error',
            operationType: 'validation',
          })
        );
      });

      it('should handle Zod validation errors', async () => {
        const result = await coreModule.getActivityData('this-is-a-very-long-currency-name-that-exceeds-the-maximum-allowed-length');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid currency');
        expect(result.error).toContain('Currency too long');
      });
    });

    describe('getBulkActivityData', () => {
      it('should process bulk activity data successfully', async () => {
        const currencies = ['BTC', 'ETH', 'ADA'];
        const mockResponses: MexcServiceResponse<ActivityData[]>[] = currencies.map(currency => ({
          success: true,
          data: [{
            activityId: `${currency}-act`,
            currency,
            currencyId: `${currency.toLowerCase()}-id`,
            activityType: 'TRADE',
            timestamp: Date.now(),
            amount: 1,
            price: 1000,
            volume: 1000,
            significance: 0.5,
          }],
          timestamp: Date.now(),
          source: 'test',
        }));

        // Mock individual getActivityData calls
        mockCacheLayer.getOrSetWithCustomTTL
          .mockResolvedValueOnce(mockResponses[0])
          .mockResolvedValueOnce(mockResponses[1])
          .mockResolvedValueOnce(mockResponses[2]);

        const result = await coreModule.getBulkActivityData(currencies);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(3);
        expect(result.metadata).toMatchObject({
          totalRequests: 3,
          successCount: 3,
          failureCount: 0,
          batchCount: 1,
          batchSize: 10,
        });
        expect(mockConsole.info).toHaveBeenCalledWith(
          '[unified-mexc-core]',
          'Processing bulk activity data for 3 currencies',
          ''
        );
      });

      it('should handle large batch processing with optimized flow', async () => {
        const currencies = Array.from({ length: 60 }, (_, i) => `COIN${i}`);
        const mockResponses = currencies.map(currency => ({
          success: true,
          data: [],
          timestamp: Date.now(),
          source: 'test',
        }));

        // Mock all the individual calls
        currencies.forEach((_, index) => {
          mockCacheLayer.getOrSetWithCustomTTL.mockResolvedValueOnce(mockResponses[index]);
        });

        const result = await coreModule.getBulkActivityData(currencies);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(60);
        expect(result.metadata?.optimizedProcessing).toBe(true);
        expect(result.metadata?.batchSize).toBe(10); // Concurrency limit
        expect(mockConsole.debug).toHaveBeenCalledWith(
          '[unified-mexc-core]',
          'Large batch detected (60), using optimized processing',
          ''
        );
      });

      it('should handle bulk processing with custom options', async () => {
        const currencies = ['BTC', 'ETH'];
        const options: ActivityQueryOptionsType = {
          batchSize: 1,
          maxRetries: 2,
          rateLimitDelay: 50,
        };

        const mockResponses = currencies.map(currency => ({
          success: true,
          data: [],
          timestamp: Date.now(),
          source: 'test',
        }));

        mockCacheLayer.getOrSetWithCustomTTL
          .mockResolvedValueOnce(mockResponses[0])
          .mockResolvedValueOnce(mockResponses[1]);

        const result = await coreModule.getBulkActivityData(currencies, options);

        expect(result.success).toBe(true);
        expect(result.metadata?.batchSize).toBe(1);
      });

      it('should handle validation errors in bulk processing', async () => {
        const result = await coreModule.getBulkActivityData([]);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid bulk request');
        expect(result.error).toContain('At least one currency required');
      });

      it('should handle too many currencies', async () => {
        const tooManyCurrencies = Array.from({ length: 150 }, (_, i) => `COIN${i}`);

        const result = await coreModule.getBulkActivityData(tooManyCurrencies);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Too many currencies');
      });

      it('should handle mixed success and failure responses', async () => {
        const currencies = ['BTC', 'INVALID', 'ETH'];
        
        mockCacheLayer.getOrSetWithCustomTTL
          .mockResolvedValueOnce({
            success: true,
            data: [],
            timestamp: Date.now(),
            source: 'test',
          })
          .mockResolvedValueOnce({
            success: false,
            error: 'Invalid currency',
            timestamp: Date.now(),
            source: 'test',
          })
          .mockResolvedValueOnce({
            success: true,
            data: [],
            timestamp: Date.now(),
            source: 'test',
          });

        const result = await coreModule.getBulkActivityData(currencies);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(3);
        expect(result.metadata?.successCount).toBe(2);
        expect(result.metadata?.failureCount).toBe(1);
      });

      it('should handle general bulk processing error', async () => {
        const error = new Error('Bulk processing failed');
        mockCacheLayer.getOrSetWithCustomTTL.mockRejectedValue(error);

        const result = await coreModule.getBulkActivityData(['BTC']);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Bulk processing failed');
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[unified-mexc-core]',
          'Bulk activity data error:',
          expect.objectContaining({
            error: 'Bulk processing failed',
            operationType: 'bulk-processing',
          })
        );
      });
    });

    describe('hasRecentActivity', () => {
      it('should return true for recent activity', async () => {
        const mockResponse: MexcServiceResponse<ActivityData[]> = {
          success: true,
          data: [],
          timestamp: Date.now(), // Current timestamp
          source: 'test',
        };

        mockCacheLayer.getOrSetWithCustomTTL.mockResolvedValue(mockResponse);

        const result = await coreModule.hasRecentActivity('BTC');

        expect(result).toBe(true);
      });

      it('should return false for old activity', async () => {
        const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
        const mockResponse: MexcServiceResponse<ActivityData[]> = {
          success: true,
          data: [],
          timestamp: oldTimestamp,
          source: 'test',
        };

        mockCacheLayer.getOrSetWithCustomTTL.mockResolvedValue(mockResponse);

        const result = await coreModule.hasRecentActivity('BTC');

        expect(result).toBe(false);
      });

      it('should return false for failed activity fetch', async () => {
        const mockResponse: MexcServiceResponse<ActivityData[]> = {
          success: false,
          error: 'Failed to fetch',
          timestamp: Date.now(),
          source: 'test',
        };

        mockCacheLayer.getOrSetWithCustomTTL.mockResolvedValue(mockResponse);

        const result = await coreModule.hasRecentActivity('BTC');

        expect(result).toBe(false);
      });

      it('should handle custom timeframe', async () => {
        const recentTimestamp = Date.now() - (30 * 60 * 1000); // 30 minutes ago
        const mockResponse: MexcServiceResponse<ActivityData[]> = {
          success: true,
          data: [],
          timestamp: recentTimestamp,
          source: 'test',
        };

        mockCacheLayer.getOrSetWithCustomTTL.mockResolvedValue(mockResponse);

        const result = await coreModule.hasRecentActivity('BTC', 60 * 60 * 1000); // 1 hour timeframe

        expect(result).toBe(true);
      });

      it('should handle exceptions gracefully', async () => {
        mockCacheLayer.getOrSetWithCustomTTL.mockRejectedValue(new Error('Network error'));

        const result = await coreModule.hasRecentActivity('BTC');

        expect(result).toBe(false);
        expect(mockConsole.warn).toHaveBeenCalledWith(
          '[unified-mexc-core]',
          'Failed to check recent activity for BTC:',
          expect.objectContaining({
            currency: 'BTC',
            error: 'Network error',
          })
        );
      });
    });
  });

  describe('Multi-Symbol Operations', () => {
    describe('getSymbolsForVcoins', () => {
      it('should fetch symbols for multiple vcoins successfully', async () => {
        const vcoinIds = ['btc-id', 'eth-id'];
        const mockResponses = [
          {
            success: true,
            data: [{ symbol: 'BTCUSDT', vcoinId: 'btc-id', status: 'TRADING' }],
            timestamp: Date.now(),
            source: 'test',
          },
          {
            success: true,
            data: [{ symbol: 'ETHUSDT', vcoinId: 'eth-id', status: 'TRADING' }],
            timestamp: Date.now(),
            source: 'test',
          },
        ];

        mockCacheLayer.getOrSet
          .mockResolvedValueOnce(mockResponses[0])
          .mockResolvedValueOnce(mockResponses[1]);

        const result = await coreModule.getSymbolsForVcoins(vcoinIds);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
        expect(result.data![0].symbol).toBe('BTCUSDT');
        expect(result.data![1].symbol).toBe('ETHUSDT');
      });

      it('should handle partial failures in multi-vcoin fetch', async () => {
        const vcoinIds = ['btc-id', 'invalid-id'];
        const mockResponses = [
          {
            success: true,
            data: [{ symbol: 'BTCUSDT', vcoinId: 'btc-id', status: 'TRADING' }],
            timestamp: Date.now(),
            source: 'test',
          },
          {
            success: false,
            error: 'Invalid vcoin ID',
            timestamp: Date.now(),
            source: 'test',
          },
        ];

        mockCacheLayer.getOrSet
          .mockResolvedValueOnce(mockResponses[0])
          .mockResolvedValueOnce(mockResponses[1]);

        const result = await coreModule.getSymbolsForVcoins(vcoinIds);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1); // Only successful results
      });

      it('should handle complete failure in multi-vcoin fetch', async () => {
        const vcoinIds = ['invalid-1', 'invalid-2'];
        const mockResponses = [
          {
            success: false,
            error: 'Invalid vcoin ID',
            timestamp: Date.now(),
            source: 'test',
          },
          {
            success: false,
            error: 'Invalid vcoin ID',
            timestamp: Date.now(),
            source: 'test',
          },
        ];

        mockCacheLayer.getOrSet
          .mockResolvedValueOnce(mockResponses[0])
          .mockResolvedValueOnce(mockResponses[1]);

        const result = await coreModule.getSymbolsForVcoins(vcoinIds);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid vcoin ID');
      });
    });

    describe('getSymbolsData', () => {
      it('should return all symbols (alias for getAllSymbols)', async () => {
        const mockSymbols: SymbolEntry[] = [
          { symbol: 'BTCUSDT', vcoinId: 'btc-id', status: 'TRADING' },
        ];

        const mockResponse: MexcServiceResponse<SymbolEntry[]> = {
          success: true,
          data: mockSymbols,
          timestamp: Date.now(),
          source: 'test',
        };

        mockCacheLayer.getOrSet.mockResolvedValue(mockResponse);

        const result = await coreModule.getSymbolsData();

        expect(result).toEqual(mockResponse);
        expect(mockCacheLayer.getOrSet).toHaveBeenCalledWith(
          'symbols:all',
          expect.any(Function),
          'semiStatic'
        );
      });
    });
  });

  describe('Connectivity & Status', () => {
    describe('testConnectivity', () => {
      it('should test connectivity successfully', async () => {
        const mockServerTime = Date.now();
        const mockServerTimeResponse: MexcServiceResponse<number> = {
          success: true,
          data: mockServerTime,
          timestamp: Date.now(),
          source: 'test',
        };

        mockCacheLayer.getOrSet.mockResolvedValue(mockServerTimeResponse);

        const result = await coreModule.testConnectivity();

        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
          serverTime: mockServerTime,
          latency: expect.any(Number),
        });
        expect(mockConsole.info).toHaveBeenCalledWith(
          '[unified-mexc-core]',
          'Connectivity test successful',
          expect.objectContaining({
            latency: expect.any(Number),
            serverTime: mockServerTime,
            operationType: 'connectivity-test',
          })
        );
      });

      it('should handle connectivity test failure', async () => {
        const mockServerTimeResponse: MexcServiceResponse<number> = {
          success: false,
          error: 'Server unavailable',
          timestamp: Date.now(),
          source: 'test',
        };

        mockCacheLayer.getOrSet.mockResolvedValue(mockServerTimeResponse);

        const result = await coreModule.testConnectivity();

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to connect to MEXC API');
        expect(result.error).toContain('Server unavailable');
        expect(mockConsole.warn).toHaveBeenCalledWith(
          '[unified-mexc-core]',
          'Connectivity test failed - server time unavailable',
          expect.objectContaining({
            error: 'Server unavailable',
            operationType: 'connectivity-test',
          })
        );
      });

      it('should handle connectivity test timeout', async () => {
        vi.useFakeTimers();
        
        // Mock a promise that never resolves to trigger timeout
        mockCacheLayer.getOrSet.mockImplementation(() => 
          new Promise(resolve => setTimeout(resolve, 40000))
        );

        const connectivityPromise = coreModule.testConnectivity();
        
        // Advance timers to trigger timeout
        vi.advanceTimersByTime(35000);
        
        const result = await connectivityPromise;

        expect(result.success).toBe(false);
        expect(result.error).toBe('Connectivity test timeout');
        
        vi.useRealTimers();
      });

      it('should handle connectivity test exception', async () => {
        const error = new Error('Network error');
        mockCacheLayer.getOrSet.mockRejectedValue(error);

        const result = await coreModule.testConnectivity();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Network error');
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[unified-mexc-core]',
          'Connectivity test error:',
          expect.objectContaining({
            error: 'Network error',
            operationType: 'connectivity-test',
          })
        );
      });
    });

    describe('testConnectivityWithResponse', () => {
      it('should test connectivity with detailed response', async () => {
        const mockServerTime = Date.now();
        const mockServerTimeResponse: MexcServiceResponse<number> = {
          success: true,
          data: mockServerTime,
          timestamp: Date.now(),
          source: 'test',
        };

        mockCacheLayer.getOrSet.mockResolvedValue(mockServerTimeResponse);

        const result = await coreModule.testConnectivityWithResponse();

        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
          serverTime: mockServerTime,
          latency: expect.any(Number),
          connected: true,
          apiVersion: 'v3',
          region: 'global',
        });
      });

      it('should handle detailed connectivity test failure', async () => {
        const mockServerTimeResponse: MexcServiceResponse<number> = {
          success: false,
          error: 'API down',
          timestamp: Date.now(),
          source: 'test',
        };

        mockCacheLayer.getOrSet.mockResolvedValue(mockServerTimeResponse);

        const result = await coreModule.testConnectivityWithResponse();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to connect to MEXC API');
      });

      it('should handle detailed connectivity test exception', async () => {
        const error = new Error('Connection failed');
        mockCacheLayer.getOrSet.mockRejectedValue(error);

        const result = await coreModule.testConnectivityWithResponse();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Connection failed');
      });
    });
  });

  describe('Private Helper Methods', () => {
    describe('Data Normalization', () => {
      it('should normalize activity data correctly', async () => {
        const rawActivityData = [
          {
            id: 'act-1',
            currencyCode: 'BTC',
            vcoinId: 'btc-id',
            type: 'TRADE',
            timestamp: Date.now(),
            amount: 1.5,
            price: 50000,
            volume: 75000,
            significance: 0.8,
          },
        ];

        const mockResponse = {
          success: true,
          data: rawActivityData,
          timestamp: Date.now(),
          source: 'test',
        };

        mockCacheLayer.getOrSetWithCustomTTL.mockImplementation(async (key, fn) => {
          const result = await fn();
          return result;
        });

        mockCoreClient.getActivityData.mockResolvedValue(mockResponse);

        const result = await coreModule.getActivityData('BTC');

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data![0]).toMatchObject({
          activityId: 'act-1',
          currency: 'BTC',
          currencyId: 'btc-id',
          activityType: 'TRADE',
          timestamp: expect.any(Number),
          amount: 1.5,
          price: 50000,
          volume: 75000,
          significance: 0.8,
        });
      });

      it('should handle malformed activity data', async () => {
        const malformedData = [
          null,
          'invalid-string',
          { invalid: 'object' },
          { id: null, currency: 123 },
        ];

        const mockResponse = {
          success: true,
          data: malformedData,
          timestamp: Date.now(),
          source: 'test',
        };

        mockCacheLayer.getOrSetWithCustomTTL.mockImplementation(async (key, fn) => {
          const result = await fn();
          return result;
        });

        mockCoreClient.getActivityData.mockResolvedValue(mockResponse);

        const result = await coreModule.getActivityData('BTC');

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1); // Only valid entries should remain
        expect(result.data![0]).toMatchObject({
          activityId: expect.any(String),
          currency: '',
          activityType: 'UNKNOWN',
        });
      });

      it('should handle empty activity data', async () => {
        const mockResponse = {
          success: true,
          data: null,
          timestamp: Date.now(),
          source: 'test',
        };

        mockCacheLayer.getOrSetWithCustomTTL.mockImplementation(async (key, fn) => {
          const result = await fn();
          return result;
        });

        mockCoreClient.getActivityData.mockResolvedValue(mockResponse);

        const result = await coreModule.getActivityData('BTC');

        expect(result.success).toBe(true);
        expect(result.data).toEqual([]);
      });
    });

    describe('Retry Mechanism', () => {
      it('should handle retry mechanism in bulk processing', async () => {
        const currencies = ['BTC'];
        
        // First call fails, second succeeds
        mockCacheLayer.getOrSetWithCustomTTL
          .mockRejectedValueOnce(new Error('Temporary failure'))
          .mockResolvedValueOnce({
            success: true,
            data: [],
            timestamp: Date.now(),
            source: 'test',
          });

        const result = await coreModule.getBulkActivityData(currencies, {
          batchSize: 1,
          maxRetries: 2,
          rateLimitDelay: 10,
        });

        expect(result.success).toBe(true);
        expect(result.metadata?.successCount).toBe(1);
      });
    });

    describe('Utility Methods', () => {
      it('should handle array chunking', async () => {
        const currencies = ['A', 'B', 'C', 'D', 'E'];
        
        currencies.forEach(() => {
          mockCacheLayer.getOrSetWithCustomTTL.mockResolvedValueOnce({
            success: true,
            data: [],
            timestamp: Date.now(),
            source: 'test',
          });
        });

        const result = await coreModule.getBulkActivityData(currencies, {
          batchSize: 2,
          maxRetries: 0,
          rateLimitDelay: 0,
        });

        expect(result.success).toBe(true);
        expect(result.metadata?.batchSize).toBe(2);
        expect(result.metadata?.batchCount).toBe(3); // Math.ceil(5/2)
      });

      it('should handle delay functionality', async () => {
        vi.useFakeTimers();
        
        const currencies = ['BTC', 'ETH'];
        const startTime = Date.now();
        
        currencies.forEach(() => {
          mockCacheLayer.getOrSetWithCustomTTL.mockResolvedValueOnce({
            success: true,
            data: [],
            timestamp: Date.now(),
            source: 'test',
          });
        });

        const resultPromise = coreModule.getBulkActivityData(currencies, {
          batchSize: 1,
          maxRetries: 0,
          rateLimitDelay: 100,
        });

        // Advance timers to process delays
        vi.advanceTimersByTime(200);
        
        const result = await resultPromise;

        expect(result.success).toBe(true);
        
        vi.useRealTimers();
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle non-Error exceptions', async () => {
      mockCacheLayer.getOrSet.mockRejectedValue('String error');

      const result = await coreModule.getCalendarListings();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Calendar listings fetch failed');
    });

    it('should handle undefined cache layer responses', async () => {
      mockCacheLayer.getOrSet.mockResolvedValue(undefined as any);

      const result = await coreModule.getAllSymbols();

      expect(result).toBeUndefined();
    });

    it('should handle empty string currency in activity data', async () => {
      const result = await coreModule.getActivityData('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Currency cannot be empty');
    });

    it('should handle mixed data types in bulk processing', async () => {
      const currencies = ['BTC', null as any, undefined as any, ''];
      
      const result = await coreModule.getBulkActivityData(currencies);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid bulk request');
    });

    it('should handle extreme batch sizes', async () => {
      const currencies = ['BTC'];
      
      mockCacheLayer.getOrSetWithCustomTTL.mockResolvedValue({
        success: true,
        data: [],
        timestamp: Date.now(),
        source: 'test',
      });

      const result = await coreModule.getBulkActivityData(currencies, {
        batchSize: 25, // Above max allowed
        maxRetries: 10, // Above max allowed
        rateLimitDelay: 2000, // Above max allowed
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid bulk request');
    });
  });
});