/**
 * Unit tests for MexcConnectivityService
 * Tests connectivity testing, credential validation, retry logic, metrics collection, and error handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  MexcConnectivityService,
  mexcConnectivityService,
  type ConnectivityTestContext,
  type CredentialInfo,
  type DetailedConnectivityResult,
  type CredentialTestResult,
} from '../../../../src/services/api/mexc-connectivity-service';
import type {
  ConnectivityTestRequest,
  ConnectivityTestResponse,
} from '@/src/schemas/mexc-api-validation-schemas';

// Mock dependencies
vi.mock('@/src/lib/error-types', () => ({
  ErrorFactory: {
    encryption: vi.fn((message) => new Error(`Encryption Error: ${message}`)),
  },
}));

vi.mock('@/src/lib/supabase-auth', () => ({
  getUser: vi.fn(),
}));

vi.mock('@/src/schemas/mexc-api-validation-schemas', () => ({
  ConnectivityTestResponseSchema: {},
  validateMexcApiResponse: vi.fn(),
}));

vi.mock('../../../../src/services/api/mexc-unified-exports', () => ({
  getRecommendedMexcService: vi.fn(),
}));

vi.mock('../../../../src/services/api/user-credentials-service', () => ({
  getUserCredentials: vi.fn(),
}));

describe('MexcConnectivityService', () => {
  let connectivityService: MexcConnectivityService;
  let mockGetUser: any;
  let mockGetUserCredentials: any;
  let mockGetRecommendedMexcService: any;
  let mockValidateMexcApiResponse: any;
  let mockMexcService: any;
  let mockConsole: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();

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

    // Create mock MEXC service
    mockMexcService = {
      testConnectivity: vi.fn(),
      getAccountBalances: vi.fn(),
    };

    // Setup module mocks
    mockGetUser = require('@/src/lib/supabase-auth').getUser;
    mockGetUserCredentials = require('../../../../src/services/api/user-credentials-service').getUserCredentials;
    mockGetRecommendedMexcService = require('../../../../src/services/api/mexc-unified-exports').getRecommendedMexcService;
    mockValidateMexcApiResponse = require('@/src/schemas/mexc-api-validation-schemas').validateMexcApiResponse;

    mockGetRecommendedMexcService.mockReturnValue(mockMexcService);
    mockValidateMexcApiResponse.mockReturnValue({ success: true });

    connectivityService = new MexcConnectivityService();

    // Clear environment variables
    delete process.env.MEXC_API_KEY;
    delete process.env.MEXC_SECRET_KEY;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Singleton Instance', () => {
    it('should export a singleton instance', () => {
      expect(mexcConnectivityService).toBeInstanceOf(MexcConnectivityService);
    });
  });

  describe('Basic Connectivity Testing', () => {
    it('should test connectivity successfully without credentials', async () => {
      const request: ConnectivityTestRequest = {
        includeCredentialTest: false,
      };

      mockGetUser.mockResolvedValue(null);
      mockMexcService.testConnectivity.mockResolvedValue({ success: true });

      const result = await connectivityService.testConnectivity(request);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        connected: true,
        hasCredentials: false,
        credentialsValid: false,
        credentialSource: 'none',
        hasUserCredentials: false,
        hasEnvironmentCredentials: false,
        status: 'no_credentials',
        metrics: expect.objectContaining({
          latency: expect.any(Number),
          retryCount: 0,
          connectionHealth: expect.any(String),
          lastSuccessfulCheck: expect.any(String),
        }),
      });
    });

    it('should test connectivity with credentials successfully', async () => {
      const request: ConnectivityTestRequest = {
        userId: 'test-user-123',
        includeCredentialTest: true,
      };

      const mockCredentials = {
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
      };

      mockGetUser.mockResolvedValue({ id: 'test-user-123' });
      mockGetUserCredentials.mockResolvedValue(mockCredentials);
      mockMexcService.testConnectivity.mockResolvedValue({ success: true });
      mockMexcService.getAccountBalances.mockResolvedValue({
        success: true,
        data: { balances: [] },
      });

      const result = await connectivityService.testConnectivity(request);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        connected: true,
        hasCredentials: true,
        credentialsValid: true,
        credentialSource: 'database',
        hasUserCredentials: true,
        status: 'fully_connected',
      });
    });

    it('should handle connectivity failure', async () => {
      const request: ConnectivityTestRequest = {
        includeCredentialTest: false,
      };

      mockMexcService.testConnectivity.mockResolvedValue({ 
        success: false, 
        error: 'Network connection failed' 
      });

      const result = await connectivityService.testConnectivity(request);

      expect(result.success).toBe(true);
      expect(result.data.connected).toBe(false);
      expect(result.data.error).toBe('Network connection failed');
      expect(result.data.metrics.connectionHealth).toBe('failed');
    });

    it('should retry on connection failures', async () => {
      const request: ConnectivityTestRequest = {
        includeCredentialTest: false,
      };

      mockMexcService.testConnectivity
        .mockResolvedValueOnce({ success: false, error: 'Timeout' })
        .mockResolvedValueOnce({ success: false, error: 'Network error' })
        .mockResolvedValueOnce({ success: true });

      const promise = connectivityService.testConnectivity(request);
      
      // Advance timers to complete retry delays
      vi.advanceTimersByTime(1000); // First retry
      vi.advanceTimersByTime(2000); // Second retry
      
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.data.connected).toBe(true);
      expect(result.data.metrics.retryCount).toBe(2);
      expect(mockMexcService.testConnectivity).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const request: ConnectivityTestRequest = {
        includeCredentialTest: false,
      };

      mockMexcService.testConnectivity.mockResolvedValue({ 
        success: false, 
        error: 'Persistent network error' 
      });

      const promise = connectivityService.testConnectivity(request);
      
      // Advance timers to complete all retry delays
      vi.advanceTimersByTime(1000);
      vi.advanceTimersByTime(2000);
      vi.advanceTimersByTime(4000);
      
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.data.connected).toBe(false);
      expect(result.data.metrics.retryCount).toBe(2);
      expect(mockMexcService.testConnectivity).toHaveBeenCalledTimes(3);
    });

    it('should handle boolean response from testConnectivity', async () => {
      const request: ConnectivityTestRequest = {
        includeCredentialTest: false,
      };

      mockMexcService.testConnectivity.mockResolvedValue(true);

      const result = await connectivityService.testConnectivity(request);

      expect(result.success).toBe(true);
      expect(result.data.connected).toBe(true);
    });
  });

  describe('Credential Management', () => {
    it('should use environment credentials when user credentials not available', async () => {
      process.env.MEXC_API_KEY = 'env-api-key';
      process.env.MEXC_SECRET_KEY = 'env-secret-key';

      const request: ConnectivityTestRequest = {
        includeCredentialTest: true,
      };

      mockGetUser.mockResolvedValue(null);
      mockMexcService.testConnectivity.mockResolvedValue({ success: true });
      mockMexcService.getAccountBalances.mockResolvedValue({
        success: true,
        data: { balances: [] },
      });

      const result = await connectivityService.testConnectivity(request);

      expect(result.success).toBe(true);
      expect(result.data.credentialSource).toBe('environment');
      expect(result.data.hasEnvironmentCredentials).toBe(true);
      expect(result.data.hasUserCredentials).toBe(false);
    });

    it('should prioritize user credentials over environment', async () => {
      process.env.MEXC_API_KEY = 'env-api-key';
      process.env.MEXC_SECRET_KEY = 'env-secret-key';

      const request: ConnectivityTestRequest = {
        userId: 'test-user-123',
        includeCredentialTest: true,
      };

      const mockCredentials = {
        apiKey: 'user-api-key',
        secretKey: 'user-secret-key',
      };

      mockGetUser.mockResolvedValue({ id: 'test-user-123' });
      mockGetUserCredentials.mockResolvedValue(mockCredentials);
      mockMexcService.testConnectivity.mockResolvedValue({ success: true });
      mockMexcService.getAccountBalances.mockResolvedValue({
        success: true,
        data: { balances: [] },
      });

      const result = await connectivityService.testConnectivity(request);

      expect(result.success).toBe(true);
      expect(result.data.credentialSource).toBe('database');
      expect(result.data.hasUserCredentials).toBe(true);
      expect(result.data.hasEnvironmentCredentials).toBe(true);
    });

    it('should handle credential retrieval failure gracefully', async () => {
      const request: ConnectivityTestRequest = {
        userId: 'test-user-123',
        includeCredentialTest: true,
      };

      mockGetUser.mockResolvedValue({ id: 'test-user-123' });
      mockGetUserCredentials.mockRejectedValue(new Error('Database connection failed'));
      mockMexcService.testConnectivity.mockResolvedValue({ success: true });

      const result = await connectivityService.testConnectivity(request);

      expect(result.success).toBe(true);
      expect(result.data.credentialSource).toBe('none');
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to retrieve user credentials'),
        expect.any(Object)
      );
    });

    it('should handle encryption service errors specially', async () => {
      const request: ConnectivityTestRequest = {
        userId: 'test-user-123',
        includeCredentialTest: true,
      };

      mockGetUser.mockResolvedValue({ id: 'test-user-123' });
      mockGetUserCredentials.mockRejectedValue(
        new Error('Encryption service unavailable')
      );

      const result = await connectivityService.testConnectivity(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('MEXC connectivity test failed');
      expect(result.code).toBe('CONNECTIVITY_TEST_ERROR');
    });
  });

  describe('Credential Validation', () => {
    it('should validate credentials successfully', async () => {
      const request: ConnectivityTestRequest = {
        userId: 'test-user-123',
        includeCredentialTest: true,
      };

      const mockCredentials = {
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
      };

      mockGetUser.mockResolvedValue({ id: 'test-user-123' });
      mockGetUserCredentials.mockResolvedValue(mockCredentials);
      mockMexcService.testConnectivity.mockResolvedValue({ success: true });
      mockMexcService.getAccountBalances.mockResolvedValue({
        success: true,
        data: { balances: [] },
      });

      const result = await connectivityService.testConnectivity(request);

      expect(result.success).toBe(true);
      expect(result.data.credentialsValid).toBe(true);
      expect(result.data.status).toBe('fully_connected');
      expect(result.data.message).toContain('valid credentials from user settings');
    });

    it('should handle invalid credentials', async () => {
      const request: ConnectivityTestRequest = {
        userId: 'test-user-123',
        includeCredentialTest: true,
      };

      const mockCredentials = {
        apiKey: 'invalid-api-key',
        secretKey: 'invalid-secret-key',
      };

      mockGetUser.mockResolvedValue({ id: 'test-user-123' });
      mockGetUserCredentials.mockResolvedValue(mockCredentials);
      mockMexcService.testConnectivity.mockResolvedValue({ success: true });
      mockMexcService.getAccountBalances.mockResolvedValue({
        success: false,
        error: 'Invalid API key',
      });

      const result = await connectivityService.testConnectivity(request);

      expect(result.success).toBe(true);
      expect(result.data.credentialsValid).toBe(false);
      expect(result.data.status).toBe('invalid_credentials');
      expect(result.data.message).toContain('Credentials invalid');
      expect(result.data.error).toBe('Invalid API key');
    });

    it('should handle credential test exceptions', async () => {
      const request: ConnectivityTestRequest = {
        userId: 'test-user-123',
        includeCredentialTest: true,
      };

      const mockCredentials = {
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
      };

      mockGetUser.mockResolvedValue({ id: 'test-user-123' });
      mockGetUserCredentials.mockResolvedValue(mockCredentials);
      mockMexcService.testConnectivity.mockResolvedValue({ success: true });
      mockMexcService.getAccountBalances.mockRejectedValue(
        new Error('Network timeout')
      );

      const result = await connectivityService.testConnectivity(request);

      expect(result.success).toBe(true);
      expect(result.data.credentialsValid).toBe(false);
      expect(result.data.status).toBe('invalid_credentials');
      expect(result.data.message).toContain('Credential validation failed');
      expect(result.data.error).toBe('Network timeout');
    });
  });

  describe('Connection Health Assessment', () => {
    it('should rate connection as excellent for fast response', async () => {
      const request: ConnectivityTestRequest = {
        includeCredentialTest: false,
      };

      // Mock fast response (< 500ms)
      mockMexcService.testConnectivity.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return { success: true };
      });

      const promise = connectivityService.testConnectivity(request);
      vi.advanceTimersByTime(200);
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.data.metrics.connectionHealth).toBe('excellent');
      expect(result.data.metrics.latency).toBeLessThan(500);
    });

    it('should rate connection as good for moderate response', async () => {
      const request: ConnectivityTestRequest = {
        includeCredentialTest: false,
      };

      // Mock moderate response (500-2000ms)
      mockMexcService.testConnectivity.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { success: true };
      });

      const promise = connectivityService.testConnectivity(request);
      vi.advanceTimersByTime(1000);
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.data.metrics.connectionHealth).toBe('good');
      expect(result.data.metrics.latency).toBeGreaterThan(500);
      expect(result.data.metrics.latency).toBeLessThan(2000);
    });

    it('should rate connection as poor for slow response', async () => {
      const request: ConnectivityTestRequest = {
        includeCredentialTest: false,
      };

      // Mock slow response (> 2000ms)
      mockMexcService.testConnectivity.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 3000));
        return { success: true };
      });

      const promise = connectivityService.testConnectivity(request);
      vi.advanceTimersByTime(3000);
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.data.metrics.connectionHealth).toBe('poor');
      expect(result.data.metrics.latency).toBeGreaterThan(2000);
    });

    it('should rate connection as poor when retries are needed', async () => {
      const request: ConnectivityTestRequest = {
        includeCredentialTest: false,
      };

      mockMexcService.testConnectivity
        .mockResolvedValueOnce({ success: false, error: 'Timeout' })
        .mockResolvedValueOnce({ success: true });

      const promise = connectivityService.testConnectivity(request);
      vi.advanceTimersByTime(2000);
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.data.metrics.connectionHealth).toBe('poor');
      expect(result.data.metrics.retryCount).toBe(1);
    });

    it('should rate connection as failed when all retries fail', async () => {
      const request: ConnectivityTestRequest = {
        includeCredentialTest: false,
      };

      mockMexcService.testConnectivity.mockResolvedValue({ 
        success: false, 
        error: 'Connection failed' 
      });

      const promise = connectivityService.testConnectivity(request);
      vi.advanceTimersByTime(8000);
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.data.metrics.connectionHealth).toBe('failed');
      expect(result.data.metrics.retryCount).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle auth errors without retrying', async () => {
      const request: ConnectivityTestRequest = {
        includeCredentialTest: false,
      };

      mockMexcService.testConnectivity.mockRejectedValue(
        new Error('401 Unauthorized')
      );

      const result = await connectivityService.testConnectivity(request);

      expect(result.success).toBe(true);
      expect(result.data.connected).toBe(false);
      expect(result.data.metrics.retryCount).toBe(0);
      expect(mockMexcService.testConnectivity).toHaveBeenCalledTimes(1);
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('Authentication error detected'),
        expect.any(Object)
      );
    });

    it('should handle non-Error thrown values', async () => {
      const request: ConnectivityTestRequest = {
        includeCredentialTest: false,
      };

      mockMexcService.testConnectivity.mockRejectedValue('String error');

      const result = await connectivityService.testConnectivity(request);

      expect(result.success).toBe(true);
      expect(result.data.connected).toBe(false);
      expect(result.data.error).toBe('String error');
    });

    it('should handle unexpected service errors', async () => {
      const request: ConnectivityTestRequest = {
        includeCredentialTest: false,
      };

      mockGetRecommendedMexcService.mockImplementation(() => {
        throw new Error('Service initialization failed');
      });

      const result = await connectivityService.testConnectivity(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('MEXC connectivity test failed');
      expect(result.code).toBe('CONNECTIVITY_TEST_ERROR');
      expect(result.details).toMatchObject({
        requestId: expect.any(String),
        message: 'Service initialization failed',
        duration: expect.any(String),
      });
    });

    it('should handle user authentication errors gracefully', async () => {
      const request: ConnectivityTestRequest = {
        includeCredentialTest: false,
      };

      mockGetUser.mockRejectedValue(new Error('Auth service unavailable'));
      mockMexcService.testConnectivity.mockResolvedValue({ success: true });

      const result = await connectivityService.testConnectivity(request);

      expect(result.success).toBe(true);
      expect(result.data.connected).toBe(true);
      // Should continue without user authentication
    });
  });

  describe('Response Validation', () => {
    it('should validate response structure', async () => {
      const request: ConnectivityTestRequest = {
        includeCredentialTest: false,
      };

      mockMexcService.testConnectivity.mockResolvedValue({ success: true });
      mockValidateMexcApiResponse.mockReturnValue({ success: true });

      const result = await connectivityService.testConnectivity(request);

      expect(result.success).toBe(true);
      expect(mockValidateMexcApiResponse).toHaveBeenCalledWith(
        {},
        expect.any(Object),
        'connectivity test'
      );
    });

    it('should log validation errors but continue', async () => {
      const request: ConnectivityTestRequest = {
        includeCredentialTest: false,
      };

      mockMexcService.testConnectivity.mockResolvedValue({ success: true });
      mockValidateMexcApiResponse.mockReturnValue({ 
        success: false, 
        error: 'Validation failed' 
      });

      const result = await connectivityService.testConnectivity(request);

      expect(result.success).toBe(true);
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('Response validation failed'),
        'Validation failed'
      );
    });
  });

  describe('Status Determination', () => {
    it('should return network_error when not connected', async () => {
      const request: ConnectivityTestRequest = {
        includeCredentialTest: true,
      };

      mockMexcService.testConnectivity.mockResolvedValue({ 
        success: false, 
        error: 'Network error' 
      });

      const result = await connectivityService.testConnectivity(request);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('network_error');
    });

    it('should return no_credentials when connected but no credentials', async () => {
      const request: ConnectivityTestRequest = {
        includeCredentialTest: true,
      };

      mockMexcService.testConnectivity.mockResolvedValue({ success: true });

      const result = await connectivityService.testConnectivity(request);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('no_credentials');
    });

    it('should return invalid_credentials when credentials are invalid', async () => {
      process.env.MEXC_API_KEY = 'invalid-key';
      process.env.MEXC_SECRET_KEY = 'invalid-secret';

      const request: ConnectivityTestRequest = {
        includeCredentialTest: true,
      };

      mockMexcService.testConnectivity.mockResolvedValue({ success: true });
      mockMexcService.getAccountBalances.mockResolvedValue({
        success: false,
        error: 'Invalid credentials',
      });

      const result = await connectivityService.testConnectivity(request);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('invalid_credentials');
    });

    it('should return fully_connected when everything works', async () => {
      process.env.MEXC_API_KEY = 'valid-key';
      process.env.MEXC_SECRET_KEY = 'valid-secret';

      const request: ConnectivityTestRequest = {
        includeCredentialTest: true,
      };

      mockMexcService.testConnectivity.mockResolvedValue({ success: true });
      mockMexcService.getAccountBalances.mockResolvedValue({
        success: true,
        data: { balances: [] },
      });

      const result = await connectivityService.testConnectivity(request);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('fully_connected');
    });
  });

  describe('Logging and Metrics', () => {
    it('should log connectivity test start and completion', async () => {
      const request: ConnectivityTestRequest = {
        includeCredentialTest: false,
      };

      mockMexcService.testConnectivity.mockResolvedValue({ success: true });

      await connectivityService.testConnectivity(request);

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[MexcConnectivityService] Starting connectivity test',
        expect.objectContaining({
          requestId: expect.any(String),
          includeCredentialTest: false,
          timestamp: expect.any(String),
        })
      );

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[MexcConnectivityService] Connectivity test completed',
        expect.objectContaining({
          requestId: expect.any(String),
          duration: expect.any(String),
          connected: true,
          credentialsValid: false,
          connectionHealth: expect.any(String),
        })
      );
    });

    it('should include request ID in all log messages', async () => {
      const request: ConnectivityTestRequest = {
        userId: 'test-user-123',
        includeCredentialTest: true,
      };

      const mockCredentials = {
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
      };

      mockGetUser.mockResolvedValue({ id: 'test-user-123' });
      mockGetUserCredentials.mockResolvedValue(mockCredentials);
      mockMexcService.testConnectivity.mockResolvedValue({ success: true });
      mockMexcService.getAccountBalances.mockResolvedValue({
        success: true,
        data: { balances: [] },
      });

      await connectivityService.testConnectivity(request);

      // Check that all info logs include requestId
      const infoLogs = mockConsole.info.mock.calls;
      infoLogs.forEach(call => {
        if (call[1] && typeof call[1] === 'object') {
          expect(call[1]).toHaveProperty('requestId');
        }
      });
    });
  });
});