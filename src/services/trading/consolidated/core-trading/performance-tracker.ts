/**
 * Performance Tracker Module
 *
 * Handles performance analytics, metrics calculation, and reporting.
 * Extracted from the original monolithic core-trading.service.ts for modularity.
 */

import type {
  ModuleContext,
  ModuleState,
  PerformanceMetrics,
  Position,
  TradeResult,
} from "./types";

export class PerformanceTracker {
  private context: ModuleContext;
  private state: ModuleState;

  // Performance tracking
  private startTime = new Date();
  private totalTrades = 0;
  private successfulTrades = 0;
  private failedTrades = 0;
  private totalVolume = 0;
  private totalPnL = 0;
  private totalExecutionTime = 0;

  // Auto-sniping metrics
  private autoSnipeCount = 0;
  private autoSnipeSuccessful = 0;
  private totalConfidenceScore = 0;

  // Strategy performance tracking
  private strategyPerformance: Record<
    string,
    {
      trades: number;
      successRate: number;
      averagePnL: number;
      maxDrawdown: number;
    }
  > = {};

  // Risk metrics
  private maxDrawdown = 0;
  private currentDrawdown = 0;
  private peakValue = 0;
  private consecutiveLosses = 0;
  private consecutiveWins = 0;
  private maxConsecutiveLosses = 0;
  private maxConsecutiveWins = 0;

  constructor(context: ModuleContext) {
    this.context = context;
    this.state = {
      isInitialized: false,
      isHealthy: true,
      lastActivity: new Date(),
      metrics: {
        totalTrades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        totalVolume: 0,
        totalPnL: 0,
        successRate: 0,
        averageExecutionTime: 0,
        maxDrawdown: 0,
      },
    };

    // Listen for events to track performance
    this.context.eventEmitter.on(
      "trade_executed",
      this.handleTradeExecuted.bind(this)
    );
    this.context.eventEmitter.on(
      "position_closed",
      this.handlePositionClosed.bind(this)
    );
    this.context.eventEmitter.on(
      "auto_snipe_executed",
      this.handleAutoSnipeExecuted.bind(this)
    );
  }

  /**
   * Initialize the performance tracker module
   */
  async initialize(): Promise<void> {
    this.context.logger.info("Initializing Performance Tracker Module");
    this.startTime = new Date();
    this.state.isInitialized = true;
    this.context.logger.info(
      "Performance Tracker Module initialized successfully"
    );
  }

  /**
   * Shutdown the performance tracker module
   */
  async shutdown(): Promise<void> {
    this.context.logger.info("Shutting down Performance Tracker Module");
    this.state.isInitialized = false;
  }

  /**
   * Update configuration
   */
  async updateConfig(config: any): Promise<void> {
    this.context.config = config;
    this.context.logger.info(
      "Performance Tracker Module configuration updated"
    );
  }

  /**
   * Get comprehensive performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const timeframe = "session";
    const startDate = this.startTime;
    const endDate = new Date();
    const tradingDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const metrics: PerformanceMetrics = {
      // Trading Statistics
      totalTrades: this.totalTrades,
      successfulTrades: this.successfulTrades,
      failedTrades: this.failedTrades,
      successRate:
        this.totalTrades > 0
          ? (this.successfulTrades / this.totalTrades) * 100
          : 0,

      // Financial Performance
      totalPnL: this.totalPnL,
      realizedPnL: this.totalPnL, // For now, same as total
      unrealizedPnL: 0, // Would calculate from open positions
      totalVolume: this.totalVolume,
      averageTradeSize:
        this.totalTrades > 0 ? this.totalVolume / this.totalTrades : 0,

      // Risk Metrics
      maxDrawdown: this.maxDrawdown,
      sharpeRatio: this.calculateSharpeRatio(),
      sortinoRatio: this.calculateSortinoRatio(),
      calmarRatio: this.calculateCalmarRatio(),
      maxConsecutiveLosses: this.maxConsecutiveLosses,
      maxConsecutiveWins: this.maxConsecutiveWins,

      // Execution Metrics
      averageExecutionTime:
        this.totalTrades > 0 ? this.totalExecutionTime / this.totalTrades : 0,
      slippageAverage: 0, // Would calculate from actual vs expected prices
      fillRate:
        this.totalTrades > 0
          ? (this.successfulTrades / this.totalTrades) * 100
          : 0,

      // Auto-Sniping Metrics
      autoSnipeCount: this.autoSnipeCount,
      autoSnipeSuccessRate:
        this.autoSnipeCount > 0
          ? (this.autoSnipeSuccessful / this.autoSnipeCount) * 100
          : 0,
      averageConfidenceScore:
        this.autoSnipeCount > 0
          ? this.totalConfidenceScore / this.autoSnipeCount
          : 0,

      // Time-based Metrics
      timeframe,
      startDate,
      endDate,
      tradingDays,

      // Strategy Performance
      strategyPerformance: { ...this.strategyPerformance },
    };

    // Update internal state metrics
    this.state.metrics = {
      totalTrades: this.totalTrades,
      successfulTrades: this.successfulTrades,
      failedTrades: this.failedTrades,
      totalVolume: this.totalVolume,
      totalPnL: this.totalPnL,
      successRate: metrics.successRate,
      averageExecutionTime: metrics.averageExecutionTime,
      maxDrawdown: this.maxDrawdown,
    };

    return metrics;
  }

  /**
   * Reset all performance metrics
   */
  async resetMetrics(): Promise<void> {
    this.context.logger.info("Resetting performance metrics");

    this.startTime = new Date();
    this.totalTrades = 0;
    this.successfulTrades = 0;
    this.failedTrades = 0;
    this.totalVolume = 0;
    this.totalPnL = 0;
    this.totalExecutionTime = 0;

    this.autoSnipeCount = 0;
    this.autoSnipeSuccessful = 0;
    this.totalConfidenceScore = 0;

    this.strategyPerformance = {};

    this.maxDrawdown = 0;
    this.currentDrawdown = 0;
    this.peakValue = 0;
    this.consecutiveLosses = 0;
    this.consecutiveWins = 0;
    this.maxConsecutiveLosses = 0;
    this.maxConsecutiveWins = 0;

    this.state.metrics = {
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      totalVolume: 0,
      totalPnL: 0,
      successRate: 0,
      averageExecutionTime: 0,
      maxDrawdown: 0,
    };
  }

  /**
   * Get current performance summary
   */
  getCurrentSummary() {
    return {
      totalTrades: this.totalTrades,
      successRate:
        this.totalTrades > 0
          ? (this.successfulTrades / this.totalTrades) * 100
          : 0,
      totalPnL: this.totalPnL,
      maxDrawdown: this.maxDrawdown,
      autoSnipeStats: {
        count: this.autoSnipeCount,
        successRate:
          this.autoSnipeCount > 0
            ? (this.autoSnipeSuccessful / this.autoSnipeCount) * 100
            : 0,
        averageConfidence:
          this.autoSnipeCount > 0
            ? this.totalConfidenceScore / this.autoSnipeCount
            : 0,
      },
      uptime: Date.now() - this.startTime.getTime(),
    };
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle trade executed event
   */
  private handleTradeExecuted(result: TradeResult): void {
    this.totalTrades++;

    if (result.success) {
      this.successfulTrades++;

      // Track execution time
      if (result.executionTime) {
        this.totalExecutionTime += result.executionTime;
      }

      // Track volume
      if (result.data?.quantity && result.data?.price) {
        const volume =
          parseFloat(result.data.quantity) * parseFloat(result.data.price);
        this.totalVolume += volume;
      }

      // Track strategy performance
      if (result.data?.autoSnipe) {
        this.updateStrategyPerformance("auto-snipe", true);
      }

      this.consecutiveWins++;
      this.consecutiveLosses = 0;
      this.maxConsecutiveWins = Math.max(
        this.maxConsecutiveWins,
        this.consecutiveWins
      );
    } else {
      this.failedTrades++;
      this.consecutiveLosses++;
      this.consecutiveWins = 0;
      this.maxConsecutiveLosses = Math.max(
        this.maxConsecutiveLosses,
        this.consecutiveLosses
      );

      // Track strategy performance
      if (result.data?.autoSnipe) {
        this.updateStrategyPerformance("auto-snipe", false);
      }
    }

    this.state.lastActivity = new Date();
  }

  /**
   * Handle position closed event
   */
  private handlePositionClosed(position: Position): void {
    if (position.realizedPnL !== undefined) {
      this.totalPnL += position.realizedPnL;

      // Update drawdown calculations
      this.updateDrawdown();

      // Track strategy performance
      if (position.strategy) {
        this.updateStrategyPerformance(
          position.strategy,
          position.realizedPnL > 0,
          position.realizedPnL
        );
      }
    }

    this.state.lastActivity = new Date();
  }

  /**
   * Handle auto-snipe executed event
   */
  private handleAutoSnipeExecuted(data: {
    target: any;
    result: TradeResult;
  }): void {
    this.autoSnipeCount++;

    if (data.result.success) {
      this.autoSnipeSuccessful++;
    }

    if (data.target.confidenceScore) {
      this.totalConfidenceScore += data.target.confidenceScore;
    }

    this.state.lastActivity = new Date();
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Update strategy performance tracking
   */
  private updateStrategyPerformance(
    strategyName: string,
    success: boolean,
    pnl?: number
  ): void {
    if (!this.strategyPerformance[strategyName]) {
      this.strategyPerformance[strategyName] = {
        trades: 0,
        successRate: 0,
        averagePnL: 0,
        maxDrawdown: 0,
      };
    }

    const strategy = this.strategyPerformance[strategyName];
    strategy.trades++;

    if (success) {
      strategy.successRate =
        (strategy.successRate * (strategy.trades - 1) + 100) / strategy.trades;
    } else {
      strategy.successRate =
        (strategy.successRate * (strategy.trades - 1)) / strategy.trades;
    }

    if (pnl !== undefined) {
      const currentAverage = strategy.averagePnL * (strategy.trades - 1);
      strategy.averagePnL = (currentAverage + pnl) / strategy.trades;
    }
  }

  /**
   * Update drawdown calculations
   */
  private updateDrawdown(): void {
    if (this.totalPnL > this.peakValue) {
      this.peakValue = this.totalPnL;
      this.currentDrawdown = 0;
    } else {
      this.currentDrawdown = this.peakValue - this.totalPnL;
      this.maxDrawdown = Math.max(this.maxDrawdown, this.currentDrawdown);
    }
  }

  /**
   * Calculate Sharpe ratio (simplified)
   */
  private calculateSharpeRatio(): number | undefined {
    if (this.totalTrades < 10) return undefined; // Need more data

    // Simplified calculation - would need returns series for accurate calculation
    const averageReturn = this.totalPnL / this.totalTrades;
    const riskFreeRate = 0; // Assume 0 for simplicity

    // Would need standard deviation of returns for accurate calculation
    const estimatedStdDev = Math.abs(this.totalPnL) * 0.1; // Rough estimation

    if (estimatedStdDev === 0) return undefined;
    return (averageReturn - riskFreeRate) / estimatedStdDev;
  }

  /**
   * Calculate Sortino ratio (simplified)
   */
  private calculateSortinoRatio(): number | undefined {
    if (this.totalTrades < 10) return undefined;

    // Simplified calculation
    const averageReturn = this.totalPnL / this.totalTrades;
    // Would need downside deviation for accurate calculation
    const estimatedDownsideDeviation = Math.abs(this.totalPnL) * 0.05;

    if (estimatedDownsideDeviation === 0) return undefined;
    return averageReturn / estimatedDownsideDeviation;
  }

  /**
   * Calculate Calmar ratio (simplified)
   */
  private calculateCalmarRatio(): number | undefined {
    if (this.maxDrawdown === 0) return undefined;

    const annualizedReturn = this.totalPnL; // Would annualize based on time period
    return annualizedReturn / this.maxDrawdown;
  }
}
