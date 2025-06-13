import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzleTurso } from "drizzle-orm/libsql";
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

// Turso client cache for connection pooling
let tursoClient: ReturnType<typeof createClient> | null = null;

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

// Create Turso client with best practices
function createTursoClient() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error("Turso configuration missing");
  }

  // Return cached client if available
  if (tursoClient) {
    return tursoClient;
  }

  const isRailway = process.env.RAILWAY_ENVIRONMENT === "production";
  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL || isRailway;

  // Configure client based on environment
  const clientConfig: Parameters<typeof createClient>[0] = {
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  };

  // Add embedded replica support for Railway and other edge environments
  if (isProduction) {
    // Enable sync interval for embedded replicas
    clientConfig.syncInterval = 60; // Sync every 60 seconds
    
    // Use embedded replica URL if available (for Railway)
    if (process.env.TURSO_REPLICA_URL) {
      clientConfig.syncUrl = process.env.TURSO_DATABASE_URL;
      clientConfig.url = process.env.TURSO_REPLICA_URL;
      console.log("[Database] Using embedded replica for improved performance");
    }
  }

  // Create and cache the client
  tursoClient = createClient(clientConfig);
  
  return tursoClient;
}

// Environment-specific database configuration
function createDatabase() {
  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL;
  const isRailway = process.env.RAILWAY_ENVIRONMENT === "production";
  const hasTursoConfig = process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN;
  const forceSQLite = process.env.FORCE_SQLITE === "true";

  // Use SQLite if forced or if TursoDB is not properly configured
  if (forceSQLite || (!isProduction && !isRailway && !hasTursoConfig)) {
    console.log("[Database] Using SQLite for development");
    try {
      const Database = require("better-sqlite3");
      const sqlite = new Database("./mexc_sniper.db");
      sqlite.pragma("journal_mode = WAL");
      sqlite.pragma("foreign_keys = ON");
      sqlite.pragma("busy_timeout = 5000"); // 5 second timeout
      sqlite.pragma("synchronous = NORMAL"); // Better performance
      sqlite.pragma("cache_size = -64000"); // 64MB cache
      sqlite.pragma("temp_store = MEMORY"); // Use memory for temp tables
      return drizzle(sqlite, { schema });
    } catch (error) {
      console.error("[Database] SQLite initialization error:", error);
      throw error;
    }
  }

  // Only use TursoDB if we have valid configuration
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
    console.log("[Database] Using TursoDB with retry logic and connection pooling");
    try {
      const client = createTursoClient();
      return drizzleTurso(client, { schema });
    } catch (error) {
      console.error("[Database] TursoDB initialization error:", error);
      
      // Fallback to SQLite if TursoDB fails and we're not in production
      if (!isProduction && !isRailway) {
        console.log("[Database] Falling back to SQLite due to TursoDB error");
        const Database = require("better-sqlite3");
        const sqlite = new Database("./mexc_sniper.db");
        sqlite.pragma("journal_mode = WAL");
        sqlite.pragma("foreign_keys = ON");
        sqlite.pragma("busy_timeout = 5000");
        sqlite.pragma("synchronous = NORMAL");
        sqlite.pragma("cache_size = -64000");
        sqlite.pragma("temp_store = MEMORY");
        return drizzle(sqlite, { schema });
      }
      
      // In production, throw the error
      throw error;
    }
  }

  // Default to SQLite if no configuration is available
  console.log("[Database] Using SQLite (default)");
  const Database = require("better-sqlite3");
  const sqlite = new Database("./mexc_sniper.db");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("cache_size = -64000");
  sqlite.pragma("temp_store = MEMORY");
  return drizzle(sqlite, { schema });
}

// Create database instance with retry logic
let dbInstance: ReturnType<typeof createDatabase> | null = null;

export function getDb() {
  if (!dbInstance) {
    dbInstance = createDatabase();
  }
  return dbInstance;
}

export const db = getDb();

// Export schema for use in other files
export * from "./schema";

// Database utilities with retry logic
export async function initializeDatabase() {
  return withRetry(
    async () => {
      console.log("[Database] Initializing database...");

      // Test connection with a simple query
      const result = await db.run(sql`SELECT 1`);
      if (result) {
        console.log("[Database] Database connection successful");
      }

      // For Turso, enable vector extension if available
      if (process.env.TURSO_DATABASE_URL) {
        try {
          await db.run(sql`SELECT load_extension('vector')`);
          console.log("[Database] Vector extension loaded successfully");
        } catch (error) {
          // Vector extension might not be available, continue without it
          console.log("[Database] Vector extension not available, continuing without it");
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
  operationName: string = "Database query"
): Promise<T> {
  return withRetry(query, operationName);
}

// Health check with detailed status
export async function healthCheck() {
  try {
    const startTime = Date.now();
    await db.run(sql`SELECT 1`);
    const responseTime = Date.now() - startTime;

    const isHealthy = responseTime < 1000; // Less than 1 second is healthy
    const status = isHealthy ? "healthy" : responseTime < 5000 ? "degraded" : "critical";

    return {
      status,
      responseTime,
      database: process.env.TURSO_DATABASE_URL ? "turso" : "sqlite",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "offline",
      error: error instanceof Error ? error.message : "Unknown error",
      database: process.env.TURSO_DATABASE_URL ? "turso" : "sqlite",
      timestamp: new Date().toISOString(),
    };
  }
}

export function closeDatabase() {
  try {
    console.log("[Database] Database connection closed");
    // Reset cached instances
    dbInstance = null;
    tursoClient = null;
    // Note: TursoDB connections are automatically managed
    // SQLite connections would be closed here in development
  } catch (error) {
    console.error("[Database] Error closing database:", error);
  }
}
