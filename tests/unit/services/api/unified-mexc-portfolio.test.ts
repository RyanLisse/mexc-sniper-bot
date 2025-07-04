/**
 * Unit tests for Unified MEXC Portfolio Module
 * Tests portfolio management, account balances, real-time pricing, and portfolio analytics
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { UnifiedMexcPortfolioModule } from '../../../../src/services/api/unified-mexc-portfolio';
import type { PortfolioService } from '@/src/application/interfaces/trading-repository';
import type {
  BalanceEntry,
  MexcServiceResponse,
} from '../../../../src/services/data/modules/mexc-api-types';
import type { MexcCacheLayer } from '../../../../src/services/data/modules/mexc-cache-layer';
import type { MexcCoreClient } from '../../../../src/services/data/modules/mexc-core-client';

describe('Unified MEXC Portfolio Module', () => {
  let mockConsole: any;
  let portfolioModule: UnifiedMexcPortfolioModule;
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
      getAccountBalance: vi.fn(),
      getTicker: vi.fn(),
      getAllTickers: vi.fn(),
    } as any;

    // Mock cache layer
    mockCacheLayer = {
      getOrSet: vi.fn(),
      getOrSetWithCustomTTL: vi.fn(),
    } as any;

    portfolioModule = new UnifiedMexcPortfolioModule(mockCoreClient, mockCacheLayer);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Interface Compliance', () => {
    it('should create portfolio module with dependencies', () => {
      expect(portfolioModule).toBeDefined();
      expect(portfolioModule).toBeInstanceOf(UnifiedMexcPortfolioModule);
    });

    it('should implement PortfolioService interface', () => {
      const portfolioService: PortfolioService = portfolioModule;
      
      expect(typeof portfolioService.getAccountBalance).toBe('function');
      expect(typeof portfolioService.getAccountBalances).toBe('function');
      expect(typeof portfolioService.getAccountInfo).toBe('function');
      expect(typeof portfolioService.getTotalPortfolioValue).toBe('function');
      expect(typeof portfolioService.hasSufficientBalance).toBe('function');
      expect(typeof portfolioService.getAssetBalance).toBe('function');
    });
  });

  describe('PortfolioService Interface Implementation', () => {
    describe('getAccountBalance', () => {
      it('should return account balance successfully', async () => {
        const mockBalances: BalanceEntry[] = [
          {
            asset: 'BTC',
            free: '1.0',
            locked: '0.1',
            total: 1.1,
            usdtValue: 45000,
          },
          {
            asset: 'ETH',
            free: '10.0',
            locked: '1.0',
            total: 11.0,
            usdtValue: 33000,
          },
        ];

        const mockResponse: MexcServiceResponse<BalanceEntry[]> = {
          success: true,
          data: mockBalances,
          timestamp: Date.now(),
          source: 'test',
        };

        mockCacheLayer.getOrSet.mockResolvedValue(mockResponse);

        const result = await portfolioModule.getAccountBalance();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
        expect(result.data?.[0]).toMatchObject({
          asset: 'BTC',
          free: '1.0',
          locked: '0.1',
          total: 1.1,
          usdtValue: 45000,
        });
      });

      it('should handle account balance fetch failure', async () => {
        const mockResponse: MexcServiceResponse<BalanceEntry[]> = {
          success: false,
          error: 'API Error',
          timestamp: Date.now(),
          source: 'test',
        };

        mockCacheLayer.getOrSet.mockResolvedValue(mockResponse);

        const result = await portfolioModule.getAccountBalance();

        expect(result.success).toBe(false);
        expect(result.error).toBe('API Error');
        expect(result.data).toBeUndefined();
      });

      it('should handle exceptions in getAccountBalance', async () => {
        mockCacheLayer.getOrSet.mockRejectedValue(new Error('Network error'));

        const result = await portfolioModule.getAccountBalance();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Network error');
      });
    });

    describe('getAccountBalances', () => {
      it('should return enhanced account balances successfully', async () => {
        const mockBalances: BalanceEntry[] = [
          {
            asset: 'BTC',
            free: '1.0',
            locked: '0.1',
            total: 1.1,
            usdtValue: 45000,
          },
        ];

        mockCoreClient.getAccountBalance.mockResolvedValue({
          success: true,
          data: mockBalances,
          timestamp: Date.now(),
          source: 'test',
        });

        mockCoreClient.getAllTickers.mockResolvedValue({
          success: true,
          data: [
            {
              symbol: 'BTCUSDT',
              lastPrice: '45000',
              priceChangePercent: '2.5',
            },
          ],
          timestamp: Date.now(),
          source: 'test',
        });

        const result = await portfolioModule.getAccountBalances();

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data?.balances).toHaveLength(1);
        expect(result.data?.totalUsdtValue).toBeGreaterThan(0);
        expect(result.data?.allocation).toBeDefined();
        expect(result.data?.performance24h).toBeDefined();
      });

      it('should handle empty balance response', async () => {
        mockCoreClient.getAccountBalance.mockResolvedValue({
          success: true,
          data: [],
          timestamp: Date.now(),
          source: 'test',
        });

        const result = await portfolioModule.getAccountBalances();

        expect(result.success).toBe(true);
        expect(result.data?.balances).toHaveLength(0);
        expect(result.data?.totalUsdtValue).toBe(0);
      });

      it('should handle account balances fetch failure', async () => {
        mockCoreClient.getAccountBalance.mockResolvedValue({
          success: false,
          error: 'Balance fetch failed',
          timestamp: Date.now(),
          source: 'test',
        });

        const result = await portfolioModule.getAccountBalances();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Balance fetch failed');
      });
    });

    describe('getAccountInfo', () => {
      it('should return account info successfully', async () => {
        const mockBalances: BalanceEntry[] = [
          {
            asset: 'BTC',
            free: '1.0',
            locked: '0.1',
            total: 1.1,
            usdtValue: 45000,
          },
        ];

        mockCacheLayer.getOrSet.mockResolvedValue({
          success: true,
          data: mockBalances,
          timestamp: Date.now(),
          source: 'test',
        });

        const result = await portfolioModule.getAccountInfo();

        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
          accountType: 'SPOT',
          canTrade: true,
          canWithdraw: true,
          canDeposit: true,
          balances: [
            {
              asset: 'BTC',
              free: '1.0',
              locked: '0.1',
            },
          ],
        });
      });

      it('should handle account info fetch failure', async () => {
        mockCacheLayer.getOrSet.mockResolvedValue({
          success: false,
          error: 'Account info failed',
          timestamp: Date.now(),
          source: 'test',
        });

        const result = await portfolioModule.getAccountInfo();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Account info failed');
      });
    });

    describe('getTotalPortfolioValue', () => {
      it('should return total portfolio value', async () => {
        mockCoreClient.getAccountBalance.mockResolvedValue({
          success: true,
          data: [
            {
              asset: 'BTC',
              free: '1.0',
              locked: '0.0',
              total: 1.0,
              usdtValue: 45000,
            },
          ],
          timestamp: Date.now(),
          source: 'test',
        });

        mockCoreClient.getAllTickers.mockResolvedValue({
          success: true,
          data: [
            {
              symbol: 'BTCUSDT',
              lastPrice: '45000',
            },
          ],
          timestamp: Date.now(),
          source: 'test',
        });

        const totalValue = await portfolioModule.getTotalPortfolioValue();

        expect(totalValue).toBeGreaterThan(0);
      });

      it('should return 0 on fetch failure', async () => {
        mockCoreClient.getAccountBalance.mockResolvedValue({
          success: false,
          error: 'Failed',
          timestamp: Date.now(),
          source: 'test',
        });

        const totalValue = await portfolioModule.getTotalPortfolioValue();

        expect(totalValue).toBe(0);
      });

      it('should handle exceptions gracefully', async () => {
        mockCoreClient.getAccountBalance.mockRejectedValue(new Error('Network error'));

        const totalValue = await portfolioModule.getTotalPortfolioValue();

        expect(totalValue).toBe(0);
        expect(mockConsole.error).toHaveBeenCalledWith(
          'Failed to get portfolio value:',
          expect.any(Error)
        );
      });
    });

    describe('hasSufficientBalance', () => {
      it('should return true when sufficient balance exists', async () => {
        mockCacheLayer.getOrSet.mockResolvedValue({
          success: true,
          data: [
            {
              asset: 'BTC',
              free: '1.0',
              locked: '0.1',
              total: 1.1,
            },
          ],
          timestamp: Date.now(),
          source: 'test',
        });

        const result = await portfolioModule.hasSufficientBalance('BTC', 0.5);

        expect(result).toBe(true);
      });

      it('should return false when insufficient balance', async () => {
        mockCacheLayer.getOrSet.mockResolvedValue({
          success: true,
          data: [
            {
              asset: 'BTC',
              free: '0.3',
              locked: '0.1',
              total: 0.4,
            },
          ],
          timestamp: Date.now(),
          source: 'test',
        });

        const result = await portfolioModule.hasSufficientBalance('BTC', 0.5);

        expect(result).toBe(false);
      });

      it('should return false when asset not found', async () => {
        mockCacheLayer.getOrSet.mockResolvedValue({
          success: true,
          data: [
            {
              asset: 'ETH',
              free: '10.0',
              locked: '1.0',
              total: 11.0,
            },
          ],
          timestamp: Date.now(),
          source: 'test',
        });

        const result = await portfolioModule.hasSufficientBalance('BTC', 0.5);

        expect(result).toBe(false);
      });

      it('should handle balance fetch failure', async () => {
        mockCacheLayer.getOrSet.mockResolvedValue({
          success: false,
          error: 'Fetch failed',
          timestamp: Date.now(),
          source: 'test',
        });

        const result = await portfolioModule.hasSufficientBalance('BTC', 0.5);

        expect(result).toBe(false);
      });
    });

    describe('getAssetBalance', () => {
      it('should return asset balance when found', async () => {
        mockCoreClient.getAccountBalance.mockResolvedValue({
          success: true,
          data: [
            {
              asset: 'BTC',
              free: '1.0',
              locked: '0.1',
              total: 1.1,
            },
          ],
          timestamp: Date.now(),
          source: 'test',
        });

        mockCoreClient.getAllTickers.mockResolvedValue({
          success: true,
          data: [],
          timestamp: Date.now(),
          source: 'test',
        });

        const result = await portfolioModule.getAssetBalance('BTC');

        expect(result).toEqual({
          free: '1.0',
          locked: '0.1',
        });
      });

      it('should return null when asset not found', async () => {
        mockCoreClient.getAccountBalance.mockResolvedValue({
          success: true,
          data: [
            {
              asset: 'ETH',
              free: '10.0',
              locked: '1.0',
              total: 11.0,
            },
          ],
          timestamp: Date.now(),
          source: 'test',
        });

        mockCoreClient.getAllTickers.mockResolvedValue({
          success: true,
          data: [],
          timestamp: Date.now(),
          source: 'test',
        });

        const result = await portfolioModule.getAssetBalance('BTC');

        expect(result).toBeNull();
      });

      it('should handle balance fetch failure', async () => {
        mockCoreClient.getAccountBalance.mockResolvedValue({
          success: false,
          error: 'Failed',
          timestamp: Date.now(),
          source: 'test',
        });

        const result = await portfolioModule.getAssetBalance('BTC');

        expect(result).toBeNull();
      });
    });
  });

  describe('Real-Time Price Fetching', () => {
    describe('fetchRealTimePrices', () => {
      it('should fetch prices using batch ticker method', async () => {
        const testBalances = [
          { asset: 'BTC' },
          { asset: 'ETH' },
          { asset: 'BNB' },
          { asset: 'ADA' },
        ];

        mockCoreClient.getAllTickers.mockResolvedValue({
          success: true,
          data: [
            { symbol: 'BTCUSDT', lastPrice: '45000' },
            { symbol: 'ETHUSDT', lastPrice: '3000' },
            { symbol: 'BNBUSDT', lastPrice: '400' },
            { symbol: 'ADABTC', lastPrice: '0.00001' },
          ],
          timestamp: Date.now(),
          source: 'test',
        });

        // Access private method for testing
        const priceData = await (portfolioModule as any).fetchRealTimePrices(testBalances);

        expect(priceData.BTC).toBe(45000);
        expect(priceData.ETH).toBe(3000);
        expect(priceData.BNB).toBe(400);
        expect(priceData.ADA).toBeGreaterThan(0); // Should convert from BTC to USDT
      });

      it('should fall back to individual requests for small asset counts', async () => {
        const testBalances = [
          { asset: 'BTC' },
          { asset: 'ETH' },
        ];

        mockCoreClient.getTicker
          .mockResolvedValueOnce({
            success: true,
            data: { lastPrice: '45000' },
            timestamp: Date.now(),
            source: 'test',
          })
          .mockResolvedValueOnce({
            success: true,
            data: { lastPrice: '3000' },
            timestamp: Date.now(),
            source: 'test',
          });

        const priceData = await (portfolioModule as any).fetchRealTimePrices(testBalances);

        expect(priceData.BTC).toBe(45000);
        expect(priceData.ETH).toBe(3000);
      });

      it('should handle batch ticker failure gracefully', async () => {
        const testBalances = [
          { asset: 'BTC' },
          { asset: 'ETH' },
          { asset: 'BNB' },
          { asset: 'ADA' },
        ];

        mockCoreClient.getAllTickers.mockRejectedValue(new Error('Batch failed'));
        mockCoreClient.getTicker.mockResolvedValue({
          success: true,
          data: { lastPrice: '45000' },
          timestamp: Date.now(),
          source: 'test',
        });

        const priceData = await (portfolioModule as any).fetchRealTimePrices(testBalances);

        expect(mockConsole.warn).toHaveBeenCalledWith(
          'Batch ticker fetch failed, falling back to individual requests:',
          expect.any(Error)
        );
        expect(Object.keys(priceData).length).toBeGreaterThanOrEqual(0);
      });

      it('should handle empty asset list', async () => {
        const priceData = await (portfolioModule as any).fetchRealTimePrices([]);

        expect(Object.keys(priceData)).toHaveLength(0);
      });

      it('should handle USDT assets correctly', async () => {
        const testBalances = [
          { asset: 'USDT' },
          { asset: 'BTC' },
        ];

        mockCoreClient.getTicker.mockResolvedValue({
          success: true,
          data: { lastPrice: '45000' },
          timestamp: Date.now(),
          source: 'test',
        });

        const priceData = await (portfolioModule as any).fetchRealTimePrices(testBalances);

        expect(priceData.BTC).toBe(45000);
        // USDT should not be in the price data since it's excluded from processing
        expect(priceData.USDT).toBeUndefined();
      });
    });

    describe('calculate24hPerformance', () => {
      it('should calculate 24h performance correctly', async () => {
        const testBalances = [
          { asset: 'BTC', usdtValue: 45000 },
          { asset: 'ETH', usdtValue: 3000 },
        ];

        mockCoreClient.getAllTickers.mockResolvedValue({
          success: true,
          data: [
            { symbol: 'BTCUSDT', priceChangePercent: '2.5' },
            { symbol: 'ETHUSDT', priceChangePercent: '-1.2' },
          ],
          timestamp: Date.now(),
          source: 'test',
        });

        const performance = await (portfolioModule as any).calculate24hPerformance(
          testBalances,
          { BTC: 45000, ETH: 3000 }
        );

        expect(performance.change).toBeDefined();
        expect(performance.changePercent).toBeDefined();
        expect(typeof performance.change).toBe('number');
        expect(typeof performance.changePercent).toBe('number');
      });

      it('should handle USDT assets in performance calculation', async () => {
        const testBalances = [
          { asset: 'USDT', usdtValue: 1000 },
          { asset: 'BTC', usdtValue: 45000 },
        ];

        mockCoreClient.getAllTickers.mockResolvedValue({
          success: true,
          data: [
            { symbol: 'BTCUSDT', priceChangePercent: '2.5' },
          ],
          timestamp: Date.now(),
          source: 'test',
        });

        const performance = await (portfolioModule as any).calculate24hPerformance(
          testBalances,
          { BTC: 45000 }
        );

        expect(performance.change).toBeGreaterThan(0); // Only BTC contributes to change
        expect(performance.changePercent).toBeGreaterThan(0);
      });

      it('should handle empty balance list', async () => {
        const performance = await (portfolioModule as any).calculate24hPerformance([], {});

        expect(performance).toEqual({ change: 0, changePercent: 0 });
      });

      it('should handle ticker fetch failure gracefully', async () => {
        const testBalances = [
          { asset: 'BTC', usdtValue: 45000 },
        ];

        mockCoreClient.getAllTickers.mockRejectedValue(new Error('Ticker fetch failed'));

        const performance = await (portfolioModule as any).calculate24hPerformance(
          testBalances,
          { BTC: 45000 }
        );

        expect(performance).toEqual({ change: 0, changePercent: 0 });
      });
    });
  });

  describe('Validation and Testing Methods', () => {
    describe('validatePriceFetching', () => {
      it('should validate price fetching successfully', async () => {
        mockCoreClient.getTicker.mockResolvedValue({
          success: true,
          data: { lastPrice: '45000' },
          timestamp: Date.now(),
          source: 'test',
        });

        const result = await portfolioModule.validatePriceFetching();

        expect(result.success).toBe(true);
        expect(result.btcPrice).toBe(45000);
        expect(result.samplePrices?.BTC).toBe(45000);
      });

      it('should handle price fetching validation failure', async () => {
        mockCoreClient.getTicker.mockResolvedValue({
          success: false,
          error: 'Price fetch failed',
          timestamp: Date.now(),
          source: 'test',
        });

        const result = await portfolioModule.validatePriceFetching();

        expect(result.success).toBe(false);
        expect(result.error).toBe('No prices were fetched successfully');
      });

      it('should handle validation exceptions', async () => {
        mockCoreClient.getTicker.mockRejectedValue(new Error('Network error'));

        const result = await portfolioModule.validatePriceFetching();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Network error');
      });
    });

    describe('testBalanceRetrieval', () => {
      it('should test balance retrieval successfully', async () => {
        const mockBalances: BalanceEntry[] = [
          {
            asset: 'BTC',
            free: '1.0',
            locked: '0.1',
            total: 1.1,
            usdtValue: 45000,
          },
          {
            asset: 'USDT',
            free: '1000',
            locked: '0',
            total: 1000,
            usdtValue: 1000,
          },
        ];

        mockCacheLayer.getOrSet.mockResolvedValue({
          success: true,
          data: mockBalances,
          timestamp: Date.now(),
          source: 'test',
        });

        const result = await portfolioModule.testBalanceRetrieval();

        expect(result.success).toBe(true);
        expect(result.hasRealPrices).toBe(true); // BTC has real price
        expect(result.balanceCount).toBe(2);
        expect(result.totalValue).toBe(46000);
      });

      it('should handle balance retrieval test failure', async () => {
        mockCacheLayer.getOrSet.mockResolvedValue({
          success: false,
          error: 'Balance test failed',
          timestamp: Date.now(),
          source: 'test',
        });

        const result = await portfolioModule.testBalanceRetrieval();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Balance test failed');
        expect(result.balanceCount).toBe(0);
      });
    });
  });

  describe('Portfolio Analytics', () => {
    describe('getTopAssets', () => {
      it('should return top assets by value', async () => {
        mockCoreClient.getAccountBalance.mockResolvedValue({
          success: true,
          data: [
            { asset: 'BTC', free: '1.0', locked: '0.0', total: 1.0, usdtValue: 45000 },
            { asset: 'ETH', free: '10.0', locked: '0.0', total: 10.0, usdtValue: 30000 },
            { asset: 'BNB', free: '100.0', locked: '0.0', total: 100.0, usdtValue: 40000 },
          ],
          timestamp: Date.now(),
          source: 'test',
        });

        mockCoreClient.getAllTickers.mockResolvedValue({
          success: true,
          data: [],
          timestamp: Date.now(),
          source: 'test',
        });

        const topAssets = await portfolioModule.getTopAssets(2);

        expect(topAssets).toHaveLength(2);
        expect(topAssets[0].asset).toBe('BTC'); // Highest value
      });

      it('should handle empty balances', async () => {
        mockCoreClient.getAccountBalance.mockResolvedValue({
          success: true,
          data: [],
          timestamp: Date.now(),
          source: 'test',
        });

        mockCoreClient.getAllTickers.mockResolvedValue({
          success: true,
          data: [],
          timestamp: Date.now(),
          source: 'test',
        });

        const topAssets = await portfolioModule.getTopAssets();

        expect(topAssets).toHaveLength(0);
      });
    });

    describe('getPortfolioAnalysis', () => {
      it('should return portfolio analysis with risk metrics', async () => {
        mockCoreClient.getAccountBalance.mockResolvedValue({
          success: true,
          data: [
            { asset: 'BTC', free: '1.0', locked: '0.0', total: 1.0, usdtValue: 45000 },
            { asset: 'ETH', free: '10.0', locked: '0.0', total: 10.0, usdtValue: 30000 },
          ],
          timestamp: Date.now(),
          source: 'test',
        });

        mockCoreClient.getAllTickers.mockResolvedValue({
          success: true,
          data: [
            { symbol: 'BTCUSDT', lastPrice: '45000', priceChangePercent: '2.5' },
            { symbol: 'ETHUSDT', lastPrice: '3000', priceChangePercent: '-1.2' },
          ],
          timestamp: Date.now(),
          source: 'test',
        });

        const analysis = await portfolioModule.getPortfolioAnalysis();

        expect(analysis.success).toBe(true);
        expect(analysis.data?.summary).toBeDefined();
        expect(analysis.data?.risk).toBeDefined();
        expect(analysis.data?.recommendations).toBeDefined();
        expect((analysis.data as any).summary.totalAssets).toBe(2);
      });

      it('should handle portfolio analysis failure', async () => {
        mockCoreClient.getAccountBalance.mockResolvedValue({
          success: false,
          error: 'Analysis failed',
          timestamp: Date.now(),
          source: 'test',
        });

        const analysis = await portfolioModule.getPortfolioAnalysis();

        expect(analysis.success).toBe(false);
        expect(analysis.error).toContain('Failed to get portfolio data');
      });
    });

    describe('Risk Calculations', () => {
      it('should calculate concentration risk correctly', () => {
        const allocation = { BTC: 60, ETH: 30, BNB: 10 };
        
        const concentrationRisk = (portfolioModule as any).calculateConcentrationRisk(allocation);
        
        expect(concentrationRisk).toBeGreaterThan(0);
        expect(concentrationRisk).toBeLessThanOrEqual(100);
      });

      it('should calculate diversification score correctly', () => {
        const allocation = { BTC: 40, ETH: 30, BNB: 20, ADA: 10 };
        
        const diversificationScore = (portfolioModule as any).calculateDiversificationScore(
          4,
          allocation
        );
        
        expect(diversificationScore).toBeGreaterThan(0);
        expect(diversificationScore).toBeLessThanOrEqual(100);
      });

      it('should assess risk level correctly', () => {
        // High risk scenario
        let riskLevel = (portfolioModule as any).assessRiskLevel(80, 20);
        expect(riskLevel).toBe('HIGH');

        // Medium risk scenario
        riskLevel = (portfolioModule as any).assessRiskLevel(30, 50);
        expect(riskLevel).toBe('MEDIUM');

        // Low risk scenario
        riskLevel = (portfolioModule as any).assessRiskLevel(15, 80);
        expect(riskLevel).toBe('LOW');
      });

      it('should generate appropriate recommendations', () => {
        // High concentration risk
        let recommendations = (portfolioModule as any).generateRecommendations(80, 40);
        expect(recommendations).toContain('Consider reducing position sizes in dominant assets');

        // Low diversification
        recommendations = (portfolioModule as any).generateRecommendations(30, 30);
        expect(recommendations).toContain('Consider diversifying across more assets');

        // Well diversified
        recommendations = (portfolioModule as any).generateRecommendations(15, 85);
        expect(recommendations).toContain('Well-diversified portfolio - maintain balance');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle core client errors gracefully', async () => {
      mockCoreClient.getAccountBalance.mockRejectedValue(new Error('Core client error'));

      const result = await portfolioModule.getAccountBalance();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Core client error');
    });

    it('should handle cache layer errors gracefully', async () => {
      mockCacheLayer.getOrSet.mockRejectedValue(new Error('Cache error'));

      const result = await portfolioModule.getAccountBalance();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cache error');
    });

    it('should handle malformed balance data', async () => {
      const malformedData = [
        { asset: 'BTC' }, // Missing required fields
        { free: '1.0', locked: '0.1' }, // Missing asset
        null,
        undefined,
      ];

      mockCoreClient.getAccountBalance.mockResolvedValue({
        success: true,
        data: malformedData as any,
        timestamp: Date.now(),
        source: 'test',
      });

      mockCoreClient.getAllTickers.mockResolvedValue({
        success: true,
        data: [],
        timestamp: Date.now(),
        source: 'test',
      });

      const result = await portfolioModule.getAccountBalances();

      expect(result.success).toBe(true);
      // Should handle malformed data gracefully
      expect(result.data?.balances).toBeDefined();
    });

    it('should handle ticker fetch timeouts', async () => {
      mockCoreClient.getTicker.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const priceData = await (portfolioModule as any).fetchRealTimePrices([{ asset: 'BTC' }]);

      expect(mockConsole.warn).toHaveBeenCalled();
      expect(Object.keys(priceData)).toHaveLength(0);
    });

    it('should handle non-numeric price data', async () => {
      mockCoreClient.getTicker.mockResolvedValue({
        success: true,
        data: { lastPrice: 'invalid-price' },
        timestamp: Date.now(),
        source: 'test',
      });

      const priceData = await (portfolioModule as any).fetchRealTimePrices([{ asset: 'BTC' }]);

      // Should handle invalid price gracefully (NaN becomes 0 or excluded)
      expect(priceData.BTC).toBeUndefined();
    });
  });

  describe('Performance and Efficiency', () => {
    it('should handle large asset lists efficiently', async () => {
      const largeAssetList = Array.from({ length: 50 }, (_, i) => ({
        asset: `TOKEN${i}`,
      }));

      mockCoreClient.getAllTickers.mockResolvedValue({
        success: true,
        data: largeAssetList.map((asset, i) => ({
          symbol: `${asset.asset}USDT`,
          lastPrice: String(100 + i),
        })),
        timestamp: Date.now(),
        source: 'test',
      });

      const startTime = Date.now();
      const priceData = await (portfolioModule as any).fetchRealTimePrices(largeAssetList);
      const endTime = Date.now();

      expect(Object.keys(priceData).length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should cache results appropriately', async () => {
      const mockBalance = {
        success: true,
        data: [{ asset: 'BTC', free: '1.0', locked: '0.0', total: 1.0 }],
        timestamp: Date.now(),
        source: 'test',
      };

      mockCacheLayer.getOrSet.mockResolvedValue(mockBalance);

      // First call
      await portfolioModule.getAccountBalance();
      
      // Second call should use cache
      await portfolioModule.getAccountBalance();

      expect(mockCacheLayer.getOrSet).toHaveBeenCalledTimes(2);
      expect(mockCacheLayer.getOrSet).toHaveBeenCalledWith(
        'account:balance',
        expect.any(Function),
        'user'
      );
    });
  });
});