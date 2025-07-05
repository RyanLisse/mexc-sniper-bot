import { apiResponse, createHealthResponse } from "@/src/lib/api-response";
import { withDatabaseQueryCache } from "@/src/lib/database-query-cache-middleware";
import {
  checkAuthTables,
  checkDatabaseHealth,
} from "@/src/lib/db-health-check";

// Rate limiting for health checks (30-second intervals)
const rateLimitCache = new Map<string, number>();
const RATE_LIMIT_WINDOW = 30 * 1000; // 30 seconds

// Health check result types
interface DatabaseHealthResult {
  healthy: boolean;
  message: string;
  error: string | null;
  fromCircuitBreaker?: boolean;
}

interface AuthTablesHealthResult {
  healthy: boolean;
  message: string;
  error: string | null;
  tables?: Record<string, unknown>;
  fromCircuitBreaker?: boolean;
}

interface CompleteHealthResult {
  status: "healthy" | "unhealthy" | "warning" | "error";
  message: string;
  timestamp: string;
  details: {
    database: DatabaseHealthResult;
    authTables: AuthTablesHealthResult;
    environment: Record<string, unknown>;
    optimization: Record<string, unknown>;
  };
  diagnostics?: Record<string, boolean>;
  error?: string;
}

// Health check result caching
interface HealthCheckResult {
  result: CompleteHealthResult;
  timestamp: number;
  ttl: number;
}
const healthResultCache = new Map<string, HealthCheckResult>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const lastCheck = rateLimitCache.get(key);

  if (!lastCheck || now - lastCheck > RATE_LIMIT_WINDOW) {
    rateLimitCache.set(key, now);
    return false;
  }

  return true;
}

function getCachedHealthResult(key: string): CompleteHealthResult | null {
  const cached = healthResultCache.get(key);
  if (!cached) return null;

  const now = Date.now();
  if (now - cached.timestamp > cached.ttl) {
    healthResultCache.delete(key);
    return null;
  }

  return cached.result;
}

function setCachedHealthResult(
  key: string,
  result: CompleteHealthResult,
  isHealthy: boolean
): void {
  const ttl = isHealthy ? 10 * 60 * 1000 : 30 * 1000; // 10 min success, 30 sec failure
  healthResultCache.set(key, {
    result,
    timestamp: Date.now(),
    ttl,
  });
}

async function healthHandler(request: Request) {
  const clientIP =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const rateLimitKey = `health-check-${clientIP}`;
  const cacheKey = "health-check-result";

  try {
    // Check rate limiting first
    if (isRateLimited(rateLimitKey)) {
      // Return cached result if available during rate limit
      const cached = getCachedHealthResult(cacheKey);
      if (cached) {
        return apiResponse(createHealthResponse(cached), cached.status === "healthy" ? 200 : 503);
      }

      // Return rate limited response
      const rateLimitResult = {
        status: "warning" as const,
        message: "Health check rate limited - too many requests",
        timestamp: new Date().toISOString(),
        details: {
          rateLimitWindow: RATE_LIMIT_WINDOW / 1000,
          message: "Please wait before requesting another health check",
        },
      };
      return apiResponse(createHealthResponse(rateLimitResult), 429);
    }

    // Check for cached health result first
    const cachedResult = getCachedHealthResult(cacheKey);
    if (cachedResult) {
      console.info("[Health Check] Returning cached result");
      return apiResponse(
        createHealthResponse(cachedResult),
        cachedResult.status === "healthy" ? 200 : 503
      );
    }

    let dbHealth: DatabaseHealthResult = {
      healthy: false,
      message: "Database check not performed",
      error: "Unknown error",
    };
    let authTables: AuthTablesHealthResult = {
      healthy: false,
      message: "Auth tables check not performed",
      error: "Unknown error",
    };

    // Check basic database connectivity first (most critical)
    try {
      dbHealth = await Promise.race([
        checkDatabaseHealth(),
        new Promise<{ healthy: false; message: string; error: string }>(
          (_, reject) =>
            setTimeout(
              () => reject(new Error("Database health check timeout")),
              5000
            )
        ),
      ]);
    } catch (dbError) {
      dbHealth = {
        healthy: false,
        message: "Database connectivity failed",
        error: dbError instanceof Error ? dbError.message : String(dbError),
      };
      console.error("[Health Check] Database connectivity error:", dbError);
    }

    // Only check auth tables if basic connectivity works (skip expensive checks)
    if (dbHealth.healthy) {
      try {
        // Use optimized critical-only table check by default
        authTables = await Promise.race([
          checkAuthTables(false), // Only check critical tables (user, session)
          new Promise<{ healthy: false; message: string; error: string }>(
            (_, reject) =>
              setTimeout(
                () => reject(new Error("Auth tables check timeout")),
                3000
              )
          ),
        ]);
      } catch (authError) {
        authTables = {
          healthy: false,
          message: "Auth tables check failed",
          error:
            authError instanceof Error ? authError.message : String(authError),
        };
        console.error("[Health Check] Auth tables check error:", authError);
      }
    } else {
      // Skip auth table checks if basic connectivity fails
      authTables = {
        healthy: false,
        message: "Skipped due to database connectivity issues",
        error: "Database unavailable",
      };
    }

    // Check environment variables (cached at runtime)
    const envCheck = {
      AUTH_SECRET: !!process.env.AUTH_SECRET,
      DATABASE_URL: !!process.env.DATABASE_URL,
      DATABASE_URL_PROTOCOL:
        process.env.DATABASE_URL?.split("://")[0] || "unknown",
      NODE_ENV: process.env.NODE_ENV || "development",
    };

    const isHealthy = dbHealth.healthy && authTables.healthy;
    const timestamp = new Date().toISOString();

    const healthResult = {
      status: isHealthy ? ("healthy" as const) : ("unhealthy" as const),
      message: isHealthy
        ? "Database is healthy"
        : "Database has connectivity or configuration issues",
      timestamp,
      details: {
        database: dbHealth,
        authTables: authTables,
        environment: envCheck,
        optimization: {
          cached: false,
          tableChecksReduced: true,
          criticalTablesOnly: !dbHealth.healthy ? "skipped" : "checked",
          circuitBreakerActive:
            dbHealth.fromCircuitBreaker ||
            authTables.fromCircuitBreaker ||
            false,
        },
      },
      diagnostics: {
        dbConnectivityIssue: !dbHealth.healthy,
        authTablesIssue: !authTables.healthy && dbHealth.healthy,
        configurationIssue: !envCheck.DATABASE_URL || !envCheck.AUTH_SECRET,
        cascadeRisk: !dbHealth.healthy,
      },
    };

    // Cache the result
    setCachedHealthResult(cacheKey, healthResult, isHealthy);

    const response = createHealthResponse(healthResult);
    return apiResponse(response, isHealthy ? 200 : 503);
  } catch (error) {
    console.error("[Health Check] Unexpected error:", error);

    const criticalHealthResult = {
      status: "error" as const,
      message: "Database health check failed completely",
      timestamp: new Date().toISOString(),
      details: {
        database: {
          healthy: false,
          message: "Critical error",
          error: "System failure",
        },
        authTables: {
          healthy: false,
          message: "Critical error",
          error: "System failure",
        },
        environment: {
          AUTH_SECRET: !!process.env.AUTH_SECRET,
          DATABASE_URL: !!process.env.DATABASE_URL,
          DATABASE_URL_PROTOCOL:
            process.env.DATABASE_URL?.split("://")[0] || "unknown",
          NODE_ENV: process.env.NODE_ENV || "development",
        },
        optimization: {
          cached: false,
          criticalError: true,
        },
      },
      error: error instanceof Error ? error.message : String(error),
      diagnostics: {
        dbConnectivityIssue: true,
        authTablesIssue: true,
        configurationIssue:
          !process.env.DATABASE_URL || !process.env.AUTH_SECRET,
        cascadeRisk: true,
      },
    };

    const response = createHealthResponse(criticalHealthResult);
    return apiResponse(response, 503);
  }
}

// Export with database query cache
export const GET = withDatabaseQueryCache(healthHandler, {
  endpoint: "/api/health/db",
  cacheTtlSeconds: 300, // 5 minutes cache
  enableCompression: false,
  enableStaleWhileRevalidate: true,
});
