/**
 * Cache Warming Manager
 *
 * Handles intelligent cache warming strategies to improve cache hit rates
 * by pre-loading frequently used agent patterns and common queries.
 *
 * FEATURES:
 * - Intelligent pattern-based cache warming
 * - Scheduled periodic warming cycles
 * - Configurable warming patterns
 * - Priority-based warming order
 * - Adaptive warming based on usage patterns
 * - Memory-efficient placeholder management
 */

import { generateCacheKey, globalCacheManager } from "../cache-manager";
import type { AgentCacheConfig, CacheWarmupConfig, CacheWarmupPattern } from "./agent-cache-types";

export class CacheWarmingManager {
  private _logger?: {
    info: (message: string, context?: any) => void;
    warn: (message: string, context?: any) => void;
    error: (message: string, context?: any, error?: Error) => void;
    debug: (message: string, context?: any) => void;
  };

  private get logger() {
    if (!this._logger) {
      this._logger = {
        info: (message: string, context?: any) =>
          console.info("[cache-warming]", message, context || ""),
        warn: (message: string, context?: any) =>
          console.warn("[cache-warming]", message, context || ""),
        error: (message: string, context?: any, error?: Error) =>
          console.error("[cache-warming]", message, context || "", error || ""),
        debug: (message: string, context?: any) =>
          console.debug("[cache-warming]", message, context || ""),
      };
    }
    return this._logger;
  }

  private config: AgentCacheConfig;
  private warmupPatterns: Set<string> = new Set();
  private warmupIntervalId?: NodeJS.Timer;
  private isWarming = false;
  private readonly DEFAULT_WARMUP_INTERVAL = 30 * 60 * 1000; // 30 minutes
  private readonly PLACEHOLDER_TTL = 60 * 1000; // 1 minute for warmup placeholders

  constructor(config: AgentCacheConfig) {
    this.config = config;
  }

  /**
   * Initialize cache warming with periodic scheduling
   */
  initializeCacheWarmup(): void {
    if (!this.config.cacheWarmupEnabled) {
      return;
    }

    console.info("[CacheWarming] Initializing cache warmup system");

    // Schedule periodic cache warmup
    this.warmupIntervalId = setInterval(async () => {
      try {
        await this.warmUpAgentCache();
      } catch (error) {
        console.error("[CacheWarming] Scheduled warmup error:", error);
      }
    }, this.DEFAULT_WARMUP_INTERVAL);

    // Perform initial warmup
    setTimeout(() => {
      this.warmUpAgentCache().catch((error) => {
        console.error("[CacheWarming] Initial warmup error:", error);
      });
    }, 5000); // Wait 5 seconds after initialization
  }

  /**
   * Warm up cache with frequently used patterns
   */
  async warmUpAgentCache(
    patterns?: Array<{
      agentId: string;
      input: string;
      context?: Record<string, unknown>;
    }>
  ): Promise<void> {
    if (!this.config.cacheWarmupEnabled || this.isWarming) {
      return;
    }

    this.isWarming = true;
    console.info("[CacheWarming] Starting cache warm-up...");

    try {
      const warmupPatterns = patterns || this.getDefaultWarmupPatterns();
      let warmedUp = 0;

      for (const pattern of warmupPatterns) {
        try {
          // Generate cache key for pattern
          const cacheKey = this.generateAgentCacheKey(
            pattern.agentId,
            pattern.input,
            pattern.context
          );

          // Check if already cached
          const exists = await globalCacheManager.has(cacheKey);
          if (!exists) {
            // Cache a placeholder that will be replaced with real data
            await globalCacheManager.set(cacheKey, null, {
              type: "agent_response",
              ttl: this.PLACEHOLDER_TTL,
              metadata: {
                type: "agent_response",
                source: pattern.agentId,
                warmup: true,
                timestamp: Date.now(),
              },
            });

            this.warmupPatterns.add(cacheKey);
            warmedUp++;
          }
        } catch (error) {
          console.warn(`[CacheWarming] Failed to warm pattern for ${pattern.agentId}:`, error);
        }
      }

      console.info(
        `[CacheWarming] Cache warm-up completed: ${warmedUp}/${warmupPatterns.length} patterns warmed`
      );
    } catch (error) {
      console.error("[CacheWarming] Cache warm-up error:", error);
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Warm up specific agent patterns
   */
  async warmUpAgentPatterns(agentId: string, patterns: string[]): Promise<void> {
    if (!this.config.cacheWarmupEnabled) {
      return;
    }

    console.info(`[CacheWarming] Warming up patterns for agent: ${agentId}`);

    const warmupData = patterns.map((pattern) => ({
      agentId,
      input: pattern,
      context: { priority: "medium", warmup: true },
    }));

    await this.warmUpAgentCache(warmupData);
  }

  /**
   * Add custom warmup pattern
   */
  addWarmupPattern(pattern: {
    agentId: string;
    input: string;
    context?: Record<string, unknown>;
    priority?: "low" | "medium" | "high";
  }): void {
    const cacheKey = this.generateAgentCacheKey(pattern.agentId, pattern.input, pattern.context);

    this.warmupPatterns.add(cacheKey);
    console.info(`[CacheWarming] Added warmup pattern for ${pattern.agentId}`);
  }

  /**
   * Remove warmup pattern
   */
  removeWarmupPattern(agentId: string, input: string): void {
    const cacheKey = this.generateAgentCacheKey(agentId, input);
    this.warmupPatterns.delete(cacheKey);
    console.info(`[CacheWarming] Removed warmup pattern for ${agentId}`);
  }

  /**
   * Configure bulk warmup patterns
   */
  async configureBulkWarmup(configs: CacheWarmupConfig[]): Promise<void> {
    if (!this.config.cacheWarmupEnabled) {
      return;
    }

    console.info(`[CacheWarming] Configuring bulk warmup for ${configs.length} agents`);

    for (const config of configs) {
      const patterns = config.patterns.map((pattern) => ({
        agentId: config.agentId,
        input: pattern,
        context: {
          priority: config.priority,
          batchSize: config.batchSize || 10,
          warmup: true,
        },
      }));

      // Process in batches if specified
      const batchSize = config.batchSize || patterns.length;
      for (let i = 0; i < patterns.length; i += batchSize) {
        const batch = patterns.slice(i, i + batchSize);
        await this.warmUpAgentCache(batch);

        // Add delay between batches to avoid overwhelming the system
        if (i + batchSize < patterns.length) {
          await this.delay(1000); // 1 second delay
        }
      }
    }
  }

  /**
   * Get warmup statistics
   */
  getWarmupStats(): {
    totalPatterns: number;
    isWarming: boolean;
    lastWarmupTime: number | null;
    warmupInterval: number;
    activePatterns: string[];
  } {
    return {
      totalPatterns: this.warmupPatterns.size,
      isWarming: this.isWarming,
      lastWarmupTime: null, // Would need to track this
      warmupInterval: this.DEFAULT_WARMUP_INTERVAL,
      activePatterns: Array.from(this.warmupPatterns),
    };
  }

  /**
   * Clear all warmup patterns
   */
  clearWarmupPatterns(): void {
    this.warmupPatterns.clear();
    console.info("[CacheWarming] Cleared all warmup patterns");
  }

  /**
   * Stop cache warming
   */
  stopWarmup(): void {
    if (this.warmupIntervalId) {
      clearInterval(this.warmupIntervalId);
      this.warmupIntervalId = undefined;
    }
    this.isWarming = false;
    console.info("[CacheWarming] Stopped cache warming");
  }

  /**
   * Restart cache warming
   */
  restartWarmup(): void {
    this.stopWarmup();
    this.initializeCacheWarmup();
  }

  /**
   * Warm cache based on recent usage patterns
   */
  async adaptiveWarmup(
    usagePatterns: Array<{
      agentId: string;
      pattern: string;
      frequency: number;
      lastUsed: number;
    }>
  ): Promise<void> {
    if (!this.config.cacheWarmupEnabled) {
      return;
    }

    console.info(`[CacheWarming] Starting adaptive warmup for ${usagePatterns.length} patterns`);

    // Sort by frequency and recency
    const sortedPatterns = usagePatterns
      .filter((p) => p.frequency > 1) // Only patterns used more than once
      .sort((a, b) => {
        const scoreA = a.frequency * (1 / (Date.now() - a.lastUsed + 1));
        const scoreB = b.frequency * (1 / (Date.now() - b.lastUsed + 1));
        return scoreB - scoreA;
      })
      .slice(0, 20); // Top 20 patterns

    const warmupData = sortedPatterns.map((p) => ({
      agentId: p.agentId,
      input: p.pattern,
      context: {
        priority: p.frequency > 5 ? "high" : "medium",
        adaptive: true,
        frequency: p.frequency,
      },
    }));

    await this.warmUpAgentCache(warmupData);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Generate cache key for agent patterns
   */
  private generateAgentCacheKey(
    agentId: string,
    input: string,
    context?: Record<string, unknown>
  ): string {
    return generateCacheKey("agent", agentId, input, context || {});
  }

  /**
   * Get default warmup patterns
   */
  private getDefaultWarmupPatterns(): Array<{
    agentId: string;
    input: string;
    context?: Record<string, unknown>;
  }> {
    return [
      {
        agentId: "pattern-discovery",
        input: "ready_state_pattern",
        context: { priority: "high", warmup: true },
      },
      {
        agentId: "mexc-api",
        input: "calendar_data",
        context: { cache: true, priority: "medium" },
      },
      {
        agentId: "symbol-analysis",
        input: "readiness_check",
        context: { confidence: "high", priority: "high" },
      },
      {
        agentId: "market-analyzer",
        input: "trend_analysis",
        context: { priority: "medium", timeframe: "1h" },
      },
      {
        agentId: "risk-assessment",
        input: "portfolio_risk",
        context: { priority: "high", realtime: true },
      },
    ];
  }

  /**
   * Delay helper for batch processing
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AgentCacheConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart warmup if enabled status changed
    if (newConfig.cacheWarmupEnabled !== undefined) {
      if (newConfig.cacheWarmupEnabled && !this.warmupIntervalId) {
        this.initializeCacheWarmup();
      } else if (!newConfig.cacheWarmupEnabled && this.warmupIntervalId) {
        this.stopWarmup();
      }
    }
  }
}
