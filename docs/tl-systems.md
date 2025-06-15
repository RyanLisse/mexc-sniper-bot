import { z } from 'zod';

/**
 * MULTI-PHASE TAKE PROFIT TRADING STRATEGIES
 * 
 * Deze implementatie gebruikt "Multiple Phases" strategie waarbij je positie
 * in meerdere fases verkocht wordt bij verschillende winstniveaus.
 * 
 * Voordelen van Multi-Phase:
 * - Verzeker winsten geleidelijk terwijl de prijs stijgt
 * - Behoud exposure voor mogelijke hogere winsten
 * - Verminder risico door gedeeltelijke verkopen
 * - Flexibele aanpassing aan marktomstandigheden
 */

// Zod schemas voor type safety
const PriceMultiplierSchema = z.object({
  percentage: z.number().min(0),
  multiplier: z.number().min(1),
  sellPercentage: z.number().min(0).max(100),
});

const TradingStrategySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  levels: z.array(PriceMultiplierSchema),
});

// Type definitions
export type PriceMultiplier = z.infer<typeof PriceMultiplierSchema>;
export type TradingStrategy = z.infer<typeof TradingStrategySchema>;

// Multi-Phase Take Profit Strategy configurations
export const TRADING_STRATEGIES: Record<string, TradingStrategy> = {
  normal: {
    id: 'normal',
    name: 'Normal Multi-Phase Strategy',
    description: 'Standaard multi-phase strategie met 4 exit punten',
    levels: [
      { percentage: 50, multiplier: 1.5, sellPercentage: 25 },   // Phase 1: 25% @ +50%
      { percentage: 100, multiplier: 2.0, sellPercentage: 25 },  // Phase 2: 25% @ +100%
      { percentage: 125, multiplier: 2.25, sellPercentage: 20 }, // Phase 3: 20% @ +125%
      { percentage: 175, multiplier: 2.75, sellPercentage: 10 }, // Phase 4: 10% @ +175%
      // Remaining 20% holds for moonshot potential
    ],
  },
  highPriceIncrease: {
    id: 'high-price-increase',
    name: 'Aggressive Multi-Phase Strategy',
    description: 'Agressieve multi-phase strategie voor hogere targets',
    levels: [
      { percentage: 100, multiplier: 2.0, sellPercentage: 15 },  // Phase 1: 15% @ +100%
      { percentage: 150, multiplier: 2.5, sellPercentage: 15 },  // Phase 2: 15% @ +150%
      { percentage: 200, multiplier: 3.0, sellPercentage: 25 },  // Phase 3: 25% @ +200%
      { percentage: 300, multiplier: 4.0, sellPercentage: 25 },  // Phase 4: 25% @ +300%
      // Remaining 20% holds for extreme gains
    ],
  },
  conservative: {
    id: 'conservative',
    name: 'Conservative Multi-Phase Strategy',
    description: 'Voorzichtige strategie met vroege winst-taking',
    levels: [
      { percentage: 10, multiplier: 1.1, sellPercentage: 30 },   // Phase 1: 30% @ +10%
      { percentage: 20, multiplier: 1.2, sellPercentage: 40 },   // Phase 2: 40% @ +20%
      { percentage: 30, multiplier: 1.3, sellPercentage: 30 },   // Phase 3: 30% @ +30%
    ],
  },
  scalping: {
    id: 'scalping',
    name: 'Scalping Multi-Phase Strategy',
    description: 'Snelle winsten met kleine targets',
    levels: [
      { percentage: 5, multiplier: 1.05, sellPercentage: 20 },   // Phase 1: 20% @ +5%
      { percentage: 10, multiplier: 1.1, sellPercentage: 30 },   // Phase 2: 30% @ +10%
      { percentage: 15, multiplier: 1.15, sellPercentage: 30 },  // Phase 3: 30% @ +15%
      { percentage: 20, multiplier: 1.2, sellPercentage: 20 },   // Phase 4: 20% @ +20%
    ],
  },
  diamond: {
    id: 'diamond',
    name: 'Diamond Hands Multi-Phase Strategy',
    description: 'Voor lange termijn holds met hoge targets',
    levels: [
      { percentage: 200, multiplier: 3.0, sellPercentage: 10 },   // Phase 1: 10% @ +200%
      { percentage: 500, multiplier: 6.0, sellPercentage: 20 },   // Phase 2: 20% @ +500%
      { percentage: 1000, multiplier: 11.0, sellPercentage: 30 }, // Phase 3: 30% @ +1000%
      { percentage: 2000, multiplier: 21.0, sellPercentage: 20 }, // Phase 4: 20% @ +2000%
      // Remaining 20% for absolute moonshot
    ],
  },
};

// Strategy manager class
export class TradingStrategyManager {
  private strategies: Map<string, TradingStrategy>;
  private activeStrategy: TradingStrategy;

  constructor(initialStrategy: string = 'normal') {
    this.strategies = new Map(Object.entries(TRADING_STRATEGIES));
    this.activeStrategy = this.strategies.get(initialStrategy) || TRADING_STRATEGIES.normal;
  }

  // Get active strategy
  getActiveStrategy(): TradingStrategy {
    return this.activeStrategy;
  }

  // Switch to different strategy
  setActiveStrategy(strategyId: string): boolean {
    const strategy = this.strategies.get(strategyId);
    if (strategy) {
      this.activeStrategy = strategy;
      return true;
    }
    return false;
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
    const recommendations = this.getSellRecommendations(entryPrice, currentPrice, totalAmount);
    
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

  // Export strategy to JSON
  exportStrategy(strategyId: string): string | null {
    const strategy = this.strategies.get(strategyId);
    return strategy ? JSON.stringify(strategy, null, 2) : null;
  }

  // Import strategy from JSON
  importStrategy(jsonString: string): boolean {
    try {
      const strategy = TradingStrategySchema.parse(JSON.parse(jsonString));
      this.addStrategy(strategy);
      return true;
    } catch {
      return false;
    }
  }
}

// Multi-Phase Execution Tracker
export class MultiPhaseExecutor {
  private executedPhases: Set<number> = new Set();
  private phaseHistory: Array<{
    phase: number;
    price: number;
    amount: number;
    profit: number;
    timestamp: Date;
  }> = [];

  constructor(private strategy: TradingStrategy) {}

  // Execute phases based on current price
  executePhases(
    entryPrice: number,
    currentPrice: number,
    totalAmount: number
  ): {
    phasesToExecute: Array<{
      phase: number;
      level: PriceMultiplier;
      amount: number;
      expectedProfit: number;
    }>;
    summary: {
      totalSold: number;
      totalRemaining: number;
      realizedProfit: number;
      unrealizedProfit: number;
      completedPhases: number;
      nextPhaseTarget: number | null;
    };
  } {
    const priceIncrease = ((currentPrice - entryPrice) / entryPrice) * 100;
    const phasesToExecute: Array<{
      phase: number;
      level: PriceMultiplier;
      amount: number;
      expectedProfit: number;
    }> = [];

    // Check which phases should be executed
    this.strategy.levels.forEach((level, index) => {
      const phaseNumber = index + 1;
      if (priceIncrease >= level.percentage && !this.executedPhases.has(phaseNumber)) {
        const amount = (totalAmount * level.sellPercentage) / 100;
        const targetPrice = entryPrice * level.multiplier;
        const expectedProfit = amount * (targetPrice - entryPrice);

        phasesToExecute.push({
          phase: phaseNumber,
          level,
          amount,
          expectedProfit,
        });
      }
    });

    // Calculate summary
    const totalSold = Array.from(this.executedPhases).reduce((sum, phaseNum) => {
      const level = this.strategy.levels[phaseNum - 1];
      return sum + (totalAmount * level.sellPercentage) / 100;
    }, 0);

    const totalRemaining = totalAmount - totalSold;
    const realizedProfit = this.phaseHistory.reduce((sum, phase) => sum + phase.profit, 0);
    const unrealizedProfit = totalRemaining * (currentPrice - entryPrice);

    // Find next phase target
    let nextPhaseTarget: number | null = null;
    for (let i = 0; i < this.strategy.levels.length; i++) {
      if (!this.executedPhases.has(i + 1)) {
        nextPhaseTarget = entryPrice * this.strategy.levels[i].multiplier;
        break;
      }
    }

    return {
      phasesToExecute,
      summary: {
        totalSold,
        totalRemaining,
        realizedProfit,
        unrealizedProfit,
        completedPhases: this.executedPhases.size,
        nextPhaseTarget,
      },
    };
  }

  // Record phase execution
  recordPhaseExecution(
    phaseNumber: number,
    price: number,
    amount: number,
    profit: number
  ): void {
    this.executedPhases.add(phaseNumber);
    this.phaseHistory.push({
      phase: phaseNumber,
      price,
      amount,
      profit,
      timestamp: new Date(),
    });
  }

  // Get phase execution status
  getPhaseStatus(): {
    totalPhases: number;
    completedPhases: number;
    pendingPhases: number;
    phaseDetails: Array<{
      phase: number;
      target: string;
      percentage: number;
      sellAmount: number;
      status: 'completed' | 'pending';
    }>;
  } {
    const totalPhases = this.strategy.levels.length;
    const completedPhases = this.executedPhases.size;

    const phaseDetails = this.strategy.levels.map((level, index) => {
      const phaseNumber = index + 1;
      return {
        phase: phaseNumber,
        target: `+${level.percentage}% (${level.multiplier}x)`,
        percentage: level.sellPercentage,
        sellAmount: level.sellPercentage,
        status: this.executedPhases.has(phaseNumber) ? 'completed' : 'pending' as const,
      };
    });

    return {
      totalPhases,
      completedPhases,
      pendingPhases: totalPhases - completedPhases,
      phaseDetails,
    };
  }

  // Visual representation of phases
  getPhaseVisualization(currentPricePercentage: number): string {
    const phases = this.strategy.levels.map((level, index) => {
      const phaseNum = index + 1;
      const isExecuted = this.executedPhases.has(phaseNum);
      const isNext = !isExecuted && currentPricePercentage < level.percentage;
      
      let status = '⬜'; // Pending
      if (isExecuted) status = '✅'; // Completed
      else if (isNext) status = '🎯'; // Next target

      return `${status} Phase ${phaseNum}: ${level.sellPercentage}% @ +${level.percentage}%`;
    });

    return phases.join('\n');
  }
}

// Advanced features
export class AdvancedTradingStrategy extends TradingStrategyManager {
  // Dynamic adjustment based on market conditions
  adjustStrategyForVolatility(volatilityIndex: number): void {
    const strategy = this.getActiveStrategy();
    const adjustedLevels = strategy.levels.map((level) => ({
      ...level,
      // Increase targets in high volatility
      percentage: level.percentage * (1 + volatilityIndex * 0.1),
      // Decrease sell percentage to hold more
      sellPercentage: level.sellPercentage * (1 - volatilityIndex * 0.1),
    }));

    this.addStrategy({
      ...strategy,
      id: `${strategy.id}-adjusted`,
      name: `${strategy.name} (Volatility Adjusted)`,
      levels: adjustedLevels,
    });

    this.setActiveStrategy(`${strategy.id}-adjusted`);
  }

  // Trailing stop loss integration
  calculateTrailingStopLoss(
    entryPrice: number,
    highestPrice: number,
    trailingPercentage: number = 10
  ): number {
    const profitPercentage = ((highestPrice - entryPrice) / entryPrice) * 100;
    
    // Only activate trailing stop after certain profit
    if (profitPercentage > 20) {
      return highestPrice * (1 - trailingPercentage / 100);
    }
    
    // Otherwise use fixed stop loss
    return entryPrice * 0.9; // 10% stop loss
  }
}

// Real-time Multi-Phase Example
export class MultiPhaseTradingBot {
  private executor: MultiPhaseExecutor;
  private entryPrice: number;
  private position: number;

  constructor(
    strategy: TradingStrategy,
    entryPrice: number,
    position: number
  ) {
    this.executor = new MultiPhaseExecutor(strategy);
    this.entryPrice = entryPrice;
    this.position = position;
  }

  // Process price update and execute phases
  onPriceUpdate(currentPrice: number): {
    actions: string[];
    status: any;
  } {
    const actions: string[] = [];
    const execution = this.executor.executePhases(
      this.entryPrice,
      currentPrice,
      this.position
    );

    // Execute pending phases
    execution.phasesToExecute.forEach((phase) => {
      actions.push(
        `🎯 EXECUTE Phase ${phase.phase}: Sell ${phase.amount} units ` +
        `@ ${phase.level.multiplier}x for ${phase.expectedProfit.toFixed(2)} profit`
      );
      
      // Record execution
      this.executor.recordPhaseExecution(
        phase.phase,
        currentPrice,
        phase.amount,
        phase.expectedProfit
      );
    });

    // Get current status
    const priceIncreasePercent = ((currentPrice - this.entryPrice) / this.entryPrice) * 100;
    const phaseStatus = this.executor.getPhaseStatus();
    const visualization = this.executor.getPhaseVisualization(priceIncreasePercent);

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
          : 'All phases completed',
      },
    };
  }
}

// Example: Real-world multi-phase execution
export function demonstrateMultiPhaseStrategy() {
  console.log('=== Multi-Phase Trading Strategy Demo ===\n');

  // Create bot with conservative strategy
  const bot = new MultiPhaseTradingBot(
    TRADING_STRATEGIES.conservative,
    100, // Entry at $100
    1000 // 1000 tokens
  );

  // Simulate price movements
  const priceMovements = [
    { price: 105, description: 'Small pump +5%' },
    { price: 112, description: 'Momentum building +12%' },
    { price: 122, description: 'Breaking out +22%' },
    { price: 135, description: 'Strong rally +35%' },
    { price: 128, description: 'Small pullback +28%' },
  ];

  priceMovements.forEach(({ price, description }) => {
    console.log(`\n📊 Price Update: ${price} - ${description}`);
    const result = bot.onPriceUpdate(price);
    
    // Show actions
    if (result.actions.length > 0) {
      console.log('\n🚨 ACTIONS:');
      result.actions.forEach(action => console.log(action));
    }
    
    // Show status
    console.log('\n📈 Portfolio Status:');
    console.log(`- Price increase: ${result.status.priceIncrease}`);
    console.log(`- Completed phases: ${result.status.summary.completedPhases}`);
    console.log(`- Remaining position: ${result.status.summary.totalRemaining} tokens`);
    console.log(`- Realized profit: ${result.status.summary.realizedProfit.toFixed(2)}`);
    console.log(`- Unrealized profit: ${result.status.summary.unrealizedProfit.toFixed(2)}`);
    console.log(`- Next target: ${result.status.nextTarget}`);
    
    console.log('\n📋 Phase Overview:');
    console.log(result.status.visualization);
  });
}

// Custom multi-phase strategy builder
export class MultiPhaseStrategyBuilder {
  private levels: PriceMultiplier[] = [];
  private id: string;
  private name: string;
  private description: string = '';

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  // Add a phase
  addPhase(
    targetPercentage: number,
    sellPercentage: number
  ): MultiPhaseStrategyBuilder {
    const multiplier = 1 + targetPercentage / 100;
    this.levels.push({
      percentage: targetPercentage,
      multiplier,
      sellPercentage,
    });
    return this;
  }

  // Set description
  withDescription(description: string): MultiPhaseStrategyBuilder {
    this.description = description;
    return this;
  }

  // Validate and build
  build(): TradingStrategy {
    // Validate total sell percentage doesn't exceed 100%
    const totalSellPercentage = this.levels.reduce(
      (sum, level) => sum + level.sellPercentage,
      0
    );

    if (totalSellPercentage > 100) {
      throw new Error(
        `Total sell percentage (${totalSellPercentage}%) exceeds 100%`
      );
    }

    // Sort levels by percentage
    this.levels.sort((a, b) => a.percentage - b.percentage);

    return TradingStrategySchema.parse({
      id: this.id,
      name: this.name,
      description: this.description,
      levels: this.levels,
    });
  }
}

// Example: Create custom multi-phase strategy
export function createCustomStrategy() {
  const customStrategy = new MultiPhaseStrategyBuilder(
    'custom-balanced',
    'Custom Balanced Multi-Phase'
  )
    .withDescription('Balanced approach with 5 phases')
    .addPhase(25, 15)   // Phase 1: 15% @ +25%
    .addPhase(50, 20)   // Phase 2: 20% @ +50%
    .addPhase(100, 25)  // Phase 3: 25% @ +100%
    .addPhase(200, 20)  // Phase 4: 20% @ +200%
    .addPhase(500, 10)  // Phase 5: 10% @ +500%
    .build();           // Remaining 10% for extreme gains

  return customStrategy;
}

/**
 * QUICK START GUIDE - Multi-Phase Trading
 * 
 * 1. Kies een strategie:
 *    - Conservative: Vroege winsten (10%, 20%, 30%)
 *    - Normal: Gebalanceerd (50%, 100%, 125%, 175%)
 *    - Aggressive: Hoge targets (100%, 150%, 200%, 300%)
 *    - Diamond: Extreme holds (200%, 500%, 1000%, 2000%)
 * 
 * 2. Initialiseer de bot:
 *    const bot = new MultiPhaseTradingBot(
 *      TRADING_STRATEGIES.normal,
 *      entryPrice,
 *      positionSize
 *    );
 * 
 * 3. Update bij prijsveranderingen:
 *    const result = bot.onPriceUpdate(currentPrice);
 *    // Execute result.actions
 * 
 * 4. Of bouw je eigen strategie:
 *    const custom = new MultiPhaseStrategyBuilder('my-strategy', 'My Strategy')
 *      .addPhase(10, 20)  // 20% verkopen bij +10%
 *      .addPhase(25, 30)  // 30% verkopen bij +25%
 *      .addPhase(50, 30)  // 30% verkopen bij +50%
 *      .addPhase(100, 20) // 20% verkopen bij +100%
 *      .build();
 */