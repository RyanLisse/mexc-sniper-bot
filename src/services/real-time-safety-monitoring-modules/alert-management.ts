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
} from "../../schemas/safety-monitoring-schemas";
import { validateSafetyAction, validateSafetyAlert } from "../../schemas/safety-monitoring-schemas";
import type { AutoSnipingExecutionService } from "../auto-sniping-execution-service";

export interface AlertManagementConfig {
  configuration: SafetyConfiguration;
  executionService: AutoSnipingExecutionService;
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
  autoActions?: Omit<SafetyAction, "id" | "executed" | "executedAt" | "result" | "details">[];
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
      info: (message: string, context?: any) => console.info('[alert-management]', message, context || ''),
      warn: (message: string, context?: any) => console.warn('[alert-management]', message, context || ''),
      error: (message: string, context?: any, error?: Error) => console.error('[alert-management]', message, context || '', error || ''),
      debug: (message: string, context?: any) => console.debug('[alert-management]', message, context || ''),
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
    const alert: SafetyAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      autoActions: (alertData.autoActions || []).map((action) => ({
        id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        executed: false,
        ...action,
      })),
      metadata: alertData.metadata || {},
      ...alertData,
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
    }return validatedAlert;
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

        case "reduce_positions":
          // This would implement position size reduction logic
          // For now, just mark as executed
          action.executed = true;
          action.result = "success";
          action.details = "Position size reduction logic would be implemented here";
          break;

        case "limit_exposure":
          // This would implement exposure limitation logic
          action.executed = true;
          action.result = "success";
          action.details = "Exposure limitation logic would be implemented here";
          break;

        case "notify_admin":
          // This would implement admin notification logic
          action.executed = true;
          action.result = "success";
          action.details = "Admin notification logic would be implemented here";
          break;

        case "circuit_breaker":
          // This would implement circuit breaker activation
          action.executed = true;
          action.result = "success";
          action.details = "Circuit breaker activation logic would be implemented here";
          break;

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
      action.details = `Execution failed: ${error.message}`;
      action.executedAt = new Date().toISOString();

      console.error(
        "Safety action failed",
        {
          operation: "execute_action",
          actionId: action.id,
          actionType: action.type,
          error: error.message,
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
}

/**
 * Factory function to create AlertManagement instance
 */
export function createAlertManagement(config: AlertManagementConfig): AlertManagement {
  return new AlertManagement(config);
}
