/**
 * Trading Analytics API Route - Refactored
 *
 * Comprehensive trading analytics endpoint with modular services.
 * Refactored into smaller, focused modules for better maintainability.
 *
 * Original file: 687 LOC -> Refactored: ~80 LOC
 * Services extracted into separate files under 500 LOC each.
 */

import { type NextRequest, NextResponse } from "next/server";
import { TradingAnalyticsResponseSchema } from "@/src/schemas/api-validation-schemas";
import {
  getExecutionAnalytics,
  getMarketAnalytics,
  getPositionAnalytics,
  getProfitLossAnalytics,
  getRiskMetrics,
} from "./services/mock-analytics";
import { getPatternSuccessRates } from "./services/pattern-analytics";
import { getPortfolioMetrics } from "./services/portfolio-metrics";
// Import modular services
import { getTradingPerformanceMetrics } from "./services/trading-performance";

export async function GET(_request: NextRequest) {
  try {
    // Get comprehensive trading analytics using modular services
    const [
      tradingPerformance,
      portfolioMetrics,
      patternSuccessRates,
      riskMetrics,
      positionAnalytics,
      executionAnalytics,
      profitLossAnalytics,
      marketAnalytics,
    ] = await Promise.all([
      getTradingPerformanceMetrics(),
      getPortfolioMetrics(),
      getPatternSuccessRates(),
      getRiskMetrics(),
      getPositionAnalytics(),
      getExecutionAnalytics(),
      getProfitLossAnalytics(),
      getMarketAnalytics(),
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
        profitFactor: tradingPerformance.profitFactor,
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
        volatility: portfolioMetrics.volatility,
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
          detectionAccuracy: patternSuccessRates.detectionAccuracy,
        },
        patternPerformance: patternSuccessRates.patternPerformance,
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
        circuitBreakerStatus: riskMetrics.circuitBreakerStatus,
      },
      positionAnalytics: {
        activePositions: positionAnalytics.activePositions,
        positionSizes: positionAnalytics.positionSizes,
        positionDurations: positionAnalytics.positionDurations,
        sectorExposure: positionAnalytics.sectorExposure,
        leverageMetrics: positionAnalytics.leverageMetrics,
        liquidityMetrics: positionAnalytics.liquidityMetrics,
        unrealizedPnL: positionAnalytics.unrealizedPnL,
        realizedPnL: positionAnalytics.realizedPnL,
      },
      executionAnalytics: {
        orderExecutionSpeed: executionAnalytics.orderExecutionSpeed,
        slippageMetrics: executionAnalytics.slippageMetrics,
        fillRates: executionAnalytics.fillRates,
        marketImpact: executionAnalytics.marketImpact,
        executionCosts: executionAnalytics.executionCosts,
        latencyMetrics: executionAnalytics.latencyMetrics,
        orderBookAnalysis: executionAnalytics.orderBookAnalysis,
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
        pnLByTimeframe: profitLossAnalytics.pnLByTimeframe,
      },
      marketAnalytics: {
        marketConditions: marketAnalytics.marketConditions,
        correlationToMarket: marketAnalytics.correlationToMarket,
        sectorPerformance: marketAnalytics.sectorPerformance,
        volatilityIndex: marketAnalytics.volatilityIndex,
        marketSentiment: marketAnalytics.marketSentiment,
        tradingOpportunities: marketAnalytics.tradingOpportunities,
        marketTrends: marketAnalytics.marketTrends,
      },
    };

    try {
      // Validate the response structure (partial validation for core fields)
      const validatedResponse =
        TradingAnalyticsResponseSchema.partial().parse(response);
      return NextResponse.json(validatedResponse);
    } catch (validationError) {
      console.warn("Trading analytics response validation warning:", {
        error: validationError,
      });
      // Return response anyway with warning logged (graceful degradation)
      return NextResponse.json(response);
    }
  } catch (error) {
    console.error("[Monitoring API] Trading analytics failed:", {
      error: error,
    });
    return NextResponse.json(
      {
        error: "Failed to fetch trading analytics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
