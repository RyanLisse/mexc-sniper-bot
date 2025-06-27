/**
 * Core Trading Service - Base Service
 *
 * Main orchestrator that coordinates all trading modules.
 * This replaces the original monolithic core-trading.service.ts implementation.
 */

import { EventEmitter } from "events";
import { toSafeError } from "@/src/lib/error-type-utils";
import { ComprehensiveSafetyCoordinator } from "@/src/services/risk/comprehensive-safety-coordinator";
import { UnifiedMexcServiceV2 } from "@/src/services/api/unified-mexc-service-v2";
import { AutoSnipingModule } from "./auto-sniping";
// Import modules
import { ManualTradingModule } from "./manual-trading";
import { PerformanceTracker } from "./performance-tracker";
import { PositionManager } from "./position-manager";
import { StrategyManager } from "./strategy-manager";

// Import types
import type {
  CoreTradingConfig,
  CoreTradingEvents,
  ExtendedServiceStatus,
  ModuleContext,
  MultiPhaseConfig,
  MultiPhaseResult,
  PerformanceMetrics,
  Position,
  ServiceResponse,
  ServiceStatus,
  TradeParameters,
  TradeResult,
} from "./types";
import { validateConfig } from "./types";

/**
 * Core Trading Service
 *
 * Consolidated trading service that provides a unified interface for all
 * trading operations, auto-sniping, strategy management, and analytics.
 */
export class CoreTradingService extends EventEmitter<CoreTradingEvents> {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[core-trading-service]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[core-trading-service]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[core-trading-service]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[core-trading-service]", message, context || ""),
  };

  private static instance: CoreTradingService | null = null;

  // Core configuration and state
  private config: CoreTradingConfig;
  private isInitialized = false;
  private isHealthy = true;
  private startTime = new Date();

  // Integrated services
  private mexcService: UnifiedMexcServiceV2;
  private safetyCoordinator: ComprehensiveSafetyCoordinator | null = null;

  // Trading modules
  private manualTrading: ManualTradingModule;
  private autoSniping: AutoSnipingModule;
  private positionManager: PositionManager;
  private performanceTracker: PerformanceTracker;
  private strategyManager: StrategyManager;

  // Module context for sharing between modules
  private moduleContext: ModuleContext;

  constructor(config: Partial<CoreTradingConfig> = {}) {
    super();

    // Validate and set configuration
    this.config = validateConfig({
      apiKey: process.env.MEXC_API_KEY || "",
      secretKey: process.env.MEXC_SECRET_KEY || "",
      ...config,
    });

    // Initialize MEXC service
    this.mexcService = new UnifiedMexcServiceV2({
      apiKey: this.config.apiKey,
      secretKey: this.config.secretKey,
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      enableCaching: this.config.enableCaching,
      cacheTTL: this.config.cacheTTL,
    });

    // Create module context
    this.moduleContext = {
      config: this.config,
      mexcService: this.mexcService,
      logger: this.logger,
      eventEmitter: this,
    };

    // Initialize modules
    this.strategyManager = new StrategyManager(this.moduleContext);
    this.positionManager = new PositionManager(this.moduleContext);
    this.performanceTracker = new PerformanceTracker(this.moduleContext);
    this.manualTrading = new ManualTradingModule(this.moduleContext);
    this.autoSniping = new AutoSnipingModule(this.moduleContext);

    this.logger.info("Core Trading Service initialized", {
      paperTrading: this.config.enablePaperTrading,
      maxPositions: this.config.maxConcurrentPositions,
      strategy: this.config.defaultStrategy,
    });
  }

  // ============================================================================
  // Singleton Pattern
  // ============================================================================

  public static getInstance(config?: Partial<CoreTradingConfig>): CoreTradingService {
    if (!CoreTradingService.instance) {
      CoreTradingService.instance = new CoreTradingService(config);
    }
    return CoreTradingService.instance;
  }

  public static resetInstance(): void {
    if (CoreTradingService.instance) {
      CoreTradingService.instance.cleanup();
    }
    CoreTradingService.instance = null;
  }

  // ============================================================================
  // Lifecycle Management
  // ============================================================================

  /**
   * Initialize the service and all dependencies
   */
  async initialize(): Promise<ServiceResponse<void>> {
    try {
      this.logger.info("Initializing Core Trading Service...");

      // Initialize safety coordinator if risk management is enabled
      if (this.config.enableCircuitBreaker) {
        this.safetyCoordinator = new ComprehensiveSafetyCoordinator();
        await this.safetyCoordinator.start();
        this.moduleContext.safetyCoordinator = this.safetyCoordinator;
      }

      // Initialize all modules
      await this.strategyManager.initialize();
      await this.positionManager.initialize();
      await this.performanceTracker.initialize();
      await this.manualTrading.initialize();
      await this.autoSniping.initialize();

      // Start auto-sniping if enabled
      if (this.config.autoSnipingEnabled) {
        await this.autoSniping.start();
      }

      this.isInitialized = true;
      this.logger.info("Core Trading Service initialized successfully");

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to initialize Core Trading Service", safeError);

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Shutdown the service gracefully
   */
  async shutdown(): Promise<ServiceResponse<void>> {
    try {
      this.logger.info("Shutting down Core Trading Service...");

      // Stop auto-sniping
      await this.autoSniping.stop();

      // Close all positions if not in paper trading mode
      if (!this.config.enablePaperTrading) {
        await this.positionManager.closeAllPositions("Service shutdown");
      }

      // Shutdown modules
      await this.manualTrading.shutdown();
      await this.autoSniping.shutdown();
      await this.positionManager.shutdown();
      await this.performanceTracker.shutdown();
      await this.strategyManager.shutdown();

      // Stop safety coordinator
      if (this.safetyCoordinator) {
        await this.safetyCoordinator.stop();
      }

      // Clean up resources
      this.cleanup();

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Error during shutdown", safeError);

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  /**
   * Execute a manual trade
   */
  async executeTrade(params: TradeParameters): Promise<TradeResult> {
    this.ensureInitialized();
    return this.manualTrading.executeTrade(params);
  }

  /**
   * Execute a multi-phase trading strategy
   */
  async executeMultiPhaseStrategy(config: MultiPhaseConfig): Promise<MultiPhaseResult> {
    this.ensureInitialized();
    return this.manualTrading.executeMultiPhaseStrategy(config);
  }

  /**
   * Start auto-sniping monitoring
   */
  async startAutoSniping(): Promise<ServiceResponse<void>> {
    this.ensureInitialized();
    return this.autoSniping.start();
  }

  /**
   * Stop auto-sniping monitoring
   */
  async stopAutoSniping(): Promise<ServiceResponse<void>> {
    this.ensureInitialized();
    return this.autoSniping.stop();
  }

  /**
   * Get all active positions
   */
  async getActivePositions(): Promise<Position[]> {
    this.ensureInitialized();
    return this.positionManager.getActivePositions();
  }

  /**
   * Get a specific position by ID
   */
  async getPosition(positionId: string): Promise<Position | undefined> {
    this.ensureInitialized();
    return this.positionManager.getPosition(positionId);
  }

  /**
   * Close all positions
   */
  async closeAllPositions(reason: string): Promise<ServiceResponse<{ closedCount: number }>> {
    this.ensureInitialized();
    return this.positionManager.closeAllPositions(reason);
  }

  /**
   * Get comprehensive performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    this.ensureInitialized();
    return this.performanceTracker.getPerformanceMetrics();
  }

  /**
   * Get current service status
   */
  async getServiceStatus(): Promise<ServiceStatus> {
    this.ensureInitialized();

    const positionStats = await this.positionManager.getPositionStats();
    const performanceMetrics = await this.performanceTracker.getPerformanceMetrics();
    const manualTradingStatus = this.manualTrading.getStatus();
    const autoSnipingStatus = this.autoSniping.getStatus();

    const status: ServiceStatus = {
      // Service Health
      isHealthy: this.isHealthy && manualTradingStatus.isHealthy,
      isConnected: true, // Would check MEXC connection
      isAuthenticated: this.config.apiKey.length > 0,

      // Trading Status
      tradingEnabled: manualTradingStatus.tradingEnabled,
      autoSnipingEnabled: autoSnipingStatus.isActive,
      paperTradingMode: this.config.enablePaperTrading,

      // Position Status
      activePositions: positionStats.activeCount,
      maxPositions: this.config.maxConcurrentPositions,
      availableCapacity:
        (this.config.maxConcurrentPositions - positionStats.activeCount) /
        this.config.maxConcurrentPositions,

      // Circuit Breaker Status
      circuitBreakerOpen: manualTradingStatus.circuitBreakerOpen,
      circuitBreakerFailures: manualTradingStatus.circuitBreakerFailures,
      circuitBreakerResetTime: manualTradingStatus.circuitBreakerResetTime,

      // Performance Status
      lastTradeTime: performanceMetrics.totalTrades > 0 ? new Date() : undefined,
      averageResponseTime: performanceMetrics.averageExecutionTime,
      cacheHitRate: 0, // Would get from MEXC service

      // Risk Status
      currentRiskLevel: this.calculateRiskLevel(performanceMetrics),
      dailyPnL: performanceMetrics.totalPnL,
      dailyVolume: performanceMetrics.totalVolume,

      // System Status
      uptime: Date.now() - this.startTime.getTime(),
      lastHealthCheck: new Date(),
      version: "2.0.0",
    };

    return status;
  }

  /**
   * Get extended service status for frontend compatibility
   */
  async getExtendedServiceStatus(): Promise<ExtendedServiceStatus> {
    const baseStatus = await this.getServiceStatus();
    const autoSnipingStatus = this.autoSniping.getStatus();
    const performanceMetrics = await this.performanceTracker.getPerformanceMetrics();

    // Map base status to extended status with frontend-expected fields
    const extendedStatus: ExtendedServiceStatus = {
      ...baseStatus,
      
      // Frontend-specific fields with appropriate defaults/mappings
      status: baseStatus.isHealthy ? 'active' : 'idle',
      targetCounts: {
        memory: 0, // Would need to get from auto-sniping service
        database: 0, // Would need to get from database
        unified: baseStatus.activePositions,
        isConsistent: true,
        source: 'unified',
      },
      stateConsistency: {
        isConsistent: baseStatus.isHealthy,
        inconsistencies: [],
        recommendedActions: [],
        lastSyncTime: baseStatus.lastHealthCheck.toISOString(),
      },
      executedToday: performanceMetrics.totalTrades,
      successRate: performanceMetrics.successRate,
      totalProfit: performanceMetrics.totalPnL,
      lastExecution: baseStatus.lastTradeTime?.toISOString() || new Date().toISOString(),
      safetyStatus: baseStatus.currentRiskLevel === 'critical' ? 'unsafe' : 'safe',
      patternDetectionActive: autoSnipingStatus.isActive,
      executionCount: performanceMetrics.totalTrades,
      successCount: performanceMetrics.successfulTrades,
      errorCount: performanceMetrics.failedTrades,
      readyTargets: 0, // Would need to get from auto-sniping service
      activeTargets: baseStatus.activePositions,
      config: {
        maxConcurrentTargets: baseStatus.maxPositions,
        retryAttempts: 3, // From config
        executionDelay: 1000, // From config
      },
    };

    return extendedStatus;
  }

  /**
   * Get available trading strategies
   */
  getAvailableStrategies() {
    return this.strategyManager.getAvailableStrategies();
  }

  /**
   * Add a custom trading strategy
   */
  addCustomStrategy(strategy: any) {
    return this.strategyManager.addCustomStrategy(strategy);
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<CoreTradingConfig>): Promise<ServiceResponse<void>> {
    try {
      const newConfig = validateConfig({ ...this.config, ...updates });
      this.config = newConfig;
      this.moduleContext.config = newConfig;

      // Update all modules with new config
      await this.strategyManager.updateConfig(newConfig);
      await this.positionManager.updateConfig(newConfig);
      await this.performanceTracker.updateConfig(newConfig);
      await this.manualTrading.updateConfig(newConfig);
      await this.autoSniping.updateConfig(newConfig);

      this.logger.info("Configuration updated successfully", updates);

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to update configuration", safeError);

      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ============================================================================
  // Additional API Methods (for backward compatibility)
  // ============================================================================

  /**
   * Get status (alias for getServiceStatus)
   */
  async getStatus(): Promise<ServiceStatus> {
    return this.getServiceStatus();
  }

  /**
   * Start execution (alias for startAutoSniping)
   */
  async startExecution(): Promise<ServiceResponse<void>> {
    return this.startAutoSniping();
  }

  /**
   * Stop execution (alias for stopAutoSniping)
   */
  async stopExecution(): Promise<ServiceResponse<void>> {
    return this.stopAutoSniping();
  }

  /**
   * Pause execution
   */
  async pauseExecution(): Promise<ServiceResponse<void>> {
    this.ensureInitialized();
    return this.autoSniping.pause();
  }

  /**
   * Resume execution
   */
  async resumeExecution(): Promise<ServiceResponse<void>> {
    this.ensureInitialized();
    return this.autoSniping.resume();
  }

  /**
   * Get execution report
   */
  async getExecutionReport(): Promise<any> {
    this.ensureInitialized();
    const metrics = await this.getPerformanceMetrics();
    const positions = await this.getActivePositions();
    const status = await this.getServiceStatus();
    
    return {
      status,
      metrics,
      positions,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Close specific position
   */
  async closePosition(positionId: string, reason?: string): Promise<ServiceResponse<void>> {
    this.ensureInitialized();
    return this.positionManager.closePosition(positionId, reason || "Manual close");
  }

  /**
   * Emergency close all positions
   */
  async emergencyCloseAll(): Promise<ServiceResponse<{ closedCount: number }>> {
    this.ensureInitialized();
    return this.positionManager.closeAllPositions("Emergency stop");
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string): Promise<ServiceResponse<void>> {
    this.ensureInitialized();
    // Implementation would depend on alert system
    return {
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Clear acknowledged alerts
   */
  async clearAcknowledgedAlerts(): Promise<ServiceResponse<void>> {
    this.ensureInitialized();
    // Implementation would depend on alert system
    return {
      success: true,
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error("Core Trading Service is not initialized. Call initialize() first.");
    }
  }

  /**
   * Calculate current risk level based on performance metrics
   */
  private calculateRiskLevel(metrics: PerformanceMetrics): "low" | "medium" | "high" | "critical" {
    // Simple risk calculation based on drawdown and success rate
    if (metrics.maxDrawdown > 25 || metrics.successRate < 30) {
      return "critical";
    } else if (metrics.maxDrawdown > 15 || metrics.successRate < 50) {
      return "high";
    } else if (metrics.maxDrawdown > 10 || metrics.successRate < 70) {
      return "medium";
    } else {
      return "low";
    }
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    this.isInitialized = false;
    this.removeAllListeners();
  }
}

// Export singleton factory functions for backward compatibility
let globalCoreTrading: CoreTradingService | null = null;

export function getCoreTrading(config?: Partial<CoreTradingConfig>): CoreTradingService {
  if (!globalCoreTrading) {
    globalCoreTrading = new CoreTradingService(config);
  }
  return globalCoreTrading;
}

export function resetCoreTrading(): void {
  if (globalCoreTrading) {
    globalCoreTrading.shutdown();
  }
  globalCoreTrading = null;
}

export function createCoreTrading(config: Partial<CoreTradingConfig>): CoreTradingService {
  return new CoreTradingService(config);
}
