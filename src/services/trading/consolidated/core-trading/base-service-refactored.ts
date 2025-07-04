/**
 * Core Trading Service - Refactored Base Service
 *
 * Lightweight orchestrator that coordinates specialized modules.
 * Replaces the original monolithic implementation with focused, maintainable modules.
 */

import { BrowserCompatibleEventEmitter } from "@/src/lib/browser-compatible-events";
import { toSafeError } from "@/src/lib/error-type-utils";
// Import existing modules
import { AutoSnipingModule } from "./auto-sniping";
import { ManualTradingModule } from "./manual-trading";
// Import specialized modules
import { InitializationManager } from "./modules/initialization-manager";
import { PerformanceMonitor } from "./modules/performance-monitor";
import { TradingOperationsManager } from "./modules/trading-operations";
import { PerformanceTracker } from "./performance-tracker";
import { PositionManager } from "./position-manager";
import { StrategyManager } from "./strategy-manager";

// Import types
import type {
  CoreTradingConfig,
  ExtendedServiceStatus,
  MultiPhaseConfig,
  MultiPhaseResult,
  PerformanceMetrics,
  Position,
  ServiceResponse,
  ServiceStatus,
  TradeParameters,
  TradeResult,
} from "./types";

/**
 * Core Trading Service - Refactored Implementation
 *
 * Provides a unified interface for all trading operations through specialized modules.
 * Each module handles a specific domain of functionality, improving maintainability.
 */
export class CoreTradingServiceRefactored extends BrowserCompatibleEventEmitter {
  private static instance: CoreTradingServiceRefactored | null = null;

  // Core modules
  private initializationManager: InitializationManager;
  private performanceMonitor: PerformanceMonitor;
  private tradingOperations: TradingOperationsManager;

  // Trading modules
  private manualTrading: ManualTradingModule;
  private autoSniping: AutoSnipingModule;
  private positionManager: PositionManager;
  private performanceTracker: PerformanceTracker;
  private strategyManager: StrategyManager;

  constructor(config: Partial<CoreTradingConfig> = {}) {
    super();

    // Initialize core modules
    this.initializationManager = new InitializationManager(config);

    // Create module context
    const moduleContext = this.initializationManager.createModuleContext();

    // Initialize specialized modules
    this.performanceMonitor = new PerformanceMonitor(moduleContext);
    this.tradingOperations = new TradingOperationsManager(moduleContext);

    // Initialize trading modules
    this.manualTrading = new ManualTradingModule(moduleContext);
    this.autoSniping = new AutoSnipingModule(moduleContext);
    this.positionManager = new PositionManager(moduleContext);
    this.performanceTracker = new PerformanceTracker(moduleContext);
    this.strategyManager = new StrategyManager(moduleContext);

    // Set up event forwarding
    this.setupEventForwarding();
  }

  // Singleton pattern
  static getInstance(
    config?: Partial<CoreTradingConfig>
  ): CoreTradingServiceRefactored {
    if (!CoreTradingServiceRefactored.instance) {
      CoreTradingServiceRefactored.instance = new CoreTradingServiceRefactored(
        config
      );
    }
    return CoreTradingServiceRefactored.instance;
  }

  static destroyInstance(): void {
    if (CoreTradingServiceRefactored.instance) {
      CoreTradingServiceRefactored.instance.removeAllListeners();
      CoreTradingServiceRefactored.instance = null;
    }
  }

  // Initialization & Lifecycle
  async initialize(): Promise<ServiceResponse<void>> {
    try {
      const initResult = await this.initializationManager.initialize();
      if (!initResult.success) {
        return initResult;
      }

      // Initialize all modules
      const moduleInitPromises = [
        this.performanceMonitor.initialize?.() || Promise.resolve(),
        this.tradingOperations.initialize?.() || Promise.resolve(),
        this.manualTrading.initialize(),
        this.autoSniping.initialize(),
        this.positionManager.initialize(),
        this.performanceTracker.initialize(),
        this.strategyManager.initialize(),
      ];

      await Promise.all(moduleInitPromises);

      this.emit("initialized");
      return {
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: toSafeError(error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async shutdown(): Promise<ServiceResponse<void>> {
    try {
      // Shutdown all modules
      await Promise.all([
        this.autoSniping.shutdown(),
        this.manualTrading.shutdown(),
        this.positionManager.shutdown(),
        this.performanceTracker.shutdown(),
        this.strategyManager.shutdown(),
      ]);

      // Shutdown core modules
      await this.initializationManager.shutdown();

      this.emit("shutdown");
      return {
        success: true,
        data: undefined,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: toSafeError(error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Trading Operations (delegated to TradingOperationsManager)
  async executeTrade(params: TradeParameters): Promise<TradeResult> {
    const result = await this.tradingOperations.executeTrade(params);

    // Update performance metrics
    this.performanceMonitor.incrementTradeCount(result.success);
    if (result.executionTime) {
      this.performanceMonitor.updateExecutionTime(result.executionTime);
    }

    return result;
  }

  async executeMultiPhaseStrategy(
    config: MultiPhaseConfig
  ): Promise<MultiPhaseResult> {
    return this.tradingOperations.executeMultiPhaseStrategy(config);
  }

  async closePosition(
    positionId: string,
    reason: string
  ): Promise<ServiceResponse<void>> {
    return this.tradingOperations.closePosition(positionId, reason);
  }

  async closeAllPositions(
    reason: string = "System shutdown"
  ): Promise<ServiceResponse<void>> {
    return this.tradingOperations.closeAllPositions(reason);
  }

  async getActivePositions(): Promise<Position[]> {
    return this.tradingOperations.getActivePositions();
  }

  async getPosition(positionId: string): Promise<Position | undefined> {
    return this.tradingOperations.getPosition(positionId);
  }

  // Auto-sniping Operations (delegated to AutoSnipingModule)
  async startAutoSniping(): Promise<ServiceResponse<void>> {
    return this.autoSniping.start();
  }

  async stopAutoSniping(): Promise<ServiceResponse<void>> {
    return this.autoSniping.stop();
  }

  // Performance & Monitoring (delegated to PerformanceMonitor)
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    return this.performanceMonitor.getPerformanceMetrics();
  }

  async getServiceStatus(): Promise<ServiceStatus> {
    return this.performanceMonitor.getServiceStatus();
  }

  async getExtendedServiceStatus(): Promise<ExtendedServiceStatus> {
    return this.performanceMonitor.getExtendedServiceStatus();
  }

  // Strategy Management (delegated to StrategyManager)
  getAvailableStrategies(): string[] {
    return this.strategyManager.getAvailableStrategies();
  }

  addCustomStrategy(strategy: any): void {
    this.strategyManager.addCustomStrategy(strategy);
  }

  // Configuration Management (delegated to InitializationManager)
  async updateConfig(
    newConfig: Partial<CoreTradingConfig>
  ): Promise<ServiceResponse<void>> {
    return this.initializationManager.updateConfig(newConfig);
  }

  // Execution Control (delegated to TradingOperationsManager)
  async startExecution(): Promise<ServiceResponse<void>> {
    return this.tradingOperations.startExecution();
  }

  async stopExecution(): Promise<ServiceResponse<void>> {
    return this.tradingOperations.stopExecution();
  }

  async pauseExecution(): Promise<ServiceResponse<void>> {
    return this.tradingOperations.pauseExecution();
  }

  async resumeExecution(): Promise<ServiceResponse<void>> {
    return this.tradingOperations.resumeExecution();
  }

  async getExecutionReport(): Promise<any> {
    return this.tradingOperations.getExecutionReport();
  }

  // Status and Health (delegated to appropriate modules)
  async getStatus(): Promise<ServiceStatus> {
    return this.performanceMonitor.getServiceStatus();
  }

  get isInitialized(): boolean {
    return this.initializationManager.initialized;
  }

  get isHealthy(): boolean {
    return this.initializationManager.healthy;
  }

  get uptime(): number {
    return this.initializationManager.uptime;
  }

  get config(): CoreTradingConfig {
    return this.initializationManager.configuration;
  }

  // Event forwarding setup
  private setupEventForwarding(): void {
    // Forward events from initialization manager
    this.initializationManager.on("initialized", () =>
      this.emit("initialized")
    );
    this.initializationManager.on("shutdown", () => this.emit("shutdown"));
    this.initializationManager.on("configUpdated", (config) =>
      this.emit("configUpdated", config)
    );

    // Forward events from trading operations
    this.tradingOperations.on("tradeExecuted", (data) =>
      this.emit("tradeExecuted", data)
    );
    this.tradingOperations.on("tradeExecutionFailed", (data) =>
      this.emit("tradeExecutionFailed", data)
    );
    this.tradingOperations.on("positionClosed", (data) =>
      this.emit("positionClosed", data)
    );
    this.tradingOperations.on("executionStarted", (data) =>
      this.emit("executionStarted", data)
    );
    this.tradingOperations.on("executionStopped", (data) =>
      this.emit("executionStopped", data)
    );

    // Forward events from performance monitor
    this.performanceMonitor.on("metricUpdated", (data) =>
      this.emit("metricUpdated", data)
    );
    this.performanceMonitor.on("metricsCleared", () =>
      this.emit("metricsCleared")
    );

    // Forward events from auto-sniping
    this.autoSniping.on("started", () => this.emit("autoSnipingStarted"));
    this.autoSniping.on("stopped", () => this.emit("autoSnipingStopped"));
    this.autoSniping.on("snipeExecuted", (data) =>
      this.emit("snipeExecuted", data)
    );

    // Forward events from position manager
    this.positionManager.on("positionOpened", (data) =>
      this.emit("positionOpened", data)
    );
    this.positionManager.on("positionClosed", (data) =>
      this.emit("positionClosed", data)
    );
    this.positionManager.on("positionUpdated", (data) =>
      this.emit("positionUpdated", data)
    );
  }

  // Utility methods
  async healthCheck(): Promise<boolean> {
    try {
      const status = await this.getServiceStatus();
      return status.isHealthy;
    } catch {
      return false;
    }
  }

  async generateReport(): Promise<any> {
    return this.performanceMonitor.generateReport();
  }

  // Cleanup
  async cleanup(): Promise<void> {
    await this.shutdown();
    this.removeAllListeners();
  }
}
