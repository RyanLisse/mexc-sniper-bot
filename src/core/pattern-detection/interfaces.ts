/**
 * Pattern Detection Core Interfaces
 *
 * Type-safe contracts for the decomposed pattern detection system.
 * These interfaces ensure clean architecture and testability.
 */

import type { CalendarEntry, SymbolEntry } from "@/src/services/api/mexc-unified-exports";
import type { ActivityData } from "../../schemas/unified/mexc-api-schemas";

// ============================================================================
// Core Pattern Types (Preserved from original engine)
// ============================================================================

export interface ReadyStatePattern {
  sts: 2; // Symbol Trading Status: Ready
  st: 2; // Symbol State: Active
  tt: 4; // Trading Time: Live
}

export interface PatternMatch {
  patternType:
    | "ready_state"
    | "pre_ready"
    | "launch_sequence"
    | "risk_warning"
    | "binance_listing_detected";
  confidence: number; // 0-100 confidence score
  symbol: string;
  vcoinId?: string;

  // Pattern-specific data
  indicators: {
    sts?: number;
    st?: number;
    tt?: number;
    advanceHours?: number;
    marketConditions?: Record<string, any>;
  };

  // Activity Enhancement Data
  activityInfo?: {
    activities: ActivityData[];
    activityBoost: number;
    hasHighPriorityActivity: boolean;
    activityTypes: string[];
  };

  // Analysis metadata
  detectedAt: Date | number; // Support both Date objects and timestamps
  advanceNoticeHours: number;
  estimatedTimeToReady?: number; // Estimated time in hours until pattern becomes ready
  riskLevel: "low" | "medium" | "high";
  recommendation: "immediate_action" | "monitor_closely" | "prepare_entry" | "wait" | "avoid";

  // Historical context
  similarPatterns?: any[];
  historicalSuccess?: number;
}

export interface PatternAnalysisRequest {
  symbols?: SymbolEntry[];
  calendarEntries?: CalendarEntry[];
  analysisType: "discovery" | "monitoring" | "validation" | "correlation";
  timeframe?: string;
  confidenceThreshold?: number;
  includeHistorical?: boolean;
}

export interface PatternAnalysisResult {
  matches: PatternMatch[];
  summary: {
    totalAnalyzed: number;
    readyStateFound: number;
    highConfidenceMatches: number;
    advanceOpportunities: number;
    averageConfidence: number;
  };
  recommendations: {
    immediate: PatternMatch[];
    monitor: PatternMatch[];
    prepare: PatternMatch[];
  };
  correlations?: CorrelationAnalysis[];
  analysisMetadata: {
    executionTime: number;
    algorithmsUsed: string[];
    confidenceDistribution: Record<string, number>;
  };
}

export interface CorrelationAnalysis {
  symbols: string[];
  correlationType: "launch_timing" | "market_sector" | "pattern_similarity";
  strength: number; // 0-1 correlation strength
  insights: string[];
  recommendations: string[];
}

// ============================================================================
// Module Interfaces for Decomposed Architecture
// ============================================================================

/**
 * Pattern Analyzer Interface
 * Handles core pattern detection algorithms
 */
export interface IPatternAnalyzer {
  detectReadyStatePattern(symbolData: SymbolEntry | SymbolEntry[]): Promise<PatternMatch[]>;
  detectAdvanceOpportunities(calendarEntries: CalendarEntry[]): Promise<PatternMatch[]>;
  detectPreReadyPatterns(symbolData: SymbolEntry[]): Promise<PatternMatch[]>;
  analyzeSymbolCorrelations(symbolData: SymbolEntry[]): Promise<CorrelationAnalysis[]>;
  validateExactReadyState(symbol: SymbolEntry): boolean;
}

/**
 * Confidence Calculator Interface
 * Handles confidence scoring and validation
 */
export interface IConfidenceCalculator {
  calculateReadyStateConfidence(symbol: SymbolEntry): Promise<number>;
  calculateAdvanceOpportunityConfidence(
    entry: CalendarEntry,
    advanceHours: number
  ): Promise<number>;
  calculatePreReadyScore(symbol: SymbolEntry): Promise<{
    isPreReady: boolean;
    confidence: number;
    estimatedTimeToReady: number;
  }>;
  validateConfidenceScore(score: number): boolean;
  enhanceConfidenceWithActivity(baseConfidence: number, activities: ActivityData[]): number;
}

/**
 * Pattern Storage Interface
 * Handles pattern persistence and caching
 */
export interface IPatternStorage {
  storeSuccessfulPattern(
    data: SymbolEntry | CalendarEntry,
    type: string,
    confidence: number
  ): Promise<void>;
  getHistoricalSuccessRate(patternType: string): Promise<number>;
  findSimilarPatterns(
    pattern: any,
    options?: {
      threshold?: number;
      limit?: number;
      sameTypeOnly?: boolean;
    }
  ): Promise<any[]>;
  clearCache(): void;
  getCacheStats(): {
    hitRatio: number;
    size: number;
    memoryUsage: number;
  };
}

/**
 * Pattern Validator Interface
 * Handles validation and data quality
 */
export interface IPatternValidator {
  validateSymbolEntry(symbol: SymbolEntry): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  validateCalendarEntry(entry: CalendarEntry): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  validatePatternMatch(match: PatternMatch): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  validateAnalysisRequest(request: PatternAnalysisRequest): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}

// ============================================================================
// Configuration and Options
// ============================================================================

export interface PatternDetectionConfig {
  // Core settings
  minAdvanceHours: number;
  confidenceThreshold: number;

  // Performance settings
  enableCaching: boolean;
  cacheTimeout: number;
  maxConcurrentAnalysis: number;

  // AI Enhancement settings
  enableAIEnhancement: boolean;
  enableActivityEnhancement: boolean;

  // Validation settings
  strictValidation: boolean;
  logValidationErrors: boolean;
}

export interface PatternDetectionMetrics {
  totalAnalyzed: number;
  patternsDetected: number;
  averageConfidence: number;
  executionTime: number;
  cacheHitRatio: number;
  errorCount: number;
  warningCount: number;
}

// ============================================================================
// Event Data Interface for Enhanced Pattern Detection
// ============================================================================

export interface PatternDetectionEventData {
  patternType: string;
  patterns?: PatternMatch[]; // For legacy compatibility
  matches?: PatternMatch[]; // For new usage
  detectionReason?: string; // Additional field for tests
  timestamp?: number; // Root-level timestamp
  metadata: {
    source: string;
    timestamp: Date;
    averageConfidence: number;
    algorithmVersion: string;
    processingTime: number;
    duration?: number; // Additional duration field
  };
}

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
