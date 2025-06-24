/**
 * Confidence Calculator - Scoring and Validation Module
 *
 * Extracted from the monolithic pattern-detection-engine.ts (1503 lines).
 * Handles confidence scoring, validation, and enhancement with activity data.
 *
 * Architecture:
 * - Type-safe confidence scoring (0-100 range)
 * - Activity data enhancement
 * - AI integration capabilities
 * - Comprehensive validation framework
 */

import { toSafeError } from "../../lib/error-type-utils";
import type { ActivityData } from "../../schemas/mexc-schemas";
import { calculateActivityBoost, hasHighPriorityActivity } from "../../schemas/mexc-schemas";
import type { CalendarEntry, SymbolEntry } from "../../services/mexc-unified-exports";
import type { IConfidenceCalculator } from "./interfaces";

/**
 * Confidence Calculator Implementation
 *
 * Implements sophisticated confidence scoring extracted from the original engine.
 * Focuses on accuracy and performance.
 */
export class ConfidenceCalculator implements IConfidenceCalculator {
  private static instance: ConfidenceCalculator;
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[confidence-calculator]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[confidence-calculator]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[confidence-calculator]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[confidence-calculator]", message, context || ""),
  };

  static getInstance(): ConfidenceCalculator {
    if (!ConfidenceCalculator.instance) {
      ConfidenceCalculator.instance = new ConfidenceCalculator();
    }
    return ConfidenceCalculator.instance;
  }

  /**
   * Calculate Ready State Confidence
   *
   * Core confidence calculation for ready state patterns.
   * Includes activity enhancement and AI integration.
   */
  async calculateReadyStateConfidence(symbol: SymbolEntry): Promise<number> {
    if (!symbol) {
      console.warn("Null symbol provided to calculateReadyStateConfidence");
      return 0;
    }

    let confidence = 50; // Base confidence

    try {
      // Exact pattern match validation
      if (this.validateExactReadyState(symbol)) {
        confidence += 30;
      }

      // Data completeness scoring
      confidence += this.calculateDataCompletenessScore(symbol);

      // Activity Data Enhancement
      try {
        const activities = await this.getActivityDataForSymbol(symbol);
        if (activities && activities.length > 0) {
          confidence = this.enhanceConfidenceWithActivity(confidence, activities);
        }
      } catch (error) {
        const safeError = toSafeError(error);
        console.warn(
          "Activity enhancement failed",
          {
            symbol: symbol.cd || "unknown",
            error: safeError.message,
          },
          safeError
        );
        // Continue without activity enhancement
      }

      // AI Enhancement (future integration)
      try {
        const aiEnhancement = await this.getAIEnhancement(symbol, confidence);
        if (aiEnhancement > 0) {
          confidence += Math.min(aiEnhancement, 20); // Cap AI boost at 20 points
        }
      } catch (error) {
        // AI enhancement is optional - continue without it
      }

      // Historical success rate (minimal weight since ML provides better analysis)
      const historicalBoost = await this.getHistoricalSuccessBoost();
      confidence += historicalBoost * 0.1;

      // Ensure confidence is within valid range
      return Math.min(Math.max(confidence, 0), 100);
    } catch (error) {
      const safeError = toSafeError(error);
      console.error(
        "Error calculating ready state confidence",
        {
          symbol: symbol.cd || "unknown",
          error: safeError.message,
        },
        safeError
      );

      // Return base confidence on error
      return 50;
    }
  }

  /**
   * Calculate Advance Opportunity Confidence
   *
   * Confidence calculation for advance opportunities (3.5+ hour early warning).
   */
  async calculateAdvanceOpportunityConfidence(
    entry: CalendarEntry,
    advanceHours: number
  ): Promise<number> {
    if (!entry || typeof advanceHours !== "number") {
      return 0;
    }

    let confidence = 40; // Base confidence for advance opportunities

    try {
      // Advance notice quality (our competitive advantage)
      confidence += this.calculateAdvanceNoticeScore(advanceHours);

      // Project type assessment
      const projectScore = this.getProjectTypeScore(entry.projectName || entry.symbol);
      confidence += projectScore * 0.3;

      // Data completeness
      confidence += this.calculateCalendarDataCompletenessScore(entry);

      // Activity Data Enhancement for Calendar Entries
      try {
        const activities = await this.getActivityDataForSymbol(entry);
        if (activities && activities.length > 0) {
          const activityBoost = calculateActivityBoost(activities);
          confidence += activityBoost * 0.8; // Scale down boost for advance opportunities

          // Additional boost for upcoming launches with high-priority activities
          if (hasHighPriorityActivity(activities) && advanceHours <= 48) {
            confidence += 8; // Strong boost for near-term launches with high activity
          }
        }
      } catch (error) {
        // Continue without activity enhancement
      }

      // Market timing assessment
      const timing = this.assessLaunchTiming(
        typeof entry.firstOpenTime === "number"
          ? entry.firstOpenTime
          : new Date(entry.firstOpenTime).getTime()
      );

      if (!timing.isWeekend) confidence += 5;
      if (timing.marketSession === "peak") confidence += 5;

      // Ensure confidence is within valid range
      return Math.min(Math.max(confidence, 0), 100);
    } catch (error) {
      const safeError = toSafeError(error);
      console.error(
        "Error calculating advance opportunity confidence",
        {
          symbol: entry.symbol || "unknown",
          advanceHours,
          error: safeError.message,
        },
        safeError
      );

      return 40; // Return base confidence on error
    }
  }

  /**
   * Calculate Pre-Ready Score
   *
   * Score calculation for symbols approaching ready state.
   */
  async calculatePreReadyScore(symbol: SymbolEntry): Promise<{
    isPreReady: boolean;
    confidence: number;
    estimatedTimeToReady: number;
  }> {
    if (!symbol) {
      return { isPreReady: false, confidence: 0, estimatedTimeToReady: 0 };
    }

    let confidence = 0;
    let estimatedHours = 0;

    try {
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
    } catch (error) {
      const safeError = toSafeError(error);
      console.error(
        "Error calculating pre-ready score",
        {
          symbol: symbol.cd || "unknown",
          error: safeError.message,
        },
        safeError
      );

      return { isPreReady: false, confidence: 0, estimatedTimeToReady: 0 };
    }
  }

  /**
   * Validate Confidence Score
   *
   * Ensures confidence scores are within valid range (0-100).
   */
  validateConfidenceScore(score: number): boolean {
    if (typeof score !== "number") return false;
    if (isNaN(score) || !isFinite(score)) return false;
    return score >= 0 && score <= 100;
  }

  /**
   * Enhance Confidence with Activity Data
   *
   * Applies activity-based confidence enhancement.
   */
  enhanceConfidenceWithActivity(baseConfidence: number, activities: ActivityData[]): number {
    if (!this.validateConfidenceScore(baseConfidence) || !Array.isArray(activities)) {
      return baseConfidence;
    }

    if (activities.length === 0) {
      return baseConfidence;
    }

    try {
      let enhancedConfidence = baseConfidence;

      // Calculate activity boost
      const activityBoost = calculateActivityBoost(activities);
      enhancedConfidence += activityBoost; // Add 0-20 point boost based on activities

      // Additional boost for high-priority activities
      if (hasHighPriorityActivity(activities)) {
        enhancedConfidence += 5; // Extra boost for high-priority activities
      }

      // Ensure we don't exceed maximum confidence
      return Math.min(enhancedConfidence, 100);
    } catch (error) {
      const safeError = toSafeError(error);
      console.warn(
        "Activity enhancement calculation failed",
        {
          baseConfidence,
          activitiesCount: activities.length,
          error: safeError.message,
        },
        safeError
      );

      return baseConfidence;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private validateExactReadyState(symbol: SymbolEntry): boolean {
    return symbol.sts === 2 && symbol.st === 2 && symbol.tt === 4;
  }

  private calculateDataCompletenessScore(symbol: SymbolEntry): number {
    let score = 0;

    if (symbol.cd && symbol.cd.length > 0) score += 10;
    if (symbol.ca) score += 5;
    if (symbol.ps !== undefined) score += 5;
    if (symbol.qs !== undefined) score += 5;

    return score;
  }

  private calculateCalendarDataCompletenessScore(entry: CalendarEntry): number {
    let score = 0;

    if (entry.projectName) score += 5;
    if ((entry as any).tradingPairs && (entry as any).tradingPairs.length > 1) score += 5;
    if ((entry as any).sts !== undefined) score += 10;

    return score;
  }

  private calculateAdvanceNoticeScore(advanceHours: number): number {
    if (advanceHours >= 12) return 20;
    if (advanceHours >= 6) return 15;
    if (advanceHours >= 3.5) return 10;
    return 0;
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

  private async getActivityDataForSymbol(
    symbolOrEntry: SymbolEntry | CalendarEntry
  ): Promise<ActivityData[]> {
    try {
      // Real implementation: fetch activity data from database or cache
      const symbol =
        typeof symbolOrEntry === "string"
          ? symbolOrEntry
          : "symbol" in symbolOrEntry
            ? symbolOrEntry.symbol
            : symbolOrEntry.cd;

      if (!symbol) return [];

      // Import activity service dynamically to avoid circular dependencies
      const { activityService } = await import("../../services/modules/mexc-cache-layer");
      const activities = await activityService.getRecentActivity(symbol);

      return activities || [];
    } catch (error) {
      console.warn("Failed to fetch activity data", {
        symbol:
          typeof symbolOrEntry === "string"
            ? symbolOrEntry
            : "symbol" in symbolOrEntry
              ? symbolOrEntry.symbol
              : symbolOrEntry.cd,
        error: toSafeError(error).message,
      });
      return [];
    }
  }

  private async getAIEnhancement(symbol: SymbolEntry, currentConfidence: number): Promise<number> {
    try {
      // Real implementation: integrate with AI intelligence service
      const { aiIntelligenceService } = await import("../../services/ai-intelligence-service");

      const enhancement = await aiIntelligenceService.enhanceConfidence({
        symbol: symbol.symbol || symbol.cd,
        currentConfidence,
        symbolData: symbol,
        enhancementType: "confidence_boost",
      });

      // Cap enhancement between -10 and +15 points
      return Math.max(-10, Math.min(15, enhancement.confidenceAdjustment || 0));
    } catch (error) {
      console.warn("AI enhancement failed, using fallback", {
        symbol: symbol.symbol || symbol.cd,
        error: toSafeError(error).message,
      });

      // Fallback: small boost for symbols with good technical indicators
      if (symbol.ps && symbol.ps > 80) return 3;
      if (symbol.qs && symbol.qs > 70) return 2;
      return 0;
    }
  }

  private async getHistoricalSuccessBoost(): Promise<number> {
    try {
      // Real implementation: query historical success rates from database
      const { multiPhaseTradingService } = await import(
        "../../services/multi-phase-trading-service"
      );

      const historicalData = await multiPhaseTradingService.getHistoricalSuccessRates({
        timeframeDays: 30,
        minConfidence: 70,
      });

      if (historicalData.totalExecutions > 10) {
        // Use actual historical success rate
        return historicalData.successRate;
      }

      // Fallback for insufficient data
      return 75;
    } catch (error) {
      console.warn("Failed to fetch historical success data", {
        error: toSafeError(error).message,
      });

      // Conservative fallback when data unavailable
      return 70;
    }
  }
}
