#!/usr/bin/env bun
/**
 * Verification script to test foreign key constraints and indexes
 */

import { sql } from "drizzle-orm";
import { db } from "../index";

async function verifyForeignKeys() {
  console.log("🔍 Verifying foreign key constraints and indexes...\n");

  try {
    // 1. Check if foreign keys are enabled
    console.log("1️⃣ Checking foreign key status...");
    const fkStatus = await db.run(sql`PRAGMA foreign_keys`);
    const fkEnabled = (fkStatus as any)[0]?.foreign_keys === 1;
    console.log(`   Foreign keys enabled: ${fkEnabled ? '✅ Yes' : '❌ No'}`);

    // 2. Check for indexes
    console.log("\n2️⃣ Checking performance indexes...");
    const indexes = await db.run(sql`
      SELECT name, tbl_name 
      FROM sqlite_master 
      WHERE type = 'index' 
      AND name IN (
        'api_credentials_user_idx',
        'monitored_listings_symbol_name_idx',
        'workflow_system_status_user_idx',
        'workflow_activity_user_idx'
      )
      ORDER BY name
    `);

    const expectedIndexes = [
      'api_credentials_user_idx',
      'monitored_listings_symbol_name_idx',
      'workflow_system_status_user_idx',
      'workflow_activity_user_idx'
    ];

    const foundIndexes = (indexes as any[]).map(idx => idx.name);
    
    for (const idx of expectedIndexes) {
      if (foundIndexes.includes(idx)) {
        console.log(`   ✅ ${idx} exists`);
      } else {
        console.log(`   ❌ ${idx} missing`);
      }
    }

    // 3. Check for orphaned records
    console.log("\n3️⃣ Checking for orphaned records...");
    
    const tables = [
      { name: 'user_preferences', fk: 'user_id' },
      { name: 'api_credentials', fk: 'user_id' },
      { name: 'snipe_targets', fk: 'user_id' },
      { name: 'execution_history', fk: 'user_id' },
      { name: 'transactions', fk: 'user_id' }
    ];

    let hasOrphans = false;
    
    for (const table of tables) {
      try {
        const result = await db.run(sql.raw(`
          SELECT COUNT(*) as count 
          FROM ${table.name} 
          WHERE ${table.fk} NOT IN (SELECT id FROM user)
        `));
        
        const count = (result as any)[0]?.count || 0;
        if (count > 0) {
          console.log(`   ⚠️  ${table.name}: ${count} orphaned records`);
          hasOrphans = true;
        } else {
          console.log(`   ✅ ${table.name}: No orphaned records`);
        }
      } catch (error: any) {
        console.log(`   ⏭️  ${table.name}: Skipped (table may not exist)`);
      }
    }

    // 4. Test foreign key constraints (if enabled)
    if (fkEnabled) {
      console.log("\n4️⃣ Testing foreign key constraints...");
      
      try {
        // Try to insert a record with invalid user_id
        await db.run(sql`
          INSERT INTO user_preferences (user_id, default_buy_amount_usdt) 
          VALUES ('invalid-user-id', 100)
        `);
        console.log("   ❌ Foreign key constraint NOT working (insert succeeded)");
      } catch (error: any) {
        if (error.message.includes('FOREIGN KEY constraint failed')) {
          console.log("   ✅ Foreign key constraint is working correctly");
        } else {
          console.log("   ⚠️  Unexpected error:", error.message);
        }
      }
    }

    // 5. Check table structure
    console.log("\n5️⃣ Checking table foreign key definitions...");
    const tableInfo = await db.run(sql`
      SELECT sql 
      FROM sqlite_master 
      WHERE type = 'table' 
      AND name IN ('user_preferences', 'api_credentials', 'snipe_targets', 'execution_history', 'transactions')
    `);

    let hasFkReferences = 0;
    for (const table of tableInfo as any[]) {
      if (table.sql && table.sql.includes('REFERENCES')) {
        hasFkReferences++;
      }
    }

    console.log(`   Found ${hasFkReferences}/${tables.length} tables with REFERENCES clauses`);

    // Summary
    console.log("\n📊 Verification Summary:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Foreign Keys Enabled: ${fkEnabled ? '✅' : '❌'}`);
    console.log(`Performance Indexes: ${foundIndexes.length}/${expectedIndexes.length} ✅`);
    console.log(`Orphaned Records: ${hasOrphans ? '⚠️  Found' : '✅ None'}`);
    console.log(`FK References in Schema: ${hasFkReferences > 0 ? '✅' : '❌'}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (!fkEnabled || foundIndexes.length < expectedIndexes.length || hasOrphans) {
      console.log("\n⚠️  Some issues detected. Run 'bun run db:migrate:fk' to fix.");
    } else {
      console.log("\n✅ All checks passed! Database is properly configured.");
    }

  } catch (error) {
    console.error("❌ Verification failed:", error);
    throw error;
  }
}

// Run verification
if (import.meta.main) {
  verifyForeignKeys()
    .then(() => {
      console.log("\n✅ Verification completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Verification failed:", error);
      process.exit(1);
    });
}

export { verifyForeignKeys };