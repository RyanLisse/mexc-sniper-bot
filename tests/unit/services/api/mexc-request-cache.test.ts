/**
 * Unit tests for MEXC Request Cache System
 * Tests cache operations, TTL handling, cleanup, statistics, decorators, and cache warming
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  MexcRequestCache,
  getGlobalCache,
  resetGlobalCache,
  cacheable,
  CacheWarmer,
} from '../../../../src/services/api/mexc-request-cache';

describe('MEXC Request Cache', () => {
  let mockConsole: any;
  let cache: MexcRequestCache;

  beforeEach(() => {
    vi.clearAllMocks();
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

    cache = new MexcRequestCache(100); // Small max size for testing
    resetGlobalCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    resetGlobalCache();
  });

  describe('Constructor and Configuration', () => {
    it('should create cache with default configuration', () => {
      const defaultCache = new MexcRequestCache();
      
      expect(defaultCache).toBeDefined();
      expect(defaultCache).toBeInstanceOf(MexcRequestCache);
      expect(defaultCache['maxSize']).toBe(1000);
    });

    it('should create cache with custom max size', () => {
      const customCache = new MexcRequestCache(500);
      
      expect(customCache['maxSize']).toBe(500);
    });

    it('should initialize with empty cache and zero stats', () => {
      const stats = cache.getStats();
      
      expect(stats).toMatchObject({
        size: 0,
        maxSize: 100,
        hitRate: 0,
        missRate: 0,
      });
    });

    it('should set up cleanup interval', () => {
      // setInterval should be called once during construction
      expect(vi.getTimerCount()).toBeGreaterThan(0);
    });
  });

  describe('Basic Cache Operations', () => {
    it('should store and retrieve data successfully', () => {
      const testData = { value: 'test', number: 42 };
      
      cache.set('test-key', testData, 60000);
      const retrieved = cache.get('test-key');
      
      expect(retrieved).toEqual(testData);
      expect(cache.has('test-key')).toBe(true);
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('non-existent-key');
      
      expect(result).toBeNull();
      expect(cache.has('non-existent-key')).toBe(false);
    });

    it('should handle different data types', () => {
      cache.set('string', 'hello world', 60000);
      cache.set('number', 42, 60000);
      cache.set('boolean', true, 60000);
      cache.set('array', [1, 2, 3], 60000);
      cache.set('object', { nested: { value: 'test' } }, 60000);
      cache.set('null', null, 60000);
      
      expect(cache.get('string')).toBe('hello world');
      expect(cache.get('number')).toBe(42);
      expect(cache.get('boolean')).toBe(true);
      expect(cache.get('array')).toEqual([1, 2, 3]);
      expect(cache.get('object')).toEqual({ nested: { value: 'test' } });
      expect(cache.get('null')).toBeNull();
    });

    it('should update existing keys', () => {
      cache.set('update-key', 'original', 60000);
      cache.set('update-key', 'updated', 60000);
      
      expect(cache.get('update-key')).toBe('updated');
    });

    it('should delete specific keys', () => {
      cache.set('delete-me', 'value', 60000);
      
      expect(cache.has('delete-me')).toBe(true);
      const deleted = cache.delete('delete-me');
      
      expect(deleted).toBe(true);
      expect(cache.has('delete-me')).toBe(false);
      expect(cache.get('delete-me')).toBeNull();
    });

    it('should return false when deleting non-existent keys', () => {
      const deleted = cache.delete('non-existent');
      
      expect(deleted).toBe(false);
    });
  });

  describe('TTL and Expiration', () => {
    it('should expire entries after TTL', () => {
      cache.set('expire-me', 'value', 1000); // 1 second TTL
      
      expect(cache.get('expire-me')).toBe('value');
      expect(cache.has('expire-me')).toBe(true);
      
      // Advance time by 1.5 seconds
      vi.advanceTimersByTime(1500);
      
      expect(cache.get('expire-me')).toBeNull();
      expect(cache.has('expire-me')).toBe(false);
    });

    it('should handle different TTL values', () => {
      cache.set('short-ttl', 'value1', 100);
      cache.set('long-ttl', 'value2', 10000);
      
      // Advance time by 500ms
      vi.advanceTimersByTime(500);
      
      expect(cache.get('short-ttl')).toBeNull();
      expect(cache.get('long-ttl')).toBe('value2');
      
      // Advance time by 10 more seconds
      vi.advanceTimersByTime(10000);
      
      expect(cache.get('long-ttl')).toBeNull();
    });

    it('should log cache hits and misses', () => {
      cache.set('log-test', 'value', 60000);
      
      // Cache hit
      cache.get('log-test');
      expect(mockConsole.debug).toHaveBeenCalledWith('Cache hit', {
        key: 'log-test',
        age: expect.any(Number),
      });
      
      // Cache miss (expired)
      vi.advanceTimersByTime(70000);
      cache.get('log-test');
      expect(mockConsole.debug).toHaveBeenCalledWith('Cache expired', {
        key: 'log-test',
        age: expect.any(Number),
      });
    });
  });

  describe('Cache Size Management', () => {
    it('should trigger cleanup when cache is full', () => {
      // Fill cache to max capacity
      for (let i = 0; i < 100; i++) {
        cache.set(`key-${i}`, `value-${i}`, 60000);
      }
      
      expect(cache.getStats().size).toBe(100);
      
      // Add one more to trigger cleanup
      cache.set('overflow-key', 'overflow-value', 60000);
      
      expect(cache.getStats().size).toBeLessThanOrEqual(100);
    });

    it('should remove oldest entries when cleanup is not sufficient', () => {
      // Fill cache with non-expiring entries
      for (let i = 0; i < 100; i++) {
        vi.advanceTimersByTime(10); // Ensure different timestamps
        cache.set(`key-${i}`, `value-${i}`, 60000);
      }
      
      expect(cache.getStats().size).toBe(100);
      
      // Add one more to trigger removal of oldest entries
      cache.set('new-key', 'new-value', 60000);
      
      expect(cache.getStats().size).toBeLessThan(100);
      expect(cache.has('key-0')).toBe(false); // Oldest should be removed
      expect(cache.has('new-key')).toBe(true); // New entry should exist
    });

    it('should remove approximately 10% of entries when full', () => {
      for (let i = 0; i < 100; i++) {
        vi.advanceTimersByTime(10);
        cache.set(`key-${i}`, `value-${i}`, 60000);
      }
      
      const initialSize = cache.getStats().size;
      cache.set('trigger-cleanup', 'value', 60000);
      
      const finalSize = cache.getStats().size;
      const removedCount = initialSize - finalSize + 1; // +1 for the new entry
      
      expect(removedCount).toBeGreaterThanOrEqual(9); // At least 9% removed
      expect(removedCount).toBeLessThanOrEqual(12); // At most 12% removed
    });
  });

  describe('Statistics Tracking', () => {
    it('should track cache hits and misses', () => {
      cache.set('hit-test', 'value', 60000);
      
      // Generate hits and misses
      cache.get('hit-test'); // hit
      cache.get('hit-test'); // hit
      cache.get('miss-test'); // miss
      cache.get('miss-test'); // miss
      cache.get('miss-test'); // miss
      
      const stats = cache.getStats();
      
      expect(stats.hitRate).toBe(40); // 2 hits out of 5 total
      expect(stats.missRate).toBe(60); // 3 misses out of 5 total
    });

    it('should handle zero requests correctly', () => {
      const stats = cache.getStats();
      
      expect(stats.hitRate).toBe(0);
      expect(stats.missRate).toBe(0);
    });

    it('should update stats correctly over time', () => {
      cache.set('stats-test', 'value', 60000);
      
      // Initial hits
      cache.get('stats-test');
      cache.get('stats-test');
      
      let stats = cache.getStats();
      expect(stats.hitRate).toBe(100);
      expect(stats.missRate).toBe(0);
      
      // Add some misses
      cache.get('non-existent-1');
      cache.get('non-existent-2');
      
      stats = cache.getStats();
      expect(stats.hitRate).toBe(50); // 2 hits out of 4 total
      expect(stats.missRate).toBe(50); // 2 misses out of 4 total
    });
  });

  describe('Clear and Reset', () => {
    it('should clear all cache entries and reset stats', () => {
      // Add some entries
      for (let i = 0; i < 10; i++) {
        cache.set(`key-${i}`, `value-${i}`, 60000);
      }
      
      // Generate some hits/misses for stats
      cache.get('key-0');
      cache.get('non-existent');
      
      expect(cache.getStats().size).toBe(10);
      expect(cache.getStats().hitRate).toBeGreaterThan(0);
      
      cache.clear();
      
      const stats = cache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.missRate).toBe(0);
      
      expect(mockConsole.info).toHaveBeenCalledWith('Cache cleared', {
        previousSize: 10,
      });
    });
  });

  describe('Cleanup Operations', () => {
    it('should run automatic cleanup on interval', () => {
      // Add some entries with short TTL
      cache.set('auto-expire-1', 'value1', 1000);
      cache.set('auto-expire-2', 'value2', 1000);
      cache.set('long-lived', 'value3', 60000);
      
      expect(cache.getStats().size).toBe(3);
      
      // Advance time to expire short TTL entries
      vi.advanceTimersByTime(2000);
      
      // Trigger the automatic cleanup interval (5 minutes)
      vi.advanceTimersByTime(5 * 60 * 1000);
      
      // Cleanup should have removed expired entries
      const stats = cache.getStats();
      expect(stats.size).toBeLessThan(3);
      expect(cache.has('long-lived')).toBe(true);
    });

    it('should cleanup expired entries manually', () => {
      cache.set('expire-soon', 'value1', 100);
      cache.set('expire-later', 'value2', 60000);
      
      vi.advanceTimersByTime(500);
      
      // Manual cleanup via accessing expired entry
      cache.get('expire-soon');
      
      expect(cache.has('expire-soon')).toBe(false);
      expect(cache.has('expire-later')).toBe(true);
    });
  });

  describe('Key Management', () => {
    it('should return all cache keys', () => {
      const keys = ['key1', 'key2', 'key3'];
      
      keys.forEach(key => {
        cache.set(key, `value-${key}`, 60000);
      });
      
      const retrievedKeys = cache.getKeys();
      
      expect(retrievedKeys).toHaveLength(3);
      expect(retrievedKeys.sort()).toEqual(keys.sort());
    });

    it('should return empty array when cache is empty', () => {
      const keys = cache.getKeys();
      
      expect(keys).toEqual([]);
    });
  });

  describe('Static Key Generation Methods', () => {
    it('should generate simple cache keys', () => {
      const key1 = MexcRequestCache.generateKey('GET', '/api/v3/ticker');
      const key2 = MexcRequestCache.generateKey('POST', '/api/v3/order');
      
      expect(key1).toBe('GET:/api/v3/ticker:');
      expect(key2).toBe('POST:/api/v3/order:');
      expect(key1).not.toBe(key2);
    });

    it('should generate cache keys with parameters', () => {
      const params = { symbol: 'BTCUSDT', limit: 10 };
      const key = MexcRequestCache.generateKey('GET', '/api/v3/ticker', params);
      
      expect(key).toBe('GET:/api/v3/ticker:{"symbol":"BTCUSDT","limit":10}');
    });

    it('should generate consistent keys for same inputs', () => {
      const params = { symbol: 'BTCUSDT', limit: 10 };
      const key1 = MexcRequestCache.generateKey('GET', '/api/v3/ticker', params);
      const key2 = MexcRequestCache.generateKey('GET', '/api/v3/ticker', params);
      
      expect(key1).toBe(key2);
    });

    it('should generate auth keys with time windows', () => {
      const mockTime = 1640995200000; // Fixed timestamp
      vi.setSystemTime(mockTime);
      
      const key1 = MexcRequestCache.generateAuthKey('GET', '/api/v3/account');
      const key2 = MexcRequestCache.generateAuthKey('GET', '/api/v3/account');
      
      expect(key1).toBe(key2); // Same time window
      expect(key1).toContain('auth:GET:/api/v3/account');
      expect(key1).toContain(':1640995200000'); // Windowed timestamp
    });

    it('should generate different auth keys for different time windows', () => {
      const mockTime = 1640995200000;
      vi.setSystemTime(mockTime);
      
      const key1 = MexcRequestCache.generateAuthKey('GET', '/api/v3/account');
      
      // Advance time by more than default window (60 seconds)
      vi.setSystemTime(mockTime + 70000);
      
      const key2 = MexcRequestCache.generateAuthKey('GET', '/api/v3/account');
      
      expect(key1).not.toBe(key2);
    });

    it('should support custom time windows for auth keys', () => {
      const mockTime = 1640995200000;
      vi.setSystemTime(mockTime);
      
      const shortWindow = 10000; // 10 seconds
      const key1 = MexcRequestCache.generateAuthKey('GET', '/api/v3/account', undefined, shortWindow);
      
      vi.setSystemTime(mockTime + 5000); // 5 seconds later
      const key2 = MexcRequestCache.generateAuthKey('GET', '/api/v3/account', undefined, shortWindow);
      
      expect(key1).toBe(key2); // Same window
      
      vi.setSystemTime(mockTime + 15000); // 15 seconds later
      const key3 = MexcRequestCache.generateAuthKey('GET', '/api/v3/account', undefined, shortWindow);
      
      expect(key1).not.toBe(key3); // Different window
    });
  });

  describe('Global Cache Management', () => {
    it('should return singleton global cache instance', () => {
      const cache1 = getGlobalCache();
      const cache2 = getGlobalCache();
      
      expect(cache1).toBe(cache2);
      expect(cache1).toBeInstanceOf(MexcRequestCache);
    });

    it('should create new instance after reset', () => {
      const cache1 = getGlobalCache();
      resetGlobalCache();
      const cache2 = getGlobalCache();
      
      expect(cache1).not.toBe(cache2);
      expect(cache2).toBeInstanceOf(MexcRequestCache);
    });

    it('should initialize global cache with default settings', () => {
      const globalCache = getGlobalCache();
      
      expect(globalCache['maxSize']).toBe(1000);
    });
  });

  describe('Cacheable Decorator', () => {
    class TestClass {
      @cacheable(5000)
      async expensiveOperation(param: string): Promise<string> {
        return `result-${param}-${Date.now()}`;
      }

      @cacheable()
      async defaultTtlOperation(param: number): Promise<number> {
        return param * 2;
      }
    }

    it('should cache method results', async () => {
      const testInstance = new TestClass();
      
      const result1 = await testInstance.expensiveOperation('test');
      const result2 = await testInstance.expensiveOperation('test');
      
      expect(result1).toBe(result2); // Should be cached
    });

    it('should cache different parameters separately', async () => {
      const testInstance = new TestClass();
      
      const result1 = await testInstance.expensiveOperation('param1');
      const result2 = await testInstance.expensiveOperation('param2');
      
      expect(result1).not.toBe(result2); // Different parameters
    });

    it('should respect TTL in decorator', async () => {
      const testInstance = new TestClass();
      
      const result1 = await testInstance.expensiveOperation('ttl-test');
      
      // Advance time beyond TTL
      vi.advanceTimersByTime(6000);
      
      const result2 = await testInstance.expensiveOperation('ttl-test');
      
      expect(result1).not.toBe(result2); // Cache should have expired
    });

    it('should use default TTL when not specified', async () => {
      const testInstance = new TestClass();
      
      const result1 = await testInstance.defaultTtlOperation(5);
      const result2 = await testInstance.defaultTtlOperation(5);
      
      expect(result1).toBe(result2);
      expect(result1).toBe(10);
    });
  });

  describe('Cache Warmer', () => {
    let mockApiClient: any;
    let warmer: CacheWarmer;

    beforeEach(() => {
      mockApiClient = {
        getServerTime: vi.fn().mockResolvedValue({ serverTime: Date.now() }),
        getExchangeInfo: vi.fn().mockResolvedValue({ symbols: [] }),
        getTicker24hr: vi.fn().mockResolvedValue({ tickers: [] }),
      };
      warmer = new CacheWarmer(cache);
    });

    it('should warm cache with common API calls', async () => {
      await warmer.warmCache(mockApiClient);
      
      expect(mockApiClient.getServerTime).toHaveBeenCalled();
      expect(mockApiClient.getExchangeInfo).toHaveBeenCalled();
      expect(mockApiClient.getTicker24hr).toHaveBeenCalled();
      
      expect(mockConsole.info).toHaveBeenCalledWith('Starting cache warm-up');
      expect(mockConsole.info).toHaveBeenCalledWith('Cache warm-up completed', {
        cacheStats: expect.any(Object),
      });
    });

    it('should handle warm-up errors gracefully', async () => {
      mockApiClient.getServerTime.mockRejectedValue(new Error('Network error'));
      
      await warmer.warmCache(mockApiClient);
      
      // Should still complete and log error
      expect(mockConsole.info).toHaveBeenCalledWith('Cache warm-up completed', {
        cacheStats: expect.any(Object),
      });
    });

    it('should use global cache when not provided', () => {
      const globalWarmer = new CacheWarmer();
      
      expect(globalWarmer['cache']).toBe(getGlobalCache());
    });

    it('should handle all API calls failing', async () => {
      mockApiClient.getServerTime.mockRejectedValue(new Error('Server error'));
      mockApiClient.getExchangeInfo.mockRejectedValue(new Error('Exchange error'));
      mockApiClient.getTicker24hr.mockRejectedValue(new Error('Ticker error'));
      
      await warmer.warmCache(mockApiClient);
      
      expect(mockConsole.info).toHaveBeenCalledWith('Starting cache warm-up');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle very large objects', () => {
      const largeObject = {
        data: new Array(1000).fill('large-data-string'),
        nested: {
          moreData: new Array(500).fill({ prop: 'value' }),
        },
      };
      
      cache.set('large-object', largeObject, 60000);
      const retrieved = cache.get('large-object');
      
      expect(retrieved).toEqual(largeObject);
    });

    it('should handle zero TTL gracefully', () => {
      cache.set('zero-ttl', 'value', 0);
      
      // Should immediately expire
      expect(cache.get('zero-ttl')).toBeNull();
    });

    it('should handle negative TTL', () => {
      cache.set('negative-ttl', 'value', -1000);
      
      // Should be treated as expired
      expect(cache.get('negative-ttl')).toBeNull();
    });

    it('should handle undefined and null values correctly', () => {
      cache.set('undefined-value', undefined, 60000);
      cache.set('null-value', null, 60000);
      
      expect(cache.get('undefined-value')).toBeUndefined();
      expect(cache.get('null-value')).toBeNull();
      expect(cache.has('undefined-value')).toBe(true);
      expect(cache.has('null-value')).toBe(true);
    });

    it('should handle circular references in cache key generation', () => {
      const circularObj: any = { prop: 'value' };
      circularObj.self = circularObj;
      
      expect(() => {
        MexcRequestCache.generateKey('GET', '/test', circularObj);
      }).toThrow(); // JSON.stringify should throw on circular references
    });

    it('should handle empty strings as keys', () => {
      cache.set('', 'empty-key-value', 60000);
      
      expect(cache.get('')).toBe('empty-key-value');
      expect(cache.has('')).toBe(true);
    });

    it('should maintain performance with many entries', () => {
      const startTime = Date.now();
      
      // Add many entries
      for (let i = 0; i < 1000; i++) {
        cache.set(`perf-key-${i}`, `value-${i}`, 60000);
      }
      
      const insertTime = Date.now() - startTime;
      
      // Retrieve many entries
      const retrieveStart = Date.now();
      for (let i = 0; i < 1000; i++) {
        cache.get(`perf-key-${i}`);
      }
      const retrieveTime = Date.now() - retrieveStart;
      
      // Basic performance check - should be reasonably fast
      expect(insertTime).toBeLessThan(1000); // Less than 1 second
      expect(retrieveTime).toBeLessThan(500); // Less than 0.5 seconds
    });
  });
});