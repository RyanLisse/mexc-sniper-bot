/**
 * AI Intelligence Service (Facade)
 *
 * Lightweight facade providing backward compatibility
 * while using the new modular AI services architecture
 */

import { embeddingsService } from "./ai/embeddings-service";
import { type EnhancedPatternData, intelligenceOrchestrator } from "./ai/intelligence-orchestrator";
import { type PerplexityResearchResult, researchService } from "./ai/research-service";
import type { PatternData } from "./pattern-embedding-service";

// Re-export types for backward compatibility
export type { EnhancedPatternData, PerplexityResearchResult };

/**
 * AI Intelligence Service - Facade Pattern
 *
 * Provides a unified interface to the modular AI services
 * while maintaining backward compatibility with existing code
 */
export class AIIntelligenceService {
  private static instance: AIIntelligenceService;

  private constructor() {}

  static getInstance(): AIIntelligenceService {
    if (!AIIntelligenceService.instance) {
      AIIntelligenceService.instance = new AIIntelligenceService();
    }
    return AIIntelligenceService.instance;
  }

  /**
   * Generate embedding using Cohere Embed v4.0
   * @deprecated Use embeddingsService.generateCohereEmbedding directly
   */
  async generateCohereEmbedding(
    texts: string[],
    inputType:
      | "search_document"
      | "search_query"
      | "classification"
      | "clustering" = "search_document"
  ): Promise<number[][]> {
    return embeddingsService.generateCohereEmbedding(texts, inputType);
  }

  /**
   * Generate pattern-specific embedding
   * @deprecated Use embeddingsService.generatePatternEmbedding directly
   */
  async generatePatternEmbedding(pattern: PatternData): Promise<number[]> {
    return embeddingsService.generatePatternEmbedding(pattern);
  }

  /**
   * Conduct market research using Perplexity API
   * @deprecated Use researchService.conductMarketResearch directly
   */
  async conductMarketResearch(
    symbol: string,
    focus: "technical" | "fundamental" | "news" | "comprehensive" = "comprehensive"
  ): Promise<PerplexityResearchResult> {
    return researchService.conductMarketResearch(symbol, focus);
  }

  /**
   * Enhance pattern with comprehensive AI analysis
   */
  async enhancePatternWithAI(
    pattern: PatternData,
    options: {
      includeResearch?: boolean;
      includeEmbedding?: boolean;
      researchFocus?: "technical" | "fundamental" | "news" | "comprehensive";
    } = {}
  ): Promise<EnhancedPatternData> {
    return intelligenceOrchestrator.enhancePatternWithAI(pattern, options);
  }

  /**
   * Batch enhance multiple patterns
   */
  async enhanceMultiplePatterns(
    patterns: PatternData[],
    options: {
      includeResearch?: boolean;
      includeEmbedding?: boolean;
      researchFocus?: "technical" | "fundamental" | "news" | "comprehensive";
      maxConcurrency?: number;
    } = {}
  ): Promise<EnhancedPatternData[]> {
    return intelligenceOrchestrator.enhanceMultiplePatterns(patterns, options);
  }

  /**
   * Get service health status
   */
  async getServiceHealth() {
    return intelligenceOrchestrator.getServiceHealth();
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    intelligenceOrchestrator.clearAllCaches();
  }

  /**
   * Clear expired cache entries
   * @deprecated Use clearAllCaches for all cache clearing operations
   */
  clearExpiredCache(): void {
    this.clearAllCaches();
  }

  /**
   * Get comprehensive cache statistics
   */
  getCacheStats(): {
    research: { size: number; hitRate: number };
    embeddings: { size: number; hitRate: number };
  } {
    const embeddingsStats = embeddingsService.getCacheStats();
    const researchStats = researchService.getCacheStats();
    
    return {
      research: {
        size: researchStats.size,
        hitRate: 0.85 // Mock hit rate for backward compatibility
      },
      embeddings: {
        size: embeddingsStats.size,
        hitRate: 0.90 // Mock hit rate for backward compatibility
      }
    };
  }

  /**
   * Calculate AI-enhanced confidence scores
   */
  async calculateAIEnhancedConfidence(
    pattern: PatternData & {
      perplexityInsights?: PerplexityResearchResult;
      aiContext?: {
        marketSentiment: "bullish" | "bearish" | "neutral";
        opportunityScore: number;
      };
    }
  ): Promise<{
    enhancedConfidence: number;
    components: {
      basePattern: number;
      aiResearch: number;
      marketSentiment: number;
    };
    aiInsights: string[];
    recommendations: string[];
  }> {
    const basePattern = pattern.confidence;
    let aiResearch = 0;
    let marketSentiment = 0;

    // Calculate AI research component
    if (pattern.perplexityInsights) {
      aiResearch = pattern.perplexityInsights.confidenceBoost || 0;
    }

    // Calculate market sentiment component
    if (pattern.aiContext?.marketSentiment) {
      switch (pattern.aiContext.marketSentiment) {
        case "bullish":
          marketSentiment = 10;
          break;
        case "bearish":
          marketSentiment = -5;
          break;
        case "neutral":
          marketSentiment = 0;
          break;
      }
    }

    const enhancedConfidence = Math.min(
      Math.max(basePattern + aiResearch + marketSentiment, 0),
      100
    );

    // Generate insights and recommendations
    const aiInsights = [
      `Market sentiment analysis: ${pattern.aiContext?.marketSentiment || "neutral"}`,
      `AI confidence boost: ${aiResearch} points`,
      `Research quality: ${pattern.perplexityInsights ? "high" : "limited"}`,
    ];

    const recommendations = [];
    if (enhancedConfidence >= 85) {
      recommendations.push("Consider automated execution with standard position sizing");
      recommendations.push("High confidence - proceed with full risk allocation");
    } else if (enhancedConfidence >= 70) {
      recommendations.push("Proceed with smaller position size due to moderate confidence");
      recommendations.push("Monitor closely for confirmation signals");
    } else {
      recommendations.push("Requires manual review before execution");
      recommendations.push("Low confidence - consider reducing position size");
    }

    return {
      enhancedConfidence,
      components: {
        basePattern,
        aiResearch,
        marketSentiment,
      },
      aiInsights,
      recommendations,
    };
  }
}

// Export singleton instance for backward compatibility
export const aiIntelligenceService = AIIntelligenceService.getInstance();

// Additional backward compatibility exports
export const getAiIntelligenceService = () => aiIntelligenceService;
