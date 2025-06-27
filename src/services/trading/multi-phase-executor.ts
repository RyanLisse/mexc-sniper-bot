import type { TradingStrategy } from "@/src/db/schemas/strategies";
import { MultiPhaseExecutionAnalyzer } from "./multi-phase-execution-analyzer";
import type {
  ExecutionAnalytics,
  ExecutionOptions,
  ExecutionSummary,
  ExecutorOptions,
  ExecutorState,
  PhaseExecutionHistory,
  PhaseStatus,
  PhaseToExecute,
  RecordingOptions,
} from "./multi-phase-executor-types";
import { MultiPhasePhaseRecorder } from "./multi-phase-phase-recorder";
import type { TradingStrategyConfig } from "./multi-phase-trading-service";
import { multiPhaseTradingService } from "./multi-phase-trading-service";
import { MultiPhaseVisualizer } from "./multi-phase-visualizer";

export class MultiPhaseExecutor {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[multi-phase-executor]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[multi-phase-executor]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[multi-phase-executor]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[multi-phase-executor]", message, context || ""),
  };

  private executedPhases: Set<number> = new Set();
  private phaseHistory: PhaseExecutionHistory[] = [];
  private strategy: TradingStrategyConfig;
  private entryPrice: number;
  private totalAmount: number;

  // Modular components
  private analyzer: MultiPhaseExecutionAnalyzer;
  private recorder: MultiPhasePhaseRecorder;
  private visualizer: MultiPhaseVisualizer;

  constructor(
    strategy: TradingStrategyConfig,
    entryPrice: number,
    totalAmount: number,
    options?: ExecutorOptions
  ) {
    this.strategy = strategy;
    this.entryPrice = entryPrice;
    this.totalAmount = totalAmount;

    // Validate entry price immediately
    this.validateEntryPrice();

    // Initialize modular components
    this.analyzer = new MultiPhaseExecutionAnalyzer();
    this.recorder = new MultiPhasePhaseRecorder(options?.strategyId, options?.userId);
    this.visualizer = new MultiPhaseVisualizer();

    // Load existing execution state if provided
    if (options?.executedPhases) {
      this.executedPhases = new Set(options.executedPhases);
    }
    if (options?.existingHistory) {
      this.phaseHistory = [...options.existingHistory];
    }

    // Synchronize state consistency if we have imported state
    if (options?.executedPhases || options?.existingHistory) {
      this.synchronizeState();
    }
  }

  /**
   * Validates that entry price is valid for calculations
   */
  private validateEntryPrice(): void {
    if (!this.entryPrice || this.entryPrice <= 0) {
      throw new Error(
        `Invalid entry price (${this.entryPrice}) - must be a positive number greater than 0`
      );
    }
  }

  /**
   * Execute phases based on current price
   */
  executePhases(
    currentPrice: number,
    options?: ExecutionOptions
  ): {
    phasesToExecute: PhaseToExecute[];
    summary: ExecutionSummary;
  } {
    const priceIncrease = ((currentPrice - this.entryPrice) / this.entryPrice) * 100;
    const phasesToExecute: PhaseToExecute[] = [];
    const maxPhases = options?.maxPhasesPerExecution || 3;

    // Check which phases should be executed
    this.strategy.levels.forEach((level, index) => {
      const phaseNumber = index + 1;

      // Skip if already executed
      if (this.executedPhases.has(phaseNumber)) {
        return;
      }

      // Check if price target is reached
      if (priceIncrease >= level.percentage) {
        const amount = (this.totalAmount * level.sellPercentage) / 100;
        const targetPrice = this.entryPrice * level.multiplier;
        const expectedProfit = amount * (currentPrice - this.entryPrice);

        // Calculate urgency based on how far past the target we are
        const overshoot = priceIncrease - level.percentage;
        let urgency: "low" | "medium" | "high";
        if (overshoot > 20) urgency = "high";
        else if (overshoot > 10) urgency = "medium";
        else urgency = "low";

        phasesToExecute.push({
          phase: phaseNumber,
          level,
          amount,
          expectedProfit,
          targetPrice,
          urgency,
        });
      }
    });

    // Sort by urgency and limit number of phases per execution
    phasesToExecute.sort((a, b) => {
      const urgencyOrder = { high: 3, medium: 2, low: 1 };
      return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
    });

    if (phasesToExecute.length > maxPhases) {
      phasesToExecute.splice(maxPhases);
    }

    // Calculate summary
    const summary = this.calculateSummary(currentPrice);

    return {
      phasesToExecute: phasesToExecute.slice(0, maxPhases),
      summary,
    };
  }

  /**
   * Record phase execution
   */
  async recordPhaseExecution(
    phaseNumber: number,
    executionPrice: number,
    amount: number,
    options?: RecordingOptions
  ): Promise<void> {
    await this.recorder.recordPhaseExecution(
      phaseNumber,
      executionPrice,
      amount,
      this.entryPrice,
      this.strategy,
      this.executedPhases,
      this.phaseHistory,
      options
    );
  }

  /**
   * Get phase execution status
   */
  getPhaseStatus(): {
    totalPhases: number;
    completedPhases: number;
    pendingPhases: number;
    phaseDetails: PhaseStatus[];
    nextPhase: PhaseStatus | null;
  } {
    return this.analyzer.getPhaseStatus(
      this.strategy,
      this.totalAmount,
      this.executedPhases,
      this.phaseHistory
    );
  }

  /**
   * Calculate current execution summary
   */
  calculateSummary(currentPrice: number): ExecutionSummary {
    return this.analyzer.calculateSummary(
      currentPrice,
      this.entryPrice,
      this.totalAmount,
      this.phaseHistory,
      this.strategy,
      this.executedPhases
    );
  }

  /**
   * Visual representation of phases
   */
  getPhaseVisualization(currentPrice: number): string {
    return this.visualizer.getPhaseVisualization(
      currentPrice,
      this.entryPrice,
      this.totalAmount,
      this.strategy,
      this.executedPhases,
      this.phaseHistory
    );
  }

  /**
   * Enhanced visualization with current price percentage
   */
  getPhaseVisualizationWithPercentage(currentPricePercentage: number): string {
    return this.visualizer.getPhaseVisualizationWithPercentage(
      currentPricePercentage,
      this.strategy,
      this.executedPhases
    );
  }

  /**
   * Get execution analytics
   */
  getExecutionAnalytics(): ExecutionAnalytics {
    return this.analyzer.getExecutionAnalytics(this.phaseHistory);
  }

  /**
   * Export current state for persistence
   */
  exportState(): ExecutorState {
    return {
      executedPhases: Array.from(this.executedPhases),
      phaseHistory: this.phaseHistory,
      strategy: this.strategy,
      entryPrice: this.entryPrice,
      totalAmount: this.totalAmount,
    };
  }

  /**
   * Import state from persistence with validation and synchronization
   */
  importState(state: { executedPhases: number[]; phaseHistory: PhaseExecutionHistory[] }): void {
    try {
      // Validate state before importing
      if (state.executedPhases && Array.isArray(state.executedPhases)) {
        this.executedPhases = new Set(state.executedPhases);
      }
      
      if (state.phaseHistory && Array.isArray(state.phaseHistory)) {
        this.phaseHistory = state.phaseHistory;
      }

      // Synchronize state consistency
      this.synchronizeState();
      
      this.logger.debug("State imported successfully", {
        executedPhases: this.executedPhases.size,
        historyCount: this.phaseHistory.length
      });
    } catch (error) {
      this.logger.error("Error importing state", { state }, error as Error);
      // Reset to clean state on import failure
      this.reset();
    }
  }

  /**
   * Synchronize state consistency between executed phases and history
   */
  private synchronizeState(): void {
    try {
      // Ensure executed phases match phase history
      const historyPhases = new Set(this.phaseHistory.map(h => h.phase));
      
      // Remove orphaned executed phases that don't have history
      for (const phase of this.executedPhases) {
        if (!historyPhases.has(phase)) {
          this.logger.warn("Removing orphaned executed phase", { phase });
          this.executedPhases.delete(phase);
        }
      }

      // Add missing executed phases from history
      for (const historyEntry of this.phaseHistory) {
        if (!this.executedPhases.has(historyEntry.phase)) {
          this.logger.warn("Adding missing executed phase from history", { phase: historyEntry.phase });
          this.executedPhases.add(historyEntry.phase);
        }
      }

      this.logger.debug("State synchronization completed", {
        executedPhases: Array.from(this.executedPhases),
        historyCount: this.phaseHistory.length
      });
    } catch (error) {
      this.logger.error("Error during state synchronization", {}, error as Error);
    }
  }

  /**
   * Reset executor state
   */
  reset(): void {
    this.executedPhases.clear();
    this.phaseHistory = [];
  }

  /**
   * Check if strategy is complete
   */
  isComplete(): boolean {
    return this.executedPhases.size === this.strategy.levels.length;
  }

  /**
   * Get remaining phases
   */
  getRemainingPhases(): number[] {
    const remaining: number[] = [];
    for (let i = 1; i <= this.strategy.levels.length; i++) {
      if (!this.executedPhases.has(i)) {
        remaining.push(i);
      }
    }
    return remaining;
  }

  /**
   * Get the current trading strategy configuration
   */
  getStrategy(): TradingStrategyConfig {
    return this.strategy;
  }
}

// Utility function to create executor from database strategy
export async function createExecutorFromStrategy(
  strategy: TradingStrategy,
  userId: string
): Promise<MultiPhaseExecutor> {
  // Handle the case where levels might be undefined (e.g., in tests)
  const levels = strategy.levels ? JSON.parse(strategy.levels) : [];
  const strategyConfig: TradingStrategyConfig = {
    id: strategy.id.toString(),
    name: strategy.name,
    description: strategy.description || "",
    levels,
  };

  // Get existing executions
  const executions = await multiPhaseTradingService.getStrategyPhaseExecutions(strategy.id, userId);

  const executedPhases = executions
    .filter((exec) => exec.executionStatus === "executed")
    .map((exec) => exec.phaseNumber);

  const existingHistory: PhaseExecutionHistory[] = executions
    .filter((exec) => exec.executionStatus === "executed")
    .map((exec) => ({
      phase: exec.phaseNumber,
      price: exec.executionPrice || 0,
      amount: exec.executedQuantity || 0,
      profit: exec.profit || 0,
      timestamp: exec.executedAt || new Date(),
      executionLatency: undefined,
      slippage: exec.slippage || undefined,
    }));

  return new MultiPhaseExecutor(strategyConfig, strategy.entryPrice, strategy.positionSize, {
    strategyId: strategy.id,
    userId,
    executedPhases,
    existingHistory,
  });
}

// Re-export types for convenience
export type {
  ExecutionAnalytics,
  ExecutionOptions,
  ExecutionSummary,
  ExecutorOptions,
  ExecutorState,
  PhaseExecutionHistory,
  PhaseStatus,
  PhaseToExecute,
  RecordingOptions,
} from "./multi-phase-executor-types";
