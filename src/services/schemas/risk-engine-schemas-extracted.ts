/**
 * Risk Engine Schemas - Extracted Types
 *
 * This file contains comprehensive TypeScript types and Zod schemas for the Risk Engine system.
 * These schemas are used across multiple risk management modules to ensure type safety and validation.
 *
 * Key Schema Categories:
 * - Market Conditions: Real-time market data and sentiment
 * - Position Risk: Individual position risk profiles and metrics
 * - Portfolio Risk: Portfolio-level risk assessment and metrics
 * - Risk Configuration: Engine configuration and thresholds
 * - Risk Alerts: Alert definitions and management
 * - Stress Testing: Scenario definitions and test structures
 *
 * All schemas include both TypeScript types and Zod validation schemas.
 */

import { z } from "zod";

// =============================================================================
// MARKET CONDITIONS SCHEMAS
// =============================================================================

/**
 * Market sentiment types
 */
export const MarketSentimentSchema = z.enum([
  "bullish",
  "bearish",
  "neutral",
  "volatile",
]);

export type MarketSentiment = z.infer<typeof MarketSentimentSchema>;

/**
 * Real-time market conditions and data
 */
export const MarketConditionsSchema = z.object({
  /** Market volatility index (0-100) */
  volatilityIndex: z.number().min(0).max(100),

  /** Market liquidity index (0-100) */
  liquidityIndex: z.number().min(0).max(100),

  /** Order book depth in USDT */
  orderBookDepth: z.number().min(0),

  /** Bid-ask spread percentage */
  bidAskSpread: z.number().min(0),

  /** 24-hour trading volume */
  tradingVolume24h: z.number().min(0),

  /** 24-hour price change percentage */
  priceChange24h: z.number(),

  /** Portfolio correlation risk (0-1) */
  correlationRisk: z.number().min(0).max(1),

  /** Current market sentiment */
  marketSentiment: MarketSentimentSchema,

  /** Timestamp of market data */
  timestamp: z.string(),
});

export type MarketConditions = z.infer<typeof MarketConditionsSchema>;

// =============================================================================
// POSITION RISK SCHEMAS
// =============================================================================

/**
 * Individual position risk profile
 */
export const PositionRiskProfileSchema = z.object({
  /** Trading symbol */
  symbol: z.string(),

  /** Position size in USDT */
  size: z.number().min(0),

  /** Unrealized profit/loss */
  unrealizedPnL: z.number(),

  /** Maximum drawdown percentage */
  maxDrawdown: z.number().min(0).max(100),

  /** Position correlation score with portfolio */
  correlationScore: z.number().min(-1).max(1),

  /** Position exposure percentage */
  exposure: z.number().min(0),

  /** Position leverage */
  leverage: z.number().min(0),

  /** Value at Risk for position */
  valueAtRisk: z.number().min(0),

  /** Time held in hours */
  timeHeld: z.number().min(0),

  /** Stop loss distance percentage */
  stopLossDistance: z.number().min(0),

  /** Take profit distance percentage */
  takeProfitDistance: z.number().min(0),
});

export type PositionRiskProfile = z.infer<typeof PositionRiskProfileSchema>;

// =============================================================================
// PORTFOLIO RISK SCHEMAS
// =============================================================================

/**
 * Portfolio-level risk metrics and assessment
 */
export const PortfolioRiskMetricsSchema = z.object({
  /** Total portfolio value in USDT */
  totalValue: z.number().min(0),

  /** Total portfolio exposure */
  totalExposure: z.number().min(0),

  /** Number of active positions */
  totalPositions: z.number().min(0),

  /** Portfolio concentration risk percentage */
  concentrationRisk: z.number().min(0).max(100),

  /** Value at Risk (95% confidence) */
  valueAtRisk95: z.number().min(0),

  /** Expected shortfall */
  expectedShortfall: z.number().min(0),

  /** Portfolio beta (market correlation) */
  beta: z.number(),

  /** Average correlation between positions */
  averageCorrelation: z.number().min(-1).max(1),

  /** Portfolio Sharpe ratio */
  sharpeRatio: z.number(),

  /** Total unrealized P&L */
  totalUnrealizedPnL: z.number(),

  /** Maximum single position size percentage */
  maxSinglePositionPercent: z.number().min(0).max(100),

  /** Current drawdown percentage */
  currentDrawdown: z.number().min(0).max(100),

  /** Maximum drawdown risk */
  maxDrawdownRisk: z.number().min(0).max(100),

  /** Portfolio diversification score */
  diversificationScore: z.number().min(0).max(100),

  /** Liquidity risk assessment */
  liquidityRisk: z.number().min(0).max(100),

  /** Last calculation timestamp */
  timestamp: z.string(),
});

export type PortfolioRiskMetrics = z.infer<typeof PortfolioRiskMetricsSchema>;

// =============================================================================
// RISK ENGINE CONFIGURATION SCHEMAS
// =============================================================================

/**
 * Risk engine configuration and limits
 */
export const RiskEngineConfigSchema = z.object({
  /** Maximum total portfolio value in USDT */
  maxPortfolioValue: z.number().min(0),

  /** Maximum single position size in USDT */
  maxSinglePositionSize: z.number().min(0),

  /** Maximum number of concurrent positions */
  maxConcurrentPositions: z.number().min(1),

  /** Maximum daily loss limit in USDT */
  maxDailyLoss: z.number().min(0),

  /** Maximum portfolio drawdown percentage */
  maxDrawdown: z.number().min(0).max(100),

  /** Risk confidence level (e.g., 0.95 for 95%) */
  confidenceLevel: z.number().min(0).max(1),

  /** Lookback period for calculations (days) */
  lookbackPeriod: z.number().min(1),

  /** Correlation threshold for risk assessment */
  correlationThreshold: z.number().min(0).max(1),

  /** Volatility multiplier for position sizing */
  volatilityMultiplier: z.number().min(0),

  /** Enable adaptive risk scaling */
  adaptiveRiskScaling: z.boolean(),

  /** Enable market regime detection */
  marketRegimeDetection: z.boolean(),

  /** Enable stress testing */
  stressTestingEnabled: z.boolean(),

  /** Emergency volatility threshold */
  emergencyVolatilityThreshold: z.number().min(0).max(100),

  /** Emergency liquidity threshold */
  emergencyLiquidityThreshold: z.number().min(0).max(100),

  /** Emergency correlation threshold */
  emergencyCorrelationThreshold: z.number().min(0).max(1),
});

export type RiskEngineConfig = z.infer<typeof RiskEngineConfigSchema>;

// =============================================================================
// RISK ALERT SCHEMAS
// =============================================================================

/**
 * Risk alert severity levels
 */
export const AlertSeveritySchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

export type AlertSeverity = z.infer<typeof AlertSeveritySchema>;

/**
 * Risk alert types
 */
export const AlertTypeSchema = z.enum([
  "portfolio",
  "position",
  "market",
  "liquidity",
  "correlation",
  "volatility",
  "system",
]);

export type AlertType = z.infer<typeof AlertTypeSchema>;

/**
 * Risk alert structure
 */
export const RiskAlertSchema = z.object({
  /** Unique alert identifier */
  id: z.string(),

  /** Alert type category */
  type: AlertTypeSchema,

  /** Alert severity level */
  severity: AlertSeveritySchema,

  /** Alert message */
  message: z.string(),

  /** Additional alert details */
  details: z.record(z.unknown()),

  /** Recommended actions */
  recommendations: z.array(z.string()),

  /** Alert creation timestamp */
  timestamp: z.string(),

  /** Whether alert is resolved */
  resolved: z.boolean(),

  /** Resolution timestamp (optional) */
  resolvedAt: z.string().optional(),
});

export type RiskAlert = z.infer<typeof RiskAlertSchema>;

// =============================================================================
// STRESS TESTING SCHEMAS
// =============================================================================

/**
 * Stress test scenario types
 */
export const StressTestTypeSchema = z.enum([
  "market_crash",
  "flash_crash",
  "liquidity_crisis",
  "correlation_spike",
  "volatility_explosion",
  "black_swan",
  "custom",
]);

export type StressTestType = z.infer<typeof StressTestTypeSchema>;

/**
 * Stress test scenario definition
 */
export const StressTestScenarioSchema = z.object({
  /** Scenario identifier */
  id: z.string().optional(),

  /** Scenario name */
  name: z.string(),

  /** Scenario type */
  type: StressTestTypeSchema.optional(),

  /** Scenario description */
  description: z.string(),

  /** Price shock percentages by symbol */
  priceShocks: z.record(z.number()).optional(),

  /** Volatility increase multiplier */
  volatilityMultiplier: z.number().min(0).optional(),

  /** Liquidity reduction percentage */
  liquidityReduction: z.number().min(0).max(100).optional(),

  /** Correlation increase (0-1) */
  correlationIncrease: z.number().min(0).max(1).optional(),

  /** Scenario duration in hours */
  duration: z.number().min(0).optional(),

  /** Probability of occurrence */
  probability: z.number().min(0).max(1).optional(),

  /** Market shock configuration */
  marketShock: z
    .object({
      priceChange: z.number(),
      volatilityIncrease: z.number().min(0),
      liquidityReduction: z.number().min(0).max(100),
    })
    .optional(),

  /** Expected loss percentage */
  expectedLoss: z.number().min(0).optional(),

  /** Recovery time in hours */
  recoveryTime: z.number().min(0).optional(),
});

export type StressTestScenario = z.infer<typeof StressTestScenarioSchema>;

// =============================================================================
// ADVANCED RISK METRICS SCHEMAS
// =============================================================================

/**
 * Advanced risk metrics for detailed analysis
 */
export const AdvancedRiskMetricsSchema = z.object({
  /** Information ratio */
  informationRatio: z.number(),

  /** Sortino ratio */
  sortinoRatio: z.number(),

  /** Calmar ratio */
  calmarRatio: z.number(),

  /** Maximum consecutive losses */
  maxConsecutiveLosses: z.number().min(0),

  /** Average win/loss ratio */
  winLossRatio: z.number().min(0),

  /** Portfolio skewness */
  skewness: z.number(),

  /** Portfolio kurtosis */
  kurtosis: z.number(),

  /** Tracking error */
  trackingError: z.number().min(0),

  /** Alpha generation */
  alpha: z.number(),

  /** Risk-adjusted returns */
  riskAdjustedReturns: z.number(),
});

export type AdvancedRiskMetrics = z.infer<typeof AdvancedRiskMetricsSchema>;

// =============================================================================
// MARKET REGIME SCHEMAS
// =============================================================================

/**
 * Market regime types
 */
export const MarketRegimeSchema = z.enum([
  "bull_market",
  "bear_market",
  "sideways",
  "high_volatility",
  "low_volatility",
  "crisis",
  "recovery",
]);

export type MarketRegime = z.infer<typeof MarketRegimeSchema>;

/**
 * Market regime information
 */
export const MarketRegimeInfoSchema = z.object({
  /** Current market regime */
  regime: MarketRegimeSchema,

  /** Regime confidence (0-1) */
  confidence: z.number().min(0).max(1),

  /** Regime duration in days */
  duration: z.number().min(0),

  /** Expected regime duration in days */
  expectedDuration: z.number().min(0),

  /** Regime transition probability */
  transitionProbability: z.number().min(0).max(1),

  /** Last regime update timestamp */
  lastUpdate: z.string(),
});

export type MarketRegimeInfo = z.infer<typeof MarketRegimeInfoSchema>;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate market conditions data
 */
export function validateMarketConditions(data: unknown): MarketConditions {
  return MarketConditionsSchema.parse(data);
}

/**
 * Validate position risk profile data
 */
export function validatePositionRiskProfile(
  data: unknown
): PositionRiskProfile {
  return PositionRiskProfileSchema.parse(data);
}

/**
 * Validate portfolio risk metrics data
 */
export function validatePortfolioRiskMetrics(
  data: unknown
): PortfolioRiskMetrics {
  return PortfolioRiskMetricsSchema.parse(data);
}

/**
 * Validate risk engine configuration
 */
export function validateRiskEngineConfig(data: unknown): RiskEngineConfig {
  return RiskEngineConfigSchema.parse(data);
}

/**
 * Validate risk alert data
 */
export function validateRiskAlert(data: unknown): RiskAlert {
  return RiskAlertSchema.parse(data);
}

/**
 * Validate stress test scenario
 */
export function validateStressTestScenario(data: unknown): StressTestScenario {
  return StressTestScenarioSchema.parse(data);
}

// =============================================================================
// DEFAULT VALUES
// =============================================================================

/**
 * Default market conditions
 */
export const DEFAULT_MARKET_CONDITIONS: MarketConditions = {
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

/**
 * Default risk engine configuration
 */
export const DEFAULT_RISK_ENGINE_CONFIG: RiskEngineConfig = {
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

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Partial market conditions for updates
 */
export type MarketConditionsUpdate = Partial<MarketConditions>;

/**
 * Partial position risk profile for updates
 */
export type PositionRiskProfileUpdate = Partial<PositionRiskProfile> & {
  symbol: string;
};

/**
 * Partial portfolio risk metrics for updates
 */
export type PortfolioRiskMetricsUpdate = Partial<PortfolioRiskMetrics>;

/**
 * Risk engine configuration update
 */
export type RiskEngineConfigUpdate = Partial<RiskEngineConfig>;

// =============================================================================
// EXPORTS
// =============================================================================

// All schemas are already exported via their declarations above
// No additional exports needed
