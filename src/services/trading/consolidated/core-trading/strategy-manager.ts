/**
 * Strategy Manager Module
 *
 * Handles trading strategy management, validation, and configuration.
 * Extracted from the original monolithic core-trading.service.ts for modularity.
 */

import { toSafeError } from "@/src/lib/error-type-utils";
import type {
  ModuleContext,
  ModuleState,
  ServiceResponse,
  TradingStrategy,
} from "./types";

export class StrategyManager {
  private context: ModuleContext;
  private state: ModuleState;

  // Strategy storage
  private tradingStrategies = new Map<string, TradingStrategy>();
  private activeStrategy: string;

  constructor(context: ModuleContext) {
    this.context = context;
    this.activeStrategy = context.config.defaultStrategy;
    this.state = {
      isInitialized: false,
      isHealthy: true,
      lastActivity: new Date(),
      metrics: {
        totalStrategies: 0,
        activeStrategy: {},
        strategyPerformance: {},
      } as any,
    };
  }

  /**
   * Initialize the strategy manager module
   */
  async initialize(): Promise<void> {
    this.context.logger.info("Initializing Strategy Manager Module");

    // Initialize default strategies
    this.initializeDefaultStrategies();

    this.state.isInitialized = true;
    this.context.logger.info(
      "Strategy Manager Module initialized successfully",
      {
        strategies: Array.from(this.tradingStrategies.keys()),
        activeStrategy: this.activeStrategy,
      }
    );
  }

  /**
   * Shutdown the strategy manager module
   */
  async shutdown(): Promise<void> {
    this.context.logger.info("Shutting down Strategy Manager Module");
    this.state.isInitialized = false;
  }

  /**
   * Update configuration
   */
  async updateConfig(config: any): Promise<void> {
    this.context.config = config;

    // Update active strategy if it changed
    if (config.defaultStrategy !== this.activeStrategy) {
      this.activeStrategy = config.defaultStrategy;
      this.state.metrics.activeStrategy = 0; // Placeholder for activeStrategy as number

      this.context.eventEmitter.emit("strategy_changed", {
        oldStrategy: this.activeStrategy,
        newStrategy: config.defaultStrategy,
      });
    }

    this.context.logger.info("Strategy Manager Module configuration updated");
  }

  /**
   * Get available trading strategies
   */
  getAvailableStrategies(): TradingStrategy[] {
    return Array.from(this.tradingStrategies.values());
  }

  /**
   * Get a specific strategy by name
   */
  getStrategy(name: string): TradingStrategy | undefined {
    return this.tradingStrategies.get(name);
  }

  /**
   * Get current active strategy
   */
  getActiveStrategy(): TradingStrategy | undefined {
    return this.tradingStrategies.get(this.activeStrategy);
  }

  /**
   * Set active strategy
   */
  setActiveStrategy(strategyName: string): ServiceResponse<void> {
    try {
      const strategy = this.tradingStrategies.get(strategyName);
      if (!strategy) {
        return {
          success: false,
          error: `Strategy '${strategyName}' not found`,
          timestamp: new Date().toISOString(),
        };
      }

      const oldStrategy = this.activeStrategy;
      this.activeStrategy = strategyName;
      this.state.metrics.activeStrategy = 0; // Placeholder for activeStrategy as number

      this.context.eventEmitter.emit("strategy_changed", {
        oldStrategy,
        newStrategy: strategyName,
      });

      this.context.logger.info("Active strategy changed", {
        from: oldStrategy,
        to: strategyName,
      });

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Add a custom trading strategy
   */
  addCustomStrategy(strategy: TradingStrategy): ServiceResponse<void> {
    try {
      // Validate strategy
      const validationResult = this.validateStrategy(strategy);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: validationResult.errors.join(", "),
          timestamp: new Date().toISOString(),
        };
      }

      this.tradingStrategies.set(strategy.name, strategy);
      this.state.metrics.totalStrategies = this.tradingStrategies.size;

      this.context.logger.info("Custom strategy added", {
        name: strategy.name,
      });

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Update an existing strategy
   */
  updateStrategy(
    strategyName: string,
    updates: Partial<TradingStrategy>
  ): ServiceResponse<void> {
    try {
      const existingStrategy = this.tradingStrategies.get(strategyName);
      if (!existingStrategy) {
        return {
          success: false,
          error: `Strategy '${strategyName}' not found`,
          timestamp: new Date().toISOString(),
        };
      }

      const updatedStrategy = { ...existingStrategy, ...updates };

      // Validate updated strategy
      const validationResult = this.validateStrategy(updatedStrategy);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: validationResult.errors.join(", "),
          timestamp: new Date().toISOString(),
        };
      }

      this.tradingStrategies.set(strategyName, updatedStrategy);

      this.context.logger.info("Strategy updated", {
        name: strategyName,
        updates,
      });

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Remove a custom strategy
   */
  removeStrategy(strategyName: string): ServiceResponse<void> {
    try {
      // Don't allow removal of default strategies
      if (["conservative", "balanced", "aggressive"].includes(strategyName)) {
        return {
          success: false,
          error: "Cannot remove default strategies",
          timestamp: new Date().toISOString(),
        };
      }

      if (!this.tradingStrategies.has(strategyName)) {
        return {
          success: false,
          error: `Strategy '${strategyName}' not found`,
          timestamp: new Date().toISOString(),
        };
      }

      // Don't allow removal of active strategy
      if (this.activeStrategy === strategyName) {
        return {
          success: false,
          error:
            "Cannot remove active strategy. Switch to another strategy first.",
          timestamp: new Date().toISOString(),
        };
      }

      this.tradingStrategies.delete(strategyName);
      this.state.metrics.totalStrategies = this.tradingStrategies.size;

      this.context.logger.info("Strategy removed", { name: strategyName });

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get strategy performance metrics
   */
  getStrategyPerformance(strategyName?: string): any {
    if (strategyName) {
      // Fix type indexing error - ensure strategyPerformance is a record/object
      const performanceRecord = this.state.metrics
        .strategyPerformance as Record<string, any>;
      return performanceRecord?.[strategyName] || null;
    }
    return this.state.metrics.strategyPerformance;
  }

  /**
   * Calculate optimal position size using Kelly Criterion
   */
  calculateKellyPositionSize(
    strategy: TradingStrategy,
    accountBalance: number,
    winRate: number,
    avgWin: number,
    avgLoss: number
  ): number {
    try {
      // Kelly Criterion: f* = (bp - q) / b
      // where: f* = fraction of capital to wager
      //        b = odds received on the wager (avgWin / avgLoss)
      //        p = probability of winning (winRate)
      //        q = probability of losing (1 - winRate)

      const b = Math.abs(avgWin / avgLoss);
      const p = winRate / 100; // Convert percentage to decimal
      const q = 1 - p;

      const kellyFraction = (b * p - q) / b;

      // Apply safety constraints
      const maxKellyFraction = 0.25; // Never risk more than 25% (quarter Kelly)
      const safeKellyFraction = Math.max(
        0,
        Math.min(kellyFraction, maxKellyFraction)
      );

      // Calculate position size
      const positionSize = accountBalance * safeKellyFraction;

      // Apply strategy-specific limits
      const maxPositionByStrategy = accountBalance * strategy.maxPositionSize;
      return Math.min(positionSize, maxPositionByStrategy);
    } catch (error) {
      this.context.logger.error("Kelly position sizing calculation failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      // Fallback to fixed percentage
      return accountBalance * strategy.maxPositionSize;
    }
  }

  /**
   * Calculate dynamic position size based on market conditions
   */
  calculateDynamicPositionSize(
    strategy: TradingStrategy,
    accountBalance: number,
    marketVolatility: number,
    confidenceScore: number
  ): number {
    try {
      // Base position size from strategy
      let baseSize = accountBalance * strategy.maxPositionSize;

      // Volatility adjustment (reduce size in high volatility)
      const volatilityAdjustment = Math.max(0.5, 1 - marketVolatility);
      baseSize *= volatilityAdjustment;

      // Confidence adjustment (increase size with higher confidence)
      const confidenceAdjustment = Math.max(0.5, confidenceScore / 100);
      baseSize *= confidenceAdjustment;

      // Ensure minimum and maximum bounds
      const minSize = accountBalance * 0.01; // Minimum 1%
      const maxSize = accountBalance * strategy.maxPositionSize;

      return Math.max(minSize, Math.min(baseSize, maxSize));
    } catch (error) {
      this.context.logger.error("Dynamic position sizing calculation failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return accountBalance * strategy.maxPositionSize;
    }
  }

  /**
   * Optimize strategy parameters using historical performance
   */
  async optimizeStrategyParameters(
    strategyName: string,
    historicalData: any[]
  ): Promise<TradingStrategy | null> {
    try {
      const baseStrategy = this.tradingStrategies.get(strategyName);
      if (!baseStrategy) return null;

      // Parameter optimization using grid search
      const parameterRanges = {
        stopLossPercent: [5, 10, 15, 20],
        takeProfitPercent: [10, 20, 30, 40],
        confidenceThreshold: [60, 70, 80, 90],
      };

      let bestStrategy = { ...baseStrategy };
      let bestPerformance = -Infinity;

      // Grid search optimization
      for (const stopLoss of parameterRanges.stopLossPercent) {
        for (const takeProfit of parameterRanges.takeProfitPercent) {
          for (const confidence of parameterRanges.confidenceThreshold) {
            const testStrategy = {
              ...baseStrategy,
              stopLossPercent: stopLoss,
              takeProfitPercent: takeProfit,
              confidenceThreshold: confidence,
            };

            const performance = this.backtestStrategy(
              testStrategy,
              historicalData
            );
            if (performance.sharpeRatio > bestPerformance) {
              bestPerformance = performance.sharpeRatio;
              bestStrategy = testStrategy;
            }
          }
        }
      }

      this.context.logger.info("Strategy optimization completed", {
        strategyName,
        originalSharpe: this.backtestStrategy(baseStrategy, historicalData)
          .sharpeRatio,
        optimizedSharpe: bestPerformance,
        improvements: {
          stopLoss: `${baseStrategy.stopLossPercent}% → ${bestStrategy.stopLossPercent}%`,
          takeProfit: `${baseStrategy.takeProfitPercent}% → ${bestStrategy.takeProfitPercent}%`,
          confidence: `${baseStrategy.confidenceThreshold}% → ${bestStrategy.confidenceThreshold}%`,
        },
      });

      return bestStrategy;
    } catch (error) {
      this.context.logger.error("Strategy optimization failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Backtest strategy performance
   */
  private backtestStrategy(
    strategy: TradingStrategy,
    historicalData: any[]
  ): any {
    try {
      let totalReturn = 0;
      let trades = 0;
      let wins = 0;
      const returns: number[] = [];

      for (const dataPoint of historicalData) {
        // Simplified backtesting logic
        const signal = this.generateSignal(strategy, dataPoint);
        if (signal !== 0) {
          trades++;
          const tradeReturn =
            signal * dataPoint.priceChange * strategy.maxPositionSize;
          totalReturn += tradeReturn;
          returns.push(tradeReturn);

          if (tradeReturn > 0) wins++;
        }
      }

      const winRate = trades > 0 ? (wins / trades) * 100 : 0;
      const avgReturn = returns.length > 0 ? totalReturn / returns.length : 0;
      const stdDev = this.calculateStandardDeviation(returns);
      const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

      return {
        totalReturn,
        trades,
        winRate,
        avgReturn,
        sharpeRatio,
        maxDrawdown: this.calculateMaxDrawdown(returns),
      };
    } catch (error) {
      this.context.logger.error("Backtesting failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return { sharpeRatio: -Infinity };
    }
  }

  /**
   * Generate trading signal based on strategy and market data
   */
  private generateSignal(strategy: TradingStrategy, dataPoint: any): number {
    // Simplified signal generation
    // In reality, this would use technical indicators, ML models, etc.

    const confidence = dataPoint.confidenceScore || 50;
    if (confidence < strategy.confidenceThreshold) return 0;

    // Generate signal based on market conditions
    if (dataPoint.trend === "bullish" && dataPoint.volatility < 0.05) {
      return 1; // Buy signal
    } else if (dataPoint.trend === "bearish" && dataPoint.volatility < 0.05) {
      return -1; // Sell signal
    }

    return 0; // No signal
  }

  /**
   * Calculate standard deviation of returns
   */
  private calculateStandardDeviation(returns: number[]): number {
    if (returns.length === 0) return 0;

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance =
      returns.reduce((sum, ret) => sum + (ret - mean) ** 2, 0) / returns.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculate maximum drawdown from returns series
   */
  private calculateMaxDrawdown(returns: number[]): number {
    if (returns.length === 0) return 0;

    let peak = 0;
    let maxDrawdown = 0;
    let runningTotal = 0;

    for (const ret of returns) {
      runningTotal += ret;
      peak = Math.max(peak, runningTotal);
      const drawdown = (peak - runningTotal) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    return maxDrawdown * 100; // Return as percentage
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Initialize default trading strategies
   */
  private initializeDefaultStrategies(): void {
    const conservativeStrategy: TradingStrategy = {
      name: "conservative",
      description: "Low-risk strategy with tight risk controls",
      maxPositionSize: 0.05, // 5% max position
      positionSizingMethod: "fixed",
      stopLossPercent: 10,
      takeProfitPercent: 20,
      maxDrawdownPercent: 15,
      orderType: "LIMIT",
      timeInForce: "GTC",
      slippageTolerance: 0.5,
      enableMultiPhase: true,
      phaseCount: 3,
      phaseDelayMs: 5000,
      confidenceThreshold: 85,
      enableAutoSnipe: false,
      snipeDelayMs: 1000,
      enableTrailingStop: false,
      enablePartialTakeProfit: true,
      partialTakeProfitPercent: 50,
    };

    const balancedStrategy: TradingStrategy = {
      name: "balanced",
      description: "Balanced risk/reward strategy",
      maxPositionSize: 0.1, // 10% max position
      positionSizingMethod: "fixed",
      stopLossPercent: 15,
      takeProfitPercent: 25,
      maxDrawdownPercent: 20,
      orderType: "MARKET",
      timeInForce: "IOC",
      slippageTolerance: 1.0,
      enableMultiPhase: true,
      phaseCount: 2,
      phaseDelayMs: 3000,
      confidenceThreshold: 75,
      enableAutoSnipe: true,
      snipeDelayMs: 500,
      enableTrailingStop: true,
      trailingStopPercent: 5,
      enablePartialTakeProfit: false,
    };

    const aggressiveStrategy: TradingStrategy = {
      name: "aggressive",
      description: "High-risk, high-reward strategy",
      maxPositionSize: 0.2, // 20% max position
      positionSizingMethod: "kelly",
      stopLossPercent: 20,
      takeProfitPercent: 40,
      maxDrawdownPercent: 30,
      orderType: "MARKET",
      timeInForce: "IOC",
      slippageTolerance: 2.0,
      enableMultiPhase: false,
      phaseCount: 1,
      phaseDelayMs: 0,
      confidenceThreshold: 65,
      enableAutoSnipe: true,
      snipeDelayMs: 0,
      enableTrailingStop: true,
      trailingStopPercent: 8,
      enablePartialTakeProfit: false,
    };

    this.tradingStrategies.set("conservative", conservativeStrategy);
    this.tradingStrategies.set("balanced", balancedStrategy);
    this.tradingStrategies.set("aggressive", aggressiveStrategy);

    this.state.metrics.totalStrategies = this.tradingStrategies.size;

    this.context.logger.info("Default trading strategies initialized", {
      strategies: Array.from(this.tradingStrategies.keys()),
    });
  }

  /**
   * Validate strategy configuration
   */
  private validateStrategy(strategy: TradingStrategy): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate basic fields
    if (!strategy.name || strategy.name.trim() === "") {
      errors.push("Strategy name is required");
    }

    if (!strategy.description || strategy.description.trim() === "") {
      errors.push("Strategy description is required");
    }

    // Validate percentages
    if (strategy.maxPositionSize <= 0 || strategy.maxPositionSize > 1) {
      errors.push("Max position size must be between 0 and 1");
    }

    if (strategy.stopLossPercent < 0 || strategy.stopLossPercent > 100) {
      errors.push("Stop loss percent must be between 0 and 100");
    }

    if (strategy.takeProfitPercent < 0 || strategy.takeProfitPercent > 1000) {
      errors.push("Take profit percent must be between 0 and 1000");
    }

    if (strategy.maxDrawdownPercent < 0 || strategy.maxDrawdownPercent > 100) {
      errors.push("Max drawdown percent must be between 0 and 100");
    }

    if (
      strategy.confidenceThreshold < 0 ||
      strategy.confidenceThreshold > 100
    ) {
      errors.push("Confidence threshold must be between 0 and 100");
    }

    if (strategy.slippageTolerance < 0 || strategy.slippageTolerance > 10) {
      errors.push("Slippage tolerance must be between 0 and 10");
    }

    // Validate multi-phase settings
    if (strategy.enableMultiPhase) {
      if (strategy.phaseCount < 1 || strategy.phaseCount > 10) {
        errors.push("Phase count must be between 1 and 10");
      }

      if (strategy.phaseDelayMs < 0 || strategy.phaseDelayMs > 60000) {
        errors.push("Phase delay must be between 0 and 60000 milliseconds");
      }
    }

    // Validate trailing stop
    if (strategy.enableTrailingStop && strategy.trailingStopPercent) {
      if (
        strategy.trailingStopPercent < 0 ||
        strategy.trailingStopPercent > 50
      ) {
        errors.push("Trailing stop percent must be between 0 and 50");
      }
    }

    // Validate partial take profit
    if (strategy.enablePartialTakeProfit && strategy.partialTakeProfitPercent) {
      if (
        strategy.partialTakeProfitPercent < 0 ||
        strategy.partialTakeProfitPercent > 100
      ) {
        errors.push("Partial take profit percent must be between 0 and 100");
      }
    }

    // Validate auto-snipe settings
    if (strategy.enableAutoSnipe) {
      if (strategy.snipeDelayMs < 0 || strategy.snipeDelayMs > 10000) {
        errors.push("Snipe delay must be between 0 and 10000 milliseconds");
      }
    }

    // Logical validations
    if (strategy.stopLossPercent >= strategy.takeProfitPercent) {
      errors.push(
        "Take profit percent should be higher than stop loss percent"
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
