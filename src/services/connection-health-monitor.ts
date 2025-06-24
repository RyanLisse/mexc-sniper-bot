/**
 * Connection Health Monitor
 *
 * Comprehensive monitoring service for MEXC API connection health:
 * - Real-time latency tracking
 * - Connection quality scoring
 * - Failure rate analysis
 * - Automatic health reporting
 * - Performance trend analysis
 */

import { toSafeError } from "../lib/error-type-utils";
// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ConnectionQuality {
  score: number; // 0-100
  status: "excellent" | "good" | "fair" | "poor";
  reasons: string[];
  recommendations: string[];
}

export interface HealthCheckResult {
  success: boolean;
  latency: number;
  timestamp: Date;
  error?: string;
  statusCode?: number;
  responseSize?: number;
}

export interface ConnectionTrend {
  period: "last_hour" | "last_day" | "last_week";
  averageLatency: number;
  successRate: number;
  qualityScore: number;
  trend: "improving" | "stable" | "degrading";
}

export interface PerformanceAlert {
  type: "latency_spike" | "failure_rate" | "quality_degradation" | "connection_lost";
  severity: "info" | "warning" | "critical";
  message: string;
  timestamp: Date;
  metrics: Record<string, number>;
  recommendations: string[];
}

export interface ConnectionHealthMonitorConfig {
  healthCheckInterval: number;
  latencyHistorySize: number;
  qualityThresholds: {
    excellent: number;
    good: number;
    fair: number;
  };
  alertThresholds: {
    latencySpike: number;
    failureRate: number;
    qualityDrop: number;
  };
  enableAlerts: boolean;
  enableTrendAnalysis: boolean;
  maxRetentionPeriod: number; // hours
}

// ============================================================================
// Connection Health Monitor Implementation
// ============================================================================

export class ConnectionHealthMonitor {
  private logger = {
      info: (message: string, context?: any) => console.info('[connection-health-monitor]', message, context || ''),
      warn: (message: string, context?: any) => console.warn('[connection-health-monitor]', message, context || ''),
      error: (message: string, context?: any, error?: Error) => console.error('[connection-health-monitor]', message, context || '', error || ''),
      debug: (message: string, context?: any) => console.debug('[connection-health-monitor]', message, context || ''),
    };

  private config: ConnectionHealthMonitorConfig;
  private healthChecks: HealthCheckResult[] = [];
  private latencies: number[] = [];
  private alertCallbacks: ((alert: PerformanceAlert) => void)[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  constructor(config: Partial<ConnectionHealthMonitorConfig> = {}) {
    this.config = {
      healthCheckInterval: 30000, // 30 seconds
      latencyHistorySize: 100,
      qualityThresholds: {
        excellent: 85,
        good: 65,
        fair: 45,
      },
      alertThresholds: {
        latencySpike: 3000, // 3 seconds
        failureRate: 0.2, // 20%
        qualityDrop: 20, // 20 point drop
      },
      enableAlerts: true,
      enableTrendAnalysis: true,
      maxRetentionPeriod: 24, // 24 hours
      ...config,
    };
  }

  // ============================================================================
  // Main Monitoring Methods
  // ============================================================================

  /**
   * Start continuous health monitoring
   */
  start(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.intervalId = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);

    // Perform initial check
    this.performHealthCheck();
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isMonitoring = false;
  }

  /**
   * Perform a single health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const timestamp = new Date();

    try {
      // Test basic connectivity with MEXC ping endpoint
      const response = await fetch("https://api.mexc.com/api/v3/ping", {
        method: "GET",
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      const latency = Date.now() - startTime;
      const result: HealthCheckResult = {
        success: response.ok,
        latency,
        timestamp,
        statusCode: response.status,
        responseSize: Number.parseInt(response.headers.get("content-length") || "0"),
      };

      if (!response.ok) {
        result.error = `HTTP ${response.status}: ${response.statusText}`;
      }

      this.recordHealthCheck(result);
      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      const safeError = toSafeError(error);

      const result: HealthCheckResult = {
        success: false,
        latency,
        timestamp,
        error: safeError.message,
      };

      this.recordHealthCheck(result);
      return result;
    }
  }

  /**
   * Record latency measurement
   */
  recordLatency(latency: number): void {
    this.latencies.push(latency);

    // Maintain size limit
    if (this.latencies.length > this.config.latencyHistorySize) {
      this.latencies.shift();
    }

    // Check for latency spikes
    if (this.config.enableAlerts && latency > this.config.alertThresholds.latencySpike) {
      this.triggerAlert({
        type: "latency_spike",
        severity: latency > this.config.alertThresholds.latencySpike * 2 ? "critical" : "warning",
        message: `High latency detected: ${latency}ms`,
        timestamp: new Date(),
        metrics: { latency, average: this.getAverageLatency() },
        recommendations: [
          "Check network connectivity",
          "Verify MEXC API status",
          "Consider implementing request batching",
        ],
      });
    }
  }

  // ============================================================================
  // Health Metrics and Analysis
  // ============================================================================

  /**
   * Get current health metrics
   */
  getHealthMetrics(): {
    totalChecks: number;
    successfulChecks: number;
    failedChecks: number;
    successRate: number;
    averageLatency: number;
    lastCheckTime?: Date;
    consecutiveFailures: number;
    uptime: number;
  } {
    const now = Date.now();
    const recentChecks = this.getRecentHealthChecks(1); // Last hour
    const successfulChecks = recentChecks.filter((check) => check.success).length;
    const failedChecks = recentChecks.length - successfulChecks;

    // Calculate consecutive failures
    let consecutiveFailures = 0;
    for (let i = this.healthChecks.length - 1; i >= 0; i--) {
      if (!this.healthChecks[i].success) {
        consecutiveFailures++;
      } else {
        break;
      }
    }

    // Calculate uptime (percentage of successful checks in last 24 hours)
    const last24Hours = this.getRecentHealthChecks(24);
    const uptime =
      last24Hours.length > 0
        ? (last24Hours.filter((check) => check.success).length / last24Hours.length) * 100
        : 100;

    return {
      totalChecks: recentChecks.length,
      successfulChecks,
      failedChecks,
      successRate: recentChecks.length > 0 ? successfulChecks / recentChecks.length : 1,
      averageLatency: this.getAverageLatency(),
      lastCheckTime: this.healthChecks[this.healthChecks.length - 1]?.timestamp,
      consecutiveFailures,
      uptime: Math.round(uptime * 100) / 100,
    };
  }

  /**
   * Calculate connection quality score
   */
  getConnectionQuality(): ConnectionQuality {
    const metrics = this.getHealthMetrics();
    const reasons: string[] = [];
    const recommendations: string[] = [];

    let score = 100;

    // Factor in success rate (40% of score)
    const successRateScore = metrics.successRate * 40;
    score = score * 0.6 + successRateScore;

    if (metrics.successRate < 0.9) {
      reasons.push(`Low success rate: ${(metrics.successRate * 100).toFixed(1)}%`);
      recommendations.push("Check network stability and API status");
    }

    // Factor in latency (30% of score)
    const avgLatency = metrics.averageLatency;
    let latencyScore = 30;
    if (avgLatency > 3000) {
      latencyScore = 0;
      reasons.push(`Very high latency: ${avgLatency.toFixed(0)}ms`);
      recommendations.push("Investigate network bottlenecks");
    } else if (avgLatency > 2000) {
      latencyScore = 10;
      reasons.push(`High latency: ${avgLatency.toFixed(0)}ms`);
      recommendations.push("Monitor network performance");
    } else if (avgLatency > 1000) {
      latencyScore = 20;
      reasons.push(`Moderate latency: ${avgLatency.toFixed(0)}ms`);
    }
    score = score * 0.7 + latencyScore * 0.3;

    // Factor in consecutive failures (20% of score)
    if (metrics.consecutiveFailures > 0) {
      const failurePenalty = Math.min(20, metrics.consecutiveFailures * 5);
      score -= failurePenalty;
      reasons.push(`${metrics.consecutiveFailures} consecutive failures`);
      recommendations.push("Implement circuit breaker and retry logic");
    }

    // Factor in uptime (10% of score)
    const uptimeScore = (metrics.uptime / 100) * 10;
    score = score * 0.9 + uptimeScore * 0.1;

    if (metrics.uptime < 95) {
      reasons.push(`Low uptime: ${metrics.uptime.toFixed(1)}%`);
      recommendations.push("Investigate recurring connection issues");
    }

    // Determine status based on score
    let status: ConnectionQuality["status"];
    if (score >= this.config.qualityThresholds.excellent) {
      status = "excellent";
    } else if (score >= this.config.qualityThresholds.good) {
      status = "good";
    } else if (score >= this.config.qualityThresholds.fair) {
      status = "fair";
    } else {
      status = "poor";
    }

    // Add general recommendations based on status
    if (status === "poor") {
      recommendations.push(
        "Consider implementing offline mode",
        "Add connection pooling",
        "Increase retry timeouts"
      );
    } else if (status === "fair") {
      recommendations.push("Monitor trends closely", "Optimize request patterns");
    }

    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      status,
      reasons,
      recommendations: [...new Set(recommendations)], // Remove duplicates
    };
  }

  /**
   * Get connection trends over different time periods
   */
  getConnectionTrends(): ConnectionTrend[] {
    const periods = [
      { key: "last_hour" as const, hours: 1 },
      { key: "last_day" as const, hours: 24 },
      { key: "last_week" as const, hours: 168 },
    ];

    return periods.map(({ key, hours }) => {
      const checks = this.getRecentHealthChecks(hours);
      const successful = checks.filter((check) => check.success);

      const averageLatency =
        successful.length > 0
          ? successful.reduce((sum, check) => sum + check.latency, 0) / successful.length
          : 0;

      const successRate = checks.length > 0 ? successful.length / checks.length : 1;

      // Calculate quality score for this period
      let qualityScore = 100;
      qualityScore *= successRate; // Success rate impact
      if (averageLatency > 2000) qualityScore *= 0.5;
      else if (averageLatency > 1000) qualityScore *= 0.8;

      // Determine trend by comparing with previous period
      const previousPeriodChecks = this.getHealthChecksInRange(
        new Date(Date.now() - hours * 2 * 60 * 60 * 1000),
        new Date(Date.now() - hours * 60 * 60 * 1000)
      );

      let trend: ConnectionTrend["trend"] = "stable";
      if (previousPeriodChecks.length > 0) {
        const previousSuccessRate =
          previousPeriodChecks.filter((c) => c.success).length / previousPeriodChecks.length;
        const rateChange = successRate - previousSuccessRate;

        if (rateChange > 0.1) {
          trend = "improving";
        } else if (rateChange < -0.1) {
          trend = "degrading";
        }
      }

      return {
        period: key,
        averageLatency: Math.round(averageLatency),
        successRate: Math.round(successRate * 100) / 100,
        qualityScore: Math.round(qualityScore),
        trend,
      };
    });
  }

  // ============================================================================
  // Alert System
  // ============================================================================

  /**
   * Register alert callback
   */
  onAlert(callback: (alert: PerformanceAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(hours = 24): PerformanceAlert[] {
    // In a production system, alerts would be stored persistently
    // For now, we'll generate synthetic recent alerts based on current metrics
    const alerts: PerformanceAlert[] = [];
    const metrics = this.getHealthMetrics();

    if (metrics.consecutiveFailures > 3) {
      alerts.push({
        type: "connection_lost",
        severity: "critical",
        message: `Connection lost for ${metrics.consecutiveFailures} consecutive attempts`,
        timestamp: new Date(
          Date.now() - metrics.consecutiveFailures * this.config.healthCheckInterval
        ),
        metrics: { consecutiveFailures: metrics.consecutiveFailures },
        recommendations: [
          "Check network connectivity",
          "Verify MEXC API status",
          "Implement offline mode",
        ],
      });
    }

    if (metrics.successRate < 0.8) {
      alerts.push({
        type: "failure_rate",
        severity: metrics.successRate < 0.5 ? "critical" : "warning",
        message: `High failure rate: ${(metrics.successRate * 100).toFixed(1)}%`,
        timestamp: new Date(Date.now() - 300000), // 5 minutes ago
        metrics: { successRate: metrics.successRate },
        recommendations: ["Investigate connection stability", "Consider increasing timeouts"],
      });
    }

    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private recordHealthCheck(result: HealthCheckResult): void {
    this.healthChecks.push(result);
    this.recordLatency(result.latency);

    // Clean up old health checks
    const cutoffTime = new Date(Date.now() - this.config.maxRetentionPeriod * 60 * 60 * 1000);
    this.healthChecks = this.healthChecks.filter((check) => check.timestamp > cutoffTime);

    // Check for alerts
    if (this.config.enableAlerts) {
      this.checkForAlerts(result);
    }
  }

  private checkForAlerts(result: HealthCheckResult): void {
    const metrics = this.getHealthMetrics();

    // Check failure rate
    if (metrics.successRate < 1 - this.config.alertThresholds.failureRate) {
      this.triggerAlert({
        type: "failure_rate",
        severity: metrics.successRate < 0.5 ? "critical" : "warning",
        message: `High failure rate detected: ${(metrics.successRate * 100).toFixed(1)}%`,
        timestamp: new Date(),
        metrics: { successRate: metrics.successRate, totalChecks: metrics.totalChecks },
        recommendations: [
          "Check network connectivity",
          "Verify API endpoint availability",
          "Consider implementing circuit breaker",
        ],
      });
    }

    // Check quality degradation
    if (this.config.enableTrendAnalysis) {
      const quality = this.getConnectionQuality();
      if (quality.score < 50) {
        this.triggerAlert({
          type: "quality_degradation",
          severity: quality.score < 25 ? "critical" : "warning",
          message: `Connection quality degraded: ${quality.status} (${quality.score}/100)`,
          timestamp: new Date(),
          metrics: { qualityScore: quality.score },
          recommendations: quality.recommendations,
        });
      }
    }
  }

  private triggerAlert(alert: PerformanceAlert): void {
    this.alertCallbacks.forEach((callback) => {
      try {
        callback(alert);
      } catch (error) {
        console.error("Error in alert callback:", error);
      }
    });
  }

  private getAverageLatency(): number {
    if (this.latencies.length === 0) return 0;
    return this.latencies.reduce((sum, lat) => sum + lat, 0) / this.latencies.length;
  }

  private getRecentHealthChecks(hours: number): HealthCheckResult[] {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.healthChecks.filter((check) => check.timestamp > cutoffTime);
  }

  private getHealthChecksInRange(start: Date, end: Date): HealthCheckResult[] {
    return this.healthChecks.filter((check) => check.timestamp >= start && check.timestamp <= end);
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Get monitoring status
   */
  getStatus(): {
    isMonitoring: boolean;
    intervalMs: number;
    totalChecks: number;
    retentionHours: number;
  } {
    return {
      isMonitoring: this.isMonitoring,
      intervalMs: this.config.healthCheckInterval,
      totalChecks: this.healthChecks.length,
      retentionHours: this.config.maxRetentionPeriod,
    };
  }

  /**
   * Reset all data
   */
  reset(): void {
    this.healthChecks = [];
    this.latencies = [];
  }

  /**
   * Get configuration
   */
  getConfig(): ConnectionHealthMonitorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ConnectionHealthMonitorConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart monitoring if interval changed
    if (this.isMonitoring && config.healthCheckInterval) {
      this.stop();
      this.start();
    }
  }
}

// ============================================================================
// Factory Functions and Exports
// ============================================================================

/**
 * Create connection health monitor with production defaults
 */
export function createConnectionHealthMonitor(
  config?: Partial<ConnectionHealthMonitorConfig>
): ConnectionHealthMonitor {
  return new ConnectionHealthMonitor(config);
}

// Global instance for singleton usage
let globalHealthMonitor: ConnectionHealthMonitor | null = null;

/**
 * Get or create global health monitor
 */
export function getGlobalHealthMonitor(): ConnectionHealthMonitor {
  if (!globalHealthMonitor) {
    globalHealthMonitor = createConnectionHealthMonitor();
  }
  return globalHealthMonitor;
}

/**
 * Reset global health monitor
 */
export function resetGlobalHealthMonitor(): void {
  if (globalHealthMonitor) {
    globalHealthMonitor.stop();
  }
  globalHealthMonitor = null;
}
