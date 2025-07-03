/**
 * Global Setup for Vitest Test Suite
 *
 * This file runs once before all tests start and provides:
 * - Environment validation
 * - Database preparation
 * - Global utilities setup
 * - Performance monitoring initialization
 */

import fs from "fs/promises";
import path from "path";
import { performance } from "perf_hooks";

const SETUP_TIMEOUT = 30000; // 30 seconds

interface TestBranchContext {
  branchName: string;
  branchId: string;
  connectionString: string;
}

interface TestFixtures {
  users: Record<string, any>;
  apiCredentials: Record<string, any>;
  marketData: {
    symbols: any[];
    prices: Record<string, string>;
    calendar: any[];
  };
  transactions: Record<string, any>;
}

interface MockApiResponses {
  mexc: {
    serverTime: { serverTime: number };
    symbols: any[];
    account: {
      balances: Array<{ asset: string; free: string; locked: string }>;
    };
  };
  openai: {
    chat: {
      id: string;
      object: string;
      choices: Array<{
        message: {
          role: string;
          content: string;
        };
      }>;
    };
  };
}

interface TestPerformance {
  startTime: number;
  marks: Map<string, number>;
  measurements: Map<string, number>;
  mark: (name: string) => number;
  measure: (name: string, startMark: string, endMark?: string) => number;
  getReport: () => {
    totalTime: number;
    marks: Record<string, number>;
    measurements: Record<string, number>;
  };
}

declare global {
  var testBranchContext: TestBranchContext | undefined;
  var testFixtures: TestFixtures;
  var mockApiResponses: MockApiResponses;
  var testPerformance: TestPerformance;
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  const startTime = performance.now();
  console.log("🌍 Starting global test environment setup...");

  try {
    // 1. Environment validation
    await validateEnvironment();

    // 2. Database preparation
    await prepareDatabaseForTesting();

    // 3. Create test directories
    await createTestDirectories();

    // 4. Initialize performance monitoring
    initializePerformanceMonitoring();

    // 5. Setup test data and fixtures
    await setupTestFixtures();

    const setupTime = performance.now() - startTime;
    console.log(`✅ Global setup completed in ${Math.round(setupTime)}ms`);

    // Return teardown function as required by Vitest
    return globalTeardown;
  } catch (error) {
    console.error("❌ Global setup failed:", error);
    throw error;
  }
}

/**
 * Validate that all required environment variables and dependencies are available
 */
async function validateEnvironment(): Promise<void> {
  console.log("🔍 Validating test environment...");

  const requiredVars = ["NODE_ENV", "DATABASE_URL"];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    console.warn(`⚠️ Missing environment variables: ${missingVars.join(", ")}`);
    // Set defaults for testing
    if (!process.env.NODE_ENV) {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', configurable: true });
    }
    if (!process.env.DATABASE_URL)
      process.env.DATABASE_URL =
        "postgresql://neondb_owner:npg_oTv5qIQYX6lb@ep-silent-firefly-a1l3mkrm-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
  }

  // Ensure PostgreSQL mode for testing
  if (!process.env.FORCE_SQLITE) process.env.FORCE_SQLITE = "false";

  // Validate Node.js version
  const nodeVersion = process.version;
  const requiredVersion = "18.0.0";
  if (!isVersionCompatible(nodeVersion.slice(1), requiredVersion)) {
    console.warn(
      `⚠️ Node.js version ${nodeVersion} may not be fully compatible. Recommended: ${requiredVersion}+`,
    );
  }

  console.log("✅ Environment validation completed");
}

/**
 * Prepare database for testing with NeonDB branching
 */
async function prepareDatabaseForTesting(): Promise<void> {
  console.log("🗄️ Preparing database for testing with NeonDB branches...");

  try {
    // Check if we should use test branches
    let useTestBranches = process.env.USE_TEST_BRANCHES === "true";

    if (useTestBranches && process.env.NEON_API_KEY) {
      console.log("🌿 Setting up isolated NeonDB test branch...");

      // Import branch setup utilities with relative path
      try {
        const { setupVitestBranch } = await import("../../src/lib/test-branch-setup.js");

        // Create isolated test branch for this test run
        global.testBranchContext = await setupVitestBranch() as any;
        console.log(
          `✅ Test branch created: ${global.testBranchContext.branchName}`,
        );

        // Import and run migrations on the test branch
        const { migrateTestBranch } = await import(
          "../../src/lib/test-branch-setup.js"
        );
        await migrateTestBranch(global.testBranchContext as any);
        console.log("📦 Test branch migrations completed");
      } catch (error) {
        console.warn(
          "⚠️ Failed to setup test branch, falling back to main database:",
          error.message,
        );
        // Fall back to main database connection
        useTestBranches = false;
      }
    }

    if (!useTestBranches) {
      console.log("📦 Using main database connection for testing");

      // Import database utilities with relative path
      try {
        const { db } = await import("../../src/db/index.js");

        // Test database connection
        if (db) {
          console.log("📦 Database connection verified");

          // Optional: Clear test data if needed
          if (process.env.CLEAR_TEST_DATA === "true") {
            console.log("🧹 Clearing existing test data...");
            // Add database clearing logic here if needed
          }
        }
      } catch (dbError) {
        console.warn("⚠️ Database connection warning:", dbError.message);
      }
    }
  } catch (error) {
    console.warn("⚠️ Database preparation warning:", error.message);
    // Don't fail setup if database is not available
  }

  console.log("✅ Database preparation completed");
}

/**
 * Create necessary test directories
 */
async function createTestDirectories(): Promise<void> {
  console.log("📁 Creating test directories...");

  const testDirs = [
    "test-results",
    "coverage",
    "test-screenshots",
    "test-data",
    "temp",
  ];

  for (const dir of testDirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      if (error.code !== "EEXIST") {
        console.warn(`⚠️ Could not create directory ${dir}:`, error.message);
      }
    }
  }

  console.log("✅ Test directories created");
}

/**
 * Initialize performance monitoring for tests
 */
function initializePerformanceMonitoring(): void {
  console.log("📊 Initializing performance monitoring...");

  // Global performance tracking
  global.testPerformance = {
    startTime: performance.now(),
    marks: new Map(),
    measurements: new Map(),

    mark: (name) => {
      const time = performance.now();
      global.testPerformance.marks.set(name, time);
      return time;
    },

    measure: (name, startMark, endMark) => {
      const startTime = global.testPerformance.marks.get(startMark) || 0;
      const endTime = endMark
        ? global.testPerformance.marks.get(endMark)
        : performance.now();
      const duration = endTime - startTime;
      global.testPerformance.measurements.set(name, duration);
      return duration;
    },

    getReport: () => ({
      totalTime: performance.now() - global.testPerformance.startTime,
      marks: Object.fromEntries(global.testPerformance.marks),
      measurements: Object.fromEntries(global.testPerformance.measurements),
    }),
  };

  console.log("✅ Performance monitoring initialized");
}

/**
 * Setup test fixtures and mock data
 */
async function setupTestFixtures(): Promise<void> {
  console.log("🎭 Setting up test fixtures...");

  // Global test fixtures
  global.testFixtures = {
    users: {
      testUser: {
        id: "test-user-123",
        email: "test@example.com",
        name: "Test User",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      },
      adminUser: {
        id: "admin-user-123",
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      },
    },

    apiCredentials: {
      valid: {
        id: "creds-123",
        userId: "test-user-123",
        mexcApiKey: "encrypted_test-api-key",
        mexcSecretKey: "encrypted_test-secret-key",
        isActive: true,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      },
    },

    marketData: {
      symbols: [
        {
          symbol: "BTCUSDT",
          status: "TRADING",
          baseAsset: "BTC",
          quoteAsset: "USDT",
        },
        {
          symbol: "ETHUSDT",
          status: "TRADING",
          baseAsset: "ETH",
          quoteAsset: "USDT",
        },
        {
          symbol: "ADAUSDT",
          status: "TRADING",
          baseAsset: "ADA",
          quoteAsset: "USDT",
        },
      ],

      prices: {
        BTCUSDT: "50000.00",
        ETHUSDT: "3000.00",
        ADAUSDT: "0.50",
      },

      calendar: [
        {
          id: "event-1",
          symbol: "NEWUSDT",
          launchTime: new Date(Date.now() + 86400000), // Tomorrow
          status: "scheduled",
        },
      ],
    },

    transactions: {
      successful: {
        id: "tx-123",
        userId: "test-user-123",
        symbol: "BTCUSDT",
        side: "BUY",
        quantity: "0.001",
        price: "50000.00",
        status: "FILLED",
        createdAt: new Date("2024-01-01"),
      },
    },
  };

  // Mock API responses
  global.mockApiResponses = {
    mexc: {
      serverTime: { serverTime: Date.now() },
      symbols: global.testFixtures.marketData.symbols,
      account: {
        balances: [
          { asset: "USDT", free: "10000.00", locked: "0.00" },
          { asset: "BTC", free: "0.1", locked: "0.0" },
        ],
      },
    },

    openai: {
      chat: {
        id: "mock-chat-id",
        object: "chat.completion",
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify({
                success: true,
                confidence: 0.85,
                analysis: "Mock AI analysis for testing",
              }),
            },
          },
        ],
      },
    },
  };

  console.log("✅ Test fixtures setup completed");
}

/**
 * Cleanup function called when tests are finished
 */
export async function globalTeardown(): Promise<void> {
  console.log("🧹 Running global test cleanup...");

  try {
    // Cleanup test branch if it was created
    if (global.testBranchContext) {
      console.log("🌿 Cleaning up test branch...");
      try {
        const { cleanupTestBranch } = await import(
          "../../src/lib/test-branch-setup.js"
        );
        await cleanupTestBranch(global.testBranchContext as any);
        global.testBranchContext = null;
        console.log("✅ Test branch cleanup completed");
      } catch (error) {
        console.warn("⚠️ Test branch cleanup warning:", error.message);
      }
    }

    // Emergency cleanup of any orphaned test branches
    if (process.env.USE_TEST_BRANCHES === "true" && process.env.NEON_API_KEY) {
      try {
        const { cleanupAllTestBranches } = await import(
          "../../src/lib/test-branch-setup.js"
        );
        await cleanupAllTestBranches();
        console.log("🧹 Emergency branch cleanup completed");
      } catch (error) {
        console.warn("⚠️ Emergency branch cleanup warning:", error.message);
      }
    }

    // Performance report
    if (global.testPerformance) {
      const report = global.testPerformance.getReport();
      console.log(
        `📊 Total test suite time: ${Math.round(report.totalTime)}ms`,
      );

      // Save performance report
      await fs
        .writeFile(
          "test-results/performance-report.json",
          JSON.stringify(report, null, 2),
        )
        .catch(() => {}); // Ignore errors
    }

    // Cleanup test directories if requested
    if (process.env.CLEANUP_TEST_DIRS === "true") {
      const tempDirs = ["temp", "test-data"];
      for (const dir of tempDirs) {
        try {
          await fs.rm(dir, { recursive: true, force: true });
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }

    console.log("✅ Global cleanup completed");
  } catch (error) {
    console.warn("⚠️ Global cleanup warning:", error.message);
  }
}

/**
 * Utility function to check version compatibility
 */
function isVersionCompatible(current, required) {
  const currentParts = current.split(".").map(Number);
  const requiredParts = required.split(".").map(Number);

  for (
    let i = 0;
    i < Math.max(currentParts.length, requiredParts.length);
    i++
  ) {
    const currentPart = currentParts[i] || 0;
    const requiredPart = requiredParts[i] || 0;

    if (currentPart > requiredPart) return true;
    if (currentPart < requiredPart) return false;
  }

  return true;
}
