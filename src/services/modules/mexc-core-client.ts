/**
 * MEXC Core API Client
 *
 * Lightweight, focused HTTP client for MEXC API communication.
 * Extracted from unified service for better separation of concerns.
 */

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
      const response = await this.makeAuthenticatedRequest(url);

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
   * Get account balance
   */
  async getAccountBalance(): Promise<MexcServiceResponse<BalanceEntry[]>> {
    const startTime = Date.now();

    try {
      const url = `${this.config.baseUrl}/api/v3/account`;
      const response = await this.makeAuthenticatedRequest(url);

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
      signal: AbortSignal.timeout(timeout),
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
    const authHeaders = this.generateAuthHeaders();

    return this.makeRequest(url, {
      ...options,
      headers: {
        ...options.headers,
        ...authHeaders,
      },
    });
  }

  private generateAuthHeaders(): Record<string, string> {
    // Simplified auth header generation
    // In production, this would include proper MEXC signature generation
    return {
      "X-MEXC-APIKEY": this.config.apiKey,
    };
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
    console.error(`[MexcCoreClient.${methodName}] Error:`, errorMessage);

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
