/**
 * Exchange Info Service Module
 *
 * Modular service for handling MEXC exchange information with type safety,
 * Zod validation, caching, and error handling.
 *
 * Key Features:
 * - Type-safe with Zod schema validation
 * - Efficient caching with TTL
 * - Circuit breaker pattern for reliability
 * - Performance monitoring
 * - Under 500 lines as per requirements
 */

import { z } from "zod";
import { toSafeError } from "../../lib/error-type-utils";
import { instrumentServiceMethod } from "../../lib/opentelemetry-service-instrumentation";

// ============================================================================
// Zod Schemas for Type Safety
// ============================================================================

export const TradingFilterSchema = z.object({
  filterType: z.enum([
    "PRICE_FILTER",
    "LOT_SIZE",
    "MIN_NOTIONAL",
    "ICEBERG_PARTS",
    "MAX_NUM_ORDERS",
  ]),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  tickSize: z.string().optional(),
  minQty: z.string().optional(),
  maxQty: z.string().optional(),
  stepSize: z.string().optional(),
  minNotional: z.string().optional(),
  limit: z.number().int().positive().optional(),
});

export const ExchangeSymbolSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  status: z.enum(["TRADING", "HALT", "BREAK", "AUCTION_MATCH"]),
  baseAsset: z.string().min(1, "Base asset is required"),
  baseAssetPrecision: z.number().int().nonnegative(),
  quoteAsset: z.string().min(1, "Quote asset is required"),
  quotePrecision: z.number().int().nonnegative(),
  quoteAssetPrecision: z.number().int().nonnegative(),
  orderTypes: z.array(
    z.enum(["LIMIT", "LIMIT_MAKER", "MARKET", "STOP_LOSS_LIMIT", "TAKE_PROFIT_LIMIT"])
  ),
  icebergAllowed: z.boolean().optional(),
  ocoAllowed: z.boolean().optional(),
  isSpotTradingAllowed: z.boolean().optional(),
  isMarginTradingAllowed: z.boolean().optional(),
  filters: z.array(TradingFilterSchema).optional(),
  permissions: z.array(z.string()).optional(),
});

export const ExchangeInfoSchema = z.object({
  timezone: z.string(),
  serverTime: z.number().int().positive(),
  rateLimits: z
    .array(
      z.object({
        rateLimitType: z.string(),
        interval: z.string(),
        intervalNum: z.number().int().positive(),
        limit: z.number().int().positive(),
      })
    )
    .optional(),
  symbols: z.array(ExchangeSymbolSchema),
});

export const ExchangeInfoResponseSchema = z.object({
  success: z.boolean(),
  data: ExchangeInfoSchema,
  error: z.string().optional(),
  timestamp: z.number().optional(),
  cached: z.boolean().optional(),
});

export const SymbolFilterSchema = z.object({
  symbol: z.string().optional(),
  baseAsset: z.string().optional(),
  quoteAsset: z.string().optional(),
  status: z.enum(["TRADING", "HALT", "BREAK", "AUCTION_MATCH"]).optional(),
  permissions: z.array(z.string()).optional(),
  isSpotTradingAllowed: z.boolean().optional(),
  isMarginTradingAllowed: z.boolean().optional(),
});

// ============================================================================
// Types
// ============================================================================

export type TradingFilter = z.infer<typeof TradingFilterSchema>;
export type ExchangeSymbol = z.infer<typeof ExchangeSymbolSchema>;
export type ExchangeInfo = z.infer<typeof ExchangeInfoSchema>;
export type ExchangeInfoResponse = z.infer<typeof ExchangeInfoResponseSchema>;
export type SymbolFilter = z.infer<typeof SymbolFilterSchema>;

export interface ExchangeInfoConfig {
  apiClient: {
    get: (endpoint: string, params?: Record<string, any>) => Promise<any>;
  };
  cache?: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any, ttl?: number) => Promise<void>;
  };
  circuitBreaker?: {
    execute: <T>(fn: () => Promise<T>) => Promise<T>;
  };
  performanceMonitor?: {
    recordMetric: (name: string, value: number, tags?: Record<string, string>) => void;
  };
  cacheTTL?: number;
}

// ============================================================================
// Service Class
// ============================================================================

export class ExchangeInfoService {
  private readonly config: ExchangeInfoConfig;
  private readonly cacheTTL: number;
  private readonly cacheKeyPrefix = "mexc:exchange-info";

  constructor(config: ExchangeInfoConfig) {
    this.config = config;
    this.cacheTTL = config.cacheTTL ?? 60000; // 60 seconds default (exchange info changes rarely)
  }

  /**
   * Get complete exchange information
   */
  @instrumentServiceMethod("exchange-info", "getExchangeInfo")
  async getExchangeInfo(): Promise<ExchangeInfoResponse> {
    const startTime = Date.now();

    try {
      const cacheKey = `${this.cacheKeyPrefix}:full`;

      // Try cache first
      if (this.config.cache) {
        const cached = await this.getCachedData(cacheKey);
        if (cached) {
          this.recordMetric("cache_hit", 1, { operation: "getExchangeInfo" });
          return cached;
        }
      }

      // Fetch from API
      const response = await this.fetchFromAPI();

      // Cache the result
      if (this.config.cache && response.success) {
        await this.cacheData(cacheKey, response);
      }

      // Record metrics
      this.recordMetric("response_time", Date.now() - startTime, { operation: "getExchangeInfo" });
      this.recordMetric("cache_miss", 1, { operation: "getExchangeInfo" });

      return response;
    } catch (error) {
      const safeError = toSafeError(error);
      this.recordMetric("error_count", 1, { operation: "getExchangeInfo", error: safeError.name });

      return {
        success: false,
        data: this.getEmptyExchangeInfo(),
        error: safeError.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get trading rules for a specific symbol
   */
  @instrumentServiceMethod("exchange-info", "getSymbolTradingRules")
  async getSymbolTradingRules(symbol: string): Promise<ExchangeInfoResponse> {
    if (!symbol || typeof symbol !== "string") {
      return {
        success: false,
        data: this.getEmptyExchangeInfo(),
        error: "Invalid symbol provided",
        timestamp: Date.now(),
      };
    }

    const exchangeInfo = await this.getExchangeInfo();
    if (!exchangeInfo.success) {
      return exchangeInfo;
    }

    const symbolInfo = exchangeInfo.data.symbols.find((s) => s.symbol === symbol.toUpperCase());

    return {
      success: true,
      data: {
        ...exchangeInfo.data,
        symbols: symbolInfo ? [symbolInfo] : [],
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Get symbols filtered by criteria
   */
  @instrumentServiceMethod("exchange-info", "getFilteredSymbols")
  async getFilteredSymbols(filter: SymbolFilter): Promise<ExchangeInfoResponse> {
    try {
      // Validate filter input
      const validatedFilter = SymbolFilterSchema.parse(filter);

      const exchangeInfo = await this.getExchangeInfo();
      if (!exchangeInfo.success) {
        return exchangeInfo;
      }

      const filteredSymbols = exchangeInfo.data.symbols.filter((symbol) => {
        if (validatedFilter.symbol && symbol.symbol !== validatedFilter.symbol.toUpperCase()) {
          return false;
        }
        if (
          validatedFilter.baseAsset &&
          symbol.baseAsset !== validatedFilter.baseAsset.toUpperCase()
        ) {
          return false;
        }
        if (
          validatedFilter.quoteAsset &&
          symbol.quoteAsset !== validatedFilter.quoteAsset.toUpperCase()
        ) {
          return false;
        }
        if (validatedFilter.status && symbol.status !== validatedFilter.status) {
          return false;
        }
        if (
          validatedFilter.isSpotTradingAllowed !== undefined &&
          symbol.isSpotTradingAllowed !== validatedFilter.isSpotTradingAllowed
        ) {
          return false;
        }
        if (
          validatedFilter.isMarginTradingAllowed !== undefined &&
          symbol.isMarginTradingAllowed !== validatedFilter.isMarginTradingAllowed
        ) {
          return false;
        }
        return true;
      });

      return {
        success: true,
        data: {
          ...exchangeInfo.data,
          symbols: filteredSymbols,
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        success: false,
        data: this.getEmptyExchangeInfo(),
        error: safeError.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get all trading symbols (status = TRADING)
   */
  @instrumentServiceMethod("exchange-info", "getTradingSymbols")
  async getTradingSymbols(): Promise<ExchangeInfoResponse> {
    return this.getFilteredSymbols({ status: "TRADING" });
  }

  /**
   * Get symbols by base asset
   */
  @instrumentServiceMethod("exchange-info", "getSymbolsByBaseAsset")
  async getSymbolsByBaseAsset(baseAsset: string): Promise<ExchangeInfoResponse> {
    if (!baseAsset || typeof baseAsset !== "string") {
      return {
        success: false,
        data: this.getEmptyExchangeInfo(),
        error: "Invalid base asset provided",
        timestamp: Date.now(),
      };
    }

    return this.getFilteredSymbols({ baseAsset: baseAsset.toUpperCase() });
  }

  /**
   * Get symbols by quote asset (e.g., all USDT pairs)
   */
  @instrumentServiceMethod("exchange-info", "getSymbolsByQuoteAsset")
  async getSymbolsByQuoteAsset(quoteAsset: string): Promise<ExchangeInfoResponse> {
    if (!quoteAsset || typeof quoteAsset !== "string") {
      return {
        success: false,
        data: this.getEmptyExchangeInfo(),
        error: "Invalid quote asset provided",
        timestamp: Date.now(),
      };
    }

    return this.getFilteredSymbols({ quoteAsset: quoteAsset.toUpperCase() });
  }

  /**
   * Clear exchange info cache
   */
  async clearCache(): Promise<void> {
    if (!this.config.cache) return;

    await this.config.cache.set(`${this.cacheKeyPrefix}:full`, null, 0);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async fetchFromAPI(): Promise<ExchangeInfoResponse> {
    const executeWithCircuitBreaker =
      this.config.circuitBreaker?.execute ?? ((fn: () => Promise<any>) => fn());

    const rawResponse = await executeWithCircuitBreaker(async () => {
      return this.config.apiClient.get("/api/v3/exchangeInfo");
    });

    // Validate with Zod schema
    const validatedData = ExchangeInfoSchema.parse(rawResponse);

    return {
      success: true,
      data: validatedData,
      timestamp: Date.now(),
    };
  }

  private async getCachedData(cacheKey: string): Promise<ExchangeInfoResponse | null> {
    if (!this.config.cache) return null;

    try {
      const cached = await this.config.cache.get(cacheKey);
      if (!cached) return null;

      // Validate cached data
      return ExchangeInfoResponseSchema.parse(cached);
    } catch (error) {
      // Invalid cached data, ignore and fetch fresh
      return null;
    }
  }

  private async cacheData(cacheKey: string, response: ExchangeInfoResponse): Promise<void> {
    if (!this.config.cache) return;

    const cacheData = {
      ...response,
      cached: true,
    };

    await this.config.cache.set(cacheKey, cacheData, this.cacheTTL);
  }

  private getEmptyExchangeInfo(): ExchangeInfo {
    return {
      timezone: "UTC",
      serverTime: Date.now(),
      symbols: [],
    };
  }

  private recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    this.config.performanceMonitor?.recordMetric(name, value, {
      service: "exchange-info",
      ...tags,
    });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createExchangeInfoService(config: ExchangeInfoConfig): ExchangeInfoService {
  return new ExchangeInfoService(config);
}

// ============================================================================
// Exports
// ============================================================================

export type { ExchangeInfoConfig };
