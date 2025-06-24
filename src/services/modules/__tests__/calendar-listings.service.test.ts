/**
 * Calendar Listings Service Tests
 *
 * TDD tests for the modular calendar listings service
 */

import { beforeEach, describe, expect, it, type MockedFunction, vi } from "vitest";
import {
  CalendarEntrySchema,
  CalendarFilterSchema,
  type CalendarListingsConfig,
  CalendarListingsResponseSchema,
  CalendarListingsService,
  createCalendarListingsService,
} from "../calendar-listings.service";

describe("CalendarListingsService", () => {
  let service: CalendarListingsService;
  let mockApiClient: any;
  let mockCache: any;
  let mockCircuitBreaker: any;
  let mockPerformanceMonitor: any;

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

    const config: CalendarListingsConfig = {
      apiClient: mockApiClient,
      cache: mockCache,
      circuitBreaker: mockCircuitBreaker,
      performanceMonitor: mockPerformanceMonitor,
      cacheTTL: 30000,
    };

    service = new CalendarListingsService(config);
  });

  describe("Schema Validation", () => {
    it("should validate CalendarEntry schema correctly", () => {
      const validEntry = {
        symbol: "BTCUSDT",
        baseAsset: "BTC",
        quoteAsset: "USDT",
        tradingStartTime: Date.now(),
        status: "TRADING" as const,
      };

      expect(() => CalendarEntrySchema.parse(validEntry)).not.toThrow();
    });

    it("should reject invalid CalendarEntry", () => {
      const invalidEntry = {
        symbol: "", // Invalid: empty string
        baseAsset: "BTC",
        quoteAsset: "USDT",
        tradingStartTime: -1, // Invalid: negative timestamp
        status: "INVALID_STATUS",
      };

      expect(() => CalendarEntrySchema.parse(invalidEntry)).toThrow();
    });

    it("should validate CalendarFilter schema with defaults", () => {
      const filter = { limit: undefined }; // Should get default value
      const parsed = CalendarFilterSchema.parse(filter);
      expect(parsed.limit).toBe(100);
    });
  });

  describe("getListings", () => {
    it("should return cached data when available", async () => {
      const cachedResponse = {
        success: true,
        data: [
          {
            symbol: "BTCUSDT",
            baseAsset: "BTC",
            quoteAsset: "USDT",
            tradingStartTime: Date.now(),
            status: "TRADING" as const,
          },
        ],
        cached: true,
        timestamp: Date.now(),
      };

      mockCache.get.mockResolvedValue(cachedResponse);

      const result = await service.getListings();

      expect(result).toEqual(cachedResponse);
      expect(mockCache.get).toHaveBeenCalled();
      expect(mockApiClient.get).not.toHaveBeenCalled();
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith("cache_hit", 1, {
        operation: "getListings",
        service: "calendar-listings",
      });
    });

    it("should fetch from API when cache miss", async () => {
      mockCache.get.mockResolvedValue(null);
      mockApiClient.get.mockResolvedValue({
        symbols: [
          {
            symbol: "BTCUSDT",
            baseAsset: "BTC",
            quoteAsset: "USDT",
            status: "TRADING",
            quotePrecision: 2,
            baseAssetPrecision: 8,
          },
        ],
      });

      const result = await service.getListings();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].symbol).toBe("BTCUSDT");
      expect(mockApiClient.get).toHaveBeenCalledWith("/api/v3/exchangeInfo", {});
      expect(mockCache.set).toHaveBeenCalled();
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith("cache_miss", 1, {
        operation: "getListings",
        service: "calendar-listings",
      });
    });

    it("should handle API errors gracefully", async () => {
      mockCache.get.mockResolvedValue(null);
      mockApiClient.get.mockRejectedValue(new Error("API Error"));

      const result = await service.getListings();

      expect(result.success).toBe(false);
      expect(result.error).toBe("API Error");
      expect(result.data).toEqual([]);
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        "error_count",
        1,
        expect.objectContaining({ operation: "getListings" })
      );
    });

    it("should validate filter input using Zod", async () => {
      const invalidFilter = { limit: -1 }; // Invalid: negative limit

      const result = await service.getListings(invalidFilter as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Number must be greater than 0");
    });

    it("should use circuit breaker for API calls", async () => {
      mockCache.get.mockResolvedValue(null);
      mockApiClient.get.mockResolvedValue({ symbols: [] });

      await service.getListings();

      expect(mockCircuitBreaker.execute).toHaveBeenCalled();
    });
  });

  describe("getActivePairs", () => {
    it("should filter for TRADING status only", async () => {
      const spy = vi.spyOn(service, "getListings");

      await service.getActivePairs();

      expect(spy).toHaveBeenCalledWith({ status: "TRADING" });
    });
  });

  describe("getUpcomingListings", () => {
    it("should filter for PENDING status with future timestamp", async () => {
      const spy = vi.spyOn(service, "getListings");
      const beforeCall = Date.now();

      await service.getUpcomingListings();

      expect(spy).toHaveBeenCalledWith({
        status: "PENDING",
        fromTime: expect.any(Number),
        limit: 50,
      });

      const callArgs = spy.mock.calls[0][0];
      expect(callArgs?.fromTime).toBeGreaterThanOrEqual(beforeCall);
    });
  });

  describe("getBySymbol", () => {
    it("should return specific symbol data", async () => {
      const mockData = [
        {
          symbol: "BTCUSDT",
          baseAsset: "BTC",
          quoteAsset: "USDT",
          tradingStartTime: Date.now(),
          status: "TRADING" as const,
        },
      ];

      vi.spyOn(service, "getListings").mockResolvedValue({
        success: true,
        data: mockData,
        timestamp: Date.now(),
      });

      const result = await service.getBySymbol("BTCUSDT");

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].symbol).toBe("BTCUSDT");
    });

    it("should handle invalid symbol input", async () => {
      const result = await service.getBySymbol("");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid symbol provided");
      expect(result.data).toEqual([]);
    });

    it("should return empty array for non-existent symbol", async () => {
      vi.spyOn(service, "getListings").mockResolvedValue({
        success: true,
        data: [],
        timestamp: Date.now(),
      });

      const result = await service.getBySymbol("NONEXISTENT");

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe("clearCache", () => {
    it("should clear multiple cache keys", async () => {
      await service.clearCache();

      expect(mockCache.set).toHaveBeenCalledTimes(3);
      expect(mockCache.set).toHaveBeenCalledWith(expect.any(String), null, 0);
    });

    it("should handle missing cache gracefully", async () => {
      const serviceWithoutCache = new CalendarListingsService({
        apiClient: mockApiClient,
      });

      await expect(serviceWithoutCache.clearCache()).resolves.toBeUndefined();
    });
  });

  describe("Factory Function", () => {
    it("should create service instance using factory", () => {
      const config: CalendarListingsConfig = {
        apiClient: mockApiClient,
      };

      const createdService = createCalendarListingsService(config);

      expect(createdService).toBeInstanceOf(CalendarListingsService);
    });
  });

  describe("Performance Monitoring", () => {
    it("should record response time metrics", async () => {
      mockCache.get.mockResolvedValue(null);
      mockApiClient.get.mockResolvedValue({ symbols: [] });

      await service.getListings();

      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        "response_time",
        expect.any(Number),
        { operation: "getListings", service: "calendar-listings" }
      );
    });

    it("should record cache hit/miss metrics", async () => {
      // Test cache hit
      mockCache.get.mockResolvedValue({
        success: true,
        data: [],
        cached: true,
      });

      await service.getListings();

      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith("cache_hit", 1, {
        operation: "getListings",
        service: "calendar-listings",
      });
    });
  });

  describe("Error Handling", () => {
    it("should convert errors to safe error objects", async () => {
      mockCache.get.mockResolvedValue(null);
      const customError = new Error("Custom API Error");
      customError.name = "CustomError";
      mockApiClient.get.mockRejectedValue(customError);

      const result = await service.getListings();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Custom API Error");
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith(
        "error_count",
        1,
        expect.objectContaining({ error: "CustomError" })
      );
    });
  });
});
