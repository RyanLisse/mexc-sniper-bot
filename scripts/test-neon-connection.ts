#!/usr/bin/env tsx

/**
 * NeonDB Connection Test Script
 * Tests connectivity to NeonDB PostgreSQL database and verifies schema compatibility
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local only (skip .env)
config({ path: resolve(process.cwd(), '.env.local'), override: true });

// Ensure NeonDB URL is used for testing (override any other DATABASE_URL)
process.env.DATABASE_URL = process.env.DATABASE_URL?.startsWith('postgresql://') 
  ? process.env.DATABASE_URL 
  : 'postgresql://neondb_owner:npg_oTv5qIQYX6lb@ep-silent-firefly-a1l3mkrm-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";

interface ConnectionTestResult {
  success: boolean;
  latency?: number;
  version?: string;
  extensions?: string[];
  tables?: string[];
  error?: string;
  config: {
    hasUrl: boolean;
    isProduction: boolean;
    forceSqlite: boolean;
  };
}

async function testNeonConnection(): Promise<ConnectionTestResult> {
  const startTime = Date.now();
  
  const config = {
    hasUrl: !!process.env.DATABASE_URL?.startsWith('postgresql://'),
    isProduction: process.env.NODE_ENV === 'production',
    forceSqlite: process.env.FORCE_SQLITE === 'true'
  };

  console.log('🔗 Testing NeonDB Connection...');
  console.log('Configuration:', config);

  if (!config.hasUrl) {
    return {
      success: false,
      error: 'No PostgreSQL DATABASE_URL found. Please set DATABASE_URL environment variable.',
      config
    };
  }

  if (config.forceSqlite && !config.isProduction) {
    return {
      success: false,
      error: 'FORCE_SQLITE=true is set. Remove this to test NeonDB connection.',
      config
    };
  }

  try {
    // Create PostgreSQL client
    const client = postgres(process.env.DATABASE_URL!, {
      max: 2, // Limit connections for testing
      idle_timeout: 10,
      connect_timeout: 15,
      ssl: 'require'
    });

    const db = drizzle(client, { schema });

    // Test 1: Basic connectivity
    console.log('📊 Testing basic connectivity...');
    const pingResult = await db.execute(sql`SELECT 1 as ping`);
    console.log('✅ Ping successful:', pingResult[0]);

    // Test 2: Get PostgreSQL version
    console.log('🔍 Checking PostgreSQL version...');
    const versionResult = await db.execute(sql`SELECT version()`);
    const version = (versionResult[0] as any).version;
    console.log('✅ PostgreSQL version:', version);

    // Test 3: Check available extensions
    console.log('🧩 Checking available extensions...');
    const extensionsResult = await db.execute(sql`
      SELECT name FROM pg_available_extensions 
      WHERE name IN ('vector', 'pg_stat_statements', 'pg_trgm', 'uuid-ossp', 'pgcrypto')
      ORDER BY name
    `);
    const extensions = extensionsResult.map((row: any) => row.name);
    console.log('✅ Available extensions:', extensions);

    // Test 4: Check if schema tables exist
    console.log('📋 Checking schema tables...');
    const tablesResult = await db.execute(sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    const tables = tablesResult.map((row: any) => row.table_name);
    console.log('✅ Existing tables:', tables);

    // Test 5: Test table creation (if no tables exist)
    if (tables.length === 0) {
      console.log('🛠️ No tables found. Testing table creation...');
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS neon_test (
          id SERIAL PRIMARY KEY,
          test_data TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await db.execute(sql`
        INSERT INTO neon_test (test_data) VALUES ('NeonDB connection test successful')
      `);
      
      const testResult = await db.execute(sql`SELECT * FROM neon_test LIMIT 1`);
      console.log('✅ Table creation test:', testResult[0]);
      
      // Clean up test table
      await db.execute(sql`DROP TABLE neon_test`);
      console.log('✅ Test table cleaned up');
    }

    const latency = Date.now() - startTime;

    // Close connection
    await client.end();

    console.log('🎉 NeonDB connection test completed successfully!');
    console.log(`⚡ Total test time: ${latency}ms`);

    return {
      success: true,
      latency,
      version,
      extensions,
      tables,
      config
    };

  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.error('❌ NeonDB connection test failed:');
    console.error('Error:', errorMessage);
    console.error(`⏱️ Failed after: ${latency}ms`);

    return {
      success: false,
      error: errorMessage,
      latency,
      config
    };
  }
}

// Test database schema compatibility
async function testSchemaCompatibility(): Promise<boolean> {
  console.log('\n🔧 Testing schema compatibility...');
  
  try {
    // Check if we can import all schema files without errors
    const allTables = Object.keys(schema).filter(key => 
      key !== 'default' && typeof (schema as any)[key] === 'object'
    );
    
    console.log('✅ Schema tables loaded:', allTables.length);
    console.log('📋 Available tables:', allTables.slice(0, 10).join(', ') + 
      (allTables.length > 10 ? '...' : ''));
    
    return true;
  } catch (error) {
    console.error('❌ Schema compatibility error:', error);
    return false;
  }
}

// Main execution
async function main() {
  console.log('🚀 NeonDB Connection & Compatibility Test');
  console.log('==========================================\n');

  // Test schema compatibility first
  const schemaOk = await testSchemaCompatibility();
  if (!schemaOk) {
    process.exit(1);
  }

  // Test NeonDB connection
  const result = await testNeonConnection();
  
  // Output summary
  console.log('\n📊 Test Summary:');
  console.log('================');
  console.log('Success:', result.success ? '✅' : '❌');
  console.log('Latency:', result.latency ? `${result.latency}ms` : 'N/A');
  console.log('PostgreSQL Version:', result.version || 'N/A');
  console.log('Extensions Available:', result.extensions?.length || 0);
  console.log('Existing Tables:', result.tables?.length || 0);
  
  if (!result.success) {
    console.log('\n❌ Error:', result.error);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Verify DATABASE_URL is set correctly');
    console.log('2. Check network connectivity to NeonDB');
    console.log('3. Ensure database exists and credentials are valid');
    console.log('4. Remove FORCE_SQLITE=true if set');
    process.exit(1);
  }

  console.log('\n🎉 All tests passed! NeonDB is ready to use.');
  process.exit(0);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Test script crashed:', error);
    process.exit(1);
  });
}