/**
 * Integration Test Setup
 * 
 * Enhanced setup specifically for integration tests with server management,
 * database connections, and comprehensive test environment preparation.
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { SharedServerManager, teardownIntegrationServers } from '../utils/integration-server-manager';
import { gracefulTestCleanup } from '../utils/integration-test-helpers';
import { globalTimeoutMonitor } from '../utils/timeout-utilities';

// Track global integration test state
let integrationTestStartTime = 0;
let totalTestsRun = 0;
let testCleanupHandlers: Array<() => Promise<void>> = [];

// Enhanced global setup for integration tests
beforeAll(async () => {
  integrationTestStartTime = Date.now();
  console.log('🔧 Initializing integration test environment...');
  
  try {
    // Set integration test flags
    process.env.TEST_TYPE = 'integration';
    process.env.USE_REAL_DATABASE = 'true';
    process.env.FORCE_MOCK_DB = 'false';
    process.env.SKIP_DB_CONNECTION = 'false';
    
    // Enhance environment for integration testing
    if (!process.env.TEST_PORT) {
      process.env.TEST_PORT = '3109';
    }
    
    // Set up database configuration for integration tests
    if (process.env.DATABASE_URL) {
      console.log('✅ Using configured database for integration tests');
    } else {
      console.warn('⚠️ No DATABASE_URL configured, some tests may fail');
    }
    
    // Initialize timeout monitoring
    if (process.env.ENABLE_TIMEOUT_MONITORING === 'true') {
      console.log('🕐 Timeout monitoring enabled for integration tests');
    }
    
    // Clear any existing test data
    globalThis.testCleanupFunctions = globalThis.testCleanupFunctions || [];
    
    console.log('✅ Integration test environment initialized');
    
  } catch (error) {
    console.error('❌ Failed to initialize integration test environment:', error);
    throw error;
  }
}, 60000); // 1 minute timeout for setup

// Global teardown for integration tests
afterAll(async () => {
  console.log('🧹 Cleaning up integration test environment...');
  
  try {
    // Run registered cleanup functions
    if (globalThis.testCleanupFunctions && globalThis.testCleanupFunctions.length > 0) {
      console.log(`🔄 Running ${globalThis.testCleanupFunctions.length} cleanup functions...`);
      
      for (const cleanup of globalThis.testCleanupFunctions) {
        try {
          await cleanup();
        } catch (error) {
          console.warn('⚠️ Cleanup function error:', error?.message || 'Unknown error');
        }
      }
      
      globalThis.testCleanupFunctions = [];
    }

    // Run custom test cleanup handlers
    for (const handler of testCleanupHandlers) {
      try {
        await handler();
      } catch (error) {
        console.warn('⚠️ Custom cleanup handler error:', error?.message || 'Unknown error');
      }
    }
    testCleanupHandlers = [];

    // Perform graceful test cleanup
    await gracefulTestCleanup();
    
    // Clean up timeout monitoring
    if (globalTimeoutMonitor) {
      const activeCount = globalTimeoutMonitor.getActiveCount();
      if (activeCount.timeouts > 0 || activeCount.intervals > 0) {
        console.log(`🕐 Cleaning up ${activeCount.timeouts} timeouts and ${activeCount.intervals} intervals`);
        globalTimeoutMonitor.cleanup();
      }
    }
    
    const integrationTestDuration = Date.now() - integrationTestStartTime;
    console.log(`✅ Integration test environment cleaned up (${integrationTestDuration}ms, ${totalTestsRun} tests)`);
    
  } catch (error) {
    console.warn('⚠️ Integration test cleanup warning:', error?.message || 'Unknown error');
  }
}, 60000); // 1 minute timeout for teardown

// Enhanced test lifecycle management
beforeEach(async () => {
  totalTestsRun++;
  
  // Reset test-specific state
  if (global.mockDataStore?.reset) {
    global.mockDataStore.reset();
  }
  
  // Check for server health before each test (if servers are running)
  const serverStatus = SharedServerManager.getAllServerStatus();
  for (const [port, status] of Object.entries(serverStatus)) {
    if (status.errors.length > 0) {
      console.warn(`⚠️ Server on port ${port} has errors:`, status.errors.slice(-3));
    }
  }
});

afterEach(async () => {
  // Clean up any test-specific resources
  if (global.mockDataStore?.reset) {
    global.mockDataStore.reset();
  }
  
  // Small delay to allow async operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Register cleanup handler for graceful shutdown
export function registerIntegrationCleanup(handler: () => Promise<void>): void {
  testCleanupHandlers.push(handler);
}

// Utility to get integration test metrics
export function getIntegrationTestMetrics() {
  return {
    startTime: integrationTestStartTime,
    testsRun: totalTestsRun,
    duration: Date.now() - integrationTestStartTime,
    serverStatus: SharedServerManager.getAllServerStatus()
  };
}

// Enhanced error handling for integration tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Unhandled Rejection in integration test:', reason);
  console.error('Promise:', promise);
});

process.on('uncaughtException', (error) => {
  console.error('🔥 Uncaught Exception in integration test:', error);
});

// Graceful shutdown handling
const shutdownHandler = async (signal: string) => {
  console.log(`📶 Received ${signal}, performing graceful shutdown...`);
  
  try {
    await teardownIntegrationServers();
    await gracefulTestCleanup();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
process.on('SIGINT', () => shutdownHandler('SIGINT'));

console.log('🚀 Integration test setup completed');

// Export test environment information
export const integrationTestEnvironment = {
  isIntegrationTest: true,
  databaseUrl: process.env.DATABASE_URL ? '***configured***' : 'not configured',
  testPort: process.env.TEST_PORT || '3109',
  nodeEnv: process.env.NODE_ENV,
  useRealDatabase: process.env.USE_REAL_DATABASE === 'true',
  enableLogs: process.env.TEST_SERVER_LOGS === 'true'
};