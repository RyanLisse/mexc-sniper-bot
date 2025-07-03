import { expect, test } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3008';
const EMAIL = process.env.AUTH_EMAIL || 'ryan@ryanlisse.com';
const PASSWORD = process.env.AUTH_PASSWORD || 'Testing2025!';

test.describe('Authentication with provided credentials', () => {
  test('should sign in and reach dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth`);
    await page.waitForLoadState('networkidle');

    // ensure we are on login form
    const loginToggle = page.locator('text=Sign in');
    if (await loginToggle.count()) {
      await loginToggle.first().click({ timeout: 2000 }).catch(() => {});
    }

    await page.fill('input[name="email"], #email', EMAIL);
    await page.fill('input[name="password"], #password', PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 15000 });
    expect(page.url()).toMatch(/\/dashboard$/);
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });
});
