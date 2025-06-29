/**
 * Test manual auto-sniping execution to see what happens when processing targets
 */

import { eq } from "drizzle-orm";
import { getCoreTrading } from "../src/services/trading/consolidated/core-trading/base-service";
import { db } from "./src/db";
import { snipeTargets } from "./src/db/schemas/trading";

async function testManualAutoSniping() {
  console.log('🔬 Testing Manual Auto-Sniping Execution');
  console.log('='.repeat(50));
  
  const coreTrading = getCoreTrading();
  
  try {
    // Initialize if needed
    let status;
    try {
      status = await coreTrading.getServiceStatus();
    } catch (error) {
      if (error instanceof Error && error.message.includes('not initialized')) {
        console.log('⚙️ Initializing service...');
        await coreTrading.initialize();
        status = await coreTrading.getServiceStatus();
      } else {
        throw error;
      }
    }
    
    console.log('📊 Current service status:');
    console.log(`   autoSnipingEnabled: ${status.autoSnipingEnabled}`);
    console.log(`   paperTradingMode: ${status.paperTradingMode}`);
    console.log(`   circuitBreakerOpen: ${status.circuitBreakerOpen}`);
    
    // Enable auto-sniping if not already enabled
    if (!status.autoSnipingEnabled) {
      console.log('🔧 Enabling auto-sniping...');
      await coreTrading.updateConfig({ 
        autoSnipingEnabled: true,
        confidenceThreshold: 75,
        snipeCheckInterval: 30000,
      });
      await coreTrading.startAutoSniping();
      console.log('✅ Auto-sniping enabled');
    }
    
    // Check ZODI target before processing
    console.log('\n🎯 ZODI target status before processing:');
    const zodiTargetBefore = await db
      .select()
      .from(snipeTargets)
      .where(eq(snipeTargets.symbolName, 'ZODI'))
      .limit(1);
    
    if (zodiTargetBefore.length > 0) {
      const target = zodiTargetBefore[0];
      console.log(`   Status: ${target.status}`);
      console.log(`   Confidence: ${target.confidenceScore}%`);
      console.log(`   Error: ${target.errorMessage || 'None'}`);
      console.log(`   Last updated: ${target.updatedAt || 'Never'}`);
    }
    
    // Try to manually trigger auto-sniping processing
    console.log('\n⚡ Manually triggering auto-sniping...');
    try {
      // We need to access the auto-sniping module directly
      // Since we can't access it directly, let's wait for the interval to trigger
      console.log('⏳ Waiting 35 seconds for auto-sniping interval...');
      
      // Wait 35 seconds for the 30-second interval to trigger
      await new Promise(resolve => setTimeout(resolve, 35000));
      
    } catch (error) {
      console.log(`❌ Manual trigger failed: ${error}`);
    }
    
    // Check ZODI target after processing
    console.log('\n🎯 ZODI target status after processing:');
    const zodiTargetAfter = await db
      .select()
      .from(snipeTargets)
      .where(eq(snipeTargets.symbolName, 'ZODI'))
      .limit(1);
    
    if (zodiTargetAfter.length > 0) {
      const target = zodiTargetAfter[0];
      console.log(`   Status: ${target.status}`);
      console.log(`   Confidence: ${target.confidenceScore}%`);
      console.log(`   Error: ${target.errorMessage || 'None'}`);
      console.log(`   Last updated: ${target.updatedAt || 'Never'}`);
      console.log(`   Execution time: ${target.actualExecutionTime || 'Not executed'}`);
      
      // Check if status changed
      if (zodiTargetBefore.length > 0) {
        const statusChanged = zodiTargetBefore[0].status !== target.status;
        const updatedAtChanged = zodiTargetBefore[0].updatedAt !== target.updatedAt;
        
        console.log(`\n📈 Status changed: ${statusChanged ? '✅ YES' : '❌ NO'}`);
        console.log(`📈 Updated time changed: ${updatedAtChanged ? '✅ YES' : '❌ NO'}`);
        
        if (!statusChanged && !updatedAtChanged) {
          console.log('\n❌ Target was not processed. Possible issues:');
          console.log('   • Auto-sniping service not running');
          console.log('   • Safety system blocking execution');
          console.log('   • Configuration issues');
          console.log('   • Error in processing logic');
        } else {
          console.log('\n✅ Target was processed successfully!');
        }
      }
    }
    
    // Get final service status
    console.log('\n📊 Final service status:');
    const finalStatus = await coreTrading.getServiceStatus();
    console.log(`   autoSnipingEnabled: ${finalStatus.autoSnipingEnabled}`);
    console.log(`   activePositions: ${finalStatus.activePositions}`);
    console.log(`   lastProcessed: ${finalStatus.lastActivity || 'Unknown'}`);
    
  } catch (error) {
    console.error('💥 Manual test failed:', error);
    
    if (error instanceof Error) {
      console.log('\n🔧 Error details:');
      console.log(`   Message: ${error.message}`);
      console.log(`   Stack: ${error.stack?.slice(0, 200)}...`);
    }
  }
}

// Run the test
testManualAutoSniping().then(() => {
  console.log('\n✅ Manual test complete');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Manual test crashed:', error);
  process.exit(1);
});