/**
 * Unit tests for cache
 * Tests cache functionality, TTL, eviction, and utility functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Cache,
  CacheManager,
  LRUCache,
  generateCacheKey,
  defaultCache,
  globalCacheManager,
  type CacheOptions,
} from '../../../src/lib/cache';

describe('Cache', () => {
  let cache: Cache<string>;
  let mockEvictCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockEvictCallback = vi.fn();
    cache = new Cache<string>({ onEvict: mockEvictCallback });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const defaultCache = new Cache();
      
      expect(defaultCache.size()).toBe(0);
      expect(defaultCache.keys()).toEqual([]);
    });

    it('should initialize with custom options', () => {
      const customCache = new Cache({
        ttl: 10000,
        maxSize: 100,
        onEvict: mockEvictCallback,
      });
      
      expect(customCache).toBeDefined();
      expect(customCache.size()).toBe(0);
    });
  });

  describe('set and get', () => {
    it('should set and retrieve values', () => {
      cache.set('key1', 'value1');
      
      expect(cache.get('key1')).toBe('value1');
      expect(cache.size()).toBe(1);
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should override existing values', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      
      expect(cache.get('key1')).toBe('value2');
      expect(cache.size()).toBe(1);
    });

    it('should handle custom TTL', () => {
      const customTTL = 2000;
      cache.set('key1', 'value1', customTTL);
      
      expect(cache.get('key1')).toBe('value1');
      
      // Fast forward time past custom TTL
      vi.advanceTimersByTime(customTTL + 1);
      
      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('TTL and expiration', () => {
    it('should expire entries after TTL', () => {
      const customCache = new Cache({ ttl: 1000 });
      customCache.set('key1', 'value1');
      
      expect(customCache.get('key1')).toBe('value1');
      
      // Fast forward time past TTL
      vi.advanceTimersByTime(1001);
      
      expect(customCache.get('key1')).toBeUndefined();
      expect(customCache.size()).toBe(0);
    });

    it('should not expire entries before TTL', () => {
      const customCache = new Cache({ ttl: 1000 });
      customCache.set('key1', 'value1');
      
      // Fast forward time but not past TTL
      vi.advanceTimersByTime(999);
      
      expect(customCache.get('key1')).toBe('value1');
      expect(customCache.size()).toBe(1);
    });
  });

  describe('has', () => {
    it('should return true for existing keys', () => {
      cache.set('key1', 'value1');
      
      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should return false for expired keys', () => {
      const customCache = new Cache({ ttl: 1000 });
      customCache.set('key1', 'value1');
      
      expect(customCache.has('key1')).toBe(true);
      
      vi.advanceTimersByTime(1001);
      
      expect(customCache.has('key1')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete existing keys', () => {
      cache.set('key1', 'value1');
      
      const deleted = cache.delete('key1');
      
      expect(deleted).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.size()).toBe(0);
    });

    it('should return false for non-existent keys', () => {
      const deleted = cache.delete('nonexistent');
      
      expect(deleted).toBe(false);
    });

    it('should call onEvict callback when deleting', () => {
      cache.set('key1', 'value1');
      cache.delete('key1');
      
      expect(mockEvictCallback).toHaveBeenCalledWith('key1', 'value1');
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.clear();
      
      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });

    it('should call onEvict for all entries when clearing', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.clear();
      
      expect(mockEvictCallback).toHaveBeenCalledTimes(2);
      expect(mockEvictCallback).toHaveBeenCalledWith('key1', 'value1');
      expect(mockEvictCallback).toHaveBeenCalledWith('key2', 'value2');
    });
  });

  describe('size', () => {
    it('should return 0 for empty cache', () => {
      expect(cache.size()).toBe(0);
    });

    it('should return correct size after adding entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      expect(cache.size()).toBe(2);
    });

    it('should update size after deletion', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.delete('key1');
      
      expect(cache.size()).toBe(1);
    });
  });

  describe('keys', () => {
    it('should return empty array for empty cache', () => {
      expect(cache.keys()).toEqual([]);
    });

    it('should return all keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const keys = cache.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toHaveLength(2);
    });
  });

  describe('values', () => {
    it('should return empty array for empty cache', () => {
      expect(cache.values()).toEqual([]);
    });

    it('should return all values', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      const values = cache.values();
      expect(values).toContain('value1');
      expect(values).toContain('value2');
      expect(values).toHaveLength(2);
    });

    it('should clean up expired entries when getting values', () => {
      const customCache = new Cache({ ttl: 1000, onEvict: mockEvictCallback });
      customCache.set('key1', 'value1');
      customCache.set('key2', 'value2');
      
      vi.advanceTimersByTime(1001);
      
      const values = customCache.values();
      expect(values).toEqual([]);
      expect(mockEvictCallback).toHaveBeenCalledTimes(2);
    });
  });

  describe('eviction', () => {
    it('should evict oldest entry when maxSize is reached', () => {
      const smallCache = new Cache({ maxSize: 2, onEvict: mockEvictCallback });
      
      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      
      // This should evict key1
      smallCache.set('key3', 'value3');
      
      expect(smallCache.size()).toBe(2);
      expect(smallCache.get('key1')).toBeUndefined();
      expect(smallCache.get('key2')).toBe('value2');
      expect(smallCache.get('key3')).toBe('value3');
      expect(mockEvictCallback).toHaveBeenCalledWith('key1', 'value1');
    });

    it('should not evict when updating existing key', () => {
      const smallCache = new Cache({ maxSize: 2, onEvict: mockEvictCallback });
      
      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      
      // Update existing key - should not evict
      smallCache.set('key1', 'newvalue1');
      
      expect(smallCache.size()).toBe(2);
      expect(smallCache.get('key1')).toBe('newvalue1');
      expect(smallCache.get('key2')).toBe('value2');
      expect(mockEvictCallback).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', () => {
      const customCache = new Cache({ ttl: 1000, onEvict: mockEvictCallback });
      
      customCache.set('key1', 'value1');
      customCache.set('key2', 'value2');
      
      // Expire key1
      vi.advanceTimersByTime(1001);
      
      customCache.cleanup();
      
      expect(customCache.size()).toBe(0);
      expect(mockEvictCallback).toHaveBeenCalledTimes(2);
    });

    it('should not remove non-expired entries', () => {
      const customCache = new Cache({ ttl: 1000 });
      
      customCache.set('key1', 'value1');
      customCache.set('key2', 'value2');
      
      // Not expired yet
      vi.advanceTimersByTime(999);
      
      customCache.cleanup();
      
      expect(customCache.size()).toBe(2);
      expect(customCache.get('key1')).toBe('value1');
      expect(customCache.get('key2')).toBe('value2');
    });
  });
});

describe('CacheManager', () => {
  it('should extend Cache class', () => {
    const cacheManager = new CacheManager();
    
    expect(cacheManager).toBeInstanceOf(Cache);
    expect(cacheManager).toBeInstanceOf(CacheManager);
  });

  it('should work with custom options', () => {
    const cacheManager = new CacheManager({ ttl: 10000, maxSize: 100 });
    
    cacheManager.set('key1', 'value1');
    expect(cacheManager.get('key1')).toBe('value1');
  });
});

describe('LRUCache', () => {
  it('should extend Cache class', () => {
    const lruCache = new LRUCache();
    
    expect(lruCache).toBeInstanceOf(Cache);
    expect(lruCache).toBeInstanceOf(LRUCache);
  });

  it('should work with custom options', () => {
    const lruCache = new LRUCache({ ttl: 10000, maxSize: 100 });
    
    lruCache.set('key1', 'value1');
    expect(lruCache.get('key1')).toBe('value1');
  });
});

describe('generateCacheKey', () => {
  it('should generate key from multiple components', () => {
    const key = generateCacheKey('prefix', 'user', 123);
    expect(key).toBe('prefix:user:123');
  });

  it('should handle empty components', () => {
    const key = generateCacheKey();
    expect(key).toBe('');
  });

  it('should filter out undefined and null values', () => {
    const key = generateCacheKey('prefix', undefined, 'user', null, 123);
    expect(key).toBe('prefix:user:123');
  });

  it('should handle zero values', () => {
    const key = generateCacheKey('prefix', 0, 'user');
    expect(key).toBe('prefix:0:user');
  });

  it('should handle single component', () => {
    const key = generateCacheKey('single');
    expect(key).toBe('single');
  });

  it('should convert numbers to strings', () => {
    const key = generateCacheKey(123, 456);
    expect(key).toBe('123:456');
  });
});

describe('Global instances', () => {
  it('should provide default cache instance', () => {
    expect(defaultCache).toBeInstanceOf(Cache);
  });

  it('should provide global cache manager instance', () => {
    expect(globalCacheManager).toBeInstanceOf(CacheManager);
    expect(globalCacheManager).toBeInstanceOf(Cache);
  });

  it('should work with global instances', () => {
    globalCacheManager.set('test-key', 'test-value');
    expect(globalCacheManager.get('test-key')).toBe('test-value');
    
    globalCacheManager.clear(); // Clean up
  });
});

describe('Type safety', () => {
  it('should work with typed cache', () => {
    const numberCache = new Cache<number>();
    
    numberCache.set('key1', 123);
    const value = numberCache.get('key1');
    
    expect(value).toBe(123);
    expect(typeof value).toBe('number');
  });

  it('should work with complex types', () => {
    interface User {
      id: number;
      name: string;
    }
    
    const userCache = new Cache<User>();
    const user: User = { id: 1, name: 'John' };
    
    userCache.set('user1', user);
    const retrievedUser = userCache.get('user1');
    
    expect(retrievedUser).toEqual(user);
  });
});

describe('Error handling', () => {
  it('should handle invalid keys gracefully', () => {
    const cache = new Cache();
    
    // These should not throw errors
    expect(() => cache.get('')).not.toThrow();
    expect(() => cache.set('', 'value')).not.toThrow();
    expect(() => cache.delete('')).not.toThrow();
    expect(() => cache.has('')).not.toThrow();
  });

  it('should handle errors in eviction callback', () => {
    const errorEvictCallback = vi.fn(() => {
      throw new Error('Eviction error');
    });
    
    const cache = new Cache({ onEvict: errorEvictCallback });
    
    cache.set('key1', 'value1');
    
    // The current implementation will throw if onEvict throws
    expect(() => cache.delete('key1')).toThrow('Eviction error');
    expect(errorEvictCallback).toHaveBeenCalledWith('key1', 'value1');
  });
});