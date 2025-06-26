import { sql } from "drizzle-orm";
import { db } from "../db";

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
 * Check MEXC API connectivity and credential validation
 */
export async function checkMexcApiHealth(): Promise<HealthStatus> {
  const startTime = Date.now();

  try {
    // Check if credentials are configured
    if (!process.env.MEXC_API_KEY || !process.env.MEXC_SECRET_KEY) {
      return {
        service: "mexc-api",
        status: "unhealthy",
        latency: Date.now() - startTime,
        error: "MEXC API credentials not configured",
        details: {
          hasApiKey: !!process.env.MEXC_API_KEY,
          hasApiSecret: !!process.env.MEXC_SECRET_KEY,
          message: "API key and secret required for MEXC connectivity",
        },
      };
    }

    // Test authenticated endpoint to verify credentials
    const testUrl = new URL("https://api.mexc.com/api/v3/account");
    testUrl.searchParams.set("timestamp", Date.now().toString());

    // Create signature for authenticated request
    const crypto = require("crypto");
    const queryString = testUrl.searchParams.toString();
    const signature = crypto
      .createHmac("sha256", process.env.MEXC_SECRET_KEY)
      .update(queryString)
      .digest("hex");

    testUrl.searchParams.set("signature", signature);

    const mexcController = new AbortController();
    setTimeout(() => mexcController.abort(), 5000);

    const response = await fetch(testUrl.toString(), {
      method: "GET",
      headers: {
        "X-MEXC-APIKEY": process.env.MEXC_API_KEY,
        "Content-Type": "application/json",
      },
      signal: mexcController.signal,
    });

    const latency = Date.now() - startTime;

    // Handle authentication errors
    if (response.status === 401) {
      return {
        service: "mexc-api",
        status: "unhealthy",
        latency,
        error: "Invalid MEXC API credentials",
        details: {
          message: "API key or secret is invalid",
          statusCode: response.status,
        },
      };
    }

    if (response.status === 403) {
      return {
        service: "mexc-api",
        status: "unhealthy",
        latency,
        error: "MEXC API access forbidden",
        details: {
          message: "API permissions insufficient or IP not whitelisted",
          statusCode: response.status,
        },
      };
    }

    if (!response.ok) {
      return {
        service: "mexc-api",
        status: "degraded",
        latency,
        error: `HTTP ${response.status}: ${response.statusText}`,
        details: {
          message: "MEXC API responding with errors",
          statusCode: response.status,
        },
      };
    }

    // Check for high latency
    if (latency > 3000) {
      return {
        service: "mexc-api",
        status: "degraded",
        latency,
        details: {
          message: "High API latency detected",
          credentialsValid: true,
        },
      };
    }

    return {
      service: "mexc-api",
      status: "healthy",
      latency,
      details: {
        credentialsValid: true,
        message: "MEXC API credentials validated successfully",
      },
    };
  } catch (error) {
    return {
      service: "mexc-api",
      status: "unhealthy",
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
      details: {
        message: "Failed to connect to MEXC API",
      },
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
    const openaiController = new AbortController();
    setTimeout(() => openaiController.abort(), 5000);

    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: openaiController.signal,
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
