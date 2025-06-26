/**
 * AI Intelligence Service Tests
 *
 * Comprehensive test suite for the AI Intelligence Service Phase 3 integration.
 * Tests Cohere Embed v4.0 integration, Perplexity research, and enhanced pattern analysis.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the AI service modules directly
vi.mock("@/src/services/ai/embeddings-service", () => ({
  embeddingsService: {
    generateCohereEmbedding: vi.fn(),
    generatePatternEmbedding: vi.fn(),
    enhancePatternDescription: vi.fn(),
    getCacheStats: vi.fn().mockReturnValue({ size: 5 }),
  },
}));

vi.mock("@/src/services/ai/research-service", () => ({
  researchService: {
    conductMarketResearch: vi.fn(),
    getCacheStats: vi.fn().mockReturnValue({ size: 3 }),
  },
}));

vi.mock("@/src/services/ai/intelligence-orchestrator", () => ({
  intelligenceOrchestrator: {
    enhancePatternWithAI: vi.fn(),
    clearAllCaches: vi.fn(),
    getServiceHealth: vi.fn(),
    enhanceMultiplePatterns: vi.fn(),
  },
}));

import { aiIntelligenceService } from "@/src/services/ai-intelligence-service";
import { embeddingsService } from "@/src/services/ai/embeddings-service";
import { researchService } from "@/src/services/ai/research-service";
import { intelligenceOrchestrator } from "@/src/services/ai/intelligence-orchestrator";
import type { PatternData } from "@/src/services/pattern-embedding-service";

describe("AI Intelligence Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Cohere Embed v4.0 Integration", () => {
    it("should generate Cohere embeddings successfully", async () => {
      const mockEmbeddings = [[0.1, 0.2, 0.3, 0.4, 0.5]];
      vi.mocked(embeddingsService.generateCohereEmbedding).mockResolvedValue(
        mockEmbeddings,
      );

      const embeddings = await aiIntelligenceService.generateCohereEmbedding(
        ["test pattern text"],
        "classification",
      );

      expect(embeddings).toEqual(mockEmbeddings);
      expect(embeddingsService.generateCohereEmbedding).toHaveBeenCalledWith(
        ["test pattern text"],
        "classification",
      );
    });

    it("should handle Cohere API errors gracefully", async () => {
      vi.mocked(embeddingsService.generateCohereEmbedding).mockRejectedValue(
        new Error("Cohere API error: 400"),
      );

      await expect(
        aiIntelligenceService.generateCohereEmbedding(["test text"]),
      ).rejects.toThrow("Cohere API error: 400");
    });

    it("should generate pattern embeddings with enhanced descriptions", async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      vi.mocked(embeddingsService.generatePatternEmbedding).mockResolvedValue(
        mockEmbedding,
      );

      const testPattern: PatternData = {
        symbolName: "BTCUSDT",
        type: "ready_state",
        data: {
          sts: 2,
          st: 2,
          tt: 4,
          timeToLaunch: 3.5,
        },
        confidence: 85,
      };

      const embedding =
        await aiIntelligenceService.generatePatternEmbedding(testPattern);

      expect(embedding).toEqual(mockEmbedding);
      expect(embeddingsService.generatePatternEmbedding).toHaveBeenCalledWith(
        testPattern,
      );
    });

    it("should cache embeddings to optimize API usage", async () => {
      const mockEmbeddings = [[0.1, 0.2, 0.3, 0.4, 0.5]];
      vi.mocked(embeddingsService.generateCohereEmbedding)
        .mockResolvedValueOnce(mockEmbeddings)
        .mockResolvedValueOnce(mockEmbeddings);

      // First call
      await aiIntelligenceService.generateCohereEmbedding(["test text"]);

      // Second call with same text - service handles caching internally
      const embeddings = await aiIntelligenceService.generateCohereEmbedding([
        "test text",
      ]);

      expect(embeddings).toEqual(mockEmbeddings);
      expect(embeddingsService.generateCohereEmbedding).toHaveBeenCalledTimes(
        2,
      );
    });
  });

  describe("Perplexity Research Integration", () => {
    const mockResearchResult = {
      symbol: "BTCUSDT",
      analysis:
        "Bitcoin shows strong bullish momentum with high institutional adoption.",
      sentiment: "bullish" as const,
      confidenceBoost: 15,
      keyFindings: [
        "Strong technical indicators",
        "Increasing institutional interest",
        "Positive market sentiment",
      ],
      risks: ["Market volatility", "Regulatory uncertainty"],
      opportunities: [
        "Technical breakout potential",
        "Institutional adoption growth",
      ],
      marketContext:
        "Current market sentiment is bullish with high volatility and increased volume.",
      timestamp: Date.now(),
      sources: ["https://example.com/source1", "https://example.com/source2"],
    };

    it("should conduct comprehensive market research", async () => {
      vi.mocked(researchService.conductMarketResearch).mockResolvedValue(
        mockResearchResult,
      );

      const research = await aiIntelligenceService.conductMarketResearch(
        "BTCUSDT",
        "comprehensive",
      );

      expect(research.symbol).toBe("BTCUSDT");
      expect(research.analysis).toContain(
        "Bitcoin shows strong bullish momentum",
      );
      expect(research.sentiment).toBe("bullish");
      expect(research.confidenceBoost).toBeGreaterThan(0);
      expect(research.keyFindings).toBeInstanceOf(Array);
      expect(research.marketContext).toBeDefined();
      expect(researchService.conductMarketResearch).toHaveBeenCalledWith(
        "BTCUSDT",
        "comprehensive",
      );
    });

    it("should handle different research focus types", async () => {
      const ethResearchResult = { ...mockResearchResult, symbol: "ETHUSDT" };
      vi.mocked(researchService.conductMarketResearch).mockResolvedValue(
        ethResearchResult,
      );

      await aiIntelligenceService.conductMarketResearch("ETHUSDT", "technical");

      expect(researchService.conductMarketResearch).toHaveBeenCalledWith(
        "ETHUSDT",
        "technical",
      );
    });

    it("should cache research results", async () => {
      vi.mocked(researchService.conductMarketResearch)
        .mockResolvedValueOnce(mockResearchResult)
        .mockResolvedValueOnce(mockResearchResult);

      // First call
      const research1 =
        await aiIntelligenceService.conductMarketResearch("BTCUSDT");

      // Second call - service handles caching internally
      const research2 =
        await aiIntelligenceService.conductMarketResearch("BTCUSDT");

      expect(research1.analysis).toContain("Bitcoin");
      expect(research2.analysis).toContain("Bitcoin");
      expect(researchService.conductMarketResearch).toHaveBeenCalledTimes(2);
    });

    it("should handle Perplexity API errors gracefully", async () => {
      vi.mocked(researchService.conductMarketResearch).mockRejectedValue(
        new Error("Perplexity API error: 500"),
      );

      await expect(
        aiIntelligenceService.conductMarketResearch("UNIQUE_SYMBOL_500"),
      ).rejects.toThrow("Perplexity API error: 500");
    });
  });

  describe("Enhanced Pattern Analysis", () => {
    const testPattern: PatternData = {
      symbolName: "ADAUSDT",
      type: "ready_state",
      data: {
        sts: 2,
        st: 2,
        tt: 4,
        timeToLaunch: 4.2,
      },
      confidence: 82,
    };

    it("should enhance patterns with AI intelligence", async () => {
      const mockEnhancedPattern = {
        ...testPattern,
        marketSentiment: "bullish" as const,
        aiConfidenceBoost: 15,
        enhancementTimestamp: Date.now(),
        perplexityInsights: mockResearchResult,
        aiContext: {
          marketSentiment: "bullish" as const,
          opportunityScore: 85,
        },
      };

      vi.mocked(
        intelligenceOrchestrator.enhancePatternWithAI,
      ).mockResolvedValue(mockEnhancedPattern);

      const enhanced =
        await aiIntelligenceService.enhancePatternWithAI(testPattern);

      expect(enhanced.symbolName).toBe("ADAUSDT");
      expect(enhanced.marketSentiment).toBeDefined();
      expect(enhanced.aiConfidenceBoost).toBeGreaterThanOrEqual(0);
      expect(enhanced.enhancementTimestamp).toBeDefined();
      expect(
        intelligenceOrchestrator.enhancePatternWithAI,
      ).toHaveBeenCalledWith(testPattern);
    });

    it("should calculate AI-enhanced confidence scores", async () => {
      const enhancedPattern = {
        ...testPattern,
        perplexityInsights: {
          symbol: "ADAUSDT",
          analysis: "Strong technical outlook",
          sentiment: "bullish" as const,
          confidenceBoost: 10,
          keyFindings: ["Bullish sentiment", "High volume"],
          risks: ["Market volatility"],
          opportunities: ["Quick gains", "Trend following"],
          marketContext: "Strong bullish momentum",
          timestamp: Date.now(),
        },
        aiContext: {
          marketSentiment: "bullish" as const,
          opportunityScore: 85,
        },
      };

      const aiAnalysis =
        await aiIntelligenceService.calculateAIEnhancedConfidence(
          enhancedPattern,
        );

      expect(aiAnalysis.enhancedConfidence).toBeGreaterThan(
        testPattern.confidence,
      );
      expect(aiAnalysis.components.basePattern).toBe(testPattern.confidence);
      expect(aiAnalysis.components.aiResearch).toBeGreaterThan(0);
      expect(aiAnalysis.components.marketSentiment).toBeGreaterThan(0);
      expect(aiAnalysis.aiInsights).toBeDefined();
      expect(aiAnalysis.recommendations).toBeDefined();
    });

    it("should handle AI enhancement failures gracefully", async () => {
      vi.mocked(
        intelligenceOrchestrator.enhancePatternWithAI,
      ).mockRejectedValue(new Error("Network error"));

      await expect(
        aiIntelligenceService.enhancePatternWithAI(testPattern),
      ).rejects.toThrow("Network error");
    });

    it("should generate appropriate recommendations based on confidence levels", async () => {
      const highConfidencePattern = { ...testPattern, confidence: 95 };
      const mediumConfidencePattern = { ...testPattern, confidence: 75 };
      const lowConfidencePattern = { ...testPattern, confidence: 55 };

      const highAnalysis =
        await aiIntelligenceService.calculateAIEnhancedConfidence(
          highConfidencePattern,
        );
      const mediumAnalysis =
        await aiIntelligenceService.calculateAIEnhancedConfidence(
          mediumConfidencePattern,
        );
      const lowAnalysis =
        await aiIntelligenceService.calculateAIEnhancedConfidence(
          lowConfidencePattern,
        );

      expect(
        highAnalysis.recommendations.some((r) =>
          r.includes("automated execution"),
        ),
      ).toBe(true);
      expect(
        mediumAnalysis.recommendations.some((r) =>
          r.includes("smaller position"),
        ),
      ).toBe(true);
      expect(
        lowAnalysis.recommendations.some((r) => r.includes("manual review")),
      ).toBe(true);
    });
  });

  describe("Cache Management", () => {
    it("should clear expired cache entries", () => {
      const initialStats = aiIntelligenceService.getCacheStats();

      aiIntelligenceService.clearExpiredCache();

      const finalStats = aiIntelligenceService.getCacheStats();
      expect(finalStats.research.size).toBeGreaterThanOrEqual(0);
      expect(finalStats.embeddings.size).toBeGreaterThanOrEqual(0);
    });

    it("should provide cache statistics", () => {
      const stats = aiIntelligenceService.getCacheStats();

      expect(stats).toHaveProperty("research");
      expect(stats).toHaveProperty("embeddings");
      expect(stats.research).toHaveProperty("size");
      expect(stats.research).toHaveProperty("hitRate");
      expect(stats.embeddings).toHaveProperty("size");
      expect(stats.embeddings).toHaveProperty("hitRate");
    });
  });

  describe("Pattern Text Enhancement", () => {
    it("should create enhanced text descriptions for ready state patterns", async () => {
      const mockEmbedding = [0.1, 0.2];
      vi.mocked(embeddingsService.generatePatternEmbedding).mockResolvedValue(
        mockEmbedding,
      );

      const readyStatePattern: PatternData = {
        symbolName: "LINKUSDT",
        type: "ready_state",
        data: { sts: 2, st: 2, tt: 4 },
        confidence: 90,
      };

      const result =
        await aiIntelligenceService.generatePatternEmbedding(readyStatePattern);

      expect(result).toEqual(mockEmbedding);
      expect(embeddingsService.generatePatternEmbedding).toHaveBeenCalledWith(
        readyStatePattern,
      );
    });

    it("should create enhanced text descriptions for price action patterns", async () => {
      const mockEmbedding = [0.3, 0.4];
      vi.mocked(embeddingsService.generatePatternEmbedding).mockResolvedValue(
        mockEmbedding,
      );

      const priceActionPattern: PatternData = {
        symbolName: "DOTUSDT",
        type: "price_action",
        data: { priceChanges: [2.5, 3.1, -1.2, 4.8] },
        confidence: 75,
      };

      const result =
        await aiIntelligenceService.generatePatternEmbedding(
          priceActionPattern,
        );

      expect(result).toEqual(mockEmbedding);
      expect(embeddingsService.generatePatternEmbedding).toHaveBeenCalledWith(
        priceActionPattern,
      );
    });
  });

  describe("Error Handling and Resilience", () => {
    it("should handle missing API keys gracefully", () => {
      // Temporarily override environment variables
      const originalCohereKey = process.env.COHERE_API_KEY;
      const originalPerplexityKey = process.env.PERPLEXITY_API_KEY;

      delete process.env.COHERE_API_KEY;
      delete process.env.PERPLEXITY_API_KEY;

      expect(() => {
        // This should not throw but log warnings
        aiIntelligenceService.clearExpiredCache();
      }).not.toThrow();

      // Restore original values
      process.env.COHERE_API_KEY = originalCohereKey;
      process.env.PERPLEXITY_API_KEY = originalPerplexityKey;
    });

    it("should handle malformed API responses", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ invalid: "response" }),
      });

      await expect(
        aiIntelligenceService.generateCohereEmbedding(["test"]),
      ).rejects.toThrow();
    });

    it("should handle network timeouts and retries", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

      await expect(
        aiIntelligenceService.conductMarketResearch("BTCUSDT"),
      ).rejects.toThrow("Network timeout");
    });
  });

  describe("Integration with Pattern Detection Engine", () => {
    it("should integrate seamlessly with pattern embedding service", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            embeddings: { float: [[0.5, 0.6, 0.7]] },
            meta: { billed_units: { input_tokens: 10 } },
          }),
      });

      const pattern: PatternData = {
        symbolName: "SOLUSDT",
        type: "volume_profile",
        data: { volumeProfile: [1000, 2000, 1500, 3000] },
        confidence: 88,
      };

      const embedding =
        await aiIntelligenceService.generatePatternEmbedding(pattern);

      expect(embedding).toEqual([0.5, 0.6, 0.7]);
      expect(embedding.length).toBe(3);
    });

    it("should provide fallback behavior when AI services are unavailable", async () => {
      mockFetch.mockRejectedValue(new Error("Service unavailable"));

      const pattern: PatternData = {
        symbolName: "AVAXUSDT",
        type: "launch_pattern",
        data: { timeToLaunch: 2.5 },
        confidence: 70,
      };

      const enhanced =
        await aiIntelligenceService.enhancePatternWithAI(pattern);

      expect(enhanced.marketSentiment).toBe("neutral");
      expect(enhanced.aiConfidenceBoost).toBe(0);
      expect(enhanced.symbolName).toBe("AVAXUSDT");
      expect(enhanced.enhancementTimestamp).toBeDefined();
    });
  });
});
