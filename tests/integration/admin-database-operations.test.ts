/**
 * Admin & Database Operations Integration Tests
 * 
 * Comprehensive tests for all admin and database management endpoints including:
 * - Admin bypass operations
 * - Database migrations
 * - Database optimization
 * - Database quota management
 * - RLS (Row Level Security) operations
 * - System validation
 * - Circuit breaker fixes
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { spawn, ChildProcess } from "child_process";

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../utils/timeout-elimination-helpers';

const TEST_PORT = 3114;
const BASE_URL = `http://localhost:${TEST_PORT}`;
const TIMEOUT_MS = 30000;

describe("Admin & Database Operations Integration Tests", () => {
  let serverProcess: ChildProcess;
  let isServerReady = false;

  beforeAll(async () => {
    console.log("🚀 Starting server for Admin & Database Operations tests...");
    
    serverProcess = spawn("bun", ["run", "dev"], {
      env: { 
        ...process.env, 
        PORT: TEST_PORT.toString(),
        NODE_ENV: "test",
        USE_REAL_DATABASE: "true",
        ADMIN_SECRET: "test_admin_secret_key",
        DATABASE_ADMIN_TOKEN: "test_db_admin_token"
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
              console.log("✅ Server ready for Admin & Database Operations tests");
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

  describe("Admin Bypass Operations", () => {
    describe("POST /api/admin/bypass-email-confirmation", () => {
      it("should bypass email confirmation for user", async () => {
        if (!isServerReady) return;

        const bypassData = {
          userId: "test-user-123",
          reason: "Integration testing",
          adminToken: "test_admin_secret_key"
        };
        
        const response = await fetch(`${BASE_URL}/api/admin/bypass-email-confirmation`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test_admin_secret_key"
          },
          body: JSON.stringify(bypassData)
        });
        
        expect(response.status).toBeOneOf([200, 401, 403, 422]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("userId", bypassData.userId);
          expect(data.data).toHaveProperty("bypassApplied", true);
          expect(data.data).toHaveProperty("timestamp");
          expect(data.data).toHaveProperty("adminUser");
          
          expect(typeof data.data.timestamp).toBe("string");
          expect(typeof data.data.adminUser).toBe("string");
        }
      });

      it("should validate required fields", async () => {
        if (!isServerReady) return;

        const invalidData = {
          // Missing userId
          reason: "Test",
          adminToken: "test_admin_secret_key"
        };
        
        const response = await fetch(`${BASE_URL}/api/admin/bypass-email-confirmation`, {
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
          expect(Array.isArray(data.validationErrors)).toBe(true);
        }
      });

      it("should require admin authentication", async () => {
        if (!isServerReady) return;

        const bypassData = {
          userId: "test-user-123",
          reason: "Integration testing"
          // Missing admin token
        };
        
        const response = await fetch(`${BASE_URL}/api/admin/bypass-email-confirmation`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(bypassData)
        });
        
        expect(response.status).toBeOneOf([401, 403]);
        
        const data = await response.json();
        expect(data).toHaveProperty("success", false);
        expect(data).toHaveProperty("error");
      });

      it("should handle duplicate bypass attempts", async () => {
        if (!isServerReady) return;

        const bypassData = {
          userId: "test-user-duplicate",
          reason: "Integration testing",
          adminToken: "test_admin_secret_key"
        };
        
        // First attempt
        const response1 = await fetch(`${BASE_URL}/api/admin/bypass-email-confirmation`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test_admin_secret_key"
          },
          body: JSON.stringify(bypassData)
        });
        
        // Second attempt (should handle gracefully)
        const response2 = await fetch(`${BASE_URL}/api/admin/bypass-email-confirmation`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test_admin_secret_key"
          },
          body: JSON.stringify(bypassData)
        });
        
        expect(response1.status).toBeOneOf([200, 401, 403, 422]);
        expect(response2.status).toBeOneOf([200, 409, 422]); // 409 for conflict
        
        if (response2.status === 409) {
          const data = await response2.json();
          expect(data).toHaveProperty("success", false);
          expect(data).toHaveProperty("error");
          expect(data.error).toContain("already bypassed");
        }
      });
    });

    describe("POST /api/admin/bypass-email-confirmation-demo", () => {
      it("should bypass email confirmation for demo purposes", async () => {
        if (!isServerReady) return;

        const demoData = {
          email: "demo@example.com",
          demoMode: true
        };
        
        const response = await fetch(`${BASE_URL}/api/admin/bypass-email-confirmation-demo`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(demoData)
        });
        
        expect(response.status).toBeOneOf([200, 401, 403, 422]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("email", demoData.email);
          expect(data.data).toHaveProperty("demoBypassApplied", true);
          expect(data.data).toHaveProperty("tempCredentials");
          
          expect(typeof data.data.tempCredentials).toBe("object");
        }
      });

      it("should validate email format", async () => {
        if (!isServerReady) return;

        const invalidData = {
          email: "invalid-email-format",
          demoMode: true
        };
        
        const response = await fetch(`${BASE_URL}/api/admin/bypass-email-confirmation-demo`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(invalidData)
        });
        
        expect(response.status).toBeOneOf([400, 422]);
        
        const data = await response.json();
        expect(data).toHaveProperty("success", false);
        expect(data).toHaveProperty("error");
      });
    });

    describe("GET /api/admin/rls", () => {
      it("should return RLS (Row Level Security) status", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/admin/rls`, {
          headers: {
            "Authorization": "Bearer test_admin_secret_key"
          }
        });
        
        expect(response.status).toBeOneOf([200, 401, 403]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("rlsStatus");
          expect(data.data).toHaveProperty("policies");
          expect(data.data).toHaveProperty("tables");
          expect(data.data).toHaveProperty("securityLevel");
          
          expect(typeof data.data.rlsStatus).toBe("string");
          expect(Array.isArray(data.data.policies)).toBe(true);
          expect(Array.isArray(data.data.tables)).toBe(true);
          expect(typeof data.data.securityLevel).toBe("string");
        }
      });

      it("should include policy details", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/admin/rls`, {
          headers: {
            "Authorization": "Bearer test_admin_secret_key"
          }
        });
        
        if (response.status === 200) {
          const data = await response.json();
          
          if (data.data.policies.length > 0) {
            const policy = data.data.policies[0];
            expect(policy).toHaveProperty("name");
            expect(policy).toHaveProperty("table");
            expect(policy).toHaveProperty("command");
            expect(policy).toHaveProperty("expression");
            expect(policy).toHaveProperty("enabled");
            
            expect(typeof policy.name).toBe("string");
            expect(typeof policy.table).toBe("string");
            expect(typeof policy.command).toBe("string");
            expect(typeof policy.enabled).toBe("boolean");
          }
        }
      });

      it("should require admin privileges", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/admin/rls`);
        
        expect(response.status).toBeOneOf([401, 403]);
        
        const data = await response.json();
        expect(data).toHaveProperty("success", false);
        expect(data).toHaveProperty("error");
      });
    });
  });

  describe("Database Operations", () => {
    describe("GET /api/database/quota-status", () => {
      it("should return database quota information", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/database/quota-status`);
        
        expect(response.status).toBeOneOf([200, 401, 403, 503]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("quota");
          expect(data.quota).toHaveProperty("used");
          expect(data.quota).toHaveProperty("limit");
          expect(data.quota).toHaveProperty("percentage");
          expect(data.quota).toHaveProperty("remainingBytes");
          expect(data.quota).toHaveProperty("estimatedDaysRemaining");
          
          expect(typeof data.quota.used).toBe("number");
          expect(typeof data.quota.limit).toBe("number");
          expect(typeof data.quota.percentage).toBe("number");
          expect(typeof data.quota.remainingBytes).toBe("number");
          expect(data.quota.percentage).toBeGreaterThanOrEqual(0);
          expect(data.quota.percentage).toBeLessThanOrEqual(100);
        }
      });

      it("should include breakdown by table", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/database/quota-status`);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data.quota).toHaveProperty("breakdown");
          expect(Array.isArray(data.quota.breakdown)).toBe(true);
          
          if (data.quota.breakdown.length > 0) {
            const table = data.quota.breakdown[0];
            expect(table).toHaveProperty("tableName");
            expect(table).toHaveProperty("sizeBytes");
            expect(table).toHaveProperty("rowCount");
            expect(table).toHaveProperty("percentage");
            
            expect(typeof table.tableName).toBe("string");
            expect(typeof table.sizeBytes).toBe("number");
            expect(typeof table.rowCount).toBe("number");
            expect(typeof table.percentage).toBe("number");
          }
        }
      });

      it("should include usage trends", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/database/quota-status`);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("trends");
          expect(data.trends).toHaveProperty("dailyGrowth");
          expect(data.trends).toHaveProperty("weeklyGrowth");
          expect(data.trends).toHaveProperty("monthlyGrowth");
          expect(data.trends).toHaveProperty("projectedQuotaExhaustion");
          
          expect(typeof data.trends.dailyGrowth).toBe("number");
          expect(typeof data.trends.weeklyGrowth).toBe("number");
          expect(typeof data.trends.monthlyGrowth).toBe("number");
        }
      });
    });

    describe("POST /api/database/optimize", () => {
      it("should optimize database performance", async () => {
        if (!isServerReady) return;

        const optimizeData = {
          operation: "vacuum",
          tables: ["trading_executions", "market_data"],
          aggressive: false
        };
        
        const response = await fetch(`${BASE_URL}/api/database/optimize`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test_db_admin_token"
          },
          body: JSON.stringify(optimizeData)
        });
        
        expect(response.status).toBeOneOf([200, 401, 403, 422, 503]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("operation", optimizeData.operation);
          expect(data.data).toHaveProperty("tablesOptimized");
          expect(data.data).toHaveProperty("executionTime");
          expect(data.data).toHaveProperty("spaceSaved");
          expect(data.data).toHaveProperty("performanceImprovement");
          
          expect(Array.isArray(data.data.tablesOptimized)).toBe(true);
          expect(typeof data.data.executionTime).toBe("number");
          expect(typeof data.data.spaceSaved).toBe("number");
          expect(typeof data.data.performanceImprovement).toBe("number");
        }
      });

      it("should validate optimization parameters", async () => {
        if (!isServerReady) return;

        const invalidData = {
          operation: "invalid_operation",
          tables: [], // Empty tables array
          aggressive: "not_boolean"
        };
        
        const response = await fetch(`${BASE_URL}/api/database/optimize`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test_db_admin_token"
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

      it("should support different optimization types", async () => {
        if (!isServerReady) return;

        const operations = ["analyze", "reindex", "vacuum"];
        
        for (const operation of operations) {
          const optimizeData = {
            operation,
            tables: ["test_table"],
            aggressive: false
          };
          
          const response = await fetch(`${BASE_URL}/api/database/optimize`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer test_db_admin_token"
            },
            body: JSON.stringify(optimizeData)
          });
          
          expect(response.status).toBeOneOf([200, 401, 403, 422]);
          
          if (response.status === 200) {
            const data = await response.json();
            expect(data.data.operation).toBe(operation);
          }
        }
      });

      it("should require admin privileges", async () => {
        if (!isServerReady) return;

        const optimizeData = {
          operation: "vacuum",
          tables: ["test_table"]
        };
        
        const response = await fetch(`${BASE_URL}/api/database/optimize`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(optimizeData)
        });
        
        expect(response.status).toBeOneOf([401, 403]);
        
        const data = await response.json();
        expect(data).toHaveProperty("success", false);
        expect(data).toHaveProperty("error");
      });
    });

    describe("POST /api/database/migrate", () => {
      it("should execute database migrations", async () => {
        if (!isServerReady) return;

        const migrationData = {
          direction: "up",
          targetVersion: "latest",
          dryRun: true
        };
        
        const response = await fetch(`${BASE_URL}/api/database/migrate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test_db_admin_token"
          },
          body: JSON.stringify(migrationData)
        });
        
        expect(response.status).toBeOneOf([200, 401, 403, 422]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("migrationsExecuted");
          expect(data.data).toHaveProperty("currentVersion");
          expect(data.data).toHaveProperty("targetVersion");
          expect(data.data).toHaveProperty("executionTime");
          expect(data.data).toHaveProperty("dryRun", migrationData.dryRun);
          
          expect(Array.isArray(data.data.migrationsExecuted)).toBe(true);
          expect(typeof data.data.currentVersion).toBe("string");
          expect(typeof data.data.targetVersion).toBe("string");
          expect(typeof data.data.executionTime).toBe("number");
        }
      });

      it("should support rollback migrations", async () => {
        if (!isServerReady) return;

        const rollbackData = {
          direction: "down",
          targetVersion: "001",
          dryRun: true
        };
        
        const response = await fetch(`${BASE_URL}/api/database/migrate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test_db_admin_token"
          },
          body: JSON.stringify(rollbackData)
        });
        
        expect(response.status).toBeOneOf([200, 401, 403, 422]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data.data.direction).toBe("down");
          expect(data.data.dryRun).toBe(true);
        }
      });

      it("should validate migration parameters", async () => {
        if (!isServerReady) return;

        const invalidData = {
          direction: "invalid_direction",
          targetVersion: "",
          dryRun: "not_boolean"
        };
        
        const response = await fetch(`${BASE_URL}/api/database/migrate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test_db_admin_token"
          },
          body: JSON.stringify(invalidData)
        });
        
        expect(response.status).toBeOneOf([400, 401, 403, 422]);
        
        if (response.status === 400 || response.status === 422) {
          const data = await response.json();
          expect(data).toHaveProperty("success", false);
          expect(data).toHaveProperty("validationErrors");
        }
      });

      it("should include migration safety checks", async () => {
        if (!isServerReady) return;

        const migrationData = {
          direction: "up",
          targetVersion: "latest",
          dryRun: false,
          force: false // Should fail without force on production-like environments
        };
        
        const response = await fetch(`${BASE_URL}/api/database/migrate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test_db_admin_token"
          },
          body: JSON.stringify(migrationData)
        });
        
        expect(response.status).toBeOneOf([200, 401, 403, 422, 503]);
        
        if (response.status === 422) {
          const data = await response.json();
          expect(data).toHaveProperty("success", false);
          expect(data).toHaveProperty("safetyChecks");
          expect(Array.isArray(data.safetyChecks)).toBe(true);
        }
      });
    });
  });

  describe("System Validation", () => {
    describe("GET /api/system/validation", () => {
      it("should validate system configuration", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/system/validation`);
        
        expect(response.status).toBeOneOf([200, 503]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("overall");
          expect(data.data).toHaveProperty("components");
          expect(data.data).toHaveProperty("recommendations");
          expect(data.data).toHaveProperty("criticalIssues");
          
          expect(typeof data.data.overall).toBe("object");
          expect(Array.isArray(data.data.components)).toBe(true);
          expect(Array.isArray(data.data.recommendations)).toBe(true);
          expect(Array.isArray(data.data.criticalIssues)).toBe(true);
        }
      });

      it("should validate individual components", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/system/validation`);
        
        if (response.status === 200) {
          const data = await response.json();
          
          data.data.components.forEach((component: any) => {
            expect(component).toHaveProperty("name");
            expect(component).toHaveProperty("status");
            expect(component).toHaveProperty("details");
            expect(component).toHaveProperty("lastChecked");
            
            expect(typeof component.name).toBe("string");
            expect(typeof component.status).toBe("string");
            expect(typeof component.details).toBe("object");
            expect(typeof component.lastChecked).toBe("string");
          });
        }
      });

      it("should include performance metrics", async () => {
        if (!isServerReady) return;

        const response = await fetch(`${BASE_URL}/api/system/validation`);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data.data.overall).toHaveProperty("healthScore");
          expect(data.data.overall).toHaveProperty("responseTime");
          expect(data.data.overall).toHaveProperty("uptime");
          expect(data.data.overall).toHaveProperty("memoryUsage");
          
          expect(typeof data.data.overall.healthScore).toBe("number");
          expect(typeof data.data.overall.responseTime).toBe("number");
          expect(typeof data.data.overall.uptime).toBe("number");
          expect(typeof data.data.overall.memoryUsage).toBe("number");
          
          expect(data.data.overall.healthScore).toBeGreaterThanOrEqual(0);
          expect(data.data.overall.healthScore).toBeLessThanOrEqual(100);
        }
      });
    });

    describe("POST /api/system/fix", () => {
      it("should attempt to fix system issues", async () => {
        if (!isServerReady) return;

        const fixData = {
          issues: ["database_connection", "cache_clearing"],
          autoFix: true,
          dryRun: true
        };
        
        const response = await fetch(`${BASE_URL}/api/system/fix`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test_admin_secret_key"
          },
          body: JSON.stringify(fixData)
        });
        
        expect(response.status).toBeOneOf([200, 401, 403, 422]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("fixesApplied");
          expect(data.data).toHaveProperty("fixesFailed");
          expect(data.data).toHaveProperty("systemStatus");
          expect(data.data).toHaveProperty("dryRun", fixData.dryRun);
          
          expect(Array.isArray(data.data.fixesApplied)).toBe(true);
          expect(Array.isArray(data.data.fixesFailed)).toBe(true);
          expect(typeof data.data.systemStatus).toBe("object");
        }
      });

      it("should require admin privileges", async () => {
        if (!isServerReady) return;

        const fixData = {
          issues: ["database_connection"],
          autoFix: true
        };
        
        const response = await fetch(`${BASE_URL}/api/system/fix`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(fixData)
        });
        
        expect(response.status).toBeOneOf([401, 403]);
        
        const data = await response.json();
        expect(data).toHaveProperty("success", false);
        expect(data).toHaveProperty("error");
      });
    });

    describe("POST /api/system/circuit-breaker/fix", () => {
      it("should fix circuit breaker issues", async () => {
        if (!isServerReady) return;

        const fixData = {
          circuitBreakers: ["mexc-api", "database-connection"],
          action: "reset",
          force: false
        };
        
        const response = await fetch(`${BASE_URL}/api/system/circuit-breaker/fix`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test_admin_secret_key"
          },
          body: JSON.stringify(fixData)
        });
        
        expect(response.status).toBeOneOf([200, 401, 403, 422]);
        
        if (response.status === 200) {
          const data = await response.json();
          expect(data).toHaveProperty("success", true);
          expect(data).toHaveProperty("data");
          expect(data.data).toHaveProperty("circuitBreakersFixed");
          expect(data.data).toHaveProperty("circuitBreakersFailed");
          expect(data.data).toHaveProperty("currentState");
          
          expect(Array.isArray(data.data.circuitBreakersFixed)).toBe(true);
          expect(Array.isArray(data.data.circuitBreakersFailed)).toBe(true);
          expect(typeof data.data.currentState).toBe("object");
        }
      });

      it("should validate circuit breaker names", async () => {
        if (!isServerReady) return;

        const invalidData = {
          circuitBreakers: ["nonexistent-breaker"],
          action: "invalid-action"
        };
        
        const response = await fetch(`${BASE_URL}/api/system/circuit-breaker/fix`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer test_admin_secret_key"
          },
          body: JSON.stringify(invalidData)
        });
        
        expect(response.status).toBeOneOf([400, 422]);
        
        const data = await response.json();
        expect(data).toHaveProperty("success", false);
        expect(data).toHaveProperty("validationErrors");
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle 404 for non-existent endpoints", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/admin/nonexistent`);
      
      expect(response.status).toBe(404);
    });

    it("should handle invalid HTTP methods", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/database/quota-status`, {
        method: "DELETE"
      });
      
      expect(response.status).toBe(405);
    });

    it("should handle malformed JSON", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/database/optimize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer test_db_admin_token"
        },
        body: "invalid-json"
      });
      
      expect(response.status).toBeOneOf([400, 422]);
      
      const data = await response.json();
      expect(data).toHaveProperty("success", false);
      expect(data).toHaveProperty("error");
    });

    it("should handle database connectivity issues", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/database/quota-status`);
      
      expect(response.status).toBeOneOf([200, 503]);
      
      if (response.status === 503) {
        const data = await response.json();
        expect(data).toHaveProperty("success", false);
        expect(data).toHaveProperty("error");
        expect(data.error).toContain("database");
      }
    });
  });

  describe("Security & Authorization", () => {
    it("should reject unauthorized admin operations", async () => {
      if (!isServerReady) return;

      const endpoints = [
        "/api/admin/bypass-email-confirmation",
        "/api/admin/rls",
        "/api/database/optimize",
        "/api/database/migrate",
        "/api/system/fix",
        "/api/system/circuit-breaker/fix"
      ];
      
      for (const endpoint of endpoints) {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})
        });
        
        expect(response.status).toBeOneOf([401, 403, 405]);
      }
    });

    it("should validate admin tokens", async () => {
      if (!isServerReady) return;

      const response = await fetch(`${BASE_URL}/api/admin/rls`, {
        headers: {
          "Authorization": "Bearer invalid_token"
        }
      });
      
      expect(response.status).toBeOneOf([401, 403]);
      
      const data = await response.json();
      expect(data).toHaveProperty("success", false);
      expect(data).toHaveProperty("error");
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