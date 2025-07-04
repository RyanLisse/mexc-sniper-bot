/**
 * Position Monitoring Module
 *
 * Handles position tracking, stop-loss, and take-profit monitoring.
 * Extracted from auto-sniping.ts for better modularity.
 */

import { toSafeError } from "@/src/lib/error-type-utils";
import type {
  ModuleContext,
  Position,
  ServiceResponse,
  TradeParameters,
} from "../auto-sniping-types";
import type { OrderExecutionModule } from "./order-execution";

export class PositionMonitoringModule {
  private context: ModuleContext;
  private orderExecutor: OrderExecutionModule;

  // Position tracking
  private activePositions = new Map<string, Position>();
  private pendingStopLosses = new Map<string, NodeJS.Timeout>();
  private pendingTakeProfits = new Map<string, NodeJS.Timeout>();

  constructor(context: ModuleContext, orderExecutor: OrderExecutionModule) {
    this.context = context;
    this.orderExecutor = orderExecutor;
  }

  /**
   * Add a position to monitoring
   */
  addPosition(position: Position): void {
    this.activePositions.set(position.id, position);

    // Start monitoring stop-loss and take-profit
    if (position.stopLossPrice) {
      this.startStopLossMonitoring(position);
    }

    if (position.takeProfitPrice) {
      this.startTakeProfitMonitoring(position);
    }

    this.context.logger.info("Position added to monitoring", {
      positionId: position.id,
      symbol: position.symbol,
      side: position.side,
      quantity: position.quantity,
    });
  }

  /**
   * Remove a position from monitoring
   */
  removePosition(positionId: string): void {
    this.cleanupPositionMonitoring(positionId);
    this.activePositions.delete(positionId);

    this.context.logger.info("Position removed from monitoring", {
      positionId,
    });
  }

  /**
   * Get all active positions
   */
  getActivePositions(): Map<string, Position> {
    return new Map(this.activePositions);
  }

  /**
   * Get position by ID
   */
  getPosition(positionId: string): Position | undefined {
    return this.activePositions.get(positionId);
  }

  /**
   * Update position current price
   */
  updatePositionPrice(positionId: string, currentPrice: number): void {
    const position = this.activePositions.get(positionId);
    if (position) {
      position.currentPrice = currentPrice;
      position.lastUpdated = new Date();
    }
  }

  /**
   * Cleanup all monitoring timers
   */
  cleanup(): void {
    // Clear all pending timers
    this.pendingStopLosses.forEach((timer) => clearTimeout(timer));
    this.pendingTakeProfits.forEach((timer) => clearTimeout(timer));
    this.pendingStopLosses.clear();
    this.pendingTakeProfits.clear();

    // Log active positions that need manual handling
    if (this.activePositions.size > 0) {
      this.context.logger.warn(
        `Cleaning up with ${this.activePositions.size} active positions`,
        {
          positions: Array.from(this.activePositions.keys()),
        }
      );
    }

    this.activePositions.clear();
  }

  /**
   * Start stop-loss monitoring for a position
   */
  private startStopLossMonitoring(position: Position): void {
    if (!position.stopLossPrice) return;

    const checkInterval = 5000; // 5 seconds
    const monitorStopLoss = async () => {
      try {
        const currentPosition = this.activePositions.get(position.id);
        if (!currentPosition || currentPosition.status !== "open") {
          return; // Position no longer exists or is closed
        }

        const currentPrice = currentPosition.currentPrice || 0;
        let shouldTrigger = false;

        // Check if stop-loss should trigger
        if (
          currentPosition.side === "BUY" &&
          currentPrice <= (currentPosition.stopLossPrice || 0)
        ) {
          shouldTrigger = true;
        } else if (
          currentPosition.side === "SELL" &&
          currentPrice >= (currentPosition.stopLossPrice || 0)
        ) {
          shouldTrigger = true;
        }

        if (shouldTrigger) {
          await this.executeStopLoss(currentPosition);
        } else {
          // Continue monitoring
          const timer = setTimeout(monitorStopLoss, checkInterval);
          this.pendingStopLosses.set(position.id, timer);
        }
      } catch (error) {
        const safeError = toSafeError(error);
        this.context.logger.error("Stop-loss monitoring error", {
          positionId: position.id,
          error: safeError.message,
        });
      }
    };

    // Start monitoring
    const timer = setTimeout(monitorStopLoss, checkInterval);
    this.pendingStopLosses.set(position.id, timer);
  }

  /**
   * Start take-profit monitoring for a position
   */
  private startTakeProfitMonitoring(position: Position): void {
    if (!position.takeProfitPrice) return;

    const checkInterval = 5000; // 5 seconds
    const monitorTakeProfit = async () => {
      try {
        const currentPosition = this.activePositions.get(position.id);
        if (!currentPosition || currentPosition.status !== "open") {
          return; // Position no longer exists or is closed
        }

        const currentPrice = currentPosition.currentPrice || 0;
        let shouldTrigger = false;

        // Check if take-profit should trigger
        if (
          currentPosition.side === "BUY" &&
          currentPrice >= (currentPosition.takeProfitPrice || 0)
        ) {
          shouldTrigger = true;
        } else if (
          currentPosition.side === "SELL" &&
          currentPrice <= (currentPosition.takeProfitPrice || 0)
        ) {
          shouldTrigger = true;
        }

        if (shouldTrigger) {
          await this.executeTakeProfit(currentPosition);
        } else {
          // Continue monitoring
          const timer = setTimeout(monitorTakeProfit, checkInterval);
          this.pendingTakeProfits.set(position.id, timer);
        }
      } catch (error) {
        const safeError = toSafeError(error);
        this.context.logger.error("Take-profit monitoring error", {
          positionId: position.id,
          error: safeError.message,
        });
      }
    };

    // Start monitoring
    const timer = setTimeout(monitorTakeProfit, checkInterval);
    this.pendingTakeProfits.set(position.id, timer);
  }

  /**
   * Execute stop-loss for a position
   */
  private async executeStopLoss(position: Position): Promise<void> {
    try {
      this.context.logger.info("Executing stop-loss", {
        positionId: position.id,
        symbol: position.symbol,
        currentPrice: position.currentPrice,
        stopLossPrice: position.stopLossPrice,
      });

      // Place opposite order to close position
      const closeParams: TradeParameters = {
        symbol: position.symbol,
        side: position.side === "BUY" ? "SELL" : "BUY",
        type: "MARKET",
        quantity: position.quantity,
        timeInForce: "IOC",
      };

      const closeResult = await this.executeOrderWithRetry(closeParams);

      if (closeResult.success) {
        // Calculate realized PnL
        const entryValue = position.entryPrice * position.quantity;
        const exitValue = (position.currentPrice || 0) * position.quantity;
        const realizedPnL =
          position.side === "BUY"
            ? exitValue - entryValue
            : entryValue - exitValue;

        // Update position
        position.status = "closed";
        position.closeTime = new Date();
        position.realizedPnL = realizedPnL;

        // Clean up monitoring
        this.cleanupPositionMonitoring(position.id);
        this.activePositions.delete(position.id);

        // Emit position closed event
        this.context.eventEmitter.emit("position_closed", position);

        this.context.logger.info("Stop-loss executed successfully", {
          positionId: position.id,
          realizedPnL,
          closeOrderId: closeResult.data?.orderId,
        });
      } else {
        throw new Error(
          closeResult.error || "Failed to execute stop-loss order"
        );
      }
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Stop-loss execution failed", {
        positionId: position.id,
        error: safeError.message,
      });
    }
  }

  /**
   * Execute take-profit for a position
   */
  private async executeTakeProfit(position: Position): Promise<void> {
    try {
      this.context.logger.info("Executing take-profit", {
        positionId: position.id,
        symbol: position.symbol,
        currentPrice: position.currentPrice,
        takeProfitPrice: position.takeProfitPrice,
      });

      // Place opposite order to close position
      const closeParams: TradeParameters = {
        symbol: position.symbol,
        side: position.side === "BUY" ? "SELL" : "BUY",
        type: "MARKET",
        quantity: position.quantity,
        timeInForce: "IOC",
      };

      const closeResult = await this.executeOrderWithRetry(closeParams);

      if (closeResult.success) {
        // Calculate realized PnL
        const entryValue = position.entryPrice * position.quantity;
        const exitValue = (position.currentPrice || 0) * position.quantity;
        const realizedPnL =
          position.side === "BUY"
            ? exitValue - entryValue
            : entryValue - exitValue;

        // Update position
        position.status = "closed";
        position.closeTime = new Date();
        position.realizedPnL = realizedPnL;

        // Clean up monitoring
        this.cleanupPositionMonitoring(position.id);
        this.activePositions.delete(position.id);

        // Emit position closed event
        this.context.eventEmitter.emit("position_closed", position);

        this.context.logger.info("Take-profit executed successfully", {
          positionId: position.id,
          realizedPnL,
          closeOrderId: closeResult.data?.orderId,
        });
      } else {
        throw new Error(
          closeResult.error || "Failed to execute take-profit order"
        );
      }
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Take-profit execution failed", {
        positionId: position.id,
        error: safeError.message,
      });
    }
  }

  /**
   * Cleanup position monitoring timers
   */
  private cleanupPositionMonitoring(positionId: string): void {
    // Clear stop-loss timer
    const stopLossTimer = this.pendingStopLosses.get(positionId);
    if (stopLossTimer) {
      clearTimeout(stopLossTimer);
      this.pendingStopLosses.delete(positionId);
    }

    // Clear take-profit timer
    const takeProfitTimer = this.pendingTakeProfits.get(positionId);
    if (takeProfitTimer) {
      clearTimeout(takeProfitTimer);
      this.pendingTakeProfits.delete(positionId);
    }
  }

  /**
   * Execute order with retry logic (delegated to OrderExecutor)
   */
  private async executeOrderWithRetry(
    params: TradeParameters
  ): Promise<ServiceResponse<any>> {
    return await this.orderExecutor.executeOrderWithRetry(params);
  }
}
