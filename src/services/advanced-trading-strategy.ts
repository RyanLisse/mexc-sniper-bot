import { type TradingStrategy, TradingStrategyManager } from "./trading-strategy-manager";

/**
 * ADVANCED TRADING STRATEGY
 *
 * Advanced features including volatility adjustments and trailing stop loss,
 * exactly matching the specification from docs/tl-systems.md
 */

// Advanced features - EXACT implementation from docs
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
    trailingPercentage = 10
  ): number {
    const profitPercentage = ((highestPrice - entryPrice) / entryPrice) * 100;

    // Only activate trailing stop after certain profit
    if (profitPercentage > 20) {
      return highestPrice * (1 - trailingPercentage / 100);
    }

    // Otherwise use fixed stop loss
    return entryPrice * 0.9; // 10% stop loss
  }

  // Get volatility-adjusted recommendations
  getVolatilityAdjustedRecommendations(
    entryPrice: number,
    currentPrice: number,
    totalAmount: number,
    volatilityIndex: number,
    originalStrategyId?: string
  ): {
    adjustedStrategy: TradingStrategy;
    recommendations: Array<{
      level: any;
      triggered: boolean;
      targetPrice: number;
      sellAmount: number;
      adjustment: number;
    }>;
    trailingStopLoss: number;
  } {
    // Store original strategy
    const originalStrategy = this.getActiveStrategy();

    // Apply volatility adjustment
    this.adjustStrategyForVolatility(volatilityIndex);
    const adjustedStrategy = this.getActiveStrategy();

    // Get adjusted recommendations
    const recommendations = this.getSellRecommendations(entryPrice, currentPrice, totalAmount);

    // Calculate highest price for trailing stop
    const highestPrice = Math.max(currentPrice, entryPrice);
    const trailingStopLoss = this.calculateTrailingStopLoss(entryPrice, highestPrice);

    // Add adjustment information to recommendations
    const adjustedRecommendations = recommendations.map((rec, index) => ({
      ...rec,
      adjustment: originalStrategy.levels[index]
        ? ((rec.level.percentage - originalStrategy.levels[index].percentage) /
            originalStrategy.levels[index].percentage) *
          100
        : 0,
    }));

    // Restore original strategy if specified
    if (originalStrategyId) {
      this.setActiveStrategy(originalStrategyId);
    }

    return {
      adjustedStrategy,
      recommendations: adjustedRecommendations,
      trailingStopLoss,
    };
  }

  // Risk assessment based on market conditions
  assessRiskLevel(
    entryPrice: number,
    currentPrice: number,
    volatilityIndex: number,
    marketTrend: "bullish" | "bearish" | "sideways"
  ): {
    riskLevel: "low" | "medium" | "high" | "extreme";
    riskScore: number;
    recommendations: string[];
    shouldAdjustStrategy: boolean;
  } {
    const priceChange = ((currentPrice - entryPrice) / entryPrice) * 100;
    let riskScore = 0;
    const recommendations: string[] = [];

    // Price movement risk
    if (Math.abs(priceChange) > 50) riskScore += 30;
    else if (Math.abs(priceChange) > 20) riskScore += 15;
    else if (Math.abs(priceChange) > 10) riskScore += 5;

    // Volatility risk
    if (volatilityIndex > 0.8) {
      riskScore += 25;
      recommendations.push("High volatility detected - consider reducing position sizes");
    } else if (volatilityIndex > 0.5) {
      riskScore += 15;
      recommendations.push("Medium volatility - monitor positions closely");
    }

    // Market trend risk
    if (marketTrend === "bearish" && priceChange > 0) {
      riskScore += 20;
      recommendations.push("Bearish trend with positive position - consider early profit taking");
    } else if (marketTrend === "sideways" && Math.abs(priceChange) > 20) {
      riskScore += 10;
      recommendations.push("Sideways market with large movement - potential reversal risk");
    }

    // Determine risk level
    let riskLevel: "low" | "medium" | "high" | "extreme";
    if (riskScore >= 70) riskLevel = "extreme";
    else if (riskScore >= 50) riskLevel = "high";
    else if (riskScore >= 25) riskLevel = "medium";
    else riskLevel = "low";

    // Strategy adjustment recommendations
    const shouldAdjustStrategy = riskScore >= 40 || volatilityIndex > 0.6;

    if (shouldAdjustStrategy) {
      recommendations.push("Consider adjusting strategy for current market conditions");
    }

    if (riskLevel === "extreme") {
      recommendations.push("EXTREME RISK: Consider emergency exit or position reduction");
    }

    return {
      riskLevel,
      riskScore,
      recommendations,
      shouldAdjustStrategy,
    };
  }

  // Advanced portfolio position sizing
  calculateOptimalPositionSize(
    accountBalance: number,
    riskPercentage: number,
    entryPrice: number,
    stopLossPrice: number,
    volatilityIndex: number
  ): {
    optimalSize: number;
    maxSize: number;
    recommendedSize: number;
    riskAmount: number;
    adjustmentFactor: number;
  } {
    const baseRiskAmount = accountBalance * (riskPercentage / 100);
    const stopLossDistance = Math.abs(entryPrice - stopLossPrice);
    const stopLossPercentage = (stopLossDistance / entryPrice) * 100;

    // Base position size
    const baseSize = baseRiskAmount / stopLossDistance;

    // Volatility adjustment
    const volatilityAdjustment = 1 - volatilityIndex * 0.3; // Reduce size in high volatility
    const adjustedSize = baseSize * volatilityAdjustment;

    // Maximum size limits
    const maxSizeByBalance = accountBalance * 0.1; // Never more than 10% of balance
    const maxSizeByRisk = baseRiskAmount / stopLossDistance;

    const maxSize = Math.min(maxSizeByBalance, maxSizeByRisk);
    const optimalSize = Math.min(adjustedSize, maxSize);

    // Conservative recommendation (further reduced)
    const recommendedSize = optimalSize * 0.8;

    return {
      optimalSize,
      maxSize,
      recommendedSize,
      riskAmount: baseRiskAmount,
      adjustmentFactor: volatilityAdjustment,
    };
  }

  // Dynamic strategy selection based on market conditions
  selectOptimalStrategy(
    volatilityIndex: number,
    marketTrend: "bullish" | "bearish" | "sideways",
    timeHorizon: "short" | "medium" | "long",
    riskTolerance: "low" | "medium" | "high"
  ): {
    recommendedStrategy: string;
    confidence: number;
    reasoning: string[];
    alternativeStrategies: string[];
  } {
    const reasoning: string[] = [];
    const alternativeStrategies: string[] = [];
    let recommendedStrategy = "normal";
    let confidence = 50;

    // Base strategy selection
    if (riskTolerance === "low" || timeHorizon === "short") {
      recommendedStrategy = "conservative";
      confidence += 20;
      reasoning.push("Conservative approach matches low risk tolerance");
      alternativeStrategies.push("scalping");
    } else if (riskTolerance === "high" && timeHorizon === "long") {
      recommendedStrategy = "diamond";
      confidence += 15;
      reasoning.push("Diamond hands strategy for high risk, long-term approach");
      alternativeStrategies.push("highPriceIncrease");
    } else if (timeHorizon === "short") {
      recommendedStrategy = "scalping";
      confidence += 15;
      reasoning.push("Scalping strategy optimal for short-term trades");
      alternativeStrategies.push("conservative");
    }

    // Market trend adjustments
    if (marketTrend === "bullish") {
      if (recommendedStrategy === "conservative") {
        recommendedStrategy = "normal";
        confidence += 10;
        reasoning.push("Bullish trend supports more aggressive strategy");
      }
      alternativeStrategies.push("highPriceIncrease");
    } else if (marketTrend === "bearish") {
      if (["diamond", "highPriceIncrease"].includes(recommendedStrategy)) {
        recommendedStrategy = "conservative";
        confidence += 15;
        reasoning.push("Bearish trend requires conservative approach");
      }
    }

    // Volatility adjustments
    if (volatilityIndex > 0.7) {
      confidence -= 10;
      reasoning.push("High volatility increases uncertainty");
      if (!alternativeStrategies.includes("conservative")) {
        alternativeStrategies.push("conservative");
      }
    } else if (volatilityIndex < 0.3) {
      confidence += 10;
      reasoning.push("Low volatility supports confident strategy selection");
    }

    // Ensure strategy exists
    if (!TRADING_STRATEGIES[recommendedStrategy]) {
      recommendedStrategy = "normal";
      confidence = 50;
      reasoning.push("Fallback to normal strategy");
    }

    return {
      recommendedStrategy,
      confidence: Math.min(100, Math.max(0, confidence)),
      reasoning,
      alternativeStrategies: alternativeStrategies.filter((s) => s !== recommendedStrategy),
    };
  }
}
