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
 * Stability-Optimized Vitest Configuration
 * MISSION: Test Stability & Reliability Agent
 * 
 * FOCUS: Complete elimination of flaky tests and stability issues
 * 
 * FEATURES:
 * - Zero flaky test tolerance with comprehensive retry mechanisms
 * - Memory leak prevention and monitoring
 * - Deterministic test execution with proper isolation
 * - Race condition elimination through controlled parallelization
 * - Enhanced timeout management and resource cleanup
 * - Comprehensive error handling and recovery
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Environment setup with stability focus
    environment: 'jsdom',
    globals: true,
    
    // Test discovery - focused on reliability
    include: [
      'tests/unit/**/*.test.{js,ts,tsx}',
      'tests/integration/**/*.test.{js,ts,tsx}',
      'tests/utils/**/*.test.{js,ts,tsx}',
      'tests/components/**/*.test.{js,ts,tsx}',
    ],
    
    // Comprehensive exclusions to prevent interference
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
      '**/flaky-tests/**/*', // Exclude any known flaky test directories
    ],
    
    // STABILITY-FIRST TIMEOUT CONFIGURATION
    // Conservative timeouts to eliminate timing-based failures
    testTimeout: process.env.CI ? 10000 : 15000, // More generous timeouts
    hookTimeout: process.env.CI ? 15000 : 20000, // Extra time for setup/teardown
    teardownTimeout: process.env.CI ? 15000 : 20000, // Ensure complete cleanup
    
    // RETRY CONFIGURATION FOR ZERO FLAKY TESTS
    retry: process.env.CI ? 2 : 1, // Always retry to catch flaky failures
    
    // Disable coverage for stability testing
    coverage: {
      provider: 'v8',
      enabled: false, // Disable to reduce overhead and potential issues
    },
    
    // Comprehensive environment variables for stable testing
    env: {
      NODE_ENV: 'test',
      VITEST: 'true',
      
      // Test-specific configurations
      VITEST_STABILITY_MODE: 'true',
      ENABLE_STABILITY_MONITORING: 'true',
      ENABLE_TIMEOUT_MONITORING: 'true',
      
      // Mock configurations
      OPENAI_API_KEY: 'test-openai-key-stability',
      MEXC_API_KEY: 'test-mexc-key-stability',
      MEXC_SECRET_KEY: 'test-mexc-secret-stability',
      MEXC_BASE_URL: 'https://api.mexc.com',
      ENCRYPTION_MASTER_KEY: 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcwo=',
      DATABASE_URL: process.env.DATABASE_URL,
      
      // Force stable configurations
      FORCE_MOCK_DB: 'true',
      SKIP_AUTH_IN_TESTS: 'true',
      ENABLE_DEBUG_LOGGING: 'false',
      DISABLE_RATE_LIMITING: 'true',
      
      // Memory management
      NODE_OPTIONS: '--max-old-space-size=4096',
      UV_THREADPOOL_SIZE: '8',
    },
    
    // Enhanced setup files for stability
    setupFiles: [
      './tests/setup/vitest-setup.ts',
      './tests/utils/test-stability-utilities.ts'
    ],
    
    // Stability-focused reporting
    reporters: [
      ['default', { summary: true }],
      ['verbose'], // Enhanced logging for debugging failures
    ],
    
    // Output configuration
    outputFile: {
      json: './test-results/vitest-stability-results.json',
      junit: './test-results/vitest-stability-junit.xml',
    },
    
    // Watch mode disabled for stability testing
    watch: false,
    
    // CONTROLLED PARALLELIZATION FOR STABILITY
    // Reduced parallelization to prevent race conditions
    logHeapUsage: true, // Monitor memory usage
    isolate: true, // Maximum isolation between tests
    sequence: {
      concurrent: true, // Enable controlled concurrency
      shuffle: false, // Disable shuffling for deterministic execution
      hooks: 'stack', // Sequential hook execution for stability
      setupFiles: 'parallel', // Parallel setup files (safe)
    },
    
    // CONSERVATIVE THREAD CONFIGURATION
    // Reduced thread count for maximum stability
    pool: 'threads',
    poolOptions: {
      threads: {
        // Conservative thread allocation to prevent resource contention
        maxThreads: Math.min(4, Math.max(1, Math.floor(cpus().length * 0.5))),
        minThreads: 1,
        isolate: true, // Complete thread isolation
        useAtomics: true, // Thread-safe operations
        singleThread: process.env.VITEST_SINGLE_THREAD === 'true', // Force single-threaded if needed
        // Memory management: maxMemoryLimitBeforeRecycle handled by Node.js garbage collector with --max-old-space-size
      },
    },
    
    // Reduced concurrency to prevent race conditions
    maxConcurrency: process.env.VITEST_MAX_CONCURRENCY ? parseInt(process.env.VITEST_MAX_CONCURRENCY) : 4,
    fileParallelism: false, // Disable file parallelism for better stability
    
    // ENHANCED CACHING WITH STABILITY FOCUS
    cache: {
      dir: './node_modules/.vitest-stability',
    },
    
    // STABILITY MONITORING
    benchmark: {
      outputFile: './test-results/stability-benchmark-results.json',
      include: ['**/stability-benchmark.test.ts'],
    },
    
    // Enhanced reporting for debugging
    silent: false, // Always show output for debugging
    passWithNoTests: true,
    
    // MEMORY AND RESOURCE MANAGEMENT
    // Memory monitoring is handled within the existing poolOptions configuration above
  },
  
  // Build configuration optimized for stability
  esbuild: {
    target: 'node18',
    sourcemap: true, // Enable for better debugging
    jsx: 'automatic',
    jsxImportSource: 'react',
    keepNames: true, // Preserve function names for debugging
  },
  
  // Define global constants for stability
  define: {
    __TEST__: true,
    __DEV__: false,
    __PROD__: false,
    __STABILITY_MODE__: true,
    global: 'globalThis',
  },
  
  // Optimize module resolution for faster loading
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
    }
  },
  
  // Server configuration for test environment
  server: {
    // Disable HMR for test stability
    hmr: false,
    watch: null,
  }
});