/**
 * Auto-Sniping Alert Manager
 *
 * Manages alerts and notifications for the auto-sniping system.
 * Extracted from optimized-auto-sniping-core.ts for modularity.
 */

import { v4 as uuidv4 } from "uuid";
import {
  type AlertSeverity,
  type AlertType,
  type ExecutionAlert,
  ExecutionAlertSchema,
} from "./schemas";

export class AutoSnipingAlertManager {
  private alerts: ExecutionAlert[] = [];
  private readonly maxAlerts = 1000; // Prevent memory leaks

  /**
   * Add a new alert with validation
   */
  addAlert(alertData: {
    type: AlertType;
    severity: AlertSeverity;
    message: string;
    positionId?: string;
    symbol?: string;
    details?: Record<string, string | number | boolean | null>;
  }): ExecutionAlert {
    const alert: ExecutionAlert = {
      id: uuidv4(),
      type: alertData.type,
      severity: alertData.severity,
      message: alertData.message,
      timestamp: new Date().toISOString(),
      positionId: alertData.positionId,
      symbol: alertData.symbol,
      details: alertData.details || {},
      acknowledged: false,
    };

    // Validate alert before adding
    const validatedAlert = ExecutionAlertSchema.parse(alert);

    // Add to alerts array
    this.alerts.unshift(validatedAlert);

    // Maintain maximum alerts limit
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(0, this.maxAlerts);
    }

    // Log alert based on severity
    this.logAlert(validatedAlert);

    return validatedAlert;
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): ExecutionAlert[] {
    return [...this.alerts];
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: AlertSeverity): ExecutionAlert[] {
    return this.alerts.filter((alert) => alert.severity === severity);
  }

  /**
   * Get alerts by type
   */
  getAlertsByType(type: AlertType): ExecutionAlert[] {
    return this.alerts.filter((alert) => alert.type === type);
  }

  /**
   * Get unacknowledged alerts
   */
  getUnacknowledgedAlerts(): ExecutionAlert[] {
    return this.alerts.filter((alert) => !alert.acknowledged);
  }

  /**
   * Get recent alerts (last N alerts)
   */
  getRecentAlerts(count: number = 50): ExecutionAlert[] {
    return this.alerts.slice(0, Math.min(count, this.alerts.length));
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      console.info("Alert acknowledged", { alertId, type: alert.type });
      return true;
    }
    return false;
  }

  /**
   * Acknowledge multiple alerts
   */
  acknowledgeAlerts(alertIds: string[]): number {
    let acknowledged = 0;
    for (const alertId of alertIds) {
      if (this.acknowledgeAlert(alertId)) {
        acknowledged++;
      }
    }
    return acknowledged;
  }

  /**
   * Clear old alerts (older than specified hours)
   */
  clearOldAlerts(hoursToKeep: number = 24): number {
    const cutoffTime = new Date(Date.now() - hoursToKeep * 60 * 60 * 1000);
    const initialCount = this.alerts.length;

    this.alerts = this.alerts.filter((alert) => new Date(alert.timestamp) > cutoffTime);

    const removed = initialCount - this.alerts.length;
    if (removed > 0) {
      console.info(`Cleared ${removed} old alerts`, {
        hoursToKeep,
        remaining: this.alerts.length,
      });
    }

    return removed;
  }

  /**
   * Get alert statistics
   */
  getAlertStats(): {
    total: number;
    bySeverity: Record<AlertSeverity, number>;
    byType: Record<AlertType, number>;
    unacknowledged: number;
    recent24h: number;
  } {
    const stats = {
      total: this.alerts.length,
      bySeverity: {
        info: 0,
        warning: 0,
        error: 0,
        critical: 0,
      } as Record<AlertSeverity, number>,
      byType: {
        position_opened: 0,
        position_closed: 0,
        stop_loss_hit: 0,
        take_profit_hit: 0,
        execution_error: 0,
        risk_limit_hit: 0,
      } as Record<AlertType, number>,
      unacknowledged: 0,
      recent24h: 0,
    };

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    for (const alert of this.alerts) {
      // Count by severity
      stats.bySeverity[alert.severity]++;

      // Count by type
      stats.byType[alert.type]++;

      // Count unacknowledged
      if (!alert.acknowledged) {
        stats.unacknowledged++;
      }

      // Count recent (last 24h)
      if (new Date(alert.timestamp) > twentyFourHoursAgo) {
        stats.recent24h++;
      }
    }

    return stats;
  }

  /**
   * Check for critical alerts requiring immediate attention
   */
  getCriticalAlerts(): ExecutionAlert[] {
    return this.alerts.filter((alert) => alert.severity === "critical" && !alert.acknowledged);
  }

  /**
   * Check if there are any unhandled critical issues
   */
  hasCriticalIssues(): boolean {
    return this.getCriticalAlerts().length > 0;
  }

  /**
   * Export alerts as JSON for external processing
   */
  exportAlerts(): string {
    return JSON.stringify(this.alerts, null, 2);
  }

  /**
   * Import alerts from JSON data
   */
  importAlerts(alertsJson: string): number {
    try {
      const importedAlerts = JSON.parse(alertsJson) as ExecutionAlert[];
      let imported = 0;

      for (const alertData of importedAlerts) {
        try {
          const validatedAlert = ExecutionAlertSchema.parse(alertData);
          this.alerts.push(validatedAlert);
          imported++;
        } catch (error) {
          console.warn("Invalid alert data during import", { alertData });
        }
      }

      // Sort by timestamp (newest first)
      this.alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Maintain max alerts limit
      if (this.alerts.length > this.maxAlerts) {
        this.alerts = this.alerts.slice(0, this.maxAlerts);
      }

      console.info(`Imported ${imported} alerts`);
      return imported;
    } catch (error) {
      console.error("Failed to import alerts", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return 0;
    }
  }

  /**
   * Log alert to console based on severity
   */
  private logAlert(alert: ExecutionAlert): void {
    const logData = {
      id: alert.id,
      type: alert.type,
      message: alert.message,
      symbol: alert.symbol,
      positionId: alert.positionId,
      details: alert.details,
    };

    switch (alert.severity) {
      case "critical":
        console.error("🚨 CRITICAL ALERT", logData);
        break;
      case "error":
        console.error("❌ ERROR ALERT", logData);
        break;
      case "warning":
        console.warn("⚠️ WARNING ALERT", logData);
        break;
      case "info":
        console.info("ℹ️ INFO ALERT", logData);
        break;
    }
  }
}
