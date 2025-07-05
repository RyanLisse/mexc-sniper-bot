/**
 * Strategy Execution Module
 *
 * Handles trading strategy execution and multi-phase monitoring setup.
 * Extracted from auto-sniping.ts for better modularity.
 */

import { toSafeError } from "@/src/lib/error-type-utils";
import { TradingStrategyManager } from "@/src/services/trading/trading-strategy-manager";
import type {
  AutoSnipeTarget,
  ModuleContext,
  MultiPhaseStrategy,
  PositionMonitoringContext,
  TradeInfo,
  TradeParameters,
  TradeResult,
} from "../auto-sniping-types";

export class StrategyExecutionModule {
  private context: ModuleContext;

  constructor(context: ModuleContext) {
    this.context = context;
  }

  /**
   * Execute a snipe target with strategy
   */
  async executeSnipeTargetWithStrategy(
    target: AutoSnipeTarget
  ): Promise<TradeResult> {
    this.context.logger.info(`Executing snipe target: ${target.symbolName}`, {
      confidence: target.confidenceScore,
      amount: target.positionSizeUsdt,
      strategy: target.entryStrategy || "normal",
    });

    try {
      // Initialize trading strategy manager
      const strategyManager = new TradingStrategyManager(
        target.entryStrategy || "normal"
      );
      const strategy = strategyManager.getActiveStrategy();

      this.context.logger.info(`Using strategy: ${strategy.name}`, {
        levels: strategy.levels.length,
        firstPhaseTarget: strategy.levels[0]?.percentage,
      });

      // Prepare trade parameters for initial buy order
      const tradeParams: TradeParameters = {
        symbol: target.symbolName,
        side: "BUY",
        type: "MARKET",
        quoteOrderQty: target.positionSizeUsdt,
        timeInForce: "IOC",
        isAutoSnipe: true,
        confidenceScore: target.confidenceScore,
        stopLossPercent: target.stopLossPercent,
        takeProfitPercent: target.takeProfitCustom ?? undefined,
        strategy: target.entryStrategy || "normal",
      };

      // Execute the initial buy order
      const result = await this.executeTradeViaManualModule(tradeParams);

      if (result.success) {
        // Set up multi-phase strategy monitoring if trade was successful
        if (result.data?.executedQty && result.data?.price) {
          // Create MultiPhaseStrategy from TradingStrategy
          const multiPhaseStrategy: MultiPhaseStrategy = {
            id: `${target.id}_${Date.now()}`,
            name: strategy.name || "default",
            description: strategy.description || "Auto-generated strategy",
            maxPositionSize: target.positionSizeUsdt,
            positionSizingMethod: "fixed" as const,
            stopLossPercent: target.stopLossPercent || 5,
            takeProfitPercent: target.takeProfitCustom || 10,
            maxDrawdownPercent: 20,
            orderType: "MARKET" as const,
            timeInForce: "GTC" as const,
            slippageTolerance: 0.5,
            enableMultiPhase: true,
            phaseCount: 1,
            phaseDelayMs: 1000,
            confidenceThreshold: target.confidenceScore || 75,
            enableAutoSnipe: true,
            snipeDelayMs: 500,
            enableTrailingStop: false,
            enablePartialTakeProfit: false,
            levels: [
              {
                percentage: target.takeProfitCustom || 10,
                action: "take_profit",
                delay: 1000,
              },
            ],
          };

          await this.setupMultiPhaseMonitoring(target, multiPhaseStrategy, {
            entryPrice: parseFloat(result.data.price),
            quantity: parseFloat(result.data.executedQty),
            orderId: result.data.orderId,
          });
        }

        // Emit auto-snipe event with strategy info
        this.context.eventEmitter.emit("auto_snipe_executed", {
          target,
          result,
          strategy: strategy.name,
        });

        this.context.logger.info(
          "Snipe target executed successfully with strategy",
          {
            symbol: target.symbolName,
            orderId: result.data?.orderId,
            strategy: strategy.name,
            entryPrice: result.data?.price,
            quantity: result.data?.executedQty,
          }
        );
      }

      return result;
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Strategy execution failed", {
        target: target.symbolName,
        error: safeError.message,
      });
      throw error;
    }
  }

  /**
   * Set up multi-phase strategy monitoring for executed positions
   */
  async setupMultiPhaseMonitoring(
    target: AutoSnipeTarget,
    strategy: MultiPhaseStrategy,
    tradeInfo: TradeInfo
  ): Promise<void> {
    try {
      this.context.logger.info(
        `Setting up multi-phase monitoring for ${target.symbolName}`,
        {
          strategy: strategy.name,
          entryPrice: tradeInfo.entryPrice,
          quantity: tradeInfo.quantity,
          levels: strategy.levels.length,
        }
      );

      // Create monitoring context for this position
      const monitoringContext: PositionMonitoringContext = {
        symbol: target.symbolName,
        strategyId: strategy.id,
        entryPrice: tradeInfo.entryPrice,
        totalQuantity: tradeInfo.quantity,
        remainingQuantity: tradeInfo.quantity,
        originalOrderId: tradeInfo.orderId,
        levels: strategy.levels,
        executedLevels: [],
        createdAt: new Date().toISOString(),
      };

      // Emit event to start strategy monitoring
      // This would be handled by a separate strategy monitoring service
      this.context.eventEmitter.emit("multi_phase_strategy_started", {
        target,
        strategy,
        tradeInfo,
        monitoringContext,
      });

      this.context.logger.info(
        `Multi-phase monitoring initiated for ${target.symbolName}`,
        {
          strategyId: strategy.id,
          entryPrice: tradeInfo.entryPrice,
          quantity: tradeInfo.quantity,
        }
      );
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to setup multi-phase monitoring", {
        symbol: target.symbolName,
        error: safeError.message,
      });
    }
  }

  /**
   * Create a basic multi-phase strategy from target parameters
   */
  createBasicMultiPhaseStrategy(
    target: AutoSnipeTarget,
    strategyName: string = "basic"
  ): MultiPhaseStrategy {
    return {
      id: `${target.id}_${Date.now()}`,
      name: strategyName,
      description: `Auto-generated strategy for ${target.symbolName}`,
      maxPositionSize: target.positionSizeUsdt,
      positionSizingMethod: "fixed" as const,
      stopLossPercent: target.stopLossPercent || 5,
      takeProfitPercent: target.takeProfitCustom || 10,
      maxDrawdownPercent: 20,
      orderType: "MARKET" as const,
      timeInForce: "GTC" as const,
      slippageTolerance: 0.5,
      enableMultiPhase: true,
      phaseCount: 1,
      phaseDelayMs: 1000,
      confidenceThreshold: target.confidenceScore || 75,
      enableAutoSnipe: true,
      snipeDelayMs: 500,
      enableTrailingStop: false,
      enablePartialTakeProfit: false,
      levels: [
        {
          percentage: target.takeProfitCustom || 10,
          action: "take_profit",
          delay: 1000,
        },
      ],
    };
  }

  /**
   * Validate strategy parameters
   */
  validateStrategy(strategy: MultiPhaseStrategy): boolean {
    try {
      return (
        strategy &&
        typeof strategy.id === "string" &&
        typeof strategy.name === "string" &&
        typeof strategy.maxPositionSize === "number" &&
        strategy.maxPositionSize > 0 &&
        typeof strategy.stopLossPercent === "number" &&
        strategy.stopLossPercent > 0 &&
        typeof strategy.takeProfitPercent === "number" &&
        strategy.takeProfitPercent > 0 &&
        Array.isArray(strategy.levels) &&
        strategy.levels.length > 0
      );
    } catch (error) {
      this.context.logger.error("Strategy validation failed", { error });
      return false;
    }
  }

  /**
   * Get strategy by name
   */
  getStrategy(strategyName: string) {
    try {
      const strategyManager = new TradingStrategyManager(strategyName);
      return strategyManager.getActiveStrategy();
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to get strategy", {
        strategyName,
        error: safeError.message,
      });
      throw error;
    }
  }

  /**
   * Execute trade via manual module (delegated to manual trading module)
   */
  private async executeTradeViaManualModule(
    _params: TradeParameters
  ): Promise<TradeResult> {
    // This should be injected or use the manual trading module
    // For now, return a placeholder that maintains the interface
    try {
      // In the actual implementation, this would call:
      // return await this.manualTradingModule.executeTrade(params);

      this.context.logger.warn(
        "Manual trading module not connected to strategy execution"
      );

      return {
        success: false,
        error: "Manual trading module not implemented in StrategyExecution",
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
}
