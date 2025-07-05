#!/usr/bin/env bun

/**
 * Check Account Data Script
 *
 * Retrieves account balance, active snipe targets, and calculates account value
 */

import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/src/db";
import {
  balanceSnapshots,
  portfolioSummary,
} from "@/src/db/schemas/supabase-trading";
import { snipeTargets } from "@/src/db/schemas/supabase-auth";

async function main() {
  try {
    console.log("🔍 Checking Account Data...\n");

    // Get today and tomorrow dates
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const tomorrowEnd = new Date(
      tomorrow.getFullYear(),
      tomorrow.getMonth(),
      tomorrow.getDate(),
      23,
      59,
      59
    );

    console.log(
      `📅 Date Range: ${todayStart.toISOString()} to ${tomorrowEnd.toISOString()}\n`
    );

    // 1. Check active snipe targets for today and tomorrow
    console.log("🎯 ACTIVE SNIPE TARGETS:");
    console.log("========================");

    const activeTargets = await db
      .select()
      .from(snipeTargets)
      .where(
        and(
          eq(snipeTargets.status, "ready"),
          gte(snipeTargets.targetExecutionTime, todayStart),
          lte(snipeTargets.targetExecutionTime, tomorrowEnd)
        )
      )
      .orderBy(snipeTargets.priority, snipeTargets.targetExecutionTime);

    if (activeTargets.length === 0) {
      console.log("❌ No active snipe targets found for today and tomorrow");
    } else {
      console.log(`✅ Found ${activeTargets.length} active snipe targets:`);
      activeTargets.forEach((target: any, index: number) => {
        console.log(`\n${index + 1}. ${target.symbolName}`);
        console.log(`   📊 Confidence: ${target.confidenceScore}%`);
        console.log(`   💰 Position Size: $${target.positionSizeUsdt} USDT`);
        console.log(
          `   🎯 Target Time: ${target.targetExecutionTime?.toISOString()}`
        );
        console.log(`   ⚡ Priority: ${target.priority}`);
        console.log(`   📋 Status: ${target.status}`);
        console.log(`   🎚️ Risk Level: ${target.riskLevel}`);
      });
    }

    // 2. Check all pending targets (not just today/tomorrow)
    console.log("\n\n📋 ALL PENDING TARGETS:");
    console.log("=======================");

    const allPendingTargets = await db
      .select()
      .from(snipeTargets)
      .where(eq(snipeTargets.status, "pending"))
      .orderBy(snipeTargets.priority, snipeTargets.createdAt);

    if (allPendingTargets.length === 0) {
      console.log("❌ No pending snipe targets found");
    } else {
      console.log(
        `✅ Found ${allPendingTargets.length} pending snipe targets:`
      );
      allPendingTargets.slice(0, 10).forEach((target: any, index: number) => {
        console.log(`\n${index + 1}. ${target.symbolName}`);
        console.log(`   📊 Confidence: ${target.confidenceScore}%`);
        console.log(`   💰 Position Size: $${target.positionSizeUsdt} USDT`);
        console.log(`   📅 Created: ${target.createdAt.toISOString()}`);
        console.log(`   ⚡ Priority: ${target.priority}`);
      });

      if (allPendingTargets.length > 10) {
        console.log(
          `\n... and ${allPendingTargets.length - 10} more pending targets`
        );
      }
    }

    // 3. Check latest balance snapshots
    console.log("\n\n💼 ACCOUNT BALANCE:");
    console.log("===================");

    const latestBalances = await db
      .select()
      .from(balanceSnapshots)
      .where(eq(balanceSnapshots.userId, "default-user"))
      .orderBy(balanceSnapshots.timestamp)
      .limit(20);

    let totalUsdValue = 0;

    if (latestBalances.length === 0) {
      console.log("❌ No balance snapshots found");
    } else {
      console.log(`✅ Found ${latestBalances.length} balance entries:`);
      const assetSummary: Record<string, { amount: number; usdValue: number }> =
        {};

      latestBalances.forEach((balance: any) => {
        const asset = balance.asset;
        if (!assetSummary[asset]) {
          assetSummary[asset] = { amount: 0, usdValue: 0 };
        }
        assetSummary[asset].amount += balance.totalAmount;
        assetSummary[asset].usdValue += balance.usdValue;
        totalUsdValue += balance.usdValue;
      });

      console.log(
        `\n💰 Total Portfolio Value: $${totalUsdValue.toFixed(2)} USD`
      );
      console.log("\n📊 Asset Breakdown:");
      Object.entries(assetSummary).forEach(([asset, data]) => {
        console.log(
          `   ${asset}: ${data.amount.toFixed(6)} ($${data.usdValue.toFixed(2)})`
        );
      });
    }

    // 4. Check portfolio summary
    console.log("\n\n📈 PORTFOLIO SUMMARY:");
    console.log("=====================");

    const portfolioData = await db
      .select()
      .from(portfolioSummary)
      .where(eq(portfolioSummary.userId, "default-user"))
      .orderBy(portfolioSummary.lastCalculated)
      .limit(1);

    if (portfolioData.length === 0) {
      console.log("❌ No portfolio summary found");
    } else {
      const portfolio = portfolioData[0];
      console.log(`✅ Portfolio Summary:`);
      console.log(
        `   💰 Total Value: $${portfolio.totalUsdValue.toFixed(2)} USD`
      );
      console.log(`   📊 Asset Count: ${portfolio.assetCount}`);
      console.log(
        `   📈 24h Performance: ${portfolio.performance24h?.toFixed(2) || "N/A"}%`
      );
      console.log(
        `   📈 7d Performance: ${portfolio.performance7d?.toFixed(2) || "N/A"}%`
      );
      console.log(
        `   📈 30d Performance: ${portfolio.performance30d?.toFixed(2) || "N/A"}%`
      );
      console.log(
        `   🕐 Last Updated: ${portfolio.lastBalanceUpdate.toISOString()}`
      );

      if (portfolio.topAssets) {
        console.log(`   🏆 Top Assets: ${portfolio.topAssets}`);
      }
    }

    // 5. Summary
    console.log("\n\n📋 SUMMARY:");
    console.log("===========");
    console.log(`🎯 Active targets (today/tomorrow): ${activeTargets.length}`);
    console.log(`📋 Total pending targets: ${allPendingTargets.length}`);
    console.log(`💼 Balance entries found: ${latestBalances.length}`);
    console.log(`💰 Estimated total value: $${totalUsdValue.toFixed(2)} USD`);

    const totalTargetValue = [...activeTargets, ...allPendingTargets].reduce(
      (sum, target) => sum + target.positionSizeUsdt,
      0
    );
    console.log(
      `🎯 Total target allocation: $${totalTargetValue.toFixed(2)} USDT`
    );
  } catch (error) {
    console.error("❌ Error checking account data:", error);
  } finally {
    process.exit(0);
  }
}

// Run the main function
main();
