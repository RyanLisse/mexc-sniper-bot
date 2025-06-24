import type { TradingStrategy } from "../db/schemas/strategies";
interface PerformanceMetrics {
  memoryUsage: number;
  executionTime: number;
  cacheHitRate: number;
  operationsPerSecond: number;
}

interface OptimizationConfig {
  maxConcurrentExecutions: number;
  memoryThresholdMB: number;
  batchSize: number;
  cacheTimeout: number;
}

export class StrategyPerformanceOptimizer {
  private logger = {
      info: (message: string, context?: any) => console.info('[strategy-performance-optimizer]', message, context || ''),
      warn: (message: string, context?: any) => console.warn('[strategy-performance-optimizer]', message, context || ''),
      error: (message: string, context?: any, error?: Error) => console.error('[strategy-performance-optimizer]', message, context || '', error || ''),
      debug: (message: string, context?: any) => console.debug('[strategy-performance-optimizer]', message, context || ''),
    };

  private static instance: StrategyPerformanceOptimizer;
  private activeExecutions = new Set<string>();
  private executionCache = new Map<string, any>();
  private lastGC = Date.now();

  private config: OptimizationConfig = {
    maxConcurrentExecutions: 50,
    memoryThresholdMB: 100, // 100MB limit
    batchSize: 25,
    cacheTimeout: 5000, // 5 seconds
  };

  static getInstance(): StrategyPerformanceOptimizer {
    if (!StrategyPerformanceOptimizer.instance) {
      StrategyPerformanceOptimizer.instance = new StrategyPerformanceOptimizer();
    }
    return StrategyPerformanceOptimizer.instance;
  }

  constructor() {
    // Set up periodic garbage collection
    setInterval(() => this.performGarbageCollection(), 30000); // Every 30 seconds
  }

  /**
   * Optimize strategy execution with memory management
   */
  async optimizeStrategyExecution<T>(
    executionId: string,
    operation: () => Promise<T>,
    cleanup?: () => void
  ): Promise<T> {
    // Check memory threshold before execution
    await this.checkMemoryThreshold();

    // Check concurrent execution limit
    if (this.activeExecutions.size >= this.config.maxConcurrentExecutions) {
      throw new Error(
        `Concurrent execution limit reached (${this.config.maxConcurrentExecutions})`
      );
    }

    // Check cache first
    const cacheKey = `exec_${executionId}`;
    const cached = this.executionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout) {
      return cached.result;
    }

    this.activeExecutions.add(executionId);

    try {
      const startTime = Date.now();
      const result = await operation();
      const executionTime = Date.now() - startTime;

      // Cache result for short term
      this.executionCache.set(cacheKey, {
        result,
        timestamp: Date.now(),
        executionTime,
      });

      return result;
    } finally {
      this.activeExecutions.delete(executionId);
      if (cleanup) {
        cleanup();
      }
    }
  }

  /**
   * Batch process multiple strategy operations to reduce memory usage
   */
  async batchProcessStrategies<T>(
    strategies: any[],
    processor: (batch: any[]) => Promise<T[]>
  ): Promise<T[]> {
    const results: T[] = [];

    for (let i = 0; i < strategies.length; i += this.config.batchSize) {
      const batch = strategies.slice(i, i + this.config.batchSize);

      // Process batch with memory monitoring
      const batchResults = await this.optimizeStrategyExecution(
        `batch_${i}_${Date.now()}`,
        () => processor(batch),
        () => {
          // Force garbage collection after each batch
          if (global.gc) {
            global.gc();
          }
        }
      );

      results.push(...batchResults);

      // Check memory between batches
      await this.checkMemoryThreshold();

      // Small delay to prevent overwhelming the system
      if (i + this.config.batchSize < strategies.length) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    return results;
  }

  /**
   * Optimize strategy calculation with memory-efficient processing
   */
  async optimizeStrategyCalculations(
    strategies: TradingStrategy[],
    currentPrices: Record<string, number>
  ): Promise<any[]> {
    return this.batchProcessStrategies(strategies, async (batch) => {
      return batch
        .map((strategy) => {
          const currentPrice = currentPrices[strategy.symbol];
          if (!currentPrice) return null;

          // Use memory-efficient calculation
          return this.calculateStrategyMetricsOptimized(strategy, currentPrice);
        })
        .filter(Boolean);
    });
  }

  /**
   * Memory-optimized strategy metrics calculation
   */
  private calculateStrategyMetricsOptimized(strategy: TradingStrategy, currentPrice: number): any {
    try {
      const levels = JSON.parse(strategy.levels);
      const entryPrice = strategy.entryPrice;
      const priceIncrease = ((currentPrice - entryPrice) / entryPrice) * 100;

      // Calculate only essential metrics to save memory
      const triggeredPhases = levels.filter((level: any) => priceIncrease >= level.percentage);
      const nextPhase = levels.find((level: any) => priceIncrease < level.percentage);

      return {
        strategyId: strategy.id,
        symbol: strategy.symbol,
        currentPrice,
        priceIncrease: Math.round(priceIncrease * 100) / 100, // Round to save memory
        triggeredPhases: triggeredPhases.length,
        totalPhases: levels.length,
        nextTarget: nextPhase ? entryPrice * nextPhase.multiplier : null,
        estimatedProfit: this.calculateEstimatedProfitOptimized(strategy, currentPrice, levels),
      };
    } catch (error) {
      console.error(`Error calculating metrics for strategy ${strategy.id}:`, error);
      return null;
    }
  }

  /**
   * Memory-optimized profit calculation
   */
  private calculateEstimatedProfitOptimized(
    strategy: TradingStrategy,
    currentPrice: number,
    levels: any[]
  ): number {
    const entryPrice = strategy.entryPrice;
    const totalAmount = strategy.positionSize;
    const priceIncrease = ((currentPrice - entryPrice) / entryPrice) * 100;

    let estimatedProfit = 0;

    for (const level of levels) {
      if (priceIncrease >= level.percentage) {
        const amount = (totalAmount * level.sellPercentage) / 100;
        const profit = amount * (currentPrice - entryPrice);
        estimatedProfit += profit;
      }
    }

    return Math.round(estimatedProfit * 100) / 100; // Round to save memory
  }

  /**
   * Check memory usage and trigger cleanup if needed
   */
  private async checkMemoryThreshold(): Promise<void> {
    if (process.memoryUsage) {
      const memoryUsage = process.memoryUsage();
      const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;

      if (heapUsedMB > this.config.memoryThresholdMB) {
        console.warn(
          `[Performance] Memory usage high: ${heapUsedMB.toFixed(2)}MB, triggering cleanup`
        );
        await this.performGarbageCollection();

        // If still high, reduce concurrent executions temporarily
        if (heapUsedMB > this.config.memoryThresholdMB * 1.2) {
          this.config.maxConcurrentExecutions = Math.max(
            10,
            this.config.maxConcurrentExecutions - 5
          );
          console.warn(
            `[Performance] Reduced concurrent executions to ${this.config.maxConcurrentExecutions}`
          );
        }
      }
    }
  }

  /**
   * Perform garbage collection and cache cleanup
   */
  private async performGarbageCollection(): Promise<void> {
    const now = Date.now();

    // Skip if GC was recent
    if (now - this.lastGC < 10000) {
      // 10 seconds
      return;
    }

    this.lastGC = now;

    // Clear expired cache entries
    for (const [key, value] of this.executionCache.entries()) {
      if (now - value.timestamp > this.config.cacheTimeout) {
        this.executionCache.delete(key);
      }
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Reset concurrent execution limit if memory is better
    if (process.memoryUsage) {
      const heapUsedMB = process.memoryUsage().heapUsed / 1024 / 1024;
      if (heapUsedMB < this.config.memoryThresholdMB * 0.7) {
        this.config.maxConcurrentExecutions = Math.min(50, this.config.maxConcurrentExecutions + 5);
      }
    }
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const memoryUsage = process.memoryUsage ? process.memoryUsage().heapUsed / 1024 / 1024 : 0;
    const cacheHitRate =
      this.executionCache.size > 0
        ? (this.executionCache.size / (this.executionCache.size + this.activeExecutions.size)) * 100
        : 0;

    return {
      memoryUsage,
      executionTime: 0, // This would be calculated from recent operations
      cacheHitRate,
      operationsPerSecond: this.activeExecutions.size,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Clear all caches and reset state
   */
  reset(): void {
    this.executionCache.clear();
    this.activeExecutions.clear();
    this.config = {
      maxConcurrentExecutions: 50,
      memoryThresholdMB: 100,
      batchSize: 25,
      cacheTimeout: 5000,
    };
  }
}

// Export singleton instance
export const strategyPerformanceOptimizer = StrategyPerformanceOptimizer.getInstance();
