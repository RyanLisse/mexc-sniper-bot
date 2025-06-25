/**
 * Multi-Level Cache Manager
 *
 * Implements a comprehensive caching strategy with multiple levels:
 * - L1 Cache: In-memory LRU cache for hot data
 * - L2 Cache: Persistent cache for API responses and computed results
 * - L3 Cache: Database query result caching
 */

import { createLogger } from "../unified-logger";
import { LRUCache } from "./lru-cache";
import type {
  CacheAnalytics,
  CacheConfig,
  CacheDataType,
  CacheEntry,
  CacheMetrics,
  CacheSetOptions,
  TTLConfig,
} from "./types";
import { cleanupLevel, estimateSize } from "./utils";

const logger = createLogger("cache-manager", {
  enableStructuredLogging: process.env.NODE_ENV === "production",
  enablePerformanceLogging: true,
});

export class CacheManager {
  private l1Cache: LRUCache;
  private l2Cache: Map<string, CacheEntry> = new Map();
  private l3Cache: Map<string, CacheEntry> = new Map();

  private config: CacheConfig;
  private ttlConfig: TTLConfig;
  private cleanupInterval?: NodeJS.Timeout;
  private globalMetrics: CacheMetrics;
  private eventListeners: Map<string, Set<(key: string, value: any) => void>> = new Map();

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 5000,
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      cleanupInterval: 10 * 60 * 1000, // 10 minutes
      enableMetrics: true,
      enablePersistence: false,
      ...config,
    };

    this.ttlConfig = {
      agent_response: 5 * 60 * 1000, // 5 minutes
      api_response: 2 * 60 * 1000, // 2 minutes
      pattern_detection: 10 * 60 * 1000, // 10 minutes
      query_result: 1 * 60 * 1000, // 1 minute
      session_data: 30 * 60 * 1000, // 30 minutes
      user_preferences: 60 * 60 * 1000, // 1 hour
      workflow_result: 15 * 60 * 1000, // 15 minutes
      performance_metrics: 30 * 1000, // 30 seconds
      health_status: 15 * 1000, // 15 seconds
    };

    this.l1Cache = new LRUCache(Math.floor(this.config.maxSize * 0.3)); // 30% of total for L1

    this.globalMetrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      totalSize: 0,
      memoryUsage: 0,
      hitRate: 0,
      averageAccessTime: 0,
      lastCleanup: Date.now(),
    };

    // Start cleanup interval
    if (this.config.cleanupInterval > 0) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, this.config.cleanupInterval);
    }
  }

  /**
   * Get value from cache with automatic level fallback
   */
  async get<T = any>(key: string): Promise<T | null> {
    const startTime = performance.now();

    try {
      // Try L1 cache first (fastest)
      const value = this.l1Cache.get(key);
      if (value !== null) {
        this.updateGlobalMetrics("hit", performance.now() - startTime);
        return value as T;
      }

      // Try L2 cache (persistent)
      const l2Entry = this.l2Cache.get(key);
      if (l2Entry && Date.now() <= l2Entry.expiresAt) {
        // Promote to L1 cache
        this.l1Cache.set(key, l2Entry.value, l2Entry.expiresAt - Date.now(), l2Entry.metadata);
        this.updateGlobalMetrics("hit", performance.now() - startTime);
        return l2Entry.value as T;
      }

      // Try L3 cache (query results)
      const l3Entry = this.l3Cache.get(key);
      if (l3Entry && Date.now() <= l3Entry.expiresAt) {
        // Promote to L1 and L2
        const remainingTTL = l3Entry.expiresAt - Date.now();
        this.l1Cache.set(key, l3Entry.value, remainingTTL, l3Entry.metadata);
        this.l2Cache.set(key, l3Entry);
        this.updateGlobalMetrics("hit", performance.now() - startTime);
        return l3Entry.value as T;
      }

      this.updateGlobalMetrics("miss", performance.now() - startTime);
      return null;
    } catch (error) {
      logger.error(
        "Get error:",
        { key },
        error instanceof Error ? error : new Error(String(error))
      );
      this.updateGlobalMetrics("miss", performance.now() - startTime);
      return null;
    }
  }

  /**
   * Set value in appropriate cache level based on data type
   */
  async set<T = any>(key: string, value: T, options: CacheSetOptions<T> = {}): Promise<void> {
    const { type = "api_response", level = "all" } = options;
    const ttl = options.ttl || this.ttlConfig[type] || this.config.defaultTTL;
    const now = Date.now();

    const metadata = {
      type,
      source: "cache-manager",
      size: estimateSize(value),
      ...options.metadata,
    };

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: now,
      expiresAt: now + ttl,
      accessCount: 0,
      lastAccessed: now,
      metadata,
    };

    try {
      if (level === "all" || level === "L1") {
        this.l1Cache.set(key, value, ttl, metadata);
      }

      if (level === "all" || level === "L2") {
        this.l2Cache.set(key, entry);
      }

      if (level === "all" || level === "L3") {
        this.l3Cache.set(key, entry);
      }

      this.globalMetrics.sets++;
      this.emit("set", key, value);
    } catch (error) {
      logger.error(
        "Set error:",
        { key, type },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Delete from all cache levels
   */
  async delete(key: string): Promise<boolean> {
    let deleted = false;

    try {
      deleted = this.l1Cache.delete(key) || deleted;
      deleted = this.l2Cache.delete(key) || deleted;
      deleted = this.l3Cache.delete(key) || deleted;

      if (deleted) {
        this.globalMetrics.deletes++;
        this.emit("delete", key, null);
      }
    } catch (error) {
      logger.error(
        "Delete error:",
        { key },
        error instanceof Error ? error : new Error(String(error))
      );
    }

    return deleted;
  }

  /**
   * Check if key exists in any cache level
   */
  async has(key: string): Promise<boolean> {
    return (
      this.l1Cache.has(key) ||
      (this.l2Cache.has(key) && Date.now() <= this.l2Cache.get(key)?.expiresAt) ||
      (this.l3Cache.has(key) && Date.now() <= this.l3Cache.get(key)?.expiresAt)
    );
  }

  /**
   * Clear all cache levels
   */
  async clear(level?: "L1" | "L2" | "L3"): Promise<void> {
    try {
      if (!level || level === "L1") {
        this.l1Cache.clear();
      }
      if (!level || level === "L2") {
        this.l2Cache.clear();
      }
      if (!level || level === "L3") {
        this.l3Cache.clear();
      }

      this.emit("clear", "all", null);
    } catch (error) {
      logger.error(
        "Clear error:",
        { level },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get current cache metrics
   */
  getMetrics(): CacheMetrics {
    return { ...this.globalMetrics };
  }

  /**
   * Get cache size breakdown by level
   */
  getSizeBreakdown(): { L1: number; L2: number; L3: number; total: number } {
    return {
      L1: this.l1Cache.size(),
      L2: this.l2Cache.size,
      L3: this.l3Cache.size,
      total: this.l1Cache.size() + this.l2Cache.size + this.l3Cache.size,
    };
  }

  /**
   * Clean up expired entries from all cache levels
   */
  cleanup(): { L1: number; L2: number; L3: number; total: number } {
    const results = {
      L1: this.l1Cache.cleanup(),
      L2: cleanupLevel(this.l2Cache),
      L3: cleanupLevel(this.l3Cache),
      total: 0,
    };

    results.total = results.L1 + results.L2 + results.L3;
    this.globalMetrics.lastCleanup = Date.now();

    if (results.total > 0) {
      logger.info(`Cleaned up ${results.total} expired entries`, {
        L1: results.L1,
        L2: results.L2,
        L3: results.L3,
      });
    }

    return results;
  }

  /**
   * Destroy cache manager and clean up resources
   */
  destroy(): void {
    try {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = undefined;
      }

      this.clear();
      this.eventListeners.clear();

      logger.info("Destroyed cache manager");
    } catch (error) {
      logger.error("Destroy error:", error instanceof Error ? error : new Error(String(error)));
    }
  }

  // Private helper methods
  private updateGlobalMetrics(type: "hit" | "miss", accessTime: number): void {
    if (type === "hit") {
      this.globalMetrics.hits++;
    } else {
      this.globalMetrics.misses++;
    }

    const total = this.globalMetrics.hits + this.globalMetrics.misses;
    this.globalMetrics.hitRate = total > 0 ? (this.globalMetrics.hits / total) * 100 : 0;
    this.globalMetrics.averageAccessTime = (this.globalMetrics.averageAccessTime + accessTime) / 2;
  }

  // Event System
  private emit(event: string, key: string, value: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(key, value);
        } catch (error) {
          logger.error(
            `Event listener error for ${event}:`,
            { event, key },
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    }
  }

  on(event: string, listener: (key: string, value: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(listener);
  }

  off(event: string, listener: (key: string, value: any) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }
}
