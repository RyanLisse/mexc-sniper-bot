/**
 * Auto-Sniping Module
 *
 * Handles auto-sniping execution and monitoring.
 * Extracted from the original monolithic core-trading.service.ts for modularity.
 */

import { and, eq, lt, isNull, or } from "drizzle-orm";
import { db } from "@/src/db";
import { snipeTargets } from "@/src/db/schemas/trading";
import { toSafeError } from "@/src/lib/error-type-utils";
import { TradingStrategyManager } from "@/src/services/trading/trading-strategy-manager";
import type {
  AutoSnipeTarget,
  ModuleContext,
  ModuleState,
  ServiceResponse,
  TradeParameters,
  TradeResult,
} from "./types";

export class AutoSnipingModule {
  private context: ModuleContext;
  private state: ModuleState;

  // Auto-sniping state
  private autoSnipingInterval: NodeJS.Timeout | null = null;
  private lastSnipeCheck: Date | null = null;
  private isActive = false;

  // Metrics
  private processedTargets = 0;
  private successfulSnipes = 0;
  private failedSnipes = 0;

  constructor(context: ModuleContext) {
    this.context = context;
    this.state = {
      isInitialized: false,
      isHealthy: true,
      lastActivity: new Date(),
      metrics: {
        processedTargets: 0,
        successfulSnipes: 0,
        failedSnipes: 0,
        averageConfidence: 0,
      },
    };
  }

  /**
   * Initialize the auto-sniping module
   */
  async initialize(): Promise<void> {
    this.context.logger.info("Initializing Auto-Sniping Module");
    this.state.isInitialized = true;
    this.context.logger.info("Auto-Sniping Module initialized successfully");
  }

  /**
   * Shutdown the auto-sniping module
   */
  async shutdown(): Promise<void> {
    this.context.logger.info("Shutting down Auto-Sniping Module");
    await this.stop();
    this.state.isInitialized = false;
  }

  /**
   * Update configuration
   */
  async updateConfig(config: any): Promise<void> {
    this.context.config = config;

    // Restart auto-sniping if active with new configuration
    if (this.isActive) {
      await this.stop();
      if (config.autoSnipingEnabled) {
        await this.start();
      }
    }

    this.context.logger.info("Auto-Sniping Module configuration updated");
  }

  /**
   * Start auto-sniping monitoring
   */
  async start(): Promise<ServiceResponse<void>> {
    if (this.isActive) {
      return {
        success: false,
        error: "Auto-sniping is already active",
        timestamp: new Date().toISOString(),
      };
    }

    try {
      this.context.logger.info("Starting auto-sniping monitoring", {
        interval: this.context.config.snipeCheckInterval,
        confidenceThreshold: this.context.config.confidenceThreshold,
      });

      this.isActive = true;
      this.autoSnipingInterval = setInterval(
        () => this.processSnipeTargets(),
        this.context.config.snipeCheckInterval
      );

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to start auto-sniping", safeError);

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Stop auto-sniping monitoring
   */
  async stop(): Promise<ServiceResponse<void>> {
    try {
      if (this.autoSnipingInterval) {
        clearInterval(this.autoSnipingInterval);
        this.autoSnipingInterval = null;
      }

      this.isActive = false;
      this.context.logger.info("Auto-sniping monitoring stopped");

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to stop auto-sniping", safeError);

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Pause auto-sniping monitoring
   */
  async pause(): Promise<ServiceResponse<void>> {
    if (!this.isActive) {
      return {
        success: false,
        error: "Auto-sniping is not active",
        timestamp: new Date().toISOString(),
      };
    }

    try {
      if (this.autoSnipingInterval) {
        clearInterval(this.autoSnipingInterval);
        this.autoSnipingInterval = null;
      }

      this.context.logger.info("Auto-sniping monitoring paused");
      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to pause auto-sniping", safeError);

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Resume auto-sniping monitoring
   */
  async resume(): Promise<ServiceResponse<void>> {
    if (!this.isActive) {
      return {
        success: false,
        error: "Auto-sniping is not active",
        timestamp: new Date().toISOString(),
      };
    }

    if (this.autoSnipingInterval) {
      return {
        success: false,
        error: "Auto-sniping is already running",
        timestamp: new Date().toISOString(),
      };
    }

    try {
      // Resume the interval
      this.autoSnipingInterval = setInterval(
        () => this.processSnipeTargets(),
        this.context.config.snipeCheckInterval
      );

      this.context.logger.info("Auto-sniping monitoring resumed");
      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to resume auto-sniping", safeError);

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get module status
   */
  getStatus() {
    return {
      isActive: this.isActive,
      isHealthy: this.state.isHealthy,
      lastSnipeCheck: this.lastSnipeCheck,
      processedTargets: this.processedTargets,
      successfulSnipes: this.successfulSnipes,
      failedSnipes: this.failedSnipes,
      successRate:
        this.processedTargets > 0 ? (this.successfulSnipes / this.processedTargets) * 100 : 0,
    };
  }

  /**
   * Manually process snipe targets
   */
  async processSnipeTargets(): Promise<
    ServiceResponse<{ processedCount: number; successCount: number }>
  > {
    try {
      this.lastSnipeCheck = new Date();
      this.state.lastActivity = new Date();

      // Get ready snipe targets from database
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

      // Process each target
      for (const target of readyTargets) {
        if (target.confidenceScore >= this.context.config.confidenceThreshold) {
          try {
            await this.executeSnipeTarget(target);
            successCount++;
            this.successfulSnipes++;
          } catch (error) {
            const safeError = toSafeError(error);
            this.context.logger.error("Failed to execute snipe target", {
              target,
              error: safeError,
            });
            await this.updateSnipeTargetStatus(target.id, "failed", safeError.message);
            this.failedSnipes++;
          }
        } else {
          this.context.logger.debug("Skipping low confidence target", {
            symbol: target.symbolName,
            confidence: target.confidenceScore,
            threshold: this.context.config.confidenceThreshold,
          });
        }

        this.processedTargets++;
      }

      // Update metrics
      this.state.metrics.processedTargets = this.processedTargets;
      this.state.metrics.successfulSnipes = this.successfulSnipes;
      this.state.metrics.failedSnipes = this.failedSnipes;

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
   * Execute a specific snipe target
   */
  async executeSnipeTarget(target: AutoSnipeTarget): Promise<TradeResult> {
    this.context.logger.info(`Executing snipe target: ${target.symbolName}`, {
      confidence: target.confidenceScore,
      amount: target.positionSizeUsdt,
      strategy: target.strategy || "normal",
    });

    // Update target status to executing
    await this.updateSnipeTargetStatus(target.id, "executing");

    try {
      // Initialize trading strategy manager
      const strategyManager = new TradingStrategyManager(target.strategy || "normal");
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
        takeProfitPercent: target.takeProfitCustom,
        strategy: target.strategy || "normal",
      };

      // Execute the initial buy order
      const result = await this.executeTradeViaManualModule(tradeParams);

      if (result.success) {
        // Update target status to completed (initial order)
        await this.updateSnipeTargetStatus(target.id, "completed");

        // Set up multi-phase strategy monitoring if trade was successful
        if (result.data?.executedQty && result.data?.avgPrice) {
          await this.setupMultiPhaseMonitoring(target, strategy, {
            entryPrice: parseFloat(result.data.avgPrice),
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

        this.context.logger.info("Snipe target executed successfully with strategy", {
          symbol: target.symbolName,
          orderId: result.data?.orderId,
          strategy: strategy.name,
          entryPrice: result.data?.avgPrice,
          quantity: result.data?.executedQty,
        });
      } else {
        // Update target status to failed
        await this.updateSnipeTargetStatus(target.id, "failed", result.error);
      }

      return result;
    } catch (error) {
      const safeError = toSafeError(error);
      await this.updateSnipeTargetStatus(target.id, "failed", safeError.message);
      throw error;
    }
  }

  /**
   * Set up multi-phase strategy monitoring for executed positions
   */
  private async setupMultiPhaseMonitoring(
    target: AutoSnipeTarget,
    strategy: any,
    tradeInfo: { entryPrice: number; quantity: number; orderId: string }
  ): Promise<void> {
    try {
      this.context.logger.info(`Setting up multi-phase monitoring for ${target.symbolName}`, {
        strategy: strategy.name,
        entryPrice: tradeInfo.entryPrice,
        quantity: tradeInfo.quantity,
        levels: strategy.levels.length,
      });

      // Create monitoring context for this position
      const monitoringContext = {
        symbol: target.symbolName,
        strategyId: strategy.id,
        entryPrice: tradeInfo.entryPrice,
        totalQuantity: tradeInfo.quantity,
        remainingQuantity: tradeInfo.quantity,
        originalOrderId: tradeInfo.orderId,
        levels: strategy.levels,
        executedLevels: [] as number[],
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

      this.context.logger.info(`Multi-phase monitoring initiated for ${target.symbolName}`, {
        targetLevels: strategy.levels.map((level: any) => `${level.percentage}%`),
        firstTarget: strategy.levels[0]?.percentage,
      });
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error(`Failed to setup multi-phase monitoring for ${target.symbolName}`, {
        error: safeError.message,
        strategy: strategy.name,
      });
      // Continue execution even if monitoring setup fails
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get ready snipe targets from database
   */
  private async getReadySnipeTargets(): Promise<AutoSnipeTarget[]> {
    try {
      const now = new Date();
      const targets = await db
        .select()
        .from(snipeTargets)
        .where(
          and(
            eq(snipeTargets.status, "ready"),
            or(isNull(snipeTargets.targetExecutionTime), lt(snipeTargets.targetExecutionTime, now))
          )
        )
        .orderBy(snipeTargets.priority, snipeTargets.createdAt)
        .limit(10);

      return targets;
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to fetch ready snipe targets", safeError);
      return [];
    }
  }

  /**
   * Update snipe target status in database
   */
  private async updateSnipeTargetStatus(
    targetId: number,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updatedAt: new Date(),
      };

      if (status === "executing") {
        updateData.actualExecutionTime = new Date();
      }

      if (errorMessage) {
        updateData.errorMessage = errorMessage;
      }

      await db.update(snipeTargets).set(updateData).where(eq(snipeTargets.id, targetId));
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to update snipe target status", {
        targetId,
        status,
        error: safeError,
      });
    }
  }

  /**
   * Execute trade via manual trading module
   * This would typically call the manual trading module's executeTrade method
   */
  private async executeTradeViaManualModule(params: TradeParameters): Promise<TradeResult> {
    try {
      // Simulate trade execution for now
      // In a real implementation, this would call the manual trading module

      if (this.context.config.enablePaperTrading) {
        return await this.executePaperSnipe(params);
      } else {
        return await this.executeRealSnipe(params);
      }
    } catch (error) {
      const safeError = toSafeError(error);
      throw safeError;
    }
  }

  /**
   * Execute paper snipe trade
   */
  private async executePaperSnipe(params: TradeParameters): Promise<TradeResult> {
    const startTime = Date.now();
    const simulatedPrice = 100 + Math.random() * 1000; // Mock price
    const orderId = `paper-snipe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      data: {
        orderId,
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        quantity: (params.quoteOrderQty! / simulatedPrice).toString(),
        price: simulatedPrice.toString(),
        status: "FILLED",
        executedQty: (params.quoteOrderQty! / simulatedPrice).toString(),
        timestamp: new Date().toISOString(),
        paperTrade: true,
        simulatedPrice,
        autoSnipe: true,
        confidenceScore: params.confidenceScore,
      },
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Execute real snipe trade
   */
  private async executeRealSnipe(params: TradeParameters): Promise<TradeResult> {
    const startTime = Date.now();

    try {
      // Check safety coordinator before trading
      if (this.context.safetyCoordinator) {
        const safetyStatus = this.context.safetyCoordinator.getCurrentStatus();
        if (safetyStatus.overall.safetyLevel !== "safe") {
          throw new Error(`Trading blocked by safety system: ${safetyStatus.overall.safetyLevel}`);
        }
      }

      // Prepare MEXC API parameters
      const mexcParams = {
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        quoteOrderQty: params.quoteOrderQty,
        timeInForce: params.timeInForce,
      };

      // Execute through MEXC service
      const mexcResult = await this.context.mexcService.placeOrder(mexcParams);

      if (!mexcResult.success || !mexcResult.data) {
        throw new Error(mexcResult.error || "Snipe trade execution failed");
      }

      const result: TradeResult = {
        success: true,
        data: {
          orderId: mexcResult.data.orderId.toString(),
          clientOrderId: mexcResult.data.clientOrderId,
          symbol: mexcResult.data.symbol,
          side: mexcResult.data.side,
          type: mexcResult.data.type,
          quantity: mexcResult.data.origQty,
          price: mexcResult.data.price,
          status: mexcResult.data.status,
          executedQty: mexcResult.data.executedQty,
          cummulativeQuoteQty: mexcResult.data.cummulativeQuoteQty,
          timestamp: new Date(mexcResult.data.transactTime).toISOString(),
          autoSnipe: true,
          confidenceScore: params.confidenceScore,
        },
        executionTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      this.context.logger.info("Real snipe trade executed successfully", {
        orderId: result.data?.orderId,
        symbol: params.symbol,
        executedQty: result.data?.executedQty,
      });

      return result;
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Real snipe trade execution failed", safeError);
      throw safeError;
    }
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return this.context.config;
  }

  /**
   * Check if ready for trading
   */
  isReadyForTrading(): boolean {
    return this.state.isInitialized && this.state.isHealthy;
  }

  /**
   * Validate configuration
   */
  async validateConfiguration(): Promise<boolean> {
    try {
      // Basic validation logic
      const config = this.context.config;
      return (
        config &&
        typeof config.autoSnipingEnabled === "boolean" &&
        typeof config.confidenceThreshold === "number" &&
        config.confidenceThreshold >= 0 &&
        config.confidenceThreshold <= 100
      );
    } catch (_error) {
      return false;
    }
  }

  /**
   * Perform health checks
   */
  async performHealthChecks(): Promise<boolean> {
    try {
      // Basic health check logic
      return this.state.isInitialized && this.state.isHealthy;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      activePositions: 0, // Would track actual positions
      totalTrades: this.processedTargets,
      successfulTrades: this.successfulSnipes,
      failedTrades: this.failedSnipes,
      successRate:
        this.processedTargets > 0 ? (this.successfulSnipes / this.processedTargets) * 100 : 0,
      timestamp: Date.now(),
    };
  }

  /**
   * Update statistics
   */
  updateStats(stats: any): void {
    // Update internal metrics with provided stats
    if (stats.activePositions !== undefined) {
      // Would update active positions tracking
    }
    if (stats.totalTrades !== undefined) {
      this.processedTargets = stats.totalTrades;
    }
    if (stats.timestamp !== undefined) {
      this.state.lastActivity = new Date(stats.timestamp);
    }
  }

  /**
   * Check if execution is active
   */
  isExecutionActive(): boolean {
    return this.isActive;
  }

  /**
   * Get active positions
   */
  getActivePositions(): any[] {
    // Would return actual active positions
    return [];
  }
}
