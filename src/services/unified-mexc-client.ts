import crypto from "node:crypto";
import { z } from "zod";
import { mexcApiBreaker } from "./circuit-breaker";

// ============================================================================
// Core Configuration and Types
// ============================================================================

export interface UnifiedMexcConfig {
  apiKey?: string;
  secretKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  rateLimitDelay?: number;
  enableCaching?: boolean;
  cacheTTL?: number;
}

export interface UnifiedMexcResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  timestamp: string;
  cached?: boolean;
  requestId?: string;
}

// ============================================================================
// Common Data Schemas
// ============================================================================

export const CalendarEntrySchema = z.object({
  vcoinId: z.string(),
  symbol: z.string(),
  projectName: z.string(),
  firstOpenTime: z.number(),
});

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

export const BalanceEntrySchema = z.object({
  asset: z.string(),
  free: z.string(),
  locked: z.string(),
  total: z.number(),
  usdtValue: z.number().optional(),
});

export const ExchangeSymbolSchema = z.object({
  symbol: z.string(),
  status: z.string(),
  baseAsset: z.string(),
  quoteAsset: z.string(),
  baseAssetPrecision: z.number(),
  quotePrecision: z.number(),
  quoteAssetPrecision: z.number(),
});

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

// Type exports
export type CalendarEntry = z.infer<typeof CalendarEntrySchema>;
export type SymbolEntry = z.infer<typeof SymbolEntrySchema>;
export type BalanceEntry = z.infer<typeof BalanceEntrySchema>;
export type ExchangeSymbol = z.infer<typeof ExchangeSymbolSchema>;
export type Ticker = z.infer<typeof TickerSchema>;
export type OrderResult = z.infer<typeof OrderResultSchema>;

// ============================================================================
// Request Cache System
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class RequestCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize = 1000;

  set<T>(key: string, data: T, ttl: number): void {
    // Clean up if cache is getting too large
    if (this.cache.size >= this.maxSize) {
      this.cleanup();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach((key) => this.cache.delete(key));
  }

  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}

// ============================================================================
// Trading Order Parameters
// ============================================================================

export interface OrderParameters {
  symbol: string;
  side: "BUY" | "SELL";
  type: "LIMIT" | "MARKET";
  quantity: string;
  price?: string;
  timeInForce?: "GTC" | "IOC" | "FOK";
  quoteOrderQty?: string;
}

// ============================================================================
// Main Unified MEXC Client
// ============================================================================

export class UnifiedMexcClient {
  private config: Required<UnifiedMexcConfig>;
  private lastRequestTime = 0;
  private cache = new RequestCache();
  private requestCounter = 0;

  // Static cache for expensive operations
  private exchangeSymbolsCache: ExchangeSymbol[] | null = null;
  private exchangeSymbolsCacheTime = 0;
  private readonly symbolsCacheExpiry = 300000; // 5 minutes

  constructor(config: UnifiedMexcConfig = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.MEXC_API_KEY || "",
      secretKey: config.secretKey || process.env.MEXC_SECRET_KEY || "",
      baseUrl: config.baseUrl || process.env.MEXC_BASE_URL || "https://api.mexc.com",
      timeout: config.timeout || 10000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      rateLimitDelay: config.rateLimitDelay || 100,
      enableCaching: config.enableCaching ?? true,
      cacheTTL: config.cacheTTL || 60000, // 1 minute default
    };

    console.log(`[UnifiedMexcClient] Initialized with config:`, {
      hasApiKey: Boolean(this.config.apiKey),
      hasSecretKey: Boolean(this.config.secretKey),
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      enableCaching: this.config.enableCaching,
    });
  }

  // ============================================================================
  // Core Request Infrastructure
  // ============================================================================

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.config.rateLimitDelay) {
      const delay = this.config.rateLimitDelay - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestCounter}`;
  }

  private generateSignature(params: Record<string, unknown>): string {
    if (!this.config.secretKey) {
      throw new Error("MEXC secret key not configured");
    }

    // Create a copy of params excluding the signature parameter
    const signatureParams = { ...params };
    delete signatureParams.signature;

    const queryString = new URLSearchParams(
      Object.entries(signatureParams)
        .filter(([_, value]) => value !== undefined && value !== null)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, String(value)])
    ).toString();

    return crypto.createHmac("sha256", this.config.secretKey).update(queryString).digest("hex");
  }

  private generateCacheKey(endpoint: string, params: Record<string, unknown> = {}): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce(
        (result, key) => {
          result[key] = params[key];
          return result;
        },
        {} as Record<string, unknown>
      );

    return `${endpoint}_${JSON.stringify(sortedParams)}`;
  }

  private async makeRequest<T>(
    endpoint: string,
    params: Record<string, unknown> = {},
    authenticated = false,
    skipCache = false
  ): Promise<UnifiedMexcResponse<T>> {
    const requestId = this.generateRequestId();
    const cacheKey = this.generateCacheKey(endpoint, params);

    // Check cache first (if enabled and not skipped)
    if (this.config.enableCaching && !skipCache && !authenticated) {
      const cached = this.cache.get<T>(cacheKey);
      if (cached) {
        console.log(`[UnifiedMexcClient] Cache hit for ${endpoint} (${requestId})`);
        return {
          success: true,
          data: cached,
          timestamp: new Date().toISOString(),
          cached: true,
          requestId,
        };
      }
    }

    const maxRetries = this.config.maxRetries;
    const baseDelay = this.config.retryDelay;

    return mexcApiBreaker.execute(
      async () => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            await this.rateLimit();

            let url: string;
            const headers: Record<string, string> = {
              "Content-Type": "application/json",
              "User-Agent": "MEXC-Sniper-Bot-Unified/1.0",
              "X-Request-ID": requestId,
            };

            if (authenticated) {
              if (!this.config.apiKey || !this.config.secretKey) {
                throw new Error("MEXC API credentials not configured for authenticated request");
              }

              const timestamp = Date.now();
              params.timestamp = timestamp;

              const signature = this.generateSignature(params);
              params.signature = signature;
              headers["X-MEXC-APIKEY"] = this.config.apiKey;

              console.log(`[UnifiedMexcClient] Authenticated request: ${endpoint} (${requestId})`);
            }

            // Build URL with query parameters
            if (endpoint.startsWith("http")) {
              url = endpoint;
            } else {
              url = `${this.config.baseUrl}${endpoint}`;
            }

            const urlObj = new URL(url);
            Object.entries(params).forEach(([key, value]) => {
              if (value !== undefined && value !== null) {
                urlObj.searchParams.append(key, String(value));
              }
            });

            console.log(
              `[UnifiedMexcClient] ${authenticated ? "Auth" : "Public"} request: ${endpoint} (attempt ${attempt}/${maxRetries}) (${requestId})`
            );

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

            const response = await fetch(urlObj.toString(), {
              method: "GET",
              headers,
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(
                `MEXC API error: ${response.status} ${response.statusText} - ${errorText}`
              );
            }

            const data = await response.json();

            // Cache successful responses (if enabled and not authenticated)
            if (this.config.enableCaching && !authenticated && !skipCache) {
              this.cache.set(cacheKey, data, this.config.cacheTTL);
            }

            console.log(
              `[UnifiedMexcClient] Success: ${endpoint} (attempt ${attempt}) (${requestId})`
            );

            return {
              success: true,
              data,
              timestamp: new Date().toISOString(),
              cached: false,
              requestId,
            };
          } catch (error) {
            const isTimeoutError =
              error instanceof Error &&
              (error.name === "AbortError" ||
                error.message.includes("timeout") ||
                error.message.includes("Connect Timeout"));

            const isConnectionError =
              error instanceof Error &&
              (error.message.includes("fetch failed") ||
                error.message.includes("ECONNRESET") ||
                error.message.includes("ENOTFOUND"));

            console.error(
              `[UnifiedMexcClient] Request failed (attempt ${attempt}/${maxRetries}) (${requestId}):`,
              error instanceof Error ? error.message : error
            );

            // Don't retry on authentication or client errors (4xx), only on timeouts and connection issues
            if (
              error instanceof Error &&
              error.message.includes("MEXC API error") &&
              !isTimeoutError &&
              !isConnectionError
            ) {
              return {
                success: false,
                data: null as T,
                error: error.message,
                timestamp: new Date().toISOString(),
                requestId,
              };
            }

            if (attempt === maxRetries) {
              const errorMessage = isTimeoutError
                ? `MEXC API request timeout after ${this.config.timeout}ms (${maxRetries} attempts)`
                : error instanceof Error
                  ? error.message
                  : "Unknown error occurred";

              return {
                success: false,
                data: null as T,
                error: errorMessage,
                timestamp: new Date().toISOString(),
                requestId,
              };
            }

            // Exponential backoff with jitter for retryable errors
            const delay = baseDelay * 2 ** (attempt - 1) + Math.random() * 1000;
            console.log(`[UnifiedMexcClient] Retrying in ${Math.round(delay)}ms... (${requestId})`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }

        throw new Error("Maximum retry attempts exceeded");
      },
      async () => {
        // Fallback mechanism - return a minimal error response
        console.warn(`[UnifiedMexcClient] Circuit breaker fallback triggered (${requestId})`);
        return {
          success: false,
          data: null as T,
          error: "MEXC API circuit breaker is open - service temporarily unavailable",
          timestamp: new Date().toISOString(),
          requestId,
        };
      }
    );
  }

  // ============================================================================
  // Public Market Data Methods
  // ============================================================================

  async getCalendarListings(): Promise<UnifiedMexcResponse<CalendarEntry[]>> {
    try {
      console.log("[UnifiedMexcClient] Fetching calendar listings...");

      const timestamp = Date.now();
      const response = await this.makeRequest<{ data: unknown[] }>(
        `https://www.mexc.com/api/operation/new_coin_calendar?timestamp=${timestamp}`
      );

      if (!response.success) {
        return {
          success: false,
          data: [],
          error: response.error,
          timestamp: new Date().toISOString(),
        };
      }

      // Parse and validate the response
      let calendarData: CalendarEntry[] = [];

      // Handle the actual MEXC API response structure: data.newCoins
      if (response.data?.data?.newCoins && Array.isArray(response.data.data.newCoins)) {
        calendarData = response.data.data.newCoins
          .filter(
            (entry: unknown): entry is Record<string, unknown> =>
              typeof entry === "object" &&
              entry !== null &&
              "vcoinId" in entry &&
              Boolean(entry.vcoinId) &&
              "vcoinName" in entry &&
              Boolean(entry.vcoinName) &&
              "firstOpenTime" in entry &&
              Boolean(entry.firstOpenTime)
          )
          .map((entry): CalendarEntry | undefined => {
            try {
              return CalendarEntrySchema.parse({
                vcoinId: String(entry.vcoinId),
                symbol: String(entry.vcoinName), // MEXC uses vcoinName for symbol
                projectName: String(entry.vcoinNameFull || entry.vcoinName), // MEXC uses vcoinNameFull for full project name
                firstOpenTime: Number(entry.firstOpenTime),
              });
            } catch (error) {
              console.warn("[UnifiedMexcClient] Invalid calendar entry:", entry);
              return undefined;
            }
          })
          .filter((entry): entry is CalendarEntry => entry !== undefined);
      }
      // Fallback: check if data is directly an array (for backward compatibility)
      else if (response.data?.data && Array.isArray(response.data.data)) {
        calendarData = response.data.data
          .filter(
            (entry: unknown): entry is Record<string, unknown> =>
              typeof entry === "object" &&
              entry !== null &&
              "vcoinId" in entry &&
              Boolean(entry.vcoinId) &&
              "symbol" in entry &&
              Boolean(entry.symbol) &&
              "firstOpenTime" in entry &&
              Boolean(entry.firstOpenTime)
          )
          .map((entry): CalendarEntry | undefined => {
            try {
              return CalendarEntrySchema.parse({
                vcoinId: String(entry.vcoinId),
                symbol: String(entry.symbol),
                projectName: String(entry.projectName || entry.symbol),
                firstOpenTime: Number(entry.firstOpenTime),
              });
            } catch (error) {
              console.warn("[UnifiedMexcClient] Invalid calendar entry:", entry);
              return undefined;
            }
          })
          .filter((entry): entry is CalendarEntry => entry !== undefined);
      }

      console.log(`[UnifiedMexcClient] Retrieved ${calendarData.length} calendar entries`);

      return {
        success: true, // API call successful regardless of data count
        data: calendarData,
        timestamp: new Date().toISOString(),
        cached: response.cached,
        requestId: response.requestId,
      };
    } catch (error) {
      console.error("[UnifiedMexcClient] Calendar listings failed:", error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getSymbolsV2(vcoinId?: string): Promise<UnifiedMexcResponse<SymbolEntry[]>> {
    try {
      console.log(
        `[UnifiedMexcClient] Fetching symbols data${vcoinId ? ` for ${vcoinId}` : ""}...`
      );

      const response = await this.makeRequest<{ data: { symbols: unknown[] } }>(
        "/api/platform/spot/market-v2/web/symbolsV2"
      );

      if (!response.success) {
        return {
          success: false,
          data: [],
          error: response.error,
          timestamp: new Date().toISOString(),
        };
      }

      // Parse and validate the response
      let symbolData: SymbolEntry[] = [];

      if (response.data?.data?.symbols && Array.isArray(response.data.data.symbols)) {
        symbolData = response.data.data.symbols
          .filter((entry: unknown): entry is Record<string, unknown> => {
            if (typeof entry !== "object" || entry === null) return false;

            // Filter by vcoinId if provided
            if (vcoinId && "cd" in entry && entry.cd !== vcoinId) {
              return false;
            }

            // Ensure required fields are present
            return (
              "cd" in entry &&
              Boolean(entry.cd) &&
              "sts" in entry &&
              entry.sts !== undefined &&
              "st" in entry &&
              entry.st !== undefined &&
              "tt" in entry &&
              entry.tt !== undefined
            );
          })
          .map((entry): SymbolEntry | null => {
            try {
              return SymbolEntrySchema.parse({
                cd: String(entry.cd),
                sts: Number(entry.sts),
                st: Number(entry.st),
                tt: Number(entry.tt),
                ca: entry.ca as Record<string, unknown>,
                ps: entry.ps as Record<string, unknown>,
                qs: entry.qs as Record<string, unknown>,
                ot: entry.ot as Record<string, unknown>,
              });
            } catch (error) {
              console.warn("[UnifiedMexcClient] Invalid symbol entry:", entry);
              return null;
            }
          })
          .filter((entry): entry is SymbolEntry => entry !== null);
      }

      console.log(`[UnifiedMexcClient] Retrieved ${symbolData.length} symbol entries`);

      return {
        success: symbolData.length > 0,
        data: symbolData,
        timestamp: new Date().toISOString(),
        cached: response.cached,
        requestId: response.requestId,
      };
    } catch (error) {
      console.error("[UnifiedMexcClient] Symbols data failed:", error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getExchangeInfo(): Promise<UnifiedMexcResponse<ExchangeSymbol[]>> {
    try {
      // Check cache first
      const now = Date.now();
      if (
        this.exchangeSymbolsCache &&
        now - this.exchangeSymbolsCacheTime < this.symbolsCacheExpiry
      ) {
        return {
          success: true,
          data: this.exchangeSymbolsCache,
          timestamp: new Date().toISOString(),
          cached: true,
        };
      }

      console.log("[UnifiedMexcClient] Fetching exchange info...");
      const response = await this.makeRequest<{
        symbols: Array<{
          symbol: string;
          status: string;
          baseAsset: string;
          quoteAsset: string;
          baseAssetPrecision: number;
          quotePrecision: number;
          quoteAssetPrecision: number;
        }>;
      }>("/api/v3/exchangeInfo");

      if (!response.success) {
        return {
          success: false,
          data: [],
          error: response.error,
          timestamp: new Date().toISOString(),
        };
      }

      if (!response.data?.symbols || !Array.isArray(response.data.symbols)) {
        return {
          success: false,
          data: [],
          error: "Invalid exchange info response",
          timestamp: new Date().toISOString(),
        };
      }

      // Parse and cache the symbols - MEXC uses status "1" for trading symbols, not "TRADING"
      const validSymbols = response.data.symbols
        .filter((symbol) => symbol.status === "1" && symbol.quoteAsset === "USDT")
        .map((symbol): ExchangeSymbol | null => {
          try {
            return ExchangeSymbolSchema.parse(symbol);
          } catch (error) {
            console.warn("[UnifiedMexcClient] Invalid exchange symbol:", symbol);
            return null;
          }
        })
        .filter((symbol): symbol is ExchangeSymbol => symbol !== null);

      this.exchangeSymbolsCache = validSymbols;
      this.exchangeSymbolsCacheTime = now;

      console.log(`[UnifiedMexcClient] Retrieved ${validSymbols.length} USDT trading pairs`);

      return {
        success: true,
        data: validSymbols,
        timestamp: new Date().toISOString(),
        cached: response.cached,
        requestId: response.requestId,
      };
    } catch (error) {
      console.error("[UnifiedMexcClient] Exchange info failed:", error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  async get24hrTicker(symbol?: string): Promise<UnifiedMexcResponse<Ticker[]>> {
    try {
      const endpoint = symbol ? `/api/v3/ticker/24hr?symbol=${symbol}` : "/api/v3/ticker/24hr";
      const response = await this.makeRequest<Ticker | Ticker[]>(endpoint);

      if (!response.success) {
        return {
          success: false,
          data: [],
          error: response.error,
          timestamp: new Date().toISOString(),
        };
      }

      // Handle both single symbol and all symbols response
      const rawData = Array.isArray(response.data) ? response.data : [response.data];

      const validatedData = rawData
        .map((ticker): Ticker | null => {
          try {
            return TickerSchema.parse(ticker);
          } catch (error) {
            console.warn("[UnifiedMexcClient] Invalid ticker data:", ticker);
            return null;
          }
        })
        .filter((ticker): ticker is Ticker => ticker !== null);

      return {
        success: true,
        data: validatedData,
        timestamp: new Date().toISOString(),
        cached: response.cached,
        requestId: response.requestId,
      };
    } catch (error) {
      console.error("[UnifiedMexcClient] 24hr ticker failed:", error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  async testConnectivity(): Promise<boolean> {
    try {
      console.log("[UnifiedMexcClient] Testing connectivity...");
      const response = await this.makeRequest("/api/v3/ping");
      console.log("[UnifiedMexcClient] Connectivity test successful");
      return response.success;
    } catch (error) {
      console.error("[UnifiedMexcClient] Connectivity test failed:", error);
      return false;
    }
  }

  async getServerTime(): Promise<number> {
    try {
      const response = await this.makeRequest<{ serverTime: number }>("/api/v3/time");
      return response.success ? response.data.serverTime : Date.now();
    } catch (error) {
      console.error("[UnifiedMexcClient] Failed to get server time:", error);
      return Date.now();
    }
  }

  // ============================================================================
  // Authenticated Account Methods
  // ============================================================================

  async getAccountInfo(): Promise<UnifiedMexcResponse<Record<string, unknown>>> {
    if (!this.config.apiKey || !this.config.secretKey) {
      return {
        success: false,
        data: {},
        error: "MEXC API credentials not configured for account info",
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const response = await this.makeRequest("/api/v3/account", {}, true, true); // Skip cache for account info
      return response as UnifiedMexcResponse<Record<string, unknown>>;
    } catch (error) {
      console.error("[UnifiedMexcClient] Account info failed:", error);
      return {
        success: false,
        data: {},
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getAccountBalances(): Promise<
    UnifiedMexcResponse<{ balances: BalanceEntry[]; totalUsdtValue: number; lastUpdated: string }>
  > {
    if (!this.config.apiKey || !this.config.secretKey) {
      console.error("[UnifiedMexcClient] MEXC API credentials not configured");
      return {
        success: false,
        data: {
          balances: [],
          totalUsdtValue: 0,
          lastUpdated: new Date().toISOString(),
        },
        error:
          "MEXC API credentials not configured. Please add MEXC_API_KEY and MEXC_SECRET_KEY to your environment variables.",
        timestamp: new Date().toISOString(),
      };
    }

    try {
      console.log("[UnifiedMexcClient] Fetching account balances...");

      // Get account info with balances
      const accountResponse = await this.makeRequest<{
        balances: Array<{
          asset: string;
          free: string;
          locked: string;
        }>;
      }>("/api/v3/account", {}, true, true); // Skip cache for account info

      if (!accountResponse.success || !accountResponse.data?.balances) {
        return {
          success: false,
          data: {
            balances: [],
            totalUsdtValue: 0,
            lastUpdated: new Date().toISOString(),
          },
          error: accountResponse.error || "Invalid account balance response",
          timestamp: new Date().toISOString(),
        };
      }

      // Get valid trading pairs for USDT conversion validation
      const exchangeInfo = await this.getExchangeInfo();
      const validTradingPairs = new Set(
        exchangeInfo.success ? exchangeInfo.data.map((symbol) => symbol.symbol) : []
      );

      // Filter non-zero balances first
      const nonZeroBalances = accountResponse.data.balances.filter((balance) => {
        const total = Number.parseFloat(balance.free) + Number.parseFloat(balance.locked);
        return total > 0;
      });

      // Get symbols we need prices for (excluding USDT)
      const symbolsNeeded = nonZeroBalances
        .filter((balance) => balance.asset !== "USDT")
        .map((balance) => `${balance.asset}USDT`)
        .filter((symbol) => validTradingPairs.has(symbol));

      console.log(`[UnifiedMexcClient] Need prices for ${symbolsNeeded.length} symbols`);

      // Fetch prices for specific symbols
      const priceMap = new Map<string, number>();

      for (const symbol of symbolsNeeded) {
        try {
          const tickerResponse = await this.get24hrTicker(symbol);
          if (tickerResponse.success && tickerResponse.data.length > 0) {
            const ticker = tickerResponse.data[0];
            const price = ticker?.lastPrice || ticker?.price;
            if (price && Number.parseFloat(price) > 0) {
              priceMap.set(symbol, Number.parseFloat(price));
              console.log(`[UnifiedMexcClient] Got price for ${symbol}: ${price}`);
            }
          }
        } catch (error) {
          console.error(`[UnifiedMexcClient] Failed to get price for ${symbol}:`, error);
        }
      }

      // Process balances with fetched prices
      const balances: BalanceEntry[] = nonZeroBalances
        .map((balance): BalanceEntry | null => {
          const total = Number.parseFloat(balance.free) + Number.parseFloat(balance.locked);
          let usdtValue = 0;

          if (balance.asset === "USDT") {
            usdtValue = total;
          } else {
            const symbol = `${balance.asset}USDT`;
            const price = priceMap.get(symbol);

            if (price && price > 0) {
              usdtValue = total * price;
              console.log(
                `[UnifiedMexcClient] USDT conversion: ${balance.asset} (${total}) @ ${price} = ${usdtValue.toFixed(6)} USDT`
              );
            }
          }

          try {
            return BalanceEntrySchema.parse({
              asset: balance.asset,
              free: balance.free,
              locked: balance.locked,
              total,
              usdtValue,
            });
          } catch (error) {
            console.warn("[UnifiedMexcClient] Invalid balance entry:", balance);
            return null;
          }
        })
        .filter((balance): balance is BalanceEntry => balance !== null)
        .sort((a, b) => (b.usdtValue || 0) - (a.usdtValue || 0)); // Sort by USDT value desc

      const totalUsdtValue = balances.reduce((sum, balance) => sum + (balance.usdtValue || 0), 0);
      const balancesWithValue = balances.filter((b) => (b.usdtValue || 0) > 0);

      console.log(
        `[UnifiedMexcClient] Retrieved ${balances.length} non-zero balances (${balancesWithValue.length} with USDT value), total value: ${totalUsdtValue.toFixed(2)} USDT`
      );

      return {
        success: true,
        data: {
          balances,
          totalUsdtValue,
          lastUpdated: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
        requestId: accountResponse.requestId,
      };
    } catch (error) {
      console.error("[UnifiedMexcClient] Account balances failed:", error);

      // Provide more helpful error messages for common MEXC API issues
      let errorMessage = error instanceof Error ? error.message : "Unknown error";

      if (
        errorMessage.includes("700002") ||
        errorMessage.includes("Signature for this request is not valid")
      ) {
        errorMessage =
          "MEXC API signature validation failed. This is likely due to: 1) IP address not allowlisted for API key, 2) Invalid API credentials, or 3) Clock synchronization issues. Please check your MEXC API key settings and ensure your deployment IP is allowlisted.";
      } else if (errorMessage.includes("10072") || errorMessage.includes("Api key info invalid")) {
        errorMessage =
          "MEXC API key is invalid or expired. Please check your MEXC_API_KEY and MEXC_SECRET_KEY environment variables.";
      }

      return {
        success: false,
        data: {
          balances: [],
          totalUsdtValue: 0,
          lastUpdated: new Date().toISOString(),
        },
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ============================================================================
  // Trading Methods (Authenticated)
  // ============================================================================

  async placeOrder(params: OrderParameters): Promise<UnifiedMexcResponse<OrderResult>> {
    if (!this.config.apiKey || !this.config.secretKey) {
      return {
        success: false,
        data: {
          success: false,
          symbol: params.symbol,
          side: params.side,
          quantity: params.quantity,
          price: params.price,
          error: "MEXC API credentials not configured for trading",
          timestamp: new Date().toISOString(),
        },
        error: "MEXC API credentials not configured for trading",
        timestamp: new Date().toISOString(),
      };
    }

    // Validate order parameters
    const validation = this.validateOrderParameters(params);
    if (!validation.valid) {
      const errorMessage = `Order validation failed: ${validation.errors.join(", ")}`;
      return {
        success: false,
        data: {
          success: false,
          symbol: params.symbol,
          side: params.side,
          quantity: params.quantity,
          price: params.price,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }

    try {
      console.log(
        `[UnifiedMexcClient] Placing ${params.side} order: ${params.symbol}, quantity: ${params.quantity}`
      );

      const requestParams: Record<string, unknown> = {
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        quantity: params.quantity,
      };

      if (params.price) requestParams.price = params.price;
      if (params.timeInForce) requestParams.timeInForce = params.timeInForce;
      if (params.quoteOrderQty) requestParams.quoteOrderQty = params.quoteOrderQty;

      const response = await this.makeRequest("/api/v3/order", requestParams, true, true); // Skip cache for orders

      if (!response.success) {
        return {
          success: false,
          data: {
            success: false,
            symbol: params.symbol,
            side: params.side,
            quantity: params.quantity,
            price: params.price,
            error: response.error || "Order placement failed",
            timestamp: new Date().toISOString(),
          },
          error: response.error,
          timestamp: new Date().toISOString(),
        };
      }

      console.log("[UnifiedMexcClient] Order placed successfully:", response.data);

      const orderData = response.data as any; // MEXC order response
      const orderResult: OrderResult = {
        success: true,
        orderId: orderData.orderId?.toString(),
        symbol: orderData.symbol || params.symbol,
        side: orderData.side || params.side,
        quantity: orderData.origQty || orderData.executedQty || params.quantity,
        price: orderData.price || params.price,
        status: orderData.status,
        timestamp: new Date().toISOString(),
      };

      return {
        success: true,
        data: orderResult,
        timestamp: new Date().toISOString(),
        requestId: response.requestId,
      };
    } catch (error) {
      console.error("[UnifiedMexcClient] Order placement failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown trading error";

      return {
        success: false,
        data: {
          success: false,
          symbol: params.symbol,
          side: params.side,
          quantity: params.quantity,
          price: params.price,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getAssetBalance(asset: string): Promise<{ free: string; locked: string } | null> {
    try {
      const balancesResponse = await this.getAccountBalances();
      if (!balancesResponse.success) {
        return null;
      }

      const assetBalance = balancesResponse.data.balances.find(
        (balance) => balance.asset === asset
      );

      return assetBalance
        ? {
            free: assetBalance.free,
            locked: assetBalance.locked,
          }
        : null;
    } catch (error) {
      console.error("[UnifiedMexcClient] Failed to get asset balance:", error);
      return null;
    }
  }

  validateOrderParameters(params: OrderParameters): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!params.symbol) errors.push("Symbol is required");
    if (!params.side) errors.push("Side (BUY/SELL) is required");
    if (!params.type) errors.push("Order type is required");
    if (!params.quantity || Number.parseFloat(params.quantity) <= 0) {
      errors.push("Valid quantity is required");
    }
    if (params.type === "LIMIT" && (!params.price || Number.parseFloat(params.price) <= 0)) {
      errors.push("Price is required for LIMIT orders");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  clearCache(): void {
    this.cache.clear();
    this.exchangeSymbolsCache = null;
    this.exchangeSymbolsCacheTime = 0;
    console.log("[UnifiedMexcClient] Cache cleared");
  }

  getCacheStats(): { size: number; maxSize: number } {
    return this.cache.getStats();
  }

  getConfig(): Readonly<UnifiedMexcConfig> {
    return { ...this.config };
  }

  hasCredentials(): boolean {
    return Boolean(this.config.apiKey && this.config.secretKey);
  }

  updateConfig(config: Partial<UnifiedMexcConfig>): void {
    this.config = { ...this.config, ...config };
    console.log("[UnifiedMexcClient] Configuration updated");
  }
}

// ============================================================================
// Global Client Instance and Factory
// ============================================================================

let globalUnifiedMexcClient: UnifiedMexcClient | null = null;

export function getUnifiedMexcClient(config?: UnifiedMexcConfig): UnifiedMexcClient {
  if (!globalUnifiedMexcClient) {
    globalUnifiedMexcClient = new UnifiedMexcClient(config);
  } else if (config) {
    globalUnifiedMexcClient.updateConfig(config);
  }
  return globalUnifiedMexcClient;
}

export function resetUnifiedMexcClient(): void {
  globalUnifiedMexcClient = null;
}

// Default export for convenience
export default UnifiedMexcClient;
