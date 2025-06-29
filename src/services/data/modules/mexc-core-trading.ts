/**
 * MEXC Core Trading Client
 *
 * Trading operations for MEXC API communication.
 * Extracted from core client for better separation of concerns.
 */

import type { MexcServiceResponse } from "./mexc-api-types";
import type { MexcCoreHttpClient } from "./mexc-core-http";

// ============================================================================
// Trading Operations
// ============================================================================

export interface OrderData {
  symbol: string;
  side: "BUY" | "SELL";
  type: "LIMIT" | "MARKET";
  quantity: string;
  price?: string;
  timeInForce?: "GTC" | "IOC" | "FOK";
}

export interface OrderResult {
  symbol: string;
  orderId: number;
  clientOrderId: string;
  transactTime: number;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: string;
  timeInForce: string;
  type: string;
  side: string;
  [key: string]: any;
}

export class MexcCoreTradingClient {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[mexc-core-trading]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[mexc-core-trading]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[mexc-core-trading]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[mexc-core-trading]", message, context || ""),
  };

  constructor(private httpClient: MexcCoreHttpClient) {}

  // ============================================================================
  // Order Management Methods
  // ============================================================================

  /**
   * Place a trading order
   */
  async placeOrder(orderData: OrderData): Promise<MexcServiceResponse<OrderResult>> {
    const startTime = Date.now();

    try {
      // Construct order parameters
      const params = new URLSearchParams({
        symbol: orderData.symbol,
        side: orderData.side,
        type: orderData.type,
        quantity: orderData.quantity,
        timestamp: Date.now().toString(),
      });

      if (orderData.price) {
        params.append("price", orderData.price);
      }

      if (orderData.timeInForce) {
        params.append("timeInForce", orderData.timeInForce);
      }

      // Build authenticated request URL
      const config = this.httpClient.getConfig();
      const baseUrl = `${config.baseUrl}/api/v3/order`;
      const url = `${baseUrl}?${params.toString()}`;

      const response = await this.httpClient.makeAuthenticatedRequest(url, {
        method: "POST",
      });

      return {
        success: true,
        data: response.data || response,
        timestamp: Date.now(),
        source: "mexc-core-trading",
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return this.httpClient.handleError(error, "placeOrder", startTime);
    }
  }

  /**
   * Cancel an existing order
   */
  async cancelOrder(symbol: string, orderId: number): Promise<MexcServiceResponse<any>> {
    const startTime = Date.now();

    try {
      const config = this.httpClient.getConfig();
      const params = new URLSearchParams({
        symbol: symbol,
        orderId: orderId.toString(),
        timestamp: Date.now().toString(),
      });

      const url = `${config.baseUrl}/api/v3/order?${params.toString()}`;

      const response = await this.httpClient.makeAuthenticatedRequest(url, {
        method: "DELETE",
      });

      return {
        success: true,
        data: response.data || response,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        source: "mexc-core-trading",
      };
    } catch (error) {
      return this.httpClient.handleError(error, "cancelOrder", startTime);
    }
  }

  /**
   * Get order status
   */
  async getOrderStatus(symbol: string, orderId: number): Promise<MexcServiceResponse<OrderResult>> {
    const startTime = Date.now();

    try {
      const config = this.httpClient.getConfig();
      const params = new URLSearchParams({
        symbol: symbol,
        orderId: orderId.toString(),
        timestamp: Date.now().toString(),
      });

      const url = `${config.baseUrl}/api/v3/order?${params.toString()}`;

      const response = await this.httpClient.makeAuthenticatedRequest(url, {
        method: "GET",
      });

      return {
        success: true,
        data: response.data || response,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        source: "mexc-core-trading",
      };
    } catch (error) {
      return this.httpClient.handleError(error, "getOrderStatus", startTime);
    }
  }

  /**
   * Get all open orders for a symbol
   */
  async getOpenOrders(symbol?: string): Promise<MexcServiceResponse<OrderResult[]>> {
    const startTime = Date.now();

    try {
      const config = this.httpClient.getConfig();
      const params = new URLSearchParams({
        timestamp: Date.now().toString(),
      });

      if (symbol) {
        params.append("symbol", symbol);
      }

      const url = `${config.baseUrl}/api/v3/openOrders?${params.toString()}`;

      const response = await this.httpClient.makeAuthenticatedRequest(url, {
        method: "GET",
      });

      return {
        success: true,
        data: response.data || response,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        source: "mexc-core-trading",
      };
    } catch (error) {
      return this.httpClient.handleError(error, "getOpenOrders", startTime);
    }
  }

  /**
   * Get order history for a symbol
   */
  async getOrderHistory(
    symbol: string,
    limit: number = 500,
    startTime?: number,
    endTime?: number
  ): Promise<MexcServiceResponse<OrderResult[]>> {
    const startTimeMs = Date.now();

    try {
      const config = this.httpClient.getConfig();
      const params = new URLSearchParams({
        symbol: symbol,
        timestamp: Date.now().toString(),
        limit: limit.toString(),
      });

      if (startTime) {
        params.append("startTime", startTime.toString());
      }

      if (endTime) {
        params.append("endTime", endTime.toString());
      }

      const url = `${config.baseUrl}/api/v3/allOrders?${params.toString()}`;

      const response = await this.httpClient.makeAuthenticatedRequest(url, {
        method: "GET",
      });

      return {
        success: true,
        data: response.data || response,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTimeMs,
        source: "mexc-core-trading",
      };
    } catch (error) {
      return this.httpClient.handleError(error, "getOrderHistory", startTimeMs);
    }
  }

  /**
   * Get user trade history
   */
  async getUserTrades(options: {
    symbol?: string;
    limit?: number;
    startTime?: number;
    endTime?: number;
  }): Promise<MexcServiceResponse<any[]>> {
    const startTimeMs = Date.now();

    try {
      const config = this.httpClient.getConfig();
      const params = new URLSearchParams({
        timestamp: Date.now().toString(),
        limit: (options.limit || 100).toString(),
      });

      if (options.symbol) {
        params.append("symbol", options.symbol);
      }

      if (options.startTime) {
        params.append("startTime", options.startTime.toString());
      }

      if (options.endTime) {
        params.append("endTime", options.endTime.toString());
      }

      const url = `${config.baseUrl}/api/v3/myTrades?${params.toString()}`;

      const response = await this.httpClient.makeAuthenticatedRequest(url, {
        method: "GET",
      });

      return {
        success: true,
        data: response.data || response,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTimeMs,
        source: "mexc-core-trading",
      };
    } catch (error) {
      return this.httpClient.handleError(error, "getUserTrades", startTimeMs);
    }
  }

  // ============================================================================
  // Trading Utility Methods
  // ============================================================================

  /**
   * Place a market buy order
   */
  async marketBuy(symbol: string, quantity: string): Promise<MexcServiceResponse<OrderResult>> {
    return this.placeOrder({
      symbol,
      side: "BUY",
      type: "MARKET",
      quantity,
    });
  }

  /**
   * Place a market sell order
   */
  async marketSell(symbol: string, quantity: string): Promise<MexcServiceResponse<OrderResult>> {
    return this.placeOrder({
      symbol,
      side: "SELL",
      type: "MARKET",
      quantity,
    });
  }

  /**
   * Place a limit buy order
   */
  async limitBuy(
    symbol: string,
    quantity: string,
    price: string,
    timeInForce: "GTC" | "IOC" | "FOK" = "GTC"
  ): Promise<MexcServiceResponse<OrderResult>> {
    return this.placeOrder({
      symbol,
      side: "BUY",
      type: "LIMIT",
      quantity,
      price,
      timeInForce,
    });
  }

  /**
   * Place a limit sell order
   */
  async limitSell(
    symbol: string,
    quantity: string,
    price: string,
    timeInForce: "GTC" | "IOC" | "FOK" = "GTC"
  ): Promise<MexcServiceResponse<OrderResult>> {
    return this.placeOrder({
      symbol,
      side: "SELL",
      type: "LIMIT",
      quantity,
      price,
      timeInForce,
    });
  }

  /**
   * Cancel all open orders for a symbol
   */
  async cancelAllOrders(symbol: string): Promise<MexcServiceResponse<any[]>> {
    const startTime = Date.now();

    try {
      const openOrdersResult = await this.getOpenOrders(symbol);

      if (!openOrdersResult.success || !openOrdersResult.data) {
        return {
          success: false,
          error: openOrdersResult.error || "Failed to get open orders",
          timestamp: Date.now(),
          source: "mexc-core-trading",
        };
      }

      const cancelResults: any[] = [];

      for (const order of openOrdersResult.data) {
        const cancelResult = await this.cancelOrder(symbol, order.orderId);
        cancelResults.push({
          orderId: order.orderId,
          success: cancelResult.success,
          error: cancelResult.error,
        });
      }

      return {
        success: true,
        data: cancelResults,
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime,
        source: "mexc-core-trading",
      };
    } catch (error) {
      return this.httpClient.handleError(error, "cancelAllOrders", startTime);
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new MEXC trading client instance
 */
export function createMexcCoreTradingClient(httpClient: MexcCoreHttpClient): MexcCoreTradingClient {
  return new MexcCoreTradingClient(httpClient);
}

// ============================================================================
// Exports
// ============================================================================

export default MexcCoreTradingClient;
