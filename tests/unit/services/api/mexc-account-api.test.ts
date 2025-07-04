/**
 * Unit tests for MexcAccountApiClient
 * Tests account information retrieval, balance management, USDT conversion, permissions, and portfolio calculations
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  MexcAccountApiClient,
} from '../../../../src/services/api/mexc-account-api';
import type {
  BalanceEntry,
  UnifiedMexcConfig,
  UnifiedMexcResponse,
} from '../../../../src/services/api/mexc-client-types';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../../utils/timeout-elimination-helpers';

// Mock dependencies
vi.mock('../../../../src/services/risk/mexc-error-recovery-service', () => ({
  getGlobalErrorRecoveryService: vi.fn(() => ({
    handleMexcApiCall: vi.fn(),
  })),
}));

vi.mock('../../../../src/services/api/mexc-client-types', () => ({
  BalanceEntrySchema: {
    parse: vi.fn((data) => data),
  },
}));

describe('MexcAccountApiClient', () => {
  let accountApi: MexcAccountApiClient;
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
      handleMexcApiCall: vi.fn(),
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

    accountApi = new MexcAccountApiClient(mockConfig);
    
    // Mock the makeRequest method
    (accountApi as any).makeRequest = vi.fn();
    (accountApi as any).getExchangeInfo = vi.fn();
    (accountApi as any).get24hrTicker = vi.fn();
  });

  afterEach(async () => {
    // TIMEOUT ELIMINATION: Ensure all promises are flushed before cleanup
    await flushPromises();
    vi.restoreAllMocks();
  
  });

  describe('Constructor', () => {
    it('should create account API client with configuration', () => {
      expect(accountApi).toBeDefined();
      expect(accountApi).toBeInstanceOf(MexcAccountApiClient);
    });

    it('should extend MexcMarketDataClient', () => {
      expect(accountApi.constructor.name).toBe('MexcAccountApiClient');
    });
  });

  describe('Account Information', () => {
    describe('getAccountInfo', () => {
      it('should get account information successfully', async () => {
        const mockAccountData = {
          makerCommission: 10,
          takerCommission: 10,
          buyerCommission: 0,
          sellerCommission: 0,
          canTrade: true,
          canWithdraw: true,
          canDeposit: true,
          accountType: 'SPOT',
        };

        const mockResponse: UnifiedMexcResponse<Record<string, unknown>> = {
          success: true,
          data: mockAccountData,
          timestamp: new Date().toISOString(),
        };

        (accountApi as any).makeRequest.mockResolvedValue(mockResponse);

        const result = await accountApi.getAccountInfo();

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockAccountData);
        expect((accountApi as any).makeRequest).toHaveBeenCalledWith(
          '/api/v3/account',
          {},
          true,
          true
        );
      });

      it('should fail when credentials are not configured', async () => {
        const accountApiNoCredentials = new MexcAccountApiClient({});

        const result = await accountApiNoCredentials.getAccountInfo();

        expect(result.success).toBe(false);
        expect(result.error).toBe('MEXC API credentials not configured for account info');
        expect(result.data).toEqual({});
      });

      it('should handle API request errors', async () => {
        (accountApi as any).makeRequest.mockRejectedValue(new Error('API request failed'));

        const result = await accountApi.getAccountInfo();

        expect(result.success).toBe(false);
        expect(result.error).toBe('API request failed');
        expect(result.data).toEqual({});
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[MexcAccountApi] Account info failed:',
          expect.any(Error)
        );
      });

      it('should handle non-Error thrown values', async () => {
        (accountApi as any).makeRequest.mockRejectedValue('String error');

        const result = await accountApi.getAccountInfo();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Unknown error');
      });
    });
  });

  describe('Balance Management', () => {
    describe('getAccountBalances', () => {
      it('should get account balances with USDT conversion successfully', async () => {
        const mockAccountResponse = {
          success: true,
          data: {
            balances: [
              { asset: 'BTC', free: '1.0', locked: '0.0' },
              { asset: 'ETH', free: '10.0', locked: '2.0' },
              { asset: 'USDT', free: '1000.0', locked: '0.0' },
            ],
          },
          timestamp: new Date().toISOString(),
          requestId: 'test-123',
        };

        const mockExchangeInfo = {
          success: true,
          data: [
            { symbol: 'BTCUSDT', quoteAsset: 'USDT', status: '1' },
            { symbol: 'ETHUSDT', quoteAsset: 'USDT', status: '1' },
          ],
        };

        const mockBtcTicker = {
          success: true,
          data: [{ symbol: 'BTCUSDT', lastPrice: '50000.0' }],
        };

        const mockEthTicker = {
          success: true,
          data: [{ symbol: 'ETHUSDT', lastPrice: '3000.0' }],
        };

        mockErrorRecoveryService.handleMexcApiCall.mockResolvedValue(mockAccountResponse);
        (accountApi as any).getExchangeInfo.mockResolvedValue(mockExchangeInfo);
        (accountApi as any).get24hrTicker
          .mockResolvedValueOnce(mockBtcTicker)
          .mockResolvedValueOnce(mockEthTicker);

        const result = await accountApi.getAccountBalances();

        expect(result.success).toBe(true);
        expect(result.data.balances).toHaveLength(3);
        
        const btcBalance = result.data.balances.find(b => b.asset === 'BTC');
        const ethBalance = result.data.balances.find(b => b.asset === 'ETH');
        const usdtBalance = result.data.balances.find(b => b.asset === 'USDT');

        expect(btcBalance).toMatchObject({
          asset: 'BTC',
          free: '1.0',
          locked: '0.0',
          total: 1.0,
          usdtValue: 50000.0,
        });

        expect(ethBalance).toMatchObject({
          asset: 'ETH',
          free: '10.0',
          locked: '2.0',
          total: 12.0,
          usdtValue: 36000.0,
        });

        expect(usdtBalance).toMatchObject({
          asset: 'USDT',
          free: '1000.0',
          locked: '0.0',
          total: 1000.0,
          usdtValue: 1000.0,
        });

        expect(result.data.totalUsdtValue).toBe(87000.0);
      });

      it('should fail when credentials are not configured', async () => {
        const accountApiNoCredentials = new MexcAccountApiClient({});

        const result = await accountApiNoCredentials.getAccountBalances();

        expect(result.success).toBe(false);
        expect(result.error).toContain('MEXC API credentials not configured');
        expect(result.data.balances).toEqual([]);
        expect(result.data.totalUsdtValue).toBe(0);
      });

      it('should handle API request failure', async () => {
        mockErrorRecoveryService.handleMexcApiCall.mockResolvedValue({
          success: false,
          error: 'API request failed',
        });

        const result = await accountApi.getAccountBalances();

        expect(result.success).toBe(false);
        expect(result.error).toBe('API request failed');
        expect(result.data.balances).toEqual([]);
      });

      it('should handle empty balances', async () => {
        const mockAccountResponse = {
          success: true,
          data: { balances: [] },
          timestamp: new Date().toISOString(),
        };

        mockErrorRecoveryService.handleMexcApiCall.mockResolvedValue(mockAccountResponse);
        (accountApi as any).getExchangeInfo.mockResolvedValue({ success: true, data: [] });

        const result = await accountApi.getAccountBalances();

        expect(result.success).toBe(true);
        expect(result.data.balances).toEqual([]);
        expect(result.data.totalUsdtValue).toBe(0);
      });

      it('should filter out zero balances', async () => {
        const mockAccountResponse = {
          success: true,
          data: {
            balances: [
              { asset: 'BTC', free: '1.0', locked: '0.0' },
              { asset: 'ETH', free: '0.0', locked: '0.0' }, // Zero balance
              { asset: 'USDT', free: '1000.0', locked: '0.0' },
            ],
          },
          timestamp: new Date().toISOString(),
        };

        const mockExchangeInfo = {
          success: true,
          data: [
            { symbol: 'BTCUSDT', quoteAsset: 'USDT', status: '1' },
          ],
        };

        const mockBtcTicker = {
          success: true,
          data: [{ symbol: 'BTCUSDT', lastPrice: '50000.0' }],
        };

        mockErrorRecoveryService.handleMexcApiCall.mockResolvedValue(mockAccountResponse);
        (accountApi as any).getExchangeInfo.mockResolvedValue(mockExchangeInfo);
        (accountApi as any).get24hrTicker.mockResolvedValue(mockBtcTicker);

        const result = await accountApi.getAccountBalances();

        expect(result.success).toBe(true);
        expect(result.data.balances).toHaveLength(2); // Only BTC and USDT
        expect(result.data.balances.find(b => b.asset === 'ETH')).toBeUndefined();
      });

      it('should handle price fetch failures gracefully', async () => {
        const mockAccountResponse = {
          success: true,
          data: {
            balances: [
              { asset: 'BTC', free: '1.0', locked: '0.0' },
              { asset: 'USDT', free: '1000.0', locked: '0.0' },
            ],
          },
          timestamp: new Date().toISOString(),
        };

        const mockExchangeInfo = {
          success: true,
          data: [
            { symbol: 'BTCUSDT', quoteAsset: 'USDT', status: '1' },
          ],
        };

        mockErrorRecoveryService.handleMexcApiCall.mockResolvedValue(mockAccountResponse);
        (accountApi as any).getExchangeInfo.mockResolvedValue(mockExchangeInfo);
        (accountApi as any).get24hrTicker.mockRejectedValue(new Error('Price fetch failed'));

        const result = await accountApi.getAccountBalances();

        expect(result.success).toBe(true);
        expect(result.data.balances).toHaveLength(2);
        
        const btcBalance = result.data.balances.find(b => b.asset === 'BTC');
        expect(btcBalance?.usdtValue).toBe(0); // No price available
        
        const usdtBalance = result.data.balances.find(b => b.asset === 'USDT');
        expect(usdtBalance?.usdtValue).toBe(1000.0); // USDT always 1:1
      });

      it('should handle MEXC API error codes with helpful messages', async () => {
        mockErrorRecoveryService.handleMexcApiCall.mockRejectedValue(
          new Error('MEXC API error: 700002 - Signature for this request is not valid')
        );

        const result = await accountApi.getAccountBalances();

        expect(result.success).toBe(false);
        expect(result.error).toContain('MEXC API signature validation failed');
        expect(result.error).toContain('IP address not allowlisted');
      });

      it('should handle invalid API key error', async () => {
        mockErrorRecoveryService.handleMexcApiCall.mockRejectedValue(
          new Error('10072 - Api key info invalid')
        );

        const result = await accountApi.getAccountBalances();

        expect(result.success).toBe(false);
        expect(result.error).toContain('MEXC API key is invalid or expired');
      });

      it('should sort balances by USDT value descending', async () => {
        const mockAccountResponse = {
          success: true,
          data: {
            balances: [
              { asset: 'BTC', free: '1.0', locked: '0.0' },
              { asset: 'ETH', free: '10.0', locked: '0.0' },
              { asset: 'USDT', free: '1000.0', locked: '0.0' },
            ],
          },
          timestamp: new Date().toISOString(),
        };

        const mockExchangeInfo = {
          success: true,
          data: [
            { symbol: 'BTCUSDT', quoteAsset: 'USDT', status: '1' },
            { symbol: 'ETHUSDT', quoteAsset: 'USDT', status: '1' },
          ],
        };

        mockErrorRecoveryService.handleMexcApiCall.mockResolvedValue(mockAccountResponse);
        (accountApi as any).getExchangeInfo.mockResolvedValue(mockExchangeInfo);
        (accountApi as any).get24hrTicker
          .mockResolvedValueOnce({ success: true, data: [{ symbol: 'BTCUSDT', lastPrice: '50000.0' }] })
          .mockResolvedValueOnce({ success: true, data: [{ symbol: 'ETHUSDT', lastPrice: '3000.0' }] });

        const result = await accountApi.getAccountBalances();

        expect(result.success).toBe(true);
        expect(result.data.balances[0].asset).toBe('BTC'); // Highest value first
        expect(result.data.balances[1].asset).toBe('ETH'); // Second highest
        expect(result.data.balances[2].asset).toBe('USDT'); // Lowest value
      });
    });

    describe('getAssetBalance', () => {
      it('should get balance for specific asset', async () => {
        const mockBalanceResponse = {
          success: true,
          data: {
            balances: [
              { asset: 'BTC', free: '1.0', locked: '0.5', total: 1.5, usdtValue: 75000 },
              { asset: 'USDT', free: '1000.0', locked: '0.0', total: 1000, usdtValue: 1000 },
            ],
            totalUsdtValue: 76000,
            lastUpdated: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        };

        vi.spyOn(accountApi, 'getAccountBalances').mockResolvedValue(mockBalanceResponse);

        const result = await accountApi.getAssetBalance('BTC');

        expect(result).toEqual({
          free: '1.0',
          locked: '0.5',
        });
      });

      it('should return null for non-existent asset', async () => {
        const mockBalanceResponse = {
          success: true,
          data: {
            balances: [
              { asset: 'USDT', free: '1000.0', locked: '0.0', total: 1000, usdtValue: 1000 },
            ],
            totalUsdtValue: 1000,
            lastUpdated: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        };

        vi.spyOn(accountApi, 'getAccountBalances').mockResolvedValue(mockBalanceResponse);

        const result = await accountApi.getAssetBalance('BTC');

        expect(result).toBeNull();
      });

      it('should return null when getAccountBalances fails', async () => {
        vi.spyOn(accountApi, 'getAccountBalances').mockResolvedValue({
          success: false,
          data: { balances: [], totalUsdtValue: 0, lastUpdated: new Date().toISOString() },
          error: 'API error',
          timestamp: new Date().toISOString(),
        });

        const result = await accountApi.getAssetBalance('BTC');

        expect(result).toBeNull();
      });

      it('should handle errors gracefully', async () => {
        vi.spyOn(accountApi, 'getAccountBalances').mockRejectedValue(new Error('Network error'));

        const result = await accountApi.getAssetBalance('BTC');

        expect(result).toBeNull();
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[MexcAccountApi] Failed to get asset balance:',
          expect.any(Error)
        );
      });
    });
  });

  describe('Account Status and Permissions', () => {
    describe('canTrade', () => {
      it('should return true when trading is allowed', async () => {
        vi.spyOn(accountApi, 'getAccountInfo').mockResolvedValue({
          success: true,
          data: { canTrade: true },
          timestamp: new Date().toISOString(),
        });

        const result = await accountApi.canTrade();

        expect(result).toBe(true);
      });

      it('should return false when trading is not allowed', async () => {
        vi.spyOn(accountApi, 'getAccountInfo').mockResolvedValue({
          success: true,
          data: { canTrade: false },
          timestamp: new Date().toISOString(),
        });

        const result = await accountApi.canTrade();

        expect(result).toBe(false);
      });

      it('should return false when account info request fails', async () => {
        vi.spyOn(accountApi, 'getAccountInfo').mockResolvedValue({
          success: false,
          data: {},
          error: 'API error',
          timestamp: new Date().toISOString(),
        });

        const result = await accountApi.canTrade();

        expect(result).toBe(false);
      });

      it('should handle errors gracefully', async () => {
        vi.spyOn(accountApi, 'getAccountInfo').mockRejectedValue(new Error('Network error'));

        const result = await accountApi.canTrade();

        expect(result).toBe(false);
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[MexcAccountApi] Failed to check trading permission:',
          expect.any(Error)
        );
      });
    });

    describe('getAccountType', () => {
      it('should return account type when available', async () => {
        vi.spyOn(accountApi, 'getAccountInfo').mockResolvedValue({
          success: true,
          data: { accountType: 'MARGIN' },
          timestamp: new Date().toISOString(),
        });

        const result = await accountApi.getAccountType();

        expect(result).toBe('MARGIN');
      });

      it('should return SPOT as default when accountType is not provided', async () => {
        vi.spyOn(accountApi, 'getAccountInfo').mockResolvedValue({
          success: true,
          data: {},
          timestamp: new Date().toISOString(),
        });

        const result = await accountApi.getAccountType();

        expect(result).toBe('SPOT');
      });

      it('should return UNKNOWN when account info request fails', async () => {
        vi.spyOn(accountApi, 'getAccountInfo').mockResolvedValue({
          success: false,
          data: {},
          error: 'API error',
          timestamp: new Date().toISOString(),
        });

        const result = await accountApi.getAccountType();

        expect(result).toBe('UNKNOWN');
      });

      it('should handle errors gracefully', async () => {
        vi.spyOn(accountApi, 'getAccountInfo').mockRejectedValue(new Error('Network error'));

        const result = await accountApi.getAccountType();

        expect(result).toBe('UNKNOWN');
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[MexcAccountApi] Failed to get account type:',
          expect.any(Error)
        );
      });
    });
  });

  describe('Utility Methods', () => {
    describe('getTotalPortfolioValue', () => {
      it('should return total portfolio value', async () => {
        vi.spyOn(accountApi, 'getAccountBalances').mockResolvedValue({
          success: true,
          data: {
            balances: [],
            totalUsdtValue: 75000,
            lastUpdated: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        });

        const result = await accountApi.getTotalPortfolioValue();

        expect(result).toBe(75000);
      });

      it('should return 0 when balances request fails', async () => {
        vi.spyOn(accountApi, 'getAccountBalances').mockResolvedValue({
          success: false,
          data: { balances: [], totalUsdtValue: 0, lastUpdated: new Date().toISOString() },
          error: 'API error',
          timestamp: new Date().toISOString(),
        });

        const result = await accountApi.getTotalPortfolioValue();

        expect(result).toBe(0);
      });

      it('should handle errors gracefully', async () => {
        vi.spyOn(accountApi, 'getAccountBalances').mockRejectedValue(new Error('Network error'));

        const result = await accountApi.getTotalPortfolioValue();

        expect(result).toBe(0);
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[MexcAccountApi] Failed to get portfolio value:',
          expect.any(Error)
        );
      });
    });

    describe('getTopAssets', () => {
      it('should return top assets by value', async () => {
        const mockBalances: BalanceEntry[] = [
          { asset: 'BTC', free: '1.0', locked: '0.0', total: 1.0, usdtValue: 50000 },
          { asset: 'ETH', free: '10.0', locked: '0.0', total: 10.0, usdtValue: 30000 },
          { asset: 'USDT', free: '1000.0', locked: '0.0', total: 1000.0, usdtValue: 1000 },
          { asset: 'ADA', free: '1000.0', locked: '0.0', total: 1000.0, usdtValue: 0 }, // No value
        ];

        vi.spyOn(accountApi, 'getAccountBalances').mockResolvedValue({
          success: true,
          data: {
            balances: mockBalances,
            totalUsdtValue: 81000,
            lastUpdated: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        });

        const result = await accountApi.getTopAssets(2);

        expect(result).toHaveLength(2);
        expect(result[0].asset).toBe('BTC');
        expect(result[1].asset).toBe('ETH');
        // ADA should be filtered out due to 0 USDT value
      });

      it('should return empty array when balances request fails', async () => {
        vi.spyOn(accountApi, 'getAccountBalances').mockResolvedValue({
          success: false,
          data: { balances: [], totalUsdtValue: 0, lastUpdated: new Date().toISOString() },
          error: 'API error',
          timestamp: new Date().toISOString(),
        });

        const result = await accountApi.getTopAssets();

        expect(result).toEqual([]);
      });

      it('should handle errors gracefully', async () => {
        vi.spyOn(accountApi, 'getAccountBalances').mockRejectedValue(new Error('Network error'));

        const result = await accountApi.getTopAssets();

        expect(result).toEqual([]);
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[MexcAccountApi] Failed to get top assets:',
          expect.any(Error)
        );
      });
    });

    describe('hasSufficientBalance', () => {
      it('should return true when balance is sufficient', async () => {
        vi.spyOn(accountApi, 'getAssetBalance').mockResolvedValue({
          free: '10.0',
          locked: '2.0',
        });

        const result = await accountApi.hasSufficientBalance('BTC', 5.0);

        expect(result).toBe(true);
      });

      it('should return false when balance is insufficient', async () => {
        vi.spyOn(accountApi, 'getAssetBalance').mockResolvedValue({
          free: '3.0',
          locked: '2.0',
        });

        const result = await accountApi.hasSufficientBalance('BTC', 5.0);

        expect(result).toBe(false);
      });

      it('should return false when asset balance is not found', async () => {
        vi.spyOn(accountApi, 'getAssetBalance').mockResolvedValue(null);

        const result = await accountApi.hasSufficientBalance('BTC', 5.0);

        expect(result).toBe(false);
      });

      it('should handle errors gracefully', async () => {
        vi.spyOn(accountApi, 'getAssetBalance').mockRejectedValue(new Error('Network error'));

        const result = await accountApi.hasSufficientBalance('BTC', 5.0);

        expect(result).toBe(false);
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[MexcAccountApi] Failed to check balance sufficiency:',
          expect.any(Error)
        );
      });
    });
  });
});