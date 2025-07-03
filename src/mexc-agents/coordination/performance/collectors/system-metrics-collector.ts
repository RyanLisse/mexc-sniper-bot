/**
 * System Metrics Collector
 *
 * Collects system-wide performance metrics and snapshots
 */

import type { AgentRegistry } from "../../agent-registry";
import type {
  AgentPerformanceMetrics,
  SystemPerformanceSnapshot,
  WorkflowPerformanceMetrics,
} from "../types";

export class SystemMetricsCollector {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[system-metrics-collector]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[system-metrics-collector]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[system-metrics-collector]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[system-metrics-collector]", message, context || ""),
  };

  constructor(private agentRegistry: AgentRegistry) {}

  /**
   * Collect system performance snapshot
   */
  async collectSystemSnapshot(
    timestamp: Date,
    agentMetricsHistory: Map<string, AgentPerformanceMetrics[]>,
    workflowMetricsHistory: WorkflowPerformanceMetrics[],
    systemSnapshotHistory: SystemPerformanceSnapshot[],
    maxHistorySize: number
  ): Promise<void> {
    try {
      const registryStats = this.agentRegistry.getStats();

      // Calculate workflow metrics from recent history
      const recentWorkflows = workflowMetricsHistory.filter(
        (w) => timestamp.getTime() - w.timestamp.getTime() < 60 * 60 * 1000 // Last hour
      );

      const runningWorkflows = 0; // Would need to be tracked separately
      const completedWorkflows = recentWorkflows.filter(
        (w) => w.status === "completed"
      ).length;
      const failedWorkflows = recentWorkflows.filter(
        (w) => w.status === "failed"
      ).length;

      // Calculate system metrics
      const responseTimes = Array.from(agentMetricsHistory.values())
        .flat()
        .filter(
          (m) => timestamp.getTime() - m.timestamp.getTime() < 60 * 60 * 1000
        )
        .map((m) => m.responseTime);

      const averageResponseTime =
        responseTimes.length > 0
          ? responseTimes.reduce((sum, time) => sum + time, 0) /
            responseTimes.length
          : 0;

      const totalThroughput = Array.from(agentMetricsHistory.values())
        .flat()
        .filter((m) => timestamp.getTime() - m.timestamp.getTime() < 60 * 1000) // Last minute
        .reduce((sum, m) => sum + m.throughput, 0);

      const systemErrorRate = Array.from(agentMetricsHistory.values())
        .flat()
        .filter(
          (m) => timestamp.getTime() - m.timestamp.getTime() < 60 * 60 * 1000
        )
        .reduce((sum, m, _, arr) => sum + m.errorRate / arr.length, 0);

      const snapshot: SystemPerformanceSnapshot = {
        timestamp,
        totalAgents: registryStats.totalAgents,
        healthyAgents: registryStats.healthyAgents,
        degradedAgents: registryStats.degradedAgents,
        unhealthyAgents: registryStats.unhealthyAgents,
        totalWorkflows: workflowMetricsHistory.length,
        runningWorkflows,
        completedWorkflows,
        failedWorkflows,
        systemMemoryUsage: this.getSystemMemoryUsage(),
        systemCpuUsage: this.getSystemCpuUsage(),
        databaseConnections: await this.getDatabaseConnections(),
        averageResponseTime,
        throughput: totalThroughput,
        errorRate: systemErrorRate,
        uptime: this.getSystemUptime(),
        metadata: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        },
      };

      systemSnapshotHistory.push(snapshot);

      // Keep only recent history
      if (systemSnapshotHistory.length > maxHistorySize) {
        systemSnapshotHistory.splice(
          0,
          systemSnapshotHistory.length - maxHistorySize
        );
      }
    } catch (error) {
      this.logger.error(
        "Failed to collect system snapshot:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private getSystemMemoryUsage(): number {
    try {
      const memUsage = process.memoryUsage();
      return Math.round(memUsage.heapUsed / 1024 / 1024); // Convert to MB
    } catch {
      return 0;
    }
  }

  private getSystemCpuUsage(): number {
    try {
      const cpuUsage = process.cpuUsage();
      const totalUsage = cpuUsage.user + cpuUsage.system;
      return Math.round((totalUsage / 1000000) % 100); // Simplified percentage
    } catch {
      return 0;
    }
  }

  private async getDatabaseConnections(): Promise<number> {
    try {
      // This would need to be implemented based on your database setup
      // For now, return a mock value
      return Math.floor(Math.random() * 10) + 5;
    } catch {
      return 0;
    }
  }

  private getSystemUptime(): number {
    try {
      return process.uptime() * 1000; // Convert to milliseconds
    } catch {
      return 0;
    }
  }
}
