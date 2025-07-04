import { config } from 'dotenv';
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
 * Simplified Vitest Configuration for MEXC Sniper Bot
 * Optimized for speed and reduced strictness
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Environment setup - Use jsdom for React component tests
    environment: 'jsdom',
    globals: true,
    
    // Test discovery and inclusion - ONLY test files, no spec files
    include: [
      'tests/unit/**/*.test.{js,ts,tsx}',
      'tests/integration/**/*.test.{js,ts,tsx}',
      'tests/utils/**/*.test.{js,ts,tsx}',
      'tests/components/**/*.test.{js,ts,tsx}',
    ],
    
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
    
    // Fast timeout configuration
    testTimeout: 5000, // Reduced to 5 seconds
    hookTimeout: 10000, // Increased for cleanup
    teardownTimeout: 10000, // Increased for cleanup
    
    // No retries for speed
    retry: 0,
    
    // Conditional coverage reporting
    coverage: {
      enabled: process.env.COVERAGE === 'true',
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
      reportsDirectory: './coverage/vitest'
    },
    
    // Simplified environment variables for testing
    env: {
      NODE_ENV: 'test',
      VITEST: 'true',
      OPENAI_API_KEY: 'test-openai-key-vitest',
      MEXC_API_KEY: 'test-mexc-key-vitest',
      MEXC_SECRET_KEY: 'test-mexc-secret-vitest',
      MEXC_BASE_URL: 'https://api.mexc.com',
      ENCRYPTION_MASTER_KEY: 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcwo=',
      DATABASE_URL: process.env.DATABASE_URL,
      FORCE_MOCK_DB: process.env.FORCE_MOCK_DB || 'true', // Force mocks for speed
      SKIP_AUTH_IN_TESTS: 'true',
      ENABLE_DEBUG_LOGGING: 'false',
    },
    
    // Minimal setup files
    setupFiles: [
      './tests/setup/vitest-setup.ts'
    ],
    
    // Minimal reporting for speed
    reporters: [['default', { summary: false }]],
      
    // Output configuration
    outputFile: {
      json: './test-results/vitest-results.json',
    },
    
    // No watch mode in tests
    watch: false,
    
    // Performance-optimized settings - disable most checks
    logHeapUsage: false,
    isolate: false,
    sequence: {
      concurrent: true, // Enable for speed
      shuffle: false,
    },
    
    // Single thread for simplicity
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 1,
        minThreads: 1,
      },
    },
    maxConcurrency: 1,
    fileParallelism: false
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