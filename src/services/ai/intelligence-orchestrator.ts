/**
 * AI Intelligence Orchestrator
 *
 * Coordinates AI services for enhanced pattern analysis
 * Extracted from ai-intelligence-service.ts for modularity
 */

import { context, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import { TRADING_TELEMETRY_CONFIG } from "../../lib/opentelemetry-setup";
import type { PatternData } from "../pattern-embedding-service";
import { embeddingsService } from "./embeddings-service";
import { type PerplexityResearchResult, researchService } from "./research-service";

// ======================
// Enhanced Pattern Types
// ======================

export interface EnhancedPatternData extends PatternData {
  aiConfidenceBoost: number;
  marketSentiment: "bullish" | "bearish" | "neutral";
  researchInsights?: PerplexityResearchResult;
  embedding?: number[];
  enhancementTimestamp: number;
}

// ======================
// Intelligence Orchestrator
// ======================

export class IntelligenceOrchestrator {
  private static instance: IntelligenceOrchestrator;
  private tracer = trace.getTracer("intelligence-orchestrator");
  private _logger?: {
    info: (message: string, context?: any) => void;
    warn: (message: string, context?: any) => void;
    error: (message: string, context?: any, error?: Error) => void;
    debug: (message: string, context?: any) => void;
  };

  private constructor() {}

  static getInstance(): IntelligenceOrchestrator {
    if (!IntelligenceOrchestrator.instance) {
      IntelligenceOrchestrator.instance = new IntelligenceOrchestrator();
    }
    return IntelligenceOrchestrator.instance;
  }

  /**
   * Lazy logger initialization to prevent webpack bundling issues
   */
  private get logger() {
    if (!this._logger) {
      this._logger = {
        info: (message: string, context?: any) =>
          console.info("[intelligence-orchestrator]", message, context || ""),
        warn: (message: string, context?: any) =>
          console.warn("[intelligence-orchestrator]", message, context || ""),
        error: (message: string, context?: any, error?: Error) =>
          console.error("[intelligence-orchestrator]", message, context || "", error || ""),
        debug: (message: string, context?: any) =>
          console.debug("[intelligence-orchestrator]", message, context || ""),
      };
    }
    return this._logger;
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
    const {
      includeResearch = true,
      includeEmbedding = false,
      researchFocus = "comprehensive",
    } = options;

    return await this.tracer.startActiveSpan(
      "ai.enhance_pattern",
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          "pattern.symbol": pattern.symbolName,
          "pattern.confidence": pattern.confidence,
          "ai.include_research": includeResearch,
          "ai.include_embedding": includeEmbedding,
          "ai.research_focus": researchFocus,
        },
      },
      async (span) => {
        try {
          const enhancedPattern: EnhancedPatternData = {
            ...pattern,
            aiConfidenceBoost: 0,
            marketSentiment: "neutral",
            enhancementTimestamp: Date.now(),
          };

          // Parallel execution of AI services
          const promises: Promise<any>[] = [];

          // Research enhancement
          if (includeResearch) {
            promises.push(
              researchService
                .conductMarketResearch(pattern.symbolName, researchFocus)
                .then((research) => {
                  enhancedPattern.researchInsights = research;
                  enhancedPattern.aiConfidenceBoost = research.confidenceBoost;
                  enhancedPattern.marketSentiment = research.sentiment;
                  return research;
                })
                .catch((error) => {
                  this.logger.warn("Research enhancement failed", {
                    symbol: pattern.symbolName,
                    error: error instanceof Error ? error.message : String(error),
                  });
                  return null;
                })
            );
          }

          // Embedding enhancement
          if (includeEmbedding) {
            promises.push(
              embeddingsService
                .generatePatternEmbedding(pattern)
                .then((embedding) => {
                  enhancedPattern.embedding = embedding;
                  return embedding;
                })
                .catch((error) => {
                  this.logger.warn("Embedding enhancement failed", {
                    symbol: pattern.symbolName,
                    error: error instanceof Error ? error.message : String(error),
                  });
                  return null;
                })
            );
          }

          // Wait for all enhancements to complete
          await Promise.allSettled(promises);

          // Apply confidence adjustments based on AI insights
          const finalConfidence = this.calculateEnhancedConfidence(
            pattern.confidence,
            enhancedPattern
          );

          enhancedPattern.confidence = Math.min(Math.max(finalConfidence, 0), 100);

          span.setAttributes({
            "ai.final_confidence": enhancedPattern.confidence,
            "ai.confidence_boost": enhancedPattern.aiConfidenceBoost,
            "ai.sentiment": enhancedPattern.marketSentiment,
            "ai.research_included": !!enhancedPattern.researchInsights,
            "ai.embedding_included": !!enhancedPattern.embedding,
          });

          span.setStatus({ code: SpanStatusCode.OK });

          this.logger.info("Pattern enhanced with AI", {
            symbol: pattern.symbolName,
            originalConfidence: pattern.confidence,
            enhancedConfidence: enhancedPattern.confidence,
            confidenceBoost: enhancedPattern.aiConfidenceBoost,
            sentiment: enhancedPattern.marketSentiment,
            hasResearch: !!enhancedPattern.researchInsights,
            hasEmbedding: !!enhancedPattern.embedding,
          });

          return enhancedPattern;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: errorMessage,
          });
          span.recordException(error instanceof Error ? error : new Error(String(error)));

          this.logger.error("Failed to enhance pattern with AI", {
            symbol: pattern.symbolName,
            error: errorMessage,
          });

          // Return original pattern with minimal enhancement on error
          return {
            ...pattern,
            aiConfidenceBoost: 0,
            marketSentiment: "neutral",
            enhancementTimestamp: Date.now(),
          };
        } finally {
          span.end();
        }
      }
    );
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
    const { maxConcurrency = 3 } = options;

    this.logger.info("Batch enhancing patterns", {
      patternCount: patterns.length,
      maxConcurrency,
      options,
    });

    // Process patterns in batches to avoid overwhelming APIs
    const results: EnhancedPatternData[] = [];
    for (let i = 0; i < patterns.length; i += maxConcurrency) {
      const batch = patterns.slice(i, i + maxConcurrency);
      const batchPromises = batch.map((pattern) => this.enhancePatternWithAI(pattern, options));

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(
        ...batchResults.map((result, index) =>
          result.status === "fulfilled"
            ? result.value
            : {
                ...batch[index],
                aiConfidenceBoost: 0,
                marketSentiment: "neutral" as const,
                enhancementTimestamp: Date.now(),
              }
        )
      );
    }

    this.logger.info("Batch enhancement completed", {
      totalPatterns: patterns.length,
      successfulEnhancements: results.filter((p) => p.aiConfidenceBoost > 0).length,
    });

    return results;
  }

  /**
   * Calculate enhanced confidence score
   */
  private calculateEnhancedConfidence(
    originalConfidence: number,
    enhancedPattern: EnhancedPatternData
  ): number {
    let adjustedConfidence = originalConfidence;

    // Apply AI confidence boost
    adjustedConfidence += enhancedPattern.aiConfidenceBoost;

    // Apply sentiment adjustments
    if (enhancedPattern.marketSentiment === "bullish") {
      adjustedConfidence += 5; // Bullish sentiment adds confidence
    } else if (enhancedPattern.marketSentiment === "bearish") {
      adjustedConfidence -= 10; // Bearish sentiment reduces confidence more
    }

    // Apply research quality bonus
    if (enhancedPattern.researchInsights) {
      const researchQuality =
        enhancedPattern.researchInsights.keyFindings.length * 2 +
        enhancedPattern.researchInsights.opportunities.length * 3 -
        enhancedPattern.researchInsights.risks.length * 2;

      adjustedConfidence += Math.min(Math.max(researchQuality, -5), 10);
    }

    return adjustedConfidence;
  }

  /**
   * Get service health status
   */
  async getServiceHealth(): Promise<{
    embeddings: { available: boolean; cacheSize: number };
    research: { available: boolean; cacheSize: number };
    overall: "healthy" | "degraded" | "unavailable";
  }> {
    const embeddingsHealth = embeddingsService.getCacheStats();
    const researchHealth = researchService.getCacheStats();

    const embeddingsAvailable = !!process.env.COHERE_API_KEY;
    const researchAvailable = !!process.env.PERPLEXITY_API_KEY;

    let overall: "healthy" | "degraded" | "unavailable";
    if (embeddingsAvailable && researchAvailable) {
      overall = "healthy";
    } else if (embeddingsAvailable || researchAvailable) {
      overall = "degraded";
    } else {
      overall = "unavailable";
    }

    return {
      embeddings: {
        available: embeddingsAvailable,
        cacheSize: embeddingsHealth.size,
      },
      research: {
        available: researchAvailable,
        cacheSize: researchHealth.size,
      },
      overall,
    };
  }

  /**
   * Clear all AI service caches
   */
  clearAllCaches(): void {
    embeddingsService.clearCache();
    researchService.clearCache();
    this.logger.info("All AI service caches cleared");
  }
}

// Export singleton instance
export const intelligenceOrchestrator = IntelligenceOrchestrator.getInstance();
