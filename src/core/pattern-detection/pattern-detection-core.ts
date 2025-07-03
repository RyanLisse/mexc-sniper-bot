/**
 * Pattern Detection Core - Main Orchestrator
 *
 * Replaces the monolithic 1503-line pattern-detection-engine.ts with a clean,
 * modular architecture. Orchestrates all pattern detection modules.
 *
 * Architecture:
 * - Dependency injection
 * - Clean module coordination
 * - Comprehensive error handling
 * - Performance monitoring
 * - Event emission for pattern-target bridge integration
 */

import { EventEmitter } from "node:events";
import { toSafeError } from "../../lib/error-type-utils";
import type { ActivityData } from "../../schemas/unified/mexc-api-schemas";
import type {
  CalendarEntry,
  SymbolEntry,
} from "../../services/api/mexc-unified-exports";
import { getActivityDataForSymbol as fetchActivityData } from "../../services/data/pattern-detection/activity-integration";
import { ConfidenceCalculator } from "./confidence-calculator";
import type {
  CorrelationAnalysis,
  IConfidenceCalculator,
  IPatternAnalyzer,
  IPatternStorage,
  IPatternValidator,
  PatternAnalysisRequest,
  PatternAnalysisResult,
  PatternDetectionConfig,
  PatternDetectionMetrics,
  PatternMatch,
} from "./interfaces";
import { PatternDetectionError } from "./interfaces";
import { PatternAnalyzer } from "./pattern-analyzer";
import { PatternStorage } from "./pattern-storage";
import { PatternValidator } from "./pattern-validator";
import {
  calculateOptimizedAverageAdvanceHours,
  calculateOptimizedAverageTimeToReady,
  calculateOptimizedConfidenceDistribution,
  categorizeOptimizedRecommendations,
  filterByConfidenceThreshold,
} from "./shared/algorithm-utils";
// OPTIMIZATION: Shared utilities to reduce code duplication and improve performance
import { createErrorContext, createPatternLogger } from "./shared/logger-utils";

// AI Enhancement Types
interface AIEnhancement {
  enabled: boolean;
  modelVersion?: string;
  confidence: number;
  insights?: string[];
  activities?: ActivityData[];
  activityBoost?: number;
  hasHighPriorityActivity?: boolean;
}

/**
 * Pattern Detection Core Implementation
 *
 * Main orchestrator that coordinates all pattern detection modules.
 * Provides the same interface as the original engine but with improved architecture.
 * Extends EventEmitter to enable pattern-target bridge integration.
 */
export class PatternDetectionCore extends EventEmitter {
  private static instance: PatternDetectionCore;
  // OPTIMIZATION: Use shared logger to eliminate redundant code
  private logger = createPatternLogger("pattern-detection-core");

  // Module dependencies
  private patternAnalyzer: IPatternAnalyzer;
  private confidenceCalculator: IConfidenceCalculator;
  private patternStorage: IPatternStorage;
  private patternValidator: IPatternValidator;

  // Configuration
  private config: PatternDetectionConfig;

  // Metrics
  private metrics: PatternDetectionMetrics = {
    totalAnalyzed: 0,
    patternsDetected: 0,
    averageConfidence: 0,
    executionTime: 0,
    cacheHitRatio: 0,
    errorCount: 0,
    warningCount: 0,
  };

  private constructor(config?: Partial<PatternDetectionConfig>) {
    super(); // Initialize EventEmitter

    // Initialize default configuration
    this.config = {
      minAdvanceHours: 3.5,
      confidenceThreshold: 70,
      enableCaching: true,
      cacheTimeout: 5 * 60 * 1000, // 5 minutes
      maxConcurrentAnalysis: 10,
      enableAIEnhancement: true,
      enableActivityEnhancement: true,
      strictValidation: false,
      logValidationErrors: true,
      ...config,
    };

    // Initialize modules
    this.patternAnalyzer = PatternAnalyzer.getInstance();
    this.confidenceCalculator = ConfidenceCalculator.getInstance();
    this.patternStorage = PatternStorage.getInstance();
    this.patternValidator = PatternValidator.getInstance();

    this.logger.info("Pattern Detection Core initialized", {
      config: this.config,
    });
  }

  static getInstance(
    config?: Partial<PatternDetectionConfig>
  ): PatternDetectionCore {
    if (!PatternDetectionCore.instance) {
      PatternDetectionCore.instance = new PatternDetectionCore(config);
    }
    return PatternDetectionCore.instance;
  }

  /**
   * Comprehensive Pattern Analysis
   *
   * Main entry point for pattern analysis. Orchestrates all detection algorithms.
   */
  async analyzePatterns(
    request: PatternAnalysisRequest
  ): Promise<PatternAnalysisResult> {
    const startTime = Date.now();

    try {
      // Validate request
      if (this.config.strictValidation) {
        const validation =
          this.patternValidator.validateAnalysisRequest(request);
        if (!validation.isValid) {
          throw new PatternDetectionError(
            `Invalid analysis request: ${validation.errors.join(", ")}`,
            "VALIDATION_ERROR",
            { validation: validation.errors.join(", ") }
          );
        }

        if (validation.warnings.length > 0 && this.config.logValidationErrors) {
          console.warn("Analysis request warnings", {
            warnings: validation.warnings,
          });
          this.metrics.warningCount += validation.warnings.length;
        }
      }

      const allMatches: PatternMatch[] = [];

      // Ready state detection for symbols
      if (request.symbols && request.symbols.length > 0) {
        const readyMatches = await this.patternAnalyzer.detectReadyStatePattern(
          request.symbols
        );
        const preReadyMatches =
          await this.patternAnalyzer.detectPreReadyPatterns(request.symbols);
        allMatches.push(...readyMatches, ...preReadyMatches);
      }

      // Advance opportunity detection for calendar entries
      if (request.calendarEntries && request.calendarEntries.length > 0) {
        const advanceMatches =
          await this.patternAnalyzer.detectAdvanceOpportunities(
            request.calendarEntries
          );
        allMatches.push(...advanceMatches);
      }

      // Correlation analysis if multiple symbols
      let correlations: CorrelationAnalysis[] = [];
      if (request.symbols && request.symbols.length > 1) {
        correlations = await this.patternAnalyzer.analyzeSymbolCorrelations(
          request.symbols
        );
      }

      // OPTIMIZATION: Use optimized filtering for better performance
      const filteredMatches = filterByConfidenceThreshold(
        allMatches,
        request.confidenceThreshold || this.config.confidenceThreshold
      );

      // Validate matches if strict validation is enabled
      if (this.config.strictValidation) {
        const validatedMatches = await this.validateMatches(filteredMatches);
        filteredMatches.splice(0, filteredMatches.length, ...validatedMatches);
      }

      // OPTIMIZATION: Use optimized categorization algorithm
      const recommendations =
        categorizeOptimizedRecommendations(filteredMatches);

      // Calculate summary statistics
      const summary = this.calculateSummary(allMatches, filteredMatches);

      const executionTime = Date.now() - startTime;

      // Update metrics
      this.updateMetrics(allMatches, filteredMatches, executionTime);

      console.info("Pattern analysis completed", {
        analysisType: request.analysisType,
        symbolsAnalyzed: request.symbols?.length || 0,
        calendarEntriesAnalyzed: request.calendarEntries?.length || 0,
        totalMatches: allMatches.length,
        filteredMatches: filteredMatches.length,
        confidenceThreshold:
          request.confidenceThreshold || this.config.confidenceThreshold,
        executionTime,
        correlationsFound: correlations.length,
      });

      // Emit patterns_detected event for pattern-target bridge integration
      if (filteredMatches.length > 0) {
        const eventData = {
          patternType: request.analysisType || "mixed",
          matches: filteredMatches,
          metadata: {
            symbolsAnalyzed: request.symbols?.length || 0,
            calendarEntriesAnalyzed: request.calendarEntries?.length || 0,
            duration: executionTime,
            source: "pattern-detection-core",
            // OPTIMIZATION: Use optimized calculation algorithms
            averageAdvanceHours:
              calculateOptimizedAverageAdvanceHours(filteredMatches),
            averageEstimatedTimeToReady:
              calculateOptimizedAverageTimeToReady(filteredMatches),
          },
        };

        this.emit("patterns_detected", eventData);

        console.info("Pattern detection event emitted", {
          eventType: "patterns_detected",
          patternsCount: filteredMatches.length,
          patternTypes: Array.from(
            new Set(filteredMatches.map((m) => m.patternType))
          ),
        });
      }

      return {
        matches: filteredMatches,
        summary,
        recommendations,
        correlations,
        analysisMetadata: {
          executionTime,
          algorithmsUsed: [
            "ready_state",
            "advance_detection",
            "pre_ready",
            "correlation",
          ],
          // OPTIMIZATION: Use optimized confidence distribution algorithm
          confidenceDistribution:
            calculateOptimizedConfidenceDistribution(allMatches),
        },
      };
    } catch (error) {
      const safeError = toSafeError(error);
      const executionTime = Date.now() - startTime;

      this.metrics.errorCount++;

      // OPTIMIZATION: Use optimized error context creation and shared logger
      this.logger.error(
        "Pattern analysis failed",
        createErrorContext("pattern_analysis", request.analysisType, {
          executionTime,
        }),
        safeError
      );

      // Return empty results on error rather than throwing
      return {
        matches: [],
        summary: {
          totalAnalyzed: 0,
          readyStateFound: 0,
          highConfidenceMatches: 0,
          advanceOpportunities: 0,
          averageConfidence: 0,
        },
        recommendations: {
          immediate: [],
          monitor: [],
          prepare: [],
        },
        correlations: [],
        analysisMetadata: {
          executionTime,
          algorithmsUsed: [],
          confidenceDistribution: {},
        },
      };
    }
  }

  /**
   * Analyze Symbol Readiness (Legacy API Compatibility)
   *
   * Provides backward compatibility with the original engine API.
   */
  async analyzeSymbolReadiness(symbol: SymbolEntry): Promise<{
    isReady: boolean;
    confidence: number;
    patternType: string;
    enhancedAnalysis?: boolean;
    aiEnhancement?: AIEnhancement;
  } | null> {
    try {
      if (!symbol) return null;

      const matches =
        await this.patternAnalyzer.detectReadyStatePattern(symbol);

      if (matches.length === 0) {
        // Check if it's pre-ready
        const preReadyMatches =
          await this.patternAnalyzer.detectPreReadyPatterns([symbol]);
        if (preReadyMatches.length > 0) {
          const match = preReadyMatches[0];
          return {
            isReady: false,
            confidence: match.confidence,
            patternType: match.patternType,
            enhancedAnalysis: true,
          };
        }
        return null;
      }

      const match = matches[0];
      return {
        isReady: match.patternType === "ready_state",
        confidence: match.confidence,
        patternType: match.patternType,
        enhancedAnalysis: true,
        aiEnhancement: match.activityInfo
          ? {
              enabled: true,
              confidence: match.confidence,
              activities: match.activityInfo.activities,
              activityBoost: match.activityInfo.activityBoost,
              hasHighPriorityActivity:
                match.activityInfo.hasHighPriorityActivity,
            }
          : undefined,
      };
    } catch (error) {
      const safeError = toSafeError(error);
      console.error(
        "Symbol readiness analysis failed",
        {
          symbol: symbol.cd || "unknown",
          error: safeError.message,
        },
        safeError
      );
      return null;
    }
  }

  /**
   * Get Performance Metrics
   *
   * Returns current performance metrics and cache statistics.
   */
  getMetrics(): PatternDetectionMetrics & {
    cacheStats: { hitRatio: number; size: number; memoryUsage: number };
  } {
    const cacheStats = this.patternStorage.getCacheStats();

    return {
      ...this.metrics,
      cacheHitRatio: cacheStats.hitRatio,
      cacheStats,
    };
  }

  /**
   * Clear All Caches
   *
   * Clears all cached data across all modules.
   */
  clearCaches(): void {
    this.patternStorage.clearCache();
    console.info("All caches cleared");
  }

  /**
   * Update Configuration
   *
   * Updates the configuration at runtime.
   */
  updateConfig(newConfig: Partial<PatternDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.info("Configuration updated", { newConfig });
  }

  /**
   * Detect ready state patterns in symbols
   */
  async detectReadyStatePattern(
    symbols: SymbolEntry | SymbolEntry[]
  ): Promise<PatternMatch[]> {
    try {
      return await this.patternAnalyzer.detectReadyStatePattern(symbols);
    } catch (error) {
      const safeError = toSafeError(error);
      const symbolCount = Array.isArray(symbols) ? symbols.length : 1;
      console.error("Ready state pattern detection failed", {
        symbolCount,
        error: safeError.message,
      });
      return [];
    }
  }

  /**
   * Detect pre-ready patterns in symbols
   */
  async detectPreReadyPatterns(
    symbols: SymbolEntry[]
  ): Promise<PatternMatch[]> {
    try {
      return await this.patternAnalyzer.detectPreReadyPatterns(symbols);
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("Pre-ready pattern detection failed", {
        symbolCount: symbols.length,
        error: safeError.message,
      });
      return [];
    }
  }

  /**
   * Detect advance opportunities from calendar entries
   */
  async detectAdvanceOpportunities(
    calendarEntries: CalendarEntry[]
  ): Promise<PatternMatch[]> {
    try {
      return await this.patternAnalyzer.detectAdvanceOpportunities(
        calendarEntries
      );
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("Advance opportunity detection failed", {
        entryCount: calendarEntries.length,
        error: safeError.message,
      });
      return [];
    }
  }

  /**
   * Get activity data for a symbol
   *
   * Integrates with the activity data service to fetch real activity data
   * for enhanced pattern detection confidence.
   */
  private async getActivityDataForSymbol(
    symbol: string
  ): Promise<ActivityData[]> {
    try {
      // Use the dedicated activity integration service
      const activityData = await fetchActivityData(symbol);

      if (this.config.enableActivityEnhancement) {
        this.logger.debug("Activity data fetched", {
          symbol,
          count: activityData.length,
          activityTypes: Array.from(
            new Set(activityData.map((a) => a.activityType))
          ),
        });
      }

      return activityData;
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.warn("Failed to fetch activity data", {
        symbol,
        error: safeError.message,
      });
      return [];
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async validateMatches(
    matches: PatternMatch[]
  ): Promise<PatternMatch[]> {
    const validatedMatches: PatternMatch[] = [];

    for (const match of matches) {
      const validation = this.patternValidator.validatePatternMatch(match);

      if (validation.isValid) {
        validatedMatches.push(match);
      } else {
        this.metrics.errorCount++;
        if (this.config.logValidationErrors) {
          console.warn("Invalid pattern match filtered out", {
            symbol: match.symbol,
            patternType: match.patternType,
            errors: validation.errors,
          });
        }
      }

      if (validation.warnings.length > 0) {
        this.metrics.warningCount += validation.warnings.length;
        if (this.config.logValidationErrors) {
          console.warn("Pattern match warnings", {
            symbol: match.symbol,
            warnings: validation.warnings,
          });
        }
      }
    }

    return validatedMatches;
  }

  // OPTIMIZATION: Removed redundant categorizeRecommendations method - using optimized version from algorithm-utils

  private calculateSummary(
    allMatches: PatternMatch[],
    filteredMatches: PatternMatch[]
  ) {
    const readyStateFound = filteredMatches.filter(
      (m) => m.patternType === "ready_state"
    ).length;
    const highConfidenceMatches = filteredMatches.filter(
      (m) => m.confidence >= 80
    ).length;
    const advanceOpportunities = filteredMatches.filter(
      (m) =>
        m.patternType === "launch_sequence" &&
        m.advanceNoticeHours >= this.config.minAdvanceHours
    ).length;

    const avgConfidence =
      filteredMatches.length > 0
        ? filteredMatches.reduce((sum, m) => sum + m.confidence, 0) /
          filteredMatches.length
        : 0;

    return {
      totalAnalyzed: allMatches.length,
      readyStateFound,
      highConfidenceMatches,
      advanceOpportunities,
      averageConfidence: Math.round(avgConfidence * 100) / 100,
    };
  }

  // OPTIMIZATION: Removed redundant calculateConfidenceDistribution method - using optimized version from algorithm-utils

  private updateMetrics(
    allMatches: PatternMatch[],
    filteredMatches: PatternMatch[],
    executionTime: number
  ): void {
    this.metrics.totalAnalyzed += allMatches.length;
    this.metrics.patternsDetected += filteredMatches.length;
    this.metrics.executionTime = executionTime;

    if (filteredMatches.length > 0) {
      const avgConfidence =
        filteredMatches.reduce((sum, m) => sum + m.confidence, 0) /
        filteredMatches.length;
      this.metrics.averageConfidence = Math.round(avgConfidence * 100) / 100;
    }
  }

  // OPTIMIZATION: Removed redundant calculateAverageAdvanceHours and calculateAverageTimeToReady methods
  // Using optimized versions from algorithm-utils for better performance
}
