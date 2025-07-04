/**
 * Position Management Module
 *
 * Handles position creation, monitoring, and lifecycle management for auto-sniping.
 * Extracted from auto-sniping.ts for better modularity.
 */

import type {
  ModuleContext,
  Position,
  ServiceResponse,
  TradeParameters,
} from "../auto-sniping-types";

export class PositionManagementModule {
  private context: ModuleContext;
  private activePositions = new Map<string, Position>();
  private pendingStopLosses = new Map<string, NodeJS.Timeout>();
  private pendingTakeProfits = new Map<string, NodeJS.Timeout>();

  constructor(context: ModuleContext) {
    this.context = context;
  }

  /**
   * Create position tracking entry
   */
  async createPositionEntry(
    orderResult: any,
    params: TradeParameters,
    currentPrice: number
  ): Promise<Position> {
    const positionId = `${params.symbol}-${orderResult.orderId}-${Date.now()}`;
    const entryPrice = parseFloat(orderResult.price) || currentPrice;
    const quantity = parseFloat(orderResult.executedQty || orderResult.origQty);

    const position: Position = {
      id: positionId,
      symbol: params.symbol,
      side: params.side,
      orderId: orderResult.orderId.toString(),
      clientOrderId: orderResult.clientOrderId,
      entryPrice,
      quantity,
      currentPrice: entryPrice,
      stopLossPercent: params.stopLossPercent,
      takeProfitPercent: params.takeProfitPercent,
      timestamp: new Date().toISOString(),
      status: "open",
      openTime: new Date(),
      strategy: params.strategy || "auto-snipe",
      confidenceScore: params.confidenceScore,
      autoSnipe: true,
      paperTrade: this.context.config.enablePaperTrading,
      tags: ["auto-snipe"],
    };

    // Calculate stop-loss and take-profit prices
    this.calculatePositionLevels(position, params);

    // Store position in active positions map
    this.activePositions.set(positionId, position);

    this.context.logger.info("Position created", {
      positionId,
      symbol: params.symbol,
      side: params.side,
      entryPrice,
      quantity,
      stopLossPrice: position.stopLossPrice,
      takeProfitPrice: position.takeProfitPrice,
    });

    return position;
  }

  /**
   * Calculate stop-loss and take-profit levels for a position
   */
  private calculatePositionLevels(
    position: Position,
    params: TradeParameters
  ): void {
    if (params.stopLossPercent && params.stopLossPercent > 0) {
      if (params.side === "BUY") {
        position.stopLossPrice =
          position.entryPrice * (1 - params.stopLossPercent / 100);
      } else {
        position.stopLossPrice =
          position.entryPrice * (1 + params.stopLossPercent / 100);
      }
    }

    if (params.takeProfitPercent && params.takeProfitPercent > 0) {
      if (params.side === "BUY") {
        position.takeProfitPrice =
          position.entryPrice * (1 + params.takeProfitPercent / 100);
      } else {
        position.takeProfitPrice =
          position.entryPrice * (1 - params.takeProfitPercent / 100);
      }
    }
  }

  /**
   * Setup stop-loss and take-profit monitoring for a position
   */
  async setupPositionMonitoring(
    position: Position,
    _params: TradeParameters
  ): Promise<void> {
    try {
      // Setup stop-loss monitoring
      if (position.stopLossPrice) {
        this.setupStopLossMonitoring(position);
      }

      // Setup take-profit monitoring
      if (position.takeProfitPrice) {
        this.setupTakeProfitMonitoring(position);
      }

      this.context.logger.info("Position monitoring setup completed", {
        positionId: position.id,
        hasStopLoss: !!position.stopLossPrice,
        hasTakeProfit: !!position.takeProfitPrice,
      });
    } catch (error) {
      const safeError =
        error instanceof Error ? error : new Error(String(error));
      this.context.logger.error("Failed to setup position monitoring", {
        positionId: position.id,
        error: safeError.message,
      });
    }
  }

  /**
   * Setup stop-loss monitoring for a position
   */
  private setupStopLossMonitoring(position: Position): void {
    const checkInterval = 5000; // Check every 5 seconds

    const monitorStopLoss = async () => {
      try {
        const currentPrice = await this.getCurrentMarketPrice(position.symbol);
        if (!currentPrice) {
          return;
        }

        // Update position current price
        position.currentPrice = currentPrice;

        // Check if stop-loss should trigger
        let shouldTrigger = false;
        if (
          position.side === "BUY" &&
          currentPrice <= (position.stopLossPrice || 0)
        ) {
          shouldTrigger = true;
        } else if (
          position.side === "SELL" &&
          currentPrice >= (position.stopLossPrice || 0)
        ) {
          shouldTrigger = true;
        }

        if (shouldTrigger) {
          await this.executeStopLoss(position);
        } else {
          // Continue monitoring
          const timer = setTimeout(monitorStopLoss, checkInterval);
          this.pendingStopLosses.set(position.id, timer);
        }
      } catch (error) {
        const safeError =
          error instanceof Error ? error : new Error(String(error));
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
   * Setup take-profit monitoring for a position
   */
  private setupTakeProfitMonitoring(position: Position): void {
    const checkInterval = 5000; // Check every 5 seconds

    const monitorTakeProfit = async () => {
      try {
        const currentPrice = await this.getCurrentMarketPrice(position.symbol);
        if (!currentPrice) {
          return;
        }

        // Update position current price
        position.currentPrice = currentPrice;

        // Check if take-profit should trigger
        let shouldTrigger = false;
        if (
          position.side === "BUY" &&
          currentPrice >= (position.takeProfitPrice || 0)
        ) {
          shouldTrigger = true;
        } else if (
          position.side === "SELL" &&
          currentPrice <= (position.takeProfitPrice || 0)
        ) {
          shouldTrigger = true;
        }

        if (shouldTrigger) {
          await this.executeTakeProfit(position);
        } else {
          // Continue monitoring
          const timer = setTimeout(monitorTakeProfit, checkInterval);
          this.pendingTakeProfits.set(position.id, timer);
        }
      } catch (error) {
        const safeError =
          error instanceof Error ? error : new Error(String(error));
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
        this.processPositionClosure(position, closeResult, "stop-loss");
      } else {
        throw new Error(
          closeResult.error || "Failed to execute stop-loss order"
        );
      }
    } catch (error) {
      const safeError =
        error instanceof Error ? error : new Error(String(error));
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
        this.processPositionClosure(position, closeResult, "take-profit");
      } else {
        throw new Error(
          closeResult.error || "Failed to execute take-profit order"
        );
      }
    } catch (error) {
      const safeError =
        error instanceof Error ? error : new Error(String(error));
      this.context.logger.error("Take-profit execution failed", {
        positionId: position.id,
        error: safeError.message,
      });
    }
  }

  /**
   * Process position closure logic
   */
  private processPositionClosure(
    position: Position,
    closeResult: ServiceResponse<any>,
    reason: string
  ): void {
    // Calculate realized PnL
    const entryValue = position.entryPrice * position.quantity;
    const exitValue = (position.currentPrice || 0) * position.quantity;
    const realizedPnL =
      position.side === "BUY" ? exitValue - entryValue : entryValue - exitValue;

    // Update position
    position.status = "closed";
    position.closeTime = new Date();
    position.realizedPnL = realizedPnL;

    // Clean up monitoring
    this.cleanupPositionMonitoring(position.id);
    this.activePositions.delete(position.id);

    // Emit position closed event
    this.context.eventEmitter.emit("position_closed", position);

    this.context.logger.info(`${reason} executed successfully`, {
      positionId: position.id,
      realizedPnL,
      closeOrderId: closeResult.data?.orderId,
    });
  }

  /**
   * Manually close a position
   */
  async closePosition(
    positionId: string,
    reason: string = "manual"
  ): Promise<ServiceResponse<void>> {
    try {
      const position = this.activePositions.get(positionId);
      if (!position) {
        return {
          success: false,
          error: `Position ${positionId} not found`,
          timestamp: new Date().toISOString(),
        };
      }

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
        const currentPrice =
          (await this.getCurrentMarketPrice(position.symbol)) ||
          position.currentPrice ||
          position.entryPrice;
        const entryValue = position.entryPrice * position.quantity;
        const exitValue = currentPrice * position.quantity;
        const realizedPnL =
          position.side === "BUY"
            ? exitValue - entryValue
            : entryValue - exitValue;

        // Update position
        position.status = "closed";
        position.closeTime = new Date();
        position.realizedPnL = realizedPnL;
        position.notes = `Closed manually: ${reason}`;

        // Clean up monitoring
        this.cleanupPositionMonitoring(position.id);
        this.activePositions.delete(position.id);

        // Emit position closed event
        this.context.eventEmitter.emit("position_closed", position);

        this.context.logger.info("Position closed manually", {
          positionId,
          reason,
          realizedPnL,
          closeOrderId: closeResult.data?.orderId,
        });

        return {
          success: true,
          timestamp: new Date().toISOString(),
        };
      } else {
        return {
          success: false,
          error: closeResult.error || "Failed to close position",
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      const safeError =
        error instanceof Error ? error : new Error(String(error));
      this.context.logger.error("Failed to close position manually", {
        positionId,
        error: safeError.message,
      });

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
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
   * Get active positions
   */
  getActivePositions(): Map<string, Position> {
    return this.activePositions;
  }

  /**
   * Get position by ID
   */
  getPosition(positionId: string): Position | null {
    return this.activePositions.get(positionId) || null;
  }

  /**
   * Close all active positions
   */
  async closeAllPositions(
    reason: string = "shutdown"
  ): Promise<ServiceResponse<{ closed: number; failed: number }>> {
    const positions = Array.from(this.activePositions.keys());
    let closed = 0;
    let failed = 0;

    for (const positionId of positions) {
      try {
        const result = await this.closePosition(positionId, reason);
        if (result.success) {
          closed++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
        const safeError =
          error instanceof Error ? error : new Error(String(error));
        this.context.logger.error(
          `Failed to close position ${positionId}`,
          safeError
        );
      }
    }

    return {
      success: true,
      data: { closed, failed },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Cleanup all position monitoring
   */
  cleanup(): void {
    // Clear all pending timers
    this.pendingStopLosses.forEach((timer) => clearTimeout(timer));
    this.pendingTakeProfits.forEach((timer) => clearTimeout(timer));

    this.pendingStopLosses.clear();
    this.pendingTakeProfits.clear();
  }

  // Helper methods that need to be available
  private async getCurrentMarketPrice(symbol: string): Promise<number | null> {
    // Delegate to market data service
    try {
      if (
        this.context.mexcService &&
        typeof this.context.mexcService.getTicker === "function"
      ) {
        const ticker = await this.context.mexcService.getTicker(symbol);
        if (ticker.success && ticker.data) {
          const priceFields = ["price", "lastPrice", "close", "last"];
          for (const field of priceFields) {
            const fieldValue = (ticker.data as any)[field];
            if (fieldValue) {
              const priceValue = parseFloat(fieldValue);
              if (priceValue > 0) {
                return priceValue;
              }
            }
          }
        }
      }
      return null;
    } catch (error) {
      this.context.logger.error(`Failed to get current price for ${symbol}`, {
        error,
      });
      return null;
    }
  }

  private async executeOrderWithRetry(
    orderParams: TradeParameters,
    maxRetries: number = 3
  ): Promise<ServiceResponse<any>> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const mexcOrderData: any = {
          symbol: orderParams.symbol,
          side: orderParams.side,
          type: orderParams.type,
        };

        if (orderParams.quantity) {
          mexcOrderData.quantity = orderParams.quantity.toString();
        }
        if (orderParams.price) {
          mexcOrderData.price = orderParams.price.toString();
        }
        if (orderParams.timeInForce) {
          mexcOrderData.timeInForce = orderParams.timeInForce;
        }

        const result = await this.context.mexcService.placeOrder(mexcOrderData);

        if (result.success) {
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

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * 2 ** (attempt - 1), 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error("Order execution failed after all retries");
  }
}
