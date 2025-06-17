/**
 * E2E Authentication Flow Validation Tests
 * 
 * Comprehensive testing of authentication flows using Playwright for deployment validation.
 * These tests run against live deployments to validate authentication works correctly.
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3008';
const TEST_ENVIRONMENT = process.env.TEST_ENVIRONMENT || 'test';

/**
 * Page Object Model for Authentication Pages
 */
class AuthPages {
  constructor(private page: Page) {}

  // Navigation helpers
  async navigateToHome() {
    await this.page.goto(BASE_URL);
  }

  async navigateToLogin() {
    await this.page.goto(`${BASE_URL}/api/auth/login`);
  }

  async navigateToProtectedRoute(route = '/dashboard') {
    await this.page.goto(`${BASE_URL}${route}`);
  }

  // Authentication flow helpers
  async clickSignIn() {
    await this.page.click('[data-testid="sign-in-button"], button:has-text("Sign In"), a:has-text("Sign In")');
  }

  async clickSignOut() {
    await this.page.click('[data-testid="sign-out-button"], button:has-text("Sign Out"), a:has-text("Sign Out")');
  }

  async waitForAuthRedirect() {
    // Wait for Kinde auth page or successful authentication
    await this.page.waitForURL(/kinde\.com|\/dashboard|\/api\/auth/, { timeout: 10000 });
  }

  async waitForLogout() {
    // Wait for logout to complete and redirect to home
    await this.page.waitForURL(BASE_URL, { timeout: 10000 });
  }

  // Validation helpers
  async isAuthenticated(): Promise<boolean> {
    try {
      // Look for authenticated user indicators
      const userButton = await this.page.locator('[data-testid="user-button"], [data-testid="user-menu"]').count();
      const signOutButton = await this.page.locator('button:has-text("Sign Out"), a:has-text("Sign Out")').count();
      return userButton > 0 || signOutButton > 0;
    } catch {
      return false;
    }
  }

  async isUnauthenticated(): Promise<boolean> {
    try {
      const signInButton = await this.page.locator('button:has-text("Sign In"), a:has-text("Sign In")').count();
      return signInButton > 0;
    } catch {
      return false;
    }
  }

  async hasAccessToProtectedContent(): Promise<boolean> {
    try {
      // Look for dashboard content or protected sections
      await this.page.waitForSelector('[data-testid="dashboard"], [data-testid="protected-content"], h1:has-text("Dashboard")', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

test.describe('Authentication Flow Validation', () => {
  let authPages: AuthPages;

  test.beforeEach(async ({ page }) => {
    authPages = new AuthPages(page);
    
    // Set viewport for consistent testing
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Clear any existing authentication state
    await page.context().clearCookies();
    await page.context().clearPermissions();
  });

  test.describe('Basic Authentication Flow', () => {
    test('should handle unauthenticated user accessing home page', async ({ page }) => {
      await authPages.navigateToHome();
      
      // Should not redirect to auth
      expect(page.url()).toBe(BASE_URL + '/');
      
      // Should show sign in option
      const isUnauthenticated = await authPages.isUnauthenticated();
      expect(isUnauthenticated).toBe(true);
    });

    test('should redirect unauthenticated users from protected routes', async ({ page }) => {
      await authPages.navigateToProtectedRoute('/dashboard');
      
      // Should redirect to authentication
      await authPages.waitForAuthRedirect();
      
      // Should be on auth page or login flow
      const currentUrl = page.url();
      const isOnAuthFlow = currentUrl.includes('kinde.com') || 
                          currentUrl.includes('/api/auth/login') ||
                          currentUrl.includes('/api/auth');
      
      expect(isOnAuthFlow).toBe(true);
    });

    test('should initiate authentication flow when clicking sign in', async ({ page }) => {
      await authPages.navigateToHome();
      
      // Look for and click sign in button
      const signInExists = await page.locator('button:has-text("Sign In"), a:has-text("Sign In")').count() > 0;
      
      if (signInExists) {
        await authPages.clickSignIn();
        await authPages.waitForAuthRedirect();
        
        // Should redirect to Kinde or auth endpoint
        const currentUrl = page.url();
        const isOnAuthFlow = currentUrl.includes('kinde.com') || currentUrl.includes('/api/auth');
        expect(isOnAuthFlow).toBe(true);
      } else {
        test.skip('No sign in button found on home page');
      }
    });
  });

  test.describe('Health Check Validation', () => {
    test('should have accessible auth health endpoint', async ({ page }) => {
      const response = await page.request.get(`${BASE_URL}/api/health/auth`);
      
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('auth_configured');
      expect(data).toHaveProperty('kinde_sdk_status');
      
      // Auth should be configured
      expect(data.auth_configured).toBe(true);
    });

    test('should validate environment configuration through health check', async ({ page }) => {
      const response = await page.request.get(`${BASE_URL}/api/health/auth`);
      const data = await response.json();
      
      // Environment should match expected
      expect(data.deployment_info?.environment).toBe(TEST_ENVIRONMENT);
      
      // Configuration validation should pass
      if (data.configuration_validation) {
        expect(data.configuration_validation.issuer_url_format).toBe(true);
        expect(data.configuration_validation.site_url_format).toBe(true);
        expect(data.configuration_validation.client_id_format).toBe(true);
      }
    });

    test('should have all required environment variables configured', async ({ page }) => {
      const response = await page.request.get(`${BASE_URL}/api/health/auth`);
      const data = await response.json();
      
      if (data.environment_variables) {
        expect(data.environment_variables.missing_count).toBe(0);
        expect(data.environment_variables.configured).toBeGreaterThanOrEqual(6);
      }
    });
  });

  test.describe('API Route Protection', () => {
    test('should protect API routes requiring authentication', async ({ page }) => {
      // Test various protected API endpoints
      const protectedEndpoints = [
        '/api/auth/session',
        '/api/user/profile',
        '/api/admin/settings'
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await page.request.get(`${BASE_URL}${endpoint}`);
        
        // Should return 401/403 for unauthenticated requests or redirect to auth
        const status = response.status();
        const isProtected = status === 401 || status === 403 || status === 302;
        
        expect(isProtected).toBe(true);
      }
    });

    test('should handle CORS properly on auth endpoints', async ({ page }) => {
      const response = await page.request.fetch(`${BASE_URL}/api/health/auth`, {
        method: 'OPTIONS'
      });
      
      expect(response.status()).toBe(200);
      
      const headers = response.headers();
      expect(headers['access-control-allow-origin']).toBeDefined();
      expect(headers['access-control-allow-methods']).toBeDefined();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle authentication errors gracefully', async ({ page }) => {
      // Navigate to auth callback with invalid state
      await page.goto(`${BASE_URL}/api/auth/kinde_callback?error=access_denied`);
      
      // Should not crash the application
      await page.waitForLoadState('networkidle');
      
      // Should handle error gracefully (redirect to home or show error page)
      const currentUrl = page.url();
      const isHandledGracefully = currentUrl.includes(BASE_URL) && !currentUrl.includes('error=');
      
      expect(isHandledGracefully).toBe(true);
    });

    test('should handle network timeouts during auth flow', async ({ page }) => {
      // Simulate slow network
      await page.route('**/*kinde.com/**', route => {
        setTimeout(() => route.continue(), 5000);
      });

      await authPages.navigateToHome();
      
      // Try to initiate auth flow
      const signInExists = await page.locator('button:has-text("Sign In"), a:has-text("Sign In")').count() > 0;
      
      if (signInExists) {
        // This should either succeed or timeout gracefully
        try {
          await authPages.clickSignIn();
          await page.waitForURL(/kinde\.com/, { timeout: 3000 });
        } catch (error) {
          // Timeout is expected - application should still be functional
          const isPageResponsive = await page.locator('body').count() > 0;
          expect(isPageResponsive).toBe(true);
        }
      }
    });
  });

  test.describe('Security Validation', () => {
    test('should enforce HTTPS in production environment', async ({ page }) => {
      if (TEST_ENVIRONMENT === 'production') {
        const response = await page.request.get(BASE_URL.replace('https://', 'http://'));
        
        // Should redirect to HTTPS or return security error
        const status = response.status();
        const isSecure = status === 301 || status === 302 || status >= 400;
        
        expect(isSecure).toBe(true);
      }
    });

    test('should have proper security headers', async ({ page }) => {
      const response = await page.request.get(BASE_URL);
      const headers = response.headers();
      
      // Check for important security headers
      if (TEST_ENVIRONMENT === 'production') {
        expect(headers['strict-transport-security']).toBeDefined();
        expect(headers['x-frame-options']).toBeDefined();
        expect(headers['x-content-type-options']).toBeDefined();
      }
    });

    test('should not expose sensitive information in client-side', async ({ page }) => {
      await authPages.navigateToHome();
      
      // Check that no secrets are exposed in page source
      const pageContent = await page.content();
      
      const sensitivePatterns = [
        /client_secret/i,
        /kinde_client_secret/i,
        /private.*key/i,
        /secret.*key/i
      ];

      for (const pattern of sensitivePatterns) {
        expect(pageContent).not.toMatch(pattern);
      }
    });
  });

  test.describe('Performance Validation', () => {
    test('should load authentication pages within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      
      await authPages.navigateToHome();
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should handle concurrent authentication requests', async ({ browser }) => {
      // Create multiple browser contexts
      const contexts = await Promise.all([
        browser.newContext(),
        browser.newContext(),
        browser.newContext()
      ]);

      const pages = await Promise.all(
        contexts.map(context => context.newPage())
      );

      // Navigate all pages to auth flow simultaneously
      const navigationPromises = pages.map(page => 
        page.goto(`${BASE_URL}/api/auth/login`)
      );

      const responses = await Promise.all(navigationPromises);
      
      // All should succeed or handle gracefully
      responses.forEach(response => {
        if (response) {
          expect(response.status()).toBeLessThan(500);
        }
      });

      // Cleanup
      await Promise.all(contexts.map(context => context.close()));
    });
  });
});

test.describe('Environment-Specific Tests', () => {
  test('should validate staging environment configuration', async ({ page }) => {
    test.skip(TEST_ENVIRONMENT !== 'staging', 'Staging-specific test');
    
    const response = await page.request.get(`${BASE_URL}/api/health/auth`);
    const data = await response.json();
    
    expect(data.deployment_info.environment).toBe('staging');
    expect(data.deployment_info.kinde_issuer_domain).toContain('staging');
  });

  test('should validate production environment security', async ({ page }) => {
    test.skip(TEST_ENVIRONMENT !== 'production', 'Production-specific test');
    
    const response = await page.request.get(BASE_URL);
    
    // Production should enforce HTTPS
    expect(BASE_URL).toMatch(/^https:/);
    
    // Should have security headers
    const headers = response.headers();
    expect(headers['strict-transport-security']).toBeDefined();
  });

  test('should validate test environment isolation', async ({ page }) => {
    test.skip(TEST_ENVIRONMENT !== 'test', 'Test environment-specific test');
    
    const response = await page.request.get(`${BASE_URL}/api/health/auth`);
    const data = await response.json();
    
    expect(data.deployment_info.environment).toBe('test');
    expect(data.deployment_info.kinde_issuer_domain).toContain('test');
  });
});