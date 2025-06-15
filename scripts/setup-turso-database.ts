#!/usr/bin/env tsx

import { config } from "dotenv";
import path from "path";

// Load environment variables
config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "@/src/db/schema";

async function setupTursoDatabase() {
  console.log("🚀 Setting up TursoDB Database");
  console.log("=" .repeat(50));

  try {
    // Check if we have TursoDB configuration
    if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
      console.log("❌ TursoDB configuration missing");
      console.log("Required environment variables:");
      console.log("- TURSO_DATABASE_URL");
      console.log("- TURSO_AUTH_TOKEN");
      process.exit(1);
    }

    console.log("✅ TursoDB configuration found");
    console.log(`📍 Database URL: ${process.env.TURSO_DATABASE_URL}`);

    // Create TursoDB client (direct connection)
    console.log("\n🔌 Connecting to TursoDB...");
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });

    const db = drizzle(client, { schema });

    // Test connection
    console.log("🧪 Testing connection...");
    await db.run("SELECT 1;");
    console.log("✅ Connection successful");

    // Check if tables already exist
    console.log("\n📋 Checking existing tables...");
    try {
      const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table';");
      console.log(`📊 Found ${tables.rows.length} existing tables`);
      if (tables.rows.length > 0) {
        console.log("Tables found:");
        tables.rows.forEach(row => {
          console.log(`   - ${row.name}`);
        });
      }
    } catch (error) {
      console.log("ℹ️ Could not check existing tables, this is normal for new databases");
    }

    // Run migrations
    console.log("\n🔄 Running database migrations...");
    try {
      await migrate(db, { migrationsFolder: "./src/db/migrations" });
      console.log("✅ Migrations completed successfully");
    } catch (error) {
      console.log("⚠️ Migration error (this might be normal if no migrations exist):");
      console.log((error as Error).message);
    }

    // Verify tables exist after migration
    console.log("\n🔍 Verifying database schema...");
    const requiredTables = ['user', 'session', 'account', 'verification'];
    const verificationResults = [];

    for (const tableName of requiredTables) {
      try {
        await db.run(`SELECT COUNT(*) FROM ${tableName} LIMIT 1;`);
        verificationResults.push({ table: tableName, exists: true });
        console.log(`✅ Table '${tableName}' exists and is accessible`);
      } catch (error) {
        verificationResults.push({ table: tableName, exists: false, error: (error as Error).message });
        console.log(`❌ Table '${tableName}' missing or inaccessible`);
      }
    }

    // Summary
    console.log("\n📊 Setup Summary:");
    const successfulTables = verificationResults.filter(r => r.exists).length;
    const totalTables = requiredTables.length;
    console.log(`   Tables created: ${successfulTables}/${totalTables}`);
    
    if (successfulTables === totalTables) {
      console.log("🎉 TursoDB setup completed successfully!");
      console.log("\n💡 To use TursoDB in your application:");
      console.log("   1. Set FORCE_SQLITE=false in .env.local");
      console.log("   2. Restart your development server");
    } else {
      console.log("⚠️ Some tables are missing. You may need to:");
      console.log("   1. Create migration files: npm run db:generate");
      console.log("   2. Re-run this script");
    }

    // Close connection
    client.close();

  } catch (error) {
    console.error("\n❌ TursoDB setup failed:", error);
    console.log("\n🔧 Troubleshooting steps:");
    console.log("1. Verify your TURSO_DATABASE_URL and TURSO_AUTH_TOKEN");
    console.log("2. Check if the database exists in your Turso dashboard");
    console.log("3. Ensure your auth token has the correct permissions");
    process.exit(1);
  }
}

// Create basic schema if migrations don't exist
async function createBasicSchema(db: any) {
  console.log("🔨 Creating basic schema...");
  
  const createUserTable = `
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      username TEXT,
      emailVerified INTEGER,
      image TEXT,
      legacyBetterAuthId TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createSessionTable = `
    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      expiresAt INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ipAddress TEXT,
      userAgent TEXT,
      userId TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
    );
  `;

  const createAccountTable = `
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      providerId TEXT NOT NULL,
      userId TEXT NOT NULL,
      accessToken TEXT,
      refreshToken TEXT,
      idToken TEXT,
      accessTokenExpiresAt TEXT,
      refreshTokenExpiresAt TEXT,
      scope TEXT,
      password TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
    );
  `;

  const createVerificationTable = `
    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT
    );
  `;

  try {
    await db.run(createUserTable);
    await db.run(createSessionTable);
    await db.run(createAccountTable);
    await db.run(createVerificationTable);
    console.log("✅ Basic schema created");
  } catch (error) {
    console.log("⚠️ Schema creation error:", (error as Error).message);
    throw error;
  }
}

// Alternative setup method using basic SQL if Drizzle migrations fail
async function setupWithBasicSQL() {
  console.log("\n🔄 Attempting setup with basic SQL...");
  
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  const db = drizzle(client, { schema });
  
  await createBasicSchema(db);
  
  return db;
}

if (require.main === module) {
  setupTursoDatabase()
    .then(() => {
      console.log("\n🏁 Setup completed!");
      process.exit(0);
    })
    .catch(async (error) => {
      console.log("\n🔄 Primary setup failed, trying alternative method...");
      try {
        await setupWithBasicSQL();
        console.log("✅ Alternative setup successful!");
        process.exit(0);
      } catch (altError) {
        console.error("❌ All setup methods failed");
        process.exit(1);
      }
    });
}

export { setupTursoDatabase };