/**
 * Optimized Pattern Monitoring Service
 *
 * High-performance pattern detection and filtering with:
 * - Efficient pattern caching and retrieval
 * - Advanced filtering algorithms
 * - Real-time pattern scoring
 * - Type-safe validation with Zod
 * - Optimized memory usage
 *
 * Focused module < 500 lines for pattern monitoring
 */

import { z } from "zod";
import { PatternDetectionCore, type PatternMatch } from "../core/pattern-detection";
import { toSafeError } from "../lib/error-type-utils";
import { createLogger } from "../lib/structured-logger";
import type { PatternType } from "./optimized-auto-sniping-core";

// ============================================================================
// Pattern Monitoring Schemas
// ============================================================================

export const PatternFilterCriteriaSchema = z.object({
  minConfidence: z.number().min(0).max(100).default(70),
  allowedPatternTypes: z
    .array(z.enum(["ready_state", "pre_ready", "launch_sequence", "risk_warning"]))
    .default(["ready_state"]),
  maxAge: z.number().positive().default(300000), // 5 minutes in ms
  requireCalendarConfirmation: z.boolean().default(true),
  maxRiskLevel: z.enum(["low", "medium", "high"]).default("medium"),
  symbolBlacklist: z.array(z.string()).default([]),
  symbolWhitelist: z.array(z.string()).optional(),
  advanceHoursRange: z
    .object({
      min: z.number().min(0).default(0),
      max: z.number().min(0).default(24),
    })
    .optional(),
});

export const PatternScoreSchema = z.object({
  baseConfidence: z.number().min(0).max(100),
  riskAdjustment: z.number().min(-50).max(50),
  volumeAdjustment: z.number().min(-30).max(30),
  calendarBonus: z.number().min(0).max(20),
  finalScore: z.number().min(0).max(150),
  reasoning: z.array(z.string()),
});

export const EnhancedPatternMatchSchema = z.object({
  // Original pattern data
  symbol: z.string(),
  patternType: z.enum(["ready_state", "pre_ready", "launch_sequence", "risk_warning"]),
  confidence: z.number().min(0).max(100),
  timestamp: z.string().datetime(),
  riskLevel: z.enum(["low", "medium", "high"]),

  // Enhanced data
  enhancedScore: z.number().min(0).max(150),
  scoreBreakdown: PatternScoreSchema,
  eligibleForTrading: z.boolean(),
  filterReasons: z.array(z.string()),
  priorityRank: z.number().int().min(1),

  // Metadata
  firstDetected: z.string().datetime(),
  lastUpdated: z.string().datetime(),
  detectionCount: z.number().int().min(1),

  // Optional fields
  advanceNoticeHours: z.number().optional(),
  volatility: z.number().optional(),
  volume24h: z.number().optional(),
  priceChange24h: z.number().optional(),
});

// ============================================================================
// Type Definitions
// ============================================================================

export type PatternFilterCriteria = z.infer<typeof PatternFilterCriteriaSchema>;
export type PatternScore = z.infer<typeof PatternScoreSchema>;
export type EnhancedPatternMatch = z.infer<typeof EnhancedPatternMatchSchema>;

// ============================================================================
// Optimized Pattern Monitoring Service
// ============================================================================

export class OptimizedPatternMonitor {
  private static instance: OptimizedPatternMonitor;
  private logger = createLogger("optimized-pattern-monitor");

  // Pattern detection engine
  private patternEngine: PatternDetectionCore;

  // Pattern cache with TTL
  private patternCache = new Map<
    string,
    {
      pattern: EnhancedPatternMatch;
      timestamp: number;
      ttl: number;
    }
  >();

  // Symbol tracking for deduplication
  private symbolLastSeen = new Map<string, number>();

  // Performance metrics
  private metrics = {
    totalPatternsProcessed: 0,
    eligiblePatternsFound: 0,
    cacheHitCount: 0,
    cacheMissCount: 0,
    averageProcessingTime: 0,
  };

  private constructor() {
    this.patternEngine = PatternDetectionCore.getInstance();

    // Clean up cache every 2 minutes
    setInterval(() => this.cleanupCache(), 120000);

    this.logger.info("Optimized Pattern Monitor initialized");
  }

  static getInstance(): OptimizedPatternMonitor {
    if (!OptimizedPatternMonitor.instance) {
      OptimizedPatternMonitor.instance = new OptimizedPatternMonitor();
    }
    return OptimizedPatternMonitor.instance;
  }

  /**
   * Get eligible patterns with advanced filtering and scoring
   */
  async getEligiblePatterns(
    criteria: Partial<PatternFilterCriteria> = {},
    limit = 10
  ): Promise<EnhancedPatternMatch[]> {
    const startTime = Date.now();

    try {
      // Validate and merge criteria
      const filterCriteria = PatternFilterCriteriaSchema.parse({
        ...this.getDefaultCriteria(),
        ...criteria,
      });

      this.logger.debug("Getting eligible patterns", {
        criteria: filterCriteria,
        limit,
      });

      // Get fresh patterns from detection engine
      const freshPatterns = await this.fetchFreshPatterns();

      // Enhance patterns with scoring and metadata
      const enhancedPatterns = await Promise.all(
        freshPatterns.map((pattern) => this.enhancePattern(pattern, filterCriteria))
      );

      // Filter patterns based on criteria
      const eligiblePatterns = enhancedPatterns
        .filter((pattern) => pattern.eligibleForTrading)
        .sort((a, b) => b.enhancedScore - a.enhancedScore)
        .slice(0, limit);

      // Update metrics
      const processingTime = Date.now() - startTime;
      this.updateMetrics(enhancedPatterns.length, eligiblePatterns.length, processingTime);

      this.logger.debug("Eligible patterns retrieved", {
        totalPatterns: enhancedPatterns.length,
        eligiblePatterns: eligiblePatterns.length,
        processingTime,
      });

      return eligiblePatterns;
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to get eligible patterns", {
        error: safeError.message,
        criteria,
      });
      return [];
    }
  }

  /**
   * Get cached pattern by symbol
   */
  getCachedPattern(symbol: string): EnhancedPatternMatch | null {
    const cached = this.patternCache.get(symbol);

    if (!cached) {
      this.metrics.cacheMissCount++;
      return null;
    }

    // Check if expired
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.patternCache.delete(symbol);
      this.metrics.cacheMissCount++;
      return null;
    }

    this.metrics.cacheHitCount++;
    return cached.pattern;
  }

  /**
   * Get recent patterns with caching
   */
  getRecentPatterns(count = 10): EnhancedPatternMatch[] {
    const recentPatterns: EnhancedPatternMatch[] = [];
    const now = Date.now();

    for (const [, cached] of this.patternCache) {
      // Only include non-expired patterns
      if (now - cached.timestamp <= cached.ttl) {
        recentPatterns.push(cached.pattern);
      }
    }

    return recentPatterns.sort((a, b) => b.enhancedScore - a.enhancedScore).slice(0, count);
  }

  /**
   * Check if symbol is ready for trading
   */
  async isSymbolEligible(
    symbol: string,
    criteria: Partial<PatternFilterCriteria> = {}
  ): Promise<{ eligible: boolean; reason?: string; pattern?: EnhancedPatternMatch }> {
    try {
      const patterns = await this.getEligiblePatterns(criteria, 1);
      const symbolPattern = patterns.find((p) => p.symbol === symbol);

      if (!symbolPattern) {
        return {
          eligible: false,
          reason: "No eligible pattern found for symbol",
        };
      }

      return {
        eligible: symbolPattern.eligibleForTrading,
        reason: symbolPattern.eligibleForTrading
          ? undefined
          : symbolPattern.filterReasons.join(", "),
        pattern: symbolPattern,
      };
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        eligible: false,
        reason: `Error checking eligibility: ${safeError.message}`,
      };
    }
  }

  /**
   * Get monitoring metrics
   */
  getMetrics() {
    const cacheSize = this.patternCache.size;
    const totalCacheRequests = this.metrics.cacheHitCount + this.metrics.cacheMissCount;
    const cacheHitRatio =
      totalCacheRequests > 0 ? (this.metrics.cacheHitCount / totalCacheRequests) * 100 : 0;

    return {
      ...this.metrics,
      cacheSize,
      cacheHitRatio: Math.round(cacheHitRatio * 100) / 100,
      eligibilityRate:
        this.metrics.totalPatternsProcessed > 0
          ? (this.metrics.eligiblePatternsFound / this.metrics.totalPatternsProcessed) * 100
          : 0,
    };
  }

  /**
   * Clear pattern cache
   */
  clearCache(): void {
    this.patternCache.clear();
    this.symbolLastSeen.clear();
    this.logger.info("Pattern cache cleared");
  }

  // Private helper methods

  private async fetchFreshPatterns(): Promise<PatternMatch[]> {
    try {
      // This would typically fetch from the pattern detection engine
      // For now, return empty array as example
      return [];
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to fetch fresh patterns", {
        error: safeError.message,
      });
      return [];
    }
  }

  private async enhancePattern(
    pattern: PatternMatch,
    criteria: PatternFilterCriteria
  ): Promise<EnhancedPatternMatch> {
    try {
      // Calculate enhanced score
      const scoreBreakdown = this.calculatePatternScore(pattern);

      // Check eligibility
      const eligibilityCheck = this.checkPatternEligibility(pattern, criteria);

      // Get or update tracking data
      const trackingData = this.getOrCreateTrackingData(pattern);

      const enhanced = EnhancedPatternMatchSchema.parse({
        // Original pattern data
        symbol: pattern.symbol,
        patternType: pattern.patternType as PatternType,
        confidence: pattern.confidence,
        timestamp: pattern.timestamp,
        riskLevel: pattern.riskLevel,

        // Enhanced data
        enhancedScore: scoreBreakdown.finalScore,
        scoreBreakdown,
        eligibleForTrading: eligibilityCheck.eligible,
        filterReasons: eligibilityCheck.reasons,
        priorityRank: this.calculatePriorityRank(scoreBreakdown.finalScore),

        // Tracking data
        firstDetected: trackingData.firstDetected,
        lastUpdated: new Date().toISOString(),
        detectionCount: trackingData.count,

        // Optional fields
        advanceNoticeHours: pattern.advanceNoticeHours,
        volatility: pattern.volatility,
      });

      // Cache the enhanced pattern
      this.cachePattern(enhanced);

      return enhanced;
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to enhance pattern", {
        symbol: pattern.symbol,
        error: safeError.message,
      });

      // Return minimal enhanced pattern on error
      return EnhancedPatternMatchSchema.parse({
        symbol: pattern.symbol,
        patternType: pattern.patternType as PatternType,
        confidence: pattern.confidence,
        timestamp: pattern.timestamp,
        riskLevel: pattern.riskLevel,
        enhancedScore: pattern.confidence,
        scoreBreakdown: {
          baseConfidence: pattern.confidence,
          riskAdjustment: 0,
          volumeAdjustment: 0,
          calendarBonus: 0,
          finalScore: pattern.confidence,
          reasoning: ["Error during enhancement"],
        },
        eligibleForTrading: false,
        filterReasons: ["Enhancement failed"],
        priorityRank: 999,
        firstDetected: pattern.timestamp,
        lastUpdated: new Date().toISOString(),
        detectionCount: 1,
      });
    }
  }

  private calculatePatternScore(pattern: PatternMatch): PatternScore {
    const reasoning: string[] = [];
    let finalScore = pattern.confidence;

    // Base confidence
    reasoning.push(`Base confidence: ${pattern.confidence}%`);

    // Risk adjustment
    let riskAdjustment = 0;
    switch (pattern.riskLevel) {
      case "low":
        riskAdjustment = 10;
        reasoning.push("Low risk bonus: +10");
        break;
      case "medium":
        riskAdjustment = 0;
        reasoning.push("Medium risk: no adjustment");
        break;
      case "high":
        riskAdjustment = -15;
        reasoning.push("High risk penalty: -15");
        break;
    }

    // Volume adjustment (if available)
    let volumeAdjustment = 0;
    if (pattern.volume24h) {
      if (pattern.volume24h > 1000000) {
        volumeAdjustment = 15;
        reasoning.push("High volume bonus: +15");
      } else if (pattern.volume24h > 100000) {
        volumeAdjustment = 5;
        reasoning.push("Medium volume bonus: +5");
      }
    }

    // Calendar confirmation bonus
    let calendarBonus = 0;
    if (pattern.calendarConfirmed) {
      calendarBonus = 10;
      reasoning.push("Calendar confirmation bonus: +10");
    }

    finalScore = pattern.confidence + riskAdjustment + volumeAdjustment + calendarBonus;
    finalScore = Math.max(0, Math.min(150, finalScore)); // Clamp to 0-150

    return PatternScoreSchema.parse({
      baseConfidence: pattern.confidence,
      riskAdjustment,
      volumeAdjustment,
      calendarBonus,
      finalScore,
      reasoning,
    });
  }

  private checkPatternEligibility(
    pattern: PatternMatch,
    criteria: PatternFilterCriteria
  ): { eligible: boolean; reasons: string[] } {
    const reasons: string[] = [];

    // Check confidence threshold
    if (pattern.confidence < criteria.minConfidence) {
      reasons.push(`Confidence ${pattern.confidence}% below threshold ${criteria.minConfidence}%`);
    }

    // Check pattern type
    if (!criteria.allowedPatternTypes.includes(pattern.patternType as PatternType)) {
      reasons.push(`Pattern type ${pattern.patternType} not allowed`);
    }

    // Check age
    const age = Date.now() - new Date(pattern.timestamp).getTime();
    if (age > criteria.maxAge) {
      reasons.push(
        `Pattern age ${Math.round(age / 1000)}s exceeds max ${Math.round(criteria.maxAge / 1000)}s`
      );
    }

    // Check blacklist
    if (criteria.symbolBlacklist.includes(pattern.symbol)) {
      reasons.push(`Symbol ${pattern.symbol} is blacklisted`);
    }

    // Check whitelist (if specified)
    if (criteria.symbolWhitelist && !criteria.symbolWhitelist.includes(pattern.symbol)) {
      reasons.push(`Symbol ${pattern.symbol} not in whitelist`);
    }

    // Check risk level
    const riskLevels = ["low", "medium", "high"];
    const patternRiskIndex = riskLevels.indexOf(pattern.riskLevel);
    const maxRiskIndex = riskLevels.indexOf(criteria.maxRiskLevel);
    if (patternRiskIndex > maxRiskIndex) {
      reasons.push(`Risk level ${pattern.riskLevel} exceeds maximum ${criteria.maxRiskLevel}`);
    }

    return {
      eligible: reasons.length === 0,
      reasons,
    };
  }

  private calculatePriorityRank(score: number): number {
    if (score >= 120) return 1;
    if (score >= 100) return 2;
    if (score >= 80) return 3;
    if (score >= 60) return 4;
    return 5;
  }

  private getOrCreateTrackingData(pattern: PatternMatch): {
    firstDetected: string;
    count: number;
  } {
    const now = Date.now();
    const lastSeen = this.symbolLastSeen.get(pattern.symbol) || now;
    const isNewPattern = now - lastSeen > 300000; // 5 minutes

    this.symbolLastSeen.set(pattern.symbol, now);

    // For simplicity, use current timestamp as first detected
    // In production, this would track actual first detection time
    return {
      firstDetected: isNewPattern ? pattern.timestamp : new Date(lastSeen).toISOString(),
      count: isNewPattern ? 1 : 2, // Simplified counting
    };
  }

  private cachePattern(pattern: EnhancedPatternMatch): void {
    this.patternCache.set(pattern.symbol, {
      pattern,
      timestamp: Date.now(),
      ttl: 300000, // 5 minutes
    });
  }

  private cleanupCache(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [symbol, cached] of this.patternCache) {
      if (now - cached.timestamp > cached.ttl) {
        this.patternCache.delete(symbol);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug("Cache cleanup completed", {
        itemsCleaned: cleanedCount,
        remainingItems: this.patternCache.size,
      });
    }
  }

  private updateMetrics(
    totalProcessed: number,
    eligibleFound: number,
    processingTime: number
  ): void {
    this.metrics.totalPatternsProcessed += totalProcessed;
    this.metrics.eligiblePatternsFound += eligibleFound;

    // Update moving average of processing time
    if (this.metrics.averageProcessingTime === 0) {
      this.metrics.averageProcessingTime = processingTime;
    } else {
      this.metrics.averageProcessingTime =
        this.metrics.averageProcessingTime * 0.8 + processingTime * 0.2;
    }
  }

  private getDefaultCriteria(): PatternFilterCriteria {
    return {
      minConfidence: 70,
      allowedPatternTypes: ["ready_state"],
      maxAge: 300000,
      requireCalendarConfirmation: true,
      maxRiskLevel: "medium",
      symbolBlacklist: [],
      symbolWhitelist: undefined,
      advanceHoursRange: undefined,
    };
  }
}

// Export factory function
export function createOptimizedPatternMonitor(): OptimizedPatternMonitor {
  return OptimizedPatternMonitor.getInstance();
}
