import { createClient } from "@supabase/supabase-js";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// OpenTelemetry database instrumentation
import {
  instrumentConnectionHealth,
  instrumentDatabase,
  instrumentDatabaseQuery,
} from "../lib/opentelemetry-database-instrumentation";
import * as originalSchema from "./schemas";
import { supabaseSchema } from "./schemas/supabase-schema";

// Supabase client configuration
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder_key",
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// Admin client for server-side operations
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder_service_role_key",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

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
      info: (message: string, context?: any) =>
        console.info("[db-index]", message, context || ""),
      warn: (message: string, context?: any) =>
        console.warn("[db-index]", message, context || ""),
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

  getLogger().error(
    `[Database] ${operationName} failed after ${retries} attempts`,
    lastError
  );
  throw lastError;
}

// Check if we have NeonDB/PostgreSQL configuration
const hasNeonConfig = () =>
  !!process.env.DATABASE_URL?.startsWith("postgresql://") &&
  !process.env.DATABASE_URL?.includes("supabase.com");

// Check if we have Supabase configuration
export const hasSupabaseConfig = () =>
  !!process.env.DATABASE_URL?.includes("supabase.com") &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL;

// Create PostgreSQL client with connection pooling
function createPostgresClient() {
  if (!process.env.DATABASE_URL?.startsWith("postgresql://")) {
    throw new Error(
      "Database configuration missing: need DATABASE_URL with postgresql:// protocol"
    );
  }

  // Return cached client if available
  if (postgresClient) {
    return postgresClient;
  }

  const isProduction =
    process.env.NODE_ENV === "production" || process.env.VERCEL;
  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST;
  const isSupabase = hasSupabaseConfig();

  // PostgreSQL connection configuration
  const connectionConfig = {
    // Connection pool settings - optimized for Supabase or NeonDB
    max: isProduction ? (isSupabase ? 10 : 6) : isSupabase ? 8 : 4,
    idle_timeout: isSupabase ? 20 : 15, // Supabase can handle longer timeouts
    connect_timeout: 10,

    // Keep alive settings
    keep_alive: isSupabase ? 120 : 90, // Supabase benefits from longer keepalive

    // SSL/TLS settings
    ssl: isProduction ? "require" : ("prefer" as any),

    // Performance optimizations
    prepare: !isTest && !isSupabase, // Disable prepared statements for Supabase initially

    // Connection handling
    connection: {
      application_name: isSupabase
        ? "mexc-sniper-bot-supabase"
        : "mexc-sniper-bot-quota-optimized",
      statement_timeout: isSupabase ? 15000 : 12000,
      idle_in_transaction_session_timeout: isSupabase ? 15000 : 10000,
      lock_timeout: isSupabase ? 12000 : 8000,
      tcp_keepalives_idle: 600,
      tcp_keepalives_interval: 30,
      tcp_keepalives_count: 3,
    },

    // Transform for compatibility
    transform: {
      undefined: null,
    },

    // Debug settings (only in development)
    debug:
      process.env.NODE_ENV === "development" &&
      process.env.DATABASE_DEBUG === "true",

    // Connection-level optimizations
    fetch_types: false,
    publications: "none",
  };

  try {
    postgresClient = postgres(process.env.DATABASE_URL, connectionConfig);
    const dbType = isSupabase ? "Supabase" : "NeonDB";
    getLogger().info(
      `[Database] PostgreSQL connection established with ${dbType}`
    );
    return postgresClient;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    getLogger().error(
      `[Database] Failed to create PostgreSQL client:`,
      errorMessage
    );
    throw new Error(`Failed to create PostgreSQL client: ${errorMessage}`);
  }
}

// Create mock database for testing
function createMockDatabase() {
  // Create a proper Promise-like mock that TypeScript recognizes
  const createThenable = (result: any[] = []): Promise<any[]> => {
    const promise = Promise.resolve(result);
    
    // Add Drizzle query builder methods that return new promises
    (promise as any).where = () => createThenable(result);
    (promise as any).orderBy = () => createThenable(result);
    (promise as any).limit = () => createThenable(result);
    (promise as any).select = () => createThenable(result);
    (promise as any).from = () => createThenable(result);
    (promise as any).set = () => createThenable(result);
    (promise as any).values = () => createThenable(result);
    (promise as any).returning = () => createThenable(result);
    (promise as any).groupBy = () => createThenable(result);
    (promise as any).execute = () => promise;
    
    return promise;
  };

  return {
    execute: async () => [{ test_value: 1, count: "1" }],
    query: async () => [],
    insert: () => ({
      values: (data: any) => ({
        returning: () => createThenable([{ id: "mock-id", ...data }]),
      }),
    }),
    select: (columns?: any) => {
      const selectQuery = createThenable([]);
      (selectQuery as any).from = () => createThenable([]);
      return selectQuery;
    },
    update: (table: any) => ({
      set: (data: any) => {
        const updateQuery = createThenable([]);
        (updateQuery as any).where = () => createThenable([]);
        return updateQuery;
      },
    }),
    delete: (table: any) => {
      const deleteQuery = createThenable([]);
      (deleteQuery as any).where = () => createThenable([]);
      return deleteQuery;
    },
    transaction: async (cb: any) => {
      const result = await cb(createMockDatabase());
      return result;
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
  const isProduction =
    process.env.NODE_ENV === "production" || process.env.VERCEL;
  const isRailway = process.env.RAILWAY_ENVIRONMENT === "production";
  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST;

  // In test environment with mock flags, return a mock database
  if (
    isTest &&
    (process.env.FORCE_MOCK_DB === "true" ||
      process.env.USE_MOCK_DATABASE === "true")
  ) {
    getLogger().info("[Database] Using mocked database for tests");
    return createMockDatabase();
  }

  if (!hasNeonConfig() && !hasSupabaseConfig()) {
    throw new Error(
      "Database configuration required: DATABASE_URL must be set with postgresql:// protocol (NeonDB or Supabase)"
    );
  }

  const isSupabase = hasSupabaseConfig();

  // Debug logging (remove in production)
  if (process.env.NODE_ENV !== "production") {
    getLogger().info(
      `[Database] Using ${isSupabase ? "Supabase" : "NeonDB"} PostgreSQL database`
    );
  }

  try {
    const client = createPostgresClient();
    // Use Supabase schema if Supabase is detected, otherwise use original schema
    const schema = isSupabase ? supabaseSchema : originalSchema;
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
          getLogger().info(
            `[Database] ${isSupabase ? "Supabase" : "NeonDB"} connection verified successfully`
          );
        } catch (error) {
          getLogger().error(
            `[Database] ${isSupabase ? "Supabase" : "NeonDB"} connection test failed:`,
            error
          );
        }
      }, 1000);
    }

    return db;
  } catch (error) {
    getLogger().error("[Database] NeonDB initialization error:", error);

    // Enhanced error handling for production
    if (isProduction || isRailway) {
      getLogger().error(
        `[Database] ${isSupabase ? "Supabase" : "NeonDB"} failed in production environment`
      );
      getLogger().error("[Database] Error details:", {
        message: error instanceof Error ? error.message : String(error),
        code:
          error instanceof Error && "code" in error
            ? (error as any).code
            : "UNKNOWN",
        env: {
          hasUrl: !!process.env.DATABASE_URL,
          urlProtocol: process.env.DATABASE_URL?.split("://")[0],
          isVercel: !!process.env.VERCEL,
          nodeEnv: process.env.NODE_ENV,
          isSupabase,
        },
      });
    }

    // In production, we need to fail gracefully
    const errorMessage = error instanceof Error ? error.message : String(error);
    const dbType = isSupabase ? "Supabase" : "NeonDB";
    throw new Error(
      `${dbType} connection failed: ${errorMessage}. Check DATABASE_URL and connection settings.`
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
  _dbInstance = null;
  postgresClient = null;
}

// Lazy database instance with proper typing
let _dbInstance: ReturnType<typeof createDatabase> | null = null;

function ensureDbInstance() {
  if (!_dbInstance) {
    _dbInstance = getDb();
  }
  return _dbInstance;
}

// Export a getter that ensures proper typing
export const db = new Proxy({} as ReturnType<typeof createDatabase>, {
  get(_target, prop: keyof ReturnType<typeof createDatabase>) {
    const instance = ensureDbInstance();
    const value = instance[prop];
    
    // Bind methods to maintain correct context
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    
    return value;
  },
});

// Export schemas for use in other files
export * from "./schemas";
export { supabaseSchema } from "./schemas/supabase-schema";

import { eq } from "drizzle-orm";
import { databaseConnectionPool } from "../lib/database-connection-pool";
// Import optimization tools
import { databaseOptimizationManager } from "../lib/database-optimization-manager";
import { queryPerformanceMonitor } from "../services/query-performance-monitor";
// Import necessary schema elements for user preferences (conditional based on database type)
import { userPreferences as originalUserPreferences } from "./schemas/auth";
import { userPreferences as supabaseUserPreferences } from "./schemas/supabase-auth";

// Database utilities with retry logic
export async function initializeDatabase() {
  return withRetry(
    async () => {
      const isSupabase = hasSupabaseConfig();
      const dbType = isSupabase ? "Supabase" : "NeonDB";
      getLogger().info(`[Database] Initializing ${dbType} database...`);

      // Test connection with a simple query
      const result = await db.execute(sql`SELECT 1`);
      if (result) {
        getLogger().info(`[Database] ${dbType} connection successful`);
      }

      // Check available PostgreSQL extensions
      try {
        // Check for vector extension (pgvector)
        await db.execute(
          sql`SELECT 1 FROM pg_available_extensions WHERE name = 'vector'`
        );
        getLogger().info(
          "[Database] Vector extension (pgvector) available for embeddings"
        );
      } catch (_error) {
        getLogger().info(
          "[Database] Vector extension not available, AI features may be limited"
        );
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
            getLogger().warn(
              "[Database] Failed to auto-optimize for agents:",
              error
            );
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
  return _internalHealthCheck();
}

// Internal health check implementation
export async function _internalHealthCheck() {
  try {
    const startTime = Date.now();
    await db.execute(sql`SELECT 1`);
    const responseTime = Date.now() - startTime;

    const isSupabase = hasSupabaseConfig();
    const isHealthy = responseTime < 2000; // Less than 2 seconds is healthy
    const status = isHealthy
      ? "healthy"
      : responseTime < 5000
        ? "degraded"
        : "critical";

    return {
      status,
      responseTime,
      database: isSupabase ? "supabase" : "neondb",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const isSupabase = hasSupabaseConfig();
    return {
      status: "offline",
      error: error instanceof Error ? error.message : "Unknown error",
      database: isSupabase ? "supabase" : "neondb",
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
  return databaseConnectionPool.executeSelect(
    queryFn,
    cacheKey || "default",
    cacheTTL
  );
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
    // Use appropriate userPreferences table based on database type
    const isSupabase = hasSupabaseConfig();
    const userPreferencesTable = isSupabase
      ? supabaseUserPreferences
      : originalUserPreferences;

    const result = (await executeWithRetry(
      async () =>
        db
          .select()
          .from(userPreferencesTable)
          .where(eq(userPreferencesTable.userId, userId))
          .limit(1),
      "getUserPreferences"
    )) as any[];

    if (result.length === 0) {
      return null;
    }

    const prefs = result[0];

    // Safe pattern parsing with fallbacks
    let patternParts: number[] = [2, 2, 4]; // Default fallback
    try {
      if (
        prefs.readyStatePattern &&
        typeof prefs.readyStatePattern === "string"
      ) {
        const parts = prefs.readyStatePattern.split(",").map(Number);
        if (
          parts.length >= 3 &&
          parts.every((p: number) => !Number.isNaN(p) && p > 0)
        ) {
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
    const safeJsonParse = (
      jsonString: string | null | undefined,
      fallback: any = undefined
    ) => {
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
      getLogger().warn(
        "[Database] Error stopping performance monitoring:",
        error
      );
    }

    // Shutdown connection pool
    try {
      await databaseConnectionPool.shutdown();
    } catch (error) {
      getLogger().warn(
        "[Database] Error shutting down connection pool:",
        error
      );
    }

    // Close PostgreSQL connection if exists
    if (postgresClient) {
      try {
        await Promise.race([
          postgresClient.end({ timeout: 2 }), // Reduced timeout for tests
          new Promise(
            (resolve) =>
              setTimeout(() => {
                getLogger().warn(
                  "[Database] PostgreSQL close timed out, forcing shutdown"
                );
                resolve(undefined);
              }, 2000) // Reduced timeout for tests
          ),
        ]);
        const dbType = hasSupabaseConfig() ? "Supabase" : "NeonDB";
        getLogger().info(`[Database] ${dbType} PostgreSQL connection closed`);
      } catch (error) {
        getLogger().warn(
          "[Database] Error closing PostgreSQL connection:",
          error
        );
      }
    }

    // Emergency cleanup for mock databases
    if (
      dbInstance &&
      typeof (dbInstance as any).$emergencyCleanup === "function"
    ) {
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
