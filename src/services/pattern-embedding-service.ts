import type { NewPatternEmbedding } from "@/src/db/schema";
import { vectorUtils } from "@/src/db/vector-utils";
import OpenAI from "openai";

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
  private openai: OpenAI;
  private embeddingModel = "text-embedding-ada-002";

  constructor(apiKey?: string) {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
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
   * Generate embedding for a pattern
   */
  async generateEmbedding(pattern: PatternData): Promise<number[]> {
    try {
      const text = this.patternToText(pattern);

      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error("[PatternEmbedding] Failed to generate embedding:", error);
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
      console.error("[PatternEmbedding] Failed to store pattern:", error);
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
      console.error("[PatternEmbedding] Failed to find similar patterns:", error);
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
        console.error(
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
      console.error("[PatternEmbedding] Failed to update pattern performance:", error);
      throw error;
    }
  }

  /**
   * Clean up old patterns and cache
   */
  async cleanup(
    options: {
      inactiveDays?: number;
      lowConfidenceThreshold?: number;
    } = {}
  ) {
    const { inactiveDays = 30, lowConfidenceThreshold = 50 } = options;

    try {
      // Clean up expired cache
      const cacheDeleted = await vectorUtils.cleanupExpiredCache();
      console.log(`[PatternEmbedding] Cleaned up ${cacheDeleted} expired cache entries`);

      // TODO: Implement pattern cleanup based on inactivity and low confidence
      // This would involve querying patterns that haven't been seen in X days
      // or have confidence below threshold and marking them as inactive

      return {
        cacheDeleted,
        patternsDeactivated: 0, // Placeholder
      };
    } catch (error) {
      console.error("[PatternEmbedding] Cleanup failed:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const patternEmbeddingService = new PatternEmbeddingService();
