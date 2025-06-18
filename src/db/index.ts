import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
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

// Retry logic wrapper
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
      console.warn(
        `[Database] ${operationName} failed (attempt ${i + 1}/${retries}), retrying in ${delay}ms...`,
        error
      );

      // Don't retry on the last attempt
      if (i < retries - 1) {
        await sleep(delay);
      }
    }
  }

  console.error(`[Database] ${operationName} failed after ${retries} attempts`, lastError);
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
    max: isProduction ? 20 : 5, // Max connections
    idle_timeout: 20, // 20 seconds idle timeout
    connect_timeout: 30, // 30 seconds connect timeout

    // SSL/TLS settings for NeonDB
    ssl: isProduction ? "require" : "prefer" as any,

    // Performance optimizations
    prepare: !isTest, // Prepared statements (disabled in tests for compatibility)

    // Connection handling
    connection: {
      application_name: "mexc-sniper-bot",
      statement_timeout: 30000, // 30 seconds
      idle_in_transaction_session_timeout: 30000, // 30 seconds
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
    console.log(`[Database] PostgreSQL connection established with NeonDB`);
    return postgresClient;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Database] Failed to create PostgreSQL client:`, errorMessage);
    throw new Error(`Failed to create PostgreSQL client: ${errorMessage}`);
  }
}

// PostgreSQL-only database configuration for NeonDB
function createDatabase() {
  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL;
  const isRailway = process.env.RAILWAY_ENVIRONMENT === "production";
  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST;

  if (!hasNeonConfig()) {
    throw new Error(
      "NeonDB configuration required: DATABASE_URL must be set with postgresql:// protocol"
    );
  }

  // Debug logging (remove in production)
  if (process.env.NODE_ENV !== "production") {
    console.log("[Database] Using NeonDB PostgreSQL database");
  }

  try {
    const client = createPostgresClient();
    const db = drizzle(client, { schema });

    // Test connection immediately to catch auth issues early
    if (isProduction || isRailway) {
      console.log("[Database] Testing NeonDB connection in production...");
    }

    // Initialize PostgreSQL extensions if needed
    if (!isTest) {
      setTimeout(async () => {
        try {
          // Test basic connectivity
          await db.execute(sql`SELECT 1 as test`);
          console.log("[Database] NeonDB connection verified successfully");
        } catch (error) {
          console.error("[Database] NeonDB connection test failed:", error);
        }
      }, 1000);
    }

    return db;
  } catch (error) {
    console.error("[Database] NeonDB initialization error:", error);

    // Enhanced error handling for production
    if (isProduction || isRailway) {
      console.error("[Database] NeonDB failed in production environment");
      console.error("[Database] Error details:", {
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

import { databaseConnectionPool } from "../lib/database-connection-pool";
// Import optimization tools
import { databaseOptimizationManager } from "../lib/database-optimization-manager";
import { queryPerformanceMonitor } from "../services/query-performance-monitor";

// Database utilities with retry logic
export async function initializeDatabase() {
  return withRetry(
    async () => {
      console.log("[Database] Initializing NeonDB database...");

      // Test connection with a simple query
      const result = await db.execute(sql`SELECT 1`);
      if (result) {
        console.log("[Database] NeonDB connection successful");
      }

      // Check available PostgreSQL extensions
      try {
        // Check for vector extension (pgvector)
        await db.execute(sql`SELECT 1 FROM pg_available_extensions WHERE name = 'vector'`);
        console.log("[Database] Vector extension (pgvector) available for embeddings");
      } catch (_error) {
        console.log("[Database] Vector extension not available, AI features may be limited");
      }

      // Initialize performance monitoring
      if (process.env.NODE_ENV !== "test") {
        queryPerformanceMonitor.startMonitoring();
        console.log("[Database] Performance monitoring started");

        // Auto-optimize for agent workloads in production
        if (process.env.NODE_ENV === "production") {
          try {
            await databaseOptimizationManager.optimizeForAgentWorkloads();
            console.log("[Database] Optimized for AI agent workloads");
          } catch (error) {
            console.warn("[Database] Failed to auto-optimize for agents:", error);
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
  try {
    const startTime = Date.now();
    await db.execute(sql`SELECT 1`);
    const responseTime = Date.now() - startTime;

    const isHealthy = responseTime < 1000; // Less than 1 second is healthy
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
  return databaseConnectionPool.executeSelect(queryFn, cacheKey, cacheTTL);
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

// Performance monitoring wrapper
export async function monitoredQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  options?: {
    query?: string;
    parameters?: unknown[];
    userId?: string;
  }
): Promise<T> {
  return queryPerformanceMonitor.wrapQuery(queryName, queryFn, options);
}

export function closeDatabase() {
  try {
    console.log("[Database] Database connection closed");

    // Stop performance monitoring
    queryPerformanceMonitor.stopMonitoring();

    // Shutdown connection pool
    databaseConnectionPool.shutdown();

    // Close PostgreSQL connection if exists
    if (postgresClient) {
      postgresClient.end({ timeout: 5000 }); // 5 second timeout
      console.log("[Database] NeonDB PostgreSQL connection closed");
    }

    // Reset cached instances
    dbInstance = null;
    postgresClient = null;
  } catch (error) {
    console.error("[Database] Error closing database:", error);
  }
}
