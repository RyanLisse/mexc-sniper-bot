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

/**
 * High-Performance Vitest Configuration for MEXC Sniper Bot
 * MISSION: Test Configuration Optimization Agent - Performance Profile
 * 
 * OPTIMIZATIONS:
 * - Maximum CPU utilization with dynamic thread scaling
 * - Aggressive caching and memory optimization
 * - Minimal test isolation for speed
 * - Parallel execution at all levels
 * - Fast-fail strategies for CI/CD pipelines
 * - Optimized for large test suites
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Use Node.js environment for maximum performance
    environment: 'node',
    globals: true,
    
    // Performance-focused test discovery
    include: [
      'tests/unit/**/*.test.{js,ts,tsx}',
      'tests/integration/**/*.test.{js,ts,tsx}',
      'tests/utils/**/*.test.{js,ts,tsx}',
      'tests/components/**/*.test.{js,ts,tsx}',
      'tests/performance/**/*.test.{js,ts,tsx}',
    ],
    
    // Comprehensive exclusions for performance
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
      '**/*.slow.test.*', // Exclude slow tests in performance mode
    ],
    
    // Aggressive timeout optimization
    testTimeout: process.env.CI ? 2000 : 3000, // Very fast timeouts
    hookTimeout: process.env.CI ? 3000 : 5000,
    teardownTimeout: process.env.CI ? 3000 : 5000,
    
    // No retries for maximum speed
    retry: 0,
    
    // Disable coverage for performance
    coverage: {
      provider: 'v8',
      enabled: false,
    },
    
    // Minimal environment variables for performance
    env: {
      NODE_ENV: 'test',
      VITEST: 'true',
      TEST_PERFORMANCE_MODE: 'true',
      FORCE_MOCK_DB: 'true',
      SKIP_AUTH_IN_TESTS: 'true',
      ENABLE_DEBUG_LOGGING: 'false',
      DISABLE_SLOW_OPERATIONS: 'true',
      // Mock API keys for performance
      OPENAI_API_KEY: 'test-key',
      MEXC_API_KEY: 'test-key',
      MEXC_SECRET_KEY: 'test-secret',
      ENCRYPTION_MASTER_KEY: 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcwo=',
    },
    
    // Minimal setup for performance
    setupFiles: [
      './tests/setup/vitest-setup.ts'
    ],
    
    // Fast reporting
    reporters: [['basic']],
    
    // Performance output
    outputFile: {
      json: './test-results/performance-test-results.json',
    },
    
    // Disable watch mode
    watch: false,
    
    // MAXIMUM PERFORMANCE SETTINGS
    logHeapUsage: false,
    isolate: false, // Disable isolation for speed
    sequence: {
      concurrent: true,
      shuffle: false,
      hooks: 'parallel',
      setupFiles: 'parallel',
    },
    
    // MAXIMUM PARALLELIZATION
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: Math.min(cpus().length, 16), // Use all available cores
        minThreads: Math.floor(cpus().length * 0.5),
        isolate: false, // Disable isolation for speed
        useAtomics: true,
        // Memory limits to prevent OOM
        execArgv: ['--max-old-space-size=2048'],
      },
    },
    maxConcurrency: 32, // High concurrency
    fileParallelism: true,
    
    // ADVANCED CACHING
    cache: {
      dir: './node_modules/.vitest/performance',
    },
    
    // Performance monitoring
    benchmark: {
      outputFile: './test-results/performance-benchmark.json',
    },
    
    // Fast execution settings
    silent: false,
    passWithNoTests: true,
    
    // Test sharding disabled for simplicity (sharding can be implemented at CI level)
    // shard configuration removed for better compatibility
    
    // Performance-specific options
    diff: './test-results/performance-diff.json',
  },
  
  // Build optimization for performance
  esbuild: {
    target: 'node18',
    sourcemap: false, // Disable sourcemaps for speed
    jsx: 'automatic',
    jsxImportSource: 'react',
    // minify: false removed - not supported in current version
    // Tree shaking controlled by Vite, not esbuild
  },
  
  // Optimized constants
  define: {
    __TEST__: true,
    __DEV__: false,
    __PROD__: false,
    __PERFORMANCE_MODE__: true,
    global: 'globalThis',
  },
  
  // Optimization flags
  optimizeDeps: {
    include: ['vitest', '@testing-library/react', 'jsdom'],
    exclude: ['playwright', '@playwright/test'],
  },
})