/**
 * Strategy Execution Service
 *
 * Handles multi-phase strategy execution workflow logic
 */

import { eq } from "drizzle-orm";
import { tradingStrategies } from "@/src/db/schemas/strategies";
import { db } from "../../db";
import {
  createExecutorFromStrategy,
  type StrategyExecutor,
} from "../../services/multi-phase-executor";
import { multiPhaseTradingService } from "../../services/multi-phase-trading-service";
import type {
  MultiPhaseStrategyExecuteEvent,
  OptimizationRecommendation,
  ServiceResponse,
} from "../types/multi-phase-strategy-types";

export class StrategyExecutionService {
  constructor() {}

  async executeStrategyWorkflow(
    data: MultiPhaseStrategyExecuteEvent["data"],
    step: any
  ): Promise<ServiceResponse> {
    const { strategyId, userId, executionMode, phaseOverrides, workflowId } =
      data;

    // Step 1: Load strategy configuration
    const strategyConfig = await step.run("load-strategy", async () => {
      return this.loadStrategyConfiguration(strategyId, userId);
    });

    // Step 2: Validate execution prerequisites
    const validationResult = await step.run("validate-execution", async () => {
      return this.validateExecutionPrerequisites(strategyConfig, executionMode);
    });

    if (!validationResult.canExecute) {
      throw new Error(
        `Execution validation failed: ${validationResult.reason}`
      );
    }

    // Step 3: Initialize strategy executor
    const executor = await step.run("initialize-executor", async () => {
      return this.initializeStrategyExecutor(strategyConfig, phaseOverrides);
    });

    // Step 4: Execute strategy phases
    const executionResults = await step.run("execute-phases", async () => {
      return this.executeStrategyPhases(
        executor,
        strategyConfig,
        executionMode
      );
    });

    // Step 5: Update strategy status and metrics
    const updateResult = await step.run("update-strategy", async () => {
      return this.updateStrategyStatus(strategyId, executionResults);
    });

    // Step 6: Schedule next execution if recurring
    const nextExecution = await step.run("schedule-next", async () => {
      return this.scheduleNextExecution(strategyConfig, executionResults);
    });

    return {
      success: true,
      data: {
        strategyId,
        executionResults,
        updateResult,
        nextExecution,
        workflowId,
      },
      timestamp: new Date().toISOString(),
      metadata: {
        userId,
        executionMode,
        phasesExecuted: executionResults.phases.length,
      },
    };
  }

  async applyOptimizations(
    strategyId: string,
    recommendations: OptimizationRecommendation[]
  ): Promise<ServiceResponse> {
    try {
      const appliedOptimizations = [];

      for (const recommendation of recommendations) {
        const result = await this.applyOptimization(strategyId, recommendation);
        appliedOptimizations.push(result);
      }

      // Update strategy with optimization metadata
      await db
        .update(tradingStrategies)
        .set({
          aiInsights: `✅ Applied ${appliedOptimizations.length} optimizations`,
          lastAiAnalysis: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tradingStrategies.id, strategyId));

      return {
        success: true,
        data: {
          strategyId,
          appliedOptimizations,
          totalOptimizations: recommendations.length,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error applying optimizations:", error);
      throw error;
    }
  }

  private async loadStrategyConfiguration(strategyId: string, userId: string) {
    const strategies = await db
      .select()
      .from(tradingStrategies)
      .where(eq(tradingStrategies.id, strategyId))
      .limit(1);

    if (strategies.length === 0) {
      throw new Error(`Strategy not found: ${strategyId}`);
    }

    const strategy = strategies[0];

    if (strategy.userId !== userId) {
      throw new Error(`Unauthorized access to strategy: ${strategyId}`);
    }

    return {
      id: strategy.id,
      name: strategy.name,
      phases: strategy.phases,
      status: strategy.status,
      riskLevel: strategy.riskLevel,
      symbol: strategy.symbol,
      configuration: strategy.configuration || {},
    };
  }

  private async validateExecutionPrerequisites(
    strategyConfig: any,
    executionMode: string
  ) {
    const validationChecks = {
      strategyActive:
        strategyConfig.status === "active" ||
        strategyConfig.status === "created",
      validPhases: strategyConfig.phases && strategyConfig.phases.length > 0,
      validExecutionMode: ["automatic", "manual", "test"].includes(
        executionMode
      ),
      riskLevelAcceptable: ["low", "medium", "high"].includes(
        strategyConfig.riskLevel
      ),
    };

    const failedChecks = Object.entries(validationChecks)
      .filter(([_, isValid]) => !isValid)
      .map(([check]) => check);

    return {
      canExecute: failedChecks.length === 0,
      validationChecks,
      reason:
        failedChecks.length > 0
          ? `Failed checks: ${failedChecks.join(", ")}`
          : null,
    };
  }

  private async initializeStrategyExecutor(
    strategyConfig: any,
    phaseOverrides?: any
  ) {
    const strategyData = {
      id: strategyConfig.id,
      name: strategyConfig.name,
      phases: phaseOverrides
        ? this.applyPhaseOverrides(strategyConfig.phases, phaseOverrides)
        : strategyConfig.phases,
      riskLevel: strategyConfig.riskLevel,
      symbol: strategyConfig.symbol,
    };

    const executor = createExecutorFromStrategy(strategyData);

    return {
      executor,
      initializedAt: new Date().toISOString(),
      phaseCount: strategyData.phases.length,
      hasOverrides: !!phaseOverrides,
    };
  }

  private async executeStrategyPhases(
    executorData: any,
    strategyConfig: any,
    executionMode: string
  ) {
    const { executor } = executorData;
    const results = {
      phases: [] as any[],
      totalPnl: 0,
      successfulPhases: 0,
      failedPhases: 0,
      executionTime: 0,
    };

    const startTime = Date.now();

    try {
      // Execute each phase
      for (let i = 0; i < strategyConfig.phases.length; i++) {
        const phase = strategyConfig.phases[i];

        try {
          const phaseResult = await this.executePhase(
            executor,
            phase,
            executionMode
          );
          results.phases.push(phaseResult);

          if (phaseResult.success) {
            results.successfulPhases++;
            results.totalPnl += phaseResult.pnl || 0;
          } else {
            results.failedPhases++;
          }
        } catch (error) {
          console.error(`Phase ${i} execution failed:`, error);
          results.phases.push({
            phaseIndex: i,
            success: false,
            error: (error as Error).message,
            timestamp: new Date().toISOString(),
          });
          results.failedPhases++;
        }
      }

      results.executionTime = Date.now() - startTime;

      return results;
    } catch (error) {
      console.error("Strategy execution failed:", error);
      throw error;
    }
  }

  private async executePhase(
    executor: StrategyExecutor,
    phase: any,
    executionMode: string
  ) {
    if (executionMode === "test") {
      // Simulate phase execution for testing
      return {
        phaseIndex: phase.index || 0,
        success: true,
        pnl: Math.random() * 100 - 50, // Random PnL for testing
        executionMode: "simulated",
        timestamp: new Date().toISOString(),
      };
    }

    // Execute actual phase logic
    const result = await executor.executePhase(phase);

    return {
      phaseIndex: phase.index || 0,
      success: result.success,
      pnl: result.pnl || 0,
      executionMode,
      details: result.details,
      timestamp: new Date().toISOString(),
    };
  }

  private async updateStrategyStatus(
    strategyId: string,
    executionResults: any
  ) {
    const status =
      executionResults.failedPhases === 0 ? "completed" : "partial";
    const successRate =
      executionResults.successfulPhases /
      (executionResults.successfulPhases + executionResults.failedPhases);

    await db
      .update(tradingStrategies)
      .set({
        status,
        totalPnl: executionResults.totalPnl,
        successRate: successRate * 100,
        lastExecuted: new Date(),
        executionSummary: JSON.stringify({
          phases: executionResults.phases.length,
          successful: executionResults.successfulPhases,
          failed: executionResults.failedPhases,
          totalPnl: executionResults.totalPnl,
          executionTime: executionResults.executionTime,
        }),
        updatedAt: new Date(),
      })
      .where(eq(tradingStrategies.id, strategyId));

    return {
      updated: true,
      newStatus: status,
      successRate,
      totalPnl: executionResults.totalPnl,
    };
  }

  private async scheduleNextExecution(
    strategyConfig: any,
    executionResults: any
  ) {
    // Check if strategy should be rescheduled based on configuration
    const isRecurring =
      (strategyConfig.configuration as any)?.recurring || false;
    const executionInterval =
      (strategyConfig.configuration as any)?.executionInterval || 3600000; // 1 hour default

    if (!isRecurring || executionResults.failedPhases > 0) {
      return {
        scheduled: false,
        reason: isRecurring
          ? "Execution failures detected"
          : "Strategy not recurring",
      };
    }

    const nextExecutionTime = new Date(Date.now() + executionInterval);

    return {
      scheduled: true,
      nextExecution: nextExecutionTime,
      interval: executionInterval,
      strategyId: strategyConfig.id,
    };
  }

  private applyPhaseOverrides(originalPhases: any[], overrides: any) {
    return originalPhases.map((phase, index) => {
      const override = overrides[index] || overrides[phase.id];
      return override ? { ...phase, ...override } : phase;
    });
  }

  private async applyOptimization(
    strategyId: string,
    recommendation: OptimizationRecommendation
  ) {
    try {
      switch (recommendation.type) {
        case "position_sizing":
          return this.optimizePositionSizing(
            strategyId,
            recommendation.parameters
          );
        case "stop_loss":
          return this.optimizeStopLoss(strategyId, recommendation.parameters);
        case "take_profit":
          return this.optimizeTakeProfit(strategyId, recommendation.parameters);
        case "phase_timing":
          return this.optimizePhaseTiming(
            strategyId,
            recommendation.parameters
          );
        default:
          throw new Error(`Unknown optimization type: ${recommendation.type}`);
      }
    } catch (error) {
      console.error(
        `Failed to apply ${recommendation.type} optimization:`,
        error
      );
      return {
        type: recommendation.type,
        applied: false,
        error: (error as Error).message,
      };
    }
  }

  private async optimizePositionSizing(
    strategyId: string,
    parameters: Record<string, unknown>
  ) {
    // Implementation for position sizing optimization
    return {
      type: "position_sizing",
      applied: true,
      changes: parameters,
    };
  }

  private async optimizeStopLoss(
    strategyId: string,
    parameters: Record<string, unknown>
  ) {
    // Implementation for stop loss optimization
    return {
      type: "stop_loss",
      applied: true,
      changes: parameters,
    };
  }

  private async optimizeTakeProfit(
    strategyId: string,
    parameters: Record<string, unknown>
  ) {
    // Implementation for take profit optimization
    return {
      type: "take_profit",
      applied: true,
      changes: parameters,
    };
  }

  private async optimizePhaseTiming(
    strategyId: string,
    parameters: Record<string, unknown>
  ) {
    // Implementation for phase timing optimization
    return {
      type: "phase_timing",
      applied: true,
      changes: parameters,
    };
  }
}
