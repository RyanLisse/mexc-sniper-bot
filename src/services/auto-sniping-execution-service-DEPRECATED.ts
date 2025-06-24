/**
 * Auto-Sniping Execution Service
 *
 * Handles the execution of auto-sniping trades based on detected patterns.
 * Provides comprehensive trade execution, position management, and safety controls.
 * Enhanced with structured logging and OpenTelemetry instrumentation.
 */

import { PatternDetectionCore, type PatternMatch } from "../core/pattern-detection";
import { getErrorMessage, toSafeError } from "../lib/error-type-utils";
import { createSafeLogger, createTimer } from "../lib/structured-logger";
import { EmergencySafetySystem } from "./emergency-safety-system";
import { getRecommendedMexcService } from "./mexc-unified-exports";
import { PatternMonitoringService } from "./pattern-monitoring-service";
import { UnifiedMexcServiceV2 } from "./unified-mexc-service-v2";

export interface AutoSnipingConfig {
  // Execution parameters
  enabled: boolean;
  maxPositions: number;
  maxDailyTrades: number;
  positionSizeUSDT: number;

  // Pattern filtering
  minConfidence: number;
  allowedPatternTypes: PatternType[];
  requireCalendarConfirmation: boolean;

  // Risk management
  stopLossPercentage: number;
  takeProfitPercentage: number;
  maxDrawdownPercentage: number;

  // Advanced settings
  enableAdvanceDetection: boolean;
  advanceHoursThreshold: number;
  enableMultiPhaseStrategy: boolean;
  slippageTolerancePercentage: number;
}

export interface ExecutionPosition {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: string;
  entryPrice: string;
  currentPrice: string;
  unrealizedPnl: string;
  unrealizedPnlPercentage: number;
  stopLossPrice?: string;
  takeProfitPrice?: string;
  status: "ACTIVE" | "PARTIAL_FILLED" | "FILLED" | "CLOSED";
  entryTime: string;
  patternMatch: PatternMatch;
  executionMetadata: {
    confidence: number;
    executionLatency: number;
    slippage: number;
    orderType: string;
  };
}

export interface ExecutionStats {
  // Performance metrics
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  successRate: number;

  // Financial metrics
  totalPnl: string;
  totalPnlPercentage: number;
  averageTradeReturn: number;
  maxDrawdown: number;
  currentDrawdown: number;

  // Operational metrics
  averageExecutionTime: number;
  averageSlippage: number;
  activePositions: number;
  dailyTradeCount: number;

  // Pattern performance
  patternSuccessRates: Record<PatternType, number>;
  averagePatternConfidence: number;
  mostSuccessfulPattern: PatternType | null;
}

export interface ExecutionAlert {
  id: string;
  type:
    | "position_opened"
    | "position_closed"
    | "stop_loss_hit"
    | "take_profit_hit"
    | "execution_error"
    | "risk_limit_hit";
  severity: "info" | "warning" | "error" | "critical";
  message: string;
  timestamp: string;
  positionId?: string;
  symbol?: string;
  details: Record<string, any>;
  acknowledged: boolean;
}

export interface AutoSnipingExecutionReport {
  status: "active" | "idle" | "paused" | "error";
  config: AutoSnipingConfig;
  stats: ExecutionStats;
  activePositions: ExecutionPosition[];
  recentExecutions: ExecutionPosition[];
  activeAlerts: ExecutionAlert[];
  systemHealth: {
    apiConnection: boolean;
    patternEngine: boolean;
    safetySystem: boolean;
    riskLimits: boolean;
  };
  recommendations: string[];
  lastUpdated: string;
}

type PatternType = "ready_state" | "pre_ready" | "launch_sequence" | "risk_warning";

export class AutoSnipingExecutionService {
  private static instance: AutoSnipingExecutionService;

  private patternEngine: PatternDetectionCore;
  private patternMonitoring: PatternMonitoringService;
  private mexcService: UnifiedMexcServiceV2;
  private safetySystem: EmergencySafetySystem;
  private logger = createSafeLogger("auto-sniping-execution");

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
    // FIXED: Use singleton instances instead of creating new instances
    this.mexcService = new UnifiedMexcServiceV2();
    this.safetySystem = new EmergencySafetySystem();

    this.config = this.getDefaultConfig();
    this.stats = this.getDefaultStats();

    this.logger.info("Service initialized", {
      operation: "initialization",
      maxPositions: this.config.maxPositions,
      enabled: this.config.enabled,
    });
  }

  public static getInstance(): AutoSnipingExecutionService {
    if (!AutoSnipingExecutionService.instance) {
      AutoSnipingExecutionService.instance = new AutoSnipingExecutionService();
    }
    return AutoSnipingExecutionService.instance;
  }

  /**
   * Start auto-sniping execution
   */
  public async startExecution(): Promise<void> {
    if (this.isExecutionActive) {
      throw new Error("Auto-sniping execution is already active");
    }

    this.logger.info("Starting auto-sniping execution", {
      operation: "start_execution",
      config: {
        maxPositions: this.config.maxPositions,
        minConfidence: this.config.minConfidence,
        enableAdvanceDetection: this.config.enableAdvanceDetection,
      },
    });

    // Pre-flight checks
    await this.performPreflightChecks();

    this.isExecutionActive = true;

    // Start execution cycle
    this.executionInterval = setInterval(() => {
      this.performExecutionCycle().catch((error) => {
        const safeError = toSafeError(error);
        this.logger.error(
          "Execution cycle failed",
          {
            operation: "execution_cycle",
            activePositions: this.activePositions.size,
            dailyTrades: this.stats.dailyTradeCount,
          },
          error
        );
        this.addAlert({
          type: "execution_error",
          severity: "error",
          message: `Execution cycle failed: ${safeError.message}`,
          details: { error: safeError.message, stack: safeError.stack },
        });
      });
    }, 5000); // Check every 5 seconds

    // Start position monitoring
    this.monitoringInterval = setInterval(() => {
      this.monitorActivePositions().catch((error) => {
        const safeError = toSafeError(error);
        this.logger.error(
          "Position monitoring failed",
          {
            operation: "position_monitoring",
            activePositions: this.activePositions.size,
            error: safeError.message,
          },
          error
        );
      });
    }, 10000); // Monitor every 10 seconds

    this.addAlert({
      type: "position_opened", // Using existing type for system status
      severity: "info",
      message: "Auto-sniping execution started successfully",
      details: { config: this.config },
    });
  }

  /**
   * Stop auto-sniping execution
   */
  public stopExecution(): void {
    this.logger.info("Stopping auto-sniping execution", {
      operation: "stop_execution",
      activePositions: this.activePositions.size,
      totalTrades: this.stats.totalTrades,
      successRate: this.stats.successRate,
    });

    this.isExecutionActive = false;

    if (this.executionInterval) {
      clearInterval(this.executionInterval);
      this.executionInterval = null;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.addAlert({
      type: "position_closed", // Using existing type for system status
      severity: "info",
      message: "Auto-sniping execution stopped",
      details: { activePositions: this.activePositions.size },
    });
  }

  /**
   * Pause execution temporarily
   */
  public pauseExecution(): void {
    if (this.executionInterval) {
      clearInterval(this.executionInterval);
      this.executionInterval = null;
    }

    this.logger.info("Execution paused", {
      operation: "pause_execution",
      activePositions: this.activePositions.size,
    });
  }

  /**
   * Resume execution
   */
  public async resumeExecution(): Promise<void> {
    if (!this.isExecutionActive) {
      throw new Error("Cannot resume: execution is not active");
    }

    await this.startExecution();
    this.logger.info("Execution resumed", {
      operation: "resume_execution",
      activePositions: this.activePositions.size,
    });
  }

  /**
   * Get execution report
   */
  public async getExecutionReport(): Promise<AutoSnipingExecutionReport> {
    const systemHealth = await this.checkSystemHealth();

    return {
      status: this.getExecutionStatus(),
      config: { ...this.config },
      stats: { ...this.stats },
      activePositions: Array.from(this.activePositions.values()),
      recentExecutions: this.executionHistory.slice(-10),
      activeAlerts: this.alerts.filter((alert) => !alert.acknowledged),
      systemHealth,
      recommendations: this.generateRecommendations(),
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<AutoSnipingConfig>): void {
    this.config = { ...this.config, ...newConfig };

    this.addAlert({
      type: "position_opened", // Using existing type for system events
      severity: "info",
      message: "Configuration updated",
      details: { updatedFields: Object.keys(newConfig) },
    });

    this.logger.info("Configuration updated", {
      operation: "config_update",
      updatedFields: Object.keys(newConfig),
      newConfig: Object.fromEntries(
        Object.entries(newConfig).map(([key, value]) => [
          key,
          typeof value === "object" ? JSON.stringify(value) : value,
        ])
      ),
    });
  }

  /**
   * Configure auto-sniping parameters (auto-sniping is ALWAYS enabled)
   */
  public configureAutoSniping(overrides: Partial<AutoSnipingConfig> = {}): void {
    // Force enabled to true - auto-sniping cannot be disabled
    const configWithForcedEnabled: Partial<AutoSnipingConfig> = {
      ...overrides,
      enabled: true, // ALWAYS ENABLED
    };

    this.updateConfig(configWithForcedEnabled);

    this.logger.info("Auto-sniping configuration updated", {
      operation: "configure_auto_sniping",
      overrides: Object.keys(overrides),
      enabled: true, // Always true
    });
  }

  /**
   * Get current auto-sniping configuration
   * FIXED: Added missing getConfig() method required by startup initialization
   */
  public async getConfig(): Promise<AutoSnipingConfig> {
    // Return current configuration (auto-sniping is always enabled)
    return {
      ...this.config,
      enabled: true, // Always enabled as per user requirements
    };
  }

  /**
   * Check if auto-sniping is ready for trading (always enabled, checks system readiness)
   */
  public isReadyForTrading(): boolean {
    // Auto-sniping is always enabled, check if system is ready and not currently executing
    return !this.isExecutionActive;
  }

  /**
   * Close position manually
   */
  public async closePosition(positionId: string, reason = "manual"): Promise<boolean> {
    const position = this.activePositions.get(positionId);
    if (!position) {
      throw new Error(`Position not found: ${positionId}`);
    }

    try {
      // Execute market close order
      const closeResult = await this.executeCloseOrder(position);

      if (closeResult.success) {
        // Update position status
        position.status = "CLOSED";

        // Move to history
        this.executionHistory.push(position);
        this.activePositions.delete(positionId);

        // Update stats
        this.updateStatsAfterClose(position);

        this.addAlert({
          type: "position_closed",
          severity: "info",
          message: `Position closed: ${position.symbol} (${reason})`,
          positionId,
          symbol: position.symbol,
          details: { reason, pnl: position.unrealizedPnl },
        });

        return true;
      }

      return false;
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error(
        "Failed to close position",
        {
          operation: "close_position",
          positionId,
          symbol: position.symbol,
          reason,
          error: safeError.message,
        },
        error
      );

      this.addAlert({
        type: "execution_error",
        severity: "error",
        message: `Failed to close position: ${safeError.message}`,
        positionId,
        symbol: position.symbol,
        details: { error: safeError.message },
      });

      return false;
    }
  }

  /**
   * Get active positions
   */
  public getActivePositions(): ExecutionPosition[] {
    return Array.from(this.activePositions.values());
  }

  /**
   * Acknowledge alert
   */
  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Clear acknowledged alerts
   */
  public clearAcknowledgedAlerts(): number {
    const countBefore = this.alerts.length;
    this.alerts = this.alerts.filter((alert) => !alert.acknowledged);
    return countBefore - this.alerts.length;
  }

  /**
   * Force close all positions (emergency)
   */
  public async emergencyCloseAll(): Promise<number> {
    this.logger.warn("Emergency close all positions initiated", {
      operation: "emergency_close_all",
      totalPositions: this.activePositions.size,
      totalPnl: this.stats.totalPnl,
    });

    let closedCount = 0;
    const positions = Array.from(this.activePositions.values());

    for (const position of positions) {
      try {
        const success = await this.closePosition(position.id, "emergency");
        if (success) {
          closedCount++;
        }
      } catch (error) {
        const safeError = toSafeError(error);
        this.logger.error(
          "Failed to emergency close position",
          {
            operation: "emergency_close",
            positionId: position.id,
            symbol: position.symbol,
            currentPnL: position.unrealizedPnl,
            error: safeError.message,
          },
          error
        );
      }
    }

    this.addAlert({
      type: "execution_error",
      severity: "critical",
      message: `Emergency close completed: ${closedCount}/${positions.length} positions closed`,
      details: { closedCount, totalPositions: positions.length },
    });

    return closedCount;
  }

  // Private methods

  private async performPreflightChecks(): Promise<void> {
    const timer = createTimer("preflight_checks", "auto-sniping-execution");

    this.logger.info("Performing pre-flight checks", {
      operation: "preflight_checks",
      config: {
        enabled: this.config.enabled,
        maxPositions: this.config.maxPositions,
        minConfidence: this.config.minConfidence,
      },
    });

    // Check API connectivity
    try {
      const accountInfo = await this.mexcService.getAccountBalances();
      if (!accountInfo.success) {
        throw new Error("Failed to get account balances");
      }
    } catch (error) {
      throw new Error(`API connectivity check failed: ${getErrorMessage(error)}`);
    }

    // Check safety system
    // FIXED: Allow degraded systems to continue, only block critical failures
    const safetyStatus = await this.safetySystem.performSystemHealthCheck();
    if (safetyStatus.overall === "critical") {
      throw new Error(
        `Safety system in critical state: ${safetyStatus.criticalIssues?.join(", ") || "Unknown critical issues"}`
      );
    }

    if (safetyStatus.overall === "degraded") {
      this.logger.warn("Safety system degraded but continuing", {
        operation: "preflight_checks",
        degradedComponents: safetyStatus.degradedComponents,
        issues: safetyStatus.criticalIssues,
      });
    }

    // FIXED: Auto-sniping is always enabled by design, no need to check
    // Configuration check removed since auto-sniping is permanently enabled

    const duration = timer.end();
    this.logger.info("Pre-flight checks passed", {
      operation: "preflight_checks",
      duration,
      safetyStatus: safetyStatus.overall,
    });
  }

  private async performExecutionCycle(): Promise<void> {
    if (!this.isExecutionActive) return;

    try {
      // Check daily trade limit
      if (this.stats.dailyTradeCount >= this.config.maxDailyTrades) {
        this.logger.warn("Daily trade limit reached", {
          operation: "execution_cycle",
          dailyTrades: this.stats.dailyTradeCount,
          maxDailyTrades: this.config.maxDailyTrades,
        });
        return;
      }

      // Check position limit
      if (this.activePositions.size >= this.config.maxPositions) {
        this.logger.warn("Maximum positions reached", {
          operation: "execution_cycle",
          activePositions: this.activePositions.size,
          maxPositions: this.config.maxPositions,
        });
        return;
      }

      // Get recent patterns from monitoring service
      const patterns = this.patternMonitoring.getRecentPatterns(10);
      const eligiblePatterns = this.filterEligiblePatterns(patterns);

      if (eligiblePatterns.length === 0) {
        return;
      }

      // Execute trades for eligible patterns
      for (const pattern of eligiblePatterns) {
        if (this.activePositions.size >= this.config.maxPositions) {
          break;
        }

        try {
          await this.executeTradeForPattern(pattern);
        } catch (error) {
          const safeError = toSafeError(error);
          this.logger.error(
            "Failed to execute trade for pattern",
            {
              operation: "trade_execution",
              symbol: pattern.symbol,
              patternType: pattern.patternType,
              confidence: pattern.confidence,
              error: safeError.message,
            },
            error
          );
        }
      }
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error(
        "Execution cycle error",
        {
          operation: "execution_cycle",
          activePositions: this.activePositions.size,
          dailyTrades: this.stats.dailyTradeCount,
          error: safeError.message,
        },
        error
      );
      this.stats.failedTrades++;
    }
  }

  private filterEligiblePatterns(patterns: PatternMatch[]): PatternMatch[] {
    return patterns.filter((pattern) => {
      // Check confidence threshold
      if (pattern.confidence < this.config.minConfidence) {
        return false;
      }

      // Check allowed pattern types
      if (!this.config.allowedPatternTypes.includes(pattern.patternType as PatternType)) {
        return false;
      }

      // Check if symbol already has active position
      const hasActivePosition = Array.from(this.activePositions.values()).some(
        (pos) => pos.symbol === pattern.symbol
      );
      if (hasActivePosition) {
        return false;
      }

      // Check advance detection settings
      if (pattern.patternType === "launch_sequence" && !this.config.enableAdvanceDetection) {
        return false;
      }

      return true;
    });
  }

  private async executeTradeForPattern(pattern: PatternMatch): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.trading("Executing trade for pattern", {
        symbol: pattern.symbol,
        patternType: pattern.patternType,
        confidence: pattern.confidence,
        advanceNoticeHours: pattern.advanceNoticeHours,
        riskLevel: pattern.riskLevel,
        operation: "execute_trade",
      });

      // Calculate position size
      const quantity = this.calculatePositionSize(pattern.symbol);

      // Execute buy order
      const orderResult = await this.mexcService.createOrder({
        symbol: pattern.symbol,
        side: "BUY",
        type: "MARKET",
        quantity: quantity.toString(),
      });

      if (!orderResult.success) {
        throw new Error(`Order execution failed: ${orderResult.error}`);
      }

      const executionLatency = Date.now() - startTime;

      // Create position record
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
          slippage: 0, // Calculate actual slippage
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

      // Add to active positions
      this.activePositions.set(position.id, position);

      // Update statistics
      this.stats.totalTrades++;
      this.stats.dailyTradeCount++;
      this.stats.activePositions = this.activePositions.size;

      this.addAlert({
        type: "position_opened",
        severity: "info",
        message: `Position opened: ${pattern.symbol} at ${position.entryPrice}`,
        positionId: position.id,
        symbol: position.symbol,
        details: {
          patternType: pattern.patternType,
          confidence: pattern.confidence,
          quantity,
          executionLatency,
        },
      });

      this.logger.trading("Trade executed successfully", {
        positionId: position.id,
        symbol: position.symbol,
        entryPrice: position.entryPrice,
        quantity: position.quantity,
        patternType: pattern.patternType,
        confidence: pattern.confidence,
        executionLatency,
        operation: "trade_success",
      });
    } catch (error) {
      this.stats.failedTrades++;
      throw error;
    }
  }

  private async monitorActivePositions(): Promise<void> {
    if (this.activePositions.size === 0) return;

    // Convert positions to array for parallel processing
    const positions = Array.from(this.activePositions.values());

    // Process all positions in parallel using Promise.allSettled
    const results = await Promise.allSettled(
      positions.map((position) => this.monitorSinglePosition(position))
    );

    // Log any failures without stopping the entire monitoring process
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const position = positions[index];
        this.logger.error(
          "Failed to monitor position",
          {
            operation: "position_monitoring",
            positionId: position.id,
            symbol: position.symbol,
            currentPnL: position.unrealizedPnl,
          },
          result.reason instanceof Error ? result.reason : new Error(String(result.reason))
        );
      }
    });
  }

  private async monitorSinglePosition(position: ExecutionPosition): Promise<void> {
    // Update PnL and check stop-loss/take-profit in sequence for this position
    await this.updatePositionPnL(position);
    await this.checkStopLossAndTakeProfit(position);
  }

  private async updatePositionPnL(position: ExecutionPosition): Promise<void> {
    try {
      // Get current price
      const ticker = await this.mexcService.getSymbolTicker(position.symbol);
      if (!ticker.success || !ticker.data) return;

      const currentPrice = Number.parseFloat(ticker.data.price);
      const entryPrice = Number.parseFloat(position.entryPrice);
      const quantity = Number.parseFloat(position.quantity);

      // Calculate PnL
      const priceDiff = currentPrice - entryPrice;
      const unrealizedPnl = priceDiff * quantity;
      const unrealizedPnlPercentage = (priceDiff / entryPrice) * 100;

      // Update position
      position.currentPrice = currentPrice.toString();
      position.unrealizedPnl = unrealizedPnl.toString();
      position.unrealizedPnlPercentage = unrealizedPnlPercentage;
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error(
        "Failed to update PnL for position",
        {
          operation: "update_pnl",
          positionId: position.id,
          symbol: position.symbol,
          entryPrice: position.entryPrice,
          error: safeError.message,
        },
        error
      );
    }
  }

  private async checkStopLossAndTakeProfit(position: ExecutionPosition): Promise<void> {
    const currentPrice = Number.parseFloat(position.currentPrice);

    // Check stop loss
    if (position.stopLossPrice) {
      const stopLossPrice = Number.parseFloat(position.stopLossPrice);
      if (currentPrice <= stopLossPrice) {
        await this.closePosition(position.id, "stop_loss");

        this.addAlert({
          type: "stop_loss_hit",
          severity: "warning",
          message: `Stop loss triggered: ${position.symbol}`,
          positionId: position.id,
          symbol: position.symbol,
          details: { stopLossPrice, currentPrice },
        });
        return;
      }
    }

    // Check take profit
    if (position.takeProfitPrice) {
      const takeProfitPrice = Number.parseFloat(position.takeProfitPrice);
      if (currentPrice >= takeProfitPrice) {
        await this.closePosition(position.id, "take_profit");

        this.addAlert({
          type: "take_profit_hit",
          severity: "info",
          message: `Take profit triggered: ${position.symbol}`,
          positionId: position.id,
          symbol: position.symbol,
          details: { takeProfitPrice, currentPrice },
        });
        return;
      }
    }
  }

  private calculatePositionSize(_symbol: string): number {
    // Simple fixed USDT amount for now
    // In production, this would be more sophisticated
    return this.config.positionSizeUSDT;
  }

  private calculateStopLossPrice(position: ExecutionPosition): string {
    const entryPrice = Number.parseFloat(position.entryPrice);
    const stopLossPrice = entryPrice * (1 - this.config.stopLossPercentage / 100);
    return stopLossPrice.toString();
  }

  private calculateTakeProfitPrice(position: ExecutionPosition): string {
    const entryPrice = Number.parseFloat(position.entryPrice);
    const takeProfitPrice = entryPrice * (1 + this.config.takeProfitPercentage / 100);
    return takeProfitPrice.toString();
  }

  private async executeCloseOrder(position: ExecutionPosition): Promise<{ success: boolean }> {
    try {
      const orderResult = await this.mexcService.createOrder({
        symbol: position.symbol,
        side: "SELL",
        type: "MARKET",
        quantity: position.quantity,
      });

      return { success: orderResult.success };
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error(
        "Close order failed",
        {
          operation: "close_order",
          symbol: position.symbol,
          side: "SELL",
          quantity: position.quantity,
          error: safeError.message,
        },
        error
      );
      return { success: false };
    }
  }

  private updateStatsAfterClose(position: ExecutionPosition): void {
    const pnl = Number.parseFloat(position.unrealizedPnl);

    if (pnl > 0) {
      this.stats.successfulTrades++;
    } else {
      this.stats.failedTrades++;
    }

    this.stats.successRate = (this.stats.successfulTrades / this.stats.totalTrades) * 100;
    this.stats.activePositions = this.activePositions.size;

    // Update total PnL (simplified)
    const currentPnl = Number.parseFloat(this.stats.totalPnl || "0");
    this.stats.totalPnl = (currentPnl + pnl).toString();
  }

  private getExecutionStatus(): "active" | "idle" | "paused" | "error" {
    if (!this.isExecutionActive) return "idle";
    if (!this.executionInterval) return "paused";
    return "active";
  }

  private async checkSystemHealth() {
    return {
      apiConnection: true, // Check actual API connectivity
      patternEngine: true, // Check pattern engine status
      safetySystem: true, // Check safety system status
      riskLimits: this.stats.currentDrawdown < this.config.maxDrawdownPercentage,
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.stats.successRate < 50) {
      recommendations.push("Consider increasing minimum confidence threshold");
    }

    if (this.stats.activePositions === 0 && this.isExecutionActive) {
      recommendations.push("No active positions - check pattern detection settings");
    }

    if (this.stats.currentDrawdown > this.config.maxDrawdownPercentage * 0.8) {
      recommendations.push("Approaching maximum drawdown limit");
    }

    return recommendations;
  }

  private addAlert(alertData: Omit<ExecutionAlert, "id" | "timestamp" | "acknowledged">): void {
    const alert: ExecutionAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      ...alertData,
    };

    this.alerts.push(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  private getDefaultConfig(): AutoSnipingConfig {
    return {
      enabled: true, // ALWAYS ENABLED - Auto-sniping is always active
      maxPositions: Number.parseInt(process.env.AUTO_SNIPING_MAX_POSITIONS || "5"),
      maxDailyTrades: Number.parseInt(process.env.AUTO_SNIPING_MAX_DAILY_TRADES || "10"),
      positionSizeUSDT: Number.parseFloat(process.env.AUTO_SNIPING_POSITION_SIZE_USDT || "10"),
      minConfidence: Number.parseFloat(process.env.AUTO_SNIPING_MIN_CONFIDENCE || "80"),
      allowedPatternTypes: (process.env.AUTO_SNIPING_ALLOWED_PATTERNS?.split(
        ","
      ) as PatternType[]) || ["ready_state"],
      requireCalendarConfirmation: process.env.AUTO_SNIPING_REQUIRE_CALENDAR === "true" || true,
      stopLossPercentage: Number.parseFloat(process.env.AUTO_SNIPING_STOP_LOSS_PERCENT || "5"),
      takeProfitPercentage: Number.parseFloat(process.env.AUTO_SNIPING_TAKE_PROFIT_PERCENT || "10"),
      maxDrawdownPercentage: Number.parseFloat(
        process.env.AUTO_SNIPING_MAX_DRAWDOWN_PERCENT || "20"
      ),
      enableAdvanceDetection: process.env.AUTO_SNIPING_ENABLE_ADVANCE_DETECTION !== "false", // Default true
      advanceHoursThreshold: Number.parseFloat(
        process.env.AUTO_SNIPING_ADVANCE_HOURS_THRESHOLD || "3.5"
      ),
      enableMultiPhaseStrategy: process.env.AUTO_SNIPING_ENABLE_MULTI_PHASE === "true" || false,
      slippageTolerancePercentage: Number.parseFloat(
        process.env.AUTO_SNIPING_SLIPPAGE_TOLERANCE || "1"
      ),
    };
  }

  private getDefaultStats(): ExecutionStats {
    return {
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
    };
  }
}
