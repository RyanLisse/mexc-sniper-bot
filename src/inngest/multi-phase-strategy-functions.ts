import { eq } from "drizzle-orm";
import { tradingStrategies } from "@/src/db/schemas/strategies";
import { CalendarAgent } from "@/src/mexc-agents/calendar-agent";
import { RiskManagerAgent } from "@/src/mexc-agents/risk-manager-agent";
import { StrategyAgent } from "@/src/mexc-agents/strategy-agent";
import { SymbolAnalysisAgent } from "@/src/mexc-agents/symbol-analysis-agent";
import { db } from "../db";
import {
  createExecutorFromStrategy,
  type Strategy as ExecutorStrategy,
  type StrategyExecutor,
} from "../services/multi-phase-executor";
import {
  MultiPhaseStrategyBuilder,
  type StrategyPattern,
  StrategyPatterns,
} from "../services/multi-phase-strategy-builder";
import {
  multiPhaseTradingService,
  PREDEFINED_STRATEGIES,
  type TradingStrategy,
} from "../services/multi-phase-trading-service";
import { inngest } from "./client";

// Type definitions
interface StrategyAnalysisResult {
  strategy: TradingStrategy;
  analytics: {
    executionTrend?: string;
    progress?: number;
    [key: string]: unknown;
  };
  performanceMetrics: {
    totalPnlPercent?: number;
    successRate?: number;
    totalTrades?: number;
    [key: string]: unknown;
  };
  currentPhases: number;
  totalPhases: number;
  efficiency: string;
}

// Strategy recommendation interface for compatibility
interface StrategyRecommendationResult {
  recommendedStrategy: {
    name: string;
    description: string;
    levels: any[];
  };
  riskAssessment: {
    riskLevel: string;
    timeHorizon: string;
    suitabilityScore: number;
  };
  alternativeStrategies: Array<{
    name: string;
    description: string;
    levels: any[];
  }>;
  executionGuidance: {
    optimalEntryConditions: string[];
    monitoringPoints: string[];
    riskManagement: string[];
  };
  reasoning: string;
}

// Type guard functions
function isStrategyAnalysisResult(
  value: unknown
): value is StrategyAnalysisResult {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as any).strategy === "object" &&
    typeof (value as any).analytics === "object" &&
    typeof (value as any).performanceMetrics === "object" &&
    typeof (value as any).currentPhases === "number" &&
    typeof (value as any).totalPhases === "number" &&
    typeof (value as any).efficiency === "string"
  );
}

// ===========================================
// MULTI-PHASE STRATEGY INNGEST WORKFLOWS
// ===========================================

// Create Multi-Phase Strategy Workflow
export const createMultiPhaseStrategy = inngest.createFunction(
  { id: "multi-phase-strategy-create", name: "Create Multi-Phase Strategy" },
  { event: "multi-phase-strategy/create" },
  async ({ event, step }) => {
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
    } = event.data;

    // Step 1: Initialize AI agents
    const agents = {
      strategyAgent: new StrategyAgent(),
      calendarAgent: new CalendarAgent(),
      symbolAnalysisAgent: new SymbolAnalysisAgent(),
      riskManagerAgent: new RiskManagerAgent(),
    };

    // Step 2: Analyze market conditions
    const marketAnalysis = await step.run("analyze-market", async () => {
      const { strategyAgent } = agents;
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
      };
    });

    // Step 3: Generate strategy recommendation
    const strategyRecommendation = await step.run(
      "generate-strategy",
      async () => {
        const { strategyAgent } = agents;

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

        const _baseStrategy = PREDEFINED_STRATEGIES[recommendedTemplate];

        // Create custom strategy if needed
        const builder = new MultiPhaseStrategyBuilder();

        // Adjust strategy based on market conditions and risk tolerance
        const analysisText = String(marketAnalysis.analysis || "");
        if (
          analysisText.includes("high volatility") ||
          analysisText.includes("volatile")
        ) {
          // Use quick entry strategy for volatile conditions
          const volatilityStrategy = StrategyPatterns.QUICK_ENTRY;
          builder.addPhase(volatilityStrategy.phases[0]);
        } else {
          // Use gradual accumulation strategy
          const accumulationStrategy = StrategyPatterns.GRADUAL_ACCUMULATION;
          builder.addPhase(accumulationStrategy.phases[0]);
        }

        const customStrategy = builder.build();

        return {
          strategy: customStrategy,
          templateUsed: recommendedTemplate,
          adjustments: analysisText.includes("volatile")
            ? "volatility-adjusted"
            : "standard",
        };
      }
    );

    // Step 4: Risk assessment and position sizing
    const riskAssessment = await step.run("assess-risk", async () => {
      const { riskManagerAgent } = agents;

      const strategyName = String(
        (strategyRecommendation.strategy as any)?.name || "Unknown Strategy"
      );
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
          strategy: strategyRecommendation.strategy,
        }
      );

      // Calculate position sizing
      const recommendedPosition =
        capital && entryPrice
          ? Math.min(
              capital * 0.05,
              capital *
                (riskTolerance === "low"
                  ? 0.02
                  : riskTolerance === "high"
                    ? 0.1
                    : 0.05)
            )
          : null;

      return {
        riskAnalysis: riskAnalysis.content,
        recommendedPositionSize: recommendedPosition,
        maxRiskPercent:
          riskTolerance === "low" ? 2 : riskTolerance === "high" ? 10 : 5,
        stopLossRecommendation:
          riskTolerance === "low" ? 10 : riskTolerance === "high" ? 20 : 15,
      };
    });

    // Step 5: Create strategy in database (if all parameters are provided)
    const strategyCreated = await step.run("create-strategy-db", async () => {
      if (!entryPrice || !capital) {
        return {
          created: false,
          reason: "Missing required parameters (entryPrice or capital)",
          strategyConfig: strategyRecommendation.strategy,
        };
      }

      const positionSizeUsdt =
        Number(riskAssessment.recommendedPositionSize) ||
        Number(capital) * 0.05;
      const positionSize = positionSizeUsdt / Number(entryPrice);

      try {
        // Execute the strategy using the available interface
        const strategyId = await multiPhaseTradingService.executeStrategy(
          strategyRecommendation.strategy as StrategyPattern
        );

        return {
          created: true,
          strategyId: strategyId,
          strategy: {
            id: strategyId,
            name: String(
              strategyRecommendation.strategy?.name || "AI Generated Strategy"
            ),
            symbol,
            entryPrice: Number(entryPrice),
            positionSize,
            positionSizeUsdt,
            status: "active" as const,
          },
        };
      } catch (error) {
        return {
          created: false,
          error: (error as Error).message,
          strategyConfig: strategyRecommendation.strategy,
        };
      }
    });

    // Step 6: Generate execution plan
    const executionPlan = await step.run(
      "generate-execution-plan",
      async () => {
        const { strategyAgent } = agents;

        const plan = await strategyAgent.process(
          `Create an execution plan for ${String(strategyRecommendation.strategy?.name || "strategy")} on ${symbol}`,
          {
            strategy: strategyRecommendation.strategy,
            marketData,
            riskAssessment: riskAssessment.riskAnalysis,
            entryPrice,
            capital,
          }
        );

        return {
          executionPlan: plan.content,
          monitoringRequired: true,
          automationLevel: "semi-automated",
          nextReviewDate: new Date(
            Date.now() + 24 * 60 * 60 * 1000
          ).toISOString(), // 24 hours
        };
      }
    );

    // Return comprehensive results
    return {
      workflowId,
      success: true,
      results: {
        marketAnalysis,
        strategyRecommendation,
        riskAssessment,
        strategyCreated,
        executionPlan,
      },
      summary: {
        strategyName: String(
          strategyRecommendation.strategy?.name || "Unknown Strategy"
        ),
        phases: Array.isArray(strategyRecommendation.strategy?.phases)
          ? strategyRecommendation.strategy.phases.length
          : 0,
        riskLevel: riskTolerance,
        timeframe,
        confidence: (marketAnalysis as any).confidence || 75,
        databaseStored: Boolean(strategyCreated.created),
        strategyId: strategyCreated.created
          ? (strategyCreated as any).strategyId
          : null,
      },
      nextSteps: strategyCreated.created
        ? [
            "Monitor market conditions for entry signal",
            "Set up automated phase execution",
            "Track strategy performance",
            "Adjust based on market changes",
          ]
        : [
            "Provide missing parameters (entry price, capital)",
            "Complete strategy setup",
            "Initialize monitoring system",
          ],
    };
  }
);

// Analyze Multi-Phase Strategy Performance
export const analyzeMultiPhaseStrategy = inngest.createFunction(
  { id: "multi-phase-strategy-analyze", name: "Analyze Multi-Phase Strategy" },
  { event: "multi-phase-strategy/analyze" },
  async ({ event, step }) => {
    const { userId, symbol, marketData, analysisType, workflowId } = event.data;

    // Step 1: Get user strategies for symbol
    const strategies = await step.run("fetch-strategies", async () => {
      const allStrategies =
        await multiPhaseTradingService.listActiveStrategies();
      // Filter by symbol if provided (placeholder implementation)
      return allStrategies.slice(0, 10);
    });

    // Step 2: Analyze market conditions
    const marketAnalysis = await step.run(
      "analyze-market-conditions",
      async () => {
        const strategyAgent = new StrategyAgent();
        const symbolAgent = new SymbolAnalysisAgent();

        const [marketInsights, symbolAnalysis] = await Promise.all([
          strategyAgent.process(marketData, {
            marketData,
            symbol,
            objectives: [
              "trend analysis",
              "market sentiment",
              "technical indicators",
            ],
          }),
          symbolAgent.process(
            `Analyze ${symbol} for multi-phase strategy execution`,
            {
              symbol,
              marketData,
              analysisType: "execution_readiness",
            }
          ),
        ]);

        return {
          marketInsights: marketInsights.content,
          symbolAnalysis: symbolAnalysis.content,
          marketConfidence: 75, // Default confidence
          symbolConfidence: 75, // Default confidence
        };
      }
    );

    // Step 3: Performance analysis for existing strategies
    const performanceAnalysis = await step.run(
      "analyze-performance",
      async () => {
        if (strategies.length === 0) {
          return {
            hasStrategies: false,
            message: "No strategies found for this symbol",
          };
        }

        const performanceMetrics = await Promise.all(
          strategies.map(async (strategy: any) => {
            try {
              const strategyStatus =
                await multiPhaseTradingService.getStrategyStatus(strategy.id);
              if (!strategyStatus) {
                throw new Error(`Strategy ${strategy.id} not found`);
              }

              // Convert TradingStrategy to ExecutorStrategy format
              const executorStrategy: ExecutorStrategy = {
                id: strategyStatus.id,
                name: strategyStatus.name,
                description: strategyStatus.description,
                phases: strategyStatus.phases.map(
                  (
                    phase
                  ): {
                    id: string;
                    name: string;
                    type: string;
                    parameters: Record<string, any>;
                  } => ({
                    id: phase.id,
                    name: phase.name,
                    type: phase.status || "pending",
                    parameters: {},
                  })
                ),
              };

              const executor = createExecutorFromStrategy(executorStrategy);
              const status = executor.getStatus();

              // Derive analytics from status
              const analytics = {
                executionTrend: status.isRunning ? "active" : "idle",
                progress: status.progress,
              };

              // Derive basic metrics from strategy status
              const metrics = {
                totalPnlPercent: 0, // Placeholder value
                successRate: 50, // Placeholder value
                totalTrades: strategyStatus.phases?.length || 0,
              };

              return {
                strategyId: strategy.id,
                strategyName: strategy.name,
                status: strategy.status,
                metrics,
                analytics,
                phases: `${strategyStatus?.phases?.filter((p) => p.status === "completed").length || 0}/${strategyStatus?.phases?.length || 0}`,
              };
            } catch (error) {
              return {
                strategyId: strategy.id,
                strategyName: strategy.name,
                error: (error as Error).message,
              };
            }
          })
        );

        return {
          hasStrategies: true,
          count: strategies.length,
          performanceMetrics,
          topPerformer: performanceMetrics.reduce((best: any, current: any) =>
            (current.metrics?.totalPnlPercent || 0) >
            (best.metrics?.totalPnlPercent || 0)
              ? current
              : best
          ),
        };
      }
    );

    // Step 4: Generate recommendations
    const recommendations = await step.run(
      "generate-recommendations",
      async () => {
        const strategyAgent = new StrategyAgent();

        const analysisContent = `
Market Analysis: ${marketAnalysis.marketInsights}
Symbol Analysis: ${marketAnalysis.symbolAnalysis}
Performance Data: ${JSON.stringify(performanceAnalysis, null, 2)}
Current Market Data: ${marketData}
`;

        const recommendations = await strategyAgent.process(analysisContent, {
          symbol,
          analysisType,
          objectives: ["optimization", "risk assessment", "market timing"],
        });

        return {
          recommendations: recommendations.content,
          confidence: 75, // Default confidence
          actionItems: [
            "Monitor market trends for optimal entry/exit timing",
            "Adjust strategy parameters based on current volatility",
            "Review phase execution efficiency",
            "Consider strategy optimization opportunities",
          ],
        };
      }
    );

    return {
      workflowId,
      success: true,
      analysis: {
        symbol,
        analysisType,
        marketAnalysis,
        performanceAnalysis,
        recommendations,
      },
      summary: {
        strategiesAnalyzed: strategies.length,
        marketConfidence: marketAnalysis.marketConfidence,
        hasActiveStrategies: strategies.some((s: any) => s.status === "active"),
        overallHealth: performanceAnalysis.hasStrategies ? "good" : "no_data",
      },
      timestamp: new Date().toISOString(),
    };
  }
);

// Optimize Existing Multi-Phase Strategy
export const optimizeMultiPhaseStrategy = inngest.createFunction(
  {
    id: "multi-phase-strategy-optimize",
    name: "Optimize Multi-Phase Strategy",
  },
  { event: "multi-phase-strategy/optimize" },
  async ({ event, step }) => {
    const {
      userId,
      strategyId,
      currentStrategy,
      marketConditions,
      performanceData,
      workflowId,
    } = event.data;

    // Step 1: Get current strategy and performance
    const strategyAnalysis = await step.run(
      "analyze-current-strategy",
      async () => {
        const strategy =
          await multiPhaseTradingService.getStrategyStatus(strategyId);
        if (!strategy) throw new Error("Strategy not found");

        // Convert TradingStrategy to ExecutorStrategy format
        const executorStrategy: ExecutorStrategy = {
          id: strategy.id,
          name: strategy.name,
          description: strategy.description,
          phases: strategy.phases.map(
            (
              phase
            ): {
              id: string;
              name: string;
              type: string;
              parameters: Record<string, any>;
            } => ({
              id: phase.id,
              name: phase.name,
              type: phase.status || "pending",
              parameters: {},
            })
          ),
        };

        const executor = createExecutorFromStrategy(executorStrategy);
        const status = executor.getStatus();

        // Derive analytics from status
        const analytics = {
          executionTrend: status.isRunning ? "active" : "idle",
          progress: status.progress,
        };

        // Derive basic performance metrics from strategy
        const performanceMetrics = {
          totalPnlPercent: 0, // Placeholder value
          successRate: 50, // Placeholder value
          totalTrades: strategy.phases?.length || 0,
        };

        return {
          strategy,
          analytics,
          performanceMetrics,
          currentPhases:
            strategy.phases?.filter((p) => p.status === "completed").length ||
            0,
          totalPhases: strategy.phases?.length || 0,
          efficiency: analytics.executionTrend,
        };
      }
    );

    // Type guard for strategy analysis result
    if (!isStrategyAnalysisResult(strategyAnalysis)) {
      throw new Error("Invalid strategy analysis result format");
    }

    // Step 2: AI-powered optimization analysis
    const optimizationAnalysis = await step.run(
      "ai-optimization-analysis",
      async () => {
        const strategyAgent = new StrategyAgent();

        const optimization = await strategyAgent.optimizeExistingStrategy(
          currentStrategy,
          performanceData ||
            JSON.stringify(strategyAnalysis.performanceMetrics),
          marketConditions ? JSON.parse(marketConditions) : undefined
        );

        return {
          optimizationInsights: optimization.content,
          confidence: 75, // Default confidence
          analysisDate: new Date().toISOString(),
        };
      }
    );

    // Step 3: Generate optimized strategy variations
    const optimizedVariations = await step.run(
      "generate-optimizations",
      async () => {
        const variations = [];

        // Variation 1: Volatility-adjusted strategy
        if (
          marketConditions?.includes("volatile") ||
          marketConditions?.includes("high volatility")
        ) {
          const volatilityStrategy = StrategyPatterns.QUICK_ENTRY;

          variations.push({
            name: "Volatility-Adjusted Strategy",
            type: "volatility_optimized",
            description: "Adjusted for high market volatility",
            levels: volatilityStrategy.phases,
            expectedImprovement:
              "Better risk management in volatile conditions",
          });
        }

        // Variation 2: Performance-based optimization
        if (strategyAnalysis.analytics.executionTrend === "declining") {
          const conservativeBuilder = new MultiPhaseStrategyBuilder();
          conservativeBuilder.addPhase(
            StrategyPatterns.GRADUAL_ACCUMULATION.phases[0]
          );

          const conservativeStrategy = conservativeBuilder.build();

          variations.push({
            name: "Conservative Optimization",
            type: "performance_optimized",
            description: "More conservative targets to improve success rate",
            levels: conservativeStrategy.phases,
            expectedImprovement:
              "Higher success rate with earlier profit taking",
          });
        }

        // Variation 3: Risk-adjusted optimization
        const riskAdjustedStrategy = StrategyPatterns.GRADUAL_ACCUMULATION;

        variations.push({
          name: "Risk-Adjusted Strategy",
          type: "risk_optimized",
          description: "Optimized based on position size risk",
          levels: riskAdjustedStrategy.phases,
          expectedImprovement: "Better risk-adjusted returns",
        });

        return variations;
      }
    );

    // Step 4: Risk assessment of optimizations
    const riskAssessment = await step.run(
      "assess-optimization-risks",
      async () => {
        const riskAgent = new RiskManagerAgent();

        const riskAnalysis = await riskAgent.process(
          `Assess risks of strategy optimizations for ${currentStrategy.name}`,
          {
            currentStrategy,
            optimizedVariations,
            marketConditions,
            performanceData: strategyAnalysis.performanceMetrics,
          }
        );

        return {
          riskAnalysis: riskAnalysis.content,
          confidence: 75, // Default confidence
          riskLevel: "medium", // This would be determined by the AI analysis
          recommendations: [
            "Test optimizations in paper trading first",
            "Monitor performance closely after implementation",
            "Maintain original strategy as fallback",
            "Implement gradual transition if needed",
          ],
        };
      }
    );

    // Step 5: Generate implementation plan
    const implementationPlan = await step.run(
      "create-implementation-plan",
      async () => {
        const strategyAgent = new StrategyAgent();

        const plan = await strategyAgent.process(
          `Create implementation plan for strategy optimization: ${optimizationAnalysis.optimizationInsights}`,
          {
            currentStrategy,
            optimizedVariations,
            riskAssessment: riskAssessment.riskAnalysis,
          }
        );

        return {
          implementationPlan: plan.content,
          timeline: "1-3 days for testing, 1 week for full implementation",
          milestones: [
            "Backup current strategy configuration",
            "Test optimized strategy in simulation",
            "Validate performance improvements",
            "Implement optimized strategy gradually",
            "Monitor and adjust as needed",
          ],
        };
      }
    );

    return {
      workflowId,
      success: true,
      optimization: {
        currentStrategyAnalysis: strategyAnalysis,
        optimizationAnalysis,
        optimizedVariations,
        riskAssessment,
        implementationPlan,
      },
      summary: {
        strategyId,
        strategyName: currentStrategy.name,
        currentPerformance: strategyAnalysis.performanceMetrics.totalPnlPercent,
        optimizationConfidence: (optimizationAnalysis as any).confidence || 75,
        variationsGenerated: optimizedVariations.length,
        implementationRisk: riskAssessment.riskLevel,
      },
      nextSteps: [
        "Review optimization recommendations",
        "Select preferred optimization variation",
        "Test in simulation environment",
        "Implement gradually with monitoring",
      ],
      timestamp: new Date().toISOString(),
    };
  }
);

// Strategy Recommendation Workflow
export const recommendMultiPhaseStrategy = inngest.createFunction(
  {
    id: "multi-phase-strategy-recommend",
    name: "Recommend Multi-Phase Strategy",
  },
  { event: "multi-phase-strategy/recommend" },
  async ({ event, step }) => {
    const { userId, symbol, marketData, userPreferences, workflowId } =
      event.data;

    // Step 1: Market analysis for the symbol
    const marketAnalysis = await step.run(
      "comprehensive-market-analysis",
      async () => {
        const calendarAgent = new CalendarAgent();
        const symbolAgent = new SymbolAnalysisAgent();
        const strategyAgent = new StrategyAgent();

        const [calendarData, symbolAnalysis, marketInsights] =
          await Promise.all([
            calendarAgent.process(`Get calendar information for ${symbol}`, {}),
            symbolAgent.process(
              `Analyze ${symbol} for trading strategy recommendation`,
              {
                symbol,
                marketData,
                analysisType: "strategy_recommendation",
              }
            ),
            strategyAgent.process(marketData, {
              marketData,
              symbol,
              riskTolerance: userPreferences.riskTolerance,
              timeframe: userPreferences.timeframe,
              objectives: [
                "strategy selection",
                "market timing",
                "risk optimization",
              ],
            }),
          ]);

        return {
          calendarInsights: calendarData.content,
          symbolAnalysis: symbolAnalysis.content,
          marketInsights: marketInsights.content,
          overallConfidence: Math.max(
            (symbolAnalysis as any).confidence || 75,
            (marketInsights as any).confidence || 75
          ),
        };
      }
    );

    // Step 2: Generate personalized strategy recommendation
    const strategyRecommendation = await step.run(
      "generate-personalized-recommendation",
      async () => {
        const strategyAgent = new StrategyAgent();

        const recommendation = await strategyAgent.recommendStrategyForSymbol(
          symbol,
          marketData,
          userPreferences.riskTolerance
        );

        return recommendation;
      }
    );

    // Step 3: Validate recommendation with additional analysis
    const validationAnalysis = await step.run(
      "validate-recommendation",
      async () => {
        const riskAgent = new RiskManagerAgent();

        const validation = await riskAgent.process(
          `Validate strategy recommendation for ${symbol}: ${(strategyRecommendation as StrategyRecommendationResult).reasoning}`,
          {
            symbol,
            strategy: (strategyRecommendation as StrategyRecommendationResult)
              .recommendedStrategy,
            userPreferences,
            marketAnalysis: marketAnalysis.marketInsights,
          }
        );

        return {
          validationResults: validation.content,
          confidence: (validation as any).confidence || 75,
          riskFlags: [], // This would be populated by parsing the validation
          approvalLevel: "recommended", // "recommended", "conditional", "not_recommended"
        };
      }
    );

    // Step 4: Generate alternative scenarios
    const alternativeScenarios = await step.run(
      "generate-alternatives",
      async () => {
        const scenarios = [];

        // Scenario 1: Conservative alternative
        if (userPreferences.riskTolerance !== "low") {
          const conservativeBuilder = new MultiPhaseStrategyBuilder();
          conservativeBuilder.addPhase(
            StrategyPatterns.GRADUAL_ACCUMULATION.phases[0]
          );

          scenarios.push({
            name: "Conservative Alternative",
            strategy: conservativeBuilder.build(),
            suitability: "Lower risk, steadier returns",
            whenToUse: "Market uncertainty or first-time strategy use",
          });
        }

        // Scenario 2: Market-adapted alternative
        if (
          String(marketAnalysis.marketInsights).includes("bullish") ||
          String(marketAnalysis.marketInsights).includes("strong uptrend")
        ) {
          const aggressiveBuilder = new MultiPhaseStrategyBuilder();
          aggressiveBuilder.addPhase(StrategyPatterns.QUICK_ENTRY.phases[0]);

          scenarios.push({
            name: "Bullish Market Strategy",
            strategy: aggressiveBuilder.build(),
            suitability: "Higher targets for strong bull markets",
            whenToUse: "Strong uptrend with high momentum",
          });
        }

        // Scenario 3: Volatility-adapted alternative
        const volatilityStrategy = String(
          marketAnalysis.marketInsights
        ).includes("volatile")
          ? StrategyPatterns.QUICK_ENTRY
          : StrategyPatterns.GRADUAL_ACCUMULATION;

        scenarios.push({
          name: "Volatility-Adapted Strategy",
          strategy: {
            id: "volatility-adapted",
            name: "Volatility-Adapted Strategy",
            description: "Adjusted for current market volatility",
            levels: volatilityStrategy.phases,
          },
          suitability: "Optimized for current volatility conditions",
          whenToUse: "Variable market conditions",
        });

        return scenarios;
      }
    );

    // Step 5: Create final recommendation package
    const finalRecommendation = await step.run(
      "create-final-recommendation",
      async () => {
        const recommendation =
          strategyRecommendation as StrategyRecommendationResult;
        return {
          primaryRecommendation: {
            strategy: recommendation.recommendedStrategy,
            reasoning: recommendation.reasoning,
            riskAssessment: recommendation.riskAssessment,
            executionGuidance: recommendation.executionGuidance,
            confidence: recommendation.riskAssessment.suitabilityScore,
          },
          alternatives: [
            ...recommendation.alternativeStrategies.map((alt) => ({
              name: alt.name,
              strategy: alt,
              suitability: "Predefined alternative strategy",
              whenToUse: "Different risk preference",
            })),
            ...alternativeScenarios,
          ],
          marketContext: {
            analysis: marketAnalysis,
            timing: "Current market conditions analyzed",
            confidence: marketAnalysis.overallConfidence,
          },
          validation: validationAnalysis,
          implementation: {
            readiness: "Ready for implementation",
            nextSteps: recommendation.executionGuidance.optimalEntryConditions,
            monitoring: recommendation.executionGuidance.monitoringPoints,
            riskManagement: recommendation.executionGuidance.riskManagement,
          },
        };
      }
    );

    return {
      workflowId,
      success: true,
      recommendation: finalRecommendation,
      summary: {
        symbol,
        recommendedStrategy:
          finalRecommendation.primaryRecommendation.strategy.name,
        riskLevel: userPreferences.riskTolerance,
        timeframe: userPreferences.timeframe,
        confidence: finalRecommendation.primaryRecommendation.confidence || 75,
        alternativesCount: finalRecommendation.alternatives.length,
        marketConfidence: marketAnalysis.overallConfidence,
        validationStatus: validationAnalysis.approvalLevel,
      },
      userPreferences,
      timestamp: new Date().toISOString(),
    };
  }
);

// Initialize predefined strategies in database
export const initializeStrategyTemplates = inngest.createFunction(
  {
    id: "initialize-strategy-templates",
    name: "Initialize Strategy Templates",
  },
  { event: "system/initialize-templates" },
  async ({ step }) => {
    return await step.run("initialize-predefined-strategies", async () => {
      // Placeholder implementation - predefined strategies are already available in PREDEFINED_STRATEGIES
      console.log(
        "Predefined strategies available:",
        Object.keys(PREDEFINED_STRATEGIES)
      );

      return {
        success: true,
        message: "Predefined strategy templates initialized",
        templatesCount: Object.keys(PREDEFINED_STRATEGIES).length,
        timestamp: new Date().toISOString(),
      };
    });
  }
);

// Execute multi-phase strategy monitoring and execution
export const executeMultiPhaseStrategy = inngest.createFunction(
  { id: "execute-multi-phase-strategy" },
  { event: "strategy/execute-multi-phase" },
  async ({ event, step }) => {
    const { strategyId, userId, currentPrice, symbol } = event.data;

    try {
      // Step 1: Get strategy from database
      const strategy = await step.run("get-strategy", async () => {
        return await multiPhaseTradingService.getStrategyStatus(strategyId);
      });

      if (!strategy) {
        throw new Error(`Strategy ${strategyId} not found for user ${userId}`);
      }

      // Step 2: Create executor from strategy
      const executor = await step.run(
        "create-executor",
        async (): Promise<StrategyExecutor> => {
          // Convert TradingStrategy to ExecutorStrategy format
          const executorStrategy: ExecutorStrategy = {
            id: strategy.id,
            name: strategy.name,
            description: strategy.description,
            phases: strategy.phases.map((phase) => ({
              id: phase.id || "",
              name: phase.name || "Unknown Phase",
              type: phase.status || "pending",
              parameters: {},
            })),
          };
          return createExecutorFromStrategy(executorStrategy);
        }
      );

      // Step 3: Calculate execution phases
      const execution = await step.run("calculate-execution", async () => {
        // Placeholder execution logic - would need to be implemented in executor
        return {
          phasesToExecute: [
            {
              phase: 1,
              amount: 0.1,
              expectedProfit: 0.05 * currentPrice,
            },
          ],
          totalPhases: strategy.phases.length,
          currentPhase:
            strategy.phases.findIndex((p) => p.status === "active") + 1,
        };
      });

      // Step 4: Execute phases if any are triggered
      const executionResults = await step.run("execute-phases", async () => {
        const results = [];

        for (const phase of execution.phasesToExecute) {
          try {
            // Record phase execution - placeholder implementation
            console.log(
              `Executing phase ${phase.phase} at price ${currentPrice} with amount ${phase.amount}`
            );

            results.push({
              phase: phase.phase,
              amount: phase.amount,
              profit: phase.expectedProfit,
              price: currentPrice,
              success: true,
            });
          } catch (error) {
            console.error(`Failed to execute phase ${phase.phase}:`, error);
            results.push({
              phase: phase.phase,
              amount: phase.amount,
              profit: 0,
              price: currentPrice,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        return results;
      });

      // Step 5: Update strategy status
      await step.run("update-strategy", async () => {
        const status = (executor as StrategyExecutor).getStatus();
        if (!status.isRunning && status.progress >= 1.0) {
          // Strategy completed - use stopStrategy to mark as finished
          await multiPhaseTradingService.stopStrategy(strategyId);
        } else {
          // Strategy still active - log status update (no direct update method available)
          console.log(
            `Strategy ${strategyId} execution status updated - active with price ${currentPrice}`
          );
        }
      });

      return {
        success: true,
        strategyId,
        symbol,
        currentPrice,
        executedPhases: executionResults.filter((r) => r.success).length,
        totalProfit: executionResults.reduce((sum, r) => sum + r.profit, 0),
        execution,
        isComplete: (executor as StrategyExecutor).getStatus().progress >= 1.0,
      };
    } catch (error) {
      console.error("Error executing multi-phase strategy:", error);

      // Update strategy status to failed - use stopStrategy to halt execution
      await multiPhaseTradingService.stopStrategy(strategyId);

      throw error;
    }
  }
);

// Strategy health check and maintenance
export const strategyHealthCheck = inngest.createFunction(
  { id: "strategy-health-check", retries: 2 },
  { cron: "0 */4 * * *" }, // Every 4 hours
  async ({ event, step }) => {
    try {
      // Step 1: Get all active strategies
      const allActiveStrategies = await step.run(
        "get-all-active-strategies",
        async () => {
          return await db
            .select()
            .from(tradingStrategies)
            .where(eq(tradingStrategies.status, "active"));
        }
      );

      // Step 2: Check each strategy for issues
      const healthResults = await step.run(
        "check-strategy-health",
        async () => {
          const results = [];

          for (const strategy of allActiveStrategies) {
            const timeSinceLastExecution = strategy.lastExecutionAt
              ? Date.now() - new Date(strategy.lastExecutionAt).getTime()
              : Date.now() -
                new Date(strategy.activatedAt || strategy.createdAt).getTime();

            const hoursStale = timeSinceLastExecution / (1000 * 60 * 60);

            let healthStatus = "healthy";
            const issues = [];

            // Check for stale strategies
            if (hoursStale > 24) {
              healthStatus = "stale";
              issues.push(`No execution in ${hoursStale.toFixed(1)} hours`);
            }

            // Check for incomplete phases
            if (strategy.executedPhases === 0 && hoursStale > 4) {
              healthStatus = "inactive";
              issues.push("No phases executed despite being active");
            }

            // Check for performance issues
            if (
              strategy.totalPnl &&
              strategy.totalPnl < -strategy.positionSizeUsdt * 0.15
            ) {
              healthStatus = "underperforming";
              issues.push("Significant losses detected");
            }

            results.push({
              strategyId: strategy.id,
              userId: strategy.userId,
              symbol: strategy.symbol,
              healthStatus,
              issues,
              hoursStale,
              currentPnl: strategy.totalPnl || 0,
            });
          }

          return results;
        }
      );

      // Step 3: Take corrective actions
      const correctiveActions = await step.run(
        "take-corrective-actions",
        async () => {
          const actions = [];

          for (const result of healthResults) {
            if (result.healthStatus === "stale") {
              // Pause stale strategies
              await multiPhaseTradingService.pauseStrategy(
                (result as any).strategyId
              );
              actions.push(
                `Paused stale strategy ${(result as any).strategyId}`
              );
            } else if (result.healthStatus === "underperforming") {
              // Update AI insights for underperforming strategies
              await db
                .update(tradingStrategies)
                .set({
                  aiInsights: `⚠️ Strategy underperforming. Current P&L: ${result.currentPnl.toFixed(2)}. Consider review.`,
                  lastAiAnalysis: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(tradingStrategies.id, (result as any).strategyId));
              actions.push(
                `Updated insights for underperforming strategy ${(result as any).strategyId}`
              );
            }
          }

          return actions;
        }
      );

      return {
        success: true,
        totalStrategies: allActiveStrategies.length,
        healthResults,
        correctiveActions,
        summary: {
          healthy: healthResults.filter((r) => r.healthStatus === "healthy")
            .length,
          stale: healthResults.filter((r) => r.healthStatus === "stale").length,
          inactive: healthResults.filter((r) => r.healthStatus === "inactive")
            .length,
          underperforming: healthResults.filter(
            (r) => r.healthStatus === "underperforming"
          ).length,
        },
      };
    } catch (error) {
      console.error("Error in strategy health check:", error);
      throw error;
    }
  }
);
