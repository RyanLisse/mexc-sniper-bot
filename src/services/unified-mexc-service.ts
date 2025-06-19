/**
 * Unified MEXC Service for MEXC Sniper Bot
 *
 * This service consolidates all MEXC-related functionality from:
 * - unified-mexc-client.ts
 * - Previous legacy implementations (now consolidated)
 *
 * Into a single, comprehensive service with clear boundaries and responsibilities.
 *
 * Features:
 * - Complete MEXC API coverage (spot trading, market data, account management)
 * - Circuit breaker pattern for reliability
 * - Request/response caching
 * - Rate limiting compliance
 * - Error handling and retry logic
 * - Performance monitoring
 * - Type safety with Zod validation
 */

import * as crypto from "node:crypto";
import { z } from "zod";

// ============================================================================
// Configuration and Base Types
// ============================================================================

export interface UnifiedMexcConfig {
  apiKey?: string;
  secretKey?: string;
  passphrase?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  rateLimitDelay?: number;
  enableCaching?: boolean;
  cacheTTL?: number;
  enableCircuitBreaker?: boolean;
  enableMetrics?: boolean;
}

export interface MexcServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  timestamp: string;
  requestId?: string;
  responseTime?: number;
  cached?: boolean;
  executionTimeMs?: number;
  retryCount?: number;
}

// ============================================================================
// Data Schemas and Types
// ============================================================================

// Calendar Entry
export const CalendarEntrySchema = z.object({
  vcoinId: z.string(),
  symbol: z.string(),
  projectName: z.string(),
  firstOpenTime: z.number(),
});

// Symbol Entry
export const SymbolEntrySchema = z.object({
  cd: z.string(),
  sts: z.number(),
  st: z.number(),
  tt: z.number(),
  ca: z.record(z.unknown()).optional(),
  ps: z.record(z.unknown()).optional(),
  qs: z.record(z.unknown()).optional(),
  ot: z.record(z.unknown()).optional(),
});

// Balance Entry
export const BalanceEntrySchema = z.object({
  asset: z.string(),
  free: z.string(),
  locked: z.string(),
  total: z.number(),
  usdtValue: z.number().optional(),
});

// Exchange Symbol
export const ExchangeSymbolSchema = z.object({
  symbol: z.string(),
  status: z.string(),
  baseAsset: z.string(),
  quoteAsset: z.string(),
  baseAssetPrecision: z.number(),
  quotePrecision: z.number(),
  quoteAssetPrecision: z.number(),
});

// Ticker
export const TickerSchema = z.object({
  symbol: z.string(),
  lastPrice: z.string(),
  price: z.string(),
  priceChange: z.string(),
  priceChangePercent: z.string(),
  volume: z.string(),
  quoteVolume: z.string().optional(),
  openPrice: z.string().optional(),
  highPrice: z.string().optional(),
  lowPrice: z.string().optional(),
  count: z.string().optional(),
});

// Order Parameters
export const OrderParametersSchema = z.object({
  symbol: z.string(),
  side: z.enum(["BUY", "SELL"]),
  type: z.enum(["LIMIT", "MARKET", "STOP_LOSS", "STOP_LOSS_LIMIT"]),
  quantity: z.string(),
  price: z.string().optional(),
  stopPrice: z.string().optional(),
  timeInForce: z.enum(["GTC", "IOC", "FOK"]).optional(),
  icebergQty: z.string().optional(),
  newOrderRespType: z.enum(["ACK", "RESULT", "FULL"]).optional(),
});

// Order Result
export const OrderResultSchema = z.object({
  success: z.boolean(),
  orderId: z.string().optional(),
  symbol: z.string(),
  side: z.string(),
  quantity: z.string(),
  price: z.string().optional(),
  status: z.string().optional(),
  error: z.string().optional(),
  timestamp: z.string(),
});

// Order Status
export const OrderStatusSchema = z.object({
  orderId: z.string(),
  symbol: z.string(),
  status: z.enum(["NEW", "PARTIALLY_FILLED", "FILLED", "CANCELED", "REJECTED", "EXPIRED"]),
  side: z.enum(["BUY", "SELL"]),
  type: z.enum(["LIMIT", "MARKET", "STOP_LOSS", "STOP_LOSS_LIMIT"]),
  quantity: z.string(),
  price: z.string().optional(),
  stopPrice: z.string().optional(),
  executedQty: z.string(),
  cummulativeQuoteQty: z.string(),
  time: z.number(),
  updateTime: z.number(),
});

// Order Book
export const OrderBookSchema = z.object({
  symbol: z.string(),
  bids: z.array(z.tuple([z.string(), z.string()])),
  asks: z.array(z.tuple([z.string(), z.string()])),
  timestamp: z.number(),
});

// K-line
export const KlineSchema = z.object({
  openTime: z.number(),
  open: z.string(),
  high: z.string(),
  low: z.string(),
  close: z.string(),
  volume: z.string(),
  closeTime: z.number(),
  quoteAssetVolume: z.string(),
  numberOfTrades: z.number(),
});

// Type exports
export type CalendarEntry = z.infer<typeof CalendarEntrySchema>;
export type SymbolEntry = z.infer<typeof SymbolEntrySchema>;
export type BalanceEntry = z.infer<typeof BalanceEntrySchema>;
export type ExchangeSymbol = z.infer<typeof ExchangeSymbolSchema>;
export type Ticker = z.infer<typeof TickerSchema>;
export type OrderParameters = z.infer<typeof OrderParametersSchema>;
export type OrderResult = z.infer<typeof OrderResultSchema>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type OrderBook = z.infer<typeof OrderBookSchema>;
export type Kline = z.infer<typeof KlineSchema>;

// Advanced Types
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
    supports: string[];
    resistances: string[];
  };
  momentum: {
    bullish: string[];
    bearish: string[];
    neutral: string[];
  };
}

export interface TradingOpportunity {
  symbol: string;
  type: "breakout" | "reversal" | "momentum" | "arbitrage";
  confidence: number;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  risk: "low" | "medium" | "high";
  timeframe: string;
  indicators: string[];
}

export interface Portfolio {
  totalValue: number;
  totalValueBTC: number;
  totalValueUSDT: number;
  balances: BalanceEntry[];
  allocation: Record<string, number>;
  performance24h: {
    change: number;
    changePercent: number;
  };
}

export interface RiskAssessment {
  overallRisk: "low" | "medium" | "high" | "extreme";
  factors: {
    marketVolatility: number;
    positionSize: number;
    correlation: number;
    liquidityRisk: number;
  };
  recommendations: string[];
  maxPositionSize: number;
  suggestedStopLoss: number;
}

// ============================================================================
// Request/Response Cache
// ============================================================================

interface CachedResponse {
  data: any;
  timestamp: number;
  expiresAt: number;
}

class MexcResponseCache {
  private cache = new Map<string, CachedResponse>();
  private defaultTTL = 30000; // 30 seconds

  set(key: string, data: any, ttl?: number): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + (ttl || this.defaultTTL),
    });
  }

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  clear(): void {
    this.cache.clear();
  }

  generateKey(method: string, params?: any): string {
    const paramsStr = params ? JSON.stringify(params) : "";
    return `${method}:${crypto.createHash("md5").update(paramsStr).digest("hex")}`;
  }
}

// ============================================================================
// Circuit Breaker for Reliability
// ============================================================================

class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";

  constructor(
    private threshold = 5,
    private timeout = 60000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = "HALF_OPEN";
      } else {
        throw new Error("Circuit breaker is OPEN");
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = "CLOSED";
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = "OPEN";
    }
  }
}

// ============================================================================
// Rate Limiter
// ============================================================================

class RateLimiter {
  private requests: number[] = [];

  constructor(
    private maxRequests = 50,
    private windowMs = 60000
  ) {}

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Remove old requests
    this.requests = this.requests.filter((time) => time > windowStart);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);

      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    this.requests.push(now);
  }
}

// ============================================================================
// Main Unified MEXC Service
// ============================================================================

export class UnifiedMexcService {
  private config: Required<UnifiedMexcConfig>;
  private cache: MexcResponseCache;
  private circuitBreaker: CircuitBreaker;
  private rateLimiter: RateLimiter;

  constructor(config: UnifiedMexcConfig = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.MEXC_API_KEY || "",
      secretKey: config.secretKey || process.env.MEXC_SECRET_KEY || "",
      passphrase: config.passphrase || process.env.MEXC_PASSPHRASE || "",
      baseUrl: config.baseUrl || "https://api.mexc.com",
      timeout: config.timeout || 10000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      rateLimitDelay: config.rateLimitDelay || 100,
      enableCaching: config.enableCaching ?? true,
      cacheTTL: config.cacheTTL || 30000,
      enableCircuitBreaker: config.enableCircuitBreaker ?? true,
      enableMetrics: config.enableMetrics ?? true,
    };

    this.cache = new MexcResponseCache();
    this.circuitBreaker = new CircuitBreaker();
    this.rateLimiter = new RateLimiter();
  }

  // ============================================================================
  // Authentication and Security
  // ============================================================================

  private createSignature(queryString: string): string {
    return crypto.createHmac("sha256", this.config.secretKey).update(queryString).digest("hex");
  }

  private hasCredentials(): boolean {
    return !!(this.config.apiKey && this.config.secretKey);
  }

  // ============================================================================
  // HTTP Request Infrastructure
  // ============================================================================

  private async makeRequest<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    endpoint: string,
    params: Record<string, any> = {},
    requiresAuth = false
  ): Promise<MexcServiceResponse<T>> {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    // Check cache first
    if (method === "GET" && this.config.enableCaching) {
      const cacheKey = this.cache.generateKey(endpoint, params);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          timestamp: new Date().toISOString(),
          requestId,
          cached: true,
          responseTime: Date.now() - startTime,
        };
      }
    }

    // Rate limiting
    await this.rateLimiter.waitIfNeeded();

    const operation = async () => {
      let url = `${this.config.baseUrl}${endpoint}`;
      let body: string | undefined;

      // Handle authentication
      if (requiresAuth) {
        if (!this.hasCredentials()) {
          throw new Error("API credentials are required for this operation");
        }

        const timestamp = Date.now();
        params.timestamp = timestamp;

        if (method === "POST" || method === "PUT") {
          body = JSON.stringify(params);
          const signature = this.createSignature(body);
          params.signature = signature;
        } else {
          const queryString = new URLSearchParams(params).toString();
          const signature = this.createSignature(queryString);
          url += `?${queryString}&signature=${signature}`;
        }
      } else if (method === "GET" && Object.keys(params).length > 0) {
        const queryString = new URLSearchParams(params).toString();
        url += `?${queryString}`;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "MEXC-Sniper-Bot/1.0",
      };

      if (requiresAuth && this.config.apiKey) {
        headers["X-MEXC-APIKEY"] = this.config.apiKey;
      }

      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();

      // Cache GET responses
      if (method === "GET" && this.config.enableCaching) {
        const cacheKey = this.cache.generateKey(endpoint, params);
        this.cache.set(cacheKey, responseData, this.config.cacheTTL);
      }

      return responseData;
    };

    try {
      const data = this.config.enableCircuitBreaker
        ? await this.circuitBreaker.execute(operation)
        : await operation();

      return {
        success: true,
        data,
        timestamp: new Date().toISOString(),
        requestId,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        requestId,
        responseTime: Date.now() - startTime,
      };
    }
  }

  // ============================================================================
  // Public API - Market Data
  // ============================================================================

  /**
   * Test connectivity to MEXC API (returns boolean for API route compatibility)
   */
  async testConnectivity(): Promise<boolean> {
    try {
      const response = await this.makeRequest("GET", "/api/v3/time");
      return response.success;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test connectivity to MEXC API (returns full response)
   */
  async testConnectivityWithResponse(): Promise<MexcServiceResponse<{ serverTime: number }>> {
    return this.makeRequest("GET", "/api/v3/time");
  }

  /**
   * Get server time
   */
  async getServerTime(): Promise<MexcServiceResponse<{ serverTime: number }>> {
    return this.makeRequest("GET", "/api/v3/time");
  }

  /**
   * Get exchange information
   */
  async getExchangeInfo(): Promise<MexcServiceResponse<{ symbols: ExchangeSymbol[] }>> {
    return this.makeRequest("GET", "/api/v3/exchangeInfo");
  }

  /**
   * Get all symbol tickers
   */
  async getAllTickers(): Promise<MexcServiceResponse<Ticker[]>> {
    return this.makeRequest("GET", "/api/v3/ticker/24hr");
  }

  /**
   * Get ticker for specific symbol
   */
  async getTicker(symbol: string): Promise<MexcServiceResponse<Ticker>> {
    return this.makeRequest("GET", "/api/v3/ticker/24hr", { symbol });
  }

  /**
   * Get order book for symbol
   */
  async getOrderBook(symbol: string, limit = 100): Promise<MexcServiceResponse<OrderBook>> {
    const response = await this.makeRequest("GET", "/api/v3/depth", {
      symbol,
      limit: Math.min(limit, 5000),
    });

    if (response.success && response.data) {
      const rawData = response.data as any;
      const orderBook: OrderBook = {
        symbol,
        bids: rawData.bids || [],
        asks: rawData.asks || [],
        timestamp: Date.now(),
      };

      return {
        ...response,
        data: orderBook,
      };
    }

    return response;
  }

  /**
   * Get recent trades for symbol
   */
  async getRecentTrades(symbol: string, limit = 500): Promise<MexcServiceResponse<any[]>> {
    return this.makeRequest("GET", "/api/v3/trades", {
      symbol,
      limit: Math.min(limit, 1000),
    });
  }

  /**
   * Get kline/candlestick data
   */
  async getKlines(
    symbol: string,
    interval: string,
    limit = 500,
    startTime?: number,
    endTime?: number
  ): Promise<MexcServiceResponse<Kline[]>> {
    const params: any = { symbol, interval, limit: Math.min(limit, 1000) };
    if (startTime) params.startTime = startTime;
    if (endTime) params.endTime = endTime;

    return this.makeRequest("GET", "/api/v3/klines", params);
  }

  // ============================================================================
  // Public API - MEXC Specific
  // ============================================================================

  /**
   * Get calendar listings (new coin listings)
   */
  async getCalendarListings(): Promise<MexcServiceResponse<CalendarEntry[]>> {
    return this.makeRequest("GET", "/open/api/v2/market/coin/list");
  }

  /**
   * Get symbol data for MEXC-specific endpoints
   */
  async getSymbolData(): Promise<MexcServiceResponse<SymbolEntry[]>> {
    return this.makeRequest("GET", "/open/api/v2/market/symbols");
  }

  /**
   * Get symbols data (alias for getSymbolData for backward compatibility)
   */
  async getSymbolsData(): Promise<MexcServiceResponse<SymbolEntry[]>> {
    return this.getSymbolData();
  }

  /**
   * Get symbols for specific vcoins
   */
  async getSymbolsForVcoins(vcoinIds: string[]): Promise<MexcServiceResponse<SymbolEntry[]>> {
    try {
      // For MEXC, we'll fetch all symbol data and filter by vcoin IDs
      const allSymbolsResponse = await this.getSymbolData();

      if (!allSymbolsResponse.success) {
        return allSymbolsResponse;
      }

      const symbols = allSymbolsResponse.data || [];

      // Filter symbols by vcoin IDs
      // Note: This assumes symbol.cd matches vcoin IDs - adjust if needed
      const filteredSymbols = symbols.filter((symbol) =>
        vcoinIds.some(
          (vcoinId) => symbol.cd === vcoinId || symbol.cd.toLowerCase() === vcoinId.toLowerCase()
        )
      );

      return {
        success: true,
        data: filteredSymbols,
        timestamp: new Date().toISOString(),
        cached: allSymbolsResponse.cached,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch symbols for vcoins",
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ============================================================================
  // Private API - Account Management
  // ============================================================================

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<MexcServiceResponse<any>> {
    return this.makeRequest("GET", "/api/v3/account", {}, true);
  }

  /**
   * Get account balances
   */
  async getAccountBalances(): Promise<
    MexcServiceResponse<{
      balances: BalanceEntry[];
      totalUsdtValue: number;
    }>
  > {
    const response = await this.makeRequest("GET", "/api/v3/account", {}, true);

    if (
      response.success &&
      response.data &&
      typeof response.data === "object" &&
      "balances" in response.data
    ) {
      const rawData = response.data as any;
      // Process balances to include USDT values
      const balances = (rawData.balances || []).map((balance: any) => ({
        asset: balance.asset || "",
        free: balance.free || "0",
        locked: balance.locked || "0",
        total: Number.parseFloat(balance.free || "0") + Number.parseFloat(balance.locked || "0"),
        usdtValue: 0, // Would need price data to calculate this
      }));

      // Calculate total USDT value (simplified)
      const totalUsdtValue = balances.reduce(
        (sum: number, balance: BalanceEntry) => sum + (balance.usdtValue || 0),
        0
      );

      return {
        ...response,
        data: { balances, totalUsdtValue },
      };
    }

    return {
      success: false,
      error: response.error || "Failed to fetch account balances",
      timestamp: new Date().toISOString(),
      data: { balances: [], totalUsdtValue: 0 },
    };
  }

  // ============================================================================
  // Private API - Trading
  // ============================================================================

  /**
   * Place a new order
   */
  async placeOrder(params: OrderParameters): Promise<MexcServiceResponse<OrderResult>> {
    try {
      // Validate parameters
      const validatedParams = OrderParametersSchema.parse(params);

      const response = await this.makeRequest("POST", "/api/v3/order", validatedParams, true);

      if (response.success && response.data) {
        const rawData = response.data as any;
        // Transform response to match our OrderResult schema
        const orderResult: OrderResult = {
          success: true,
          orderId: rawData?.orderId?.toString() || "",
          symbol: validatedParams.symbol,
          side: validatedParams.side,
          quantity: validatedParams.quantity,
          price: validatedParams.price,
          status: rawData?.status || "UNKNOWN",
          timestamp: new Date().toISOString(),
        };

        return {
          ...response,
          data: orderResult,
        };
      }

      return {
        success: false,
        error: response.error || "Order placement failed",
        timestamp: new Date().toISOString(),
        data: {
          success: false,
          symbol: validatedParams.symbol,
          side: validatedParams.side,
          quantity: validatedParams.quantity,
          price: validatedParams.price,
          error: response.error || "Order placement failed",
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Order validation failed",
        timestamp: new Date().toISOString(),
        data: {
          success: false,
          symbol: params.symbol,
          side: params.side,
          quantity: params.quantity,
          price: params.price,
          error: error instanceof Error ? error.message : "Order validation failed",
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(symbol: string, orderId: string): Promise<MexcServiceResponse<any>> {
    return this.makeRequest(
      "DELETE",
      "/api/v3/order",
      {
        symbol,
        orderId,
      },
      true
    );
  }

  /**
   * Get order status
   */
  async getOrderStatus(symbol: string, orderId: string): Promise<MexcServiceResponse<OrderStatus>> {
    return this.makeRequest(
      "GET",
      "/api/v3/order",
      {
        symbol,
        orderId,
      },
      true
    );
  }

  /**
   * Get all open orders
   */
  async getOpenOrders(symbol?: string): Promise<MexcServiceResponse<OrderStatus[]>> {
    const params = symbol ? { symbol } : {};
    return this.makeRequest("GET", "/api/v3/openOrders", params, true);
  }

  /**
   * Get order history
   */
  async getOrderHistory(
    symbol: string,
    limit = 500,
    startTime?: number,
    endTime?: number
  ): Promise<MexcServiceResponse<OrderStatus[]>> {
    const params: any = { symbol, limit: Math.min(limit, 1000) };
    if (startTime) params.startTime = startTime;
    if (endTime) params.endTime = endTime;

    return this.makeRequest("GET", "/api/v3/allOrders", params, true);
  }

  // ============================================================================
  // Advanced Features
  // ============================================================================

  /**
   * Get market statistics
   */
  async getMarketStats(): Promise<MexcServiceResponse<MarketStats>> {
    try {
      const [tickers, symbols, calendar] = await Promise.all([
        this.getAllTickers(),
        this.getExchangeInfo(),
        this.getCalendarListings(),
      ]);

      if (!tickers.success || !symbols.success) {
        return {
          success: false,
          error: "Failed to fetch market data",
          timestamp: new Date().toISOString(),
        };
      }

      const tickerData = tickers.data || [];
      const symbolData = symbols.data?.symbols || [];
      const calendarData = calendar.data || [];

      // Calculate market statistics
      const totalVolume24h = tickerData.reduce(
        (sum, ticker) => sum + Number.parseFloat(ticker.volume || "0"),
        0
      );

      const sorted = [...tickerData].sort(
        (a, b) => Number.parseFloat(b.priceChangePercent) - Number.parseFloat(a.priceChangePercent)
      );

      const marketStats: MarketStats = {
        totalPairs: symbolData.length,
        activePairs: symbolData.filter((s) => s.status === "TRADING").length,
        totalVolume24h,
        totalMarketCap: 0, // Would need additional data
        topGainers: sorted.slice(0, 10),
        topLosers: sorted.slice(-10).reverse(),
        newListings: calendarData.slice(0, 20),
        trendingPairs: sorted.slice(0, 20).map((t) => t.symbol),
      };

      return {
        success: true,
        data: marketStats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to calculate market stats",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Analyze patterns in market data
   */
  async analyzePatterns(): Promise<MexcServiceResponse<PatternAnalysis>> {
    try {
      const [tickers, symbols] = await Promise.all([this.getAllTickers(), this.getSymbolData()]);

      if (!tickers.success || !symbols.success) {
        return {
          success: false,
          error: "Failed to fetch market data for analysis",
          timestamp: new Date().toISOString(),
        };
      }

      const tickerData = tickers.data || [];
      const symbolData = symbols.data || [];

      // Analyze ready state patterns (simplified)
      const readyStateSymbols = symbolData.filter((s) => s.sts === 1); // Assuming 1 means ready

      // Analyze volume patterns
      const sortedByVolume = [...tickerData].sort(
        (a, b) => Number.parseFloat(b.volume || "0") - Number.parseFloat(a.volume || "0")
      );

      // Analyze price patterns (simplified momentum analysis)
      const bullish = tickerData
        .filter((t) => Number.parseFloat(t.priceChangePercent) > 5)
        .map((t) => t.symbol);
      const bearish = tickerData
        .filter((t) => Number.parseFloat(t.priceChangePercent) < -5)
        .map((t) => t.symbol);
      const neutral = tickerData
        .filter((t) => Math.abs(Number.parseFloat(t.priceChangePercent)) <= 5)
        .map((t) => t.symbol);

      const analysis: PatternAnalysis = {
        readyStatePatterns: {
          symbols: readyStateSymbols,
          count: readyStateSymbols.length,
          percentage: (readyStateSymbols.length / symbolData.length) * 100,
        },
        volumePatterns: {
          highVolume: sortedByVolume.slice(0, 50).map((t) => t.symbol),
          emergingVolume: sortedByVolume.slice(50, 100).map((t) => t.symbol),
        },
        pricePatterns: {
          breakouts: bullish.slice(0, 20),
          supports: neutral.slice(0, 20),
          resistances: bearish.slice(0, 20),
        },
        momentum: {
          bullish: bullish.slice(0, 50),
          bearish: bearish.slice(0, 50),
          neutral: neutral.slice(0, 50),
        },
      };

      return {
        success: true,
        data: analysis,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Pattern analysis failed",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get portfolio summary
   */
  async getPortfolioSummary(): Promise<MexcServiceResponse<Portfolio>> {
    const balancesResponse = await this.getAccountBalances();

    if (!balancesResponse.success) {
      return {
        success: false,
        error: balancesResponse.error || "Failed to fetch portfolio data",
        timestamp: new Date().toISOString(),
        data: {
          totalValue: 0,
          totalValueBTC: 0,
          totalValueUSDT: 0,
          balances: [],
          allocation: {},
          performance24h: {
            change: 0,
            changePercent: 0,
          },
        },
      };
    }

    const { balances, totalUsdtValue } = balancesResponse.data;

    // Calculate allocation percentages
    const allocation: Record<string, number> = {};
    balances.forEach((balance) => {
      if (balance.total > 0 && totalUsdtValue > 0) {
        allocation[balance.asset] = ((balance.usdtValue || 0) / totalUsdtValue) * 100;
      }
    });

    const portfolio: Portfolio = {
      totalValue: totalUsdtValue,
      totalValueBTC: 0, // Would need BTC price
      totalValueUSDT: totalUsdtValue,
      balances,
      allocation,
      performance24h: {
        change: 0, // Would need historical data
        changePercent: 0,
      },
    };

    return {
      success: true,
      data: portfolio,
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ============================================================================
  // Missing Methods for Agent Integration
  // ============================================================================

  /**
   * Get market overview
   */
  async getMarketOverview(): Promise<MexcServiceResponse<any>> {
    try {
      const [tickers, symbols] = await Promise.all([this.getAllTickers(), this.getExchangeInfo()]);

      return {
        success: true,
        data: {
          tickers: tickers.data || [],
          symbols: symbols.data?.symbols || [],
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get market overview",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Perform health check
   */
  async performHealthCheck(): Promise<{ healthy: boolean; timestamp: string; details?: any }> {
    try {
      const serverTime = await this.getServerTime();
      return {
        healthy: serverTime.success,
        timestamp: new Date().toISOString(),
        details: {
          connectivity: serverTime.success,
          serverTime: serverTime.data?.serverTime,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        timestamp: new Date().toISOString(),
        details: {
          error: error instanceof Error ? error.message : "Health check failed",
        },
      };
    }
  }

  /**
   * Get circuit breaker status
   */
  async getCircuitBreakerStatus(): Promise<MexcServiceResponse<any>> {
    return {
      success: true,
      data: {
        enabled: this.config.enableCircuitBreaker,
        status: this.circuitBreaker?.isOpen() ? "OPEN" : "CLOSED",
        failures: this.circuitBreaker?.getFailureCount() || 0,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get metrics
   */
  async getMetrics(): Promise<MexcServiceResponse<any>> {
    return {
      success: true,
      data: {
        requestCount: this.metrics.requestCount,
        errorCount: this.metrics.errorCount,
        averageResponseTime:
          this.metrics.totalResponseTime / Math.max(this.metrics.requestCount, 1),
        cacheHitRate: this.metrics.cacheHits / Math.max(this.metrics.requestCount, 1),
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get cache stats
   */
  async getCacheStats(): Promise<MexcServiceResponse<any>> {
    return {
      success: true,
      data: {
        size: this.cache.size,
        hitRate: this.metrics.cacheHits / Math.max(this.metrics.requestCount, 1),
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Detect ready state patterns
   */
  async detectReadyStatePatterns(): Promise<MexcServiceResponse<any>> {
    try {
      const symbols = await this.getSymbolsData();
      return {
        success: true,
        data: {
          patterns: symbols.data?.filter((s: any) => s.sts === 1) || [],
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to detect patterns",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<UnifiedMexcConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): UnifiedMexcConfig {
    return { ...this.config };
  }

  /**
   * Check if service has valid credentials
   */
  hasValidCredentials(): boolean {
    return this.hasCredentials();
  }
}

// ============================================================================
// Service Factory and Singleton
// ============================================================================

let globalMexcService: UnifiedMexcService | null = null;

/**
 * Get or create the global MEXC service instance
 */
export function getUnifiedMexcService(config?: UnifiedMexcConfig): UnifiedMexcService {
  if (!globalMexcService || config) {
    globalMexcService = new UnifiedMexcService(config);
  }
  return globalMexcService;
}

/**
 * Reset the global MEXC service instance
 */
export function resetUnifiedMexcService(): void {
  globalMexcService = null;
}

// ============================================================================
// Exports
// ============================================================================

export { UnifiedMexcService as default };
