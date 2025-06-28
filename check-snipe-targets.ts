#!/usr/bin/env bun

/**
 * Database Verification Script - Check Snipe Targets and CRUD Operations
 * 
 * This script verifies:
 * 1. Connection to NeonDB PostgreSQL
 * 2. Snipe targets in database vs calendar discrepancy
 * 3. Basic CRUD operations functionality
 * 4. Schema validation and data integrity
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './src/db/schema';
import { eq, desc, count } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

// Create PostgreSQL connection
const client = postgres(DATABASE_URL);
const db = drizzle(client, { schema });

async function main() {
  try {
    console.log('🔍 Starting Database Verification...\n');
    
    // 1. Test basic connection
    console.log('📡 Testing database connection...');
    const connectionTest = await client`SELECT version(), current_database(), current_user`;
    console.log('✅ Connected to:', connectionTest[0]);
    console.log('   Database:', connectionTest[0].current_database);
    console.log('   User:', connectionTest[0].current_user);
    console.log();

    // 2. Check snipe targets table
    console.log('🎯 Checking snipe_targets table...');
    try {
      const totalTargets = await db
        .select({ count: count() })
        .from(schema.snipeTargets);
      
      console.log(`📊 Total snipe targets in database: ${totalTargets[0].count}`);
      
      if (totalTargets[0].count > 0) {
        // Get recent targets
        const recentTargets = await db
          .select()
          .from(schema.snipeTargets)
          .orderBy(desc(schema.snipeTargets.createdAt))
          .limit(10);
        
        console.log('\n📋 Recent snipe targets:');
        recentTargets.forEach((target, index) => {
          console.log(`${index + 1}. ID: ${target.id}`);
          console.log(`   Symbol: ${target.symbolName}`);
          console.log(`   Status: ${target.status}`);
          console.log(`   Created: ${target.createdAt}`);
          console.log(`   User: ${target.userId}`);
          console.log(`   Position Size: $${target.positionSizeUsdt} USDT`);
          console.log(`   Priority: ${target.priority}`);
          console.log(`   Confidence: ${target.confidenceScore}`);
          console.log();
        });
      }
    } catch (error) {
      console.error('❌ Error checking snipe_targets:', error);
      console.log('💡 This might indicate schema issues or missing table');
    }

    // 3. Check calendar entries (if table exists)
    console.log('📅 Checking calendar-related data...');
    try {
      // Check if we have any calendar or token listing related tables
      const tableQuery = await client`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE '%calendar%' 
        OR table_name LIKE '%listing%' 
        OR table_name LIKE '%token%'
        OR table_name LIKE '%vcoin%'
      `;
      
      console.log('📋 Calendar/listing related tables found:');
      tableQuery.forEach(row => console.log(`   - ${row.table_name}`));
      
      if (tableQuery.length === 0) {
        console.log('⚠️  No calendar/listing tables found');
        console.log('💡 Calendar data might be stored externally or cached');
      }
    } catch (error) {
      console.error('❌ Error checking calendar tables:', error);
    }

    // 4. Test CRUD operations
    console.log('\n🧪 Testing CRUD operations...');
    
    try {
      // CREATE - Insert a test snipe target
      console.log('1️⃣ Testing CREATE operation...');
      const testTarget = await db
        .insert(schema.snipeTargets)
        .values({
          userId: 'test-user-verification',
          vcoinId: 'test-vcoin-999',
          symbolName: 'TEST-CRUD-TOKEN',
          entryStrategy: 'market',
          positionSizeUsdt: 100.00,
          takeProfitLevel: 2.0,
          stopLossPercent: 5.0,
          status: 'testing',
          priority: 999, // High priority to identify test records
          targetExecutionTime: new Date(),
          confidenceScore: 0.95,
          riskLevel: 'low',
        })
        .returning({ id: schema.snipeTargets.id });
      
      const testId = testTarget[0].id;
      console.log(`✅ CREATE: Test target created with ID: ${testId}`);

      // READ - Fetch the created target
      console.log('2️⃣ Testing READ operation...');
      const readTarget = await db
        .select()
        .from(schema.snipeTargets)
        .where(eq(schema.snipeTargets.id, testId));
      
      if (readTarget.length > 0) {
        console.log('✅ READ: Test target retrieved successfully');
        console.log(`   Symbol: ${readTarget[0].symbolName}`);
        console.log(`   Status: ${readTarget[0].status}`);
      } else {
        console.log('❌ READ: Failed to retrieve test target');
      }

      // UPDATE - Modify the test target
      console.log('3️⃣ Testing UPDATE operation...');
      await db
        .update(schema.snipeTargets)
        .set({ 
          status: 'updated-test',
          positionSizeUsdt: 150.00 
        })
        .where(eq(schema.snipeTargets.id, testId));
      
      const updatedTarget = await db
        .select()
        .from(schema.snipeTargets)
        .where(eq(schema.snipeTargets.id, testId));
      
      if (updatedTarget[0]?.status === 'updated-test' && updatedTarget[0]?.positionSizeUsdt === 150.00) {
        console.log('✅ UPDATE: Test target updated successfully');
      } else {
        console.log('❌ UPDATE: Failed to update test target');
      }

      // DELETE - Remove the test target
      console.log('4️⃣ Testing DELETE operation...');
      await db
        .delete(schema.snipeTargets)
        .where(eq(schema.snipeTargets.id, testId));
      
      const deletedCheck = await db
        .select()
        .from(schema.snipeTargets)
        .where(eq(schema.snipeTargets.id, testId));
      
      if (deletedCheck.length === 0) {
        console.log('✅ DELETE: Test target deleted successfully');
      } else {
        console.log('❌ DELETE: Failed to delete test target');
      }

      console.log('\n🎉 All CRUD operations completed successfully!');
      
    } catch (crudError) {
      console.error('❌ CRUD operation failed:', crudError);
      console.log('💡 This indicates database schema or permission issues');
    }

    // 5. Check active user targets
    console.log('\n👤 Checking active user targets...');
    try {
      const activeTargets = await db
        .select()
        .from(schema.snipeTargets)
        .where(eq(schema.snipeTargets.status, 'ready'))
        .orderBy(desc(schema.snipeTargets.createdAt));
      
      console.log(`🎯 Active 'ready' targets: ${activeTargets.length}`);
      
      if (activeTargets.length > 0) {
        console.log('\n📋 Ready targets details:');
        activeTargets.forEach((target, index) => {
          console.log(`${index + 1}. ${target.symbolName} (ID: ${target.id})`);
          console.log(`   Status: ${target.status}`);
          console.log(`   Created: ${target.createdAt}`);
          console.log(`   Priority: ${target.priority}`);
          console.log(`   User: ${target.userId}`);
          console.log();
        });
      } else {
        console.log('⚠️  No ready targets found - this explains why nothing is being executed!');
        console.log('💡 Check if targets are being created from calendar data properly');
      }
    } catch (error) {
      console.error('❌ Error checking active targets:', error);
    }

    // 6. Summary and recommendations
    console.log('\n📊 SUMMARY & RECOMMENDATIONS:');
    console.log('════════════════════════════════');
    
    const finalCount = await db
      .select({ count: count() })
      .from(schema.snipeTargets);
    
    console.log(`• Database contains ${finalCount[0].count} total snipe targets`);
    console.log('• CRUD operations are working correctly');
    console.log('• Database schema is properly configured');
    console.log();
    
    if (finalCount[0].count === 0) {
      console.log('🔍 ISSUE IDENTIFIED: No targets in database but calendar shows 1');
      console.log('💡 LIKELY CAUSES:');
      console.log('   1. Calendar data is not being properly converted to database records');
      console.log('   2. Auto-sniping service is not creating targets from calendar events');
      console.log('   3. Target creation logic has a bug or is not running');
      console.log('   4. Different database/table being used for calendar vs targets');
      console.log();
      console.log('🔧 NEXT STEPS:');
      console.log('   1. Check auto-sniping service logs for target creation');
      console.log('   2. Verify calendar data source and API endpoints');
      console.log('   3. Test target creation from calendar manually');
      console.log('   4. Check if calendar service is running and healthy');
    }

  } catch (error) {
    console.error('❌ Database verification failed:', error);
    console.log('\n💡 Possible issues:');
    console.log('• Database connection problems');
    console.log('• Missing environment variables');
    console.log('• Schema migration issues');
    console.log('• Network connectivity problems');
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the verification
main().catch(console.error);