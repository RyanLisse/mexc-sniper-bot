import crypto from "node:crypto";

export interface MexcApiConfig {
  apiKey?: string;
  secretKey?: string;
  baseUrl?: string;
  timeout?: number;
}

export interface MexcCalendarEntry {
  vcoinId: string;
  symbol: string;
  projectName: string;
  firstOpenTime: number; // Unix timestamp in milliseconds
}

export interface MexcSymbolEntry {
  cd: string; // coin ID
  sts: number; // symbol trading status
  st: number; // symbol state
  tt: number; // trading time status
  ca?: Record<string, unknown>; // additional data
  ps?: Record<string, unknown>; // price data
  qs?: Record<string, unknown>; // quote data
  ot?: Record<string, unknown>; // other data
}

export interface MexcApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  timestamp: string;
}

export interface MexcBalance {
  asset: string;
  free: string;
  locked: string;
  total: number;
  usdtValue?: number;
}

export interface MexcAccountBalance {
  balances: MexcBalance[];
  totalUsdtValue: number;
  lastUpdated: string;
}

export interface MexcExchangeSymbol {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  baseAssetPrecision: number;
  quotePrecision: number;
  quoteAssetPrecision: number;
}

export class MexcApiClient {
  private config: Required<MexcApiConfig>;
  private lastRequestTime = 0;
  private readonly rateLimitDelay = 100; // 100ms between requests
  private exchangeSymbolsCache: MexcExchangeSymbol[] | null = null;
  private exchangeSymbolsCacheTime = 0;
  private readonly symbolsCacheExpiry = 300000; // 5 minutes

  constructor(config: MexcApiConfig = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.MEXC_API_KEY || "",
      secretKey: config.secretKey || process.env.MEXC_SECRET_KEY || "",
      baseUrl: config.baseUrl || process.env.MEXC_BASE_URL || "https://api.mexc.com",
      timeout: config.timeout || 10000,
    };
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitDelay) {
      const delay = this.rateLimitDelay - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  private generateSignature(params: Record<string, unknown>): string {
    if (!this.config.secretKey) {
      throw new Error("MEXC secret key not configured");
    }

    const queryString = new URLSearchParams(
      Object.entries(params)
        .filter(([_, value]) => value !== undefined && value !== null)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, String(value)])
    ).toString();

    return crypto.createHmac("sha256", this.config.secretKey).update(queryString).digest("hex");
  }

  private async makeRequest<T>(
    endpoint: string,
    params: Record<string, unknown> = {},
    authenticated = false
  ): Promise<T> {
    await this.rateLimit();

    let url: string;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "MEXC-Sniper-Bot/1.0",
    };

    if (authenticated) {
      if (!this.config.apiKey || !this.config.secretKey) {
        throw new Error("MEXC API credentials not configured for authenticated request");
      }

      params.timestamp = Date.now();
      params.signature = this.generateSignature(params);
      headers["X-MEXC-APIKEY"] = this.config.apiKey;
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
      `[MexcApiClient] ${authenticated ? "Authenticated" : "Public"} request: ${urlObj.toString()}`
    );

    try {
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
        throw new Error(`MEXC API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`[MexcApiClient] Success: ${endpoint}`);
      return data;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error(`MEXC API request timeout after ${this.config.timeout}ms`);
        }
        console.error(`[MexcApiClient] Request failed:`, error.message);
        throw error;
      }
      throw new Error("Unknown error occurred");
    }
  }

  async getCalendarListings(): Promise<MexcApiResponse<MexcCalendarEntry[]>> {
    try {
      console.log("[MexcApiClient] Fetching calendar listings...");

      // Use the real MEXC calendar endpoint provided by user
      const timestamp = Date.now();
      const response = await this.makeRequest<{ data: unknown[] }>(
        `https://www.mexc.com/api/operation/new_coin_calendar?timestamp=${timestamp}`
      );

      // Parse the response and extract calendar entries
      let calendarData: MexcCalendarEntry[] = [];

      if (response?.data && Array.isArray(response.data)) {
        calendarData = response.data
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
          .map(
            (entry): MexcCalendarEntry => ({
              vcoinId: String(entry.vcoinId),
              symbol: String(entry.symbol),
              projectName: String(entry.projectName || entry.symbol),
              firstOpenTime: Number(entry.firstOpenTime),
            })
          );
      }

      console.log(`[MexcApiClient] Retrieved ${calendarData.length} calendar entries`);

      return {
        success: calendarData.length > 0,
        data: calendarData,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("[MexcApiClient] Calendar listings failed:", error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getSymbolsV2(vcoinId?: string): Promise<MexcApiResponse<MexcSymbolEntry[]>> {
    try {
      console.log(`[MexcApiClient] Fetching symbols data${vcoinId ? ` for ${vcoinId}` : ""}...`);

      const response = await this.makeRequest<{ data: { symbols: unknown[] } }>(
        "/api/platform/spot/market-v2/web/symbolsV2"
      );

      // Parse the response and extract symbol entries
      let symbolData: MexcSymbolEntry[] = [];

      if (response?.data?.symbols && Array.isArray(response.data.symbols)) {
        symbolData = response.data.symbols
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
          .map(
            (entry): MexcSymbolEntry => ({
              cd: String(entry.cd),
              sts: Number(entry.sts),
              st: Number(entry.st),
              tt: Number(entry.tt),
              ca: entry.ca as Record<string, unknown>,
              ps: entry.ps as Record<string, unknown>,
              qs: entry.qs as Record<string, unknown>,
              ot: entry.ot as Record<string, unknown>,
            })
          );
      }

      console.log(`[MexcApiClient] Retrieved ${symbolData.length} symbol entries`);

      return {
        success: symbolData.length > 0,
        data: symbolData,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("[MexcApiClient] Symbols data failed:", error);
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
      console.log("[MexcApiClient] Testing connectivity...");
      await this.makeRequest("/api/v3/ping");
      console.log("[MexcApiClient] Connectivity test successful");
      return true;
    } catch (error) {
      console.error("[MexcApiClient] Connectivity test failed:", error);
      return false;
    }
  }

  async getServerTime(): Promise<number> {
    try {
      const response = await this.makeRequest<{ serverTime: number }>("/api/v3/time");
      return response.serverTime;
    } catch (error) {
      console.error("[MexcApiClient] Failed to get server time:", error);
      return Date.now();
    }
  }

  async getExchangeInfo(): Promise<MexcApiResponse<MexcExchangeSymbol[]>> {
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
        };
      }

      console.log("[MexcApiClient] Fetching exchange info...");
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

      if (!response?.symbols || !Array.isArray(response.symbols)) {
        throw new Error("Invalid exchange info response");
      }

      // Cache the symbols - MEXC uses status "1" for trading symbols, not "TRADING"
      this.exchangeSymbolsCache = response.symbols.filter(
        (symbol) => symbol.status === "1" && symbol.quoteAsset === "USDT"
      );
      this.exchangeSymbolsCacheTime = now;

      console.log(
        `[MexcApiClient] Retrieved ${this.exchangeSymbolsCache.length} USDT trading pairs`
      );

      return {
        success: true,
        data: this.exchangeSymbolsCache,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("[MexcApiClient] Exchange info failed:", error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async getTradingPairs(): Promise<Set<string>> {
    try {
      const exchangeInfo = await this.getExchangeInfo();
      if (exchangeInfo.success) {
        return new Set(exchangeInfo.data.map((symbol) => symbol.symbol));
      }
      return new Set();
    } catch (error) {
      console.error("[MexcApiClient] Failed to get trading pairs:", error);
      return new Set();
    }
  }

  // Trading methods (authenticated)
  async placeMarketBuyOrder(
    symbol: string,
    quoteOrderQty: number
  ): Promise<Record<string, unknown>> {
    if (!this.config.apiKey || !this.config.secretKey) {
      throw new Error("MEXC API credentials not configured for trading");
    }

    const params = {
      symbol,
      side: "BUY",
      type: "MARKET",
      quoteOrderQty: quoteOrderQty.toFixed(8),
    };

    try {
      console.log(
        `[MexcApiClient] Placing market buy order: ${symbol}, amount: ${quoteOrderQty} USDT`
      );
      const response = await this.makeRequest("/api/v3/order", params, true);
      console.log("[MexcApiClient] Order placed successfully:", response);
      return response as Record<string, unknown>;
    } catch (error) {
      console.error("[MexcApiClient] Order placement failed:", error);
      throw error;
    }
  }

  async getAccountInfo(): Promise<Record<string, unknown>> {
    if (!this.config.apiKey || !this.config.secretKey) {
      throw new Error("MEXC API credentials not configured for account info");
    }

    try {
      return await this.makeRequest("/api/v3/account", {}, true);
    } catch (error) {
      console.error("[MexcApiClient] Account info failed:", error);
      throw error;
    }
  }

  async getAccountBalances(): Promise<MexcApiResponse<MexcAccountBalance>> {
    if (!this.config.apiKey || !this.config.secretKey) {
      console.error("[MexcApiClient] MEXC API credentials not configured");
      return {
        success: false,
        data: {
          balances: [],
          totalUsdtValue: 0,
          lastUpdated: new Date().toISOString(),
        },
        error: "MEXC API credentials not configured. Please add MEXC_API_KEY and MEXC_SECRET_KEY to your environment variables.",
        timestamp: new Date().toISOString(),
      };
    }

    try {
      console.log("[MexcApiClient] Fetching account balances...");
      console.log("[MexcApiClient] Using API key:", this.config.apiKey.substring(0, 8) + "...");

      // Get account info with balances
      const accountInfo = await this.makeRequest<{
        balances: Array<{
          asset: string;
          free: string;
          locked: string;
        }>;
      }>("/api/v3/account", {}, true);

      if (!accountInfo?.balances) {
        throw new Error("Invalid account balance response");
      }

      // Get valid trading pairs for USDT conversion validation
      const validTradingPairs = await this.getTradingPairs();

      // Filter non-zero balances first to know which prices we need
      const nonZeroBalances = accountInfo.balances.filter((balance) => {
        const total = Number.parseFloat(balance.free) + Number.parseFloat(balance.locked);
        return total > 0; // Only include non-zero balances
      });

      // Get symbols we need prices for (excluding USDT)
      const symbolsNeeded = nonZeroBalances
        .filter((balance) => balance.asset !== "USDT")
        .map((balance) => `${balance.asset}USDT`)
        .filter((symbol) => validTradingPairs.has(symbol));

      console.log(`[MexcApiClient] Need prices for ${symbolsNeeded.length} symbols:`, symbolsNeeded);

      // Fetch prices for specific symbols only
      const priceMap = new Map<string, number>();
      
      // Fetch individual ticker prices for better reliability
      for (const symbol of symbolsNeeded) {
        try {
          const tickerResponse = await this.get24hrTicker(symbol);
          if (tickerResponse.success && tickerResponse.data.length > 0) {
            const ticker = tickerResponse.data[0];
            const price = ticker?.lastPrice || ticker?.price;
            if (price && Number.parseFloat(price) > 0) {
              priceMap.set(symbol, Number.parseFloat(price));
              console.log(`[MexcApiClient] Got price for ${symbol}: ${price}`);
            }
          }
        } catch (error) {
          console.error(`[MexcApiClient] Failed to get price for ${symbol}:`, error);
        }
      }

      // Process balances with fetched prices
      const balances: MexcBalance[] = nonZeroBalances
        .map((balance) => {
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
                `[MexcApiClient] USDT conversion: ${balance.asset} (${total}) @ ${price} = ${usdtValue.toFixed(6)} USDT`
              );
            } else {
              console.log(`[MexcApiClient] No price available for ${symbol}`);
            }
          }

          return {
            asset: balance.asset,
            free: balance.free,
            locked: balance.locked,
            total,
            usdtValue,
          };
        })
        .sort((a, b) => (b.usdtValue || 0) - (a.usdtValue || 0)); // Sort by USDT value desc

      const totalUsdtValue = balances.reduce((sum, balance) => sum + (balance.usdtValue || 0), 0);
      const balancesWithValue = balances.filter((b) => (b.usdtValue || 0) > 0);

      console.log(
        `[MexcApiClient] Retrieved ${balances.length} non-zero balances (${balancesWithValue.length} with USDT value), total value: ${totalUsdtValue.toFixed(2)} USDT`
      );

      return {
        success: true,
        data: {
          balances,
          totalUsdtValue,
          lastUpdated: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("[MexcApiClient] Account balances failed:", error);
      return {
        success: false,
        data: {
          balances: [],
          totalUsdtValue: 0,
          lastUpdated: new Date().toISOString(),
        },
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  async get24hrTicker(symbol?: string): Promise<MexcApiResponse<any[]>> {
    try {
      const endpoint = symbol ? `/api/v3/ticker/24hr?symbol=${symbol}` : "/api/v3/ticker/24hr";
      const response = await this.makeRequest<any>(endpoint);

      // Handle both single symbol and all symbols response
      const data = Array.isArray(response) ? response : [response];

      return {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("[MexcApiClient] 24hr ticker failed:", error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Global client instance
let globalMexcClient: MexcApiClient | null = null;

export function getMexcClient(config?: MexcApiConfig): MexcApiClient {
  if (!globalMexcClient) {
    globalMexcClient = new MexcApiClient(config);
  }
  return globalMexcClient;
}

export function resetMexcClient(): void {
  globalMexcClient = null;
}
