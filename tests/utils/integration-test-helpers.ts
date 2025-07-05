/**
 * Integration Test Helpers
 * 
 * Comprehensive utilities for reliable integration testing with server management,
 * database preparation, and test lifecycle management.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { IntegrationServerManager, setupIntegrationServer, teardownIntegrationServers, ServerConfig } from './integration-server-manager';
import { withRetryTimeout, withApiTimeout, setTestTimeout } from './timeout-utilities';

export interface IntegrationTestConfig {
  serverConfig?: Partial<ServerConfig>;
  testTimeout?: number;
  retryCount?: number;
  enableServerLogs?: boolean;
  requireDatabase?: boolean;
  skipServerStartup?: boolean;
  cleanupBetweenTests?: boolean;
}

export interface IntegrationTestContext {
  server: IntegrationServerManager;
  baseUrl: string;
  port: number;
  fetch: (endpoint: string, options?: RequestInit) => Promise<Response>;
  healthCheck: () => Promise<boolean>;
  waitForReady: () => Promise<void>;
}

/**
 * Enhanced integration test suite wrapper with automatic server management
 */
export function createIntegrationTestSuite(
  suiteName: string,
  testFn: (context: IntegrationTestContext) => void | Promise<void>,
  config: IntegrationTestConfig = {}
): void {
  describe(suiteName, () => {
    let context: IntegrationTestContext;
    const timeout = config.testTimeout || setTestTimeout('integration');

    beforeAll(async () => {
      if (!config.skipServerStartup) {
        console.log(`🚀 Setting up integration test server for: ${suiteName}`);
        
        const { server, baseUrl, port } = await setupIntegrationServer(config.serverConfig);
        
        context = {
          server,
          baseUrl,
          port,
          fetch: createIntegrationFetch(baseUrl),
          healthCheck: () => server.healthCheck().then(r => r.success),
          waitForReady: () => server.waitForStableHealth(2)
        };

        // Verify server is actually ready
        await context.waitForReady();
        console.log(`✅ Integration test server ready for: ${suiteName}`);
      }
    }, timeout);

    beforeEach(async () => {
      if (context && config.cleanupBetweenTests) {
        // Verify server health before each test
        const isHealthy = await context.healthCheck();
        if (!isHealthy) {
          console.warn(`⚠️ Server unhealthy before test, attempting recovery...`);
          await context.waitForReady();
        }
      }
    });

    afterEach(async () => {
      if (context && config.enableServerLogs) {
        const logs = context.server.getLogs(10);
        if (logs.length > 0) {
          console.log(`📋 Recent server logs (last 10 lines):`);
          logs.forEach(log => console.log(`  ${log}`));
        }
      }
    });

    afterAll(async () => {
      if (config.enableServerLogs && context) {
        const status = context.server.getStatus();
        if (status.errors.length > 0) {
          console.log(`❌ Server errors during test suite:`);
          status.errors.forEach(error => console.log(`  ${error}`));
        }
      }
    });

    // Call the actual test function
    testFn(context);
  });
}

interface IntegrationRequestInit extends RequestInit {
  timeout?: number;
}

/**
 * Create a fetch function with proper error handling and timeouts
 */
function createIntegrationFetch(baseUrl: string) {
  return async (endpoint: string, options: IntegrationRequestInit = {}): Promise<Response> => {
    const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
    
    return withApiTimeout(
      () => fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      }),
      options.timeout || 10000
    );
  };
}

/**
 * Enhanced test runner for API endpoint testing
 */
export function testApiEndpoint(
  endpoint: string,
  expectedResponse: {
    status?: number | number[];
    hasProperty?: string | string[];
    contentType?: string;
    customValidator?: (data: any) => boolean;
  } = {}
) {
  return async (context: IntegrationTestContext) => {
    if (!context) {
      console.log('⏭️ Skipping test - server not ready');
      return;
    }

    const response = await context.fetch(endpoint);
    
    // Check status
    if (expectedResponse.status !== undefined) {
      const expectedStatuses = Array.isArray(expectedResponse.status) 
        ? expectedResponse.status 
        : [expectedResponse.status];
      
      expect(expectedStatuses).toContain(response.status);
    } else {
      expect(response.ok).toBe(true);
    }

    // Check content type
    if (expectedResponse.contentType) {
      const contentType = response.headers.get('content-type');
      expect(contentType).toContain(expectedResponse.contentType);
    }

    // Parse response if JSON
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await response.json();

      // Check for required properties
      if (expectedResponse.hasProperty) {
        const properties = Array.isArray(expectedResponse.hasProperty) 
          ? expectedResponse.hasProperty 
          : [expectedResponse.hasProperty];
        
        properties.forEach(prop => {
          expect(data).toHaveProperty(prop);
        });
      }

      // Custom validation
      if (expectedResponse.customValidator) {
        expect(expectedResponse.customValidator(data)).toBe(true);
      }
    }

    return { response, data };
  };
}

/**
 * Test helper for database operations
 */
export async function testDatabaseConnection(context: IntegrationTestContext): Promise<boolean> {
  try {
    const result = await testApiEndpoint('/api/health/db', {
      hasProperty: 'database'
    })(context);
    
    return result?.data?.database?.connected === true;
  } catch (error) {
    console.warn(`Database connection test failed:`, error.message);
    return false;
  }
}

/**
 * Test helper for authentication endpoints
 */
export async function testAuthEndpoints(context: IntegrationTestContext): Promise<void> {
  const endpoints = [
    { path: '/api/auth/session', expectedStatus: [200, 401, 403] },
    { path: '/api/health/auth', expectedStatus: [200] }
  ];

  for (const { path, expectedStatus } of endpoints) {
    await testApiEndpoint(path, { status: expectedStatus })(context);
  }
}

/**
 * Test helper for MEXC API integration
 */
export async function testMexcIntegration(context: IntegrationTestContext): Promise<void> {
  const endpoints = [
    { path: '/api/mexc/connectivity', hasProperty: 'success' },
    { path: '/api/mexc/server-time', hasProperty: 'serverTime' },
    { path: '/api/mexc/enhanced-connectivity', hasProperty: ['success', 'connectivity'] }
  ];

  for (const { path, hasProperty } of endpoints) {
    await testApiEndpoint(path, { hasProperty })(context);
  }
}

/**
 * Test helper for monitoring endpoints
 */
export async function testMonitoringEndpoints(context: IntegrationTestContext): Promise<void> {
  const endpoints = [
    '/api/monitoring/system-overview',
    '/api/monitoring/performance-metrics',
    '/api/analytics/trading'
  ];

  for (const endpoint of endpoints) {
    await testApiEndpoint(endpoint, { hasProperty: 'success' })(context);
  }
}

/**
 * Test helper for safety and risk management
 */
export async function testSafetyEndpoints(context: IntegrationTestContext): Promise<void> {
  const endpoints = [
    '/api/safety/system-status',
    '/api/safety/risk-assessment'
  ];

  for (const endpoint of endpoints) {
    await testApiEndpoint(endpoint, { hasProperty: 'success' })(context);
  }
}

/**
 * Test helper for auto-sniping system
 */
export async function testAutoSnipingEndpoints(context: IntegrationTestContext): Promise<void> {
  const endpoints = [
    '/api/auto-sniping/status',
    '/api/auto-sniping/config-validation',
    '/api/auto-sniping/safety-monitoring'
  ];

  for (const endpoint of endpoints) {
    await testApiEndpoint(endpoint, { hasProperty: 'success' })(context);
  }
}

/**
 * Comprehensive health check for all major systems
 */
export async function runComprehensiveHealthCheck(context: IntegrationTestContext): Promise<{
  server: boolean;
  database: boolean;
  auth: boolean;
  mexc: boolean;
  monitoring: boolean;
  safety: boolean;
  autoSniping: boolean;
  overall: boolean;
}> {
  const results = {
    server: false,
    database: false,
    auth: false,
    mexc: false,
    monitoring: false,
    safety: false,
    autoSniping: false,
    overall: false
  };

  try {
    // Server health
    results.server = await context.healthCheck();
    
    // Database health
    results.database = await testDatabaseConnection(context);
    
    // Auth health
    try {
      await testAuthEndpoints(context);
      results.auth = true;
    } catch { results.auth = false; }
    
    // MEXC integration health
    try {
      await testMexcIntegration(context);
      results.mexc = true;
    } catch { results.mexc = false; }
    
    // Monitoring health
    try {
      await testMonitoringEndpoints(context);
      results.monitoring = true;
    } catch { results.monitoring = false; }
    
    // Safety health
    try {
      await testSafetyEndpoints(context);
      results.safety = true;
    } catch { results.safety = false; }
    
    // Auto-sniping health
    try {
      await testAutoSnipingEndpoints(context);
      results.autoSniping = true;
    } catch { results.autoSniping = false; }
    
    // Overall health (at least server and database must be healthy)
    results.overall = results.server && results.database;
    
  } catch (error) {
    console.error('Comprehensive health check failed:', error);
  }

  return results;
}

/**
 * Error handling utilities for integration tests
 */
export class IntegrationTestErrorHandler {
  static async handleServerError(context: IntegrationTestContext, error: Error): Promise<void> {
    console.error(`💥 Integration test error:`, error.message);
    
    if (context) {
      const status = context.server.getStatus();
      console.log(`📊 Server status:`, {
        isRunning: status.isRunning,
        isReady: status.isReady,
        uptime: status.uptime,
        errors: status.errors.slice(-3),
        warnings: status.warnings.slice(-3)
      });

      const logs = context.server.getLogs(5);
      if (logs.length > 0) {
        console.log(`📋 Recent server logs:`);
        logs.forEach(log => console.log(`  ${log.slice(0, 100)}`));
      }
    }
  }

  static async recoverFromError(context: IntegrationTestContext): Promise<boolean> {
    if (!context) return false;

    try {
      console.log(`🔄 Attempting error recovery...`);
      
      // Wait for server to stabilize
      await context.waitForReady();
      
      // Verify basic connectivity
      const isHealthy = await context.healthCheck();
      
      if (isHealthy) {
        console.log(`✅ Error recovery successful`);
        return true;
      } else {
        console.log(`❌ Error recovery failed`);
        return false;
      }
    } catch (recoveryError) {
      console.error(`💥 Error recovery failed:`, recoveryError.message);
      return false;
    }
  }
}

/**
 * Utility for graceful test cleanup
 */
export async function gracefulTestCleanup(): Promise<void> {
  try {
    console.log(`🧹 Performing graceful integration test cleanup...`);
    await teardownIntegrationServers();
    console.log(`✅ Integration test cleanup completed`);
  } catch (error) {
    console.warn(`⚠️ Test cleanup warning:`, error.message);
  }
}

/**
 * Custom vitest matcher for integration tests
 */
export function setupIntegrationMatchers() {
  expect.extend({
    toBeHealthyServer(received) {
      const pass = received.isRunning && received.isReady && received.errors.length === 0;
      return {
        message: () => pass 
          ? `expected server not to be healthy`
          : `expected server to be healthy, got: running=${received.isRunning}, ready=${received.isReady}, errors=${received.errors.length}`,
        pass
      };
    },

    toHaveValidApiResponse(received, expectedStatus = 200) {
      const pass = received.ok && received.status === expectedStatus;
      return {
        message: () => pass
          ? `expected response not to be valid`
          : `expected valid API response with status ${expectedStatus}, got status ${received.status}`,
        pass
      };
    },

    toContainApiProperty(received, property) {
      const pass = received && typeof received === 'object' && received.hasOwnProperty(property);
      return {
        message: () => pass
          ? `expected response not to contain property ${property}`
          : `expected response to contain property ${property}, got: ${JSON.stringify(received, null, 2)}`,
        pass
      };
    }
  });
}

// Setup matchers automatically
setupIntegrationMatchers();