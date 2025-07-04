/**
 * Server Test Helper - Robust Integration Test Server Management
 * 
 * This utility provides a standardized way to manage test servers across all integration tests:
 * - Proper promise rejection on server startup failure
 * - Robust cleanup with timeout handling
 * - Port management and conflict resolution
 * - Resource leak prevention
 */

import { spawn, ChildProcess } from "child_process";
import { startTestServer, cleanupWithTimeout, safeFetch, ServerConfig } from "./async-test-helpers";

export interface TestServerManager {
  isReady: boolean;
  baseUrl: string;
  port: number;
  cleanup: () => Promise<void>;
  healthCheck: () => Promise<boolean>;
}

/**
 * Port registry to prevent conflicts between parallel tests
 */
const usedPorts = new Set<number>();

/**
 * Get an available test port
 */
function getAvailablePort(preferredPort: number): number {
  let port = preferredPort;
  while (usedPorts.has(port)) {
    port++;
  }
  usedPorts.add(port);
  return port;
}

/**
 * Release a port back to the pool
 */
function releasePort(port: number): void {
  usedPorts.delete(port);
}

/**
 * Create a test server manager with proper async handling
 * FIXES: All promise resolution/rejection issues in integration tests
 */
export async function createTestServer(
  preferredPort: number = 3100,
  customEnv: Record<string, string> = {}
): Promise<TestServerManager> {
  const port = getAvailablePort(preferredPort);
  
  const config: ServerConfig = {
    port,
    timeout: 30000, // 30 second timeout
    maxAttempts: 15, // 15 attempts with 2 second intervals = 30 seconds max
    checkInterval: 2000, // Check every 2 seconds
    env: {
      USE_REAL_DATABASE: "true",
      MEXC_API_KEY: "test_api_key_12345",
      MEXC_SECRET_KEY: "test_secret_key_67890",
      ...customEnv
    }
  };

  try {
    const serverResult = await startTestServer(config);
    
    const manager: TestServerManager = {
      isReady: serverResult.isReady,
      baseUrl: serverResult.url,
      port,
      cleanup: async () => {
        await cleanupWithTimeout(serverResult.cleanup, 10000);
        releasePort(port);
      },
      healthCheck: async () => {
        try {
          const response = await safeFetch(`${serverResult.url}/api/health`, undefined, 3000);
          return response.ok;
        } catch {
          return false;
        }
      }
    };

    return manager;
  } catch (error) {
    releasePort(port);
    throw error;
  }
}

/**
 * Wrapper for beforeAll/afterAll test hooks with proper error handling
 */
export function createServerTestSuite(
  testName: string,
  preferredPort: number = 3100,
  customEnv: Record<string, string> = {}
) {
  let serverManager: TestServerManager | null = null;

  const beforeAllSetup = async () => {
    console.log(`🚀 Starting server for ${testName}...`);
    
    try {
      serverManager = await createTestServer(preferredPort, customEnv);
      console.log(`✅ Server ready for ${testName} at ${serverManager.baseUrl}`);
    } catch (error) {
      console.error(`❌ Failed to start server for ${testName}:`, error);
      throw error; // Re-throw to fail the test suite
    }
  };

  const afterAllCleanup = async () => {
    if (serverManager) {
      console.log(`🧹 Cleaning up server for ${testName}...`);
      try {
        await serverManager.cleanup();
        console.log(`✅ Server cleanup completed for ${testName}`);
      } catch (error) {
        console.error(`⚠️ Server cleanup had issues for ${testName}:`, error);
        // Don't throw here to avoid masking test results
      } finally {
        serverManager = null;
      }
    }
  };

  const getServerManager = (): TestServerManager => {
    if (!serverManager) {
      throw new Error(`Server manager not available for ${testName}. Make sure beforeAll setup completed successfully.`);
    }
    return serverManager;
  };

  const skipIfServerNotReady = () => {
    if (!serverManager?.isReady) {
      console.warn(`⚠️ Skipping test - server not ready for ${testName}`);
      return true;
    }
    return false;
  };

  return {
    beforeAllSetup,
    afterAllCleanup,
    getServerManager,
    skipIfServerNotReady,
    isReady: () => serverManager?.isReady ?? false,
    baseUrl: () => serverManager?.baseUrl ?? '',
    port: () => serverManager?.port ?? 0
  };
}

/**
 * Utility to test multiple endpoints with proper error handling
 */
export async function testEndpoints(
  baseUrl: string,
  endpoints: Array<{ path: string; method?: string; expectedStatuses: number[] }>,
  timeoutMs: number = 5000
): Promise<Array<{ path: string; status: number; success: boolean; error?: string }>> {
  const results = await Promise.allSettled(
    endpoints.map(async (endpoint) => {
      try {
        const response = await safeFetch(`${baseUrl}${endpoint.path}`, {
          method: endpoint.method || 'GET'
        }, timeoutMs);
        
        return {
          path: endpoint.path,
          status: response.status,
          success: endpoint.expectedStatuses.includes(response.status)
        };
      } catch (error) {
        return {
          path: endpoint.path,
          status: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    })
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        path: endpoints[index].path,
        status: 0,
        success: false,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason)
      };
    }
  });
}

/**
 * Rate limiting test utility with proper promise handling
 */
export async function testRateLimit(
  baseUrl: string,
  endpoint: string,
  requestCount: number = 5,
  timeoutMs: number = 5000
): Promise<{ statusCodes: number[]; rateLimited: boolean; errors: number }> {
  const promises = Array(requestCount).fill(null).map(async () => {
    try {
      const response = await safeFetch(`${baseUrl}${endpoint}`, undefined, timeoutMs);
      return response.status;
    } catch (error) {
      console.warn(`Rate limit test request failed: ${error instanceof Error ? error.message : String(error)}`);
      return 0; // Return 0 for errors
    }
  });

  const statusCodes = await Promise.all(promises);
  const errors = statusCodes.filter(code => code === 0).length;
  const rateLimited = statusCodes.includes(429);

  return {
    statusCodes: statusCodes.filter(code => code !== 0), // Remove error codes
    rateLimited,
    errors
  };
}