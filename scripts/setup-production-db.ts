#!/usr/bin/env tsx

/**
 * Production Database Setup Script
 * 
 * This script sets up the database tables and initial data for production environment.
 * It's designed to be safe to run multiple times.
 */

import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq, sql } from "drizzle-orm";
import { strategyTemplates } from "../src/db/schemas/strategies";
import { multiPhaseTradingService } from "../src/services/multi-phase-trading-service";

async function setupProductionDatabase() {
  console.log("🚀 Starting production database setup...");

  // Verify environment
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    throw new Error("TursoDB configuration missing. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN");
  }

  // Create database client
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const db = drizzle(client);

  try {
    // Step 1: Run migrations
    console.log("📋 Running database migrations...");
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
    console.log("✅ Migrations completed successfully");

    // Step 2: Check if strategy templates exist
    console.log("🔍 Checking strategy templates...");
    const existingTemplates = await db.select().from(strategyTemplates).limit(1);
    
    if (existingTemplates.length === 0) {
      console.log("📝 Initializing predefined strategy templates...");
      await multiPhaseTradingService.initializePredefinedStrategies();
      console.log("✅ Strategy templates initialized");
    } else {
      console.log("📋 Strategy templates already exist");
    }

    // Step 3: Verify setup
    console.log("🔍 Verifying database setup...");
    
    // Count strategy templates
    const templateCount = await db.select().from(strategyTemplates);
    console.log(`📊 Strategy templates: ${templateCount.length}`);

    // Test database health
    try {
      const testSelect = await db.execute(sql`SELECT 1 as test`);
      if (testSelect.rows && testSelect.rows.length >= 0) {
        console.log("✅ Database connectivity verified");
      }
    } catch (error) {
      console.warn("⚠️ Database health check failed:", error instanceof Error ? error.message : String(error));
    }

    console.log("🎉 Production database setup completed successfully!");
    
    return {
      success: true,
      templateCount: templateCount.length,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error("❌ Database setup failed:", error);
    throw error;
  } finally {
    client.close();
  }
}

// Run setup if called directly
if (require.main === module) {
  setupProductionDatabase()
    .then((result) => {
      console.log("Setup result:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Setup failed:", error);
      process.exit(1);
    });
}

export { setupProductionDatabase };