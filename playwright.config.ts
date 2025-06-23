/**
 * Playwright Configuration for E2E Authentication Testing
 * 
 * Enhanced for testing authentication flows across different environments
 * with proper isolation, parallel execution, and comprehensive reporting.
 */

import { defineConfig, devices } from '@playwright/test'
import path from 'path'

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
    // Authentication flow tests - Chrome
    {
      name: 'auth-chrome',
      testMatch: '**/auth-flow-validation.spec.ts',
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
    
    // Authentication flow tests - Firefox
    {
      name: 'auth-firefox',
      testMatch: '**/auth-flow-validation.spec.ts',
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
    
    // Authentication flow tests - Safari
    {
      name: 'auth-webkit',
      testMatch: '**/auth-flow-validation.spec.ts',
      use: { ...devices['Desktop Safari'] },
    },
    
    // Mobile authentication tests
    {
      name: 'auth-mobile',
      testMatch: '**/auth-flow-validation.spec.ts',
      use: { 
        ...devices['Pixel 5'],
        // Mobile-specific timeout adjustments
        navigationTimeout: 20 * 1000,
        actionTimeout: 15 * 1000,
      },
    },
    
    // Existing general E2E tests
    {
      name: 'chromium',
      testIgnore: '**/auth-flow-validation.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      testIgnore: '**/auth-flow-validation.spec.ts',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      testIgnore: '**/auth-flow-validation.spec.ts',
      use: { ...devices['Desktop Safari'] },
    },

    {
      name: 'Mobile Chrome',
      testIgnore: '**/auth-flow-validation.spec.ts',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      testIgnore: '**/auth-flow-validation.spec.ts',
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
      NODE_ENV: TEST_ENVIRONMENT,
      PORT: '3008',
      // Test environment variables for auth
      KINDE_ISSUER_URL: 'https://test-mexcsniper.kinde.com',
      KINDE_SITE_URL: 'http://localhost:3008',
      KINDE_CLIENT_ID: 'test_client_id',
      KINDE_CLIENT_SECRET: 'test_client_secret',
      KINDE_POST_LOGIN_REDIRECT_URL: 'http://localhost:3008/dashboard',
      KINDE_POST_LOGOUT_REDIRECT_URL: 'http://localhost:3008',
      // Database
      DATABASE_URL: 'postgresql://test:test@localhost:5432/mexc_test',
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
})