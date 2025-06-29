/**
 * Multi-Phase Trading Bot
 *
 * Implementation that provides trading bot functionality for price-based phase execution.
 * Designed to work with trading strategies and track completion status.
 */

import type { TradingStrategy } from "./trading-strategy-manager";

// Types for the trading bot interface
export interface BotStatus {
  entryPrice: number;
  position: number;
  currentPrice?: number;
  isComplete: boolean;
  completionPercentage: number;
  priceIncrease?: string;
  summary: {
    completedPhases: number;
    totalPhases: number;
  };
  visualization?: string;
}

export interface TradingAction {
  type: "sell" | "stop_loss" | "trail_stop";
  description: string;
  phase?: number;
  amount: number;
  price: number;
  isStopLoss?: boolean;
}

export interface PriceUpdateResult {
  actions: TradingAction[];
  status: BotStatus;
}

export interface PerformanceSummary {
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  totalPnLPercent: number;
  bestPhase?: { phase: number; profit: number };
  worstPhase?: { phase: number; profit: number };
  efficiency: number;
}

export interface RiskMetrics {
  currentDrawdown: number;
  maxDrawdown: number;
  riskRewardRatio: number;
  positionRisk: number;
  stopLossLevel: number;
}

export interface PriceMovement {
  price: number;
  description: string;
}

export interface SimulationResult {
  actions: TradingAction[];
  status: BotStatus;
  performance: PerformanceSummary;
}

export interface BotState {
  entryPrice: number;
  position: number;
  strategy: TradingStrategy;
  executorState: {
    completedPhases: number[];
    lastPrice?: number;
  };
}

export interface PositionInfo {
  symbol: string;
  entryPrice: number;
  currentSize: number;
  initialSize: number;
  unrealizedPnL: number;
  realizedPnL: number;
}

/**
 * Multi-Phase Trading Bot Implementation
 */
export class MultiPhaseTradingBot {
  protected completedPhases: Set<number> = new Set();
  protected lastPrice?: number;
  private maxDrawdown = 0;
  private symbol = "";
  private initialPosition = 0;
  private totalRealizedPnL = 0;

  constructor(
    protected strategy: TradingStrategy,
    protected entryPrice: number,
    protected position: number
  ) {
    if (entryPrice <= 0) throw new Error("Entry price must be positive");
    if (position <= 0) throw new Error("Position must be positive");
    this.initialPosition = position;
  }

  /**
   * Initialize a new position
   */
  initializePosition(symbol: string, entryPrice: number, positionSize: number): void {
    if (entryPrice <= 0) throw new Error("Entry price must be positive");
    if (positionSize <= 0) throw new Error("Position size must be positive");
    
    this.symbol = symbol;
    this.entryPrice = entryPrice;
    this.position = positionSize;
    this.initialPosition = positionSize;
    this.completedPhases.clear();
    this.lastPrice = undefined;
    this.maxDrawdown = 0;
    this.totalRealizedPnL = 0;
  }

  /**
   * Get current position information
   */
  getPositionInfo(): PositionInfo {
    const currentPrice = this.lastPrice || this.entryPrice;
    const unrealizedPnL = this.position * (currentPrice - this.entryPrice);
    
    return {
      symbol: this.symbol,
      entryPrice: this.entryPrice,
      currentSize: this.position,
      initialSize: this.initialPosition,
      unrealizedPnL,
      realizedPnL: this.totalRealizedPnL,
    };
  }

  /**
   * Process a price update and execute phases as needed
   */
  onPriceUpdate(currentPrice: number): PriceUpdateResult {
    this.lastPrice = currentPrice;
    const actions: TradingAction[] = [];

    // Calculate price increase percentage
    const priceIncrease = ((currentPrice - this.entryPrice) / this.entryPrice) * 100;

    // Check for stop-loss conditions (20% drawdown triggers emergency stop)
    if (priceIncrease <= -20) {
      const stopLossAmount = this.position;
      if (stopLossAmount > 0) {
        actions.push({
          type: "stop_loss",
          description: `STOP LOSS: Sell ${stopLossAmount} units at ${currentPrice.toFixed(2)} (-${Math.abs(priceIncrease).toFixed(2)}%)`,
          amount: stopLossAmount,
          price: currentPrice,
          isStopLoss: true,
        });
        
        // Calculate realized loss
        this.totalRealizedPnL += stopLossAmount * (currentPrice - this.entryPrice);
        this.position = 0; // Close entire position
      }
      
      return {
        actions,
        status: this.buildStatus(currentPrice),
      };
    }

    // Check each phase target
    this.strategy.levels.forEach((level, index) => {
      const phaseNumber = index + 1;

      // Skip if phase already completed
      if (this.completedPhases.has(phaseNumber)) {
        return;
      }

      // Check if price target is reached
      if (priceIncrease >= level.percentage) {
        this.completedPhases.add(phaseNumber);
        const sellAmount = Math.floor((this.position * level.sellPercentage) / 100);
        
        if (sellAmount > 0) {
          actions.push({
            type: "sell",
            description: `EXECUTE Phase ${phaseNumber}: Sell ${sellAmount} units at ${currentPrice.toFixed(2)} (+${level.percentage}%)`,
            phase: phaseNumber,
            amount: sellAmount,
            price: currentPrice,
          });
          
          // Calculate realized profit for this phase
          this.totalRealizedPnL += sellAmount * (currentPrice - this.entryPrice);
          this.position -= sellAmount; // Reduce remaining position
        }
      }
    });

    return {
      actions,
      status: this.buildStatus(currentPrice),
    };
  }

  /**
   * Get current bot status
   */
  getStatus(): BotStatus {
    return this.buildStatus(this.lastPrice);
  }

  /**
   * Update position size
   */
  updatePosition(newPosition: number): void {
    if (newPosition <= 0) throw new Error("Position must be positive");
    this.position = newPosition;
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(currentPrice: number): PerformanceSummary {
    let realizedPnL = 0;
    let bestPhase: { phase: number; profit: number } | undefined;
    let worstPhase: { phase: number; profit: number } | undefined;

    // Calculate realized P&L from completed phases
    this.strategy.levels.forEach((level, index) => {
      const phaseNumber = index + 1;
      if (this.completedPhases.has(phaseNumber)) {
        const sellAmount = (this.position * level.sellPercentage) / 100;
        const profit = sellAmount * (currentPrice - this.entryPrice);
        realizedPnL += profit;

        if (!bestPhase || profit > bestPhase.profit) {
          bestPhase = { phase: phaseNumber, profit };
        }
        if (!worstPhase || profit < worstPhase.profit) {
          worstPhase = { phase: phaseNumber, profit };
        }
      }
    });

    // Calculate unrealized P&L from remaining position
    const soldPercentage = this.strategy.levels
      .filter((_, index) => this.completedPhases.has(index + 1))
      .reduce((sum, level) => sum + level.sellPercentage, 0);
    const remainingPosition = (this.position * (100 - soldPercentage)) / 100;
    const unrealizedPnL = remainingPosition * (currentPrice - this.entryPrice);

    const totalPnL = realizedPnL + unrealizedPnL;
    const totalPnLPercent = (totalPnL / (this.position * this.entryPrice)) * 100;

    // Calculate efficiency (percentage of available profit captured)
    const maxPossibleProfit = this.position * (currentPrice - this.entryPrice);
    const efficiency = maxPossibleProfit > 0 ? (totalPnL / maxPossibleProfit) * 100 : 0;

    return {
      realizedPnL,
      unrealizedPnL,
      totalPnL,
      totalPnLPercent,
      bestPhase,
      worstPhase,
      efficiency: Math.max(0, Math.min(100, efficiency)),
    };
  }

  /**
   * Get risk metrics
   */
  getRiskMetrics(currentPrice: number): RiskMetrics {
    const priceChange = ((currentPrice - this.entryPrice) / this.entryPrice) * 100;
    const currentDrawdown = Math.max(0, -priceChange); // Only negative moves are drawdown
    this.maxDrawdown = Math.max(this.maxDrawdown, currentDrawdown);

    // Calculate risk-reward ratio based on strategy targets
    const avgTarget =
      this.strategy.levels.reduce((sum, level) => sum + level.percentage, 0) /
      this.strategy.levels.length;
    const stopLossPercent = 10; // 10% stop loss
    const riskRewardRatio = avgTarget / stopLossPercent;

    return {
      currentDrawdown,
      maxDrawdown: this.maxDrawdown,
      riskRewardRatio,
      positionRisk: Math.abs(priceChange),
      stopLossLevel: this.entryPrice * (1 - stopLossPercent / 100),
    };
  }

  /**
   * Simulate price movements
   */
  simulatePriceMovements(movements: PriceMovement[]): SimulationResult[] {
    const results: SimulationResult[] = [];

    movements.forEach((movement) => {
      const updateResult = this.onPriceUpdate(movement.price);
      const performance = this.getPerformanceSummary(movement.price);

      results.push({
        actions: updateResult.actions,
        status: updateResult.status,
        performance,
      });
    });

    return results;
  }

  /**
   * Export bot state
   */
  exportState(): BotState {
    return {
      entryPrice: this.entryPrice,
      position: this.position,
      strategy: this.strategy,
      executorState: {
        completedPhases: Array.from(this.completedPhases),
        lastPrice: this.lastPrice,
      },
    };
  }

  /**
   * Import bot state
   */
  importState(state: BotState): void {
    this.entryPrice = state.entryPrice;
    this.position = state.position;
    this.strategy = state.strategy;
    this.completedPhases = new Set(state.executorState.completedPhases);
    this.lastPrice = state.executorState.lastPrice;
  }

  /**
   * Reset bot to initial state
   */
  reset(): void {
    this.completedPhases.clear();
    this.lastPrice = undefined;
    this.maxDrawdown = 0;
  }

  /**
   * Calculate optimal entry strategy based on market conditions
   */
  calculateOptimalEntry(
    symbol: string, 
    marketConditions: {
      volatility: number;
      volume: number;
      momentum: number;
      support: number;
      resistance: number;
    }
  ): {
    entryPrice: number;
    confidence: number;
    adjustments: string[];
  } {
    const adjustments: string[] = [];
    let baseConfidence = 75; // Start with moderate confidence
    
    // Calculate optimal entry price based on support/resistance levels
    const supportResistanceRange = marketConditions.resistance - marketConditions.support;
    const optimalEntry = marketConditions.support + (supportResistanceRange * 0.3); // Enter closer to support
    
    // Adjust confidence based on market conditions
    
    // Volatility adjustment
    if (marketConditions.volatility < 0.1) {
      baseConfidence += 10;
      adjustments.push("Low volatility increases confidence");
    } else if (marketConditions.volatility > 0.4) {
      baseConfidence -= 15;
      adjustments.push("High volatility reduces confidence");
    }
    
    // Volume adjustment
    if (marketConditions.volume > 2.0) {
      baseConfidence += 8;
      adjustments.push("High volume supports entry confidence");
    } else if (marketConditions.volume < 1.0) {
      baseConfidence -= 10;
      adjustments.push("Low volume reduces confidence");
    }
    
    // Momentum adjustment
    if (marketConditions.momentum > 0.8) {
      baseConfidence += 12;
      adjustments.push("Strong momentum increases confidence");
    } else if (marketConditions.momentum < 0.4) {
      baseConfidence -= 8;
      adjustments.push("Weak momentum reduces confidence");
    }
    
    // Risk/reward ratio check
    const riskRewardRatio = (marketConditions.resistance - optimalEntry) / (optimalEntry - marketConditions.support);
    if (riskRewardRatio > 2.0) {
      baseConfidence += 5;
      adjustments.push(`Favorable risk/reward ratio: ${riskRewardRatio.toFixed(2)}:1`);
    } else if (riskRewardRatio < 1.0) {
      baseConfidence -= 10;
      adjustments.push(`Poor risk/reward ratio: ${riskRewardRatio.toFixed(2)}:1`);
    }
    
    // Ensure confidence is within reasonable bounds
    const finalConfidence = Math.max(20, Math.min(95, baseConfidence));
    
    return {
      entryPrice: Number(optimalEntry.toFixed(6)),
      confidence: finalConfidence,
      adjustments
    };
  }

  /**
   * Build status object
   */
  protected buildStatus(currentPrice?: number): BotStatus {
    const totalPhases = this.strategy.levels.length;
    const completedPhases = this.completedPhases.size;
    const completionPercentage = (completedPhases / totalPhases) * 100;

    let priceIncrease: string | undefined;
    if (currentPrice) {
      const increase = ((currentPrice - this.entryPrice) / this.entryPrice) * 100;
      priceIncrease = increase.toFixed(2) + "%";
    }

    // Build visualization
    const visualization = this.strategy.levels
      .map((level, index) => {
        const phaseNumber = index + 1;
        const isCompleted = this.completedPhases.has(phaseNumber);
        const emoji = isCompleted ? "✅" : "🎯";
        return `${emoji} Phase ${phaseNumber} (+${level.percentage}%)`;
      })
      .join(" | ");

    return {
      entryPrice: this.entryPrice,
      position: this.position,
      currentPrice,
      isComplete: completedPhases === totalPhases,
      completionPercentage,
      priceIncrease,
      summary: {
        completedPhases,
        totalPhases,
      },
      visualization,
    };
  }
}

/**
 * Advanced Multi-Phase Trading Bot with strategy switching capabilities
 */
export class AdvancedMultiPhaseTradingBot extends MultiPhaseTradingBot {
  private strategies: Map<string, TradingStrategy>;
  private currentStrategyId: string;

  constructor(
    strategies: Record<string, TradingStrategy>,
    initialStrategyId: string,
    entryPrice: number,
    position: number
  ) {
    const initialStrategy = strategies[initialStrategyId];
    if (!initialStrategy) {
      throw new Error(`Strategy '${initialStrategyId}' not found`);
    }

    super(initialStrategy, entryPrice, position);

    this.strategies = new Map(Object.entries(strategies));
    this.currentStrategyId = initialStrategyId;
  }

  /**
   * Switch to a different strategy
   */
  switchStrategy(strategyId: string): boolean {
    const strategy = this.strategies.get(strategyId);
    if (!strategy) {
      return false;
    }

    // Update the current strategy
    this.strategy = strategy;
    this.currentStrategyId = strategyId;
    return true;
  }

  /**
   * Get current strategy information
   */
  getCurrentStrategy(): { id: string; strategy: TradingStrategy } {
    return {
      id: this.currentStrategyId,
      strategy: this.strategy,
    };
  }

  /**
   * List available strategy IDs
   */
  listStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * List all active strategies (inherited method override)
   */
  async listActiveStrategies(): Promise<TradingStrategy[]> {
    return Array.from(this.strategies.values());
  }

  /**
   * Enable real-time monitoring with websocket price updates
   */
  enableRealTimeMonitoring(wsCallback: (price: number) => void): void {
    // In a real implementation, this would connect to MEXC websocket
    // For now, simulate with periodic price updates
    const simulationInterval = setInterval(() => {
      if (this.lastPrice) {
        // Simulate price movement (±2% random walk)
        const change = (Math.random() - 0.5) * 0.04;
        const newPrice = this.lastPrice * (1 + change);
        wsCallback(newPrice);
      }
    }, 1000); // Update every second

    // Store interval for cleanup
    this.monitoringInterval = simulationInterval;
  }

  /**
   * Disable real-time monitoring
   */
  disableRealTimeMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Advanced position management with dynamic targets
   */
  updateDynamicTargets(marketConditions: {
    volatility: number;
    trend: "bullish" | "bearish" | "sideways";
    volume: number;
  }): void {
    // Adjust strategy levels based on market conditions
    const volatilityMultiplier = Math.max(0.5, Math.min(2.0, 1 + marketConditions.volatility));

    this.strategy.levels = this.strategy.levels.map((level) => ({
      ...level,
      percentage: level.percentage * volatilityMultiplier,
      sellPercentage:
        marketConditions.trend === "bullish"
          ? level.sellPercentage * 0.8 // Sell less in bullish market
          : level.sellPercentage * 1.2, // Sell more in bearish market
    }));
  }

  /**
   * Implement trailing stop loss
   */
  private trailingStopLoss = {
    enabled: false,
    trailPercent: 5,
    highestPrice: 0,
    stopPrice: 0,
  };

  /**
   * Enable trailing stop loss
   */
  enableTrailingStop(trailPercent: number): void {
    this.trailingStopLoss.enabled = true;
    this.trailingStopLoss.trailPercent = trailPercent;
    this.trailingStopLoss.highestPrice = this.lastPrice || this.entryPrice;
    this.trailingStopLoss.stopPrice = this.trailingStopLoss.highestPrice * (1 - trailPercent / 100);
  }

  /**
   * Check trailing stop conditions
   */
  private checkTrailingStop(currentPrice: number): boolean {
    if (!this.trailingStopLoss.enabled) return false;

    // Update highest price
    if (currentPrice > this.trailingStopLoss.highestPrice) {
      this.trailingStopLoss.highestPrice = currentPrice;
      this.trailingStopLoss.stopPrice =
        currentPrice * (1 - this.trailingStopLoss.trailPercent / 100);
    }

    // Check if stop is triggered
    return currentPrice <= this.trailingStopLoss.stopPrice;
  }

  /**
   * Enhanced price update with advanced features
   */
  onAdvancedPriceUpdate(currentPrice: number, volume?: number): PriceUpdateResult {
    this.lastPrice = currentPrice;
    const actions: TradingAction[] = [];

    // Check trailing stop first
    if (this.checkTrailingStop(currentPrice)) {
      actions.push({
        type: "trail_stop",
        description: `TRAILING STOP: Sell all ${this.position} units at ${currentPrice.toFixed(2)} (Trail: ${this.trailingStopLoss.trailPercent}%)`,
        amount: this.position,
        price: currentPrice,
        isStopLoss: true
      });
      this.reset(); // Close all positions
      return {
        actions,
        status: this.buildStatus(currentPrice),
      };
    }

    // Calculate price increase percentage
    const priceIncrease = ((currentPrice - this.entryPrice) / this.entryPrice) * 100;

    // Volume-weighted decisions
    const volumeMultiplier = volume ? Math.min(2.0, Math.max(0.5, volume / 1000000)) : 1.0;

    // Check each phase target with volume consideration
    this.strategy.levels.forEach((level, index) => {
      const phaseNumber = index + 1;

      // Skip if phase already completed
      if (this.completedPhases.has(phaseNumber)) {
        return;
      }

      // Adjust target based on volume
      const adjustedTarget = level.percentage * volumeMultiplier;

      // Check if price target is reached
      if (priceIncrease >= adjustedTarget) {
        this.completedPhases.add(phaseNumber);
        const sellAmount = Math.floor((this.position * level.sellPercentage) / 100);

        actions.push({
          type: "sell",
          description: `EXECUTE Phase ${phaseNumber}: Sell ${sellAmount} units at ${currentPrice.toFixed(2)} ` +
            `(+${adjustedTarget.toFixed(2)}%, Vol: ${volumeMultiplier.toFixed(2)}x)`,
          phase: phaseNumber,
          amount: sellAmount,
          price: currentPrice,
        });

        // Update remaining position
        this.position -= sellAmount;
      }
    });

    return {
      actions,
      status: this.buildStatus(currentPrice),
    };
  }

  /**
   * Calculate position efficiency score
   */
  calculateEfficiencyScore(currentPrice: number): number {
    const currentReturn = ((currentPrice - this.entryPrice) / this.entryPrice) * 100;
    const maxPossibleReturn =
      this.strategy.levels[this.strategy.levels.length - 1]?.percentage || 0;

    if (maxPossibleReturn === 0) return 0;

    const completionRatio = this.completedPhases.size / this.strategy.levels.length;
    const returnRatio = Math.max(0, currentReturn) / maxPossibleReturn;

    // Efficiency combines completion ratio and return capture
    return (completionRatio * 0.6 + returnRatio * 0.4) * 100;
  }

  /**
   * Advanced risk assessment
   */
  assessRisk(
    currentPrice: number,
    marketData?: {
      volatility: number;
      correlation: number;
      marketCap: number;
    }
  ): {
    riskLevel: "low" | "medium" | "high" | "critical";
    riskScore: number;
    recommendations: string[];
  } {
    const priceChange = ((currentPrice - this.entryPrice) / this.entryPrice) * 100;
    const recommendations: string[] = [];
    let riskScore = 0;

    // Price-based risk
    if (priceChange < -10) riskScore += 30;
    else if (priceChange < -5) riskScore += 15;

    // Position concentration risk
    const positionValue = this.position * currentPrice;
    if (positionValue > 100000)
      riskScore += 20; // Large position
    else if (positionValue > 50000) riskScore += 10;

    // Market data risk (if available)
    if (marketData) {
      if (marketData.volatility > 0.1) riskScore += 25;
      if (marketData.correlation > 0.8) riskScore += 15;
      if (marketData.marketCap < 1000000) riskScore += 20;
    }

    // Generate recommendations
    if (priceChange < -5) {
      recommendations.push("Consider reducing position size due to drawdown");
    }
    if (this.completedPhases.size === 0 && priceChange > 5) {
      recommendations.push("Consider taking partial profits");
    }
    if (!this.trailingStopLoss.enabled && priceChange > 10) {
      recommendations.push("Consider enabling trailing stop to protect gains");
    }

    // Determine risk level
    let riskLevel: "low" | "medium" | "high" | "critical";
    if (riskScore < 20) riskLevel = "low";
    else if (riskScore < 40) riskLevel = "medium";
    else if (riskScore < 70) riskLevel = "high";
    else riskLevel = "critical";

    return { riskLevel, riskScore, recommendations };
  }

  private monitoringInterval: NodeJS.Timeout | null = null;
}
