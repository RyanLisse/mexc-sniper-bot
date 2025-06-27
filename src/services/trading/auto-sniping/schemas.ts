/**
 * Auto-Sniping Schemas and Type Definitions
 *
 * Zod schemas for comprehensive type safety across the auto-sniping system.
 * Extracted from optimized-auto-sniping-core.ts for modularity.
 */

import { z } from "zod";

// ============================================================================
// Core Enums and Schemas
// ============================================================================

export const PatternTypeSchema = z.enum([
  "ready_state",
  "pre_ready",
  "launch_sequence",
  "risk_warning",
]);

export const AlertSeveritySchema = z.enum(["info", "warning", "error", "critical"]);

export const AlertTypeSchema = z.enum([
  "position_opened",
  "position_closed",
  "stop_loss_hit",
  "take_profit_hit",
  "execution_error",
  "risk_limit_hit",
]);

export const PositionStatusSchema = z.enum(["ACTIVE", "PARTIAL_FILLED", "FILLED", "CLOSED"]);

export const ExecutionStatusSchema = z.enum(["active", "idle", "paused", "error"]);

// ============================================================================
// Configuration Schemas
// ============================================================================

export const AutoSnipingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxPositions: z.number().int().min(1).max(50).default(5),
  maxDailyTrades: z.number().int().min(1).max(1000).default(10),
  positionSizeUSDT: z.number().positive().max(10000).default(10),
  minConfidence: z.number().min(0).max(100).default(80),
  allowedPatternTypes: z.array(PatternTypeSchema).default(["ready_state"]),
  requireCalendarConfirmation: z.boolean().default(true),
  stopLossPercentage: z.number().min(0).max(50).default(5),
  takeProfitPercentage: z.number().min(0).max(1000).default(10),
  maxDrawdownPercentage: z.number().min(0).max(100).default(20),
  enableAdvanceDetection: z.boolean().default(false),
  advanceNoticeHours: z.number().min(0).max(72).default(24),
  enableRiskManagement: z.boolean().default(true),
  enablePerformanceTracking: z.boolean().default(true),
  enableTelemetry: z.boolean().default(false),
  throttleInterval: z.number().min(100).max(60000).default(1000),
  enableParallelExecution: z.boolean().default(false),
  maxConcurrentTrades: z.number().int().min(1).max(20).default(3),
  enableSmartRouting: z.boolean().default(true),
  enableLivePatternFeed: z.boolean().default(true),
});

// ============================================================================
// Trading and Position Schemas
// ============================================================================

export const ExecutionPositionSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  status: PositionStatusSchema,
  entryPrice: z.number().positive(),
  quantity: z.number().positive(),
  currentPrice: z.number().positive().optional(),
  pnl: z.number().optional(),
  pnlPercentage: z.number().optional(),
  stopLossPrice: z.number().positive().optional(),
  takeProfitPrice: z.number().positive().optional(),
  timestamp: z.string().datetime(),
  executionMetadata: z.object({
    confidence: z.number().min(0).max(100),
    executionLatency: z.number().min(0),
    slippage: z.number().min(0),
    orderType: z.string(),
  }),
  patternData: z.object({
    symbol: z.string(),
    patternType: PatternTypeSchema,
    confidence: z.number().min(0).max(100),
    timestamp: z.string().datetime(),
    riskLevel: z.enum(["low", "medium", "high"]),
    advanceNoticeHours: z.number().min(0).optional(),
  }),
});

export const ExecutionStatsSchema = z.object({
  totalTrades: z.number().int().min(0),
  successfulTrades: z.number().int().min(0),
  totalPnl: z.number(),
  totalVolume: z.number().min(0),
  winRate: z.number().min(0).max(100),
  averageTradeReturn: z.number(),
  maxDrawdown: z.number().min(0),
  currentDrawdown: z.number().min(0),
  averageExecutionTime: z.number().min(0),
  averageSlippage: z.number().min(0),
  activePositions: z.number().int().min(0),
  dailyTradeCount: z.number().int().min(0),
  patternSuccessRates: z.record(PatternTypeSchema, z.number().min(0).max(100)),
  averagePatternConfidence: z.number().min(0).max(100),
  mostSuccessfulPattern: PatternTypeSchema.nullable(),
});

export const ExecutionAlertSchema = z.object({
  id: z.string(),
  type: AlertTypeSchema,
  severity: AlertSeveritySchema,
  message: z.string(),
  timestamp: z.string().datetime(),
  positionId: z.string().optional(),
  symbol: z.string().optional(),
  details: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  acknowledged: z.boolean().default(false),
});

// ============================================================================
// Type Exports
// ============================================================================

export type PatternType = z.infer<typeof PatternTypeSchema>;
export type AutoSnipingConfig = z.infer<typeof AutoSnipingConfigSchema>;
export type ExecutionPosition = z.infer<typeof ExecutionPositionSchema>;
export type ExecutionStats = z.infer<typeof ExecutionStatsSchema>;
export type ExecutionAlert = z.infer<typeof ExecutionAlertSchema>;
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;
export type AlertSeverity = z.infer<typeof AlertSeveritySchema>;
export type AlertType = z.infer<typeof AlertTypeSchema>;
export type PositionStatus = z.infer<typeof PositionStatusSchema>;

// ============================================================================
// Additional Interfaces
// ============================================================================

export interface SystemHealth {
  apiConnection: boolean;
  patternEngine: boolean;
  safetySystem: boolean;
  riskLimits: boolean;
}

export interface TradingOpportunity {
  symbol: string;
  patternMatch: {
    patternType: PatternType;
    confidence: number;
    riskLevel: "low" | "medium" | "high";
    advanceNoticeHours?: number;
  };
  launchTime: Date;
  confidence: number;
  vcoinId: string;
  projectName: string;
}

export interface ExecutionResult {
  success: boolean;
  executedPrice?: number;
  executedQuantity?: number;
  executionLatency?: number;
  slippage?: number;
  error?: string;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate Execution Position
 * 
 * Validates an ExecutionPosition object against the schema
 */
export function validateExecutionPosition(position: unknown): ExecutionPosition {
  return ExecutionPositionSchema.parse(position);
}

/**
 * Validate Auto-Sniping Configuration
 * 
 * Validates an AutoSnipingConfig object against the schema
 */
export function validateAutoSnipingConfig(config: unknown): AutoSnipingConfig {
  return AutoSnipingConfigSchema.parse(config);
}

/**
 * Validate Execution Stats
 * 
 * Validates an ExecutionStats object against the schema
 */
export function validateExecutionStats(stats: unknown): ExecutionStats {
  return ExecutionStatsSchema.parse(stats);
}

/**
 * Validate Execution Alert
 * 
 * Validates an ExecutionAlert object against the schema
 */
export function validateExecutionAlert(alert: unknown): ExecutionAlert {
  return ExecutionAlertSchema.parse(alert);
}
