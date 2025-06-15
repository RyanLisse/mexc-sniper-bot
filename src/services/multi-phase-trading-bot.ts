import { MultiPhaseExecutor } from "./multi-phase-executor";
import type { TradingStrategy } from "./trading-strategy-manager";

/**
 * MULTI-PHASE TRADING BOT
 *
 * Real-time Multi-Phase Example for processing price updates and executing phases,
 * exactly matching the specification from docs/tl-systems.md
 */

// Real-time Multi-Phase Example - EXACT implementation from docs
export class MultiPhaseTradingBot {
  private executor: MultiPhaseExecutor;
  private entryPrice: number;
  private position: number;

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

  // Process price update and execute phases - EXACT implementation from docs
  onPriceUpdate(currentPrice: number): {
    actions: string[];
    status: any;
  } {
    const actions: string[] = [];
    const execution = this.executor.executePhases(currentPrice);

    // Execute pending phases
    execution.phasesToExecute.forEach((phase) => {
      actions.push(
        `🎯 EXECUTE Phase ${phase.phase}: Sell ${phase.amount} units ` +
          `@ ${phase.level.multiplier}x for ${phase.expectedProfit.toFixed(2)} profit`
      );

      // Record execution
      this.executor.recordPhaseExecution(phase.phase, currentPrice, phase.amount, {
        fees: phase.expectedProfit * 0.001, // Estimate 0.1% fees
      });
    });

    // Get current status
    const priceIncreasePercent = ((currentPrice - this.entryPrice) / this.entryPrice) * 100;
    const phaseStatus = this.executor.getPhaseStatus();
    const visualization = this.executor.getPhaseVisualization(currentPrice);

    return {
      actions,
      status: {
        currentPrice,
        priceIncrease: `${priceIncreasePercent.toFixed(2)}%`,
        summary: execution.summary,
        phaseStatus,
        visualization,
        nextTarget: execution.summary.nextPhaseTarget
          ? `${execution.summary.nextPhaseTarget.toFixed(2)}`
          : "All phases completed",
      },
    };
  }

  // Additional methods for enhanced functionality

  // Get current bot status
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

  // Update position size (for partial fills or external trades)
  updatePosition(newPosition: number): void {
    this.position = newPosition;
  }

  // Get performance summary
  getPerformanceSummary(currentPrice: number): {
    totalPnL: number;
    totalPnLPercent: number;
    realizedPnL: number;
    unrealizedPnL: number;
    bestPhase: { phase: number; profit: number } | null;
    worstPhase: { phase: number; profit: number } | null;
    efficiency: number;
  } {
    const analytics = this.executor.getExecutionAnalytics();
    const summary = this.executor.calculateSummary
      ? this.executor.calculateSummary(currentPrice)
      : { realizedProfit: 0, unrealizedProfit: 0, totalRemaining: this.position };

    const totalPnL = summary.realizedProfit + summary.unrealizedProfit;
    const totalPnLPercent = (totalPnL / (this.entryPrice * this.position)) * 100;

    return {
      totalPnL,
      totalPnLPercent,
      realizedPnL: summary.realizedProfit,
      unrealizedPnL: summary.unrealizedProfit,
      bestPhase: analytics.bestExecution
        ? {
            phase: analytics.bestExecution.phase,
            profit: analytics.bestExecution.profit,
          }
        : null,
      worstPhase: analytics.worstExecution
        ? {
            phase: analytics.worstExecution.phase,
            profit: analytics.worstExecution.profit,
          }
        : null,
      efficiency: analytics.executionEfficiency || 0,
    };
  }

  // Simulate price movements for testing
  simulatePriceMovements(priceMovements: Array<{ price: number; description: string }>): Array<{
    price: number;
    description: string;
    actions: string[];
    status: any;
    performance: any;
  }> {
    const results: Array<{
      price: number;
      description: string;
      actions: string[];
      status: any;
      performance: any;
    }> = [];

    priceMovements.forEach(({ price, description }) => {
      const result = this.onPriceUpdate(price);
      const performance = this.getPerformanceSummary(price);

      results.push({
        price,
        description,
        actions: result.actions,
        status: result.status,
        performance,
      });
    });

    return results;
  }

  // Reset bot to initial state
  reset(): void {
    this.executor.reset();
  }

  // Export bot state for persistence
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

  // Import bot state from persistence
  importState(state: {
    entryPrice: number;
    position: number;
    executorState: any;
  }): void {
    this.entryPrice = state.entryPrice;
    this.position = state.position;
    this.executor.importState(state.executorState);
  }

  // Get risk metrics
  getRiskMetrics(currentPrice: number): {
    currentDrawdown: number;
    maxDrawdown: number;
    riskRewardRatio: number;
    positionRisk: number;
    stopLossLevel: number;
  } {
    const priceChange = ((currentPrice - this.entryPrice) / this.entryPrice) * 100;
    const currentValue = this.position * currentPrice;
    const initialValue = this.position * this.entryPrice;
    const currentDrawdown = priceChange < 0 ? Math.abs(priceChange) : 0;

    // Calculate max potential reward vs risk
    const maxReward = this.executor
      .getPhaseStatus()
      .phaseDetails.reduce((max, phase) => Math.max(max, phase.percentage), 0);
    const stopLossPercent = 10; // Default 10% stop loss
    const riskRewardRatio = maxReward / stopLossPercent;

    return {
      currentDrawdown,
      maxDrawdown: currentDrawdown, // Would track historically in real implementation
      riskRewardRatio,
      positionRisk: (Math.abs(currentValue - initialValue) / initialValue) * 100,
      stopLossLevel: this.entryPrice * 0.9, // 10% stop loss
    };
  }
}

// Example: Real-world multi-phase execution - EXACT implementation from docs
export function demonstrateMultiPhaseStrategy(): void {
  console.log("=== Multi-Phase Trading Strategy Demo ===\n");

  // Import required strategies
  const { TRADING_STRATEGIES } = require("./trading-strategy-manager");

  // Create bot with conservative strategy
  const bot = new MultiPhaseTradingBot(
    TRADING_STRATEGIES.conservative,
    100, // Entry at $100
    1000 // 1000 tokens
  );

  // Simulate price movements - EXACT from docs
  const priceMovements = [
    { price: 105, description: "Small pump +5%" },
    { price: 112, description: "Momentum building +12%" },
    { price: 122, description: "Breaking out +22%" },
    { price: 135, description: "Strong rally +35%" },
    { price: 128, description: "Small pullback +28%" },
  ];

  priceMovements.forEach(({ price, description }) => {
    console.log(`\n📊 Price Update: ${price} - ${description}`);
    const result = bot.onPriceUpdate(price);

    // Show actions
    if (result.actions.length > 0) {
      console.log("\n🚨 ACTIONS:");
      result.actions.forEach((action) => console.log(action));
    }

    // Show status
    console.log("\n📈 Portfolio Status:");
    console.log(`- Price increase: ${result.status.priceIncrease}`);
    console.log(`- Completed phases: ${result.status.summary.completedPhases}`);
    console.log(`- Remaining position: ${result.status.summary.totalRemaining} tokens`);
    console.log(`- Realized profit: ${result.status.summary.realizedProfit.toFixed(2)}`);
    console.log(`- Unrealized profit: ${result.status.summary.unrealizedProfit.toFixed(2)}`);
    console.log(`- Next target: ${result.status.nextTarget}`);

    console.log("\n📋 Phase Overview:");
    console.log(result.status.visualization);
  });
}

// Advanced bot with multiple strategy support
export class AdvancedMultiPhaseTradingBot extends MultiPhaseTradingBot {
  private strategies: Map<string, TradingStrategy>;
  private currentStrategyId: string;

  constructor(
    strategies: Record<string, TradingStrategy>,
    initialStrategyId: string,
    entryPrice: number,
    position: number
  ) {
    super(strategies[initialStrategyId], entryPrice, position);
    this.strategies = new Map(Object.entries(strategies));
    this.currentStrategyId = initialStrategyId;
  }

  // Switch strategy dynamically
  switchStrategy(strategyId: string): boolean {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return false;

    // Export current state
    const currentState = this.exportState();

    // Create new bot with new strategy
    const strategyConfig = {
      id: strategy.id,
      name: strategy.name,
      description: strategy.description || "",
      levels: strategy.levels,
    };

    this.executor = new MultiPhaseExecutor(strategyConfig, this.entryPrice, this.position);
    this.currentStrategyId = strategyId;

    return true;
  }

  // Get current strategy info
  getCurrentStrategy(): { id: string; strategy: TradingStrategy } {
    return {
      id: this.currentStrategyId,
      strategy: this.strategies.get(this.currentStrategyId)!,
    };
  }

  // List available strategies
  listStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }
}
