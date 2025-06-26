/**
 * MEXC Core Client Tests
 *
 * Comprehensive test suite for the modular MEXC core client.
 * Tests are focused on specific functionality without complexity.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MexcApiConfig } from "./mexc-api-types";
import { createMexcCoreClient, MexcCoreClient } from "./mexc-core-client";

// ============================================================================
// Test Configuration
// ============================================================================

const TEST_CONFIG: MexcApiConfig = {
  apiKey: "test-api-key",
  secretKey: "test-secret-key",
  passphrase: "test-passphrase",
  baseUrl: "https://api.mexc.com",
  timeout: 5000,
  maxRetries: 2,
  retryDelay: 100,
  rateLimitDelay: 50,
};

// ============================================================================
// Mock Utilities
// ============================================================================

const createMockResponse = (data: any, status = 200) => {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response);
};

// ============================================================================
// Test Suite
// ============================================================================

describe("MexcCoreClient", () => {
  let client: MexcCoreClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock Node.js environment by removing window object
    Object.defineProperty(global, "window", {
      value: undefined,
      writable: true,
    });

    client = new MexcCoreClient(TEST_CONFIG);
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Constructor Tests
  // ============================================================================

  describe("Constructor", () => {
    it("should create client with provided config", () => {
      expect(client).toBeInstanceOf(MexcCoreClient);
    });

    it("should create client using factory function", () => {
      const factoryClient = createMexcCoreClient(TEST_CONFIG);
      expect(factoryClient).toBeInstanceOf(MexcCoreClient);
    });
  });

  // ============================================================================
  // Calendar API Tests
  // ============================================================================

  describe("Calendar API", () => {
    it("should get calendar listings successfully", async () => {
      const mockData = {
        data: {
          newCoins: [
            {
              vcoinId: "BTC123",
              vcoinName: "Bitcoin Test",
              vcoinNameFull: "Bitcoin Test Coin",
              firstOpenTime: "2024-01-01T00:00:00Z",
              zone: "Innovation",
            },
          ],
        },
      };

      mockFetch.mockResolvedValue(createMockResponse(mockData));

      const result = await client.getCalendarListings();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].vcoinId).toBe("BTC123");
      expect(result.source).toBe("mexc-core-client");
    });

    it("should handle calendar API errors", async () => {
      mockFetch.mockResolvedValue(createMockResponse({}, 500));

      const result = await client.getCalendarListings();

      expect(result.success).toBe(false);
      expect(result.error).toContain("HTTP 500");
    });

    it("should handle invalid calendar response format", async () => {
      mockFetch.mockResolvedValue(createMockResponse({ data: {} }));

      const result = await client.getCalendarListings();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid calendar response format");
    });
  });

  // ============================================================================
  // Symbols API Tests
  // ============================================================================

  describe("Symbols API", () => {
    it("should get symbols by vcoin ID successfully", async () => {
      const mockData = {
        data: {
          symbols: [
            {
              symbol: "BTCUSDT",
              baseAsset: "BTC",
              quoteAsset: "USDT",
              status: "TRADING",
              baseAssetPrecision: 8,
              quotePrecision: 2,
              orderTypes: ["LIMIT", "MARKET"],
              filters: [],
            },
          ],
        },
      };

      mockFetch.mockResolvedValue(createMockResponse(mockData));

      const result = await client.getSymbolsByVcoinId("BTC");

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].symbol).toBe("BTCUSDT");
      expect(result.data![0].baseAsset).toBe("BTC");
    });

    it("should filter symbols correctly", async () => {
      const mockData = {
        data: {
          symbols: [
            { symbol: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USDT" },
            { symbol: "ETHUSDT", baseAsset: "ETH", quoteAsset: "USDT" },
            { symbol: "BTCETH", baseAsset: "BTC", quoteAsset: "ETH" },
          ],
        },
      };

      mockFetch.mockResolvedValue(createMockResponse(mockData));

      const result = await client.getSymbolsByVcoinId("BTC");

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2); // BTCUSDT and BTCETH
    });
  });

  // ============================================================================
  // Account API Tests
  // ============================================================================

  describe("Account API", () => {
    it("should get account balance successfully", async () => {
      const mockData = {
        data: {
          balances: [
            { asset: "BTC", free: "1.00000000", locked: "0.00000000" },
            { asset: "USDT", free: "1000.00000000", locked: "0.00000000" },
            { asset: "ETH", free: "0.00000000", locked: "0.00000000" }, // Should be filtered out
          ],
        },
      };

      mockFetch.mockResolvedValue(createMockResponse(mockData));

      const result = await client.getAccountBalance();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2); // Only BTC and USDT (ETH filtered out)
      expect(result.data![0].asset).toBe("BTC");
      expect(result.data![1].asset).toBe("USDT");
    });
  });

  // ============================================================================
  // Server Time API Tests
  // ============================================================================

  describe("Server Time API", () => {
    it("should get server time successfully", async () => {
      const mockServerTime = Date.now();
      const mockData = { data: { serverTime: mockServerTime } };

      mockFetch.mockResolvedValue(createMockResponse(mockData));

      const result = await client.getServerTime();

      expect(result.success).toBe(true);
      expect(result.data).toBe(mockServerTime);
    });

    it("should handle invalid server time response", async () => {
      mockFetch.mockResolvedValue(createMockResponse({ data: {} }));

      const result = await client.getServerTime();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid server time response");
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe("Error Handling", () => {
    it("should handle network errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await client.getServerTime();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("should handle timeout errors", async () => {
      mockFetch.mockRejectedValue(new Error("The operation was aborted"));

      const result = await client.getCalendarListings();

      expect(result.success).toBe(false);
      expect(result.error).toContain("aborted");
    });

    it("should handle unknown errors", async () => {
      mockFetch.mockRejectedValue("Unknown error type");

      const result = await client.getAccountBalance();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error");
    });
  });

  // ============================================================================
  // Request Headers Tests
  // ============================================================================

  describe("Request Headers", () => {
    it("should include correct headers for regular requests", async () => {
      mockFetch.mockResolvedValue(createMockResponse({ data: { serverTime: Date.now() } }));

      await client.getServerTime();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "User-Agent": "MEXC-Sniper-Bot/2.0",
          }),
        })
      );
    });

    it("should include auth headers for authenticated requests", async () => {
      mockFetch.mockResolvedValue(createMockResponse({ data: { balances: [] } }));

      await client.getAccountBalance();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-MEXC-APIKEY": TEST_CONFIG.apiKey,
          }),
        })
      );
    });
  });
});
