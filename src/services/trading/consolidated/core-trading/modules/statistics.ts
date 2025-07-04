/**
 * Statistics Module
 *
 * Handles statistics tracking and performance metrics.
 * Extracted from auto-sniping.ts for better modularity.
 */

import type {
  AutoSnipingStatus,
  ModuleContext,
  ModuleStats,
  StatsUpdate,
} from "../auto-sniping-types";

export class StatisticsModule {
  private context: ModuleContext;

  // Metrics
  private processedTargets = 0;
  private successfulSnipes = 0;
  private failedSnipes = 0;
  private totalPnL = 0;
  private totalTrades = 0;

  // Tracking for calculations
  private lastSnipeCheck: Date | null = null;
  private confidenceSum = 0;
  private confidenceCount = 0;

  constructor(context: ModuleContext) {
    this.context = context;
  }

  /**
   * Get current statistics
   */
  getStats(): ModuleStats {
    const successRate =
      this.totalTrades > 0
        ? (this.successfulSnipes / this.totalTrades) * 100
        : 0;
    const averagePnL =
      this.totalTrades > 0 ? this.totalPnL / this.totalTrades : 0;

    return {
      activePositions: 0, // This should be injected from position monitoring
      totalTrades: this.totalTrades,
      successfulTrades: this.successfulSnipes,
      failedTrades: this.failedSnipes,
      successRate,
      totalPnL: this.totalPnL,
      averagePnL,
      pendingStopLosses: 0, // This should be injected from position monitoring
      pendingTakeProfits: 0, // This should be injected from position monitoring
      timestamp: Date.now(),
    };
  }

  /**
   * Update statistics with new data
   */
  updateStats(stats: StatsUpdate): void {
    if (stats.totalTrades !== undefined) {
      this.totalTrades = stats.totalTrades;
    }
    if (stats.successfulTrades !== undefined) {
      this.successfulSnipes = stats.successfulTrades;
    }
    if (stats.failedTrades !== undefined) {
      this.failedSnipes = stats.failedTrades;
    }
    if (stats.averageConfidence !== undefined) {
      this.confidenceSum += stats.averageConfidence;
      this.confidenceCount++;
    }

    this.context.logger.debug("Statistics updated", {
      totalTrades: this.totalTrades,
      successfulTrades: this.successfulSnipes,
      failedTrades: this.failedSnipes,
      successRate: this.getSuccessRate(),
    });
  }

  /**
   * Increment successful snipe count
   */
  incrementSuccessfulSnipes(): void {
    this.successfulSnipes++;
    this.totalTrades++;
    this.processedTargets++;
  }

  /**
   * Increment failed snipe count
   */
  incrementFailedSnipes(): void {
    this.failedSnipes++;
    this.totalTrades++;
    this.processedTargets++;
  }

  /**
   * Add trade result to statistics
   */
  addTradeResult(success: boolean, pnl?: number, confidence?: number): void {
    if (success) {
      this.incrementSuccessfulSnipes();
    } else {
      this.incrementFailedSnipes();
    }

    if (pnl !== undefined) {
      this.totalPnL += pnl;
    }

    if (confidence !== undefined) {
      this.confidenceSum += confidence;
      this.confidenceCount++;
    }

    this.context.logger.info("Trade result recorded", {
      success,
      pnl,
      confidence,
      totalTrades: this.totalTrades,
      successRate: this.getSuccessRate(),
    });
  }

  /**
   * Get success rate percentage
   */
  getSuccessRate(): number {
    return this.totalTrades > 0
      ? (this.successfulSnipes / this.totalTrades) * 100
      : 0;
  }

  /**
   * Get average confidence score
   */
  getAverageConfidence(): number {
    return this.confidenceCount > 0
      ? this.confidenceSum / this.confidenceCount
      : 0;
  }

  /**
   * Get processed targets count
   */
  getProcessedTargets(): number {
    return this.processedTargets;
  }

  /**
   * Get successful snipes count
   */
  getSuccessfulSnipes(): number {
    return this.successfulSnipes;
  }

  /**
   * Get failed snipes count
   */
  getFailedSnipes(): number {
    return this.failedSnipes;
  }

  /**
   * Get total PnL
   */
  getTotalPnL(): number {
    return this.totalPnL;
  }

  /**
   * Update last snipe check time
   */
  updateLastSnipeCheck(): void {
    this.lastSnipeCheck = new Date();
  }

  /**
   * Get last snipe check time
   */
  getLastSnipeCheck(): Date | null {
    return this.lastSnipeCheck;
  }

  /**
   * Get auto-sniping status (requires external data for complete status)
   */
  getAutoSnipingStatus(
    isActive: boolean,
    isHealthy: boolean,
    activePositions: number = 0,
    pendingStopLosses: number = 0,
    pendingTakeProfits: number = 0
  ): AutoSnipingStatus & {
    totalTrades: number;
    totalPnL: number;
    averageConfidence: number;
    activePositions: number;
    pendingStopLosses: number;
    pendingTakeProfits: number;
  } {
    return {
      isActive,
      isHealthy,
      lastSnipeCheck: this.lastSnipeCheck,
      processedTargets: this.processedTargets,
      successfulSnipes: this.successfulSnipes,
      failedSnipes: this.failedSnipes,
      successRate: this.getSuccessRate(),
      totalTrades: this.totalTrades,
      totalPnL: this.totalPnL,
      averageConfidence: this.getAverageConfidence(),
      activePositions,
      pendingStopLosses,
      pendingTakeProfits,
    };
  }

  /**
   * Reset all statistics
   */
  reset(): void {
    this.processedTargets = 0;
    this.successfulSnipes = 0;
    this.failedSnipes = 0;
    this.totalPnL = 0;
    this.totalTrades = 0;
    this.confidenceSum = 0;
    this.confidenceCount = 0;
    this.lastSnipeCheck = null;

    this.context.logger.info("Statistics reset");
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    totalTrades: number;
    successRate: number;
    totalPnL: number;
    averagePnL: number;
    averageConfidence: number;
    processedTargets: number;
  } {
    return {
      totalTrades: this.totalTrades,
      successRate: this.getSuccessRate(),
      totalPnL: this.totalPnL,
      averagePnL: this.totalTrades > 0 ? this.totalPnL / this.totalTrades : 0,
      averageConfidence: this.getAverageConfidence(),
      processedTargets: this.processedTargets,
    };
  }
}
