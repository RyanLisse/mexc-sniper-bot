/**
 * Performance Cache Optimizer
 *
 * High-performance caching layer that optimizes cache strategies based on usage patterns,
 * implements intelligent prefetching, and provides cache warming capabilities.
 */

import { performanceOptimizer } from "../performance-optimization";
import type { CacheManager } from "./cache-manager";
import { LRUCache } from "./lru-cache";
import type { CacheConfig, CacheDataType, CacheEntry } from "./types";

// ============================================================================
// Types and Interfaces
// ============================================================================

interface CacheOptimizationConfig {
  enableIntelligentPrefetch: boolean;
  enableAdaptiveTTL: boolean;
  enableCompressionThreshold: number; // bytes
  maxPrefetchConcurrency: number;
  adaptiveTTLMultiplier: number;
  compressionLevel: number;
}

interface CacheUsagePattern {
  key: string;
  accessCount: number;
  avgResponseTime: number;
  lastAccessed: number;
  predictedNextAccess: number;
  priority: "critical" | "high" | "medium" | "low";
}

interface PrefetchStrategy {
  keys: string[];
  probability: number;
  executionTime: number;
}

// ============================================================================
// Performance Cache Optimizer
// ============================================================================

export class PerformanceCacheOptimizer {
  private config: CacheOptimizationConfig;
  private usagePatterns = new Map<string, CacheUsagePattern>();
  private prefetchQueue = new Set<string>();
  private compressionCache = new LRUCache<string>(1000);
  private prefetchWorkers = new Set<Promise<void>>();

  constructor(
    private cacheManager: CacheManager,
    config: Partial<CacheOptimizationConfig> = {}
  ) {
    this.config = {
      enableIntelligentPrefetch: true,
      enableAdaptiveTTL: true,
      enableCompressionThreshold: 1024, // 1KB
      maxPrefetchConcurrency: 5,
      adaptiveTTLMultiplier: 1.5,
      compressionLevel: 6,
      ...config,
    };

    this.startOptimizationLoop();
  }

  // ============================================================================
  // Enhanced Cache Operations
  // ============================================================================

  async get<T>(key: string, type?: CacheDataType): Promise<T | null> {
    const startTime = performance.now();

    try {
      // Update usage pattern
      this.updateUsagePattern(key, startTime);

      // Check compressed cache first for large data
      if (this.compressionCache.has(key)) {
        const compressed = this.compressionCache.get(key);
        if (compressed) {
          const decompressed = await this.decompress(compressed);
          return JSON.parse(decompressed);
        }
      }

      // Get from main cache
      const result = await this.cacheManager.get<T>(key);

      if (result !== null) {
        // Trigger intelligent prefetch
        if (this.config.enableIntelligentPrefetch) {
          this.triggerIntelligentPrefetch(key, type);
        }
      }

      // Record performance
      const responseTime = performance.now() - startTime;
      this.recordAccess(key, responseTime, result !== null);

      return result;
    } catch (error) {
      console.warn("[PerformanceCacheOptimizer] Get operation failed:", error);
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    options: {
      ttl?: number;
      type?: CacheDataType;
      compress?: boolean;
      priority?: "critical" | "high" | "medium" | "low";
    } = {}
  ): Promise<boolean> {
    try {
      // Determine if compression should be used
      const serialized = JSON.stringify(value);
      const shouldCompress =
        options.compress ?? serialized.length > this.config.enableCompressionThreshold;

      // Apply adaptive TTL
      let ttl = options.ttl;
      if (this.config.enableAdaptiveTTL && !ttl) {
        ttl = this.calculateAdaptiveTTL(key, options.type);
      }

      if (shouldCompress) {
        // Store in compression cache
        const compressed = await this.compress(serialized);
        this.compressionCache.set(key, compressed, ttl || 300000); // 5 minutes default

        // Store metadata in main cache
        await this.cacheManager.set(
          key + ":meta",
          {
            compressed: true,
            size: serialized.length,
            type: options.type,
            timestamp: Date.now(),
          },
          { ttl }
        );
      }

      // Store in main cache
      const success = await this.cacheManager.set(key, value, { ttl, type: options.type });

      if (success && options.priority) {
        this.updatePriority(key, options.priority);
      }

      return success;
    } catch (error) {
      console.warn("[PerformanceCacheOptimizer] Set operation failed:", error);
      return false;
    }
  }

  // ============================================================================
  // Intelligent Prefetching
  // ============================================================================

  private async triggerIntelligentPrefetch(
    accessedKey: string,
    type?: CacheDataType
  ): Promise<void> {
    if (this.prefetchWorkers.size >= this.config.maxPrefetchConcurrency) {
      return;
    }

    const strategy = this.generatePrefetchStrategy(accessedKey, type);
    if (strategy.keys.length === 0) return;

    const worker = this.executePrefetchStrategy(strategy);
    this.prefetchWorkers.add(worker);

    worker.finally(() => {
      this.prefetchWorkers.delete(worker);
    });
  }

  private generatePrefetchStrategy(accessedKey: string, type?: CacheDataType): PrefetchStrategy {
    const relatedKeys: string[] = [];
    const currentTime = Date.now();

    // Find related keys based on patterns
    for (const [key, pattern] of Array.from(this.usagePatterns)) {
      if (key === accessedKey) continue;

      // Same type correlation
      if (type && key.includes(type)) {
        relatedKeys.push(key);
      }

      // Sequential access pattern
      if (Math.abs(pattern.lastAccessed - currentTime) < 5000) {
        relatedKeys.push(key);
      }

      // High frequency correlation
      if (pattern.accessCount > 10 && pattern.priority === "high") {
        relatedKeys.push(key);
      }
    }

    // Calculate prefetch probability
    const probability = Math.min(relatedKeys.length / 10, 0.8);

    return {
      keys: relatedKeys.slice(0, 5), // Limit to 5 keys
      probability,
      executionTime: currentTime,
    };
  }

  private async executePrefetchStrategy(strategy: PrefetchStrategy): Promise<void> {
    try {
      const prefetchPromises = strategy.keys.map(async (key) => {
        if (this.prefetchQueue.has(key)) return;

        this.prefetchQueue.add(key);

        try {
          // Simulate prefetch (in real implementation, this would pre-generate data)
          await new Promise((resolve) => setTimeout(resolve, 10));
          console.debug(`[PerformanceCacheOptimizer] Prefetched: ${key}`);
        } finally {
          this.prefetchQueue.delete(key);
        }
      });

      await Promise.allSettled(prefetchPromises);
    } catch (error) {
      console.warn("[PerformanceCacheOptimizer] Prefetch strategy failed:", error);
    }
  }

  // ============================================================================
  // Adaptive TTL Calculation
  // ============================================================================

  private calculateAdaptiveTTL(key: string, type?: CacheDataType): number {
    const pattern = this.usagePatterns.get(key);
    const baseTypeTTL = this.getBaseTypeTTL(type);

    if (!pattern) {
      return baseTypeTTL;
    }

    // Adjust TTL based on access frequency
    const accessFrequency =
      pattern.accessCount / Math.max((Date.now() - pattern.lastAccessed) / 1000, 1);

    let multiplier = 1;

    if (accessFrequency > 1) {
      // High frequency: longer TTL
      multiplier = this.config.adaptiveTTLMultiplier;
    } else if (accessFrequency < 0.1) {
      // Low frequency: shorter TTL
      multiplier = 0.5;
    }

    return Math.round(baseTypeTTL * multiplier);
  }

  private getBaseTypeTTL(type?: CacheDataType): number {
    const ttlMap: Record<CacheDataType, number> = {
      api_response: 5000, // 5 seconds
      agent_response: 30000, // 30 seconds
      market_data: 2000, // 2 seconds
      user_data: 300000, // 5 minutes
      config: 600000, // 10 minutes
      health_check: 10000, // 10 seconds
      workflow_result: 60000, // 1 minute
      pattern_analysis: 120000, // 2 minutes
      trading_signal: 3000, // 3 seconds
      session: 1800000, // 30 minutes
      generic: 60000, // 1 minute
      // Additional required types
      pattern_detection: 120000, // 2 minutes
      query_result: 300000, // 5 minutes
      session_data: 1800000, // 30 minutes
      user_preferences: 3600000, // 1 hour
      performance_metrics: 60000, // 1 minute
      health_status: 10000, // 10 seconds
    };

    return ttlMap[type || "generic"];
  }

  // ============================================================================
  // Compression Utilities
  // ============================================================================

  private async compress(data: string): Promise<string> {
    // Simple compression simulation (in production, use proper compression)
    if (typeof window !== "undefined" && "CompressionStream" in window) {
      try {
        const stream = new CompressionStream("gzip");
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        writer.write(new TextEncoder().encode(data));
        writer.close();

        const chunks: Uint8Array[] = [];
        let result = await reader.read();

        while (!result.done) {
          chunks.push(result.value);
          result = await reader.read();
        }

        const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));

        let offset = 0;
        for (const chunk of Array.from(chunks)) {
          compressed.set(chunk, offset);
          offset += chunk.length;
        }

        return btoa(String.fromCharCode(...Array.from(compressed)));
      } catch (error) {
        console.warn("[PerformanceCacheOptimizer] Compression failed:", error);
      }
    }

    // Fallback: simple base64 encoding
    return btoa(data);
  }

  private async decompress(compressedData: string): Promise<string> {
    // Simple decompression simulation
    if (typeof window !== "undefined" && "DecompressionStream" in window) {
      try {
        const stream = new DecompressionStream("gzip");
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        const compressed = Uint8Array.from(atob(compressedData), (c) => c.charCodeAt(0));

        writer.write(compressed);
        writer.close();

        const chunks: Uint8Array[] = [];
        let result = await reader.read();

        while (!result.done) {
          chunks.push(result.value);
          result = await reader.read();
        }

        const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));

        let offset = 0;
        for (const chunk of Array.from(chunks)) {
          decompressed.set(chunk, offset);
          offset += chunk.length;
        }

        return new TextDecoder().decode(decompressed);
      } catch (error) {
        console.warn("[PerformanceCacheOptimizer] Decompression failed:", error);
      }
    }

    // Fallback: simple base64 decoding
    return atob(compressedData);
  }

  // ============================================================================
  // Usage Pattern Tracking
  // ============================================================================

  private updateUsagePattern(key: string, accessTime: number): void {
    const existing = this.usagePatterns.get(key);
    const currentTime = Date.now();

    if (existing) {
      existing.accessCount++;
      existing.lastAccessed = currentTime;
      existing.avgResponseTime = (existing.avgResponseTime + accessTime) / 2;

      // Predict next access based on pattern
      const timeSinceLastAccess = currentTime - existing.lastAccessed;
      existing.predictedNextAccess = currentTime + timeSinceLastAccess;

      // Update priority based on frequency
      if (existing.accessCount > 50) {
        existing.priority = "critical";
      } else if (existing.accessCount > 20) {
        existing.priority = "high";
      } else if (existing.accessCount > 5) {
        existing.priority = "medium";
      }
    } else {
      this.usagePatterns.set(key, {
        key,
        accessCount: 1,
        avgResponseTime: accessTime,
        lastAccessed: currentTime,
        predictedNextAccess: currentTime + 60000, // Default 1 minute
        priority: "low",
      });
    }
  }

  private recordAccess(key: string, responseTime: number, hit: boolean): void {
    if (this.config.enableIntelligentPrefetch) {
      performanceOptimizer
        .trackComponentLoad(`cache-${key}`, async () => {
          return { hit, responseTime };
        })
        .catch(() => {});
    }
  }

  private updatePriority(key: string, priority: "critical" | "high" | "medium" | "low"): void {
    const pattern = this.usagePatterns.get(key);
    if (pattern) {
      pattern.priority = priority;
    }
  }

  // ============================================================================
  // Optimization Loop
  // ============================================================================

  private startOptimizationLoop(): void {
    // Clean up old patterns every 5 minutes
    setInterval(() => {
      this.cleanupOldPatterns();
    }, 300000);

    // Optimize cache every minute
    setInterval(() => {
      this.optimizeCache();
    }, 60000);
  }

  private cleanupOldPatterns(): void {
    const cutoffTime = Date.now() - 3600000; // 1 hour

    for (const [key, pattern] of Array.from(this.usagePatterns)) {
      if (pattern.lastAccessed < cutoffTime && pattern.accessCount < 5) {
        this.usagePatterns.delete(key);
      }
    }
  }

  private optimizeCache(): void {
    // Get cache statistics
    const analytics = performanceOptimizer.getPerformanceAnalytics();

    if (analytics.averageLoadTime > 1000) {
      console.info("[PerformanceCacheOptimizer] High cache latency detected, optimizing...");

      // Preload critical patterns
      for (const [key, pattern] of Array.from(this.usagePatterns)) {
        if (pattern.priority === "critical" && pattern.predictedNextAccess < Date.now() + 300000) {
          this.triggerIntelligentPrefetch(key);
        }
      }
    }
  }

  // ============================================================================
  // Public API
  // ============================================================================

  getUsagePatterns(): Map<string, CacheUsagePattern> {
    return new Map(this.usagePatterns);
  }

  getCacheStats(): {
    totalPatterns: number;
    prefetchQueueSize: number;
    compressionCacheSize: number;
    activeWorkers: number;
  } {
    return {
      totalPatterns: this.usagePatterns.size,
      prefetchQueueSize: this.prefetchQueue.size,
      compressionCacheSize: this.compressionCache.size(),
      activeWorkers: this.prefetchWorkers.size,
    };
  }

  async warmupCache(keys: string[]): Promise<void> {
    const warmupPromises = keys.map((key) => this.get(key));
    await Promise.allSettled(warmupPromises);
    console.info(`[PerformanceCacheOptimizer] Warmed up ${keys.length} cache entries`);
  }

  clearOptimizations(): void {
    this.usagePatterns.clear();
    this.prefetchQueue.clear();
    this.compressionCache.clear();
  }
}

// ============================================================================
// Global Instance and Exports
// ============================================================================

let globalOptimizer: PerformanceCacheOptimizer | null = null;

export function getPerformanceCacheOptimizer(
  cacheManager?: CacheManager,
  config?: Partial<CacheOptimizationConfig>
): PerformanceCacheOptimizer {
  if (!globalOptimizer && cacheManager) {
    globalOptimizer = new PerformanceCacheOptimizer(cacheManager, config);
  }
  return globalOptimizer!;
}

// PerformanceCacheOptimizer is already exported above
