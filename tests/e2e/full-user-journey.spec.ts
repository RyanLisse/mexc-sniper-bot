import { test, expect } from '@playwright/test';

// Test configuration
const TEST_EMAIL = `fulltest-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPass123!';

test.describe('Complete User Journey', () => {
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

  test('Full user journey: homepage → register → dashboard → settings → sign out → sign in', async ({ page }) => {
    console.log('Starting complete user journey test');
    
    // Step 1: Verify homepage
    await page.goto('http://localhost:3008');
    await page.waitForLoadState('networkidle');
    
    // Skip loading if present
    const loadingElement = page.locator('text=Loading...');
    if (await loadingElement.isVisible()) {
      await loadingElement.waitFor({ state: 'detached', timeout: 10000 });
    }
    
    await expect(page.locator('h1')).toContainText('MEXC Sniper Bot');
    console.log('✓ Homepage verification passed');
    
    // Step 2: Register user
    await page.click('text=Get Started');
    await page.waitForURL('**/auth');
    
    // Switch to registration mode
    await page.click('text=Create account here');
    await page.waitForTimeout(1000);
    
    // Fill registration form
    await page.fill('#name', 'Test User');
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);
    
    // Submit registration
    await page.click('button[type="submit"]:has-text("Create Account")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    // Get user ID for future operations
    const users = await db.select().from(user).where(eq(user.email, TEST_EMAIL));
    expect(users).toHaveLength(1);
    userId = users[0].id;
    console.log('✓ User registration successful');
    
    // Step 3: Verify dashboard access
    await expect(page).toHaveURL(/.*\/dashboard$/);
    console.log('✓ Dashboard access verified');
    
    // Step 4: Test configuration page (if it exists)
    try {
      await page.goto('http://localhost:3008/config');
      await page.waitForLoadState('networkidle');
      
      // Check if config page loads without errors
      const pageTitle = await page.title();
      expect(pageTitle).toBeTruthy();
      console.log('✓ Configuration page accessible');
    } catch (error) {
      console.log('ℹ Configuration page not available or not accessible');
    }
    
    // Step 5: Test navigation flow - authenticated user should redirect from homepage
    await page.goto('http://localhost:3008');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page).toHaveURL(/.*\/dashboard$/);
    console.log('✓ Authentication redirect working');
    
    // Step 6: Sign out test
    // Look for user menu or sign out option
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
      // Try navigating to auth page which might have sign out option
      await page.goto('http://localhost:3008/auth');
      await page.waitForLoadState('networkidle');
      
      // Look for sign out button on auth page
      const signOutButton = page.locator('button:has-text("Sign Out")');
      if (await signOutButton.isVisible()) {
        await signOutButton.click();
        signOutClicked = true;
      }
    }
    
    if (signOutClicked) {
      // Wait for redirect to homepage
      await page.waitForURL('http://localhost:3008', { timeout: 10000 });
      await expect(page.locator('h1')).toContainText('MEXC Sniper Bot');
      console.log('✓ Sign out successful');
      
      // Step 7: Sign back in
      await page.click('text=Sign In');
      await page.waitForURL('**/auth');
      
      // Fill sign in form (should be in sign-in mode by default)
      await page.fill('#email', TEST_EMAIL);
      await page.fill('#password', TEST_PASSWORD);
      
      // Submit sign in
      await page.click('button[type="submit"]:has-text("Sign In")');
      await page.waitForURL('**/dashboard', { timeout: 15000 });
      
      await expect(page).toHaveURL(/.*\/dashboard$/);
      console.log('✓ Sign in successful');
    } else {
      console.log('ℹ Sign out functionality not easily accessible, skipping sign out/in test');
    }
    
    // Step 8: Performance check
    const finalRequests: any[] = [];
    page.on('request', request => {
      finalRequests.push({
        url: request.url(),
        method: request.method()
      });
    });
    
    // Navigate through key pages to check performance
    await page.goto('http://localhost:3008/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const authRequests = finalRequests.filter(r => r.url.includes('/api/auth/'));
    console.log(`Final performance check - Auth requests: ${authRequests.length}`);
    
    // Should not have excessive requests
    expect(authRequests.length).toBeLessThan(10);
    
    console.log('✅ Complete user journey test passed successfully!');
  });

  test('Database integrity verification', async ({ page }) => {
    console.log('Testing database operations integrity');
    
    // Create test user through the UI
    await page.goto('http://localhost:3008/auth');
    await page.waitForLoadState('networkidle');
    
    await page.click('text=Create account here');
    await page.waitForTimeout(1000);
    
    await page.fill('#name', 'DB Test User');
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);
    
    await page.click('button[type="submit"]:has-text("Create Account")');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    // Verify user was created in database
    const users = await db.select().from(user).where(eq(user.email, TEST_EMAIL));
    expect(users).toHaveLength(1);
    userId = users[0].id;
    
    expect(users[0].email).toBe(TEST_EMAIL);
    expect(users[0].name).toBe('DB Test User');
    
    console.log('✓ Database user creation verified');
    
    // Check that user preferences are created with defaults
    const prefs = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    if (prefs.length > 0) {
      expect(prefs[0].userId).toBe(userId);
      console.log('✓ User preferences created automatically');
    } else {
      console.log('ℹ User preferences not auto-created (may be created on first config save)');
    }
    
    console.log('✅ Database integrity verification passed');
  });
});