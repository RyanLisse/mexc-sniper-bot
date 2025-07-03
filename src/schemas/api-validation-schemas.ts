import { z } from "zod";

/**
 * API Request/Response Validation Schemas
 * Comprehensive Zod validation for all API endpoints
 */

// ============================================================================
// SIMPLIFIED API Response Schemas - NO COMPLEX UNIONS
// ============================================================================

export const ApiSuccessResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  message: z.string().optional(),
  timestamp: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
});

export const ApiErrorResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  code: z.string().optional(),
  details: z.any().optional(),
  timestamp: z.string().optional(),
  statusCode: z.number().optional(),
});

export const ApiResponseSchema = z.object({
  success: z.boolean().optional(),
  data: z.any().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
  details: z.any().optional(),
  message: z.string().optional(),
  timestamp: z.string().optional(),
  meta: z.any().optional(),
  statusCode: z.number().optional(),
});

// ============================================================================
// Transaction Locks API Schemas
// ============================================================================

export const TransactionLockSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  ownerId: z.string(),
  status: z.enum(["active", "released", "failed", "expired"]),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export const TransactionQueueItemSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  priority: z.number(),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  queuedAt: z.string().datetime(),
  processedAt: z.string().datetime().optional(),
});

export const LockStatsSchema = z.object({
  activeLocks: z.number().min(0),
  expiredLocks: z.number().min(0),
  queueLength: z.number().min(0),
  recentlyCompleted: z.number().min(0),
  recentlyFailed: z.number().min(0),
});

export const TransactionLocksResponseSchema = z.object({
  locks: z.array(TransactionLockSchema),
  queue: z.array(TransactionQueueItemSchema),
  stats: LockStatsSchema,
});

export const TransactionLockQuerySchema = z.object({
  resourceId: z.string().optional(),
  ownerId: z.string().optional(),
  status: z.enum(["active", "released", "failed", "expired"]).optional(),
  limit: z.coerce.number().min(1).max(100).default(50).optional(),
});

export const ReleaseLockRequestSchema = z
  .object({
    lockId: z.string().optional(),
    ownerId: z.string().optional(),
    force: z.coerce.boolean().default(false).optional(),
  })
  .refine((data) => data.lockId || data.ownerId, {
    message: "Either lockId or ownerId is required",
  });

export const CheckLockRequestSchema = z.object({
  action: z.literal("check"),
  resourceId: z.string(),
});

// ============================================================================
// Portfolio API Schemas
// ============================================================================

export const PortfolioPositionSchema = z.object({
  id: z.string(),
  symbolName: z.string(),
  executionPrice: z.number().optional(),
  actualPositionSize: z.number().optional(),
  positionSizeUsdt: z.number().optional(),
  currentPrice: z.number(),
  unrealizedPnL: z.number(),
  unrealizedPnLPercent: z.number(),
  actualExecutionTime: z.string().datetime().optional(),
});

export const PortfolioMetricsSchema = z.object({
  totalActivePositions: z.number().min(0),
  totalUnrealizedPnL: z.number(),
  totalCompletedTrades: z.number().min(0),
  successfulTrades: z.number().min(0),
  successRate: z.number().min(0).max(100),
  totalCapitalDeployed: z.number().min(0),
});

export const PortfolioActivitySchema = z.object({
  id: z.string(),
  symbol: z.string(),
  action: z.enum(["buy", "sell"]),
  status: z.enum(["success", "failed", "pending"]),
  quantity: z.number().optional(),
  price: z.number().optional(),
  totalCost: z.number().optional(),
  timestamp: z.string().datetime(),
  orderId: z.string().optional(),
});

export const PortfolioResponseSchema = z.object({
  activePositions: z.array(PortfolioPositionSchema),
  metrics: PortfolioMetricsSchema,
  recentActivity: z.array(PortfolioActivitySchema),
});

export const PortfolioQuerySchema = z.object({
  userId: z.string(),
});

// ============================================================================
// Trading Analytics API Schemas
// ============================================================================

export const TradingPerformanceSchema = z.object({
  totalTrades: z.number().min(0),
  successfulTrades: z.number().min(0),
  successRate: z.number().min(0).max(100),
  averageTradeSize: z.number().min(0),
  averageHoldTime: z.number().min(0),
  tradingVolume: z.number().min(0),
  winLossRatio: z.number().min(0),
  sharpeRatio: z.number(),
  maxDrawdown: z.number().min(0),
  profitFactor: z.number().min(0),
});

export const AllocationSchema = z.object({
  asset: z.string(),
  percentage: z.number().min(0).max(100),
  value: z.number().min(0),
});

export const TopPerformerSchema = z.object({
  symbol: z.string(),
  return: z.number(),
});

export const PortfolioMetricsAnalyticsSchema = z.object({
  currentValue: z.number().min(0),
  totalReturn: z.number(),
  returnPercentage: z.number(),
  dayChange: z.number(),
  weekChange: z.number(),
  monthChange: z.number(),
  allocations: z.array(AllocationSchema),
  topPerformers: z.array(TopPerformerSchema),
  riskAdjustedReturn: z.number(),
  beta: z.number(),
  volatility: z.number().min(0),
});

export const PatternTypeCountSchema = z.object({
  type: z.string(),
  count: z.number().min(0),
});

export const PatternPerformanceSchema = z.object({
  pattern: z.string(),
  successRate: z.number().min(0).max(100),
  avgReturn: z.number(),
});

export const PatternAnalyticsSchema = z.object({
  totalPatternsDetected: z.number().min(0),
  successfulPatterns: z.number().min(0),
  patternSuccessRate: z.number().min(0).max(100),
  averageConfidence: z.number().min(0).max(100),
  patternTypes: z.array(PatternTypeCountSchema),
  readyStatePatterns: z.number().min(0),
  advanceDetectionMetrics: z.object({
    averageAdvanceTime: z.number().min(0),
    optimalDetections: z.number().min(0),
    detectionAccuracy: z.number().min(0).max(100),
  }),
  patternPerformance: z.array(PatternPerformanceSchema),
});

export const TradingAnalyticsResponseSchema = z.object({
  timestamp: z.string().datetime(),
  tradingPerformance: TradingPerformanceSchema,
  portfolioMetrics: PortfolioMetricsAnalyticsSchema,
  patternAnalytics: PatternAnalyticsSchema,
  riskManagement: z.record(z.unknown()),
  positionAnalytics: z.record(z.unknown()),
  executionAnalytics: z.record(z.unknown()),
  profitLossAnalytics: z.record(z.unknown()),
  marketAnalytics: z.record(z.unknown()),
});

// ============================================================================
// Common Query Parameter Schemas
// ============================================================================

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1).optional(),
  limit: z.coerce.number().min(1).max(100).default(20).optional(),
  offset: z.coerce.number().min(0).default(0).optional(),
});

export const DateRangeQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const SortQuerySchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc").optional(),
});

// ============================================================================
// Validation Helper Functions
// ============================================================================

export function validateApiQuery<T extends z.ZodSchema>(
  schema: T,
  searchParams: URLSearchParams
): { success?: boolean; data?: z.infer<T>; error?: string } {
  try {
    const params = Object.fromEntries(searchParams.entries());
    const result = schema.parse(params);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      return { success: false, error: `Validation failed: ${errorMessage}` };
    }
    return { success: false, error: "Unknown validation error" };
  }
}

export function validateApiBody<T extends z.ZodSchema>(
  schema: T,
  body: unknown
): { success?: boolean; data?: z.infer<T>; error?: string } {
  try {
    const result = schema.parse(body);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      return { success: false, error: `Validation failed: ${errorMessage}` };
    }
    return { success: false, error: "Unknown validation error" };
  }
}

export function createValidatedApiResponse<T>(
  data: T,
  schema?: z.ZodSchema<T>,
  message?: string
): { success?: boolean; data?: T; message?: string; timestamp?: string } {
  const validatedData = schema ? schema.parse(data) : data;
  return {
    success: true,
    data: validatedData,
    message,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// Type Exports
// ============================================================================

export type ApiSuccessResponse = z.infer<typeof ApiSuccessResponseSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
export type ApiResponse = z.infer<typeof ApiResponseSchema>;
export type TransactionLock = z.infer<typeof TransactionLockSchema>;
export type TransactionQueueItem = z.infer<typeof TransactionQueueItemSchema>;
export type LockStats = z.infer<typeof LockStatsSchema>;
export type TransactionLocksResponse = z.infer<
  typeof TransactionLocksResponseSchema
>;
export type TransactionLockQuery = z.infer<typeof TransactionLockQuerySchema>;
export type ReleaseLockRequest = z.infer<typeof ReleaseLockRequestSchema>;
export type CheckLockRequest = z.infer<typeof CheckLockRequestSchema>;
export type PortfolioPosition = z.infer<typeof PortfolioPositionSchema>;
export type PortfolioMetrics = z.infer<typeof PortfolioMetricsSchema>;
export type PortfolioActivity = z.infer<typeof PortfolioActivitySchema>;
export type PortfolioResponse = z.infer<typeof PortfolioResponseSchema>;
export type PortfolioQuery = z.infer<typeof PortfolioQuerySchema>;
export type TradingPerformance = z.infer<typeof TradingPerformanceSchema>;
export type TradingAnalyticsResponse = z.infer<
  typeof TradingAnalyticsResponseSchema
>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type DateRangeQuery = z.infer<typeof DateRangeQuerySchema>;
export type SortQuery = z.infer<typeof SortQuerySchema>;
