/**
 * Position Monitor Module
 *
 * Handles position monitoring and management for auto-sniping operations.
 * Extracted from the original monolithic implementation for better maintainability.
 */

import { toSafeError } from "../../../lib/error-type-utils";
import type { ModuleContext, ModuleState, ServiceResponse, TradingPosition } from "./types";

export class PositionMonitor {
  private context: ModuleContext;
  private state: ModuleState;

  // Position tracking
  private openPositions = new Map<string, TradingPosition>();
  private closedPositions: TradingPosition[] = [];

  // Performance tracking
  private totalRealizedPnL = 0;
  private totalUnrealizedPnL = 0;
  private peakValue = 0;
  private maxDrawdown = 0;
  private successfulTrades = 0;
  private totalTradesExecuted = 0;

  // Monitoring interval
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly MONITORING_INTERVAL = 5000; // 5 seconds

  constructor(context: ModuleContext) {
    this.context = context;
    this.state = {
      isInitialized: false,
      isHealthy: true,
      lastActivity: new Date(),
      metrics: {
        openPositions: 0,
        totalPositions: 0,
        realizedPnL: 0,
        unrealizedPnL: 0,
        successfulTrades: 0,
        maxDrawdown: 0,
      },
    };
  }

  /**
   * Initialize the position monitor module
   */
  async initialize(): Promise<void> {
    this.context.logger.info("Initializing Position Monitor Module");

    // Start position monitoring
    this.startMonitoring();

    this.state.isInitialized = true;
    this.state.lastActivity = new Date();
    this.context.logger.info("Position Monitor Module initialized successfully");
  }

  /**
   * Shutdown the position monitor module
   */
  async shutdown(): Promise<void> {
    this.context.logger.info("Shutting down Position Monitor Module");

    this.stopMonitoring();
    this.openPositions.clear();
    this.closedPositions = [];
    this.state.isInitialized = false;
  }

  /**
   * Update configuration
   */
  async updateConfig(newContext: ModuleContext): Promise<void> {
    this.context = newContext;
    this.context.logger.info("Position Monitor Module configuration updated");
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<"operational" | "degraded" | "offline"> {
    if (!this.state.isInitialized) return "offline";
    if (!this.state.isHealthy) return "degraded";

    // Check if monitoring is active
    if (!this.monitoringInterval) return "degraded";

    return "operational";
  }

  /**
   * Add a new position to monitor
   */
  async addPosition(position: TradingPosition): Promise<ServiceResponse<void>> {
    try {
      this.context.logger.info("Adding position to monitor", { position });

      // Validate position
      if (!position.id || !position.symbol) {
        throw new Error("Position must have ID and symbol");
      }

      // Check for duplicate
      if (this.openPositions.has(position.id)) {
        throw new Error(`Position ${position.id} already exists`);
      }

      // Check position limit
      if (this.openPositions.size >= this.context.config.maxConcurrentPositions) {
        throw new Error(
          `Maximum concurrent positions (${this.context.config.maxConcurrentPositions}) reached`
        );
      }

      // Add position
      this.openPositions.set(position.id, {
        ...position,
        status: "open",
        lastUpdated: new Date().toISOString(),
      });

      this.totalTradesExecuted++;
      this.updateMetrics();
      this.state.lastActivity = new Date();

      this.context.eventEmitter.emit("position_opened", position);

      this.context.logger.info("Position added successfully", {
        positionId: position.id,
        symbol: position.symbol,
        totalOpen: this.openPositions.size,
      });

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error(`Failed to add position ${position.symbol}: ${safeError.message}`);

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Close a position
   */
  async closePosition(
    positionId: string,
    reason: string = "manual"
  ): Promise<ServiceResponse<TradingPosition>> {
    try {
      this.context.logger.info("Closing position", { positionId, reason });

      const position = this.openPositions.get(positionId);
      if (!position) {
        throw new Error(`Position ${positionId} not found`);
      }

      // Calculate final PnL
      const currentPrice = await this.getCurrentPrice(position.symbol);
      const realizedPnL = this.calculateRealizedPnL(position, currentPrice);

      // Update position
      const closedPosition: TradingPosition = {
        ...position,
        status: "closed",
        currentPrice,
        unrealizedPnL: realizedPnL,
        lastUpdated: new Date().toISOString(),
      };

      // Move to closed positions
      this.openPositions.delete(positionId);
      this.closedPositions.push(closedPosition);

      // Update performance tracking
      this.totalRealizedPnL += realizedPnL;
      if (realizedPnL > 0) {
        this.successfulTrades++;
      }

      this.updateDrawdown();
      this.updateMetrics();
      this.state.lastActivity = new Date();

      this.context.eventEmitter.emit("position_closed", closedPosition);

      this.context.logger.info("Position closed successfully", {
        positionId,
        realizedPnL,
        reason,
        totalOpen: this.openPositions.size,
      });

      return {
        success: true,
        data: closedPosition,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error(`Failed to close position ${positionId}: ${safeError.message}`);

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Close all open positions
   */
  async closeAllPositions(): Promise<ServiceResponse<number>> {
    try {
      this.context.logger.info("Closing all open positions", {
        count: this.openPositions.size,
      });

      const positionIds = Array.from(this.openPositions.keys());
      let closedCount = 0;

      for (const positionId of positionIds) {
        const result = await this.closePosition(positionId, "close_all");
        if (result.success) {
          closedCount++;
        }
      }

      this.context.logger.info("All positions closed", {
        attempted: positionIds.length,
        successful: closedCount,
      });

      return {
        success: true,
        data: closedCount,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error(`Failed to close all positions: ${safeError.message}`);

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get open positions count
   */
  async getOpenPositionsCount(): Promise<number> {
    return this.openPositions.size;
  }

  /**
   * Get successful trades count
   */
  async getSuccessfulTradesCount(): Promise<number> {
    return this.successfulTrades;
  }

  /**
   * Get current profit/loss summary
   */
  async getProfitLoss() {
    await this.updateUnrealizedPnL();

    return {
      realized: this.totalRealizedPnL,
      unrealized: this.totalUnrealizedPnL,
      total: this.totalRealizedPnL + this.totalUnrealizedPnL,
      percentage:
        this.peakValue > 0
          ? ((this.totalRealizedPnL + this.totalUnrealizedPnL) / this.peakValue) * 100
          : 0,
    };
  }

  /**
   * Get profitability metric
   */
  async getProfitability(): Promise<number> {
    return this.totalTradesExecuted > 0 ? this.totalRealizedPnL / this.totalTradesExecuted : 0;
  }

  /**
   * Get maximum drawdown
   */
  async getMaxDrawdown(): Promise<number> {
    return this.maxDrawdown;
  }

  /**
   * Get Sharpe ratio (simplified)
   */
  async getSharpeRatio(): Promise<number> {
    if (this.totalTradesExecuted < 10) return 0;

    const avgReturn = this.totalRealizedPnL / this.totalTradesExecuted;
    const riskFreeRate = 0; // Simplified
    const stdDev = Math.abs(this.totalRealizedPnL) * 0.1; // Rough estimation

    return stdDev > 0 ? (avgReturn - riskFreeRate) / stdDev : 0;
  }

  /**
   * Get all open positions
   */
  getOpenPositions(): TradingPosition[] {
    return Array.from(this.openPositions.values());
  }

  /**
   * Get position metrics
   */
  getMetrics() {
    return {
      ...this.state.metrics,
      totalClosedPositions: this.closedPositions.length,
      averageHoldTime: this.calculateAverageHoldTime(),
      winRate:
        this.totalTradesExecuted > 0 ? (this.successfulTrades / this.totalTradesExecuted) * 100 : 0,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Start position monitoring
   */
  private startMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.monitorPositions();
      } catch (error) {
        this.context.logger.error(`Position monitoring failed: ${toSafeError(error).message}`);
      }
    }, this.MONITORING_INTERVAL);

    this.context.logger.debug("Position monitoring started", {
      interval: this.MONITORING_INTERVAL,
    });
  }

  /**
   * Stop position monitoring
   */
  private stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.context.logger.debug("Position monitoring stopped");
  }

  /**
   * Monitor all open positions
   */
  private async monitorPositions(): Promise<void> {
    if (this.openPositions.size === 0) return;

    this.context.logger.debug("Monitoring positions", {
      count: this.openPositions.size,
    });

    for (const [positionId, position] of this.openPositions.entries()) {
      try {
        await this.monitorSinglePosition(positionId, position);
      } catch (error) {
        this.context.logger.error(
          `Failed to monitor position ${positionId}: ${toSafeError(error).message}`
        );
      }
    }

    await this.updateUnrealizedPnL();
    this.updateMetrics();
  }

  /**
   * Monitor a single position
   */
  private async monitorSinglePosition(
    positionId: string,
    position: TradingPosition
  ): Promise<void> {
    const currentPrice = await this.getCurrentPrice(position.symbol);
    const unrealizedPnL = this.calculateUnrealizedPnL(position, currentPrice);

    // Update position with current data
    const updatedPosition = {
      ...position,
      currentPrice,
      unrealizedPnL,
      lastUpdated: new Date().toISOString(),
    };

    this.openPositions.set(positionId, updatedPosition);

    // Check stop loss
    if (position.stopLoss && currentPrice <= position.stopLoss) {
      this.context.logger.warn("Stop loss triggered", {
        positionId,
        symbol: position.symbol,
        currentPrice,
        stopLoss: position.stopLoss,
      });

      await this.closePosition(positionId, "stop_loss");
      return;
    }

    // Check take profit
    if (position.takeProfit && currentPrice >= position.takeProfit) {
      this.context.logger.info("Take profit triggered", {
        positionId,
        symbol: position.symbol,
        currentPrice,
        takeProfit: position.takeProfit,
      });

      await this.closePosition(positionId, "take_profit");
      return;
    }

    // Check for significant price moves
    const pnlPercentage = (unrealizedPnL / (position.entryPrice * position.amount)) * 100;

    if (Math.abs(pnlPercentage) > 10) {
      // 10% move
      this.context.logger.info("Significant price movement detected", {
        positionId,
        symbol: position.symbol,
        pnlPercentage: pnlPercentage.toFixed(2),
        unrealizedPnL,
      });
    }
  }

  /**
   * Get current price for a symbol (simulated)
   */
  private async getCurrentPrice(_symbol: string): Promise<number> {
    // Simulate price movement - in real implementation would call API
    const basePrice = 100 + Math.random() * 1000;
    const volatility = 0.02; // 2% volatility
    const change = (Math.random() - 0.5) * 2 * volatility;

    return basePrice * (1 + change);
  }

  /**
   * Calculate realized PnL for a closed position
   */
  private calculateRealizedPnL(position: TradingPosition, exitPrice: number): number {
    const entryValue = position.entryPrice * position.amount;
    const exitValue = exitPrice * position.amount;

    return exitValue - entryValue;
  }

  /**
   * Calculate unrealized PnL for an open position
   */
  private calculateUnrealizedPnL(position: TradingPosition, currentPrice: number): number {
    const entryValue = position.entryPrice * position.amount;
    const currentValue = currentPrice * position.amount;

    return currentValue - entryValue;
  }

  /**
   * Update unrealized PnL for all open positions
   */
  private async updateUnrealizedPnL(): Promise<void> {
    let totalUnrealized = 0;

    for (const position of Array.from(this.openPositions.values())) {
      if (position.currentPrice) {
        const unrealizedPnL = this.calculateUnrealizedPnL(position, position.currentPrice);
        totalUnrealized += unrealizedPnL;
      }
    }

    this.totalUnrealizedPnL = totalUnrealized;
  }

  /**
   * Update drawdown calculations
   */
  private updateDrawdown(): void {
    const totalValue = this.totalRealizedPnL + this.totalUnrealizedPnL;

    if (totalValue > this.peakValue) {
      this.peakValue = totalValue;
    } else {
      const currentDrawdown = this.peakValue - totalValue;
      this.maxDrawdown = Math.max(this.maxDrawdown, currentDrawdown);
    }
  }

  /**
   * Calculate average hold time for closed positions
   */
  private calculateAverageHoldTime(): number {
    if (this.closedPositions.length === 0) return 0;

    const holdTimes = this.closedPositions.map((position) => {
      const opened = new Date(position.timestamp);
      const closed = new Date(position.lastUpdated || position.timestamp);
      return closed.getTime() - opened.getTime();
    });

    const averageMs = holdTimes.reduce((sum, time) => sum + time, 0) / holdTimes.length;
    return averageMs / (1000 * 60); // Convert to minutes
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    this.state.metrics = {
      openPositions: this.openPositions.size,
      totalPositions: this.totalTradesExecuted,
      realizedPnL: this.totalRealizedPnL,
      unrealizedPnL: this.totalUnrealizedPnL,
      successfulTrades: this.successfulTrades,
      maxDrawdown: this.maxDrawdown,
    };
  }
}
