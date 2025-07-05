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
 * ULTRA-FAST Vitest Configuration for MEXC Sniper Bot
 * MISSION: Test Performance Optimization Agent - Lightning Fast Execution
 * 
 * SPEED OPTIMIZATIONS:
 * - Minimal setup and teardown
 * - Maximum CPU utilization (8 cores)
 * - Ultra-aggressive parallelization
 * - No isolation for maximum speed
 * - Minimal reporting and output
 * - Skip slow tests automatically
 * - Memory-optimized execution
 * - Zero retries for speed
 * 
 * TARGET: Complete test suite in under 15 seconds
 * USE CASE: Quick feedback during development, CI/CD fast checks
 */

const CPU_COUNT = cpus().length; // 8 cores detected
const isCI = process.env.CI === 'true';

// Ultra-fast timeouts
const ULTRA_FAST_TIMEOUTS = {
  testTimeout: 800,       // Ultra-fast test execution
  hookTimeout: 1000,      // Minimal hook time
  teardownTimeout: 500,   // Lightning cleanup
};

export default defineConfig({
  plugins: [tsconfigPaths()],
  
  // Use modern cache directory
  cacheDir: './node_modules/.vite-fast',
  
  test: {
    // Node environment for maximum speed (no DOM overhead)
    environment: 'node',
    globals: true,
    
    // Ultra-focused test discovery - only fastest tests
    include: [
      'tests/unit/**/*.test.{js,ts}', // Skip tsx for speed
      'tests/utils/**/*.test.{js,ts}',
      '!tests/**/*.slow.test.*',      // Skip slow tests
      '!tests/**/*.integration.*',    // Skip integration tests
      '!tests/**/*.e2e.*',           // Skip e2e tests
    ],
    
    // Comprehensive exclusions for maximum speed
    exclude: [
      'node_modules',
      'dist',
      '.next',
      'coverage',
      'build',
      'out',
      'tests/e2e/**/*',
      'tests/integration/**/*',
      'tests/components/**/*', // Skip React components for speed
      '**/*.spec.ts',
      '**/*.spec.js',
      '**/*.e2e.*',
      '**/*.slow.*',
      '**/*.bench.*',
      '**/flaky-tests/**/*',
      'playwright-report/**/*',
      'test-results/**/*',
      'test-screenshots/**/*',
      'all-tests/**/*',
    ],
    
    // Ultra-fast timeouts
    ...ULTRA_FAST_TIMEOUTS,
    
    // Zero retries for maximum speed
    retry: 0,
    
    // Disable coverage completely
    coverage: {
      enabled: false,
    },
    
    // Minimal environment for speed
    env: {
      NODE_ENV: 'test',
      VITEST: 'true',
      TEST_TYPE: 'fast',
      
      // Performance flags
      NODE_OPTIONS: '--max-old-space-size=2048', // Lower memory for speed
      UV_THREADPOOL_SIZE: String(CPU_COUNT * 2),
      
      // Skip everything possible
      FORCE_MOCK_DB: 'true',
      SKIP_AUTH_IN_TESTS: 'true',
      ENABLE_DEBUG_LOGGING: 'false',
      DISABLE_RATE_LIMITING: 'true',
      DISABLE_SLOW_OPERATIONS: 'true',
      SKIP_NETWORK_CALLS: 'true',
      SKIP_FILE_OPERATIONS: 'true',
      SKIP_DATABASE_OPERATIONS: 'true',
      
      // Mock everything
      OPENAI_API_KEY: 'test',
      MEXC_API_KEY: 'test',
      MEXC_SECRET_KEY: 'test',
      ENCRYPTION_MASTER_KEY: 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcwo=',
      DATABASE_URL: 'mock://test',
      
      // Fast mode flags
      TEST_FAST_MODE: 'true',
      VITEST_SEGFAULT_RETRY: '0',
      VITEST_NO_THREADS: 'false', // Use threads for speed
    },
    
    // No setup files for maximum speed
    setupFiles: [],
    
    // Minimal reporting
    reporters: [['basic']],
    
    // No output files for speed
    outputFile: undefined,
    
    // Disable watch mode
    watch: false,
    
    // ULTRA-PERFORMANCE SETTINGS
    logHeapUsage: false,
    isolate: false, // No isolation for maximum speed
    
    // Maximum concurrency execution
    sequence: {
      concurrent: true,
      shuffle: false,
      hooks: 'parallel',
      setupFiles: 'parallel',
    },
    
    // MAXIMUM PARALLELIZATION - Use all available resources
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: CPU_COUNT * 2, // Use all cores + hyperthreading
        minThreads: CPU_COUNT,     // Start with all cores
        isolate: false,            // No isolation for speed
        useAtomics: true,          // Enable atomic operations
        // No custom execArgv for compatibility
      },
    },
    
    // Ultra-high concurrency
    maxConcurrency: CPU_COUNT * 4, // Maximum possible concurrency
    
    // Enable maximum file parallelism
    fileParallelism: true,
    
    // No benchmarking for speed
    benchmark: undefined,
    
    // Minimal reporting
    silent: false, // Keep some output for feedback
    passWithNoTests: true,
    
    // No diff output
    diff: undefined,
    
    // Fast-fail on first error (optional)
    bail: process.env.VITEST_BAIL === 'true' ? 1 : 0,
  },
  
  // Minimal build configuration
  esbuild: {
    target: 'node18',
    sourcemap: false,
    jsx: 'automatic',
    jsxImportSource: 'react',
    minify: false, // Skip minification for speed
    keepNames: false,
  },
  
  // Essential constants only
  define: {
    __TEST__: true,
    __DEV__: false,
    __PROD__: false,
    __FAST_MODE__: true,
    global: 'globalThis',
  },
  
  // Simple path resolution
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
    }
  },
  
  // Minimal dependency optimization
  optimizeDeps: {
    include: ['vitest'], // Only essential deps
    exclude: [
      'playwright',
      '@playwright/test',
      'electron',
      'jsdom', // Skip DOM for speed
      '@testing-library/react',
    ],
    force: false,
  },
  
  // No server configuration needed for fast mode
  server: undefined,
});