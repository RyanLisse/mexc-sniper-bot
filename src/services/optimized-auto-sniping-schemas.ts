/**
 * Optimized Auto-Sniping Schemas and Types
 * 
 * Comprehensive Zod validation schemas for all auto-sniping operations.
 * Ensures type safety and data validation across the entire system.
 */

import { z } from "zod";
import type { PatternMatch } from "../core/pattern-detection";

// ============================================================================
// Core Pattern and Alert Types
// ============================================================================

export const PatternTypeSchema = z.enum([
  "ready_state",
  "pre_ready", 
  "launch_sequence",
  "risk_warning"
]);

export const AlertSeveritySchema = z.enum(["info", "warning", "error", "critical"]);

export const AlertTypeSchema = z.enum([
  "position_opened",
  "position_closed",
  "stop_loss_hit",
  "take_profit_hit",
  "execution_error",
  "risk_limit_hit"
]);

export const PositionStatusSchema = z.enum(["ACTIVE", "PARTIAL_FILLED", "FILLED", "CLOSED"]);
export const ExecutionStatusSchema = z.enum(["active", "idle", "paused", "error"]);
export const OrderSideSchema = z.enum(["BUY", "SELL"]);

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
  takeProfitPercentage: z.number().min(0).max(100).default(10),
  maxDrawdownPercentage: z.number().min(0).max(100).default(20),
  enableAdvanceDetection: z.boolean().default(true),
  advanceHoursThreshold: z.number().positive().default(3.5),
  enableMultiPhaseStrategy: z.boolean().default(false),
  slippageTolerancePercentage: z.number().min(0).max(10).default(1)
});

// ============================================================================
// Position and Execution Schemas 
// ============================================================================

export const ExecutionMetadataSchema = z.object({
  confidence: z.number().min(0).max(100),
  executionLatency: z.number().nonnegative(),
  slippage: z.number(),
  orderType: z.string()
});

export const ExecutionPositionSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  side: OrderSideSchema,
  quantity: z.string(),
  entryPrice: z.string(),
  currentPrice: z.string(),
  unrealizedPnl: z.string(),
  unrealizedPnlPercentage: z.number(),
  stopLossPrice: z.string().optional(),
  takeProfitPrice: z.string().optional(),
  status: PositionStatusSchema,
  entryTime: z.string(),
  patternMatch: z.any(), // PatternMatch type
  executionMetadata: ExecutionMetadataSchema
});

export const ExecutionStatsSchema = z.object({
  totalTrades: z.number().nonnegative().default(0),
  successfulTrades: z.number().nonnegative().default(0),
  failedTrades: z.number().nonnegative().default(0),
  successRate: z.number().min(0).max(100).default(0),
  totalPnl: z.string().default("0"),
  totalPnlPercentage: z.number().default(0),
  averageTradeReturn: z.number().default(0),
  maxDrawdown: z.number().default(0),
  currentDrawdown: z.number().default(0),
  averageExecutionTime: z.number().default(0),
  averageSlippage: z.number().default(0),
  activePositions: z.number().nonnegative().default(0),
  dailyTradeCount: z.number().nonnegative().default(0),
  patternSuccessRates: z.record(PatternTypeSchema, z.number()).default({}),
  averagePatternConfidence: z.number().default(0),
  mostSuccessfulPattern: PatternTypeSchema.nullable().default(null)
});

export const ExecutionAlertSchema = z.object({
  id: z.string(),
  type: AlertTypeSchema,
  severity: AlertSeveritySchema,
  message: z.string(),
  timestamp: z.string(),
  positionId: z.string().optional(),
  symbol: z.string().optional(),
  details: z.record(z.any()),
  acknowledged: z.boolean().default(false)
});

export const SystemHealthSchema = z.object({
  apiConnection: z.boolean(),
  patternEngine: z.boolean(),
  safetySystem: z.boolean(),
  riskLimits: z.boolean()
});

export const AutoSnipingExecutionReportSchema = z.object({
  status: ExecutionStatusSchema,
  config: AutoSnipingConfigSchema,
  stats: ExecutionStatsSchema,
  activePositions: z.array(ExecutionPositionSchema),
  recentExecutions: z.array(ExecutionPositionSchema),
  activeAlerts: z.array(ExecutionAlertSchema),
  systemHealth: SystemHealthSchema,
  recommendations: z.array(z.string()),
  lastUpdated: z.string()
});

// ============================================================================
// Trading Request/Response Schemas
// ============================================================================

export const TradingOrderRequestSchema = z.object({
  symbol: z.string().min(1),
  side: OrderSideSchema,
  type: z.enum(["MARKET", "LIMIT", "STOP_LOSS", "TAKE_PROFIT"]),
  quantity: z.string().optional(),
  quoteOrderQty: z.string().optional(),
  price: z.string().optional(),
  timeInForce: z.enum(["GTC", "IOC", "FOK"]).optional(),
  userId: z.string().min(1)
}).refine(data => data.quantity || data.quoteOrderQty, {
  message: "Either quantity or quoteOrderQty must be provided"
});

export const TradingOrderResponseSchema = z.object({
  success: z.boolean(),
  orderId: z.string().optional(),
  symbol: z.string(),
  side: z.string(),
  quantity: z.string(),
  price: z.string().optional(),
  status: z.string().optional(),
  executedQty: z.string().optional(),
  timestamp: z.string()
});

// ============================================================================
// Inferred Types
// ============================================================================

export type PatternType = z.infer<typeof PatternTypeSchema>;
export type AlertSeverity = z.infer<typeof AlertSeveritySchema>;
export type AlertType = z.infer<typeof AlertTypeSchema>;
export type PositionStatus = z.infer<typeof PositionStatusSchema>;
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;
export type OrderSide = z.infer<typeof OrderSideSchema>;

export type AutoSnipingConfig = z.infer<typeof AutoSnipingConfigSchema>;
export type ExecutionPosition = z.infer<typeof ExecutionPositionSchema>;
export type ExecutionStats = z.infer<typeof ExecutionStatsSchema>;
export type ExecutionAlert = z.infer<typeof ExecutionAlertSchema>;
export type SystemHealth = z.infer<typeof SystemHealthSchema>;
export type AutoSnipingExecutionReport = z.infer<typeof AutoSnipingExecutionReportSchema>;
export type TradingOrderRequest = z.infer<typeof TradingOrderRequestSchema>;
export type TradingOrderResponse = z.infer<typeof TradingOrderResponseSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

export class ValidationError extends Error {
  constructor(message: string, public errors: z.ZodError) {
    super(message);
    this.name = "ValidationError";
  }
}

export function validateAutoSnipingConfig(data: unknown): AutoSnipingConfig {
  const result = AutoSnipingConfigSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError("Invalid auto-sniping configuration", result.error);
  }
  return result.data;
}

export function validateTradingOrderRequest(data: unknown): TradingOrderRequest {
  const result = TradingOrderRequestSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError("Invalid trading order request", result.error);
  }
  return result.data;
}

export function validateTradingOrderResponse(data: unknown): TradingOrderResponse {
  const result = TradingOrderResponseSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError("Invalid trading order response", result.error);
  }
  return result.data;
}

export function validateExecutionPosition(data: unknown): ExecutionPosition {
  const result = ExecutionPositionSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError("Invalid execution position", result.error);
  }
  return result.data;
}

export function validateExecutionReport(data: unknown): AutoSnipingExecutionReport {
  const result = AutoSnipingExecutionReportSchema.safeParse(data);
  if (!result.success) {
    throw new ValidationError("Invalid execution report", result.error);
  }
  return result.data;
}