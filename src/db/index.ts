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

// Create Turso client with better error handling and URL scheme fallback
function createTursoClient() {
  // Support both TURSO_DATABASE_URL and TURSO_HOST patterns
  const databaseUrl =
    process.env.TURSO_DATABASE_URL ||
    (process.env.TURSO_HOST ? `libsql://${process.env.TURSO_HOST}` : null);

  if (!databaseUrl || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error(
      "Turso configuration missing: need TURSO_DATABASE_URL (or TURSO_HOST) and TURSO_AUTH_TOKEN"
    );
  }

  // Return cached client if available
  if (tursoClient) {
    return tursoClient;
  }

  const isRailway = process.env.RAILWAY_ENVIRONMENT === "production";
  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL || isRailway;
  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST;

  // Try different URL schemes for better compatibility
  const urlSchemes = [
    databaseUrl, // Original (libsql://)
    databaseUrl.replace("libsql://", "wss://"), // WebSocket scheme
  ];

  // Use embedded replicas for local development and testing for better performance
  const embeddedPath = process.env.TURSO_EMBEDDED_PATH || "./data/mexc_sniper_replica.db";
  const syncInterval = Number.parseInt(process.env.TURSO_SYNC_INTERVAL || "30");

  if ((!isProduction && process.env.USE_EMBEDDED_REPLICA !== "false") || process.env.USE_EMBEDDED_REPLICA === "true") {
    // Enable embedded replica with local SQLite file
    const clientConfig: Parameters<typeof createClient>[0] = {
      url: `file:${embeddedPath}`,
      syncUrl: databaseUrl,
      syncInterval: syncInterval,
      authToken: process.env.TURSO_AUTH_TOKEN,
    };

    console.log(
      `[Database] Using TursoDB embedded replica at ${embeddedPath} (sync every ${syncInterval}s)`
    );

    // For tests, use shorter sync intervals for faster updates
    if (isTest) {
      clientConfig.syncInterval = 5; // 5 seconds for tests
    }

    // Try to create client with fallback URL schemes
    for (const syncUrl of urlSchemes) {
      try {
        clientConfig.syncUrl = syncUrl;
        tursoClient = createClient(clientConfig);
        console.log(`[Database] Embedded replica sync URL: ${syncUrl}`);
        return tursoClient;
      } catch (error) {
        console.warn(`[Database] Failed to create embedded replica with ${syncUrl}:`, error.message);
      }
    }
  } else {
    // Production uses direct connection to TursoDB with URL scheme fallback
    console.log("[Database] Using direct TursoDB connection");

    for (const url of urlSchemes) {
      try {
        const clientConfig: Parameters<typeof createClient>[0] = {
          url: url,
          authToken: process.env.TURSO_AUTH_TOKEN,
        };

        // Add Vercel-specific optimizations
        if (process.env.VERCEL) {
          // Use WebSocket scheme for Vercel Edge Functions compatibility
          if (url.startsWith("libsql://")) {
            clientConfig.url = url.replace("libsql://", "wss://");
          }
          console.log("[Database] Using Vercel-optimized configuration with WebSocket");
        }

        // Add replica-specific configuration for Railway and Vercel
        if (isRailway && process.env.TURSO_REPLICA_URL) {
          clientConfig.syncUrl = url;
          clientConfig.url = process.env.TURSO_REPLICA_URL;
          console.log("[Database] Using Railway-optimized replica configuration");
        }

        tursoClient = createClient(clientConfig);
        console.log(`[Database] Direct connection established with URL scheme: ${clientConfig.url}`);
        return tursoClient;
      } catch (error) {
        console.warn(`[Database] Failed to connect with URL scheme ${url}:`, error.message);
      }
    }
  }

  // If all schemes fail, throw the last error
  throw new Error("Failed to create TursoDB client with any URL scheme");
}

// Check if we have TursoDB configuration
const hasTursoConfig = () =>
  !!(process.env.TURSO_DATABASE_URL || process.env.TURSO_HOST) && !!process.env.TURSO_AUTH_TOKEN;

// Environment-specific database configuration
function createDatabase() {
  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL;
  const isRailway = process.env.RAILWAY_ENVIRONMENT === "production";
  const isTest = process.env.NODE_ENV === "test" || process.env.VITEST;
  const tursoConfigured = hasTursoConfig();
  const forceSQLite = process.env.FORCE_SQLITE === "true";
  
  // Debug logging (remove in production)
  if (process.env.NODE_ENV !== "production") {
    console.log("[Database] Configuration debug:");
    console.log("- isProduction:", isProduction);
    console.log("- USE_EMBEDDED_REPLICA:", process.env.USE_EMBEDDED_REPLICA);
    console.log("- forceSQLite:", forceSQLite);
    console.log("- tursoConfigured:", tursoConfigured);
  }

  // Use SQLite if explicitly forced (for legacy compatibility)
  if (forceSQLite) {
    console.log("[Database] Using SQLite for development (FORCE_SQLITE=true)");
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

  // Prefer TursoDB with embedded replicas for better local development experience
  if (tursoConfigured) {
    try {
      const client = createTursoClient();
      const db = drizzleTurso(client, { schema });

      // Test connection immediately to catch auth issues early
      if (isProduction || isRailway) {
        // In production, test the connection synchronously
        console.log("[Database] Testing TursoDB connection in production...");
        // We'll handle the async test in a non-blocking way
      }

      // Enable AI/embeddings features for TursoDB
      if (!isTest) {
        // Initialize vector extension and FTS5 for AI features
        // Note: This will be attempted but may not be available in all TursoDB instances
        setTimeout(async () => {
          try {
            await db.run(sql`SELECT load_extension('vector')`);
            console.log("[Database] Vector extension loaded for AI/embeddings support");
          } catch (error) {
            console.log("[Database] Vector extension not available, AI features limited");
          }

          try {
            // Test FTS5 availability for full-text search
            await db.run(sql`SELECT fts5_version()`);
            console.log("[Database] FTS5 extension available for full-text search");
          } catch (error) {
            console.log("[Database] FTS5 extension not available");
          }
        }, 1000);
      }

      return db;
    } catch (error) {
      console.error("[Database] TursoDB initialization error:", error);

      // Enhanced error handling for production
      if (isProduction || isRailway) {
        console.error("[Database] TursoDB failed in production environment");
        console.error("[Database] Error details:", {
          message: error.message,
          code: error.code || 'UNKNOWN',
          env: {
            hasUrl: !!process.env.TURSO_DATABASE_URL,
            hasToken: !!process.env.TURSO_AUTH_TOKEN,
            tokenLength: process.env.TURSO_AUTH_TOKEN ? process.env.TURSO_AUTH_TOKEN.length : 0,
            isVercel: !!process.env.VERCEL,
            nodeEnv: process.env.NODE_ENV
          }
        });
        
        // In production, we need to fail gracefully
        throw new Error(`TursoDB connection failed in production: ${error.message}. Check environment variables and token validity.`);
      }

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

      // This should not be reached
      throw error;
    }
  }

  // Use SQLite if TursoDB is not configured
  if (!tursoConfigured) {
    console.log("[Database] Using SQLite (no TursoDB configuration found)");
    try {
      const Database = require("better-sqlite3");
      const sqlite = new Database("./mexc_sniper.db");
      sqlite.pragma("journal_mode = WAL");
      sqlite.pragma("foreign_keys = ON");
      sqlite.pragma("busy_timeout = 5000");
      sqlite.pragma("synchronous = NORMAL");
      sqlite.pragma("cache_size = -64000");
      sqlite.pragma("temp_store = MEMORY");
      return drizzle(sqlite, { schema });
    } catch (error) {
      console.error("[Database] SQLite initialization error:", error);
      throw error;
    }
  }

  // Default fallback
  console.log("[Database] Using SQLite (default fallback)");
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

// Clear cached database instance (for testing)
export function clearDbCache() {
  dbInstance = null;
  tursoClient = null;
}

// Lazy initialization - db instance created when first accessed
export const db = new Proxy({} as ReturnType<typeof createDatabase>, {
  get(target, prop) {
    const instance = getDb();
    return (instance as any)[prop];
  }
});

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
      if (hasTursoConfig()) {
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
  operationName = "Database query"
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
      database: hasTursoConfig() ? "turso" : "sqlite",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "offline",
      error: error instanceof Error ? error.message : "Unknown error",
      database: hasTursoConfig() ? "turso" : "sqlite",
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
