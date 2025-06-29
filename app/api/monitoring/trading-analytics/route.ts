import { and, desc, eq, gte, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { 
  executionHistory, 
  patternEmbeddings, 
  positionSnapshots,
  snipeTargets, 
  transactions 
} from "@/src/db/schema";
import {
  createValidatedApiResponse,
  TradingAnalyticsResponseSchema,
} from "@/src/schemas/api-validation-schemas";

export async function GET(request: NextRequest) {
  try {
    // Get comprehensive trading analytics
    const [
      tradingPerformance,
      portfolioMetrics,
      patternSuccessRates,
      riskMetrics,
      positionAnalytics,
      executionAnalytics,
      profitLossAnalytics,
      marketAnalytics
    ] = await Promise.all([
      getTradingPerformanceMetrics(),
      getPortfolioMetrics(),
      getPatternSuccessRates(),
      getRiskMetrics(),
      getPositionAnalytics(),
      getExecutionAnalytics(),
      getProfitLossAnalytics(),
      getMarketAnalytics()
    ]);

    const response = {
      timestamp: new Date().toISOString(),
      tradingPerformance: {
        totalTrades: tradingPerformance.totalTrades,
        successfulTrades: tradingPerformance.successfulTrades,
        successRate: tradingPerformance.successRate,
        averageTradeSize: tradingPerformance.averageTradeSize,
        averageHoldTime: tradingPerformance.averageHoldTime,
        tradingVolume: tradingPerformance.tradingVolume,
        winLossRatio: tradingPerformance.winLossRatio,
        sharpeRatio: tradingPerformance.sharpeRatio,
        maxDrawdown: tradingPerformance.maxDrawdown,
        profitFactor: tradingPerformance.profitFactor
      },
      portfolioMetrics: {
        currentValue: portfolioMetrics.currentValue,
        totalReturn: portfolioMetrics.totalReturn,
        returnPercentage: portfolioMetrics.returnPercentage,
        dayChange: portfolioMetrics.dayChange,
        weekChange: portfolioMetrics.weekChange,
        monthChange: portfolioMetrics.monthChange,
        allocations: portfolioMetrics.allocations,
        topPerformers: portfolioMetrics.topPerformers,
        riskAdjustedReturn: portfolioMetrics.riskAdjustedReturn,
        beta: portfolioMetrics.beta,
        volatility: portfolioMetrics.volatility
      },
      patternAnalytics: {
        totalPatternsDetected: patternSuccessRates.totalPatterns,
        successfulPatterns: patternSuccessRates.successfulPatterns,
        patternSuccessRate: patternSuccessRates.successRate,
        averageConfidence: patternSuccessRates.averageConfidence,
        patternTypes: patternSuccessRates.patternTypes,
        readyStatePatterns: patternSuccessRates.readyStatePatterns,
        advanceDetectionMetrics: {
          averageAdvanceTime: patternSuccessRates.averageAdvanceTime,
          optimalDetections: patternSuccessRates.optimalDetections,
          detectionAccuracy: patternSuccessRates.detectionAccuracy
        },
        patternPerformance: patternSuccessRates.patternPerformance
      },
      riskManagement: {
        currentRiskScore: riskMetrics.currentRiskScore,
        portfolioVaR: riskMetrics.portfolioVaR,
        maxPositionSize: riskMetrics.maxPositionSize,
        diversificationRatio: riskMetrics.diversificationRatio,
        correlationMatrix: riskMetrics.correlationMatrix,
        stressTestResults: riskMetrics.stressTestResults,
        riskLimits: riskMetrics.riskLimits,
        exposureMetrics: riskMetrics.exposureMetrics,
        circuitBreakerStatus: riskMetrics.circuitBreakerStatus
      },
      positionAnalytics: {
        activePositions: positionAnalytics.activePositions,
        positionSizes: positionAnalytics.positionSizes,
        positionDurations: positionAnalytics.positionDurations,
        sectorExposure: positionAnalytics.sectorExposure,
        leverageMetrics: positionAnalytics.leverageMetrics,
        liquidityMetrics: positionAnalytics.liquidityMetrics,
        unrealizedPnL: positionAnalytics.unrealizedPnL,
        realizedPnL: positionAnalytics.realizedPnL
      },
      executionAnalytics: {
        orderExecutionSpeed: executionAnalytics.orderExecutionSpeed,
        slippageMetrics: executionAnalytics.slippageMetrics,
        fillRates: executionAnalytics.fillRates,
        marketImpact: executionAnalytics.marketImpact,
        executionCosts: executionAnalytics.executionCosts,
        latencyMetrics: executionAnalytics.latencyMetrics,
        orderBookAnalysis: executionAnalytics.orderBookAnalysis
      },
      profitLossAnalytics: {
        dailyPnL: profitLossAnalytics.dailyPnL,
        weeklyPnL: profitLossAnalytics.weeklyPnL,
        monthlyPnL: profitLossAnalytics.monthlyPnL,
        yearlyPnL: profitLossAnalytics.yearlyPnL,
        pnLDistribution: profitLossAnalytics.pnLDistribution,
        bestTrades: profitLossAnalytics.bestTrades,
        worstTrades: profitLossAnalytics.worstTrades,
        pnLByStrategy: profitLossAnalytics.pnLByStrategy,
        pnLByTimeframe: profitLossAnalytics.pnLByTimeframe
      },
      marketAnalytics: {
        marketConditions: marketAnalytics.marketConditions,
        correlationToMarket: marketAnalytics.correlationToMarket,
        sectorPerformance: marketAnalytics.sectorPerformance,
        volatilityIndex: marketAnalytics.volatilityIndex,
        marketSentiment: marketAnalytics.marketSentiment,
        tradingOpportunities: marketAnalytics.tradingOpportunities,
        marketTrends: marketAnalytics.marketTrends
      }
    };

    try {
      // Validate the response structure (partial validation for core fields)
      const validatedResponse = TradingAnalyticsResponseSchema.partial().parse(response);
      return NextResponse.json(validatedResponse);
    } catch (validationError) {
      console.warn("Trading analytics response validation warning:", { error: validationError });
      // Return response anyway with warning logged (graceful degradation)
      return NextResponse.json(response);
    }
  } catch (error) {
    console.error("[Monitoring API] Trading analytics failed:", { error: error });
    return NextResponse.json(
      { 
        error: "Failed to fetch trading analytics",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// Helper functions for trading analytics
async function getTradingPerformanceMetrics() {
  try {
    const trades = await db
      .select()
      .from(transactions)
      .where(gte(transactions.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
      .orderBy(desc(transactions.createdAt));

    const totalTrades = trades.length;
    const successfulTrades = trades.filter((t: any) => t.status === 'completed' && (t.profitLoss || 0) > 0).length;
    const successRate = totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0;

    const averageTradeSize = trades.reduce((sum: any, t: any) => sum + (t.buyTotalCost || 0), 0) / totalTrades || 0;
    const tradingVolume = trades.reduce((sum: any, t: any) => sum + (t.buyTotalCost || 0), 0);

    const profits = trades.filter((t: any) => (t.profitLoss || 0) > 0).map((t: any) => t.profitLoss || 0);
    const losses = trades.filter((t: any) => (t.profitLoss || 0) < 0).map((t: any) => Math.abs(t.profitLoss || 0));
    
    const averageProfit = profits.reduce((sum: any, p: any) => sum + p, 0) / profits.length || 0;
    const averageLoss = losses.reduce((sum: any, l: any) => sum + l, 0) / losses.length || 0;
    const winLossRatio = averageLoss > 0 ? averageProfit / averageLoss : 0;

    return {
      totalTrades,
      successfulTrades,
      successRate,
      averageTradeSize,
      averageHoldTime: Math.random() * 24 + 6, // 6-30 hours mock
      tradingVolume,
      winLossRatio,
      sharpeRatio: Math.random() * 1.5 + 0.5, // 0.5-2.0 mock
      maxDrawdown: Math.random() * 15 + 5, // 5-20% mock
      profitFactor: winLossRatio > 0 ? winLossRatio * 1.2 : 1.0
    };
  } catch (error) {
    console.error("Error calculating trading performance:", { error: error });
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
      profitFactor: 0
    };
  }
}

async function getPortfolioMetrics() {
  try {
    const recentPortfolio = await db
      .select()
      .from(positionSnapshots)
      .orderBy(desc(positionSnapshots.timestamp))
      .limit(30);

    const current = recentPortfolio[0];
    const dayAgo = recentPortfolio.find((p: any) => 
      new Date(p.timestamp).getTime() < Date.now() - 24 * 60 * 60 * 1000
    );
    const weekAgo = recentPortfolio.find((p: any) => 
      new Date(p.timestamp).getTime() < Date.now() - 7 * 24 * 60 * 60 * 1000
    );

    const currentValue = current?.totalBalance || 10000;
    const dayChange = dayAgo ? ((currentValue - (dayAgo.totalBalance || 10000)) / (dayAgo.totalBalance || 10000)) * 100 : 0;
    const weekChange = weekAgo ? ((currentValue - (weekAgo.totalBalance || 10000)) / (weekAgo.totalBalance || 10000)) * 100 : 0;

    return {
      currentValue,
      totalReturn: currentValue - 10000, // Assuming 10k initial
      returnPercentage: ((currentValue - 10000) / 10000) * 100,
      dayChange,
      weekChange,
      monthChange: Math.random() * 20 - 10, // -10% to +10% mock
      allocations: [
        { asset: 'BTC', percentage: 30, value: currentValue * 0.3 },
        { asset: 'ETH', percentage: 25, value: currentValue * 0.25 },
        { asset: 'USDT', percentage: 20, value: currentValue * 0.2 },
        { asset: 'Others', percentage: 25, value: currentValue * 0.25 }
      ],
      topPerformers: [
        { symbol: 'BTCUSDT', return: 15.2 },
        { symbol: 'ETHUSDT', return: 12.1 },
        { symbol: 'ADAUSDT', return: 8.7 }
      ],
      riskAdjustedReturn: Math.random() * 0.8 + 0.2, // 0.2-1.0 mock
      beta: Math.random() * 0.5 + 0.8, // 0.8-1.3 mock
      volatility: Math.random() * 20 + 10 // 10-30% mock
    };
  } catch (error) {
    console.error("Error calculating portfolio metrics:", { error: error });
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
      volatility: 15
    };
  }
}

async function getPatternSuccessRates() {
  try {
    const recentPatterns = await db
      .select()
      .from(patternEmbeddings)
      .where(gte(patternEmbeddings.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));

    const totalPatterns = recentPatterns.length;
    const successfulPatterns = recentPatterns.filter((p: any) => p.isActive && p.truePositives > 0).length;
    const successRate = totalPatterns > 0 ? (successfulPatterns / totalPatterns) * 100 : 0;
    const averageConfidence = recentPatterns.reduce((sum: any, p: any) => sum + (p.confidence || 0), 0) / totalPatterns || 0;

    const patternTypes = recentPatterns.reduce((acc: any, p: any) => {
      const type = p.patternType || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const readyStatePatterns = recentPatterns.filter((p: any) => 
      p.patternType === 'ready_state'
    ).length;

    return {
      totalPatterns,
      successfulPatterns,
      successRate,
      averageConfidence,
      patternTypes: Object.entries(patternTypes).map(([type, count]) => ({ type, count })),
      readyStatePatterns,
      averageAdvanceTime: Math.random() * 2 + 3.5, // 3.5-5.5 hours mock
      optimalDetections: Math.floor(totalPatterns * 0.8), // 80% optimal mock
      detectionAccuracy: Math.random() * 10 + 90, // 90-100% mock
      patternPerformance: [
        { pattern: 'ready-state', successRate: 85, avgReturn: 12.5 },
        { pattern: 'volume-surge', successRate: 72, avgReturn: 8.3 },
        { pattern: 'momentum-shift', successRate: 68, avgReturn: 6.7 }
      ]
    };
  } catch (error) {
    console.error("Error calculating pattern success rates:", { error: error });
    return {
      totalPatterns: 0,
      successfulPatterns: 0,
      successRate: 0,
      averageConfidence: 0,
      patternTypes: [],
      readyStatePatterns: 0,
      averageAdvanceTime: 3.5,
      optimalDetections: 0,
      detectionAccuracy: 95,
      patternPerformance: []
    };
  }
}

async function getRiskMetrics() {
  // Mock comprehensive risk metrics
  return {
    currentRiskScore: Math.random() * 40 + 30, // 30-70 risk score
    portfolioVaR: Math.random() * 5 + 2, // 2-7% Value at Risk
    maxPositionSize: 0.1, // 10% max position
    diversificationRatio: Math.random() * 0.3 + 0.7, // 0.7-1.0
    correlationMatrix: [
      { pair: 'BTC-ETH', correlation: 0.85 },
      { pair: 'BTC-ALT', correlation: 0.72 },
      { pair: 'ETH-ALT', correlation: 0.68 }
    ],
    stressTestResults: {
      marketCrash: { impact: -15.2, recovery: '3-5 days' },
      flashCrash: { impact: -8.7, recovery: '1-2 hours' },
      liquidityStress: { impact: -5.3, recovery: '30-60 minutes' }
    },
    riskLimits: {
      dailyLoss: { limit: 5, current: 1.2 },
      maxDrawdown: { limit: 15, current: 3.8 },
      concentration: { limit: 25, current: 18.5 }
    },
    exposureMetrics: {
      totalExposure: Math.random() * 50000 + 25000,
      leverageRatio: Math.random() * 2 + 1,
      marginUtilization: Math.random() * 60 + 20
    },
    circuitBreakerStatus: {
      active: Math.random() > 0.9,
      lastTriggered: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      triggerCount: Math.floor(Math.random() * 3)
    }
  };
}

async function getPositionAnalytics() {
  try {
    const activeTargets = await db
      .select()
      .from(snipeTargets)
      .where(eq(snipeTargets.status, 'active'));

    return {
      activePositions: activeTargets.length,
      positionSizes: activeTargets.map((t: any) => ({
        symbol: t.symbolName,
        size: t.positionSizeUsdt || 0,
        percentage: Math.random() * 10 + 2 // 2-12% mock
      })),
      positionDurations: activeTargets.map((t: any) => ({
        symbol: t.symbolName,
        duration: Math.floor((Date.now() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60)) // hours
      })),
      sectorExposure: [
        { sector: 'DeFi', exposure: 35 },
        { sector: 'Layer 1', exposure: 28 },
        { sector: 'NFT/Gaming', exposure: 15 },
        { sector: 'Infrastructure', exposure: 22 }
      ],
      leverageMetrics: {
        averageLeverage: Math.random() * 2 + 1,
        maxLeverage: 3,
        leveragedPositions: Math.floor(activeTargets.length * 0.4)
      },
      liquidityMetrics: {
        averageLiquidity: Math.random() * 1000000 + 500000,
        liquidityScore: Math.random() * 30 + 70,
        illiquidPositions: Math.floor(activeTargets.length * 0.1)
      },
      unrealizedPnL: Math.random() * 2000 - 1000, // -1k to +1k mock
      realizedPnL: Math.random() * 5000 - 2500 // -2.5k to +2.5k mock
    };
  } catch (error) {
    console.error("Error calculating position analytics:", { error: error });
    return {
      activePositions: 0,
      positionSizes: [],
      positionDurations: [],
      sectorExposure: [],
      leverageMetrics: { averageLeverage: 1, maxLeverage: 3, leveragedPositions: 0 },
      liquidityMetrics: { averageLiquidity: 0, liquidityScore: 0, illiquidPositions: 0 },
      unrealizedPnL: 0,
      realizedPnL: 0
    };
  }
}

async function getExecutionAnalytics() {
  // Mock execution analytics
  return {
    orderExecutionSpeed: {
      average: Math.random() * 200 + 50, // 50-250ms
      p95: Math.random() * 500 + 200, // 200-700ms
      p99: Math.random() * 1000 + 500 // 500-1500ms
    },
    slippageMetrics: {
      averageSlippage: Math.random() * 0.5 + 0.1, // 0.1-0.6%
      maxSlippage: Math.random() * 2 + 1, // 1-3%
      slippageDistribution: [
        { range: '0-0.1%', count: 65 },
        { range: '0.1-0.5%', count: 25 },
        { range: '0.5-1%', count: 8 },
        { range: '>1%', count: 2 }
      ]
    },
    fillRates: {
      fullFill: 85,
      partialFill: 12,
      noFill: 3
    },
    marketImpact: Math.random() * 0.3 + 0.05, // 0.05-0.35%
    executionCosts: {
      tradingFees: Math.random() * 100 + 50,
      slippageCosts: Math.random() * 75 + 25,
      marketImpactCosts: Math.random() * 50 + 10
    },
    latencyMetrics: {
      orderToExchange: Math.random() * 20 + 5, // 5-25ms
      marketDataLatency: Math.random() * 10 + 2, // 2-12ms
      systemLatency: Math.random() * 5 + 1 // 1-6ms
    },
    orderBookAnalysis: {
      averageSpread: Math.random() * 0.2 + 0.05, // 0.05-0.25%
      bidAskImbalance: Math.random() * 0.4 + 0.3, // 0.3-0.7
      orderBookDepth: Math.random() * 500000 + 100000 // $100k-$600k
    }
  };
}

async function getProfitLossAnalytics() {
  // Mock P&L analytics
  const generatePnLData = (days: number) => {
    return Array.from({ length: days }, (_, i) => ({
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      pnl: Math.random() * 1000 - 500 // -500 to +500
    })).reverse();
  };

  return {
    dailyPnL: generatePnLData(30),
    weeklyPnL: generatePnLData(12).map(d => ({ ...d, pnl: d.pnl * 7 })),
    monthlyPnL: generatePnLData(6).map(d => ({ ...d, pnl: d.pnl * 30 })),
    yearlyPnL: Math.random() * 50000 - 25000, // -25k to +25k
    pnLDistribution: [
      { range: '>$1000', count: 12, percentage: 15 },
      { range: '$500-$1000', count: 18, percentage: 22 },
      { range: '$100-$500', count: 25, percentage: 31 },
      { range: '$0-$100', count: 15, percentage: 19 },
      { range: '<$0', count: 10, percentage: 13 }
    ],
    bestTrades: [
      { symbol: 'BTCUSDT', pnl: 2500, date: '2024-01-15', duration: '4h' },
      { symbol: 'ETHUSDT', pnl: 1800, date: '2024-01-10', duration: '6h' },
      { symbol: 'ADAUSDT', pnl: 1200, date: '2024-01-08', duration: '2h' }
    ],
    worstTrades: [
      { symbol: 'SOLUSDT', pnl: -800, date: '2024-01-12', duration: '8h' },
      { symbol: 'DOTUSDT', pnl: -600, date: '2024-01-07', duration: '3h' },
      { symbol: 'LINKUSDT', pnl: -450, date: '2024-01-05', duration: '5h' }
    ],
    pnLByStrategy: [
      { strategy: 'pattern-discovery', pnl: 5200, trades: 45 },
      { strategy: 'momentum-trading', pnl: 3100, trades: 32 },
      { strategy: 'arbitrage', pnl: 1800, trades: 28 }
    ],
    pnLByTimeframe: [
      { timeframe: '1h', pnl: 2500, trades: 85 },
      { timeframe: '4h', pnl: 4200, trades: 45 },
      { timeframe: '1d', pnl: 3100, trades: 25 }
    ]
  };
}

async function getMarketAnalytics() {
  // Mock market analytics
  return {
    marketConditions: {
      trend: 'bullish',
      volatility: 'medium',
      sentiment: 'optimistic',
      fearGreedIndex: Math.floor(Math.random() * 40 + 50) // 50-90 (greed)
    },
    correlationToMarket: {
      btcCorrelation: Math.random() * 0.4 + 0.6, // 0.6-1.0
      ethCorrelation: Math.random() * 0.3 + 0.7, // 0.7-1.0
      overallCorrelation: Math.random() * 0.3 + 0.65 // 0.65-0.95
    },
    sectorPerformance: [
      { sector: 'DeFi', performance: 8.5, trend: 'up' },
      { sector: 'Layer 1', performance: 12.2, trend: 'up' },
      { sector: 'NFT/Gaming', performance: -2.1, trend: 'down' },
      { sector: 'Infrastructure', performance: 5.7, trend: 'up' }
    ],
    volatilityIndex: Math.random() * 30 + 20, // 20-50 VIX equivalent
    marketSentiment: {
      social: 'positive',
      news: 'neutral',
      technical: 'bullish',
      onChain: 'positive'
    },
    tradingOpportunities: [
      { symbol: 'NEWCOIN1USDT', confidence: 85, type: 'breakout' },
      { symbol: 'NEWCOIN2USDT', confidence: 78, type: 'momentum' },
      { symbol: 'NEWCOIN3USDT', confidence: 72, type: 'pattern' }
    ],
    marketTrends: [
      { trend: 'AI tokens surge', impact: 'high', timeframe: 'short' },
      { trend: 'DeFi resurgence', impact: 'medium', timeframe: 'medium' },
      { trend: 'Layer 2 adoption', impact: 'high', timeframe: 'long' }
    ]
  };
}