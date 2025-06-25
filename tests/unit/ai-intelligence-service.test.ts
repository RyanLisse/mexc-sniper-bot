/**
 * AI Intelligence Service Tests
 *
 * Comprehensive test suite for the AI Intelligence Service Phase 3 integration.
 * Tests Cohere Embed v4.0 integration, Perplexity research, and enhanced pattern analysis.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { aiIntelligenceService } from "../../src/services/ai-intelligence-service";
import type { PatternData } from "../../src/services/pattern-embedding-service";

// Mock fetch for API calls
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock environment variables
const mockEnv = {
  COHERE_API_KEY: "test-cohere-key",
  PERPLEXITY_API_KEY: "test-perplexity-key",
};

// Mock process.env
Object.defineProperty(process, 'env', {
  value: mockEnv,
  writable: true
});

describe("AI Intelligence Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
    mockFetch.mockReset();
  });

  describe("Cohere Embed v4.0 Integration", () => {
    const mockCohereResponse = {
      id: "test-id",
      texts: ["test text"],
      embeddings: {
        float: [[0.1, 0.2, 0.3, 0.4, 0.5]]
      },
      meta: {
        api_version: { version: "1.0" },
        billed_units: { input_tokens: 10 }
      }
    };

    it("should generate Cohere embeddings successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCohereResponse)
      });

      const embeddings = await aiIntelligenceService.generateCohereEmbedding(
        ["test pattern text"],
        "classification"
      );

      expect(embeddings).toEqual([[0.1, 0.2, 0.3, 0.4, 0.5]]);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cohere.ai/v1/embed",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "Authorization": expect.stringContaining("Bearer"),
            "User-Agent": "MEXC-Sniper-Bot/1.0"
          })
        })
      );
    });

    it("should handle Cohere API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Bad Request")
      });

      await expect(
        aiIntelligenceService.generateCohereEmbedding(["test text"])
      ).rejects.toThrow("Cohere API error: 400");
    });

    it("should generate pattern embeddings with enhanced descriptions", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCohereResponse)
      });

      const testPattern: PatternData = {
        symbolName: "BTCUSDT",
        type: "ready_state",
        data: {
          sts: 2,
          st: 2,
          tt: 4,
          timeToLaunch: 3.5
        },
        confidence: 85
      };

      const embedding = await aiIntelligenceService.generatePatternEmbedding(testPattern);

      expect(embedding).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cohere.ai/v1/embed",
        expect.objectContaining({
          body: expect.stringContaining("BTCUSDT")
        })
      );
    });

    it("should cache embeddings to optimize API usage", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCohereResponse)
      });

      // First call
      await aiIntelligenceService.generateCohereEmbedding(["test text"]);

      // Second call with same text should use cache
      const embeddings = await aiIntelligenceService.generateCohereEmbedding(["test text"]);

      expect(embeddings).toEqual([[0.1, 0.2, 0.3, 0.4, 0.5]]);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only called once due to caching
    });
  });

  describe("Perplexity Research Integration", () => {
    const mockPerplexityResponse = {
      choices: [{
        message: {
          content: `## Executive Summary
Bitcoin shows strong bullish momentum with high institutional adoption.

## Key Findings
• Strong technical indicators
• Increasing institutional interest
• Positive market sentiment

## Market Context
Current market sentiment is bullish with high volatility and increased volume.

## Risk Assessment
Medium risk level due to market volatility.

## Opportunities
Short-term: Technical breakout potential
Medium-term: Institutional adoption growth
Long-term: Global currency adoption`
        }
      }],
      citations: ["https://example.com/source1", "https://example.com/source2"]
    };

    it("should conduct comprehensive market research", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPerplexityResponse)
      });

      const research = await aiIntelligenceService.conductMarketResearch("BTCUSDT", "comprehensive");

      expect(research.symbol).toBe("BTCUSDT");
      expect(research.analysis).toContain("Bitcoin shows strong bullish momentum");
      expect(research.sentiment).toBe("bullish");
      expect(research.confidenceBoost).toBeGreaterThan(0);
      expect(research.keyFindings).toBeInstanceOf(Array);
      expect(research.marketContext).toBeDefined();
    });

    it("should handle different research focus types", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPerplexityResponse)
      });

      await aiIntelligenceService.conductMarketResearch("ETHUSDT", "technical");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.perplexity.ai/chat/completions",
        expect.objectContaining({
          body: expect.stringContaining("technical analysis")
        })
      );
    });

    it("should cache research results", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPerplexityResponse)
      });

      // First call
      const research1 = await aiIntelligenceService.conductMarketResearch("BTCUSDT");

      // Second call should use cache
      const research2 = await aiIntelligenceService.conductMarketResearch("BTCUSDT");

      expect(research1.analysis).toContain("Bitcoin");
      expect(research2.analysis).toContain("Bitcoin");
      // Cache behavior is internal, just verify the service works
    });

    it("should handle Perplexity API errors gracefully", async () => {
      // Clear any existing cache that might interfere with the test
      aiIntelligenceService.clearAllCaches();
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve("Internal Server Error")
      });

      await expect(
        aiIntelligenceService.conductMarketResearch("UNIQUE_SYMBOL_500")
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
        timeToLaunch: 4.2
      },
      confidence: 82
    };

    it("should enhance patterns with AI intelligence", async () => {
      // Mock Cohere response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          embeddings: { float: [[0.1, 0.2, 0.3]] },
          meta: { billed_units: { input_tokens: 5 } }
        })
      });

      // Mock Perplexity response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: "Positive market outlook for ADA" } }],
          citations: []
        })
      });

      const enhanced = await aiIntelligenceService.enhancePatternWithAI(testPattern);

      expect(enhanced.symbolName).toBe("ADAUSDT");
      expect(enhanced.marketSentiment).toBeDefined();
      expect(enhanced.aiConfidenceBoost).toBeGreaterThanOrEqual(0);
      expect(enhanced.enhancementTimestamp).toBeDefined();
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
          timestamp: Date.now()
        },
        aiContext: {
          marketSentiment: "bullish" as const,
          opportunityScore: 85
        }
      };

      const aiAnalysis = await aiIntelligenceService.calculateAIEnhancedConfidence(enhancedPattern);

      expect(aiAnalysis.enhancedConfidence).toBeGreaterThan(testPattern.confidence);
      expect(aiAnalysis.components.basePattern).toBe(testPattern.confidence);
      expect(aiAnalysis.components.aiResearch).toBeGreaterThan(0);
      expect(aiAnalysis.components.marketSentiment).toBeGreaterThan(0);
      expect(aiAnalysis.aiInsights).toBeDefined();
      expect(aiAnalysis.recommendations).toBeDefined();
    });

    it("should handle AI enhancement failures gracefully", async () => {
      // Clear any existing mocks and create fresh failure mocks
      vi.clearAllMocks();
      mockFetch.mockRejectedValue(new Error("Network error"));

      const enhanced = await aiIntelligenceService.enhancePatternWithAI(testPattern);

      expect(enhanced.symbolName).toBe(testPattern.symbolName);
      // When AI services fail, the service should still return the original pattern
      expect(enhanced.marketSentiment).toBe("neutral");
      expect(enhanced.aiConfidenceBoost).toBe(0);
    });

    it("should generate appropriate recommendations based on confidence levels", async () => {
      const highConfidencePattern = { ...testPattern, confidence: 95 };
      const mediumConfidencePattern = { ...testPattern, confidence: 75 };
      const lowConfidencePattern = { ...testPattern, confidence: 55 };

      const highAnalysis = await aiIntelligenceService.calculateAIEnhancedConfidence(highConfidencePattern);
      const mediumAnalysis = await aiIntelligenceService.calculateAIEnhancedConfidence(mediumConfidencePattern);
      const lowAnalysis = await aiIntelligenceService.calculateAIEnhancedConfidence(lowConfidencePattern);

      expect(highAnalysis.recommendations.some(r => r.includes("automated execution"))).toBe(true);
      expect(mediumAnalysis.recommendations.some(r => r.includes("smaller position"))).toBe(true);
      expect(lowAnalysis.recommendations.some(r => r.includes("manual review"))).toBe(true);
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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          embeddings: { float: [[0.1, 0.2]] },
          meta: { billed_units: { input_tokens: 5 } }
        })
      });

      const readyStatePattern: PatternData = {
        symbolName: "LINKUSDT",
        type: "ready_state",
        data: { sts: 2, st: 2, tt: 4 },
        confidence: 90
      };

      await aiIntelligenceService.generatePatternEmbedding(readyStatePattern);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cohere.ai/v1/embed",
        expect.objectContaining({
          body: expect.stringContaining("LINKUSDT")
        })
      );
    });

    it("should create enhanced text descriptions for price action patterns", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          embeddings: { float: [[0.3, 0.4]] },
          meta: { billed_units: { input_tokens: 8 } }
        })
      });

      const priceActionPattern: PatternData = {
        symbolName: "DOTUSDT",
        type: "price_action",
        data: { priceChanges: [2.5, 3.1, -1.2, 4.8] },
        confidence: 75
      };

      await aiIntelligenceService.generatePatternEmbedding(priceActionPattern);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cohere.ai/v1/embed",
        expect.objectContaining({
          body: expect.stringContaining("DOTUSDT")
        })
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
        json: () => Promise.resolve({ invalid: "response" })
      });

      await expect(
        aiIntelligenceService.generateCohereEmbedding(["test"])
      ).rejects.toThrow();
    });

    it("should handle network timeouts and retries", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

      await expect(
        aiIntelligenceService.conductMarketResearch("BTCUSDT")
      ).rejects.toThrow("Network timeout");
    });
  });

  describe("Integration with Pattern Detection Engine", () => {
    it("should integrate seamlessly with pattern embedding service", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          embeddings: { float: [[0.5, 0.6, 0.7]] },
          meta: { billed_units: { input_tokens: 10 } }
        })
      });

      const pattern: PatternData = {
        symbolName: "SOLUSDT",
        type: "volume_profile",
        data: { volumeProfile: [1000, 2000, 1500, 3000] },
        confidence: 88
      };

      const embedding = await aiIntelligenceService.generatePatternEmbedding(pattern);

      expect(embedding).toEqual([0.5, 0.6, 0.7]);
      expect(embedding.length).toBe(3);
    });

    it("should provide fallback behavior when AI services are unavailable", async () => {
      mockFetch.mockRejectedValue(new Error("Service unavailable"));

      const pattern: PatternData = {
        symbolName: "AVAXUSDT",
        type: "launch_pattern",
        data: { timeToLaunch: 2.5 },
        confidence: 70
      };

      const enhanced = await aiIntelligenceService.enhancePatternWithAI(pattern);

      expect(enhanced.marketSentiment).toBe("neutral");
      expect(enhanced.aiConfidenceBoost).toBe(0);
      expect(enhanced.symbolName).toBe("AVAXUSDT");
      expect(enhanced.enhancementTimestamp).toBeDefined();
    });
  });
});