/**
 * Position Manager Module
 *
 * Handles position monitoring, stop losses, and take profits.
 * Extracted from auto-sniping.ts for better modularity and maintainability.
 */

import { toSafeError } from "@/src/lib/error-type-utils";
import type {
  CoreTradingConfig,
  ModuleContext,
  Position,
  ServiceResponse,
  TradeResult,
} from "../types";

export class PositionManager {
  private context: ModuleContext;
  private activePositions = new Map<string, Position>();
  private pendingStopLosses = new Map<string, NodeJS.Timeout>();
  private pendingTakeProfits = new Map<string, NodeJS.Timeout>();

  constructor(context: ModuleContext) {
    this.context = context;
  }

  /**
   * Initialize the position manager
   */
  async initialize(): Promise<void> {
    try {
      this.context.logger.info('PositionManager initialized successfully');
    } catch (error) {
      this.context.logger.error('Failed to initialize PositionManager', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CoreTradingConfig>): void {
    this.context.config = { ...this.context.config, ...newConfig };
    this.context.logger.info('PositionManager configuration updated');
  }

  /**
   * Setup monitoring for a new position
   */
  async setupPositionMonitoring(
    position: Position,
    result: TradeResult
  ): Promise<void> {
    try {
      // Store position for tracking
      this.activePositions.set(position.id, position);

      // Setup stop loss monitoring if enabled
      if (position.stopLoss && this.context.config.riskManagement.stopLossEnabled) {
        this.setupStopLossMonitoring(position);
      }

      // Setup take profit monitoring if enabled
      if (position.takeProfit && this.context.config.riskManagement.takeProfitEnabled) {
        this.setupTakeProfitMonitoring(position);
      }

      this.context.logger.info(`Position monitoring setup for ${position.symbol}`, {
        positionId: position.id,
        symbol: position.symbol,
        quantity: position.quantity,
        stopLoss: position.stopLoss,
        takeProfit: position.takeProfit,
      });
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to setup position monitoring", {
        position,
        error: safeError,
      });
      throw error;
    }
  }

  /**
   * Setup stop loss monitoring for a position
   */
  private setupStopLossMonitoring(position: Position): void {
    if (!position.stopLoss) return;

    const checkInterval = this.context.config.riskManagement.priceCheckInterval || 5000;
    
    const stopLossTimer = setInterval(async () => {
      try {
        const currentPrice = await this.getCurrentMarketPrice(position.symbol);
        if (!currentPrice) return;

        const shouldTrigger = position.side === "BUY" 
          ? currentPrice <= position.stopLoss!
          : currentPrice >= position.stopLoss!;

        if (shouldTrigger) {
          await this.executeStopLoss(position);
        }
      } catch (error) {
        const safeError = toSafeError(error);
        this.context.logger.error("Stop loss monitoring error", {
          positionId: position.id,
          error: safeError,
        });
      }
    }, checkInterval);

    this.pendingStopLosses.set(position.id, stopLossTimer);
  }

  /**
   * Setup take profit monitoring for a position
   */
  private setupTakeProfitMonitoring(position: Position): void {
    if (!position.takeProfit) return;

    const checkInterval = this.context.config.riskManagement.priceCheckInterval || 5000;
    
    const takeProfitTimer = setInterval(async () => {
      try {
        const currentPrice = await this.getCurrentMarketPrice(position.symbol);
        if (!currentPrice) return;

        const shouldTrigger = position.side === "BUY" 
          ? currentPrice >= position.takeProfit!
          : currentPrice <= position.takeProfit!;

        if (shouldTrigger) {
          await this.executeTakeProfit(position);
        }
      } catch (error) {
        const safeError = toSafeError(error);
        this.context.logger.error("Take profit monitoring error", {
          positionId: position.id,
          error: safeError,
        });
      }
    }, checkInterval);

    this.pendingTakeProfits.set(position.id, takeProfitTimer);
  }

  /**
   * Execute stop loss for a position
   */
  private async executeStopLoss(position: Position): Promise<void> {
    try {
      this.context.logger.warn(`Executing stop loss for position ${position.id}`, {
        symbol: position.symbol,
        stopLoss: position.stopLoss,
        quantity: position.quantity,
      });

      // Close the position via trading strategy
      const closeResult = await this.context.tradingStrategy.closePosition(
        position.id,
        "stop_loss"
      );

      if (closeResult.success) {
        this.cleanupPositionMonitoring(position.id);
        this.activePositions.delete(position.id);
        
        this.context.logger.info(`Stop loss executed successfully for ${position.id}`);
      } else {
        this.context.logger.error(`Failed to execute stop loss for ${position.id}`, {
          error: closeResult.error,
        });
      }
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Stop loss execution failed", {
        positionId: position.id,
        error: safeError,
      });
    }
  }

  /**
   * Execute take profit for a position
   */
  private async executeTakeProfit(position: Position): Promise<void> {
    try {
      this.context.logger.info(`Executing take profit for position ${position.id}`, {
        symbol: position.symbol,
        takeProfit: position.takeProfit,
        quantity: position.quantity,
      });

      // Close the position via trading strategy
      const closeResult = await this.context.tradingStrategy.closePosition(
        position.id,
        "take_profit"
      );

      if (closeResult.success) {
        this.cleanupPositionMonitoring(position.id);
        this.activePositions.delete(position.id);
        
        this.context.logger.info(`Take profit executed successfully for ${position.id}`);
      } else {
        this.context.logger.error(`Failed to execute take profit for ${position.id}`, {
          error: closeResult.error,
        });
      }
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Take profit execution failed", {
        positionId: position.id,
        error: safeError,
      });
    }
  }

  /**
   * Close a specific position
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

      const closeResult = await this.context.tradingStrategy.closePosition(
        positionId,
        reason
      );

      if (closeResult.success) {
        this.cleanupPositionMonitoring(positionId);
        this.activePositions.delete(positionId);
      }

      return {
        success: closeResult.success,
        error: closeResult.error,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to close position", {
        positionId,
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
   * Close all active positions
   */
  async closeAllPositions(
    reason: string = "shutdown"
  ): Promise<ServiceResponse<{ closed: number; failed: number }>> {
    try {
      const results = { closed: 0, failed: 0 };

      for (const [positionId] of this.activePositions) {
        const result = await this.closePosition(positionId, reason);
        if (result.success) {
          results.closed++;
        } else {
          results.failed++;
        }
      }

      return {
        success: true,
        data: results,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to close all positions", safeError);

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Update stop loss for a position
   */
  async updatePositionStopLoss(
    positionId: string,
    newStopLoss: number
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

      // Update position stop loss
      position.stopLoss = newStopLoss;
      this.activePositions.set(positionId, position);

      // Cleanup existing stop loss monitoring
      const existingTimer = this.pendingStopLosses.get(positionId);
      if (existingTimer) {
        clearInterval(existingTimer);
        this.pendingStopLosses.delete(positionId);
      }

      // Setup new stop loss monitoring
      this.setupStopLossMonitoring(position);

      this.context.logger.info(`Updated stop loss for position ${positionId}`, {
        oldStopLoss: position.stopLoss,
        newStopLoss,
      });

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to update position stop loss", {
        positionId,
        newStopLoss,
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
   * Update take profit for a position
   */
  async updatePositionTakeProfit(
    positionId: string,
    newTakeProfit: number
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

      // Update position take profit
      position.takeProfit = newTakeProfit;
      this.activePositions.set(positionId, position);

      // Cleanup existing take profit monitoring
      const existingTimer = this.pendingTakeProfits.get(positionId);
      if (existingTimer) {
        clearInterval(existingTimer);
        this.pendingTakeProfits.delete(positionId);
      }

      // Setup new take profit monitoring
      this.setupTakeProfitMonitoring(position);

      this.context.logger.info(`Updated take profit for position ${positionId}`, {
        oldTakeProfit: position.takeProfit,
        newTakeProfit,
      });

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to update position take profit", {
        positionId,
        newTakeProfit,
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
   * Cleanup position monitoring timers
   */
  private cleanupPositionMonitoring(positionId: string): void {
    const stopLossTimer = this.pendingStopLosses.get(positionId);
    if (stopLossTimer) {
      clearInterval(stopLossTimer);
      this.pendingStopLosses.delete(positionId);
    }

    const takeProfitTimer = this.pendingTakeProfits.get(positionId);
    if (takeProfitTimer) {
      clearInterval(takeProfitTimer);
      this.pendingTakeProfits.delete(positionId);
    }
  }

  /**
   * Get current market price for a symbol
   */
  private async getCurrentMarketPrice(symbol: string): Promise<number | null> {
    try {
      // Use market data service to get current price
      const marketData = await this.context.marketDataService.getCurrentPrice(symbol);
      return marketData?.price || null;
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
   * Get position statistics
   */
  async getPositionStats() {
    const activePositions = Array.from(this.activePositions.values());
    return {
      totalPositions: activePositions.length,
      activePositions: activePositions.length,
      activeCount: activePositions.length,
      pendingStopLosses: this.pendingStopLosses.size,
      pendingTakeProfits: this.pendingTakeProfits.size,
      positions: activePositions.map(position => ({
        id: position.id,
        symbol: position.symbol,
        side: position.side,
        quantity: position.quantity,
        entryPrice: position.entryPrice,
        currentPnL: position.unrealizedPnL,
        stopLossPrice: position.stopLoss,
        takeProfitPrice: position.takeProfit,
        status: position.status,
        openTime: position.timestamp
      }))
    };
  }

  /**
   * Get all active positions
   */
  getActivePositions(): Map<string, Position> {
    return new Map(this.activePositions);
  }

  /**
   * Shutdown and cleanup all timers
   */
  shutdown(): void {
    // Clear all pending timers
    for (const timer of this.pendingStopLosses.values()) {
      clearInterval(timer);
    }
    for (const timer of this.pendingTakeProfits.values()) {
      clearInterval(timer);
    }

    this.pendingStopLosses.clear();
    this.pendingTakeProfits.clear();
    this.activePositions.clear();
  }
}