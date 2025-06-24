// Build-safe imports - avoid structured logger to prevent webpack bundling issues
import type { MexcApiAgent } from "./mexc-api-agent";

export class DataFetcher {
  // Simple console logger to avoid webpack bundling issues
  private logger = {
    info: (message: string, context?: any) => console.info('[data-fetcher]', message, context || ''),
    warn: (message: string, context?: any) => console.warn('[data-fetcher]', message, context || ''),
    error: (message: string, context?: any) => console.error('[data-fetcher]', message, context || ''),
    debug: (message: string, context?: any) => console.debug('[data-fetcher]', message, context || ''),
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
        return result as {
          success: boolean;
          data: unknown[];
          count: number;
          timestamp: string;
          source: string;
        };
      }

      return {
        success: true,
        data: Array.isArray(result) ? result : [],
        count: Array.isArray(result) ? result.length : 0,
        timestamp: new Date().toISOString(),
        source: "mexc-api",
      };
    } catch (error) {
      this.logger.error("[DataFetcher] Calendar API call failed:", error);
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
    try {
      this.logger.info(`[DataFetcher] Fetching symbol data for: ${vcoinId}`);
      const result = await this.mexcApiAgent.callMexcApi("/symbols", { vcoinId });

      if (result && typeof result === "object") {
        return {
          vcoinId,
          symbol: (result as any).symbol || "UNKNOWN",
          success: true,
          source: "mexc-api",
          data: result,
        };
      }

      return {
        vcoinId,
        symbol: "UNKNOWN",
        success: true,
        source: "mexc-api",
        data: result,
      };
    } catch (error) {
      this.logger.error(`[DataFetcher] Symbol API call failed for ${vcoinId}:`, error);
      return {
        vcoinId,
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
    try {
      this.logger.info(`[DataFetcher] Fetching market data for: ${symbol}`);
      const result = await this.mexcApiAgent.callMexcApi("/market", { symbol });

      if (result && typeof result === "object") {
        const marketData = result as any;
        return {
          symbol,
          price: Number.parseFloat(marketData.price) || 0,
          volume: Number.parseFloat(marketData.volume) || 0,
          change: Number.parseFloat(marketData.change) || 0,
          success: true,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        symbol,
        price: 0,
        volume: 0,
        change: 0,
        success: false,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`[DataFetcher] Market data fetch failed for ${symbol}:`, error);
      return {
        symbol,
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
    this.logger.info(`[DataFetcher] Fetching data for ${vcoinIds.length} symbols`);

    const promises = vcoinIds.map((vcoinId) => this.fetchSymbolData(vcoinId));
    const results = await Promise.allSettled(promises);

    return results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      }
      this.logger.error(`[DataFetcher] Failed to fetch symbol ${vcoinIds[index]}:`, result.reason);
      return {
        vcoinId: vcoinIds[index],
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
      this.logger.error("[DataFetcher] Health check failed:", error);
      return false;
    }
  }
}
