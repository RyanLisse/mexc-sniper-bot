/**
 * Alert Management Module
 *
 * Provides comprehensive alert management functionality including alert generation,
 * acknowledgment, auto-action execution, and alert lifecycle management.
 *
 * Part of the modular refactoring of real-time-safety-monitoring-service.ts
 */

import type {
  SafetyAction,
  SafetyAlert,
  SafetyConfiguration,
} from "@/src/schemas/safety-monitoring-schemas";
import { validateSafetyAction, validateSafetyAlert } from "@/src/schemas/safety-monitoring-schemas";
import type { OptimizedAutoSnipingExecutionEngine } from "@/src/services/trading/optimized-auto-sniping-execution-engine";

export interface AlertManagementConfig {
  configuration: SafetyConfiguration;
  executionService: OptimizedAutoSnipingExecutionEngine;
  onStatsUpdate?: (stats: { alertsGenerated: number; actionsExecuted: number }) => void;
}

export interface AlertGenerationData {
  type: SafetyAlert["type"];
  severity: SafetyAlert["severity"];
  category: SafetyAlert["category"];
  title: string;
  message: string;
  riskLevel: number;
  source: string;
  autoActions?: {
    type: SafetyAction["type"];
    description: string;
  }[];
  metadata?: Record<string, any>;
}

export interface AlertStatistics {
  total: number;
  byType: Record<SafetyAlert["type"], number>;
  bySeverity: Record<SafetyAlert["severity"], number>;
  acknowledged: number;
  unacknowledged: number;
  withAutoActions: number;
}

export class AlertManagement {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[alert-management]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[alert-management]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[alert-management]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[alert-management]", message, context || ""),
  };
  private alerts: SafetyAlert[] = [];
  private recentActions: SafetyAction[] = [];
  private stats = {
    alertsGenerated: 0,
    actionsExecuted: 0,
  };

  constructor(private config: AlertManagementConfig) {
    console.info("Alert management initialized", {
      operation: "initialization",
      autoActionEnabled: config.configuration.autoActionEnabled,
      alertRetentionHours: config.configuration.alertRetentionHours,
    });
  }

  /**
   * Generate a new safety alert
   */
  public addAlert(alertData: AlertGenerationData): SafetyAlert {
    const processedAutoActions = (alertData.autoActions || []).map((action) => {
      return {
        id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: action.type,
        description: action.description,
        executed: false,
        metadata: {},
      } as SafetyAction;
    });

    const alert: SafetyAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      metadata: alertData.metadata || {},
      ...alertData,
      autoActions: processedAutoActions,
    };

    // Validate the alert structure
    const validatedAlert = validateSafetyAlert(alert);

    this.alerts.push(validatedAlert);
    this.stats.alertsGenerated++;

    // Execute auto-actions if enabled
    if (this.config.configuration.autoActionEnabled && validatedAlert.autoActions.length > 0) {
      this.executeAutoActions(validatedAlert.autoActions).catch((error) => {
        console.error(
          "Auto-action execution failed",
          {
            operation: "execute_auto_actions",
            alertId: validatedAlert.id,
            alertType: validatedAlert.type,
            alertSeverity: validatedAlert.severity,
            actionsCount: validatedAlert.autoActions.length,
          },
          error
        );
      });
    }

    // Update statistics
    if (this.config.onStatsUpdate) {
      this.config.onStatsUpdate({
        alertsGenerated: this.stats.alertsGenerated,
        actionsExecuted: this.stats.actionsExecuted,
      });
    }
    return validatedAlert;
  }

  /**
   * Acknowledge a safety alert
   */
  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);

    if (!alert) {
      console.warn("Alert not found for acknowledgment", {
        operation: "acknowledge_alert",
        alertId,
        totalAlerts: this.alerts.length,
      });
      return false;
    }

    if (alert.acknowledged) {
      console.warn("Alert already acknowledged", {
        operation: "acknowledge_alert",
        alertId,
        alertType: alert.type,
        acknowledgedAt: alert.timestamp,
      });
      return true;
    }

    alert.acknowledged = true;
    console.info("Alert acknowledged", {
      operation: "acknowledge_alert",
      alertId,
      alertType: alert.type,
      alertSeverity: alert.severity,
      acknowledgedAt: new Date().toISOString(),
    });
    return true;
  }

  /**
   * Clear acknowledged alerts
   */
  public clearAcknowledgedAlerts(): number {
    const countBefore = this.alerts.length;
    this.alerts = this.alerts.filter((alert) => !alert.acknowledged);
    const cleared = countBefore - this.alerts.length;
    console.info("Acknowledged alerts cleared", {
      operation: "clear_acknowledged_alerts",
      clearedCount: cleared,
      remainingAlerts: this.alerts.length,
    });
    return cleared;
  }

  /**
   * Get all alerts (optionally filtered)
   */
  public getAlerts(filter?: {
    acknowledged?: boolean;
    severity?: SafetyAlert["severity"];
    type?: SafetyAlert["type"];
    category?: SafetyAlert["category"];
  }): SafetyAlert[] {
    let filteredAlerts = [...this.alerts];

    if (filter) {
      if (filter.acknowledged !== undefined) {
        filteredAlerts = filteredAlerts.filter(
          (alert) => alert.acknowledged === filter.acknowledged
        );
      }
      if (filter.severity) {
        filteredAlerts = filteredAlerts.filter((alert) => alert.severity === filter.severity);
      }
      if (filter.type) {
        filteredAlerts = filteredAlerts.filter((alert) => alert.type === filter.type);
      }
      if (filter.category) {
        filteredAlerts = filteredAlerts.filter((alert) => alert.category === filter.category);
      }
    }

    return filteredAlerts;
  }

  /**
   * Get active (unacknowledged) alerts
   */
  public getActiveAlerts(): SafetyAlert[] {
    return this.alerts.filter((alert) => !alert.acknowledged);
  }

  /**
   * Get recent actions
   */
  public getRecentActions(limit = 10): SafetyAction[] {
    return this.recentActions.slice(-limit);
  }

  /**
   * Get alert statistics
   */
  public getAlertStatistics(): AlertStatistics {
    const stats: AlertStatistics = {
      total: this.alerts.length,
      byType: {} as Record<SafetyAlert["type"], number>,
      bySeverity: {} as Record<SafetyAlert["severity"], number>,
      acknowledged: 0,
      unacknowledged: 0,
      withAutoActions: 0,
    };

    this.alerts.forEach((alert) => {
      // Count by type
      stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;

      // Count by severity
      stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;

      // Count acknowledgment status
      if (alert.acknowledged) {
        stats.acknowledged++;
      } else {
        stats.unacknowledged++;
      }

      // Count alerts with auto actions
      if (alert.autoActions.length > 0) {
        stats.withAutoActions++;
      }
    });

    return stats;
  }

  /**
   * Clean up old alerts based on retention policy
   */
  public cleanupOldAlerts(): number {
    const cutoffTime = Date.now() - this.config.configuration.alertRetentionHours * 60 * 60 * 1000;
    const countBefore = this.alerts.length;

    this.alerts = this.alerts.filter((alert) => {
      const alertTime = new Date(alert.timestamp).getTime();
      // Keep alerts that are either recent OR unacknowledged (regardless of age)
      return alertTime > cutoffTime || !alert.acknowledged;
    });

    const cleaned = countBefore - this.alerts.length;

    if (cleaned > 0) {
      console.info("Old alerts cleaned up", {
        operation: "cleanup_old_alerts",
        cleanedCount: cleaned,
        remainingAlerts: this.alerts.length,
        retentionHours: this.config.configuration.alertRetentionHours,
      });
    }

    return cleaned;
  }

  /**
   * Clear all alerts (for testing)
   */
  public clearAllAlerts(): void {
    const clearedCount = this.alerts.length;
    this.alerts = [];
    this.recentActions = [];

    console.info("All alerts cleared", {
      operation: "clear_all_alerts",
      clearedCount,
    });
  }

  /**
   * Execute auto-actions for an alert
   */
  private async executeAutoActions(actions: SafetyAction[]): Promise<void> {
    for (const action of actions) {
      try {
        await this.executeAction(action);
        this.recentActions.push(action);
        this.stats.actionsExecuted++;
      } catch (error) {
        console.error(
          "Auto-action execution failed",
          {
            operation: "execute_action",
            actionId: action.id,
            actionType: action.type,
            actionDescription: action.description,
          },
          error
        );
      }
    }

    // Update statistics
    if (this.config.onStatsUpdate) {
      this.config.onStatsUpdate({
        alertsGenerated: this.stats.alertsGenerated,
        actionsExecuted: this.stats.actionsExecuted,
      });
    }
  }

  /**
   * Execute a single safety action
   */
  private async executeAction(action: SafetyAction): Promise<void> {
    // Validate action before execution
    validateSafetyAction(action);

    console.info("Executing safety action", {
      operation: "execute_action",
      actionId: action.id,
      actionType: action.type,
      actionDescription: action.description,
    });

    try {
      switch (action.type) {
        case "halt_trading":
          await this.config.executionService.stopExecution();
          action.executed = true;
          action.result = "success";
          action.details = "Trading execution successfully halted";
          break;

        case "emergency_close": {
          const closedCount = await this.config.executionService.emergencyCloseAll();
          const activePositions = this.config.executionService.getActivePositions();
          action.executed = true;
          action.result =
            activePositions.length === 0 || closedCount === activePositions.length
              ? "success"
              : "partial";
          action.details =
            activePositions.length > 0
              ? `Closed ${closedCount}/${activePositions.length} positions`
              : "No positions to close";
          break;
        }

        case "reduce_positions": {
          const positions = this.config.executionService.getActivePositions();
          try {
            const sorted = [...positions].sort(
              (a, b) => Number.parseFloat(String(b.quantity)) - Number.parseFloat(String(a.quantity))
            );
            const count = Math.ceil(positions.length * 0.5);
            let reduced = 0;

            for (let i = 0; i < count; i++) {
              const pos = sorted[i];
              const newSize = Math.floor(Number.parseFloat(String(pos.quantity)) * 0.5);
              if (newSize > 0 && this.config.executionService.updatePositionSize) {
                await this.config.executionService.updatePositionSize(String(pos.id || pos.symbol), newSize);
                reduced++;
              }
            }
            this.setActionResult(
              action,
              reduced > 0 ? "success" : "partial",
              `Reduced ${reduced}/${count} positions by 50%`
            );
          } catch (error) {
            this.setActionResult(
              action,
              "failed",
              `Position reduction failed: ${(error as Error)?.message}`
            );
          }
          break;
        }

        case "limit_exposure": {
          const positions = this.config.executionService.getActivePositions();
          const exposure = positions.reduce(
            (sum: number, pos: any) =>
              sum + Number.parseFloat(pos.quantity) * Number.parseFloat(pos.currentPrice),
            0
          );
          const maxAllowed = this.config.configuration.thresholds.maxPortfolioConcentration * 1000;

          try {
            if (exposure > maxAllowed) {
              const ratio = maxAllowed / exposure;
              let limited = 0;
              for (const pos of positions) {
                const newSize = Math.floor(Number.parseFloat(String(pos.quantity)) * ratio);
                if (newSize > 0 && this.config.executionService.updatePositionSize) {
                  await this.config.executionService.updatePositionSize(String(pos.id || pos.symbol), newSize);
                  limited++;
                }
              }
              this.setActionResult(
                action,
                limited > 0 ? "success" : "partial",
                `Limited ${limited} positions to ${maxAllowed.toFixed(2)} max`
              );
            } else {
              this.setActionResult(
                action,
                "success",
                `Exposure ${exposure.toFixed(2)} within limits`
              );
            }
          } catch (error) {
            this.setActionResult(
              action,
              "failed",
              `Exposure limitation failed: ${(error as Error)?.message}`
            );
          }
          break;
        }

        case "notify_admin": {
          try {
            const data = {
              timestamp: new Date().toISOString(),
              alertId: action.id,
              severity: "high",
              system: "safety-monitoring",
              positions: this.config.executionService.getActivePositions().length,
              message: action.description,
            };
            console.error("[ADMIN_ALERT]", JSON.stringify(data));
            if ((global as any).adminNotificationService) {
              await (global as any).adminNotificationService.sendCriticalAlert(data);
            }
            this.setActionResult(
              action,
              "success",
              `Admin notification sent with alert ID ${action.id}`
            );
          } catch (error) {
            this.setActionResult(
              action,
              "failed",
              `Admin notification failed: ${(error as Error)?.message}`
            );
          }
          break;
        }

        case "circuit_breaker": {
          try {
            if ((this.config.executionService as any).setTradingPaused) {
              await (this.config.executionService as any).setTradingPaused(
                true,
                "circuit_breaker_activated"
              );
            }

            const originalInterval = this.config.configuration.monitoringIntervalMs;
            this.config.configuration.monitoringIntervalMs = 10000;

            console.warn("[CIRCUIT_BREAKER_ACTIVATED]", {
              activationTime: new Date().toISOString(),
              reason: action.description,
            });

            if ((global as any).circuitBreakerState) {
              (global as any).circuitBreakerState = {
                active: true,
                activatedAt: new Date().toISOString(),
                reason: action.description,
                originalMonitoringInterval: originalInterval,
              };
            }
            this.setActionResult(
              action,
              "success",
              "Circuit breaker activated: trading paused, monitoring increased to 10s intervals"
            );
          } catch (error) {
            this.setActionResult(
              action,
              "failed",
              `Circuit breaker activation failed: ${(error as Error)?.message}`
            );
          }
          break;
        }

        default:
          action.executed = false;
          action.result = "failed";
          action.details = `Unsupported action type: ${action.type}`;
      }

      action.executedAt = new Date().toISOString();

      console.info("Safety action executed", {
        operation: "execute_action",
        actionId: action.id,
        actionType: action.type,
        result: action.result,
        details: action.details,
      });
    } catch (error) {
      action.executed = true;
      action.result = "failed";
      action.details = `Execution failed: ${(error as Error)?.message}`;
      action.executedAt = new Date().toISOString();

      console.error(
        "Safety action failed",
        {
          operation: "execute_action",
          actionId: action.id,
          actionType: action.type,
          error: (error as Error)?.message,
        },
        error
      );

      throw error;
    }
  }

  /**
   * Get internal statistics
   */
  public getInternalStats(): { alertsGenerated: number; actionsExecuted: number } {
    return { ...this.stats };
  }

  /**
   * Reset internal statistics (for testing)
   */
  public resetStats(): void {
    this.stats = {
      alertsGenerated: 0,
      actionsExecuted: 0,
    };
  }

  /**
   * Helper method to set action result and reduce code duplication
   */
  private setActionResult(action: SafetyAction, result: "success" | "failed" | "partial", details: string): void {
    action.executed = true;
    action.result = result;
    action.details = details;
    action.executedAt = new Date().toISOString();
  }
}

/**
 * Factory function to create AlertManagement instance
 */
export function createAlertManagement(config: AlertManagementConfig): AlertManagement {
  return new AlertManagement(config);
}
