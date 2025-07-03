/**
 * Market Intelligence Service
 *
 * Provides market analysis, sentiment analysis, and trading insights
 */

import { z } from "zod";

// Market sentiment schema
export const MarketSentimentSchema = z.object({
  symbol: z.string(),
  sentiment: z.enum(["bullish", "bearish", "neutral"]),
  confidence: z.number().min(0).max(1),
  factors: z.array(z.string()),
  timestamp: z.number(),
});

export type MarketSentiment = z.infer<typeof MarketSentimentSchema>;

// Market analysis schema
export const MarketAnalysisSchema = z.object({
  symbol: z.string(),
  price: z.number().positive(),
  volume: z.number().min(0),
  volatility: z.number().min(0),
  trend: z.enum(["uptrend", "downtrend", "sideways"]),
  support: z.number().positive().optional(),
  resistance: z.number().positive().optional(),
  recommendation: z.enum(["strong_buy", "buy", "hold", "sell", "strong_sell"]),
  confidence: z.number().min(0).max(1),
  timestamp: z.number(),
});

export type MarketAnalysis = z.infer<typeof MarketAnalysisSchema>; // Trading signal schema
export const TradingSignalSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  type: z.enum(["buy", "sell"]),
  strength: z.enum(["weak", "moderate", "strong"]),
  entryPrice: z.number().positive(),
  stopLoss: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
  timeframe: z.enum(["1m", "5m", "15m", "30m", "1h", "4h", "1d"]),
  indicators: z.array(z.string()),
  probability: z.number().min(0).max(1),
  timestamp: z.number(),
  expiresAt: z.number().optional(),
});

export type TradingSignal = z.infer<typeof TradingSignalSchema>;

// Market intelligence result
export const MarketIntelligenceSchema = z.object({
  symbol: z.string(),
  sentiment: MarketSentimentSchema,
  analysis: MarketAnalysisSchema,
  signals: z.array(TradingSignalSchema),
  lastUpdated: z.number(),
});

export type MarketIntelligence = z.infer<typeof MarketIntelligenceSchema>; /**
 * Market Intelligence Service
 */
export class MarketIntelligenceService {
  private cache = new Map<string, MarketIntelligence>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get comprehensive market intelligence for a symbol
   */
  async getMarketIntelligence(symbol: string): Promise<MarketIntelligence> {
    const cached = this.cache.get(symbol);
    const now = Date.now();

    if (cached && now - cached.lastUpdated < this.CACHE_DURATION) {
      return cached;
    }

    const [sentiment, analysis, signals] = await Promise.all([
      this.analyzeSentiment(symbol),
      this.analyzeMarket(symbol),
      this.generateSignals(symbol),
    ]);

    const intelligence: MarketIntelligence = {
      symbol,
      sentiment,
      analysis,
      signals,
      lastUpdated: now,
    };

    this.cache.set(symbol, intelligence);
    return intelligence;
  } /**
   * Analyze market sentiment for a symbol
   */
  async analyzeSentiment(symbol: string): Promise<MarketSentiment> {
    // Mock sentiment analysis (replace with actual analysis)
    const sentiments: Array<"bullish" | "bearish" | "neutral"> = [
      "bullish",
      "bearish",
      "neutral",
    ];
    const randomSentiment =
      sentiments[Math.floor(Math.random() * sentiments.length)];

    const factors = [
      "Technical indicators",
      "Social media sentiment",
      "News analysis",
      "Trading volume",
      "Price action",
    ];

    return {
      symbol,
      sentiment: randomSentiment,
      confidence: 0.7 + Math.random() * 0.3,
      factors: factors.slice(0, 2 + Math.floor(Math.random() * 3)),
      timestamp: Date.now(),
    };
  } /**
   * Analyze market conditions for a symbol
   */
  async analyzeMarket(symbol: string): Promise<MarketAnalysis> {
    // Mock market analysis (replace with actual analysis)
    const price = 100 + Math.random() * 900;
    const volume = Math.random() * 1000000;
    const volatility = Math.random() * 0.1;

    const trends: Array<"uptrend" | "downtrend" | "sideways"> = [
      "uptrend",
      "downtrend",
      "sideways",
    ];
    const trend = trends[Math.floor(Math.random() * trends.length)];

    const recommendations: Array<
      "strong_buy" | "buy" | "hold" | "sell" | "strong_sell"
    > = ["strong_buy", "buy", "hold", "sell", "strong_sell"];
    const recommendation =
      recommendations[Math.floor(Math.random() * recommendations.length)];

    return {
      symbol,
      price,
      volume,
      volatility,
      trend,
      support: price * (0.9 + Math.random() * 0.05),
      resistance: price * (1.05 + Math.random() * 0.05),
      recommendation,
      confidence: 0.6 + Math.random() * 0.4,
      timestamp: Date.now(),
    };
  } /**
   * Generate trading signals for a symbol
   */
  async generateSignals(symbol: string): Promise<TradingSignal[]> {
    const signals: TradingSignal[] = [];
    const signalCount = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < signalCount; i++) {
      const types: Array<"buy" | "sell"> = ["buy", "sell"];
      const strengths: Array<"weak" | "moderate" | "strong"> = [
        "weak",
        "moderate",
        "strong",
      ];
      const timeframes: Array<
        "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d"
      > = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"];

      const entryPrice = 100 + Math.random() * 900;
      const now = Date.now();

      signals.push({
        id: `signal_${now}_${i}`,
        symbol,
        type: types[Math.floor(Math.random() * types.length)],
        strength: strengths[Math.floor(Math.random() * strengths.length)],
        entryPrice,
        stopLoss: entryPrice * (0.95 + Math.random() * 0.03),
        takeProfit: entryPrice * (1.02 + Math.random() * 0.08),
        timeframe: timeframes[Math.floor(Math.random() * timeframes.length)],
        indicators: ["RSI", "MACD", "MA", "Volume"].slice(
          0,
          2 + Math.floor(Math.random() * 2)
        ),
        probability: 0.5 + Math.random() * 0.4,
        timestamp: now,
        expiresAt: now + Math.random() * 3600000, // 1 hour max
      });
    }

    return signals;
  } /**
   * Get active signals for a symbol
   */
  getActiveSignals(symbol: string): TradingSignal[] {
    const intelligence = this.cache.get(symbol);
    if (!intelligence) return [];

    const now = Date.now();
    return intelligence.signals.filter(
      (signal) => !signal.expiresAt || signal.expiresAt > now
    );
  }

  /**
   * Clear expired data from cache
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [symbol, intelligence] of this.cache.entries()) {
      if (now - intelligence.lastUpdated > this.CACHE_DURATION) {
        this.cache.delete(symbol);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; symbols: string[] } {
    return {
      size: this.cache.size,
      symbols: Array.from(this.cache.keys()),
    };
  }
}

// Export singleton instance
export const marketIntelligenceService = new MarketIntelligenceService();
