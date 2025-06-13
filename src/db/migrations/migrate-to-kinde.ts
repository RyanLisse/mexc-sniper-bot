#!/usr/bin/env bun
/**
 * Migration script to transition from better-auth to Kinde Auth
 * This script safely migrates user data and updates foreign key references
 */

import { resolve } from "path";
import { config } from "dotenv";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });

import { sql } from "drizzle-orm";
import { db } from "../index";

interface BetterAuthUser {
  id: string;
  email: string;
  name: string;
  username?: string;
  emailVerified: boolean;
  createdAt: number;
  updatedAt: number;
}

interface KindeUser {
  id: string; // Will be Kinde user ID
  email: string;
  name: string;
  username?: string;
  emailVerified: boolean;
  createdAt: number;
  updatedAt: number;
  // Store mapping to old better-auth ID for migration
  legacyBetterAuthId?: string;
}

async function backupExistingData() {
  console.log("📦 Creating backup of existing user data...");

  try {
    // Create backup table for better-auth users
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS user_backup_better_auth AS
      SELECT * FROM user
    `);

    console.log("✅ User data backed up to user_backup_better_auth");

    // Backup related tables
    const relatedTables = [
      "api_credentials",
      "execution_history",
      "snipe_targets",
      "user_preferences",
      "workflow_activity",
      "transactions",
    ];

    for (const table of relatedTables) {
      await db.run(
        sql.raw(`
        CREATE TABLE IF NOT EXISTS ${table}_backup_better_auth AS
        SELECT * FROM ${table}
      `)
      );
      console.log(`✅ Backed up ${table}`);
    }

    return true;
  } catch (error) {
    console.error("❌ Backup failed:", error);
    return false;
  }
}

async function createKindeUserTable() {
  console.log("🏗️  Creating new Kinde-compatible user table...");

  try {
    // Create new user table with Kinde structure
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS user_new (
        id TEXT PRIMARY KEY,  -- Kinde user ID
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        username TEXT UNIQUE,
        emailVerified INTEGER DEFAULT 0,
        image TEXT,
        legacyBetterAuthId TEXT UNIQUE, -- For migration mapping
        createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
        updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    console.log("✅ New user table created");
    return true;
  } catch (error) {
    console.error("❌ Failed to create new user table:", error);
    return false;
  }
}

async function migrateUserData() {
  console.log("🔄 Migrating user data to Kinde format...");

  try {
    // Get all existing users using proper query
    const existingUsers = await db.all(sql`SELECT * FROM user`);

    console.log(`Found ${existingUsers.length} users to migrate`);

    // For now, we'll use the existing better-auth IDs as Kinde IDs
    // In a real migration, you'd map these to actual Kinde user IDs
    for (const user of existingUsers) {
      await db.run(sql`
        INSERT INTO user_new (
          id, email, name, username, emailVerified,
          legacyBetterAuthId, createdAt, updatedAt
        ) VALUES (
          ${(user as any).id}, ${(user as any).email}, ${(user as any).name}, ${(user as any).username || null},
          ${(user as any).emailVerified ? 1 : 0}, ${(user as any).id}, ${(user as any).createdAt}, ${(user as any).updatedAt}
        )
      `);
    }

    console.log("✅ User data migrated successfully");
    return true;
  } catch (error) {
    console.error("❌ User data migration failed:", error);
    return false;
  }
}

async function updateForeignKeyReferences() {
  console.log("🔗 Updating foreign key references...");

  // Note: Since we're keeping the same user IDs for now,
  // foreign key references don't need to be updated
  // This would be needed if Kinde user IDs were different

  console.log("✅ Foreign key references are compatible (using same IDs)");
  return true;
}

async function switchToNewUserTable() {
  console.log("🔄 Switching to new user table...");

  try {
    // Rename old table
    await db.run(sql`ALTER TABLE user RENAME TO user_old_better_auth`);

    // Rename new table to user
    await db.run(sql`ALTER TABLE user_new RENAME TO user`);

    console.log("✅ Successfully switched to new user table");
    return true;
  } catch (error) {
    console.error("❌ Failed to switch tables:", error);
    return false;
  }
}

async function cleanupBetterAuthTables() {
  console.log("🧹 Cleaning up better-auth specific tables...");

  try {
    // Remove better-auth specific tables
    const betterAuthTables = ["session", "account", "verification"];

    for (const table of betterAuthTables) {
      await db.run(sql.raw(`DROP TABLE IF EXISTS ${table}`));
      console.log(`✅ Removed ${table} table`);
    }

    return true;
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    return false;
  }
}

async function runMigration() {
  console.log("🚀 Starting Kinde Auth migration...\n");

  try {
    // Step 1: Backup existing data
    if (!(await backupExistingData())) {
      throw new Error("Backup failed");
    }

    // Step 2: Create new user table
    if (!(await createKindeUserTable())) {
      throw new Error("Failed to create new user table");
    }

    // Step 3: Migrate user data
    if (!(await migrateUserData())) {
      throw new Error("User data migration failed");
    }

    // Step 4: Update foreign key references (if needed)
    if (!(await updateForeignKeyReferences())) {
      throw new Error("Foreign key update failed");
    }

    // Step 5: Switch to new user table
    if (!(await switchToNewUserTable())) {
      throw new Error("Table switch failed");
    }

    // Step 6: Cleanup better-auth tables
    if (!(await cleanupBetterAuthTables())) {
      throw new Error("Cleanup failed");
    }

    console.log("\n🎉 Migration completed successfully!");
    console.log("📋 Summary:");
    console.log("  ✅ User data migrated to Kinde format");
    console.log("  ✅ Foreign key references preserved");
    console.log("  ✅ Better-auth tables removed");
    console.log("  ✅ Backup tables created for safety");
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    console.log("\n🔄 To rollback, you can restore from backup tables:");
    console.log("  - user_backup_better_auth");
    console.log("  - *_backup_better_auth tables");
    process.exit(1);
  }
}

// Run migration
runMigration().catch(console.error);

export { runMigration };
