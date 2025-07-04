/**
 * Trading Performance Metrics Service
 *
 * Handles calculation of trading performance metrics.
 * Extracted from the main route handler for better modularity.
 */

import { desc, gte } from "drizzle-orm";
import { db } from "@/src/db";
import { transactions } from "@/src/db/schema";
import type { TradeRecord } from "../types";
import {
  calculateAverageTradeSize,
  calculateTradingVolume,
  calculateWinLossRatio,
  filterSuccessfulTrades,
  separateProfitsAndLosses,
} from "../utils";

export async function getTradingPerformanceMetrics() {
  try {
    const trades = await db
      .select()
      .from(transactions)
      .where(
        gte(
          transactions.createdAt,
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        )
      )
      .orderBy(desc(transactions.createdAt));

    const totalTrades = trades.length;
    const successfulTrades = filterSuccessfulTrades(trades as TradeRecord[]);
    const successRate =
      totalTrades > 0 ? (successfulTrades.length / totalTrades) * 100 : 0;

    const averageTradeSize = calculateAverageTradeSize(trades as TradeRecord[]);
    const tradingVolume = calculateTradingVolume(trades as TradeRecord[]);

    const { profits, losses } = separateProfitsAndLosses(
      trades as TradeRecord[]
    );
    const winLossRatio = calculateWinLossRatio(profits, losses);

    return {
      totalTrades,
      successfulTrades: successfulTrades.length,
      successRate,
      averageTradeSize,
      averageHoldTime: Math.random() * 24 + 6, // 6-30 hours mock
      tradingVolume,
      winLossRatio,
      sharpeRatio: Math.random() * 1.5 + 0.5, // 0.5-2.0 mock
      maxDrawdown: Math.random() * 15 + 5, // 5-20% mock
      profitFactor: winLossRatio > 0 ? winLossRatio * 1.2 : 1.0,
    };
  } catch (error) {
    console.error("Error calculating trading performance:", { error });
    return {
      totalTrades: 0,
      successfulTrades: 0,
      successRate: 0,
      averageTradeSize: 0,
      averageHoldTime: 0,
      tradingVolume: 0,
      winLossRatio: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      profitFactor: 0,
    };
  }
}
