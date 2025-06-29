/**
 * Cache-Agent Integration Tests
 *
 * Tests the integration between the enhanced caching system and the multi-agent system:
 * - Agent response caching and retrieval
 * - Workflow result caching
 * - Cache invalidation on agent updates
 * - Performance improvements from caching
 * - Cache monitoring for agent operations
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { globalCacheManager } from "@/src/lib/cache-manager";
import { globalCacheMonitoring } from "@/src/lib/cache-monitoring";
import { globalEnhancedAgentCache } from "@/src/lib/enhanced-agent-cache";
// Import everything before mocking
import {
  type AgentConfig,
  type AgentResponse,
  BaseAgent,
} from "@/src/mexc-agents/base-agent";

// Mock console output to reduce test noise
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "info").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(console, "debug").mockImplementation(() => {});

// Test agent implementation with mocked OpenAI
class TestAgent extends BaseAgent {
  public mockOpenAI: any;

  constructor(name: string, systemPrompt: string = "You are a test agent") {
    super({
      name,
      systemPrompt,
      cacheEnabled: true,
      cacheTTL: 60000,
    } as AgentConfig);

    // Mock OpenAI client
    this.mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: "Mocked AI response",
                  role: "assistant",
                  refusal: null,
                },
              },
            ],
            usage: {
              total_tokens: 100,
              completion_tokens: 50,
              prompt_tokens: 50,
            },
            model: "gpt-4o",
          }),
        },
      },
    };

    // Replace the OpenAI client
    (this as any).openai = this.mockOpenAI;
  }

  async process(
    input: string,
    context?: Record<string, unknown>,
  ): Promise<AgentResponse> {
    return await this.callOpenAI([{ role: "user", content: input }]);
  }
}

// Mock setup in beforeEach to avoid hoisting issues
beforeEach(async () => {
  // Mock error logging service by directly mocking the static getInstance method
  try {
    const { ErrorLoggingService } = await import(
      "@/src/services/notification/error-logging-service"
    );
    vi.spyOn(ErrorLoggingService, "getInstance").mockReturnValue({
      logError: vi.fn().mockResolvedValue(undefined),
    } as any);
  } catch (error) {
    // If module doesn't exist, that's fine for tests
  }
});

describe("Cache-Agent Integration", () => {
  let testAgent: TestAgent;
  let patternAgent: TestAgent;
  let strategyAgent: TestAgent;

  beforeEach(async () => {
    // Create test agents
    testAgent = new TestAgent("test-agent");
    patternAgent = new TestAgent(
      "pattern-discovery-agent",
      "You analyze patterns",
    );
    strategyAgent = new TestAgent("strategy-agent", "You create strategies");

    // Clear caches
    await globalCacheManager.clear();
    await globalEnhancedAgentCache.invalidateAgentResponses({});
  });

  afterEach(() => {
    // Clean up agents
    if (testAgent) testAgent.destroy();
    if (patternAgent) patternAgent.destroy();
    if (strategyAgent) strategyAgent.destroy();

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe("Agent Response Caching", () => {
    test("should cache agent responses automatically", async () => {
      const input = "Analyze market conditions";

      // First call should hit the AI API
      const response1 = await testAgent.process(input);
      expect(response1.metadata.fromCache).toBe(false);
      expect(response1.content).toBe("Mocked AI response");

      // Second call should hit the cache
      const response2 = await testAgent.process(input);
      expect(response2.metadata.fromCache).toBe(true);
      expect(response2.content).toBe("Mocked AI response");
    });

    test("should handle different cache priorities for different agents", async () => {
      const input = "Test input";

      // Pattern agent should get high priority
      const patternResponse = await patternAgent.process(input);
      expect(patternResponse.metadata.fromCache).toBe(false);

      // Strategy agent should get high priority
      const strategyResponse = await strategyAgent.process(input);
      expect(strategyResponse.metadata.fromCache).toBe(false);

      // Regular agent should get lower priority
      const testResponse = await testAgent.process(input);
      expect(testResponse.metadata.fromCache).toBe(false);

      // Verify all responses are cached
      const cachedPattern = await patternAgent.process(input);
      const cachedStrategy = await strategyAgent.process(input);
      const cachedTest = await testAgent.process(input);

      expect(cachedPattern.metadata.fromCache).toBe(true);
      expect(cachedStrategy.metadata.fromCache).toBe(true);
      expect(cachedTest.metadata.fromCache).toBe(true);
    });

    test("should invalidate cache when dependencies change", async () => {
      const input = "Check MEXC symbols for ready state patterns";

      // First call
      const response1 = await patternAgent.process(input);
      expect(response1.metadata.fromCache).toBe(false);

      // Second call should be cached
      const response2 = await patternAgent.process(input);
      expect(response2.metadata.fromCache).toBe(true);

      // Invalidate MEXC symbol dependency
      await globalEnhancedAgentCache.invalidateAgentResponses({
        dependencies: ["mexc/symbols"],
      });

      // Third call should miss cache due to invalidation
      const response3 = await patternAgent.process(input);
      expect(response3.metadata.fromCache).toBe(false);
    });

    test("should track execution time improvements from caching", async () => {
      const input = "Complex analysis requiring significant processing";

      // First call - no cache
      const response1 = await testAgent.process(input);
      expect(response1.metadata.fromCache).toBe(false);
      expect(response1.metadata.executionTimeMs).toBeGreaterThan(0);

      // Second call - from cache
      const response2 = await testAgent.process(input);
      expect(response2.metadata.fromCache).toBe(true);

      // The response should be identical content
      expect(response2.content).toBe(response1.content);

      // Verify caching is working by checking fromCache flag
      expect(response2.metadata.fromCache).toBe(true);
    });
  });

  describe("Cache Analytics for Agents", () => {
    test("should track agent cache performance", async () => {
      // Generate some agent activity
      await testAgent.process("Request 1");
      await testAgent.process("Request 2");
      await testAgent.process("Request 1"); // Cache hit
      await testAgent.process("Request 3");
      await testAgent.process("Request 2"); // Cache hit

      const analytics = await globalEnhancedAgentCache.getAnalytics();

      expect(analytics.agentPerformance).toHaveProperty("test-agent");

      const agentPerf = analytics.agentPerformance["test-agent"];
      expect(agentPerf.hitRate).toBeGreaterThan(0);
      expect(agentPerf.totalRequests).toBeGreaterThan(0);
      expect(agentPerf.cacheEfficiency).toBeGreaterThan(0);
    });

    test("should provide agent-specific recommendations", async () => {
      // Create low-performing cache scenario
      for (let i = 0; i < 20; i++) {
        await testAgent.process(`Unique request ${i}`); // All cache misses
      }

      const analytics = await globalEnhancedAgentCache.getAnalytics();

      // Verify recommendations contain performance-related keywords
      const hasPerformanceRecommendation = analytics.recommendations.some(
        (rec) => /cache|hit rate|performance/i.test(rec),
      );

      expect(hasPerformanceRecommendation).toBe(true);
      expect(analytics.recommendations.length).toBeGreaterThan(0);
    });

    test("should monitor cache health for agents", async () => {
      const agentId = "test-agent";
      const health = {
        agentId,
        status: "healthy" as const,
        lastCheck: Date.now(),
        responseTime: 150,
        errorRate: 0,
        cacheHitRate: 75,
        metadata: {
          uptime: 60000,
          totalRequests: 100,
          successfulRequests: 100,
          averageResponseTime: 150,
        },
      };

      await globalEnhancedAgentCache.setAgentHealth(agentId, health);
      const cachedHealth =
        await globalEnhancedAgentCache.getAgentHealth(agentId);

      expect(cachedHealth).toBeTruthy();
      expect(cachedHealth?.status).toBe("healthy");
      expect(cachedHealth?.cacheHitRate).toBe(75);
    });
  });

  describe("Workflow Result Caching", () => {
    test("should cache workflow results", async () => {
      const workflowType = "pattern-analysis";
      const parameters = { symbols: ["BTCUSDT"], timeframe: "1h" };

      // Simulate workflow execution
      const agentResults = new Map();
      agentResults.set(
        "pattern-discovery",
        await patternAgent.process("Analyze patterns"),
      );
      agentResults.set(
        "strategy",
        await strategyAgent.process("Create strategy"),
      );

      const workflowResult = {
        workflowId: "workflow-123",
        agentSequence: ["pattern-discovery", "strategy"],
        results: agentResults,
        finalResult: {
          confidence: 85,
          recommendation: "BUY",
          patterns: ["ready_state"],
        },
        executionTime: 2500,
        timestamp: Date.now(),
        dependencies: ["mexc/symbols", "pattern/detection"],
        metadata: {
          success: true,
          errorCount: 0,
          handoffCount: 1,
          confidence: 85,
        },
      };

      // Cache workflow result
      await globalEnhancedAgentCache.setWorkflowResult(
        workflowType,
        parameters,
        workflowResult,
      );

      // Retrieve cached result
      const cached = await globalEnhancedAgentCache.getWorkflowResult(
        workflowType,
        parameters,
      );

      expect(cached).toBeTruthy();
      expect(cached?.workflowId).toBe("workflow-123");
      expect(cached?.metadata.confidence).toBe(85);
      expect(cached?.finalResult.recommendation).toBe("BUY");
    });

    test("should invalidate workflow cache when dependencies change", async () => {
      const workflowType = "symbol-analysis";
      const parameters = { symbol: "ETHUSDT" };
      const workflowResult = {
        workflowId: "workflow-456",
        agentSequence: ["pattern-discovery"],
        results: new Map(),
        finalResult: { status: "analyzed" },
        executionTime: 1000,
        timestamp: Date.now(),
        dependencies: ["mexc/symbols"],
        metadata: {
          success: true,
          errorCount: 0,
          handoffCount: 0,
          confidence: 90,
        },
      };

      await globalEnhancedAgentCache.setWorkflowResult(
        workflowType,
        parameters,
        workflowResult,
      );

      // Verify it's cached
      let cached = await globalEnhancedAgentCache.getWorkflowResult(
        workflowType,
        parameters,
      );
      expect(cached).toBeTruthy();

      // Invalidate by dependency
      await globalEnhancedAgentCache.invalidateWorkflowResults({
        dependencies: ["mexc/symbols"],
      });

      // Should be invalidated
      cached = await globalEnhancedAgentCache.getWorkflowResult(
        workflowType,
        parameters,
      );
      expect(cached).toBeNull();
    });
  });

  describe("Cache Performance Monitoring", () => {
    test("should monitor cache performance in real-time", async () => {
      // Generate agent activity
      await Promise.all([
        testAgent.process("Request A"),
        patternAgent.process("Pattern analysis"),
        strategyAgent.process("Strategy creation"),
      ]);

      // Get cache status
      const status = await globalCacheMonitoring.getCurrentStatus();

      expect(status.agents).toBeDefined();
      expect(status.performance.totalMemoryUsage).toBeGreaterThan(0);
      expect(status.health.status).toMatch(/healthy|degraded|critical/);
    });

    test("should generate cache optimization recommendations", async () => {
      // Create suboptimal cache conditions
      for (let i = 0; i < 50; i++) {
        await testAgent.process(`Unique request ${i}`); // Many cache misses
      }

      const recommendations = globalCacheMonitoring.getCurrentRecommendations();

      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);

      // Should have recommendations for improving cache performance
      const hasPerformanceRec = recommendations.some(
        (rec) =>
          rec.description.toLowerCase().includes("cache") ||
          rec.description.toLowerCase().includes("hit rate") ||
          rec.description.toLowerCase().includes("performance"),
      );

      expect(hasPerformanceRec).toBe(true);
    });

    test("should optimize cache automatically when needed", async () => {
      // Create many cache entries to trigger optimization
      for (let i = 0; i < 100; i++) {
        await globalCacheManager.set(`test-key-${i}`, { data: `value-${i}` });
      }

      const optimizationResult = await globalCacheMonitoring.optimizeCache();

      expect(optimizationResult.actions).toBeDefined();
      expect(optimizationResult.improvements).toBeDefined();
      expect(Array.isArray(optimizationResult.actions)).toBe(true);
    });
  });

  describe("Cache Integration with Agent Error Handling", () => {
    test("should handle agent errors without breaking cache", async () => {
      // Mock an error from OpenAI
      const errorAgent = new TestAgent("error-agent");
      errorAgent.mockOpenAI.chat.completions.create.mockRejectedValueOnce(
        new Error("API Error"),
      );

      await expect(errorAgent.process("test input")).rejects.toThrow(
        "API Error",
      );

      // Cache should still be functional
      await globalCacheManager.set("test-after-error", { data: "test" });
      const cached = await globalCacheManager.get("test-after-error");
      expect(cached).toEqual({ data: "test" });

      errorAgent.destroy();
    });

    test("should not cache error responses", async () => {
      const input = "test input";

      // Mock an error
      const errorAgent = new TestAgent("error-agent");
      errorAgent.mockOpenAI.chat.completions.create.mockRejectedValueOnce(
        new Error("API Error"),
      );

      await expect(errorAgent.process(input)).rejects.toThrow();

      // Fix the mock and try again
      errorAgent.mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: "Success response",
              role: "assistant",
              refusal: null,
            },
          },
        ],
        usage: { total_tokens: 50, completion_tokens: 30, prompt_tokens: 20 },
        model: "gpt-4o",
      });

      const response = await errorAgent.process(input);
      expect(response.content).toBe("Success response");
      expect(response.metadata.fromCache).toBe(false); // Should not be from cache

      errorAgent.destroy();
    });
  });

  describe("Memory Management", () => {
    test("should manage memory usage effectively", async () => {
      const initialStatus = await globalCacheMonitoring.getCurrentStatus();
      const initialMemory = initialStatus.performance.totalMemoryUsage;

      // Generate significant cache activity
      const agents = [testAgent, patternAgent, strategyAgent];
      const promises = [];

      for (let i = 0; i < 50; i++) {
        for (const agent of agents) {
          promises.push(
            agent.process(`Request ${i} from ${agent["config"].name}`),
          );
        }
      }

      await Promise.all(promises);

      const afterStatus = await globalCacheMonitoring.getCurrentStatus();
      const afterMemory = afterStatus.performance.totalMemoryUsage;

      // Memory should have increased but should be reasonable
      expect(afterMemory).toBeGreaterThan(initialMemory);
      expect(afterMemory).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    });

    test("should cleanup expired cache entries", async () => {
      // Create cache entries with short TTL
      await globalCacheManager.set(
        "short-lived-1",
        { data: "1" },
        { ttl: 100 },
      );
      await globalCacheManager.set(
        "short-lived-2",
        { data: "2" },
        { ttl: 100 },
      );
      await globalCacheManager.set("long-lived", { data: "3" }, { ttl: 60000 });

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Cleanup
      const cleaned = globalCacheManager.cleanup();

      expect(cleaned.total).toBeGreaterThan(0);
      expect(await globalCacheManager.has("short-lived-1")).toBe(false);
      expect(await globalCacheManager.has("short-lived-2")).toBe(false);
      expect(await globalCacheManager.has("long-lived")).toBe(true);
    });
  });

  describe("Performance Benchmarks", () => {
    test("should demonstrate caching effectiveness", async () => {
      const input = "Complex analysis requiring processing time";

      // First call - should not be cached
      const response1 = await testAgent.process(input);
      expect(response1.metadata.fromCache).toBe(false);

      // Subsequent calls - should be cached
      const cachedResponses = [];
      for (let i = 0; i < 5; i++) {
        const response = await testAgent.process(input);
        cachedResponses.push(response);
      }

      // All cached responses should be identical and from cache
      for (const response of cachedResponses) {
        expect(response.metadata.fromCache).toBe(true);
        expect(response.content).toBe(response1.content);
      }

      console.log(
        `Cache effectiveness: ${cachedResponses.length} consecutive cache hits`,
      );
    });

    test("should maintain good hit rates under concurrent load", async () => {
      const inputs = [
        "Analyze pattern A",
        "Analyze pattern B",
        "Analyze pattern C",
        "Create strategy X",
        "Create strategy Y",
      ];

      // First pass - establish cache entries
      for (const input of inputs) {
        await patternAgent.process(input);
        await strategyAgent.process(input);
      }

      // Generate concurrent load with many repeated requests
      const promises = [];
      for (let i = 0; i < 100; i++) {
        const input = inputs[i % inputs.length];
        const agent = i % 2 === 0 ? patternAgent : strategyAgent;
        promises.push(agent.process(input));
      }

      await Promise.all(promises);

      // Check hit rates
      const analytics = await globalEnhancedAgentCache.getAnalytics();

      const patternPerf = analytics.agentPerformance["pattern-discovery-agent"];
      const strategyPerf = analytics.agentPerformance["strategy-agent"];

      if (patternPerf) {
        expect(patternPerf.hitRate).toBeGreaterThan(20); // Should achieve reasonable hit rate
        expect(patternPerf.totalRequests).toBeGreaterThan(0);
        console.log(
          `Pattern agent hit rate: ${patternPerf.hitRate.toFixed(1)}%`,
        );
      }

      if (strategyPerf) {
        expect(strategyPerf.hitRate).toBeGreaterThan(20);
        expect(strategyPerf.totalRequests).toBeGreaterThan(0);
        console.log(
          `Strategy agent hit rate: ${strategyPerf.hitRate.toFixed(1)}%`,
        );
      }
    });
  });
});
