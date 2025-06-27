/**
 * Pattern Embedding Service
 *
 * Handles AI pattern recognition and embedding generation for trading patterns
 */

import { z } from 'zod';

// Pattern data schema
export const PatternDataSchema = z.object({
  id: z.string(),
  type: z.enum(['price', 'volume', 'technical', 'market']),
  timestamp: z.number(),
  data: z.record(z.any()),
  confidence: z.number().min(0).max(1),
});

export type PatternData = z.infer<typeof PatternDataSchema>;

// Embedding vector schema
export const EmbeddingVectorSchema = z.object({
  vector: z.array(z.number()),
  dimensions: z.number(),
  model: z.string(),
  timestamp: z.number(),
});

export type EmbeddingVector = z.infer<typeof EmbeddingVectorSchema>;

// Pattern embedding result
export const PatternEmbeddingSchema = z.object({
  patternId: z.string(),
  embedding: EmbeddingVectorSchema,
  similarity: z.number().optional(),
  metadata: z.record(z.any()).optional(),
});

export type PatternEmbedding = z.infer<typeof PatternEmbeddingSchema>;

/**
 * Pattern Embedding Service
 */
export class PatternEmbeddingService {
  private embeddingCache = new Map<string, EmbeddingVector>();

  /**
   * Generate embedding for pattern data
   */
  async generateEmbedding(pattern: PatternData): Promise<EmbeddingVector> {
    const cacheKey = `${pattern.id}-${pattern.timestamp}`;
    
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey)!;
    }

    // Mock embedding generation (replace with actual AI service)
    const embedding: EmbeddingVector = {
      vector: Array.from({ length: 128 }, () => Math.random()),
      dimensions: 128,
      model: 'pattern-v1',
      timestamp: Date.now(),
    };

    this.embeddingCache.set(cacheKey, embedding);
    return embedding;
  }

  /**
   * Find similar patterns
   */
  async findSimilarPatterns(
    targetEmbedding: EmbeddingVector,
    candidates: PatternEmbedding[],
    threshold = 0.8
  ): Promise<PatternEmbedding[]> {
    const results: PatternEmbedding[] = [];

    for (const candidate of candidates) {
      const similarity = this.calculateCosineSimilarity(
        targetEmbedding.vector,
        candidate.embedding.vector
      );

      if (similarity >= threshold) {
        results.push({
          ...candidate,
          similarity,
        });
      }
    }

    return results.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
  }

  /**
   * Calculate cosine similarity between vectors
   */
  private calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same dimensions');
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      magnitudeA += vectorA[i] * vectorA[i];
      magnitudeB += vectorB[i] * vectorB[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.embeddingCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.embeddingCache.size,
      keys: Array.from(this.embeddingCache.keys()),
    };
  }
}

// Export singleton instance
export const patternEmbeddingService = new PatternEmbeddingService();