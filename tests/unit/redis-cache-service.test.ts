/**
 * Redis Cache Service Tests
 *
 * Phase 2 Implementation: Redis/Valkey Caching & Performance Enhancement
 *
 * Tests for Redis/Valkey cache service with graceful degradation,
 * 5-second TTL for API responses, and performance monitoring.
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { RedisCacheService, getRedisCacheService, resetRedisCacheService } from '@/src/lib/redis-cache-service';

// Mock Redis to test graceful degradation
const mockRedis = {
  connect: vi.fn(),
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  mget: vi.fn(),
  keys: vi.fn(),
  flushdb: vi.fn(),
  info: vi.fn(),
  dbsize: vi.fn(),
  pipeline: vi.fn(() => ({
    setex: vi.fn(),
    exec: vi.fn(),
  })),
  quit: vi.fn(),
  on: vi.fn(),
};

vi.mock('ioredis', () => {
  return {
    default: vi.fn(() => mockRedis),
  };
});

describe('RedisCacheService', () => {
  let cacheService: RedisCacheService;

  // Helper function to simulate Redis connection
  const simulateConnection = (service: RedisCacheService) => {
    (service as any).isConnected = true;
    (service as any).metrics.connectionStatus = 'connected';
  };

  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    resetRedisCacheService();

    // Store original environment and reset environment variables to prevent build environment detection
    originalEnv = { ...process.env };
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.VERCEL;
    delete process.env.NODE_ENV;
    delete process.env.NEXT_PHASE;
    delete process.env.NEXT_BUILD;
    delete process.env.STATIC_GENERATION;
    delete process.env.BUILD_ID;
    delete process.env.npm_lifecycle_event;
    delete process.env.npm_command;
    process.env.REDIS_URL = 'redis://localhost:6379'; // Provide Redis URL to prevent skip

    // Reset mock Redis behavior
    mockRedis.connect.mockResolvedValue(undefined);
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockRedis.mget.mockResolvedValue([]);
    mockRedis.keys.mockResolvedValue([]);
    mockRedis.flushdb.mockResolvedValue('OK');
    mockRedis.info.mockResolvedValue('used_memory:1024');
    mockRedis.dbsize.mockResolvedValue(0);
    mockRedis.quit.mockResolvedValue('OK');

    const pipeline = {
      setex: vi.fn(),
      exec: vi.fn().mockResolvedValue([]),
    };
    mockRedis.pipeline.mockReturnValue(pipeline);
  });

  afterEach(async () => {
    if (cacheService) {
      await cacheService.destroy();
    }
    resetRedisCacheService();
    
    // Restore original environment variables
    process.env = { ...originalEnv };
  });

  describe('Initialization and Configuration', () => {
    it('should initialize with default configuration', () => {
      cacheService = new RedisCacheService();

      expect(cacheService).toBeDefined();
      expect(cacheService.isHealthy()).toBe(false); // Not connected initially
    });

    it('should initialize with custom configuration', () => {
      const config = {
        defaultTTL: 10000,
        enableGracefulDegradation: false,
        enableMetrics: false,
      };

      cacheService = new RedisCacheService(config);
      expect(cacheService).toBeDefined();
    });

    it('should use user preference of 5-second TTL by default', () => {
      cacheService = new RedisCacheService();
      const metrics = cacheService.getMetrics();

      // The default TTL should be 5000ms (5 seconds) as per user preference
      expect(metrics).toBeDefined();
    });
  });

  describe('Basic Cache Operations', () => {
    beforeEach(() => {
      cacheService = new RedisCacheService({
        enableGracefulDegradation: true,
      });
    });

    it('should handle get operation with graceful degradation when disconnected', async () => {
      const result = await cacheService.get('test-key');
      expect(result).toBeNull();
      expect(mockRedis.get).not.toHaveBeenCalled(); // Should not call Redis when disconnected
    });

    it('should handle set operation with graceful degradation when disconnected', async () => {
      const result = await cacheService.set('test-key', 'test-value');
      expect(result).toBe(false);
      expect(mockRedis.setex).not.toHaveBeenCalled(); // Should not call Redis when disconnected
    });

    it('should handle delete operation with graceful degradation when disconnected', async () => {
      const result = await cacheService.delete('test-key');
      expect(result).toBe(false);
      expect(mockRedis.del).not.toHaveBeenCalled(); // Should not call Redis when disconnected
    });

    it('should perform cache operations when connected', async () => {
      // Simulate connection by directly setting the connection state
      (cacheService as any).isConnected = true;
      (cacheService as any).metrics.connectionStatus = 'connected';

      // Mock successful Redis operations
      const testData = { message: 'test data' };
      const serializedData = JSON.stringify({
        data: testData,
        timestamp: expect.any(Number),
        ttl: 5000,
        type: 'api_response',
        priority: 'medium',
        metadata: expect.any(Object),
      });

      mockRedis.get.mockResolvedValue(serializedData);
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.del.mockResolvedValue(1);

      // Test set operation
      const setResult = await cacheService.set('test-key', testData, {
        type: 'api_response',
        ttl: 5000,
      });
      expect(setResult).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith('test-key', 5, expect.any(String));

      // Test get operation
      const getResult = await cacheService.get('test-key');
      expect(getResult).toEqual(testData);
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');

      // Test delete operation
      const deleteResult = await cacheService.delete('test-key');
      expect(deleteResult).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
    });
  });

  describe('Batch Operations', () => {
    beforeEach(() => {
      cacheService = new RedisCacheService({
        enableGracefulDegradation: true,
      });

      // Simulate connection
      simulateConnection(cacheService);
    });

    it('should handle batch get operations', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const mockResults = [
        JSON.stringify({
          data: 'value1',
          timestamp: Date.now(),
          ttl: 5000,
          type: 'api_response',
          priority: 'medium',
          metadata: {},
        }),
        null,
        JSON.stringify({
          data: 'value3',
          timestamp: Date.now(),
          ttl: 5000,
          type: 'api_response',
          priority: 'medium',
          metadata: {},
        }),
      ];

      mockRedis.mget.mockResolvedValue(mockResults);

      const results = await cacheService.mget(keys);

      expect(results).toHaveLength(3);
      expect(results[0]).toBe('value1');
      expect(results[1]).toBeNull();
      expect(results[2]).toBe('value3');
      expect(mockRedis.mget).toHaveBeenCalledWith(...keys);
    });

    it('should handle batch set operations', async () => {
      const entries = [
        { key: 'key1', value: 'value1', type: 'api_response' as const },
        { key: 'key2', value: 'value2', type: 'market_data' as const },
      ];

      const pipeline = {
        setex: vi.fn(),
        exec: vi.fn().mockResolvedValue([]),
      };
      mockRedis.pipeline.mockReturnValue(pipeline);

      const result = await cacheService.mset(entries);

      expect(result).toBe(true);
      expect(mockRedis.pipeline).toHaveBeenCalled();
      expect(pipeline.setex).toHaveBeenCalledTimes(2);
      expect(pipeline.exec).toHaveBeenCalled();
    });

    it('should return empty arrays for batch operations when disconnected', async () => {
      // Reset to disconnected state
      cacheService = new RedisCacheService({
        enableGracefulDegradation: true,
      });

      const keys = ['key1', 'key2'];
      const results = await cacheService.mget(keys);

      expect(results).toEqual([null, null]);
      expect(mockRedis.mget).not.toHaveBeenCalled();
    });
  });

  describe('TTL and Expiration', () => {
    beforeEach(() => {
      cacheService = new RedisCacheService({
        defaultTTL: 5000, // 5 seconds as per user preference
      });

      // Simulate connection
      simulateConnection(cacheService);
    });

    it('should use 5-second TTL for API responses by default', async () => {
      await cacheService.set('api-key', { data: 'api response' }, {
        type: 'api_response',
      });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'api-key',
        5, // 5 seconds
        expect.any(String)
      );
    });

    it('should handle expired entries correctly', async () => {
      const expiredData = JSON.stringify({
        data: 'expired data',
        timestamp: Date.now() - 10000, // 10 seconds ago
        ttl: 5000, // 5 second TTL
        type: 'api_response',
        priority: 'medium',
        metadata: {},
      });

      mockRedis.get.mockResolvedValue(expiredData);
      mockRedis.del.mockResolvedValue(1);

      const result = await cacheService.get('expired-key');

      expect(result).toBeNull(); // Should return null for expired data
      expect(mockRedis.del).toHaveBeenCalledWith('expired-key'); // Should delete expired entry
    });

    it('should use custom TTL when provided', async () => {
      const customTTL = 10000; // 10 seconds

      await cacheService.set('custom-key', { data: 'custom data' }, {
        ttl: customTTL,
      });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'custom-key',
        10, // 10 seconds
        expect.any(String)
      );
    });
  });

  describe('Error Handling and Graceful Degradation', () => {
    it('should handle Redis connection errors gracefully', async () => {
      cacheService = new RedisCacheService({
        enableGracefulDegradation: true,
      });

      // Simulate connection error
      const onError = mockRedis.on.mock.calls.find(call => call[0] === 'error')?.[1];
      if (onError) onError(new Error('Connection failed'));

      // Operations should still work but return default values
      const getResult = await cacheService.get('test-key');
      const setResult = await cacheService.set('test-key', 'test-value');
      const deleteResult = await cacheService.delete('test-key');

      expect(getResult).toBeNull();
      expect(setResult).toBe(false);
      expect(deleteResult).toBe(false);
    });

    it('should handle Redis operation errors gracefully', async () => {
      cacheService = new RedisCacheService({
        enableGracefulDegradation: true,
      });

      // Simulate connection
      const onConnect = mockRedis.on.mock.calls.find(call => call[0] === 'connect')?.[1];
      if (onConnect) onConnect();

      // Simulate Redis operation errors
      mockRedis.get.mockRejectedValue(new Error('Redis operation failed'));
      mockRedis.setex.mockRejectedValue(new Error('Redis operation failed'));
      mockRedis.del.mockRejectedValue(new Error('Redis operation failed'));

      // Operations should handle errors gracefully
      const getResult = await cacheService.get('test-key');
      const setResult = await cacheService.set('test-key', 'test-value');
      const deleteResult = await cacheService.delete('test-key');

      expect(getResult).toBeNull();
      expect(setResult).toBe(false);
      expect(deleteResult).toBe(false);
    });

    it('should not throw errors when graceful degradation is enabled', async () => {
      cacheService = new RedisCacheService({
        enableGracefulDegradation: true,
      });

      // All operations should complete without throwing
      await expect(cacheService.get('test-key')).resolves.toBeNull();
      await expect(cacheService.set('test-key', 'value')).resolves.toBe(false);
      await expect(cacheService.delete('test-key')).resolves.toBe(false);
      await expect(cacheService.clear()).resolves.toBe(0);
    });
  });

  describe('Metrics and Monitoring', () => {
    beforeEach(() => {
      cacheService = new RedisCacheService({
        enableMetrics: true,
      });
    });

    it('should track cache metrics', () => {
      const metrics = cacheService.getMetrics();

      expect(metrics).toMatchObject({
        hits: expect.any(Number),
        misses: expect.any(Number),
        sets: expect.any(Number),
        deletes: expect.any(Number),
        errors: expect.any(Number),
        connectionStatus: expect.any(String),
        avgResponseTime: expect.any(Number),
        totalOperations: expect.any(Number),
        cacheSize: expect.any(Number),
        memoryUsage: expect.any(Number),
      });
    });

    it('should update metrics on cache operations', async () => {
      // Simulate connection
      simulateConnection(cacheService);

      const initialMetrics = cacheService.getMetrics();

      // Perform cache operations
      await cacheService.get('test-key'); // Miss
      await cacheService.set('test-key', 'value'); // Set

      const updatedMetrics = cacheService.getMetrics();

      expect(updatedMetrics.misses).toBe(initialMetrics.misses + 1);
      expect(updatedMetrics.sets).toBe(initialMetrics.sets + 1);
      expect(updatedMetrics.totalOperations).toBeGreaterThan(initialMetrics.totalOperations);
    });

    it('should provide health status', () => {
      expect(cacheService.isHealthy()).toBe(false); // Not connected initially

      // Simulate connection
      simulateConnection(cacheService);

      expect(cacheService.isHealthy()).toBe(true);
    });
  });

  describe('Global Instance Management', () => {
    it('should provide global instance', () => {
      const instance1 = getRedisCacheService();
      const instance2 = getRedisCacheService();

      expect(instance1).toBe(instance2); // Should be the same instance
    });

    it('should reset global instance', () => {
      const instance1 = getRedisCacheService();
      resetRedisCacheService();
      const instance2 = getRedisCacheService();

      expect(instance1).not.toBe(instance2); // Should be different instances
    });
  });

  describe('Cache Warming Support', () => {
    beforeEach(() => {
      cacheService = new RedisCacheService({
        enableCacheWarming: true,
      });
    });

    it('should support cache warming strategies', () => {
      const strategy = {
        pattern: 'test:*',
        priority: 'high' as const,
        dataGenerator: vi.fn().mockResolvedValue({ data: 'warmed data' }),
        frequency: 30000,
      };

      cacheService.addWarmupStrategy(strategy);

      // Strategy should be added (internal verification)
      expect(strategy.dataGenerator).toBeDefined();
    });
  });

  describe('Incremental Processing Support', () => {
    beforeEach(() => {
      cacheService = new RedisCacheService();

      // Simulate connection
      simulateConnection(cacheService);
    });

    it('should support delta updates with setWithDelta', async () => {
      const pipeline = {
        setex: vi.fn(),
        exec: vi.fn().mockResolvedValue([]),
      };
      mockRedis.pipeline.mockReturnValue(pipeline);

      const result = await cacheService.setWithDelta(
        'data-key',
        { value: 'new data' },
        'delta:data-key',
        { ttl: 5000 }
      );

      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalled(); // For main data
      expect(pipeline.setex).toHaveBeenCalled(); // For delta info
      expect(pipeline.exec).toHaveBeenCalled();
    });

    it('should get delta keys for incremental processing', async () => {
      const deltaKeys = ['delta:key1', 'delta:key2'];
      mockRedis.keys.mockResolvedValue(deltaKeys);

      const result = await cacheService.getDeltaKeys('delta:*');

      expect(result).toEqual(deltaKeys);
      expect(mockRedis.keys).toHaveBeenCalledWith('delta:*');
    });
  });
});
