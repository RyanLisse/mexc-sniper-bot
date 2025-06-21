/**
 * Extracted Pattern Detection Schemas
 *
 * This file contains all pattern detection-related Zod schemas extracted from the
 * pattern-detection-engine.ts file as part of the TDD refactoring process.
 *
 * Extracted schemas provide type safety and validation for pattern detection
 * configurations, matches, analysis requests/results, and correlation analysis.
 */

import { z } from "zod";

// ============================================================================
// Ready State Pattern Schema
// ============================================================================

/**
 * Ready State Pattern Schema - Core competitive advantage pattern (sts:2, st:2, tt:4)
 */
export const ReadyStatePatternSchema = z.object({
  sts: z.literal(2), // Symbol Trading Status: Ready (must be exactly 2)
  st: z.literal(2), // Symbol State: Active (must be exactly 2)
  tt: z.literal(4), // Trading Time: Live (must be exactly 4)
});

// ============================================================================
// Pattern Match Schema
// ============================================================================

/**
 * Pattern Indicators Schema
 */
export const PatternIndicatorsSchema = z.object({
  sts: z.number().min(0).optional(),
  st: z.number().min(0).optional(),
  tt: z.number().min(0).optional(),
  advanceHours: z.number().min(0).optional(),
  marketConditions: z.record(z.unknown()).optional(),
});

/**
 * Activity Information Schema
 */
export const ActivityInfoSchema = z.object({
  activities: z.array(z.record(z.unknown())),
  activityBoost: z.number().min(0),
  hasHighPriorityActivity: z.boolean(),
  activityTypes: z.array(z.string()),
});

/**
 * Pattern Match Schema
 */
export const PatternMatchSchema = z.object({
  // Core pattern identification
  patternType: z.enum(["ready_state", "pre_ready", "launch_sequence", "risk_warning"]),
  confidence: z.number().min(0).max(100),
  symbol: z.string().min(1),
  vcoinId: z.string().optional(),

  // Pattern-specific data
  indicators: PatternIndicatorsSchema,

  // Activity enhancement data (optional)
  activityInfo: ActivityInfoSchema.optional(),

  // Analysis metadata
  detectedAt: z.date(),
  advanceNoticeHours: z.number().min(0),
  riskLevel: z.enum(["low", "medium", "high"]),
  recommendation: z.enum(["immediate_action", "monitor_closely", "prepare_entry", "wait", "avoid"]),

  // Historical context (optional)
  similarPatterns: z.array(z.record(z.unknown())).optional(),
  historicalSuccess: z.number().min(0).max(100).optional(),
});

// ============================================================================
// Pattern Analysis Request Schema
// ============================================================================

/**
 * Symbol Entry Schema (simplified for analysis requests)
 */
export const SymbolEntrySchema = z
  .object({
    cd: z.string(),
    sts: z.number().optional(),
    st: z.number().optional(),
    tt: z.number().optional(),
  })
  .passthrough(); // Allow additional fields

/**
 * Calendar Entry Schema (simplified for analysis requests)
 */
export const CalendarEntrySchema = z
  .object({
    vcoinId: z.string(),
    symbol: z.string(),
    projectName: z.string(),
    firstOpenTime: z.number(),
  })
  .passthrough(); // Allow additional fields

/**
 * Pattern Analysis Request Schema
 */
export const PatternAnalysisRequestSchema = z.object({
  // Optional data sources
  symbols: z.array(SymbolEntrySchema).optional(),
  calendarEntries: z.array(CalendarEntrySchema).optional(),

  // Required analysis type
  analysisType: z.enum(["discovery", "monitoring", "validation", "correlation"]),

  // Optional analysis parameters
  timeframe: z.string().optional(),
  confidenceThreshold: z.number().min(0).max(100).optional(),
  includeHistorical: z.boolean().optional(),
});

// ============================================================================
// Pattern Analysis Result Schema
// ============================================================================

/**
 * Analysis Summary Schema
 */
export const AnalysisSummarySchema = z.object({
  totalAnalyzed: z.number().min(0).int(),
  readyStateFound: z.number().min(0).int(),
  highConfidenceMatches: z.number().min(0).int(),
  advanceOpportunities: z.number().min(0).int(),
  averageConfidence: z.number().min(0).max(100),
});

/**
 * Analysis Recommendations Schema
 */
export const AnalysisRecommendationsSchema = z.object({
  immediate: z.array(PatternMatchSchema),
  monitor: z.array(PatternMatchSchema),
  prepare: z.array(PatternMatchSchema),
});

/**
 * Analysis Metadata Schema
 */
export const AnalysisMetadataSchema = z.object({
  executionTime: z.number().min(0),
  algorithmsUsed: z.array(z.string()),
  confidenceDistribution: z.record(z.number().min(0)),
});

/**
 * Pattern Analysis Result Schema
 */
export const PatternAnalysisResultSchema = z.object({
  // Core results
  matches: z.array(PatternMatchSchema),
  summary: AnalysisSummarySchema,
  recommendations: AnalysisRecommendationsSchema,

  // Optional correlation analysis
  correlations: z.array(z.lazy(() => CorrelationAnalysisSchema)).optional(),

  // Analysis metadata
  analysisMetadata: AnalysisMetadataSchema,
});

// ============================================================================
// Correlation Analysis Schema
// ============================================================================

/**
 * Correlation Analysis Schema
 */
export const CorrelationAnalysisSchema = z.object({
  // Symbols involved in correlation
  symbols: z.array(z.string().min(1)),

  // Type of correlation analysis
  correlationType: z.enum(["launch_timing", "market_sector", "pattern_similarity"]),

  // Correlation strength (0-1 scale)
  strength: z.number().min(0).max(1),

  // Analysis insights and recommendations
  insights: z.array(z.string()),
  recommendations: z.array(z.string()),
});

// ============================================================================
// Type Exports
// ============================================================================

export type ReadyStatePattern = z.infer<typeof ReadyStatePatternSchema>;
export type PatternIndicators = z.infer<typeof PatternIndicatorsSchema>;
export type ActivityInfo = z.infer<typeof ActivityInfoSchema>;
export type PatternMatch = z.infer<typeof PatternMatchSchema>;
export type SymbolEntry = z.infer<typeof SymbolEntrySchema>;
export type CalendarEntry = z.infer<typeof CalendarEntrySchema>;
export type PatternAnalysisRequest = z.infer<typeof PatternAnalysisRequestSchema>;
export type AnalysisSummary = z.infer<typeof AnalysisSummarySchema>;
export type AnalysisRecommendations = z.infer<typeof AnalysisRecommendationsSchema>;
export type AnalysisMetadata = z.infer<typeof AnalysisMetadataSchema>;
export type PatternAnalysisResult = z.infer<typeof PatternAnalysisResultSchema>;
export type CorrelationAnalysis = z.infer<typeof CorrelationAnalysisSchema>;

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate ready state pattern
 */
export function validateReadyStatePattern(data: unknown): ReadyStatePattern {
  return ReadyStatePatternSchema.parse(data);
}

/**
 * Validate pattern match
 */
export function validatePatternMatch(data: unknown): PatternMatch {
  return PatternMatchSchema.parse(data);
}

/**
 * Validate pattern analysis request
 */
export function validatePatternAnalysisRequest(data: unknown): PatternAnalysisRequest {
  return PatternAnalysisRequestSchema.parse(data);
}

/**
 * Validate pattern analysis result
 */
export function validatePatternAnalysisResult(data: unknown): PatternAnalysisResult {
  return PatternAnalysisResultSchema.parse(data);
}

/**
 * Validate correlation analysis
 */
export function validateCorrelationAnalysis(data: unknown): CorrelationAnalysis {
  return CorrelationAnalysisSchema.parse(data);
}

// ============================================================================
// Schema Collections
// ============================================================================

/**
 * All available pattern detection schemas for bulk operations
 */
export const ALL_PATTERN_DETECTION_SCHEMAS = {
  ReadyStatePatternSchema,
  PatternIndicatorsSchema,
  ActivityInfoSchema,
  PatternMatchSchema,
  SymbolEntrySchema,
  CalendarEntrySchema,
  PatternAnalysisRequestSchema,
  AnalysisSummarySchema,
  AnalysisRecommendationsSchema,
  AnalysisMetadataSchema,
  PatternAnalysisResultSchema,
  CorrelationAnalysisSchema,
} as const;

/**
 * Core pattern detection schemas
 */
export const CORE_PATTERN_SCHEMAS = {
  ReadyStatePatternSchema,
  PatternMatchSchema,
  PatternAnalysisRequestSchema,
  PatternAnalysisResultSchema,
} as const;

/**
 * Analysis workflow schemas
 */
export const ANALYSIS_WORKFLOW_SCHEMAS = {
  PatternAnalysisRequestSchema,
  PatternAnalysisResultSchema,
  AnalysisSummarySchema,
  AnalysisRecommendationsSchema,
  AnalysisMetadataSchema,
} as const;

/**
 * Correlation and pattern matching schemas
 */
export const CORRELATION_SCHEMAS = {
  CorrelationAnalysisSchema,
  PatternMatchSchema,
  PatternIndicatorsSchema,
} as const;
