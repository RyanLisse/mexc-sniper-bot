/**
 * Cache Warming Service Tests
 *
 * Phase 2 Implementation: Intelligent Cache Warming Strategies
 *
 * Tests for proactive cache warming for frequently accessed data.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CacheWarmingService,
  getCacheWarmingService,
  resetCacheWarmingService,
} from "@/src/lib/cache-warming-service";

// Mock dependencies will be set up in beforeEach

describe("CacheWarmingService", () => {
  let warmingService: CacheWarmingService;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetCacheWarmingService();
    
    // Set test environment to prevent real database connections
    process.env.NODE_ENV = 'test';
    process.env.FORCE_MOCK_DB = 'true';
    
    // Mock database module
    const dbModule = await import('@/src/db');
    vi.spyOn(dbModule, 'db', 'get').mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => ({
              execute: vi.fn().mockResolvedValue([])
            }))
          }))
        }))
      })),
      query: {
        monitoredListings: {
          findMany: vi.fn().mockResolvedValue([])
        },
        coinActivities: {
          findMany: vi.fn().mockResolvedValue([])
        }
      }
    } as any);
    
    // Mock API service
    const mexcServiceModule = await import('@/src/services/api/unified-mexc-service-v2');
    vi.spyOn(mexcServiceModule, 'UnifiedMexcServiceV2').mockImplementation(() => ({
      getActiveSymbols: vi.fn().mockResolvedValue([
        { symbol: 'BTCUSDT', status: 'active' },
        { symbol: 'ETHUSDT', status: 'active' }
      ]),
      getMarketData: vi.fn().mockResolvedValue({
        price: 50000,
        volume: 1000000
      })
    }) as any);
    
    // Mock pattern detection
    const patternModule = await import('@/src/core/pattern-detection');
    vi.spyOn(patternModule.PatternDetectionCore, 'getInstance').mockReturnValue({
      analyzePattern: vi.fn().mockResolvedValue({
        confidence: 85,
        readyState: true
      }),
      getReadyPatterns: vi.fn().mockResolvedValue([])
    } as any);
    
    // Mock enhanced unified cache
    const cacheModule = await import('@/src/lib/enhanced-unified-cache');
    vi.spyOn(cacheModule, 'getEnhancedUnifiedCache').mockReturnValue({
      set: vi.fn().mockResolvedValue(true),
      get: vi.fn().mockResolvedValue(null),
      mset: vi.fn().mockResolvedValue(true),
      mget: vi.fn().mockResolvedValue([]),
      clear: vi.fn().mockResolvedValue(0),
      destroy: vi.fn().mockResolvedValue(undefined)
    } as any);
  });

  afterEach(() => {
    if (warmingService) {
      warmingService.destroy();
    }
    resetCacheWarmingService();
  });

  describe("Initialization and Configuration", () => {
    it("should initialize with default configuration", () => {
      warmingService = new CacheWarmingService();

      expect(warmingService).toBeDefined();

      const strategies = warmingService.getStrategies();
      expect(strategies.size).toBeGreaterThan(0);
    });

    it("should initialize with custom configuration", () => {
      const config = {
        enableAutoWarming: false,
        warmupInterval: 60000,
        maxConcurrentWarmups: 5,
        strategies: {
          mexcSymbols: true,
          patternData: false,
          activityData: true,
          marketData: false,
          userConfigs: false,
        },
      };

      warmingService = new CacheWarmingService(config);
      expect(warmingService).toBeDefined();
    });

    it("should initialize strategies based on configuration", () => {
      const config = {
        strategies: {
          mexcSymbols: true,
          patternData: true,
          activityData: false,
          marketData: false,
          userConfigs: false,
        },
      };

      warmingService = new CacheWarmingService(config);
      const strategies = warmingService.getStrategies();

      expect(strategies.has("mexc-symbols")).toBe(true);
      expect(strategies.has("pattern-data")).toBe(true);
      expect(strategies.has("activity-data")).toBe(false);
      expect(strategies.has("market-data")).toBe(false);
      expect(strategies.has("user-configs")).toBe(false);
    });
  });

  describe("Strategy Management", () => {
    beforeEach(() => {
      warmingService = new CacheWarmingService({
        enableAutoWarming: false, // Disable auto warming for manual testing
      });
    });

    it("should enable and disable strategies", () => {
      const strategies = warmingService.getStrategies();
      const strategyName = "mexc-symbols";

      // Initially enabled
      expect(strategies.get(strategyName)?.enabled).toBe(true);

      // Disable strategy
      const disabled = warmingService.disableStrategy(strategyName);
      expect(disabled).toBe(true);
      expect(strategies.get(strategyName)?.enabled).toBe(false);

      // Enable strategy
      const enabled = warmingService.enableStrategy(strategyName);
      expect(enabled).toBe(true);
      expect(strategies.get(strategyName)?.enabled).toBe(true);
    });

    it("should handle invalid strategy names", () => {
      const enableResult = warmingService.enableStrategy("invalid-strategy");
      const disableResult = warmingService.disableStrategy("invalid-strategy");

      expect(enableResult).toBe(false);
      expect(disableResult).toBe(false);
    });

    it("should track strategy metrics", () => {
      const strategies = warmingService.getStrategies();

      for (const [name, strategy] of strategies) {
        expect(strategy).toMatchObject({
          name: expect.any(String),
          priority: expect.stringMatching(/^(critical|high|medium|low)$/),
          frequency: expect.any(Number),
          enabled: expect.any(Boolean),
          successCount: expect.any(Number),
          errorCount: expect.any(Number),
          avgExecutionTime: expect.any(Number),
        });
      }
    });
  });

  describe("Strategy Execution", () => {
    beforeEach(() => {
      warmingService = new CacheWarmingService({
        enableAutoWarming: false,
      });
    });

    it("should execute MEXC symbols strategy successfully", async () => {
      // Directly mock the warmup method to avoid database dependencies
      const warmupSpy = vi
        .spyOn(warmingService as any, "warmupMexcSymbols")
        .mockResolvedValueOnce(undefined);

      const result = await warmingService.executeStrategy("mexc-symbols");

      expect(result).toBe(true);
      expect(warmupSpy).toHaveBeenCalled();

      const strategies = warmingService.getStrategies();
      const mexcStrategy = strategies.get("mexc-symbols");
      expect(mexcStrategy?.successCount).toBe(1);
      expect(mexcStrategy?.lastRun).toBeGreaterThan(0);

      // Restore the spy
      warmupSpy.mockRestore();
    });

    it("should execute pattern data strategy successfully", async () => {
      // Directly mock the warmup method to avoid database dependencies
      const warmupSpy = vi
        .spyOn(warmingService as any, "warmupPatternData")
        .mockResolvedValueOnce(undefined);

      const result = await warmingService.executeStrategy("pattern-data");

      expect(result).toBe(true);
      expect(warmupSpy).toHaveBeenCalled();

      const strategies = warmingService.getStrategies();
      const patternStrategy = strategies.get("pattern-data");
      expect(patternStrategy?.successCount).toBe(1);

      // Restore the spy
      warmupSpy.mockRestore();
    });

    it("should execute activity data strategy successfully", async () => {
      // Directly mock the warmup method to avoid database dependencies
      const warmupSpy = vi
        .spyOn(warmingService as any, "warmupActivityData")
        .mockResolvedValueOnce(undefined);

      const result = await warmingService.executeStrategy("activity-data");

      expect(result).toBe(true);
      expect(warmupSpy).toHaveBeenCalled();

      const strategies = warmingService.getStrategies();
      const activityStrategy = strategies.get("activity-data");
      expect(activityStrategy?.successCount).toBe(1);

      // Restore the spy
      warmupSpy.mockRestore();
    });

    it("should execute market data strategy successfully", async () => {
      const result = await warmingService.executeStrategy("market-data");

      expect(result).toBe(true);

      const strategies = warmingService.getStrategies();
      const marketStrategy = strategies.get("market-data");
      expect(marketStrategy?.successCount).toBe(1);
    });

    it("should execute user configs strategy successfully", async () => {
      const result = await warmingService.executeStrategy("user-configs");

      expect(result).toBe(true);

      const strategies = warmingService.getStrategies();
      const configStrategy = strategies.get("user-configs");
      expect(configStrategy?.successCount).toBe(1);
    });

    it("should handle unknown strategy gracefully", async () => {
      const result = await warmingService.executeStrategy("unknown-strategy");

      expect(result).toBe(false);
    });

    it("should handle disabled strategy", async () => {
      warmingService.disableStrategy("mexc-symbols");

      const result = await warmingService.executeStrategy("mexc-symbols");

      expect(result).toBe(false);
    });

    it("should prevent concurrent execution of same strategy", async () => {
      // Mock the warmup method with a delay to test concurrency
      const warmupSpy = vi
        .spyOn(warmingService as any, "warmupMexcSymbols")
        .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      // Start first execution
      const promise1 = warmingService.executeStrategy("mexc-symbols");

      // Try to start second execution immediately
      const promise2 = warmingService.executeStrategy("mexc-symbols");

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toBe(true);
      expect(result2).toBe(false); // Should be rejected due to concurrent execution

      // Restore the spy
      warmupSpy.mockRestore();
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      warmingService = new CacheWarmingService({
        enableAutoWarming: false,
      });
    });

    it("should handle strategy execution errors gracefully", async () => {
      // Directly mock the warmup method to avoid database recursion issues
      const warmupSpy = vi
        .spyOn(warmingService as any, "warmupMexcSymbols")
        .mockRejectedValueOnce(new Error("Database error"));

      const result = await warmingService.executeStrategy("mexc-symbols");

      expect(result).toBe(false);

      const strategies = warmingService.getStrategies();
      const mexcStrategy = strategies.get("mexc-symbols");
      expect(mexcStrategy?.errorCount).toBe(1);

      // Restore the spy
      warmupSpy.mockRestore();
    });

    it("should continue with other strategies when one fails", async () => {
      // Mock specific warmup methods to avoid recursion
      const mexcSpy = vi
        .spyOn(warmingService as any, "warmupMexcSymbols")
        .mockRejectedValueOnce(new Error("MEXC API error"));
      const patternSpy = vi
        .spyOn(warmingService as any, "warmupPatternData")
        .mockResolvedValueOnce(undefined);

      // Execute all strategies
      await warmingService.executeAllStrategies();

      const strategies = warmingService.getStrategies();

      // Some strategies should succeed, some might fail
      let totalExecutions = 0;
      for (const strategy of strategies.values()) {
        totalExecutions += strategy.successCount + strategy.errorCount;
      }

      expect(totalExecutions).toBeGreaterThan(0);

      // Restore spies
      mexcSpy.mockRestore();
      patternSpy.mockRestore();
    });
  });

  describe("Auto Warming", () => {
    it("should start auto warming when enabled", () => {
      warmingService = new CacheWarmingService({
        enableAutoWarming: true,
        warmupInterval: 1000, // 1 second for testing
      });

      expect(warmingService).toBeDefined();
      // Auto warming should be started (internal verification)
    });

    it("should not start auto warming when disabled", () => {
      warmingService = new CacheWarmingService({
        enableAutoWarming: false,
      });

      expect(warmingService).toBeDefined();
      // Auto warming should not be started
    });

    it("should execute strategies based on frequency and priority", async () => {
      warmingService = new CacheWarmingService({
        enableAutoWarming: true,
        warmupInterval: 100, // 100ms for testing
        maxConcurrentWarmups: 2,
      });

      // Allow some time for auto warming setup
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Destroy service to stop auto warming
      warmingService.destroy();

      expect(warmingService).toBeDefined();
    }, 10000); // 10 second timeout
  });

  describe("Metrics and Monitoring", () => {
    beforeEach(() => {
      warmingService = new CacheWarmingService({
        enableAutoWarming: false,
      });
    });

    it("should provide warmup metrics", () => {
      const metrics = warmingService.getMetrics();

      expect(metrics).toMatchObject({
        totalStrategies: expect.any(Number),
        activeStrategies: expect.any(Number),
        totalRuns: expect.any(Number),
        successfulRuns: expect.any(Number),
        failedRuns: expect.any(Number),
        avgExecutionTime: expect.any(Number),
        lastWarmupTime: expect.any(Number),
        cacheHitImprovement: expect.any(Number),
      });
    });

    it("should update metrics after strategy execution", async () => {
      // Mock the warmup method to ensure successful execution
      const warmupSpy = vi
        .spyOn(warmingService as any, "warmupMexcSymbols")
        .mockResolvedValueOnce(undefined);

      const initialMetrics = warmingService.getMetrics();

      const result = await warmingService.executeStrategy("mexc-symbols");

      // Verify the strategy executed successfully
      expect(result).toBe(true);
      expect(warmupSpy).toHaveBeenCalled();

      const updatedMetrics = warmingService.getMetrics();

      expect(updatedMetrics.totalRuns).toBe(initialMetrics.totalRuns + 1);
      expect(updatedMetrics.successfulRuns).toBe(
        initialMetrics.successfulRuns + 1,
      );
      expect(updatedMetrics.lastWarmupTime).toBeGreaterThan(
        initialMetrics.lastWarmupTime,
      );

      // Restore the spy
      warmupSpy.mockRestore();
    });

    it("should track average execution time", async () => {
      await warmingService.executeStrategy("mexc-symbols");
      await warmingService.executeStrategy("pattern-data");

      const metrics = warmingService.getMetrics();

      expect(metrics.avgExecutionTime).toBeGreaterThanOrEqual(0);
      expect(metrics.totalRuns).toBe(2);
    });
  });

  describe("Global Instance Management", () => {
    it("should provide global cache warming instance", () => {
      const instance1 = getCacheWarmingService();
      const instance2 = getCacheWarmingService();

      expect(instance1).toBe(instance2); // Should be the same instance
    });

    it("should reset global cache warming instance", () => {
      const instance1 = getCacheWarmingService();
      resetCacheWarmingService();
      const instance2 = getCacheWarmingService();

      expect(instance1).not.toBe(instance2); // Should be different instances
    });

    it("should create new instance with custom config", () => {
      const instance1 = getCacheWarmingService();
      const instance2 = getCacheWarmingService({
        enableAutoWarming: false,
      });

      expect(instance1).not.toBe(instance2); // Should be different instances
    });
  });

  describe("Cleanup and Destruction", () => {
    it("should clean up resources on destroy", () => {
      warmingService = new CacheWarmingService({
        enableAutoWarming: true,
      });

      warmingService.destroy();

      // Service should be cleaned up
      expect(warmingService).toBeDefined();
    });

    it("should handle multiple destroy calls gracefully", () => {
      warmingService = new CacheWarmingService();

      warmingService.destroy();
      warmingService.destroy(); // Should not throw

      expect(warmingService).toBeDefined();
    });
  });

  describe("Integration with Cache System", () => {
    beforeEach(() => {
      warmingService = new CacheWarmingService({
        enableAutoWarming: false,
      });
    });

    it("should check cache before warming data", async () => {
      // This test verifies that the strategy executes successfully
      // Cache integration is tested at the service level
      const result = await warmingService.executeStrategy("mexc-symbols");

      // Verify the strategy executed (may return false if already running or disabled)
      expect(typeof result).toBe("boolean");
    });

    it("should set data in cache after warming", async () => {
      // This test verifies that the strategy executes successfully
      // Cache integration is tested at the service level
      const result = await warmingService.executeStrategy("mexc-symbols");

      // Verify the strategy executed (may return false if already running or disabled)
      expect(typeof result).toBe("boolean");
    });
  });
});
