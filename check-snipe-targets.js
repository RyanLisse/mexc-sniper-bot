/**
 * Check snipe targets in the database
 */
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

import { db } from './src/db/index.js';
import { snipeTargets } from './src/db/schemas/trading.js';

async function checkSnipeTargets() {
  try {
    console.log('🔍 Checking snipe targets in database...');
    
    // Get all snipe targets
    const targets = await db.select().from(snipeTargets).orderBy(snipeTargets.createdAt).limit(10);
    
    console.log(`📊 Found ${targets.length} snipe targets:`);
    
    if (targets.length === 0) {
      console.log('❌ No snipe targets found in database');
      console.log('📝 This explains why no targets are being bought');
    } else {
      targets.forEach((target, index) => {
        console.log(`\n${index + 1}. Target ID: ${target.id}`);
        console.log(`   Symbol: ${target.symbolName}`);
        console.log(`   Status: ${target.status}`);
        console.log(`   Confidence: ${target.confidenceScore}`);
        console.log(`   Priority: ${target.priority}`);
        console.log(`   Created: ${target.createdAt}`);
        console.log(`   Target Execution: ${target.targetExecutionTime || 'Immediate'}`);
        if (target.errorMessage) {
          console.log(`   ❌ Error: ${target.errorMessage}`);
        }
      });
      
      // Check specifically for ready targets
      const readyTargets = targets.filter(t => t.status === 'ready');
      console.log(`\n✅ Ready targets: ${readyTargets.length}`);
      
      // Check for low confidence targets
      const lowConfidenceTargets = targets.filter(t => t.confidenceScore < 70);
      console.log(`⚠️  Low confidence targets (< 70): ${lowConfidenceTargets.length}`);
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    process.exit(0);
  }
}

checkSnipeTargets();