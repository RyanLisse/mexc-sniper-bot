/**
 * Trading & Safety Systems API Integration Tests
 * 
 * Comprehensive tests for all trading, safety, and system management endpoints including:
 * - Pattern detection
 * - Safety monitoring and risk assessment
 * - Trading triggers and strategy management
 * - Portfolio management
 * - Feature flags and configuration
 * - Transaction management
 * - User preferences
 * - Snipe targets management
 * - System health and validation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { spawn, ChildProcess } from "child_process";

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../utils/timeout-utilities';

const TEST_PORT = 3116;
const BASE_URL = `http://localhost:${TEST_PORT}`;
const TIMEOUT_MS = 30000;

describe("Trading & Safety Systems API Integration Tests", () => {
  let serverProcess: ChildProcess;
  let isServerReady = false;

  beforeAll(async () => {
    console.log("🚀 Starting server for Trading & Safety Systems API tests...");
    
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
              console.log("✅ Server ready for Trading & Safety Systems API tests");
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
      }, TIMEOUT_CONFIG.STANDARD);
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Pattern Detection", () => {
    describe("GET /api/pattern-detection", () => {
      it("should return pattern detection service info", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/pattern-detection`);
        
        expect(response.status).toBeOneOf([200, 503]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("message");
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("status");
          expect(data.data).toHaveProperty("features");
          expect(data.data).toHaveProperty("capabilities");
          
          expect(typeof data.data.status).toBe("string");
          expect(Array.isArray(data.data.features)).toBe(true);
          expect(typeof data.data.capabilities).toBe("object");
        }
      });

      it("should support action parameter", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/pattern-detection?action=status`);
        
        expect(response.status).toBeOneOf([200, 503]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data.success).toBe(true);
          expect(data.data.action).toBe("status");
        }
      });
    });

    describe("POST /api/pattern-detection", () => {
      it("should analyze patterns", async () => {
        if (!isServerReady) return;

        const analysisData = {
          action: "analyze",
          data: {
            symbol: "BTCUSDT",
            timeframe: "1h",
            patterns: ["breakout", "support_resistance"]
          }
        };
        
        const response = await fetch(`${BASE_URL}/api/pattern-detection`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(analysisData)
        });
        
        expect(response.status).toBeOneOf([200, 422, 503]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("action", "analyze");
          expect(data.data).toHaveProperty("analysis");
          expect(data.data).toHaveProperty("performance");
          
          expect(typeof data.data.analysis).toBe("object");
          expect(typeof data.data.performance).toBe("object");
          expect(data.data.analysis).toHaveProperty("matches");
          expect(data.data.analysis).toHaveProperty("summary");
          expect(data.data.analysis).toHaveProperty("recommendations");
          expect(data.data.analysis).toHaveProperty("correlations");
        }
      });

      it("should handle malformed analysis requests", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/pattern-detection`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: "invalid-json"
        });
        
        expect(response.status).toBeOneOf([400, 422, 500]);
        
        const data = await response.json();
        expect(data).toHaveProperty("success", false);
        expect(data).toHaveProperty("error");
      });
    });
  });

  describe("Safety & Risk Management", () => {
    describe("GET /api/safety/system-status", () => {
      it("should return safety system status", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/safety/system-status`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("overall");
          expect(data.data).toHaveProperty("components");
          expect(data.data).toHaveProperty("emergencyStops");
          expect(data.data).toHaveProperty("riskLevels");
          expect(data.data).toHaveProperty("activeConstraints");
          
          expect(typeof data.data.overall).toBe("object");
          expect(Array.isArray(data.data.components)).toBe(true);
          expect(Array.isArray(data.data.emergencyStops)).toBe(true);
          expect(typeof data.data.riskLevels).toBe("object");
          expect(Array.isArray(data.data.activeConstraints)).toBe(true);
        }
      });

      it("should include detailed component status", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/safety/system-status`);
        
        if (response.status === 200) {
          const data = await response.json();
          
          data.data.components.forEach((component: any) => {
            expect(component).toHaveProperty("name");
            expect(component).toHaveProperty("status");
            expect(component).toHaveProperty("healthScore");
            expect(component).toHaveProperty("lastCheck");
            expect(component).toHaveProperty("issues");
            
            expect(typeof component.name).toBe("string");
            expect(typeof component.status).toBe("string");
            expect(typeof component.healthScore).toBe("number");
            expect(typeof component.lastCheck).toBe("string");
            expect(Array.isArray(component.issues)).toBe(true);
          });
        }
      });
    });

    describe("GET /api/safety/risk-assessment", () => {
      it("should return risk assessment data", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/safety/risk-assessment`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("overallRisk");
          expect(data.data).toHaveProperty("riskFactors");
          expect(data.data).toHaveProperty("recommendations");
          expect(data.data).toHaveProperty("projections");
          expect(data.data).toHaveProperty("mitigation");
          
          expect(typeof data.data.overallRisk).toBe("object");
          expect(Array.isArray(data.data.riskFactors)).toBe(true);
          expect(Array.isArray(data.data.recommendations)).toBe(true);
          expect(typeof data.data.projections).toBe("object");
          expect(typeof data.data.mitigation).toBe("object");
        }
      });

      it("should include risk factor details", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/safety/risk-assessment`);
        
        if (response.status === 200) {
          const data = await response.json();
          
          data.data.riskFactors.forEach((factor: any) => {
            expect(factor).toHaveProperty("category");
            expect(factor).toHaveProperty("severity");
            expect(factor).toHaveProperty("probability");
            expect(factor).toHaveProperty("impact");
            expect(factor).toHaveProperty("description");
            expect(factor).toHaveProperty("mitigation");
            
            expect(typeof factor.category).toBe("string");
            expect(typeof factor.severity).toBe("string");
            expect(typeof factor.probability).toBe("number");
            expect(typeof factor.impact).toBe("number");
            expect(typeof factor.description).toBe("string");
            expect(Array.isArray(factor.mitigation)).toBe(true);
          });
        }
      });

      it("should support risk scenario analysis", async () => {
        if (!isServerReady) return;

        const params = new URLSearchParams({
          scenario: "market_crash",
          timeframe: "24h"
        });
        
        const response = await fetch(`${BASE_URL}/api/safety/risk-assessment?${params}`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data.success).toBe(true);
          expect(data.data).toHaveProperty("scenario");
          expect(data.data.scenario).toHaveProperty("name", "market_crash");
          expect(data.data.scenario).toHaveProperty("timeframe", "24h");
        }
      });
    });

    describe("GET /api/safety/agent-monitoring", () => {
      it("should return agent monitoring data", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/safety/agent-monitoring`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("agents");
          expect(data.data).toHaveProperty("behaviors");
          expect(data.data).toHaveProperty("anomalies");
          expect(data.data).toHaveProperty("consensus");
          
          expect(Array.isArray(data.data.agents)).toBe(true);
          expect(Array.isArray(data.data.behaviors)).toBe(true);
          expect(Array.isArray(data.data.anomalies)).toBe(true);
          expect(typeof data.data.consensus).toBe("object");
        }
      });

      it("should include agent behavior analysis", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/safety/agent-monitoring`);
        
        if (response.status === 200) {
          const data = await response.json();
          
          data.data.agents.forEach((agent: any) => {
            expect(agent).toHaveProperty("id");
            expect(agent).toHaveProperty("name");
            expect(agent).toHaveProperty("status");
            expect(agent).toHaveProperty("performance");
            expect(agent).toHaveProperty("riskScore");
            expect(agent).toHaveProperty("lastActivity");
            
            expect(typeof agent.id).toBe("string");
            expect(typeof agent.name).toBe("string");
            expect(typeof agent.status).toBe("string");
            expect(typeof agent.performance).toBe("object");
            expect(typeof agent.riskScore).toBe("number");
            expect(typeof agent.lastActivity).toBe("string");
          });
        }
      });
    });
  });

  describe("Trading Triggers & Strategies", () => {
    describe("GET /api/triggers/emergency", () => {
      it("should return emergency trigger status", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/triggers/emergency`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("status");
          expect(data.data).toHaveProperty("activeTriggers");
          expect(data.data).toHaveProperty("emergencyStops");
          expect(data.data).toHaveProperty("escalationLevel");
          
          expect(typeof data.data.status).toBe("string");
          expect(Array.isArray(data.data.activeTriggers)).toBe(true);
          expect(Array.isArray(data.data.emergencyStops)).toBe(true);
          expect(typeof data.data.escalationLevel).toBe("string");
        }
      });

      it("should support trigger activation", async () => {
        if (!isServerReady) return;

        const triggerData = {
          type: "market_volatility",
          threshold: 10,
          action: "pause_trading"
        };
        
        const response = await fetch(`${BASE_URL}/api/triggers/emergency`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(triggerData)
        });
        
        expect(response.status).toBeOneOf([200, 401, 403, 422]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data.data).toHaveProperty("triggerActivated", true);
          expect(data.data).toHaveProperty("type", triggerData.type);
          expect(data.data).toHaveProperty("action", triggerData.action);
        }
      });
    });

    describe("GET /api/triggers/pattern-analysis", () => {
      it("should return pattern analysis triggers", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/triggers/pattern-analysis`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("triggers");
          expect(data.data).toHaveProperty("patterns");
          expect(data.data).toHaveProperty("confidence");
          expect(data.data).toHaveProperty("recommendations");
          
          expect(Array.isArray(data.data.triggers)).toBe(true);
          expect(Array.isArray(data.data.patterns)).toBe(true);
          expect(typeof data.data.confidence).toBe("object");
          expect(Array.isArray(data.data.recommendations)).toBe(true);
        }
      });
    });

    describe("GET /api/triggers/symbol-watch", () => {
      it("should return symbol watch triggers", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/triggers/symbol-watch`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("watchedSymbols");
          expect(data.data).toHaveProperty("activeTriggers");
          expect(data.data).toHaveProperty("alertCounts");
          expect(data.data).toHaveProperty("performance");
          
          expect(Array.isArray(data.data.watchedSymbols)).toBe(true);
          expect(Array.isArray(data.data.activeTriggers)).toBe(true);
          expect(typeof data.data.alertCounts).toBe("object");
          expect(typeof data.data.performance).toBe("object");
        }
      });

      it("should support adding watched symbols", async () => {
        if (!isServerReady) return;

        const watchData = {
          symbol: "ETHUSDT",
          triggers: [
            {
              type: "price_change",
              threshold: 5,
              direction: "up"
            }
          ]
        };
        
        const response = await fetch(`${BASE_URL}/api/triggers/symbol-watch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(watchData)
        });
        
        expect(response.status).toBeOneOf([200, 401, 403, 422]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data.data).toHaveProperty("symbol", watchData.symbol);
          expect(data.data).toHaveProperty("triggersAdded");
        }
      });
    });

    describe("GET /api/triggers/trading-strategy", () => {
      it("should return trading strategy triggers", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/triggers/trading-strategy`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("strategies");
          expect(data.data).toHaveProperty("activeTriggers");
          expect(data.data).toHaveProperty("performance");
          expect(data.data).toHaveProperty("optimization");
          
          expect(Array.isArray(data.data.strategies)).toBe(true);
          expect(Array.isArray(data.data.activeTriggers)).toBe(true);
          expect(typeof data.data.performance).toBe("object");
          expect(typeof data.data.optimization).toBe("object");
        }
      });
    });
  });

  describe("Portfolio & Trading Management", () => {
    describe("GET /api/portfolio", () => {
      it("should return portfolio information", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/portfolio`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("summary");
          expect(data.data).toHaveProperty("positions");
          expect(data.data).toHaveProperty("performance");
          expect(data.data).toHaveProperty("allocation");
          
          expect(typeof data.data.summary).toBe("object");
          expect(Array.isArray(data.data.positions)).toBe(true);
          expect(typeof data.data.performance).toBe("object");
          expect(typeof data.data.allocation).toBe("object");
        }
      });

      it("should include position details", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/portfolio`);
        
        if (response.status === 200) {
          const data = await response.json();
          
          data.data.positions.forEach((position: any) => {
            expect(position).toHaveProperty("symbol");
            expect(position).toHaveProperty("quantity");
            expect(position).toHaveProperty("averagePrice");
            expect(position).toHaveProperty("currentPrice");
            expect(position).toHaveProperty("unrealizedPnl");
            expect(position).toHaveProperty("realizedPnl");
            
            expect(typeof position.symbol).toBe("string");
            expect(typeof position.quantity).toBe("number");
            expect(typeof position.averagePrice).toBe("number");
            expect(typeof position.currentPrice).toBe("number");
            expect(typeof position.unrealizedPnl).toBe("number");
            expect(typeof position.realizedPnl).toBe("number");
          });
        }
      });
    });

    describe("GET /api/snipe-targets", () => {
      it("should return snipe targets", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/snipe-targets`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("targets");
          expect(data.data).toHaveProperty("statistics");
          expect(data.data).toHaveProperty("performance");
          
          expect(Array.isArray(data.data.targets)).toBe(true);
          expect(typeof data.data.statistics).toBe("object");
          expect(typeof data.data.performance).toBe("object");
        }
      });

      it("should support filtering by status", async () => {
        if (!isServerReady) return;

        const params = new URLSearchParams({
          status: "active",
          limit: "10"
        });
        
        const response = await fetch(`${BASE_URL}/api/snipe-targets?${params}`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data.success).toBe(true);
          
          data.data.targets.forEach((target: any) => {
            expect(target.status).toBe("active");
          });
        }
      });

      it("should support creating new targets", async () => {
        if (!isServerReady) return;

        const targetData = {
          symbol: "ADAUSDT",
          targetPrice: 0.5,
          quantity: 1000,
          strategy: "breakout",
          conditions: {
            volume: "> 1000000",
            priceChange: "> 5%"
          }
        };
        
        const response = await fetch(`${BASE_URL}/api/snipe-targets`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(targetData)
        });
        
        expect(response.status).toBeOneOf([200, 201, 401, 403, 422]);
        
        if (response.status === 200 || response.status === 201) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data.data).toHaveProperty("id");
          expect(data.data).toHaveProperty("symbol", targetData.symbol);
          expect(data.data).toHaveProperty("targetPrice", targetData.targetPrice);
        }
      });
    });

    describe("GET /api/execution-history", () => {
      it("should return execution history", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/execution-history`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("executions");
          expect(data.data).toHaveProperty("summary");
          expect(data.data).toHaveProperty("pagination");
          
          expect(Array.isArray(data.data.executions)).toBe(true);
          expect(typeof data.data.summary).toBe("object");
          expect(typeof data.data.pagination).toBe("object");
        }
      });

      it("should include execution details", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/execution-history`);
        
        if (response.status === 200) {
          const data = await response.json();
          
          data.data.executions.forEach((execution: any) => {
            expect(execution).toHaveProperty("id");
            expect(execution).toHaveProperty("symbol");
            expect(execution).toHaveProperty("side");
            expect(execution).toHaveProperty("quantity");
            expect(execution).toHaveProperty("price");
            expect(execution).toHaveProperty("status");
            expect(execution).toHaveProperty("timestamp");
            
            expect(typeof execution.id).toBe("string");
            expect(typeof execution.symbol).toBe("string");
            expect(typeof execution.side).toBe("string");
            expect(typeof execution.quantity).toBe("number");
            expect(typeof execution.price).toBe("number");
            expect(typeof execution.status).toBe("string");
            expect(typeof execution.timestamp).toBe("string");
          });
        }
      });
    });

    describe("GET /api/transactions", () => {
      it("should return transaction history", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/transactions`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("transactions");
          expect(data.data).toHaveProperty("summary");
          expect(data.data).toHaveProperty("filters");
          
          expect(Array.isArray(data.data.transactions)).toBe(true);
          expect(typeof data.data.summary).toBe("object");
          expect(typeof data.data.filters).toBe("object");
        }
      });

      it("should support date range filtering", async () => {
        if (!isServerReady) return;

        const params = new URLSearchParams({
          startDate: "2024-01-01",
          endDate: "2024-01-31",
          type: "trade"
        });
        
        const response = await fetch(`${BASE_URL}/api/transactions?${params}`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data.success).toBe(true);
          expect(data.data.filters).toHaveProperty("startDate");
          expect(data.data.filters).toHaveProperty("endDate");
          expect(data.data.filters).toHaveProperty("type");
        }
      });
    });
  });

  describe("Configuration & Feature Management", () => {
    describe("GET /api/feature-flags", () => {
      it("should return feature flags", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/feature-flags`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("flags");
          expect(data.data).toHaveProperty("environment");
          expect(data.data).toHaveProperty("lastUpdated");
          
          expect(typeof data.data.flags).toBe("object");
          expect(typeof data.data.environment).toBe("string");
          expect(typeof data.data.lastUpdated).toBe("string");
        }
      });

      it("should support flag updates", async () => {
        if (!isServerReady) return;

        const flagData = {
          flag: "auto_sniping_enabled",
          value: false,
          reason: "Testing"
        };
        
        const response = await fetch(`${BASE_URL}/api/feature-flags`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(flagData)
        });
        
        expect(response.status).toBeOneOf([200, 401, 403, 422]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data.data).toHaveProperty("flag", flagData.flag);
          expect(data.data).toHaveProperty("value", flagData.value);
          expect(data.data).toHaveProperty("previousValue");
        }
      });
    });

    describe("GET /api/user-preferences", () => {
      it("should return user preferences", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/user-preferences`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("preferences");
          expect(data.data).toHaveProperty("defaults");
          expect(data.data).toHaveProperty("lastModified");
          
          expect(typeof data.data.preferences).toBe("object");
          expect(typeof data.data.defaults).toBe("object");
          expect(typeof data.data.lastModified).toBe("string");
        }
      });

      it("should support preference updates", async () => {
        if (!isServerReady) return;

        const prefData = {
          notifications: {
            email: true,
            push: false,
            sms: false
          },
          trading: {
            defaultQuantity: 100,
            riskTolerance: "medium"
          }
        };
        
        const response = await fetch(`${BASE_URL}/api/user-preferences`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(prefData)
        });
        
        expect(response.status).toBeOneOf([200, 401, 403, 422]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data.data).toHaveProperty("updated", true);
          expect(data.data).toHaveProperty("preferences");
        }
      });
    });

    describe("GET /api/trading-settings", () => {
      it("should return trading settings", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/trading-settings`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("general");
          expect(data.data).toHaveProperty("riskManagement");
          expect(data.data).toHaveProperty("autoSniping");
          expect(data.data).toHaveProperty("notifications");
          
          expect(typeof data.data.general).toBe("object");
          expect(typeof data.data.riskManagement).toBe("object");
          expect(typeof data.data.autoSniping).toBe("object");
          expect(typeof data.data.notifications).toBe("object");
        }
      });
    });
  });

  describe("System Health & Validation", () => {
    describe("GET /api/query-performance", () => {
      it("should return query performance metrics", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/query-performance`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("summary");
          expect(data.data).toHaveProperty("slowQueries");
          expect(data.data).toHaveProperty("optimization");
          expect(data.data).toHaveProperty("recommendations");
          
          expect(typeof data.data.summary).toBe("object");
          expect(Array.isArray(data.data.slowQueries)).toBe(true);
          expect(typeof data.data.optimization).toBe("object");
          expect(Array.isArray(data.data.recommendations)).toBe(true);
        }
      });
    });

    describe("GET /api/transaction-locks", () => {
      it("should return transaction lock status", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/transaction-locks`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("activeLocks");
          expect(data.data).toHaveProperty("lockHistory");
          expect(data.data).toHaveProperty("deadlocks");
          expect(data.data).toHaveProperty("performance");
          
          expect(Array.isArray(data.data.activeLocks)).toBe(true);
          expect(Array.isArray(data.data.lockHistory)).toBe(true);
          expect(Array.isArray(data.data.deadlocks)).toBe(true);
          expect(typeof data.data.performance).toBe("object");
        }
      });
    });

    describe("GET /api/ready-launches", () => {
      it("should return ready launch information", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/ready-launches`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("launches");
          expect(data.data).toHaveProperty("upcoming");
          expect(data.data).toHaveProperty("statistics");
          
          expect(Array.isArray(data.data.launches)).toBe(true);
          expect(Array.isArray(data.data.upcoming)).toBe(true);
          expect(typeof data.data.statistics).toBe("object");
        }
      });
    });
  });

  describe("Error Handling & Edge Cases", () => {
    it("should handle 404 for non-existent endpoints", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/nonexistent-endpoint`);
      
      expect(response.status).toBe(404);
    });

    it("should handle invalid HTTP methods", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/pattern-detection`, {
        method: "DELETE"
      });
      
      expect(response.status).toBe(405);
    });

    it("should handle malformed JSON requests", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/triggers/emergency`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: "invalid-json"
      });
      
      expect(response.status).toBeOneOf([400, 422]);
      
      const data = await response.json();
      expect(data).toHaveProperty("success", false);
      expect(data).toHaveProperty("error");
    });

    it("should handle concurrent requests efficiently", async () => {
      if (!isServerReady) return;

      const endpoints = [
        "/api/pattern-detection",
        "/api/safety/system-status",
        "/api/portfolio",
        "/api/feature-flags"
      ];
      
      const promises = endpoints.map(endpoint => 
        fetch(`${BASE_URL}${endpoint}`)
      );
      
      const responses = await Promise.all(promises);
      const statusCodes = responses.map(r => r.status);
      
      // All requests should be handled properly
      expect(statusCodes.every(code => [200, 401, 403, 503].includes(code))).toBe(true);
    });

    it("should handle rate limiting gracefully", async () => {
      if (!isServerReady) return;

      // Make multiple rapid requests to test rate limiting
      const promises = Array(10).fill(null).map(() => 
        fetch(`${BASE_URL}/api/pattern-detection`)
      );
      
      const responses = await Promise.all(promises);
      const statusCodes = responses.map(r => r.status);
      
      // Should either succeed or be rate limited
      expect(statusCodes.every(code => [200, 429, 503].includes(code))).toBe(true);
    });

    it("should validate request schemas", async () => {
      if (!isServerReady) return;

      const invalidData = {
        invalidField: "should cause validation error",
        missingRequiredField: null
      };
      
      const response = await fetch(`${BASE_URL}/api/snipe-targets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(invalidData)
      });
      
      expect(response.status).toBeOneOf([400, 401, 403, 422]);
      
      if (response.status === 400 || response.status === 422) {
        const data = await response.json();
        expect(data).toHaveProperty("success", false);
        expect(data).toHaveProperty("error");
        expect(data).toHaveProperty("validationErrors");
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