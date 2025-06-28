/**
 * Real-Time Trigger Engine for Auto-Sniping
 * 
 * Provides ultra-fast detection and execution of auto-sniping opportunities
 * with real-time WebSocket integration and optimized execution paths.
 */

import { EventEmitter } from "events";
import { toSafeError } from "@/src/lib/error-type-utils";
import { createCoordinatedApiBreaker } from "@/src/services/data/coordinated-circuit-breaker";
import type { 
  AutoSnipeTarget, 
  ServiceResponse, 
  TradeResult, 
  Position 
} from "../consolidated/core-trading/types";
import type { PatternMatch } from "@/src/services/data/pattern-detection/pattern-types";

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
  type: 'pattern_detected' | 'price_change' | 'volume_spike' | 'ready_state';
  symbol: string;
  confidence: number;
  timestamp: number;
  data: any;
  source: 'websocket' | 'polling' | 'pattern_detection';
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
  async processPatternEvent(patterns: PatternMatch[]): Promise<ServiceResponse<void>> {
    if (!this.config.enableRealTimeTriggers) {
      return { success: true, timestamp: new Date().toISOString() };
    }

    return this.circuitBreaker.execute(async () => {
      const highConfidencePatterns = patterns.filter(
        pattern => pattern.confidence >= this.config.rapidExecutionThreshold
      );

      if (highConfidencePatterns.length === 0) {
        return { success: true, timestamp: new Date().toISOString() };
      }

      this.logger.info(`Processing ${highConfidencePatterns.length} high-confidence patterns`, {
        totalPatterns: patterns.length,
        highConfidenceCount: highConfidencePatterns.length,
        threshold: this.config.rapidExecutionThreshold,
      });

      // Process patterns in parallel for speed
      if (this.config.speedOptimization.useParallelProcessing) {
        await Promise.allSettled(
          highConfidencePatterns.map(pattern => this.processIndividualPattern(pattern))
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
        this.logger.debug(`Pattern processing skipped due to cooldown`, { symbol });
        return;
      }

      // Check concurrent execution limits
      if (this.concurrentExecutions.size >= this.config.maxConcurrentExecutions) {
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
        type: 'pattern_detected',
        symbol,
        confidence: pattern.confidence,
        timestamp: Date.now(),
        data: pattern,
        source: 'pattern_detection',
      };

      // Queue for rapid execution
      this.executionQueue.set(symbol, triggerEvent);

      // Emit for auto-sniping engine
      this.emit('rapid_trigger', {
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
  async processMarketDataUpdate(symbol: string, price: number, volume?: number): Promise<void> {
    if (!this.config.enableRealTimeTriggers) return;

    try {
      // Cache price data for rapid access
      if (this.config.speedOptimization.cachePositionData) {
        this.preloadedMarketData.set(symbol, price);
      }

      // Detect volume spikes
      if (volume && this.shouldTriggerVolumeAlert(symbol, volume)) {
        const triggerEvent: TriggerEvent = {
          type: 'volume_spike',
          symbol,
          confidence: 80, // Fixed confidence for volume spikes
          timestamp: Date.now(),
          data: { price, volume },
          source: 'websocket',
        };

        this.emit('volume_spike', triggerEvent);
      }

      // Detect significant price movements
      if (this.shouldTriggerPriceAlert(symbol, price)) {
        const triggerEvent: TriggerEvent = {
          type: 'price_change',
          symbol,
          confidence: 75, // Fixed confidence for price changes
          timestamp: Date.now(),
          data: { price, volume },
          source: 'websocket',
        };

        this.emit('price_alert', triggerEvent);
      }

    } catch (error) {
      this.logger.error(`Market data processing failed`, {
        symbol,
        price,
        error: error.message,
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
   * Enable/disable real-time triggers
   */
  setRealTimeEnabled(enabled: boolean): void {
    this.config.enableRealTimeTriggers = enabled;
    this.metrics.realTimeEnabled = enabled;
    
    if (!enabled) {
      this.executionQueue.clear();
      this.concurrentExecutions.clear();
    }

    this.logger.info(`Real-time triggers ${enabled ? 'enabled' : 'disabled'}`);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private setupEventListeners(): void {
    // Listen for pattern detection events
    this.on('patterns_detected', (event) => {
      if (event.matches && Array.isArray(event.matches)) {
        this.processPatternEvent(event.matches).catch(error => {
          this.logger.error('Pattern event processing failed', error);
        });
      }
    });

    // Listen for WebSocket connection changes
    this.on('websocket_connected', () => {
      this.websocketConnected = true;
      this.metrics.websocketConnected = true;
      this.logger.info('WebSocket connected - real-time triggers active');
    });

    this.on('websocket_disconnected', () => {
      this.websocketConnected = false;
      this.metrics.websocketConnected = false;
      this.logger.warn('WebSocket disconnected - falling back to polling');
    });
  }

  private setupWebSocketMonitoring(): void {
    // Start WebSocket heartbeat monitoring
    setInterval(() => {
      this.emit('websocket_heartbeat_check');
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
    this.logger.debug('Health check completed', {
      circuitBreakerHealthy: isHealthy,
      websocketConnected: this.websocketConnected,
      concurrentExecutions: this.concurrentExecutions.size,
      queuedExecutions: this.executionQueue.size,
      totalTriggers: this.metrics.totalTriggers,
    });

    // Emit health status
    this.emit('health_check', {
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
    // Implement volume spike detection logic
    // This would typically compare against historical volume averages
    return volume > 1000000; // Placeholder threshold
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
      // This would load critical market data for active symbols
      // Implementation depends on available market data service
      this.logger.info('Preloading critical market data for speed optimization');
      
      // Placeholder for actual market data loading
      // await this.marketDataService.preloadActiveSymbols();
      
    } catch (error) {
      this.logger.warn('Market data preloading failed', error);
    }
  }

  private updateExecutionMetrics(executionTime: number): void {
    this.metrics.lastExecutionTime = Date.now();
    
    // Update average execution time
    const currentAvg = this.metrics.averageExecutionTime;
    const totalExecutions = this.metrics.rapidExecutions;
    
    this.metrics.averageExecutionTime = 
      (currentAvg * (totalExecutions - 1) + executionTime) / totalExecutions;
    
    // Update success rate (placeholder - would be calculated from actual results)
    this.metrics.successRate = this.metrics.rapidExecutions > 0 
      ? (this.metrics.rapidExecutions / this.metrics.totalTriggers) * 100 
      : 0;
  }

  /**
   * Shutdown the trigger engine
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Real-Time Trigger Engine');
    
    this.setRealTimeEnabled(false);
    this.removeAllListeners();
    
    this.logger.info('Real-Time Trigger Engine shutdown completed', {
      finalMetrics: this.metrics,
    });
  }
}