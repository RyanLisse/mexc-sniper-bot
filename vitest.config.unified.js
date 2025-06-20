import { defineConfig } from 'vitest/config'
import path from 'path'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import tsconfigPaths from 'vite-tsconfig-paths'

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
      'tests/unit/**/*.test.{js,ts}',
      'tests/integration/**/*.test.{js,ts}',
      'tests/agents/**/*.test.{js,ts}', // Agent-specific tests
      'src/**/*.test.{js,ts}', // Allow co-located tests
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
    
    // Timeouts and retries
    testTimeout: 30000, // 30 seconds per test
    hookTimeout: 20000, // 20 seconds for hooks (database setup needs more time)
    teardownTimeout: 15000, // 15 seconds for teardown (database cleanup)
    
    // Retry configuration
    retry: process.env.CI ? 2 : 0,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      
      // Coverage thresholds
      thresholds: {
        global: {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85
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
    
    // Environment variables for testing
    env: {
      // Test environment indicators
      NODE_ENV: 'test',
      VITEST: 'true',
      
      // Mock API keys (safe for testing)
      OPENAI_API_KEY: 'test-openai-key-vitest',
      MEXC_API_KEY: 'test-mexc-key-vitest',
      MEXC_SECRET_KEY: 'test-mexc-secret-vitest',
      MEXC_BASE_URL: 'https://api.mexc.com',
      
      // NeonDB branch configuration for isolated testing
      DATABASE_URL: process.env.DATABASE_URL,
      NEON_API_KEY: process.env.NEON_API_KEY || 'test-neon-api-key-for-mocking',
      NEON_PROJECT_ID: process.env.NEON_PROJECT_ID || 'silent-firefly-a1l3mkrm',
      USE_TEST_BRANCHES: 'true',
      SKIP_NEON_INTEGRATION: 'false',
      FORCE_SQLITE: 'false',
      TURSO_DATABASE_URL: undefined,
      TURSO_AUTH_TOKEN: undefined,
      
      // Encryption keys for testing
      ENCRYPTION_MASTER_KEY: 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcy1sb25n',
      
      // Inngest configuration
      INNGEST_SIGNING_KEY: 'test-inngest-signing-key',
      INNGEST_EVENT_KEY: 'test-inngest-event-key',
      
      // Feature flags for testing
      ENABLE_DEBUG_LOGGING: 'false',
      ENABLE_PERFORMANCE_MONITORING: 'true',
      SKIP_AUTH_IN_TESTS: 'true',
      
      // Database test settings
      FORCE_MOCK_DB: 'false', // Allow real database connections
      TEST_DB_TIMEOUT: '20000', // 20 second timeout for database operations
    },
    
    // Setup files
    setupFiles: [
      './tests/setup/vitest-setup.js'
    ],
    
    // Globals configuration
    globalSetup: './tests/setup/global-setup.js',
    
    // Reporter configuration
    reporter: process.env.CI 
      ? ['github-actions', 'json', 'html']
      : ['verbose', 'html'],
      
    // Output configuration
    outputFile: {
      json: './test-results/vitest-results.json',
      html: './test-results/vitest-report.html'
    },
    
    // Watch configuration
    watch: !process.env.CI,
    watchExclude: [
      'node_modules/**',
      'dist/**',
      '.next/**',
      'coverage/**',
      'test-results/**'
    ],
    
    // Performance monitoring
    logHeapUsage: process.env.CI,
    isolate: true, // Isolate tests for better reliability
    
    // Pool management - prevent hanging connections
    pool: 'threads',
    poolOptions: {
      threads: {
        isolate: true,
        singleThread: false,
        useAtomics: true,
        maxThreads: process.env.CI ? 1 : 2, // Reduce thread count to avoid connection leaks
        minThreads: 1,
      }
    },
    
    // Experimental features
    experimentalOptimizer: {
      enabled: true
    }
  },
  
  // Module resolution - remove manual aliases to let vite-tsconfig-paths handle them
  
  // Build configuration for testing
  esbuild: {
    target: 'node18',
    sourcemap: true,
    minify: false
  },
  
  // Define global constants
  define: {
    __TEST__: true,
    __DEV__: false,
    __PROD__: false
  }
})