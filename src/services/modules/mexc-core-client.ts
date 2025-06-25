/**
 * MEXC Core API Client
 *
 * Lightweight, focused HTTP client for MEXC API communication.
 * Extracted from unified service for better separation of concerns.
 */

// Build-safe imports - avoid structured logger to prevent webpack bundling issues
import type {
  BalanceEntry,
  CalendarEntry,
  MexcApiConfig,
  MexcApiResponse,
  MexcServiceResponse,
  SymbolEntry,
} from "./mexc-api-types";

// ============================================================================
// Core HTTP Client
// ============================================================================

export class MexcCoreClient {
  // Simple console logger to avoid webpack bundling issues
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[mexc-core-client]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[mexc-core-client]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[mexc-core-client]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[mexc-core-client]", message, context || ""),
  };

  private config: MexcApiConfig;
  private baseHeaders: Record<string, string>;

  constructor(config: MexcApiConfig) {
    this.config = config;
    this.baseHeaders = {
      "Content-Type": "application/json",
      "User-Agent": "MEXC-Sniper-Bot/2.0",
    };
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  /**
   * Get calendar listings from MEXC
   */
  async getCalendarListings(): Promise<MexcServiceResponse<CalendarEntry[]>> {
    const startTime = Date.now();

    try {
      const timestamp = Date.now();
      const url = `https://www.mexc.com/api/operation/new_coin_calendar?timestamp=${timestamp}`;

      const response = await this.makeRequest(url, {
        method: "GET",
        timeout: 30000,
      });

      // Handle MEXC's specific response structure
      if (response.data?.newCoins && Array.isArray(response.data.newCoins)) {
        const calendarData = response.data.newCoins.map((coin: any) => ({
          vcoinId: coin.vcoinId || coin.id || "",
          symbol: coin.vcoinName || coin.symbol || coin.vcoinId || "",
          projectName: coin.vcoinNameFull || coin.vcoinName || coin.projectName || "",
          firstOpenTime: this.parseTimestamp(coin.firstOpenTime || coin.first_open_time),
          vcoinName: coin.vcoinName,
          vcoinNameFull: coin.vcoinNameFull,
          zone: coin.zone,
        }));

        return {
          success: true,
          data: calendarData,
          timestamp: Date.now(),
          source: "mexc-core-client",
        };
      }

      return {
        success: false,
        error: "Invalid calendar response format",
        timestamp: Date.now(),
        source: "mexc-core-client",
      };
    } catch (error) {
      return this.handleError(error, "getCalendarListings", startTime);
    }
  }

  /**
   * Get symbols for a specific coin
   */
  async getSymbolsByVcoinId(vcoinId: string): Promise<MexcServiceResponse<SymbolEntry[]>> {
    const startTime = Date.now();

    try {
      const url = `${this.config.baseUrl}/api/v3/exchangeInfo`;
      const response = await this.makeRequest(url, {
        method: "GET",
      });

      if (response.data?.symbols && Array.isArray(response.data.symbols)) {
        const matchingSymbols = response.data.symbols
          .filter(
            (symbol: any) =>
              symbol.symbol?.includes(vcoinId.toUpperCase()) ||
              symbol.baseAsset === vcoinId.toUpperCase()
          )
          .map((symbol: any) => ({
            symbol: symbol.symbol,
            baseAsset: symbol.baseAsset,
            quoteAsset: symbol.quoteAsset,
            status: symbol.status,
            quoteOrderQtyMarketAllowed: symbol.quoteOrderQtyMarketAllowed,
            baseAssetPrecision: symbol.baseAssetPrecision,
            quotePrecision: symbol.quotePrecision,
            orderTypes: symbol.orderTypes,
            icebergAllowed: symbol.icebergAllowed,
            ocoAllowed: symbol.ocoAllowed,
            isSpotTradingAllowed: symbol.isSpotTradingAllowed,
            isMarginTradingAllowed: symbol.isMarginTradingAllowed,
            filters: symbol.filters,
          }));

        return {
          success: true,
          data: matchingSymbols,
          timestamp: Date.now(),
          source: "mexc-core-client",
        };
      }

      return {
        success: false,
        error: "Invalid symbols response format",
        timestamp: Date.now(),
        source: "mexc-core-client",
      };
    } catch (error) {
      return this.handleError(error, "getSymbolsByVcoinId", startTime);
    }
  }

  /**
   * Get all symbols from the exchange
   */
  async getAllSymbols(): Promise<MexcServiceResponse<SymbolEntry[]>> {
    const startTime = Date.now();

    try {
      const url = `${this.config.baseUrl}/api/v3/exchangeInfo`;
      const response = await this.makeRequest(url, {
        method: "GET",
      });

      if (response.data?.symbols && Array.isArray(response.data.symbols)) {
        const allSymbols = response.data.symbols.map((symbol: any) => ({
          symbol: symbol.symbol,
          baseAsset: symbol.baseAsset,
          quoteAsset: symbol.quoteAsset,
          status: symbol.status,
          quoteOrderQtyMarketAllowed: symbol.quoteOrderQtyMarketAllowed,
          baseAssetPrecision: symbol.baseAssetPrecision,
          quotePrecision: symbol.quotePrecision,
          orderTypes: symbol.orderTypes,
          icebergAllowed: symbol.icebergAllowed,
          ocoAllowed: symbol.ocoAllowed,
          isSpotTradingAllowed: symbol.isSpotTradingAllowed,
          isMarginTradingAllowed: symbol.isMarginTradingAllowed,
          filters: symbol.filters,
        }));

        return {
          success: true,
          data: allSymbols,
          timestamp: Date.now(),
          source: "mexc-core-client",
        };
      }

      return {
        success: false,
        error: "Invalid symbols response format",
        timestamp: Date.now(),
        source: "mexc-core-client",
      };
    } catch (error) {
      return this.handleError(error, "getAllSymbols", startTime);
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance(): Promise<MexcServiceResponse<BalanceEntry[]>> {
    const startTime = Date.now();

    try {
      const timestamp = Date.now();
      const url = `${this.config.baseUrl}/api/v3/account?timestamp=${timestamp}`;
      const response = await this.makeAuthenticatedRequest(url, {
        method: "GET",
      });

      if (response.data?.balances && Array.isArray(response.data.balances)) {
        const balances = response.data.balances
          .filter(
            (balance: any) =>
              Number.parseFloat(balance.free) > 0 || Number.parseFloat(balance.locked) > 0
          )
          .map((balance: any) => ({
            asset: balance.asset,
            free: balance.free,
            locked: balance.locked,
          }));

        return {
          success: true,
          data: balances,
          timestamp: Date.now(),
          source: "mexc-core-client",
        };
      }

      return {
        success: false,
        error: "Invalid balance response format",
        timestamp: Date.now(),
        source: "mexc-core-client",
      };
    } catch (error) {
      return this.handleError(error, "getAccountBalance", startTime);
    }
  }

  /**
   * Get server time
   */
  async getServerTime(): Promise<MexcServiceResponse<number>> {
    const startTime = Date.now();

    try {
      const url = `${this.config.baseUrl}/api/v3/time`;
      const response = await this.makeRequest(url);

      if (response.data?.serverTime) {
        return {
          success: true,
          data: response.data.serverTime,
          timestamp: Date.now(),
          source: "mexc-core-client",
        };
      }

      return {
        success: false,
        error: "Invalid server time response",
        timestamp: Date.now(),
        source: "mexc-core-client",
      };
    } catch (error) {
      return this.handleError(error, "getServerTime", startTime);
    }
  }

  /**
   * Get basic symbol information by symbol name
   */
  async getSymbolInfoBasic(symbolName: string): Promise<MexcServiceResponse<any>> {
    const startTime = Date.now();

    try {
      const url = `${this.config.baseUrl}/api/v3/exchangeInfo?symbol=${symbolName}`;
      const response = await this.makeRequest(url);

      if (response.data?.symbols?.[0]) {
        return {
          success: true,
          data: response.data.symbols[0],
          timestamp: Date.now(),
          source: "mexc-core-client",
        };
      }

      return {
        success: false,
        error: "Symbol not found",
        timestamp: Date.now(),
        source: "mexc-core-client",
      };
    } catch (error) {
      return this.handleError(error, "getSymbolInfoBasic", startTime);
    }
  }

  /**
   * Get activity data for a currency
   */
  async getActivityData(currency: string): Promise<MexcServiceResponse<any>> {
    const startTime = Date.now();

    try {
      const url = `https://www.mexc.com/api/operateactivity/activity/list/by/currencies?currencies=${encodeURIComponent(currency)}`;
      const response = await this.makeRequest(url, {
        method: "GET",
        timeout: 10000,
      });

      return {
        success: true,
        data: response.data,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        source: "mexc-core-client",
      };
    } catch (error) {
      return this.handleError(error, "getActivityData", startTime);
    }
  }

  /**
   * Place a trading order
   */
  async placeOrder(orderData: {
    symbol: string;
    side: "BUY" | "SELL";
    type: "LIMIT" | "MARKET";
    quantity: string;
    price?: string;
    timeInForce?: "GTC" | "IOC" | "FOK";
  }): Promise<MexcServiceResponse<any>> {
    const startTime = Date.now();

    try {
      // Construct order parameters
      const params = new URLSearchParams({
        symbol: orderData.symbol,
        side: orderData.side,
        type: orderData.type,
        quantity: orderData.quantity,
        timestamp: Date.now().toString(),
      });

      if (orderData.price) {
        params.append("price", orderData.price);
      }

      if (orderData.timeInForce) {
        params.append("timeInForce", orderData.timeInForce);
      }

      // Build authenticated request URL
      const baseUrl = `${this.config.baseUrl}/api/v3/order`;
      const url = `${baseUrl}?${params.toString()}`;

      const response = await this.makeAuthenticatedRequest(url, {
        method: "POST",
      });

      return {
        success: true,
        data: response.data,
        timestamp: Date.now(),
        source: "mexc-core-client",
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return this.handleError(error, "placeOrder", startTime);
    }
  }

  /**
   * Get ticker data for a specific symbol
   */
  async getTicker(symbol: string): Promise<MexcServiceResponse<any>> {
    const startTime = Date.now();

    try {
      const url = `${this.config.baseUrl}/api/v3/ticker/24hr?symbol=${symbol}`;
      const response = await this.makeRequest(url, {
        method: "GET",
      });

      return {
        success: true,
        data: response.data,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        source: "mexc-core-client",
      };
    } catch (error) {
      return this.handleError(error, "getTicker", startTime);
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async makeRequest(
    url: string,
    options: RequestInit & { timeout?: number } = {}
  ): Promise<MexcApiResponse> {
    const { timeout = this.config.timeout, ...fetchOptions } = options;

    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        ...this.baseHeaders,
        ...fetchOptions.headers,
      },
      signal: (() => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), timeout);
        return controller.signal;
      })(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  }

  private async makeAuthenticatedRequest(
    url: string,
    options: RequestInit = {}
  ): Promise<MexcApiResponse> {
    // Add authentication headers here
    const authHeaders = this.generateAuthHeaders(url, options);

    return this.makeRequest(url, {
      ...options,
      headers: {
        ...options.headers,
        ...authHeaders,
      },
    });
  }

  private generateAuthHeaders(url: string, options: RequestInit = {}): Record<string, string> {
    // Parse URL to get query string (timestamp should already be included)
    const urlObj = new URL(url);
    const queryString = urlObj.search ? urlObj.search.substring(1) : "";

    // MEXC signature is based on the query string for GET requests
    const stringToSign = queryString;

    // Generate HMAC-SHA256 signature
    const signature = this.createSignature(stringToSign);

    return {
      "X-MEXC-APIKEY": this.config.apiKey,
      "X-MEXC-SIGNATURE": signature,
      "Content-Type": "application/x-www-form-urlencoded", // MEXC requires this for authenticated requests
    };
  }

  private createSignature(data: string): string {
    if (typeof window !== "undefined") {
      // Browser environment - return a placeholder
      this.logger.warn("MEXC API signatures cannot be generated in browser environment");
      return "browser-placeholder";
    }

    try {
      const crypto = require("crypto");
      return crypto.createHmac("sha256", this.config.secretKey).update(data).digest("hex");
    } catch (error) {
      this.logger.error("Failed to create MEXC signature:", error);
      return "signature-error";
    }
  }

  private parseTimestamp(timestamp: any): number {
    if (typeof timestamp === "string") {
      return new Date(timestamp).getTime();
    }
    return timestamp || Date.now();
  }

  private handleError(
    error: unknown,
    methodName: string,
    startTime: number
  ): MexcServiceResponse<never> {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    this.logger.error(`[MexcCoreClient.${methodName}] Error:`, errorMessage);

    return {
      success: false,
      error: errorMessage,
      timestamp: Date.now(),
      source: "mexc-core-client",
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new MEXC core client instance
 */
export function createMexcCoreClient(config: MexcApiConfig): MexcCoreClient {
  return new MexcCoreClient(config);
}

// ============================================================================
// Exports
// ============================================================================

export default MexcCoreClient;
