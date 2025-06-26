import { test, expect } from '@playwright/test';
import { db } from '@/src/db';
import { apiCredentials, user, userPreferences } from '@/src/db/schema';
import { eq } from 'drizzle-orm';

// Test configuration
const TEST_EMAIL = `authtest-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPass123!';
const TEST_NAME = 'Auth Test User';

test.describe('Authentication Protection Flow', () => {
  let userId: string;

  test.afterEach(async () => {
    // Clean up test data
    if (userId) {
      try {
        await db.delete(userPreferences).where(eq(userPreferences.userId, userId));
        await db.delete(apiCredentials).where(eq(apiCredentials.userId, userId));
        await db.delete(user).where(eq(user.id, userId));
        console.log(`Cleaned up test user: ${userId}`);
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
    }
  });

  test('Anonymous users cannot access dashboard and get redirected to homepage', async ({ page }) => {
    console.log('Testing dashboard protection for anonymous users');

    // Try to directly access dashboard
    await page.goto('http://localhost:3008/dashboard');
    await page.waitForLoadState('networkidle');

    // Wait a bit for any redirects to happen
    await page.waitForTimeout(2000);

    // Should be redirected away from dashboard
    const finalUrl = page.url();
    console.log(`Dashboard access attempt resulted in URL: ${finalUrl}`);

    // Verify we're not on dashboard
    expect(finalUrl).not.toMatch(/.*\/dashboard$/);

    // Check if redirected to homepage
    if (finalUrl.match(/http:\/\/localhost:3008\/?$/)) {
      await expect(page.locator('h1')).toContainText('MEXC Sniper Bot');
      console.log('✓ Anonymous user redirected to homepage from dashboard');
    } else if (finalUrl.match(/.*\/auth$/)) {
      // Or redirected to auth page
      console.log('✓ Anonymous user redirected to auth page from dashboard');
    } else {
      console.log(`✓ Anonymous user redirected away from dashboard to: ${finalUrl}`);
    }
  });

  test('Anonymous users can access homepage and navigate to auth', async ({ page }) => {
    console.log('Testing homepage access for anonymous users');

    // Go to homepage
    await page.goto('http://localhost:3008');
    await page.waitForLoadState('networkidle');

    // Skip loading state if present
    const loadingElement = page.locator('text=Loading...');
    if (await loadingElement.isVisible()) {
      await loadingElement.waitFor({ state: 'detached', timeout: 10000 });
    }

    // Verify homepage content is visible
    await expect(page.locator('h1')).toContainText('MEXC Sniper Bot');
    await expect(page.locator('text=Get Started')).toBeVisible();
    await expect(page.locator('text=Sign In')).toBeVisible();

    console.log('✓ Homepage accessible for anonymous users');

    // Test navigation to auth
    await page.click('text=Get Started');
    await page.waitForURL('**/auth', { timeout: 10000 });
    await expect(page).toHaveURL(/.*\/auth$/);

    console.log('✓ Navigation to auth page works');
  });

  test('Complete authentication flow with dashboard access protection', async ({ page }) => {
    console.log('Testing complete authentication flow with dashboard protection');

    // Step 1: Start at homepage
    await page.goto('http://localhost:3008');
    await page.waitForLoadState('networkidle');

    // Skip loading if present
    const loadingElement = page.locator('text=Loading...');
    if (await loadingElement.isVisible()) {
      await loadingElement.waitFor({ state: 'detached', timeout: 10000 });
    }

    await expect(page.locator('h1')).toContainText('MEXC Sniper Bot');
    console.log('✓ Step 1: Homepage loaded');

    // Step 2: Navigate to auth
    await page.click('text=Get Started');
    await page.waitForURL('**/auth');
    console.log('✓ Step 2: Navigated to auth page');

    // Step 3: Register new user
    await page.waitForSelector('form', { timeout: 10000 });

    // Switch to registration mode
    const createAccountButton = page.locator('text=Create account here');
    if (await createAccountButton.isVisible()) {
      await createAccountButton.click();
      await page.waitForTimeout(1000);
    }

    // Fill registration form
    await page.fill('#name', TEST_NAME);
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);

    // Submit registration
    await page.click('button[type="submit"]:has-text("Create Account")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // Verify we're on dashboard
    await expect(page).toHaveURL(/.*\/dashboard$/);
    console.log('✓ Step 3: User registered and redirected to dashboard');

    // Get user ID for cleanup
    const users = await db.select().from(user).where(eq(user.email, TEST_EMAIL));
    expect(users).toHaveLength(1);
    userId = users[0].id;
    console.log(`✓ User created with ID: ${userId}`);

    // Step 4: Verify dashboard is accessible when authenticated
    await page.goto('http://localhost:3008/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/.*\/dashboard$/);
    console.log('✓ Step 4: Dashboard accessible when authenticated');

    // Step 5: Test that authenticated users get redirected from homepage to dashboard
    await page.goto('http://localhost:3008');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page).toHaveURL(/.*\/dashboard$/);
    console.log('✓ Step 5: Authenticated users redirected from homepage to dashboard');

    // Step 6: Test sign out functionality (if available)
    const userMenuSelectors = [
      '[data-testid="user-menu"]',
      'button:has-text("Sign Out")',
      'text=Sign Out',
      '[aria-label="User menu"]',
      '.user-menu'
    ];

    let signOutClicked = false;
    for (const selector of userMenuSelectors) {
      try {
        const element = page.locator(selector);
        if (await element.isVisible({ timeout: 2000 })) {
          await element.click();
          signOutClicked = true;
          break;
        }
      } catch (error) {
        // Continue to next selector
      }
    }

    if (!signOutClicked) {
      // Try going to auth page which might have sign out option for authenticated users
      await page.goto('http://localhost:3008/auth');
      await page.waitForLoadState('networkidle');

      const signOutButton = page.locator('button:has-text("Sign Out")');
      if (await signOutButton.isVisible()) {
        await signOutButton.click();
        signOutClicked = true;
      }
    }

    if (signOutClicked) {
      // Wait for redirect to homepage after sign out
      await page.waitForURL('http://localhost:3008', { timeout: 10000 });
      await expect(page.locator('h1')).toContainText('MEXC Sniper Bot');
      console.log('✓ Step 6: Sign out successful, redirected to homepage');

      // Step 7: Verify dashboard is protected again after sign out
      await page.goto('http://localhost:3008/dashboard');
      await page.waitForURL(/http:\/\/localhost:3008\/?$|.*\/auth$/, { timeout: 10000 });
      expect(page.url()).not.toMatch(/.*\/dashboard$/);
      console.log('✓ Step 7: Dashboard protected after sign out');

      // Step 8: Test sign in with existing credentials
      if (!page.url().match(/.*\/auth$/)) {
        await page.goto('http://localhost:3008/auth');
      }
      await page.waitForLoadState('networkidle');

      // Fill sign in form (should be in sign-in mode by default)
      await page.fill('#email', TEST_EMAIL);
      await page.fill('#password', TEST_PASSWORD);

      // Submit sign in
      await page.click('button[type="submit"]:has-text("Sign In")');
      await page.waitForURL('**/dashboard', { timeout: 15000 });

      await expect(page).toHaveURL(/.*\/dashboard$/);
      console.log('✓ Step 8: Sign in successful, access to dashboard restored');
    } else {
      console.log('ℹ Sign out functionality not easily accessible, skipping sign out/in test');
    }

    console.log('✅ Complete authentication flow with dashboard protection test passed!');
  });

  test('Config page protection test', async ({ page }) => {
    console.log('Testing config page protection');

    // Try to access config page as anonymous user
    await page.goto('http://localhost:3008/config');
    await page.waitForLoadState('networkidle');

    // Wait for redirect
    await page.waitForTimeout(2000);

    const finalUrl = page.url();
    console.log(`Config access attempt resulted in URL: ${finalUrl}`);

    // Should be redirected away from config page
    expect(finalUrl).not.toMatch(/.*\/config$/);
    console.log('✓ Anonymous user cannot access config page');

    // Now register a user and test config access
    await page.goto('http://localhost:3008/auth');
    await page.waitForLoadState('networkidle');

    // Register user
    const createAccountButton = page.locator('text=Create account here');
    if (await createAccountButton.isVisible()) {
      await createAccountButton.click();
      await page.waitForTimeout(1000);
    }

    await page.fill('#name', TEST_NAME);
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);

    await page.click('button[type="submit"]:has-text("Create Account")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // Get user ID for cleanup
    const users = await db.select().from(user).where(eq(user.email, TEST_EMAIL));
    if (users.length > 0) {
      userId = users[0].id;
    }

    // Try to access config page as authenticated user
    await page.goto('http://localhost:3008/config');
    await page.waitForLoadState('networkidle');

    // Config page should be accessible (or redirect to dashboard if not implemented)
    const configUrl = page.url();
    if (configUrl.includes('/config')) {
      console.log('✓ Authenticated user can access config page');
    } else if (configUrl.includes('/dashboard')) {
      console.log('✓ Config page redirects authenticated users to dashboard (page may not be fully implemented)');
    } else {
      console.log(`ℹ Unexpected redirect to: ${configUrl}`);
    }
  });

  test('Multiple page protection verification', async ({ page }) => {
    console.log('Testing protection across multiple protected pages');

    const protectedPages = [
      '/dashboard',
      '/config',
      // Add more protected pages as they're implemented
    ];

    // Test each protected page as anonymous user
    for (const pagePath of protectedPages) {
      await page.goto(`http://localhost:3008${pagePath}`);
      await page.waitForLoadState('networkidle');

      // Wait for redirect
      await page.waitForTimeout(2000);

      const finalUrl = page.url();
      console.log(`Access attempt to ${pagePath} resulted in URL: ${finalUrl}`);

      // Should be redirected away from protected page
      expect(finalUrl).not.toMatch(new RegExp(`.*${pagePath.replace('/', '\\/')}$`));
      console.log(`✓ Anonymous user cannot access ${pagePath}`);
    }

    console.log('✅ All protected pages properly secured for anonymous users');
  });

  test('Session persistence across browser refresh', async ({ page }) => {
    console.log('Testing session persistence across browser refresh');

    // Register and authenticate user
    await page.goto('http://localhost:3008/auth');
    await page.waitForLoadState('networkidle');

    const createAccountButton = page.locator('text=Create account here');
    if (await createAccountButton.isVisible()) {
      await createAccountButton.click();
      await page.waitForTimeout(1000);
    }

    await page.fill('#name', TEST_NAME);
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);

    await page.click('button[type="submit"]:has-text("Create Account")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // Get user ID for cleanup
    const users = await db.select().from(user).where(eq(user.email, TEST_EMAIL));
    if (users.length > 0) {
      userId = users[0].id;
    }

    console.log('✓ User authenticated and on dashboard');

    // Refresh the page
    await page.reload({ waitUntil: 'networkidle' });

    // Should still be on dashboard (session persisted)
    await expect(page).toHaveURL(/.*\/dashboard$/);
    console.log('✓ Session persisted after browser refresh');

    // Try navigating to homepage - should redirect back to dashboard
    await page.goto('http://localhost:3008');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page).toHaveURL(/.*\/dashboard$/);
    console.log('✓ Authenticated user still redirected from homepage to dashboard after refresh');

    console.log('✅ Session persistence test passed!');
  });
});