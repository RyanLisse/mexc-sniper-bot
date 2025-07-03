/**
 * MEXC Cache Layer
 *
 * Intelligent caching system for MEXC API responses.
 * Provides different TTL strategies for different data types.
 */

import type { MexcCacheConfig, MexcServiceResponse } from "./mexc-api-types";

// ============================================================================
// Cache Entry Types
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletions: number;
  evictions: number;
  totalRequests: number;
}

// ============================================================================
// Cache Configuration
// ============================================================================

const CACHE_TTL_PROFILES = {
  // Real-time data - short cache
  realTime: 15 * 1000, // 15 seconds

  // Semi-static data - medium cache
  semiStatic: 5 * 60 * 1000, // 5 minutes

  // Static data - long cache
  static: 30 * 60 * 1000, // 30 minutes

  // User-specific data
  user: 10 * 60 * 1000, // 10 minutes
} as const;

// ============================================================================
// Smart Cache Implementation
// ============================================================================

export class MexcCacheLayer {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[mexc-cache-layer]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[mexc-cache-layer]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[mexc-cache-layer]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[mexc-cache-layer]", message, context || ""),
  };

  private cache = new Map<string, CacheEntry<any>>();
  private config: MexcCacheConfig;
  private metrics: CacheMetrics;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: MexcCacheConfig) {
    this.config = config;
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletions: 0,
      evictions: 0,
      totalRequests: 0,
    };

    // Start cleanup process every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000
    );
  }

  // ============================================================================
  // Core Cache Operations
  // ============================================================================

  /**
   * Get data from cache with automatic TTL handling
   */
  get<T>(key: string): T | null {
    this.metrics.totalRequests++;

    const entry = this.cache.get(key);

    if (!entry) {
      this.metrics.misses++;
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.metrics.misses++;
      this.metrics.evictions++;
      return null;
    }

    this.metrics.hits++;
    return entry.data;
  }

  /**
   * Set data in cache with appropriate TTL
   */
  set<T>(
    key: string,
    data: T,
    ttlType: keyof typeof CACHE_TTL_PROFILES = "semiStatic"
  ): void {
    const ttl = CACHE_TTL_PROFILES[ttlType];

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      key,
    };

    this.cache.set(key, entry);
    this.metrics.sets++;
  }

  /**
   * Set data in cache with custom TTL
   */
  setWithCustomTTL<T>(key: string, data: T, customTTL?: number): void {
    const ttl =
      customTTL ?? this.config.cacheTTL ?? CACHE_TTL_PROFILES.semiStatic;

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      key,
    };

    this.cache.set(key, entry);
    this.metrics.sets++;
  }

  /**
   * Delete specific cache entry
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.metrics.deletions++;
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.metrics.deletions += size;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const data = this.get(key);
    return data !== null;
  }

  // ============================================================================
  // Smart Cache Wrappers
  // ============================================================================

  /**
   * Wrap an async function with intelligent caching
   */
  wrapWithCache<T>(
    key: string,
    fn: () => Promise<MexcServiceResponse<T>>,
    ttlType: keyof typeof CACHE_TTL_PROFILES = "semiStatic"
  ): () => Promise<MexcServiceResponse<T>> {
    return async () => {
      // Try cache first
      const cached = this.get<MexcServiceResponse<T>>(key);
      if (cached) {
        return {
          ...cached,
          source: `${cached.source}-cached`,
        };
      }

      // Execute function and cache result
      const result = await fn();

      // Only cache successful responses
      if (result.success) {
        this.set(key, result, ttlType);
      }

      return result;
    };
  }

  /**
   * Wrap function with custom TTL caching logic
   */
  wrapWithCacheCustomTTL<T>(
    key: string,
    fn: () => Promise<MexcServiceResponse<T>>,
    customTTL?: number
  ): () => Promise<MexcServiceResponse<T>> {
    return async () => {
      // Try cache first
      const cached = this.get<MexcServiceResponse<T>>(key);
      if (cached) {
        return {
          ...cached,
          source: `${cached.source}-cached`,
        };
      }

      // Execute function and cache result
      const result = await fn();

      // Only cache successful responses
      if (result.success) {
        this.setWithCustomTTL(key, result, customTTL);
      }

      return result;
    };
  }

  /**
   * Get or set pattern for common cache operations
   */
  async getOrSet<T>(
    key: string,
    fn: () => Promise<MexcServiceResponse<T>>,
    ttlType: keyof typeof CACHE_TTL_PROFILES = "semiStatic"
  ): Promise<MexcServiceResponse<T>> {
    const wrapped = this.wrapWithCache(key, fn, ttlType);
    return wrapped();
  }

  /**
   * Get data from cache or execute function with custom TTL
   */
  async getOrSetWithCustomTTL<T>(
    key: string,
    fn: () => Promise<MexcServiceResponse<T>>,
    customTTL?: number
  ): Promise<MexcServiceResponse<T>> {
    const wrapped = this.wrapWithCacheCustomTTL(key, fn, customTTL);
    return wrapped();
  }

  // ============================================================================
  // Cache Invalidation Strategies
  // ============================================================================

  /**
   * Invalidate cache entries by pattern
   */
  invalidateByPattern(pattern: string): number {
    let invalidated = 0;

    Array.from(this.cache.keys()).forEach((key) => {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        invalidated++;
      }
    });

    this.metrics.deletions += invalidated;
    return invalidated;
  }

  /**
   * Invalidate all calendar-related cache
   */
  invalidateCalendar(): number {
    return this.invalidateByPattern("calendar");
  }

  /**
   * Invalidate all symbol-related cache
   */
  invalidateSymbols(): number {
    return this.invalidateByPattern("symbols");
  }

  /**
   * Invalidate all user-specific cache
   */
  invalidateUserData(): number {
    return (
      this.invalidateByPattern("account") +
      this.invalidateByPattern("balance") +
      this.invalidateByPattern("portfolio")
    );
  }

  // ============================================================================
  // Cache Maintenance
  // ============================================================================

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      this.metrics.evictions += cleaned;
      console.info(`[MexcCacheLayer] Cleaned up ${cleaned} expired entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getMetrics(): CacheMetrics & { hitRate: number; size: number } {
    const hitRate =
      this.metrics.totalRequests > 0
        ? (this.metrics.hits / this.metrics.totalRequests) * 100
        : 0;

    return {
      ...this.metrics,
      hitRate: Math.round(hitRate * 100) / 100,
      size: this.cache.size,
    };
  }

  /**
   * Reset cache metrics
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletions: 0,
      evictions: 0,
      totalRequests: 0,
    };
  }

  // ============================================================================
  // Lifecycle Management
  // ============================================================================

  /**
   * Destroy cache and cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    this.clear();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new MEXC cache layer instance
 */
export function createMexcCacheLayer(config: MexcCacheConfig): MexcCacheLayer {
  return new MexcCacheLayer(config);
}

// ============================================================================
// Exports
// ============================================================================

export default MexcCacheLayer;
export { CACHE_TTL_PROFILES };
