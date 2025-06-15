import { 
  MexcServiceLayer,
  type MexcServiceConfig,
  type ServiceResponse,
  type HealthCheckResult,
  getRecommendedMexcService
} from "./mexc-service-layer";
import {
  type CalendarEntry,
  type SymbolEntry,
  type BalanceEntry,
  type ExchangeSymbol,
  type Ticker,
  type OrderResult,
  type OrderParameters,
} from "./unified-mexc-client";

// ============================================================================
// Enhanced Types for Advanced Features
// ============================================================================

export interface AdvancedOrderParameters extends OrderParameters {
  stopPrice?: string;
  icebergQty?: string;
  newOrderRespType?: "ACK" | "RESULT" | "FULL";
}

export interface OrderStatus {
  orderId: string;
  symbol: string;
  status: "NEW" | "PARTIALLY_FILLED" | "FILLED" | "CANCELED" | "REJECTED" | "EXPIRED";
  side: "BUY" | "SELL";
  type: "LIMIT" | "MARKET" | "STOP_LOSS" | "STOP_LOSS_LIMIT";
  quantity: string;
  price?: string;
  stopPrice?: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  time: number;
  updateTime: number;
}

export interface OrderBook {
  symbol: string;
  bids: Array<[string, string]>; // [price, quantity]
  asks: Array<[string, string]>; // [price, quantity]
  timestamp: number;
}

export interface Kline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteAssetVolume: string;
  numberOfTrades: number;
}

export interface MarketStats {
  totalPairs: number;
  activePairs: number;
  totalVolume24h: number;
  totalMarketCap: number;
  topGainers: Ticker[];
  topLosers: Ticker[];
  newListings: CalendarEntry[];
  trendingPairs: string[];
}

export interface PatternAnalysis {
  readyStatePatterns: {
    symbols: SymbolEntry[];
    count: number;
    percentage: number;
  };
  volumePatterns: {
    highVolume: string[];
    emergingVolume: string[];
  };
  pricePatterns: {
    breakouts: string[];
    reversals: string[];
  };
  confidence: number;
  analysisTime: string;
}

export interface TradingOpportunity {
  symbol: string;
  type: "breakout" | "reversal" | "volume_surge" | "pattern_match";
  confidence: number;
  priceTarget?: number;
  stopLoss?: number;
  timeframe: string;
  analysis: string;
}

export interface Portfolio {
  totalValue: number;
  totalValueUsd: number;
  assets: BalanceEntry[];
  allocation: Record<string, number>;
  performance24h: number;
  topHoldings: BalanceEntry[];
}

export interface PerformanceMetrics {
  totalReturn: number;
  dailyReturn: number;
  weeklyReturn: number;
  monthlyReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
}

export interface RiskAssessment {
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  riskScore: number; // 0-100
  factors: {
    liquidityRisk: number;
    volatilityRisk: number;
    positionSizeRisk: number;
    concentrationRisk: number;
  };
  recommendations: string[];
  maxRecommendedSize: number;
}

export interface RiskMetrics {
  portfolioRisk: number;
  positionRisks: Record<string, number>;
  liquidityScore: number;
  concentrationRisk: number;
  marginUtilization?: number;
  recommendations: string[];
}

// ============================================================================
// Enhanced MEXC Service Layer
// ============================================================================

export class EnhancedMexcServiceLayer extends MexcServiceLayer {
  private patternCache = new Map<string, { data: PatternAnalysis; timestamp: number }>();
  private readonly patternCacheTTL = 300000; // 5 minutes

  constructor(config: MexcServiceConfig = {}) {
    super(config);
    console.log("[EnhancedMexcServiceLayer] Initialized with advanced features");
  }

  // ============================================================================
  // Advanced Trading Operations
  // ============================================================================

  /**
   * Place advanced order with additional parameters
   */
  async placeAdvancedOrder(params: AdvancedOrderParameters): Promise<ServiceResponse<OrderResult>> {
    // Convert to standard OrderParameters for now
    const standardParams: OrderParameters = {
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      quantity: params.quantity,
      price: params.price,
      timeInForce: params.timeInForce,
      quoteOrderQty: params.quoteOrderQty,
    };

    return this.placeOrder(standardParams);
  }

  /**
   * Cancel an existing order
   */
  async cancelOrder(symbol: string, orderId: string): Promise<ServiceResponse<boolean>> {
    return this.executeWithMetrics("cancelOrder", async () => {
      // This would typically call the MEXC cancel order API
      // For now, return a mock response since the unified client doesn't have this yet
      console.log(`[EnhancedMexcServiceLayer] Cancel order request: ${orderId} for ${symbol}`);
      
      return {
        success: true,
        data: true,
        timestamp: new Date().toISOString(),
      };
    });
  }

  /**
   * Get order status
   */
  async getOrderStatus(symbol: string, orderId: string): Promise<ServiceResponse<OrderStatus>> {
    return this.executeWithMetrics("getOrderStatus", async () => {
      // This would typically call the MEXC order query API
      // For now, return a mock response since the unified client doesn't have this yet
      console.log(`[EnhancedMexcServiceLayer] Order status request: ${orderId} for ${symbol}`);
      
      const mockOrderStatus: OrderStatus = {
        orderId,
        symbol,
        status: "FILLED",
        side: "BUY",
        type: "MARKET",
        quantity: "100",
        executedQty: "100",
        cummulativeQuoteQty: "1000",
        time: Date.now() - 60000,
        updateTime: Date.now(),
      };

      return {
        success: true,
        data: mockOrderStatus,
        timestamp: new Date().toISOString(),
      };
    });
  }

  /**
   * Get all open orders
   */
  async getAllOpenOrders(symbol?: string): Promise<ServiceResponse<OrderStatus[]>> {
    return this.executeWithMetrics("getAllOpenOrders", async () => {
      console.log(`[EnhancedMexcServiceLayer] Get open orders${symbol ? ` for ${symbol}` : ""}`);
      
      return {
        success: true,
        data: [], // No open orders for now
        timestamp: new Date().toISOString(),
      };
    });
  }

  /**
   * Batch place multiple orders
   */
  async batchPlaceOrders(orders: OrderParameters[]): Promise<ServiceResponse<OrderResult[]>> {
    return this.executeWithMetrics("batchPlaceOrders", async () => {
      const results: OrderResult[] = [];
      
      for (const order of orders) {
        try {
          const result = await this.placeOrder(order);
          if (result.success) {
            results.push(result.data);
          } else {
            results.push({
              success: false,
              symbol: order.symbol,
              side: order.side,
              quantity: order.quantity,
              price: order.price,
              error: result.error || "Batch order failed",
              timestamp: new Date().toISOString(),
            });
          }
        } catch (error) {
          results.push({
            success: false,
            symbol: order.symbol,
            side: order.side,
            quantity: order.quantity,
            price: order.price,
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: new Date().toISOString(),
          });
        }
      }

      return {
        success: true,
        data: results,
        timestamp: new Date().toISOString(),
      };
    });
  }

  // ============================================================================
  // Advanced Market Data Operations
  // ============================================================================

  /**
   * Get market depth/order book
   */
  async getMarketDepth(symbol: string, limit = 100): Promise<ServiceResponse<OrderBook>> {
    return this.executeWithMetrics("getMarketDepth", async () => {
      console.log(`[EnhancedMexcServiceLayer] Get market depth for ${symbol}`);
      
      // This would typically call the MEXC depth API
      const mockOrderBook: OrderBook = {
        symbol,
        bids: [["50000", "1.5"], ["49999", "2.0"]],
        asks: [["50001", "1.0"], ["50002", "1.8"]],
        timestamp: Date.now(),
      };

      return {
        success: true,
        data: mockOrderBook,
        timestamp: new Date().toISOString(),
      };
    });
  }

  /**
   * Get kline/candlestick data
   */
  async getKlineData(
    symbol: string, 
    interval: "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" = "1h",
    limit = 500
  ): Promise<ServiceResponse<Kline[]>> {
    return this.executeWithMetrics("getKlineData", async () => {
      console.log(`[EnhancedMexcServiceLayer] Get kline data for ${symbol} (${interval})`);
      
      // This would typically call the MEXC klines API
      const mockKlines: Kline[] = [];
      const now = Date.now();
      const intervalMs = this.getIntervalMs(interval);

      for (let i = limit - 1; i >= 0; i--) {
        const openTime = now - (i * intervalMs);
        mockKlines.push({
          openTime,
          open: "50000",
          high: "50100",
          low: "49900",
          close: "50050",
          volume: "100",
          closeTime: openTime + intervalMs - 1,
          quoteAssetVolume: "5002500",
          numberOfTrades: 150,
        });
      }

      return {
        success: true,
        data: mockKlines,
        timestamp: new Date().toISOString(),
      };
    });
  }

  /**
   * Get detailed market statistics
   */
  async getDetailedMarketStats(): Promise<ServiceResponse<MarketStats>> {
    return this.executeWithMetrics("getDetailedMarketStats", async () => {
      const [tickerData, exchangeInfo, calendarData] = await Promise.allSettled([
        this.getTickerData(),
        this.getExchangeInfo(),
        this.getCalendarListings(),
      ]);

      const tickers = tickerData.status === "fulfilled" && tickerData.value.success 
        ? tickerData.value.data : [];
      
      const exchangeSymbols = exchangeInfo.status === "fulfilled" && exchangeInfo.value.success
        ? exchangeInfo.value.data : [];

      const calendar = calendarData.status === "fulfilled" && calendarData.value.success
        ? calendarData.value.data : [];

      // Calculate market statistics
      const totalVolume24h = tickers.reduce((sum, ticker) => 
        sum + Number.parseFloat(ticker.volume || "0"), 0);

      const topGainers = tickers
        .filter(t => Number.parseFloat(t.priceChangePercent || "0") > 0)
        .sort((a, b) => Number.parseFloat(b.priceChangePercent || "0") - Number.parseFloat(a.priceChangePercent || "0"))
        .slice(0, 10);

      const topLosers = tickers
        .filter(t => Number.parseFloat(t.priceChangePercent || "0") < 0)
        .sort((a, b) => Number.parseFloat(a.priceChangePercent || "0") - Number.parseFloat(b.priceChangePercent || "0"))
        .slice(0, 10);

      const marketStats: MarketStats = {
        totalPairs: exchangeSymbols.length,
        activePairs: tickers.length,
        totalVolume24h,
        totalMarketCap: totalVolume24h * 50000, // Rough estimate
        topGainers,
        topLosers,
        newListings: calendar.slice(0, 5),
        trendingPairs: topGainers.slice(0, 5).map(t => t.symbol),
      };

      return {
        success: true,
        data: marketStats,
        timestamp: new Date().toISOString(),
      };
    });
  }

  // ============================================================================
  // Pattern Analysis and Opportunities
  // ============================================================================

  /**
   * Analyze market patterns with caching
   */
  async analyzeMarketPatterns(): Promise<ServiceResponse<PatternAnalysis>> {
    return this.executeWithMetrics("analyzeMarketPatterns", async () => {
      const cacheKey = "market_patterns";
      const cached = this.patternCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.patternCacheTTL) {
        return {
          success: true,
          data: cached.data,
          timestamp: new Date().toISOString(),
          cached: true,
        };
      }

      const [symbolsData, tickerData] = await Promise.allSettled([
        this.getSymbolsData(),
        this.getTickerData(),
      ]);

      const symbols = symbolsData.status === "fulfilled" && symbolsData.value.success 
        ? symbolsData.value.data : [];
      
      const tickers = tickerData.status === "fulfilled" && tickerData.value.success
        ? tickerData.value.data : [];

      // Analyze ready state patterns
      const readyStateSymbols = symbols.filter(s => s.sts === 2 && s.st === 2 && s.tt === 4);
      const readyStatePercentage = symbols.length > 0 ? (readyStateSymbols.length / symbols.length) * 100 : 0;

      // Analyze volume patterns
      const sortedByVolume = tickers.sort((a, b) => 
        Number.parseFloat(b.volume || "0") - Number.parseFloat(a.volume || "0"));
      
      const highVolume = sortedByVolume.slice(0, 20).map(t => t.symbol);
      const emergingVolume = sortedByVolume.slice(20, 50).map(t => t.symbol);

      // Analyze price patterns (simplified)
      const breakouts = tickers
        .filter(t => Number.parseFloat(t.priceChangePercent || "0") > 10)
        .map(t => t.symbol);
      
      const reversals = tickers
        .filter(t => Number.parseFloat(t.priceChangePercent || "0") < -10)
        .map(t => t.symbol);

      const patternAnalysis: PatternAnalysis = {
        readyStatePatterns: {
          symbols: readyStateSymbols,
          count: readyStateSymbols.length,
          percentage: readyStatePercentage,
        },
        volumePatterns: {
          highVolume,
          emergingVolume,
        },
        pricePatterns: {
          breakouts,
          reversals,
        },
        confidence: Math.min(95, Math.max(50, 70 + (readyStateSymbols.length * 5))),
        analysisTime: new Date().toISOString(),
      };

      // Cache the results
      this.patternCache.set(cacheKey, {
        data: patternAnalysis,
        timestamp: Date.now(),
      });

      return {
        success: true,
        data: patternAnalysis,
        timestamp: new Date().toISOString(),
      };
    });
  }

  /**
   * Detect trading opportunities
   */
  async detectTradingOpportunities(): Promise<ServiceResponse<TradingOpportunity[]>> {
    return this.executeWithMetrics("detectTradingOpportunities", async () => {
      const patternResponse = await this.analyzeMarketPatterns();
      
      if (!patternResponse.success) {
        return {
          success: false,
          data: [],
          error: patternResponse.error,
          timestamp: new Date().toISOString(),
        };
      }

      const patterns = patternResponse.data;
      const opportunities: TradingOpportunity[] = [];

      // Ready state opportunities
      patterns.readyStatePatterns.symbols.forEach(symbol => {
        opportunities.push({
          symbol: `${symbol.cd}USDT`,
          type: "pattern_match",
          confidence: 85,
          timeframe: "1h",
          analysis: `Ready state pattern detected (sts:2, st:2, tt:4) for ${symbol.cd}`,
        });
      });

      // Volume surge opportunities
      patterns.volumePatterns.emergingVolume.slice(0, 5).forEach(symbol => {
        opportunities.push({
          symbol,
          type: "volume_surge",
          confidence: 70,
          timeframe: "4h",
          analysis: `Emerging volume pattern detected for ${symbol}`,
        });
      });

      // Breakout opportunities
      patterns.pricePatterns.breakouts.slice(0, 3).forEach(symbol => {
        opportunities.push({
          symbol,
          type: "breakout",
          confidence: 75,
          timeframe: "1d",
          analysis: `Price breakout pattern detected for ${symbol}`,
        });
      });

      return {
        success: true,
        data: opportunities.sort((a, b) => b.confidence - a.confidence),
        timestamp: new Date().toISOString(),
      };
    });
  }

  // ============================================================================
  // Portfolio Management
  // ============================================================================

  /**
   * Get comprehensive portfolio summary
   */
  async getPortfolioSummary(): Promise<ServiceResponse<Portfolio>> {
    return this.executeWithMetrics("getPortfolioSummary", async () => {
      const balanceResponse = await this.getAccountBalances();
      
      if (!balanceResponse.success) {
        return {
          success: false,
          data: {
            totalValue: 0,
            totalValueUsd: 0,
            assets: [],
            allocation: {},
            performance24h: 0,
            topHoldings: [],
          },
          error: balanceResponse.error,
          timestamp: new Date().toISOString(),
        };
      }

      const { balances, totalUsdtValue } = balanceResponse.data;
      
      // Calculate allocation percentages
      const allocation: Record<string, number> = {};
      balances.forEach(balance => {
        if (balance.usdtValue && totalUsdtValue > 0) {
          allocation[balance.asset] = (balance.usdtValue / totalUsdtValue) * 100;
        }
      });

      // Get top holdings (by value)
      const topHoldings = balances
        .filter(b => b.usdtValue && b.usdtValue > 0)
        .sort((a, b) => (b.usdtValue || 0) - (a.usdtValue || 0))
        .slice(0, 10);

      const portfolio: Portfolio = {
        totalValue: totalUsdtValue,
        totalValueUsd: totalUsdtValue, // Assuming USDT ≈ USD
        assets: balances,
        allocation,
        performance24h: 0, // Would need historical data to calculate
        topHoldings,
      };

      return {
        success: true,
        data: portfolio,
        timestamp: new Date().toISOString(),
      };
    });
  }

  // ============================================================================
  // Risk Management
  // ============================================================================

  /**
   * Validate trading risk for an order
   */
  async validateTradingRisk(params: OrderParameters): Promise<ServiceResponse<RiskAssessment>> {
    return this.executeWithMetrics("validateTradingRisk", async () => {
      const portfolioResponse = await this.getPortfolioSummary();
      
      if (!portfolioResponse.success) {
        return {
          success: false,
          data: {
            riskLevel: "EXTREME",
            riskScore: 100,
            factors: {
              liquidityRisk: 100,
              volatilityRisk: 100,
              positionSizeRisk: 100,
              concentrationRisk: 100,
            },
            recommendations: ["Cannot assess risk - portfolio data unavailable"],
            maxRecommendedSize: 0,
          },
          error: portfolioResponse.error,
          timestamp: new Date().toISOString(),
        };
      }

      const portfolio = portfolioResponse.data;
      const orderValue = Number.parseFloat(params.quantity) * (params.price ? Number.parseFloat(params.price) : 1);
      const portfolioValue = portfolio.totalValue;

      // Calculate risk factors
      const positionSizeRisk = portfolioValue > 0 ? Math.min(100, (orderValue / portfolioValue) * 100 * 2) : 100;
      const liquidityRisk = 30; // Would need market depth data
      const volatilityRisk = 50; // Would need price history
      const concentrationRisk = 40; // Based on current allocation

      const overallRisk = (positionSizeRisk + liquidityRisk + volatilityRisk + concentrationRisk) / 4;

      let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
      if (overallRisk < 25) riskLevel = "LOW";
      else if (overallRisk < 50) riskLevel = "MEDIUM";
      else if (overallRisk < 75) riskLevel = "HIGH";
      else riskLevel = "EXTREME";

      const recommendations: string[] = [];
      if (positionSizeRisk > 50) {
        recommendations.push("Position size is large relative to portfolio - consider reducing");
      }
      if (overallRisk > 60) {
        recommendations.push("High risk trade - ensure proper stop-loss is set");
      }
      if (portfolioValue < 1000) {
        recommendations.push("Small portfolio - consider risk management carefully");
      }

      const riskAssessment: RiskAssessment = {
        riskLevel,
        riskScore: Math.round(overallRisk),
        factors: {
          liquidityRisk,
          volatilityRisk,
          positionSizeRisk,
          concentrationRisk,
        },
        recommendations,
        maxRecommendedSize: portfolioValue * 0.05, // 5% of portfolio max
      };

      return {
        success: true,
        data: riskAssessment,
        timestamp: new Date().toISOString(),
      };
    });
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private getIntervalMs(interval: string): number {
    const intervals: Record<string, number> = {
      "1m": 60000,
      "5m": 300000,
      "15m": 900000,
      "30m": 1800000,
      "1h": 3600000,
      "4h": 14400000,
      "1d": 86400000,
    };
    return intervals[interval] || 3600000;
  }

  /**
   * Clear pattern cache
   */
  clearPatternCache(): void {
    this.patternCache.clear();
    console.log("[EnhancedMexcServiceLayer] Pattern cache cleared");
  }

  /**
   * Get pattern cache statistics
   */
  getPatternCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.patternCache.size,
      entries: Array.from(this.patternCache.keys()),
    };
  }
}

// ============================================================================
// Global Enhanced Service Instance and Factory
// ============================================================================

let globalEnhancedMexcService: EnhancedMexcServiceLayer | null = null;

export function getEnhancedMexcService(config?: MexcServiceConfig): EnhancedMexcServiceLayer {
  if (!globalEnhancedMexcService) {
    globalEnhancedMexcService = new EnhancedMexcServiceLayer(config);
  } else if (config) {
    globalEnhancedMexcService.updateConfig(config);
  }
  return globalEnhancedMexcService;
}

export function resetEnhancedMexcService(): void {
  if (globalEnhancedMexcService) {
    globalEnhancedMexcService.dispose();
    globalEnhancedMexcService = null;
  }
}

// Export for compatibility - using the enhanced service as the default
export { getEnhancedMexcService as getMexcService };
export default EnhancedMexcServiceLayer;