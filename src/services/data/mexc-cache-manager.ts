/**
 * MEXC Cache Manager
 *
 * Extracted from unified-mexc-service.ts for better modularity.
 * Handles all caching functionality including response caching and cache statistics.
 *
 * Features:
 * - TTL-based response caching
 * - Automatic cache cleanup
 * - Cache statistics and metrics
 * - Key generation and management
 * - Memory-efficient storage
 */

import * as crypto from "node:crypto";

// ============================================================================
// Cache Types and Interfaces
// ============================================================================

export interface CachedResponse {
  data: any;
  timestamp: number;
  expiresAt: number;
}

export interface CacheStats {
  size: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  totalMemoryUsage: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

export interface CacheConfig {
  defaultTTL: number;
  maxSize: number;
  cleanupInterval: number;
  enableAutoCleanup: boolean;
}

// ============================================================================
// MEXC Response Cache Implementation
// ============================================================================

/**
 * High-performance cache for MEXC API responses
 * Optimized for memory usage and fast lookups
 */
export class MexcResponseCache {
  private cache = new Map<string, CachedResponse>();
  private hitCount = 0;
  private missCount = 0;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTTL: config.defaultTTL || 30000, // 30 seconds
      maxSize: config.maxSize || 1000,
      cleanupInterval: config.cleanupInterval || 60000, // 1 minute
      enableAutoCleanup: config.enableAutoCleanup ?? true,
    };

    if (this.config.enableAutoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * Store data in cache with TTL
   */
  set(key: string, data: any, ttl?: number): void {
    const now = Date.now();
    const effectiveTTL = ttl || this.config.defaultTTL;

    // If cache is at max size, remove oldest entry
    if (this.cache.size >= this.config.maxSize) {
      this.removeOldestEntry();
    }

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + effectiveTTL,
    });
  }

  /**
   * Retrieve data from cache
   */
  get(key: string): any | null {
    const cached = this.cache.get(key);

    if (!cached) {
      this.missCount++;
      return null;
    }

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }

    this.hitCount++;
    return cached.data;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Remove specific key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Generate cache key from endpoint and parameters
   */
  generateKey(endpoint: string, params?: any): string {
    const paramsStr = params ? JSON.stringify(params) : "";
    const combined = `${endpoint}:${paramsStr}`;
    return crypto.createHash("md5").update(combined).digest("hex");
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? this.hitCount / totalRequests : 0;

    // Calculate memory usage (approximate)
    let totalMemoryUsage = 0;
    let oldestEntry: number | null = null;
    let newestEntry: number | null = null;

    for (const cached of this.cache.values()) {
      // Rough memory calculation
      totalMemoryUsage += JSON.stringify(cached.data).length * 2; // UTF-16 encoding

      if (oldestEntry === null || cached.timestamp < oldestEntry) {
        oldestEntry = cached.timestamp;
      }
      if (newestEntry === null || cached.timestamp > newestEntry) {
        newestEntry = cached.timestamp;
      }
    }

    return {
      size: this.cache.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate,
      totalMemoryUsage,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Get all cache keys (for debugging)
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache entries by pattern
   */
  getKeysByPattern(pattern: RegExp): string[] {
    return Array.from(this.cache.keys()).filter((key) => pattern.test(key));
  }

  /**
   * Remove expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, cached] of this.cache) {
      if (now > cached.expiresAt) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Get cache efficiency metrics
   */
  getEfficiencyMetrics(): {
    hitRate: number;
    memoryEfficiency: number;
    averageEntryAge: number;
    expirationRate: number;
  } {
    const stats = this.getStats();
    const now = Date.now();

    let totalAge = 0;
    let expiredCount = 0;

    for (const cached of this.cache.values()) {
      totalAge += now - cached.timestamp;
      if (now > cached.expiresAt) {
        expiredCount++;
      }
    }

    const averageEntryAge =
      this.cache.size > 0 ? totalAge / this.cache.size : 0;
    const expirationRate =
      this.cache.size > 0 ? expiredCount / this.cache.size : 0;
    const memoryEfficiency =
      stats.totalMemoryUsage > 0
        ? stats.hitCount / (stats.totalMemoryUsage / 1024)
        : 0;

    return {
      hitRate: stats.hitRate,
      memoryEfficiency,
      averageEntryAge,
      expirationRate,
    };
  }

  /**
   * Optimize cache by removing expired and least recently used entries
   */
  optimize(): {
    removedExpired: number;
    removedLRU: number;
    finalSize: number;
  } {
    const removedExpired = this.cleanup();
    let removedLRU = 0;

    // If still over capacity, remove LRU entries
    if (this.cache.size > this.config.maxSize) {
      const entries = Array.from(this.cache.entries()).sort(
        ([, a], [, b]) => a.timestamp - b.timestamp
      );

      const toRemove = this.cache.size - this.config.maxSize;
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
        removedLRU++;
      }
    }

    return {
      removedExpired,
      removedLRU,
      finalSize: this.cache.size,
    };
  }

  /**
   * Start automatic cleanup timer
   */
  private startAutoCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Stop automatic cleanup timer
   */
  stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Remove oldest entry when cache is full
   */
  private removeOldestEntry(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Number.MAX_SAFE_INTEGER;

    for (const [key, cached] of this.cache) {
      if (cached.timestamp < oldestTimestamp) {
        oldestTimestamp = cached.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Destroy cache and cleanup resources
   */
  destroy(): void {
    this.stopAutoCleanup();
    this.clear();
  }
}

// ============================================================================
// Cache Factory and Utilities
// ============================================================================

/**
 * Create a new cache instance with optimized defaults for MEXC API
 */
export function createMexcCache(
  config?: Partial<CacheConfig>
): MexcResponseCache {
  const defaultConfig: Partial<CacheConfig> = {
    defaultTTL: 30000, // 30 seconds for API responses
    maxSize: 500, // Reasonable size for MEXC data
    cleanupInterval: 60000, // Clean up every minute
    enableAutoCleanup: true,
  };

  return new MexcResponseCache({ ...defaultConfig, ...config });
}

/**
 * Create a specialized cache for different data types
 */
export function createSpecializedCache(
  type: "calendar" | "symbols" | "balance" | "ticker"
): MexcResponseCache {
  const configs = {
    calendar: {
      defaultTTL: 300000, // 5 minutes - calendar data changes infrequently
      maxSize: 100,
    },
    symbols: {
      defaultTTL: 60000, // 1 minute - symbol data is relatively stable
      maxSize: 200,
    },
    balance: {
      defaultTTL: 10000, // 10 seconds - balance changes frequently
      maxSize: 50,
    },
    ticker: {
      defaultTTL: 5000, // 5 seconds - ticker data changes very frequently
      maxSize: 1000,
    },
  };

  return createMexcCache(configs[type]);
}

// ============================================================================
// Cache Decorator for Method Caching
// ============================================================================

/**
 * Decorator for automatic method result caching
 */
export function cacheResult(ttl = 30000) {
  return (
    _target: any,
    _propertyName: string,
    descriptor: PropertyDescriptor
  ) => {
    const method = descriptor.value;
    const cache = new Map<string, CachedResponse>();

    descriptor.value = async function (...args: any[]) {
      const key = crypto
        .createHash("md5")
        .update(JSON.stringify(args))
        .digest("hex");
      const cached = cache.get(key);
      const now = Date.now();

      if (cached && now < cached.expiresAt) {
        return cached.data;
      }

      const result = await method.apply(this, args);

      cache.set(key, {
        data: result,
        timestamp: now,
        expiresAt: now + ttl,
      });

      return result;
    };

    return descriptor;
  };
}

// ============================================================================
// Global Cache Instance Management
// ============================================================================

let globalMexcCache: MexcResponseCache | null = null;

/**
 * Get or create the global MEXC cache instance
 */
export function getGlobalMexcCache(): MexcResponseCache {
  if (!globalMexcCache) {
    globalMexcCache = createMexcCache();
  }
  return globalMexcCache;
}

/**
 * Reset the global cache instance
 */
export function resetGlobalMexcCache(): void {
  if (globalMexcCache) {
    globalMexcCache.destroy();
    globalMexcCache = null;
  }
}

/**
 * Get combined statistics from all cache instances
 */
export function getGlobalCacheStats(): CacheStats {
  if (!globalMexcCache) {
    return {
      size: 0,
      hitCount: 0,
      missCount: 0,
      hitRate: 0,
      totalMemoryUsage: 0,
      oldestEntry: null,
      newestEntry: null,
    };
  }

  return globalMexcCache.getStats();
}
