import { eq } from "drizzle-orm";
import { db } from "../db";
import { tradingStrategies } from "../db/schemas/strategies";
import { CalendarAgent } from "../mexc-agents/calendar-agent";
import { RiskManagerAgent } from "../mexc-agents/risk-manager-agent";
import { StrategyAgent } from "../mexc-agents/strategy-agent";
import { SymbolAnalysisAgent } from "../mexc-agents/symbol-analysis-agent";
import { createExecutorFromStrategy } from "../services/multi-phase-executor";
import {
  MultiPhaseStrategyBuilder,
  StrategyPatterns,
} from "../services/multi-phase-strategy-builder";
import {
  multiPhaseTradingService,
  PREDEFINED_STRATEGIES,
} from "../services/multi-phase-trading-service";
import { inngest } from "./client";

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
    const strategyRecommendation = await step.run("generate-strategy", async () => {
      const { strategyAgent } = agents;

      // Determine optimal strategy based on analysis
      let recommendedTemplate = "normal";

      if (riskTolerance === "low") {
        recommendedTemplate = "conservative";
      } else if (riskTolerance === "high" && timeframe === "long") {
        recommendedTemplate = "aggressive";
      } else if (timeframe === "short") {
        recommendedTemplate = "scalping";
      }

      const baseStrategy = PREDEFINED_STRATEGIES[recommendedTemplate];

      // Create custom strategy if needed
      const builder = new MultiPhaseStrategyBuilder(
        `${symbol}-${recommendedTemplate}-${Date.now()}`,
        `${symbol} ${baseStrategy.name}`
      );

      // Adjust strategy based on market conditions and risk tolerance
      const analysisText = String(marketAnalysis.analysis || "");
      if (analysisText.includes("high volatility") || analysisText.includes("volatile")) {
        // Use volatility-adjusted strategy
        const volatilityStrategy = StrategyPatterns.momentum("high");
        const preview = volatilityStrategy.preview();
        builder.addPhases(
          preview.levels.map((l) => [l.percentage, l.sellPercentage] as [number, number])
        );
      } else {
        // Use base strategy levels
        builder.addPhases(
          baseStrategy.levels.map((l) => [l.percentage, l.sellPercentage] as [number, number])
        );
      }

      const customStrategy = builder
        .withDescription(
          `AI-generated strategy for ${symbol} based on ${riskTolerance} risk tolerance and ${timeframe} timeframe`
        )
        .build();

      return {
        strategy: customStrategy,
        templateUsed: recommendedTemplate,
        adjustments: analysisText.includes("volatile") ? "volatility-adjusted" : "standard",
      };
    });

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
              capital * (riskTolerance === "low" ? 0.02 : riskTolerance === "high" ? 0.1 : 0.05)
            )
          : null;

      return {
        riskAnalysis: riskAnalysis.content,
        recommendedPositionSize: recommendedPosition,
        maxRiskPercent: riskTolerance === "low" ? 2 : riskTolerance === "high" ? 10 : 5,
        stopLossRecommendation: riskTolerance === "low" ? 10 : riskTolerance === "high" ? 20 : 15,
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
        Number(riskAssessment.recommendedPositionSize) || Number(capital) * 0.05;
      const positionSize = positionSizeUsdt / Number(entryPrice);

      try {
        const strategy = await multiPhaseTradingService.createTradingStrategy({
          userId,
          name: String((strategyRecommendation.strategy as any)?.name || "AI Generated Strategy"),
          symbol,
          entryPrice: Number(entryPrice),
          positionSize,
          positionSizeUsdt,
          strategyConfig: strategyRecommendation.strategy,
          stopLossPercent: Number(riskAssessment.stopLossRecommendation) || 15,
          description: `${String((strategyRecommendation.strategy as any)?.description || "")}\n\nAI Analysis: ${marketAnalysis.analysis}`,
        });

        return {
          created: true,
          strategyId: strategy.id,
          strategy,
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
    const executionPlan = await step.run("generate-execution-plan", async () => {
      const { strategyAgent } = agents;

      const plan = await strategyAgent.process(
        `Create an execution plan for ${String((strategyRecommendation.strategy as any)?.name || "strategy")} on ${symbol}`,
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
        nextReviewDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      };
    });

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
        strategyName: String((strategyRecommendation.strategy as any)?.name || "Unknown Strategy"),
        phases: Array.isArray((strategyRecommendation.strategy as any)?.levels)
          ? (strategyRecommendation.strategy as any).levels.length
          : 0,
        riskLevel: riskTolerance,
        timeframe,
        confidence: (marketAnalysis as any).confidence || 75,
        databaseStored: Boolean(strategyCreated.created),
        strategyId: strategyCreated.created ? (strategyCreated as any).strategyId : null,
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
      return await multiPhaseTradingService.getUserStrategies(userId, { symbol, limit: 10 });
    });

    // Step 2: Analyze market conditions
    const marketAnalysis = await step.run("analyze-market-conditions", async () => {
      const strategyAgent = new StrategyAgent();
      const symbolAgent = new SymbolAnalysisAgent();

      const [marketInsights, symbolAnalysis] = await Promise.all([
        strategyAgent.process(marketData, {
          marketData,
          symbol,
          objectives: ["trend analysis", "market sentiment", "technical indicators"],
        }),
        symbolAgent.process(`Analyze ${symbol} for multi-phase strategy execution`, {
          symbol,
          marketData,
          analysisType: "execution_readiness",
        }),
      ]);

      return {
        marketInsights: marketInsights.content,
        symbolAnalysis: symbolAnalysis.content,
        marketConfidence: 75, // Default confidence
        symbolConfidence: 75, // Default confidence
      };
    });

    // Step 3: Performance analysis for existing strategies
    const performanceAnalysis = await step.run("analyze-performance", async () => {
      if (strategies.length === 0) {
        return {
          hasStrategies: false,
          message: "No strategies found for this symbol",
        };
      }

      const performanceMetrics = await Promise.all(
        strategies.map(async (strategy) => {
          try {
            const metrics = await multiPhaseTradingService.calculatePerformanceMetrics(
              strategy.id,
              userId
            );
            const executor = await createExecutorFromStrategy(strategy as any, userId);
            const analytics = executor.getExecutionAnalytics();

            return {
              strategyId: strategy.id,
              strategyName: strategy.name,
              status: strategy.status,
              metrics,
              analytics,
              phases: `${strategy.executedPhases}/${strategy.totalPhases}`,
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
        topPerformer: performanceMetrics.reduce((best, current) =>
          (current.metrics?.totalPnlPercent || 0) > (best.metrics?.totalPnlPercent || 0)
            ? current
            : best
        ),
      };
    });

    // Step 4: Generate recommendations
    const recommendations = await step.run("generate-recommendations", async () => {
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
    });

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
        hasActiveStrategies: strategies.some((s) => s.status === "active"),
        overallHealth: performanceAnalysis.hasStrategies ? "good" : "no_data",
      },
      timestamp: new Date().toISOString(),
    };
  }
);

// Optimize Existing Multi-Phase Strategy
export const optimizeMultiPhaseStrategy = inngest.createFunction(
  { id: "multi-phase-strategy-optimize", name: "Optimize Multi-Phase Strategy" },
  { event: "multi-phase-strategy/optimize" },
  async ({ event, step }) => {
    const { userId, strategyId, currentStrategy, marketConditions, performanceData, workflowId } =
      event.data;

    // Step 1: Get current strategy and performance
    const strategyAnalysis = await step.run("analyze-current-strategy", async () => {
      const strategy = await multiPhaseTradingService.getStrategyById(strategyId, userId);
      if (!strategy) throw new Error("Strategy not found");

      const executor = await createExecutorFromStrategy(strategy, userId);
      const analytics = executor.getExecutionAnalytics();
      const performanceMetrics = await multiPhaseTradingService.calculatePerformanceMetrics(
        strategyId,
        userId
      );

      return {
        strategy,
        analytics,
        performanceMetrics,
        currentPhases: strategy.executedPhases,
        totalPhases: strategy.totalPhases,
        efficiency: analytics.executionTrend,
      };
    });

    // Step 2: AI-powered optimization analysis
    const optimizationAnalysis = await step.run("ai-optimization-analysis", async () => {
      const strategyAgent = new StrategyAgent();

      const optimization = await strategyAgent.optimizeExistingStrategy(
        currentStrategy,
        marketConditions || "Current market conditions analysis needed",
        performanceData || JSON.stringify(strategyAnalysis.performanceMetrics)
      );

      return {
        optimizationInsights: optimization.content,
        confidence: 75, // Default confidence
        analysisDate: new Date().toISOString(),
      };
    });

    // Step 3: Generate optimized strategy variations
    const optimizedVariations = await step.run("generate-optimizations", async () => {
      const variations = [];

      // Variation 1: Volatility-adjusted strategy
      if (marketConditions?.includes("volatile") || marketConditions?.includes("high volatility")) {
        const volatilityBuilder = StrategyPatterns.momentum("high");
        const volatilityPreview = volatilityBuilder.preview();

        variations.push({
          name: "Volatility-Adjusted Strategy",
          type: "volatility_optimized",
          description: "Adjusted for high market volatility",
          levels: volatilityPreview.levels,
          expectedImprovement: "Better risk management in volatile conditions",
        });
      }

      // Variation 2: Performance-based optimization
      if (strategyAnalysis.analytics.executionTrend === "declining") {
        const conservativeBuilder = new MultiPhaseStrategyBuilder(
          `${currentStrategy.id}-conservative`,
          `${currentStrategy.name} (Conservative)`
        ).createConservativeStrategy(70, 80);

        const conservativeStrategy = conservativeBuilder.build();

        variations.push({
          name: "Conservative Optimization",
          type: "performance_optimized",
          description: "More conservative targets to improve success rate",
          levels: conservativeStrategy.levels,
          expectedImprovement: "Higher success rate with earlier profit taking",
        });
      }

      // Variation 3: Risk-adjusted optimization
      const riskAdjustedBuilder = StrategyPatterns.riskAdjusted(
        (strategyAnalysis.strategy.positionSizeUsdt / 10000) * 100 // Approximate position size percentage
      );
      const riskAdjustedPreview = riskAdjustedBuilder.preview();

      variations.push({
        name: "Risk-Adjusted Strategy",
        type: "risk_optimized",
        description: "Optimized based on position size risk",
        levels: riskAdjustedPreview.levels,
        expectedImprovement: "Better risk-adjusted returns",
      });

      return variations;
    });

    // Step 4: Risk assessment of optimizations
    const riskAssessment = await step.run("assess-optimization-risks", async () => {
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
    });

    // Step 5: Generate implementation plan
    const implementationPlan = await step.run("create-implementation-plan", async () => {
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
    });

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
  { id: "multi-phase-strategy-recommend", name: "Recommend Multi-Phase Strategy" },
  { event: "multi-phase-strategy/recommend" },
  async ({ event, step }) => {
    const { userId, symbol, marketData, userPreferences, workflowId } = event.data;

    // Step 1: Market analysis for the symbol
    const marketAnalysis = await step.run("comprehensive-market-analysis", async () => {
      const calendarAgent = new CalendarAgent();
      const symbolAgent = new SymbolAnalysisAgent();
      const strategyAgent = new StrategyAgent();

      const [calendarData, symbolAnalysis, marketInsights] = await Promise.all([
        calendarAgent.process(`Get calendar information for ${symbol}`, {}),
        symbolAgent.process(`Analyze ${symbol} for trading strategy recommendation`, {
          symbol,
          marketData,
          analysisType: "strategy_recommendation",
        }),
        strategyAgent.process(marketData, {
          marketData,
          symbol,
          riskTolerance: userPreferences.riskTolerance,
          timeframe: userPreferences.timeframe,
          objectives: ["strategy selection", "market timing", "risk optimization"],
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
    });

    // Step 2: Generate personalized strategy recommendation
    const strategyRecommendation = await step.run(
      "generate-personalized-recommendation",
      async () => {
        const strategyAgent = new StrategyAgent();

        const recommendation = await strategyAgent.recommendStrategyForSymbol(
          symbol,
          marketData,
          userPreferences
        );

        return recommendation;
      }
    );

    // Step 3: Validate recommendation with additional analysis
    const validationAnalysis = await step.run("validate-recommendation", async () => {
      const riskAgent = new RiskManagerAgent();

      const validation = await riskAgent.process(
        `Validate strategy recommendation for ${symbol}: ${strategyRecommendation.reasoning}`,
        {
          symbol,
          strategy: strategyRecommendation.recommendedStrategy,
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
    });

    // Step 4: Generate alternative scenarios
    const alternativeScenarios = await step.run("generate-alternatives", async () => {
      const scenarios = [];

      // Scenario 1: Conservative alternative
      if (userPreferences.riskTolerance !== "low") {
        const conservativeBuilder = new MultiPhaseStrategyBuilder(
          "conservative-alternative",
          "Conservative Alternative"
        ).createConservativeStrategy();

        scenarios.push({
          name: "Conservative Alternative",
          strategy: conservativeBuilder.build(),
          suitability: "Lower risk, steadier returns",
          whenToUse: "Market uncertainty or first-time strategy use",
        });
      }

      // Scenario 2: Market-adapted alternative
      if (
        marketAnalysis.marketInsights.includes("bullish") ||
        marketAnalysis.marketInsights.includes("strong uptrend")
      ) {
        const aggressiveBuilder = new MultiPhaseStrategyBuilder(
          "bullish-alternative",
          "Bullish Market Alternative"
        ).createAggressiveStrategy();

        scenarios.push({
          name: "Bullish Market Strategy",
          strategy: aggressiveBuilder.build(),
          suitability: "Higher targets for strong bull markets",
          whenToUse: "Strong uptrend with high momentum",
        });
      }

      // Scenario 3: Volatility-adapted alternative
      const volatilityBuilder = StrategyPatterns.momentum(
        marketAnalysis.marketInsights.includes("volatile") ? "high" : "medium"
      );
      const volatilityPreview = volatilityBuilder.preview();

      scenarios.push({
        name: "Volatility-Adapted Strategy",
        strategy: {
          id: "volatility-adapted",
          name: "Volatility-Adapted Strategy",
          description: "Adjusted for current market volatility",
          levels: volatilityPreview.levels,
        },
        suitability: "Optimized for current volatility conditions",
        whenToUse: "Variable market conditions",
      });

      return scenarios;
    });

    // Step 5: Create final recommendation package
    const finalRecommendation = await step.run("create-final-recommendation", async () => {
      return {
        primaryRecommendation: {
          strategy: strategyRecommendation.recommendedStrategy,
          reasoning: strategyRecommendation.reasoning,
          riskAssessment: strategyRecommendation.riskAssessment,
          executionGuidance: strategyRecommendation.executionGuidance,
          confidence: strategyRecommendation.riskAssessment.suitabilityScore,
        },
        alternatives: [
          ...strategyRecommendation.alternativeStrategies.map((alt) => ({
            name: (alt as any).name,
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
          nextSteps: strategyRecommendation.executionGuidance.optimalEntryConditions,
          monitoring: strategyRecommendation.executionGuidance.monitoringPoints,
          riskManagement: strategyRecommendation.executionGuidance.riskManagement,
        },
      };
    });

    return {
      workflowId,
      success: true,
      recommendation: finalRecommendation,
      summary: {
        symbol,
        recommendedStrategy: (finalRecommendation.primaryRecommendation.strategy as any).name,
        riskLevel: userPreferences.riskTolerance,
        timeframe: userPreferences.timeframe,
        confidence: (finalRecommendation.primaryRecommendation as any).confidence || 75,
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
  { id: "initialize-strategy-templates", name: "Initialize Strategy Templates" },
  { event: "system/initialize-templates" },
  async ({ step }) => {
    return await step.run("initialize-predefined-strategies", async () => {
      await multiPhaseTradingService.initializePredefinedStrategies();

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
        return await multiPhaseTradingService.getStrategyById(strategyId, userId);
      });

      if (!strategy) {
        throw new Error(`Strategy ${strategyId} not found for user ${userId}`);
      }

      // Step 2: Create executor from strategy
      const executor = await step.run("create-executor", async () => {
        return await createExecutorFromStrategy(strategy as any, userId);
      });

      // Step 3: Calculate execution phases
      const execution = await step.run("calculate-execution", async () => {
        return (executor as any).executePhases(currentPrice, {
          dryRun: false,
          maxPhasesPerExecution: 3,
        });
      });

      // Step 4: Execute phases if any are triggered
      const executionResults = await step.run("execute-phases", async () => {
        const results = [];

        for (const phase of execution.phasesToExecute) {
          try {
            // Record phase execution
            await (executor as any).recordPhaseExecution(phase.phase, currentPrice, phase.amount, {
              fees: phase.expectedProfit * 0.001, // 0.1% fee estimate
              latency: 50, // Estimate 50ms latency
            });

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
        if ((executor as any).isComplete()) {
          await multiPhaseTradingService.updateStrategyStatus(strategyId, userId, "completed", {
            currentPrice,
            completedAt: new Date(),
          });
        } else {
          await multiPhaseTradingService.updateStrategyStatus(strategyId, userId, "active", {
            currentPrice,
            lastExecutionAt: new Date(),
          });
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
        isComplete: (executor as any).isComplete(),
      };
    } catch (error) {
      console.error("Error executing multi-phase strategy:", error);

      // Update strategy status to failed
      await multiPhaseTradingService.updateStrategyStatus(strategyId, userId, "failed", {
        currentPrice,
      });

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
      const allActiveStrategies = await step.run("get-all-active-strategies", async () => {
        return await db
          .select()
          .from(tradingStrategies)
          .where(eq(tradingStrategies.status, "active"));
      });

      // Step 2: Check each strategy for issues
      const healthResults = await step.run("check-strategy-health", async () => {
        const results = [];

        for (const strategy of allActiveStrategies) {
          const timeSinceLastExecution = strategy.lastExecutionAt
            ? Date.now() - new Date(strategy.lastExecutionAt).getTime()
            : Date.now() - new Date(strategy.activatedAt || strategy.createdAt).getTime();

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
          if (strategy.totalPnl && strategy.totalPnl < -strategy.positionSizeUsdt * 0.15) {
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
      });

      // Step 3: Take corrective actions
      const correctiveActions = await step.run("take-corrective-actions", async () => {
        const actions = [];

        for (const result of healthResults) {
          if (result.healthStatus === "stale") {
            // Pause stale strategies
            await multiPhaseTradingService.updateStrategyStatus(
              (result as any).strategyId,
              (result as any).userId,
              "paused",
              {}
            );
            actions.push(`Paused stale strategy ${(result as any).strategyId}`);
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
      });

      return {
        success: true,
        totalStrategies: allActiveStrategies.length,
        healthResults,
        correctiveActions,
        summary: {
          healthy: healthResults.filter((r) => r.healthStatus === "healthy").length,
          stale: healthResults.filter((r) => r.healthStatus === "stale").length,
          inactive: healthResults.filter((r) => r.healthStatus === "inactive").length,
          underperforming: healthResults.filter((r) => r.healthStatus === "underperforming").length,
        },
      };
    } catch (error) {
      console.error("Error in strategy health check:", error);
      throw error;
    }
  }
);
