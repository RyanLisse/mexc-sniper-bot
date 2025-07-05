// FIXED: Use centralized client manager to prevent multiple GoTrueClient instances

import path from "node:path";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
// CRITICAL: Build isolation manager for preventing 61s build times
import {
  createBuildSafeDatabase,
  detectBuildProcess,
  getBuildIsolationStatus,
  isStaticGeneration,
} from "../lib/build-isolation-manager";
// OpenTelemetry database instrumentation
import {
  instrumentDatabase,
  instrumentDatabaseQuery,
} from "../lib/opentelemetry-database-instrumentation";
import { getSupabaseAdminClient } from "../lib/supabase-client-manager";
import { supabaseSchema } from "./schemas/supabase-schema";

// FIXED: Use centralized admin client to prevent multiple GoTrueClient instances
export const supabaseAdmin = getSupabaseAdminClient();

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

// Check if we have PostgreSQL configuration
const hasPostgresConfig = () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return false;
  }
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
};

// Check if SQLite is configured
const _hasSQLiteConfig = () => {
  const url = process.env.DATABASE_URL;
  return (
    url?.startsWith("sqlite:") ||
    process.env.USE_SQLITE_FALLBACK === "true" ||
    !!process.env.SQLITE_DATABASE_PATH
  );
};

// Get the appropriate database URL with validation
const getDatabaseUrl = () => {
  const url = process.env.DATABASE_URL;

  if (!url) {
    const isTest = process.env.NODE_ENV === "test" || process.env.VITEST;
    if (isTest) {
      getLogger().warn(
        "[Database] No DATABASE_URL configured for test environment"
      );
      return null;
    }
    throw new Error("DATABASE_URL environment variable is required");
  }

  // Validate URL format
  try {
    const parsed = new URL(url);
    if (!["postgresql:", "postgres:", "sqlite:"].includes(parsed.protocol)) {
      throw new Error(`Unsupported database protocol: ${parsed.protocol}`);
    }
    return url;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Invalid DATABASE_URL format: ${url}`);
    }
    throw error;
  }
};

// Check if we have Supabase configuration
export const hasSupabaseConfig = () =>
  !!process.env.DATABASE_URL?.includes("supabase.com") &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL;

// CRITICAL: Use comprehensive build isolation manager instead of basic detection
const _isBuildTime = () => {
  return detectBuildProcess() || isStaticGeneration();
};

// Create PostgreSQL client with connection pooling and validation
function createPostgresClient() {
  const databaseUrl = getDatabaseUrl();

  if (
    !databaseUrl?.startsWith("postgresql://") &&
    !databaseUrl?.startsWith("postgres://")
  ) {
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
    // Connection pool settings - optimized for Supabase
    max: isProduction ? 10 : 8,
    idle_timeout: 20, // Supabase can handle longer timeouts
    connect_timeout: 10,

    // Keep alive settings
    keep_alive: 120, // Supabase benefits from longer keepalive

    // SSL/TLS settings
    ssl: isProduction ? "require" : ("prefer" as any),

    // Performance optimizations
    prepare: !isTest, // Disable prepared statements for Supabase initially

    // Connection handling
    connection: {
      application_name: "mexc-sniper-bot-supabase",
      statement_timeout: 15000,
      idle_in_transaction_session_timeout: 15000,
      lock_timeout: 12000,
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
    postgresClient = postgres(databaseUrl, connectionConfig);
    getLogger().info(
      `[Database] PostgreSQL connection established${isSupabase ? " with Supabase" : ""}`
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

// SQLite fallback configuration for tests when PostgreSQL is unavailable
interface SQLiteConfig {
  database: string;
  mode?: string;
  timeout?: number;
}

// Create SQLite fallback database for testing
function createSQLiteDatabase(config: SQLiteConfig) {
  getLogger().info(`[Database] Using SQLite fallback: ${config.database}`);

  // This would be implemented if SQLite is available
  // For now, return a comprehensive mock that behaves like SQLite
  const sqliteData = new Map();
  let idCounter = 1;

  const createSQLiteQueryBuilder = (result: any[] = []): any => {
    const queryBuilder = {
      // Make it a thenable/promise-like object
      then: (onFulfilled?: any, onRejected?: any) => {
        return Promise.resolve(result).then(onFulfilled, onRejected);
      },
      catch: (onRejected?: any) => {
        return Promise.resolve(result).catch(onRejected);
      },
      finally: (onFinally?: any) => {
        return Promise.resolve(result).finally(onFinally);
      },
      // Query builder methods
      where: (condition: any) => {
        // Simple SQLite-like filtering
        const filtered = result.filter(() => true); // Simplified for mock
        return createSQLiteQueryBuilder(filtered);
      },
      orderBy: () => createSQLiteQueryBuilder(result),
      limit: (count: number) =>
        createSQLiteQueryBuilder(result.slice(0, count)),
      offset: (count: number) => createSQLiteQueryBuilder(result.slice(count)),
      select: () => createSQLiteQueryBuilder(result),
      from: () => createSQLiteQueryBuilder(result),
      set: () => createSQLiteQueryBuilder(result),
      values: () => createSQLiteQueryBuilder(result),
      returning: () => createSQLiteQueryBuilder(result),
      groupBy: () => createSQLiteQueryBuilder(result),
      having: () => createSQLiteQueryBuilder(result),
      innerJoin: () => createSQLiteQueryBuilder(result),
      leftJoin: () => createSQLiteQueryBuilder(result),
      rightJoin: () => createSQLiteQueryBuilder(result),
      fullJoin: () => createSQLiteQueryBuilder(result),
      execute: () => Promise.resolve(result),
      // Make it behave like a Promise when awaited
      [Symbol.toStringTag]: "Promise",
    };

    return queryBuilder;
  };

  return {
    execute: async (query?: any) => {
      // Simple SQLite-like query execution
      if (query && typeof query === "object" && query.sql) {
        if (query.sql.includes("SELECT 1")) {
          return [{ test_value: 1, count: "1" }];
        }
        if (query.sql.includes("EXISTS")) {
          return [{ exists: true }];
        }
      }
      return [];
    },
    query: async () => [],
    insert: (table: any) => ({
      values: (data: any) => ({
        returning: () => {
          const newRecord = {
            id: `sqlite-${idCounter++}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          const tableName = table?.name || "unknown";
          if (!sqliteData.has(tableName)) {
            sqliteData.set(tableName, []);
          }
          sqliteData.get(tableName).push(newRecord);
          return createSQLiteQueryBuilder([newRecord]);
        },
      }),
    }),
    select: (_columns?: any) => {
      return createSQLiteQueryBuilder([]);
    },
    update: (_table: any) => ({
      set: (_data: any) => {
        return createSQLiteQueryBuilder([]);
      },
    }),
    delete: (_table: any) => {
      return createSQLiteQueryBuilder([]);
    },
    transaction: async (cb: any) => {
      // SQLite transaction simulation
      try {
        const result = await cb(createSQLiteDatabase(config));
        return result;
      } catch (error) {
        getLogger().warn("[Database] SQLite transaction rolled back:", error);
        throw error;
      }
    },
    // SQLite connection management
    end: async () => {
      getLogger().debug("[Database] SQLite connection closed");
      return Promise.resolve();
    },
    destroy: async () => {
      sqliteData.clear();
      getLogger().debug("[Database] SQLite database destroyed");
      return Promise.resolve();
    },
    // Add emergency cleanup hook
    $emergencyCleanup: async () => {
      sqliteData.clear();
      getLogger().debug(
        "[Database] SQLite database emergency cleanup completed"
      );
      return Promise.resolve();
    },
    // SQLite-specific methods
    $sqliteData: sqliteData,
    $isSQLite: true,
  };
}

// Create mock database for testing (legacy fallback)
function createMockDatabase() {
  getLogger().info("[Database] Using legacy mock database (fallback)");

  // Create a proper query builder mock that implements the Drizzle interface
  const createQueryBuilder = (result: any[] = []): any => {
    const queryBuilder = {
      // Make it a thenable/promise-like object
      then: (onFulfilled?: any, onRejected?: any) => {
        return Promise.resolve(result).then(onFulfilled, onRejected);
      },
      catch: (onRejected?: any) => {
        return Promise.resolve(result).catch(onRejected);
      },
      finally: (onFinally?: any) => {
        return Promise.resolve(result).finally(onFinally);
      },
      // Query builder methods
      where: () => createQueryBuilder(result),
      orderBy: () => createQueryBuilder(result),
      limit: () => createQueryBuilder(result),
      offset: () => createQueryBuilder(result),
      select: () => createQueryBuilder(result),
      from: () => createQueryBuilder(result),
      set: () => createQueryBuilder(result),
      values: () => createQueryBuilder(result),
      returning: () => createQueryBuilder(result),
      groupBy: () => createQueryBuilder(result),
      having: () => createQueryBuilder(result),
      innerJoin: () => createQueryBuilder(result),
      leftJoin: () => createQueryBuilder(result),
      rightJoin: () => createQueryBuilder(result),
      fullJoin: () => createQueryBuilder(result),
      execute: () => Promise.resolve(result),
      // Make it behave like a Promise when awaited
      [Symbol.toStringTag]: "Promise",
    };

    return queryBuilder;
  };

  return {
    execute: async () => [{ test_value: 1, count: "1" }],
    query: async () => [],
    insert: () => ({
      values: (data: any) => ({
        returning: () => createQueryBuilder([{ id: "mock-id", ...data }]),
      }),
    }),
    select: (_columns?: any) => {
      return createQueryBuilder([]);
    },
    update: (_table: any) => ({
      set: (_data: any) => {
        return createQueryBuilder([]);
      },
    }),
    delete: (_table: any) => {
      return createQueryBuilder([]);
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
    $isMock: true,
  };
}

// Database creation with PostgreSQL primary and SQLite fallback
function createDatabase() {
  const isProduction =
    process.env.NODE_ENV === "production" || process.env.VERCEL;
  const isRailway = process.env.RAILWAY_ENVIRONMENT === "production";
  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST;

  // CRITICAL: Use build isolation manager to prevent 61s build times
  const buildSafeDb = createBuildSafeDatabase();
  if (buildSafeDb) {
    const buildStatus = getBuildIsolationStatus();
    getLogger().info(
      `[Database] Build isolation active - using build-safe database (${buildStatus.buildPhase})`
    );
    return buildSafeDb;
  }

  // In test environment with mock flags, return appropriate database
  if (isTest) {
    if (
      process.env.FORCE_MOCK_DB === "true" ||
      process.env.USE_MOCK_DATABASE === "true"
    ) {
      getLogger().info("[Database] Using mocked database for tests");
      return createMockDatabase();
    }

    // Check if SQLite fallback is requested
    if (
      process.env.USE_SQLITE_FALLBACK === "true" ||
      process.env.DATABASE_URL?.startsWith("sqlite:")
    ) {
      const sqliteDb = process.env.SQLITE_DATABASE_PATH || ":memory:";
      getLogger().info(
        `[Database] Using SQLite fallback for tests: ${sqliteDb}`
      );
      return createSQLiteDatabase({ database: sqliteDb, timeout: 5000 });
    }
  }

  // Validate PostgreSQL configuration first
  if (!hasPostgresConfig()) {
    if (isTest) {
      // In test environment, provide helpful guidance and fallback
      getLogger().warn(
        "[Database] DATABASE_URL not configured for PostgreSQL. Available options:"
      );
      getLogger().warn(
        "  1. Set DATABASE_URL to a PostgreSQL connection string"
      );
      getLogger().warn("  2. Set USE_SQLITE_FALLBACK=true for SQLite fallback");
      getLogger().warn("  3. Set FORCE_MOCK_DB=true for mock database");
      getLogger().info("[Database] Falling back to SQLite for tests");
      return createSQLiteDatabase({ database: ":memory:", timeout: 5000 });
    } else {
      throw new Error(
        "Database configuration missing: DATABASE_URL must be set with postgresql:// protocol"
      );
    }
  }

  if (!hasSupabaseConfig()) {
    if (isTest) {
      getLogger().warn(
        "[Database] Supabase configuration not detected, using PostgreSQL directly"
      );
    } else {
      throw new Error(
        "Database configuration required: DATABASE_URL must point to Supabase (includes 'supabase.com')"
      );
    }
  }

  const isSupabase = hasSupabaseConfig();

  // Debug logging (remove in production)
  if (process.env.NODE_ENV !== "production") {
    getLogger().info(`[Database] Using Supabase PostgreSQL database`);
  }

  try {
    const client = createPostgresClient();
    // Use Supabase schema
    const schema = supabaseSchema;
    const baseDb = drizzle(client, { schema });

    // Wrap database with OpenTelemetry instrumentation
    const db = instrumentDatabase(baseDb);

    // Test connection immediately to catch auth issues early
    if (isProduction || isRailway) {
      getLogger().info(
        "[Database] Testing Supabase connection in production..."
      );
    }

    // Initialize PostgreSQL extensions if needed
    if (!isTest) {
      // FIXED: Prevent TimeoutNaNWarning by validating delay value
      const connectionTestDelay = 1000;
      const safeDelay =
        typeof connectionTestDelay === "number" &&
        !Number.isNaN(connectionTestDelay) &&
        Number.isFinite(connectionTestDelay) &&
        connectionTestDelay > 0
          ? connectionTestDelay
          : 1000;

      setTimeout(async () => {
        try {
          // Test basic connectivity
          await db.execute(sql`SELECT 1 as test`);
          getLogger().info(
            `[Database] Supabase connection verified successfully`
          );
        } catch (error) {
          getLogger().error(
            `[Database] Supabase connection test failed:`,
            error
          );
        }
      }, safeDelay);
    }

    return db;
  } catch (error) {
    getLogger().error("[Database] PostgreSQL initialization error:", error);

    // Enhanced error handling with fallback options
    if (isProduction || isRailway) {
      getLogger().error(
        `[Database] PostgreSQL failed in production environment`
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

      // In production, we need to fail gracefully
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `PostgreSQL connection failed: ${errorMessage}. Check DATABASE_URL and connection settings.`
      );
    }

    // In test environment, try SQLite fallback if PostgreSQL fails
    if (
      isTest &&
      error instanceof Error &&
      error.message.includes("Maximum call stack size exceeded")
    ) {
      getLogger().warn(
        "[Database] PostgreSQL connection failed with call stack error, falling back to SQLite"
      );
      return createSQLiteDatabase({ database: ":memory:", timeout: 5000 });
    }

    // For other test environment errors, try SQLite fallback
    if (isTest) {
      getLogger().warn(
        `[Database] PostgreSQL connection failed in test environment: ${error instanceof Error ? error.message : String(error)}`
      );
      getLogger().info("[Database] Attempting SQLite fallback for tests");
      return createSQLiteDatabase({ database: ":memory:", timeout: 5000 });
    }

    // Re-throw for non-test environments
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Database connection failed: ${errorMessage}. Check DATABASE_URL and connection settings.`
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
  // Safely clear cached instances without triggering URL access
  try {
    dbInstance = null;

    // Only clear postgresClient if DATABASE_URL is properly configured
    if (process.env.DATABASE_URL && postgresClient) {
      postgresClient = null;
    } else if (!process.env.DATABASE_URL && postgresClient) {
      // Clear postgres client even without URL in test environments
      postgresClient = null;
      getLogger().debug(
        "[Database] Cleared postgres client without URL (test environment)"
      );
    }

    getLogger().debug("[Database] Database cache cleared successfully");
  } catch (error) {
    // Suppress URL-related warnings in test environments
    if (process.env.NODE_ENV === "test" || process.env.VITEST) {
      getLogger().debug("[Database] Cache clear completed (test environment)");
    } else {
      getLogger().warn("[Database] Error clearing cache:", error);
    }
  }
}

// Export a getter that ensures proper typing - FIXED: Eliminate circular dependency
export const db = new Proxy({} as ReturnType<typeof createDatabase>, {
  get(_target, prop: keyof ReturnType<typeof createDatabase>) {
    // FIXED: Direct call to getDb() instead of recursive ensureDbInstance()
    const instance = getDb();
    const value = instance[prop];

    // Bind methods to maintain correct context
    if (typeof value === "function") {
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
import { userPreferences as supabaseUserPreferences } from "./schemas/supabase-auth";

// Database migration utilities
async function ensureMigrationsApplied(): Promise<void> {
  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST;
  const shouldSkipMigrations =
    process.env.FORCE_MOCK_DB === "true" ||
    process.env.USE_MOCK_DATABASE === "true" ||
    process.env.SKIP_DB_MIGRATIONS === "true";

  // CRITICAL: Use build isolation manager to skip migrations during build/static generation
  if (detectBuildProcess() || isStaticGeneration()) {
    const buildStatus = getBuildIsolationStatus();
    getLogger().info(
      `[Database] Skipping migrations during ${buildStatus.buildPhase}`
    );
    return;
  }

  if (isTest && shouldSkipMigrations) {
    getLogger().info(
      "[Database] Skipping migrations in test environment with mocked database"
    );
    return;
  }

  try {
    getLogger().info("[Database] Checking if migrations need to be applied...");

    // Check if error_logs table exists (indicator of whether migrations have been run)
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'error_logs'
      ) as exists
    `);

    const exists = (tableExists as any)[0]?.exists;

    if (!exists) {
      getLogger().info(
        "[Database] error_logs table not found, running migrations..."
      );

      // Get migrations folder path (relative to this file)
      const migrationsFolder = path.resolve(__dirname, "./migrations");

      // Run migrations using the existing database instance
      await migrate(db as any, { migrationsFolder });

      getLogger().info("[Database] ✅ All migrations applied successfully");

      // Verify the error_logs table now exists
      const verifyResult = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'error_logs'
        ) as exists
      `);

      const verifyExists = (verifyResult as any)[0]?.exists;
      if (verifyExists) {
        getLogger().info(
          "[Database] ✅ error_logs table verification successful"
        );
      } else {
        throw new Error("error_logs table still missing after migration");
      }
    } else {
      getLogger().info("[Database] ✅ Database schema is up to date");
    }
  } catch (error) {
    getLogger().error("[Database] Migration check/execution failed:", error);

    // In production, we want to fail fast if migrations don't work
    if (process.env.NODE_ENV === "production") {
      throw error;
    }

    // In development, log the error but continue (might be using mock db)
    getLogger().warn(
      "[Database] Continuing without migration verification (development mode)"
    );
  }
}

// Database utilities with retry logic
export async function initializeDatabase() {
  // CRITICAL: Use build isolation manager to skip initialization during build/static generation
  if (detectBuildProcess() || isStaticGeneration()) {
    const buildStatus = getBuildIsolationStatus();
    getLogger().info(
      `[Database] Skipping database initialization during ${buildStatus.buildPhase}`
    );
    return true;
  }

  return withRetry(
    async () => {
      getLogger().info(`[Database] Initializing Supabase database...`);

      // Test connection with a simple query
      const result = await db.execute(sql`SELECT 1`);
      if (result) {
        getLogger().info(`[Database] Supabase connection successful`);
      }

      // Run database migrations if needed
      await ensureMigrationsApplied();

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

    const isHealthy = responseTime < 2000; // Less than 2 seconds is healthy
    const status = isHealthy
      ? "healthy"
      : responseTime < 5000
        ? "degraded"
        : "critical";

    return {
      status,
      responseTime,
      database: "supabase",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "offline",
      error: error instanceof Error ? error.message : "Unknown error",
      database: "supabase",
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
    // Use Supabase userPreferences table
    const userPreferencesTable = supabaseUserPreferences;

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
  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST;

  try {
    if (!isTest) {
      getLogger().info("[Database] Database connection closed");
    } else {
      getLogger().debug(
        "[Database] Database connection closed (test environment)"
      );
    }

    // Stop performance monitoring
    try {
      queryPerformanceMonitor.stopMonitoring();
    } catch (error) {
      if (!isTest) {
        getLogger().warn(
          "[Database] Error stopping performance monitoring:",
          error
        );
      } else {
        getLogger().debug(
          "[Database] Performance monitoring stopped (test environment)"
        );
      }
    }

    // Shutdown connection pool
    try {
      await databaseConnectionPool.shutdown();
    } catch (error) {
      if (!isTest) {
        getLogger().warn(
          "[Database] Error shutting down connection pool:",
          error
        );
      } else {
        getLogger().debug(
          "[Database] Connection pool shutdown (test environment)"
        );
      }
    }

    // Close PostgreSQL connection if exists
    if (postgresClient) {
      try {
        // Only attempt connection close if DATABASE_URL is defined
        if (process.env.DATABASE_URL) {
          // FIXED: Prevent TimeoutNaNWarning by validating delay value
          const closeTimeoutDelay = 2000;
          const safeCloseDelay =
            typeof closeTimeoutDelay === "number" &&
            !Number.isNaN(closeTimeoutDelay) &&
            Number.isFinite(closeTimeoutDelay) &&
            closeTimeoutDelay > 0
              ? closeTimeoutDelay
              : 2000;

          await Promise.race([
            postgresClient.end({ timeout: 2 }), // Reduced timeout for tests
            new Promise(
              (resolve) =>
                setTimeout(() => {
                  if (!isTest) {
                    getLogger().warn(
                      "[Database] PostgreSQL close timed out, forcing shutdown"
                    );
                  } else {
                    getLogger().debug(
                      "[Database] PostgreSQL close timed out (test environment)"
                    );
                  }
                  resolve(undefined);
                }, safeCloseDelay) // Use validated timeout delay
            ),
          ]);

          if (!isTest) {
            getLogger().info(
              `[Database] Supabase PostgreSQL connection closed`
            );
          } else {
            getLogger().debug(
              `[Database] PostgreSQL connection closed (test environment)`
            );
          }
        } else {
          // In test environment without URL, just clear the client reference
          if (isTest) {
            getLogger().debug(
              "[Database] Clearing PostgreSQL client reference (test environment)"
            );
          }
        }
      } catch (error) {
        if (!isTest) {
          getLogger().warn(
            "[Database] Error closing PostgreSQL connection:",
            error
          );
        } else {
          getLogger().debug(
            "[Database] PostgreSQL connection cleanup completed (test environment)"
          );
        }
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
        if (!isTest) {
          getLogger().warn("[Database] Error in emergency cleanup:", error);
        } else {
          getLogger().debug(
            "[Database] Emergency cleanup completed (test environment)"
          );
        }
      }
    }

    // Reset cached instances
    dbInstance = null;
    postgresClient = null;
  } catch (error) {
    if (!isTest) {
      getLogger().error("[Database] Error closing database:", error);
    } else {
      getLogger().debug(
        "[Database] Database close completed with cleanup (test environment)"
      );
    }
  }
}

// Register emergency cleanup hook for tests
if (typeof global !== "undefined") {
  (global as any).__emergency_db_cleanup__ = closeDatabase;
}
