/**
 * Pattern Processor Module
 *
 * Handles pattern detection and processing for auto-sniping opportunities.
 * Extracted from the original monolithic implementation for better maintainability.
 */

import { toSafeError } from "../../../lib/error-type-utils";
import type {
  ModuleContext,
  ModuleState,
  OpportunityAssessment,
  PatternMatch,
  ServiceResponse,
} from "./types";

export class PatternProcessor {
  private context: ModuleContext;
  private state: ModuleState;

  // Pattern detection state
  private lastDetectionTime: Date | null = null;
  private detectedPatterns: PatternMatch[] = [];
  private processedSymbols = new Set<string>();

  // Pattern scoring weights
  private readonly SCORING_WEIGHTS = {
    volumeIncrease: 0.25,
    priceMovement: 0.3,
    liquidityDepth: 0.2,
    timeBasedFactors: 0.15,
    technicalIndicators: 0.1,
  };

  constructor(context: ModuleContext) {
    this.context = context;
    this.state = {
      isInitialized: false,
      isHealthy: true,
      lastActivity: new Date(),
      metrics: {
        totalPatternsDetected: 0,
        successfulMatches: 0,
        averageConfidence: 0,
        processingTime: 0,
      },
    };
  }

  /**
   * Initialize the pattern processor module
   */
  async initialize(): Promise<void> {
    this.context.logger.info("Initializing Pattern Processor Module");
    this.state.isInitialized = true;
    this.state.lastActivity = new Date();
    this.context.logger.info(
      "Pattern Processor Module initialized successfully"
    );
  }

  /**
   * Shutdown the pattern processor module
   */
  async shutdown(): Promise<void> {
    this.context.logger.info("Shutting down Pattern Processor Module");
    this.detectedPatterns = [];
    this.processedSymbols.clear();
    this.state.isInitialized = false;
  }

  /**
   * Update configuration
   */
  async updateConfig(newContext: ModuleContext): Promise<void> {
    this.context = newContext;
    this.context.logger.info("Pattern Processor Module configuration updated");
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<"operational" | "degraded" | "offline"> {
    if (!this.state.isInitialized) return "offline";
    if (!this.state.isHealthy) return "degraded";

    // Check if we've detected patterns recently
    if (
      this.lastDetectionTime &&
      Date.now() - this.lastDetectionTime.getTime() > 300000
    ) {
      // 5 minutes
      return "degraded";
    }

    return "operational";
  }

  /**
   * Detect patterns across available trading pairs
   */
  async detectPatterns(): Promise<PatternMatch[]> {
    const startTime = Date.now();

    try {
      this.context.logger.debug("Starting pattern detection cycle");

      if (!this.state.isInitialized) {
        throw new Error("Pattern processor not initialized");
      }

      // Get available trading symbols (simulated for now)
      const symbols = await this.getAvailableSymbols();
      const patterns: PatternMatch[] = [];

      for (const symbol of symbols) {
        try {
          const marketData = await this.getMarketData(symbol);
          const pattern = await this.analyzePattern(symbol, marketData);

          if (pattern && pattern.confidence >= 50) {
            // Minimum confidence threshold
            patterns.push(pattern);
            this.context.eventEmitter.emit("pattern_detected", pattern);
          }
        } catch (error) {
          this.context.logger.debug(
            `Pattern analysis failed for ${symbol}: ${toSafeError(error).message}`
          );
        }
      }

      this.detectedPatterns = patterns;
      this.lastDetectionTime = new Date();
      this.state.lastActivity = new Date();

      // Update metrics
      const currentTotal =
        (this.state.metrics.totalPatternsDetected as number) || 0;
      this.state.metrics.totalPatternsDetected = currentTotal + patterns.length;
      this.state.metrics.processingTime = Date.now() - startTime;

      if (patterns.length > 0) {
        const avgConfidence =
          patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
        this.state.metrics.averageConfidence = avgConfidence;
      }

      this.context.logger.info("Pattern detection completed", {
        patternsFound: patterns.length,
        processingTime: this.state.metrics.processingTime,
        avgConfidence: this.state.metrics.averageConfidence,
      });

      return patterns;
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error(
        `Pattern detection failed: ${safeError.message}`
      );
      this.state.isHealthy = false;
      return [];
    }
  }

  /**
   * Analyze a specific symbol for trading patterns
   */
  async analyzeSymbol(symbol: string): Promise<PatternMatch | null> {
    try {
      if (this.processedSymbols.has(symbol)) {
        // Don't re-analyze the same symbol too frequently
        return null;
      }

      const marketData = await this.getMarketData(symbol);
      const pattern = await this.analyzePattern(symbol, marketData);

      if (pattern) {
        this.processedSymbols.add(symbol);
        // Remove from processed set after some time
        setTimeout(() => this.processedSymbols.delete(symbol), 60000); // 1 minute
      }

      return pattern;
    } catch (error) {
      this.context.logger.error(
        `Failed to analyze symbol ${symbol}: ${toSafeError(error).message}`
      );
      return null;
    }
  }

  /**
   * Assess an opportunity for trading viability
   */
  async assessOpportunity(
    pattern: PatternMatch
  ): Promise<OpportunityAssessment> {
    try {
      this.context.logger.debug("Assessing trading opportunity", { pattern });

      const reasons: string[] = [];
      let confidence = pattern.confidence;
      let recommendedAction: "execute" | "skip" | "wait" = "skip";

      // Confidence threshold check
      if (confidence >= this.context.config.confidenceThreshold) {
        reasons.push(`High confidence score: ${confidence.toFixed(1)}%`);
        recommendedAction = "execute";
      } else if (confidence >= this.context.config.confidenceThreshold - 10) {
        reasons.push(
          `Moderate confidence, consider waiting: ${confidence.toFixed(1)}%`
        );
        recommendedAction = "wait";
      } else {
        reasons.push(`Low confidence score: ${confidence.toFixed(1)}%`);
        recommendedAction = "skip";
      }

      // Risk level assessment
      if (pattern.riskLevel === "low") {
        confidence += 5;
        reasons.push("Low risk level detected");
      } else if (pattern.riskLevel === "high") {
        confidence -= 10;
        reasons.push("High risk level detected");
        if (recommendedAction === "execute") {
          recommendedAction = "wait";
        }
      }

      // Time-based factors
      const currentHour = new Date().getHours();
      if (currentHour >= 9 && currentHour <= 16) {
        confidence += 3;
        reasons.push("Active trading hours");
      } else {
        confidence -= 5;
        reasons.push("Outside optimal trading hours");
      }

      // Paper trading mode check
      if (this.context.config.paperTradingMode) {
        reasons.push("Paper trading mode active");
        if (recommendedAction === "skip" && confidence >= 60) {
          recommendedAction = "execute"; // More lenient in paper trading
        }
      }

      // Strategy-based adjustments
      if (this.context.config.strategy === "conservative") {
        confidence -= 5;
        reasons.push("Conservative strategy applied");
      } else if (this.context.config.strategy === "aggressive") {
        confidence += 5;
        reasons.push("Aggressive strategy applied");
      }

      // Final confidence bounds
      confidence = Math.max(0, Math.min(100, confidence));

      return {
        isValid: confidence >= 50,
        confidence,
        riskLevel: pattern.riskLevel,
        recommendedAction,
        reasons,
      };
    } catch (error) {
      this.context.logger.error(
        `Failed to assess opportunity for ${pattern.symbol}: ${toSafeError(error).message}`
      );

      return {
        isValid: false,
        confidence: 0,
        riskLevel: "high",
        recommendedAction: "skip",
        reasons: ["Assessment failed due to error"],
      };
    }
  }

  /**
   * Get recent pattern detection results
   */
  getRecentPatterns(): PatternMatch[] {
    return [...this.detectedPatterns];
  }

  /**
   * Get pattern detection metrics
   */
  getMetrics() {
    return {
      ...this.state.metrics,
      recentPatterns: this.detectedPatterns.length,
      lastDetectionTime: this.lastDetectionTime?.toISOString(),
      processedSymbolsCount: this.processedSymbols.size,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get available trading symbols (simulated)
   */
  private async getAvailableSymbols(): Promise<string[]> {
    // In a real implementation, this would fetch from MEXC API
    const symbols = [
      "BTCUSDT",
      "ETHUSDT",
      "BNBUSDT",
      "ADAUSDT",
      "XRPUSDT",
      "SOLUSDT",
      "DOTUSDT",
      "LINKUSDT",
      "LTCUSDT",
      "BCHUSDT",
    ];

    // Shuffle to vary analysis order
    return symbols.sort(() => Math.random() - 0.5);
  }

  /**
   * Get market data for a symbol (simulated)
   */
  private async getMarketData(symbol: string): Promise<any> {
    // Simulated market data - in real implementation would call MEXC API
    const basePrice = 100 + Math.random() * 1000;
    const volumeMultiplier = 0.5 + Math.random() * 2; // 0.5x to 2.5x normal volume

    return {
      symbol,
      price: basePrice,
      priceChange24h: (Math.random() - 0.5) * 20, // -10% to +10%
      volume24h: 1000000 * volumeMultiplier,
      volumeChange24h: (volumeMultiplier - 1) * 100,
      orderBookDepth: {
        bids: Math.random() * 100000,
        asks: Math.random() * 100000,
      },
      technicalIndicators: {
        rsi: 30 + Math.random() * 40, // 30-70 range
        macdSignal: Math.random() > 0.5 ? "bullish" : "bearish",
        volatility: Math.random() * 0.5, // 0-50% volatility
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Analyze pattern from market data
   */
  private async analyzePattern(
    symbol: string,
    marketData: any
  ): Promise<PatternMatch | null> {
    try {
      // Calculate base confidence score
      let confidence = 50; // Base confidence
      const factors: string[] = [];

      // Volume analysis
      if (marketData.volumeChange24h > 50) {
        confidence += (15 * this.SCORING_WEIGHTS.volumeIncrease) / 0.25;
        factors.push("High volume increase");
      } else if (marketData.volumeChange24h > 20) {
        confidence += (8 * this.SCORING_WEIGHTS.volumeIncrease) / 0.25;
        factors.push("Moderate volume increase");
      }

      // Price movement analysis
      const priceChange = Math.abs(marketData.priceChange24h);
      if (priceChange > 5 && priceChange < 15) {
        confidence += (12 * this.SCORING_WEIGHTS.priceMovement) / 0.3;
        factors.push("Optimal price movement range");
      } else if (priceChange > 15) {
        confidence -= 5; // Too volatile
        factors.push("High volatility detected");
      }

      // Liquidity depth analysis
      const totalDepth =
        marketData.orderBookDepth.bids + marketData.orderBookDepth.asks;
      if (totalDepth > 150000) {
        confidence += (10 * this.SCORING_WEIGHTS.liquidityDepth) / 0.2;
        factors.push("Good liquidity depth");
      } else if (totalDepth < 50000) {
        confidence -= 8;
        factors.push("Low liquidity warning");
      }

      // Technical indicators
      if (
        marketData.technicalIndicators.rsi > 40 &&
        marketData.technicalIndicators.rsi < 60
      ) {
        confidence += (8 * this.SCORING_WEIGHTS.technicalIndicators) / 0.1;
        factors.push("Balanced RSI");
      }

      if (marketData.technicalIndicators.macdSignal === "bullish") {
        confidence += (5 * this.SCORING_WEIGHTS.technicalIndicators) / 0.1;
        factors.push("Bullish MACD signal");
      }

      // Volatility check
      if (marketData.technicalIndicators.volatility > 0.3) {
        confidence -= 10;
        factors.push("High volatility penalty");
      }

      // Time-based factors
      const hour = new Date().getHours();
      if (hour >= 9 && hour <= 16) {
        confidence += (5 * this.SCORING_WEIGHTS.timeBasedFactors) / 0.15;
        factors.push("Active trading hours");
      }

      // Ensure confidence is within bounds
      confidence = Math.max(0, Math.min(100, confidence));

      // Only return pattern if it meets minimum criteria
      if (confidence < 40) {
        return null;
      }

      // Determine risk level
      let riskLevel: "low" | "medium" | "high" = "medium";
      if (confidence >= 80 && marketData.technicalIndicators.volatility < 0.2) {
        riskLevel = "low";
      } else if (
        confidence < 60 ||
        marketData.technicalIndicators.volatility > 0.3
      ) {
        riskLevel = "high";
      }

      // Calculate advance notice (simulated)
      const advanceNoticeHours = Math.random() * 24; // 0-24 hours

      const pattern: PatternMatch = {
        symbol,
        patternType: this.determinePatternType(marketData),
        confidence,
        riskLevel,
        advanceNoticeHours,
        detectedAt: new Date().toISOString(),
        validUntil: new Date(
          Date.now() + advanceNoticeHours * 60 * 60 * 1000
        ).toISOString(),
        metadata: {
          factors: factors.join(","), // Convert array to string
          price: marketData.price,
          volumeChange: marketData.volumeChange24h,
          priceChange: marketData.priceChange24h,
          rsi: marketData.technicalIndicators.rsi,
          volatility: marketData.technicalIndicators.volatility,
        },
      };

      this.context.logger.debug("Pattern analyzed", {
        symbol,
        confidence,
        riskLevel,
        factors: factors.length,
      });

      return pattern;
    } catch (error) {
      this.context.logger.error(
        `Pattern analysis failed for ${symbol}: ${toSafeError(error).message}`
      );
      return null;
    }
  }

  /**
   * Determine pattern type based on market data
   */
  private determinePatternType(marketData: any): string {
    const volumeChange = marketData.volumeChange24h;
    const priceChange = marketData.priceChange24h;
    const rsi = marketData.technicalIndicators.rsi;

    if (volumeChange > 100 && priceChange > 10) {
      return "breakout_with_volume";
    } else if (volumeChange > 50 && Math.abs(priceChange) < 5) {
      return "accumulation_pattern";
    } else if (rsi < 35 && priceChange < -5) {
      return "oversold_reversal";
    } else if (rsi > 65 && priceChange > 5) {
      return "momentum_continuation";
    } else if (marketData.technicalIndicators.macdSignal === "bullish") {
      return "technical_breakout";
    } else {
      return "general_opportunity";
    }
  }

  /**
   * Emergency stop - halt all pattern processing
   */
  async emergencyStop(): Promise<ServiceResponse<boolean>> {
    try {
      this.context.logger.warn("EMERGENCY: Stopping pattern processor");

      // Mark as not healthy
      this.state.isHealthy = false;

      // Clear any cached patterns
      this.detectedPatterns.length = 0;

      this.context.logger.warn("Pattern processor emergency stopped");

      return {
        success: true,
        data: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
