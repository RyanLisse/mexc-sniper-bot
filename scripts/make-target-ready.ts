import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { snipeTargets } from "../src/db/schemas/trading";

async function makeTargetReady() {
  console.log("🎯 Making a target ready for sniping...");
  
  try {
    // Get all pending targets
    const pendingTargets = await db
      .select()
      .from(snipeTargets)
      .where(eq(snipeTargets.status, "pending"));
      
    if (pendingTargets.length === 0) {
      console.log("❌ No pending targets found");
      return;
    }
    
    console.log(`📋 Found ${pendingTargets.length} pending targets:`);
    pendingTargets.forEach((target: any, index: number) => {
      console.log(`   ${index + 1}. ${target.symbolName} (ID: ${target.id})`);
    });
    
    // Make the first target ready
    const targetToUpdate = pendingTargets[0];
    console.log(`\n✅ Making ${targetToUpdate.symbolName} ready for sniping...`);
    
    await db
      .update(snipeTargets)
      .set({
        status: "ready",
        targetExecutionTime: new Date(), // Execute immediately
        updatedAt: new Date(),
      })
      .where(eq(snipeTargets.id, targetToUpdate.id));
    
    console.log(`🚀 Target ${targetToUpdate.symbolName} is now ready for auto-sniping!`);
    console.log(`   ID: ${targetToUpdate.id}`);
    console.log(`   Symbol: ${targetToUpdate.symbolName}`);
    console.log(`   Confidence: ${targetToUpdate.confidenceScore}%`);
    console.log(`   Position Size: ${targetToUpdate.positionSizeUsdt} USDT`);
    
    // Verify the update
    const updatedTarget = await db
      .select()
      .from(snipeTargets)
      .where(eq(snipeTargets.id, targetToUpdate.id));
      
    if (updatedTarget.length > 0 && updatedTarget[0].status === "ready") {
      console.log("✅ Target status confirmed as 'ready'");
    } else {
      console.log("❌ Failed to update target status");
    }
    
  } catch (error) {
    console.error("💥 Failed to make target ready:", error);
  }
}

// Run the script
makeTargetReady().then(() => {
  console.log("\n✅ Script complete");
  process.exit(0);
}).catch((error) => {
  console.error("💥 Script failed:", error);
  process.exit(1);
});