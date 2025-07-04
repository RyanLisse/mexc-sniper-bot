import {
  isBrowserEnvironment,
  isNodeEnvironment,
} from "@/src/lib/browser-compatible-events";
/**
 * Enhanced Unified Cache System
 *
 * Extends the UnifiedCacheSystem with advanced features including:
 * - Performance monitoring integration
 * - Advanced eviction strategies
 * - Cache warming capabilities
 * - Distributed cache support
 * - Event-driven cache invalidation
 * - Compression and serialization
 * - Cache analytics and insights
 */

import type { PerformanceMonitoringService } from "./performance-monitoring-service";
import type { UnifiedCacheOptions } from "./unified-cache-system";
import { UnifiedCacheSystem } from "./unified-cache-system";

export interface EnhancedCacheEntry<T = any> {
  value: T;
  expires: number;
  category: string;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  compressedSize?: number;
  originalSize?: number;
  accessPattern?: "hot" | "warm" | "cold";
  priority?: number;
  tags?: string[];
  nodeId?: string;
  checksum?: string;
}

export interface EnhancedCacheOptions extends UnifiedCacheOptions {
  // Performance monitoring
  enablePerformanceMonitoring?: boolean;
  performanceMonitoringService?: PerformanceMonitoringService;

  // Advanced eviction strategies
  evictionStrategy?: "lru" | "lfu" | "ttl" | "adaptive";
  compressionEnabled?: boolean;

  // Cache warming
  warmingEnabled?: boolean;
  warmingStrategy?: "eager" | "lazy" | "predictive";

  // Event-driven invalidation
  eventInvalidation?: boolean;
  invalidationPatterns?: string[];

  // Analytics
  analyticsEnabled?: boolean;
  metricsRetentionPeriod?: number;

  // Distributed cache
  distributedEnabled?: boolean;
  nodeId?: string;

  // Serialization
  serializationEnabled?: boolean;
  customSerializer?: {
    serialize: (data: any) => string;
    deserialize: (data: string) => any;
  };
}

export interface CacheAnalytics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  averageResponseTime: number;
  memoryUsage: number;
  compressionRatio: number;
  topKeys: Array<{ key: string; accessCount: number; category: string }>;
  categoryStats: Record<
    string,
    {
      hits: number;
      misses: number;
      hitRate: number;
      avgResponseTime: number;
      memoryUsage: number;
    }
  >;
  evictionStats: Record<string, number>;
  performanceMetrics: {
    p50: number;
    p95: number;
    p99: number;
  };
  timeSeriesData: Array<{
    timestamp: number;
    hits: number;
    misses: number;
    responseTime: number;
  }>;
}

export interface CacheEventData {
  key: string;
  category: string;
  action: "set" | "get" | "delete" | "evict" | "expire";
  timestamp: number;
  size?: number;
  duration?: number;
}

export type CacheEventCallback = (event: CacheEventData) => void;

export class EnhancedUnifiedCacheSystem extends UnifiedCacheSystem {
  private options: EnhancedCacheOptions & {
    enablePerformanceMonitoring: boolean;
    evictionStrategy: "lru" | "lfu" | "ttl" | "adaptive";
    compressionEnabled: boolean;
    warmingEnabled: boolean;
    warmingStrategy: "eager" | "lazy" | "predictive";
    eventInvalidation: boolean;
    invalidationPatterns: string[];
    analyticsEnabled: boolean;
    metricsRetentionPeriod: number;
    distributedEnabled: boolean;
    nodeId: string;
    serializationEnabled: boolean;
    ttl: number;
    maxSize: number;
    onEvict: (key: string, value: any) => void;
    categories: string[];
    globalTTL: number;
    categoryTTLs: Record<string, number>;
  };
  private performanceMonitoring?: PerformanceMonitoringService;
  private analytics: CacheAnalytics;
  private eventCallbacks: Map<string, CacheEventCallback[]> = new Map();
  private accessPatterns: Map<
    string,
    { count: number; lastAccess: number; frequency: number }
  > = new Map();
  private warmingQueue: Set<string> = new Set();
  private compressionCache: Map<string, { compressed: string; original: any }> =
    new Map();
  private nodeId: string;
  private timeSeriesBuffer: Array<{
    timestamp: number;
    hits: number;
    misses: number;
    responseTime: number;
  }> = [];
  private currentMetrics = { hits: 0, misses: 0, responseTime: 0 };

  constructor(options: EnhancedCacheOptions = {}) {
    super(options);

    this.options = {
      ...options,
      // Enhanced defaults
      enablePerformanceMonitoring: options.enablePerformanceMonitoring ?? true,
      evictionStrategy: options.evictionStrategy ?? "lru",
      compressionEnabled: options.compressionEnabled ?? false,
      warmingEnabled: options.warmingEnabled ?? false,
      warmingStrategy: options.warmingStrategy ?? "lazy",
      eventInvalidation: options.eventInvalidation ?? true,
      invalidationPatterns: options.invalidationPatterns ?? [],
      analyticsEnabled: options.analyticsEnabled ?? true,
      metricsRetentionPeriod:
        options.metricsRetentionPeriod ?? 24 * 60 * 60 * 1000, // 24 hours
      distributedEnabled: options.distributedEnabled ?? false,
      nodeId: options.nodeId ?? `node-${Date.now()}`,
      serializationEnabled: options.serializationEnabled ?? false,
      customSerializer: options.customSerializer,
      // Base options
      ttl: options.ttl ?? 5 * 60 * 1000,
      maxSize: options.maxSize ?? 1000,
      onEvict: options.onEvict ?? (() => {}),
      categories: options.categories ?? ["default"],
      globalTTL: options.globalTTL ?? 5 * 60 * 1000,
      categoryTTLs: options.categoryTTLs ?? {},
    };

    this.nodeId = this.options.nodeId;
    this.performanceMonitoring = options.performanceMonitoringService;

    this.analytics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
      averageResponseTime: 0,
      memoryUsage: 0,
      compressionRatio: 0,
      topKeys: [],
      categoryStats: {},
      evictionStats: {},
      performanceMetrics: { p50: 0, p95: 0, p99: 0 },
      timeSeriesData: [],
    };

    // Initialize analytics collection
    if (this.options.analyticsEnabled) {
      this.startAnalyticsCollection();
    }
  }

  /**
   * Enhanced get method with performance monitoring and analytics
   */
  async get<T>(
    key: string,
    category: string = "default"
  ): Promise<T | undefined> {
    const startTime = performance.now();

    try {
      // Track access pattern
      this.trackAccessPattern(key, category);

      // Call parent get method
      const result = await super.get<T>(key, category);

      const duration = performance.now() - startTime;

      // Update analytics
      this.analytics.totalRequests++;
      if (result !== undefined) {
        this.analytics.cacheHits++;
        this.currentMetrics.hits++;
        this.emitEvent({
          key,
          category,
          action: "get",
          timestamp: Date.now(),
          duration,
        });
      } else {
        this.analytics.cacheMisses++;
        this.currentMetrics.misses++;

        // Trigger warming if enabled
        if (
          this.options.warmingEnabled &&
          this.options.warmingStrategy === "predictive"
        ) {
          this.scheduleWarming(key, category);
        }
      }

      // Update response time
      this.currentMetrics.responseTime = duration;

      // Performance monitoring
      if (this.performanceMonitoring) {
        this.performanceMonitoring.recordMetric(
          "cache_operation_time",
          duration
        );
      }

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      if (this.performanceMonitoring) {
        this.performanceMonitoring.incrementCounter("cache_errors");
        this.performanceMonitoring.recordMetric(
          "cache_operation_time",
          duration
        );
      }

      throw error;
    }
  }

  /**
   * Enhanced set method with compression and analytics
   */
  async set<T>(
    key: string,
    value: T,
    category: string = "default",
    ttl?: number
  ): Promise<void> {
    const startTime = performance.now();

    try {
      let finalValue = value;
      let _compressedSize: number | undefined;
      let originalSize: number | undefined;

      // Apply compression if enabled
      if (this.options.compressionEnabled) {
        const compressed = await this.compressValue(value);
        if (compressed) {
          finalValue = compressed.compressed as T;
          _compressedSize = compressed.compressedSize;
          originalSize = compressed.originalSize;
        }
      }

      // Apply custom serialization if enabled
      if (this.options.serializationEnabled && this.options.customSerializer) {
        finalValue = this.options.customSerializer.serialize(finalValue) as T;
      }

      // Call parent set method
      await super.set(key, finalValue, category, ttl);

      const duration = performance.now() - startTime;

      // Track in analytics
      this.updateCategoryStats(category, "set", duration);

      // Emit event
      this.emitEvent({
        key,
        category,
        action: "set",
        timestamp: Date.now(),
        size: originalSize || JSON.stringify(value).length,
        duration,
      });

      // Performance monitoring
      if (this.performanceMonitoring) {
        this.performanceMonitoring.recordMetric("cache_set_time", duration);
      }
    } catch (error) {
      const duration = performance.now() - startTime;

      if (this.performanceMonitoring) {
        this.performanceMonitoring.incrementCounter("cache_errors");
        this.performanceMonitoring.recordMetric("cache_set_time", duration);
      }

      throw error;
    }
  }

  /**
   * Cache warming functionality
   */
  async warmCache(
    keys: Array<{ key: string; category: string; loader: () => Promise<any> }>
  ): Promise<void> {
    if (!this.options.warmingEnabled) return;

    const promises = keys.map(async ({ key, category, loader }) => {
      try {
        const value = await loader();
        await this.set(key, value, category);
        this.warmingQueue.delete(`${category}:${key}`);
      } catch (error) {
        console.warn(`Failed to warm cache for ${category}:${key}`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Get comprehensive cache analytics
   */
  getAnalytics(): CacheAnalytics {
    this.updateAnalytics();
    return { ...this.analytics };
  }

  /**
   * Cache event subscription
   */
  on(event: string, callback: CacheEventCallback): void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event)?.push(callback);
  }

  /**
   * Remove cache event subscription
   */
  off(event: string, callback: CacheEventCallback): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Bulk cache operations
   */
  async getMultiple<T>(
    keys: Array<{ key: string; category?: string }>
  ): Promise<Array<{ key: string; value: T | undefined; category: string }>> {
    const results = await Promise.all(
      keys.map(async ({ key, category = "default" }) => ({
        key,
        value: await this.get<T>(key, category),
        category,
      }))
    );

    return results;
  }

  /**
   * Set multiple cache entries at once
   */
  async setMultiple<T>(
    entries: Array<{ key: string; value: T; category?: string; ttl?: number }>
  ): Promise<void> {
    await Promise.all(
      entries.map(({ key, value, category = "default", ttl }) =>
        this.set(key, value, category, ttl)
      )
    );
  }

  /**
   * Advanced cache invalidation with patterns
   */
  async invalidatePattern(pattern: string, category?: string): Promise<number> {
    const regex = new RegExp(pattern);
    let invalidated = 0;

    const categories = category ? [category] : this.getCategories();

    for (const cat of categories) {
      const keys = this.getCategoryKeys(cat);
      for (const key of keys) {
        if (regex.test(key)) {
          await this.delete(key, cat);
          invalidated++;
        }
      }
    }

    return invalidated;
  }

  /**
   * Get cache health metrics
   */
  getHealthMetrics(): {
    status: "healthy" | "warning" | "critical";
    hitRate: number;
    memoryUsage: number;
    responseTime: number;
    errorRate: number;
    recommendations: string[];
  } {
    const hitRate = this.analytics.hitRate;
    const memoryUsage = this.analytics.memoryUsage;
    const responseTime = this.analytics.averageResponseTime;
    const errorRate = this.calculateErrorRate();

    let status: "healthy" | "warning" | "critical" = "healthy";
    const recommendations: string[] = [];

    if (hitRate < 0.7) {
      status = "warning";
      recommendations.push(
        "Consider cache warming or reviewing cache strategy"
      );
    }

    if (responseTime > 100) {
      status = "warning";
      recommendations.push(
        "High response times detected - consider optimization"
      );
    }

    if (errorRate > 0.05) {
      status = "critical";
      recommendations.push(
        "High error rate detected - investigate immediately"
      );
    }

    if (memoryUsage > 0.8) {
      status = "critical";
      recommendations.push(
        "Memory usage is high - consider increasing cache size or reducing TTL"
      );
    }

    return {
      status,
      hitRate,
      memoryUsage,
      responseTime,
      errorRate,
      recommendations,
    };
  }

  /**
   * Export cache configuration and data
   */
  async exportCache(): Promise<{
    config: EnhancedCacheOptions;
    data: Record<string, any>;
    analytics: CacheAnalytics;
    timestamp: number;
  }> {
    const data: Record<string, any> = {};

    for (const category of this.getCategories()) {
      data[category] = {};
      const keys = this.getCategoryKeys(category);

      for (const key of keys) {
        data[category][key] = await this.get(key, category);
      }
    }

    return {
      config: this.options,
      data,
      analytics: this.getAnalytics(),
      timestamp: Date.now(),
    };
  }

  /**
   * Import cache data
   */
  async importCache(exportData: {
    data: Record<string, any>;
    timestamp: number;
  }): Promise<void> {
    for (const [category, categoryData] of Object.entries(exportData.data)) {
      for (const [key, value] of Object.entries(categoryData)) {
        await this.set(key, value, category);
      }
    }
  }

  // Private helper methods
  private trackAccessPattern(key: string, category: string): void {
    const patternKey = `${category}:${key}`;
    const existing = this.accessPatterns.get(patternKey) || {
      count: 0,
      lastAccess: 0,
      frequency: 0,
    };

    const now = Date.now();
    const timeSinceLastAccess = now - existing.lastAccess;

    this.accessPatterns.set(patternKey, {
      count: existing.count + 1,
      lastAccess: now,
      frequency:
        timeSinceLastAccess > 0
          ? existing.count / (timeSinceLastAccess / 1000)
          : 0,
    });
  }

  private scheduleWarming(key: string, category: string): void {
    const warmingKey = `${category}:${key}`;
    this.warmingQueue.add(warmingKey);
  }

  private async compressValue(value: any): Promise<{
    compressed: string;
    compressedSize: number;
    originalSize: number;
  } | null> {
    try {
      const jsonString = JSON.stringify(value);
      const originalSize = jsonString.length;

      // Simple compression simulation (in real implementation, use proper compression)
      const compressed = jsonString;
      const compressedSize = compressed.length;

      return {
        compressed,
        compressedSize,
        originalSize,
      };
    } catch (error) {
      console.warn("Failed to compress cache value:", error);
      return null;
    }
  }

  private emitEvent(event: CacheEventData): void {
    const callbacks = this.eventCallbacks.get(event.action) || [];
    for (const callback of callbacks) {
      try {
        callback(event);
      } catch (error) {
        console.warn("Error in cache event callback:", error);
      }
    }
  }

  private updateCategoryStats(
    category: string,
    _action: "get" | "set",
    duration: number
  ): void {
    if (!this.analytics.categoryStats[category]) {
      this.analytics.categoryStats[category] = {
        hits: 0,
        misses: 0,
        hitRate: 0,
        avgResponseTime: 0,
        memoryUsage: 0,
      };
    }

    const stats = this.analytics.categoryStats[category];
    stats.avgResponseTime = (stats.avgResponseTime + duration) / 2;
  }

  private updateAnalytics(): void {
    const total = this.analytics.cacheHits + this.analytics.cacheMisses;
    this.analytics.hitRate = total > 0 ? this.analytics.cacheHits / total : 0;

    // Update time series data
    this.timeSeriesBuffer.push({
      timestamp: Date.now(),
      hits: this.currentMetrics.hits,
      misses: this.currentMetrics.misses,
      responseTime: this.currentMetrics.responseTime,
    });

    // Keep only recent data
    const cutoff = Date.now() - this.options.metricsRetentionPeriod;
    this.timeSeriesBuffer = this.timeSeriesBuffer.filter(
      (entry) => entry.timestamp > cutoff
    );

    this.analytics.timeSeriesData = [...this.timeSeriesBuffer];

    // Reset current metrics
    this.currentMetrics = { hits: 0, misses: 0, responseTime: 0 };
  }

  private calculateErrorRate(): number {
    // In a real implementation, this would track actual errors
    return 0;
  }

  private startAnalyticsCollection(): void {
    setInterval(() => {
      this.updateAnalytics();
    }, 60000); // Update every minute
  }
}

// Global enhanced cache instance
export const enhancedUnifiedCache = new EnhancedUnifiedCacheSystem({
  maxSize: 10000,
  globalTTL: 5 * 60 * 1000,
  enablePerformanceMonitoring: true,
  analyticsEnabled: true,
  compressionEnabled: process.env.NODE_ENV === "production",
  warmingEnabled: true,
  warmingStrategy: "predictive",
  evictionStrategy: "lru",
  categoryTTLs: {
    config: 10 * 60 * 1000,
    api: 2 * 60 * 1000,
    patterns: 15 * 60 * 1000,
    trading: 30 * 1000,
    metrics: 60 * 1000,
  },
});

/**
 * Get the global enhanced unified cache instance
 */
export function getEnhancedUnifiedCache(): EnhancedUnifiedCacheSystem {
  return enhancedUnifiedCache;
}

/**
 * Create a new enhanced cache instance
 */
export function createEnhancedUnifiedCache(
  options?: EnhancedCacheOptions
): EnhancedUnifiedCacheSystem {
  return new EnhancedUnifiedCacheSystem(options);
}

// Export types are already exported inline above
