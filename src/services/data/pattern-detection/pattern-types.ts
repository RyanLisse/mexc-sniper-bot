/**
 * Core Pattern Detection Types
 *
 * Defines all interfaces and types for the pattern detection system.
 * Preserves system architecture while providing type safety.
 */

import type { PatternEmbedding } from "@/src/db/schemas/patterns";
import type { ActivityData } from "@/src/schemas/unified/mexc-api-schemas";
import type {
  CalendarEntry,
  SymbolEntry,
} from "@/src/services/api/mexc-unified-exports";

// ============================================================================
// Core Pattern Types - Preserving System Architecture
// ============================================================================

export interface ReadyStatePattern {
  sts: 2; // Symbol Trading Status: Ready
  st: 2; // Symbol State: Active
  tt: 4; // Trading Time: Live
}

export interface PatternMatch {
  patternType: "ready_state" | "pre_ready" | "launch_sequence" | "risk_warning";
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
  detectedAt: Date;
  advanceNoticeHours: number;
  riskLevel: "low" | "medium" | "high";
  recommendation:
    | "immediate_action"
    | "monitor_closely"
    | "prepare_entry"
    | "wait"
    | "avoid";

  // Historical context
  similarPatterns?: PatternEmbedding[];
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
// Pattern Detection Constants
// ============================================================================

export const PATTERN_CONSTANTS = {
  READY_STATE_PATTERN: { sts: 2, st: 2, tt: 4 } as ReadyStatePattern,
  MIN_ADVANCE_HOURS: 3.5, // Core competitive advantage
  MIN_CONFIDENCE_THRESHOLD: 75,
  HIGH_CONFIDENCE_THRESHOLD: 90,
} as const;

// ============================================================================
// Utility Types
// ============================================================================

export type RiskLevel = "low" | "medium" | "high";
export type PatternType =
  | "ready_state"
  | "pre_ready"
  | "launch_sequence"
  | "risk_warning";
export type Recommendation =
  | "immediate_action"
  | "monitor_closely"
  | "prepare_entry"
  | "wait"
  | "avoid";
export type AnalysisType =
  | "discovery"
  | "monitoring"
  | "validation"
  | "correlation";
export type CorrelationType =
  | "launch_timing"
  | "market_sector"
  | "pattern_similarity";
