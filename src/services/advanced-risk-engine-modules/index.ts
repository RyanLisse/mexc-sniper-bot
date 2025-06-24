import { createLogger } from "../../lib/structured-logger";

/**
 * Advanced Risk Engine - Modular Integration
 *
 * Main entry point for the modular Advanced Risk Engine. This module integrates
 * all the specialized modules and provides backward compatibility with the
 * original AdvancedRiskEngine interface.
 *
 * Modules:
 * - Core Risk Assessment: Main risk calculation logic
 * - Market Conditions Manager: Market data and portfolio management
 * - Dynamic Calculations: Stop-loss, take-profit, and adaptive calculations
 * - Stress Testing Validation: Stress testing and emergency protocols
 * - Event Management Health: Event emission and health monitoring
 *
 * This refactoring maintains 100% backward compatibility while providing
 * improved modularity, testability, and maintainability.
 */

import { EventEmitter } from "events";
import type { TradeRiskAssessment } from "../../mexc-agents/risk-manager-agent";
// Import schemas and types
import type {
  MarketConditions,
  PortfolioRiskMetrics,
  PositionRiskProfile,
  RiskAlert,
  RiskEngineConfig,
  StressTestScenario,
} from "../../schemas/risk-engine-schemas-extracted";
import { type CircuitBreaker, circuitBreakerRegistry } from "../circuit-breaker";

// Import modular components
import {
  CoreRiskAssessment,
  type CoreRiskAssessmentConfig,
  createCoreRiskAssessment,
  type TradeRiskResult,
} from "./core-risk-assessment";
import {
  createDynamicCalculations,
  type DiversificationAssessment,
  DynamicCalculations,
  type DynamicCalculationsConfig,
  type PositionSizeValidation,
  type StopLossRecommendation,
  type StopLossValidation,
  type TakeProfitRecommendation,
  type VolatilityAdjustment,
} from "./dynamic-calculations";
import {
  createEventManagementHealth,
  type EventManagementConfig,
  EventManagementHealth,
  type HealthStatus,
} from "./event-management-health";
import {
  createMarketConditionsManager,
  MarketConditionsManager,
  type MarketConditionsManagerConfig,
  type PortfolioUpdate,
} from "./market-conditions-manager";
import {
  createStressTestingValidation,
  type FlashCrashDetection,
  type LiquidityAssessment,
  type ManipulationDetection,
  type PortfolioRiskCalculation,
  type StressTestingConfig,
  StressTestingValidation,
  type StressTestResult,
} from "./stress-testing-validation";

// Re-export types for backward compatibility
export type {
  MarketConditions,
  PositionRiskProfile,
  PortfolioRiskMetrics,
  RiskEngineConfig,
  RiskAlert,
  StressTestScenario,
};

/**
 * Advanced Risk Management Engine - Modular Implementation
 *
 * Provides comprehensive risk management with:
 * - Real-time position and portfolio risk monitoring
 * - Dynamic stop-loss and take-profit adjustments
 * - Multi-layered risk assessments
 * - Stress testing and scenario analysis
 * - Adaptive risk scaling based on market conditions
 *
 * This modular implementation maintains full backward compatibility
 * while providing improved architecture and maintainability.
 */
export class AdvancedRiskEngine extends EventEmitter {
  private logger = createLogger("index");

  private config: RiskEngineConfig;
  private circuitBreaker: CircuitBreaker;

  // Module instances
  private coreRiskAssessment!: CoreRiskAssessment;
  private marketConditionsManager!: MarketConditionsManager;
  private dynamicCalculations!: DynamicCalculations;
  private stressTestingValidation!: StressTestingValidation;
  private eventManagementHealth!: EventManagementHealth;

  // Shared state
  private positions: Map<string, PositionRiskProfile> = new Map();

  constructor(config?: Partial<RiskEngineConfig>) {
    super();
    this.config = this.mergeWithDefaultConfig(config);
    this.circuitBreaker = circuitBreakerRegistry.getBreaker("advanced-risk-engine", {
      failureThreshold: 3,
      recoveryTimeout: 30000,
      expectedFailureRate: 0.1,
    });

    // Initialize modules
    this.initializeModules();

    logger.info("[AdvancedRiskEngine] Initialized with modular architecture");
  }

  /**
   * Initialize all modules with shared configuration
   */
  private initializeModules(): void {
    // Initialize market conditions manager first
    this.marketConditionsManager = createMarketConditionsManager({
      riskConfig: this.config,
      initialMarketConditions: {
        volatilityIndex: 50,
        liquidityIndex: 80,
        orderBookDepth: 100000,
        bidAskSpread: 0.1,
        tradingVolume24h: 1000000,
        priceChange24h: 0,
        correlationRisk: 0.3,
        marketSentiment: "neutral",
        timestamp: new Date().toISOString(),
      },
    });

    // Get initial market conditions
    const marketConditions = this.marketConditionsManager.getMarketConditions();

    // Initialize core risk assessment
    this.coreRiskAssessment = createCoreRiskAssessment({
      riskConfig: this.config,
      marketConditions,
      positions: this.positions,
    });

    // Initialize dynamic calculations
    this.dynamicCalculations = createDynamicCalculations({
      riskConfig: this.config,
      marketConditions,
      positions: this.positions,
    });

    // Initialize stress testing validation
    this.stressTestingValidation = createStressTestingValidation({
      riskConfig: this.config,
      marketConditions,
      positions: this.positions,
    });

    // Initialize event management health
    this.eventManagementHealth = createEventManagementHealth({
      riskConfig: this.config,
      marketConditions,
      positions: this.positions,
      circuitBreaker: this.circuitBreaker,
    });

    // Forward events from modules to main event emitter
    this.setupEventForwarding();
  }

  /**
   * Setup event forwarding from modules to main event emitter
   */
  private setupEventForwarding(): void {
    // Forward all events from event management module
    const events = [
      "risk_alert",
      "alert_resolved",
      "risk_threshold_exceeded",
      "emergency_stop",
      "emergency_stop_reset",
      "position_risk_update",
    ];

    events.forEach((eventName) => {
      this.eventManagementHealth.on(eventName, (data) => {
        this.emit(eventName, data);
      });
    });
  }

  /**
   * Update all modules with current state
   */
  private updateAllModules(): void {
    const marketConditions = this.marketConditionsManager.getMarketConditions();

    this.coreRiskAssessment.updateConfig({
      riskConfig: this.config,
      marketConditions,
      positions: this.positions,
    });

    this.dynamicCalculations.updateConfig({
      riskConfig: this.config,
      marketConditions,
      positions: this.positions,
    });

    this.stressTestingValidation.updateConfig({
      riskConfig: this.config,
      marketConditions,
      positions: this.positions,
    });

    this.eventManagementHealth.updateConfig({
      riskConfig: this.config,
      marketConditions,
      positions: this.positions,
      circuitBreaker: this.circuitBreaker,
    });
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
      const result = await this.coreRiskAssessment.assessTradeRisk(
        symbol,
        side,
        quantity,
        price,
        marketData
      );

      // Convert TradeRiskResult to expected format
      return {
        approved: result.approved,
        riskScore: result.riskScore,
        reasons: result.reasons,
        warnings: result.warnings,
        maxAllowedSize: result.maxAllowedSize,
        estimatedImpact: result.estimatedImpact,
        advancedMetrics: result.advancedMetrics as Record<string, number>,
      };
    });
  }

  /**
   * Update market conditions for risk calculations with validation
   */
  async updateMarketConditions(conditions: Partial<MarketConditions>): Promise<void> {
    await this.marketConditionsManager.updateMarketConditions(conditions);

    // Check for emergency market conditions
    await this.eventManagementHealth.checkEmergencyMarketConditions();

    this.updateAllModules();
    this.eventManagementHealth.updateLastRiskUpdate();
  }

  /**
   * Add or update position in risk tracking with validation
   */
  async updatePosition(position: PositionRiskProfile): Promise<void> {
    // Update in market conditions manager (handles validation)
    await this.marketConditionsManager.updatePosition(position);

    // Update local positions map
    this.positions.set(position.symbol, position);

    // Recalculate portfolio risk metrics
    const portfolioMetrics = await this.marketConditionsManager.getPortfolioRiskMetrics();

    // Check for risk threshold breaches
    await this.eventManagementHealth.checkRiskThresholds(portfolioMetrics);

    this.updateAllModules();
  }

  /**
   * Remove position from risk tracking
   */
  removePosition(symbol: string): void {
    this.marketConditionsManager.removePosition(symbol);
    this.positions.delete(symbol);
    this.updateAllModules();
    logger.info(`[AdvancedRiskEngine] Removed position tracking for ${symbol}`);
  }

  /**
   * Get current portfolio risk metrics
   */
  async getPortfolioRiskMetrics(): Promise<PortfolioRiskMetrics> {
    return await this.marketConditionsManager.getPortfolioRiskMetrics();
  }

  /**
   * Perform stress testing on current portfolio
   */
  async performStressTest(scenarios?: StressTestScenario[]): Promise<StressTestResult> {
    return await this.stressTestingValidation.performStressTest(scenarios);
  }

  /**
   * Get dynamic stop-loss recommendation for a position
   */
  calculateDynamicStopLoss(
    symbol: string,
    entryPrice: number,
    currentPrice: number
  ): StopLossRecommendation {
    return this.dynamicCalculations.calculateDynamicStopLoss(symbol, entryPrice, currentPrice);
  }

  /**
   * Get dynamic take-profit recommendation for a position
   */
  calculateDynamicTakeProfit(
    symbol: string,
    entryPrice: number,
    currentPrice: number
  ): TakeProfitRecommendation {
    return this.dynamicCalculations.calculateDynamicTakeProfit(symbol, entryPrice, currentPrice);
  }

  /**
   * Get active risk alerts
   */
  getActiveAlerts(): RiskAlert[] {
    return this.eventManagementHealth.getActiveAlerts();
  }

  /**
   * Get risk engine health status
   */
  getHealthStatus(): HealthStatus {
    return this.eventManagementHealth.getHealthStatus();
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
    return await this.dynamicCalculations.validatePositionSize(positionRequest);
  }

  /**
   * Update portfolio risk metrics
   */
  async updatePortfolioRisk(riskLevel: number): Promise<void> {
    await this.eventManagementHealth.updatePortfolioRisk(riskLevel);
  }

  /**
   * Check if emergency stop is currently active
   */
  isEmergencyStopActive(): boolean {
    return this.eventManagementHealth.isEmergencyStopActive();
  }

  /**
   * Update portfolio metrics with new data
   */
  async updatePortfolioMetrics(update: PortfolioUpdate): Promise<void> {
    await this.marketConditionsManager.updatePortfolioMetrics(update);
    this.updateAllModules();
  }

  /**
   * Alias for isEmergencyStopActive to match test expectations
   */
  isEmergencyModeActive(): boolean {
    return this.eventManagementHealth.isEmergencyModeActive();
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
    await this.marketConditionsManager.updatePortfolioPositions(portfolioPositions);

    // Update local positions map
    for (const pos of portfolioPositions) {
      const existing = this.positions.get(pos.symbol);
      if (existing) {
        existing.size = pos.value;
        if (pos.correlation !== undefined) {
          existing.correlationScore = pos.correlation;
        }
      }
    }

    this.updateAllModules();
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
    return await this.dynamicCalculations.assessDiversificationRisk(newPosition);
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
    await this.marketConditionsManager.updateCorrelationMatrix(
      correlatedPositions,
      marketStressEvent
    );
    this.updateAllModules();
  }

  /**
   * Calculate correlation risk across portfolio
   */
  async calculateCorrelationRisk(): Promise<{
    overallCorrelation: number;
    riskLevel: "low" | "medium" | "high" | "critical";
    recommendedAction: "monitor" | "reduce_positions" | "emergency_exit";
  }> {
    return await this.marketConditionsManager.calculateCorrelationRisk();
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
    return await this.dynamicCalculations.calculateVolatilityAdjustedPosition(positionRequest);
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
    return await this.dynamicCalculations.validateStopLossPlacement(options);
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
    await this.stressTestingValidation.updatePositionRisk(symbol, riskData);

    // Update position in local map
    const position = this.positions.get(symbol);
    if (position) {
      const priceChange =
        ((riskData.currentPrice - riskData.entryPrice) / riskData.entryPrice) * 100;
      const drawdown = priceChange < 0 ? Math.abs(priceChange) : 0;

      position.unrealizedPnL = riskData.unrealizedPnL;
      position.size = riskData.positionSize * riskData.currentPrice;
      position.maxDrawdown = Math.max(position.maxDrawdown, drawdown);

      // Emit position risk update event
      this.eventManagementHealth.emitPositionRiskUpdate({
        symbol,
        drawdown,
        riskLevel: drawdown > 20 ? "high" : drawdown > 10 ? "medium" : "low",
        unrealizedPnL: riskData.unrealizedPnL,
        currentPrice: riskData.currentPrice,
      });
    }

    this.updateAllModules();
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
    return await this.stressTestingValidation.detectFlashCrash(priceSequence);
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
    return await this.dynamicCalculations.calculateAdaptiveThresholds(regime);
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
  }): Promise<{
    portfolioSurvival: boolean;
    maxDrawdown: number;
    emergencyActionsTriggered: number;
  }> {
    return await this.stressTestingValidation.runStressTest(scenario);
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
    return await this.stressTestingValidation.assessLiquidityRisk(conditions);
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
    return await this.stressTestingValidation.detectManipulation(activity);
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
    return await this.stressTestingValidation.validateTrade(options);
  }

  /**
   * Calculate overall portfolio risk
   */
  async calculatePortfolioRisk(): Promise<PortfolioRiskCalculation> {
    return await this.stressTestingValidation.calculatePortfolioRisk();
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
}

// Factory function for creating advanced risk engine
export function createAdvancedRiskEngine(config?: Partial<RiskEngineConfig>): AdvancedRiskEngine {
  return new AdvancedRiskEngine(config);
}

// Export individual modules for direct access if needed
export {
  CoreRiskAssessment,
  MarketConditionsManager,
  DynamicCalculations,
  StressTestingValidation,
  EventManagementHealth,
  createCoreRiskAssessment,
  createMarketConditionsManager,
  createDynamicCalculations,
  createStressTestingValidation,
  createEventManagementHealth,
};

// Export module-specific types
export type {
  CoreRiskAssessmentConfig,
  MarketConditionsManagerConfig,
  DynamicCalculationsConfig,
  StressTestingConfig,
  EventManagementConfig,
  TradeRiskResult,
  PortfolioUpdate,
  StopLossRecommendation,
  TakeProfitRecommendation,
  PositionSizeValidation,
  VolatilityAdjustment,
  StopLossValidation,
  DiversificationAssessment,
  StressTestResult,
  FlashCrashDetection,
  ManipulationDetection,
  LiquidityAssessment,
  PortfolioRiskCalculation,
  HealthStatus,
};
