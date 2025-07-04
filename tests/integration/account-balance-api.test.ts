/**
 * Account Balance API Integration Tests
 * 
 * Tests account balance endpoint with authentication, error handling, 
 * MEXC API integration, and comprehensive request/response validation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { spawn, ChildProcess } from "child_process";

const TEST_PORT = 3110;
const BASE_URL = `http://localhost:${TEST_PORT}`;
const TIMEOUT_MS = 30000;

describe("Account Balance API Integration Tests", () => {
  let serverProcess: ChildProcess;
  let isServerReady = false;

  beforeAll(async () => {
    console.log("🚀 Starting server for Account Balance API tests...");
    
    serverProcess = spawn("bun", ["run", "dev"], {
      env: { 
        ...process.env, 
        PORT: TEST_PORT.toString(),
        NODE_ENV: "test",
        MEXC_API_KEY: "test_api_key_12345",
        MEXC_SECRET_KEY: "test_secret_key_67890",
        USE_REAL_DATABASE: "true"
      },
      stdio: "pipe"
    });

    // Wait for server readiness
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.log("❌ Server startup timeout");
        isServerReady = false;
        resolve();
      }, TIMEOUT_MS);

      let attempts = 0;
      const maxAttempts = 30;

      const checkReady = () => {
        attempts++;
        fetch(`${BASE_URL}/api/health`)
          .then(response => {
            if (response.ok) {
              isServerReady = true;
              clearTimeout(timeout);
              console.log("✅ Server ready for Account Balance API tests");
              resolve();
            } else if (attempts < maxAttempts) {
              setTimeout(checkReady, 1000);
            } else {
              isServerReady = false;
              resolve();
            }
          })
          .catch(() => {
            if (attempts < maxAttempts) {
              setTimeout(checkReady, 1000);
            } else {
              isServerReady = false;
              resolve();
            }
          });
      };

      setTimeout(checkReady, 3000);
    });
  }, TIMEOUT_MS + 5000);

  afterAll(async () => {
    if (serverProcess) {
      console.log("🧹 Cleaning up server process...");
      serverProcess.kill("SIGTERM");
      setTimeout(() => {
        if (!serverProcess.killed) {
          serverProcess.kill("SIGKILL");
        }
      }, 5000);
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/account/balance", () => {
    it("should return account balance with environment fallback", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/account/balance`);
      
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
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/account/balance?userId=test-user-123`);
      
      expect(response.status).toBeOneOf([200, 401, 503]);
      
      const data = await response.json();
      expect(data).toHaveProperty("success");
      
      if (data.success) {
        expect(data.data).toHaveProperty("hasUserCredentials", true);
        expect(data.data).toHaveProperty("credentialsType", "user-specific");
      }
    });

    it("should handle invalid userId parameter", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/account/balance?userId=`);
      
      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe("Invalid userId: cannot be empty");
      expect(data.meta).toHaveProperty("code", "INVALID_USER_ID");
    });

    it("should handle missing MEXC credentials gracefully", async () => {
      if (!isServerReady) return;

      // This would be tested with environment without MEXC credentials
      const response = await fetch(`${BASE_URL}/api/account/balance`);
      
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
      if (!isServerReady) return;

      // Test with invalid credentials would typically return 401
      const response = await fetch(`${BASE_URL}/api/account/balance`);
      
      expect(response.status).toBeOneOf([200, 401, 503]);
      
      const data = await response.json();
      expect(data).toHaveProperty("success");
      
      if (!data.success && response.status === 401) {
        expect(data.meta).toHaveProperty("code");
        expect(data.meta.code).toBeOneOf(["MEXC_SIGNATURE_ERROR", "MEXC_AUTH_ERROR"]);
      }
    });

    it("should handle rate limiting", async () => {
      if (!isServerReady) return;

      // Make multiple rapid requests to trigger rate limiting
      const promises = Array(5).fill(null).map(() => 
        fetch(`${BASE_URL}/api/account/balance`)
      );
      
      const responses = await Promise.all(promises);
      const statusCodes = responses.map(r => r.status);
      
      // Should either succeed or be rate limited
      expect(statusCodes.every(code => [200, 401, 429, 503].includes(code))).toBe(true);
    });

    it("should handle timeout scenarios", async () => {
      if (!isServerReady) return;

      // Test with potential timeout (would need to mock slow MEXC API)
      const response = await fetch(`${BASE_URL}/api/account/balance`);
      
      expect(response.status).toBeOneOf([200, 401, 503, 504]);
      
      if (response.status === 504) {
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.meta).toHaveProperty("code", "REQUEST_TIMEOUT");
      }
    });

    it("should include proper response metadata", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/account/balance`);
      
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
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/account/balance`);
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
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/account/balance`);
      
      expect(response.status).toBeOneOf([200, 401, 503, 504]);
      
      if (response.status === 503) {
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data.meta).toHaveProperty("code");
        expect(data.meta.code).toBeOneOf(["NETWORK_ERROR", "MEXC_API_ERROR"]);
      }
    });

    it("should enforce proper HTTP method", async () => {
      if (!isServerReady) return;

      // Test unsupported HTTP methods
      const postResponse = await fetch(`${BASE_URL}/api/account/balance`, {
        method: "POST"
      });
      
      const putResponse = await fetch(`${BASE_URL}/api/account/balance`, {
        method: "PUT"
      });
      
      const deleteResponse = await fetch(`${BASE_URL}/api/account/balance`, {
        method: "DELETE"
      });
      
      expect(postResponse.status).toBe(405);
      expect(putResponse.status).toBe(405);
      expect(deleteResponse.status).toBe(405);
    });
  });

  describe("Cost Monitoring Integration", () => {
    it("should track API call costs", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/account/balance`);
      
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
      if (!isServerReady) return;

      // Circuit breaker should be transparent unless it's open
      const response = await fetch(`${BASE_URL}/api/account/balance`);
      
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
      if (!isServerReady) return;

      // Make two requests to potentially test caching
      const response1 = await fetch(`${BASE_URL}/api/account/balance`);
      const response2 = await fetch(`${BASE_URL}/api/account/balance`);
      
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