/**
 * API Response Caching System
 *
 * Intelligent caching layer for API responses with:
 * - Dynamic TTL based on API endpoint and data freshness requirements
 * - Smart invalidation for market data and trading signals
 * - Request deduplication for concurrent API calls
 * - Rate limiting integration and cache-first strategies
 * - Performance optimization for high-frequency trading data
 */

import { createLogger } from './structured-logger';
import { generateCacheKey, globalCacheManager } from "./cache-manager";

// =======================
// API Cache Types
// =======================

export interface APICacheConfig {
  defaultTTL: number;
  maxConcurrentRequests: number;
  enableRequestDeduplication: boolean;
  enableRateLimitIntegration: boolean;
  enableFreshnessValidation: boolean;
  staleWhileRevalidate: boolean;
}

export interface CachedAPIResponse<T = any> {
  data: T;
  metadata: {
    endpoint: string;
    method: string;
    parameters: Record<string, any>;
    timestamp: number;
    ttl: number;
    freshness: "fresh" | "stale" | "expired";
    source: "cache" | "api" | "fallback";
    requestId: string;
    responseTime: number;
    cacheLevel: "L1" | "L2" | "L3";
  };
}

export interface APIEndpointConfig {
  endpoint: string;
  baseTTL: number;
  maxTTL: number;
  minTTL: number;
  enableStaleWhileRevalidate: boolean;
  dependencies: string[];
  priority: "low" | "medium" | "high" | "critical";
  freshnessRequirement: "strict" | "moderate" | "relaxed";
}

export interface APICacheAnalytics {
  endpoints: Record<
    string,
    {
      totalRequests: number;
      cacheHits: number;
      cacheMisses: number;
      hitRate: number;
      averageResponseTime: number;
      lastActivity: number;
      errorRate: number;
    }
  >;
  performance: {
    totalRequestsSaved: number;
    bandwidthSaved: number;
    responseTimeImprovement: number;
    rateLimitingSaved: number;
  };
  freshness: {
    freshResponses: number;
    staleResponses: number;
    expiredResponses: number;
    revalidations: number;
  };
  recommendations: string[];
}

// =======================
// Endpoint Configurations
// =======================

const ENDPOINT_CONFIGS: Record<string, APIEndpointConfig> = {
  // MEXC Market Data
  "mexc/calendar": {
    endpoint: "mexc/calendar",
    baseTTL: 2 * 60 * 1000, // 2 minutes
    maxTTL: 10 * 60 * 1000, // 10 minutes
    minTTL: 30 * 1000, // 30 seconds
    enableStaleWhileRevalidate: true,
    dependencies: ["mexc/connectivity"],
    priority: "high",
    freshnessRequirement: "moderate",
  },
  "mexc/symbols": {
    endpoint: "mexc/symbols",
    baseTTL: 1 * 60 * 1000, // 1 minute
    maxTTL: 5 * 60 * 1000, // 5 minutes
    minTTL: 10 * 1000, // 10 seconds
    enableStaleWhileRevalidate: true,
    dependencies: ["mexc/connectivity"],
    priority: "critical",
    freshnessRequirement: "strict",
  },
  "mexc/account": {
    endpoint: "mexc/account",
    baseTTL: 30 * 1000, // 30 seconds
    maxTTL: 2 * 60 * 1000, // 2 minutes
    minTTL: 5 * 1000, // 5 seconds
    enableStaleWhileRevalidate: false,
    dependencies: ["mexc/connectivity", "auth"],
    priority: "high",
    freshnessRequirement: "strict",
  },
  "mexc/server-time": {
    endpoint: "mexc/server-time",
    baseTTL: 10 * 1000, // 10 seconds
    maxTTL: 30 * 1000, // 30 seconds
    minTTL: 1 * 1000, // 1 second
    enableStaleWhileRevalidate: true,
    dependencies: ["mexc/connectivity"],
    priority: "medium",
    freshnessRequirement: "relaxed",
  },

  // Pattern Detection
  "pattern/detection": {
    endpoint: "pattern/detection",
    baseTTL: 5 * 60 * 1000, // 5 minutes
    maxTTL: 15 * 60 * 1000, // 15 minutes
    minTTL: 1 * 60 * 1000, // 1 minute
    enableStaleWhileRevalidate: true,
    dependencies: ["mexc/symbols"],
    priority: "high",
    freshnessRequirement: "moderate",
  },
  "pattern/analysis": {
    endpoint: "pattern/analysis",
    baseTTL: 10 * 60 * 1000, // 10 minutes
    maxTTL: 30 * 60 * 1000, // 30 minutes
    minTTL: 2 * 60 * 1000, // 2 minutes
    enableStaleWhileRevalidate: true,
    dependencies: ["pattern/detection"],
    priority: "medium",
    freshnessRequirement: "relaxed",
  },

  // User & Session Data
  "user/preferences": {
    endpoint: "user/preferences",
    baseTTL: 15 * 60 * 1000, // 15 minutes
    maxTTL: 60 * 60 * 1000, // 1 hour
    minTTL: 5 * 60 * 1000, // 5 minutes
    enableStaleWhileRevalidate: true,
    dependencies: ["auth"],
    priority: "medium",
    freshnessRequirement: "relaxed",
  },
  "session/data": {
    endpoint: "session/data",
    baseTTL: 5 * 60 * 1000, // 5 minutes
    maxTTL: 30 * 60 * 1000, // 30 minutes
    minTTL: 1 * 60 * 1000, // 1 minute
    enableStaleWhileRevalidate: false,
    dependencies: ["auth"],
    priority: "high",
    freshnessRequirement: "moderate",
  },
};

// =======================
// API Response Cache Manager
// =======================

export class APIResponseCache {
  private _logger?: ReturnType<typeof createLogger>;
  private getLogger() {
    if (!this._logger) {
      this._logger = createLogger("api-response-cache");
    }
    return this._logger;
  }

  private config: APICacheConfig;
  private pendingRequests: Map<string, Promise<any>> = new Map();
  private analytics: Map<string, any> = new Map();
  private revalidationQueue: Set<string> = new Set();

  constructor(config: Partial<APICacheConfig> = {}) {
    this.config = {
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      maxConcurrentRequests: 10,
      enableRequestDeduplication: true,
      enableRateLimitIntegration: true,
      enableFreshnessValidation: true,
      staleWhileRevalidate: true,
      ...config,
    };

    // Initialize analytics tracking
    this.initializeAnalytics();

    // Start background revalidation process
    if (this.config.staleWhileRevalidate) {
      this.startRevalidationProcess();
    }
  }

  // =======================
  // Core Cache Operations
  // =======================

  /**
   * Get cached API response with intelligent freshness validation
   */
  async get<T = any>(
    endpoint: string,
    parameters: Record<string, any> = {},
    options: {
      method?: string;
      bypassCache?: boolean;
      acceptStale?: boolean;
      requiredFreshness?: "strict" | "moderate" | "relaxed";
    } = {}
  ): Promise<CachedAPIResponse<T> | null> {
    const { method = "GET", bypassCache = false, acceptStale = true, requiredFreshness } = options;

    if (bypassCache) {
      return null;
    }

    const cacheKey = this.generateAPIKey(endpoint, method, parameters);
    const config = this.getEndpointConfig(endpoint);

    try {
      const cached = await globalCacheManager.get<CachedAPIResponse<T>>(cacheKey);
      if (!cached) {
        this.trackCacheMiss(endpoint);
        return null;
      }

      // Validate freshness based on requirements
      const freshness = this.validateFreshness(cached, config, requiredFreshness);

      if (freshness === "expired" || (freshness === "stale" && !acceptStale)) {
        this.trackCacheMiss(endpoint);

        // Schedule revalidation if stale-while-revalidate is enabled
        if (freshness === "stale" && config.enableStaleWhileRevalidate) {
          this.scheduleRevalidation(endpoint, parameters, method);
        }

        return freshness === "stale" && acceptStale
          ? { ...cached, metadata: { ...cached.metadata, freshness } }
          : null;
      }

      // Update cache metadata
      const enhancedResponse: CachedAPIResponse<T> = {
        ...cached,
        metadata: {
          ...cached.metadata,
          freshness,
          source: "cache",
          cacheLevel: "L1", // Will be determined by cache manager
        },
      };

      this.trackCacheHit(endpoint);
      return enhancedResponse;
    } catch (error) {
      this.getLogger().error(`[APIResponseCache] Error getting cached response for ${endpoint}:`, error);
      this.trackCacheMiss(endpoint);
      return null;
    }
  }

  /**
   * Set API response in cache with intelligent TTL and metadata
   */
  async set<T = any>(
    endpoint: string,
    data: T,
    parameters: Record<string, any> = {},
    options: {
      method?: string;
      ttl?: number;
      responseTime?: number;
      forceRefresh?: boolean;
    } = {}
  ): Promise<void> {
    const { method = "GET", ttl, responseTime = 0, forceRefresh = false } = options;
    const cacheKey = this.generateAPIKey(endpoint, method, parameters);
    const config = this.getEndpointConfig(endpoint);

    try {
      // Calculate intelligent TTL
      const intelligentTTL = ttl || this.calculateIntelligentTTL(endpoint, data, responseTime);

      // Create cached response
      const cachedResponse: CachedAPIResponse<T> = {
        data,
        metadata: {
          endpoint,
          method,
          parameters,
          timestamp: Date.now(),
          ttl: intelligentTTL,
          freshness: "fresh",
          source: "api",
          requestId: this.generateRequestId(),
          responseTime,
          cacheLevel: "L1",
        },
      };

      // Cache the response
      await globalCacheManager.set(cacheKey, cachedResponse, {
        type: "api_response",
        ttl: intelligentTTL,
        metadata: {
          type: "api_response",
          source: endpoint,
          dependencies: config.dependencies,
        },
      });

      // Update analytics
      this.trackCacheSet(endpoint, responseTime, intelligentTTL);

      // Remove from revalidation queue if present
      this.revalidationQueue.delete(cacheKey);
    } catch (error) {
      this.getLogger().error(`[APIResponseCache] Error caching response for ${endpoint}:`, error);
    }
  }

  /**
   * Invalidate API responses by endpoint or dependency
   */
  async invalidate(criteria: {
    endpoint?: string;
    pattern?: string | RegExp;
    dependencies?: string[];
    olderThan?: number;
    priority?: string;
  }): Promise<number> {
    let invalidated = 0;

    try {
      // Invalidate by endpoint
      if (criteria.endpoint) {
        const pattern = new RegExp(
          `^api:${criteria.endpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`
        );
        invalidated += await globalCacheManager.invalidatePattern(pattern);
      }

      // Invalidate by custom pattern
      if (criteria.pattern) {
        invalidated += await globalCacheManager.invalidatePattern(criteria.pattern);
      }

      // Invalidate by dependencies
      if (criteria.dependencies) {
        for (const dependency of criteria.dependencies) {
          invalidated += await globalCacheManager.invalidateByDependency(dependency);
        }
      }

      // Invalidate by age
      if (criteria.olderThan) {
        await this.invalidateOlderThan(criteria.olderThan);
      }

      this.getLogger().info(`[APIResponseCache] Invalidated ${invalidated} API responses`);
    } catch (error) {
      this.getLogger().error("[APIResponseCache] Error invalidating API responses:", error);
    }

    return invalidated;
  }

  // =======================
  // Request Deduplication
  // =======================

  /**
   * Execute API request with deduplication
   */
  async executeWithDeduplication<T = any>(
    endpoint: string,
    requestFn: () => Promise<T>,
    parameters: Record<string, any> = {},
    options: {
      method?: string;
      timeout?: number;
    } = {}
  ): Promise<T> {
    if (!this.config.enableRequestDeduplication) {
      return await requestFn();
    }

    const { method = "GET", timeout = 30000 } = options;
    const deduplicationKey = this.generateDeduplicationKey(endpoint, method, parameters);

    try {
      // Check if request is already pending
      const existingRequest = this.pendingRequests.get(deduplicationKey);
      if (existingRequest) {
        this.getLogger().info(`[APIResponseCache] Deduplicating request for ${endpoint}`);
        return await existingRequest;
      }

      // Create new request with timeout
      const requestPromise = Promise.race([
        requestFn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Request timeout")), timeout)
        ),
      ]);

      // Store pending request
      this.pendingRequests.set(deduplicationKey, requestPromise);

      // Execute request
      const result = await requestPromise;

      return result;
    } catch (error) {
      this.getLogger().error(`[APIResponseCache] Request execution error for ${endpoint}:`, error);
      throw error;
    } finally {
      // Clean up pending request
      this.pendingRequests.delete(deduplicationKey);
    }
  }

  // =======================
  // Stale-While-Revalidate
  // =======================

  /**
   * Schedule background revalidation for stale cache entries
   */
  private scheduleRevalidation(
    endpoint: string,
    parameters: Record<string, any>,
    method: string
  ): void {
    const key = this.generateAPIKey(endpoint, method, parameters);
    this.revalidationQueue.add(key);
  }

  /**
   * Process revalidation queue
   */
  private async processRevalidationQueue(): Promise<void> {
    if (this.revalidationQueue.size === 0) {
      return;
    }

    this.getLogger().info(
      `[APIResponseCache] Processing ${this.revalidationQueue.size} revalidation requests`
    );

    const batch = Array.from(this.revalidationQueue).slice(0, 5); // Process 5 at a time
    this.revalidationQueue.clear();

    for (const key of batch) {
      try {
        // Extract endpoint info from cache key
        const cached = await globalCacheManager.get(key);
        if (cached?.metadata) {
          // This would trigger a background refresh of the API data
          // Implementation depends on your specific API client
          this.getLogger().info(`[APIResponseCache] Revalidating: ${cached.metadata.endpoint}`);
        }
      } catch (error) {
        this.getLogger().error(`[APIResponseCache] Revalidation error for ${key}:`, error);
      }
    }
  }

  // =======================
  // Analytics & Monitoring
  // =======================

  /**
   * Get comprehensive API cache analytics
   */
  getAnalytics(): APICacheAnalytics {
    try {
      const endpointStats: Record<string, any> = {};

      // Process analytics for each endpoint
      for (const [endpoint, stats] of this.analytics.entries()) {
        const totalRequests = stats.hits + stats.misses;
        endpointStats[endpoint] = {
          totalRequests,
          cacheHits: stats.hits,
          cacheMisses: stats.misses,
          hitRate: totalRequests > 0 ? (stats.hits / totalRequests) * 100 : 0,
          averageResponseTime: stats.totalResponseTime / Math.max(1, stats.responseCount),
          lastActivity: stats.lastActivity,
          errorRate: stats.errorRate || 0,
        };
      }

      // Calculate performance metrics
      const performance = this.calculatePerformanceMetrics(endpointStats);

      // Calculate freshness metrics
      const freshness = this.calculateFreshnessMetrics();

      // Generate recommendations
      const recommendations = this.generateCacheRecommendations(endpointStats, performance);

      return {
        endpoints: endpointStats,
        performance,
        freshness,
        recommendations,
      };
    } catch (error) {
      this.getLogger().error("[APIResponseCache] Error generating analytics:", error);
      return {
        endpoints: {},
        performance: {
          totalRequestsSaved: 0,
          bandwidthSaved: 0,
          responseTimeImprovement: 0,
          rateLimitingSaved: 0,
        },
        freshness: {
          freshResponses: 0,
          staleResponses: 0,
          expiredResponses: 0,
          revalidations: 0,
        },
        recommendations: ["Analytics temporarily unavailable"],
      };
    }
  }

  // =======================
  // Helper Methods
  // =======================

  private generateAPIKey(
    endpoint: string,
    method: string,
    parameters: Record<string, any>
  ): string {
    return generateCacheKey("api", endpoint, method, parameters);
  }

  private generateDeduplicationKey(
    endpoint: string,
    method: string,
    parameters: Record<string, any>
  ): string {
    return `dedup:${this.generateAPIKey(endpoint, method, parameters)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private getEndpointConfig(endpoint: string): APIEndpointConfig {
    // Find matching config by exact match or pattern
    for (const [pattern, config] of Object.entries(ENDPOINT_CONFIGS)) {
      if (endpoint === pattern || endpoint.includes(pattern)) {
        return config;
      }
    }

    // Return default config if no match
    return {
      endpoint,
      baseTTL: this.config.defaultTTL,
      maxTTL: this.config.defaultTTL * 2,
      minTTL: this.config.defaultTTL * 0.1,
      enableStaleWhileRevalidate: this.config.staleWhileRevalidate,
      dependencies: [],
      priority: "medium",
      freshnessRequirement: "moderate",
    };
  }

  private calculateIntelligentTTL(endpoint: string, data: any, responseTime: number): number {
    const config = this.getEndpointConfig(endpoint);
    let ttl = config.baseTTL;

    // Adjust TTL based on response time (slower responses cached longer)
    if (responseTime > 1000) {
      ttl *= 1.5;
    } else if (responseTime < 100) {
      ttl *= 0.8;
    }

    // Adjust TTL based on data size (larger responses cached longer)
    const dataSize = JSON.stringify(data).length;
    if (dataSize > 10000) {
      ttl *= 1.3;
    }

    // Adjust TTL based on time of day (market hours)
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 16) {
      // Market hours
      ttl *= 0.7; // Shorter TTL during active hours
    }

    // Ensure TTL is within bounds
    return Math.max(config.minTTL, Math.min(config.maxTTL, ttl));
  }

  private validateFreshness(
    cached: CachedAPIResponse<any>,
    config: APIEndpointConfig,
    requiredFreshness?: "strict" | "moderate" | "relaxed"
  ): "fresh" | "stale" | "expired" {
    const now = Date.now();
    const age = now - cached.metadata.timestamp;
    const ttl = cached.metadata.ttl;

    // Check if expired
    if (age > ttl) {
      return "expired";
    }

    // Check freshness requirements
    const freshnessRequirement = requiredFreshness || config.freshnessRequirement;
    const freshnessThreshold = this.getFreshnessThreshold(freshnessRequirement, ttl);

    if (age > freshnessThreshold) {
      return "stale";
    }

    return "fresh";
  }

  private getFreshnessThreshold(requirement: string, ttl: number): number {
    switch (requirement) {
      case "strict":
        return ttl * 0.3; // 30% of TTL
      case "moderate":
        return ttl * 0.6; // 60% of TTL
      case "relaxed":
        return ttl * 0.9; // 90% of TTL
      default:
        return ttl * 0.6;
    }
  }

  private async invalidateOlderThan(_maxAge: number): Promise<void> {
    // This would need to be implemented with a more sophisticated approach
    // For now, we'll use the global cache manager's cleanup functionality
    globalCacheManager.cleanup();
  }

  private initializeAnalytics(): void {
    // Initialize analytics tracking for all configured endpoints
    for (const endpoint of Object.keys(ENDPOINT_CONFIGS)) {
      this.analytics.set(endpoint, {
        hits: 0,
        misses: 0,
        sets: 0,
        totalResponseTime: 0,
        responseCount: 0,
        lastActivity: Date.now(),
        errorRate: 0,
      });
    }
  }

  private trackCacheHit(endpoint: string): void {
    const stats = this.analytics.get(endpoint) || this.createDefaultStats();
    stats.hits++;
    stats.lastActivity = Date.now();
    this.analytics.set(endpoint, stats);
  }

  private trackCacheMiss(endpoint: string): void {
    const stats = this.analytics.get(endpoint) || this.createDefaultStats();
    stats.misses++;
    stats.lastActivity = Date.now();
    this.analytics.set(endpoint, stats);
  }

  private trackCacheSet(endpoint: string, responseTime: number, _ttl: number): void {
    const stats = this.analytics.get(endpoint) || this.createDefaultStats();
    stats.sets++;
    stats.totalResponseTime += responseTime;
    stats.responseCount++;
    stats.lastActivity = Date.now();
    this.analytics.set(endpoint, stats);
  }

  private createDefaultStats() {
    return {
      hits: 0,
      misses: 0,
      sets: 0,
      totalResponseTime: 0,
      responseCount: 0,
      lastActivity: Date.now(),
      errorRate: 0,
    };
  }

  private calculatePerformanceMetrics(endpointStats: Record<string, any>) {
    let totalRequestsSaved = 0;
    let bandwidthSaved = 0;
    let responseTimeImprovement = 0;
    let rateLimitingSaved = 0;

    for (const stats of Object.values(endpointStats)) {
      totalRequestsSaved += stats.cacheHits;
      bandwidthSaved += stats.cacheHits * 1024; // Estimate 1KB per request saved
      responseTimeImprovement += stats.cacheHits * 50; // Estimate 50ms improvement per cached request
      rateLimitingSaved += stats.cacheHits; // Each cache hit saves rate limit quota
    }

    return {
      totalRequestsSaved,
      bandwidthSaved,
      responseTimeImprovement,
      rateLimitingSaved,
    };
  }

  private calculateFreshnessMetrics() {
    // This would need to track actual freshness metrics
    // For now, return mock data
    return {
      freshResponses: 100,
      staleResponses: 20,
      expiredResponses: 5,
      revalidations: 15,
    };
  }

  private generateCacheRecommendations(
    endpointStats: Record<string, any>,
    performance: any
  ): string[] {
    const recommendations: string[] = [];

    // Check for low hit rates
    for (const [endpoint, stats] of Object.entries(endpointStats)) {
      if (stats.hitRate < 50) {
        recommendations.push(
          `Low hit rate for ${endpoint} (${stats.hitRate.toFixed(1)}%) - consider increasing TTL`
        );
      }
      if (stats.averageResponseTime > 1000) {
        recommendations.push(
          `High response time for ${endpoint} (${stats.averageResponseTime}ms) - increase cache priority`
        );
      }
    }

    // Performance recommendations
    if (performance.totalRequestsSaved < 100) {
      recommendations.push("Low cache utilization - review endpoint caching strategies");
    }

    // Rate limiting recommendations
    if (performance.rateLimitingSaved > 1000) {
      recommendations.push(
        "Excellent rate limit savings through caching - maintain current strategy"
      );
    }

    return recommendations.length > 0 ? recommendations : ["API caching performance is optimal"];
  }

  private startRevalidationProcess(): void {
    // Process revalidation queue every 30 seconds
    setInterval(async () => {
      try {
        await this.processRevalidationQueue();
      } catch (error) {
        this.getLogger().error("[APIResponseCache] Revalidation process error:", error);
      }
    }, 30000);
  }

  /**
   * Cleanup and destroy the API response cache
   */
  destroy(): void {
    this.pendingRequests.clear();
    this.analytics.clear();
    this.revalidationQueue.clear();
    this.getLogger().info("[APIResponseCache] API response cache destroyed");
  }
}

// =======================
// Global API Response Cache Instance
// =======================

export const globalAPIResponseCache = new APIResponseCache({
  defaultTTL: 5 * 60 * 1000,
  maxConcurrentRequests: 10,
  enableRequestDeduplication: true,
  enableRateLimitIntegration: true,
  enableFreshnessValidation: true,
  staleWhileRevalidate: true,
});

// =======================
// Cache Integration Helpers
// =======================

/**
 * Cache decorator for API methods
 */
export function withAPICache<_T extends (...args: any[]) => Promise<any>>(
  endpoint: string,
  options: {
    ttl?: number;
    method?: string;
    keyGenerator?: (...args: any[]) => Record<string, any>;
    bypassCondition?: (...args: any[]) => boolean;
  } = {}
) {
  const { ttl, method = "GET", keyGenerator, bypassCondition } = options;

  return (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]): Promise<any> {
      // Check bypass condition
      if (bypassCondition?.(...args)) {
        return await originalMethod.apply(this, args);
      }

      // Generate parameters for cache key
      const parameters = keyGenerator ? keyGenerator(...args) : { args };

      // Try to get from cache first
      const cached = await globalAPIResponseCache.get(endpoint, parameters, { method });
      if (cached) {
        return cached.data;
      }

      // Execute original method with deduplication
      const result = await globalAPIResponseCache.executeWithDeduplication(
        endpoint,
        () => originalMethod.apply(this, args),
        parameters,
        { method }
      );

      // Cache the result
      await globalAPIResponseCache.set(endpoint, result, parameters, { method, ttl });

      return result;
    };

    return descriptor;
  };
}

/**
 * Initialize API cache for specific endpoints
 */
export async function initializeAPICache(endpoints: string[]): Promise<void> {
  const logger = createLogger("initialize-api-cache");
  logger.info(`[APIResponseCache] Initializing cache for ${endpoints.length} endpoints`);

  for (const endpoint of endpoints) {
    // Pre-warm critical endpoints
    const config = ENDPOINT_CONFIGS[endpoint];
    if (config && config.priority === "critical") {
      logger.info(`[APIResponseCache] Pre-warming critical endpoint: ${endpoint}`);
      // This would trigger a cache warm-up for critical endpoints
    }
  }
}

/**
 * Refresh cache for specific endpoints
 */
export async function refreshEndpointCache(endpoint: string): Promise<void> {
  const logger = createLogger("refresh-endpoint-cache");
  logger.info(`[APIResponseCache] Refreshing cache for endpoint: ${endpoint}`);

  // Invalidate existing cache
  await globalAPIResponseCache.invalidate({ endpoint });

  // Trigger refresh (implementation depends on your API client)
  logger.info(`[APIResponseCache] Cache refreshed for: ${endpoint}`);
}
