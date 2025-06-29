/**
 * Market Data Manager
 *
 * Handles market data caching, processing, and pattern detection integration
 * Extracted from mexc-websocket-stream.ts for modularity
 */

import { randomUUID } from "node:crypto";
import { PatternDetectionCore } from "@/src/core/pattern-detection";
import type { PatternAnalysisResult } from "@/src/core/pattern-detection/interfaces";
import type {
  NotificationMessage,
  TradingPriceMessage,
  TradingSignalMessage,
} from "@/src/lib/websocket-types";
import { webSocketAgentBridge } from "@/src/mexc-agents/websocket-agent-bridge";

// ======================
// MEXC WebSocket Types
// ======================

interface MexcTickerData {
  s: string; // symbol
  c: string; // close price
  h: string; // high price
  l: string; // low price
  v: string; // volume
  q: string; // quote volume
  o: string; // open price
  P: string; // price change percent
  p: string; // price change
  t: number; // timestamp
}

// Extended analysis request interface for single symbol analysis
interface SingleSymbolAnalysisRequest {
  symbol: string;
  sts: number;
  st: number;
  tt: number;
  ps?: number;
  qs?: number;
  ca?: number;
  currentPrice?: number;
  priceChange?: number;
  volume?: number;
  timestamp: number;
}

interface MexcDepthData {
  s: string; // symbol
  bids: [string, string][]; // [price, quantity]
  asks: [string, string][]; // [price, quantity]
  ts: number; // timestamp
}

interface SymbolStatusData {
  symbol: string;
  sts: number;
  st: number;
  tt: number;
  ps?: number;
  qs?: number;
  ca?: number;
  ot?: Record<string, unknown>;
  timestamp: number;
}

// ======================
// Market Data Manager
// ======================

export class MarketDataManager {
  private static instance: MarketDataManager;

  private logger = {
    info: (message: string, context?: any) =>
      console.info("[market-data-manager]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[market-data-manager]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[market-data-manager]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[market-data-manager]", message, context || ""),
  };

  // Data caches
  private priceCache = new Map<string, TradingPriceMessage>();
  private depthCache = new Map<string, MexcDepthData>();
  private statusCache = new Map<string, SymbolStatusData>();
  private subscribers = new Map<string, Set<string>>();

  // Pattern detection
  private patternDetection: PatternDetectionCore;
  private lastPatternCheck = new Map<string, number>();
  private readonly patternCheckInterval = 15000; // 15 seconds (reduced from 5s)

  // Event handlers
  private onPriceUpdate?: (price: TradingPriceMessage) => void;
  private onDepthUpdate?: (depth: MexcDepthData) => void;
  private onStatusUpdate?: (status: SymbolStatusData) => void;
  private onNotification?: (notification: NotificationMessage) => void;

  private constructor() {
    this.patternDetection = PatternDetectionCore.getInstance();
  }

  static getInstance(): MarketDataManager {
    if (!MarketDataManager.instance) {
      MarketDataManager.instance = new MarketDataManager();
    }
    return MarketDataManager.instance;
  }

  /**
   * Set event handlers
   */
  setEventHandlers(handlers: {
    onPriceUpdate?: (price: TradingPriceMessage) => void;
    onDepthUpdate?: (depth: MexcDepthData) => void;
    onStatusUpdate?: (status: SymbolStatusData) => void;
    onNotification?: (notification: NotificationMessage) => void;
  }): void {
    this.onPriceUpdate = handlers.onPriceUpdate;
    this.onDepthUpdate = handlers.onDepthUpdate;
    this.onStatusUpdate = handlers.onStatusUpdate;
    this.onNotification = handlers.onNotification;
  }

  /**
   * Update price data and trigger pattern analysis
   */
  async updatePrice(ticker: MexcTickerData): Promise<void> {
    const price: TradingPriceMessage = {
      symbol: ticker.s,
      price: parseFloat(ticker.c),
      change: parseFloat(ticker.p),
      changePercent: parseFloat(ticker.P),
      volume: parseFloat(ticker.v),
      timestamp: ticker.t || Date.now(),
      source: "mexc_ws" as const,
      metadata: {
        high24h: parseFloat(ticker.h),
        low24h: parseFloat(ticker.l),
        volume24h: parseFloat(ticker.v),
        lastUpdate: ticker.t || Date.now(),
      },
    };

    // Cache the price update
    this.priceCache.set(ticker.s, price);

    // Trigger pattern analysis if enough time has passed
    await this.checkForPatternUpdates(ticker.s, price);

    // Emit to handlers
    if (this.onPriceUpdate) {
      this.onPriceUpdate(price);
    }

    this.logger.debug("Price updated", {
      symbol: ticker.s,
      price: price.price,
      change: price.changePercent,
    });
  }

  /**
   * Update market depth data
   */
  async updateDepth(depth: MexcDepthData): Promise<void> {
    this.depthCache.set(depth.s, depth);

    if (this.onDepthUpdate) {
      this.onDepthUpdate(depth);
    }

    this.logger.debug("Depth updated", {
      symbol: depth.s,
      bids: depth.bids.length,
      asks: depth.asks.length,
    });
  }

  /**
   * Update symbol status and check for patterns
   */
  async updateSymbolStatus(status: SymbolStatusData): Promise<void> {
    this.statusCache.set(status.symbol, status);

    // Check for ready state patterns (sts: 2, st: 2, tt: 4)
    if (status.sts === 2 && status.st === 2 && status.tt === 4) {
      await this.broadcastReadyStatePattern(status);
    }

    // Perform enhanced analysis for specific conditions
    if (this.shouldPerformEnhancedAnalysis(status)) {
      await this.performEnhancedAnalysis(status);
    }

    if (this.onStatusUpdate) {
      this.onStatusUpdate(status);
    }

    this.logger.debug("Symbol status updated", {
      symbol: status.symbol,
      sts: status.sts,
      st: status.st,
      tt: status.tt,
    });
  }

  /**
   * Check for pattern updates based on price changes
   */
  private async checkForPatternUpdates(symbol: string, price: TradingPriceMessage): Promise<void> {
    const lastCheck = this.lastPatternCheck.get(symbol) || 0;
    const now = Date.now();

    if (now - lastCheck < this.patternCheckInterval) {
      return; // Skip if checked recently
    }

    this.lastPatternCheck.set(symbol, now);

    // Trigger pattern detection for significant price changes
    if (Math.abs(price.changePercent) > 5) {
      this.logger.info("Significant price movement detected", {
        symbol,
        change: price.changePercent,
      });

      // Notify WebSocket agent bridge via broadcasting
      if (webSocketAgentBridge.isRunning()) {
        webSocketAgentBridge.broadcastTradingSignal({
          symbol: price.symbol,
          type: "monitor",
          strength: Math.min(Math.abs(price.changePercent) * 10, 100),
          confidence: 0.6,
          source: "price_movement",
          reasoning: `Significant price movement detected: ${price.changePercent.toFixed(2)}%`,
          timeframe: "1h",
          metadata: {
            priceChange: price.change,
            priceChangePercent: price.changePercent,
            volume: price.volume,
          },
        });
      }
    }
  }

  /**
   * Broadcast ready state pattern detection
   */
  private async broadcastReadyStatePattern(status: SymbolStatusData): Promise<void> {
    try {
      this.logger.info("Ready state pattern detected", {
        symbol: status.symbol,
        sts: status.sts,
        st: status.st,
        tt: status.tt,
      });

      // Create pattern notification
      const notification: NotificationMessage = {
        notificationId: randomUUID(),
        type: "success",
        title: "Ready State Pattern Detected",
        message: `Ready state pattern detected for ${status.symbol} (sts:${status.sts}, st:${status.st}, tt:${status.tt})`,
        priority: "high",
        category: "pattern",
        timestamp: Date.now(),
        actionable: true,
        actions: [
          {
            label: "View Details",
            action: "navigate",
            params: { path: `/patterns/${status.symbol}` },
          },
          {
            label: "Create Trade",
            action: "execute_trade",
            params: { symbol: status.symbol },
          },
        ],
        metadata: {
          symbol: status.symbol,
          sts: status.sts,
          st: status.st,
          tt: status.tt,
          confidence: 85,
        },
      };

      // Get current price for additional context
      const priceData = this.priceCache.get(status.symbol);
      if (priceData && notification.metadata) {
        // Extend metadata with additional price data
        Object.assign(notification.metadata, {
          price: priceData.price,
          priceChange: priceData.changePercent,
          volume: priceData.volume,
        });
      }

      // Emit notification
      if (this.onNotification) {
        this.onNotification(notification);
      }

      // Create trading signal for auto-sniping
      const tradingSignal = {
        symbol: status.symbol,
        type: "buy" as const,
        strength: 85,
        confidence: 0.85,
        source: "pattern_discovery" as const,
        reasoning: "Ready state pattern detected (sts:2, st:2, tt:4)",
        targetPrice: priceData?.price,
        timeframe: "1h",
        metadata: {
          patternType: "ready_state",
          sts: status.sts,
          st: status.st,
          tt: status.tt,
          autoSniping: true,
        },
      };

      // Notify WebSocket agent bridge via broadcasting
      if (webSocketAgentBridge.isRunning()) {
        webSocketAgentBridge.broadcastTradingSignal(tradingSignal);
      }

      this.logger.info("Ready state pattern broadcasted", {
        symbol: status.symbol,
        confidence: 85,
      });
    } catch (error) {
      this.logger.error("Failed to broadcast ready state pattern", {
        symbol: status.symbol,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Determine if enhanced analysis should be performed
   */
  private shouldPerformEnhancedAnalysis(status: SymbolStatusData): boolean {
    // Perform enhanced analysis for near-ready states or high activity
    return (
      (status.sts >= 1 && status.st >= 1 && status.tt >= 3) || // Near ready state
      (typeof status.ps === 'number' && status.ps > 100) || // High price score
      (typeof status.qs === 'number' && status.qs > 100) || // High quantity score
      (typeof status.ca === 'number' && status.ca > 50) // High combined activity
    );
  }

  /**
   * Perform enhanced pattern analysis
   */
  async performEnhancedAnalysis(status: SymbolStatusData): Promise<void> {
    try {
      this.logger.debug("Performing enhanced analysis", {
        symbol: status.symbol,
        sts: status.sts,
        st: status.st,
        tt: status.tt,
      });

      // Get current price context
      const priceData = this.priceCache.get(status.symbol);

      // Create a proper analysis request
      const analysisRequest: SingleSymbolAnalysisRequest = {
        symbol: status.symbol,
        sts: status.sts,
        st: status.st,
        tt: status.tt,
        ps: status.ps,
        qs: status.qs,
        ca: status.ca,
        currentPrice: priceData?.price,
        priceChange: priceData?.changePercent,
        volume: priceData?.volume,
        timestamp: status.timestamp,
      };

      // Analyze pattern with the pattern detection core using mock symbol entry
      const mockSymbolEntry = {
        cd: status.symbol,
        sts: status.sts,
        st: status.st,
        tt: status.tt,
        ps: status.ps,
        qs: status.qs,
        ca: status.ca,
      };

      const analysisResult = await this.patternDetection.analyzePatterns({
        symbols: [mockSymbolEntry],
        analysisType: "monitoring" as const,
        confidenceThreshold: 70,
      });

      if (analysisResult && analysisResult.matches.length > 0) {
        const bestMatch = analysisResult.matches[0];
        if (bestMatch.confidence > 70) {
          // High confidence pattern found
          const notification: NotificationMessage = {
            notificationId: randomUUID(),
            type: "info",
            title: "Enhanced Pattern Detected",
            message: `Enhanced analysis found ${bestMatch.patternType} pattern for ${status.symbol}`,
            priority: "medium",
            category: "pattern",
            timestamp: Date.now(),
            metadata: {
              symbol: status.symbol,
              confidence: bestMatch.confidence,
              sts: status.sts,
              st: status.st,
              tt: status.tt,
            },
          };

          if (this.onNotification) {
            this.onNotification(notification);
          }

          this.logger.info("Enhanced analysis pattern detected", {
            symbol: status.symbol,
            confidence: bestMatch.confidence,
            patternType: bestMatch.patternType,
          });
        }
      }
    } catch (error) {
      this.logger.error("Enhanced analysis failed", {
        symbol: status.symbol,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get cached price data
   */
  getPrice(symbol: string): TradingPriceMessage | undefined {
    return this.priceCache.get(symbol);
  }

  /**
   * Get cached depth data
   */
  getDepth(symbol: string): MexcDepthData | undefined {
    return this.depthCache.get(symbol);
  }

  /**
   * Get cached status data
   */
  getStatus(symbol: string): SymbolStatusData | undefined {
    return this.statusCache.get(symbol);
  }

  /**
   * Get all cached symbols
   */
  getAllSymbols(): string[] {
    const priceSymbols = Array.from(this.priceCache.keys());
    const statusSymbols = Array.from(this.statusCache.keys());
    return Array.from(new Set([...priceSymbols, ...statusSymbols]));
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.priceCache.clear();
    this.depthCache.clear();
    this.statusCache.clear();
    this.lastPatternCheck.clear();
    this.logger.info("All market data caches cleared");
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    prices: number;
    depths: number;
    statuses: number;
  } {
    return {
      prices: this.priceCache.size,
      depths: this.depthCache.size,
      statuses: this.statusCache.size,
    };
  }
}
