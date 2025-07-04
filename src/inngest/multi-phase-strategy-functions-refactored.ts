/**
 * Multi-Phase Strategy Functions (Refactored)
 *
 * Lean orchestrator that imports and exports specialized strategy workflow functions.
 * Reduced from 1274 lines to under 500 lines through complete modularization.
 *
 * Architecture:
 * - strategy-types.ts: Shared type definitions and interfaces
 * - strategy-creation-functions.ts: Strategy creation and initialization workflows
 * - strategy-analysis-functions.ts: Strategy analysis and health check workflows
 * - strategy-optimization-functions.ts: Strategy optimization and recommendation workflows
 * - strategy-execution-functions.ts: Strategy execution workflows
 */

export {
  analyzeMultiPhaseStrategy,
  strategyHealthCheck,
} from "./strategy-functions/strategy-analysis-functions";
// Import all specialized workflow functions
export {
  createMultiPhaseStrategy,
  initializeStrategyTemplates,
} from "./strategy-functions/strategy-creation-functions";
export { executeMultiPhaseStrategy } from "./strategy-functions/strategy-execution-functions";
export {
  optimizeMultiPhaseStrategy,
  recommendMultiPhaseStrategy,
} from "./strategy-functions/strategy-optimization-functions";

// Export all types for external use
export type {
  MarketData,
  RiskLevel,
  StrategyAnalysisResult,
  StrategyCreationInput,
  StrategyExecutionInput,
  StrategyExecutionStatus,
  StrategyOptimizationInput,
  StrategyPatternType,
  StrategyPhase,
  StrategyRecommendationResult,
  Timeframe,
  TradingStrategy,
} from "./strategy-functions/strategy-types";

export {
  isMarketData,
  isStrategyAnalysisResult,
  isStrategyRecommendationResult,
  isTradingStrategy,
  StrategyError,
  StrategyExecutionError,
  StrategyOptimizationError,
  StrategyValidationError,
} from "./strategy-functions/strategy-types";

// Import dependencies for utility functions
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import { tradingStrategies } from "@/src/db/schemas/strategies";
import {
  multiPhaseTradingService,
  type TradingStrategy,
} from "@/src/services/multi-phase-trading-service";
import { inngest } from "./client";

/**
 * Utility function to get strategy by ID
 */
export const getStrategyById = async (
  strategyId: string
): Promise<TradingStrategy | null> => {
  try {
    const result = await db
      .select()
      .from(tradingStrategies)
      .where(eq(tradingStrategies.id, strategyId))
      .limit(1);

    return result.length > 0 ? (result[0] as TradingStrategy) : null;
  } catch (error) {
    console.error("Failed to get strategy by ID:", error);
    return null;
  }
};

/**
 * Utility function to get strategies by user ID
 */
export const getStrategiesByUserId = async (
  userId: string
): Promise<TradingStrategy[]> => {
  try {
    const result = await db
      .select()
      .from(tradingStrategies)
      .where(eq(tradingStrategies.userId, userId));

    return result as TradingStrategy[];
  } catch (error) {
    console.error("Failed to get strategies by user ID:", error);
    return [];
  }
};

/**
 * Utility function to get active strategies
 */
export const getActiveStrategies = async (): Promise<TradingStrategy[]> => {
  try {
    const result = await db
      .select()
      .from(tradingStrategies)
      .where(eq(tradingStrategies.status, "active"));

    return result as TradingStrategy[];
  } catch (error) {
    console.error("Failed to get active strategies:", error);
    return [];
  }
};

/**
 * Batch Strategy Operations Workflow
 */
export const batchStrategyOperations = inngest.createFunction(
  { id: "batch-strategy-operations", name: "Batch Strategy Operations" },
  { event: "strategy/batch-operations" },
  async ({ event, step }) => {
    const { operations, userId } = event.data;

    const results = await step.run("execute-batch-operations", async () => {
      const operationResults = [];

      for (const operation of operations) {
        try {
          let result;

          switch (operation.type) {
            case "analyze":
              // Trigger analysis for specified strategies
              result = await inngest.send({
                name: "multi-phase-strategy/analyze",
                data: {
                  strategyId: operation.strategyId,
                  marketData: operation.marketData,
                  analysisDepth: operation.depth || "standard",
                },
              });
              break;

            case "optimize":
              // Trigger optimization for specified strategies
              result = await inngest.send({
                name: "multi-phase-strategy/optimize",
                data: {
                  strategyId: operation.strategyId,
                  userId,
                  marketData: operation.marketData,
                  performanceData: operation.performanceData,
                  constraints: operation.constraints,
                },
              });
              break;

            case "execute":
              // Trigger execution for specified strategies
              result = await inngest.send({
                name: "multi-phase-strategy/execute",
                data: {
                  strategyId: operation.strategyId,
                  userId,
                  symbol: operation.symbol,
                  marketData: operation.marketData,
                  executionParameters: operation.parameters,
                },
              });
              break;

            case "health-check":
              // Trigger health check for specified strategies
              result = await inngest.send({
                name: "strategy/health-check",
                data: {
                  strategyIds: operation.strategyIds || [operation.strategyId],
                  marketData: operation.marketData,
                },
              });
              break;

            default:
              result = { error: `Unknown operation type: ${operation.type}` };
          }

          operationResults.push({
            operationId: operation.id || `${operation.type}_${Date.now()}`,
            type: operation.type,
            strategyId: operation.strategyId,
            status: "triggered",
            result,
          });
        } catch (error) {
          operationResults.push({
            operationId: operation.id || `${operation.type}_${Date.now()}`,
            type: operation.type,
            strategyId: operation.strategyId,
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return operationResults;
    });

    return {
      batchId: `batch_${Date.now()}`,
      userId,
      totalOperations: operations.length,
      results,
      timestamp: new Date().toISOString(),
    };
  }
);

/**
 * Strategy Cleanup Workflow
 */
export const strategyCleanup = inngest.createFunction(
  { id: "strategy-cleanup", name: "Strategy Cleanup" },
  { event: "strategy/cleanup" },
  async ({ event, step }) => {
    const { olderThanDays = 30, dryRun = false } = event.data;

    const cleanup = await step.run("cleanup-old-strategies", async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      try {
        // Find strategies older than cutoff date
        const oldStrategies = await db
          .select()
          .from(tradingStrategies)
          .where(eq(tradingStrategies.status, "inactive"));

        const strategiesToCleanup = oldStrategies.filter(
          (strategy) => new Date(strategy.updatedAt) < cutoffDate
        );

        if (dryRun) {
          return {
            dryRun: true,
            strategiesFound: strategiesToCleanup.length,
            strategies: strategiesToCleanup.map((s) => ({
              id: s.id,
              name: s.name,
              lastUpdated: s.updatedAt,
            })),
          };
        }

        // Actually delete strategies
        const deletedIds = [];
        for (const strategy of strategiesToCleanup) {
          try {
            await db
              .delete(tradingStrategies)
              .where(eq(tradingStrategies.id, strategy.id));

            deletedIds.push(strategy.id);
          } catch (error) {
            console.error(`Failed to delete strategy ${strategy.id}:`, error);
          }
        }

        return {
          dryRun: false,
          strategiesFound: strategiesToCleanup.length,
          strategiesDeleted: deletedIds.length,
          deletedIds,
        };
      } catch (error) {
        return {
          dryRun,
          error: error instanceof Error ? error.message : "Cleanup failed",
          strategiesFound: 0,
          strategiesDeleted: 0,
        };
      }
    });

    return {
      cleanup,
      parameters: {
        olderThanDays,
        dryRun,
      },
      timestamp: new Date().toISOString(),
    };
  }
);

/**
 * Strategy Performance Monitoring Workflow
 */
export const strategyPerformanceMonitoring = inngest.createFunction(
  {
    id: "strategy-performance-monitoring",
    name: "Strategy Performance Monitoring",
  },
  { event: "strategy/performance-monitoring" },
  async ({ event, step }) => {
    const { strategyIds = [], alertThresholds = {} } = event.data;

    const monitoring = await step.run(
      "monitor-strategy-performance",
      async () => {
        const monitoringResults = [];

        const strategies =
          strategyIds.length > 0
            ? await Promise.all(strategyIds.map((id) => getStrategyById(id)))
            : await getActiveStrategies();

        for (const strategy of strategies.filter((s) => s !== null)) {
          try {
            const performance =
              await multiPhaseTradingService.getStrategyPerformance(
                strategy!.id
              );

            const alerts = [];

            // Check performance thresholds
            if (
              alertThresholds.maxDrawdown &&
              performance.maxDrawdown > alertThresholds.maxDrawdown
            ) {
              alerts.push(`Max drawdown exceeded: ${performance.maxDrawdown}%`);
            }

            if (
              alertThresholds.minSuccessRate &&
              performance.successRate < alertThresholds.minSuccessRate
            ) {
              alerts.push(
                `Success rate below threshold: ${performance.successRate}%`
              );
            }

            if (
              alertThresholds.minProfitLoss &&
              performance.totalPnl < alertThresholds.minProfitLoss
            ) {
              alerts.push(`Total P&L below threshold: ${performance.totalPnl}`);
            }

            monitoringResults.push({
              strategyId: strategy!.id,
              name: strategy!.name,
              performance,
              alerts,
              status: alerts.length > 0 ? "warning" : "healthy",
            });
          } catch (error) {
            monitoringResults.push({
              strategyId: strategy!.id,
              name: strategy!.name,
              performance: null,
              alerts: ["Failed to get performance data"],
              status: "error",
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        return {
          totalStrategies: monitoringResults.length,
          healthyStrategies: monitoringResults.filter(
            (r) => r.status === "healthy"
          ).length,
          strategiesWithWarnings: monitoringResults.filter(
            (r) => r.status === "warning"
          ).length,
          strategiesWithErrors: monitoringResults.filter(
            (r) => r.status === "error"
          ).length,
          results: monitoringResults,
        };
      }
    );

    return {
      monitoring,
      alertThresholds,
      timestamp: new Date().toISOString(),
    };
  }
);

/**
 * Health check for the multi-phase strategy system
 */
export const systemHealthCheck = async (): Promise<{
  healthy: boolean;
  components: Record<string, boolean>;
  details: Record<string, any>;
}> => {
  const components = {
    database: false,
    tradingService: false,
    inngest: false,
  };

  const details: Record<string, any> = {};

  try {
    // Check database connectivity
    const dbCheck = await db.select().from(tradingStrategies).limit(1);
    components.database = true;
    details.database = {
      message: "Database accessible",
      strategies: dbCheck.length,
    };
  } catch (error) {
    details.database = {
      error: error instanceof Error ? error.message : "Database error",
    };
  }

  try {
    // Check trading service
    const serviceCheck = await multiPhaseTradingService.getHealthStatus();
    components.tradingService = serviceCheck.healthy;
    details.tradingService = serviceCheck;
  } catch (error) {
    details.tradingService = {
      error: error instanceof Error ? error.message : "Service error",
    };
  }

  try {
    // Check Inngest (basic check)
    components.inngest = !!inngest;
    details.inngest = { message: "Inngest client available" };
  } catch (error) {
    details.inngest = {
      error: error instanceof Error ? error.message : "Inngest error",
    };
  }

  const healthy = Object.values(components).every((status) => status);

  return {
    healthy,
    components,
    details,
  };
};
