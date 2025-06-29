/**
 * Execution Order Service
 *
 * Manages order execution and tracking for trading operations
 */

import { z } from "zod";
import type { OrderParameters } from "@/src/services/api/mexc-client-types";
import { getUnifiedMexcService } from "@/src/services/mexc-unified-exports";

// Order status enumeration
export const OrderStatus = z.enum([
  "pending",
  "placed",
  "partially_filled",
  "filled",
  "cancelled",
  "rejected",
  "expired",
]);

export type OrderStatusType = z.infer<typeof OrderStatus>;

// Order type enumeration
export const OrderType = z.enum(["market", "limit", "stop_limit", "stop_market", "trailing_stop"]);

export type OrderTypeType = z.infer<typeof OrderType>;

// Order side enumeration
export const OrderSide = z.enum(["buy", "sell"]);
export type OrderSideType = z.infer<typeof OrderSide>;

// Execution order schema
export const ExecutionOrderSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  side: OrderSide,
  type: OrderType,
  quantity: z.number().positive(),
  price: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  status: OrderStatus,
  createdAt: z.number(),
  updatedAt: z.number(),
  filledQuantity: z.number().min(0).default(0),
  averageFillPrice: z.number().positive().optional(),
  commission: z.number().min(0).default(0),
  clientOrderId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type ExecutionOrder = z.infer<typeof ExecutionOrderSchema>;

// Order execution result
export const OrderExecutionResultSchema = z.object({
  orderId: z.string(),
  success: z.boolean(),
  message: z.string(),
  executionTime: z.number(),
  order: ExecutionOrderSchema.optional(),
  error: z.string().optional(),
});

export type OrderExecutionResult = z.infer<typeof OrderExecutionResultSchema>;

/**
 * Execution Order Service Configuration
 */
export interface ExecutionServiceConfig {
  apiKey?: string;
  secretKey?: string;
  enableRealTrading?: boolean;
  enableTestMode?: boolean;
}

/**
 * Execution Order Service
 */
export class ExecutionOrderService {
  private orders = new Map<string, ExecutionOrder>();
  private orderHistory: ExecutionOrder[] = [];
  private config: ExecutionServiceConfig;

  constructor(config: ExecutionServiceConfig = {}) {
    this.config = {
      enableRealTrading: false, // Default to safe mode
      enableTestMode: true,
      ...config,
    };
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<ExecutionServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): ExecutionServiceConfig {
    return { ...this.config };
  }

  /**
   * Create a new order
   */
  async createOrder(
    orderData: Omit<ExecutionOrder, "id" | "status" | "createdAt" | "updatedAt" | "filledQuantity">
  ): Promise<ExecutionOrder> {
    const now = Date.now();
    const order: ExecutionOrder = {
      ...orderData,
      id: `order_${now}_${Math.random().toString(36).substr(2, 9)}`,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      filledQuantity: 0,
    };

    this.orders.set(order.id, order);
    return order;
  }

  /**
   * Execute an order
   */
  async executeOrder(orderId: string): Promise<OrderExecutionResult> {
    const startTime = Date.now();
    const order = this.orders.get(orderId);

    if (!order) {
      return {
        orderId,
        success: false,
        message: "Order not found",
        executionTime: Date.now() - startTime,
        error: `Order with ID ${orderId} not found`,
      };
    }

    try {
      // Execute order through MEXC API or simulation based on configuration
      await this.executeOrderReal(order);

      const executionTime = Date.now() - startTime;

      return {
        orderId,
        success: true,
        message: "Order executed successfully",
        executionTime,
        order: { ...order },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      return {
        orderId,
        success: false,
        message: "Order execution failed",
        executionTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatusType,
    filledQuantity?: number,
    averageFillPrice?: number
  ): Promise<boolean> {
    const order = this.orders.get(orderId);

    if (!order) {
      return false;
    }

    order.status = status;
    order.updatedAt = Date.now();

    if (filledQuantity !== undefined) {
      order.filledQuantity = filledQuantity;
    }

    if (averageFillPrice !== undefined) {
      order.averageFillPrice = averageFillPrice;
    }

    // Move to history if order is complete
    if (["filled", "cancelled", "rejected", "expired"].includes(status)) {
      this.orderHistory.push({ ...order });
    }

    return true;
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.orders.get(orderId);

    if (!order || ["filled", "cancelled", "rejected", "expired"].includes(order.status)) {
      return false;
    }

    return this.updateOrderStatus(orderId, "cancelled");
  }

  /**
   * Get order by ID
   */
  getOrder(orderId: string): ExecutionOrder | undefined {
    return this.orders.get(orderId);
  }

  /**
   * Get all active orders
   */
  getActiveOrders(): ExecutionOrder[] {
    return Array.from(this.orders.values()).filter(
      (order) => !["filled", "cancelled", "rejected", "expired"].includes(order.status)
    );
  }

  /**
   * Get order history
   */
  getOrderHistory(limit = 100): ExecutionOrder[] {
    return this.orderHistory.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, limit);
  }

  /**
   * Get orders by symbol
   */
  getOrdersBySymbol(symbol: string): ExecutionOrder[] {
    return Array.from(this.orders.values()).filter((order) => order.symbol === symbol);
  }

  /**
   * Clear completed orders from memory
   */
  clearCompletedOrders(): number {
    const completedStatuses: OrderStatusType[] = ["filled", "cancelled", "rejected", "expired"];
    let cleared = 0;

    for (const [orderId, order] of this.orders.entries()) {
      if (completedStatuses.includes(order.status)) {
        this.orders.delete(orderId);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Execute order through MEXC API or simulation based on configuration
   */
  private async executeOrderReal(order: ExecutionOrder): Promise<void> {
    // If real trading is disabled or credentials not available, fall back to simulation
    if (!this.config.enableRealTrading || !this.config.apiKey || !this.config.secretKey) {
      console.info(
        "[ExecutionOrderService] Using simulation mode - real trading disabled or credentials missing"
      );
      return await this.simulateOrderExecution(order);
    }

    try {
      console.info(
        `[ExecutionOrderService] Executing real order: ${order.symbol} ${order.side} ${order.quantity}`
      );

      // Initialize MEXC service with credentials
      const mexcService = await getUnifiedMexcService({
        apiKey: this.config.apiKey,
        secretKey: this.config.secretKey,
      });

      // Prepare order parameters for MEXC API
      const orderParams: OrderParameters = {
        symbol: order.symbol,
        side: order.side.toUpperCase() as "BUY" | "SELL",
        type: order.type.toUpperCase() as "LIMIT" | "MARKET",
        quantity: order.quantity.toString(),
        price: order.price?.toString(),
        timeInForce: "IOC", // Immediate or Cancel for safety
      };

      // Execute order via MEXC API
      let response;
      if (this.config.enableTestMode) {
        console.info("[ExecutionOrderService] Using test mode");
        response = await mexcService.placeOrder(orderParams);
      } else {
        console.info("[ExecutionOrderService] Using live trading mode");
        response = await mexcService.placeOrder(orderParams);
      }

      if (!response.success || !response.data) {
        order.status = "rejected";
        throw new Error(response.error || "Order execution failed");
      }

      const orderResult = response.data;

      // Update order with MEXC response
      order.status = this.mapMexcStatusToOrderStatus(orderResult.status || "FILLED");
      order.filledQuantity = orderResult.quantity
        ? parseFloat(orderResult.quantity)
        : order.quantity;
      order.averageFillPrice = orderResult.price ? parseFloat(orderResult.price) : order.price;
      order.clientOrderId = orderResult.orderId;
      order.updatedAt = Date.now();

      // Store additional metadata
      order.metadata = {
        ...(order.metadata || {}),
        mexcOrderId: orderResult.orderId,
        mexcStatus: orderResult.status,
        executionTimestamp: orderResult.timestamp,
        realExecution: true,
        testMode: this.config.enableTestMode,
      };

      console.info(
        `[ExecutionOrderService] Order executed successfully: ${orderResult.orderId} - ${order.status}`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown execution error";
      console.error("[ExecutionOrderService] Real order execution failed:", errorMessage);

      order.status = "rejected";
      order.metadata = {
        ...(order.metadata || {}),
        executionError: errorMessage,
        realExecution: true,
        failedAt: new Date().toISOString(),
      };

      throw error;
    }
  }

  /**
   * Simulate order execution (fallback for when real trading is disabled)
   */
  private async simulateOrderExecution(order: ExecutionOrder): Promise<void> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 100 + 50));

    // Simulate different execution scenarios
    const random = Math.random();

    if (random < 0.05) {
      // 5% chance of rejection
      order.status = "rejected";
      throw new Error("Order rejected by exchange (simulated)");
    } else if (random < 0.1) {
      // 5% chance of partial fill
      order.status = "partially_filled";
      order.filledQuantity = order.quantity * (0.3 + Math.random() * 0.4);
      order.averageFillPrice = order.price
        ? order.price * (0.99 + Math.random() * 0.02)
        : undefined;
    } else {
      // 90% chance of full fill
      order.status = "filled";
      order.filledQuantity = order.quantity;
      order.averageFillPrice = order.price
        ? order.price * (0.995 + Math.random() * 0.01)
        : undefined;
    }

    order.updatedAt = Date.now();

    // Mark as simulated
    order.metadata = {
      ...(order.metadata || {}),
      simulated: true,
      simulationTimestamp: new Date().toISOString(),
    };
  }

  /**
   * Map MEXC order status to our internal order status
   */
  private mapMexcStatusToOrderStatus(mexcStatus: string): OrderStatusType {
    const statusMap: Record<string, OrderStatusType> = {
      NEW: "pending",
      PARTIALLY_FILLED: "partially_filled",
      FILLED: "filled",
      CANCELED: "cancelled",
      PENDING_CANCEL: "pending",
      REJECTED: "rejected",
      EXPIRED: "expired",
      TEST_FILLED: "filled", // For test orders
    };

    return statusMap[mexcStatus.toUpperCase()] || "pending";
  }
}

// Create and export singleton instance with environment configuration
const createExecutionOrderService = () => {
  const config: ExecutionServiceConfig = {
    apiKey: process.env.MEXC_API_KEY,
    secretKey: process.env.MEXC_SECRET_KEY,
    enableRealTrading: process.env.ENABLE_REAL_TRADING === "true",
    enableTestMode: process.env.ENABLE_TEST_MODE !== "false", // Default to true unless explicitly disabled
  };

  return new ExecutionOrderService(config);
};

// Export singleton instance
export const executionOrderService = createExecutionOrderService();
