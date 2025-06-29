/**
 * Safety Alerts Management Module
 *
 * Handles creation, acknowledgment, resolution, and management of safety alerts.
 * Provides centralized alert processing with real-time notifications.
 */

import { EventEmitter } from "node:events";
import type { WebSocketServerService } from "../../data/websocket/websocket-server-service";
import type { SafetyAction, SafetyAlert, SafetyCoordinatorConfig } from "./safety-types";

export class SafetyAlertsManager extends EventEmitter {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[safety-alerts]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[safety-alerts]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[safety-alerts]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[safety-alerts]", message, context || ""),
  };

  private activeAlerts: Map<string, SafetyAlert> = new Map();
  private alertHistory: SafetyAlert[] = [];
  private recentActions: SafetyAction[] = [];
  private actionHistory: SafetyAction[] = [];

  constructor(
    private config: SafetyCoordinatorConfig,
    private websocketService?: WebSocketServerService
  ) {
    super();
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): SafetyAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert by ID
   */
  getAlert(alertId: string): SafetyAlert | undefined {
    return this.activeAlerts.get(alertId);
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 100): SafetyAlert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Get recent actions
   */
  getRecentActions(limit: number = 50): SafetyAction[] {
    return this.recentActions.slice(-limit);
  }

  /**
   * Create a new safety alert
   */
  async createAlert(
    alertData: Omit<SafetyAlert, "id" | "timestamp" | "acknowledged" | "resolved">
  ): Promise<string> {
    const alert: SafetyAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      resolved: false,
      ...alertData,
    };

    this.activeAlerts.set(alert.id, alert);

    // Emit alert event
    this.emit("alert_created", alert);

    // Broadcast real-time alert
    if (this.config.realTimeAlertsEnabled && this.websocketService) {
      await this.broadcastSafetyUpdate("alert", alert);
    }

    console.info(`[SafetyAlertsManager] Created ${alert.severity} alert: ${alert.title}`);

    return alert.id;
  }

  /**
   * Acknowledge a safety alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.acknowledged = true;

    await this.recordSafetyAction({
      type: "alert",
      target: alertId,
      reason: "Alert acknowledged by user",
      executedBy: userId,
      success: true,
      impact: "Alert marked as acknowledged",
    });

    // Broadcast update
    if (this.config.websocketEnabled && this.websocketService) {
      await this.broadcastSafetyUpdate("alert_acknowledged", {
        alertId,
        acknowledgedBy: userId,
        timestamp: new Date().toISOString(),
      });
    }

    this.emit("alert_acknowledged", { alert, userId });

    return true;
  }

  /**
   * Resolve a safety alert
   */
  async resolveAlert(alertId: string, userId: string, resolution: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.resolved = true;
    alert.metadata.resolution = resolution;
    alert.metadata.resolvedBy = userId;
    alert.metadata.resolvedAt = new Date().toISOString();

    // Move to history
    this.alertHistory.push(alert);
    this.activeAlerts.delete(alertId);

    await this.recordSafetyAction({
      type: "alert",
      target: alertId,
      reason: `Alert resolved: ${resolution}`,
      executedBy: userId,
      success: true,
      impact: "Alert resolved and moved to history",
    });

    this.emit("alert_resolved", { alert, userId, resolution });

    return true;
  }

  /**
   * Create critical emergency alert
   */
  async createEmergencyAlert(
    title: string,
    message: string,
    source: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    return this.createAlert({
      type: "emergency_condition",
      severity: "critical",
      title,
      message,
      source,
      actions: ["Manual intervention required", "Review system status"],
      metadata: metadata || {},
    });
  }

  /**
   * Create agent anomaly alert
   */
  async createAgentAnomalyAlert(
    agentId: string,
    anomalyDetails: string,
    severity: "low" | "medium" | "high" | "critical" = "medium"
  ): Promise<string> {
    return this.createAlert({
      type: "agent_anomaly",
      severity,
      title: `Agent Anomaly Detected: ${agentId}`,
      message: `Unusual behavior detected in agent ${agentId}: ${anomalyDetails}`,
      source: agentId,
      actions: ["Review agent behavior", "Check agent configuration", "Consider agent restart"],
      metadata: { agentId, anomalyDetails },
    });
  }

  /**
   * Create risk breach alert
   */
  async createRiskBreachAlert(
    riskType: string,
    currentValue: number,
    threshold: number,
    severity: "low" | "medium" | "high" | "critical" = "high"
  ): Promise<string> {
    return this.createAlert({
      type: "risk_breach",
      severity,
      title: `Risk Threshold Breached: ${riskType}`,
      message: `${riskType} risk level (${currentValue}) has exceeded threshold (${threshold})`,
      source: "risk_engine",
      actions: [
        "Review portfolio positions",
        "Consider position reduction",
        "Implement risk controls",
      ],
      metadata: { riskType, currentValue, threshold },
    });
  }

  /**
   * Clear resolved alerts from active list
   */
  clearResolvedAlerts(): number {
    const resolvedCount = Array.from(this.activeAlerts.values()).filter(
      (alert) => alert.resolved
    ).length;

    for (const [id, alert] of this.activeAlerts.entries()) {
      if (alert.resolved) {
        this.alertHistory.push(alert);
        this.activeAlerts.delete(id);
      }
    }

    return resolvedCount;
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: "low" | "medium" | "high" | "critical"): SafetyAlert[] {
    return Array.from(this.activeAlerts.values()).filter((alert) => alert.severity === severity);
  }

  /**
   * Get alerts by type
   */
  getAlertsByType(type: SafetyAlert["type"]): SafetyAlert[] {
    return Array.from(this.activeAlerts.values()).filter((alert) => alert.type === type);
  }

  /**
   * Get alert statistics
   */
  getAlertStatistics() {
    const active = Array.from(this.activeAlerts.values());

    return {
      total: active.length,
      bySeverity: {
        low: active.filter((a) => a.severity === "low").length,
        medium: active.filter((a) => a.severity === "medium").length,
        high: active.filter((a) => a.severity === "high").length,
        critical: active.filter((a) => a.severity === "critical").length,
      },
      byType: {
        agent_anomaly: active.filter((a) => a.type === "agent_anomaly").length,
        risk_breach: active.filter((a) => a.type === "risk_breach").length,
        emergency_condition: active.filter((a) => a.type === "emergency_condition").length,
        consensus_failure: active.filter((a) => a.type === "consensus_failure").length,
        system_degradation: active.filter((a) => a.type === "system_degradation").length,
      },
      acknowledged: active.filter((a) => a.acknowledged).length,
      unacknowledged: active.filter((a) => !a.acknowledged).length,
    };
  }

  /**
   * Record a safety action
   */
  private async recordSafetyAction(
    actionData: Omit<SafetyAction, "id" | "executedAt">
  ): Promise<void> {
    const action: SafetyAction = {
      id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      executedAt: new Date().toISOString(),
      ...actionData,
    };

    this.recentActions.push(action);
    this.actionHistory.push(action);

    // Keep only last 100 recent actions
    if (this.recentActions.length > 100) {
      this.recentActions = this.recentActions.slice(-100);
    }

    // Emit action event
    this.emit("action_executed", action);

    console.info(`[SafetyAlertsManager] Executed ${action.type} action: ${action.reason}`);
  }

  /**
   * Broadcast safety update via WebSocket
   */
  private async broadcastSafetyUpdate(type: string, data: any): Promise<void> {
    if (!this.websocketService) return;

    try {
      await this.websocketService.broadcast("system", {
        type: "notification:info" as const,
        channel: "system",
        data: {
          updateType: type,
          timestamp: new Date().toISOString(),
          category: "safety_update",
          ...data,
        },
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("[SafetyAlertsManager] Failed to broadcast safety update:", error);
    }
  }

  /**
   * Start the alerts manager
   */
  async start(): Promise<void> {
    this.logger.info("Safety alerts manager started");
  }

  /**
   * Stop the alerts manager
   */
  async stop(): Promise<void> {
    this.logger.info("Safety alerts manager stopped");
  }

  /**
   * Perform health check
   */
  async performHealthCheck(): Promise<boolean> {
    try {
      // Simple health check - ensure we can create and manage alerts
      const alertCount = this.activeAlerts.size;
      this.logger.debug(`Health check: ${alertCount} active alerts`);
      return true;
    } catch (error) {
      this.logger.error("Health check failed", undefined, error as Error);
      return false;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: SafetyCoordinatorConfig): void {
    this.config = config;
    this.logger.info("Configuration updated");
  }

  /**
   * Cleanup old alerts and actions
   */
  cleanup(): void {
    // Keep only last 1000 alert history items
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000);
    }

    // Keep only last 1000 action history items
    if (this.actionHistory.length > 1000) {
      this.actionHistory = this.actionHistory.slice(-1000);
    }

    // Clear old resolved alerts
    this.clearResolvedAlerts();
  }
}
