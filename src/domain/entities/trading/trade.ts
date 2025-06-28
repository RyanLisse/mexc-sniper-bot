/**
 * Trade Aggregate Root
 * Represents a complete trading operation with orders and position management
 */

import { z } from "zod";
import { AggregateRoot } from "../../base/aggregate-root";
import {
  BusinessRuleViolationError,
  DomainValidationError,
  InvalidOrderStateError,
  InvalidTradeParametersError,
} from "../../errors/trading-errors";
import { TradingEventFactory } from "../../events/trading-events";
import type { Money } from "../../value-objects/trading/money";
import { type Order, OrderSide } from "../../value-objects/trading/order";
import type { Price } from "../../value-objects/trading/price";

// Trade status enumeration
export enum TradeStatus {
  PENDING = "PENDING",
  EXECUTING = "EXECUTING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

interface TradeProps {
  readonly id: string;
  readonly userId: string;
  readonly symbol: string;
  readonly status: TradeStatus;
  readonly strategy?: string;
  readonly isAutoSnipe: boolean;
  readonly confidenceScore?: number;
  readonly paperTrade: boolean;
  readonly orders: Order[];
  readonly entryPrice?: Price;
  readonly exitPrice?: Price;
  readonly quantity?: number;
  readonly totalCost?: Money;
  readonly totalRevenue?: Money;
  readonly realizedPnL?: Money;
  readonly fees?: Money;
  readonly stopLossPercent?: number;
  readonly takeProfitPercent?: number;
  readonly executionStartedAt?: Date;
  readonly executionCompletedAt?: Date;
  readonly errorMessage?: string;
  readonly notes?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// Validation schema
const TradePropsSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  symbol: z.string().min(1),
  status: z.nativeEnum(TradeStatus),
  strategy: z.string().optional(),
  isAutoSnipe: z.boolean(),
  confidenceScore: z.number().min(0).max(100).optional(),
  paperTrade: z.boolean(),
  orders: z.array(z.any()), // Order validation is handled separately
  entryPrice: z.any().optional(), // Price validation is handled separately
  exitPrice: z.any().optional(),
  quantity: z.number().positive().optional(),
  totalCost: z.any().optional(), // Money validation is handled separately
  totalRevenue: z.any().optional(),
  realizedPnL: z.any().optional(),
  fees: z.any().optional(),
  stopLossPercent: z.number().positive().max(100).optional(),
  takeProfitPercent: z.number().positive().optional(),
  executionStartedAt: z.date().optional(),
  executionCompletedAt: z.date().optional(),
  errorMessage: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export class Trade extends AggregateRoot<string> {
  private constructor(private props: TradeProps) {
    super(props.id);
  }

  static create(props: {
    userId: string;
    symbol: string;
    strategy?: string;
    isAutoSnipe?: boolean;
    confidenceScore?: number;
    paperTrade?: boolean;
    stopLossPercent?: number;
    takeProfitPercent?: number;
    notes?: string;
  }): Trade {
    const id = `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const tradeProps: TradeProps = {
      id,
      userId: props.userId,
      symbol: props.symbol.toUpperCase(),
      status: TradeStatus.PENDING,
      strategy: props.strategy,
      isAutoSnipe: props.isAutoSnipe || false,
      confidenceScore: props.confidenceScore,
      paperTrade: props.paperTrade || false,
      orders: [],
      stopLossPercent: props.stopLossPercent,
      takeProfitPercent: props.takeProfitPercent,
      notes: props.notes,
      createdAt: now,
      updatedAt: now,
    };

    const trade = Trade.createWithValidation(tradeProps);

    // Emit domain event
    trade.addDomainEvent(
      TradingEventFactory.createTradeExecutionStarted(id, props.userId, {
        symbol: props.symbol,
        side: "BUY", // Default assumption for new trades
        orderType: "MARKET",
        strategy: props.strategy,
        isAutoSnipe: props.isAutoSnipe || false,
        confidenceScore: props.confidenceScore,
      })
    );

    return trade;
  }

  static fromExisting(props: TradeProps): Trade {
    return Trade.createWithValidation(props);
  }

  private static createWithValidation(props: TradeProps): Trade {
    // Validate props
    const validationResult = TradePropsSchema.safeParse(props);
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      throw new DomainValidationError(
        firstError.path.join("."),
        "invalid value",
        firstError.message
      );
    }

    // Business rule validations
    Trade.validateBusinessRules(props);

    return new Trade(props);
  }

  private static validateBusinessRules(props: TradeProps): void {
    // Auto-snipe confidence validation
    if (props.isAutoSnipe && !props.confidenceScore) {
      throw new BusinessRuleViolationError(
        "Auto-snipe trades must have a confidence score",
        `Trade: ${props.id}`
      );
    }

    // Stop loss validation
    if (props.stopLossPercent && (props.stopLossPercent <= 0 || props.stopLossPercent >= 100)) {
      throw new BusinessRuleViolationError(
        "Stop loss percentage must be between 0 and 100",
        `Trade: ${props.id}`
      );
    }

    // Take profit validation
    if (props.takeProfitPercent && props.takeProfitPercent <= 0) {
      throw new BusinessRuleViolationError(
        "Take profit percentage must be positive",
        `Trade: ${props.id}`
      );
    }

    // Status consistency checks
    if (props.status === TradeStatus.COMPLETED && !props.executionCompletedAt) {
      throw new BusinessRuleViolationError(
        "Completed trades must have execution completion timestamp",
        `Trade: ${props.id}`
      );
    }

    if (props.status === TradeStatus.EXECUTING && !props.executionStartedAt) {
      throw new BusinessRuleViolationError(
        "Executing trades must have execution start timestamp",
        `Trade: ${props.id}`
      );
    }
  }

  // Getters
  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get symbol(): string {
    return this.props.symbol;
  }

  get status(): TradeStatus {
    return this.props.status;
  }

  get strategy(): string | undefined {
    return this.props.strategy;
  }

  get isAutoSnipe(): boolean {
    return this.props.isAutoSnipe;
  }

  get confidenceScore(): number | undefined {
    return this.props.confidenceScore;
  }

  get paperTrade(): boolean {
    return this.props.paperTrade;
  }

  get orders(): readonly Order[] {
    return this.props.orders;
  }

  get entryPrice(): Price | undefined {
    return this.props.entryPrice;
  }

  get exitPrice(): Price | undefined {
    return this.props.exitPrice;
  }

  get quantity(): number | undefined {
    return this.props.quantity;
  }

  get totalCost(): Money | undefined {
    return this.props.totalCost;
  }

  get totalRevenue(): Money | undefined {
    return this.props.totalRevenue;
  }

  get realizedPnL(): Money | undefined {
    return this.props.realizedPnL;
  }

  get fees(): Money | undefined {
    return this.props.fees;
  }

  get stopLossPercent(): number | undefined {
    return this.props.stopLossPercent;
  }

  get takeProfitPercent(): number | undefined {
    return this.props.takeProfitPercent;
  }

  get executionStartedAt(): Date | undefined {
    return this.props.executionStartedAt;
  }

  get executionCompletedAt(): Date | undefined {
    return this.props.executionCompletedAt;
  }

  get errorMessage(): string | undefined {
    return this.props.errorMessage;
  }

  get notes(): string | undefined {
    return this.props.notes;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // Business logic methods
  isPending(): boolean {
    return this.props.status === TradeStatus.PENDING;
  }

  isExecuting(): boolean {
    return this.props.status === TradeStatus.EXECUTING;
  }

  isCompleted(): boolean {
    return this.props.status === TradeStatus.COMPLETED;
  }

  isFailed(): boolean {
    return this.props.status === TradeStatus.FAILED;
  }

  isCancelled(): boolean {
    return this.props.status === TradeStatus.CANCELLED;
  }

  isFinalized(): boolean {
    return [TradeStatus.COMPLETED, TradeStatus.FAILED, TradeStatus.CANCELLED].includes(
      this.props.status
    );
  }

  hasOrders(): boolean {
    return this.props.orders.length > 0;
  }

  hasActiveOrders(): boolean {
    return this.props.orders.some((order) => order.isActive());
  }

  getBuyOrders(): Order[] {
    return this.props.orders.filter((order) => order.side === OrderSide.BUY);
  }

  getSellOrders(): Order[] {
    return this.props.orders.filter((order) => order.side === OrderSide.SELL);
  }

  getFilledOrders(): Order[] {
    return this.props.orders.filter((order) => order.isFilled());
  }

  getTotalExecutedQuantity(): number {
    return this.props.orders
      .filter((order) => order.executedQuantity)
      .reduce((total, order) => total + (order.executedQuantity || 0), 0);
  }

  calculatePnLPercentage(): number | undefined {
    if (!this.props.realizedPnL || !this.props.totalCost || this.props.totalCost.isZero()) {
      return undefined;
    }
    return (this.props.realizedPnL.amount / this.props.totalCost.amount) * 100;
  }

  getExecutionDurationMs(): number | undefined {
    if (!this.props.executionStartedAt || !this.props.executionCompletedAt) {
      return undefined;
    }
    return this.props.executionCompletedAt.getTime() - this.props.executionStartedAt.getTime();
  }

  // Command methods (return new instances)
  addOrder(order: Order): Trade {
    if (this.isFinalized()) {
      throw new InvalidOrderStateError(this.props.status, "add order");
    }

    // Validate order belongs to same symbol
    if (order.symbol !== this.props.symbol) {
      throw new InvalidTradeParametersError(
        "symbol",
        `Order symbol ${order.symbol} does not match trade symbol ${this.props.symbol}`
      );
    }

    const updatedOrders = [...this.props.orders, order];
    return this.updateProps({ orders: updatedOrders, updatedAt: new Date() });
  }

  updateOrder(orderId: string, updatedOrder: Order): Trade {
    const orderIndex = this.props.orders.findIndex((order) => order.id === orderId);
    if (orderIndex === -1) {
      throw new InvalidTradeParametersError("orderId", `Order ${orderId} not found in trade`);
    }

    const updatedOrders = [...this.props.orders];
    updatedOrders[orderIndex] = updatedOrder;

    return this.updateProps({ orders: updatedOrders, updatedAt: new Date() });
  }

  startExecution(): Trade {
    if (!this.isPending()) {
      throw new InvalidOrderStateError(this.props.status, "start execution");
    }

    const updatedTrade = this.updateProps({
      status: TradeStatus.EXECUTING,
      executionStartedAt: new Date(),
      updatedAt: new Date(),
    });

    // Emit domain event
    updatedTrade.addDomainEvent(
      TradingEventFactory.createTradeExecutionStarted(this.props.id, this.props.userId, {
        symbol: this.props.symbol,
        side: "BUY", // Simplified assumption
        orderType: "MARKET",
        strategy: this.props.strategy,
        isAutoSnipe: this.props.isAutoSnipe,
        confidenceScore: this.props.confidenceScore,
      })
    );

    return updatedTrade;
  }

  completeExecution(
    entryPrice: Price,
    exitPrice?: Price,
    quantity?: number,
    totalCost?: Money,
    totalRevenue?: Money,
    fees?: Money
  ): Trade {
    if (!this.isExecuting()) {
      throw new InvalidOrderStateError(this.props.status, "complete execution");
    }

    // Calculate PnL if we have the necessary data
    let realizedPnL: Money | undefined;
    if (totalRevenue && totalCost) {
      realizedPnL = totalRevenue.subtract(totalCost);
    }

    const updatedTrade = this.updateProps({
      status: TradeStatus.COMPLETED,
      entryPrice,
      exitPrice,
      quantity,
      totalCost,
      totalRevenue,
      realizedPnL,
      fees,
      executionCompletedAt: new Date(),
      updatedAt: new Date(),
    });

    // Emit domain event
    updatedTrade.addDomainEvent(
      TradingEventFactory.createTradeExecutionCompleted(this.props.id, this.props.userId, {
        orderId: this.props.orders[0]?.id || "unknown",
        symbol: this.props.symbol,
        side: "BUY", // Simplified
        executedQuantity: quantity?.toString() || "0",
        executedPrice: entryPrice.toFormattedString(),
        totalCost: totalCost?.amount || 0,
        fees: fees?.amount || 0,
        executionTimeMs: updatedTrade.getExecutionDurationMs() || 0,
        status: "FILLED",
      })
    );

    return updatedTrade;
  }

  markAsFailed(errorMessage: string): Trade {
    if (this.isFinalized()) {
      throw new InvalidOrderStateError(this.props.status, "mark as failed");
    }

    const updatedTrade = this.updateProps({
      status: TradeStatus.FAILED,
      errorMessage,
      executionCompletedAt: new Date(),
      updatedAt: new Date(),
    });

    // Emit domain event (trade execution failed)
    updatedTrade.addDomainEvent({
      type: "trade.execution.failed",
      aggregateId: this.props.id,
      payload: {
        userId: this.props.userId,
        symbol: this.props.symbol,
        side: "BUY", // Simplified
        reason: errorMessage,
      },
      occurredAt: new Date(),
      eventId: `trade-failed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    });

    return updatedTrade;
  }

  cancel(reason?: string): Trade {
    if (this.isFinalized()) {
      throw new InvalidOrderStateError(this.props.status, "cancel");
    }

    return this.updateProps({
      status: TradeStatus.CANCELLED,
      errorMessage: reason,
      executionCompletedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  updateStopLoss(percentage: number): Trade {
    if (percentage <= 0 || percentage >= 100) {
      throw new InvalidTradeParametersError(
        "stopLossPercent",
        "Stop loss percentage must be between 0 and 100"
      );
    }

    return this.updateProps({
      stopLossPercent: percentage,
      updatedAt: new Date(),
    });
  }

  updateTakeProfit(percentage: number): Trade {
    if (percentage <= 0) {
      throw new InvalidTradeParametersError(
        "takeProfitPercent",
        "Take profit percentage must be positive"
      );
    }

    return this.updateProps({
      takeProfitPercent: percentage,
      updatedAt: new Date(),
    });
  }

  addNotes(notes: string): Trade {
    return this.updateProps({
      notes: this.props.notes ? `${this.props.notes}\n${notes}` : notes,
      updatedAt: new Date(),
    });
  }

  // Helper method to create updated instance
  private updateProps(updates: Partial<TradeProps>): Trade {
    const updatedProps = { ...this.props, ...updates };
    const updatedTrade = Trade.fromExisting(updatedProps);
    updatedTrade.markAsModified();
    return updatedTrade;
  }

  // Convert to plain object for persistence
  toPlainObject(): TradeProps {
    return {
      ...this.props,
      entryPrice: this.props.entryPrice?.toPlainObject(),
      exitPrice: this.props.exitPrice?.toPlainObject(),
      totalCost: this.props.totalCost?.toPlainObject(),
      totalRevenue: this.props.totalRevenue?.toPlainObject(),
      realizedPnL: this.props.realizedPnL?.toPlainObject(),
      fees: this.props.fees?.toPlainObject(),
      orders: this.props.orders.map((order) => order.toPlainObject()),
    } as any;
  }
}
