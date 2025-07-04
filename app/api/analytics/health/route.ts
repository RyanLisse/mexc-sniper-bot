/**
 * System Health Analytics API Endpoint
 *
 * Provides comprehensive system health monitoring and diagnostics
 * for the MEXC Sniper Bot infrastructure.
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/src/lib/supabase-auth";
import { getUnifiedMexcService } from "@/src/services/api/unified-mexc-service-factory";
import { tradingAnalytics } from "@/src/services/trading/trading-analytics-service";

// Type definitions for health check responses
interface HealthCheckIssue {
  severity: "critical" | "warning" | "info";
  message: string;
  component: string;
  timestamp?: string;
}

interface HealthCheckRecommendation {
  priority: "high" | "medium" | "low";
  message: string;
  action: string;
  component: string;
}

interface HealthCheckResult {
  status: "healthy" | "degraded" | "critical";
  score: number;
  issues?: HealthCheckIssue[];
  recommendations?: HealthCheckRecommendation[];
  metrics?: Record<string, unknown>;
  lastChecked?: string;
}

interface CacheHealthResult {
  status: "healthy" | "degraded" | "critical";
  score: number;
  size?: number;
  efficiency?: string;
  error?: string;
  issues?: HealthCheckIssue[];
  recommendations?: string[];
}

interface MexcHealthResult {
  status: "healthy" | "degraded" | "critical";
  score: number;
  connectivity?: string;
  latency?: string;
  lastUpdated?: string;
  credentialSource?: string;
  error?: string;
  issues?: HealthCheckIssue[];
  recommendations?: string[];
}

interface DatabaseHealthResult {
  status: "healthy" | "degraded" | "critical";
  score: number;
  responseTime?: string;
  connectionStatus?: string;
  error?: string;
  issues?: HealthCheckIssue[];
  recommendations?: string[];
}

interface AuthHealthResult {
  status: "healthy" | "degraded" | "critical";
  score: number;
  provider?: string;
  configured?: boolean;
  error?: string;
  issues?: HealthCheckIssue[];
  recommendations?: string[];
}

interface PrometheusHealthData {
  overall: {
    score: number;
  };
  components: Record<string, { score: number } & Record<string, unknown>>;
}

// Request validation schemas
const HealthQuerySchema = z.object({
  includeDetails: z.coerce.boolean().optional().default(false),
  includeRecommendations: z.coerce.boolean().optional().default(true),
  checkExternal: z.coerce.boolean().optional().default(true),
  format: z.enum(["json", "prometheus"]).optional().default("json"),
});

export async function GET(request: NextRequest) {
  try {
    // Get user context for user-specific health checks
    let userId: string | undefined;
    try {
      const session = await getSession();
      userId = session.user?.id;
    } catch {
      // Health check can work without user context (falls back to environment credentials)
      userId = undefined;
    }

    // Parse and validate query parameters
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());

    const validation = HealthQuerySchema.safeParse(params);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { includeDetails, includeRecommendations, checkExternal, format } =
      validation.data;

    // Perform comprehensive health check
    const healthData = await performComprehensiveHealthCheck(
      includeDetails,
      includeRecommendations,
      checkExternal,
      userId
    );

    // Return data in requested format
    if (format === "prometheus") {
      const prometheusData = convertToPrometheusFormat(healthData);
      return new NextResponse(prometheusData, {
        headers: {
          "Content-Type": "text/plain; version=0.0.4",
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: healthData,
      timestamp: new Date().toISOString(),
      query: validation.data,
    });
  } catch (error) {
    console.error("[Health Analytics] Error:", { error });

    const errorResponse = {
      success: false,
      error: "Failed to fetch system health",
      details: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
      health: {
        overall: "critical" as const,
        score: 0,
        components: {},
      },
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication for POST operations
    const session = await getSession();

    if (!session.isAuthenticated || !session.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const user = session.user;

    const body = await request.json();

    // Schema for health event reporting
    const HealthEventSchema = z.object({
      component: z.string().min(1),
      status: z.enum(["healthy", "degraded", "critical"]),
      message: z.string().min(1),
      metrics: z.record(z.number()).optional(),
      metadata: z.record(z.unknown()).optional(),
    });

    const validation = HealthEventSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const { component, status, message, metrics, metadata } = validation.data;

    // Log the health event
    tradingAnalytics.logTradingEvent({
      eventType: "SYSTEM_ERROR",
      userId: user.id,
      metadata: {
        component,
        healthStatus: status,
        message,
        metrics,
        ...metadata,
      },
      performance: {
        responseTimeMs: 0,
        retryCount: 0,
      },
      success: status === "healthy",
      error: status !== "healthy" ? message : undefined,
    });

    return NextResponse.json({
      success: true,
      message: "Health event logged successfully",
      eventId: `health_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Health Analytics] POST Error:", { error });

    return NextResponse.json(
      {
        error: "Failed to log health event",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Health Check Implementation
// ============================================================================

async function performComprehensiveHealthCheck(
  includeDetails: boolean,
  includeRecommendations: boolean,
  checkExternal: boolean,
  userId?: string
): Promise<{
  overall: {
    status: string;
    score: number;
    checkTime: number;
    timestamp: string;
  };
  components: Record<
    string,
    HealthCheckResult | { status: string; score: number }
  >;
  summary: {
    totalComponents: number;
    healthyComponents: number;
    degradedComponents: number;
    criticalComponents: number;
    totalIssues: number;
    criticalIssues: number;
  };
  issues?: HealthCheckIssue[];
  recommendations?: HealthCheckRecommendation[];
}> {
  const startTime = Date.now();

  // Core system health components
  const healthChecks = {
    analytics: await checkAnalyticsHealth(),
    memory: await checkMemoryHealth(),
    performance: await checkPerformanceHealth(),
    cache: await checkCacheHealth(),
    ...(checkExternal && {
      mexc: await checkMexcApiHealth(userId),
      database: await checkDatabaseHealth(),
      auth: await checkAuthHealth(),
    }),
  };

  // Calculate overall health score
  const componentScores = Object.values(healthChecks).map(
    (check) => check.score
  );
  const overallScore =
    componentScores.reduce((sum, score) => sum + score, 0) /
    componentScores.length;

  const overallStatus =
    overallScore >= 90
      ? "excellent"
      : overallScore >= 75
        ? "good"
        : overallScore >= 60
          ? "fair"
          : overallScore >= 40
            ? "poor"
            : "critical";

  // Collect all issues and recommendations
  const issues = Object.values(healthChecks).flatMap(
    (check) => check.issues || []
  );
  const recommendations = includeRecommendations
    ? Object.values(healthChecks).flatMap(
        (check) => check.recommendations || []
      )
    : [];

  const healthData = {
    overall: {
      status: overallStatus,
      score: Math.round(overallScore),
      checkTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    },
    components: Object.fromEntries(
      Object.entries(healthChecks).map(([name, check]) => [
        name,
        includeDetails ? check : { status: check.status, score: check.score },
      ])
    ),
    summary: {
      totalComponents: Object.keys(healthChecks).length,
      healthyComponents: Object.values(healthChecks).filter(
        (c) => c.score >= 80
      ).length,
      degradedComponents: Object.values(healthChecks).filter(
        (c) => c.score >= 50 && c.score < 80
      ).length,
      criticalComponents: Object.values(healthChecks).filter(
        (c) => c.score < 50
      ).length,
      totalIssues: issues.length,
      criticalIssues: issues.filter((i) => i.severity === "critical").length,
    },
    ...(issues.length > 0 && { issues }),
    ...(recommendations.length > 0 && { recommendations }),
  };

  return healthData;
}

async function checkAnalyticsHealth(): Promise<HealthCheckResult> {
  try {
    const stats = tradingAnalytics.getAnalyticsStats();
    const isHealthy = stats.totalEvents > 0;

    const score = isHealthy ? 100 : 50;
    const status = isHealthy ? "healthy" : "degraded";

    const issues = [];
    const recommendations = [];

    if (!isHealthy) {
      issues.push({
        severity: "warning",
        message: "No analytics events recorded",
        component: "analytics",
      });
      recommendations.push(
        "Verify that analytics service is properly initialized and receiving events"
      );
    }

    return {
      status,
      score,
      lastUpdate: stats.newestEvent || "No events",
      totalEvents: stats.totalEvents,
      eventsLast24h: stats.eventsLast24h,
      cacheSize: stats.cacheSize,
      averageEventSize: Math.round(stats.averageEventSize),
      issues,
      recommendations,
    };
  } catch (error) {
    return {
      status: "critical",
      score: 0,
      error: error instanceof Error ? error.message : "Unknown error",
      issues: [
        {
          severity: "critical",
          message: "Analytics service is not responding",
          component: "analytics",
        },
      ],
      recommendations: ["Restart analytics service and check error logs"],
    };
  }
}

async function checkMemoryHealth(): Promise<HealthCheckResult> {
  try {
    const usage = process.memoryUsage();
    const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const totalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const percentage = (usage.heapUsed / usage.heapTotal) * 100;

    let score = 100;
    let status = "healthy";
    const issues = [];
    const recommendations = [];

    if (percentage > 90) {
      score = 20;
      status = "critical";
      issues.push({
        severity: "critical",
        message: `Memory usage critically high: ${percentage.toFixed(1)}%`,
        component: "memory",
      });
      recommendations.push(
        "Immediate memory cleanup required - restart application"
      );
    } else if (percentage > 80) {
      score = 40;
      status = "degraded";
      issues.push({
        severity: "warning",
        message: `Memory usage high: ${percentage.toFixed(1)}%`,
        component: "memory",
      });
      recommendations.push(
        "Monitor memory usage and consider optimizing data structures"
      );
    }

    return {
      status,
      score,
      heapUsed: `${usedMB} MB`,
      heapTotal: `${totalMB} MB`,
      percentage: `${percentage.toFixed(1)}%`,
      rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
      external: `${Math.round(usage.external / 1024 / 1024)} MB`,
      issues,
      recommendations,
    };
  } catch (error) {
    return {
      status: "critical",
      score: 0,
      error: error instanceof Error ? error.message : "Unknown error",
      issues: [
        {
          severity: "critical",
          message: "Cannot access memory information",
          component: "memory",
        },
      ],
      recommendations: ["Check system permissions and Node.js process health"],
    };
  }
}

async function checkPerformanceHealth(): Promise<HealthCheckResult> {
  try {
    const metrics = tradingAnalytics.getPerformanceMetrics(undefined, 300000); // Last 5 minutes

    if (metrics.length === 0) {
      return {
        status: "degraded",
        score: 60,
        message: "No performance data available",
        recommendations: [
          "Generate some activity to collect performance metrics",
        ],
      };
    }

    const latest = metrics[metrics.length - 1];
    let score = 100;
    let status = "healthy";
    const issues = [];
    const recommendations = [];

    // Check response time
    if (latest.metrics.responseTimeMs > 5000) {
      score -= 40;
      status = "critical";
      issues.push({
        severity: "critical",
        message: `High response time: ${latest.metrics.responseTimeMs}ms`,
        component: "performance",
      });
      recommendations.push(
        "Investigate slow operations and optimize database queries"
      );
    } else if (latest.metrics.responseTimeMs > 2000) {
      score -= 20;
      status = status === "healthy" ? "degraded" : status;
      issues.push({
        severity: "warning",
        message: `Elevated response time: ${latest.metrics.responseTimeMs}ms`,
        component: "performance",
      });
    }

    // Check error rate
    if (latest.metrics.errorRate > 0.1) {
      score -= 30;
      status = "critical";
      issues.push({
        severity: "critical",
        message: `High error rate: ${(latest.metrics.errorRate * 100).toFixed(1)}%`,
        component: "performance",
      });
      recommendations.push("Review error logs and fix failing operations");
    }

    return {
      status,
      score: Math.max(0, score),
      responseTime: `${latest.metrics.responseTimeMs}ms`,
      throughput: `${latest.metrics.throughputPerSecond.toFixed(2)} req/s`,
      errorRate: `${(latest.metrics.errorRate * 100).toFixed(2)}%`,
      successRate: `${(latest.metrics.successRate * 100).toFixed(2)}%`,
      dataPoints: metrics.length,
      issues,
      recommendations,
    };
  } catch (error) {
    return {
      status: "critical",
      score: 0,
      error: error instanceof Error ? error.message : "Unknown error",
      issues: [
        {
          severity: "critical",
          message: "Performance monitoring system failure",
          component: "performance",
        },
      ],
      recommendations: [
        "Restart performance monitoring and check system resources",
      ],
    };
  }
}

async function checkCacheHealth(): Promise<CacheHealthResult> {
  try {
    // Basic cache health check (would be more sophisticated in real implementation)
    const stats = tradingAnalytics.getAnalyticsStats();
    const cacheEfficiency =
      stats.cacheSize > 0 ? stats.totalEvents / stats.cacheSize : 0;

    let score = 90;
    let status = "healthy";
    const issues = [];
    const recommendations = [];

    if (cacheEfficiency > 100) {
      score -= 20;
      status = "degraded";
      issues.push({
        severity: "warning",
        message: "Cache efficiency may be suboptimal",
        component: "cache",
      });
      recommendations.push(
        "Consider increasing cache size or implementing better eviction policies"
      );
    }

    return {
      status,
      score,
      size: stats.cacheSize,
      efficiency: cacheEfficiency.toFixed(2),
      issues,
      recommendations,
    };
  } catch (error) {
    return {
      status: "critical",
      score: 0,
      error: error instanceof Error ? error.message : "Unknown error",
      issues: [
        {
          severity: "critical",
          message: "Cache system not accessible",
          component: "cache",
        },
      ],
      recommendations: ["Restart cache service and verify configuration"],
    };
  }
}

async function checkMexcApiHealth(userId?: string): Promise<MexcHealthResult> {
  try {
    // Try to get user-specific service if userId provided, otherwise fall back to environment
    const mexcService = userId
      ? await getUnifiedMexcService({ userId })
      : await getUnifiedMexcService();

    // Use a basic ping or server time check as health indicator
    const serverTimeStart = Date.now();
    const serverTimeResponse = await mexcService.getServerTime();
    const responseTime = Date.now() - serverTimeStart;

    const isHealthy =
      typeof serverTimeResponse === "number" && serverTimeResponse > 0;

    const score = isHealthy ? 100 : 20;
    const status = isHealthy ? "healthy" : "critical";

    return {
      status,
      score,
      connectivity: isHealthy ? "connected" : "failed",
      latency: `${responseTime}ms`,
      lastUpdated: new Date().toISOString(),
      credentialSource: userId ? "user-specific" : "environment",
      issues: !isHealthy
        ? [
            {
              severity: "critical",
              message: "MEXC API connectivity failed",
              component: "mexc",
            },
          ]
        : [],
      recommendations: !isHealthy
        ? ["Check MEXC API credentials and network connectivity"]
        : [],
    };
  } catch (error) {
    return {
      status: "critical",
      score: 0,
      error: error instanceof Error ? error.message : "Unknown error",
      credentialSource: userId ? "user-specific" : "environment",
      issues: [
        {
          severity: "critical",
          message: "MEXC service health check failed",
          component: "mexc",
        },
      ],
      recommendations: ["Check MEXC API credentials and network connectivity"],
    };
  }
}

async function checkDatabaseHealth(): Promise<DatabaseHealthResult> {
  try {
    // Basic database health check (would need actual database connection in real implementation)
    const startTime = Date.now();
    // Simulate database ping
    await new Promise((resolve) => setTimeout(resolve, 10));
    const responseTime = Date.now() - startTime;

    const score = responseTime < 100 ? 100 : responseTime < 500 ? 80 : 40;
    const status =
      score >= 80 ? "healthy" : score >= 50 ? "degraded" : "critical";

    return {
      status,
      score,
      responseTime: `${responseTime}ms`,
      connectionStatus: "connected",
      recommendations:
        score < 80
          ? ["Optimize database queries and check connection pool"]
          : [],
    };
  } catch (error) {
    return {
      status: "critical",
      score: 0,
      error: error instanceof Error ? error.message : "Unknown error",
      issues: [
        {
          severity: "critical",
          message: "Database connection failed",
          component: "database",
        },
      ],
      recommendations: [
        "Check database server status and connection configuration",
      ],
    };
  }
}

async function checkAuthHealth(): Promise<AuthHealthResult> {
  try {
    // Basic auth health check for Supabase
    const isConfigured = !!(
      process.env.SUPABASE_URL &&
      process.env.SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const score = isConfigured ? 100 : 0;
    const status = isConfigured ? "healthy" : "critical";

    return {
      status,
      score,
      provider: "Supabase",
      configured: isConfigured,
      recommendations: !isConfigured
        ? ["Configure Supabase authentication credentials"]
        : [],
    };
  } catch (error) {
    return {
      status: "critical",
      score: 0,
      error: error instanceof Error ? error.message : "Unknown error",
      issues: [
        {
          severity: "critical",
          message: "Authentication system check failed",
          component: "auth",
        },
      ],
      recommendations: ["Verify authentication service configuration"],
    };
  }
}

function convertToPrometheusFormat(healthData: PrometheusHealthData): string {
  const metrics = [];

  // Overall health score
  metrics.push(
    `# HELP mexc_bot_health_score Overall system health score (0-100)`
  );
  metrics.push(`# TYPE mexc_bot_health_score gauge`);
  metrics.push(`mexc_bot_health_score ${healthData.overall.score}`);

  // Component health scores
  metrics.push(
    `# HELP mexc_bot_component_health_score Component health scores (0-100)`
  );
  metrics.push(`# TYPE mexc_bot_component_health_score gauge`);

  for (const [component, data] of Object.entries(healthData.components)) {
    if (typeof data === "object" && data !== null && "score" in data) {
      metrics.push(
        `mexc_bot_component_health_score{component="${component}"} ${data.score}`
      );
    }
  }

  // Summary metrics
  metrics.push(
    `# HELP mexc_bot_total_components Total number of monitored components`
  );
  metrics.push(`# TYPE mexc_bot_total_components gauge`);
  metrics.push(
    `mexc_bot_total_components ${healthData.summary.totalComponents}`
  );

  metrics.push(`# HELP mexc_bot_critical_issues Number of critical issues`);
  metrics.push(`# TYPE mexc_bot_critical_issues gauge`);
  metrics.push(`mexc_bot_critical_issues ${healthData.summary.criticalIssues}`);

  return `${metrics.join("\n")}\n`;
}
