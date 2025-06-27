/**
 * Auto-Sniping Execution Engine
 *
 * Core trading execution logic with pattern monitoring and opportunity processing.
 * Extracted from optimized-auto-sniping-core.ts for modularity.
 */

import { v4 as uuidv4 } from "uuid";
import type { PatternMatch } from "@/src/core/pattern-detection";
import { toSafeError } from "@/src/lib/error-type-utils";
import type { AutoSnipingConfigManager } from "./config-manager";
import {
  type AutoSnipingConfig,
  type ExecutionPosition,
  ExecutionPositionSchema,
  type ExecutionResult,
  type PatternType,
  type TradingOpportunity,
} from "./schemas";

export class AutoSnipingExecutionEngine {
  private static instance: AutoSnipingExecutionEngine | null = null;
  
  private configManager: AutoSnipingConfigManager;
  private activePositions = new Map<string, ExecutionPosition>();
  private isActive = false;
  private executionInterval: NodeJS.Timeout | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(configManager: AutoSnipingConfigManager) {
    this.configManager = configManager;
  }

  /**
   * Get singleton instance for backward compatibility
   */
  static getInstance(configManager?: AutoSnipingConfigManager): AutoSnipingExecutionEngine {
    if (!AutoSnipingExecutionEngine.instance) {
      if (!configManager) {
        // Create a default config manager if none provided
        try {
          const { AutoSnipingConfigManager } = require('./config-manager');
          configManager = new AutoSnipingConfigManager();
          console.info("[AutoSnipingExecutionEngine] Config manager loaded successfully");
        } catch (error) {
          console.warn("[AutoSnipingExecutionEngine] Could not load config manager, using fallback:", error.message);
          // Create a minimal fallback config manager for testing/emergency scenarios
          configManager = {
            getConfig: () => ({
              enabled: true,
              maxPositions: 5,
              maxDailyTrades: 10,
              positionSizeUSDT: 100,
              minConfidence: 80,
              allowedPatternTypes: ["ready_state"],
              requireCalendarConfirmation: true,
              stopLossPercentage: 5,
              takeProfitPercentage: 10,
              maxDrawdownPercentage: 20,
              enableAdvanceDetection: true,
              advanceHoursThreshold: 3.5,
              enableMultiPhaseStrategy: false,
              slippageTolerancePercentage: 1,
              executionDelay: 1000,
              maxConcurrentTargets: 5,
              retryAttempts: 3,
            }),
            updateConfig: (config: any) => {
              console.log("[MockConfigManager] Config updated:", config);
              // Return the merged configuration
              const baseConfig = {
                enabled: true,
                maxPositions: 5,
                maxDailyTrades: 10,
                positionSizeUSDT: 100,
                minConfidence: 80,
                allowedPatternTypes: ["ready_state"],
                requireCalendarConfirmation: true,
                stopLossPercentage: 5,
                takeProfitPercentage: 10,
                maxDrawdownPercentage: 20,
                enableAdvanceDetection: true,
                advanceHoursThreshold: 3.5,
                enableMultiPhaseStrategy: false,
                slippageTolerancePercentage: 1,
                executionDelay: 1000,
                maxConcurrentTargets: 5,
                retryAttempts: 3,
                advanceNoticeHours: 24,
                enableRiskManagement: true,
                enablePerformanceTracking: true,
                enableTelemetry: false,
                throttleInterval: 1000,
                enableParallelExecution: false,
                maxConcurrentTrades: 3,
                enableSmartRouting: true,
                enableLivePatternFeed: true,
              };
              return { ...baseConfig, ...config };
            },
            validateConfig: (config: any) => {
              console.log("[MockConfigManager] Config validated:", config);
              return config;
            },
            reset: () => console.log("[MockConfigManager] Config reset"),
            export: () => ({
              enabled: true,
              maxPositions: 5,
              maxDailyTrades: 10,
              positionSizeUSDT: 100,
              minConfidence: 80,
            }),
            getStats: () => ({
              activePositions: 0,
              totalTrades: 0,
              isActive: false,
              uptime: 0,
            }),
            updateStats: (stats: any) => {
              console.log("[MockConfigManager] Stats updated:", stats);
            },
          } as any;
        }
      }
      AutoSnipingExecutionEngine.instance = new AutoSnipingExecutionEngine(configManager);
    }
    return AutoSnipingExecutionEngine.instance;
  }

  /**
   * Create instance asynchronously with proper config manager loading
   */
  static async createInstance(configManager?: AutoSnipingConfigManager): Promise<AutoSnipingExecutionEngine> {
    if (!configManager) {
      try {
        const { AutoSnipingConfigManager } = await import('./config-manager');
        configManager = new AutoSnipingConfigManager();
        console.info("[AutoSnipingExecutionEngine] Config manager loaded asynchronously");
      } catch (error) {
        console.error("[AutoSnipingExecutionEngine] Failed to load config manager:", error);
        throw new Error("Failed to initialize AutoSnipingExecutionEngine: config manager unavailable");
      }
    }
    
    return new AutoSnipingExecutionEngine(configManager);
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    AutoSnipingExecutionEngine.instance = null;
  }

  /**
   * Start execution engine
   */
  async start(): Promise<void> {
    if (this.isActive) {
      throw new Error("Execution engine is already active");
    }

    const config = this.configManager.getConfig();

    console.info("Starting auto-sniping execution engine", {
      maxPositions: config.maxPositions,
      minConfidence: config.minConfidence,
      enableAdvanceDetection: config.enableAdvanceDetection,
    });

    // Validate configuration and health
    await this.configManager.validateConfiguration();
    await this.configManager.performHealthChecks();

    this.isActive = true;

    // Start execution interval
    this.executionInterval = setInterval(() => this.executionCycle(), config.throttleInterval);

    // Start monitoring interval
    this.monitoringInterval = setInterval(
      () => this.monitoringCycle(),
      config.throttleInterval * 2
    );

    console.info("Auto-sniping execution engine started successfully");
  }

  /**
   * Stop execution engine
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      return;
    }

    console.info("Stopping auto-sniping execution engine");

    this.isActive = false;

    // Clear intervals
    if (this.executionInterval) {
      clearInterval(this.executionInterval);
      this.executionInterval = null;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.info("Auto-sniping execution engine stopped");
  }

  /**
   * Get execution status
   */
  isExecutionActive(): boolean {
    return this.isActive;
  }

  /**
   * Get active positions
   */
  getActivePositions(): ExecutionPosition[] {
    return Array.from(this.activePositions.values());
  }

  /**
   * Execute trading opportunity
   */
  async executeTradingOpportunity(opportunity: TradingOpportunity): Promise<boolean> {
    try {
      const config = this.configManager.getConfig();

      console.info("Executing trading opportunity", {
        symbol: opportunity.symbol,
        confidence: opportunity.confidence,
        patternType: opportunity.patternMatch.patternType,
      });

      // Pre-execution validations
      if (!this.isActive) {
        console.warn("Execution engine is not active");
        return false;
      }

      if (this.activePositions.size >= config.maxPositions) {
        console.warn("Maximum positions reached", {
          active: this.activePositions.size,
          max: config.maxPositions,
        });
        return false;
      }

      if (opportunity.confidence < config.minConfidence) {
        console.warn("Opportunity confidence below threshold", {
          confidence: opportunity.confidence,
          threshold: config.minConfidence,
        });
        return false;
      }

      // Execute the trade
      const result = await this.executeMarketOrder(opportunity);

      if (result.success && result.executedPrice && result.executedQuantity) {
        // Create position record
        const position: ExecutionPosition = {
          id: uuidv4(),
          symbol: opportunity.symbol,
          status: "ACTIVE",
          entryPrice: result.executedPrice,
          quantity: result.executedQuantity,
          timestamp: new Date().toISOString(),
          stopLossPrice: this.calculateStopLossPrice(
            result.executedPrice,
            config.stopLossPercentage
          ),
          takeProfitPrice: this.calculateTakeProfitPrice(
            result.executedPrice,
            config.takeProfitPercentage
          ),
          patternData: {
            symbol: opportunity.symbol,
            patternType: opportunity.patternMatch.patternType,
            confidence: opportunity.patternMatch.confidence,
            timestamp: new Date().toISOString(),
            riskLevel: opportunity.patternMatch.riskLevel,
            advanceNoticeHours: opportunity.patternMatch.advanceNoticeHours,
          },
          executionMetadata: {
            confidence: opportunity.confidence,
            executionLatency: result.executionLatency || 0,
            slippage: result.slippage || 0,
            orderType: "MARKET",
          },
        };

        // Validate position before storing
        const validatedPosition = ExecutionPositionSchema.parse(position);
        this.activePositions.set(validatedPosition.id, validatedPosition);

        // Update statistics
        const stats = this.configManager.getStats();
        this.configManager.updateStats({
          activePositions: this.activePositions.size,
          totalTrades: stats.totalTrades + 1,
        });

        console.info("Position created successfully", {
          positionId: validatedPosition.id,
          symbol: opportunity.symbol,
          entryPrice: result.executedPrice,
          quantity: result.executedQuantity,
        });

        return true;
      } else {
        console.error("Trade execution failed", {
          symbol: opportunity.symbol,
          error: result.error,
        });
        return false;
      }
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("Failed to execute trading opportunity", {
        symbol: opportunity.symbol,
        error: safeError.message,
      });
      return false;
    }
  }

  /**
   * Main execution cycle
   */
  private async executionCycle(): Promise<void> {
    try {
      if (!this.isActive) return;

      // Fetch and process trading opportunities
      const opportunities = await this.fetchTradingOpportunities();

      if (opportunities.length === 0) {
        return;
      }

      console.info(`Processing ${opportunities.length} trading opportunities`);

      // Process opportunities in parallel if enabled
      const config = this.configManager.getConfig();
      if (config.enableParallelExecution) {
        await this.processOpportunitiesParallel(opportunities);
      } else {
        await this.processOpportunitiesSequential(opportunities);
      }
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("Execution cycle error", {
        error: safeError.message,
      });
    }
  }

  /**
   * Position monitoring cycle
   */
  private async monitoringCycle(): Promise<void> {
    try {
      if (!this.isActive || this.activePositions.size === 0) return;

      console.info(`Monitoring ${this.activePositions.size} active positions`);

      // Monitor each active position
      for (const [positionId, position] of this.activePositions) {
        await this.monitorPosition(positionId, position);
      }
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("Monitoring cycle error", {
        error: safeError.message,
      });
    }
  }

  /**
   * Process opportunities sequentially
   */
  private async processOpportunitiesSequential(opportunities: TradingOpportunity[]): Promise<void> {
    for (const opportunity of opportunities) {
      try {
        await this.executeTradingOpportunity(opportunity);

        // Small delay between executions to prevent API rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        const safeError = toSafeError(error);
        console.error("Error processing opportunity", {
          symbol: opportunity.symbol,
          error: safeError.message,
        });
      }
    }
  }

  /**
   * Process opportunities in parallel
   */
  private async processOpportunitiesParallel(opportunities: TradingOpportunity[]): Promise<void> {
    const config = this.configManager.getConfig();
    const maxConcurrent = Math.min(config.maxConcurrentTrades, opportunities.length);

    // Process in batches
    for (let i = 0; i < opportunities.length; i += maxConcurrent) {
      const batch = opportunities.slice(i, i + maxConcurrent);

      await Promise.allSettled(
        batch.map((opportunity) => this.executeTradingOpportunity(opportunity))
      );

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  /**
   * Fetch trading opportunities from pattern detection
   */
  private async fetchTradingOpportunities(): Promise<TradingOpportunity[]> {
    try {
      // Simulated pattern detection API call
      // In real implementation, this would call the pattern detection service
      return [];
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("Failed to fetch trading opportunities", {
        error: safeError.message,
      });
      return [];
    }
  }

  /**
   * Execute market order
   */
  private async executeMarketOrder(opportunity: TradingOpportunity): Promise<ExecutionResult> {
    try {
      const config = this.configManager.getConfig();
      const startTime = Date.now();

      // Simulated MEXC API call
      // In real implementation, this would call MEXC trading API
      const executionLatency = Date.now() - startTime;

      return {
        success: true,
        executedPrice: 1.0, // Simulated
        executedQuantity: config.positionSizeUSDT, // Simulated
        executionLatency,
        slippage: 0.1, // Simulated
      };
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        success: false,
        error: safeError.message,
      };
    }
  }

  /**
   * Monitor individual position
   */
  private async monitorPosition(positionId: string, position: ExecutionPosition): Promise<void> {
    try {
      // Simulated position monitoring
      // In real implementation, this would:
      // 1. Fetch current price
      // 2. Check stop loss/take profit triggers
      // 3. Update position status
      // 4. Execute exit orders if needed

      console.debug("Monitoring position", {
        positionId,
        symbol: position.symbol,
        status: position.status,
      });
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("Position monitoring error", {
        positionId,
        error: safeError.message,
      });
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

  /**
   * Get current configuration
   */
  getConfig(): AutoSnipingConfig {
    return this.configManager.getConfig();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AutoSnipingConfig>): AutoSnipingConfig {
    this.configManager.updateConfig(config);
    return this.configManager.getConfig();
  }

  /**
   * Check if the engine is ready for trading
   */
  isReadyForTrading(): boolean {
    try {
      const config = this.configManager.getConfig();
      return this.isActive && 
             config.enabled && 
             this.activePositions.size < config.maxPositions;
    } catch (error) {
      console.error("[AutoSnipingExecutionEngine] Error checking trading readiness:", error);
      return false;
    }
  }

  /**
   * Validate configuration
   */
  async validateConfiguration(): Promise<boolean> {
    try {
      if (typeof this.configManager.validateConfiguration === 'function') {
        await this.configManager.validateConfiguration();
        return true;
      }
      // Fallback validation for mock config manager
      const config = this.configManager.getConfig();
      return config && typeof config === 'object' && config.enabled !== undefined;
    } catch (error) {
      console.error("[AutoSnipingExecutionEngine] Configuration validation failed:", error);
      return false;
    }
  }

  /**
   * Perform health checks
   */
  async performHealthChecks(): Promise<boolean> {
    try {
      if (typeof this.configManager.performHealthChecks === 'function') {
        await this.configManager.performHealthChecks();
        return true;
      }
      // Fallback health check for mock config manager
      return this.isActive && this.configManager !== null;
    } catch (error) {
      console.error("[AutoSnipingExecutionEngine] Health check failed:", error);
      return false;
    }
  }

  /**
   * Get execution statistics
   */
  getStats(): any {
    try {
      let stats;
      if (typeof this.configManager.getStats === 'function') {
        stats = this.configManager.getStats();
      } else {
        // Fallback stats for mock config manager
        stats = {
          totalTrades: 0,
          successfulTrades: 0,
          totalPnl: 0,
          totalVolume: 0,
          winRate: 0,
          averageTradeReturn: 0,
          maxDrawdown: 0,
          currentDrawdown: 0,
          averageExecutionTime: 0,
          averageSlippage: 0,
          activePositions: this.activePositions.size,
          dailyTradeCount: 0,
          patternSuccessRates: {},
          averagePatternConfidence: 0,
          mostSuccessfulPattern: null,
          successRate: 0,
          errorCount: 0,
          totalExecutions: 0,
          successCount: 0,
        };
      }
      
      // Calculate dynamic fields
      const totalExecutions = stats.totalTrades || 0;
      const successCount = stats.successfulTrades || 0;
      const errorCount = totalExecutions - successCount;
      const successRate = totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0;

      // Add engine state information to stats
      return {
        ...stats,
        isActive: this.isActive,
        activePositions: this.activePositions.size, // Override with current value
        uptime: this.isActive ? Date.now() : 0,
        totalExecutions,
        successCount,
        errorCount,
        successRate,
      };
    } catch (error) {
      console.error("[AutoSnipingExecutionEngine] Error getting stats:", error);
      return {
        activePositions: 0,
        totalTrades: 0,
        isActive: false,
        uptime: 0,
        successfulTrades: 0,
        totalPnl: 0,
        totalVolume: 0,
        winRate: 0,
        averageTradeReturn: 0,
        maxDrawdown: 0,
        currentDrawdown: 0,
        averageExecutionTime: 0,
        averageSlippage: 0,
        dailyTradeCount: 0,
        patternSuccessRates: {},
        averagePatternConfidence: 0,
        mostSuccessfulPattern: null,
        successRate: 0,
        errorCount: 0,
        totalExecutions: 0,
        successCount: 0,
      };
    }
  }

  /**
   * Update execution statistics
   */
  updateStats(stats: any): void {
    try {
      if (typeof this.configManager.updateStats === 'function') {
        this.configManager.updateStats(stats);
      }
      // For mock config manager, just log the update
      console.debug("[AutoSnipingExecutionEngine] Stats updated:", stats);
    } catch (error) {
      console.error("[AutoSnipingExecutionEngine] Error updating stats:", error);
    }
  }

  /**
   * Stop execution - alias for stop() method for backward compatibility
   */
  stopExecution(): Promise<void> {
    return this.stop();
  }

  /**
   * Get execution report for monitoring and debugging
   */
  async getExecutionReport(): Promise<{
    status: string;
    stats: any;
    activePositions: any[];
    config: any;
    health: any;
    systemHealth: any;
    totalProfit: number;
    successRate: number;
    successCount: number;
    errorCount: number;
    totalTrades: number;
    activeTargets: number;
    readyTargets: number;
    executedToday: number;
    lastExecution: string;
    safetyStatus: string;
    patternDetectionActive: boolean;
    executionCount: number;
    uptime: number;
  }> {
    try {
      const stats = this.getStats();
      const config = this.getConfig();
      const activePositions = this.getActivePositions();
      
      // Get health status
      let health = { overall: 'unknown', apiConnection: false, patternEngine: false };
      try {
        if (typeof this.configManager.performHealthChecks === 'function') {
          health = await this.configManager.performHealthChecks();
          health.overall = Object.values(health).every(v => v) ? 'healthy' : 'degraded';
        }
      } catch (error) {
        console.warn("[AutoSnipingExecutionEngine] Health check failed in report:", error);
        health.overall = 'error';
      }

      const status = this.isActive ? 'active' : 'idle';

      return {
        status,
        stats,
        activePositions,
        config,
        health,
        systemHealth: health,  // Add alias for systemHealth for backward compatibility
        
        // Flatten commonly used fields for API compatibility
        totalProfit: stats.totalPnl || 0,
        successRate: stats.successRate || 0,
        successCount: stats.successCount || 0,
        errorCount: stats.errorCount || 0,
        totalTrades: stats.totalTrades || 0,
        activeTargets: this.activePositions.size,
        readyTargets: 0, // Would need to be calculated from pattern detection
        executedToday: stats.dailyTradeCount || 0,
        lastExecution: new Date().toISOString(),
        safetyStatus: health.overall === 'healthy' ? 'safe' : 'warning',
        patternDetectionActive: true,
        executionCount: stats.totalExecutions || 0,
        uptime: this.isActive ? Date.now() : 0,
      };
    } catch (error) {
      console.error("[AutoSnipingExecutionEngine] Error generating execution report:", error);
      const errorHealth = { overall: 'error' };
      const fallbackStats = this.getStats();
      return {
        status: 'error',
        stats: fallbackStats,
        activePositions: [],
        config: {},
        health: errorHealth,
        systemHealth: errorHealth,
        
        // Flatten commonly used fields for API compatibility
        totalProfit: 0,
        successRate: 0,
        successCount: 0,
        errorCount: 0,
        totalTrades: 0,
        activeTargets: 0,
        readyTargets: 0,
        executedToday: 0,
        lastExecution: new Date().toISOString(),
        safetyStatus: 'error',
        patternDetectionActive: false,
        executionCount: 0,
        uptime: 0,
      };
    }
  }

  /**
   * Start execution - alias for start() method for backward compatibility
   */
  startExecution(): Promise<void> {
    return this.start();
  }

  /**
   * Check if execution is currently active
   */
  getExecutionStatus(): { isActive: boolean; status: string } {
    return {
      isActive: this.isActive,
      status: this.isActive ? 'active' : 'idle'
    };
  }
}
