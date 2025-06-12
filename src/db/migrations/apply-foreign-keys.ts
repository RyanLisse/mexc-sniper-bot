#!/usr/bin/env bun
/**
 * Safe migration script to add foreign key constraints and performance indexes
 * Handles both SQLite and TursoDB databases
 */

import { sql } from "drizzle-orm";
import { db } from "../index";

async function applyForeignKeyMigration() {
  console.log("🔄 Starting foreign key and index migration...");

  try {
    // Check if we're using SQLite
    const isSQLite = !process.env.TURSO_DATABASE_URL;

    if (isSQLite) {
      console.log("📦 SQLite detected - applying foreign key migration...");
      
      // Enable foreign keys for SQLite
      await db.run(sql`PRAGMA foreign_keys = ON`);
      console.log("✅ Foreign keys enabled");
    }

    // Check if migration has already been applied
    const existingIndexes = await db.run(sql`
      SELECT name FROM sqlite_master 
      WHERE type = 'index' 
      AND name = 'api_credentials_user_idx'
    `);

    if (existingIndexes && existingIndexes.length > 0) {
      console.log("⚠️  Migration appears to have already been applied");
      console.log("💡 Skipping to avoid duplicate indexes");
      return;
    }

    // Add missing performance indexes (these work on both SQLite and TursoDB)
    console.log("🔨 Adding performance indexes...");

    // Add single column index for apiCredentials userId
    await db.run(sql`
      CREATE INDEX IF NOT EXISTS api_credentials_user_idx 
      ON api_credentials (user_id)
    `);
    console.log("✅ Added api_credentials_user_idx");

    // Add index for monitoredListings symbolName
    await db.run(sql`
      CREATE INDEX IF NOT EXISTS monitored_listings_symbol_name_idx 
      ON monitored_listings (symbol_name)
    `);
    console.log("✅ Added monitored_listings_symbol_name_idx");

    // Add workflow table indexes if they don't exist
    await db.run(sql`
      CREATE INDEX IF NOT EXISTS workflow_system_status_user_idx 
      ON workflow_system_status (user_id)
    `);
    console.log("✅ Added workflow_system_status_user_idx");

    await db.run(sql`
      CREATE INDEX IF NOT EXISTS workflow_activity_user_idx 
      ON workflow_activity (user_id)
    `);
    console.log("✅ Added workflow_activity_user_idx");

    console.log("🎉 Index migration completed successfully!");

    // For SQLite, we need to handle foreign keys differently
    if (isSQLite) {
      console.log("\n⚠️  Note: SQLite foreign key constraints require table recreation.");
      console.log("💡 To apply foreign key constraints with CASCADE DELETE:");
      console.log("   1. Run: bun run db:generate");
      console.log("   2. Update the schema.ts file with proper references");
      console.log("   3. Run: bun run db:migrate");
      console.log("\n📋 Foreign key constraints to be added:");
      console.log("   - userPreferences.userId → user.id (CASCADE DELETE)");
      console.log("   - apiCredentials.userId → user.id (CASCADE DELETE)");
      console.log("   - snipeTargets.userId → user.id (CASCADE DELETE)");
      console.log("   - executionHistory.userId → user.id (CASCADE DELETE)");
      console.log("   - transactions.userId → user.id (CASCADE DELETE)");
    }

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

// Run the migration
if (import.meta.main) {
  applyForeignKeyMigration()
    .then(() => {
      console.log("✅ Migration script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Migration script failed:", error);
      process.exit(1);
    });
}