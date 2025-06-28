/**
 * MEXC Core API Client
 *
 * Modular, focused HTTP client for MEXC API communication.
 * Refactored to use delegation pattern with specialized modules.
 */

// Build-safe imports - avoid structured logger to prevent webpack bundling issues
import type {
  BalanceEntry,
  CalendarEntry,
  MexcApiConfig,
  MexcServiceResponse,
  SymbolEntry,
} from "./mexc-api-types";
import { createMexcCoreAccountClient, type MexcCoreAccountClient } from "./mexc-core-account";
// Import modular components
import { createMexcCoreHttpClient, type MexcCoreHttpClient } from "./mexc-core-http";
import { createMexcCoreMarketClient, type MexcCoreMarketClient } from "./mexc-core-market";
import type { OrderData, OrderResult } from "./mexc-core-trading";
import { createMexcCoreTradingClient, type MexcCoreTradingClient } from "./mexc-core-trading";

// ============================================================================
// Core Client with Modular Architecture
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

  // Modular components
  private httpClient: MexcCoreHttpClient;
  private marketClient: MexcCoreMarketClient;
  private accountClient: MexcCoreAccountClient;
  private tradingClient: MexcCoreTradingClient;

  constructor(config: MexcApiConfig) {
    // Initialize modular components
    this.httpClient = createMexcCoreHttpClient(config);
    this.marketClient = createMexcCoreMarketClient(this.httpClient);
    this.accountClient = createMexcCoreAccountClient(this.httpClient);
    this.tradingClient = createMexcCoreTradingClient(this.httpClient);
  }

  // ============================================================================
  // Public API Methods - Market Data (delegated to MarketClient)
  // ============================================================================

  /**
   * Get calendar listings from MEXC
   */
  async getCalendarListings(): Promise<MexcServiceResponse<CalendarEntry[]>> {
    return this.marketClient.getCalendarListings();
  }

  /**
   * Get symbols for a specific coin
   */
  async getSymbolsByVcoinId(vcoinId: string): Promise<MexcServiceResponse<SymbolEntry[]>> {
    return this.marketClient.getSymbolsByVcoinId(vcoinId);
  }

  /**
   * Get all symbols from the exchange
   */
  async getAllSymbols(): Promise<MexcServiceResponse<SymbolEntry[]>> {
    return this.marketClient.getAllSymbols();
  }

  /**
   * Get basic symbol information by symbol name
   */
  async getSymbolInfoBasic(symbolName: string): Promise<MexcServiceResponse<any>> {
    return this.marketClient.getSymbolInfoBasic(symbolName);
  }

  /**
   * Get activity data for a currency
   */
  async getActivityData(currency: string): Promise<MexcServiceResponse<any>> {
    return this.marketClient.getActivityData(currency);
  }

  /**
   * Get ticker data for a specific symbol
   */
  async getTicker(symbol: string): Promise<MexcServiceResponse<any>> {
    return this.marketClient.getTicker(symbol);
  }

  /**
   * Get order book for a symbol (required by tests)
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
    return this.marketClient.getOrderBook(symbol, limit);
  }

  /**
   * Get server time
   */
  async getServerTime(): Promise<MexcServiceResponse<number>> {
    return this.marketClient.getServerTime();
  }

  // ============================================================================
  // Public API Methods - Account (delegated to AccountClient)
  // ============================================================================

  /**
   * Get account balance
   */
  async getAccountBalance(): Promise<MexcServiceResponse<BalanceEntry[]>> {
    return this.accountClient.getAccountBalance();
  }

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<MexcServiceResponse<any>> {
    return this.accountClient.getAccountInfo();
  }

  /**
   * Get balance for a specific asset
   */
  async getAssetBalance(asset: string): Promise<MexcServiceResponse<BalanceEntry | null>> {
    return this.accountClient.getAssetBalance(asset);
  }

  // ============================================================================
  // Public API Methods - Trading (delegated to TradingClient)
  // ============================================================================

  /**
   * Place a trading order
   */
  async placeOrder(orderData: OrderData): Promise<MexcServiceResponse<OrderResult>> {
    return this.tradingClient.placeOrder(orderData);
  }

  /**
   * Cancel an order
   */
  async cancelOrder(symbol: string, orderId: number): Promise<MexcServiceResponse<any>> {
    return this.tradingClient.cancelOrder(symbol, orderId);
  }

  /**
   * Get order status
   */
  async getOrderStatus(symbol: string, orderId: number): Promise<MexcServiceResponse<OrderResult>> {
    return this.tradingClient.getOrderStatus(symbol, orderId);
  }

  /**
   * Get all open orders
   */
  async getOpenOrders(symbol?: string): Promise<MexcServiceResponse<OrderResult[]>> {
    return this.tradingClient.getOpenOrders(symbol);
  }

  /**
   * Market buy order shortcut
   */
  async marketBuy(symbol: string, quantity: string): Promise<MexcServiceResponse<OrderResult>> {
    return this.tradingClient.marketBuy(symbol, quantity);
  }

  /**
   * Market sell order shortcut
   */
  async marketSell(symbol: string, quantity: string): Promise<MexcServiceResponse<OrderResult>> {
    return this.tradingClient.marketSell(symbol, quantity);
  }

  // ============================================================================
  // Utility Methods (delegated to underlying clients)
  // ============================================================================

  /**
   * Get the underlying HTTP client for advanced usage
   */
  getHttpClient(): MexcCoreHttpClient {
    return this.httpClient;
  }

  /**
   * Get the market data client for direct access
   */
  getMarketClient(): MexcCoreMarketClient {
    return this.marketClient;
  }

  /**
   * Get the account client for direct access
   */
  getAccountClient(): MexcCoreAccountClient {
    return this.accountClient;
  }

  /**
   * Get the trading client for direct access
   */
  getTradingClient(): MexcCoreTradingClient {
    return this.tradingClient;
  }

  /**
   * Get configuration from HTTP client
   */
  getConfig(): MexcApiConfig {
    return this.httpClient.getConfig();
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
// Re-exports for convenience
// ============================================================================

export {
  createMexcCoreAccountClient,
  MexcCoreAccountClient,
} from "./mexc-core-account";

// Export modular clients for direct use
export {
  createMexcCoreHttpClient,
  MexcCoreHttpClient,
} from "./mexc-core-http";

export {
  createMexcCoreMarketClient,
  MexcCoreMarketClient,
} from "./mexc-core-market";
// Export types from trading module
export type { OrderData, OrderResult } from "./mexc-core-trading";

export {
  createMexcCoreTradingClient,
  MexcCoreTradingClient,
} from "./mexc-core-trading";

// ============================================================================
// Exports
// ============================================================================

export default MexcCoreClient;
