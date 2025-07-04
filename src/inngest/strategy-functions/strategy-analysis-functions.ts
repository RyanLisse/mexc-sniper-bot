/**
 * Strategy Analysis Functions
 *
 * Inngest workflow functions for analyzing multi-phase trading strategies.
 * Extracted from multi-phase-strategy-functions.ts for better modularity.
 */

import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { tradingStrategies } from "@/src/db/schemas/strategies";
import { RiskManagerAgent } from "@/src/mexc-agents/risk-manager-agent";
import { StrategyAgent } from "@/src/mexc-agents/strategy-agent";
import {
  multiPhaseTradingService,
  type TradingStrategy,
} from "@/src/services/multi-phase-trading-service";
import { inngest } from "../client";
import type {
  isStrategyAnalysisResult,
  MarketData,
  StrategyAnalysisResult,
} from "./strategy-types";

/**
 * Analyze Multi-Phase Strategy Workflow
 */
export const analyzeMultiPhaseStrategy = inngest.createFunction(
  { id: "multi-phase-strategy-analyze", name: "Analyze Multi-Phase Strategy" },
  { event: "multi-phase-strategy/analyze" },
  async ({ event, step }) => {
    const { strategyId, marketData, analysisDepth = "standard" } = event.data;

    // Step 1: Retrieve Strategy
    const strategy = await step.run("retrieve-strategy", async () => {
      const result = await db
        .select()
        .from(tradingStrategies)
        .where(eq(tradingStrategies.id, strategyId))
        .limit(1);

      if (result.length === 0) {
        throw new Error(`Strategy not found: ${strategyId}`);
      }

      return result[0] as TradingStrategy;
    });

    // Step 2: Performance Analysis
    const performanceAnalysis = await step.run(
      "analyze-performance",
      async () => {
        try {
          const performanceData =
            await multiPhaseTradingService.getStrategyPerformance(strategyId);

          const analysis = {
            totalTrades: performanceData.totalTrades || 0,
            successfulTrades: performanceData.successfulTrades || 0,
            successRate:
              performanceData.totalTrades > 0
                ? (performanceData.successfulTrades /
                    performanceData.totalTrades) *
                  100
                : 0,
            totalPnlPercent: performanceData.totalPnl || 0,
            averageTradeReturn: performanceData.averageReturn || 0,
            maxDrawdown: performanceData.maxDrawdown || 0,
            sharpeRatio: performanceData.sharpeRatio || 0,
            winLossRatio: performanceData.winLossRatio || 0,
          };

          return analysis;
        } catch (error) {
          // Return default analysis if service unavailable
          return {
            totalTrades: 0,
            successfulTrades: 0,
            successRate: 0,
            totalPnlPercent: 0,
            averageTradeReturn: 0,
            maxDrawdown: 0,
            sharpeRatio: 0,
            winLossRatio: 0,
            error:
              error instanceof Error
                ? error.message
                : "Performance data unavailable",
          };
        }
      }
    );

    // Step 3: Phase Analysis
    const phaseAnalysis = await step.run("analyze-phases", async () => {
      const strategyAgent = new StrategyAgent({
        userId: strategy.userId,
        preferences: {},
      });

      const phaseResults = [];
      const phases = strategy.parameters?.multiPhaseConfig?.phases || [];

      for (const [index, phase] of phases.entries()) {
        try {
          const phasePerformance = await strategyAgent.analyzePhase({
            phase,
            marketData,
            strategy,
          });

          phaseResults.push({
            phaseIndex: index,
            phaseName: phase.name || `Phase ${index + 1}`,
            performance: phasePerformance,
            efficiency: phasePerformance.efficiency || "unknown",
            issues: phasePerformance.issues || [],
          });
        } catch (error) {
          phaseResults.push({
            phaseIndex: index,
            phaseName: phase.name || `Phase ${index + 1}`,
            performance: {
              error: error instanceof Error ? error.message : "Analysis failed",
            },
            efficiency: "error",
            issues: ["Phase analysis failed"],
          });
        }
      }

      return {
        totalPhases: phases.length,
        analyzedPhases: phaseResults.length,
        results: phaseResults,
        overallEfficiency:
          phaseResults.length > 0
            ? phaseResults.filter((p) => p.efficiency === "high").length /
              phaseResults.length
            : 0,
      };
    });

    // Step 4: Risk Analysis
    const riskAnalysis = await step.run("analyze-risk-metrics", async () => {
      const riskAgent = new RiskManagerAgent({
        userId: strategy.userId,
        capital: strategy.parameters?.capital || 10000,
        riskTolerance: strategy.parameters?.riskTolerance || "medium",
      });

      try {
        const riskMetrics = await riskAgent.analyzeStrategyRisk({
          strategy,
          marketData,
          performanceData: performanceAnalysis,
        });

        return {
          currentRiskLevel: riskMetrics.riskLevel || "medium",
          riskScore: riskMetrics.riskScore || 5,
          volatilityRisk: riskMetrics.volatilityRisk || 0.3,
          liquidityRisk: riskMetrics.liquidityRisk || 0.2,
          concentrationRisk: riskMetrics.concentrationRisk || 0.1,
          recommendations: riskMetrics.recommendations || [],
          alerts: riskMetrics.alerts || [],
        };
      } catch (error) {
        return {
          currentRiskLevel: "unknown",
          riskScore: 5,
          volatilityRisk: 0.5,
          liquidityRisk: 0.5,
          concentrationRisk: 0.5,
          recommendations: ["Risk analysis unavailable"],
          alerts: [],
          error:
            error instanceof Error ? error.message : "Risk analysis failed",
        };
      }
    });

    // Step 5: Market Alignment Analysis
    const marketAlignment = await step.run(
      "analyze-market-alignment",
      async () => {
        const currentMarketConditions = {
          trend: marketData.change24h > 0 ? "bullish" : "bearish",
          volatility: Math.abs(marketData.change24h) / 100,
          volume: marketData.volume,
          liquidity: marketData.volume > 1000000 ? "high" : "medium",
        };

        const strategyRequirements = strategy.parameters?.marketAnalysis || {};

        const alignment = {
          trendAlignment:
            currentMarketConditions.trend === strategyRequirements.marketTrend
              ? 1
              : 0,
          volatilityAlignment:
            Math.abs(
              currentMarketConditions.volatility -
                (strategyRequirements.volatility || 0.5)
            ) < 0.2
              ? 1
              : 0,
          liquidityAlignment:
            currentMarketConditions.liquidity === "high" ? 1 : 0.5,
        };

        const overallAlignment =
          Object.values(alignment).reduce((sum, val) => sum + val, 0) /
          Object.keys(alignment).length;

        return {
          currentConditions: currentMarketConditions,
          strategyRequirements,
          alignment,
          overallAlignment,
          suitability:
            overallAlignment > 0.7
              ? "high"
              : overallAlignment > 0.4
                ? "medium"
                : "low",
        };
      }
    );

    // Step 6: Generate Analytics
    const analytics = await step.run("generate-analytics", async () => {
      const executionTrend =
        performanceAnalysis.successRate > 70
          ? "improving"
          : performanceAnalysis.successRate > 40
            ? "stable"
            : "declining";

      const progress =
        phaseAnalysis.totalPhases > 0
          ? (phaseAnalysis.results.filter((p) => p.efficiency !== "error")
              .length /
              phaseAnalysis.totalPhases) *
            100
          : 0;

      return {
        executionTrend,
        progress,
        riskAdjustedReturn:
          performanceAnalysis.totalPnlPercent /
          Math.max(riskAnalysis.riskScore, 1),
        marketSuitability: marketAlignment.suitability,
        overallHealth:
          (performanceAnalysis.successRate +
            progress +
            marketAlignment.overallAlignment * 100) /
          3,
        lastAnalyzed: new Date().toISOString(),
      };
    });

    // Step 7: Generate Recommendations
    const recommendations = await step.run(
      "generate-recommendations",
      async () => {
        const recommendations = [];

        // Performance-based recommendations
        if (performanceAnalysis.successRate < 50) {
          recommendations.push(
            "Consider adjusting entry criteria to improve success rate"
          );
        }

        if (performanceAnalysis.maxDrawdown > 0.1) {
          recommendations.push("Reduce position sizes to limit drawdown");
        }

        // Risk-based recommendations
        if (riskAnalysis.riskScore > 7) {
          recommendations.push(
            "Current risk level is high - consider reducing exposure"
          );
        }

        // Market alignment recommendations
        if (marketAlignment.overallAlignment < 0.5) {
          recommendations.push(
            "Strategy not well-aligned with current market conditions"
          );
        }

        // Phase-specific recommendations
        const problematicPhases = phaseAnalysis.results.filter(
          (p) => p.efficiency === "low" || p.efficiency === "error"
        );
        if (problematicPhases.length > 0) {
          recommendations.push(
            `Review phases: ${problematicPhases.map((p) => p.phaseName).join(", ")}`
          );
        }

        return recommendations.length > 0
          ? recommendations
          : ["Strategy appears to be performing well"];
      }
    );

    // Compile final analysis result
    const analysisResult: StrategyAnalysisResult = {
      strategy: strategy as TradingStrategy,
      analytics,
      performanceMetrics: {
        totalPnlPercent: performanceAnalysis.totalPnlPercent,
        successRate: performanceAnalysis.successRate,
        totalTrades: performanceAnalysis.totalTrades,
        maxDrawdown: performanceAnalysis.maxDrawdown,
        sharpeRatio: performanceAnalysis.sharpeRatio,
      },
      currentPhases: phaseAnalysis.analyzedPhases,
      totalPhases: phaseAnalysis.totalPhases,
      efficiency:
        phaseAnalysis.overallEfficiency > 0.7
          ? "high"
          : phaseAnalysis.overallEfficiency > 0.4
            ? "medium"
            : "low",
    };

    return {
      analysis: analysisResult,
      performanceAnalysis,
      phaseAnalysis,
      riskAnalysis,
      marketAlignment,
      recommendations,
      metadata: {
        analysisDepth,
        processingTime: Date.now() - event.ts,
        analysisTimestamp: new Date().toISOString(),
      },
    };
  }
);

/**
 * Strategy Health Check Workflow
 */
export const strategyHealthCheck = inngest.createFunction(
  { id: "strategy-health-check", name: "Strategy Health Check" },
  { event: "strategy/health-check" },
  async ({ event, step }) => {
    const { strategyIds = [], marketData } = event.data;

    // Step 1: Get all strategies if none specified
    const strategiesToCheck = await step.run(
      "get-strategies-for-health-check",
      async () => {
        if (strategyIds.length > 0) {
          const results = await db
            .select()
            .from(tradingStrategies)
            .where(eq(tradingStrategies.id, strategyIds[0])); // Simple approach for demo

          return results as TradingStrategy[];
        } else {
          const results = await db
            .select()
            .from(tradingStrategies)
            .where(eq(tradingStrategies.status, "active"))
            .limit(10);

          return results as TradingStrategy[];
        }
      }
    );

    // Step 2: Perform health checks
    const healthChecks = await step.run("perform-health-checks", async () => {
      const results = [];

      for (const strategy of strategiesToCheck) {
        try {
          // Basic health indicators
          const lastUpdated = new Date(strategy.updatedAt);
          const hoursSinceUpdate =
            (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);

          const healthStatus = {
            strategyId: strategy.id,
            name: strategy.name,
            isActive: strategy.status === "active",
            isStale: hoursSinceUpdate > 24,
            lastUpdate: strategy.updatedAt,
            healthScore: 0,
            issues: [] as string[],
          };

          // Calculate health score
          let score = 50; // Base score

          if (healthStatus.isActive) score += 20;
          if (!healthStatus.isStale) score += 20;
          if (strategy.parameters?.validation?.valid) score += 10;

          healthStatus.healthScore = Math.min(score, 100);

          // Identify issues
          if (!healthStatus.isActive)
            healthStatus.issues.push("Strategy is not active");
          if (healthStatus.isStale)
            healthStatus.issues.push("Strategy hasn't been updated recently");
          if (healthStatus.healthScore < 70)
            healthStatus.issues.push("Low health score");

          results.push(healthStatus);
        } catch (error) {
          results.push({
            strategyId: strategy.id,
            name: strategy.name,
            isActive: false,
            isStale: true,
            lastUpdate: strategy.updatedAt,
            healthScore: 0,
            issues: [
              "Health check failed",
              error instanceof Error ? error.message : "Unknown error",
            ],
          });
        }
      }

      return results;
    });

    // Step 3: Generate summary
    const summary = await step.run("generate-health-summary", async () => {
      const totalStrategies = healthChecks.length;
      const healthyStrategies = healthChecks.filter(
        (h) => h.healthScore >= 70
      ).length;
      const activeStrategies = healthChecks.filter((h) => h.isActive).length;
      const staleStrategies = healthChecks.filter((h) => h.isStale).length;

      return {
        totalStrategies,
        healthyStrategies,
        activeStrategies,
        staleStrategies,
        overallHealthPercentage:
          totalStrategies > 0 ? (healthyStrategies / totalStrategies) * 100 : 0,
        criticalIssues: healthChecks.filter((h) => h.healthScore < 30).length,
      };
    });

    return {
      summary,
      healthChecks,
      metadata: {
        checkTimestamp: new Date().toISOString(),
        marketData: marketData
          ? {
              symbol: marketData.symbol,
              price: marketData.price,
              timestamp: marketData.timestamp,
            }
          : null,
      },
    };
  }
);
