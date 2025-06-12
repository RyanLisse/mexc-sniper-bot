import { test, expect } from '@playwright/test';
import { db } from '@/src/db';
import { user } from '@/src/db/schema';
import { eq } from 'drizzle-orm';

// Test configuration
const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPass123!';
const TEST_USERNAME = `testuser${Date.now()}`;

test.describe('Simplified Authentication Flow', () => {
  let userId: string;
  
  test.beforeEach(async ({ page }) => {
    // Ensure we start from a clean state
    await page.goto('http://localhost:3008');
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'debug-initial-load.png', fullPage: true });
  });

  test.afterEach(async () => {
    // Clean up test user if created
    if (userId) {
      try {
        await db.delete(user).where(eq(user.id, userId));
        console.log(`Cleaned up test user: ${userId}`);
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
    }
  });

  test('Homepage loads correctly for unauthenticated users', async ({ page }) => {
    console.log('Testing homepage load for unauthenticated users');
    
    // Wait for page to load completely
    await page.waitForLoadState('networkidle');
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'debug-homepage.png', fullPage: true });
    
    // Check if page contains loading state
    const loadingElement = page.locator('text=Loading...');
    if (await loadingElement.isVisible()) {
      console.log('Page is in loading state, waiting...');
      await loadingElement.waitFor({ state: 'detached', timeout: 10000 });
    }
    
    // Wait for the main heading to appear
    await page.waitForSelector('h1', { timeout: 10000 });
    
    // Verify homepage content
    await expect(page.locator('h1')).toContainText('MEXC Sniper Bot');
    await expect(page.locator('text=Get Started')).toBeVisible();
    await expect(page.locator('text=Sign In')).toBeVisible();
    
    console.log('Homepage verification passed');
  });

  test('Navigation to auth page works', async ({ page }) => {
    console.log('Testing navigation to auth page');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Skip loading state if present
    const loadingElement = page.locator('text=Loading...');
    if (await loadingElement.isVisible()) {
      await loadingElement.waitFor({ state: 'detached', timeout: 10000 });
    }
    
    // Click "Get Started" button
    await page.click('text=Get Started');
    
    // Wait for navigation
    await page.waitForURL('**/auth', { timeout: 10000 });
    
    // Verify we're on the auth page
    await expect(page).toHaveURL(/.*\/auth$/);
    
    console.log('Navigation to auth page successful');
  });

  test('User registration flow', async ({ page }) => {
    console.log('Testing user registration');
    
    // Navigate to auth page
    await page.goto('http://localhost:3008/auth');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of auth page
    await page.screenshot({ path: 'debug-auth-page.png', fullPage: true });
    
    // Wait for auth form to load
    await page.waitForSelector('form', { timeout: 10000 });
    
    // Check if we need to switch to sign-up mode
    const createAccountButton = page.locator('text=Create account here');
    if (await createAccountButton.isVisible()) {
      console.log('Switching to sign-up mode');
      await createAccountButton.click();
      await page.waitForTimeout(1000); // Wait for form to update
    }
    
    // Look for registration form elements
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');
    const nameInput = page.locator('#name');
    
    // Wait for form to be ready
    await emailInput.waitFor({ timeout: 10000 });
    
    // Fill registration form
    await nameInput.fill('Test User');
    await emailInput.fill(TEST_EMAIL);
    await passwordInput.fill(TEST_PASSWORD);
    
    // Find and click submit button - should be "Create Account"
    const submitButton = page.locator('button[type="submit"]:has-text("Create Account")');
    await submitButton.click();
    
    // Wait for registration to complete
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    // Verify we're on dashboard
    await expect(page).toHaveURL(/.*\/dashboard$/);
    
    // Get user ID for cleanup
    const users = await db.select().from(user).where(eq(user.email, TEST_EMAIL));
    if (users.length > 0) {
      userId = users[0].id;
      console.log(`User registered successfully with ID: ${userId}`);
    }
    
    console.log('Registration flow completed successfully');
  });

  test('Authentication state persistence', async ({ page, context }) => {
    console.log('Testing authentication state persistence');
    
    // Register a user first
    await page.goto('http://localhost:3008/auth');
    await page.waitForLoadState('networkidle');
    
    // Wait for auth form to load
    await page.waitForSelector('form', { timeout: 10000 });
    
    // Switch to sign-up mode
    const createAccountButton = page.locator('text=Create account here');
    if (await createAccountButton.isVisible()) {
      await createAccountButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Fill and submit registration
    await page.fill('#name', 'Test User');
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);
    
    await page.click('button[type="submit"]:has-text("Create Account")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    // Get user ID for cleanup
    const users = await db.select().from(user).where(eq(user.email, TEST_EMAIL));
    if (users.length > 0) {
      userId = users[0].id;
    }
    
    // Now test navigation - authenticated users should be redirected to dashboard
    await page.goto('http://localhost:3008');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    
    // Verify redirect happened
    await expect(page).toHaveURL(/.*\/dashboard$/);
    
    console.log('Authentication state persistence verified');
  });

  test('Network request optimization check', async ({ page }) => {
    console.log('Testing for redundant network requests');
    
    const requests: any[] = [];
    
    // Monitor network requests
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType()
      });
    });
    
    // Load homepage
    await page.goto('http://localhost:3008');
    await page.waitForLoadState('networkidle');
    
    // Wait a bit more for any delayed requests
    await page.waitForTimeout(3000);
    
    // Analyze requests
    const authRequests = requests.filter(r => r.url.includes('/api/auth/'));
    const sessionRequests = authRequests.filter(r => r.url.includes('session') || r.url.includes('get-session'));
    const duplicateRequests = requests.filter((r, index, arr) => 
      arr.findIndex(req => req.url === r.url && req.method === r.method) !== index
    );
    
    console.log(`Total requests: ${requests.length}`);
    console.log(`Auth requests: ${authRequests.length}`);
    console.log(`Session requests: ${sessionRequests.length}`);
    console.log(`Duplicate requests: ${duplicateRequests.length}`);
    
    // Verify reasonable request counts
    expect(authRequests.length).toBeLessThan(10);
    expect(sessionRequests.length).toBeLessThan(5);
    expect(duplicateRequests.length).toBeLessThan(3);
    
    console.log('Network optimization check passed');
  });
});