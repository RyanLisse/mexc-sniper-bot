/**
 * Production Status Dashboard API Route
 *
 * Comprehensive production monitoring with real-time metrics, alerts,
 * and deployment health status for operations teams
 */

import type { NextRequest, NextResponse } from "next/server";
import { apiResponse } from "@/src/lib/api-response";
import { getSystemResilienceStatus } from "@/src/lib/enhanced-resilience-manager";

interface ProductionMetrics {
  deployment: {
    status: "healthy" | "degraded" | "critical";
    version: string;
    buildId: string;
    deployedAt: string;
    region: string;
    uptime: number;
  };
  system: {
    health: "healthy" | "degraded" | "critical";
    score: number;
    cpu: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    responseTime: number;
  };
  services: {
    database: ServiceStatus;
    authentication: ServiceStatus;
    trading: ServiceStatus;
    monitoring: ServiceStatus;
    websockets: ServiceStatus;
  };
  alerts: {
    critical: number;
    warnings: number;
    notices: number;
    recent: Alert[];
  };
  performance: {
    last24h: {
      averageResponseTime: number;
      errorRate: number;
      uptime: number;
      throughput: number;
    };
    current: {
      requestsPerMinute: number;
      errorsPerMinute: number;
      activeConnections: number;
    };
  };
}

interface ServiceStatus {
  status: "operational" | "degraded" | "outage";
  responseTime: number;
  lastCheck: string;
  errorRate: number;
  availability: number;
}

interface Alert {
  id: string;
  level: "critical" | "warning" | "notice";
  message: string;
  timestamp: string;
  service?: string;
  resolved: boolean;
}

/**
 * GET /api/production/status
 * Production dashboard with comprehensive metrics
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Gather all production metrics
    const metrics = await gatherProductionMetrics(startTime);

    // Determine overall system status
    const overallStatus = determineOverallStatus(metrics);

    // Generate alerts and recommendations
    const alerts = generateSystemAlerts(metrics);
    const recommendations = generateRecommendations(metrics);

    const responseData = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      metrics,
      alerts,
      recommendations,

      // Quick status indicators for dashboards
      indicators: {
        deployment: metrics.deployment.status,
        system: metrics.system.health,
        services: Object.values(metrics.services).every(
          (s) => s.status === "operational"
        )
          ? "all_operational"
          : "degraded",
        alerts:
          metrics.alerts.critical > 0
            ? "critical"
            : metrics.alerts.warnings > 0
              ? "warnings"
              : "normal",
      },

      // SLA tracking
      sla: {
        uptime: {
          current: metrics.performance.last24h.uptime,
          target: 99.9,
          status:
            metrics.performance.last24h.uptime >= 99.9 ? "meeting" : "below",
        },
        responseTime: {
          current: metrics.performance.last24h.averageResponseTime,
          target: 500,
          status:
            metrics.performance.last24h.averageResponseTime <= 500
              ? "meeting"
              : "above",
        },
        errorRate: {
          current: metrics.performance.last24h.errorRate,
          target: 1.0,
          status:
            metrics.performance.last24h.errorRate <= 1.0 ? "meeting" : "above",
        },
      },
    };

    return overallStatus === "healthy"
      ? apiResponse.success(responseData, {
          message: "Production system is healthy",
          dashboard: "All systems operational",
        })
      : apiResponse.error(
          `Production system status: ${overallStatus}`,
          overallStatus === "critical" ? 503 : 200,
          responseData
        );
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return apiResponse.error(
      `Production status check failed: ${error instanceof Error ? error.message : String(error)}`,
      500,
      {
        responseTime,
        timestamp: new Date().toISOString(),
        status: "critical",
        error: "Status monitoring system failure",
      }
    );
  }
}

/**
 * Gather comprehensive production metrics
 */
async function gatherProductionMetrics(
  startTime: number
): Promise<ProductionMetrics> {
  const memoryUsage = process.memoryUsage();
  const resilienceStatus = getSystemResilienceStatus();

  // Deployment information
  const deployment = {
    status: "healthy" as const,
    version:
      process.env.npm_package_version || process.env.SERVICE_VERSION || "1.0.0",
    buildId:
      process.env.VERCEL_DEPLOYMENT_ID ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      "unknown",
    deployedAt:
      process.env.VERCEL_DEPLOYMENT_CREATED_AT || new Date().toISOString(),
    region: process.env.VERCEL_REGION || "fra1",
    uptime: process.uptime(),
  };

  // System metrics
  const system = {
    health: resilienceStatus.isHealthy
      ? ("healthy" as const)
      : ("degraded" as const),
    score: resilienceStatus.overallScore,
    cpu: 0, // Would need additional instrumentation for CPU usage
    memory: {
      used: memoryUsage.heapUsed,
      total: memoryUsage.heapTotal,
      percentage: Math.round(
        (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      ),
    },
    responseTime: Date.now() - startTime,
  };

  // Service status checks
  const services = {
    database: await checkDatabaseStatus(),
    authentication: await checkAuthenticationStatus(),
    trading: await checkTradingStatus(),
    monitoring: checkMonitoringStatus(),
    websockets: await checkWebSocketStatus(),
  };

  // Alert summary
  const alerts = {
    critical: resilienceStatus.openCircuitCount,
    warnings: resilienceStatus.recommendations.length,
    notices: 0,
    recent: generateRecentAlerts(resilienceStatus),
  };

  // Performance metrics (mock data for now - would integrate with actual metrics)
  const performance = {
    last24h: {
      averageResponseTime: system.responseTime,
      errorRate: 0.1,
      uptime: 99.95,
      throughput: 1000,
    },
    current: {
      requestsPerMinute: 50,
      errorsPerMinute: 0,
      activeConnections: 10,
    },
  };

  return {
    deployment,
    system,
    services,
    alerts,
    performance,
  };
}

/**
 * Check database status
 */
async function checkDatabaseStatus(): Promise<ServiceStatus> {
  try {
    const startTime = Date.now();

    // Basic connectivity check - in production would use actual DB connection
    const isHealthy = !!process.env.DATABASE_URL;
    const responseTime = Date.now() - startTime;

    return {
      status: isHealthy ? "operational" : "outage",
      responseTime,
      lastCheck: new Date().toISOString(),
      errorRate: isHealthy ? 0 : 100,
      availability: isHealthy ? 100 : 0,
    };
  } catch {
    return {
      status: "outage",
      responseTime: 0,
      lastCheck: new Date().toISOString(),
      errorRate: 100,
      availability: 0,
    };
  }
}

/**
 * Check authentication status
 */
async function checkAuthenticationStatus(): Promise<ServiceStatus> {
  try {
    const startTime = Date.now();

    const isHealthy = !!(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const responseTime = Date.now() - startTime;

    return {
      status: isHealthy ? "operational" : "degraded",
      responseTime,
      lastCheck: new Date().toISOString(),
      errorRate: isHealthy ? 0 : 50,
      availability: isHealthy ? 100 : 50,
    };
  } catch {
    return {
      status: "outage",
      responseTime: 0,
      lastCheck: new Date().toISOString(),
      errorRate: 100,
      availability: 0,
    };
  }
}

/**
 * Check trading system status
 */
async function checkTradingStatus(): Promise<ServiceStatus> {
  try {
    const startTime = Date.now();

    // Check if trading-related environment variables are configured
    const hasBasicConfig = !!process.env.OPENAI_API_KEY;
    const responseTime = Date.now() - startTime;

    return {
      status: hasBasicConfig ? "operational" : "degraded",
      responseTime,
      lastCheck: new Date().toISOString(),
      errorRate: hasBasicConfig ? 0 : 25,
      availability: hasBasicConfig ? 100 : 75,
    };
  } catch {
    return {
      status: "outage",
      responseTime: 0,
      lastCheck: new Date().toISOString(),
      errorRate: 100,
      availability: 0,
    };
  }
}

/**
 * Check monitoring status
 */
function checkMonitoringStatus(): ServiceStatus {
  const isEnabled = process.env.PERFORMANCE_MONITORING_ENABLED === "true";

  return {
    status: isEnabled ? "operational" : "degraded",
    responseTime: 1,
    lastCheck: new Date().toISOString(),
    errorRate: 0,
    availability: isEnabled ? 100 : 80,
  };
}

/**
 * Check WebSocket status
 */
async function checkWebSocketStatus(): Promise<ServiceStatus> {
  // Mock WebSocket health check
  return {
    status: "operational",
    responseTime: 5,
    lastCheck: new Date().toISOString(),
    errorRate: 0,
    availability: 100,
  };
}

/**
 * Resilience status interface
 */
interface ResilienceStatus {
  recommendations: string[];
}

/**
 * Generate recent alerts from resilience status
 */
function generateRecentAlerts(resilienceStatus: ResilienceStatus): Alert[] {
  const alerts: Alert[] = [];

  // Convert recommendations to alerts
  resilienceStatus.recommendations.forEach((rec: string, index: number) => {
    alerts.push({
      id: `alert_${index}_${Date.now()}`,
      level: "warning",
      message: rec,
      timestamp: new Date().toISOString(),
      service: "system",
      resolved: false,
    });
  });

  // Add critical alerts for open circuit breakers
  if (resilienceStatus.openCircuitCount > 0) {
    alerts.push({
      id: `circuit_breaker_${Date.now()}`,
      level: "critical",
      message: `${resilienceStatus.openCircuitCount} circuit breaker(s) open`,
      timestamp: new Date().toISOString(),
      service: "resilience",
      resolved: false,
    });
  }

  return alerts.slice(0, 10); // Return max 10 recent alerts
}

/**
 * Determine overall system status
 */
function determineOverallStatus(
  metrics: ProductionMetrics
): "healthy" | "degraded" | "critical" {
  // Critical conditions
  if (metrics.alerts.critical > 0) return "critical";
  if (metrics.system.memory.percentage > 90) return "critical";
  if (Object.values(metrics.services).some((s) => s.status === "outage"))
    return "critical";

  // Degraded conditions
  if (metrics.alerts.warnings > 3) return "degraded";
  if (metrics.system.memory.percentage > 80) return "degraded";
  if (Object.values(metrics.services).some((s) => s.status === "degraded"))
    return "degraded";
  if (metrics.performance.last24h.errorRate > 1.0) return "degraded";

  return "healthy";
}

/**
 * Generate system alerts
 */
function generateSystemAlerts(metrics: ProductionMetrics): Alert[] {
  const alerts: Alert[] = [...metrics.alerts.recent];

  // Memory usage alerts
  if (metrics.system.memory.percentage > 85) {
    alerts.push({
      id: `memory_${Date.now()}`,
      level: metrics.system.memory.percentage > 90 ? "critical" : "warning",
      message: `High memory usage: ${metrics.system.memory.percentage}%`,
      timestamp: new Date().toISOString(),
      service: "system",
      resolved: false,
    });
  }

  // Response time alerts
  if (metrics.system.responseTime > 1000) {
    alerts.push({
      id: `response_time_${Date.now()}`,
      level: "warning",
      message: `Slow response time: ${metrics.system.responseTime}ms`,
      timestamp: new Date().toISOString(),
      service: "system",
      resolved: false,
    });
  }

  return alerts;
}

/**
 * Generate recommendations
 */
function generateRecommendations(metrics: ProductionMetrics): string[] {
  const recommendations: string[] = [];

  if (metrics.system.memory.percentage > 80) {
    recommendations.push(
      "Consider optimizing memory usage or scaling resources"
    );
  }

  if (metrics.alerts.critical > 0) {
    recommendations.push("Address critical alerts immediately");
  }

  if (metrics.performance.last24h.errorRate > 0.5) {
    recommendations.push("Investigate error patterns and implement fixes");
  }

  if (Object.values(metrics.services).some((s) => s.status !== "operational")) {
    recommendations.push("Review and restore degraded services");
  }

  return recommendations;
}

/**
 * HEAD /api/production/status
 * Quick production health check
 */
export async function HEAD(_request: NextRequest): Promise<Response> {
  const resilienceStatus = getSystemResilienceStatus();
  const memoryUsage = process.memoryUsage();
  const memoryPercentage = Math.round(
    (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
  );

  const isHealthy = resilienceStatus.isHealthy && memoryPercentage < 85;
  const status =
    resilienceStatus.openCircuitCount > 0 || memoryPercentage > 90
      ? "critical"
      : !isHealthy
        ? "degraded"
        : "healthy";

  return new Response(null, {
    status: status === "critical" ? 503 : 200,
    headers: {
      "X-Production-Status": status,
      "X-System-Score": resilienceStatus.overallScore.toString(),
      "X-Memory-Usage": memoryPercentage.toString(),
      "X-Circuit-Breakers": resilienceStatus.openCircuitCount.toString(),
      "X-Uptime": process.uptime().toString(),
    },
  });
}
