import type { TradingStrategy } from "../db/schemas/strategies";
import { createSafeLogger } from "../lib/structured-logger";
import type { PriceMultiplier, TradingStrategyConfig } from "./multi-phase-trading-service";
import { multiPhaseTradingService } from "./multi-phase-trading-service";

// ===========================================
// MULTI-PHASE STRATEGY EXECUTOR
// ===========================================

export interface PhaseExecutionHistory {
  phase: number;
  price: number;
  amount: number;
  profit: number;
  timestamp: Date;
  executionLatency?: number;
  slippage?: number;
}

export interface ExecutionSummary {
  totalSold: number;
  totalRemaining: number;
  realizedProfit: number;
  unrealizedProfit: number;
  completedPhases: number;
  nextPhaseTarget: number | null;
  totalFees: number;
  avgSlippage: number;
  executionEfficiency: number;
}

export interface PhaseStatus {
  phase: number;
  target: string;
  percentage: number;
  sellAmount: number;
  status: "completed" | "pending" | "triggered" | "failed";
  executionPrice?: number;
  profit?: number;
  timestamp?: Date;
}

export interface PhaseToExecute {
  phase: number;
  level: PriceMultiplier;
  amount: number;
  expectedProfit: number;
  targetPrice: number;
  urgency: "low" | "medium" | "high";
}

export class MultiPhaseExecutor {
  private logger = createSafeLogger("multi-phase-executor");

  private executedPhases: Set<number> = new Set();
  private phaseHistory: PhaseExecutionHistory[] = [];
  private strategy: TradingStrategyConfig;
  private entryPrice: number;
  private totalAmount: number;
  private strategyId?: number;
  private userId?: string;

  constructor(
    strategy: TradingStrategyConfig,
    entryPrice: number,
    totalAmount: number,
    options?: {
      strategyId?: number;
      userId?: string;
      executedPhases?: number[];
      existingHistory?: PhaseExecutionHistory[];
    }
  ) {
    this.strategy = strategy;
    this.entryPrice = entryPrice;
    this.totalAmount = totalAmount;
    this.strategyId = options?.strategyId;
    this.userId = options?.userId;

    // Validate entry price immediately
    this.validateEntryPrice();

    // Load existing execution state if provided
    if (options?.executedPhases) {
      this.executedPhases = new Set(options.executedPhases);
    }
    if (options?.existingHistory) {
      this.phaseHistory = [...options.existingHistory];
    }
  }

  /**
   * Validates that entry price is valid for calculations
   * @throws Error if entry price is invalid
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
   * @param currentPrice Current market price
   * @param options Execution options
   * @returns Phases to execute and summary
   */
  executePhases(
    currentPrice: number,
    options?: {
      dryRun?: boolean;
      maxPhasesPerExecution?: number;
      priceThreshold?: number; // Minimum price movement to trigger
    }
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
   * @param phaseNumber Phase that was executed
   * @param executionPrice Actual execution price
   * @param amount Amount executed
   * @param fees Trading fees
   * @param slippage Price slippage
   * @param latency Execution latency in ms
   */
  async recordPhaseExecution(
    phaseNumber: number,
    executionPrice: number,
    amount: number,
    options?: {
      fees?: number;
      slippage?: number;
      latency?: number;
      exchangeOrderId?: string;
      exchangeResponse?: string;
    }
  ): Promise<void> {
    const profit = amount * (executionPrice - this.entryPrice) - (options?.fees || 0);

    this.executedPhases.add(phaseNumber);

    const executionRecord: PhaseExecutionHistory = {
      phase: phaseNumber,
      price: executionPrice,
      amount,
      profit,
      timestamp: new Date(),
      executionLatency: options?.latency,
      slippage: options?.slippage,
    };

    this.phaseHistory.push(executionRecord);

    // Persist to database if strategy ID and user ID are available
    if (this.strategyId && this.userId) {
      try {
        await multiPhaseTradingService.recordPhaseExecution({
          strategyId: this.strategyId,
          userId: this.userId,
          phaseNumber,
          targetPrice: this.entryPrice * this.strategy.levels[phaseNumber - 1].multiplier,
          executionPrice,
          executedQuantity: amount,
          profit,
          fees: options?.fees,
          exchangeOrderId: options?.exchangeOrderId,
          exchangeResponse: options?.exchangeResponse,
        });
      } catch (error) {
        logger.error("Failed to record phase execution:", error);
        // Continue execution even if database recording fails
      }
    }
  }

  /**
   * Get phase execution status
   * @returns Detailed phase status information
   */
  getPhaseStatus(): {
    totalPhases: number;
    completedPhases: number;
    pendingPhases: number;
    phaseDetails: PhaseStatus[];
    nextPhase: PhaseStatus | null;
  } {
    const totalPhases = this.strategy.levels.length;
    const completedPhases = this.executedPhases.size;

    const phaseDetails: PhaseStatus[] = this.strategy.levels.map((level, index) => {
      const phaseNumber = index + 1;
      const execution = this.phaseHistory.find((h) => h.phase === phaseNumber);

      return {
        phase: phaseNumber,
        target: `+${level.percentage}% (${level.multiplier}x)`,
        percentage: level.sellPercentage,
        sellAmount: (this.totalAmount * level.sellPercentage) / 100,
        status: this.executedPhases.has(phaseNumber) ? "completed" : "pending",
        executionPrice: execution?.price,
        profit: execution?.profit,
        timestamp: execution?.timestamp,
      };
    });

    const nextPhase = phaseDetails.find((p) => p.status === "pending") || null;

    return {
      totalPhases,
      completedPhases,
      pendingPhases: totalPhases - completedPhases,
      phaseDetails,
      nextPhase,
    };
  }

  /**
   * Calculate current execution summary
   * @param currentPrice Current market price
   * @returns Detailed execution summary
   */
  calculateSummary(currentPrice: number): ExecutionSummary {
    const totalSold = this.phaseHistory.reduce((sum, phase) => sum + phase.amount, 0);
    const totalRemaining = this.totalAmount - totalSold;
    const realizedProfit = this.phaseHistory.reduce((sum, phase) => sum + phase.profit, 0);
    const unrealizedProfit = totalRemaining * (currentPrice - this.entryPrice);
    const totalFees = this.phaseHistory.reduce((sum, phase) => {
      // Estimate fees if not recorded (0.1% typical)
      return sum + phase.profit * 0.001;
    }, 0);

    const avgSlippage =
      this.phaseHistory.length > 0
        ? this.phaseHistory.reduce((sum, phase) => sum + (phase.slippage || 0), 0) /
          this.phaseHistory.length
        : 0;

    // Calculate execution efficiency (how close to target prices we executed)
    let executionEfficiency = 100;
    if (this.phaseHistory.length > 0) {
      const efficiencies = this.phaseHistory.map((phase) => {
        const targetPrice = this.entryPrice * this.strategy.levels[phase.phase - 1].multiplier;
        const efficiency = Math.min(100, (phase.price / targetPrice) * 100);
        return efficiency;
      });
      executionEfficiency = efficiencies.reduce((sum, eff) => sum + eff, 0) / efficiencies.length;
    }

    // Find next phase target
    let nextPhaseTarget: number | null = null;
    for (let i = 0; i < this.strategy.levels.length; i++) {
      if (!this.executedPhases.has(i + 1)) {
        nextPhaseTarget = this.entryPrice * this.strategy.levels[i].multiplier;
        break;
      }
    }

    return {
      totalSold,
      totalRemaining,
      realizedProfit,
      unrealizedProfit,
      completedPhases: this.executedPhases.size,
      nextPhaseTarget,
      totalFees,
      avgSlippage,
      executionEfficiency,
    };
  }

  /**
   * Visual representation of phases - EXACT implementation from docs
   * @param currentPrice Current market price
   * @returns String representation of phase status with emoji indicators
   */
  getPhaseVisualization(currentPrice: number): string {
    const priceIncrease = ((currentPrice - this.entryPrice) / this.entryPrice) * 100;

    const phases = this.strategy.levels.map((level, index) => {
      const phaseNum = index + 1;
      const isExecuted = this.executedPhases.has(phaseNum);
      const isNext = !isExecuted && priceIncrease < level.percentage;

      let status = "⬜"; // Pending
      if (isExecuted)
        status = "✅"; // Completed
      else if (isNext) status = "🎯"; // Next target

      return `${status} Phase ${phaseNum}: ${level.sellPercentage}% @ +${level.percentage}%`;
    });

    const summary = this.calculateSummary(currentPrice);
    phases.push("");
    phases.push(`💰 Realized P&L: ${summary.realizedProfit.toFixed(2)}`);
    phases.push(`📈 Unrealized P&L: ${summary.unrealizedProfit.toFixed(2)}`);
    phases.push(`🎯 Completed: ${summary.completedPhases}/${this.strategy.levels.length}`);

    if (summary.nextPhaseTarget) {
      phases.push(`⏭️ Next Target: ${summary.nextPhaseTarget.toFixed(2)}`);
    }

    return phases.join("\n");
  }

  /**
   * Enhanced visualization with current price percentage - EXACT from docs
   * @param currentPricePercentage Current price increase percentage
   * @returns String representation with enhanced status indicators
   */
  getPhaseVisualizationWithPercentage(currentPricePercentage: number): string {
    const phases = this.strategy.levels.map((level, index) => {
      const phaseNum = index + 1;
      const isExecuted = this.executedPhases.has(phaseNum);
      const isNext = !isExecuted && currentPricePercentage < level.percentage;

      let status = "⬜"; // Pending
      if (isExecuted)
        status = "✅"; // Completed
      else if (isNext) status = "🎯"; // Next target

      return `${status} Phase ${phaseNum}: ${level.sellPercentage}% @ +${level.percentage}%`;
    });

    return phases.join("\n");
  }

  /**
   * Get execution analytics
   * @returns Detailed execution analytics
   */
  getExecutionAnalytics(): {
    totalExecutions: number;
    avgExecutionTime: number;
    successRate: number;
    avgSlippage: number;
    totalProfitRealized: number;
    bestExecution: PhaseExecutionHistory | null;
    worstExecution: PhaseExecutionHistory | null;
    executionTrend: "improving" | "declining" | "stable";
  } {
    if (this.phaseHistory.length === 0) {
      return {
        totalExecutions: 0,
        avgExecutionTime: 0,
        successRate: 0,
        avgSlippage: 0,
        totalProfitRealized: 0,
        bestExecution: null,
        worstExecution: null,
        executionTrend: "stable",
      };
    }

    const avgExecutionTime =
      this.phaseHistory
        .filter((h) => h.executionLatency)
        .reduce((sum, h) => sum + (h.executionLatency || 0), 0) / this.phaseHistory.length;

    const avgSlippage =
      this.phaseHistory
        .filter((h) => h.slippage !== undefined)
        .reduce((sum, h) => sum + (h.slippage || 0), 0) / this.phaseHistory.length;

    const totalProfitRealized = this.phaseHistory.reduce((sum, h) => sum + h.profit, 0);

    const bestExecution = this.phaseHistory.reduce(
      (best, current) => (!best || current.profit > best.profit ? current : best),
      null as PhaseExecutionHistory | null
    );

    const worstExecution = this.phaseHistory.reduce(
      (worst, current) => (!worst || current.profit < worst.profit ? current : worst),
      null as PhaseExecutionHistory | null
    );

    // Determine execution trend based on recent performance
    let executionTrend: "improving" | "declining" | "stable" = "stable";
    if (this.phaseHistory.length >= 3) {
      const recent = this.phaseHistory.slice(-3);
      const earlier = this.phaseHistory.slice(-6, -3);

      if (recent.length === 3 && earlier.length === 3) {
        const recentAvgProfit = recent.reduce((sum, h) => sum + h.profit, 0) / 3;
        const earlierAvgProfit = earlier.reduce((sum, h) => sum + h.profit, 0) / 3;

        if (recentAvgProfit > earlierAvgProfit * 1.1) executionTrend = "improving";
        else if (recentAvgProfit < earlierAvgProfit * 0.9) executionTrend = "declining";
      }
    }

    return {
      totalExecutions: this.phaseHistory.length,
      avgExecutionTime,
      successRate: 100, // All recorded executions are considered successful
      avgSlippage,
      totalProfitRealized,
      bestExecution,
      worstExecution,
      executionTrend,
    };
  }

  /**
   * Export current state for persistence
   * @returns Serializable state object
   */
  exportState(): {
    executedPhases: number[];
    phaseHistory: PhaseExecutionHistory[];
    strategy: TradingStrategyConfig;
    entryPrice: number;
    totalAmount: number;
  } {
    return {
      executedPhases: Array.from(this.executedPhases),
      phaseHistory: this.phaseHistory,
      strategy: this.strategy,
      entryPrice: this.entryPrice,
      totalAmount: this.totalAmount,
    };
  }

  /**
   * Import state from persistence
   * @param state Previously exported state
   */
  importState(state: { executedPhases: number[]; phaseHistory: PhaseExecutionHistory[] }): void {
    this.executedPhases = new Set(state.executedPhases);
    this.phaseHistory = state.phaseHistory;
  }

  /**
   * Reset executor state (useful for testing or manual intervention)
   */
  reset(): void {
    this.executedPhases.clear();
    this.phaseHistory = [];
  }

  /**
   * Check if strategy is complete
   * @returns True if all phases have been executed
   */
  isComplete(): boolean {
    return this.executedPhases.size === this.strategy.levels.length;
  }

  /**
   * Get remaining phases
   * @returns Array of remaining phase numbers
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
   * @returns The trading strategy configuration
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
  const levels = strategy.levels ? (JSON.parse(strategy.levels) as PriceMultiplier[]) : [];
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
