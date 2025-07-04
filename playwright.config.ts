/**
 * Playwright Configuration for E2E Authentication Testing
 * 
 * Enhanced for testing authentication flows across different environments
 * with proper isolation, parallel execution, and comprehensive reporting.
 */

import { defineConfig, devices } from '@playwright/test'
import path from 'path'

const USE_COVERAGE = process.env.PW_EXPERIMENTAL_TEST_COVERAGE === '1'

// Environment configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3008';
const TEST_ENVIRONMENT = process.env.TEST_ENVIRONMENT || 'test';
const CI = process.env.CI === 'true';

export default defineConfig({
  // Test directory
  testDir: './tests/e2e',
  
  // Global test timeout
  timeout: 30 * 1000, // 30 seconds per test
  
  // Expect timeout for assertions
  expect: {
    timeout: 10 * 1000, // 10 seconds
  },
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!CI,
  
  // Retry on CI only
  retries: CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: CI ? 1 : undefined,
  
  // Enhanced reporter configuration
  reporter: [
    ['list'],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['html', { 
      open: CI ? 'never' : 'on-failure',
      outputFolder: 'playwright-report' 
    }],
    ['junit', { outputFile: 'playwright-report/junit.xml' }]
  ],
  
  // Shared settings for all projects
  use: {
    // Base URL for all tests
    baseURL: BASE_URL,
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Record video on failure
    video: 'retain-on-failure',
    
    // Take screenshot on failure
    screenshot: 'only-on-failure',
    
    // Navigation timeout
    navigationTimeout: 15 * 1000,
    
    // Action timeout
    actionTimeout: 10 * 1000,
    
    // Ignore HTTPS errors in test environments
    ignoreHTTPSErrors: TEST_ENVIRONMENT !== 'production',
    
    // Extra HTTP headers
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'x-test-environment': TEST_ENVIRONMENT,
    },
    
    // Locale and timezone
    locale: 'en-US',
    timezoneId: 'America/New_York',
  },

  // Enhanced projects configuration for authentication testing
  projects: [
    // E2E tests with browser-specific configurations
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Additional Chrome-specific settings for auth testing
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
          ]
        }
      },
    },

    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        // Firefox-specific settings
        launchOptions: {
          firefoxUserPrefs: {
            'security.tls.insecure_fallback_hosts': 'localhost',
            'network.stricttransportsecurity.preloadlist': false
          }
        }
      },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        // Mobile-specific timeout adjustments
        navigationTimeout: 20 * 1000,
        actionTimeout: 15 * 1000,
      },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Enhanced web server configuration
  webServer: TEST_ENVIRONMENT === 'test' ? {
    command: 'PLAYWRIGHT_TEST=true bun run dev',
    url: BASE_URL,
    reuseExistingServer: !CI,
    timeout: 120 * 1000, // 2 minutes to start
    env: {
      PLAYWRIGHT_TEST: 'true',
      NODE_ENV: 'test',
      PORT: '3008',
      // Supabase test environment variables
      SUPABASE_URL: 'https://wisobxvkyjzlvhipctrl.supabase.co',
      SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indpc29ieHZreWp6bHZoaXBjdHJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU0NzE4NzcsImV4cCI6MjA1MTA0Nzg3N30.test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-for-admin-operations',
      NEXT_PUBLIC_SUPABASE_URL: 'https://wisobxvkyjzlvhipctrl.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indpc29ieHZreWp6bHZoaXBjdHJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU0NzE4NzcsImV4cCI6MjA1MTA0Nzg3N30.test-anon-key',
      // Database
      DATABASE_URL: 'postgresql://postgres.wisobxvkyjzlvhipctrl:CFIqXDseFZ4u5MfR@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
      // Test environment settings
      ENABLE_SUPABASE_TESTING: 'true',
      SUPABASE_TEST_MODE: 'true',
      SKIP_AUTH_IN_TESTS: 'false',
      // Test credentials
      TEST_USER_EMAIL: 'ryan@ryanlisse.com',
      TEST_USER_PASSWORD: 'Testing2025!',
      AUTH_EMAIL: 'ryan@ryanlisse.com',
      AUTH_PASSWORD: 'Testing2025!',
      // Disable external services for testing
      OPENAI_API_KEY: 'test-key',
      MEXC_API_KEY: 'test-key',
      MEXC_SECRET_KEY: 'test-secret',
    },
  } : undefined,

  // Output directory for test artifacts
  outputDir: 'test-results/',
  
  // Test metadata
  metadata: {
    environment: TEST_ENVIRONMENT,
    baseURL: BASE_URL,
    timestamp: new Date().toISOString(),
    ci: CI,
  },
  ...(USE_COVERAGE && {
    experimental: {
      coverage: { outDir: 'coverage/e2e' }
    }
  })
})