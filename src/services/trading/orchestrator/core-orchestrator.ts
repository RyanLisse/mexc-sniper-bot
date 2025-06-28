/**
 * Core Orchestrator Module
 *
 * Main orchestrator class for the auto-sniping system.
 * Extracted from the original monolithic implementation for better maintainability.
 */

import { EventEmitter } from "node:events";
import { toSafeError } from "../../../lib/error-type-utils";
import { PatternProcessor } from "./pattern-processor";
import { PositionMonitor } from "./position-monitor";
import { SafetyManager } from "./safety-manager";
import { TradeExecutor } from "./trade-executor";
import type {
  AutoSnipingConfig,
  AutoSnipingMetrics,
  AutoSnipingStatus,
  ModuleContext,
  OperationResult,
  PatternMatch,
  SnipeTarget,
  TradingPosition,
} from "./types";
import { DEFAULT_CONFIG, validateConfig } from "./types";

export class AutoSnipingOrchestrator {
  private static instance: AutoSnipingOrchestrator | null = null;

  // Core configuration and state
  private config: AutoSnipingConfig;
  private isRunning = false;
  private isInitialized = false;
  private startTime: Date | null = null;
  private eventEmitter = new EventEmitter();

  // Module components
  private patternProcessor: PatternProcessor;
  private tradeExecutor: TradeExecutor;
  private positionMonitor: PositionMonitor;
  private safetyManager: SafetyManager;

  // Monitoring intervals
  private patternDetectionInterval: NodeJS.Timeout | null = null;
  private safetyCheckInterval: NodeJS.Timeout | null = null;

  // Internal state tracking
  private detectedOpportunities = 0;
  private executedTrades = 0;
  private totalConfidenceScore = 0;
  private lastOperation: AutoSnipingStatus["lastOperation"] = null;

  // Logger
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[auto-sniping-orchestrator]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[auto-sniping-orchestrator]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[auto-sniping-orchestrator]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[auto-sniping-orchestrator]", message, context || ""),
  };

  constructor(config?: Partial<AutoSnipingConfig>) {
    // Validate and merge configuration
    this.config = validateConfig({ ...DEFAULT_CONFIG, ...config });

    // Initialize module context
    const moduleContext: ModuleContext = {
      config: this.config,
      logger: this.logger,
      eventEmitter: this.eventEmitter,
    };

    // Initialize modules
    this.patternProcessor = new PatternProcessor(moduleContext);
    this.tradeExecutor = new TradeExecutor(moduleContext);
    this.positionMonitor = new PositionMonitor(moduleContext);
    this.safetyManager = new SafetyManager(moduleContext);

    // Set up event listeners
    this.setupEventListeners();

    this.logger.info("Auto-sniping orchestrator created", {
      config: this.config,
      paperTradingMode: this.config.paperTradingMode,
    });
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<AutoSnipingConfig>): AutoSnipingOrchestrator {
    if (!AutoSnipingOrchestrator.instance) {
      AutoSnipingOrchestrator.instance = new AutoSnipingOrchestrator(config);
    }
    return AutoSnipingOrchestrator.instance;
  }

  /**
   * Initialize the orchestrator system
   */
  async initialize(): Promise<OperationResult> {
    try {
      this.logger.info("Initializing auto-sniping orchestrator");

      if (this.isInitialized) {
        return {
          success: true,
          message: "Auto-sniping orchestrator already initialized",
          status: await this.getStatus(),
        };
      }

      // Initialize all modules
      await this.patternProcessor.initialize();
      await this.tradeExecutor.initialize();
      await this.positionMonitor.initialize();
      await this.safetyManager.initialize();

      this.isInitialized = true;

      this.logger.info("Auto-sniping orchestrator initialized successfully");

      return {
        success: true,
        message: "Auto-sniping orchestrator initialized successfully",
        status: await this.getStatus(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error(`Failed to initialize auto-sniping orchestrator: ${safeError.message}`);

      return {
        success: false,
        message: `Initialization failed: ${safeError.message}`,
        status: await this.getStatus(),
      };
    }
  }

  /**
   * Start auto-sniping operations
   */
  async startAutoSniping(): Promise<OperationResult> {
    try {
      this.logger.info("Starting auto-sniping operations");

      if (!this.isInitialized) {
        const initResult = await this.initialize();
        if (!initResult.success) {
          return initResult;
        }
      }

      if (this.isRunning) {
        return {
          success: true,
          message: "Auto-sniping is already running",
          status: await this.getStatus(),
        };
      }

      if (!this.config.enabled) {
        return {
          success: false,
          message: "Auto-sniping is disabled in configuration",
          status: await this.getStatus(),
        };
      }

      // Perform safety checks
      const safetyCheck = await this.safetyManager.performSafetyCheck();
      if (!safetyCheck.success) {
        return {
          success: false,
          message: `Safety check failed: ${safetyCheck.error || "Unknown safety issue"}`,
          status: await this.getStatus(),
        };
      }

      // Start monitoring intervals
      this.startMonitoringIntervals();

      this.isRunning = true;
      this.startTime = new Date();

      this.lastOperation = {
        timestamp: new Date().toISOString(),
        action: "start_auto_sniping",
        result: "success",
      };

      this.eventEmitter.emit("auto_sniping_started", {
        timestamp: this.startTime.toISOString(),
        config: this.config,
      });

      this.logger.info("Auto-sniping operations started successfully");

      return {
        success: true,
        message: "Auto-sniping operations started successfully",
        status: await this.getStatus(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error(`Failed to start auto-sniping operations: ${safeError.message}`);

      this.lastOperation = {
        timestamp: new Date().toISOString(),
        action: "start_auto_sniping",
        result: "failed",
      };

      return {
        success: false,
        message: `Failed to start auto-sniping: ${safeError.message}`,
        status: await this.getStatus(),
      };
    }
  }

  /**
   * Stop auto-sniping operations
   */
  async stopAutoSniping(): Promise<OperationResult> {
    try {
      this.logger.info("Stopping auto-sniping operations");

      if (!this.isRunning) {
        return {
          success: true,
          message: "Auto-sniping is not currently running",
          status: await this.getStatus(),
        };
      }

      // Stop monitoring intervals
      this.stopMonitoringIntervals();

      // Close all open positions if configured to do so
      if (this.config.strategy !== "conservative") {
        await this.positionMonitor.closeAllPositions();
      }

      this.isRunning = false;

      this.lastOperation = {
        timestamp: new Date().toISOString(),
        action: "stop_auto_sniping",
        result: "success",
      };

      this.eventEmitter.emit("auto_sniping_stopped", {
        timestamp: new Date().toISOString(),
        runTime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      });

      this.logger.info("Auto-sniping operations stopped successfully");

      return {
        success: true,
        message: "Auto-sniping operations stopped successfully",
        finalStatus: await this.getStatus(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error(`Failed to stop auto-sniping operations: ${safeError.message}`);

      this.lastOperation = {
        timestamp: new Date().toISOString(),
        action: "stop_auto_sniping",
        result: "failed",
      };

      return {
        success: false,
        message: `Failed to stop auto-sniping: ${safeError.message}`,
        finalStatus: await this.getStatus(),
      };
    }
  }

  /**
   * Get current auto-sniping status
   */
  async getStatus(): Promise<AutoSnipingStatus> {
    const currentPositions = await this.positionMonitor.getOpenPositionsCount();
    const profitLoss = await this.positionMonitor.getProfitLoss();
    const systemHealth = await this.getSystemHealth();

    return {
      active: this.isRunning,
      safeToOperate: await this.safetyManager.isSafeToOperate(),
      currentPositions,
      totalPositions: this.executedTrades,
      profitLoss,
      systemHealth,
      lastOperation: this.lastOperation,
      runningTime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      detectedOpportunities: this.detectedOpportunities,
      executedTrades: this.executedTrades,
      avgConfidenceScore:
        this.detectedOpportunities > 0 ? this.totalConfidenceScore / this.detectedOpportunities : 0,
    };
  }

  /**
   * Get comprehensive metrics
   */
  async getMetrics(): Promise<AutoSnipingMetrics> {
    const uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;
    const successfulTrades = await this.positionMonitor.getSuccessfulTradesCount();
    const failedTrades = this.executedTrades - successfulTrades;

    return {
      session: {
        startTime: this.startTime?.toISOString() || new Date().toISOString(),
        uptime,
        totalOpportunities: this.detectedOpportunities,
        successfulTrades,
        failedTrades,
        successRate: this.executedTrades > 0 ? (successfulTrades / this.executedTrades) * 100 : 0,
      },
      performance: {
        avgResponseTime: await this.tradeExecutor.getAverageExecutionTime(),
        avgConfidence:
          this.detectedOpportunities > 0
            ? this.totalConfidenceScore / this.detectedOpportunities
            : 0,
        profitability: await this.positionMonitor.getProfitability(),
        maxDrawdown: await this.positionMonitor.getMaxDrawdown(),
        sharpeRatio: await this.positionMonitor.getSharpeRatio(),
      },
      safety: {
        safetyViolations: await this.safetyManager.getSafetyViolationsCount(),
        emergencyStops: await this.safetyManager.getEmergencyStopsCount(),
        lastSafetyCheck: await this.safetyManager.getLastSafetyCheckTime(),
        riskScore: await this.safetyManager.getCurrentRiskScore(),
      },
    };
  }

  /**
   * Update configuration
   */
  async updateConfiguration(newConfig: Partial<AutoSnipingConfig>): Promise<OperationResult> {
    try {
      const updatedConfig = validateConfig({ ...this.config, ...newConfig });
      const oldConfig = { ...this.config };

      this.config = updatedConfig;

      // Update module configurations
      const moduleContext: ModuleContext = {
        config: this.config,
        logger: this.logger,
        eventEmitter: this.eventEmitter,
      };

      await this.patternProcessor.updateConfig(moduleContext);
      await this.tradeExecutor.updateConfig(moduleContext);
      await this.positionMonitor.updateConfig(moduleContext);
      await this.safetyManager.updateConfig(moduleContext);

      // Restart intervals if running and intervals changed
      if (
        this.isRunning &&
        (oldConfig.patternDetectionInterval !== this.config.patternDetectionInterval ||
          oldConfig.safetyCheckInterval !== this.config.safetyCheckInterval)
      ) {
        this.stopMonitoringIntervals();
        this.startMonitoringIntervals();
      }

      this.logger.info("Configuration updated successfully", {
        oldConfig,
        newConfig: this.config,
      });

      return {
        success: true,
        message: "Configuration updated successfully",
        status: await this.getStatus(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error(`Failed to update configuration: ${safeError.message}`);

      return {
        success: false,
        message: `Configuration update failed: ${safeError.message}`,
        status: await this.getStatus(),
      };
    }
  }

  /**
   * Process a detected snipe target
   */
  async processSnipeTarget(target: SnipeTarget): Promise<OperationResult> {
    try {
      this.logger.info("Processing snipe target", { target });

      if (!this.isRunning) {
        return {
          success: false,
          message: "Auto-sniping is not running",
          status: await this.getStatus(),
        };
      }

      // Perform safety checks
      const safetyCheck = await this.safetyManager.validateTarget(target);
      if (!safetyCheck.success) {
        return {
          success: false,
          message: `Target validation failed: ${safetyCheck.error || "Unknown validation issue"}`,
          status: await this.getStatus(),
        };
      }

      // Execute the trade
      const executionResult = await this.tradeExecutor.executeSnipeTarget(target);

      this.lastOperation = {
        timestamp: new Date().toISOString(),
        action: "process_snipe_target",
        symbol: target.symbolName,
        result: executionResult.success ? "success" : "failed",
      };

      if (executionResult.success) {
        this.executedTrades++;
        this.eventEmitter.emit("target_processed", { target, result: executionResult });
      }

      return {
        success: executionResult.success,
        message: executionResult.success
          ? "Target processing completed"
          : executionResult.error || "Target processing failed",
        status: await this.getStatus(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error(
        `Failed to process snipe target ${target.symbolName}: ${safeError.message}`
      );

      this.lastOperation = {
        timestamp: new Date().toISOString(),
        action: "process_snipe_target",
        symbol: target.symbolName,
        result: "failed",
      };

      return {
        success: false,
        message: `Target processing failed: ${safeError.message}`,
        status: await this.getStatus(),
      };
    }
  }

  /**
   * Emergency stop - immediate halt of all operations
   */
  async emergencyStop(reason?: string): Promise<OperationResult> {
    const stopReason = reason || "Emergency stop requested";

    try {
      this.logger.error("Emergency stop initiated", { reason: stopReason });

      // Immediately stop all intervals
      this.stopMonitoringIntervals();

      // Emergency close all positions
      await this.positionMonitor.emergencyCloseAllPositions();

      // Cancel all pending orders
      await this.tradeExecutor.cancelAllPendingOrders();

      // Stop all modules immediately
      await this.patternProcessor.emergencyStop();
      await this.tradeExecutor.emergencyStop();
      await this.positionMonitor.emergencyStop();
      await this.safetyManager.emergencyStop();

      this.isRunning = false;

      this.lastOperation = {
        timestamp: new Date().toISOString(),
        action: "emergency_stop",
        result: "success",
      };

      this.eventEmitter.emit("emergency_stop", {
        reason: stopReason,
        timestamp: new Date().toISOString(),
      });

      this.logger.error("Emergency stop completed", { reason: stopReason });

      return {
        success: true,
        message: `Emergency stop completed: ${stopReason}`,
        status: await this.getStatus(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error(`Emergency stop failed: ${safeError.message}`, { reason: stopReason });

      return {
        success: false,
        message: `Emergency stop failed: ${safeError.message}`,
        status: await this.getStatus(),
      };
    }
  }

  /**
   * Shutdown the orchestrator
   */
  async shutdown(): Promise<void> {
    this.logger.info("Shutting down auto-sniping orchestrator");

    if (this.isRunning) {
      await this.stopAutoSniping();
    }

    this.stopMonitoringIntervals();

    // Shutdown all modules
    await this.patternProcessor.shutdown();
    await this.tradeExecutor.shutdown();
    await this.positionMonitor.shutdown();
    await this.safetyManager.shutdown();

    this.isInitialized = false;

    // Clear singleton instance
    AutoSnipingOrchestrator.instance = null;

    this.logger.info("Auto-sniping orchestrator shutdown completed");
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Set up event listeners for module communication
   */
  private setupEventListeners(): void {
    this.eventEmitter.on("pattern_detected", this.handlePatternDetected.bind(this));
    this.eventEmitter.on("trade_executed", this.handleTradeExecuted.bind(this));
    this.eventEmitter.on("position_opened", this.handlePositionOpened.bind(this));
    this.eventEmitter.on("position_closed", this.handlePositionClosed.bind(this));
    this.eventEmitter.on("safety_violation", this.handleSafetyViolation.bind(this));
    this.eventEmitter.on("emergency_stop", this.handleEmergencyStop.bind(this));
  }

  /**
   * Start monitoring intervals
   */
  private startMonitoringIntervals(): void {
    // Pattern detection interval
    this.patternDetectionInterval = setInterval(async () => {
      try {
        await this.patternProcessor.detectPatterns();
      } catch (error) {
        this.logger.error(`Pattern detection failed: ${toSafeError(error).message}`);
      }
    }, this.config.patternDetectionInterval);

    // Safety check interval
    this.safetyCheckInterval = setInterval(async () => {
      try {
        const safetyResult = await this.safetyManager.performSafetyCheck();
        if (!safetyResult.success) {
          this.logger.warn("Safety check failed", { result: safetyResult });
        }
      } catch (error) {
        this.logger.error(`Safety check failed: ${toSafeError(error).message}`);
      }
    }, this.config.safetyCheckInterval);

    this.logger.info("Monitoring intervals started", {
      patternDetectionInterval: this.config.patternDetectionInterval,
      safetyCheckInterval: this.config.safetyCheckInterval,
    });
  }

  /**
   * Stop monitoring intervals
   */
  private stopMonitoringIntervals(): void {
    if (this.patternDetectionInterval) {
      clearInterval(this.patternDetectionInterval);
      this.patternDetectionInterval = null;
    }

    if (this.safetyCheckInterval) {
      clearInterval(this.safetyCheckInterval);
      this.safetyCheckInterval = null;
    }

    this.logger.info("Monitoring intervals stopped");
  }

  /**
   * Get system health status
   */
  private async getSystemHealth() {
    return {
      patternDetection: await this.patternProcessor.getHealthStatus(),
      tradingBot: await this.tradeExecutor.getHealthStatus(),
      safetyCoordinator: await this.safetyManager.getHealthStatus(),
      mexcConnection: await this.tradeExecutor.getConnectionStatus(),
    };
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle pattern detected event
   */
  private async handlePatternDetected(pattern: PatternMatch): Promise<void> {
    this.detectedOpportunities++;
    this.totalConfidenceScore += pattern.confidence;

    this.logger.info("Pattern detected", { pattern });

    // Convert pattern to snipe target and process
    const target: SnipeTarget = {
      id: Date.now(),
      symbolName: pattern.symbol,
      positionSizeUsdt: this.config.maxPositionSize * 1000, // Assuming $1000 portfolio
      confidenceScore: pattern.confidence,
      stopLossPercent: this.config.stopLossPercentage * 100,
      status: "pending",
      priority: pattern.riskLevel === "low" ? 1 : pattern.riskLevel === "medium" ? 2 : 3,
      createdAt: new Date(),
    };

    if (pattern.confidence >= this.config.confidenceThreshold) {
      await this.processSnipeTarget(target);
    } else {
      this.logger.info("Pattern confidence below threshold, skipping", {
        confidence: pattern.confidence,
        threshold: this.config.confidenceThreshold,
      });
    }
  }

  /**
   * Handle trade executed event
   */
  private handleTradeExecuted(data: any): void {
    this.logger.info("Trade executed", { data });
    this.eventEmitter.emit("trade_executed", data);
  }

  /**
   * Handle position opened event
   */
  private handlePositionOpened(position: TradingPosition): void {
    this.logger.info("Position opened", { position });
    this.eventEmitter.emit("position_opened", position);
  }

  /**
   * Handle position closed event
   */
  private handlePositionClosed(position: TradingPosition): void {
    this.logger.info("Position closed", { position });
    this.eventEmitter.emit("position_closed", position);
  }

  /**
   * Handle safety violation event
   */
  private async handleSafetyViolation(violation: any): Promise<void> {
    this.logger.warn("Safety violation detected", { violation });

    if (violation.severity === "critical") {
      await this.stopAutoSniping();
      this.logger.error("Auto-sniping stopped due to critical safety violation");
    }
  }

  /**
   * Handle emergency stop event
   */
  private async handleEmergencyStop(reason: string): Promise<void> {
    this.logger.error("Emergency stop triggered", { reason });
    await this.stopAutoSniping();
    this.eventEmitter.emit("emergency_stop", { reason, timestamp: new Date().toISOString() });
  }
}
