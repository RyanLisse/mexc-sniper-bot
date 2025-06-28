#!/usr/bin/env bun

/**
 * Simple Account Summary
 *
 * Shows basic account information without requiring database tables that may not exist
 */

import { db } from "@/src/db";
import { snipeTargets } from "@/src/db/schemas/trading";

async function main() {
  try {
    console.log("📊 ACCOUNT SUMMARY");
    console.log("==================\n");

    // API Balance (from previous call)
    const balanceData = {
      balances: [
        {
          asset: "USDT",
          free: "21.83651599",
          locked: "0",
          total: 21.83651599,
          usdtValue: 21.83651599,
        },
        {
          asset: "SOL",
          free: "0.007732322",
          locked: "0",
          total: 0.007732322,
          usdtValue: 1.1269859315,
        },
        { asset: "YIEL", free: "0", locked: "1000", total: 1000, usdtValue: 0.1 },
        { asset: "UPTOP", free: "3", locked: "0", total: 3, usdtValue: 0.09759000000000001 },
      ],
      totalUsdtValue: 23.1610919215,
      lastUpdated: "2025-06-28T07:49:48.045Z",
    };

    console.log("💰 CURRENT ACCOUNT BALANCE:");
    console.log("============================");
    console.log(`🏦 Total Account Value: $${balanceData.totalUsdtValue.toFixed(2)} USDT`);
    console.log(`🕐 Last Updated: ${new Date(balanceData.lastUpdated).toLocaleString()}\n`);

    console.log("💱 Asset Breakdown:");
    balanceData.balances.forEach((balance, index) => {
      console.log(`${index + 1}. ${balance.asset}:`);
      console.log(`   💳 Free: ${balance.free}`);
      console.log(`   🔒 Locked: ${balance.locked}`);
      console.log(`   📊 Total: ${balance.total}`);
      console.log(`   💵 USD Value: $${balance.usdtValue.toFixed(4)}`);
      console.log("");
    });

    // Get pending targets from database
    console.log("🎯 SNIPE TARGETS:");
    console.log("==================");

    const allTargets = await db
      .select()
      .from(snipeTargets)
      .orderBy(snipeTargets.priority, snipeTargets.createdAt);

    if (allTargets.length === 0) {
      console.log("❌ No snipe targets found");
    } else {
      const pendingTargets = allTargets.filter((t: any) => t.status === "pending");
      const readyTargets = allTargets.filter((t: any) => t.status === "ready");
      const completedTargets = allTargets.filter((t: any) => t.status === "completed");

      console.log(`📋 Total Targets: ${allTargets.length}`);
      console.log(`⏳ Pending: ${pendingTargets.length}`);
      console.log(`✅ Ready: ${readyTargets.length}`);
      console.log(`🎉 Completed: ${completedTargets.length}\n`);

      if (pendingTargets.length > 0) {
        console.log("⏳ PENDING TARGETS:");
        pendingTargets.slice(0, 5).forEach((target: any, index: number) => {
          console.log(`${index + 1}. ${target.symbolName}`);
          console.log(`   📊 Confidence: ${target.confidenceScore}%`);
          console.log(`   💰 Position Size: $${target.positionSizeUsdt} USDT`);
          console.log(`   📅 Created: ${target.createdAt.toLocaleString()}`);
          console.log(`   ⚡ Priority: ${target.priority}`);
          console.log("");
        });
      }

      if (readyTargets.length > 0) {
        console.log("✅ READY TARGETS:");
        readyTargets.forEach((target: any, index: number) => {
          console.log(`${index + 1}. ${target.symbolName}`);
          console.log(`   📊 Confidence: ${target.confidenceScore}%`);
          console.log(`   💰 Position Size: $${target.positionSizeUsdt} USDT`);
          console.log(
            `   🎯 Target Time: ${target.targetExecutionTime?.toLocaleString() || "Immediate"}`
          );
          console.log(`   ⚡ Priority: ${target.priority}`);
          console.log("");
        });
      }

      // Calculate total allocation
      const totalAllocation = allTargets
        .filter((t: any) => t.status === "pending" || t.status === "ready")
        .reduce((sum: any, target: any) => sum + target.positionSizeUsdt, 0);

      console.log("💹 ALLOCATION SUMMARY:");
      console.log("======================");
      console.log(`🎯 Total Target Allocation: $${totalAllocation.toFixed(2)} USDT`);
      console.log(`💰 Available Balance: $${balanceData.totalUsdtValue.toFixed(2)} USDT`);
      console.log(
        `📊 Allocation vs Balance: ${((totalAllocation / balanceData.totalUsdtValue) * 100).toFixed(1)}%`
      );

      if (totalAllocation > balanceData.totalUsdtValue) {
        console.log(
          `⚠️  WARNING: Target allocation (${totalAllocation.toFixed(2)}) exceeds available balance (${balanceData.totalUsdtValue.toFixed(2)})`
        );
      } else {
        console.log(`✅ Sufficient balance for all targets`);
      }
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    process.exit(0);
  }
}

// Run the main function
main();
