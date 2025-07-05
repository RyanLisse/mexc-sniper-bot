/**
 * Unified Auto-Sniping Orchestrator
 *
 * This service orchestrates the complete end-to-end auto-sniping workflow by:
 * 1. Coordinating all auto-sniping components
 * 2. Managing the complete trading lifecycle
 * 3. Providing unified status and control
 * 4. Ensuring proper error handling and recovery
 * 5. Implementing safety checks and risk management
 */

import { BrowserCompatibleEventEmitter } from "@/src/lib/browser-compatible-events";
import { toSafeError } from "@/src/lib/error-type-utils";
import {
  getCompleteAutoSnipingService,
  type SnipeConfiguration,
} from "./complete-auto-sniping-service";
import { getCoreTrading } from "./consolidated/core-trading/base-service";
import {
  getEnhancedMexcConfig,
  type MexcTradingConfig,
} from "./enhanced-mexc-config";
import {
  getPatternSnipeIntegration,
  type PatternSnipeConfig,
} from "./pattern-snipe-integration";
import {
  getRealtimePriceMonitor,
  type RealtimeMonitorConfig,
} from "./realtime-price-monitor";

// Unified orchestrator interfaces
export interface OrchestratorConfig {
  // Core Settings
  enabled: boolean;
  paperTradingMode: boolean;
  autoInitialize: boolean;

  // Component Configurations
  snipeConfig: Partial<SnipeConfiguration>;
  patternConfig: Partial<PatternSnipeConfig>;
  monitorConfig: Partial<RealtimeMonitorConfig>;
  mexcConfig: Partial<MexcTradingConfig>;

  // Safety Settings
  enableSafetyChecks: boolean;
  enableRiskManagement: boolean;
  emergencyStopOnErrors: boolean;
  maxErrorsBeforeStop: number;

  // Performance Settings
  enableMetrics: boolean;
  enableLogging: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
}

export interface OrchestratorStatus {
  // Overall Status
  isInitialized: boolean;
  isActive: boolean;
  isHealthy: boolean;

  // Component Status
  components: {
    snipingService: any;
    patternIntegration: any;
    priceMonitor: any;
    mexcConfig: any;
    coreTrading: any;
  };

  // Performance Metrics
  metrics: {
    totalSnipes: number;
    successfulSnipes: number;
    failedSnipes: number;
    successRate: number;
    totalProfit: number;
    activePositions: number;
    uptime: number;
  };

  // Safety Status
  safety: {
    errorsCount: number;
    lastError?: string;
    emergencyStopTriggered: boolean;
    riskLevel: "low" | "medium" | "high" | "critical";
  };

  timestamp: string;
}

export interface ExecutionCommand {
  action: "start" | "stop" | "pause" | "resume" | "emergency_stop" | "reset";
  reason?: string;
  force?: boolean;
}

/**
 * Unified Auto-Sniping Orchestrator
 *
 * Master controller for the complete auto-sniping system
 */
export class UnifiedAutoSnipingOrchestrator extends BrowserCompatibleEventEmitter {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[unified-orchestrator]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[unified-orchestrator]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[unified-orchestrator]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[unified-orchestrator]", message, context || ""),
  };

  private isInitialized = false;
  private isActive = false;
  private config: OrchestratorConfig;

  // Component services
  private snipingService = getCompleteAutoSnipingService();
  private patternIntegration = getPatternSnipeIntegration();
  private priceMonitor = getRealtimePriceMonitor();
  private mexcConfig = getEnhancedMexcConfig();
  private coreTrading = getCoreTrading();

  // State management
  private errorCount = 0;
  private lastError: string | undefined;
  private emergencyStopTriggered = false;
  private startTime = new Date();
  private metrics = {
    totalSnipes: 0,
    successfulSnipes: 0,
    failedSnipes: 0,
    totalProfit: 0,
    activePositions: 0,
  };

  constructor(config: Partial<OrchestratorConfig> = {}) {
    super();

    const paperTradingFlag =
      (process.env.MEXC_PAPER_TRADING ?? process.env.PAPER_TRADING_MODE) !==
      "false";

    this.config = {
      enabled: true,
      paperTradingMode: paperTradingFlag,
      autoInitialize: true,

      snipeConfig: {
        paperTradingMode: paperTradingFlag,
        ...config.snipeConfig,
      },
      patternConfig: {
        enabled: true,
        autoExecuteEnabled: true,
        ...config.patternConfig,
      },
      monitorConfig: {
        enabled: true,
        symbols: ["BTCUSDT", "ETHUSDT", "ADAUSDT", "SOLUSDT", "DOTUSDT"],
        ...config.monitorConfig,
      },
      mexcConfig: {
        paperTradingMode: paperTradingFlag,
        ...config.mexcConfig,
      },

      enableSafetyChecks: true,
      enableRiskManagement: true,
      emergencyStopOnErrors: true,
      maxErrorsBeforeStop: 5,

      enableMetrics: true,
      enableLogging: true,
      logLevel: "info",

      ...config,
    };

    this.logger.info("Unified Auto-Sniping Orchestrator created", {
      enabled: this.config.enabled,
      paperTradingMode: this.config.paperTradingMode,
      autoInitialize: this.config.autoInitialize,
    });

    this.setupEventListeners();

    // Auto-initialize if requested
    if (this.config.autoInitialize) {
      this.initialize().catch((error) => {
        this.logger.error("Auto-initialization failed", error);
      });
    }
  }

  /**
   * Initialize the complete auto-sniping system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn("Orchestrator already initialized");
      return;
    }

    try {
      this.logger.info("Initializing Unified Auto-Sniping Orchestrator");

      // Reset state
      this.errorCount = 0;
      this.emergencyStopTriggered = false;
      this.startTime = new Date();

      // Initialize MEXC configuration first
      this.logger.info("Step 1/5: Initializing MEXC configuration");
      this.mexcConfig.updateConfig(this.config.mexcConfig);
      await this.mexcConfig.initialize();

      // Validate credentials if not in paper trading mode
      if (!this.config.paperTradingMode) {
        const validation = await this.mexcConfig.validateCredentials();
        if (!validation.isValid) {
          throw new Error(
            `MEXC credential validation failed: ${validation.error}`
          );
        }
        this.logger.info("MEXC credentials validated", {
          canTrade: validation.canTrade,
          accountType: validation.accountType,
          balanceUSDT: validation.balanceUSDT,
        });
      }

      // Initialize core trading service
      this.logger.info("Step 2/5: Initializing core trading service");
      await this.coreTrading.initialize();

      // Initialize complete auto-sniping service
      this.logger.info("Step 3/5: Initializing auto-sniping service");
      this.snipingService.updateConfig(this.config.snipeConfig);
      await this.snipingService.initialize();

      // Initialize pattern integration
      this.logger.info("Step 4/5: Initializing pattern integration");
      this.patternIntegration.updateConfig(this.config.patternConfig);
      await this.patternIntegration.start();

      // Initialize real-time price monitor
      this.logger.info("Step 5/5: Initializing price monitor");
      this.priceMonitor.updateConfig(this.config.monitorConfig);
      await this.priceMonitor.start();

      this.isInitialized = true;
      this.emit("orchestrator_initialized");

      this.logger.info(
        "Unified Auto-Sniping Orchestrator initialized successfully"
      );

      // Auto-start if enabled
      if (this.config.enabled) {
        await this.start();
      }
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to initialize orchestrator", safeError);
      this.handleError("Initialization failed", safeError);
      throw safeError;
    }
  }

  /**
   * Start the complete auto-sniping system
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("Orchestrator not initialized. Call initialize() first.");
    }

    if (this.isActive) {
      this.logger.warn("Orchestrator already active");
      return;
    }

    if (this.emergencyStopTriggered) {
      throw new Error(
        "Emergency stop triggered. Reset required before starting."
      );
    }

    try {
      this.logger.info("Starting unified auto-sniping system");

      // Perform safety checks
      if (this.config.enableSafetyChecks) {
        await this.performSafetyChecks();
      }

      // Start auto-sniping service
      const snipeResult = await this.snipingService.start();
      if (!snipeResult.success) {
        throw new Error(
          `Failed to start sniping service: ${snipeResult.error}`
        );
      }

      this.isActive = true;
      this.emit("orchestrator_started");

      this.logger.info("Unified auto-sniping system started successfully");
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to start orchestrator", safeError);
      this.handleError("Start failed", safeError);
      throw safeError;
    }
  }

  /**
   * Stop the complete auto-sniping system
   */
  async stop(reason = "Manual stop"): Promise<void> {
    try {
      this.logger.info("Stopping unified auto-sniping system", { reason });

      // Stop auto-sniping service
      await this.snipingService.stop();

      this.isActive = false;
      this.emit("orchestrator_stopped", { reason });

      this.logger.info("Unified auto-sniping system stopped successfully");
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to stop orchestrator", safeError);
      this.handleError("Stop failed", safeError);
      throw safeError;
    }
  }

  /**
   * Pause the auto-sniping system
   */
  async pause(): Promise<void> {
    if (!this.isActive) {
      throw new Error("Orchestrator not active");
    }

    try {
      this.logger.info("Pausing auto-sniping system");

      const result = await this.snipingService.stop();
      if (!result.success) {
        throw new Error(`Failed to pause: ${result.error}`);
      }

      this.emit("orchestrator_paused");
      this.logger.info("Auto-sniping system paused");
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to pause orchestrator", safeError);
      throw safeError;
    }
  }

  /**
   * Resume the auto-sniping system
   */
  async resume(): Promise<void> {
    if (!this.isActive) {
      throw new Error("Orchestrator not active");
    }

    try {
      this.logger.info("Resuming auto-sniping system");

      const result = await this.snipingService.start();
      if (!result.success) {
        throw new Error(`Failed to resume: ${result.error}`);
      }

      this.emit("orchestrator_resumed");
      this.logger.info("Auto-sniping system resumed");
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to resume orchestrator", safeError);
      throw safeError;
    }
  }

  /**
   * Emergency stop - immediately halt all operations
   */
  async emergencyStop(reason = "Emergency stop triggered"): Promise<void> {
    try {
      this.logger.warn("EMERGENCY STOP TRIGGERED", { reason });

      this.emergencyStopTriggered = true;
      this.isActive = false;

      // Stop all services immediately
      await Promise.allSettled([
        this.snipingService.stop(),
        this.coreTrading.stopAutoSniping(),
      ]);

      // Close all positions if not in paper trading
      if (!this.config.paperTradingMode) {
        try {
          await this.coreTrading.closeAllPositions("Emergency stop");
        } catch (error) {
          this.logger.error(
            "Failed to close positions during emergency stop",
            error
          );
        }
      }

      this.emit("emergency_stop", { reason });
      this.logger.warn("Emergency stop completed");
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Emergency stop failed", safeError);
      throw safeError;
    }
  }

  /**
   * Reset the system after emergency stop
   */
  async reset(): Promise<void> {
    try {
      this.logger.info("Resetting orchestrator system");

      this.emergencyStopTriggered = false;
      this.errorCount = 0;
      this.lastError = undefined;
      this.isActive = false;

      // Reset metrics
      this.metrics = {
        totalSnipes: 0,
        successfulSnipes: 0,
        failedSnipes: 0,
        totalProfit: 0,
        activePositions: 0,
      };

      this.emit("orchestrator_reset");
      this.logger.info("Orchestrator system reset completed");
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to reset orchestrator", safeError);
      throw safeError;
    }
  }

  /**
   * Execute a command
   */
  async executeCommand(command: ExecutionCommand): Promise<void> {
    this.logger.info(`Executing command: ${command.action}`, command);

    try {
      switch (command.action) {
        case "start":
          await this.start();
          break;
        case "stop":
          await this.stop(command.reason);
          break;
        case "pause":
          await this.pause();
          break;
        case "resume":
          await this.resume();
          break;
        case "emergency_stop":
          await this.emergencyStop(command.reason);
          break;
        case "reset":
          await this.reset();
          break;
        default:
          throw new Error(`Unknown command: ${command.action}`);
      }
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error(
        `Command execution failed: ${command.action}`,
        safeError
      );
      throw safeError;
    }
  }

  /**
   * Get comprehensive system status
   */
  getStatus(): OrchestratorStatus {
    const uptime = Date.now() - this.startTime.getTime();

    return {
      isInitialized: this.isInitialized,
      isActive: this.isActive,
      isHealthy: this.isHealthy(),

      components: {
        snipingService: this.snipingService.getStatus(),
        patternIntegration: this.patternIntegration.getStatus(),
        priceMonitor: this.priceMonitor.getStatus(),
        mexcConfig: this.mexcConfig.getStatus(),
        coreTrading: this.isInitialized ? "initialized" : "not_initialized",
      },

      metrics: {
        ...this.metrics,
        successRate:
          this.metrics.totalSnipes > 0
            ? (this.metrics.successfulSnipes / this.metrics.totalSnipes) * 100
            : 0,
        uptime,
      },

      safety: {
        errorsCount: this.errorCount,
        lastError: this.lastError,
        emergencyStopTriggered: this.emergencyStopTriggered,
        riskLevel: this.calculateRiskLevel(),
      },

      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<OrchestratorConfig>): void {
    this.config = { ...this.config, ...updates };

    // Update component configurations
    if (updates.snipeConfig) {
      this.snipingService.updateConfig(updates.snipeConfig);
    }

    if (updates.patternConfig) {
      this.patternIntegration.updateConfig(updates.patternConfig);
    }

    if (updates.monitorConfig) {
      this.priceMonitor.updateConfig(updates.monitorConfig);
    }

    if (updates.mexcConfig) {
      this.mexcConfig.updateConfig(updates.mexcConfig);
    }

    this.logger.info("Orchestrator configuration updated", {
      updatedFields: Object.keys(updates),
    });

    this.emit("config_updated", this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): OrchestratorConfig {
    return { ...this.config };
  }

  // ============================================================================
  // Private Implementation Methods
  // ============================================================================

  /**
   * Set up event listeners for all components
   */
  private setupEventListeners(): void {
    // Auto-sniping service events
    this.snipingService.on("snipe_executed", (data) => {
      this.metrics.totalSnipes++;
      this.metrics.successfulSnipes++;
      this.emit("snipe_executed", data);
    });

    this.snipingService.on("snipe_failed", (data) => {
      this.metrics.totalSnipes++;
      this.metrics.failedSnipes++;
      this.handleError("Snipe failed", new Error(data.error));
      this.emit("snipe_failed", data);
    });

    // Pattern integration events
    this.patternIntegration.on("pattern_snipe_success", (data) => {
      this.emit("pattern_snipe_success", data);
    });

    this.patternIntegration.on("pattern_snipe_failed", (data) => {
      this.handleError("Pattern snipe failed", new Error(data.result.error));
      this.emit("pattern_snipe_failed", data);
    });

    // Price monitor events
    this.priceMonitor.on("price_breakout", (breakout) => {
      this.logger.info(`Price breakout detected: ${breakout.symbol}`, breakout);
      this.emit("price_breakout", breakout);
    });

    this.priceMonitor.on("websocket_error", (error) => {
      this.handleError("Price monitor websocket error", error);
    });

    // Error handling
    this.on("error", (error) => {
      this.handleError("Orchestrator error", error);
    });
  }

  /**
   * Perform safety checks before starting
   */
  private async performSafetyChecks(): Promise<void> {
    this.logger.info("Performing safety checks");

    // Check MEXC configuration
    if (!this.config.paperTradingMode) {
      const validation = await this.mexcConfig.validateCredentials();
      if (!validation.isValid) {
        throw new Error(
          `Safety check failed: Invalid MEXC credentials - ${validation.error}`
        );
      }

      if (!validation.canTrade) {
        throw new Error("Safety check failed: Account cannot trade");
      }

      if (validation.balanceUSDT < 50) {
        // Minimum balance check
        this.logger.warn("Low account balance detected", {
          balance: validation.balanceUSDT,
          minimum: 50,
        });
      }
    }

    // Check component health
    const snipeStatus = this.snipingService.getStatus();
    if (!snipeStatus.isInitialized) {
      throw new Error("Safety check failed: Sniping service not initialized");
    }

    const patternStatus = this.patternIntegration.getStatus();
    if (!patternStatus.isActive) {
      throw new Error("Safety check failed: Pattern integration not active");
    }

    const monitorStatus = this.priceMonitor.getStatus();
    if (!monitorStatus.isActive) {
      throw new Error("Safety check failed: Price monitor not active");
    }

    this.logger.info("Safety checks passed");
  }

  /**
   * Handle errors and implement safety measures
   */
  private handleError(context: string, error: Error): void {
    this.errorCount++;
    this.lastError = error.message;

    this.logger.error(`Error in ${context}`, {
      error: error.message,
      errorCount: this.errorCount,
      maxErrors: this.config.maxErrorsBeforeStop,
    });

    // Trigger emergency stop if too many errors
    if (
      this.config.emergencyStopOnErrors &&
      this.errorCount >= this.config.maxErrorsBeforeStop
    ) {
      this.emergencyStop(`Too many errors: ${this.errorCount}`).catch(
        (stopError) => {
          this.logger.error(
            "Emergency stop failed during error handling",
            stopError
          );
        }
      );
    }

    this.emit("error_handled", { context, error, errorCount: this.errorCount });
  }

  /**
   * Check if system is healthy
   */
  private isHealthy(): boolean {
    if (this.emergencyStopTriggered) return false;
    if (this.errorCount >= this.config.maxErrorsBeforeStop) return false;

    // Check component health
    if (!this.snipingService.getStatus().isInitialized) return false;
    if (!this.patternIntegration.getStatus().isActive) return false;
    if (!this.priceMonitor.getStatus().isActive) return false;

    return true;
  }

  /**
   * Calculate current risk level
   */
  private calculateRiskLevel(): "low" | "medium" | "high" | "critical" {
    if (this.emergencyStopTriggered) return "critical";
    if (this.errorCount >= this.config.maxErrorsBeforeStop) return "critical";
    if (this.errorCount >= Math.floor(this.config.maxErrorsBeforeStop * 0.8))
      return "high";
    if (this.errorCount >= Math.floor(this.config.maxErrorsBeforeStop * 0.5))
      return "medium";
    return "low";
  }
}

// Export singleton instance
let unifiedOrchestrator: UnifiedAutoSnipingOrchestrator | null = null;

export function getUnifiedAutoSnipingOrchestrator(
  config?: Partial<OrchestratorConfig>
): UnifiedAutoSnipingOrchestrator {
  if (!unifiedOrchestrator) {
    unifiedOrchestrator = new UnifiedAutoSnipingOrchestrator(config);
  }
  return unifiedOrchestrator;
}

export function resetUnifiedAutoSnipingOrchestrator(): void {
  if (unifiedOrchestrator) {
    unifiedOrchestrator.stop().catch(() => {});
  }
  unifiedOrchestrator = null;
}

// Helper function to create a ready-to-use orchestrator
export async function createReadyOrchestrator(
  config?: Partial<OrchestratorConfig>
): Promise<UnifiedAutoSnipingOrchestrator> {
  const orchestrator = getUnifiedAutoSnipingOrchestrator(config);

  if (!orchestrator.getStatus().isInitialized) {
    await orchestrator.initialize();
  }

  return orchestrator;
}
