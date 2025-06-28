/**
 * Quick script to check snipe targets in the NeonDB database
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, desc } from 'drizzle-orm';

// Import the snipeTargets table from schema
import { snipeTargets } from './src/db/migrations/schema';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client);

async function checkSnipeTargets() {
  try {
    console.log('🔍 Checking snipe targets in NeonDB PostgreSQL database...\n');

    // Get all snipe targets
    const allTargets = await db.select().from(snipeTargets).orderBy(desc(snipeTargets.id));
    console.log(`📊 Total snipe targets in database: ${allTargets.length}`);
    
    if (allTargets.length === 0) {
      console.log('❌ No snipe targets found in database');
      return;
    }

    // Group by status
    const statusGroups = allTargets.reduce((acc, target) => {
      const status = target.status || 'unknown';
      if (!acc[status]) acc[status] = [];
      acc[status].push(target);
      return acc;
    }, {} as Record<string, typeof allTargets>);

    console.log('\n📈 Targets by status:');
    Object.entries(statusGroups).forEach(([status, targets]) => {
      console.log(`  ${status}: ${targets.length}`);
    });

    // Show pending targets (ready to be sniped)
    const pendingTargets = allTargets.filter(t => t.status === 'pending');
    
    if (pendingTargets.length > 0) {
      console.log(`\n🎯 PENDING TARGETS (${pendingTargets.length}):`);
      pendingTargets.forEach((target, idx) => {
        console.log(`${idx + 1}. ${target.symbolName} (ID: ${target.id})`);
        console.log(`   vcoinId: ${target.vcoinId}`);
        console.log(`   positionSize: ${target.positionSizeUsdt} USDT`);
        console.log(`   entryStrategy: ${target.entryStrategy}`);
        console.log(`   targetExecutionTime: ${target.targetExecutionTime || 'Not set'}`);
        console.log(`   priority: ${target.priority}`);
        console.log(`   retries: ${target.currentRetries}/${target.maxRetries}`);
        console.log('');
      });
    } else {
      console.log('\n❌ No pending targets found');
    }

    // Show recent targets
    console.log('\n🕐 Recent targets (last 5):');
    allTargets.slice(0, 5).forEach((target, idx) => {
      console.log(`${idx + 1}. ${target.symbolName} (${target.status}) - ID: ${target.id}`);
      console.log(`   Created: ${new Date(target.createdAt || '').toLocaleString()}`);
      if (target.actualExecutionTime) {
        console.log(`   Executed: ${new Date(target.actualExecutionTime).toLocaleString()}`);
      }
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error checking snipe targets:', error);
  } finally {
    await client.end();
  }
}

checkSnipeTargets().catch(console.error);