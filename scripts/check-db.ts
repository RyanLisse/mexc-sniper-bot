import { db } from "../src/db";
import { user, apiCredentials, executionHistory, snipeTargets, userPreferences } from "../src/db/schema";
import { sql } from "drizzle-orm";

async function checkDatabase() {
  console.log("🔍 Checking database connection and tables...\n");

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
    process.exit(1);
  }
}

checkDatabase();