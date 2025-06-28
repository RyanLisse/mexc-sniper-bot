/**
 * Intelligence Orchestrator
 *
 * Coordinates AI services for enhanced pattern analysis
 */

import { z } from "zod";
import { embeddingsService } from "./embeddings-service";
import { researchService } from "./research-service";

// Enhanced pattern schema
export const EnhancedPatternSchema = z.object({
  id: z.string(),
  originalPattern: z.record(z.any()),
  aiEnhancements: z.object({
    embedding: z.any(),
    research: z.any(),
    description: z.string(),
    confidence: z.number(),
  }),
  timestamp: z.number(),
});

export type EnhancedPattern = z.infer<typeof EnhancedPatternSchema>;

/**
 * Intelligence Orchestrator
 */
export class IntelligenceOrchestrator {
  /**
   * Enhance pattern with AI
   */
  async enhancePatternWithAI(
    pattern: any,
    options: {
      includeResearch?: boolean;
      includeEmbedding?: boolean;
      researchFocus?: "technical" | "fundamental" | "news" | "comprehensive";
    } = {}
  ): Promise<EnhancedPattern> {
    const {
      includeResearch = true,
      includeEmbedding = true,
      researchFocus = "comprehensive",
    } = options;

    const tasks = [];

    if (includeEmbedding) {
      tasks.push(embeddingsService.generatePatternEmbedding(pattern));
    } else {
      tasks.push(Promise.resolve(null));
    }

    if (includeResearch) {
      const query = `${pattern?.symbol || "market"} ${researchFocus} analysis`;
      tasks.push(researchService.conductMarketResearch(query));
    } else {
      tasks.push(Promise.resolve(null));
    }

    tasks.push(
      embeddingsService.enhancePatternDescription(pattern?.description || "trading pattern")
    );

    const [embedding, research, enhancedDescriptionResult] = await Promise.all(tasks);
    const enhancedDescription =
      typeof enhancedDescriptionResult === "string"
        ? enhancedDescriptionResult
        : "AI-enhanced trading pattern";

    return {
      id: pattern?.id || `enhanced_${Date.now()}`,
      originalPattern: pattern,
      aiEnhancements: {
        embedding,
        research,
        description: enhancedDescription,
        confidence:
          embedding && research && typeof embedding === "object" && typeof research === "object"
            ? (embedding.confidence + research.confidence) / 2
            : embedding && typeof embedding === "object"
              ? embedding.confidence
              : research && typeof research === "object"
                ? research.confidence
                : 0.8,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Batch enhance multiple patterns
   */
  async enhanceMultiplePatterns(
    patterns: any[],
    options: {
      includeResearch?: boolean;
      includeEmbedding?: boolean;
      researchFocus?: "technical" | "fundamental" | "news" | "comprehensive";
      maxConcurrency?: number;
    } = {}
  ): Promise<EnhancedPattern[]> {
    const { maxConcurrency = 5 } = options;
    const results: EnhancedPattern[] = [];

    // Process patterns in batches to control concurrency
    for (let i = 0; i < patterns.length; i += maxConcurrency) {
      const batch = patterns.slice(i, i + maxConcurrency);
      const batchResults = await Promise.all(
        batch.map((pattern) => this.enhancePatternWithAI(pattern, options))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Get service health status
   */
  async getServiceHealth(): Promise<{
    embeddings: { status: "healthy" | "degraded" | "unhealthy"; latency: number };
    research: { status: "healthy" | "degraded" | "unhealthy"; latency: number };
    overall: "healthy" | "degraded" | "unhealthy";
  }> {
    // Mock health check - in real implementation this would ping services
    return {
      embeddings: { status: "healthy", latency: 50 },
      research: { status: "healthy", latency: 200 },
      overall: "healthy",
    };
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    // This would clear caches in all AI services
    // Implementation depends on the actual service structure
  }
}

// Export singleton instance
export const intelligenceOrchestrator = new IntelligenceOrchestrator();
