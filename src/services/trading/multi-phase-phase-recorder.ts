import type { PhaseExecutionHistory, RecordingOptions } from "./multi-phase-executor-types";
import { multiPhaseTradingService } from "./multi-phase-trading-service";

/**
 * Handles phase execution recording and database persistence
 */
export class MultiPhasePhaseRecorder {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[multi-phase-phase-recorder]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[multi-phase-phase-recorder]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[multi-phase-phase-recorder]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[multi-phase-phase-recorder]", message, context || ""),
  };

  constructor(
    private strategyId?: number,
    private userId?: string
  ) {}

  /**
   * Record phase execution in memory and database
   */
  async recordPhaseExecution(
    phaseNumber: number,
    executionPrice: number,
    amount: number,
    entryPrice: number,
    strategy: any,
    executedPhases: Set<number>,
    phaseHistory: PhaseExecutionHistory[],
    options?: RecordingOptions
  ): Promise<void> {
    const profit = amount * (executionPrice - entryPrice) - (options?.fees || 0);

    executedPhases.add(phaseNumber);

    const executionRecord: PhaseExecutionHistory = {
      phase: phaseNumber,
      price: executionPrice,
      amount,
      profit,
      timestamp: new Date(),
      executionLatency: options?.latency,
      slippage: options?.slippage,
    };

    phaseHistory.push(executionRecord);

    // Persist to database if strategy ID and user ID are available
    if (this.strategyId && this.userId) {
      try {
        await multiPhaseTradingService.recordPhaseExecution({
          strategyId: this.strategyId,
          userId: this.userId,
          phaseNumber,
          targetPrice: entryPrice * strategy.levels[phaseNumber - 1].multiplier,
          executionPrice,
          executedQuantity: amount,
          profit,
          fees: options?.fees,
          exchangeOrderId: options?.exchangeOrderId,
          exchangeResponse: options?.exchangeResponse,
        });

        console.info(
          `Phase ${phaseNumber} execution recorded: ${amount} @ ${executionPrice} (profit: ${profit.toFixed(2)})`
        );
      } catch (error) {
        console.error("Failed to record phase execution:", error);
        // Continue execution even if database recording fails
      }
    }
  }

  /**
   * Update strategy and user IDs for recording
   */
  updateRecordingContext(strategyId?: number, userId?: string): void {
    this.strategyId = strategyId;
    this.userId = userId;
  }

  /**
   * Get recording context
   */
  getRecordingContext(): { strategyId?: number; userId?: string } {
    return {
      strategyId: this.strategyId,
      userId: this.userId,
    };
  }

  /**
   * Check if recording is enabled
   */
  isRecordingEnabled(): boolean {
    return !!(this.strategyId && this.userId);
  }
}
