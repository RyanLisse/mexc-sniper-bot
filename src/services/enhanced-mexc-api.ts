import {
  type CalendarResponse,
  CalendarResponseSchema,
  type MexcError,
  type SymbolsV2Response,
  SymbolsV2ResponseSchema,
} from "@/src/schemas/mexc-schemas";

export class EnhancedMexcApi {
  private retryCount = 3;
  private retryDelay = 1000;
  private baseHeaders: HeadersInit;

  constructor() {
    this.baseHeaders = {
      "User-Agent": "MEXC-Sniper-Bot/1.0",
      Accept: "application/json",
    };
  }

  /**
   * Get real calendar listings from MEXC new coin calendar API
   */
  async getCalendar(): Promise<CalendarResponse> {
    return this.withRetry(async () => {
      const timestamp = Date.now();
      const url = `https://www.mexc.com/api/operation/new_coin_calendar?timestamp=${timestamp}`;
      console.log(`🌐 MEXC API Request: GET ${url}`);

      const response = await fetch(url, {
        method: "GET",
        headers: this.baseHeaders,
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ MEXC API Response: ${response.status} ${url}`);

      // Use real calendar data from MEXC
      let calendarData: Array<{
        vcoinId: string;
        symbol: string;
        projectName: string;
        firstOpenTime: number;
      }> = [];

      if (data?.data?.newCoins && Array.isArray(data.data.newCoins)) {
        calendarData = data.data.newCoins
          .filter(
            (
              entry: unknown
            ): entry is {
              vcoinId: string;
              vcoinName?: string;
              vcoinNameFull?: string;
              firstOpenTime: number;
            } =>
              typeof entry === "object" &&
              entry !== null &&
              "vcoinId" in entry &&
              typeof entry.vcoinId === "string" &&
              ("vcoinName" in entry || "vcoinNameFull" in entry) &&
              "firstOpenTime" in entry &&
              typeof entry.firstOpenTime === "number"
          )
          .map((entry: any) => ({
            vcoinId: entry.vcoinId,
            symbol: entry.vcoinName || entry.vcoinNameFull || entry.vcoinId,
            projectName: entry.vcoinNameFull || entry.vcoinName || entry.vcoinId,
            firstOpenTime: Number(entry.firstOpenTime),
          }));
      }

      // If no real calendar data, return empty array instead of fake data
      if (calendarData.length === 0) {
        console.log(`📅 Calendar: No new listings found`);
        return CalendarResponseSchema.parse({ data: [] });
      }

      // Validate response with Zod
      const validated = CalendarResponseSchema.parse({ data: calendarData });

      console.log(`📅 Calendar: Found ${validated.data.length} real listings`);
      return validated;
    });
  }

  /**
   * Get real symbols data from MEXC API
   * Uses actual MEXC symbols API for real trading patterns
   */
  async getSymbolsV2(): Promise<SymbolsV2Response> {
    return this.withRetry(async () => {
      // Try the exchange info endpoint as fallback for symbols data
      const url = "https://api.mexc.com/api/v3/exchangeInfo";
      console.log(`🔍 MEXC API Request: GET ${url} (fallback symbols endpoint)`);

      const response = await fetch(url, {
        method: "GET",
        headers: this.baseHeaders,
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ MEXC API Response: Exchange info with ${data?.symbols?.length || 0} symbols`);

      // Use real symbol data from MEXC exchange info endpoint
      let symbols: Array<{
        cd: string;
        ca?: string;
        ps?: number;
        qs?: number;
        sts: number;
        st: number;
        tt: number;
        ot?: number;
      }> = [];

      if (data?.symbols && Array.isArray(data.symbols)) {
        symbols = data.symbols
          .filter(
            (
              symbol: unknown
            ): symbol is {
              symbol: string;
              status: string;
              baseAsset?: string;
              baseAssetPrecision?: number;
              quoteAssetPrecision?: number;
            } =>
              typeof symbol === "object" &&
              symbol !== null &&
              "symbol" in symbol &&
              "status" in symbol &&
              typeof symbol.symbol === "string" &&
              symbol.status === "1"
          )
          .map((symbol: any) => ({
            cd: symbol.baseAsset || symbol.symbol.replace(/USDT$/, ""),
            ca: symbol.symbol,
            ps: symbol.baseAssetPrecision || 8,
            qs: symbol.quoteAssetPrecision || 8,
            sts: symbol.status === "1" ? 2 : 0,
            st: symbol.status === "1" ? 2 : 0,
            tt: 4, // Default trading type
            ot: Date.now(),
          }))
          .slice(0, 100); // Limit to first 100 for performance
      }

      // If no real data, return empty array instead of fake data
      if (symbols.length === 0) {
        console.log(`🔍 Symbols: No symbols found`);
        return SymbolsV2ResponseSchema.parse({ data: { symbols: [] } });
      }

      // Validate response with Zod
      const validated = SymbolsV2ResponseSchema.parse({
        data: { symbols },
      });

      console.log(`🔍 Symbols: Found ${validated.data.symbols.length} real symbols`);
      const readyPatterns = symbols.filter((s) => s.sts === 2 && s.st === 2 && s.tt === 4);
      console.log(`🎯 Ready patterns: ${readyPatterns.length}`);
      return validated;
    });
  }

  /**
   * Get symbols for specific vcoinIds only
   */
  async getSymbolsForVcoins(vcoinIds: string[]): Promise<SymbolsV2Response> {
    const allSymbols = await this.getSymbolsV2();

    // Filter symbols to only include those in our vcoinIds list
    const filteredSymbols = allSymbols.data.symbols.filter((symbol) =>
      vcoinIds.includes(symbol.cd)
    );

    console.log(`🎯 Filtered: ${filteredSymbols.length}/${allSymbols.data.symbols.length} symbols`);

    return {
      data: {
        symbols: filteredSymbols,
      },
    };
  }

  /**
   * Check API connectivity
   */
  async checkConnectivity(): Promise<boolean> {
    try {
      const url = "https://api.mexc.com/api/v3/ping";
      const response = await fetch(url, {
        method: "GET",
        headers: this.baseHeaders,
        signal: AbortSignal.timeout(5000),
      });

      const isConnected = response.ok;
      console.log(`🔗 MEXC Connectivity: ${isConnected ? "Connected" : "Disconnected"}`);
      return isConnected;
    } catch (error) {
      console.error("❌ Connectivity check failed:", error);
      return false;
    }
  }

  /**
   * Get server time for synchronization
   */
  async getServerTime(): Promise<number> {
    return this.withRetry(async () => {
      const url = "https://api.mexc.com/api/v3/time";
      const response = await fetch(url, {
        method: "GET",
        headers: this.baseHeaders,
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.serverTime;
    });
  }

  /**
   * Generic retry wrapper
   */
  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === this.retryCount) {
          console.error(`❌ Max retries (${this.retryCount}) exceeded`);
          throw lastError;
        }

        const delay = this.retryDelay * 2 ** (attempt - 1); // Exponential backoff
        console.warn(`⚠️ Attempt ${attempt} failed, retrying in ${delay}ms...`);

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Standardized error handling
   */
  private handleApiError(error: Error): MexcError {
    if (error.name === "AbortError") {
      return {
        message: "Request timeout: MEXC API did not respond in time",
        details: { timeout: true },
      };
    }
    if (error.message.includes("HTTP")) {
      const statusMatch = error.message.match(/HTTP (\d+)/);
      const status = statusMatch ? Number.parseInt(statusMatch[1]) : undefined;
      return {
        code: status,
        message: `API Error: ${error.message}`,
        details: error,
      };
    }
    return {
      message: `Network Error: ${error.message}`,
      details: error,
    };
  }

  /**
   * Get API rate limit info (if available)
   */
  getRateLimitInfo() {
    // MEXC doesn't provide explicit rate limit headers in public endpoints
    // but we can track our own request frequency
    return {
      requestsPerMinute: 60, // Conservative estimate
      maxConcurrent: 10,
    };
  }
}

// Export singleton instance
export const mexcApi = new EnhancedMexcApi();
