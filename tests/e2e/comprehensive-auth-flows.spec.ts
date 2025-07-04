import { test, expect } from '@playwright/test';
import { AuthPage, DashboardPage, HomePage } from './pages';

const TEST_EMAIL = process.env.TEST_USER_EMAIL || process.env.AUTH_EMAIL || 'ryan@ryanlisse.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || process.env.AUTH_PASSWORD || 'Testing2025!';
const INVALID_EMAIL = 'invalid@example.com';
const INVALID_PASSWORD = 'wrongpassword123';

test.describe('Comprehensive Authentication Flow Tests', () => {
  let authPage: AuthPage;
  let dashboardPage: DashboardPage;
  let homePage: HomePage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    dashboardPage = new DashboardPage(page);
    homePage = new HomePage(page);

    // Clear any existing auth state
    await authPage.clearStorage();
  });

  test.describe('Authentication Page Tests', () => {
    test('should load auth page correctly', async () => {
      await authPage.navigate();
      await authPage.verifyPageElements();
      
      // Verify URL
      expect(await authPage.getCurrentUrl()).toMatch(/\/auth$/);
    });

    test('should wait for Supabase Auth UI to load', async () => {
      await authPage.navigate();
      await authPage.waitForSupabaseAuthUI();
      
      // Verify all form elements are present
      await expect(authPage['emailInput']).toBeVisible();
      await expect(authPage['passwordInput']).toBeVisible();
      await expect(authPage['signInButton']).toBeVisible();
    });
  });

  test.describe('Valid Authentication Tests', () => {
    test('should successfully sign in with valid credentials', async () => {
      await authPage.navigate();
      await authPage.signIn(TEST_EMAIL, TEST_PASSWORD);
      await authPage.waitForAuthCompletion();
      
      // Should be redirected to dashboard
      expect(await authPage.getCurrentUrl()).toMatch(/\/dashboard$/);
      
      // Verify dashboard elements are present
      await dashboardPage.verifyDashboardElements();
    });

    test('should maintain session after page refresh', async () => {
      // Sign in first
      await authPage.navigate();
      await authPage.signIn(TEST_EMAIL, TEST_PASSWORD);
      await authPage.waitForAuthCompletion();
      
      // Refresh the page
      await dashboardPage.page.reload();
      await dashboardPage.waitForPageLoad();
      
      // Should still be authenticated
      expect(await dashboardPage.isAuthenticated()).toBe(true);
    });

    test('should redirect authenticated user away from auth page', async () => {
      // Sign in first
      await authPage.navigate();
      await authPage.signIn(TEST_EMAIL, TEST_PASSWORD);
      await authPage.waitForAuthCompletion();
      
      // Try to visit auth page again
      await authPage.navigate();
      
      // Should be redirected to dashboard
      expect(await authPage.getCurrentUrl()).toMatch(/\/dashboard$/);
    });

    test('should redirect authenticated user from home page', async () => {
      // Sign in first
      await authPage.navigate();
      await authPage.signIn(TEST_EMAIL, TEST_PASSWORD);
      await authPage.waitForAuthCompletion();
      
      // Try to visit home page
      await homePage.navigate();
      
      // Should be redirected to dashboard
      expect(await homePage.getCurrentUrl()).toMatch(/\/dashboard$/);
    });
  });

  test.describe('Invalid Authentication Tests', () => {
    test('should show error for invalid email', async () => {
      await authPage.navigate();
      await authPage.signIn(INVALID_EMAIL, TEST_PASSWORD);
      
      // Wait for error message
      await expect(authPage['errorMessage']).toBeVisible({ timeout: 10000 });
      
      // Should remain on auth page
      expect(await authPage.getCurrentUrl()).toMatch(/\/auth$/);
    });

    test('should show error for invalid password', async () => {
      await authPage.navigate();
      await authPage.signIn(TEST_EMAIL, INVALID_PASSWORD);
      
      // Wait for error message
      await expect(authPage['errorMessage']).toBeVisible({ timeout: 10000 });
      
      // Should remain on auth page
      expect(await authPage.getCurrentUrl()).toMatch(/\/auth$/);
    });

    test('should show error for both invalid credentials', async () => {
      await authPage.navigate();
      await authPage.signIn(INVALID_EMAIL, INVALID_PASSWORD);
      
      // Wait for error message
      await expect(authPage['errorMessage']).toBeVisible({ timeout: 10000 });
      
      // Should remain on auth page
      expect(await authPage.getCurrentUrl()).toMatch(/\/auth$/);
    });

    test('should handle empty form submission', async () => {
      await authPage.navigate();
      
      // Try to submit without filling form
      await authPage['signInButton'].click();
      
      // Should show validation error or remain on page
      expect(await authPage.getCurrentUrl()).toMatch(/\/auth$/);
    });

    test('should handle malformed email', async () => {
      await authPage.navigate();
      await authPage.signIn('not-an-email', TEST_PASSWORD);
      
      // Should show validation error
      const hasError = await authPage.hasErrorMessage();
      expect(hasError).toBe(true);
    });
  });

  test.describe('Sign Out Flow Tests', () => {
    test('should successfully sign out from dashboard', async () => {
      // Sign in first
      await authPage.navigate();
      await authPage.signIn(TEST_EMAIL, TEST_PASSWORD);
      await authPage.waitForAuthCompletion();
      
      // Sign out
      await dashboardPage.signOut();
      
      // Should be redirected to auth page
      expect(await authPage.getCurrentUrl()).toMatch(/\/auth$/);
    });

    test('should clear session after sign out', async () => {
      // Sign in first
      await authPage.navigate();
      await authPage.signIn(TEST_EMAIL, TEST_PASSWORD);
      await authPage.waitForAuthCompletion();
      
      // Sign out
      await dashboardPage.signOut();
      
      // Try to access dashboard directly
      await dashboardPage.navigate();
      
      // Should be redirected to auth page
      expect(await authPage.getCurrentUrl()).toMatch(/\/auth$/);
    });

    test('should prevent access to protected routes after sign out', async () => {
      // Sign in first
      await authPage.navigate();
      await authPage.signIn(TEST_EMAIL, TEST_PASSWORD);
      await authPage.waitForAuthCompletion();
      
      // Sign out
      await dashboardPage.signOut();
      
      // Try to access other protected routes
      const protectedRoutes = ['/dashboard', '/settings', '/monitoring'];
      
      for (const route of protectedRoutes) {
        await authPage.goto(route);
        expect(await authPage.getCurrentUrl()).toMatch(/\/auth$/);
      }
    });
  });

  test.describe('Authentication State Management', () => {
    test('should handle concurrent authentication attempts', async () => {
      await authPage.navigate();
      
      // Start multiple sign-in attempts
      const promises = [
        authPage.signIn(TEST_EMAIL, TEST_PASSWORD),
        authPage.signIn(TEST_EMAIL, TEST_PASSWORD)
      ];
      
      // Wait for all to complete
      await Promise.allSettled(promises);
      
      // Should eventually be authenticated
      await authPage.waitForAuthCompletion();
      expect(await authPage.getCurrentUrl()).toMatch(/\/dashboard$/);
    });

    test('should handle network interruption during auth', async ({ page }) => {
      await authPage.navigate();
      
      // Simulate network failure
      await page.route('**/*', route => route.abort());
      
      await authPage.signIn(TEST_EMAIL, TEST_PASSWORD);
      
      // Restore network
      await page.unroute('**/*');
      
      // Should handle gracefully
      expect(await authPage.getCurrentUrl()).toMatch(/\/auth$/);
    });

    test('should handle session timeout', async ({ page }) => {
      // Sign in first
      await authPage.navigate();
      await authPage.signIn(TEST_EMAIL, TEST_PASSWORD);
      await authPage.waitForAuthCompletion();
      
      // Simulate session expiry by clearing tokens
      await page.evaluate(() => {
        localStorage.removeItem('supabase.auth.token');
        sessionStorage.clear();
      });
      
      // Try to access dashboard
      await dashboardPage.navigate();
      
      // Should be redirected to auth page
      expect(await authPage.getCurrentUrl()).toMatch(/\/auth$/);
    });
  });

  test.describe('Home Page Authentication Integration', () => {
    test('should navigate to auth from home page sign in button', async () => {
      await homePage.navigate();
      await homePage.clickHeaderSignIn();
      
      expect(await authPage.getCurrentUrl()).toMatch(/\/auth$/);
      await authPage.verifyPageElements();
    });

    test('should navigate to auth from home page get started button', async () => {
      await homePage.navigate();
      await homePage.clickHeaderGetStarted();
      
      expect(await authPage.getCurrentUrl()).toMatch(/\/auth$/);
      await authPage.verifyPageElements();
    });

    test('should navigate to auth from hero section buttons', async () => {
      await homePage.navigate();
      
      // Test hero get started button
      await homePage.clickHeroGetStarted();
      expect(await authPage.getCurrentUrl()).toMatch(/\/auth$/);
      
      // Go back and test hero sign in button
      await homePage.navigate();
      await homePage.clickHeroSignIn();
      expect(await authPage.getCurrentUrl()).toMatch(/\/auth$/);
    });

    test('should navigate to auth from CTA section', async () => {
      await homePage.navigate();
      await homePage.clickSignUpNow();
      
      expect(await authPage.getCurrentUrl()).toMatch(/\/auth$/);
      await authPage.verifyPageElements();
    });
  });

  test.describe('Authentication Error Handling', () => {
    test('should handle rate limiting gracefully', async () => {
      await authPage.navigate();
      
      // Attempt multiple rapid sign-ins to trigger rate limiting
      for (let i = 0; i < 10; i++) {
        await authPage.clearForm();
        await authPage.signIn(INVALID_EMAIL, INVALID_PASSWORD);
        await authPage.page.waitForTimeout(100);
      }
      
      // Should show appropriate error message
      const hasError = await authPage.hasErrorMessage();
      expect(hasError).toBe(true);
    });

    test('should recover from authentication errors', async () => {
      await authPage.navigate();
      
      // Submit invalid credentials first
      await authPage.signIn(INVALID_EMAIL, INVALID_PASSWORD);
      await expect(authPage['errorMessage']).toBeVisible();
      
      // Clear form and submit valid credentials
      await authPage.clearForm();
      await authPage.signIn(TEST_EMAIL, TEST_PASSWORD);
      await authPage.waitForAuthCompletion();
      
      // Should successfully authenticate
      expect(await authPage.getCurrentUrl()).toMatch(/\/dashboard$/);
    });

    test('should handle server errors during authentication', async ({ page }) => {
      await authPage.navigate();
      
      // Mock server error response
      await page.route('**/auth/**', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        });
      });
      
      await authPage.signIn(TEST_EMAIL, TEST_PASSWORD);
      
      // Should handle server error gracefully
      expect(await authPage.getCurrentUrl()).toMatch(/\/auth$/);
    });
  });

  test.describe('Authentication Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
      await authPage.navigate();
      
      // Tab through form elements
      await page.keyboard.press('Tab'); // Email field
      await page.keyboard.type(TEST_EMAIL);
      
      await page.keyboard.press('Tab'); // Password field
      await page.keyboard.type(TEST_PASSWORD);
      
      await page.keyboard.press('Tab'); // Submit button
      await page.keyboard.press('Enter');
      
      // Should authenticate successfully
      await authPage.waitForAuthCompletion();
      expect(await authPage.getCurrentUrl()).toMatch(/\/dashboard$/);
    });

    test('should have proper ARIA labels', async () => {
      await authPage.navigate();
      
      // Check for accessibility attributes
      const emailInput = authPage['emailInput'];
      const passwordInput = authPage['passwordInput'];
      
      await expect(emailInput).toHaveAttribute('type', 'email');
      await expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  test.describe('Authentication Performance', () => {
    test('should authenticate within acceptable time', async () => {
      await authPage.navigate();
      
      const startTime = Date.now();
      await authPage.signIn(TEST_EMAIL, TEST_PASSWORD);
      await authPage.waitForAuthCompletion();
      const endTime = Date.now();
      
      const authTime = endTime - startTime;
      expect(authTime).toBeLessThan(10000); // Should authenticate within 10 seconds
    });

    test('should load auth page quickly', async () => {
      const startTime = Date.now();
      await authPage.navigate();
      await authPage.waitForPageLoad();
      const endTime = Date.now();
      
      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
    });
  });
});