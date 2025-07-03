/**
 * Unified Pattern Detection Schemas
 *
 * Single source of truth for all pattern detection related types and schemas.
 * Consolidates types from:
 * - core/pattern-detection/interfaces.ts
 * - services/pattern-detection/pattern-types.ts
 * - schemas/pattern-detection-schemas-extracted.ts
 * - mexc-agents/orchestrator-types.ts (pattern-related types)
 *
 * This eliminates duplication and provides consistent pattern detection definitions.
 */

import { z } from "zod";
import type {
  ActivityData,
  CalendarEntry,
  SymbolEntry,
} from "./mexc-api-schemas";

// ============================================================================
// Core Pattern Types
// ============================================================================

export const ReadyStatePatternSchema = z.object({
  sts: z.literal(2).describe("Symbol Trading Status: Ready"),
  st: z.literal(2).describe("Symbol State: Active"),
  tt: z.literal(4).describe("Trading Time: Live"),
});

export const PatternIndicatorsSchema = z.object({
  sts: z.number().optional(),
  st: z.number().optional(),
  tt: z.number().optional(),
  advanceHours: z.number().optional(),
  marketConditions: z.record(z.unknown()).optional(),
});

export const ActivityInfoSchema = z.object({
  activities: z.array(z.unknown()), // ActivityData[] - using unknown to avoid circular dependency
  activityBoost: z.number(),
  hasHighPriorityActivity: z.boolean(),
  activityTypes: z.array(z.string()),
});

export const PatternMatchSchema = z.object({
  patternType: z.enum([
    "ready_state",
    "pre_ready",
    "launch_sequence",
    "risk_warning",
  ]),
  confidence: z.number().min(0).max(100).describe("0-100 confidence score"),
  symbol: z.string(),
  vcoinId: z.string().optional(),

  // Pattern-specific data
  indicators: PatternIndicatorsSchema,

  // Activity Enhancement Data
  activityInfo: ActivityInfoSchema.optional(),

  // Analysis metadata
  detectedAt: z.date(),
  advanceNoticeHours: z.number(),
  riskLevel: z.enum(["low", "medium", "high"]),
  recommendation: z.enum([
    "immediate_action",
    "monitor_closely",
    "prepare_entry",
    "wait",
    "avoid",
  ]),

  // Historical context
  similarPatterns: z.array(z.unknown()).optional(),
  historicalSuccess: z.number().optional(),
});

export type ReadyStatePattern = z.infer<typeof ReadyStatePatternSchema>;
export type PatternIndicators = z.infer<typeof PatternIndicatorsSchema>;
export type ActivityInfo = z.infer<typeof ActivityInfoSchema>;
export type PatternMatch = z.infer<typeof PatternMatchSchema>;

// ============================================================================
// Pattern Analysis Request and Results
// ============================================================================

export const PatternAnalysisRequestSchema = z.object({
  symbols: z.array(z.unknown()).optional(), // SymbolEntry[] - using unknown to avoid circular dependency
  calendarEntries: z.array(z.unknown()).optional(), // CalendarEntry[]
  analysisType: z.enum([
    "discovery",
    "monitoring",
    "validation",
    "correlation",
  ]),
  timeframe: z.string().optional(),
  confidenceThreshold: z.number().min(0).max(100).optional(),
  includeHistorical: z.boolean().optional(),
});

export const CorrelationAnalysisSchema = z.object({
  symbols: z.array(z.string()),
  correlationType: z.enum([
    "launch_timing",
    "market_sector",
    "pattern_similarity",
  ]),
  strength: z.number().min(0).max(1).describe("0-1 correlation strength"),
  insights: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export const PatternAnalysisSummarySchema = z.object({
  totalAnalyzed: z.number(),
  readyStateFound: z.number(),
  highConfidenceMatches: z.number(),
  advanceOpportunities: z.number(),
  averageConfidence: z.number(),
});

export const PatternRecommendationsSchema = z.object({
  immediate: z.array(PatternMatchSchema),
  monitor: z.array(PatternMatchSchema),
  prepare: z.array(PatternMatchSchema),
});

export const PatternAnalysisMetadataSchema = z.object({
  executionTime: z.number(),
  algorithmsUsed: z.array(z.string()),
  confidenceDistribution: z.record(z.string(), z.number()),
});

export const PatternAnalysisResultSchema = z.object({
  matches: z.array(PatternMatchSchema),
  summary: PatternAnalysisSummarySchema,
  recommendations: PatternRecommendationsSchema,
  correlations: z.array(CorrelationAnalysisSchema).optional(),
  analysisMetadata: PatternAnalysisMetadataSchema,
});

export type PatternAnalysisRequest = z.infer<
  typeof PatternAnalysisRequestSchema
>;
export type CorrelationAnalysis = z.infer<typeof CorrelationAnalysisSchema>;
export type PatternAnalysisResult = z.infer<typeof PatternAnalysisResultSchema>;

// ============================================================================
// Pattern Detection Configuration
// ============================================================================

export const PatternDetectionConfigSchema = z.object({
  // Core settings
  minAdvanceHours: z.number().min(0).default(1),
  confidenceThreshold: z.number().min(0).max(100).default(75),

  // Performance settings
  enableCaching: z.boolean().default(true),
  cacheTimeout: z.number().positive().default(300000), // 5 minutes
  maxConcurrentAnalysis: z.number().positive().default(10),

  // AI Enhancement settings
  enableAIEnhancement: z.boolean().default(true),
  enableActivityEnhancement: z.boolean().default(true),

  // Validation settings
  strictValidation: z.boolean().default(true),
  logValidationErrors: z.boolean().default(true),
});

export type PatternDetectionConfig = z.infer<
  typeof PatternDetectionConfigSchema
>;

// ============================================================================
// Pattern Detection Metrics
// ============================================================================

export const PatternDetectionMetricsSchema = z.object({
  totalAnalyzed: z.number(),
  patternsDetected: z.number(),
  averageConfidence: z.number(),
  executionTime: z.number(),
  cacheHitRatio: z.number().min(0).max(1),
  errorCount: z.number(),
  warningCount: z.number(),

  // Performance breakdown
  algorithmTimes: z.record(z.string(), z.number()).optional(),
  patternTypeDistribution: z.record(z.string(), z.number()).optional(),
  confidenceDistribution: z
    .object({
      low: z.number(), // 0-33
      medium: z.number(), // 34-66
      high: z.number(), // 67-100
    })
    .optional(),
});

export type PatternDetectionMetrics = z.infer<
  typeof PatternDetectionMetricsSchema
>;

// ============================================================================
// Pattern Storage
// ============================================================================

export const StoredPatternSchema = z.object({
  id: z.string(),
  patternType: z.string(),
  confidence: z.number().min(0).max(100),
  symbol: z.string(),
  vcoinId: z.string().optional(),
  detectedAt: z.date(),
  successOutcome: z.boolean().optional(),
  performanceMetrics: z
    .object({
      priceChange24h: z.number().optional(),
      volumeChange24h: z.number().optional(),
      actualLaunchTime: z.date().optional(),
      predictionAccuracy: z.number().optional(),
    })
    .optional(),
  rawData: z.record(z.unknown()),
});

export const PatternCacheStatsSchema = z.object({
  hitRatio: z.number().min(0).max(1),
  size: z.number(),
  memoryUsage: z.number(),
  totalRequests: z.number(),
  cacheHits: z.number(),
  cacheMisses: z.number(),
});

export type StoredPattern = z.infer<typeof StoredPatternSchema>;
export type PatternCacheStats = z.infer<typeof PatternCacheStatsSchema>;

// ============================================================================
// Validation Results
// ============================================================================

export const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;

// ============================================================================
// Enhanced Pattern Types
// ============================================================================

export const PreReadyPatternResultSchema = z.object({
  isPreReady: z.boolean(),
  confidence: z.number().min(0).max(100),
  estimatedTimeToReady: z.number().describe("Estimated time in hours"),
  indicators: PatternIndicatorsSchema,
  riskFactors: z.array(z.string()).optional(),
});

export const AdvanceOpportunitySchema = z.object({
  calendarEntry: z.unknown(), // CalendarEntry - using unknown to avoid circular dependency
  advanceHours: z.number(),
  confidence: z.number().min(0).max(100),
  estimatedLaunchTime: z.date(),
  preparationRecommendations: z.array(z.string()),
  riskAssessment: z.object({
    level: z.enum(["low", "medium", "high"]),
    factors: z.array(z.string()),
  }),
});

export type PreReadyPatternResult = z.infer<typeof PreReadyPatternResultSchema>;
export type AdvanceOpportunity = z.infer<typeof AdvanceOpportunitySchema>;

// ============================================================================
// Pattern Service Interface Types
// ============================================================================

export const PatternServiceOptionsSchema = z.object({
  threshold: z.number().min(0).max(1).optional(),
  limit: z.number().positive().optional(),
  sameTypeOnly: z.boolean().optional(),
  includeHistorical: z.boolean().optional(),
  timeRange: z
    .object({
      start: z.date(),
      end: z.date(),
    })
    .optional(),
});

export type PatternServiceOptions = z.infer<typeof PatternServiceOptionsSchema>;

// ============================================================================
// Error Types
// ============================================================================

export class PatternDetectionError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: any
  ) {
    super(message);
    this.name = "PatternDetectionError";
  }
}

export class PatternValidationError extends PatternDetectionError {
  constructor(
    message: string,
    public validationErrors: string[],
    context?: any
  ) {
    super(message, "VALIDATION_ERROR", context);
    this.name = "PatternValidationError";
  }
}

export class PatternAnalysisError extends PatternDetectionError {
  constructor(
    message: string,
    public analysisType: string,
    context?: any
  ) {
    super(message, "ANALYSIS_ERROR", context);
    this.name = "PatternAnalysisError";
  }
}

// ============================================================================
// Module Interface Types (for dependency injection)
// ============================================================================

export interface IPatternAnalyzer {
  detectReadyStatePattern(
    symbolData: SymbolEntry | SymbolEntry[]
  ): Promise<PatternMatch[]>;
  detectAdvanceOpportunities(
    calendarEntries: CalendarEntry[]
  ): Promise<PatternMatch[]>;
  detectPreReadyPatterns(symbolData: SymbolEntry[]): Promise<PatternMatch[]>;
  analyzeSymbolCorrelations(
    symbolData: SymbolEntry[]
  ): Promise<CorrelationAnalysis[]>;
  validateExactReadyState(symbol: SymbolEntry): boolean;
}

export interface IConfidenceCalculator {
  calculateReadyStateConfidence(symbol: SymbolEntry): Promise<number>;
  calculateAdvanceOpportunityConfidence(
    entry: CalendarEntry,
    advanceHours: number
  ): Promise<number>;
  calculatePreReadyScore(symbol: SymbolEntry): Promise<PreReadyPatternResult>;
  validateConfidenceScore(score: number): boolean;
  enhanceConfidenceWithActivity(
    baseConfidence: number,
    activities: ActivityData[]
  ): number;
}

export interface IPatternStorage {
  storeSuccessfulPattern(
    data: SymbolEntry | CalendarEntry,
    type: string,
    confidence: number
  ): Promise<void>;
  getHistoricalSuccessRate(patternType: string): Promise<number>;
  findSimilarPatterns(
    pattern: any,
    options?: PatternServiceOptions
  ): Promise<StoredPattern[]>;
  clearCache(): void;
  getCacheStats(): PatternCacheStats;
}

export interface IPatternValidator {
  validateSymbolEntry(symbol: SymbolEntry): ValidationResult;
  validateCalendarEntry(entry: CalendarEntry): ValidationResult;
  validatePatternMatch(match: PatternMatch): ValidationResult;
  validateAnalysisRequest(request: PatternAnalysisRequest): ValidationResult;
}

// ============================================================================
// Schema Collections
// ============================================================================

export const PATTERN_DETECTION_SCHEMAS = {
  // Core Patterns
  ReadyStatePatternSchema,
  PatternIndicatorsSchema,
  ActivityInfoSchema,
  PatternMatchSchema,

  // Analysis
  PatternAnalysisRequestSchema,
  CorrelationAnalysisSchema,
  PatternAnalysisResultSchema,

  // Configuration
  PatternDetectionConfigSchema,

  // Metrics
  PatternDetectionMetricsSchema,

  // Storage
  StoredPatternSchema,
  PatternCacheStatsSchema,

  // Validation
  ValidationResultSchema,

  // Enhanced Types
  PreReadyPatternResultSchema,
  AdvanceOpportunitySchema,

  // Service Options
  PatternServiceOptionsSchema,
} as const;

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate pattern detection data against a schema
 */
export function validatePatternData<T>(
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
        error: `Pattern validation failed: ${error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
      };
    }
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown pattern validation error",
    };
  }
}

/**
 * Validate pattern match completeness
 */
export function validatePatternMatchCompleteness(
  match: PatternMatch
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (match.confidence < 0 || match.confidence > 100) {
    errors.push("Confidence must be between 0 and 100");
  }

  if (match.confidence < 50) {
    warnings.push("Low confidence pattern match");
  }

  if (!match.symbol || match.symbol.trim().length === 0) {
    errors.push("Symbol is required");
  }

  if (match.advanceNoticeHours < 0) {
    errors.push("Advance notice hours cannot be negative");
  }

  if (!match.detectedAt) {
    errors.push("Detection timestamp is required");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Calculate confidence distribution
 */
export function calculateConfidenceDistribution(matches: PatternMatch[]): {
  low: number;
  medium: number;
  high: number;
} {
  const distribution = { low: 0, medium: 0, high: 0 };

  matches.forEach((match) => {
    if (match.confidence <= 33) {
      distribution.low++;
    } else if (match.confidence <= 66) {
      distribution.medium++;
    } else {
      distribution.high++;
    }
  });

  return distribution;
}
