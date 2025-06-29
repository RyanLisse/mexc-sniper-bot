/**
 * Auto-Sniping Orchestrator - Type Definitions and Schemas
 *
 * Centralized type definitions for the modular auto-sniping orchestrator system.
 * Extracted from the original monolithic implementation for better maintainability.
 */

import { z } from "zod";

// ============================================================================
// Core Configuration Types
// ============================================================================

export interface AutoSnipingConfig {
  enabled: boolean;
  maxConcurrentPositions: number;
  patternDetectionInterval: number; // milliseconds
  safetyCheckInterval: number; // milliseconds
  confidenceThreshold: number; // 0-100
  maxPositionSize: number; // percentage of portfolio
  stopLossPercentage: number; // percentage
  strategy: "conservative" | "balanced" | "aggressive";
  paperTradingMode: boolean;
}

export const AutoSnipingConfigSchema = z.object({
  enabled: z.boolean().default(false),
  maxConcurrentPositions: z.number().positive().default(3),
  patternDetectionInterval: z.number().positive().default(30000), // 30 seconds
  safetyCheckInterval: z.number().positive().default(60000), // 1 minute
  confidenceThreshold: z.number().min(0).max(100).default(75),
  maxPositionSize: z.number().min(0).max(1).default(0.1), // 10% of portfolio
  stopLossPercentage: z.number().min(0).max(1).default(0.15), // 15% stop loss
  strategy: z.enum(["conservative", "balanced", "aggressive"]).default("conservative"),
  paperTradingMode: z.boolean().default(true),
});

// ============================================================================
// Status and Metrics Types
// ============================================================================

export interface AutoSnipingStatus {
  active: boolean;
  safeToOperate: boolean;
  currentPositions: number;
  totalPositions: number;
  profitLoss: {
    realized: number;
    unrealized: number;
    total: number;
    percentage: number;
  };
  systemHealth: {
    patternDetection: "operational" | "degraded" | "offline";
    tradingBot: "operational" | "degraded" | "offline";
    safetyCoordinator: "operational" | "degraded" | "offline";
    mexcConnection: "connected" | "disconnected" | "error";
  };
  lastOperation: {
    timestamp: string;
    action: string;
    symbol?: string;
    result: "success" | "failed" | "partial";
  } | null;
  runningTime: number; // milliseconds since start
  detectedOpportunities: number;
  executedTrades: number;
  avgConfidenceScore: number;
}

export const AutoSnipingStatusSchema = z.object({
  active: z.boolean(),
  safeToOperate: z.boolean(),
  currentPositions: z.number().nonnegative(),
  totalPositions: z.number().nonnegative(),
  profitLoss: z.object({
    realized: z.number(),
    unrealized: z.number(),
    total: z.number(),
    percentage: z.number(),
  }),
  systemHealth: z.object({
    patternDetection: z.enum(["operational", "degraded", "offline"]),
    tradingBot: z.enum(["operational", "degraded", "offline"]),
    safetyCoordinator: z.enum(["operational", "degraded", "offline"]),
    mexcConnection: z.enum(["connected", "disconnected", "error"]),
  }),
  lastOperation: z
    .object({
      timestamp: z.string(),
      action: z.string(),
      symbol: z.string().optional(),
      result: z.enum(["success", "failed", "partial"]),
    })
    .nullable(),
  runningTime: z.number().nonnegative(),
  detectedOpportunities: z.number().nonnegative(),
  executedTrades: z.number().nonnegative(),
  avgConfidenceScore: z.number().min(0).max(100),
});

export interface AutoSnipingMetrics {
  session: {
    startTime: string;
    uptime: number;
    totalOpportunities: number;
    successfulTrades: number;
    failedTrades: number;
    successRate: number;
  };
  performance: {
    avgResponseTime: number;
    avgConfidence: number;
    profitability: number;
    maxDrawdown: number;
    sharpeRatio: number;
  };
  safety: {
    safetyViolations: number;
    emergencyStops: number;
    lastSafetyCheck: string;
    riskScore: number;
  };
}

// ============================================================================
// Position and Trading Types
// ============================================================================

export interface TradingPosition {
  id: string;
  targetId?: number;
  symbol: string;
  vcoinId?: number;
  orderId?: string;
  entryPrice: number;
  amount: number;
  strategy: string;
  timestamp: string;
  confidence: number;
  stopLoss: number;
  takeProfit: number;
  status?: string;
  realTrade?: boolean;
  currentPrice?: number;
  unrealizedPnL?: number;
  lastUpdated?: string;
  monitoringIntervalId?: NodeJS.Timeout;
  stopLossPrice?: number;
  takeProfitLevels?: TakeProfitLevel[];
  trailingStopLoss?: TrailingStopLoss;
}

export interface TakeProfitLevel {
  id: string;
  targetPrice: number;
  percentage: number;
  isActive: boolean;
  executed: boolean;
  executedAt?: string;
}

export interface TrailingStopLoss {
  enabled: boolean;
  trailingPercent: number;
  highestPrice: number;
}

// ============================================================================
// Snipe Target Types
// ============================================================================

export interface SnipeTarget {
  id: number;
  symbolName: string;
  vcoinId?: number;
  positionSizeUsdt: number;
  confidenceScore: number;
  stopLossPercent: number;
  takeProfitCustom?: number;
  status: string;
  priority: number;
  createdAt: Date;
  targetExecutionTime?: Date | null;
  actualExecutionTime?: Date | null;
  errorMessage?: string;
}

// ============================================================================
// Trade Execution Types
// ============================================================================

export interface TradeParameters {
  userId: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT" | "STOP_LIMIT";
  quantity?: string;
  quoteOrderQty?: string;
  price?: string;
  timeInForce: "GTC" | "IOC" | "FOK";
}

export interface TradeExecutionResult {
  success: boolean;
  data?: {
    orderId?: string;
    symbol?: string;
    side?: string;
    type?: string;
    price?: string;
    executedQty?: string;
    status?: string;
    timestamp?: string;
  };
  error?: string;
}

// ============================================================================
// Module Communication Types
// ============================================================================

export interface ModuleContext {
  config: AutoSnipingConfig;
  logger: {
    info: (message: string, context?: Record<string, unknown>) => void;
    warn: (message: string, context?: Record<string, unknown>) => void;
    error: (message: string, context?: Record<string, unknown>) => void;
    debug: (message: string, context?: Record<string, unknown>) => void;
  };
  eventEmitter: {
    emit: (event: string, data: unknown) => void;
    on: (event: string, listener: (...args: unknown[]) => void) => void;
  };
}

export interface ModuleState {
  isInitialized: boolean;
  isHealthy: boolean;
  lastActivity: Date;
  metrics: Record<string, number | string | boolean | Date>;
}

// ============================================================================
// Service Response Types
// ============================================================================

export interface ServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp?: string;
}

export interface OperationResult {
  success: boolean;
  message: string;
  status?: AutoSnipingStatus;
  finalStatus?: AutoSnipingStatus;
}

// ============================================================================
// Safety and Risk Types
// ============================================================================

export interface SafetyCheck {
  checkType: string;
  passed: boolean;
  message: string;
  severity: "info" | "warning" | "error" | "critical";
  timestamp: string;
}

export interface RiskAssessment {
  overallRisk: "low" | "medium" | "high" | "critical";
  factors: {
    positionCount: number;
    portfolioExposure: number;
    volatility: number;
    marketConditions: string;
  };
  recommendations: string[];
}

// ============================================================================
// Pattern Detection Types
// ============================================================================

export interface PatternMatch {
  symbol: string;
  patternType: string;
  confidence: number;
  riskLevel: "low" | "medium" | "high";
  advanceNoticeHours: number;
  detectedAt: string;
  validUntil: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface OpportunityAssessment {
  isValid: boolean;
  confidence: number;
  riskLevel: "low" | "medium" | "high";
  recommendedAction: "execute" | "skip" | "wait";
  reasons: string[];
}

// ============================================================================
// Validation Helpers
// ============================================================================

export function validateConfig(config: unknown): AutoSnipingConfig {
  const validated = AutoSnipingConfigSchema.parse(config);
  return {
    enabled: validated.enabled,
    maxConcurrentPositions: validated.maxConcurrentPositions,
    patternDetectionInterval: validated.patternDetectionInterval,
    safetyCheckInterval: validated.safetyCheckInterval,
    confidenceThreshold: validated.confidenceThreshold,
    maxPositionSize: validated.maxPositionSize,
    stopLossPercentage: validated.stopLossPercentage,
    strategy: validated.strategy,
    paperTradingMode: validated.paperTradingMode,
  };
}

export function validateStatus(status: unknown): AutoSnipingStatus {
  const validated = AutoSnipingStatusSchema.parse(status);
  return {
    active: validated.active,
    safeToOperate: validated.safeToOperate,
    currentPositions: validated.currentPositions,
    totalPositions: validated.totalPositions,
    profitLoss: validated.profitLoss,
    systemHealth: validated.systemHealth,
    lastOperation: validated.lastOperation,
    runningTime: validated.runningTime,
    detectedOpportunities: validated.detectedOpportunities,
    executedTrades: validated.executedTrades,
    avgConfidenceScore: validated.avgConfidenceScore,
  };
}

// ============================================================================
// Type Guards
// ============================================================================

export function isSnipeTarget(obj: unknown): obj is SnipeTarget {
  return (
    obj !== null &&
    typeof obj === "object" &&
    typeof (obj as any).id === "number" &&
    typeof (obj as any).symbolName === "string" &&
    typeof (obj as any).confidenceScore === "number" &&
    typeof (obj as any).status === "string"
  );
}

export function isTradingPosition(obj: unknown): obj is TradingPosition {
  return (
    obj !== null &&
    typeof obj === "object" &&
    typeof (obj as any).id === "string" &&
    typeof (obj as any).symbol === "string" &&
    typeof (obj as any).entryPrice === "number" &&
    typeof (obj as any).amount === "number"
  );
}

export function isTradeExecutionResult(obj: unknown): obj is TradeExecutionResult {
  return (
    obj !== null &&
    typeof obj === "object" &&
    typeof (obj as any).success === "boolean"
  );
}

// ============================================================================
// Utility Types
// ============================================================================

export type EventType =
  | "auto_sniping_started"
  | "auto_sniping_stopped"
  | "target_processed"
  | "trade_executed"
  | "position_opened"
  | "position_closed"
  | "safety_violation"
  | "emergency_stop"
  | "status_updated";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type SystemComponent =
  | "pattern_detection"
  | "trade_execution"
  | "position_monitoring"
  | "safety_management"
  | "core_orchestrator";

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_CONFIG: AutoSnipingConfig = {
  enabled: false,
  maxConcurrentPositions: 3,
  patternDetectionInterval: 30000,
  safetyCheckInterval: 60000,
  confidenceThreshold: 75,
  maxPositionSize: 0.1,
  stopLossPercentage: 0.15,
  strategy: "conservative",
  paperTradingMode: true,
};

export const SYSTEM_HEALTH_STATES = {
  OPERATIONAL: "operational" as const,
  DEGRADED: "degraded" as const,
  OFFLINE: "offline" as const,
};

export const TRADE_SIDES = {
  BUY: "BUY" as const,
  SELL: "SELL" as const,
};

export const TIME_IN_FORCE = {
  GTC: "GTC" as const, // Good Till Cancelled
  IOC: "IOC" as const, // Immediate or Cancel
  FOK: "FOK" as const, // Fill or Kill
};
