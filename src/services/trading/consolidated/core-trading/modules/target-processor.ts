/**
 * Target Processor Module
 *
 * Handles snipe target processing and execution logic.
 * Extracted from auto-sniping.ts for better modularity.
 */

import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "@/src/db";
import { snipeTargets } from "@/src/db/schemas/trading";
import { toSafeError } from "@/src/lib/error-type-utils";
import type {
  AutoSnipeTarget,
  ModuleContext,
  ServiceResponse,
  TradeParameters,
  TradeResult,
  TradingStrategy,
} from "../types";

// Extended strategy interface for multi-phase strategies
interface MultiPhaseStrategy extends TradingStrategy {
  id: string;
  levels: Array<{
    percentage: number;
    action: string;
    delay?: number;
  }>;
}

export class TargetProcessor {
  private context: ModuleContext;

  // Processing statistics
  private processedTargets = 0;
  private successfulSnipes = 0;
  private failedSnipes = 0;

  constructor(context: ModuleContext) {
    this.context = context;
  }

  /**
   * Process all ready snipe targets
   */
  async processSnipeTargets(): Promise<
    ServiceResponse<{ processedCount: number; successCount: number }>
  > {
    try {
      const readyTargets = await this.getReadySnipeTargets();

      if (readyTargets.length === 0) {
        return {
          success: true,
          data: { processedCount: 0, successCount: 0 },
          timestamp: new Date().toISOString(),
        };
      }

      this.context.logger.info(`Processing ${readyTargets.length} ready snipe targets`);

      let successCount = 0;
      for (const target of readyTargets) {
        try {
          const result = await this.processTarget(target);
          if (result.success) {
            successCount++;
          }
        } catch (error) {
          const safeError = toSafeError(error);
          this.context.logger.error("Failed to process target", {
            targetId: target.id,
            error: safeError,
          });
        }
      }

      return {
        success: true,
        data: { processedCount: readyTargets.length, successCount },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to process snipe targets", safeError);

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Process a single snipe target
   */
  async processTarget(target: AutoSnipeTarget): Promise<ServiceResponse<TradeResult>> {
    try {
      this.context.logger.info(`Processing snipe target: ${target.id}`, {
        symbol: target.symbol,
        targetPrice: target.targetPrice,
        confidence: target.confidence,
      });

      // Update target status to processing
      await this.updateSnipeTargetStatus(target.id.toString(), "processing");

      // Execute the snipe
      const result = await this.executeSnipeTarget(target);

      // Update target status based on result
      const newStatus = result.success ? "completed" : "failed";
      await this.updateSnipeTargetStatus(target.id.toString(), newStatus, result.error);

      // Update statistics
      this.processedTargets++;
      if (result.success) {
        this.successfulSnipes++;
      } else {
        this.failedSnipes++;
      }

      this.context.logger.info(`Snipe target processing completed`, {
        targetId: target.id,
        success: result.success,
        orderId: result.data?.orderId,
      });

      return {
        success: result.success,
        data: result,
        error: result.error,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Target processing failed", {
        targetId: target.id,
        error: safeError,
      });

      // Mark target as failed
      await this.updateSnipeTargetStatus(target.id.toString(), "failed", safeError.message);

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute a snipe target
   */
  async executeSnipeTarget(target: AutoSnipeTarget): Promise<TradeResult> {
    try {
      // Map database fields to trading parameters
      const symbol = target.symbol || target.symbolName;
      const side = (target.side || "buy").toUpperCase() as "BUY" | "SELL";
      const orderType = target.orderType || (target.entryStrategy === "limit" ? "LIMIT" : "MARKET");
      const quantity = target.quantity || target.positionSizeUsdt;
      const price = target.targetPrice || target.entryPrice || undefined;
      
      // Calculate stop loss and take profit prices if needed
      const stopLoss = target.stopLoss || (price && target.stopLossPercent ? 
        price * (1 - target.stopLossPercent / 100) : undefined);
      const takeProfit = target.takeProfit || (price && target.takeProfitCustom ? 
        price * (1 + target.takeProfitCustom / 100) : undefined);
      
      // Prepare trade parameters
      const tradeParams: TradeParameters = {
        symbol,
        side,
        type: orderType as "MARKET" | "LIMIT" | "STOP_LIMIT",
        quantity,
        price,
        stopLoss,
        takeProfit,
        timeInForce: target.timeInForce || "GTC",
      };

      // Choose execution method based on configuration
      let result: TradeResult;
      
      if (this.context.config.paperTradingMode) {
        result = await this.context.orderExecutor.executePaperSnipe(tradeParams);
      } else {
        result = await this.context.orderExecutor.executeRealSnipe(tradeParams);
      }

      // If successful and we have position management enabled, setup monitoring
      if (result.success && this.context.config.positionManagementEnabled) {
        const position = await this.context.orderExecutor.createPositionEntry(
          tradeParams,
          result
        );
        
        await this.context.positionManager.setupPositionMonitoring(position, result);

        // Setup multi-phase monitoring if applicable
        if (target.strategy && this.isMultiPhaseStrategy(target.strategy)) {
          const multiPhaseStrategy = this.convertToMultiPhaseStrategy(target.strategy);
          if (multiPhaseStrategy) {
            await this.setupMultiPhaseMonitoring(
              multiPhaseStrategy,
              position,
              result
            );
          }
        }
      }

      return result;
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Snipe target execution failed", {
        targetId: target.id,
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
   * Setup multi-phase monitoring for complex strategies
   */
  private async setupMultiPhaseMonitoring(
    strategy: MultiPhaseStrategy,
    position: any,
    result: TradeResult
  ): Promise<void> {
    try {
      this.context.logger.info("Setting up multi-phase monitoring", {
        strategyId: strategy.id,
        positionId: position.id,
        levels: strategy.levels.length,
      });

      for (const [index, level] of strategy.levels.entries()) {
        const delay = level.delay || index * 1000; // Default 1s between levels
        
        setTimeout(async () => {
          try {
            await this.executePhaseLevel(strategy, position, level, index);
          } catch (error) {
            const safeError = toSafeError(error);
            this.context.logger.error("Multi-phase level execution failed", {
              strategyId: strategy.id,
              positionId: position.id,
              level: index,
              error: safeError,
            });
          }
        }, delay);
      }
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to setup multi-phase monitoring", {
        strategyId: strategy.id,
        error: safeError,
      });
    }
  }

  /**
   * Execute a specific phase level
   */
  private async executePhaseLevel(
    strategy: MultiPhaseStrategy,
    position: any,
    level: any,
    levelIndex: number
  ): Promise<void> {
    this.context.logger.info("Executing phase level", {
      strategyId: strategy.id,
      positionId: position.id,
      level: levelIndex,
      action: level.action,
      percentage: level.percentage,
    });

    switch (level.action) {
      case "partial_exit":
        const exitQuantity = position.quantity * (level.percentage / 100);
        await this.executePartialExit(position, exitQuantity);
        break;
        
      case "update_stop_loss":
        const newStopLoss = position.entryPrice * (1 + level.percentage / 100);
        await this.context.positionManager.updatePositionStopLoss(
          position.id,
          newStopLoss
        );
        break;
        
      case "update_take_profit":
        const newTakeProfit = position.entryPrice * (1 + level.percentage / 100);
        await this.context.positionManager.updatePositionTakeProfit(
          position.id,
          newTakeProfit
        );
        break;
        
      default:
        this.context.logger.warn("Unknown phase action", {
          action: level.action,
          strategyId: strategy.id,
        });
    }
  }

  /**
   * Execute partial exit for multi-phase strategy
   */
  private async executePartialExit(position: any, quantity: number): Promise<void> {
    try {
      const exitParams: TradeParameters = {
        symbol: position.symbol,
        side: position.side === "BUY" ? "SELL" : "BUY",
        type: "MARKET",
        quantity,
      };

      const result = this.context.config.paperTradingMode
        ? await this.context.orderExecutor.executePaperSnipe(exitParams)
        : await this.context.orderExecutor.executeRealSnipe(exitParams);

      if (result.success) {
        this.context.logger.info("Partial exit executed successfully", {
          positionId: position.id,
          exitQuantity: quantity,
          orderId: result.data?.orderId,
        });
      } else {
        this.context.logger.error("Partial exit failed", {
          positionId: position.id,
          error: result.error,
        });
      }
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Partial exit execution failed", {
        positionId: position.id,
        quantity,
        error: safeError,
      });
    }
  }

  /**
   * Get ready snipe targets from database
   */
  private async getReadySnipeTargets(): Promise<AutoSnipeTarget[]> {
    try {
      const currentTime = new Date();
      const maxConfidence = this.context.config.confidenceThreshold || 0.7;

      const targets = await db
        .select()
        .from(snipeTargets)
        .where(
          and(
            eq(snipeTargets.status, "pending"),
            isNull(snipeTargets.actualExecutionTime),
            or(
              isNull(snipeTargets.targetExecutionTime),
              lt(snipeTargets.targetExecutionTime, currentTime)
            )
          )
        )
        .limit(this.context.config.maxConcurrentSnipes || 10);

      // Filter by confidence threshold
      return targets.filter((target: any) => 
        (target.confidence || 0) >= maxConfidence
      ) as AutoSnipeTarget[];
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to fetch ready snipe targets", safeError);
      throw error;
    }
  }

  /**
   * Update snipe target status
   */
  private async updateSnipeTargetStatus(
    targetId: string,
    status: string,
    error?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updatedAt: new Date().toISOString(),
      };

      if (status === "completed") {
        updateData.executedAt = new Date().toISOString();
      }

      if (error) {
        updateData.errorMessage = error;
      }

      await db
        .update(snipeTargets)
        .set(updateData)
        .where(eq(snipeTargets.id, parseInt(targetId, 10)));

      this.context.logger.debug("Updated snipe target status", {
        targetId,
        status,
        error,
      });
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to update snipe target status", {
        targetId,
        status,
        error: safeError,
      });
      throw error;
    }
  }

  /**
   * Check if strategy is multi-phase
   */
  private isMultiPhaseStrategy(strategy: any): boolean {
    return strategy && typeof strategy === 'object' && "levels" in strategy && Array.isArray(strategy.levels);
  }

  /**
   * Convert strategy to multi-phase strategy
   */
  private convertToMultiPhaseStrategy(strategy: any): MultiPhaseStrategy | null {
    if (!this.isMultiPhaseStrategy(strategy)) {
      return null;
    }

    return {
      id: strategy.id || strategy.name || 'unknown',
      name: strategy.name || 'Multi-Phase Strategy',
      description: strategy.description || 'Multi-phase trading strategy',
      maxPositionSize: strategy.maxPositionSize || 1000,
      positionSizingMethod: strategy.positionSizingMethod || 'fixed',
      stopLossPercent: strategy.stopLossPercent || 5,
      takeProfitPercent: strategy.takeProfitPercent || 10,
      maxDrawdownPercent: strategy.maxDrawdownPercent || 15,
      orderType: strategy.orderType || "MARKET",
      timeInForce: strategy.timeInForce || "GTC",
      slippageTolerance: strategy.slippageTolerance || 1,
      enableMultiPhase: strategy.enableMultiPhase !== false,
      phaseCount: strategy.phaseCount || strategy.levels?.length || 3,
      phaseDelayMs: strategy.phaseDelayMs || 1000,
      confidenceThreshold: strategy.confidenceThreshold || 70,
      enableAutoSnipe: strategy.enableAutoSnipe !== false,
      snipeDelayMs: strategy.snipeDelayMs || 500,
      enableTrailingStop: strategy.enableTrailingStop || false,
      trailingStopPercent: strategy.trailingStopPercent || 0,
      enablePartialTakeProfit: strategy.enablePartialTakeProfit || false,
      partialTakeProfitPercent: strategy.partialTakeProfitPercent || 50,
      levels: strategy.levels || []
    };
  }

  /**
   * Get processing statistics
   */
  getStatistics(): {
    processedTargets: number;
    successfulSnipes: number;
    failedSnipes: number;
    successRate: number;
  } {
    const successRate = this.processedTargets > 0 
      ? this.successfulSnipes / this.processedTargets 
      : 0;

    return {
      processedTargets: this.processedTargets,
      successfulSnipes: this.successfulSnipes,
      failedSnipes: this.failedSnipes,
      successRate,
    };
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.processedTargets = 0;
    this.successfulSnipes = 0;
    this.failedSnipes = 0;
  }
}