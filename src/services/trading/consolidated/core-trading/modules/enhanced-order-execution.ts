/**
 * Enhanced Order Execution Module
 *
 * Handles order execution, retry logic, and trade execution for auto-sniping.
 * Extracted from auto-sniping.ts for better modularity.
 */

import type {
  AutoSnipeTarget,
  ModuleContext,
  ServiceResponse,
  TradeParameters,
  TradeResult,
} from "../auto-sniping-types";
import { MarketDataModule } from "./market-data";
import { ValidationModule } from "./validation";

export class EnhancedOrderExecutionModule {
  private context: ModuleContext;
  private marketData: MarketDataModule;
  private validation: ValidationModule;

  constructor(context: ModuleContext) {
    this.context = context;
    this.marketData = new MarketDataModule(context);
    this.validation = new ValidationModule(context);
  }

  /**
   * Execute a snipe target with comprehensive validation and error handling
   */
  async executeSnipeTarget(target: AutoSnipeTarget): Promise<TradeResult> {
    const startTime = Date.now();

    try {
      this.context.logger.info(`Executing snipe target: ${target.symbolName}`, {
        confidence: target.confidenceScore,
        amount: target.positionSizeUsdt,
        strategy: target.entryStrategy || "normal",
      });

      // Convert target to trade parameters
      const tradeParams = this.convertTargetToTradeParams(target);

      // Execute the trade
      const result = await this.executeTrade(tradeParams);

      this.context.logger.info(
        `Snipe target executed successfully: ${target.symbolName}`,
        {
          orderId: result.data?.orderId,
          executedQty: result.data?.executedQty,
          executionTime: Date.now() - startTime,
        }
      );

      return result;
    } catch (error) {
      const safeError =
        error instanceof Error ? error : new Error(String(error));
      this.context.logger.error(
        `Snipe target execution failed: ${target.symbolName}`,
        {
          error: safeError.message,
          executionTime: Date.now() - startTime,
        }
      );

      return {
        success: false,
        error: safeError.message,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute trade with comprehensive validation and retry logic
   */
  async executeTrade(params: TradeParameters): Promise<TradeResult> {
    const startTime = Date.now();

    try {
      // Determine execution mode
      if (this.context.config.enablePaperTrading) {
        return await this.executePaperTrade(params);
      } else {
        return await this.executeRealTrade(params);
      }
    } catch (error) {
      const safeError =
        error instanceof Error ? error : new Error(String(error));

      return {
        success: false,
        error: safeError.message,
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute paper trade (simulation)
   */
  private async executePaperTrade(
    params: TradeParameters
  ): Promise<TradeResult> {
    const startTime = Date.now();

    // Get current market price for realistic simulation
    const currentPrice = await this.marketData.getCurrentMarketPrice(
      params.symbol
    );
    const simulatedPrice = currentPrice || 100 + Math.random() * 1000;

    // Simulate some execution delay
    await new Promise((resolve) =>
      setTimeout(resolve, 100 + Math.random() * 200)
    );

    const orderId = `paper-snipe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const quantity = params.quoteOrderQty
      ? (params.quoteOrderQty / simulatedPrice).toString()
      : params.quantity || "0";

    return {
      success: true,
      data: {
        orderId,
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        quantity,
        price: simulatedPrice.toString(),
        status: "FILLED",
        executedQty: quantity,
        timestamp: new Date().toISOString(),
        paperTrade: true,
        simulatedPrice,
        autoSnipe: true,
        confidenceScore: params.confidenceScore,
      },
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Execute real trade with validation and safety checks
   */
  private async executeRealTrade(
    params: TradeParameters
  ): Promise<TradeResult> {
    const startTime = Date.now();

    try {
      // Enhanced safety checks before trading
      await this.validation.performPreTradeValidation(params);

      // Get current market price for validation
      const currentPrice = await this.marketData.getCurrentMarketPrice(
        params.symbol
      );
      if (!currentPrice) {
        throw new Error(`Unable to get current price for ${params.symbol}`);
      }

      // Validate order parameters
      await this.validation.validateOrderParameters(params, currentPrice);

      // Validate market conditions
      const marketConditions = await this.validation.validateMarketConditions(
        params.symbol,
        params
      );
      if (!marketConditions.isValid) {
        throw new Error(
          `Market validation failed: ${marketConditions.issues.join(", ")}`
        );
      }

      // Log warnings if any
      if (marketConditions.warnings.length > 0) {
        this.context.logger.warn("Market condition warnings", {
          symbol: params.symbol,
          warnings: marketConditions.warnings,
        });
      }

      // Prepare order for execution
      const orderData = await this.prepareOrderData(params, currentPrice);

      // Execute order with retry logic
      const orderResult = await this.executeOrderWithRetry(orderData);

      if (!orderResult.success || !orderResult.data) {
        throw new Error(orderResult.error || "Order execution failed");
      }

      // Create successful trade result
      const result: TradeResult = {
        success: true,
        data: {
          orderId: orderResult.data.orderId.toString(),
          clientOrderId: orderResult.data.clientOrderId,
          symbol: orderResult.data.symbol,
          side: orderResult.data.side,
          type: orderResult.data.type,
          quantity: orderResult.data.origQty,
          price: orderResult.data.price || currentPrice.toString(),
          status: orderResult.data.status,
          executedQty: orderResult.data.executedQty,
          cummulativeQuoteQty: orderResult.data.cummulativeQuoteQty,
          timestamp: new Date(
            orderResult.data.transactTime || Date.now()
          ).toISOString(),
          autoSnipe: true,
          confidenceScore: params.confidenceScore,
        },
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      this.context.logger.info("Real trade executed successfully", {
        orderId: result.data?.orderId,
        symbol: params.symbol,
        executedQty: result.data?.executedQty,
        entryPrice: result.data?.price,
      });

      return result;
    } catch (error) {
      const safeError =
        error instanceof Error ? error : new Error(String(error));
      this.context.logger.error("Real trade execution failed", {
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
   * Prepare order data for MEXC API
   */
  private async prepareOrderData(
    params: TradeParameters,
    currentPrice: number
  ): Promise<any> {
    const orderData: any = {
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      timeInForce: params.timeInForce || "IOC",
    };

    // Handle different order types
    if (params.type === "MARKET") {
      if (params.quoteOrderQty && params.side === "BUY") {
        // For market buy orders with quoteOrderQty, calculate quantity
        orderData.quantity = (params.quoteOrderQty / currentPrice).toString();
      } else if (params.quantity) {
        orderData.quantity = params.quantity.toString();
      } else {
        throw new Error("Either quantity or quoteOrderQty must be provided");
      }
    } else if (params.type === "LIMIT") {
      if (!params.price) {
        throw new Error("Price is required for limit orders");
      }
      orderData.price = params.price.toString();
      orderData.quantity =
        params.quantity?.toString() ||
        (params.quoteOrderQty
          ? (params.quoteOrderQty / params.price).toString()
          : "");

      if (!orderData.quantity) {
        throw new Error("Quantity must be specified for limit orders");
      }
    }

    // Add client order ID for tracking
    orderData.newClientOrderId = `auto-snipe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return orderData;
  }

  /**
   * Execute order with retry logic and exponential backoff
   */
  async executeOrderWithRetry(
    orderData: any,
    maxRetries: number = 3
  ): Promise<ServiceResponse<any>> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.context.logger.debug(
          `Order execution attempt ${attempt}/${maxRetries}`,
          {
            symbol: orderData.symbol,
            side: orderData.side,
            type: orderData.type,
          }
        );

        const result = await this.context.mexcService.placeOrder(orderData);

        if (result.success) {
          this.context.logger.info("Order executed successfully", {
            orderId: result.data?.orderId,
            symbol: orderData.symbol,
            attempt,
          });

          return {
            success: true,
            data: result.data,
            timestamp: new Date().toISOString(),
          };
        } else {
          throw new Error(result.error || "Order execution failed");
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        this.context.logger.warn(
          `Order attempt ${attempt}/${maxRetries} failed`,
          {
            symbol: orderData.symbol,
            error: lastError.message,
          }
        );

        // Check if error is retryable
        if (!this.isRetryableError(lastError)) {
          this.context.logger.error("Non-retryable error encountered", {
            symbol: orderData.symbol,
            error: lastError.message,
          });
          throw lastError;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * 2 ** (attempt - 1), 5000);
          this.context.logger.debug(`Waiting ${delay}ms before retry`, {
            symbol: orderData.symbol,
            attempt,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    this.context.logger.error("Order execution failed after all retries", {
      symbol: orderData.symbol,
      maxRetries,
      finalError: lastError?.message,
    });

    throw lastError || new Error("Order execution failed after all retries");
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Non-retryable errors
    const nonRetryableErrors = [
      "insufficient balance",
      "invalid symbol",
      "trading disabled",
      "market_lot_size",
      "min_notional",
      "max_position",
      "signature verification failed",
      "api key",
      "unauthorized",
      "forbidden",
    ];

    return !nonRetryableErrors.some((errorType) => message.includes(errorType));
  }

  /**
   * Convert AutoSnipeTarget to TradeParameters
   */
  private convertTargetToTradeParams(target: AutoSnipeTarget): TradeParameters {
    return {
      symbol: target.symbolName,
      side: "BUY", // Assuming auto-snipe is always buying
      type: "MARKET", // Default to market orders for sniping
      quoteOrderQty: target.positionSizeUsdt,
      timeInForce: "IOC",
      confidenceScore: target.confidenceScore,
      stopLossPercent:
        target.riskLevel === "high" ? 5 : target.riskLevel === "medium" ? 3 : 2,
      takeProfitPercent: target.takeProfitLevel || 10,
      strategy: target.entryStrategy || "auto-snipe",
    };
  }

  /**
   * Calculate optimal order parameters based on market conditions
   */
  async calculateOptimalOrderParams(
    symbol: string,
    side: "BUY" | "SELL",
    targetAmount: number
  ): Promise<{
    recommendedType: "MARKET" | "LIMIT";
    recommendedPrice?: number;
    priceImpact?: number;
    estimatedSlippage?: number;
  }> {
    try {
      // Get market data
      const marketData = await this.marketData.getMarketDataSummary(symbol);
      const orderBook = await this.marketData.getOrderBookDepth(symbol);

      if (!marketData.price || !orderBook) {
        return { recommendedType: "MARKET" };
      }

      // Calculate price impact for market order
      const quantity = targetAmount / marketData.price;
      const priceImpact = await this.marketData.calculatePriceImpact(
        symbol,
        side,
        quantity
      );

      if (!priceImpact) {
        return { recommendedType: "MARKET" };
      }

      // If price impact is low, use market order
      if (priceImpact.priceImpact < 0.5) {
        // Less than 0.5% impact
        return {
          recommendedType: "MARKET",
          priceImpact: priceImpact.priceImpact,
          estimatedSlippage: priceImpact.priceImpact,
        };
      }

      // If price impact is high, suggest limit order
      const recommendedPrice =
        side === "BUY"
          ? orderBook.midPrice * 1.001 // Slightly above mid price
          : orderBook.midPrice * 0.999; // Slightly below mid price

      return {
        recommendedType: "LIMIT",
        recommendedPrice,
        priceImpact: priceImpact.priceImpact,
        estimatedSlippage: 0.1, // Estimate lower slippage with limit order
      };
    } catch (error) {
      this.context.logger.warn("Failed to calculate optimal order parameters", {
        symbol,
        error: error instanceof Error ? error.message : String(error),
      });

      return { recommendedType: "MARKET" };
    }
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    averageExecutionTime: number;
    successRate: number;
  } {
    // This would be tracked by the module
    // For now, return placeholder data
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      successRate: 0,
    };
  }
}
