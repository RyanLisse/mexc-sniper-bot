/**
 * Order Executor Module
 *
 * Handles different types of order execution (paper trading, real trading).
 * Extracted from auto-sniping.ts for better separation of concerns.
 */

import { toSafeError } from "@/src/lib/error-type-utils";
import type {
  ModuleContext,
  TradeParameters,
  TradeResult,
  Position,
} from "../types";

export class OrderExecutor {
  private context: ModuleContext;

  constructor(context: ModuleContext) {
    this.context = context;
  }

  /**
   * Execute trade via manual trading module
   */
  async executeTradeViaManualModule(params: TradeParameters): Promise<TradeResult> {
    try {
      this.context.logger.info("Executing trade via manual module", {
        symbol: params.symbol,
        side: params.side,
        quantity: params.quantity,
      });

      const result = await this.context.manualTradingModule.executeTrade(params);
      
      this.context.logger.info("Manual trade execution completed", {
        success: result.success,
        orderId: result.orderId,
      });

      return result;
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Manual trade execution failed", {
        params,
        error: safeError,
      });

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute paper trading (simulation)
   */
  async executePaperSnipe(params: TradeParameters): Promise<TradeResult> {
    try {
      this.context.logger.info("Executing paper snipe", {
        symbol: params.symbol,
        side: params.side,
        quantity: params.quantity,
        price: params.price,
      });

      // Simulate execution delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));

      // Simulate success/failure based on market conditions
      const simulatedSuccess = Math.random() > 0.1; // 90% success rate for paper trading
      
      if (simulatedSuccess) {
        const simulatedOrderId = `paper_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const simulatedFillPrice = params.price ? 
          params.price * (0.999 + Math.random() * 0.002) : // ±0.1% slippage
          100 * (1 + Math.random() * 0.1); // Random price if none provided

        return {
          success: true,
          orderId: simulatedOrderId,
          executedPrice: simulatedFillPrice,
          executedQuantity: params.quantity,
          fees: simulatedFillPrice * params.quantity * 0.001, // 0.1% fee
          timestamp: new Date().toISOString(),
        };
      } else {
        return {
          success: false,
          error: "Simulated market rejection",
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Paper snipe execution failed", {
        params,
        error: safeError,
      });

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute real trading order
   */
  async executeRealSnipe(params: TradeParameters): Promise<TradeResult> {
    try {
      this.context.logger.info("Executing real snipe order", {
        symbol: params.symbol,
        side: params.side,
        quantity: params.quantity,
        type: params.type,
      });

      // Perform pre-trade validation
      await this.performPreTradeValidation(params);

      // Validate order parameters
      await this.validateOrderParameters(params);

      // Execute order with retry logic
      const result = await this.executeOrderWithRetry(params);

      this.context.logger.info("Real snipe execution completed", {
        success: result.success,
        orderId: result.orderId,
        executedPrice: result.executedPrice,
      });

      return result;
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Real snipe execution failed", {
        params,
        error: safeError,
      });

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Perform pre-trade validation
   */
  private async performPreTradeValidation(params: TradeParameters): Promise<void> {
    // Check account balance
    const balance = await this.context.mexcClient.getAccountBalance();
    if (!balance.success) {
      throw new Error("Failed to fetch account balance");
    }

    // Check if we have sufficient balance
    const requiredBalance = params.quantity * (params.price || 0);
    const availableBalance = balance.data?.balances?.find(
      b => b.asset === params.side === "buy" ? "USDT" : params.symbol.replace("USDT", "")
    )?.free || 0;

    if (availableBalance < requiredBalance) {
      throw new Error(`Insufficient balance. Required: ${requiredBalance}, Available: ${availableBalance}`);
    }

    // Check symbol trading status
    const symbolInfo = await this.context.mexcClient.getSymbolInfo(params.symbol);
    if (!symbolInfo.success || symbolInfo.data?.status !== "TRADING") {
      throw new Error(`Symbol ${params.symbol} is not available for trading`);
    }

    // Check market data availability
    const currentPrice = await this.getCurrentMarketPrice(params.symbol);
    if (!currentPrice) {
      throw new Error(`Unable to get current market price for ${params.symbol}`);
    }

    // Validate price is within reasonable bounds
    if (params.price) {
      const priceDiff = Math.abs(params.price - currentPrice) / currentPrice;
      if (priceDiff > 0.05) { // 5% price difference threshold
        this.context.logger.warn("Order price significantly different from market price", {
          orderPrice: params.price,
          marketPrice: currentPrice,
          difference: priceDiff,
        });
      }
    }
  }

  /**
   * Validate order parameters
   */
  private async validateOrderParameters(params: TradeParameters): Promise<void> {
    // Get symbol trading rules
    const symbolInfo = await this.context.mexcClient.getSymbolInfo(params.symbol);
    if (!symbolInfo.success || !symbolInfo.data) {
      throw new Error(`Failed to get symbol info for ${params.symbol}`);
    }

    const filters = symbolInfo.data.filters || [];

    // Validate quantity precision and limits
    const lotSizeFilter = filters.find(f => f.filterType === "LOT_SIZE");
    if (lotSizeFilter) {
      const minQty = parseFloat(lotSizeFilter.minQty || "0");
      const maxQty = parseFloat(lotSizeFilter.maxQty || "0");
      const stepSize = parseFloat(lotSizeFilter.stepSize || "0");

      if (params.quantity < minQty) {
        throw new Error(`Quantity ${params.quantity} below minimum ${minQty}`);
      }
      if (maxQty > 0 && params.quantity > maxQty) {
        throw new Error(`Quantity ${params.quantity} above maximum ${maxQty}`);
      }
      if (stepSize > 0) {
        const remainder = (params.quantity - minQty) % stepSize;
        if (remainder !== 0) {
          throw new Error(`Quantity ${params.quantity} not valid increment of ${stepSize}`);
        }
      }
    }

    // Validate price precision and limits
    if (params.price) {
      const priceFilter = filters.find(f => f.filterType === "PRICE_FILTER");
      if (priceFilter) {
        const minPrice = parseFloat(priceFilter.minPrice || "0");
        const maxPrice = parseFloat(priceFilter.maxPrice || "0");
        const tickSize = parseFloat(priceFilter.tickSize || "0");

        if (params.price < minPrice) {
          throw new Error(`Price ${params.price} below minimum ${minPrice}`);
        }
        if (maxPrice > 0 && params.price > maxPrice) {
          throw new Error(`Price ${params.price} above maximum ${maxPrice}`);
        }
        if (tickSize > 0) {
          const remainder = (params.price - minPrice) % tickSize;
          if (remainder !== 0) {
            throw new Error(`Price ${params.price} not valid increment of ${tickSize}`);
          }
        }
      }
    }

    // Validate notional value
    const notionalFilter = filters.find(f => f.filterType === "MIN_NOTIONAL");
    if (notionalFilter && params.price) {
      const minNotional = parseFloat(notionalFilter.minNotional || "0");
      const notionalValue = params.quantity * params.price;
      if (notionalValue < minNotional) {
        throw new Error(`Order notional ${notionalValue} below minimum ${minNotional}`);
      }
    }
  }

  /**
   * Execute order with retry logic
   */
  private async executeOrderWithRetry(params: TradeParameters): Promise<TradeResult> {
    const maxRetries = this.context.config.orderExecution?.maxRetries || 3;
    const retryDelay = this.context.config.orderExecution?.retryDelay || 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.context.logger.info(`Order execution attempt ${attempt}/${maxRetries}`, {
          symbol: params.symbol,
          side: params.side,
          quantity: params.quantity,
        });

        const orderResult = await this.context.mexcClient.createOrder({
          symbol: params.symbol,
          side: params.side,
          type: params.type || "MARKET",
          quantity: params.quantity,
          price: params.price,
          timeInForce: params.timeInForce,
        });

        if (orderResult.success && orderResult.data) {
          return {
            success: true,
            orderId: orderResult.data.orderId,
            executedPrice: orderResult.data.price,
            executedQuantity: orderResult.data.executedQty || params.quantity,
            fees: orderResult.data.cummulativeQuoteQty * 0.001, // Estimate fees
            timestamp: new Date().toISOString(),
          };
        } else {
          throw new Error(orderResult.error || "Order execution failed");
        }
      } catch (error) {
        const safeError = toSafeError(error);
        
        if (attempt === maxRetries) {
          this.context.logger.error("Order execution failed after all retries", {
            params,
            attempt,
            error: safeError,
          });
          throw error;
        }

        this.context.logger.warn(`Order execution attempt ${attempt} failed, retrying...`, {
          params,
          error: safeError,
          nextAttemptIn: retryDelay,
        });

        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    throw new Error("Order execution failed after all retries");
  }

  /**
   * Get current market price for a symbol
   */
  private async getCurrentMarketPrice(symbol: string): Promise<number | null> {
    try {
      const ticker = await this.context.mexcClient.getTickerPrice(symbol);
      return ticker.success && ticker.data ? parseFloat(ticker.data.price) : null;
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to get current market price", {
        symbol,
        error: safeError,
      });
      return null;
    }
  }

  /**
   * Create position entry after successful trade
   */
  async createPositionEntry(
    params: TradeParameters,
    result: TradeResult
  ): Promise<Position> {
    const position: Position = {
      id: result.orderId || `pos_${Date.now()}`,
      symbol: params.symbol,
      side: params.side,
      quantity: result.executedQuantity || params.quantity,
      entryPrice: result.executedPrice || params.price || 0,
      currentPrice: result.executedPrice || params.price || 0,
      unrealizedPnl: 0,
      realizedPnl: 0,
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
      status: "open",
      openTime: new Date().toISOString(),
      fees: result.fees || 0,
    };

    this.context.logger.info("Position entry created", {
      positionId: position.id,
      symbol: position.symbol,
      side: position.side,
      quantity: position.quantity,
      entryPrice: position.entryPrice,
    });

    return position;
  }
}