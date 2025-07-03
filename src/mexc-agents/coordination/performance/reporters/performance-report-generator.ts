/**
 * Performance Report Generator
 *
 * Generates comprehensive performance reports and analysis
 */

import type {
  AgentPerformanceMetrics,
  PerformanceReport,
  SystemPerformanceSnapshot,
  WorkflowPerformanceMetrics,
} from "../types";

export class PerformanceReportGenerator {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[performance-report-generator]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[performance-report-generator]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[performance-report-generator]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[performance-report-generator]", message, context || ""),
  };

  /**
   * Generate performance report for a given period
   */
  generateReport(
    startDate: Date,
    endDate: Date,
    agentMetricsHistory: Map<string, AgentPerformanceMetrics[]>,
    workflowMetricsHistory: WorkflowPerformanceMetrics[],
    systemSnapshotHistory: SystemPerformanceSnapshot[]
  ): PerformanceReport {
    const periodAgentMetrics = Array.from(agentMetricsHistory.values())
      .flat()
      .filter((m) => m.timestamp >= startDate && m.timestamp <= endDate);

    const periodWorkflowMetrics = workflowMetricsHistory.filter(
      (w) => w.timestamp >= startDate && w.timestamp <= endDate
    );

    const periodSystemSnapshots = systemSnapshotHistory.filter(
      (s) => s.timestamp >= startDate && s.timestamp <= endDate
    );

    // Calculate agent performance scores
    const agentScores =
      this.calculateAgentPerformanceScores(periodAgentMetrics);
    const topPerformers = agentScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const bottlenecks = periodAgentMetrics
      .reduce(
        (acc, metric) => {
          const existing = acc.find((a) => a.agentId === metric.agentId);
          if (existing) {
            existing.avgResponseTime =
              (existing.avgResponseTime + metric.averageResponseTime) / 2;
          } else {
            acc.push({
              agentId: metric.agentId,
              avgResponseTime: metric.averageResponseTime,
            });
          }
          return acc;
        },
        [] as { agentId: string; avgResponseTime: number }[]
      )
      .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
      .slice(0, 5);

    // Calculate workflow metrics
    const workflowSuccessRate =
      periodWorkflowMetrics.length > 0
        ? periodWorkflowMetrics.filter((w) => w.status === "completed").length /
          periodWorkflowMetrics.length
        : 0;

    const averageWorkflowDuration =
      periodWorkflowMetrics.length > 0
        ? periodWorkflowMetrics.reduce((sum, w) => sum + w.duration, 0) /
          periodWorkflowMetrics.length
        : 0;

    const mostUsedAgents = this.calculateMostUsedAgents(periodWorkflowMetrics);

    // Calculate system trends
    const trends = this.calculateSystemTrends(periodSystemSnapshots);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      periodAgentMetrics,
      periodWorkflowMetrics,
      periodSystemSnapshots
    );

    return {
      period: {
        start: startDate,
        end: endDate,
      },
      agents: {
        total: new Set(periodAgentMetrics.map((m) => m.agentId)).size,
        metrics: periodAgentMetrics,
        topPerformers,
        bottlenecks,
      },
      workflows: {
        total: periodWorkflowMetrics.length,
        metrics: periodWorkflowMetrics,
        averageDuration: averageWorkflowDuration,
        successRate: workflowSuccessRate,
        mostUsedAgents,
      },
      system: {
        snapshots: periodSystemSnapshots,
        trends,
      },
      recommendations,
    };
  }

  private calculateAgentPerformanceScores(
    metrics: AgentPerformanceMetrics[]
  ): { agentId: string; score: number }[] {
    const agentGroups = metrics.reduce(
      (acc, metric) => {
        if (!acc[metric.agentId]) {
          acc[metric.agentId] = [];
        }
        acc[metric.agentId].push(metric);
        return acc;
      },
      {} as Record<string, AgentPerformanceMetrics[]>
    );

    return Object.entries(agentGroups).map(([agentId, agentMetrics]) => {
      const avgSuccessRate =
        agentMetrics.reduce((sum, m) => sum + m.successRate, 0) /
        agentMetrics.length;
      const avgResponseTime =
        agentMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) /
        agentMetrics.length;
      const avgErrorRate =
        agentMetrics.reduce((sum, m) => sum + m.errorRate, 0) /
        agentMetrics.length;

      // Calculate composite score (0-100)
      const score =
        avgSuccessRate * 40 + // 40% weight on success rate
        Math.max(0, (5000 - avgResponseTime) / 5000) * 30 + // 30% weight on response time
        Math.max(0, 1 - avgErrorRate) * 30; // 30% weight on low error rate

      return { agentId, score: Math.round(score * 100) };
    });
  }

  private calculateMostUsedAgents(
    workflowMetrics: WorkflowPerformanceMetrics[]
  ): { agentId: string; usageCount: number }[] {
    const agentUsage = workflowMetrics
      .flatMap((w) => w.agentsUsed)
      .reduce(
        (acc, agentId) => {
          acc[agentId] = (acc[agentId] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

    return Object.entries(agentUsage)
      .map(([agentId, usageCount]) => ({ agentId, usageCount }))
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10);
  }

  private calculateSystemTrends(snapshots: SystemPerformanceSnapshot[]): {
    responseTime: {
      trend: "improving" | "degrading" | "stable";
      change: number;
    };
    throughput: { trend: "improving" | "degrading" | "stable"; change: number };
    errorRate: { trend: "improving" | "degrading" | "stable"; change: number };
  } {
    if (snapshots.length < 2) {
      return {
        responseTime: { trend: "stable", change: 0 },
        throughput: { trend: "stable", change: 0 },
        errorRate: { trend: "stable", change: 0 },
      };
    }

    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];

    const responseTimeChange =
      ((last.averageResponseTime - first.averageResponseTime) /
        first.averageResponseTime) *
      100;
    const throughputChange =
      ((last.throughput - first.throughput) / first.throughput) * 100;
    const errorRateChange =
      ((last.errorRate - first.errorRate) / (first.errorRate || 0.001)) * 100;

    return {
      responseTime: {
        trend:
          Math.abs(responseTimeChange) < 5
            ? "stable"
            : responseTimeChange < 0
              ? "improving"
              : "degrading",
        change: Math.round(responseTimeChange),
      },
      throughput: {
        trend:
          Math.abs(throughputChange) < 5
            ? "stable"
            : throughputChange > 0
              ? "improving"
              : "degrading",
        change: Math.round(throughputChange),
      },
      errorRate: {
        trend:
          Math.abs(errorRateChange) < 5
            ? "stable"
            : errorRateChange < 0
              ? "improving"
              : "degrading",
        change: Math.round(errorRateChange),
      },
    };
  }

  private generateRecommendations(
    agentMetrics: AgentPerformanceMetrics[],
    workflowMetrics: WorkflowPerformanceMetrics[],
    systemSnapshots: SystemPerformanceSnapshot[]
  ): string[] {
    const recommendations: string[] = [];

    // Agent-based recommendations
    const highErrorRateAgents = agentMetrics.filter((m) => m.errorRate > 0.1);
    if (highErrorRateAgents.length > 0) {
      recommendations.push(
        `Consider investigating agents with high error rates: ${highErrorRateAgents
          .map((m) => m.agentId)
          .join(", ")}`
      );
    }

    const slowResponseAgents = agentMetrics.filter(
      (m) => m.averageResponseTime > 3000
    );
    if (slowResponseAgents.length > 0) {
      recommendations.push(
        `Optimize response times for slow agents: ${slowResponseAgents
          .map((m) => m.agentId)
          .join(", ")}`
      );
    }

    // Workflow-based recommendations
    const failedWorkflows = workflowMetrics.filter(
      (w) => w.status === "failed"
    );
    if (failedWorkflows.length > workflowMetrics.length * 0.1) {
      recommendations.push(
        "High workflow failure rate detected. Review workflow error handling and retry mechanisms."
      );
    }

    // System-based recommendations
    if (systemSnapshots.length > 0) {
      const lastSnapshot = systemSnapshots[systemSnapshots.length - 1];

      if (lastSnapshot.systemMemoryUsage > 1000) {
        recommendations.push(
          "High memory usage detected. Consider implementing memory optimization strategies."
        );
      }

      if (lastSnapshot.systemCpuUsage > 80) {
        recommendations.push(
          "High CPU usage detected. Consider load balancing or scaling strategies."
        );
      }

      if (lastSnapshot.errorRate > 0.05) {
        recommendations.push(
          "System error rate is elevated. Review error patterns and implement additional monitoring."
        );
      }
    }

    return recommendations.length > 0
      ? recommendations
      : ["System performance is within acceptable parameters."];
  }
}
