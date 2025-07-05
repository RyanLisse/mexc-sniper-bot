/**
 * Cost Monitoring Middleware - Real-time Database Cost Tracking
 *
 * Monitors database usage across API endpoints and triggers alerts
 * when operations exceed cost thresholds to prevent financial damage.
 */

import type { NextRequest, NextResponse } from "next/server";

export interface CostMetrics {
  queryCount: number;
  duration: number;
  dataTransfer: number;
  endpoint: string;
  timestamp: string;
  estimatedCost: number;
}

export interface CostAlert {
  endpoint: string;
  queryCount: number;
  duration: number;
  dataTransfer: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  estimatedCost: number;
  threshold: string;
  timestamp: string;
}

export interface CostThresholds {
  queries: { warning: number; critical: number };
  duration: { warning: number; critical: number };
  dataTransfer: { warning: number; critical: number };
  cost: { warning: number; critical: number };
}

class CostMonitor {
  private static instance: CostMonitor;
  private queryCount = 0;
  private dataTransfer = 0;
  private totalCost = 0;
  private startTime = Date.now();
  private endpointMetrics = new Map<string, CostMetrics[]>();

  private readonly costThresholds: CostThresholds = {
    queries: {
      warning: parseInt(process.env.COST_QUERY_WARNING || "10"),
      critical: parseInt(process.env.COST_QUERY_CRITICAL || "50"),
    },
    duration: {
      warning: parseInt(process.env.COST_DURATION_WARNING || "5000"),
      critical: parseInt(process.env.COST_DURATION_CRITICAL || "15000"),
    },
    dataTransfer: {
      warning: parseInt(process.env.COST_DATA_WARNING || "104857600"), // 100MB
      critical: parseInt(process.env.COST_DATA_CRITICAL || "524288000"), // 500MB
    },
    cost: {
      warning: parseFloat(process.env.COST_DOLLAR_WARNING || "1.0"),
      critical: parseFloat(process.env.COST_DOLLAR_CRITICAL || "5.0"),
    },
  };

  static getInstance(): CostMonitor {
    if (!CostMonitor.instance) {
      CostMonitor.instance = new CostMonitor();
    }
    return CostMonitor.instance;
  }

  private constructor() {
    // Start background monitoring
    this.startBackgroundMonitoring();
  }

  private startBackgroundMonitoring(): void {
    // Check cost limits every 30 seconds
    setInterval(() => {
      this.checkGlobalCostLimits();
    }, 30000);

    // Reset daily counters at midnight
    const now = new Date();
    const tomorrow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    );
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    // CRITICAL FIX: Safe timeout validation to prevent TimeoutNaNWarning
    const safeMsUntilMidnight =
      typeof msUntilMidnight === "number" &&
      !Number.isNaN(msUntilMidnight) &&
      Number.isFinite(msUntilMidnight) &&
      msUntilMidnight > 0
        ? msUntilMidnight
        : 24 * 60 * 60 * 1000; // Default to 24 hours if calculation fails

    setTimeout(() => {
      this.resetDailyCounters();
      // Reset every 24 hours
      setInterval(() => this.resetDailyCounters(), 24 * 60 * 60 * 1000);
    }, safeMsUntilMidnight);
  }

  private resetDailyCounters(): void {
    console.info(`📊 [COST MONITOR] Resetting daily counters`, {
      previousQueryCount: this.queryCount,
      previousDataTransfer: this.dataTransfer,
      previousTotalCost: this.totalCost,
      timestamp: new Date().toISOString(),
    });

    this.queryCount = 0;
    this.dataTransfer = 0;
    this.totalCost = 0;
    this.startTime = Date.now();
    this.endpointMetrics.clear();
  }

  async recordOperation(
    metrics: Omit<CostMetrics, "timestamp" | "estimatedCost">
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const estimatedCost = this.calculateCost(
      metrics.queryCount,
      metrics.duration,
      metrics.dataTransfer
    );

    const fullMetrics: CostMetrics = {
      ...metrics,
      timestamp,
      estimatedCost,
    };

    // Update global counters
    this.queryCount += metrics.queryCount;
    this.dataTransfer += metrics.dataTransfer;
    this.totalCost += estimatedCost;

    // Store endpoint-specific metrics
    if (!this.endpointMetrics.has(metrics.endpoint)) {
      this.endpointMetrics.set(metrics.endpoint, []);
    }
    const endpointHistory = this.endpointMetrics.get(metrics.endpoint)!;
    endpointHistory.push(fullMetrics);

    // Keep only last 100 entries per endpoint
    if (endpointHistory.length > 100) {
      endpointHistory.shift();
    }

    // Check if this operation exceeds thresholds
    await this.checkOperationThresholds(fullMetrics);

    console.debug(`💰 [COST TRACKING]`, {
      endpoint: metrics.endpoint,
      operation: fullMetrics,
      totals: {
        queries: this.queryCount,
        dataTransfer: this.dataTransfer,
        cost: this.totalCost,
      },
    });
  }

  private calculateCost(
    queryCount: number,
    duration: number,
    dataTransfer: number
  ): number {
    // Rough cost estimation based on Supabase pricing
    const queryCost = queryCount * 0.001; // $0.001 per query
    const timeCost = (duration / 1000) * 0.01; // $0.01 per second
    const transferCost = (dataTransfer / (1024 * 1024)) * 0.05; // $0.05 per MB

    return queryCost + timeCost + transferCost;
  }

  private async checkOperationThresholds(metrics: CostMetrics): Promise<void> {
    const alerts: CostAlert[] = [];

    // Check query count thresholds
    if (metrics.queryCount >= this.costThresholds.queries.critical) {
      alerts.push(this.createAlert(metrics, "CRITICAL", "queries"));
    } else if (metrics.queryCount >= this.costThresholds.queries.warning) {
      alerts.push(this.createAlert(metrics, "HIGH", "queries"));
    }

    // Check duration thresholds
    if (metrics.duration >= this.costThresholds.duration.critical) {
      alerts.push(this.createAlert(metrics, "CRITICAL", "duration"));
    } else if (metrics.duration >= this.costThresholds.duration.warning) {
      alerts.push(this.createAlert(metrics, "HIGH", "duration"));
    }

    // Check data transfer thresholds
    if (metrics.dataTransfer >= this.costThresholds.dataTransfer.critical) {
      alerts.push(this.createAlert(metrics, "CRITICAL", "dataTransfer"));
    } else if (
      metrics.dataTransfer >= this.costThresholds.dataTransfer.warning
    ) {
      alerts.push(this.createAlert(metrics, "HIGH", "dataTransfer"));
    }

    // Check cost thresholds
    if (metrics.estimatedCost >= this.costThresholds.cost.critical) {
      alerts.push(this.createAlert(metrics, "CRITICAL", "cost"));
    } else if (metrics.estimatedCost >= this.costThresholds.cost.warning) {
      alerts.push(this.createAlert(metrics, "HIGH", "cost"));
    }

    // Send alerts
    for (const alert of alerts) {
      await this.sendCostAlert(alert);
    }
  }

  private createAlert(
    metrics: CostMetrics,
    severity: CostAlert["severity"],
    threshold: string
  ): CostAlert {
    return {
      endpoint: metrics.endpoint,
      queryCount: metrics.queryCount,
      duration: metrics.duration,
      dataTransfer: metrics.dataTransfer,
      severity,
      estimatedCost: metrics.estimatedCost,
      threshold,
      timestamp: metrics.timestamp,
    };
  }

  private async sendCostAlert(alert: CostAlert): Promise<void> {
    const alertEmoji = {
      LOW: "💡",
      MEDIUM: "⚠️",
      HIGH: "🚨",
      CRITICAL: "💥",
    }[alert.severity];

    console.error(
      `${alertEmoji} [COST ALERT] ${alert.severity} threshold exceeded`,
      {
        endpoint: alert.endpoint,
        threshold: alert.threshold,
        metrics: {
          queries: alert.queryCount,
          duration: alert.duration,
          dataTransfer: alert.dataTransfer,
          estimatedCost: alert.estimatedCost,
        },
        timestamp: alert.timestamp,
      }
    );

    // Integrate with external alerting systems
    await this.sendExternalAlert(alert);

    if (alert.severity === "CRITICAL") {
      console.error(
        `🚨🚨🚨 [CRITICAL COST ALERT] Immediate action required!`,
        alert
      );
      // Trigger emergency procedures for critical alerts
      await this.handleCriticalAlert(alert);
    }
  }

  private async checkGlobalCostLimits(): Promise<void> {
    const currentUsage = this.getCurrentUsage();

    if (currentUsage.totalCost > this.costThresholds.cost.critical) {
      await this.emergencyShutdown(
        `Total cost exceeded: $${currentUsage.totalCost.toFixed(2)}`
      );
    }

    if (currentUsage.queryCount > this.costThresholds.queries.critical * 100) {
      // 100x normal limit
      await this.emergencyShutdown(
        `Query count exceeded: ${currentUsage.queryCount} queries`
      );
    }
  }

  private async emergencyShutdown(reason: string): Promise<void> {
    console.error(`🚨🚨🚨 [EMERGENCY SHUTDOWN] ${reason}`, {
      currentUsage: this.getCurrentUsage(),
      timestamp: new Date().toISOString(),
      action: "DISABLING_DATABASE_ENDPOINTS",
    });

    // Implement actual endpoint disabling
    await this.disableEndpoints([
      "/api/execution-history",
      "/api/transactions",
      "/api/workflow-executions",
    ]);

    // Send emergency alert
    await this.sendEmergencyAlert(`🚨 Database emergency shutdown: ${reason}`);
  }

  getCurrentUsage() {
    const uptimeHours = (Date.now() - this.startTime) / (1000 * 60 * 60);

    return {
      queryCount: this.queryCount,
      dataTransfer: this.dataTransfer,
      totalCost: this.totalCost,
      uptimeHours,
      averageQueriesPerHour: this.queryCount / Math.max(uptimeHours, 0.1),
      costPerHour: this.totalCost / Math.max(uptimeHours, 0.1),
    };
  }

  getEndpointMetrics(endpoint?: string) {
    if (endpoint) {
      return this.endpointMetrics.get(endpoint) || [];
    }

    // Return aggregated metrics for all endpoints
    const aggregated = new Map<
      string,
      {
        totalQueries: number;
        totalDuration: number;
        totalDataTransfer: number;
        totalCost: number;
        operationCount: number;
        averageDuration: number;
      }
    >();

    for (const [ep, metrics] of this.endpointMetrics) {
      const summary = metrics.reduce(
        (acc, m) => ({
          totalQueries: acc.totalQueries + m.queryCount,
          totalDuration: acc.totalDuration + m.duration,
          totalDataTransfer: acc.totalDataTransfer + m.dataTransfer,
          totalCost: acc.totalCost + m.estimatedCost,
          operationCount: acc.operationCount + 1,
        }),
        {
          totalQueries: 0,
          totalDuration: 0,
          totalDataTransfer: 0,
          totalCost: 0,
          operationCount: 0,
        }
      );

      aggregated.set(ep, {
        ...summary,
        averageDuration: summary.totalDuration / summary.operationCount,
      });
    }

    return aggregated;
  }

  private async sendExternalAlert(alert: CostAlert): Promise<void> {
    try {
      const alertPayload = {
        text: `${alert.severity} Cost Alert: ${alert.endpoint}`,
        attachments: [
          {
            color: this.getAlertColor(alert.severity),
            fields: [
              { title: "Endpoint", value: alert.endpoint, short: true },
              { title: "Threshold", value: alert.threshold, short: true },
              {
                title: "Query Count",
                value: alert.queryCount.toString(),
                short: true,
              },
              {
                title: "Estimated Cost",
                value: `$${alert.estimatedCost.toFixed(4)}`,
                short: true,
              },
              { title: "Duration", value: `${alert.duration}ms`, short: true },
              {
                title: "Data Transfer",
                value: `${(alert.dataTransfer / 1024).toFixed(2)}KB`,
                short: true,
              },
            ],
            ts: Math.floor(new Date(alert.timestamp).getTime() / 1000),
          },
        ],
      };

      // Send to webhook if configured
      const webhookUrl = process.env.COST_ALERT_WEBHOOK_URL;
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(alertPayload),
        });
      }

      // Send email if configured
      const emailEndpoint = process.env.COST_ALERT_EMAIL_ENDPOINT;
      if (emailEndpoint) {
        await fetch(emailEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: process.env.COST_ALERT_EMAIL_TO,
            subject: `${alert.severity} Cost Alert - ${alert.endpoint}`,
            body: JSON.stringify(alert, null, 2),
          }),
        });
      }
    } catch (error) {
      console.error("[COST MONITOR] Failed to send external alert:", error);
    }
  }

  private async handleCriticalAlert(alert: CostAlert): Promise<void> {
    try {
      // For critical alerts, take immediate action
      if (alert.severity === "CRITICAL") {
        // Disable the problematic endpoint temporarily
        if (typeof globalThis !== "undefined") {
          (globalThis as any).disabledEndpoints =
            (globalThis as any).disabledEndpoints || new Set();
          (globalThis as any).disabledEndpoints.add(alert.endpoint);
        }

        // Send high-priority notification
        const criticalPayload = {
          text: `🚨 CRITICAL DATABASE COST ALERT 🚨`,
          attachments: [
            {
              color: "danger",
              title: "Immediate Action Required",
              text: `Critical cost threshold exceeded on ${alert.endpoint}. Endpoint temporarily disabled.`,
              fields: [
                {
                  title: "Cost",
                  value: `$${alert.estimatedCost.toFixed(4)}`,
                  short: true,
                },
                {
                  title: "Queries",
                  value: alert.queryCount.toString(),
                  short: true,
                },
              ],
            },
          ],
        };

        // Send to all configured channels
        const urgentWebhook =
          process.env.URGENT_ALERT_WEBHOOK_URL ||
          process.env.COST_ALERT_WEBHOOK_URL;
        if (urgentWebhook) {
          await fetch(urgentWebhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(criticalPayload),
          });
        }
      }
    } catch (error) {
      console.error("[COST MONITOR] Failed to handle critical alert:", error);
    }
  }

  private async disableEndpoints(endpoints: string[]): Promise<void> {
    try {
      // Set global flag to disable endpoints
      if (typeof globalThis !== "undefined") {
        (globalThis as any).disabledEndpoints =
          (globalThis as any).disabledEndpoints || new Set();
        endpoints.forEach((endpoint) => {
          (globalThis as any).disabledEndpoints.add(endpoint);
        });
      }

      // Store in environment variable as backup
      process.env.DISABLED_ENDPOINTS = endpoints.join(",");

      console.warn("[COST MONITOR] Disabled endpoints:", endpoints);
    } catch (error) {
      console.error("[COST MONITOR] Failed to disable endpoints:", error);
    }
  }

  private async sendEmergencyAlert(message: string): Promise<void> {
    try {
      const emergencyPayload = {
        text: message,
        attachments: [
          {
            color: "danger",
            title: "🚨 EMERGENCY DATABASE SHUTDOWN 🚨",
            text: "Database operations have been emergency stopped due to cost protection triggers.",
            fields: [
              {
                title: "Current Usage",
                value: JSON.stringify(this.getCurrentUsage()),
                short: false,
              },
            ],
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      };

      // Send to all available channels
      const emergencyWebhook =
        process.env.EMERGENCY_WEBHOOK_URL || process.env.COST_ALERT_WEBHOOK_URL;
      if (emergencyWebhook) {
        await fetch(emergencyWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(emergencyPayload),
        });
      }
    } catch (error) {
      console.error("[COST MONITOR] Failed to send emergency alert:", error);
    }
  }

  private getAlertColor(severity: CostAlert["severity"]): string {
    switch (severity) {
      case "CRITICAL":
        return "danger";
      case "HIGH":
        return "warning";
      case "MEDIUM":
        return "warning";
      case "LOW":
        return "good";
      default:
        return "warning";
    }
  }
}

// Global cost monitor instance
export const globalCostMonitor = CostMonitor.getInstance();

/**
 * Middleware wrapper for cost monitoring
 */
export function withCostMonitoring<
  T extends (...args: any[]) => Promise<NextResponse>,
>(handler: T, endpointName?: string): T {
  return (async (...args: Parameters<T>) => {
    const request = args[0] as NextRequest;
    const endpoint = endpointName || new URL(request.url).pathname;

    const startTime = Date.now();
    let queryCount = 0;
    let dataTransfer = 0;

    // Track query count (this would need integration with your database layer)
    const originalQuery = (globalThis as any).databaseQueryCount || 0;

    try {
      const response = await handler(...args);

      const duration = Date.now() - startTime;
      queryCount =
        ((globalThis as any).databaseQueryCount || 0) - originalQuery;

      // Estimate data transfer size from response
      const responseText = await response.clone().text();
      dataTransfer = new TextEncoder().encode(responseText).length;

      // Record metrics
      await globalCostMonitor.recordOperation({
        queryCount,
        duration,
        dataTransfer,
        endpoint,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      queryCount =
        ((globalThis as any).databaseQueryCount || 0) - originalQuery;

      // Record failed operation metrics
      await globalCostMonitor.recordOperation({
        queryCount,
        duration,
        dataTransfer: 0,
        endpoint: `${endpoint}[ERROR]`,
      });

      throw error;
    }
  }) as T;
}

/**
 * Simple function to manually record cost metrics
 */
export async function recordCostMetrics(
  endpoint: string,
  queryCount: number,
  duration: number,
  dataTransfer: number
): Promise<void> {
  return globalCostMonitor.recordOperation({
    endpoint,
    queryCount,
    duration,
    dataTransfer,
  });
}
