import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load Supabase-specific test environment variables
config({ path: '.env.test.supabase', override: true })

/**
 * Supabase-Specific Vitest Configuration
 * 
 * This configuration is optimized for testing Supabase integration:
 * - Supabase authentication flows
 * - Database operations with UUID primary keys
 * - Real-time subscriptions
 * - Row Level Security (RLS) policies
 * - API route protection with Supabase auth
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Environment setup for Supabase testing
    environment: 'jsdom',
    globals: true,
    
    // Test discovery - Focus on Supabase-related tests
    include: [
      'tests/unit/*supabase*.test.{js,ts}',
      'tests/integration/*supabase*.test.{js,ts}',
      'tests/unit/supabase-auth.test.ts',
      'tests/unit/supabase-database.test.ts',
      'tests/unit/supabase-api-auth.test.ts',
      'tests/integration/supabase-integration.test.ts',
    ],
    
    // Exclude non-Supabase tests for focused testing
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
      'tests/unit/*kinde*.test.ts', // Exclude Kinde-specific tests
    ],
    
    // Increased timeout for Supabase operations
    testTimeout: 15000, // 15 seconds for database operations
    hookTimeout: 10000, // 10 seconds for setup/teardown
    teardownTimeout: 10000,
    
    // Retry configuration for flaky network operations
    retry: process.env.CI ? 3 : 1,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
      reportsDirectory: './coverage/supabase',
      enabled: true,
      
      // Focus coverage on Supabase-related code
      include: [
        'src/lib/supabase-*.ts',
        'src/db/schemas/supabase-*.ts',
        'app/api/auth/**/*.ts',
      ],
      
      exclude: [
        'src/**/*.test.{js,ts}',
        'src/**/*.spec.{js,ts}',
        'src/**/*.d.ts',
        'src/lib/kinde-*.ts', // Exclude Kinde auth files
      ],
      
      thresholds: {
        global: {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85
        }
      }
    },
    
    // Environment variables specific to Supabase testing
    env: {
      // Test environment indicators
      NODE_ENV: 'test',
      VITEST: 'true',
      SUPABASE_TEST_MODE: 'true',
      
      // Supabase configuration from .env.test.supabase
      DATABASE_URL: process.env.DATABASE_URL,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      
      // Feature flags for Supabase testing
      ENABLE_SUPABASE_TESTING: 'true',
      FORCE_MOCK_DB: 'false', // Use real Supabase for integration tests
      SKIP_AUTH_IN_TESTS: 'false', // Test actual auth flows
      ENABLE_RLS_TESTING: 'true',
      
      // Mock API keys (safe for testing)
      MEXC_API_KEY: 'test-mexc-key-supabase',
      MEXC_SECRET_KEY: 'test-mexc-secret-supabase',
      OPENAI_API_KEY: 'test-openai-key-supabase',
      
      // URLs for testing
      NEXT_PUBLIC_BASE_URL: 'http://localhost:3008',
      NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    },
    
    // Setup files for Supabase testing
    setupFiles: [
      './tests/setup/vitest-setup.ts',
      './tests/setup/supabase-test-setup.ts'
    ],
    
    // Reporter configuration
    reporters: process.env.CI 
      ? ['github-actions', 'json', 'junit']
      : ['verbose'],
      
    // Output configuration
    outputFile: {
      json: './test-results/supabase-test-results.json',
      junit: './test-results/supabase-junit.xml',
      html: './test-results/supabase-report.html'
    },
    
    // Watch mode disabled for CI
    watch: !process.env.CI,
    
    // Pool configuration for Supabase tests
    pool: 'threads',
    poolOptions: {
      threads: {
        isolate: true, // Isolate for database testing
        maxThreads: process.env.CI ? 1 : 2, // Limit concurrent database connections
        minThreads: 1,
      }
    },
    
    // Sequential execution for database tests to avoid conflicts
    sequence: {
      hooks: 'stack',
      setupFiles: 'list'
    }
  },
  
  // Build configuration for testing
  esbuild: {
    target: 'node18',
    sourcemap: true,
  },
  
  // Define global constants for Supabase testing
  define: {
    __TEST__: true,
    __DEV__: false,
    __PROD__: false,
    __SUPABASE_TEST__: true,
  }
})