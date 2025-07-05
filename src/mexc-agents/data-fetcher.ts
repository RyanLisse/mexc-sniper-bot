// Build-safe imports - avoid structured logger to prevent webpack bundling issues
import type { MexcApiAgent } from "./mexc-api-agent";

export class DataFetcher {
  // Simple console logger to avoid webpack bundling issues
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[data-fetcher]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[data-fetcher]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[data-fetcher]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[data-fetcher]", message, context || ""),
  };

  private mexcApiAgent: MexcApiAgent;

  constructor(mexcApiAgent: MexcApiAgent) {
    this.mexcApiAgent = mexcApiAgent;
  }

  async fetchCalendarData(): Promise<{
    success: boolean;
    data: unknown[];
    count: number;
    timestamp: string;
    source: string;
  }> {
    try {
      this.logger.info("[DataFetcher] Fetching calendar data from MEXC API");
      const result = await this.mexcApiAgent.callMexcApi("/calendar");

      if (result && typeof result === "object" && "success" in result) {
        const enhancedResponse = result as any;
        const dataArray = Array.isArray(enhancedResponse.data)
          ? enhancedResponse.data
          : [];
        return {
          success: enhancedResponse.success,
          data: dataArray,
          count: dataArray.length,
          timestamp: enhancedResponse.timestamp || new Date().toISOString(),
          source: "mexc-api",
        };
      }

      const dataArray = Array.isArray(result) ? result : [];
      return {
        success: true,
        data: dataArray,
        count: dataArray.length,
        timestamp: new Date().toISOString(),
        source: "mexc-api",
      };
    } catch (error) {
      this.logger.error(
        "[DataFetcher] Calendar API call failed:",
        error instanceof Error ? error.message : String(error)
      );
      return {
        success: false,
        data: [],
        count: 0,
        timestamp: new Date().toISOString(),
        source: "error_fallback",
      };
    }
  }

  async fetchSymbolData(vcoinId: string): Promise<{
    vcoinId: string;
    symbol: string;
    success: boolean;
    source: string;
    data?: unknown;
  }> {
    // Handle null/undefined/invalid vcoinId
    const safeVcoinId =
      vcoinId && typeof vcoinId === "string" ? vcoinId.trim() : "";

    if (!safeVcoinId) {
      this.logger.warn(`[DataFetcher] Invalid vcoinId provided: ${vcoinId}`);
      return {
        vcoinId: safeVcoinId,
        symbol: "UNKNOWN",
        success: false,
        source: "invalid_input",
      };
    }

    try {
      this.logger.info(
        `[DataFetcher] Fetching symbol data for: ${safeVcoinId}`
      );
      const result = await this.mexcApiAgent.callMexcApi("/symbols", {
        vcoinId: safeVcoinId,
      });

      if (result && typeof result === "object") {
        return {
          vcoinId: safeVcoinId,
          symbol: (result as any).symbol || "UNKNOWN",
          success: true,
          source: "mexc-api",
          data: result,
        };
      }

      return {
        vcoinId: safeVcoinId,
        symbol: "UNKNOWN",
        success: true,
        source: "mexc-api",
        data: result,
      };
    } catch (error) {
      this.logger.error(
        `[DataFetcher] Symbol API call failed for ${safeVcoinId}:`,
        error instanceof Error ? error.message : String(error)
      );
      return {
        vcoinId: safeVcoinId,
        symbol: "UNKNOWN",
        success: false,
        source: "error_fallback",
      };
    }
  }

  async fetchMarketData(symbol: string): Promise<{
    symbol: string;
    price: number;
    volume: number;
    change: number;
    success: boolean;
    timestamp: string;
  }> {
    // Handle null/undefined/invalid symbol
    const safeSymbol =
      symbol && typeof symbol === "string" ? symbol.trim() : "";

    if (!safeSymbol) {
      this.logger.warn(`[DataFetcher] Invalid symbol provided: ${symbol}`);
      return {
        symbol: safeSymbol,
        price: 0,
        volume: 0,
        change: 0,
        success: false,
        timestamp: new Date().toISOString(),
      };
    }

    try {
      this.logger.info(`[DataFetcher] Fetching market data for: ${safeSymbol}`);
      const result = await this.mexcApiAgent.callMexcApi("/market", {
        symbol: safeSymbol,
      });

      if (result && typeof result === "object") {
        const marketData = result as any;
        return {
          symbol: safeSymbol,
          price: Number.parseFloat(marketData.price) || 0,
          volume: Number.parseFloat(marketData.volume) || 0,
          change: Number.parseFloat(marketData.change) || 0,
          success: true,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        symbol: safeSymbol,
        price: 0,
        volume: 0,
        change: 0,
        success: false,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `[DataFetcher] Market data fetch failed for ${safeSymbol}:`,
        error instanceof Error ? error.message : String(error)
      );
      return {
        symbol: safeSymbol,
        price: 0,
        volume: 0,
        change: 0,
        success: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async fetchMultipleSymbols(vcoinIds: string[]): Promise<
    Array<{
      vcoinId: string;
      symbol: string;
      success: boolean;
      data?: unknown;
    }>
  > {
    // Handle null/undefined/non-array input
    if (!Array.isArray(vcoinIds) || vcoinIds.length === 0) {
      this.logger.warn("[DataFetcher] No valid vcoinIds provided");
      return [];
    }

    // Filter out null/undefined/empty vcoinIds
    const validVcoinIds = vcoinIds.filter(
      (id) => id && typeof id === "string" && id.trim() !== ""
    );

    if (validVcoinIds.length === 0) {
      this.logger.warn("[DataFetcher] No valid vcoinIds after filtering");
      return [];
    }

    this.logger.info(
      `[DataFetcher] Fetching data for ${validVcoinIds.length} symbols`
    );

    const promises = validVcoinIds.map((vcoinId) =>
      this.fetchSymbolData(vcoinId)
    );
    const results = await Promise.allSettled(promises);

    return results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      }
      this.logger.error(
        `[DataFetcher] Failed to fetch symbol ${validVcoinIds[index]}:`,
        result.reason
      );
      return {
        vcoinId: validVcoinIds[index] || "UNKNOWN",
        symbol: "UNKNOWN",
        success: false,
      };
    });
  }

  // Health check for data fetching capabilities
  async healthCheck(): Promise<boolean> {
    try {
      const testResult = await this.mexcApiAgent.callMexcApi("/health");
      return testResult !== null;
    } catch (error) {
      this.logger.error(
        "[DataFetcher] Health check failed:",
        error instanceof Error ? error.message : String(error)
      );
      return false;
    }
  }
}
