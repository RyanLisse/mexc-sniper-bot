/**
 * Unit tests for Unified MEXC Portfolio Module (Refactored)
 * Tests portfolio service interface implementation, utility classes, price fetching, calculations, and error handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  UnifiedMexcPortfolioModuleRefactored,
} from '../../../../src/services/api/unified-mexc-portfolio-refactored';
import type { BalanceEntry, MexcServiceResponse } from '../../../../src/services/data/modules/mexc-api-types';
import type { MexcCacheLayer } from '../../../../src/services/data/modules/mexc-cache-layer';
import type { MexcCoreClient } from '../../../../src/services/data/modules/mexc-core-client';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../../utils/timeout-utilities';

describe('Unified MEXC Portfolio Module (Refactored)', () => {
  let portfolioModule: UnifiedMexcPortfolioModuleRefactored;
  let mockCoreClient: any;
  let mockCacheLayer: any;
  let mockConsole: any;

  // Mock data
  const mockBalanceData = [
    { asset: 'USDT', free: '1000.0', locked: '100.0' },
    { asset: 'BTC', free: '0.1', locked: '0.0' },
    { asset: 'ETH', free: '2.5', locked: '0.5' },
    { asset: 'BNB', free: '10.0', locked: '0.0' },
  ];

  const mockTickerData = [
    { symbol: 'BTCUSDT', lastPrice: '45000.00', priceChangePercent: '2.5' },
    { symbol: 'ETHUSDT', lastPrice: '3000.00', priceChangePercent: '1.8' },
    { symbol: 'BNBUSDT', lastPrice: '400.00', priceChangePercent: '-0.5' },
  ];

  const mockEnhancedBalances: BalanceEntry[] = [
    {
      asset: 'USDT',
      free: '1000.0',
      locked: '100.0',
      total: 1100.0,
      usdtValue: 1100.0,
    },
    {
      asset: 'BTC',
      free: '0.1',
      locked: '0.0',
      total: 0.1,
      usdtValue: 4500.0,
    },
    {
      asset: 'ETH',
      free: '2.5',
      locked: '0.5',
      total: 3.0,
      usdtValue: 9000.0,
    },
    {
      asset: 'BNB',
      free: '10.0',
      locked: '0.0',
      total: 10.0,
      usdtValue: 4000.0,
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

    // Create mock core client
    mockCoreClient = {
      getAccountBalance: vi.fn(),
      getAllTickers: vi.fn(),
    };

    // Create mock cache layer
    mockCacheLayer = {
      getOrSet: vi.fn(),
    };

    // Setup default successful responses
    mockCoreClient.getAccountBalance.mockResolvedValue({
      success: true,
      data: mockBalanceData,
      timestamp: Date.now(),
      source: 'test',
    });

    mockCoreClient.getAllTickers.mockResolvedValue({
      success: true,
      data: mockTickerData,
      timestamp: Date.now(),
      source: 'test',
    });

    mockCacheLayer.getOrSet.mockImplementation(async (key, fn) => {
      return await fn();
    });

    portfolioModule = new UnifiedMexcPortfolioModuleRefactored(
      mockCoreClient,
      mockCacheLayer
    );
  });

  afterEach(async () => {
    // TIMEOUT ELIMINATION: Ensure all promises are flushed before cleanup
    await flushPromises();
    vi.restoreAllMocks();
  
  });

  describe('Constructor', () => {
    it('should create portfolio module with required dependencies', () => {
      expect(portfolioModule).toBeDefined();
      expect(portfolioModule).toBeInstanceOf(UnifiedMexcPortfolioModuleRefactored);
    });

    it('should initialize with core client and cache layer', () => {
      const newModule = new UnifiedMexcPortfolioModuleRefactored(
        mockCoreClient,
        mockCacheLayer
      );
      
      expect(newModule).toBeDefined();
    });
  });

  describe('PortfolioService Interface Implementation', () => {
    describe('getAccountBalance', () => {
      it('should get account balance successfully', async () => {
        const result = await portfolioModule.getAccountBalance();

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data?.length).toBeGreaterThan(0);
        
        // Verify balance structure
        const balance = result.data?.[0];
        expect(balance).toHaveProperty('asset');
        expect(balance).toHaveProperty('free');
        expect(balance).toHaveProperty('locked');
        expect(balance).toHaveProperty('total');
        expect(balance).toHaveProperty('usdtValue');
      });

      it('should handle core client failure gracefully', async () => {
        mockCoreClient.getAccountBalance.mockResolvedValue({
          success: false,
          error: 'API connection failed',
          timestamp: Date.now(),
          source: 'test',
        });

        const result = await portfolioModule.getAccountBalance();

        expect(result.success).toBe(false);
        expect(result.error).toBe('API connection failed');
      });

      it('should handle exceptions in account balance retrieval', async () => {
        mockCoreClient.getAccountBalance.mockRejectedValue(new Error('Network timeout'));

        const result = await portfolioModule.getAccountBalance();

        expect(result.success).toBe(false);
        expect(result.error).toContain('Network timeout');
      });
    });

    describe('getAccountBalances', () => {
      it('should get account balances with comprehensive data', async () => {
        const result = await portfolioModule.getAccountBalances();

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data).toHaveProperty('balances');
        expect(result.data).toHaveProperty('totalUsdtValue');
        expect(result.data).toHaveProperty('totalValue');
        expect(result.data).toHaveProperty('totalValueBTC');
        expect(result.data).toHaveProperty('allocation');
        expect(result.data).toHaveProperty('performance24h');

        expect(Array.isArray(result.data?.balances)).toBe(true);
        expect(typeof result.data?.totalUsdtValue).toBe('number');
        expect(typeof result.data?.totalValueBTC).toBe('number');
        expect(typeof result.data?.allocation).toBe('object');
        expect(typeof result.data?.performance24h).toBe('object');
      });

      it('should handle empty balance data', async () => {
        mockCoreClient.getAccountBalance.mockResolvedValue({
          success: true,
          data: [],
          timestamp: Date.now(),
          source: 'test',
        });

        const result = await portfolioModule.getAccountBalances();

        expect(result.success).toBe(true);
        expect(result.data?.balances).toEqual([]);
        expect(result.data?.totalUsdtValue).toBe(0);
        expect(result.data?.totalValueBTC).toBe(0);
        expect(result.data?.allocation).toEqual({});
        expect(result.data?.performance24h).toEqual({ change: 0, changePercent: 0 });
      });

      it('should calculate portfolio metrics correctly', async () => {
        // Mock with known values for predictable calculations
        const knownBalances = [
          { asset: 'USDT', free: '1000.0', locked: '0.0' },
          { asset: 'BTC', free: '0.1', locked: '0.0' },
        ];

        mockCoreClient.getAccountBalance.mockResolvedValue({
          success: true,
          data: knownBalances,
          timestamp: Date.now(),
          source: 'test',
        });

        const result = await portfolioModule.getAccountBalances();

        expect(result.success).toBe(true);
        expect(result.data?.balances).toHaveLength(2);
        expect(result.data?.totalUsdtValue).toBeGreaterThan(0);
        
        // Check allocation percentages sum to 100 (approximately)
        const allocation = result.data?.allocation || {};
        const totalAllocation = Object.values(allocation).reduce((sum, percent) => sum + percent, 0);
        expect(totalAllocation).toBeCloseTo(100, 0);
      });
    });

    describe('getAccountInfo', () => {
      it('should get account info successfully', async () => {
        const result = await portfolioModule.getAccountInfo();

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data).toHaveProperty('accountType');
        expect(result.data).toHaveProperty('canTrade');
        expect(result.data).toHaveProperty('canWithdraw');
        expect(result.data).toHaveProperty('canDeposit');
        expect(result.data).toHaveProperty('balances');

        expect(result.data?.accountType).toBe('SPOT');
        expect(result.data?.canTrade).toBe(true);
        expect(result.data?.canWithdraw).toBe(true);
        expect(result.data?.canDeposit).toBe(true);
        expect(Array.isArray(result.data?.balances)).toBe(true);
      });

      it('should handle balance retrieval failure in account info', async () => {
        mockCoreClient.getAccountBalance.mockResolvedValue({
          success: false,
          error: 'Balance fetch failed',
          timestamp: Date.now(),
          source: 'test',
        });

        const result = await portfolioModule.getAccountInfo();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Balance fetch failed');
      });
    });

    describe('getTotalPortfolioValue', () => {
      it('should get total portfolio value successfully', async () => {
        const value = await portfolioModule.getTotalPortfolioValue();

        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThanOrEqual(0);
      });

      it('should return 0 on balance retrieval failure', async () => {
        mockCoreClient.getAccountBalance.mockResolvedValue({
          success: false,
          error: 'Failed to fetch',
          timestamp: Date.now(),
          source: 'test',
        });

        const value = await portfolioModule.getTotalPortfolioValue();

        expect(value).toBe(0);
      });

      it('should handle exceptions gracefully', async () => {
        mockCoreClient.getAccountBalance.mockRejectedValue(new Error('Network error'));

        const value = await portfolioModule.getTotalPortfolioValue();

        expect(value).toBe(0);
        
        // The error is caught and logged in getAccountBalancesInternal
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[unified-mexc-portfolio-refactored]',
          'Error in getAccountBalancesInternal:',
          expect.any(Error)
        );
      });
    });

    describe('hasSufficientBalance', () => {
      it('should check sufficient balance correctly', async () => {
        const result = await portfolioModule.hasSufficientBalance('USDT', 500);

        expect(typeof result).toBe('boolean');
        expect(result).toBe(true); // 1000 USDT free > 500 required
      });

      it('should return false for insufficient balance', async () => {
        const result = await portfolioModule.hasSufficientBalance('USDT', 1500);

        expect(result).toBe(false); // 1000 USDT free < 1500 required
      });

      it('should return false for non-existent asset', async () => {
        const result = await portfolioModule.hasSufficientBalance('UNKNOWN', 100);

        expect(result).toBe(false);
      });

      it('should handle balance retrieval errors', async () => {
        mockCoreClient.getAccountBalance.mockRejectedValue(new Error('API error'));

        const result = await portfolioModule.hasSufficientBalance('USDT', 100);

        expect(result).toBe(false);
        expect(mockConsole.error).toHaveBeenCalled();
      });
    });

    describe('getAssetBalance', () => {
      it('should get asset balance successfully', async () => {
        const balance = await portfolioModule.getAssetBalance('USDT');

        expect(balance).not.toBeNull();
        expect(balance).toHaveProperty('free');
        expect(balance).toHaveProperty('locked');
        expect(balance?.free).toBe('1000.0');
        expect(balance?.locked).toBe('100.0');
      });

      it('should return null for non-existent asset', async () => {
        const balance = await portfolioModule.getAssetBalance('UNKNOWN');

        expect(balance).toBeNull();
      });

      it('should handle balance retrieval errors', async () => {
        mockCoreClient.getAccountBalance.mockRejectedValue(new Error('API error'));

        const balance = await portfolioModule.getAssetBalance('BTC');

        expect(balance).toBeNull();
        expect(mockConsole.error).toHaveBeenCalled();
      });
    });
  });

  describe('Price Fetching and Calculations', () => {
    describe('Price Fetching Utilities', () => {
      it('should fetch batch prices successfully', async () => {
        // This tests the internal price fetching through validation
        const result = await portfolioModule.validatePriceFetching();

        expect(result.success).toBe(true);
        expect(typeof result.btcPrice).toBe('number');
        expect(typeof result.ethPrice).toBe('number');
        expect(typeof result.samplePrices).toBe('object');
        expect(result.btcPrice).toBe(45000);
        expect(result.ethPrice).toBe(3000);
      });

      it('should handle empty ticker data', async () => {
        mockCoreClient.getAllTickers.mockResolvedValue({
          success: true,
          data: [],
          timestamp: Date.now(),
          source: 'test',
        });

        const result = await portfolioModule.validatePriceFetching();

        expect(result.success).toBe(false);
        expect(result.error).toBe('No prices were fetched successfully');
      });

      it('should handle ticker fetch failure', async () => {
        mockCoreClient.getAllTickers.mockResolvedValue({
          success: false,
          error: 'Market data unavailable',
          timestamp: Date.now(),
          source: 'test',
        });

        const result = await portfolioModule.validatePriceFetching();

        expect(result.success).toBe(false);
      });

      it('should handle ticker fetch exceptions', async () => {
        mockCoreClient.getAllTickers.mockRejectedValue(new Error('Network timeout'));

        const result = await portfolioModule.validatePriceFetching();

        expect(result.success).toBe(false);
        
        // fetchBatchPrices catches exceptions internally and returns empty data
        // which causes validatePriceFetching to return this generic error
        expect(result.error).toBe('No prices were fetched successfully');
      });
    });

    describe('Portfolio Calculations', () => {
      it('should calculate 24h performance correctly', async () => {
        const result = await portfolioModule.getAccountBalances();

        expect(result.success).toBe(true);
        expect(result.data?.performance24h).toBeDefined();
        expect(typeof result.data?.performance24h.change).toBe('number');
        expect(typeof result.data?.performance24h.changePercent).toBe('number');
      });

      it('should handle performance calculation with no assets', async () => {
        mockCoreClient.getAccountBalance.mockResolvedValue({
          success: true,
          data: [],
          timestamp: Date.now(),
          source: 'test',
        });

        const result = await portfolioModule.getAccountBalances();

        expect(result.success).toBe(true);
        expect(result.data?.performance24h).toEqual({ change: 0, changePercent: 0 });
      });

      it('should calculate allocation percentages correctly', async () => {
        const result = await portfolioModule.getAccountBalances();

        expect(result.success).toBe(true);
        const allocation = result.data?.allocation || {};
        
        // All allocation percentages should be positive
        Object.values(allocation).forEach(percent => {
          expect(percent).toBeGreaterThanOrEqual(0);
          expect(percent).toBeLessThanOrEqual(100);
        });

        // Total should be approximately 100%
        const total = Object.values(allocation).reduce((sum, percent) => sum + percent, 0);
        expect(total).toBeCloseTo(100, 0);
      });
    });
  });

  describe('Analysis and Validation Methods', () => {
    describe('testBalanceRetrieval', () => {
      it('should test balance retrieval successfully', async () => {
        const result = await portfolioModule.testBalanceRetrieval();

        expect(result.success).toBe(true);
        expect(typeof result.hasRealPrices).toBe('boolean');
        expect(typeof result.balanceCount).toBe('number');
        expect(typeof result.totalValue).toBe('number');
        expect(result.balanceCount).toBeGreaterThan(0);
        expect(result.totalValue).toBeGreaterThan(0);
      });

      it('should handle balance retrieval failure', async () => {
        mockCoreClient.getAccountBalance.mockResolvedValue({
          success: false,
          error: 'API unavailable',
          timestamp: Date.now(),
          source: 'test',
        });

        const result = await portfolioModule.testBalanceRetrieval();

        expect(result.success).toBe(false);
        expect(result.hasRealPrices).toBe(false);
        expect(result.balanceCount).toBe(0);
        expect(result.error).toBe('API unavailable');
      });

      it('should handle exceptions in balance test', async () => {
        mockCoreClient.getAccountBalance.mockRejectedValue(new Error('Connection timeout'));

        const result = await portfolioModule.testBalanceRetrieval();

        expect(result.success).toBe(false);
        expect(result.error).toContain('Connection timeout');
      });
    });

    describe('getTopAssets', () => {
      it('should get top assets by value', async () => {
        const topAssets = await portfolioModule.getTopAssets(5);

        expect(Array.isArray(topAssets)).toBe(true);
        expect(topAssets.length).toBeLessThanOrEqual(5);
        
        // Should filter assets with value > 0 
        topAssets.forEach(asset => {
          expect(asset.usdtValue).toBeGreaterThan(0);
        });
      });

      it('should return empty array when no balances', async () => {
        mockCoreClient.getAccountBalance.mockResolvedValue({
          success: false,
          error: 'No data',
          timestamp: Date.now(),
          source: 'test',
        });

        const topAssets = await portfolioModule.getTopAssets();

        expect(topAssets).toEqual([]);
      });

      it('should handle exceptions in top assets retrieval', async () => {
        mockCoreClient.getAccountBalance.mockRejectedValue(new Error('Service error'));

        const topAssets = await portfolioModule.getTopAssets();

        expect(topAssets).toEqual([]);
        
        // The error is caught and logged in getAccountBalancesInternal, not in getTopAssets
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[unified-mexc-portfolio-refactored]',
          'Error in getAccountBalancesInternal:',
          expect.any(Error)
        );
      });

      it('should filter out zero-value assets', async () => {
        const balancesWithZeros = [
          ...mockBalanceData,
          { asset: 'ZERO', free: '0.0', locked: '0.0' },
        ];

        mockCoreClient.getAccountBalance.mockResolvedValue({
          success: true,
          data: balancesWithZeros,
          timestamp: Date.now(),
          source: 'test',
        });

        const topAssets = await portfolioModule.getTopAssets();

        // Should not include assets with zero USDT value
        const zeroAsset = topAssets.find(asset => asset.asset === 'ZERO');
        expect(zeroAsset).toBeUndefined();
      });
    });
  });

  describe('Caching Integration', () => {
    it('should use cache layer for balance retrieval', async () => {
      await portfolioModule.getAccountBalance();

      expect(mockCacheLayer.getOrSet).toHaveBeenCalledWith(
        'account:balance',
        expect.any(Function),
        'user'
      );
    });

    it('should bypass cache when cache fails', async () => {
      mockCacheLayer.getOrSet.mockRejectedValue(new Error('Cache unavailable'));

      // Should still work without cache
      const result = await portfolioModule.getAccountBalance();
      
      // The result depends on implementation - it might succeed or fail
      // But it shouldn't crash
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed balance data gracefully', async () => {
      const malformedData = [
        { asset: 'BTC', free: 'invalid', locked: null },
        { asset: 'ETH', free: '1.5' }, // missing locked
        { free: '100.0', locked: '0.0' }, // missing asset
      ];

      mockCoreClient.getAccountBalance.mockResolvedValue({
        success: true,
        data: malformedData,
        timestamp: Date.now(),
        source: 'test',
      });

      const result = await portfolioModule.getAccountBalance();

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      // Should handle malformed data without crashing
    });

    it('should handle null/undefined ticker responses', async () => {
      mockCoreClient.getAllTickers.mockResolvedValue({
        success: true,
        data: null,
        timestamp: Date.now(),
        source: 'test',
      });

      const result = await portfolioModule.validatePriceFetching();

      expect(result.success).toBe(false);
    });

    it('should handle ticker data with missing fields', async () => {
      const incompleteTickers = [
        { symbol: 'BTCUSDT' }, // missing lastPrice
        { lastPrice: '45000' }, // missing symbol
        { symbol: 'ETHUSDT', lastPrice: null }, // null price
      ];

      mockCoreClient.getAllTickers.mockResolvedValue({
        success: true,
        data: incompleteTickers,
        timestamp: Date.now(),
        source: 'test',
      });

      const result = await portfolioModule.validatePriceFetching();

      // Should handle incomplete data gracefully
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle concurrent balance requests gracefully', async () => {
      const promises = [
        portfolioModule.getAccountBalance(),
        portfolioModule.getAccountBalance(),
        portfolioModule.getAccountBalance(),
      ];

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(typeof result.success).toBe('boolean');
      });
    });

    it('should log appropriate messages for different operations', async () => {
      await portfolioModule.validatePriceFetching();

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[unified-mexc-portfolio-refactored]',
        'Price fetching validation successful:',
        expect.any(Object)
      );
    });

    it('should handle price calculation edge cases', async () => {
      // Test with assets that have BTC pairs but no USDT pairs
      const edgeCaseTickers = [
        { symbol: 'ALTBTC', lastPrice: '0.001' }, // Alt coin with BTC pair
        { symbol: 'BTCUSDT', lastPrice: '45000' }, // BTC price
      ];

      mockCoreClient.getAllTickers.mockResolvedValue({
        success: true,
        data: edgeCaseTickers,
        timestamp: Date.now(),
        source: 'test',
      });

      const balanceWithAlt = [
        { asset: 'ALT', free: '1000.0', locked: '0.0' },
      ];

      mockCoreClient.getAccountBalance.mockResolvedValue({
        success: true,
        data: balanceWithAlt,
        timestamp: Date.now(),
        source: 'test',
      });

      const result = await portfolioModule.getAccountBalance();

      expect(result.success).toBe(true);
      // Should calculate USDT value through BTC conversion
      const altBalance = result.data?.find(b => b.asset === 'ALT');
      expect(altBalance?.usdtValue).toBeGreaterThan(0);
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle large balance arrays efficiently', async () => {
      const largeBalanceArray = Array.from({ length: 100 }, (_, i) => ({
        asset: `ASSET${i}`,
        free: '100.0',
        locked: '0.0',
      }));

      mockCoreClient.getAccountBalance.mockResolvedValue({
        success: true,
        data: largeBalanceArray,
        timestamp: Date.now(),
        source: 'test',
      });

      const startTime = Date.now();
      const result = await portfolioModule.getAccountBalance();
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(100);
      
      // Should complete within reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle many concurrent requests without issues', async () => {
      const concurrentRequests = Array.from({ length: 10 }, () =>
        portfolioModule.getTotalPortfolioValue()
      );

      const results = await Promise.all(concurrentRequests);

      results.forEach(value => {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThanOrEqual(0);
      });
    });
  });
});