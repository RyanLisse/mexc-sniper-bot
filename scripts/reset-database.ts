#!/usr/bin/env npx tsx

/**
 * Reset Database Script
 * Drops all tables and reapplies migrations for NeonDB PostgreSQL
 */

import { config } from "dotenv";
import { resolve } from "path";
import postgres from "postgres";
import { sql } from "drizzle-orm";

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local'), override: true });

const databaseUrl = process.env.DATABASE_URL?.startsWith('postgresql://') 
  ? process.env.DATABASE_URL 
  : 'postgresql://neondb_owner:npg_oTv5qIQYX6lb@ep-silent-firefly-a1l3mkrm-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

async function resetDatabase() {
  console.log('🗑️  Resetting NeonDB database...');
  
  const client = postgres(databaseUrl, {
    max: 1,
    ssl: 'require'
  });

  try {
    // Drop all tables (be very careful!)
    console.log('📋 Getting list of tables...');
    const tablesResult = await client`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    const tables = tablesResult.map(row => row.table_name);
    console.log(`📋 Found ${tables.length} tables:`, tables.slice(0, 5).join(', ') + '...');
    
    if (tables.length > 0) {
      console.log('🗑️  Dropping all tables...');
      // Drop all tables with CASCADE to handle foreign key constraints
      for (const tableName of tables) {
        try {
          await client`DROP TABLE IF EXISTS ${client(tableName)} CASCADE`;
          console.log(`✅ Dropped table: ${tableName}`);
        } catch (error) {
          console.warn(`⚠️ Failed to drop ${tableName}:`, error.message);
        }
      }
    }
    
    // Also drop the drizzle migrations table if it exists
    await client`DROP SCHEMA IF EXISTS drizzle CASCADE`;
    console.log('✅ Dropped drizzle schema');
    
    // Verify all tables are gone
    const remainingTables = await client`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `;
    
    console.log(`✅ Database reset complete. Remaining tables: ${remainingTables.length}`);
    
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    throw error;
  } finally {
    await client.end();
  }
}

async function main() {
  console.log('🚀 NeonDB Database Reset');
  console.log('======================');
  
  await resetDatabase();
  
  console.log('\n✅ Database reset successful!');
  console.log('📦 Now run: npm run db:migrate');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Reset failed:', error);
    process.exit(1);
  });
}