/**
 * Real-Time Trigger Engine for Auto-Sniping
 *
 * Provides ultra-fast detection and execution of auto-sniping opportunities
 * with real-time WebSocket integration and optimized execution paths.
 */

import { EventEmitter } from "node:events";
import { toSafeError } from "@/src/lib/error-type-utils";
import { createCoordinatedApiBreaker } from "@/src/services/data/coordinated-circuit-breaker";
import type { PatternMatch } from "@/src/services/data/pattern-detection/pattern-types";
import type {
  Position,
  ServiceResponse,
} from "../consolidated/core-trading/types";

export interface RealTimeTriggerConfig {
  enableRealTimeTriggers: boolean;
  maxConcurrentExecutions: number;
  rapidExecutionThreshold: number; // confidence threshold for rapid execution
  websocketHeartbeatInterval: number;
  triggerCooldownMs: number;
  speedOptimization: {
    useParallelProcessing: boolean;
    skipNonCriticalValidation: boolean;
    preloadMarketData: boolean;
    cachePositionData: boolean;
  };
}

export interface TriggerEvent {
  type: "pattern_detected" | "price_change" | "volume_spike" | "ready_state";
  symbol: string;
  confidence: number;
  timestamp: number;
  data: any;
  source: "websocket" | "polling" | "pattern_detection";
}

export interface RapidExecutionMetrics {
  totalTriggers: number;
  rapidExecutions: number;
  averageExecutionTime: number;
  successRate: number;
  lastExecutionTime: number | null;
  concurrentExecutions: number;
  websocketConnected: boolean;
  realTimeEnabled: boolean;
}

export class RealTimeTriggerEngine extends EventEmitter {
  private config: RealTimeTriggerConfig;
  private circuitBreaker = createCoordinatedApiBreaker("real-time-trigger");
  private metrics: RapidExecutionMetrics;
  private executionQueue = new Map<string, TriggerEvent>();
  private concurrentExecutions = new Set<string>();
  private lastTriggerTime = new Map<string, number>();
  private websocketConnected = false;
  private preloadedMarketData = new Map<string, number>();
  private positionCache = new Map<string, Position>();
  private volumeHistoryCache = new Map<
    string,
    Array<{
      timestamp: number;
      volume: number;
      hour: number;
    }>
  >();

  private logger = {
    info: (message: string, context?: any) =>
      console.info("[real-time-trigger]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[real-time-trigger]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[real-time-trigger]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[real-time-trigger]", message, context || ""),
  };

  constructor(config: Partial<RealTimeTriggerConfig> = {}) {
    super();

    this.config = {
      enableRealTimeTriggers: true,
      maxConcurrentExecutions: 5,
      rapidExecutionThreshold: 85,
      websocketHeartbeatInterval: 30000,
      triggerCooldownMs: 1000,
      speedOptimization: {
        useParallelProcessing: true,
        skipNonCriticalValidation: false,
        preloadMarketData: true,
        cachePositionData: true,
      },
      ...config,
    };

    this.metrics = {
      totalTriggers: 0,
      rapidExecutions: 0,
      averageExecutionTime: 0,
      successRate: 0,
      lastExecutionTime: null,
      concurrentExecutions: 0,
      websocketConnected: false,
      realTimeEnabled: this.config.enableRealTimeTriggers,
    };

    this.setupEventListeners();
    this.startHealthMonitoring();
  }

  /**
   * Initialize the real-time trigger engine
   */
  async initialize(): Promise<void> {
    this.logger.info("Initializing Real-Time Trigger Engine", {
      config: this.config,
    });

    if (this.config.speedOptimization.preloadMarketData) {
      await this.preloadCriticalMarketData();
    }

    // Setup WebSocket connection monitoring
    this.setupWebSocketMonitoring();

    this.logger.info("Real-Time Trigger Engine initialized successfully");
  }

  /**
   * Process pattern detection event for rapid execution
   */
  async processPatternEvent(
    patterns: PatternMatch[]
  ): Promise<ServiceResponse<void>> {
    if (!this.config.enableRealTimeTriggers) {
      return { success: true, timestamp: new Date().toISOString() };
    }

    return this.circuitBreaker.execute(async () => {
      const highConfidencePatterns = patterns.filter(
        (pattern) => pattern.confidence >= this.config.rapidExecutionThreshold
      );

      if (highConfidencePatterns.length === 0) {
        return { success: true, timestamp: new Date().toISOString() };
      }

      this.logger.info(
        `Processing ${highConfidencePatterns.length} high-confidence patterns`,
        {
          totalPatterns: patterns.length,
          highConfidenceCount: highConfidencePatterns.length,
          threshold: this.config.rapidExecutionThreshold,
        }
      );

      // Process patterns in parallel for speed
      if (this.config.speedOptimization.useParallelProcessing) {
        await Promise.allSettled(
          highConfidencePatterns.map((pattern) =>
            this.processIndividualPattern(pattern)
          )
        );
      } else {
        for (const pattern of highConfidencePatterns) {
          await this.processIndividualPattern(pattern);
        }
      }

      return { success: true, timestamp: new Date().toISOString() };
    });
  }

  /**
   * Process individual pattern with rapid execution
   */
  private async processIndividualPattern(pattern: PatternMatch): Promise<void> {
    const startTime = Date.now();
    const symbol = pattern.symbol;

    try {
      // Check cooldown to prevent spam
      if (this.isInCooldown(symbol)) {
        this.logger.debug(`Pattern processing skipped due to cooldown`, {
          symbol,
        });
        return;
      }

      // Check concurrent execution limits
      if (
        this.concurrentExecutions.size >= this.config.maxConcurrentExecutions
      ) {
        this.logger.warn(`Max concurrent executions reached`, {
          current: this.concurrentExecutions.size,
          max: this.config.maxConcurrentExecutions,
        });
        return;
      }

      this.concurrentExecutions.add(symbol);
      this.lastTriggerTime.set(symbol, Date.now());
      this.metrics.totalTriggers++;

      // Create trigger event
      const triggerEvent: TriggerEvent = {
        type: "pattern_detected",
        symbol,
        confidence: pattern.confidence,
        timestamp: Date.now(),
        data: pattern,
        source: "pattern_detection",
      };

      // Queue for rapid execution
      this.executionQueue.set(symbol, triggerEvent);

      // Emit for auto-sniping engine
      this.emit("rapid_trigger", {
        symbol,
        confidence: pattern.confidence,
        pattern,
        executionTime: Date.now() - startTime,
      });

      this.logger.info(`Pattern processed for rapid execution`, {
        symbol,
        confidence: pattern.confidence,
        patternType: pattern.patternType,
        executionTime: Date.now() - startTime,
      });

      this.metrics.rapidExecutions++;
      this.updateExecutionMetrics(Date.now() - startTime);
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error(`Pattern processing failed`, {
        symbol,
        error: safeError.message,
        pattern: pattern.patternType,
      });
    } finally {
      this.concurrentExecutions.delete(symbol);
      this.metrics.concurrentExecutions = this.concurrentExecutions.size;
    }
  }

  /**
   * Process real-time market data updates
   */
  async processMarketDataUpdate(
    symbol: string,
    price: number,
    volume?: number
  ): Promise<void> {
    if (!this.config.enableRealTimeTriggers) return;

    try {
      // Cache price data for rapid access
      if (this.config.speedOptimization.cachePositionData) {
        this.preloadedMarketData.set(symbol, price);
      }

      // Detect volume spikes
      if (volume && this.shouldTriggerVolumeAlert(symbol, volume)) {
        const triggerEvent: TriggerEvent = {
          type: "volume_spike",
          symbol,
          confidence: 80, // Fixed confidence for volume spikes
          timestamp: Date.now(),
          data: { price, volume },
          source: "websocket",
        };

        this.emit("volume_spike", triggerEvent);
      }

      // Detect significant price movements
      if (this.shouldTriggerPriceAlert(symbol, price)) {
        const triggerEvent: TriggerEvent = {
          type: "price_change",
          symbol,
          confidence: 75, // Fixed confidence for price changes
          timestamp: Date.now(),
          data: { price, volume },
          source: "websocket",
        };

        this.emit("price_alert", triggerEvent);
      }
    } catch (error) {
      this.logger.error(`Market data processing failed`, {
        symbol,
        price,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get pending execution queue
   */
  getPendingExecutions(): TriggerEvent[] {
    return Array.from(this.executionQueue.values());
  }

  /**
   * Clear execution queue for a symbol
   */
  clearExecutionQueue(symbol?: string): void {
    if (symbol) {
      this.executionQueue.delete(symbol);
    } else {
      this.executionQueue.clear();
    }
  }

  /**
   * Get real-time execution metrics
   */
  getMetrics(): RapidExecutionMetrics {
    return { ...this.metrics };
  }

  /**
   * Update configuration during runtime
   */
  updateConfig(newConfig: Partial<RealTimeTriggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.metrics.realTimeEnabled = this.config.enableRealTimeTriggers;

    this.logger.info("Configuration updated", { newConfig });
  }

  /**
   * Get volume history cache statistics
   */
  getVolumeHistoryStats(): {
    totalSymbols: number;
    totalDataPoints: number;
    oldestDataAge: number;
    newestDataAge: number;
    averageDataPointsPerSymbol: number;
    memoryUsageEstimate: string;
  } {
    let totalDataPoints = 0;
    let oldestTimestamp = Date.now();
    let newestTimestamp = 0;

    for (const [_symbol, data] of this.volumeHistoryCache.entries()) {
      totalDataPoints += data.length;

      if (data.length > 0) {
        const symbolOldest = Math.min(...data.map((d) => d.timestamp));
        const symbolNewest = Math.max(...data.map((d) => d.timestamp));

        if (symbolOldest < oldestTimestamp) {
          oldestTimestamp = symbolOldest;
        }
        if (symbolNewest > newestTimestamp) {
          newestTimestamp = symbolNewest;
        }
      }
    }

    const now = Date.now();
    const symbolCount = this.volumeHistoryCache.size;

    return {
      totalSymbols: symbolCount,
      totalDataPoints,
      oldestDataAge:
        symbolCount > 0
          ? Math.round((now - oldestTimestamp) / (60 * 60 * 1000))
          : 0,
      newestDataAge:
        symbolCount > 0 ? Math.round((now - newestTimestamp) / (60 * 1000)) : 0,
      averageDataPointsPerSymbol:
        symbolCount > 0 ? Math.round(totalDataPoints / symbolCount) : 0,
      memoryUsageEstimate: `~${Math.round((totalDataPoints * 24) / 1024)}KB`, // Rough estimate
    };
  }

  /**
   * Enable/disable real-time triggers
   */
  setRealTimeEnabled(enabled: boolean): void {
    this.config.enableRealTimeTriggers = enabled;
    this.metrics.realTimeEnabled = enabled;

    if (!enabled) {
      this.executionQueue.clear();
      this.concurrentExecutions.clear();
    }

    this.logger.info(`Real-time triggers ${enabled ? "enabled" : "disabled"}`);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private setupEventListeners(): void {
    // Listen for pattern detection events
    this.on("patterns_detected", (event) => {
      if (event.matches && Array.isArray(event.matches)) {
        this.processPatternEvent(event.matches).catch((error) => {
          this.logger.error("Pattern event processing failed", error);
        });
      }
    });

    // Listen for WebSocket connection changes
    this.on("websocket_connected", () => {
      this.websocketConnected = true;
      this.metrics.websocketConnected = true;
      this.logger.info("WebSocket connected - real-time triggers active");
    });

    this.on("websocket_disconnected", () => {
      this.websocketConnected = false;
      this.metrics.websocketConnected = false;
      this.logger.warn("WebSocket disconnected - falling back to polling");
    });
  }

  private setupWebSocketMonitoring(): void {
    // Start WebSocket heartbeat monitoring
    setInterval(() => {
      this.emit("websocket_heartbeat_check");
    }, this.config.websocketHeartbeatInterval);
  }

  private startHealthMonitoring(): void {
    setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Check every 30 seconds
  }

  private performHealthCheck(): void {
    // Update circuit breaker health
    const isHealthy = this.circuitBreaker.isHealthy();

    // Log health status
    this.logger.debug("Health check completed", {
      circuitBreakerHealthy: isHealthy,
      websocketConnected: this.websocketConnected,
      concurrentExecutions: this.concurrentExecutions.size,
      queuedExecutions: this.executionQueue.size,
      totalTriggers: this.metrics.totalTriggers,
    });

    // Emit health status
    this.emit("health_check", {
      healthy: isHealthy && this.websocketConnected,
      metrics: this.metrics,
    });
  }

  private isInCooldown(symbol: string): boolean {
    const lastTrigger = this.lastTriggerTime.get(symbol);
    if (!lastTrigger) return false;

    return Date.now() - lastTrigger < this.config.triggerCooldownMs;
  }

  private shouldTriggerVolumeAlert(symbol: string, volume: number): boolean {
    // Get historical volume data for this symbol
    const historicalVolume = this.getHistoricalAverageVolume(symbol);

    // No historical data available - use conservative threshold
    if (!historicalVolume) {
      // For new symbols, use minimum significant volume threshold
      return volume > 100000; // 100K minimum volume for new listings
    }

    // Calculate volume spike - trigger if current volume is 3x or more than average
    const volumeMultiplier = volume / historicalVolume;
    const isSignificantSpike = volumeMultiplier >= 3.0;

    // Also ensure minimum absolute volume threshold
    const meetsMinimumVolume = volume > 50000;

    if (isSignificantSpike && meetsMinimumVolume) {
      this.logger.debug(`Volume spike detected for ${symbol}`, {
        currentVolume: volume,
        historicalAverage: historicalVolume,
        multiplier: volumeMultiplier.toFixed(2),
      });
    }

    return isSignificantSpike && meetsMinimumVolume;
  }

  private shouldTriggerPriceAlert(symbol: string, price: number): boolean {
    const cachedPrice = this.preloadedMarketData.get(symbol);
    if (!cachedPrice) return false;

    // Trigger on 5% price movement
    const changePercent = Math.abs((price - cachedPrice) / cachedPrice) * 100;
    return changePercent >= 5;
  }

  private async preloadCriticalMarketData(): Promise<void> {
    try {
      this.logger.info(
        "Preloading critical market data for speed optimization"
      );

      // Get active monitoring targets from database
      const { db } = await import("@/src/db");
      const { snipeTargets } = await import("@/src/db/schemas/trading");
      const { eq, and, isNull } = await import("drizzle-orm");

      const activeTargets = await db
        .select()
        .from(snipeTargets)
        .where(
          and(
            eq(snipeTargets.status, "ready"),
            isNull(snipeTargets.actualExecutionTime)
          )
        )
        .limit(50); // Limit to 50 most critical symbols

      // Load current market prices for active targets
      const { UnifiedMexcServiceV2 } = await import(
        "../../api/unified-mexc-service-v2"
      );
      const mexcService = UnifiedMexcServiceV2.getInstance();

      const pricePromises = activeTargets.map(async (target) => {
        try {
          // Get 24hr ticker data which includes current price and volume
          const tickerData = await mexcService.get24hrTicker(target.symbolName);

          if (tickerData?.lastPrice) {
            const price = parseFloat(tickerData.lastPrice);
            const volume = parseFloat(tickerData.volume || "0");

            // Cache current price for price movement detection
            this.preloadedMarketData.set(target.symbolName, price);

            // Store volume data for historical comparison
            this.storeVolumeHistory(target.symbolName, volume);

            this.logger.debug(
              `Preloaded market data for ${target.symbolName}`,
              {
                price,
                volume: volume.toLocaleString(),
                priceChangePercent: tickerData.priceChangePercent,
              }
            );
          }
        } catch (error) {
          // Individual symbol failures shouldn't stop the entire preload
          this.logger.debug(
            `Failed to preload data for ${target.symbolName}:`,
            error
          );
        }
      });

      // Execute all price fetches in parallel with timeout
      await Promise.allSettled(pricePromises);

      this.logger.info(
        `Successfully preloaded market data for ${this.preloadedMarketData.size} symbols`
      );
    } catch (error) {
      this.logger.warn("Market data preloading failed", error);
    }
  }

  private updateExecutionMetrics(executionTime: number): void {
    this.metrics.lastExecutionTime = Date.now();

    // Update average execution time
    const currentAvg = this.metrics.averageExecutionTime;
    const totalExecutions = this.metrics.rapidExecutions;

    this.metrics.averageExecutionTime =
      (currentAvg * (totalExecutions - 1) + executionTime) / totalExecutions;

    // Update success rate based on rapid executions vs total triggers
    this.metrics.successRate =
      this.metrics.rapidExecutions > 0
        ? (this.metrics.rapidExecutions / this.metrics.totalTriggers) * 100
        : 0;
  }

  /**
   * Get historical average volume for a symbol
   */
  private getHistoricalAverageVolume(symbol: string): number | null {
    try {
      // Check if we have historical volume data stored
      const key = `vol_hist_${symbol}`;
      const historicalData = this.volumeHistoryCache.get(key);

      if (!historicalData || historicalData.length === 0) {
        this.logger.debug(`No historical volume data available for ${symbol}`);
        return null;
      }

      // Calculate average from last 24 hours of data points
      const now = Date.now();
      const dayAgo = now - 24 * 60 * 60 * 1000;

      const recentData = historicalData.filter(
        (entry) => entry.timestamp >= dayAgo
      );

      if (recentData.length === 0) {
        this.logger.debug(`No recent volume data available for ${symbol}`);
        return null;
      }

      const totalVolume = recentData.reduce(
        (sum, entry) => sum + entry.volume,
        0
      );
      const averageVolume = totalVolume / recentData.length;

      this.logger.debug(`Historical average volume for ${symbol}:`, {
        dataPoints: recentData.length,
        averageVolume: averageVolume.toLocaleString(),
        timeRange: "24 hours",
      });

      return averageVolume;
    } catch (error) {
      this.logger.error(
        `Failed to get historical volume for ${symbol}:`,
        error
      );
      return null;
    }
  }

  /**
   * Store volume data for historical analysis
   */
  private storeVolumeHistory(symbol: string, volume: number): void {
    try {
      const key = `vol_hist_${symbol}`;
      const timestamp = Date.now();

      // Get existing data or create new array
      let historicalData = this.volumeHistoryCache.get(key) || [];

      // Add new data point
      historicalData.push({
        timestamp,
        volume,
        hour: new Date(timestamp).getHours(),
      });

      // Keep only last 48 hours of data (for trend analysis)
      const cutoffTime = timestamp - 48 * 60 * 60 * 1000;
      historicalData = historicalData.filter(
        (entry) => entry.timestamp >= cutoffTime
      );

      // Limit to maximum 1000 data points per symbol to prevent memory bloat
      if (historicalData.length > 1000) {
        historicalData = historicalData.slice(-1000);
      }

      // Store back to cache
      this.volumeHistoryCache.set(key, historicalData);

      this.logger.debug(`Stored volume data for ${symbol}:`, {
        volume: volume.toLocaleString(),
        totalDataPoints: historicalData.length,
        oldestDataAge: `${Math.round(
          (timestamp - Math.min(...historicalData.map((d) => d.timestamp))) /
            (60 * 60 * 1000)
        )} hours`,
      });

      // Cleanup old cache entries if memory usage gets too high
      if (this.volumeHistoryCache.size > 500) {
        this.cleanupVolumeHistoryCache();
      }
    } catch (error) {
      this.logger.error(`Failed to store volume history for ${symbol}:`, error);
    }
  }

  /**
   * Cleanup old volume history cache entries
   */
  private cleanupVolumeHistoryCache(): void {
    try {
      const now = Date.now();
      const cutoffTime = now - 72 * 60 * 60 * 1000; // Keep max 72 hours

      let removedCount = 0;
      for (const [key, data] of this.volumeHistoryCache.entries()) {
        // Remove entries where all data is older than cutoff
        if (
          data.length > 0 &&
          Math.max(...data.map((d) => d.timestamp)) < cutoffTime
        ) {
          this.volumeHistoryCache.delete(key);
          removedCount++;
        }
      }

      this.logger.debug(`Volume history cache cleanup completed:`, {
        removedEntries: removedCount,
        remainingEntries: this.volumeHistoryCache.size,
      });
    } catch (error) {
      this.logger.error("Failed to cleanup volume history cache:", error);
    }
  }

  /**
   * Shutdown the trigger engine
   */
  async shutdown(): Promise<void> {
    this.logger.info("Shutting down Real-Time Trigger Engine");

    this.setRealTimeEnabled(false);
    this.removeAllListeners();

    // Clear all caches
    this.preloadedMarketData.clear();
    this.positionCache.clear();
    this.volumeHistoryCache.clear();

    this.logger.info("Real-Time Trigger Engine shutdown completed", {
      finalMetrics: this.metrics,
    });
  }
}
