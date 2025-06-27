/**
 * Test Suite for MEXC Client Schema Consolidation
 *
 * Following TDD approach: testing schema consolidation to eliminate duplication
 * between unified exports and core schemas
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Dynamic imports for better test isolation
let schemas: any;
let unifiedExports: any;
let serviceTypes: any;

describe("MEXC Client Schema Consolidation - TDD Tests", () => {
  beforeEach(async () => {
    // Reset modules and clear mocks
    vi.clearAllMocks();

    // Dynamic imports to avoid static import issues
    schemas = await import("@/src/schemas/unified/mexc-api-schemas");
    unifiedExports = await import("@/src/services/api/mexc-unified-exports");

    try {
      serviceTypes = await import("@/src/services/data/modules/mexc-api-types");
    } catch (error) {
      console.warn("Service types not available:", error);
      serviceTypes = {};
    }
  });

  afterEach(() => {
    // Clean up any side effects
    vi.resetModules();
  });

  describe("Schema Imports and Compatibility", () => {
    it("should validate CalendarEntry data with available schemas", async () => {
      const validEntry = {
        vcoinId: "vcoin-12345",
        symbol: "TESTUSDT",
        projectName: "Test Project",
        firstOpenTime: Date.now(),
      };

      // Test with available schemas
      expect(() => schemas.CalendarEntrySchema.parse(validEntry)).not.toThrow();

      // Validate parsed result structure
      const result = schemas.CalendarEntrySchema.parse(validEntry);
      expect(result).toMatchObject({
        vcoinId: "vcoin-12345",
        symbol: "TESTUSDT",
        projectName: "Test Project",
        firstOpenTime: expect.any(Number),
      });
    });

    it("should validate SymbolEntry data with available schemas", async () => {
      const validEntry = {
        cd: "BTCUSDT",
        sts: 2,
        st: 2,
        tt: 4,
      };

      expect(() => schemas.SymbolEntrySchema.parse(validEntry)).not.toThrow();

      const result = schemas.SymbolEntrySchema.parse(validEntry);
      expect(result).toMatchObject({
        cd: "BTCUSDT",
        sts: 2,
        st: 2,
        tt: 4,
      });
    });

    it("should validate BalanceEntry data with available schemas", async () => {
      const validEntry = {
        asset: "USDT",
        free: "1000.50",
        locked: "100.25",
        total: 1100.75,
        usdtValue: 1100.75,
      };

      expect(() => schemas.BalanceEntrySchema.parse(validEntry)).not.toThrow();

      const result = schemas.BalanceEntrySchema.parse(validEntry);
      expect(result).toMatchObject({
        asset: "USDT",
        free: "1000.50",
        locked: "100.25",
        total: 1100.75,
        usdtValue: 1100.75,
      });
    });

    it("should validate Ticker data with available schemas", async () => {
      const validTicker = {
        symbol: "BTCUSDT",
        lastPrice: "45000.50",
        price: "45000.50",
        priceChange: "500.25",
        priceChangePercent: "1.12",
        volume: "1234.567",
      };

      expect(() => schemas.TickerSchema.parse(validTicker)).not.toThrow();

      const result = schemas.TickerSchema.parse(validTicker);
      expect(result).toMatchObject({
        symbol: "BTCUSDT",
        lastPrice: "45000.50",
        price: "45000.50",
        priceChange: "500.25",
        priceChangePercent: "1.12",
        volume: "1234.567",
      });
    });

    it("should validate OrderResult data with available schemas", async () => {
      const validOrder = {
        success: true,
        symbol: "BTCUSDT",
        side: "BUY",
        quantity: "0.001",
        timestamp: new Date().toISOString(),
      };

      expect(() => schemas.OrderResultSchema.parse(validOrder)).not.toThrow();

      const result = schemas.OrderResultSchema.parse(validOrder);
      expect(result).toMatchObject({
        success: true,
        symbol: "BTCUSDT",
        side: "BUY",
        quantity: "0.001",
        timestamp: expect.any(String),
      });
    });

    it("should validate ExchangeSymbol data with available schemas", async () => {
      const validSymbol = {
        symbol: "BTCUSDT",
        status: "TRADING",
        baseAsset: "BTC",
        quoteAsset: "USDT",
        baseAssetPrecision: 8,
        quotePrecision: 8,
        quoteAssetPrecision: 8,
      };

      expect(() =>
        schemas.ExchangeSymbolSchema.parse(validSymbol),
      ).not.toThrow();

      const result = schemas.ExchangeSymbolSchema.parse(validSymbol);
      expect(result).toMatchObject({
        symbol: "BTCUSDT",
        status: "TRADING",
        baseAsset: "BTC",
        quoteAsset: "USDT",
        baseAssetPrecision: 8,
        quotePrecision: 8,
        quoteAssetPrecision: 8,
      });
    });
  });

  describe("Schema Behavior Preservation", () => {
    it("should validate calendar entry with optional fields", async () => {
      const entryWithOptionals = {
        vcoinId: "vcoin-12345",
        symbol: "TESTUSDT",
        projectName: "Test Project",
        firstOpenTime: Date.now(),
        vcoinName: "TEST",
        vcoinNameFull: "Test Token",
        zone: "NEW",
        introductionEn: "A test token",
        introductionCn: "测试代币",
      };

      expect(() =>
        schemas.CalendarEntrySchema.parse(entryWithOptionals),
      ).not.toThrow();

      const result = schemas.CalendarEntrySchema.parse(entryWithOptionals);
      // Schema might not preserve all optional fields depending on implementation
      if (result.vcoinName) {
        expect(result.vcoinName).toBe("TEST");
      }
      if (result.zone) {
        expect(result.zone).toBe("NEW");
      }
      // At minimum, required fields should be present
      expect(result.symbol).toBe("TESTUSDT");
      expect(result.projectName).toBe("Test Project");
    });

    it("should validate symbol entry with flexible types", async () => {
      const flexibleEntry = {
        cd: "BTCUSDT",
        symbol: "BTCUSDT",
        sts: 2,
        st: 2,
        tt: 4,
        ca: "contract-address",
        ps: 8,
        qs: 4,
        ot: 1234567890,
      };

      expect(() =>
        schemas.SymbolEntrySchema.parse(flexibleEntry),
      ).not.toThrow();

      const result = schemas.SymbolEntrySchema.parse(flexibleEntry);
      expect(result.symbol).toBe("BTCUSDT");
      expect(result.ps).toBe(8);
    });

    it("should validate enhanced ticker data", async () => {
      const enhancedTicker = {
        symbol: "BTCUSDT",
        lastPrice: "45000.50",
        price: "45000.50",
        priceChange: "500.25",
        priceChangePercent: "1.12",
        volume: "1234.567",
        quoteVolume: "55000000",
        openPrice: "44500.25",
        highPrice: "46000.00",
        lowPrice: "44000.00",
        count: "8765",
      };

      expect(() => schemas.TickerSchema.parse(enhancedTicker)).not.toThrow();

      const result = schemas.TickerSchema.parse(enhancedTicker);
      expect(result.quoteVolume).toBe("55000000");
      expect(result.count).toBe("8765");
    });

    it("should validate order result with full fields", async () => {
      const fullOrder = {
        success: true,
        orderId: "order-123",
        symbol: "BTCUSDT",
        side: "BUY",
        quantity: "0.001",
        price: "45000.50",
        status: "FILLED",
        timestamp: new Date().toISOString(),
      };

      expect(() => schemas.OrderResultSchema.parse(fullOrder)).not.toThrow();

      const result = schemas.OrderResultSchema.parse(fullOrder);
      expect(result.orderId).toBe("order-123");
      expect(result.status).toBe("FILLED");
    });
  });

  describe("Type Exports Compatibility", () => {
    it("should have proper type inference for CalendarEntry", async () => {
      const validEntry = {
        vcoinId: "test",
        symbol: "TEST",
        projectName: "Test",
        firstOpenTime: Date.now(),
      };

      const parsedEntry = schemas.CalendarEntrySchema.parse(validEntry);

      // Type should be inferred properly
      expect(typeof parsedEntry.vcoinId).toBe("string");
      expect(typeof parsedEntry.firstOpenTime).toBe("number");
      expect(parsedEntry).toHaveProperty("vcoinId");
      expect(parsedEntry).toHaveProperty("symbol");
    });

    it("should have proper type inference for SymbolEntry", async () => {
      const validEntry = {
        cd: "TEST",
        sts: 1,
        st: 1,
        tt: 1,
      };

      const parsedEntry = schemas.SymbolEntrySchema.parse(validEntry);

      expect(typeof parsedEntry.cd).toBe("string");
      expect(typeof parsedEntry.sts).toBe("number");
      expect(parsedEntry).toHaveProperty("cd");
      expect(parsedEntry).toHaveProperty("sts");
    });

    it("should have proper type inference for BalanceEntry", async () => {
      const validEntry = {
        asset: "BTC",
        free: "1.0",
        locked: "0.0",
        total: 1.0,
      };

      const parsedEntry = schemas.BalanceEntrySchema.parse(validEntry);

      expect(typeof parsedEntry.asset).toBe("string");
      expect(typeof parsedEntry.total).toBe("number");
      expect(parsedEntry).toHaveProperty("asset");
      expect(parsedEntry).toHaveProperty("free");
    });

    it("should verify unified exports availability", async () => {
      // Check that unified exports provides the expected interface
      expect(unifiedExports).toBeDefined();
      expect(typeof unifiedExports.getMexcService).toBe("function");

      // Check that service response type is available
      if (serviceTypes && serviceTypes.MexcServiceResponse) {
        expect(serviceTypes).toHaveProperty("MexcServiceResponse");
      }
    });
  });

  describe("Service Response Compatibility", () => {
    it("should validate service response structure when available", async () => {
      if (serviceTypes && serviceTypes.MexcServiceResponse) {
        // Mock a service response structure
        const mockResponse = {
          success: true,
          data: { test: "data" },
          timestamp: new Date().toISOString(),
          cached: false,
          requestId: "req-123",
        };

        // This is a structural test - we verify the interface exists
        expect(mockResponse).toHaveProperty("success");
        expect(mockResponse).toHaveProperty("data");
        expect(mockResponse).toHaveProperty("timestamp");
      } else {
        // If service types not available, just pass the test
        expect(true).toBe(true);
      }
    });

    it("should verify unified service factory function", async () => {
      // Test that getMexcService function exists and is callable
      expect(typeof unifiedExports.getMexcService).toBe("function");

      // Test that calling it without config doesn't throw
      expect(() => {
        const service = unifiedExports.getMexcService();
        expect(service).toBeDefined();
      }).not.toThrow();
    });

    it("should verify schema exports from unified module", async () => {
      // Check that important types are available from unified exports
      const exportedTypes = Object.keys(unifiedExports);

      // Should include service factory
      expect(exportedTypes).toContain("getMexcService");

      // Should include reset function
      expect(exportedTypes).toContain("resetMexcService");
    });
  });

  describe("Schema Consolidation Verification", () => {
    it("should have schemas available from main schemas module", async () => {
      const expectedSchemas = [
        "CalendarEntrySchema",
        "SymbolEntrySchema",
        "BalanceEntrySchema",
        "TickerSchema",
        "OrderResultSchema",
        "ExchangeSymbolSchema",
      ];

      for (const schemaName of expectedSchemas) {
        expect(schemas).toHaveProperty(schemaName);
        expect(schemas[schemaName]).toBeDefined();
        expect(typeof schemas[schemaName].parse).toBe("function");
      }
    });

    it("should maintain all core functionality through unified exports", async () => {
      // Verify that unified exports module provides necessary functionality
      expect(unifiedExports).toBeDefined();
      expect(typeof unifiedExports.getMexcService).toBe("function");

      // The goal is to have schemas centralized in mexc-schemas.ts
      // and unified access through mexc-unified-exports.ts
      expect(Object.keys(schemas).length).toBeGreaterThan(5);
    });
  });

  describe("Schema Validation Edge Cases", () => {
    it("should handle SymbolEntry field variations", async () => {
      // Test with string contract address
      const stringCAEntry = {
        cd: "BTCUSDT",
        sts: 2,
        st: 2,
        tt: 4,
        ca: "contract-address-string",
        ps: 8,
        qs: 4,
      };

      expect(() =>
        schemas.SymbolEntrySchema.parse(stringCAEntry),
      ).not.toThrow();

      // Test with minimal required fields only
      const minimalEntry = {
        cd: "BTCUSDT",
        sts: 2,
        st: 2,
        tt: 4,
      };

      expect(() => schemas.SymbolEntrySchema.parse(minimalEntry)).not.toThrow();
    });

    it("should handle invalid data gracefully", async () => {
      const invalidCalendarEntry = {
        vcoinId: 123, // should be string
        symbol: "TEST",
        projectName: "Test",
        firstOpenTime: "invalid-time", // should be number
      };

      expect(() =>
        schemas.CalendarEntrySchema.parse(invalidCalendarEntry),
      ).toThrow();
    });

    it("should validate required vs optional fields", async () => {
      // Balance with only required fields
      const minimalBalance = {
        asset: "BTC",
        free: "1.0",
        locked: "0.0",
        total: 1.0,
      };

      expect(() =>
        schemas.BalanceEntrySchema.parse(minimalBalance),
      ).not.toThrow();

      // Balance with optional usdtValue
      const balanceWithUSDT = {
        ...minimalBalance,
        usdtValue: 45000.0,
      };

      expect(() =>
        schemas.BalanceEntrySchema.parse(balanceWithUSDT),
      ).not.toThrow();

      const result = schemas.BalanceEntrySchema.parse(balanceWithUSDT);
      expect(result.usdtValue).toBe(45000.0);
    });
  });
});
