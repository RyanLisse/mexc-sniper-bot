/**
 * Unit tests for MexcAuthenticationService
 * Tests authentication, credential management, encryption, health monitoring, and periodic testing
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as crypto from 'node:crypto';
import {
  MexcAuthenticationService,
  createMexcAuthenticationService,
  getGlobalAuthenticationService,
  resetGlobalAuthenticationService,
  initializeAuthentication,
  type AuthenticationConfig,
  type AuthenticationStatus,
  type CredentialTestResult,
  type AuthenticationMetrics,
} from '../../../../src/services/api/mexc-authentication-service';
import type { MexcApiClient } from '../../../../src/services/api/mexc-api-client';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../../utils/timeout-elimination-helpers';

// Mock crypto module
vi.mock('node:crypto', () => ({
  randomBytes: vi.fn(),
  createCipheriv: vi.fn(),
  createDecipheriv: vi.fn(),
}));

// Mock console methods
const mockConsole = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

describe('MexcAuthenticationService', () => {
  let authService: MexcAuthenticationService;
  let mockApiClient: MexcApiClient;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();

    // Store original environment
    originalEnv = { ...process.env };

    // Mock console methods
    global.console.info = mockConsole.info;
    global.console.warn = mockConsole.warn;
    global.console.error = mockConsole.error;
    global.console.debug = mockConsole.debug;

    // Setup environment variables
    process.env.MEXC_API_KEY = 'env-api-key';
    process.env.MEXC_SECRET_KEY = 'env-secret-key';
    process.env.MEXC_PASSPHRASE = 'env-passphrase';
    process.env.MEXC_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    // Create mock API client
    mockApiClient = {
      testCredentials: vi.fn().mockResolvedValue({
        isValid: true,
        hasConnection: true,
        error: undefined,
      }),
      getAccountInfo: vi.fn().mockResolvedValue({
        success: true,
        error: undefined,
      }),
    } as any;

    // Reset global instance
    resetGlobalAuthenticationService();
  });

  afterEach(async () => {
    // TIMEOUT ELIMINATION: Ensure all promises are flushed before cleanup
    await flushPromises();
    vi.useRealTimers();
    vi.restoreAllMocks();
    
    // Restore original environment
    process.env = originalEnv;

    // Cleanup any created services
    if (authService) {
      authService.destroy();
    }
    resetGlobalAuthenticationService();
  
  });

  describe('Constructor and Configuration', () => {
    it('should create service with explicit credentials', () => {
      const config: Partial<AuthenticationConfig> = {
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
        passphrase: 'test-passphrase',
      };

      authService = new MexcAuthenticationService(config);

      expect(authService.hasCredentials()).toBe(true);
      expect(authService.getStatus().hasCredentials).toBe(true);
    });

    it('should create service with environment variables', () => {
      authService = new MexcAuthenticationService();

      expect(authService.hasCredentials()).toBe(true);
      expect(authService.getStatus().hasCredentials).toBe(true);
    });

    it('should create service without credentials', () => {
      process.env.MEXC_API_KEY = '';
      process.env.MEXC_SECRET_KEY = '';

      authService = new MexcAuthenticationService({
        apiKey: '',
        secretKey: '',
      });

      expect(authService.hasCredentials()).toBe(false);
      expect(authService.getStatus().hasCredentials).toBe(false);
    });

    it('should use default configuration values', () => {
      authService = new MexcAuthenticationService();
      const config = authService.getConfig();

      expect(config.enableEncryption).toBe(false);
      expect(config.testIntervalMs).toBe(300000); // 5 minutes
      expect(config.maxAuthFailures).toBe(5);
      expect(config.authFailureResetMs).toBe(600000); // 10 minutes
    });

    it('should override defaults with provided config', () => {
      const config: Partial<AuthenticationConfig> = {
        apiKey: 'test-key',
        secretKey: 'test-secret',
        enableEncryption: true,
        testIntervalMs: 60000,
        maxAuthFailures: 3,
        authFailureResetMs: 300000,
      };

      authService = new MexcAuthenticationService(config);
      const resultConfig = authService.getConfig();

      expect(resultConfig.enableEncryption).toBe(true);
      expect(resultConfig.testIntervalMs).toBe(60000);
      expect(resultConfig.maxAuthFailures).toBe(3);
      expect(resultConfig.authFailureResetMs).toBe(300000);
    });

    it('should start periodic testing with valid credentials', () => {
      const config: Partial<AuthenticationConfig> = {
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
        testIntervalMs: 1000,
      };

      authService = new MexcAuthenticationService(config);
      authService.setApiClient(mockApiClient);

      // Verify periodic testing is scheduled
      expect(setTimeout).toHaveBeenCalled();
    });

    it('should not start periodic testing without credentials', () => {
      const config: Partial<AuthenticationConfig> = {
        apiKey: '',
        secretKey: '',
        testIntervalMs: 1000,
      };

      authService = new MexcAuthenticationService(config);

      // Should not schedule periodic testing
      expect(setInterval).not.toHaveBeenCalled();
    });
  });

  describe('Credential Management', () => {
    beforeEach(() => {
      authService = new MexcAuthenticationService({
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
      });
    });

    it('should correctly identify when credentials exist', () => {
      expect(authService.hasCredentials()).toBe(true);
    });

    it('should correctly identify when credentials are missing', () => {
      const noCredsService = new MexcAuthenticationService({
        apiKey: '',
        secretKey: '',
      });

      expect(noCredsService.hasCredentials()).toBe(false);
      noCredsService.destroy();
    });

    it('should identify partial credentials as missing', () => {
      const partialCredsService = new MexcAuthenticationService({
        apiKey: 'test-key',
        secretKey: '',
      });

      expect(partialCredsService.hasCredentials()).toBe(false);
      partialCredsService.destroy();
    });

    it('should update credentials successfully', async () => {
      authService.setApiClient(mockApiClient);

      await authService.updateCredentials({
        apiKey: 'new-api-key',
        secretKey: 'new-secret-key',
      });

      expect(authService.hasCredentials()).toBe(true);
      expect(mockApiClient.testCredentials).toHaveBeenCalled();
    });

    it('should reset status when updating credentials', async () => {
      authService.setApiClient(mockApiClient);

      // Simulate failed state
      const status = authService.getStatus();
      status.failureCount = 3;
      status.isBlocked = true;

      await authService.updateCredentials({
        apiKey: 'new-key',
        secretKey: 'new-secret',
      });

      const newStatus = authService.getStatus();
      expect(newStatus.failureCount).toBe(0);
      expect(newStatus.isBlocked).toBe(false);
    });

    it('should handle credential updates without API client', async () => {
      await authService.updateCredentials({
        apiKey: 'new-key',
        secretKey: 'new-secret',
      });

      expect(authService.hasCredentials()).toBe(true);
      // Should not crash without API client
    });
  });

  describe('Authentication Status', () => {
    beforeEach(() => {
      authService = new MexcAuthenticationService({
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
      });
    });

    it('should return current authentication status', () => {
      const status = authService.getStatus();

      expect(status).toMatchObject({
        hasCredentials: true,
        isValid: false,
        isConnected: false,
        failureCount: 0,
        isBlocked: false,
      });
      expect(status.lastTestedAt).toBeUndefined();
      expect(status.lastValidAt).toBeUndefined();
    });

    it('should update hasCredentials dynamically', () => {
      let status = authService.getStatus();
      expect(status.hasCredentials).toBe(true);

      // Simulate credential removal
      authService.updateCredentials({ apiKey: '', secretKey: '' });

      status = authService.getStatus();
      expect(status.hasCredentials).toBe(false);
    });

    it('should track authentication metrics', () => {
      const metrics = authService.getMetrics();

      expect(metrics).toMatchObject({
        totalTests: 0,
        successfulTests: 0,
        failedTests: 0,
        averageResponseTime: 0,
        successRate: 0,
        uptime: 0,
        uptimeMs: 0,
      });
      expect(metrics.lastTestTime).toBeUndefined();
    });

    it('should calculate uptime from last valid authentication', async () => {
      authService.setApiClient(mockApiClient);
      
      // Perform successful test
      await authService.testCredentials();
      
      // Advance time
      vi.advanceTimersByTime(60000); // 1 minute
      
      const metrics = authService.getMetrics();
      expect(metrics.uptime).toBeGreaterThan(0);
      expect(metrics.uptimeMs).toBeGreaterThan(0);
    });
  });

  describe('Credential Testing', () => {
    beforeEach(() => {
      authService = new MexcAuthenticationService({
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
      });
      authService.setApiClient(mockApiClient);
    });

    it('should test credentials successfully', async () => {
      const result = await authService.testCredentials();

      expect(result).toMatchObject({
        isValid: true,
        hasConnection: true,
        responseTime: expect.any(Number),
        timestamp: expect.any(Date),
      });
      expect(result.error).toBeUndefined();
      expect(mockApiClient.testCredentials).toHaveBeenCalled();
    });

    it('should handle API client test method not available', async () => {
      mockApiClient.testCredentials = undefined as any;

      const result = await authService.testCredentials();

      expect(mockApiClient.getAccountInfo).toHaveBeenCalled();
      expect(result.isValid).toBe(true);
    });

    it('should handle failed credential test', async () => {
      mockApiClient.testCredentials = vi.fn().mockResolvedValue({
        isValid: false,
        hasConnection: true,
        error: 'Invalid API key',
      });

      const result = await authService.testCredentials();

      expect(result).toMatchObject({
        isValid: false,
        hasConnection: true,
        error: 'Invalid API key',
        timestamp: expect.any(Date),
      });
    });

    it('should handle API client errors', async () => {
      mockApiClient.testCredentials = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await authService.testCredentials();

      expect(result).toMatchObject({
        isValid: false,
        hasConnection: false,
        error: 'Credential test failed: Network error',
        timestamp: expect.any(Date),
      });
    });

    it('should handle malformed API responses', async () => {
      mockApiClient.testCredentials = vi.fn().mockResolvedValue(null);

      const result = await authService.testCredentials();

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid API response format');
    });

    it('should calculate response time correctly', async () => {
      // Mock a delay in the API call
      mockApiClient.testCredentials = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { isValid: true, hasConnection: true };
      });

      const result = await authService.testCredentials();

      expect(result.responseTime).toBeGreaterThan(0);
    });

    it('should update metrics after test', async () => {
      await authService.testCredentials();

      const metrics = authService.getMetrics();
      expect(metrics.totalTests).toBe(1);
      expect(metrics.successfulTests).toBe(1);
      expect(metrics.successRate).toBe(100);
      expect(metrics.lastTestTime).toBeDefined();
    });

    it('should track failed test metrics', async () => {
      mockApiClient.testCredentials = vi.fn().mockResolvedValue({
        isValid: false,
        hasConnection: false,
        error: 'Test error',
      });

      await authService.testCredentials();

      const metrics = authService.getMetrics();
      expect(metrics.totalTests).toBe(1);
      expect(metrics.failedTests).toBe(1);
      expect(metrics.successRate).toBe(0);
    });

    it('should test without credentials', async () => {
      const noCredsService = new MexcAuthenticationService({
        apiKey: '',
        secretKey: '',
      });

      const result = await noCredsService.testCredentials();

      expect(result).toMatchObject({
        isValid: false,
        hasConnection: false,
        error: 'No API credentials configured',
      });
      
      noCredsService.destroy();
    });

    it('should test without API client', async () => {
      const result = await authService.testCredentials();

      expect(result).toMatchObject({
        isValid: false,
        hasConnection: false,
        error: 'API client not initialized',
      });
    });

    it('should handle blocked authentication', async () => {
      // Simulate multiple failures to trigger blocking
      mockApiClient.testCredentials = vi.fn().mockResolvedValue({
        isValid: false,
        hasConnection: false,
        error: 'Auth failed',
      });

      // Perform enough failures to trigger blocking
      for (let i = 0; i < 5; i++) {
        await authService.testCredentials();
      }

      const result = await authService.testCredentials();

      expect(result).toMatchObject({
        isValid: false,
        hasConnection: false,
        error: 'Authentication blocked due to repeated failures',
      });
    });

    it('should allow forced testing when blocked', async () => {
      // Trigger blocking
      mockApiClient.testCredentials = vi.fn().mockResolvedValue({
        isValid: false,
        hasConnection: false,
        error: 'Auth failed',
      });

      for (let i = 0; i < 5; i++) {
        await authService.testCredentials();
      }

      // Force test should bypass blocking
      const result = await authService.testCredentials(true);

      expect(mockApiClient.testCredentials).toHaveBeenCalled();
    });
  });

  describe('Authentication Blocking and Recovery', () => {
    beforeEach(() => {
      authService = new MexcAuthenticationService({
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
        maxAuthFailures: 3,
        authFailureResetMs: 1000,
      });
      authService.setApiClient(mockApiClient);
    });

    it('should block authentication after maximum failures', async () => {
      mockApiClient.testCredentials = vi.fn().mockResolvedValue({
        isValid: false,
        hasConnection: false,
        error: 'Auth failed',
      });

      // Trigger blocking
      for (let i = 0; i < 3; i++) {
        await authService.testCredentials();
      }

      const status = authService.getStatus();
      expect(status.isBlocked).toBe(true);
      expect(status.blockReason).toContain('Too many authentication failures');
    });

    it('should automatically unblock after reset timeout', async () => {
      mockApiClient.testCredentials = vi.fn().mockResolvedValue({
        isValid: false,
        hasConnection: false,
        error: 'Auth failed',
      });

      // Trigger blocking
      for (let i = 0; i < 3; i++) {
        await authService.testCredentials();
      }

      expect(authService.getStatus().isBlocked).toBe(true);

      // Advance time past reset timeout
      vi.advanceTimersByTime(1100);

      const status = authService.getStatus();
      expect(status.isBlocked).toBe(false);
      expect(status.failureCount).toBe(0);
    });

    it('should reset failure count on successful authentication', async () => {
      // Simulate some failures
      mockApiClient.testCredentials = vi.fn().mockResolvedValue({
        isValid: false,
        hasConnection: false,
        error: 'Auth failed',
      });

      await authService.testCredentials();
      await authService.testCredentials();

      expect(authService.getStatus().failureCount).toBe(2);

      // Simulate success
      mockApiClient.testCredentials = vi.fn().mockResolvedValue({
        isValid: true,
        hasConnection: true,
      });

      await authService.testCredentials();

      const status = authService.getStatus();
      expect(status.failureCount).toBe(0);
      expect(status.isBlocked).toBe(false);
    });
  });

  describe('Credential Encryption', () => {
    beforeEach(() => {
      authService = new MexcAuthenticationService({
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
        enableEncryption: true,
        encryptionKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      });

      // Mock crypto functions
      (crypto.randomBytes as any).mockReturnValue(Buffer.from('1234567890123456', 'hex'));
      
      const mockCipher = {
        update: vi.fn().mockReturnValue('encrypted'),
        final: vi.fn().mockReturnValue('final'),
      };
      (crypto.createCipheriv as any).mockReturnValue(mockCipher);

      const mockDecipher = {
        update: vi.fn().mockReturnValue('decrypted'),
        final: vi.fn().mockReturnValue('final'),
      };
      (crypto.createDecipheriv as any).mockReturnValue(mockDecipher);
    });

    it('should encrypt credentials when enabled', () => {
      const encrypted = authService.getEncryptedCredentials();

      expect(encrypted).toBeDefined();
      expect(encrypted!.apiKey).toContain(':');
      expect(encrypted!.secretKey).toContain(':');
      expect(crypto.createCipheriv).toHaveBeenCalledTimes(2);
    });

    it('should return null when encryption not enabled', () => {
      const noEncryptionService = new MexcAuthenticationService({
        apiKey: 'test-key',
        secretKey: 'test-secret',
        enableEncryption: false,
      });

      const encrypted = noEncryptionService.getEncryptedCredentials();

      expect(encrypted).toBeNull();
      noEncryptionService.destroy();
    });

    it('should return null when no encryption key provided', () => {
      const noKeyService = new MexcAuthenticationService({
        apiKey: 'test-key',
        secretKey: 'test-secret',
        enableEncryption: true,
        encryptionKey: '',
      });

      const encrypted = noKeyService.getEncryptedCredentials();

      expect(encrypted).toBeNull();
      noKeyService.destroy();
    });

    it('should decrypt credentials successfully', async () => {
      const encrypted = {
        apiKey: '1234567890123456:encryptedfinal',
        secretKey: '1234567890123456:encryptedfinal',
      };

      const success = await authService.setEncryptedCredentials(encrypted);

      expect(success).toBe(true);
      expect(crypto.createDecipheriv).toHaveBeenCalledTimes(2);
    });

    it('should handle encryption errors gracefully', () => {
      (crypto.createCipheriv as any).mockImplementation(() => {
        throw new Error('Encryption error');
      });

      const encrypted = authService.getEncryptedCredentials();

      expect(encrypted).toBeNull();
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[mexc-authentication-service]'),
        'Failed to encrypt credentials:',
        '',
        expect.any(Error)
      );
    });

    it('should handle decryption errors gracefully', async () => {
      (crypto.createDecipheriv as any).mockImplementation(() => {
        throw new Error('Decryption error');
      });

      const encrypted = {
        apiKey: 'invalid:data',
        secretKey: 'invalid:data',
      };

      const success = await authService.setEncryptedCredentials(encrypted);

      expect(success).toBe(false);
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[mexc-authentication-service]'),
        'Failed to decrypt credentials:',
        '',
        expect.any(Error)
      );
    });
  });

  describe('Health Checks and Monitoring', () => {
    beforeEach(() => {
      authService = new MexcAuthenticationService({
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
        testIntervalMs: 60000,
      });
      authService.setApiClient(mockApiClient);
    });

    it('should perform comprehensive health check', async () => {
      const health = await authService.performHealthCheck();

      expect(health).toMatchObject({
        healthy: true,
        status: expect.any(Object),
        metrics: expect.any(Object),
        recommendations: expect.any(Array),
      });
    });

    it('should provide recommendations for missing credentials', async () => {
      const noCredsService = new MexcAuthenticationService({
        apiKey: '',
        secretKey: '',
      });

      const health = await noCredsService.performHealthCheck();

      expect(health.healthy).toBe(false);
      expect(health.recommendations).toContain('Configure API credentials');
      
      noCredsService.destroy();
    });

    it('should provide recommendations for invalid credentials', async () => {
      mockApiClient.testCredentials = vi.fn().mockResolvedValue({
        isValid: false,
        hasConnection: true,
        error: 'Invalid credentials',
      });

      await authService.testCredentials(); // Trigger test first
      const health = await authService.performHealthCheck();

      expect(health.healthy).toBe(false);
      expect(health.recommendations).toContain('Verify API credentials are correct');
    });

    it('should provide recommendations for connectivity issues', async () => {
      mockApiClient.testCredentials = vi.fn().mockResolvedValue({
        isValid: true,
        hasConnection: false,
        error: 'Network error',
      });

      await authService.testCredentials();
      const health = await authService.performHealthCheck();

      expect(health.healthy).toBe(false);
      expect(health.recommendations).toContain('Check network connectivity to MEXC API');
    });

    it('should provide recommendations for poor reliability', async () => {
      // Simulate poor success rate
      mockApiClient.testCredentials = vi.fn().mockResolvedValue({
        isValid: false,
        hasConnection: false,
        error: 'Intermittent failure',
      });

      // Perform multiple failed tests
      for (let i = 0; i < 10; i++) {
        await authService.testCredentials();
      }

      const health = await authService.performHealthCheck();

      expect(health.recommendations).toContain('Monitor API reliability - success rate below 90%');
    });

    it('should provide recommendations for blocked authentication', async () => {
      // Trigger blocking
      mockApiClient.testCredentials = vi.fn().mockResolvedValue({
        isValid: false,
        hasConnection: false,
        error: 'Auth failed',
      });

      for (let i = 0; i < 5; i++) {
        await authService.testCredentials();
      }

      const health = await authService.performHealthCheck();

      expect(health.healthy).toBe(false);
      expect(health.recommendations).toContain(
        'Authentication is blocked due to failures - check credentials and try again'
      );
    });

    it('should test stale credentials during health check', async () => {
      // Make last test appear stale
      vi.advanceTimersByTime(70000); // Advance past test interval

      await authService.performHealthCheck();

      expect(mockApiClient.testCredentials).toHaveBeenCalled();
    });
  });

  describe('Service Reset and Cleanup', () => {
    beforeEach(() => {
      authService = new MexcAuthenticationService({
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
      });
    });

    it('should reset authentication state', () => {
      // Simulate some state
      authService.getStatus().failureCount = 3;
      authService.getStatus().isBlocked = true;

      authService.reset();

      const status = authService.getStatus();
      expect(status.failureCount).toBe(0);
      expect(status.isBlocked).toBe(false);
      expect(status.error).toBeUndefined();

      const metrics = authService.getMetrics();
      expect(metrics.totalTests).toBe(0);
      expect(metrics.successfulTests).toBe(0);
      expect(metrics.failedTests).toBe(0);
    });

    it('should destroy service cleanly', () => {
      authService.destroy();

      const status = authService.getStatus();
      expect(status.hasCredentials).toBe(false);
      expect(status.isValid).toBe(false);
      expect(status.isConnected).toBe(false);
    });

    it('should sanitize configuration when requested', () => {
      const config = authService.getConfig();

      expect(config).not.toHaveProperty('apiKey');
      expect(config).not.toHaveProperty('secretKey');
      expect(config).not.toHaveProperty('encryptionKey');
      expect(config).toHaveProperty('enableEncryption');
      expect(config).toHaveProperty('testIntervalMs');
    });
  });

  describe('Factory Functions', () => {
    it('should create service with factory function', () => {
      const service = createMexcAuthenticationService({
        apiKey: 'factory-key',
        secretKey: 'factory-secret',
      });

      expect(service).toBeInstanceOf(MexcAuthenticationService);
      expect(service.hasCredentials()).toBe(true);
      
      service.destroy();
    });

    it('should apply default configuration in factory', () => {
      const service = createMexcAuthenticationService();
      const config = service.getConfig();

      expect(config.enableEncryption).toBe(false);
      expect(config.testIntervalMs).toBe(300000);
      expect(config.maxAuthFailures).toBe(5);
      
      service.destroy();
    });

    it('should get global authentication service', () => {
      const service1 = getGlobalAuthenticationService();
      const service2 = getGlobalAuthenticationService();

      expect(service1).toBe(service2); // Same instance
      expect(service1).toBeInstanceOf(MexcAuthenticationService);
    });

    it('should reset global authentication service', () => {
      const service1 = getGlobalAuthenticationService();
      resetGlobalAuthenticationService();
      const service2 = getGlobalAuthenticationService();

      expect(service1).not.toBe(service2); // Different instances
    });

    it('should initialize authentication with API client', async () => {
      const service = await initializeAuthentication(mockApiClient, {
        apiKey: 'init-key',
        secretKey: 'init-secret',
      });

      expect(service).toBeInstanceOf(MexcAuthenticationService);
      expect(mockApiClient.testCredentials).toHaveBeenCalled();
      
      service.destroy();
    });

    it('should use global service when no config provided', async () => {
      resetGlobalAuthenticationService();
      
      const service = await initializeAuthentication(mockApiClient);

      expect(service).toBeInstanceOf(MexcAuthenticationService);
      
      service.destroy();
    });
  });

  describe('Periodic Testing', () => {
    beforeEach(() => {
      authService = new MexcAuthenticationService({
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
        testIntervalMs: 1000,
      });
      authService.setApiClient(mockApiClient);
    });

    it('should perform periodic credential testing', async () => {
      // Advance timer to trigger periodic test
      vi.advanceTimersByTime(1000);

      expect(mockApiClient.testCredentials).toHaveBeenCalled();
    });

    it('should stop periodic testing when blocked', async () => {
      // Trigger blocking
      mockApiClient.testCredentials = vi.fn().mockResolvedValue({
        isValid: false,
        hasConnection: false,
        error: 'Auth failed',
      });

      for (let i = 0; i < 5; i++) {
        await authService.testCredentials();
      }

      // Clear call history
      vi.clearAllMocks();

      // Advance timer - should not trigger test when blocked
      vi.advanceTimersByTime(1000);

      expect(mockApiClient.testCredentials).not.toHaveBeenCalled();
    });

    it('should restart periodic testing after successful credential update', async () => {
      // Create service without credentials
      const noCredsService = new MexcAuthenticationService({
        apiKey: '',
        secretKey: '',
        testIntervalMs: 1000,
      });
      noCredsService.setApiClient(mockApiClient);

      // Update with valid credentials
      await noCredsService.updateCredentials({
        apiKey: 'new-key',
        secretKey: 'new-secret',
      });

      // Should now schedule periodic testing
      vi.advanceTimersByTime(1000);

      expect(mockApiClient.testCredentials).toHaveBeenCalled();
      
      noCredsService.destroy();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(() => {
      authService = new MexcAuthenticationService({
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
      });
    });

    it('should handle undefined environment variables', () => {
      delete process.env.MEXC_API_KEY;
      delete process.env.MEXC_SECRET_KEY;

      const service = new MexcAuthenticationService();

      expect(service.hasCredentials()).toBe(false);
      service.destroy();
    });

    it('should handle null/undefined credential values', () => {
      const service = new MexcAuthenticationService({
        apiKey: null as any,
        secretKey: undefined as any,
      });

      expect(service.hasCredentials()).toBe(false);
      service.destroy();
    });

    it('should handle very fast response times', async () => {
      authService.setApiClient(mockApiClient);
      
      // Mock instant response
      mockApiClient.testCredentials = vi.fn().mockResolvedValue({
        isValid: true,
        hasConnection: true,
      });

      const result = await authService.testCredentials();

      expect(result.responseTime).toBeGreaterThanOrEqual(1); // Minimum 1ms
    });

    it('should handle encryption without proper key length', () => {
      const service = new MexcAuthenticationService({
        apiKey: 'test-key',
        secretKey: 'test-secret',
        enableEncryption: true,
        encryptionKey: 'short-key', // Invalid length
      });

      // Should handle gracefully when encryption fails
      const encrypted = service.getEncryptedCredentials();
      expect(encrypted).toBeNull();
      
      service.destroy();
    });

    it('should handle malformed encrypted credential format', async () => {
      const service = new MexcAuthenticationService({
        enableEncryption: true,
        encryptionKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      });

      const malformed = {
        apiKey: 'invalid-format',
        secretKey: 'also-invalid',
      };

      const success = await service.setEncryptedCredentials(malformed);

      expect(success).toBe(false);
      service.destroy();
    });
  });
});