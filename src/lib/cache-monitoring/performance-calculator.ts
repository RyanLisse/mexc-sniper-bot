/**
 * Cache Performance Calculator
 *
 * Extracted performance calculation logic from cache-monitoring.ts
 */

import type { APICacheAnalytics } from "../api-response-cache";
import type { CacheMetrics } from "../cache-manager";
import type { AgentCacheAnalytics } from "../enhanced-agent-cache";
import type { SystemCacheMetrics } from "./types";

export class CachePerformanceCalculator {
  /**
   * Calculate comprehensive performance metrics
   */
  static calculatePerformanceMetrics(
    globalMetrics: CacheMetrics,
    agentAnalytics: AgentCacheAnalytics,
    apiAnalytics: APICacheAnalytics
  ) {
    const baseMemoryUsage = globalMetrics.memoryUsage;

    // Calculate agent memory usage based on actual performance data
    let agentMemoryUsage = 0;
    const agentCount = Object.keys(agentAnalytics.agentPerformance).length;
    for (const [_agentId, perf] of Object.entries(agentAnalytics.agentPerformance)) {
      const baseSize = Math.max(perf.totalRequests * 4096, 256 * 1024);
      const activityMultiplier = Math.max(1, perf.totalRequests / 10);
      agentMemoryUsage += baseSize * activityMultiplier;
    }

    // Calculate API memory usage based on endpoint activity
    let apiMemoryUsage = 0;
    const endpointCount = Object.keys(apiAnalytics.endpoints).length;
    for (const [_endpoint, stats] of Object.entries(apiAnalytics.endpoints)) {
      const baseSize = Math.max(stats.totalRequests * 2048, 128 * 1024);
      const activityMultiplier = Math.max(1, stats.totalRequests / 5);
      apiMemoryUsage += baseSize * activityMultiplier;
    }

    // Dynamic baseline calculation
    let dynamicBaseline = 4 * 1024 * 1024; // 4MB baseline
    if (agentCount > 0) {
      dynamicBaseline += agentCount * 512 * 1024;
    }
    if (endpointCount > 0) {
      dynamicBaseline += endpointCount * 256 * 1024;
    }

    const cacheSizeImpact = globalMetrics.totalSize * 1024;
    const totalMemoryUsage = Math.max(
      baseMemoryUsage + agentMemoryUsage + apiMemoryUsage + cacheSizeImpact,
      dynamicBaseline
    );

    return {
      totalMemoryUsage,
      responseTimeP95: globalMetrics.averageAccessTime * 1.5,
      responseTimeP99: globalMetrics.averageAccessTime * 2,
      throughput: globalMetrics.hits + globalMetrics.misses,
      errorRate: 0,
    };
  }

  /**
   * Assess system health based on metrics
   */
  static assessSystemHealth(globalMetrics: CacheMetrics, performance: any) {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check hit rate
    if (globalMetrics.hitRate < 50) {
      issues.push("Very low cache hit rate");
    } else if (globalMetrics.hitRate < 70) {
      warnings.push("Low cache hit rate");
    }

    // Check memory usage
    const memoryUsageMB = performance.totalMemoryUsage / 1024 / 1024;
    if (memoryUsageMB > 1000) {
      issues.push("High memory usage");
    } else if (memoryUsageMB > 500) {
      warnings.push("Elevated memory usage");
    }

    let status: "healthy" | "degraded" | "critical";
    if (issues.length > 0) {
      status = "critical";
    } else if (warnings.length > 0) {
      status = "degraded";
    } else {
      status = "healthy";
    }

    return { status, issues, warnings };
  }

  /**
   * Calculate summary statistics from metrics array
   */
  static calculateSummaryStats(metrics: SystemCacheMetrics[]) {
    const totalRequests = metrics.reduce((sum, m) => sum + m.global.hits + m.global.misses, 0);
    const totalHits = metrics.reduce((sum, m) => sum + m.global.hits, 0);
    const totalMisses = metrics.reduce((sum, m) => sum + m.global.misses, 0);
    const avgResponseTime =
      metrics.reduce((sum, m) => sum + m.global.averageAccessTime, 0) / metrics.length;
    const avgMemoryUsage =
      metrics.reduce((sum, m) => sum + m.performance.totalMemoryUsage, 0) / metrics.length;

    return {
      totalRequests,
      cacheHits: totalHits,
      cacheMisses: totalMisses,
      hitRate: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0,
      averageResponseTime: avgResponseTime,
      memoryUsage: avgMemoryUsage,
      errorRate: 0,
    };
  }

  /**
   * Analyze trends between metrics
   */
  static analyzeTrends(first: SystemCacheMetrics, last: SystemCacheMetrics) {
    const hitRateChange = last.global.hitRate - first.global.hitRate;
    const memoryChange = last.performance.totalMemoryUsage - first.performance.totalMemoryUsage;
    const responseChange = last.performance.responseTimeP95 - first.performance.responseTimeP95;

    return {
      hitRateTrend:
        hitRateChange > 5
          ? ("improving" as const)
          : hitRateChange < -5
            ? ("declining" as const)
            : ("stable" as const),
      memoryTrend:
        memoryChange < -0.1
          ? ("improving" as const)
          : memoryChange > 0.2
            ? ("increasing" as const)
            : ("stable" as const),
      responseTrend:
        responseChange < -10
          ? ("improving" as const)
          : responseChange > 10
            ? ("degrading" as const)
            : ("stable" as const),
    };
  }

  /**
   * Calculate confidence distribution
   */
  static calculateConfidenceDistribution(matches: any[]): Record<string, number> {
    const distribution = { "0-50": 0, "50-70": 0, "70-85": 0, "85-100": 0 };

    matches.forEach((match) => {
      if (match.confidence < 50) distribution["0-50"]++;
      else if (match.confidence < 70) distribution["50-70"]++;
      else if (match.confidence < 85) distribution["70-85"]++;
      else distribution["85-100"]++;
    });

    return distribution;
  }
}
