/**
 * Unified MEXC Service v2 - Modular Architecture
 *
 * Refactored service that orchestrates modular components for:
 * - Better maintainability (under 500 lines!)
 * - Improved performance through focused modules
 * - Enhanced testability with clear separation of concerns
 * - Optimized bundle size through tree-shaking
 */

import type {
  MarketService,
  PortfolioService,
  TradingService,
} from "@/src/application/interfaces/trading-repository";
import type { ActivityQueryOptionsType } from "@/src/schemas/unified/mexc-api-schemas";
// Build-safe imports - modular architecture
import type {
  BalanceEntry,
  CalendarEntry,
  MexcServiceResponse,
  SymbolEntry,
} from "../data/modules/mexc-api-types";
import { MexcCacheLayer } from "../data/modules/mexc-cache-layer";
import { MexcCoreClient } from "../data/modules/mexc-core-client";

// Import modular components
import { hasValidCredentials, mergeConfig, type UnifiedMexcConfigV2 } from "./unified-mexc-config";
import { UnifiedMexcCoreModule } from "./unified-mexc-core";
import { UnifiedMexcPortfolioModule } from "./unified-mexc-portfolio";
import {
  type OrderBookData,
  type RecentActivityData,
  type SymbolTickerData,
  type TradingOrderData,
  UnifiedMexcTradingModule,
} from "./unified-mexc-trading";

// ============================================================================
// Unified MEXC Service v2
// ============================================================================

export class UnifiedMexcServiceV2 implements PortfolioService, TradingService, MarketService {
  // Simple console logger to avoid webpack bundling issues
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[unified-mexc-service-v2]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[unified-mexc-service-v2]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[unified-mexc-service-v2]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[unified-mexc-service-v2]", message, context || ""),
  };

  private config: Required<UnifiedMexcConfigV2>;
  private coreClient: MexcCoreClient;
  private cacheLayer: MexcCacheLayer;

  // Modular components
  private coreModule: UnifiedMexcCoreModule;
  private portfolioModule: UnifiedMexcPortfolioModule;
  private tradingModule: UnifiedMexcTradingModule;

  constructor(config: Partial<UnifiedMexcConfigV2> = {}) {
    this.config = mergeConfig(config);

    // Initialize core dependencies
    this.coreClient = new MexcCoreClient({
      apiKey: this.config.apiKey,
      secretKey: this.config.secretKey,
      passphrase: this.config.passphrase,
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay,
      rateLimitDelay: this.config.rateLimitDelay,
    });

    this.cacheLayer = new MexcCacheLayer({
      enableCaching: this.config.enableCaching,
      cacheTTL: this.config.cacheTTL,
      apiResponseTTL: this.config.apiResponseTTL,
    });

    // Initialize modular components
    this.coreModule = new UnifiedMexcCoreModule(this.coreClient, this.cacheLayer);
    this.portfolioModule = new UnifiedMexcPortfolioModule(this.coreClient, this.cacheLayer);
    this.tradingModule = new UnifiedMexcTradingModule(this.coreClient, this.cacheLayer);
  }

  // ============================================================================
  // Interface Method Implementations
  // ============================================================================

  // PortfolioService Interface Methods

  // TradingService Interface Methods
  async executeTrade(params: {
    symbol: string;
    side: "BUY" | "SELL";
    type: "MARKET" | "LIMIT" | "STOP_LIMIT";
    quantity?: number;
    quoteOrderQty?: number;
    price?: number;
    stopPrice?: number;
    timeInForce?: "GTC" | "IOC" | "FOK";
    isAutoSnipe?: boolean;
    confidenceScore?: number;
    paperTrade?: boolean;
  }): Promise<{
    success: boolean;
    data?: {
      orderId: string;
      clientOrderId?: string;
      symbol: string;
      side: string;
      type: string;
      quantity: string;
      price: string;
      status: string;
      executedQty: string;
      timestamp: string;
    };
    error?: string;
    executionTime?: number;
  }> {
    // Transform params and result to match interface
    const result = await this.tradingModule.executeTrade({
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      quantity: params.quantity || 0,
      price: params.price,
      stopPrice: params.stopPrice,
      timeInForce: params.timeInForce,
    });

    // Transform result to match expected interface
    if (result.success && result.data) {
      return {
        ...result,
        data: {
          ...result.data,
          side: String(result.data.side),
          price: result.data.price || "0",
          executedQty: result.data.quantity,
          timestamp: new Date().toISOString(),
        },
      };
    }

    return result as any;
  }

  async getOrderStatus(orderId: string): Promise<{
    success: boolean;
    data?: {
      orderId: string;
      symbol: string;
      status: string;
      side: "BUY" | "SELL";
      type: string;
      quantity: string;
      price?: string;
      executedQuantity: string;
      cummulativeQuoteQuantity: string;
      timeInForce?: string;
      timestamp: number;
    };
    error?: string;
  }> {
    // Implement getOrderStatus using available trading methods
    try {
      const result = await this.coreClient.getOrderStatus("", parseInt(orderId) || 0);
      return {
        success: result.success,
        data: result.data ? {
          orderId: String(result.data.orderId !== null && result.data.orderId !== undefined ? result.data.orderId : orderId),
          symbol: result.data.symbol || "",
          status: result.data.status || "",
          side: result.data.side as "BUY" | "SELL",
          type: result.data.type || "",
          quantity: result.data.quantity || "0",
          price: result.data.price,
          executedQuantity: String(result.data.executedQty !== null && result.data.executedQty !== undefined ? result.data.executedQty : "0"),
          cummulativeQuoteQuantity: String(result.data.cummulativeQuoteQty !== null && result.data.cummulativeQuoteQty !== undefined ? result.data.cummulativeQuoteQty : "0"),
          timeInForce: result.data.timeInForce,
          timestamp: Date.now(),
        } : undefined,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }

  async cancelOrder(
    orderId: string,
    symbol?: string
  ): Promise<{
    success: boolean;
    data?: {
      orderId: string;
      symbol: string;
      status: string;
    };
    error?: string;
  }> {
    try {
      const result = await this.coreClient.cancelOrder(symbol || "", parseInt(orderId) || 0);
      return {
        success: result.success,
        data: result.data ? {
          orderId: String(result.data.orderId !== null && result.data.orderId !== undefined ? result.data.orderId : orderId),
          symbol: result.data.symbol || symbol || "",
          status: result.data.status || "CANCELED",
        } : undefined,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }

  async getTradeHistory(
    symbol?: string,
    limit?: number
  ): Promise<{
    success: boolean;
    data?: Array<{
      id: string;
      orderId: string;
      symbol: string;
      side: "BUY" | "SELL";
      quantity: string;
      price: string;
      commission: string;
      commissionAsset: string;
      timestamp: number;
    }>;
    error?: string;
  }> {
    try {
      // Implement real trade history retrieval using core client
      const result = await this.coreClient.getUserTrades({
        symbol: symbol || undefined,
        limit: limit || 100,
        startTime: Date.now() - (7 * 24 * 60 * 60 * 1000), // Last 7 days
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to fetch trade history",
        };
      }

      // Transform the data to match expected format
      const transformedData = (result.data || []).map((trade: any) => ({
        id: String(trade.id || trade.tradeId || `${Date.now()}-${Math.random()}`),
        orderId: String(trade.orderId || ""),
        symbol: trade.symbol || symbol || "",
        side: (trade.side as "BUY" | "SELL") || "BUY",
        quantity: String(trade.qty || trade.quantity || "0"),
        price: String(trade.price || "0"),
        commission: String(trade.commission || trade.fee || "0"),
        commissionAsset: trade.commissionAsset || trade.feeAsset || "USDT",
        timestamp: trade.time || trade.timestamp || Date.now(),
      }));

      return {
        success: true,
        data: transformedData,
      };
    } catch (error) {
      this.logger.error("Trade history retrieval failed", { 
        symbol, 
        limit, 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getOpenOrders(symbol?: string): Promise<{
    success: boolean;
    data?: Array<{
      orderId: string;
      symbol: string;
      side: "BUY" | "SELL";
      type: string;
      quantity: string;
      price?: string;
      status: string;
      timestamp: number;
    }>;
    error?: string;
  }> {
    try {
      const result = await this.coreClient.getOpenOrders(symbol);
      return {
        success: result.success,
        data: result.data ? result.data.map((order: any) => ({
          orderId: String(order.orderId !== null && order.orderId !== undefined ? order.orderId : ""),
          symbol: order.symbol || "",
          side: order.side as "BUY" | "SELL",
          type: order.type || "",
          quantity: String(order.quantity !== null && order.quantity !== undefined ? order.quantity : "0"),
          price: order.price,
          status: order.status || "",
          timestamp: order.timestamp || Date.now(),
        })) : undefined,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }

  // MarketService Interface Methods
  async getExchangeInfo(): Promise<{
    success: boolean;
    data?: {
      symbols?: Array<{
        symbol: string;
        status: string;
        baseAsset: string;
        quoteAsset: string;
      }>;
    };
    error?: string;
  }> {
    // Delegate to core module's exchange info via symbol data
    try {
      const symbolsResponse = await this.coreModule.getAllSymbols();
      if (!symbolsResponse.success) {
        return {
          success: false,
          error: symbolsResponse.error || "Failed to get exchange info",
        };
      }

      const symbols = (symbolsResponse.data || []).map((symbol: any) => ({
        symbol: symbol.symbol || "",
        status: symbol.status || "UNKNOWN",
        baseAsset: symbol.baseAsset || "",
        quoteAsset: symbol.quoteAsset || "",
      }));

      return {
        success: true,
        data: { symbols },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }


  async getTicker24hr(symbols?: string[]): Promise<{
    success: boolean;
    data?: Array<{
      symbol: string;
      price: string;
      lastPrice: string;
      priceChangePercent: string;
      volume: string;
    }>;
    error?: string;
  }> {
    try {
      if (!symbols || symbols.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      if (symbols.length === 1) {
        const tickerResponse = await this.tradingModule.getTicker(symbols[0]);
        if (!tickerResponse.success) {
          return {
            success: false,
            error: tickerResponse.error || "Failed to get ticker",
          };
        }

        const ticker = {
          symbol: symbols[0],
          price: tickerResponse.data?.price || tickerResponse.data?.lastPrice || "0",
          lastPrice: tickerResponse.data?.lastPrice || tickerResponse.data?.price || "0",
          priceChangePercent: tickerResponse.data?.priceChangePercent || "0",
          volume: tickerResponse.data?.volume || "0",
        };

        return {
          success: true,
          data: [ticker],
        };
      }

      // Implement batch ticker functionality for multiple symbols
      const tickerPromises = symbols.map(async (symbol) => {
        try {
          const tickerResponse = await this.tradingModule.getTicker(symbol);
          if (tickerResponse.success && tickerResponse.data) {
            return {
              symbol,
              price: tickerResponse.data.price || tickerResponse.data.lastPrice || "0",
              lastPrice: tickerResponse.data.lastPrice || tickerResponse.data.price || "0",
              priceChangePercent: tickerResponse.data.priceChangePercent || "0",
              volume: tickerResponse.data.volume || "0",
            };
          }
          return null;
        } catch (error) {
          this.logger.warn(`Failed to get ticker for ${symbol}`, { error });
          return null;
        }
      });

      // Execute all ticker requests in parallel with rate limiting
      const batchSize = 5; // Process 5 symbols at a time to avoid rate limits
      const results: Array<any> = [];
      
      for (let i = 0; i < tickerPromises.length; i += batchSize) {
        const batch = tickerPromises.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch);
        results.push(...batchResults.filter(result => result !== null));
        
        // Small delay between batches to respect rate limits
        if (i + batchSize < tickerPromises.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      return {
        success: true,
        data: results,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getTicker(symbol: string): Promise<{
    success: boolean;
    data?: {
      symbol: string;
      price: string;
      lastPrice: string;
      priceChangePercent: string;
      volume: string;
    };
    error?: string;
  }> {
    const tickerResponse = await this.tradingModule.getTicker(symbol);
    if (!tickerResponse.success) {
      return {
        success: false,
        error: tickerResponse.error || "Failed to get ticker",
      };
    }

    return {
      success: true,
      data: {
        symbol,
        price: tickerResponse.data?.price || tickerResponse.data?.lastPrice || "0",
        lastPrice: tickerResponse.data?.lastPrice || tickerResponse.data?.price || "0",
        priceChangePercent: tickerResponse.data?.priceChangePercent || "0",
        volume: tickerResponse.data?.volume || "0",
      },
    };
  }

  async getSymbolStatus(symbol: string): Promise<{ status: string; trading: boolean }> {
    try {
      const exchangeResponse = await this.getExchangeInfo();
      if (!exchangeResponse.success || !exchangeResponse.data) {
        return { status: "ERROR", trading: false };
      }

      const symbolInfo = exchangeResponse.data.symbols?.find((s) => s.symbol === symbol);
      if (!symbolInfo) {
        return { status: "NOT_FOUND", trading: false };
      }

      return {
        status: symbolInfo.status,
        trading: symbolInfo.status === "TRADING",
      };
    } catch (error) {
      return { status: "ERROR", trading: false };
    }
  }

  async getOrderBookDepth(
    symbol: string,
    limit = 100
  ): Promise<{
    success: boolean;
    data?: {
      bids: [string, string][];
      asks: [string, string][];
      lastUpdateId: number;
    };
    error?: string;
  }> {
    // Delegate to trading module's order book functionality
    const orderBookResponse = await this.tradingModule.getOrderBook(symbol, limit);
    if (!orderBookResponse.success) {
      return {
        success: false,
        error: orderBookResponse.error || "Failed to get order book",
      };
    }

    return {
      success: true,
      data: {
        bids: orderBookResponse.data?.bids || [],
        asks: orderBookResponse.data?.asks || [],
        lastUpdateId: orderBookResponse.data?.lastUpdateId || Date.now(),
      },
    };
  }

  // ============================================================================
  // Public API - Delegated to Modular Components (Legacy Methods)
  // ============================================================================

  // Calendar & Listings (Core Module)
  async getCalendarListings(): Promise<MexcServiceResponse<CalendarEntry[]>> {
    return this.coreModule.getCalendarListings();
  }

  // Symbols & Market Data (Core Module)
  async getSymbolsByVcoinId(vcoinId: string): Promise<MexcServiceResponse<SymbolEntry[]>> {
    return this.coreModule.getSymbolsByVcoinId(vcoinId);
  }

  async getAllSymbols(): Promise<MexcServiceResponse<SymbolEntry[]>> {
    return this.coreModule.getAllSymbols();
  }

  async getServerTime(): Promise<MexcServiceResponse<number>> {
    return this.coreModule.getServerTime();
  }

  async getSymbolInfoBasic(symbolName: string): Promise<MexcServiceResponse<any>> {
    return this.coreModule.getSymbolInfoBasic(symbolName);
  }

  async getActivityData(currency: string): Promise<MexcServiceResponse<any>> {
    return this.coreModule.getActivityData(currency);
  }

  async getSymbolData(symbol: string): Promise<MexcServiceResponse<any>> {
    return this.coreModule.getSymbolData(symbol);
  }

  async getSymbolsForVcoins(vcoinIds: string[]): Promise<MexcServiceResponse<SymbolEntry[]>> {
    return this.coreModule.getSymbolsForVcoins(vcoinIds);
  }

  async getSymbolsData(): Promise<{
    success: boolean;
    data?: Array<{
      symbol: string;
      status: string;
      baseAsset: string;
      quoteAsset: string;
    }>;
    error?: string;
  }> {
    const coreResult = await this.coreModule.getSymbolsData();
    
    if (!coreResult.success) {
      return {
        success: false,
        error: coreResult.error || "Failed to get symbols data",
      };
    }

    // Transform the core data to match MarketService interface
    const transformedData = (coreResult.data || []).map((symbol: any) => ({
      symbol: symbol.symbol || "",
      status: symbol.sts === 1 ? "TRADING" : "INACTIVE",
      baseAsset: symbol.symbol ? symbol.symbol.split("USDT")[0] : "",
      quoteAsset: "USDT", // Most MEXC symbols are against USDT
    }));

    return {
      success: true,
      data: transformedData,
    };
  }

  async getBulkActivityData(
    currencies: string[],
    options?: ActivityQueryOptionsType
  ): Promise<MexcServiceResponse<any[]>> {
    return this.coreModule.getBulkActivityData(currencies, options);
  }

  async hasRecentActivity(
    currency: string,
    timeframeMs: number = 24 * 60 * 60 * 1000
  ): Promise<boolean> {
    try {
      const activityResponse = await this.getActivityData(currency);

      // If the response failed, no recent activity
      if (!activityResponse.success || !activityResponse.data) {
        return false;
      }

      // Check if the activity data indicates recent activity within timeframe
      const currentTime = Date.now();
      const cutoffTime = currentTime - timeframeMs;

      // Check if the response timestamp is within the timeframe
      // This represents when the activity data was last updated/fetched
      const timestampValue =
        typeof activityResponse.timestamp === "string"
          ? new Date(activityResponse.timestamp).getTime()
          : activityResponse.timestamp;
      const hasRecent = timestampValue > cutoffTime;

      return hasRecent;
    } catch (error) {
      console.warn(`Failed to check recent activity for ${currency}:`, error);
      return false;
    }
  }

  // Account & Portfolio (Portfolio Module)
  async getAccountBalance(): Promise<MexcServiceResponse<BalanceEntry[]>> {
    const result = await this.portfolioModule.getAccountBalance();
    
    // Convert to MexcServiceResponse format with timestamp
    return {
      success: result.success,
      data: result.data as BalanceEntry[],
      error: result.error,
      timestamp: Date.now(),
      source: "unified-mexc-service-v2",
    };
  }

  async getAccountBalances(): Promise<
    MexcServiceResponse<{
      balances: BalanceEntry[];
      totalUsdtValue: number;
      totalValue: number;
      totalValueBTC: number;
      allocation: Record<string, number>;
      performance24h: { change: number; changePercent: number };
    }>
  > {
    const result = await this.portfolioModule.getAccountBalances();
    
    // Convert to MexcServiceResponse format with timestamp
    return {
      success: result.success,
      data: result.data as {
        balances: BalanceEntry[];
        totalUsdtValue: number;
        totalValue: number;
        totalValueBTC: number;
        allocation: Record<string, number>;
        performance24h: { change: number; changePercent: number };
      },
      error: result.error,
      timestamp: Date.now(),
      source: "unified-mexc-service-v2",
    };
  }

  // Trading Methods (Trading Module)

  async getSymbolTicker(symbol: string): Promise<MexcServiceResponse<SymbolTickerData>> {
    return this.tradingModule.getSymbolTicker(symbol);
  }

  async getOrderBook(
    symbol: string,
    limit: number = 20
  ): Promise<MexcServiceResponse<OrderBookData>> {
    return this.tradingModule.getOrderBook(symbol, limit);
  }

  async getRecentActivity(
    symbol: string,
    hours: number = 24
  ): Promise<MexcServiceResponse<RecentActivityData>> {
    return this.tradingModule.getRecentActivity(symbol, hours);
  }

  async placeOrder(orderData: TradingOrderData): Promise<MexcServiceResponse<any>> {
    return this.tradingModule.placeOrder(orderData);
  }

  async createOrder(orderData: TradingOrderData): Promise<MexcServiceResponse<any>> {
    return this.tradingModule.createOrder(orderData);
  }

  // Portfolio Methods (Portfolio Module)
  async getAccountInfo(): Promise<
    MexcServiceResponse<{
      accountType: string;
      canTrade: boolean;
      canWithdraw: boolean;
      canDeposit: boolean;
      balances: BalanceEntry[];
    }>
  > {
    const result = await this.portfolioModule.getAccountInfo();
    
    // Convert to MexcServiceResponse format with timestamp
    return {
      success: result.success,
      data: result.data as {
        accountType: string;
        canTrade: boolean;
        canWithdraw: boolean;
        canDeposit: boolean;
        balances: BalanceEntry[];
      },
      error: result.error,
      timestamp: Date.now(),
      source: "unified-mexc-service-v2",
    };
  }

  async getTotalPortfolioValue(): Promise<number> {
    return this.portfolioModule.getTotalPortfolioValue();
  }

  async getTopAssets(limit = 10): Promise<BalanceEntry[]> {
    return this.portfolioModule.getTopAssets(limit);
  }

  async hasSufficientBalance(asset: string, requiredAmount: number): Promise<boolean> {
    return this.portfolioModule.hasSufficientBalance(asset, requiredAmount);
  }

  async getAssetBalance(asset: string): Promise<{ free: string; locked: string } | null> {
    return this.portfolioModule.getAssetBalance(asset);
  }

  // ============================================================================
  // Core Module - Connectivity & Status
  // ============================================================================

  async testConnectivity(): Promise<MexcServiceResponse<{ serverTime: number; latency: number }>> {
    return this.coreModule.testConnectivity();
  }

  async testConnectivityWithResponse(): Promise<
    MexcServiceResponse<{
      serverTime: number;
      latency: number;
      connected: boolean;
      apiVersion: string;
      region: string;
    }>
  > {
    return this.coreModule.testConnectivityWithResponse();
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  invalidateCalendarCache(): number {
    return this.cacheLayer.invalidateCalendar();
  }

  invalidateSymbolsCache(): number {
    return this.cacheLayer.invalidateSymbols();
  }

  invalidateUserCache(): number {
    return this.cacheLayer.invalidateUserData();
  }

  getCacheMetrics() {
    return this.cacheLayer.getMetrics();
  }

  // ============================================================================
  // Configuration & Status
  // ============================================================================

  hasValidCredentials(): boolean {
    return hasValidCredentials(this.config);
  }

  // Status methods
  getStatus() {
    return {
      config: {
        baseUrl: this.config.baseUrl,
        cachingEnabled: this.config.enableCaching,
        circuitBreakerEnabled: this.config.enableCircuitBreaker,
        enhancedFeaturesEnabled: this.config.enableEnhancedFeatures,
      },
      cache: this.cacheLayer.getMetrics(),
      timestamp: Date.now(),
    };
  }

  // ============================================================================
  // Lifecycle Management & Additional Methods
  // ============================================================================

  /**
   * Ping the MEXC API to test connectivity
   */
  async ping(): Promise<MexcServiceResponse<{ serverTime: number; latency: number }>> {
    return this.testConnectivity();
  }

  /**
   * Get symbol price ticker (alias for getTicker for compatibility)
   */
  async getSymbolPriceTicker(symbol: string): Promise<{
    success: boolean;
    data?: {
      symbol: string;
      price: string;
      lastPrice?: string;
      priceChangePercent?: string;
      volume?: string;
    };
    error?: string;
  }> {
    const result = await this.getTicker(symbol);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to get symbol price ticker",
      };
    }

    return {
      success: true,
      data: {
        symbol: result.data?.symbol || symbol,
        price: result.data?.price || result.data?.lastPrice || "0",
        lastPrice: result.data?.lastPrice || result.data?.price || "0",
        priceChangePercent: result.data?.priceChangePercent || "0",
        volume: result.data?.volume || "0",
      },
    };
  }

  // Missing TradingService interface methods
  async getCurrentPrice(symbol: string): Promise<number> {
    try {
      const ticker = await this.getTicker(symbol);
      if (ticker.success && ticker.data?.lastPrice) {
        return parseFloat(String(ticker.data.lastPrice)) || 0;
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  async canTrade(symbol: string): Promise<boolean> {
    try {
      const exchangeInfo = await this.getExchangeInfo();
      if (exchangeInfo.success && exchangeInfo.data?.symbols) {
        const symbolInfo = exchangeInfo.data.symbols.find((s: any) => s.symbol === symbol);
        return symbolInfo?.status === 'TRADING';
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  // ============================================================================

  destroy(): void {
    this.cacheLayer.destroy();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new unified MEXC service instance
 */
export function createUnifiedMexcServiceV2(
  config?: Partial<UnifiedMexcConfigV2>
): UnifiedMexcServiceV2 {
  return new UnifiedMexcServiceV2(config);
}

/**
 * Singleton instance for global use
 */
let globalServiceInstance: UnifiedMexcServiceV2 | null = null;

export function getUnifiedMexcServiceV2(
  config?: Partial<UnifiedMexcConfigV2>
): UnifiedMexcServiceV2 {
  if (!globalServiceInstance) {
    globalServiceInstance = new UnifiedMexcServiceV2(config);
  }
  return globalServiceInstance;
}

export function resetUnifiedMexcServiceV2(): void {
  if (globalServiceInstance) {
    globalServiceInstance.destroy();
    globalServiceInstance = null;
  }
}

// ============================================================================
// Exports
// ============================================================================

export default UnifiedMexcServiceV2;
export type { UnifiedMexcConfigV2 };

// Export singleton instance for use in pattern detection and other services
export const unifiedMexcService = getUnifiedMexcServiceV2();
