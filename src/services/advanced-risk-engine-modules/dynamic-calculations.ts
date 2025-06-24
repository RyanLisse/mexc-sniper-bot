/**
 * Dynamic Calculations Module
 *
 * Provides dynamic calculation functionality for stop-loss, take-profit,
 * position sizing, and volatility adjustments for the Advanced Risk Engine.
 * This module handles adaptive risk calculations based on market conditions.
 *
 * Part of the modular refactoring of advanced-risk-engine.ts
 */

import type {
  MarketConditions,
  PositionRiskProfile,
  RiskEngineConfig,
} from "../../schemas/risk-engine-schemas-extracted";

export interface DynamicCalculationsConfig {
  riskConfig: RiskEngineConfig;
  marketConditions: MarketConditions;
  positions: Map<string, PositionRiskProfile>;
}

export interface StopLossRecommendation {
  stopLossPrice: number;
  reasoning: string;
}

export interface TakeProfitRecommendation {
  takeProfitPrice: number;
  reasoning: string;
}

export interface PositionSizeValidation {
  approved: boolean;
  adjustedPositionSize: number;
  positionSizeRatio: number;
  rejectionReason?: string;
  adjustmentReason?: string;
  warnings: string[];
}

export interface VolatilityAdjustment {
  adjustedSize: number;
  volatilityReduction: number;
  reasoning: string;
}

export interface StopLossValidation {
  isValid: boolean;
  issues: string[];
  recommendedStopLoss?: number;
}

export interface DiversificationAssessment {
  concentrationRisk: "low" | "medium" | "high";
  recommendedMaxPosition: number;
  warnings: string[];
  diversificationScore: number;
}

export class DynamicCalculations {
  private _logger?: { info: (message: string, context?: any) => void; warn: (message: string, context?: any) => void; error: (message: string, context?: any, error?: Error) => void; debug: (message: string, context?: any) => void; };
  private get logger() {
    if (!this._logger) {
      this._logger = {
      info: (message: string, context?: any) => console.info('[dynamic-calculations]', message, context || ''),
      warn: (message: string, context?: any) => console.warn('[dynamic-calculations]', message, context || ''),
      error: (message: string, context?: any, error?: Error) => console.error('[dynamic-calculations]', message, context || '', error || ''),
      debug: (message: string, context?: any) => console.debug('[dynamic-calculations]', message, context || ''),
    };
    }
    return this._logger;
  }

  constructor(private config: DynamicCalculationsConfig) {}

  /**
   * Get dynamic stop-loss recommendation for a position
   */
  calculateDynamicStopLoss(
    symbol: string,
    _entryPrice: number,
    currentPrice: number
  ): StopLossRecommendation {
    const position = this.config.positions.get(symbol);
    const volatility = this.config.marketConditions.volatilityIndex / 100;
    const liquidity = this.config.marketConditions.liquidityIndex / 100;

    // Base stop-loss at 2-5% depending on market conditions
    let stopLossPercent = 0.02; // 2% base

    // Adjust for volatility (higher volatility = wider stop loss)
    stopLossPercent += volatility * 0.03; // Up to +3%

    // Adjust for liquidity (lower liquidity = wider stop loss)
    stopLossPercent += (1 - liquidity) * 0.02; // Up to +2%

    // Adjust for position size (larger positions = tighter stop loss)
    if (position) {
      const positionSizeRatio = position.size / this.config.riskConfig.maxSinglePositionSize;
      stopLossPercent -= positionSizeRatio * 0.01; // Up to -1%
    }

    // Ensure minimum 1% and maximum 8% stop loss
    stopLossPercent = Math.max(0.01, Math.min(0.08, stopLossPercent));

    const stopLossPrice = currentPrice * (1 - stopLossPercent);

    const reasoning =
      `Dynamic stop-loss at ${(stopLossPercent * 100).toFixed(1)}% based on ` +
      `volatility: ${(volatility * 100).toFixed(0)}%, ` +
      `liquidity: ${(liquidity * 100).toFixed(0)}%, ` +
      `position size: ${position ? (position.size / 1000).toFixed(1) : "N/A"}K USDT`;

    return { stopLossPrice, reasoning };
  }

  /**
   * Get dynamic take-profit recommendation for a position
   */
  calculateDynamicTakeProfit(
    symbol: string,
    _entryPrice: number,
    currentPrice: number
  ): TakeProfitRecommendation {
    const position = this.config.positions.get(symbol);
    const volatility = this.config.marketConditions.volatilityIndex / 100;
    const sentiment = this.config.marketConditions.marketSentiment;

    // Base take-profit at 3-8% depending on conditions
    let takeProfitPercent = 0.05; // 5% base

    // Adjust for volatility (higher volatility = wider take profit)
    takeProfitPercent += volatility * 0.04; // Up to +4%

    // Adjust for market sentiment
    if (sentiment === "bullish") {
      takeProfitPercent += 0.02; // +2% in bullish markets
    } else if (sentiment === "bearish") {
      takeProfitPercent -= 0.01; // -1% in bearish markets
    }

    // Adjust for position size (larger positions = tighter take profit)
    if (position) {
      const positionSizeRatio = position.size / this.config.riskConfig.maxSinglePositionSize;
      takeProfitPercent -= positionSizeRatio * 0.015; // Up to -1.5%
    }

    // Ensure minimum 2% and maximum 12% take profit
    takeProfitPercent = Math.max(0.02, Math.min(0.12, takeProfitPercent));

    const takeProfitPrice = currentPrice * (1 + takeProfitPercent);

    const reasoning =
      `Dynamic take-profit at ${(takeProfitPercent * 100).toFixed(1)}% based on ` +
      `volatility: ${(volatility * 100).toFixed(0)}%, ` +
      `sentiment: ${sentiment}, ` +
      `position size: ${position ? (position.size / 1000).toFixed(1) : "N/A"}K USDT`;

    return { takeProfitPrice, reasoning };
  }

  /**
   * Validate position size against risk limits and constraints
   */
  async validatePositionSize(positionRequest: {
    symbol: string;
    entryPrice: number;
    requestedPositionSize: number;
    portfolioValue: number;
    estimatedRisk?: number;
    confidence?: number;
    correlationWithPortfolio?: number;
  }): Promise<PositionSizeValidation> {
    const warnings: string[] = [];
    let adjustedSize = positionRequest.requestedPositionSize;
    let approved = true;
    let rejectionReason: string | undefined;
    let adjustmentReason: string | undefined;

    try {
      // Calculate position size ratio
      const positionSizeRatio =
        positionRequest.requestedPositionSize / positionRequest.portfolioValue;

      // Check against maximum single position size
      if (positionRequest.requestedPositionSize > this.config.riskConfig.maxSinglePositionSize) {
        adjustedSize = this.config.riskConfig.maxSinglePositionSize;
        adjustmentReason = "position_size_capped";
        warnings.push("position_capped");
        warnings.push("Position size reduced to maximum allowed");
      }

      // Check against portfolio percentage limits (5% default)
      const maxPortfolioPercentage = 0.05; // 5%
      if (positionSizeRatio > maxPortfolioPercentage) {
        const maxAllowedSize = positionRequest.portfolioValue * maxPortfolioPercentage;
        if (maxAllowedSize < adjustedSize) {
          adjustedSize = maxAllowedSize;
          adjustmentReason = "position_size_capped";
          warnings.push(
            `Position size reduced to ${(maxPortfolioPercentage * 100).toFixed(1)}% of portfolio`
          );
        }
      }

      // Check portfolio risk limits
      const currentPortfolioValue = this.calculatePortfolioValue();
      const newPortfolioValue = currentPortfolioValue + adjustedSize;

      if (newPortfolioValue > this.config.riskConfig.maxPortfolioValue) {
        const remainingCapacity = this.config.riskConfig.maxPortfolioValue - currentPortfolioValue;
        if (remainingCapacity <= 0) {
          approved = false;
          rejectionReason = "portfolio_risk_exceeded";
          adjustedSize = 0;
        } else if (remainingCapacity < adjustedSize) {
          adjustedSize = remainingCapacity;
          adjustmentReason = "portfolio_capacity_limit";
          warnings.push("Position size reduced due to portfolio capacity limits");
        }
      }

      // Check estimated risk if provided
      if (positionRequest.estimatedRisk && positionRequest.estimatedRisk > 15) {
        // High risk position, reduce size
        adjustedSize *= 0.7; // 30% reduction
        warnings.push("Position size reduced due to high estimated risk");
        if (!adjustmentReason) adjustmentReason = "high_risk_adjustment";
      }

      // Check correlation risk if provided
      if (
        positionRequest.correlationWithPortfolio &&
        positionRequest.correlationWithPortfolio > 0.7
      ) {
        adjustedSize *= 0.8; // 20% reduction for high correlation
        warnings.push("Position size reduced due to high portfolio correlation");
        if (!adjustmentReason) adjustmentReason = "correlation_risk_adjustment";
      }

      // Ensure minimum position size
      if (adjustedSize < 10 && approved) {
        approved = false;
        rejectionReason = "position_too_small";
        adjustedSize = 0;
      }

      console.info(
        `[DynamicCalculations] Position validation: ${positionRequest.symbol} - Requested: ${positionRequest.requestedPositionSize}, Adjusted: ${adjustedSize}, Approved: ${approved}`
      );

      return {
        approved,
        adjustedPositionSize: adjustedSize,
        positionSizeRatio: adjustedSize / positionRequest.portfolioValue,
        rejectionReason,
        adjustmentReason,
        warnings,
      };
    } catch (error) {
      console.error("[DynamicCalculations] Position size validation failed:", error);
      return {
        approved: false,
        adjustedPositionSize: 0,
        positionSizeRatio: 0,
        rejectionReason: `validation_error: ${error}`,
        warnings: ["Position validation failed due to system error"],
      };
    }
  }

  /**
   * Calculate volatility-adjusted position size
   */
  async calculateVolatilityAdjustedPosition(positionRequest: {
    symbol: string;
    entryPrice: number;
    requestedPositionSize: number;
    portfolioValue: number;
  }): Promise<VolatilityAdjustment> {
    const volatility = this.config.marketConditions.volatilityIndex / 100;
    let adjustedSize = positionRequest.requestedPositionSize;
    let volatilityReduction = 0;

    // Reduce position size based on volatility
    if (volatility > 0.8) {
      // High volatility: reduce by 40%
      volatilityReduction = 0.4;
      adjustedSize *= 1 - volatilityReduction;
    } else if (volatility > 0.6) {
      // Medium-high volatility: reduce by 25%
      volatilityReduction = 0.25;
      adjustedSize *= 1 - volatilityReduction;
    } else if (volatility > 0.4) {
      // Medium volatility: reduce by 15%
      volatilityReduction = 0.15;
      adjustedSize *= 1 - volatilityReduction;
    }

    const reasoning =
      volatilityReduction > 0
        ? `high_volatility: Position reduced by ${(volatilityReduction * 100).toFixed(1)}% due to volatility index of ${(volatility * 100).toFixed(1)}%`
        : "normal_volatility: No adjustment needed";

    return {
      adjustedSize,
      volatilityReduction,
      reasoning,
    };
  }

  /**
   * Validate stop loss placement
   */
  async validateStopLossPlacement(options: {
    symbol: string;
    entryPrice: number;
    stopLoss: number;
    positionSize: number;
  }): Promise<StopLossValidation> {
    const issues: string[] = [];
    const { entryPrice, stopLoss } = options;

    // Check if stop loss is above entry (invalid)
    if (stopLoss >= entryPrice) {
      issues.push("invalid");
      return { isValid: false, issues };
    }

    // Calculate stop loss percentage
    const stopLossPercent = ((entryPrice - stopLoss) / entryPrice) * 100;

    // Check if stop loss is too wide (>50%)
    if (stopLossPercent > 50) {
      issues.push("too_wide");
    }

    // Check if stop loss is too tight (<2%)
    if (stopLossPercent < 2) {
      issues.push("too_tight");
    }

    const isValid = issues.length === 0;

    // Recommend optimal stop loss if current is invalid
    let recommendedStopLoss: number | undefined;
    if (!isValid) {
      const volatility = this.config.marketConditions.volatilityIndex / 100;
      const optimalStopLossPercent = Math.max(5, Math.min(15, 8 + volatility * 10)); // 5-15% range
      recommendedStopLoss = entryPrice * (1 - optimalStopLossPercent / 100);
    }

    return {
      isValid,
      issues,
      recommendedStopLoss,
    };
  }

  /**
   * Assess diversification risk for a new position
   */
  async assessDiversificationRisk(newPosition: {
    symbol: string;
    entryPrice: number;
    requestedPositionSize: number;
    correlationWithPortfolio?: number;
  }): Promise<DiversificationAssessment> {
    const warnings: string[] = [];
    const portfolioValue = this.calculatePortfolioValue();
    const positionRatio = newPosition.requestedPositionSize / portfolioValue;

    // Calculate concentration risk
    let concentrationRisk: "low" | "medium" | "high" = "low";
    if (positionRatio > 0.15) {
      concentrationRisk = "high";
      warnings.push("sector_concentration");
    } else if (positionRatio > 0.08) {
      concentrationRisk = "medium";
      warnings.push("moderate_concentration");
    }

    // Calculate recommended max position
    let recommendedMaxPosition = newPosition.requestedPositionSize;
    if (concentrationRisk === "high") {
      recommendedMaxPosition = portfolioValue * 0.05; // 5% max
    } else if (concentrationRisk === "medium") {
      recommendedMaxPosition = portfolioValue * 0.08; // 8% max
    }

    // Factor in correlation
    const correlation = newPosition.correlationWithPortfolio || 0.5;
    if (correlation > 0.7) {
      recommendedMaxPosition *= 0.7; // Reduce further for high correlation
      warnings.push("high_correlation_risk");
    }

    // Calculate diversification score (0-100, higher is better)
    const positionCount = this.config.positions.size + 1; // Including new position
    const diversificationScore = Math.min(
      100,
      positionCount * 10 - correlation * 30 - positionRatio * 100
    );

    return {
      concentrationRisk,
      recommendedMaxPosition,
      warnings,
      diversificationScore: Math.max(0, diversificationScore),
    };
  }

  /**
   * Calculate adaptive risk thresholds based on market regime
   */
  async calculateAdaptiveThresholds(regime: {
    name: string;
    volatility: number;
    trend: string;
    sentiment: string;
  }): Promise<{
    maxPositionSize: number;
    stopLossThreshold: number;
    riskReductionFactor: number;
  }> {
    const baseThresholds = {
      maxPositionSize: this.config.riskConfig.maxSinglePositionSize,
      stopLossThreshold: 10, // 10%
      riskReductionFactor: 1.0,
    };

    // Adjust based on volatility
    const volatilityAdjustment = regime.volatility;
    baseThresholds.maxPositionSize *= 1 - volatilityAdjustment * 0.5;
    baseThresholds.stopLossThreshold *= 1 + volatilityAdjustment;

    // Adjust based on market sentiment
    if (regime.sentiment === "panic") {
      baseThresholds.riskReductionFactor = 2.0;
      baseThresholds.maxPositionSize *= 0.3;
      baseThresholds.stopLossThreshold *= 0.5;
    } else if (regime.sentiment === "negative") {
      baseThresholds.riskReductionFactor = 1.5;
      baseThresholds.maxPositionSize *= 0.7;
    } else if (regime.sentiment === "positive") {
      baseThresholds.riskReductionFactor = 0.8;
      baseThresholds.maxPositionSize *= 1.2;
    }

    return baseThresholds;
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
  updateConfig(newConfig: Partial<DynamicCalculationsConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Factory function for creating dynamic calculations instance
export function createDynamicCalculations(config: DynamicCalculationsConfig): DynamicCalculations {
  return new DynamicCalculations(config);
}

// Export types for external use
export type {
  DynamicCalculationsConfig,
  StopLossRecommendation,
  TakeProfitRecommendation,
  PositionSizeValidation,
  VolatilityAdjustment,
  StopLossValidation,
  DiversificationAssessment,
};
