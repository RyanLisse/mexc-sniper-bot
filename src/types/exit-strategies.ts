// Exit Strategy Types and Definitions

export interface ExitLevel {
  percentage: number; // Percentage of position to sell (0-100)
  targetMultiplier: number; // Target multiplier (e.g., 2.0 for 2x)
  profitPercent: number; // Profit percentage (+100% for 2x)
}

export interface ExitStrategy {
  id: string;
  name: string;
  description: string;
  levels: ExitLevel[];
  isDefault: boolean;
  isCustom: boolean;
  type?: string;
  riskLevel?: string;
  parameters?: Record<string, any>;
  enabled?: boolean;
  createdAt?: string | Date;
}

// Predefined Exit Strategies
export const EXIT_STRATEGIES: ExitStrategy[] = [
  {
    id: "conservative",
    name: "Conservative 2x Target",
    description: "Lower risk strategy with steady profits",
    levels: [
      { percentage: 20, targetMultiplier: 1.3, profitPercent: 30 },
      { percentage: 52, targetMultiplier: 2.0, profitPercent: 100 },
      { percentage: 28, targetMultiplier: 2.5, profitPercent: 150 },
    ],
    isDefault: false,
    isCustom: false,
  },
  {
    id: "balanced",
    name: "Balanced 3x Target",
    description: "Default strategy with moderate risk/reward",
    levels: [
      { percentage: 15, targetMultiplier: 1.5, profitPercent: 50 },
      { percentage: 35, targetMultiplier: 2.5, profitPercent: 150 },
      { percentage: 50, targetMultiplier: 4.0, profitPercent: 300 },
    ],
    isDefault: true,
    isCustom: false,
  },
  {
    id: "aggressive",
    name: "Aggressive 5x Target",
    description: "High risk/high reward strategy",
    levels: [
      { percentage: 10, targetMultiplier: 2.0, profitPercent: 100 },
      { percentage: 20, targetMultiplier: 3.0, profitPercent: 200 },
      { percentage: 70, targetMultiplier: 5.0, profitPercent: 400 },
    ],
    isDefault: false,
    isCustom: false,
  },
];

// Default custom strategy template
export const createCustomStrategy = (levels: ExitLevel[]): ExitStrategy => ({
  id: "custom",
  name: "Custom Strategy",
  description: "User-defined exit strategy",
  levels,
  isDefault: false,
  isCustom: true,
});

// Validation helpers
export const validateExitStrategy = (strategy: ExitStrategy): string[] => {
  const errors: string[] = [];

  // Check if percentages add up to 100%
  const totalPercentage = strategy.levels.reduce((sum, level) => sum + level.percentage, 0);
  if (Math.abs(totalPercentage - 100) > 0.01) {
    errors.push(`Exit percentages must add up to 100% (currently ${totalPercentage.toFixed(2)}%)`);
  }

  // Check if target multipliers are in ascending order
  for (let i = 1; i < strategy.levels.length; i++) {
    if (strategy.levels[i].targetMultiplier <= strategy.levels[i - 1].targetMultiplier) {
      errors.push("Target multipliers must be in ascending order");
      break;
    }
  }

  // Check for valid ranges
  strategy.levels.forEach((level, index) => {
    if (level.percentage <= 0 || level.percentage > 100) {
      errors.push(`Level ${index + 1}: Percentage must be between 0% and 100%`);
    }
    if (level.targetMultiplier <= 1.0) {
      errors.push(`Level ${index + 1}: Target multiplier must be greater than 1.0x`);
    }
  });

  return errors;
};

// Helper to calculate profit from multiplier
export const calculateProfitPercent = (multiplier: number): number => {
  return (multiplier - 1) * 100;
};

// Helper to calculate multiplier from profit percent
export const calculateMultiplier = (profitPercent: number): number => {
  return 1 + profitPercent / 100;
};
