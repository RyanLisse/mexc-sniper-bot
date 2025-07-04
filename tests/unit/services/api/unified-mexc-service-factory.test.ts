/**
 * Unit tests for Unified MEXC Service Factory
 * Tests service creation, credential resolution, caching, database integration, and status synchronization
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  UnifiedMexcServiceFactory,
  getGlobalMexcServiceFactory,
  resetGlobalMexcServiceFactory,
  getUnifiedMexcService,
  invalidateUserCredentialsCache,
  clearMexcServiceCaches,
  triggerCredentialStatusUpdate,
} from '../../../../src/services/api/unified-mexc-service-factory';

// Mock dependencies
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions) => ({ operator: 'and', conditions })),
  eq: vi.fn((column, value) => ({ column, value, operator: 'eq' })),
}));

vi.mock('@/src/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
  apiCredentials: {
    userId: 'userId',
    provider: 'provider',
    isActive: 'isActive',
    encryptedApiKey: 'encryptedApiKey',
    encryptedSecretKey: 'encryptedSecretKey',
  },
}));

vi.mock('./mexc-client-factory', () => ({
  UnifiedMexcClient: vi.fn().mockImplementation(() => ({
    testConnectivity: vi.fn(),
    getAccountInfo: vi.fn(),
  })),
}));

vi.mock('./secure-encryption-service', () => ({
  getEncryptionService: vi.fn(() => ({
    decrypt: vi.fn(),
    encrypt: vi.fn(),
  })),
}));

// Import mocked modules
import { and, eq } from 'drizzle-orm';
import { db, apiCredentials } from '@/src/db';
import { UnifiedMexcClient } from '../../../../src/services/api/mexc-client-factory';
import { getEncryptionService } from '../../../../src/services/api/secure-encryption-service';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../../utils/timeout-elimination-helpers';

describe('Unified MEXC Service Factory', () => {
  let mockConsole: any;
  let serviceFactory: UnifiedMexcServiceFactory;
  let mockDb: any;
  let mockEncryptionService: any;
  let originalEnv: NodeJS.ProcessEnv;
  let originalGlobal: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Store original environment and global
    originalEnv = { ...process.env };
    originalGlobal = { ...globalThis };

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

    // Mock database
    mockDb = db as any;
    mockDb.select.mockReturnValue(mockDb);
    mockDb.from.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.limit.mockReturnValue(Promise.resolve([]));

    // Mock encryption service
    mockEncryptionService = {
      decrypt: vi.fn(),
      encrypt: vi.fn(),
    };
    vi.mocked(getEncryptionService).mockReturnValue(mockEncryptionService);

    // Set up test environment variables
    process.env.MEXC_API_KEY = 'test-api-key-123456';
    process.env.MEXC_SECRET_KEY = 'test-secret-key-123456';
    process.env.MEXC_BASE_URL = 'https://api.mexc.com';

    serviceFactory = new UnifiedMexcServiceFactory();
    resetGlobalMexcServiceFactory();
  });

  afterEach(async () => {
    // TIMEOUT ELIMINATION: Ensure all promises are flushed before cleanup
    await flushPromises();
    vi.restoreAllMocks();
    
    // Restore original environment and global
    process.env = originalEnv;
    Object.assign(globalThis, originalGlobal);
    
    resetGlobalMexcServiceFactory();
  
  });

  describe('Constructor and Configuration', () => {
    it('should create factory with default configuration', () => {
      expect(serviceFactory).toBeDefined();
      expect(serviceFactory).toBeInstanceOf(UnifiedMexcServiceFactory);
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[UnifiedMexcServiceFactory] Initialized with config:',
        expect.objectContaining({
          enableGlobalCache: true,
          credentialCacheTTL: 300000,
          serviceInstanceCacheTTL: 600000,
          fallbackToEnvironment: true,
        })
      );
    });

    it('should create factory with custom configuration', () => {
      const customConfig = {
        enableGlobalCache: false,
        credentialCacheTTL: 600000,
        serviceInstanceCacheTTL: 1200000,
        fallbackToEnvironment: false,
        enableCircuitBreaker: false,
      };

      const customFactory = new UnifiedMexcServiceFactory(customConfig);

      expect(customFactory).toBeDefined();
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[UnifiedMexcServiceFactory] Initialized with config:',
        expect.objectContaining(customConfig)
      );
    });

    it('should partially override default configuration', () => {
      const partialConfig = {
        enableGlobalCache: false,
        credentialCacheTTL: 600000,
      };

      const customFactory = new UnifiedMexcServiceFactory(partialConfig);

      expect(customFactory).toBeDefined();
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[UnifiedMexcServiceFactory] Initialized with config:',
        expect.objectContaining({
          enableGlobalCache: false,
          credentialCacheTTL: 600000,
          serviceInstanceCacheTTL: 600000, // Default value
          fallbackToEnvironment: true, // Default value
        })
      );
    });
  });

  describe('Service Creation - Environment Credentials', () => {
    it('should create service with environment credentials', async () => {
      const mockClient = new UnifiedMexcClient({} as any);
      vi.mocked(UnifiedMexcClient).mockReturnValue(mockClient);

      const service = await serviceFactory.getMexcService();

      expect(service).toBe(mockClient);
      expect(UnifiedMexcClient).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test-api-key-123456',
          secretKey: 'test-secret-key-123456',
          baseUrl: 'https://api.mexc.com',
          timeout: 15000,
          maxRetries: 3,
          retryDelay: 1000,
          rateLimitDelay: 100,
          enableCaching: true,
          cacheTTL: 60000,
        })
      );
    });

    it('should handle missing environment credentials', async () => {
      delete process.env.MEXC_API_KEY;
      delete process.env.MEXC_SECRET_KEY;

      await expect(serviceFactory.getMexcService()).rejects.toThrow(
        'No valid MEXC API credentials configured'
      );

      expect(mockConsole.error).toHaveBeenCalledWith(
        '[UnifiedMexcServiceFactory] Invalid or missing environment credentials',
        expect.objectContaining({
          hasApiKey: false,
          hasSecretKey: false,
          apiKeyLength: 0,
          secretKeyLength: 0,
        })
      );
    });

    it('should handle invalid environment credentials (too short)', async () => {
      process.env.MEXC_API_KEY = 'short';
      process.env.MEXC_SECRET_KEY = 'short';

      await expect(serviceFactory.getMexcService()).rejects.toThrow(
        'No valid MEXC API credentials configured'
      );

      expect(mockConsole.error).toHaveBeenCalledWith(
        '[UnifiedMexcServiceFactory] Invalid or missing environment credentials',
        expect.objectContaining({
          hasApiKey: true,
          hasSecretKey: true,
          apiKeyLength: 5,
          secretKeyLength: 5,
        })
      );
    });

    it('should handle whitespace in environment credentials', async () => {
      process.env.MEXC_API_KEY = '  test-api-key-123456  ';
      process.env.MEXC_SECRET_KEY = '  test-secret-key-123456  ';

      const mockClient = new UnifiedMexcClient({} as any);
      vi.mocked(UnifiedMexcClient).mockReturnValue(mockClient);

      const service = await serviceFactory.getMexcService();

      expect(service).toBe(mockClient);
      expect(UnifiedMexcClient).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test-api-key-123456',
          secretKey: 'test-secret-key-123456',
        })
      );
    });
  });

  describe('Service Creation - Explicit Credentials', () => {
    it('should create service with explicit credentials', async () => {
      const mockClient = new UnifiedMexcClient({} as any);
      vi.mocked(UnifiedMexcClient).mockReturnValue(mockClient);

      const service = await serviceFactory.getMexcService({
        apiKey: 'explicit-api-key',
        secretKey: 'explicit-secret-key',
      });

      expect(service).toBe(mockClient);
      expect(UnifiedMexcClient).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'explicit-api-key',
          secretKey: 'explicit-secret-key',
        })
      );
    });

    it('should prioritize explicit credentials over environment', async () => {
      const mockClient = new UnifiedMexcClient({} as any);
      vi.mocked(UnifiedMexcClient).mockReturnValue(mockClient);

      const service = await serviceFactory.getMexcService({
        apiKey: 'explicit-api-key',
        secretKey: 'explicit-secret-key',
      });

      expect(UnifiedMexcClient).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'explicit-api-key',
          secretKey: 'explicit-secret-key',
        })
      );
      expect(UnifiedMexcClient).not.toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test-api-key-123456',
        })
      );
    });
  });

  describe('Service Creation - Database Credentials', () => {
    it('should create service with database credentials', async () => {
      const mockCredentials = [{
        encryptedApiKey: 'encrypted-api-key',
        encryptedSecretKey: 'encrypted-secret-key',
      }];

      mockDb.limit.mockResolvedValue(mockCredentials);
      mockEncryptionService.decrypt
        .mockReturnValueOnce('db-api-key-123456')
        .mockReturnValueOnce('db-secret-key-123456');

      const mockClient = new UnifiedMexcClient({} as any);
      const mockClientInstance = {
        testConnectivity: vi.fn().mockResolvedValue(true),
        getAccountInfo: vi.fn().mockResolvedValue({ success: true, data: {} }),
      };
      vi.mocked(UnifiedMexcClient).mockReturnValue(mockClientInstance as any);

      const service = await serviceFactory.getMexcService({
        userId: 'test-user-123',
      });

      expect(service).toBe(mockClientInstance);
      expect(UnifiedMexcClient).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'db-api-key-123456',
          secretKey: 'db-secret-key-123456',
        })
      );
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[UnifiedMexcServiceFactory] Testing database credentials...',
        ''
      );
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[UnifiedMexcServiceFactory] Database credentials authenticated successfully',
        ''
      );
    });

    it('should handle database credentials that fail authentication', async () => {
      const mockCredentials = [{
        encryptedApiKey: 'encrypted-api-key',
        encryptedSecretKey: 'encrypted-secret-key',
      }];

      mockDb.limit.mockResolvedValue(mockCredentials);
      mockEncryptionService.decrypt
        .mockReturnValueOnce('invalid-api-key')
        .mockReturnValueOnce('invalid-secret-key');

      const mockFailedClient = {
        testConnectivity: vi.fn().mockResolvedValue(true),
        getAccountInfo: vi.fn().mockResolvedValue({ 
          success: false, 
          error: 'Invalid API key' 
        }),
      };

      const mockEnvClient = {
        testConnectivity: vi.fn().mockResolvedValue(true),
        getAccountInfo: vi.fn().mockResolvedValue({ success: true, data: {} }),
      };

      vi.mocked(UnifiedMexcClient)
        .mockReturnValueOnce(mockFailedClient as any)
        .mockReturnValueOnce(mockEnvClient as any);

      const service = await serviceFactory.getMexcService({
        userId: 'test-user-123',
      });

      expect(service).toBe(mockEnvClient);
      expect(mockConsole.warn).toHaveBeenCalledWith(
        '[UnifiedMexcServiceFactory] Database credentials failed authentication, trying environment fallback',
        expect.objectContaining({
          error: 'Invalid API key',
          credentialsSource: 'database',
        })
      );
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[UnifiedMexcServiceFactory] Environment credentials work, using fallback',
        ''
      );
    });

    it('should handle database credentials and environment fallback both failing', async () => {
      const mockCredentials = [{
        encryptedApiKey: 'encrypted-api-key',
        encryptedSecretKey: 'encrypted-secret-key',
      }];

      mockDb.limit.mockResolvedValue(mockCredentials);
      mockEncryptionService.decrypt
        .mockReturnValueOnce('invalid-api-key')
        .mockReturnValueOnce('invalid-secret-key');

      const mockFailedClient = {
        testConnectivity: vi.fn().mockResolvedValue(true),
        getAccountInfo: vi.fn().mockResolvedValue({ 
          success: false, 
          error: 'Invalid credentials' 
        }),
      };

      vi.mocked(UnifiedMexcClient)
        .mockReturnValueOnce(mockFailedClient as any)
        .mockReturnValueOnce(mockFailedClient as any);

      await expect(serviceFactory.getMexcService({
        userId: 'test-user-123',
      })).rejects.toThrow(
        'Database credentials failed authentication: Invalid credentials. Environment credentials also unavailable or failed.'
      );

      expect(mockConsole.error).toHaveBeenCalledWith(
        '[UnifiedMexcServiceFactory] Environment credentials also failed',
        expect.objectContaining({
          error: 'Invalid credentials',
        })
      );
    });

    it('should handle database query timeout', async () => {
      vi.useFakeTimers();

      // Mock database query that never resolves
      mockDb.limit.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 5000))
      );

      const servicePromise = serviceFactory.getMexcService({
        userId: 'test-user-123',
      });

      // Advance timers to trigger timeout
      vi.advanceTimersByTime(4000);

      await expect(servicePromise).rejects.toThrow(
        'Database query timeout after 3 seconds'
      );

      vi.useRealTimers();
    });

    it('should handle database decryption errors', async () => {
      const mockCredentials = [{
        encryptedApiKey: 'encrypted-api-key',
        encryptedSecretKey: 'encrypted-secret-key',
      }];

      mockDb.limit.mockResolvedValue(mockCredentials);
      mockEncryptionService.decrypt.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const mockClient = new UnifiedMexcClient({} as any);
      vi.mocked(UnifiedMexcClient).mockReturnValue(mockClient);

      const service = await serviceFactory.getMexcService({
        userId: 'test-user-123',
      });

      expect(service).toBe(mockClient); // Should fall back to environment
      expect(mockConsole.error).toHaveBeenCalledWith(
        '[UnifiedMexcServiceFactory] Failed to decrypt credentials:',
        expect.any(Error)
      );
    });

    it('should handle empty database results', async () => {
      mockDb.limit.mockResolvedValue([]);

      const mockClient = new UnifiedMexcClient({} as any);
      vi.mocked(UnifiedMexcClient).mockReturnValue(mockClient);

      const service = await serviceFactory.getMexcService({
        userId: 'test-user-123',
      });

      expect(service).toBe(mockClient);
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[UnifiedMexcServiceFactory] No credentials found for user: test-user-123',
        ''
      );
    });

    it('should handle invalid user IDs', async () => {
      const invalidUserIds = ['', '  ', 'undefined', 'null'];

      for (const userId of invalidUserIds) {
        const mockClient = new UnifiedMexcClient({} as any);
        vi.mocked(UnifiedMexcClient).mockReturnValue(mockClient);

        const service = await serviceFactory.getMexcService({ userId });

        expect(service).toBe(mockClient);
        expect(mockConsole.warn).toHaveBeenCalledWith(
          '[UnifiedMexcServiceFactory] Invalid userId provided:',
          userId
        );
      }
    });
  });

  describe('Caching System', () => {
    describe('Credential Cache', () => {
      it('should cache user credentials', async () => {
        const mockCredentials = [{
          encryptedApiKey: 'encrypted-api-key',
          encryptedSecretKey: 'encrypted-secret-key',
        }];

        mockDb.limit.mockResolvedValue(mockCredentials);
        mockEncryptionService.decrypt
          .mockReturnValueOnce('cached-api-key')
          .mockReturnValueOnce('cached-secret-key');

        const mockClient = {
          testConnectivity: vi.fn().mockResolvedValue(true),
          getAccountInfo: vi.fn().mockResolvedValue({ success: true, data: {} }),
        };
        vi.mocked(UnifiedMexcClient).mockReturnValue(mockClient as any);

        // First call should hit database
        await serviceFactory.getMexcService({ userId: 'test-user' });

        // Second call should use cache
        await serviceFactory.getMexcService({ userId: 'test-user' });

        expect(mockDb.limit).toHaveBeenCalledTimes(1);
        expect(mockConsole.info).toHaveBeenCalledWith(
          '[UnifiedMexcServiceFactory] Using cached user credentials',
          ''
        );
      });

      it('should skip cache when skipCache is true', async () => {
        const mockCredentials = [{
          encryptedApiKey: 'encrypted-api-key',
          encryptedSecretKey: 'encrypted-secret-key',
        }];

        mockDb.limit.mockResolvedValue(mockCredentials);
        mockEncryptionService.decrypt
          .mockReturnValue('api-key')
          .mockReturnValue('secret-key');

        const mockClient = {
          testConnectivity: vi.fn().mockResolvedValue(true),
          getAccountInfo: vi.fn().mockResolvedValue({ success: true, data: {} }),
        };
        vi.mocked(UnifiedMexcClient).mockReturnValue(mockClient as any);

        // First call
        await serviceFactory.getMexcService({ userId: 'test-user' });

        // Second call with skipCache
        await serviceFactory.getMexcService({ 
          userId: 'test-user', 
          skipCache: true 
        });

        expect(mockDb.limit).toHaveBeenCalledTimes(2);
      });

      it('should expire cached credentials after TTL', async () => {
        vi.useFakeTimers();

        const mockCredentials = [{
          encryptedApiKey: 'encrypted-api-key',
          encryptedSecretKey: 'encrypted-secret-key',
        }];

        mockDb.limit.mockResolvedValue(mockCredentials);
        mockEncryptionService.decrypt
          .mockReturnValue('api-key')
          .mockReturnValue('secret-key');

        const mockClient = {
          testConnectivity: vi.fn().mockResolvedValue(true),
          getAccountInfo: vi.fn().mockResolvedValue({ success: true, data: {} }),
        };
        vi.mocked(UnifiedMexcClient).mockReturnValue(mockClient as any);

        // First call
        await serviceFactory.getMexcService({ userId: 'test-user' });

        // Advance time beyond TTL (5 minutes + 1 second)
        vi.advanceTimersByTime(301000);

        // Second call should hit database again
        await serviceFactory.getMexcService({ userId: 'test-user' });

        expect(mockDb.limit).toHaveBeenCalledTimes(2);

        vi.useRealTimers();
      });
    });

    describe('Service Instance Cache', () => {
      it('should cache service instances', async () => {
        const mockClient = new UnifiedMexcClient({} as any);
        vi.mocked(UnifiedMexcClient).mockReturnValue(mockClient);

        // First call
        const service1 = await serviceFactory.getMexcService({
          apiKey: 'test-key',
          secretKey: 'test-secret',
        });

        // Second call with same credentials
        const service2 = await serviceFactory.getMexcService({
          apiKey: 'test-key',
          secretKey: 'test-secret',
        });

        expect(service1).toBe(service2);
        expect(UnifiedMexcClient).toHaveBeenCalledTimes(1);
        expect(mockConsole.info).toHaveBeenCalledWith(
          '[UnifiedMexcServiceFactory] Using cached service instance',
          ''
        );
      });

      it('should create different instances for different credentials', async () => {
        const mockClient1 = new UnifiedMexcClient({} as any);
        const mockClient2 = new UnifiedMexcClient({} as any);
        vi.mocked(UnifiedMexcClient)
          .mockReturnValueOnce(mockClient1)
          .mockReturnValueOnce(mockClient2);

        const service1 = await serviceFactory.getMexcService({
          apiKey: 'test-key-1',
          secretKey: 'test-secret-1',
        });

        const service2 = await serviceFactory.getMexcService({
          apiKey: 'test-key-2',
          secretKey: 'test-secret-2',
        });

        expect(service1).toBe(mockClient1);
        expect(service2).toBe(mockClient2);
        expect(UnifiedMexcClient).toHaveBeenCalledTimes(2);
      });

      it('should skip service cache when skipCache is true', async () => {
        const mockClient1 = new UnifiedMexcClient({} as any);
        const mockClient2 = new UnifiedMexcClient({} as any);
        vi.mocked(UnifiedMexcClient)
          .mockReturnValueOnce(mockClient1)
          .mockReturnValueOnce(mockClient2);

        // First call
        const service1 = await serviceFactory.getMexcService({
          apiKey: 'test-key',
          secretKey: 'test-secret',
        });

        // Second call with skipCache
        const service2 = await serviceFactory.getMexcService({
          apiKey: 'test-key',
          secretKey: 'test-secret',
          skipCache: true,
        });

        expect(service1).toBe(mockClient1);
        expect(service2).toBe(mockClient2);
        expect(UnifiedMexcClient).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Cache Management', () => {
    it('should invalidate user credentials', () => {
      serviceFactory.invalidateUserCredentials('test-user');

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[UnifiedMexcServiceFactory] Invalidated credentials cache for user: test-user',
        ''
      );
    });

    it('should clear all caches', () => {
      serviceFactory.clearAllCaches();

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[UnifiedMexcServiceFactory] Cleared all caches',
        ''
      );
    });

    it('should get cache statistics', () => {
      const stats = serviceFactory.getCacheStats();

      expect(stats).toMatchObject({
        credentialCache: { size: expect.any(Number) },
        serviceCache: { 
          size: expect.any(Number), 
          keys: expect.any(Array) 
        },
      });
    });
  });

  describe('Service Testing', () => {
    it('should test service connectivity and authentication successfully', async () => {
      const mockClient = {
        testConnectivity: vi.fn().mockResolvedValue(true),
        getAccountInfo: vi.fn().mockResolvedValue({ success: true, data: {} }),
      };

      const result = await serviceFactory.testService(mockClient as any);

      expect(result).toEqual({
        connectivity: true,
        authentication: true,
      });
    });

    it('should handle connectivity failure', async () => {
      const mockClient = {
        testConnectivity: vi.fn().mockResolvedValue(false),
        getAccountInfo: vi.fn(),
      };

      const result = await serviceFactory.testService(mockClient as any);

      expect(result).toEqual({
        connectivity: false,
        authentication: false,
        error: 'Failed to connect to MEXC API',
      });
    });

    it('should handle authentication failure', async () => {
      const mockClient = {
        testConnectivity: vi.fn().mockResolvedValue(true),
        getAccountInfo: vi.fn().mockResolvedValue({ 
          success: false, 
          error: 'Invalid credentials' 
        }),
      };

      const result = await serviceFactory.testService(mockClient as any);

      expect(result).toEqual({
        connectivity: true,
        authentication: false,
        error: 'Invalid credentials',
      });
    });

    it('should handle service test exceptions', async () => {
      const mockClient = {
        testConnectivity: vi.fn().mockRejectedValue(new Error('Network error')),
        getAccountInfo: vi.fn(),
      };

      const result = await serviceFactory.testService(mockClient as any);

      expect(result).toEqual({
        connectivity: false,
        authentication: false,
        error: 'Network error',
      });
    });
  });

  describe('Status Synchronization', () => {
    it('should trigger status synchronization on credential operation success', () => {
      // Mock global environment
      const mockGlobalThis = {
        dispatchEvent: vi.fn(),
        mexcCredentialsUpdated: null,
      };
      Object.assign(globalThis, mockGlobalThis);

      serviceFactory.onCredentialOperationSuccess('test-user');

      expect(mockGlobalThis.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'mexc-credentials-updated',
          detail: {
            userId: 'test-user',
            timestamp: expect.any(Number),
          },
        })
      );

      expect(mockGlobalThis.mexcCredentialsUpdated).toMatchObject({
        userId: 'test-user',
        timestamp: expect.any(Number),
        cacheInvalidated: true,
      });

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[UnifiedMexcServiceFactory] Credential operation success - invalidated caches',
        ''
      );
    });

    it('should trigger status synchronization without userId', () => {
      const mockGlobalThis = {
        dispatchEvent: vi.fn(),
        mexcCredentialsUpdated: null,
      };
      Object.assign(globalThis, mockGlobalThis);

      serviceFactory.onCredentialOperationSuccess();

      expect(mockGlobalThis.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            userId: undefined,
            timestamp: expect.any(Number),
          },
        })
      );
    });

    it('should handle React Query invalidation in browser environment', () => {
      const mockQueryClient = {
        invalidateQueries: vi.fn(),
      };

      // Mock window environment
      (global as any).window = {
        queryClient: mockQueryClient,
      };

      serviceFactory.onCredentialOperationSuccess('test-user');

      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['mexc-status'],
      });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['mexc-connectivity'],
      });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['user-credentials'],
      });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['user-credentials', 'test-user'],
      });

      // Clean up
      delete (global as any).window;
    });

    it('should handle status synchronization errors gracefully', () => {
      const mockGlobalThis = {
        dispatchEvent: vi.fn().mockImplementation(() => {
          throw new Error('Dispatch failed');
        }),
      };
      Object.assign(globalThis, mockGlobalThis);

      serviceFactory.onCredentialOperationSuccess('test-user');

      expect(mockConsole.warn).toHaveBeenCalledWith(
        '[UnifiedMexcServiceFactory] Failed to trigger status synchronization:',
        expect.any(Error)
      );
    });
  });

  describe('Global Factory Instance', () => {
    it('should return singleton global factory instance', () => {
      const factory1 = getGlobalMexcServiceFactory();
      const factory2 = getGlobalMexcServiceFactory();

      expect(factory1).toBe(factory2);
      expect(factory1).toBeInstanceOf(UnifiedMexcServiceFactory);
    });

    it('should create new instance after reset', () => {
      const factory1 = getGlobalMexcServiceFactory();
      resetGlobalMexcServiceFactory();
      const factory2 = getGlobalMexcServiceFactory();

      expect(factory1).not.toBe(factory2);
      expect(factory2).toBeInstanceOf(UnifiedMexcServiceFactory);
    });
  });

  describe('Convenience Functions', () => {
    it('should get unified MEXC service', async () => {
      const mockClient = new UnifiedMexcClient({} as any);
      vi.mocked(UnifiedMexcClient).mockReturnValue(mockClient);

      const service = await getUnifiedMexcService({
        apiKey: 'test-key',
        secretKey: 'test-secret',
      });

      expect(service).toBe(mockClient);
    });

    it('should invalidate user credentials cache via convenience function', () => {
      invalidateUserCredentialsCache('test-user');

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[UnifiedMexcServiceFactory] Invalidated credentials cache for user: test-user',
        ''
      );
    });

    it('should clear MEXC service caches via convenience function', () => {
      clearMexcServiceCaches();

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[UnifiedMexcServiceFactory] Cleared all caches',
        ''
      );
    });

    it('should trigger credential status update via convenience function', () => {
      const mockGlobalThis = {
        dispatchEvent: vi.fn(),
        mexcCredentialsUpdated: null,
      };
      Object.assign(globalThis, mockGlobalThis);

      triggerCredentialStatusUpdate('test-user');

      expect(mockConsole.info).toHaveBeenCalledWith(
        '[UnifiedMexcServiceFactory] Credential operation success - invalidated caches',
        ''
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle configuration with disabled cache', async () => {
      const factoryWithoutCache = new UnifiedMexcServiceFactory({
        enableGlobalCache: false,
      });

      const mockClient = new UnifiedMexcClient({} as any);
      vi.mocked(UnifiedMexcClient).mockReturnValue(mockClient);

      const service = await factoryWithoutCache.getMexcService({
        apiKey: 'test-key',
        secretKey: 'test-secret',
      });

      expect(service).toBe(mockClient);
    });

    it('should handle fallback disabled when credentials fail', async () => {
      const factoryWithoutFallback = new UnifiedMexcServiceFactory({
        fallbackToEnvironment: false,
      });

      delete process.env.MEXC_API_KEY;
      delete process.env.MEXC_SECRET_KEY;

      await expect(factoryWithoutFallback.getMexcService()).rejects.toThrow();
    });

    it('should handle database connection errors', async () => {
      mockDb.limit.mockRejectedValue(new Error('Database connection failed'));

      const mockClient = new UnifiedMexcClient({} as any);
      vi.mocked(UnifiedMexcClient).mockReturnValue(mockClient);

      const service = await serviceFactory.getMexcService({
        userId: 'test-user',
      });

      expect(service).toBe(mockClient); // Should fall back to environment
      expect(mockConsole.error).toHaveBeenCalledWith(
        '[UnifiedMexcServiceFactory] Failed to get user credentials:',
        expect.any(Error)
      );
    });

    it('should handle empty decrypted credentials', async () => {
      const mockCredentials = [{
        encryptedApiKey: 'encrypted-api-key',
        encryptedSecretKey: 'encrypted-secret-key',
      }];

      mockDb.limit.mockResolvedValue(mockCredentials);
      mockEncryptionService.decrypt
        .mockReturnValueOnce('') // Empty API key
        .mockReturnValueOnce('secret-key');

      const mockClient = new UnifiedMexcClient({} as any);
      vi.mocked(UnifiedMexcClient).mockReturnValue(mockClient);

      const service = await serviceFactory.getMexcService({
        userId: 'test-user',
      });

      expect(service).toBe(mockClient); // Should fall back to environment
      expect(mockConsole.warn).toHaveBeenCalledWith(
        '[UnifiedMexcServiceFactory] Failed to decrypt credentials - empty result',
        ''
      );
    });

    it('should handle general service creation errors with fallback', async () => {
      vi.mocked(UnifiedMexcClient).mockImplementation(() => {
        throw new Error('Service creation failed');
      });

      await expect(serviceFactory.getMexcService({
        apiKey: 'test-key',
        secretKey: 'test-secret',
      })).rejects.toThrow('Service creation failed');

      expect(mockConsole.error).toHaveBeenCalledWith(
        '[UnifiedMexcServiceFactory] Failed to get service:',
        expect.any(Error)
      );
    });

    it('should handle environment fallback when all else fails', async () => {
      // Force error in main flow
      vi.mocked(UnifiedMexcClient)
        .mockImplementationOnce(() => {
          throw new Error('Primary creation failed');
        })
        .mockImplementationOnce((config) => ({ config } as any)); // Fallback succeeds

      const service = await serviceFactory.getMexcService({
        apiKey: 'test-key',
        secretKey: 'test-secret',
      });

      expect(service).toBeDefined();
      expect(mockConsole.info).toHaveBeenCalledWith(
        '[UnifiedMexcServiceFactory] Falling back to environment credentials due to error',
        ''
      );
    });

    it('should handle complete fallback failure', async () => {
      delete process.env.MEXC_API_KEY;
      delete process.env.MEXC_SECRET_KEY;

      vi.mocked(UnifiedMexcClient).mockImplementation(() => {
        throw new Error('Service creation failed');
      });

      await expect(serviceFactory.getMexcService({
        apiKey: 'test-key',
        secretKey: 'test-secret',
      })).rejects.toThrow('All credential sources failed');

      expect(mockConsole.error).toHaveBeenCalledWith(
        '[UnifiedMexcServiceFactory] Environment fallback failed - no credentials available',
        ''
      );
    });

    it('should handle custom base URL from environment', async () => {
      process.env.MEXC_BASE_URL = 'https://custom-api.mexc.com';

      const mockClient = new UnifiedMexcClient({} as any);
      vi.mocked(UnifiedMexcClient).mockReturnValue(mockClient);

      await serviceFactory.getMexcService();

      expect(UnifiedMexcClient).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'https://custom-api.mexc.com',
        })
      );
    });
  });
});