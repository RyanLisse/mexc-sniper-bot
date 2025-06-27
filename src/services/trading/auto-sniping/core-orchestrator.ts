/**
 * Auto-Sniping Core Orchestrator
 *
 * Main orchestrator that coordinates all auto-sniping modules.
 * This replaces the original optimized-auto-sniping-core.ts monolithic approach.
 */

import { AutoSnipingAlertManager } from "./alert-manager";
import { AutoSnipingConfigManager } from "./config-manager";
import { AutoSnipingExecutionEngine } from "./execution-engine";
import type {
  AutoSnipingConfig,
  ExecutionAlert,
  ExecutionPosition,
  ExecutionStats,
  ExecutionStatus,
  SystemHealth,
  TradingOpportunity,
} from "./schemas";
import { autoSnipingStateSynchronizer } from "./state-synchronizer";

export class OptimizedAutoSnipingCore {
  private static instance: OptimizedAutoSnipingCore | null = null;

  private configManager: AutoSnipingConfigManager;
  private executionEngine: AutoSnipingExecutionEngine;
  private alertManager: AutoSnipingAlertManager;
  private startTime: Date | null = null;

  private constructor(config?: Partial<AutoSnipingConfig>) {
    // Initialize managers
    this.configManager = new AutoSnipingConfigManager(config);
    this.executionEngine = new AutoSnipingExecutionEngine(this.configManager);
    this.alertManager = new AutoSnipingAlertManager();

    console.info("Optimized Auto-Sniping Core initialized", {
      config: this.configManager.getConfig(),
    });
  }

  /**
   * Singleton instance getter
   */
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
    console.info("Starting optimized auto-sniping execution");

    try {
      // Set start time
      this.startTime = new Date();

      // Validate configuration and health
      await this.configManager.validateConfiguration();
      await this.configManager.performHealthChecks();

      // Start execution engine
      await this.executionEngine.start();

      // Add startup alert
      this.alertManager.addAlert({
        type: "position_opened", // Using existing type for startup
        severity: "info",
        message: "Auto-sniping execution started successfully",
        details: {
          startTime: this.startTime.toISOString(),
          config: JSON.stringify(this.configManager.getConfig()),
        },
      });

      console.info("Auto-sniping execution started successfully");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      this.alertManager.addAlert({
        type: "execution_error",
        severity: "critical",
        message: `Failed to start auto-sniping execution: ${errorMessage}`,
        details: { error: errorMessage },
      });

      console.error("Failed to start auto-sniping execution", { error: errorMessage });
      throw error;
    }
  }

  /**
   * Stop execution gracefully
   */
  async stopExecution(): Promise<void> {
    console.info("Stopping auto-sniping execution");

    try {
      await this.executionEngine.stop();

      this.alertManager.addAlert({
        type: "position_closed", // Using existing type for shutdown
        severity: "info",
        message: "Auto-sniping execution stopped",
        details: {
          stopTime: new Date().toISOString(),
          finalStats: JSON.stringify(this.configManager.getStats()),
        },
      });

      console.info("Auto-sniping execution stopped successfully");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      this.alertManager.addAlert({
        type: "execution_error",
        severity: "error",
        message: `Error during execution stop: ${errorMessage}`,
        details: { error: errorMessage },
      });

      console.error("Error stopping auto-sniping execution", { error: errorMessage });
      throw error;
    }
  }

  /**
   * Get current execution status
   */
  getExecutionStatus(): ExecutionStatus {
    if (this.executionEngine.isExecutionActive()) {
      return "active";
    }

    if (this.alertManager.hasCriticalIssues()) {
      return "error";
    }

    return "idle";
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
  updateConfig(updates: Partial<AutoSnipingConfig>): void {
    this.configManager.updateConfig(updates);

    this.alertManager.addAlert({
      type: "position_opened", // Using existing type for config changes
      severity: "info",
      message: "Configuration updated",
      details: {
        updates: JSON.stringify(updates),
        newConfig: JSON.stringify(this.configManager.getConfig()),
      },
    });
  }

  /**
   * Get current statistics
   */
  getStats(): ExecutionStats {
    return this.configManager.getStats();
  }

  /**
   * Get active positions
   */
  getActivePositions(): ExecutionPosition[] {
    return this.executionEngine.getActivePositions();
  }

  /**
   * Get alerts
   */
  getAlerts(): ExecutionAlert[] {
    return this.alertManager.getAllAlerts();
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(count?: number): ExecutionAlert[] {
    return this.alertManager.getRecentAlerts(count);
  }

  /**
   * Get unacknowledged alerts
   */
  getUnacknowledgedAlerts(): ExecutionAlert[] {
    return this.alertManager.getUnacknowledgedAlerts();
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): boolean {
    return this.alertManager.acknowledgeAlert(alertId);
  }

  /**
   * Acknowledge multiple alerts
   */
  acknowledgeAlerts(alertIds: string[]): number {
    return this.alertManager.acknowledgeAlerts(alertIds);
  }

  /**
   * Get alert statistics
   */
  getAlertStats() {
    return this.alertManager.getAlertStats();
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(hoursToKeep?: number): number {
    return this.alertManager.clearOldAlerts(hoursToKeep);
  }

  /**
   * Perform health checks
   */
  async performHealthChecks(): Promise<SystemHealth> {
    return this.configManager.performHealthChecks();
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.configManager.resetStats();

    this.alertManager.addAlert({
      type: "position_opened", // Using existing type for stats reset
      severity: "info",
      message: "Statistics reset",
      details: {
        resetTime: new Date().toISOString(),
      },
    });
  }

  /**
   * Manual trading opportunity execution
   */
  async executeTradingOpportunity(opportunity: TradingOpportunity): Promise<boolean> {
    return this.executionEngine.executeTradingOpportunity(opportunity);
  }

  /**
   * Get comprehensive system status
   */
  async getSystemStatus() {
    const config = this.getConfig();
    const stats = this.getStats();
    const alerts = this.getAlertStats();
    const health = await this.performHealthChecks();
    const activePositions = this.getActivePositions();

    return {
      status: this.getExecutionStatus(),
      config,
      stats,
      alerts,
      health,
      activePositions: activePositions.length,
      criticalIssues: this.alertManager.hasCriticalIssues(),
      lastUpdate: new Date().toISOString(),
    };
  }

  /**
   * Export system data for backup/analysis
   */
  exportSystemData() {
    return {
      config: this.getConfig(),
      stats: this.getStats(),
      alerts: this.alertManager.exportAlerts(),
      activePositions: this.getActivePositions(),
      exportTime: new Date().toISOString(),
    };
  }

  /**
   * Get database target count
   */
  async getDatabaseTargetCount(userId?: string): Promise<number> {
    try {
      return await autoSnipingStateSynchronizer.getDatabaseTargetCount(userId);
    } catch (error) {
      console.error("Failed to get database target count:", error);
      return 0;
    }
  }

  /**
   * Get unified target count that checks both database and memory
   */
  async getUnifiedTargetCount(userId?: string): Promise<{
    memoryCount: number;
    databaseCount: number;
    unifiedCount: number;
    isConsistent: boolean;
    source: "memory" | "database" | "consistent";
    warning?: string;
  }> {
    try {
      const activePositions = this.getActivePositions();
      const result = await autoSnipingStateSynchronizer.getUnifiedTargetCount(
        activePositions,
        userId
      );

      let warning: string | undefined;
      if (!result.isConsistent) {
        warning = `State inconsistency detected: Memory=${result.memoryCount}, Database=${result.databaseCount}. Using ${result.source} count.`;

        this.alertManager.addAlert({
          type: "execution_error",
          severity: "warning",
          message: "Target count inconsistency detected",
          details: {
            memoryCount: result.memoryCount,
            databaseCount: result.databaseCount,
            source: result.source,
            recommendation: "Consider running state synchronization",
          },
        });
      }

      return { ...result, warning };
    } catch (error) {
      console.error("Failed to get unified target count:", error);
      const activePositions = this.getActivePositions();
      return {
        memoryCount: activePositions.length,
        databaseCount: 0,
        unifiedCount: activePositions.length,
        isConsistent: false,
        source: "memory",
        warning: "Failed to check database, using memory count only",
      };
    }
  }

  /**
   * Check state consistency between memory and database
   */
  async checkStateConsistency(userId?: string) {
    try {
      const activePositions = this.getActivePositions();
      return await autoSnipingStateSynchronizer.checkStateConsistency(activePositions, userId);
    } catch (error) {
      console.error("Failed to check state consistency:", error);
      return {
        databaseTargetCount: 0,
        memoryTargetCount: this.getActivePositions().length,
        isConsistent: false,
        inconsistencies: ["Failed to check database state"],
        recommendedActions: ["Check database connectivity"],
        lastSyncTime: "Never",
      };
    }
  }

  /**
   * Synchronize state between memory and database
   */
  async synchronizeState(
    options?: {
      syncDirection?: "memory-to-db" | "db-to-memory" | "bidirectional";
      dryRun?: boolean;
      forceSync?: boolean;
    },
    userId?: string
  ) {
    try {
      const activePositions = this.getActivePositions();
      const result = await autoSnipingStateSynchronizer.synchronizeState(
        activePositions,
        options,
        userId
      );

      if (result.success) {
        this.alertManager.addAlert({
          type: "position_opened",
          severity: "info",
          message: `State synchronization completed: ${result.syncedTargets} targets synced`,
          details: {
            syncedTargets: result.syncedTargets,
            consistencyReport: result.consistencyReport,
          },
        });
      } else {
        this.alertManager.addAlert({
          type: "execution_error",
          severity: "error",
          message: "State synchronization failed",
          details: {
            errors: result.errors,
            consistencyReport: result.consistencyReport,
          },
        });
      }

      return result;
    } catch (error) {
      console.error("Failed to synchronize state:", error);
      return {
        success: false,
        syncedTargets: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
        consistencyReport: await this.checkStateConsistency(userId),
      };
    }
  }

  /**
   * Get execution report with unified target counts
   */
  async getExecutionReport() {
    const stats = this.getStats();
    const config = this.getConfig();
    const activePositions = this.getActivePositions();
    const alerts = this.getAlertStats();

    // Get unified target count for consistent reporting
    const unifiedTargetData = await this.getUnifiedTargetCount();
    const consistencyReport = await this.checkStateConsistency();

    return {
      status: this.getExecutionStatus(),
      activePositions: activePositions,
      activePositionsCount: activePositions.length,
      totalTrades: stats.totalTrades || 0,
      successfulTrades: stats.successfulTrades || 0,
      totalPnl: stats.totalPnl || 0,
      successRate: stats.totalTrades > 0 ? (stats.successfulTrades / stats.totalTrades) * 100 : 0,

      // Enhanced target count information
      targetCounts: {
        memory: unifiedTargetData.memoryCount,
        database: unifiedTargetData.databaseCount,
        unified: unifiedTargetData.unifiedCount,
        isConsistent: unifiedTargetData.isConsistent,
        source: unifiedTargetData.source,
        warning: unifiedTargetData.warning,
      },

      // State consistency information
      stateConsistency: {
        isConsistent: consistencyReport.isConsistent,
        inconsistencies: consistencyReport.inconsistencies,
        recommendedActions: consistencyReport.recommendedActions,
        lastSyncTime: consistencyReport.lastSyncTime,
      },

      // Additional properties expected by API routes
      recentExecutions: [],
      activeAlerts: alerts.unacknowledged || 0,
      stats: {
        totalExecutions: stats.totalTrades || 0,
        successCount: stats.successfulTrades || 0,
        errorCount: (stats.totalTrades || 0) - (stats.successfulTrades || 0),
        totalPnl: stats.totalPnl || 0,
        dailyTradeCount: stats.dailyTrades || 0,
      },
      systemHealth: "healthy", // Will be updated to dynamic health check in future enhancement

      // Status report properties - use unified count for consistency
      activeTargets: unifiedTargetData.unifiedCount,
      readyTargets: this.getActivePositions().filter((p) => p.status === "ready").length,
      executedToday: stats.dailyTrades || 0,
      lastExecution: this.getLastExecutionTime(),
      safetyStatus: this.alertManager.hasCriticalIssues() ? "warning" : "safe",
      patternDetectionActive: this.getExecutionStatus() === "active",
      executionCount: stats.totalTrades || 0,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,

      // Additional API compatibility fields
      totalProfit: stats.totalPnl || 0,
      successCount: stats.successfulTrades || 0,
      errorCount: (stats.totalTrades || 0) - (stats.successfulTrades || 0),

      config: {
        enabled: config.enabled,
        maxPositions: config.maxPositions,
        minConfidence: config.minConfidence,
        maxConcurrentTargets: config.maxConcurrentTrades || 5,
        retryAttempts: config.retryAttempts || 3,
        executionDelay: config.executionDelay || 1000,
      },
      alerts: {
        total: alerts.total,
        unacknowledged: alerts.unacknowledged,
        critical: alerts.critical,
      },
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get last execution time
   */
  private getLastExecutionTime(): string | null {
    const positions = this.getActivePositions();
    if (positions.length === 0) return null;

    const lastPosition = positions.sort(
      (a, b) => new Date(b.entryTime || 0).getTime() - new Date(a.entryTime || 0).getTime()
    )[0];

    return lastPosition?.entryTime || null;
  }

  /**
   * Check if system is ready for trading
   */
  isReadyForTrading(): boolean {
    const config = this.getConfig();
    const activePositions = this.getActivePositions();

    return (
      config.enabled &&
      activePositions.length < config.maxPositions &&
      !this.alertManager.hasCriticalIssues() &&
      this.executionEngine.isExecutionActive()
    );
  }

  /**
   * Pause execution
   */
  async pauseExecution(): Promise<void> {
    console.info("Pausing auto-sniping execution");

    await this.executionEngine.stop();

    this.alertManager.addAlert({
      type: "execution_error",
      severity: "warning",
      message: "Execution paused by user",
      details: {
        pauseTime: new Date().toISOString(),
      },
    });
  }

  /**
   * Resume execution
   */
  async resumeExecution(): Promise<void> {
    console.info("Resuming auto-sniping execution");

    await this.executionEngine.start();

    this.alertManager.addAlert({
      type: "position_opened",
      severity: "info",
      message: "Execution resumed by user",
      details: {
        resumeTime: new Date().toISOString(),
      },
    });
  }

  /**
   * Close specific position
   */
  async closePosition(positionId: string): Promise<boolean> {
    console.info("Closing position", { positionId });

    try {
      // Find the position in our active positions
      const activePositions = this.getActivePositions();
      const position = activePositions.find((p) => p.id === positionId);

      if (!position) {
        throw new Error(`Position ${positionId} not found in active positions`);
      }

      // Request closure through the execution engine
      const closureResult = await this.executionEngine.closePosition(positionId);

      if (closureResult) {
        this.alertManager.addAlert({
          type: "position_closed",
          severity: "info",
          message: `Position ${positionId} closed manually`,
          details: {
            positionId,
            symbol: position.symbol,
            closeTime: new Date().toISOString(),
            closePrice: position.currentPrice,
            pnl: position.unrealizedPnl || 0,
          },
        });

        return true;
      } else {
        throw new Error("Position closure failed - execution engine returned false");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      this.alertManager.addAlert({
        type: "execution_error",
        severity: "error",
        message: `Failed to close position ${positionId}: ${errorMessage}`,
        details: { positionId, error: errorMessage },
      });

      return false;
    }
  }

  /**
   * Emergency close all positions
   */
  async emergencyCloseAll(): Promise<{ success: number; failed: number; errors: string[] }> {
    console.info("Emergency closing all positions");

    const activePositions = this.getActivePositions();
    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (const position of activePositions) {
      try {
        const success = await this.closePosition(position.id);
        if (success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push(`Failed to close position ${position.id}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        results.failed++;
        results.errors.push(`Error closing position ${position.id}: ${errorMessage}`);
      }
    }

    this.alertManager.addAlert({
      type: "execution_error",
      severity: "critical",
      message: `Emergency closure completed: ${results.success} success, ${results.failed} failed`,
      details: {
        results,
        emergencyTime: new Date().toISOString(),
      },
    });

    return results;
  }

  /**
   * Clear acknowledged alerts
   */
  clearAcknowledgedAlerts(): number {
    return this.alertManager.clearAcknowledgedAlerts();
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    console.info("Cleaning up auto-sniping core resources");

    try {
      await this.stopExecution();
      this.alertManager.clearOldAlerts(1); // Clear all but last hour
      console.info("Auto-sniping core cleanup completed");
    } catch (error) {
      console.error("Error during cleanup", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

// Export factory function for backward compatibility
export function createOptimizedAutoSnipingCore(
  config?: Partial<AutoSnipingConfig>
): OptimizedAutoSnipingCore {
  return OptimizedAutoSnipingCore.getInstance(config);
}

export { AutoSnipingAlertManager } from "./alert-manager";
export { AutoSnipingConfigManager } from "./config-manager";
export { AutoSnipingExecutionEngine } from "./execution-engine";
// Export all types and schemas for external use
export * from "./schemas";
