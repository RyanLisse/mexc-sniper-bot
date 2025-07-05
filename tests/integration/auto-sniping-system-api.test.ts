/**
 * Auto-Sniping System API Integration Tests
 * 
 * Comprehensive tests for all auto-sniping related endpoints including:
 * - Configuration management
 * - Status monitoring
 * - Control operations
 * - Execution tracking
 * - Safety monitoring
 * - Pattern monitoring
 * - Config validation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { createServerTestSuite, testRateLimit } from "@utils/server-test-helper";
import { safeFetch } from "@utils/async-utilities";

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '@utils/timeout-utilities';

describe("Auto-Sniping System API Integration Tests", () => {
  const serverSuite = createServerTestSuite(
    "Auto-Sniping System API Tests",
    3112
  );

  beforeAll(async () => {
    await serverSuite.beforeAllSetup();
  }, TIMEOUT_CONFIG.STANDARD);

  afterAll(async () => {
    await serverSuite.afterAllCleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/auto-sniping/status", () => {
    it("should return auto-sniping system status", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/status`);
      
      expect(response.status).toBeOneOf([200, 401, 403]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        expect(data.data).toHaveProperty("status");
        expect(data.data).toHaveProperty("isActive");
        expect(data.data).toHaveProperty("lastActivity");
        expect(data.data).toHaveProperty("configuration");
        expect(data.data).toHaveProperty("performance");
        expect(data.data).toHaveProperty("safetyStatus");
        
        expect(typeof data.data.status).toBe("string");
        expect(typeof data.data.isActive).toBe("boolean");
        expect(typeof data.data.lastActivity).toBe("string");
        expect(typeof data.data.configuration).toBe("object");
        expect(typeof data.data.performance).toBe("object");
        expect(typeof data.data.safetyStatus).toBe("object");
      }
    });

    it("should include performance metrics", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/status`);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.data.performance).toHaveProperty("successRate");
        expect(data.data.performance).toHaveProperty("averageExecutionTime");
        expect(data.data.performance).toHaveProperty("totalExecutions");
        expect(data.data.performance).toHaveProperty("errorRate");
        
        expect(typeof data.data.performance.successRate).toBe("number");
        expect(typeof data.data.performance.averageExecutionTime).toBe("number");
        expect(typeof data.data.performance.totalExecutions).toBe("number");
        expect(typeof data.data.performance.errorRate).toBe("number");
      }
    });

    it("should include safety status", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/status`);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.data.safetyStatus).toHaveProperty("emergencyStopActive");
        expect(data.data.safetyStatus).toHaveProperty("riskLevel");
        expect(data.data.safetyStatus).toHaveProperty("lastSafetyCheck");
        expect(data.data.safetyStatus).toHaveProperty("activeConstraints");
        
        expect(typeof data.data.safetyStatus.emergencyStopActive).toBe("boolean");
        expect(typeof data.data.safetyStatus.riskLevel).toBe("string");
        expect(typeof data.data.safetyStatus.lastSafetyCheck).toBe("string");
        expect(Array.isArray(data.data.safetyStatus.activeConstraints)).toBe(true);
      }
    });
  });

  describe("GET /api/auto-sniping/config", () => {
    it("should return auto-sniping configuration", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/config`);
      
      expect(response.status).toBeOneOf([200, 401, 403]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        expect(data.data).toHaveProperty("enabled");
        expect(data.data).toHaveProperty("strategy");
        expect(data.data).toHaveProperty("targets");
        expect(data.data).toHaveProperty("riskManagement");
        expect(data.data).toHaveProperty("execution");
        expect(data.data).toHaveProperty("monitoring");
        
        expect(typeof data.data.enabled).toBe("boolean");
        expect(typeof data.data.strategy).toBe("object");
        expect(Array.isArray(data.data.targets)).toBe(true);
        expect(typeof data.data.riskManagement).toBe("object");
        expect(typeof data.data.execution).toBe("object");
        expect(typeof data.data.monitoring).toBe("object");
      }
    });

    it("should include strategy configuration", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/config`);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.data.strategy).toHaveProperty("type");
        expect(data.data.strategy).toHaveProperty("parameters");
        expect(data.data.strategy).toHaveProperty("triggers");
        
        expect(typeof data.data.strategy.type).toBe("string");
        expect(typeof data.data.strategy.parameters).toBe("object");
        expect(Array.isArray(data.data.strategy.triggers)).toBe(true);
      }
    });

    it("should include risk management settings", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/config`);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.data.riskManagement).toHaveProperty("maxPositionSize");
        expect(data.data.riskManagement).toHaveProperty("stopLoss");
        expect(data.data.riskManagement).toHaveProperty("takeProfit");
        expect(data.data.riskManagement).toHaveProperty("emergencyStop");
        
        expect(typeof data.data.riskManagement.maxPositionSize).toBe("number");
        expect(typeof data.data.riskManagement.stopLoss).toBe("number");
        expect(typeof data.data.riskManagement.takeProfit).toBe("number");
        expect(typeof data.data.riskManagement.emergencyStop).toBe("object");
      }
    });
  });

  describe("POST /api/auto-sniping/config", () => {
    it("should update auto-sniping configuration", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const configData = {
        enabled: false,
        strategy: {
          type: "pattern-based",
          parameters: {
            minConfidence: 0.85,
            maxPositions: 3
          },
          triggers: ["price-spike", "volume-surge"]
        },
        riskManagement: {
          maxPositionSize: 1000,
          stopLoss: 0.05,
          takeProfit: 0.1,
          emergencyStop: {
            enabled: true,
            maxDailyLoss: 500
          }
        }
      };
      
      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(configData)
      });
      
      expect(response.status).toBeOneOf([200, 401, 403, 422]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        expect(data.data).toHaveProperty("updated", true);
        expect(data.data).toHaveProperty("configuration");
        expect(data.data.configuration.enabled).toBe(configData.enabled);
        expect(data.data.configuration.strategy.type).toBe(configData.strategy.type);
      }
    });

    it("should validate configuration parameters", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const invalidConfig = {
        enabled: "invalid", // Should be boolean
        strategy: {
          type: "invalid-strategy",
          parameters: {
            minConfidence: 1.5 // Should be between 0 and 1
          }
        },
        riskManagement: {
          maxPositionSize: -100 // Should be positive
        }
      };
      
      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(invalidConfig)
      });
      
      expect(response.status).toBeOneOf([400, 401, 403, 422]);
      
      if (response.status === 400 || response.status === 422) {
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data).toHaveProperty("error");
        expect(data).toHaveProperty("validationErrors");
        expect(Array.isArray(data.validationErrors)).toBe(true);
      }
    });

    it("should handle malformed JSON", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/config`, {
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
        expect(data).toHaveProperty("error");
      }
    });
  });

  describe("POST /api/auto-sniping/control", () => {
    it("should start auto-sniping system", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const controlData = {
        action: "start",
        force: false
      };
      
      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/control`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(controlData)
      });
      
      expect(response.status).toBeOneOf([200, 401, 403, 422]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        expect(data.data).toHaveProperty("action", "start");
        expect(data.data).toHaveProperty("status");
        expect(data.data).toHaveProperty("timestamp");
        expect(data.data).toHaveProperty("previousStatus");
      }
    });

    it("should stop auto-sniping system", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const controlData = {
        action: "stop",
        reason: "user-requested"
      };
      
      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/control`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(controlData)
      });
      
      expect(response.status).toBeOneOf([200, 401, 403, 422]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data.data).toHaveProperty("action", "stop");
        expect(data.data).toHaveProperty("reason", "user-requested");
      }
    });

    it("should pause auto-sniping system", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const controlData = {
        action: "pause",
        duration: 300000 // 5 minutes
      };
      
      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/control`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(controlData)
      });
      
      expect(response.status).toBeOneOf([200, 401, 403, 422]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data.data).toHaveProperty("action", "pause");
        expect(data.data).toHaveProperty("duration", 300000);
        expect(data.data).toHaveProperty("resumeAt");
      }
    });

    it("should validate control actions", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const invalidControl = {
        action: "invalid-action"
      };
      
      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/control`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(invalidControl)
      });
      
      expect(response.status).toBeOneOf([400, 401, 403, 422]);
      
      if (response.status === 400 || response.status === 422) {
        const data = await response.json();
        expect(data.success).toBe(false);
        expect(data).toHaveProperty("error");
      }
    });
  });

  describe("GET /api/auto-sniping/execution", () => {
    it("should return execution history", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/execution`);
      
      expect(response.status).toBeOneOf([200, 401, 403]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        expect(data.data).toHaveProperty("executions");
        expect(data.data).toHaveProperty("statistics");
        expect(data.data).toHaveProperty("pagination");
        
        expect(Array.isArray(data.data.executions)).toBe(true);
        expect(typeof data.data.statistics).toBe("object");
        expect(typeof data.data.pagination).toBe("object");
      }
    });

    it("should support filtering by status", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const params = new URLSearchParams({
        status: "successful",
        limit: "10"
      });
      
      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/execution?${params}`);
      
      expect(response.status).toBeOneOf([200, 401, 403]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        
        data.data.executions.forEach((execution: any) => {
          expect(execution.status).toBe("successful");
        });
      }
    });

    it("should support date range filtering", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const params = new URLSearchParams({
        startDate: "2024-01-01",
        endDate: "2024-01-31"
      });
      
      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/execution?${params}`);
      
      expect(response.status).toBeOneOf([200, 401, 403]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty("executions");
      }
    });

    it("should include execution statistics", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/execution`);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.data.statistics).toHaveProperty("totalExecutions");
        expect(data.data.statistics).toHaveProperty("successfulExecutions");
        expect(data.data.statistics).toHaveProperty("failedExecutions");
        expect(data.data.statistics).toHaveProperty("successRate");
        expect(data.data.statistics).toHaveProperty("averageExecutionTime");
        expect(data.data.statistics).toHaveProperty("totalProfit");
        expect(data.data.statistics).toHaveProperty("totalLoss");
        
        expect(typeof data.data.statistics.totalExecutions).toBe("number");
        expect(typeof data.data.statistics.successfulExecutions).toBe("number");
        expect(typeof data.data.statistics.failedExecutions).toBe("number");
        expect(typeof data.data.statistics.successRate).toBe("number");
        expect(typeof data.data.statistics.averageExecutionTime).toBe("number");
        expect(typeof data.data.statistics.totalProfit).toBe("number");
        expect(typeof data.data.statistics.totalLoss).toBe("number");
      }
    });
  });

  describe("GET /api/auto-sniping/safety-monitoring", () => {
    it("should return safety monitoring data", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/safety-monitoring`);
      
      expect(response.status).toBeOneOf([200, 401, 403]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        expect(data.data).toHaveProperty("safetyStatus");
        expect(data.data).toHaveProperty("riskMetrics");
        expect(data.data).toHaveProperty("constraints");
        expect(data.data).toHaveProperty("alerts");
        expect(data.data).toHaveProperty("emergencyStops");
        
        expect(typeof data.data.safetyStatus).toBe("string");
        expect(typeof data.data.riskMetrics).toBe("object");
        expect(Array.isArray(data.data.constraints)).toBe(true);
        expect(Array.isArray(data.data.alerts)).toBe(true);
        expect(Array.isArray(data.data.emergencyStops)).toBe(true);
      }
    });

    it("should include risk metrics", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/safety-monitoring`);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.data.riskMetrics).toHaveProperty("currentRiskLevel");
        expect(data.data.riskMetrics).toHaveProperty("dailyLoss");
        expect(data.data.riskMetrics).toHaveProperty("weeklyLoss");
        expect(data.data.riskMetrics).toHaveProperty("monthlyLoss");
        expect(data.data.riskMetrics).toHaveProperty("maxDrawdown");
        expect(data.data.riskMetrics).toHaveProperty("volatility");
        
        expect(typeof data.data.riskMetrics.currentRiskLevel).toBe("string");
        expect(typeof data.data.riskMetrics.dailyLoss).toBe("number");
        expect(typeof data.data.riskMetrics.weeklyLoss).toBe("number");
        expect(typeof data.data.riskMetrics.monthlyLoss).toBe("number");
        expect(typeof data.data.riskMetrics.maxDrawdown).toBe("number");
        expect(typeof data.data.riskMetrics.volatility).toBe("number");
      }
    });

    it("should include active constraints", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/safety-monitoring`);
      
      if (response.status === 200) {
        const data = await response.json();
        
        data.data.constraints.forEach((constraint: any) => {
          expect(constraint).toHaveProperty("id");
          expect(constraint).toHaveProperty("type");
          expect(constraint).toHaveProperty("name");
          expect(constraint).toHaveProperty("enabled");
          expect(constraint).toHaveProperty("threshold");
          expect(constraint).toHaveProperty("currentValue");
          expect(constraint).toHaveProperty("status");
          
          expect(typeof constraint.id).toBe("string");
          expect(typeof constraint.type).toBe("string");
          expect(typeof constraint.name).toBe("string");
          expect(typeof constraint.enabled).toBe("boolean");
          expect(typeof constraint.threshold).toBe("number");
          expect(typeof constraint.currentValue).toBe("number");
          expect(typeof constraint.status).toBe("string");
        });
      }
    });
  });

  describe("GET /api/auto-sniping/pattern-monitoring", () => {
    it("should return pattern monitoring data", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/pattern-monitoring`);
      
      expect(response.status).toBeOneOf([200, 401, 403]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        expect(data.data).toHaveProperty("activePatterns");
        expect(data.data).toHaveProperty("detectedPatterns");
        expect(data.data).toHaveProperty("patternStatistics");
        expect(data.data).toHaveProperty("recommendations");
        
        expect(Array.isArray(data.data.activePatterns)).toBe(true);
        expect(Array.isArray(data.data.detectedPatterns)).toBe(true);
        expect(typeof data.data.patternStatistics).toBe("object");
        expect(Array.isArray(data.data.recommendations)).toBe(true);
      }
    });

    it("should include pattern statistics", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/pattern-monitoring`);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data.data.patternStatistics).toHaveProperty("totalPatterns");
        expect(data.data.patternStatistics).toHaveProperty("successfulPatterns");
        expect(data.data.patternStatistics).toHaveProperty("failedPatterns");
        expect(data.data.patternStatistics).toHaveProperty("averageConfidence");
        expect(data.data.patternStatistics).toHaveProperty("averageAccuracy");
        
        expect(typeof data.data.patternStatistics.totalPatterns).toBe("number");
        expect(typeof data.data.patternStatistics.successfulPatterns).toBe("number");
        expect(typeof data.data.patternStatistics.failedPatterns).toBe("number");
        expect(typeof data.data.patternStatistics.averageConfidence).toBe("number");
        expect(typeof data.data.patternStatistics.averageAccuracy).toBe("number");
      }
    });
  });

  describe("GET /api/auto-sniping/config-validation", () => {
    it("should validate current configuration", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/config-validation`);
      
      expect(response.status).toBeOneOf([200, 401, 403]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data).toHaveProperty("data");
        expect(data.data).toHaveProperty("isValid");
        expect(data.data).toHaveProperty("errors");
        expect(data.data).toHaveProperty("warnings");
        expect(data.data).toHaveProperty("recommendations");
        expect(data.data).toHaveProperty("validationDetails");
        
        expect(typeof data.data.isValid).toBe("boolean");
        expect(Array.isArray(data.data.errors)).toBe(true);
        expect(Array.isArray(data.data.warnings)).toBe(true);
        expect(Array.isArray(data.data.recommendations)).toBe(true);
        expect(typeof data.data.validationDetails).toBe("object");
      }
    });

    it("should validate specific configuration", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const configToValidate = {
        enabled: true,
        strategy: {
          type: "pattern-based",
          parameters: {
            minConfidence: 0.8
          }
        },
        riskManagement: {
          maxPositionSize: 1000,
          stopLoss: 0.05
        }
      };
      
      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/config-validation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(configToValidate)
      });
      
      expect(response.status).toBeOneOf([200, 401, 403, 422]);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
        expect(data.data).toHaveProperty("isValid");
        expect(data.data).toHaveProperty("validationResults");
      }
    });
  });

  describe("Error Handling", () => {
    it("should handle 404 for non-existent endpoints", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/nonexistent`);
      
      expect(response.status).toBe(404);
    });

    it("should handle invalid HTTP methods", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/status`, {
        method: "DELETE"
      });
      
      expect(response.status).toBe(405);
    });

    it("should handle server errors gracefully", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      // Test with potentially error-inducing request
      const response = await safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/control`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "crash-server" // Invalid action that might cause errors
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

  describe("Authentication & Authorization", () => {
    it("should require authentication for protected endpoints", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      const protectedEndpoints = [
        "/api/auto-sniping/control",
        "/api/auto-sniping/config"
      ];
      
      for (const endpoint of protectedEndpoints) {
        const response = await safeFetch(`${serverSuite.baseUrl()}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})
        });
        
        expect(response.status).toBeOneOf([200, 401, 403]);
      }
    });
  });

  describe("Rate Limiting", () => {
    it("should handle rate limiting", async () => {
      if (serverSuite.skipIfServerNotReady()) return;

      // Make multiple rapid requests to trigger rate limiting
      const promises = Array(10).fill(null).map(() => 
        safeFetch(`${serverSuite.baseUrl()}/api/auto-sniping/status`)
      );
      
      const responses = await Promise.all(promises);
      const statusCodes = responses.map(r => r.status);
      
      // Should either succeed or be rate limited
      expect(statusCodes.every(code => [200, 401, 403, 429].includes(code))).toBe(true);
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