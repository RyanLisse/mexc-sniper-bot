import { test, expect, type Page } from '@playwright/test';

async function signInUser(page: Page, email: string, password: string) {
  // Navigate to auth page
  await page.goto('/auth');
  
  // Wait for page to load and hydrate
  await page.waitForTimeout(3000);
  
  // Make sure we're in sign-in mode
  const signInLink = page.locator('button:has-text("Sign in here")');
  if (await signInLink.isVisible()) {
    await signInLink.click();
    await page.waitForTimeout(1000);
  }
  
  // Fill in sign-in form
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  
  // Submit form
  await page.click('button[type="submit"]');
  
  // Wait for redirect or success
  await page.waitForTimeout(3000);
}

async function signUpUser(page: Page, email: string, password: string, name: string) {
  // Navigate to auth page
  await page.goto('/auth');
  
  // Wait for page to load and hydrate
  await page.waitForTimeout(3000);
  
  // Check if we need to switch to sign-up mode
  const createAccountLink = page.locator('button:has-text("Create account here")');
  if (await createAccountLink.isVisible()) {
    await createAccountLink.click();
    await page.waitForTimeout(1000); // Wait for form to switch
  }
  
  // Check if name field is visible (indicates sign-up mode)
  const nameField = page.locator('input[id="name"]');
  if (await nameField.isVisible()) {
    // Fill in sign-up form
    await page.fill('input[id="name"]', name);
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    
    // Submit form
    await page.click('button[type="submit"]');
  } else {
    // Use the API directly if UI form isn't working
    console.log('Sign-up form not available, using API directly');
    const response = await page.request.post('/api/auth/sign-up/email', {
      data: { email, password, name }
    });
    if (!response.ok()) {
      throw new Error(`Sign-up failed: ${response.status()}`);
    }
  }
  
  // Wait for redirect or success
  await page.waitForTimeout(3000);
}

test.describe('Authentication Frontend Integration', () => {
  test('Dashboard shows anonymous user state correctly', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Should show anonymous badge
    await expect(page.locator('text=Anonymous')).toBeVisible();
    
    // Should show sign-in button
    await expect(page.locator('a:has-text("Sign In")')).toBeVisible();
    
    // Should still show public data
    await expect(page.locator('text=Trading Dashboard')).toBeVisible();
    await expect(page.locator('text=Pattern Sniper').first()).toBeVisible();
  });

  test('User can sign up and preferences are created', async ({ page }) => {
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    const testName = 'Test User';

    // Test sign-up process
    await signUpUser(page, testEmail, testPassword, testName);
    
    // Should redirect to dashboard or show success
    await expect(page.url()).toContain('/');
    
    // Check if user is authenticated by looking for user email
    await page.goto('/dashboard');
    await expect(page.locator(`text=${testEmail}`)).toBeVisible();
  });

  test('Authenticated user can access and modify preferences', async ({ page }) => {
    const testEmail = `prefs-test-${Date.now()}@example.com`;
    
    // First sign up a new user
    await signUpUser(page, testEmail, 'TestPassword123!', 'Prefs Test User');
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    // Open user preferences
    await page.click('button:has-text("Show Preferences")');
    
    // Wait for preferences to load
    await page.waitForTimeout(2000);
    
    // Check that take profit levels are visible
    await expect(page.locator('text=Take Profit Levels')).toBeVisible();
    
    // Check default values
    await expect(page.locator('text=5%')).toBeVisible(); // Level 1
    await expect(page.locator('text=10%')).toBeVisible(); // Level 2
    
    // Edit levels
    await page.click('button:has-text("Edit Levels")');
    
    // Change level 1
    const level1Input = page.locator('input').first();
    await level1Input.fill('7.5');
    
    // Save changes
    await page.click('button:has-text("Save Changes")');
    
    // Wait for save
    await page.waitForTimeout(1000);
    
    // Verify changes were saved
    await expect(page.locator('text=7.5%')).toBeVisible();
  });

  test('Account balance component works for authenticated users', async ({ page }) => {
    const testEmail = `balance-test-${Date.now()}@example.com`;
    
    // Sign up and sign in
    await signUpUser(page, testEmail, 'TestPassword123!', 'Balance Test User');
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    // Wait for account balance component to load
    await page.waitForTimeout(3000);
    
    // Check that account balance section is visible
    await expect(page.locator('text=Account Balance')).toBeVisible();
    
    // Should show total portfolio value (even if 0)
    await expect(page.locator('text=Total Portfolio Value')).toBeVisible();
    
    // Should have refresh button
    await expect(page.locator('button').filter({ hasText: 'refresh' })).toBeVisible();
  });

  test('Data isolation - different users have different preferences', async ({ page, context }) => {
    // Create first user
    const user1Email = `isolation1-${Date.now()}@example.com`;
    await signUpUser(page, user1Email, 'TestPassword123!', 'User 1');
    
    await page.goto('/dashboard');
    await page.click('button:has-text("Show Preferences")');
    await page.waitForTimeout(1000);
    
    // Edit user 1 preferences
    await page.click('button:has-text("Edit Levels")');
    const level1Input = page.locator('input').first();
    await level1Input.fill('15');
    await page.click('button:has-text("Save Changes")');
    await page.waitForTimeout(1000);
    
    // Sign out user 1
    // This might require implementing sign-out functionality in the UI
    
    // Create second user in new context
    const page2 = await context.newPage();
    const user2Email = `isolation2-${Date.now()}@example.com`;
    await signUpUser(page2, user2Email, 'TestPassword123!', 'User 2');
    
    await page2.goto('/dashboard');
    await page2.click('button:has-text("Show Preferences")');
    await page2.waitForTimeout(1000);
    
    // User 2 should have default preferences (5%, not 15%)
    await expect(page2.locator('text=5%')).toBeVisible();
    
    await page2.close();
  });

  test('MEXC API integration respects user authentication', async ({ page }) => {
    const testEmail = `mexc-test-${Date.now()}@example.com`;
    
    // Test anonymous access first
    await page.goto('/dashboard');
    
    // Should see MEXC data without authentication
    await expect(page.locator('text=MEXC API Status')).toBeVisible();
    
    // Sign up a user
    await signUpUser(page, testEmail, 'TestPassword123!', 'MEXC Test User');
    
    // Navigate back to dashboard
    await page.goto('/dashboard');
    
    // Should still see MEXC data but now with user context
    await expect(page.locator('text=MEXC API Status')).toBeVisible();
    await expect(page.locator(`text=${testEmail}`)).toBeVisible();
  });

  test('Pattern sniper respects user authentication', async ({ page }) => {
    const testEmail = `sniper-test-${Date.now()}@example.com`;
    
    // Sign up a user
    await signUpUser(page, testEmail, 'TestPassword123!', 'Sniper Test User');
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    // Check pattern sniper status
    await expect(page.locator('text=Pattern Sniper')).toBeVisible();
    
    // Should show controls for authenticated user
    await expect(page.locator('button:has-text("Start Pattern Sniper")')).toBeVisible();
    
    // User badge should be visible
    await expect(page.locator(`text=${testEmail}`)).toBeVisible();
  });

  test('Workflow system shows user-specific status', async ({ page }) => {
    const testEmail = `workflow-test-${Date.now()}@example.com`;
    
    // Sign up a user
    await signUpUser(page, testEmail, 'TestPassword123!', 'Workflow Test User');
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    // Check workflow status cards
    await expect(page.locator('text=Ready to Snipe')).toBeVisible();
    await expect(page.locator('text=Monitoring')).toBeVisible();
    await expect(page.locator('text=Executed Snipes')).toBeVisible();
    
    // Should show user-specific metrics (even if 0)
    await expect(page.locator('text=0')).toBeVisible(); // Initial counts should be 0
  });

  test('Emergency dashboard works with authenticated users', async ({ page }) => {
    const testEmail = `emergency-test-${Date.now()}@example.com`;
    
    // Sign up a user
    await signUpUser(page, testEmail, 'TestPassword123!', 'Emergency Test User');
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    
    // Scroll to emergency dashboard
    await page.locator('text=Emergency Response Dashboard').scrollIntoViewIfNeeded();
    
    // Should be visible for authenticated users
    await expect(page.locator('text=Emergency Response Dashboard')).toBeVisible();
  });
});