import { z } from "zod";
import { type PriceMultiplier, type TradingStrategyConfig, PriceMultiplierSchema, TradingStrategyConfigSchema } from "./multi-phase-trading-service";

// ===========================================
// MULTI-PHASE STRATEGY BUILDER
// ===========================================

export class MultiPhaseStrategyBuilder {
  private levels: PriceMultiplier[] = [];
  private id: string;
  private name: string;
  private description: string = "";

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  /**
   * Add a phase to the strategy
   * @param targetPercentage Target profit percentage (e.g., 50 for 50% gain)
   * @param sellPercentage Percentage of position to sell at this level (e.g., 25 for 25%)
   * @returns Builder instance for chaining
   */
  addPhase(targetPercentage: number, sellPercentage: number): MultiPhaseStrategyBuilder {
    if (targetPercentage <= 0) {
      throw new Error("Target percentage must be positive");
    }
    
    if (sellPercentage <= 0 || sellPercentage > 100) {
      throw new Error("Sell percentage must be between 0 and 100");
    }

    const multiplier = 1 + targetPercentage / 100;
    this.levels.push({
      percentage: targetPercentage,
      multiplier,
      sellPercentage,
    });
    return this;
  }

  /**
   * Add multiple phases at once
   * @param phases Array of [targetPercentage, sellPercentage] tuples
   * @returns Builder instance for chaining
   */
  addPhases(phases: [number, number][]): MultiPhaseStrategyBuilder {
    phases.forEach(([targetPercentage, sellPercentage]) => {
      this.addPhase(targetPercentage, sellPercentage);
    });
    return this;
  }

  /**
   * Set description for the strategy
   * @param description Strategy description
   * @returns Builder instance for chaining
   */
  withDescription(description: string): MultiPhaseStrategyBuilder {
    this.description = description;
    return this;
  }

  /**
   * Create a balanced strategy with evenly distributed phases
   * @param phases Number of phases to create
   * @param maxTarget Maximum target percentage for final phase
   * @param totalSellPercent Total percentage to sell across all phases (default: 80%)
   * @returns Builder instance for chaining
   */
  createBalancedStrategy(
    phases: number,
    maxTarget: number,
    totalSellPercent: number = 80
  ): MultiPhaseStrategyBuilder {
    if (phases < 2 || phases > 10) {
      throw new Error("Number of phases must be between 2 and 10");
    }

    if (totalSellPercent <= 0 || totalSellPercent > 100) {
      throw new Error("Total sell percentage must be between 0 and 100");
    }

    this.levels = [];

    const sellPerPhase = totalSellPercent / phases;
    const targetIncrement = maxTarget / phases;

    for (let i = 1; i <= phases; i++) {
      const targetPercentage = targetIncrement * i;
      this.addPhase(targetPercentage, sellPerPhase);
    }

    return this;
  }

  /**
   * Create a conservative strategy with early profit-taking
   * @param earlyExitPercent Percentage to take early profits (default: 60%)
   * @param maxTarget Maximum target for remaining position (default: 100%)
   * @returns Builder instance for chaining
   */
  createConservativeStrategy(
    earlyExitPercent: number = 60,
    maxTarget: number = 100
  ): MultiPhaseStrategyBuilder {
    this.levels = [];
    
    // Take early profits at lower levels
    this.addPhase(10, earlyExitPercent * 0.3)  // 18% at +10%
      .addPhase(20, earlyExitPercent * 0.4)    // 24% at +20%
      .addPhase(30, earlyExitPercent * 0.3)    // 18% at +30%
      .addPhase(maxTarget, 100 - earlyExitPercent); // Remaining at max target

    return this;
  }

  /**
   * Create an aggressive strategy with high targets
   * @param minTarget Minimum target percentage (default: 100%)
   * @param maxTarget Maximum target percentage (default: 500%)
   * @returns Builder instance for chaining
   */
  createAggressiveStrategy(
    minTarget: number = 100,
    maxTarget: number = 500
  ): MultiPhaseStrategyBuilder {
    this.levels = [];
    
    // Aggressive targets with smaller position sales
    this.addPhase(minTarget, 15)              // 15% at first target
      .addPhase(minTarget * 1.5, 20)          // 20% at 1.5x first target
      .addPhase(minTarget * 2, 25)            // 25% at 2x first target
      .addPhase(maxTarget, 20);               // 20% at max target
    // Remaining 20% holds for moonshot

    return this;
  }

  /**
   * Create a scalping strategy with quick, small profits
   * @param maxTarget Maximum target percentage (default: 20%)
   * @returns Builder instance for chaining
   */
  createScalpingStrategy(maxTarget: number = 20): MultiPhaseStrategyBuilder {
    this.levels = [];
    
    const increment = maxTarget / 4;
    
    this.addPhase(increment, 20)         // 20% at 5%
      .addPhase(increment * 2, 30)       // 30% at 10%
      .addPhase(increment * 3, 30)       // 30% at 15%
      .addPhase(increment * 4, 20);      // 20% at 20%

    return this;
  }

  /**
   * Create a diamond hands strategy for long-term holds
   * @returns Builder instance for chaining
   */
  createDiamondHandsStrategy(): MultiPhaseStrategyBuilder {
    this.levels = [];
    
    // Very high targets with minimal selling
    this.addPhase(200, 10)    // 10% at +200%
      .addPhase(500, 20)      // 20% at +500%
      .addPhase(1000, 30)     // 30% at +1000%
      .addPhase(2000, 20);    // 20% at +2000%
    // Remaining 20% for absolute moonshot

    return this;
  }

  /**
   * Validate and build the final strategy
   * @returns Validated trading strategy configuration
   */
  build(): TradingStrategyConfig {
    if (this.levels.length === 0) {
      throw new Error("Strategy must have at least one phase");
    }

    // Validate total sell percentage doesn't exceed 100%
    const totalSellPercentage = this.levels.reduce(
      (sum, level) => sum + level.sellPercentage,
      0
    );

    if (totalSellPercentage > 100) {
      throw new Error(
        `Total sell percentage (${totalSellPercentage.toFixed(1)}%) exceeds 100%`
      );
    }

    // Sort levels by percentage to ensure correct order
    this.levels.sort((a, b) => a.percentage - b.percentage);

    // Validate levels are increasing
    for (let i = 1; i < this.levels.length; i++) {
      if (this.levels[i].percentage <= this.levels[i - 1].percentage) {
        throw new Error("Target percentages must be strictly increasing");
      }
    }

    // Validate with Zod schema
    const strategy = {
      id: this.id,
      name: this.name,
      description: this.description,
      levels: this.levels,
    };

    return TradingStrategyConfigSchema.parse(strategy);
  }

  /**
   * Get strategy preview without building
   * @returns Preview of the strategy with validation info
   */
  preview(): {
    levels: PriceMultiplier[];
    totalSellPercentage: number;
    remainingPercentage: number;
    estimatedRisk: "low" | "medium" | "high";
    avgTarget: number;
    validation: {
      isValid: boolean;
      errors: string[];
      warnings: string[];
    };
  } {
    const totalSellPercentage = this.levels.reduce(
      (sum, level) => sum + level.sellPercentage,
      0
    );
    
    const remainingPercentage = 100 - totalSellPercentage;
    const avgTarget = this.levels.length > 0 
      ? this.levels.reduce((sum, level) => sum + level.percentage, 0) / this.levels.length
      : 0;

    const errors: string[] = [];
    const warnings: string[] = [];

    // Validation checks
    if (this.levels.length === 0) {
      errors.push("Strategy must have at least one phase");
    }

    if (totalSellPercentage > 100) {
      errors.push(`Total sell percentage (${totalSellPercentage.toFixed(1)}%) exceeds 100%`);
    }

    if (totalSellPercentage < 50) {
      warnings.push("Low total sell percentage may limit profit realization");
    }

    if (remainingPercentage > 50) {
      warnings.push("High remaining percentage increases risk exposure");
    }

    if (this.levels.length > 8) {
      warnings.push("Many phases may be difficult to manage");
    }

    // Check for gaps in targets
    const sortedLevels = [...this.levels].sort((a, b) => a.percentage - b.percentage);
    for (let i = 1; i < sortedLevels.length; i++) {
      const gap = sortedLevels[i].percentage - sortedLevels[i - 1].percentage;
      if (gap > 100) {
        warnings.push(`Large gap between phase ${i} and ${i + 1} targets`);
      }
    }

    // Estimate risk level
    let estimatedRisk: "low" | "medium" | "high";
    if (avgTarget < 30) estimatedRisk = "low";
    else if (avgTarget < 100) estimatedRisk = "medium";
    else estimatedRisk = "high";

    return {
      levels: this.levels,
      totalSellPercentage,
      remainingPercentage,
      estimatedRisk,
      avgTarget,
      validation: {
        isValid: errors.length === 0,
        errors,
        warnings,
      },
    };
  }

  /**
   * Clone an existing strategy config as a starting point
   * @param config Existing strategy configuration
   * @returns New builder with cloned configuration
   */
  static fromConfig(config: TradingStrategyConfig): MultiPhaseStrategyBuilder {
    const builder = new MultiPhaseStrategyBuilder(
      `${config.id}-copy`,
      `${config.name} (Copy)`
    );
    
    builder.withDescription(config.description || "");
    builder.levels = [...config.levels];
    
    return builder;
  }
}

// Utility functions for common strategy patterns
export class StrategyPatterns {
  /**
   * Create a fibonacci-based strategy
   * @param baseTarget Base target percentage
   * @param phases Number of phases
   * @returns Strategy builder with fibonacci progression
   */
  static fibonacci(baseTarget: number, phases: number = 5): MultiPhaseStrategyBuilder {
    const builder = new MultiPhaseStrategyBuilder(
      "fibonacci",
      "Fibonacci Multi-Phase Strategy"
    );

    const fib = [1, 1, 2, 3, 5, 8, 13, 21];
    const sellPercents = [15, 20, 25, 20, 20]; // Distribute 100% across phases

    for (let i = 0; i < Math.min(phases, fib.length - 2); i++) {
      const target = baseTarget * fib[i + 2]; // Start from 3rd fibonacci number
      const sellPercent = sellPercents[i] || 10;
      builder.addPhase(target, sellPercent);
    }

    return builder.withDescription("Strategy based on Fibonacci sequence progression");
  }

  /**
   * Create a momentum-based strategy that adapts to volatility
   * @param volatility Market volatility level
   * @returns Strategy builder adapted for volatility
   */
  static momentum(volatility: "low" | "medium" | "high"): MultiPhaseStrategyBuilder {
    const builder = new MultiPhaseStrategyBuilder(
      `momentum-${volatility}`,
      `Momentum Strategy (${volatility} volatility)`
    );

    switch (volatility) {
      case "low":
        // Smaller targets, more phases in low volatility
        builder.createBalancedStrategy(6, 60, 80);
        break;
      case "medium":
        // Balanced approach
        builder.createBalancedStrategy(4, 150, 75);
        break;
      case "high":
        // Higher targets, fewer phases in high volatility
        builder.createBalancedStrategy(3, 300, 70);
        break;
    }

    return builder;
  }

  /**
   * Create a risk-adjusted strategy based on position size
   * @param positionSizePercent Percentage of portfolio in this position
   * @returns Strategy builder adjusted for position size risk
   */
  static riskAdjusted(positionSizePercent: number): MultiPhaseStrategyBuilder {
    const builder = new MultiPhaseStrategyBuilder(
      "risk-adjusted",
      "Risk-Adjusted Multi-Phase Strategy"
    );

    if (positionSizePercent > 20) {
      // Large position - take profits early and often
      builder.createConservativeStrategy(70, 80);
    } else if (positionSizePercent > 10) {
      // Medium position - balanced approach
      builder.createBalancedStrategy(4, 120, 75);
    } else {
      // Small position - can afford to be more aggressive
      builder.createAggressiveStrategy(80, 250);
    }

    return builder.withDescription(
      `Strategy adjusted for ${positionSizePercent}% position size`
    );
  }
}

// Export commonly used strategy builders
export const createQuickStrategies = {
  conservative: () => new MultiPhaseStrategyBuilder("quick-conservative", "Quick Conservative")
    .createConservativeStrategy(),
  
  balanced: () => new MultiPhaseStrategyBuilder("quick-balanced", "Quick Balanced")
    .createBalancedStrategy(4, 100),
  
  aggressive: () => new MultiPhaseStrategyBuilder("quick-aggressive", "Quick Aggressive")
    .createAggressiveStrategy(),
  
  scalping: () => new MultiPhaseStrategyBuilder("quick-scalping", "Quick Scalping")
    .createScalpingStrategy(),
  
  diamond: () => new MultiPhaseStrategyBuilder("quick-diamond", "Quick Diamond Hands")
    .createDiamondHandsStrategy(),
};