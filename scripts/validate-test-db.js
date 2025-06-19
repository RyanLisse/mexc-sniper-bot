#!/usr/bin/env node

/**
 * Database Connection Validation Script for Tests
 * 
 * This script validates that the test database connection is working properly
 * and helps diagnose any connection issues before running the full test suite.
 */

import { config } from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';

// Load test environment
config({ path: '.env.test', override: true });

async function validateTestDatabase() {
  console.log('🧪 Validating test database connection...\n');
  
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl || !databaseUrl.startsWith('postgresql://')) {
    console.error('❌ DATABASE_URL is not set or not a PostgreSQL URL');
    process.exit(1);
  }
  
  console.log('📋 Configuration:');
  console.log(`   Database URL: ${databaseUrl.replace(/:[^:@]*@/, ':***@')}`);
  console.log(`   Node Environment: ${process.env.NODE_ENV}`);
  console.log('');
  
  let client = null;
  
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
    
    const db = drizzle(client, {});
    
    // Test basic connectivity
    const startTime = Date.now();
    const result = await Promise.race([
      db.execute(sql`SELECT 1 as ping, NOW() as server_time`),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 15000)
      )
    ]);
    const responseTime = Date.now() - startTime;
    
    console.log('✅ Database connection successful!');
    console.log(`   Response time: ${responseTime}ms`);
    console.log(`   Server time: ${result[0]?.server_time}`);
    console.log('');
    
    // Test database info
    console.log('📊 Database information:');
    const dbInfo = await db.execute(sql`
      SELECT 
        version() as version,
        current_database() as database_name,
        current_user as current_user,
        inet_server_addr() as server_ip
    `);
    
    console.log(`   PostgreSQL Version: ${dbInfo[0]?.version?.split(' ')[0]} ${dbInfo[0]?.version?.split(' ')[1]}`);
    console.log(`   Database: ${dbInfo[0]?.database_name}`);
    console.log(`   User: ${dbInfo[0]?.current_user}`);
    console.log('');
    
    // Test table access (check if migrations are needed)
    console.log('🗂️  Testing table access...');
    try {
      const tables = await db.execute(sql`
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
        ORDER BY schemaname, tablename
      `);
      
      console.log(`   Found ${tables.length} tables in database`);
      
      if (tables.length === 0) {
        console.log('⚠️  No tables found - migrations may be needed');
      } else {
        console.log('   Sample tables:');
        tables.slice(0, 5).forEach(table => {
          console.log(`     - ${table.schemaname}.${table.tablename}`);
        });
        if (tables.length > 5) {
          console.log(`     ... and ${tables.length - 5} more`);
        }
      }
    } catch (error) {
      console.log('⚠️  Could not list tables (this may be normal)');
    }
    
    console.log('');
    console.log('🎉 Database validation completed successfully!');
    console.log('✅ Tests should be able to connect to the database properly.');
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(`   Error: ${error.message}`);
    
    if (error.message.includes('timeout')) {
      console.error('   Tip: Connection timed out - check network connectivity');
    } else if (error.message.includes('authentication')) {
      console.error('   Tip: Authentication failed - check credentials');
    } else if (error.message.includes('SSL')) {
      console.error('   Tip: SSL connection issue - check SSL settings');
    }
    
    console.error('\n💡 Troubleshooting suggestions:');
    console.error('   1. Verify DATABASE_URL is correct');
    console.error('   2. Check if your IP is allowlisted in NeonDB');
    console.error('   3. Ensure network connectivity to NeonDB');
    console.error('   4. Try running: npm run db:check');
    
    process.exit(1);
    
  } finally {
    // Clean up connection
    if (client) {
      try {
        await Promise.race([
          client.end({ timeout: 5 }),
          new Promise((resolve) => setTimeout(() => {
            console.log('⚠️  Database cleanup timed out');
            resolve(undefined);
          }, 5000))
        ]);
        console.log('🧹 Database connection closed cleanly');
      } catch (error) {
        console.warn('⚠️  Error closing database connection:', error.message);
      }
    }
  }
}

// Run validation
validateTestDatabase().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});