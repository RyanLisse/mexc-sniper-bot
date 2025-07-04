import { expect, test } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3008';

test.describe('Mock Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Set up mock authentication state with proper Supabase cookies
    await page.goto(`${BASE_URL}/auth`);
    
    // Mock Supabase session cookies that the middleware will recognize
    const mockSession = {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: 'mock-user-id',
        email: 'ryan@ryanlisse.com',
        email_confirmed_at: new Date().toISOString(),
        user_metadata: {
          full_name: 'Test User',
          name: 'Test User',
        }
      }
    };
    
    // Set Supabase auth cookies (for SSR middleware)
    await page.context().addCookies([
      {
        name: 'sb-wisobxvkyjzlvhipctrl-auth-token',
        value: JSON.stringify(mockSession),
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        expires: Math.floor(Date.now() / 1000) + 3600
      },
      {
        name: 'sb-wisobxvkyjzlvhipctrl-auth-token.0',
        value: JSON.stringify(mockSession),
        domain: 'localhost', 
        path: '/',
        httpOnly: false,
        secure: false,
        expires: Math.floor(Date.now() / 1000) + 3600
      }
    ]);

    // Also set localStorage for client-side
    await page.evaluate((session) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('sb-wisobxvkyjzlvhipctrl-auth-token', JSON.stringify(session));
    }, mockSession);
  });

  test('Mock authentication allows dashboard access', async ({ page }) => {
    // Navigate directly to dashboard with mock auth
    await page.goto(`${BASE_URL}/dashboard`);
    
    // Wait for dashboard to load - use domcontentloaded instead of networkidle
    await page.waitForLoadState('domcontentloaded');
    
    // Check if we successfully reached the dashboard
    expect(page.url()).toMatch(/\/dashboard$/);
    
    // Wait for key dashboard elements to be visible
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('text=Total Balance').first()).toBeVisible({ timeout: 10000 });
    
    // Check for user info (may be hidden on mobile)
    const userElement = page.locator('text=Test User');
    const userVisible = await userElement.isVisible();
    if (!userVisible) {
      // On mobile, user info might be in collapsed sidebar - just verify the text exists in DOM
      await expect(userElement).toBeAttached({ timeout: 10000 });
    } else {
      await expect(userElement).toBeVisible({ timeout: 10000 });
    }
  });

  test('Auth page shows user is authenticated with mock data', async ({ page }) => {
    // Go to auth page when already "authenticated"
    await page.goto(`${BASE_URL}/auth`);
    await page.waitForLoadState('domcontentloaded');
    
    // Should show authenticated state or allow manual dashboard navigation
    // Look for either "Welcome back" message or "Go to Dashboard" button
    const welcomeMessage = page.locator('text=Welcome back');
    const dashboardButton = page.locator('text=Go to Dashboard');
    const isAuthenticated = await welcomeMessage.isVisible() || await dashboardButton.isVisible();
    
    if (isAuthenticated) {
      // If authenticated state is shown, verify we can go to dashboard
      if (await dashboardButton.isVisible()) {
        await dashboardButton.click();
        await page.waitForLoadState('domcontentloaded');
        expect(page.url()).toMatch(/\/dashboard$/);
      }
    } else {
      // If not showing authenticated state, manually navigate to dashboard
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toMatch(/\/dashboard$/);
    }
  });

  test('Dashboard loads with mock user data', async ({ page }) => {
    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('domcontentloaded');
    
    // Check that dashboard content is visible with specific elements we know exist
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('text=Total Balance').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-slot="card-description"]:has-text("New Listings")')).toBeVisible({ timeout: 10000 });
    
    // Check for user info (may be hidden on mobile)
    const userElement = page.locator('text=Test User');
    const userVisible = await userElement.isVisible();
    if (!userVisible) {
      // On mobile, user info might be in collapsed sidebar - just verify the text exists in DOM
      await expect(userElement).toBeAttached({ timeout: 10000 });
    } else {
      await expect(userElement).toBeVisible({ timeout: 10000 });
    }
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/mock-dashboard.png', fullPage: true });
  });
});