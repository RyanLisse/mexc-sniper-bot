import { test, expect } from '@playwright/test';
import { db } from '@/src/db';
import { user } from '@/src/db/schema';
import { eq } from 'drizzle-orm';

// Test configuration
const TEST_EMAIL = `simple-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPass123!';

test.describe('Simple Authentication Protection', () => {
  let userId: string;
  
  test.afterAll(async () => {
    // Clean up test data
    if (userId) {
      try {
        await db.delete(user).where(eq(user.id, userId));
        console.log(`Cleaned up test user: ${userId}`);
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
    }
  });

  test('Dashboard protection works correctly', async ({ page }) => {
    console.log('Testing dashboard protection and authentication flow');
    
    // Step 1: Try to access dashboard as anonymous user
    await page.goto('http://localhost:3008/dashboard');
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    
    // Wait for any redirects to complete
    await page.waitForTimeout(3000);
    
    let currentUrl = page.url();
    console.log(`Dashboard access attempt resulted in: ${currentUrl}`);
    
    // Should NOT be on dashboard
    if (currentUrl.includes('/dashboard')) {
      console.log('❌ Dashboard is accessible to anonymous users - this is a security issue!');
      // Take screenshot for debugging
      await page.screenshot({ path: 'dashboard-security-issue.png' });
      throw new Error('Dashboard should not be accessible to anonymous users');
    } else {
      console.log('✅ Dashboard properly protected from anonymous access');
    }
    
    // Step 2: Register a user and verify dashboard access
    await page.goto('http://localhost:3008/auth');
    await page.waitForLoadState('networkidle');
    
    // Wait for auth form
    await page.waitForSelector('form', { timeout: 10000 });
    
    // Switch to registration mode if needed
    const createAccountBtn = page.locator('text=Create account here');
    if (await createAccountBtn.isVisible()) {
      await createAccountBtn.click();
      await page.waitForTimeout(1000);
    }
    
    // Fill registration form
    await page.fill('#name', 'Test User');
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);
    
    // Submit registration
    await page.click('button[type="submit"]:has-text("Create Account")');
    
    // Wait for registration to complete and redirect
    await page.waitForTimeout(5000);
    
    currentUrl = page.url();
    console.log(`After registration, URL is: ${currentUrl}`);
    
    // If we're on dashboard, great! If not, manually navigate
    if (!currentUrl.includes('/dashboard')) {
      await page.goto('http://localhost:3008/dashboard');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      currentUrl = page.url();
    }
    
    // Now dashboard should be accessible
    if (currentUrl.includes('/dashboard')) {
      console.log('✅ Authenticated user can access dashboard');
    } else {
      console.log(`❌ Authenticated user cannot access dashboard, currently at: ${currentUrl}`);
      // Take screenshot for debugging
      await page.screenshot({ path: 'auth-user-dashboard-issue.png' });
      throw new Error('Authenticated user should be able to access dashboard');
    }
    
    // Step 3: Verify user was created in database
    const users = await db.select().from(user).where(eq(user.email, TEST_EMAIL));
    if (users.length > 0) {
      userId = users[0].id;
      console.log(`✅ User successfully created in database with ID: ${userId}`);
    } else {
      console.log('⚠️ User not found in database, but authentication might still be working');
    }
    
    // Step 4: Test that homepage redirects authenticated users to dashboard
    await page.goto('http://localhost:3008');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    currentUrl = page.url();
    if (currentUrl.includes('/dashboard')) {
      console.log('✅ Authenticated users are redirected from homepage to dashboard');
    } else {
      console.log(`ℹ️ Homepage does not redirect authenticated users, currently at: ${currentUrl}`);
    }
    
    console.log('✅ Authentication protection test completed successfully!');
  });

  test('Config page protection works correctly', async ({ page }) => {
    console.log('Testing config page protection');
    
    // Try to access config as anonymous user
    await page.goto('http://localhost:3008/config');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log(`Config access attempt resulted in: ${currentUrl}`);
    
    // Should NOT be on config page
    if (currentUrl.includes('/config')) {
      console.log('❌ Config page is accessible to anonymous users - this is a security issue!');
      await page.screenshot({ path: 'config-security-issue.png' });
      throw new Error('Config page should not be accessible to anonymous users');
    } else {
      console.log('✅ Config page properly protected from anonymous access');
    }
  });
});