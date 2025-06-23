/**
 * MEXC Trading Service
 * 
 * Handles all trading operations including orders, account info, and market data.
 * Extracted from mexc-api-client.ts for better modularity.
 */

import type { MexcServiceResponse } from "../mexc-schemas";
import { toSafeError } from "../../lib/error-type-utils";
import type { MexcApiClient } from "./mexc-api-client-refactored";

export interface OrderParams {
  symbol: string;
  side: "BUY" | "SELL";
  type?: "LIMIT" | "MARKET" | "STOP_LOSS" | "STOP_LOSS_LIMIT" | "TAKE_PROFIT" | "TAKE_PROFIT_LIMIT";
  quantity: string | number;
  price?: string | number;
  timeInForce?: "GTC" | "IOC" | "FOK";
  newOrderRespType?: "ACK" | "RESULT" | "FULL";
  stopPrice?: string | number;
  icebergQty?: string | number;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  symbol: string;
  side: string;
  quantity: string | number;
  price?: string | number;
  status?: string;
  timestamp: string;
}

export interface OrderBook {
  symbol: string;
  bids: Array<{ price: string; quantity: string }>;
  asks: Array<{ price: string; quantity: string }>;
  timestamp: number;
}

export interface AccountInfo {
  accountType: string;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  balances: Array<{
    asset: string;
    free: string;
    locked: string;
  }>;
  permissions: string[];
  updateTime: number;
}

export interface CredentialTestResult {
  isValid: boolean;
  hasConnection: boolean;
  error?: string;
  responseTime?: number;
  accountType?: string;
  permissions?: string[];
}

export class MexcTradingService {
  constructor(private apiClient: MexcApiClient) {}

  /**
   * Place a new order
   */
  async placeOrder(params: OrderParams): Promise<MexcServiceResponse<OrderResult>> {
    if (!this.apiClient.hasCredentials()) {
      return {
        success: false,
        error: "API credentials are required for placing orders",
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const orderParams = {
        symbol: params.symbol,
        side: params.side,
        type: params.type || "LIMIT",
        quantity: params.quantity,
        price: params.price,
        timeInForce: params.timeInForce || "GTC",
        newOrderRespType: params.newOrderRespType || "RESULT",
        ...(params.stopPrice && { stopPrice: params.stopPrice }),
        ...(params.icebergQty && { icebergQty: params.icebergQty }),
      };

      const response = await this.apiClient.post<any>("/api/v3/order", orderParams);

      // Transform response to match OrderResult format
      if (response.success && response.data) {
        const orderResult: OrderResult = {
          success: true,
          orderId: response.data.orderId?.toString() || response.data.id?.toString(),
          symbol: response.data.symbol || params.symbol,
          side: response.data.side || params.side,
          quantity: response.data.origQty || params.quantity,
          price: response.data.price || params.price,
          status: response.data.status,
          timestamp: new Date().toISOString(),
        };

        return {
          success: true,
          data: orderResult,
          timestamp: new Date().toISOString(),
          requestId: response.requestId,
          responseTime: response.responseTime,
        };
      }

      return response;
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        success: false,
        error: `Failed to place order: ${safeError.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get order book depth for a symbol
   */
  async getOrderBook(symbol: string, limit = 100): Promise<OrderBook> {
    try {
      const response = await this.apiClient.get<any>("/api/v3/depth", { symbol, limit });

      if (response.success && response.data) {
        // Transform MEXC order book format to our standard format
        const orderBook: OrderBook = {
          symbol,
          bids: (response.data.bids || []).map((bid: any) => ({
            price: Array.isArray(bid) ? bid[0] : bid.price,
            quantity: Array.isArray(bid) ? bid[1] : bid.quantity,
          })),
          asks: (response.data.asks || []).map((ask: any) => ({
            price: Array.isArray(ask) ? ask[0] : ask.price,
            quantity: Array.isArray(ask) ? ask[1] : ask.quantity,
          })),
          timestamp: Date.now(),
        };

        return orderBook;
      }

      throw new Error(response.error || "Failed to get order book");
    } catch (error) {
      const safeError = toSafeError(error);
      console.error(`[MexcTradingService] Failed to get order book for ${symbol}:`, safeError.message);
      return {
        symbol,
        bids: [],
        asks: [],
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(symbol: string, orderId: string): Promise<MexcServiceResponse<any>> {
    if (!this.apiClient.hasCredentials()) {
      return {
        success: false,
        error: "API credentials are required for order status",
        timestamp: new Date().toISOString(),
      };
    }

    return this.apiClient.get<any>("/api/v3/order", { symbol, orderId });
  }

  /**
   * Cancel order
   */
  async cancelOrder(symbol: string, orderId: string): Promise<MexcServiceResponse<any>> {
    if (!this.apiClient.hasCredentials()) {
      return {
        success: false,
        error: "API credentials are required for canceling orders",
        timestamp: new Date().toISOString(),
      };
    }

    return this.apiClient.delete<any>("/api/v3/order", { symbol, orderId });
  }

  /**
   * Get open orders
   */
  async getOpenOrders(symbol?: string): Promise<MexcServiceResponse<any[]>> {
    if (!this.apiClient.hasCredentials()) {
      return {
        success: false,
        error: "API credentials are required for getting open orders",
        timestamp: new Date().toISOString(),
      };
    }

    const params = symbol ? { symbol } : {};
    return this.apiClient.get<any[]>("/api/v3/openOrders", params);
  }

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<MexcServiceResponse<AccountInfo>> {
    if (!this.apiClient.hasCredentials()) {
      return {
        success: false,
        error: "API credentials are required for account information",
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const response = await this.apiClient.get<any>("/api/v3/account");

      if (response.success && response.data) {
        // Transform response to standardized AccountInfo format
        const accountInfo: AccountInfo = {
          accountType: response.data.accountType || "SPOT",
          canTrade: response.data.canTrade ?? true,
          canWithdraw: response.data.canWithdraw ?? true,
          canDeposit: response.data.canDeposit ?? true,
          balances: response.data.balances || [],
          permissions: response.data.permissions || ["SPOT"],
          updateTime: response.data.updateTime || Date.now(),
        };

        return {
          success: true,
          data: accountInfo,
          timestamp: new Date().toISOString(),
          requestId: response.requestId,
          responseTime: response.responseTime,
        };
      }

      return response;
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        success: false,
        error: `Failed to get account info: ${safeError.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get account balances
   */
  async getBalances(): Promise<MexcServiceResponse<Array<{ asset: string; free: string; locked: string }>>> {
    const accountResponse = await this.getAccountInfo();
    
    if (accountResponse.success && accountResponse.data) {
      return {
        success: true,
        data: accountResponse.data.balances,
        timestamp: new Date().toISOString(),
        requestId: accountResponse.requestId,
        responseTime: accountResponse.responseTime,
      };
    }

    return {
      success: false,
      error: accountResponse.error || "Failed to get balances",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get trading symbols information
   */
  async getExchangeInfo(): Promise<MexcServiceResponse<any>> {
    return this.apiClient.get<any>("/api/v3/exchangeInfo");
  }

  /**
   * Get server time
   */
  async getServerTime(): Promise<MexcServiceResponse<{ serverTime: number }>> {
    return this.apiClient.get<{ serverTime: number }>("/api/v3/time");
  }

  /**
   * Test API connectivity
   */
  async ping(): Promise<MexcServiceResponse<any>> {
    return this.apiClient.get<any>("/api/v3/ping");
  }

  /**
   * Get 24hr ticker price change statistics
   */
  async get24hrTicker(symbol?: string): Promise<MexcServiceResponse<any>> {
    const params = symbol ? { symbol } : {};
    return this.apiClient.get<any>("/api/v3/ticker/24hr", params);
  }

  /**
   * Get symbol price ticker
   */
  async getSymbolPriceTicker(symbol?: string): Promise<MexcServiceResponse<any>> {
    const params = symbol ? { symbol } : {};
    return this.apiClient.get<any>("/api/v3/ticker/price", params);
  }

  /**
   * Get order book ticker
   */
  async getBookTicker(symbol?: string): Promise<MexcServiceResponse<any>> {
    const params = symbol ? { symbol } : {};
    return this.apiClient.get<any>("/api/v3/ticker/bookTicker", params);
  }

  /**
   * Test API credentials with comprehensive validation
   */
  async testCredentials(): Promise<CredentialTestResult> {
    const startTime = Date.now();

    // Check if credentials exist
    if (!this.apiClient.hasCredentials()) {
      return {
        isValid: false,
        hasConnection: false,
        error: "No API credentials configured",
        responseTime: Date.now() - startTime,
      };
    }

    try {
      // Test connection with a simple unauthenticated request first
      const pingResponse = await this.ping();
      const hasConnection = pingResponse.success;

      if (!hasConnection) {
        return {
          isValid: false,
          hasConnection: false,
          error: "Cannot connect to MEXC API",
          responseTime: Date.now() - startTime,
        };
      }

      // Test credentials with authenticated request
      const accountResponse = await this.getAccountInfo();
      const isValid = accountResponse.success;

      const result: CredentialTestResult = {
        isValid,
        hasConnection,
        responseTime: Date.now() - startTime,
      };

      if (isValid && accountResponse.data) {
        result.accountType = accountResponse.data.accountType;
        result.permissions = accountResponse.data.permissions;
      } else {
        result.error = accountResponse.error || "Invalid credentials";
      }

      return result;
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        isValid: false,
        hasConnection: false,
        error: safeError.message,
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get trade history for a symbol
   */
  async getTradeHistory(symbol: string, limit = 500): Promise<MexcServiceResponse<any[]>> {
    if (!this.apiClient.hasCredentials()) {
      return {
        success: false,
        error: "API credentials are required for trade history",
        timestamp: new Date().toISOString(),
      };
    }

    return this.apiClient.get<any[]>("/api/v3/myTrades", { symbol, limit });
  }

  /**
   * Get order history for a symbol
   */
  async getOrderHistory(symbol: string, limit = 500): Promise<MexcServiceResponse<any[]>> {
    if (!this.apiClient.hasCredentials()) {
      return {
        success: false,
        error: "API credentials are required for order history",
        timestamp: new Date().toISOString(),
      };
    }

    return this.apiClient.get<any[]>("/api/v3/allOrders", { symbol, limit });
  }
}