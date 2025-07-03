import { db } from "../db";
import { account, session, user, verification } from "../db/schema";

// Health check caching with TTL
interface HealthCheckCache {
  result: any;
  timestamp: number;
  ttl: number;
}

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: "closed" | "open" | "half-open";
}

const healthCache = new Map<string, HealthCheckCache>();
const circuitBreakers = new Map<string, CircuitBreakerState>();

// Cache TTL constants (in milliseconds)
const CACHE_TTL_SUCCESS = 5 * 60 * 1000; // 5 minutes for successful checks
const CACHE_TTL_FAILURE = 30 * 1000; // 30 seconds for failed checks
const TABLE_EXISTENCE_TTL = 60 * 60 * 1000; // 1 hour for table existence checks

// Circuit breaker constants
const FAILURE_THRESHOLD = 3;
const CIRCUIT_BREAKER_TIMEOUT = 60 * 1000; // 1 minute

function getCachedResult(key: string): any | null {
  const cached = healthCache.get(key);
  if (!cached) return null;

  const now = Date.now();
  if (now - cached.timestamp > cached.ttl) {
    healthCache.delete(key);
    return null;
  }

  return cached.result;
}

function setCachedResult(key: string, result: any, isSuccess: boolean): void {
  const ttl = isSuccess ? CACHE_TTL_SUCCESS : CACHE_TTL_FAILURE;
  healthCache.set(key, {
    result,
    timestamp: Date.now(),
    ttl,
  });
}

function getCircuitBreakerState(key: string): CircuitBreakerState {
  return (
    circuitBreakers.get(key) || { failures: 0, lastFailure: 0, state: "closed" }
  );
}

function updateCircuitBreaker(key: string, isSuccess: boolean): void {
  const state = getCircuitBreakerState(key);
  const now = Date.now();

  if (isSuccess) {
    circuitBreakers.set(key, { failures: 0, lastFailure: 0, state: "closed" });
  } else {
    const newFailures = state.failures + 1;
    const newState = newFailures >= FAILURE_THRESHOLD ? "open" : "closed";
    circuitBreakers.set(key, {
      failures: newFailures,
      lastFailure: now,
      state: newState,
    });
  }
}

function isCircuitBreakerOpen(key: string): boolean {
  const state = getCircuitBreakerState(key);
  if (state.state === "closed") return false;

  const now = Date.now();
  if (
    state.state === "open" &&
    now - state.lastFailure > CIRCUIT_BREAKER_TIMEOUT
  ) {
    // Transition to half-open
    circuitBreakers.set(key, { ...state, state: "half-open" });
    return false;
  }

  return state.state === "open";
}
export async function checkDatabaseHealth() {
  const cacheKey = "db-health";

  // Check cache first
  const cached = getCachedResult(cacheKey);
  if (cached) {
    return cached;
  }

  // Check circuit breaker
  if (isCircuitBreakerOpen(cacheKey)) {
    const result = {
      healthy: false,
      message:
        "Database check circuit breaker is open - too many recent failures",
      error: "Circuit breaker open",
      fromCircuitBreaker: true,
    };
    setCachedResult(cacheKey, result, false);
    return result;
  }

  try {
    // Use a simple SELECT 1 query with timeout for faster, lighter check
    const result = await Promise.race([
      db.execute(`SELECT 1 as health_check`),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Health check timeout after 3 seconds")),
          3000
        )
      ),
    ]);

    if (result) {
      console.info("[DB Health] Database connection successful");
      const healthResult = {
        healthy: true,
        message: "Database is connected",
        error: null,
      };
      setCachedResult(cacheKey, healthResult, true);
      updateCircuitBreaker(cacheKey, true);
      return healthResult;
    }

    const healthResult = {
      healthy: false,
      message: "Database query returned no result",
      error: "No response from database",
    };
    setCachedResult(cacheKey, healthResult, false);
    updateCircuitBreaker(cacheKey, false);
    return healthResult;
  } catch (error) {
    const errorMessage = (error as Error)?.message || "Unknown error";
    console.error("[DB Health] Database error:", error);

    // Determine specific error type for better error handling
    const isConnectivityError =
      errorMessage.includes("ECONNREFUSED") ||
      errorMessage.includes("ENOTFOUND") ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("connection") ||
      errorMessage.includes("network");

    const healthResult = {
      healthy: false,
      message: isConnectivityError
        ? "Database connectivity issue - network or server problem"
        : "Database connection failed",
      error: errorMessage,
    };

    setCachedResult(cacheKey, healthResult, false);
    updateCircuitBreaker(cacheKey, false);
    return healthResult;
  }
}

export async function checkAuthTables(includeAllTables = false) {
  const cacheKey = includeAllTables
    ? "auth-tables-full"
    : "auth-tables-critical";

  // Check cache first
  const cached = getCachedResult(cacheKey);
  if (cached) {
    return cached;
  }

  // Check circuit breaker
  if (isCircuitBreakerOpen(cacheKey)) {
    const result = {
      healthy: false,
      message:
        "Auth tables check circuit breaker is open - too many recent failures",
      error: "Circuit breaker open",
      tables: {},
      fromCircuitBreaker: true,
    };
    setCachedResult(cacheKey, result, false);
    return result;
  }

  try {
    // Only check critical tables by default (reduces queries from 4 to 2)
    const tableChecks = includeAllTables
      ? [
          { name: "user", table: user },
          { name: "session", table: session },
          { name: "account", table: account },
          { name: "verification", table: verification },
        ]
      : [
          { name: "user", table: user },
          { name: "session", table: session },
        ];

    const results: Record<string, any> = {};

    // Use table existence cache for non-critical checks
    if (includeAllTables) {
      for (const { name, table } of tableChecks) {
        const existenceCacheKey = `table-exists-${name}`;
        const cachedExistence = getCachedResult(existenceCacheKey);

        if (cachedExistence && name !== "user" && name !== "session") {
          results[name] = cachedExistence;
          continue;
        }

        try {
          const result = await Promise.race([
            db.select().from(table).limit(1),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error(`Table ${name} check timeout`)),
                2000
              )
            ),
          ]);
          const tableResult = {
            exists: true,
            count: Array.isArray(result) ? result.length : 0,
          };
          results[name] = tableResult;

          // Cache non-critical table existence for 1 hour
          if (name !== "user" && name !== "session") {
            healthCache.set(existenceCacheKey, {
              result: tableResult,
              timestamp: Date.now(),
              ttl: TABLE_EXISTENCE_TTL,
            });
          }
        } catch (error) {
          const errorMessage = (error as Error).message;
          const tableResult = {
            exists: false,
            error: errorMessage,
            isTimeout: errorMessage.includes("timeout"),
            isConnectivity:
              errorMessage.includes("ECONNREFUSED") ||
              errorMessage.includes("connection"),
          };
          results[name] = tableResult;
        }
      }
    } else {
      // Optimized critical table check - batch query when possible
      try {
        const [userResult, sessionResult] = await Promise.all([
          Promise.race([
            db.select().from(user).limit(1),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("User table check timeout")),
                2000
              )
            ),
          ]),
          Promise.race([
            db.select().from(session).limit(1),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Session table check timeout")),
                2000
              )
            ),
          ]),
        ]);

        results.user = {
          exists: true,
          count: Array.isArray(userResult) ? userResult.length : 0,
        };
        results.session = {
          exists: true,
          count: Array.isArray(sessionResult) ? sessionResult.length : 0,
        };
      } catch (error) {
        const _errorMessage = (error as Error).message;

        // Individual fallback checks if batch fails
        for (const { name, table } of tableChecks) {
          if (!results[name]) {
            try {
              const result = await Promise.race([
                db.select().from(table).limit(1),
                new Promise((_, reject) =>
                  setTimeout(
                    () => reject(new Error(`Table ${name} check timeout`)),
                    2000
                  )
                ),
              ]);
              results[name] = {
                exists: true,
                count: Array.isArray(result) ? result.length : 0,
              };
            } catch (tableError) {
              const tableErrorMessage = (tableError as Error).message;
              results[name] = {
                exists: false,
                error: tableErrorMessage,
                isTimeout: tableErrorMessage.includes("timeout"),
                isConnectivity:
                  tableErrorMessage.includes("ECONNREFUSED") ||
                  tableErrorMessage.includes("connection"),
              };
            }
          }
        }
      }
    }

    // Determine overall health based on critical tables
    const criticalTables = ["user", "session"];
    const criticalTablesHealthy = criticalTables.every(
      (tableName) => results[tableName]?.exists
    );

    const authResult = {
      healthy: criticalTablesHealthy,
      tables: results,
      message: criticalTablesHealthy
        ? "Auth tables are accessible"
        : "One or more critical auth tables are inaccessible",
      error: null,
    };

    setCachedResult(cacheKey, authResult, criticalTablesHealthy);
    updateCircuitBreaker(cacheKey, criticalTablesHealthy);
    return authResult;
  } catch (error) {
    const errorMessage = (error as Error)?.message || "Unknown error";
    const authResult = {
      healthy: false,
      message: "Failed to check auth tables",
      error: errorMessage,
      tables: {},
    };

    setCachedResult(cacheKey, authResult, false);
    updateCircuitBreaker(cacheKey, false);
    return authResult;
  }
}

// Utility functions for cache management
export function clearHealthCheckCaches(): void {
  healthCache.clear();
  circuitBreakers.clear();
  console.info(
    "[DB Health] All health check caches and circuit breakers cleared"
  );
}

export function getHealthCheckCacheStats(): {
  cacheSize: number;
  circuitBreakerCount: number;
  cacheKeys: string[];
  circuitBreakerStates: Record<string, CircuitBreakerState>;
} {
  return {
    cacheSize: healthCache.size,
    circuitBreakerCount: circuitBreakers.size,
    cacheKeys: Array.from(healthCache.keys()),
    circuitBreakerStates: Object.fromEntries(circuitBreakers.entries()),
  };
}
