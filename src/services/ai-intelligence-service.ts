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
}

// Export singleton instance for backward compatibility
export const aiIntelligenceService = AIIntelligenceService.getInstance();

// Additional backward compatibility exports
export const getAiIntelligenceService = () => aiIntelligenceService;
