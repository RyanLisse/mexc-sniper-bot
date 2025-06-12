import { db } from "@/src/db";
import { sql } from "drizzle-orm";

export async function checkDatabaseHealth() {
  try {
    // Simple connectivity test
    const result = await db.select({ test: sql`1` });

    if (result) {
      console.log("[DB Health] Database connection successful");
      return { healthy: true, message: "Database is connected" };
    }

    return { healthy: false, message: "Database query returned no result" };
  } catch (error) {
    console.error("[DB Health] Database error:", error);
    return {
      healthy: false,
      message: "Database connection failed",
      error: (error as Error)?.message || "Unknown error",
    };
  }
}

export async function checkAuthTables() {
  try {
    // Check if auth tables exist by querying them
    const tables = ["user", "session", "account", "verification"];
    const results: Record<string, any> = {};

    for (const table of tables) {
      try {
        const result = await db.select().from(sql.raw(table)).limit(1);
        results[table] = { exists: true, count: result.length };
      } catch (error) {
        results[table] = { exists: false, error: (error as Error).message };
      }
    }

    return { healthy: true, tables: results };
  } catch (error) {
    return {
      healthy: false,
      message: "Failed to check auth tables",
      error: (error as Error)?.message || "Unknown error",
    };
  }
}
