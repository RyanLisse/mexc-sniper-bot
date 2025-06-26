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
 */

import { toSafeError } from "../../lib/error-type-utils";
import type { SymbolEntry } from "../../services/mexc-unified-exports";
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
import { PatternAnalyzer } from "./pattern-analyzer";
import { PatternStorage } from "./pattern-storage";
import { PatternValidator } from "./pattern-validator";

/**
 * Pattern Detection Core Implementation
 *
 * Main orchestrator that coordinates all pattern detection modules.
 * Provides the same interface as the original engine but with improved architecture.
 */
export class PatternDetectionCore {
  private static instance: PatternDetectionCore;
  private _logger?: {
    info: (message: string, context?: any) => void;
    warn: (message: string, context?: any) => void;
    error: (message: string, context?: any, error?: Error) => void;
    debug: (message: string, context?: any) => void;
  };

  private get logger() {
    if (!this._logger) {
      this._logger = {
        info: (message: string, context?: any) =>
          console.info("[pattern-detection-core]", message, context || ""),
        warn: (message: string, context?: any) =>
          console.warn("[pattern-detection-core]", message, context || ""),
        error: (message: string, context?: any, error?: Error) =>
          console.error("[pattern-detection-core]", message, context || "", error || ""),
        debug: (message: string, context?: any) =>
          console.debug("[pattern-detection-core]", message, context || ""),
      };
    }
    return this._logger;
  }

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

    console.info("Pattern Detection Core initialized", {
      config: this.config,
    });
  }

  static getInstance(config?: Partial<PatternDetectionConfig>): PatternDetectionCore {
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
  async analyzePatterns(request: PatternAnalysisRequest): Promise<PatternAnalysisResult> {
    const startTime = Date.now();

    try {
      // Validate request
      if (this.config.strictValidation) {
        const validation = this.patternValidator.validateAnalysisRequest(request);
        if (!validation.isValid) {
          throw new PatternDetectionError(
            `Invalid analysis request: ${validation.errors.join(", ")}`,
            "VALIDATION_ERROR",
            { validation }
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
        const readyMatches = await this.patternAnalyzer.detectReadyStatePattern(request.symbols);
        const preReadyMatches = await this.patternAnalyzer.detectPreReadyPatterns(request.symbols);
        allMatches.push(...readyMatches, ...preReadyMatches);
      }

      // Advance opportunity detection for calendar entries
      if (request.calendarEntries && request.calendarEntries.length > 0) {
        const advanceMatches = await this.patternAnalyzer.detectAdvanceOpportunities(
          request.calendarEntries
        );
        allMatches.push(...advanceMatches);
      }

      // Correlation analysis if multiple symbols
      let correlations: CorrelationAnalysis[] = [];
      if (request.symbols && request.symbols.length > 1) {
        correlations = await this.patternAnalyzer.analyzeSymbolCorrelations(request.symbols);
      }

      // Filter by confidence threshold
      const filteredMatches = allMatches.filter(
        (match) =>
          match.confidence >= (request.confidenceThreshold || this.config.confidenceThreshold)
      );

      // Validate matches if strict validation is enabled
      if (this.config.strictValidation) {
        const validatedMatches = await this.validateMatches(filteredMatches);
        filteredMatches.splice(0, filteredMatches.length, ...validatedMatches);
      }

      // Categorize recommendations
      const recommendations = this.categorizeRecommendations(filteredMatches);

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
        confidenceThreshold: request.confidenceThreshold || this.config.confidenceThreshold,
        executionTime,
        correlationsFound: correlations.length,
      });

      return {
        matches: filteredMatches,
        summary,
        recommendations,
        correlations,
        analysisMetadata: {
          executionTime,
          algorithmsUsed: ["ready_state", "advance_detection", "pre_ready", "correlation"],
          confidenceDistribution: this.calculateConfidenceDistribution(allMatches),
        },
      };
    } catch (error) {
      const safeError = toSafeError(error);
      const executionTime = Date.now() - startTime;

      this.metrics.errorCount++;

      console.error(
        "Pattern analysis failed",
        {
          analysisType: request.analysisType,
          executionTime,
          error: safeError.message,
        },
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
    aiEnhancement?: any;
  } | null> {
    try {
      if (!symbol) return null;

      const matches = await this.patternAnalyzer.detectReadyStatePattern(symbol);

      if (matches.length === 0) {
        // Check if it's pre-ready
        const preReadyMatches = await this.patternAnalyzer.detectPreReadyPatterns([symbol]);
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
              activities: match.activityInfo.activities,
              activityBoost: match.activityInfo.activityBoost,
              hasHighPriorityActivity: match.activityInfo.hasHighPriorityActivity,
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
  getMetrics(): PatternDetectionMetrics & { cacheStats: any } {
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
  async detectReadyStatePattern(symbols: SymbolEntry[]): Promise<PatternMatch[]> {
    try {
      return await this.patternAnalyzer.detectReadyStatePattern(symbols);
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("Ready state pattern detection failed", {
        symbolCount: symbols.length,
        error: safeError.message,
      });
      return [];
    }
  }

  /**
   * Detect pre-ready patterns in symbols
   */
  async detectPreReadyPatterns(symbols: SymbolEntry[]): Promise<PatternMatch[]> {
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
  async detectAdvanceOpportunities(calendarEntries: any[]): Promise<PatternMatch[]> {
    try {
      return await this.patternAnalyzer.detectAdvanceOpportunities(calendarEntries);
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
  private async getActivityDataForSymbol(symbol: string): Promise<any[]> {
    try {
      // Use the dedicated activity integration service
      const activityData = await fetchActivityData(symbol);
      
      if (this.config.enableActivityEnhancement) {
        this.logger.debug("Activity data fetched", { 
          symbol, 
          count: activityData.length,
          activityTypes: [...new Set(activityData.map(a => a.activityType))]
        });
      }
      
      return activityData;
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.warn("Failed to fetch activity data", { 
        symbol, 
        error: safeError.message 
      });
      return [];
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async validateMatches(matches: PatternMatch[]): Promise<PatternMatch[]> {
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

  private categorizeRecommendations(matches: PatternMatch[]): {
    immediate: PatternMatch[];
    monitor: PatternMatch[];
    prepare: PatternMatch[];
  } {
    return {
      immediate: matches.filter((m) => m.recommendation === "immediate_action"),
      monitor: matches.filter((m) => m.recommendation === "monitor_closely"),
      prepare: matches.filter((m) => m.recommendation === "prepare_entry"),
    };
  }

  private calculateSummary(allMatches: PatternMatch[], filteredMatches: PatternMatch[]) {
    const readyStateFound = filteredMatches.filter((m) => m.patternType === "ready_state").length;
    const highConfidenceMatches = filteredMatches.filter((m) => m.confidence >= 80).length;
    const advanceOpportunities = filteredMatches.filter(
      (m) =>
        m.patternType === "launch_sequence" && m.advanceNoticeHours >= this.config.minAdvanceHours
    ).length;

    const avgConfidence =
      filteredMatches.length > 0
        ? filteredMatches.reduce((sum, m) => sum + m.confidence, 0) / filteredMatches.length
        : 0;

    return {
      totalAnalyzed: allMatches.length,
      readyStateFound,
      highConfidenceMatches,
      advanceOpportunities,
      averageConfidence: Math.round(avgConfidence * 100) / 100,
    };
  }

  private calculateConfidenceDistribution(matches: PatternMatch[]): Record<string, number> {
    const distribution = { "0-50": 0, "50-70": 0, "70-85": 0, "85-100": 0 };

    matches.forEach((match) => {
      if (match.confidence < 50) distribution["0-50"]++;
      else if (match.confidence < 70) distribution["50-70"]++;
      else if (match.confidence < 85) distribution["70-85"]++;
      else distribution["85-100"]++;
    });

    return distribution;
  }

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
        filteredMatches.reduce((sum, m) => sum + m.confidence, 0) / filteredMatches.length;
      this.metrics.averageConfidence = Math.round(avgConfidence * 100) / 100;
    }
  }
}
