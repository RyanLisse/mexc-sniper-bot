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

export class MexcApiClient {
  private config: Required<MexcApiConfig>;
  private lastRequestTime = 0;
  private readonly rateLimitDelay = 100; // 100ms between requests

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
              entry.vcoinId &&
              "symbol" in entry &&
              entry.symbol &&
              "firstOpenTime" in entry &&
              entry.firstOpenTime
          )
          .map((entry) => ({
            vcoinId: entry.vcoinId,
            symbol: entry.symbol,
            projectName: entry.projectName || entry.symbol,
            firstOpenTime: Number(entry.firstOpenTime),
          }));
      }

      console.log(`[MexcApiClient] Retrieved ${calendarData.length} calendar entries`);

      return {
        success: true,
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
              entry.cd &&
              "sts" in entry &&
              entry.sts !== undefined &&
              "st" in entry &&
              entry.st !== undefined &&
              "tt" in entry &&
              entry.tt !== undefined
            );
          })
          .map((entry) => ({
            cd: entry.cd,
            sts: Number(entry.sts),
            st: Number(entry.st),
            tt: Number(entry.tt),
            ca: entry.ca,
            ps: entry.ps,
            qs: entry.qs,
            ot: entry.ot,
          }));
      }

      console.log(`[MexcApiClient] Retrieved ${symbolData.length} symbol entries`);

      return {
        success: true,
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
      return response;
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
