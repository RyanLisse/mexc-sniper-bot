import { MultiPhaseExecutionAnalyzer } from "./multi-phase-execution-analyzer";
import type { PhaseExecutionHistory } from "./multi-phase-executor-types";
import type { TradingStrategyConfig } from "./multi-phase-trading-service";

/**
 * Provides visual representations and status displays for multi-phase execution
 */
export class MultiPhaseVisualizer {
  private logger = {
      info: (message: string, context?: any) => console.info('[multi-phase-visualizer]', message, context || ''),
      warn: (message: string, context?: any) => console.warn('[multi-phase-visualizer]', message, context || ''),
      error: (message: string, context?: any, error?: Error) => console.error('[multi-phase-visualizer]', message, context || '', error || ''),
      debug: (message: string, context?: any) => console.debug('[multi-phase-visualizer]', message, context || ''),
    };
  private analyzer = new MultiPhaseExecutionAnalyzer();

  /**
   * Visual representation of phases - EXACT implementation from docs
   */
  getPhaseVisualization(
    currentPrice: number,
    entryPrice: number,
    totalAmount: number,
    strategy: TradingStrategyConfig,
    executedPhases: Set<number>,
    phaseHistory: PhaseExecutionHistory[]
  ): string {
    const priceIncrease = ((currentPrice - entryPrice) / entryPrice) * 100;

    const phases = strategy.levels.map((level, index) => {
      const phaseNum = index + 1;
      const isExecuted = executedPhases.has(phaseNum);
      const isNext = !isExecuted && priceIncrease < level.percentage;

      let status = "⬜"; // Pending
      if (isExecuted)
        status = "✅"; // Completed
      else if (isNext) status = "🎯"; // Next target

      return `${status} Phase ${phaseNum}: ${level.sellPercentage}% @ +${level.percentage}%`;
    });

    const summary = this.analyzer.calculateSummary(
      currentPrice,
      entryPrice,
      totalAmount,
      phaseHistory,
      strategy,
      executedPhases
    );

    phases.push("");
    phases.push(`💰 Realized P&L: ${summary.realizedProfit.toFixed(2)}`);
    phases.push(`📈 Unrealized P&L: ${summary.unrealizedProfit.toFixed(2)}`);
    phases.push(`🎯 Completed: ${summary.completedPhases}/${strategy.levels.length}`);

    if (summary.nextPhaseTarget) {
      phases.push(`⏭️ Next Target: ${summary.nextPhaseTarget.toFixed(2)}`);
    }

    return phases.join("\n");
  }

  /**
   * Enhanced visualization with current price percentage - EXACT from docs
   */
  getPhaseVisualizationWithPercentage(
    currentPricePercentage: number,
    strategy: TradingStrategyConfig,
    executedPhases: Set<number>
  ): string {
    const phases = strategy.levels.map((level, index) => {
      const phaseNum = index + 1;
      const isExecuted = executedPhases.has(phaseNum);
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
   * Create detailed execution status report
   */
  getExecutionStatusReport(
    currentPrice: number,
    entryPrice: number,
    totalAmount: number,
    strategy: TradingStrategyConfig,
    executedPhases: Set<number>,
    phaseHistory: PhaseExecutionHistory[]
  ): string {
    const priceIncrease = ((currentPrice - entryPrice) / entryPrice) * 100;
    const summary = this.analyzer.calculateSummary(
      currentPrice,
      entryPrice,
      totalAmount,
      phaseHistory,
      strategy,
      executedPhases
    );
    const analytics = this.analyzer.getExecutionAnalytics(phaseHistory);

    const report = [
      "📊 MULTI-PHASE EXECUTION STATUS",
      "═══════════════════════════════",
      "",
      `💹 Current Price: ${currentPrice.toFixed(6)} (+${priceIncrease.toFixed(2)}%)`,
      `🎯 Entry Price: ${entryPrice.toFixed(6)}`,
      "",
      "📈 PROFIT & LOSS",
      `💰 Realized P&L: ${summary.realizedProfit.toFixed(2)}`,
      `📊 Unrealized P&L: ${summary.unrealizedProfit.toFixed(2)}`,
      `🏦 Total Fees: ${summary.totalFees.toFixed(2)}`,
      "",
      "🔄 EXECUTION PROGRESS",
      `✅ Completed Phases: ${summary.completedPhases}/${strategy.levels.length}`,
      `📦 Total Sold: ${summary.totalSold.toFixed(2)}`,
      `📍 Remaining: ${summary.totalRemaining.toFixed(2)}`,
      `⚡ Efficiency: ${summary.executionEfficiency.toFixed(1)}%`,
      "",
      "📊 ANALYTICS",
      `🔢 Total Executions: ${analytics.totalExecutions}`,
      `⏱️ Avg Execution Time: ${analytics.avgExecutionTime.toFixed(0)}ms`,
      `📉 Avg Slippage: ${analytics.avgSlippage.toFixed(3)}%`,
      `📈 Trend: ${analytics.executionTrend}`,
      "",
    ];

    if (summary.nextPhaseTarget) {
      report.push(`🎯 Next Target: ${summary.nextPhaseTarget.toFixed(6)}`);
      report.push("");
    }

    // Add phase breakdown
    report.push("🔍 PHASE BREAKDOWN");
    strategy.levels.forEach((level, index) => {
      const phaseNum = index + 1;
      const isExecuted = executedPhases.has(phaseNum);
      const execution = phaseHistory.find((h) => h.phase === phaseNum);
      const status = isExecuted ? "✅" : "⬜";

      let line = `${status} Phase ${phaseNum}: ${level.sellPercentage}% @ +${level.percentage}%`;
      if (execution) {
        line += ` → ${execution.price.toFixed(6)} (${execution.profit.toFixed(2)} profit)`;
      }
      report.push(line);
    });

    return report.join("\n");
  }

  /**
   * Create a compact summary for dashboards
   */
  getCompactSummary(
    currentPrice: number,
    entryPrice: number,
    totalAmount: number,
    strategy: TradingStrategyConfig,
    executedPhases: Set<number>,
    phaseHistory: PhaseExecutionHistory[]
  ): {
    priceChange: string;
    progress: string;
    pnl: string;
    efficiency: string;
    nextTarget: string;
  } {
    const priceIncrease = ((currentPrice - entryPrice) / entryPrice) * 100;
    const summary = this.analyzer.calculateSummary(
      currentPrice,
      entryPrice,
      totalAmount,
      phaseHistory,
      strategy,
      executedPhases
    );

    return {
      priceChange: `+${priceIncrease.toFixed(2)}%`,
      progress: `${summary.completedPhases}/${strategy.levels.length}`,
      pnl: `${(summary.realizedProfit + summary.unrealizedProfit).toFixed(2)}`,
      efficiency: `${summary.executionEfficiency.toFixed(1)}%`,
      nextTarget: summary.nextPhaseTarget ? `${summary.nextPhaseTarget.toFixed(6)}` : "Complete",
    };
  }

  /**
   * Generate ASCII chart for phase execution timeline
   */
  getExecutionTimeline(phaseHistory: PhaseExecutionHistory[]): string {
    if (phaseHistory.length === 0) {
      return "No executions recorded yet.";
    }

    const timeline = ["📅 EXECUTION TIMELINE", ""];

    phaseHistory
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .forEach((execution, index) => {
        const time = execution.timestamp.toLocaleTimeString();
        const date = execution.timestamp.toLocaleDateString();
        const connector = index === phaseHistory.length - 1 ? "└─" : "├─";

        timeline.push(`${connector} Phase ${execution.phase} @ ${time} (${date})`);
        timeline.push(
          `   Price: ${execution.price.toFixed(6)}, Amount: ${execution.amount.toFixed(2)}, Profit: ${execution.profit.toFixed(2)}`
        );

        if (index < phaseHistory.length - 1) {
          timeline.push("│");
        }
      });

    return timeline.join("\n");
  }
}
