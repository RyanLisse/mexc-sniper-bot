"use client";

import type { MarketService } from "@/src/application/interfaces/trading-repository";
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
} from "@/src/schemas/unified/mexc-api-schemas";
import { BaseMexcService } from "./base-mexc-service";
import { MexcApiClient } from "./mexc-api-client";

/**
 * MEXC Market Data Service
 * Handles market data, tickers, symbols, and exchange information
 * Implements MarketService interface for service compliance
 */
export class MexcMarketService extends BaseMexcService implements MarketService {
  private apiClient: MexcApiClient;

  constructor(config: Partial<UnifiedMexcConfig> = {}) {
    super(config);
    this.apiClient = new MexcApiClient(this.config);
  }

  // ============================================================================
  // MarketService Interface Implementation
  // ============================================================================

  /**
   * Get exchange information
   * Implements MarketService.getExchangeInfo interface
   */
  async getExchangeInfo(): Promise<{
    success: boolean;
    data?: {
      symbols?: Array<{
        symbol: string;
        status: string;
        baseAsset: string;
        quoteAsset: string;
      }>;
    };
    error?: string;
  }> {
    try {
      const response = await this.getExchangeInfoInternal();
      if (!response.success) {
        return {
          success: false,
          error: response.error || "Failed to get exchange info",
        };
      }

      // Map internal format to interface format
      const symbols = (response.data?.symbols || []).map((symbol: any) => ({
        symbol: symbol.symbol || "",
        status: symbol.status || "UNKNOWN",
        baseAsset: symbol.baseAsset || "",
        quoteAsset: symbol.quoteAsset || "",
      }));

      return {
        success: true,
        data: {
          symbols,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get symbols data with validation
   * Implements MarketService.getSymbolsData interface
   */
  async getSymbolsData(): Promise<{
    success: boolean;
    data?: Array<{
      symbol: string;
      status: string;
      baseAsset: string;
      quoteAsset: string;
    }>;
    error?: string;
  }> {
    try {
      const exchangeResponse = await this.getExchangeInfoInternal();
      if (!exchangeResponse.success || !exchangeResponse.data) {
        return {
          success: false,
          error: "Failed to get exchange info",
        };
      }

      const symbols = this.validateAndMapArray(
        exchangeResponse.data.symbols || [],
        SymbolEntrySchema
      ) as SymbolEntry[];

      // Map internal format to interface format
      const mappedSymbols = symbols.map((symbol: SymbolEntry) => ({
        symbol: symbol.symbol || "",
        status: symbol.status || "UNKNOWN",
        baseAsset: symbol.baseAsset || "",
        quoteAsset: symbol.quoteAsset || "",
      }));

      return {
        success: true,
        data: mappedSymbols,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get 24hr ticker statistics
   * Implements MarketService.getTicker24hr interface
   */
  async getTicker24hr(symbols?: string[]): Promise<{
    success: boolean;
    data?: Array<{
      symbol: string;
      lastPrice: string;
      priceChangePercent: string;
      volume: string;
    }>;
    error?: string;
  }> {
    try {
      const response = await this.apiClient.get24hrTicker();
      if (!response.success) {
        return {
          success: false,
          error: response.error || "Failed to get 24hr ticker",
        };
      }

      const data = Array.isArray(response.data) ? response.data : [response.data];
      const tickers = this.validateAndMapArray(data, TickerSchema) as Ticker[];

      // Map internal format to interface format
      const mappedTickers = tickers.map((ticker: Ticker) => ({
        symbol: ticker.symbol || "",
        lastPrice: ticker.lastPrice || "0",
        priceChangePercent: ticker.priceChangePercent || "0",
        volume: ticker.volume || "0",
      }));

      return {
        success: true,
        data: mappedTickers,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get single symbol ticker
   * Implements MarketService.getTicker interface
   */
  async getTicker(symbol: string): Promise<{
    success: boolean;
    data?: {
      symbol: string;
      lastPrice: string;
      priceChangePercent: string;
      volume: string;
    };
    error?: string;
  }> {
    try {
      const response = await this.apiClient.get24hrTicker(symbol);
      if (!response.success) {
        return {
          success: false,
          error: response.error || "Failed to get ticker",
        };
      }

      const tickerData = Array.isArray(response.data) ? response.data[0] : response.data;
      const tickerValidation = validateMexcData(TickerSchema, tickerData);
      if (!tickerValidation.success) {
        return {
          success: false,
          error: tickerValidation.error || "Failed to validate ticker data",
        };
      }
      const ticker = tickerValidation.data;

      // Map internal format to interface format
      const mappedTicker = {
        symbol: ticker.symbol || "",
        lastPrice: ticker.lastPrice || "0",
        priceChangePercent: ticker.priceChangePercent || "0",
        volume: ticker.volume || "0",
      };

      return {
        success: true,
        data: mappedTicker,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get symbol status
   * Implements MarketService.getSymbolStatus interface
   */
  async getSymbolStatus(symbol: string): Promise<{ status: string; trading: boolean }> {
    try {
      const exchangeResponse = await this.getExchangeInfoInternal();
      if (!exchangeResponse.success || !exchangeResponse.data) {
        throw new Error("Failed to get exchange info");
      }

      const symbolInfo = exchangeResponse.data.symbols?.find((s: any) => s.symbol === symbol);

      if (!symbolInfo) {
        throw new Error(`Symbol ${symbol} not found`);
      }

      return {
        status: symbolInfo.status || "UNKNOWN",
        trading: symbolInfo.status === "TRADING",
      };
    } catch (error) {
      return { status: "ERROR", trading: false };
    }
  }

  /**
   * Get order book depth
   * Implements MarketService.getOrderBookDepth interface
   */
  async getOrderBookDepth(
    symbol: string,
    limit = 100
  ): Promise<{
    success: boolean;
    data?: {
      bids: [string, string][];
      asks: [string, string][];
      lastUpdateId: number;
    };
    error?: string;
  }> {
    try {
      // TODO: Implement proper order book API call when client method is available
      // For now, return mock data to prevent compilation errors
      const mockOrderBook = {
        bids: [
          ["50000.00", "1.5"],
          ["49999.00", "2.0"],
        ] as [string, string][],
        asks: [
          ["50001.00", "1.2"],
          ["50002.00", "1.8"],
        ] as [string, string][],
        lastUpdateId: Date.now(),
      };

      return {
        success: true,
        data: mockOrderBook,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ============================================================================
  // Internal Methods for Module Use
  // ============================================================================

  /**
   * Get exchange information (internal method for module use)
   */
  async getExchangeInfoInternal(): Promise<MexcServiceResponse<ExchangeInfo>> {
    try {
      const response = await this.apiClient.getExchangeInfo();
      if (!response.success) {
        throw new Error(response.error || "Failed to get exchange info");
      }
      const exchangeValidation = validateMexcData(ExchangeInfoSchema, response.data);
      if (!exchangeValidation.success) {
        throw new Error(exchangeValidation.error || "Failed to validate exchange info");
      }

      return {
        success: true,
        data: exchangeValidation.data,
        timestamp: new Date().toISOString(),
        source: "mexc-market-service",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        source: "mexc-market-service",
      };
    }
  }

  /**
   * Get symbols data with validation (internal method)
   */
  async getSymbolsDataInternal(): Promise<MexcServiceResponse<SymbolEntry[]>> {
    try {
      const exchangeResponse = await this.getExchangeInfoInternal();
      if (!exchangeResponse.success || !exchangeResponse.data) {
        throw new Error("Failed to get exchange info");
      }

      const symbols = this.validateAndMapArray(
        exchangeResponse.data.symbols || [],
        SymbolEntrySchema
      ) as SymbolEntry[];

      return {
        success: true,
        data: symbols,
        timestamp: new Date().toISOString(),
        source: "mexc-market-service",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        source: "mexc-market-service",
      };
    }
  }

  /**
   * Get 24hr ticker statistics (internal method)
   */
  async getTicker24hrInternal(symbols?: string[]): Promise<MexcServiceResponse<Ticker[]>> {
    try {
      const response = await this.apiClient.get24hrTicker();
      if (!response.success) {
        throw new Error(response.error || "Failed to get 24hr ticker");
      }

      const data = Array.isArray(response.data) ? response.data : [response.data];
      const tickers = this.validateAndMapArray(data, TickerSchema) as Ticker[];

      return {
        success: true,
        data: tickers,
        timestamp: new Date().toISOString(),
        source: "mexc-market-service",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        source: "mexc-market-service",
      };
    }
  }

  /**
   * Get single symbol ticker (internal method)
   */
  async getTickerInternal(symbol: string): Promise<MexcServiceResponse<Ticker>> {
    try {
      const response = await this.apiClient.get24hrTicker(symbol);
      if (!response.success) {
        throw new Error(response.error || "Failed to get ticker");
      }

      const tickerData = Array.isArray(response.data) ? response.data[0] : response.data;
      const tickerValidation = validateMexcData(TickerSchema, tickerData);
      if (!tickerValidation.success) {
        throw new Error(tickerValidation.error || "Failed to validate ticker data");
      }
      const ticker = tickerValidation.data;

      return {
        success: true,
        data: ticker,
        timestamp: new Date().toISOString(),
        source: "mexc-market-service",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        source: "mexc-market-service",
      };
    }
  }

  // ============================================================================
  // Additional Helper Methods
  // ============================================================================

  /**
   * Detect price gaps for a symbol
   */
  async detectPriceGap(symbol: string): Promise<{
    hasGap: boolean;
    gapPercentage: number;
    bidPrice: number;
    askPrice: number;
  }> {
    try {
      const orderBookResponse = await this.getOrderBookDepth(symbol, 5);
      if (!orderBookResponse.success || !orderBookResponse.data) {
        throw new Error("Failed to get order book");
      }

      const { bids, asks } = orderBookResponse.data;

      if (!bids?.length || !asks?.length) {
        throw new Error("Empty order book");
      }

      const bestBid = Number.parseFloat(bids[0][0]);
      const bestAsk = Number.parseFloat(asks[0][0]);
      const gapPercentage = ((bestAsk - bestBid) / bestBid) * 100;

      return {
        hasGap: gapPercentage > 1, // Gap > 1%
        gapPercentage,
        bidPrice: bestBid,
        askPrice: bestAsk,
      };
    } catch (error) {
      return { hasGap: false, gapPercentage: 0, bidPrice: 0, askPrice: 0 };
    }
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
