/**
 * Optimized Auto-Sniping Execution Engine
 *
 * Core execution engine for auto-sniping operations.
 * Replaces the monolithic auto-sniping-execution-service.ts (1042 lines)
 * with focused, optimized modules under 500 lines each.
 */

import { PatternDetectionCore, type PatternMatch } from "../core/pattern-detection";
import { getErrorMessage, toSafeError } from "../lib/error-type-utils";
import { createLogger, createTimer } from "../lib/structured-logger";
import { EmergencySafetySystem } from "./emergency-safety-system";
import { getRecommendedMexcService } from "./mexc-unified-exports";
import {
  type AutoSnipingConfig,
  AutoSnipingConfigSchema,
  type ExecutionAlert,
  type ExecutionPosition,
  type ExecutionStats,
  ExecutionStatsSchema,
  type PatternType,
  validateAutoSnipingConfig,
  validateExecutionPosition,
} from "./optimized-auto-sniping-schemas";
import { PatternMonitoringService } from "./pattern-monitoring-service";
import { UnifiedMexcServiceV2 } from "./unified-mexc-service-v2";

type TradingContext = {
  requestId: string;
  startTime: number;
  userId: string;
};

type TradeExecutionResult = {
  success: boolean;
  orderId?: string;
  executedPrice?: string;
  error?: string;
};

/**
 * Core execution engine for auto-sniping operations
 * Handles pattern-based trading with comprehensive validation and monitoring
 */
export class OptimizedAutoSnipingExecutionEngine {
  private static instance: OptimizedAutoSnipingExecutionEngine;

  private patternEngine: PatternDetectionCore;
  private patternMonitoring: PatternMonitoringService;
  private mexcService: UnifiedMexcServiceV2;
  private safetySystem: EmergencySafetySystem;
  private logger = createLogger("optimized-auto-sniping-execution");

  private config: AutoSnipingConfig;
  private isExecutionActive = false;
  private activePositions: Map<string, ExecutionPosition> = new Map();
  private executionHistory: ExecutionPosition[] = [];
  private alerts: ExecutionAlert[] = [];
  private stats: ExecutionStats;

  private executionInterval: NodeJS.Timeout | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.patternEngine = PatternDetectionCore.getInstance();
    this.patternMonitoring = PatternMonitoringService.getInstance();
    this.mexcService = new UnifiedMexcServiceV2();
    this.safetySystem = new EmergencySafetySystem();

    this.config = this.getDefaultConfig();
    this.stats = this.getDefaultStats();

    this.logger.info("Optimized execution engine initialized", {
      operation: "initialization",
      maxPositions: this.config.maxPositions,
      enabled: this.config.enabled,
    });
  }

  public static getInstance(): OptimizedAutoSnipingExecutionEngine {
    if (!OptimizedAutoSnipingExecutionEngine.instance) {
      OptimizedAutoSnipingExecutionEngine.instance = new OptimizedAutoSnipingExecutionEngine();
    }
    return OptimizedAutoSnipingExecutionEngine.instance;
  }

  /**
   * Start auto-sniping execution with comprehensive pre-flight checks
   */
  public async startExecution(): Promise<void> {
    if (this.isExecutionActive) {
      throw new Error("Auto-sniping execution is already active");
    }

    this.logger.info("Starting optimized auto-sniping execution", {
      operation: "start_execution",
      config: {
        maxPositions: this.config.maxPositions,
        minConfidence: this.config.minConfidence,
        enableAdvanceDetection: this.config.enableAdvanceDetection,
      },
    });

    await this.performPreflightChecks();
    this.isExecutionActive = true;

    // Start optimized execution cycles
    this.startExecutionCycles();
    this.addAlert({
      type: "position_opened",
      severity: "info",
      message: "Optimized auto-sniping execution started",
      details: { config: this.config },
    });
  }

  /**
   * Stop execution and cleanup resources
   */
  public stopExecution(): void {
    this.logger.info("Stopping auto-sniping execution", {
      operation: "stop_execution",
      activePositions: this.activePositions.size,
      totalTrades: this.stats.totalTrades,
    });

    this.isExecutionActive = false;
    this.clearIntervals();

    this.addAlert({
      type: "position_closed",
      severity: "info",
      message: "Auto-sniping execution stopped",
      details: { activePositions: this.activePositions.size },
    });
  }

  /**
   * Update configuration with validation
   */
  public updateConfig(newConfig: Partial<AutoSnipingConfig>): void {
    const mergedConfig = { ...this.config, ...newConfig };
    this.config = validateAutoSnipingConfig(mergedConfig);

    this.addAlert({
      type: "position_opened",
      severity: "info",
      message: "Configuration updated",
      details: { updatedFields: Object.keys(newConfig) },
    });

    this.logger.info("Configuration updated", {
      operation: "config_update",
      updatedFields: Object.keys(newConfig),
    });
  }

  /**
   * Get current configuration (always enabled)
   */
  public async getConfig(): Promise<AutoSnipingConfig> {
    return { ...this.config, enabled: true };
  }

  /**
   * Check if ready for trading
   */
  public isReadyForTrading(): boolean {
    return !this.isExecutionActive;
  }

  /**
   * Get active positions
   */
  public getActivePositions(): ExecutionPosition[] {
    return Array.from(this.activePositions.values());
  }

  /**
   * Close position with validation
   */
  public async closePosition(positionId: string, reason = "manual"): Promise<boolean> {
    const position = this.activePositions.get(positionId);
    if (!position) {
      throw new Error(`Position not found: ${positionId}`);
    }

    try {
      const closeResult = await this.executeCloseOrder(position);
      if (closeResult.success) {
        this.finalizePositionClose(position, reason);
        return true;
      }
      return false;
    } catch (error) {
      this.handlePositionCloseError(position, error, reason);
      return false;
    }
  }

  /**
   * Emergency close all positions
   */
  public async emergencyCloseAll(): Promise<number> {
    this.logger.warn("Emergency close all positions initiated", {
      operation: "emergency_close_all",
      totalPositions: this.activePositions.size,
    });

    let closedCount = 0;
    const positions = Array.from(this.activePositions.values());

    const closePromises = positions.map(async (position) => {
      try {
        const success = await this.closePosition(position.id, "emergency");
        return success ? 1 : 0;
      } catch (error) {
        this.logger.error("Emergency close failed", { positionId: position.id }, error);
        return 0;
      }
    });

    const results = await Promise.allSettled(closePromises);
    closedCount = results
      .filter((result) => result.status === "fulfilled")
      .reduce((sum, result) => sum + (result.value || 0), 0);

    this.addAlert({
      type: "execution_error",
      severity: "critical",
      message: `Emergency close completed: ${closedCount}/${positions.length} positions closed`,
      details: { closedCount, totalPositions: positions.length },
    });

    return closedCount;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async performPreflightChecks(): Promise<void> {
    const timer = createTimer("preflight_checks", "optimized-auto-sniping");

    // API connectivity check
    try {
      const accountInfo = await this.mexcService.getAccountBalances();
      if (!accountInfo.success) {
        throw new Error("Failed to get account balances");
      }
    } catch (error) {
      throw new Error(`API connectivity check failed: ${getErrorMessage(error)}`);
    }

    // Safety system check
    const safetyStatus = await this.safetySystem.performSystemHealthCheck();
    if (safetyStatus.overall === "critical") {
      throw new Error(
        `Safety system in critical state: ${safetyStatus.criticalIssues?.join(", ") || "Unknown critical issues"}`
      );
    }

    const duration = timer.end();
    this.logger.info("Pre-flight checks passed", {
      operation: "preflight_checks",
      duration,
      safetyStatus: safetyStatus.overall,
    });
  }

  private startExecutionCycles(): void {
    // Optimized execution cycle - every 5 seconds
    this.executionInterval = setInterval(() => {
      this.performExecutionCycle().catch((error) => {
        this.logger.error(
          "Execution cycle failed",
          { activePositions: this.activePositions.size },
          error
        );
        this.addAlert({
          type: "execution_error",
          severity: "error",
          message: `Execution cycle failed: ${getErrorMessage(error)}`,
          details: { error: getErrorMessage(error) },
        });
      });
    }, 5000);

    // Optimized monitoring cycle - every 10 seconds
    this.monitoringInterval = setInterval(() => {
      this.monitorActivePositions().catch((error) => {
        this.logger.error(
          "Position monitoring failed",
          { activePositions: this.activePositions.size },
          error
        );
      });
    }, 10000);
  }

  private clearIntervals(): void {
    if (this.executionInterval) {
      clearInterval(this.executionInterval);
      this.executionInterval = null;
    }
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  private async performExecutionCycle(): Promise<void> {
    if (!this.isExecutionActive || !this.canExecuteNewTrades()) {
      return;
    }

    const patterns = this.patternMonitoring.getRecentPatterns(10);
    const eligiblePatterns = this.filterEligiblePatterns(patterns);

    if (eligiblePatterns.length === 0) return;

    // Execute trades in parallel for efficiency
    const executionPromises = eligiblePatterns
      .slice(0, this.config.maxPositions - this.activePositions.size)
      .map((pattern) => this.executeTradeForPattern(pattern));

    await Promise.allSettled(executionPromises);
  }

  private canExecuteNewTrades(): boolean {
    return (
      this.stats.dailyTradeCount < this.config.maxDailyTrades &&
      this.activePositions.size < this.config.maxPositions
    );
  }

  private filterEligiblePatterns(patterns: PatternMatch[]): PatternMatch[] {
    return patterns.filter((pattern) => {
      return (
        pattern.confidence >= this.config.minConfidence &&
        this.config.allowedPatternTypes.includes(pattern.patternType as PatternType) &&
        !this.hasActivePositionForSymbol(pattern.symbol) &&
        this.isPatternTypeAllowed(pattern)
      );
    });
  }

  private hasActivePositionForSymbol(symbol: string): boolean {
    return Array.from(this.activePositions.values()).some((pos) => pos.symbol === symbol);
  }

  private isPatternTypeAllowed(pattern: PatternMatch): boolean {
    if (pattern.patternType === "launch_sequence" && !this.config.enableAdvanceDetection) {
      return false;
    }
    return true;
  }

  private async executeTradeForPattern(pattern: PatternMatch): Promise<void> {
    const startTime = Date.now();
    const context: TradingContext = {
      requestId: `trade_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      startTime,
      userId: "system",
    };

    try {
      const quantity = this.calculatePositionSize(pattern.symbol);
      const orderResult = await this.mexcService.createOrder({
        symbol: pattern.symbol,
        side: "BUY",
        type: "MARKET",
        quantity: quantity.toString(),
      });

      if (!orderResult.success) {
        throw new Error(`Order execution failed: ${orderResult.error}`);
      }

      const position = this.createPositionRecord(
        pattern,
        orderResult,
        quantity,
        Date.now() - startTime
      );
      this.activePositions.set(position.id, position);
      this.updateStatsAfterExecution();
      this.logSuccessfulTrade(position, context);
    } catch (error) {
      this.stats.failedTrades++;
      this.logger.error("Trade execution failed", { symbol: pattern.symbol }, error);
    }
  }

  private createPositionRecord(
    pattern: PatternMatch,
    orderResult: any,
    quantity: number,
    executionLatency: number
  ): ExecutionPosition {
    const position: ExecutionPosition = {
      id: `pos_${Date.now()}_${pattern.symbol}`,
      symbol: pattern.symbol,
      side: "BUY",
      quantity: quantity.toString(),
      entryPrice: orderResult.data.executedPrice || "0",
      currentPrice: orderResult.data.executedPrice || "0",
      unrealizedPnl: "0",
      unrealizedPnlPercentage: 0,
      status: "FILLED",
      entryTime: new Date().toISOString(),
      patternMatch: pattern,
      executionMetadata: {
        confidence: pattern.confidence,
        executionLatency,
        slippage: 0,
        orderType: "MARKET",
      },
    };

    // Set stop loss and take profit
    if (this.config.stopLossPercentage > 0) {
      position.stopLossPrice = this.calculateStopLossPrice(position);
    }
    if (this.config.takeProfitPercentage > 0) {
      position.takeProfitPrice = this.calculateTakeProfitPrice(position);
    }

    return validateExecutionPosition(position);
  }

  private async monitorActivePositions(): Promise<void> {
    if (this.activePositions.size === 0) return;

    const positions = Array.from(this.activePositions.values());
    const monitoringPromises = positions.map((position) => this.monitorSinglePosition(position));

    await Promise.allSettled(monitoringPromises);
  }

  private async monitorSinglePosition(position: ExecutionPosition): Promise<void> {
    await this.updatePositionPnL(position);
    await this.checkStopLossAndTakeProfit(position);
  }

  private async updatePositionPnL(position: ExecutionPosition): Promise<void> {
    try {
      const ticker = await this.mexcService.getSymbolTicker(position.symbol);
      if (!ticker.success || !ticker.data) return;

      const currentPrice = parseFloat(ticker.data.price);
      const entryPrice = parseFloat(position.entryPrice);
      const quantity = parseFloat(position.quantity);

      const priceDiff = currentPrice - entryPrice;
      const unrealizedPnl = priceDiff * quantity;
      const unrealizedPnlPercentage = (priceDiff / entryPrice) * 100;

      position.currentPrice = currentPrice.toString();
      position.unrealizedPnl = unrealizedPnl.toString();
      position.unrealizedPnlPercentage = unrealizedPnlPercentage;
    } catch (error) {
      this.logger.error("Failed to update PnL", { positionId: position.id }, error);
    }
  }

  private async checkStopLossAndTakeProfit(position: ExecutionPosition): Promise<void> {
    const currentPrice = parseFloat(position.currentPrice);

    // Check stop loss
    if (position.stopLossPrice && currentPrice <= parseFloat(position.stopLossPrice)) {
      await this.closePosition(position.id, "stop_loss");
      this.addAlert({
        type: "stop_loss_hit",
        severity: "warning",
        message: `Stop loss triggered: ${position.symbol}`,
        positionId: position.id,
        symbol: position.symbol,
        details: { stopLossPrice: position.stopLossPrice, currentPrice },
      });
      return;
    }

    // Check take profit
    if (position.takeProfitPrice && currentPrice >= parseFloat(position.takeProfitPrice)) {
      await this.closePosition(position.id, "take_profit");
      this.addAlert({
        type: "take_profit_hit",
        severity: "info",
        message: `Take profit triggered: ${position.symbol}`,
        positionId: position.id,
        symbol: position.symbol,
        details: { takeProfitPrice: position.takeProfitPrice, currentPrice },
      });
    }
  }

  private calculatePositionSize(_symbol: string): number {
    return this.config.positionSizeUSDT;
  }

  private calculateStopLossPrice(position: ExecutionPosition): string {
    const entryPrice = parseFloat(position.entryPrice);
    return (entryPrice * (1 - this.config.stopLossPercentage / 100)).toString();
  }

  private calculateTakeProfitPrice(position: ExecutionPosition): string {
    const entryPrice = parseFloat(position.entryPrice);
    return (entryPrice * (1 + this.config.takeProfitPercentage / 100)).toString();
  }

  private async executeCloseOrder(position: ExecutionPosition): Promise<TradeExecutionResult> {
    try {
      const orderResult = await this.mexcService.createOrder({
        symbol: position.symbol,
        side: "SELL",
        type: "MARKET",
        quantity: position.quantity,
      });

      return {
        success: orderResult.success,
        orderId: orderResult.data?.orderId,
        executedPrice: orderResult.data?.executedPrice,
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  private finalizePositionClose(position: ExecutionPosition, reason: string): void {
    position.status = "CLOSED";
    this.executionHistory.push(position);
    this.activePositions.delete(position.id);
    this.updateStatsAfterClose(position);

    this.addAlert({
      type: "position_closed",
      severity: "info",
      message: `Position closed: ${position.symbol} (${reason})`,
      positionId: position.id,
      symbol: position.symbol,
      details: { reason, pnl: position.unrealizedPnl },
    });
  }

  private handlePositionCloseError(
    position: ExecutionPosition,
    error: unknown,
    reason: string
  ): void {
    const safeError = toSafeError(error);
    this.logger.error(
      "Failed to close position",
      {
        positionId: position.id,
        symbol: position.symbol,
        reason,
      },
      error
    );

    this.addAlert({
      type: "execution_error",
      severity: "error",
      message: `Failed to close position: ${safeError.message}`,
      positionId: position.id,
      symbol: position.symbol,
      details: { error: safeError.message },
    });
  }

  private updateStatsAfterExecution(): void {
    this.stats.totalTrades++;
    this.stats.dailyTradeCount++;
    this.stats.activePositions = this.activePositions.size;
  }

  private updateStatsAfterClose(position: ExecutionPosition): void {
    const pnl = parseFloat(position.unrealizedPnl);

    if (pnl > 0) {
      this.stats.successfulTrades++;
    } else {
      this.stats.failedTrades++;
    }

    this.stats.successRate = (this.stats.successfulTrades / this.stats.totalTrades) * 100;
    this.stats.activePositions = this.activePositions.size;

    const currentPnl = parseFloat(this.stats.totalPnl || "0");
    this.stats.totalPnl = (currentPnl + pnl).toString();
  }

  private logSuccessfulTrade(position: ExecutionPosition, context: TradingContext): void {
    this.addAlert({
      type: "position_opened",
      severity: "info",
      message: `Position opened: ${position.symbol} at ${position.entryPrice}`,
      positionId: position.id,
      symbol: position.symbol,
      details: {
        patternType: position.patternMatch.patternType,
        confidence: position.patternMatch.confidence,
        quantity: position.quantity,
        executionLatency: position.executionMetadata.executionLatency,
      },
    });

    this.logger.trading("Trade executed successfully", {
      requestId: context.requestId,
      positionId: position.id,
      symbol: position.symbol,
      entryPrice: position.entryPrice,
      quantity: position.quantity,
    });
  }

  private addAlert(alertData: Omit<ExecutionAlert, "id" | "timestamp" | "acknowledged">): void {
    const alert: ExecutionAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      ...alertData,
    };

    this.alerts.push(alert);
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  private getDefaultConfig(): AutoSnipingConfig {
    const result = AutoSnipingConfigSchema.parse({
      enabled: true,
      maxPositions: parseInt(process.env.AUTO_SNIPING_MAX_POSITIONS || "5"),
      maxDailyTrades: parseInt(process.env.AUTO_SNIPING_MAX_DAILY_TRADES || "10"),
      positionSizeUSDT: parseFloat(process.env.AUTO_SNIPING_POSITION_SIZE_USDT || "10"),
      minConfidence: parseFloat(process.env.AUTO_SNIPING_MIN_CONFIDENCE || "80"),
      allowedPatternTypes: (process.env.AUTO_SNIPING_ALLOWED_PATTERNS?.split(
        ","
      ) as PatternType[]) || ["ready_state"],
      requireCalendarConfirmation: process.env.AUTO_SNIPING_REQUIRE_CALENDAR !== "false",
      stopLossPercentage: parseFloat(process.env.AUTO_SNIPING_STOP_LOSS_PERCENT || "5"),
      takeProfitPercentage: parseFloat(process.env.AUTO_SNIPING_TAKE_PROFIT_PERCENT || "10"),
      maxDrawdownPercentage: parseFloat(process.env.AUTO_SNIPING_MAX_DRAWDOWN_PERCENT || "20"),
      enableAdvanceDetection: process.env.AUTO_SNIPING_ENABLE_ADVANCE_DETECTION !== "false",
      advanceHoursThreshold: parseFloat(process.env.AUTO_SNIPING_ADVANCE_HOURS_THRESHOLD || "3.5"),
      enableMultiPhaseStrategy: process.env.AUTO_SNIPING_ENABLE_MULTI_PHASE === "true",
      slippageTolerancePercentage: parseFloat(process.env.AUTO_SNIPING_SLIPPAGE_TOLERANCE || "1"),
    });
    return result;
  }

  private getDefaultStats(): ExecutionStats {
    return ExecutionStatsSchema.parse({
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      successRate: 0,
      totalPnl: "0",
      totalPnlPercentage: 0,
      averageTradeReturn: 0,
      maxDrawdown: 0,
      currentDrawdown: 0,
      averageExecutionTime: 0,
      averageSlippage: 0,
      activePositions: 0,
      dailyTradeCount: 0,
      patternSuccessRates: {
        ready_state: 0,
        pre_ready: 0,
        launch_sequence: 0,
        risk_warning: 0,
      },
      averagePatternConfidence: 0,
      mostSuccessfulPattern: null,
    });
  }
}
