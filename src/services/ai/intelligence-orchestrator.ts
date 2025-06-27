/**
 * Intelligence Orchestrator
 *
 * Coordinates AI services for enhanced pattern analysis
 */

import { z } from 'zod';
import { embeddingsService } from './embeddings-service';
import { researchService } from './research-service';

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
  async enhancePatternWithAI(pattern: any): Promise<EnhancedPattern> {
    const [embedding, research, enhancedDescription] = await Promise.all([
      embeddingsService.generatePatternEmbedding(pattern),
      researchService.conductMarketResearch(pattern.symbol || 'market'),
      embeddingsService.enhancePatternDescription(pattern.description || 'trading pattern'),
    ]);

    return {
      id: pattern.id || `enhanced_${Date.now()}`,
      originalPattern: pattern,
      aiEnhancements: {
        embedding,
        research,
        description: enhancedDescription,
        confidence: (embedding.confidence + research.confidence) / 2,
      },
      timestamp: Date.now(),
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