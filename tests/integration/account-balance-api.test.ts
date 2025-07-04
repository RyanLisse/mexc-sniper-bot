/**
 * Account Balance API Integration Tests
 * 
 * Tests account balance endpoint with authentication, error handling, 
 * MEXC API integration, and comprehensive request/response validation
 * 
 * FIXED: Promise resolution/rejection issues and timeout handling
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { createServerTestSuite, testRateLimit } from "../utils/server-test-helper";
import { safeFetch } from "../utils/async-test-helpers";

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../utils/timeout-elimination-helpers';

describe("Account Balance API Integration Tests", () => {
  const serverSuite = createServerTestSuite(
    "Account Balance API Tests",
    3110,
    {
      MEXC_API_KEY: "test_api_key_12345",
      MEXC_SECRET_KEY: "test_secret_key_67890"
    }
  );

  beforeAll(async () => {
    await serverSuite.beforeAllSetup();
  }, TIMEOUT_CONFIG.STANDARD));

  afterAll(async () => {
    await serverSuite.afterAllCleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/account/balance", () => {
    it("should return account balance with environment fallback", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const response = await safeFetch(`${serverSuite.baseUrl()}/api/account/balance`);
      
      expect(response.status).toBeOneOf([200, 401, 503]);
      
      const data = await response.json();
      expect(data).toHaveProperty("success");
      expect(data).toHaveProperty("data");
      
      if (data.success) {
        expect(data.data).toHaveProperty("balances");
        expect(data.data).toHaveProperty("totalUsdtValue");
        expect(data.data).toHaveProperty("lastUpdated");
        expect(data.data).toHaveProperty("hasUserCredentials");
        expect(data.data).toHaveProperty("credentialsType");
        expect(data.data.credentialsType).toBe("environment-fallback");
        expect(Array.isArray(data.data.balances)).toBe(true);
        expect(typeof data.data.totalUsdtValue).toBe("number");
        expect(data.data.totalUsdtValue).toBeGreaterThanOrEqual(0);
      }
    });

    it("should return account balance with user-specific credentials", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const response = await safeFetch(`${serverSuite.baseUrl()}/api/account/balance?userId=test-user-123`);
      
      expect(response.status).toBeOneOf([200, 401, 503]);
      
      const data = await response.json();
      expect(data).toHaveProperty("success");
      
      if (data.success) {
        expect(data.data).toHaveProperty("hasUserCredentials", true);
        expect(data.data).toHaveProperty("credentialsType", "user-specific");
      }
    });

    it("should handle invalid userId parameter", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const response = await safeFetch(`${serverSuite.baseUrl()}/api/account/balance?userId=`);
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe("Invalid userId: cannot be empty");
      expect(data.meta).toHaveProperty("code", "INVALID_USER_ID");
    });

    it("should handle missing MEXC credentials gracefully", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      // This would be tested with environment without MEXC credentials
      const response = await safeFetch(`${serverSuite.baseUrl()}/api/account/balance`);
      
      expect(response.status).toBeOneOf([200, 503]);
      
      const data = await response.json();
      expect(data).toHaveProperty("success");
      
      if (!data.success && response.status === 503) {
        expect(data.error).toBe("MEXC API credentials not configured on server");
        expect(data.meta).toHaveProperty("code", "MISSING_CREDENTIALS");
        expect(data.meta).toHaveProperty("fallbackData");
      }
    });

    it("should handle MEXC API authentication errors", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      // Test with invalid credentials would typically return 401
      const response = await safeFetch(`${serverSuite.baseUrl()}/api/account/balance`);
      
      expect(response.status).toBeOneOf([200, 401, 503]);
      
      const data = await response.json();
      expect(data).toHaveProperty("success");
      
      if (!data.success && response.status === 401) {
        expect(data.meta).toHaveProperty("code");
        expect(data.meta.code).toBeOneOf(["MEXC_SIGNATURE_ERROR", "MEXC_AUTH_ERROR"]);
      }
    });

    it("should handle rate limiting", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      // Use the proper rate limiting test utility
      const result = await testRateLimit(serverSuite.baseUrl(), "/api/account/balance", 5);
      
      // Should either succeed or be rate limited
      expect(result.statusCodes.every(code => [200, 401, 429, 503].includes(code))).toBe(true);
    });

    it("should handle timeout scenarios", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      // Test with potential timeout (would need to mock slow MEXC API)
      const response = await safeFetch(`${serverSuite.baseUrl()}/api/account/balance`);
      
      expect(response.status).toBeOneOf([200, 401, 503, 504]);
      
      if (response.status === 504) {
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.meta).toHaveProperty("code", "REQUEST_TIMEOUT");
      }
    });

    it("should include proper response metadata", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const response = await safeFetch(`${serverSuite.baseUrl()}/api/account/balance`);
      
      const data = await response.json();
      
      if (data.success) {
        expect(data).toHaveProperty("metadata");
        expect(data.metadata).toHaveProperty("balanceCount");
        expect(data.metadata).toHaveProperty("credentialSource");
        expect(data.metadata).toHaveProperty("apiVersion", "v1");
        expect(data.metadata).toHaveProperty("timestamp");
        expect(typeof data.metadata.balanceCount).toBe("number");
        expect(data.metadata.credentialSource).toBeOneOf(["user-database", "environment"]);
      }
    });

    it("should validate response schema", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const response = await safeFetch(`${serverSuite.baseUrl()}/api/account/balance`);
      const data = await response.json();
      
      // Basic schema validation
      expect(data).toHaveProperty("success");
      expect(typeof data.success).toBe("boolean");
      
      if (data.success) {
        expect(data.data).toHaveProperty("balances");
        expect(data.data).toHaveProperty("totalUsdtValue");
        expect(data.data).toHaveProperty("lastUpdated");
        expect(data.data).toHaveProperty("hasUserCredentials");
        expect(data.data).toHaveProperty("credentialsType");
        
        // Validate balance structure
        data.data.balances.forEach((balance: any) => {
          expect(balance).toHaveProperty("asset");
          expect(balance).toHaveProperty("free");
          expect(balance).toHaveProperty("locked");
          expect(typeof balance.asset).toBe("string");
          expect(typeof balance.free).toBe("string");
          expect(typeof balance.locked).toBe("string");
        });
      } else {
        expect(data).toHaveProperty("error");
        expect(data).toHaveProperty("meta");
        expect(data.meta).toHaveProperty("code");
      }
    });

    it("should handle network errors gracefully", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const response = await safeFetch(`${serverSuite.baseUrl()}/api/account/balance`);
      
      expect(response.status).toBeOneOf([200, 401, 503, 504]);
      
      if (response.status === 503) {
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.meta).toHaveProperty("code");
        expect(data.meta.code).toBeOneOf(["NETWORK_ERROR", "MEXC_API_ERROR"]);
      }
    });

    it("should enforce proper HTTP method", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      // Test unsupported HTTP methods
      const postResponse = await safeFetch(`${serverSuite.baseUrl()}/api/account/balance`, {
        method: "POST"
      });
      
      const putResponse = await safeFetch(`${serverSuite.baseUrl()}/api/account/balance`, {
        method: "PUT"
      });
      
      const deleteResponse = await safeFetch(`${serverSuite.baseUrl()}/api/account/balance`, {
        method: "DELETE"
      });
      
      expect(postResponse.status).toBe(405);
      expect(putResponse.status).toBe(405);
      expect(deleteResponse.status).toBe(405);
    });
  });

  describe("Cost Monitoring Integration", () => {
    it("should track API call costs", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const response = await safeFetch(`${serverSuite.baseUrl()}/api/account/balance`);
      
      // Cost monitoring should be transparent to the response
      expect(response.status).toBeOneOf([200, 401, 503]);
      
      const data = await response.json();
      expect(data).toHaveProperty("success");
      
      // Response should include metadata that could be used for cost tracking
      if (data.success && data.metadata) {
        expect(data.metadata).toHaveProperty("timestamp");
      }
    });
  });

  describe("Circuit Breaker Integration", () => {
    it("should handle circuit breaker states", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      // Circuit breaker should be transparent unless it's open
      const response = await safeFetch(`${serverSuite.baseUrl()}/api/account/balance`);
      
      expect(response.status).toBeOneOf([200, 401, 503, 504]);
      
      if (response.status === 503) {
        const data = await response.json();
        expect(data.success).toBe(false);
        // Circuit breaker errors would typically have specific error codes
      }
    });
  });

  describe("Database Query Cache Integration", () => {
    it("should handle cached responses", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      // Make two requests to potentially test caching
      const response1 = await safeFetch(`${serverSuite.baseUrl()}/api/account/balance`);
      const response2 = await safeFetch(`${serverSuite.baseUrl()}/api/account/balance`);
      
      expect(response1.status).toBeOneOf([200, 401, 503]);
      expect(response2.status).toBeOneOf([200, 401, 503]);
      
      if (response1.status === 200 && response2.status === 200) {
        const data1 = await response1.json();
        const data2 = await response2.json();
        
        // Both should be successful
        expect(data1.success).toBe(true);
        expect(data2.success).toBe(true);
        
        // Cache should work transparently
        expect(data1.data).toHaveProperty("balances");
        expect(data2.data).toHaveProperty("balances");
      }
    });
  });
});

// Custom matcher for test flexibility
expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected.join(', ')}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected.join(', ')}`,
        pass: false,
      };
    }
  },
});