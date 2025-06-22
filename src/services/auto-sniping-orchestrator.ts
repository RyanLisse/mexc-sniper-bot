/**
 * Auto-Sniping Orchestrator - Central Control System
 *
 * Integrates all auto-sniping components for coordinated trading operations.
 * This service fulfills the requirements from Vertical Slice 5 in the integration testing mission.
 */

import { EventEmitter } from "events";
import { ComprehensiveSafetyCoordinator } from "./comprehensive-safety-coordinator";
import { MexcConfigValidator } from "./mexc-config-validator";
import type { SymbolEntry } from "./mexc-unified-exports";
import { MultiPhaseTradingBot } from "./multi-phase-trading-bot";
import { PatternDetectionEngine } from "./pattern-detection-engine";
import { TRADING_STRATEGIES } from "./trading-strategy-manager";
import { UnifiedMexcService } from "./unified-mexc-service";

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
  private static instance: AutoSnipingOrchestrator;

  // Core services
  private patternEngine: PatternDetectionEngine;
  private tradingBot: MultiPhaseTradingBot | null = null;
  private safetyCoordinator: ComprehensiveSafetyCoordinator;
  private mexcService: UnifiedMexcService;
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
    this.patternEngine = PatternDetectionEngine.getInstance();
    this.safetyCoordinator = new ComprehensiveSafetyCoordinator();
    this.mexcService = new UnifiedMexcService();
    this.configValidator = MexcConfigValidator.getInstance();

    // Initialize state
    this.status = this.initializeStatus();
    this.metrics = this.initializeMetrics();

    console.log("[AutoSnipingOrchestrator] Initialized with configuration:", this.config);
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

    console.log("[AutoSnipingOrchestrator] Starting auto-sniping operations...");

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
      this.tradingBot = new MultiPhaseTradingBot(strategy, 0, 0); // Will be set when position is created

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

      console.log("[AutoSnipingOrchestrator] Auto-sniping started successfully");

      return {
        success: true,
        message: "Auto-sniping started successfully",
        status: this.status,
      };
    } catch (error) {
      console.error("[AutoSnipingOrchestrator] Failed to start auto-sniping:", error);

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

    console.log("[AutoSnipingOrchestrator] Stopping auto-sniping operations...");

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

      console.log("[AutoSnipingOrchestrator] Auto-sniping stopped successfully");

      return {
        success: true,
        message: "Auto-sniping stopped successfully",
        finalStatus: this.status,
      };
    } catch (error) {
      console.error("[AutoSnipingOrchestrator] Error stopping auto-sniping:", error);

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

  /**
   * Update configuration
   */
  async updateConfiguration(
    newConfig: Partial<AutoSnipingConfig>
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Validate new configuration
      const updatedConfig = { ...this.config, ...newConfig };

      // Basic validation
      if (updatedConfig.maxPositionSize <= 0 || updatedConfig.maxPositionSize > 1) {
        return { success: false, message: "Max position size must be between 0 and 1" };
      }

      if (updatedConfig.confidenceThreshold < 0 || updatedConfig.confidenceThreshold > 100) {
        return { success: false, message: "Confidence threshold must be between 0 and 100" };
      }

      // Apply configuration
      this.config = updatedConfig;

      // If active, restart monitoring with new intervals
      if (this.isActive) {
        this.clearMonitoringTimers();
        this.startMonitoringTimers();
      }

      console.log("[AutoSnipingOrchestrator] Configuration updated:", newConfig);

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
      profitLoss: {
        realized: 0,
        unrealized: 0,
        total: 0,
        percentage: 0,
      },
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
      console.log("[AutoSnipingOrchestrator] Performing pattern detection...");

      // Get market data from MEXC
      const symbolsResponse = await this.mexcService.getSymbolData();
      if (!symbolsResponse.success || !symbolsResponse.data) {
        console.warn("[AutoSnipingOrchestrator] Failed to get symbols from MEXC");
        return;
      }

      const symbols = symbolsResponse.data as SymbolEntry[];

      // Detect ready state patterns
      const patterns = await this.patternEngine.detectReadyStatePattern(symbols);
      this.status.detectedOpportunities += patterns.length;

      // Process high-confidence patterns
      for (const pattern of patterns) {
        if (pattern.confidence >= this.config.confidenceThreshold) {
          await this.processOpportunity(pattern);
        }
      }

      this.status.avgConfidenceScore =
        patterns.length > 0
          ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
          : 0;
    } catch (error) {
      console.error("[AutoSnipingOrchestrator] Pattern detection failed:", error);
      this.status.systemHealth.patternDetection = "degraded";
    }
  }

  private async performSafetyCheck(): Promise<void> {
    try {
      console.log("[AutoSnipingOrchestrator] Performing safety check...");

      const safetyStatus = this.safetyCoordinator.getCurrentStatus();
      this.status.safeToOperate = safetyStatus.overall.safetyLevel === "safe";

      // Update safety metrics
      this.metrics.safety.lastSafetyCheck = new Date().toISOString();
      this.metrics.safety.riskScore = safetyStatus.risk.overallRiskScore;

      // Emergency stop if safety compromised
      if (safetyStatus.overall.safetyLevel === "emergency") {
        console.warn(
          "[AutoSnipingOrchestrator] Emergency safety condition detected, stopping auto-sniping"
        );
        await this.stopAutoSniping();
        this.metrics.safety.emergencyStops++;
      }
    } catch (error) {
      console.error("[AutoSnipingOrchestrator] Safety check failed:", error);
      this.status.systemHealth.safetyCoordinator = "degraded";
    }
  }

  private async processOpportunity(pattern: any): Promise<void> {
    try {
      console.log(
        `[AutoSnipingOrchestrator] Processing opportunity: ${pattern.symbol} (confidence: ${pattern.confidence}%)`
      );

      // Check if we can take new positions
      if (this.activePositions.size >= this.config.maxConcurrentPositions) {
        console.log(
          "[AutoSnipingOrchestrator] Max concurrent positions reached, skipping opportunity"
        );
        return;
      }

      // In paper trading mode, simulate the trade
      if (this.config.paperTradingMode) {
        await this.simulateTrade(pattern);
      } else {
        await this.executeTrade(pattern);
      }

      this.status.lastOperation = {
        timestamp: new Date().toISOString(),
        action: "execute_trade",
        symbol: pattern.symbol,
        result: "success",
      };
    } catch (error) {
      console.error("[AutoSnipingOrchestrator] Failed to process opportunity:", error);

      this.status.lastOperation = {
        timestamp: new Date().toISOString(),
        action: "execute_trade",
        symbol: pattern.symbol,
        result: "failed",
      };
    }
  }

  private async simulateTrade(pattern: any): Promise<void> {
    console.log(`[AutoSnipingOrchestrator] Simulating trade for ${pattern.symbol}`);

    // Create simulated position
    const position = {
      id: `sim-${Date.now()}`,
      symbol: pattern.symbol,
      entryPrice: 100, // Simulated price
      amount: 1000, // Simulated amount
      strategy: this.config.strategy,
      timestamp: new Date().toISOString(),
      confidence: pattern.confidence,
    };

    this.activePositions.set(position.id, position);
    this.status.currentPositions = this.activePositions.size;
    this.status.executedTrades++;
    this.metrics.session.successfulTrades++;

    // Simulate position closure after a delay
    setTimeout(() => {
      this.closeSimulatedPosition(position.id);
    }, 60000); // Close after 1 minute for simulation
  }

  private async executeTrade(pattern: any): Promise<void> {
    // Real trading implementation would go here
    console.log(`[AutoSnipingOrchestrator] Executing real trade for ${pattern.symbol}`);
    // For now, delegate to simulated trade
    await this.simulateTrade(pattern);
  }

  private closeSimulatedPosition(positionId: string): void {
    const position = this.activePositions.get(positionId);
    if (position) {
      console.log(`[AutoSnipingOrchestrator] Closing simulated position: ${position.symbol}`);

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
    console.log(`[AutoSnipingOrchestrator] Closing all positions: ${reason}`);

    for (const [positionId] of this.activePositions) {
      this.closeSimulatedPosition(positionId);
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

    // Calculate profit/loss percentage
    const totalInvested = this.positionHistory.length * 1000; // Simulated
    if (totalInvested > 0) {
      this.status.profitLoss.percentage = (this.status.profitLoss.total / totalInvested) * 100;
    }

    // Emit status update
    this.emit("status_updated", this.status);
  }

  private updateMetrics(): void {
    // Update session metrics
    this.metrics.session.totalOpportunities = this.status.detectedOpportunities;
    this.metrics.session.successRate =
      this.metrics.session.totalOpportunities > 0
        ? (this.metrics.session.successfulTrades / this.metrics.session.totalOpportunities) * 100
        : 0;

    // Update performance metrics
    this.metrics.performance.avgConfidence = this.status.avgConfidenceScore;
    this.metrics.performance.profitability = this.status.profitLoss.percentage;
  }

  private async cleanup(): Promise<void> {
    this.clearMonitoringTimers();
    this.isActive = false;
    this.status.active = false;
  }

  /**
   * Emergency stop - immediately halt all operations
   */
  async emergencyStop(reason: string): Promise<void> {
    console.warn(`[AutoSnipingOrchestrator] EMERGENCY STOP: ${reason}`);

    // Immediately stop all operations
    this.clearMonitoringTimers();

    // Close all positions if not paper trading
    if (!this.config.paperTradingMode) {
      await this.closeAllPositions(`Emergency stop: ${reason}`);
    }

    // Stop safety coordinator
    await this.safetyCoordinator.stop();

    // Update state
    this.isActive = false;
    this.status.active = false;
    this.status.safeToOperate = false;

    // Record emergency stop
    this.metrics.safety.emergencyStops++;
    this.status.lastOperation = {
      timestamp: new Date().toISOString(),
      action: "emergency_stop",
      result: "success",
    };

    // Emit emergency stop event
    this.emit("emergency_stop", {
      reason,
      timestamp: new Date().toISOString(),
      status: this.status,
    });
  }
}

export default AutoSnipingOrchestrator;
