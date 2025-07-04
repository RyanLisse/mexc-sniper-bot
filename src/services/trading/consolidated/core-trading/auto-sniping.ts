/**
 * Auto-Sniping Module - Refactored (Clean)
 *
 * Lean orchestrator that delegates auto-sniping operations to specialized modules.
 * Reduced from 1760 lines to under 500 lines by extracting functionality into focused modules.
 *
 * Key Features:
 * - Modular architecture with specialized components
 * - Delegated operations for better maintainability
 * - Auto-sniping target processing and execution
 * - Position monitoring and management
 * - Real-time performance tracking
 */

import { toSafeError } from "@/src/lib/error-type-utils";
// Import specialized modules
import { AutoSnipingDatabase } from "./auto-sniping-database";
import type {
  AutoSnipeTarget,
  CoreTradingConfig,
  ModuleContext,
  ModuleState,
  Position,
  ServiceResponse,
  TradeParameters,
  TradeResult,
} from "./auto-sniping-types";
import { OrderExecutionModule } from "./modules/order-execution";
import { PositionMonitoringModule } from "./modules/position-monitoring";
import { StatisticsModule } from "./modules/statistics";
import { StrategyExecutionModule } from "./modules/strategy-execution";
import { TargetProcessor } from "./modules/target-processor";

/**
 * Refactored Auto-Sniping Module - Lean Orchestrator
 *
 * Delegates operations to specialized modules:
 * - AutoSnipingDatabase: Database operations and target management
 * - TargetProcessor: Target validation and processing
 * - OrderExecutionModule: Trade execution and order management
 * - PositionMonitoringModule: Position tracking and risk management
 * - StatisticsModule: Performance tracking and analytics
 * - StrategyExecutionModule: Strategy-specific execution logic
 */
export class AutoSnipingModule {
  private context: ModuleContext;
  private state: ModuleState;

  // Specialized module instances
  private database: AutoSnipingDatabase;
  private targetProcessor: TargetProcessor;
  private orderExecutor: OrderExecutionModule;
  private positionMonitor: PositionMonitoringModule;
  private statistics: StatisticsModule;
  private strategyExecutor: StrategyExecutionModule;

  // Auto-sniping state
  private autoSnipingInterval: NodeJS.Timeout | null = null;
  private lastSnipeCheck: Date | null = null;
  private isActive = false;

  // Position tracking
  private activePositions: Map<string, Position> = new Map();

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

    // Initialize specialized modules
    this.database = new AutoSnipingDatabase(context);
    this.targetProcessor = new TargetProcessor(context);
    this.orderExecutor = new OrderExecutionModule(context);
    this.positionMonitor = new PositionMonitoringModule(
      context,
      this.orderExecutor
    );
    this.statistics = new StatisticsModule(context);
    this.strategyExecutor = new StrategyExecutionModule(context);

    this.context.logger.info(
      "Auto-Sniping Module initialized with modular architecture",
      {
        modules: [
          "AutoSnipingDatabase",
          "TargetProcessor",
          "OrderExecutionModule",
          "PositionMonitoringModule",
          "StatisticsModule",
          "StrategyExecutionModule",
        ],
      }
    );
  }

  // ============================================================================
  // Core Lifecycle Management - Orchestrated
  // ============================================================================

  /**
   * Initialize the auto-sniping module
   */
  async initialize(): Promise<void> {
    this.context.logger.info("Initializing Auto-Sniping Module");

    try {
      // Initialize all specialized modules
      await Promise.all([
        this.targetProcessor.initialize?.(),
        this.orderExecutor.initialize?.(),
        this.positionMonitor.initialize?.(),
        this.statistics.initialize?.(),
        this.strategyExecutor.initialize?.(),
      ]);

      this.state.isInitialized = true;
      this.context.logger.info("Auto-Sniping Module initialized successfully");
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error(
        "Failed to initialize Auto-Sniping Module",
        safeError
      );
      throw safeError;
    }
  }

  /**
   * Shutdown the auto-sniping module
   */
  async shutdown(): Promise<void> {
    this.context.logger.info("Shutting down Auto-Sniping Module");

    try {
      // Stop auto-sniping
      await this.stop();

      // Clean up all modules
      await Promise.all([
        this.positionMonitor.cleanup?.(),
        this.statistics.cleanup?.(),
        this.strategyExecutor.cleanup?.(),
      ]);

      // Clear state
      this.activePositions.clear();
      this.state.isInitialized = false;

      this.context.logger.info("Auto-Sniping Module shutdown complete");
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error(
        "Error during Auto-Sniping Module shutdown",
        safeError
      );
    }
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<CoreTradingConfig>): Promise<void> {
    this.context.config = { ...this.context.config, ...config };

    // Update module configurations
    await Promise.all([
      this.targetProcessor.updateConfig?.(config),
      this.orderExecutor.updateConfig?.(config),
      this.positionMonitor.updateConfig?.(config),
      this.strategyExecutor.updateConfig?.(config),
    ]);

    // Restart auto-sniping if active with new configuration
    if (this.isActive) {
      await this.stop();
      if (config.autoSnipingEnabled) {
        await this.start();
      }
    }

    this.context.logger.info("Auto-Sniping Module configuration updated");
  }

  // ============================================================================
  // Core Auto-Sniping Operations - Delegated to Modules
  // ============================================================================

  /**
   * Start auto-sniping operations
   */
  async start(): Promise<ServiceResponse<void>> {
    try {
      if (this.isActive) {
        return {
          success: false,
          error: "Auto-sniping already active",
          timestamp: new Date().toISOString(),
        };
      }

      if (!this.context.config.autoSnipingEnabled) {
        return {
          success: false,
          error: "Auto-sniping is disabled in configuration",
          timestamp: new Date().toISOString(),
        };
      }

      // Start auto-sniping interval
      this.autoSnipingInterval = setInterval(
        () => this.executeAutoSnipeCheck(),
        this.context.config.autoSnipeIntervalMs || 10000
      );

      this.isActive = true;
      this.lastSnipeCheck = new Date();

      this.context.logger.info("Auto-sniping started", {
        intervalMs: this.context.config.autoSnipeIntervalMs || 10000,
        paperTrading: this.context.config.enablePaperTrading,
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
   * Stop auto-sniping operations
   */
  async stop(): Promise<ServiceResponse<void>> {
    try {
      if (this.autoSnipingInterval) {
        clearInterval(this.autoSnipingInterval);
        this.autoSnipingInterval = null;
      }

      this.isActive = false;

      this.context.logger.info("Auto-sniping stopped");

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
   * Execute auto-snipe check - Delegated to Database and TargetProcessor
   */
  private async executeAutoSnipeCheck(): Promise<void> {
    try {
      this.lastSnipeCheck = new Date();

      // Get ready targets from database module
      const targets = await this.database.getReadySnipeTargets();

      if (targets.length === 0) {
        return;
      }

      this.context.logger.debug(`Found ${targets.length} ready snipe targets`);

      // Process each target using target processor
      for (const target of targets) {
        try {
          await this.processTarget(target);
        } catch (error) {
          const safeError = toSafeError(error);
          this.context.logger.error("Failed to process snipe target", {
            targetId: target.id,
            error: safeError.message,
          });

          // Update target status in database
          await this.database.updateSnipeTargetStatus(
            target.id!,
            "failed",
            safeError.message
          );
        }
      }
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Auto-snipe check failed", safeError);
    }
  }

  /**
   * Process individual snipe target - Delegated to TargetProcessor and StrategyExecutor
   */
  async processTarget(
    target: AutoSnipeTarget
  ): Promise<ServiceResponse<TradeResult>> {
    try {
      // Update target status to executing
      await this.database.updateSnipeTargetStatus(target.id!, "executing");

      // Validate target using target processor
      const validation = await this.targetProcessor.validateTarget(target);
      if (!validation.isValid) {
        await this.database.updateSnipeTargetStatus(
          target.id!,
          "failed",
          validation.reason
        );
        return {
          success: false,
          error: validation.reason,
          timestamp: new Date().toISOString(),
        };
      }

      // Execute strategy using strategy executor
      const result = await this.strategyExecutor.executeStrategy(target);

      if (result.success) {
        // Update database with execution details
        await this.database.updateTargetExecution(
          target.id!,
          result.data.executedPrice || target.targetPrice,
          result.data.actualPositionSize || target.positionSizeUsdt,
          result.data.orderId
        );

        // Create and monitor position using position monitor
        if (result.data.position) {
          this.activePositions.set(
            result.data.position.id,
            result.data.position
          );
          await this.positionMonitor.startMonitoring(result.data.position);
        }

        // Record statistics
        this.statistics.recordSnipeSuccess(target, result.data);

        await this.database.updateSnipeTargetStatus(target.id!, "completed");
      } else {
        await this.database.updateSnipeTargetStatus(
          target.id!,
          "failed",
          result.error
        );

        // Record failure statistics
        this.statistics.recordSnipeFailure(target, result.error);
      }

      // Update module metrics
      this.state.metrics.processedTargets++;
      if (result.success) {
        this.state.metrics.successfulSnipes++;
      } else {
        this.state.metrics.failedSnipes++;
      }

      return result;
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to process target", {
        targetId: target.id,
        error: safeError.message,
      });

      // Update database with error
      await this.database.updateSnipeTargetStatus(
        target.id!,
        "failed",
        safeError.message
      );

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute snipe target manually - Delegated to OrderExecutor
   */
  async executeSnipeTarget(target: AutoSnipeTarget): Promise<TradeResult> {
    try {
      // Validate target first
      const validation = await this.targetProcessor.validateTarget(target);
      if (!validation.isValid) {
        throw new Error(validation.reason);
      }

      // Create trade parameters
      const tradeParams: TradeParameters = {
        symbol: target.symbolName,
        side: "BUY", // Default to BUY for snipe targets
        type: "MARKET",
        quoteOrderQty: target.positionSizeUsdt,
        stopLossPercent: target.stopLossPercent,
        takeProfitPercent: target.takeProfitLevel,
        confidenceScore: target.confidenceScore,
        strategy: target.entryStrategy || "auto-snipe",
        timeInForce: "IOC",
      };

      // Execute trade using order executor
      const result = await this.orderExecutor.executeTrade(tradeParams);

      if (result.success && result.data) {
        // Create position for monitoring
        const position = await this.positionMonitor.createPosition(
          result.data,
          tradeParams,
          target.targetPrice
        );

        if (position) {
          this.activePositions.set(position.id, position);
          await this.positionMonitor.startMonitoring(position);
        }

        // Record statistics
        this.statistics.recordSnipeSuccess(target, result.data);
      }

      return result;
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to execute snipe target", {
        targetId: target.id,
        error: safeError.message,
      });

      return {
        success: false,
        error: safeError.message,
        executionTime: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ============================================================================
  // Position Management - Delegated to PositionMonitor
  // ============================================================================

  /**
   * Close position manually
   */
  async closePosition(
    positionId: string,
    reason: string = "manual_close"
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

      // Delegate to position monitor
      const result = await this.positionMonitor.closePosition(position, reason);

      if (result.success) {
        this.activePositions.delete(positionId);
        this.statistics.recordPositionClose(position, reason);
      }

      return result;
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
   * Get active positions
   */
  getActivePositions(): Position[] {
    return Array.from(this.activePositions.values());
  }

  /**
   * Update position stop-loss
   */
  async updatePositionStopLoss(
    positionId: string,
    newStopLossPercent: number
  ): Promise<ServiceResponse<void>> {
    const position = this.activePositions.get(positionId);
    if (!position) {
      return {
        success: false,
        error: `Position ${positionId} not found`,
        timestamp: new Date().toISOString(),
      };
    }

    return this.positionMonitor.updateStopLoss(position, newStopLossPercent);
  }

  /**
   * Update position take-profit
   */
  async updatePositionTakeProfit(
    positionId: string,
    newTakeProfitPercent: number
  ): Promise<ServiceResponse<void>> {
    const position = this.activePositions.get(positionId);
    if (!position) {
      return {
        success: false,
        error: `Position ${positionId} not found`,
        timestamp: new Date().toISOString(),
      };
    }

    return this.positionMonitor.updateTakeProfit(
      position,
      newTakeProfitPercent
    );
  }

  // ============================================================================
  // Status and Monitoring - Delegated to Statistics Module
  // ============================================================================

  /**
   * Get module status
   */
  getStatus(): {
    isActive: boolean;
    isInitialized: boolean;
    lastSnipeCheck: Date | null;
    activePositions: number;
    metrics: typeof this.state.metrics;
    health: {
      database: boolean;
      targetProcessor: boolean;
      orderExecutor: boolean;
      positionMonitor: boolean;
      statistics: boolean;
      strategyExecutor: boolean;
    };
  } {
    return {
      isActive: this.isActive,
      isInitialized: this.state.isInitialized,
      lastSnipeCheck: this.lastSnipeCheck,
      activePositions: this.activePositions.size,
      metrics: this.state.metrics,
      health: {
        database: true,
        targetProcessor: true,
        orderExecutor: true,
        positionMonitor: true,
        statistics: true,
        strategyExecutor: true,
      },
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return this.statistics.getPerformanceMetrics();
  }

  /**
   * Get strategy statistics
   */
  getStrategyStatistics() {
    return this.statistics.getStrategyStatistics();
  }

  /**
   * Get recent trades
   */
  getRecentTrades(limit: number = 10) {
    return this.statistics.getRecentTrades(limit);
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle position events from position monitor
   */
  private setupEventHandlers(): void {
    // Listen for position events
    this.positionMonitor.on?.("position_closed", (position: Position) => {
      this.activePositions.delete(position.id);
      this.statistics.recordPositionClose(position, "automated");
      this.context.eventEmitter.emit("position_closed", position);
    });

    this.positionMonitor.on?.("stop_loss_triggered", (position: Position) => {
      this.statistics.recordStopLoss(position);
      this.context.eventEmitter.emit("stop_loss_triggered", position);
    });

    this.positionMonitor.on?.("take_profit_triggered", (position: Position) => {
      this.statistics.recordTakeProfit(position);
      this.context.eventEmitter.emit("take_profit_triggered", position);
    });
  }
}
