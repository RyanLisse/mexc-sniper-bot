/**
 * Streamlined Cache Monitoring System
 *
 * Refactored to use extracted modules and reduce file size from 1051 to under 500 lines
 */

import { globalAPIResponseCache } from "./api-response-cache";
import { globalCacheManager } from "./cache-manager";
import { CacheAlertManager } from "./cache-monitoring/alert-manager";
import { CachePerformanceCalculator } from "./cache-monitoring/performance-calculator";
import type {
  CacheAlert,
  CacheMonitoringConfig,
  CacheRecommendation,
  PerformanceReport,
  SystemCacheMetrics,
} from "./cache-monitoring/types";
import { globalEnhancedAgentCache } from "./enhanced-agent-cache";
import { createConsoleLogger } from "./shared/console-logger";

export class StreamlinedCacheMonitoringSystem {
  private logger = createConsoleLogger("cache-monitoring");
  private config: CacheMonitoringConfig;
  private metricsHistory: SystemCacheMetrics[] = [];
  private alertManager: CacheAlertManager;
  private monitoringInterval?: NodeJS.Timeout;
  private performanceBaseline?: SystemCacheMetrics;

  constructor(config: Partial<CacheMonitoringConfig> = {}) {
    this.config = {
      enableRealTimeMonitoring: true,
      monitoringInterval: 30000,
      performanceThresholds: {
        minHitRate: 70,
        maxMemoryUsage: 500 * 1024 * 1024,
        maxResponseTime: 100,
        maxCacheSize: 50000,
      },
      alerting: {
        enabled: true,
        channels: ["console"],
      },
      enableMetricsCollection: true,
      metricsRetentionDays: 7,
      ...config,
    };

    this.alertManager = new CacheAlertManager(this.config);

    if (this.config.enableRealTimeMonitoring) {
      this.startRealTimeMonitoring();
    }
  }

  /**
   * Start real-time monitoring
   */
  private startRealTimeMonitoring(): void {
    this.logger.info("Starting real-time cache monitoring");

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
        await this.analyzePerformance();
        await this.alertManager.checkThresholds(
          this.metricsHistory[this.metricsHistory.length - 1]
        );
        this.cleanupOldMetrics();
      } catch (error) {
        this.logger.error("Monitoring cycle error", {
          error: error instanceof Error ? error.message : error,
        });
      }
    }, this.config.monitoringInterval);
  }

  /**
   * Collect comprehensive metrics
   */
  private async collectMetrics(): Promise<SystemCacheMetrics> {
    try {
      const timestamp = Date.now();
      const globalMetrics = globalCacheManager.getMetrics();
      const sizeBreakdown = globalCacheManager.getSizeBreakdown();
      const agentAnalytics = await globalEnhancedAgentCache.getAnalytics();
      const apiAnalytics = globalAPIResponseCache.getAnalytics();

      const performance = CachePerformanceCalculator.calculatePerformanceMetrics(
        globalMetrics,
        agentAnalytics,
        apiAnalytics
      );

      const health = CachePerformanceCalculator.assessSystemHealth(globalMetrics, performance);

      const metrics: SystemCacheMetrics = {
        timestamp,
        global: globalMetrics,
        levels: {
          L1: { ...globalMetrics, totalSize: sizeBreakdown.L1 },
          L2: { ...globalMetrics, totalSize: sizeBreakdown.L2 },
          L3: { ...globalMetrics, totalSize: sizeBreakdown.L3 },
        },
        agents: agentAnalytics,
        apis: apiAnalytics,
        performance,
        health,
      };

      if (this.config.enableMetricsCollection) {
        this.metricsHistory.push(metrics);
        if (!this.performanceBaseline) {
          this.performanceBaseline = metrics;
        }
      }

      return metrics;
    } catch (error) {
      this.logger.error("Error collecting metrics", {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  /**
   * Analyze performance and generate recommendations
   */
  private async analyzePerformance(): Promise<void> {
    if (this.metricsHistory.length < 2) return;

    const current = this.metricsHistory[this.metricsHistory.length - 1];
    const previous = this.metricsHistory[this.metricsHistory.length - 2];

    try {
      this.alertManager.analyzeTrends(current, previous);
      this.alertManager.generateRecommendations(current);
    } catch (error) {
      this.logger.error("Performance analysis error", {
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * Get current cache status
   */
  async getCurrentStatus(): Promise<SystemCacheMetrics> {
    return await this.collectMetrics();
  }

  /**
   * Get performance report
   */
  getPerformanceReport(startTime: number, endTime: number = Date.now()): PerformanceReport {
    const metrics = this.metricsHistory.filter(
      (m) => m.timestamp >= startTime && m.timestamp <= endTime
    );

    if (metrics.length === 0) {
      throw new Error("No metrics available for the specified period");
    }

    const firstMetric = metrics[0];
    const lastMetric = metrics[metrics.length - 1];

    const summary = CachePerformanceCalculator.calculateSummaryStats(metrics);
    const trends = CachePerformanceCalculator.analyzeTrends(firstMetric, lastMetric);
    const breakdown = this.calculateBreakdown(metrics);

    const alerts = this.alertManager
      .getActiveAlerts()
      .filter((alert) => alert.timestamp >= startTime && alert.timestamp <= endTime);

    const recommendations = this.alertManager
      .getCurrentRecommendations()
      .filter((rec) => rec.timestamp >= startTime && rec.timestamp <= endTime);

    return {
      period: { start: startTime, end: endTime, duration: endTime - startTime },
      summary,
      trends,
      breakdown,
      alerts,
      recommendations,
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): CacheAlert[] {
    return this.alertManager.getActiveAlerts();
  }

  /**
   * Get current recommendations
   */
  getCurrentRecommendations(): CacheRecommendation[] {
    return this.alertManager.getCurrentRecommendations();
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<boolean> {
    return await this.alertManager.resolveAlert(alertId);
  }

  /**
   * Force cache optimization
   */
  async optimizeCache(): Promise<{ actions: string[]; improvements: Record<string, number> }> {
    const current = await this.getCurrentStatus();
    const actions: string[] = [];
    const improvements: Record<string, number> = {};

    try {
      if (current.health.status === "degraded" || current.health.status === "critical") {
        const cleanupResults = globalCacheManager.cleanup();
        actions.push(`Cleaned up ${cleanupResults.total} expired entries`);
        improvements.memoryReduction = cleanupResults.total * 1024;

        const optimizationResults = globalCacheManager.optimize();
        actions.push(...optimizationResults.actions);
        // Merge optimization improvements
        Object.assign(improvements, optimizationResults.improvements);
      }

      if (current.global.hitRate < 60) {
        actions.push("Recommended: Increase TTL for stable data types");
        improvements.hitRateImprovement = 15;
      }

      if (
        current.performance.totalMemoryUsage >
        this.config.performanceThresholds.maxMemoryUsage * 0.8
      ) {
        actions.push("Recommended: Enable more aggressive cache cleanup");
        improvements.memoryReduction = current.performance.totalMemoryUsage * 0.2;
      }

      this.logger.info(`Cache optimization completed: ${actions.length} actions taken`);
      return { actions, improvements };
    } catch (error) {
      this.logger.error("Cache optimization error", {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  /**
   * Calculate breakdown by component
   */
  private calculateBreakdown(_metrics: SystemCacheMetrics[]) {
    return {
      agents: {} as Record<string, any>,
      apis: {} as Record<string, any>,
      levels: {} as Record<string, any>,
    };
  }

  /**
   * Cleanup old metrics
   */
  private cleanupOldMetrics(): void {
    if (!this.config.enableMetricsCollection) return;

    const cutoff = Date.now() - this.config.metricsRetentionDays * 24 * 60 * 60 * 1000;
    this.metricsHistory = this.metricsHistory.filter((m) => m.timestamp > cutoff);
  }

  /**
   * Stop monitoring
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.metricsHistory = [];
    this.logger.info("Cache monitoring system destroyed");
  }
}

// Global instance with lazy initialization
let globalInstance: StreamlinedCacheMonitoringSystem | null = null;

export function getGlobalCacheMonitoring(): StreamlinedCacheMonitoringSystem {
  if (!globalInstance) {
    globalInstance = new StreamlinedCacheMonitoringSystem({
      enableRealTimeMonitoring: true,
      monitoringInterval: 30000,
      performanceThresholds: {
        minHitRate: 70,
        maxMemoryUsage: 500 * 1024 * 1024,
        maxResponseTime: 100,
        maxCacheSize: 50000,
      },
      alerting: { enabled: true, channels: ["console"] },
      enableMetricsCollection: true,
      metricsRetentionDays: 7,
    });
  }
  return globalInstance;
}

// Legacy compatibility
export const globalCacheMonitoring = {
  getCurrentStatus: () => getGlobalCacheMonitoring().getCurrentStatus(),
  getPerformanceReport: (start: number, end?: number) =>
    getGlobalCacheMonitoring().getPerformanceReport(start, end),
  getActiveAlerts: () => getGlobalCacheMonitoring().getActiveAlerts(),
  getCurrentRecommendations: () => getGlobalCacheMonitoring().getCurrentRecommendations(),
  resolveAlert: (id: string) => getGlobalCacheMonitoring().resolveAlert(id),
  optimizeCache: () => getGlobalCacheMonitoring().optimizeCache(),
  destroy: () => {
    if (globalInstance) {
      globalInstance.destroy();
      globalInstance = null;
    }
  },
};

// Utility functions
export async function getCacheHealthStatus(): Promise<{
  status: "healthy" | "degraded" | "critical";
  summary: string;
  details: SystemCacheMetrics;
}> {
  const details = await globalCacheMonitoring.getCurrentStatus();
  let summary: string;

  switch (details.health.status) {
    case "healthy":
      summary = `Cache system operating normally. Hit rate: ${details.global.hitRate.toFixed(1)}%`;
      break;
    case "degraded":
      summary = `Cache system has minor issues. ${details.health.warnings.join(", ")}`;
      break;
    case "critical":
      summary = `Cache system requires immediate attention. ${details.health.issues.join(", ")}`;
      break;
  }

  return { status: details.health.status, summary, details };
}

export async function getCacheDashboardData() {
  const status = await globalCacheMonitoring.getCurrentStatus();
  const alerts = globalCacheMonitoring.getActiveAlerts();
  const recommendations = globalCacheMonitoring.getCurrentRecommendations();

  return {
    overview: {
      hitRate: status.global.hitRate,
      memoryUsage: `${(status.performance.totalMemoryUsage / 1024 / 1024).toFixed(1)}MB`,
      totalRequests: status.global.hits + status.global.misses,
      responseTime: status.performance.responseTimeP95,
    },
    alerts: alerts.slice(0, 5),
    recommendations: recommendations.slice(0, 3),
    trends: {
      hitRate: [status.global.hitRate],
      memoryUsage: [status.performance.totalMemoryUsage],
      responseTime: [status.performance.responseTimeP95],
    },
  };
}

// Re-export types for external use
export type * from "./cache-monitoring/types";
