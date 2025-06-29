import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "./src/db";
import { snipeTargets } from "./src/db/schemas/trading";
import { getCoreTrading } from "./src/services/trading/consolidated/core-trading/base-service";

async function testAutoSnipingWorkflow() {
  console.log("🔍 Testing Auto-Sniping Workflow");
  console.log("=".repeat(60));
  
  const coreTrading = getCoreTrading();
  
  try {
    // 1. Check if service is initialized
    console.log("\n1️⃣ Checking service initialization...");
    let serviceStatus;
    try {
      serviceStatus = await coreTrading.getServiceStatus();
      console.log("✅ Service is initialized");
    } catch (error) {
      if (error instanceof Error && error.message.includes('not initialized')) {
        console.log("⚠️ Service not initialized. Initializing...");
        await coreTrading.initialize();
        serviceStatus = await coreTrading.getServiceStatus();
        console.log("✅ Service initialized successfully");
      } else {
        throw error;
      }
    }
    
    // 2. Check current configuration
    console.log("\n2️⃣ Checking auto-sniping configuration...");
    console.log(`   autoSnipingEnabled: ${serviceStatus.autoSnipingEnabled}`);
    console.log(`   paperTradingMode: ${serviceStatus.paperTradingMode}`);
    console.log(`   tradingEnabled: ${serviceStatus.tradingEnabled}`);
    console.log(`   circuitBreakerOpen: ${serviceStatus.circuitBreakerOpen}`);
    
    // 3. Check snipe targets in database
    console.log("\n3️⃣ Checking snipe targets in database...");
    const allTargets = await db.select().from(snipeTargets);
    console.log(`   Total targets: ${allTargets.length}`);
    
    // Get ready targets (fix the query syntax)
    const now = new Date();
    const readyTargets = await db
      .select()
      .from(snipeTargets)
      .where(
        and(
          eq(snipeTargets.status, "ready"),
          or(
            isNull(snipeTargets.targetExecutionTime),
            lt(snipeTargets.targetExecutionTime, now)
          )
        )
      );
    
    console.log(`   Ready targets: ${readyTargets.length}`);
    
    if (readyTargets.length > 0) {
      console.log("   Ready targets details:");
      readyTargets.forEach((target, index) => {
        console.log(`     ${index + 1}. ${target.symbolName} - Confidence: ${target.confidenceScore}%`);
      });
    }
    
    // 4. Check if auto-sniping is currently running
    console.log("\n4️⃣ Checking auto-sniping execution status...");
    if (!serviceStatus.autoSnipingEnabled) {
      console.log("❌ Auto-sniping is not enabled! Starting it...");
      
      // Enable auto-sniping in configuration
      await coreTrading.updateConfig({ 
        autoSnipingEnabled: true,
        confidenceThreshold: 75, // Default threshold
        snipeCheckInterval: 30000, // 30 seconds
      });
      
      // Start auto-sniping
      const startResult = await coreTrading.startAutoSniping();
      if (startResult.success) {
        console.log("✅ Auto-sniping started successfully");
      } else {
        console.log(`❌ Failed to start auto-sniping: ${startResult.error}`);
      }
    } else {
      console.log("✅ Auto-sniping is enabled");
    }
    
    // 5. Get final status
    console.log("\n5️⃣ Final status check...");
    const finalStatus = await coreTrading.getServiceStatus();
    console.log(`   autoSnipingEnabled: ${finalStatus.autoSnipingEnabled}`);
    console.log(`   activePositions: ${finalStatus.activePositions}`);
    console.log(`   paperTradingMode: ${finalStatus.paperTradingMode}`);
    
    // 6. Test manual target processing
    if (readyTargets.length > 0) {
      console.log("\n6️⃣ Testing manual target processing...");
      try {
        // This would trigger the processSnipeTargets method
        console.log("   Manually processing targets...");
        // We need to access the auto-sniping module to test this
        console.log("   ⚠️ Manual processing test requires module access");
      } catch (error) {
        console.log(`   ❌ Manual processing failed: ${error}`);
      }
    }
    
    // 7. Environment and API check
    console.log("\n7️⃣ Environment and API configuration...");
    const hasApiKey = !!process.env.MEXC_API_KEY;
    const hasSecretKey = !!process.env.MEXC_SECRET_KEY;
    console.log(`   MEXC_API_KEY: ${hasApiKey ? '✅ Present' : '❌ Missing'}`);
    console.log(`   MEXC_SECRET_KEY: ${hasSecretKey ? '✅ Present' : '❌ Missing'}`);
    
    if (!hasApiKey || !hasSecretKey) {
      console.log("   ⚠️ Missing API credentials - trading will fail!");
    }
    
    // 8. Summary and recommendations
    console.log("\n🏁 WORKFLOW ANALYSIS SUMMARY");
    console.log("=".repeat(60));
    
    const issues = [];
    const recommendations = [];
    
    if (!finalStatus.autoSnipingEnabled) {
      issues.push("Auto-sniping is not enabled");
      recommendations.push("Enable auto-sniping via API or configuration");
    }
    
    if (readyTargets.length === 0) {
      issues.push("No ready targets to process");
      recommendations.push("Ensure targets are being created and marked as 'ready'");
    }
    
    if (!hasApiKey || !hasSecretKey) {
      issues.push("Missing MEXC API credentials");
      recommendations.push("Set MEXC_API_KEY and MEXC_SECRET_KEY environment variables");
    }
    
    if (finalStatus.circuitBreakerOpen) {
      issues.push("Circuit breaker is open");
      recommendations.push("Check system health and reset circuit breaker if needed");
    }
    
    if (issues.length === 0) {
      console.log("✅ No blocking issues found! Auto-sniping should be working.");
    } else {
      console.log("❌ Issues found:");
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
      
      console.log("\n💡 Recommendations:");
      recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }
    
    console.log(`\nTargets summary: ${allTargets.length} total, ${readyTargets.length} ready`);
    console.log(`Service status: ${finalStatus.autoSnipingEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`Paper trading: ${finalStatus.paperTradingMode ? 'ON' : 'OFF'}`);
    
  } catch (error) {
    console.error("💥 Workflow test failed:", error);
    
    // Try to provide specific troubleshooting
    if (error instanceof Error) {
      if (error.message.includes('database')) {
        console.log("🔧 Database connection issue - check Neon DB configuration");
      } else if (error.message.includes('API')) {
        console.log("🔧 API issue - check MEXC credentials and connectivity");
      } else if (error.message.includes('not initialized')) {
        console.log("🔧 Service initialization issue - restart the application");
      }
    }
  }
}

// Run the workflow test
testAutoSnipingWorkflow().then(() => {
  console.log("\n✅ Workflow test complete");
  process.exit(0);
}).catch((error) => {
  console.error("💥 Workflow test crashed:", error);
  process.exit(1);
});