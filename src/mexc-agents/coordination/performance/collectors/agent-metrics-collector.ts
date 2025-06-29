/**
 * Agent Metrics Collector
 * 
 * Collects and calculates performance metrics for individual agents
 */

import { TIME_CONSTANTS } from "@/src/lib/constants";
import type { AgentRegistry } from "../../agent-registry";
import type { AgentPerformanceMetrics } from "../types";

export class AgentMetricsCollector {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[agent-metrics-collector]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[agent-metrics-collector]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[agent-metrics-collector]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[agent-metrics-collector]", message, context || ""),
  };

  constructor(private agentRegistry: AgentRegistry) {}

  /**
   * Collect agent performance metrics
   */
  async collectAgentMetrics(
    timestamp: Date,
    agentMetricsHistory: Map<string, AgentPerformanceMetrics[]>,
    maxHistorySize: number
  ): Promise<void> {
    const agents = this.agentRegistry.getAllAgents();

    for (const agent of agents) {
      try {
        // Double-check agent still exists to avoid race conditions
        const currentAgent = this.agentRegistry.getAgent(agent.id);
        if (!currentAgent) {
          // Agent was destroyed between getAllAgents() and now, skip silently
          continue;
        }

        const metrics = await this.calculateAgentMetrics(agent.id, timestamp);

        // Add to history
        let agentHistory = agentMetricsHistory.get(agent.id) || [];
        agentHistory.push(metrics);

        // Keep only recent history
        if (agentHistory.length > maxHistorySize) {
          agentHistory = agentHistory.slice(-maxHistorySize);
        }

        agentMetricsHistory.set(agent.id, agentHistory);
      } catch (error) {
        // Only log error if it's not a "not found" error (race condition)
        if (!(error as Error)?.message?.includes("not found")) {
          this.logger.error(
            `Failed to collect metrics for agent ${agent.id}:`,
            error
          );
        }
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

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  private estimateMemoryUsage(agent: any): number {
    // Simplified memory estimation based on agent type and activity
    const baseMemory = 50; // Base 50MB
    const typeMultiplier = this.getMemoryMultiplierByType(agent.type);
    const activityMultiplier = Math.min(2.0, 1.0 + (agent.health.requestCount || 0) / 1000);
    
    return Math.round(baseMemory * typeMultiplier * activityMultiplier);
  }

  private estimateCpuUsage(agent: any, recentHistory: any[]): number {
    // Simplified CPU estimation based on recent activity
    const baseUsage = 5; // Base 5%
    const activityFactor = Math.min(50, recentHistory.length * 2);
    const errorPenalty = recentHistory.filter(h => !h.success).length * 5;
    
    return Math.min(100, baseUsage + activityFactor + errorPenalty);
  }

  private getMemoryMultiplierByType(agentType: string): number {
    const multipliers: Record<string, number> = {
      'mexc-api': 1.5,
      'pattern-discovery': 2.0,
      'trading-strategy': 1.3,
      'risk-manager': 1.2,
      'calendar': 1.1,
      'default': 1.0,
    };
    
    return multipliers[agentType] || multipliers.default;
  }
}