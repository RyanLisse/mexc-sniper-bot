/**
 * Unified Schemas Index
 *
 * Single entry point for all unified schema imports.
 * This index provides a centralized location for importing all schema definitions,
 * eliminating the need to import from multiple scattered files.
 *
 * Usage:
 * ```typescript
 * // Import specific schemas
 * import { CalendarEntrySchema, SymbolEntrySchema } from '@/schemas/unified';
 *
 * // Import specific types
 * import type { MexcServiceResponse, TradeParameters } from '@/schemas/unified';
 *
 * // Import schema collections
 * import { MEXC_API_SCHEMAS, TRADING_SCHEMAS } from '@/schemas/unified';
 * ```
 */

// ============================================================================
// MEXC API Schemas and Types
// ============================================================================

export type {
  AccountBalance,
  AccountInfo,
  ActivityData,
  ActivityResponse,
  // Activity Types
  ActivityType,
  // Error Types
  ApiError,
  BalanceEntry,
  // Core API Types
  CalendarEntry,
  ExchangeSymbol,
  // Configuration Types
  MexcApiConfig,
  MexcCacheConfig,
  MexcReliabilityConfig,
  MexcServiceResponse,
  OrderRequest,
  OrderResponse,
  OrderResult,
  OrderSide,
  OrderStatus,
  OrderType,
  RateLimitInfo,
  SymbolEntry,
  // Symbol Types
  SymbolInfo,
  // Trading Types
  Ticker,
  UnifiedMexcConfig,
} from "./mexc-api-schemas";
export {
  // Account/Balance Schema
  AccountBalanceSchema,
  AccountInfoSchema,
  ActivityDataSchema,
  ActivityResponseSchema,
  // Activity Schemas
  ActivityTypeSchema,
  // Error Schema
  ApiErrorSchema,
  BalanceEntrySchema,
  // Core API Schemas
  CalendarEntrySchema,
  ExchangeSymbolSchema,
  // Configuration Schemas
  MexcApiConfigSchema,
  MexcCacheConfigSchema,
  MexcReliabilityConfigSchema,
  MexcServiceResponseSchema,
  OrderRequestSchema,
  OrderResponseSchema,
  OrderResultSchema,
  OrderSideSchema,
  OrderStatusSchema,
  OrderTypeSchema,
  RateLimitInfoSchema,
  SymbolEntrySchema,
  // Symbol Schema
  SymbolInfoSchema,
  // Trading Schemas
  TickerSchema,
  UnifiedMexcConfigSchema,
} from "./mexc-api-schemas";

// ============================================================================
// Trading Schemas and Types
// ============================================================================

export type {
  // Auto-Sniping Types
  AutoSnipeTarget,
  // Multi-Phase Types
  MultiPhaseConfig,
  MultiPhaseResult,
  // Analytics Types
  PerformanceMetrics,
  // Position Management Types
  Position,
  // Take Profit Types
  TakeProfitLevel,
  TakeProfitStrategy,
  TradeExecutionResult,
  // Trading Operation Types
  TradeParameters,
  // Configuration Types
  TradingConfig,
  // Event Types
  TradingEvents,
  // Service Status Type
  TradingServiceStatus,
  // Strategy Types
  TradingStrategy,
} from "./trading-schemas";
export {
  // Auto-Sniping Schemas
  AutoSnipeTargetSchema,
  // Multi-Phase Schemas
  MultiPhaseConfigSchema,
  MultiPhaseResultSchema,
  // Analytics Schemas
  PerformanceMetricsSchema,
  // Position Management Schemas
  PositionSchema,
  // Take Profit Schemas
  TakeProfitLevelSchema,
  TakeProfitStrategySchema,
  // Schema Collection
  TRADING_SCHEMAS,
  TradeExecutionResultSchema,
  // Trading Operation Schemas
  TradeParametersSchema,
  // Configuration Schemas
  TradingConfigSchema,
  // Service Status Schema
  TradingServiceStatusSchema,
  // Strategy Schemas
  TradingStrategySchema,
  validateTakeProfitStrategy,
  // Utilities
  validateTradingData,
} from "./trading-schemas";

// ============================================================================
// API Validation Schemas and Types
// ============================================================================

export type {
  AutoSnipingActionRequest,
  AutoSnipingConfig,
  CalendarPollTrigger,
  CreateSnipeTargetRequest,
  DataArchivalRequest,
  DatabaseMigrateRequest,
  DatabaseOptimizeRequest,
  EmergencyTrigger,
  ExecutionHistoryQuery,
  MultiPhaseStrategyTrigger,
  PatternAnalysisTrigger,
  Phase3Configuration,
  Phase3ConfigurationRequest,
  PortfolioQueryRequest,
  QueryPerformanceRequest,
  RiskParameters,
  SafetyTrigger,
  ScheduleControlRequest,
  SecurityMonitoringQuery,
  SnipeTargetQuery,
  SymbolWatchTrigger,
  TradingStrategyRequest,
  UpdateSnipeTargetRequest,
  WebSocketConnectionRequest,
} from "../comprehensive-api-validation-schemas";

export {
  AutoSnipingActionRequestSchema,
  AutoSnipingConfigSchema,
  CalendarPollTriggerSchema,
  CreateSnipeTargetRequestSchema,
  createValidatedSuccessResponse,
  createValidationErrorResponse,
  DataArchivalRequestSchema,
  DatabaseMigrateRequestSchema,
  DatabaseOptimizeRequestSchema,
  EmergencyTriggerSchema,
  ExecutionHistoryQuerySchema,
  MultiPhaseStrategyTriggerSchema,
  PatternAnalysisTriggerSchema,
  Phase3ConfigurationRequestSchema,
  Phase3ConfigurationSchema,
  PortfolioQueryRequestSchema,
  QueryPerformanceRequestSchema,
  RiskParametersSchema,
  SafetyTriggerSchema,
  ScheduleControlRequestSchema,
  SecurityMonitoringQuerySchema,
  SnipeTargetQuerySchema,
  SymbolWatchTriggerSchema,
  TradingStrategyRequestSchema,
  UpdateSnipeTargetRequestSchema,
  validateApiQuery,
  validateApiRequest,
  WebSocketConnectionRequestSchema,
} from "../comprehensive-api-validation-schemas";

// ============================================================================
// Pattern Detection Schemas and Types
// ============================================================================

export type {
  ActivityInfo,
  AdvanceOpportunity,
  CorrelationAnalysis,
  IConfidenceCalculator,
  // Interface Types (for dependency injection)
  IPatternAnalyzer,
  IPatternStorage,
  IPatternValidator,
  // Analysis Types
  PatternAnalysisRequest,
  PatternAnalysisResult,
  PatternCacheStats,
  // Configuration Type
  PatternDetectionConfig,
  // Metrics Type
  PatternDetectionMetrics,
  PatternIndicators,
  PatternMatch,
  // Service Options Type
  PatternServiceOptions,
  // Enhanced Pattern Types
  PreReadyPatternResult,
  // Core Pattern Types
  // ReadyStatePattern, // Removed duplicate - already exported from mexc-api-schemas
  // Storage Types
  StoredPattern,
  // Validation Type
  ValidationResult,
} from "./pattern-detection-schemas";
export {
  ActivityInfoSchema,
  AdvanceOpportunitySchema,
  CorrelationAnalysisSchema,
  calculateConfidenceDistribution,
  // Schema Collection
  PATTERN_DETECTION_SCHEMAS,
  PatternAnalysisError,
  // Analysis Schemas
  PatternAnalysisRequestSchema,
  PatternAnalysisResultSchema,
  PatternCacheStatsSchema,
  // Configuration Schema
  PatternDetectionConfigSchema,
  // Error Classes
  PatternDetectionError,
  // Metrics Schema
  PatternDetectionMetricsSchema,
  PatternIndicatorsSchema,
  PatternMatchSchema,
  // Service Options Schema
  PatternServiceOptionsSchema,
  PatternValidationError,
  // Enhanced Pattern Schemas
  PreReadyPatternResultSchema,
  // Core Pattern Schemas
  // ReadyStatePatternSchema, // Removed duplicate - already exported from mexc-api-schemas
  // Storage Schemas
  StoredPatternSchema,
  // Validation Schema
  ValidationResultSchema,
  // Utilities
  validatePatternData,
  validatePatternMatchCompleteness,
} from "./pattern-detection-schemas";

// ============================================================================
// Common Utilities
// ============================================================================

/**
 * Generic validation function that works with any Zod schema
 */
export function validateData<T>(
  schema: import("zod").ZodSchema<T>,
  data: unknown
): { success: boolean; data?: T; error?: string } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    // Check for ZodError using duck typing since we can't use instanceof with dynamic import in sync function
    if (
      error &&
      typeof error === "object" &&
      "errors" in error &&
      Array.isArray((error as any).errors)
    ) {
      return {
        success: false,
        error: `Validation failed: ${(error as any).errors.map((e: any) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
      };
    }
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Unknown validation error",
    };
  }
}

// ============================================================================
// All Schema Collections
// ============================================================================

export const ALL_UNIFIED_SCHEMAS = {
  // MEXC_API_SCHEMAS,
  // TRADING_SCHEMAS,
  // PATTERN_DETECTION_SCHEMAS,
} as const;

/**
 * Get all schema names for reference
 */
export const UNIFIED_SCHEMA_NAMES = Object.keys(ALL_UNIFIED_SCHEMAS) as Array<
  keyof typeof ALL_UNIFIED_SCHEMAS
>;

/**
 * Migration guide for updating imports to use unified schemas
 */
export const MIGRATION_GUIDE = {
  // Old imports -> New imports
  "services/mexc-schemas": "./mexc-api-schemas",
  "services/consolidated/core-trading.types": "./trading-schemas",
  "core/pattern-detection/interfaces": "./pattern-detection-schemas",
  "services/modules/mexc-api-types": "./mexc-api-schemas",
  "schemas/mexc-schemas": "./mexc-api-schemas",
  "types/trading-analytics-types": "./trading-schemas",
  "types/take-profit-strategies": "./trading-schemas",

  // Commonly used types and their new location
  CalendarEntry: "./mexc-api-schemas",
  SymbolEntry: "./mexc-api-schemas",
  BalanceEntry: "./mexc-api-schemas",
  MexcServiceResponse: "./mexc-api-schemas",
  TradeParameters: "./trading-schemas",
  AutoSnipeTarget: "./trading-schemas",
  PatternMatch: "./pattern-detection-schemas",
  TradingStrategy: "./trading-schemas",
  Position: "./trading-schemas",
} as const;
