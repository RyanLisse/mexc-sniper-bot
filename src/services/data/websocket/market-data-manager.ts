/**
 * Market Data Manager
 *
 * Handles market data caching, processing, and pattern detection integration
 * Extracted from mexc-websocket-stream.ts for modularity
 */

import { PatternDetectionCore } from "@/src/core/pattern-detection";
import { webSocketAgentBridge } from "@/src/mexc-agents/websocket-agent-bridge";
import type {
  NotificationMessage,
  TradingPriceMessage,
  TradingSignalMessage,
} from "../../lib/websocket-types";

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
  private readonly patternCheckInterval = 5000; // 5 seconds

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
      priceChange: parseFloat(ticker.p),
      priceChangePercent: parseFloat(ticker.P),
      volume: parseFloat(ticker.v),
      quoteVolume: parseFloat(ticker.q),
      high: parseFloat(ticker.h),
      low: parseFloat(ticker.l),
      open: parseFloat(ticker.o),
      timestamp: ticker.t || Date.now(),
    };

    // Cache the price update
    this.priceCache.set(ticker.s, price);

    // Trigger pattern analysis if enough time has passed
    this.checkForPatternUpdates(ticker.s, price);

    // Emit to handlers
    if (this.onPriceUpdate) {
      this.onPriceUpdate(price);
    }

    this.logger.debug("Price updated", {
      symbol: ticker.s,
      price: price.price,
      change: price.priceChangePercent,
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
  private checkForPatternUpdates(symbol: string, price: TradingPriceMessage): void {
    const lastCheck = this.lastPatternCheck.get(symbol) || 0;
    const now = Date.now();

    if (now - lastCheck < this.patternCheckInterval) {
      return; // Skip if checked recently
    }

    this.lastPatternCheck.set(symbol, now);

    // Trigger pattern detection for significant price changes
    if (Math.abs(price.priceChangePercent) > 5) {
      this.logger.info("Significant price movement detected", {
        symbol,
        change: price.priceChangePercent,
      });

      // Notify WebSocket agent bridge
      webSocketAgentBridge.handlePriceUpdate(price);
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
        type: "pattern_detected",
        data: {
          symbol: status.symbol,
          patternType: "ready_state",
          confidence: 85, // High confidence for exact match
          timestamp: status.timestamp,
          details: {
            sts: status.sts,
            st: status.st,
            tt: status.tt,
            ps: status.ps,
            qs: status.qs,
            ca: status.ca,
          },
        },
        timestamp: Date.now(),
      };

      // Get current price for additional context
      const priceData = this.priceCache.get(status.symbol);
      if (priceData) {
        (notification.data as any).price = priceData.price;
        (notification.data as any).priceChange = priceData.priceChangePercent;
        (notification.data as any).volume = priceData.volume;
      }

      // Emit notification
      if (this.onNotification) {
        this.onNotification(notification);
      }

      // Create trading signal for auto-sniping
      const tradingSignal: TradingSignalMessage = {
        type: "buy_signal",
        symbol: status.symbol,
        confidence: 85,
        reason: "Ready state pattern detected (sts:2, st:2, tt:4)",
        priceTarget: priceData?.price,
        timestamp: Date.now(),
        metadata: {
          patternType: "ready_state",
          sts: status.sts,
          st: status.st,
          tt: status.tt,
          autoSniping: true,
        },
      };

      // Notify WebSocket agent bridge
      webSocketAgentBridge.handleTradingSignal(tradingSignal);

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
      (status.ps && status.ps > 100) || // High price score
      (status.qs && status.qs > 100) || // High quantity score
      (status.ca && status.ca > 50) // High combined activity
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

      // Analyze pattern with context
      const analysisResult = await this.patternDetection.analyzePattern({
        symbol: status.symbol,
        sts: status.sts,
        st: status.st,
        tt: status.tt,
        ps: status.ps,
        qs: status.qs,
        ca: status.ca,
        currentPrice: priceData?.price,
        priceChange: priceData?.priceChangePercent,
        volume: priceData?.volume,
        timestamp: status.timestamp,
      });

      if (analysisResult && analysisResult.confidence > 70) {
        // High confidence pattern found
        const notification: NotificationMessage = {
          type: "pattern_detected",
          data: {
            symbol: status.symbol,
            patternType: analysisResult.patternType || "enhanced_analysis",
            confidence: analysisResult.confidence,
            timestamp: status.timestamp,
            details: analysisResult,
          },
          timestamp: Date.now(),
        };

        if (this.onNotification) {
          this.onNotification(notification);
        }

        this.logger.info("Enhanced analysis pattern detected", {
          symbol: status.symbol,
          confidence: analysisResult.confidence,
          patternType: analysisResult.patternType,
        });
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
    return Array.from(new Set([...this.priceCache.keys(), ...this.statusCache.keys()]));
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
