/**
 * Unit tests for API Credentials Test Service
 * Tests credential testing, validation, connectivity checks, authentication tests, and error handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  ApiCredentialsTestService,
  apiCredentialsTestService,
  type CredentialTestContext,
  type CredentialRetrievalResult,
  type ConnectivityTestResult,
  type AuthenticationTestResult,
} from '../../../../src/services/api/api-credentials-test-service';
import type {
  ApiCredentialsTestRequest,
  ApiCredentialsTestResponse,
} from '@/src/schemas/mexc-api-validation-schemas';

// Mock dependencies
vi.mock('@/src/schemas/mexc-api-validation-schemas', () => ({
  ApiCredentialsTestResponseSchema: {},
  validateMexcApiResponse: vi.fn(() => ({ success: true })),
}));

vi.mock('@/src/services/notification/status-synchronization-service', () => ({
  syncAfterCredentialTest: vi.fn(),
}));

vi.mock('../../../../src/services/api/unified-mexc-service-factory', () => ({
  getUnifiedMexcService: vi.fn(),
  invalidateUserCredentialsCache: vi.fn(),
}));

vi.mock('../../../../src/services/api/user-credentials-service', () => ({
  getUserCredentials: vi.fn(),
}));

// Import mocked functions for use in tests
import { syncAfterCredentialTest } from '@/src/services/notification/status-synchronization-service';
import { getUnifiedMexcService, invalidateUserCredentialsCache } from '../../../../src/services/api/unified-mexc-service-factory';
import { getUserCredentials } from '../../../../src/services/api/user-credentials-service';
import { validateMexcApiResponse } from '@/src/schemas/mexc-api-validation-schemas';

describe('API Credentials Test Service', () => {
  let mockConsole: any;
  let testService: ApiCredentialsTestService;

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

    testService = new ApiCredentialsTestService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Singleton', () => {
    it('should create service instance successfully', () => {
      expect(testService).toBeDefined();
      expect(testService).toBeInstanceOf(ApiCredentialsTestService);
    });

    it('should export singleton instance', () => {
      expect(apiCredentialsTestService).toBeDefined();
      expect(apiCredentialsTestService).toBeInstanceOf(ApiCredentialsTestService);
    });

    it('should have logger methods defined', () => {
      expect(testService['logger']).toBeDefined();
      expect(typeof testService['logger'].info).toBe('function');
      expect(typeof testService['logger'].warn).toBe('function');
      expect(typeof testService['logger'].error).toBe('function');
      expect(typeof testService['logger'].debug).toBe('function');
    });
  });

  describe('testCredentials', () => {
    const mockRequest: ApiCredentialsTestRequest = {
      userId: 'user-123',
      provider: 'mexc',
    };

    const mockCredentials = {
      apiKey: 'test-api-key',
      secretKey: 'test-secret-key',
      provider: 'mexc',
      isActive: true,
    };

    const mockMexcService = {
      testConnectivity: vi.fn(),
      getAccountBalances: vi.fn(),
    };

    const mockSyncResult = {
      success: true,
      cacheInvalidated: true,
      timestamp: Date.now(),
      triggeredBy: 'credential_test',
      servicesNotified: 3,
      statusRefreshed: true,
    };

    beforeEach(() => {
      vi.mocked(getUserCredentials).mockResolvedValue(mockCredentials);
      vi.mocked(getUnifiedMexcService).mockResolvedValue(mockMexcService);
      vi.mocked(syncAfterCredentialTest).mockResolvedValue(mockSyncResult);
      vi.mocked(validateMexcApiResponse).mockReturnValue({ success: true });

      mockMexcService.testConnectivity.mockResolvedValue({
        success: true,
        data: { serverTime: Date.now() },
      });

      mockMexcService.getAccountBalances.mockResolvedValue({
        success: true,
        data: [
          { free: '100.0', locked: '0.0', asset: 'USDT' },
          { free: '0.0', locked: '0.0', asset: 'BTC' },
        ],
      });
    });

    it('should successfully test credentials with all validations', async () => {
      const result = await testService.testCredentials(mockRequest, 'user-123');

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        connectivity: true,
        authentication: true,
        accountType: 'spot',
        canTrade: true,
        balanceCount: 2,
        totalAssets: 2,
        hasNonZeroBalances: true,
        permissions: ['SPOT'],
        credentialSource: 'database',
      });

      expect(result.data?.statusSync).toMatchObject({
        success: true,
        cacheInvalidated: true,
        servicesNotified: 3,
        statusRefreshed: true,
      });
    });

    it('should deny access for unauthorized user', async () => {
      const result = await testService.testCredentials(mockRequest, 'different-user-456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Access denied');
      expect(result.code).toBe('ACCESS_DENIED');
      expect(result.details).toMatchObject({
        message: 'You can only test your own API credentials',
        authenticatedUserId: 'different-user-456',
        requestedUserId: 'user-123',
      });

      expect(getUserCredentials).not.toHaveBeenCalled();
    });

    it('should handle missing credentials', async () => {
      vi.mocked(getUserCredentials).mockResolvedValue(null);

      const result = await testService.testCredentials(mockRequest, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No API credentials found');
      expect(result.code).toBe('NO_CREDENTIALS');
      expect(result.details).toMatchObject({
        userId: 'user-123',
        provider: 'mexc',
      });
    });

    it('should handle credential retrieval errors', async () => {
      vi.mocked(getUserCredentials).mockRejectedValue(new Error('Database connection failed'));

      const result = await testService.testCredentials(mockRequest, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
      expect(result.code).toBe('CREDENTIAL_RETRIEVAL_ERROR');
    });

    it('should handle connectivity test failure gracefully', async () => {
      mockMexcService.testConnectivity.mockResolvedValue({
        success: false,
        error: 'Network timeout',
      });

      const result = await testService.testCredentials(mockRequest, 'user-123');

      expect(result.success).toBe(true);
      expect(result.data?.connectivity).toBe(false);
      expect(result.data?.authentication).toBe(true);
      expect(result.data?.connectivityNote).toContain('could not be verified, but credentials are valid');
    });

    it('should handle authentication failure', async () => {
      mockMexcService.getAccountBalances.mockResolvedValue({
        success: false,
        error: 'Signature for this request is not valid',
      });

      const result = await testService.testCredentials(mockRequest, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('signature validation failed');
      expect(result.code).toBe('SIGNATURE_ERROR');
      expect(result.details).toMatchObject({
        connectivity: true,
        authentication: false,
        step: 'authentication_test',
      });
    });

    it('should handle authentication with empty balances', async () => {
      mockMexcService.getAccountBalances.mockResolvedValue({
        success: true,
        data: [],
      });

      const result = await testService.testCredentials(mockRequest, 'user-123');

      expect(result.success).toBe(true);
      expect(result.data?.balanceCount).toBe(0);
      expect(result.data?.totalAssets).toBe(0);
      expect(result.data?.hasNonZeroBalances).toBe(false);
      expect(result.data?.canTrade).toBe(true);
    });

    it('should handle authentication with zero balances', async () => {
      mockMexcService.getAccountBalances.mockResolvedValue({
        success: true,
        data: [
          { free: '0.0', locked: '0.0', asset: 'USDT' },
          { free: '0.0', locked: '0.0', asset: 'BTC' },
        ],
      });

      const result = await testService.testCredentials(mockRequest, 'user-123');

      expect(result.success).toBe(true);
      expect(result.data?.hasNonZeroBalances).toBe(false);
      expect(result.data?.balanceCount).toBe(2);
    });

    it('should handle unexpected errors gracefully', async () => {
      vi.mocked(getUserCredentials).mockImplementation(() => {
        throw new Error('Unexpected system error');
      });

      const result = await testService.testCredentials(mockRequest, 'user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('API credentials test failed');
      expect(result.code).toBe('TEST_ERROR');
      expect(result.details).toMatchObject({
        message: 'Unexpected system error',
      });
    });

    it('should validate response structure', async () => {
      vi.mocked(validateMexcApiResponse).mockReturnValue({
        success: false,
        error: 'Invalid response structure',
      });

      const result = await testService.testCredentials(mockRequest, 'user-123');

      expect(result.success).toBe(true);
      expect(mockConsole.error).toHaveBeenCalledWith(
        '[CredentialTestService] Response validation failed:',
        'Invalid response structure'
      );
    });

    it('should invalidate cache and sync status after successful test', async () => {
      await testService.testCredentials(mockRequest, 'user-123');

      expect(invalidateUserCredentialsCache).toHaveBeenCalledWith('user-123');
      expect(syncAfterCredentialTest).toHaveBeenCalledWith(
        'user-123',
        'mexc',
        expect.stringMatching(/^cred_test_/)
      );
    });

    it('should track execution time and context', async () => {
      const startTime = Date.now();
      await testService.testCredentials(mockRequest, 'user-123');

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[CredentialTestService] Starting credential test',
        expect.objectContaining({
          requestId: expect.stringMatching(/^cred_test_/),
          userId: 'user-123',
          provider: 'mexc',
          authenticatedUserId: 'user-123',
          timestamp: expect.any(String),
        })
      );

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[CredentialTestService] Credential test completed successfully',
        expect.objectContaining({
          requestId: expect.stringMatching(/^cred_test_/),
          duration: expect.stringMatching(/^\d+ms$/),
          connectivity: true,
          authentication: true,
        })
      );
    });
  });

  describe('Error Message Mapping', () => {
    beforeEach(() => {
      vi.mocked(getUserCredentials).mockResolvedValue({
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
        provider: 'mexc',
        isActive: true,
      });

      vi.mocked(getUnifiedMexcService).mockResolvedValue({
        testConnectivity: vi.fn().mockResolvedValue({ success: true }),
        getAccountBalances: vi.fn(),
      });
    });

    it('should map signature error correctly', async () => {
      const mockService = await vi.mocked(getUnifiedMexcService)();
      vi.mocked(mockService.getAccountBalances).mockResolvedValue({
        success: false,
        error: '700002: Signature for this request is not valid',
      });

      const result = await testService.testCredentials(
        { userId: 'user-123', provider: 'mexc' },
        'user-123'
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe('SIGNATURE_ERROR');
      expect(result.error).toContain('signature validation failed');
    });

    it('should map invalid API key error correctly', async () => {
      const mockService = await vi.mocked(getUnifiedMexcService)();
      vi.mocked(mockService.getAccountBalances).mockResolvedValue({
        success: false,
        error: '10072: Api key info invalid',
      });

      const result = await testService.testCredentials(
        { userId: 'user-123', provider: 'mexc' },
        'user-123'
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_API_KEY');
      expect(result.error).toContain('API key is invalid or expired');
    });

    it('should use generic error message for unknown errors', async () => {
      const mockService = await vi.mocked(getUnifiedMexcService)();
      vi.mocked(mockService.getAccountBalances).mockResolvedValue({
        success: false,
        error: 'Unknown MEXC error',
      });

      const result = await testService.testCredentials(
        { userId: 'user-123', provider: 'mexc' },
        'user-123'
      );

      expect(result.success).toBe(false);
      expect(result.code).toBe('AUTHENTICATION_ERROR');
      expect(result.error).toBe('Failed to authenticate with MEXC API');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete successful flow with all features', async () => {
      const mockCredentials = {
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
        provider: 'mexc',
        isActive: true,
      };

      const mockService = {
        testConnectivity: vi.fn().mockResolvedValue({
          success: true,
          data: { serverTime: 1640995200000, latency: 50 },
        }),
        getAccountBalances: vi.fn().mockResolvedValue({
          success: true,
          data: [
            { free: '1000.0', locked: '100.0', asset: 'USDT' },
            { free: '0.5', locked: '0.0', asset: 'BTC' },
            { free: '0.0', locked: '0.0', asset: 'ETH' },
          ],
        }),
      };

      const mockSyncResult = {
        success: true,
        cacheInvalidated: true,
        timestamp: Date.now(),
        triggeredBy: 'credential_test',
        servicesNotified: 5,
        statusRefreshed: true,
      };

      vi.mocked(getUserCredentials).mockResolvedValue(mockCredentials);
      vi.mocked(getUnifiedMexcService).mockResolvedValue(mockService);
      vi.mocked(syncAfterCredentialTest).mockResolvedValue(mockSyncResult);

      const result = await testService.testCredentials(
        { userId: 'user-123', provider: 'mexc' },
        'user-123'
      );

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        connectivity: true,
        authentication: true,
        accountType: 'spot',
        canTrade: true,
        balanceCount: 3,
        totalAssets: 3,
        hasNonZeroBalances: true,
        permissions: ['SPOT'],
        credentialSource: 'database',
        connectivityNote: 'MEXC API connectivity verified',
        statusSync: {
          success: true,
          cacheInvalidated: true,
          servicesNotified: 5,
          statusRefreshed: true,
        },
      });

      // Verify all external services were called correctly
      expect(getUserCredentials).toHaveBeenCalledWith('user-123', 'mexc');
      expect(getUnifiedMexcService).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
        skipCache: true,
      });
      expect(invalidateUserCredentialsCache).toHaveBeenCalledWith('user-123');
      expect(syncAfterCredentialTest).toHaveBeenCalledWith(
        'user-123',
        'mexc',
        expect.stringMatching(/^cred_test_/)
      );
    });

    it('should handle partial connectivity failure but successful authentication', async () => {
      const mockService = {
        testConnectivity: vi.fn().mockRejectedValue(new Error('Network timeout')),
        getAccountBalances: vi.fn().mockResolvedValue({
          success: true,
          data: [{ free: '100.0', locked: '0.0', asset: 'USDT' }],
        }),
      };

      vi.mocked(getUserCredentials).mockResolvedValue({
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
        provider: 'mexc',
        isActive: true,
      });
      vi.mocked(getUnifiedMexcService).mockResolvedValue(mockService);
      vi.mocked(syncAfterCredentialTest).mockResolvedValue({
        success: true,
        cacheInvalidated: true,
        timestamp: Date.now(),
        triggeredBy: 'credential_test',
        servicesNotified: 1,
        statusRefreshed: true,
      });

      const result = await testService.testCredentials(
        { userId: 'user-123', provider: 'mexc' },
        'user-123'
      );

      expect(result.success).toBe(true);
      expect(result.data?.connectivity).toBe(false);
      expect(result.data?.authentication).toBe(true);
      expect(result.data?.connectivityNote).toContain('could not be verified, but credentials are valid');
    });
  });

  describe('Advanced Error Handling and Edge Cases', () => {
    beforeEach(() => {
      vi.mocked(getUserCredentials).mockResolvedValue({
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
        provider: 'mexc',
        isActive: true,
      });
    });

    it('should handle service initialization errors', async () => {
      vi.mocked(getUnifiedMexcService).mockRejectedValue(new Error('Service initialization failed'));

      const result = await testService.testCredentials(
        { userId: 'user-123', provider: 'mexc' },
        'user-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('API credentials test failed');
      expect(result.code).toBe('TEST_ERROR');
    });

    it('should handle malformed balance data gracefully', async () => {
      const mockService = {
        testConnectivity: vi.fn().mockResolvedValue({ success: true }),
        getAccountBalances: vi.fn().mockResolvedValue({
          success: true,
          data: [
            { free: 'invalid-number', locked: '0.0', asset: 'BTC' },
            { free: '100.0', locked: null, asset: 'USDT' },
            { asset: 'ETH' }, // Missing free/locked fields
          ],
        }),
      };

      vi.mocked(getUnifiedMexcService).mockResolvedValue(mockService);
      vi.mocked(syncAfterCredentialTest).mockResolvedValue({
        success: true,
        cacheInvalidated: true,
        timestamp: Date.now(),
        triggeredBy: 'credential_test',
        servicesNotified: 1,
        statusRefreshed: true,
      });

      const result = await testService.testCredentials(
        { userId: 'user-123', provider: 'mexc' },
        'user-123'
      );

      expect(result.success).toBe(true);
      expect(result.data?.balanceCount).toBe(3);
      expect(result.data?.hasNonZeroBalances).toBe(true); // Should handle parsing gracefully
    });

    it('should handle non-Error credential retrieval failures', async () => {
      vi.mocked(getUserCredentials).mockRejectedValue('String error message');

      const result = await testService.testCredentials(
        { userId: 'user-123', provider: 'mexc' },
        'user-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to retrieve credentials');
      expect(result.code).toBe('CREDENTIAL_RETRIEVAL_ERROR');
    });

    it('should handle authentication exceptions', async () => {
      const mockService = {
        testConnectivity: vi.fn().mockResolvedValue({ success: true }),
        getAccountBalances: vi.fn().mockRejectedValue(new Error('Network connection reset')),
      };

      vi.mocked(getUnifiedMexcService).mockResolvedValue(mockService);

      const result = await testService.testCredentials(
        { userId: 'user-123', provider: 'mexc' },
        'user-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to authenticate with MEXC API');
      expect(result.details?.mexcError).toBe('Network connection reset');
    });

    it('should handle status synchronization failures gracefully', async () => {
      const mockService = {
        testConnectivity: vi.fn().mockResolvedValue({ success: true }),
        getAccountBalances: vi.fn().mockResolvedValue({
          success: true,
          data: [],
        }),
      };

      vi.mocked(getUnifiedMexcService).mockResolvedValue(mockService);
      vi.mocked(syncAfterCredentialTest).mockRejectedValue(new Error('Sync service unavailable'));

      const result = await testService.testCredentials(
        { userId: 'user-123', provider: 'mexc' },
        'user-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('API credentials test failed');
      expect(result.code).toBe('TEST_ERROR');
    });

    it('should handle undefined/null balance data', async () => {
      const mockService = {
        testConnectivity: vi.fn().mockResolvedValue({ success: true }),
        getAccountBalances: vi.fn().mockResolvedValue({
          success: true,
          data: null,
        }),
      };

      vi.mocked(getUnifiedMexcService).mockResolvedValue(mockService);
      vi.mocked(syncAfterCredentialTest).mockResolvedValue({
        success: true,
        cacheInvalidated: true,
        timestamp: Date.now(),
        triggeredBy: 'credential_test',
        servicesNotified: 1,
        statusRefreshed: true,
      });

      const result = await testService.testCredentials(
        { userId: 'user-123', provider: 'mexc' },
        'user-123'
      );

      expect(result.success).toBe(true);
      expect(result.data?.balanceCount).toBe(0);
      expect(result.data?.totalAssets).toBe(0);
      expect(result.data?.hasNonZeroBalances).toBe(false);
    });
  });

  describe('Logging and Context Verification', () => {
    beforeEach(() => {
      vi.mocked(getUserCredentials).mockResolvedValue({
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
        provider: 'mexc',
        isActive: true,
      });

      const mockService = {
        testConnectivity: vi.fn().mockResolvedValue({ success: true }),
        getAccountBalances: vi.fn().mockResolvedValue({
          success: true,
          data: [{ free: '100.0', locked: '0.0', asset: 'USDT' }],
        }),
      };

      vi.mocked(getUnifiedMexcService).mockResolvedValue(mockService);
      vi.mocked(syncAfterCredentialTest).mockResolvedValue({
        success: true,
        cacheInvalidated: true,
        timestamp: Date.now(),
        triggeredBy: 'credential_test',
        servicesNotified: 1,
        statusRefreshed: true,
      });
    });

    it('should log credential retrieval process', async () => {
      await testService.testCredentials(
        { userId: 'user-123', provider: 'mexc' },
        'user-123'
      );

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[CredentialTestService] Retrieving credentials',
        expect.objectContaining({
          requestId: expect.stringMatching(/^cred_test_/),
          userId: 'user-123',
          provider: 'mexc',
        })
      );

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[CredentialTestService] Credentials retrieved successfully',
        expect.objectContaining({
          requestId: expect.stringMatching(/^cred_test_/),
          hasApiKey: true,
          hasSecretKey: true,
          provider: 'mexc',
          isActive: true,
        })
      );
    });

    it('should log MEXC service initialization', async () => {
      await testService.testCredentials(
        { userId: 'user-123', provider: 'mexc' },
        'user-123'
      );

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[CredentialTestService] Initializing MEXC service',
        expect.objectContaining({
          requestId: expect.stringMatching(/^cred_test_/),
          hasApiKey: true,
          hasSecretKey: true,
        })
      );
    });

    it('should log connectivity testing', async () => {
      await testService.testCredentials(
        { userId: 'user-123', provider: 'mexc' },
        'user-123'
      );

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[CredentialTestService] Testing connectivity',
        expect.objectContaining({
          requestId: expect.stringMatching(/^cred_test_/),
        })
      );
    });

    it('should log authentication testing', async () => {
      await testService.testCredentials(
        { userId: 'user-123', provider: 'mexc' },
        'user-123'
      );

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[CredentialTestService] Testing authentication',
        expect.objectContaining({
          requestId: expect.stringMatching(/^cred_test_/),
        })
      );
    });

    it('should log status synchronization results', async () => {
      await testService.testCredentials(
        { userId: 'user-123', provider: 'mexc' },
        'user-123'
      );

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[CredentialTestService] Status synchronization completed',
        expect.objectContaining({
          requestId: expect.stringMatching(/^cred_test_/),
          syncSuccess: true,
          servicesNotified: 1,
          cacheInvalidated: true,
          statusRefreshed: true,
        })
      );
    });

    it('should generate unique request IDs for concurrent tests', async () => {
      const promises = [
        testService.testCredentials({ userId: 'user-1', provider: 'mexc' }, 'user-1'),
        testService.testCredentials({ userId: 'user-2', provider: 'mexc' }, 'user-2'),
        testService.testCredentials({ userId: 'user-3', provider: 'mexc' }, 'user-3'),
      ];

      await Promise.all(promises);

      const startLogCalls = mockConsole.info.mock.calls.filter(call =>
        call[0] === '[CredentialTestService] Starting credential test'
      );

      expect(startLogCalls).toHaveLength(3);
      const requestIds = startLogCalls.map(call => call[1].requestId);
      const uniqueIds = new Set(requestIds);
      expect(uniqueIds.size).toBe(3); // All should be unique
    });
  });

  describe('Performance and Timing', () => {
    beforeEach(() => {
      vi.mocked(getUserCredentials).mockResolvedValue({
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
        provider: 'mexc',
        isActive: true,
      });

      vi.mocked(syncAfterCredentialTest).mockResolvedValue({
        success: true,
        cacheInvalidated: true,
        timestamp: Date.now(),
        triggeredBy: 'credential_test',
        servicesNotified: 1,
        statusRefreshed: true,
      });
    });

    it('should measure and report execution duration', async () => {
      const mockService = {
        testConnectivity: vi.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve({ success: true }), 50))
        ),
        getAccountBalances: vi.fn().mockImplementation(() =>
          new Promise(resolve => setTimeout(() => resolve({
            success: true,
            data: [{ free: '100.0', locked: '0.0', asset: 'USDT' }],
          }), 50))
        ),
      };

      vi.mocked(getUnifiedMexcService).mockResolvedValue(mockService);

      const startTime = Date.now();
      await testService.testCredentials(
        { userId: 'user-123', provider: 'mexc' },
        'user-123'
      );
      const endTime = Date.now();

      const completionLog = mockConsole.info.mock.calls.find(call =>
        call[0] === '[CredentialTestService] Credential test completed successfully'
      );

      expect(completionLog).toBeDefined();
      const reportedDuration = parseInt(completionLog?.[1].duration.replace('ms', '') || '0');
      const actualDuration = endTime - startTime;

      expect(reportedDuration).toBeGreaterThan(0);
      expect(reportedDuration).toBeLessThanOrEqual(actualDuration + 10); // Allow small variance
    });

    it('should track duration even for failed tests', async () => {
      vi.mocked(getUserCredentials).mockImplementation(() => 
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30))
      );

      await testService.testCredentials(
        { userId: 'user-123', provider: 'mexc' },
        'user-123'
      );

      const errorLog = mockConsole.error.mock.calls.find(call =>
        call[0] === '[CredentialTestService] Unexpected error:'
      );

      expect(errorLog).toBeDefined();
      expect(errorLog?.[1].duration).toMatch(/^\d+ms$/);
      
      const duration = parseInt(errorLog?.[1].duration.replace('ms', '') || '0');
      expect(duration).toBeGreaterThan(25); // Should be at least the delay time
    });
  });

  describe('Type Safety and Interface Compliance', () => {
    it('should maintain proper context interface', async () => {
      const context: CredentialTestContext = {
        userId: 'test-user',
        provider: 'mexc',
        startTime: Date.now(),
        requestId: 'test-request-id',
      };

      expect(context.userId).toBe('test-user');
      expect(context.provider).toBe('mexc');
      expect(typeof context.startTime).toBe('number');
      expect(typeof context.requestId).toBe('string');
    });

    it('should maintain proper credential retrieval result interface', () => {
      const successResult: CredentialRetrievalResult = {
        success: true,
        credentials: {
          apiKey: 'test-key',
          secretKey: 'test-secret',
          provider: 'mexc',
          isActive: true,
        },
      };

      const failureResult: CredentialRetrievalResult = {
        success: false,
        error: 'Not found',
        code: 'NO_CREDENTIALS',
      };

      expect(successResult.success).toBe(true);
      expect(successResult.credentials?.apiKey).toBe('test-key');
      expect(failureResult.success).toBe(false);
      expect(failureResult.error).toBe('Not found');
    });

    it('should maintain proper connectivity result interface', () => {
      const connectivityResult: ConnectivityTestResult = {
        success: true,
        data: { status: 'ok' },
        timestamp: '2024-01-01T00:00:00Z',
      };

      expect(connectivityResult.success).toBe(true);
      expect(connectivityResult.data?.status).toBe('ok');
      expect(typeof connectivityResult.timestamp).toBe('string');
    });

    it('should maintain proper authentication result interface', () => {
      const authResult: AuthenticationTestResult = {
        success: true,
        accountType: 'spot',
        canTrade: true,
        balanceCount: 5,
        totalAssets: 10,
        hasNonZeroBalances: true,
        permissions: ['SPOT', 'READ'],
      };

      expect(authResult.success).toBe(true);
      expect(authResult.accountType).toBe('spot');
      expect(Array.isArray(authResult.permissions)).toBe(true);
    });
  });
});