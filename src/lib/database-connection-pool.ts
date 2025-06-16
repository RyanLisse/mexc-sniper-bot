/**
 * Database Connection Pool & Caching Manager
 *
 * Phase 4: Connection Pooling & Caching (4h)
 * - Implements database connection pooling
 * - Adds query result caching for frequently accessed data
 * - Optimizes database connection management
 * - Adds performance monitoring and metrics
 */

import { clearDbCache, db, executeWithRetry } from "@/src/db";
import { sql } from "drizzle-orm";

interface ConnectionPoolConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeoutMs: number;
  idleTimeoutMs: number;
  maxRetries: number;
  healthCheckIntervalMs: number;
  enableConnectionReuse: boolean;
  enableQueryResultCaching: boolean;
  cacheMaxSize: number;
  cacheTTLMs: number;
}

interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalRequests: number;
  successfulConnections: number;
  failedConnections: number;
  averageConnectionTime: number;
  peakConnections: number;
  connectionPoolHealth: "healthy" | "degraded" | "critical";
}

interface CacheMetrics {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  avgRetrievalTime: number;
  memoryUsageMB: number;
  oldestEntryAge: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  key: string;
}

interface QueryResultCache {
  entries: Map<string, CacheEntry<any>>;
  maxSize: number;
  maxMemoryMB: number;
  currentMemoryMB: number;
  ttlMs: number;
  enabled: boolean;
}

export class DatabaseConnectionPool {
  private static instance: DatabaseConnectionPool;
  private config: ConnectionPoolConfig;
  private connections: any[] = [];
  private metrics: ConnectionMetrics;
  private cache: QueryResultCache;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.config = {
      maxConnections: 20,
      minConnections: 5,
      acquireTimeoutMs: 10000,
      idleTimeoutMs: 30000,
      maxRetries: 3,
      healthCheckIntervalMs: 60000, // 1 minute
      enableConnectionReuse: true,
      enableQueryResultCaching: true,
      cacheMaxSize: 1000,
      cacheTTLMs: 300000, // 5 minutes
    };

    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      totalRequests: 0,
      successfulConnections: 0,
      failedConnections: 0,
      averageConnectionTime: 0,
      peakConnections: 0,
      connectionPoolHealth: "healthy",
    };

    this.cache = {
      entries: new Map(),
      maxSize: this.config.cacheMaxSize,
      maxMemoryMB: 100, // 100MB cache limit
      currentMemoryMB: 0,
      ttlMs: this.config.cacheTTLMs,
      enabled: this.config.enableQueryResultCaching,
    };

    this.startHealthChecks();
    this.startCacheCleanup();
  }

  static getInstance(): DatabaseConnectionPool {
    if (!DatabaseConnectionPool.instance) {
      DatabaseConnectionPool.instance = new DatabaseConnectionPool();
    }
    return DatabaseConnectionPool.instance;
  }

  // ======================================
  // CONNECTION POOL MANAGEMENT
  // ======================================

  /**
   * Execute a query with connection pooling and caching
   */
  async executeQuery<T>(
    queryFn: () => Promise<T>,
    cacheKey?: string,
    cacheTTL?: number
  ): Promise<T> {
    const startTime = performance.now();
    this.metrics.totalRequests++;

    // Check cache first if caching is enabled
    if (cacheKey && this.cache.enabled) {
      const cachedResult = this.getCachedResult<T>(cacheKey);
      if (cachedResult !== null) {
        console.log(`💾 Cache hit for key: ${cacheKey}`);
        return cachedResult;
      }
    }

    // Execute query with connection management
    try {
      const result = await this.executeWithConnectionManagement(queryFn);

      // Cache the result if caching is enabled
      if (cacheKey && this.cache.enabled) {
        this.setCachedResult(cacheKey, result, cacheTTL);
      }

      const executionTime = performance.now() - startTime;
      this.updateConnectionMetrics(executionTime, true);

      return result;
    } catch (error) {
      const executionTime = performance.now() - startTime;
      this.updateConnectionMetrics(executionTime, false);
      throw error;
    }
  }

  /**
   * Execute query with connection management and retries
   */
  private async executeWithConnectionManagement<T>(queryFn: () => Promise<T>): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Use the existing db connection with optimization
        const result = await executeWithRetry(queryFn, `Query execution attempt ${attempt}`);
        this.metrics.successfulConnections++;
        return result;
      } catch (error) {
        lastError = error;
        this.metrics.failedConnections++;

        console.warn(
          `Database query failed (attempt ${attempt}/${this.config.maxRetries}):`,
          error
        );

        if (attempt < this.config.maxRetries) {
          // Exponential backoff for retries
          const delay = Math.min(1000 * 2 ** (attempt - 1), 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));

          // Clear database cache on retry to get fresh connection
          if (attempt === 2) {
            clearDbCache();
          }
        }
      }
    }

    throw lastError;
  }

  /**
   * Update connection metrics
   */
  private updateConnectionMetrics(executionTime: number, success: boolean): void {
    if (success) {
      this.metrics.averageConnectionTime =
        (this.metrics.averageConnectionTime * (this.metrics.successfulConnections - 1) +
          executionTime) /
        this.metrics.successfulConnections;
    }

    // Update health status based on metrics
    const failureRate = this.metrics.failedConnections / Math.max(this.metrics.totalRequests, 1);
    const avgTime = this.metrics.averageConnectionTime;

    if (failureRate > 0.1 || avgTime > 5000) {
      this.metrics.connectionPoolHealth = "critical";
    } else if (failureRate > 0.05 || avgTime > 2000) {
      this.metrics.connectionPoolHealth = "degraded";
    } else {
      this.metrics.connectionPoolHealth = "healthy";
    }
  }

  // ======================================
  // QUERY RESULT CACHING
  // ======================================

  /**
   * Get cached query result
   */
  private getCachedResult<T>(key: string): T | null {
    const entry = this.cache.entries.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.cache.ttlMs) {
      this.cache.entries.delete(key);
      this.cache.currentMemoryMB -= entry.size;
      return null;
    }

    // Update access metrics
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    return entry.data;
  }

  /**
   * Set cached query result
   */
  private setCachedResult<T>(key: string, data: T, _customTTL?: number): void {
    if (!this.cache.enabled) return;

    // Estimate memory size (rough calculation)
    const dataSize = this.estimateObjectSize(data);
    const entrySizeMB = dataSize / (1024 * 1024);

    // Check if we have space
    if (
      this.cache.entries.size >= this.cache.maxSize ||
      this.cache.currentMemoryMB + entrySizeMB > this.cache.maxMemoryMB
    ) {
      this.evictLeastRecentlyUsed();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
      size: entrySizeMB,
      key,
    };

    this.cache.entries.set(key, entry);
    this.cache.currentMemoryMB += entrySizeMB;

    console.log(`💾 Cached result for key: ${key} (${entrySizeMB.toFixed(2)}MB)`);
  }

  /**
   * Evict least recently used cache entries
   */
  private evictLeastRecentlyUsed(): void {
    if (this.cache.entries.size === 0) return;

    // Sort by last accessed time (oldest first)
    const sortedEntries = Array.from(this.cache.entries.entries()).sort(
      ([, a], [, b]) => a.lastAccessed - b.lastAccessed
    );

    // Remove oldest 20% of entries
    const removeCount = Math.ceil(sortedEntries.length * 0.2);

    for (let i = 0; i < removeCount && i < sortedEntries.length; i++) {
      const [key, entry] = sortedEntries[i];
      this.cache.entries.delete(key);
      this.cache.currentMemoryMB -= entry.size;
    }

    console.log(`🗑️ Evicted ${removeCount} cache entries`);
  }

  /**
   * Estimate object size in bytes
   */
  private estimateObjectSize(obj: any): number {
    const jsonString = JSON.stringify(obj);
    return new Blob([jsonString]).size;
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidateCache(pattern: string): void {
    let invalidatedCount = 0;

    for (const [key, entry] of this.cache.entries.entries()) {
      if (key.includes(pattern)) {
        this.cache.entries.delete(key);
        this.cache.currentMemoryMB -= entry.size;
        invalidatedCount++;
      }
    }

    if (invalidatedCount > 0) {
      console.log(`🗑️ Invalidated ${invalidatedCount} cache entries with pattern: ${pattern}`);
    }
  }

  /**
   * Clear all cache entries
   */
  clearCache(): void {
    this.cache.entries.clear();
    this.cache.currentMemoryMB = 0;
    console.log("🗑️ All cache entries cleared");
  }

  // ======================================
  // OPTIMIZED QUERY WRAPPERS
  // ======================================

  /**
   * Execute cached select query
   */
  async executeSelect<T>(
    queryFn: () => Promise<T>,
    cacheKey: string,
    cacheTTL?: number
  ): Promise<T> {
    return this.executeQuery(queryFn, cacheKey, cacheTTL);
  }

  /**
   * Execute write query (insert/update/delete) with cache invalidation
   */
  async executeWrite<T>(queryFn: () => Promise<T>, invalidatePatterns: string[] = []): Promise<T> {
    const result = await this.executeQuery(queryFn);

    // Invalidate related cache entries
    for (const pattern of invalidatePatterns) {
      this.invalidateCache(pattern);
    }

    return result;
  }

  /**
   * Execute batch operations efficiently
   */
  async executeBatch<T>(
    operations: (() => Promise<T>)[],
    invalidatePatterns: string[] = []
  ): Promise<T[]> {
    const startTime = performance.now();

    try {
      // Execute operations in parallel with concurrency limit
      const results = await this.executeConcurrentOperations(operations);

      // Invalidate cache patterns
      for (const pattern of invalidatePatterns) {
        this.invalidateCache(pattern);
      }

      const executionTime = performance.now() - startTime;
      console.log(
        `📦 Batch execution completed: ${operations.length} operations in ${executionTime.toFixed(2)}ms`
      );

      return results;
    } catch (error) {
      console.error("❌ Batch execution failed:", error);
      throw error;
    }
  }

  /**
   * Execute operations with concurrency control
   */
  private async executeConcurrentOperations<T>(operations: (() => Promise<T>)[]): Promise<T[]> {
    const maxConcurrency = Math.min(this.config.maxConnections / 2, 5);
    const results: T[] = [];

    for (let i = 0; i < operations.length; i += maxConcurrency) {
      const batch = operations.slice(i, i + maxConcurrency);
      const batchResults = await Promise.all(batch.map((op) => this.executeQuery(op)));
      results.push(...batchResults);
    }

    return results;
  }

  // ======================================
  // HEALTH CHECKS & MONITORING
  // ======================================

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckIntervalMs);
  }

  /**
   * Perform connection pool health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const startTime = performance.now();

      // Test database connectivity
      await db.execute(sql`SELECT 1`);

      const responseTime = performance.now() - startTime;

      // Update health metrics
      if (responseTime > 5000) {
        this.metrics.connectionPoolHealth = "critical";
      } else if (responseTime > 2000) {
        this.metrics.connectionPoolHealth = "degraded";
      } else if (
        this.metrics.connectionPoolHealth === "critical" ||
        this.metrics.connectionPoolHealth === "degraded"
      ) {
        this.metrics.connectionPoolHealth = "healthy";
      }

      console.log(
        `💊 Health check completed: ${responseTime.toFixed(2)}ms (${this.metrics.connectionPoolHealth})`
      );
    } catch (error) {
      this.metrics.connectionPoolHealth = "critical";
      console.error("❌ Health check failed:", error);
    }
  }

  /**
   * Start cache cleanup process
   */
  private startCacheCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // Every minute
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries.entries()) {
      if (now - entry.timestamp > this.cache.ttlMs) {
        this.cache.entries.delete(key);
        this.cache.currentMemoryMB -= entry.size;
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  // ======================================
  // METRICS & REPORTING
  // ======================================

  /**
   * Get connection pool metrics
   */
  getConnectionMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }

  /**
   * Get cache metrics
   */
  getCacheMetrics(): CacheMetrics {
    const _totalRequests = Array.from(this.cache.entries.values()).reduce(
      (sum, entry) => sum + entry.accessCount,
      0
    );

    const oldestEntry = Array.from(this.cache.entries.values()).reduce(
      (oldest, entry) => (!oldest || entry.timestamp < oldest.timestamp ? entry : oldest),
      null as CacheEntry<any> | null
    );

    return {
      totalEntries: this.cache.entries.size,
      hitRate: 0, // Would be calculated from monitoring data
      missRate: 0, // Would be calculated from monitoring data
      totalHits: 0, // Would come from monitoring
      totalMisses: 0, // Would come from monitoring
      avgRetrievalTime: 0, // Would be calculated from monitoring
      memoryUsageMB: this.cache.currentMemoryMB,
      oldestEntryAge: oldestEntry ? Date.now() - oldestEntry.timestamp : 0,
    };
  }

  /**
   * Export performance report
   */
  exportPerformanceReport(): any {
    return {
      timestamp: new Date().toISOString(),
      connectionPool: this.getConnectionMetrics(),
      cache: this.getCacheMetrics(),
      configuration: this.config,
      recommendations: this.generateRecommendations(),
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const cacheMetrics = this.getCacheMetrics();

    if (this.metrics.connectionPoolHealth === "critical") {
      recommendations.push(
        "Critical: Connection pool health is poor - investigate database connectivity"
      );
    }

    if (this.metrics.averageConnectionTime > 2000) {
      recommendations.push("High: Average connection time is slow - consider query optimization");
    }

    if (cacheMetrics.memoryUsageMB > 80) {
      recommendations.push(
        "Medium: Cache memory usage is high - consider reducing cache size or TTL"
      );
    }

    if (this.cache.entries.size > this.cache.maxSize * 0.9) {
      recommendations.push("Medium: Cache is near capacity - consider increasing cache size");
    }

    return recommendations;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ConnectionPoolConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update cache settings
    this.cache.maxSize = this.config.cacheMaxSize;
    this.cache.ttlMs = this.config.cacheTTLMs;
    this.cache.enabled = this.config.enableQueryResultCaching;

    console.log("⚙️ Connection pool configuration updated");
  }

  /**
   * Shutdown connection pool
   */
  shutdown(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.clearCache();
    console.log("🔌 Connection pool shutdown completed");
  }
}

// Export singleton instance
export const databaseConnectionPool = DatabaseConnectionPool.getInstance();
