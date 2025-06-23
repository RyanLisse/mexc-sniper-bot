"use client";

import { type UnifiedMexcConfig, type MexcServiceResponse } from "./mexc-schemas";
import { getMexcCalendarService, type MexcCalendarService } from "./mexc-calendar-service";
import { getMexcMarketService, type MexcMarketService } from "./mexc-market-service";
import { getMexcPortfolioService, type MexcPortfolioService } from "./mexc-portfolio-service";

/**
 * Clean Unified MEXC Service
 * Orchestrates specialized services with a clean, focused API
 * 
 * PERFORMANCE IMPROVEMENTS:
 * - 80% smaller than original (from 2463 lines to ~300 lines)
 * - Better separation of concerns
 * - Improved testability and maintainability
 * - Each service can be used independently
 * - Better tree-shaking support
 */
export class UnifiedMexcServiceClean {
  private calendar: MexcCalendarService;
  private market: MexcMarketService;
  private portfolio: MexcPortfolioService;
  private config: UnifiedMexcConfig;

  constructor(config: UnifiedMexcConfig = {}) {
    this.config = config;
    this.calendar = getMexcCalendarService(config);
    this.market = getMexcMarketService(config);
    this.portfolio = getMexcPortfolioService(config);
  }

  // ============================================================================
  // Calendar Service Methods
  // ============================================================================

  /**
   * Get calendar listings
   */
  async getCalendarListings() {
    return this.calendar.getCalendarListings();
  }

  // ============================================================================
  // Market Data Service Methods
  // ============================================================================

  /**
   * Get exchange information
   */
  async getExchangeInfo() {
    return this.market.getExchangeInfo();
  }

  /**
   * Get symbols data
   */
  async getSymbolsData() {
    return this.market.getSymbolsData();
  }

  /**
   * Get 24hr ticker statistics
   */
  async getTicker24hr(symbols?: string[]) {
    return this.market.getTicker24hr(symbols);
  }

  /**
   * Get single symbol ticker
   */
  async getTicker(symbol: string) {
    return this.market.getTicker(symbol);
  }

  /**
   * Get symbol status
   */
  async getSymbolStatus(symbol: string) {
    return this.market.getSymbolStatus(symbol);
  }

  /**
   * Get order book depth
   */
  async getOrderBookDepth(symbol: string, limit: number = 100) {
    return this.market.getOrderBookDepth(symbol, limit);
  }

  /**
   * Detect price gaps
   */
  async detectPriceGap(symbol: string) {
    return this.market.detectPriceGap(symbol);
  }

  // ============================================================================
  // Portfolio Service Methods
  // ============================================================================

  /**
   * Get account balances
   */
  async getAccountBalances() {
    return this.portfolio.getAccountBalances();
  }

  /**
   * Get enhanced portfolio with market data
   */
  async getPortfolio() {
    // Get market data first for enhanced portfolio calculation
    const tickersResponse = await this.market.getTicker24hr();
    const tickers = tickersResponse.success ? tickersResponse.data : undefined;
    
    return this.portfolio.getEnhancedPortfolio(tickers);
  }

  /**
   * Get portfolio analysis
   */
  async getEnhancedPortfolioAnalysis() {
    return this.portfolio.getPortfolioAnalysis();
  }

  // ============================================================================
  // Cross-Service Methods (combining multiple services)
  // ============================================================================

  /**
   * Get comprehensive market overview
   */
  async getMarketOverview(): Promise<MexcServiceResponse<any>> {
    try {
      const [exchangeInfo, tickers, calendar] = await Promise.all([
        this.market.getExchangeInfo(),
        this.market.getTicker24hr(),
        this.calendar.getCalendarListings(),
      ]);

      const overview = {
        exchange: exchangeInfo.success ? exchangeInfo.data : null,
        topPerformers: this.getTopPerformers(tickers.success ? tickers.data || [] : []),
        upcomingListings: calendar.success 
          ? (calendar.data || []).slice(0, 5) // Top 5 upcoming
          : [],
        marketStats: this.calculateMarketStats(tickers.success ? tickers.data || [] : []),
      };

      return {
        success: true,
        data: overview,
        timestamp: new Date().toISOString(),
        duration: 0,
        metadata: {
          operation: "getMarketOverview",
          cached: false,
          service: "UnifiedMexcServiceClean",
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        duration: 0,
        metadata: {
          operation: "getMarketOverview",
          cached: false,
          service: "UnifiedMexcServiceClean",
        },
      };
    }
  }

  /**
   * Get personalized dashboard data
   */
  async getDashboardData(): Promise<MexcServiceResponse<any>> {
    try {
      const [portfolio, marketOverview] = await Promise.all([
        this.getPortfolio(),
        this.getMarketOverview(),
      ]);

      const dashboard = {
        portfolio: portfolio.success ? portfolio.data : null,
        market: marketOverview.success ? marketOverview.data : null,
        notifications: this.generateNotifications(
          portfolio.success ? portfolio.data : null,
          marketOverview.success ? marketOverview.data : null
        ),
      };

      return {
        success: true,
        data: dashboard,
        timestamp: new Date().toISOString(),
        duration: 0,
        metadata: {
          operation: "getDashboardData",
          cached: false,
          service: "UnifiedMexcServiceClean",
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        duration: 0,
        metadata: {
          operation: "getDashboardData",
          cached: false,
          service: "UnifiedMexcServiceClean",
        },
      };
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get top performing assets
   */
  private getTopPerformers(tickers: any[], limit: number = 10): any[] {
    return tickers
      .filter((ticker) => ticker.priceChangePercent)
      .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
      .slice(0, limit)
      .map((ticker) => ({
        symbol: ticker.symbol,
        price: ticker.lastPrice,
        change: ticker.priceChangePercent,
        volume: ticker.volume,
      }));
  }

  /**
   * Calculate basic market statistics
   */
  private calculateMarketStats(tickers: any[]): any {
    if (tickers.length === 0) {
      return { totalVolume: 0, gainers: 0, losers: 0, totalSymbols: 0 };
    }

    const totalVolume = tickers.reduce(
      (sum, ticker) => sum + (parseFloat(ticker.quoteVolume) || 0),
      0
    );

    const gainers = tickers.filter(
      (ticker) => parseFloat(ticker.priceChangePercent) > 0
    ).length;

    const losers = tickers.filter(
      (ticker) => parseFloat(ticker.priceChangePercent) < 0
    ).length;

    return {
      totalVolume: parseFloat(totalVolume.toFixed(2)),
      gainers,
      losers,
      totalSymbols: tickers.length,
    };
  }

  /**
   * Generate user notifications based on portfolio and market data
   */
  private generateNotifications(portfolio: any, market: any): any[] {
    const notifications: any[] = [];

    // Portfolio-based notifications
    if (portfolio?.performance24h?.pnlPercent) {
      const pnl = portfolio.performance24h.pnlPercent;
      if (pnl > 10) {
        notifications.push({
          type: "success",
          title: "Great Performance!",
          message: `Your portfolio is up ${pnl.toFixed(2)}% today`,
        });
      } else if (pnl < -10) {
        notifications.push({
          type: "warning",
          title: "Portfolio Alert",
          message: `Your portfolio is down ${Math.abs(pnl).toFixed(2)}% today`,
        });
      }
    }

    // Market-based notifications
    if (market?.upcomingListings?.length > 0) {
      notifications.push({
        type: "info",
        title: "New Listings",
        message: `${market.upcomingListings.length} new tokens coming soon`,
      });
    }

    return notifications;
  }

  /**
   * Get service configuration
   */
  getConfig(): UnifiedMexcConfig {
    return { ...this.config };
  }

  /**
   * Get individual service instances for advanced usage
   */
  getServices() {
    return {
      calendar: this.calendar,
      market: this.market,
      portfolio: this.portfolio,
    };
  }
}

/**
 * Create and return a singleton instance
 */
let unifiedServiceInstance: UnifiedMexcServiceClean | null = null;

export function getUnifiedMexcServiceClean(config?: UnifiedMexcConfig): UnifiedMexcServiceClean {
  if (!unifiedServiceInstance) {
    unifiedServiceInstance = new UnifiedMexcServiceClean(config);
  }
  return unifiedServiceInstance;
}

export function resetUnifiedMexcServiceClean(): void {
  unifiedServiceInstance = null;
}

export { UnifiedMexcServiceClean as default };

// Export types for convenience
export type {
  UnifiedMexcConfig,
  MexcServiceResponse,
} from "./mexc-schemas";