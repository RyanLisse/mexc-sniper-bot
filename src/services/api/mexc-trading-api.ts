/**
 * MEXC Trading API Methods
 *
 * Trading methods including order placement and validation.
 * Extracted from unified-mexc-client.ts for better modularity.
 */

import { createSafeLogger } from "../../lib/structured-logger";
import { MexcAccountApiClient } from "./mexc-account-api";
import type {
  OrderParameters,
  OrderResult,
  UnifiedMexcConfig,
  UnifiedMexcResponse,
} from "./mexc-client-types";

// ============================================================================
// Trading API Client
// ============================================================================

export class MexcTradingApiClient extends MexcAccountApiClient {
  private logger = createSafeLogger("mexc-trading-api");

  constructor(config: UnifiedMexcConfig = {}) {
    super(config);
  }

  // ============================================================================
  // Order Management
  // ============================================================================

  /**
   * Place a trading order
   */
  async placeOrder(params: OrderParameters): Promise<UnifiedMexcResponse<OrderResult>> {
    if (!this.config.apiKey || !this.config.secretKey) {
      return {
        success: false,
        data: {
          success: false,
          symbol: params.symbol,
          side: params.side,
          quantity: params.quantity,
          price: params.price,
          error: "MEXC API credentials not configured for trading",
          timestamp: new Date().toISOString(),
        },
        error: "MEXC API credentials not configured for trading",
        timestamp: new Date().toISOString(),
      };
    }

    // Validate order parameters
    const validation = this.validateOrderParameters(params);
    if (!validation.valid) {
      const errorMessage = `Order validation failed: ${validation.errors.join(", ")}`;
      return {
        success: false,
        data: {
          success: false,
          symbol: params.symbol,
          side: params.side,
          quantity: params.quantity,
          price: params.price,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }

    try {
      this.logger.info(
        `[MexcTradingApi] Placing ${params.side} order: ${params.symbol}, quantity: ${params.quantity}`
      );

      const requestParams: Record<string, unknown> = {
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        quantity: params.quantity,
      };

      if (params.price) requestParams.price = params.price;
      if (params.timeInForce) requestParams.timeInForce = params.timeInForce;
      if (params.quoteOrderQty) requestParams.quoteOrderQty = params.quoteOrderQty;

      const response = await this.makeRequest("/api/v3/order", requestParams, true, true); // Skip cache for orders

      if (!response.success) {
        return {
          success: false,
          data: {
            success: false,
            symbol: params.symbol,
            side: params.side,
            quantity: params.quantity,
            price: params.price,
            error: response.error || "Order placement failed",
            timestamp: new Date().toISOString(),
          },
          error: response.error,
          timestamp: new Date().toISOString(),
        };
      }

      this.logger.info("[MexcTradingApi] Order placed successfully:", response.data);

      const orderData = response.data as any; // MEXC order response
      const orderResult: OrderResult = {
        success: true,
        orderId: orderData.orderId?.toString(),
        symbol: orderData.symbol || params.symbol,
        side: orderData.side || params.side,
        quantity: orderData.origQty || orderData.executedQty || params.quantity,
        price: orderData.price || params.price,
        status: orderData.status,
        timestamp: new Date().toISOString(),
      };

      return {
        success: true,
        data: orderResult,
        timestamp: new Date().toISOString(),
        requestId: response.requestId,
      };
    } catch (error) {
      this.logger.error("[MexcTradingApi] Order placement failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown trading error";

      return {
        success: false,
        data: {
          success: false,
          symbol: params.symbol,
          side: params.side,
          quantity: params.quantity,
          price: params.price,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Place a test order (paper trading)
   */
  async placeTestOrder(params: OrderParameters): Promise<UnifiedMexcResponse<OrderResult>> {
    if (!this.config.apiKey || !this.config.secretKey) {
      return {
        success: false,
        data: {
          success: false,
          symbol: params.symbol,
          side: params.side,
          quantity: params.quantity,
          price: params.price,
          error: "MEXC API credentials not configured for test trading",
          timestamp: new Date().toISOString(),
        },
        error: "MEXC API credentials not configured for test trading",
        timestamp: new Date().toISOString(),
      };
    }

    // Validate order parameters
    const validation = this.validateOrderParameters(params);
    if (!validation.valid) {
      const errorMessage = `Test order validation failed: ${validation.errors.join(", ")}`;
      return {
        success: false,
        data: {
          success: false,
          symbol: params.symbol,
          side: params.side,
          quantity: params.quantity,
          price: params.price,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }

    try {
      this.logger.info(
        `[MexcTradingApi] Placing TEST ${params.side} order: ${params.symbol}, quantity: ${params.quantity}`
      );

      const requestParams: Record<string, unknown> = {
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        quantity: params.quantity,
      };

      if (params.price) requestParams.price = params.price;
      if (params.timeInForce) requestParams.timeInForce = params.timeInForce;
      if (params.quoteOrderQty) requestParams.quoteOrderQty = params.quoteOrderQty;

      const response = await this.makeRequest("/api/v3/order/test", requestParams, true, true);

      if (!response.success) {
        return {
          success: false,
          data: {
            success: false,
            symbol: params.symbol,
            side: params.side,
            quantity: params.quantity,
            price: params.price,
            error: response.error || "Test order failed",
            timestamp: new Date().toISOString(),
          },
          error: response.error,
          timestamp: new Date().toISOString(),
        };
      }

      this.logger.info("[MexcTradingApi] Test order successful");

      const orderResult: OrderResult = {
        success: true,
        orderId: `test_${Date.now()}`,
        symbol: params.symbol,
        side: params.side,
        quantity: params.quantity,
        price: params.price,
        status: "TEST_FILLED",
        timestamp: new Date().toISOString(),
      };

      return {
        success: true,
        data: orderResult,
        timestamp: new Date().toISOString(),
        requestId: response.requestId,
      };
    } catch (error) {
      this.logger.error("[MexcTradingApi] Test order failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown test trading error";

      return {
        success: false,
        data: {
          success: false,
          symbol: params.symbol,
          side: params.side,
          quantity: params.quantity,
          price: params.price,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ============================================================================
  // Order Query Methods
  // ============================================================================

  /**
   * Get open orders for a symbol or all symbols
   */
  async getOpenOrders(symbol?: string): Promise<UnifiedMexcResponse<any[]>> {
    if (!this.config.apiKey || !this.config.secretKey) {
      return {
        success: false,
        data: [],
        error: "MEXC API credentials not configured",
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const params: Record<string, unknown> = {};
      if (symbol) params.symbol = symbol;

      const response = await this.makeRequest("/api/v3/openOrders", params, true, true);

      return {
        success: response.success,
        data: response.success ? response.data : [],
        error: response.error,
        timestamp: new Date().toISOString(),
        requestId: response.requestId,
      };
    } catch (error) {
      this.logger.error("[MexcTradingApi] Failed to get open orders:", error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get order history for a symbol
   */
  async getOrderHistory(symbol: string, limit = 50): Promise<UnifiedMexcResponse<any[]>> {
    if (!this.config.apiKey || !this.config.secretKey) {
      return {
        success: false,
        data: [],
        error: "MEXC API credentials not configured",
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const params: Record<string, unknown> = {
        symbol,
        limit: Math.min(limit, 1000), // MEXC limit is 1000
      };

      const response = await this.makeRequest("/api/v3/allOrders", params, true, true);

      return {
        success: response.success,
        data: response.success ? response.data : [],
        error: response.error,
        timestamp: new Date().toISOString(),
        requestId: response.requestId,
      };
    } catch (error) {
      this.logger.error("[MexcTradingApi] Failed to get order history:", error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(symbol: string, orderId: string): Promise<UnifiedMexcResponse<any>> {
    if (!this.config.apiKey || !this.config.secretKey) {
      return {
        success: false,
        data: null,
        error: "MEXC API credentials not configured",
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const params: Record<string, unknown> = {
        symbol,
        orderId,
      };

      const response = await this.makeRequest("/api/v3/order", params, true, true);

      return {
        success: response.success,
        data: response.data,
        error: response.error,
        timestamp: new Date().toISOString(),
        requestId: response.requestId,
      };
    } catch (error) {
      this.logger.error("[MexcTradingApi] Failed to cancel order:", error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ============================================================================
  // Order Validation
  // ============================================================================

  /**
   * Validate order parameters
   */
  validateOrderParameters(params: OrderParameters): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!params.symbol) errors.push("Symbol is required");
    if (!params.side) errors.push("Side (BUY/SELL) is required");
    if (!params.type) errors.push("Order type is required");
    if (!params.quantity || Number.parseFloat(params.quantity) <= 0) {
      errors.push("Valid quantity is required");
    }
    if (params.type === "LIMIT" && (!params.price || Number.parseFloat(params.price) <= 0)) {
      errors.push("Price is required for LIMIT orders");
    }

    // Additional validations
    if (params.side && !["BUY", "SELL"].includes(params.side)) {
      errors.push("Side must be BUY or SELL");
    }
    if (params.type && !["LIMIT", "MARKET"].includes(params.type)) {
      errors.push("Order type must be LIMIT or MARKET");
    }
    if (params.timeInForce && !["GTC", "IOC", "FOK"].includes(params.timeInForce)) {
      errors.push("Time in force must be GTC, IOC, or FOK");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ============================================================================
  // Trading Utilities
  // ============================================================================

  /**
   * Calculate minimum order size for a symbol
   */
  async getMinOrderSize(symbol: string): Promise<number | null> {
    try {
      const exchangeInfo = await this.getExchangeInfo();
      if (!exchangeInfo.success) {
        return null;
      }

      const symbolInfo = exchangeInfo.data.find((s) => s.symbol === symbol);
      if (!symbolInfo) {
        return null;
      }

      // MEXC typically has minimum order size based on quote asset
      // This is a simplified calculation - real implementation would need
      // to parse symbol filters from exchange info
      return 0.001; // Default minimum for most USDT pairs
    } catch (error) {
      this.logger.error("[MexcTradingApi] Failed to get min order size:", error);
      return null;
    }
  }

  /**
   * Calculate order value in USDT
   */
  calculateOrderValue(quantity: string, price: string): number {
    try {
      return Number.parseFloat(quantity) * Number.parseFloat(price);
    } catch (error) {
      this.logger.error("[MexcTradingApi] Failed to calculate order value:", error);
      return 0;
    }
  }

  /**
   * Check if user can afford the order
   */
  async canAffordOrder(params: OrderParameters): Promise<boolean> {
    try {
      if (params.side === "BUY") {
        // For buy orders, check USDT balance
        const requiredAmount =
          params.type === "MARKET"
            ? Number.parseFloat(params.quoteOrderQty || "0")
            : this.calculateOrderValue(params.quantity, params.price || "0");

        return await this.hasSufficientBalance("USDT", requiredAmount);
      } else {
        // For sell orders, check base asset balance
        const baseAsset = params.symbol.replace("USDT", "");
        return await this.hasSufficientBalance(baseAsset, Number.parseFloat(params.quantity));
      }
    } catch (error) {
      this.logger.error("[MexcTradingApi] Failed to check order affordability:", error);
      return false;
    }
  }

  /**
   * Get recommended order type based on market conditions
   */
  async getRecommendedOrderType(symbol: string): Promise<"LIMIT" | "MARKET"> {
    try {
      const ticker = await this.get24hrTicker(symbol);
      if (!ticker.success || ticker.data.length === 0) {
        return "LIMIT"; // Default to limit orders
      }

      const priceChange = Number.parseFloat(ticker.data[0].priceChangePercent || "0");
      const volume = Number.parseFloat(ticker.data[0].volume || "0");

      // Use market orders for high volume, stable price assets
      // Use limit orders for volatile or low volume assets
      if (Math.abs(priceChange) < 2 && volume > 1000000) {
        return "MARKET";
      }

      return "LIMIT";
    } catch (error) {
      this.logger.error("[MexcTradingApi] Failed to get recommended order type:", error);
      return "LIMIT";
    }
  }
}
