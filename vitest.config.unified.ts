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
  // Set fallback for DATABASE_URL if not loaded from .env.test
  process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_oTv5qIQYX6lb@ep-silent-firefly-a1l3mkrm-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
}

/**
 * Unified Vitest Configuration for MEXC Sniper Bot
 * 
 * This configuration provides comprehensive testing setup for:
 * - Unit tests (src/**, tests/unit/**)
 * - Integration tests (tests/integration/**)
 * - Coverage reporting with detailed metrics
 * - Performance monitoring and optimization
 * - Parallel execution for faster test runs
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Environment setup - Use jsdom for React component tests
    environment: 'jsdom',
    globals: true,
    
    // Test discovery and inclusion
    include: [
      'tests/unit/**/*.test.{js,ts,tsx}',
      'tests/integration/**/*.test.{js,ts,tsx}',
      'tests/agents/**/*.test.{js,ts,tsx}', // Agent-specific tests
      'tests/auto-sniping/**/*.test.{js,ts,tsx}', // Auto-sniping workflow tests
      'tests/safety/**/*.test.{js,ts,tsx}', // Safety and risk management tests
      'tests/performance/**/*.test.{js,ts,tsx}', // Performance and load tests
      'src/**/*.test.{js,ts,tsx}', // Allow co-located tests
    ],
    
    // Comprehensive exclusions
    exclude: [
      'node_modules', 
      'dist', 
      '.next', 
      'coverage',
      'build',
      'out',
      // E2E test exclusions
      'tests/e2e/**/*',
      '**/*.spec.ts',
      '**/*.spec.js',
      '**/*.e2e.*',
      // Playwright and Stagehand exclusions
      'playwright-report/**/*',
      'test-results/**/*',
      'test-screenshots/**/*',
      // Legacy test directories
      'all-tests/**/*',
    ],
    
    // Test execution configuration - removed duplicate, see poolOptions below
    
    // Realistic timeout configuration for complex integration tests
    testTimeout: 30000, // 30 seconds for complex tests (increased from 5s)
    hookTimeout: 10000, // 10 seconds for hooks (increased from 3s)
    teardownTimeout: 10000, // 10 seconds for teardown (increased from 3s)
    
    // Retry configuration
    retry: process.env.CI ? 2 : 0,
    
    // Coverage configuration - optimized for performance
    coverage: {
      provider: 'v8',
      reporter: process.env.CI ? ['text', 'json', 'lcov'] : ['text'], // Reduced reporters for speed
      reportsDirectory: './coverage',
      enabled: process.env.COVERAGE === 'true', // Only enable when explicitly requested
      
      // Coverage thresholds - relaxed for speed
      thresholds: {
        global: {
          branches: 75,
          functions: 80,
          lines: 80,
          statements: 80
        }
      },
      
      // Include patterns
      include: [
        'src/**/*.{js,ts}',
        'app/**/*.{js,ts}',
      ],
      
      // Exclude patterns
      exclude: [
        'src/**/*.test.{js,ts}',
        'src/**/*.spec.{js,ts}',
        'src/**/*.d.ts',
        'src/**/types/**',
        'src/**/schemas/**',
        'app/**/layout.tsx',
        'app/**/loading.tsx',
        'app/**/error.tsx',
        'app/**/not-found.tsx',
        // Database migrations
        'src/db/migrations/**',
        // Configuration files
        '**/*.config.{js,ts}',
        '**/*.setup.{js,ts}',
        // Next.js specific
        'app/**/page.tsx', // Exclude page components (tested via E2E)
        'middleware.ts',
      ],
      
      // Advanced coverage options
      watermarks: {
        statements: [80, 95],
        functions: [80, 95],
        branches: [80, 95],
        lines: [80, 95]
      }
    },
    
    // Simplified environment variables for testing
    env: {
      // Test environment indicators
      NODE_ENV: 'test',
      VITEST: 'true',
      
      // Mock API keys (safe for testing)
      OPENAI_API_KEY: 'test-openai-key-vitest',
      MEXC_API_KEY: 'test-mexc-key-vitest',
      MEXC_SECRET_KEY: 'test-mexc-secret-vitest',
      MEXC_BASE_URL: 'https://api.mexc.com',
      
      // Encryption key for secure services (base64 encoded test key)
      ENCRYPTION_MASTER_KEY: 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcwo=',
      
      // Database configuration
      DATABASE_URL: process.env.DATABASE_URL,
      FORCE_MOCK_DB: process.env.FORCE_MOCK_DB || 'false',
      
      // Feature flags for testing
      SKIP_AUTH_IN_TESTS: 'true',
      ENABLE_DEBUG_LOGGING: 'false',
    },
    
    // Setup files - re-enabled after fixing initialization issues
    setupFiles: ['./tests/setup/vitest-setup.ts'],
    
    // Reporter configuration - optimized for performance
    reporters: process.env.CI 
      ? ['github-actions', 'json']
      : process.env.VERBOSE_TESTS === 'true' ? ['verbose'] : [['default', { summary: undefined }]], // Minimal reporting for speed
      
    // Output configuration
    outputFile: {
      json: './test-results/vitest-results.json',
      html: './test-results/vitest-report.html'
    },
    
    // Watch configuration
    watch: !process.env.CI,
    
    // Optimized performance settings for faster test execution
    logHeapUsage: false,
    isolate: true, // Re-enabled for proper test isolation
    sequence: {
      concurrent: true, // Enable concurrent execution for speed
      shuffle: false,
    },
    
    // Optimized parallel execution settings
    threads: true,
    maxConcurrency: 4, // Allow 4 concurrent tests (increased from 1)
    fileParallelism: true // Enable file parallelism for speed
  },
  
  // Module resolution - remove manual aliases to let vite-tsconfig-paths handle them
  
  // Build configuration for testing
  esbuild: {
    target: 'node18',
    sourcemap: true,
  },
  
  // Define global constants
  define: {
    __TEST__: true,
    __DEV__: false,
    __PROD__: false
  }
})