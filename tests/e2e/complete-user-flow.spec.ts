import { test, expect } from '@playwright/test';
import { db } from '@/src/db';
import { user, userPreferences, apiCredentials } from '@/src/db/schema';
import { eq } from 'drizzle-orm';

// Test configuration
const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPass123!';
const TEST_USERNAME = `testuser${Date.now()}`;
const TEST_API_KEY = 'test_api_key_12345';
const TEST_SECRET_KEY = 'test_secret_key_67890';

test.describe('Complete User Flow Test', () => {
  let userId: string;
  
  test.beforeEach(async ({ page }) => {
    // Start with a clean slate - navigate to homepage
    await page.goto('http://localhost:3008');
  });

  test.afterEach(async () => {
    // Clean up test data from database
    if (userId) {
      try {
        // Delete user preferences
        await db.delete(userPreferences).where(eq(userPreferences.userId, userId));
        
        // Delete API credentials
        await db.delete(apiCredentials).where(eq(apiCredentials.userId, userId));
        
        // Delete user (this should cascade to sessions and accounts)
        await db.delete(user).where(eq(user.id, userId));
        
        console.log(`Cleaned up test user: ${userId}`);
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
    }
  });

  test('Complete user journey: registration → settings → API keys → sign out → sign in', async ({ page }) => {
    // Step 1: Verify homepage shows for unauthenticated users
    console.log('Step 1: Testing homepage for unauthenticated users');
    await expect(page.locator('h1')).toContainText('MEXC Sniper Bot');
    await expect(page.locator('text=Get Started')).toBeVisible();
    await expect(page.locator('text=Sign In')).toBeVisible();

    // Step 2: Navigate to authentication page
    console.log('Step 2: Navigating to authentication');
    await page.click('text=Get Started');
    await expect(page).toHaveURL('http://localhost:3008/auth');

    // Step 3: User Registration
    console.log('Step 3: User registration');
    
    // Fill registration form
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="username"]', TEST_USERNAME);
    
    // Submit registration
    await page.click('button[type="submit"]:has-text("Sign Up")');
    
    // Wait for successful registration and redirect to dashboard
    await page.waitForURL('http://localhost:3008/dashboard', { timeout: 10000 });
    
    // Verify we're logged in and on dashboard
    await expect(page.locator('text=Dashboard')).toBeVisible();
    
    // Get user ID from database for cleanup
    const users = await db.select().from(user).where(eq(user.email, TEST_EMAIL));
    expect(users).toHaveLength(1);
    userId = users[0].id;
    console.log(`Created user with ID: ${userId}`);

    // Step 4: Test user preferences
    console.log('Step 4: Testing user preferences');
    
    // Navigate to configuration page
    await page.goto('http://localhost:3008/config');
    await expect(page).toHaveURL('http://localhost:3008/config');
    
    // Update user preferences
    await page.fill('input[name="defaultBuyAmountUsdt"]', '250');
    await page.selectOption('select[name="riskTolerance"]', 'high');
    await page.fill('input[name="takeProfitLevel2"]', '12');
    await page.fill('input[name="stopLossPercent"]', '8');
    
    // Save preferences
    await page.click('button:has-text("Save Preferences")');
    
    // Wait for success message
    await expect(page.locator('text=Preferences saved successfully')).toBeVisible({ timeout: 5000 });
    
    // Verify preferences were saved to database
    const savedPrefs = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    expect(savedPrefs).toHaveLength(1);
    expect(savedPrefs[0].defaultBuyAmountUsdt).toBe(250);
    expect(savedPrefs[0].riskTolerance).toBe('high');
    expect(savedPrefs[0].takeProfitLevel2).toBe(12);
    expect(savedPrefs[0].stopLossPercent).toBe(8);
    console.log('User preferences saved and verified in database');

    // Step 5: Test API credentials
    console.log('Step 5: Testing API credentials');
    
    // Fill API credentials form
    await page.fill('input[name="apiKey"]', TEST_API_KEY);
    await page.fill('input[name="secretKey"]', TEST_SECRET_KEY);
    
    // Save API credentials
    await page.click('button:has-text("Save API Keys")');
    
    // Wait for success message
    await expect(page.locator('text=API credentials saved successfully')).toBeVisible({ timeout: 5000 });
    
    // Verify API credentials were saved to database (encrypted)
    const savedCreds = await db.select().from(apiCredentials).where(eq(apiCredentials.userId, userId));
    expect(savedCreds).toHaveLength(1);
    expect(savedCreds[0].provider).toBe('mexc');
    expect(savedCreds[0].encryptedApiKey).toBeTruthy();
    expect(savedCreds[0].encryptedSecretKey).toBeTruthy();
    // Should not store plain text
    expect(savedCreds[0].encryptedApiKey).not.toBe(TEST_API_KEY);
    expect(savedCreds[0].encryptedSecretKey).not.toBe(TEST_SECRET_KEY);
    console.log('API credentials saved and verified in database (encrypted)');

    // Step 6: Sign out
    console.log('Step 6: Testing sign out');
    
    // Find and click user menu or sign out button
    await page.click('[data-testid="user-menu"]', { timeout: 5000 });
    await page.click('text=Sign Out');
    
    // Should redirect to homepage after sign out
    await page.waitForURL('http://localhost:3008', { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('MEXC Sniper Bot');
    await expect(page.locator('text=Get Started')).toBeVisible();
    console.log('Sign out successful, redirected to homepage');

    // Step 7: Sign back in
    console.log('Step 7: Testing sign in');
    
    // Navigate to auth page
    await page.click('text=Sign In');
    await expect(page).toHaveURL('http://localhost:3008/auth');
    
    // Switch to sign in tab if needed
    const signInTab = page.locator('text=Sign In').first();
    if (await signInTab.isVisible()) {
      await signInTab.click();
    }
    
    // Fill sign in form
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    
    // Submit sign in
    await page.click('button[type="submit"]:has-text("Sign In")');
    
    // Should redirect to dashboard
    await page.waitForURL('http://localhost:3008/dashboard', { timeout: 10000 });
    await expect(page.locator('text=Dashboard')).toBeVisible();
    console.log('Sign in successful, redirected to dashboard');

    // Step 8: Verify data persistence after sign in
    console.log('Step 8: Verifying data persistence');
    
    // Go back to config page
    await page.goto('http://localhost:3008/config');
    
    // Verify preferences are still there
    await expect(page.locator('input[name="defaultBuyAmountUsdt"]')).toHaveValue('250');
    await expect(page.locator('select[name="riskTolerance"]')).toHaveValue('high');
    await expect(page.locator('input[name="takeProfitLevel2"]')).toHaveValue('12');
    await expect(page.locator('input[name="stopLossPercent"]')).toHaveValue('8');
    
    // Verify API keys are masked but present (for security)
    const apiKeyInput = page.locator('input[name="apiKey"]');
    const apiKeyValue = await apiKeyInput.inputValue();
    expect(apiKeyValue).toBeTruthy();
    // Should be masked or show that keys are saved
    console.log('Data persistence verified - preferences and API keys maintained');

    // Step 9: Test navigation flow
    console.log('Step 9: Testing navigation flow');
    
    // Test dashboard navigation
    await page.goto('http://localhost:3008/dashboard');
    await expect(page.locator('text=Dashboard')).toBeVisible();
    
    // Test direct homepage access (should redirect to dashboard when logged in)
    await page.goto('http://localhost:3008');
    await page.waitForURL('http://localhost:3008/dashboard', { timeout: 5000 });
    console.log('Navigation flow verified - authenticated users redirected to dashboard');

    // Step 10: Performance and redundancy check
    console.log('Step 10: Performance check');
    
    // Check for excessive network requests
    const responses: any[] = [];
    page.on('response', response => {
      responses.push({
        url: response.url(),
        status: response.status(),
        method: response.request().method()
      });
    });
    
    // Navigate through key pages
    await page.goto('http://localhost:3008/dashboard');
    await page.goto('http://localhost:3008/config');
    
    // Wait a bit for any async requests
    await page.waitForTimeout(2000);
    
    // Check for redundant requests
    const authRequests = responses.filter(r => r.url.includes('/api/auth/'));
    const sessionRequests = authRequests.filter(r => r.url.includes('session'));
    
    console.log(`Total auth requests: ${authRequests.length}`);
    console.log(`Session requests: ${sessionRequests.length}`);
    
    // Should not have excessive session requests
    expect(sessionRequests.length).toBeLessThan(10);
    
    // Check for failed requests
    const failedRequests = responses.filter(r => r.status >= 400);
    console.log('Failed requests:', failedRequests);
    
    // Should have minimal failed requests
    expect(failedRequests.length).toBeLessThan(3);
    
    console.log('Complete user flow test passed successfully!');
  });

  test('Database integrity and cleanup verification', async ({ page }) => {
    console.log('Testing database operations and cleanup');
    
    // Create a test user directly in database
    const testUser = {
      id: `test-${Date.now()}`,
      email: `cleanup-test-${Date.now()}@example.com`,
      name: 'Cleanup Test User',
      emailVerified: false,
    };
    
    const [createdUser] = await db.insert(user).values(testUser).returning();
    userId = createdUser.id;
    
    // Create associated data
    await db.insert(userPreferences).values({
      userId: userId,
      defaultBuyAmountUsdt: 100,
      riskTolerance: 'medium',
    });
    
    await db.insert(apiCredentials).values({
      userId: userId,
      provider: 'mexc',
      encryptedApiKey: 'encrypted_test_key',
      encryptedSecretKey: 'encrypted_test_secret',
    });
    
    // Verify data exists
    const userCount = await db.select().from(user).where(eq(user.id, userId));
    const prefsCount = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
    const credsCount = await db.select().from(apiCredentials).where(eq(apiCredentials.userId, userId));
    
    expect(userCount).toHaveLength(1);
    expect(prefsCount).toHaveLength(1);
    expect(credsCount).toHaveLength(1);
    
    console.log('Database operations verified successfully');
  });
});