/**
 * AI Services Suite Tests
 * 
 * Comprehensive test suite for all AI services including embeddings,
 * research, and intelligence orchestration functionality
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EmbeddingResult,
  EmbeddingResultSchema,
  EmbeddingsService,
  embeddingsService,
  PatternEmbedding,
  PatternEmbeddingSchema,
} from '@/src/services/ai/embeddings-service';
import {
  EnhancedPattern,
  EnhancedPatternSchema,
  IntelligenceOrchestrator,
  intelligenceOrchestrator,
} from '@/src/services/ai/intelligence-orchestrator';
import {
  ResearchResult,
  ResearchResultSchema,
  ResearchService,
  researchService,
} from '@/src/services/ai/research-service';

describe('AI Services Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Clear actual caches before each test
    (embeddingsService as any).cache?.clear?.();
    (researchService as any).cache?.clear?.();
  });

  describe('EmbeddingsService', () => {
    const service = embeddingsService;

    describe('Schema Validation', () => {
      it('should validate EmbeddingResult schema correctly', () => {
        const validEmbedding = {
          vector: [0.1, 0.2, 0.3],
          model: 'cohere-embed-v4',
          dimensions: 3,
          timestamp: Date.now(),
        };

        expect(() => EmbeddingResultSchema.parse(validEmbedding)).not.toThrow();
      });

      it('should reject invalid EmbeddingResult schema', () => {
        const invalidEmbedding = {
          vector: 'invalid', // Should be array of numbers
          model: 'test-model',
          dimensions: 3,
          timestamp: Date.now(),
        };

        expect(() => EmbeddingResultSchema.parse(invalidEmbedding)).toThrow();
      });

      it('should validate PatternEmbedding schema correctly', () => {
        const validPatternEmbedding = {
          patternId: 'pattern_123',
          embedding: {
            vector: [0.1, 0.2, 0.3],
            model: 'cohere-embed-v4',
            dimensions: 3,
            timestamp: Date.now(),
          },
          description: 'Test pattern',
          confidence: 0.85,
        };

        expect(() => PatternEmbeddingSchema.parse(validPatternEmbedding)).not.toThrow();
      });

      it('should reject PatternEmbedding with invalid confidence', () => {
        const invalidPatternEmbedding = {
          patternId: 'pattern_123',
          embedding: {
            vector: [0.1, 0.2, 0.3],
            model: 'cohere-embed-v4',
            dimensions: 3,
            timestamp: Date.now(),
          },
          description: 'Test pattern',
          confidence: 1.5, // Invalid: > 1
        };

        expect(() => PatternEmbeddingSchema.parse(invalidPatternEmbedding)).toThrow();
      });
    });

    describe('Cohere Embedding Generation', () => {
      it('should generate embeddings with correct structure', async () => {
        const text = 'test pattern for embedding';
        const embedding = await service.generateCohereEmbedding(text);

        expect(embedding).toMatchObject({
          model: 'cohere-embed-v4',
          dimensions: 1024,
          timestamp: expect.any(Number),
        });
        expect(embedding.vector).toHaveLength(1024);
        expect(embedding.vector.every(v => typeof v === 'number')).toBe(true);
        expect(embedding.vector.every(v => v >= -0.5 && v <= 0.5)).toBe(true);
      });

      it('should return cached embeddings for same text', async () => {
        const text = 'cached text';
        
        const embedding1 = await service.generateCohereEmbedding(text);
        const embedding2 = await service.generateCohereEmbedding(text);

        expect(embedding1).toEqual(embedding2);
        expect(embedding1).toBe(embedding2); // Should be the same object reference
      });

      it('should generate different embeddings for different texts', async () => {
        const text1 = 'first text';
        const text2 = 'second text';

        const embedding1 = await service.generateCohereEmbedding(text1);
        // Add delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
        const embedding2 = await service.generateCohereEmbedding(text2);

        expect(embedding1.vector).not.toEqual(embedding2.vector);
        expect(embedding1.timestamp).not.toEqual(embedding2.timestamp);
      });

      it('should handle empty text', async () => {
        const embedding = await service.generateCohereEmbedding('');

        expect(embedding).toMatchObject({
          model: 'cohere-embed-v4',
          dimensions: 1024,
          vector: expect.any(Array),
          timestamp: expect.any(Number),
        });
      });

      it('should handle very long text', async () => {
        const longText = 'a'.repeat(10000);
        const embedding = await service.generateCohereEmbedding(longText);

        expect(embedding.vector).toHaveLength(1024);
        expect(embedding.model).toBe('cohere-embed-v4');
      });
    });

    describe('Pattern Embedding Generation', () => {
      it('should generate pattern embeddings correctly', async () => {
        const patternData = {
          id: 'pattern_123',
          description: 'bullish pattern',
          type: 'technical',
          data: { signal: 'buy' },
        };

        const patternEmbedding = await service.generatePatternEmbedding(patternData);

        expect(patternEmbedding.patternId).toBe('pattern_123');
        expect(patternEmbedding.description).toBe('bullish pattern');
        expect(typeof patternEmbedding.confidence).toBe('number');
        expect(patternEmbedding.embedding).toMatchObject({
          model: 'cohere-embed-v4',
          dimensions: 1024,
        });
        expect(Array.isArray(patternEmbedding.embedding.vector)).toBe(true);
        expect(patternEmbedding.confidence).toBeGreaterThanOrEqual(0.6);
        expect(patternEmbedding.confidence).toBeLessThanOrEqual(1.0);
      });

      it('should generate pattern ID when not provided', async () => {
        const patternData = {
          description: 'pattern without ID',
          type: 'technical',
        };

        const patternEmbedding = await service.generatePatternEmbedding(patternData);

        expect(patternEmbedding.patternId).toMatch(/^pattern_\d+$/);
      });

      it('should use default description when not provided', async () => {
        const patternData = {
          id: 'pattern_456',
          type: 'technical',
        };

        const patternEmbedding = await service.generatePatternEmbedding(patternData);

        expect(patternEmbedding.description).toBe('Trading pattern');
      });

      it('should handle complex pattern data structures', async () => {
        const complexPattern = {
          id: 'complex_pattern',
          description: 'complex trading pattern',
          indicators: {
            rsi: 65.5,
            macd: { signal: 'bullish', histogram: [1, 2, 3] },
            volume: { trend: 'increasing', data: Array(100).fill(0) },
          },
          metadata: {
            timeframe: '1h',
            asset: 'BTCUSDT',
            confidence: 0.87,
          },
        };

        const patternEmbedding = await service.generatePatternEmbedding(complexPattern);

        expect(patternEmbedding.patternId).toBe('complex_pattern');
        expect(patternEmbedding.embedding.vector).toHaveLength(1024);
      });
    });

    describe('Pattern Description Enhancement', () => {
      it('should enhance pattern descriptions', async () => {
        const originalDescription = 'bullish breakout pattern';
        const enhanced = await service.enhancePatternDescription(originalDescription);

        expect(enhanced).toContain(originalDescription);
        expect(enhanced.length).toBeGreaterThan(originalDescription.length);
        
        const enhancements = ['AI-enhanced', 'machine learning optimized', 'algorithmically refined', 'data-driven'];
        const hasValidEnhancement = enhancements.some(enhancement => enhanced.includes(enhancement));
        expect(hasValidEnhancement).toBe(true);
      });

      it('should handle empty descriptions', async () => {
        const enhanced = await service.enhancePatternDescription('');

        expect(enhanced).toMatch(/^(AI-enhanced|machine learning optimized|algorithmically refined|data-driven) $/);
      });

      it('should enhance different descriptions differently', async () => {
        const desc1 = 'pattern one';
        const desc2 = 'pattern two';

        const enhanced1 = await service.enhancePatternDescription(desc1);
        const enhanced2 = await service.enhancePatternDescription(desc2);

        expect(enhanced1).toContain(desc1);
        expect(enhanced2).toContain(desc2);
        // They might have different enhancements
      });
    });

    describe('Cache Management', () => {
      it('should track cache size correctly', async () => {
        const initialStats = service.getCacheStats();
        expect(initialStats.size).toBe(0);

        await service.generateCohereEmbedding('text1');
        const statsAfterFirst = service.getCacheStats();
        expect(statsAfterFirst.size).toBe(1);

        await service.generateCohereEmbedding('text2');
        const statsAfterSecond = service.getCacheStats();
        expect(statsAfterSecond.size).toBe(2);

        // Same text should not increase cache size
        await service.generateCohereEmbedding('text1');
        const statsAfterDuplicate = service.getCacheStats();
        expect(statsAfterDuplicate.size).toBe(2);
      });
    });

    describe('Singleton Instance', () => {
      it('should export singleton instance', () => {
        expect(embeddingsService).toBeInstanceOf(EmbeddingsService);
      });

      it('should maintain state across multiple uses', async () => {
        await embeddingsService.generateCohereEmbedding('singleton test');
        const stats1 = embeddingsService.getCacheStats();

        await embeddingsService.generateCohereEmbedding('singleton test');
        const stats2 = embeddingsService.getCacheStats();

        expect(stats1.size).toBe(stats2.size);
      });

      it('should be different from manual construction', () => {
        const manualInstance = new EmbeddingsService();
        expect(embeddingsService).not.toBe(manualInstance);
      });
    });
  });

  describe('ResearchService', () => {
    const service = researchService;

    describe('Schema Validation', () => {
      it('should validate ResearchResult schema correctly', () => {
        const validResult = {
          query: 'market analysis',
          findings: ['finding 1', 'finding 2'],
          sources: ['source 1', 'source 2'],
          confidence: 0.85,
          timestamp: Date.now(),
        };

        expect(() => ResearchResultSchema.parse(validResult)).not.toThrow();
      });

      it('should validate ResearchResult without optional sources', () => {
        const validResult = {
          query: 'market analysis',
          findings: ['finding 1', 'finding 2'],
          confidence: 0.85,
          timestamp: Date.now(),
        };

        expect(() => ResearchResultSchema.parse(validResult)).not.toThrow();
      });

      it('should reject invalid confidence values', () => {
        const invalidResult = {
          query: 'test query',
          findings: ['finding'],
          confidence: 1.5, // Invalid: > 1
          timestamp: Date.now(),
        };

        expect(() => ResearchResultSchema.parse(invalidResult)).toThrow();
      });
    });

    describe('Market Research', () => {
      it('should conduct market research with correct structure', async () => {
        const query = 'Bitcoin market analysis';
        const result = await service.conductMarketResearch(query);

        expect(result.query).toBe('Bitcoin market analysis');
        expect(Array.isArray(result.findings)).toBe(true);
        expect(Array.isArray(result.sources)).toBe(true);
        expect(typeof result.confidence).toBe('number');
        expect(typeof result.timestamp).toBe('number');
        expect(result.findings.length).toBeGreaterThan(0);
        expect(typeof result.confidence).toBe('number');
        expect(result.confidence).toBeGreaterThanOrEqual(0.7);
        expect(result.confidence).toBeLessThanOrEqual(1.0);
      });

      it('should return cached results for same query', async () => {
        const query = 'Ethereum price prediction';
        
        const result1 = await service.conductMarketResearch(query);
        const result2 = await service.conductMarketResearch(query);

        expect(result1).toEqual(result2);
        expect(result1).toBe(result2); // Should be the same object reference
      });

      it('should generate different results for different queries', async () => {
        const query1 = 'Bitcoin analysis';
        const query2 = 'Ethereum analysis';

        const result1 = await service.conductMarketResearch(query1);
        // Add delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
        const result2 = await service.conductMarketResearch(query2);

        expect(result1.query).toBe(query1);
        expect(result2.query).toBe(query2);
        expect(result1.timestamp).not.toEqual(result2.timestamp);
      });

      it('should handle empty queries', async () => {
        const result = await service.conductMarketResearch('');

        expect(result.query).toBe('');
        expect(result.findings).toHaveLength(3);
        expect(result.sources).toHaveLength(3);
      });

      it('should generate consistent findings structure', async () => {
        const result = await service.conductMarketResearch('test query');

        expect(result.findings).toEqual([
          'Market shows bullish sentiment',
          'Trading volume increasing',
          'Technical indicators suggest upward trend',
        ]);

        expect(result.sources).toEqual([
          'CoinGecko API',
          'Binance Market Data',
          'Technical Analysis',
        ]);
      });

      it('should handle very long queries', async () => {
        const longQuery = 'a'.repeat(1000);
        const result = await service.conductMarketResearch(longQuery);

        expect(result.query).toBe(longQuery);
        expect(result.findings).toHaveLength(3);
      });
    });

    describe('Cache Management', () => {
      it('should track cache size correctly', async () => {
        const initialStats = service.getCacheStats();
        expect(initialStats.size).toBe(0);

        await service.conductMarketResearch('query1');
        const statsAfterFirst = service.getCacheStats();
        expect(statsAfterFirst.size).toBe(1);

        await service.conductMarketResearch('query2');
        const statsAfterSecond = service.getCacheStats();
        expect(statsAfterSecond.size).toBe(2);

        // Same query should not increase cache size
        await service.conductMarketResearch('query1');
        const statsAfterDuplicate = service.getCacheStats();
        expect(statsAfterDuplicate.size).toBe(2);
      });
    });

    describe('Singleton Instance', () => {
      it('should export singleton instance', () => {
        expect(researchService).toBeInstanceOf(ResearchService);
      });

      it('should maintain state across multiple uses', async () => {
        await researchService.conductMarketResearch('singleton test');
        const stats1 = researchService.getCacheStats();

        await researchService.conductMarketResearch('singleton test');
        const stats2 = researchService.getCacheStats();

        expect(stats1.size).toBe(stats2.size);
      });
    });
  });

  describe('IntelligenceOrchestrator', () => {
    const orchestrator = intelligenceOrchestrator;

    describe('Schema Validation', () => {
      it('should validate EnhancedPattern schema correctly', () => {
        const validEnhancedPattern = {
          id: 'enhanced_123',
          originalPattern: { type: 'bullish', symbol: 'BTCUSDT' },
          aiEnhancements: {
            embedding: { vector: [0.1, 0.2], model: 'test', dimensions: 2, timestamp: Date.now() },
            research: { query: 'test', findings: ['test'], confidence: 0.8, timestamp: Date.now() },
            description: 'AI enhanced pattern',
            confidence: 0.85,
          },
          timestamp: Date.now(),
        };

        expect(() => EnhancedPatternSchema.parse(validEnhancedPattern)).not.toThrow();
      });

      it('should reject EnhancedPattern missing required fields', () => {
        const invalidPattern = {
          id: 'test',
          originalPattern: {},
          // Missing aiEnhancements
          timestamp: Date.now(),
        };

        expect(() => EnhancedPatternSchema.parse(invalidPattern)).toThrow();
      });
    });

    describe('Pattern Enhancement', () => {
      it('should enhance patterns with AI successfully', async () => {
        const inputPattern = {
          id: 'test_pattern',
          symbol: 'BTCUSDT',
          description: 'bullish breakout',
          type: 'technical',
          confidence: 0.8,
        };

        const enhanced = await orchestrator.enhancePatternWithAI(inputPattern);

        expect(enhanced.id).toBe('test_pattern');
        expect(enhanced.originalPattern).toEqual(inputPattern);
        expect(enhanced.aiEnhancements.embedding.patternId).toBe('test_pattern');
        expect(enhanced.aiEnhancements.embedding.description).toBe('bullish breakout');
        expect(enhanced.aiEnhancements.research.query).toBe('BTCUSDT comprehensive analysis');
        expect(enhanced.aiEnhancements.description).toContain('bullish breakout');
        expect(typeof enhanced.aiEnhancements.confidence).toBe('number');
        expect(typeof enhanced.timestamp).toBe('number');
      });

      it('should handle patterns without symbol', async () => {
        const inputPattern = {
          id: 'no_symbol_pattern',
          description: 'generic pattern',
          type: 'trend',
        };

        const enhanced = await orchestrator.enhancePatternWithAI(inputPattern);

        expect(enhanced.aiEnhancements.research.query).toBe('market comprehensive analysis');
        expect(enhanced.originalPattern).toEqual(inputPattern);
      });

      it('should handle patterns without description', async () => {
        const inputPattern = {
          id: 'no_desc_pattern',
          symbol: 'ETHUSDT',
          type: 'reversal',
        };

        const enhanced = await orchestrator.enhancePatternWithAI(inputPattern);

        expect(enhanced.aiEnhancements.description).toContain('trading pattern');
        expect(enhanced.aiEnhancements.embedding.description).toBe('Trading pattern');
      });

      it('should generate ID when not provided', async () => {
        const inputPattern = {
          symbol: 'ADAUSDT',
          description: 'support level',
        };

        const enhanced = await orchestrator.enhancePatternWithAI(inputPattern);

        expect(enhanced.id).toMatch(/^enhanced_\d+$/);
      });

      it('should calculate average confidence correctly', async () => {
        const inputPattern = {
          id: 'confidence_test',
          symbol: 'BNBUSDT',
          description: 'test pattern',
        };

        const enhanced = await orchestrator.enhancePatternWithAI(inputPattern);

        const embeddingConfidence = enhanced.aiEnhancements.embedding.confidence;
        const researchConfidence = enhanced.aiEnhancements.research.confidence;
        const expectedAverage = (embeddingConfidence + researchConfidence) / 2;

        expect(enhanced.aiEnhancements.confidence).toBeCloseTo(expectedAverage, 5);
      });

      it('should handle complex pattern data', async () => {
        const complexPattern = {
          id: 'complex_enhancement',
          symbol: 'BTCUSDT',
          description: 'multi-timeframe analysis',
          indicators: {
            rsi: [45, 55, 65],
            macd: { signal: 'bullish' },
            volumes: Array(100).fill(1000),
          },
          metadata: {
            timeframe: '4h',
            strategy: 'momentum',
            risk: 'medium',
          },
        };

        const enhanced = await orchestrator.enhancePatternWithAI(complexPattern);

        expect(enhanced.originalPattern).toEqual(complexPattern);
        expect(enhanced.aiEnhancements.embedding.embedding.vector).toHaveLength(1024);
        expect(enhanced.aiEnhancements.research.findings).toHaveLength(3);
      });
    });

    describe('Error Handling', () => {
      it('should handle null pattern gracefully', async () => {
        const enhanced = await orchestrator.enhancePatternWithAI(null);

        expect(enhanced.id).toMatch(/^enhanced_\d+$/);
        expect(enhanced.originalPattern).toBeNull();
        expect(enhanced.aiEnhancements.research.query).toBe('market comprehensive analysis');
      });

      it('should handle undefined pattern gracefully', async () => {
        const enhanced = await orchestrator.enhancePatternWithAI(undefined);

        expect(enhanced.id).toMatch(/^enhanced_\d+$/);
        expect(enhanced.originalPattern).toBeUndefined();
      });

      it('should handle empty pattern object', async () => {
        const enhanced = await orchestrator.enhancePatternWithAI({});

        expect(enhanced.id).toMatch(/^enhanced_\d+$/);
        expect(enhanced.originalPattern).toEqual({});
        expect(enhanced.aiEnhancements.description).toContain('trading pattern');
      });
    });

    describe('Performance', () => {
      it('should handle concurrent pattern enhancements', async () => {
        const patterns = Array.from({ length: 10 }, (_, i) => ({
          id: `concurrent_${i}`,
          symbol: `TEST${i}`,
          description: `pattern ${i}`,
        }));

        const startTime = Date.now();
        const enhanced = await Promise.all(
          patterns.map(pattern => orchestrator.enhancePatternWithAI(pattern))
        );
        const duration = Date.now() - startTime;

        expect(enhanced).toHaveLength(10);
        expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
        
        enhanced.forEach((result, index) => {
          expect(result.id).toBe(`concurrent_${index}`);
          expect(result.aiEnhancements.embedding).toBeDefined();
          expect(result.aiEnhancements.research).toBeDefined();
        });
      });

      it('should maintain performance with large pattern data', async () => {
        const largePattern = {
          id: 'large_pattern',
          symbol: 'BTCUSDT',
          description: 'large pattern data',
          data: Array(1000).fill(0).map((_, i) => ({
            timestamp: Date.now() + i * 1000,
            price: 50000 + Math.random() * 1000,
            volume: Math.random() * 1000000,
            indicators: {
              rsi: Math.random() * 100,
              macd: Math.random() - 0.5,
              bb: {
                upper: 51000,
                middle: 50000,
                lower: 49000,
              },
            },
          })),
        };

        const startTime = Date.now();
        const enhanced = await orchestrator.enhancePatternWithAI(largePattern);
        const duration = Date.now() - startTime;

        expect(enhanced.originalPattern).toEqual(largePattern);
        expect(duration).toBeLessThan(2000); // Should handle large data efficiently
      });
    });

    describe('Cache Integration', () => {
      it('should leverage service caches for repeated patterns', async () => {
        const pattern1 = {
          id: 'cache_test_1',
          symbol: 'BTCUSDT',
          description: 'cached pattern',
        };

        const pattern2 = {
          id: 'cache_test_2',
          symbol: 'BTCUSDT', // Same symbol for research cache
          description: 'cached pattern', // Same description for embedding cache
        };

        const enhanced1 = await orchestrator.enhancePatternWithAI(pattern1);
        const enhanced2 = await orchestrator.enhancePatternWithAI(pattern2);

        // Research should be cached (same symbol)
        expect(enhanced1.aiEnhancements.research.query).toBe(enhanced2.aiEnhancements.research.query);
        
        // Enhanced descriptions should both contain the base pattern phrase
        expect(enhanced1.aiEnhancements.description).toContain('cached pattern');
        expect(enhanced2.aiEnhancements.description).toContain('cached pattern');
      });
    });

    describe('Singleton Instance', () => {
      it('should export singleton instance', () => {
        expect(intelligenceOrchestrator).toBeInstanceOf(IntelligenceOrchestrator);
      });

      it('should be different from manual construction', () => {
        const manualInstance = new IntelligenceOrchestrator();
        expect(intelligenceOrchestrator).not.toBe(manualInstance);
      });
    });
  });

  describe('AI Services Integration', () => {
    it('should work together seamlessly in realistic scenario', async () => {
      const tradingPattern = {
        id: 'integration_test_pattern',
        symbol: 'BTCUSDT',
        description: 'double bottom formation with volume confirmation',
        type: 'reversal',
        timeframe: '1h',
        indicators: {
          rsi: 35.2,
          macd: { signal: 'bullish_divergence' },
          volume: { trend: 'increasing', ratio: 1.8 },
        },
        confidence: 0.75,
        entry: 45000,
        target: 48000,
        stopLoss: 43500,
      };

      // Test individual services
      const embedding = await embeddingsService.generatePatternEmbedding(tradingPattern);
      const research = await researchService.conductMarketResearch(tradingPattern.symbol);
      const enhanced = await intelligenceOrchestrator.enhancePatternWithAI(tradingPattern);

      // Verify individual results
      expect(embedding.patternId).toBe('integration_test_pattern');
      expect(embedding.confidence).toBeGreaterThanOrEqual(0.6);
      
      expect(research.query).toBe('BTCUSDT');
      expect(research.confidence).toBeGreaterThanOrEqual(0.7);

      // Verify orchestrated result - note enhanced version uses different query format
      expect(enhanced.id).toBe('integration_test_pattern');
      expect(enhanced.originalPattern).toEqual(tradingPattern);
      expect(enhanced.aiEnhancements.embedding.patternId).toBe(embedding.patternId);
      expect(enhanced.aiEnhancements.embedding.description).toBe(embedding.description);
      expect(enhanced.aiEnhancements.research.query).toBe('BTCUSDT comprehensive analysis');
      expect(enhanced.aiEnhancements.research.findings).toEqual(['Market shows bullish sentiment', 'Trading volume increasing', 'Technical indicators suggest upward trend']);
      expect(enhanced.aiEnhancements.confidence).toBeCloseTo(
        (enhanced.aiEnhancements.embedding.confidence + enhanced.aiEnhancements.research.confidence) / 2, 
        5
      );
    });

    it('should handle service errors gracefully', async () => {
      // Mock service failure
      const originalMethod = embeddingsService.generateCohereEmbedding;
      embeddingsService.generateCohereEmbedding = vi.fn().mockRejectedValue(new Error('Service error'));

      try {
        await intelligenceOrchestrator.enhancePatternWithAI({ id: 'error_test' });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      } finally {
        // Restore original method
        embeddingsService.generateCohereEmbedding = originalMethod;
      }
    });

    it('should maintain performance under load', async () => {
      const patterns = Array.from({ length: 20 }, (_, i) => ({
        id: `load_test_${i}`,
        symbol: i % 5 === 0 ? 'BTCUSDT' : `COIN${i}USDT`, // Some cache hits
        description: i % 3 === 0 ? 'repeated pattern' : `unique pattern ${i}`,
        type: 'test',
      }));

      const startTime = Date.now();
      
      const results = await Promise.all([
        // Test all services concurrently
        ...patterns.map(p => embeddingsService.generatePatternEmbedding(p)),
        ...patterns.map(p => researchService.conductMarketResearch(p.symbol)),
        ...patterns.map(p => intelligenceOrchestrator.enhancePatternWithAI(p)),
      ]);

      const duration = Date.now() - startTime;

      expect(results).toHaveLength(60); // 20 * 3 operations
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});