/**
 * Strategy Execution Functions
 *
 * Inngest workflow functions for executing multi-phase trading strategies.
 * Extracted from multi-phase-strategy-functions.ts for better modularity.
 */

import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { tradingStrategies } from "@/src/db/schemas/strategies";
import {
  createExecutorFromStrategy,
  type Strategy as ExecutorStrategy,
  type StrategyExecutor,
} from "@/src/services/multi-phase-executor";
import {
  multiPhaseTradingService,
  type TradingStrategy,
} from "@/src/services/multi-phase-trading-service";
import { inngest } from "../client";
import type {
  MarketData,
  StrategyExecutionInput,
  StrategyExecutionStatus,
} from "./strategy-types";

/**
 * Execute Multi-Phase Strategy Workflow
 */
export const executeMultiPhaseStrategy = inngest.createFunction(
  { id: "multi-phase-strategy-execute", name: "Execute Multi-Phase Strategy" },
  { event: "multi-phase-strategy/execute" },
  async ({ event, step }) => {
    const {
      strategyId,
      userId,
      symbol,
      marketData,
      executionParameters = {},
    } = event.data as StrategyExecutionInput;

    // Step 1: Retrieve and Validate Strategy
    const strategy = await step.run(
      "retrieve-and-validate-strategy",
      async () => {
        const result = await db
          .select()
          .from(tradingStrategies)
          .where(eq(tradingStrategies.id, strategyId))
          .limit(1);

        if (result.length === 0) {
          throw new Error(`Strategy not found: ${strategyId}`);
        }

        const strategy = result[0] as TradingStrategy;

        // Validate strategy is executable
        if (strategy.status !== "active") {
          throw new Error(`Strategy is not active: ${strategy.status}`);
        }

        if (strategy.userId !== userId) {
          throw new Error(`Strategy does not belong to user: ${userId}`);
        }

        if (strategy.symbol !== symbol) {
          throw new Error(
            `Strategy symbol mismatch: expected ${strategy.symbol}, got ${symbol}`
          );
        }

        return strategy;
      }
    );

    // Step 2: Create Strategy Executor
    const executor = await step.run("create-strategy-executor", async () => {
      try {
        const executorStrategy: ExecutorStrategy = {
          id: strategy.id,
          name: strategy.name,
          type: strategy.type,
          symbol: strategy.symbol,
          phases: strategy.parameters?.multiPhaseConfig?.phases || [],
          riskParameters: strategy.parameters?.riskAssessment || {},
          marketConditions: strategy.parameters?.marketAnalysis || {},
        };

        const executor = createExecutorFromStrategy(executorStrategy);

        return {
          executor,
          isValid: true,
          error: null,
        };
      } catch (error) {
        return {
          executor: null,
          isValid: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to create executor",
        };
      }
    });

    if (!executor.isValid || !executor.executor) {
      throw new Error(`Failed to create strategy executor: ${executor.error}`);
    }

    // Step 3: Pre-execution Validation
    const preExecutionValidation = await step.run(
      "pre-execution-validation",
      async () => {
        const validation = {
          marketDataValid: true,
          riskParametersValid: true,
          capitalSufficient: true,
          marketConditionsSuitable: true,
          issues: [] as string[],
        };

        // Validate market data
        if (!marketData || !marketData.price || !marketData.volume) {
          validation.marketDataValid = false;
          validation.issues.push("Invalid or incomplete market data");
        }

        // Validate risk parameters
        const riskParams = strategy.parameters?.riskAssessment;
        if (!riskParams || !riskParams.maxPositionSize) {
          validation.riskParametersValid = false;
          validation.issues.push("Missing risk parameters");
        }

        // Validate capital requirements
        const requiredCapital = riskParams?.maxPositionSize || 0;
        const availableCapital = strategy.parameters?.capital || 0;
        if (requiredCapital > availableCapital) {
          validation.capitalSufficient = false;
          validation.issues.push("Insufficient capital for strategy execution");
        }

        // Validate market conditions
        const marketConditions = strategy.parameters?.marketAnalysis;
        if (marketConditions) {
          const currentVolatility = Math.abs(marketData.change24h || 0) / 100;
          const expectedVolatility = marketConditions.volatility || 0.5;

          if (Math.abs(currentVolatility - expectedVolatility) > 0.3) {
            validation.marketConditionsSuitable = false;
            validation.issues.push(
              "Current market conditions differ significantly from strategy expectations"
            );
          }
        }

        return validation;
      }
    );

    // Step 4: Initialize Execution Context
    const executionContext = await step.run(
      "initialize-execution-context",
      async () => {
        const context = {
          strategyId,
          userId,
          symbol,
          startTime: new Date().toISOString(),
          status: StrategyExecutionStatus.RUNNING,
          currentPhase: 0,
          totalPhases:
            strategy.parameters?.multiPhaseConfig?.phases?.length || 0,
          marketData,
          executionParameters,
          riskParameters: strategy.parameters?.riskAssessment || {},
          performance: {
            tradesExecuted: 0,
            profitLoss: 0,
            unrealizedPnL: 0,
            maxDrawdown: 0,
            currentDrawdown: 0,
          },
          alerts: [] as string[],
          errors: [] as string[],
        };

        // Add any validation warnings to alerts
        if (preExecutionValidation.issues.length > 0) {
          context.alerts.push(...preExecutionValidation.issues);
        }

        return context;
      }
    );

    // Step 5: Execute Strategy Phases
    const phaseExecution = await step.run(
      "execute-strategy-phases",
      async () => {
        const phases = strategy.parameters?.multiPhaseConfig?.phases || [];
        const phaseResults = [];

        for (const [index, phase] of phases.entries()) {
          try {
            executionContext.currentPhase = index;

            // Execute phase through the executor
            const phaseResult = await executor.executor!.executePhase(phase, {
              marketData,
              context: executionContext,
              parameters: executionParameters,
            });

            phaseResults.push({
              phaseIndex: index,
              phaseName: phase.name || `Phase ${index + 1}`,
              status: "completed",
              result: phaseResult,
              executionTime:
                Date.now() - new Date(executionContext.startTime).getTime(),
              alerts: phaseResult.alerts || [],
              errors: phaseResult.errors || [],
            });

            // Update execution context with phase results
            if (phaseResult.trades) {
              executionContext.performance.tradesExecuted +=
                phaseResult.trades.length;
            }

            if (phaseResult.profitLoss) {
              executionContext.performance.profitLoss += phaseResult.profitLoss;
            }

            // Check for stop conditions
            if (phaseResult.shouldStop) {
              executionContext.status = StrategyExecutionStatus.COMPLETED;
              break;
            }
          } catch (error) {
            phaseResults.push({
              phaseIndex: index,
              phaseName: phase.name || `Phase ${index + 1}`,
              status: "failed",
              result: null,
              executionTime:
                Date.now() - new Date(executionContext.startTime).getTime(),
              alerts: [],
              errors: [
                error instanceof Error
                  ? error.message
                  : "Phase execution failed",
              ],
            });

            executionContext.errors.push(
              `Phase ${index} failed: ${error instanceof Error ? error.message : "Unknown error"}`
            );

            // Decide whether to continue or stop based on error severity
            if (error instanceof Error && error.message.includes("critical")) {
              executionContext.status = StrategyExecutionStatus.FAILED;
              break;
            }
          }
        }

        return {
          totalPhases: phases.length,
          completedPhases: phaseResults.filter((p) => p.status === "completed")
            .length,
          failedPhases: phaseResults.filter((p) => p.status === "failed")
            .length,
          results: phaseResults,
        };
      }
    );

    // Step 6: Finalize Execution
    const executionSummary = await step.run("finalize-execution", async () => {
      const endTime = new Date().toISOString();
      const totalExecutionTime =
        Date.now() - new Date(executionContext.startTime).getTime();

      // Determine final status
      let finalStatus = executionContext.status;
      if (finalStatus === StrategyExecutionStatus.RUNNING) {
        if (phaseExecution.failedPhases > 0) {
          finalStatus = StrategyExecutionStatus.FAILED;
        } else {
          finalStatus = StrategyExecutionStatus.COMPLETED;
        }
      }

      // Calculate final performance metrics
      const finalPerformance = {
        ...executionContext.performance,
        totalExecutionTime,
        successRate:
          executionContext.performance.tradesExecuted > 0
            ? (phaseExecution.completedPhases / phaseExecution.totalPhases) *
              100
            : 0,
        profitLossPercentage: strategy.parameters?.capital
          ? (executionContext.performance.profitLoss /
              strategy.parameters.capital) *
            100
          : 0,
      };

      return {
        strategyId,
        userId,
        symbol,
        startTime: executionContext.startTime,
        endTime,
        status: finalStatus,
        totalExecutionTime,
        performance: finalPerformance,
        phaseExecution,
        alerts: executionContext.alerts,
        errors: executionContext.errors,
        marketDataSnapshot: marketData,
      };
    });

    // Step 7: Update Strategy Record
    const strategyUpdate = await step.run(
      "update-strategy-record",
      async () => {
        try {
          // Update strategy with execution results
          const updateData = {
            updatedAt: new Date().toISOString(),
            parameters: {
              ...strategy.parameters,
              lastExecution: {
                timestamp: executionSummary.endTime,
                status: executionSummary.status,
                performance: executionSummary.performance,
              },
            },
          };

          await db
            .update(tradingStrategies)
            .set(updateData)
            .where(eq(tradingStrategies.id, strategyId));

          return {
            success: true,
            message: "Strategy record updated successfully",
          };
        } catch (error) {
          return {
            success: false,
            message: "Failed to update strategy record",
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      }
    );

    // Step 8: Report to Trading Service
    const serviceReport = await step.run(
      "report-to-trading-service",
      async () => {
        try {
          await multiPhaseTradingService.reportExecution(strategyId, {
            status: executionSummary.status,
            performance: executionSummary.performance,
            timestamp: executionSummary.endTime,
          });

          return {
            success: true,
            message: "Execution reported to trading service",
          };
        } catch (error) {
          return {
            success: false,
            message: "Failed to report to trading service",
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      }
    );

    return {
      execution: executionSummary,
      validation: preExecutionValidation,
      strategyUpdate,
      serviceReport,
      metadata: {
        workflowDuration: Date.now() - event.ts,
        executionTimestamp: new Date().toISOString(),
      },
    };
  }
);
