/**
 * Unit tests for MEXC Configuration Service
 * Tests configuration management, validation, health checks, metrics, and security assessments
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  MexcConfigurationService,
  createMexcConfigurationService,
  getGlobalConfigurationService,
  resetGlobalConfigurationService,
  initializeConfiguration,
  type ServiceConfig,
  type EnvironmentConfig,
  type TradingConfig,
  type AuthConfig,
  type ConfigurationHealth,
  type ConfigurationMetrics,
} from '../../../../src/services/api/mexc-configuration-service';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../../utils/timeout-elimination-helpers';

describe('MEXC Configuration Service', () => {
  let mockConsole: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();

    // Store original environment
    originalEnv = { ...process.env };

    // Reset global state
    resetGlobalConfigurationService();

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

    // Set up test environment variables
    process.env.NODE_ENV = 'test';
    process.env.MEXC_API_KEY = 'test-api-key';
    process.env.MEXC_SECRET_KEY = 'test-secret-key';
    process.env.MEXC_BASE_URL = 'https://api.mexc.com';
    process.env.MEXC_TIMEOUT = '5000';
    process.env.MEXC_MAX_RETRIES = '3';
  });

  afterEach(async () => {
    // TIMEOUT ELIMINATION: Ensure all promises are flushed before cleanup
    await flushPromises();
    vi.restoreAllMocks();
    
    // Restore original environment
    process.env = originalEnv;
    
    resetGlobalConfigurationService();
  
  });

  describe('MexcConfigurationService', () => {
    describe('Constructor', () => {
      it('should initialize with default configuration', () => {
        const service = new MexcConfigurationService();
        
        expect(service).toBeDefined();
        expect(service).toBeInstanceOf(MexcConfigurationService);
        
        const config = service.getConfig();
        expect(config.version).toBe('1.0.0');
        expect(config.environment.NODE_ENV).toBe('test');
        expect(config.environment.MEXC_API_KEY).toBe('test-api-key');
        expect(config.environment.MEXC_SECRET_KEY).toBe('test-secret-key');
      });

      it('should initialize with custom configuration', () => {
        const initialConfig: Partial<ServiceConfig> = {
          version: '2.0.0',
          environment: {
            MEXC_TIMEOUT: 15000,
            MEXC_MAX_RETRIES: 5,
          } as Partial<EnvironmentConfig>,
          trading: {
            maxPositionSize: 2000,
            paperTradingMode: true,
          } as Partial<TradingConfig>,
        };

        const service = new MexcConfigurationService(initialConfig);
        const config = service.getConfig();
        
        expect(config.version).toBe('2.0.0');
        expect(config.environment.MEXC_TIMEOUT).toBe(15000);
        expect(config.environment.MEXC_MAX_RETRIES).toBe(5);
        expect(config.trading.maxPositionSize).toBe(2000);
        expect(config.trading.paperTradingMode).toBe(true);
      });

      it('should handle configuration loading errors gracefully', () => {
        // Temporarily break environment to trigger error handling
        delete process.env.NODE_ENV;
        process.env.MEXC_TIMEOUT = 'invalid-number';

        const service = new MexcConfigurationService();
        
        expect(service).toBeDefined();
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[MexcConfigurationService] Failed to load configuration:',
          expect.any(Error)
        );
      });
    });

    describe('Configuration Access Methods', () => {
      let service: MexcConfigurationService;

      beforeEach(() => {
        service = new MexcConfigurationService();
      });

      it('should get complete configuration', () => {
        const config = service.getConfig();
        
        expect(config).toHaveProperty('environment');
        expect(config).toHaveProperty('trading');
        expect(config).toHaveProperty('authentication');
        expect(config).toHaveProperty('version');
        expect(config).toHaveProperty('lastUpdated');
        expect(config.lastUpdated).toBeInstanceOf(Date);
      });

      it('should get environment configuration', () => {
        const envConfig = service.getEnvironmentConfig();
        
        expect(envConfig.NODE_ENV).toBe('test');
        expect(envConfig.MEXC_API_KEY).toBe('test-api-key');
        expect(envConfig.MEXC_SECRET_KEY).toBe('test-secret-key');
        expect(envConfig.MEXC_BASE_URL).toBe('https://api.mexc.com');
        expect(envConfig.MEXC_TIMEOUT).toBe(5000);
        expect(envConfig.MEXC_MAX_RETRIES).toBe(3);
      });

      it('should get trading configuration', () => {
        const tradingConfig = service.getTradingConfig();
        
        expect(tradingConfig.maxPositionSize).toBe(1000);
        expect(tradingConfig.minOrderValue).toBe(10);
        expect(tradingConfig.defaultTimeInForce).toBe('GTC');
        expect(tradingConfig.enableRiskChecks).toBe(true);
        expect(tradingConfig.paperTradingMode).toBe(false);
      });

      it('should get authentication configuration', () => {
        const authConfig = service.getAuthConfig();
        
        expect(authConfig.enableEncryption).toBe(false);
        expect(authConfig.testIntervalMs).toBe(300000);
        expect(authConfig.maxAuthFailures).toBe(5);
        expect(authConfig.authFailureResetMs).toBe(600000);
      });

      it('should get unified MEXC configuration', () => {
        const unifiedConfig = service.getUnifiedMexcConfig();
        
        expect(unifiedConfig.apiKey).toBe('test-api-key');
        expect(unifiedConfig.secretKey).toBe('test-secret-key');
        expect(unifiedConfig.baseUrl).toBe('https://api.mexc.com');
        expect(unifiedConfig.timeout).toBe(5000);
        expect(unifiedConfig.maxRetries).toBe(3);
        expect(unifiedConfig.enableCaching).toBe(true);
        expect(unifiedConfig.enableRateLimiter).toBe(true);
        expect(unifiedConfig.enablePaperTrading).toBe(false);
        expect(unifiedConfig.enableTestMode).toBe(false);
      });

      it('should return immutable configuration copies', () => {
        const config1 = service.getConfig();
        const config2 = service.getConfig();
        
        expect(config1).not.toBe(config2);
        expect(config1).toEqual(config2);
        
        // Modify returned config should not affect service
        config1.version = 'modified';
        expect(service.getConfig().version).not.toBe('modified');
      });
    });

    describe('Configuration Updates', () => {
      let service: MexcConfigurationService;

      beforeEach(() => {
        service = new MexcConfigurationService();
      });

      it('should update environment configuration successfully', () => {
        const result = service.updateEnvironmentConfig({
          MEXC_TIMEOUT: 8000,
          MEXC_MAX_RETRIES: 5,
          MEXC_ENABLE_CACHING: false,
        });
        
        expect(result.success).toBe(true);
        expect(result.errors).toEqual([]);
        
        const config = service.getEnvironmentConfig();
        expect(config.MEXC_TIMEOUT).toBe(8000);
        expect(config.MEXC_MAX_RETRIES).toBe(5);
        expect(config.MEXC_ENABLE_CACHING).toBe(false);
      });

      it('should reject invalid environment configuration', () => {
        const result = service.updateEnvironmentConfig({
          MEXC_TIMEOUT: -1000, // Invalid: below minimum
          MEXC_MAX_RETRIES: 20, // Invalid: above maximum
        });
        
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some(error => error.includes('MEXC_TIMEOUT'))).toBe(true);
        expect(result.errors.some(error => error.includes('MEXC_MAX_RETRIES'))).toBe(true);
      });

      it('should update trading configuration successfully', () => {
        const result = service.updateTradingConfig({
          maxPositionSize: 2000,
          defaultTimeInForce: 'IOC',
          paperTradingMode: true,
        });
        
        expect(result.success).toBe(true);
        expect(result.errors).toEqual([]);
        
        const config = service.getTradingConfig();
        expect(config.maxPositionSize).toBe(2000);
        expect(config.defaultTimeInForce).toBe('IOC');
        expect(config.paperTradingMode).toBe(true);
      });

      it('should reject invalid trading configuration', () => {
        const result = service.updateTradingConfig({
          maxPositionSize: -100, // Invalid: below minimum
          defaultTimeInForce: 'INVALID' as any, // Invalid enum value
        });
        
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should update authentication configuration successfully', () => {
        const result = service.updateAuthConfig({
          enableEncryption: true,
          maxAuthFailures: 10,
          testIntervalMs: 600000,
        });
        
        expect(result.success).toBe(true);
        expect(result.errors).toEqual([]);
        
        const config = service.getAuthConfig();
        expect(config.enableEncryption).toBe(true);
        expect(config.maxAuthFailures).toBe(10);
        expect(config.testIntervalMs).toBe(600000);
      });

      it('should reject invalid authentication configuration', () => {
        const result = service.updateAuthConfig({
          maxAuthFailures: 0, // Invalid: below minimum
          testIntervalMs: 10000, // Invalid: below minimum
        });
        
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should update credentials successfully', () => {
        const result = service.updateCredentials(
          'new-api-key',
          'new-secret-key',
          'new-passphrase'
        );
        
        expect(result.success).toBe(true);
        
        const config = service.getEnvironmentConfig();
        expect(config.MEXC_API_KEY).toBe('new-api-key');
        expect(config.MEXC_SECRET_KEY).toBe('new-secret-key');
        expect(config.MEXC_PASSPHRASE).toBe('new-passphrase');
      });

      it('should update lastUpdated timestamp on successful updates', () => {
        const originalConfig = service.getConfig();
        const originalTimestamp = originalConfig.lastUpdated.getTime();
        
        // Wait a small amount to ensure timestamp difference
        vi.useFakeTimers();
        vi.advanceTimersByTime(1000);
        
        service.updateEnvironmentConfig({ MEXC_TIMEOUT: 6000 });
        
        const updatedConfig = service.getConfig();
        expect(updatedConfig.lastUpdated.getTime()).toBeGreaterThan(originalTimestamp);
        
        vi.useRealTimers();
      });

      it('should track update metrics', () => {
        const initialMetrics = service.getMetrics();
        
        service.updateEnvironmentConfig({ MEXC_TIMEOUT: 6000 });
        service.updateTradingConfig({ maxPositionSize: 1500 });
        service.updateAuthConfig({ enableEncryption: true });
        
        const updatedMetrics = service.getMetrics();
        expect(updatedMetrics.configUpdates).toBe(initialMetrics.configUpdates + 3);
      });
    });

    describe('Configuration Validation', () => {
      let service: MexcConfigurationService;

      beforeEach(() => {
        service = new MexcConfigurationService();
      });

      it('should validate configuration successfully', () => {
        const result = service.validateConfiguration();
        
        expect(result.success).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
      });

      it('should detect missing required environment variables', () => {
        delete process.env.MEXC_API_KEY;
        delete process.env.MEXC_SECRET_KEY;
        
        const service = new MexcConfigurationService({
          environment: {
            MEXC_API_KEY: '',
            MEXC_SECRET_KEY: '',
          } as Partial<EnvironmentConfig>,
        });
        
        const result = service.validateConfiguration();
        
        expect(result.success).toBe(false);
        expect(result.errors.some(error => error.includes('MEXC_API_KEY'))).toBe(true);
        expect(result.errors.some(error => error.includes('MEXC_SECRET_KEY'))).toBe(true);
      });

      it('should generate warnings for production security issues', () => {
        const service = new MexcConfigurationService({
          environment: {
            NODE_ENV: 'production',
          } as Partial<EnvironmentConfig>,
          authentication: {
            enableEncryption: false,
          },
          trading: {
            paperTradingMode: true,
          },
        });
        
        const result = service.validateConfiguration();
        
        expect(result.warnings.some(warning => 
          warning.includes('Encryption not enabled in production')
        )).toBe(true);
        expect(result.warnings.some(warning => 
          warning.includes('Paper trading mode enabled in production')
        )).toBe(true);
      });

      it('should generate warnings for performance issues', () => {
        const service = new MexcConfigurationService({
          environment: {
            MEXC_TIMEOUT: 35000, // High timeout
            MEXC_CACHE_TTL: 2000, // Low cache TTL
          } as Partial<EnvironmentConfig>,
        });
        
        const result = service.validateConfiguration();
        
        expect(result.warnings.some(warning => 
          warning.includes('API timeout is very high')
        )).toBe(true);
        expect(result.warnings.some(warning => 
          warning.includes('Cache TTL is very low')
        )).toBe(true);
      });

      it('should track validation metrics', () => {
        const initialMetrics = service.getMetrics();
        
        service.validateConfiguration();
        service.validateConfiguration();
        
        const updatedMetrics = service.getMetrics();
        expect(updatedMetrics.validationCount).toBe(initialMetrics.validationCount + 2);
        expect(updatedMetrics.environmentChecks).toBe(initialMetrics.environmentChecks + 2);
      });

      it('should handle validation errors gracefully', () => {
        // Create service with invalid configuration
        const service = new MexcConfigurationService({
          environment: {
            MEXC_TIMEOUT: 'invalid' as any,
          },
        });
        
        const result = service.validateConfiguration();
        
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('Health Check', () => {
      it('should perform comprehensive health check', () => {
        const service = new MexcConfigurationService();
        const health = service.performHealthCheck();
        
        expect(health).toMatchObject({
          isValid: true,
          hasCredentials: true,
          hasRequiredEnvVars: true,
          configVersion: '1.0.0',
          validationErrors: [],
          securityLevel: 'medium',
        });
        
        expect(Array.isArray(health.warnings)).toBe(true);
        expect(Array.isArray(health.recommendations)).toBe(true);
      });

      it('should detect missing credentials', () => {
        const service = new MexcConfigurationService({
          environment: {
            MEXC_API_KEY: '',
            MEXC_SECRET_KEY: '',
          } as Partial<EnvironmentConfig>,
        });
        
        const health = service.performHealthCheck();
        
        expect(health.hasCredentials).toBe(false);
        expect(health.securityLevel).toBe('low');
        expect(health.recommendations).toContain('Configure MEXC API credentials');
      });

      it('should assess security levels correctly', () => {
        // High security: production + encryption + credentials
        const highSecurityService = new MexcConfigurationService({
          environment: {
            NODE_ENV: 'production',
            MEXC_API_KEY: 'test-key',
            MEXC_SECRET_KEY: 'test-secret',
          } as Partial<EnvironmentConfig>,
          authentication: {
            enableEncryption: true,
          },
        });
        
        const highSecurityHealth = highSecurityService.performHealthCheck();
        expect(highSecurityHealth.securityLevel).toBe('high');
        
        // Medium security: production + credentials (no encryption)
        const mediumSecurityService = new MexcConfigurationService({
          environment: {
            NODE_ENV: 'production',
            MEXC_API_KEY: 'test-key',
            MEXC_SECRET_KEY: 'test-secret',
          } as Partial<EnvironmentConfig>,
          authentication: {
            enableEncryption: false,
          },
        });
        
        const mediumSecurityHealth = mediumSecurityService.performHealthCheck();
        expect(mediumSecurityHealth.securityLevel).toBe('medium');
        
        // Low security: production + no credentials
        const lowSecurityService = new MexcConfigurationService({
          environment: {
            NODE_ENV: 'production',
            MEXC_API_KEY: '',
            MEXC_SECRET_KEY: '',
          } as Partial<EnvironmentConfig>,
        });
        
        const lowSecurityHealth = lowSecurityService.performHealthCheck();
        expect(lowSecurityHealth.securityLevel).toBe('low');
      });

      it('should generate appropriate recommendations', () => {
        const service = new MexcConfigurationService({
          environment: {
            MEXC_ENABLE_CACHING: false,
            MEXC_ENABLE_CIRCUIT_BREAKER: false,
          } as Partial<EnvironmentConfig>,
          trading: {
            maxPositionSize: 10000,
          },
        });
        
        const health = service.performHealthCheck();
        
        expect(health.recommendations).toContain('Enable caching for better performance');
        expect(health.recommendations).toContain('Enable circuit breaker for better reliability');
        expect(health.recommendations).toContain(
          'Consider lowering maximum position size for risk management'
        );
      });
    });

    describe('Metrics Management', () => {
      let service: MexcConfigurationService;

      beforeEach(() => {
        service = new MexcConfigurationService();
      });

      it('should get configuration metrics', () => {
        const metrics = service.getMetrics();
        
        expect(metrics).toMatchObject({
          lastValidatedAt: expect.any(Date),
          validationCount: expect.any(Number),
          errorCount: expect.any(Number),
          warningCount: expect.any(Number),
          configUpdates: expect.any(Number),
          environmentChecks: expect.any(Number),
        });
      });

      it('should reset metrics correctly', () => {
        // Generate some metrics
        service.validateConfiguration();
        service.updateEnvironmentConfig({ MEXC_TIMEOUT: 6000 });
        
        const metricsBeforeReset = service.getMetrics();
        expect(metricsBeforeReset.validationCount).toBeGreaterThan(0);
        
        service.resetMetrics();
        
        const metricsAfterReset = service.getMetrics();
        expect(metricsAfterReset.validationCount).toBe(0);
        expect(metricsAfterReset.errorCount).toBe(0);
        expect(metricsAfterReset.warningCount).toBe(0);
        expect(metricsAfterReset.configUpdates).toBe(0);
        expect(metricsAfterReset.environmentChecks).toBe(0);
      });

      it('should track error metrics on validation failures', () => {
        const initialMetrics = service.getMetrics();
        
        // Trigger validation error
        service.updateEnvironmentConfig({
          MEXC_TIMEOUT: -1000, // Invalid value
        });
        
        const updatedMetrics = service.getMetrics();
        expect(updatedMetrics.errorCount).toBe(initialMetrics.errorCount + 1);
      });
    });
  });

  describe('Factory Functions', () => {
    describe('createMexcConfigurationService', () => {
      it('should create new service instance', () => {
        const service = createMexcConfigurationService();
        
        expect(service).toBeInstanceOf(MexcConfigurationService);
      });

      it('should create service with initial configuration', () => {
        const initialConfig: Partial<ServiceConfig> = {
          version: '2.0.0',
          trading: {
            maxPositionSize: 2000,
          } as Partial<TradingConfig>,
        };
        
        const service = createMexcConfigurationService(initialConfig);
        const config = service.getConfig();
        
        expect(config.version).toBe('2.0.0');
        expect(config.trading.maxPositionSize).toBe(2000);
      });

      it('should create independent service instances', () => {
        const service1 = createMexcConfigurationService();
        const service2 = createMexcConfigurationService();
        
        expect(service1).not.toBe(service2);
      });
    });
  });

  describe('Global Service Management', () => {
    describe('getGlobalConfigurationService', () => {
      it('should create global service on first call', () => {
        const service = getGlobalConfigurationService();
        
        expect(service).toBeInstanceOf(MexcConfigurationService);
      });

      it('should return same instance on subsequent calls', () => {
        const service1 = getGlobalConfigurationService();
        const service2 = getGlobalConfigurationService();
        
        expect(service1).toBe(service2);
      });
    });

    describe('resetGlobalConfigurationService', () => {
      it('should reset global service instance', () => {
        const service1 = getGlobalConfigurationService();
        resetGlobalConfigurationService();
        const service2 = getGlobalConfigurationService();
        
        expect(service1).not.toBe(service2);
      });

      it('should handle reset when no global service exists', () => {
        expect(() => resetGlobalConfigurationService()).not.toThrow();
      });
    });

    describe('initializeConfiguration', () => {
      it('should initialize configuration with defaults', async () => {
        const result = await initializeConfiguration();
        
        expect(result.configService).toBeInstanceOf(MexcConfigurationService);
        expect(result.health).toMatchObject({
          isValid: true,
          hasCredentials: true,
        });
        expect(result.isReady).toBe(true);
      });

      it('should initialize configuration with custom config', async () => {
        const initialConfig: Partial<ServiceConfig> = {
          version: '2.0.0',
        };
        
        const result = await initializeConfiguration(initialConfig);
        
        expect(result.configService.getConfig().version).toBe('2.0.0');
        expect(result.isReady).toBe(true);
      });

      it('should handle not ready state', async () => {
        // Remove credentials to make service not ready
        delete process.env.MEXC_API_KEY;
        delete process.env.MEXC_SECRET_KEY;
        
        const result = await initializeConfiguration({
          environment: {
            MEXC_API_KEY: '',
            MEXC_SECRET_KEY: '',
          } as Partial<EnvironmentConfig>,
        });
        
        expect(result.isReady).toBe(false);
        expect(result.health.hasCredentials).toBe(false);
        expect(mockConsole.warn).toHaveBeenCalledWith(
          '[Configuration] Service not ready:',
          expect.objectContaining({
            isValid: expect.any(Boolean),
            hasCredentials: false,
          })
        );
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing environment variables gracefully', () => {
      delete process.env.MEXC_API_KEY;
      delete process.env.MEXC_SECRET_KEY;
      delete process.env.MEXC_BASE_URL;
      
      const service = new MexcConfigurationService();
      
      expect(service).toBeDefined();
      const config = service.getEnvironmentConfig();
      expect(config.MEXC_BASE_URL).toBe('https://api.mexc.com'); // Default value
    });

    it('should handle invalid environment variable types', () => {
      process.env.MEXC_TIMEOUT = 'not-a-number';
      process.env.MEXC_ENABLE_CACHING = 'not-a-boolean';
      
      const service = new MexcConfigurationService();
      
      expect(service).toBeDefined();
      // Should fall back to defaults or handle coercion
    });

    it('should handle null and undefined updates gracefully', () => {
      const service = new MexcConfigurationService();
      
      const result1 = service.updateEnvironmentConfig(null as any);
      const result2 = service.updateTradingConfig(undefined as any);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it('should handle empty configuration objects', () => {
      const service = new MexcConfigurationService({});
      
      expect(service).toBeDefined();
      expect(service.getConfig()).toBeDefined();
    });

    it('should extract validation errors from different error types', () => {
      const service = new MexcConfigurationService();
      
      // Test with invalid data to trigger Zod validation errors
      const result = service.updateEnvironmentConfig({
        NODE_ENV: 'invalid-env' as any,
        MEXC_TIMEOUT: 'invalid-timeout' as any,
      });
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => typeof error === 'string')).toBe(true);
    });
  });

  describe('Integration Scenarios', () => {
    it('should work across multiple configuration updates', () => {
      const service = new MexcConfigurationService();
      
      // Update multiple configurations
      const envResult = service.updateEnvironmentConfig({ MEXC_TIMEOUT: 8000 });
      const tradingResult = service.updateTradingConfig({ maxPositionSize: 2000 });
      const authResult = service.updateAuthConfig({ enableEncryption: true });
      
      expect(envResult.success).toBe(true);
      expect(tradingResult.success).toBe(true);
      expect(authResult.success).toBe(true);
      
      // Verify all changes are applied
      const config = service.getConfig();
      expect(config.environment.MEXC_TIMEOUT).toBe(8000);
      expect(config.trading.maxPositionSize).toBe(2000);
      expect(config.authentication.enableEncryption).toBe(true);
      
      // Verify health check includes all changes
      const health = service.performHealthCheck();
      expect(health.isValid).toBe(true);
    });

    it('should maintain consistency across service instances', () => {
      const globalService = getGlobalConfigurationService();
      globalService.updateEnvironmentConfig({ MEXC_TIMEOUT: 12000 });
      
      const anotherGlobalService = getGlobalConfigurationService();
      
      expect(anotherGlobalService).toBe(globalService);
      expect(anotherGlobalService.getEnvironmentConfig().MEXC_TIMEOUT).toBe(12000);
    });
  });
});