import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

// Database connection
const sqlite = new Database("./mexc_sniper.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });

// Export schema for use in other files
export * from "./schema";

// Database utilities
export async function initializeDatabase() {
  try {
    // Run migrations if needed
    console.log("[Database] Initializing SQLite database...");

    // Test connection
    const result = sqlite.prepare("SELECT 1 as test").get();
    if (result) {
      console.log("[Database] SQLite connection successful");
    }

    return true;
  } catch (error) {
    console.error("[Database] Failed to initialize:", error);
    return false;
  }
}

export function closeDatabase() {
  try {
    sqlite.close();
    console.log("[Database] Database connection closed");
  } catch (error) {
    console.error("[Database] Error closing database:", error);
  }
}
