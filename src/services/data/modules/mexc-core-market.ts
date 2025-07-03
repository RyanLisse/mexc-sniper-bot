/**
 * MEXC Core Market Data Client
 *
 * Market data methods for MEXC API communication.
 * Extracted from core client for better separation of concerns.
 */

import type {
  CalendarEntry,
  MexcServiceResponse,
  SymbolEntry,
} from "./mexc-api-types";
import type { MexcCoreHttpClient } from "./mexc-core-http";

// ============================================================================
// Market Data Operations
// ============================================================================

export class MexcCoreMarketClient {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[mexc-core-market]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[mexc-core-market]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[mexc-core-market]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[mexc-core-market]", message, context || ""),
  };

  constructor(private httpClient: MexcCoreHttpClient) {}

  // ============================================================================
  // Calendar and Listing Methods
  // ============================================================================

  /**
   * Get calendar listings from MEXC
   */
  async getCalendarListings(): Promise<MexcServiceResponse<CalendarEntry[]>> {
    const startTime = Date.now();

    try {
      const timestamp = Date.now();
      const url = `https://www.mexc.com/api/operation/new_coin_calendar?timestamp=${timestamp}`;

      const response = await this.httpClient.makeRequest(url, {
        method: "GET",
        timeout: 30000,
      });

      // Handle MEXC's specific response structure
      if (response.data?.newCoins && Array.isArray(response.data.newCoins)) {
        const calendarData = response.data.newCoins.map((coin: any) => ({
          vcoinId: coin.vcoinId || coin.id || "",
          symbol: coin.vcoinName || coin.symbol || coin.vcoinId || "",
          projectName:
            coin.vcoinNameFull || coin.vcoinName || coin.projectName || "",
          firstOpenTime: this.httpClient.parseTimestamp(
            coin.firstOpenTime || coin.first_open_time
          ),
          vcoinName: coin.vcoinName,
          vcoinNameFull: coin.vcoinNameFull,
          zone: coin.zone,
        }));

        return {
          success: true,
          data: calendarData,
          timestamp: Date.now(),
          source: "mexc-core-market",
        };
      }

      return {
        success: false,
        error: "Invalid calendar response format",
        timestamp: Date.now(),
        source: "mexc-core-market",
      };
    } catch (error) {
      return this.httpClient.handleError(
        error,
        "getCalendarListings",
        startTime
      );
    }
  }

  /**
   * Get activity data for a currency
   */
  async getActivityData(currency: string): Promise<MexcServiceResponse<any>> {
    const startTime = Date.now();

    try {
      const url = `https://www.mexc.com/api/operateactivity/activity/list/by/currencies?currencies=${encodeURIComponent(currency)}`;
      const response = await this.httpClient.makeRequest(url, {
        method: "GET",
        timeout: 10000,
      });

      return {
        success: true,
        data: response.data,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        source: "mexc-core-market",
      };
    } catch (error) {
      return this.httpClient.handleError(error, "getActivityData", startTime);
    }
  }

  // ============================================================================
  // Symbol Information Methods
  // ============================================================================

  /**
   * Get symbols for a specific coin
   */
  async getSymbolsByVcoinId(
    vcoinId: string
  ): Promise<MexcServiceResponse<SymbolEntry[]>> {
    const startTime = Date.now();

    try {
      const config = this.httpClient.getConfig();
      const url = `${config.baseUrl}/api/v3/exchangeInfo`;
      const response = await this.httpClient.makeRequest(url, {
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
          source: "mexc-core-market",
        };
      }

      return {
        success: false,
        error: "Invalid symbols response format",
        timestamp: Date.now(),
        source: "mexc-core-market",
      };
    } catch (error) {
      return this.httpClient.handleError(
        error,
        "getSymbolsByVcoinId",
        startTime
      );
    }
  }

  /**
   * Get all symbols from the exchange
   */
  async getAllSymbols(): Promise<MexcServiceResponse<SymbolEntry[]>> {
    const startTime = Date.now();

    try {
      const config = this.httpClient.getConfig();
      const url = `${config.baseUrl}/api/v3/exchangeInfo`;
      const response = await this.httpClient.makeRequest(url, {
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
          source: "mexc-core-market",
        };
      }

      return {
        success: false,
        error: "Invalid symbols response format",
        timestamp: Date.now(),
        source: "mexc-core-market",
      };
    } catch (error) {
      return this.httpClient.handleError(error, "getAllSymbols", startTime);
    }
  }

  /**
   * Get basic symbol information by symbol name
   */
  async getSymbolInfoBasic(
    symbolName: string
  ): Promise<MexcServiceResponse<any>> {
    const startTime = Date.now();

    try {
      const config = this.httpClient.getConfig();
      const url = `${config.baseUrl}/api/v3/exchangeInfo?symbol=${symbolName}`;
      const response = await this.httpClient.makeRequest(url);

      if (response.data?.symbols?.[0]) {
        return {
          success: true,
          data: response.data.symbols[0],
          timestamp: Date.now(),
          source: "mexc-core-market",
        };
      }

      return {
        success: false,
        error: "Symbol not found",
        timestamp: Date.now(),
        source: "mexc-core-market",
      };
    } catch (error) {
      return this.httpClient.handleError(
        error,
        "getSymbolInfoBasic",
        startTime
      );
    }
  }

  // ============================================================================
  // Market Data Methods
  // ============================================================================

  /**
   * Get ticker data for a specific symbol
   */
  async getTicker(symbol: string): Promise<MexcServiceResponse<any>> {
    const startTime = Date.now();

    try {
      const config = this.httpClient.getConfig();
      const url = `${config.baseUrl}/api/v3/ticker/24hr?symbol=${symbol}`;
      const response = await this.httpClient.makeRequest(url, {
        method: "GET",
      });

      return {
        success: true,
        data: response.data,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        source: "mexc-core-market",
      };
    } catch (error) {
      return this.httpClient.handleError(error, "getTicker", startTime);
    }
  }

  /**
   * Get all ticker data for all symbols (more efficient for portfolio calculations)
   */
  async getAllTickers(): Promise<MexcServiceResponse<any[]>> {
    const startTime = Date.now();

    try {
      const config = this.httpClient.getConfig();
      const url = `${config.baseUrl}/api/v3/ticker/24hr`;
      const response = await this.httpClient.makeRequest(url, {
        method: "GET",
      });

      if (Array.isArray(response.data)) {
        return {
          success: true,
          data: response.data,
          timestamp: Date.now(),
          executionTimeMs: Date.now() - startTime,
          source: "mexc-core-market",
        };
      }

      return {
        success: false,
        error: "Invalid ticker data format",
        timestamp: Date.now(),
        source: "mexc-core-market",
      };
    } catch (error) {
      return this.httpClient.handleError(error, "getAllTickers", startTime);
    }
  }

  /**
   * Get order book for a symbol
   */
  async getOrderBook(
    symbol: string,
    limit: number = 20
  ): Promise<
    MexcServiceResponse<{
      bids: [string, string][];
      asks: [string, string][];
      lastUpdateId: number;
    }>
  > {
    const startTime = Date.now();

    try {
      const config = this.httpClient.getConfig();
      const url = `${config.baseUrl}/api/v3/depth?symbol=${symbol}&limit=${limit}`;
      const response = await this.httpClient.makeRequest(url, {
        method: "GET",
      });

      if (response.data?.bids && response.data?.asks) {
        return {
          success: true,
          data: {
            bids: response.data.bids,
            asks: response.data.asks,
            lastUpdateId: response.data.lastUpdateId || Date.now(),
          },
          timestamp: Date.now(),
          executionTimeMs: Date.now() - startTime,
          source: "mexc-core-market",
        };
      }

      return {
        success: false,
        error: "Invalid order book response format",
        timestamp: Date.now(),
        source: "mexc-core-market",
      };
    } catch (error) {
      return this.httpClient.handleError(error, "getOrderBook", startTime);
    }
  }

  /**
   * Get server time
   */
  async getServerTime(): Promise<MexcServiceResponse<number>> {
    const startTime = Date.now();

    try {
      const config = this.httpClient.getConfig();
      const url = `${config.baseUrl}/api/v3/time`;
      const response = await this.httpClient.makeRequest(url);

      if (response.data?.serverTime) {
        return {
          success: true,
          data: response.data.serverTime,
          timestamp: Date.now(),
          source: "mexc-core-market",
        };
      }

      return {
        success: false,
        error: "Invalid server time response",
        timestamp: Date.now(),
        source: "mexc-core-market",
      };
    } catch (error) {
      return this.httpClient.handleError(error, "getServerTime", startTime);
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new MEXC market client instance
 */
export function createMexcCoreMarketClient(
  httpClient: MexcCoreHttpClient
): MexcCoreMarketClient {
  return new MexcCoreMarketClient(httpClient);
}

// ============================================================================
// Exports
// ============================================================================

export default MexcCoreMarketClient;
