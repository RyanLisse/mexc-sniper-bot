/**
 * Trading Analytics Utilities
 *
 * Helper functions for trading analytics calculations.
 * Extracted from the main route handler for better modularity.
 */

import type { PatternEmbedding, TradeRecord } from "./types";

/**
 * Calculate win/loss ratio from profit and loss arrays
 */
export function calculateWinLossRatio(
  profits: number[],
  losses: number[]
): number {
  const averageProfit =
    profits.reduce((sum, p) => sum + p, 0) / profits.length || 0;
  const averageLoss =
    losses.reduce((sum, l) => sum + l, 0) / losses.length || 0;
  return averageLoss > 0 ? averageProfit / averageLoss : 0;
}

/**
 * Generate mock P&L data for visualization
 */
export function generatePnLData(days: number) {
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    pnl: Math.random() * 1000 - 500, // -500 to +500
  })).reverse();
}

/**
 * Calculate pattern performance based on confidence and success metrics
 */
export function calculatePatternPerformance(
  patternsOfType: PatternEmbedding[],
  patternType: string
) {
  if (patternsOfType.length === 0) {
    return { pattern: patternType, successRate: 0, avgReturn: 0 };
  }

  // Calculate success rate from pattern data
  const successfulPatterns = patternsOfType.filter(
    (p) => p.isActive && (p.truePositives || 0) > 0
  );
  const successRate = (successfulPatterns.length / patternsOfType.length) * 100;

  // Calculate average return based on confidence and success rate
  const avgConfidence =
    patternsOfType.reduce((sum, p) => sum + (p.confidence || 0), 0) /
    patternsOfType.length;
  const baseReturn = (avgConfidence / 100) * (successRate / 100) * 20;

  // Add pattern-specific multipliers
  const patternMultipliers: Record<string, number> = {
    "ready-state": 1.2,
    "volume-surge": 0.9,
    "momentum-shift": 0.7,
  };

  const patternMultiplier = patternMultipliers[patternType] || 1;
  const avgReturn = baseReturn * patternMultiplier;

  return {
    pattern: patternType,
    successRate: Math.round(successRate * 10) / 10,
    avgReturn: Math.round(avgReturn * 10) / 10,
  };
}

/**
 * Filter trades by success criteria
 */
export function filterSuccessfulTrades(trades: TradeRecord[]): TradeRecord[] {
  return trades.filter(
    (t) => t.status === "completed" && (t.profitLoss || 0) > 0
  );
}

/**
 * Calculate total trading volume from trades
 */
export function calculateTradingVolume(trades: TradeRecord[]): number {
  return trades.reduce((sum, t) => sum + (t.buyTotalCost || 0), 0);
}

/**
 * Calculate average trade size
 */
export function calculateAverageTradeSize(trades: TradeRecord[]): number {
  const totalVolume = calculateTradingVolume(trades);
  return trades.length > 0 ? totalVolume / trades.length : 0;
}

/**
 * Separate profits and losses from trades
 */
export function separateProfitsAndLosses(trades: TradeRecord[]) {
  const profits = trades
    .filter((t) => (t.profitLoss || 0) > 0)
    .map((t) => t.profitLoss || 0);
  const losses = trades
    .filter((t) => (t.profitLoss || 0) < 0)
    .map((t) => Math.abs(t.profitLoss || 0));

  return { profits, losses };
}
