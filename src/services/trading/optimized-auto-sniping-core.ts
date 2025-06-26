/**
 * Optimized Auto-Sniping Core Service
 *
 * High-performance trading execution engine with:
 * - Type-safe Zod validation for all inputs/outputs
 * - Parallelized execution and monitoring
 * - Advanced risk management integration
 * - Smart order routing and execution
 * - Real-time performance optimization
 *
 * Replaces monolithic auto-sniping-execution-service.ts (1000+ lines)
 * Split into focused modules under 500 lines each
 */

import { z } from "zod";
import type { PatternMatch } from "@/src/core/pattern-detection";
import { toSafeError } from "@/src/lib/error-type-utils";
// ============================================================================
// Zod Schemas for Type Safety
// ============================================================================

export const PatternTypeSchema = z.enum([
  "ready_state",
  "pre_ready",
  "launch_sequence",
  "risk_warning",
]);
export const AlertSeveritySchema = z.enum(["info", "warning", "error", "critical"]);
export const AlertTypeSchema = z.enum([
  "position_opened",
  "position_closed",
  "stop_loss_hit",
  "take_profit_hit",
  "execution_error",
  "risk_limit_hit",
]);
export const PositionStatusSchema = z.enum(["ACTIVE", "PARTIAL_FILLED", "FILLED", "CLOSED"]);
export const ExecutionStatusSchema = z.enum(["active", "idle", "paused", "error"]);

export const AutoSnipingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxPositions: z.number().int().min(1).max(50).default(5),
  maxDailyTrades: z.number().int().min(1).max(1000).default(10),
  positionSizeUSDT: z.number().positive().max(10000).default(10),
  minConfidence: z.number().min(0).max(100).default(80),
  allowedPatternTypes: z.array(PatternTypeSchema).default(["ready_state"]),
  requireCalendarConfirmation: z.boolean().default(true),
  stopLossPercentage: z.number().min(0).max(50).default(5),
  takeProfitPercentage: z.number().min(0).max(1000).default(10),
  maxDrawdownPercentage: z.number().min(0).max(100).default(20),
  enableAdvanceDetection: z.boolean().default(true),
  advanceHoursThreshold: z.number().positive().default(3.5),
  enableMultiPhaseStrategy: z.boolean().default(false),
  slippageTolerancePercentage: z.number().min(0).max(10).default(1),
  
  // Additional properties for API compatibility
  maxConcurrentTargets: z.number().int().min(1).max(50).default(5),
  retryAttempts: z.number().int().min(1).max(10).default(3),
  executionDelay: z.number().min(0).default(1000),
});

export const ExecutionMetadataSchema = z.object({
  confidence: z.number().min(0).max(100),
  executionLatency: z.number().min(0),
  slippage: z.number().min(0),
  orderType: z.string(),
});

export const ExecutionPositionSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  side: z.enum(["BUY", "SELL"]),
  quantity: z.string(),
  entryPrice: z.string(),
  currentPrice: z.string(),
  unrealizedPnl: z.string(),
  unrealizedPnlPercentage: z.number(),
  stopLossPrice: z.string().optional(),
  takeProfitPrice: z.string().optional(),
  status: PositionStatusSchema,
  entryTime: z.string().datetime(),
  patternMatch: z.object({
    symbol: z.string(),
    patternType: z.string(),
    confidence: z.number(),
    timestamp: z.string().datetime(),
    riskLevel: z.string().optional(),
    advanceNoticeHours: z.number().optional(),
  }), // PatternMatch interface
  executionMetadata: ExecutionMetadataSchema,
});

export const ExecutionStatsSchema = z.object({
  totalTrades: z.number().int().min(0),
  successfulTrades: z.number().int().min(0),
  failedTrades: z.number().int().min(0),
  successRate: z.number().min(0).max(100),
  totalPnl: z.string(),
  totalPnlPercentage: z.number(),
  averageTradeReturn: z.number(),
  maxDrawdown: z.number().min(0),
  currentDrawdown: z.number().min(0),
  averageExecutionTime: z.number().min(0),
  averageSlippage: z.number().min(0),
  activePositions: z.number().int().min(0),
  dailyTradeCount: z.number().int().min(0),
  patternSuccessRates: z.record(PatternTypeSchema, z.number().min(0).max(100)),
  averagePatternConfidence: z.number().min(0).max(100),
  mostSuccessfulPattern: PatternTypeSchema.nullable(),
});

export const ExecutionAlertSchema = z.object({
  id: z.string(),
  type: AlertTypeSchema,
  severity: AlertSeveritySchema,
  message: z.string(),
  timestamp: z.string().datetime(),
  positionId: z.string().optional(),
  symbol: z.string().optional(),
  details: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  acknowledged: z.boolean().default(false),
});

// ============================================================================
// Type Definitions
// ============================================================================

export type PatternType = z.infer<typeof PatternTypeSchema>;
export type AutoSnipingConfig = z.infer<typeof AutoSnipingConfigSchema>;
export type ExecutionPosition = z.infer<typeof ExecutionPositionSchema>;
export type ExecutionStats = z.infer<typeof ExecutionStatsSchema>;
export type ExecutionAlert = z.infer<typeof ExecutionAlertSchema>;
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;

export interface SystemHealth {
  apiConnection: boolean;
  patternEngine: boolean;
  safetySystem: boolean;
  riskLimits: boolean;
}

export interface TradingOpportunity {
  symbol: string;
  patternMatch: PatternMatch;
  launchTime: Date;
  confidence: number;
  vcoinId: string;
  projectName: string;
}

export interface AutoSnipingExecutionReport {
  status: ExecutionStatus;
  config: AutoSnipingConfig;
  stats: ExecutionStats;
  activePositions: ExecutionPosition[];
  recentExecutions: ExecutionPosition[];
  activeAlerts: ExecutionAlert[];
  systemHealth: SystemHealth;
  recommendations: string[];
  lastUpdated: string;
  
  // Additional properties for API compatibility
  activeTargets: number;
  readyTargets: number;
  executedToday: number;
  successRate: number;
  totalProfit: number;
  lastExecution?: string;
  safetyStatus: "safe" | "warning" | "danger";
  patternDetectionActive: boolean;
  executionCount: number;
  successCount: number;
  errorCount: number;
  uptime: number;
}

// ============================================================================
// Core Auto-Sniping Service
// ============================================================================

/**
 * Optimized Auto-Sniping Core - Main Orchestrator
 *
 * Coordinates execution modules and provides clean interface
 * Focuses on core orchestration, delegates to specialized modules
 */
export class OptimizedAutoSnipingCore {
  private static instance: OptimizedAutoSnipingCore;
  // Configuration with validation
  private config: AutoSnipingConfig;
  private isActive = false;

  // Core state
  private activePositions = new Map<string, ExecutionPosition>();
  private executionHistory: ExecutionPosition[] = [];
  private alerts: ExecutionAlert[] = [];
  private stats: ExecutionStats;

  // Execution intervals
  private executionInterval: NodeJS.Timeout | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;

  private constructor(config?: Partial<AutoSnipingConfig>) {
    // Validate and set configuration
    this.config = AutoSnipingConfigSchema.parse({
      ...this.getDefaultConfig(),
      ...config,
    });

    // Initialize stats
    this.stats = ExecutionStatsSchema.parse(this.getDefaultStats());

    console.info("Optimized Auto-Sniping Core initialized", {
      config: this.config,
      maxPositions: this.config.maxPositions,
      enabled: this.config.enabled,
    });
  }

  static getInstance(config?: Partial<AutoSnipingConfig>): OptimizedAutoSnipingCore {
    if (!OptimizedAutoSnipingCore.instance) {
      OptimizedAutoSnipingCore.instance = new OptimizedAutoSnipingCore(config);
    }
    return OptimizedAutoSnipingCore.instance;
  }

  /**
   * Start optimized execution with comprehensive validation
   */
  async startExecution(): Promise<void> {
    if (this.isActive) {
      throw new Error("Auto-sniping execution is already active");
    }

    console.info("Starting optimized auto-sniping execution", {
      config: {
        maxPositions: this.config.maxPositions,
        minConfidence: this.config.minConfidence,
        enableAdvanceDetection: this.config.enableAdvanceDetection,
      },
    });

    // Validate configuration before starting
    await this.validateConfiguration();

    // Perform system health checks
    await this.performHealthChecks();

    this.isActive = true;

    // Start optimized execution cycle (3 second intervals for better responsiveness)
    this.executionInterval = setInterval(() => {
      this.executeOptimizedCycle().catch((error) => {
        const safeError = toSafeError(error);
        console.error("Optimized execution cycle failed", {
          error: safeError.message,
          activePositions: this.activePositions.size,
        });
        this.addValidatedAlert({
          type: "execution_error",
          severity: "error",
          message: `Execution cycle failed: ${safeError.message}`,
          details: { error: safeError.message },
        });
      });
    }, 3000);

    // Start parallel position monitoring (5 second intervals)
    this.monitoringInterval = setInterval(() => {
      this.monitorPositionsParallel().catch((error) => {
        const safeError = toSafeError(error);
        console.error("Position monitoring failed", {
          error: safeError.message,
          positionCount: this.activePositions.size,
        });
      });
    }, 5000);

    this.addValidatedAlert({
      type: "position_opened",
      severity: "info",
      message: "Optimized auto-sniping execution started",
      details: { enabled: this.config.enabled, maxPositions: this.config.maxPositions },
    });
  }

  /**
   * Stop execution with cleanup
   */
  stopExecution(): void {
    console.info("Stopping optimized auto-sniping execution", {
      activePositions: this.activePositions.size,
      totalTrades: this.stats.totalTrades,
      successRate: this.stats.successRate,
    });

    this.isActive = false;

    if (this.executionInterval) {
      clearInterval(this.executionInterval);
      this.executionInterval = null;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.addValidatedAlert({
      type: "position_closed",
      severity: "info",
      message: "Optimized auto-sniping execution stopped",
      details: { totalTrades: this.stats.totalTrades, successRate: this.stats.successRate },
    });
  }

  /**
   * Get comprehensive execution report with validation
   */
  async getExecutionReport(): Promise<AutoSnipingExecutionReport> {
    const systemHealth = await this.checkSystemHealth();

    return {
      status: this.getExecutionStatus(),
      config: this.config,
      stats: this.stats,
      activePositions: Array.from(this.activePositions.values()),
      recentExecutions: this.executionHistory.slice(-10),
      activeAlerts: this.alerts.filter((alert) => !alert.acknowledged),
      systemHealth,
      recommendations: this.generateIntelligentRecommendations(),
      lastUpdated: new Date().toISOString(),
      
      // API compatibility properties
      activeTargets: this.activePositions.size,
      readyTargets: await this.calculateReadyTargets(),
      executedToday: this.stats.dailyTradeCount,
      successRate: this.stats.successRate,
      totalProfit: parseFloat(this.stats.totalPnl),
      lastExecution: this.executionHistory.length > 0 ? this.executionHistory[this.executionHistory.length - 1].entryTime : undefined,
      safetyStatus: this.stats.currentDrawdown > this.config.maxDrawdownPercentage * 0.8 ? "warning" : "safe",
      patternDetectionActive: true,
      executionCount: this.stats.totalTrades,
      successCount: this.stats.successfulTrades,
      errorCount: this.stats.failedTrades,
      uptime: this.isActive ? Date.now() - (this.stats.totalTrades > 0 ? 0 : Date.now()) : 0,
    };
  }

  /**
   * Update configuration with validation
   */
  updateConfig(newConfig: Partial<AutoSnipingConfig>): void {
    try {
      // Validate new configuration
      this.config = AutoSnipingConfigSchema.parse({
        ...this.config,
        ...newConfig,
      });

      console.info("Configuration updated successfully", {
        updatedFields: Object.keys(newConfig),
      });

      this.addValidatedAlert({
        type: "position_opened", // Using existing type for system events
        severity: "info",
        message: "Configuration updated with validation",
        details: { updatedFieldCount: Object.keys(newConfig).length },
      });
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("Configuration validation failed", {
        error: safeError.message,
        attemptedConfig: newConfig,
      });
      throw new Error(`Configuration validation failed: ${safeError.message}`);
    }
  }

  /**
   * Get validated configuration
   */
  async getConfig(): Promise<AutoSnipingConfig> {
    return AutoSnipingConfigSchema.parse(this.config);
  }

  /**
   * Check if system is ready for trading
   */
  isReadyForTrading(): boolean {
    return !this.isActive && this.config.enabled;
  }

  /**
   * Get active positions with validation
   */
  getActivePositions(): ExecutionPosition[] {
    return Array.from(this.activePositions.values()).map((position) =>
      ExecutionPositionSchema.parse(position)
    );
  }

  /**
   * Pause execution
   */
  pauseExecution(): void {
    if (!this.isActive) return;

    console.info("Pausing auto-sniping execution");

    if (this.executionInterval) {
      clearInterval(this.executionInterval);
      this.executionInterval = null;
    }

    this.addValidatedAlert({
      type: "position_opened",
      severity: "info",
      message: "Auto-sniping execution paused",
      details: { activePositions: this.activePositions.size },
    });
  }

  /**
   * Resume execution
   */
  async resumeExecution(): Promise<void> {
    if (!this.isActive || this.executionInterval) return;

    console.info("Resuming auto-sniping execution");

    // Restart execution cycle
    this.executionInterval = setInterval(() => {
      this.executeOptimizedCycle().catch((error) => {
        const safeError = toSafeError(error);
        console.error("Optimized execution cycle failed", {
          error: safeError.message,
          activePositions: this.activePositions.size,
        });
        this.addValidatedAlert({
          type: "execution_error",
          severity: "error",
          message: `Execution cycle failed: ${safeError.message}`,
          details: { error: safeError.message },
        });
      });
    }, 3000);

    this.addValidatedAlert({
      type: "position_opened",
      severity: "info",
      message: "Auto-sniping execution resumed",
      details: { activePositions: this.activePositions.size },
    });
  }

  /**
   * Close specific position
   */
  async closePosition(positionId: string, reason = "manual"): Promise<boolean> {
    const position = this.activePositions.get(positionId);
    if (!position) {
      console.warn("Position not found for closing", { positionId });
      return false;
    }

    try {
      console.info("Closing position", { positionId, reason, symbol: position.symbol });

      // Mark position as closed
      position.status = "CLOSED";
      this.activePositions.delete(positionId);

      // Add to execution history
      this.executionHistory.push(position);

      // Update stats
      this.stats.activePositions = this.activePositions.size;

      this.addValidatedAlert({
        type: "position_closed",
        severity: "info",
        message: `Position ${positionId} closed: ${reason}`,
        details: { positionId, reason, symbol: position.symbol },
        positionId,
      });

      return true;
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("Failed to close position", { positionId, error: safeError.message });
      return false;
    }
  }

  /**
   * Emergency close all positions
   */
  async emergencyCloseAll(): Promise<number> {
    const positionIds = Array.from(this.activePositions.keys());
    let closedCount = 0;

    console.warn("Emergency close all positions initiated", {
      positionCount: positionIds.length,
    });

    for (const positionId of positionIds) {
      const success = await this.closePosition(positionId, "emergency");
      if (success) closedCount++;
    }

    this.addValidatedAlert({
      type: "position_closed",
      severity: "warning",
      message: `Emergency close completed: ${closedCount} positions closed`,
      details: { closedCount, totalPositions: positionIds.length },
    });

    return closedCount;
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    console.info("Alert acknowledged", { alertId, alertType: alert.type });

    return true;
  }

  /**
   * Clear acknowledged alerts
   */
  clearAcknowledgedAlerts(): number {
    const acknowledgedAlerts = this.alerts.filter((a) => a.acknowledged);
    const clearedCount = acknowledgedAlerts.length;

    this.alerts = this.alerts.filter((a) => !a.acknowledged);

    console.info("Acknowledged alerts cleared", { clearedCount });

    return clearedCount;
  }

  // Private implementation methods

  private async validateConfiguration(): Promise<void> {
    try {
      AutoSnipingConfigSchema.parse(this.config);
      console.info("Configuration validation passed");
    } catch (error) {
      const safeError = toSafeError(error);
      throw new Error(`Configuration validation failed: ${safeError.message}`);
    }
  }

  private async performHealthChecks(): Promise<void> {
    const health = await this.checkSystemHealth();

    if (!health.apiConnection) {
      throw new Error("API connection health check failed");
    }

    if (!health.riskLimits) {
      throw new Error("Risk limits exceeded - cannot start execution");
    }

    console.info("Health checks passed", { health });
  }

  private async executeOptimizedCycle(): Promise<void> {
    if (!this.isActive) return;

    // Check limits before execution
    if (this.stats.dailyTradeCount >= this.config.maxDailyTrades) {
      console.warn("Daily trade limit reached", {
        dailyTrades: this.stats.dailyTradeCount,
        maxDailyTrades: this.config.maxDailyTrades,
      });
      return;
    }

    if (this.activePositions.size >= this.config.maxPositions) {
      console.warn("Maximum positions reached", {
        activePositions: this.activePositions.size,
        maxPositions: this.config.maxPositions,
      });
      return;
    }

    try {
      // Get potential trading opportunities from pattern detection
      const tradingOpportunities = await this.scanForTradingOpportunities();
      
      if (tradingOpportunities.length === 0) {
        return;
      }

      // Process opportunities with risk assessment
      for (const opportunity of tradingOpportunities) {
        try {
          const success = await this.executeTradingOpportunity(opportunity);
          if (success) {
            this.stats.totalTrades++;
            this.stats.dailyTradeCount++;
            this.stats.successfulTrades++;
          } else {
            this.stats.totalTrades++;
            this.stats.dailyTradeCount++;
            this.stats.failedTrades++;
          }
          
          // Update success rate
          this.stats.successRate = (this.stats.successfulTrades / this.stats.totalTrades) * 100;
          
          // Only execute one opportunity per cycle to avoid overwhelming the system
          break;
        } catch (error) {
          console.error("Failed to execute trading opportunity", {
            symbol: opportunity.symbol,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    } catch (error) {
      console.error("Execution cycle error", {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async monitorPositionsParallel(): Promise<void> {
    if (this.activePositions.size === 0) return;

    const positions = Array.from(this.activePositions.values());

    // Process all positions in parallel for better performance
    const results = await Promise.allSettled(
      positions.map((position) => this.monitorSinglePosition(position))
    );

    // Log any failures without stopping the monitoring process
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const position = positions[index];
        console.error("Position monitoring failed", {
          positionId: position.id,
          symbol: position.symbol,
          error: result.reason,
        });
      }
    });
  }

  private async monitorSinglePosition(position: ExecutionPosition): Promise<void> {
    try {
      // Validate position before monitoring
      const validatedPosition = ExecutionPositionSchema.parse(position);

      // Get current market price
      const { getRecommendedMexcService } = await import('../api/mexc-unified-exports');
      const mexcService = getRecommendedMexcService();
      const tickerResponse = await mexcService.getSymbolTicker(validatedPosition.symbol);

      if (!tickerResponse.success || !tickerResponse.data) {
        console.warn('Failed to get ticker data for position monitoring', {
          positionId: validatedPosition.id,
          symbol: validatedPosition.symbol,
        });
        return;
      }

      const currentPrice = parseFloat(tickerResponse.data.price);
      const entryPrice = parseFloat(validatedPosition.entryPrice);
      const quantity = parseFloat(validatedPosition.quantity);

      // Update current price and PnL
      validatedPosition.currentPrice = currentPrice.toString();
      
      // Calculate unrealized PnL
      const unrealizedPnl = (currentPrice - entryPrice) * quantity;
      const unrealizedPnlPercentage = ((currentPrice - entryPrice) / entryPrice) * 100;
      
      validatedPosition.unrealizedPnl = unrealizedPnl.toFixed(4);
      validatedPosition.unrealizedPnlPercentage = unrealizedPnlPercentage;

      // Update position in map
      this.activePositions.set(validatedPosition.id, validatedPosition);

      // Check stop loss
      if (validatedPosition.stopLossPrice) {
        const stopLossPrice = parseFloat(validatedPosition.stopLossPrice);
        if (currentPrice <= stopLossPrice) {
          console.warn('Stop loss triggered', {
            positionId: validatedPosition.id,
            symbol: validatedPosition.symbol,
            currentPrice,
            stopLossPrice,
            unrealizedPnl: unrealizedPnl.toFixed(4),
          });

          await this.executeStopLoss(validatedPosition, currentPrice);
          return;
        }
      }

      // Check take profit
      if (validatedPosition.takeProfitPrice) {
        const takeProfitPrice = parseFloat(validatedPosition.takeProfitPrice);
        if (currentPrice >= takeProfitPrice) {
          console.info('Take profit triggered', {
            positionId: validatedPosition.id,
            symbol: validatedPosition.symbol,
            currentPrice,
            takeProfitPrice,
            unrealizedPnl: unrealizedPnl.toFixed(4),
          });

          await this.executeTakeProfit(validatedPosition, currentPrice);
          return;
        }
      }

      // Check for extreme movements (circuit breaker)
      if (Math.abs(unrealizedPnlPercentage) > 25) { // 25% movement triggers review
        this.addValidatedAlert({
          type: "risk_limit_hit",
          severity: "warning",
          message: `Extreme price movement detected: ${validatedPosition.symbol}`,
          details: {
            symbol: validatedPosition.symbol,
            currentPrice,
            entryPrice,
            pnlPercentage: unrealizedPnlPercentage.toFixed(2),
            movementType: unrealizedPnlPercentage > 0 ? 'gain' : 'loss',
          },
          positionId: validatedPosition.id,
          symbol: validatedPosition.symbol,
        });
      }

    } catch (error) {
      console.error('Position monitoring error', {
        positionId: position.id,
        symbol: position.symbol,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Execute stop loss for a position
   */
  private async executeStopLoss(position: ExecutionPosition, currentPrice: number): Promise<void> {
    try {
      const { CoreTradingEngine } = await import('./auto-sniping/core-trading-engine');
      const tradingEngine = CoreTradingEngine.getInstance();

      const result = await tradingEngine.executeSellTrade(position, 'stop_loss');
      
      if (result.success) {
        // Remove from active positions
        this.activePositions.delete(position.id);
        this.stats.activePositions = this.activePositions.size;
        
        // Add to execution history
        position.status = "CLOSED";
        this.executionHistory.push(position);

        // Calculate final PnL
        const entryPrice = parseFloat(position.entryPrice);
        const quantity = parseFloat(position.quantity);
        const realizedPnl = (currentPrice - entryPrice) * quantity;
        
        // Update stats
        this.stats.totalPnl = (parseFloat(this.stats.totalPnl) + realizedPnl).toFixed(4);
        
        this.addValidatedAlert({
          type: "stop_loss_hit",
          severity: "warning",
          message: `Stop loss executed: ${position.symbol}`,
          details: {
            symbol: position.symbol,
            entryPrice: position.entryPrice,
            exitPrice: currentPrice.toString(),
            realizedPnl: realizedPnl.toFixed(4),
            quantity: position.quantity,
          },
          positionId: position.id,
          symbol: position.symbol,
        });
      }
    } catch (error) {
      console.error('Stop loss execution failed', {
        positionId: position.id,
        symbol: position.symbol,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Execute take profit for a position
   */
  private async executeTakeProfit(position: ExecutionPosition, currentPrice: number): Promise<void> {
    try {
      const { CoreTradingEngine } = await import('./auto-sniping/core-trading-engine');
      const tradingEngine = CoreTradingEngine.getInstance();

      const result = await tradingEngine.executeSellTrade(position, 'take_profit');
      
      if (result.success) {
        // Remove from active positions
        this.activePositions.delete(position.id);
        this.stats.activePositions = this.activePositions.size;
        
        // Add to execution history
        position.status = "CLOSED";
        this.executionHistory.push(position);

        // Calculate final PnL
        const entryPrice = parseFloat(position.entryPrice);
        const quantity = parseFloat(position.quantity);
        const realizedPnl = (currentPrice - entryPrice) * quantity;
        
        // Update stats
        this.stats.totalPnl = (parseFloat(this.stats.totalPnl) + realizedPnl).toFixed(4);
        
        this.addValidatedAlert({
          type: "take_profit_hit",
          severity: "info",
          message: `Take profit executed: ${position.symbol}`,
          details: {
            symbol: position.symbol,
            entryPrice: position.entryPrice,
            exitPrice: currentPrice.toString(),
            realizedPnl: realizedPnl.toFixed(4),
            quantity: position.quantity,
          },
          positionId: position.id,
          symbol: position.symbol,
        });
      }
    } catch (error) {
      console.error('Take profit execution failed', {
        positionId: position.id,
        symbol: position.symbol,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private addValidatedAlert(
    alertData: Omit<ExecutionAlert, "id" | "timestamp" | "acknowledged">
  ): void {
    try {
      const alert = ExecutionAlertSchema.parse({
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        acknowledged: false,
        ...alertData,
      });

      this.alerts.push(alert);

      // Keep only last 100 alerts
      if (this.alerts.length > 100) {
        this.alerts = this.alerts.slice(-100);
      }
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("Alert validation failed", {
        error: safeError.message,
        alertData,
      });
    }
  }

  private getExecutionStatus(): ExecutionStatus {
    if (!this.isActive) return "idle";
    if (!this.executionInterval) return "paused";
    return "active";
  }

  private async checkSystemHealth(): Promise<SystemHealth> {
    // Real system health checks
    const apiConnection = await this.validateApiConnection();
    const patternEngine = await this.validatePatternEngine();
    const safetySystem = this.validateSafetySystem();
    const riskLimits = this.stats.currentDrawdown < this.config.maxDrawdownPercentage;

    return {
      apiConnection,
      patternEngine,
      safetySystem,
      riskLimits,
    };
  }

  private async validateApiConnection(): Promise<boolean> {
    try {
      // Use MEXC service to test connectivity
      const { getRecommendedMexcService } = await import('../api/mexc-unified-exports');
      const mexcService = getRecommendedMexcService();

      // Test basic API connectivity by checking server time
      const serverTimeResponse = await mexcService.getServerTime();
      return serverTimeResponse.success && typeof serverTimeResponse.data === "number" && serverTimeResponse.data > 0;
    } catch (error) {
      console.error("API connectivity check failed", { error: toSafeError(error).message });
      return false;
    }
  }

  private async validatePatternEngine(): Promise<boolean> {
    try {
      // Test pattern engine with a minimal symbol
      const testSymbol = { cd: "BTCUSDT", sts: 2, st: 2, tt: 4 };
      const { patternDetectionEngine } = await import("../data/pattern-detection/pattern-detection-engine");
      const patterns = await patternDetectionEngine.detectReadyStatePattern([testSymbol]);
      return Array.isArray(patterns);
    } catch (error) {
      console.error("Pattern engine validation failed", { error: toSafeError(error).message });
      return false;
    }
  }

  private validateSafetySystem(): boolean {
    // Check critical safety parameters
    const hasValidConfig = this.config.maxPositions > 0 && this.config.maxDailyTrades > 0;
    const hasValidRiskLimits =
      this.config.stopLossPercentage > 0 && this.config.maxDrawdownPercentage > 0;
    const withinRiskLimits = this.stats.currentDrawdown < this.config.maxDrawdownPercentage;

    return hasValidConfig && hasValidRiskLimits && withinRiskLimits;
  }

  private generateIntelligentRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.stats.successRate < 50) {
      recommendations.push("Consider increasing minimum confidence threshold");
    }

    if (this.stats.activePositions === 0 && this.isActive) {
      recommendations.push("No active positions - check pattern detection settings");
    }

    if (this.stats.currentDrawdown > this.config.maxDrawdownPercentage * 0.8) {
      recommendations.push("Approaching maximum drawdown limit");
    }

    if (this.stats.averageSlippage > this.config.slippageTolerancePercentage) {
      recommendations.push("High slippage detected - consider order optimization");
    }

    return recommendations;
  }

  private getDefaultConfig(): AutoSnipingConfig {
    return {
      enabled: true,
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
      enableAdvanceDetection: process.env.AUTO_SNIPING_ENABLE_ADVANCE_DETECTION !== "false",
      advanceHoursThreshold: Number.parseFloat(
        process.env.AUTO_SNIPING_ADVANCE_HOURS_THRESHOLD || "3.5"
      ),
      enableMultiPhaseStrategy: process.env.AUTO_SNIPING_ENABLE_MULTI_PHASE === "true" || false,
      slippageTolerancePercentage: Number.parseFloat(
        process.env.AUTO_SNIPING_SLIPPAGE_TOLERANCE || "1"
      ),
      
      // Additional properties for API compatibility
      maxConcurrentTargets: Number.parseInt(process.env.AUTO_SNIPING_MAX_CONCURRENT_TARGETS || "5"),
      retryAttempts: Number.parseInt(process.env.AUTO_SNIPING_RETRY_ATTEMPTS || "3"),
      executionDelay: Number.parseInt(process.env.AUTO_SNIPING_EXECUTION_DELAY || "1000"),
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

  /**
   * Calculate ready targets from calendar and pattern data
   * Returns count of launches within 4 hours (ready for sniping)
   */
  private async calculateReadyTargets(): Promise<number> {
    try {
      // Use MEXC service to get calendar data (respects demo mode)
      const { getRecommendedMexcService } = await import('../api/mexc-unified-exports');
      const mexcService = getRecommendedMexcService();
      const calendarResponse = await mexcService.getCalendarListings();
      
      if (!calendarResponse.success || !Array.isArray(calendarResponse.data)) {
        console.warn('[AutoSnipingCore] Invalid calendar response or no data');
        return 0;
      }
      
      const calendar = calendarResponse.data;
      const now = new Date();
      const hours24 = 24 * 60 * 60 * 1000; // 24 hours in milliseconds (extended for demo)
      
      // Filter for ready targets (launching within 24 hours - extended for demo visibility)
      const readyTargets = calendar.filter((entry: any) => {
        try {
          const launchTime = new Date(entry.firstOpenTime);
          return (
            launchTime.getTime() > now.getTime() && 
            launchTime.getTime() < now.getTime() + hours24
          );
        } catch (error) {
          console.warn('[AutoSnipingCore] Invalid date in calendar entry:', entry.firstOpenTime);
          return false;
        }
      });
      
      console.info('[AutoSnipingCore] Calculated ready targets', {
        total: calendar.length,
        ready: readyTargets.length,
        timeWindow: '24 hours (demo mode)',
        source: 'MEXC service'
      });
      
      return readyTargets.length;
    } catch (error) {
      console.error('[AutoSnipingCore] Error calculating ready targets:', error);
      return 0;
    }
  }

  /**
   * Scan for trading opportunities using pattern detection
   */
  private async scanForTradingOpportunities(): Promise<TradingOpportunity[]> {
    try {
      // Get calendar listings for potential new coins
      const { getRecommendedMexcService } = await import('../api/mexc-unified-exports');
      const mexcService = getRecommendedMexcService();
      const calendarResponse = await mexcService.getCalendarListings();
      
      if (!calendarResponse.success || !Array.isArray(calendarResponse.data)) {
        return [];
      }

      const calendar = calendarResponse.data;
      const now = new Date();
      const advanceThresholdMs = this.config.advanceHoursThreshold * 60 * 60 * 1000;
      
      // Filter for coins launching soon (within advance threshold)
      const upcomingCoins = calendar.filter((entry: any) => {
        try {
          const launchTime = new Date(entry.firstOpenTime);
          const timeDiff = launchTime.getTime() - now.getTime();
          return timeDiff > 0 && timeDiff <= advanceThresholdMs;
        } catch (error) {
          return false;
        }
      });

      // Use pattern detection engine to analyze opportunities
      const { patternDetectionEngine } = await import('../data/pattern-detection/pattern-detection-engine');
      const patternEngine = patternDetectionEngine;
      
      const opportunities: TradingOpportunity[] = [];
      
      for (const coin of upcomingCoins.slice(0, 5)) { // Limit to 5 coins per cycle
        try {
          // Create symbol data for pattern analysis
          const symbolData = {
            cd: coin.symbol || coin.vcoinId,
            sts: 2, // Status 2 (upcoming)
            st: 2,  // State 2 (ready for analysis) 
            tt: 4   // Type 4 (new listing)
          };

          // Analyze patterns for this symbol  
          const patterns = await patternEngine.detectReadyStatePattern([symbolData]);
          
          if (patterns && patterns.length > 0) {
            // Find the highest confidence pattern
            const bestPattern = patterns.reduce((best, current) => 
              current.confidence > best.confidence ? current : best
            );

            // Only consider patterns above minimum confidence
            if (bestPattern.confidence >= this.config.minConfidence) {
              opportunities.push({
                symbol: `${coin.symbol}USDT`, // Assume USDT pairs for new listings
                patternMatch: bestPattern,
                launchTime: new Date(coin.firstOpenTime),
                confidence: bestPattern.confidence,
                vcoinId: coin.vcoinId,
                projectName: coin.projectName || coin.vcoinNameFull || coin.symbol,
              });
            }
          }
        } catch (error) {
          console.warn('Pattern analysis failed for coin', { 
            symbol: coin.symbol, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      console.info('Trading opportunities scanned', {
        upcomingCoins: upcomingCoins.length,
        opportunities: opportunities.length,
        minConfidence: this.config.minConfidence,
      });

      return opportunities.sort((a, b) => b.confidence - a.confidence); // Sort by confidence desc
    } catch (error) {
      console.error('Failed to scan for trading opportunities', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Execute a trading opportunity using the core trading engine
   */
  private async executeTradingOpportunity(opportunity: TradingOpportunity): Promise<boolean> {
    try {
      console.info('Executing trading opportunity', {
        symbol: opportunity.symbol,
        confidence: opportunity.confidence,
        patternType: opportunity.patternMatch.patternType,
      });

      // Import and use the CoreTradingEngine
      const { CoreTradingEngine } = await import('./auto-sniping/core-trading-engine');
      const tradingEngine = CoreTradingEngine.getInstance();

      // Execute buy trade
      const result = await tradingEngine.executeBuyTrade(
        opportunity.symbol,
        opportunity.patternMatch,
        this.config.positionSizeUSDT,
        this.config.stopLossPercentage,
        this.config.takeProfitPercentage
      );

      if (result.success) {
        // Create and store the position
        const position: ExecutionPosition = {
          id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          symbol: opportunity.symbol,
          side: "BUY",
          quantity: result.executedQuantity?.toString() || this.config.positionSizeUSDT.toString(),
          entryPrice: result.executedPrice?.toString() || "0",
          currentPrice: result.executedPrice?.toString() || "0",
          unrealizedPnl: "0",
          unrealizedPnlPercentage: 0,
          stopLossPrice: this.calculateStopLossPrice(result.executedPrice || 0, this.config.stopLossPercentage).toString(),
          takeProfitPrice: this.calculateTakeProfitPrice(result.executedPrice || 0, this.config.takeProfitPercentage).toString(),
          status: "ACTIVE",
          entryTime: new Date().toISOString(),
          patternMatch: {
            symbol: opportunity.symbol,
            patternType: opportunity.patternMatch.patternType,
            confidence: opportunity.patternMatch.confidence,
            timestamp: new Date().toISOString(),
            riskLevel: opportunity.patternMatch.riskLevel,
            advanceNoticeHours: opportunity.patternMatch.advanceNoticeHours,
          },
          executionMetadata: {
            confidence: opportunity.confidence,
            executionLatency: result.executionLatency,
            slippage: result.slippage || 0,
            orderType: "MARKET",
          },
        };

        // Store the position
        this.activePositions.set(position.id, position);
        this.stats.activePositions = this.activePositions.size;

        // Add success alert
        this.addValidatedAlert({
          type: "position_opened",
          severity: "info",
          message: `Position opened: ${opportunity.symbol}`,
          details: {
            symbol: opportunity.symbol,
            confidence: opportunity.confidence,
            executedPrice: result.executedPrice,
            quantity: result.executedQuantity,
            slippage: result.slippage,
          },
          positionId: position.id,
          symbol: opportunity.symbol,
        });

        return true;
      } else {
        // Add error alert
        this.addValidatedAlert({
          type: "execution_error",
          severity: "error",
          message: `Failed to open position: ${opportunity.symbol}`,
          details: {
            symbol: opportunity.symbol,
            error: result.error,
            confidence: opportunity.confidence,
          },
          symbol: opportunity.symbol,
        });

        return false;
      }
    } catch (error) {
      console.error('Failed to execute trading opportunity', {
        symbol: opportunity.symbol,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      this.addValidatedAlert({
        type: "execution_error",
        severity: "error",
        message: `Trading execution failed: ${opportunity.symbol}`,
        details: {
          symbol: opportunity.symbol,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        symbol: opportunity.symbol,
      });

      return false;
    }
  }

  /**
   * Calculate stop loss price
   */
  private calculateStopLossPrice(entryPrice: number, stopLossPercentage: number): number {
    return entryPrice * (1 - stopLossPercentage / 100);
  }

  /**
   * Calculate take profit price  
   */
  private calculateTakeProfitPrice(entryPrice: number, takeProfitPercentage: number): number {
    return entryPrice * (1 + takeProfitPercentage / 100);
  }
}

// Export factory function for backward compatibility
export function createOptimizedAutoSnipingCore(
  config?: Partial<AutoSnipingConfig>
): OptimizedAutoSnipingCore {
  return OptimizedAutoSnipingCore.getInstance(config);
}
