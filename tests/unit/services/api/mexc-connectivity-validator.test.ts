/**
 * Unit tests for MEXC Connectivity Validator
 * Tests comprehensive connectivity validation, authentication, balance access, trading capabilities, and error handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  MexcConnectivityValidator,
  createConnectivityValidator,
  getGlobalConnectivityValidator,
  resetGlobalConnectivityValidator,
  type ConnectivityValidationResult,
} from '../../../../src/services/api/mexc-connectivity-validator';

// Mock dependencies
vi.mock('@/src/lib/error-type-utils', () => ({
  toSafeError: vi.fn((error) => ({ 
    message: error instanceof Error ? error.message : String(error) 
  })),
}));

vi.mock('../../../../src/services/api/unified-mexc-service-factory', () => ({
  getUnifiedMexcService: vi.fn(),
}));

// Import mocked functions
import { toSafeError } from '@/src/lib/error-type-utils';
import { getUnifiedMexcService } from '../../../../src/services/api/unified-mexc-service-factory';

describe('MEXC Connectivity Validator', () => {
  let mockConsole: any;
  let validator: MexcConnectivityValidator;
  let mockMexcService: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();

    // Store original environment
    originalEnv = { ...process.env };

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

    // Mock MEXC service
    mockMexcService = {
      testConnectivity: vi.fn(),
      getServerTime: vi.fn(),
      getAccountInfo: vi.fn(),
      getAccountBalances: vi.fn(),
      getExchangeInfo: vi.fn(),
    };

    vi.mocked(getUnifiedMexcService).mockResolvedValue(mockMexcService);

    validator = new MexcConnectivityValidator();

    // Reset global validator
    resetGlobalConnectivityValidator();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    
    // Restore original environment
    process.env = originalEnv;
    
    resetGlobalConnectivityValidator();
  });

  describe('Constructor and Configuration', () => {
    it('should create validator with default configuration', () => {
      expect(validator).toBeDefined();
      expect(validator).toBeInstanceOf(MexcConnectivityValidator);
    });

    it('should create validator with custom options', () => {
      const customValidator = new MexcConnectivityValidator({
        timeout: 30000,
        minPositionSize: 50,
      });

      expect(customValidator).toBeDefined();
      expect(customValidator).toBeInstanceOf(MexcConnectivityValidator);
    });

    it('should have proper default configuration', () => {
      expect(validator['timeout']).toBe(15000);
      expect(validator['minPositionSize']).toBe(10);
    });

    it('should apply custom configuration correctly', () => {
      const customValidator = new MexcConnectivityValidator({
        timeout: 25000,
        minPositionSize: 100,
      });

      expect(customValidator['timeout']).toBe(25000);
      expect(customValidator['minPositionSize']).toBe(100);
    });
  });

  describe('validateConnectivity - Full Flow', () => {
    beforeEach(() => {
      // Mock successful responses by default
      mockMexcService.testConnectivity.mockResolvedValue(true);
      mockMexcService.getServerTime.mockResolvedValue(Date.now());
      mockMexcService.getAccountInfo.mockResolvedValue({
        success: true,
        data: {
          accountType: 'SPOT',
          canTrade: true,
          permissions: ['SPOT', 'MARGIN'],
        },
      });
      mockMexcService.getAccountBalances.mockResolvedValue({
        success: true,
        data: {
          balances: [
            { asset: 'USDT', free: '100.0', locked: '0.0' },
            { asset: 'BTC', free: '0.001', locked: '0.0' },
          ],
        },
      });
      mockMexcService.getExchangeInfo.mockResolvedValue({
        success: true,
        data: [
          { symbol: 'BTCUSDT', status: 'TRADING' },
          { symbol: 'ETHUSDT', status: 'TRADING' },
          { symbol: 'ADAUSDT', status: 'TRADING' },
        ],
      });
    });

    it('should perform complete successful validation', async () => {
      const result = await validator.validateConnectivity({
        userId: 'user-123',
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
      });

      expect(result.overall).toBe('READY');
      expect(result.connectivity).toMatchObject({
        apiReachable: true,
        responseTime: expect.any(Number),
        serverTime: expect.any(Number),
      });
      expect(result.authentication).toMatchObject({
        valid: true,
        accountAccessible: true,
        permissions: ['SPOT', 'MARGIN'],
        accountType: 'SPOT',
        canTrade: true,
      });
      expect(result.balances).toMatchObject({
        accessible: true,
        totalAssets: 2,
        usdtBalance: 100.0,
        sufficientForTrading: true,
      });
      expect(result.trading).toMatchObject({
        ordersAllowed: true,
        hasUsdtPairs: true,
        tradingStatus: 'available',
      });
      expect(result.errors).toHaveLength(0);
      expect(result.recommendations).toContain('System is ready for auto-sniping operations');
    });

    it('should handle connectivity failure gracefully', async () => {
      mockMexcService.testConnectivity.mockResolvedValue(false);

      const result = await validator.validateConnectivity();

      expect(result.overall).toBe('BLOCKED');
      expect(result.connectivity.apiReachable).toBe(false);
      expect(result.authentication.valid).toBe(false);
      expect(result.balances.accessible).toBe(false);
      expect(result.trading.ordersAllowed).toBe(false);
      expect(result.errors).toContain('Cannot reach MEXC API endpoints');
      expect(result.recommendations).toContain('Check internet connectivity and DNS resolution');
    });

    it('should handle authentication failure', async () => {
      mockMexcService.getAccountInfo.mockResolvedValue({
        success: false,
        error: '700002: Signature for this request is not valid',
      });

      const result = await validator.validateConnectivity();

      expect(result.overall).toBe('BLOCKED');
      expect(result.connectivity.apiReachable).toBe(true);
      expect(result.authentication.valid).toBe(false);
      expect(result.balances.accessible).toBe(false);
      expect(result.errors).toContain('Authentication failed: 700002: Signature for this request is not valid');
      expect(result.recommendations).toContain('Check API credentials and ensure server time synchronization');
    });

    it('should handle balance access failure', async () => {
      mockMexcService.getAccountBalances.mockResolvedValue({
        success: false,
        error: 'Permission denied',
      });

      const result = await validator.validateConnectivity();

      expect(result.overall).toBe('BLOCKED');
      expect(result.connectivity.apiReachable).toBe(true);
      expect(result.authentication.valid).toBe(true);
      expect(result.balances.accessible).toBe(false);
      expect(result.errors).toContain('Balance access failed: Permission denied');
    });

    it('should handle insufficient USDT balance', async () => {
      mockMexcService.getAccountBalances.mockResolvedValue({
        success: true,
        data: {
          balances: [
            { asset: 'USDT', free: '5.0', locked: '0.0' }, // Less than minimum
            { asset: 'BTC', free: '0.001', locked: '0.0' },
          ],
        },
      });

      const result = await validator.validateConnectivity();

      expect(result.overall).toBe('PARTIAL');
      expect(result.balances.accessible).toBe(true);
      expect(result.balances.usdtBalance).toBe(5.0);
      expect(result.balances.sufficientForTrading).toBe(false);
      expect(result.warnings).toContain('USDT balance (5) below minimum trading amount (10)');
      expect(result.recommendations).toContain('Deposit more USDT or reduce position size');
    });

    it('should handle missing USDT balance', async () => {
      mockMexcService.getAccountBalances.mockResolvedValue({
        success: true,
        data: {
          balances: [
            { asset: 'BTC', free: '0.001', locked: '0.0' },
            { asset: 'ETH', free: '0.1', locked: '0.0' },
          ],
        },
      });

      const result = await validator.validateConnectivity();

      expect(result.overall).toBe('PARTIAL');
      expect(result.balances.usdtBalance).toBeUndefined();
      expect(result.warnings).toContain('No USDT balance found');
      expect(result.recommendations).toContain('Deposit USDT to enable trading');
    });

    it('should handle trading capability failure', async () => {
      mockMexcService.getExchangeInfo.mockResolvedValue({
        success: false,
        error: 'Exchange info unavailable',
      });

      const result = await validator.validateConnectivity();

      expect(result.overall).toBe('PARTIAL');
      expect(result.trading.tradingStatus).toBe('unknown');
      expect(result.warnings).toContain('Trading capability check failed: Exchange info unavailable');
    });

    it('should handle account with trading disabled', async () => {
      mockMexcService.getAccountInfo.mockResolvedValue({
        success: true,
        data: {
          accountType: 'SPOT',
          canTrade: false, // Trading disabled
          permissions: ['SPOT'],
        },
      });

      const result = await validator.validateConnectivity();

      expect(result.overall).toBe('PARTIAL');
      expect(result.authentication.canTrade).toBe(false);
      expect(result.trading.ordersAllowed).toBe(false);
      expect(result.warnings).toContain('Account trading is disabled');
      expect(result.recommendations).toContain('Enable trading permissions in MEXC account settings');
    });

    it('should handle no USDT trading pairs', async () => {
      mockMexcService.getExchangeInfo.mockResolvedValue({
        success: true,
        data: [
          { symbol: 'BTCETH', status: 'TRADING' },
          { symbol: 'ADABTC', status: 'TRADING' },
        ],
      });

      const result = await validator.validateConnectivity();

      expect(result.overall).toBe('PARTIAL');
      expect(result.trading.hasUsdtPairs).toBe(false);
      expect(result.warnings).toContain('No USDT trading pairs available');
      expect(result.recommendations).toContain('Check MEXC exchange status');
    });
  });

  describe('Individual Error Scenarios', () => {
    it('should handle connectivity test exception', async () => {
      mockMexcService.testConnectivity.mockRejectedValue(new Error('Network timeout'));

      const result = await validator.validateConnectivity();

      expect(result.overall).toBe('BLOCKED');
      expect(result.connectivity.apiReachable).toBe(false);
      expect(result.errors).toContain('Connectivity test failed: Network timeout');
    });

    it('should handle server time retrieval failure', async () => {
      mockMexcService.getServerTime.mockRejectedValue(new Error('Server time unavailable'));

      const result = await validator.validateConnectivity();

      expect(result.connectivity.apiReachable).toBe(true);
      expect(result.connectivity.serverTime).toBeUndefined();
      expect(mockConsole.warn).toHaveBeenCalledWith(
        '[MexcConnectivityValidator] Could not get server time:',
        expect.any(Error)
      );
    });

    it('should provide specific error guidance for IP restrictions', async () => {
      mockMexcService.getAccountInfo.mockResolvedValue({
        success: false,
        error: 'IP address not allowed',
      });

      const result = await validator.validateConnectivity();

      expect(result.recommendations).toContain('Ensure your IP address is allowlisted for the API key');
    });

    it('should handle authentication test exception', async () => {
      mockMexcService.getAccountInfo.mockRejectedValue(new Error('Request timeout'));

      const result = await validator.validateConnectivity();

      expect(result.errors).toContain('Authentication test failed: Request timeout');
    });

    it('should handle balance test exception', async () => {
      mockMexcService.getAccountBalances.mockRejectedValue(new Error('Database error'));

      const result = await validator.validateConnectivity();

      expect(result.errors).toContain('Balance test failed: Database error');
    });

    it('should handle trading test exception', async () => {
      mockMexcService.getExchangeInfo.mockRejectedValue(new Error('API rate limit'));

      const result = await validator.validateConnectivity();

      expect(result.warnings).toContain('Trading test failed: API rate limit');
    });

    it('should handle complete validation failure', async () => {
      vi.mocked(getUnifiedMexcService).mockRejectedValue(new Error('Service unavailable'));

      const result = await validator.validateConnectivity();

      expect(result.overall).toBe('BLOCKED');
      expect(result.errors).toContain('Validation failed: Service unavailable');
      expect(result.recommendations).toContain('Check network connectivity and API credentials');
    });
  });

  describe('Overall Status Determination', () => {
    beforeEach(() => {
      mockMexcService.testConnectivity.mockResolvedValue(true);
      mockMexcService.getServerTime.mockResolvedValue(Date.now());
    });

    it('should return READY status for perfect setup', async () => {
      mockMexcService.getAccountInfo.mockResolvedValue({
        success: true,
        data: { accountType: 'SPOT', canTrade: true, permissions: ['SPOT'] },
      });
      mockMexcService.getAccountBalances.mockResolvedValue({
        success: true,
        data: { balances: [{ asset: 'USDT', free: '1000.0', locked: '0.0' }] },
      });
      mockMexcService.getExchangeInfo.mockResolvedValue({
        success: true,
        data: [{ symbol: 'BTCUSDT', status: 'TRADING' }],
      });

      const result = await validator.validateConnectivity();

      expect(result.overall).toBe('READY');
      expect(result.recommendations).toContain('System is ready for auto-sniping operations');
    });

    it('should return PARTIAL status with warnings', async () => {
      mockMexcService.getAccountInfo.mockResolvedValue({
        success: true,
        data: { accountType: 'SPOT', canTrade: true, permissions: ['SPOT'] },
      });
      mockMexcService.getAccountBalances.mockResolvedValue({
        success: true,
        data: { balances: [{ asset: 'USDT', free: '5.0', locked: '0.0' }] }, // Insufficient
      });
      mockMexcService.getExchangeInfo.mockResolvedValue({
        success: true,
        data: [{ symbol: 'BTCUSDT', status: 'TRADING' }],
      });

      const result = await validator.validateConnectivity();

      expect(result.overall).toBe('PARTIAL');
      expect(result.recommendations).toContain('Address warnings to ensure optimal trading performance');
    });

    it('should return BLOCKED status with errors', async () => {
      mockMexcService.getAccountInfo.mockResolvedValue({
        success: false,
        error: 'Invalid API key',
      });

      const result = await validator.validateConnectivity();

      expect(result.overall).toBe('BLOCKED');
      expect(result.recommendations).toContain('Resolve critical issues before enabling auto-sniping');
    });
  });

  describe('quickConnectivityCheck', () => {
    beforeEach(() => {
      mockMexcService.testConnectivity.mockResolvedValue(true);
      mockMexcService.getAccountInfo.mockResolvedValue({
        success: true,
        data: { accountType: 'SPOT' },
      });
    });

    it('should perform quick connectivity check successfully', async () => {
      const result = await validator.quickConnectivityCheck({
        userId: 'user-123',
        apiKey: 'test-key',
        secretKey: 'test-secret',
      });

      expect(result).toMatchObject({
        connected: true,
        authenticated: true,
      });
      expect(result.error).toBeUndefined();

      expect(getUnifiedMexcService).toHaveBeenCalledWith({
        userId: 'user-123',
        apiKey: 'test-key',
        secretKey: 'test-secret',
        skipCache: true,
      });
    });

    it('should handle connectivity failure in quick check', async () => {
      mockMexcService.testConnectivity.mockResolvedValue(false);

      const result = await validator.quickConnectivityCheck();

      expect(result).toMatchObject({
        connected: false,
        authenticated: false,
        error: 'API not reachable',
      });
    });

    it('should handle complex connectivity response', async () => {
      mockMexcService.testConnectivity.mockResolvedValue({ success: true });

      const result = await validator.quickConnectivityCheck();

      expect(result.connected).toBe(true);
    });

    it('should handle authentication failure in quick check', async () => {
      mockMexcService.getAccountInfo.mockResolvedValue({
        success: false,
        error: 'Invalid signature',
      });

      const result = await validator.quickConnectivityCheck();

      expect(result).toMatchObject({
        connected: true,
        authenticated: false,
        error: 'Invalid signature',
      });
    });

    it('should handle exceptions in quick check', async () => {
      vi.mocked(getUnifiedMexcService).mockRejectedValue(new Error('Service error'));

      const result = await validator.quickConnectivityCheck();

      expect(result).toMatchObject({
        connected: false,
        authenticated: false,
        error: 'Service error',
      });
    });
  });

  describe('testCredentials', () => {
    beforeEach(() => {
      mockMexcService.getAccountInfo.mockResolvedValue({
        success: true,
        data: { accountType: 'SPOT', canTrade: true },
      });
    });

    it('should test credentials successfully', async () => {
      const result = await validator.testCredentials('test-api-key', 'test-secret-key');

      expect(result).toMatchObject({
        valid: true,
        details: { accountType: 'SPOT', canTrade: true },
      });
      expect(result.error).toBeUndefined();

      expect(getUnifiedMexcService).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
        skipCache: true,
      });
    });

    it('should handle invalid credentials', async () => {
      mockMexcService.getAccountInfo.mockResolvedValue({
        success: false,
        error: 'Invalid API key',
      });

      const result = await validator.testCredentials('invalid-key', 'invalid-secret');

      expect(result).toMatchObject({
        valid: false,
        error: 'Invalid API key',
      });
    });

    it('should handle credential test exceptions', async () => {
      vi.mocked(getUnifiedMexcService).mockRejectedValue(new Error('Network error'));

      const result = await validator.testCredentials('test-key', 'test-secret');

      expect(result).toMatchObject({
        valid: false,
        error: 'Network error',
      });
    });
  });

  describe('Factory Functions', () => {
    it('should create validator with default configuration', () => {
      const validator = createConnectivityValidator();

      expect(validator).toBeInstanceOf(MexcConnectivityValidator);
    });

    it('should create validator with custom configuration', () => {
      const customConfig = {
        timeout: 30000,
        minPositionSize: 50,
      };

      const validator = createConnectivityValidator(customConfig);

      expect(validator).toBeInstanceOf(MexcConnectivityValidator);
      expect(validator['timeout']).toBe(30000);
      expect(validator['minPositionSize']).toBe(50);
    });

    it('should return global singleton instance', () => {
      const instance1 = getGlobalConnectivityValidator();
      const instance2 = getGlobalConnectivityValidator();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(MexcConnectivityValidator);
    });

    it('should use environment variable for position size', () => {
      process.env.AUTO_SNIPING_POSITION_SIZE_USDT = '25';

      resetGlobalConnectivityValidator();
      const instance = getGlobalConnectivityValidator();

      expect(instance['minPositionSize']).toBe(25);
    });

    it('should reset global instance', () => {
      const instance1 = getGlobalConnectivityValidator();
      resetGlobalConnectivityValidator();
      const instance2 = getGlobalConnectivityValidator();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete flow with all features enabled', async () => {
      // Setup comprehensive mock responses
      mockMexcService.testConnectivity.mockResolvedValue(true);
      mockMexcService.getServerTime.mockResolvedValue(1640995200000);
      mockMexcService.getAccountInfo.mockResolvedValue({
        success: true,
        data: {
          accountType: 'SPOT',
          canTrade: true,
          permissions: ['SPOT', 'MARGIN', 'FUTURES'],
        },
      });
      mockMexcService.getAccountBalances.mockResolvedValue({
        success: true,
        data: {
          balances: [
            { asset: 'USDT', free: '5000.0', locked: '100.0' },
            { asset: 'BTC', free: '0.5', locked: '0.0' },
            { asset: 'ETH', free: '10.0', locked: '2.0' },
          ],
        },
      });
      mockMexcService.getExchangeInfo.mockResolvedValue({
        success: true,
        data: [
          { symbol: 'BTCUSDT', status: 'TRADING' },
          { symbol: 'ETHUSDT', status: 'TRADING' },
          { symbol: 'ADAUSDT', status: 'TRADING' },
          { symbol: 'DOGEUSDT', status: 'TRADING' },
        ],
      });

      const result = await validator.validateConnectivity({
        userId: 'user-123',
        apiKey: 'production-api-key',
        secretKey: 'production-secret-key',
        skipCache: true,
      });

      expect(result).toMatchObject({
        overall: 'READY',
        connectivity: {
          apiReachable: true,
          responseTime: expect.any(Number),
          serverTime: 1640995200000,
        },
        authentication: {
          valid: true,
          accountAccessible: true,
          permissions: ['SPOT', 'MARGIN', 'FUTURES'],
          accountType: 'SPOT',
          canTrade: true,
        },
        balances: {
          accessible: true,
          totalAssets: 3,
          usdtBalance: 5100.0,
          sufficientForTrading: true,
        },
        trading: {
          ordersAllowed: true,
          hasUsdtPairs: true,
          tradingStatus: 'available',
        },
        errors: [],
        warnings: [],
        timestamp: expect.any(String),
      });

      expect(result.recommendations).toContain('System is ready for auto-sniping operations');

      // Verify all services were called correctly
      expect(getUnifiedMexcService).toHaveBeenCalledWith({
        userId: 'user-123',
        apiKey: 'production-api-key',
        secretKey: 'production-secret-key',
        skipCache: true,
      });
      expect(mockMexcService.testConnectivity).toHaveBeenCalled();
      expect(mockMexcService.getServerTime).toHaveBeenCalled();
      expect(mockMexcService.getAccountInfo).toHaveBeenCalled();
      expect(mockMexcService.getAccountBalances).toHaveBeenCalled();
      expect(mockMexcService.getExchangeInfo).toHaveBeenCalled();
    });

    it('should handle partial setup with mixed success/failure', async () => {
      mockMexcService.testConnectivity.mockResolvedValue(true);
      mockMexcService.getServerTime.mockRejectedValue(new Error('Server time unavailable'));
      mockMexcService.getAccountInfo.mockResolvedValue({
        success: true,
        data: { accountType: 'SPOT', canTrade: false, permissions: ['SPOT'] },
      });
      mockMexcService.getAccountBalances.mockResolvedValue({
        success: true,
        data: { balances: [{ asset: 'BTC', free: '0.001', locked: '0.0' }] },
      });
      mockMexcService.getExchangeInfo.mockResolvedValue({
        success: false,
        error: 'Rate limit exceeded',
      });

      const result = await validator.validateConnectivity();

      expect(result.overall).toBe('PARTIAL');
      expect(result.connectivity.apiReachable).toBe(true);
      expect(result.connectivity.serverTime).toBeUndefined();
      expect(result.authentication.valid).toBe(true);
      expect(result.authentication.canTrade).toBe(false);
      expect(result.balances.accessible).toBe(true);
      expect(result.trading.tradingStatus).toBe('unknown');
      expect(result.warnings).toContain('Account trading is disabled');
      expect(result.warnings).toContain('No USDT balance found');
      expect(result.warnings).toContain('Trading capability check failed: Rate limit exceeded');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle custom validator configuration correctly', async () => {
      const customValidator = new MexcConnectivityValidator({
        timeout: 5000,
        minPositionSize: 100,
      });

      mockMexcService.testConnectivity.mockResolvedValue(true);
      mockMexcService.getAccountInfo.mockResolvedValue({
        success: true,
        data: { accountType: 'SPOT', canTrade: true, permissions: ['SPOT'] },
      });
      mockMexcService.getAccountBalances.mockResolvedValue({
        success: true,
        data: { balances: [{ asset: 'USDT', free: '50.0', locked: '0.0' }] },
      });
      mockMexcService.getExchangeInfo.mockResolvedValue({
        success: true,
        data: [{ symbol: 'BTCUSDT', status: 'TRADING' }],
      });

      const result = await customValidator.validateConnectivity();

      expect(result.overall).toBe('PARTIAL');
      expect(result.balances.sufficientForTrading).toBe(false);
      expect(result.warnings).toContain('USDT balance (50) below minimum trading amount (100)');
    });

    it('should handle malformed balance data', async () => {
      mockMexcService.testConnectivity.mockResolvedValue(true);
      mockMexcService.getAccountInfo.mockResolvedValue({
        success: true,
        data: { accountType: 'SPOT', canTrade: true, permissions: ['SPOT'] },
      });
      mockMexcService.getAccountBalances.mockResolvedValue({
        success: true,
        data: null,
      });

      const result = await validator.validateConnectivity();

      expect(result.balances.accessible).toBe(true);
      expect(result.balances.totalAssets).toBe(0);
    });

    it('should handle empty exchange info', async () => {
      mockMexcService.testConnectivity.mockResolvedValue(true);
      mockMexcService.getAccountInfo.mockResolvedValue({
        success: true,
        data: { accountType: 'SPOT', canTrade: true, permissions: ['SPOT'] },
      });
      mockMexcService.getAccountBalances.mockResolvedValue({
        success: true,
        data: { balances: [{ asset: 'USDT', free: '100.0', locked: '0.0' }] },
      });
      mockMexcService.getExchangeInfo.mockResolvedValue({
        success: true,
        data: [],
      });

      const result = await validator.validateConnectivity();

      expect(result.trading.hasUsdtPairs).toBe(false);
      expect(result.warnings).toContain('No USDT trading pairs available');
    });
  });
});