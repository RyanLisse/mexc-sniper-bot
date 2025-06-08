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
      let calendarData: any[] = [];

      if (data?.data?.newCoins && Array.isArray(data.data.newCoins)) {
        calendarData = data.data.newCoins
          .filter(
            (entry: any) =>
              entry &&
              entry.vcoinId &&
              (entry.vcoinName || entry.vcoinNameFull) &&
              entry.firstOpenTime
          )
          .map((entry: any) => ({
            vcoinId: entry.vcoinId,
            symbol: entry.vcoinName,
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
      // Use the real MEXC symbols V2 API endpoint
      const url = "https://api.mexc.com/api/platform/spot/market-v2/web/symbolsV2";
      console.log(`🔍 MEXC API Request: GET ${url}`);

      const response = await fetch(url, {
        method: "GET",
        headers: this.baseHeaders,
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ MEXC API Response: Real symbols data`);

      // Use real symbol data from MEXC
      let symbols: any[] = [];

      if (data?.data?.symbols && Array.isArray(data.data.symbols)) {
        symbols = data.data.symbols
          .filter((symbol: any) => symbol && symbol.cd && symbol.ca)
          .map((symbol: any) => ({
            cd: symbol.cd,
            ca: symbol.ca,
            ps: symbol.ps || 8,
            qs: symbol.qs || 8,
            sts: symbol.sts || 1,
            st: symbol.st || 1,
            tt: symbol.tt || 3,
            ot: symbol.ot || Date.now(),
          }));
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

        const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
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
    } else if (error.message.includes("HTTP")) {
      const statusMatch = error.message.match(/HTTP (\d+)/);
      const status = statusMatch ? Number.parseInt(statusMatch[1]) : undefined;
      return {
        code: status,
        message: `API Error: ${error.message}`,
        details: error,
      };
    } else {
      return {
        message: `Network Error: ${error.message}`,
        details: error,
      };
    }
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
