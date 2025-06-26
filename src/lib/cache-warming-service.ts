/**
 * Cache Warming Service for MEXC Sniper Bot
 *
 * Phase 2 Implementation: Intelligent Cache Warming Strategies
 *
 * This service implements proactive cache warming for frequently accessed data:
 * - MEXC API responses for active symbols
 * - Pattern detection data for ready state symbols
 * - Activity data for promotional campaigns
 * - Market data for trending symbols
 * - User-specific trading configurations
 */

import { and, desc, eq, gte } from "drizzle-orm";
import { PatternDetectionCore } from "@/src/core/pattern-detection";
import { db } from "@/src/db";
import { coinActivities, monitoredListings } from "@/src/db/schemas/patterns";
import { UnifiedMexcServiceV2 } from "@/src/services/api/unified-mexc-service-v2";
import { type EnhancedUnifiedCacheSystem, getEnhancedUnifiedCache } from "./enhanced-unified-cache";

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface WarmupStrategy {
  name: string;
  priority: "critical" | "high" | "medium" | "low";
  frequency: number; // milliseconds
  enabled: boolean;
  lastRun?: number;
  successCount: number;
  errorCount: number;
  avgExecutionTime: number;
}

export interface WarmupMetrics {
  totalStrategies: number;
  activeStrategies: number;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  avgExecutionTime: number;
  lastWarmupTime: number;
  cacheHitImprovement: number;
}

export interface CacheWarmupConfig {
  enableAutoWarming: boolean;
  warmupInterval: number; // Base interval in milliseconds
  maxConcurrentWarmups: number;
  enableMetrics: boolean;
  strategies: {
    mexcSymbols: boolean;
    patternData: boolean;
    activityData: boolean;
    marketData: boolean;
    userConfigs: boolean;
  };
}

// ============================================================================
// Cache Warming Service Implementation
// ============================================================================

export class CacheWarmingService {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[cache-warming-service]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[cache-warming-service]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[cache-warming-service]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[cache-warming-service]", message, context || ""),
  };

  private cache: EnhancedUnifiedCacheSystem;
  private mexcService: UnifiedMexcServiceV2;
  private patternEngine: PatternDetectionCore;
  private config: CacheWarmupConfig;
  private strategies = new Map<string, WarmupStrategy>();
  private metrics: WarmupMetrics;
  private warmupInterval?: NodeJS.Timeout;
  private runningWarmups = new Set<string>();

  constructor(config: Partial<CacheWarmupConfig> = {}) {
    // Skip initialization during build time
    if (this.isBuildEnvironment()) {
      console.info("[CacheWarmingService] Skipping initialization - build environment detected");
      this.cache = this.createMockCache();
      this.mexcService = this.createMockMexcService();
      this.patternEngine = this.createMockPatternEngine();
    } else {
      this.cache = getEnhancedUnifiedCache();
      this.mexcService = new UnifiedMexcServiceV2();
      this.patternEngine = new PatternDetectionCore();
    }

    this.config = {
      enableAutoWarming: true,
      warmupInterval: 30000, // 30 seconds base interval
      maxConcurrentWarmups: 3,
      enableMetrics: true,
      strategies: {
        mexcSymbols: true,
        patternData: true,
        activityData: true,
        marketData: true,
        userConfigs: true,
      },
      ...config,
    };

    this.metrics = {
      totalStrategies: 0,
      activeStrategies: 0,
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      avgExecutionTime: 0,
      lastWarmupTime: 0,
      cacheHitImprovement: 0,
    };

    this.initializeStrategies();

    if (this.config.enableAutoWarming) {
      this.startAutoWarming();
    }
  }

  // ============================================================================
  // Environment and Mock Helpers
  // ============================================================================

  /**
   * Check if we're in a build environment
   */
  private isBuildEnvironment(): boolean {
    // Skip during any build-related environment
    if (
      // Standard build environments
      process.env.NODE_ENV === "production" &&
      (process.env.VERCEL_ENV === undefined || // Vercel build environment
        process.env.NEXT_PHASE === "phase-production-build" || // Next.js build phase
        process.env.BUILD_ID !== undefined || // Build environment indicator
        process.env.NEXT_BUILD === "true") // Build flag
    ) {
      return true;
    }

    // Skip during any Next.js build phase
    if (
      process.env.NEXT_PHASE === "phase-production-build" ||
      process.env.NEXT_BUILD === "true" ||
      process.env.STATIC_GENERATION === "true"
    ) {
      return true;
    }

    // Additional build environment detection
    if (
      // CI/CD environments
      process.env.CI === "true" ||
      process.env.GITHUB_ACTIONS === "true" ||
      process.env.VERCEL === "1" ||
      // Build processes
      process.env.npm_lifecycle_event === "build" ||
      process.env.npm_command === "run-script" ||
      // Static generation
      (typeof window === "undefined" && process.env.NODE_ENV === "production")
    ) {
      return true;
    }

    return false;
  }

  /**
   * Create mock cache for build environments
   */
  private createMockCache(): any {
    return {
      get: async () => null,
      set: async () => {},
      destroy: async () => {},
    };
  }

  /**
   * Create mock MEXC service for build environments
   */
  private createMockMexcService(): any {
    return {
      getSymbolInfoBasic: async () => ({ success: true, data: null }),
      getActivityData: async () => ({ success: true, data: [] }),
    };
  }

  /**
   * Create mock pattern engine for build environments
   */
  private createMockPatternEngine(): any {
    return {
      analyzeSymbolReadiness: async () => ({}),
    };
  }

  // ============================================================================
  // Strategy Initialization
  // ============================================================================

  private initializeStrategies(): void {
    // MEXC Symbols Strategy - Critical for trading operations
    if (this.config.strategies.mexcSymbols) {
      this.strategies.set("mexc-symbols", {
        name: "MEXC Active Symbols",
        priority: "critical",
        frequency: 15000, // 15 seconds
        enabled: true,
        successCount: 0,
        errorCount: 0,
        avgExecutionTime: 0,
      });
    }

    // Pattern Data Strategy - High priority for ready state detection
    if (this.config.strategies.patternData) {
      this.strategies.set("pattern-data", {
        name: "Pattern Detection Data",
        priority: "high",
        frequency: 20000, // 20 seconds
        enabled: true,
        successCount: 0,
        errorCount: 0,
        avgExecutionTime: 0,
      });
    }

    // Activity Data Strategy - High priority for promotional activities
    if (this.config.strategies.activityData) {
      this.strategies.set("activity-data", {
        name: "MEXC Activity Data",
        priority: "high",
        frequency: 25000, // 25 seconds
        enabled: true,
        successCount: 0,
        errorCount: 0,
        avgExecutionTime: 0,
      });
    }

    // Market Data Strategy - Medium priority for general market info
    if (this.config.strategies.marketData) {
      this.strategies.set("market-data", {
        name: "Market Data",
        priority: "medium",
        frequency: 45000, // 45 seconds
        enabled: true,
        successCount: 0,
        errorCount: 0,
        avgExecutionTime: 0,
      });
    }

    // User Configs Strategy - Low priority for user settings
    if (this.config.strategies.userConfigs) {
      this.strategies.set("user-configs", {
        name: "User Configurations",
        priority: "low",
        frequency: 120000, // 2 minutes
        enabled: true,
        successCount: 0,
        errorCount: 0,
        avgExecutionTime: 0,
      });
    }

    this.metrics.totalStrategies = this.strategies.size;
    this.metrics.activeStrategies = Array.from(this.strategies.values()).filter(
      (s) => s.enabled
    ).length;
  }

  // ============================================================================
  // Auto Warming Management
  // ============================================================================

  private startAutoWarming(): void {
    // Skip auto warming in build environments
    if (this.isBuildEnvironment()) {
      console.info("[CacheWarmingService] Skipping auto warming - build environment detected");
      return;
    }

    if (this.warmupInterval) {
      clearInterval(this.warmupInterval);
    }

    this.warmupInterval = setInterval(async () => {
      await this.performScheduledWarmup();
    }, this.config.warmupInterval);

    console.info("[CacheWarmingService] Auto warming started");
  }

  private async performScheduledWarmup(): Promise<void> {
    const now = Date.now();
    const eligibleStrategies = Array.from(this.strategies.entries())
      .filter(([name, strategy]) => {
        return (
          strategy.enabled &&
          !this.runningWarmups.has(name) &&
          (!strategy.lastRun || now - strategy.lastRun >= strategy.frequency)
        );
      })
      .sort(
        ([, a], [, b]) => this.getPriorityWeight(a.priority) - this.getPriorityWeight(b.priority)
      );

    // Limit concurrent warmups
    const toRun = eligibleStrategies.slice(0, this.config.maxConcurrentWarmups);

    if (toRun.length > 0) {
      await Promise.all(toRun.map(([name]) => this.executeStrategy(name)));
    }
  }

  private getPriorityWeight(priority: string): number {
    switch (priority) {
      case "critical":
        return 1;
      case "high":
        return 2;
      case "medium":
        return 3;
      case "low":
        return 4;
      default:
        return 5;
    }
  }

  // ============================================================================
  // Strategy Execution
  // ============================================================================

  async executeStrategy(strategyName: string): Promise<boolean> {
    const strategy = this.strategies.get(strategyName);
    if (!strategy || !strategy.enabled || this.runningWarmups.has(strategyName)) {
      return false;
    }

    this.runningWarmups.add(strategyName);
    const startTime = Date.now();

    try {
      console.info(`[CacheWarmingService] Executing strategy: ${strategy.name}`);

      switch (strategyName) {
        case "mexc-symbols":
          await this.warmupMexcSymbols();
          break;
        case "pattern-data":
          await this.warmupPatternData();
          break;
        case "activity-data":
          await this.warmupActivityData();
          break;
        case "market-data":
          await this.warmupMarketData();
          break;
        case "user-configs":
          await this.warmupUserConfigs();
          break;
        default:
          throw new Error(`Unknown strategy: ${strategyName}`);
      }

      // Update strategy metrics
      const executionTime = Date.now() - startTime;
      strategy.successCount++;
      strategy.lastRun = Date.now();
      strategy.avgExecutionTime = this.updateAverage(
        strategy.avgExecutionTime,
        executionTime,
        strategy.successCount
      );

      // Update global metrics
      this.metrics.totalRuns++;
      this.metrics.successfulRuns++;
      this.metrics.lastWarmupTime = Date.now();
      this.metrics.avgExecutionTime = this.updateAverage(
        this.metrics.avgExecutionTime,
        executionTime,
        this.metrics.totalRuns
      );

      console.info(
        `[CacheWarmingService] Strategy ${strategy.name} completed in ${executionTime}ms`
      );
      return true;
    } catch (error) {
      strategy.errorCount++;
      this.metrics.totalRuns++;
      this.metrics.failedRuns++;

      console.error(`[CacheWarmingService] Strategy ${strategy.name} failed:`, error);
      return false;
    } finally {
      this.runningWarmups.delete(strategyName);
    }
  }

  // ============================================================================
  // Individual Warming Strategies
  // ============================================================================

  private async warmupMexcSymbols(): Promise<void> {
    try {
      // Get active monitored listings
      const activeListings = await db
        .select()
        .from(monitoredListings)
        .where(
          and(
            eq(monitoredListings.status, "monitoring"),
            gte(monitoredListings.lastChecked, new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
          )
        )
        .limit(20); // Limit to top 20 active symbols

      // Warm up symbol data for each active listing
      for (const listing of activeListings) {
        const cacheKey = `mexc:symbol:${listing.symbolName}`;

        // Check if already cached
        const cached = await this.cache.get(cacheKey, "api_response");
        if (cached) continue;

        // Fetch and cache symbol data
        try {
          const symbolData = await this.mexcService.getSymbolInfoBasic(listing.symbolName);
          await this.cache.set(cacheKey, symbolData, "api_response", 5000); // 5 second TTL
        } catch (error) {
          console.warn(
            `[CacheWarmingService] Failed to warm up symbol ${listing.symbolName}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error("[CacheWarmingService] MEXC symbols warmup failed:", error);
      throw error;
    }
  }

  private async warmupPatternData(): Promise<void> {
    try {
      // Get symbols with ready patterns or high confidence
      const readySymbols = await db
        .select()
        .from(monitoredListings)
        .where(
          and(
            eq(monitoredListings.hasReadyPattern, true),
            gte(monitoredListings.confidence, 70) // High confidence symbols
          )
        )
        .orderBy(desc(monitoredListings.confidence))
        .limit(15);

      // Warm up pattern analysis for each symbol
      for (const symbol of readySymbols) {
        const cacheKey = `pattern:analysis:${symbol.symbolName}`;

        // Check if already cached
        const cached = await this.cache.get(cacheKey, "pattern_analysis");
        if (cached) continue;

        // Generate and cache pattern analysis
        try {
          // Construct SymbolEntry object from available data
          const symbolEntry = {
            cd: symbol.symbolName,
            sts: 2, // Default ready state
            st: 2, // Default ready state
            tt: 4, // Default trading type
            ca: symbol.confidence,
            ps: undefined,
            qs: undefined,
            ot: undefined,
          };
          const patternData = await this.patternEngine.analyzeSymbolReadiness(symbolEntry);
          await this.cache.set(cacheKey, patternData, "pattern_analysis", 30000); // 30 second TTL
        } catch (error) {
          console.warn(
            `[CacheWarmingService] Failed to warm up pattern for ${symbol.symbolName}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error("[CacheWarmingService] Pattern data warmup failed:", error);
      throw error;
    }
  }

  private async warmupActivityData(): Promise<void> {
    try {
      // Get recent active activities
      const recentActivities = await db
        .select()
        .from(coinActivities)
        .where(
          and(
            eq(coinActivities.isActive, true),
            gte(coinActivities.discoveredAt, new Date(Date.now() - 12 * 60 * 60 * 1000)) // Last 12 hours
          )
        )
        .orderBy(desc(coinActivities.priorityScore))
        .limit(10);

      // Warm up activity data for each currency
      const currencies = [...new Set(recentActivities.map((a) => a.currency))];

      for (const currency of currencies) {
        const cacheKey = `mexc:activity:${currency}`;

        // Check if already cached
        const cached = await this.cache.get(cacheKey, "api_response");
        if (cached) continue;

        // Fetch and cache activity data
        try {
          const activityData = await this.mexcService.getActivityData(currency);
          await this.cache.set(cacheKey, activityData, "api_response", 5000); // 5 second TTL
        } catch (error) {
          console.warn(`[CacheWarmingService] Failed to warm up activity for ${currency}:`, error);
        }
      }
    } catch (error) {
      console.error("[CacheWarmingService] Activity data warmup failed:", error);
      throw error;
    }
  }

  private async warmupMarketData(): Promise<void> {
    try {
      // Warm up general market data that's frequently accessed
      const marketDataKeys = ["mexc:market:overview", "mexc:market:trending", "mexc:market:volume"];

      for (const key of marketDataKeys) {
        // Check if already cached
        const cached = await this.cache.get(key, "market_data");
        if (cached) continue;

        // Generate placeholder market data (would be replaced with actual API calls)
        const marketData = {
          timestamp: Date.now(),
          type: key.split(":")[2],
          data: `Cached market data for ${key}`,
        };

        await this.cache.set(key, marketData, "market_data", 30000); // 30 second TTL
      }
    } catch (error) {
      console.error("[CacheWarmingService] Market data warmup failed:", error);
      throw error;
    }
  }

  private async warmupUserConfigs(): Promise<void> {
    try {
      // Warm up common user configuration data
      const configKeys = [
        "config:default:take-profit",
        "config:default:risk-management",
        "config:default:trading-pairs",
      ];

      for (const key of configKeys) {
        // Check if already cached
        const cached = await this.cache.get(key, "config");
        if (cached) continue;

        // Generate default configuration data
        const configData = {
          timestamp: Date.now(),
          type: key.split(":")[2],
          defaults: true,
        };

        await this.cache.set(key, configData, "config", 300000); // 5 minute TTL
      }
    } catch (error) {
      console.error("[CacheWarmingService] User configs warmup failed:", error);
      throw error;
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private updateAverage(currentAvg: number, newValue: number, count: number): number {
    return (currentAvg * (count - 1) + newValue) / count;
  }

  // ============================================================================
  // Public API
  // ============================================================================

  getMetrics(): WarmupMetrics {
    return { ...this.metrics };
  }

  getStrategies(): Map<string, WarmupStrategy> {
    return new Map(this.strategies);
  }

  async executeAllStrategies(): Promise<void> {
    const strategies = Array.from(this.strategies.keys());
    await Promise.all(strategies.map((name) => this.executeStrategy(name)));
  }

  enableStrategy(name: string): boolean {
    const strategy = this.strategies.get(name);
    if (strategy) {
      strategy.enabled = true;
      this.metrics.activeStrategies = Array.from(this.strategies.values()).filter(
        (s) => s.enabled
      ).length;
      return true;
    }
    return false;
  }

  disableStrategy(name: string): boolean {
    const strategy = this.strategies.get(name);
    if (strategy) {
      strategy.enabled = false;
      this.metrics.activeStrategies = Array.from(this.strategies.values()).filter(
        (s) => s.enabled
      ).length;
      return true;
    }
    return false;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy(): void {
    if (this.warmupInterval) {
      clearInterval(this.warmupInterval);
      this.warmupInterval = undefined;
    }

    this.runningWarmups.clear();
    this.strategies.clear();

    console.info("[CacheWarmingService] Service destroyed");
  }
}

// ============================================================================
// Global Cache Warming Instance
// ============================================================================

let globalCacheWarmingInstance: CacheWarmingService | null = null;

export function getCacheWarmingService(config?: Partial<CacheWarmupConfig>): CacheWarmingService {
  if (!globalCacheWarmingInstance || config) {
    globalCacheWarmingInstance = new CacheWarmingService(config);
  }
  return globalCacheWarmingInstance;
}

export function resetCacheWarmingService(): void {
  if (globalCacheWarmingInstance) {
    globalCacheWarmingInstance.destroy();
    globalCacheWarmingInstance = null;
  }
}

// ============================================================================
// Exports
// ============================================================================

export { CacheWarmingService as default };
