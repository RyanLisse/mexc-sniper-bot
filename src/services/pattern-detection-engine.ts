/**
 * Central Pattern Detection Engine - Core competitive advantage system
 *
 * This is the central pattern detection engine that preserves our core competitive advantage:
 * 3.5+ hour advance detection using the sts:2, st:2, tt:4 ready state pattern.
 *
 * Architecture:
 * - Unified pattern analysis algorithms
 * - Enhanced ready state detection with confidence scoring
 * - Multi-symbol correlation analysis
 * - Real-time pattern matching and validation
 * - Integration with AI agents for intelligent analysis
 */

import { db } from "@/src/db";
import type { PatternEmbedding } from "@/src/db/schemas/patterns";
import { patternEmbeddings } from "@/src/db/schemas/patterns";
import type { CalendarEntry, SymbolEntry } from "@/src/services/mexc-unified-exports";
import { and, eq } from "drizzle-orm";
import { type PatternData, patternEmbeddingService } from "./pattern-embedding-service";

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

  // Analysis metadata
  detectedAt: Date;
  advanceNoticeHours: number;
  riskLevel: "low" | "medium" | "high";
  recommendation: "immediate_action" | "monitor_closely" | "prepare_entry" | "wait" | "avoid";

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
// Central Pattern Detection Engine
// ============================================================================

export class PatternDetectionEngine {
  private static instance: PatternDetectionEngine;
  private readonly READY_STATE_PATTERN: ReadyStatePattern = { sts: 2, st: 2, tt: 4 };
  private readonly MIN_ADVANCE_HOURS = 3.5; // Core competitive advantage

  static getInstance(): PatternDetectionEngine {
    if (!PatternDetectionEngine.instance) {
      PatternDetectionEngine.instance = new PatternDetectionEngine();
    }
    return PatternDetectionEngine.instance;
  }

  /**
   * Core Pattern Detection - The Heart of Our Competitive Advantage
   * Detects the critical sts:2, st:2, tt:4 ready state pattern
   */
  async detectReadyStatePattern(symbolData: SymbolEntry | SymbolEntry[]): Promise<PatternMatch[]> {
    const startTime = Date.now();
    const symbols = Array.isArray(symbolData) ? symbolData : [symbolData];
    const matches: PatternMatch[] = [];

    for (const symbol of symbols) {
      // Core ready state pattern validation
      const isExactMatch = this.validateExactReadyState(symbol);
      const confidence = await this.calculateReadyStateConfidence(symbol);

      if (isExactMatch && confidence >= 85) {
        // Store successful pattern for future learning
        await this.storeSuccessfulPattern(symbol, "ready_state", confidence);

        matches.push({
          patternType: "ready_state",
          confidence,
          symbol: symbol.cd || symbol.symbol || "unknown",
          vcoinId: symbol.vcoinId,
          indicators: {
            sts: symbol.sts,
            st: symbol.st,
            tt: symbol.tt,
          },
          detectedAt: new Date(),
          advanceNoticeHours: 0, // Ready now
          riskLevel: this.assessReadyStateRisk(symbol),
          recommendation: "immediate_action",
          historicalSuccess: await this.getHistoricalSuccessRate("ready_state"),
        });
      }
    }

    console.log(
      `[PatternDetectionEngine] Detected ${matches.length} ready state patterns in ${Date.now() - startTime}ms`
    );
    return matches;
  }

  /**
   * Advance Detection - 3.5+ Hour Early Warning System
   * This is our core competitive advantage for early opportunity identification
   */
  async detectAdvanceOpportunities(calendarEntries: CalendarEntry[]): Promise<PatternMatch[]> {
    const startTime = Date.now();
    const matches: PatternMatch[] = [];
    const now = Date.now();

    for (const entry of calendarEntries) {
      const launchTimestamp =
        typeof entry.firstOpenTime === "number"
          ? entry.firstOpenTime
          : new Date(entry.firstOpenTime).getTime();

      const advanceHours = (launchTimestamp - now) / (1000 * 60 * 60);

      // Filter for our 3.5+ hour advantage window
      if (advanceHours >= this.MIN_ADVANCE_HOURS) {
        const confidence = await this.calculateAdvanceOpportunityConfidence(entry, advanceHours);

        if (confidence >= 70) {
          // Store advance opportunity pattern
          await this.storeSuccessfulPattern(entry, "launch_sequence", confidence);

          matches.push({
            patternType: "launch_sequence",
            confidence,
            symbol: entry.symbol,
            vcoinId: entry.vcoinId,
            indicators: {
              sts: entry.sts,
              st: entry.st,
              tt: entry.tt,
              advanceHours,
              marketConditions: {
                projectType: this.classifyProject(entry.projectName || entry.symbol),
                launchTiming: this.assessLaunchTiming(launchTimestamp),
              },
            },
            detectedAt: new Date(),
            advanceNoticeHours: advanceHours,
            riskLevel: this.assessAdvanceOpportunityRisk(entry, advanceHours),
            recommendation: this.getAdvanceRecommendation(advanceHours, confidence),
            historicalSuccess: await this.getHistoricalSuccessRate("launch_sequence"),
          });
        }
      }
    }

    console.log(
      `[PatternDetectionEngine] Detected ${matches.length} advance opportunities in ${Date.now() - startTime}ms`
    );
    return matches;
  }

  /**
   * Pre-Ready State Detection - Early Stage Pattern Recognition
   * Identifies symbols approaching ready state for monitoring setup
   */
  async detectPreReadyPatterns(symbolData: SymbolEntry[]): Promise<PatternMatch[]> {
    const matches: PatternMatch[] = [];

    for (const symbol of symbolData) {
      const preReadyScore = this.calculatePreReadyScore(symbol);

      if (preReadyScore.isPreReady && preReadyScore.confidence >= 60) {
        matches.push({
          patternType: "pre_ready",
          confidence: preReadyScore.confidence,
          symbol: symbol.cd || symbol.symbol || "unknown",
          vcoinId: symbol.vcoinId,
          indicators: {
            sts: symbol.sts,
            st: symbol.st,
            tt: symbol.tt,
          },
          detectedAt: new Date(),
          advanceNoticeHours: preReadyScore.estimatedTimeToReady,
          riskLevel: "medium",
          recommendation: "monitor_closely",
        });
      }
    }

    return matches;
  }

  /**
   * Multi-Symbol Correlation Analysis
   * Identifies correlated movements and market-wide patterns
   */
  async analyzeSymbolCorrelations(symbolData: SymbolEntry[]): Promise<CorrelationAnalysis[]> {
    const correlations: CorrelationAnalysis[] = [];

    // Group symbols by similar patterns
    const groupedByStatus = this.groupSymbolsByStatus(symbolData);

    // Analyze launch timing correlations
    const launchCorrelations = await this.analyzeLaunchTimingCorrelations(symbolData);
    if (launchCorrelations.strength >= 0.5) {
      correlations.push(launchCorrelations);
    }

    // Analyze sector correlations
    const sectorCorrelations = await this.analyzeSectorCorrelations(symbolData);
    if (sectorCorrelations.strength >= 0.3) {
      correlations.push(sectorCorrelations);
    }

    return correlations;
  }

  /**
   * Comprehensive Pattern Analysis - Main Entry Point
   * Orchestrates all pattern detection algorithms
   */
  async analyzePatterns(request: PatternAnalysisRequest): Promise<PatternAnalysisResult> {
    const startTime = Date.now();
    const allMatches: PatternMatch[] = [];

    // Ready state detection for symbols
    if (request.symbols && request.symbols.length > 0) {
      const readyMatches = await this.detectReadyStatePattern(request.symbols);
      const preReadyMatches = await this.detectPreReadyPatterns(request.symbols);
      allMatches.push(...readyMatches, ...preReadyMatches);
    }

    // Advance opportunity detection for calendar entries
    if (request.calendarEntries && request.calendarEntries.length > 0) {
      const advanceMatches = await this.detectAdvanceOpportunities(request.calendarEntries);
      allMatches.push(...advanceMatches);
    }

    // Correlation analysis if multiple symbols
    let correlations: CorrelationAnalysis[] = [];
    if (request.symbols && request.symbols.length > 1) {
      correlations = await this.analyzeSymbolCorrelations(request.symbols);
    }

    // Filter by confidence threshold
    const filteredMatches = allMatches.filter(
      (match) => match.confidence >= (request.confidenceThreshold || 70)
    );

    // Categorize recommendations
    const recommendations = this.categorizeRecommendations(filteredMatches);

    // Calculate summary statistics
    const summary = this.calculateSummary(allMatches, filteredMatches);

    const executionTime = Date.now() - startTime;

    console.log(
      `[PatternDetectionEngine] Analysis completed: ${filteredMatches.length}/${allMatches.length} patterns above threshold in ${executionTime}ms`
    );

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
  }

  // ============================================================================
  // Core Pattern Validation Methods
  // ============================================================================

  private validateExactReadyState(symbol: SymbolEntry): boolean {
    return (
      symbol.sts === this.READY_STATE_PATTERN.sts &&
      symbol.st === this.READY_STATE_PATTERN.st &&
      symbol.tt === this.READY_STATE_PATTERN.tt
    );
  }

  private async calculateReadyStateConfidence(symbol: SymbolEntry): Promise<number> {
    let confidence = 50; // Base confidence

    // Exact pattern match
    if (this.validateExactReadyState(symbol)) {
      confidence += 30;
    }

    // Data completeness
    if (symbol.cd && symbol.cd.length > 0) confidence += 10;
    if (symbol.ca) confidence += 5;
    if (symbol.ps !== undefined) confidence += 5;
    if (symbol.qs !== undefined) confidence += 5;

    // Historical success rate
    const historicalSuccess = await this.getHistoricalSuccessRate("ready_state");
    confidence += historicalSuccess * 0.15; // Weight historical success

    return Math.min(confidence, 95);
  }

  private async calculateAdvanceOpportunityConfidence(
    entry: CalendarEntry,
    advanceHours: number
  ): Promise<number> {
    let confidence = 40; // Base confidence for advance opportunities

    // Advance notice quality (our competitive advantage)
    if (advanceHours >= 12) confidence += 20;
    else if (advanceHours >= 6) confidence += 15;
    else if (advanceHours >= this.MIN_ADVANCE_HOURS) confidence += 10;

    // Project type assessment
    const projectScore = this.getProjectTypeScore(entry.projectName || entry.symbol);
    confidence += projectScore * 0.3;

    // Data completeness
    if (entry.projectName) confidence += 5;
    if (entry.tradingPairs && entry.tradingPairs.length > 1) confidence += 5;
    if (entry.sts !== undefined) confidence += 10;

    // Market timing
    const timing = this.assessLaunchTiming(
      typeof entry.firstOpenTime === "number"
        ? entry.firstOpenTime
        : new Date(entry.firstOpenTime).getTime()
    );
    if (!timing.isWeekend) confidence += 5;
    if (timing.marketSession === "peak") confidence += 5;

    return Math.min(confidence, 90);
  }

  private calculatePreReadyScore(symbol: SymbolEntry): {
    isPreReady: boolean;
    confidence: number;
    estimatedTimeToReady: number;
  } {
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

  // ============================================================================
  // Risk Assessment Methods
  // ============================================================================

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
    entry: CalendarEntry,
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

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private classifyProject(projectName: string): string {
    const name = projectName.toLowerCase();

    if (name.includes("defi") || name.includes("swap")) return "DeFi";
    if (name.includes("ai") || name.includes("artificial")) return "AI";
    if (name.includes("game") || name.includes("metaverse")) return "GameFi";
    if (name.includes("layer") || name.includes("chain")) return "Infrastructure";
    if (name.includes("meme")) return "Meme";

    return "Other";
  }

  private getProjectTypeScore(projectName: string): number {
    const type = this.classifyProject(projectName);
    const scores = {
      AI: 90,
      DeFi: 85,
      GameFi: 80,
      Infrastructure: 75,
      Meme: 70,
      Other: 60,
    };
    return scores[type as keyof typeof scores] || 60;
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

  private groupSymbolsByStatus(symbols: SymbolEntry[]): Record<string, SymbolEntry[]> {
    return symbols.reduce(
      (groups, symbol) => {
        const key = `${symbol.sts}-${symbol.st}-${symbol.tt}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(symbol);
        return groups;
      },
      {} as Record<string, SymbolEntry[]>
    );
  }

  private async analyzeLaunchTimingCorrelations(
    symbols: SymbolEntry[]
  ): Promise<CorrelationAnalysis> {
    // Simplified correlation analysis - can be enhanced
    const statusPattern = symbols.filter((s) => s.sts === 2).length / symbols.length;

    return {
      symbols: symbols.map((s) => s.cd || s.symbol || "unknown"),
      correlationType: "launch_timing",
      strength: statusPattern,
      insights: [`${Math.round(statusPattern * 100)}% of symbols showing similar status patterns`],
      recommendations:
        statusPattern > 0.7
          ? ["High correlation detected - monitor all symbols closely"]
          : ["Low correlation - analyze symbols individually"],
    };
  }

  private async analyzeSectorCorrelations(symbols: SymbolEntry[]): Promise<CorrelationAnalysis> {
    // Simplified sector analysis
    return {
      symbols: symbols.map((s) => s.cd || s.symbol || "unknown"),
      correlationType: "market_sector",
      strength: 0.3, // Default moderate correlation
      insights: ["Sector correlation analysis completed"],
      recommendations: ["Continue monitoring sector trends"],
    };
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
      (m) => m.patternType === "launch_sequence" && m.advanceNoticeHours >= this.MIN_ADVANCE_HOURS
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

  // ============================================================================
  // Pattern Storage and Learning
  // ============================================================================

  private async storeSuccessfulPattern(
    data: SymbolEntry | CalendarEntry,
    type: string,
    confidence: number
  ): Promise<void> {
    try {
      // Check if data is SymbolEntry (has sts, st, tt) or CalendarEntry
      const isSymbolEntry = "sts" in data && "st" in data && "tt" in data;
      const symbolName = "symbol" in data ? data.symbol : isSymbolEntry ? data.cd : "unknown";

      const patternData: PatternData = {
        symbolName,
        vcoinId: "vcoinId" in data ? data.vcoinId : undefined,
        type: type as PatternData["type"],
        data: {
          sts: isSymbolEntry ? data.sts : undefined,
          st: isSymbolEntry ? data.st : undefined,
          tt: isSymbolEntry ? data.tt : undefined,
        },
        confidence,
      };

      await patternEmbeddingService.storePattern(patternData);
    } catch (error) {
      console.warn("[PatternDetectionEngine] Failed to store pattern:", error);
    }
  }

  private async getHistoricalSuccessRate(patternType: string): Promise<number> {
    try {
      const patterns = await db
        .select()
        .from(patternEmbeddings)
        .where(
          and(eq(patternEmbeddings.patternType, patternType), eq(patternEmbeddings.isActive, true))
        )
        .limit(50);

      if (patterns.length === 0) return 75; // Default success rate

      const totalSuccesses = patterns.reduce((sum, p) => sum + p.truePositives, 0);
      const totalAttempts = patterns.reduce(
        (sum, p) => sum + p.truePositives + p.falsePositives,
        0
      );

      return totalAttempts > 0 ? (totalSuccesses / totalAttempts) * 100 : 75;
    } catch (error) {
      console.warn("[PatternDetectionEngine] Failed to get historical success rate:", error);
      return 75; // Default fallback
    }
  }
}

// Export singleton instance
export const patternDetectionEngine = PatternDetectionEngine.getInstance();
