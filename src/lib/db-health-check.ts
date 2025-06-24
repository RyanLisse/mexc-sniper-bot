import { db } from "../db";
import { account, session, user, verification } from "../db/schema";
export async function checkDatabaseHealth() {
  try {
    // Use a simple SELECT 1 query with timeout for faster, lighter check
    const result = await Promise.race([
      db.execute(`SELECT 1 as health_check`),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Health check timeout after 3 seconds")), 3000)
      ),
    ]);

    if (result) {
      console.info("[DB Health] Database connection successful");
      return { healthy: true, message: "Database is connected", error: null };
    }

    return {
      healthy: false,
      message: "Database query returned no result",
      error: "No response from database",
    };
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

    return {
      healthy: false,
      message: isConnectivityError
        ? "Database connectivity issue - network or server problem"
        : "Database connection failed",
      error: errorMessage,
    };
  }
}

export async function checkAuthTables() {
  try {
    // Check if auth tables exist by querying them with timeout
    const tableChecks = [
      { name: "user", table: user },
      { name: "session", table: session },
      { name: "account", table: account },
      { name: "verification", table: verification },
    ];
    const results: Record<string, any> = {};

    // Check all tables with individual timeouts to prevent hanging
    for (const { name, table } of tableChecks) {
      try {
        const result = await Promise.race([
          db.select().from(table).limit(1),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Table ${name} check timeout`)), 2000)
          ),
        ]);
        results[name] = { exists: true, count: Array.isArray(result) ? result.length : 0 };
      } catch (error) {
        const errorMessage = (error as Error).message;
        results[name] = {
          exists: false,
          error: errorMessage,
          isTimeout: errorMessage.includes("timeout"),
          isConnectivity:
            errorMessage.includes("ECONNREFUSED") || errorMessage.includes("connection"),
        };
      }
    }

    // Determine overall health based on critical tables
    const criticalTables = ["user", "session"];
    const criticalTablesHealthy = criticalTables.every((tableName) => results[tableName]?.exists);

    return {
      healthy: criticalTablesHealthy,
      tables: results,
      message: criticalTablesHealthy
        ? "Auth tables are accessible"
        : "One or more critical auth tables are inaccessible",
      error: null,
    };
  } catch (error) {
    const errorMessage = (error as Error)?.message || "Unknown error";
    return {
      healthy: false,
      message: "Failed to check auth tables",
      error: errorMessage,
      tables: {},
    };
  }
}
