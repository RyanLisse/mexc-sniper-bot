/**
 * Enhanced Pattern Detection Core with Event System
 *
 * Adds event emission capabilities to the pattern detection core to enable
 * real-time integration with the Pattern-Target Bridge Service.
 *
 * This completes the missing bridge: Pattern Detection → Event Emission → Target Creation
 */

import { EventEmitter } from "events";
import { toSafeError } from "../../lib/error-type-utils";
import type { SymbolEntry } from "../../services/mexc-unified-exports";
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
 * Pattern Detection Event Data
 */
export interface PatternDetectionEventData {
  patternType: string;
  matches: PatternMatch[];
  metadata: {
    symbolsAnalyzed?: number;
    calendarEntriesAnalyzed?: number;
    duration: number;
    source: string;
    averageAdvanceHours?: number;
    averageEstimatedTimeToReady?: number;
    averageConfidence: number;
    highConfidenceCount: number;
  };
}

/**
 * Enhanced Pattern Detection Core with Event Emission
 */
export class EnhancedPatternDetectionCore extends EventEmitter {
  private static instance: EnhancedPatternDetectionCore;
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
          console.info("[enhanced-pattern-detection-core]", message, context || ""),
        warn: (message: string, context?: any) =>
          console.warn("[enhanced-pattern-detection-core]", message, context || ""),
        error: (message: string, context?: any, error?: Error) =>
          console.error("[enhanced-pattern-detection-core]", message, context || "", error || ""),
        debug: (message: string, context?: any) =>
          console.debug("[enhanced-pattern-detection-core]", message, context || ""),
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
    super();

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

    console.info("Enhanced Pattern Detection Core initialized", {
      config: this.config,
      eventsEnabled: true,
    });
  }

  static getInstance(config?: Partial<PatternDetectionConfig>): EnhancedPatternDetectionCore {
    if (!EnhancedPatternDetectionCore.instance) {
      EnhancedPatternDetectionCore.instance = new EnhancedPatternDetectionCore(config);
    }
    return EnhancedPatternDetectionCore.instance;
  }

  /**
   * Comprehensive Pattern Analysis with Event Emission
   */
  async analyzePatterns(request: PatternAnalysisRequest): Promise<PatternAnalysisResult> {
    const startTime = Date.now();

    try {
      // Validate request
      if (this.config.strictValidation) {
        const validation = this.patternValidator.validateAnalysisRequest(request);
        if (!validation.isValid) {
          throw new Error(`Invalid analysis request: ${validation.errors.join(", ")}`);
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

        // Emit ready state events
        if (readyMatches.length > 0) {
          await this.emitPatternEvent("ready_state", readyMatches, {
            symbolsAnalyzed: request.symbols.length,
            duration: Date.now() - startTime,
            source: "symbol_analysis",
          });
        }

        // Emit pre-ready events
        if (preReadyMatches.length > 0) {
          await this.emitPatternEvent("pre_ready", preReadyMatches, {
            symbolsAnalyzed: request.symbols.length,
            duration: Date.now() - startTime,
            source: "symbol_analysis",
          });
        }
      }

      // Advance opportunity detection for calendar entries
      if (request.calendarEntries && request.calendarEntries.length > 0) {
        const advanceMatches = await this.patternAnalyzer.detectAdvanceOpportunities(
          request.calendarEntries
        );
        allMatches.push(...advanceMatches);

        // Emit advance opportunity events
        if (advanceMatches.length > 0) {
          await this.emitPatternEvent("advance_opportunities", advanceMatches, {
            calendarEntriesAnalyzed: request.calendarEntries.length,
            duration: Date.now() - startTime,
            source: "calendar_analysis",
            averageAdvanceHours: this.calculateAverageAdvanceHours(advanceMatches),
          });
        }
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

      // Emit comprehensive analysis completion event
      if (filteredMatches.length > 0) {
        await this.emitPatternEvent("patterns_detected", filteredMatches, {
          symbolsAnalyzed: request.symbols?.length || 0,
          calendarEntriesAnalyzed: request.calendarEntries?.length || 0,
          duration: executionTime,
          source: "comprehensive_analysis",
          averageConfidence: summary.averageConfidence,
          highConfidenceCount: summary.highConfidenceMatches,
        });
      }

      console.info("Pattern analysis completed with events", {
        analysisType: request.analysisType,
        symbolsAnalyzed: request.symbols?.length || 0,
        calendarEntriesAnalyzed: request.calendarEntries?.length || 0,
        totalMatches: allMatches.length,
        filteredMatches: filteredMatches.length,
        eventsEmitted: this.getEventsEmittedCount(),
        executionTime,
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
        "Enhanced pattern analysis failed",
        {
          analysisType: request.analysisType,
          executionTime,
          error: safeError.message,
        },
        safeError
      );

      // Return empty results on error
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
   * Emit pattern detection events for bridge services
   */
  private async emitPatternEvent(
    patternType: string,
    matches: PatternMatch[],
    metadata: Partial<PatternDetectionEventData["metadata"]>
  ): Promise<void> {
    try {
      const eventData: PatternDetectionEventData = {
        patternType,
        matches,
        metadata: {
          duration: 0,
          source: "pattern_detection",
          averageConfidence: matches.reduce((sum, m) => sum + m.confidence, 0) / matches.length,
          highConfidenceCount: matches.filter((m) => m.confidence >= 80).length,
          ...metadata,
        },
      };

      // Emit the general patterns_detected event
      this.emit("patterns_detected", eventData);

      // Also emit specific pattern type events for bridge listeners
      this.emit(patternType, eventData);

      console.info("Pattern detection event emitted", {
        patternType,
        matchesCount: matches.length,
        averageConfidence: eventData.metadata.averageConfidence,
        source: metadata.source,
        generalListeners: this.listenerCount("patterns_detected"),
        specificListeners: this.listenerCount(patternType),
      });
    } catch (error) {
      console.error(
        "Failed to emit pattern event",
        {
          patternType,
          matchesCount: matches.length,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        error
      );
    }
  }

  /**
   * Calculate average advance hours from matches
   */
  private calculateAverageAdvanceHours(matches: PatternMatch[]): number {
    if (matches.length === 0) return 0;

    const totalHours = matches.reduce((sum, match) => sum + (match.advanceNoticeHours || 0), 0);
    return totalHours / matches.length;
  }

  /**
   * Get count of events emitted in this session
   */
  private getEventsEmittedCount(): number {
    return this.listenerCount("patterns_detected");
  }

  // ... (Keep all other methods from original PatternDetectionCore)

  /**
   * Legacy API Compatibility - Analyze Symbol Readiness
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

      // Emit single symbol analysis event
      if (match.patternType === "ready_state") {
        await this.emitPatternEvent("ready_state", [match], {
          symbolsAnalyzed: 1,
          duration: 0,
          source: "single_symbol_analysis",
        });
      }

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

  // Copy remaining methods from original PatternDetectionCore
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

  /**
   * Get Performance Metrics
   */
  getMetrics(): PatternDetectionMetrics & { cacheStats: any; eventStats: any } {
    const cacheStats = this.patternStorage.getCacheStats();

    return {
      ...this.metrics,
      cacheHitRatio: cacheStats.hitRatio,
      cacheStats,
      eventStats: {
        listenersCount: this.listenerCount("patterns_detected"),
        maxListeners: this.getMaxListeners(),
      },
    };
  }

  /**
   * Clear All Caches
   */
  clearCaches(): void {
    this.patternStorage.clearCache();
    console.info("All caches cleared");
  }

  /**
   * Update Configuration
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
      const matches = await this.patternAnalyzer.detectReadyStatePattern(symbols);

      // Emit event for ready state patterns
      if (matches.length > 0) {
        await this.emitPatternEvent("ready_state", matches, {
          symbolsAnalyzed: symbols.length,
          duration: 0,
          source: "direct_ready_state_detection",
        });
      }

      return matches;
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
      const matches = await this.patternAnalyzer.detectPreReadyPatterns(symbols);

      // Emit event for pre-ready patterns
      if (matches.length > 0) {
        await this.emitPatternEvent("pre_ready", matches, {
          symbolsAnalyzed: symbols.length,
          duration: 0,
          source: "direct_pre_ready_detection",
        });
      }

      return matches;
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
      const matches = await this.patternAnalyzer.detectAdvanceOpportunities(calendarEntries);

      // Emit event for advance opportunities
      if (matches.length > 0) {
        await this.emitPatternEvent("advance_opportunities", matches, {
          calendarEntriesAnalyzed: calendarEntries.length,
          duration: 0,
          source: "direct_advance_opportunities_detection",
          averageAdvanceHours: this.calculateAverageAdvanceHours(matches),
        });
      }

      return matches;
    } catch (error) {
      const safeError = toSafeError(error);
      console.error("Advance opportunity detection failed", {
        entryCount: calendarEntries.length,
        error: safeError.message,
      });
      return [];
    }
  }
}

// Export singleton instance
export const enhancedPatternDetectionCore = EnhancedPatternDetectionCore.getInstance();
