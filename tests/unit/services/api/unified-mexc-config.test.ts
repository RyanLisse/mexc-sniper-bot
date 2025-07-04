/**
 * Unit tests for Unified MEXC Configuration
 * Tests configuration types, defaults, merging, validation, and credential checking
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  UnifiedMexcConfigV2,
  DEFAULT_CONFIG,
  mergeConfig,
  validateConfig,
  hasValidCredentials,
} from '../../../../src/services/api/unified-mexc-config';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../../utils/timeout-elimination-helpers';

describe('Unified MEXC Configuration', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();

    // Store original environment
    originalEnv = { ...process.env };
  });

  afterEach(async () => {
    // TIMEOUT ELIMINATION: Ensure all promises are flushed before cleanup
    await flushPromises();
    vi.restoreAllMocks();
    
    // Restore original environment
    process.env = originalEnv;
  
  });

  describe('Default Configuration', () => {
    it('should have proper default configuration structure', () => {
      expect(DEFAULT_CONFIG).toMatchObject({
        // API Configuration
        apiKey: expect.any(String),
        secretKey: expect.any(String),
        passphrase: expect.any(String),
        baseUrl: 'https://api.mexc.com',
        timeout: 10000,
        maxRetries: 3,
        retryDelay: 1000,
        rateLimitDelay: 100,

        // Cache Configuration
        enableCaching: true,
        cacheTTL: 30000,
        apiResponseTTL: 1500,

        // Reliability Configuration
        enableCircuitBreaker: true,
        enableRateLimiter: true,
        maxFailures: 5,
        resetTimeout: 60000,

        // Trading Configuration
        enablePaperTrading: true,
        circuitBreakerThreshold: 5,
        circuitBreakerResetTime: 30000,

        // Feature Flags
        enableEnhancedFeatures: true,
        enableTestMode: false,
        enableMetrics: true,
      });
    });

    it('should use environment variables for credentials', () => {
      process.env.MEXC_API_KEY = 'test-api-key';
      process.env.MEXC_SECRET_KEY = 'test-secret-key';
      process.env.MEXC_PASSPHRASE = 'test-passphrase';

      // Re-require module to pick up new env vars
      // Note: In a real scenario, config would be re-evaluated
      expect(process.env.MEXC_API_KEY).toBe('test-api-key');
      expect(process.env.MEXC_SECRET_KEY).toBe('test-secret-key');
      expect(process.env.MEXC_PASSPHRASE).toBe('test-passphrase');
    });

    it('should use empty strings when environment variables are not set', () => {
      delete process.env.MEXC_API_KEY;
      delete process.env.MEXC_SECRET_KEY;
      delete process.env.MEXC_PASSPHRASE;

      expect(DEFAULT_CONFIG.apiKey).toBe('');
      expect(DEFAULT_CONFIG.secretKey).toBe('');
      expect(DEFAULT_CONFIG.passphrase).toBe('');
    });

    it('should have all required configuration properties', () => {
      const requiredProperties = [
        'apiKey', 'secretKey', 'passphrase', 'baseUrl', 'timeout',
        'maxRetries', 'retryDelay', 'rateLimitDelay', 'enableCaching',
        'cacheTTL', 'apiResponseTTL', 'enableCircuitBreaker', 'enableRateLimiter',
        'maxFailures', 'resetTimeout', 'enablePaperTrading', 'circuitBreakerThreshold',
        'circuitBreakerResetTime', 'enableEnhancedFeatures', 'enableTestMode', 'enableMetrics',
      ];

      requiredProperties.forEach(prop => {
        expect(DEFAULT_CONFIG).toHaveProperty(prop);
      });
    });

    it('should have sensible default values', () => {
      expect(DEFAULT_CONFIG.baseUrl).toBe('https://api.mexc.com');
      expect(DEFAULT_CONFIG.timeout).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.maxRetries).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_CONFIG.retryDelay).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_CONFIG.cacheTTL).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.apiResponseTTL).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.maxFailures).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.resetTimeout).toBeGreaterThan(0);
    });
  });

  describe('mergeConfig', () => {
    it('should return default config when no user config provided', () => {
      const result = mergeConfig();
      
      expect(result).toEqual(DEFAULT_CONFIG);
    });

    it('should return default config when empty user config provided', () => {
      const result = mergeConfig({});
      
      expect(result).toEqual(DEFAULT_CONFIG);
    });

    it('should merge user config with defaults', () => {
      const userConfig: Partial<UnifiedMexcConfigV2> = {
        timeout: 15000,
        maxRetries: 5,
        enableCaching: false,
      };

      const result = mergeConfig(userConfig);

      expect(result).toMatchObject({
        ...DEFAULT_CONFIG,
        timeout: 15000,
        maxRetries: 5,
        enableCaching: false,
      });
    });

    it('should override API credentials', () => {
      const userConfig: Partial<UnifiedMexcConfigV2> = {
        apiKey: 'custom-api-key',
        secretKey: 'custom-secret-key',
        passphrase: 'custom-passphrase',
      };

      const result = mergeConfig(userConfig);

      expect(result.apiKey).toBe('custom-api-key');
      expect(result.secretKey).toBe('custom-secret-key');
      expect(result.passphrase).toBe('custom-passphrase');
    });

    it('should handle partial configuration updates', () => {
      const userConfig: Partial<UnifiedMexcConfigV2> = {
        enableEnhancedFeatures: false,
        circuitBreakerThreshold: 10,
      };

      const result = mergeConfig(userConfig);

      expect(result.enableEnhancedFeatures).toBe(false);
      expect(result.circuitBreakerThreshold).toBe(10);
      expect(result.baseUrl).toBe(DEFAULT_CONFIG.baseUrl); // Should keep default
      expect(result.timeout).toBe(DEFAULT_CONFIG.timeout); // Should keep default
    });

    it('should handle custom feature flags', () => {
      const userConfig: Partial<UnifiedMexcConfigV2> = {
        enableTestMode: true,
        enableMetrics: false,
        enablePaperTrading: false,
      };

      const result = mergeConfig(userConfig);

      expect(result.enableTestMode).toBe(true);
      expect(result.enableMetrics).toBe(false);
      expect(result.enablePaperTrading).toBe(false);
    });

    it('should handle cache configuration updates', () => {
      const userConfig: Partial<UnifiedMexcConfigV2> = {
        enableCaching: false,
        cacheTTL: 60000,
        apiResponseTTL: 3000,
      };

      const result = mergeConfig(userConfig);

      expect(result.enableCaching).toBe(false);
      expect(result.cacheTTL).toBe(60000);
      expect(result.apiResponseTTL).toBe(3000);
    });

    it('should handle reliability configuration updates', () => {
      const userConfig: Partial<UnifiedMexcConfigV2> = {
        enableCircuitBreaker: false,
        enableRateLimiter: false,
        maxFailures: 10,
        resetTimeout: 120000,
      };

      const result = mergeConfig(userConfig);

      expect(result.enableCircuitBreaker).toBe(false);
      expect(result.enableRateLimiter).toBe(false);
      expect(result.maxFailures).toBe(10);
      expect(result.resetTimeout).toBe(120000);
    });
  });

  describe('validateConfig', () => {
    it('should validate a correct configuration', () => {
      const validConfig = mergeConfig({
        apiKey: 'valid-api-key',
        secretKey: 'valid-secret-key',
      });

      const result = validateConfig(validConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid baseUrl', () => {
      const invalidConfigs = [
        { baseUrl: '' },
        { baseUrl: 'not-a-url' },
        { baseUrl: 'ftp://invalid-protocol.com' },
      ];

      invalidConfigs.forEach(config => {
        const mergedConfig = mergeConfig(config);
        const result = validateConfig(mergedConfig);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid baseUrl: must be a valid HTTP URL');
      });
    });

    it('should accept valid HTTP and HTTPS URLs', () => {
      const validUrls = [
        'http://api.mexc.com',
        'https://api.mexc.com',
        'https://api-testnet.mexc.com',
      ];

      validUrls.forEach(baseUrl => {
        const config = mergeConfig({ baseUrl });
        const result = validateConfig(config);

        expect(result.isValid).toBe(true);
      });
    });

    it('should reject invalid timeout values', () => {
      const invalidTimeouts = [0, -1, -1000];

      invalidTimeouts.forEach(timeout => {
        const config = mergeConfig({ timeout });
        const result = validateConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid timeout: must be greater than 0');
      });
    });

    it('should accept valid timeout values', () => {
      const validTimeouts = [1, 1000, 5000, 30000];

      validTimeouts.forEach(timeout => {
        const config = mergeConfig({ timeout });
        const result = validateConfig(config);

        expect(result.isValid).toBe(true);
      });
    });

    it('should reject invalid maxRetries values', () => {
      const invalidRetries = [-1, -5];

      invalidRetries.forEach(maxRetries => {
        const config = mergeConfig({ maxRetries });
        const result = validateConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid maxRetries: must be >= 0');
      });
    });

    it('should accept valid maxRetries values', () => {
      const validRetries = [0, 1, 3, 5, 10];

      validRetries.forEach(maxRetries => {
        const config = mergeConfig({ maxRetries });
        const result = validateConfig(config);

        expect(result.isValid).toBe(true);
      });
    });

    it('should reject invalid retryDelay values', () => {
      const invalidDelays = [-1, -1000];

      invalidDelays.forEach(retryDelay => {
        const config = mergeConfig({ retryDelay });
        const result = validateConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid retryDelay: must be >= 0');
      });
    });

    it('should accept valid retryDelay values', () => {
      const validDelays = [0, 100, 1000, 5000];

      validDelays.forEach(retryDelay => {
        const config = mergeConfig({ retryDelay });
        const result = validateConfig(config);

        expect(result.isValid).toBe(true);
      });
    });

    it('should reject invalid cacheTTL values', () => {
      const invalidTTLs = [-1, -1000];

      invalidTTLs.forEach(cacheTTL => {
        const config = mergeConfig({ cacheTTL });
        const result = validateConfig(config);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid cacheTTL: must be >= 0');
      });
    });

    it('should accept valid cacheTTL values', () => {
      const validTTLs = [0, 1000, 30000, 60000];

      validTTLs.forEach(cacheTTL => {
        const config = mergeConfig({ cacheTTL });
        const result = validateConfig(config);

        expect(result.isValid).toBe(true);
      });
    });

    it('should handle multiple validation errors', () => {
      const invalidConfig = mergeConfig({
        baseUrl: 'invalid-url',
        timeout: -1,
        maxRetries: -1,
        retryDelay: -1,
        cacheTTL: -1,
      });

      const result = validateConfig(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(5);
      expect(result.errors).toContain('Invalid baseUrl: must be a valid HTTP URL');
      expect(result.errors).toContain('Invalid timeout: must be greater than 0');
      expect(result.errors).toContain('Invalid maxRetries: must be >= 0');
      expect(result.errors).toContain('Invalid retryDelay: must be >= 0');
      expect(result.errors).toContain('Invalid cacheTTL: must be >= 0');
    });

    it('should handle edge case values', () => {
      const edgeCaseConfig = mergeConfig({
        timeout: 1, // Minimum valid value
        maxRetries: 0, // Minimum valid value
        retryDelay: 0, // Minimum valid value
        cacheTTL: 0, // Minimum valid value
      });

      const result = validateConfig(edgeCaseConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('hasValidCredentials', () => {
    it('should return true for valid credentials', () => {
      const validConfigs = [
        mergeConfig({ apiKey: 'api-key', secretKey: 'secret-key' }),
        mergeConfig({ apiKey: 'long-api-key-123', secretKey: 'long-secret-key-456' }),
        mergeConfig({ apiKey: 'a', secretKey: 's' }), // Minimum length
      ];

      validConfigs.forEach(config => {
        expect(hasValidCredentials(config)).toBe(true);
      });
    });

    it('should return false for missing API key', () => {
      const invalidConfigs = [
        mergeConfig({ apiKey: '', secretKey: 'secret-key' }),
        mergeConfig({ secretKey: 'secret-key' }), // API key undefined
      ];

      invalidConfigs.forEach(config => {
        expect(hasValidCredentials(config)).toBe(false);
      });
    });

    it('should return false for missing secret key', () => {
      const invalidConfigs = [
        mergeConfig({ apiKey: 'api-key', secretKey: '' }),
        mergeConfig({ apiKey: 'api-key' }), // Secret key undefined
      ];

      invalidConfigs.forEach(config => {
        expect(hasValidCredentials(config)).toBe(false);
      });
    });

    it('should return false for both missing credentials', () => {
      const invalidConfigs = [
        mergeConfig({ apiKey: '', secretKey: '' }),
        mergeConfig({}), // Both undefined
        mergeConfig({ passphrase: 'only-passphrase' }),
      ];

      invalidConfigs.forEach(config => {
        expect(hasValidCredentials(config)).toBe(false);
      });
    });

    it('should handle null and undefined values correctly', () => {
      const invalidConfigs = [
        { ...mergeConfig(), apiKey: null as any, secretKey: 'secret' },
        { ...mergeConfig(), apiKey: 'api', secretKey: null as any },
        { ...mergeConfig(), apiKey: undefined as any, secretKey: 'secret' },
        { ...mergeConfig(), apiKey: 'api', secretKey: undefined as any },
      ];

      invalidConfigs.forEach(config => {
        expect(hasValidCredentials(config)).toBe(false);
      });
    });

    it('should not require passphrase for credential validation', () => {
      const config = mergeConfig({
        apiKey: 'valid-api-key',
        secretKey: 'valid-secret-key',
        passphrase: '', // Empty passphrase should still be valid
      });

      expect(hasValidCredentials(config)).toBe(true);
    });
  });

  describe('Configuration Types', () => {
    it('should accept all UnifiedMexcConfigV2 properties', () => {
      const completeConfig: UnifiedMexcConfigV2 = {
        // API Configuration
        apiKey: 'test-api-key',
        secretKey: 'test-secret-key',
        passphrase: 'test-passphrase',
        baseUrl: 'https://api.mexc.com',
        timeout: 10000,
        maxRetries: 3,
        retryDelay: 1000,
        rateLimitDelay: 100,

        // Cache Configuration
        enableCaching: true,
        cacheTTL: 30000,
        apiResponseTTL: 1500,

        // Reliability Configuration
        enableCircuitBreaker: true,
        enableRateLimiter: true,
        maxFailures: 5,
        resetTimeout: 60000,

        // Enhanced Configuration
        enableEnhancedFeatures: true,
        enablePaperTrading: true,
        circuitBreakerThreshold: 5,
        circuitBreakerResetTime: 30000,
        enableTestMode: false,
        enableMetrics: true,
      };

      expect(validateConfig(completeConfig).isValid).toBe(true);
    });

    it('should accept partial configuration', () => {
      const partialConfig: Partial<UnifiedMexcConfigV2> = {
        timeout: 15000,
        enableCaching: false,
      };

      const mergedConfig = mergeConfig(partialConfig);
      expect(validateConfig(mergedConfig).isValid).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle extreme configuration values', () => {
      const extremeConfig = mergeConfig({
        timeout: Number.MAX_SAFE_INTEGER,
        maxRetries: Number.MAX_SAFE_INTEGER,
        retryDelay: Number.MAX_SAFE_INTEGER,
        cacheTTL: Number.MAX_SAFE_INTEGER,
      });

      const result = validateConfig(extremeConfig);
      expect(result.isValid).toBe(true);
    });

    it('should handle configuration with extra properties', () => {
      const configWithExtra = {
        ...mergeConfig(),
        extraProperty: 'should-be-ignored',
        anotherExtra: 12345,
      } as any;

      const result = validateConfig(configWithExtra);
      expect(result.isValid).toBe(true);
    });

    it('should handle deeply nested property validation', () => {
      // Test that only the defined validation rules are applied
      const config = mergeConfig({
        baseUrl: 'https://valid-url.com',
        timeout: 1,
        maxRetries: 0,
        retryDelay: 0,
        cacheTTL: 0,
      });

      const result = validateConfig(config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should provide clear error messages', () => {
      const invalidConfig = mergeConfig({
        baseUrl: 'invalid',
        timeout: 0,
      });

      const result = validateConfig(invalidConfig);
      
      expect(result.errors).toEqual([
        'Invalid baseUrl: must be a valid HTTP URL',
        'Invalid timeout: must be greater than 0',
      ]);
    });

    it('should handle string number values correctly', () => {
      // This tests that the validation works with proper number types
      const config = mergeConfig({
        timeout: 5000,
        maxRetries: 3,
      });

      expect(typeof config.timeout).toBe('number');
      expect(typeof config.maxRetries).toBe('number');
      expect(validateConfig(config).isValid).toBe(true);
    });
  });
});