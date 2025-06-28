/**
 * Debug script to check why ready targets aren't being processed
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { and, eq, lt, isNull, or } from 'drizzle-orm';

// Import the snipeTargets table from schema
import { snipeTargets } from './src/db/migrations/schema';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function debugReadyTargets() {
  try {
    console.log('🔍 Debugging ready snipe targets...\n');

    // Check all targets first
    const allTargets = await db.select().from(snipeTargets);
    console.log(`📊 Total targets: ${allTargets.length}`);

    // Check specifically ZODI target
    const zodiTarget = allTargets.find(t => t.symbolName === 'ZODI');
    if (zodiTarget) {
      console.log('\n🎯 ZODI Target Details:');
      console.log(`   ID: ${zodiTarget.id}`);
      console.log(`   Status: ${zodiTarget.status}`);
      console.log(`   Target Execution Time: ${zodiTarget.targetExecutionTime}`);
      console.log(`   Created At: ${zodiTarget.createdAt}`);
      console.log(`   Current Time: ${new Date().toISOString()}`);
      
      // Check if execution time condition would pass
      const now = new Date();
      const executionTime = zodiTarget.targetExecutionTime ? new Date(zodiTarget.targetExecutionTime) : null;
      const timeConditionMet = !executionTime || executionTime < now;
      console.log(`   Time condition met: ${timeConditionMet}`);
      
      if (executionTime) {
        const timeDiff = now.getTime() - executionTime.getTime();
        console.log(`   Time difference: ${timeDiff}ms (${Math.round(timeDiff/1000)}s)`);
      }
    }

    // Simulate the exact query from getReadySnipeTargets
    console.log('\n📋 Running exact getReadySnipeTargets query...');
    const now = new Date().toISOString();
    const readyTargets = await db
      .select()
      .from(snipeTargets)
      .where(
        and(
          eq(snipeTargets.status, "ready"),
          or(isNull(snipeTargets.targetExecutionTime), lt(snipeTargets.targetExecutionTime, now))
        )
      )
      .orderBy(snipeTargets.priority, snipeTargets.createdAt)
      .limit(10);

    console.log(`🎯 Ready targets found: ${readyTargets.length}`);
    
    if (readyTargets.length > 0) {
      readyTargets.forEach((target, idx) => {
        console.log(`${idx + 1}. ${target.symbolName} (ID: ${target.id})`);
        console.log(`   Status: ${target.status}`);
        console.log(`   Target Execution Time: ${target.targetExecutionTime}`);
        console.log(`   Priority: ${target.priority}`);
      });
    } else {
      console.log('❌ No ready targets found by the query');
      
      // Let's check all ready status targets without time filtering
      const allReadyTargets = await db
        .select()
        .from(snipeTargets)
        .where(eq(snipeTargets.status, "ready"));
      
      console.log(`\n🔍 All targets with status 'ready': ${allReadyTargets.length}`);
      allReadyTargets.forEach((target, idx) => {
        console.log(`${idx + 1}. ${target.symbolName} (ID: ${target.id})`);
        console.log(`   Target Execution Time: ${target.targetExecutionTime}`);
        const executionTime = target.targetExecutionTime ? new Date(target.targetExecutionTime) : null;
        const timeConditionMet = !executionTime || executionTime < new Date();
        console.log(`   Would pass time condition: ${timeConditionMet}`);
      });
    }

  } catch (error) {
    console.error('❌ Error debugging ready targets:', error);
  } finally {
    await client.end();
  }
}

debugReadyTargets().catch(console.error);