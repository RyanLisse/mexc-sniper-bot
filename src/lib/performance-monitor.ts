/**
 * Comprehensive Performance Monitoring System
 *
 * Provides real-time performance tracking, metrics collection, and alerting
 * for the MEXC Trading Bot application. Integrates with OpenTelemetry and
 * the unified logging system.
 */

import { errorHandler } from "./standardized-error-handler";
import { createLogger } from "./unified-logger";

const logger = createLogger("performance-monitor", {
  enableStructuredLogging: true,
  enablePerformanceLogging: true,
});

/**
 * Performance metric types
 */
export enum MetricType {
  COUNTER = "counter",
  GAUGE = "gauge",
  HISTOGRAM = "histogram",
  TIMER = "timer",
}

/**
 * Performance metric categories
 */
export enum MetricCategory {
  API = "api",
  DATABASE = "database",
  TRADING = "trading",
  SYSTEM = "system",
  CACHE = "cache",
  EXTERNAL = "external",
  BUSINESS = "business",
  USER = "user",
}

/**
 * Performance alert severity levels
 */
export enum AlertSeverity {
  INFO = "info",
  WARNING = "warning",
  CRITICAL = "critical",
}

/**
 * Performance metric interface
 */
export interface PerformanceMetric {
  name: string;
  type: MetricType;
  category: MetricCategory;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

/**
 * Performance alert interface
 */
export interface PerformanceAlert {
  id: string;
  metric: string;
  severity: AlertSeverity;
  threshold: number;
  currentValue: number;
  message: string;
  timestamp: number;
  resolved: boolean;
}

/**
 * Performance monitoring configuration
 */
interface PerformanceMonitorConfig {
  enableMetrics: boolean;
  enableAlerts: boolean;
  enableTracing: boolean;
  metricsRetentionMs: number;
  alertCooldownMs: number;
  maxMetricsInMemory: number;
}

/**
 * Performance threshold configuration
 */
interface ThresholdConfig {
  [metricName: string]: {
    warning: number;
    critical: number;
    unit: string;
  };
}

/**
 * Default performance monitoring configuration
 */
const defaultConfig: PerformanceMonitorConfig = {
  enableMetrics: true,
  enableAlerts: process.env.NODE_ENV === "production",
  enableTracing: true,
  metricsRetentionMs: 24 * 60 * 60 * 1000, // 24 hours
  alertCooldownMs: 5 * 60 * 1000, // 5 minutes
  maxMetricsInMemory: 10000,
};

/**
 * Default performance thresholds
 */
const defaultThresholds: ThresholdConfig = {
  // API Performance
  "api.response_time": { warning: 1000, critical: 3000, unit: "ms" },
  "api.error_rate": { warning: 0.05, critical: 0.1, unit: "%" },
  "api.throughput": { warning: 100, critical: 500, unit: "req/min" },

  // Database Performance
  "database.query_time": { warning: 500, critical: 2000, unit: "ms" },
  "database.connection_pool": { warning: 0.8, critical: 0.95, unit: "%" },
  "database.slow_queries": { warning: 5, critical: 10, unit: "count/min" },

  // Trading Performance
  "trading.order_latency": { warning: 200, critical: 500, unit: "ms" },
  "trading.slippage": { warning: 0.02, critical: 0.05, unit: "%" },
  "trading.execution_rate": { warning: 0.95, critical: 0.9, unit: "%" },

  // System Performance
  "system.memory_usage": { warning: 0.8, critical: 0.95, unit: "%" },
  "system.cpu_usage": { warning: 0.7, critical: 0.9, unit: "%" },
  "system.disk_usage": { warning: 0.8, critical: 0.95, unit: "%" },

  // Cache Performance
  "cache.hit_ratio": { warning: 0.8, critical: 0.6, unit: "%" },
  "cache.miss_rate": { warning: 0.2, critical: 0.4, unit: "%" },
  "cache.eviction_rate": { warning: 10, critical: 50, unit: "evictions/min" },
};

/**
 * Performance timer class for measuring durations
 */
export class PerformanceTimer {
  private startTime: number;
  private name: string;
  private category: MetricCategory;
  private labels: Record<string, string>;

  constructor(name: string, category: MetricCategory, labels: Record<string, string> = {}) {
    this.startTime = performance.now();
    this.name = name;
    this.category = category;
    this.labels = labels;
  }

  /**
   * Stop the timer and record the metric
   */
  stop(): number {
    const duration = performance.now() - this.startTime;

    performanceMonitor.recordMetric({
      name: this.name,
      type: MetricType.TIMER,
      category: this.category,
      value: duration,
      timestamp: Date.now(),
      labels: this.labels,
    });

    return duration;
  }

  /**
   * Get current elapsed time without stopping
   */
  elapsed(): number {
    return performance.now() - this.startTime;
  }
}

/**
 * Main Performance Monitor class
 */
export class PerformanceMonitor {
  private config: PerformanceMonitorConfig;
  private thresholds: ThresholdConfig;
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private alerts: Map<string, PerformanceAlert> = new Map();
  private lastAlertTime: Map<string, number> = new Map();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    config: Partial<PerformanceMonitorConfig> = {},
    thresholds: Partial<ThresholdConfig> = {}
  ) {
    this.config = { ...defaultConfig, ...config };
    // Filter out undefined values from thresholds before merging
    const validThresholds = Object.fromEntries(
      Object.entries(thresholds).filter(([_, value]) => value !== undefined)
    ) as ThresholdConfig;
    this.thresholds = { ...defaultThresholds, ...validThresholds };

    // Start cleanup interval
    if (this.config.enableMetrics) {
      this.startCleanupInterval();
    }

    logger.info("Performance monitor initialized", {
      enableMetrics: this.config.enableMetrics,
      enableAlerts: this.config.enableAlerts,
      enableTracing: this.config.enableTracing,
    });
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetric): void {
    if (!this.config.enableMetrics) return;

    try {
      // Store metric
      const key = this.getMetricKey(metric.name, metric.labels);
      const metrics = this.metrics.get(key) || [];
      metrics.push(metric);

      // Enforce memory limits
      if (metrics.length > this.config.maxMetricsInMemory) {
        metrics.shift(); // Remove oldest metric
      }

      this.metrics.set(key, metrics);

      // Check thresholds and generate alerts
      if (this.config.enableAlerts) {
        this.checkThresholds(metric);
      }

      // Log high-value metrics
      if (this.shouldLogMetric(metric)) {
        logger.info("Performance metric recorded", {
          name: metric.name,
          type: metric.type,
          category: metric.category,
          value: metric.value,
          labels: metric.labels,
        });
      }
    } catch (error) {
      errorHandler.processError(error, {
        operation: "performance.record_metric",
        additionalData: { metric },
      });
    }
  }

  /**
   * Start a performance timer
   */
  startTimer(
    name: string,
    category: MetricCategory,
    labels: Record<string, string> = {}
  ): PerformanceTimer {
    return new PerformanceTimer(name, category, labels);
  }

  /**
   * Record a counter metric
   */
  incrementCounter(
    name: string,
    category: MetricCategory,
    labels: Record<string, string> = {}
  ): void {
    const key = this.getMetricKey(name, labels);
    const existing = this.getLatestMetric(key);
    const newValue = existing ? existing.value + 1 : 1;

    this.recordMetric({
      name,
      type: MetricType.COUNTER,
      category,
      value: newValue,
      timestamp: Date.now(),
      labels,
    });
  }

  /**
   * Record a gauge metric (current value)
   */
  recordGauge(
    name: string,
    category: MetricCategory,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    this.recordMetric({
      name,
      type: MetricType.GAUGE,
      category,
      value,
      timestamp: Date.now(),
      labels,
    });
  }

  /**
   * Record a histogram metric
   */
  recordHistogram(
    name: string,
    category: MetricCategory,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    this.recordMetric({
      name,
      type: MetricType.HISTOGRAM,
      category,
      value,
      timestamp: Date.now(),
      labels,
    });
  }

  /**
   * Get metrics for a specific name and time range
   */
  getMetrics(
    name: string,
    labels: Record<string, string> = {},
    startTime?: number,
    endTime?: number
  ): PerformanceMetric[] {
    const key = this.getMetricKey(name, labels);
    const metrics = this.metrics.get(key) || [];

    if (!startTime && !endTime) {
      return metrics;
    }

    return metrics.filter((metric) => {
      if (startTime && metric.timestamp < startTime) return false;
      if (endTime && metric.timestamp > endTime) return false;
      return true;
    });
  }

  /**
   * Get performance summary for a category
   */
  getCategorySummary(category: MetricCategory, timeRangeMs: number = 60000): Record<string, any> {
    const cutoffTime = Date.now() - timeRangeMs;
    const summary: Record<string, any> = {};

    for (const [_key, metrics] of this.metrics) {
      const recentMetrics = metrics.filter(
        (m) => m.timestamp > cutoffTime && m.category === category
      );

      if (recentMetrics.length === 0) continue;

      const metricName = recentMetrics[0].name;
      const values = recentMetrics.map((m) => m.value);

      summary[metricName] = {
        count: values.length,
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        latest: values[values.length - 1],
      };
    }

    return summary;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values()).filter((alert) => !alert.resolved);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.timestamp = Date.now();

      logger.info("Performance alert resolved", {
        alertId,
        metric: alert.metric,
        severity: alert.severity,
      });

      return true;
    }
    return false;
  }

  /**
   * Get system health score (0-100)
   */
  getHealthScore(): number {
    const activeAlerts = this.getActiveAlerts();

    if (activeAlerts.length === 0) return 100;

    let score = 100;

    for (const alert of activeAlerts) {
      switch (alert.severity) {
        case AlertSeverity.CRITICAL:
          score -= 30;
          break;
        case AlertSeverity.WARNING:
          score -= 10;
          break;
        case AlertSeverity.INFO:
          score -= 5;
          break;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Generate performance report
   */
  generateReport(timeRangeMs: number = 3600000): Record<string, any> {
    const report = {
      timeRange: `${timeRangeMs / 60000} minutes`,
      timestamp: new Date().toISOString(),
      healthScore: this.getHealthScore(),
      activeAlerts: this.getActiveAlerts().length,
      categories: {} as Record<string, any>,
    };

    // Generate summary for each category
    for (const category of Object.values(MetricCategory)) {
      report.categories[category] = this.getCategorySummary(category, timeRangeMs);
    }

    return report;
  }

  /**
   * Shutdown the performance monitor
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    logger.info("Performance monitor shutdown", {
      metricsCount: this.metrics.size,
      alertsCount: this.alerts.size,
    });
  }

  // Private methods

  private getMetricKey(name: string, labels: Record<string, string> = {}): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
    return `${name}${labelStr ? `|${labelStr}` : ""}`;
  }

  private getLatestMetric(key: string): PerformanceMetric | null {
    const metrics = this.metrics.get(key);
    return metrics && metrics.length > 0 ? metrics[metrics.length - 1] : null;
  }

  private checkThresholds(metric: PerformanceMetric): void {
    const threshold = this.thresholds[metric.name];
    if (!threshold) return;

    const now = Date.now();
    const alertKey = `${metric.name}_${this.getMetricKey("", metric.labels)}`;
    const lastAlertTime = this.lastAlertTime.get(alertKey) || 0;

    // Check cooldown period
    if (now - lastAlertTime < this.config.alertCooldownMs) {
      return;
    }

    let severity: AlertSeverity | null = null;

    if (metric.value >= threshold.critical) {
      severity = AlertSeverity.CRITICAL;
    } else if (metric.value >= threshold.warning) {
      severity = AlertSeverity.WARNING;
    }

    if (severity) {
      const alert: PerformanceAlert = {
        id: `${alertKey}_${now}`,
        metric: metric.name,
        severity,
        threshold: severity === AlertSeverity.CRITICAL ? threshold.critical : threshold.warning,
        currentValue: metric.value,
        message: `${metric.name} exceeded ${severity} threshold: ${metric.value}${threshold.unit} > ${severity === AlertSeverity.CRITICAL ? threshold.critical : threshold.warning}${threshold.unit}`,
        timestamp: now,
        resolved: false,
      };

      this.alerts.set(alert.id, alert);
      this.lastAlertTime.set(alertKey, now);

      logger.warn("Performance alert triggered", {
        alertId: alert.id,
        metric: alert.metric,
        severity: alert.severity,
        currentValue: alert.currentValue,
        threshold: alert.threshold,
      });
    }
  }

  private shouldLogMetric(metric: PerformanceMetric): boolean {
    // Log critical metrics, timers over 1s, or error counters
    return (
      metric.category === MetricCategory.TRADING ||
      metric.category === MetricCategory.DATABASE ||
      (metric.type === MetricType.TIMER && metric.value > 1000) ||
      (metric.name.includes("error") && metric.value > 0)
    );
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 60000); // Clean up every minute
  }

  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - this.config.metricsRetentionMs;
    let removedCount = 0;

    for (const [key, metrics] of this.metrics) {
      const filtered = metrics.filter((m) => m.timestamp > cutoffTime);

      if (filtered.length !== metrics.length) {
        removedCount += metrics.length - filtered.length;

        if (filtered.length === 0) {
          this.metrics.delete(key);
        } else {
          this.metrics.set(key, filtered);
        }
      }
    }

    if (removedCount > 0) {
      logger.debug("Cleaned up old performance metrics", {
        removedCount,
        retentionHours: this.config.metricsRetentionMs / (60 * 60 * 1000),
      });
    }
  }
}

/**
 * Global performance monitor instance
 */
export const performanceMonitor = new PerformanceMonitor();

/**
 * Decorator for automatic performance monitoring
 */
export function withPerformanceMonitoring(category: MetricCategory, metricName?: string) {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value;
    const name = metricName || `${target.constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: any[]) {
      const timer = performanceMonitor.startTimer(name, category, {
        method: propertyName,
        class: target.constructor.name,
      });

      try {
        const result = await method.apply(this, args);
        timer.stop();

        // Record success counter
        performanceMonitor.incrementCounter(`${name}.success`, category);

        return result;
      } catch (error) {
        timer.stop();

        // Record error counter
        performanceMonitor.incrementCounter(`${name}.error`, category);

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Helper functions for common performance tracking
 */
export const PerformanceTracking = {
  /**
   * Track API request performance
   */
  apiRequest: (endpoint: string, method: string = "GET") => {
    return performanceMonitor.startTimer("api.request", MetricCategory.API, {
      endpoint,
      method,
    });
  },

  /**
   * Track database query performance
   */
  databaseQuery: (operation: string, table?: string) => {
    return performanceMonitor.startTimer("database.query", MetricCategory.DATABASE, {
      operation,
      table: table || "unknown",
    });
  },

  /**
   * Track trading operation performance
   */
  tradingOperation: (operation: string, symbol?: string) => {
    return performanceMonitor.startTimer("trading.operation", MetricCategory.TRADING, {
      operation,
      symbol: symbol || "unknown",
    });
  },

  /**
   * Track cache operation performance
   */
  cacheOperation: (operation: string, cacheType?: string) => {
    return performanceMonitor.startTimer("cache.operation", MetricCategory.CACHE, {
      operation,
      type: cacheType || "unknown",
    });
  },

  /**
   * Record business metric
   */
  businessMetric: (name: string, value: number, labels?: Record<string, string>) => {
    performanceMonitor.recordGauge(name, MetricCategory.BUSINESS, value, labels);
  },

  /**
   * Record system metric
   */
  systemMetric: (name: string, value: number, labels?: Record<string, string>) => {
    performanceMonitor.recordGauge(name, MetricCategory.SYSTEM, value, labels);
  },
};
