/**
 * Action Execution Module
 *
 * Handles execution of emergency actions, level-specific responses, and action coordination.
 * Extracted from advanced-emergency-coordinator.ts for better modularity.
 */

import type {
  EmergencyAction,
  EmergencyLevel,
} from "./protocol-management-module";

export interface ActionExecutionResult {
  actionId: string;
  success: boolean;
  startTime: string;
  endTime: string;
  duration: number;
  result?: any;
  error?: string;
  retryCount?: number;
}

export interface ActionExecutionConfig {
  maxRetryAttempts: number;
  defaultTimeout: number;
  rollbackOnFailure: boolean;
}

export class ActionExecutionModule {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[action-execution-module]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[action-execution-module]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error(
        "[action-execution-module]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: any) =>
      console.debug("[action-execution-module]", message, context || ""),
  };

  private config: ActionExecutionConfig;
  private executionHistory: ActionExecutionResult[] = [];
  private activeExecutions: Map<
    string,
    { actionId: string; startTime: number }
  > = new Map();

  constructor(config: ActionExecutionConfig) {
    this.config = config;
  }

  /**
   * Execute emergency level actions
   */
  async executeEmergencyLevel(
    sessionId: string,
    level: EmergencyLevel
  ): Promise<ActionExecutionResult[]> {
    const results: ActionExecutionResult[] = [];

    this.logger.info("Executing emergency level actions", {
      sessionId,
      levelId: level.id,
      levelName: level.name,
      actionCount: level.autoActions.length,
    });

    try {
      // Sort actions by priority (lower number = higher priority)
      const sortedActions = [...level.autoActions].sort(
        (a, b) => a.priority - b.priority
      );

      // Execute actions with dependency resolution
      for (const action of sortedActions) {
        if (await this.checkActionDependencies(action, results)) {
          const result = await this.executeAction(sessionId, action);
          results.push(result);

          // If critical action fails and rollback is enabled, stop execution
          if (
            !result.success &&
            this.config.rollbackOnFailure &&
            action.priority <= 2
          ) {
            this.logger.warn("Critical action failed, stopping execution", {
              sessionId,
              actionId: action.id,
              error: result.error,
            });
            break;
          }
        } else {
          this.logger.warn("Action dependencies not met, skipping", {
            sessionId,
            actionId: action.id,
            dependencies: action.dependencies,
          });

          results.push({
            actionId: action.id,
            success: false,
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            duration: 0,
            error: "Dependencies not met",
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      this.logger.info("Emergency level execution completed", {
        sessionId,
        levelId: level.id,
        totalActions: results.length,
        successful: successCount,
        failed: results.length - successCount,
      });

      return results;
    } catch (error) {
      this.logger.error("Emergency level execution failed", {
        sessionId,
        levelId: level.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    }
  }

  /**
   * Execute individual emergency action
   */
  async executeAction(
    sessionId: string,
    action: EmergencyAction
  ): Promise<ActionExecutionResult> {
    const startTime = new Date().toISOString();
    const executionKey = `${sessionId}_${action.id}`;

    this.activeExecutions.set(executionKey, {
      actionId: action.id,
      startTime: Date.now(),
    });

    let retryCount = 0;
    let lastError: Error | null = null;

    this.logger.info("Executing emergency action", {
      sessionId,
      actionId: action.id,
      type: action.type,
      timeout: action.timeout,
      maxRetries: action.retryCount,
    });

    while (retryCount <= action.retryCount) {
      try {
        const result = await this.executeActionType(
          sessionId,
          action,
          retryCount
        );
        const endTime = new Date().toISOString();
        const duration = Date.now() - new Date(startTime).getTime();

        this.activeExecutions.delete(executionKey);

        const executionResult: ActionExecutionResult = {
          actionId: action.id,
          success: true,
          startTime,
          endTime,
          duration,
          result,
          retryCount,
        };

        this.executionHistory.push(executionResult);

        this.logger.info("Emergency action executed successfully", {
          sessionId,
          actionId: action.id,
          duration,
          retryCount,
        });

        return executionResult;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");
        retryCount++;

        this.logger.warn(`Emergency action attempt ${retryCount} failed`, {
          sessionId,
          actionId: action.id,
          retryCount,
          maxRetries: action.retryCount,
          error: lastError.message,
        });

        // Wait before retry (exponential backoff)
        if (retryCount <= action.retryCount) {
          const delay = Math.min(1000 * 2 ** (retryCount - 1), 10000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    const endTime = new Date().toISOString();
    const duration = Date.now() - new Date(startTime).getTime();

    this.activeExecutions.delete(executionKey);

    const executionResult: ActionExecutionResult = {
      actionId: action.id,
      success: false,
      startTime,
      endTime,
      duration,
      error: lastError?.message || "Unknown error",
      retryCount: retryCount - 1,
    };

    this.executionHistory.push(executionResult);

    this.logger.error("Emergency action failed after all retries", {
      sessionId,
      actionId: action.id,
      duration,
      retryCount: retryCount - 1,
      error: lastError?.message,
    });

    return executionResult;
  }

  /**
   * Execute specific action type
   */
  private async executeActionType(
    _sessionId: string,
    action: EmergencyAction,
    _retryCount: number
  ): Promise<any> {
    const timeout = action.timeout || this.config.defaultTimeout;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Action timeout after ${timeout}ms`));
      }, timeout);

      // Simulate action execution based on type
      this.performActionExecution(action.type, action.conditions)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Perform actual action execution based on type
   */
  private async performActionExecution(
    actionType: EmergencyAction["type"],
    conditions: Record<string, any>
  ): Promise<any> {
    // Simulate different action types
    switch (actionType) {
      case "halt_trading":
        await new Promise((resolve) => setTimeout(resolve, 100));
        this.logger.info("Trading halted", { conditions });
        return {
          status: "trading_halted",
          timestamp: new Date().toISOString(),
        };

      case "close_positions":
        await new Promise((resolve) => setTimeout(resolve, 200));
        this.logger.info("Positions closed", { conditions });
        return {
          status: "positions_closed",
          count: Math.floor(Math.random() * 10) + 1,
        };

      case "reduce_exposure": {
        await new Promise((resolve) => setTimeout(resolve, 150));
        const reduction = conditions.max_reduction || 0.5;
        this.logger.info("Exposure reduced", { reduction, conditions });
        return {
          status: "exposure_reduced",
          reduction_percentage: reduction * 100,
        };
      }

      case "notify_operators":
        await new Promise((resolve) => setTimeout(resolve, 50));
        this.logger.info("Operators notified", { conditions });
        return {
          status: "operators_notified",
          timestamp: new Date().toISOString(),
        };

      case "system_shutdown":
        await new Promise((resolve) => setTimeout(resolve, 300));
        this.logger.info("System shutdown initiated", { conditions });
        return {
          status: "system_shutdown",
          timestamp: new Date().toISOString(),
        };

      case "market_maker_pause":
        await new Promise((resolve) => setTimeout(resolve, 100));
        this.logger.info("Market maker paused", { conditions });
        return {
          status: "market_maker_paused",
          timestamp: new Date().toISOString(),
        };

      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
  }

  /**
   * Check if action dependencies are met
   */
  private async checkActionDependencies(
    action: EmergencyAction,
    completedResults: ActionExecutionResult[]
  ): Promise<boolean> {
    if (!action.dependencies || action.dependencies.length === 0) {
      return true;
    }

    const completedActionIds = completedResults
      .filter((result) => result.success)
      .map((result) => result.actionId);

    const dependenciesMet = action.dependencies.every((dep) =>
      completedActionIds.includes(dep)
    );

    this.logger.debug("Checking action dependencies", {
      actionId: action.id,
      dependencies: action.dependencies,
      completedActions: completedActionIds,
      dependenciesMet,
    });

    return dependenciesMet;
  }

  /**
   * Test emergency actions
   */
  async testEmergencyActions(
    actions: EmergencyAction[],
    simulationMode: boolean = true
  ): Promise<{
    successes: number;
    failures: number;
    results: ActionExecutionResult[];
  }> {
    const results: ActionExecutionResult[] = [];

    this.logger.info("Testing emergency actions", {
      actionCount: actions.length,
      simulationMode,
    });

    for (const action of actions) {
      try {
        if (simulationMode) {
          // Simulate action execution for testing
          const result: ActionExecutionResult = {
            actionId: action.id,
            success: Math.random() > 0.1, // 90% success rate in simulation
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            duration: Math.floor(Math.random() * 1000) + 100,
            result: { test: true, simulated: true },
          };
          results.push(result);
        } else {
          // Actual test execution
          const result = await this.executeAction("test_session", action);
          results.push(result);
        }
      } catch (error) {
        this.logger.error("Action test failed", {
          actionId: action.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });

        results.push({
          actionId: action.id,
          success: false,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          duration: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successes = results.filter((r) => r.success).length;
    const failures = results.length - successes;

    this.logger.info("Action testing completed", {
      total: results.length,
      successes,
      failures,
      simulationMode,
    });

    return { successes, failures, results };
  }

  /**
   * Get active executions
   */
  getActiveExecutions(): Array<{ actionId: string; duration: number }> {
    const now = Date.now();
    return Array.from(this.activeExecutions.values()).map((execution) => ({
      actionId: execution.actionId,
      duration: now - execution.startTime,
    }));
  }

  /**
   * Get execution statistics
   */
  getExecutionStatistics(): {
    totalExecutions: number;
    successRate: number;
    averageExecutionTime: number;
    executionsByType: Record<string, number>;
    retryStatistics: {
      totalRetries: number;
      averageRetriesPerAction: number;
    };
  } {
    const totalExecutions = this.executionHistory.length;
    const successfulExecutions = this.executionHistory.filter(
      (e) => e.success
    ).length;
    const successRate =
      totalExecutions > 0 ? successfulExecutions / totalExecutions : 0;

    const averageExecutionTime =
      totalExecutions > 0
        ? this.executionHistory.reduce((sum, e) => sum + e.duration, 0) /
          totalExecutions
        : 0;

    // Simulate execution type statistics
    const executionsByType = {
      halt_trading: Math.floor(Math.random() * 10),
      close_positions: Math.floor(Math.random() * 10),
      reduce_exposure: Math.floor(Math.random() * 10),
      notify_operators: Math.floor(Math.random() * 10),
      system_shutdown: Math.floor(Math.random() * 5),
      market_maker_pause: Math.floor(Math.random() * 5),
    };

    const totalRetries = this.executionHistory
      .filter((e) => e.retryCount !== undefined)
      .reduce((sum, e) => sum + (e.retryCount || 0), 0);

    const actionsWithRetries = this.executionHistory.filter(
      (e) => e.retryCount !== undefined
    ).length;
    const averageRetriesPerAction =
      actionsWithRetries > 0 ? totalRetries / actionsWithRetries : 0;

    return {
      totalExecutions,
      successRate,
      averageExecutionTime,
      executionsByType,
      retryStatistics: {
        totalRetries,
        averageRetriesPerAction,
      },
    };
  }

  /**
   * Clean old execution history
   */
  cleanOldExecutions(maxAge: number): number {
    const cutoffTime = Date.now() - maxAge;
    const initialCount = this.executionHistory.length;

    this.executionHistory = this.executionHistory.filter((execution) => {
      const executionTime = new Date(execution.startTime).getTime();
      return executionTime > cutoffTime;
    });

    const removedCount = initialCount - this.executionHistory.length;

    if (removedCount > 0) {
      this.logger.info("Old executions cleaned from history", {
        removedCount,
        remainingCount: this.executionHistory.length,
      });
    }

    return removedCount;
  }
}
