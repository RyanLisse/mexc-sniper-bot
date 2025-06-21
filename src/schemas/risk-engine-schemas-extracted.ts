/**
 * Extracted Risk Engine Schemas
 *
 * This file contains all risk management-related Zod schemas extracted from the
 * advanced-risk-engine.ts file as part of the TDD refactoring process.
 *
 * Extracted schemas provide type safety and validation for risk management
 * configurations, market conditions, portfolio metrics, alerts, and stress testing.
 */

import { z } from "zod";

// ============================================================================
// Market Conditions Schemas
// ============================================================================

/**
 * Market Conditions Schema
 */
export const MarketConditionsSchema = z.object({
  // Risk indices (0-100 scale)
  volatilityIndex: z.number().min(0).max(100),
  liquidityIndex: z.number().min(0).max(100),

  // Market depth and spread metrics
  orderBookDepth: z.number().min(0),
  bidAskSpread: z.number().min(0),

  // Volume and price metrics
  tradingVolume24h: z.number().min(0),
  priceChange24h: z.number(), // can be negative

  // Risk correlation (0-1 scale)
  correlationRisk: z.number().min(0).max(1),

  // Market sentiment enumeration
  marketSentiment: z.enum(["bullish", "bearish", "neutral", "volatile"]),

  // Timestamp for data validity
  timestamp: z.string(),
});

// ============================================================================
// Position Risk Schemas
// ============================================================================

/**
 * Position Risk Profile Schema
 */
export const PositionRiskProfileSchema = z.object({
  // Position identification
  symbol: z.string().min(1),

  // Position size and exposure
  size: z.number().min(0),
  exposure: z.number().min(0),
  leverage: z.number().positive(),

  // P&L metrics (can be negative)
  unrealizedPnL: z.number(),
  valueAtRisk: z.number().min(0),
  maxDrawdown: z.number().min(0),

  // Time and distance metrics
  timeHeld: z.number().min(0),
  stopLossDistance: z.number().min(0),
  takeProfitDistance: z.number().min(0),

  // Correlation score (0-1 scale)
  correlationScore: z.number().min(0).max(1),
});

// ============================================================================
// Portfolio Risk Schemas
// ============================================================================

/**
 * Portfolio Risk Metrics Schema
 */
export const PortfolioRiskMetricsSchema = z.object({
  // Portfolio value metrics
  totalValue: z.number().min(0),
  totalExposure: z.number().min(0),

  // Risk scores (0-100 scale)
  diversificationScore: z.number().min(0).max(100),
  concentrationRisk: z.number().min(0).max(100),

  // Correlation matrix (2D array of numbers between -1 and 1)
  correlationMatrix: z.array(z.array(z.number().min(-1).max(1))),

  // Risk calculations
  valueAtRisk95: z.number().min(0),
  expectedShortfall: z.number().min(0),
  sharpeRatio: z.number(), // can be negative
  maxDrawdownRisk: z.number().min(0),
  liquidityRisk: z.number().min(0),
});

// ============================================================================
// Risk Engine Configuration Schema
// ============================================================================

/**
 * Risk Engine Configuration Schema
 */
export const RiskEngineConfigSchema = z.object({
  // Portfolio limits (all positive values)
  maxPortfolioValue: z.number().positive(),
  maxSinglePositionSize: z.number().positive(),
  maxConcurrentPositions: z.number().positive().int(),
  maxDailyLoss: z.number().positive(),
  maxDrawdown: z.number().min(0).max(100),

  // Risk calculation parameters
  confidenceLevel: z.number().min(0).max(1),
  lookbackPeriod: z.number().positive().int(),
  correlationThreshold: z.number().min(0).max(1),
  volatilityMultiplier: z.number().positive(),

  // Feature toggles
  adaptiveRiskScaling: z.boolean(),
  marketRegimeDetection: z.boolean(),
  stressTestingEnabled: z.boolean(),

  // Emergency thresholds
  emergencyVolatilityThreshold: z.number().min(0).max(100),
  emergencyLiquidityThreshold: z.number().min(0).max(100),
  emergencyCorrelationThreshold: z.number().min(0).max(1),
});

// ============================================================================
// Risk Alert Schema
// ============================================================================

/**
 * Risk Alert Schema
 */
export const RiskAlertSchema = z.object({
  // Alert identification
  id: z.string().min(1),

  // Alert classification
  type: z.enum(["position", "portfolio", "market", "system"]),
  severity: z.enum(["low", "medium", "high", "critical"]),

  // Alert content
  message: z.string().min(1),
  details: z.record(z.unknown()),
  recommendations: z.array(z.string()),

  // Alert lifecycle
  timestamp: z.string(),
  resolved: z.boolean(),
  resolvedAt: z.string().optional(),
});

// ============================================================================
// Stress Test Scenario Schema
// ============================================================================

/**
 * Stress Test Scenario Schema
 */
export const StressTestScenarioSchema = z.object({
  // Scenario identification
  name: z.string().min(1),
  description: z.string(),

  // Market shock parameters
  marketShock: z.object({
    priceChange: z.number(), // percentage change (can be negative)
    volatilityIncrease: z.number().min(0), // multiplier (must be positive)
    liquidityReduction: z.number(), // percentage (can be negative for increased liquidity)
  }),

  // Expected impact
  expectedLoss: z.number(), // can be negative (profit)
  recoveryTime: z.number().min(0), // hours
});

// ============================================================================
// Type Exports
// ============================================================================

export type MarketConditions = z.infer<typeof MarketConditionsSchema>;
export type PositionRiskProfile = z.infer<typeof PositionRiskProfileSchema>;
export type PortfolioRiskMetrics = z.infer<typeof PortfolioRiskMetricsSchema>;
export type RiskEngineConfig = z.infer<typeof RiskEngineConfigSchema>;
export type RiskAlert = z.infer<typeof RiskAlertSchema>;
export type StressTestScenario = z.infer<typeof StressTestScenarioSchema>;

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate market conditions data
 */
export function validateMarketConditions(data: unknown): MarketConditions {
  return MarketConditionsSchema.parse(data);
}

/**
 * Validate position risk profile data
 */
export function validatePositionRiskProfile(data: unknown): PositionRiskProfile {
  return PositionRiskProfileSchema.parse(data);
}

/**
 * Validate portfolio risk metrics data
 */
export function validatePortfolioRiskMetrics(data: unknown): PortfolioRiskMetrics {
  return PortfolioRiskMetricsSchema.parse(data);
}

/**
 * Validate risk engine configuration data
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
 * Validate stress test scenario data
 */
export function validateStressTestScenario(data: unknown): StressTestScenario {
  return StressTestScenarioSchema.parse(data);
}

// ============================================================================
// Schema Collections
// ============================================================================

/**
 * All available risk engine schemas for bulk operations
 */
export const ALL_RISK_SCHEMAS = {
  MarketConditionsSchema,
  PositionRiskProfileSchema,
  PortfolioRiskMetricsSchema,
  RiskEngineConfigSchema,
  RiskAlertSchema,
  StressTestScenarioSchema,
} as const;

/**
 * Core risk management schemas
 */
export const CORE_RISK_SCHEMAS = {
  RiskEngineConfigSchema,
  PortfolioRiskMetricsSchema,
  RiskAlertSchema,
} as const;

/**
 * Market analysis schemas
 */
export const MARKET_ANALYSIS_SCHEMAS = {
  MarketConditionsSchema,
  StressTestScenarioSchema,
} as const;

/**
 * Position management schemas
 */
export const POSITION_MANAGEMENT_SCHEMAS = {
  PositionRiskProfileSchema,
  PortfolioRiskMetricsSchema,
} as const;
