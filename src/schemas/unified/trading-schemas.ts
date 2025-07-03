/**
 * Unified Trading Schemas
 *
 * Single source of truth for all trading-related types and schemas.
 * Consolidates types from:
 * - services/consolidated/core-trading.types.ts
 * - types/trading-analytics-types.ts
 * - services/multi-phase-executor-types.ts
 * - types/take-profit-strategies.ts
 * - services/pattern-detection/pattern-types.ts
 *
 * This eliminates duplication and provides consistent trading type definitions.
 */

import { z } from "zod";

// ============================================================================
// Trading Configuration
// ============================================================================

export const TradingConfigSchema = z.object({
  // Trading Settings
  enablePaperTrading: z.boolean().default(true),
  maxConcurrentPositions: z
    .number()
    .positive("Max concurrent positions must be positive")
    .default(5),
  maxPositionSize: z
    .number()
    .min(0)
    .max(1, "Position size must be between 0 and 1")
    .default(0.1),
  defaultStrategy: z
    .enum(["conservative", "balanced", "aggressive"])
    .default("conservative"),

  // Auto-Sniping Settings
  autoSnipingEnabled: z.boolean().default(false),
  confidenceThreshold: z
    .number()
    .min(0)
    .max(100, "Confidence threshold must be 0-100")
    .default(75),
  snipeCheckInterval: z
    .number()
    .positive("Snipe check interval must be positive")
    .default(30000),

  // Risk Management
  globalStopLossPercent: z
    .number()
    .min(0)
    .max(100, "Stop loss percent must be 0-100")
    .default(15),
  globalTakeProfitPercent: z
    .number()
    .min(0)
    .max(100, "Take profit percent must be 0-100")
    .default(25),
  maxDailyLoss: z
    .number()
    .min(0, "Max daily loss cannot be negative")
    .default(1000),

  // Circuit Breaker Settings
  enableCircuitBreaker: z.boolean().default(true),
  circuitBreakerThreshold: z
    .number()
    .positive("Circuit breaker threshold must be positive")
    .default(5),
  circuitBreakerResetTime: z
    .number()
    .positive("Circuit breaker reset time must be positive")
    .default(300000),
});

export type TradingConfig = z.infer<typeof TradingConfigSchema>;

// ============================================================================
// Trade Parameters
// ============================================================================

export const TradeParametersSchema = z
  .object({
    // Required Parameters
    symbol: z.string().min(1, "Symbol is required"),
    side: z.enum(["BUY", "SELL"], {
      required_error: "Side must be BUY or SELL",
    }),
    type: z.enum(["MARKET", "LIMIT", "STOP", "STOP_LIMIT"], {
      required_error: "Type is required",
    }),

    // Quantity Parameters (mutually exclusive)
    quantity: z.number().positive("Quantity must be positive").optional(),
    quoteOrderQty: z
      .number()
      .positive("Quote order quantity must be positive")
      .optional(),

    // Price Parameters
    price: z.number().positive("Price must be positive").optional(),
    stopPrice: z.number().positive("Stop price must be positive").optional(),

    // Order Parameters
    timeInForce: z.enum(["GTC", "IOC", "FOK"]).default("GTC"),
    newClientOrderId: z.string().optional(),

    // Risk Management Parameters
    stopLossPercent: z.number().min(0).max(100).optional(),
    takeProfitPercent: z.number().min(0).max(100).optional(),

    // Strategy Parameters
    strategy: z.enum(["conservative", "balanced", "aggressive"]).optional(),
    isAutoSnipe: z.boolean().default(false),
    confidenceScore: z.number().min(0).max(100).optional(),
  })
  .refine(
    (data) => data.quantity !== undefined || data.quoteOrderQty !== undefined,
    {
      message: "Either quantity or quoteOrderQty must be provided",
      path: ["quantity"],
    }
  )
  .refine(
    (data) => {
      if (data.type === "LIMIT" || data.type === "STOP_LIMIT") {
        return data.price !== undefined;
      }
      return true;
    },
    {
      message: "Price is required for LIMIT and STOP_LIMIT orders",
      path: ["price"],
    }
  )
  .refine(
    (data) => {
      if (data.type === "STOP" || data.type === "STOP_LIMIT") {
        return data.stopPrice !== undefined;
      }
      return true;
    },
    {
      message: "Stop price is required for STOP and STOP_LIMIT orders",
      path: ["stopPrice"],
    }
  );

export type TradeParameters = z.infer<typeof TradeParametersSchema>;

// ============================================================================
// Trade Results
// ============================================================================

export const TradeExecutionResultSchema = z.object({
  success: z.boolean(),
  orderId: z.string().optional(),
  clientOrderId: z.string().optional(),
  symbol: z.string(),
  side: z.string(),
  type: z.string(),
  quantity: z.string(),
  price: z.string(),
  status: z.string(),
  executedQty: z.string(),
  cummulativeQuoteQty: z.string().optional(),
  timestamp: z.string(),

  // Additional Trading Service Fields
  fills: z
    .array(
      z.object({
        price: z.string(),
        qty: z.string(),
        commission: z.string(),
        commissionAsset: z.string(),
      })
    )
    .optional(),

  // Paper Trading Fields
  paperTrade: z.boolean().optional(),
  simulatedPrice: z.number().optional(),

  // Auto-Snipe Fields
  autoSnipe: z.boolean().optional(),
  confidenceScore: z.number().optional(),
  snipeTargetId: z.number().optional(),

  // Error Information
  error: z.string().optional(),
  errorCode: z.string().optional(),
  retryCount: z.number().optional(),
  executionTime: z.number().optional(),
});

export type TradeExecutionResult = z.infer<typeof TradeExecutionResultSchema>;

// ============================================================================
// Auto-Snipe Targets
// ============================================================================

export const AutoSnipeTargetSchema = z.object({
  id: z.number(),
  userId: z.string().optional(),
  symbolName: z.string(),
  vcoinId: z
    .union([z.number(), z.string()])
    .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val)),
  confidenceScore: z.number().min(0).max(100),
  positionSizeUsdt: z.number().positive(),
  stopLossPercent: z.number().min(0).max(100),
  takeProfitCustom: z.number().min(0).max(100).optional(),
  status: z.enum([
    "pending",
    "ready",
    "executing",
    "completed",
    "failed",
    "cancelled",
  ]),
  targetExecutionTime: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  actualExecutionTime: z.date().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),

  // Additional fields from database schema
  takeProfitStrategy: z.string().optional(),
  multiPhaseEnabled: z.boolean().default(false),
  phaseCount: z.number().default(1),
  trailingStopLoss: z.boolean().default(false),
  maxSlippage: z.number().default(1.0),
});

export type AutoSnipeTarget = z.infer<typeof AutoSnipeTargetSchema>;

// ============================================================================
// Take Profit Strategies
// ============================================================================

export const TakeProfitLevelSchema = z.object({
  id: z.string(),
  profitPercentage: z.number().min(0.1).max(1000), // 0.1% to 1000%
  sellQuantity: z.number().min(1).max(100), // 1% to 100%
  isActive: z.boolean(),
  description: z.string().optional(),
  targetPrice: z.number().optional(),
  executed: z.boolean().default(false),
});

export const TakeProfitStrategySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  riskLevel: z.enum(["low", "medium", "high"]),
  levels: z.array(TakeProfitLevelSchema),
  isDefault: z.boolean().default(false),
  isCustom: z.boolean().default(false),
});

export type TakeProfitLevel = z.infer<typeof TakeProfitLevelSchema>;
export type TakeProfitStrategy = z.infer<typeof TakeProfitStrategySchema>;

// ============================================================================
// Trading Strategy
// ============================================================================

export const TradingStrategySchema = z.object({
  name: z.string().min(1, "Strategy name is required"),
  description: z.string().optional(),

  // Position Sizing
  maxPositionSize: z.number().min(0).max(1, "Max position size must be 0-1"),
  positionSizingMethod: z
    .enum(["fixed", "kelly", "risk_parity"])
    .default("fixed"),

  // Risk Management
  stopLossPercent: z.number().min(0).max(100),
  takeProfitPercent: z.number().min(0).max(100),
  maxDrawdownPercent: z.number().min(0).max(100).default(20),

  // Execution Parameters
  orderType: z.enum(["MARKET", "LIMIT"]).default("MARKET"),
  timeInForce: z.enum(["GTC", "IOC", "FOK"]).default("IOC"),
  slippageTolerance: z.number().min(0).max(100).default(1),

  // Multi-Phase Parameters
  enableMultiPhase: z.boolean().default(false),
  phaseCount: z.number().min(1).max(10).default(1),
  phaseDelayMs: z.number().min(0).default(1000),
  phaseAllocation: z.array(z.number().min(0).max(1)).optional(),

  // Auto-Sniping Parameters
  confidenceThreshold: z.number().min(0).max(100).default(75),
  enableAutoSnipe: z.boolean().default(false),
  snipeDelayMs: z.number().min(0).default(0),

  // Advanced Settings
  enableTrailingStop: z.boolean().default(false),
  trailingStopPercent: z.number().min(0).max(100).optional(),
  enablePartialTakeProfit: z.boolean().default(false),
  partialTakeProfitPercent: z.number().min(0).max(100).optional(),
});

export type TradingStrategy = z.infer<typeof TradingStrategySchema>;

// ============================================================================
// Position Management
// ============================================================================

export const PositionSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  side: z.enum(["BUY", "SELL"]),

  // Order Information
  orderId: z.string(),
  clientOrderId: z.string().optional(),

  // Position Details
  entryPrice: z.number(),
  quantity: z.number(),
  currentPrice: z.number().optional(),

  // Risk Management
  stopLossPrice: z.number().optional(),
  takeProfitPrice: z.number().optional(),
  stopLossPercent: z.number().optional(),
  takeProfitPercent: z.number().optional(),
  takeProfitLevels: z.array(TakeProfitLevelSchema).optional(),
  trailingStopLoss: z
    .object({
      enabled: z.boolean(),
      percentage: z.number(),
      highestPrice: z.number().optional(),
    })
    .optional(),

  // Status
  status: z.enum(["open", "closed", "partially_filled", "cancelled"]),
  openTime: z.date(),
  closeTime: z.date().optional(),

  // Performance
  unrealizedPnL: z.number().optional(),
  realizedPnL: z.number().optional(),
  pnlPercentage: z.number().optional(),

  // Strategy Information
  strategy: z.string(),
  confidenceScore: z.number().optional(),
  autoSnipe: z.boolean().default(false),
  paperTrade: z.boolean().default(false),

  // Multi-Phase Information
  multiPhase: z.boolean().default(false),
  phaseId: z.number().optional(),
  totalPhases: z.number().optional(),

  // Monitoring
  monitoringIntervalId: z.union([z.string(), z.number()]).optional(),

  // Metadata
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export type Position = z.infer<typeof PositionSchema>;

// ============================================================================
// Multi-Phase Trading
// ============================================================================

export const MultiPhaseConfigSchema = z.object({
  symbol: z.string(),
  totalAmount: z.number().positive(),
  strategy: z.enum(["conservative", "balanced", "aggressive"]),
  phaseCount: z.number().min(1).max(10).default(3),
  phaseDelayMs: z.number().min(0).default(5000),
  phaseAllocation: z.array(z.number().min(0).max(1)).optional(),
  adaptivePhasing: z.boolean().default(false),
  priceThresholds: z.array(z.number()).optional(),
});

export const MultiPhaseResultSchema = z.object({
  success: z.boolean(),
  totalPhases: z.number(),
  completedPhases: z.number(),
  strategy: z.string(),
  phases: z.array(
    z.object({
      phaseId: z.number(),
      status: z.enum(["pending", "executing", "completed", "failed"]),
      allocation: z.number(),
      result: TradeExecutionResultSchema.optional(),
      executionTime: z.date().optional(),
    })
  ),
  totalExecuted: z.number(),
  averagePrice: z.number().optional(),
  totalFees: z.number().optional(),
  executionTimeMs: z.number(),
});

export type MultiPhaseConfig = z.infer<typeof MultiPhaseConfigSchema>;
export type MultiPhaseResult = z.infer<typeof MultiPhaseResultSchema>;

// ============================================================================
// Performance Analytics
// ============================================================================

export const PerformanceMetricsSchema = z.object({
  // Trading Statistics
  totalTrades: z.number(),
  successfulTrades: z.number(),
  failedTrades: z.number(),
  successRate: z.number().min(0).max(100),

  // Financial Performance
  totalPnL: z.number(),
  realizedPnL: z.number(),
  unrealizedPnL: z.number(),
  totalVolume: z.number(),
  averageTradeSize: z.number(),

  // Risk Metrics
  maxDrawdown: z.number(),
  sharpeRatio: z.number().optional(),
  sortinoRatio: z.number().optional(),
  calmarRatio: z.number().optional(),
  maxConsecutiveLosses: z.number(),
  maxConsecutiveWins: z.number(),

  // Execution Metrics
  averageExecutionTime: z.number(),
  slippageAverage: z.number(),
  fillRate: z.number().min(0).max(100),

  // Auto-Sniping Metrics
  autoSnipeCount: z.number(),
  autoSnipeSuccessRate: z.number().min(0).max(100),
  averageConfidenceScore: z.number().min(0).max(100),

  // Time-based Metrics
  timeframe: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  tradingDays: z.number(),

  // Strategy Performance
  strategyPerformance: z.record(
    z.string(),
    z.object({
      trades: z.number(),
      pnl: z.number(),
      successRate: z.number(),
    })
  ),
});

export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;

// ============================================================================
// Service Status
// ============================================================================

export const TradingServiceStatusSchema = z.object({
  // Service Health
  isHealthy: z.boolean(),
  isConnected: z.boolean(),
  isAuthenticated: z.boolean(),

  // Trading Status
  tradingEnabled: z.boolean(),
  autoSnipingEnabled: z.boolean(),
  paperTradingMode: z.boolean(),

  // Position Status
  activePositions: z.number(),
  maxPositions: z.number(),
  availableCapacity: z.number().min(0).max(1),

  // Circuit Breaker Status
  circuitBreakerOpen: z.boolean(),
  circuitBreakerFailures: z.number(),
  circuitBreakerResetTime: z.date().optional(),

  // Performance Status
  lastTradeTime: z.date().optional(),
  averageResponseTime: z.number(),
  cacheHitRate: z.number().min(0).max(100),

  // Risk Status
  currentRiskLevel: z.enum(["low", "medium", "high", "critical"]),
  dailyPnL: z.number(),
  dailyVolume: z.number(),

  // System Status
  uptime: z.number(),
  lastHealthCheck: z.date(),
  version: z.string(),
});

export type TradingServiceStatus = z.infer<typeof TradingServiceStatusSchema>;

// ============================================================================
// Event Types
// ============================================================================

export interface TradingEvents {
  trade_executed: TradeExecutionResult;
  position_opened: Position;
  position_closed: Position;
  position_updated: Position;
  auto_snipe_executed: {
    target: AutoSnipeTarget;
    result: TradeExecutionResult;
  };
  take_profit_triggered: { position: Position; level: TakeProfitLevel };
  stop_loss_triggered: { position: Position; price: number };
  trailing_stop_updated: { position: Position; newStopPrice: number };
  circuit_breaker_triggered: { reason: string; timestamp: Date };
  risk_limit_exceeded: { type: string; value: number; limit: number };
  strategy_performance_updated: {
    strategy: string;
    metrics: PerformanceMetrics;
  };
  error_occurred: { error: Error; context: string };
}

// ============================================================================
// Schema Collections
// ============================================================================

export const TRADING_SCHEMAS = {
  // Configuration
  TradingConfigSchema,

  // Trading Operations
  TradeParametersSchema,
  TradeExecutionResultSchema,

  // Auto-Sniping
  AutoSnipeTargetSchema,

  // Take Profit
  TakeProfitLevelSchema,
  TakeProfitStrategySchema,

  // Strategy
  TradingStrategySchema,

  // Position Management
  PositionSchema,

  // Multi-Phase
  MultiPhaseConfigSchema,
  MultiPhaseResultSchema,

  // Analytics
  PerformanceMetricsSchema,

  // Service Status
  TradingServiceStatusSchema,
} as const;

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate trading data against a schema
 */
export function validateTradingData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: boolean; data?: T; error?: string } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Validation failed: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
      };
    }
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Unknown validation error",
    };
  }
}

/**
 * Validate take profit strategy
 */
export function validateTakeProfitStrategy(
  strategy: TakeProfitStrategy
): string[] {
  const errors: string[] = [];

  if (strategy.levels.length === 0) {
    errors.push("Strategy must have at least one level");
  }

  if (strategy.levels.length > 6) {
    errors.push("Strategy cannot have more than 6 levels");
  }

  // Check for ascending profit percentages
  for (let i = 1; i < strategy.levels.length; i++) {
    if (
      strategy.levels[i].profitPercentage <=
      strategy.levels[i - 1].profitPercentage
    ) {
      errors.push(
        `Level ${i + 1} profit percentage must be higher than level ${i}`
      );
    }
  }

  // Check total sell quantity doesn't exceed 100%
  const totalSellQuantity = strategy.levels
    .filter((level) => level.isActive)
    .reduce((sum, level) => sum + level.sellQuantity, 0);

  if (totalSellQuantity > 100) {
    errors.push("Total sell quantity across all levels cannot exceed 100%");
  }

  return errors;
}
