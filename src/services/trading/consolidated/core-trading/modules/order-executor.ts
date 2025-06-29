/**
 * Order Executor Module
 *
 * Handles different types of order execution (paper trading, real trading).
 * Extracted from auto-sniping.ts for better separation of concerns.
 */

import { toSafeError } from "@/src/lib/error-type-utils";
import type { TradingOrderData } from "@/src/services/api/unified-mexc-trading";
import type {
  ModuleContext,
  Position,
  TradeParameters,
  TradeResult,
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

      if (!this.context.manualTradingModule) {
        throw new Error("Manual trading module not available");
      }
      
      const result = await this.context.manualTradingModule.executeTrade(params);
      
      this.context.logger.info("Manual trade execution completed", {
        success: result.success,
        orderId: result.data?.orderId,
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
          data: {
            orderId: simulatedOrderId,
            symbol: params.symbol,
            side: params.side,
            type: params.type || "MARKET",
            quantity: params.quantity?.toString() || "0",
            price: simulatedFillPrice.toString(),
            status: "FILLED",
            executedQty: params.quantity?.toString() || "0",
            timestamp: new Date().toISOString(),
            paperTrade: true,
            simulatedPrice: simulatedFillPrice,
          },
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
        orderId: result.data?.orderId,
        executedPrice: result.data?.price,
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
    const balance = await this.context.mexcService.getAccountBalance();
    if (!balance.success) {
      throw new Error("Failed to fetch account balance");
    }

    // Check if we have sufficient balance
    const requiredBalance = (params.quantity || 0) * (params.price || 0);
    const assetToCheck = params.side === "BUY" ? "USDT" : params.symbol.replace("USDT", "");
    // balance.data is already an array of balance entries
    const balanceEntry = Array.isArray(balance.data) ? balance.data.find(
      (b: any) => b.asset === assetToCheck
    ) : null;
    const availableBalance = parseFloat(balanceEntry?.free || "0");

    if (availableBalance < requiredBalance) {
      throw new Error(`Insufficient balance. Required: ${requiredBalance}, Available: ${availableBalance}`);
    }

    // Check symbol trading status
    const symbolInfo = await this.context.mexcService.getSymbolInfoBasic(params.symbol);
    if (!symbolInfo.success) {
      throw new Error(`Failed to get symbol info for ${params.symbol}`);
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
    const symbolInfo = await this.context.mexcService.getSymbolInfoBasic(params.symbol);
    if (!symbolInfo.success || !symbolInfo.data) {
      throw new Error(`Failed to get symbol info for ${params.symbol}`);
    }

    // Note: Basic symbol info may not have detailed filters, so we'll use basic validation
    
    // Basic validation since we don't have detailed filter info
    if (params.quantity && params.quantity <= 0) {
      throw new Error(`Invalid quantity: ${params.quantity}`);
    }
    
    if (params.price && params.price <= 0) {
      throw new Error(`Invalid price: ${params.price}`);
    }

    // Basic notional value validation
    if (params.price && params.quantity) {
      const notionalValue = params.quantity * params.price;
      if (notionalValue < 10) { // Basic minimum of $10 USD equivalent
        throw new Error(`Order value too small: ${notionalValue}`);
      }
    }
  }

  /**
   * Execute order with retry logic
   */
  private async executeOrderWithRetry(params: TradeParameters): Promise<TradeResult> {
    const maxRetries = this.context.config.maxRetries || 3;
    const retryDelay = 1000; // Fixed retry delay

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.context.logger.info(`Order execution attempt ${attempt}/${maxRetries}`, {
          symbol: params.symbol,
          side: params.side,
          quantity: params.quantity,
        });

        const orderData: TradingOrderData = {
          symbol: params.symbol,
          side: params.side.toUpperCase() as "BUY" | "SELL",
          type: (params.type === "MARKET" || params.type === "LIMIT") ? params.type : "MARKET",
          quantity: params.quantity?.toString() || "0",
          price: params.price?.toString(),
          timeInForce: params.timeInForce,
        };

        const orderResult = await this.context.mexcService.placeOrder(orderData);

        if (orderResult.success && orderResult.data) {
          return {
            success: true,
            data: {
              orderId: orderResult.data.orderId || "",
              symbol: params.symbol,
              side: params.side,
              type: orderResult.data.type || params.type || "MARKET",
              quantity: orderResult.data.quantity || params.quantity?.toString() || "0",
              price: orderResult.data.price || params.price?.toString() || "0",
              status: orderResult.data.status || "FILLED",
              executedQty: orderResult.data.executedQty || params.quantity?.toString() || "0",
              timestamp: new Date().toISOString(),
            },
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
      const ticker = await this.context.mexcService.getTicker(symbol);
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
      id: result.data?.orderId || `pos_${Date.now()}`,
      symbol: params.symbol,
      side: params.side,
      orderId: result.data?.orderId || "",
      quantity: parseFloat(result.data?.executedQty || "0") || params.quantity || 0,
      entryPrice: parseFloat(result.data?.price || "0") || params.price || 0,
      currentPrice: parseFloat(result.data?.price || "0") || params.price || 0,
      timestamp: new Date().toISOString(),
      unrealizedPnL: 0,
      realizedPnL: 0,
      stopLossPercent: params.stopLossPercent,
      takeProfitPercent: params.takeProfitPercent,
      status: "open",
      openTime: new Date(),
      strategy: params.strategy || "manual",
      tags: [],
      fees: 0, // Fees would be calculated separately
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