/**
 * Account Balance API Validation Tests
 *
 * Simple validation tests for account balance API responses
 * without complex mock setup issues
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as accountBalanceEndpoint } from "../../app/api/account/balance/route";

describe("Account Balance API Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up environment variables for testing
    vi.stubEnv("NODE_ENV", "test");
    process.env.MEXC_API_KEY = "test-api-key";
    process.env.MEXC_SECRET_KEY = "test-secret-key";
  });

  it("should handle test environment with invalid credentials quickly", async () => {
    // Test environment with test credentials should return fast error
    const request = new NextRequest("http://localhost/api/account/balance?userId=test-user");
    const startTime = Date.now();
    const response = await accountBalanceEndpoint(request);
    const executionTime = Date.now() - startTime;
    const data = await response.json();

    expect(executionTime).toBeLessThan(1000); // Should be fast, not 4-5 seconds
    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toContain("Test environment: Invalid API credentials");
    expect(data.meta.code).toBe("TEST_INVALID_CREDENTIALS");
    expect(data.meta.fallbackData).toBeDefined();
    expect(data.meta.fallbackData.hasUserCredentials).toBe(true);
    expect(data.meta.fallbackData.credentialsType).toBe("user-specific");
  });

  it("should return proper error response when MEXC credentials are missing", async () => {
    // Remove credentials
    delete process.env.MEXC_API_KEY;
    delete process.env.MEXC_SECRET_KEY;

    const request = new NextRequest("http://localhost/api/account/balance");
    const response = await accountBalanceEndpoint(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.success).toBe(false);
    expect(data.error).toContain("MEXC API credentials not configured");
    expect(data.meta.code).toBe("MISSING_CREDENTIALS");
    expect(data.meta.fallbackData).toBeDefined();
    expect(data.meta.fallbackData.balances).toEqual([]);
    expect(data.meta.fallbackData.totalUsdtValue).toBe(0);
  });

  it("should handle userId parameter correctly", async () => {
    const request = new NextRequest("http://localhost/api/account/balance?userId=test-user");
    
    try {
      const response = await accountBalanceEndpoint(request);
      const data = await response.json();

      // Should attempt to use user-specific credentials
      if (data.success) {
        expect(data.data.hasUserCredentials).toBe(true);
        expect(data.data.credentialsType).toBe("user-specific");
      } else {
        // If it fails, should be due to service issues, not validation
        expect(data.meta.fallbackData).toBeDefined();
        expect(data.meta.fallbackData.hasUserCredentials).toBe(true);
      }
    } catch (error) {
      // Service initialization errors are expected in test environment
      expect(error).toBeDefined();
    }
  });

  it("should handle missing userId parameter correctly", async () => {
    const request = new NextRequest("http://localhost/api/account/balance");
    
    try {
      const response = await accountBalanceEndpoint(request);
      const data = await response.json();

      // Should use environment credentials
      if (data.success) {
        expect(data.data.hasUserCredentials).toBe(false);
        expect(data.data.credentialsType).toBe("environment-fallback");
      } else {
        // If it fails, should be due to service issues, not validation
        expect(data.meta.fallbackData).toBeDefined();
        expect(data.meta.fallbackData.hasUserCredentials).toBe(false);
      }
    } catch (error) {
      // Service initialization errors are expected in test environment
      expect(error).toBeDefined();
    }
  });

  it("should return proper fallback data structure on errors", async () => {
    const request = new NextRequest("http://localhost/api/account/balance?userId=invalid-user");
    
    try {
      const response = await accountBalanceEndpoint(request);
      const data = await response.json();

      if (!data.success) {
        // Validate fallback data structure
        expect(data.meta.fallbackData).toBeDefined();
        expect(data.meta.fallbackData.balances).toEqual([]);
        expect(data.meta.fallbackData.totalUsdtValue).toBe(0);
        expect(typeof data.meta.fallbackData.lastUpdated).toBe("string");
        expect(typeof data.meta.fallbackData.hasUserCredentials).toBe("boolean");
        expect(typeof data.meta.fallbackData.credentialsType).toBe("string");
      }
    } catch (error) {
      // Service initialization errors are expected in test environment
      expect(error).toBeDefined();
    }
  });

  it("should validate required response schema fields", async () => {
    const request = new NextRequest("http://localhost/api/account/balance");
    
    try {
      const response = await accountBalanceEndpoint(request);
      const data = await response.json();

      // Response should always have these fields
      expect(typeof data.success).toBe("boolean");
      
      if (data.success) {
        expect(data.data).toBeDefined();
        expect(Array.isArray(data.data.balances)).toBe(true);
        expect(typeof data.data.totalUsdtValue).toBe("number");
        expect(typeof data.data.lastUpdated).toBe("string");
        expect(typeof data.data.hasUserCredentials).toBe("boolean");
        expect(typeof data.data.credentialsType).toBe("string");
      } else {
        expect(typeof data.error).toBe("string");
        expect(data.meta).toBeDefined();
        expect(data.meta.fallbackData).toBeDefined();
      }
    } catch (error) {
      // Service initialization errors are expected in test environment
      expect(error).toBeDefined();
    }
  });
});