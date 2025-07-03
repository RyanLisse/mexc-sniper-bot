/**
 * Order Execution Helper
 *
 * Consolidates order placement and retry logic to eliminate redundancy.
 * Provides standardized methods for executing trades with error handling and retries.
 */

import { toSafeError } from "@/src/lib/error-type-utils";
import type { ServiceResponse, TradeParameters, TradeResult } from "../types";
import { ServiceResponseUtils } from "./service-response-utils";

interface OrderExecutionConfig {
  mexcService: any;
  logger: any;
  getCurrentPrice: (symbol: string) => Promise<number | null>;
  maxRetries?: number;
  retryDelay?: number;
}

export class OrderExecutionHelper {
  private config: OrderExecutionConfig;

  constructor(config: OrderExecutionConfig) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      ...config,
    };
  }

  /**
   * Execute a paper trade for testing/simulation
   */
  async executePaperTrade(params: TradeParameters): Promise<TradeResult> {
    const startTime = Date.now();
    const simulatedPrice = 100 + Math.random() * 1000; // Mock price
    const orderId = `paper-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      data: {
        orderId,
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        quantity: (params.quoteOrderQty! / simulatedPrice).toString(),
        price: simulatedPrice.toString(),
        status: "FILLED",
        executedQty: (params.quoteOrderQty! / simulatedPrice).toString(),
        timestamp: new Date().toISOString(),
        paperTrade: true,
        simulatedPrice,
        autoSnipe: params.isAutoSnipe || false,
        confidenceScore: params.confidenceScore,
      },
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Execute a real trade with validation and retry logic
   */
  async executeRealTrade(params: TradeParameters): Promise<TradeResult> {
    const startTime = Date.now();

    try {
      // Validate order parameters
      await this.validateOrderParameters(params);

      // Get current market price for validation
      const currentPrice = await this.config.getCurrentPrice(params.symbol);
      if (!currentPrice) {
        throw new Error(`Unable to get current price for ${params.symbol}`);
      }

      // Prepare MEXC API parameters
      const mexcParams = this.prepareMexcOrderParams(params, currentPrice);

      // Execute order with retry logic
      const mexcResult = await this.executeOrderWithRetry(mexcParams);

      if (!mexcResult.success || !mexcResult.data) {
        throw new Error(mexcResult.error || "Trade execution failed");
      }

      return this.formatTradeResult(
        mexcResult.data,
        params,
        currentPrice,
        startTime
      );
    } catch (error) {
      const safeError = toSafeError(error);
      this.config.logger.error("Real trade execution failed", {
        symbol: params.symbol,
        error: safeError.message,
        params: {
          side: params.side,
          type: params.type,
          quoteOrderQty: params.quoteOrderQty,
        },
      });
      throw safeError;
    }
  }

  /**
   * Execute order for closing a position (stop-loss/take-profit)
   */
  async executeCloseOrder(
    symbol: string,
    side: "BUY" | "SELL",
    quantity: number
  ): Promise<ServiceResponse<any>> {
    const closeParams = {
      symbol,
      side,
      type: "MARKET" as const,
      quantity,
      timeInForce: "IOC" as const,
    };

    return this.executeOrderWithRetry(closeParams);
  }

  /**
   * Validate order parameters before execution
   */
  private async validateOrderParameters(
    params: TradeParameters
  ): Promise<void> {
    // Validate symbol format
    if (!params.symbol || typeof params.symbol !== "string") {
      throw new Error("Invalid symbol format");
    }

    // Validate side
    if (!["BUY", "SELL"].includes(params.side)) {
      throw new Error("Invalid order side");
    }

    // Validate order type
    if (!["MARKET", "LIMIT", "STOP_LIMIT"].includes(params.type)) {
      throw new Error("Invalid order type");
    }

    // Validate time in force
    if (
      params.timeInForce &&
      !["GTC", "IOC", "FOK"].includes(params.timeInForce)
    ) {
      throw new Error("Invalid time in force");
    }

    // Validate quote order quantity
    if (params.quoteOrderQty) {
      const minOrderValue = 5; // USDT minimum
      if (params.quoteOrderQty < minOrderValue) {
        throw new Error(
          `Order value too small. Minimum: ${minOrderValue} USDT`
        );
      }
    }

    // Validate required parameters
    if (!params.symbol || !params.side || !params.type) {
      throw new Error("Missing required trading parameters");
    }

    if (!params.quoteOrderQty && !params.quantity) {
      throw new Error("Either quoteOrderQty or quantity must be provided");
    }
  }

  /**
   * Prepare MEXC order parameters
   */
  private prepareMexcOrderParams(
    params: TradeParameters,
    currentPrice: number
  ): any {
    const mexcParams: any = {
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      timeInForce: params.timeInForce || "IOC",
    };

    // Handle different order types and quantity specifications
    if (params.quoteOrderQty && params.type === "MARKET") {
      if (params.side === "BUY") {
        // For market buy orders with quoteOrderQty, calculate quantity
        mexcParams.quantity = (params.quoteOrderQty / currentPrice).toString();
      } else {
        // For sell orders, quantity should be provided directly
        if (!params.quantity) {
          throw new Error("Quantity required for SELL orders");
        }
        mexcParams.quantity = params.quantity.toString();
      }
    } else if (params.quantity) {
      mexcParams.quantity = params.quantity.toString();
    }

    if (params.price) {
      mexcParams.price = params.price.toString();
    }

    return mexcParams;
  }

  /**
   * Execute order with retry logic and exponential backoff
   */
  private async executeOrderWithRetry(
    orderParams: any
  ): Promise<ServiceResponse<any>> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries!; attempt++) {
      try {
        const result = await this.config.mexcService.placeOrder(orderParams);

        if (result.success) {
          return ServiceResponseUtils.success(result.data);
        } else {
          throw new Error(result.error || "Order execution failed");
        }
      } catch (error) {
        lastError = toSafeError(error);

        this.config.logger.warn(
          `Order attempt ${attempt}/${this.config.maxRetries} failed`,
          {
            symbol: orderParams.symbol,
            error: lastError.message,
          }
        );

        // Don't retry on certain errors
        if (this.isNonRetryableError(lastError)) {
          throw lastError;
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.config.maxRetries!) {
          const delay = Math.min(
            this.config.retryDelay! * 2 ** (attempt - 1),
            5000
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error("Order execution failed after all retries");
  }

  /**
   * Check if error should not be retried
   */
  private isNonRetryableError(error: Error): boolean {
    const nonRetryableMessages = [
      "insufficient balance",
      "invalid symbol",
      "trading disabled",
      "MARKET_LOT_SIZE",
      "MIN_NOTIONAL",
    ];

    return nonRetryableMessages.some((message) =>
      error.message.toLowerCase().includes(message.toLowerCase())
    );
  }

  /**
   * Format the trade result in a consistent structure
   */
  private formatTradeResult(
    orderResult: any,
    params: TradeParameters,
    currentPrice: number,
    startTime: number
  ): TradeResult {
    return {
      success: true,
      data: {
        orderId: orderResult.orderId?.toString() || orderResult.id?.toString(),
        clientOrderId: orderResult.clientOrderId,
        symbol: orderResult.symbol || params.symbol,
        side: orderResult.side || params.side,
        type: orderResult.type || params.type,
        quantity: orderResult.origQty || orderResult.quantity,
        price: orderResult.price || currentPrice.toString(),
        status: orderResult.status || "FILLED",
        executedQty: orderResult.executedQty || orderResult.quantity,
        cummulativeQuoteQty: orderResult.cummulativeQuoteQty,
        timestamp: new Date(
          orderResult.transactTime || Date.now()
        ).toISOString(),
        autoSnipe: params.isAutoSnipe || false,
        confidenceScore: params.confidenceScore,
      },
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Calculate position PnL
   */
  static calculatePnL(
    entryPrice: number,
    exitPrice: number,
    quantity: number,
    side: "BUY" | "SELL"
  ): number {
    const entryValue = entryPrice * quantity;
    const exitValue = exitPrice * quantity;

    return side === "BUY" ? exitValue - entryValue : entryValue - exitValue;
  }
}
