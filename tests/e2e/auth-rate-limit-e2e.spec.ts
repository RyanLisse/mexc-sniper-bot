/**
 * E2E Tests for Authentication with Rate Limit Scenarios
 * 
 * Comprehensive end-to-end tests for authentication flows including
 * normal authentication and rate limit handling scenarios.
 */

import { expect, test, Page } from '@playwright/test';
import { rateLimitScenarios, authTestData } from '../utils/rate-limit-test-helpers';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3008';
const TEST_EMAIL = authTestData.validCredentials.email;
const TEST_PASSWORD = authTestData.validCredentials.password;

test.describe('Authentication Rate Limit E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Clear auth state before each test
    await page.goto(`${BASE_URL}/auth`);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test.describe('Normal Authentication Flow', () => {
    test('should authenticate successfully with valid credentials', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth`);
      await page.waitForLoadState('networkidle');

      // Wait for Supabase Auth UI to load
      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      
      // Fill credentials
      await page.fill('input[type="email"]', TEST_EMAIL);
      await page.fill('input[type="password"]', TEST_PASSWORD);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Wait for redirect to dashboard
      await page.waitForURL('**/dashboard', { timeout: 15000 });
      expect(page.url()).toMatch(/\/dashboard$/);
      
      // Verify dashboard loads
      await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 });
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth`);
      await page.waitForLoadState('networkidle');

      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      
      // Use invalid credentials
      await page.fill('input[type="email"]', authTestData.invalidCredentials.email);
      await page.fill('input[type="password"]', authTestData.invalidCredentials.password);
      
      await page.click('button[type="submit"]');
      
      // Wait for error message
      await page.waitForSelector('[role="alert"], .error, [data-testid="error"]', { timeout: 10000 });
      
      // Should stay on auth page
      expect(page.url()).toMatch(/\/auth$/);
    });
  });

  test.describe('Rate Limit Scenarios', () => {
    test('should display rate limit notice when email rate limit is exceeded', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth`);
      await page.waitForLoadState('networkidle');

      // Mock rate limit response
      await page.route('**/api/auth/**', (route) => {
        route.fulfill({
          status: 429,
          headers: { 'retry-after': '1800' },
          body: JSON.stringify({
            error: 'Email rate limit exceeded. Only 2 emails per hour are allowed.'
          })
        });
      });

      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      
      await page.fill('input[type="email"]', TEST_EMAIL);
      await page.fill('input[type="password"]', TEST_PASSWORD);
      
      await page.click('button[type="submit"]');
      
      // Wait for rate limit notice
      await page.waitForSelector('[data-testid="rate-limit-notice"], .rate-limit-notice', { timeout: 10000 });
      
      // Check for rate limit message
      await expect(page.locator('text=Email rate limit exceeded')).toBeVisible();
      await expect(page.locator('text=30 minutes')).toBeVisible();
      await expect(page.locator('text=magic link')).toBeVisible();
    });

    test('should handle OTP rate limit with retry suggestion', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth`);
      await page.waitForLoadState('networkidle');

      // Mock OTP rate limit response
      await page.route('**/api/auth/**', (route) => {
        route.fulfill({
          status: 429,
          body: JSON.stringify({
            error: 'OTP rate limit exceeded. Too many verification codes requested.'
          })
        });
      });

      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      
      await page.fill('input[type="email"]', TEST_EMAIL);
      await page.fill('input[type="password"]', TEST_PASSWORD);
      
      await page.click('button[type="submit"]');
      
      // Wait for OTP rate limit notice
      await page.waitForSelector('[data-testid="rate-limit-notice"], .rate-limit-notice', { timeout: 10000 });
      
      // Check for OTP rate limit message
      await expect(page.locator('text=OTP rate limit exceeded')).toBeVisible();
      await expect(page.locator('text=alternative verification')).toBeVisible();
    });

    test('should display time remaining for rate limit recovery', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth`);
      await page.waitForLoadState('networkidle');

      // Mock rate limit with specific retry-after
      await page.route('**/api/auth/**', (route) => {
        route.fulfill({
          status: 429,
          headers: { 'retry-after': '900' }, // 15 minutes
          body: JSON.stringify({
            error: 'Email rate limit exceeded. Please try again in 15 minutes.'
          })
        });
      });

      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      
      await page.fill('input[type="email"]', TEST_EMAIL);
      await page.fill('input[type="password"]', TEST_PASSWORD);
      
      await page.click('button[type="submit"]');
      
      // Wait for rate limit notice with time remaining
      await page.waitForSelector('[data-testid="rate-limit-notice"], .rate-limit-notice', { timeout: 10000 });
      
      // Check for time remaining display
      await expect(page.locator('text=15 minutes')).toBeVisible();
    });

    test('should show different messages for different rate limit types', async ({ page }) => {
      const testCases = [
        {
          error: 'Email rate limit exceeded. Only 2 emails per hour are allowed.',
          expectedText: 'Email rate limit exceeded',
          expectedSuggestion: 'magic link'
        },
        {
          error: 'MFA rate limit exceeded. Please wait before trying again.',
          expectedText: 'MFA rate limit exceeded',
          expectedSuggestion: 'multi-factor authentication'
        },
        {
          error: 'Anonymous sign-in rate limit exceeded.',
          expectedText: 'Anonymous sign-in rate limit exceeded',
          expectedSuggestion: 'permanent account'
        }
      ];

      for (const testCase of testCases) {
        await page.goto(`${BASE_URL}/auth`);
        await page.waitForLoadState('networkidle');

        await page.route('**/api/auth/**', (route) => {
          route.fulfill({
            status: 429,
            body: JSON.stringify({ error: testCase.error })
          });
        });

        await page.waitForSelector('input[type="email"]', { timeout: 10000 });
        
        await page.fill('input[type="email"]', TEST_EMAIL);
        await page.fill('input[type="password"]', TEST_PASSWORD);
        
        await page.click('button[type="submit"]');
        
        // Wait for specific rate limit message
        await page.waitForSelector('[data-testid="rate-limit-notice"], .rate-limit-notice', { timeout: 10000 });
        
        await expect(page.locator(`text=${testCase.expectedText}`)).toBeVisible();
        await expect(page.locator(`text=${testCase.expectedSuggestion}`)).toBeVisible();
      }
    });
  });

  test.describe('Rate Limit Recovery', () => {
    test('should recover from temporary rate limit', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth`);
      await page.waitForLoadState('networkidle');

      let requestCount = 0;
      
      // Mock progressive recovery
      await page.route('**/api/auth/**', (route) => {
        requestCount++;
        
        if (requestCount <= 2) {
          route.fulfill({
            status: 429,
            body: JSON.stringify({
              error: 'OTP rate limit exceeded. Too many verification codes requested.'
            })
          });
        } else {
          route.fulfill({
            status: 200,
            body: JSON.stringify({
              session: { access_token: 'recovered-token' },
              user: { id: 'test-user', email: TEST_EMAIL }
            })
          });
        }
      });

      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      
      await page.fill('input[type="email"]', TEST_EMAIL);
      await page.fill('input[type="password"]', TEST_PASSWORD);
      
      await page.click('button[type="submit"]');
      
      // First attempt should show rate limit
      await page.waitForSelector('[data-testid="rate-limit-notice"], .rate-limit-notice', { timeout: 10000 });
      
      // Wait for retry button or auto-retry
      await page.waitForSelector('button:has-text("Retry"), [data-testid="retry-button"]', { timeout: 10000 });
      await page.click('button:has-text("Retry"), [data-testid="retry-button"]');
      
      // Should still be rate limited on second attempt
      await page.waitForSelector('[data-testid="rate-limit-notice"], .rate-limit-notice', { timeout: 10000 });
      
      // Third attempt should succeed
      await page.click('button:has-text("Retry"), [data-testid="retry-button"]');
      
      // Should redirect to dashboard
      await page.waitForURL('**/dashboard', { timeout: 15000 });
      expect(page.url()).toMatch(/\/dashboard$/);
    });
  });

  test.describe('Rate Limit Bypass in Development', () => {
    test('should offer bypass option in development mode', async ({ page }) => {
      // Only run in development environment
      if (process.env.NODE_ENV !== 'development') {
        test.skip();
        return;
      }

      await page.goto(`${BASE_URL}/auth`);
      await page.waitForLoadState('networkidle');

      // Mock email rate limit
      await page.route('**/api/auth/**', (route) => {
        route.fulfill({
          status: 429,
          body: JSON.stringify({
            error: 'Email rate limit exceeded. Only 2 emails per hour are allowed.'
          })
        });
      });

      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      
      await page.fill('input[type="email"]', TEST_EMAIL);
      await page.fill('input[type="password"]', TEST_PASSWORD);
      
      await page.click('button[type="submit"]');
      
      // Wait for rate limit notice with bypass option
      await page.waitForSelector('[data-testid="rate-limit-notice"], .rate-limit-notice', { timeout: 10000 });
      
      // Check for bypass button in development
      await expect(page.locator('button:has-text("Bypass Rate Limit"), [data-testid="bypass-button"]')).toBeVisible();
    });

    test('should not show bypass option in production', async ({ page }) => {
      // Mock production environment
      await page.addInitScript(() => {
        Object.defineProperty(window, 'process', {
          value: { env: { NODE_ENV: 'production' } }
        });
      });

      await page.goto(`${BASE_URL}/auth`);
      await page.waitForLoadState('networkidle');

      // Mock email rate limit
      await page.route('**/api/auth/**', (route) => {
        route.fulfill({
          status: 429,
          body: JSON.stringify({
            error: 'Email rate limit exceeded. Only 2 emails per hour are allowed.'
          })
        });
      });

      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      
      await page.fill('input[type="email"]', TEST_EMAIL);
      await page.fill('input[type="password"]', TEST_PASSWORD);
      
      await page.click('button[type="submit"]');
      
      // Wait for rate limit notice
      await page.waitForSelector('[data-testid="rate-limit-notice"], .rate-limit-notice', { timeout: 10000 });
      
      // Should not show bypass button in production
      await expect(page.locator('button:has-text("Bypass Rate Limit"), [data-testid="bypass-button"]')).not.toBeVisible();
    });
  });

  test.describe('User Experience During Rate Limits', () => {
    test('should maintain form state during rate limit errors', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth`);
      await page.waitForLoadState('networkidle');

      // Mock rate limit response
      await page.route('**/api/auth/**', (route) => {
        route.fulfill({
          status: 429,
          body: JSON.stringify({
            error: 'Email rate limit exceeded. Only 2 emails per hour are allowed.'
          })
        });
      });

      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      
      await page.fill('input[type="email"]', TEST_EMAIL);
      await page.fill('input[type="password"]', TEST_PASSWORD);
      
      await page.click('button[type="submit"]');
      
      // Wait for rate limit notice
      await page.waitForSelector('[data-testid="rate-limit-notice"], .rate-limit-notice', { timeout: 10000 });
      
      // Form should maintain the email value
      const emailValue = await page.inputValue('input[type="email"]');
      expect(emailValue).toBe(TEST_EMAIL);
      
      // Password should be cleared for security
      const passwordValue = await page.inputValue('input[type="password"]');
      expect(passwordValue).toBe('');
    });

    test('should show loading state during authentication', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth`);
      await page.waitForLoadState('networkidle');

      // Mock slow response
      await page.route('**/api/auth/**', (route) => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({
              session: { access_token: 'test-token' },
              user: { id: 'test-user', email: TEST_EMAIL }
            })
          });
        }, 2000);
      });

      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      
      await page.fill('input[type="email"]', TEST_EMAIL);
      await page.fill('input[type="password"]', TEST_PASSWORD);
      
      await page.click('button[type="submit"]');
      
      // Should show loading state
      await expect(page.locator('[data-testid="loading"], .loading, .spinner')).toBeVisible();
      
      // Button should be disabled during loading
      const submitButton = page.locator('button[type="submit"]');
      await expect(submitButton).toBeDisabled();
    });

    test('should provide clear error feedback', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth`);
      await page.waitForLoadState('networkidle');

      // Mock rate limit response
      await page.route('**/api/auth/**', (route) => {
        route.fulfill({
          status: 429,
          headers: { 'retry-after': '1800' },
          body: JSON.stringify({
            error: 'Email rate limit exceeded. Only 2 emails per hour are allowed.'
          })
        });
      });

      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      
      await page.fill('input[type="email"]', TEST_EMAIL);
      await page.fill('input[type="password"]', TEST_PASSWORD);
      
      await page.click('button[type="submit"]');
      
      // Wait for rate limit notice
      await page.waitForSelector('[data-testid="rate-limit-notice"], .rate-limit-notice', { timeout: 10000 });
      
      // Should show clear explanation
      await expect(page.locator('text=Only 2 emails per hour are allowed')).toBeVisible();
      
      // Should show time remaining
      await expect(page.locator('text=30 minutes')).toBeVisible();
      
      // Should show suggestion
      await expect(page.locator('text=magic link')).toBeVisible();
    });
  });

  test.describe('Account Verification Test', () => {
    test('should verify test account works correctly', async ({ page }) => {
      await page.goto(`${BASE_URL}/auth`);
      await page.waitForLoadState('networkidle');

      // Test with the provided test account
      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      
      await page.fill('input[type="email"]', TEST_EMAIL);
      await page.fill('input[type="password"]', TEST_PASSWORD);
      
      await page.click('button[type="submit"]');
      
      // Should successfully authenticate
      await page.waitForURL('**/dashboard', { timeout: 15000 });
      expect(page.url()).toMatch(/\/dashboard$/);
      
      // Dashboard should load correctly
      await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 });
      
      // Should show user information
      await expect(page.locator(`text=${TEST_EMAIL}`)).toBeVisible();
      
      // Test sign out
      const signOutButton = page.locator('button:has-text("Sign Out"), [data-testid="sign-out"], button:has-text("Logout")').first();
      
      if (await signOutButton.isVisible()) {
        await signOutButton.click();
      } else {
        // Try user menu
        const userMenu = page.locator('[data-testid="user-menu"], .user-menu, button[aria-label*="user"]').first();
        await userMenu.click();
        await page.click('button:has-text("Sign Out"), [data-testid="sign-out"]');
      }
      
      // Should redirect to auth page
      await page.waitForURL('**/auth', { timeout: 10000 });
      expect(page.url()).toMatch(/\/auth$/);
    });
  });
});