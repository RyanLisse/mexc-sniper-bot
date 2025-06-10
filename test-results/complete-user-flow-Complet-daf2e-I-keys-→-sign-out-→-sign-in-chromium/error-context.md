# Test info

- Name: Complete User Flow Test >> Complete user journey: registration → settings → API keys → sign out → sign in
- Location: /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/complete-user-flow.spec.ts:41:7

# Error details

```
TimeoutError: page.fill: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('input[name="email"]')

    at /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/complete-user-flow.spec.ts:57:16
```

# Page snapshot

```yaml
- heading "MEXC Sniper Bot" [level=1]
- paragraph: AI-powered cryptocurrency trading platform
- text: Sign In Sign in to access your trading dashboard Email Address
- textbox "Email Address"
- text: Password
- textbox "Password"
- button
- button "Sign In"
- paragraph: Don't have an account?
- button "Create account here"
- link "← Back to dashboard":
  - /url: /dashboard
- paragraph: Your data is encrypted and stored securely
- link "← Back to Dashboard":
  - /url: /
- button "Open Tanstack query devtools":
  - img
- alert
- button "Open Next.js Dev Tools":
  - img
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 | import { db } from '@/src/db';
   3 | import { user, userPreferences, apiCredentials } from '@/src/db/schema';
   4 | import { eq } from 'drizzle-orm';
   5 |
   6 | // Test configuration
   7 | const TEST_EMAIL = `test-${Date.now()}@example.com`;
   8 | const TEST_PASSWORD = 'TestPass123!';
   9 | const TEST_USERNAME = `testuser${Date.now()}`;
   10 | const TEST_API_KEY = 'test_api_key_12345';
   11 | const TEST_SECRET_KEY = 'test_secret_key_67890';
   12 |
   13 | test.describe('Complete User Flow Test', () => {
   14 |   let userId: string;
   15 |   
   16 |   test.beforeEach(async ({ page }) => {
   17 |     // Start with a clean slate - navigate to homepage
   18 |     await page.goto('http://localhost:3008');
   19 |   });
   20 |
   21 |   test.afterEach(async () => {
   22 |     // Clean up test data from database
   23 |     if (userId) {
   24 |       try {
   25 |         // Delete user preferences
   26 |         await db.delete(userPreferences).where(eq(userPreferences.userId, userId));
   27 |         
   28 |         // Delete API credentials
   29 |         await db.delete(apiCredentials).where(eq(apiCredentials.userId, userId));
   30 |         
   31 |         // Delete user (this should cascade to sessions and accounts)
   32 |         await db.delete(user).where(eq(user.id, userId));
   33 |         
   34 |         console.log(`Cleaned up test user: ${userId}`);
   35 |       } catch (error) {
   36 |         console.warn('Cleanup error:', error);
   37 |       }
   38 |     }
   39 |   });
   40 |
   41 |   test('Complete user journey: registration → settings → API keys → sign out → sign in', async ({ page }) => {
   42 |     // Step 1: Verify homepage shows for unauthenticated users
   43 |     console.log('Step 1: Testing homepage for unauthenticated users');
   44 |     await expect(page.locator('h1')).toContainText('MEXC Sniper Bot');
   45 |     await expect(page.locator('text=Get Started')).toBeVisible();
   46 |     await expect(page.locator('text=Sign In')).toBeVisible();
   47 |
   48 |     // Step 2: Navigate to authentication page
   49 |     console.log('Step 2: Navigating to authentication');
   50 |     await page.click('text=Get Started');
   51 |     await expect(page).toHaveURL('http://localhost:3008/auth');
   52 |
   53 |     // Step 3: User Registration
   54 |     console.log('Step 3: User registration');
   55 |     
   56 |     // Fill registration form
>  57 |     await page.fill('input[name="email"]', TEST_EMAIL);
      |                ^ TimeoutError: page.fill: Timeout 10000ms exceeded.
   58 |     await page.fill('input[name="password"]', TEST_PASSWORD);
   59 |     await page.fill('input[name="name"]', 'Test User');
   60 |     await page.fill('input[name="username"]', TEST_USERNAME);
   61 |     
   62 |     // Submit registration
   63 |     await page.click('button[type="submit"]:has-text("Sign Up")');
   64 |     
   65 |     // Wait for successful registration and redirect to dashboard
   66 |     await page.waitForURL('http://localhost:3008/dashboard', { timeout: 10000 });
   67 |     
   68 |     // Verify we're logged in and on dashboard
   69 |     await expect(page.locator('text=Dashboard')).toBeVisible();
   70 |     
   71 |     // Get user ID from database for cleanup
   72 |     const users = await db.select().from(user).where(eq(user.email, TEST_EMAIL));
   73 |     expect(users).toHaveLength(1);
   74 |     userId = users[0].id;
   75 |     console.log(`Created user with ID: ${userId}`);
   76 |
   77 |     // Step 4: Test user preferences
   78 |     console.log('Step 4: Testing user preferences');
   79 |     
   80 |     // Navigate to configuration page
   81 |     await page.goto('http://localhost:3008/config');
   82 |     await expect(page).toHaveURL('http://localhost:3008/config');
   83 |     
   84 |     // Update user preferences
   85 |     await page.fill('input[name="defaultBuyAmountUsdt"]', '250');
   86 |     await page.selectOption('select[name="riskTolerance"]', 'high');
   87 |     await page.fill('input[name="takeProfitLevel2"]', '12');
   88 |     await page.fill('input[name="stopLossPercent"]', '8');
   89 |     
   90 |     // Save preferences
   91 |     await page.click('button:has-text("Save Preferences")');
   92 |     
   93 |     // Wait for success message
   94 |     await expect(page.locator('text=Preferences saved successfully')).toBeVisible({ timeout: 5000 });
   95 |     
   96 |     // Verify preferences were saved to database
   97 |     const savedPrefs = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
   98 |     expect(savedPrefs).toHaveLength(1);
   99 |     expect(savedPrefs[0].defaultBuyAmountUsdt).toBe(250);
  100 |     expect(savedPrefs[0].riskTolerance).toBe('high');
  101 |     expect(savedPrefs[0].takeProfitLevel2).toBe(12);
  102 |     expect(savedPrefs[0].stopLossPercent).toBe(8);
  103 |     console.log('User preferences saved and verified in database');
  104 |
  105 |     // Step 5: Test API credentials
  106 |     console.log('Step 5: Testing API credentials');
  107 |     
  108 |     // Fill API credentials form
  109 |     await page.fill('input[name="apiKey"]', TEST_API_KEY);
  110 |     await page.fill('input[name="secretKey"]', TEST_SECRET_KEY);
  111 |     
  112 |     // Save API credentials
  113 |     await page.click('button:has-text("Save API Keys")');
  114 |     
  115 |     // Wait for success message
  116 |     await expect(page.locator('text=API credentials saved successfully')).toBeVisible({ timeout: 5000 });
  117 |     
  118 |     // Verify API credentials were saved to database (encrypted)
  119 |     const savedCreds = await db.select().from(apiCredentials).where(eq(apiCredentials.userId, userId));
  120 |     expect(savedCreds).toHaveLength(1);
  121 |     expect(savedCreds[0].provider).toBe('mexc');
  122 |     expect(savedCreds[0].encryptedApiKey).toBeTruthy();
  123 |     expect(savedCreds[0].encryptedSecretKey).toBeTruthy();
  124 |     // Should not store plain text
  125 |     expect(savedCreds[0].encryptedApiKey).not.toBe(TEST_API_KEY);
  126 |     expect(savedCreds[0].encryptedSecretKey).not.toBe(TEST_SECRET_KEY);
  127 |     console.log('API credentials saved and verified in database (encrypted)');
  128 |
  129 |     // Step 6: Sign out
  130 |     console.log('Step 6: Testing sign out');
  131 |     
  132 |     // Find and click user menu or sign out button
  133 |     await page.click('[data-testid="user-menu"]', { timeout: 5000 });
  134 |     await page.click('text=Sign Out');
  135 |     
  136 |     // Should redirect to homepage after sign out
  137 |     await page.waitForURL('http://localhost:3008', { timeout: 10000 });
  138 |     await expect(page.locator('h1')).toContainText('MEXC Sniper Bot');
  139 |     await expect(page.locator('text=Get Started')).toBeVisible();
  140 |     console.log('Sign out successful, redirected to homepage');
  141 |
  142 |     // Step 7: Sign back in
  143 |     console.log('Step 7: Testing sign in');
  144 |     
  145 |     // Navigate to auth page
  146 |     await page.click('text=Sign In');
  147 |     await expect(page).toHaveURL('http://localhost:3008/auth');
  148 |     
  149 |     // Switch to sign in tab if needed
  150 |     const signInTab = page.locator('text=Sign In').first();
  151 |     if (await signInTab.isVisible()) {
  152 |       await signInTab.click();
  153 |     }
  154 |     
  155 |     // Fill sign in form
  156 |     await page.fill('input[name="email"]', TEST_EMAIL);
  157 |     await page.fill('input[name="password"]', TEST_PASSWORD);
```