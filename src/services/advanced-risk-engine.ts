/**
 * Advanced Risk Management Engine
 *
 * Multi-layered risk assessment system that provides comprehensive
 * protection for the AI trading system through real-time monitoring,
 * dynamic risk calculations, and adaptive safety mechanisms.
 */

import type { TradeRiskAssessment } from "../mexc-agents/risk-manager-agent";
import { type CircuitBreaker, circuitBreakerRegistry } from "./circuit-breaker";

// Advanced Risk Assessment Interfaces
export interface MarketConditions {
  volatilityIndex: number; // 0-100 scale
  liquidityIndex: number; // 0-100 scale
  orderBookDepth: number; // USDT depth
  bidAskSpread: number; // Percentage
  tradingVolume24h: number; // USDT volume
  priceChange24h: number; // Percentage
  correlationRisk: number; // Portfolio correlation (0-1)
  marketSentiment: "bullish" | "bearish" | "neutral" | "volatile";
  timestamp: string;
}

export interface PositionRiskProfile {
  symbol: string;
  size: number; // Position size in USDT
  exposure: number; // Market exposure percentage
  leverage: number; // Leverage multiplier
  unrealizedPnL: number; // Current P&L
  valueAtRisk: number; // VaR calculation
  maxDrawdown: number; // Maximum drawdown
  timeHeld: number; // Duration in hours
  stopLossDistance: number; // Distance to stop loss (%)
  takeProfitDistance: number; // Distance to take profit (%)
  correlationScore: number; // Correlation with other positions
}

export interface PortfolioRiskMetrics {
  totalValue: number;
  totalExposure: number;
  diversificationScore: number; // 0-100 (higher is better)
  concentrationRisk: number; // 0-100 (lower is better)
  correlationMatrix: number[][]; // Position correlations
  valueAtRisk95: number; // 95% VaR
  expectedShortfall: number; // Expected shortfall (CVaR)
  sharpeRatio: number; // Risk-adjusted returns
  maxDrawdownRisk: number; // Maximum potential drawdown
  liquidityRisk: number; // Portfolio liquidity score
}

export interface RiskEngineConfig {
  // Portfolio Limits
  maxPortfolioValue: number;
  maxSinglePositionSize: number;
  maxConcurrentPositions: number;
  maxDailyLoss: number;
  maxDrawdown: number;

  // Risk Calculation Parameters
  confidenceLevel: number; // VaR confidence level (0.95)
  lookbackPeriod: number; // Days for historical analysis
  correlationThreshold: number; // Maximum position correlation
  volatilityMultiplier: number; // Risk scaling factor

  // Dynamic Adjustment Parameters
  adaptiveRiskScaling: boolean;
  marketRegimeDetection: boolean;
  stressTestingEnabled: boolean;

  // Emergency Thresholds
  emergencyVolatilityThreshold: number;
  emergencyLiquidityThreshold: number;
  emergencyCorrelationThreshold: number;
}

export interface RiskAlert {
  id: string;
  type: "position" | "portfolio" | "market" | "system";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  details: Record<string, unknown>;
  recommendations: string[];
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
}

export interface StressTestScenario {
  name: string;
  description: string;
  marketShock: {
    priceChange: number; // Percentage change
    volatilityIncrease: number; // Multiplier
    liquidityReduction: number; // Percentage reduction
  };
  expectedLoss: number; // Expected portfolio loss
  recoveryTime: number; // Expected recovery time (hours)
}

/**
 * Advanced Risk Management Engine
 *
 * Provides comprehensive risk management with:
 * - Real-time position and portfolio risk monitoring
 * - Dynamic stop-loss and take-profit adjustments
 * - Multi-layered risk assessments
 * - Stress testing and scenario analysis
 * - Adaptive risk scaling based on market conditions
 */
export class AdvancedRiskEngine {
  private config: RiskEngineConfig;
  private circuitBreaker: CircuitBreaker;
  private alerts: RiskAlert[] = [];
  private lastRiskUpdate = 0;
  private marketConditions: MarketConditions;
  private positions: Map<string, PositionRiskProfile> = new Map();
  private historicalMetrics: PortfolioRiskMetrics[] = [];

  constructor(config?: Partial<RiskEngineConfig>) {
    this.config = this.mergeWithDefaultConfig(config);
    this.circuitBreaker = circuitBreakerRegistry.getBreaker("advanced-risk-engine", {
      failureThreshold: 3,
      recoveryTimeout: 30000,
      expectedFailureRate: 0.1,
    });

    // Initialize market conditions
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
    };

    console.log("[AdvancedRiskEngine] Initialized with comprehensive risk management");
  }

  /**
   * Perform comprehensive risk assessment for a potential trade
   */
  async assessTradeRisk(
    symbol: string,
    side: "buy" | "sell",
    quantity: number,
    price: number,
    marketData?: Record<string, unknown>
  ): Promise<TradeRiskAssessment & { advancedMetrics: Record<string, number> }> {
    return await this.circuitBreaker.execute(async () => {
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
    });
  }

  /**
   * Update market conditions for risk calculations
   */
  async updateMarketConditions(conditions: Partial<MarketConditions>): Promise<void> {
    this.marketConditions = {
      ...this.marketConditions,
      ...conditions,
      timestamp: new Date().toISOString(),
    };

    // Check for emergency market conditions
    await this.checkEmergencyMarketConditions();

    this.lastRiskUpdate = Date.now();
    console.log("[AdvancedRiskEngine] Market conditions updated");
  }

  /**
   * Add or update position in risk tracking
   */
  async updatePosition(position: PositionRiskProfile): Promise<void> {
    this.positions.set(position.symbol, position);

    // Recalculate portfolio risk metrics
    const portfolioMetrics = await this.calculatePortfolioRiskMetrics();
    this.historicalMetrics.push(portfolioMetrics);

    // Keep only last 1000 historical metrics
    if (this.historicalMetrics.length > 1000) {
      this.historicalMetrics = this.historicalMetrics.slice(-1000);
    }

    // Check for risk threshold breaches
    await this.checkRiskThresholds(portfolioMetrics);
  }

  /**
   * Remove position from risk tracking
   */
  removePosition(symbol: string): void {
    this.positions.delete(symbol);
    console.log(`[AdvancedRiskEngine] Removed position tracking for ${symbol}`);
  }

  /**
   * Get current portfolio risk metrics
   */
  async getPortfolioRiskMetrics(): Promise<PortfolioRiskMetrics> {
    return await this.calculatePortfolioRiskMetrics();
  }

  /**
   * Perform stress testing on current portfolio
   */
  async performStressTest(scenarios?: StressTestScenario[]): Promise<{
    scenarios: StressTestScenario[];
    results: Array<{
      scenario: string;
      estimatedLoss: number;
      portfolioImpact: number;
      recoveryTime: number;
      riskScore: number;
    }>;
  }> {
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
      for (const position of this.positions.values()) {
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
   * Get dynamic stop-loss recommendation for a position
   */
  calculateDynamicStopLoss(
    symbol: string,
    entryPrice: number,
    currentPrice: number
  ): { stopLossPrice: number; reasoning: string } {
    const position = this.positions.get(symbol);
    const volatility = this.marketConditions.volatilityIndex / 100;
    const liquidity = this.marketConditions.liquidityIndex / 100;

    // Base stop-loss at 2-5% depending on market conditions
    let stopLossPercent = 0.02; // 2% base

    // Adjust for volatility (higher volatility = wider stop loss)
    stopLossPercent += volatility * 0.03; // Up to +3%

    // Adjust for liquidity (lower liquidity = wider stop loss)
    stopLossPercent += (1 - liquidity) * 0.02; // Up to +2%

    // Adjust for position size (larger positions = tighter stop loss)
    if (position) {
      const positionSizeRatio = position.size / this.config.maxSinglePositionSize;
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
    entryPrice: number,
    currentPrice: number
  ): { takeProfitPrice: number; reasoning: string } {
    const position = this.positions.get(symbol);
    const volatility = this.marketConditions.volatilityIndex / 100;
    const sentiment = this.marketConditions.marketSentiment;

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
      const positionSizeRatio = position.size / this.config.maxSinglePositionSize;
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
   * Get active risk alerts
   */
  getActiveAlerts(): RiskAlert[] {
    return this.alerts.filter((alert) => !alert.resolved);
  }

  /**
   * Get risk engine health status
   */
  getHealthStatus(): {
    healthy: boolean;
    issues: string[];
    metrics: {
      lastUpdate: number;
      alertCount: number;
      positionCount: number;
      portfolioValue: number;
      riskScore: number;
    };
  } {
    const issues: string[] = [];
    const currentTime = Date.now();

    // Check for stale data
    if (currentTime - this.lastRiskUpdate > 300000) {
      // 5 minutes
      issues.push("Risk data is stale (>5 minutes old)");
    }

    // Check for excessive alerts
    const activeAlerts = this.getActiveAlerts();
    if (activeAlerts.length > 10) {
      issues.push(`High number of active alerts: ${activeAlerts.length}`);
    }

    // Check for critical alerts
    const criticalAlerts = activeAlerts.filter((alert) => alert.severity === "critical");
    if (criticalAlerts.length > 0) {
      issues.push(`${criticalAlerts.length} critical alerts require attention`);
    }

    // Check circuit breaker status
    if (!this.circuitBreaker.isHealthy()) {
      issues.push("Risk engine circuit breaker is unhealthy");
    }

    const portfolioValue = this.calculatePortfolioValue();
    const riskScore = this.calculateCurrentRiskScore();

    return {
      healthy: issues.length === 0,
      issues,
      metrics: {
        lastUpdate: this.lastRiskUpdate,
        alertCount: activeAlerts.length,
        positionCount: this.positions.size,
        portfolioValue,
        riskScore,
      },
    };
  }

  // Private helper methods
  private mergeWithDefaultConfig(partial?: Partial<RiskEngineConfig>): RiskEngineConfig {
    const defaultConfig: RiskEngineConfig = {
      maxPortfolioValue: 100000,
      maxSinglePositionSize: 10000,
      maxConcurrentPositions: 10,
      maxDailyLoss: 2000,
      maxDrawdown: 10,
      confidenceLevel: 0.95,
      lookbackPeriod: 30,
      correlationThreshold: 0.7,
      volatilityMultiplier: 1.5,
      adaptiveRiskScaling: true,
      marketRegimeDetection: true,
      stressTestingEnabled: true,
      emergencyVolatilityThreshold: 80,
      emergencyLiquidityThreshold: 20,
      emergencyCorrelationThreshold: 0.9,
    };

    return { ...defaultConfig, ...partial };
  }

  private calculatePositionSizeRisk(tradeValue: number): number {
    const sizeRatio = tradeValue / this.config.maxSinglePositionSize;
    return Math.min(sizeRatio * 100, 100);
  }

  private calculateConcentrationRisk(symbol: string, tradeValue: number): number {
    const portfolioValue = this.calculatePortfolioValue();
    const concentrationRatio = tradeValue / portfolioValue;
    return Math.min(concentrationRatio * 200, 100); // Scale up concentration risk
  }

  private calculateCorrelationRisk(symbol: string, tradeValue: number): number {
    // For now, use market correlation risk
    // In production, would calculate actual position correlations
    return this.marketConditions.correlationRisk * 100;
  }

  private calculateMarketRisk(symbol: string, marketData?: Record<string, unknown>): number {
    let risk = this.marketConditions.volatilityIndex;

    // Adjust for market sentiment
    if (this.marketConditions.marketSentiment === "volatile") {
      risk *= 1.3;
    } else if (this.marketConditions.marketSentiment === "bearish") {
      risk *= 1.1;
    }

    return Math.min(risk, 100);
  }

  private calculateLiquidityRisk(symbol: string, quantity: number): number {
    const liquidityScore = this.marketConditions.liquidityIndex;
    return Math.max(0, 100 - liquidityScore);
  }

  private calculatePortfolioValue(): number {
    return Array.from(this.positions.values()).reduce((total, pos) => total + pos.size, 0);
  }

  private getVolatilityAdjustment(): number {
    const volatility = this.marketConditions.volatilityIndex / 100;
    return 1 + (volatility * this.config.volatilityMultiplier - 1);
  }

  private getLiquidityAdjustment(): number {
    const liquidity = this.marketConditions.liquidityIndex / 100;
    return 1 + (1 - liquidity) * 0.5; // Up to 50% increase for low liquidity
  }

  private getSentimentAdjustment(): number {
    switch (this.marketConditions.marketSentiment) {
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

  private calculateMaxAllowedSize(symbol: string, riskScore: number): number {
    let baseSize = this.config.maxSinglePositionSize;

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
    const remainingCapacity = this.config.maxPortfolioValue - portfolioValue;

    return Math.min(baseSize, remainingCapacity);
  }

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
    if (portfolioValue + tradeValue > this.config.maxPortfolioValue) return false;

    return true;
  }

  private calculateTradeVaR(tradeValue: number, symbol: string): number {
    const volatility = this.marketConditions.volatilityIndex / 100;
    const confidenceMultiplier = this.config.confidenceLevel === 0.95 ? 1.645 : 1.96;
    return tradeValue * volatility * confidenceMultiplier;
  }

  private calculateTradeExpectedShortfall(tradeValue: number, symbol: string): number {
    const var95 = this.calculateTradeVaR(tradeValue, symbol);
    return var95 * 1.3; // Typical ES/VaR ratio
  }

  private async calculatePortfolioRiskMetrics(): Promise<PortfolioRiskMetrics> {
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
      diversificationScore,
      concentrationRisk,
      correlationMatrix: [], // Simplified for now
      valueAtRisk95: portfolioVar,
      expectedShortfall: portfolioVar * 1.3,
      sharpeRatio: 0, // Would need return data
      maxDrawdownRisk: positions.reduce((max, pos) => Math.max(max, pos.maxDrawdown), 0),
      liquidityRisk: Math.max(0, 100 - this.marketConditions.liquidityIndex),
    };
  }

  private async checkRiskThresholds(metrics: PortfolioRiskMetrics): Promise<void> {
    const alerts: RiskAlert[] = [];

    // Check portfolio value limit
    if (metrics.totalValue > this.config.maxPortfolioValue) {
      alerts.push(
        this.createAlert(
          "portfolio",
          "critical",
          "Portfolio value exceeds maximum limit",
          { current: metrics.totalValue, limit: this.config.maxPortfolioValue },
          ["Reduce position sizes", "Close some positions"]
        )
      );
    }

    // Check concentration risk
    if (metrics.concentrationRisk > 50) {
      alerts.push(
        this.createAlert(
          "portfolio",
          "high",
          "High portfolio concentration risk detected",
          { concentrationRisk: metrics.concentrationRisk },
          ["Diversify positions", "Reduce largest position size"]
        )
      );
    }

    // Check VaR limits
    const varPercentage = (metrics.valueAtRisk95 / metrics.totalValue) * 100;
    if (varPercentage > 15) {
      alerts.push(
        this.createAlert(
          "portfolio",
          "high",
          "Portfolio Value at Risk exceeds recommended limits",
          { varPercentage, var95: metrics.valueAtRisk95 },
          ["Reduce position sizes", "Hedge positions", "Increase diversification"]
        )
      );
    }

    // Add alerts to the list
    this.alerts.push(...alerts);
  }

  private async checkEmergencyMarketConditions(): Promise<void> {
    const alerts: RiskAlert[] = [];

    // Check volatility
    if (this.marketConditions.volatilityIndex > this.config.emergencyVolatilityThreshold) {
      alerts.push(
        this.createAlert(
          "market",
          "critical",
          "Emergency volatility threshold breached",
          { volatility: this.marketConditions.volatilityIndex },
          ["Halt new trades", "Reduce position sizes", "Activate emergency protocols"]
        )
      );
    }

    // Check liquidity
    if (this.marketConditions.liquidityIndex < this.config.emergencyLiquidityThreshold) {
      alerts.push(
        this.createAlert(
          "market",
          "critical",
          "Emergency liquidity threshold breached",
          { liquidity: this.marketConditions.liquidityIndex },
          ["Halt trading", "Monitor positions closely", "Prepare for emergency exit"]
        )
      );
    }

    // Add alerts
    this.alerts.push(...alerts);
  }

  private calculateCurrentRiskScore(): number {
    const portfolioValue = this.calculatePortfolioValue();
    if (portfolioValue === 0) return 0;

    let score = 0;

    // Portfolio size risk (25% weight)
    score += (portfolioValue / this.config.maxPortfolioValue) * 25;

    // Market risk (40% weight)
    score += (this.marketConditions.volatilityIndex / 100) * 40;

    // Liquidity risk (20% weight)
    score += (1 - this.marketConditions.liquidityIndex / 100) * 20;

    // Active alert risk (15% weight)
    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter((a) => a.severity === "critical").length;
    score += Math.min(criticalAlerts * 5, 15);

    return Math.min(score, 100);
  }

  private createAlert(
    type: RiskAlert["type"],
    severity: RiskAlert["severity"],
    message: string,
    details: Record<string, unknown>,
    recommendations: string[]
  ): RiskAlert {
    return {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message,
      details,
      recommendations,
      timestamp: new Date().toISOString(),
      resolved: false,
    };
  }
}
