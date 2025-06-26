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

export {
  // Configuration Schemas
  MexcApiConfigSchema,
  MexcCacheConfigSchema,
  MexcReliabilityConfigSchema,
  
  // Response Schema
  MexcServiceResponseSchema,
  
  // Core Data Schemas
  CalendarEntrySchema,
  SymbolEntrySchema,
  BalanceEntrySchema,
  TradingFilterSchema,
  ExchangeSymbolSchema,
  TickerSchema,
  OrderParametersSchema,
  OrderResultSchema,
  OrderStatusSchema,
  OrderBookSchema,
  AccountInfoSchema,
  
  // Market Data Schemas
  KlineSchema,
  ExchangeInfoSchema,
  
  // Activity Schema
  ActivityDataSchema,
  
  // Schema Collection
  MEXC_API_SCHEMAS,
  
  // Utilities
  validateMexcData,
  validateServiceResponse,
} from './mexc-api-schemas';

export type {
  // Configuration Types
  MexcApiConfig,
  MexcCacheConfig,
  MexcReliabilityConfig,
  
  // Response Type
  MexcServiceResponse,
  
  // Core Data Types
  CalendarEntry,
  SymbolEntry,
  BalanceEntry,
  TradingFilter,
  ExchangeSymbol,
  ExchangeInfo,
  Ticker,
  OrderParameters,
  OrderResult,
  OrderStatus,
  OrderBook,
  AccountInfo,
  
  // Market Data Types
  Kline,
  
  // Activity Type
  ActivityData,
} from './mexc-api-schemas';

// ============================================================================
// Trading Schemas and Types
// ============================================================================

export {
  // Configuration Schemas
  TradingConfigSchema,
  
  // Trading Operation Schemas
  TradeParametersSchema,
  TradeExecutionResultSchema,
  
  // Auto-Sniping Schemas
  AutoSnipeTargetSchema,
  
  // Take Profit Schemas
  TakeProfitLevelSchema,
  TakeProfitStrategySchema,
  
  // Strategy Schemas
  TradingStrategySchema,
  
  // Position Management Schemas
  PositionSchema,
  
  // Multi-Phase Schemas
  MultiPhaseConfigSchema,
  MultiPhaseResultSchema,
  
  // Analytics Schemas
  PerformanceMetricsSchema,
  
  // Service Status Schema
  TradingServiceStatusSchema,
  
  // Schema Collection
  TRADING_SCHEMAS,
  
  // Utilities
  validateTradingData,
  validateTakeProfitStrategy,
} from './trading-schemas';

export type {
  // Configuration Types
  TradingConfig,
  
  // Trading Operation Types
  TradeParameters,
  TradeExecutionResult,
  
  // Auto-Sniping Types
  AutoSnipeTarget,
  
  // Take Profit Types
  TakeProfitLevel,
  TakeProfitStrategy,
  
  // Strategy Types
  TradingStrategy,
  
  // Position Management Types
  Position,
  
  // Multi-Phase Types
  MultiPhaseConfig,
  MultiPhaseResult,
  
  // Analytics Types
  PerformanceMetrics,
  
  // Service Status Type
  TradingServiceStatus,
  
  // Event Types
  TradingEvents,
} from './trading-schemas';

// ============================================================================
// Pattern Detection Schemas and Types
// ============================================================================

export {
  // Core Pattern Schemas
  ReadyStatePatternSchema,
  PatternIndicatorsSchema,
  ActivityInfoSchema,
  PatternMatchSchema,
  
  // Analysis Schemas
  PatternAnalysisRequestSchema,
  CorrelationAnalysisSchema,
  PatternAnalysisResultSchema,
  
  // Configuration Schema
  PatternDetectionConfigSchema,
  
  // Metrics Schema
  PatternDetectionMetricsSchema,
  
  // Storage Schemas
  StoredPatternSchema,
  PatternCacheStatsSchema,
  
  // Validation Schema
  ValidationResultSchema,
  
  // Enhanced Pattern Schemas
  PreReadyPatternResultSchema,
  AdvanceOpportunitySchema,
  
  // Service Options Schema
  PatternServiceOptionsSchema,
  
  // Schema Collection
  PATTERN_DETECTION_SCHEMAS,
  
  // Utilities
  validatePatternData,
  validatePatternMatchCompleteness,
  calculateConfidenceDistribution,
  
  // Error Classes
  PatternDetectionError,
  PatternValidationError,
  PatternAnalysisError,
} from './pattern-detection-schemas';

export type {
  // Core Pattern Types
  ReadyStatePattern,
  PatternIndicators,
  ActivityInfo,
  PatternMatch,
  
  // Analysis Types
  PatternAnalysisRequest,
  CorrelationAnalysis,
  PatternAnalysisResult,
  
  // Configuration Type
  PatternDetectionConfig,
  
  // Metrics Type
  PatternDetectionMetrics,
  
  // Storage Types
  StoredPattern,
  PatternCacheStats,
  
  // Validation Type
  ValidationResult,
  
  // Enhanced Pattern Types
  PreReadyPatternResult,
  AdvanceOpportunity,
  
  // Service Options Type
  PatternServiceOptions,
  
  // Interface Types (for dependency injection)
  IPatternAnalyzer,
  IConfidenceCalculator,
  IPatternStorage,
  IPatternValidator,
} from './pattern-detection-schemas';

// ============================================================================
// Common Utilities
// ============================================================================

/**
 * Generic validation function that works with any Zod schema
 */
export function validateData<T>(
  schema: import('zod').ZodSchema<T>,
  data: unknown
): { success: boolean; data?: T; error?: string } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof import('zod').ZodError) {
      return {
        success: false,
        error: `Validation failed: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown validation error",
    };
  }
}

// ============================================================================
// All Schema Collections
// ============================================================================

export const ALL_UNIFIED_SCHEMAS = {
  ...MEXC_API_SCHEMAS,
  ...TRADING_SCHEMAS,
  ...PATTERN_DETECTION_SCHEMAS,
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
  'services/mexc-schemas': './mexc-api-schemas',
  'services/consolidated/core-trading.types': './trading-schemas',
  'core/pattern-detection/interfaces': './pattern-detection-schemas',
  'services/modules/mexc-api-types': './mexc-api-schemas',
  'schemas/mexc-schemas': './mexc-api-schemas',
  'types/trading-analytics-types': './trading-schemas',
  'types/take-profit-strategies': './trading-schemas',
  
  // Commonly used types and their new location
  CalendarEntry: './mexc-api-schemas',
  SymbolEntry: './mexc-api-schemas',
  BalanceEntry: './mexc-api-schemas',
  MexcServiceResponse: './mexc-api-schemas',
  TradeParameters: './trading-schemas',
  AutoSnipeTarget: './trading-schemas',
  PatternMatch: './pattern-detection-schemas',
  TradingStrategy: './trading-schemas',
  Position: './trading-schemas',
} as const;