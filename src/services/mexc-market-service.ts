"use client";

import { BaseMexcService } from "./base-mexc-service";
import { MexcApiClient } from "./mexc-api-client";
import {
  type ExchangeInfo,
  ExchangeInfoSchema,
  type MexcServiceResponse,
  type SymbolEntry,
  SymbolEntrySchema,
  type Ticker,
  TickerSchema,
  type UnifiedMexcConfig,
  validateMexcData,
} from "./mexc-schemas";

/**
 * MEXC Market Data Service
 * Handles market data, tickers, symbols, and exchange information
 */
export class MexcMarketService extends BaseMexcService {
  private apiClient: MexcApiClient;

  constructor(config: Partial<UnifiedMexcConfig> = {}) {
    super(config);
    this.apiClient = new MexcApiClient(this.config);
  }

  /**
   * Get exchange information
   */
  async getExchangeInfo(): Promise<MexcServiceResponse<ExchangeInfo>> {
    return this.executeRequest(
      "getExchangeInfo",
      async () => {
        const response = await this.apiClient.get("/api/v3/exchangeInfo");
        return validateMexcData(response, ExchangeInfoSchema);
      },
      {
        enableTelemetry: true,
        cacheKey: "exchange_info",
        cacheTTL: 300000, // 5 minutes cache
      }
    );
  }

  /**
   * Get symbols data with validation
   */
  async getSymbolsData(): Promise<MexcServiceResponse<SymbolEntry[]>> {
    return this.executeRequest(
      "getSymbolsData",
      async () => {
        const exchangeResponse = await this.getExchangeInfo();
        if (!exchangeResponse.success || !exchangeResponse.data) {
          throw new Error("Failed to get exchange info");
        }

        return this.validateAndMapArray(
          exchangeResponse.data.symbols,
          (symbol: any) => validateMexcData(symbol, SymbolEntrySchema)
        ) as SymbolEntry[];
      },
      {
        enableTelemetry: true,
        cacheKey: "symbols_data",
        cacheTTL: 60000, // 1 minute cache
      }
    );
  }

  /**
   * Get 24hr ticker statistics
   */
  async getTicker24hr(symbols?: string[]): Promise<MexcServiceResponse<Ticker[]>> {
    return this.executeRequest(
      "getTicker24hr",
      async () => {
        const endpoint = symbols?.length 
          ? `/api/v3/ticker/24hr?symbols=[${symbols.map(s => `"${s}"`).join(",")}]`
          : "/api/v3/ticker/24hr";

        const response = await this.apiClient.get(endpoint);
        const data = Array.isArray(response) ? response : [response];

        return this.validateAndMapArray(
          data,
          (ticker: any) => validateMexcData(ticker, TickerSchema)
        ) as Ticker[];
      },
      {
        enableTelemetry: true,
        cacheKey: symbols ? `ticker_24hr_${symbols.join("_")}` : "ticker_24hr_all",
        cacheTTL: 10000, // 10 seconds cache for real-time data
      }
    );
  }

  /**
   * Get single symbol ticker
   */
  async getTicker(symbol: string): Promise<MexcServiceResponse<Ticker>> {
    return this.executeRequest(
      "getTicker",
      async () => {
        const response = await this.apiClient.get(`/api/v3/ticker/24hr?symbol=${symbol}`);
        return validateMexcData(response, TickerSchema);
      },
      {
        enableTelemetry: true,
        cacheKey: `ticker_${symbol}`,
        cacheTTL: 5000, // 5 seconds cache
      }
    );
  }

  /**
   * Get symbol status
   */
  async getSymbolStatus(symbol: string): Promise<{ status: string; trading: boolean }> {
    const result = await this.executeRequest(
      "getSymbolStatus",
      async () => {
        const exchangeResponse = await this.getExchangeInfo();
        if (!exchangeResponse.success || !exchangeResponse.data) {
          throw new Error("Failed to get exchange info");
        }

        const symbolInfo = exchangeResponse.data.symbols.find(
          (s: any) => s.symbol === symbol
        );

        if (!symbolInfo) {
          throw new Error(`Symbol ${symbol} not found`);
        }

        return {
          status: symbolInfo.status || "UNKNOWN",
          trading: symbolInfo.status === "TRADING",
        };
      },
      {
        enableTelemetry: true,
        cacheKey: `symbol_status_${symbol}`,
        cacheTTL: 30000, // 30 seconds cache
      }
    );

    return result.success ? result.data! : { status: "ERROR", trading: false };
  }

  /**
   * Get order book depth
   */
  async getOrderBookDepth(symbol: string, limit: number = 100): Promise<MexcServiceResponse<any>> {
    return this.executeRequest(
      "getOrderBookDepth",
      async () => {
        const response = await this.apiClient.get(
          `/api/v3/depth?symbol=${symbol}&limit=${limit}`
        );
        
        // Validate basic structure
        if (!response || !response.bids || !response.asks) {
          throw new Error("Invalid order book response");
        }

        return response;
      },
      {
        enableTelemetry: true,
        cacheKey: `orderbook_${symbol}_${limit}`,
        cacheTTL: 2000, // 2 seconds cache for order book
      }
    );
  }

  /**
   * Detect price gaps for a symbol
   */
  async detectPriceGap(symbol: string): Promise<{
    hasGap: boolean;
    gapPercentage: number;
    bidPrice: number;
    askPrice: number;
  }> {
    const result = await this.executeRequest(
      "detectPriceGap",
      async () => {
        const orderBookResponse = await this.getOrderBookDepth(symbol, 5);
        if (!orderBookResponse.success || !orderBookResponse.data) {
          throw new Error("Failed to get order book");
        }

        const { bids, asks } = orderBookResponse.data;
        
        if (!bids?.length || !asks?.length) {
          throw new Error("Empty order book");
        }

        const bestBid = parseFloat(bids[0][0]);
        const bestAsk = parseFloat(asks[0][0]);
        const gapPercentage = ((bestAsk - bestBid) / bestBid) * 100;

        return {
          hasGap: gapPercentage > 1, // Gap > 1%
          gapPercentage,
          bidPrice: bestBid,
          askPrice: bestAsk,
        };
      }
    );

    return result.success
      ? result.data!
      : { hasGap: false, gapPercentage: 0, bidPrice: 0, askPrice: 0 };
  }
}

/**
 * Create and return a singleton instance
 */
let marketServiceInstance: MexcMarketService | null = null;

export function getMexcMarketService(config?: UnifiedMexcConfig): MexcMarketService {
  if (!marketServiceInstance) {
    marketServiceInstance = new MexcMarketService(config);
  }
  return marketServiceInstance;
}

export function resetMexcMarketService(): void {
  marketServiceInstance = null;
}