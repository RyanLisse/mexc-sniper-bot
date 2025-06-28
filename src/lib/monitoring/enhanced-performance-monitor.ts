/**
 * Enhanced Performance Monitor
 *
 * Comprehensive performance monitoring service that extends OpenTelemetry
 * with trading-specific metrics, real-time alerts, and performance optimization.
 *
 * Phase 3 Enhancement Features:
 * - Real-time trading performance metrics
 * - Automated performance alerts
 * - Memory and CPU optimization tracking
 * - API latency monitoring with SLA tracking
 * - Database query performance analysis
 * - Pattern detection performance metrics
 */

import { performance } from "node:perf_hooks";
import { metrics, SpanStatusCode, trace } from "@opentelemetry/api";

// Trading-specific metric types
export interface TradingMetrics {
  executionLatency: number;
  orderFillRate: number;
  apiResponseTime: number;
  patternDetectionAccuracy: number;
  riskCalculationTime: number;
  websocketLatency: number;
}

export interface PerformanceThresholds {
  apiLatencyMs: number;
  executionLatencyMs: number;
  memoryUsageMB: number;
  cpuUsagePercent: number;
  errorRatePercent: number;
}

export interface AlertConfiguration {
  enabled: boolean;
  webhookUrl?: string;
  emailEndpoint?: string;
  slackChannel?: string;
  thresholds: PerformanceThresholds;
}

/**
 * Enhanced Performance Monitor
 * Provides comprehensive observability for the trading system
 */
export class EnhancedPerformanceMonitor {
  private meter = metrics.getMeter("mexc-trading-bot", "1.0.0");
  private tracer = trace.getTracer("mexc-trading-bot", "1.0.0");

  // Performance counters
  private executionCounter = this.meter.createCounter("trading_executions_total", {
    description: "Total number of trading executions",
  });

  private apiLatencyHistogram = this.meter.createHistogram("api_latency_ms", {
    description: "API request latency in milliseconds",
    unit: "ms",
  });

  private memoryGauge = this.meter.createUpDownCounter("memory_usage_mb", {
    description: "Memory usage in megabytes",
    unit: "MB",
  });

  private errorCounter = this.meter.createCounter("errors_total", {
    description: "Total number of errors",
  });

  private patternDetectionHistogram = this.meter.createHistogram("pattern_detection_duration_ms", {
    description: "Pattern detection processing time",
    unit: "ms",
  });

  private websocketLatencyHistogram = this.meter.createHistogram("websocket_latency_ms", {
    description: "WebSocket message latency",
    unit: "ms",
  });

  private alertConfig: AlertConfiguration;
  private performanceCache = new Map<string, number>();
  private lastAlertTime = new Map<string, number>();
  private readonly ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

  constructor(alertConfig?: Partial<AlertConfiguration>) {
    this.alertConfig = {
      enabled: alertConfig?.enabled ?? true,
      webhookUrl: alertConfig?.webhookUrl,
      emailEndpoint: alertConfig?.emailEndpoint,
      slackChannel: alertConfig?.slackChannel,
      thresholds: {
        apiLatencyMs: 1000,
        executionLatencyMs: 500,
        memoryUsageMB: 1024,
        cpuUsagePercent: 80,
        errorRatePercent: 5,
        ...alertConfig?.thresholds,
      },
    };

    // Start background monitoring
    this.startBackgroundMonitoring();
  }

  /**
   * Track trading execution performance
   */
  async trackTradingExecution<T>(
    operationName: string,
    operation: () => Promise<T>,
    metadata?: Record<string, string | number>
  ): Promise<T> {
    const span = this.tracer.startSpan(`trading.${operationName}`, {
      attributes: {
        "trading.operation": operationName,
        ...metadata,
      },
    });

    const startTime = performance.now();

    try {
      const result = await operation();

      const duration = performance.now() - startTime;

      // Record metrics
      this.executionCounter.add(1, {
        operation: operationName,
        status: "success",
      });

      this.apiLatencyHistogram.record(duration, {
        operation: operationName,
      });

      // Check performance thresholds
      await this.checkPerformanceThresholds("execution", duration, operationName);

      span.setStatus({ code: SpanStatusCode.OK });
      span.setAttributes({
        "trading.duration_ms": duration,
        "trading.status": "success",
      });

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      this.executionCounter.add(1, {
        operation: operationName,
        status: "error",
      });

      this.errorCounter.add(1, {
        operation: operationName,
        error_type: error instanceof Error ? error.constructor.name : "Unknown",
      });

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : "Unknown error",
      });

      span.setAttributes({
        "trading.duration_ms": duration,
        "trading.status": "error",
      });

      await this.sendAlert("execution_error", {
        operation: operationName,
        error: error instanceof Error ? error.message : "Unknown error",
        duration,
      });

      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Track API request performance with detailed metrics
   */
  async trackApiRequest<T>(
    endpoint: string,
    request: () => Promise<T>,
    expectedSLA?: number
  ): Promise<T> {
    const span = this.tracer.startSpan(`api.request`, {
      attributes: {
        "api.endpoint": endpoint,
        "api.expected_sla_ms": expectedSLA,
      },
    });

    const startTime = performance.now();

    try {
      const result = await request();
      const duration = performance.now() - startTime;

      this.apiLatencyHistogram.record(duration, {
        endpoint,
        status: "success",
      });

      // Check SLA compliance
      if (expectedSLA && duration > expectedSLA) {
        await this.sendAlert("sla_violation", {
          endpoint,
          duration,
          expectedSLA,
          violation: duration - expectedSLA,
        });
      }

      span.setStatus({ code: SpanStatusCode.OK });
      span.setAttributes({
        "api.duration_ms": duration,
        "api.sla_compliant": !expectedSLA || duration <= expectedSLA,
      });

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      this.apiLatencyHistogram.record(duration, {
        endpoint,
        status: "error",
      });

      this.errorCounter.add(1, {
        endpoint,
        error_type: error instanceof Error ? error.constructor.name : "Unknown",
      });

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Track pattern detection performance
   */
  trackPatternDetection(duration: number, accuracy?: number, symbolCount?: number): void {
    this.patternDetectionHistogram.record(duration, {
      accuracy: accuracy ? accuracy.toString() : "unknown",
      symbol_count: symbolCount?.toString() || "unknown",
    });

    // Store for trend analysis
    this.performanceCache.set(
      "pattern_detection_avg",
      (this.performanceCache.get("pattern_detection_avg") || 0) * 0.9 + duration * 0.1
    );
  }

  /**
   * Track WebSocket performance
   */
  trackWebSocketLatency(latency: number, messageType: string): void {
    this.websocketLatencyHistogram.record(latency, {
      message_type: messageType,
    });
  }

  /**
   * Get comprehensive performance report
   */
  getPerformanceReport(): {
    trading: TradingMetrics;
    system: {
      memoryUsageMB: number;
      cpuUsagePercent: number;
      uptime: number;
    };
    alerts: {
      active: number;
      lastAlert: string | null;
    };
  } {
    const memoryUsage = process.memoryUsage();

    return {
      trading: {
        executionLatency: this.performanceCache.get("execution_avg") || 0,
        orderFillRate: this.performanceCache.get("order_fill_rate") || 0,
        apiResponseTime: this.performanceCache.get("api_avg") || 0,
        patternDetectionAccuracy: this.performanceCache.get("pattern_accuracy") || 0,
        riskCalculationTime: this.performanceCache.get("risk_calc_time") || 0,
        websocketLatency: this.performanceCache.get("websocket_avg") || 0,
      },
      system: {
        memoryUsageMB: memoryUsage.heapUsed / 1024 / 1024,
        cpuUsagePercent: 0, // Would need OS-specific implementation
        uptime: process.uptime(),
      },
      alerts: {
        active: this.lastAlertTime.size,
        lastAlert:
          Array.from(this.lastAlertTime.entries()).sort(([, a], [, b]) => b - a)[0]?.[0] || null,
      },
    };
  }

  /**
   * Start background system monitoring
   */
  private startBackgroundMonitoring(): void {
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const memoryMB = memoryUsage.heapUsed / 1024 / 1024;

      this.memoryGauge.add(memoryMB - (this.performanceCache.get("last_memory") || 0));
      this.performanceCache.set("last_memory", memoryMB);

      // Check memory threshold
      if (memoryMB > this.alertConfig.thresholds.memoryUsageMB) {
        this.sendAlert("high_memory_usage", {
          current: memoryMB,
          threshold: this.alertConfig.thresholds.memoryUsageMB,
        });
      }
    }, 10000); // Every 10 seconds
  }

  /**
   * Check performance thresholds and trigger alerts
   */
  private async checkPerformanceThresholds(
    metricType: string,
    value: number,
    context: string
  ): Promise<void> {
    const { thresholds } = this.alertConfig;

    let violated = false;
    let threshold = 0;

    switch (metricType) {
      case "execution":
        violated = value > thresholds.executionLatencyMs;
        threshold = thresholds.executionLatencyMs;
        break;
      case "api":
        violated = value > thresholds.apiLatencyMs;
        threshold = thresholds.apiLatencyMs;
        break;
    }

    if (violated) {
      await this.sendAlert("performance_threshold_exceeded", {
        metric: metricType,
        value,
        threshold,
        context,
      });
    }
  }

  /**
   * Send performance alert
   */
  private async sendAlert(alertType: string, data: any): Promise<void> {
    if (!this.alertConfig.enabled) return;

    const alertKey = `${alertType}_${JSON.stringify(data)}`;
    const now = Date.now();
    const lastAlert = this.lastAlertTime.get(alertKey);

    // Check cooldown
    if (lastAlert && now - lastAlert < this.ALERT_COOLDOWN_MS) {
      return;
    }

    this.lastAlertTime.set(alertKey, now);

    const alert = {
      type: alertType,
      timestamp: new Date().toISOString(),
      service: "mexc-trading-bot",
      data,
      severity: this.getAlertSeverity(alertType),
    };

    // Simple console logging for now - can be extended to webhook/email/slack
    console.warn("[Performance Alert]", JSON.stringify(alert, null, 2));

    // TODO: Implement webhook, email, Slack integrations based on alertConfig
  }

  /**
   * Determine alert severity
   */
  private getAlertSeverity(alertType: string): "low" | "medium" | "high" | "critical" {
    switch (alertType) {
      case "execution_error":
      case "sla_violation":
        return "high";
      case "high_memory_usage":
      case "performance_threshold_exceeded":
        return "medium";
      default:
        return "low";
    }
  }
}

// Global instance
export const enhancedPerformanceMonitor = new EnhancedPerformanceMonitor({
  enabled: process.env.NODE_ENV !== "test",
  thresholds: {
    apiLatencyMs: Number(process.env.PERF_API_LATENCY_MS) || 1000,
    executionLatencyMs: Number(process.env.PERF_EXECUTION_LATENCY_MS) || 500,
    memoryUsageMB: Number(process.env.PERF_MEMORY_MB) || 1024,
    cpuUsagePercent: Number(process.env.PERF_CPU_PERCENT) || 80,
    errorRatePercent: Number(process.env.PERF_ERROR_RATE_PERCENT) || 5,
  },
});
