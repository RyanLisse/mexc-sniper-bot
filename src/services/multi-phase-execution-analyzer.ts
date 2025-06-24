import { createSafeLogger } from "../lib/structured-logger";
import type {
  ExecutionAnalytics,
  ExecutionSummary,
  PhaseExecutionHistory,
  PhaseStatus,
} from "./multi-phase-executor-types";
import type { TradingStrategyConfig } from "./multi-phase-trading-service";

/**
 * Analyzes multi-phase execution performance and provides detailed metrics
 */
export class MultiPhaseExecutionAnalyzer {
  private logger = createSafeLogger("multi-phase-execution-analyzer");

  /**
   * Calculate comprehensive execution summary
   */
  calculateSummary(
    currentPrice: number,
    entryPrice: number,
    totalAmount: number,
    phaseHistory: PhaseExecutionHistory[],
    strategy: TradingStrategyConfig,
    executedPhases: Set<number>
  ): ExecutionSummary {
    const totalSold = phaseHistory.reduce((sum, phase) => sum + phase.amount, 0);
    const totalRemaining = totalAmount - totalSold;
    const realizedProfit = phaseHistory.reduce((sum, phase) => sum + phase.profit, 0);
    const unrealizedProfit = totalRemaining * (currentPrice - entryPrice);
    const totalFees = phaseHistory.reduce((sum, phase) => {
      // Estimate fees if not recorded (0.1% typical)
      return sum + phase.profit * 0.001;
    }, 0);

    const avgSlippage =
      phaseHistory.length > 0
        ? phaseHistory.reduce((sum, phase) => sum + (phase.slippage || 0), 0) / phaseHistory.length
        : 0;

    // Calculate execution efficiency (how close to target prices we executed)
    let executionEfficiency = 100;
    if (phaseHistory.length > 0) {
      const efficiencies = phaseHistory.map((phase) => {
        const targetPrice = entryPrice * strategy.levels[phase.phase - 1].multiplier;
        const efficiency = Math.min(100, (phase.price / targetPrice) * 100);
        return efficiency;
      });
      executionEfficiency = efficiencies.reduce((sum, eff) => sum + eff, 0) / efficiencies.length;
    }

    // Find next phase target
    let nextPhaseTarget: number | null = null;
    for (let i = 0; i < strategy.levels.length; i++) {
      if (!executedPhases.has(i + 1)) {
        nextPhaseTarget = entryPrice * strategy.levels[i].multiplier;
        break;
      }
    }

    return {
      totalSold,
      totalRemaining,
      realizedProfit,
      unrealizedProfit,
      completedPhases: executedPhases.size,
      nextPhaseTarget,
      totalFees,
      avgSlippage,
      executionEfficiency,
    };
  }

  /**
   * Get detailed phase status information
   */
  getPhaseStatus(
    strategy: TradingStrategyConfig,
    totalAmount: number,
    executedPhases: Set<number>,
    phaseHistory: PhaseExecutionHistory[]
  ): {
    totalPhases: number;
    completedPhases: number;
    pendingPhases: number;
    phaseDetails: PhaseStatus[];
    nextPhase: PhaseStatus | null;
  } {
    const totalPhases = strategy.levels.length;
    const completedPhases = executedPhases.size;

    const phaseDetails: PhaseStatus[] = strategy.levels.map((level, index) => {
      const phaseNumber = index + 1;
      const execution = phaseHistory.find((h) => h.phase === phaseNumber);

      return {
        phase: phaseNumber,
        target: `+${level.percentage}% (${level.multiplier}x)`,
        percentage: level.sellPercentage,
        sellAmount: (totalAmount * level.sellPercentage) / 100,
        status: executedPhases.has(phaseNumber) ? "completed" : "pending",
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
   * Get comprehensive execution analytics
   */
  getExecutionAnalytics(phaseHistory: PhaseExecutionHistory[]): ExecutionAnalytics {
    if (phaseHistory.length === 0) {
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
      phaseHistory
        .filter((h) => h.executionLatency)
        .reduce((sum, h) => sum + (h.executionLatency || 0), 0) / phaseHistory.length;

    const avgSlippage =
      phaseHistory
        .filter((h) => h.slippage !== undefined)
        .reduce((sum, h) => sum + (h.slippage || 0), 0) / phaseHistory.length;

    const totalProfitRealized = phaseHistory.reduce((sum, h) => sum + h.profit, 0);

    const bestExecution = phaseHistory.reduce(
      (best, current) => (!best || current.profit > best.profit ? current : best),
      null as PhaseExecutionHistory | null
    );

    const worstExecution = phaseHistory.reduce(
      (worst, current) => (!worst || current.profit < worst.profit ? current : worst),
      null as PhaseExecutionHistory | null
    );

    // Determine execution trend based on recent performance
    let executionTrend: "improving" | "declining" | "stable" = "stable";
    if (phaseHistory.length >= 3) {
      const recent = phaseHistory.slice(-3);
      const earlier = phaseHistory.slice(-6, -3);

      if (recent.length === 3 && earlier.length === 3) {
        const recentAvgProfit = recent.reduce((sum, h) => sum + h.profit, 0) / 3;
        const earlierAvgProfit = earlier.reduce((sum, h) => sum + h.profit, 0) / 3;

        if (recentAvgProfit > earlierAvgProfit * 1.1) executionTrend = "improving";
        else if (recentAvgProfit < earlierAvgProfit * 0.9) executionTrend = "declining";
      }
    }

    return {
      totalExecutions: phaseHistory.length,
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
   * Calculate phase execution performance metrics
   */
  getPerformanceMetrics(
    phaseHistory: PhaseExecutionHistory[],
    strategy: TradingStrategyConfig,
    entryPrice: number
  ): {
    efficiency: number;
    accuracy: number;
    profitability: number;
    consistency: number;
  } {
    if (phaseHistory.length === 0) {
      return { efficiency: 0, accuracy: 0, profitability: 0, consistency: 0 };
    }

    // Calculate execution efficiency (price accuracy)
    const efficiencies = phaseHistory.map((phase) => {
      const targetPrice = entryPrice * strategy.levels[phase.phase - 1].multiplier;
      return Math.min(100, (phase.price / targetPrice) * 100);
    });
    const efficiency = efficiencies.reduce((sum, eff) => sum + eff, 0) / efficiencies.length;

    // Calculate accuracy (timing accuracy)
    const accuracy = 100; // Simplified - could be based on execution timing vs optimal timing

    // Calculate profitability
    const totalProfit = phaseHistory.reduce((sum, h) => sum + h.profit, 0);
    const totalValue = phaseHistory.reduce((sum, h) => sum + h.amount * h.price, 0);
    const profitability = totalValue > 0 ? (totalProfit / totalValue) * 100 : 0;

    // Calculate consistency (profit variance)
    const avgProfit = totalProfit / phaseHistory.length;
    const variance =
      phaseHistory.reduce((sum, h) => sum + (h.profit - avgProfit) ** 2, 0) / phaseHistory.length;
    const consistency = Math.max(0, 100 - (Math.sqrt(variance) / avgProfit) * 100);

    return {
      efficiency: Math.max(0, Math.min(100, efficiency)),
      accuracy: Math.max(0, Math.min(100, accuracy)),
      profitability: Math.max(0, Math.min(100, profitability)),
      consistency: Math.max(0, Math.min(100, isNaN(consistency) ? 0 : consistency)),
    };
  }
}
