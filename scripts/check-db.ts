import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") });

import { db } from "../src/db";
import { user, apiCredentials, executionHistory, snipeTargets, userPreferences } from "../src/db/schema";
import { sql } from "drizzle-orm";

async function checkDatabase() {
  console.log("🔍 Checking database connection and tables...\n");

  // Log configuration for debugging
  console.log("Database configuration:");
  console.log("- FORCE_SQLITE:", process.env.FORCE_SQLITE);
  console.log("- NODE_ENV:", process.env.NODE_ENV);
  console.log("- TURSO_DATABASE_URL:", process.env.TURSO_DATABASE_URL ? "SET" : "NOT SET");
  console.log("- TURSO_AUTH_TOKEN:", process.env.TURSO_AUTH_TOKEN ? "SET" : "NOT SET");
  console.log("");

  try {
    // Test connection
    const result = await db.select().from(user).limit(1);
    console.log("✅ Database connection successful");

    // Check each table
    const tables = [
      { name: "users", table: user },
      { name: "apiCredentials", table: apiCredentials },
      { name: "executionHistory", table: executionHistory },
      { name: "snipeTargets", table: snipeTargets },
      { name: "userPreferences", table: userPreferences },
    ];

    for (const { name, table } of tables) {
      const result = await db.select().from(table);
      console.log(`✅ Table ${name}: ${result.length} records`);
    }

    console.log("\n✨ Database check completed successfully!");
  } catch (error) {
    console.error("❌ Database check failed:", error);
    console.error("💡 If using TursoDB, check your internet connection and credentials");
    console.error("💡 If using SQLite, ensure the database file exists and is accessible");
    process.exit(1);
  }
}

checkDatabase();