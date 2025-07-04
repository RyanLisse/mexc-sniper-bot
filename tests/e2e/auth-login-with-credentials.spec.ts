import { test, expect } from '@playwright/test'

const EMAIL = process.env.TEST_USER_EMAIL || process.env.AUTH_EMAIL || 'ryan@ryanlisse.com'
const PASSWORD = process.env.TEST_USER_PASSWORD || process.env.AUTH_PASSWORD || 'Testing2025!'

// These tests rely on the baseURL configured in playwright.config.ts

test.describe('Login With Credentials', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure we start with clean auth state
    await page.goto('/auth');
    
    // Clear any existing auth state
    try {
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should log in, reach dashboard and log out', async ({ page }) => {
    // Navigate to the auth page using configured baseURL
    await page.goto('/auth')
    await page.waitForLoadState('networkidle');

    // Wait for Supabase Auth UI to load
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    // Fill credentials using proper Supabase Auth UI selectors
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)

    // Submit form
    await page.click('button[type="submit"]')

    // Wait for dashboard to load
    await page.waitForURL('**/dashboard', { timeout: 15000 })
    await expect(page).toHaveURL(/.*\/dashboard/)

    // Sign out
    const signOutButton = page.locator('button:has-text("Sign Out")').or(
      page.locator('[data-testid="sign-out"]')
    ).or(
      page.locator('text=Sign Out')
    )
    if (await signOutButton.first().isVisible()) {
      await signOutButton.first().click()
    }

    await page.waitForURL('**/auth', { timeout: 15000 })
    await expect(page).toHaveURL(/.*\/auth/)
  })
})
