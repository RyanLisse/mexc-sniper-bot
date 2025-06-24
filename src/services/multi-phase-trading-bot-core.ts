import { createLogger } from "../lib/structured-logger";
import { MultiPhaseExecutor } from "./multi-phase-executor";
import type { TradingStrategy } from "./trading-strategy-manager";

/**
 * Core multi-phase trading bot functionality
 */
export class MultiPhaseTradingBotCore {
  protected logger = createLogger("multi-phase-trading-bot-core");
  protected executor: MultiPhaseExecutor;
  protected entryPrice: number;
  protected position: number;
  protected symbol: string | undefined;

  constructor(strategy: TradingStrategy, entryPrice: number, position: number) {
    // Convert TradingStrategy to TradingStrategyConfig format
    const strategyConfig = {
      id: strategy.id,
      name: strategy.name,
      description: strategy.description || "",
      levels: strategy.levels,
    };

    this.executor = new MultiPhaseExecutor(strategyConfig, entryPrice, position);
    this.entryPrice = entryPrice;
    this.position = position;
  }

  /**
   * Process price update and execute phases - EXACT implementation from docs
   */
  onPriceUpdate(currentPrice: number): {
    actions: string[];
    status: any;
  } {
    const actions: string[] = [];
    const execution = this.executor.executePhases(currentPrice, {
      maxPhasesPerExecution: 10,
    });

    // Execute pending phases synchronously for immediate tracking
    execution.phasesToExecute.forEach((phase) => {
      actions.push(
        `🎯 EXECUTE Phase ${phase.phase}: Sell ${phase.amount} units ` +
          `@ ${phase.level.multiplier}x for ${phase.expectedProfit.toFixed(2)} profit`
      );

      // Record execution synchronously
      this.recordPhaseExecutionSync(phase.phase, currentPrice, phase.amount, {
        fees: phase.expectedProfit * 0.001,
      });
    });

    // Get current status
    const priceIncreasePercent = ((currentPrice - this.entryPrice) / this.entryPrice) * 100;
    const updatedSummary = this.executor.calculateSummary(currentPrice);
    const phaseStatus = this.executor.getPhaseStatus();
    const visualization = this.executor.getPhaseVisualization(currentPrice);

    // Determine simple status string
    let simpleStatus = "monitoring";
    if (actions.length > 0) {
      simpleStatus = "executing";
    }

    return {
      actions,
      status: {
        currentPrice,
        priceIncrease: `${priceIncreasePercent.toFixed(2)}%`,
        summary: updatedSummary,
        phaseStatus,
        visualization,
        nextTarget: updatedSummary.nextPhaseTarget
          ? `${updatedSummary.nextPhaseTarget.toFixed(2)}`
          : "All phases completed",
        simpleStatus,
      },
    };
  }

  /**
   * Get current bot status
   */
  getStatus(): {
    entryPrice: number;
    position: number;
    executor: MultiPhaseExecutor;
    isComplete: boolean;
    completionPercentage: number;
  } {
    const phaseStatus = this.executor.getPhaseStatus();

    return {
      entryPrice: this.entryPrice,
      position: this.position,
      executor: this.executor,
      isComplete: this.executor.isComplete(),
      completionPercentage: (phaseStatus.completedPhases / phaseStatus.totalPhases) * 100,
    };
  }

  /**
   * Update position size
   */
  updatePosition(newPosition: number): void {
    this.position = newPosition;
  }

  /**
   * Reset bot to initial state
   */
  reset(): void {
    this.executor.reset();
  }

  /**
   * Export bot state for persistence
   */
  exportState(): {
    entryPrice: number;
    position: number;
    executorState: any;
  } {
    return {
      entryPrice: this.entryPrice,
      position: this.position,
      executorState: this.executor.exportState(),
    };
  }

  /**
   * Import bot state from persistence
   */
  importState(state: { entryPrice: number; position: number; executorState: any }): void {
    this.entryPrice = state.entryPrice;
    this.position = state.position;
    this.executor.importState(state.executorState);
  }

  /**
   * Get current phase execution status
   */
  getPhaseStatus(): {
    currentPhase: number;
    totalPhases: number;
    completedPhases: number;
    pendingPhases: number;
    phaseDetails: Array<{
      phase: number;
      targetPrice: number;
      sellAmount: number;
      status: "pending" | "executing" | "completed";
      expectedProfit?: number;
    }>;
    nextExecution?: {
      phase: number;
      price: number;
      amount: number;
    };
  } {
    const phaseStatus = this.executor.getPhaseStatus();

    // Build detailed phase information
    const phaseDetails = phaseStatus.phaseDetails.map((phase, index) => {
      const strategyLevel = this.executor.getStrategy().levels[index];
      const sellPercentage = strategyLevel?.sellPercentage || 0;

      return {
        phase: index + 1,
        targetPrice: this.entryPrice * (1 + phase.percentage / 100),
        sellAmount: (this.position * sellPercentage) / 100,
        status: phase.status === "completed" ? ("completed" as const) : ("pending" as const),
        expectedProfit:
          phase.status === "completed"
            ? undefined
            : (this.entryPrice * (1 + phase.percentage / 100) - this.entryPrice) *
              ((this.position * sellPercentage) / 100),
      };
    });

    // Find next execution
    const nextPhase = phaseDetails.find((p) => p.status === "pending");
    const nextExecution = nextPhase
      ? {
          phase: nextPhase.phase,
          price: nextPhase.targetPrice,
          amount: nextPhase.sellAmount,
        }
      : undefined;

    return {
      currentPhase: phaseStatus.completedPhases + 1,
      totalPhases: phaseStatus.totalPhases,
      completedPhases: phaseStatus.completedPhases,
      pendingPhases: phaseStatus.totalPhases - phaseStatus.completedPhases,
      phaseDetails,
      nextExecution,
    };
  }

  /**
   * Synchronous phase execution recording for immediate state updates
   */
  protected recordPhaseExecutionSync(
    phaseNumber: number,
    executionPrice: number,
    amount: number,
    options?: {
      fees?: number;
      slippage?: number;
      latency?: number;
    }
  ): void {
    const profit = amount * (executionPrice - this.entryPrice) - (options?.fees || 0);

    // Update executor state immediately
    (this.executor as any).executedPhases.add(phaseNumber);

    const executionRecord = {
      phase: phaseNumber,
      price: executionPrice,
      amount,
      profit,
      timestamp: new Date(),
      executionLatency: options?.latency,
      slippage: options?.slippage,
    };

    (this.executor as any).phaseHistory.push(executionRecord);

    // Also call the async method for database persistence
    this.executor
      .recordPhaseExecution(phaseNumber, executionPrice, amount, options)
      .catch((error) => {
        this.logger.error("Failed to persist phase execution to database:", error);
      });
  }
}
