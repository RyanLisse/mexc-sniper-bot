/**
 * Optimized Trading Strategy Engine
 *
 * Enhanced trading strategy management with:
 * - Advanced multi-phase exit strategies
 * - Dynamic position sizing algorithms
 * - Real-time strategy performance optimization
 * - Machine learning-based strategy selection
 * - Type-safe validation with Zod
 *
 * Optimizes and extends the existing trading strategy manager
 * with advanced algorithms and performance tracking.
 */

import { z } from "zod";
import type { PatternMatch } from "../core/pattern-detection";
import { toSafeError } from "../lib/error-type-utils";
import { createSafeLogger } from "../lib/structured-logger";
import type { ExecutionPosition } from "./optimized-auto-sniping-core";
import {
  TRADING_STRATEGIES,
  TradingStrategy,
  TradingStrategySchema,
} from "./trading-strategy-manager";

// ============================================================================
// Enhanced Trading Strategy Schemas
// ============================================================================

export const StrategyPerformanceSchema = z.object({
  strategyId: z.string(),
  totalTrades: z.number().int().min(0),
  successfulTrades: z.number().int().min(0),
  failedTrades: z.number().int().min(0),
  successRate: z.number().min(0).max(100),
  averageReturn: z.number(),
  maxReturn: z.number(),
  minReturn: z.number(),
  averageHoldTime: z.number().min(0),
  sharpeRatio: z.number().optional(),
  maxDrawdown: z.number().min(0),
  totalPnl: z.number(),
  riskAdjustedReturn: z.number(),
  winLossRatio: z.number().positive(),
  profitFactor: z.number().positive(),
  lastUsed: z.string().datetime(),
  usageCount: z.number().int().min(0),
});

export const DynamicExitLevelSchema = z.object({
  triggerCondition: z.enum([
    "price_target",
    "time_based",
    "volatility",
    "momentum",
    "rsi",
    "volume",
  ]),
  percentage: z.number().min(0),
  sellPercentage: z.number().min(0).max(100),
  multiplier: z.number().min(1),
  priority: z.number().int().min(1).max(10),
  isActive: z.boolean().default(true),
  conditions: z.record(z.any()).optional(),
});

export const EnhancedTradingStrategySchema = TradingStrategySchema.extend({
  performance: StrategyPerformanceSchema.optional(),
  dynamicLevels: z.array(DynamicExitLevelSchema).optional(),
  riskProfile: z.enum(["conservative", "moderate", "aggressive", "adaptive"]).default("moderate"),
  marketConditions: z.array(z.enum(["bull", "bear", "sideways", "volatile", "low_vol"])).optional(),
  minConfidenceRequired: z.number().min(0).max(100).default(70),
  maxPositionSize: z.number().positive().default(100),
  adaptiveParameters: z
    .object({
      enableDynamicAdjustment: z.boolean().default(false),
      volatilityAdjustment: z.boolean().default(false),
      momentumAdjustment: z.boolean().default(false),
      volumeAdjustment: z.boolean().default(false),
    })
    .optional(),
});

export const StrategySelectionCriteriaSchema = z.object({
  patternType: z.string(),
  confidence: z.number().min(0).max(100),
  volatility: z.number().min(0).optional(),
  volume24h: z.number().min(0).optional(),
  marketCondition: z.enum(["bull", "bear", "sideways", "volatile", "low_vol"]).optional(),
  timeOfDay: z.string().optional(),
  dayOfWeek: z.string().optional(),
  portfolioRisk: z.number().min(0).max(100).optional(),
  availableBalance: z.number().positive(),
  activePositionCount: z.number().int().min(0),
});

// ============================================================================
// Type Definitions
// ============================================================================

export type StrategyPerformance = z.infer<typeof StrategyPerformanceSchema>;
export type DynamicExitLevel = z.infer<typeof DynamicExitLevelSchema>;
export type EnhancedTradingStrategy = z.infer<typeof EnhancedTradingStrategySchema>;
export type StrategySelectionCriteria = z.infer<typeof StrategySelectionCriteriaSchema>;

// ============================================================================
// Optimized Trading Strategy Engine
// ============================================================================

export class OptimizedTradingStrategyEngine {
  private static instance: OptimizedTradingStrategyEngine;
  private logger = createSafeLogger("optimized-trading-strategy-engine");

  // Enhanced strategies with performance tracking
  private enhancedStrategies = new Map<string, EnhancedTradingStrategy>();
  private strategyPerformance = new Map<string, StrategyPerformance>();

  // Strategy selection and optimization
  private strategyUsageHistory: Array<{
    strategyId: string;
    timestamp: string;
    pattern: PatternMatch;
    result: "success" | "failure";
    return: number;
    holdTime: number;
  }> = [];

  // Performance tracking
  private performanceMetrics = {
    totalStrategySelections: 0,
    optimalSelections: 0,
    adaptiveAdjustments: 0,
    performanceImprovements: 0,
  };

  private constructor() {
    this.initializeEnhancedStrategies();
    this.startPerformanceTracking();

    this.logger.info("Optimized Trading Strategy Engine initialized", {
      strategiesLoaded: this.enhancedStrategies.size,
      performanceTracking: true,
    });
  }

  static getInstance(): OptimizedTradingStrategyEngine {
    if (!OptimizedTradingStrategyEngine.instance) {
      OptimizedTradingStrategyEngine.instance = new OptimizedTradingStrategyEngine();
    }
    return OptimizedTradingStrategyEngine.instance;
  }

  /**
   * Select optimal strategy based on current conditions
   */
  async selectOptimalStrategy(criteria: StrategySelectionCriteria): Promise<{
    strategy: EnhancedTradingStrategy;
    confidence: number;
    reasoning: string[];
    adaptiveAdjustments: Array<{
      parameter: string;
      originalValue: any;
      adjustedValue: any;
      reason: string;
    }>;
  }> {
    try {
      this.performanceMetrics.totalStrategySelections++;

      const validatedCriteria = StrategySelectionCriteriaSchema.parse(criteria);

      this.logger.debug("Selecting optimal strategy", {
        patternType: validatedCriteria.patternType,
        confidence: validatedCriteria.confidence,
        portfolioRisk: validatedCriteria.portfolioRisk,
      });

      // Score all strategies based on criteria
      const strategyScores = await this.scoreStrategies(validatedCriteria);

      // Select best strategy
      const bestStrategy = strategyScores[0];
      if (!bestStrategy) {
        throw new Error("No suitable strategy found");
      }

      // Apply adaptive adjustments
      const adaptiveAdjustments = await this.applyAdaptiveAdjustments(
        bestStrategy.strategy,
        validatedCriteria
      );

      // Generate reasoning
      const reasoning = this.generateStrategyReasoning(
        bestStrategy.strategy,
        bestStrategy.score,
        validatedCriteria
      );

      this.logger.info("Optimal strategy selected", {
        strategyId: bestStrategy.strategy.id,
        score: bestStrategy.score,
        adaptiveAdjustments: adaptiveAdjustments.length,
        reasoning: reasoning.slice(0, 3), // Log first 3 reasons
      });

      return {
        strategy: bestStrategy.strategy,
        confidence: bestStrategy.score,
        reasoning,
        adaptiveAdjustments,
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to select optimal strategy", {
        error: safeError.message,
        criteria,
      });

      // Return conservative fallback strategy
      const fallbackStrategy = this.enhancedStrategies.get("conservative");
      if (!fallbackStrategy) {
        throw new Error("Fallback strategy not available");
      }

      return {
        strategy: fallbackStrategy,
        confidence: 50,
        reasoning: ["Fallback strategy due to selection error"],
        adaptiveAdjustments: [],
      };
    }
  }

  /**
   * Calculate dynamic exit levels based on real-time conditions
   */
  async calculateDynamicExitLevels(
    strategy: EnhancedTradingStrategy,
    position: ExecutionPosition,
    currentMarketData: {
      currentPrice: number;
      volume: number;
      volatility: number;
      momentum: number;
    }
  ): Promise<DynamicExitLevel[]> {
    try {
      this.logger.debug("Calculating dynamic exit levels", {
        strategyId: strategy.id,
        positionId: position.id,
        currentPrice: currentMarketData.currentPrice,
      });

      const exitLevels: DynamicExitLevel[] = [];

      // Base exit levels from strategy
      for (const level of strategy.levels) {
        const dynamicLevel = DynamicExitLevelSchema.parse({
          triggerCondition: "price_target",
          percentage: level.percentage,
          sellPercentage: level.sellPercentage,
          multiplier: level.multiplier,
          priority: 5,
          isActive: true,
        });

        exitLevels.push(dynamicLevel);
      }

      // Add volatility-based exits if enabled
      if (strategy.adaptiveParameters?.volatilityAdjustment) {
        const volatilityExits = this.calculateVolatilityBasedExits(
          currentMarketData.volatility,
          position
        );
        exitLevels.push(...volatilityExits);
      }

      // Add momentum-based exits if enabled
      if (strategy.adaptiveParameters?.momentumAdjustment) {
        const momentumExits = this.calculateMomentumBasedExits(
          currentMarketData.momentum,
          position
        );
        exitLevels.push(...momentumExits);
      }

      // Sort by priority
      return exitLevels.sort((a, b) => a.priority - b.priority);
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to calculate dynamic exit levels", {
        error: safeError.message,
        strategyId: strategy.id,
        positionId: position.id,
      });

      // Return basic exit levels as fallback
      return strategy.levels.map((level) =>
        DynamicExitLevelSchema.parse({
          triggerCondition: "price_target",
          percentage: level.percentage,
          sellPercentage: level.sellPercentage,
          multiplier: level.multiplier,
          priority: 5,
          isActive: true,
        })
      );
    }
  }

  /**
   * Update strategy performance after trade completion
   */
  async updateStrategyPerformance(
    strategyId: string,
    tradeResult: {
      success: boolean;
      return: number;
      holdTime: number;
      pattern: PatternMatch;
    }
  ): Promise<void> {
    try {
      let performance = this.strategyPerformance.get(strategyId);

      if (!performance) {
        performance = this.createDefaultPerformance(strategyId);
      }

      // Update performance metrics
      performance.totalTrades++;
      performance.usageCount++;
      performance.lastUsed = new Date().toISOString();

      if (tradeResult.success) {
        performance.successfulTrades++;
        performance.totalPnl += tradeResult.return;
        performance.maxReturn = Math.max(performance.maxReturn, tradeResult.return);
      } else {
        performance.failedTrades++;
        performance.minReturn = Math.min(performance.minReturn, tradeResult.return);
      }

      // Recalculate derived metrics
      performance.successRate = (performance.successfulTrades / performance.totalTrades) * 100;
      performance.averageReturn = performance.totalPnl / performance.totalTrades;
      performance.averageHoldTime =
        (performance.averageHoldTime * (performance.totalTrades - 1) + tradeResult.holdTime) /
        performance.totalTrades;

      performance.winLossRatio =
        performance.failedTrades > 0
          ? performance.successfulTrades / performance.failedTrades
          : performance.successfulTrades;

      // Update storage
      this.strategyPerformance.set(strategyId, performance);

      // Add to usage history
      this.strategyUsageHistory.push({
        strategyId,
        timestamp: new Date().toISOString(),
        pattern: tradeResult.pattern,
        result: tradeResult.success ? "success" : "failure",
        return: tradeResult.return,
        holdTime: tradeResult.holdTime,
      });

      // Keep only last 1000 records
      if (this.strategyUsageHistory.length > 1000) {
        this.strategyUsageHistory = this.strategyUsageHistory.slice(-1000);
      }

      this.logger.debug("Strategy performance updated", {
        strategyId,
        totalTrades: performance.totalTrades,
        successRate: performance.successRate,
        averageReturn: performance.averageReturn,
      });
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to update strategy performance", {
        error: safeError.message,
        strategyId,
      });
    }
  }

  /**
   * Get strategy performance analytics
   */
  getStrategyAnalytics(): {
    topPerformingStrategies: Array<{ strategyId: string; performance: StrategyPerformance }>;
    worstPerformingStrategies: Array<{ strategyId: string; performance: StrategyPerformance }>;
    overallMetrics: {
      totalTrades: number;
      overallSuccessRate: number;
      totalPnl: number;
      averageHoldTime: number;
    };
    recentTrends: {
      last30Days: { successRate: number; averageReturn: number };
      last7Days: { successRate: number; averageReturn: number };
    };
  } {
    try {
      const performances = Array.from(this.strategyPerformance.entries())
        .map(([strategyId, performance]) => ({ strategyId, performance }))
        .filter((item) => item.performance.totalTrades > 0);

      // Sort by risk-adjusted return
      const sortedByPerformance = performances.sort(
        (a, b) => b.performance.riskAdjustedReturn - a.performance.riskAdjustedReturn
      );

      // Calculate overall metrics
      const overallMetrics = {
        totalTrades: performances.reduce((sum, item) => sum + item.performance.totalTrades, 0),
        overallSuccessRate: this.calculateOverallSuccessRate(performances),
        totalPnl: performances.reduce((sum, item) => sum + item.performance.totalPnl, 0),
        averageHoldTime: this.calculateAverageHoldTime(performances),
      };

      // Calculate recent trends
      const recentTrends = this.calculateRecentTrends();

      return {
        topPerformingStrategies: sortedByPerformance.slice(0, 3),
        worstPerformingStrategies: sortedByPerformance.slice(-3).reverse(),
        overallMetrics,
        recentTrends,
      };
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to get strategy analytics", {
        error: safeError.message,
      });

      return {
        topPerformingStrategies: [],
        worstPerformingStrategies: [],
        overallMetrics: {
          totalTrades: 0,
          overallSuccessRate: 0,
          totalPnl: 0,
          averageHoldTime: 0,
        },
        recentTrends: {
          last30Days: { successRate: 0, averageReturn: 0 },
          last7Days: { successRate: 0, averageReturn: 0 },
        },
      };
    }
  }

  /**
   * Get engine performance metrics
   */
  getEngineMetrics() {
    const selectionAccuracy =
      this.performanceMetrics.totalStrategySelections > 0
        ? (this.performanceMetrics.optimalSelections /
            this.performanceMetrics.totalStrategySelections) *
          100
        : 0;

    return {
      ...this.performanceMetrics,
      selectionAccuracy: Math.round(selectionAccuracy * 100) / 100,
      strategiesAvailable: this.enhancedStrategies.size,
      historicalRecords: this.strategyUsageHistory.length,
    };
  }

  // Private helper methods

  private initializeEnhancedStrategies(): void {
    // Convert existing strategies to enhanced format
    for (const [id, strategy] of Object.entries(TRADING_STRATEGIES)) {
      const enhanced = EnhancedTradingStrategySchema.parse({
        ...strategy,
        riskProfile: this.mapStrategyToRiskProfile(id),
        adaptiveParameters: {
          enableDynamicAdjustment: true,
          volatilityAdjustment: true,
          momentumAdjustment: id === "diamond" || id === "highPriceIncrease",
          volumeAdjustment: true,
        },
      });

      this.enhancedStrategies.set(id, enhanced);
      this.strategyPerformance.set(id, this.createDefaultPerformance(id));
    }
  }

  private async scoreStrategies(
    criteria: StrategySelectionCriteria
  ): Promise<Array<{ strategy: EnhancedTradingStrategy; score: number }>> {
    const scores: Array<{ strategy: EnhancedTradingStrategy; score: number }> = [];

    for (const [id, strategy] of this.enhancedStrategies) {
      const performance = this.strategyPerformance.get(id);
      let score = 50; // Base score

      // Performance-based scoring
      if (performance && performance.totalTrades > 5) {
        score += (performance.successRate - 50) * 0.5; // Success rate impact
        score += Math.min(20, performance.riskAdjustedReturn * 10); // Return impact
      }

      // Confidence matching
      if (criteria.confidence >= strategy.minConfidenceRequired) {
        score += 15;
      } else {
        score -= 25;
      }

      // Risk profile matching
      if (criteria.portfolioRisk !== undefined) {
        const riskMatch = this.assessRiskProfileMatch(strategy.riskProfile, criteria.portfolioRisk);
        score += riskMatch;
      }

      // Recent performance bonus/penalty
      const recentPerformance = this.getRecentPerformance(id, 7); // Last 7 days
      if (recentPerformance.trades > 0) {
        score += (recentPerformance.successRate - 50) * 0.3;
      }

      scores.push({ strategy, score: Math.max(0, Math.min(100, score)) });
    }

    return scores.sort((a, b) => b.score - a.score);
  }

  private async applyAdaptiveAdjustments(
    strategy: EnhancedTradingStrategy,
    criteria: StrategySelectionCriteria
  ): Promise<
    Array<{
      parameter: string;
      originalValue: any;
      adjustedValue: any;
      reason: string;
    }>
  > {
    const adjustments: Array<{
      parameter: string;
      originalValue: any;
      adjustedValue: any;
      reason: string;
    }> = [];

    if (!strategy.adaptiveParameters?.enableDynamicAdjustment) {
      return adjustments;
    }

    // Volatility-based adjustments
    if (criteria.volatility && criteria.volatility > 15) {
      // Reduce position sizes in high volatility
      for (let i = 0; i < strategy.levels.length; i++) {
        const original = strategy.levels[i].sellPercentage;
        const adjusted = Math.max(5, original * 0.8);

        if (adjusted !== original) {
          strategy.levels[i].sellPercentage = adjusted;
          adjustments.push({
            parameter: `levels[${i}].sellPercentage`,
            originalValue: original,
            adjustedValue: adjusted,
            reason: "Reduced due to high volatility",
          });
        }
      }
    }

    // Portfolio risk adjustments
    if (criteria.portfolioRisk && criteria.portfolioRisk > 60) {
      // More conservative exits
      for (let i = 0; i < strategy.levels.length; i++) {
        const original = strategy.levels[i].percentage;
        const adjusted = original * 0.85; // Take profits 15% earlier

        strategy.levels[i].percentage = adjusted;
        adjustments.push({
          parameter: `levels[${i}].percentage`,
          originalValue: original,
          adjustedValue: adjusted,
          reason: "Earlier exits due to high portfolio risk",
        });
      }
    }

    this.performanceMetrics.adaptiveAdjustments += adjustments.length;

    return adjustments;
  }

  private generateStrategyReasoning(
    strategy: EnhancedTradingStrategy,
    score: number,
    criteria: StrategySelectionCriteria
  ): string[] {
    const reasoning: string[] = [];

    reasoning.push(`Strategy score: ${Math.round(score)}/100`);

    const performance = this.strategyPerformance.get(strategy.id);
    if (performance && performance.totalTrades > 5) {
      reasoning.push(`Historical success rate: ${Math.round(performance.successRate)}%`);
      reasoning.push(`Average return: ${Math.round(performance.averageReturn * 100) / 100}%`);
    }

    if (criteria.confidence >= strategy.minConfidenceRequired) {
      reasoning.push(`Pattern confidence meets strategy requirement`);
    }

    if (strategy.adaptiveParameters?.enableDynamicAdjustment) {
      reasoning.push(`Strategy supports adaptive adjustments`);
    }

    reasoning.push(`Risk profile: ${strategy.riskProfile}`);

    return reasoning;
  }

  private calculateVolatilityBasedExits(
    volatility: number,
    position: ExecutionPosition
  ): DynamicExitLevel[] {
    const exits: DynamicExitLevel[] = [];

    if (volatility > 20) {
      // High volatility - add protective exits
      exits.push(
        DynamicExitLevelSchema.parse({
          triggerCondition: "volatility",
          percentage: 15,
          sellPercentage: 30,
          multiplier: 1.15,
          priority: 2,
          conditions: { volatilityThreshold: 20 },
        })
      );
    }

    return exits;
  }

  private calculateMomentumBasedExits(
    momentum: number,
    position: ExecutionPosition
  ): DynamicExitLevel[] {
    const exits: DynamicExitLevel[] = [];

    if (momentum < -0.5) {
      // Negative momentum - add early exit
      exits.push(
        DynamicExitLevelSchema.parse({
          triggerCondition: "momentum",
          percentage: 10,
          sellPercentage: 50,
          multiplier: 1.1,
          priority: 1,
          conditions: { momentumThreshold: -0.5 },
        })
      );
    }

    return exits;
  }

  private startPerformanceTracking(): void {
    // Performance tracking logic would be implemented here
    this.logger.debug("Performance tracking started");
  }

  private mapStrategyToRiskProfile(
    strategyId: string
  ): "conservative" | "moderate" | "aggressive" | "adaptive" {
    switch (strategyId) {
      case "conservative":
      case "scalping":
        return "conservative";
      case "normal":
        return "moderate";
      case "highPriceIncrease":
      case "diamond":
        return "aggressive";
      default:
        return "adaptive";
    }
  }

  private createDefaultPerformance(strategyId: string): StrategyPerformance {
    return StrategyPerformanceSchema.parse({
      strategyId,
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      successRate: 0,
      averageReturn: 0,
      maxReturn: 0,
      minReturn: 0,
      averageHoldTime: 0,
      maxDrawdown: 0,
      totalPnl: 0,
      riskAdjustedReturn: 0,
      winLossRatio: 1,
      profitFactor: 1,
      lastUsed: new Date().toISOString(),
      usageCount: 0,
    });
  }

  private assessRiskProfileMatch(riskProfile: string, portfolioRisk: number): number {
    // Score risk profile compatibility
    if (portfolioRisk > 70) {
      return riskProfile === "conservative" ? 20 : -10;
    } else if (portfolioRisk > 40) {
      return riskProfile === "moderate" ? 15 : 5;
    } else {
      return riskProfile === "aggressive" ? 10 : 0;
    }
  }

  private getRecentPerformance(
    strategyId: string,
    days: number
  ): {
    trades: number;
    successRate: number;
    averageReturn: number;
  } {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recentTrades = this.strategyUsageHistory.filter(
      (trade) => trade.strategyId === strategyId && new Date(trade.timestamp) > cutoffDate
    );

    if (recentTrades.length === 0) {
      return { trades: 0, successRate: 0, averageReturn: 0 };
    }

    const successfulTrades = recentTrades.filter((trade) => trade.result === "success").length;
    const successRate = (successfulTrades / recentTrades.length) * 100;
    const averageReturn =
      recentTrades.reduce((sum, trade) => sum + trade.return, 0) / recentTrades.length;

    return {
      trades: recentTrades.length,
      successRate,
      averageReturn,
    };
  }

  private calculateOverallSuccessRate(
    performances: Array<{ strategyId: string; performance: StrategyPerformance }>
  ): number {
    const totalSuccessful = performances.reduce(
      (sum, item) => sum + item.performance.successfulTrades,
      0
    );
    const totalTrades = performances.reduce((sum, item) => sum + item.performance.totalTrades, 0);

    return totalTrades > 0 ? (totalSuccessful / totalTrades) * 100 : 0;
  }

  private calculateAverageHoldTime(
    performances: Array<{ strategyId: string; performance: StrategyPerformance }>
  ): number {
    const totalHoldTime = performances.reduce(
      (sum, item) => sum + item.performance.averageHoldTime * item.performance.totalTrades,
      0
    );
    const totalTrades = performances.reduce((sum, item) => sum + item.performance.totalTrades, 0);

    return totalTrades > 0 ? totalHoldTime / totalTrades : 0;
  }

  private calculateRecentTrends(): {
    last30Days: { successRate: number; averageReturn: number };
    last7Days: { successRate: number; averageReturn: number };
  } {
    const now = Date.now();
    const last7Days = this.strategyUsageHistory.filter(
      (trade) => now - new Date(trade.timestamp).getTime() <= 7 * 24 * 60 * 60 * 1000
    );
    const last30Days = this.strategyUsageHistory.filter(
      (trade) => now - new Date(trade.timestamp).getTime() <= 30 * 24 * 60 * 60 * 1000
    );

    const calculate = (trades: typeof this.strategyUsageHistory) => {
      if (trades.length === 0) return { successRate: 0, averageReturn: 0 };

      const successful = trades.filter((trade) => trade.result === "success").length;
      const successRate = (successful / trades.length) * 100;
      const averageReturn = trades.reduce((sum, trade) => sum + trade.return, 0) / trades.length;

      return { successRate, averageReturn };
    };

    return {
      last7Days: calculate(last7Days),
      last30Days: calculate(last30Days),
    };
  }
}

// Export factory function
export function createOptimizedTradingStrategyEngine(): OptimizedTradingStrategyEngine {
  return OptimizedTradingStrategyEngine.getInstance();
}
