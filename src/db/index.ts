import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzleTurso } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Environment-specific database configuration
function createDatabase() {
  const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL;
  const hasTursoConfig = process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN;

  // Only use TursoDB if we have valid configuration
  if (
    (isProduction || hasTursoConfig) &&
    process.env.TURSO_DATABASE_URL &&
    process.env.TURSO_AUTH_TOKEN
  ) {
    // Use TursoDB for production/Vercel deployment
    console.log("[Database] Using TursoDB for production");
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    return drizzleTurso(client, { schema });
  } else {
    // Use SQLite for local development
    console.log("[Database] Using SQLite for development");
    const Database = require("better-sqlite3");
    const sqlite = new Database("./mexc_sniper.db");
    sqlite.pragma("journal_mode = WAL");
    return drizzle(sqlite, { schema });
  }
}

export const db = createDatabase();

// Export schema for use in other files
export * from "./schema";

// Database utilities
export async function initializeDatabase() {
  try {
    console.log("[Database] Initializing database...");

    // Test connection with a simple query
    const result = await db.run(sql`SELECT 1`);
    if (result) {
      console.log("[Database] Database connection successful");
    }

    return true;
  } catch (error) {
    console.error("[Database] Failed to initialize:", error);
    return false;
  }
}

export function closeDatabase() {
  try {
    console.log("[Database] Database connection closed");
    // Note: TursoDB connections are automatically managed
    // SQLite connections would be closed here in development
  } catch (error) {
    console.error("[Database] Error closing database:", error);
  }
}
