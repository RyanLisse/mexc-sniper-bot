/**
 * Strategy Manager Module
 *
 * Handles trading strategy management, validation, and configuration.
 * Extracted from the original monolithic core-trading.service.ts for modularity.
 */

import { toSafeError } from "../../../lib/error-type-utils";
import type { ModuleContext, ModuleState, ServiceResponse, TradingStrategy } from "./types";

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
        activeStrategy: this.activeStrategy,
        strategyPerformance: {},
      },
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
    this.context.logger.info("Strategy Manager Module initialized successfully", {
      strategies: Array.from(this.tradingStrategies.keys()),
      activeStrategy: this.activeStrategy,
    });
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
      this.state.metrics.activeStrategy = this.activeStrategy;

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
      this.state.metrics.activeStrategy = strategyName;

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

      this.context.logger.info("Custom strategy added", { name: strategy.name });

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
  updateStrategy(strategyName: string, updates: Partial<TradingStrategy>): ServiceResponse<void> {
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

      this.context.logger.info("Strategy updated", { name: strategyName, updates });

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
          error: "Cannot remove active strategy. Switch to another strategy first.",
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
  getStrategyPerformance(strategyName?: string) {
    if (strategyName) {
      return this.state.metrics.strategyPerformance[strategyName] || null;
    }
    return this.state.metrics.strategyPerformance;
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
  private validateStrategy(strategy: TradingStrategy): { isValid: boolean; errors: string[] } {
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

    if (strategy.confidenceThreshold < 0 || strategy.confidenceThreshold > 100) {
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
      if (strategy.trailingStopPercent < 0 || strategy.trailingStopPercent > 50) {
        errors.push("Trailing stop percent must be between 0 and 50");
      }
    }

    // Validate partial take profit
    if (strategy.enablePartialTakeProfit && strategy.partialTakeProfitPercent) {
      if (strategy.partialTakeProfitPercent < 0 || strategy.partialTakeProfitPercent > 100) {
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
      errors.push("Take profit percent should be higher than stop loss percent");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
