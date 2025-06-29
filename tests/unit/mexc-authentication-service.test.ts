/**
 * MEXC Authentication Service Test Suite
 * 
 * Comprehensive tests for MEXC API authentication, credential management,
 * and security features including encryption and circuit breaker protection
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import * as crypto from 'node:crypto';
import {
  MexcAuthenticationService,
  type AuthenticationConfig,
  type AuthenticationStatus,
  type CredentialTestResult,
  type AuthenticationMetrics,
} from '@/src/services/api/mexc-authentication-service';
import type { MexcApiClient } from '@/src/services/api/mexc-api-client';

// Mock crypto module
vi.mock('node:crypto', () => ({
  createCipher: vi.fn(),
  createDecipher: vi.fn(),
  randomBytes: vi.fn(),
}));

describe('MexcAuthenticationService', () => {
  let authService: MexcAuthenticationService;
  let mockApiClient: vi.Mocked<MexcApiClient>;

  const validConfig: AuthenticationConfig = {
    apiKey: 'test-api-key-12345',
    secretKey: 'test-secret-key-67890',
    passphrase: 'test-passphrase',
    enableEncryption: true,
    encryptionKey: 'test-encryption-key-32-bytes-long!',
    testIntervalMs: 60000,
    maxAuthFailures: 3,
    authFailureResetMs: 300000,
  };

  const mockSuccessfulApiResponse = {
    success: true,
    data: { accountInfo: { canTrade: true } },
    timestamp: new Date().toISOString(),
  };

  const mockFailedApiResponse = {
    success: false,
    error: 'Invalid API key',
    timestamp: new Date().toISOString(),
  };

  beforeEach(() => {
    // Mock API client
    mockApiClient = {
      getAccountInfo: vi.fn().mockResolvedValue(mockSuccessfulApiResponse),
      testConnection: vi.fn().mockResolvedValue(mockSuccessfulApiResponse),
      setCredentials: vi.fn(),
      hasValidCredentials: vi.fn().mockReturnValue(true),
    } as any;

    // Mock crypto functions
    const mockCipher = {
      update: vi.fn().mockReturnValue('encrypted-part'),
      final: vi.fn().mockReturnValue('-final'),
    };
    const mockDecipher = {
      update: vi.fn().mockReturnValue('decrypted-part'),
      final: vi.fn().mockReturnValue('-final'),
    };

    (crypto.createCipher as any).mockReturnValue(mockCipher);
    (crypto.createDecipher as any).mockReturnValue(mockDecipher);
    (crypto.randomBytes as any).mockReturnValue(Buffer.from('random-bytes'));

    authService = new MexcAuthenticationService(validConfig);
    authService.setApiClient(mockApiClient);
  });

  afterEach(() => {
    authService.destroy();
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('Initialization and Configuration', () => {
    it('should initialize with valid configuration', () => {
      const service = new MexcAuthenticationService(validConfig);
      
      expect(service.hasCredentials()).toBe(true);
      const status = service.getStatus();
      expect(status.hasCredentials).toBe(true);
      expect(status.failureCount).toBe(0);
      expect(status.isBlocked).toBe(false);
    });

    it('should initialize with minimal configuration', () => {
      const minimalConfig = {
        apiKey: 'test-key',
        secretKey: 'test-secret',
      };
      
      const service = new MexcAuthenticationService(minimalConfig);
      
      expect(service.hasCredentials()).toBe(true);
      const status = service.getStatus();
      expect(status.hasCredentials).toBe(true);
    });

    it('should initialize with empty configuration', () => {
      const service = new MexcAuthenticationService();
      
      expect(service.hasCredentials()).toBe(false);
      const status = service.getStatus();
      expect(status.hasCredentials).toBe(false);
    });

    it('should validate required credentials', () => {
      const invalidConfig = {
        apiKey: '',
        secretKey: 'test-secret',
      };
      
      const service = new MexcAuthenticationService(invalidConfig);
      
      expect(service.hasCredentials()).toBe(false);
    });
  });

  describe('Credential Management', () => {
    it('should report having credentials when properly configured', () => {
      expect(authService.hasCredentials()).toBe(true);
    });

    it('should return current status', () => {
      const status = authService.getStatus();
      
      expect(status).toHaveProperty('hasCredentials');
      expect(status).toHaveProperty('isValid');
      expect(status).toHaveProperty('isConnected');
      expect(status).toHaveProperty('failureCount');
      expect(status).toHaveProperty('isBlocked');
      expect(status.hasCredentials).toBe(true);
      expect(status.failureCount).toBe(0);
      expect(status.isBlocked).toBe(false);
    });

    it('should update credentials successfully', async () => {
      const newCredentials = {
        apiKey: 'new-api-key',
        secretKey: 'new-secret-key',
      };

      await authService.updateCredentials(newCredentials);
      
      expect(authService.hasCredentials()).toBe(true);
      expect(mockApiClient.setCredentials).toHaveBeenCalledWith(
        newCredentials.apiKey,
        newCredentials.secretKey,
        undefined
      );
    });

    it('should clear credentials when updating with empty values', async () => {
      await authService.updateCredentials({ apiKey: '', secretKey: '' });
      
      expect(authService.hasCredentials()).toBe(false);
    });

    it('should trigger credential test after update', async () => {
      const testSpy = vi.spyOn(authService, 'testCredentials');
      
      await authService.updateCredentials({
        apiKey: 'new-key',
        secretKey: 'new-secret',
      });
      
      expect(testSpy).toHaveBeenCalled();
    });
  });

  describe('Credential Testing and Validation', () => {
    it('should test credentials successfully', async () => {
      const result = await authService.testCredentials();
      
      expect(result.isValid).toBe(true);
      expect(result.hasConnection).toBe(true);
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
      expect(mockApiClient.getAccountInfo).toHaveBeenCalled();
    });

    it('should handle credential test failure', async () => {
      mockApiClient.getAccountInfo.mockResolvedValueOnce(mockFailedApiResponse);
      
      const result = await authService.testCredentials();
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });

    it('should not test credentials when blocked', async () => {
      // Force block the service by failing multiple times
      mockApiClient.getAccountInfo.mockResolvedValue(mockFailedApiResponse);
      
      // Fail 3 times to trigger block
      await authService.testCredentials();
      await authService.testCredentials();
      await authService.testCredentials();
      
      const status = authService.getStatus();
      expect(status.isBlocked).toBe(true);
      
      // Should not test when blocked
      const result = await authService.testCredentials();
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('blocked');
    });

    it('should force test credentials even when blocked', async () => {
      // Block the service
      mockApiClient.getAccountInfo.mockResolvedValue(mockFailedApiResponse);
      await authService.testCredentials();
      await authService.testCredentials();
      await authService.testCredentials();
      
      // Reset mock to return success
      mockApiClient.getAccountInfo.mockResolvedValue(mockSuccessfulApiResponse);
      
      const result = await authService.testCredentials(true);
      expect(result.isValid).toBe(true);
    });

    it('should handle missing credentials gracefully', async () => {
      const serviceWithoutCredentials = new MexcAuthenticationService();
      
      const result = await serviceWithoutCredentials.testCredentials();
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('credentials');
    });

    it('should handle missing API client gracefully', async () => {
      const serviceWithoutClient = new MexcAuthenticationService(validConfig);
      
      const result = await serviceWithoutClient.testCredentials();
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('API client');
    });

    it('should measure response time during testing', async () => {
      const result = await authService.testCredentials();
      
      expect(result.responseTime).toBeGreaterThan(0);
      expect(typeof result.responseTime).toBe('number');
    });

    it('should update status after successful test', async () => {
      await authService.testCredentials();
      
      const status = authService.getStatus();
      expect(status.isValid).toBe(true);
      expect(status.isConnected).toBe(true);
      expect(status.lastTestedAt).toBeInstanceOf(Date);
      expect(status.lastValidAt).toBeInstanceOf(Date);
    });

    it('should update status after failed test', async () => {
      mockApiClient.getAccountInfo.mockResolvedValueOnce(mockFailedApiResponse);
      
      await authService.testCredentials();
      
      const status = authService.getStatus();
      expect(status.isValid).toBe(false);
      expect(status.isConnected).toBe(false);
      expect(status.failureCount).toBe(1);
      expect(status.error).toBe('Invalid API key');
    });
  });

  describe('Circuit Breaker and Error Handling', () => {
    it('should implement circuit breaker after max failures', async () => {
      mockApiClient.getAccountInfo.mockResolvedValue(mockFailedApiResponse);
      
      // Fail exactly maxAuthFailures times
      for (let i = 0; i < validConfig.maxAuthFailures!; i++) {
        await authService.testCredentials();
      }
      
      const status = authService.getStatus();
      expect(status.isBlocked).toBe(true);
      expect(status.blockReason).toContain('failures');
    });

    it('should reset circuit breaker after timeout', async () => {
      // Block the service
      mockApiClient.getAccountInfo.mockResolvedValue(mockFailedApiResponse);
      for (let i = 0; i < validConfig.maxAuthFailures!; i++) {
        await authService.testCredentials();
      }
      
      expect(authService.getStatus().isBlocked).toBe(true);
      
      // Fast-forward time beyond reset timeout
      vi.advanceTimersByTime(validConfig.authFailureResetMs! + 1000);
      
      // Reset mock to return success
      mockApiClient.getAccountInfo.mockResolvedValue(mockSuccessfulApiResponse);
      
      const result = await authService.testCredentials();
      expect(result.isValid).toBe(true);
      expect(authService.getStatus().isBlocked).toBe(false);
    });

    it('should handle network errors gracefully', async () => {
      mockApiClient.getAccountInfo.mockRejectedValueOnce(new Error('Network error'));
      
      const result = await authService.testCredentials();
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle API timeout errors', async () => {
      mockApiClient.getAccountInfo.mockRejectedValueOnce(new Error('Request timeout'));
      
      const result = await authService.testCredentials();
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Request timeout');
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track testing metrics', async () => {
      // Perform some successful tests
      await authService.testCredentials();
      await authService.testCredentials();
      
      // Perform a failed test
      mockApiClient.getAccountInfo.mockResolvedValueOnce(mockFailedApiResponse);
      await authService.testCredentials();
      
      const metrics = authService.getMetrics();
      
      expect(metrics.totalTests).toBe(3);
      expect(metrics.successfulTests).toBe(2);
      expect(metrics.failedTests).toBe(1);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
    });

    it('should calculate correct success rate', async () => {
      // 2 successful, 1 failed = 66.67% success rate
      await authService.testCredentials();
      await authService.testCredentials();
      
      mockApiClient.getAccountInfo.mockResolvedValueOnce(mockFailedApiResponse);
      await authService.testCredentials();
      
      const metrics = authService.getMetrics();
      expect(metrics.successRate).toBeCloseTo(66.67, 1);
    });

    it('should track uptime when valid', async () => {
      await authService.testCredentials();
      
      // Wait a bit and check uptime
      vi.advanceTimersByTime(1000);
      
      const metrics = authService.getMetrics();
      expect(metrics.uptimeMs).toBeGreaterThan(0);
    });
  });

  describe('Encryption and Security', () => {
    it('should encrypt credentials when encryption is enabled', () => {
      const encryptedCreds = authService.getEncryptedCredentials();
      
      expect(encryptedCreds).not.toBeNull();
      expect(encryptedCreds!.apiKey).toBe('encrypted-part-final');
      expect(encryptedCreds!.secretKey).toBe('encrypted-part-final');
      expect(crypto.createCipher).toHaveBeenCalled();
    });

    it('should return null when encryption disabled', () => {
      const serviceWithoutEncryption = new MexcAuthenticationService({
        ...validConfig,
        enableEncryption: false,
      });
      
      const encryptedCreds = serviceWithoutEncryption.getEncryptedCredentials();
      expect(encryptedCreds).toBeNull();
    });

    it('should return null when no encryption key provided', () => {
      const serviceWithoutKey = new MexcAuthenticationService({
        ...validConfig,
        enableEncryption: true,
        encryptionKey: undefined,
      });
      
      const encryptedCreds = serviceWithoutKey.getEncryptedCredentials();
      expect(encryptedCreds).toBeNull();
    });
  });

  describe('Periodic Testing', () => {
    it('should start periodic testing when enabled', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      
      const serviceWithPeriodicTesting = new MexcAuthenticationService({
        ...validConfig,
        testIntervalMs: 60000,
      });
      serviceWithPeriodicTesting.setApiClient(mockApiClient);
      
      // Trigger periodic testing start
      serviceWithPeriodicTesting.testCredentials();
      
      expect(setIntervalSpy).toHaveBeenCalled();
    });

    it('should stop periodic testing on destroy', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      authService.destroy();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should not start periodic testing when blocked', async () => {
      // Block the service
      mockApiClient.getAccountInfo.mockResolvedValue(mockFailedApiResponse);
      for (let i = 0; i < validConfig.maxAuthFailures!; i++) {
        await authService.testCredentials();
      }
      
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      
      // Try to trigger periodic testing - should not start when blocked
      await authService.testCredentials();
      
      expect(setIntervalSpy).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle extremely long response times', async () => {
      // Mock a very slow response
      mockApiClient.getAccountInfo.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockSuccessfulApiResponse), 5000))
      );
      
      const result = await authService.testCredentials();
      
      expect(result.responseTime).toBeGreaterThan(4000);
    });

    it('should handle malformed API responses', async () => {
      mockApiClient.getAccountInfo.mockResolvedValueOnce(null as any);
      
      const result = await authService.testCredentials();
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid response');
    });

    it('should handle concurrent credential tests', async () => {
      const promises = [
        authService.testCredentials(),
        authService.testCredentials(),
        authService.testCredentials(),
      ];
      
      const results = await Promise.all(promises);
      
      // All should complete without errors
      results.forEach(result => {
        expect(result).toHaveProperty('isValid');
        expect(result).toHaveProperty('timestamp');
      });
    });

    it('should handle credential updates during testing', async () => {
      // Start a test
      const testPromise = authService.testCredentials();
      
      // Update credentials while test is running
      await authService.updateCredentials({
        apiKey: 'new-key',
        secretKey: 'new-secret',
      });
      
      // Original test should complete
      const result = await testPromise;
      expect(result).toHaveProperty('isValid');
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should properly clean up resources on destroy', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      authService.destroy();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(authService.getStatus().hasCredentials).toBe(false);
    });

    it('should handle multiple destroy calls gracefully', () => {
      authService.destroy();
      authService.destroy(); // Should not throw
      
      expect(authService.hasCredentials()).toBe(false);
    });

    it('should prevent operations after destroy', async () => {
      authService.destroy();
      
      const result = await authService.testCredentials();
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('credentials');
    });
  });
});