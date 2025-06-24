/**
* Cache Analytics Manager
 *
 * Provides comprehensive analytics and reporting for the agent cache system.
 * Generates insights, recommendations, and performance reports across all cache components.
 *
 * FEATURES:
 * - Comprehensive cache analytics aggregation
 * - Agent performance analysis
 * - Workflow efficiency metrics
 * - Health monitoring statistics
 * - Intelligent recommendations generation
 * - Performance trend analysis
 */

import { globalCacheManager } from "../cache-manager";
import type {
  AgentCacheAnalytics,
  AgentCacheConfig,
  AgentCacheMetrics,
  AgentHealthCache,
  WorkflowCacheEntry,
} from "./agent-cache-types";
import type { AgentHealthCacheManager } from "./agent-health-cache";
import type { CachePerformanceMonitor } from "./cache-performance-monitor";
import type { WorkflowCache } from "./workflow-cache";

export class CacheAnalyticsManager {
  private logger = {
      info: (message: string, context?: any) => console.info('[cache-analytics]', message, context || ''),
      warn: (message: string, context?: any) => console.warn('[cache-analytics]', message, context || ''),
      error: (message: string, context?: any, error?: Error) => console.error('[cache-analytics]', message, context || '', error || ''),
      debug: (message: string, context?: any) => console.debug('[cache-analytics]', message, context || ''),
    };

  private config: AgentCacheConfig;
  private performanceMonitor: CachePerformanceMonitor;
  private workflowCache: WorkflowCache;
  private healthCache: AgentHealthCacheManager;

  constructor(
    config: AgentCacheConfig,
    performanceMonitor: CachePerformanceMonitor,
    workflowCache: WorkflowCache,
    healthCache: AgentHealthCacheManager
  ) {
    this.config = config;
    this.performanceMonitor = performanceMonitor;
    this.workflowCache = workflowCache;
    this.healthCache = healthCache;
  }

  /**
   * Get comprehensive agent cache analytics
   */
  async getAnalytics(): Promise<AgentCacheAnalytics> {
    try {
      const globalAnalytics = globalCacheManager.getAnalytics();

      // Agent performance analytics
      const agentPerformance: Record<string, any> = {};
      const allMetrics = this.performanceMonitor.getAllMetrics();

      for (const [agentId, metrics] of allMetrics.entries()) {
        const totalRequests = metrics.totalExecutions;
        const cacheHits = metrics.cacheHits;

        agentPerformance[agentId] = {
          hitRate: totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0,
          averageResponseTime: metrics.avgResponseTime,
          errorRate: metrics.errorRate,
          cacheEfficiency: this.performanceMonitor.calculateCacheEfficiency(agentId),
          totalRequests: totalRequests,
        };
      }

      // Workflow efficiency analytics
      const workflowStats = this.calculateWorkflowStats();

      // Health monitoring analytics
      const healthStats = await this.calculateHealthStats();

      // Generate recommendations
      const recommendations = this.generateAgentCacheRecommendations(
        agentPerformance,
        workflowStats,
        healthStats,
        globalAnalytics
      );

      return {
        agentPerformance,
        workflowEfficiency: workflowStats,
        healthMonitoring: {
          healthyAgents: healthStats.healthyAgents,
          degradedAgents: healthStats.degradedAgents,
          unhealthyAgents: healthStats.unhealthyAgents,
          averageResponseTime: healthStats.averageResponseTime,
        },
        recommendations: recommendations,
      };
    } catch (error) {
      console.error("[CacheAnalytics] Error generating analytics:", error);
      return {
        agentPerformance: {},
        workflowEfficiency: {
          totalWorkflows: 0,
          cachedWorkflows: 0,
          cacheHitRate: 0,
          averageExecutionTime: 0,
          timesSaved: 0,
        },
        healthMonitoring: {
          healthyAgents: 0,
          degradedAgents: 0,
          unhealthyAgents: 0,
          averageResponseTime: 0,
        },
        recommendations: ["Error retrieving analytics - please check system health"],
      };
    }
  }

  /**
   * Get performance insights for specific agent
   */
  getAgentInsights(agentId: string): {
    metrics: AgentCacheMetrics | null;
    insights: string[];
    recommendations: string[];
    efficiency: number;
  } {
    const metrics = this.performanceMonitor.getAgentMetrics(agentId);
    const insights: string[] = [];
    const recommendations: string[] = [];
    const efficiency = this.performanceMonitor.calculateCacheEfficiency(agentId);

    if (!metrics) {
      return {
        metrics: null,
        insights: ["No performance data available for this agent"],
        recommendations: ["Start using this agent to collect performance metrics"],
        efficiency: 0,
      };
    }

    // Generate insights
    const hitRate =
      metrics.totalExecutions > 0 ? (metrics.cacheHits / metrics.totalExecutions) * 100 : 0;
    insights.push(`Cache hit rate: ${hitRate.toFixed(1)}%`);
    insights.push(`Average response time: ${metrics.avgResponseTime.toFixed(0)}ms`);
    insights.push(`Error rate: ${metrics.errorRate.toFixed(1)}%`);
    insights.push(`Total executions: ${metrics.totalExecutions}`);
    insights.push(`Cache efficiency score: ${efficiency.toFixed(1)}/100`);

    // Generate recommendations
    if (hitRate < 30) {
      recommendations.push("Low cache hit rate - consider increasing TTL or optimizing cache keys");
    }
    if (metrics.avgResponseTime > 5000) {
      recommendations.push("High response time - investigate performance bottlenecks");
    }
    if (metrics.errorRate > 10) {
      recommendations.push("High error rate - review agent error handling");
    }
    if (efficiency < 50) {
      recommendations.push("Low efficiency score - review overall caching strategy");
    }
    if (metrics.totalExecutions < 10) {
      recommendations.push("Low usage - consider increasing agent utilization");
    }

    if (recommendations.length === 0) {
      recommendations.push("Agent performance is within acceptable ranges");
    }

    return {
      metrics,
      insights,
      recommendations,
      efficiency,
    };
  }

  /**
   * Get system-wide performance summary
   */
  async getSystemSummary(): Promise<{
    totalAgents: number;
    totalWorkflows: number;
    overallHitRate: number;
    averageResponseTime: number;
    systemHealth: "healthy" | "degraded" | "critical";
    topIssues: string[];
  }> {
    const analytics = await this.getAnalytics();
    const agents = Object.keys(analytics.agentPerformance);
    const totalAgents = agents.length;
    const totalWorkflows = analytics.workflowEfficiency.totalWorkflows;

    // Calculate overall hit rate
    const hitRates = Object.values(analytics.agentPerformance).map((perf: any) => perf.hitRate);
    const overallHitRate =
      hitRates.length > 0 ? hitRates.reduce((sum, rate) => sum + rate, 0) / hitRates.length : 0;

    // Calculate average response time
    const responseTimes = Object.values(analytics.agentPerformance).map(
      (perf: any) => perf.averageResponseTime
    );
    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0;

    // Determine system health
    const unhealthyAgents = analytics.agentHealthStats.unhealthyAgents;
    const degradedAgents = analytics.agentHealthStats.degradedAgents;
    let systemHealth: "healthy" | "degraded" | "critical" = "healthy";

    if (unhealthyAgents > 0 || overallHitRate < 30) {
      systemHealth = "critical";
    } else if (degradedAgents > 0 || overallHitRate < 60) {
      systemHealth = "degraded";
    }

    // Identify top issues
    const topIssues: string[] = [];
    if (overallHitRate < 50) {
      topIssues.push(`Low overall cache hit rate: ${overallHitRate.toFixed(1)}%`);
    }
    if (averageResponseTime > 3000) {
      topIssues.push(`High average response time: ${averageResponseTime.toFixed(0)}ms`);
    }
    if (unhealthyAgents > 0) {
      topIssues.push(`${unhealthyAgents} unhealthy agents detected`);
    }
    if (totalAgents === 0) {
      topIssues.push("No active agents detected");
    }

    return {
      totalAgents,
      totalWorkflows,
      overallHitRate,
      averageResponseTime,
      systemHealth,
      topIssues,
    };
  }

  /**
   * Export analytics data for external analysis
   */
  async exportAnalytics(): Promise<{
    timestamp: string;
    analytics: AgentCacheAnalytics;
    summary: any;
    rawMetrics: {
      agents: Map<string, AgentCacheMetrics>;
      workflows: any;
      health: any;
    };
  }> {
    const analytics = await this.getAnalytics();
    const summary = await this.getSystemSummary();
    const allHealth = await this.healthCache.getAllAgentHealth();

    return {
      timestamp: new Date().toISOString(),
      analytics,
      summary,
      rawMetrics: {
        agents: this.performanceMonitor.getAllMetrics(),
        workflows: this.workflowCache.getWorkflowStats(),
        health: Object.fromEntries(allHealth),
      },
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Calculate workflow statistics
   */
  private calculateWorkflowStats() {
    return this.workflowCache.getWorkflowStats();
  }

  /**
   * Calculate health statistics
   */
  private async calculateHealthStats() {
    return await this.healthCache.getHealthStatistics();
  }

  /**
   * Calculate estimated memory usage
   */
  private calculateMemoryUsage(): number {
    const agentMetrics = this.performanceMonitor.getAllMetrics().size * 500;
    const workflowCacheSize = this.workflowCache.getWorkflowCacheSize() * 1000;
    const healthCacheSize = this.healthCache.getHealthCacheSize() * 300;

    return agentMetrics + workflowCacheSize + healthCacheSize;
  }

  /**
   * Generate intelligent recommendations based on cache analytics
   */
  private generateAgentCacheRecommendations(
    agentPerformance: Record<string, any>,
    workflowStats: any,
    healthStats: any,
    globalAnalytics: any
  ): string[] {
    const recommendations: string[] = [];

    // Agent performance recommendations
    for (const [agentId, perf] of Object.entries(agentPerformance)) {
      if (perf.hitRate < 50) {
        recommendations.push(
          `Agent ${agentId} has low cache hit rate (${perf.hitRate.toFixed(1)}%) - consider longer TTL or better caching strategy`
        );
      }
      if (perf.errorRate > 10) {
        recommendations.push(
          `Agent ${agentId} has high error rate (${perf.errorRate.toFixed(1)}%) - review agent implementation`
        );
      }
      if (perf.totalRequests > 10 && perf.hitRate === 0) {
        recommendations.push(
          `Agent ${agentId} has zero cache hit rate - review cache implementation and dependency invalidation`
        );
      }
      if (perf.averageResponseTime > 1000) {
        recommendations.push(
          `Agent ${agentId} has high response time (${perf.averageResponseTime.toFixed(0)}ms) - consider performance optimization`
        );
      }
    }

    const totalAgents = Object.keys(agentPerformance).length;
    if (totalAgents === 0) {
      recommendations.push(
        "No agent performance data available - ensure cache tracking is enabled"
      );
    }

    // Check for low overall hit rates
    const avgHitRate =
      totalAgents > 0
        ? Object.values(agentPerformance).reduce(
            (sum: number, perf: any) => sum + perf.hitRate,
            0
          ) / totalAgents
        : 0;

    if (avgHitRate < 50 && totalAgents > 0) {
      recommendations.push(
        "Overall agent cache hit rate is low - consider implementing cache warming or reviewing cache invalidation strategies"
      );
    }

    // Workflow recommendations
    if (workflowStats.cacheHitRate < 30) {
      recommendations.push("Low workflow cache hit rate - consider caching more workflow patterns");
    }

    // Health recommendations
    if (healthStats.unhealthyAgents > 0) {
      recommendations.push(
        `${healthStats.unhealthyAgents} agents are unhealthy - immediate attention required`
      );
    }

    // Global cache recommendations
    if (globalAnalytics?.performance && globalAnalytics.performance.hitRate < 60) {
      recommendations.push(
        "Overall cache hit rate is low - review caching strategy and TTL configuration"
      );
    }

    // Performance-specific recommendations
    if (totalAgents > 0) {
      const agentsWithHighMissRate = Object.entries(agentPerformance).filter(
        ([, perf]: [string, any]) => perf.totalRequests > 15 && perf.hitRate < 20
      );

      if (agentsWithHighMissRate.length > 0) {
        recommendations.push(
          "Multiple agents showing poor cache performance - review cache invalidation patterns and TTL settings"
        );
      }

      const allLowHitRate = Object.values(agentPerformance).every((perf: any) => perf.hitRate < 30);
      if (allLowHitRate && totalAgents > 1) {
        recommendations.push(
          "All agents showing low cache hit rates - consider cache warming strategy or review invalidation logic"
        );
      }
    }

    // Memory and efficiency recommendations
    if (totalAgents > 2) {
      recommendations.push(
        "Consider implementing cache optimization strategies for better memory usage"
      );
    }

    // Default recommendations if none generated
    if (recommendations.length === 0) {
      if (totalAgents > 0) {
        recommendations.push(
          "Consider implementing cache prewarming for frequently used agent patterns to improve performance"
        );
      } else {
        recommendations.push("Enable agent cache performance tracking for better insights");
      }
    }

    return recommendations;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AgentCacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
