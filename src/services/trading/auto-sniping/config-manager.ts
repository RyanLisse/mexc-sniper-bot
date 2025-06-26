/**
 * Auto-Sniping Configuration Manager
 *
 * Handles configuration validation, defaults, and system health checks.
 * Extracted from optimized-auto-sniping-core.ts for modularity.
 */

import {
  type AutoSnipingConfig,
  AutoSnipingConfigSchema,
  type ExecutionStats,
  ExecutionStatsSchema,
  type SystemHealth,
} from "./schemas";

export class AutoSnipingConfigManager {
  private config: AutoSnipingConfig;
  private stats: ExecutionStats;

  constructor(initialConfig?: Partial<AutoSnipingConfig>) {
    this.config = AutoSnipingConfigSchema.parse({
      ...this.getDefaultConfig(),
      ...initialConfig,
    });

    this.stats = ExecutionStatsSchema.parse(this.getDefaultStats());
  }

  /**
   * Get current configuration
   */
  getConfig(): AutoSnipingConfig {
    return { ...this.config };
  }

  /**
   * Update configuration with validation
   */
  updateConfig(updates: Partial<AutoSnipingConfig>): void {
    this.config = AutoSnipingConfigSchema.parse({
      ...this.config,
      ...updates,
    });

    console.info("Auto-sniping configuration updated", {
      updates,
      newConfig: this.config,
    });
  }

  /**
   * Get current statistics
   */
  getStats(): ExecutionStats {
    return { ...this.stats };
  }

  /**
   * Update statistics
   */
  updateStats(updates: Partial<ExecutionStats>): void {
    this.stats = ExecutionStatsSchema.parse({
      ...this.stats,
      ...updates,
    });
  }

  /**
   * Reset statistics to defaults
   */
  resetStats(): void {
    this.stats = ExecutionStatsSchema.parse(this.getDefaultStats());
  }

  /**
   * Validate current configuration
   */
  async validateConfiguration(): Promise<void> {
    // Validate core configuration
    AutoSnipingConfigSchema.parse(this.config);

    // Business logic validations
    if (this.config.stopLossPercentage >= this.config.takeProfitPercentage) {
      throw new Error("Stop loss percentage must be less than take profit percentage");
    }

    if (this.config.maxPositions > 50) {
      throw new Error("Maximum positions cannot exceed 50 for risk management");
    }

    if (this.config.positionSizeUSDT > 10000) {
      throw new Error("Position size cannot exceed $10,000 for risk management");
    }

    // Advanced validations
    if (this.config.enableAdvanceDetection && this.config.advanceNoticeHours < 1) {
      throw new Error("Advance detection requires at least 1 hour notice");
    }

    if (
      this.config.enableParallelExecution &&
      this.config.maxConcurrentTrades > this.config.maxPositions
    ) {
      throw new Error("Max concurrent trades cannot exceed max positions");
    }

    console.info("Configuration validation passed", {
      enabled: this.config.enabled,
      maxPositions: this.config.maxPositions,
      positionSize: this.config.positionSizeUSDT,
    });
  }

  /**
   * Perform comprehensive system health checks
   */
  async performHealthChecks(): Promise<SystemHealth> {
    const health: SystemHealth = {
      apiConnection: false,
      patternEngine: false,
      safetySystem: false,
      riskLimits: false,
    };

    try {
      // Check API connectivity
      health.apiConnection = await this.checkApiConnection();

      // Check pattern detection engine
      health.patternEngine = await this.checkPatternEngine();

      // Check safety systems
      health.safetySystem = await this.checkSafetySystem();

      // Check risk limits
      health.riskLimits = await this.checkRiskLimits();

      const allHealthy = Object.values(health).every((status) => status);

      if (!allHealthy) {
        console.warn("System health check failed", health);
        throw new Error(`System health check failed: ${JSON.stringify(health)}`);
      }

      console.info("System health check passed", health);
      return health;
    } catch (error) {
      console.error("Health check error", {
        error: error instanceof Error ? error.message : "Unknown error",
        health,
      });
      throw error;
    }
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): AutoSnipingConfig {
    return {
      enabled: true,
      maxPositions: 5,
      maxDailyTrades: 10,
      positionSizeUSDT: 10,
      minConfidence: 80,
      allowedPatternTypes: ["ready_state"],
      requireCalendarConfirmation: true,
      stopLossPercentage: 5,
      takeProfitPercentage: 10,
      maxDrawdownPercentage: 20,
      enableAdvanceDetection: false,
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
  }

  /**
   * Get default statistics
   */
  private getDefaultStats(): ExecutionStats {
    return {
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
      activePositions: 0,
      dailyTradeCount: 0,
      patternSuccessRates: {},
      averagePatternConfidence: 0,
      mostSuccessfulPattern: null,
    };
  }

  /**
   * Check API connection health
   */
  private async checkApiConnection(): Promise<boolean> {
    try {
      // Simulate API connectivity check
      // In real implementation, this would check MEXC API connectivity
      return true;
    } catch (error) {
      console.error("API connection check failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }

  /**
   * Check pattern detection engine health
   */
  private async checkPatternEngine(): Promise<boolean> {
    try {
      // Simulate pattern engine health check
      // In real implementation, this would verify pattern detection service
      return true;
    } catch (error) {
      console.error("Pattern engine check failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }

  /**
   * Check safety system health
   */
  private async checkSafetySystem(): Promise<boolean> {
    try {
      // Simulate safety system check
      // In real implementation, this would verify circuit breakers and safety monitors
      return true;
    } catch (error) {
      console.error("Safety system check failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }

  /**
   * Check risk management limits
   */
  private async checkRiskLimits(): Promise<boolean> {
    try {
      // Check if current positions are within risk limits
      if (this.stats.activePositions >= this.config.maxPositions) {
        console.warn("Active positions at maximum limit", {
          active: this.stats.activePositions,
          max: this.config.maxPositions,
        });
        return false;
      }

      if (this.stats.currentDrawdown >= this.config.maxDrawdownPercentage) {
        console.warn("Current drawdown exceeds maximum", {
          current: this.stats.currentDrawdown,
          max: this.config.maxDrawdownPercentage,
        });
        return false;
      }

      if (this.stats.dailyTradeCount >= this.config.maxDailyTrades) {
        console.warn("Daily trade limit reached", {
          current: this.stats.dailyTradeCount,
          max: this.config.maxDailyTrades,
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error("Risk limits check failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }
}
