/**
 * MEXC Market Data API Methods
 *
 * Public market data methods including calendar listings, symbols, exchange info, and tickers.
 * Extracted from unified-mexc-client.ts for better modularity.
 */

import { getGlobalErrorRecoveryService } from "../risk/mexc-error-recovery-service";
import { MexcClientCore } from "./mexc-client-core";
import type {
  CalendarEntry,
  ExchangeSymbol,
  SymbolEntry,
  Ticker,
  UnifiedMexcConfig,
  UnifiedMexcResponse,
} from "./mexc-client-types";
import {
  CalendarEntrySchema,
  ExchangeSymbolSchema,
  SymbolEntrySchema,
  TickerSchema,
} from "./mexc-client-types";

// ============================================================================
// Market Data Client
// ============================================================================

export class MexcMarketDataClient extends MexcClientCore {
  // Static cache for expensive operations
  private exchangeSymbolsCache: ExchangeSymbol[] | null = null;
  private exchangeSymbolsCacheTime = 0;
  private readonly symbolsCacheExpiry = 300000; // 5 minutes
  protected marketLogger = {
    info: (message: string, context?: any) =>
      console.info("[mexc-market-data]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[mexc-market-data]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[mexc-market-data]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[mexc-market-data]", message, context || ""),
  };

  constructor(config: UnifiedMexcConfig = {}) {
    super(config);
  }

  // ============================================================================
  // Calendar and Listings
  // ============================================================================

  /**
   * Get new coin calendar listings from MEXC
   */
  async getCalendarListings(): Promise<UnifiedMexcResponse<CalendarEntry[]>> {
    try {
      console.info("[MexcMarketData] Fetching calendar listings...");

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
      if (
        (response.data as any)?.data?.newCoins &&
        Array.isArray((response.data as any).data.newCoins)
      ) {
        calendarData = (response.data as any).data.newCoins
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
          .map((entry: any): CalendarEntry | undefined => {
            try {
              return CalendarEntrySchema.parse({
                vcoinId: String(entry.vcoinId),
                symbol: String(entry.vcoinName), // MEXC uses vcoinName for symbol
                projectName: String(entry.vcoinNameFull || entry.vcoinName), // MEXC uses vcoinNameFull for full project name
                firstOpenTime: Number(entry.firstOpenTime),
              });
            } catch (_error) {
              console.warn("[MexcMarketData] Invalid calendar entry:", entry);
              return undefined;
            }
          })
          .filter(
            (entry: CalendarEntry | undefined): entry is CalendarEntry => entry !== undefined
          );
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
          .map((entry: any): CalendarEntry | undefined => {
            try {
              return CalendarEntrySchema.parse({
                vcoinId: String(entry.vcoinId),
                symbol: String(entry.symbol),
                projectName: String(entry.projectName || entry.symbol),
                firstOpenTime: Number(entry.firstOpenTime),
              });
            } catch (_error) {
              console.warn("[MexcMarketData] Invalid calendar entry:", entry);
              return undefined;
            }
          })
          .filter(
            (entry: CalendarEntry | undefined): entry is CalendarEntry => entry !== undefined
          );
      }

      console.info(`[MexcMarketData] Retrieved ${calendarData.length} calendar entries`);

      return {
        success: true, // API call successful regardless of data count
        data: calendarData,
        timestamp: new Date().toISOString(),
        cached: response.cached,
        requestId: response.requestId,
      };
    } catch (error) {
      console.error("[MexcMarketData] Calendar listings failed:", error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ============================================================================
  // Symbol Information
  // ============================================================================

  /**
   * Get symbols data from MEXC V2 API
   */
  async getSymbolsV2(vcoinId?: string): Promise<UnifiedMexcResponse<SymbolEntry[]>> {
    try {
      console.info(`[MexcMarketData] Fetching symbols data${vcoinId ? ` for ${vcoinId}` : ""}...`);

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
            } catch (_error) {
              console.warn("[MexcMarketData] Invalid symbol entry:", entry);
              return null;
            }
          })
          .filter((entry): entry is SymbolEntry => entry !== null);
      }

      console.info(`[MexcMarketData] Retrieved ${symbolData.length} symbol entries`);

      return {
        success: symbolData.length > 0,
        data: symbolData,
        timestamp: new Date().toISOString(),
        cached: response.cached,
        requestId: response.requestId,
      };
    } catch (error) {
      console.error("[MexcMarketData] Symbols data failed:", error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get exchange information with caching
   */
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

      console.info("[MexcMarketData] Fetching exchange info...");
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
          } catch (_error) {
            console.warn("[MexcMarketData] Invalid exchange symbol:", symbol);
            return null;
          }
        })
        .filter((symbol): symbol is ExchangeSymbol => symbol !== null);

      this.exchangeSymbolsCache = validSymbols;
      this.exchangeSymbolsCacheTime = now;

      console.info(`[MexcMarketData] Retrieved ${validSymbols.length} USDT trading pairs`);

      return {
        success: true,
        data: validSymbols,
        timestamp: new Date().toISOString(),
        cached: response.cached,
        requestId: response.requestId,
      };
    } catch (error) {
      console.error("[MexcMarketData] Exchange info failed:", error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ============================================================================
  // Price and Ticker Data
  // ============================================================================

  /**
   * Get 24hr ticker statistics
   */
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
          } catch (_error) {
            console.warn("[MexcMarketData] Invalid ticker data:", ticker);
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
      console.error("[MexcMarketData] 24hr ticker failed:", error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get current price for a symbol or all symbols
   */
  async getPrice(
    symbol?: string
  ): Promise<UnifiedMexcResponse<{ symbol: string; price: string }[]>> {
    try {
      const endpoint = symbol ? `/api/v3/ticker/price?symbol=${symbol}` : "/api/v3/ticker/price";
      const response = await this.makeRequest<
        { symbol: string; price: string } | { symbol: string; price: string }[]
      >(endpoint);

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

      return {
        success: true,
        data: rawData,
        timestamp: new Date().toISOString(),
        cached: response.cached,
        requestId: response.requestId,
      };
    } catch (error) {
      console.error("[MexcMarketData] Price data failed:", error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ============================================================================
  // Connectivity and Health
  // ============================================================================

  /**
   * Test connectivity with error recovery
   */
  async testConnectivity(): Promise<UnifiedMexcResponse<{ status: string }>> {
    const recoveryService = getGlobalErrorRecoveryService();

    try {
      console.info("[MexcMarketData] Testing connectivity with error recovery...");

      const result = await recoveryService.executeWithRecovery(
        () => this.makeRequest("/api/v3/ping"),
        undefined, // No fallback for connectivity test
        "Connectivity Test"
      );

      const success = Boolean(result.success && result.data?.success);
      console.info("[MexcMarketData] Connectivity test result:", success);
      return {
        success: result.success,
        data: { status: success ? "connected" : "failed" },
        error: result.error,
        timestamp: new Date().toISOString(),
        requestId: (result as any).requestId || `test-${Date.now()}`,
      };
    } catch (error) {
      console.error("[MexcMarketData] Connectivity test failed:", error);
      return {
        success: false,
        data: { status: "failed" },
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get server time (fallback to local time if API fails)
   */
  async getServerTime(): Promise<UnifiedMexcResponse<{ serverTime: number }>> {
    try {
      const response = await this.makeRequest<{ serverTime: number }>("/api/v3/time");
      if (response.success) {
        return response;
      }
      return {
        success: false,
        data: { serverTime: Date.now() },
        error: response.error || "Failed to get server time",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("[MexcMarketData] Failed to get server time:", error);
      return {
        success: false,
        data: { serverTime: Date.now() },
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Clear exchange symbols cache
   */
  clearExchangeCache(): void {
    this.exchangeSymbolsCache = null;
    this.exchangeSymbolsCacheTime = 0;
    console.info("[MexcMarketData] Exchange symbols cache cleared");
  }

  /**
   * Get cached exchange symbols count
   */
  getCachedSymbolsCount(): number {
    return this.exchangeSymbolsCache?.length || 0;
  }

  /**
   * Check if exchange cache is valid
   */
  isExchangeCacheValid(): boolean {
    const now = Date.now();
    return Boolean(
      this.exchangeSymbolsCache && now - this.exchangeSymbolsCacheTime < this.symbolsCacheExpiry
    );
  }
}
