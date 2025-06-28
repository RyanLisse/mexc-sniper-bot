import { z } from "zod";

/**
 * Comprehensive API Validation Schemas
 * Complete Zod validation coverage for all API endpoints
 *
 * This file provides comprehensive validation schemas for all API routes
 * that currently lack proper validation, replacing placeholder validation
 * with robust, type-safe Zod schemas.
 */

// ============================================================================
// Common Request/Response Schemas
// ============================================================================

const SuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.unknown(),
  message: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  meta: z.record(z.unknown()).optional(),
});

const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime().optional(),
});

const ValidationErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.literal("validation_error"),
  message: z.string(),
  field: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

// ============================================================================
// Auto-Sniping Configuration API Schemas
// ============================================================================

export const AutoSnipingConfigSchema = z.object({
  enabled: z.boolean(),
  maxPositionSize: z.number().positive("Max position size must be positive"),
  takeProfitPercentage: z.number().min(0.1).max(100, "Take profit must be between 0.1% and 100%"),
  stopLossPercentage: z.number().min(0.1).max(100, "Stop loss must be between 0.1% and 100%"),
  patternConfidenceThreshold: z
    .number()
    .min(50)
    .max(100, "Confidence threshold must be between 50% and 100%"),
  maxConcurrentTrades: z.number().min(1).max(10, "Max concurrent trades must be between 1 and 10"),
  enableSafetyChecks: z.boolean(),
  enablePatternDetection: z.boolean(),
});

export const AutoSnipingActionRequestSchema = z.object({
  action: z.enum(["enable", "disable", "update", "start", "stop"], {
    errorMap: () => ({ message: "Action must be one of: enable, disable, update, start, stop" }),
  }),
  config: AutoSnipingConfigSchema.optional(),
});

export const AutoSnipingConfigResponseSchema = SuccessResponseSchema.extend({
  data: z.object({
    config: AutoSnipingConfigSchema.optional(),
    status: z.string(),
    enabled: z.boolean(),
    message: z.string().optional(),
  }),
});

// ============================================================================
// Snipe Targets API Schemas
// ============================================================================

export const CreateSnipeTargetRequestSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  vcoinId: z.string().min(1, "Vcoin ID is required"),
  symbolName: z.string().min(1, "Symbol name is required"),
  entryStrategy: z.enum(["market", "limit"]).default("market"),
  entryPrice: z.number().positive().optional(),
  positionSizeUsdt: z.number().positive("Position size must be positive"),
  takeProfitLevel: z.number().min(1).max(5).default(2),
  takeProfitCustom: z.number().positive().optional(),
  stopLossPercent: z.number().min(0.1).max(50).default(5.0),
  status: z.enum(["pending", "ready", "executed", "failed", "completed"]).default("pending"),
  priority: z.number().min(1).max(10).default(1),
  maxRetries: z.number().min(0).max(10).default(3),
  targetExecutionTime: z.string().datetime().optional(),
  confidenceScore: z.number().min(0).max(100).default(0),
  riskLevel: z.enum(["low", "medium", "high"]).default("medium"),
});

export const SnipeTargetQuerySchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  status: z.enum(["pending", "ready", "executed", "failed", "completed"]).optional(),
  limit: z.coerce.number().min(1).max(100).default(20).optional(),
  offset: z.coerce.number().min(0).default(0).optional(),
});

export const UpdateSnipeTargetRequestSchema = z.object({
  entryStrategy: z.enum(["market", "limit"]).optional(),
  entryPrice: z.number().positive().optional(),
  positionSizeUsdt: z.number().positive().optional(),
  takeProfitLevel: z.number().min(1).max(5).optional(),
  takeProfitCustom: z.number().positive().optional(),
  stopLossPercent: z.number().min(0.1).max(50).optional(),
  status: z.enum(["pending", "ready", "executed", "failed", "completed"]).optional(),
  priority: z.number().min(1).max(10).optional(),
  confidenceScore: z.number().min(0).max(100).optional(),
  riskLevel: z.enum(["low", "medium", "high"]).optional(),
});

// ============================================================================
// Phase 3 Configuration API Schemas
// ============================================================================

export const Phase3AIIntelligenceConfigSchema = z.object({
  enabled: z.boolean(),
  cohereEnabled: z.boolean(),
  perplexityEnabled: z.boolean(),
  openaiEnabled: z.boolean(),
  confidenceThreshold: z.number().min(0).max(100, "Confidence threshold must be between 0 and 100"),
  maxAIBoost: z.number().min(0).max(100, "Max AI boost must be between 0 and 100"),
});

export const Phase3PatternDetectionConfigSchema = z.object({
  advanceDetectionEnabled: z.boolean(),
  targetAdvanceHours: z.number().min(0, "Target advance hours must be positive"),
  activityEnhancementEnabled: z.boolean(),
  confidenceThreshold: z.number().min(0).max(100, "Confidence threshold must be between 0 and 100"),
});

export const Phase3CacheWarmingConfigSchema = z.object({
  enabled: z.boolean(),
  autoWarmingEnabled: z.boolean(),
  warmingInterval: z.number().min(1, "Warming interval must be at least 1 minute"),
  strategies: z.object({
    mexcSymbols: z.boolean(),
    patternData: z.boolean(),
    activityData: z.boolean(),
    calendarData: z.boolean(),
  }),
});

export const Phase3PerformanceConfigSchema = z.object({
  monitoringEnabled: z.boolean(),
  alertsEnabled: z.boolean(),
  metricsRetentionDays: z
    .number()
    .min(1)
    .max(365, "Metrics retention must be between 1 and 365 days"),
  performanceThresholds: z.object({
    maxResponseTime: z.number().min(1, "Max response time must be positive"),
    minHitRate: z.number().min(0).max(100, "Min hit rate must be between 0 and 100"),
    maxMemoryUsage: z.number().min(1, "Max memory usage must be positive"),
  }),
});

export const Phase3ConfigurationSchema = z.object({
  aiIntelligence: Phase3AIIntelligenceConfigSchema,
  patternDetection: Phase3PatternDetectionConfigSchema,
  cacheWarming: Phase3CacheWarmingConfigSchema,
  performance: Phase3PerformanceConfigSchema,
});

export const Phase3ConfigurationRequestSchema = z.object({
  configuration: Phase3ConfigurationSchema,
});

// ============================================================================
// Trading Strategy API Schemas
// ============================================================================

export const RiskParametersSchema = z.object({
  maxPositionSize: z.number().positive("Max position size must be positive"),
  stopLossPercentage: z.number().min(0.1).max(50, "Stop loss must be between 0.1% and 50%"),
  takeProfitPercentage: z.number().min(0.1).max(1000, "Take profit must be between 0.1% and 1000%"),
});

export const TradingStrategyRequestSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  analysisData: z.record(z.unknown()).optional(),
  riskParameters: RiskParametersSchema.default({
    maxPositionSize: 1000,
    stopLossPercentage: 5,
    takeProfitPercentage: 15,
  }),
});

// ============================================================================
// Portfolio API Schemas
// ============================================================================

export const PortfolioQueryRequestSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  includePositions: z.coerce.boolean().default(true).optional(),
  includeMetrics: z.coerce.boolean().default(true).optional(),
  includeActivity: z.coerce.boolean().default(true).optional(),
  activityLimit: z.coerce.number().min(1).max(100).default(10).optional(),
});

// ============================================================================
// Database Management API Schemas
// ============================================================================

export const DatabaseOptimizeRequestSchema = z.object({
  operation: z.enum(["vacuum", "reindex", "analyze", "cleanup"]),
  tables: z.array(z.string()).optional(),
  force: z.boolean().default(false),
});

export const DatabaseMigrateRequestSchema = z.object({
  target: z.string().optional(),
  dryRun: z.boolean().default(false),
  force: z.boolean().default(false),
});

// ============================================================================
// Execution History API Schemas
// ============================================================================

export const ExecutionHistoryQuerySchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  symbolName: z.string().optional(),
  action: z.enum(["buy", "sell"]).optional(),
  status: z.enum(["success", "failed", "pending"]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(100).default(20).optional(),
  offset: z.coerce.number().min(0).default(0).optional(),
});

// ============================================================================
// Security Monitoring API Schemas
// ============================================================================

export const SecurityMonitoringQuerySchema = z.object({
  category: z.enum(["auth", "api", "trading", "system"]).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(100).default(20).optional(),
});

// ============================================================================
// Schedule Control API Schemas
// ============================================================================

export const ScheduleControlRequestSchema = z.object({
  action: z.enum(["start", "stop", "pause", "resume", "status"]),
  scheduleId: z.string().optional(),
  configuration: z.record(z.unknown()).optional(),
});

// ============================================================================
// Data Archival API Schemas
// ============================================================================

export const DataArchivalRequestSchema = z.object({
  operation: z.enum(["archive", "restore", "cleanup", "status"]),
  dateRange: z
    .object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
    })
    .optional(),
  tables: z.array(z.string()).optional(),
  dryRun: z.boolean().default(false),
});

// ============================================================================
// Trigger API Schemas
// ============================================================================

export const SymbolWatchTriggerSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  thresholds: z.object({
    priceChange: z.number().optional(),
    volumeChange: z.number().optional(),
    volatility: z.number().optional(),
  }),
  duration: z.number().min(1, "Duration must be at least 1 minute").default(60),
});

export const EmergencyTriggerSchema = z.object({
  action: z.enum(["stop_all", "pause_all", "resume_all", "emergency_sell"]),
  reason: z.string().min(1, "Reason is required"),
  force: z.boolean().default(false),
});

export const SafetyTriggerSchema = z.object({
  checkType: z.enum(["balance", "position", "risk", "all"]),
  parameters: z.record(z.unknown()).optional(),
});

export const PatternAnalysisTriggerSchema = z.object({
  symbol: z.string().optional(),
  forceRefresh: z.boolean().default(false),
  confidence: z.number().min(0).max(100).optional(),
});

export const CalendarPollTriggerSchema = z.object({
  force: z.boolean().default(false),
  dateRange: z
    .object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    })
    .optional(),
});

export const MultiPhaseStrategyTriggerSchema = z.object({
  strategy: z.enum(["conservative", "balanced", "aggressive"]),
  symbol: z.string().optional(),
  parameters: z.record(z.unknown()).optional(),
});

// ============================================================================
// WebSocket API Schemas
// ============================================================================

export const WebSocketConnectionRequestSchema = z.object({
  channels: z.array(z.string()).min(1, "At least one channel is required"),
  userId: z.string().min(1, "User ID is required"),
  authentication: z.object({
    token: z.string().min(1, "Authentication token is required"),
  }),
});

// ============================================================================
// Query Performance API Schemas
// ============================================================================

export const QueryPerformanceRequestSchema = z.object({
  operation: z.enum(["analyze", "optimize", "report"]),
  query: z.string().optional(),
  timeRange: z
    .object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
    })
    .optional(),
});

// ============================================================================
// Validation Helper Functions
// ============================================================================

export function validateApiRequest<T extends z.ZodSchema>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string; details?: z.ZodError } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      return {
        success: false,
        error: `Validation failed: ${errorMessage}`,
        details: error,
      };
    }
    return { success: false, error: "Unknown validation error" };
  }
}

export function validateApiQuery<T extends z.ZodSchema>(
  schema: T,
  searchParams: URLSearchParams
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  try {
    const params = Object.fromEntries(searchParams.entries());
    const result = schema.parse(params);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");
      return { success: false, error: `Query validation failed: ${errorMessage}` };
    }
    return { success: false, error: "Unknown query validation error" };
  }
}

export function createValidationErrorResponse(field: string, message: string) {
  return {
    success: false as const,
    error: "validation_error" as const,
    message,
    field,
    timestamp: new Date().toISOString(),
  };
}

export function createValidatedSuccessResponse<T>(
  data: T,
  schema?: z.ZodSchema<T>,
  message?: string
) {
  const validatedData = schema ? schema.parse(data) : data;
  return {
    success: true as const,
    data: validatedData,
    message,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// Type Exports
// ============================================================================

export type AutoSnipingConfig = z.infer<typeof AutoSnipingConfigSchema>;
export type AutoSnipingActionRequest = z.infer<typeof AutoSnipingActionRequestSchema>;
export type CreateSnipeTargetRequest = z.infer<typeof CreateSnipeTargetRequestSchema>;
export type SnipeTargetQuery = z.infer<typeof SnipeTargetQuerySchema>;
export type UpdateSnipeTargetRequest = z.infer<typeof UpdateSnipeTargetRequestSchema>;
export type Phase3Configuration = z.infer<typeof Phase3ConfigurationSchema>;
export type Phase3ConfigurationRequest = z.infer<typeof Phase3ConfigurationRequestSchema>;
export type TradingStrategyRequest = z.infer<typeof TradingStrategyRequestSchema>;
export type RiskParameters = z.infer<typeof RiskParametersSchema>;
export type PortfolioQueryRequest = z.infer<typeof PortfolioQueryRequestSchema>;
export type DatabaseOptimizeRequest = z.infer<typeof DatabaseOptimizeRequestSchema>;
export type DatabaseMigrateRequest = z.infer<typeof DatabaseMigrateRequestSchema>;
export type ExecutionHistoryQuery = z.infer<typeof ExecutionHistoryQuerySchema>;
export type SecurityMonitoringQuery = z.infer<typeof SecurityMonitoringQuerySchema>;
export type ScheduleControlRequest = z.infer<typeof ScheduleControlRequestSchema>;
export type DataArchivalRequest = z.infer<typeof DataArchivalRequestSchema>;
export type SymbolWatchTrigger = z.infer<typeof SymbolWatchTriggerSchema>;
export type EmergencyTrigger = z.infer<typeof EmergencyTriggerSchema>;
export type SafetyTrigger = z.infer<typeof SafetyTriggerSchema>;
export type PatternAnalysisTrigger = z.infer<typeof PatternAnalysisTriggerSchema>;
export type CalendarPollTrigger = z.infer<typeof CalendarPollTriggerSchema>;
export type MultiPhaseStrategyTrigger = z.infer<typeof MultiPhaseStrategyTriggerSchema>;
export type WebSocketConnectionRequest = z.infer<typeof WebSocketConnectionRequestSchema>;
export type QueryPerformanceRequest = z.infer<typeof QueryPerformanceRequestSchema>;
