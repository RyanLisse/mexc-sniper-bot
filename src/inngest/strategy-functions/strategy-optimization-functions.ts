/**
 * Strategy Optimization Functions
 *
 * Inngest workflow functions for optimizing and recommending multi-phase trading strategies.
 * Extracted from multi-phase-strategy-functions.ts for better modularity.
 */

import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { tradingStrategies } from "@/src/db/schemas/strategies";
import { RiskManagerAgent } from "@/src/mexc-agents/risk-manager-agent";
import { StrategyAgent } from "@/src/mexc-agents/strategy-agent";
import { SymbolAnalysisAgent } from "@/src/mexc-agents/symbol-analysis-agent";
import {
  MultiPhaseStrategyBuilder,
  StrategyPatterns,
} from "@/src/services/multi-phase-strategy-builder";
import {
  multiPhaseTradingService,
  type TradingStrategy,
} from "@/src/services/multi-phase-trading-service";
import { inngest } from "../client";
import type {
  MarketData,
  StrategyOptimizationInput,
  StrategyRecommendationResult,
} from "./strategy-types";

/**
 * Optimize Multi-Phase Strategy Workflow
 */
export const optimizeMultiPhaseStrategy = inngest.createFunction(
  {
    id: "multi-phase-strategy-optimize",
    name: "Optimize Multi-Phase Strategy",
  },
  { event: "multi-phase-strategy/optimize" },
  async ({ event, step }) => {
    const {
      strategyId,
      userId,
      marketData,
      performanceData,
      constraints = {},
    } = event.data as StrategyOptimizationInput;

    // Step 1: Retrieve Current Strategy
    const currentStrategy = await step.run(
      "retrieve-current-strategy",
      async () => {
        const result = await db
          .select()
          .from(tradingStrategies)
          .where(eq(tradingStrategies.id, strategyId))
          .limit(1);

        if (result.length === 0) {
          throw new Error(`Strategy not found: ${strategyId}`);
        }

        return result[0] as TradingStrategy;
      }
    );

    // Step 2: Performance Analysis
    const performanceAnalysis = await step.run(
      "analyze-current-performance",
      async () => {
        try {
          const performance =
            await multiPhaseTradingService.getStrategyPerformance(strategyId);

          return {
            successRate: performance.successRate || 0,
            totalReturn: performance.totalPnl || 0,
            maxDrawdown: performance.maxDrawdown || 0,
            sharpeRatio: performance.sharpeRatio || 0,
            averageTradeReturn: performance.averageReturn || 0,
            totalTrades: performance.totalTrades || 0,
            profitableTrades: performance.successfulTrades || 0,
            winLossRatio: performance.winLossRatio || 0,
          };
        } catch (error) {
          // Use provided performance data as fallback
          return {
            successRate: performanceData?.successRate || 0,
            totalReturn: performanceData?.totalReturn || 0,
            maxDrawdown: performanceData?.maxDrawdown || 0,
            sharpeRatio: performanceData?.sharpeRatio || 0,
            averageTradeReturn: performanceData?.averageTradeReturn || 0,
            totalTrades: performanceData?.totalTrades || 0,
            profitableTrades: performanceData?.profitableTrades || 0,
            winLossRatio: performanceData?.winLossRatio || 0,
          };
        }
      }
    );

    // Step 3: Identify Optimization Opportunities
    const optimizationOpportunities = await step.run(
      "identify-optimization-opportunities",
      async () => {
        const opportunities = [];

        // Success rate optimization
        if (performanceAnalysis.successRate < 60) {
          opportunities.push({
            area: "entry_criteria",
            priority: "high",
            description: "Improve entry criteria to increase success rate",
            currentValue: performanceAnalysis.successRate,
            targetValue: 70,
          });
        }

        // Risk management optimization
        if (performanceAnalysis.maxDrawdown > 0.15) {
          opportunities.push({
            area: "risk_management",
            priority: "high",
            description: "Reduce maximum drawdown through better risk controls",
            currentValue: performanceAnalysis.maxDrawdown,
            targetValue: 0.1,
          });
        }

        // Return optimization
        if (performanceAnalysis.sharpeRatio < 1.0) {
          opportunities.push({
            area: "return_optimization",
            priority: "medium",
            description: "Improve risk-adjusted returns",
            currentValue: performanceAnalysis.sharpeRatio,
            targetValue: 1.5,
          });
        }

        // Trade frequency optimization
        if (performanceAnalysis.totalTrades < 10) {
          opportunities.push({
            area: "frequency",
            priority: "low",
            description:
              "Increase trading frequency for better statistical significance",
            currentValue: performanceAnalysis.totalTrades,
            targetValue: 20,
          });
        }

        return opportunities;
      }
    );

    // Step 4: Generate Optimized Parameters
    const optimizedParameters = await step.run(
      "generate-optimized-parameters",
      async () => {
        const strategyAgent = new StrategyAgent({ userId, preferences: {} });
        const riskAgent = new RiskManagerAgent({
          userId,
          capital: currentStrategy.parameters?.capital || 10000,
          riskTolerance: currentStrategy.parameters?.riskTolerance || "medium",
        });

        const optimizations = {};

        for (const opportunity of optimizationOpportunities) {
          try {
            let optimization;

            switch (opportunity.area) {
              case "entry_criteria":
                optimization = await strategyAgent.optimizeEntryConditions({
                  currentConditions:
                    currentStrategy.parameters?.selectedStrategy
                      ?.entryConditions || {},
                  marketData,
                  performanceData: performanceAnalysis,
                  target: opportunity.targetValue,
                });
                break;

              case "risk_management":
                optimization = await riskAgent.optimizeRiskParameters({
                  currentParams:
                    currentStrategy.parameters?.riskAssessment || {},
                  performanceData: performanceAnalysis,
                  target: opportunity.targetValue,
                });
                break;

              case "return_optimization":
                optimization = await strategyAgent.optimizeReturns({
                  strategy: currentStrategy,
                  marketData,
                  performanceData: performanceAnalysis,
                  target: opportunity.targetValue,
                });
                break;

              case "frequency":
                optimization = await strategyAgent.optimizeFrequency({
                  strategy: currentStrategy,
                  marketData,
                  target: opportunity.targetValue,
                });
                break;

              default:
                optimization = {
                  message: "Optimization not implemented for this area",
                };
            }

            optimizations[opportunity.area] = {
              opportunity,
              optimization,
              status: "success",
            };
          } catch (error) {
            optimizations[opportunity.area] = {
              opportunity,
              optimization: null,
              status: "failed",
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        }

        return optimizations;
      }
    );

    // Step 5: Create Optimized Strategy
    const optimizedStrategy = await step.run(
      "create-optimized-strategy",
      async () => {
        const builder = new MultiPhaseStrategyBuilder();

        // Start with current strategy configuration
        const baseConfig = currentStrategy.parameters?.multiPhaseConfig || {};

        const optimized = builder
          .setSymbol(currentStrategy.symbol)
          .setTimeframe(currentStrategy.parameters?.timeframe || "1h")
          .setCapital(currentStrategy.parameters?.capital || 10000);

        // Apply optimizations
        const riskOptimization =
          optimizedParameters.risk_management?.optimization;
        if (riskOptimization) {
          optimized.setRiskParameters({
            maxPositionSize:
              riskOptimization.maxPositionSize ||
              baseConfig.riskParameters?.maxPositionSize,
            stopLoss:
              riskOptimization.stopLoss || baseConfig.riskParameters?.stopLoss,
            takeProfit:
              riskOptimization.takeProfit ||
              baseConfig.riskParameters?.takeProfit,
            maxDrawdown:
              riskOptimization.maxDrawdown ||
              baseConfig.riskParameters?.maxDrawdown,
          });
        }

        // Apply entry criteria optimizations
        const entryOptimization =
          optimizedParameters.entry_criteria?.optimization;
        if (entryOptimization && baseConfig.phases) {
          for (const [index, phase] of baseConfig.phases.entries()) {
            if (phase.name === "Entry Phase" && entryOptimization.conditions) {
              const optimizedPhase = {
                ...phase,
                conditions: {
                  ...phase.conditions,
                  ...entryOptimization.conditions,
                },
              };
              optimized.updatePhase(index, optimizedPhase);
            }
          }
        }

        return optimized.build();
      }
    );

    // Step 6: Validate Optimized Strategy
    const validation = await step.run(
      "validate-optimized-strategy",
      async () => {
        try {
          // Validate that optimizations are within constraints
          const constraintChecks = {
            maxDrawdownConstraint:
              !constraints.maxDrawdown ||
              (optimizedStrategy.riskParameters?.maxDrawdown || 0) <=
                constraints.maxDrawdown,
            minSuccessRateConstraint:
              !constraints.minSuccessRate ||
              performanceAnalysis.successRate >=
                (constraints.minSuccessRate || 0),
            budgetConstraint:
              !constraints.maxCapital ||
              (optimizedStrategy.capital || 0) <= constraints.maxCapital,
          };

          const validationPassed = Object.values(constraintChecks).every(
            (check) => check
          );

          return {
            valid: validationPassed,
            constraintChecks,
            warnings: validationPassed
              ? []
              : ["Some optimizations exceed specified constraints"],
          };
        } catch (error) {
          return {
            valid: false,
            constraintChecks: {},
            warnings: ["Validation failed"],
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      }
    );

    // Step 7: Calculate Expected Improvements
    const expectedImprovements = await step.run(
      "calculate-expected-improvements",
      async () => {
        const improvements = {};

        for (const [area, optimization] of Object.entries(
          optimizedParameters
        )) {
          if (optimization.status === "success" && optimization.optimization) {
            const currentValue = optimization.opportunity.currentValue;
            const targetValue = optimization.opportunity.targetValue;
            const expectedImprovement =
              ((targetValue - currentValue) / currentValue) * 100;

            improvements[area] = {
              currentValue,
              targetValue,
              expectedImprovementPercent: expectedImprovement,
              confidence: optimization.optimization.confidence || 0.7,
            };
          }
        }

        return improvements;
      }
    );

    return {
      strategyId,
      currentStrategy,
      performanceAnalysis,
      optimizationOpportunities,
      optimizedParameters,
      optimizedStrategy,
      validation,
      expectedImprovements,
      metadata: {
        optimizationTimestamp: new Date().toISOString(),
        processingTime: Date.now() - event.ts,
        constraintsApplied: Object.keys(constraints).length,
      },
    };
  }
);

/**
 * Recommend Multi-Phase Strategy Workflow
 */
export const recommendMultiPhaseStrategy = inngest.createFunction(
  {
    id: "multi-phase-strategy-recommend",
    name: "Recommend Multi-Phase Strategy",
  },
  { event: "multi-phase-strategy/recommend" },
  async ({ event, step }) => {
    const {
      userId,
      symbol,
      marketData,
      riskTolerance = "medium",
      capital = 10000,
      preferences = {},
    } = event.data;

    // Step 1: Market Analysis for Recommendations
    const marketAnalysis = await step.run(
      "analyze-market-for-recommendations",
      async () => {
        const symbolAgent = new SymbolAnalysisAgent({
          symbol,
          analysisDepth: "comprehensive",
          includeNews: true,
          includeTechnical: true,
        });

        try {
          const analysis = await symbolAgent.analyzeSymbol({
            symbol,
            marketData,
            timeframe: "1h",
            depth: "full",
          });

          return {
            trend: analysis.trend || "neutral",
            volatility: analysis.volatility || 0.5,
            momentum: analysis.momentum || 0.5,
            support: analysis.support || marketData.price * 0.95,
            resistance: analysis.resistance || marketData.price * 1.05,
            sentiment: analysis.sentiment || "neutral",
            technicalSignals: analysis.technicalIndicators || {},
          };
        } catch (error) {
          // Fallback analysis based on basic market data
          return {
            trend: marketData.change24h > 0 ? "bullish" : "bearish",
            volatility: Math.abs(marketData.change24h) / 100,
            momentum: marketData.volume > 1000000 ? 0.7 : 0.4,
            support: marketData.low24h,
            resistance: marketData.high24h,
            sentiment: "neutral",
            technicalSignals: {},
          };
        }
      }
    );

    // Step 2: Strategy Pattern Recommendation
    const recommendedPattern = await step.run(
      "recommend-strategy-pattern",
      async () => {
        const { trend, volatility, momentum } = marketAnalysis;

        let pattern;
        let reasoning;

        if (volatility > 0.6 && momentum > 0.6) {
          pattern = StrategyPatterns.MOMENTUM_BREAKOUT;
          reasoning = "High volatility and momentum favor breakout strategies";
        } else if (trend === "bullish" && volatility < 0.4) {
          pattern = StrategyPatterns.TREND_FOLLOWING;
          reasoning =
            "Strong uptrend with low volatility suits trend following";
        } else if (trend === "bearish" && volatility > 0.5) {
          pattern = StrategyPatterns.REVERSAL_SCALPING;
          reasoning =
            "Bearish trend with high volatility presents reversal opportunities";
        } else if (volatility < 0.3) {
          pattern = StrategyPatterns.RANGE_TRADING;
          reasoning = "Low volatility suggests range-bound trading";
        } else {
          pattern = StrategyPatterns.ADAPTIVE_MULTI_TIMEFRAME;
          reasoning = "Mixed signals require adaptive multi-timeframe approach";
        }

        return { pattern, reasoning };
      }
    );

    // Step 3: Risk Assessment for Recommendation
    const riskAssessment = await step.run(
      "assess-risk-for-recommendation",
      async () => {
        const riskAgent = new RiskManagerAgent({
          userId,
          capital,
          riskTolerance,
        });

        try {
          const assessment = await riskAgent.assessRisk({
            symbol,
            marketData,
            marketAnalysis,
            capital,
            riskTolerance,
          });

          return {
            riskLevel: riskTolerance,
            riskScore: assessment.riskScore || 5,
            maxPositionSize: assessment.maxPositionSize || capital * 0.1,
            recommendedStopLoss: assessment.stopLossThreshold || 0.02,
            recommendedTakeProfit: assessment.takeProfitThreshold || 0.04,
            timeHorizon: assessment.timeHorizon || "medium",
            suitabilityScore: assessment.suitabilityScore || 70,
          };
        } catch (error) {
          // Fallback risk assessment
          const riskMultiplier =
            riskTolerance === "low" ? 0.5 : riskTolerance === "high" ? 2 : 1;

          return {
            riskLevel: riskTolerance,
            riskScore:
              riskTolerance === "low" ? 3 : riskTolerance === "high" ? 7 : 5,
            maxPositionSize: capital * 0.1 * riskMultiplier,
            recommendedStopLoss: 0.02 / riskMultiplier,
            recommendedTakeProfit: 0.04 * riskMultiplier,
            timeHorizon:
              riskTolerance === "low"
                ? "long"
                : riskTolerance === "high"
                  ? "short"
                  : "medium",
            suitabilityScore: 60,
          };
        }
      }
    );

    // Step 4: Generate Strategy Recommendation
    const strategyRecommendation = await step.run(
      "generate-strategy-recommendation",
      async () => {
        const builder = new MultiPhaseStrategyBuilder();

        const strategy = builder
          .setSymbol(symbol)
          .setTimeframe(riskAssessment.timeHorizon === "short" ? "15m" : "1h")
          .setCapital(capital)
          .setRiskParameters({
            maxPositionSize: riskAssessment.maxPositionSize,
            stopLoss: riskAssessment.recommendedStopLoss,
            takeProfit: riskAssessment.recommendedTakeProfit,
            maxDrawdown: 0.1,
          })
          .setMarketConditions(marketAnalysis)
          .addPhase("analysis", {
            name: "Market Analysis Phase",
            conditions: { marketTrend: marketAnalysis.trend },
            actions: { monitor: true, analyze: true },
            riskControls: { stopOnVolatility: 0.8 },
          })
          .addPhase("entry", {
            name: "Entry Phase",
            conditions: { pattern: recommendedPattern.pattern },
            actions: { enter: true, size: riskAssessment.maxPositionSize },
            riskControls: { stopLoss: riskAssessment.recommendedStopLoss },
          })
          .addPhase("management", {
            name: "Position Management",
            conditions: { inPosition: true },
            actions: { trail: true, scale: true },
            riskControls: { takeProfit: riskAssessment.recommendedTakeProfit },
          })
          .build();

        return {
          name: `${recommendedPattern.pattern} Strategy for ${symbol}`,
          description: `${recommendedPattern.reasoning}. Suitable for ${riskAssessment.riskLevel} risk tolerance.`,
          levels: strategy.phases,
          pattern: recommendedPattern.pattern,
          strategy,
        };
      }
    );

    // Step 5: Generate Alternative Strategies
    const alternativeStrategies = await step.run(
      "generate-alternative-strategies",
      async () => {
        const alternatives = [];

        // Generate 2-3 alternative strategies with different patterns
        const alternativePatterns = Object.values(StrategyPatterns)
          .filter((pattern) => pattern !== recommendedPattern.pattern)
          .slice(0, 3);

        for (const pattern of alternativePatterns) {
          try {
            const altBuilder = new MultiPhaseStrategyBuilder();
            const altStrategy = altBuilder
              .setSymbol(symbol)
              .setTimeframe("1h")
              .setCapital(capital)
              .setRiskParameters({
                maxPositionSize: riskAssessment.maxPositionSize * 0.8, // More conservative
                stopLoss: riskAssessment.recommendedStopLoss * 1.2,
                takeProfit: riskAssessment.recommendedTakeProfit * 0.8,
                maxDrawdown: 0.08,
              })
              .addPhase("entry", {
                name: "Conservative Entry",
                conditions: { pattern },
                actions: { enter: true },
                riskControls: {},
              })
              .build();

            alternatives.push({
              name: `${pattern} Alternative`,
              description: `Alternative ${pattern} approach with conservative parameters`,
              levels: altStrategy.phases,
              pattern,
            });
          } catch (error) {}
        }

        return alternatives;
      }
    );

    // Step 6: Generate Execution Guidance
    const executionGuidance = await step.run(
      "generate-execution-guidance",
      async () => {
        return {
          optimalEntryConditions: [
            `Wait for ${marketAnalysis.trend} trend confirmation`,
            `Ensure volatility is within ${marketAnalysis.volatility.toFixed(2)} range`,
            `Monitor volume above ${(marketData.volume * 0.8).toLocaleString()} threshold`,
          ],
          monitoringPoints: [
            "Track support/resistance levels",
            "Monitor risk metrics continuously",
            "Watch for trend reversal signals",
            "Observe volume patterns",
          ],
          riskManagement: [
            `Set stop loss at ${(riskAssessment.recommendedStopLoss * 100).toFixed(1)}%`,
            `Take profits at ${(riskAssessment.recommendedTakeProfit * 100).toFixed(1)}%`,
            `Position size: ${riskAssessment.maxPositionSize.toLocaleString()} maximum`,
            "Use trailing stops in trending markets",
          ],
        };
      }
    );

    const result: StrategyRecommendationResult = {
      recommendedStrategy: strategyRecommendation,
      riskAssessment,
      alternativeStrategies,
      executionGuidance,
      reasoning: `${recommendedPattern.reasoning} Based on current market analysis showing ${marketAnalysis.trend} trend with ${(marketAnalysis.volatility * 100).toFixed(1)}% volatility.`,
    };

    return {
      recommendation: result,
      marketAnalysis,
      metadata: {
        recommendationTimestamp: new Date().toISOString(),
        processingTime: Date.now() - event.ts,
        symbol,
        riskTolerance,
      },
    };
  }
);
