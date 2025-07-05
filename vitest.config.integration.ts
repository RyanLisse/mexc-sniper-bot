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

// Verify critical environment variables for integration tests
if (!process.env.DATABASE_URL) {
  // Set fallback to use real database for integration testing
  process.env.USE_REAL_DATABASE = 'true'
  process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_oTv5qIQYX6lb@ep-silent-firefly-a1l3mkrm-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
}

/**
 * Optimized Vitest Configuration for Integration Tests
 * 
 * FEATURES:
 * - Enhanced server management for integration testing
 * - Optimized timeouts and resource allocation
 * - Comprehensive error handling and reporting
 * - Real database connections with proper cleanup
 * - Advanced health checking and monitoring
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  
  // Modern cache directory configuration for integration tests
  cacheDir: './node_modules/.vite-integration',
  
  test: {
    // Environment setup for integration tests
    environment: 'node', // Use Node environment for server testing
    globals: true,
    
    // Integration test discovery - ONLY integration tests
    include: [
      'tests/integration/**/*.test.{js,ts,tsx}',
    ],
    
    // Comprehensive exclusions
    exclude: [
      'node_modules', 
      'dist', 
      '.next', 
      'coverage',
      'build',
      'out',
      'tests/unit/**/*',
      'tests/e2e/**/*',
      'tests/components/**/*',
      '**/*.spec.ts',
      '**/*.spec.js',
      '**/*.e2e.*',
      'playwright-report/**/*',
      'test-results/**/*',
      'test-screenshots/**/*',
      'all-tests/**/*',
    ],
    
    // Enhanced timeout configuration for integration tests
    testTimeout: 120000, // 2 minutes per test
    hookTimeout: 60000,  // 1 minute for hooks
    teardownTimeout: 60000, // 1 minute for teardown
    
    // Retry configuration for flaky integration tests
    retry: process.env.CI ? 2 : 1, // More retries in CI
    
    // Coverage configuration
    coverage: {
      enabled: process.env.COVERAGE === 'true',
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
      reportsDirectory: './coverage/integration',
      include: [
        'src/**/*.{js,ts,tsx}',
      ],
      exclude: [
        'src/**/*.test.{js,ts,tsx}',
        'src/**/*.spec.{js,ts,tsx}',
        'tests/**/*',
        'node_modules/**/*'
      ]
    },
    
    // Environment variables specific to integration testing
    env: {
      NODE_ENV: 'test',
      VITEST: 'true',
      TEST_TYPE: 'integration',
      USE_REAL_DATABASE: 'true',
      FORCE_MOCK_DB: 'false',
      SKIP_AUTH_IN_TESTS: 'false', // Allow real auth in integration tests
      ENABLE_DEBUG_LOGGING: process.env.TEST_DEBUG || 'false',
      TEST_SERVER_LOGS: process.env.TEST_SERVER_LOGS || 'false',
      
      // API keys for integration testing
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-openai-key-integration',
      MEXC_API_KEY: process.env.MEXC_API_KEY || 'test-mexc-key-integration',
      MEXC_SECRET_KEY: process.env.MEXC_SECRET_KEY || 'test-mexc-secret-integration',
      MEXC_BASE_URL: 'https://api.mexc.com',
      
      // Database and security
      DATABASE_URL: process.env.DATABASE_URL,
      ENCRYPTION_MASTER_KEY: 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcwo=',
      
      // Server configuration
      PORT: process.env.TEST_PORT || '3109',
      TEST_PORT: process.env.TEST_PORT || '3109',
    },
    
    // Enhanced setup for integration tests
    setupFiles: [
      './tests/setup/vitest-setup.ts',
      './tests/setup/integration-setup.ts'
    ],
    
    // Integration test specific reporters
    reporters: [
      ['default', { summary: true }],
      ['json', { outputFile: './test-results/integration-results.json' }]
    ],
      
    // Output configuration
    outputFile: {
      json: './test-results/integration-results.json',
      junit: './test-results/integration-junit.xml'
    },
    
    // No watch mode for integration tests
    watch: false,
    
    // INTEGRATION TEST OPTIMIZATIONS
    logHeapUsage: process.env.TEST_HEAP_USAGE === 'true',
    isolate: true, // Enable isolation for reliability
    sequence: {
      concurrent: false, // Sequential execution for integration tests
      shuffle: false, // Maintain deterministic order
      hooks: 'parallel', // Parallel hook execution
      setupFiles: 'parallel', // Parallel setup files
    },
    
    // CONTROLLED PARALLELIZATION FOR INTEGRATION TESTS
    pool: 'threads',
    poolOptions: {
      threads: {
        // Reduced parallelism to avoid server conflicts
        maxThreads: Math.min(2, Math.max(1, Math.floor(cpus().length / 4))),
        minThreads: 1,
        isolate: true,
        useAtomics: true,
        execArgv: ['--no-warnings'], // Reduce noise in logs
      },
    },
    // Reduced concurrency for server stability
    maxConcurrency: 2,
    fileParallelism: false, // Disable file parallelism to prevent server conflicts
    
    // ENHANCED CACHING FOR INTEGRATION TESTS - Modern cacheDir configured at root level
    
    // PERFORMANCE MONITORING
    benchmark: {
      outputFile: './test-results/integration-benchmark.json',
    },
    
    // INTEGRATION TEST REPORTING
    silent: false, // Enable output for debugging
    passWithNoTests: false, // Fail if no integration tests found
    
    // NO TEST SHARDING for integration tests (maintain state consistency)
    // shard option removed for better compatibility
  },
  
  // Build configuration optimized for integration testing
  esbuild: {
    target: 'node18',
    sourcemap: true, // Enable for better debugging
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  
  // Define global constants for integration tests
  define: {
    __TEST__: true,
    __INTEGRATION_TEST__: true,
    __DEV__: false,
    __PROD__: false,
    global: 'globalThis',
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
      '@utils': path.resolve(__dirname, './tests/utils')
    }
  },
  
  // Server configuration for integration tests
  server: {
    port: 5173, // Different port to avoid conflicts
    strictPort: false,
    fs: {
      allow: ['..', '.']
    }
  }
})