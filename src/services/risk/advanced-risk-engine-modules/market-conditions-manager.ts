/**
 * Market Conditions & Portfolio Management Module
 *
 * Manages market conditions, position tracking, and portfolio metrics
 * for the Advanced Risk Engine. This module handles data validation,
 * market condition updates, and portfolio risk calculations.
 *
 * Part of the modular refactoring of advanced-risk-engine.ts
 */

import type {
  MarketConditions,
  PortfolioRiskMetrics,
  PositionRiskProfile,
  RiskEngineConfig,
} from "@/src/schemas/risk-engine-schemas-extracted";
import {
  validateMarketConditions,
  validatePortfolioRiskMetrics,
  validatePositionRiskProfile,
} from "@/src/schemas/risk-engine-schemas-extracted";

export interface MarketConditionsManagerConfig {
  riskConfig: RiskEngineConfig;
  initialMarketConditions?: Partial<MarketConditions>;
}

export interface PortfolioUpdate {
  totalValue?: number;
  currentRisk?: number;
  unrealizedPnL?: number;
  timestamp?: number;
}

export class MarketConditionsManager {
  private _logger?: {
    info: (message: string, context?: any) => void;
    warn: (message: string, context?: any) => void;
    error: (message: string, context?: any, error?: Error) => void;
    debug: (message: string, context?: any) => void;
  };
  private get logger() {
    if (!this._logger) {
      this._logger = {
        info: (message: string, context?: any) =>
          console.info("[market-conditions-manager]", message, context || ""),
        warn: (message: string, context?: any) =>
          console.warn("[market-conditions-manager]", message, context || ""),
        error: (message: string, context?: any, error?: Error) =>
          console.error("[market-conditions-manager]", message, context || "", error || ""),
        debug: (message: string, context?: any) =>
          console.debug("[market-conditions-manager]", message, context || ""),
      };
    }
    return this._logger;
  }

  private marketConditions: MarketConditions;
  private positions: Map<string, PositionRiskProfile> = new Map();
  private historicalMetrics: PortfolioRiskMetrics[] = [];
  private lastRiskUpdate = 0;

  constructor(private config: MarketConditionsManagerConfig) {
    // Initialize market conditions with defaults
    this.marketConditions = {
      volatilityIndex: 50,
      liquidityIndex: 80,
      orderBookDepth: 100000,
      bidAskSpread: 0.1,
      tradingVolume24h: 1000000,
      priceChange24h: 0,
      correlationRisk: 0.3,
      marketSentiment: "neutral",
      timestamp: new Date().toISOString(),
      ...config.initialMarketConditions,
    };

    console.info("[MarketConditionsManager] Initialized with market conditions");
  }

  /**
   * Update market conditions with validation
   */
  async updateMarketConditions(conditions: Partial<MarketConditions>): Promise<void> {
    const updatedConditions = {
      ...this.marketConditions,
      ...conditions,
      timestamp: new Date().toISOString(),
    };

    try {
      // Validate the updated market conditions
      this.marketConditions = validateMarketConditions(updatedConditions);
      console.info("[MarketConditionsManager] Market conditions updated and validated");
    } catch (validationError) {
      console.error("[MarketConditionsManager] Invalid market conditions:", validationError);
      throw new Error(`Invalid market conditions: ${validationError}`);
    }

    this.lastRiskUpdate = Date.now();
  }

  /**
   * Get current market conditions
   */
  getMarketConditions(): MarketConditions {
    return { ...this.marketConditions };
  }

  /**
   * Add or update position in risk tracking with validation
   */
  async updatePosition(position: PositionRiskProfile): Promise<void> {
    try {
      // Validate the position before storing
      const validatedPosition = validatePositionRiskProfile(position);
      this.positions.set(validatedPosition.symbol, validatedPosition);
      console.info(
        `[MarketConditionsManager] Position updated and validated for ${validatedPosition.symbol}`
      );
    } catch (validationError) {
      console.error("[MarketConditionsManager] Invalid position profile:", validationError);
      throw new Error(`Invalid position profile: ${validationError}`);
    }

    // Recalculate portfolio risk metrics
    const portfolioMetrics = await this.calculatePortfolioRiskMetrics();
    this.historicalMetrics.push(portfolioMetrics);

    // Keep only last 1000 historical metrics
    if (this.historicalMetrics.length > 1000) {
      this.historicalMetrics = this.historicalMetrics.slice(-1000);
    }
  }

  /**
   * Remove position from risk tracking
   */
  removePosition(symbol: string): void {
    this.positions.delete(symbol);
    console.info(`[MarketConditionsManager] Removed position tracking for ${symbol}`);
  }

  /**
   * Get specific position
   */
  getPosition(symbol: string): PositionRiskProfile | undefined {
    return this.positions.get(symbol);
  }

  /**
   * Get all positions
   */
  getAllPositions(): Map<string, PositionRiskProfile> {
    return new Map(this.positions);
  }

  /**
   * Calculate current portfolio risk metrics
   */
  async calculatePortfolioRiskMetrics(): Promise<PortfolioRiskMetrics> {
    const positions = Array.from(this.positions.values());
    const totalValue = positions.reduce((sum, pos) => sum + pos.size, 0);
    const totalExposure = positions.reduce((sum, pos) => sum + pos.exposure, 0);

    // Calculate diversification score (higher is better)
    const diversificationScore = Math.max(
      0,
      100 -
        (positions.length > 0 ? (Math.max(...positions.map((p) => p.size)) / totalValue) * 100 : 0)
    );

    // Calculate concentration risk (lower is better)
    const concentrationRisk =
      positions.length > 0 ? (Math.max(...positions.map((p) => p.size)) / totalValue) * 100 : 0;

    // Calculate portfolio VaR
    const portfolioVar = positions.reduce((sum, pos) => sum + pos.valueAtRisk, 0);

    return {
      totalValue,
      totalExposure,
      totalPositions: positions.length,
      concentrationRisk,
      diversificationScore,
      valueAtRisk95: portfolioVar,
      expectedShortfall: portfolioVar * 1.3,
      sharpeRatio: 0, // Would need return data to calculate
      beta: 1.0, // Placeholder beta value
      averageCorrelation: positions.length > 0 ? positions.reduce((sum, pos) => sum + pos.correlationScore, 0) / positions.length : 0,
      totalUnrealizedPnL: positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0),
      maxSinglePositionPercent: positions.length > 0 ? (Math.max(...positions.map((p) => p.size)) / totalValue) * 100 : 0,
      currentDrawdown: positions.reduce((max, pos) => Math.max(max, pos.maxDrawdown), 0),
      maxDrawdownRisk: positions.reduce((max, pos) => Math.max(max, pos.maxDrawdown), 0),
      liquidityRisk: Math.max(0, 100 - this.marketConditions.liquidityIndex),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get current portfolio risk metrics
   */
  async getPortfolioRiskMetrics(): Promise<PortfolioRiskMetrics> {
    return await this.calculatePortfolioRiskMetrics();
  }

  /**
   * Update portfolio metrics with new data
   */
  async updatePortfolioMetrics(update: PortfolioUpdate): Promise<void> {
    try {
      // Calculate new portfolio metrics
      const currentMetrics = await this.calculatePortfolioRiskMetrics();

      // Apply updates
      if (update.totalValue !== undefined) {
        // Update total value and recalculate dependent metrics
        const oldValue = currentMetrics.totalValue;
        const newValue = update.totalValue;

        // Update position values proportionally
        for (const [_symbol, position] of this.positions.entries()) {
          const scaleFactor = oldValue > 0 ? newValue / oldValue : 1;
          position.size *= scaleFactor;
        }

        console.info(
          `[MarketConditionsManager] Portfolio value updated: ${oldValue} -> ${newValue}`
        );
      }

      // Store historical metrics with proper validation
      const updatedMetrics = await this.calculatePortfolioRiskMetrics();
      try {
        const validatedMetrics = validatePortfolioRiskMetrics({
          ...updatedMetrics,
          ...update,
        });
        this.historicalMetrics.push(validatedMetrics);
      } catch (validationError) {
        console.warn(
          "[MarketConditionsManager] Invalid portfolio metrics, using base metrics:",
          validationError
        );
        this.historicalMetrics.push(updatedMetrics);
      }

      // Keep only last 1000 historical metrics
      if (this.historicalMetrics.length > 1000) {
        this.historicalMetrics = this.historicalMetrics.slice(-1000);
      }

      this.lastRiskUpdate = Date.now();
    } catch (error) {
      console.error("[MarketConditionsManager] Portfolio metrics update failed:", error);
    }
  }

  /**
   * Update portfolio positions data
   */
  async updatePortfolioPositions(
    portfolioPositions: Array<{
      symbol: string;
      value: number;
      correlation?: number;
      beta?: number;
    }>
  ): Promise<void> {
    try {
      // Update existing positions or create new ones
      for (const pos of portfolioPositions) {
        const existingPosition = this.positions.get(pos.symbol);

        if (existingPosition) {
          // Update existing position
          existingPosition.size = pos.value;
          if (pos.correlation !== undefined) {
            existingPosition.correlationScore = pos.correlation;
          }
        } else {
          // Create new position
          const totalPortfolioValue = this.calculatePortfolioValue();
          const newPosition: PositionRiskProfile = {
            symbol: pos.symbol,
            size: pos.value,
            exposure: totalPortfolioValue > 0 ? (pos.value / totalPortfolioValue) * 100 : 100,
            leverage: 1,
            unrealizedPnL: 0,
            valueAtRisk: pos.value * 0.05, // 5% VaR estimate
            maxDrawdown: 0,
            timeHeld: 0,
            stopLossDistance: 10,
            takeProfitDistance: 20,
            correlationScore: pos.correlation || 0.3,
          };
          this.positions.set(pos.symbol, newPosition);
        }
      }

      // Recalculate portfolio metrics
      await this.calculatePortfolioRiskMetrics();

      console.info(
        `[MarketConditionsManager] Updated ${portfolioPositions.length} portfolio positions`
      );
    } catch (error) {
      console.error("[MarketConditionsManager] Portfolio positions update failed:", error);
    }
  }

  /**
   * Calculate total portfolio value
   */
  calculatePortfolioValue(): number {
    return Array.from(this.positions.values()).reduce((total, pos) => total + pos.size, 0);
  }

  /**
   * Calculate correlation risk across portfolio
   */
  async calculateCorrelationRisk(): Promise<{
    overallCorrelation: number;
    riskLevel: "low" | "medium" | "high" | "critical";
    recommendedAction: "monitor" | "reduce_positions" | "emergency_exit";
  }> {
    const positions = Array.from(this.positions.values());

    if (positions.length === 0) {
      return {
        overallCorrelation: 0,
        riskLevel: "low",
        recommendedAction: "monitor",
      };
    }

    // Calculate weighted average correlation
    const totalValue = positions.reduce((sum, p) => sum + p.size, 0);
    const weightedCorrelation = positions.reduce((sum, p) => {
      const weight = p.size / totalValue;
      return sum + p.correlationScore * weight;
    }, 0);

    // Determine risk level
    let riskLevel: "low" | "medium" | "high" | "critical";
    let recommendedAction: "monitor" | "reduce_positions" | "emergency_exit";

    if (weightedCorrelation > 0.8) {
      riskLevel = "critical";
      recommendedAction = "emergency_exit";
    } else if (weightedCorrelation > 0.6) {
      riskLevel = "high";
      recommendedAction = "reduce_positions";
    } else if (weightedCorrelation > 0.4) {
      riskLevel = "medium";
      recommendedAction = "monitor";
    } else {
      riskLevel = "low";
      recommendedAction = "monitor";
    }

    return {
      overallCorrelation: weightedCorrelation,
      riskLevel,
      recommendedAction,
    };
  }

  /**
   * Update correlation matrix during market stress
   */
  async updateCorrelationMatrix(
    correlatedPositions: Array<{
      symbol: string;
      value: number;
      beta: number;
    }>,
    marketStressEvent: {
      marketDirection: string;
      correlationSpike: number;
      volatilityIncrease: number;
      liquidityDecrease: number;
    }
  ): Promise<void> {
    try {
      // Update market conditions based on stress event
      await this.updateMarketConditions({
        volatilityIndex: Math.min(
          100,
          Math.max(
            0,
            this.marketConditions.volatilityIndex * (1 + marketStressEvent.volatilityIncrease / 100)
          )
        ),
        liquidityIndex: Math.min(
          100,
          Math.max(
            0,
            this.marketConditions.liquidityIndex * (1 - marketStressEvent.liquidityDecrease / 100)
          )
        ),
        correlationRisk: marketStressEvent.correlationSpike,
      });

      // Update position correlations
      for (const pos of correlatedPositions) {
        const position = this.positions.get(pos.symbol);
        if (position) {
          // Increase correlation during stress events
          position.correlationScore = Math.min(0.95, marketStressEvent.correlationSpike);
        }
      }

      console.info(
        `[MarketConditionsManager] Correlation matrix updated for stress event: ${marketStressEvent.marketDirection}`
      );
    } catch (error) {
      console.error("[MarketConditionsManager] Correlation matrix update failed:", error);
    }
  }

  /**
   * Get historical metrics
   */
  getHistoricalMetrics(): PortfolioRiskMetrics[] {
    return [...this.historicalMetrics];
  }

  /**
   * Get last risk update timestamp
   */
  getLastRiskUpdate(): number {
    return this.lastRiskUpdate;
  }

  /**
   * Check if market conditions indicate emergency state
   */
  isEmergencyMarketConditions(): boolean {
    return (
      this.marketConditions.volatilityIndex > this.config.riskConfig.emergencyVolatilityThreshold ||
      this.marketConditions.liquidityIndex < this.config.riskConfig.emergencyLiquidityThreshold ||
      this.marketConditions.correlationRisk > this.config.riskConfig.emergencyCorrelationThreshold
    );
  }

  /**
   * Get portfolio statistics
   */
  getPortfolioStatistics(): {
    positionCount: number;
    totalValue: number;
    averagePositionSize: number;
    largestPosition: number;
    concentration: number;
  } {
    const positions = Array.from(this.positions.values());
    const totalValue = this.calculatePortfolioValue();
    const positionSizes = positions.map((p) => p.size);
    const largestPosition = positionSizes.length > 0 ? Math.max(...positionSizes) : 0;

    return {
      positionCount: positions.length,
      totalValue,
      averagePositionSize: positions.length > 0 ? totalValue / positions.length : 0,
      largestPosition,
      concentration: totalValue > 0 ? (largestPosition / totalValue) * 100 : 0,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MarketConditionsManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Factory function for creating market conditions manager instance
export function createMarketConditionsManager(
  config: MarketConditionsManagerConfig
): MarketConditionsManager {
  return new MarketConditionsManager(config);
}

// Export types for external use
// (Types already exported above via interface declarations)
