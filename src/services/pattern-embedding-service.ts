import OpenAI from "openai";
import type { NewPatternEmbedding } from "../db/schema";
import { vectorUtils } from "../db/vector-utils";
import { createLogger } from "../lib/structured-logger";
import { getAiIntelligenceService } from "./ai-intelligence-service";

export interface PatternData {
  symbolName: string;
  vcoinId?: string;
  type: "ready_state" | "launch_pattern" | "price_action" | "volume_profile";
  data: {
    sts?: number;
    st?: number;
    tt?: number;
    priceChanges?: number[];
    volumeProfile?: number[];
    timeToLaunch?: number;
    marketConditions?: Record<string, any>;
  };
  confidence: number;
}

export class PatternEmbeddingService {
  private _logger?: ReturnType<typeof createLogger>;
  private get logger() {
    if (!this._logger) {
      this._logger = createLogger("pattern-embedding-service");
    }
    return this._logger;
  }

  private openai: OpenAI;
  private embeddingModel = "text-embedding-ada-002";
  private useCohere = true; // Default to Cohere Embed v4.0

  constructor(apiKey?: string) {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });

    // Check if Cohere is available, fallback to OpenAI if not
    this.useCohere = !!process.env.COHERE_API_KEY;

    if (this.useCohere) {
      this.logger.info("[PatternEmbedding] Using Cohere Embed v4.0 as primary embedding model");
    } else {
      this.logger.info("[PatternEmbedding] Falling back to OpenAI text-embedding-ada-002");
    }
  }

  /**
   * Convert pattern data to a descriptive text for embedding
   */
  private patternToText(pattern: PatternData): string {
    const parts: string[] = [
      `Symbol: ${pattern.symbolName}`,
      `Pattern Type: ${pattern.type}`,
      `Confidence: ${pattern.confidence}%`,
    ];

    if (pattern.type === "ready_state" && pattern.data.sts !== undefined) {
      parts.push(
        `Ready State Pattern: STS=${pattern.data.sts}, ST=${pattern.data.st}, TT=${pattern.data.tt}`
      );
    }

    if (pattern.type === "launch_pattern" && pattern.data.timeToLaunch) {
      parts.push(`Time to Launch: ${pattern.data.timeToLaunch} hours`);
    }

    if (pattern.type === "price_action" && pattern.data.priceChanges) {
      const avgChange =
        pattern.data.priceChanges.reduce((a, b) => a + b, 0) / pattern.data.priceChanges.length;
      parts.push(`Average Price Change: ${avgChange.toFixed(2)}%`);
      parts.push(
        `Price Volatility: ${this.calculateVolatility(pattern.data.priceChanges).toFixed(2)}%`
      );
    }

    if (pattern.type === "volume_profile" && pattern.data.volumeProfile) {
      const totalVolume = pattern.data.volumeProfile.reduce((a, b) => a + b, 0);
      parts.push(`Total Volume: ${totalVolume}`);
      parts.push(`Volume Distribution: ${this.getVolumeDistribution(pattern.data.volumeProfile)}`);
    }

    if (pattern.data.marketConditions) {
      parts.push(`Market Conditions: ${JSON.stringify(pattern.data.marketConditions)}`);
    }

    return parts.join(" | ");
  }

  /**
   * Calculate volatility from price changes
   */
  private calculateVolatility(priceChanges: number[]): number {
    if (priceChanges.length === 0) return 0;

    const mean = priceChanges.reduce((a, b) => a + b, 0) / priceChanges.length;
    const variance =
      priceChanges.reduce((sum, val) => sum + (val - mean) ** 2, 0) / priceChanges.length;

    return Math.sqrt(variance);
  }

  /**
   * Get volume distribution description
   */
  private getVolumeDistribution(volumeProfile: number[]): string {
    const total = volumeProfile.reduce((a, b) => a + b, 0);
    if (total === 0) return "No volume";

    const percentages = volumeProfile.map((v) => ((v / total) * 100).toFixed(1));
    return percentages.join("-");
  }

  /**
   * Generate embedding for a pattern using Cohere Embed v4.0 (preferred) or OpenAI (fallback)
   */
  async generateEmbedding(pattern: PatternData): Promise<number[]> {
    if (this.useCohere) {
      try {
        // Use Cohere Embed v4.0 via AI Intelligence Service
        const embedding = await getAiIntelligenceService().generatePatternEmbedding(pattern);
        return embedding;
      } catch (error) {
        logger.warn("[PatternEmbedding] Cohere embedding failed, falling back to OpenAI:", error);
        // Fall through to OpenAI fallback
      }
    }

    // OpenAI fallback
    try {
      const text = this.patternToText(pattern);

      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error(
        "[PatternEmbedding] Failed to generate embedding (both Cohere and OpenAI):",
        error
      );
      throw error;
    }
  }

  /**
   * Store a pattern with its embedding
   */
  async storePattern(pattern: PatternData): Promise<string> {
    try {
      const embedding = await this.generateEmbedding(pattern);
      const patternId = `embed-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const patternData: Omit<NewPatternEmbedding, "embedding"> & { embedding: number[] } = {
        patternId,
        patternType: pattern.type,
        symbolName: pattern.symbolName,
        vcoinId: pattern.vcoinId || null,
        patternData: JSON.stringify(pattern.data),
        embedding,
        embeddingDimension: embedding.length,
        embeddingModel: this.embeddingModel,
        confidence: pattern.confidence,
        discoveredAt: new Date(),
        lastSeenAt: new Date(),
      };

      await vectorUtils.storePatternEmbedding(patternData);

      return patternId;
    } catch (error) {
      logger.error("[PatternEmbedding] Failed to store pattern:", error);
      throw error;
    }
  }

  /**
   * Find similar patterns to a given pattern
   */
  async findSimilarPatterns(
    pattern: PatternData,
    options: {
      limit?: number;
      threshold?: number;
      sameTypeOnly?: boolean;
    } = {}
  ) {
    try {
      const embedding = await this.generateEmbedding(pattern);
      const { sameTypeOnly = true } = options;

      const results = await vectorUtils.findSimilarPatterns(embedding, {
        ...options,
        patternType: sameTypeOnly ? pattern.type : undefined,
      });

      // Enrich results with pattern data
      return results.map((result: any) => ({
        ...result,
        patternData: JSON.parse(result.patternData),
      }));
    } catch (error) {
      logger.error("[PatternEmbedding] Failed to find similar patterns:", error);
      throw error;
    }
  }

  /**
   * Batch process multiple patterns
   */
  async batchProcessPatterns(patterns: PatternData[]): Promise<string[]> {
    const patternIds: string[] = [];

    for (const pattern of patterns) {
      try {
        const patternId = await this.storePattern(pattern);
        patternIds.push(patternId);
      } catch (error) {
        logger.error(
          `[PatternEmbedding] Failed to process pattern for ${pattern.symbolName}:`,
          error
        );
      }
    }

    return patternIds;
  }

  /**
   * Update pattern performance based on trading results
   */
  async updatePatternPerformance(
    patternId: string,
    result: {
      success: boolean;
      profit?: number;
    }
  ) {
    try {
      const pattern = await vectorUtils.getPattern(patternId);
      if (!pattern) {
        throw new Error(`Pattern ${patternId} not found`);
      }

      const currentSuccesses = pattern.truePositives;
      const currentFailures = pattern.falsePositives;
      const totalOccurrences = currentSuccesses + currentFailures + 1;

      const newSuccessRate = result.success
        ? ((currentSuccesses + 1) / totalOccurrences) * 100
        : (currentSuccesses / totalOccurrences) * 100;

      await vectorUtils.updatePatternMetrics(patternId, {
        occurrences: 1,
        successRate: newSuccessRate,
        avgProfit: result.profit,
        truePositive: result.success,
        falsePositive: !result.success,
      });
    } catch (error) {
      logger.error("[PatternEmbedding] Failed to update pattern performance:", error);
      throw error;
    }
  }

  /**
   * Advanced Pattern Similarity Analysis with Enhanced Algorithms
   */
  async advancedSimilaritySearch(
    pattern: PatternData,
    options: {
      similarityThreshold?: number;
      maxResults?: number;
      timeWindow?: number; // Hours to look back
      includePerformanceMetrics?: boolean;
      weightBySuccess?: boolean;
    } = {}
  ) {
    try {
      const {
        similarityThreshold = 0.85,
        maxResults = 10,
        timeWindow = 168, // 7 days default
        includePerformanceMetrics = true,
        weightBySuccess = true,
      } = options;

      const embedding = await this.generateEmbedding(pattern);
      const cutoffTime = new Date(Date.now() - timeWindow * 60 * 60 * 1000);

      // Enhanced similarity search with performance weighting
      const results = await vectorUtils.findSimilarPatternsEnhanced(embedding, {
        limit: maxResults * 2, // Get more to filter by performance
        threshold: similarityThreshold,
        patternType: pattern.type,
        afterDate: cutoffTime,
      });

      // Sort by similarity and performance if requested
      let sortedResults = results;
      if (weightBySuccess && includePerformanceMetrics) {
        sortedResults = results
          .map((result: any) => ({
            ...result,
            patternData: JSON.parse(result.patternData),
            performanceScore: this.calculatePerformanceScore(result),
            compositeScore: this.calculateCompositeScore(result, similarityThreshold),
          }))
          .sort((a, b) => b.compositeScore - a.compositeScore)
          .slice(0, maxResults);
      }

      return sortedResults;
    } catch (error) {
      logger.error("[PatternEmbedding] Advanced similarity search failed:", error);
      throw error;
    }
  }

  /**
   * Pattern Confidence Scoring with Historical Performance
   */
  async calculatePatternConfidenceScore(
    pattern: PatternData,
    marketContext?: Record<string, any>
  ): Promise<{
    confidence: number;
    components: Record<string, number>;
    recommendations: string[];
  }> {
    try {
      // Base confidence from pattern data
      let confidence = pattern.confidence;
      const components: Record<string, number> = {
        basePattern: pattern.confidence,
        historicalSuccess: 0,
        marketContext: 0,
        dataQuality: 0,
        timelyness: 0,
      };

      // Historical success rate component
      const similarPatterns = await this.findSimilarPatterns(pattern, {
        threshold: 0.8,
        sameTypeOnly: true,
        limit: 20,
      });

      if (similarPatterns.length > 0) {
        const avgSuccessRate =
          similarPatterns.reduce((sum: number, p: any) => sum + (p.successRate || 0), 0) /
          similarPatterns.length;
        components.historicalSuccess = avgSuccessRate * 0.3; // 30% weight
        confidence += components.historicalSuccess;
      }

      // Market context component
      if (marketContext) {
        const contextScore = this.assessMarketContext(pattern, marketContext);
        components.marketContext = contextScore * 0.2; // 20% weight
        confidence += components.marketContext;
      }

      // Data quality component
      const dataQualityScore = this.assessDataQuality(pattern);
      components.dataQuality = dataQualityScore * 0.15; // 15% weight
      confidence += components.dataQuality;

      // Timeliness component
      const timelinessScore = this.assessTimeliness(pattern);
      components.timelyness = timelinessScore * 0.1; // 10% weight
      confidence += components.timelyness;

      // Cap at 95% to maintain realistic confidence levels
      confidence = Math.min(confidence, 95);

      const recommendations = this.generateConfidenceRecommendations(confidence, components);

      return {
        confidence: Math.round(confidence * 100) / 100,
        components,
        recommendations,
      };
    } catch (error) {
      logger.error("[PatternEmbedding] Confidence calculation failed:", error);
      return {
        confidence: pattern.confidence,
        components: { basePattern: pattern.confidence },
        recommendations: ["Unable to calculate enhanced confidence"],
      };
    }
  }

  /**
   * Real-time Pattern Trend Detection
   */
  async detectPatternTrends(
    patternType: string,
    timeWindows: number[] = [1, 6, 24, 168] // Hours
  ): Promise<{
    trends: Array<{
      timeWindow: number;
      patternCount: number;
      successRate: number;
      avgConfidence: number;
      trend: "increasing" | "decreasing" | "stable";
    }>;
    insights: string[];
    alerts: string[];
  }> {
    try {
      const trends = [];
      const insights: string[] = [];
      const alerts: string[] = [];

      for (const windowHours of timeWindows) {
        const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

        const patterns = await vectorUtils.getPatternsByTypeAndDate(patternType, windowStart);

        const patternCount = patterns.length;
        const successRate =
          patterns.length > 0
            ? patterns.reduce((sum: number, p: any) => sum + (p.successRate || 0), 0) /
              patterns.length
            : 0;
        const avgConfidence =
          patterns.length > 0
            ? patterns.reduce((sum: number, p: any) => sum + p.confidence, 0) / patterns.length
            : 0;

        // Determine trend by comparing with previous period
        const prevWindowStart = new Date(windowStart.getTime() - windowHours * 60 * 60 * 1000);
        const prevPatterns = await vectorUtils.getPatternsByTypeAndDate(
          patternType,
          prevWindowStart,
          windowStart
        );

        let trend: "increasing" | "decreasing" | "stable" = "stable";
        if (patterns.length > prevPatterns.length * 1.2) trend = "increasing";
        else if (patterns.length < prevPatterns.length * 0.8) trend = "decreasing";

        trends.push({
          timeWindow: windowHours,
          patternCount,
          successRate: Math.round(successRate * 100) / 100,
          avgConfidence: Math.round(avgConfidence * 100) / 100,
          trend,
        });

        // Generate insights
        if (windowHours === 24 && trend === "increasing" && successRate > 80) {
          insights.push(
            `Strong 24h trend for ${patternType} patterns with ${successRate.toFixed(1)}% success rate`
          );
        }
        if (successRate < 50) {
          alerts.push(
            `Low success rate (${successRate.toFixed(1)}%) for ${patternType} in ${windowHours}h window`
          );
        }
      }

      return { trends, insights, alerts };
    } catch (error) {
      logger.error("[PatternEmbedding] Trend detection failed:", error);
      return { trends: [], insights: ["Trend analysis unavailable"], alerts: [] };
    }
  }

  /**
   * Historical Pattern Performance Analysis
   */
  async analyzeHistoricalPerformance(
    patternType?: string,
    timeRange: { start: Date; end: Date } = {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end: new Date(),
    }
  ): Promise<{
    summary: {
      totalPatterns: number;
      successRate: number;
      avgProfit: number;
      bestPerformingPattern: any;
      worstPerformingPattern: any;
    };
    breakdown: Array<{
      patternType: string;
      count: number;
      successRate: number;
      avgProfit: number;
    }>;
    recommendations: string[];
  }> {
    try {
      // Get patterns in time range
      const patterns = await vectorUtils.getPatternsByDateRange(
        timeRange.start,
        timeRange.end,
        patternType
      );

      if (patterns.length === 0) {
        return {
          summary: {
            totalPatterns: 0,
            successRate: 0,
            avgProfit: 0,
            bestPerformingPattern: null,
            worstPerformingPattern: null,
          },
          breakdown: [],
          recommendations: ["No patterns found in specified time range"],
        };
      }

      // Calculate summary statistics
      const totalSuccesses = patterns.reduce((sum: number, p: any) => sum + p.truePositives, 0);
      const totalFailures = patterns.reduce((sum: number, p: any) => sum + p.falsePositives, 0);
      const successRate = (totalSuccesses / (totalSuccesses + totalFailures)) * 100;

      const avgProfit =
        patterns
          .filter((p: any) => p.avgProfit != null)
          .reduce((sum: number, p: any) => sum + p.avgProfit, 0) / patterns.length;

      const bestPattern = patterns.reduce((best: any, current: any) =>
        (current.successRate || 0) > (best.successRate || 0) ? current : best
      );

      const worstPattern = patterns.reduce((worst: any, current: any) =>
        (current.successRate || 0) < (worst.successRate || 0) ? current : worst
      );

      // Breakdown by pattern type
      const typeGroups = patterns.reduce((groups: any, pattern: any) => {
        const type = pattern.patternType;
        if (!groups[type]) {
          groups[type] = [];
        }
        groups[type].push(pattern);
        return groups;
      }, {});

      const breakdown = Object.entries(typeGroups).map(([type, patterns]: [string, any]) => {
        const patternArray = patterns as any[];
        const typeSuccesses = patternArray.reduce((sum, p) => sum + p.truePositives, 0);
        const typeFailures = patternArray.reduce((sum, p) => sum + p.falsePositives, 0);
        const typeSuccessRate = (typeSuccesses / (typeSuccesses + typeFailures)) * 100;
        const typeAvgProfit =
          patternArray.filter((p) => p.avgProfit != null).reduce((sum, p) => sum + p.avgProfit, 0) /
          patternArray.length;

        return {
          patternType: type,
          count: patternArray.length,
          successRate: Math.round(typeSuccessRate * 100) / 100,
          avgProfit: Math.round(typeAvgProfit * 100) / 100,
        };
      });

      // Generate recommendations
      const recommendations = this.generatePerformanceRecommendations(breakdown, successRate);

      return {
        summary: {
          totalPatterns: patterns.length,
          successRate: Math.round(successRate * 100) / 100,
          avgProfit: Math.round(avgProfit * 100) / 100,
          bestPerformingPattern: bestPattern,
          worstPerformingPattern: worstPattern,
        },
        breakdown,
        recommendations,
      };
    } catch (error) {
      logger.error("[PatternEmbedding] Historical performance analysis failed:", error);
      throw error;
    }
  }

  /**
   * Clean up old patterns and cache
   */
  async cleanup(options: { inactiveDays?: number; lowConfidenceThreshold?: number } = {}) {
    const { inactiveDays = 30, lowConfidenceThreshold = 50 } = options;

    try {
      // Clean up expired cache
      const cacheDeleted = await vectorUtils.cleanupExpiredCache();
      logger.info(`[PatternEmbedding] Cleaned up ${cacheDeleted} expired cache entries`);

      // Clean up old inactive patterns
      const cutoffDate = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);
      const patternsDeactivated = await vectorUtils.deactivateOldPatterns(
        cutoffDate,
        lowConfidenceThreshold
      );

      logger.info(`[PatternEmbedding] Deactivated ${patternsDeactivated} old patterns`);

      return {
        cacheDeleted,
        patternsDeactivated,
      };
    } catch (error) {
      logger.error("[PatternEmbedding] Cleanup failed:", error);
      throw error;
    }
  }

  // ============================================================================
  // Private Helper Methods for Enhanced Analytics
  // ============================================================================

  private calculatePerformanceScore(pattern: any): number {
    const successRate = pattern.successRate || 0;
    const occurrences = pattern.occurrences || 1;
    const avgProfit = pattern.avgProfit || 0;

    // Weight by success rate, volume, and profitability
    return (
      successRate * 0.6 +
      Math.min(occurrences / 10, 1) * 20 + // Max 20 points for volume
      Math.max(avgProfit, 0) * 0.2
    ); // Profit contribution
  }

  private calculateCompositeScore(pattern: any, _threshold: number): number {
    const similarityScore = pattern.cosineSimilarity || 0;
    const performanceScore = this.calculatePerformanceScore(pattern);

    // Combine similarity and performance with weights
    return similarityScore * 0.7 + performanceScore * 0.3;
  }

  private assessMarketContext(_pattern: PatternData, context: Record<string, any>): number {
    let score = 0;

    // Assess market volatility
    if (context.volatility && context.volatility < 0.3)
      score += 15; // Low volatility is good
    else if (context.volatility && context.volatility > 0.7) score -= 10; // High volatility is risky

    // Assess market trend
    if (context.trend === "bullish") score += 10;
    else if (context.trend === "bearish") score -= 5;

    // Assess trading volume
    if (context.volume && context.volume > context.avgVolume * 1.5) score += 10;

    return Math.max(Math.min(score, 20), -10); // Cap between -10 and 20
  }

  private assessDataQuality(pattern: PatternData): number {
    let score = 0;

    // Required fields check
    if (pattern.symbolName) score += 5;
    if (pattern.vcoinId) score += 5;
    if (pattern.data.sts !== undefined) score += 5;
    if (pattern.data.st !== undefined) score += 5;
    if (pattern.data.tt !== undefined) score += 5;

    // Data completeness for specific pattern types
    if (
      pattern.type === "ready_state" &&
      pattern.data.sts === 2 &&
      pattern.data.st === 2 &&
      pattern.data.tt === 4
    ) {
      score += 10; // Bonus for complete ready state pattern
    }

    return Math.min(score, 15); // Max 15 points
  }

  private assessTimeliness(pattern: PatternData): number {
    if (pattern.data.timeToLaunch !== undefined) {
      const hours = pattern.data.timeToLaunch;
      if (hours >= 3.5 && hours <= 12) return 10; // Optimal advance notice
      if (hours >= 1 && hours < 3.5) return 7; // Good advance notice
      if (hours >= 0.5 && hours < 1) return 5; // Minimal advance notice
      return 0; // Too late or too early
    }
    return 5; // Default score when time data not available
  }

  private generateConfidenceRecommendations(
    confidence: number,
    components: Record<string, number>
  ): string[] {
    const recommendations: string[] = [];

    if (confidence >= 85) {
      recommendations.push("High confidence pattern - suitable for automated trading");
    } else if (confidence >= 70) {
      recommendations.push("Medium confidence - consider manual review before trading");
    } else {
      recommendations.push("Low confidence - requires additional validation");
    }

    if (components.historicalSuccess < 10) {
      recommendations.push("Limited historical data - monitor performance closely");
    }

    if (components.dataQuality < 10) {
      recommendations.push("Incomplete pattern data - gather more information before acting");
    }

    if (components.timelyness < 5) {
      recommendations.push("Suboptimal timing - consider waiting for better opportunity");
    }

    return recommendations;
  }

  private generatePerformanceRecommendations(
    breakdown: any[],
    overallSuccessRate: number
  ): string[] {
    const recommendations: string[] = [];

    if (overallSuccessRate > 80) {
      recommendations.push("Excellent overall performance - continue current strategy");
    } else if (overallSuccessRate > 60) {
      recommendations.push("Good performance - minor optimizations may help");
    } else {
      recommendations.push("Poor performance - strategy review recommended");
    }

    // Find best and worst performing pattern types
    const bestType = breakdown.reduce((best, current) =>
      current.successRate > best.successRate ? current : best
    );
    const worstType = breakdown.reduce((worst, current) =>
      current.successRate < worst.successRate ? current : worst
    );

    if (bestType.successRate > 80) {
      recommendations.push(
        `Focus on ${bestType.patternType} patterns (${bestType.successRate}% success rate)`
      );
    }

    if (worstType.successRate < 50) {
      recommendations.push(
        `Avoid or improve ${worstType.patternType} patterns (${worstType.successRate}% success rate)`
      );
    }

    return recommendations;
  }
}

// Export singleton instance
export const patternEmbeddingService = new PatternEmbeddingService();
