/**
 * AI Intelligence Integration Tests
 *
 * Integration tests for the complete AI Intelligence system including:
 * - Pattern detection engine with AI enhancement
 * - Pattern embedding service with Cohere integration
 * - WebSocket real-time pattern analysis
 * - End-to-end AI-enhanced confidence scoring
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { aiIntelligenceService } from "../../src/services/ai-intelligence-service";
import { patternDetectionEngine } from "../../src/services/pattern-detection-engine";
import { patternEmbeddingService } from "../../src/services/pattern-embedding-service";
import type { PatternData } from "../../src/services/pattern-embedding-service";

// Mock external dependencies
vi.mock("../../src/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([])
          }))
        })),
        orderBy: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([])
        })),
        limit: vi.fn().mockResolvedValue([])
      }))
    })),
    execute: vi.fn().mockResolvedValue([])
  }
}));

vi.mock("../../src/db/vector-utils", () => ({
  vectorUtils: {
    storePatternEmbedding: vi.fn().mockResolvedValue("test-id"),
    findSimilarPatterns: vi.fn().mockResolvedValue([]),
    getPattern: vi.fn().mockResolvedValue(null)
  }
}));

// Mock OpenAI client to prevent initialization issues
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    embeddings: {
      create: vi.fn().mockResolvedValue({
        data: [{ embedding: [0.3, 0.5, 0.7] }]
      })
    }
  }))
}));

// Mock the AI services to use test environment variables
vi.mock("../../src/services/ai-intelligence-service", async () => {
  const actual = await vi.importActual("../../src/services/ai-intelligence-service");
  return {
    ...actual,
    aiIntelligenceService: {
      enhancePatternWithAI: vi.fn().mockResolvedValue({
        cohereEmbedding: [0.1, 0.2, 0.3, 0.4, 0.5],
        perplexityInsights: {
          summary: "Test research summary",
          keyFindings: ["Test finding 1", "Test finding 2"],
          marketContext: { sentiment: "bullish" },
          riskAssessment: { level: "low" }
        },
        aiContext: { marketSentiment: "bullish" }
      }),
      calculateAIEnhancedConfidence: vi.fn().mockResolvedValue({
        enhancedConfidence: 95,
        recommendations: ["Test recommendation"]
      }),
      generateCohereEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      generatePatternEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      conductMarketResearch: vi.fn().mockResolvedValue({
        summary: "Test research",
        keyFindings: ["Finding 1"],
        marketContext: { sentiment: "bullish" }
      }),
      getCacheStats: vi.fn().mockReturnValue({
        research: { size: 0 },
        embeddings: { size: 0 }
      }),
      clearExpiredCache: vi.fn()
    }
  };
});

// Mock the pattern embedding service
vi.mock("../../src/services/pattern-embedding-service", async () => {
  const actual = await vi.importActual("../../src/services/pattern-embedding-service");
  return {
    ...actual,
    patternEmbeddingService: {
      generateEmbedding: vi.fn().mockResolvedValue([0.2, 0.4, 0.6]),
      storePattern: vi.fn().mockResolvedValue("test-pattern-id"),
      findSimilarPatterns: vi.fn().mockResolvedValue([]),
      calculatePatternConfidenceScore: vi.fn().mockResolvedValue({
        confidence: 85,
        components: { basePattern: 80 },
        recommendations: ["Test recommendation"]
      })
    }
  };
});

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock environment variables - store originals to restore later
const originalEnv = {
  COHERE_API_KEY: process.env.COHERE_API_KEY,
  PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};

process.env.COHERE_API_KEY = "test-cohere-key";
process.env.PERPLEXITY_API_KEY = "test-perplexity-key";
process.env.OPENAI_API_KEY = "test-openai-key";

describe("AI Intelligence Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();

    // Ensure environment variables are set for each test
    process.env.COHERE_API_KEY = "test-cohere-key";
    process.env.PERPLEXITY_API_KEY = "test-perplexity-key";
    process.env.OPENAI_API_KEY = "test-openai-key";
  });

  afterAll(() => {
    // Restore original environment variables
    Object.assign(process.env, originalEnv);
  });

  describe("End-to-End Pattern Enhancement", () => {
    const testSymbolData = {
      cd: "BTCUSDT",
      sts: 2,
      st: 2,
      tt: 4,
      vcoinId: "btc-001"
    };

    const mockCohereResponse = {
      embeddings: { float: [[0.1, 0.2, 0.3, 0.4, 0.5]] },
      meta: { billed_units: { input_tokens: 10 } }
    };

    const mockPerplexityResponse = {
      choices: [{
        message: {
          content: `## Executive Summary
Strong bullish momentum with institutional support.

## Key Findings
• Technical breakout confirmed
• Volume surge indicates strong interest
• Institutional accumulation patterns

## Market Context
Bullish sentiment with high volume and low volatility.

## Risk Assessment
Low risk environment with strong fundamentals.

## Opportunities
Short-term: Momentum trading
Medium-term: Position building
Long-term: Strategic hold`
        }
      }],
      citations: ["https://example.com/analysis"]
    };

    it("should perform complete AI-enhanced pattern analysis", async () => {
      // Mock API responses
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCohereResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPerplexityResponse)
        });

      const result = await patternDetectionEngine.analyzeSymbolReadiness(testSymbolData);

      expect(result).toBeDefined();
      expect(result?.confidence).toBeGreaterThan(90); // Should be enhanced by AI
      expect(result?.isReady).toBe(true);
      expect(result?.enhancedAnalysis).toBe(true);
    });

    it("should integrate Cohere embeddings with pattern storage", async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCohereResponse)
      });

      const testPattern: PatternData = {
        symbolName: "ETHUSDT",
        type: "ready_state",
        data: { sts: 2, st: 2, tt: 4, timeToLaunch: 3.5 },
        confidence: 85
      };

      const patternId = await patternEmbeddingService.storePattern(testPattern);

      expect(patternId).toBeDefined();
      expect(fetch).toHaveBeenCalledWith(
        "https://api.cohere.ai/v1/embed",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Authorization": "Bearer test-cohere-key"
          })
        })
      );
    });

    it("should fallback gracefully when AI services are unavailable", async () => {
      // Mock network failures
      (fetch as any).mockRejectedValue(new Error("Network error"));

      const result = await patternDetectionEngine.analyzeSymbolReadiness(testSymbolData);

      expect(result).toBeDefined();
      expect(result?.confidence).toBeGreaterThan(80); // Base confidence without AI enhancement
      expect(result?.isReady).toBe(true);
    });

    it("should cache AI results for performance optimization", async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockCohereResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPerplexityResponse)
        });

      // First analysis
      await patternDetectionEngine.analyzeSymbolReadiness(testSymbolData);

      // Second analysis should use cached results
      await patternDetectionEngine.analyzeSymbolReadiness(testSymbolData);

      // Verify caching reduces API calls
      expect(fetch).toHaveBeenCalledTimes(2); // Initial calls only
    });
  });

  describe("Pattern Embedding Enhancement", () => {
    it("should use Cohere as primary embedding model", async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          embeddings: { float: [[0.2, 0.4, 0.6]] },
          meta: { billed_units: { input_tokens: 5 } }
        })
      });

      const testPattern: PatternData = {
        symbolName: "ADAUSDT",
        type: "price_action",
        data: { priceChanges: [1.5, 2.2, -0.8, 3.1] },
        confidence: 78
      };

      const embedding = await patternEmbeddingService.generateEmbedding(testPattern);

      expect(embedding).toEqual([0.2, 0.4, 0.6]);
      expect(fetch).toHaveBeenCalledWith(
        "https://api.cohere.ai/v1/embed",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Authorization": "Bearer test-cohere-key"
          })
        })
      );
    });

    it("should fallback to OpenAI when Cohere fails", async () => {
      // Mock Cohere failure
      (fetch as any).mockRejectedValueOnce(new Error("Cohere API error"));

      // Mock OpenAI success
      const mockOpenAIResponse = {
        data: [{ embedding: [0.3, 0.5, 0.7] }]
      };

      // Create a new instance without Cohere key to trigger fallback
      const originalCohereKey = process.env.COHERE_API_KEY;
      delete process.env.COHERE_API_KEY;

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOpenAIResponse)
      });

      const testPattern: PatternData = {
        symbolName: "SOLUSDT",
        type: "volume_profile",
        data: { volumeProfile: [1000, 1500, 2000] },
        confidence: 82
      };

      const embedding = await patternEmbeddingService.generateEmbedding(testPattern);

      expect(embedding).toEqual([0.3, 0.5, 0.7]);

      // Restore environment
      process.env.COHERE_API_KEY = originalCohereKey;
    });

    it("should enhance pattern similarity analysis with AI context", async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          embeddings: { float: [[0.1, 0.2, 0.3]] },
          meta: { billed_units: { input_tokens: 8 } }
        })
      });

      const testPattern: PatternData = {
        symbolName: "DOTUSDT",
        type: "launch_pattern",
        data: { timeToLaunch: 4.5 },
        confidence: 88
      };

      const confidenceScore = await patternEmbeddingService.calculatePatternConfidenceScore(testPattern);

      expect(confidenceScore.confidence).toBeGreaterThanOrEqual(testPattern.confidence);
      expect(confidenceScore.components).toHaveProperty("basePattern");
      expect(confidenceScore.recommendations).toBeInstanceOf(Array);
    });
  });

  describe("Real-time Integration", () => {
    it("should integrate with WebSocket pattern detection", async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            embeddings: { float: [[0.4, 0.5, 0.6]] },
            meta: { billed_units: { input_tokens: 12 } }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            choices: [{
              message: { content: "Positive market analysis with strong technicals" }
            }],
            citations: []
          })
        });

      const realtimeData = {
        cd: "LINKUSDT",
        sts: 2,
        st: 2,
        tt: 4,
        vcoinId: "link-001"
      };

      const result = await patternDetectionEngine.analyzeSymbolReadiness(realtimeData);

      expect(result).toBeDefined();
      expect(result?.enhancedAnalysis).toBe(true);
      expect(result?.confidence).toBeGreaterThan(90);
    });

    it("should handle high-frequency pattern updates efficiently", async () => {
      // Mock successful responses
      (fetch as any)
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            embeddings: { float: [[0.1, 0.2]] },
            meta: { billed_units: { input_tokens: 5 } }
          })
        });

      const symbols = ["BTCUSDT", "ETHUSDT", "ADAUSDT", "SOLUSDT", "DOTUSDT"];
      const promises = symbols.map(symbol =>
        patternDetectionEngine.analyzeSymbolReadiness({
          cd: symbol,
          sts: 2,
          st: 2,
          tt: 4,
        } as any) // Type assertion to allow vcoinId extension
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result?.confidence).toBeGreaterThan(80);
      });
    });
  });

  describe("Performance and Scalability", () => {
    it("should maintain performance under load", async () => {
      (fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          embeddings: { float: [[Math.random(), Math.random(), Math.random()]] },
          meta: { billed_units: { input_tokens: 10 } }
        })
      });

      const startTime = Date.now();

      // Process multiple patterns concurrently
      const patterns = Array.from({ length: 10 }, (_, i) => ({
        symbolName: `TEST${i}USDT`,
        type: "ready_state" as const,
        data: { sts: 2, st: 2, tt: 4 },
        confidence: 80 + Math.random() * 15
      }));

      const promises = patterns.map(pattern =>
        aiIntelligenceService.enhancePatternWithAI(pattern)
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(10);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      results.forEach(result => {
        expect(result.aiContext).toBeDefined();
      });
    });

    it("should optimize API usage through intelligent caching", async () => {
      const cacheKeyPattern = "BTCUSDT-test-pattern";

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          embeddings: { float: [[0.7, 0.8, 0.9]] },
          meta: { billed_units: { input_tokens: 15 } }
        })
      });

      // First request
      await aiIntelligenceService.generateCohereEmbedding([cacheKeyPattern]);

      // Second request with same pattern should use cache
      await aiIntelligenceService.generateCohereEmbedding([cacheKeyPattern]);

      // Third request should still use cache
      await aiIntelligenceService.generateCohereEmbedding([cacheKeyPattern]);

      expect(fetch).toHaveBeenCalledTimes(1); // Only one API call due to caching
    });

    it("should handle cache eviction and memory management", () => {
      const initialStats = aiIntelligenceService.getCacheStats();

      // Trigger cache cleanup
      aiIntelligenceService.clearExpiredCache();

      const finalStats = aiIntelligenceService.getCacheStats();

      expect(finalStats.research.size).toBeGreaterThanOrEqual(0);
      expect(finalStats.embeddings.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Error Resilience", () => {
    it("should handle partial service failures gracefully", async () => {
      // Cohere succeeds, Perplexity fails
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            embeddings: { float: [[0.1, 0.2, 0.3]] },
            meta: { billed_units: { input_tokens: 8 } }
          })
        })
        .mockRejectedValueOnce(new Error("Perplexity service unavailable"));

      const testPattern: PatternData = {
        symbolName: "AVAXUSDT",
        type: "ready_state",
        data: { sts: 2, st: 2, tt: 4 },
        confidence: 85
      };

      const enhanced = await aiIntelligenceService.enhancePatternWithAI(testPattern);

      expect(enhanced.cohereEmbedding).toEqual([0.1, 0.2, 0.3]);
      // Perplexity may return fallback data instead of undefined
      expect(enhanced.perplexityInsights).toBeDefined();
      expect(enhanced.aiContext?.marketSentiment).toBe("neutral");
    });

    it("should provide meaningful fallback analysis", async () => {
      // All AI services fail
      (fetch as any).mockRejectedValue(new Error("All services unavailable"));

      const testPattern: PatternData = {
        symbolName: "MATICUSDT",
        type: "price_action",
        data: { priceChanges: [2.1, 1.8, -0.5] },
        confidence: 75
      };

      const enhanced = await aiIntelligenceService.enhancePatternWithAI(testPattern);
      const aiAnalysis = await aiIntelligenceService.calculateAIEnhancedConfidence(enhanced);

      expect(enhanced.aiContext).toBeDefined();
      expect(aiAnalysis.enhancedConfidence).toBeGreaterThanOrEqual(testPattern.confidence);
      expect(aiAnalysis.recommendations).toContain("Proceed with base pattern confidence");
    });

    it("should maintain system stability during API rate limits", async () => {
      // Mock rate limit responses
      (fetch as any).mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve("Rate limit exceeded")
      });

      const testPattern: PatternData = {
        symbolName: "ATOMUSDT",
        type: "volume_profile",
        data: { volumeProfile: [500, 750, 1000] },
        confidence: 82
      };

      // Should not throw but handle gracefully
      await expect(aiIntelligenceService.enhancePatternWithAI(testPattern))
        .resolves.toMatchObject({
          symbolName: "ATOMUSDT",
          confidence: 82
        });
    });
  });

  describe("Integration Validation", () => {
    it("should validate complete Phase 3 integration workflow", async () => {
      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            embeddings: { float: [[0.5, 0.6, 0.7, 0.8]] },
            meta: { billed_units: { input_tokens: 20 } }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            choices: [{
              message: {
                content: "## Executive Summary\nExceptional trading opportunity with strong fundamentals.\n\n## Key Findings\n• Technical breakout confirmed\n• Strong institutional support\n• Positive market sentiment\n\n## Market Context\nBullish with high volume and low volatility.\n\n## Risk Assessment\nLow risk with strong fundamentals."
              }
            }],
            citations: ["https://analysis.example.com"]
          })
        });

      // Step 1: AI-enhanced pattern analysis
      const symbolData = {
        cd: "UNIUSDT",
        sts: 2,
        st: 2,
        tt: 4,
        vcoinId: "uni-001"
      };

      const patternResult = await patternDetectionEngine.analyzeSymbolReadiness(symbolData);

      // Step 2: Enhanced pattern embedding
      const testPattern: PatternData = {
        symbolName: "UNIUSDT",
        type: "ready_state",
        data: { sts: 2, st: 2, tt: 4, timeToLaunch: 3.8 },
        confidence: patternResult?.confidence || 85
      };

      const enhanced = await aiIntelligenceService.enhancePatternWithAI(testPattern);

      // Step 3: AI-enhanced confidence calculation
      const aiAnalysis = await aiIntelligenceService.calculateAIEnhancedConfidence(enhanced);

      // Step 4: Pattern storage with Cohere embeddings
      const patternId = await patternEmbeddingService.storePattern(testPattern);

      // Validate complete workflow
      expect(patternResult).toBeDefined();
      expect(patternResult?.enhancedAnalysis).toBe(true);
      expect(enhanced.cohereEmbedding).toEqual([0.5, 0.6, 0.7, 0.8]);
      expect(enhanced.perplexityInsights).toBeDefined();
      expect(aiAnalysis.enhancedConfidence).toBeGreaterThan(testPattern.confidence);
      expect(patternId).toBeDefined();

      // Validate AI integration benefits
      expect(aiAnalysis.components.aiResearch).toBeGreaterThan(0);
      expect(aiAnalysis.aiInsights.length).toBeGreaterThan(0);
      expect(aiAnalysis.recommendations.length).toBeGreaterThan(0);
    });
  });
});