import { PERFORMANCE_CONSTANTS, TIME_CONSTANTS } from "../../lib/constants";
import type { AgentRegistry } from "./agent-registry";
import type { WorkflowExecutionResult } from "./workflow-engine";

export interface AgentPerformanceMetrics {
  agentId: string;
  timestamp: Date;
  responseTime: number;
  successRate: number;
  errorRate: number;
  throughput: number; // requests per minute
  memoryUsage: number; // in MB
  cpuUsage: number; // percentage
  cacheHitRate: number;
  totalRequests: number;
  totalErrors: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  uptime: number; // percentage
  lastError?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowPerformanceMetrics {
  workflowId: string;
  executionId: string;
  timestamp: Date;
  duration: number;
  status: "completed" | "failed" | "timeout" | "cancelled";
  stepsExecuted: number;
  stepsSkipped: number;
  stepsFailed: number;
  agentsUsed: string[];
  retriesPerformed: number;
  fallbacksUsed: number;
  totalResponseTime: number;
  averageStepTime: number;
  bottleneckStep?: string;
  bottleneckDuration?: number;
  resourceUsage: {
    peakMemory: number;
    averageMemory: number;
    peakCpu: number;
    averageCpu: number;
  };
  metadata?: Record<string, unknown>;
}

export interface SystemPerformanceSnapshot {
  timestamp: Date;
  totalAgents: number;
  healthyAgents: number;
  degradedAgents: number;
  unhealthyAgents: number;
  totalWorkflows: number;
  runningWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  systemMemoryUsage: number;
  systemCpuUsage: number;
  databaseConnections: number;
  averageResponseTime: number;
  throughput: number; // total requests per minute
  errorRate: number;
  uptime: number; // system uptime in milliseconds
  metadata?: Record<string, unknown>;
}

export interface PerformanceReport {
  period: {
    start: Date;
    end: Date;
  };
  agents: {
    total: number;
    metrics: AgentPerformanceMetrics[];
    topPerformers: { agentId: string; score: number }[];
    bottlenecks: { agentId: string; avgResponseTime: number }[];
  };
  workflows: {
    total: number;
    metrics: WorkflowPerformanceMetrics[];
    averageDuration: number;
    successRate: number;
    mostUsedAgents: { agentId: string; usageCount: number }[];
  };
  system: {
    snapshots: SystemPerformanceSnapshot[];
    trends: {
      responseTime: { trend: "improving" | "degrading" | "stable"; change: number };
      throughput: { trend: "improving" | "degrading" | "stable"; change: number };
      errorRate: { trend: "improving" | "degrading" | "stable"; change: number };
    };
  };
  recommendations: string[];
}

/**
 * Comprehensive performance metrics collection and analysis system
 */
export class PerformanceCollector {
  private agentRegistry: AgentRegistry;
  private collectionInterval: NodeJS.Timeout | null = null;
  private isCollecting = false;
  private collectionIntervalMs = PERFORMANCE_CONSTANTS.COLLECTION_INTERVAL_MS;
  private agentMetricsHistory: Map<string, AgentPerformanceMetrics[]> = new Map();
  private workflowMetricsHistory: WorkflowPerformanceMetrics[] = [];
  private systemSnapshotHistory: SystemPerformanceSnapshot[] = [];
  private maxHistorySize: number = PERFORMANCE_CONSTANTS.MAX_HISTORY_SIZE;

  constructor(
    agentRegistry: AgentRegistry,
    options?: {
      collectionInterval?: number;
      maxHistorySize?: number;
    }
  ) {
    this.agentRegistry = agentRegistry;

    if (options?.collectionInterval) {
      this.collectionIntervalMs = options.collectionInterval;
    }
    if (options?.maxHistorySize) {
      this.maxHistorySize = options.maxHistorySize;
    }
  }

  /**
   * Start performance metrics collection
   */
  startCollection(): void {
    if (this.isCollecting) {
      console.warn("[PerformanceCollector] Collection is already running");
      return;
    }

    this.isCollecting = true;

    // Initial collection
    this.collectAllMetrics().catch((error) => {
      console.error("[PerformanceCollector] Initial metrics collection failed:", error);
    });

    // Set up periodic collection
    this.collectionInterval = setInterval(async () => {
      try {
        await this.collectAllMetrics();
      } catch (error) {
        console.error("[PerformanceCollector] Periodic metrics collection failed:", error);
      }
    }, this.collectionIntervalMs);

    console.log(
      `[PerformanceCollector] Started metrics collection (interval: ${this.collectionIntervalMs}ms)`
    );
  }

  /**
   * Stop performance metrics collection
   */
  stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
      this.isCollecting = false;
      console.log("[PerformanceCollector] Stopped metrics collection");
    }
  }

  /**
   * Collect all performance metrics
   */
  private async collectAllMetrics(): Promise<void> {
    const timestamp = new Date();

    try {
      // Collect agent metrics
      await this.collectAgentMetrics(timestamp);

      // Collect system snapshot
      await this.collectSystemSnapshot(timestamp);

      // Persist to database
      await this.persistMetrics();
    } catch (error) {
      console.error("[PerformanceCollector] Failed to collect metrics:", error);
    }
  }

  /**
   * Collect agent performance metrics
   */
  private async collectAgentMetrics(timestamp: Date): Promise<void> {
    const agents = this.agentRegistry.getAllAgents();

    for (const agent of agents) {
      try {
        const metrics = await this.calculateAgentMetrics(agent.id, timestamp);

        // Add to history
        let agentHistory = this.agentMetricsHistory.get(agent.id) || [];
        agentHistory.push(metrics);

        // Keep only recent history
        if (agentHistory.length > this.maxHistorySize) {
          agentHistory = agentHistory.slice(-this.maxHistorySize);
        }

        this.agentMetricsHistory.set(agent.id, agentHistory);
      } catch (error) {
        console.error(
          `[PerformanceCollector] Failed to collect metrics for agent ${agent.id}:`,
          error
        );
      }
    }
  }

  /**
   * Calculate performance metrics for a specific agent
   */
  private async calculateAgentMetrics(
    agentId: string,
    timestamp: Date
  ): Promise<AgentPerformanceMetrics> {
    const agent = this.agentRegistry.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const healthHistory = this.agentRegistry.getAgentHealthHistory(agentId, 100);
    const recentHistory = healthHistory.filter(
      (h) => timestamp.getTime() - h.timestamp.getTime() < TIME_CONSTANTS.HOUR_MS
    );

    // Calculate basic metrics
    const totalRequests = recentHistory.length;
    const successfulRequests = recentHistory.filter((h) => h.success).length;
    const failedRequests = totalRequests - successfulRequests;

    const successRate = totalRequests > 0 ? successfulRequests / totalRequests : 0;
    const errorRate = totalRequests > 0 ? failedRequests / totalRequests : 0;

    const responseTimes = recentHistory.map((h) => h.responseTime);
    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0;

    // Calculate percentiles
    const sortedResponseTimes = [...responseTimes].sort((a, b) => a - b);
    const p95ResponseTime = this.calculatePercentile(sortedResponseTimes, 95);
    const p99ResponseTime = this.calculatePercentile(sortedResponseTimes, 99);

    // Calculate throughput (requests per minute)
    const timeWindow = TIME_CONSTANTS.MINUTE_MS;
    const recentRequests = recentHistory.filter(
      (h) => timestamp.getTime() - h.timestamp.getTime() < timeWindow
    );
    const throughput = recentRequests.length;

    // Get cache stats if available
    const cacheStats = agent.instance.getCacheStats?.() || { hitRate: 0 };
    const cacheHitRate = typeof cacheStats.hitRate === "number" ? cacheStats.hitRate : 0;

    // Estimate resource usage (simplified)
    const memoryUsage = this.estimateMemoryUsage(agent);
    const cpuUsage = this.estimateCpuUsage(agent, recentHistory);

    const lastError = recentHistory
      .filter((h) => !h.success)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]?.error;

    return {
      agentId,
      timestamp,
      responseTime: averageResponseTime,
      successRate,
      errorRate,
      throughput,
      memoryUsage,
      cpuUsage,
      cacheHitRate,
      totalRequests,
      totalErrors: failedRequests,
      averageResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      uptime: agent.health.uptime,
      lastError,
      metadata: {
        agentType: agent.type,
        agentName: agent.name,
        registeredAt: agent.registeredAt,
        dependencies: agent.dependencies,
      },
    };
  }

  /**
   * Collect system performance snapshot
   */
  private async collectSystemSnapshot(timestamp: Date): Promise<void> {
    try {
      const registryStats = this.agentRegistry.getStats();

      // Calculate workflow metrics from recent history
      const recentWorkflows = this.workflowMetricsHistory.filter(
        (w) => timestamp.getTime() - w.timestamp.getTime() < 60 * 60 * 1000 // Last hour
      );

      const runningWorkflows = 0; // Would need to be tracked separately
      const completedWorkflows = recentWorkflows.filter((w) => w.status === "completed").length;
      const failedWorkflows = recentWorkflows.filter((w) => w.status === "failed").length;

      // Calculate system metrics
      const responseTimes = Array.from(this.agentMetricsHistory.values())
        .flat()
        .filter((m) => timestamp.getTime() - m.timestamp.getTime() < 60 * 60 * 1000)
        .map((m) => m.responseTime);

      const averageResponseTime =
        responseTimes.length > 0
          ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
          : 0;

      const totalThroughput = Array.from(this.agentMetricsHistory.values())
        .flat()
        .filter((m) => timestamp.getTime() - m.timestamp.getTime() < 60 * 1000) // Last minute
        .reduce((sum, m) => sum + m.throughput, 0);

      const systemErrorRate = Array.from(this.agentMetricsHistory.values())
        .flat()
        .filter((m) => timestamp.getTime() - m.timestamp.getTime() < 60 * 60 * 1000)
        .reduce((sum, m, _, arr) => sum + m.errorRate / arr.length, 0);

      const snapshot: SystemPerformanceSnapshot = {
        timestamp,
        totalAgents: registryStats.totalAgents,
        healthyAgents: registryStats.healthyAgents,
        degradedAgents: registryStats.degradedAgents,
        unhealthyAgents: registryStats.unhealthyAgents,
        totalWorkflows: this.workflowMetricsHistory.length,
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

      this.systemSnapshotHistory.push(snapshot);

      // Keep only recent history
      if (this.systemSnapshotHistory.length > this.maxHistorySize) {
        this.systemSnapshotHistory = this.systemSnapshotHistory.slice(-this.maxHistorySize);
      }
    } catch (error) {
      console.error("[PerformanceCollector] Failed to collect system snapshot:", error);
    }
  }

  /**
   * Record workflow execution metrics
   */
  recordWorkflowExecution(result: WorkflowExecutionResult): void {
    try {
      const stepDurations = result.steps.map((step) => step.duration);
      const totalResponseTime = stepDurations.reduce((sum, duration) => sum + duration, 0);
      const averageStepTime =
        stepDurations.length > 0 ? totalResponseTime / stepDurations.length : 0;

      // Find bottleneck step
      const bottleneckStep = result.steps.reduce(
        (max, step) => (step.duration > max.duration ? step : max),
        result.steps[0]
      );

      const metrics: WorkflowPerformanceMetrics = {
        workflowId: result.workflowId,
        executionId: `${result.workflowId}-${result.startTime.getTime()}`, // Simplified
        timestamp: result.endTime,
        duration: result.duration,
        status: result.status,
        stepsExecuted: result.metadata.stepsExecuted,
        stepsSkipped: result.metadata.stepsSkipped,
        stepsFailed: result.metadata.stepsFailed,
        agentsUsed: result.metadata.agentsUsed,
        retriesPerformed: result.metadata.retriesPerformed,
        fallbacksUsed: result.metadata.fallbacksUsed,
        totalResponseTime,
        averageStepTime,
        bottleneckStep: bottleneckStep?.stepId,
        bottleneckDuration: bottleneckStep?.duration,
        resourceUsage: {
          peakMemory: this.estimateWorkflowMemoryUsage(result),
          averageMemory: this.estimateWorkflowMemoryUsage(result) * 0.8, // Simplified
          peakCpu: this.estimateWorkflowCpuUsage(result),
          averageCpu: this.estimateWorkflowCpuUsage(result) * 0.7, // Simplified
        },
        metadata: {
          workflowType: "mexc-trading", // Could be derived from workflowId
          startTime: result.startTime,
          endTime: result.endTime,
        },
      };

      this.workflowMetricsHistory.push(metrics);

      // Keep only recent history
      if (this.workflowMetricsHistory.length > this.maxHistorySize) {
        this.workflowMetricsHistory = this.workflowMetricsHistory.slice(-this.maxHistorySize);
      }

      console.log(`[PerformanceCollector] Recorded workflow metrics for ${result.workflowId}`);
    } catch (error) {
      console.error("[PerformanceCollector] Failed to record workflow metrics:", error);
    }
  }

  /**
   * Generate performance report for a given period
   */
  generateReport(startDate: Date, endDate: Date): PerformanceReport {
    const periodAgentMetrics = Array.from(this.agentMetricsHistory.values())
      .flat()
      .filter((m) => m.timestamp >= startDate && m.timestamp <= endDate);

    const periodWorkflowMetrics = this.workflowMetricsHistory.filter(
      (w) => w.timestamp >= startDate && w.timestamp <= endDate
    );

    const periodSystemSnapshots = this.systemSnapshotHistory.filter(
      (s) => s.timestamp >= startDate && s.timestamp <= endDate
    );

    // Calculate agent performance scores
    const agentScores = this.calculateAgentPerformanceScores(periodAgentMetrics);
    const topPerformers = agentScores.sort((a, b) => b.score - a.score).slice(0, 5);

    const bottlenecks = periodAgentMetrics
      .reduce(
        (acc, metric) => {
          const existing = acc.find((a) => a.agentId === metric.agentId);
          if (existing) {
            existing.avgResponseTime = (existing.avgResponseTime + metric.averageResponseTime) / 2;
          } else {
            acc.push({ agentId: metric.agentId, avgResponseTime: metric.averageResponseTime });
          }
          return acc;
        },
        [] as { agentId: string; avgResponseTime: number }[]
      )
      .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
      .slice(0, 5);

    // Calculate workflow statistics
    const avgWorkflowDuration =
      periodWorkflowMetrics.length > 0
        ? periodWorkflowMetrics.reduce((sum, w) => sum + w.duration, 0) /
          periodWorkflowMetrics.length
        : 0;

    const workflowSuccessRate =
      periodWorkflowMetrics.length > 0
        ? periodWorkflowMetrics.filter((w) => w.status === "completed").length /
          periodWorkflowMetrics.length
        : 0;

    const agentUsageCounts = periodWorkflowMetrics
      .flatMap((w) => w.agentsUsed)
      .reduce(
        (acc, agentId) => {
          acc[agentId] = (acc[agentId] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

    const mostUsedAgents = Object.entries(agentUsageCounts)
      .map(([agentId, usageCount]) => ({ agentId, usageCount }))
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5);

    // Calculate trends
    const trends = this.calculateTrends(periodSystemSnapshots);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      periodAgentMetrics,
      periodWorkflowMetrics,
      periodSystemSnapshots
    );

    return {
      period: { start: startDate, end: endDate },
      agents: {
        total: new Set(periodAgentMetrics.map((m) => m.agentId)).size,
        metrics: periodAgentMetrics,
        topPerformers,
        bottlenecks,
      },
      workflows: {
        total: periodWorkflowMetrics.length,
        metrics: periodWorkflowMetrics,
        averageDuration: avgWorkflowDuration,
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

  /**
   * Get current performance summary
   */
  getCurrentSummary(): {
    agents: { total: number; healthy: number; degraded: number; unhealthy: number };
    workflows: { total: number; running: number; avgDuration: number };
    system: { avgResponseTime: number; throughput: number; errorRate: number };
  } {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const recentAgentMetrics = Array.from(this.agentMetricsHistory.values())
      .flat()
      .filter((m) => m.timestamp >= oneHourAgo);

    const recentWorkflowMetrics = this.workflowMetricsHistory.filter(
      (w) => w.timestamp >= oneHourAgo
    );

    const registryStats = this.agentRegistry.getStats();

    const avgResponseTime =
      recentAgentMetrics.length > 0
        ? recentAgentMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) /
          recentAgentMetrics.length
        : 0;

    const totalThroughput = recentAgentMetrics.reduce((sum, m) => sum + m.throughput, 0);

    const avgErrorRate =
      recentAgentMetrics.length > 0
        ? recentAgentMetrics.reduce((sum, m) => sum + m.errorRate, 0) / recentAgentMetrics.length
        : 0;

    const avgWorkflowDuration =
      recentWorkflowMetrics.length > 0
        ? recentWorkflowMetrics.reduce((sum, w) => sum + w.duration, 0) /
          recentWorkflowMetrics.length
        : 0;

    return {
      agents: {
        total: registryStats.totalAgents,
        healthy: registryStats.healthyAgents,
        degraded: registryStats.degradedAgents,
        unhealthy: registryStats.unhealthyAgents,
      },
      workflows: {
        total: recentWorkflowMetrics.length,
        running: 0, // Would need to be tracked separately
        avgDuration: avgWorkflowDuration,
      },
      system: {
        avgResponseTime,
        throughput: totalThroughput,
        errorRate: avgErrorRate,
      },
    };
  }

  /**
   * Persist metrics to database
   */
  private async persistMetrics(): Promise<void> {
    try {
      // This would require adding the performance tables to the schema
      // For now, we'll just log the metrics
      console.log("[PerformanceCollector] Metrics collected successfully");

      // TODO: Implement database persistence when schema is ready
      // await db.insert(agentPerformanceMetrics).values(...)
      // await db.insert(workflowPerformanceMetrics).values(...)
      // await db.insert(systemPerformanceSnapshots).values(...)
    } catch (error) {
      console.error("[PerformanceCollector] Failed to persist metrics:", error);
    }
  }

  // Helper methods for calculations
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  private estimateMemoryUsage(agent: any): number {
    // Simplified memory estimation based on cache size and agent type
    const cacheStats = agent.instance.getCacheStats?.() || { size: 0 };
    return Math.max(10, cacheStats.size * 0.001); // MB
  }

  private estimateCpuUsage(_agent: any, healthHistory: any[]): number {
    // Simplified CPU estimation based on response times
    const recentResponseTimes = healthHistory.slice(-10).map((h) => h.responseTime);
    const avgResponseTime =
      recentResponseTimes.length > 0
        ? recentResponseTimes.reduce((sum, time) => sum + time, 0) / recentResponseTimes.length
        : 0;

    return Math.min(100, Math.max(0, avgResponseTime / 100)); // Rough estimation
  }

  private estimateWorkflowMemoryUsage(result: WorkflowExecutionResult): number {
    return Math.max(50, result.metadata.agentsUsed.length * 20); // MB
  }

  private estimateWorkflowCpuUsage(result: WorkflowExecutionResult): number {
    return Math.min(100, Math.max(0, result.duration / 1000)); // Rough estimation
  }

  private getSystemMemoryUsage(): number {
    const memUsage = process.memoryUsage();
    return memUsage.heapUsed / (1024 * 1024); // MB
  }

  private getSystemCpuUsage(): number {
    // Simplified - would need to use a proper system monitoring library
    return Math.random() * 20 + 10; // 10-30% random for demo
  }

  private async getDatabaseConnections(): Promise<number> {
    // Would need to query database connection pool
    return 1; // Simplified
  }

  private getSystemUptime(): number {
    return process.uptime() * 1000; // milliseconds
  }

  private calculateAgentPerformanceScores(
    metrics: AgentPerformanceMetrics[]
  ): { agentId: string; score: number }[] {
    const agentGroups = metrics.reduce(
      (acc, metric) => {
        if (!acc[metric.agentId]) acc[metric.agentId] = [];
        acc[metric.agentId].push(metric);
        return acc;
      },
      {} as Record<string, AgentPerformanceMetrics[]>
    );

    return Object.entries(agentGroups).map(([agentId, agentMetrics]) => {
      const avgSuccessRate =
        agentMetrics.reduce((sum, m) => sum + m.successRate, 0) / agentMetrics.length;
      const avgResponseTime =
        agentMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / agentMetrics.length;
      const avgUptime = agentMetrics.reduce((sum, m) => sum + m.uptime, 0) / agentMetrics.length;

      // Calculate composite score (higher is better)
      const score =
        avgSuccessRate * 40 + Math.max(0, 100 - avgResponseTime / 10) * 30 + avgUptime * 0.3;

      return { agentId, score };
    });
  }

  private calculateTrends(snapshots: SystemPerformanceSnapshot[]): {
    responseTime: { trend: "improving" | "degrading" | "stable"; change: number };
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
      ((last.averageResponseTime - first.averageResponseTime) / first.averageResponseTime) * 100;
    const throughputChange = ((last.throughput - first.throughput) / first.throughput) * 100;
    const errorRateChange = ((last.errorRate - first.errorRate) / (first.errorRate || 1)) * 100;

    const getTrend = (change: number) => {
      if (Math.abs(change) < 5) return "stable";
      return change > 0 ? "degrading" : "improving";
    };

    return {
      responseTime: { trend: getTrend(responseTimeChange), change: responseTimeChange },
      throughput: { trend: getTrend(-throughputChange), change: throughputChange }, // Higher throughput is better
      errorRate: { trend: getTrend(errorRateChange), change: errorRateChange },
    };
  }

  private generateRecommendations(
    agentMetrics: AgentPerformanceMetrics[],
    workflowMetrics: WorkflowPerformanceMetrics[],
    systemSnapshots: SystemPerformanceSnapshot[]
  ): string[] {
    const recommendations: string[] = [];

    // Analyze agent performance
    const highErrorRateAgents = agentMetrics.filter((m) => m.errorRate > 0.1);
    if (highErrorRateAgents.length > 0) {
      recommendations.push(
        `High error rate detected in agents: ${highErrorRateAgents.map((m) => m.agentId).join(", ")}. Consider investigating agent health.`
      );
    }

    const slowAgents = agentMetrics.filter((m) => m.averageResponseTime > 5000);
    if (slowAgents.length > 0) {
      recommendations.push(
        `Slow response times detected in agents: ${slowAgents.map((m) => m.agentId).join(", ")}. Consider optimizing or scaling.`
      );
    }

    // Analyze workflow performance
    const failedWorkflows = workflowMetrics.filter((w) => w.status === "failed");
    if (failedWorkflows.length / workflowMetrics.length > 0.1) {
      recommendations.push(
        `High workflow failure rate (${((failedWorkflows.length / workflowMetrics.length) * 100).toFixed(1)}%). Review workflow configurations and dependencies.`
      );
    }

    // Analyze system performance
    const latestSnapshot = systemSnapshots[systemSnapshots.length - 1];
    if (latestSnapshot?.unhealthyAgents > 0) {
      recommendations.push(
        `${latestSnapshot.unhealthyAgents} unhealthy agents detected. Investigate agent health and dependencies.`
      );
    }

    if (latestSnapshot?.systemMemoryUsage > 1000) {
      // > 1GB
      recommendations.push(
        "High system memory usage detected. Consider optimizing cache usage or scaling resources."
      );
    }

    return recommendations;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopCollection();
    this.agentMetricsHistory.clear();
    this.workflowMetricsHistory = [];
    this.systemSnapshotHistory = [];

    console.log("[PerformanceCollector] Performance collector destroyed");
  }
}
