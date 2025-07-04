#!/usr/bin/env node

/**
 * Database Connection Validation Script for Tests
 * 
 * This script validates that the test database connection is working properly
 * and helps diagnose any connection issues before running the full test suite.
 */

import { config } from 'dotenv';
import postgres, { type Sql } from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';

interface DatabaseInfo {
  version?: string;
  database_name?: string;
  current_user?: string;
  server_ip?: string;
}

interface TableInfo {
  schemaname: string;
  tablename: string;
}

interface PingResult {
  ping: number;
  server_time: Date;
}

// Load test environment
config({ path: '.env.test', override: true });

async function validateTestDatabase(): Promise<void> {
  console.log('🧪 Validating test database connection...\n');
  
  const databaseUrl: string | undefined = process.env.DATABASE_URL;
  
  if (!databaseUrl || !databaseUrl.startsWith('postgresql://')) {
    console.error('❌ DATABASE_URL is not set or not a PostgreSQL URL');
    process.exit(1);
  }
  
  console.log('📋 Configuration:');
  console.log(`   Database URL: ${databaseUrl.replace(/:[^:@]*@/, ':***@')}`);
  console.log(`   Node Environment: ${process.env.NODE_ENV ?? 'undefined'}`);
  console.log('');
  
  let client: Sql | null = null;
  
  try {
    // Test connection with same settings as tests
    console.log('🔗 Testing database connection...');
    
    client = postgres(databaseUrl, {
      max: 3,
      idle_timeout: 30,
      connect_timeout: 20,
      ssl: 'require',
      prepare: false,
      transform: { undefined: null },
      connection: {
        application_name: "mexc-sniper-test-validation",
        statement_timeout: 20000,
        idle_in_transaction_session_timeout: 20000,
      }
    });
    
    const db: PostgresJsDatabase = drizzle(client, {});
    
    // Test basic connectivity
    const startTime: number = Date.now();
    const result = await Promise.race([
      db.execute(sql`SELECT 1 as ping, NOW() as server_time`),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 15000)
      )
    ]);
    const pingResults = result as unknown as PingResult[];
    const responseTime: number = Date.now() - startTime;
    
    console.log('✅ Database connection successful!');
    console.log(`   Response time: ${responseTime}ms`);
    console.log(`   Server time: ${pingResults[0]?.server_time}`);
    console.log('');
    
    // Test database info
    console.log('📊 Database information:');
    const dbInfo = await db.execute(sql`
      SELECT 
        version() as version,
        current_database() as database_name,
        current_user as current_user,
        inet_server_addr() as server_ip
    `) as DatabaseInfo[];
    
    const version = dbInfo[0]?.version?.split(' ');
    console.log(`   PostgreSQL Version: ${version?.[0] ?? 'Unknown'} ${version?.[1] ?? ''}`);
    console.log(`   Database: ${dbInfo[0]?.database_name ?? 'Unknown'}`);
    console.log(`   User: ${dbInfo[0]?.current_user ?? 'Unknown'}`);
    console.log('');
    
    // Test table access (check if migrations are needed)
    console.log('🗂️  Testing table access...');
    try {
      const tablesResult = await db.execute(sql`
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
        ORDER BY schemaname, tablename
      `);
      const tables = tablesResult as unknown as TableInfo[];
      
      console.log(`   Found ${tables.length} tables in database`);
      
      if (tables.length === 0) {
        console.log('⚠️  No tables found - migrations may be needed');
      } else {
        console.log('   Sample tables:');
        tables.slice(0, 5).forEach((table: TableInfo) => {
          console.log(`     - ${table.schemaname}.${table.tablename}`);
        });
        if (tables.length > 5) {
          console.log(`     ... and ${tables.length - 5} more`);
        }
      }
    } catch (error: unknown) {
      console.log('⚠️  Could not list tables (this may be normal)');
    }
    
    console.log('');
    console.log('🎉 Database validation completed successfully!');
    console.log('✅ Tests should be able to connect to the database properly.');
    
  } catch (error: unknown) {
    console.error('❌ Database connection failed:');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`   Error: ${errorMessage}`);
    
    if (errorMessage.includes('timeout')) {
      console.error('   Tip: Connection timed out - check network connectivity');
    } else if (errorMessage.includes('authentication')) {
      console.error('   Tip: Authentication failed - check credentials');
    } else if (errorMessage.includes('SSL')) {
      console.error('   Tip: SSL connection issue - check SSL settings');
    }
    
    console.error('\n💡 Troubleshooting suggestions:');
    console.error('   1. Verify DATABASE_URL is correct');
    console.error('   2. Check if your IP is allowlisted in Supabase');
    console.error('   3. Ensure network connectivity to Supabase');
    console.error('   4. Try running: npm run db:check');
    
    process.exit(1);
    
  } finally {
    // Clean up connection
    if (client) {
      try {
        await Promise.race([
          client.end({ timeout: 5 }),
          new Promise<void>((resolve) => setTimeout(() => {
            console.log('⚠️  Database cleanup timed out');
            resolve();
          }, 5000))
        ]);
        console.log('🧹 Database connection closed cleanly');
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.warn('⚠️  Error closing database connection:', errorMessage);
      }
    }
  }
}

// Run validation
validateTestDatabase().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  console.error('❌ Unexpected error:', errorMessage);
  process.exit(1);
});