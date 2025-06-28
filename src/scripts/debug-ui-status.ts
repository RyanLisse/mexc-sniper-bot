#!/usr/bin/env bun

/**
 * Debug UI Status
 *
 * Checks actual database data vs what the API returns to debug UI display issues
 */

import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { snipeTargets } from "@/src/db/schemas/trading";

async function main() {
  try {
    console.log("🔍 DEBUG: UI Status Check");
    console.log("==========================\n");

    // Get ALL targets from database (no filters)
    const allTargetsRaw = await db.select().from(snipeTargets).orderBy(snipeTargets.createdAt);

    console.log("📊 ALL TARGETS IN DATABASE:");
    console.log("============================");
    console.log(`Total targets found: ${allTargetsRaw.length}\n`);

    if (allTargetsRaw.length === 0) {
      console.log("❌ No targets found in database at all");
      return;
    }

    // Show each target with its exact details
    allTargetsRaw.forEach((target, index) => {
      console.log(`${index + 1}. Target Details:`);
      console.log(`   🏷️  ID: ${target.id}`);
      console.log(`   👤 User ID: "${target.userId}"`);
      console.log(`   🎯 Symbol: ${target.symbolName}`);
      console.log(`   📊 Status: "${target.status}"`);
      console.log(`   💰 Position: $${target.positionSizeUsdt} USDT`);
      console.log(`   📈 Confidence: ${target.confidenceScore}%`);
      console.log(`   ⚡ Priority: ${target.priority}`);
      console.log(`   📅 Created: ${target.createdAt.toISOString()}`);
      console.log(`   🕐 Target Time: ${target.targetExecutionTime?.toISOString() || "N/A"}`);
      console.log("");
    });

    // Check specific user ID queries
    const userIds = [...new Set(allTargetsRaw.map((t) => t.userId))];
    console.log("👥 UNIQUE USER IDS FOUND:");
    console.log("=========================");
    userIds.forEach((userId, index) => {
      console.log(`${index + 1}. "${userId}"`);
    });
    console.log("");

    // Test API filtering for each user ID
    console.log("🔍 API FILTERING TEST:");
    console.log("======================");

    for (const userId of userIds) {
      const userTargets = await db
        .select()
        .from(snipeTargets)
        .where(eq(snipeTargets.userId, userId));

      console.log(`User ID "${userId}": ${userTargets.length} targets`);
      userTargets.forEach((target, index) => {
        console.log(`  ${index + 1}. ${target.symbolName} (${target.status})`);
      });
    }

    // Test the specific "default-user" query
    console.log("\n🎯 DEFAULT-USER QUERY TEST:");
    console.log("============================");
    const defaultUserTargets = await db
      .select()
      .from(snipeTargets)
      .where(eq(snipeTargets.userId, "default-user"));

    console.log(`Targets for "default-user": ${defaultUserTargets.length}`);
    if (defaultUserTargets.length === 0) {
      console.log(
        "❌ No targets found for 'default-user' - this explains why API returns empty array"
      );
      console.log(
        "💡 The API is working correctly, but the user ID filter doesn't match database records"
      );
    }

    // Status breakdown
    console.log("\n📋 STATUS BREAKDOWN:");
    console.log("====================");
    const statuses = [...new Set(allTargetsRaw.map((t) => t.status))];
    statuses.forEach((status) => {
      const count = allTargetsRaw.filter((t) => t.status === status).length;
      console.log(`${status}: ${count} targets`);
    });

    // Check what should be "ready" vs "buyable"
    console.log("\n🚦 EXECUTION READINESS:");
    console.log("========================");

    const readyTargets = allTargetsRaw.filter((t) => t.status === "ready");
    const pendingTargets = allTargetsRaw.filter((t) => t.status === "pending");

    console.log(`✅ Ready for execution: ${readyTargets.length}`);
    console.log(`⏳ Pending (needs trigger): ${pendingTargets.length}`);

    if (readyTargets.length > 0) {
      console.log("\n✅ READY TARGETS (should be buyable):");
      readyTargets.forEach((target, index) => {
        console.log(`${index + 1}. ${target.symbolName}`);
        console.log(`   👤 User: "${target.userId}"`);
        console.log(`   💰 Amount: $${target.positionSizeUsdt}`);
        console.log(`   📊 Confidence: ${target.confidenceScore}%`);
        console.log(
          `   🕐 Target Time: ${target.targetExecutionTime?.toISOString() || "Immediate"}`
        );
      });
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    process.exit(0);
  }
}

if (import.meta.main) {
  main();
}
