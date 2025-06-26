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

export class OptimizedAutoSnipingCore {
  private static instance: OptimizedAutoSnipingCore | null = null;

  private configManager: AutoSnipingConfigManager;
  private executionEngine: AutoSnipingExecutionEngine;
  private alertManager: AutoSnipingAlertManager;

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
          startTime: new Date().toISOString(),
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
