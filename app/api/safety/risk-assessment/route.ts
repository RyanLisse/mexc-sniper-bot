import type { NextRequest } from "next/server";
import { apiResponse } from "@/src/lib/api-response";
import { requireAuth } from "@/src/lib/supabase-auth";
import { SafetyMonitorAgent } from "@/src/mexc-agents/safety-monitor-agent";
import { AdvancedRiskEngine } from "@/src/services/risk/advanced-risk-engine";

/**
 * Risk Assessment API
 *
 * POST /api/safety/risk-assessment - Assess risk for potential trades
 * GET /api/safety/risk-assessment - Get current risk metrics
 */

// Initialize risk systems
const riskEngine = new AdvancedRiskEngine();
const safetyMonitor = new SafetyMonitorAgent();

export async function GET(request: NextRequest) {
  // Build-safe logger - simple console implementation
  type LogContext = string | number | boolean | object | undefined;
  const logger = {
    info: (message: string, context?: LogContext) =>
      console.info("[risk-assessment]", message, context || ""),
    warn: (message: string, context?: LogContext) =>
      console.warn("[risk-assessment]", message, context || ""),
    error: (message: string, context?: LogContext) =>
      console.error("[risk-assessment]", message, context || ""),
    debug: (message: string, context?: LogContext) =>
      console.debug("[risk-assessment]", message, context || ""),
  };

  try {
    const { searchParams } = new URL(request.url);
    const _includeHistory = searchParams.get("includeHistory") === "true";
    const includeStressTest = searchParams.get("includeStressTest") === "true";

    // Get current portfolio risk metrics
    const portfolioMetrics = await riskEngine.getPortfolioRiskMetrics();
    const healthStatus = riskEngine.getHealthStatus();
    const activeAlerts = riskEngine.getActiveAlerts();

    let stressTestResults: unknown;
    if (includeStressTest) {
      stressTestResults = await riskEngine.performStressTest();
    }

    const response = {
      currentMetrics: {
        portfolioValue: portfolioMetrics.totalValue,
        totalExposure: portfolioMetrics.totalExposure,
        valueAtRisk95: portfolioMetrics.valueAtRisk95,
        expectedShortfall: portfolioMetrics.expectedShortfall,
        maxDrawdownRisk: portfolioMetrics.maxDrawdownRisk,
        diversificationScore: portfolioMetrics.diversificationScore,
        concentrationRisk: portfolioMetrics.concentrationRisk,
        liquidityRisk: portfolioMetrics.liquidityRisk,
        sharpeRatio: portfolioMetrics.sharpeRatio,
      },
      riskScoring: {
        overallRiskScore: healthStatus.metrics.riskScore,
        riskLevel:
          healthStatus.metrics.riskScore < 25
            ? "low"
            : healthStatus.metrics.riskScore < 50
              ? "medium"
              : healthStatus.metrics.riskScore < 75
                ? "high"
                : "critical",
        lastUpdate: new Date(healthStatus.metrics.lastUpdate).toISOString(),
      },
      alerts: {
        active: activeAlerts.length,
        critical: activeAlerts.filter((a) => a.severity === "critical").length,
        details: activeAlerts.map((alert) => ({
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          timestamp: alert.timestamp,
          recommendations: alert.recommendations,
        })),
      },
      healthStatus: {
        healthy: healthStatus.healthy,
        issues: healthStatus.issues,
        positionCount: healthStatus.metrics.positionCount,
        portfolioValue: healthStatus.metrics.portfolioValue,
      },
      stressTest: stressTestResults,
      timestamp: new Date().toISOString(),
    };

    return apiResponse.success(response);
  } catch (error) {
    logger.error("[Risk Assessment] GET Error:", { error: error });
    return apiResponse.error("Failed to get risk assessment", 500);
  }
}

export async function POST(request: NextRequest) {
  // Build-safe logger - simple console implementation
  type LogContext = string | number | boolean | object | undefined;
  const logger = {
    info: (message: string, context?: LogContext) =>
      console.info("[risk-assessment]", message, context || ""),
    warn: (message: string, context?: LogContext) =>
      console.warn("[risk-assessment]", message, context || ""),
    error: (message: string, context?: LogContext) =>
      console.error("[risk-assessment]", message, context || ""),
    debug: (message: string, context?: LogContext) =>
      console.debug("[risk-assessment]", message, context || ""),
  };

  try {
    // Verify authentication
    try {
      await requireAuth();
    } catch (_error) {
      return apiResponse.unauthorized("Authentication required");
    }

    const body = await request.json();
    const { action, symbol, side, quantity, price, marketData, patternData } =
      body;

    let result: unknown;

    switch (action) {
      case "assess_trade": {
        if (!symbol || !side || !quantity || !price) {
          return apiResponse.badRequest("Missing required trade parameters");
        }

        const tradeAssessment = await riskEngine.assessTradeRisk(
          symbol,
          side,
          quantity,
          price,
          marketData
        );

        // Also validate through safety monitor if risk is high
        let patternValidation: unknown;
        if (tradeAssessment.riskScore > 50) {
          patternValidation = await safetyMonitor.validatePatternDiscovery(
            `pattern-${Date.now()}`,
            symbol,
            tradeAssessment.advancedMetrics.positionSizeRisk,
            tradeAssessment.riskScore,
            patternData || {}
          );
        }

        result = {
          tradeAssessment,
          patternValidation,
          recommendation: {
            approved:
              tradeAssessment.approved &&
              (!patternValidation ||
                patternValidation.recommendation === "proceed"),
            confidence: patternValidation
              ? Math.min(
                  tradeAssessment.riskScore,
                  patternValidation.confidence
                ) / 100
              : (100 - tradeAssessment.riskScore) / 100,
            reasoning: [
              ...tradeAssessment.reasons,
              ...(patternValidation?.reasoning || []),
            ],
            maxRecommendedSize: Math.min(
              tradeAssessment.maxAllowedSize,
              quantity * 0.8 // Conservative adjustment
            ),
          },
        };
        break;
      }

      case "update_market_conditions":
        if (!body.marketConditions) {
          return apiResponse.badRequest("Market conditions required");
        }

        await riskEngine.updateMarketConditions(body.marketConditions);
        result = { success: true, message: "Market conditions updated" };
        break;

      case "calculate_position_sizing": {
        if (!symbol || !price) {
          return apiResponse.badRequest("Symbol and price required");
        }

        const maxSize = body.targetRisk
          ? (body.targetRisk / 100) *
            (await riskEngine.getPortfolioRiskMetrics()).totalValue
          : 10000; // Default max size

        const portfolioMetrics = await riskEngine.getPortfolioRiskMetrics();
        const riskAdjustedSize = Math.min(
          maxSize,
          portfolioMetrics.totalValue * 0.1, // Max 10% of portfolio
          50000 // Absolute max
        );

        result = {
          recommendedSize: riskAdjustedSize,
          maxSize: maxSize,
          riskPercentage:
            (riskAdjustedSize / portfolioMetrics.totalValue) * 100,
          reasoning: [
            `Based on current portfolio value: $${portfolioMetrics.totalValue.toLocaleString()}`,
            `Risk-adjusted for diversification score: ${portfolioMetrics.diversificationScore.toFixed(1)}`,
            `Concentration risk consideration: ${portfolioMetrics.concentrationRisk.toFixed(1)}%`,
          ],
        };
        break;
      }

      case "get_dynamic_stops": {
        if (!symbol || !body.entryPrice || !body.currentPrice) {
          return apiResponse.badRequest(
            "Symbol, entry price, and current price required"
          );
        }

        const stopLoss = riskEngine.calculateDynamicStopLoss(
          symbol,
          body.entryPrice,
          body.currentPrice
        );

        const takeProfit = riskEngine.calculateDynamicTakeProfit(
          symbol,
          body.entryPrice,
          body.currentPrice
        );

        result = {
          stopLoss,
          takeProfit,
          riskRewardRatio:
            (takeProfit.takeProfitPrice - body.currentPrice) /
            (body.currentPrice - stopLoss.stopLossPrice),
        };
        break;
      }

      default:
        return apiResponse.badRequest(`Unknown action: ${action}`);
    }

    return apiResponse.success(result);
  } catch (error) {
    logger.error("[Risk Assessment] POST Error:", { error: error });
    return apiResponse.error("Failed to perform risk assessment", 500);
  }
}
