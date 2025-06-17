import { db } from "@/src/db";
import { sql } from "drizzle-orm";

export interface HealthStatus {
  service: string;
  status: "healthy" | "degraded" | "unhealthy";
  latency?: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface SystemHealth {
  overall: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  checks: HealthStatus[];
}

/**
 * Check database connectivity and performance
 */
export async function checkDatabaseHealth(): Promise<HealthStatus> {
  const startTime = Date.now();

  try {
    // Simple connectivity test
    await db.execute(sql`SELECT 1`);

    // Performance test - check query time
    const latency = Date.now() - startTime;

    if (latency > 1000) {
      return {
        service: "database",
        status: "degraded",
        latency,
        details: { message: "High query latency detected" },
      };
    }

    return {
      service: "database",
      status: "healthy",
      latency,
    };
  } catch (error) {
    return {
      service: "database",
      status: "unhealthy",
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check MEXC API connectivity
 */
export async function checkMexcApiHealth(): Promise<HealthStatus> {
  const startTime = Date.now();

  try {
    // Test MEXC API with a simple endpoint
    const response = await fetch("https://api.mexc.com/api/v3/ping", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      return {
        service: "mexc-api",
        status: "unhealthy",
        latency,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    // Check for high latency
    if (latency > 3000) {
      return {
        service: "mexc-api",
        status: "degraded",
        latency,
        details: { message: "High API latency detected" },
      };
    }

    return {
      service: "mexc-api",
      status: "healthy",
      latency,
    };
  } catch (error) {
    return {
      service: "mexc-api",
      status: "unhealthy",
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check OpenAI API connectivity (for agents)
 */
export async function checkOpenAiHealth(): Promise<HealthStatus> {
  const startTime = Date.now();

  try {
    if (!process.env.OPENAI_API_KEY) {
      return {
        service: "openai-api",
        status: "unhealthy",
        error: "OpenAI API key not configured",
      };
    }

    // Simple API test - check if we can reach OpenAI
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });

    const latency = Date.now() - startTime;

    if (response.status === 401) {
      return {
        service: "openai-api",
        status: "unhealthy",
        latency,
        error: "Invalid OpenAI API key",
      };
    }

    if (!response.ok) {
      return {
        service: "openai-api",
        status: "degraded",
        latency,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    if (latency > 3000) {
      return {
        service: "openai-api",
        status: "degraded",
        latency,
        details: { message: "High API latency detected" },
      };
    }

    return {
      service: "openai-api",
      status: "healthy",
      latency,
    };
  } catch (error) {
    return {
      service: "openai-api",
      status: "unhealthy",
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check memory usage and system resources
 */
export function checkSystemResources(): HealthStatus {
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();

  // Check memory usage (flag if over 500MB)
  const memoryMB = memoryUsage.rss / 1024 / 1024;

  if (memoryMB > 1000) {
    return {
      service: "system-resources",
      status: "degraded",
      details: {
        memoryMB: Math.round(memoryMB),
        uptimeHours: Math.round(uptime / 3600),
        message: "High memory usage detected",
      },
    };
  }

  return {
    service: "system-resources",
    status: "healthy",
    details: {
      memoryMB: Math.round(memoryMB),
      uptimeHours: Math.round(uptime / 3600),
    },
  };
}

/**
 * Perform comprehensive system health check
 */
export async function performSystemHealthCheck(): Promise<SystemHealth> {
  const _startTime = Date.now();

  // Run all health checks in parallel
  const [databaseHealth, mexcApiHealth, openAiHealth, systemHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkMexcApiHealth(),
    checkOpenAiHealth(),
    Promise.resolve(checkSystemResources()),
  ]);

  const checks = [databaseHealth, mexcApiHealth, openAiHealth, systemHealth];

  // Determine overall health status
  const hasUnhealthy = checks.some((check) => check.status === "unhealthy");
  const hasDegraded = checks.some((check) => check.status === "degraded");

  let overall: "healthy" | "degraded" | "unhealthy";
  if (hasUnhealthy) {
    overall = "unhealthy";
  } else if (hasDegraded) {
    overall = "degraded";
  } else {
    overall = "healthy";
  }

  return {
    overall,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    checks,
  };
}

/**
 * Get connectivity status (true/false) for backward compatibility
 */
export async function getConnectivityStatus(): Promise<{
  apiConnectivity: boolean;
  databaseConnectivity: boolean;
  openAiConnectivity: boolean;
}> {
  const health = await performSystemHealthCheck();

  return {
    apiConnectivity: health.checks.find((c) => c.service === "mexc-api")?.status !== "unhealthy",
    databaseConnectivity:
      health.checks.find((c) => c.service === "database")?.status !== "unhealthy",
    openAiConnectivity:
      health.checks.find((c) => c.service === "openai-api")?.status !== "unhealthy",
  };
}
