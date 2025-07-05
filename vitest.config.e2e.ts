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

const isCI = process.env.CI === 'true';

/**
 * E2E Testing Configuration for MEXC Sniper Bot
 * 
 * FEATURES:
 * - Browser environment simulation for E2E-style tests
 * - Real service integration testing
 * - Extended timeouts for complex user workflows
 * - Browser automation test support
 * - Sequential execution for deterministic results
 * 
 * PURPOSE:
 * This configuration is designed for E2E-style tests that run through
 * Vitest but need browser-like environments and real service integration.
 * For actual browser automation, use Playwright with playwright.config.ts.
 * 
 * USE CASES:
 * - API workflow testing with real services
 * - Component integration testing in browser-like environment
 * - User journey simulation without full browser automation
 * - Service integration validation
 */

export default defineConfig({
  plugins: [tsconfigPaths()],
  
  // Cache directory for E2E tests
  cacheDir: './node_modules/.vite-e2e',
  
  test: {
    // Node environment for server-side E2E testing
    environment: 'node',
    globals: true,
    
    // E2E test discovery
    include: [
      'tests/e2e/**/*.test.{js,ts,tsx}',
      'tests/integration/**/*.e2e.test.{js,ts,tsx}',
      'tests/workflows/**/*.test.{js,ts,tsx}',
    ],
    
    // Exclude other test types and browser automation tests
    exclude: [
      'node_modules',
      'dist',
      '.next',
      'coverage',
      'build',
      'out',
      'tests/unit/**/*',
      'tests/components/**/*',
      '**/*.spec.ts', // Browser automation tests use .spec.ts
      '**/*.spec.js',
      'playwright-report/**/*',
      'test-results/**/*',
      'test-screenshots/**/*',
      'all-tests/**/*',
    ],
    
    // Extended timeouts for E2E workflows
    testTimeout: isCI ? 180000 : 240000, // 3-4 minutes for complex workflows
    hookTimeout: isCI ? 120000 : 150000, // 2-2.5 minutes for setup/teardown
    teardownTimeout: isCI ? 60000 : 90000, // 1-1.5 minutes for cleanup
    
    // Enhanced retry for flaky E2E scenarios
    retry: isCI ? 3 : 2,
    
    // Coverage configuration for E2E tests
    coverage: {
      enabled: process.env.COVERAGE === 'true',
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
      reportsDirectory: './coverage/e2e',
      include: [
        'src/**/*.{js,ts,tsx}',
        'app/**/*.{js,ts,tsx}',
      ],
      exclude: [
        'src/**/*.test.{js,ts,tsx}',
        'src/**/*.spec.{js,ts,tsx}',
        'tests/**/*',
        'node_modules/**/*',
        '**/*.d.ts',
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 75,
          lines: 75,
          statements: 75
        }
      }
    },
    
    // E2E environment variables
    env: {
      NODE_ENV: 'test',
      VITEST: 'true',
      TEST_TYPE: 'e2e',
      
      // Real services for E2E testing (when available)
      USE_REAL_DATABASE: process.env.USE_REAL_DATABASE || 'false',
      FORCE_MOCK_DB: process.env.FORCE_MOCK_DB || 'true',
      SKIP_AUTH_IN_TESTS: 'false', // Allow real auth flows in E2E
      ENABLE_DEBUG_LOGGING: process.env.TEST_DEBUG || 'false',
      
      // API configuration for E2E
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'test-openai-key-e2e',
      MEXC_API_KEY: process.env.MEXC_API_KEY || 'test-mexc-key-e2e', 
      MEXC_SECRET_KEY: process.env.MEXC_SECRET_KEY || 'test-mexc-secret-e2e',
      MEXC_BASE_URL: 'https://api.mexc.com',
      
      // Database and security
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/mexc_sniper_test',
      ENCRYPTION_MASTER_KEY: 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcwo=',
      
      // Server configuration for E2E
      PORT: process.env.TEST_PORT || '3010',
      TEST_PORT: process.env.TEST_PORT || '3010',
      NEXT_PUBLIC_BASE_URL: 'http://localhost:3010',
      
      // E2E specific flags
      TEST_E2E_MODE: 'true',
      ENABLE_E2E_WORKFLOWS: 'true',
      DISABLE_RATE_LIMITING: 'true',
      E2E_TIMEOUT_MULTIPLIER: '2',
    },
    
    // E2E setup files
    setupFiles: [
      './tests/setup/vitest-setup.ts',
      './tests/setup/e2e-setup.ts', // E2E specific setup
    ],
    
    // E2E specific reporters
    reporters: [
      ['default', { summary: true }],
      ['json', { outputFile: './test-results/e2e-results.json' }],
      ['junit', { outputFile: './test-results/e2e-junit.xml' }],
    ],
    
    // Output configuration
    outputFile: {
      json: './test-results/e2e-results.json',
      junit: './test-results/e2e-junit.xml',
      html: './test-results/e2e-report.html',
    },
    
    // No watch mode for E2E tests
    watch: false,
    
    // E2E execution settings
    logHeapUsage: true, // Monitor memory usage in E2E tests
    isolate: true, // Full isolation for E2E reliability
    
    // Sequential execution for deterministic E2E results
    sequence: {
      concurrent: false, // Sequential execution
      shuffle: false, // Maintain deterministic order
      hooks: 'stack', // Sequential hook execution
      setupFiles: 'list', // Sequential setup files
    },
    
    // Conservative threading for E2E stability
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 1, // Single thread for deterministic E2E execution
        minThreads: 1,
        isolate: true,
        useAtomics: true,
        execArgv: ['--max-old-space-size=4096'], // More memory for E2E
      },
    },
    
    // Single concurrency for E2E determinism
    maxConcurrency: 1,
    fileParallelism: false, // Disable for E2E consistency
    
    // E2E caching - configured at root level for Vitest 3.x compatibility
    
    // E2E benchmarking
    benchmark: {
      outputFile: './test-results/e2e-benchmark.json',
    },
    
    // E2E reporting settings
    silent: false, // Enable output for E2E debugging
    passWithNoTests: false, // Fail if no E2E tests found
  },
  
  // Build configuration for E2E testing
  esbuild: {
    target: 'node18',
    sourcemap: true, // Enable for better E2E debugging
    jsx: 'automatic',
    jsxImportSource: 'react',
    keepNames: true, // Preserve function names for E2E debugging
  },
  
  // E2E global constants
  define: {
    __TEST__: true,
    __E2E_TEST__: true,
    __DEV__: false,
    __PROD__: false,
    global: 'globalThis',
  },
  
  // E2E resolve configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
      '@utils': path.resolve(__dirname, './tests/utils'),
      '@e2e': path.resolve(__dirname, './tests/e2e'),
    }
  },
  
  // Server configuration for E2E testing
  server: {
    port: 5174, // Different port to avoid conflicts with integration tests
    strictPort: false,
    fs: {
      allow: ['..', '.']
    },
    hmr: false, // Disable HMR for E2E stability
    watch: null, // Disable file watching
  }
});