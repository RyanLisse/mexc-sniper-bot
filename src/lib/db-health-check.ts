import { db } from "@/src/db";
import { sql } from "drizzle-orm";

export async function checkDatabaseHealth() {
  try {
    // Simple connectivity test
    const result = await db.select({ test: sql`1` }).get();
    
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
      error: error?.message || "Unknown error"
    };
  }
}

export async function checkAuthTables() {
  try {
    // Check if auth tables exist by querying them
    const tables = ['user', 'session', 'account', 'verification'];
    const results = {};
    
    for (const table of tables) {
      try {
        const query = sql.raw(`SELECT COUNT(*) as count FROM ${table}`);
        const result = await db.get(query);
        results[table] = { exists: true, count: result?.count || 0 };
      } catch (error) {
        results[table] = { exists: false, error: error.message };
      }
    }
    
    return { healthy: true, tables: results };
  } catch (error) {
    return { 
      healthy: false, 
      message: "Failed to check auth tables",
      error: error?.message || "Unknown error"
    };
  }
}