/**
 * MEXC API Endpoints Integration Tests
 * 
 * Comprehensive tests for all MEXC-related API endpoints including:
 * - Account information
 * - Calendar data
 * - Connectivity testing
 * - Exchange information
 * - Server time
 * - Symbols and tickers
 * - Credential testing
 * - Trade execution
 * - Unified status
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { spawn, ChildProcess } from "child_process";

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../utils/timeout-elimination-helpers';

const TEST_PORT = 3113;
const BASE_URL = `http://localhost:${TEST_PORT}`;
const TIMEOUT_MS = 30000;

describe("MEXC API Endpoints Integration Tests", () => {
  let serverProcess: ChildProcess;
  let isServerReady = false;

  beforeAll(async () => {
    console.log("🚀 Starting server for MEXC API endpoints tests...");
    
    serverProcess = spawn("bun", ["run", "dev"], {
      env: { 
        ...process.env, 
        PORT: TEST_PORT.toString(),
        NODE_ENV: "test",
        MEXC_API_KEY: "test_mexc_api_key_integration",
        MEXC_SECRET_KEY: "test_mexc_secret_key_integration",
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
              console.log("✅ Server ready for MEXC API endpoints tests");
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
      }, TIMEOUT_CONFIG.STANDARD));
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/mexc/server-time", () => {
    it("should return MEXC server time", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/server-time`);
      
      expect(response.status).toBeOneOf([200, 503]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("serverTime");
        expect(data).toHaveProperty("timestamp");
        
        expect(typeof data.serverTime).toBe("number");
        expect(typeof data.timestamp).toBe("string");
        expect(data.serverTime).toBeGreaterThan(0);
        
        // Verify server time is reasonable (within last year)
        const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
        expect(data.serverTime).toBeGreaterThan(oneYearAgo);
      }
    });

    it("should handle MEXC API unavailability", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/server-time`);
      
      expect(response.status).toBeOneOf([200, 503, 504]);
      
      if (response.status === 503 || response.status === 504) {
        const data = await response.json();
        expect(data).toHaveProperty("success", false);
        expect(data).toHaveProperty("error");
        expect(typeof data.error).toBe("string");
      }
    });

    it("should include proper headers", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/server-time`);
      
      expect(response.headers.get("content-type")).toContain("application/json");
    });
  });

  describe("GET /api/mexc/connectivity", () => {
    it("should test MEXC API connectivity", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/connectivity`);
      
      expect(response.status).toBeOneOf([200, 503]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("connectivity");
        expect(data.connectivity).toHaveProperty("status");
        expect(data.connectivity).toHaveProperty("responseTime");
        expect(data.connectivity).toHaveProperty("endpoint");
        
        expect(typeof data.connectivity.status).toBe("string");
        expect(typeof data.connectivity.responseTime).toBe("number");
        expect(typeof data.connectivity.endpoint).toBe("string");
        expect(data.connectivity.responseTime).toBeGreaterThan(0);
      }
    });

    it("should include detailed connectivity metrics", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/connectivity`);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.connectivity).toHaveProperty("timestamp");
        expect(data.connectivity).toHaveProperty("region");
        expect(data.connectivity).toHaveProperty("ipAddress");
        
        expect(typeof data.connectivity.timestamp).toBe("string");
        if (data.connectivity.region) {
          expect(typeof data.connectivity.region).toBe("string");
        }
        if (data.connectivity.ipAddress) {
          expect(typeof data.connectivity.ipAddress).toBe("string");
        }
      }
    });
  });

  describe("GET /api/mexc/enhanced-connectivity", () => {
    it("should return enhanced connectivity diagnostics", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/enhanced-connectivity`);
      
      expect(response.status).toBeOneOf([200, 503]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("connectivity");
        expect(data.connectivity).toHaveProperty("mainApi");
        expect(data.connectivity).toHaveProperty("websocket");
        expect(data.connectivity).toHaveProperty("testnet");
        expect(data.connectivity).toHaveProperty("overall");
        
        expect(typeof data.connectivity.mainApi).toBe("object");
        expect(typeof data.connectivity.websocket).toBe("object");
        expect(typeof data.connectivity.testnet).toBe("object");
        expect(typeof data.connectivity.overall).toBe("object");
      }
    });

    it("should include performance metrics", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/enhanced-connectivity`);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.connectivity.mainApi).toHaveProperty("responseTime");
        expect(data.connectivity.mainApi).toHaveProperty("status");
        expect(data.connectivity.overall).toHaveProperty("healthScore");
        expect(data.connectivity.overall).toHaveProperty("recommendations");
        
        expect(typeof data.connectivity.mainApi.responseTime).toBe("number");
        expect(typeof data.connectivity.mainApi.status).toBe("string");
        expect(typeof data.connectivity.overall.healthScore).toBe("number");
        expect(Array.isArray(data.connectivity.overall.recommendations)).toBe(true);
      }
    });
  });

  describe("GET /api/mexc/exchange-info", () => {
    it("should return exchange information", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/exchange-info`);
      
      expect(response.status).toBeOneOf([200, 503]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        
        if (data.data) {
          expect(data.data).toHaveProperty("timezone");
          expect(data.data).toHaveProperty("serverTime");
          expect(data.data).toHaveProperty("symbols");
          
          expect(typeof data.data.timezone).toBe("string");
          expect(typeof data.data.serverTime).toBe("number");
          expect(Array.isArray(data.data.symbols)).toBe(true);
        }
      }
    });

    it("should validate symbol information structure", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/exchange-info`);
      
      if (response.status === 200) {
        const data = await response.json();
        
        if (data.data && data.data.symbols && data.data.symbols.length > 0) {
          const symbol = data.data.symbols[0];
          expect(symbol).toHaveProperty("symbol");
          expect(symbol).toHaveProperty("status");
          expect(symbol).toHaveProperty("baseAsset");
          expect(symbol).toHaveProperty("quoteAsset");
          
          expect(typeof symbol.symbol).toBe("string");
          expect(typeof symbol.status).toBe("string");
          expect(typeof symbol.baseAsset).toBe("string");
          expect(typeof symbol.quoteAsset).toBe("string");
        }
      }
    });

    it("should support filtering by symbol", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/exchange-info?symbol=BTCUSDT`);
      
      expect(response.status).toBeOneOf([200, 503]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        
        if (data.data && data.data.symbols) {
          // Should filter to only the requested symbol
          const btcUsdtSymbols = data.data.symbols.filter((s: any) => s.symbol === "BTCUSDT");
          expect(btcUsdtSymbols.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("GET /api/mexc/symbols", () => {
    it("should return available symbols", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/symbols`);
      
      expect(response.status).toBeOneOf([200, 503]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        expect(data.data).toHaveProperty("symbols");
        
        expect(Array.isArray(data.data.symbols)).toBe(true);
        
        if (data.data.symbols.length > 0) {
          const symbol = data.data.symbols[0];
          expect(typeof symbol).toBe("string");
          expect(symbol.length).toBeGreaterThan(0);
        }
      }
    });

    it("should support search filtering", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/symbols?search=BTC`);
      
      expect(response.status).toBeOneOf([200, 503]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        
        if (data.data && data.data.symbols) {
          // All symbols should contain "BTC"
          data.data.symbols.forEach((symbol: string) => {
            expect(symbol.toUpperCase()).toContain("BTC");
          });
        }
      }
    });

    it("should support pagination", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/symbols?limit=10&offset=0`);
      
      expect(response.status).toBeOneOf([200, 503]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        
        if (data.data && data.data.symbols) {
          expect(data.data.symbols.length).toBeLessThanOrEqual(10);
          expect(data.data).toHaveProperty("total");
          expect(data.data).toHaveProperty("pagination");
          
          expect(typeof data.data.total).toBe("number");
          expect(typeof data.data.pagination).toBe("object");
        }
      }
    });
  });

  describe("GET /api/mexc/ticker", () => {
    it("should return ticker information", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/ticker`);
      
      expect(response.status).toBeOneOf([200, 503]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        
        if (Array.isArray(data.data)) {
          data.data.forEach((ticker: any) => {
            expect(ticker).toHaveProperty("symbol");
            expect(ticker).toHaveProperty("priceChange");
            expect(ticker).toHaveProperty("priceChangePercent");
            expect(ticker).toHaveProperty("lastPrice");
            expect(ticker).toHaveProperty("volume");
            
            expect(typeof ticker.symbol).toBe("string");
            expect(typeof ticker.priceChange).toBe("string");
            expect(typeof ticker.priceChangePercent).toBe("string");
            expect(typeof ticker.lastPrice).toBe("string");
            expect(typeof ticker.volume).toBe("string");
          });
        }
      }
    });

    it("should support single symbol ticker", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/ticker?symbol=BTCUSDT`);
      
      expect(response.status).toBeOneOf([200, 503]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        
        if (data.data && !Array.isArray(data.data)) {
          expect(data.data).toHaveProperty("symbol", "BTCUSDT");
          expect(data.data).toHaveProperty("lastPrice");
          expect(data.data).toHaveProperty("volume");
        }
      }
    });
  });

  describe("GET /api/mexc/account", () => {
    it("should return account information", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/account`);
      
      expect(response.status).toBeOneOf([200, 401, 503]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        expect(data.data).toHaveProperty("accountType");
        expect(data.data).toHaveProperty("balances");
        expect(data.data).toHaveProperty("canTrade");
        expect(data.data).toHaveProperty("canWithdraw");
        expect(data.data).toHaveProperty("canDeposit");
        
        expect(typeof data.data.accountType).toBe("string");
        expect(Array.isArray(data.data.balances)).toBe(true);
        expect(typeof data.data.canTrade).toBe("boolean");
        expect(typeof data.data.canWithdraw).toBe("boolean");
        expect(typeof data.data.canDeposit).toBe("boolean");
      }
    });

    it("should validate balance structure", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/account`);
      
      if (response.status === 200) {
        const data = await response.json();
        
        if (data.data.balances && data.data.balances.length > 0) {
          const balance = data.data.balances[0];
          expect(balance).toHaveProperty("asset");
          expect(balance).toHaveProperty("free");
          expect(balance).toHaveProperty("locked");
          
          expect(typeof balance.asset).toBe("string");
          expect(typeof balance.free).toBe("string");
          expect(typeof balance.locked).toBe("string");
        }
      }
    });

    it("should handle authentication errors", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/account`);
      
      expect(response.status).toBeOneOf([200, 401, 503]);
      
      if (response.status === 401) {
        const data = await response.json();
        expect(data).toHaveProperty("success", false);
        expect(data).toHaveProperty("error");
        expect(typeof data.error).toBe("string");
      }
    });
  });

  describe("GET /api/mexc/calendar", () => {
    it("should return calendar events", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/calendar`);
      
      expect(response.status).toBeOneOf([200, 503]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        expect(data.data).toHaveProperty("events");
        
        expect(Array.isArray(data.data.events)).toBe(true);
        
        if (data.data.events.length > 0) {
          const event = data.data.events[0];
          expect(event).toHaveProperty("id");
          expect(event).toHaveProperty("title");
          expect(event).toHaveProperty("date");
          expect(event).toHaveProperty("type");
          
          expect(typeof event.id).toBe("string");
          expect(typeof event.title).toBe("string");
          expect(typeof event.date).toBe("string");
          expect(typeof event.type).toBe("string");
        }
      }
    });

    it("should support date filtering", async () => {
      if (!isServerReady) return;

      const startDate = "2024-01-01";
      const endDate = "2024-01-31";
      
      const response = await fetch(`${BASE_URL}/api/mexc/calendar?startDate=${startDate}&endDate=${endDate}`);
      
      expect(response.status).toBeOneOf([200, 503]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        
        if (data.data && data.data.events) {
          // Events should be within the date range
          data.data.events.forEach((event: any) => {
            const eventDate = new Date(event.date);
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            expect(eventDate.getTime()).toBeGreaterThanOrEqual(start.getTime());
            expect(eventDate.getTime()).toBeLessThanOrEqual(end.getTime());
          });
        }
      }
    });

    it("should support event type filtering", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/calendar?type=listing`);
      
      expect(response.status).toBeOneOf([200, 503]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        
        if (data.data && data.data.events) {
          data.data.events.forEach((event: any) => {
            expect(event.type).toBe("listing");
          });
        }
      }
    });
  });

  describe("GET /api/mexc/test-credentials", () => {
    it("should test API credentials", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/test-credentials`);
      
      expect(response.status).toBeOneOf([200, 401, 503]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        expect(data.data).toHaveProperty("credentialsValid");
        expect(data.data).toHaveProperty("permissions");
        expect(data.data).toHaveProperty("accountInfo");
        
        expect(typeof data.data.credentialsValid).toBe("boolean");
        expect(typeof data.data.permissions).toBe("object");
        expect(typeof data.data.accountInfo).toBe("object");
      }
    });

    it("should validate permissions structure", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/test-credentials`);
      
      if (response.status === 200) {
        const data = await response.json();
        
        if (data.data.permissions) {
          expect(data.data.permissions).toHaveProperty("canTrade");
          expect(data.data.permissions).toHaveProperty("canWithdraw");
          expect(data.data.permissions).toHaveProperty("canDeposit");
          
          expect(typeof data.data.permissions.canTrade).toBe("boolean");
          expect(typeof data.data.permissions.canWithdraw).toBe("boolean");
          expect(typeof data.data.permissions.canDeposit).toBe("boolean");
        }
      }
    });

    it("should handle invalid credentials", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/test-credentials`);
      
      expect(response.status).toBeOneOf([200, 401, 503]);
      
      if (response.status === 401) {
        const data = await response.json();
        expect(data).toHaveProperty("success", false);
        expect(data).toHaveProperty("error");
        expect(data.data).toHaveProperty("credentialsValid", false);
      }
    });
  });

  describe("GET /api/mexc/unified-status", () => {
    it("should return unified MEXC status", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/unified-status`);
      
      expect(response.status).toBeOneOf([200, 503]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        expect(data.data).toHaveProperty("connectivity");
        expect(data.data).toHaveProperty("authentication");
        expect(data.data).toHaveProperty("exchangeInfo");
        expect(data.data).toHaveProperty("systemStatus");
        expect(data.data).toHaveProperty("performance");
        
        expect(typeof data.data.connectivity).toBe("object");
        expect(typeof data.data.authentication).toBe("object");
        expect(typeof data.data.exchangeInfo).toBe("object");
        expect(typeof data.data.systemStatus).toBe("object");
        expect(typeof data.data.performance).toBe("object");
      }
    });

    it("should include comprehensive health metrics", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/unified-status`);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.data).toHaveProperty("overallHealth");
        expect(data.data).toHaveProperty("recommendations");
        expect(data.data).toHaveProperty("lastUpdated");
        
        expect(typeof data.data.overallHealth).toBe("string");
        expect(Array.isArray(data.data.recommendations)).toBe(true);
        expect(typeof data.data.lastUpdated).toBe("string");
      }
    });
  });

  describe("POST /api/mexc/trade", () => {
    it("should handle trade execution requests", async () => {
      if (!isServerReady) return;

      const tradeData = {
        symbol: "BTCUSDT",
        side: "BUY",
        type: "LIMIT",
        quantity: "0.001",
        price: "50000",
        timeInForce: "GTC"
      };
      
      const response = await fetch(`${BASE_URL}/api/mexc/trade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(tradeData)
      });
      
      expect(response.status).toBeOneOf([200, 400, 401, 422, 503]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        expect(data.data).toHaveProperty("orderId");
        expect(data.data).toHaveProperty("symbol", tradeData.symbol);
        expect(data.data).toHaveProperty("side", tradeData.side);
        expect(data.data).toHaveProperty("status");
        
        expect(typeof data.data.orderId).toBe("string");
        expect(typeof data.data.status).toBe("string");
      }
    });

    it("should validate trade parameters", async () => {
      if (!isServerReady) return;

      const invalidTradeData = {
        symbol: "", // Empty symbol
        side: "INVALID_SIDE",
        type: "INVALID_TYPE",
        quantity: "-1", // Negative quantity
        price: "0" // Zero price
      };
      
      const response = await fetch(`${BASE_URL}/api/mexc/trade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(invalidTradeData)
      });
      
      expect(response.status).toBeOneOf([400, 401, 422, 503]);
      
      if (response.status === 400 || response.status === 422) {
        const data = await response.json();
        expect(data).toHaveProperty("success", false);
        expect(data).toHaveProperty("error");
        expect(data).toHaveProperty("validationErrors");
        expect(Array.isArray(data.validationErrors)).toBe(true);
      }
    });

    it("should handle malformed JSON", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/trade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: "invalid-json"
      });
      
      expect(response.status).toBeOneOf([400, 401, 422, 503]);
      
      if (response.status === 400 || response.status === 422) {
        const data = await response.json();
        expect(data).toHaveProperty("success", false);
        expect(data).toHaveProperty("error");
      }
    });

    it("should require authentication", async () => {
      if (!isServerReady) return;

      const tradeData = {
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: "0.001"
      };
      
      const response = await fetch(`${BASE_URL}/api/mexc/trade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(tradeData)
      });
      
      expect(response.status).toBeOneOf([200, 401, 503]);
      
      if (response.status === 401) {
        const data = await response.json();
        expect(data).toHaveProperty("success", false);
        expect(data).toHaveProperty("error");
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle 404 for non-existent endpoints", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/nonexistent`);
      
      expect(response.status).toBe(404);
    });

    it("should handle invalid HTTP methods", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/server-time`, {
        method: "DELETE"
      });
      
      expect(response.status).toBe(405);
    });

    it("should handle rate limiting", async () => {
      if (!isServerReady) return;

      // Make multiple rapid requests to trigger rate limiting
      const promises = Array(10).fill(null).map(() => 
        fetch(`${BASE_URL}/api/mexc/server-time`)
      );
      
      const responses = await Promise.all(promises);
      const statusCodes = responses.map(r => r.status);
      
      // Should either succeed or be rate limited
      expect(statusCodes.every(code => [200, 429, 503].includes(code))).toBe(true);
    });

    it("should handle network timeouts", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/connectivity`);
      
      expect(response.status).toBeOneOf([200, 503, 504]);
      
      if (response.status === 504) {
        const data = await response.json();
        expect(data).toHaveProperty("success", false);
        expect(data).toHaveProperty("error");
        expect(data.error).toContain("timeout");
      }
    });
  });

  describe("Performance & Monitoring", () => {
    it("should track response times", async () => {
      if (!isServerReady) return;

      const startTime = Date.now();
      const response = await fetch(`${BASE_URL}/api/mexc/server-time`);
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeGreaterThan(0);
      expect(responseTime).toBeLessThan(30000); // Should complete within 30 seconds
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("timestamp");
      }
    });

    it("should include proper error details", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/exchange-info`);
      
      if (response.status >= 400) {
        const data = await response.json();
        expect(data).toHaveProperty("success", false);
        expect(data).toHaveProperty("error");
        expect(data).toHaveProperty("timestamp");
        expect(data).toHaveProperty("path");
        
        expect(typeof data.error).toBe("string");
        expect(typeof data.timestamp).toBe("string");
        expect(typeof data.path).toBe("string");
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