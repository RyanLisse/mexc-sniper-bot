/**
 * Strategy Analysis Service
 *
 * Handles multi-phase strategy performance analysis workflow logic
 */

import { and, eq, gte } from "drizzle-orm";
import { tradingStrategies } from "@/src/db/schemas/strategies";
import { StrategyAgent } from "@/src/mexc-agents/strategy-agent";
import { db } from "../../db";
import type {
  OptimizationRecommendation,
  PerformanceAnalysisEvent,
  ServiceResponse,
  StrategyAnalysisResult,
} from "../types/multi-phase-strategy-types";

export class StrategyAnalysisService {
  private strategyAgent: StrategyAgent;

  constructor() {
    this.strategyAgent = new StrategyAgent();
  }

  async executeAnalysisWorkflow(
    data: PerformanceAnalysisEvent["data"],
    step: any
  ): Promise<ServiceResponse> {
    const { strategyId, analysisType, timeframe, includeRecommendations } =
      data;

    // Step 1: Gather strategy data
    const strategyData = await step.run("gather-strategy-data", async () => {
      return this.gatherStrategyData(strategyId, timeframe);
    });

    // Step 2: Analyze performance metrics
    const performanceAnalysis = await step.run(
      "analyze-performance",
      async () => {
        return this.analyzePerformanceMetrics(strategyData, analysisType);
      }
    );

    // Step 3: Generate AI insights
    const aiInsights = await step.run("generate-ai-insights", async () => {
      return this.generateAIInsights(strategyData, performanceAnalysis);
    });

    // Step 4: Generate recommendations if requested
    const recommendations = includeRecommendations
      ? await step.run("generate-recommendations", async () => {
          return this.generateOptimizationRecommendations(
            strategyId,
            { strategyData, performanceAnalysis, aiInsights },
            {
              autoApply: false,
              objectives: ["performance"],
              constraints: {},
              riskTolerance: "medium",
            }
          );
        })
      : null;

    // Step 5: Update strategy with insights
    const updateResult = await step.run("update-insights", async () => {
      return this.updateStrategyInsights(
        strategyId,
        aiInsights,
        performanceAnalysis
      );
    });

    return {
      success: true,
      data: {
        strategyId,
        strategyData,
        performanceAnalysis,
        aiInsights,
        recommendations,
        updateResult,
      },
      timestamp: new Date().toISOString(),
      metadata: {
        analysisType,
        timeframe,
        includeRecommendations,
      },
    };
  }

  async generateOptimizationRecommendations(
    strategyId: string,
    currentPerformance: any,
    optimizationCriteria: any
  ): Promise<{ recommendations: OptimizationRecommendation[] }> {
    const { strategyData, performanceAnalysis } = currentPerformance;
    const recommendations: OptimizationRecommendation[] = [];

    // Analyze performance gaps and generate recommendations
    if (performanceAnalysis.successRate < 60) {
      recommendations.push({
        type: "strategy_adjustment",
        description: "Adjust strategy parameters to improve success rate",
        expectedImpact: "15-25% improvement in success rate",
        priority: 1,
        parameters: {
          adjustmentType: "conservative",
          riskReduction: 0.2,
        },
      });
    }

    if (performanceAnalysis.averageDrawdown > 10) {
      recommendations.push({
        type: "risk_management",
        description: "Implement stricter risk management controls",
        expectedImpact: "30-40% reduction in maximum drawdown",
        priority: 1,
        parameters: {
          stopLossReduction: 0.3,
          positionSizeReduction: 0.15,
        },
      });
    }

    if (performanceAnalysis.profitFactor < 1.5) {
      recommendations.push({
        type: "profit_optimization",
        description: "Optimize profit-taking levels and timing",
        expectedImpact: "10-20% improvement in profit factor",
        priority: 2,
        parameters: {
          takeProfitAdjustment: 0.1,
          dynamicSizing: true,
        },
      });
    }

    // Add phase-specific optimizations
    const phaseOptimizations = this.analyzePhasePerformance(
      strategyData.phases
    );
    recommendations.push(...phaseOptimizations);

    return { recommendations };
  }

  async getAggregatedPerformanceMetrics(
    timeframe: string
  ): Promise<ServiceResponse> {
    const timeframeDays = this.parseTimeframeToDays(timeframe);
    const fromDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);

    const strategies = await db
      .select()
      .from(tradingStrategies)
      .where(gte(tradingStrategies.lastExecuted, fromDate));

    const metrics = this.calculateAggregatedMetrics(strategies);

    return {
      success: true,
      data: {
        timeframe,
        totalStrategies: strategies.length,
        metrics,
        generatedAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
  }

  private async gatherStrategyData(strategyId: string, timeframe?: string) {
    const strategies = await db
      .select()
      .from(tradingStrategies)
      .where(eq(tradingStrategies.id, strategyId))
      .limit(1);

    if (strategies.length === 0) {
      throw new Error(`Strategy not found: ${strategyId}`);
    }

    const strategy = strategies[0];

    return {
      id: strategy.id,
      name: strategy.name,
      symbol: strategy.symbol,
      phases: strategy.phases || [],
      totalPnl: strategy.totalPnl || 0,
      successRate: strategy.successRate || 0,
      status: strategy.status,
      lastExecuted: strategy.lastExecuted,
      createdAt: strategy.createdAt,
      executionSummary: strategy.executionSummary
        ? JSON.parse(strategy.executionSummary)
        : null,
      configuration: strategy.configuration || {},
    };
  }

  private async analyzePerformanceMetrics(
    strategyData: any,
    analysisType: string
  ) {
    const executionSummary = strategyData.executionSummary || {};

    const metrics = {
      totalPnl: strategyData.totalPnl || 0,
      successRate: strategyData.successRate || 0,
      totalTrades: executionSummary.phases || 0,
      averageTradeSize: this.calculateAverageTradeSize(executionSummary),
      profitFactor: this.calculateProfitFactor(executionSummary),
      averageDrawdown: this.calculateAverageDrawdown(executionSummary),
      riskAdjustedReturn: this.calculateRiskAdjustedReturn(strategyData),
      efficiency: this.calculateEfficiency(strategyData),
    };

    const trends = this.analyzeTrends(strategyData, analysisType);
    const riskMetrics = this.calculateRiskMetrics(strategyData);

    return {
      ...metrics,
      trends,
      riskMetrics,
      analysisType,
      lastAnalyzed: new Date().toISOString(),
    };
  }

  private async generateAIInsights(
    strategyData: any,
    performanceAnalysis: any
  ) {
    const insightPrompt = this.buildInsightPrompt(
      strategyData,
      performanceAnalysis
    );

    const aiResponse = await this.strategyAgent.process(insightPrompt, {
      analysisType: "performance_insights",
      strategyData,
      performanceMetrics: performanceAnalysis,
    });

    return {
      insights: aiResponse.content,
      confidence: 80, // AI confidence score
      recommendations: this.extractRecommendations(aiResponse.content),
      riskAssessment: this.extractRiskAssessment(aiResponse.content),
      generatedAt: new Date().toISOString(),
    };
  }

  private async updateStrategyInsights(
    strategyId: string,
    aiInsights: any,
    performanceAnalysis: any
  ) {
    const insightSummary = `📊 Analysis: ${performanceAnalysis.successRate.toFixed(1)}% success rate, ${performanceAnalysis.totalPnl.toFixed(2)} total P&L. ${aiInsights.insights.substring(0, 200)}...`;

    await db
      .update(tradingStrategies)
      .set({
        aiInsights: insightSummary,
        lastAiAnalysis: new Date(),
        successRate: performanceAnalysis.successRate,
        totalPnl: performanceAnalysis.totalPnl,
        updatedAt: new Date(),
      })
      .where(eq(tradingStrategies.id, strategyId));

    return {
      updated: true,
      insightSummary,
      analysisDate: new Date().toISOString(),
    };
  }

  private analyzePhasePerformance(phases: any[]): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    phases.forEach((phase, index) => {
      if (phase.performance && phase.performance.successRate < 50) {
        recommendations.push({
          type: "phase_optimization",
          description: `Optimize Phase ${index + 1} - low success rate detected`,
          expectedImpact: "20-30% improvement in phase performance",
          priority: 2,
          parameters: {
            phaseIndex: index,
            optimizationType: "conditions_adjustment",
            targetSuccessRate: 70,
          },
        });
      }
    });

    return recommendations;
  }

  private calculateAverageTradeSize(executionSummary: any): number {
    if (!executionSummary.totalPnl || !executionSummary.phases) return 0;
    return Math.abs(executionSummary.totalPnl / executionSummary.phases);
  }

  private calculateProfitFactor(executionSummary: any): number {
    const successful = executionSummary.successful || 0;
    const failed = executionSummary.failed || 0;
    return failed > 0 ? successful / failed : successful > 0 ? 2.0 : 0;
  }

  private calculateAverageDrawdown(executionSummary: any): number {
    // Simplified drawdown calculation
    const failed = executionSummary.failed || 0;
    const total = executionSummary.phases || 1;
    return (failed / total) * 15; // Estimate 15% max drawdown per failed phase
  }

  private calculateRiskAdjustedReturn(strategyData: any): number {
    const totalReturn = strategyData.totalPnl || 0;
    const riskLevel = strategyData.configuration?.riskLevel || "medium";
    const riskMultiplier =
      { low: 1.2, medium: 1.0, high: 0.8 }[riskLevel] || 1.0;
    return totalReturn * riskMultiplier;
  }

  private calculateEfficiency(strategyData: any): string {
    const successRate = strategyData.successRate || 0;
    const totalPnl = strategyData.totalPnl || 0;

    if (successRate > 70 && totalPnl > 100) return "high";
    if (successRate > 50 && totalPnl > 50) return "medium";
    return "low";
  }

  private analyzeTrends(strategyData: any, analysisType: string) {
    // Simplified trend analysis
    const recentPerformance = strategyData.successRate || 0;

    return {
      performanceTrend:
        recentPerformance > 60
          ? "improving"
          : recentPerformance > 40
            ? "stable"
            : "declining",
      riskTrend: "stable", // Placeholder
      profitTrend: strategyData.totalPnl > 0 ? "positive" : "negative",
      analysisType,
    };
  }

  private calculateRiskMetrics(strategyData: any) {
    return {
      volatility: strategyData.configuration?.volatility || "medium",
      maxDrawdown: this.calculateAverageDrawdown(
        strategyData.executionSummary || {}
      ),
      riskLevel: strategyData.configuration?.riskLevel || "medium",
      sharpeRatio: this.calculateSharpeRatio(strategyData),
    };
  }

  private calculateSharpeRatio(strategyData: any): number {
    // Simplified Sharpe ratio calculation
    const returns = strategyData.totalPnl || 0;
    const riskFreeRate = 0.02; // 2% risk-free rate
    const volatility = 0.15; // Assumed 15% volatility

    return (returns - riskFreeRate) / volatility;
  }

  private buildInsightPrompt(
    strategyData: any,
    performanceAnalysis: any
  ): string {
    return `Analyze the performance of trading strategy "${strategyData.name}" for symbol ${strategyData.symbol}.

Performance Metrics:
- Total P&L: ${performanceAnalysis.totalPnl}
- Success Rate: ${performanceAnalysis.successRate}%
- Total Trades: ${performanceAnalysis.totalTrades}
- Profit Factor: ${performanceAnalysis.profitFactor}
- Risk-Adjusted Return: ${performanceAnalysis.riskAdjustedReturn}

Strategy Configuration:
- Phases: ${strategyData.phases.length}
- Status: ${strategyData.status}
- Last Executed: ${strategyData.lastExecuted}

Please provide insights on:
1. Overall performance assessment
2. Key strengths and weaknesses
3. Risk factors and concerns
4. Optimization opportunities
5. Market condition suitability`;
  }

  private extractRecommendations(aiContent: string): string[] {
    const recommendations = [];
    const lines = aiContent.split("\n");

    for (const line of lines) {
      if (
        line.includes("recommend") ||
        line.includes("suggest") ||
        line.includes("improve")
      ) {
        recommendations.push(line.trim());
      }
    }

    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }

  private extractRiskAssessment(aiContent: string): string {
    const riskKeywords = ["risk", "danger", "caution", "warning"];
    const lines = aiContent.split("\n");

    for (const line of lines) {
      for (const keyword of riskKeywords) {
        if (line.toLowerCase().includes(keyword)) {
          return line.trim();
        }
      }
    }

    return "No specific risk concerns identified";
  }

  private parseTimeframeToDays(timeframe: string): number {
    const timeframeMap: Record<string, number> = {
      "1d": 1,
      "7d": 7,
      "30d": 30,
      "90d": 90,
      "1y": 365,
    };

    return timeframeMap[timeframe] || 30; // Default to 30 days
  }

  private calculateAggregatedMetrics(strategies: any[]) {
    const totalStrategies = strategies.length;
    const activeStrategies = strategies.filter(
      (s) => s.status === "active"
    ).length;
    const totalPnl = strategies.reduce((sum, s) => sum + (s.totalPnl || 0), 0);
    const averageSuccessRate =
      strategies.reduce((sum, s) => sum + (s.successRate || 0), 0) /
        totalStrategies || 0;

    return {
      totalStrategies,
      activeStrategies,
      totalPnl,
      averageSuccessRate,
      averagePnlPerStrategy: totalPnl / totalStrategies || 0,
      topPerformers: strategies
        .sort((a, b) => (b.totalPnl || 0) - (a.totalPnl || 0))
        .slice(0, 5)
        .map((s) => ({ id: s.id, name: s.name, pnl: s.totalPnl })),
    };
  }
}
