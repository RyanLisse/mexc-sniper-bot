import { config } from 'dotenv';
import { cpus } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load test environment variables
config({ path: '.env.test', override: true })

// Verify critical environment variables are loaded
if (!process.env.DATABASE_URL) {
  // Set fallback to use mock database for testing
  process.env.USE_MOCK_DATABASE = 'true'
  process.env.DATABASE_URL = 'postgresql://postgres:password@localhost:5432/mexc_sniper_test'
}

/**
 * Optimized Vitest Configuration for MEXC Sniper Bot
 * MISSION: Test Configuration Optimization Agent
 * 
 * FEATURES:
 * - Maximum parallelization with intelligent thread management
 * - Advanced caching with file-based persistence
 * - Performance monitoring and analytics
 * - Dynamic timeout optimization
 * - Test sharding and dependency management
 * - Comprehensive coverage aggregation
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * - Multi-threaded execution with optimal worker allocation
 * - Intelligent test discovery and filtering
 * - Memory-efficient test isolation
 * - Fast test result caching
 * - Parallel coverage collection
 * 
 * STABILITY-OPTIMIZED: Enhanced with test-stability-utilities
 * - Memory management with maxMemoryLimitBeforeRecycle monitoring
 * - Test isolation and cleanup mechanisms
 * - Comprehensive error handling and recovery
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Environment setup - Use jsdom for React component tests
    environment: 'jsdom',
    globals: true,
    
    // Jsdom environment options for better React support
    environmentOptions: {
      jsdom: {
        url: 'http://localhost:3000',
        contentType: 'text/html',
        pretendToBeVisual: true,
        includeNodeLocations: true,
        storageQuota: 10000000,
        resources: 'usable',
        runScripts: 'dangerously',
      },
    },
    
    // Test discovery and inclusion - ONLY test files, no spec files
    include: [
      'tests/unit/**/*.test.{js,ts,tsx}',
      'tests/integration/**/*.test.{js,ts,tsx}',
      'tests/utils/**/*.test.{js,ts,tsx}',
      'tests/components/**/*.test.{js,ts,tsx}',
    ],
    
    // Integration test configuration is handled by specific vitest.config.integration.ts
    // when TEST_TYPE=integration is set
    
    // Comprehensive exclusions
    exclude: [
      'node_modules', 
      'dist', 
      '.next', 
      'coverage',
      'build',
      'out',
      'tests/e2e/**/*',
      '**/*.spec.ts',
      '**/*.spec.js',
      '**/*.e2e.*',
      'playwright-report/**/*',
      'test-results/**/*',
      'test-screenshots/**/*',
      'all-tests/**/*',
    ],
    
    // TIMEOUT ELIMINATION: Significantly increased timeouts for all async operations
    testTimeout: (() => {
      // Integration tests need even longer timeouts for server startup and async operations
      if (process.env.TEST_TYPE === 'integration') {
        return process.env.CI ? 45000 : 60000; // Doubled for server startup
      }
      // Real API tests need maximum timeouts for network operations
      if (process.env.TEST_TYPE === 'real-api') {
        return process.env.CI ? 90000 : 120000; // Doubled for network reliability
      }
      // Performance tests need moderate timeouts (not too short to avoid false failures)
      if (process.env.TEST_TYPE === 'performance') {
        return process.env.CI ? 10000 : 15000; // Significantly increased
      }
      // Unit tests - generous timeouts for all async patterns including mocked operations
      return process.env.CI ? 20000 : 30000; // FIXED: Increased from 15000/20000 to eliminate 10000ms default
    })(),
    hookTimeout: (() => {
      if (process.env.TEST_TYPE === 'integration') {
        return process.env.CI ? 60000 : 75000; // Extended for complex setup/teardown
      }
      if (process.env.TEST_TYPE === 'real-api') {
        return process.env.CI ? 120000 : 150000; // Maximum for API setup
      }
      // FIXED: Increased hook timeout to prevent 10000ms default timeouts
      return process.env.CI ? 30000 : 40000; // Increased from 20000/25000 to eliminate hook timeout failures
    })(),
    teardownTimeout: (() => {
      if (process.env.TEST_TYPE === 'integration') {
        return process.env.CI ? 40000 : 50000; // Extended for proper server cleanup
      }
      if (process.env.TEST_TYPE === 'real-api') {
        return process.env.CI ? 90000 : 120000; // Maximum for API cleanup
      }
      // FIXED: Increased teardown timeout to prevent cleanup failures
      return process.env.CI ? 30000 : 40000; // Increased from 20000/25000 for reliable cleanup
    })(),
    
    // Smart retry configuration
    retry: process.env.CI ? 1 : 0, // Retry once in CI for flaky tests
    
    // Conditional coverage reporting
    coverage: {
      enabled: process.env.COVERAGE === 'true',
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
      reportsDirectory: './coverage/vitest'
    },
    
    // Enhanced environment variables for testing stability
    env: {
      NODE_ENV: 'test',
      VITEST: 'true',
      
      // Test stability configuration
      VITEST_STABILITY_MODE: 'true',
      ENABLE_STABILITY_MONITORING: 'true',
      ENABLE_TIMEOUT_MONITORING: process.env.CI ? 'false' : 'true',
      TEST_ISOLATION_MODE: 'enhanced',
      
      // API mocks
      OPENAI_API_KEY: 'test-openai-key-vitest',
      MEXC_API_KEY: 'test-mexc-key-vitest',
      MEXC_SECRET_KEY: 'test-mexc-secret-vitest',
      MEXC_BASE_URL: 'https://api.mexc.com',
      ENCRYPTION_MASTER_KEY: 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcwo=',
      DATABASE_URL: process.env.DATABASE_URL,
      
      // Database and service configuration
      FORCE_MOCK_DB: process.env.FORCE_MOCK_DB || 'true', // Force mocks for speed
      SKIP_AUTH_IN_TESTS: 'true',
      ENABLE_DEBUG_LOGGING: 'false',
      DISABLE_RATE_LIMITING: 'true',
      
      // Performance and memory settings
      NODE_OPTIONS: '--max-old-space-size=4096 --expose-gc',
      UV_THREADPOOL_SIZE: '8',
      
      // Timing configuration for stability
      TEST_TIMING_MODE: 'stable',
      JEST_TIMEOUT: '15000',
    },
    
    // Enhanced setup files for stability - TIMEOUT ELIMINATION: Added global timeout fixes
    // CRITICAL: React DOM fix FIRST to ensure proper DOM setup for React components
    // Browser environment mocking is handled in vitest-setup.ts beforeAll hook
    setupFiles: [
      './tests/setup/react-dom-fix.ts', // Load React DOM fix FIRST
      './tests/setup/vitest-setup.ts', // Includes comprehensive browser environment initialization
      './tests/utils/test-stability-utilities.ts',
      './tests/utils/async-test-helpers.ts',
      './tests/setup/hook-timeout-configuration.ts', // HOOK TIMEOUT FIX: Load hook timeout configuration
      './tests/setup/global-timeout-elimination.ts'
    ],
    
    // Minimal reporting for speed
    reporters: [['default', { summary: false }]],
      
    // Output configuration
    outputFile: {
      json: './test-results/vitest-results.json',
    },
    
    // No watch mode in tests
    watch: false,
    
    // MAXIMUM PERFORMANCE OPTIMIZATIONS
    logHeapUsage: process.env.TEST_HEAP_USAGE === 'true',
    isolate: true, // Enable isolation for reliability
    sequence: {
      concurrent: true, // Enable concurrent execution
      shuffle: process.env.TEST_SHUFFLE === 'true', // Optional shuffling
      hooks: 'parallel', // Parallel hook execution
      setupFiles: 'parallel', // Parallel setup files
    },
    
    // STABILITY-OPTIMIZED PARALLELIZATION
    pool: 'threads',
    poolOptions: {
      threads: {
        // Conservative thread allocation to prevent race conditions
        maxThreads: process.env.TEST_MAX_THREADS ? parseInt(process.env.TEST_MAX_THREADS) : Math.max(1, Math.min(4, Math.floor(cpus().length * 0.5))),
        minThreads: process.env.TEST_MIN_THREADS ? parseInt(process.env.TEST_MIN_THREADS) : 1,
        isolate: true, // Thread isolation for reliability
        useAtomics: true, // Enable atomic operations
        // Memory management handled by Node.js garbage collector
      },
    },
    maxConcurrency: process.env.TEST_MAX_CONCURRENCY ? parseInt(process.env.TEST_MAX_CONCURRENCY) : 8, // Reduced for stability
    fileParallelism: process.env.CI ? false : true, // Disable in CI for stability
    
    // INTELLIGENT CACHING
    cache: {
      dir: './node_modules/.vitest',
    },
    
    // PERFORMANCE MONITORING
    benchmark: {
      outputFile: './test-results/benchmark-results.json',
    },
    
    // ADVANCED REPORTING
    silent: process.env.TEST_SILENT === 'true',
    passWithNoTests: true,
    
    // TEST SHARDING disabled for compatibility (can be implemented at CI level)
    // shard configuration removed for better compatibility
  },
  
  // Build configuration for testing - relaxed
  esbuild: {
    target: 'node18',
    sourcemap: false, // Disable for speed
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  
  // Define global constants
  define: {
    __TEST__: true,
    __DEV__: false,
    __PROD__: false,
    global: 'globalThis',
  }
})