/**
 * Multi-Phase Trading Bot
 *
 * Re-export module that provides the MultiPhaseTradingBot and AdvancedMultiPhaseTradingBot
 * for compatibility with existing imports and tests.
 */

// Re-export from the main services
export type {
  MultiPhaseTradingService,
  PhaseResult,
  TradingPhase,
  TradingStrategy,
} from "../multi-phase-trading-service";

export { PREDEFINED_STRATEGIES } from "../multi-phase-trading-service";

// Import the strategy builder for use in bot implementations
import type { StrategyPattern } from "../multi-phase-strategy-builder";
import type { TradingPhase, TradingStrategy } from "../multi-phase-trading-service";

/**
 * Multi-Phase Trading Bot Implementation
 */
export class MultiPhaseTradingBot {
  private strategies: Map<string, TradingStrategy> = new Map();
  private activeExecutions: Set<string> = new Set();

  constructor(private config: { maxConcurrentStrategies?: number } = {}) {
    this.config.maxConcurrentStrategies = config.maxConcurrentStrategies || 5;
  }

  /**
   * Execute a multi-phase trading strategy
   */
  async executeStrategy(strategy: StrategyPattern): Promise<string> {
    const strategyId = `strategy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (this.activeExecutions.size >= this.config.maxConcurrentStrategies!) {
      throw new Error("Maximum concurrent strategies reached");
    }

    const tradingStrategy: TradingStrategy = {
      ...strategy,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      phases: [],
    };

    this.strategies.set(strategyId, tradingStrategy);
    this.activeExecutions.add(strategyId);

    // Simulate strategy execution
    try {
      await this.runStrategy(strategyId, tradingStrategy);
      return strategyId;
    } catch (error) {
      this.activeExecutions.delete(strategyId);
      throw error;
    }
  }

  /**
   * Pause a running strategy
   */
  async pauseStrategy(strategyId: string): Promise<void> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    strategy.status = "paused";
    strategy.updatedAt = new Date();
  }

  /**
   * Resume a paused strategy
   */
  async resumeStrategy(strategyId: string): Promise<void> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    strategy.status = "active";
    strategy.updatedAt = new Date();
  }

  /**
   * Stop a strategy
   */
  async stopStrategy(strategyId: string): Promise<void> {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`);
    }

    strategy.status = "completed";
    strategy.updatedAt = new Date();
    this.activeExecutions.delete(strategyId);
  }

  /**
   * Get strategy status
   */
  async getStrategyStatus(strategyId: string): Promise<TradingStrategy | null> {
    return this.strategies.get(strategyId) || null;
  }

  /**
   * List all active strategies
   */
  async listActiveStrategies(): Promise<TradingStrategy[]> {
    return Array.from(this.strategies.values()).filter((s) => s.status === "active");
  }

  /**
   * Get all strategies
   */
  getAllStrategies(): TradingStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Clear all strategies (for testing)
   */
  clearStrategies(): void {
    this.strategies.clear();
    this.activeExecutions.clear();
  }

  /**
   * Private method to run a strategy
   */
  private async runStrategy(strategyId: string, strategy: TradingStrategy): Promise<void> {
    // Simulate strategy execution with phases
    const phaseCount = Math.floor(Math.random() * 3) + 1; // 1-3 phases

    for (let i = 0; i < phaseCount; i++) {
      const phase: TradingPhase = {
        id: `phase_${i + 1}`,
        name: `Phase ${i + 1}`,
        status: "active",
        startTime: new Date(),
      };

      strategy.phases.push(phase);

      // Simulate phase execution time
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate phase completion
      const success = Math.random() > 0.1; // 90% success rate
      phase.status = success ? "completed" : "failed";
      phase.endTime = new Date();
      phase.result = {
        success,
        profit: success ? Math.random() * 100 : -Math.random() * 50,
        volume: Math.random() * 1000,
        orders: [],
        message: success ? "Phase completed successfully" : "Phase failed due to market conditions",
      };

      if (!success) {
        strategy.status = "failed";
        this.activeExecutions.delete(strategyId);
        return;
      }
    }

    strategy.status = "completed";
    strategy.updatedAt = new Date();
    this.activeExecutions.delete(strategyId);
  }
}

/**
 * Advanced Multi-Phase Trading Bot with additional features
 */
export class AdvancedMultiPhaseTradingBot extends MultiPhaseTradingBot {
  private riskLimits: {
    maxDailyLoss: number;
    maxPositionSize: number;
    maxOpenPositions: number;
  };

  constructor(
    config: {
      maxConcurrentStrategies?: number;
      riskLimits?: {
        maxDailyLoss?: number;
        maxPositionSize?: number;
        maxOpenPositions?: number;
      };
    } = {}
  ) {
    super(config);

    this.riskLimits = {
      maxDailyLoss: config.riskLimits?.maxDailyLoss || 1000,
      maxPositionSize: config.riskLimits?.maxPositionSize || 500,
      maxOpenPositions: config.riskLimits?.maxOpenPositions || 10,
    };
  }

  /**
   * Execute strategy with advanced risk management
   */
  async executeStrategy(strategy: StrategyPattern): Promise<string> {
    // Perform risk checks before execution
    await this.performRiskChecks(strategy);

    return super.executeStrategy(strategy);
  }

  /**
   * Perform risk management checks
   */
  private async performRiskChecks(strategy: StrategyPattern): Promise<void> {
    const activeStrategies = await this.listActiveStrategies();

    // Check max open positions
    if (activeStrategies.length >= this.riskLimits.maxOpenPositions) {
      throw new Error("Maximum open positions limit reached");
    }

    // Check position size limits
    if (
      strategy.riskManagement?.positionSize &&
      strategy.riskManagement.positionSize > this.riskLimits.maxPositionSize
    ) {
      throw new Error("Position size exceeds risk limits");
    }

    // Additional risk checks can be added here
  }

  /**
   * Update risk limits
   */
  updateRiskLimits(limits: Partial<typeof this.riskLimits>): void {
    this.riskLimits = { ...this.riskLimits, ...limits };
  }

  /**
   * Get current risk limits
   */
  getRiskLimits() {
    return { ...this.riskLimits };
  }
}
