/**
 * Strategy Creation Functions
 *
 * Inngest workflow functions for creating and initializing multi-phase trading strategies.
 * Extracted from multi-phase-strategy-functions.ts for better modularity.
 */

import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { tradingStrategies } from "@/src/db/schemas/strategies";
import { CalendarAgent } from "@/src/mexc-agents/calendar-agent";
import { RiskManagerAgent } from "@/src/mexc-agents/risk-manager-agent";
import { StrategyAgent } from "@/src/mexc-agents/strategy-agent";
import { SymbolAnalysisAgent } from "@/src/mexc-agents/symbol-analysis-agent";
import {
  createExecutorFromStrategy,
  type Strategy as ExecutorStrategy,
  type StrategyExecutor,
} from "@/src/services/multi-phase-executor";
import {
  MultiPhaseStrategyBuilder,
  type StrategyPattern,
  StrategyPatterns,
} from "@/src/services/multi-phase-strategy-builder";
import {
  multiPhaseTradingService,
  PREDEFINED_STRATEGIES,
  type TradingStrategy,
} from "@/src/services/multi-phase-trading-service";
import { inngest } from "../client";
import type {
  MarketData,
  StrategyAnalysisResult,
  StrategyCreationInput,
} from "./strategy-types";

/**
 * Create Multi-Phase Strategy Workflow
 */
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
      preferences = {},
    } = event.data as StrategyCreationInput;

    // Step 1: Market Analysis
    const marketAnalysis = await step.run(
      "analyze-market-conditions",
      async () => {
        const symbolAgent = new SymbolAnalysisAgent({
          symbol,
          analysisDepth: "comprehensive",
          includeNews: true,
          includeTechnical: true,
        });

        const analysis = await symbolAgent.analyzeSymbol({
          symbol,
          marketData,
          timeframe,
          depth: "full",
        });

        return {
          marketTrend: analysis.trend || "neutral",
          volatility: analysis.volatility || 0.5,
          liquidity: analysis.liquidity || 0.7,
          technicalIndicators: analysis.technicalIndicators || {},
          sentiment: analysis.sentiment || "neutral",
          riskFactors: analysis.riskFactors || [],
        };
      }
    );

    // Step 2: Risk Assessment
    const riskAssessment = await step.run("assess-risk-profile", async () => {
      const riskAgent = new RiskManagerAgent({
        userId,
        capital,
        riskTolerance,
      });

      const assessment = await riskAgent.assessRisk({
        symbol,
        marketData,
        marketAnalysis,
        capital,
        riskTolerance,
      });

      return {
        maxPositionSize: assessment.maxPositionSize || capital * 0.1,
        stopLossThreshold: assessment.stopLossThreshold || 0.02,
        takeProfitThreshold: assessment.takeProfitThreshold || 0.04,
        maxDrawdown: assessment.maxDrawdown || 0.05,
        riskScore: assessment.riskScore || 3,
        recommendations: assessment.recommendations || [],
      };
    });

    // Step 3: Strategy Selection
    const selectedStrategy = await step.run(
      "select-strategy-pattern",
      async () => {
        const strategyAgent = new StrategyAgent({
          userId,
          preferences,
        });

        // Determine optimal strategy pattern based on analysis
        let patternType: StrategyPattern;

        if (marketAnalysis.volatility > 0.7) {
          patternType = StrategyPatterns.MOMENTUM_BREAKOUT;
        } else if (marketAnalysis.marketTrend === "bullish") {
          patternType = StrategyPatterns.TREND_FOLLOWING;
        } else if (marketAnalysis.marketTrend === "bearish") {
          patternType = StrategyPatterns.REVERSAL_SCALPING;
        } else {
          patternType = StrategyPatterns.RANGE_TRADING;
        }

        const strategy = await strategyAgent.generateStrategy({
          pattern: patternType,
          marketData,
          riskAssessment,
          preferences,
          timeframe,
        });

        return {
          pattern: patternType,
          strategy,
          reasoning: `Selected ${patternType} based on market volatility ${marketAnalysis.volatility} and trend ${marketAnalysis.marketTrend}`,
        };
      }
    );

    // Step 4: Multi-Phase Strategy Building
    const multiPhaseStrategy = await step.run(
      "build-multi-phase-strategy",
      async () => {
        const builder = new MultiPhaseStrategyBuilder();

        const strategy = builder
          .setSymbol(symbol)
          .setTimeframe(timeframe)
          .setCapital(capital)
          .setRiskParameters({
            maxPositionSize: riskAssessment.maxPositionSize,
            stopLoss: riskAssessment.stopLossThreshold,
            takeProfit: riskAssessment.takeProfitThreshold,
            maxDrawdown: riskAssessment.maxDrawdown,
          })
          .setMarketConditions(marketAnalysis)
          .addPhase("entry", {
            name: "Entry Phase",
            conditions: selectedStrategy.strategy.entryConditions || {},
            actions: selectedStrategy.strategy.entryActions || {},
            riskControls: {
              positionSize: riskAssessment.maxPositionSize * 0.5,
              stopLoss: riskAssessment.stopLossThreshold,
            },
          })
          .addPhase("management", {
            name: "Position Management",
            conditions: selectedStrategy.strategy.managementConditions || {},
            actions: selectedStrategy.strategy.managementActions || {},
            riskControls: {
              trailingStop: true,
              partialProfit: riskAssessment.takeProfitThreshold * 0.5,
            },
          })
          .addPhase("exit", {
            name: "Exit Phase",
            conditions: selectedStrategy.strategy.exitConditions || {},
            actions: selectedStrategy.strategy.exitActions || {},
            riskControls: {
              forceExit: riskAssessment.maxDrawdown,
              timeBasedExit: timeframe === "1d" ? "7d" : "24h",
            },
          })
          .build();

        return strategy;
      }
    );

    // Step 5: Strategy Validation
    const validation = await step.run("validate-strategy", async () => {
      try {
        // Validate strategy structure
        const executor = createExecutorFromStrategy(
          multiPhaseStrategy as ExecutorStrategy
        );

        // Run basic validation checks
        const validationResults = {
          structureValid: true,
          riskCompliant: riskAssessment.riskScore <= 5,
          marketSuitable: marketAnalysis.liquidity > 0.3,
          executorCreated: !!executor,
        };

        const isValid = Object.values(validationResults).every(
          (result) => result === true
        );

        return {
          valid: isValid,
          results: validationResults,
          warnings: isValid ? [] : ["Strategy validation found issues"],
        };
      } catch (error) {
        return {
          valid: false,
          results: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
          warnings: ["Strategy validation failed"],
        };
      }
    });

    // Step 6: Save Strategy
    const savedStrategy = await step.run(
      "save-strategy-to-database",
      async () => {
        if (!validation.valid) {
          throw new Error("Cannot save invalid strategy");
        }

        const strategyRecord = {
          userId,
          name: `${selectedStrategy.pattern} - ${symbol}`,
          description: `Multi-phase ${selectedStrategy.pattern} strategy for ${symbol}`,
          symbol,
          type: "multi-phase",
          pattern: selectedStrategy.pattern,
          phases: multiPhaseStrategy.phases.length,
          parameters: {
            timeframe,
            capital,
            riskTolerance,
            marketAnalysis,
            riskAssessment,
            selectedStrategy: selectedStrategy.strategy,
            multiPhaseConfig: multiPhaseStrategy,
          },
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = await db
          .insert(tradingStrategies)
          .values(strategyRecord)
          .returning();

        return result[0];
      }
    );

    // Step 7: Initialize Strategy in Trading Service
    const initialization = await step.run(
      "initialize-in-trading-service",
      async () => {
        try {
          await multiPhaseTradingService.addStrategy(
            savedStrategy as TradingStrategy
          );

          return {
            success: true,
            strategyId: savedStrategy.id,
            message: "Strategy successfully initialized in trading service",
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            message: "Failed to initialize strategy in trading service",
          };
        }
      }
    );

    // Return comprehensive result
    return {
      strategyId: savedStrategy.id,
      strategy: savedStrategy,
      marketAnalysis,
      riskAssessment,
      selectedPattern: selectedStrategy.pattern,
      validation,
      initialization,
      metadata: {
        processingTime: Date.now() - event.ts,
        phases: multiPhaseStrategy.phases.length,
        riskScore: riskAssessment.riskScore,
        confidence: validation.valid ? 0.8 : 0.3,
      },
    };
  }
);

/**
 * Initialize Strategy Templates Workflow
 */
export const initializeStrategyTemplates = inngest.createFunction(
  { id: "strategy-templates-init", name: "Initialize Strategy Templates" },
  { event: "strategy-templates/initialize" },
  async ({ event, step }) => {
    const { templates = PREDEFINED_STRATEGIES } = event.data;

    const initialization = await step.run(
      "initialize-predefined-templates",
      async () => {
        const results = [];

        for (const template of templates) {
          try {
            await multiPhaseTradingService.addStrategy(template);
            results.push({
              templateId: template.id,
              name: template.name,
              status: "initialized",
            });
          } catch (error) {
            results.push({
              templateId: template.id,
              name: template.name,
              status: "failed",
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        return {
          totalTemplates: templates.length,
          successful: results.filter((r) => r.status === "initialized").length,
          failed: results.filter((r) => r.status === "failed").length,
          results,
        };
      }
    );

    return {
      initialization,
      timestamp: new Date().toISOString(),
    };
  }
);
