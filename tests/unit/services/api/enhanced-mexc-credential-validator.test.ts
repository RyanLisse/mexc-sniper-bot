/**
 * Unit tests for Enhanced MEXC Credential Validator
 * Tests credential validation, circuit breaker, health metrics, authentication, and error handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as crypto from 'node:crypto';
import {
  EnhancedCredentialValidator,
  createEnhancedCredentialValidator,
  getGlobalCredentialValidator,
  resetGlobalCredentialValidator,
  type CredentialValidationResult,
  type CircuitBreakerState,
  type ConnectionHealthMetrics,
  type EnhancedCredentialValidatorConfig,
} from '../../../../src/services/api/enhanced-mexc-credential-validator';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../../utils/timeout-elimination-helpers';

// Mock crypto module
vi.mock('node:crypto', () => ({
  createHmac: vi.fn(() => ({
    update: vi.fn(() => ({
      digest: vi.fn(() => 'mocked-signature'),
    })),
  })),
}));

// Mock fetch
global.fetch = vi.fn();

// Mock dynamic imports
vi.mock('@/src/db', () => ({
  db: {},
}));

vi.mock('@/src/db/schema', () => ({
  apiCredentials: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

describe('Enhanced MEXC Credential Validator', () => {
  let mockConsole: any;
  let validator: EnhancedCredentialValidator;
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

    // Reset global validator
    resetGlobalCredentialValidator();

    // Create validator with test configuration aligned with implementation defaults
    validator = new EnhancedCredentialValidator({
      circuitBreakerThreshold: 5, // Match implementation default
      circuitBreakerResetTimeout: 10000,
      requestTimeout: 5000,
      maxRetries: 2,
      retryDelay: 100,
      healthCheckInterval: 1000,
      enableRealTimeMonitoring: true,
    });

    // Mock successful fetch by default
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: vi.fn().mockResolvedValue({
        accountType: 'SPOT',
        permissions: ['spot'],
      }),
    } as any);
  });

  afterEach(async () => {
    // TIMEOUT ELIMINATION: Ensure all promises are flushed before cleanup
    await flushPromises();
    vi.restoreAllMocks();
    
    // Restore original environment
    process.env = originalEnv;
    
    resetGlobalCredentialValidator();
  
  });

  describe('Constructor and Configuration', () => {
    it('should create validator with default configuration', () => {
      const defaultValidator = new EnhancedCredentialValidator();
      
      expect(defaultValidator).toBeDefined();
      expect(defaultValidator).toBeInstanceOf(EnhancedCredentialValidator);
    });

    it('should create validator with custom configuration', () => {
      const customConfig: Partial<EnhancedCredentialValidatorConfig> = {
        circuitBreakerThreshold: 10,
        requestTimeout: 20000,
        maxRetries: 5,
      };

      const customValidator = new EnhancedCredentialValidator(customConfig);
      
      expect(customValidator).toBeDefined();
    });

    it('should initialize health metrics correctly', () => {
      const metrics = validator.getHealthMetrics();
      
      expect(metrics).toMatchObject({
        totalChecks: 0,
        successfulChecks: 0,
        failedChecks: 0,
        successRate: 0,
        averageLatency: 0,
        consecutiveFailures: 0,
        connectionQuality: 'excellent',
      });
    });

    it('should initialize circuit breaker correctly', () => {
      const status = validator.getCircuitBreakerStatus();
      
      expect(status).toMatchObject({
        isOpen: false,
        failures: 0,
      });
    });
  });

  describe('Credential Detection and Format Validation', () => {
    it('should validate credentials successfully when available', async () => {
      process.env.MEXC_API_KEY = 'mx0validApiKeyWithProperFormat123';
      process.env.MEXC_SECRET_KEY = 'a1b2c3d4e5f6789012345678901234567890abcdef12'; // Extended to 42 hex chars

      const result = await validator.validateCredentials();

      expect(result.hasCredentials).toBe(true);
      expect(result.source).toBe('environment');
      expect(result.validFormat).toBe(true);
      expect(result.details.apiKeyValid).toBe(true);
      expect(result.details.secretKeyValid).toBe(true);
    });

    it('should detect missing credentials', async () => {
      delete process.env.MEXC_API_KEY;
      delete process.env.MEXC_SECRET_KEY;

      const result = await validator.validateCredentials();

      expect(result.hasCredentials).toBe(false);
      expect(result.isValid).toBe(false);
      expect(result.source).toBe('none');
      expect(result.error).toContain('No API credentials configured');
      expect(result.details.formatValidation).toContain('No credentials found');
    });

    it('should detect test credentials and flag as invalid', async () => {
      process.env.MEXC_API_KEY = 'mx0vglsgdd7flAhfqq'; // Test API key
      process.env.MEXC_SECRET_KEY = '0351d73e5a444d5ea5de2d527bd2a07a'; // Test secret

      const result = await validator.validateCredentials();

      expect(result.hasCredentials).toBe(true);
      expect(result.isValid).toBe(false);
      expect(result.isTestCredentials).toBe(true);
      expect(result.canAuthenticate).toBe(false);
      expect(result.error).toContain('test or placeholder credentials detected');
      expect(result.details.formatValidation).toContain('Test credentials detected');

      expect(mockConsole.warn).toHaveBeenCalledWith(
        '🔍 Test credentials detected - system will flag as invalid for proper validation'
      );
    });

    it('should detect various test credential patterns', async () => {
      const testPatterns = [
        { apiKey: 'test-api-key', secretKey: 'abcdef1234567890abcdef1234567890abcdef12' },
        { apiKey: 'demo_key', secretKey: 'abcdef1234567890abcdef1234567890abcdef12' },
        { apiKey: 'your_api_key', secretKey: 'abcdef1234567890abcdef1234567890abcdef12' },
        { apiKey: 'mx0validApiKeyButDetectedAsTest789', secretKey: 'placeholder_secret' },
        { apiKey: '12345678901234567890', secretKey: 'abcdef1234567890abcdef1234567890abcdef12' },
        { apiKey: 'mx0validApiKeyFormat123', secretKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      ];

      for (const { apiKey, secretKey } of testPatterns) {
        process.env.MEXC_API_KEY = apiKey;
        process.env.MEXC_SECRET_KEY = secretKey;

        const result = await validator.validateCredentials();

        expect(result.isTestCredentials).toBe(true);
        expect(result.isValid).toBe(false);
      }
    });

    it('should validate API key format correctly', async () => {
      const validApiKey = 'mx0validApiKeyWithProperFormat123';
      const validSecretKey = 'a1b2c3d4e5f6789012345678901234567890abcdef12'; // Extended to 42 hex chars

      process.env.MEXC_API_KEY = validApiKey;
      process.env.MEXC_SECRET_KEY = validSecretKey;

      const formatResult = await validator.validateFormat();

      expect(formatResult.validFormat).toBe(true);
      expect(formatResult.apiKeyValid).toBe(true);
      expect(formatResult.secretKeyValid).toBe(true);
      expect(formatResult.validationMessages).toContain('Credential format valid');
    });

    it('should reject invalid API key formats', async () => {
      const invalidApiKeys = [
        '', // Empty
        'short', // Too short
        'noMxPrefix123456789', // Doesn't start with 'mx'
        'mx0invalid@key#', // Invalid characters
      ];

      for (const apiKey of invalidApiKeys) {
        process.env.MEXC_API_KEY = apiKey;
        process.env.MEXC_SECRET_KEY = 'a1b2c3d4e5f6789012345678901234567890abcdef12'; // Valid hex format

        const formatResult = await validator.validateFormat();

        expect(formatResult.apiKeyValid).toBe(false);
        expect(formatResult.validationMessages).toContain('API key format invalid');
      }
    });

    it('should reject invalid secret key formats', async () => {
      const invalidSecretKeys = [
        '', // Empty
        'short', // Too short
        'not-hex-characters!@#$%^&*()', // Invalid characters
        '1234567890123456789012345678901g', // Contains non-hex character 'g'
        'abcdef123456789012345678901234567890abcdef123456789g', // Too long with invalid char
      ];

      for (const secretKey of invalidSecretKeys) {
        process.env.MEXC_API_KEY = 'mx0validApiKeyWithProperFormat123';
        process.env.MEXC_SECRET_KEY = secretKey;

        const formatResult = await validator.validateFormat();

        expect(formatResult.secretKeyValid).toBe(false);
        expect(formatResult.validationMessages).toContain('Secret key format invalid');
      }
    });
  });

  describe('Authentication Testing', () => {
    beforeEach(() => {
      process.env.MEXC_API_KEY = 'mx0validApiKeyWithProperFormat123';
      process.env.MEXC_SECRET_KEY = 'a1b2c3d4e5f6789012345678901234567890abcdef12'; // Extended to 42 hex chars
    });

    it('should successfully authenticate with valid credentials', async () => {
      const result = await validator.testAuthentication();

      expect(result.canAuthenticate).toBe(true);
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.authenticationDetails).toMatchObject({
        accountAccessible: true,
        permissions: ['spot'],
        accountType: 'SPOT',
      });

      expect(crypto.createHmac).toHaveBeenCalledWith('sha256', expect.any(String));
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://api.mexc.com/api/v3/account'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-MEXC-APIKEY': 'mx0validApiKeyWithProperFormat123',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle authentication failure correctly', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: vi.fn().mockResolvedValue('{"msg":"Invalid API key"}'),
      } as any);

      const result = await validator.testAuthentication();

      expect(result.canAuthenticate).toBe(false);
      expect(result.error).toContain('Invalid API key');
      expect(result.retry).toBe(false); // Should not retry on auth errors
    });

    it('should handle network errors correctly', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network timeout'));

      const result = await validator.testAuthentication();

      expect(result.canAuthenticate).toBe(false);
      expect(result.error).toContain('Network timeout');
      expect(result.retry).toBe(true); // Should retry on network errors
    });

    it('should handle missing credentials during authentication', async () => {
      delete process.env.MEXC_API_KEY;
      delete process.env.MEXC_SECRET_KEY;

      const result = await validator.testAuthentication();

      expect(result.canAuthenticate).toBe(false);
      expect(result.error).toBe('No credentials available for authentication test');
    });

    it('should create proper HMAC signature', async () => {
      const mockHmac = {
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue('test-signature'),
      };
      vi.mocked(crypto.createHmac).mockReturnValue(mockHmac as any);

      await validator.testAuthentication();

      expect(crypto.createHmac).toHaveBeenCalledWith(
        'sha256',
        'a1b2c3d4e5f6789012345678901234567890abcdef12'
      );
      expect(mockHmac.update).toHaveBeenCalledWith(expect.stringMatching(/^timestamp=\d+$/));
      expect(mockHmac.digest).toHaveBeenCalledWith('hex');
    });

    it('should use custom base URL when configured', async () => {
      process.env.MEXC_BASE_URL = 'https://custom-mexc-api.com';

      await validator.testAuthentication();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://custom-mexc-api.com/api/v3/account'),
        expect.any(Object)
      );
    });

    it('should handle request timeout', async () => {
      vi.mocked(fetch).mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10000))
      );

      const result = await validator.testAuthentication();

      expect(result.canAuthenticate).toBe(false);
      expect(result.error).toContain('Authentication test failed');
    });
  });

  describe('Circuit Breaker Functionality', () => {
    beforeEach(() => {
      process.env.MEXC_API_KEY = 'mx0validApiKeyWithProperFormat123';
      process.env.MEXC_SECRET_KEY = 'a1b2c3d4e5f6789012345678901234567890abcdef12'; // Extended to 42 hex chars
    });

    it('should open circuit breaker after threshold failures', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockResolvedValue('Server Error'),
      } as any);

      // Trigger failures to reach threshold (5 in our test config)
      await validator.testAuthentication();
      await validator.testAuthentication();
      await validator.testAuthentication();
      await validator.testAuthentication();
      await validator.testAuthentication();

      const status = validator.getCircuitBreakerStatus();

      expect(status.isOpen).toBe(true);
      expect(status.failures).toBe(5);
      expect(status.reason).toContain('Too many failures');
      expect(status.nextAttemptTime).toBeInstanceOf(Date);
    });

    it('should prevent requests when circuit breaker is open', async () => {
      // Manually open circuit breaker by triggering failures
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockResolvedValue('Server Error'),
      } as any);

      // Trigger threshold failures (5 to match our config)
      await validator.testAuthentication();
      await validator.testAuthentication();
      await validator.testAuthentication();
      await validator.testAuthentication();
      await validator.testAuthentication();

      // Next request should be blocked
      const result = await validator.testAuthentication();

      expect(result.canAuthenticate).toBe(false);
      expect(result.circuitOpen).toBe(true);
      expect(result.error).toContain('Circuit breaker is open');
    });

    it('should reset circuit breaker after timeout', async () => {
      // Create validator with very short reset timeout for testing
      const shortTimeoutValidator = new EnhancedCredentialValidator({
        circuitBreakerThreshold: 2,
        circuitBreakerResetTimeout: 100, // 100ms
      });

      // Set environment variables for the new validator
      process.env.MEXC_API_KEY = 'mx0validApiKeyWithProperFormat123';
      process.env.MEXC_SECRET_KEY = 'a1b2c3d4e5f6789012345678901234567890abcdef12'; // Extended to 42 hex chars

      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockResolvedValue('Server Error'),
      } as any);

      // Trigger failures to open circuit breaker
      await shortTimeoutValidator.testAuthentication();
      await shortTimeoutValidator.testAuthentication();

      expect(shortTimeoutValidator.getCircuitBreakerStatus().isOpen).toBe(true);

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Mock successful response for reset attempt
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ accountType: 'SPOT' }),
      } as any);

      // Should attempt reset and succeed
      const result = await shortTimeoutValidator.testAuthentication();

      expect(result.canAuthenticate).toBe(true);
      expect(shortTimeoutValidator.getCircuitBreakerStatus().isOpen).toBe(false);
    });

    it('should not retry on authentication errors', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: vi.fn().mockResolvedValue('{"msg":"Invalid signature"}'),
      } as any);

      const result = await validator.testAuthentication();

      expect(result.retry).toBe(false);
    });

    it('should retry on network/server errors', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: vi.fn().mockResolvedValue('Server Error'),
      } as any);

      const result = await validator.testAuthentication();

      expect(result.retry).toBe(true);
    });
  });

  describe('Health Metrics', () => {
    beforeEach(() => {
      process.env.MEXC_API_KEY = 'mx0validApiKeyWithProperFormat123';
      process.env.MEXC_SECRET_KEY = 'a1b2c3d4e5f6789012345678901234567890abcdef12'; // Extended to 42 hex chars
    });

    it('should track successful validations', async () => {
      await validator.validateCredentials();

      const metrics = validator.getHealthMetrics();

      expect(metrics.totalChecks).toBe(1);
      expect(metrics.successfulChecks).toBe(1);
      expect(metrics.failedChecks).toBe(0);
      expect(metrics.successRate).toBe(1);
      expect(metrics.consecutiveFailures).toBe(0);
      expect(metrics.lastSuccessTime).toBeInstanceOf(Date);
      expect(metrics.connectionQuality).toBe('excellent');
    });

    it('should track failed validations', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: vi.fn().mockResolvedValue('Unauthorized'),
      } as any);

      await validator.validateCredentials();

      const metrics = validator.getHealthMetrics();

      expect(metrics.totalChecks).toBe(1);
      expect(metrics.successfulChecks).toBe(0);
      expect(metrics.failedChecks).toBe(1);
      expect(metrics.successRate).toBe(0);
      expect(metrics.consecutiveFailures).toBe(1);
      expect(metrics.lastFailureTime).toBeInstanceOf(Date);
    });

    it('should update connection quality based on metrics', async () => {
      // Test poor quality (consecutive failures)
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        text: vi.fn().mockResolvedValue('Error'),
      } as any);

      await validator.validateCredentials();
      await validator.validateCredentials();
      await validator.validateCredentials();

      let metrics = validator.getHealthMetrics();
      expect(metrics.connectionQuality).toBe('poor');

      // Reset and test excellent quality
      validator.reset();
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ accountType: 'SPOT' }),
      } as any);

      await validator.validateCredentials();

      metrics = validator.getHealthMetrics();
      expect(metrics.connectionQuality).toBe('excellent');
    });

    it('should track average latency', async () => {
      // Mock slow response
      vi.mocked(fetch).mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            status: 200,
            json: vi.fn().mockResolvedValue({ accountType: 'SPOT' }),
          } as any), 100)
        )
      );

      await validator.validateCredentials();

      const metrics = validator.getHealthMetrics();

      expect(metrics.averageLatency).toBeGreaterThan(0);
    });

    it('should reset metrics correctly', () => {
      // First generate some metrics
      validator['updateHealthMetrics'](true);
      validator['updateHealthMetrics'](false);
      validator['recordLatency'](1000);

      let metrics = validator.getHealthMetrics();
      expect(metrics.totalChecks).toBeGreaterThan(0);

      // Reset metrics
      validator.reset();

      metrics = validator.getHealthMetrics();
      expect(metrics.totalChecks).toBe(0);
      expect(metrics.successfulChecks).toBe(0);
      expect(metrics.failedChecks).toBe(0);
      expect(metrics.successRate).toBe(0);
      expect(metrics.averageLatency).toBe(0);
      expect(metrics.consecutiveFailures).toBe(0);
      expect(metrics.connectionQuality).toBe('excellent');

      const circuitStatus = validator.getCircuitBreakerStatus();
      expect(circuitStatus.isOpen).toBe(false);
      expect(circuitStatus.failures).toBe(0);
    });
  });

  describe('Status Change Callbacks', () => {
    beforeEach(() => {
      process.env.MEXC_API_KEY = 'mx0validApiKeyWithProperFormat123';
      process.env.MEXC_SECRET_KEY = 'a1b2c3d4e5f6789012345678901234567890abcdef12'; // Extended to 42 hex chars
    });

    it('should notify callbacks on status changes', async () => {
      const callback = vi.fn();
      validator.onStatusChange(callback);

      await validator.validateCredentials();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          hasCredentials: true,
          isValid: true,
          canAuthenticate: true,
        })
      );
    });

    it('should handle callback errors gracefully', async () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const successCallback = vi.fn();

      validator.onStatusChange(errorCallback);
      validator.onStatusChange(successCallback);

      await validator.validateCredentials();

      expect(errorCallback).toHaveBeenCalled();
      expect(successCallback).toHaveBeenCalled();
      expect(mockConsole.error).toHaveBeenCalledWith(
        'Error in status change callback:',
        expect.any(Error)
      );
    });
  });

  describe('Factory Functions', () => {
    it('should create validator with default configuration', () => {
      const validator = createEnhancedCredentialValidator();

      expect(validator).toBeInstanceOf(EnhancedCredentialValidator);
    });

    it('should create validator with custom configuration', () => {
      const customConfig = {
        circuitBreakerThreshold: 10,
        requestTimeout: 30000,
      };

      const validator = createEnhancedCredentialValidator(customConfig);

      expect(validator).toBeInstanceOf(EnhancedCredentialValidator);
    });

    it('should return global singleton instance', () => {
      const instance1 = getGlobalCredentialValidator();
      const instance2 = getGlobalCredentialValidator();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(EnhancedCredentialValidator);
    });

    it('should reset global instance', () => {
      const instance1 = getGlobalCredentialValidator();
      resetGlobalCredentialValidator();
      const instance2 = getGlobalCredentialValidator();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle validation errors gracefully', async () => {
      // Mock an error during validation
      vi.mocked(fetch).mockRejectedValue(new Error('Unexpected system error'));

      process.env.MEXC_API_KEY = 'mx0validApiKeyWithProperFormat123';
      process.env.MEXC_SECRET_KEY = 'a1b2c3d4e5f6789012345678901234567890abcdef12'; // Extended to 42 hex chars

      const result = await validator.validateCredentials();

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Credential validation failed');
      expect(result.details.formatValidation).toContain('Validation error');
    });

    it('should handle database connection errors during credential retrieval', async () => {
      // Remove environment variables to force database lookup
      delete process.env.MEXC_API_KEY;
      delete process.env.MEXC_SECRET_KEY;

      const result = await validator.validateCredentials();

      expect(result.hasCredentials).toBe(false);
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[enhanced-mexc-credential-validator] Database credential retrieval prepared, using environment fallback'
      );
    });

    it('should handle invalid JSON responses', async () => {
      process.env.MEXC_API_KEY = 'mx0validApiKeyWithProperFormat123';
      process.env.MEXC_SECRET_KEY = 'a1b2c3d4e5f6789012345678901234567890abcdef12'; // Extended to 42 hex chars

      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: vi.fn().mockResolvedValue('Invalid JSON response'),
      } as any);

      const result = await validator.testAuthentication();

      expect(result.canAuthenticate).toBe(false);
      expect(result.error).toBe('Invalid JSON response');
    });

    it('should handle successful requests with invalid JSON', async () => {
      process.env.MEXC_API_KEY = 'mx0validApiKeyWithProperFormat123';
      process.env.MEXC_SECRET_KEY = 'a1b2c3d4e5f6789012345678901234567890abcdef12'; // Extended to 42 hex chars

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as any);

      const result = await validator.testAuthentication();

      expect(result.canAuthenticate).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });

    it('should ensure minimum response time', async () => {
      process.env.MEXC_API_KEY = 'mx0validApiKeyWithProperFormat123';
      process.env.MEXC_SECRET_KEY = 'a1b2c3d4e5f6789012345678901234567890abcdef12'; // Extended to 42 hex chars

      // Mock instant response
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ accountType: 'SPOT' }),
      } as any);

      const result = await validator.testAuthentication();

      expect(result.responseTime).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete successful validation flow', async () => {
      process.env.MEXC_API_KEY = 'mx0productionApiKeyWithRealFormat456';
      process.env.MEXC_SECRET_KEY = 'f1e2d3c4b5a69780123456789abcdef0123456789012'; // Extended to 43 hex chars

      const statusCallback = vi.fn();
      validator.onStatusChange(statusCallback);

      const result = await validator.validateCredentials();

      expect(result).toMatchObject({
        hasCredentials: true,
        isValid: true,
        source: 'environment',
        isTestCredentials: false,
        validFormat: true,
        canAuthenticate: true,
        responseTime: expect.any(Number),
        timestamp: expect.any(String),
        details: {
          apiKeyValid: true,
          secretKeyValid: true,
          formatValidation: ['Credential format valid'],
          authenticationDetails: {
            accountAccessible: true,
            permissions: ['spot'],
            accountType: 'SPOT',
          },
        },
      });

      expect(statusCallback).toHaveBeenCalledWith(result);

      const metrics = validator.getHealthMetrics();
      expect(metrics.successfulChecks).toBe(1);
      expect(metrics.connectionQuality).toBe('excellent');

      const circuitStatus = validator.getCircuitBreakerStatus();
      expect(circuitStatus.isOpen).toBe(false);
    });

    it('should handle complete failure flow with circuit breaker', async () => {
      process.env.MEXC_API_KEY = 'mx0validFormatButInvalidKey789';
      process.env.MEXC_SECRET_KEY = 'ab12cd34ef56789012345678901234567890fedcba12'; // Extended to 42 hex chars

      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: vi.fn().mockResolvedValue('{"msg":"Invalid API credentials"}'),
      } as any);

      // Perform multiple failed validations to trigger circuit breaker (6 to exceed threshold of 5)
      const results = [];
      for (let i = 0; i < 6; i++) {
        results.push(await validator.validateCredentials());
      }

      // All should fail
      results.forEach(result => {
        expect(result.isValid).toBe(false);
      });

      // Circuit breaker should be open after threshold
      const circuitStatus = validator.getCircuitBreakerStatus();
      expect(circuitStatus.isOpen).toBe(true);

      const metrics = validator.getHealthMetrics();
      expect(metrics.failedChecks).toBeGreaterThan(0);
      expect(metrics.connectionQuality).toBe('poor');
    });
  });
});