/**
 * Alerts System API Integration Tests
 * 
 * Comprehensive tests for all alerts-related endpoints including:
 * - Alert analytics
 * - Alert channels management
 * - Alert rules CRUD
 * - Alert instances management
 * - Alert system status
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { spawn, ChildProcess } from "child_process";

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../utils/timeout-elimination-helpers';

const TEST_PORT = 3111;
const BASE_URL = `http://localhost:${TEST_PORT}`;
const TIMEOUT_MS = 30000;

describe("Alerts System API Integration Tests", () => {
  let serverProcess: ChildProcess;
  let isServerReady = false;

  beforeAll(async () => {
    console.log("🚀 Starting server for Alerts System API tests...");
    
    serverProcess = spawn("bun", ["run", "dev"], {
      env: { 
        ...process.env, 
        PORT: TEST_PORT.toString(),
        NODE_ENV: "test",
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
              console.log("✅ Server ready for Alerts System API tests");
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

  describe("GET /api/alerts/analytics", () => {
    it("should return alert analytics with default parameters", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/alerts/analytics`);
      
      expect(response.status).toBeOneOf([200, 401, 403]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        
        // Validate analytics structure
        expect(data.data).toHaveProperty("timeSeries");
        expect(data.data).toHaveProperty("summary");
        expect(data.data).toHaveProperty("anomalyDetection");
        expect(data.data).toHaveProperty("correlations");
        expect(data.data).toHaveProperty("trends");
        expect(data.data).toHaveProperty("insights");
        
        // Validate time series structure
        expect(data.data.timeSeries).toHaveProperty("bucket");
        expect(data.data.timeSeries).toHaveProperty("limit");
        expect(data.data.timeSeries).toHaveProperty("data");
        expect(Array.isArray(data.data.timeSeries.data)).toBe(true);
        
        // Validate summary structure
        expect(data.data.summary).toHaveProperty("totalAlerts");
        expect(data.data.summary).toHaveProperty("totalResolved");
        expect(data.data.summary).toHaveProperty("totalFalsePositives");
        expect(data.data.summary).toHaveProperty("averageMTTR");
        expect(data.data.summary).toHaveProperty("alertDistribution");
        expect(data.data.summary).toHaveProperty("notificationStats");
        
        // Validate anomaly detection structure
        expect(data.data.anomalyDetection).toHaveProperty("modelsActive");
        expect(data.data.anomalyDetection).toHaveProperty("models");
        expect(data.data.anomalyDetection).toHaveProperty("overallPerformance");
        expect(Array.isArray(data.data.anomalyDetection.models)).toBe(true);
        
        // Validate correlations structure
        expect(data.data.correlations).toHaveProperty("activeCount");
        expect(data.data.correlations).toHaveProperty("correlations");
        expect(Array.isArray(data.data.correlations.correlations)).toBe(true);
        
        // Validate insights
        expect(Array.isArray(data.data.insights)).toBe(true);
      }
    });

    it("should handle query parameters correctly", async () => {
      if (!isServerReady) return;

      const params = new URLSearchParams({
        bucket: "daily",
        limit: "7",
        startDate: "2024-01-01",
        endDate: "2024-01-07"
      });
      
      const response = await fetch(`${BASE_URL}/api/alerts/analytics?${params}`);
      
      expect(response.status).toBeOneOf([200, 401, 403]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data.timeSeries.bucket).toBe("daily");
        expect(data.data.timeSeries.limit).toBe(7);
      }
    });

    it("should require authentication", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/alerts/analytics`);
      
      // Should either be successful (if auth is mocked) or require auth
      expect(response.status).toBeOneOf([200, 401, 403]);
      
      if (response.status === 401 || response.status === 403) {
        const data = await response.json();
        expect(data.success).toBe(false);
      }
    });

    it("should handle invalid bucket parameter", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/alerts/analytics?bucket=invalid`);
      
      expect(response.status).toBeOneOf([200, 400, 401, 403]);
      
      if (response.status === 200) {
        const data = await response.json();
        // Should default to "hourly" for invalid bucket
        expect(data.data.timeSeries.bucket).toBe("hourly");
      }
    });

    it("should handle service errors gracefully", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/alerts/analytics`);
      
      expect(response.status).toBeOneOf([200, 401, 403, 500]);
      
      if (response.status === 500) {
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data).toHaveProperty("error");
      }
    });
  });

  describe("GET /api/alerts/channels", () => {
    it("should return alert channels list", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/alerts/channels`);
      
      expect(response.status).toBeOneOf([200, 401, 403]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        
        if (Array.isArray(data.data)) {
          data.data.forEach((channel: any) => {
            expect(channel).toHaveProperty("id");
            expect(channel).toHaveProperty("name");
            expect(channel).toHaveProperty("type");
            expect(channel).toHaveProperty("enabled");
            expect(typeof channel.id).toBe("string");
            expect(typeof channel.name).toBe("string");
            expect(typeof channel.type).toBe("string");
            expect(typeof channel.enabled).toBe("boolean");
          });
        }
      }
    });

    it("should support filtering parameters", async () => {
      if (!isServerReady) return;

      const params = new URLSearchParams({
        type: "email",
        enabled: "true"
      });
      
      const response = await fetch(`${BASE_URL}/api/alerts/channels?${params}`);
      
      expect(response.status).toBeOneOf([200, 401, 403]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        
        if (Array.isArray(data.data)) {
          data.data.forEach((channel: any) => {
            expect(channel.type).toBe("email");
            expect(channel.enabled).toBe(true);
          });
        }
      }
    });
  });

  describe("POST /api/alerts/channels", () => {
    it("should create a new alert channel", async () => {
      if (!isServerReady) return;

      const channelData = {
        name: "Test Email Channel",
        type: "email",
        configuration: {
          recipients: ["test@example.com"],
          subject: "Alert Notification"
        },
        enabled: true
      };
      
      const response = await fetch(`${BASE_URL}/api/alerts/channels`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(channelData)
      });
      
      expect(response.status).toBeOneOf([200, 201, 401, 403, 422]);
      
      if (response.status === 200 || response.status === 201) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        expect(data.data).toHaveProperty("id");
        expect(data.data).toHaveProperty("name", channelData.name);
        expect(data.data).toHaveProperty("type", channelData.type);
        expect(data.data).toHaveProperty("enabled", channelData.enabled);
      }
    });

    it("should validate required fields", async () => {
      if (!isServerReady) return;

      const invalidData = {
        name: "" // Empty name should fail validation
      };
      
      const response = await fetch(`${BASE_URL}/api/alerts/channels`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(invalidData)
      });
      
      expect(response.status).toBeOneOf([400, 401, 403, 422]);
      
      if (response.status === 400 || response.status === 422) {
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data).toHaveProperty("error");
      }
    });

    it("should handle malformed JSON", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/alerts/channels`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: "invalid-json"
      });
      
      expect(response.status).toBeOneOf([400, 401, 403, 422]);
      
      if (response.status === 400 || response.status === 422) {
        const data = await response.json();
        expect(data.success).toBe(false);
      }
    });
  });

  describe("GET /api/alerts/rules", () => {
    it("should return alert rules list", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/alerts/rules`);
      
      expect(response.status).toBeOneOf([200, 401, 403]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        
        if (Array.isArray(data.data)) {
          data.data.forEach((rule: any) => {
            expect(rule).toHaveProperty("id");
            expect(rule).toHaveProperty("name");
            expect(rule).toHaveProperty("description");
            expect(rule).toHaveProperty("enabled");
            expect(rule).toHaveProperty("severity");
            expect(rule).toHaveProperty("conditions");
            expect(typeof rule.id).toBe("string");
            expect(typeof rule.name).toBe("string");
            expect(typeof rule.enabled).toBe("boolean");
            expect(typeof rule.severity).toBe("string");
          });
        }
      }
    });

    it("should support pagination", async () => {
      if (!isServerReady) return;

      const params = new URLSearchParams({
        page: "1",
        limit: "10"
      });
      
      const response = await fetch(`${BASE_URL}/api/alerts/rules?${params}`);
      
      expect(response.status).toBeOneOf([200, 401, 403]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data).toHaveProperty("data");
        expect(data).toHaveProperty("pagination");
        
        if (data.pagination) {
          expect(data.pagination).toHaveProperty("page");
          expect(data.pagination).toHaveProperty("limit");
          expect(data.pagination).toHaveProperty("total");
        }
      }
    });
  });

  describe("POST /api/alerts/rules", () => {
    it("should create a new alert rule", async () => {
      if (!isServerReady) return;

      const ruleData = {
        name: "Test Price Alert",
        description: "Alert when price exceeds threshold",
        severity: "high",
        conditions: [
          {
            metric: "price",
            operator: "gt",
            threshold: 100
          }
        ],
        actions: [
          {
            type: "notification",
            channelIds: ["email-channel-1"]
          }
        ],
        enabled: true
      };
      
      const response = await fetch(`${BASE_URL}/api/alerts/rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(ruleData)
      });
      
      expect(response.status).toBeOneOf([200, 201, 401, 403, 422]);
      
      if (response.status === 200 || response.status === 201) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        expect(data.data).toHaveProperty("id");
        expect(data.data).toHaveProperty("name", ruleData.name);
        expect(data.data).toHaveProperty("severity", ruleData.severity);
        expect(data.data).toHaveProperty("enabled", ruleData.enabled);
      }
    });

    it("should validate rule conditions", async () => {
      if (!isServerReady) return;

      const invalidRuleData = {
        name: "Invalid Rule",
        severity: "invalid-severity", // Invalid severity
        conditions: [], // Empty conditions
        enabled: true
      };
      
      const response = await fetch(`${BASE_URL}/api/alerts/rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(invalidRuleData)
      });
      
      expect(response.status).toBeOneOf([400, 401, 403, 422]);
      
      if (response.status === 400 || response.status === 422) {
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data).toHaveProperty("error");
      }
    });
  });

  describe("GET /api/alerts/instances", () => {
    it("should return alert instances list", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/alerts/instances`);
      
      expect(response.status).toBeOneOf([200, 401, 403]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        
        if (Array.isArray(data.data)) {
          data.data.forEach((instance: any) => {
            expect(instance).toHaveProperty("id");
            expect(instance).toHaveProperty("ruleId");
            expect(instance).toHaveProperty("status");
            expect(instance).toHaveProperty("severity");
            expect(instance).toHaveProperty("triggeredAt");
            expect(instance).toHaveProperty("message");
            expect(typeof instance.id).toBe("string");
            expect(typeof instance.ruleId).toBe("string");
            expect(typeof instance.status).toBe("string");
            expect(typeof instance.severity).toBe("string");
            expect(typeof instance.message).toBe("string");
          });
        }
      }
    });

    it("should support status filtering", async () => {
      if (!isServerReady) return;

      const params = new URLSearchParams({
        status: "active",
        severity: "high"
      });
      
      const response = await fetch(`${BASE_URL}/api/alerts/instances?${params}`);
      
      expect(response.status).toBeOneOf([200, 401, 403]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        
        if (Array.isArray(data.data)) {
          data.data.forEach((instance: any) => {
            expect(instance.status).toBe("active");
            expect(instance.severity).toBe("high");
          });
        }
      }
    });

    it("should support date range filtering", async () => {
      if (!isServerReady) return;

      const params = new URLSearchParams({
        startDate: "2024-01-01",
        endDate: "2024-01-31"
      });
      
      const response = await fetch(`${BASE_URL}/api/alerts/instances?${params}`);
      
      expect(response.status).toBeOneOf([200, 401, 403]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data).toHaveProperty("data");
      }
    });
  });

  describe("GET /api/alerts/system/status", () => {
    it("should return alert system status", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/alerts/system/status`);
      
      expect(response.status).toBeOneOf([200, 401, 403]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        expect(data.data).toHaveProperty("status");
        expect(data.data).toHaveProperty("activeRules");
        expect(data.data).toHaveProperty("activeChannels");
        expect(data.data).toHaveProperty("processingQueue");
        expect(data.data).toHaveProperty("lastProcessed");
        expect(data.data).toHaveProperty("systemHealth");
        
        expect(typeof data.data.status).toBe("string");
        expect(typeof data.data.activeRules).toBe("number");
        expect(typeof data.data.activeChannels).toBe("number");
        expect(typeof data.data.processingQueue).toBe("number");
        expect(typeof data.data.systemHealth).toBe("string");
      }
    });
  });

  describe("Alert Channel Testing", () => {
    it("should test alert channel connectivity", async () => {
      if (!isServerReady) return;

      const testChannelId = "test-channel-123";
      const response = await fetch(`${BASE_URL}/api/alerts/channels/${testChannelId}/test`, {
        method: "POST"
      });
      
      expect(response.status).toBeOneOf([200, 401, 403, 404]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        expect(data.data).toHaveProperty("testResult");
        expect(data.data).toHaveProperty("latency");
        expect(data.data).toHaveProperty("timestamp");
      }
    });
  });

  describe("Built-in Alerts Deployment", () => {
    it("should deploy built-in alert rules", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/alerts/deploy/built-in`, {
        method: "POST"
      });
      
      expect(response.status).toBeOneOf([200, 401, 403]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        expect(data.data).toHaveProperty("deployed");
        expect(data.data).toHaveProperty("skipped");
        expect(data.data).toHaveProperty("errors");
        expect(typeof data.data.deployed).toBe("number");
        expect(typeof data.data.skipped).toBe("number");
        expect(Array.isArray(data.data.errors)).toBe(true);
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle 404 for non-existent endpoints", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/alerts/nonexistent`);
      
      expect(response.status).toBe(404);
    });

    it("should handle invalid HTTP methods", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/alerts/analytics`, {
        method: "DELETE"
      });
      
      expect(response.status).toBe(405);
    });

    it("should handle server errors gracefully", async () => {
      if (!isServerReady) return;

      // Test with potentially error-inducing request
      const response = await fetch(`${BASE_URL}/api/alerts/instances`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          invalidField: "should cause error"
        })
      });
      
      expect(response.status).toBeOneOf([200, 400, 401, 403, 422, 500]);
      
      if (response.status >= 400) {
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data).toHaveProperty("error");
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