/**
 * Pattern Analyzer - Core Analysis Module
 *
 * Extracted from the monolithic pattern-detection-engine.ts (1503 lines).
 * Handles core pattern detection algorithms with improved modularity.
 *
 * Architecture:
 * - Clean separation of analysis logic
 * - Type-safe pattern matching
 * - Optimized for performance
 * - Comprehensive error handling
 */

import { toSafeError } from "../../lib/error-type-utils";
import { getActivityDataForSymbol as fetchActivityData } from "../../services/data/pattern-detection/activity-integration";
import type { CalendarEntry, SymbolEntry } from "../../services/mexc-unified-exports";
import type {
  CorrelationAnalysis,
  IPatternAnalyzer,
  PatternMatch,
  ReadyStatePattern,
} from "./interfaces";

/**
 * Pattern Analyzer Implementation
 *
 * Implements core pattern detection algorithms extracted from the original engine.
 * Focuses on performance and maintainability.
 */
export class PatternAnalyzer implements IPatternAnalyzer {
  private static instance: PatternAnalyzer;
  private readonly READY_STATE_PATTERN: ReadyStatePattern = { sts: 2, st: 2, tt: 4 };
  private readonly MIN_ADVANCE_HOURS = 3.5; // Core competitive advantage
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[pattern-analyzer]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[pattern-analyzer]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[pattern-analyzer]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[pattern-analyzer]", message, context || ""),
  };

  static getInstance(): PatternAnalyzer {
    if (!PatternAnalyzer.instance) {
      PatternAnalyzer.instance = new PatternAnalyzer();
    }
    return PatternAnalyzer.instance;
  }

  /**
   * Detect Ready State Pattern (Core Algorithm)
   *
   * Detects the critical sts:2, st:2, tt:4 ready state pattern.
   * This is the heart of our competitive advantage.
   */
  async detectReadyStatePattern(symbolData: SymbolEntry | SymbolEntry[]): Promise<PatternMatch[]> {
    const startTime = Date.now();

    // Handle null/undefined input gracefully
    if (!symbolData) {
      console.warn("Null/undefined symbol data provided to detectReadyStatePattern");
      return [];
    }

    const symbols = Array.isArray(symbolData) ? symbolData : [symbolData];
    const matches: PatternMatch[] = [];

    // Handle empty arrays
    if (symbols.length === 0) {
      return [];
    }

    for (const symbol of symbols) {
      try {
        // Validate symbol data
        if (!this.validateSymbolData(symbol)) {
          console.warn("Invalid symbol data", { symbol: symbol?.cd || "unknown" });
          continue;
        }

        // Core ready state pattern validation
        const isExactMatch = this.validateExactReadyState(symbol);

        if (isExactMatch) {
          // Import confidence calculator (lazy loading)
          const { ConfidenceCalculator } = await import("./confidence-calculator");
          const confidenceCalculator = new ConfidenceCalculator();

          const confidence = await confidenceCalculator.calculateReadyStateConfidence(symbol);

          if (confidence >= 85) {
            // Try to fetch activity data for enhanced analysis
            const activityData = await this.getActivityDataForSymbol(symbol.cd || "");

            let enhancedConfidence = confidence;
            let activityInfo;

            if (activityData && activityData.length > 0) {
              // Calculate activity boost
              const activityBoost = this.calculateActivityBoost(activityData);
              enhancedConfidence = Math.min(100, confidence + activityBoost);

              activityInfo = {
                activities: activityData,
                activityBoost,
                hasHighPriorityActivity: this.hasHighPriorityActivity(activityData),
                activityTypes: activityData
                  .map((a) => a.activityType)
                  .filter((v, i, a) => a.indexOf(v) === i),
              };
            }

            const match: PatternMatch = {
              patternType: "ready_state",
              confidence: enhancedConfidence,
              symbol: symbol.cd || "unknown",
              vcoinId: (symbol as any).vcoinId,
              indicators: {
                sts: symbol.sts,
                st: symbol.st,
                tt: symbol.tt,
              },
              detectedAt: new Date(),
              advanceNoticeHours: 0, // Ready now
              riskLevel: this.assessReadyStateRisk(symbol),
              recommendation: "immediate_action",
              historicalSuccess: 75, // Default for now
              activityInfo,
            };

            matches.push(match);
          }
        }
      } catch (error) {
        const safeError = toSafeError(error);
        console.error(
          "Error processing symbol",
          {
            symbol: symbol?.cd || "unknown",
            error: safeError.message,
          },
          safeError
        );
        // Continue with other symbols
      }
    }

    const duration = Date.now() - startTime;
    console.info("Ready state detection completed", {
      symbolsAnalyzed: symbols.length,
      patternsFound: matches.length,
      duration,
      averageConfidence:
        matches.length > 0
          ? Math.round(matches.reduce((sum, m) => sum + m.confidence, 0) / matches.length)
          : 0,
    });

    return matches;
  }

  /**
   * Detect Advance Opportunities
   *
   * 3.5+ Hour Early Warning System - Core competitive advantage.
   */
  async detectAdvanceOpportunities(calendarEntries: CalendarEntry[]): Promise<PatternMatch[]> {
    const startTime = Date.now();

    if (!calendarEntries || !Array.isArray(calendarEntries)) {
      return [];
    }

    const matches: PatternMatch[] = [];
    const now = Date.now();

    for (const entry of calendarEntries) {
      try {
        // Validate calendar entry
        if (!this.validateCalendarEntry(entry)) {
          continue;
        }

        const launchTimestamp =
          typeof entry.firstOpenTime === "number"
            ? entry.firstOpenTime
            : new Date(entry.firstOpenTime).getTime();

        const advanceHours = (launchTimestamp - now) / (1000 * 60 * 60);

        // Filter for our 3.5+ hour advantage window
        if (advanceHours >= this.MIN_ADVANCE_HOURS) {
          // Import confidence calculator (lazy loading)
          const { ConfidenceCalculator } = await import("./confidence-calculator");
          const confidenceCalculator = new ConfidenceCalculator();

          const confidence = await confidenceCalculator.calculateAdvanceOpportunityConfidence(
            entry,
            advanceHours
          );

          if (confidence >= 70) {
            // Try to fetch activity data for enhanced analysis
            const activityData = await this.getActivityDataForSymbol(entry.symbol || "");

            let enhancedConfidence = confidence;
            let activityInfo;

            if (activityData && activityData.length > 0) {
              // Calculate activity boost (scaled down for advance opportunities - 80% of normal)
              const activityBoost = Math.round(this.calculateActivityBoost(activityData) * 0.8);
              enhancedConfidence = Math.min(100, confidence + activityBoost);

              activityInfo = {
                activities: activityData,
                activityBoost,
                hasHighPriorityActivity: this.hasHighPriorityActivity(activityData),
                activityTypes: activityData
                  .map((a) => a.activityType)
                  .filter((v, i, a) => a.indexOf(v) === i),
              };
            }

            const match: PatternMatch = {
              patternType: "launch_sequence",
              confidence: enhancedConfidence,
              symbol: entry.symbol,
              vcoinId: entry.vcoinId,
              indicators: {
                sts: (entry as any).sts,
                st: (entry as any).st,
                tt: (entry as any).tt,
                advanceHours,
                marketConditions: {
                  projectType: this.classifyProject(entry.projectName || entry.symbol),
                  launchTiming: this.assessLaunchTiming(launchTimestamp),
                },
              },
              detectedAt: new Date(),
              advanceNoticeHours: advanceHours,
              riskLevel: this.assessAdvanceOpportunityRisk(entry, advanceHours),
              recommendation: this.getAdvanceRecommendation(advanceHours, enhancedConfidence),
              historicalSuccess: 75, // Default for now
              activityInfo,
            };

            matches.push(match);
          }
        }
      } catch (error) {
        const safeError = toSafeError(error);
        console.error(
          "Error processing calendar entry",
          {
            symbol: entry?.symbol || "unknown",
            error: safeError.message,
          },
          safeError
        );
        // Continue with other entries
      }
    }

    const duration = Date.now() - startTime;
    console.info("Advance opportunity detection completed", {
      calendarEntriesAnalyzed: calendarEntries.length,
      opportunitiesFound: matches.length,
      duration,
      minAdvanceHours: this.MIN_ADVANCE_HOURS,
      averageAdvanceHours:
        matches.length > 0
          ? Math.round(
              (matches.reduce((sum, m) => sum + m.advanceNoticeHours, 0) / matches.length) * 10
            ) / 10
          : 0,
    });

    return matches;
  }

  /**
   * Detect Pre-Ready Patterns
   *
   * Identifies symbols approaching ready state for monitoring setup.
   */
  async detectPreReadyPatterns(symbolData: SymbolEntry[]): Promise<PatternMatch[]> {
    if (!Array.isArray(symbolData)) {
      return [];
    }

    const matches: PatternMatch[] = [];

    for (const symbol of symbolData) {
      try {
        if (!this.validateSymbolData(symbol)) {
          continue;
        }

        const preReadyScore = await this.calculatePreReadyScore(symbol);

        if (preReadyScore.isPreReady && preReadyScore.confidence >= 60) {
          const match: PatternMatch = {
            patternType: "pre_ready",
            confidence: preReadyScore.confidence,
            symbol: symbol.cd || "unknown",
            vcoinId: (symbol as any).vcoinId,
            indicators: {
              sts: symbol.sts,
              st: symbol.st,
              tt: symbol.tt,
            },
            detectedAt: new Date(),
            advanceNoticeHours: preReadyScore.estimatedTimeToReady,
            riskLevel: "medium",
            recommendation: "monitor_closely",
          };

          matches.push(match);
        }
      } catch (error) {
        const safeError = toSafeError(error);
        console.error(
          "Error processing pre-ready symbol",
          {
            symbol: symbol?.cd || "unknown",
            error: safeError.message,
          },
          safeError
        );
        // Continue with other symbols
      }
    }

    return matches;
  }

  /**
   * Analyze Symbol Correlations
   *
   * Identifies correlated movements and market-wide patterns.
   */
  async analyzeSymbolCorrelations(symbolData: SymbolEntry[]): Promise<CorrelationAnalysis[]> {
    if (!Array.isArray(symbolData) || symbolData.length < 2) {
      return [];
    }

    const correlations: CorrelationAnalysis[] = [];

    try {
      // Analyze launch timing correlations
      const launchCorrelations = this.analyzeLaunchTimingCorrelations(symbolData);
      if (launchCorrelations.strength >= 0.5) {
        correlations.push(launchCorrelations);
      }

      // Analyze sector correlations
      const sectorCorrelations = this.analyzeSectorCorrelations(symbolData);
      if (sectorCorrelations.strength >= 0.3) {
        correlations.push(sectorCorrelations);
      }
    } catch (error) {
      const safeError = toSafeError(error);
      console.error(
        "Error analyzing correlations",
        {
          symbolsAnalyzed: symbolData.length,
          error: safeError.message,
        },
        safeError
      );
    }

    return correlations;
  }

  /**
   * Validate Exact Ready State
   *
   * Core validation for the sts:2, st:2, tt:4 pattern.
   */
  validateExactReadyState(symbol: SymbolEntry): boolean {
    if (!symbol) return false;

    return (
      symbol.sts === this.READY_STATE_PATTERN.sts &&
      symbol.st === this.READY_STATE_PATTERN.st &&
      symbol.tt === this.READY_STATE_PATTERN.tt
    );
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private validateSymbolData(symbol: SymbolEntry): boolean {
    if (!symbol) return false;

    // Check required fields
    if (
      typeof symbol.sts !== "number" ||
      typeof symbol.st !== "number" ||
      typeof symbol.tt !== "number"
    ) {
      return false;
    }

    return true;
  }

  private validateCalendarEntry(entry: CalendarEntry): boolean {
    if (!entry) return false;

    // Check required fields
    if (!entry.symbol || !entry.firstOpenTime) {
      return false;
    }

    return true;
  }

  private async calculatePreReadyScore(symbol: SymbolEntry): Promise<{
    isPreReady: boolean;
    confidence: number;
    estimatedTimeToReady: number;
  }> {
    let confidence = 0;
    let estimatedHours = 0;

    // Status progression analysis
    if (symbol.sts === 1 && symbol.st === 1) {
      confidence = 60;
      estimatedHours = 6; // Estimate 6 hours to ready
    } else if (symbol.sts === 2 && symbol.st === 1) {
      confidence = 75;
      estimatedHours = 2; // Estimate 2 hours to ready
    } else if (symbol.sts === 2 && symbol.st === 2 && symbol.tt !== 4) {
      confidence = 85;
      estimatedHours = 0.5; // Estimate 30 minutes to ready
    }

    const isPreReady = confidence > 0;

    return { isPreReady, confidence, estimatedTimeToReady: estimatedHours };
  }

  private assessReadyStateRisk(symbol: SymbolEntry): "low" | "medium" | "high" {
    // Low risk: Complete data, stable conditions
    if (symbol.cd && symbol.ca && symbol.ps !== undefined && symbol.qs !== undefined) {
      return "low";
    }

    // High risk: Missing critical data
    if (!symbol.cd || symbol.sts === undefined) {
      return "high";
    }

    return "medium";
  }

  private assessAdvanceOpportunityRisk(
    _entry: CalendarEntry,
    advanceHours: number
  ): "low" | "medium" | "high" {
    // High risk: Very early or very late
    if (advanceHours > 168 || advanceHours < 1) return "high";

    // Low risk: Optimal timing window
    if (advanceHours >= this.MIN_ADVANCE_HOURS && advanceHours <= 48) return "low";

    return "medium";
  }

  private getAdvanceRecommendation(
    advanceHours: number,
    confidence: number
  ): PatternMatch["recommendation"] {
    if (confidence >= 80 && advanceHours >= this.MIN_ADVANCE_HOURS && advanceHours <= 12) {
      return "prepare_entry";
    }
    if (confidence >= 70 && advanceHours >= 1) {
      return "monitor_closely";
    }
    if (confidence < 60) {
      return "wait";
    }
    return "monitor_closely";
  }

  private classifyProject(projectName: string): string {
    const name = projectName.toLowerCase();

    if (name.includes("defi") || name.includes("swap")) return "DeFi";
    if (name.includes("ai") || name.includes("artificial")) return "AI";
    if (name.includes("game") || name.includes("metaverse")) return "GameFi";
    if (name.includes("layer") || name.includes("chain")) return "Infrastructure";
    if (name.includes("meme")) return "Meme";

    return "Other";
  }

  private assessLaunchTiming(timestamp: number): {
    isWeekend: boolean;
    marketSession: string;
  } {
    const date = new Date(timestamp);
    const dayOfWeek = date.getDay();
    const hour = date.getUTCHours();

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    let marketSession = "off-hours";
    if (hour >= 8 && hour < 16) marketSession = "peak";
    else if (hour >= 0 && hour < 8) marketSession = "asia";
    else if (hour >= 16 && hour < 24) marketSession = "america";

    return { isWeekend, marketSession };
  }

  private analyzeLaunchTimingCorrelations(symbols: SymbolEntry[]): CorrelationAnalysis {
    // Simplified correlation analysis - can be enhanced
    const statusPattern = symbols.filter((s) => s.sts === 2).length / symbols.length;

    return {
      symbols: symbols.map((s) => s.cd || "unknown"),
      correlationType: "launch_timing",
      strength: statusPattern,
      insights: [`${Math.round(statusPattern * 100)}% of symbols showing similar status patterns`],
      recommendations:
        statusPattern > 0.7
          ? ["High correlation detected - monitor all symbols closely"]
          : ["Low correlation - analyze symbols individually"],
    };
  }

  private analyzeSectorCorrelations(symbols: SymbolEntry[]): CorrelationAnalysis {
    // Simplified sector analysis
    return {
      symbols: symbols.map((s) => s.cd || "unknown"),
      correlationType: "market_sector",
      strength: 0.3, // Default moderate correlation
      insights: ["Sector correlation analysis completed"],
      recommendations: ["Continue monitoring sector trends"],
    };
  }

  /**
   * Get activity data for a symbol (for enhanced analysis)
   */
  private async getActivityDataForSymbol(symbol: string): Promise<any[]> {
    try {
      // Use the dedicated activity integration service
      const activityData = await fetchActivityData(symbol);

      this.logger.debug("Activity data fetched", {
        symbol,
        count: activityData.length,
        activityTypes: [...new Set(activityData.map((a) => a.activityType))],
      });

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

  /**
   * Calculate activity boost based on activity data
   */
  private calculateActivityBoost(activities: any[]): number {
    if (!activities || activities.length === 0) return 0;

    let boost = 0;

    activities.forEach((activity) => {
      switch (activity.activityType) {
        case "SUN_SHINE":
          boost += 8; // High priority activity
          break;
        case "PROMOTION":
          boost += 5; // Medium priority activity
          break;
        case "LAUNCHPAD":
          boost += 10; // Highest priority activity
          break;
        default:
          boost += 2; // Default activity boost
      }
    });

    // Cap the boost at 15 points
    return Math.min(boost, 15);
  }

  /**
   * Check if activities contain high priority types
   */
  private hasHighPriorityActivity(activities: any[]): boolean {
    if (!activities || activities.length === 0) return false;

    const highPriorityTypes = ["SUN_SHINE", "LAUNCHPAD", "IEO"];
    return activities.some((activity) => highPriorityTypes.includes(activity.activityType));
  }
}
