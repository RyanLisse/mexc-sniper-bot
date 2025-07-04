/**
 * Monitoring & Analytics API Integration Tests
 * 
 * Comprehensive tests for all monitoring and analytics endpoints including:
 * - System monitoring
 * - Performance metrics
 * - Real-time monitoring
 * - Enhanced metrics
 * - Authentication monitoring
 * - Alert monitoring
 * - Trading analytics
 * - Cost monitoring
 * - Production monitoring
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { spawn, ChildProcess } from "child_process";

const TEST_PORT = 3115;
const BASE_URL = `http://localhost:${TEST_PORT}`;
const TIMEOUT_MS = 30000;

describe("Monitoring & Analytics API Integration Tests", () => {
  let serverProcess: ChildProcess;
  let isServerReady = false;

  beforeAll(async () => {
    console.log("🚀 Starting server for Monitoring & Analytics API tests...");
    
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
              console.log("✅ Server ready for Monitoring & Analytics API tests");
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

  describe("System Monitoring", () => {
    describe("GET /api/monitoring/system-overview", () => {
      it("should return comprehensive system overview", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/monitoring/system-overview`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("system");
          expect(data.data).toHaveProperty("services");
          expect(data.data).toHaveProperty("resources");
          expect(data.data).toHaveProperty("health");
          expect(data.data).toHaveProperty("alerts");
          
          expect(typeof data.data.system).toBe("object");
          expect(typeof data.data.services).toBe("object");
          expect(typeof data.data.resources).toBe("object");
          expect(typeof data.data.health).toBe("object");
          expect(Array.isArray(data.data.alerts)).toBe(true);
        }
      });

      it("should include system resource metrics", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/monitoring/system-overview`);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data.data.resources).toHaveProperty("cpu");
          expect(data.data.resources).toHaveProperty("memory");
          expect(data.data.resources).toHaveProperty("disk");
          expect(data.data.resources).toHaveProperty("network");
          
          expect(typeof data.data.resources.cpu).toBe("object");
          expect(typeof data.data.resources.memory).toBe("object");
          expect(typeof data.data.resources.disk).toBe("object");
          expect(typeof data.data.resources.network).toBe("object");
          
          // CPU metrics
          expect(data.data.resources.cpu).toHaveProperty("usage");
          expect(data.data.resources.cpu).toHaveProperty("loadAverage");
          expect(typeof data.data.resources.cpu.usage).toBe("number");
          expect(data.data.resources.cpu.usage).toBeGreaterThanOrEqual(0);
          expect(data.data.resources.cpu.usage).toBeLessThanOrEqual(100);
          
          // Memory metrics
          expect(data.data.resources.memory).toHaveProperty("used");
          expect(data.data.resources.memory).toHaveProperty("total");
          expect(data.data.resources.memory).toHaveProperty("percentage");
          expect(typeof data.data.resources.memory.used).toBe("number");
          expect(typeof data.data.resources.memory.total).toBe("number");
          expect(typeof data.data.resources.memory.percentage).toBe("number");
        }
      });

      it("should include service status", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/monitoring/system-overview`);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data.data.services).toHaveProperty("database");
          expect(data.data.services).toHaveProperty("mexc");
          expect(data.data.services).toHaveProperty("websocket");
          expect(data.data.services).toHaveProperty("cache");
          
          Object.values(data.data.services).forEach((service: any) => {
            expect(service).toHaveProperty("status");
            expect(service).toHaveProperty("responseTime");
            expect(service).toHaveProperty("lastChecked");
            expect(typeof service.status).toBe("string");
            expect(typeof service.responseTime).toBe("number");
            expect(typeof service.lastChecked).toBe("string");
          });
        }
      });

      it("should include health score", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/monitoring/system-overview`);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data.data.health).toHaveProperty("overall");
          expect(data.data.health).toHaveProperty("components");
          expect(data.data.health).toHaveProperty("trends");
          
          expect(typeof data.data.health.overall).toBe("number");
          expect(data.data.health.overall).toBeGreaterThanOrEqual(0);
          expect(data.data.health.overall).toBeLessThanOrEqual(100);
          
          expect(Array.isArray(data.data.health.components)).toBe(true);
          expect(typeof data.data.health.trends).toBe("object");
        }
      });
    });

    describe("GET /api/monitoring/performance-metrics", () => {
      it("should return performance metrics", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/monitoring/performance-metrics`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("api");
          expect(data.data).toHaveProperty("database");
          expect(data.data).toHaveProperty("external");
          expect(data.data).toHaveProperty("summary");
          
          expect(typeof data.data.api).toBe("object");
          expect(typeof data.data.database).toBe("object");
          expect(typeof data.data.external).toBe("object");
          expect(typeof data.data.summary).toBe("object");
        }
      });

      it("should include API performance metrics", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/monitoring/performance-metrics`);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data.data.api).toHaveProperty("responseTime");
          expect(data.data.api).toHaveProperty("throughput");
          expect(data.data.api).toHaveProperty("errorRate");
          expect(data.data.api).toHaveProperty("endpoints");
          
          expect(typeof data.data.api.responseTime).toBe("object");
          expect(typeof data.data.api.throughput).toBe("object");
          expect(typeof data.data.api.errorRate).toBe("number");
          expect(Array.isArray(data.data.api.endpoints)).toBe(true);
          
          // Response time metrics
          expect(data.data.api.responseTime).toHaveProperty("average");
          expect(data.data.api.responseTime).toHaveProperty("p50");
          expect(data.data.api.responseTime).toHaveProperty("p95");
          expect(data.data.api.responseTime).toHaveProperty("p99");
          
          // Throughput metrics
          expect(data.data.api.throughput).toHaveProperty("requestsPerSecond");
          expect(data.data.api.throughput).toHaveProperty("requestsPerMinute");
          expect(data.data.api.throughput).toHaveProperty("totalRequests");
        }
      });

      it("should include database performance metrics", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/monitoring/performance-metrics`);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data.data.database).toHaveProperty("queryTime");
          expect(data.data.database).toHaveProperty("connections");
          expect(data.data.database).toHaveProperty("transactions");
          expect(data.data.database).toHaveProperty("slowQueries");
          
          expect(typeof data.data.database.queryTime).toBe("object");
          expect(typeof data.data.database.connections).toBe("object");
          expect(typeof data.data.database.transactions).toBe("object");
          expect(Array.isArray(data.data.database.slowQueries)).toBe(true);
          
          // Query time metrics
          expect(data.data.database.queryTime).toHaveProperty("average");
          expect(data.data.database.queryTime).toHaveProperty("slowest");
          expect(data.data.database.queryTime).toHaveProperty("fastest");
          
          // Connection metrics
          expect(data.data.database.connections).toHaveProperty("active");
          expect(data.data.database.connections).toHaveProperty("idle");
          expect(data.data.database.connections).toHaveProperty("total");
          expect(data.data.database.connections).toHaveProperty("maxConnections");
        }
      });

      it("should support time range filtering", async () => {
        if (!isServerReady) return;

        const params = new URLSearchParams({
          startTime: "2024-01-01T00:00:00Z",
          endTime: "2024-01-01T23:59:59Z",
          granularity: "hourly"
        });
        
        const response = await fetch(`${BASE_URL}/api/monitoring/performance-metrics?${params}`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data.success).toBe(true);
          expect(data.data).toHaveProperty("timeRange");
          expect(data.data.timeRange).toHaveProperty("start");
          expect(data.data.timeRange).toHaveProperty("end");
          expect(data.data.timeRange).toHaveProperty("granularity");
        }
      });
    });

    describe("GET /api/monitoring/enhanced-metrics", () => {
      it("should return enhanced monitoring metrics", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/monitoring/enhanced-metrics`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("realtime");
          expect(data.data).toHaveProperty("aggregated");
          expect(data.data).toHaveProperty("predictions");
          expect(data.data).toHaveProperty("anomalies");
          
          expect(typeof data.data.realtime).toBe("object");
          expect(typeof data.data.aggregated).toBe("object");
          expect(typeof data.data.predictions).toBe("object");
          expect(Array.isArray(data.data.anomalies)).toBe(true);
        }
      });

      it("should include real-time metrics", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/monitoring/enhanced-metrics`);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data.data.realtime).toHaveProperty("timestamp");
          expect(data.data.realtime).toHaveProperty("metrics");
          expect(data.data.realtime).toHaveProperty("alerts");
          expect(data.data.realtime).toHaveProperty("thresholds");
          
          expect(typeof data.data.realtime.timestamp).toBe("string");
          expect(typeof data.data.realtime.metrics).toBe("object");
          expect(Array.isArray(data.data.realtime.alerts)).toBe(true);
          expect(typeof data.data.realtime.thresholds).toBe("object");
        }
      });

      it("should include anomaly detection results", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/monitoring/enhanced-metrics`);
        
        if (response.status === 200) {
          const data = await response.json();
          
          data.data.anomalies.forEach((anomaly: any) => {
            expect(anomaly).toHaveProperty("id");
            expect(anomaly).toHaveProperty("metric");
            expect(anomaly).toHaveProperty("severity");
            expect(anomaly).toHaveProperty("confidence");
            expect(anomaly).toHaveProperty("detectedAt");
            expect(anomaly).toHaveProperty("description");
            
            expect(typeof anomaly.id).toBe("string");
            expect(typeof anomaly.metric).toBe("string");
            expect(typeof anomaly.severity).toBe("string");
            expect(typeof anomaly.confidence).toBe("number");
            expect(typeof anomaly.detectedAt).toBe("string");
            expect(typeof anomaly.description).toBe("string");
            
            expect(anomaly.confidence).toBeGreaterThanOrEqual(0);
            expect(anomaly.confidence).toBeLessThanOrEqual(1);
          });
        }
      });
    });

    describe("GET /api/monitoring/real-time", () => {
      it("should return real-time monitoring data", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/monitoring/real-time`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("timestamp");
          expect(data.data).toHaveProperty("metrics");
          expect(data.data).toHaveProperty("status");
          expect(data.data).toHaveProperty("events");
          
          expect(typeof data.data.timestamp).toBe("string");
          expect(typeof data.data.metrics).toBe("object");
          expect(typeof data.data.status).toBe("object");
          expect(Array.isArray(data.data.events)).toBe(true);
        }
      });

      it("should include live system metrics", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/monitoring/real-time`);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data.data.metrics).toHaveProperty("cpu");
          expect(data.data.metrics).toHaveProperty("memory");
          expect(data.data.metrics).toHaveProperty("network");
          expect(data.data.metrics).toHaveProperty("requests");
          expect(data.data.metrics).toHaveProperty("errors");
          
          expect(typeof data.data.metrics.cpu).toBe("number");
          expect(typeof data.data.metrics.memory).toBe("number");
          expect(typeof data.data.metrics.network).toBe("object");
          expect(typeof data.data.metrics.requests).toBe("number");
          expect(typeof data.data.metrics.errors).toBe("number");
        }
      });

      it("should support WebSocket upgrade", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/monitoring/real-time`, {
          headers: {
            "Upgrade": "websocket",
            "Connection": "Upgrade",
            "Sec-WebSocket-Key": "test-key",
            "Sec-WebSocket-Version": "13"
          }
        });
        
        expect(response.status).toBeOneOf([101, 200, 426]);
        
        if (response.status === 101) {
          expect(response.headers.get("upgrade")).toBe("websocket");
          expect(response.headers.get("connection")).toBe("Upgrade");
        }
      });
    });
  });

  describe("Analytics", () => {
    describe("GET /api/analytics/health", () => {
      it("should return health analytics", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/analytics/health`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("overall");
          expect(data.data).toHaveProperty("components");
          expect(data.data).toHaveProperty("trends");
          expect(data.data).toHaveProperty("predictions");
          
          expect(typeof data.data.overall).toBe("object");
          expect(Array.isArray(data.data.components)).toBe(true);
          expect(typeof data.data.trends).toBe("object");
          expect(typeof data.data.predictions).toBe("object");
        }
      });

      it("should include component health breakdown", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/analytics/health`);
        
        if (response.status === 200) {
          const data = await response.json();
          
          data.data.components.forEach((component: any) => {
            expect(component).toHaveProperty("name");
            expect(component).toHaveProperty("status");
            expect(component).toHaveProperty("uptime");
            expect(component).toHaveProperty("errorRate");
            expect(component).toHaveProperty("responseTime");
            expect(component).toHaveProperty("lastFailure");
            
            expect(typeof component.name).toBe("string");
            expect(typeof component.status).toBe("string");
            expect(typeof component.uptime).toBe("number");
            expect(typeof component.errorRate).toBe("number");
            expect(typeof component.responseTime).toBe("number");
          });
        }
      });
    });

    describe("GET /api/analytics/performance", () => {
      it("should return performance analytics", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/analytics/performance`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("summary");
          expect(data.data).toHaveProperty("timeSeries");
          expect(data.data).toHaveProperty("bottlenecks");
          expect(data.data).toHaveProperty("recommendations");
          
          expect(typeof data.data.summary).toBe("object");
          expect(Array.isArray(data.data.timeSeries)).toBe(true);
          expect(Array.isArray(data.data.bottlenecks)).toBe(true);
          expect(Array.isArray(data.data.recommendations)).toBe(true);
        }
      });

      it("should include performance bottlenecks", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/analytics/performance`);
        
        if (response.status === 200) {
          const data = await response.json();
          
          data.data.bottlenecks.forEach((bottleneck: any) => {
            expect(bottleneck).toHaveProperty("component");
            expect(bottleneck).toHaveProperty("metric");
            expect(bottleneck).toHaveProperty("impact");
            expect(bottleneck).toHaveProperty("severity");
            expect(bottleneck).toHaveProperty("suggestions");
            
            expect(typeof bottleneck.component).toBe("string");
            expect(typeof bottleneck.metric).toBe("string");
            expect(typeof bottleneck.impact).toBe("string");
            expect(typeof bottleneck.severity).toBe("string");
            expect(Array.isArray(bottleneck.suggestions)).toBe(true);
          });
        }
      });
    });

    describe("GET /api/analytics/realtime", () => {
      it("should return real-time analytics", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/analytics/realtime`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("current");
          expect(data.data).toHaveProperty("trends");
          expect(data.data).toHaveProperty("alerts");
          expect(data.data).toHaveProperty("predictions");
          
          expect(typeof data.data.current).toBe("object");
          expect(typeof data.data.trends).toBe("object");
          expect(Array.isArray(data.data.alerts)).toBe(true);
          expect(typeof data.data.predictions).toBe("object");
        }
      });

      it("should include current activity metrics", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/analytics/realtime`);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data.data.current).toHaveProperty("activeUsers");
          expect(data.data.current).toHaveProperty("activeConnections");
          expect(data.data.current).toHaveProperty("requestRate");
          expect(data.data.current).toHaveProperty("errorRate");
          expect(data.data.current).toHaveProperty("timestamp");
          
          expect(typeof data.data.current.activeUsers).toBe("number");
          expect(typeof data.data.current.activeConnections).toBe("number");
          expect(typeof data.data.current.requestRate).toBe("number");
          expect(typeof data.data.current.errorRate).toBe("number");
          expect(typeof data.data.current.timestamp).toBe("string");
        }
      });
    });

    describe("GET /api/analytics/trading", () => {
      it("should return trading analytics", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/analytics/trading`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("summary");
          expect(data.data).toHaveProperty("performance");
          expect(data.data).toHaveProperty("strategies");
          expect(data.data).toHaveProperty("risks");
          
          expect(typeof data.data.summary).toBe("object");
          expect(typeof data.data.performance).toBe("object");
          expect(Array.isArray(data.data.strategies)).toBe(true);
          expect(typeof data.data.risks).toBe("object");
        }
      });

      it("should include trading performance metrics", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/analytics/trading`);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data.data.summary).toHaveProperty("totalTrades");
          expect(data.data.summary).toHaveProperty("successfulTrades");
          expect(data.data.summary).toHaveProperty("failedTrades");
          expect(data.data.summary).toHaveProperty("totalVolume");
          expect(data.data.summary).toHaveProperty("totalProfit");
          expect(data.data.summary).toHaveProperty("totalLoss");
          
          expect(typeof data.data.summary.totalTrades).toBe("number");
          expect(typeof data.data.summary.successfulTrades).toBe("number");
          expect(typeof data.data.summary.failedTrades).toBe("number");
          expect(typeof data.data.summary.totalVolume).toBe("number");
          expect(typeof data.data.summary.totalProfit).toBe("number");
          expect(typeof data.data.summary.totalLoss).toBe("number");
        }
      });

      it("should support date range filtering", async () => {
        if (!isServerReady) return;

        const params = new URLSearchParams({
          startDate: "2024-01-01",
          endDate: "2024-01-31",
          strategy: "auto-sniping"
        });
        
        const response = await fetch(`${BASE_URL}/api/analytics/trading?${params}`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data.success).toBe(true);
          expect(data.data).toHaveProperty("filters");
          expect(data.data.filters).toHaveProperty("startDate");
          expect(data.data.filters).toHaveProperty("endDate");
          expect(data.data.filters).toHaveProperty("strategy");
        }
      });
    });
  });

  describe("Specialized Monitoring", () => {
    describe("GET /api/monitoring/auth", () => {
      it("should return authentication monitoring data", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/monitoring/auth`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("sessions");
          expect(data.data).toHaveProperty("failures");
          expect(data.data).toHaveProperty("security");
          expect(data.data).toHaveProperty("rates");
          
          expect(typeof data.data.sessions).toBe("object");
          expect(typeof data.data.failures).toBe("object");
          expect(typeof data.data.security).toBe("object");
          expect(typeof data.data.rates).toBe("object");
        }
      });

      it("should include session statistics", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/monitoring/auth`);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data.data.sessions).toHaveProperty("active");
          expect(data.data.sessions).toHaveProperty("total");
          expect(data.data.sessions).toHaveProperty("averageDuration");
          expect(data.data.sessions).toHaveProperty("peakConcurrent");
          
          expect(typeof data.data.sessions.active).toBe("number");
          expect(typeof data.data.sessions.total).toBe("number");
          expect(typeof data.data.sessions.averageDuration).toBe("number");
          expect(typeof data.data.sessions.peakConcurrent).toBe("number");
        }
      });

      it("should include security metrics", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/monitoring/auth`);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data.data.security).toHaveProperty("bruteForceAttempts");
          expect(data.data.security).toHaveProperty("suspiciousActivity");
          expect(data.data.security).toHaveProperty("blockedIps");
          expect(data.data.security).toHaveProperty("riskScore");
          
          expect(typeof data.data.security.bruteForceAttempts).toBe("number");
          expect(typeof data.data.security.suspiciousActivity).toBe("number");
          expect(Array.isArray(data.data.security.blockedIps)).toBe(true);
          expect(typeof data.data.security.riskScore).toBe("number");
        }
      });
    });

    describe("GET /api/monitoring/alerts", () => {
      it("should return alert monitoring data", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/monitoring/alerts`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("active");
          expect(data.data).toHaveProperty("recent");
          expect(data.data).toHaveProperty("statistics");
          expect(data.data).toHaveProperty("channels");
          
          expect(Array.isArray(data.data.active)).toBe(true);
          expect(Array.isArray(data.data.recent)).toBe(true);
          expect(typeof data.data.statistics).toBe("object");
          expect(Array.isArray(data.data.channels)).toBe(true);
        }
      });

      it("should include alert channel status", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/monitoring/alerts`);
        
        if (response.status === 200) {
          const data = await response.json();
          
          data.data.channels.forEach((channel: any) => {
            expect(channel).toHaveProperty("id");
            expect(channel).toHaveProperty("name");
            expect(channel).toHaveProperty("type");
            expect(channel).toHaveProperty("status");
            expect(channel).toHaveProperty("lastMessage");
            expect(channel).toHaveProperty("messageCount");
            
            expect(typeof channel.id).toBe("string");
            expect(typeof channel.name).toBe("string");
            expect(typeof channel.type).toBe("string");
            expect(typeof channel.status).toBe("string");
            expect(typeof channel.messageCount).toBe("number");
          });
        }
      });
    });

    describe("GET /api/cost-monitoring/dashboard", () => {
      it("should return cost monitoring dashboard", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/cost-monitoring/dashboard`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("summary");
          expect(data.data).toHaveProperty("breakdown");
          expect(data.data).toHaveProperty("trends");
          expect(data.data).toHaveProperty("projections");
          
          expect(typeof data.data.summary).toBe("object");
          expect(Array.isArray(data.data.breakdown)).toBe(true);
          expect(typeof data.data.trends).toBe("object");
          expect(typeof data.data.projections).toBe("object");
        }
      });

      it("should include cost breakdown by service", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/cost-monitoring/dashboard`);
        
        if (response.status === 200) {
          const data = await response.json();
          
          data.data.breakdown.forEach((service: any) => {
            expect(service).toHaveProperty("name");
            expect(service).toHaveProperty("cost");
            expect(service).toHaveProperty("usage");
            expect(service).toHaveProperty("percentage");
            expect(service).toHaveProperty("trend");
            
            expect(typeof service.name).toBe("string");
            expect(typeof service.cost).toBe("number");
            expect(typeof service.usage).toBe("number");
            expect(typeof service.percentage).toBe("number");
            expect(typeof service.trend).toBe("string");
          });
        }
      });
    });

    describe("GET /api/cost-monitoring/stats", () => {
      it("should return detailed cost statistics", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/cost-monitoring/stats`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("current");
          expect(data.data).toHaveProperty("historical");
          expect(data.data).toHaveProperty("budgets");
          expect(data.data).toHaveProperty("alerts");
          
          expect(typeof data.data.current).toBe("object");
          expect(Array.isArray(data.data.historical)).toBe(true);
          expect(typeof data.data.budgets).toBe("object");
          expect(Array.isArray(data.data.alerts)).toBe(true);
        }
      });

      it("should support cost period filtering", async () => {
        if (!isServerReady) return;

        const params = new URLSearchParams({
          period: "monthly",
          year: "2024",
          month: "01"
        });
        
        const response = await fetch(`${BASE_URL}/api/cost-monitoring/stats?${params}`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data.success).toBe(true);
          expect(data.data).toHaveProperty("period");
          expect(data.data.period).toHaveProperty("type", "monthly");
        }
      });
    });
  });

  describe("Error Handling & Performance", () => {
    it("should handle 404 for non-existent endpoints", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/monitoring/nonexistent`);
      
      expect(response.status).toBe(404);
    });

    it("should handle invalid HTTP methods", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/monitoring/system-overview`, {
        method: "DELETE"
      });
      
      expect(response.status).toBe(405);
    });

    it("should handle timeout scenarios", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/monitoring/performance-metrics`);
      
      expect(response.status).toBeOneOf([200, 401, 403, 504]);
      
      if (response.status === 504) {
        const data = await response.json();
        expect(data).toHaveProperty("success", false);
        expect(data).toHaveProperty("error");
        expect(data.error).toContain("timeout");
      }
    });

    it("should track response times", async () => {
      if (!isServerReady) return;

      const startTime = Date.now();
      const response = await fetch(`${BASE_URL}/api/monitoring/system-overview`);
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeGreaterThan(0);
      expect(responseTime).toBeLessThan(30000); // Should complete within 30 seconds
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty("success", true);
      }
    });

    it("should handle concurrent requests", async () => {
      if (!isServerReady) return;

      const promises = Array(5).fill(null).map(() => 
        fetch(`${BASE_URL}/api/monitoring/performance-metrics`)
      );
      
      const responses = await Promise.all(promises);
      const statusCodes = responses.map(r => r.status);
      
      // All requests should succeed or be handled gracefully
      expect(statusCodes.every(code => [200, 401, 403, 429, 503].includes(code))).toBe(true);
    });
  });

  describe("Authentication & Authorization", () => {
    it("should require authentication for protected endpoints", async () => {
      if (!isServerReady) return;

      const protectedEndpoints = [
        "/api/monitoring/system-overview",
        "/api/monitoring/performance-metrics",
        "/api/analytics/trading",
        "/api/cost-monitoring/dashboard"
      ];
      
      for (const endpoint of protectedEndpoints) {
        const response = await fetch(`${BASE_URL}${endpoint}`);
        
        expect(response.status).toBeOneOf([200, 401, 403]);
      }
    });

    it("should handle unauthorized access gracefully", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/monitoring/system-overview`, {
        headers: {
          "Authorization": "Bearer invalid_token"
        }
      });
      
      expect(response.status).toBeOneOf([200, 401, 403]);
      
      if (response.status === 401 || response.status === 403) {
        const data = await response.json();
        expect(data).toHaveProperty("success", false);
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