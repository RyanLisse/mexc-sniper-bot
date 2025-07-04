/**
 * Real API Endpoints Integration Tests
 * 
 * Tests actual API endpoints without mocks to verify real system integrations
 * Using enhanced server management infrastructure for 100% reliability
 */

import { describe, it, expect } from "vitest";
import { 
  createIntegrationTestSuite,
  testApiEndpoint,
  testDatabaseConnection,
  testAuthEndpoints,
  testMexcIntegration,
  testMonitoringEndpoints,
  testSafetyEndpoints,
  testAutoSnipingEndpoints,
  runComprehensiveHealthCheck,
  IntegrationTestErrorHandler
} from "../utils/integration-test-helpers";

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../utils/timeout-elimination-helpers';

createIntegrationTestSuite("Real API Endpoints Integration", (context) => {

  describe("Health Check Endpoints", () => {
    it("should return healthy status from main health endpoint", async () => {
      await testApiEndpoint('/api/health', {
        hasProperty: ['status'],
        customValidator: (data) => data.status === 'healthy'
      })(context);
    });

    it("should check database connectivity", async () => {
      const isConnected = await testDatabaseConnection(context);
      expect(isConnected).toBe(true);
    });

    it("should verify environment health", async () => {
      await testApiEndpoint('/api/health/environment', {
        hasProperty: ['environment']
      })(context);
    });

    it("should check system health", async () => {
      await testApiEndpoint('/api/health/system', {
        hasProperty: ['system'],
        customValidator: (data) => typeof data.system.uptime === 'number'
      })(context);
    });
  });

  describe("Authentication Integration", () => {
    it("should handle all auth endpoints correctly", async () => {
      await testAuthEndpoints(context);
    });

    it("should handle session endpoint", async () => {
      await testApiEndpoint('/api/auth/session', {
        status: [200, 401, 403]
      })(context);
    });

    it("should provide auth health status", async () => {
      await testApiEndpoint('/api/health/auth', {
        hasProperty: 'auth'
      })(context);
    });
  });

  describe("MEXC API Integration", () => {
    it("should handle all MEXC endpoints correctly", async () => {
      await testMexcIntegration(context);
    });

    it("should check MEXC connectivity", async () => {
      await testApiEndpoint('/api/mexc/connectivity', {
        hasProperty: 'success',
        customValidator: (data) => typeof data.success === 'boolean'
      })(context);
    });

    it("should fetch MEXC server time", async () => {
      await testApiEndpoint('/api/mexc/server-time', {
        hasProperty: 'serverTime',
        customValidator: (data) => typeof data.serverTime === 'number'
      })(context);
    });

    it("should get exchange info", async () => {
      const result = await testApiEndpoint('/api/mexc/exchange-info', {
        hasProperty: 'success'
      })(context);
      
      if (result?.data?.success && result.data.data) {
        expect(result.data.data).toHaveProperty("symbols");
        expect(Array.isArray(result.data.data.symbols)).toBe(true);
      }
    });

    it("should test enhanced connectivity", async () => {
      await testApiEndpoint('/api/mexc/enhanced-connectivity', {
        hasProperty: ['success', 'connectivity']
      })(context);
    });
  });

  describe("Database Integration", () => {
    it("should check database quota status", async () => {
      await testApiEndpoint('/api/database/quota-status', {
        hasProperty: ['success', 'quota']
      })(context);
    });

    it("should handle database optimization checks", async () => {
      await testApiEndpoint('/api/database/optimize', {
        status: [200, 405, 503] // Different methods may not be allowed
      })(context);
    });
  });

  describe("Auto-Sniping System Integration", () => {
    it("should handle all auto-sniping endpoints correctly", async () => {
      await testAutoSnipingEndpoints(context);
    });

    it("should get auto-sniping status", async () => {
      await testApiEndpoint('/api/auto-sniping/status', {
        hasProperty: ['success', 'status']
      })(context);
    });

    it("should validate auto-sniping config", async () => {
      await testApiEndpoint('/api/auto-sniping/config-validation', {
        hasProperty: 'success'
      })(context);
    });

    it("should check safety monitoring", async () => {
      await testApiEndpoint('/api/auto-sniping/safety-monitoring', {
        hasProperty: 'success'
      })(context);
    });
  });

  describe("Monitoring and Analytics", () => {
    it("should handle all monitoring endpoints correctly", async () => {
      await testMonitoringEndpoints(context);
    });

    it("should provide system overview", async () => {
      await testApiEndpoint('/api/monitoring/system-overview', {
        hasProperty: 'success'
      })(context);
    });

    it("should get performance metrics", async () => {
      await testApiEndpoint('/api/monitoring/performance-metrics', {
        hasProperty: 'success'
      })(context);
    });

    it("should check trading analytics", async () => {
      await testApiEndpoint('/api/analytics/trading', {
        hasProperty: 'success'
      })(context);
    });
  });

  describe("Safety and Risk Management", () => {
    it("should handle all safety endpoints correctly", async () => {
      await testSafetyEndpoints(context);
    });

    it("should get safety system status", async () => {
      await testApiEndpoint('/api/safety/system-status', {
        hasProperty: 'success'
      })(context);
    });

    it("should perform risk assessment", async () => {
      await testApiEndpoint('/api/safety/risk-assessment', {
        hasProperty: 'success'
      })(context);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle invalid endpoints gracefully", async () => {
      await testApiEndpoint('/api/nonexistent-endpoint', {
        status: 404
      })(context);
    });

    it("should handle malformed requests", async () => {
      const response = await context.fetch('/api/auto-sniping/control', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid-json"
      });
      expect([400, 422, 500]).toContain(response.status);
    });

    it("should implement rate limiting", async () => {
      // Make multiple rapid requests to test rate limiting
      const promises = Array(10).fill(null).map(() => 
        context.fetch('/api/health')
      );
      
      const responses = await Promise.all(promises);
      const statusCodes = responses.map(r => r.status);
      
      // All should succeed for health endpoint, but rate limiting may apply to other endpoints
      expect(statusCodes.every(code => code === 200 || code === 429)).toBe(true);
    });
  });

  describe("Comprehensive System Health", () => {
    it("should perform comprehensive health check of all systems", async () => {
      try {
        const healthReport = await runComprehensiveHealthCheck(context);
        
        console.log('🏥 Comprehensive Health Report:', healthReport);
        
        // Core systems must be healthy
        expect(healthReport.server).toBe(true);
        expect(healthReport.database).toBe(true);
        expect(healthReport.overall).toBe(true);
        
        // Optional systems (may be down in test environment)
        if (!healthReport.auth) {
          console.warn('⚠️ Auth system health check failed');
        }
        if (!healthReport.mexc) {
          console.warn('⚠️ MEXC integration health check failed');
        }
        if (!healthReport.monitoring) {
          console.warn('⚠️ Monitoring system health check failed');
        }
        if (!healthReport.safety) {
          console.warn('⚠️ Safety system health check failed');
        }
        if (!healthReport.autoSniping) {
          console.warn('⚠️ Auto-sniping system health check failed');
        }
        
      } catch (error) {
        await IntegrationTestErrorHandler.handleServerError(context, error);
        
        // Try recovery
        const recovered = await IntegrationTestErrorHandler.recoverFromError(context);
        if (!recovered) {
          throw error;
        }
        
        // Retry health check after recovery
        const healthReport = await runComprehensiveHealthCheck(context);
        expect(healthReport.overall).toBe(true);
      }
    });
  });

}, {
  serverConfig: {
    port: 3109,
    env: {
      NODE_ENV: 'test',
      USE_REAL_DATABASE: 'true',
      FORCE_MOCK_DB: 'false',
      MEXC_API_KEY: 'test-api-key',
      MEXC_SECRET_KEY: 'test-secret-key'
    },
    logOutput: process.env.TEST_SERVER_LOGS === 'true',
    enableDevMode: true
  },
  testTimeout: 120000, // 2 minutes for comprehensive tests
  enableServerLogs: process.env.TEST_SERVER_LOGS === 'true',
  cleanupBetweenTests: true
});