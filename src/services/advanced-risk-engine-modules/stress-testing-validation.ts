/**
 * Stress Testing & Validation Module
 *
 * Provides stress testing, scenario analysis, and risk validation functionality
 * for the Advanced Risk Engine. This module handles stress test scenarios,
 * position risk updates, and emergency detection mechanisms.
 *
 * Part of the modular refactoring of advanced-risk-engine.ts
 */

import type {
  MarketConditions,
  PositionRiskProfile,
  RiskEngineConfig,
  StressTestScenario,
} from "../../schemas/risk-engine-schemas-extracted";

export interface StressTestingConfig {
  riskConfig: RiskEngineConfig;
  marketConditions: MarketConditions;
  positions: Map<string, PositionRiskProfile>;
}

export interface StressTestResult {
  scenarios: StressTestScenario[];
  results: Array<{
    scenario: string;
    estimatedLoss: number;
    portfolioImpact: number;
    recoveryTime: number;
    riskScore: number;
  }>;
}

export interface FlashCrashDetection {
  isFlashCrash: boolean;
  severity: "low" | "medium" | "high" | "critical";
  maxDropPercent: number;
  volumeSpike: number;
}

export interface ManipulationDetection {
  manipulationScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  recommendedAction: "monitor" | "reduce_exposure" | "halt_trading";
  indicators: string[];
}

export interface LiquidityAssessment {
  tradingRecommendation: "proceed" | "caution" | "avoid";
  maxPositionSize: number;
  warnings: string[];
}

export interface StressTestScenarioResult {
  portfolioSurvival: boolean;
  maxDrawdown: number;
  emergencyActionsTriggered: number;
}

export interface PortfolioRiskCalculation {
  overallRisk: number;
  components: {
    concentrationRisk: number;
    correlationRisk: number;
    liquidityRisk: number;
    volatilityRisk: number;
  };
}

export class StressTestingValidation {
  constructor(private config: StressTestingConfig) {}

  /**
   * Perform stress testing on current portfolio
   */
  async performStressTest(scenarios?: StressTestScenario[]): Promise<StressTestResult> {
    const defaultScenarios: StressTestScenario[] = [
      {
        name: "Market Crash",
        description: "20% market decline with high volatility",
        marketShock: { priceChange: -20, volatilityIncrease: 3, liquidityReduction: 50 },
        expectedLoss: 0,
        recoveryTime: 48,
      },
      {
        name: "Flash Crash",
        description: "10% sudden drop with liquidity crisis",
        marketShock: { priceChange: -10, volatilityIncrease: 5, liquidityReduction: 80 },
        expectedLoss: 0,
        recoveryTime: 12,
      },
      {
        name: "High Volatility",
        description: "Normal prices but extreme volatility",
        marketShock: { priceChange: 0, volatilityIncrease: 4, liquidityReduction: 30 },
        expectedLoss: 0,
        recoveryTime: 24,
      },
    ];

    const testScenarios = scenarios || defaultScenarios;
    const currentPortfolioValue = this.calculatePortfolioValue();
    const results = [];

    for (const scenario of testScenarios) {
      let totalLoss = 0;

      // Calculate impact on each position
      for (const position of this.config.positions.values()) {
        const positionLoss = position.size * (scenario.marketShock.priceChange / 100);
        const volatilityImpact =
          position.valueAtRisk * (scenario.marketShock.volatilityIncrease - 1);
        totalLoss += Math.abs(positionLoss) + volatilityImpact;
      }

      const portfolioImpact = (totalLoss / currentPortfolioValue) * 100;
      const riskScore = Math.min(portfolioImpact * 2, 100); // Scale to 0-100

      results.push({
        scenario: scenario.name,
        estimatedLoss: totalLoss,
        portfolioImpact,
        recoveryTime: scenario.recoveryTime,
        riskScore,
      });
    }

    return { scenarios: testScenarios, results };
  }

  /**
   * Update position risk data
   */
  async updatePositionRisk(
    symbol: string,
    riskData: {
      currentPrice: number;
      entryPrice: number;
      positionSize: number;
      unrealizedPnL: number;
    }
  ): Promise<void> {
    try {
      const position = this.config.positions.get(symbol);
      if (!position) {
        console.warn(`[StressTestingValidation] Position ${symbol} not found for risk update`);
        return;
      }

      // Calculate metrics
      const priceChange =
        ((riskData.currentPrice - riskData.entryPrice) / riskData.entryPrice) * 100;
      const drawdown = priceChange < 0 ? Math.abs(priceChange) : 0;

      // Update position data
      position.unrealizedPnL = riskData.unrealizedPnL;
      position.size = riskData.positionSize * riskData.currentPrice;
      position.maxDrawdown = Math.max(position.maxDrawdown, drawdown);

      console.log(
        `[StressTestingValidation] Position risk updated for ${symbol}: ${drawdown.toFixed(2)}% drawdown`
      );
    } catch (error) {
      console.error("[StressTestingValidation] Position risk update failed:", error);
    }
  }

  /**
   * Detect flash crash patterns
   */
  async detectFlashCrash(
    priceSequence: Array<{
      price: number;
      volume: number;
      timestamp: number;
    }>
  ): Promise<FlashCrashDetection> {
    if (priceSequence.length < 3) {
      return {
        isFlashCrash: false,
        severity: "low",
        maxDropPercent: 0,
        volumeSpike: 0,
      };
    }

    // Calculate price drop
    const startPrice = priceSequence[0].price;
    const minPrice = Math.min(...priceSequence.map((p) => p.price));
    const maxDropPercent = ((startPrice - minPrice) / startPrice) * 100;

    // Calculate volume spike
    const avgVolume =
      priceSequence.slice(0, -1).reduce((sum, p) => sum + p.volume, 0) / (priceSequence.length - 1);
    const maxVolume = Math.max(...priceSequence.map((p) => p.volume));
    const volumeSpike = maxVolume / avgVolume;

    // Determine if it's a flash crash
    const isFlashCrash = maxDropPercent > 10 && volumeSpike > 3;

    // Determine severity
    let severity: "low" | "medium" | "high" | "critical";
    if (maxDropPercent > 30) {
      severity = "critical";
    } else if (maxDropPercent > 20) {
      severity = "high";
    } else if (maxDropPercent > 15) {
      severity = "medium";
    } else {
      severity = "low";
    }

    return {
      isFlashCrash,
      severity,
      maxDropPercent,
      volumeSpike,
    };
  }

  /**
   * Run stress test scenarios
   */
  async runStressTest(scenario: {
    scenario: string;
    priceShocks: Record<string, number>;
    marketConditions: {
      volatility: number;
      liquidityReduction: number;
      volumeSpike: number;
    };
  }): Promise<StressTestScenarioResult> {
    let maxDrawdown = 0;
    let emergencyActionsTriggered = 0;

    try {
      // Apply price shocks to each position
      for (const [symbol, shock] of Object.entries(scenario.priceShocks)) {
        const position = this.config.positions.get(symbol);
        if (position) {
          const drawdown = Math.abs(shock);
          maxDrawdown = Math.max(maxDrawdown, drawdown);

          // Trigger emergency actions if drawdown > 20%
          if (drawdown > 20) {
            emergencyActionsTriggered++;
          }
        }
      }

      // Apply market condition stress
      if (scenario.marketConditions.volatility > 0.8) {
        emergencyActionsTriggered++;
      }

      if (scenario.marketConditions.liquidityReduction > 50) {
        emergencyActionsTriggered++;
      }

      // Portfolio survives if max drawdown < 30%
      const portfolioSurvival = maxDrawdown < 30;

      return {
        portfolioSurvival,
        maxDrawdown,
        emergencyActionsTriggered,
      };
    } catch (error) {
      console.error("[StressTestingValidation] Stress test failed:", error);
      return {
        portfolioSurvival: false,
        maxDrawdown: 100,
        emergencyActionsTriggered: 10,
      };
    }
  }

  /**
   * Assess liquidity risk
   */
  async assessLiquidityRisk(conditions: {
    orderBook: {
      bids: number[][];
      asks: number[][];
      depth: number;
      spread: number;
    };
    recentVolume: number;
    marketMakerActivity: string;
    slippageRisk: number;
  }): Promise<LiquidityAssessment> {
    const warnings: string[] = [];
    let tradingRecommendation: "proceed" | "caution" | "avoid" = "proceed";
    let maxPositionSize = this.config.riskConfig.maxSinglePositionSize;

    // Check spread
    if (conditions.orderBook.spread > 0.2) {
      // 20% spread
      warnings.push("extreme_illiquidity");
      tradingRecommendation = "avoid";
      maxPositionSize = 0;
    } else if (conditions.orderBook.spread > 0.1) {
      // 10% spread
      warnings.push("high_spread");
      tradingRecommendation = "caution";
      maxPositionSize *= 0.3;
    }

    // Check market depth
    if (conditions.orderBook.depth < 500) {
      warnings.push("thin_orderbook");
      maxPositionSize *= 0.5;
    }

    // Check volume
    if (conditions.recentVolume < 100000) {
      warnings.push("low_volume");
      maxPositionSize *= 0.7;
    }

    // Check market maker activity
    if (conditions.marketMakerActivity === "absent") {
      warnings.push("no_market_makers");
      tradingRecommendation = "avoid";
      maxPositionSize = Math.min(maxPositionSize, 100);
    }

    return {
      tradingRecommendation,
      maxPositionSize,
      warnings,
    };
  }

  /**
   * Detect manipulation patterns
   */
  async detectManipulation(activity: {
    rapidPriceMovement: number;
    volumeAnomaly: number;
    orderBookManipulation: boolean;
    crossExchangeDeviation: number;
    coordinatedTrading: boolean;
  }): Promise<ManipulationDetection> {
    const indicators: string[] = [];
    let manipulationScore = 0;

    // Check rapid price movement
    if (activity.rapidPriceMovement > 100) {
      manipulationScore += 0.3;
      indicators.push("coordinated_pump");
    }

    // Check volume anomaly
    if (activity.volumeAnomaly > 30) {
      manipulationScore += 0.2;
      indicators.push("volume_manipulation");
    }

    // Check order book manipulation
    if (activity.orderBookManipulation) {
      manipulationScore += 0.2;
      indicators.push("order_book_spoofing");
    }

    // Check cross-exchange deviation
    if (activity.crossExchangeDeviation > 15) {
      manipulationScore += 0.2;
      indicators.push("cross_exchange_arbitrage");
    }

    // Check coordinated trading
    if (activity.coordinatedTrading) {
      manipulationScore += 0.1;
      indicators.push("coordinated_activity");
    }

    // Determine risk level
    let riskLevel: "low" | "medium" | "high" | "critical";
    let recommendedAction: "monitor" | "reduce_exposure" | "halt_trading";

    if (manipulationScore > 0.8) {
      riskLevel = "critical";
      recommendedAction = "halt_trading";
    } else if (manipulationScore > 0.6) {
      riskLevel = "high";
      recommendedAction = "reduce_exposure";
    } else if (manipulationScore > 0.3) {
      riskLevel = "medium";
      recommendedAction = "monitor";
    } else {
      riskLevel = "low";
      recommendedAction = "monitor";
    }

    return {
      manipulationScore,
      riskLevel,
      recommendedAction,
      indicators,
    };
  }

  /**
   * Validate trade against all risk criteria
   */
  async validateTrade(options: {
    symbol: string;
    price: number;
    amount: number;
    side: string;
  }): Promise<{
    approved: boolean;
    riskScore: number;
    warnings: string[];
  }> {
    // This would integrate with the core risk assessment module
    // For now, provide a basic implementation
    const tradeValue = options.price * options.amount;
    const portfolioValue = this.calculatePortfolioValue();
    const positionRatio = tradeValue / portfolioValue;

    let riskScore = positionRatio * 100;
    const warnings: string[] = [];

    // Apply market conditions
    const volatilityRisk = this.config.marketConditions.volatilityIndex;
    const liquidityRisk = 100 - this.config.marketConditions.liquidityIndex;

    riskScore += volatilityRisk * 0.3;
    riskScore += liquidityRisk * 0.2;

    if (riskScore > 75) {
      warnings.push("High risk trade");
    }

    if (positionRatio > 0.1) {
      warnings.push("Large position size");
    }

    return {
      approved: riskScore < 75,
      riskScore: Math.min(riskScore, 100),
      warnings,
    };
  }

  /**
   * Calculate overall portfolio risk
   */
  async calculatePortfolioRisk(): Promise<PortfolioRiskCalculation> {
    const positions = Array.from(this.config.positions.values());
    const totalValue = positions.reduce((sum, p) => sum + p.size, 0);

    // Calculate concentration risk
    const maxPosition = positions.length > 0 ? Math.max(...positions.map((p) => p.size)) : 0;
    const concentrationRisk = totalValue > 0 ? (maxPosition / totalValue) * 100 : 0;

    // Calculate correlation risk (simplified)
    const correlationRisk =
      positions.length > 0
        ? (positions.reduce((sum, p) => sum + p.correlationScore, 0) / positions.length) * 100
        : 0;

    // Calculate liquidity risk
    const liquidityRisk = Math.max(0, 100 - this.config.marketConditions.liquidityIndex);

    // Calculate volatility risk
    const volatilityRisk = this.config.marketConditions.volatilityIndex;

    // Overall risk (weighted average)
    const overallRisk =
      concentrationRisk * 0.3 + correlationRisk * 0.3 + liquidityRisk * 0.2 + volatilityRisk * 0.2;

    return {
      overallRisk,
      components: {
        concentrationRisk,
        correlationRisk,
        liquidityRisk,
        volatilityRisk,
      },
    };
  }

  /**
   * Calculate portfolio value
   */
  private calculatePortfolioValue(): number {
    return Array.from(this.config.positions.values()).reduce((total, pos) => total + pos.size, 0);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<StressTestingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Factory function for creating stress testing validation instance
export function createStressTestingValidation(
  config: StressTestingConfig
): StressTestingValidation {
  return new StressTestingValidation(config);
}

// Export types for external use
export type {
  StressTestingConfig,
  StressTestResult,
  FlashCrashDetection,
  ManipulationDetection,
  LiquidityAssessment,
  StressTestScenarioResult,
  PortfolioRiskCalculation,
};
