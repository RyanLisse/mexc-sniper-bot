/**
 * Stop-Loss and Take-Profit Service
 *
 * Automated position management with stop-loss and take-profit orders.
 * Monitors positions in real-time and executes protective trades automatically.
 */

import { EventEmitter } from "events";
import { enhancedRiskManagementService } from "../risk/enhanced-risk-management-service";
import { mexcTradingService } from "./mexc-trading-service";
import { type Position, portfolioTrackingService } from "./portfolio-tracking-service";

export interface StopLossOrder {
  id: string;
  userId: string;
  symbol: string;
  asset: string;
  quantity: number;
  stopPrice: number; // Price at which to trigger stop-loss
  limitPrice?: number; // Optional limit price (if not set, uses market order)
  type: "stop_loss" | "take_profit";
  status: "active" | "triggered" | "filled" | "cancelled" | "error";
  createdAt: string;
  triggeredAt?: string;
  filledAt?: string;
  orderId?: string; // MEXC order ID when executed
  executionPrice?: number;
  reason?: string; // Reason for cancellation or error
}

export interface PositionProtection {
  userId: string;
  symbol: string;
  asset: string;
  quantity: number;
  entryPrice: number;
  stopLossPercent?: number; // Stop-loss percentage below entry (e.g., 5 = 5% below)
  takeProfitPercent?: number; // Take-profit percentage above entry (e.g., 15 = 15% above)
  trailingStopPercent?: number; // Trailing stop percentage
  trailingStopPrice?: number; // Current trailing stop price
  maxPrice?: number; // Highest price reached (for trailing stops)
  stopLossOrder?: StopLossOrder;
  takeProfitOrder?: StopLossOrder;
  enabled: boolean;
  createdAt: string;
  lastChecked?: string;
}

export interface ProtectionAlert {
  type:
    | "stop_loss_triggered"
    | "take_profit_triggered"
    | "trailing_stop_updated"
    | "protection_error";
  userId: string;
  symbol: string;
  price: number;
  message: string;
  timestamp: string;
  orderId?: string;
}

export class StopLossTakeProfitService extends EventEmitter {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[stop-loss-tp]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[stop-loss-tp]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[stop-loss-tp]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[stop-loss-tp]", message, context || ""),
  };

  private protections = new Map<string, PositionProtection>(); // key: userId_symbol
  private stopLossOrders = new Map<string, StopLossOrder>();
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring = false;

  constructor() {
    super();
    this.logger.info("Stop-Loss Take-Profit Service initialized");

    // Listen to portfolio updates for automatic protection monitoring
    portfolioTrackingService.on("portfolioUpdate", (data) => {
      this.handlePortfolioUpdate(data.userId, data.summary.positions);
    });
  }

  /**
   * Set up protection for a position
   */
  setPositionProtection(
    userId: string,
    symbol: string,
    asset: string,
    quantity: number,
    entryPrice: number,
    options: {
      stopLossPercent?: number;
      takeProfitPercent?: number;
      trailingStopPercent?: number;
    }
  ): string {
    const protectionId = `${userId}_${symbol}`;

    const protection: PositionProtection = {
      userId,
      symbol,
      asset,
      quantity,
      entryPrice,
      stopLossPercent: options.stopLossPercent,
      takeProfitPercent: options.takeProfitPercent,
      trailingStopPercent: options.trailingStopPercent,
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    // Calculate initial protection prices
    if (options.stopLossPercent) {
      const stopPrice = entryPrice * (1 - options.stopLossPercent / 100);
      protection.trailingStopPrice = stopPrice;
    }

    this.protections.set(protectionId, protection);

    this.logger.info("Position protection set", {
      userId,
      symbol,
      entryPrice,
      stopLossPercent: options.stopLossPercent,
      takeProfitPercent: options.takeProfitPercent,
      trailingStopPercent: options.trailingStopPercent,
    });

    // Start monitoring if not already running
    if (!this.isMonitoring) {
      this.startMonitoring();
    }

    return protectionId;
  }

  /**
   * Remove protection for a position
   */
  removePositionProtection(userId: string, symbol: string): boolean {
    const protectionId = `${userId}_${symbol}`;
    const protection = this.protections.get(protectionId);

    if (!protection) {
      return false;
    }

    // Cancel any active orders
    if (protection.stopLossOrder && protection.stopLossOrder.status === "active") {
      this.cancelStopLossOrder(protection.stopLossOrder.id);
    }

    if (protection.takeProfitOrder && protection.takeProfitOrder.status === "active") {
      this.cancelStopLossOrder(protection.takeProfitOrder.id);
    }

    this.protections.delete(protectionId);

    this.logger.info("Position protection removed", { userId, symbol });
    return true;
  }

  /**
   * Get all protections for a user
   */
  getUserProtections(userId: string): PositionProtection[] {
    return Array.from(this.protections.values()).filter((p) => p.userId === userId);
  }

  /**
   * Update protection settings
   */
  updatePositionProtection(
    userId: string,
    symbol: string,
    updates: Partial<
      Pick<
        PositionProtection,
        "stopLossPercent" | "takeProfitPercent" | "trailingStopPercent" | "enabled"
      >
    >
  ): boolean {
    const protectionId = `${userId}_${symbol}`;
    const protection = this.protections.get(protectionId);

    if (!protection) {
      return false;
    }

    // Update the protection
    Object.assign(protection, updates);

    // Recalculate protection prices if percentages changed
    if (updates.stopLossPercent && protection.entryPrice) {
      const stopPrice = protection.entryPrice * (1 - updates.stopLossPercent / 100);
      protection.trailingStopPrice = stopPrice;
    }

    this.logger.info("Position protection updated", { userId, symbol, updates });
    return true;
  }

  /**
   * Start monitoring positions for protection triggers
   */
  startMonitoring(intervalMs = 10000): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.logger.info("Starting stop-loss/take-profit monitoring", { intervalMs });

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkProtections();
      } catch (error) {
        this.logger.error("Error during protection monitoring:", error);
      }
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
    this.logger.info("Stopped stop-loss/take-profit monitoring");
  }

  /**
   * Check all active protections
   */
  private async checkProtections(): Promise<void> {
    const activeProtections = Array.from(this.protections.values()).filter((p) => p.enabled);

    for (const protection of activeProtections) {
      try {
        await this.checkPositionProtection(protection);
      } catch (error) {
        this.logger.error(`Failed to check protection for ${protection.symbol}:`, error);
      }
    }
  }

  /**
   * Check individual position protection
   */
  private async checkPositionProtection(protection: PositionProtection): Promise<void> {
    // Get current portfolio to find this position
    const portfolio = await portfolioTrackingService.getPortfolioSummary(protection.userId);
    const position = portfolio.positions.find((p) => p.symbol === protection.symbol);

    if (!position) {
      // Position no longer exists, remove protection
      this.removePositionProtection(protection.userId, protection.symbol);
      return;
    }

    const currentPrice = position.currentPrice;
    protection.lastChecked = new Date().toISOString();

    // Update max price for trailing stops
    if (
      protection.trailingStopPercent &&
      (!protection.maxPrice || currentPrice > protection.maxPrice)
    ) {
      protection.maxPrice = currentPrice;

      // Update trailing stop price
      const newStopPrice = currentPrice * (1 - protection.trailingStopPercent / 100);
      if (!protection.trailingStopPrice || newStopPrice > protection.trailingStopPrice) {
        protection.trailingStopPrice = newStopPrice;

        this.emit("protectionAlert", {
          type: "trailing_stop_updated",
          userId: protection.userId,
          symbol: protection.symbol,
          price: newStopPrice,
          message: `Trailing stop updated to ${newStopPrice.toFixed(8)}`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Check stop-loss triggers
    const stopPrice =
      protection.trailingStopPrice ||
      (protection.stopLossPercent
        ? protection.entryPrice * (1 - protection.stopLossPercent / 100)
        : null);

    if (stopPrice && currentPrice <= stopPrice && !protection.stopLossOrder) {
      await this.triggerStopLoss(protection, currentPrice);
    }

    // Check take-profit triggers
    if (protection.takeProfitPercent && !protection.takeProfitOrder) {
      const takeProfitPrice = protection.entryPrice * (1 + protection.takeProfitPercent / 100);
      if (currentPrice >= takeProfitPrice) {
        await this.triggerTakeProfit(protection, currentPrice);
      }
    }
  }

  /**
   * Trigger stop-loss order
   */
  private async triggerStopLoss(
    protection: PositionProtection,
    currentPrice: number
  ): Promise<void> {
    const orderId = `sl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const stopLossOrder: StopLossOrder = {
      id: orderId,
      userId: protection.userId,
      symbol: protection.symbol,
      asset: protection.asset,
      quantity: protection.quantity,
      stopPrice: currentPrice,
      type: "stop_loss",
      status: "triggered",
      createdAt: new Date().toISOString(),
      triggeredAt: new Date().toISOString(),
    };

    try {
      this.logger.info("Triggering stop-loss order", {
        userId: protection.userId,
        symbol: protection.symbol,
        stopPrice: currentPrice,
        quantity: protection.quantity,
      });

      // Execute the stop-loss order
      const orderResult = await mexcTradingService.executeTrade({
        userId: protection.userId,
        symbol: protection.symbol,
        side: "SELL",
        type: "MARKET",
        quantity: protection.quantity.toString(),
      });

      if (orderResult.success) {
        stopLossOrder.status = "filled";
        stopLossOrder.filledAt = new Date().toISOString();
        stopLossOrder.orderId = orderResult.data.orderId;
        stopLossOrder.executionPrice = parseFloat(orderResult.data.price || "0");

        this.logger.info("Stop-loss order executed successfully", {
          orderId: orderResult.data.orderId,
          executionPrice: stopLossOrder.executionPrice,
        });

        // Remove protection since position is closed
        this.removePositionProtection(protection.userId, protection.symbol);
      } else {
        stopLossOrder.status = "error";
        stopLossOrder.reason = orderResult.error;

        this.logger.error("Stop-loss order failed", {
          error: orderResult.error,
          code: orderResult.code,
        });
      }

      protection.stopLossOrder = stopLossOrder;
      this.stopLossOrders.set(orderId, stopLossOrder);

      // Emit alert
      this.emit("protectionAlert", {
        type: "stop_loss_triggered",
        userId: protection.userId,
        symbol: protection.symbol,
        price: currentPrice,
        message: `Stop-loss triggered at ${currentPrice.toFixed(8)}`,
        timestamp: new Date().toISOString(),
        orderId: stopLossOrder.orderId,
      });
    } catch (error) {
      stopLossOrder.status = "error";
      stopLossOrder.reason = error instanceof Error ? error.message : "Unknown error";

      this.logger.error("Stop-loss execution error:", error);

      this.emit("protectionAlert", {
        type: "protection_error",
        userId: protection.userId,
        symbol: protection.symbol,
        price: currentPrice,
        message: `Stop-loss error: ${stopLossOrder.reason}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Trigger take-profit order
   */
  private async triggerTakeProfit(
    protection: PositionProtection,
    currentPrice: number
  ): Promise<void> {
    const orderId = `tp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const takeProfitOrder: StopLossOrder = {
      id: orderId,
      userId: protection.userId,
      symbol: protection.symbol,
      asset: protection.asset,
      quantity: protection.quantity,
      stopPrice: currentPrice,
      type: "take_profit",
      status: "triggered",
      createdAt: new Date().toISOString(),
      triggeredAt: new Date().toISOString(),
    };

    try {
      this.logger.info("Triggering take-profit order", {
        userId: protection.userId,
        symbol: protection.symbol,
        targetPrice: currentPrice,
        quantity: protection.quantity,
      });

      // Execute the take-profit order
      const orderResult = await mexcTradingService.executeTrade({
        userId: protection.userId,
        symbol: protection.symbol,
        side: "SELL",
        type: "MARKET",
        quantity: protection.quantity.toString(),
      });

      if (orderResult.success) {
        takeProfitOrder.status = "filled";
        takeProfitOrder.filledAt = new Date().toISOString();
        takeProfitOrder.orderId = orderResult.data.orderId;
        takeProfitOrder.executionPrice = parseFloat(orderResult.data.price || "0");

        this.logger.info("Take-profit order executed successfully", {
          orderId: orderResult.data.orderId,
          executionPrice: takeProfitOrder.executionPrice,
        });

        // Remove protection since position is closed
        this.removePositionProtection(protection.userId, protection.symbol);
      } else {
        takeProfitOrder.status = "error";
        takeProfitOrder.reason = orderResult.error;

        this.logger.error("Take-profit order failed", {
          error: orderResult.error,
          code: orderResult.code,
        });
      }

      protection.takeProfitOrder = takeProfitOrder;
      this.stopLossOrders.set(orderId, takeProfitOrder);

      // Emit alert
      this.emit("protectionAlert", {
        type: "take_profit_triggered",
        userId: protection.userId,
        symbol: protection.symbol,
        price: currentPrice,
        message: `Take-profit triggered at ${currentPrice.toFixed(8)}`,
        timestamp: new Date().toISOString(),
        orderId: takeProfitOrder.orderId,
      });
    } catch (error) {
      takeProfitOrder.status = "error";
      takeProfitOrder.reason = error instanceof Error ? error.message : "Unknown error";

      this.logger.error("Take-profit execution error:", error);

      this.emit("protectionAlert", {
        type: "protection_error",
        userId: protection.userId,
        symbol: protection.symbol,
        price: currentPrice,
        message: `Take-profit error: ${takeProfitOrder.reason}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Cancel a stop-loss order
   */
  private cancelStopLossOrder(orderId: string): void {
    const order = this.stopLossOrders.get(orderId);
    if (order && order.status === "active") {
      order.status = "cancelled";
      this.logger.info("Stop-loss order cancelled", { orderId });
    }
  }

  /**
   * Handle portfolio updates
   */
  private handlePortfolioUpdate(userId: string, positions: Position[]): void {
    // Check if any protected positions no longer exist
    const userProtections = this.getUserProtections(userId);
    const currentSymbols = new Set(positions.map((p) => p.symbol));

    for (const protection of userProtections) {
      if (!currentSymbols.has(protection.symbol)) {
        this.logger.info("Position no longer exists, removing protection", {
          userId,
          symbol: protection.symbol,
        });
        this.removePositionProtection(userId, protection.symbol);
      }
    }
  }

  /**
   * Get all stop-loss orders
   */
  getAllStopLossOrders(): StopLossOrder[] {
    return Array.from(this.stopLossOrders.values());
  }

  /**
   * Get stop-loss orders for a user
   */
  getUserStopLossOrders(userId: string): StopLossOrder[] {
    return Array.from(this.stopLossOrders.values()).filter((order) => order.userId === userId);
  }

  /**
   * Get service statistics
   */
  getStats(): {
    activeProtections: number;
    totalOrders: number;
    filledOrders: number;
    errorOrders: number;
    isMonitoring: boolean;
  } {
    const orders = Array.from(this.stopLossOrders.values());

    return {
      activeProtections: this.protections.size,
      totalOrders: orders.length,
      filledOrders: orders.filter((o) => o.status === "filled").length,
      errorOrders: orders.filter((o) => o.status === "error").length,
      isMonitoring: this.isMonitoring,
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopMonitoring();
    this.protections.clear();
    this.stopLossOrders.clear();
    this.removeAllListeners();
    this.logger.info("Stop-Loss Take-Profit Service destroyed");
  }
}

// Export singleton instance
export const stopLossTakeProfitService = new StopLossTakeProfitService();
