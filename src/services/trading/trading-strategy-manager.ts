import { z } from "zod";

/**
 * TRADING STRATEGY MANAGER
 *
 * Manages multiple trading strategies with switching capabilities,
 * exactly matching the specification from docs/tl-systems.md
 */

// Zod schemas for type safety
export const PriceMultiplierSchema = z.object({
  percentage: z.number().min(0),
  multiplier: z.number().min(1),
  sellPercentage: z.number().min(0).max(100),
});

export const TradingStrategySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  levels: z.array(PriceMultiplierSchema),
});

// Type definitions
export type PriceMultiplier = z.infer<typeof PriceMultiplierSchema>;
export type TradingStrategy = z.infer<typeof TradingStrategySchema>;

// Multi-Phase Take Profit Strategy configurations - EXACT MATCH to docs
export const TRADING_STRATEGIES: Record<string, TradingStrategy> = {
  normal: {
    id: "normal",
    name: "Normal Multi-Phase Strategy",
    description: "Standaard multi-phase strategie met 4 exit punten",
    levels: [
      { percentage: 50, multiplier: 1.5, sellPercentage: 25 }, // Phase 1: 25% @ +50%
      { percentage: 100, multiplier: 2.0, sellPercentage: 25 }, // Phase 2: 25% @ +100%
      { percentage: 125, multiplier: 2.25, sellPercentage: 20 }, // Phase 3: 20% @ +125%
      { percentage: 175, multiplier: 2.75, sellPercentage: 10 }, // Phase 4: 10% @ +175%
      // Remaining 20% holds for moonshot potential
    ],
  },
  highPriceIncrease: {
    id: "highPriceIncrease",
    name: "Aggressive Multi-Phase Strategy",
    description: "Agressieve multi-phase strategie voor hogere targets",
    levels: [
      { percentage: 100, multiplier: 2.0, sellPercentage: 15 }, // Phase 1: 15% @ +100%
      { percentage: 150, multiplier: 2.5, sellPercentage: 15 }, // Phase 2: 15% @ +150%
      { percentage: 200, multiplier: 3.0, sellPercentage: 25 }, // Phase 3: 25% @ +200%
      { percentage: 300, multiplier: 4.0, sellPercentage: 25 }, // Phase 4: 25% @ +300%
      // Remaining 20% holds for extreme gains
    ],
  },
  conservative: {
    id: "conservative",
    name: "Conservative Multi-Phase Strategy",
    description: "Voorzichtige strategie met vroege winst-taking",
    levels: [
      { percentage: 10, multiplier: 1.1, sellPercentage: 30 }, // Phase 1: 30% @ +10%
      { percentage: 20, multiplier: 1.2, sellPercentage: 40 }, // Phase 2: 40% @ +20%
      { percentage: 30, multiplier: 1.3, sellPercentage: 30 }, // Phase 3: 30% @ +30%
    ],
  },
  scalping: {
    id: "scalping",
    name: "Scalping Multi-Phase Strategy",
    description: "Snelle winsten met kleine targets",
    levels: [
      { percentage: 5, multiplier: 1.05, sellPercentage: 20 }, // Phase 1: 20% @ +5%
      { percentage: 10, multiplier: 1.1, sellPercentage: 30 }, // Phase 2: 30% @ +10%
      { percentage: 15, multiplier: 1.15, sellPercentage: 30 }, // Phase 3: 30% @ +15%
      { percentage: 20, multiplier: 1.2, sellPercentage: 20 }, // Phase 4: 20% @ +20%
    ],
  },
  diamond: {
    id: "diamond",
    name: "Diamond Hands Multi-Phase Strategy",
    description: "Voor lange termijn holds met hoge targets",
    levels: [
      { percentage: 200, multiplier: 3.0, sellPercentage: 10 }, // Phase 1: 10% @ +200%
      { percentage: 500, multiplier: 6.0, sellPercentage: 20 }, // Phase 2: 20% @ +500%
      { percentage: 1000, multiplier: 11.0, sellPercentage: 30 }, // Phase 3: 30% @ +1000%
      { percentage: 2000, multiplier: 21.0, sellPercentage: 20 }, // Phase 4: 20% @ +2000%
      // Remaining 20% for absolute moonshot
    ],
  },
};

// Strategy manager class - EXACT implementation from docs
export class TradingStrategyManager {
  private strategies: Map<string, TradingStrategy>;
  private activeStrategy: TradingStrategy;

  constructor(initialStrategy = "normal") {
    this.strategies = new Map(Object.entries(TRADING_STRATEGIES));
    this.activeStrategy =
      this.strategies.get(initialStrategy) || TRADING_STRATEGIES.normal;
  }

  // Get active strategy
  getActiveStrategy(): TradingStrategy {
    return this.activeStrategy;
  }

  // Switch to different strategy
  switchStrategy(strategyId: string): boolean {
    const strategy = this.strategies.get(strategyId);
    if (strategy) {
      this.activeStrategy = strategy;
      return true;
    }
    return false;
  }

  // Alias for backwards compatibility
  setActiveStrategy(strategyId: string): boolean {
    return this.switchStrategy(strategyId);
  }

  // Get sell recommendations based on current price
  getSellRecommendations(
    entryPrice: number,
    currentPrice: number,
    totalAmount: number
  ): Array<{
    level: PriceMultiplier;
    triggered: boolean;
    targetPrice: number;
    sellAmount: number;
  }> {
    const priceIncrease = ((currentPrice - entryPrice) / entryPrice) * 100;

    return this.activeStrategy.levels.map((level) => {
      const targetPrice = entryPrice * level.multiplier;
      const triggered = priceIncrease >= level.percentage;
      const sellAmount = (totalAmount * level.sellPercentage) / 100;

      return {
        level,
        triggered,
        targetPrice,
        sellAmount,
      };
    });
  }

  // Calculate remaining position after sells
  calculateRemainingPosition(
    entryPrice: number,
    currentPrice: number,
    totalAmount: number
  ): {
    soldAmount: number;
    remainingAmount: number;
    realizedProfit: number;
  } {
    const recommendations = this.getSellRecommendations(
      entryPrice,
      currentPrice,
      totalAmount
    );

    let soldAmount = 0;
    let realizedProfit = 0;

    recommendations.forEach((rec) => {
      if (rec.triggered) {
        soldAmount += rec.sellAmount;
        realizedProfit += rec.sellAmount * (rec.targetPrice - entryPrice);
      }
    });

    return {
      soldAmount,
      remainingAmount: totalAmount - soldAmount,
      realizedProfit,
    };
  }

  // Add custom strategy
  addStrategy(strategy: TradingStrategy): void {
    const validated = TradingStrategySchema.parse(strategy);
    this.strategies.set(validated.id, validated);
  }

  // Get all available strategies
  getAllStrategies(): TradingStrategy[] {
    return Array.from(this.strategies.values());
  }

  // List available strategy IDs
  listAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  // Get strategy by ID
  getStrategy(strategyId: string): TradingStrategy | null {
    return this.strategies.get(strategyId) || null;
  }

  // Get sell recommendation for specific price
  getSellRecommendation(
    currentPrice: number,
    entryPrice: number
  ): {
    shouldSell: boolean;
    phases: Array<{
      phase: number;
      percentage: number;
      sellPercentage: number;
      expectedProfit: number;
    }>;
    totalExpectedProfit: number;
  } {
    if (entryPrice <= 0 || currentPrice <= 0) {
      return {
        shouldSell: false,
        phases: [],
        totalExpectedProfit: 0,
      };
    }

    const priceIncrease = ((currentPrice - entryPrice) / entryPrice) * 100;
    const triggeredPhases: Array<{
      phase: number;
      percentage: number;
      sellPercentage: number;
      expectedProfit: number;
    }> = [];

    this.activeStrategy.levels.forEach((level, index) => {
      if (priceIncrease >= level.percentage) {
        // Calculate expected profit for 1 unit
        const expectedProfit =
          (currentPrice - entryPrice) * (level.sellPercentage / 100);

        triggeredPhases.push({
          phase: index + 1,
          percentage: level.percentage,
          sellPercentage: level.sellPercentage,
          expectedProfit,
        });
      }
    });

    const totalExpectedProfit = triggeredPhases.reduce(
      (sum, phase) => sum + phase.expectedProfit,
      0
    );

    return {
      shouldSell: triggeredPhases.length > 0,
      phases: triggeredPhases,
      totalExpectedProfit,
    };
  }

  // Export strategy configuration
  exportStrategy(strategyId: string): TradingStrategy | null {
    return this.strategies.get(strategyId) || null;
  }

  // Export strategy to JSON string
  exportStrategyJSON(strategyId: string): string | null {
    const strategy = this.strategies.get(strategyId);
    return strategy ? JSON.stringify(strategy, null, 2) : null;
  }

  // Import strategy from object
  importStrategy(strategy: TradingStrategy): boolean {
    try {
      // Validate strategy structure
      if (
        !strategy.id ||
        !strategy.name ||
        !strategy.levels ||
        !Array.isArray(strategy.levels)
      ) {
        return false;
      }

      // Validate levels
      for (const level of strategy.levels) {
        if (
          level.percentage < 0 ||
          level.multiplier < 1 ||
          level.sellPercentage < 0 ||
          level.sellPercentage > 100
        ) {
          return false;
        }
      }

      // Validate that levels array is not empty
      if (strategy.levels.length === 0) {
        return false;
      }

      const validated = TradingStrategySchema.parse(strategy);
      this.strategies.set(validated.id, validated);
      return true;
    } catch {
      return false;
    }
  }

  // Import strategy from JSON string
  importStrategyJSON(jsonString: string): boolean {
    try {
      const strategy = JSON.parse(jsonString);
      return this.importStrategy(strategy);
    } catch {
      return false;
    }
  }
}
