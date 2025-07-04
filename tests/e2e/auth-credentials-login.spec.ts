import { expect, test } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3008';
const EMAIL = process.env.AUTH_EMAIL || 'ryan@ryanlisse.com';
const PASSWORD = process.env.AUTH_PASSWORD || 'Testing2025!';

test.describe('Authentication with provided credentials', () => {
  test.beforeEach(async ({ request }) => {
    // Ensure test user exists
    try {
      await request.post(`${BASE_URL}/api/test-users`, {
        data: {
          email: EMAIL,
          password: PASSWORD,
        },
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.warn('Failed to create/ensure test user exists:', error);
    }
  });

  test('should sign in and reach dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`);
    await page.waitForLoadState('networkidle');

    // Wait for Supabase Auth UI to load
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    // Fill in the credentials using proper Supabase Auth UI selectors
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    
    // Click the sign in button
    await page.click('button:has-text("Sign In")');

    await page.waitForURL('**/dashboard', { timeout: 15000 });
    expect(page.url()).toMatch(/\/dashboard$/);
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });
});
