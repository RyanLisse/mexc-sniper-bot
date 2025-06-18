import { db } from "../db";
import { account, session, user, verification } from "../db/schema";

export async function checkDatabaseHealth() {
  try {
    // Simple connectivity test - just count users (table should exist)
    const result = await db.select().from(user).limit(0);

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
    const tableChecks = [
      { name: "user", table: user },
      { name: "session", table: session },
      { name: "account", table: account },
      { name: "verification", table: verification },
    ];
    const results: Record<string, any> = {};

    for (const { name, table } of tableChecks) {
      try {
        const result = await db.select().from(table).limit(1);
        results[name] = { exists: true, count: result.length };
      } catch (error) {
        results[name] = { exists: false, error: (error as Error).message };
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
