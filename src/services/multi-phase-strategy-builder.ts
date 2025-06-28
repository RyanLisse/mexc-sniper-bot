/**
 * Multi-Phase Strategy Builder Service
 *
 * Placeholder implementation for building complex trading strategies.
 * This service provides tools to construct multi-phase trading strategies.
 */

export interface StrategyPattern {
  id: string;
  name: string;
  description: string;
  phases: PatternPhase[];
  conditions: PatternCondition[];
}

export interface PatternPhase {
  id: string;
  name: string;
  type: "entry" | "monitor" | "exit" | "risk_management";
  duration?: number;
  parameters: Record<string, any>;
}

export interface PatternCondition {
  id: string;
  type: "market" | "time" | "price" | "volume";
  operator: "gt" | "lt" | "eq" | "gte" | "lte";
  value: any;
  field: string;
}

export interface StrategyBuilder {
  addPhase(phase: PatternPhase): StrategyBuilder;
  addCondition(condition: PatternCondition): StrategyBuilder;
  setRiskParameters(params: Record<string, any>): StrategyBuilder;
  build(): StrategyPattern;
}

/**
 * Predefined strategy patterns
 */
export const StrategyPatterns = {
  QUICK_ENTRY: {
    id: "quick_entry",
    name: "Quick Entry Pattern",
    description: "Fast entry strategy for immediate opportunities",
    phases: [
      {
        id: "entry",
        name: "Entry Phase",
        type: "entry" as const,
        duration: 60, // 1 minute
        parameters: {
          orderType: "MARKET",
          allocation: 0.1,
        },
      },
    ],
    conditions: [],
  },

  GRADUAL_ACCUMULATION: {
    id: "gradual_accumulation",
    name: "Gradual Accumulation Pattern",
    description: "Slowly accumulate position over time",
    phases: [
      {
        id: "accumulation",
        name: "Accumulation Phase",
        type: "entry" as const,
        duration: 3600, // 1 hour
        parameters: {
          orderType: "LIMIT",
          allocation: 0.05,
          intervals: 12,
        },
      },
    ],
    conditions: [],
  },

  // Test-compatible pattern methods
  momentum(level: 'low' | 'medium' | 'high'): MultiPhaseStrategyBuilder {
    const builder = new MultiPhaseStrategyBuilder('momentum', 'Momentum Strategy');
    switch (level) {
      case 'low':
        return builder.addPhases([[10, 20], [20, 30], [30, 50]]);
      case 'medium':
        return builder.addPhases([[15, 25], [35, 40], [55, 35]]);
      case 'high':
        return builder.addPhases([[25, 30], [50, 35], [75, 35]]);
      default:
        return builder.addPhases([[15, 25], [35, 40], [55, 35]]);
    }
  },

  riskAdjusted(riskLevel: number): MultiPhaseStrategyBuilder {
    const builder = new MultiPhaseStrategyBuilder('risk-adjusted', 'Risk Adjusted Strategy');
    const safetyFactor = Math.max(1, Math.min(10, riskLevel));
    const basePercentage = 10 * safetyFactor;
    return builder.addPhases([
      [basePercentage, 25],
      [basePercentage * 2, 30],
      [basePercentage * 3, 45],
    ]);
  },

  volatilityAdjusted(volatility: number): MultiPhaseStrategyBuilder {
    const builder = new MultiPhaseStrategyBuilder('volatility-adjusted', 'Volatility Adjusted Strategy');
    const volMultiplier = Math.max(0.1, Math.min(2, volatility));
    const spacing = 20 * volMultiplier;
    return builder.addPhases([
      [spacing, 25],
      [spacing * 2, 35],
      [spacing * 3, 40],
    ]);
  },

  marketCondition(condition: 'bullish' | 'bearish' | 'sideways' | 'neutral'): MultiPhaseStrategyBuilder {
    const builder = new MultiPhaseStrategyBuilder('market-condition', 'Market Condition Strategy');
    switch (condition) {
      case 'bullish':
        return builder.addPhases([[30, 20], [60, 25], [100, 55]]);
      case 'bearish':
        return builder.addPhases([[5, 40], [10, 35], [15, 25]]);
      case 'sideways':
        return builder.createScalpingStrategy();
      case 'neutral':
        return builder.createDCAStrategy();
      default:
        return builder.createDCAStrategy();
    }
  },
};

// Additional interfaces for test compatibility
export interface StrategyLevel {
  percentage: number;
  multiplier: number;
  sellPercentage: number;
}

export interface StrategyPreview {
  levels: StrategyLevel[];
}

export interface BuiltStrategy {
  id: string;
  name: string;
  description?: string;
  levels: StrategyLevel[];
}

/**
 * Multi-Phase Strategy Builder Class
 */
export class MultiPhaseStrategyBuilder implements StrategyBuilder {
  private phases: PatternPhase[] = [];
  private conditions: PatternCondition[] = [];
  private riskParameters: Record<string, any> = {};
  private levels: StrategyLevel[] = [];
  private strategyId: string;
  private strategyName: string;
  private strategyDescription?: string;

  constructor(id?: string, name?: string) {
    this.strategyId = id || `strategy_${Date.now()}`;
    this.strategyName = name || "Custom Strategy";
  }

  // Original methods
  addPhase(phase: PatternPhase): StrategyBuilder;
  addPhase(percentage: number, sellPercentage: number): this;
  addPhase(phaseOrPercentage: PatternPhase | number, sellPercentage?: number): StrategyBuilder | this {
    if (typeof phaseOrPercentage === 'number') {
      this.levels.push({
        percentage: phaseOrPercentage,
        multiplier: 1 + (phaseOrPercentage / 100),
        sellPercentage: sellPercentage || 0,
      });
      return this;
    } else {
      this.phases.push(phaseOrPercentage);
      return this;
    }
  }

  // Test-compatible methods
  addPhases(phases: Array<[number, number]>): this {
    phases.forEach(([percentage, sellPercentage]) => {
      this.addPhase(percentage, sellPercentage);
    });
    return this;
  }

  withDescription(description: string): this {
    this.strategyDescription = description;
    return this;
  }

  preview(): StrategyPreview {
    return {
      levels: [...this.levels],
    };
  }

  // Pattern-based strategy builders
  createScalpingStrategy(): this {
    this.levels = [
      { percentage: 5, multiplier: 1.05, sellPercentage: 25 },
      { percentage: 10, multiplier: 1.10, sellPercentage: 25 },
      { percentage: 15, multiplier: 1.15, sellPercentage: 25 },
      { percentage: 20, multiplier: 1.20, sellPercentage: 25 },
    ];
    return this;
  }

  createDCAStrategy(): this {
    this.levels = [
      { percentage: 20, multiplier: 1.20, sellPercentage: 20 },
      { percentage: 40, multiplier: 1.40, sellPercentage: 20 },
      { percentage: 60, multiplier: 1.60, sellPercentage: 20 },
      { percentage: 80, multiplier: 1.80, sellPercentage: 20 },
      { percentage: 100, multiplier: 2.00, sellPercentage: 20 },
    ];
    return this;
  }

  addCondition(condition: PatternCondition): StrategyBuilder {
    this.conditions.push(condition);
    return this;
  }

  setRiskParameters(params: Record<string, any>): StrategyBuilder {
    this.riskParameters = { ...this.riskParameters, ...params };
    return this;
  }

  // Overloaded build method to support both interfaces
  build(): StrategyPattern & BuiltStrategy {
    return {
      id: this.strategyId,
      name: this.strategyName,
      description: this.strategyDescription || "Custom built strategy",
      phases: [...this.phases],
      conditions: [...this.conditions],
      levels: [...this.levels],
    };
  }
}

/**
 * Create a new strategy builder instance
 */
export function createStrategyBuilder(): MultiPhaseStrategyBuilder {
  return new MultiPhaseStrategyBuilder();
}

export default MultiPhaseStrategyBuilder;
