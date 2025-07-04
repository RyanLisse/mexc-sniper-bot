import { expect, test } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3008';
const TEST_EMAIL = process.env.TEST_USER_EMAIL || process.env.AUTH_EMAIL || 'ryan@ryanlisse.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || process.env.AUTH_PASSWORD || 'Testing2025!';

test.describe('Authentication Flow Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure we start with a clean auth state
    await page.goto(`${BASE_URL}/auth`);
    
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

  test('Authentication page loads correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`);
    await page.waitForLoadState('networkidle');

    // Check that the page loaded correctly
    await expect(page.locator('h1')).toContainText('MEXC Sniper');
    
    // Check that the auth form is present (use more specific selector for the submit button)
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // Check for email and password fields (Supabase Auth UI)
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('Successfully authenticates with valid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`);
    await page.waitForLoadState('networkidle');

    // Wait for Supabase Auth UI to load
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    
    // Fill in the credentials
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    
    // Click the sign in button
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    expect(page.url()).toMatch(/\/dashboard$/);
    
    // Verify we're on the dashboard
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 });
  });

  test('Shows error for invalid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`);
    await page.waitForLoadState('networkidle');

    // Wait for Supabase Auth UI to load
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    
    // Fill in invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    
    // Click the sign in button
    await page.click('button[type="submit"]');
    
    // Wait for error message to appear
    await page.waitForSelector('[role="alert"], .error, [data-testid="error"]', { timeout: 5000 });
    
    // Verify we're still on the auth page
    expect(page.url()).toMatch(/\/auth$/);
  });

  test('Redirects authenticated user to dashboard', async ({ page }) => {
    // First, authenticate
    await page.goto(`${BASE_URL}/auth`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    // Now try to go back to auth page - should redirect to dashboard
    await page.goto(`${BASE_URL}/auth`);
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    expect(page.url()).toMatch(/\/dashboard$/);
  });

  test('Can sign out and return to auth page', async ({ page }) => {
    // First, authenticate
    await page.goto(`${BASE_URL}/auth`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    // Look for and click sign out button
    const signOutButton = page.locator('button:has-text("Sign Out"), [data-testid="sign-out"], button:has-text("Logout")').first();
    
    if (await signOutButton.isVisible()) {
      await signOutButton.click();
    } else {
      // Try user menu or dropdown
      const userMenu = page.locator('[data-testid="user-menu"], .user-menu, button[aria-label*="user"], button[aria-label*="menu"]').first();
      if (await userMenu.isVisible()) {
        await userMenu.click();
        await page.click('button:has-text("Sign Out"), [data-testid="sign-out"], button:has-text("Logout")');
      }
    }
    
    // Should be redirected back to auth page
    await page.waitForURL('**/auth', { timeout: 10000 });
    expect(page.url()).toMatch(/\/auth$/);
  });
});