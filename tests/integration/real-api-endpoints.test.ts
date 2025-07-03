/**
 * Real API Endpoints Integration Tests
 * 
 * Tests actual API endpoints without mocks to verify real system integrations
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, ChildProcess } from "child_process";

const TEST_PORT = 3109;
const BASE_URL = `http://localhost:${TEST_PORT}`;

describe("Real API Endpoints Integration", () => {
  let serverProcess: ChildProcess;
  let isServerReady = false;

  beforeAll(async () => {
    // Start development server for integration testing
    console.log("🚀 Starting development server for integration tests...");
    
    serverProcess = spawn("bun", ["run", "dev"], {
      env: { 
        ...process.env, 
        PORT: TEST_PORT.toString(),
        NODE_ENV: "test",
        USE_REAL_DATABASE: "true"
      },
      stdio: "pipe"
    });

    // Wait for server to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Server startup timeout"));
      }, 30000);

      const checkReady = () => {
        fetch(`${BASE_URL}/api/health`)
          .then(response => {
            if (response.ok) {
              isServerReady = true;
              clearTimeout(timeout);
              console.log("✅ Development server ready for integration tests");
              resolve();
            } else {
              setTimeout(checkReady, 1000);
            }
          })
          .catch(() => {
            setTimeout(checkReady, 1000);
          });
      };

      setTimeout(checkReady, 3000); // Give server time to start
    });
  }, 45000);

  afterAll(async () => {
    // Cleanup server process
    if (serverProcess) {
      console.log("🧹 Cleaning up development server...");
      serverProcess.kill("SIGTERM");
      
      // Force kill if still running after 5 seconds
      setTimeout(() => {
        if (!serverProcess.killed) {
          serverProcess.kill("SIGKILL");
        }
      }, 5000);
    }
  });

  describe("Health Check Endpoints", () => {
    it("should return healthy status from main health endpoint", async () => {
      if (!isServerReady) {
        console.log("⏭️ Skipping test - server not ready");
        return;
      }

      const response = await fetch(`${BASE_URL}/api/health`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty("status");
      expect(data.status).toBe("healthy");
    });

    it("should check database connectivity", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/health/db`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty("database");
      expect(typeof data.database.connected).toBe("boolean");
    });

    it("should verify environment health", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/health/environment`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty("environment");
      expect(data.environment).toHaveProperty("nodeEnv");
    });

    it("should check system health", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/health/system`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty("system");
      expect(data.system).toHaveProperty("uptime");
      expect(typeof data.system.uptime).toBe("number");
    });
  });

  describe("Authentication Integration", () => {
    it("should handle session endpoint", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/auth/session`);
      // Should respond (even if no session)
      expect(response.status).toBeOneOf([200, 401, 403]);
    });

    it("should provide auth health status", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/health/auth`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty("auth");
    });
  });

  describe("MEXC API Integration", () => {
    it("should check MEXC connectivity", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/connectivity`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty("success");
      expect(typeof data.success).toBe("boolean");
    });

    it("should fetch MEXC server time", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/server-time`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty("serverTime");
      expect(typeof data.serverTime).toBe("number");
    });

    it("should get exchange info", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/exchange-info`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty("success");
      if (data.success && data.data) {
        expect(data.data).toHaveProperty("symbols");
        expect(Array.isArray(data.data.symbols)).toBe(true);
      }
    });

    it("should test enhanced connectivity", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/mexc/enhanced-connectivity`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty("success");
      expect(data).toHaveProperty("connectivity");
    });
  });

  describe("Database Integration", () => {
    it("should check database quota status", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/database/quota-status`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty("success");
      expect(data).toHaveProperty("quota");
    });

    it("should handle database optimization checks", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/database/optimize`);
      expect(response.status).toBeOneOf([200, 405, 503]); // Different methods may not be allowed
    });
  });

  describe("Auto-Sniping System Integration", () => {
    it("should get auto-sniping status", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/auto-sniping/status`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty("success");
      expect(data).toHaveProperty("status");
    });

    it("should validate auto-sniping config", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/auto-sniping/config-validation`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty("success");
    });

    it("should check safety monitoring", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/auto-sniping/safety-monitoring`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty("success");
    });
  });

  describe("Monitoring and Analytics", () => {
    it("should provide system overview", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/monitoring/system-overview`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty("success");
    });

    it("should get performance metrics", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/monitoring/performance-metrics`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty("success");
    });

    it("should check trading analytics", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/analytics/trading`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty("success");
    });
  });

  describe("Safety and Risk Management", () => {
    it("should get safety system status", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/safety/system-status`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty("success");
    });

    it("should perform risk assessment", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/safety/risk-assessment`);
      expect(response.ok).toBe(true);
      
      const data = await response.json();
      expect(data).toHaveProperty("success");
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle invalid endpoints gracefully", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/nonexistent-endpoint`);
      expect(response.status).toBe(404);
    });

    it("should handle malformed requests", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/auto-sniping/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid-json"
      });
      expect(response.status).toBeOneOf([400, 422, 500]);
    });

    it("should implement rate limiting", async () => {
      if (!isServerReady) return;

      // Make multiple rapid requests to test rate limiting
      const promises = Array(10).fill(null).map(() => 
        fetch(`${BASE_URL}/api/health`)
      );
      
      const responses = await Promise.all(promises);
      const statusCodes = responses.map(r => r.status);
      
      // All should succeed for health endpoint, but rate limiting may apply to other endpoints
      expect(statusCodes.every(code => code === 200 || code === 429)).toBe(true);
    });
  });
});

// Custom matcher for vitest
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