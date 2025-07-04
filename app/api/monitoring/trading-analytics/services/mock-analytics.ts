/**
 * Mock Analytics Services
 *
 * Provides mock data for various analytics functions.
 * Extracted from the main route handler for better modularity.
 */

import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { snipeTargets } from "@/src/db/schema";
import type { SnipeTarget } from "../types";
import { generatePnLData } from "../utils";

export async function getRiskMetrics() {
  // Mock comprehensive risk metrics
  return {
    currentRiskScore: Math.random() * 40 + 30, // 30-70 risk score
    portfolioVaR: Math.random() * 5 + 2, // 2-7% Value at Risk
    maxPositionSize: 0.1, // 10% max position
    diversificationRatio: Math.random() * 0.3 + 0.7, // 0.7-1.0
    correlationMatrix: [
      { pair: "BTC-ETH", correlation: 0.85 },
      { pair: "BTC-ALT", correlation: 0.72 },
      { pair: "ETH-ALT", correlation: 0.68 },
    ],
    stressTestResults: {
      marketCrash: { impact: -15.2, recovery: "3-5 days" },
      flashCrash: { impact: -8.7, recovery: "1-2 hours" },
      liquidityStress: { impact: -5.3, recovery: "30-60 minutes" },
    },
    riskLimits: {
      dailyLoss: { limit: 5, current: 1.2 },
      maxDrawdown: { limit: 15, current: 3.8 },
      concentration: { limit: 25, current: 18.5 },
    },
    exposureMetrics: {
      totalExposure: Math.random() * 50000 + 25000,
      leverageRatio: Math.random() * 2 + 1,
      marginUtilization: Math.random() * 60 + 20,
    },
    circuitBreakerStatus: {
      active: Math.random() > 0.9,
      lastTriggered: new Date(
        Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
      ).toISOString(),
      triggerCount: Math.floor(Math.random() * 3),
    },
  };
}

export async function getPositionAnalytics() {
  try {
    const activeTargets = await db
      .select()
      .from(snipeTargets)
      .where(eq(snipeTargets.status, "active"));

    return {
      activePositions: activeTargets.length,
      positionSizes: activeTargets.map((t: SnipeTarget) => ({
        symbol: t.symbolName,
        size: t.positionSizeUsdt || 0,
        percentage: Math.random() * 10 + 2, // 2-12% mock
      })),
      positionDurations: activeTargets.map((t: SnipeTarget) => ({
        symbol: t.symbolName,
        duration: Math.floor(
          (Date.now() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60)
        ), // hours
      })),
      sectorExposure: [
        { sector: "DeFi", exposure: 35 },
        { sector: "Layer 1", exposure: 28 },
        { sector: "NFT/Gaming", exposure: 15 },
        { sector: "Infrastructure", exposure: 22 },
      ],
      leverageMetrics: {
        averageLeverage: Math.random() * 2 + 1,
        maxLeverage: 3,
        leveragedPositions: Math.floor(activeTargets.length * 0.4),
      },
      liquidityMetrics: {
        averageLiquidity: Math.random() * 1000000 + 500000,
        liquidityScore: Math.random() * 30 + 70,
        illiquidPositions: Math.floor(activeTargets.length * 0.1),
      },
      unrealizedPnL: Math.random() * 2000 - 1000, // -1k to +1k mock
      realizedPnL: Math.random() * 5000 - 2500, // -2.5k to +2.5k mock
    };
  } catch (error) {
    console.error("Error calculating position analytics:", { error });
    return {
      activePositions: 0,
      positionSizes: [],
      positionDurations: [],
      sectorExposure: [],
      leverageMetrics: {
        averageLeverage: 1,
        maxLeverage: 3,
        leveragedPositions: 0,
      },
      liquidityMetrics: {
        averageLiquidity: 0,
        liquidityScore: 0,
        illiquidPositions: 0,
      },
      unrealizedPnL: 0,
      realizedPnL: 0,
    };
  }
}

export async function getExecutionAnalytics() {
  // Mock execution analytics
  return {
    orderExecutionSpeed: {
      average: Math.random() * 200 + 50, // 50-250ms
      p95: Math.random() * 500 + 200, // 200-700ms
      p99: Math.random() * 1000 + 500, // 500-1500ms
    },
    slippageMetrics: {
      averageSlippage: Math.random() * 0.5 + 0.1, // 0.1-0.6%
      maxSlippage: Math.random() * 2 + 1, // 1-3%
      slippageDistribution: [
        { range: "0-0.1%", count: 65 },
        { range: "0.1-0.5%", count: 25 },
        { range: "0.5-1%", count: 8 },
        { range: ">1%", count: 2 },
      ],
    },
    fillRates: {
      fullFill: 85,
      partialFill: 12,
      noFill: 3,
    },
    marketImpact: Math.random() * 0.3 + 0.05, // 0.05-0.35%
    executionCosts: {
      tradingFees: Math.random() * 100 + 50,
      slippageCosts: Math.random() * 75 + 25,
      marketImpactCosts: Math.random() * 50 + 10,
    },
    latencyMetrics: {
      orderToExchange: Math.random() * 20 + 5, // 5-25ms
      marketDataLatency: Math.random() * 10 + 2, // 2-12ms
      systemLatency: Math.random() * 5 + 1, // 1-6ms
    },
    orderBookAnalysis: {
      averageSpread: Math.random() * 0.2 + 0.05, // 0.05-0.25%
      bidAskImbalance: Math.random() * 0.4 + 0.3, // 0.3-0.7
      orderBookDepth: Math.random() * 500000 + 100000, // $100k-$600k
    },
  };
}

export async function getProfitLossAnalytics() {
  // Mock P&L analytics
  return {
    dailyPnL: generatePnLData(30),
    weeklyPnL: generatePnLData(12).map((d) => ({ ...d, pnl: d.pnl * 7 })),
    monthlyPnL: generatePnLData(6).map((d) => ({ ...d, pnl: d.pnl * 30 })),
    yearlyPnL: Math.random() * 50000 - 25000, // -25k to +25k
    pnLDistribution: [
      { range: ">$1000", count: 12, percentage: 15 },
      { range: "$500-$1000", count: 18, percentage: 22 },
      { range: "$100-$500", count: 25, percentage: 31 },
      { range: "$0-$100", count: 15, percentage: 19 },
      { range: "<$0", count: 10, percentage: 13 },
    ],
    bestTrades: [
      { symbol: "BTCUSDT", pnl: 2500, date: "2024-01-15", duration: "4h" },
      { symbol: "ETHUSDT", pnl: 1800, date: "2024-01-10", duration: "6h" },
      { symbol: "ADAUSDT", pnl: 1200, date: "2024-01-08", duration: "2h" },
    ],
    worstTrades: [
      { symbol: "SOLUSDT", pnl: -800, date: "2024-01-12", duration: "8h" },
      { symbol: "DOTUSDT", pnl: -600, date: "2024-01-07", duration: "3h" },
      { symbol: "LINKUSDT", pnl: -450, date: "2024-01-05", duration: "5h" },
    ],
    pnLByStrategy: [
      { strategy: "pattern-discovery", pnl: 5200, trades: 45 },
      { strategy: "momentum-trading", pnl: 3100, trades: 32 },
      { strategy: "arbitrage", pnl: 1800, trades: 28 },
    ],
    pnLByTimeframe: [
      { timeframe: "1h", pnl: 2500, trades: 85 },
      { timeframe: "4h", pnl: 4200, trades: 45 },
      { timeframe: "1d", pnl: 3100, trades: 25 },
    ],
  };
}

export async function getMarketAnalytics() {
  // Mock market analytics
  return {
    marketConditions: {
      trend: "bullish",
      volatility: "medium",
      sentiment: "optimistic",
      fearGreedIndex: Math.floor(Math.random() * 40 + 50), // 50-90 (greed)
    },
    correlationToMarket: {
      btcCorrelation: Math.random() * 0.4 + 0.6, // 0.6-1.0
      ethCorrelation: Math.random() * 0.3 + 0.7, // 0.7-1.0
      overallCorrelation: Math.random() * 0.3 + 0.65, // 0.65-0.95
    },
    sectorPerformance: [
      { sector: "DeFi", performance: 8.5, trend: "up" },
      { sector: "Layer 1", performance: 12.2, trend: "up" },
      { sector: "NFT/Gaming", performance: -2.1, trend: "down" },
      { sector: "Infrastructure", performance: 5.7, trend: "up" },
    ],
    volatilityIndex: Math.random() * 30 + 20, // 20-50 VIX equivalent
    marketSentiment: {
      social: "positive",
      news: "neutral",
      technical: "bullish",
      onChain: "positive",
    },
    tradingOpportunities: [
      { symbol: "NEWCOIN1USDT", confidence: 85, type: "breakout" },
      { symbol: "NEWCOIN2USDT", confidence: 78, type: "momentum" },
      { symbol: "NEWCOIN3USDT", confidence: 72, type: "pattern" },
    ],
    marketTrends: [
      { trend: "AI tokens surge", impact: "high", timeframe: "short" },
      { trend: "DeFi resurgence", impact: "medium", timeframe: "medium" },
      { trend: "Layer 2 adoption", impact: "high", timeframe: "long" },
    ],
  };
}
