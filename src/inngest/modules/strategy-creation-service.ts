/**
 * Strategy Creation Service
 *
 * Handles multi-phase strategy creation workflow logic
 */

import { CalendarAgent } from "@/src/mexc-agents/calendar-agent";
import { RiskManagerAgent } from "@/src/mexc-agents/risk-manager-agent";
import { StrategyAgent } from "@/src/mexc-agents/strategy-agent";
import { SymbolAnalysisAgent } from "@/src/mexc-agents/symbol-analysis-agent";
import {
  MultiPhaseStrategyBuilder,
  type StrategyPattern,
  StrategyPatterns,
} from "../../services/multi-phase-strategy-builder";
import {
  multiPhaseTradingService,
  type PREDEFINED_STRATEGIES,
  type TradingStrategy,
} from "../../services/multi-phase-trading-service";
import type {
  MultiPhaseStrategyCreateEvent,
  ServiceResponse,
  StrategyRecommendationResult,
} from "../types/multi-phase-strategy-types";

export class StrategyCreationService {
  private agents: {
    strategyAgent: StrategyAgent;
    calendarAgent: CalendarAgent;
    symbolAnalysisAgent: SymbolAnalysisAgent;
    riskManagerAgent: RiskManagerAgent;
  };

  constructor() {
    this.agents = {
      strategyAgent: new StrategyAgent(),
      calendarAgent: new CalendarAgent(),
      symbolAnalysisAgent: new SymbolAnalysisAgent(),
      riskManagerAgent: new RiskManagerAgent(),
    };
  }

  async executeCreationWorkflow(
    data: MultiPhaseStrategyCreateEvent["data"],
    step: any
  ): Promise<ServiceResponse> {
    const {
      userId,
      symbol,
      marketData,
      riskTolerance,
      timeframe,
      capital,
      entryPrice,
      aiRecommendation,
      workflowId,
    } = data;

    // Step 2: Analyze market conditions
    const marketAnalysis = await step.run("analyze-market", async () => {
      return this.analyzeMarketConditions({
        marketData,
        symbol,
        riskTolerance,
        timeframe,
      });
    });

    // Step 3: Generate strategy recommendation
    const strategyRecommendation = await step.run(
      "generate-strategy",
      async () => {
        return this.generateStrategyRecommendation({
          marketAnalysis,
          riskTolerance,
          timeframe,
        });
      }
    );

    // Step 4: Risk assessment and position sizing
    const riskAssessment = await step.run("assess-risk", async () => {
      return this.performRiskAssessment({
        strategy: strategyRecommendation.strategy,
        capital,
        entryPrice,
        riskTolerance,
        marketAnalysis,
        symbol,
      });
    });

    // Step 5: Create and store strategy
    const createdStrategy = await step.run("create-strategy", async () => {
      return this.createAndStoreStrategy({
        userId,
        symbol,
        strategy: strategyRecommendation.strategy,
        riskAssessment,
        marketAnalysis,
        workflowId,
      });
    });

    // Step 6: Schedule execution if auto-start is enabled
    const scheduledExecution = await step.run(
      "schedule-execution",
      async () => {
        return this.scheduleStrategyExecution(createdStrategy, data);
      }
    );

    return {
      success: true,
      data: {
        strategyId: createdStrategy.id,
        recommendation: strategyRecommendation,
        riskAssessment,
        marketAnalysis,
        scheduledExecution,
        workflowId,
      },
      timestamp: new Date().toISOString(),
      metadata: {
        userId,
        symbol,
        riskTolerance,
        timeframe,
      },
    };
  }

  private async analyzeMarketConditions(params: {
    marketData: Record<string, unknown>;
    symbol: string;
    riskTolerance: string;
    timeframe: string;
  }) {
    const { strategyAgent } = this.agents;
    const { marketData, symbol, riskTolerance, timeframe } = params;

    const analysis = await strategyAgent.process(marketData, {
      marketData,
      symbol,
      riskTolerance,
      timeframe,
      objectives: ["trend analysis", "volatility assessment", "entry timing"],
    });

    return {
      analysis: analysis.content,
      confidence: 75, // Default confidence level
      timestamp: new Date().toISOString(),
      volatilityLevel: this.assessVolatility(analysis.content),
      trendDirection: this.assessTrend(analysis.content),
    };
  }

  private async generateStrategyRecommendation(params: {
    marketAnalysis: any;
    riskTolerance: string;
    timeframe: string;
  }): Promise<{
    strategy: TradingStrategy;
    templateUsed: string;
    adjustments: string;
  }> {
    const { marketAnalysis, riskTolerance, timeframe } = params;

    // Determine optimal strategy based on analysis
    let recommendedTemplate: keyof typeof PREDEFINED_STRATEGIES =
      "CONSERVATIVE_SNIPER";

    if (riskTolerance === "low") {
      recommendedTemplate = "CONSERVATIVE_SNIPER";
    } else if (riskTolerance === "high" && timeframe === "long") {
      recommendedTemplate = "AGGRESSIVE_MOMENTUM";
    } else if (timeframe === "short") {
      recommendedTemplate = "AGGRESSIVE_MOMENTUM";
    }

    const builder = new MultiPhaseStrategyBuilder();

    // Adjust strategy based on market conditions and risk tolerance
    const analysisText = String(marketAnalysis.analysis || "");
    const adjustmentType = this.determineStrategyAdjustment(
      analysisText,
      marketAnalysis
    );

    if (adjustmentType === "volatility") {
      const volatilityStrategy = StrategyPatterns.QUICK_ENTRY;
      builder.addPhase(volatilityStrategy.phases[0]);
    } else {
      const accumulationStrategy = StrategyPatterns.GRADUAL_ACCUMULATION;
      builder.addPhase(accumulationStrategy.phases[0]);
    }

    const customStrategy = builder.build();

    return {
      strategy: customStrategy,
      templateUsed: recommendedTemplate,
      adjustments:
        adjustmentType === "volatility" ? "volatility-adjusted" : "standard",
    };
  }

  private async performRiskAssessment(params: {
    strategy: TradingStrategy;
    capital: number;
    entryPrice?: number;
    riskTolerance: string;
    marketAnalysis: any;
    symbol: string;
  }) {
    const { riskManagerAgent } = this.agents;
    const {
      strategy,
      capital,
      entryPrice,
      riskTolerance,
      marketAnalysis,
      symbol,
    } = params;

    const strategyName = String(strategy?.name || "Unknown Strategy");
    const riskAnalysis = await riskManagerAgent.process(
      `Strategy: ${strategyName}
       Symbol: ${symbol}
       Capital: ${capital || "Not specified"}
       Entry Price: ${entryPrice || "Not specified"}
       Market Analysis: ${marketAnalysis.analysis}`,
      {
        riskTolerance,
        capital,
        entryPrice,
        strategy,
      }
    );

    return {
      analysis: riskAnalysis.content,
      riskScore: this.calculateRiskScore(riskAnalysis.content),
      positionSizing: this.calculatePositionSizing(capital, riskTolerance),
      stopLossLevel: this.calculateStopLoss(entryPrice, riskTolerance),
      recommendations: this.extractRiskRecommendations(riskAnalysis.content),
    };
  }

  private async createAndStoreStrategy(params: {
    userId: string;
    symbol: string;
    strategy: TradingStrategy;
    riskAssessment: any;
    marketAnalysis: any;
    workflowId: string;
  }) {
    const {
      userId,
      symbol,
      strategy,
      riskAssessment,
      marketAnalysis,
      workflowId,
    } = params;

    const strategyData = {
      userId,
      symbol,
      name: strategy.name,
      description: strategy.description,
      phases: strategy.phases,
      riskLevel: riskAssessment.riskScore,
      marketConditions: marketAnalysis.analysis,
      workflowId,
      createdAt: new Date(),
      status: "created",
    };

    return multiPhaseTradingService.createStrategy(strategyData);
  }

  private async scheduleStrategyExecution(
    createdStrategy: any,
    originalData: any
  ) {
    // Check if auto-start is enabled in the original request
    const autoStart = (originalData as any).autoStart || false;

    if (!autoStart) {
      return { scheduled: false, reason: "Auto-start disabled" };
    }

    // Schedule strategy execution
    const executionSchedule = {
      strategyId: createdStrategy.id,
      scheduledAt: new Date(Date.now() + 60000), // 1 minute delay
      executionMode: "automatic",
    };

    return {
      scheduled: true,
      schedule: executionSchedule,
      estimatedStart: executionSchedule.scheduledAt,
    };
  }

  // Helper methods
  private assessVolatility(analysisText: string): string {
    if (
      analysisText.includes("high volatility") ||
      analysisText.includes("volatile")
    ) {
      return "high";
    } else if (analysisText.includes("moderate volatility")) {
      return "moderate";
    }
    return "low";
  }

  private assessTrend(analysisText: string): string {
    if (analysisText.includes("uptrend") || analysisText.includes("bullish")) {
      return "bullish";
    } else if (
      analysisText.includes("downtrend") ||
      analysisText.includes("bearish")
    ) {
      return "bearish";
    }
    return "sideways";
  }

  private determineStrategyAdjustment(
    analysisText: string,
    marketAnalysis: any
  ): string {
    if (
      analysisText.includes("high volatility") ||
      analysisText.includes("volatile") ||
      marketAnalysis.volatilityLevel === "high"
    ) {
      return "volatility";
    }
    return "standard";
  }

  private calculateRiskScore(riskAnalysisText: string): number {
    // Simple risk scoring based on analysis content
    let score = 5; // Base score (medium risk)

    if (riskAnalysisText.includes("high risk")) score += 3;
    if (riskAnalysisText.includes("low risk")) score -= 2;
    if (riskAnalysisText.includes("volatile")) score += 2;
    if (riskAnalysisText.includes("stable")) score -= 1;

    return Math.max(1, Math.min(10, score));
  }

  private calculatePositionSizing(
    capital: number,
    riskTolerance: string
  ): number {
    const riskFactors = {
      low: 0.02, // 2% risk
      medium: 0.05, // 5% risk
      high: 0.1, // 10% risk
    };

    const factor =
      riskFactors[riskTolerance as keyof typeof riskFactors] || 0.05;
    return capital * factor;
  }

  private calculateStopLoss(
    entryPrice?: number,
    riskTolerance?: string
  ): number | null {
    if (!entryPrice) return null;

    const stopLossPercentages = {
      low: 0.02, // 2% stop loss
      medium: 0.05, // 5% stop loss
      high: 0.08, // 8% stop loss
    };

    const percentage =
      stopLossPercentages[riskTolerance as keyof typeof stopLossPercentages] ||
      0.05;
    return entryPrice * (1 - percentage);
  }

  private extractRiskRecommendations(riskAnalysisText: string): string[] {
    const recommendations = [];

    if (riskAnalysisText.includes("diversify")) {
      recommendations.push("Consider portfolio diversification");
    }
    if (riskAnalysisText.includes("stop loss")) {
      recommendations.push("Implement strict stop-loss levels");
    }
    if (riskAnalysisText.includes("position size")) {
      recommendations.push("Optimize position sizing");
    }

    return recommendations.length > 0
      ? recommendations
      : ["Monitor market conditions closely"];
  }
}
