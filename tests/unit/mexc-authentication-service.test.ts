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

// Crypto module is already mocked globally in vitest-setup.ts

describe('MexcAuthenticationService', () => {
  let authService: MexcAuthenticationService;
  let mockApiClient: vi.Mocked<MexcApiClient>;

  const validConfig: AuthenticationConfig = {
    apiKey: 'test-api-key-12345',
    secretKey: 'test-secret-key-67890',
    passphrase: 'test-passphrase',
    enableEncryption: true,
    encryptionKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', // 64 char hex key
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
    // Clear environment variables that might interfere with tests
    delete process.env.MEXC_API_KEY;
    delete process.env.MEXC_SECRET_KEY;
    delete process.env.MEXC_PASSPHRASE;
    delete process.env.MEXC_ENCRYPTION_KEY;

    // Mock API client with correct method names
    mockApiClient = {
      getAccountInfo: vi.fn().mockResolvedValue(mockSuccessfulApiResponse),
      testConnection: vi.fn().mockResolvedValue(mockSuccessfulApiResponse),
      testCredentials: vi.fn().mockResolvedValue({
        isValid: true,
        hasConnection: true,
        error: undefined
      }),
      setCredentials: vi.fn(),
      hasValidCredentials: vi.fn().mockReturnValue(true),
    } as any;

    // Crypto functions are already mocked globally
    // The global mocks will automatically handle encryption/decryption

    authService = new MexcAuthenticationService(validConfig);
    authService.setApiClient(mockApiClient);
  });

  afterEach(() => {
    authService.destroy();
    vi.clearAllMocks();
    // vi.clearAllTimers() doesn't exist in this version of Vitest
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
        validConfig.passphrase // The original passphrase is preserved
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
      expect(mockApiClient.testCredentials).toHaveBeenCalled();
    });

    it('should handle credential test failure', async () => {
      mockApiClient.testCredentials.mockResolvedValueOnce({
        isValid: false,
        hasConnection: false,
        error: 'Invalid API key'
      });
      
      const result = await authService.testCredentials();
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });

    it('should not test credentials when blocked', async () => {
      // Force block the service by failing multiple times
      mockApiClient.testCredentials.mockResolvedValue({
        isValid: false,
        hasConnection: false,
        error: 'Invalid API key'
      });
      
      // Fail 3 times to trigger block
      await authService.testCredentials();
      await authService.testCredentials();
      await authService.testCredentials();
      
      const status = authService.getStatus();
      expect(status.isBlocked).toBe(true);
      
      // Should not test when blocked
      const result = await authService.testCredentials();
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Authentication blocked');
    });

    it('should force test credentials even when blocked', async () => {
      // Block the service
      mockApiClient.testCredentials.mockResolvedValue({
        isValid: false,
        hasConnection: false,
        error: 'Invalid API key'
      });
      await authService.testCredentials();
      await authService.testCredentials();
      await authService.testCredentials();
      
      // Reset mock to return success
      mockApiClient.testCredentials.mockResolvedValue({
        isValid: true,
        hasConnection: true,
        error: undefined
      });
      
      const result = await authService.testCredentials(true);
      expect(result.isValid).toBe(true);
    });

    it('should handle missing credentials gracefully', async () => {
      const serviceWithoutCredentials = new MexcAuthenticationService();
      
      const result = await serviceWithoutCredentials.testCredentials();
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('No API credentials configured');
    });

    it('should handle missing API client gracefully', async () => {
      const serviceWithoutClient = new MexcAuthenticationService(validConfig);
      
      const result = await serviceWithoutClient.testCredentials();
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('API client not initialized');
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
      mockApiClient.testCredentials.mockResolvedValueOnce({
        isValid: false,
        hasConnection: false,
        error: 'Invalid API key'
      });
      
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
      mockApiClient.testCredentials.mockResolvedValue({
        isValid: false,
        hasConnection: false,
        error: 'Invalid API key'
      });
      
      // Fail exactly maxAuthFailures times
      for (let i = 0; i < validConfig.maxAuthFailures!; i++) {
        await authService.testCredentials();
      }
      
      const status = authService.getStatus();
      expect(status.isBlocked).toBe(true);
      expect(status.blockReason).toContain('failures');
    });

    it('should reset circuit breaker after timeout', async () => {
      // Create a service with a very short timeout for this test
      const testService = new MexcAuthenticationService({
        ...validConfig,
        authFailureResetMs: 100 // 100ms timeout for fast test
      });
      testService.setApiClient(mockApiClient);
      
      // Block the service
      mockApiClient.testCredentials.mockResolvedValue({
        isValid: false,
        hasConnection: false,
        error: 'Invalid API key'
      });
      for (let i = 0; i < validConfig.maxAuthFailures!; i++) {
        await testService.testCredentials();
      }
      
      expect(testService.getStatus().isBlocked).toBe(true);
      
      // Wait for timeout to pass
      await new Promise(resolve => setTimeout(resolve, 150)); // Wait for 150ms (longer than 100ms timeout)
      
      // Reset mock to return success
      mockApiClient.testCredentials.mockResolvedValue({
        isValid: true,
        hasConnection: true,
        error: undefined
      });
      
      const result = await testService.testCredentials();
      expect(result.isValid).toBe(true);
      expect(testService.getStatus().isBlocked).toBe(false);
    });

    it('should handle network errors gracefully', async () => {
      mockApiClient.testCredentials.mockRejectedValueOnce(new Error('Network error'));
      
      const result = await authService.testCredentials();
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle API timeout errors', async () => {
      mockApiClient.testCredentials.mockRejectedValueOnce(new Error('Request timeout'));
      
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
      mockApiClient.testCredentials.mockResolvedValueOnce({
        isValid: false,
        hasConnection: false,
        error: 'Invalid API key'
      });
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
      
      mockApiClient.testCredentials.mockResolvedValueOnce({
        isValid: false,
        hasConnection: false,
        error: 'Invalid API key'
      });
      await authService.testCredentials();
      
      const metrics = authService.getMetrics();
      expect(metrics.successRate).toBeCloseTo(66.67, 1);
    });

    it('should track uptime when valid', async () => {
      await authService.testCredentials();
      
      // Wait a bit and check uptime
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const metrics = authService.getMetrics();
      expect(metrics.uptimeMs).toBeGreaterThan(0);
    });
  });

  describe('Encryption and Security', () => {
    it('should encrypt credentials when encryption is enabled', () => {
      const encryptedCreds = authService.getEncryptedCredentials();
      
      expect(encryptedCreds).not.toBeNull();
      // Check that the encrypted values are not the original values and contain encrypted markers
      expect(encryptedCreds!.apiKey).not.toBe(validConfig.apiKey);
      expect(encryptedCreds!.secretKey).not.toBe(validConfig.secretKey);
      // Check that the encrypted format contains a colon (IV:encrypted_data)
      expect(encryptedCreds!.apiKey).toContain(':');
      expect(encryptedCreds!.secretKey).toContain(':');
      // Check that they are hex strings
      expect(encryptedCreds!.apiKey).toMatch(/^[a-f0-9]+:[a-f0-9]+$/);
      expect(encryptedCreds!.secretKey).toMatch(/^[a-f0-9]+:[a-f0-9]+$/);
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
      // Create a service with specific failure threshold and no periodic testing initially
      const testService = new MexcAuthenticationService({ 
        enableEncryption: false,
        maxAuthFailures: 3, // Set explicit failure threshold
        testIntervalMs: 0 // Disable periodic testing initially
      });
      testService.setApiClient(mockApiClient);
      
      // Add credentials manually without triggering periodic testing
      testService['config'].apiKey = 'test-key';
      testService['config'].secretKey = 'test-secret';
      testService['status'].hasCredentials = true;
      
      // Block the service by failing multiple times
      mockApiClient.testCredentials.mockResolvedValue({
        isValid: false,
        hasConnection: false,
        error: 'Invalid API key'
      });
      
      for (let i = 0; i < 3; i++) { // Fail exactly 3 times to trigger block
        await testService.testCredentials();
      }
      
      expect(testService.getStatus().isBlocked).toBe(true);
      
      // Clear all previous mocks and set up a fresh spy
      vi.clearAllMocks();
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      
      // Try to start periodic testing manually - should not start when blocked
      (testService as any).startPeriodicTesting();
      
      expect(setIntervalSpy).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle extremely long response times', async () => {
      // Mock a slow response using realistic timing
      mockApiClient.testCredentials.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        return {
          isValid: true,
          hasConnection: true,
          error: undefined
        };
      });
      
      const result = await authService.testCredentials();
      
      expect(result.responseTime).toBeGreaterThan(90); // Expect at least 90ms
    });

    it('should handle malformed API responses', async () => {
      mockApiClient.testCredentials.mockResolvedValueOnce(null as any);
      
      const result = await authService.testCredentials();
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid API response format');
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