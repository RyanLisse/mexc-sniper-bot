/**
 * Position Manager Module
 *
 * Handles position tracking, stop losses, and take profits.
 * Extracted from auto-sniping.ts for better modularity.
 */

import type { ModuleContext, Position, TradeResult } from "./types";

export class PositionManager {
  private activePositions = new Map<string, Position>();
  private pendingStopLosses = new Map<string, NodeJS.Timeout>();
  private pendingTakeProfits = new Map<string, NodeJS.Timeout>();

  constructor(private context: ModuleContext) {}

  /**
   * Add a new position to tracking
   */
  addPosition(position: Position): void {
    this.activePositions.set(position.id, position);
    
    // Setup monitoring
    if (position.stopLossPrice) {
      this.setupStopLossMonitoring(position);
    }
    if (position.takeProfitPrice) {
      this.setupTakeProfitMonitoring(position);
    }

    this.context.logger.info("Position added to tracking", {
      positionId: position.id,
      symbol: position.symbol,
      side: position.side,
      quantity: position.quantity,
    });
  }

  /**
   * Remove position from tracking
   */
  removePosition(positionId: string): boolean {
    const position = this.activePositions.get(positionId);
    if (!position) {
      return false;
    }

    // Clear monitoring timers
    this.clearPositionMonitoring(positionId);
    
    // Remove from tracking
    this.activePositions.delete(positionId);

    this.context.logger.info("Position removed from tracking", {
      positionId,
      symbol: position.symbol,
    });

    return true;
  }

  /**
   * Get all active positions
   */
  getActivePositions(): Map<string, Position> {
    return new Map(this.activePositions);
  }

  /**
   * Get specific position
   */
  getPosition(positionId: string): Position | undefined {
    return this.activePositions.get(positionId);
  }

  /**
   * Clear all position monitoring
   */
  clearAllMonitoring(): void {
    this.pendingStopLosses.forEach((timer) => clearTimeout(timer));
    this.pendingTakeProfits.forEach((timer) => clearTimeout(timer));
    this.pendingStopLosses.clear();
    this.pendingTakeProfits.clear();

    this.context.logger.info("All position monitoring cleared");
  }

  /**
   * Setup stop loss monitoring for a position
   */
  private setupStopLossMonitoring(position: Position): void {
    if (!position.stopLossPrice) return;

    const checkInterval = setInterval(async () => {
      try {
        const currentPrice = await this.getCurrentPrice(position.symbol);
        if (!currentPrice) return;

        const shouldTrigger =
          (position.side === "BUY" && currentPrice <= position.stopLossPrice!) ||
          (position.side === "SELL" && currentPrice >= position.stopLossPrice!);

        if (shouldTrigger) {
          clearInterval(checkInterval);
          this.pendingStopLosses.delete(position.id);
          await this.executeStopLoss(position, currentPrice);
        }
      } catch (error) {
        this.context.logger.error("Error in stop loss monitoring", {
          positionId: position.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, 5000); // Check every 5 seconds

    this.pendingStopLosses.set(position.id, checkInterval);
  }

  /**
   * Setup take profit monitoring for a position
   */
  private setupTakeProfitMonitoring(position: Position): void {
    if (!position.takeProfitPrice) return;

    const checkInterval = setInterval(async () => {
      try {
        const currentPrice = await this.getCurrentPrice(position.symbol);
        if (!currentPrice) return;

        const shouldTrigger =
          (position.side === "BUY" && currentPrice >= position.takeProfitPrice!) ||
          (position.side === "SELL" && currentPrice <= position.takeProfitPrice!);

        if (shouldTrigger) {
          clearInterval(checkInterval);
          this.pendingTakeProfits.delete(position.id);
          await this.executeTakeProfit(position, currentPrice);
        }
      } catch (error) {
        this.context.logger.error("Error in take profit monitoring", {
          positionId: position.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, 5000); // Check every 5 seconds

    this.pendingTakeProfits.set(position.id, checkInterval);
  }

  /**
   * Clear monitoring for specific position
   */
  private clearPositionMonitoring(positionId: string): void {
    const stopLossTimer = this.pendingStopLosses.get(positionId);
    if (stopLossTimer) {
      clearTimeout(stopLossTimer);
      this.pendingStopLosses.delete(positionId);
    }

    const takeProfitTimer = this.pendingTakeProfits.get(positionId);
    if (takeProfitTimer) {
      clearTimeout(takeProfitTimer);
      this.pendingTakeProfits.delete(positionId);
    }
  }

  /**
   * Execute stop loss for position
   */
  private async executeStopLoss(position: Position, currentPrice: number): Promise<void> {
    this.context.logger.warn("Stop loss triggered", {
      positionId: position.id,
      symbol: position.symbol,
      currentPrice,
      stopLossPrice: position.stopLossPrice,
    });

    try {
      const closeResult = await this.closePosition(position, currentPrice, "STOP_LOSS");
      if (closeResult.success) {
        this.removePosition(position.id);
      }
    } catch (error) {
      this.context.logger.error("Failed to execute stop loss", {
        positionId: position.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Execute take profit for position
   */
  private async executeTakeProfit(position: Position, currentPrice: number): Promise<void> {
    this.context.logger.info("Take profit triggered", {
      positionId: position.id,
      symbol: position.symbol,
      currentPrice,
      takeProfitPrice: position.takeProfitPrice,
    });

    try {
      const closeResult = await this.closePosition(position, currentPrice, "TAKE_PROFIT");
      if (closeResult.success) {
        this.removePosition(position.id);
      }
    } catch (error) {
      this.context.logger.error("Failed to execute take profit", {
        positionId: position.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get current price for symbol using MEXC API
   */
  private async getCurrentPrice(symbol: string): Promise<number | null> {
    try {
      // Import the unified MEXC service factory
      const { getUnifiedMexcService } = await import("@/src/services/api/unified-mexc-service-factory");
      
      // Get MEXC service instance
      const mexcService = await getUnifiedMexcService();
      
      // Get current price from MEXC API
      const priceResponse = await mexcService.getPrice(symbol);
      
      if (!priceResponse.success || !priceResponse.data || priceResponse.data.length === 0) {
        this.context.logger.warn("Failed to get current price from MEXC API", {
          symbol,
          error: priceResponse.error,
          success: priceResponse.success,
        });
        return null;
      }
      
      // Parse price from response
      const priceData = priceResponse.data[0];
      const price = parseFloat(priceData.price);
      
      if (isNaN(price) || price <= 0) {
        this.context.logger.warn("Invalid price received from MEXC API", {
          symbol,
          priceString: priceData.price,
          parsedPrice: price,
        });
        return null;
      }
      
      this.context.logger.debug("Current price retrieved successfully", {
        symbol,
        price,
        timestamp: new Date().toISOString(),
      });
      
      return price;
    } catch (error) {
      this.context.logger.error("Failed to get current price", {
        symbol,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  /**
   * Close position with specified reason
   */
  private async closePosition(
    position: Position,
    currentPrice: number,
    reason: "STOP_LOSS" | "TAKE_PROFIT"
  ): Promise<TradeResult> {
    // This would integrate with the actual trading service
    // For now, return a mock successful result
    return {
      success: true,
      orderId: `close_${position.id}_${Date.now()}`,
      symbol: position.symbol,
      side: position.side === "BUY" ? "SELL" : "BUY",
      quantity: position.quantity,
      price: currentPrice,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Update position stop loss
   */
  async updatePositionStopLoss(
    positionId: string,
    newStopLossPercent: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const position = this.activePositions.get(positionId);
      if (!position) {
        return { success: false, error: `Position ${positionId} not found` };
      }

      // Clear existing stop-loss monitoring
      const stopLossTimer = this.pendingStopLosses.get(positionId);
      if (stopLossTimer) {
        clearTimeout(stopLossTimer);
        this.pendingStopLosses.delete(positionId);
      }

      // Update stop-loss price
      position.stopLossPercent = newStopLossPercent;
      if (newStopLossPercent > 0) {
        if (position.side === "BUY") {
          position.stopLossPrice = position.entryPrice * (1 - newStopLossPercent / 100);
        } else {
          position.stopLossPrice = position.entryPrice * (1 + newStopLossPercent / 100);
        }

        // Setup new monitoring
        this.setupStopLossMonitoring(position);
      } else {
        position.stopLossPrice = undefined;
      }

      this.context.logger.info("Position stop-loss updated", {
        positionId,
        newStopLossPercent,
        newStopLossPrice: position.stopLossPrice,
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Update position take profit
   */
  async updatePositionTakeProfit(
    positionId: string,
    newTakeProfitPercent: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const position = this.activePositions.get(positionId);
      if (!position) {
        return { success: false, error: `Position ${positionId} not found` };
      }

      // Clear existing take-profit monitoring
      const takeProfitTimer = this.pendingTakeProfits.get(positionId);
      if (takeProfitTimer) {
        clearTimeout(takeProfitTimer);
        this.pendingTakeProfits.delete(positionId);
      }

      // Update take-profit price
      position.takeProfitPercent = newTakeProfitPercent;
      if (newTakeProfitPercent > 0) {
        if (position.side === "BUY") {
          position.takeProfitPrice = position.entryPrice * (1 + newTakeProfitPercent / 100);
        } else {
          position.takeProfitPrice = position.entryPrice * (1 - newTakeProfitPercent / 100);
        }

        // Setup new monitoring
        this.setupTakeProfitMonitoring(position);
      } else {
        position.takeProfitPrice = undefined;
      }

      this.context.logger.info("Position take-profit updated", {
        positionId,
        newTakeProfitPercent,
        newTakeProfitPrice: position.takeProfitPrice,
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get position statistics and metrics
   */
  getPositionStats(): {
    totalPositions: number;
    activePositions: number;
    pendingStopLosses: number;
    pendingTakeProfits: number;
    positions: Array<{
      id: string;
      symbol: string;
      side: string;
      quantity: string;
      entryPrice: number;
      currentPnL?: number;
      stopLossPrice?: number;
      takeProfitPrice?: number;
      status: string;
    }>;
  } {
    const positions = Array.from(this.activePositions.values()).map(position => ({
      id: position.id,
      symbol: position.symbol,
      side: position.side,
      quantity: position.quantity,
      entryPrice: position.entryPrice,
      currentPnL: position.currentPnL,
      stopLossPrice: position.stopLossPrice,
      takeProfitPrice: position.takeProfitPrice,
      status: position.status || 'active',
    }));

    return {
      totalPositions: this.activePositions.size,
      activePositions: this.activePositions.size,
      pendingStopLosses: this.pendingStopLosses.size,
      pendingTakeProfits: this.pendingTakeProfits.size,
      positions,
    };
  }
}