/**
 * Enhanced Take Profit Strategy Types for MEXC Sniper Bot
 * Provides comprehensive configuration for multi-level take profit strategies
 */

export interface TakeProfitLevel {
  id: string;
  profitPercentage: number; // Percentage profit target (e.g., 5.0 for 5%)
  sellQuantity: number; // Percentage of position to sell (e.g., 25.0 for 25%)
  isActive: boolean; // Whether this level is enabled
  description?: string; // Optional description for the level
}

export interface TakeProfitStrategy {
  id: string;
  name: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
  levels: TakeProfitLevel[];
  isDefault?: boolean;
  isCustom?: boolean;
}

// Predefined strategy configurations
export const TAKE_PROFIT_STRATEGIES: TakeProfitStrategy[] = [
  {
    id: "conservative",
    name: "Conservative",
    description:
      "Lower risk, smaller but more reliable profits. Ideal for stable market conditions.",
    riskLevel: "low",
    levels: [
      {
        id: "conservative-1",
        profitPercentage: 3.0,
        sellQuantity: 30.0,
        isActive: true,
        description: "Quick profit taking at 3%",
      },
      {
        id: "conservative-2",
        profitPercentage: 7.0,
        sellQuantity: 40.0,
        isActive: true,
        description: "Moderate profit at 7%",
      },
      {
        id: "conservative-3",
        profitPercentage: 12.0,
        sellQuantity: 30.0,
        isActive: true,
        description: "Final exit at 12%",
      },
    ],
    isDefault: false,
  },
  {
    id: "balanced",
    name: "Balanced",
    description:
      "Moderate risk/reward balance. Good for most market conditions and experience levels.",
    riskLevel: "medium",
    levels: [
      {
        id: "balanced-1",
        profitPercentage: 5.0,
        sellQuantity: 25.0,
        isActive: true,
        description: "Initial profit taking at 5%",
      },
      {
        id: "balanced-2",
        profitPercentage: 12.0,
        sellQuantity: 35.0,
        isActive: true,
        description: "Main profit target at 12%",
      },
      {
        id: "balanced-3",
        profitPercentage: 20.0,
        sellQuantity: 25.0,
        isActive: true,
        description: "Extended profit at 20%",
      },
      {
        id: "balanced-4",
        profitPercentage: 35.0,
        sellQuantity: 15.0,
        isActive: true,
        description: "Moon shot at 35%",
      },
    ],
    isDefault: true,
  },
  {
    id: "aggressive",
    name: "Aggressive",
    description:
      "Higher risk, larger profit potential. Best for volatile markets and experienced traders.",
    riskLevel: "high",
    levels: [
      {
        id: "aggressive-1",
        profitPercentage: 8.0,
        sellQuantity: 20.0,
        isActive: true,
        description: "Early profit at 8%",
      },
      {
        id: "aggressive-2",
        profitPercentage: 18.0,
        sellQuantity: 30.0,
        isActive: true,
        description: "Main target at 18%",
      },
      {
        id: "aggressive-3",
        profitPercentage: 35.0,
        sellQuantity: 30.0,
        isActive: true,
        description: "High profit at 35%",
      },
      {
        id: "aggressive-4",
        profitPercentage: 60.0,
        sellQuantity: 20.0,
        isActive: true,
        description: "Maximum profit at 60%",
      },
    ],
    isDefault: false,
  },
];

export interface CustomTakeProfitConfig {
  strategy: TakeProfitStrategy;
  maxLevels: number;
  minProfitPercentage: number;
  maxProfitPercentage: number;
  minSellQuantity: number;
  maxSellQuantity: number;
}

export const DEFAULT_CUSTOM_CONFIG: CustomTakeProfitConfig = {
  strategy: {
    id: "custom",
    name: "Custom Strategy",
    description: "User-defined take profit levels",
    riskLevel: "medium",
    levels: [],
    isCustom: true,
  },
  maxLevels: 6,
  minProfitPercentage: 0.1,
  maxProfitPercentage: 1000.0,
  minSellQuantity: 1.0,
  maxSellQuantity: 100.0,
};

// Validation functions
export function validateTakeProfitLevel(level: TakeProfitLevel): string[] {
  const errors: string[] = [];

  if (level.profitPercentage < 0.1 || level.profitPercentage > 1000) {
    errors.push("Profit percentage must be between 0.1% and 1000%");
  }

  if (level.sellQuantity < 1 || level.sellQuantity > 100) {
    errors.push("Sell quantity must be between 1% and 100%");
  }

  return errors;
}

export function validateTakeProfitStrategy(
  strategy: TakeProfitStrategy
): string[] {
  const errors: string[] = [];

  if (strategy.levels.length === 0) {
    errors.push("Strategy must have at least one level");
  }

  if (strategy.levels.length > 6) {
    errors.push("Strategy cannot have more than 6 levels");
  }

  // Validate each level
  strategy.levels.forEach((level, index) => {
    const levelErrors = validateTakeProfitLevel(level);
    levelErrors.forEach((error) => {
      errors.push(`Level ${index + 1}: ${error}`);
    });
  });

  // Check for ascending profit percentages
  for (let i = 1; i < strategy.levels.length; i++) {
    if (
      strategy.levels[i].profitPercentage <=
      strategy.levels[i - 1].profitPercentage
    ) {
      errors.push(
        `Level ${i + 1} profit percentage must be higher than level ${i}`
      );
    }
  }

  // Check total sell quantity doesn't exceed 100%
  const totalSellQuantity = strategy.levels
    .filter((level) => level.isActive)
    .reduce((sum, level) => sum + level.sellQuantity, 0);

  if (totalSellQuantity > 100) {
    errors.push("Total sell quantity across all levels cannot exceed 100%");
  }

  return errors;
}

// Helper functions
export function getTakeProfitStrategyById(
  id: string
): TakeProfitStrategy | undefined {
  return TAKE_PROFIT_STRATEGIES.find((strategy) => strategy.id === id);
}

export function createCustomTakeProfitLevel(
  profitPercentage: number,
  sellQuantity: number,
  description?: string
): TakeProfitLevel {
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    profitPercentage,
    sellQuantity,
    isActive: true,
    description,
  };
}

export function calculatePotentialProfit(
  strategy: TakeProfitStrategy,
  investmentAmount: number
): { level: TakeProfitLevel; profit: number; remaining: number }[] {
  let remainingPosition = 100; // Start with 100% of position
  const results: {
    level: TakeProfitLevel;
    profit: number;
    remaining: number;
  }[] = [];

  strategy.levels
    .filter((level) => level.isActive)
    .forEach((level) => {
      // Calculate the amount to sell based on the sell quantity percentage
      const sellAmount = level.sellQuantity;
      // Calculate profit based on the investment amount and profit percentage
      const profit =
        ((investmentAmount * sellAmount) / 100) *
        (level.profitPercentage / 100);
      // Update remaining position
      remainingPosition -= sellAmount;

      results.push({
        level,
        profit,
        remaining: Math.max(0, remainingPosition), // Ensure remaining doesn't go negative
      });
    });

  return results;
}

// Legacy compatibility types
export interface LegacyTakeProfitLevels {
  level1: number;
  level2: number;
  level3: number;
  level4: number;
  custom?: number;
}

export function convertLegacyToStrategy(
  legacy: LegacyTakeProfitLevels,
  sellQuantities?: {
    level1?: number;
    level2?: number;
    level3?: number;
    level4?: number;
    custom?: number;
  }
): TakeProfitStrategy {
  const levels: TakeProfitLevel[] = [];

  if (legacy.level1) {
    levels.push({
      id: "legacy-1",
      profitPercentage: legacy.level1,
      sellQuantity: sellQuantities?.level1 || 25,
      isActive: true,
      description: "Legacy Level 1",
    });
  }

  if (legacy.level2) {
    levels.push({
      id: "legacy-2",
      profitPercentage: legacy.level2,
      sellQuantity: sellQuantities?.level2 || 25,
      isActive: true,
      description: "Legacy Level 2",
    });
  }

  if (legacy.level3) {
    levels.push({
      id: "legacy-3",
      profitPercentage: legacy.level3,
      sellQuantity: sellQuantities?.level3 || 25,
      isActive: true,
      description: "Legacy Level 3",
    });
  }

  if (legacy.level4) {
    levels.push({
      id: "legacy-4",
      profitPercentage: legacy.level4,
      sellQuantity: sellQuantities?.level4 || 25,
      isActive: true,
      description: "Legacy Level 4",
    });
  }

  if (legacy.custom) {
    levels.push({
      id: "legacy-custom",
      profitPercentage: legacy.custom,
      sellQuantity: sellQuantities?.custom || 100,
      isActive: true,
      description: "Legacy Custom Level",
    });
  }

  return {
    id: "legacy-converted",
    name: "Converted Legacy Strategy",
    description: "Converted from legacy take profit configuration",
    riskLevel: "medium",
    levels,
    isCustom: true,
  };
}
