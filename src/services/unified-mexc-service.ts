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
import {
  type EnhancedUnifiedCacheSystem,
  getEnhancedUnifiedCache,
} from "../lib/enhanced-unified-cache";
import {
  type PerformanceMonitoringService,
  getPerformanceMonitoringService,
} from "../lib/performance-monitoring-service";
import type { ActivityData, ActivityQueryOptions, ActivityResponse } from "../schemas/mexc-schemas";

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
  // Phase 2: Enhanced caching configuration
  enableEnhancedCaching?: boolean;
  enablePerformanceMonitoring?: boolean;
  apiResponseTTL?: number; // 5 seconds as per user preference
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
  metadata?: any;
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
  symbol: z.string().optional(), // Add symbol property for compatibility
  sts: z.number(),
  st: z.number(),
  tt: z.number(),
  ca: z.number().optional(),
  ps: z.number().optional(),
  qs: z.number().optional(),
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
// Metrics and Monitoring
// ============================================================================

interface ServiceMetrics {
  requestCount: number;
  errorCount: number;
  totalResponseTime: number;
  cacheHits: number;
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

  get size(): number {
    return this.cache.size;
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

  isOpen(): boolean {
    return this.state === "OPEN";
  }

  getFailureCount(): number {
    return this.failures;
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
  private metrics: ServiceMetrics;
  // Phase 2: Enhanced caching integration
  private enhancedCache: EnhancedUnifiedCacheSystem;
  private performanceMonitoring: PerformanceMonitoringService;

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
      // Phase 2: Enhanced caching defaults
      enableEnhancedCaching: config.enableEnhancedCaching ?? true,
      enablePerformanceMonitoring: config.enablePerformanceMonitoring ?? true,
      apiResponseTTL: config.apiResponseTTL || 5000, // 5 seconds as per user preference
    };

    this.cache = new MexcResponseCache();
    this.circuitBreaker = new CircuitBreaker();
    this.rateLimiter = new RateLimiter();
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      totalResponseTime: 0,
      cacheHits: 0,
    };

    // Phase 2: Initialize enhanced caching and performance monitoring
    if (this.config.enableEnhancedCaching) {
      this.enhancedCache = getEnhancedUnifiedCache({
        apiResponseTTL: this.config.apiResponseTTL,
        enableIntelligentRouting: true,
        enableBatchOperations: true,
        enablePerformanceMonitoring: this.config.enablePerformanceMonitoring,
      });
    }

    if (this.config.enablePerformanceMonitoring) {
      this.performanceMonitoring = getPerformanceMonitoringService({
        enableRealTimeMonitoring: true,
        metricsCollectionInterval: 30000,
        enableAlerts: true,
        enableRecommendations: true,
      });
    }
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

    // Phase 2: Enhanced caching check first
    if (method === "GET" && this.config.enableEnhancedCaching && this.enhancedCache) {
      const cacheKey = this.cache.generateKey(endpoint, params);
      const cached = await this.enhancedCache.get<T>(cacheKey, "api_response");
      if (cached) {
        this.metrics.cacheHits++;

        // Track API request for performance monitoring
        if (this.config.enablePerformanceMonitoring && this.performanceMonitoring) {
          this.performanceMonitoring.trackApiRequest(Date.now() - startTime, true);
        }

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

    // Fallback to legacy cache
    if (method === "GET" && this.config.enableCaching && !this.config.enableEnhancedCaching) {
      const cacheKey = this.cache.generateKey(endpoint, params);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.metrics.cacheHits++;
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

      // Phase 2: Enhanced caching for GET responses
      if (method === "GET" && this.config.enableEnhancedCaching && this.enhancedCache) {
        const cacheKey = this.cache.generateKey(endpoint, params);
        await this.enhancedCache.set(
          cacheKey,
          responseData,
          "api_response",
          this.config.apiResponseTTL
        );
      }

      // Fallback to legacy cache
      if (method === "GET" && this.config.enableCaching && !this.config.enableEnhancedCaching) {
        const cacheKey = this.cache.generateKey(endpoint, params);
        this.cache.set(cacheKey, responseData, this.config.cacheTTL);
      }

      return responseData;
    };

    try {
      const data = this.config.enableCircuitBreaker
        ? await this.circuitBreaker.execute(operation)
        : await operation();

      const responseTime = Date.now() - startTime;
      this.metrics.requestCount++;
      this.metrics.totalResponseTime += responseTime;

      // Track API request for performance monitoring
      if (this.config.enablePerformanceMonitoring && this.performanceMonitoring) {
        this.performanceMonitoring.trackApiRequest(responseTime, true);
      }

      return {
        success: true,
        data,
        timestamp: new Date().toISOString(),
        requestId,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.metrics.requestCount++;
      this.metrics.errorCount++;
      this.metrics.totalResponseTime += responseTime;

      // Track failed API request for performance monitoring
      if (this.config.enablePerformanceMonitoring && this.performanceMonitoring) {
        this.performanceMonitoring.trackApiRequest(responseTime, false);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        requestId,
        responseTime,
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
    const startTime = Date.now();
    const requestId = crypto.randomUUID();

    try {
      console.log("[UnifiedMexcService] Fetching calendar listings from MEXC...");

      // Special handling for MEXC calendar endpoint which uses different base URL
      const timestamp = Date.now();
      const url = `https://www.mexc.com/api/operation/new_coin_calendar?timestamp=${timestamp}`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "MEXC-Sniper-Bot/1.0",
      };

      const response = await fetch(url, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();

      // Debug: Log the first few entries to understand the structure
      if (
        responseData?.data?.newCoins &&
        Array.isArray(responseData.data.newCoins) &&
        responseData.data.newCoins.length > 0
      ) {
        console.log(
          "[UnifiedMexcService] Sample calendar entries structure:",
          JSON.stringify(responseData.data.newCoins.slice(0, 2), null, 2)
        );
      }

      // Parse and validate the response structure
      let calendarData: CalendarEntry[] = [];

      // Handle the actual MEXC API response structure: data.newCoins
      if (responseData?.data?.newCoins && Array.isArray(responseData.data.newCoins)) {
        calendarData = responseData.data.newCoins
          .map((coin: any) => {
            try {
              // Extract meaningful fields from the API response
              const vcoinId = coin.vcoinId || coin.id || "";
              // Use actual vcoinName from API, fallback to vcoinId if not available
              const symbol = coin.vcoinName || coin.symbol || vcoinId;
              // Use vcoinNameFull for full project name, fallback to vcoinName or other fields
              const projectName =
                coin.vcoinNameFull ||
                coin.vcoinName ||
                coin.projectName ||
                coin.project_name ||
                coin.name ||
                coin.desc ||
                symbol;
              const firstOpenTime =
                coin.firstOpenTime ||
                coin.first_open_time ||
                coin.listingTime ||
                coin.listing_time ||
                Date.now();

              return CalendarEntrySchema.parse({
                vcoinId,
                symbol,
                projectName,
                firstOpenTime:
                  typeof firstOpenTime === "string"
                    ? new Date(firstOpenTime).getTime()
                    : firstOpenTime,
                // Include additional fields from API
                vcoinName: coin.vcoinName,
                vcoinNameFull: coin.vcoinNameFull,
                zone: coin.zone,
                introductionEn: coin.introductionEn,
                introductionCn: coin.introductionCn,
              });
            } catch (error) {
              console.warn("[UnifiedMexcService] Invalid calendar entry:", coin, error);
              return null;
            }
          })
          .filter((entry: CalendarEntry | null): entry is CalendarEntry => entry !== null);
      }

      const executionTimeMs = Date.now() - startTime;
      console.log(
        `[UnifiedMexcService] Calendar listings fetched: ${calendarData.length} entries (${executionTimeMs}ms)`
      );

      // Update metrics
      this.metrics.requestCount++;
      this.metrics.totalResponseTime += executionTimeMs;

      return {
        success: true,
        data: calendarData,
        timestamp: new Date().toISOString(),
        requestId,
        executionTimeMs,
        cached: false,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      console.error("[UnifiedMexcService] Calendar API call failed:", error);

      this.metrics.errorCount++;
      this.metrics.totalResponseTime += executionTimeMs;

      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : "Failed to fetch calendar listings",
        timestamp: new Date().toISOString(),
        requestId,
        executionTimeMs,
      };
    }
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
   * Get symbol information for a specific symbol
   */
  async getSymbolInfo(symbolName: string): Promise<MexcServiceResponse<SymbolEntry | null>> {
    try {
      const symbolsResponse = await this.getSymbolData();
      if (!symbolsResponse.success || !symbolsResponse.data) {
        return {
          success: false,
          error: "Failed to fetch symbols data",
          timestamp: new Date().toISOString(),
        };
      }

      const symbol = symbolsResponse.data.find(
        (s) => s.symbol === symbolName || s.cd === symbolName
      );
      return {
        success: true,
        data: symbol || null,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get symbol info",
        timestamp: new Date().toISOString(),
      };
    }
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

  /**
   * Get activity data for a single currency
   * MEXC Activity API endpoint: /api/operateactivity/activity/list/by/currencies
   */
  async getActivityData(currency: string): Promise<MexcServiceResponse<ActivityData[]>> {
    const startTime = Date.now();

    try {
      const endpoint = "/api/operateactivity/activity/list/by/currencies";
      const params = { currencies: currency };

      const response = await this.makeRequest<ActivityResponse>(
        "GET",
        endpoint,
        params,
        false // Public endpoint, no authentication required
      );

      if (response.success && response.data?.code === 0) {
        return {
          success: true,
          data: response.data.data || [],
          timestamp: new Date().toISOString(),
          cached: response.cached,
          executionTimeMs: Date.now() - startTime,
        };
      }

      return {
        success: false,
        error: response.data?.msg || "Failed to fetch activity data",
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: `Activity API error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Get activity data for multiple currencies in batches
   * Phase 1 Enhancement: Implements rate limiting and error handling for bulk operations
   */
  async getBulkActivityData(
    currencies: string[],
    options: ActivityQueryOptions = {}
  ): Promise<MexcServiceResponse<Map<string, ActivityData[]>>> {
    const startTime = Date.now();
    const { batchSize = 5, maxRetries = 3, rateLimitDelay = 200 } = options;
    const results = new Map<string, ActivityData[]>();
    let totalErrors = 0;

    try {
      // Process currencies in batches to respect rate limits
      for (let i = 0; i < currencies.length; i += batchSize) {
        const batch = currencies.slice(i, i + batchSize);
        const batchPromises = batch.map(async (currency) => {
          let retryCount = 0;

          while (retryCount < maxRetries) {
            try {
              const result = await this.getActivityData(currency);
              return { currency, result };
            } catch (error) {
              retryCount++;
              if (retryCount >= maxRetries) {
                console.warn(
                  `[UnifiedMexcService] Failed to fetch activity data for ${currency} after ${maxRetries} retries:`,
                  error
                );
                return {
                  currency,
                  result: {
                    success: false,
                    error: `Max retries exceeded: ${error}`,
                    timestamp: new Date().toISOString(),
                  },
                };
              }
              // Exponential backoff for retries
              await new Promise((resolve) => setTimeout(resolve, rateLimitDelay * retryCount));
            }
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);

        // Process batch results
        for (const promiseResult of batchResults) {
          if (promiseResult.status === "fulfilled" && promiseResult.value) {
            const { currency, result } = promiseResult.value;
            if (result.success && result.data) {
              // Only add to results if there are actual activities
              if (result.data.length > 0) {
                results.set(currency, result.data);
              }
            } else {
              totalErrors++;
            }
          } else {
            totalErrors++;
          }
        }

        // Rate limiting delay between batches
        if (i + batchSize < currencies.length) {
          await new Promise((resolve) => setTimeout(resolve, rateLimitDelay));
        }
      }

      return {
        success: true,
        data: results,
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
        metadata: {
          totalCurrencies: currencies.length,
          successfulFetches: results.size,
          errors: totalErrors,
          batchSize,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Bulk activity API error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
        data: results, // Return partial results
      };
    }
  }

  /**
   * Check if a currency has recent promotional activities
   * Phase 1 Enhancement: Utility method for quick activity status checking
   */
  async hasRecentActivity(currency: string, hoursBack = 24): Promise<MexcServiceResponse<boolean>> {
    try {
      const activityResult = await this.getActivityData(currency);

      if (!activityResult.success) {
        return {
          success: false,
          error: activityResult.error,
          timestamp: new Date().toISOString(),
          data: false,
        };
      }

      const hasActivity = activityResult.data && activityResult.data.length > 0;

      return {
        success: true,
        data: hasActivity,
        timestamp: new Date().toISOString(),
        metadata: {
          activityCount: activityResult.data?.length || 0,
          activities: activityResult.data || [],
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Recent activity check error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date().toISOString(),
        data: false,
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
   * Get metrics (async version for agent compatibility)
   */
  async getMetricsAsync(): Promise<MexcServiceResponse<any>> {
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

  // ============================================================================
  // Missing Trading Methods for Test Compatibility
  // ============================================================================

  /**
   * Get symbol status (trading state)
   */
  async getSymbolStatus(
    symbol: string
  ): Promise<MexcServiceResponse<{ status: string; timestamp: number }>> {
    try {
      const exchangeInfo = await this.getExchangeInfo();
      if (!exchangeInfo.success || !exchangeInfo.data?.symbols) {
        return {
          success: false,
          error: "Failed to fetch exchange info",
          timestamp: new Date().toISOString(),
        };
      }

      const symbolInfo = exchangeInfo.data.symbols.find((s) => s.symbol === symbol);
      return {
        success: true,
        data: {
          status: symbolInfo?.status || "UNKNOWN",
          timestamp: Date.now(),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get symbol status",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get order book depth (enhanced version of getOrderBook)
   */
  async getOrderBookDepth(
    symbol: string,
    limit = 100
  ): Promise<MexcServiceResponse<{ bids: number[][]; asks: number[][] }>> {
    try {
      const orderBook = await this.getOrderBook(symbol, limit);
      if (!orderBook.success || !orderBook.data) {
        return {
          success: false,
          error: orderBook.error || "Failed to fetch order book",
          timestamp: new Date().toISOString(),
        };
      }

      // Convert string arrays to number arrays for enhanced depth analysis
      const bids = orderBook.data.bids.map(([price, quantity]) => [
        Number.parseFloat(price),
        Number.parseFloat(quantity),
      ]);
      const asks = orderBook.data.asks.map(([price, quantity]) => [
        Number.parseFloat(price),
        Number.parseFloat(quantity),
      ]);

      return {
        success: true,
        data: { bids, asks },
        timestamp: new Date().toISOString(),
        cached: orderBook.cached,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get order book depth",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get 24hr ticker statistics
   */
  async get24hrTicker(symbol: string): Promise<
    MexcServiceResponse<{
      symbol: string;
      volume: string;
      count: number;
      high: string;
      low: string;
      lastPrice: string;
    }>
  > {
    try {
      const ticker = await this.getTicker(symbol);
      if (!ticker.success || !ticker.data) {
        return {
          success: false,
          error: ticker.error || "Failed to fetch ticker",
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: {
          symbol: ticker.data.symbol,
          volume: ticker.data.volume,
          count: Number.parseInt(ticker.data.count || "0"),
          high: ticker.data.highPrice || "0",
          low: ticker.data.lowPrice || "0",
          lastPrice: ticker.data.lastPrice,
        },
        timestamp: new Date().toISOString(),
        cached: ticker.cached,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get 24hr ticker",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Detect price gaps in market data
   */
  async detectPriceGap(
    symbol: string,
    options: {
      threshold?: number;
      lookbackMinutes?: number;
    } = {}
  ): Promise<
    MexcServiceResponse<{
      hasGap: boolean;
      gapPercentage: number;
      previousPrice: number;
      currentPrice: number;
      gapType: string;
    }>
  > {
    try {
      const { threshold = 2.0, lookbackMinutes = 5 } = options;

      // Get recent klines to analyze price movement
      const klines = await this.getKlines(symbol, "1m", 10);
      if (!klines.success || !klines.data || klines.data.length < 2) {
        return {
          success: false,
          error: "Insufficient price data for gap detection",
          timestamp: new Date().toISOString(),
        };
      }

      const recentKlines = klines.data.slice(-2);
      const previousPrice = Number.parseFloat(recentKlines[0].close);
      const currentPrice = Number.parseFloat(recentKlines[1].close);

      const gapPercentage = Math.abs((currentPrice - previousPrice) / previousPrice) * 100;
      const hasGap = gapPercentage >= threshold;

      let gapType = "none";
      if (hasGap) {
        gapType = currentPrice > previousPrice ? "gap_up" : "gap_down";
      }

      return {
        success: true,
        data: {
          hasGap,
          gapPercentage,
          previousPrice,
          currentPrice,
          gapType,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to detect price gap",
        timestamp: new Date().toISOString(),
      };
    }
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

  /**
   * Get service metrics
   */
  getMetrics(): ServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Phase 2: Get enhanced performance metrics
   */
  getEnhancedMetrics(): {
    legacy: ServiceMetrics;
    cache?: any;
    performance?: any;
  } {
    const result: any = {
      legacy: this.getMetrics(),
    };

    if (this.config.enableEnhancedCaching && this.enhancedCache) {
      result.cache = this.enhancedCache.getPerformanceMetrics();
    }

    if (this.config.enablePerformanceMonitoring && this.performanceMonitoring) {
      result.performance = this.performanceMonitoring.getCurrentMetrics();
    }

    return result;
  }

  /**
   * Phase 2: Get detailed status including cache and performance information
   */
  async getDetailedStatus(): Promise<{
    service: {
      hasCredentials: boolean;
      enabledFeatures: string[];
      metrics: ServiceMetrics;
    };
    cache?: any;
    performance?: any;
  }> {
    const result: any = {
      service: {
        hasCredentials: this.hasCredentials(),
        enabledFeatures: [
          ...(this.config.enableCaching ? ["legacy-caching"] : []),
          ...(this.config.enableEnhancedCaching ? ["enhanced-caching"] : []),
          ...(this.config.enablePerformanceMonitoring ? ["performance-monitoring"] : []),
          ...(this.config.enableCircuitBreaker ? ["circuit-breaker"] : []),
          ...(this.config.enableMetrics ? ["metrics"] : []),
        ],
        metrics: this.getMetrics(),
      },
    };

    if (this.config.enableEnhancedCaching && this.enhancedCache) {
      result.cache = await this.enhancedCache.getDetailedStatus();
    }

    if (this.config.enablePerformanceMonitoring && this.performanceMonitoring) {
      result.performance = this.performanceMonitoring.getDashboardData();
    }

    return result;
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
