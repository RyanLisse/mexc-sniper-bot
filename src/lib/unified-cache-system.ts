/**
 * Unified Cache System
 * 
 * Provides a unified caching interface across the application with support for
 * multiple cache strategies, TTL management, and category-based organization.
 */

import { Cache, CacheOptions } from './cache';

export interface UnifiedCacheOptions extends CacheOptions {
  categories?: string[];
  globalTTL?: number;
  categoryTTLs?: Record<string, number>;
}

export interface CacheEntry<T = any> {
  value: T;
  expires: number;
  category: string;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
}

export class UnifiedCacheSystem {
  private caches: Map<string, Cache> = new Map();
  private globalOptions: Required<UnifiedCacheOptions>;
  private stats: {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
  } = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
  };

  constructor(options: UnifiedCacheOptions = {}) {
    this.globalOptions = {
      ttl: options.ttl || 5 * 60 * 1000, // 5 minutes
      maxSize: options.maxSize || 1000,
      onEvict: options.onEvict || (() => {}),
      categories: options.categories || ['default'],
      globalTTL: options.globalTTL || 5 * 60 * 1000,
      categoryTTLs: options.categoryTTLs || {},
    };

    // Initialize default cache
    this.getOrCreateCache('default');
  }

  /**
   * Get or create a cache for a specific category
   */
  private getOrCreateCache(category: string): Cache {
    if (!this.caches.has(category)) {
      const categoryTTL = this.globalOptions.categoryTTLs[category] || this.globalOptions.globalTTL;
      this.caches.set(category, new Cache({
        ttl: categoryTTL,
        maxSize: this.globalOptions.maxSize,
        onEvict: this.globalOptions.onEvict,
      }));
    }
    return this.caches.get(category)!;
  }

  /**
   * Store a value in the cache
   */
  async set<T>(key: string, value: T, category: string = 'default', ttl?: number): Promise<void> {
    const cache = this.getOrCreateCache(category);
    cache.set(key, value, ttl);
    this.stats.sets++;
  }

  /**
   * Retrieve a value from the cache
   */
  async get<T>(key: string, category: string = 'default'): Promise<T | undefined> {
    const cache = this.getOrCreateCache(category);
    const value = cache.get(key);
    
    if (value !== undefined) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
    
    return value;
  }

  /**
   * Check if a key exists in the cache
   */
  async has(key: string, category: string = 'default'): Promise<boolean> {
    const cache = this.getOrCreateCache(category);
    return cache.has(key);
  }

  /**
   * Delete a value from the cache
   */
  async delete(key: string, category: string = 'default'): Promise<boolean> {
    const cache = this.getOrCreateCache(category);
    const deleted = cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
    }
    return deleted;
  }

  /**
   * Clear all caches or a specific category
   */
  async clear(category?: string): Promise<void> {
    if (category) {
      const cache = this.caches.get(category);
      if (cache) {
        cache.clear();
      }
    } else {
      for (const cache of this.caches.values()) {
        cache.clear();
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    global: typeof this.stats;
    categories: Record<string, { size: number; keys: string[] }>;
    hitRate: number;
    totalSize: number;
  } {
    const categories: Record<string, { size: number; keys: string[] }> = {};
    let totalSize = 0;

    for (const [category, cache] of this.caches) {
      categories[category] = {
        size: cache.size(),
        keys: cache.keys(),
      };
      totalSize += cache.size();
    }

    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? this.stats.hits / (this.stats.hits + this.stats.misses) 
      : 0;

    return {
      global: { ...this.stats },
      categories,
      hitRate,
      totalSize,
    };
  }

  /**
   * Get all cache categories
   */
  getCategories(): string[] {
    return Array.from(this.caches.keys());
  }

  /**
   * Cleanup expired entries across all caches
   */
  cleanup(): void {
    for (const cache of this.caches.values()) {
      cache.cleanup();
    }
  }

  /**
   * Get cache size for a specific category
   */
  getCategorySize(category: string): number {
    const cache = this.caches.get(category);
    return cache ? cache.size() : 0;
  }

  /**
   * Get all keys for a specific category
   */
  getCategoryKeys(category: string): string[] {
    const cache = this.caches.get(category);
    return cache ? cache.keys() : [];
  }

  /**
   * Get all values for a specific category
   */
  getCategoryValues<T>(category: string): T[] {
    const cache = this.caches.get(category);
    return cache ? cache.values() : [];
  }
}

// Global unified cache instance
const globalUnifiedCache = new UnifiedCacheSystem({
  maxSize: 10000,
  globalTTL: 5 * 60 * 1000, // 5 minutes
  categoryTTLs: {
    config: 10 * 60 * 1000, // 10 minutes for config
    api: 2 * 60 * 1000, // 2 minutes for API responses
    patterns: 15 * 60 * 1000, // 15 minutes for patterns
    trading: 30 * 1000, // 30 seconds for trading data
    metrics: 60 * 1000, // 1 minute for metrics
  },
});

/**
 * Get the global unified cache instance
 */
export function getUnifiedCache(): UnifiedCacheSystem {
  return globalUnifiedCache;
}

/**
 * Helper function to create a new cache instance
 */
export function createUnifiedCache(options?: UnifiedCacheOptions): UnifiedCacheSystem {
  return new UnifiedCacheSystem(options);
}

// Types are already exported inline above