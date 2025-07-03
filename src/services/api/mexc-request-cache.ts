/**
 * MEXC Request Cache System
 *
 * Caching layer for MEXC API requests to improve performance and reduce API calls.
 * Extracted from unified-mexc-client.ts for better modularity.
 */

import type { CacheEntry, CacheStats } from "./mexc-client-types";

// ============================================================================
// Request Cache Implementation
// ============================================================================

export class MexcRequestCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize: number;
  private hitCount = 0;
  private missCount = 0;
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[mexc-request-cache]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[mexc-request-cache]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error(
        "[mexc-request-cache]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: any) =>
      console.debug("[mexc-request-cache]", message, context || ""),
  };

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;

    // Cleanup expired entries every 5 minutes
    setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000
    );
  }

  /**
   * Store data in cache with TTL
   */
  set<T>(key: string, data: T, ttl: number): void {
    // Clean up if cache is getting too large
    if (this.cache.size >= this.maxSize) {
      this.cleanup();

      // If still at max size after cleanup, remove oldest entries
      if (this.cache.size >= this.maxSize) {
        this.removeOldestEntries(Math.floor(this.maxSize * 0.1)); // Remove 10%
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Retrieve data from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.missCount++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.missCount++;
      this.logger.debug("Cache expired", {
        key,
        age: Date.now() - entry.timestamp,
      });
      return null;
    }

    this.hitCount++;
    this.logger.debug("Cache hit", { key, age: Date.now() - entry.timestamp });
    return entry.data;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Remove specific key from cache
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    if (result) {
    }
    return result;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const previousSize = this.cache.size;
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;

    console.info("Cache cleared", { previousSize });
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.hitCount + this.missCount;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: totalRequests > 0 ? (this.hitCount / totalRequests) * 100 : 0,
      missRate: totalRequests > 0 ? (this.missCount / totalRequests) * 100 : 0,
    };
  }

  /**
   * Get cache keys (for debugging)
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    const removedCount = expiredKeys.length;
    expiredKeys.forEach((key) => this.cache.delete(key));

    if (removedCount > 0) {
    }
  }

  /**
   * Remove oldest entries when cache is full
   */
  private removeOldestEntries(count: number): void {
    const entries = Array.from(this.cache.entries()).sort(
      ([, a], [, b]) => a.timestamp - b.timestamp
    );

    const toRemove = entries.slice(0, count);

    for (const [key] of toRemove) {
      this.cache.delete(key);
    }
  }

  /**
   * Generate cache key for API requests
   */
  static generateKey(
    method: string,
    url: string,
    params?: Record<string, unknown>
  ): string {
    const paramsStr = params ? JSON.stringify(params) : "";
    return `${method}:${url}:${paramsStr}`;
  }

  /**
   * Generate cache key for authenticated requests (includes timestamp window)
   */
  static generateAuthKey(
    method: string,
    url: string,
    params?: Record<string, unknown>,
    timeWindow = 60000 // 1 minute window for auth requests
  ): string {
    const windowedTime = Math.floor(Date.now() / timeWindow) * timeWindow;
    const paramsStr = params ? JSON.stringify(params) : "";
    return `auth:${method}:${url}:${paramsStr}:${windowedTime}`;
  }
}

// ============================================================================
// Global Cache Instance
// ============================================================================

let globalCache: MexcRequestCache | null = null;

/**
 * Get the global cache instance
 */
export function getGlobalCache(): MexcRequestCache {
  if (!globalCache) {
    globalCache = new MexcRequestCache(1000); // Default max size
    // Note: Global cache initialized
  }
  return globalCache;
}

/**
 * Reset global cache (for testing)
 */
export function resetGlobalCache(): void {
  globalCache = null;
  // Note: Global MEXC cache reset
}

// ============================================================================
// Cache Utilities
// ============================================================================

/**
 * Cache decorator for methods
 */
export function cacheable(ttl: number = 60000) {
  return (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const cache = getGlobalCache();
      const cacheKey = `${(target as any).constructor.name}:${propertyKey}:${JSON.stringify(args)}`;

      // Try to get from cache first
      const cached = cache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // Execute original method
      const result = await originalMethod.apply(this, args);

      // Cache the result
      cache.set(cacheKey, result, ttl);

      return result;
    };

    return descriptor;
  };
}

/**
 * Cache warmer utility
 */
export class CacheWarmer {
  private cache: MexcRequestCache;

  constructor(cache?: MexcRequestCache) {
    this.cache = cache || getGlobalCache();
  }

  /**
   * Pre-warm cache with common API calls
   */
  async warmCache(apiClient: {
    getServerTime: () => Promise<unknown>;
    getExchangeInfo: () => Promise<unknown>;
    getTicker24hr: () => Promise<unknown>;
  }): Promise<void> {
    try {
      console.info("Starting cache warm-up");

      const warmupTasks = [
        apiClient.getServerTime(),
        apiClient.getExchangeInfo(),
        apiClient.getTicker24hr(),
      ];

      await Promise.allSettled(warmupTasks);

      console.info("Cache warm-up completed", {
        cacheStats: this.cache.getStats(),
      });
    } catch (error) {
      console.error("Cache warm-up failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
