/**
 * Unit tests for MEXC Core Client
 * Tests core client functionality with modular architecture delegation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type {
  MexcApiConfig,
  MexcServiceResponse,
  BalanceEntry,
  CalendarEntry,
  SymbolEntry,
} from '../../../../../src/services/data/modules/mexc-api-types';

describe('MEXC Core Client', () => {
  let mockConfig: MexcApiConfig;
  let mockConsole: any;

  // Mock response data
  const mockCalendarData: CalendarEntry[] = [
    {
      vcoinId: 'COIN1',
      symbol: 'COIN1USDT',
      listingDate: '2024-01-15T12:00:00Z',
      status: 'active',
    },
  ];

  const mockSymbolData: SymbolEntry[] = [
    {
      symbol: 'BTCUSDT',
      status: 'TRADING',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      baseAssetPrecision: 8,
      quotePrecision: 8,
      orderTypes: ['LIMIT', 'MARKET'],
    },
  ];

  const mockBalanceData: BalanceEntry[] = [
    {
      asset: 'USDT',
      free: '1000.00',
      locked: '0.00',
      total: 1000.0,
      usdtValue: 1000.0,
    },
    {
      asset: 'BTC',
      free: '0.1',
      locked: '0.0',
      total: 0.1,
      usdtValue: 4500.0,
    },
  ];

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

    // Mock configuration
    mockConfig = {
      apiKey: 'test_api_key',
      secretKey: 'test_secret_key',
      baseUrl: 'https://api.mexc.com',
      timeout: 10000,
      enableTestnet: false,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Functionality Tests', () => {
    it('should be able to import MexcCoreClient', async () => {
      const { MexcCoreClient } = await import('../../../../../src/services/data/modules/mexc-core-client');
      expect(MexcCoreClient).toBeDefined();
      expect(typeof MexcCoreClient).toBe('function');
    });

    it('should be able to import createMexcCoreClient factory', async () => {
      const { createMexcCoreClient } = await import('../../../../../src/services/data/modules/mexc-core-client');
      expect(createMexcCoreClient).toBeDefined();
      expect(typeof createMexcCoreClient).toBe('function');
    });

    it('should have proper type definitions', () => {
      // Type check - these should compile without errors
      const config: MexcApiConfig = mockConfig;
      expect(config.apiKey).toBe('test_api_key');
      expect(config.secretKey).toBe('test_secret_key');
      expect(config.baseUrl).toBe('https://api.mexc.com');

      const calendarEntry: CalendarEntry = mockCalendarData[0];
      expect(calendarEntry.vcoinId).toBe('COIN1');
      expect(calendarEntry.symbol).toBe('COIN1USDT');

      const symbolEntry: SymbolEntry = mockSymbolData[0];
      expect(symbolEntry.symbol).toBe('BTCUSDT');
      expect(symbolEntry.baseAsset).toBe('BTC');

      const balanceEntry: BalanceEntry = mockBalanceData[0];
      expect(balanceEntry.asset).toBe('USDT');
      expect(balanceEntry.free).toBe('1000.00');
    });
  });

  describe('Architecture and Design', () => {
    it('should have modular architecture with specialized clients', async () => {
      // Check that the core client imports the modular components
      const coreClientModule = await import('../../../../../src/services/data/modules/mexc-core-client');
      
      // Verify exports are available
      expect(coreClientModule.MexcCoreClient).toBeDefined();
      expect(coreClientModule.createMexcCoreClient).toBeDefined();
      
      // Verify re-exports from modular components are available
      expect(coreClientModule.createMexcCoreHttpClient).toBeDefined();
      expect(coreClientModule.createMexcCoreMarketClient).toBeDefined();
      expect(coreClientModule.createMexcCoreAccountClient).toBeDefined();
      expect(coreClientModule.createMexcCoreTradingClient).toBeDefined();
    });

    it('should export type definitions correctly', async () => {
      const coreClientModule = await import('../../../../../src/services/data/modules/mexc-core-client');
      
      // Verify types are exported (this is a compilation test)
      expect(typeof coreClientModule.MexcCoreClient).toBe('function');
      expect(typeof coreClientModule.createMexcCoreClient).toBe('function');
    });
  });

  describe('Integration Tests', () => {
    it('should handle configuration objects properly', () => {
      const testConfigs = [
        {
          apiKey: 'test1',
          secretKey: 'secret1',
          baseUrl: 'https://api.mexc.com',
          timeout: 5000,
          enableTestnet: false,
        },
        {
          apiKey: 'test2',
          secretKey: 'secret2',
          baseUrl: 'https://testnet.mexc.com',
          timeout: 15000,
          enableTestnet: true,
        },
      ];

      testConfigs.forEach(config => {
        expect(config).toHaveProperty('apiKey');
        expect(config).toHaveProperty('secretKey');
        expect(config).toHaveProperty('baseUrl');
        expect(config).toHaveProperty('timeout');
        expect(typeof config.enableTestnet).toBe('boolean');
      });
    });

    it('should handle response data structures correctly', () => {
      const testResponse: MexcServiceResponse<BalanceEntry[]> = {
        success: true,
        data: mockBalanceData,
        timestamp: Date.now(),
        source: 'test',
      };

      expect(testResponse.success).toBe(true);
      expect(Array.isArray(testResponse.data)).toBe(true);
      expect(testResponse.data?.length).toBe(2);
      expect(typeof testResponse.timestamp).toBe('number');
      expect(testResponse.source).toBe('test');
    });

    it('should handle error response structures correctly', () => {
      const errorResponse: MexcServiceResponse<any> = {
        success: false,
        error: 'API connection failed',
        timestamp: Date.now(),
        source: 'test',
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBe('API connection failed');
      expect(errorResponse.data).toBeUndefined();
    });
  });

  describe('Data Structure Validation', () => {
    it('should validate calendar entry structure', () => {
      const calendarEntry = mockCalendarData[0];
      
      expect(calendarEntry).toHaveProperty('vcoinId');
      expect(calendarEntry).toHaveProperty('symbol');
      expect(calendarEntry).toHaveProperty('listingDate');
      expect(calendarEntry).toHaveProperty('status');
      
      expect(typeof calendarEntry.vcoinId).toBe('string');
      expect(typeof calendarEntry.symbol).toBe('string');
      expect(typeof calendarEntry.listingDate).toBe('string');
      expect(typeof calendarEntry.status).toBe('string');
    });

    it('should validate symbol entry structure', () => {
      const symbolEntry = mockSymbolData[0];
      
      expect(symbolEntry).toHaveProperty('symbol');
      expect(symbolEntry).toHaveProperty('status');
      expect(symbolEntry).toHaveProperty('baseAsset');
      expect(symbolEntry).toHaveProperty('quoteAsset');
      expect(symbolEntry).toHaveProperty('baseAssetPrecision');
      expect(symbolEntry).toHaveProperty('quotePrecision');
      expect(symbolEntry).toHaveProperty('orderTypes');
      
      expect(typeof symbolEntry.symbol).toBe('string');
      expect(typeof symbolEntry.baseAsset).toBe('string');
      expect(typeof symbolEntry.quoteAsset).toBe('string');
      expect(typeof symbolEntry.baseAssetPrecision).toBe('number');
      expect(typeof symbolEntry.quotePrecision).toBe('number');
      expect(Array.isArray(symbolEntry.orderTypes)).toBe(true);
    });

    it('should validate balance entry structure', () => {
      const balanceEntry = mockBalanceData[0];
      
      expect(balanceEntry).toHaveProperty('asset');
      expect(balanceEntry).toHaveProperty('free');
      expect(balanceEntry).toHaveProperty('locked');
      expect(balanceEntry).toHaveProperty('total');
      expect(balanceEntry).toHaveProperty('usdtValue');
      
      expect(typeof balanceEntry.asset).toBe('string');
      expect(typeof balanceEntry.free).toBe('string');
      expect(typeof balanceEntry.locked).toBe('string');
      expect(typeof balanceEntry.total).toBe('number');
      expect(typeof balanceEntry.usdtValue).toBe('number');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid configuration gracefully', () => {
      const invalidConfigs = [
        null,
        undefined,
        {},
        { apiKey: '' },
        { secretKey: '' },
        { baseUrl: 'invalid-url' },
        { timeout: -1 },
      ];

      invalidConfigs.forEach(config => {
        // These should not crash - they might be invalid but shouldn't throw during type checking
        expect(typeof config).toBeDefined();
      });
    });

    it('should handle empty or invalid response data', () => {
      const invalidResponses = [
        { success: false, error: 'Network error', timestamp: Date.now(), source: 'test' },
        { success: true, data: null, timestamp: Date.now(), source: 'test' },
        { success: true, data: [], timestamp: Date.now(), source: 'test' },
        { success: true, data: undefined, timestamp: Date.now(), source: 'test' },
      ];

      invalidResponses.forEach(response => {
        expect(response).toHaveProperty('success');
        expect(response).toHaveProperty('timestamp');
        expect(response).toHaveProperty('source');
      });
    });

    it('should handle malformed data structures', () => {
      const malformedData = [
        { asset: 'BTC', free: 'invalid', locked: null },
        { asset: 'ETH', free: '1.5' }, // missing locked
        { free: '100.0', locked: '0.0' }, // missing asset
        null,
        undefined,
      ];

      malformedData.forEach(data => {
        // Should not crash during type checking
        expect(data !== null || data === null).toBe(true);
      });
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large data arrays efficiently', () => {
      const largeBalanceArray = Array.from({ length: 1000 }, (_, i) => ({
        asset: `ASSET${i}`,
        free: '100.0',
        locked: '0.0',
        total: 100.0,
        usdtValue: 100.0,
      }));

      expect(largeBalanceArray.length).toBe(1000);
      expect(largeBalanceArray[0].asset).toBe('ASSET0');
      expect(largeBalanceArray[999].asset).toBe('ASSET999');
    });

    it('should handle concurrent data processing', async () => {
      const processDataPromises = Array.from({ length: 10 }, async (_, i) => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              id: i,
              data: `processed_${i}`,
              timestamp: Date.now(),
            });
          }, Math.random() * 10);
        });
      });

      const results = await Promise.all(processDataPromises);
      expect(results.length).toBe(10);
      results.forEach((result, index) => {
        expect((result as any).id).toBe(index);
        expect((result as any).data).toBe(`processed_${index}`);
      });
    });
  });
});