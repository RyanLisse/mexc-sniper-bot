import { getGlobalAgentRegistry } from "@/src/mexc-agents/coordination/agent-registry";
import type {
  AgentRegistryStats,
  AgentStatus,
  RegisteredAgent,
} from "@/src/mexc-agents/coordination/agent-registry";
import { ErrorLoggingService } from "./error-logging-service";

export interface MonitoringAlert {
  id: string;
  type: "health" | "performance" | "system" | "recovery";
  severity: "info" | "warning" | "critical" | "emergency";
  title: string;
  message: string;
  agentId?: string;
  agentName?: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, unknown>;
  actionRequired?: boolean;
  suggestedActions?: string[];
}

export interface MonitoringReport {
  id: string;
  timestamp: Date;
  period: {
    start: Date;
    end: Date;
  };
  systemOverview: {
    totalAgents: number;
    healthyAgents: number;
    degradedAgents: number;
    unhealthyAgents: number;
    averageHealthScore: number;
    systemUptime: number;
    alertsGenerated: number;
    recoveriesPerformed: number;
  };
  agentReports: Array<{
    agentId: string;
    agentName: string;
    status: AgentStatus;
    healthScore: number;
    responseTime: number;
    errorRate: number;
    uptime: number;
    issuesDetected: string[];
    recommendedActions: string[];
  }>;
  trends: {
    healthScore: "improving" | "degrading" | "stable";
    responseTime: "improving" | "degrading" | "stable";
    errorRate: "improving" | "degrading" | "stable";
    recovery: "improving" | "degrading" | "stable";
  };
  recommendations: string[];
}

export interface MonitoringConfig {
  enabled: boolean;
  alertThresholds: {
    unhealthyAgentPercentage: number;
    systemResponseTime: number;
    systemErrorRate: number;
    consecutiveRecoveryFailures: number;
  };
  reporting: {
    enabled: boolean;
    interval: number; // milliseconds
    retentionPeriod: number; // days
  };
  notifications: {
    enabled: boolean;
    channels: ("console" | "email" | "webhook")[];
    webhookUrl?: string;
    emailRecipients?: string[];
  };
  autoRecovery: {
    enabled: boolean;
    maxAttempts: number;
    backoffMultiplier: number;
    strategies: string[];
  };
}

/**
 * Centralized monitoring service for all agent health and performance metrics
 */
export class AgentMonitoringService {
  private static instance: AgentMonitoringService | null = null;
  private config: MonitoringConfig;
  private alerts: Map<string, MonitoringAlert> = new Map();
  private reports: MonitoringReport[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private reportingInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private errorLoggingService: ErrorLoggingService;
  private alertIdCounter = 0;
  private reportIdCounter = 0;

  private constructor(config?: Partial<MonitoringConfig>) {
    this.config = {
      enabled: true,
      alertThresholds: {
        unhealthyAgentPercentage: 20,
        systemResponseTime: 5000,
        systemErrorRate: 0.15,
        consecutiveRecoveryFailures: 3,
      },
      reporting: {
        enabled: true,
        interval: 5 * 60 * 1000, // 5 minutes
        retentionPeriod: 7, // 7 days
      },
      notifications: {
        enabled: true,
        channels: ["console"],
      },
      autoRecovery: {
        enabled: true,
        maxAttempts: 5,
        backoffMultiplier: 2,
        strategies: ["health_retry", "clear_cache", "restart"],
      },
      ...config,
    };

    this.errorLoggingService = ErrorLoggingService.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: Partial<MonitoringConfig>): AgentMonitoringService {
    if (!AgentMonitoringService.instance) {
      AgentMonitoringService.instance = new AgentMonitoringService(config);
    }
    return AgentMonitoringService.instance;
  }

  /**
   * Start monitoring service
   */
  public start(): void {
    if (this.isRunning) {
      console.warn("[AgentMonitoringService] Service is already running");
      return;
    }

    if (!this.config.enabled) {
      console.log("[AgentMonitoringService] Service is disabled");
      return;
    }

    this.isRunning = true;

    // Start health monitoring
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error("[AgentMonitoringService] Health check failed:", error);
        await this.errorLoggingService.logError(error as Error, {
          service: "AgentMonitoringService",
          operation: "performHealthCheck",
        });
      }
    }, 30000); // Every 30 seconds

    // Start report generation
    if (this.config.reporting.enabled) {
      this.reportingInterval = setInterval(async () => {
        try {
          await this.generateReport();
        } catch (error) {
          console.error("[AgentMonitoringService] Report generation failed:", error);
          await this.errorLoggingService.logError(error as Error, {
            service: "AgentMonitoringService",
            operation: "generateReport",
          });
        }
      }, this.config.reporting.interval);
    }

    console.log("[AgentMonitoringService] Monitoring service started");
  }

  /**
   * Stop monitoring service
   */
  public stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
      this.reportingInterval = null;
    }

    this.isRunning = false;
    console.log("[AgentMonitoringService] Monitoring service stopped");
  }

  /**
   * Perform comprehensive health check
   */
  public async performHealthCheck(): Promise<void> {
    const registry = getGlobalAgentRegistry();
    const stats = registry.getStats();
    const systemAlerts = registry.getSystemAlerts();

    // Check system-wide health
    await this.checkSystemHealth(stats);

    // Process system alerts from registry
    for (const alert of systemAlerts) {
      await this.generateAlert({
        type: "system",
        severity: alert.type === "critical" ? "critical" : "warning",
        title: "System Health Alert",
        message: alert.message,
        actionRequired: alert.type === "critical",
        suggestedActions: this.getSuggestedActionsForSystemAlert(alert.message),
      });
    }

    // Check individual agents
    const allAgents = registry.getAllAgents();
    for (const agent of allAgents) {
      await this.checkAgentHealth(agent);
    }

    // Clean up resolved alerts
    this.cleanupResolvedAlerts();
  }

  /**
   * Check system-wide health metrics
   */
  private async checkSystemHealth(stats: AgentRegistryStats): Promise<void> {
    const unhealthyPercentage = (stats.unhealthyAgents / stats.totalAgents) * 100;

    // Check unhealthy agent percentage
    if (unhealthyPercentage > this.config.alertThresholds.unhealthyAgentPercentage) {
      await this.generateAlert({
        type: "system",
        severity: unhealthyPercentage > 40 ? "critical" : "warning",
        title: "High Unhealthy Agent Percentage",
        message: `${unhealthyPercentage.toFixed(1)}% of agents are unhealthy (${stats.unhealthyAgents}/${stats.totalAgents})`,
        actionRequired: unhealthyPercentage > 40,
        suggestedActions: [
          "Investigate common issues across agents",
          "Check system resources (CPU, memory)",
          "Review agent configurations",
          "Consider scaling resources",
        ],
      });
    }

    // Check system response time
    if (stats.averageResponseTime > this.config.alertThresholds.systemResponseTime) {
      await this.generateAlert({
        type: "performance",
        severity: stats.averageResponseTime > 10000 ? "critical" : "warning",
        title: "High System Response Time",
        message: `System average response time is ${stats.averageResponseTime.toFixed(0)}ms`,
        actionRequired: stats.averageResponseTime > 10000,
        suggestedActions: [
          "Check system load and CPU usage",
          "Review OpenAI API rate limits",
          "Optimize agent caching strategies",
          "Consider load balancing",
        ],
      });
    }
  }

  /**
   * Check individual agent health
   */
  private async checkAgentHealth(agent: RegisteredAgent): Promise<void> {
    const health = agent.health;
    const thresholds = agent.thresholds;

    // Check for critical health issues
    if (health.status === "unhealthy") {
      await this.generateAlert({
        type: "health",
        severity: "critical",
        title: "Agent Unhealthy",
        message: `Agent ${agent.name} is in unhealthy state`,
        agentId: agent.id,
        agentName: agent.name,
        actionRequired: true,
        suggestedActions: [
          "Check agent error logs",
          "Verify agent dependencies",
          "Consider manual recovery",
          "Review agent configuration",
        ],
        metadata: {
          healthScore: health.healthScore,
          responseTime: health.responseTime,
          errorRate: health.errorRate,
          consecutiveErrors: health.consecutiveErrors,
        },
      });
    }

    // Check for excessive recovery attempts
    if (health.recoveryAttempts > this.config.autoRecovery.maxAttempts) {
      await this.generateAlert({
        type: "recovery",
        severity: "warning",
        title: "Excessive Recovery Attempts",
        message: `Agent ${agent.name} has required ${health.recoveryAttempts} recovery attempts`,
        agentId: agent.id,
        agentName: agent.name,
        actionRequired: true,
        suggestedActions: [
          "Investigate root cause of failures",
          "Review recovery strategies",
          "Check agent dependencies",
          "Consider disabling auto-recovery temporarily",
        ],
        metadata: {
          recoveryAttempts: health.recoveryAttempts,
          lastRecoveryAttempt: health.lastRecoveryAttempt,
        },
      });
    }

    // Check for degrading trends
    if (
      health.trends.responseTime === "degrading" &&
      health.responseTime > thresholds.responseTime.warning
    ) {
      await this.generateAlert({
        type: "performance",
        severity: "warning",
        title: "Degrading Performance Trend",
        message: `Agent ${agent.name} shows degrading response time trend`,
        agentId: agent.id,
        agentName: agent.name,
        suggestedActions: [
          "Monitor response time closely",
          "Check for resource constraints",
          "Review agent caching efficiency",
          "Consider performance optimization",
        ],
        metadata: {
          currentResponseTime: health.responseTime,
          trend: health.trends.responseTime,
        },
      });
    }
  }

  /**
   * Generate and process alert
   */
  private async generateAlert(
    alertData: Omit<MonitoringAlert, "id" | "resolved" | "resolvedAt" | "timestamp">
  ): Promise<string> {
    const alertId = `alert-${Date.now()}-${++this.alertIdCounter}`;

    const alert: MonitoringAlert = {
      id: alertId,
      resolved: false,
      timestamp: new Date(),
      ...alertData,
    };

    // Check for duplicate alerts
    const existingAlert = Array.from(this.alerts.values()).find(
      (a) =>
        !a.resolved &&
        a.type === alert.type &&
        a.agentId === alert.agentId &&
        a.title === alert.title
    );

    if (existingAlert) {
      // Update existing alert instead of creating duplicate
      existingAlert.message = alert.message;
      existingAlert.timestamp = alert.timestamp;
      existingAlert.metadata = { ...existingAlert.metadata, ...alert.metadata };
      return existingAlert.id;
    }

    this.alerts.set(alertId, alert);

    // Send notifications
    await this.sendNotification(alert);

    // Log alert
    console.log(
      `[AgentMonitoringService] Alert generated: ${alert.severity.toUpperCase()} - ${alert.title}`
    );

    return alertId;
  }

  /**
   * Send notification for alert
   */
  private async sendNotification(alert: MonitoringAlert): Promise<void> {
    if (!this.config.notifications.enabled) return;

    const channels = this.config.notifications.channels;

    // Console notification
    if (channels.includes("console")) {
      const prefix =
        alert.severity === "critical" ? "🚨" : alert.severity === "warning" ? "⚠️" : "ℹ️";
      console.log(`${prefix} [${alert.severity.toUpperCase()}] ${alert.title}: ${alert.message}`);

      if (alert.suggestedActions && alert.suggestedActions.length > 0) {
        console.log("   Suggested actions:");
        alert.suggestedActions.forEach((action) => console.log(`   - ${action}`));
      }
    }

    // Webhook notification
    if (channels.includes("webhook") && this.config.notifications.webhookUrl) {
      try {
        await fetch(this.config.notifications.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "agent_monitoring_alert",
            alert,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (error) {
        console.error("[AgentMonitoringService] Webhook notification failed:", error);
      }
    }

    // Log to error service for critical alerts
    if (alert.severity === "critical" || alert.severity === "emergency") {
      await this.errorLoggingService.logError(new Error(alert.message), {
        service: "AgentMonitoringService",
        operation: "criticalAlert",
        alertId: alert.id,
        agentId: alert.agentId,
        severity: alert.severity,
      });
    }
  }

  /**
   * Generate comprehensive monitoring report
   */
  public async generateReport(): Promise<MonitoringReport> {
    const reportId = `report-${Date.now()}-${++this.reportIdCounter}`;
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - this.config.reporting.interval);

    const registry = getGlobalAgentRegistry();
    const stats = registry.getStats();
    const allAgents = registry.getAllAgents();

    // Calculate system overview
    const systemOverview = {
      totalAgents: stats.totalAgents,
      healthyAgents: stats.healthyAgents,
      degradedAgents: stats.degradedAgents,
      unhealthyAgents: stats.unhealthyAgents,
      averageHealthScore:
        allAgents.reduce((sum, a) => sum + a.health.healthScore, 0) / allAgents.length || 0,
      systemUptime: allAgents.reduce((sum, a) => sum + a.health.uptime, 0) / allAgents.length || 0,
      alertsGenerated: Array.from(this.alerts.values()).filter(
        (a) => a.timestamp >= startTime && a.timestamp <= endTime
      ).length,
      recoveriesPerformed: allAgents.reduce((sum, a) => sum + a.health.recoveryAttempts, 0),
    };

    // Generate agent reports
    const agentReports = allAgents.map((agent) => {
      const healthReport = registry.getAgentHealthReport(agent.id);
      return {
        agentId: agent.id,
        agentName: agent.name,
        status: agent.health.status,
        healthScore: agent.health.healthScore,
        responseTime: agent.health.responseTime,
        errorRate: agent.health.errorRate,
        uptime: agent.health.uptime,
        issuesDetected: this.getAgentIssues(agent),
        recommendedActions: healthReport?.recommendations || [],
      };
    });

    // Calculate trends
    const trends = this.calculateSystemTrends(allAgents);

    // Generate recommendations
    const recommendations = this.generateSystemRecommendations(systemOverview, agentReports);

    const report: MonitoringReport = {
      id: reportId,
      timestamp: endTime,
      period: { start: startTime, end: endTime },
      systemOverview,
      agentReports,
      trends,
      recommendations,
    };

    this.reports.push(report);

    // Clean up old reports
    this.cleanupOldReports();

    console.log(`[AgentMonitoringService] Generated monitoring report: ${reportId}`);
    return report;
  }

  /**
   * Get current alerts
   */
  public getAlerts(includeResolved = false): MonitoringAlert[] {
    const alerts = Array.from(this.alerts.values());
    return includeResolved ? alerts : alerts.filter((alert) => !alert.resolved);
  }

  /**
   * Get recent reports
   */
  public getReports(limit = 10): MonitoringReport[] {
    return this.reports.slice(-limit);
  }

  /**
   * Resolve alert
   */
  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      console.log(`[AgentMonitoringService] Alert resolved: ${alertId}`);
      return true;
    }
    return false;
  }

  /**
   * Update monitoring configuration
   */
  public updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log("[AgentMonitoringService] Configuration updated");
  }

  /**
   * Get current configuration
   */
  public getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  /**
   * Get monitoring statistics
   */
  public getStats(): {
    isRunning: boolean;
    totalAlerts: number;
    unresolvedAlerts: number;
    criticalAlerts: number;
    totalReports: number;
    lastReportTime: Date | null;
  } {
    const alerts = Array.from(this.alerts.values());
    return {
      isRunning: this.isRunning,
      totalAlerts: alerts.length,
      unresolvedAlerts: alerts.filter((a) => !a.resolved).length,
      criticalAlerts: alerts.filter(
        (a) => !a.resolved && (a.severity === "critical" || a.severity === "emergency")
      ).length,
      totalReports: this.reports.length,
      lastReportTime:
        this.reports.length > 0 ? this.reports[this.reports.length - 1].timestamp : null,
    };
  }

  // Helper methods
  private getSuggestedActionsForSystemAlert(message: string): string[] {
    if (message.includes("unhealthy")) {
      return [
        "Investigate common agent issues",
        "Check system resources",
        "Review agent configurations",
      ];
    }
    if (message.includes("response time")) {
      return ["Check system load", "Review API rate limits", "Optimize caching"];
    }
    return ["Monitor system health", "Check logs for issues"];
  }

  private getAgentIssues(agent: RegisteredAgent): string[] {
    const issues: string[] = [];
    const health = agent.health;
    const thresholds = agent.thresholds;

    if (health.responseTime > thresholds.responseTime.warning) issues.push("Slow response time");
    if (health.errorRate > thresholds.errorRate.warning) issues.push("High error rate");
    if (health.consecutiveErrors > thresholds.consecutiveErrors.warning)
      issues.push("Consecutive errors");
    if (health.memoryUsage > thresholds.memoryUsage.warning) issues.push("High memory usage");
    if (health.cpuUsage > thresholds.cpuUsage.warning) issues.push("High CPU usage");
    if (health.uptime < thresholds.uptime.warning) issues.push("Low uptime");
    if (health.recoveryAttempts > 3) issues.push("Multiple recovery attempts");

    return issues;
  }

  private calculateSystemTrends(agents: RegisteredAgent[]): MonitoringReport["trends"] {
    const trends = {
      responseTime: { improving: 0, degrading: 0, stable: 0 },
      errorRate: { improving: 0, degrading: 0, stable: 0 },
      recovery: { improving: 0, degrading: 0, stable: 0 },
    };

    agents.forEach((agent) => {
      trends.responseTime[agent.health.trends.responseTime]++;
      trends.errorRate[agent.health.trends.errorRate]++;
    });

    // Determine overall system trends
    return {
      healthScore:
        trends.responseTime.improving > trends.responseTime.degrading
          ? "improving"
          : trends.responseTime.degrading > trends.responseTime.improving
            ? "degrading"
            : "stable",
      responseTime:
        trends.responseTime.improving > trends.responseTime.degrading
          ? "improving"
          : trends.responseTime.degrading > trends.responseTime.improving
            ? "degrading"
            : "stable",
      errorRate:
        trends.errorRate.improving > trends.errorRate.degrading
          ? "improving"
          : trends.errorRate.degrading > trends.errorRate.improving
            ? "degrading"
            : "stable",
      recovery: "stable", // Simplified for now
    };
  }

  private generateSystemRecommendations(
    systemOverview: MonitoringReport["systemOverview"],
    agentReports: MonitoringReport["agentReports"]
  ): string[] {
    const recommendations: string[] = [];

    if (systemOverview.unhealthyAgents > systemOverview.totalAgents * 0.1) {
      recommendations.push(
        "High number of unhealthy agents detected. Consider system-wide health investigation."
      );
    }

    if (systemOverview.averageHealthScore < 70) {
      recommendations.push(
        "Low system health score. Review agent configurations and system resources."
      );
    }

    const highErrorAgents = agentReports.filter((a) => a.errorRate > 0.1).length;
    if (highErrorAgents > 0) {
      recommendations.push(
        `${highErrorAgents} agents have high error rates. Investigate common causes.`
      );
    }

    if (systemOverview.recoveriesPerformed > systemOverview.totalAgents * 2) {
      recommendations.push("High number of recovery attempts. Consider addressing root causes.");
    }

    return recommendations;
  }

  private cleanupResolvedAlerts(): void {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.resolved && alert.resolvedAt && alert.resolvedAt < oneDayAgo) {
        this.alerts.delete(id);
      }
    }
  }

  private cleanupOldReports(): void {
    const cutoffDate = new Date(
      Date.now() - this.config.reporting.retentionPeriod * 24 * 60 * 60 * 1000
    );
    this.reports = this.reports.filter((report) => report.timestamp > cutoffDate);
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stop();
    this.alerts.clear();
    this.reports = [];
    AgentMonitoringService.instance = null;
    console.log("[AgentMonitoringService] Service destroyed");
  }
}
