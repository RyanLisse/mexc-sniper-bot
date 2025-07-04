/**
 * Portfolio Metrics Service
 *
 * Handles calculation of portfolio performance metrics.
 * Extracted from the main route handler for better modularity.
 */

import { desc } from "drizzle-orm";
import { db } from "@/src/db";
import { positionSnapshots } from "@/src/db/schema";
import type { PortfolioSnapshot } from "../types";

export async function getPortfolioMetrics() {
  try {
    const recentPortfolio = await db
      .select()
      .from(positionSnapshots)
      .orderBy(desc(positionSnapshots.timestamp))
      .limit(30);

    const current = recentPortfolio[0];
    const dayAgo = recentPortfolio.find(
      (p: PortfolioSnapshot) =>
        new Date(p.timestamp).getTime() < Date.now() - 24 * 60 * 60 * 1000
    );
    const weekAgo = recentPortfolio.find(
      (p: PortfolioSnapshot) =>
        new Date(p.timestamp).getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000
    );

    const currentValue = current?.totalBalance || 10000;
    const dayChange = dayAgo
      ? ((currentValue - (dayAgo.totalBalance || 10000)) /
          (dayAgo.totalBalance || 10000)) *
        100
      : 0;
    const weekChange = weekAgo
      ? ((currentValue - (weekAgo.totalBalance || 10000)) /
          (weekAgo.totalBalance || 10000)) *
        100
      : 0;

    return {
      currentValue,
      totalReturn: currentValue - 10000, // Assuming 10k initial
      returnPercentage: ((currentValue - 10000) / 10000) * 100,
      dayChange,
      weekChange,
      monthChange: Math.random() * 20 - 10, // -10% to +10% mock
      allocations: [
        { asset: "BTC", percentage: 30, value: currentValue * 0.3 },
        { asset: "ETH", percentage: 25, value: currentValue * 0.25 },
        { asset: "USDT", percentage: 20, value: currentValue * 0.2 },
        { asset: "Others", percentage: 25, value: currentValue * 0.25 },
      ],
      topPerformers: [
        { symbol: "BTCUSDT", return: 15.2 },
        { symbol: "ETHUSDT", return: 12.1 },
        { symbol: "ADAUSDT", return: 8.7 },
      ],
      riskAdjustedReturn: Math.random() * 0.8 + 0.2, // 0.2-1.0 mock
      beta: Math.random() * 0.5 + 0.8, // 0.8-1.3 mock
      volatility: Math.random() * 20 + 10, // 10-30% mock
    };
  } catch (error) {
    console.error("Error calculating portfolio metrics:", { error });
    return {
      currentValue: 10000,
      totalReturn: 0,
      returnPercentage: 0,
      dayChange: 0,
      weekChange: 0,
      monthChange: 0,
      allocations: [],
      topPerformers: [],
      riskAdjustedReturn: 0,
      beta: 1,
      volatility: 15,
    };
  }
}
