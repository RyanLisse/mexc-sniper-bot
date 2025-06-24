import {
  type MaintenanceResult,
  MultiPhasePerformanceAnalytics,
  type PerformanceSummary,
  type PersistenceOperations,
  type RiskMetrics,
} from "./multi-phase-performance-analytics";
import {
  MultiPhasePositionManager,
  type OptimalEntryCalculation,
  type PartialFillResult,
  type PositionInfo,
  type PositionInitResult,
} from "./multi-phase-position-manager";
import { MultiPhaseTradingBotCore } from "./multi-phase-trading-bot-core";
import type { TradingStrategy } from "./trading-strategy-manager";

/**
 * MULTI-PHASE TRADING BOT
 *
 * Enhanced trading bot with modular architecture for scalability and maintainability
 */
export class MultiPhaseTradingBot extends MultiPhaseTradingBotCore {
  private logger = {
      info: (message: string, context?: any) => console.info('[multi-phase-trading-bot]', message, context || ''),
      warn: (message: string, context?: any) => console.warn('[multi-phase-trading-bot]', message, context || ''),
      error: (message: string, context?: any, error?: Error) => console.error('[multi-phase-trading-bot]', message, context || '', error || ''),
      debug: (message: string, context?: any) => console.debug('[multi-phase-trading-bot]', message, context || ''),
    };
  private positionManager: MultiPhasePositionManager;
  private performanceAnalytics: MultiPhasePerformanceAnalytics;

  constructor(strategy: TradingStrategy, entryPrice: number, position: number) {
    super(strategy, entryPrice, position);

    this.positionManager = new MultiPhasePositionManager(
      entryPrice,
      position,
      this.symbol,
      this.executor
    );

    this.performanceAnalytics = new MultiPhasePerformanceAnalytics(
      entryPrice,
      position,
      this.executor
    );
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(currentPrice: number): PerformanceSummary {
    return this.performanceAnalytics.getPerformanceSummary(currentPrice);
  }

  /**
   * Get risk metrics
   */
  getRiskMetrics(currentPrice: number): RiskMetrics {
    return this.performanceAnalytics.getRiskMetrics(currentPrice);
  }

  /**
   * Calculate optimal entry point
   */
  calculateOptimalEntry(
    symbol: string,
    conditions?: {
      volatility?: number;
      volume?: number;
      momentum?: number;
      support?: number;
      resistance?: number;
    }
  ): OptimalEntryCalculation {
    return this.positionManager.calculateOptimalEntry(symbol, conditions);
  }

  /**
   * Initialize a new trading position
   */
  initializePosition(symbol: string, entryPrice: number, amount: number): PositionInitResult {
    const result = this.positionManager.initializePosition(symbol, entryPrice, amount);

    if (result.success) {
      // Update internal state
      this.symbol = symbol;
      this.entryPrice = entryPrice;
      this.position = amount;

      // Update position manager
      this.positionManager.updatePosition(amount, symbol);

      // Recreate executor with new parameters
      const strategyConfig = {
        id: this.executor.getStrategy().id,
        name: this.executor.getStrategy().name,
        description: this.executor.getStrategy().description || "",
        levels: this.executor.getStrategy().levels,
      };
      this.executor = new (require("./multi-phase-executor").MultiPhaseExecutor)(
        strategyConfig,
        entryPrice,
        amount
      );
    }

    return result;
  }

  /**
   * Handle partial fill of trade execution
   */
  handlePartialFill(
    action: string,
    executedAmount: number,
    totalAmount: number
  ): PartialFillResult {
    return this.positionManager.handlePartialFill(action, executedAmount, totalAmount);
  }

  /**
   * Get current position information
   */
  getPositionInfo(): PositionInfo {
    return this.positionManager.getPositionInfo();
  }

  /**
   * Perform maintenance cleanup operations
   */
  performMaintenanceCleanup(): MaintenanceResult {
    return this.performanceAnalytics.performMaintenanceCleanup();
  }

  /**
   * Persist trade data to database
   */
  async persistTradeData(data: any): Promise<void> {
    return this.performanceAnalytics.persistTradeData(data);
  }

  /**
   * Get pending persistence operations
   */
  getPendingPersistenceOperations(): PersistenceOperations {
    return this.performanceAnalytics.getPendingPersistenceOperations();
  }

  /**
   * Simulate price movements for testing
   */
  simulatePriceMovements(priceMovements: Array<{ price: number; description: string }>): Array<{
    price: number;
    description: string;
    actions: string[];
    status: any;
    performance: PerformanceSummary;
  }> {
    const results: Array<{
      price: number;
      description: string;
      actions: string[];
      status: any;
      performance: PerformanceSummary;
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

  /**
   * Update position size (override parent to sync with position manager)
   */
  updatePosition(newPosition: number): void {
    super.updatePosition(newPosition);
    this.positionManager.updatePosition(newPosition);
  }

  /**
   * Get execution efficiency metrics
   */
  getExecutionEfficiency(): {
    averageSlippage: number;
    averageLatency: number;
    successRate: number;
    costEfficiency: number;
  } {
    return this.performanceAnalytics.getExecutionEfficiency();
  }

  /**
   * Enhanced price update with performance tracking
   */
  onPriceUpdate(currentPrice: number): {
    actions: string[];
    status: any;
  } {
    const result = super.onPriceUpdate(currentPrice);

    // Update performance metrics
    this.performanceAnalytics.updateMetrics(currentPrice);

    return result;
  }
}

// Export function to demonstrate multi-phase strategy
export function demonstrateMultiPhaseStrategy(): void {
  console.info("=== Multi-Phase Trading Strategy Demo ===\n");

  // Import required strategies
  const { TRADING_STRATEGIES } = require("./trading-strategy-manager");

  // Create bot with conservative strategy
  const bot = new MultiPhaseTradingBot(
    TRADING_STRATEGIES.conservative,
    100, // Entry at $100
    1000 // 1000 tokens
  );

  // Simulate price movements
  const priceMovements = [
    { price: 105, description: "Small pump +5%" },
    { price: 112, description: "Momentum building +12%" },
    { price: 122, description: "Breaking out +22%" },
    { price: 135, description: "Strong rally +35%" },
    { price: 128, description: "Small pullback +28%" },
  ];

  priceMovements.forEach(({ price, description }) => {
    console.info(`\n📊 Price Update: ${price} - ${description}`);
    const result = bot.onPriceUpdate(price);

    // Show actions
    if (result.actions.length > 0) {
      console.info("\n🚨 ACTIONS:");
      result.actions.forEach((action) => console.info(action));
    }

    // Show status
    console.info("\n📈 Portfolio Status:");
    console.info(`- Price increase: ${result.status.priceIncrease}`);
    console.info(`- Completed phases: ${result.status.summary.completedPhases}`);
    console.info(`- Remaining position: ${result.status.summary.totalRemaining} tokens`);
    console.info(`- Realized profit: ${result.status.summary.realizedProfit.toFixed(2)}`);
    console.info(`- Unrealized profit: ${result.status.summary.unrealizedProfit.toFixed(2)}`);
    console.info(`- Next target: ${result.status.nextTarget}`);

    console.info("\n📋 Phase Overview:");
    console.info(result.status.visualization);
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

  /**
   * Switch strategy dynamically
   */
  switchStrategy(strategyId: string): boolean {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) return false;

    const strategyConfig = {
      id: strategy.id,
      name: strategy.name,
      description: strategy.description || "",
      levels: strategy.levels,
    };

    const MultiPhaseExecutor = require("./multi-phase-executor").MultiPhaseExecutor;
    this.executor = new MultiPhaseExecutor(strategyConfig, this.entryPrice, this.position);
    this.currentStrategyId = strategyId;

    return true;
  }

  /**
   * Get current strategy info
   */
  getCurrentStrategy(): { id: string; strategy: TradingStrategy } {
    return {
      id: this.currentStrategyId,
      strategy: this.strategies.get(this.currentStrategyId)!,
    };
  }

  /**
   * List available strategies
   */
  listStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }
}
