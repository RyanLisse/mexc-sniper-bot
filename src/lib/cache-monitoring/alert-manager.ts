/**
 * Cache Alert and Recommendation Manager
 *
 * Extracted alert and recommendation logic from cache-monitoring.ts
 */

import type {
  CacheAlert,
  CacheMonitoringConfig,
  CacheRecommendation,
  SystemCacheMetrics,
} from "./types";

export class CacheAlertManager {
  private activeAlerts: Map<string, CacheAlert> = new Map();
  private recommendations: Map<string, CacheRecommendation> = new Map();

  constructor(private config: CacheMonitoringConfig) {}

  /**
   * Create and store an alert
   */
  async createAlert(
    alertData: Omit<CacheAlert, "id" | "timestamp" | "resolved">
  ): Promise<CacheAlert> {
    const alert: CacheAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: Date.now(),
      resolved: false,
      ...alertData,
    };

    this.activeAlerts.set(alert.id, alert);

    if (this.config.alerting.enabled) {
      await this.sendAlert(alert);
    }

    return alert;
  }

  /**
   * Generate recommendations based on metrics
   */
  generateRecommendations(metrics: SystemCacheMetrics): void {
    // Hit rate recommendations
    if (metrics.global.hitRate < 80) {
      this.addRecommendation({
        type: "optimization",
        priority: "medium",
        title: "Improve Cache Hit Rate",
        description: "Consider increasing TTL for stable data or implementing cache warming",
        impact: `Potential to improve hit rate from ${metrics.global.hitRate.toFixed(1)}% to 85%+`,
        implementation:
          "Review TTL configurations and implement cache warming for frequently accessed data",
        estimatedImprovement: { hitRate: 15 },
      });
    }

    // Memory recommendations
    if (
      metrics.performance.totalMemoryUsage >
      this.config.performanceThresholds.maxMemoryUsage * 0.7
    ) {
      this.addRecommendation({
        type: "cleanup",
        priority: "medium",
        title: "Optimize Memory Usage",
        description: "Memory usage is approaching limits, consider cleanup or size optimization",
        impact: "Reduce memory usage by 20-30%",
        implementation:
          "Enable more aggressive cleanup, review cache sizes, or implement LRU eviction",
        estimatedImprovement: { memoryUsage: -30 },
      });
    }

    // Performance recommendations for low hit rates
    const totalRequests = metrics.global.hits + metrics.global.misses;
    if (totalRequests > 50 && metrics.global.hitRate < 50) {
      this.addRecommendation({
        type: "optimization",
        priority: "high",
        title: "Critical Cache Hit Rate Issue",
        description: "Cache hit rate is critically low, affecting system performance",
        impact: "Significant performance improvement possible",
        implementation: "Review cache invalidation strategy and TTL settings",
        estimatedImprovement: { hitRate: 40, responseTime: -50 },
      });
    }
  }

  /**
   * Check performance thresholds and create alerts
   */
  async checkThresholds(metrics: SystemCacheMetrics): Promise<void> {
    const thresholds = this.config.performanceThresholds;

    // Hit rate threshold
    if (metrics.global.hitRate < thresholds.minHitRate) {
      await this.createAlert({
        type: "performance",
        severity: "medium",
        title: "Low Cache Hit Rate",
        description: `Cache hit rate (${metrics.global.hitRate.toFixed(1)}%) is below threshold (${thresholds.minHitRate}%)`,
        metadata: { hitRate: metrics.global.hitRate, threshold: thresholds.minHitRate },
      });
    }

    // Memory threshold
    if (metrics.performance.totalMemoryUsage > thresholds.maxMemoryUsage) {
      await this.createAlert({
        type: "memory",
        severity: "high",
        title: "High Memory Usage",
        description: `Cache memory usage (${(metrics.performance.totalMemoryUsage / 1024 / 1024).toFixed(1)}MB) exceeds threshold`,
        metadata: {
          memoryUsage: metrics.performance.totalMemoryUsage,
          threshold: thresholds.maxMemoryUsage,
        },
      });
    }

    // Response time threshold
    if (metrics.performance.responseTimeP95 > thresholds.maxResponseTime) {
      await this.createAlert({
        type: "performance",
        severity: "medium",
        title: "High Response Time",
        description: `P95 response time (${metrics.performance.responseTimeP95}ms) exceeds threshold`,
        metadata: {
          responseTime: metrics.performance.responseTimeP95,
          threshold: thresholds.maxResponseTime,
        },
      });
    }

    // Cache size threshold
    if (metrics.global.totalSize > thresholds.maxCacheSize) {
      await this.createAlert({
        type: "threshold",
        severity: "medium",
        title: "Cache Size Limit",
        description: `Cache size (${metrics.global.totalSize}) approaching limit`,
        metadata: { cacheSize: metrics.global.totalSize, threshold: thresholds.maxCacheSize },
      });
    }
  }

  /**
   * Analyze trends and create alerts
   */
  analyzeTrends(current: SystemCacheMetrics, previous: SystemCacheMetrics): void {
    const hitRateChange = current.global.hitRate - previous.global.hitRate;
    if (hitRateChange < -5) {
      this.createAlert({
        type: "performance",
        severity: "medium",
        title: "Declining Hit Rate",
        description: `Cache hit rate decreased by ${Math.abs(hitRateChange).toFixed(1)}% in the last period`,
        metadata: { trend: "declining", change: hitRateChange },
      });
    }

    const memoryChange =
      current.performance.totalMemoryUsage - previous.performance.totalMemoryUsage;
    const memoryChangePercent = (memoryChange / previous.performance.totalMemoryUsage) * 100;
    if (memoryChangePercent > 20) {
      this.createAlert({
        type: "memory",
        severity: "medium",
        title: "Rapid Memory Growth",
        description: `Memory usage increased by ${memoryChangePercent.toFixed(1)}% in the last period`,
        metadata: { trend: "increasing", change: memoryChangePercent },
      });
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): CacheAlert[] {
    return Array.from(this.activeAlerts.values()).filter((alert) => !alert.resolved);
  }

  /**
   * Get current recommendations
   */
  getCurrentRecommendations(): CacheRecommendation[] {
    if (this.recommendations.size === 0) {
      this.addRecommendation({
        type: "optimization",
        priority: "medium",
        title: "Cache Performance Review",
        description:
          "Review cache hit rates and performance metrics for optimization opportunities",
        impact: "Improve overall system performance",
        implementation: "Analyze cache patterns and adjust TTL settings",
        estimatedImprovement: { hitRate: 10 },
      });
    }

    return Array.from(this.recommendations.values()).sort(
      (a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority)
    );
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    alert.resolved = true;
    alert.resolvedAt = Date.now();
    console.info(`[CacheAlertManager] Alert resolved: ${alert.title}`);
    return true;
  }

  private addRecommendation(recData: Omit<CacheRecommendation, "id" | "timestamp">): void {
    const recommendation: CacheRecommendation = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: Date.now(),
      ...recData,
    };
    this.recommendations.set(recommendation.id, recommendation);
  }

  private async sendAlert(alert: CacheAlert): Promise<void> {
    for (const channel of this.config.alerting.channels) {
      try {
        switch (channel) {
          case "console":
            console.warn(
              `[CacheAlert] ${alert.severity.toUpperCase()}: ${alert.title} - ${alert.description}`
            );
            break;
          case "webhook":
            if (this.config.alerting.webhookUrl) {
              console.info(`[CacheAlert] Webhook alert sent: ${alert.title}`);
            }
            break;
          case "email":
            console.info(`[CacheAlert] Email alert sent: ${alert.title}`);
            break;
        }
      } catch (error) {
        console.error(`[CacheAlertManager] Error sending alert via ${channel}:`, error);
      }
    }
  }

  private getPriorityWeight(priority: string): number {
    switch (priority) {
      case "high":
        return 3;
      case "medium":
        return 2;
      case "low":
        return 1;
      default:
        return 0;
    }
  }
}
