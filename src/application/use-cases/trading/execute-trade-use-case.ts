/**
 * Execute Trade Use Case
 * Handles the execution of a trade order with proper domain logic
 */

import { z } from "zod";
import type {
  NotificationService,
  TradingRepository,
  TradingService,
} from "@/src/application/interfaces/trading-repository";
import type { Trade } from "@/src/domain/entities/trading/trade";
import {
  BusinessRuleViolationError,
  DomainValidationError,
  InvalidOrderStateError,
  InvalidTradeParametersError,
} from "@/src/domain/errors/trading-errors";
import { Money } from "@/src/domain/value-objects/trading/money";
import {
  Order,
  OrderSide,
  OrderStatus,
  OrderType,
  TimeInForce,
} from "@/src/domain/value-objects/trading/order";
import { Price } from "@/src/domain/value-objects/trading/price";
import { toSafeError } from "@/src/lib/error-type-utils";

// Input validation schema
const ExecuteTradeInputSchema = z.object({
  tradeId: z.string().min(1, "Trade ID is required"),
  symbol: z.string().min(1, "Symbol is required"),
  side: z.enum(["BUY", "SELL"]),
  type: z.enum(["MARKET", "LIMIT", "STOP_LIMIT"]),
  quantity: z.number().positive().optional(),
  quoteOrderQty: z.number().positive().optional(),
  price: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  timeInForce: z.enum(["GTC", "IOC", "FOK"]).default("IOC"),
  strategy: z.string().optional(),
  confidenceScore: z.number().min(0).max(100).optional(),
  paperTrade: z.boolean().default(false),
  clientOrderId: z.string().optional(),
});

export type ExecuteTradeInput = z.infer<typeof ExecuteTradeInputSchema>;

export interface ExecuteTradeOutput {
  success: boolean;
  trade?: Trade;
  order?: Order;
  executionTime?: number;
  error?: string;
  timestamp: string;
}

export class ExecuteTradeUseCase {
  constructor(
    private readonly tradingRepository: TradingRepository,
    private readonly tradingService: TradingService,
    private readonly notificationService: NotificationService,
    private readonly logger: {
      info: (message: string, context?: any) => void;
      warn: (message: string, context?: any) => void;
      error: (message: string, context?: any) => void;
      debug: (message: string, context?: any) => void;
    }
  ) {}

  async execute(input: ExecuteTradeInput): Promise<ExecuteTradeOutput> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      // Validate input
      const validatedInput = this.validateInput(input);

      // Get existing trade
      const trade = await this.getTrade(validatedInput.tradeId);

      // Validate trade state and business rules
      await this.validateTradeExecution(trade, validatedInput);

      // Create order entity
      const order = this.createOrderEntity(trade, validatedInput);

      // Add order to trade
      const tradeWithOrder = trade.addOrder(order);

      // Execute trade through trading service
      const executionResult =
        await this.executeThroughTradingService(validatedInput);

      // Update order with execution results
      const updatedOrder = this.updateOrderWithResults(order, executionResult);

      // Update trade with execution results
      const updatedTrade = await this.updateTradeWithResults(
        tradeWithOrder,
        updatedOrder,
        executionResult
      );

      // Save updated trade
      const finalTrade = await this.tradingRepository.updateTrade(updatedTrade);

      // Send notifications
      if (executionResult.success) {
        await this.notificationService.notifyTradeExecution(finalTrade);
      } else {
        await this.notificationService.notifyTradeFailure(
          finalTrade,
          executionResult.error || "Unknown error"
        );
      }

      const executionTime = Date.now() - startTime;

      this.logger.info("Trade executed", {
        tradeId: finalTrade.id,
        orderId: updatedOrder.id,
        symbol: validatedInput.symbol,
        side: validatedInput.side,
        success: executionResult.success,
        executionTime,
      });

      return {
        success: executionResult.success,
        trade: finalTrade,
        order: updatedOrder,
        executionTime,
        error: executionResult.error,
        timestamp,
      };
    } catch (error) {
      const safeError = toSafeError(error);
      const executionTime = Date.now() - startTime;

      this.logger.error("Trade execution failed", {
        input,
        error: safeError,
        executionTime,
        timestamp,
      });

      return {
        success: false,
        error: safeError.message,
        executionTime,
        timestamp,
      };
    }
  }

  private validateInput(input: ExecuteTradeInput): ExecuteTradeInput {
    const result = ExecuteTradeInputSchema.safeParse(input);

    if (!result.success) {
      const firstError = result.error.errors[0];
      throw new DomainValidationError(
        firstError.path.join("."),
        input,
        firstError.message
      );
    }

    // Additional validation rules
    if (!result.data.quantity && !result.data.quoteOrderQty) {
      throw new DomainValidationError(
        "quantity",
        input,
        "Either quantity or quoteOrderQty must be provided"
      );
    }

    if (result.data.type === "LIMIT" && !result.data.price) {
      throw new DomainValidationError(
        "price",
        input,
        "Price is required for LIMIT orders"
      );
    }

    if (result.data.type === "STOP_LIMIT" && !result.data.stopPrice) {
      throw new DomainValidationError(
        "stopPrice",
        input,
        "Stop price is required for STOP_LIMIT orders"
      );
    }

    return result.data;
  }

  private async getTrade(tradeId: string): Promise<Trade> {
    const trade = await this.tradingRepository.findTradeById(tradeId);

    if (!trade) {
      throw new InvalidTradeParametersError(
        "tradeId",
        `Trade not found: ${tradeId}`
      );
    }

    return trade;
  }

  private async validateTradeExecution(
    trade: Trade,
    input: ExecuteTradeInput
  ): Promise<void> {
    // Check trade status
    if (trade.isFinalized()) {
      throw new InvalidOrderStateError(trade.status, "execute trade");
    }

    // Validate symbol matches
    if (trade.symbol !== input.symbol.toUpperCase()) {
      throw new BusinessRuleViolationError(
        `Symbol mismatch: trade symbol ${trade.symbol} vs input symbol ${input.symbol}`,
        `Trade: ${trade.id}`
      );
    }

    // Check if trading is allowed
    const canTrade = await this.tradingService.canTrade(input.symbol);
    if (!canTrade) {
      throw new BusinessRuleViolationError(
        `Trading not allowed for symbol ${input.symbol}`,
        `Trade: ${trade.id}`
      );
    }

    // Check for paper trading consistency
    if (trade.paperTrade !== input.paperTrade) {
      throw new BusinessRuleViolationError(
        `Paper trading mode mismatch: trade=${trade.paperTrade}, input=${input.paperTrade}`,
        `Trade: ${trade.id}`
      );
    }
  }

  private createOrderEntity(trade: Trade, input: ExecuteTradeInput): Order {
    return Order.create({
      symbol: input.symbol.toUpperCase(),
      side: input.side === "BUY" ? OrderSide.BUY : OrderSide.SELL,
      type: this.mapOrderType(input.type),
      status: OrderStatus.PENDING,
      quantity: input.quantity,
      quoteOrderQty: input.quoteOrderQty,
      price: input.price,
      stopPrice: input.stopPrice,
      timeInForce: this.mapTimeInForce(input.timeInForce),
      clientOrderId: input.clientOrderId,
      strategy: input.strategy || trade.strategy,
      isAutoSnipe: trade.isAutoSnipe,
      confidenceScore: input.confidenceScore || trade.confidenceScore,
      paperTrade: input.paperTrade,
    });
  }

  private mapOrderType(type: string): OrderType {
    switch (type) {
      case "MARKET":
        return OrderType.MARKET;
      case "LIMIT":
        return OrderType.LIMIT;
      case "STOP_LIMIT":
        return OrderType.STOP_LIMIT;
      default:
        return OrderType.MARKET;
    }
  }

  private mapTimeInForce(timeInForce: string): TimeInForce {
    switch (timeInForce) {
      case "GTC":
        return TimeInForce.GTC;
      case "IOC":
        return TimeInForce.IOC;
      case "FOK":
        return TimeInForce.FOK;
      default:
        return TimeInForce.IOC;
    }
  }

  private async executeThroughTradingService(input: ExecuteTradeInput) {
    return await this.tradingService.executeTrade({
      symbol: input.symbol,
      side: input.side,
      type: input.type,
      quantity: input.quantity,
      quoteOrderQty: input.quoteOrderQty,
      price: input.price,
      stopPrice: input.stopPrice,
      timeInForce: input.timeInForce,
      isAutoSnipe: true,
      confidenceScore: input.confidenceScore,
      paperTrade: input.paperTrade,
    });
  }

  private updateOrderWithResults(order: Order, executionResult: any): Order {
    if (executionResult.success && executionResult.data) {
      const data = executionResult.data;

      if (data.status === "FILLED") {
        return order.markAsFilled(
          parseFloat(data.executedQty),
          parseFloat(data.price),
          undefined, // cumulativeQuoteQty
          undefined // fees
        );
      } else if (data.status === "PARTIALLY_FILLED") {
        return order.markAsPartiallyFilled(
          parseFloat(data.executedQty),
          parseFloat(data.price),
          undefined // fees
        );
      } else {
        return order.markAsSubmitted(data.orderId);
      }
    } else {
      return order.markAsRejected(
        executionResult.error || "Unknown execution error"
      );
    }
  }

  private async updateTradeWithResults(
    trade: Trade,
    order: Order,
    executionResult: any
  ): Promise<Trade> {
    // Update trade with order
    let updatedTrade = trade.updateOrder(order.id, order);

    if (executionResult.success && executionResult.data) {
      const data = executionResult.data;

      if (data.status === "FILLED") {
        // First, ensure trade is in executing state
        if (!updatedTrade.isExecuting()) {
          updatedTrade = updatedTrade.startExecution();
        }

        // Calculate trade completion details
        const entryPrice = Price.create(
          parseFloat(data.price),
          trade.symbol,
          "mexc",
          8
        );

        const quantity = parseFloat(data.executedQty);
        const totalCost = Money.create(
          quantity * parseFloat(data.price),
          "USDT", // Assuming USDT pairs
          8
        );

        // Complete the trade
        updatedTrade = updatedTrade.completeExecution(
          entryPrice,
          undefined, // exitPrice - will be set when position is closed
          quantity,
          totalCost,
          undefined // totalRevenue - will be set when position is closed
        );
      }
    } else {
      // Mark trade as failed
      updatedTrade = updatedTrade.markAsFailed(
        executionResult.error || "Trade execution failed"
      );
    }

    return updatedTrade;
  }

  private extractBaseCurrency(symbol: string): string {
    // Extract base currency from symbol (e.g., "BTCUSDT" -> "BTC")
    if (symbol.endsWith("USDT")) {
      return symbol.replace("USDT", "");
    }
    if (symbol.endsWith("BTC")) {
      return symbol.replace("BTC", "");
    }
    if (symbol.endsWith("ETH")) {
      return symbol.replace("ETH", "");
    }
    return symbol; // Fallback
  }

  // Helper method to validate trade execution prerequisites
  async canExecuteTrade(tradeId: string): Promise<{
    canExecute: boolean;
    reason?: string;
    trade?: Trade;
  }> {
    try {
      const trade = await this.tradingRepository.findTradeById(tradeId);

      if (!trade) {
        return {
          canExecute: false,
          reason: "Trade not found",
        };
      }

      if (trade.isFinalized()) {
        return {
          canExecute: false,
          reason: `Trade is already finalized with status: ${trade.status}`,
          trade,
        };
      }

      const canTrade = await this.tradingService.canTrade(trade.symbol);
      if (!canTrade) {
        return {
          canExecute: false,
          reason: `Trading not allowed for symbol: ${trade.symbol}`,
          trade,
        };
      }

      return {
        canExecute: true,
        trade,
      };
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        canExecute: false,
        reason: `Error checking trade eligibility: ${safeError.message}`,
      };
    }
  }
}
