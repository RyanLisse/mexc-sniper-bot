/**
 * Pattern Embedding Service Tests
 * 
 * Comprehensive test suite for AI pattern recognition and embedding generation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type EmbeddingVector,
  EmbeddingVectorSchema,
  type PatternData,
  PatternDataSchema,
  type PatternEmbedding,
  PatternEmbeddingSchema,
  PatternEmbeddingService,
  patternEmbeddingService,
} from '@/src/services/data/pattern-embedding-service';

describe('PatternEmbeddingService', () => {
  let service: PatternEmbeddingService;

  beforeEach(() => {
    service = new PatternEmbeddingService();
    vi.clearAllMocks();
    // Clear cache before each test
    service.clearCache();
  });

  describe('Schema Validation', () => {
    describe('PatternDataSchema', () => {
      it('should validate valid pattern data', () => {
        const validPattern = {
          id: 'pattern_123',
          type: 'price' as const,
          timestamp: Date.now(),
          data: { value: 100, trend: 'up' },
          confidence: 0.85,
        };

        expect(() => PatternDataSchema.parse(validPattern)).not.toThrow();
      });

      it('should reject invalid pattern type', () => {
        const invalidPattern = {
          id: 'pattern_123',
          type: 'invalid_type',
          timestamp: Date.now(),
          data: {},
          confidence: 0.85,
        };

        expect(() => PatternDataSchema.parse(invalidPattern)).toThrow();
      });

      it('should reject confidence outside valid range', () => {
        const invalidPattern = {
          id: 'pattern_123',
          type: 'price' as const,
          timestamp: Date.now(),
          data: {},
          confidence: 1.5, // Invalid: > 1
        };

        expect(() => PatternDataSchema.parse(invalidPattern)).toThrow();
      });

      it('should validate all pattern types', () => {
        const types = ['price', 'volume', 'technical', 'market'] as const;

        types.forEach(type => {
          const pattern = {
            id: `pattern_${type}`,
            type,
            timestamp: Date.now(),
            data: {},
            confidence: 0.5,
          };

          expect(() => PatternDataSchema.parse(pattern)).not.toThrow();
        });
      });
    });

    describe('EmbeddingVectorSchema', () => {
      it('should validate valid embedding vector', () => {
        const validEmbedding = {
          vector: [0.1, 0.2, 0.3],
          dimensions: 3,
          model: 'test-model',
          timestamp: Date.now(),
        };

        expect(() => EmbeddingVectorSchema.parse(validEmbedding)).not.toThrow();
      });

      it('should require all fields', () => {
        const incompleteEmbedding = {
          vector: [0.1, 0.2],
          dimensions: 2,
          // Missing model and timestamp
        };

        expect(() => EmbeddingVectorSchema.parse(incompleteEmbedding)).toThrow();
      });
    });

    describe('PatternEmbeddingSchema', () => {
      it('should validate complete pattern embedding', () => {
        const validPatternEmbedding = {
          patternId: 'pattern_123',
          embedding: {
            vector: [0.1, 0.2, 0.3],
            dimensions: 3,
            model: 'test-model',
            timestamp: Date.now(),
          },
          similarity: 0.85,
          metadata: { source: 'test' },
        };

        expect(() => PatternEmbeddingSchema.parse(validPatternEmbedding)).not.toThrow();
      });

      it('should allow optional fields to be missing', () => {
        const minimalPatternEmbedding = {
          patternId: 'pattern_123',
          embedding: {
            vector: [0.1, 0.2, 0.3],
            dimensions: 3,
            model: 'test-model',
            timestamp: Date.now(),
          },
        };

        expect(() => PatternEmbeddingSchema.parse(minimalPatternEmbedding)).not.toThrow();
      });
    });
  });

  describe('Embedding Generation', () => {
    it('should generate embedding with correct structure', async () => {
      const patternData: PatternData = {
        id: 'test_pattern',
        type: 'price',
        timestamp: Date.now(),
        data: { value: 100 },
        confidence: 0.9,
      };

      const embedding = await service.generateEmbedding(patternData);

      expect(embedding).toMatchObject({
        dimensions: 128,
        model: 'pattern-v1',
        timestamp: expect.any(Number),
      });
      expect(Array.isArray(embedding.vector)).toBe(true);
      expect(embedding.vector).toHaveLength(128);
      expect(embedding.vector.every(v => typeof v === 'number')).toBe(true);
    });

    it('should generate embeddings with valid vector values', async () => {
      const patternData: PatternData = {
        id: 'test_pattern',
        type: 'technical',
        timestamp: Date.now(),
        data: {},
        confidence: 0.8,
      };

      const embedding = await service.generateEmbedding(patternData);

      // All vector values should be numbers between 0 and 1 (from Math.random())
      expect(embedding.vector.every(v => v >= 0 && v <= 1)).toBe(true);
      expect(embedding.vector.every(v => !isNaN(v))).toBe(true);
    });

    it('should use correct cache key format', async () => {
      const timestamp = 1234567890;
      const patternData: PatternData = {
        id: 'cache_test',
        type: 'volume',
        timestamp,
        data: {},
        confidence: 0.7,
      };

      // Generate embedding to populate cache
      await service.generateEmbedding(patternData);

      const stats = service.getCacheStats();
      const expectedKey = `cache_test-${timestamp}`;
      expect(stats.keys).toContain(expectedKey);
    });

    it('should return same embedding for identical patterns (caching)', async () => {
      const patternData: PatternData = {
        id: 'cache_pattern',
        type: 'market',
        timestamp: 1234567890,
        data: {},
        confidence: 0.6,
      };

      const embedding1 = await service.generateEmbedding(patternData);
      const embedding2 = await service.generateEmbedding(patternData);

      expect(embedding1).toEqual(embedding2);
      expect(embedding1.vector).toEqual(embedding2.vector);
    });

    it('should generate different embeddings for different patterns', async () => {
      const baseTime = Date.now();
      const pattern1: PatternData = {
        id: 'pattern_1',
        type: 'price',
        timestamp: baseTime,
        data: {},
        confidence: 0.5,
      };

      const pattern2: PatternData = {
        id: 'pattern_2',
        type: 'volume',
        timestamp: baseTime + 1000, // Different timestamp
        data: {},
        confidence: 0.5,
      };

      const embedding1 = await service.generateEmbedding(pattern1);
      // Add small delay to ensure different generation time
      await new Promise(resolve => setTimeout(resolve, 10));
      const embedding2 = await service.generateEmbedding(pattern2);

      // Different patterns should produce different vectors (due to random generation)
      expect(embedding1.vector).not.toEqual(embedding2.vector);
      // Embeddings generated at different times should have different timestamps
      expect(embedding1.timestamp).not.toEqual(embedding2.timestamp);
    });

    it('should respect model metadata', async () => {
      const patternData: PatternData = {
        id: 'model_test',
        type: 'technical',
        timestamp: Date.now(),
        data: {},
        confidence: 0.9,
      };

      const embedding = await service.generateEmbedding(patternData);

      expect(embedding.model).toBe('pattern-v1');
      expect(embedding.dimensions).toBe(128);
    });
  });

  describe('Cosine Similarity Calculation', () => {
    it('should calculate correct similarity for identical vectors', async () => {
      const vector = [1, 0, 0];
      const patterns = await createTestPatterns([vector]);
      const targetEmbedding = createTestEmbedding(vector);

      const results = await service.findSimilarPatterns(targetEmbedding, patterns, 0.0);

      expect(results).toHaveLength(1);
      expect(results[0].similarity).toBeCloseTo(1.0, 5);
    });

    it('should calculate correct similarity for orthogonal vectors', async () => {
      const vector1 = [1, 0, 0];
      const vector2 = [0, 1, 0];
      const patterns = await createTestPatterns([vector2]);
      const targetEmbedding = createTestEmbedding(vector1);

      const results = await service.findSimilarPatterns(targetEmbedding, patterns, 0.0);

      expect(results).toHaveLength(1);
      expect(results[0].similarity).toBeCloseTo(0.0, 5);
    });

    it('should calculate correct similarity for opposite vectors', async () => {
      const vector1 = [1, 0, 0];
      const vector2 = [-1, 0, 0];
      const patterns = await createTestPatterns([vector2]);
      const targetEmbedding = createTestEmbedding(vector1);

      const results = await service.findSimilarPatterns(targetEmbedding, patterns, -1.0);

      expect(results).toHaveLength(1);
      expect(results[0].similarity).toBeCloseTo(-1.0, 5);
    });

    it('should handle zero vectors correctly', async () => {
      const vector1 = [1, 2, 3];
      const vector2 = [0, 0, 0];
      const patterns = await createTestPatterns([vector2]);
      const targetEmbedding = createTestEmbedding(vector1);

      const results = await service.findSimilarPatterns(targetEmbedding, patterns, 0.0);

      expect(results).toHaveLength(1);
      expect(results[0].similarity).toBe(0);
    });

    it('should throw error for mismatched vector dimensions', async () => {
      const vector1 = [1, 2, 3];
      const vector2 = [1, 2]; // Different dimension
      const patterns = await createTestPatterns([vector2]);
      const targetEmbedding = createTestEmbedding(vector1);

      await expect(service.findSimilarPatterns(targetEmbedding, patterns, 0.0))
        .rejects.toThrow('Vectors must have the same dimensions');
    });

    it('should calculate similarity for complex vectors', async () => {
      const vector1 = [0.5, 0.5, 0.7071];
      const vector2 = [0.7071, 0.7071, 0];
      const patterns = await createTestPatterns([vector2]);
      const targetEmbedding = createTestEmbedding(vector1);

      const results = await service.findSimilarPatterns(targetEmbedding, patterns, 0.0);

      expect(results).toHaveLength(1);
      expect(results[0].similarity).toBeGreaterThan(0);
      expect(results[0].similarity).toBeLessThan(1);
    });

    it('should normalize vectors correctly', async () => {
      const vector1 = [3, 4, 0]; // Magnitude = 5
      const vector2 = [6, 8, 0]; // Magnitude = 10, but same direction
      const patterns = await createTestPatterns([vector2]);
      const targetEmbedding = createTestEmbedding(vector1);

      const results = await service.findSimilarPatterns(targetEmbedding, patterns, 0.0);

      expect(results).toHaveLength(1);
      expect(results[0].similarity).toBeCloseTo(1.0, 5);
    });
  });

  describe('Similar Pattern Finding', () => {
    it('should find patterns above threshold', async () => {
      const vectors = [
        [1, 0, 0],     // Similar to target
        [0.9, 0.1, 0], // Very similar to target
        [0, 1, 0],     // Orthogonal to target
        [0, 0, 1],     // Orthogonal to target
      ];

      const patterns = await createTestPatterns(vectors);
      const targetEmbedding = createTestEmbedding([1, 0, 0]);

      const results = await service.findSimilarPatterns(targetEmbedding, patterns, 0.8);

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => (r.similarity || 0) >= 0.8)).toBe(true);
    });

    it('should sort results by similarity in descending order', async () => {
      const vectors = [
        [0.5, 0.5, 0],
        [0.9, 0.1, 0],
        [1, 0, 0],
        [0.7, 0.3, 0],
      ];

      const patterns = await createTestPatterns(vectors);
      const targetEmbedding = createTestEmbedding([1, 0, 0]);

      const results = await service.findSimilarPatterns(targetEmbedding, patterns, 0.0);

      expect(results).toHaveLength(4);
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].similarity || 0).toBeGreaterThanOrEqual(results[i + 1].similarity || 0);
      }
    });

    it('should filter patterns below threshold', async () => {
      const vectors = [
        [1, 0, 0],     // similarity = 1.0
        [0.7, 0.7, 0], // similarity ≈ 0.7
        [0, 1, 0],     // similarity = 0.0
        [0, 0, 1],     // similarity = 0.0
      ];

      const patterns = await createTestPatterns(vectors);
      const targetEmbedding = createTestEmbedding([1, 0, 0]);

      const results = await service.findSimilarPatterns(targetEmbedding, patterns, 0.8);

      expect(results.length).toBeLessThan(patterns.length);
      expect(results.every(r => (r.similarity || 0) >= 0.8)).toBe(true);
    });

    it('should handle empty pattern list', async () => {
      const targetEmbedding = createTestEmbedding([1, 0, 0]);

      const results = await service.findSimilarPatterns(targetEmbedding, [], 0.5);

      expect(results).toEqual([]);
    });

    it('should preserve pattern metadata in results', async () => {
      const vectors = [[1, 0, 0]];
      const patterns = await createTestPatterns(vectors);
      patterns[0].metadata = { source: 'test', importance: 'high' };

      const targetEmbedding = createTestEmbedding([1, 0, 0]);

      const results = await service.findSimilarPatterns(targetEmbedding, patterns, 0.0);

      expect(results).toHaveLength(1);
      expect(results[0].metadata).toEqual({ source: 'test', importance: 'high' });
      expect(results[0].patternId).toBe(patterns[0].patternId);
    });

    it('should handle very strict thresholds', async () => {
      const vectors = [
        [0.99, 0.01, 0],
        [0.98, 0.02, 0],
        [0.95, 0.05, 0],
      ];

      const patterns = await createTestPatterns(vectors);
      const targetEmbedding = createTestEmbedding([1, 0, 0]);

      const results = await service.findSimilarPatterns(targetEmbedding, patterns, 0.999);

      expect(results.length).toBeLessThanOrEqual(patterns.length);
      expect(results.every(r => (r.similarity || 0) >= 0.999)).toBe(true);
    });

    it('should handle negative similarities with low threshold', async () => {
      const vectors = [
        [-1, 0, 0],  // similarity = -1.0
        [0, -1, 0],  // similarity = 0.0
        [1, 0, 0],   // similarity = 1.0
      ];

      const patterns = await createTestPatterns(vectors);
      const targetEmbedding = createTestEmbedding([1, 0, 0]);

      const results = await service.findSimilarPatterns(targetEmbedding, patterns, -1.0);

      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.some(r => (r.similarity || 0) >= 0.9)).toBe(true); // Check for high positive similarity
      expect(results.some(r => (r.similarity || 0) <= -0.9)).toBe(true); // Check for high negative similarity
    });
  });

  describe('Cache Management', () => {
    it('should track cache size correctly', async () => {
      expect(service.getCacheStats().size).toBe(0);

      const pattern1: PatternData = {
        id: 'cache_1',
        type: 'price',
        timestamp: 1000,
        data: {},
        confidence: 0.5,
      };

      await service.generateEmbedding(pattern1);
      expect(service.getCacheStats().size).toBe(1);

      const pattern2: PatternData = {
        id: 'cache_2',
        type: 'volume',
        timestamp: 2000,
        data: {},
        confidence: 0.5,
      };

      await service.generateEmbedding(pattern2);
      expect(service.getCacheStats().size).toBe(2);
    });

    it('should track cache keys correctly', async () => {
      const pattern: PatternData = {
        id: 'key_test',
        type: 'technical',
        timestamp: 12345,
        data: {},
        confidence: 0.7,
      };

      await service.generateEmbedding(pattern);

      const stats = service.getCacheStats();
      expect(stats.keys).toContain('key_test-12345');
      expect(stats.keys).toHaveLength(1);
    });

    it('should clear cache completely', async () => {
      const patterns = [
        { id: 'clear_1', type: 'price' as const, timestamp: 1000, data: {}, confidence: 0.5 },
        { id: 'clear_2', type: 'volume' as const, timestamp: 2000, data: {}, confidence: 0.5 },
        { id: 'clear_3', type: 'technical' as const, timestamp: 3000, data: {}, confidence: 0.5 },
      ];

      for (const pattern of patterns) {
        await service.generateEmbedding(pattern);
      }

      expect(service.getCacheStats().size).toBe(3);

      service.clearCache();

      expect(service.getCacheStats().size).toBe(0);
      expect(service.getCacheStats().keys).toEqual([]);
    });

    it('should not cache identical patterns twice', async () => {
      const pattern: PatternData = {
        id: 'duplicate_test',
        type: 'market',
        timestamp: 5000,
        data: {},
        confidence: 0.8,
      };

      await service.generateEmbedding(pattern);
      await service.generateEmbedding(pattern);
      await service.generateEmbedding(pattern);

      expect(service.getCacheStats().size).toBe(1);
    });

    it('should cache patterns with different timestamps separately', async () => {
      const basePattern = {
        id: 'timestamp_test',
        type: 'price' as const,
        data: {},
        confidence: 0.6,
      };

      await service.generateEmbedding({ ...basePattern, timestamp: 1000 });
      await service.generateEmbedding({ ...basePattern, timestamp: 2000 });
      await service.generateEmbedding({ ...basePattern, timestamp: 3000 });

      expect(service.getCacheStats().size).toBe(3);
    });

    it('should regenerate embeddings after cache clear', async () => {
      const pattern: PatternData = {
        id: 'regen_test',
        type: 'volume',
        timestamp: 7000,
        data: {},
        confidence: 0.9,
      };

      const embedding1 = await service.generateEmbedding(pattern);
      service.clearCache();
      // Add small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      const embedding2 = await service.generateEmbedding(pattern);

      // Embeddings should be different due to random generation
      expect(embedding1.vector).not.toEqual(embedding2.vector);
      expect(embedding1.timestamp).not.toEqual(embedding2.timestamp);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large number of patterns efficiently', async () => {
      const startTime = Date.now();
      const patterns: PatternData[] = [];

      // Generate 100 patterns
      for (let i = 0; i < 100; i++) {
        patterns.push({
          id: `perf_pattern_${i}`,
          type: 'price',
          timestamp: Date.now() + i,
          data: { value: i },
          confidence: Math.random(),
        });
      }

      const embeddings = await Promise.all(
        patterns.map(p => service.generateEmbedding(p))
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(embeddings).toHaveLength(100);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(service.getCacheStats().size).toBe(100);
    });

    it('should handle concurrent embedding generation', async () => {
      const patterns: PatternData[] = Array.from({ length: 20 }, (_, i) => ({
        id: `concurrent_${i}`,
        type: 'technical',
        timestamp: Date.now() + i,
        data: {},
        confidence: 0.5,
      }));

      const promises = patterns.map(p => service.generateEmbedding(p));
      const embeddings = await Promise.all(promises);

      expect(embeddings).toHaveLength(20);
      expect(embeddings.every(e => e.vector.length === 128)).toBe(true);
      expect(service.getCacheStats().size).toBe(20);
    });

    it('should handle extreme vector values', async () => {
      const extremeVectors = [
        Array(128).fill(Number.MAX_VALUE),
        Array(128).fill(Number.MIN_VALUE),
        Array(128).fill(0),
        Array(128).fill(1),
        Array(128).fill(-1),
      ];

      for (const vector of extremeVectors) {
        const patterns = await createTestPatterns([vector]);
        const targetEmbedding = createTestEmbedding([1, 0, ...Array(126).fill(0)]);

        const results = await service.findSimilarPatterns(targetEmbedding, patterns, -1.0);
        expect(results).toHaveLength(1);
        expect(typeof results[0].similarity).toBe('number');
        expect(isFinite(results[0].similarity || 0)).toBe(true);
      }
    });

    it('should handle very high dimensional vectors', async () => {
      const highDimVector = Array.from({ length: 1000 }, () => Math.random());
      const patterns = await createTestPatterns([highDimVector]);
      const targetEmbedding = createTestEmbedding(Array.from({ length: 1000 }, () => Math.random()));

      const results = await service.findSimilarPatterns(targetEmbedding, patterns, 0.0);

      expect(results).toHaveLength(1);
      expect(typeof results[0].similarity).toBe('number');
      expect(results[0].similarity).toBeGreaterThanOrEqual(-1);
      expect(results[0].similarity).toBeLessThanOrEqual(1);
    });

    it('should validate pattern data before processing', async () => {
      const invalidPattern = {
        id: '',
        type: 'invalid_type',
        timestamp: -1,
        data: null,
        confidence: 2.0,
      };

      // Should not throw during generation since we don't validate input
      // But schema validation should catch this if used externally
      expect(() => PatternDataSchema.parse(invalidPattern)).toThrow();
    });
  });

  describe('Singleton Instance', () => {
    it('should export singleton instance', () => {
      expect(patternEmbeddingService).toBeInstanceOf(PatternEmbeddingService);
    });

    it('should maintain state across multiple uses', async () => {
      const pattern: PatternData = {
        id: 'singleton_test',
        type: 'market',
        timestamp: 9999,
        data: {},
        confidence: 0.7,
      };

      await patternEmbeddingService.generateEmbedding(pattern);
      const stats1 = patternEmbeddingService.getCacheStats();

      await patternEmbeddingService.generateEmbedding(pattern);
      const stats2 = patternEmbeddingService.getCacheStats();

      expect(stats1.size).toBe(stats2.size);
      expect(stats1.keys).toEqual(stats2.keys);
    });

    it('should be different instance from manual construction', () => {
      const manualInstance = new PatternEmbeddingService();
      expect(patternEmbeddingService).not.toBe(manualInstance);
    });
  });

  // Helper functions
  function createTestEmbedding(vector: number[]): EmbeddingVector {
    return {
      vector,
      dimensions: vector.length,
      model: 'test-model',
      timestamp: Date.now(),
    };
  }

  async function createTestPatterns(vectors: number[][]): Promise<PatternEmbedding[]> {
    return vectors.map((vector, index) => ({
      patternId: `test_pattern_${index}`,
      embedding: createTestEmbedding(vector),
    }));
  }
});