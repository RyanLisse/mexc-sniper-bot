/**
 * Core Risk Assessment Module
 * 
 * Provides core risk calculation functionality for the Advanced Risk Engine.
 * This module handles the primary risk assessment logic including trade risk
 * evaluation, position size calculations, and composite risk scoring.
 * 
 * Part of the modular refactoring of advanced-risk-engine.ts
 */

import type { TradeRiskAssessment } from "../../mexc-agents/risk-manager-agent";
import type { 
  MarketConditions, 
  PositionRiskProfile, 
  RiskEngineConfig 
} from "../../schemas/risk-engine-schemas-extracted";

export interface CoreRiskAssessmentConfig {
  riskConfig: RiskEngineConfig;
  marketConditions: MarketConditions;
  positions: Map<string, PositionRiskProfile>;
}

export interface AdvancedRiskMetrics {
  positionSizeRisk: number;
  concentrationRisk: number;
  correlationRisk: number;
  marketRisk: number;
  liquidityRisk: number;
  volatilityAdjustment: number;
  liquidityAdjustment: number;
  sentimentAdjustment: number;
  valueAtRisk: number;
  expectedShortfall: number;
}

export interface TradeRiskResult extends TradeRiskAssessment {
  advancedMetrics: AdvancedRiskMetrics;
}

export class CoreRiskAssessment {
  constructor(private config: CoreRiskAssessmentConfig) {}

  /**
   * Perform comprehensive risk assessment for a potential trade
   */
  async assessTradeRisk(
    symbol: string,
    _side: "buy" | "sell",
    quantity: number,
    price: number,
    marketData?: Record<string, unknown>
  ): Promise<TradeRiskResult> {
    const tradeValue = quantity * price;
    const currentPortfolioValue = this.calculatePortfolioValue();

    // Calculate base risk metrics
    const positionSizeRisk = this.calculatePositionSizeRisk(tradeValue);
    const concentrationRisk = this.calculateConcentrationRisk(symbol, tradeValue);
    const correlationRisk = this.calculateCorrelationRisk(symbol, tradeValue);
    const marketRisk = this.calculateMarketRisk(symbol, marketData);
    const liquidityRisk = this.calculateLiquidityRisk(symbol, quantity);

    // Calculate portfolio impact
    const newPortfolioValue = currentPortfolioValue + tradeValue;
    const portfolioImpact = (tradeValue / newPortfolioValue) * 100;

    // Dynamic risk adjustments based on market conditions
    const volatilityAdjustment = this.getVolatilityAdjustment();
    const liquidityAdjustment = this.getLiquidityAdjustment();
    const sentimentAdjustment = this.getSentimentAdjustment();

    // Calculate composite risk score (0-100)
    let riskScore = 0;
    riskScore += positionSizeRisk * 0.25; // 25% weight
    riskScore += concentrationRisk * 0.2; // 20% weight
    riskScore += correlationRisk * 0.15; // 15% weight
    riskScore += marketRisk * 0.2; // 20% weight
    riskScore += liquidityRisk * 0.1; // 10% weight
    riskScore += portfolioImpact * 0.1; // 10% weight

    // Apply dynamic adjustments
    riskScore *= volatilityAdjustment;
    riskScore *= liquidityAdjustment;
    riskScore *= sentimentAdjustment;

    // Cap risk score at 100
    riskScore = Math.min(riskScore, 100);

    // Calculate maximum allowed size
    const maxAllowedSize = this.calculateMaxAllowedSize(symbol, riskScore);

    // Generate recommendations and warnings
    const { reasons, warnings } = this.generateRiskAssessment(
      riskScore,
      positionSizeRisk,
      concentrationRisk,
      marketRisk
    );

    // Determine approval based on risk score and limits
    const approved = this.shouldApproveTradeRisk(riskScore, tradeValue, maxAllowedSize);

    return {
      approved,
      riskScore: Math.round(riskScore * 100) / 100,
      reasons,
      warnings,
      maxAllowedSize,
      estimatedImpact: {
        newExposure: newPortfolioValue,
        riskIncrease: ((newPortfolioValue - currentPortfolioValue) / currentPortfolioValue) * 100,
        portfolioImpact,
      },
      advancedMetrics: {
        positionSizeRisk,
        concentrationRisk,
        correlationRisk,
        marketRisk,
        liquidityRisk,
        volatilityAdjustment,
        liquidityAdjustment,
        sentimentAdjustment,
        valueAtRisk: this.calculateTradeVaR(tradeValue, symbol),
        expectedShortfall: this.calculateTradeExpectedShortfall(tradeValue, symbol),
      },
    };
  }

  /**
   * Calculate position size risk based on trade value
   */
  private calculatePositionSizeRisk(tradeValue: number): number {
    const sizeRatio = tradeValue / this.config.riskConfig.maxSinglePositionSize;
    return Math.min(sizeRatio * 100, 100);
  }

  /**
   * Calculate concentration risk for the portfolio
   */
  private calculateConcentrationRisk(_symbol: string, tradeValue: number): number {
    const portfolioValue = this.calculatePortfolioValue();
    const concentrationRatio = tradeValue / portfolioValue;
    return Math.min(concentrationRatio * 200, 100); // Scale up concentration risk
  }

  /**
   * Calculate correlation risk with existing positions
   */
  private calculateCorrelationRisk(_symbol: string, _tradeValue: number): number {
    // For now, use market correlation risk
    // In production, would calculate actual position correlations
    return this.config.marketConditions.correlationRisk * 100;
  }

  /**
   * Calculate market risk based on current conditions
   */
  private calculateMarketRisk(_symbol: string, _marketData?: Record<string, unknown>): number {
    let risk = this.config.marketConditions.volatilityIndex;

    // Adjust for market sentiment
    if (this.config.marketConditions.marketSentiment === "volatile") {
      risk *= 1.3;
    } else if (this.config.marketConditions.marketSentiment === "bearish") {
      risk *= 1.1;
    }

    return Math.min(risk, 100);
  }

  /**
   * Calculate liquidity risk for the trade
   */
  private calculateLiquidityRisk(_symbol: string, _quantity: number): number {
    const liquidityScore = this.config.marketConditions.liquidityIndex;
    return Math.max(0, 100 - liquidityScore);
  }

  /**
   * Calculate total portfolio value
   */
  private calculatePortfolioValue(): number {
    return Array.from(this.config.positions.values()).reduce((total, pos) => total + pos.size, 0);
  }

  /**
   * Get volatility adjustment factor
   */
  private getVolatilityAdjustment(): number {
    const volatility = this.config.marketConditions.volatilityIndex / 100;
    return 1 + (volatility * this.config.riskConfig.volatilityMultiplier - 1);
  }

  /**
   * Get liquidity adjustment factor
   */
  private getLiquidityAdjustment(): number {
    const liquidity = this.config.marketConditions.liquidityIndex / 100;
    return 1 + (1 - liquidity) * 0.5; // Up to 50% increase for low liquidity
  }

  /**
   * Get sentiment adjustment factor
   */
  private getSentimentAdjustment(): number {
    switch (this.config.marketConditions.marketSentiment) {
      case "volatile":
        return 1.4;
      case "bearish":
        return 1.2;
      case "bullish":
        return 0.9;
      default:
        return 1.0;
    }
  }

  /**
   * Calculate maximum allowed position size
   */
  private calculateMaxAllowedSize(_symbol: string, riskScore: number): number {
    let baseSize = this.config.riskConfig.maxSinglePositionSize;

    // Reduce size based on risk score
    if (riskScore > 70) {
      baseSize *= 0.5; // 50% reduction for high risk
    } else if (riskScore > 50) {
      baseSize *= 0.7; // 30% reduction for medium risk
    } else if (riskScore > 30) {
      baseSize *= 0.9; // 10% reduction for low-medium risk
    }

    // Consider remaining portfolio capacity
    const portfolioValue = this.calculatePortfolioValue();
    const remainingCapacity = this.config.riskConfig.maxPortfolioValue - portfolioValue;

    return Math.min(baseSize, remainingCapacity);
  }

  /**
   * Generate risk assessment reasons and warnings
   */
  private generateRiskAssessment(
    riskScore: number,
    positionSizeRisk: number,
    concentrationRisk: number,
    marketRisk: number
  ): { reasons: string[]; warnings: string[] } {
    const reasons: string[] = [];
    const warnings: string[] = [];

    if (riskScore > 80) {
      reasons.push("Very high risk score - recommend avoiding this trade");
    } else if (riskScore > 60) {
      reasons.push("High risk score - consider reducing position size");
    } else if (riskScore > 40) {
      warnings.push("Moderate risk - monitor position carefully");
    }

    if (positionSizeRisk > 50) {
      warnings.push("Large position size relative to limits");
    }

    if (concentrationRisk > 60) {
      warnings.push("High portfolio concentration risk");
    }

    if (marketRisk > 70) {
      warnings.push("Elevated market volatility detected");
    }

    return { reasons, warnings };
  }

  /**
   * Determine if trade should be approved
   */
  private shouldApproveTradeRisk(
    riskScore: number,
    tradeValue: number,
    maxAllowedSize: number
  ): boolean {
    // Reject if risk score is too high
    if (riskScore > 75) return false;

    // Reject if trade size exceeds maximum allowed
    if (tradeValue > maxAllowedSize) return false;

    // Reject if portfolio would exceed limits
    const portfolioValue = this.calculatePortfolioValue();
    if (portfolioValue + tradeValue > this.config.riskConfig.maxPortfolioValue) return false;

    return true;
  }

  /**
   * Calculate Value at Risk for a trade
   */
  private calculateTradeVaR(tradeValue: number, _symbol: string): number {
    const volatility = this.config.marketConditions.volatilityIndex / 100;
    const confidenceMultiplier = this.config.riskConfig.confidenceLevel === 0.95 ? 1.645 : 1.96;
    return tradeValue * volatility * confidenceMultiplier;
  }

  /**
   * Calculate Expected Shortfall for a trade
   */
  private calculateTradeExpectedShortfall(tradeValue: number, symbol: string): number {
    const var95 = this.calculateTradeVaR(tradeValue, symbol);
    return var95 * 1.3; // Typical ES/VaR ratio
  }

  /**
   * Calculate current portfolio risk score
   */
  calculateCurrentRiskScore(): number {
    const portfolioValue = this.calculatePortfolioValue();
    if (portfolioValue === 0) return 0;

    let score = 0;

    // Portfolio size risk (25% weight)
    score += (portfolioValue / this.config.riskConfig.maxPortfolioValue) * 25;

    // Market risk (40% weight)
    score += (this.config.marketConditions.volatilityIndex / 100) * 40;

    // Liquidity risk (20% weight)
    score += (1 - this.config.marketConditions.liquidityIndex / 100) * 20;

    // Note: Alert risk calculation would be handled by the event management module
    // For now, we'll skip that component to keep this module focused

    return Math.min(score, 100);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CoreRiskAssessmentConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Factory function for creating core risk assessment instance
export function createCoreRiskAssessment(config: CoreRiskAssessmentConfig): CoreRiskAssessment {
  return new CoreRiskAssessment(config);
}

// Export types for external use
export type { CoreRiskAssessmentConfig, AdvancedRiskMetrics, TradeRiskResult };