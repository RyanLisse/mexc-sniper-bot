/**
 * Portfolio Service Tests
 *
 * TDD tests for the modular portfolio service
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BalanceEntrySchema,
  createPortfolioService,
  type PortfolioConfig,
  PortfolioFilterSchema,
  PortfolioMetricsSchema,
  PortfolioService,
} from "../portfolio.service";

describe("PortfolioService", () => {
  let service: PortfolioService;
  let mockApiClient: any;
  let mockCache: any;
  let mockCircuitBreaker: any;
  let mockPerformanceMonitor: any;
  let mockTickerService: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock dependencies
    mockApiClient = {
      get: vi.fn(),
    };

    mockCache = {
      get: vi.fn(),
      set: vi.fn(),
    };

    mockCircuitBreaker = {
      execute: vi.fn().mockImplementation((fn) => fn()),
    };

    mockPerformanceMonitor = {
      recordMetric: vi.fn(),
    };

    mockTickerService = {
      getTicker24hr: vi.fn(),
    };

    const config: PortfolioConfig = {
      apiClient: mockApiClient,
      tickerService: mockTickerService,
      cache: mockCache,
      circuitBreaker: mockCircuitBreaker,
      performanceMonitor: mockPerformanceMonitor,
      cacheTTL: 15000,
    };

    service = new PortfolioService(config);
  });

  describe("Schema Validation", () => {
    it("should validate BalanceEntry schema correctly", () => {
      const validBalance = {
        asset: "BTC",
        free: "1.5",
        locked: "0.5",
      };

      expect(() => BalanceEntrySchema.parse(validBalance)).not.toThrow();
    });

    it("should reject invalid BalanceEntry", () => {
      const invalidBalance = {
        asset: "", // Invalid: empty string
        free: "invalid_number", // Invalid: not a number string
        locked: "0.5",
      };

      expect(() => BalanceEntrySchema.parse(invalidBalance)).toThrow();
    });

    it("should validate PortfolioMetrics schema correctly", () => {
      const validMetrics = {
        totalValue: 1000,
        totalPnl: 50,
        totalPnlPercentage: 5.5,
        topPerformers: ["BTC", "ETH"],
        worstPerformers: ["ADA"],
        assetDistribution: { BTC: 50, ETH: 30, ADA: 20 },
        riskScore: 25,
        diversificationScore: 75,
      };

      expect(() => PortfolioMetricsSchema.parse(validMetrics)).not.toThrow();
    });

    it("should validate PortfolioFilter schema with defaults", () => {
      const filter = { excludeZeroBalances: undefined }; // Should get default value
      const parsed = PortfolioFilterSchema.parse(filter);
      expect(parsed.excludeZeroBalances).toBe(true);
      expect(parsed.includeMetrics).toBe(true);
    });
  });

  describe("getPortfolio", () => {
    it("should return cached data when available", async () => {
      const cachedResponse = {
        success: true,
        data: {
          balances: [
            {
              asset: "BTC",
              free: "1.0",
              locked: "0.0",
            },
          ],
          metrics: {
            totalValue: 1000,
            totalPnl: 0,
            totalPnlPercentage: 0,
            topPerformers: [],
            worstPerformers: [],
            assetDistribution: { BTC: 100 },
            riskScore: 50,
            diversificationScore: 10,
          },
          timestamp: Date.now(),
          totalAssets: 1,
          totalValue: 1000,
        },
        cached: true,
        timestamp: Date.now(),
      };

      mockCache.get.mockResolvedValue(cachedResponse);

      const result = await service.getPortfolio();

      expect(result).toEqual(cachedResponse);
      expect(mockCache.get).toHaveBeenCalled();
      expect(mockApiClient.get).not.toHaveBeenCalled();
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith("cache_hit", 1, {
        operation: "getPortfolio",
        service: "portfolio",
      });
    });

    it("should fetch from API when cache miss", async () => {
      mockCache.get.mockResolvedValue(null);
      mockApiClient.get.mockResolvedValue({
        balances: [
          {
            asset: "BTC",
            free: "1.5",
            locked: "0.5",
          },
        ],
        updateTime: Date.now(),
      });

      const result = await service.getPortfolio();

      expect(result.success).toBe(true);
      expect(result.data.balances).toHaveLength(1);
      expect(result.data.balances[0].asset).toBe("BTC");
      expect(mockApiClient.get).toHaveBeenCalledWith("/api/v3/account");
      expect(mockCache.set).toHaveBeenCalled();
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith("cache_miss", 1, {
        operation: "getPortfolio",
        service: "portfolio",
      });
    });

    it("should handle API errors gracefully", async () => {
      mockCache.get.mockResolvedValue(null);
      mockApiClient.get.mockRejectedValue(new Error("API Error"));

      const result = await service.getPortfolio();

      expect(result.success).toBe(false);
      expect(result.error).toBe("API Error");
      expect(result.data.balances).toEqual([]);
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        "error_count",
        1,
        expect.objectContaining({ operation: "getPortfolio" })
      );
    });

    it("should exclude zero balances when filter specified", async () => {
      mockCache.get.mockResolvedValue(null);
      mockApiClient.get.mockResolvedValue({
        balances: [
          { asset: "BTC", free: "1.0", locked: "0.0" },
          { asset: "ETH", free: "0.0", locked: "0.0" }, // Zero balance
          { asset: "ADA", free: "100.0", locked: "0.0" },
        ],
      });

      const result = await service.getPortfolio({
        excludeZeroBalances: true,
        includeMetrics: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.balances).toHaveLength(2);
      expect(result.data.balances.every((b) => b.asset !== "ETH")).toBe(true);
    });

    it("should filter by specific assets", async () => {
      mockCache.get.mockResolvedValue(null);
      mockApiClient.get.mockResolvedValue({
        balances: [
          { asset: "BTC", free: "1.0", locked: "0.0" },
          { asset: "ETH", free: "10.0", locked: "0.0" },
          { asset: "ADA", free: "100.0", locked: "0.0" },
        ],
      });

      const result = await service.getPortfolio({ assets: ["BTC", "ETH"] });

      expect(result.success).toBe(true);
      expect(result.data.balances).toHaveLength(2);
      expect(result.data.balances.every((b) => ["BTC", "ETH"].includes(b.asset))).toBe(true);
    });

    it("should filter by balance range", async () => {
      mockCache.get.mockResolvedValue(null);
      mockApiClient.get.mockResolvedValue({
        balances: [
          { asset: "BTC", free: "0.5", locked: "0.0" }, // 0.5 total
          { asset: "ETH", free: "5.0", locked: "0.0" }, // 5.0 total
          { asset: "ADA", free: "50.0", locked: "0.0" }, // 50.0 total
        ],
      });

      const result = await service.getPortfolio({
        minBalance: 1,
        maxBalance: 10,
        excludeZeroBalances: false,
      });

      expect(result.success).toBe(true);
      expect(result.data.balances).toHaveLength(1);
      expect(result.data.balances[0].asset).toBe("ETH");
    });

    it("should use circuit breaker for API calls", async () => {
      mockCache.get.mockResolvedValue(null);
      mockApiClient.get.mockResolvedValue({ balances: [] });

      await service.getPortfolio();

      expect(mockCircuitBreaker.execute).toHaveBeenCalled();
    });

    it("should validate filter input using Zod", async () => {
      const invalidFilter = { minBalance: -1 }; // Invalid: negative balance

      const result = await service.getPortfolio(invalidFilter as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Number must be greater than or equal to 0");
    });
  });

  describe("getBalances", () => {
    it("should call getPortfolio with includeMetrics false", async () => {
      const spy = vi.spyOn(service, "getPortfolio");

      await service.getBalances({ excludeZeroBalances: true, includeMetrics: true });

      expect(spy).toHaveBeenCalledWith({
        excludeZeroBalances: true,
        includeMetrics: false,
      });
    });
  });

  describe("getAssetAllocation", () => {
    it("should return asset distribution from portfolio metrics", async () => {
      const mockPortfolio = {
        success: true,
        data: {
          balances: [],
          metrics: {
            totalValue: 1000,
            totalPnl: 0,
            totalPnlPercentage: 0,
            topPerformers: [],
            worstPerformers: [],
            assetDistribution: { BTC: 60, ETH: 40 },
            riskScore: 25,
            diversificationScore: 50,
          },
          timestamp: Date.now(),
          totalAssets: 2,
          totalValue: 1000,
        },
        timestamp: Date.now(),
      };

      vi.spyOn(service, "getPortfolio").mockResolvedValue(mockPortfolio);

      const result = await service.getAssetAllocation();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ BTC: 60, ETH: 40 });
    });

    it("should handle portfolio fetch failure", async () => {
      vi.spyOn(service, "getPortfolio").mockResolvedValue({
        success: false,
        data: {} as any,
        error: "Portfolio fetch failed",
        timestamp: Date.now(),
      });

      const result = await service.getAssetAllocation();

      expect(result.success).toBe(false);
      expect(result.data).toEqual({});
      expect(result.error).toBe("Portfolio fetch failed");
    });
  });

  describe("getPerformanceSummary", () => {
    it("should return performance metrics summary", async () => {
      const mockPortfolio = {
        success: true,
        data: {
          balances: [],
          metrics: {
            totalValue: 1000,
            totalPnl: 50,
            totalPnlPercentage: 5.0,
            topPerformers: ["BTC"],
            worstPerformers: ["ADA"],
            assetDistribution: { BTC: 100 },
            riskScore: 30,
            diversificationScore: 70,
          },
          timestamp: Date.now(),
          totalAssets: 1,
          totalValue: 1000,
        },
        timestamp: Date.now(),
      };

      vi.spyOn(service, "getPortfolio").mockResolvedValue(mockPortfolio);

      const result = await service.getPerformanceSummary();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        totalValue: 1000,
        totalPnl: 50,
        totalPnlPercentage: 5.0,
        riskScore: 30,
        diversificationScore: 70,
      });
    });

    it("should handle errors gracefully", async () => {
      vi.spyOn(service, "getPortfolio").mockRejectedValue(new Error("Service Error"));

      const result = await service.getPerformanceSummary();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Service Error");
      expect(result.data).toEqual({
        totalValue: 0,
        totalPnl: 0,
        totalPnlPercentage: 0,
        riskScore: 0,
        diversificationScore: 0,
      });
    });
  });

  describe("clearCache", () => {
    it("should clear common cache patterns", async () => {
      await service.clearCache();

      expect(mockCache.set).toHaveBeenCalledTimes(4);
      expect(mockCache.set).toHaveBeenCalledWith(expect.any(String), null, 0);
    });

    it("should handle missing cache gracefully", async () => {
      const serviceWithoutCache = new PortfolioService({
        apiClient: mockApiClient,
      });

      await expect(serviceWithoutCache.clearCache()).resolves.toBeUndefined();
    });
  });

  describe("Factory Function", () => {
    it("should create service instance using factory", () => {
      const config: PortfolioConfig = {
        apiClient: mockApiClient,
      };

      const createdService = createPortfolioService(config);

      expect(createdService).toBeInstanceOf(PortfolioService);
    });
  });

  describe("Performance Monitoring", () => {
    it("should record response time metrics", async () => {
      mockCache.get.mockResolvedValue(null);
      mockApiClient.get.mockResolvedValue({ balances: [] });

      await service.getPortfolio();

      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        "response_time",
        expect.any(Number),
        { operation: "getPortfolio", service: "portfolio" }
      );
    });

    it("should record cache hit metrics", async () => {
      mockCache.get.mockResolvedValue({
        success: true,
        data: {
          balances: [],
          metrics: {
            totalValue: 0,
            totalPnl: 0,
            totalPnlPercentage: 0,
            topPerformers: [],
            worstPerformers: [],
            assetDistribution: {},
            riskScore: 0,
            diversificationScore: 0,
          },
          timestamp: Date.now(),
          totalAssets: 0,
          totalValue: 0,
        },
        cached: true,
      });

      await service.getPortfolio();

      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith("cache_hit", 1, {
        operation: "getPortfolio",
        service: "portfolio",
      });
    });
  });

  describe("Error Handling", () => {
    it("should convert errors to safe error objects", async () => {
      mockCache.get.mockResolvedValue(null);
      const customError = new Error("Custom Portfolio Error");
      customError.name = "PortfolioError";
      mockApiClient.get.mockRejectedValue(customError);

      const result = await service.getPortfolio();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Custom Portfolio Error");
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        "error_count",
        1,
        expect.objectContaining({ error: "PortfolioError" })
      );
    });
  });

  describe("Portfolio Metrics Calculation", () => {
    it("should calculate asset distribution correctly", async () => {
      mockCache.get.mockResolvedValue(null);
      mockApiClient.get.mockResolvedValue({
        balances: [
          { asset: "BTC", free: "1.0", locked: "0.0" }, // 1.0 total
          { asset: "ETH", free: "2.0", locked: "1.0" }, // 3.0 total
          { asset: "ADA", free: "6.0", locked: "0.0" }, // 6.0 total
        ],
      });

      const result = await service.getPortfolio({ includeMetrics: true });

      expect(result.success).toBe(true);
      expect(result.data.metrics.assetDistribution).toEqual({
        BTC: 10, // 1/10 * 100
        ETH: 30, // 3/10 * 100
        ADA: 60, // 6/10 * 100
      });
    });

    it("should calculate diversification score based on asset count", async () => {
      mockCache.get.mockResolvedValue(null);
      mockApiClient.get.mockResolvedValue({
        balances: [
          { asset: "BTC", free: "1.0", locked: "0.0" },
          { asset: "ETH", free: "1.0", locked: "0.0" },
          { asset: "ADA", free: "1.0", locked: "0.0" },
        ],
      });

      const result = await service.getPortfolio({ includeMetrics: true });

      expect(result.success).toBe(true);
      expect(result.data.metrics.diversificationScore).toBe(30); // 3 assets * 10
      expect(result.data.metrics.riskScore).toBe(70); // 100 - 30
    });

    it("should handle empty balances gracefully", async () => {
      mockCache.get.mockResolvedValue(null);
      mockApiClient.get.mockResolvedValue({
        balances: [],
      });

      const result = await service.getPortfolio({ includeMetrics: true });

      expect(result.success).toBe(true);
      expect(result.data.metrics.totalValue).toBe(0);
      expect(result.data.metrics.assetDistribution).toEqual({});
      expect(result.data.totalAssets).toBe(0);
    });
  });
});
