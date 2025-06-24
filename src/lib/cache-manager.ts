// Lazy logger initialization for global functions
function getLogger() {
  return {
    info: (message: string, context?: any) =>
      console.info("[cache-manager]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[cache-manager]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[cache-manager]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[cache-manager]", message, context || ""),
  };
}

/**
 * Multi-Level Cache Manager
 *
 * Implements a comprehensive caching strategy with multiple levels:
 * - L1 Cache: In-memory LRU cache for hot data
 * - L2 Cache: Persistent cache for API responses and computed results
 * - L3 Cache: Database query result caching
 *
 * Features:
 * - Smart TTL management based on data type
 * - Cache invalidation strategies (time-based, event-based, manual)
 * - Cache performance monitoring and analytics
 * - Memory optimization with intelligent sizing
 * - Redis compatibility for future scaling
 */

import crypto from "node:crypto";

// =======================
// Cache Types & Interfaces
// =======================

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
  metadata?: {
    type?: CacheDataType;
    source?: string;
    size?: number;
    dependencies?: string[];
  };
}

export interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  cleanupInterval: number;
  enableMetrics: boolean;
  enablePersistence?: boolean;
  persistenceFile?: string;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  totalSize: number;
  memoryUsage: number;
  hitRate: number;
  averageAccessTime: number;
  lastCleanup: number;
}

export interface CacheAnalytics {
  performance: CacheMetrics;
  topKeys: Array<{ key: string; hits: number; lastAccessed: number }>;
  typeBreakdown: Record<CacheDataType, { count: number; size: number; hitRate: number }>;
  recommendations: string[];
}

export type CacheDataType =
  | "agent_response"
  | "api_response"
  | "pattern_detection"
  | "query_result"
  | "session_data"
  | "user_preferences"
  | "workflow_result"
  | "performance_metrics"
  | "health_status";

export type CacheInvalidationStrategy = "time_based" | "event_based" | "manual" | "smart";

export interface TTLConfig {
  [key: string]: number;
  agent_response: number;
  api_response: number;
  pattern_detection: number;
  query_result: number;
  session_data: number;
  user_preferences: number;
  workflow_result: number;
  performance_metrics: number;
  health_status: number;
}

// =======================
// L1 Cache (In-Memory LRU)
// =======================

class LRUCache<T = any> {
  private get logger() {
    if (!this._logger) {
      this._logger = {
        info: (message: string, context?: any) =>
          console.info("[cache-manager]", message, context || ""),
        warn: (message: string, context?: any) =>
          console.warn("[cache-manager]", message, context || ""),
        error: (message: string, context?: any, error?: Error) =>
          console.error("[cache-manager]", message, context || "", error || ""),
        debug: (message: string, context?: any) =>
          console.debug("[cache-manager]", message, context || ""),
      };
    }
    return this._logger;
  }

  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private metrics: CacheMetrics;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.metrics = {
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
  }

  get(key: string): T | null {
    const startTime = performance.now();
    const entry = this.cache.get(key);

    if (!entry || Date.now() > entry.expiresAt) {
      this.metrics.misses++;
      if (entry) {
        this.cache.delete(key);
      }
      this.updateMetrics(performance.now() - startTime);
      return null;
    }

    // Update access information
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.metrics.hits++;
    this.updateMetrics(performance.now() - startTime);
    return entry.value;
  }

  set(key: string, value: T, ttl: number, metadata?: CacheEntry<T>["metadata"]): void {
    const now = Date.now();

    // Remove oldest entry if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.metrics.evictions++;
      }
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: now,
      expiresAt: now + ttl,
      accessCount: 0,
      lastAccessed: now,
      metadata,
    };

    this.cache.set(key, entry);
    this.metrics.sets++;
    this.updateTotalSize();
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.metrics.deletes++;
      this.updateTotalSize();
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.metrics.totalSize = 0;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry !== undefined && Date.now() <= entry.expiresAt;
  }

  size(): number {
    return this.cache.size;
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  getEntries(): Array<CacheEntry<T>> {
    return Array.from(this.cache.values());
  }

  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    this.metrics.lastCleanup = now;
    this.updateTotalSize();
    return cleaned;
  }

  private updateMetrics(accessTime: number): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;

    // Update average access time (simple moving average)
    this.metrics.averageAccessTime = (this.metrics.averageAccessTime + accessTime) / 2;
  }

  private updateTotalSize(): void {
    this.metrics.totalSize = this.cache.size;
    // Estimate memory usage (rough calculation)
    this.metrics.memoryUsage = this.cache.size * 1024; // Assume 1KB per entry average
  }
}

// =======================
// Multi-Level Cache Manager
// =======================

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

  // =======================
  // Core Cache Operations
  // =======================

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
      getLogger().error("[CacheManager] Get error:", error);
      this.updateGlobalMetrics("miss", performance.now() - startTime);
      return null;
    }
  }

  /**
   * Set value in appropriate cache level based on data type
   */
  async set<T = any>(
    key: string,
    value: T,
    options: {
      type?: CacheDataType;
      ttl?: number;
      level?: "L1" | "L2" | "L3" | "all";
      metadata?: CacheEntry<T>["metadata"];
    } = {}
  ): Promise<void> {
    const { type = "api_response", level = "all" } = options;
    const ttl = options.ttl || this.ttlConfig[type] || this.config.defaultTTL;
    const now = Date.now();

    const metadata = {
      type,
      source: "cache-manager",
      size: this.estimateSize(value),
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
      getLogger().error("[CacheManager] Set error:", error);
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
      getLogger().error("[CacheManager] Delete error:", error);
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
      getLogger().error("[CacheManager] Clear error:", error);
    }
  }

  // =======================
  // Cache Invalidation
  // =======================

  /**
   * Invalidate cache entries by pattern
   */
  async invalidatePattern(pattern: string | RegExp): Promise<number> {
    const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;
    let invalidated = 0;

    try {
      // Invalidate from all levels
      for (const key of this.l1Cache.getKeys()) {
        if (regex.test(key)) {
          this.l1Cache.delete(key);
          invalidated++;
        }
      }

      for (const key of this.l2Cache.keys()) {
        if (regex.test(key)) {
          this.l2Cache.delete(key);
          invalidated++;
        }
      }

      for (const key of this.l3Cache.keys()) {
        if (regex.test(key)) {
          this.l3Cache.delete(key);
          invalidated++;
        }
      }

      this.emit("invalidate", pattern.toString(), invalidated);
    } catch (error) {
      getLogger().error("[CacheManager] Invalidate pattern error:", error);
    }

    return invalidated;
  }

  /**
   * Invalidate cache entries by type
   */
  async invalidateByType(type: CacheDataType): Promise<number> {
    let invalidated = 0;

    try {
      // Check L1 cache
      for (const entry of this.l1Cache.getEntries()) {
        if (entry.metadata?.type === type) {
          this.l1Cache.delete(entry.key);
          invalidated++;
        }
      }

      // Check L2 cache
      for (const [key, entry] of this.l2Cache.entries()) {
        if (entry.metadata?.type === type) {
          this.l2Cache.delete(key);
          invalidated++;
        }
      }

      // Check L3 cache
      for (const [key, entry] of this.l3Cache.entries()) {
        if (entry.metadata?.type === type) {
          this.l3Cache.delete(key);
          invalidated++;
        }
      }

      this.emit("invalidateType", type, invalidated);
    } catch (error) {
      getLogger().error("[CacheManager] Invalidate by type error:", error);
    }

    return invalidated;
  }

  /**
   * Invalidate cache entries by dependencies
   */
  async invalidateByDependency(dependency: string): Promise<number> {
    let invalidated = 0;

    try {
      const checkDependency = (entry: CacheEntry) =>
        entry.metadata?.dependencies?.includes(dependency);

      // Check all cache levels
      for (const entry of this.l1Cache.getEntries()) {
        if (checkDependency(entry)) {
          this.l1Cache.delete(entry.key);
          invalidated++;
        }
      }

      for (const [key, entry] of this.l2Cache.entries()) {
        if (checkDependency(entry)) {
          this.l2Cache.delete(key);
          invalidated++;
        }
      }

      for (const [key, entry] of this.l3Cache.entries()) {
        if (checkDependency(entry)) {
          this.l3Cache.delete(key);
          invalidated++;
        }
      }

      this.emit("invalidateDependency", dependency, invalidated);
    } catch (error) {
      getLogger().error("[CacheManager] Invalidate by dependency error:", error);
    }

    return invalidated;
  }

  // =======================
  // Cache Analytics & Monitoring
  // =======================

  /**
   * Get comprehensive cache analytics
   */
  getAnalytics(): CacheAnalytics {
    try {
      const l1Metrics = this.l1Cache.getMetrics();

      // Combine metrics from all levels
      const performance: CacheMetrics = {
        hits: this.globalMetrics.hits,
        misses: this.globalMetrics.misses,
        sets: this.globalMetrics.sets,
        deletes: this.globalMetrics.deletes,
        evictions: l1Metrics.evictions,
        totalSize: l1Metrics.totalSize + this.l2Cache.size + this.l3Cache.size,
        memoryUsage: this.estimateMemoryUsage(),
        hitRate: this.globalMetrics.hitRate,
        averageAccessTime: this.globalMetrics.averageAccessTime,
        lastCleanup: this.globalMetrics.lastCleanup,
      };

      // Get top accessed keys
      const topKeys = this.getTopAccessedKeys(10);

      // Get type breakdown
      const typeBreakdown = this.getTypeBreakdown();

      // Generate recommendations
      const recommendations = this.generateRecommendations(performance, typeBreakdown);

      return {
        performance,
        topKeys,
        typeBreakdown,
        recommendations,
      };
    } catch (error) {
      getLogger().error("[CacheManager] Analytics error:", error);
      return {
        performance: this.globalMetrics,
        topKeys: [],
        typeBreakdown: {} as any,
        recommendations: ["Analytics temporarily unavailable"],
      };
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
   * Get all cache keys (for debugging and metadata invalidation)
   */
  getCacheKeys(): string[] {
    const keys = new Set<string>();

    // Get keys from all cache levels
    this.l1Cache.getKeys().forEach((key) => keys.add(key));
    Array.from(this.l2Cache.keys()).forEach((key) => keys.add(key));
    Array.from(this.l3Cache.keys()).forEach((key) => keys.add(key));

    return Array.from(keys);
  }

  // =======================
  // Cleanup & Maintenance
  // =======================

  /**
   * Clean up expired entries from all cache levels
   */
  cleanup(): { L1: number; L2: number; L3: number; total: number } {
    const results = {
      L1: this.l1Cache.cleanup(),
      L2: this.cleanupLevel(this.l2Cache),
      L3: this.cleanupLevel(this.l3Cache),
      total: 0,
    };

    results.total = results.L1 + results.L2 + results.L3;
    this.globalMetrics.lastCleanup = Date.now();

    if (results.total > 0) {
      getLogger().info(
        `[CacheManager] Cleaned up ${results.total} expired entries (L1: ${results.L1}, L2: ${results.L2}, L3: ${results.L3})`
      );
    }

    return results;
  }

  /**
   * Optimize cache by removing least accessed entries when near capacity
   */
  optimize(): { evicted: number; promoted: number } {
    let evicted = 0;
    let promoted = 0;

    try {
      // Get current sizes
      const sizes = this.getSizeBreakdown();
      const maxL2Size = Math.floor(this.config.maxSize * 0.5);
      const maxL3Size = Math.floor(this.config.maxSize * 0.2);

      // Optimize L2 cache
      if (sizes.L2 > maxL2Size) {
        const entries = Array.from(this.l2Cache.entries()).sort(
          ([, a], [, b]) => a.accessCount - b.accessCount
        );

        const toRemove = sizes.L2 - maxL2Size;
        for (let i = 0; i < toRemove && i < entries.length; i++) {
          this.l2Cache.delete(entries[i][0]);
          evicted++;
        }
      }

      // Optimize L3 cache
      if (sizes.L3 > maxL3Size) {
        const entries = Array.from(this.l3Cache.entries()).sort(
          ([, a], [, b]) => a.accessCount - b.accessCount
        );

        const toRemove = sizes.L3 - maxL3Size;
        for (let i = 0; i < toRemove && i < entries.length; i++) {
          this.l3Cache.delete(entries[i][0]);
          evicted++;
        }
      }

      // Promote frequently accessed L3 entries to L2
      const l3Entries = Array.from(this.l3Cache.entries())
        .filter(([, entry]) => entry.accessCount > 5)
        .sort(([, a], [, b]) => b.accessCount - a.accessCount)
        .slice(0, 50); // Promote top 50

      for (const [key, entry] of l3Entries) {
        if (!this.l2Cache.has(key)) {
          this.l2Cache.set(key, entry);
          promoted++;
        }
      }

      if (evicted > 0 || promoted > 0) {
        getLogger().info(
          `[CacheManager] Optimized cache: evicted ${evicted}, promoted ${promoted}`
        );
      }
    } catch (error) {
      getLogger().error("[CacheManager] Optimization error:", error);
    }

    return { evicted, promoted };
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

      getLogger().info("[CacheManager] Destroyed cache manager");
    } catch (error) {
      getLogger().error("[CacheManager] Destroy error:", error);
    }
  }

  // =======================
  // Helper Methods
  // =======================

  private cleanupLevel(cache: Map<string, CacheEntry>): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of cache.entries()) {
      if (now > entry.expiresAt) {
        cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

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

  private estimateSize(value: any): number {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 1024; // Default estimate
    }
  }

  private estimateMemoryUsage(): number {
    let total = 0;

    // L1 cache memory usage
    total += this.l1Cache.getMetrics().memoryUsage;

    // L2 cache memory usage
    for (const entry of this.l2Cache.values()) {
      total += entry.metadata?.size || 1024;
    }

    // L3 cache memory usage
    for (const entry of this.l3Cache.values()) {
      total += entry.metadata?.size || 1024;
    }

    return total;
  }

  private getTopAccessedKeys(
    limit: number
  ): Array<{ key: string; hits: number; lastAccessed: number }> {
    const allEntries: Array<{ key: string; hits: number; lastAccessed: number }> = [];

    // Collect from L1
    for (const entry of this.l1Cache.getEntries()) {
      allEntries.push({
        key: entry.key,
        hits: entry.accessCount,
        lastAccessed: entry.lastAccessed,
      });
    }

    // Collect from L2
    for (const entry of this.l2Cache.values()) {
      allEntries.push({
        key: entry.key,
        hits: entry.accessCount,
        lastAccessed: entry.lastAccessed,
      });
    }

    // Collect from L3
    for (const entry of this.l3Cache.values()) {
      allEntries.push({
        key: entry.key,
        hits: entry.accessCount,
        lastAccessed: entry.lastAccessed,
      });
    }

    return allEntries.sort((a, b) => b.hits - a.hits).slice(0, limit);
  }

  private getTypeBreakdown(): Record<
    CacheDataType,
    { count: number; size: number; hitRate: number }
  > {
    const breakdown: Record<string, { count: number; size: number; hits: number; total: number }> =
      {};

    const processEntry = (entry: CacheEntry) => {
      const type = entry.metadata?.type || "api_response";
      if (!breakdown[type]) {
        breakdown[type] = { count: 0, size: 0, hits: 0, total: 0 };
      }
      breakdown[type].count++;
      breakdown[type].size += entry.metadata?.size || 1024;
      breakdown[type].hits += entry.accessCount;
      breakdown[type].total += entry.accessCount + 1; // Include misses estimate
    };

    // Process all cache levels
    for (const entry of this.l1Cache.getEntries()) {
      processEntry(entry);
    }
    for (const entry of this.l2Cache.values()) {
      processEntry(entry);
    }
    for (const entry of this.l3Cache.values()) {
      processEntry(entry);
    }

    // Convert to final format
    const result: Record<CacheDataType, { count: number; size: number; hitRate: number }> =
      {} as any;
    for (const [type, data] of Object.entries(breakdown)) {
      result[type as CacheDataType] = {
        count: data.count,
        size: data.size,
        hitRate: data.total > 0 ? (data.hits / data.total) * 100 : 0,
      };
    }

    return result;
  }

  private generateRecommendations(
    performance: CacheMetrics,
    typeBreakdown: Record<CacheDataType, any>
  ): string[] {
    const recommendations: string[] = [];

    // Hit rate recommendations
    if (performance.hitRate < 60) {
      recommendations.push("Low cache hit rate (<60%) - consider increasing TTL for stable data");
    } else if (performance.hitRate > 90) {
      recommendations.push("Excellent cache hit rate (>90%) - current configuration is optimal");
    }

    // Memory usage recommendations
    if (performance.memoryUsage > 100 * 1024 * 1024) {
      // 100MB
      recommendations.push("High memory usage - consider reducing cache size or TTL values");
    }

    // Type-specific recommendations
    for (const [type, data] of Object.entries(typeBreakdown)) {
      if (data.hitRate < 50) {
        recommendations.push(
          `Poor hit rate for ${type} (${data.hitRate.toFixed(1)}%) - review caching strategy`
        );
      }
    }

    // Performance recommendations
    if (performance.averageAccessTime > 10) {
      recommendations.push("High average access time - consider cache optimization");
    }

    // Size recommendations
    if (performance.totalSize > this.config.maxSize * 0.9) {
      recommendations.push("Cache near capacity - enable aggressive cleanup or increase max size");
    }

    return recommendations.length > 0 ? recommendations : ["Cache performance is optimal"];
  }

  // =======================
  // Event System
  // =======================

  private emit(event: string, key: string, value: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(key, value);
        } catch (error) {
          getLogger().error(`[CacheManager] Event listener error for ${event}:`, error);
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

// =======================
// Global Cache Instance
// =======================

// Create global cache manager instance
export const globalCacheManager = new CacheManager({
  maxSize: 10000,
  defaultTTL: 5 * 60 * 1000,
  cleanupInterval: 5 * 60 * 1000,
  enableMetrics: true,
  enablePersistence: false,
});

// =======================
// Cache Utilities
// =======================

/**
 * Generate cache key from multiple components
 */
export function generateCacheKey(...components: (string | number | object)[]): string {
  const keyData = components
    .map((component) =>
      typeof component === "object" ? JSON.stringify(component) : String(component)
    )
    .join(":");

  return crypto.createHash("sha256").update(keyData).digest("hex").substring(0, 32);
}

/**
 * Cache decorator for functions
 */
export function withCache<T extends (...args: any[]) => any>(
  fn: T,
  options: {
    keyGenerator?: (...args: Parameters<T>) => string;
    ttl?: number;
    type?: CacheDataType;
  } = {}
): T {
  const { keyGenerator, ttl, type = "api_response" } = options;

  return (async (...args: Parameters<T>) => {
    const cacheKey = keyGenerator ? keyGenerator(...args) : generateCacheKey(fn.name, ...args);

    // Try to get from cache first
    const cached = await globalCacheManager.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn(...args);
    await globalCacheManager.set(cacheKey, result, { type, ttl });

    return result;
  }) as T;
}

/**
 * Warm up cache with predefined data
 */
export async function warmUpCache(
  data: Array<{
    key: string;
    value: any;
    type?: CacheDataType;
    ttl?: number;
  }>
): Promise<void> {
  getLogger().info(`[CacheManager] Warming up cache with ${data.length} entries...`);

  for (const { key, value, type, ttl } of data) {
    await globalCacheManager.set(key, value, { type, ttl });
  }

  getLogger().info(`[CacheManager] Cache warm-up completed`);
}
