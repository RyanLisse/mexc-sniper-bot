/**
 * Order Value Object
 * Represents a trading order with its immutable properties
 */

import { z } from "zod";
import { ValueObject } from "../../base/value-object";
import { DomainValidationError } from "../../errors/trading-errors";

// Order status enumeration
export enum OrderStatus {
  PENDING = "PENDING",
  SUBMITTED = "SUBMITTED",
  PARTIALLY_FILLED = "PARTIALLY_FILLED",
  FILLED = "FILLED",
  CANCELLED = "CANCELLED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
}

// Order side enumeration
export enum OrderSide {
  BUY = "BUY",
  SELL = "SELL",
}

// Order type enumeration
export enum OrderType {
  MARKET = "MARKET",
  LIMIT = "LIMIT",
  STOP_LIMIT = "STOP_LIMIT",
}

// Time in force enumeration
export enum TimeInForce {
  GTC = "GTC", // Good Till Cancelled
  IOC = "IOC", // Immediate Or Cancel
  FOK = "FOK", // Fill Or Kill
}

interface OrderProps {
  readonly id: string;
  readonly symbol: string;
  readonly side: OrderSide;
  readonly type: OrderType;
  readonly status: OrderStatus;
  readonly quantity?: number;
  readonly quoteOrderQty?: number;
  readonly price?: number;
  readonly stopPrice?: number;
  readonly timeInForce: TimeInForce;
  readonly clientOrderId?: string;
  readonly exchangeOrderId?: string;
  readonly executedQuantity?: number;
  readonly executedPrice?: number;
  readonly cumulativeQuoteQty?: number;
  readonly avgPrice?: number;
  readonly fees?: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly filledAt?: Date;
  readonly cancelledAt?: Date;
  readonly rejectReason?: string;
  readonly strategy?: string;
  readonly isAutoSnipe: boolean;
  readonly confidenceScore?: number;
  readonly paperTrade: boolean;
}

// Validation schema
const OrderPropsSchema = z.object({
  id: z.string().min(1),
  symbol: z.string().min(1),
  side: z.nativeEnum(OrderSide),
  type: z.nativeEnum(OrderType),
  status: z.nativeEnum(OrderStatus),
  quantity: z.number().positive().optional(),
  quoteOrderQty: z.number().positive().optional(),
  price: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  timeInForce: z.nativeEnum(TimeInForce),
  clientOrderId: z.string().optional(),
  exchangeOrderId: z.string().optional(),
  executedQuantity: z.number().nonnegative().optional(),
  executedPrice: z.number().positive().optional(),
  cumulativeQuoteQty: z.number().nonnegative().optional(),
  avgPrice: z.number().positive().optional(),
  fees: z.number().nonnegative().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  filledAt: z.date().optional(),
  cancelledAt: z.date().optional(),
  rejectReason: z.string().optional(),
  strategy: z.string().optional(),
  isAutoSnipe: z.boolean(),
  confidenceScore: z.number().min(0).max(100).optional(),
  paperTrade: z.boolean(),
});

export class Order extends ValueObject<OrderProps> {
  private constructor(props: OrderProps) {
    super(props);
  }

  static create(props: Omit<OrderProps, "id" | "createdAt" | "updatedAt">): Order {
    const id = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const orderProps: OrderProps = {
      ...props,
      id,
      createdAt: now,
      updatedAt: now,
    };

    return Order.createWithValidation(orderProps);
  }

  static fromExisting(props: OrderProps): Order {
    return Order.createWithValidation(props);
  }

  private static createWithValidation(props: OrderProps): Order {
    // Validate props
    const validationResult = OrderPropsSchema.safeParse(props);
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      throw new DomainValidationError(
        firstError.path.join("."),
        'invalid value',
        firstError.message
      );
    }

    // Business rule validations
    Order.validateBusinessRules(props);

    return new Order(props);
  }

  private static validateBusinessRules(props: OrderProps): void {
    // Quantity validation
    if (!props.quantity && !props.quoteOrderQty) {
      throw new DomainValidationError(
        "quantity",
        "undefined",
        "Either quantity or quoteOrderQty must be provided"
      );
    }

    // Price validation for limit orders
    if (props.type === OrderType.LIMIT && !props.price) {
      throw new DomainValidationError("price", "undefined", "Price is required for LIMIT orders");
    }

    // Stop price validation for stop limit orders
    if (props.type === OrderType.STOP_LIMIT && !props.stopPrice) {
      throw new DomainValidationError(
        "stopPrice",
        "undefined",
        "Stop price is required for STOP_LIMIT orders"
      );
    }

    // Execution validation
    if (props.executedQuantity && props.quantity && props.executedQuantity > props.quantity) {
      throw new DomainValidationError(
        "executedQuantity",
        props.executedQuantity,
        "Executed quantity cannot exceed order quantity"
      );
    }

    // Status and timestamp consistency
    if (props.status === OrderStatus.FILLED && !props.filledAt) {
      throw new DomainValidationError(
        "filledAt",
        "undefined",
        "Fill timestamp is required for FILLED orders"
      );
    }

    if (props.status === OrderStatus.CANCELLED && !props.cancelledAt) {
      throw new DomainValidationError(
        "cancelledAt",
        "undefined",
        "Cancel timestamp is required for CANCELLED orders"
      );
    }

    // Auto-snipe confidence validation
    if (props.isAutoSnipe && !props.confidenceScore) {
      throw new DomainValidationError(
        "confidenceScore",
        "undefined",
        "Confidence score is required for auto-snipe orders"
      );
    }
  }

  // Getters
  get id(): string {
    return this.props.id;
  }

  get symbol(): string {
    return this.props.symbol;
  }

  get side(): OrderSide {
    return this.props.side;
  }

  get type(): OrderType {
    return this.props.type;
  }

  get status(): OrderStatus {
    return this.props.status;
  }

  get quantity(): number | undefined {
    return this.props.quantity;
  }

  get quoteOrderQty(): number | undefined {
    return this.props.quoteOrderQty;
  }

  get price(): number | undefined {
    return this.props.price;
  }

  get stopPrice(): number | undefined {
    return this.props.stopPrice;
  }

  get timeInForce(): TimeInForce {
    return this.props.timeInForce;
  }

  get clientOrderId(): string | undefined {
    return this.props.clientOrderId;
  }

  get exchangeOrderId(): string | undefined {
    return this.props.exchangeOrderId;
  }

  get executedQuantity(): number | undefined {
    return this.props.executedQuantity;
  }

  get executedPrice(): number | undefined {
    return this.props.executedPrice;
  }

  get cumulativeQuoteQty(): number | undefined {
    return this.props.cumulativeQuoteQty;
  }

  get avgPrice(): number | undefined {
    return this.props.avgPrice;
  }

  get fees(): number | undefined {
    return this.props.fees;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get filledAt(): Date | undefined {
    return this.props.filledAt;
  }

  get cancelledAt(): Date | undefined {
    return this.props.cancelledAt;
  }

  get rejectReason(): string | undefined {
    return this.props.rejectReason;
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

  // Business logic methods
  isFilled(): boolean {
    return this.props.status === OrderStatus.FILLED;
  }

  isPartiallyFilled(): boolean {
    return this.props.status === OrderStatus.PARTIALLY_FILLED;
  }

  isCancelled(): boolean {
    return this.props.status === OrderStatus.CANCELLED;
  }

  isRejected(): boolean {
    return this.props.status === OrderStatus.REJECTED;
  }

  isActive(): boolean {
    return [OrderStatus.PENDING, OrderStatus.SUBMITTED, OrderStatus.PARTIALLY_FILLED].includes(
      this.props.status
    );
  }

  isFinalized(): boolean {
    return [OrderStatus.FILLED, OrderStatus.CANCELLED, OrderStatus.REJECTED, OrderStatus.EXPIRED].includes(
      this.props.status
    );
  }

  getFillPercentage(): number {
    if (!this.props.quantity || !this.props.executedQuantity) {
      return 0;
    }
    return (this.props.executedQuantity / this.props.quantity) * 100;
  }

  getEffectivePrice(): number | undefined {
    return this.props.avgPrice || this.props.executedPrice || this.props.price;
  }

  getTotalCost(): number | undefined {
    if (!this.props.executedQuantity || !this.getEffectivePrice()) {
      return undefined;
    }
    const cost = this.props.executedQuantity * this.getEffectivePrice()!;
    return this.props.fees ? cost + this.props.fees : cost;
  }

  // State transition methods (return new instances)
  markAsSubmitted(exchangeOrderId: string): Order {
    return Order.fromExisting({
      ...this.props,
      status: OrderStatus.SUBMITTED,
      exchangeOrderId,
      updatedAt: new Date(),
    });
  }

  markAsPartiallyFilled(executedQuantity: number, executedPrice: number, fees?: number): Order {
    return Order.fromExisting({
      ...this.props,
      status: OrderStatus.PARTIALLY_FILLED,
      executedQuantity,
      executedPrice,
      avgPrice: executedPrice,
      fees,
      updatedAt: new Date(),
    });
  }

  markAsFilled(
    executedQuantity: number,
    executedPrice: number,
    cumulativeQuoteQty?: number,
    fees?: number
  ): Order {
    return Order.fromExisting({
      ...this.props,
      status: OrderStatus.FILLED,
      executedQuantity,
      executedPrice,
      avgPrice: executedPrice,
      cumulativeQuoteQty,
      fees,
      filledAt: new Date(),
      updatedAt: new Date(),
    });
  }

  markAsCancelled(reason?: string): Order {
    return Order.fromExisting({
      ...this.props,
      status: OrderStatus.CANCELLED,
      rejectReason: reason,
      cancelledAt: new Date(),
      updatedAt: new Date(),
    });
  }

  markAsRejected(reason: string): Order {
    return Order.fromExisting({
      ...this.props,
      status: OrderStatus.REJECTED,
      rejectReason: reason,
      updatedAt: new Date(),
    });
  }

  // Convert to plain object for persistence
  toPlainObject(): OrderProps {
    return { ...this.props };
  }
}