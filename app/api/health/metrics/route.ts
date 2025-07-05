/**
 * Production Metrics API Route
 *
 * Provides detailed performance metrics, system health indicators,
 * and monitoring data for production deployments.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiResponse } from "@/src/lib/api-response";

// Metrics type interfaces
interface SystemMetrics {
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
    utilization: number;
  };
  cpu: {
    user: number;
    system: number;
    percentage: number;
  };
  process: {
    pid: number;
    uptime: number;
    version: string;
    platform: string;
    arch: string;
  };
  eventLoop: {
    lag: number;
  };
}

interface PerformanceMetrics {
  requests: {
    total: number;
    perSecond: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  errors: {
    total: number;
    rate: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface ApplicationMetrics {
  [key: string]: unknown;
}

interface CompleteMetricsData {
  timestamp: string;
  timeRange: string;
  responseTime: number;
  system: SystemMetrics;
  performance: PerformanceMetrics;
  application: ApplicationMetrics;
  business: Record<string, unknown>;
  health: {
    overall: number;
    components: Record<string, unknown>;
  };
}

/**
 * GET /api/health/metrics
 * Comprehensive production metrics and monitoring data
 */
export async function GET(request: NextRequest): Promise<Response> {
  const startTime = Date.now();
  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get("format") || "json";
  const timeRange = searchParams.get("range") || "1h";

  try {
    // Collect system metrics
    const systemMetrics = collectSystemMetrics();

    // Collect performance metrics
    const performanceMetrics = collectPerformanceMetrics();

    // Collect application metrics
    const applicationMetrics = collectApplicationMetrics();

    // Collect business metrics
    const businessMetrics = collectBusinessMetrics();

    const responseTime = Date.now() - startTime;

    const metricsData = {
      timestamp: new Date().toISOString(),
      timeRange,
      responseTime,

      // System-level metrics
      system: systemMetrics,

      // Performance metrics
      performance: performanceMetrics,

      // Application-specific metrics
      application: applicationMetrics,

      // Business/trading metrics
      business: businessMetrics,

      // Real-time indicators
      realtime: {
        activeConnections: getActiveConnections(),
        queueDepth: getQueueDepth(),
        errorRate: getErrorRate(),
        throughput: getThroughput(),
      },

      // Health indicators
      health: {
        overall: calculateOverallHealth(systemMetrics, performanceMetrics),
        components: getComponentHealth(),
      },
    };

    // Return metrics in requested format
    if (format === "prometheus") {
      return new Response(formatPrometheusMetrics(metricsData), {
        status: 200,
        headers: {
          "Content-Type": "text/plain; version=0.0.4",
          "Cache-Control": "no-cache",
        },
      });
    }

    return apiResponse.success(metricsData, {
      message: "Production metrics collected successfully",
      metricsCount: Object.keys(metricsData).length,
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return apiResponse.error(
      `Metrics collection failed: ${error instanceof Error ? error.message : String(error)}`,
      500,
      {
        responseTime,
        timestamp: new Date().toISOString(),
      }
    );
  }
}

/**
 * Collect system-level metrics
 */
function collectSystemMetrics() {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  return {
    memory: {
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      utilization: (memUsage.heapUsed / memUsage.heapTotal) * 100,
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system,
      // Calculate CPU percentage (approximation)
      percentage: Math.min((cpuUsage.user + cpuUsage.system) / 1000000, 100),
    },
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      version: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    eventLoop: {
      lag: getEventLoopLag(),
    },
  };
}

/**
 * Collect performance metrics
 */
function collectPerformanceMetrics() {
  return {
    requests: {
      total: getRequestCount(),
      perSecond: getRequestsPerSecond(),
      averageResponseTime: getAverageResponseTime(),
      p95ResponseTime: getP95ResponseTime(),
      p99ResponseTime: getP99ResponseTime(),
    },
    errors: {
      total: getErrorCount(),
      rate: getErrorRate(),
      byType: getErrorsByType(),
    },
    cache: {
      hitRate: getCacheHitRate(),
      missRate: getCacheMissRate(),
      evictions: getCacheEvictions(),
    },
    database: {
      connections: getDatabaseConnections(),
      queryTime: getAverageQueryTime(),
      slowQueries: getSlowQueryCount(),
    },
  };
}

/**
 * Collect application-specific metrics
 */
function collectApplicationMetrics() {
  return {
    trading: {
      activePositions: getActivePositions(),
      ordersProcessed: getOrdersProcessed(),
      successRate: getTradingSuccessRate(),
      riskScore: getCurrentRiskScore(),
    },
    patterns: {
      detected: getPatternsDetected(),
      confidence: getAveragePatternConfidence(),
      processed: getPatternsProcessed(),
    },
    websockets: {
      connections: getWebSocketConnections(),
      messagesPerSecond: getWebSocketMessagesPerSecond(),
      reconnections: getWebSocketReconnections(),
    },
    ai: {
      requestsPerHour: getAIRequestsPerHour(),
      tokensUsed: getTokensUsed(),
      averageLatency: getAIAverageLatency(),
    },
  };
}

/**
 * Collect business metrics
 */
function collectBusinessMetrics() {
  return {
    users: {
      active: getActiveUsers(),
      sessions: getActiveSessions(),
      signups: getRecentSignups(),
    },
    portfolio: {
      totalValue: getTotalPortfolioValue(),
      dailyPnL: getDailyPnL(),
      riskExposure: getRiskExposure(),
    },
    alerts: {
      triggered: getAlertsTriggered(),
      resolved: getAlertsResolved(),
      critical: getCriticalAlerts(),
    },
  };
}

/**
 * Calculate overall system health score
 */
function calculateOverallHealth(
  systemMetrics: SystemMetrics,
  performanceMetrics: PerformanceMetrics
): number {
  let score = 100;

  // Memory health (reduce score if > 80% utilization)
  if (systemMetrics.memory.utilization > 80) {
    score -= (systemMetrics.memory.utilization - 80) * 2;
  }

  // CPU health (reduce score if > 70% utilization)
  if (systemMetrics.cpu.percentage > 70) {
    score -= (systemMetrics.cpu.percentage - 70) * 1.5;
  }

  // Error rate health (reduce score based on error rate)
  if (performanceMetrics.errors.rate > 0.01) {
    score -= Math.min(performanceMetrics.errors.rate * 1000, 30);
  }

  // Response time health (reduce score if > 1000ms)
  if (performanceMetrics.requests.averageResponseTime > 1000) {
    score -= Math.min(
      (performanceMetrics.requests.averageResponseTime - 1000) / 100,
      20
    );
  }

  return Math.max(Math.round(score), 0);
}

/**
 * Get component health status
 */
function getComponentHealth() {
  return {
    database: {
      status: getDatabaseHealth(),
      responseTime: getAverageQueryTime(),
      connections: getDatabaseConnections(),
    },
    api: {
      status: getAPIHealth(),
      responseTime: getAverageResponseTime(),
      errorRate: getErrorRate(),
    },
    websockets: {
      status: getWebSocketHealth(),
      connections: getWebSocketConnections(),
      uptime: getWebSocketUptime(),
    },
    cache: {
      status: getCacheHealth(),
      hitRate: getCacheHitRate(),
      size: getCacheSize(),
    },
    ai: {
      status: getAIHealth(),
      latency: getAIAverageLatency(),
      usage: getAIUsage(),
    },
  };
}

/**
 * Format metrics for Prometheus exposition format
 */
function formatPrometheusMetrics(metricsData: CompleteMetricsData): string {
  const lines: string[] = [];

  // System metrics
  lines.push(`# HELP mexc_memory_usage_bytes Memory usage in bytes`);
  lines.push(`# TYPE mexc_memory_usage_bytes gauge`);
  lines.push(
    `mexc_memory_usage_bytes{type="rss"} ${metricsData.system.memory.rss}`
  );
  lines.push(
    `mexc_memory_usage_bytes{type="heap_used"} ${metricsData.system.memory.heapUsed}`
  );
  lines.push(
    `mexc_memory_usage_bytes{type="heap_total"} ${metricsData.system.memory.heapTotal}`
  );

  lines.push(`# HELP mexc_cpu_percentage CPU utilization percentage`);
  lines.push(`# TYPE mexc_cpu_percentage gauge`);
  lines.push(`mexc_cpu_percentage ${metricsData.system.cpu.percentage}`);

  lines.push(`# HELP mexc_uptime_seconds Process uptime in seconds`);
  lines.push(`# TYPE mexc_uptime_seconds counter`);
  lines.push(`mexc_uptime_seconds ${metricsData.system.process.uptime}`);

  // Performance metrics
  lines.push(`# HELP mexc_requests_total Total number of requests`);
  lines.push(`# TYPE mexc_requests_total counter`);
  lines.push(`mexc_requests_total ${metricsData.performance.requests.total}`);

  lines.push(
    `# HELP mexc_response_time_ms Average response time in milliseconds`
  );
  lines.push(`# TYPE mexc_response_time_ms gauge`);
  lines.push(
    `mexc_response_time_ms ${metricsData.performance.requests.averageResponseTime}`
  );

  lines.push(`# HELP mexc_error_rate Error rate percentage`);
  lines.push(`# TYPE mexc_error_rate gauge`);
  lines.push(`mexc_error_rate ${metricsData.performance.errors.rate}`);

  // Health score
  lines.push(`# HELP mexc_health_score Overall health score (0-100)`);
  lines.push(`# TYPE mexc_health_score gauge`);
  lines.push(`mexc_health_score ${metricsData.health.overall}`);

  return `${lines.join("\n")}\n`;
}

// Placeholder functions for metric collection
// In a real implementation, these would connect to actual monitoring systems

function getEventLoopLag(): number {
  return Math.random() * 10; // Placeholder
}

function getRequestCount(): number {
  return Math.floor(Math.random() * 10000);
}

function getRequestsPerSecond(): number {
  return Math.floor(Math.random() * 100);
}

function getAverageResponseTime(): number {
  return Math.floor(Math.random() * 500) + 100;
}

function getP95ResponseTime(): number {
  return Math.floor(Math.random() * 1000) + 500;
}

function getP99ResponseTime(): number {
  return Math.floor(Math.random() * 2000) + 1000;
}

function getErrorCount(): number {
  return Math.floor(Math.random() * 100);
}

function getErrorRate(): number {
  return Math.random() * 0.05;
}

function getErrorsByType(): { [key: string]: number } {
  return {
    "4xx": Math.floor(Math.random() * 50),
    "5xx": Math.floor(Math.random() * 20),
    timeout: Math.floor(Math.random() * 10),
  };
}

function getCacheHitRate(): number {
  return Math.random() * 0.95 + 0.05;
}

function getCacheMissRate(): number {
  return 1 - getCacheHitRate();
}

function getCacheEvictions(): number {
  return Math.floor(Math.random() * 100);
}

function getDatabaseConnections(): number {
  return Math.floor(Math.random() * 10) + 1;
}

function getAverageQueryTime(): number {
  return Math.floor(Math.random() * 100) + 10;
}

function getSlowQueryCount(): number {
  return Math.floor(Math.random() * 5);
}

function getActivePositions(): number {
  return Math.floor(Math.random() * 10);
}

function getOrdersProcessed(): number {
  return Math.floor(Math.random() * 1000);
}

function getTradingSuccessRate(): number {
  return Math.random() * 0.3 + 0.7;
}

function getCurrentRiskScore(): number {
  return Math.floor(Math.random() * 100);
}

function getPatternsDetected(): number {
  return Math.floor(Math.random() * 100);
}

function getAveragePatternConfidence(): number {
  return Math.random() * 0.4 + 0.6;
}

function getPatternsProcessed(): number {
  return Math.floor(Math.random() * 500);
}

function getWebSocketConnections(): number {
  return Math.floor(Math.random() * 50);
}

function getWebSocketMessagesPerSecond(): number {
  return Math.floor(Math.random() * 1000);
}

function getWebSocketReconnections(): number {
  return Math.floor(Math.random() * 10);
}

function getAIRequestsPerHour(): number {
  return Math.floor(Math.random() * 500);
}

function getTokensUsed(): number {
  return Math.floor(Math.random() * 10000);
}

function getAIAverageLatency(): number {
  return Math.floor(Math.random() * 2000) + 500;
}

function getActiveUsers(): number {
  return Math.floor(Math.random() * 100);
}

function getActiveSessions(): number {
  return Math.floor(Math.random() * 200);
}

function getRecentSignups(): number {
  return Math.floor(Math.random() * 20);
}

function getTotalPortfolioValue(): number {
  return Math.floor(Math.random() * 100000);
}

function getDailyPnL(): number {
  return (Math.random() - 0.5) * 10000;
}

function getRiskExposure(): number {
  return Math.random() * 0.5;
}

function getAlertsTriggered(): number {
  return Math.floor(Math.random() * 50);
}

function getAlertsResolved(): number {
  return Math.floor(Math.random() * 45);
}

function getCriticalAlerts(): number {
  return Math.floor(Math.random() * 5);
}

function getActiveConnections(): number {
  return Math.floor(Math.random() * 100);
}

function getQueueDepth(): number {
  return Math.floor(Math.random() * 1000);
}

function getThroughput(): number {
  return Math.floor(Math.random() * 10000);
}

function getDatabaseHealth(): string {
  const options = ["healthy", "degraded", "unhealthy"];
  return options[Math.floor(Math.random() * options.length)] || "unknown";
}

function getAPIHealth(): string {
  const options = ["healthy", "degraded"];
  return options[Math.floor(Math.random() * options.length)] || "unknown";
}

function getWebSocketHealth(): string {
  const options = ["healthy", "degraded"];
  return options[Math.floor(Math.random() * options.length)] || "unknown";
}

function getWebSocketUptime(): number {
  return Math.random() * 0.1 + 0.9;
}

function getCacheHealth(): string {
  const options = ["healthy", "degraded"];
  return options[Math.floor(Math.random() * options.length)] || "unknown";
}

function getCacheSize(): number {
  return Math.floor(Math.random() * 1000000);
}

function getAIHealth(): string {
  const options = ["healthy", "degraded"];
  return options[Math.floor(Math.random() * options.length)] || "unknown";
}

function getAIUsage(): number {
  return Math.random() * 0.8;
}
