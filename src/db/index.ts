import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
// OpenTelemetry database instrumentation
import {
  instrumentConnectionHealth,
  instrumentDatabase,
  instrumentDatabaseQuery,
} from "@/src/lib/opentelemetry-database-instrumentation";
import * as schema from "./schema";

// Retry configuration
const RETRY_DELAYS = [100, 500, 1000, 2000, 5000]; // Exponential backoff
const MAX_RETRIES = 5;

// Connection pool configuration
interface ConnectionPoolConfig {
  maxConnections?: number;
  idleTimeout?: number;
  connectionTimeout?: number;
}

// Client cache for connection pooling
let postgresClient: ReturnType<typeof postgres> | null = null;

// Sleep utility for retry logic
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Lazy logger initialization to prevent build-time errors and race conditions
function getLogger() {
  // Use a local static variable to ensure thread-safety
  if (!(getLogger as any)._logger) {
    (getLogger as any)._logger = {
      info: (message: string, context?: any) => console.info("[db-index]", message, context || ""),
      warn: (message: string, context?: any) => console.warn("[db-index]", message, context || ""),
      error: (message: string, context?: any, error?: Error) =>
        console.error("[db-index]", message, context || "", error || ""),
      debug: (message: string, context?: any) =>
        console.debug("[db-index]", message, context || ""),
    };
  }
  return (getLogger as any)._logger;
}

async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  retries = MAX_RETRIES
): Promise<T> {
  let lastError: any;

  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const delay = RETRY_DELAYS[Math.min(i, RETRY_DELAYS.length - 1)];
      getLogger().warn(
        `[Database] ${operationName} failed (attempt ${i + 1}/${retries}), retrying in ${delay}ms...`,
        error
      );

      // Don't retry on the last attempt
      if (i < retries - 1) {
        await sleep(delay);
      }
    }
  }

  getLogger().error(`[Database] ${operationName} failed after ${retries} attempts`, lastError);
  throw lastError;
}

// Check if we have NeonDB/PostgreSQL configuration
const hasNeonConfig = () => !!process.env.DATABASE_URL?.startsWith("postgresql://");

// Create PostgreSQL client with connection pooling
function createPostgresClient() {
  if (!process.env.DATABASE_URL?.startsWith("postgresql://")) {
    throw new Error("NeonDB configuration missing: need DATABASE_URL with postgresql:// protocol");
  }

  // Return cached client if available
  if (postgresClient) {
    return postgresClient;
  }

  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL;
  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST;

  // PostgreSQL connection configuration
  const connectionConfig = {
    // Connection pool settings
    max: isProduction ? 20 : 10, // Increased max connections for better concurrency
    idle_timeout: 20, // 20 seconds idle timeout
    connect_timeout: 10, // Reduced to 10 seconds for faster failures

    // Keep alive settings for better connection stability (TCP keepalive interval in seconds)
    keep_alive: 60,

    // SSL/TLS settings for NeonDB
    ssl: isProduction ? "require" : ("prefer" as any),

    // Performance optimizations
    prepare: !isTest, // Prepared statements (disabled in tests for compatibility)

    // Connection handling
    connection: {
      application_name: "mexc-sniper-bot",
      statement_timeout: 15000, // Reduced to 15 seconds for faster responses
      idle_in_transaction_session_timeout: 15000, // Reduced to 15 seconds
      lock_timeout: 10000, // 10 seconds for lock timeouts
    },

    // Transform for compatibility
    transform: {
      undefined: null,
    },

    // Debug settings (only in development)
    debug: process.env.NODE_ENV === "development" && process.env.DATABASE_DEBUG === "true",
  };

  try {
    postgresClient = postgres(process.env.DATABASE_URL, connectionConfig);
    getLogger().info(`[Database] PostgreSQL connection established with NeonDB`);
    return postgresClient;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    getLogger().error(`[Database] Failed to create PostgreSQL client:`, errorMessage);
    throw new Error(`Failed to create PostgreSQL client: ${errorMessage}`);
  }
}

// Create mock database for testing
function createMockDatabase() {
  // Create a thenable mock that resolves to empty array
  const createThenable = (result: any[] = []) => {
    const thenable = {
      then: (resolve: any) => resolve(result),
      catch: (reject: any) => reject,
      finally: (fn: any) => fn(),
      // Add common query methods that return themselves
      where: () => thenable,
      orderBy: () => thenable,
      limit: () => thenable,
      select: () => thenable,
      from: () => thenable,
      set: () => thenable,
      values: () => thenable,
      returning: () => thenable,
    };
    return thenable;
  };

  return {
    execute: async () => [{ test_value: 1, count: "1" }],
    query: async () => [],
    insert: () => ({
      values: () => ({
        returning: () => createThenable([{ id: "mock-id" }]),
      }),
    }),
    select: () => ({
      from: () => createThenable([]),
    }),
    update: () => ({
      set: () => createThenable([]),
    }),
    delete: () => createThenable([]),
    transaction: async (cb: any) => {
      // Ensure transaction callback gets proper mock database
      try {
        const result = await cb(createMockDatabase());
        return result;
      } catch (error) {
        throw error;
      }
    },
    // Add connection cleanup for tests
    end: async () => Promise.resolve(),
    destroy: async () => Promise.resolve(),
    // Add emergency cleanup hook
    $emergencyCleanup: async () => {
      getLogger().debug("[Database] Mock database emergency cleanup completed");
      return Promise.resolve();
    },
  };
}

// PostgreSQL-only database configuration for NeonDB
function createDatabase() {
  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL;
  const isRailway = process.env.RAILWAY_ENVIRONMENT === "production";
  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST;

  // In test environment with mock flags, return a mock database
  if (
    isTest &&
    (process.env.FORCE_MOCK_DB === "true" || process.env.USE_MOCK_DATABASE === "true")
  ) {
    getLogger().info("[Database] Using mocked database for tests");
    return createMockDatabase();
  }

  if (!hasNeonConfig()) {
    throw new Error(
      "NeonDB configuration required: DATABASE_URL must be set with postgresql:// protocol"
    );
  }

  // Debug logging (remove in production)
  if (process.env.NODE_ENV !== "production") {
    getLogger().info("[Database] Using NeonDB PostgreSQL database");
  }

  try {
    const client = createPostgresClient();
    const baseDb = drizzle(client, { schema });

    // Wrap database with OpenTelemetry instrumentation
    const db = instrumentDatabase(baseDb);

    // Test connection immediately to catch auth issues early
    if (isProduction || isRailway) {
      getLogger().info("[Database] Testing NeonDB connection in production...");
    }

    // Initialize PostgreSQL extensions if needed
    if (!isTest) {
      setTimeout(async () => {
        try {
          // Test basic connectivity
          await db.execute(sql`SELECT 1 as test`);
          getLogger().info("[Database] NeonDB connection verified successfully");
        } catch (error) {
          getLogger().error("[Database] NeonDB connection test failed:", error);
        }
      }, 1000);
    }

    return db;
  } catch (error) {
    getLogger().error("[Database] NeonDB initialization error:", error);

    // Enhanced error handling for production
    if (isProduction || isRailway) {
      getLogger().error("[Database] NeonDB failed in production environment");
      getLogger().error("[Database] Error details:", {
        message: error instanceof Error ? error.message : String(error),
        code: error instanceof Error && "code" in error ? (error as any).code : "UNKNOWN",
        env: {
          hasUrl: !!process.env.DATABASE_URL,
          urlProtocol: process.env.DATABASE_URL?.split("://")[0],
          isVercel: !!process.env.VERCEL,
          nodeEnv: process.env.NODE_ENV,
        },
      });
    }

    // In production, we need to fail gracefully
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `NeonDB connection failed: ${errorMessage}. Check DATABASE_URL and connection settings.`
    );
  }
}

// Create database instance with retry logic
let dbInstance: ReturnType<typeof createDatabase> | null = null;

export function getDb() {
  if (!dbInstance) {
    dbInstance = createDatabase();
  }
  return dbInstance;
}

// Clear cached database instance (for testing)
export function clearDbCache() {
  dbInstance = null;
  postgresClient = null;
}

// Lazy initialization - db instance created when first accessed
export const db = new Proxy({} as ReturnType<typeof createDatabase>, {
  get(_target, prop) {
    const instance = getDb();
    return (instance as any)[prop];
  },
});

// Export schema for use in other files
export * from "./schema";

import { eq } from "drizzle-orm";
import { databaseConnectionPool } from "@/src/lib/database-connection-pool";
// Import optimization tools
import { databaseOptimizationManager } from "@/src/lib/database-optimization-manager";
import { queryPerformanceMonitor } from "../services/query-performance-monitor";
// Import necessary schema elements for user preferences
import { userPreferences } from "./schemas/auth";

// Database utilities with retry logic
export async function initializeDatabase() {
  return withRetry(
    async () => {
      getLogger().info("[Database] Initializing NeonDB database...");

      // Test connection with a simple query
      const result = await db.execute(sql`SELECT 1`);
      if (result) {
        getLogger().info("[Database] NeonDB connection successful");
      }

      // Check available PostgreSQL extensions
      try {
        // Check for vector extension (pgvector)
        await db.execute(sql`SELECT 1 FROM pg_available_extensions WHERE name = 'vector'`);
        getLogger().info("[Database] Vector extension (pgvector) available for embeddings");
      } catch (_error) {
        getLogger().info("[Database] Vector extension not available, AI features may be limited");
      }

      // Initialize performance monitoring
      if (process.env.NODE_ENV !== "test") {
        queryPerformanceMonitor.startMonitoring();
        getLogger().info("[Database] Performance monitoring started");

        // Auto-optimize for agent workloads in production
        if (process.env.NODE_ENV === "production") {
          try {
            await databaseOptimizationManager.optimizeForAgentWorkloads();
            getLogger().info("[Database] Optimized for AI agent workloads");
          } catch (error) {
            getLogger().warn("[Database] Failed to auto-optimize for agents:", error);
          }
        }
      }

      return true;
    },
    "Database initialization",
    3 // Fewer retries for initialization
  );
}

// Execute query with retry logic
export async function executeWithRetry<T>(
  query: () => Promise<T>,
  operationName = "Database query"
): Promise<T> {
  return withRetry(query, operationName);
}

// Health check with detailed status
export async function healthCheck() {
  return instrumentConnectionHealth();
}

// Internal health check implementation
async function internalHealthCheck() {
  try {
    const startTime = Date.now();
    await db.execute(sql`SELECT 1`);
    const responseTime = Date.now() - startTime;

    const isHealthy = responseTime < 2000; // Less than 2 seconds is healthy for NeonDB
    const status = isHealthy ? "healthy" : responseTime < 5000 ? "degraded" : "critical";

    return {
      status,
      responseTime,
      database: "neondb",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "offline",
      error: error instanceof Error ? error.message : "Unknown error",
      database: "neondb",
      timestamp: new Date().toISOString(),
    };
  }
}

// Optimized query execution wrappers
export async function executeOptimizedSelect<T>(
  queryFn: () => Promise<T>,
  cacheKey?: string,
  cacheTTL?: number
): Promise<T> {
  return databaseConnectionPool.executeSelect(queryFn, cacheKey || "default", cacheTTL);
}

export async function executeOptimizedWrite<T>(
  queryFn: () => Promise<T>,
  invalidatePatterns: string[] = []
): Promise<T> {
  return databaseConnectionPool.executeWrite(queryFn, invalidatePatterns);
}

export async function executeBatchOperations<T>(
  operations: (() => Promise<T>)[],
  invalidatePatterns: string[] = []
): Promise<T[]> {
  return databaseConnectionPool.executeBatch(operations, invalidatePatterns);
}

// Performance monitoring wrapper with OpenTelemetry
export async function monitoredQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  options?: {
    query?: string;
    parameters?: unknown[];
    userId?: string;
    operationType?: "select" | "insert" | "update" | "delete";
    tableName?: string;
  }
): Promise<T> {
  return instrumentDatabaseQuery(
    queryName,
    () => queryPerformanceMonitor.wrapQuery(queryName, queryFn, options),
    {
      operationType: options?.operationType || "select",
      tableName: options?.tableName,
      queryName,
      includeQuery: !!options?.query,
    }
  );
}

// User Preferences Database Operations
export async function getUserPreferences(userId: string): Promise<any | null> {
  try {
    const result = (await executeWithRetry(
      async () =>
        db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1),
      "getUserPreferences"
    )) as any[];

    if (result.length === 0) {
      return null;
    }

    const prefs = result[0];

    // Safe pattern parsing with fallbacks
    let patternParts: number[] = [2, 2, 4]; // Default fallback
    try {
      if (prefs.readyStatePattern && typeof prefs.readyStatePattern === "string") {
        const parts = prefs.readyStatePattern.split(",").map(Number);
        if (parts.length >= 3 && parts.every((p: number) => !isNaN(p) && p > 0)) {
          patternParts = parts;
        }
      }
    } catch (error) {
      getLogger().warn("Failed to parse readyStatePattern, using defaults:", {
        pattern: prefs.readyStatePattern,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Safe JSON parsing helper
    const safeJsonParse = (jsonString: string | null | undefined, fallback: any = undefined) => {
      if (!jsonString || typeof jsonString !== "string") return fallback;
      try {
        return JSON.parse(jsonString);
      } catch (error) {
        getLogger().warn("Failed to parse JSON field:", {
          jsonString: jsonString.substring(0, 100),
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return fallback;
      }
    };

    return {
      ...prefs,
      // Parse JSON fields safely
      takeProfitLevelsConfig: safeJsonParse(prefs.takeProfitLevelsConfig),
      customExitStrategy: safeJsonParse(prefs.customExitStrategy),
      // Include parsed pattern for convenience
      readyStatePatternParts: patternParts,
    };
  } catch (error) {
    getLogger().error("Failed to get user preferences:", { userId, error });
    throw error;
  }
}

export async function closeDatabase() {
  try {
    getLogger().info("[Database] Database connection closed");

    // Stop performance monitoring
    try {
      queryPerformanceMonitor.stopMonitoring();
    } catch (error) {
      getLogger().warn("[Database] Error stopping performance monitoring:", error);
    }

    // Shutdown connection pool
    try {
      await databaseConnectionPool.shutdown();
    } catch (error) {
      getLogger().warn("[Database] Error shutting down connection pool:", error);
    }

    // Close PostgreSQL connection if exists
    if (postgresClient) {
      try {
        await Promise.race([
          postgresClient.end({ timeout: 2 }), // Reduced timeout for tests
          new Promise(
            (resolve) =>
              setTimeout(() => {
                getLogger().warn("[Database] PostgreSQL close timed out, forcing shutdown");
                resolve(undefined);
              }, 2000) // Reduced timeout for tests
          ),
        ]);
        getLogger().info("[Database] NeonDB PostgreSQL connection closed");
      } catch (error) {
        getLogger().warn("[Database] Error closing PostgreSQL connection:", error);
      }
    }

    // Emergency cleanup for mock databases
    if (dbInstance && typeof (dbInstance as any).$emergencyCleanup === "function") {
      try {
        await (dbInstance as any).$emergencyCleanup();
      } catch (error) {
        getLogger().warn("[Database] Error in emergency cleanup:", error);
      }
    }

    // Reset cached instances
    dbInstance = null;
    postgresClient = null;
  } catch (error) {
    getLogger().error("[Database] Error closing database:", error);
  }
}

// Register emergency cleanup hook for tests
if (typeof global !== "undefined") {
  (global as any).__emergency_db_cleanup__ = closeDatabase;
}
