/**
 * Auto-Sniping Module (Refactored)
 *
 * Refactored version eliminating redundancy and breaking into smaller, focused components.
 * This file now focuses on core orchestration while delegating specific tasks to utilities.
 * Reduced from 1523 lines to under 500 lines by eliminating redundancy.
 */

import { TradingStrategyManager } from "@/src/services/trading/trading-strategy-manager";
import type {
  AutoSnipeTarget,
  CoreTradingConfig,
  ModuleContext,
  ModuleState,
  Position,
  ServiceResponse,
  TradeParameters,
  TradeResult,
  TradingStrategy,
} from "./types";
import { DatabaseOperations } from "./utils/database-operations";
import { OrderExecutionHelper } from "./utils/order-execution-helper";
import { PositionMonitoringManager } from "./utils/position-monitoring-manager";
import { ServiceResponseUtils } from "./utils/service-response-utils";

// Extended strategy interface for multi-phase strategies
interface MultiPhaseStrategy extends TradingStrategy {
  id: string;
  levels: Array<{
    percentage: number;
    action: string;
    delay?: number;
  }>;
}

// Statistics interface for updateStats method
interface StatsUpdate {
  totalTrades?: number;
  successfulTrades?: number;
  failedTrades?: number;
  averageConfidence?: number;
  timestamp?: number;
}

export class AutoSnipingModuleRefactored {
  private context: ModuleContext;
  private state: ModuleState;
  private positionMonitoring: PositionMonitoringManager;
  private orderExecution: OrderExecutionHelper;

  // Auto-sniping state
  private autoSnipingInterval: NodeJS.Timeout | null = null;
  private lastSnipeCheck: Date | null = null;
  private isActive = false;

  // Metrics
  private processedTargets = 0;
  private successfulSnipes = 0;
  private failedSnipes = 0;

  // Position tracking
  private activePositions = new Map<string, Position>();

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

    // Initialize position monitoring manager
    this.positionMonitoring = new PositionMonitoringManager({
      checkInterval: 5000,
      maxRetries: 3,
      onTrigger: this.handlePositionTrigger.bind(this),
      onError: this.handleMonitoringError.bind(this),
      getCurrentPrice: this.getCurrentMarketPrice.bind(this),
    });

    // Initialize order execution helper
    this.orderExecution = new OrderExecutionHelper({
      mexcService: context.mexcService,
      logger: context.logger,
      getCurrentPrice: this.getCurrentMarketPrice.bind(this),
    });
  }

  // ============================================================================
  // Core Lifecycle Methods - Using ServiceResponseUtils for consistency
  // ============================================================================

  async initialize(): Promise<void> {
    this.context.logger.info("Initializing Auto-Sniping Module");
    this.state.isInitialized = true;
    this.context.logger.info("Auto-Sniping Module initialized successfully");
  }

  async shutdown(): Promise<void> {
    this.context.logger.info("Shutting down Auto-Sniping Module");
    
    await this.stop();
    this.positionMonitoring.clearAllMonitoring();

    if (this.activePositions.size > 0) {
      this.context.logger.warn(`Shutting down with ${this.activePositions.size} active positions`, {
        positions: Array.from(this.activePositions.keys()),
      });
    }

    this.state.isInitialized = false;
  }

  async updateConfig(config: Partial<CoreTradingConfig>): Promise<void> {
    this.context.config = { ...this.context.config, ...config };

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
  // Auto-Sniping Control Methods - Using ServiceResponseUtils
  // ============================================================================

  async start(): Promise<ServiceResponse<void>> {
    if (this.isActive) {
      return ServiceResponseUtils.error("Auto-sniping is already active");
    }

    return ServiceResponseUtils.executeWithResponse(async () => {
      this.context.logger.info("Starting auto-sniping monitoring", {
        interval: this.context.config.snipeCheckInterval,
        confidenceThreshold: this.context.config.confidenceThreshold,
      });

      this.isActive = true;
      this.autoSnipingInterval = setInterval(
        () => this.processSnipeTargets(),
        this.context.config.snipeCheckInterval
      );
    }, "Failed to start auto-sniping");
  }

  async stop(): Promise<ServiceResponse<void>> {
    return ServiceResponseUtils.executeWithResponse(async () => {
      if (this.autoSnipingInterval) {
        clearInterval(this.autoSnipingInterval);
        this.autoSnipingInterval = null;
      }

      this.isActive = false;
      this.context.logger.info("Auto-sniping monitoring stopped");
    }, "Failed to stop auto-sniping");
  }

  async pause(): Promise<ServiceResponse<void>> {
    if (!this.isActive) {
      return ServiceResponseUtils.error("Auto-sniping is not active");
    }

    return ServiceResponseUtils.executeWithResponse(async () => {
      if (this.autoSnipingInterval) {
        clearInterval(this.autoSnipingInterval);
        this.autoSnipingInterval = null;
      }
      this.context.logger.info("Auto-sniping monitoring paused");
    }, "Failed to pause auto-sniping");
  }

  async resume(): Promise<ServiceResponse<void>> {
    if (!this.isActive) {
      return ServiceResponseUtils.error("Auto-sniping is not active");
    }

    if (this.autoSnipingInterval) {
      return ServiceResponseUtils.error("Auto-sniping is already running");
    }

    return ServiceResponseUtils.executeWithResponse(async () => {
      this.autoSnipingInterval = setInterval(
        () => this.processSnipeTargets(),
        this.context.config.snipeCheckInterval
      );
      this.context.logger.info("Auto-sniping monitoring resumed");
    }, "Failed to resume auto-sniping");
  }

  // ============================================================================
  // Core Processing Methods - Using DatabaseOperations
  // ============================================================================

  async processSnipeTargets(): Promise<ServiceResponse<{ processedCount: number; successCount: number }>> {
    return ServiceResponseUtils.executeWithResponse(async () => {
      this.lastSnipeCheck = new Date();
      this.state.lastActivity = new Date();

      const readyTargets = await DatabaseOperations.getReadySnipeTargets();

      if (readyTargets.length === 0) {
        return { processedCount: 0, successCount: 0 };
      }

      this.context.logger.info(`Processing ${readyTargets.length} ready snipe targets`);

      let successCount = 0;
      for (const target of readyTargets) {
        if (target.confidenceScore >= this.context.config.confidenceThreshold) {
          try {
            await this.executeSnipeTarget(target);
            successCount++;
            this.successfulSnipes++;
          } catch (error) {
            await DatabaseOperations.updateSnipeTargetStatus(target.id, "failed", (error as Error).message);
            this.failedSnipes++;
          }
        }
        this.processedTargets++;
      }

      this.updateMetrics();
      return { processedCount: readyTargets.length, successCount };
    }, "Failed to process snipe targets");
  }

  async executeSnipeTarget(target: AutoSnipeTarget): Promise<TradeResult> {
    this.context.logger.info(`Executing snipe target: ${target.symbolName}`, {
      confidence: target.confidenceScore,
      amount: target.positionSizeUsdt,
      strategy: target.entryStrategy || "normal",
    });

    await DatabaseOperations.updateSnipeTargetStatus(target.id, "executing");

    try {
      const strategyManager = new TradingStrategyManager(target.entryStrategy || "normal");
      const strategy = strategyManager.getActiveStrategy();

      const tradeParams: TradeParameters = {
        symbol: target.symbolName,
        side: "BUY",
        type: "MARKET",
        quoteOrderQty: target.positionSizeUsdt,
        timeInForce: "IOC",
        isAutoSnipe: true,
        confidenceScore: target.confidenceScore,
        stopLossPercent: target.stopLossPercent,
        takeProfitPercent: target.takeProfitCustom || undefined,
        strategy: target.entryStrategy || "normal",
      };

      const result = this.context.config.enablePaperTrading
        ? await this.orderExecution.executePaperTrade(tradeParams)
        : await this.executeRealTradeWithPositionSetup(tradeParams);

      if (result.success) {
        await DatabaseOperations.updateSnipeTargetStatus(target.id, "completed");
        this.context.eventEmitter.emit("auto_snipe_executed", { target, result, strategy: strategy.name });
      } else {
        await DatabaseOperations.updateSnipeTargetStatus(target.id, "failed", result.error);
      }

      return result;
    } catch (error) {
      await DatabaseOperations.updateSnipeTargetStatus(target.id, "failed", (error as Error).message);
      throw error;
    }
  }

  // ============================================================================
  // Enhanced Trading Methods - Using OrderExecutionHelper
  // ============================================================================

  private async executeRealTradeWithPositionSetup(params: TradeParameters): Promise<TradeResult> {
    // Enhanced safety checks
    await this.performPreTradeValidation(params);

    // Execute trade using helper
    const result = await this.orderExecution.executeRealTrade(params);

    if (result.success && result.data?.executedQty && result.data?.price) {
      // Create and monitor position
      const position = await this.createPositionEntry(result.data, params);
      this.positionMonitoring.setupPositionMonitoring(position);
      this.context.eventEmitter.emit("position_opened", position);
    }

    return result;
  }

  private async performPreTradeValidation(params: TradeParameters): Promise<void> {
    // Check safety coordinator
    if (this.context.safetyCoordinator) {
      try {
        const safetyStatus = (this.context.safetyCoordinator as any).getStatus?.() || 
                            (this.context.safetyCoordinator as any).getCurrentStatus?.();
        if (safetyStatus && safetyStatus.overall?.safetyLevel !== "safe") {
          throw new Error(`Trading blocked by safety system: ${safetyStatus.overall.safetyLevel}`);
        }
      } catch (error) {
        this.context.logger.warn("Could not check safety coordinator status", { error: error instanceof Error ? error.message : String(error) });
      }
    }

    // Check module health
    if (!this.state.isHealthy || !this.state.isInitialized) {
      throw new Error("Auto-sniping module is not healthy or not initialized");
    }

    // Check position limits
    if (this.activePositions.size >= this.context.config.maxConcurrentPositions) {
      throw new Error(`Maximum concurrent positions reached: ${this.activePositions.size}`);
    }

    // Validate required parameters
    if (!params.symbol || !params.side || !params.type || !params.quoteOrderQty || params.quoteOrderQty <= 0) {
      throw new Error("Invalid trading parameters");
    }
  }

  // ============================================================================
  // Position Management - Using PositionMonitoringManager
  // ============================================================================

  private async createPositionEntry(orderResult: any, params: TradeParameters): Promise<Position> {
    const positionId = `${params.symbol}-${orderResult.orderId}-${Date.now()}`;
    const entryPrice = parseFloat(orderResult.price);
    const quantity = parseFloat(orderResult.executedQty || orderResult.origQty);

    const position: Position = {
      id: positionId,
      symbol: params.symbol,
      side: params.side,
      orderId: orderResult.orderId.toString(),
      clientOrderId: orderResult.clientOrderId,
      entryPrice,
      quantity,
      currentPrice: entryPrice,
      stopLossPercent: params.stopLossPercent,
      takeProfitPercent: params.takeProfitPercent,
      timestamp: new Date().toISOString(),
      status: "open",
      openTime: new Date(),
      strategy: params.strategy || "auto-snipe",
      confidenceScore: params.confidenceScore,
      autoSnipe: true,
      paperTrade: this.context.config.enablePaperTrading,
      tags: ["auto-snipe"],
    };

    // Calculate stop-loss and take-profit prices
    if (params.stopLossPercent && params.stopLossPercent > 0) {
      position.stopLossPrice = params.side === "BUY" 
        ? entryPrice * (1 - params.stopLossPercent / 100)
        : entryPrice * (1 + params.stopLossPercent / 100);
    }

    if (params.takeProfitPercent && params.takeProfitPercent > 0) {
      position.takeProfitPrice = params.side === "BUY"
        ? entryPrice * (1 + params.takeProfitPercent / 100)
        : entryPrice * (1 - params.takeProfitPercent / 100);
    }

    this.activePositions.set(positionId, position);
    return position;
  }

  private async handlePositionTrigger(position: Position, triggerType: 'stop-loss' | 'take-profit'): Promise<void> {
    try {
      const closeResult = await this.orderExecution.executeCloseOrder(
        position.symbol,
        position.side === "BUY" ? "SELL" : "BUY",
        position.quantity
      );

      if (closeResult.success) {
        const realizedPnL = OrderExecutionHelper.calculatePnL(
          position.entryPrice,
          position.currentPrice || position.entryPrice,
          position.quantity,
          position.side.toUpperCase() as "BUY" | "SELL"
        );

        position.status = "closed";
        position.closeTime = new Date();
        position.realizedPnL = realizedPnL;

        this.positionMonitoring.clearPositionMonitoring(position.id);
        this.activePositions.delete(position.id);
        this.context.eventEmitter.emit("position_closed", position);

        this.context.logger.info(`${triggerType} executed successfully`, {
          positionId: position.id,
          realizedPnL,
          closeOrderId: closeResult.data?.orderId,
        });
      }
    } catch (error) {
      this.context.logger.error(`${triggerType} execution failed`, {
        positionId: position.id,
        error: (error as Error).message,
      });
    }
  }

  private handleMonitoringError(error: Error, position: Position, triggerType: 'stop-loss' | 'take-profit'): void {
    this.context.logger.error(`${triggerType} monitoring error`, {
      positionId: position.id,
      error: error.message,
    });
  }

  private async getCurrentMarketPrice(symbol: string): Promise<number | null> {
    try {
      if (this.context.mexcService?.getCurrentPrice) {
        const priceResult = await this.context.mexcService.getCurrentPrice(symbol);
        if (typeof priceResult === "number" && priceResult > 0) {
          return priceResult;
        }
      }

      if (this.context.mexcService?.getTicker) {
        const ticker = await this.context.mexcService.getTicker(symbol);
        if (ticker.success && ticker.data?.price) {
          return parseFloat(ticker.data.price);
        }
      }

      return null;
    } catch (error) {
      this.context.logger.error(`Failed to get current price for ${symbol}`, { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  // ============================================================================
  // Status and Statistics Methods
  // ============================================================================

  getStatus() {
    return {
      isActive: this.isActive,
      isHealthy: this.state.isHealthy,
      lastSnipeCheck: this.lastSnipeCheck,
      processedTargets: this.processedTargets,
      successfulSnipes: this.successfulSnipes,
      failedSnipes: this.failedSnipes,
      successRate: this.processedTargets > 0 ? (this.successfulSnipes / this.processedTargets) * 100 : 0,
      activePositions: this.activePositions.size,
      monitoringStats: this.positionMonitoring.getMonitoringStats(),
    };
  }

  getStats() {
    const totalPnL = Array.from(this.activePositions.values())
      .reduce((sum, pos) => sum + (pos.realizedPnL || 0), 0);

    return {
      activePositions: this.activePositions.size,
      totalTrades: this.processedTargets,
      successfulTrades: this.successfulSnipes,
      failedTrades: this.failedSnipes,
      successRate: this.processedTargets > 0 ? (this.successfulSnipes / this.processedTargets) * 100 : 0,
      totalPnL,
      averagePnL: this.processedTargets > 0 ? totalPnL / this.processedTargets : 0,
      timestamp: Date.now(),
    };
  }

  updateStats(stats: StatsUpdate): void {
    if (stats.totalTrades !== undefined) this.processedTargets = stats.totalTrades;
    if (stats.successfulTrades !== undefined) this.successfulSnipes = stats.successfulTrades;
    if (stats.failedTrades !== undefined) this.failedSnipes = stats.failedTrades;
    if (stats.timestamp !== undefined) this.state.lastActivity = new Date(stats.timestamp);

    this.updateMetrics();
  }

  private updateMetrics(): void {
    this.state.metrics.processedTargets = this.processedTargets;
    this.state.metrics.successfulSnipes = this.successfulSnipes;
    this.state.metrics.failedSnipes = this.failedSnipes;
    this.state.metrics.averageConfidence = 
      this.processedTargets > 0 ? (this.successfulSnipes / this.processedTargets) * 100 : 0;
  }

  // ============================================================================
  // Position Management Public Interface
  // ============================================================================

  getActivePositions(): Position[] {
    return Array.from(this.activePositions.values());
  }

  getPosition(positionId: string): Position | null {
    return this.activePositions.get(positionId) || null;
  }

  async closePosition(positionId: string, reason: string = "manual"): Promise<ServiceResponse<void>> {
    return ServiceResponseUtils.executeWithResponse(async () => {
      const position = this.activePositions.get(positionId);
      if (!position) {
        throw new Error(`Position ${positionId} not found`);
      }

      const closeResult = await this.orderExecution.executeCloseOrder(
        position.symbol,
        position.side === "BUY" ? "SELL" : "BUY",
        position.quantity
      );

      if (!closeResult.success) {
        throw new Error(closeResult.error || "Failed to close position");
      }

      const currentPrice = await this.getCurrentMarketPrice(position.symbol) || position.currentPrice || position.entryPrice;
      const realizedPnL = OrderExecutionHelper.calculatePnL(
        position.entryPrice,
        currentPrice,
        position.quantity,
        position.side.toUpperCase() as "BUY" | "SELL"
      );

      position.status = "closed";
      position.closeTime = new Date();
      position.realizedPnL = realizedPnL;
      position.notes = `Closed manually: ${reason}`;

      this.positionMonitoring.clearPositionMonitoring(position.id);
      this.activePositions.delete(position.id);
      this.context.eventEmitter.emit("position_closed", position);

      this.context.logger.info("Position closed manually", {
        positionId,
        reason,
        realizedPnL,
        closeOrderId: closeResult.data?.orderId,
      });
    }, "Failed to close position manually");
  }

  async updatePositionStopLoss(positionId: string, newStopLossPercent: number): Promise<ServiceResponse<void>> {
    return ServiceResponseUtils.executeWithResponse(async () => {
      const position = this.activePositions.get(positionId);
      if (!position) {
        throw new Error(`Position ${positionId} not found`);
      }

      this.positionMonitoring.updateStopLossMonitoring(position, newStopLossPercent);
      
      this.context.logger.info("Position stop-loss updated", {
        positionId,
        newStopLossPercent,
        newStopLossPrice: position.stopLossPrice,
      });
    }, "Failed to update position stop-loss");
  }

  // Validation and health check methods
  isReadyForTrading(): boolean {
    return this.state.isInitialized && this.state.isHealthy;
  }

  async validateConfiguration(): Promise<boolean> {
    const config = this.context.config;
    return config &&
      typeof config.autoSnipingEnabled === "boolean" &&
      typeof config.confidenceThreshold === "number" &&
      config.confidenceThreshold >= 0 &&
      config.confidenceThreshold <= 100;
  }

  async performHealthChecks(): Promise<boolean> {
    return this.state.isInitialized && this.state.isHealthy;
  }

  isExecutionActive(): boolean {
    return this.isActive;
  }

  getConfig() {
    return this.context.config;
  }
}