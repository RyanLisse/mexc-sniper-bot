/**
 * Unit tests for MEXC Unified Exports
 * Tests unified access to MEXC API functionality, convenience functions, and legacy compatibility
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  // Primary Exports
  MexcServiceLayer,
  getRecommendedMexcService,
  resetMexcService,
  type MexcServiceConfig,
  type ServiceResponse,

  // Type Exports
  type CalendarEntry,
  type SymbolEntry,
  type BalanceEntry,
  type ExchangeSymbol,
  type Ticker,
  type OrderResult,

  // Convenience Functions
  getMexcService,
  createMexcService,
  getMexcClient,
  getEnhancedMexcService,
  resetEnhancedMexcService,
  getUnifiedMexcClient,

  // Legacy Type Aliases
  type UnifiedMexcResponse,
  type AdvancedOrderParameters,

  // Default Export
  default as defaultMexcService,
} from '../../../../src/services/api/mexc-unified-exports';

// Mock dependencies
vi.mock('../../../../src/services/api/mexc-client-factory', () => ({
  getUnifiedMexcClient: vi.fn().mockReturnValue({
    getCalendarListings: vi.fn(),
    getAccountBalances: vi.fn(),
    placeOrder: vi.fn(),
    testConnectivity: vi.fn(),
  }),
}));

vi.mock('../../../../src/services/api/unified-mexc-service-v2', () => ({
  getUnifiedMexcServiceV2: vi.fn().mockReturnValue({
    getMarketData: vi.fn(),
    executeTradeAnalysis: vi.fn(),
    getAdvancedMetrics: vi.fn(),
  }),
  resetUnifiedMexcServiceV2: vi.fn(),
  UnifiedMexcServiceV2: vi.fn().mockImplementation(() => ({
    getMarketData: vi.fn(),
    executeTradeAnalysis: vi.fn(),
  })),
}));

// Import mocked modules
import { getUnifiedMexcClient as mockGetUnifiedMexcClient } from '../../../../src/services/api/mexc-client-factory';
import { 
  getUnifiedMexcServiceV2 as mockGetUnifiedMexcServiceV2,
  resetUnifiedMexcServiceV2 as mockResetUnifiedMexcServiceV2,
  UnifiedMexcServiceV2 as MockUnifiedMexcServiceV2,
} from '../../../../src/services/api/unified-mexc-service-v2';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../../utils/timeout-elimination-helpers';

describe('MEXC Unified Exports', () => {
  let mockConsole: any;

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
  });

  afterEach(async () => {
    // TIMEOUT ELIMINATION: Ensure all promises are flushed before cleanup
    await flushPromises();
    vi.restoreAllMocks();
  
  });

  describe('Primary Exports', () => {
    describe('MexcServiceLayer', () => {
      it('should export UnifiedMexcServiceV2 as MexcServiceLayer', () => {
        expect(MexcServiceLayer).toBe(MockUnifiedMexcServiceV2);
      });

      it('should create service layer instance', () => {
        const serviceLayer = new MexcServiceLayer();
        
        expect(serviceLayer).toBeDefined();
        expect(serviceLayer).toBeInstanceOf(MockUnifiedMexcServiceV2);
      });
    });

    describe('getRecommendedMexcService', () => {
      it('should return unified mexc service v2', () => {
        const config = { apiKey: 'test-key', secretKey: 'test-secret' };
        
        const service = getRecommendedMexcService(config);
        
        expect(mockGetUnifiedMexcServiceV2).toHaveBeenCalledWith(config);
        expect(service).toBeDefined();
      });

      it('should work without config', () => {
        const service = getRecommendedMexcService();
        
        expect(mockGetUnifiedMexcServiceV2).toHaveBeenCalledWith(undefined);
        expect(service).toBeDefined();
      });
    });

    describe('resetMexcService', () => {
      it('should reset unified mexc service v2', () => {
        resetMexcService();
        
        expect(mockResetUnifiedMexcServiceV2).toHaveBeenCalled();
      });
    });

    describe('Type Exports', () => {
      it('should have proper type definitions', () => {
        // Test type existence by creating mock objects
        const calendarEntry: CalendarEntry = {
          vcoinId: 'btc-123',
          symbol: 'BTC',
          projectName: 'Bitcoin',
          firstOpenTime: 1640995200000,
        };

        const symbolEntry: SymbolEntry = {
          cd: 'BTC',
          sts: 1,
          st: 1640995200000,
          tt: 1640995200000,
        };

        const balanceEntry: BalanceEntry = {
          asset: 'BTC',
          free: '1.0',
          locked: '0.0',
          total: 1.0,
        };

        const ticker: Ticker = {
          symbol: 'BTCUSDT',
          lastPrice: '45000',
          price: '45000',
          priceChange: '1000',
          priceChangePercent: '2.27',
          volume: '1000.5',
        };

        const orderResult: OrderResult = {
          success: true,
          orderId: 'order-123',
          symbol: 'BTCUSDT',
          side: 'BUY',
          quantity: '0.001',
          timestamp: '2024-01-01T00:00:00Z',
        };

        expect(calendarEntry.symbol).toBe('BTC');
        expect(symbolEntry.cd).toBe('BTC');
        expect(balanceEntry.asset).toBe('BTC');
        expect(ticker.symbol).toBe('BTCUSDT');
        expect(orderResult.success).toBe(true);
      });

      it('should have service response type', () => {
        const response: ServiceResponse<string> = {
          success: true,
          data: 'test-data',
          timestamp: '2024-01-01T00:00:00Z',
        };

        expect(response.success).toBe(true);
        expect(response.data).toBe('test-data');
      });

      it('should have service config type', () => {
        const config: MexcServiceConfig = {
          apiKey: 'test-key',
          secretKey: 'test-secret',
          timeout: 10000,
          enableCaching: true,
        };

        expect(config.apiKey).toBe('test-key');
        expect(config.timeout).toBe(10000);
      });
    });
  });

  describe('Convenience Functions', () => {
    describe('getMexcService', () => {
      it('should return unified mexc client', () => {
        const config = { apiKey: 'test-key', secretKey: 'test-secret' };
        
        const service = getMexcService(config);
        
        expect(mockGetUnifiedMexcClient).toHaveBeenCalledWith(config);
        expect(service).toBeDefined();
        expect(service.getCalendarListings).toBeDefined();
      });

      it('should work without config', () => {
        const service = getMexcService();
        
        expect(mockGetUnifiedMexcClient).toHaveBeenCalledWith(undefined);
        expect(service).toBeDefined();
      });

      it('should return client with expected methods', () => {
        const service = getMexcService();
        
        expect(service.getCalendarListings).toBeDefined();
        expect(service.getAccountBalances).toBeDefined();
        expect(service.placeOrder).toBeDefined();
        expect(service.testConnectivity).toBeDefined();
      });
    });

    describe('createMexcService', () => {
      it('should create new mexc service instance', () => {
        const config = { apiKey: 'new-key', secretKey: 'new-secret' };
        
        const service = createMexcService(config);
        
        expect(mockGetUnifiedMexcClient).toHaveBeenCalledWith(config);
        expect(service).toBeDefined();
      });

      it('should use empty config by default', () => {
        const service = createMexcService();
        
        expect(mockGetUnifiedMexcClient).toHaveBeenCalledWith({});
        expect(service).toBeDefined();
      });

      it('should handle partial config', () => {
        const partialConfig = { apiKey: 'only-api-key' };
        
        const service = createMexcService(partialConfig);
        
        expect(mockGetUnifiedMexcClient).toHaveBeenCalledWith(partialConfig);
        expect(service).toBeDefined();
      });
    });

    describe('getMexcClient', () => {
      it('should be alias for getMexcService', () => {
        const config = { apiKey: 'client-key', secretKey: 'client-secret' };
        
        const client = getMexcClient(config);
        
        expect(mockGetUnifiedMexcClient).toHaveBeenCalledWith(config);
        expect(client).toBeDefined();
      });

      it('should work without config', () => {
        const client = getMexcClient();
        
        expect(mockGetUnifiedMexcClient).toHaveBeenCalledWith(undefined);
        expect(client).toBeDefined();
      });
    });

    describe('getUnifiedMexcClient', () => {
      it('should return unified mexc client factory', () => {
        const config = { apiKey: 'unified-key', secretKey: 'unified-secret' };
        
        const client = getUnifiedMexcClient(config);
        
        expect(mockGetUnifiedMexcClient).toHaveBeenCalledWith(config);
        expect(client).toBeDefined();
      });

      it('should work without config', () => {
        const client = getUnifiedMexcClient();
        
        expect(mockGetUnifiedMexcClient).toHaveBeenCalledWith(undefined);
        expect(client).toBeDefined();
      });
    });
  });

  describe('Legacy Compatibility Functions', () => {
    describe('getEnhancedMexcService', () => {
      it('should return unified mexc service v2 with deprecation warning', () => {
        const config = { apiKey: 'legacy-key', secretKey: 'legacy-secret' };
        
        const service = getEnhancedMexcService(config);
        
        expect(mockGetUnifiedMexcServiceV2).toHaveBeenCalledWith(config);
        expect(service).toBeDefined();
        expect(mockConsole.warn).toHaveBeenCalledWith(
          'getEnhancedMexcService is deprecated. Use getUnifiedMexcServiceV2 instead.'
        );
      });

      it('should work without config and show warning', () => {
        const service = getEnhancedMexcService();
        
        expect(mockGetUnifiedMexcServiceV2).toHaveBeenCalledWith(undefined);
        expect(service).toBeDefined();
        expect(mockConsole.warn).toHaveBeenCalledWith(
          'getEnhancedMexcService is deprecated. Use getUnifiedMexcServiceV2 instead.'
        );
      });
    });

    describe('resetEnhancedMexcService', () => {
      it('should reset service with deprecation warning', () => {
        resetEnhancedMexcService();
        
        expect(mockResetUnifiedMexcServiceV2).toHaveBeenCalled();
        expect(mockConsole.warn).toHaveBeenCalledWith(
          'resetEnhancedMexcService is deprecated. Use resetUnifiedMexcServiceV2 instead.'
        );
      });
    });
  });

  describe('Legacy Type Aliases', () => {
    it('should support UnifiedMexcResponse type alias', () => {
      const response: UnifiedMexcResponse<number> = {
        success: true,
        data: 42,
        timestamp: '2024-01-01T00:00:00Z',
      };

      expect(response.success).toBe(true);
      expect(response.data).toBe(42);
    });

    it('should support AdvancedOrderParameters type alias', () => {
      const orderParams: AdvancedOrderParameters = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: '0.001',
        price: '45000',
      };

      expect(orderParams.symbol).toBe('BTCUSDT');
      expect(orderParams.side).toBe('BUY');
    });
  });

  describe('Default Export', () => {
    it('should export unified mexc client factory as default', () => {
      expect(defaultMexcService).toBe(mockGetUnifiedMexcClient);
    });

    it('should work as default function', () => {
      const config = { apiKey: 'default-key', secretKey: 'default-secret' };
      
      const service = defaultMexcService(config);
      
      expect(mockGetUnifiedMexcClient).toHaveBeenCalledWith(config);
      expect(service).toBeDefined();
    });
  });

  describe('Integration and Consistency', () => {
    it('should maintain consistent interface across convenience functions', () => {
      const config = { apiKey: 'test-key', secretKey: 'test-secret' };

      const service1 = getMexcService(config);
      const service2 = createMexcService(config);
      const service3 = getMexcClient(config);
      const service4 = getUnifiedMexcClient(config);

      // All should call the same underlying factory
      expect(mockGetUnifiedMexcClient).toHaveBeenCalledTimes(4);
      
      // All should return objects with the same interface
      expect(service1.getCalendarListings).toBeDefined();
      expect(service2.getCalendarListings).toBeDefined();
      expect(service3.getCalendarListings).toBeDefined();
      expect(service4.getCalendarListings).toBeDefined();
    });

    it('should handle configuration consistency', () => {
      const testConfigs = [
        undefined,
        {},
        { apiKey: 'key' },
        { secretKey: 'secret' },
        { apiKey: 'key', secretKey: 'secret' },
      ];

      testConfigs.forEach(config => {
        const service = getMexcService(config);
        expect(service).toBeDefined();
        expect(mockGetUnifiedMexcClient).toHaveBeenCalledWith(config);
      });
    });

    it('should maintain backward compatibility', () => {
      // Test that legacy functions still work
      const config = { apiKey: 'legacy-test', secretKey: 'legacy-secret' };

      const enhancedService = getEnhancedMexcService(config);
      expect(enhancedService).toBeDefined();
      expect(mockConsole.warn).toHaveBeenCalled();

      resetEnhancedMexcService();
      expect(mockResetUnifiedMexcServiceV2).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle undefined config gracefully', () => {
      const service = getMexcService(undefined);
      
      expect(mockGetUnifiedMexcClient).toHaveBeenCalledWith(undefined);
      expect(service).toBeDefined();
    });

    it('should handle empty config object', () => {
      const service = createMexcService({});
      
      expect(mockGetUnifiedMexcClient).toHaveBeenCalledWith({});
      expect(service).toBeDefined();
    });

    it('should handle config with undefined values', () => {
      const config = { 
        apiKey: undefined as any, 
        secretKey: undefined as any,
      };
      
      const service = getMexcClient(config);
      
      expect(mockGetUnifiedMexcClient).toHaveBeenCalledWith(config);
      expect(service).toBeDefined();
    });

    it('should handle multiple calls to deprecated functions', () => {
      getEnhancedMexcService();
      getEnhancedMexcService();
      resetEnhancedMexcService();
      resetEnhancedMexcService();

      expect(mockConsole.warn).toHaveBeenCalledTimes(4);
    });
  });

  describe('Type Safety and TypeScript Integration', () => {
    it('should maintain type safety across exports', () => {
      // Test that all exported types can be used together
      const config: MexcServiceConfig = {
        apiKey: 'type-test-key',
        secretKey: 'type-test-secret',
      };

      const service = getMexcService(config);
      
      // Should maintain type safety
      expect(service).toBeDefined();
      expect(typeof service.getCalendarListings).toBe('function');
    });

    it('should support generic response types', () => {
      const stringResponse: ServiceResponse<string> = {
        success: true,
        data: 'test',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const numberResponse: ServiceResponse<number> = {
        success: true,
        data: 42,
        timestamp: '2024-01-01T00:00:00Z',
      };

      const arrayResponse: ServiceResponse<string[]> = {
        success: true,
        data: ['a', 'b', 'c'],
        timestamp: '2024-01-01T00:00:00Z',
      };

      expect(stringResponse.data).toBe('test');
      expect(numberResponse.data).toBe(42);
      expect(arrayResponse.data).toEqual(['a', 'b', 'c']);
    });

    it('should support complex type compositions', () => {
      const complexResponse: ServiceResponse<CalendarEntry[]> = {
        success: true,
        data: [
          {
            vcoinId: 'btc-123',
            symbol: 'BTC',
            projectName: 'Bitcoin',
            firstOpenTime: 1640995200000,
          },
        ],
        timestamp: '2024-01-01T00:00:00Z',
      };

      expect(complexResponse.data?.[0]?.symbol).toBe('BTC');
    });
  });
});