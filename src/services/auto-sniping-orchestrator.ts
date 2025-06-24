/**
 * Auto-Sniping Orchestrator - Central Control System
 *
 * Integrates all auto-sniping components for coordinated trading operations.
 * This service fulfills the requirements from Vertical Slice 5 in the integration testing mission.
 */

import { and, eq, lt } from "drizzle-orm";
import { EventEmitter } from "events";
import { PatternDetectionCore } from "../core/pattern-detection";
import { db } from "../db";
import { snipeTargets } from "../db/schemas/trading";
import { createSafeLogger } from "../lib/structured-logger";
import { ComprehensiveSafetyCoordinator } from "./comprehensive-safety-coordinator";
import { MexcConfigValidator } from "./mexc-config-validator";
import { MexcTradingService, type TradeExecutionResult } from "./mexc-trading-service";
import { MultiPhaseTradingService } from "./multi-phase-trading-service";
import { TRADING_STRATEGIES } from "./trading-strategy-manager";
import { UnifiedMexcServiceV2 } from "./unified-mexc-service-v2";

export interface AutoSnipingConfig {
  enabled: boolean;
  maxConcurrentPositions: number;
  patternDetectionInterval: number; // milliseconds
  safetyCheckInterval: number; // milliseconds
  confidenceThreshold: number; // 0-100
  maxPositionSize: number; // percentage of portfolio
  stopLossPercentage: number; // percentage
  strategy: "conservative" | "balanced" | "aggressive";
  paperTradingMode: boolean;
}

export interface AutoSnipingStatus {
  active: boolean;
  safeToOperate: boolean;
  currentPositions: number;
  totalPositions: number;
  profitLoss: {
    realized: number;
    unrealized: number;
    total: number;
    percentage: number;
  };
  systemHealth: {
    patternDetection: "operational" | "degraded" | "offline";
    tradingBot: "operational" | "degraded" | "offline";
    safetyCoordinator: "operational" | "degraded" | "offline";
    mexcConnection: "connected" | "disconnected" | "error";
  };
  lastOperation: {
    timestamp: string;
    action: string;
    symbol?: string;
    result: "success" | "failed" | "partial";
  } | null;
  runningTime: number; // milliseconds since start
  detectedOpportunities: number;
  executedTrades: number;
  avgConfidenceScore: number;
}

export interface AutoSnipingMetrics {
  session: {
    startTime: string;
    uptime: number;
    totalOpportunities: number;
    successfulTrades: number;
    failedTrades: number;
    successRate: number;
  };
  performance: {
    avgResponseTime: number;
    avgConfidence: number;
    profitability: number;
    maxDrawdown: number;
    sharpeRatio: number;
  };
  safety: {
    safetyViolations: number;
    emergencyStops: number;
    lastSafetyCheck: string;
    riskScore: number;
  };
}

/**
 * Auto-Sniping Orchestrator
 *
 * Central coordinator that manages the entire auto-sniping operation by integrating:
 * - Pattern Detection Engine for opportunity identification
 * - Multi-Phase Trading Bot for order execution
 * - Comprehensive Safety Coordinator for risk management
 * - MEXC API Service for market data and trading
 * - Configuration validation and health monitoring
 */
export class AutoSnipingOrchestrator extends EventEmitter {
  private logger = createSafeLogger("auto-sniping-orchestrator");

  private static instance: AutoSnipingOrchestrator;

  // Core services
  private patternEngine: PatternDetectionCore;
  private tradingBot: MultiPhaseTradingService | null = null;
  private safetyCoordinator: ComprehensiveSafetyCoordinator;
  private mexcService: UnifiedMexcServiceV2;
  private mexcTradingService: MexcTradingService;
  private configValidator: MexcConfigValidator;

  // State management
  private isActive = false;
  private config: AutoSnipingConfig;
  private status: AutoSnipingStatus;
  private metrics: AutoSnipingMetrics;
  private startTime = 0;

  // Monitoring intervals
  private patternDetectionTimer?: NodeJS.Timeout;
  private safetyCheckTimer?: NodeJS.Timeout;
  private statusUpdateTimer?: NodeJS.Timeout;

  // Position tracking
  private activePositions: Map<string, any> = new Map();
  private positionHistory: any[] = [];

  constructor(config?: Partial<AutoSnipingConfig>) {
    super();

    // Initialize default configuration
    this.config = {
      enabled: false,
      maxConcurrentPositions: 3,
      patternDetectionInterval: 30000, // 30 seconds
      safetyCheckInterval: 60000, // 1 minute
      confidenceThreshold: 75,
      maxPositionSize: 0.1, // 10% of portfolio
      stopLossPercentage: 0.15, // 15% stop loss
      strategy: "conservative",
      paperTradingMode: true,
      ...config,
    };

    // Initialize core services
    this.patternEngine = PatternDetectionCore.getInstance();
    this.safetyCoordinator = new ComprehensiveSafetyCoordinator();
    this.mexcService = new UnifiedMexcServiceV2();
    this.mexcTradingService = new MexcTradingService();
    this.configValidator = MexcConfigValidator.getInstance();

    // Initialize state
    this.status = this.initializeStatus();
    this.metrics = this.initializeMetrics();

    this.logger.info("[AutoSnipingOrchestrator] Initialized with configuration:", this.config);
  }

  public static getInstance(config?: Partial<AutoSnipingConfig>): AutoSnipingOrchestrator {
    if (!AutoSnipingOrchestrator.instance) {
      AutoSnipingOrchestrator.instance = new AutoSnipingOrchestrator(config);
    }
    return AutoSnipingOrchestrator.instance;
  }

  /**
   * Start auto-sniping operations
   */
  async startAutoSniping(): Promise<{
    success: boolean;
    message: string;
    status?: AutoSnipingStatus;
  }> {
    if (this.isActive) {
      return {
        success: false,
        message: "Auto-sniping is already active",
        status: this.status,
      };
    }

    this.logger.info("[AutoSnipingOrchestrator] Starting auto-sniping operations...");

    try {
      // Step 1: Validate system readiness
      const readinessReport = await this.configValidator.generateSystemReadinessReport();
      if (readinessReport.overallStatus !== "ready") {
        return {
          success: false,
          message: `System not ready: ${readinessReport.recommendations.join(", ")}`,
        };
      }

      // Step 2: Start safety coordinator
      await this.safetyCoordinator.start();

      // Step 3: Initialize trading bot with strategy
      const strategy = TRADING_STRATEGIES[this.config.strategy];
      this.tradingBot = new MultiPhaseTradingService(strategy, 0, 0); // Will be set when position is created

      // Step 4: Start monitoring intervals
      this.startMonitoringTimers();

      // Step 5: Update state
      this.isActive = true;
      this.startTime = Date.now();
      this.status.active = true;
      this.status.safeToOperate = true;
      this.updateSystemHealth();

      // Step 6: Emit startup event
      this.emit("auto_sniping_started", {
        timestamp: new Date().toISOString(),
        config: this.config,
        status: this.status,
      });

      this.logger.info("[AutoSnipingOrchestrator] Auto-sniping started successfully");

      return {
        success: true,
        message: "Auto-sniping started successfully",
        status: this.status,
      };
    } catch (error) {
      this.logger.error("[AutoSnipingOrchestrator] Failed to start auto-sniping:", error);

      // Cleanup on failure
      await this.cleanup();

      return {
        success: false,
        message: `Failed to start auto-sniping: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Stop auto-sniping operations
   */
  async stopAutoSniping(): Promise<{
    success: boolean;
    message: string;
    finalStatus?: AutoSnipingStatus;
  }> {
    if (!this.isActive) {
      return {
        success: false,
        message: "Auto-sniping is not active",
      };
    }

    this.logger.info("[AutoSnipingOrchestrator] Stopping auto-sniping operations...");

    try {
      // Stop monitoring timers
      this.clearMonitoringTimers();

      // Close any open positions (if not paper trading)
      if (!this.config.paperTradingMode && this.activePositions.size > 0) {
        await this.closeAllPositions("Auto-sniping stopped");
      }

      // Stop safety coordinator
      await this.safetyCoordinator.stop();

      // Update state
      this.isActive = false;
      this.status.active = false;
      this.updateRunningTime();

      // Emit stop event
      this.emit("auto_sniping_stopped", {
        timestamp: new Date().toISOString(),
        finalStatus: this.status,
        metrics: this.metrics,
      });

      this.logger.info("[AutoSnipingOrchestrator] Auto-sniping stopped successfully");

      return {
        success: true,
        message: "Auto-sniping stopped successfully",
        finalStatus: this.status,
      };
    } catch (error) {
      this.logger.error("[AutoSnipingOrchestrator] Error stopping auto-sniping:", error);

      return {
        success: false,
        message: `Error stopping auto-sniping: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Get current auto-sniping status
   */
  getStatus(): AutoSnipingStatus {
    if (this.isActive) {
      this.updateRunningTime();
      this.updateSystemHealth();
    }
    return { ...this.status };
  }

  /**
   * Get detailed metrics
   */
  getMetrics(): AutoSnipingMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  async updateConfiguration(
    newConfig: Partial<AutoSnipingConfig>
  ): Promise<{ success: boolean; message: string }> {
    try {
      const updatedConfig = { ...this.config, ...newConfig };
      if (updatedConfig.maxPositionSize <= 0 || updatedConfig.maxPositionSize > 1) {
        return { success: false, message: "Max position size must be between 0 and 1" };
      }
      if (updatedConfig.confidenceThreshold < 0 || updatedConfig.confidenceThreshold > 100) {
        return { success: false, message: "Confidence threshold must be between 0 and 100" };
      }
      this.config = updatedConfig;
      if (this.isActive) {
        this.clearMonitoringTimers();
        this.startMonitoringTimers();
      }
      this.logger.info("[AutoSnipingOrchestrator] Configuration updated:", newConfig);
      return { success: true, message: "Configuration updated successfully" };
    } catch (error) {
      return {
        success: false,
        message: `Failed to update configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  // Private helper methods

  private initializeStatus(): AutoSnipingStatus {
    return {
      active: false,
      safeToOperate: false,
      currentPositions: 0,
      totalPositions: 0,
      profitLoss: { realized: 0, unrealized: 0, total: 0, percentage: 0 },
      systemHealth: {
        patternDetection: "offline",
        tradingBot: "offline",
        safetyCoordinator: "offline",
        mexcConnection: "disconnected",
      },
      lastOperation: null,
      runningTime: 0,
      detectedOpportunities: 0,
      executedTrades: 0,
      avgConfidenceScore: 0,
    };
  }

  private initializeMetrics(): AutoSnipingMetrics {
    return {
      session: {
        startTime: new Date().toISOString(),
        uptime: 0,
        totalOpportunities: 0,
        successfulTrades: 0,
        failedTrades: 0,
        successRate: 0,
      },
      performance: {
        avgResponseTime: 0,
        avgConfidence: 0,
        profitability: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
      },
      safety: {
        safetyViolations: 0,
        emergencyStops: 0,
        lastSafetyCheck: new Date().toISOString(),
        riskScore: 0,
      },
    };
  }

  private startMonitoringTimers(): void {
    // Pattern detection monitoring
    this.patternDetectionTimer = setInterval(
      () => this.performPatternDetection(),
      this.config.patternDetectionInterval
    );

    // Safety checks
    this.safetyCheckTimer = setInterval(
      () => this.performSafetyCheck(),
      this.config.safetyCheckInterval
    );

    // Status updates
    this.statusUpdateTimer = setInterval(
      () => this.updateStatus(),
      30000 // Update every 30 seconds
    );
  }

  private clearMonitoringTimers(): void {
    if (this.patternDetectionTimer) {
      clearInterval(this.patternDetectionTimer);
    }
    if (this.safetyCheckTimer) {
      clearInterval(this.safetyCheckTimer);
    }
    if (this.statusUpdateTimer) {
      clearInterval(this.statusUpdateTimer);
    }
  }

  private async performPatternDetection(): Promise<void> {
    try {
      this.logger.info("[AutoSnipingOrchestrator] Checking database for ready snipe targets...");

      // Get ready snipe targets from database instead of running pattern detection
      const readyTargets = await this.getReadySnipeTargets();

      if (readyTargets.length === 0) {
        this.logger.info("[AutoSnipingOrchestrator] No ready snipe targets found in database");
        return;
      }

      this.logger.info(
        `[AutoSnipingOrchestrator] Found ${readyTargets.length} ready snipe targets`
      );
      this.status.detectedOpportunities += readyTargets.length;

      // Process each ready target
      for (const target of readyTargets) {
        if (target.confidenceScore >= this.config.confidenceThreshold) {
          await this.processSnipeTarget(target);
        }
      }

      // Update average confidence based on targets
      this.status.avgConfidenceScore =
        readyTargets.length > 0
          ? readyTargets.reduce((sum, t) => sum + t.confidenceScore, 0) / readyTargets.length
          : 0;
    } catch (error) {
      this.logger.error("[AutoSnipingOrchestrator] Database target check failed:", error);
      this.status.systemHealth.patternDetection = "degraded";
    }
  }

  private async getReadySnipeTargets() {
    try {
      const now = new Date();
      const targets = await db
        .select()
        .from(snipeTargets)
        .where(
          and(
            eq(snipeTargets.status, "ready"),
            snipeTargets.targetExecutionTime.isNull().or(lt(snipeTargets.targetExecutionTime, now))
          )
        )
        .orderBy(snipeTargets.priority, snipeTargets.createdAt)
        .limit(10);
      return targets;
    } catch (error) {
      this.logger.error("[AutoSnipingOrchestrator] Failed to fetch ready targets:", error);
      return [];
    }
  }

  private async processSnipeTarget(target: any): Promise<void> {
    try {
      this.logger.info(`[AutoSnipingOrchestrator] Processing target: ${target.symbolName}`);
      if (this.activePositions.size >= this.config.maxConcurrentPositions) {
        this.logger.info("[AutoSnipingOrchestrator] Max positions reached, skipping");
        return;
      }
      await this.updateTargetStatus(target.id, "executing");
      if (this.config.paperTradingMode) {
        await this.simulateTradeFromTarget(target);
      } else {
        await this.executeTradeFromTarget(target);
      }
      this.status.lastOperation = {
        timestamp: new Date().toISOString(),
        action: "execute_snipe_target",
        symbol: target.symbolName,
        result: "success",
      };
    } catch (error) {
      this.logger.error("[AutoSnipingOrchestrator] Failed to process target:", error);
      await this.updateTargetStatus(
        target.id,
        "failed",
        error instanceof Error ? error.message : "Unknown error"
      );
      this.status.lastOperation = {
        timestamp: new Date().toISOString(),
        action: "execute_snipe_target",
        symbol: target.symbolName,
        result: "failed",
      };
    }
  }

  private async performSafetyCheck(): Promise<void> {
    try {
      const safetyStatus = this.safetyCoordinator.getCurrentStatus();
      this.status.safeToOperate = safetyStatus.overall.safetyLevel === "safe";
      this.metrics.safety.lastSafetyCheck = new Date().toISOString();
      this.metrics.safety.riskScore = safetyStatus.risk.overallRiskScore;
      if (safetyStatus.overall.safetyLevel === "emergency") {
        this.logger.warn("[AutoSnipingOrchestrator] Emergency condition, stopping");
        await this.stopAutoSniping();
        this.metrics.safety.emergencyStops++;
      }
    } catch (error) {
      this.logger.error("[AutoSnipingOrchestrator] Safety check failed:", error);
      this.status.systemHealth.safetyCoordinator = "degraded";
    }
  }

  private async updateTargetStatus(
    targetId: number,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateData: any = { status, updatedAt: new Date() };
      if (status === "executing") updateData.actualExecutionTime = new Date();
      if (errorMessage) updateData.errorMessage = errorMessage;
      await db.update(snipeTargets).set(updateData).where(eq(snipeTargets.id, targetId));
    } catch (error) {
      this.logger.error("[AutoSnipingOrchestrator] Failed to update target status:", error);
    }
  }

  /**
   * Simulate trade from snipe target (paper trading)
   */
  private async simulateTradeFromTarget(target: any): Promise<void> {
    this.logger.info(`[AutoSnipingOrchestrator] Simulating trade for target ${target.symbolName}`);

    // Create simulated position
    const position = {
      id: `target-${target.id}-${Date.now()}`,
      targetId: target.id,
      symbol: target.symbolName,
      vcoinId: target.vcoinId,
      entryPrice: 100, // Simulated price
      amount: target.positionSizeUsdt / 100, // Convert USDT to quantity
      strategy: this.config.strategy,
      timestamp: new Date().toISOString(),
      confidence: target.confidenceScore,
      stopLoss: target.stopLossPercent,
      takeProfit: target.takeProfitCustom || 15,
    };

    this.activePositions.set(position.id, position);
    this.status.currentPositions = this.activePositions.size;
    this.status.executedTrades++;
    this.metrics.session.successfulTrades++;

    // Update target status to completed
    await this.updateTargetStatus(target.id, "completed");

    // Simulate position closure after a delay
    setTimeout(() => {
      this.closeSimulatedPosition(position.id);
    }, 60000); // Close after 1 minute for simulation
  }

  /**
   * Execute real trade from snipe target
   */
  private async executeTradeFromTarget(target: any): Promise<void> {
    this.logger.info(
      `[AutoSnipingOrchestrator] Executing real trade for target ${target.symbolName}`
    );

    // Check safety coordinator before trading
    const safetyStatus = this.safetyCoordinator.getCurrentStatus();
    if (safetyStatus.overall.safetyLevel !== "safe") {
      this.logger.warn(
        `[AutoSnipingOrchestrator] Trading blocked by safety coordinator: ${safetyStatus.overall.safetyLevel}`
      );
      throw new Error(`Trading blocked by safety system: ${safetyStatus.overall.safetyLevel}`);
    }

    try {
      // Calculate trade parameters
      const tradeParams = {
        userId: "system", // Auto-sniping system user
        symbol: target.symbolName,
        side: "BUY" as const, // Snipe targets are buy orders
        type: "MARKET" as const, // Use market orders for speed
        quoteOrderQty: target.positionSizeUsdt?.toString(), // Use USDT amount
        timeInForce: "IOC" as const, // Immediate or Cancel for safety
      };

      // Execute trade through trading service
      const tradeResult = await this.mexcTradingService.executeTrade(tradeParams);

      if (!tradeResult.success) {
        throw new Error(tradeResult.error || "Trade execution failed");
      }

      // Create real position tracking
      const position = {
        id: tradeResult.data.orderId || `real-${target.id}-${Date.now()}`,
        targetId: target.id,
        symbol: target.symbolName,
        vcoinId: target.vcoinId,
        orderId: tradeResult.data.orderId,
        entryPrice: tradeResult.data.price ? parseFloat(tradeResult.data.price) : 0,
        amount: tradeResult.data.executedQty ? parseFloat(tradeResult.data.executedQty) : 0,
        strategy: this.config.strategy,
        timestamp: tradeResult.data.timestamp,
        confidence: target.confidenceScore,
        stopLoss: target.stopLossPercent,
        takeProfit: target.takeProfitCustom || 15,
        status: tradeResult.data.status,
        realTrade: true,
      };

      this.activePositions.set(position.id, position);
      this.status.currentPositions = this.activePositions.size;
      this.status.executedTrades++;
      this.metrics.session.successfulTrades++;

      // Update target status to completed
      await this.updateTargetStatus(target.id, "completed");

      this.logger.info(
        `[AutoSnipingOrchestrator] Real trade executed successfully: ${position.orderId}`
      );

      // Set up position monitoring for stop-loss and take-profit
      this.monitorRealPosition(position);
    } catch (error) {
      this.logger.error(`[AutoSnipingOrchestrator] Real trade execution failed:`, error);
      this.metrics.session.failedTrades++;
      throw error;
    }
  }

  private async executeTrade(pattern: any): Promise<void> {
    this.logger.info(`[AutoSnipingOrchestrator] Executing real trade for ${pattern.symbol}`);

    // Check safety coordinator before trading
    const safetyStatus = this.safetyCoordinator.getCurrentStatus();
    if (safetyStatus.overall.safetyLevel !== "safe") {
      this.logger.warn(
        `[AutoSnipingOrchestrator] Trading blocked by safety coordinator: ${safetyStatus.overall.safetyLevel}`
      );
      throw new Error(`Trading blocked by safety system: ${safetyStatus.overall.safetyLevel}`);
    }

    try {
      // Calculate trade parameters from pattern
      const tradeParams = {
        userId: "system", // Auto-sniping system user
        symbol: pattern.symbol,
        side: pattern.side || ("BUY" as const),
        type: "MARKET" as const, // Use market orders for speed
        quoteOrderQty: (this.config.maxPositionSize * 1000).toString(), // Use configured position size
        timeInForce: "IOC" as const, // Immediate or Cancel for safety
      };

      // Execute trade through trading service
      const tradeResult = await this.mexcTradingService.executeTrade(tradeParams);

      if (!tradeResult.success) {
        throw new Error(tradeResult.error || "Trade execution failed");
      }

      // Create real position tracking
      const position = {
        id: tradeResult.data.orderId || `real-${Date.now()}`,
        symbol: pattern.symbol,
        orderId: tradeResult.data.orderId,
        entryPrice: tradeResult.data.price ? parseFloat(tradeResult.data.price) : 0,
        amount: tradeResult.data.executedQty ? parseFloat(tradeResult.data.executedQty) : 0,
        strategy: this.config.strategy,
        timestamp: tradeResult.data.timestamp,
        confidence: pattern.confidence,
        status: tradeResult.data.status,
        realTrade: true,
      };

      this.activePositions.set(position.id, position);
      this.status.currentPositions = this.activePositions.size;
      this.status.executedTrades++;
      this.metrics.session.successfulTrades++;

      this.logger.info(
        `[AutoSnipingOrchestrator] Real trade executed successfully: ${position.orderId}`
      );

      // Set up position monitoring for stop-loss and take-profit
      this.monitorRealPosition(position);
    } catch (error) {
      this.logger.error(`[AutoSnipingOrchestrator] Real trade execution failed:`, error);
      this.metrics.session.failedTrades++;
      throw error;
    }
  }

  private monitorRealPosition(position: any): void {
    this.logger.info(`[AutoSnipingOrchestrator] Monitoring position: ${position.orderId}`);
    // Basic monitoring - TODO: implement real-time price monitoring
    setTimeout(async () => await this.checkPositionStatus(position), 30000);
  }

  private async checkPositionStatus(position: any): Promise<void> {
    try {
      this.logger.info(`[AutoSnipingOrchestrator] Checking position: ${position.orderId}`);
      // TODO: Implement real price monitoring and stop-loss/take-profit logic
    } catch (error) {
      this.logger.error(`Position monitoring error for ${position.orderId}:`, error);
    }
  }

  private closeSimulatedPosition(positionId: string): void {
    const position = this.activePositions.get(positionId);
    if (position) {
      this.logger.info(`[AutoSnipingOrchestrator] Closing simulated position: ${position.symbol}`);

      // Simulate profit/loss
      const profit = Math.random() * 200 - 100; // Random P&L between -100 and +100
      this.status.profitLoss.realized += profit;
      this.status.profitLoss.total += profit;

      this.activePositions.delete(positionId);
      this.positionHistory.push({ ...position, closedAt: new Date().toISOString(), profit });

      this.status.currentPositions = this.activePositions.size;
      this.status.totalPositions = this.positionHistory.length;
    }
  }

  private async closeAllPositions(reason: string): Promise<void> {
    this.logger.info(`[AutoSnipingOrchestrator] Closing all positions: ${reason}`);

    for (const [positionId, position] of this.activePositions) {
      if (position.realTrade && position.orderId) {
        // Close real position by placing a sell order
        await this.closeRealPosition(position, reason);
      } else {
        // Close simulated position
        this.closeSimulatedPosition(positionId);
      }
    }
  }

  /**
   * Close a real trading position by placing a sell order
   */
  private async closeRealPosition(position: any, reason: string): Promise<void> {
    try {
      this.logger.info(
        `[AutoSnipingOrchestrator] Closing real position ${position.orderId}: ${reason}`
      );

      // Place a market sell order to close the position
      const closeParams = {
        userId: "system",
        symbol: position.symbol,
        side: "SELL" as const,
        type: "MARKET" as const,
        quantity: position.amount.toString(),
        timeInForce: "IOC" as const,
      };

      const closeResult = await this.mexcTradingService.executeTrade(closeParams);

      if (closeResult.success) {
        this.logger.info(
          `[AutoSnipingOrchestrator] Real position closed successfully: ${position.orderId}`
        );

        // Calculate profit/loss
        const exitPrice = closeResult.data.price
          ? parseFloat(closeResult.data.price)
          : position.entryPrice;
        const profit = (exitPrice - position.entryPrice) * position.amount;

        this.status.profitLoss.realized += profit;
        this.status.profitLoss.total += profit;

        // Remove from active positions
        this.activePositions.delete(position.id);
        this.positionHistory.push({
          ...position,
          closedAt: new Date().toISOString(),
          exitPrice,
          profit,
          closeReason: reason,
        });

        this.status.currentPositions = this.activePositions.size;
        this.status.totalPositions = this.positionHistory.length;
      } else {
        this.logger.error(
          `[AutoSnipingOrchestrator] Failed to close real position ${position.orderId}:`,
          closeResult.error
        );
      }
    } catch (error) {
      this.logger.error(
        `[AutoSnipingOrchestrator] Error closing real position ${position.orderId}:`,
        error
      );
    }
  }

  private updateRunningTime(): void {
    if (this.startTime > 0) {
      this.status.runningTime = Date.now() - this.startTime;
      this.metrics.session.uptime = this.status.runningTime;
    }
  }

  private updateSystemHealth(): void {
    // Update system health status
    this.status.systemHealth.patternDetection = "operational";
    this.status.systemHealth.tradingBot = this.tradingBot ? "operational" : "offline";
    this.status.systemHealth.safetyCoordinator = this.safetyCoordinator ? "operational" : "offline";
    this.status.systemHealth.mexcConnection = "connected"; // Would check actual connection
  }

  private updateStatus(): void {
    this.updateRunningTime();
    this.updateSystemHealth();
    const totalInvested = this.positionHistory.length * 1000;
    if (totalInvested > 0) {
      this.status.profitLoss.percentage = (this.status.profitLoss.total / totalInvested) * 100;
    }
    this.emit("status_updated", this.status);
  }

  private updateMetrics(): void {
    this.metrics.session.totalOpportunities = this.status.detectedOpportunities;
    this.metrics.session.successRate =
      this.metrics.session.totalOpportunities > 0
        ? (this.metrics.session.successfulTrades / this.metrics.session.totalOpportunities) * 100
        : 0;
    this.metrics.performance.avgConfidence = this.status.avgConfidenceScore;
    this.metrics.performance.profitability = this.status.profitLoss.percentage;
  }

  private async cleanup(): Promise<void> {
    this.clearMonitoringTimers();
    this.isActive = false;
    this.status.active = false;
  }

  async emergencyStop(reason: string): Promise<void> {
    this.logger.warn(`[AutoSnipingOrchestrator] EMERGENCY STOP: ${reason}`);
    this.clearMonitoringTimers();
    if (!this.config.paperTradingMode) {
      await this.closeAllPositions(`Emergency stop: ${reason}`);
    }
    await this.safetyCoordinator.stop();
    this.isActive = false;
    this.status.active = false;
    this.status.safeToOperate = false;
    this.metrics.safety.emergencyStops++;
    this.status.lastOperation = {
      timestamp: new Date().toISOString(),
      action: "emergency_stop",
      result: "success",
    };
    this.emit("emergency_stop", {
      reason,
      timestamp: new Date().toISOString(),
      status: this.status,
    });
  }
}

export default AutoSnipingOrchestrator;
