/**
 * Unit tests for MEXC Client Factory
 * Tests client creation, factory patterns, builder pattern, singleton management, and specialized clients
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  UnifiedMexcClient,
  getUnifiedMexcClient,
  resetUnifiedMexcClient,
  createMexcClient,
  createMexcClientWithCredentials,
  MexcClientBuilder,
  createMexcClientBuilder,
  createTradingClient,
  createDataClient,
  createMonitoringClient,
} from '../../../../src/services/api/mexc-client-factory';
import type { UnifiedMexcConfig } from '../../../../src/services/api/mexc-client-types';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../../utils/timeout-elimination-helpers';

// Mock dependencies
vi.mock('../../../../src/services/api/mexc-trading-api', () => ({
  MexcTradingApiClient: class MockMexcTradingApiClient {
    config: any;
    cache: any;
    
    constructor(config: any = {}) {
      this.config = {
        baseUrl: 'https://api.mexc.com',
        timeout: 5000,
        maxRetries: 3,
        retryDelay: 1000,
        rateLimitDelay: 100,
        enableCaching: true,
        cacheTTL: 60000,
        ...config,
      };
      
      this.cache = {
        clear: vi.fn(),
        getStats: vi.fn(() => ({
          size: 10,
          maxSize: 100,
          hitRate: 0.75,
          missRate: 0.25,
        })),
      };
    }
    
    clearExchangeCache = vi.fn();
    getCachedSymbolsCount = vi.fn(() => 50);
    isExchangeCacheValid = vi.fn(() => true);
    hasCredentials = vi.fn(() => true);
    testConnectivity = vi.fn(() => Promise.resolve({ success: true }));
    getAccountInfo = vi.fn(() => Promise.resolve({ success: true }));
    canTrade = vi.fn(() => Promise.resolve(true));
    getAccountType = vi.fn(() => Promise.resolve('SPOT'));
    getCacheStats = vi.fn(() => ({
      size: 10,
      maxSize: 100,
      hitRate: 0.75,
      missRate: 0.25,
    }));
  },
}));

describe('MEXC Client Factory', () => {
  let mockConsole: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset global state
    resetUnifiedMexcClient();

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
  });

  afterEach(async () => {
    // TIMEOUT ELIMINATION: Ensure all promises are flushed before cleanup
    await flushPromises();
    vi.restoreAllMocks();
    resetUnifiedMexcClient();
  
  });

  describe('UnifiedMexcClient', () => {
    describe('Constructor', () => {
      it('should create client with default configuration', () => {
        const client = new UnifiedMexcClient();
        
        expect(client).toBeDefined();
        expect(client).toBeInstanceOf(UnifiedMexcClient);
        expect(mockConsole.info).toHaveBeenCalledWith(
          '[UnifiedMexcClient] Initialized with modular architecture'
        );
      });

      it('should create client with custom configuration', () => {
        const config: UnifiedMexcConfig = {
          apiKey: 'test-api-key',
          secretKey: 'test-secret-key',
          baseUrl: 'https://custom.api.com',
          timeout: 10000,
        };

        const client = new UnifiedMexcClient(config);
        
        expect(client).toBeDefined();
        expect(client.config.apiKey).toBe('test-api-key');
        expect(client.config.baseUrl).toBe('https://custom.api.com');
        expect(client.config.timeout).toBe(10000);
      });
    });

    describe('Logger functionality', () => {
      it('should create logger on first access', () => {
        const client = new UnifiedMexcClient();
        const logger = (client as any).getLogger();
        
        expect(logger).toBeDefined();
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.warn).toBe('function');
        expect(typeof logger.error).toBe('function');
        expect(typeof logger.debug).toBe('function');
      });

      it('should reuse logger instance on subsequent calls', () => {
        const client = new UnifiedMexcClient();
        const logger1 = (client as any).getLogger();
        const logger2 = (client as any).getLogger();
        
        expect(logger1).toBe(logger2);
      });

      it('should log messages with correct format', () => {
        const client = new UnifiedMexcClient();
        const logger = (client as any).getLogger();
        
        logger.info('Test message', { key: 'value' });
        logger.warn('Warning message');
        logger.error('Error message', null, new Error('Test error'));
        logger.debug('Debug message');
        
        expect(mockConsole.info).toHaveBeenCalledWith(
          '[mexc-client-factory]',
          'Test message',
          { key: 'value' }
        );
        expect(mockConsole.warn).toHaveBeenCalledWith(
          '[mexc-client-factory]',
          'Warning message',
          ''
        );
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[mexc-client-factory]',
          'Error message',
          '',
          expect.any(Error)
        );
        expect(mockConsole.debug).toHaveBeenCalledWith(
          '[mexc-client-factory]',
          'Debug message',
          ''
        );
      });
    });

    describe('Cache Management', () => {
      it('should clear all caches', () => {
        const client = new UnifiedMexcClient();
        
        client.clearCache();
        
        expect(client.cache.clear).toHaveBeenCalled();
        expect(client.clearExchangeCache).toHaveBeenCalled();
        expect(mockConsole.info).toHaveBeenCalledWith(
          '[UnifiedMexcClient] All caches cleared'
        );
      });

      it('should get cache statistics', () => {
        const client = new UnifiedMexcClient();
        
        const stats = client.getCacheStats();
        
        expect(stats).toEqual({
          size: 10,
          maxSize: 100,
          hitRate: 0.75,
          missRate: 0.25,
        });
      });

      it('should get extended cache statistics', () => {
        const client = new UnifiedMexcClient();
        
        const extendedStats = client.getExtendedCacheStats();
        
        expect(extendedStats).toEqual({
          requestCache: {
            size: 10,
            maxSize: 100,
            hitRate: 0.75,
            missRate: 0.25,
          },
          exchangeSymbolsCount: 50,
          exchangeCacheValid: true,
        });
      });
    });

    describe('Configuration Management', () => {
      it('should get safe configuration without sensitive data', () => {
        const client = new UnifiedMexcClient({
          apiKey: 'secret-api-key',
          secretKey: 'secret-secret-key',
          baseUrl: 'https://api.mexc.com',
          timeout: 5000,
        });
        
        const safeConfig = client.getConfig();
        
        expect(safeConfig).not.toHaveProperty('apiKey');
        expect(safeConfig).not.toHaveProperty('secretKey');
        expect(safeConfig.baseUrl).toBe('https://api.mexc.com');
        expect(safeConfig.timeout).toBe(5000);
      });

      it('should update configuration', () => {
        const client = new UnifiedMexcClient({ timeout: 5000 });
        
        client.updateConfig({ timeout: 10000, maxRetries: 5 });
        
        expect(client.config.timeout).toBe(10000);
        expect(client.config.maxRetries).toBe(5);
        expect(mockConsole.info).toHaveBeenCalledWith(
          '[UnifiedMexcClient] Configuration updated'
        );
      });
    });

    describe('Health Check', () => {
      it('should perform comprehensive health check successfully', async () => {
        const client = new UnifiedMexcClient();
        
        const health = await client.healthCheck();
        
        expect(health).toEqual({
          connectivity: true,
          authentication: true,
          permissions: { canTrade: true, accountType: 'SPOT' },
          performance: {
            cacheHitRate: 0.75,
            lastRequestTime: expect.any(Number),
          },
        });
      });

      it('should handle connectivity failure in health check', async () => {
        const client = new UnifiedMexcClient();
        client.testConnectivity = vi.fn(() => Promise.resolve({ success: false }));
        
        const health = await client.healthCheck();
        
        expect(health.connectivity).toBe(false);
      });

      it('should handle missing credentials in health check', async () => {
        const client = new UnifiedMexcClient();
        client.hasCredentials = vi.fn(() => false);
        
        const health = await client.healthCheck();
        
        expect(health.authentication).toBe(false);
        expect(health.permissions.canTrade).toBe(false);
        expect(health.permissions.accountType).toBe('UNKNOWN');
      });

      it('should handle authentication failure in health check', async () => {
        const client = new UnifiedMexcClient();
        client.getAccountInfo = vi.fn(() => Promise.reject(new Error('Auth failed')));
        
        const health = await client.healthCheck();
        
        expect(health.authentication).toBe(false);
      });

      it('should handle complete health check failure', async () => {
        const client = new UnifiedMexcClient();
        client.testConnectivity = vi.fn(() => Promise.reject(new Error('Network error')));
        
        const health = await client.healthCheck();
        
        expect(health).toEqual({
          connectivity: false,
          authentication: false,
          permissions: { canTrade: false, accountType: 'UNKNOWN' },
          performance: { cacheHitRate: 0, lastRequestTime: 0 },
        });
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[UnifiedMexcClient] Health check failed:',
          expect.any(Error)
        );
      });
    });

    describe('Status Reporting', () => {
      it('should get client status', () => {
        const client = new UnifiedMexcClient();
        
        const status = client.getStatus();
        
        expect(status).toEqual({
          initialized: true,
          hasCredentials: true,
          cacheEnabled: true,
          totalCacheSize: 10,
          version: '2.0.0-modular',
        });
      });

      it('should reflect configuration in status', () => {
        const client = new UnifiedMexcClient({ enableCaching: false });
        client.hasCredentials = vi.fn(() => false);
        
        const status = client.getStatus();
        
        expect(status.hasCredentials).toBe(false);
        expect(status.cacheEnabled).toBe(false);
      });
    });
  });

  describe('Global Client Management', () => {
    describe('getUnifiedMexcClient', () => {
      it('should create global client on first call', () => {
        const client = getUnifiedMexcClient();
        
        expect(client).toBeDefined();
        expect(client).toBeInstanceOf(UnifiedMexcClient);
      });

      it('should return same instance on subsequent calls', () => {
        const client1 = getUnifiedMexcClient();
        const client2 = getUnifiedMexcClient();
        
        expect(client1).toBe(client2);
      });

      it('should update configuration on existing instance', () => {
        const client1 = getUnifiedMexcClient({ timeout: 5000 });
        const client2 = getUnifiedMexcClient({ timeout: 10000 });
        
        expect(client1).toBe(client2);
        expect(client1.config.timeout).toBe(10000);
      });

      it('should use provided configuration for new instance', () => {
        const config: UnifiedMexcConfig = {
          apiKey: 'test-key',
          baseUrl: 'https://custom.api.com',
        };
        
        const client = getUnifiedMexcClient(config);
        
        expect(client.config.apiKey).toBe('test-key');
        expect(client.config.baseUrl).toBe('https://custom.api.com');
      });
    });

    describe('resetUnifiedMexcClient', () => {
      it('should reset global client instance', () => {
        const client1 = getUnifiedMexcClient();
        resetUnifiedMexcClient();
        const client2 = getUnifiedMexcClient();
        
        expect(client1).not.toBe(client2);
      });

      it('should clear cache before reset', () => {
        const client = getUnifiedMexcClient();
        const clearCacheSpy = vi.spyOn(client, 'clearCache');
        
        resetUnifiedMexcClient();
        
        expect(clearCacheSpy).toHaveBeenCalled();
      });

      it('should handle reset when no global client exists', () => {
        expect(() => resetUnifiedMexcClient()).not.toThrow();
      });
    });
  });

  describe('Factory Functions', () => {
    describe('createMexcClient', () => {
      it('should create new client instance', () => {
        const config: UnifiedMexcConfig = {
          apiKey: 'test-key',
          secretKey: 'test-secret',
        };
        
        const client = createMexcClient(config);
        
        expect(client).toBeInstanceOf(UnifiedMexcClient);
        expect(client.config.apiKey).toBe('test-key');
        expect(client.config.secretKey).toBe('test-secret');
      });

      it('should create independent instances', () => {
        const config: UnifiedMexcConfig = { timeout: 5000 };
        
        const client1 = createMexcClient(config);
        const client2 = createMexcClient(config);
        
        expect(client1).not.toBe(client2);
      });
    });

    describe('createMexcClientWithCredentials', () => {
      it('should create client with credentials', () => {
        const client = createMexcClientWithCredentials('api-key', 'secret-key');
        
        expect(client.config.apiKey).toBe('api-key');
        expect(client.config.secretKey).toBe('secret-key');
      });

      it('should merge additional configuration', () => {
        const client = createMexcClientWithCredentials('api-key', 'secret-key', {
          baseUrl: 'https://custom.api.com',
          timeout: 10000,
        });
        
        expect(client.config.apiKey).toBe('api-key');
        expect(client.config.secretKey).toBe('secret-key');
        expect(client.config.baseUrl).toBe('https://custom.api.com');
        expect(client.config.timeout).toBe(10000);
      });
    });
  });

  describe('Builder Pattern', () => {
    describe('MexcClientBuilder', () => {
      it('should build client with fluent interface', () => {
        const client = new MexcClientBuilder()
          .apiKey('test-api-key')
          .secretKey('test-secret-key')
          .baseUrl('https://custom.api.com')
          .timeout(10000)
          .retries(5)
          .caching(true, 120000)
          .rateLimit(200)
          .build();
        
        expect(client.config.apiKey).toBe('test-api-key');
        expect(client.config.secretKey).toBe('test-secret-key');
        expect(client.config.baseUrl).toBe('https://custom.api.com');
        expect(client.config.timeout).toBe(10000);
        expect(client.config.maxRetries).toBe(5);
        expect(client.config.enableCaching).toBe(true);
        expect(client.config.cacheTTL).toBe(120000);
        expect(client.config.rateLimitDelay).toBe(200);
      });

      it('should support method chaining', () => {
        const builder = new MexcClientBuilder();
        
        const result1 = builder.apiKey('test-key');
        const result2 = result1.secretKey('test-secret');
        const result3 = result2.timeout(5000);
        
        expect(result1).toBe(builder);
        expect(result2).toBe(builder);
        expect(result3).toBe(builder);
      });

      it('should build global client', () => {
        const client = new MexcClientBuilder()
          .apiKey('global-key')
          .buildGlobal();
        
        const globalClient = getUnifiedMexcClient();
        
        expect(client).toBe(globalClient);
        expect(client.config.apiKey).toBe('global-key');
      });

      it('should handle caching configuration without TTL', () => {
        const client = new MexcClientBuilder()
          .caching(false)
          .build();
        
        expect(client.config.enableCaching).toBe(false);
      });
    });

    describe('createMexcClientBuilder', () => {
      it('should create new builder instance', () => {
        const builder = createMexcClientBuilder();
        
        expect(builder).toBeInstanceOf(MexcClientBuilder);
      });

      it('should create independent builders', () => {
        const builder1 = createMexcClientBuilder();
        const builder2 = createMexcClientBuilder();
        
        expect(builder1).not.toBe(builder2);
      });
    });
  });

  describe('Specialized Client Creation', () => {
    describe('createTradingClient', () => {
      it('should create client optimized for trading', () => {
        const client = createTradingClient('api-key', 'secret-key');
        
        expect(client.config.apiKey).toBe('api-key');
        expect(client.config.secretKey).toBe('secret-key');
        expect(client.config.enableCaching).toBe(false);
        expect(client.config.rateLimitDelay).toBe(50);
        expect(client.config.maxRetries).toBe(1);
        expect(client.config.timeout).toBe(5000);
      });
    });

    describe('createDataClient', () => {
      it('should create client optimized for data retrieval', () => {
        const client = createDataClient();
        
        expect(client.config.enableCaching).toBe(true);
        expect(client.config.cacheTTL).toBe(300000);
        expect(client.config.rateLimitDelay).toBe(200);
        expect(client.config.maxRetries).toBe(3);
        expect(client.config.timeout).toBe(15000);
      });
    });

    describe('createMonitoringClient', () => {
      it('should create client optimized for monitoring', () => {
        const client = createMonitoringClient();
        
        expect(client.config.enableCaching).toBe(true);
        expect(client.config.cacheTTL).toBe(60000);
        expect(client.config.rateLimitDelay).toBe(100);
        expect(client.config.maxRetries).toBe(2);
        expect(client.config.timeout).toBe(10000);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty configuration gracefully', () => {
      const client = new UnifiedMexcClient({});
      
      expect(client).toBeDefined();
      expect(client.getStatus().initialized).toBe(true);
    });

    it('should handle null configuration gracefully', () => {
      const client = new UnifiedMexcClient(null as any);
      
      expect(client).toBeDefined();
    });

    it('should handle undefined configuration gracefully', () => {
      const client = new UnifiedMexcClient(undefined);
      
      expect(client).toBeDefined();
    });

    it('should preserve existing configuration when updating with empty object', () => {
      const client = new UnifiedMexcClient({ timeout: 5000 });
      client.updateConfig({});
      
      expect(client.config.timeout).toBe(5000);
    });

    it('should handle builder with no configuration', () => {
      const client = new MexcClientBuilder().build();
      
      expect(client).toBeInstanceOf(UnifiedMexcClient);
    });

    it('should handle health check with boolean connectivity response', async () => {
      const client = new UnifiedMexcClient();
      client.testConnectivity = vi.fn(() => Promise.resolve(true));
      
      const health = await client.healthCheck();
      
      expect(health.connectivity).toBe(true);
    });

    it('should handle account info returning unsuccessful response', async () => {
      const client = new UnifiedMexcClient();
      client.getAccountInfo = vi.fn(() => Promise.resolve({ success: false }));
      
      const health = await client.healthCheck();
      
      expect(health.authentication).toBe(false);
    });
  });

  describe('Integration Scenarios', () => {
    it('should work with multiple global client reconfigurations', () => {
      const client1 = getUnifiedMexcClient({ timeout: 5000 });
      const client2 = getUnifiedMexcClient({ maxRetries: 5 });
      const client3 = getUnifiedMexcClient({ enableCaching: false });
      
      expect(client1).toBe(client2);
      expect(client2).toBe(client3);
      expect(client1.config.timeout).toBe(5000);
      expect(client1.config.maxRetries).toBe(5);
      expect(client1.config.enableCaching).toBe(false);
    });

    it('should maintain independence between regular and global clients', () => {
      const regularClient = createMexcClient({ timeout: 5000 });
      const globalClient = getUnifiedMexcClient({ timeout: 10000 });
      
      expect(regularClient).not.toBe(globalClient);
      expect(regularClient.config.timeout).toBe(5000);
      expect(globalClient.config.timeout).toBe(10000);
    });

    it('should allow multiple specialized clients with different configurations', () => {
      const tradingClient = createTradingClient('key1', 'secret1');
      const dataClient = createDataClient();
      const monitoringClient = createMonitoringClient();
      
      expect(tradingClient.config.enableCaching).toBe(false);
      expect(dataClient.config.enableCaching).toBe(true);
      expect(monitoringClient.config.enableCaching).toBe(true);
      
      expect(tradingClient.config.timeout).toBe(5000);
      expect(dataClient.config.timeout).toBe(15000);
      expect(monitoringClient.config.timeout).toBe(10000);
    });
  });
});