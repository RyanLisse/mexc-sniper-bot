# Test info

- Name: Complete User Journey >> Full user journey: homepage → register → dashboard → settings → sign out → sign in
- Location: /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/full-user-journey.spec.ts:27:7

# Error details

```
TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
=========================== logs ===========================
waiting for navigation to "**/dashboard" until "load"
============================================================
    at /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/full-user-journey.spec.ts:58:16
```

# Page snapshot

```yaml
- heading "MEXC Sniper Bot" [level=1]
- paragraph: AI-powered cryptocurrency trading platform
- text: Create Account Create your account to start trading with AI-powered strategies Full Name
- textbox "Full Name": Test User
- text: Email Address
- textbox "Email Address": fulltest-1749592368249@example.com
- text: Password
- textbox "Password": TestPass123!
- button
- paragraph: Rate limit exceeded. Please try again later.
- button "Create Account"
- paragraph: Already have an account?
- button "Sign in here"
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
   7 | const TEST_EMAIL = `fulltest-${Date.now()}@example.com`;
   8 | const TEST_PASSWORD = 'TestPass123!';
   9 |
   10 | test.describe('Complete User Journey', () => {
   11 |   let userId: string;
   12 |   
   13 |   test.afterEach(async () => {
   14 |     // Clean up test data
   15 |     if (userId) {
   16 |       try {
   17 |         await db.delete(userPreferences).where(eq(userPreferences.userId, userId));
   18 |         await db.delete(apiCredentials).where(eq(apiCredentials.userId, userId));
   19 |         await db.delete(user).where(eq(user.id, userId));
   20 |         console.log(`Cleaned up test user: ${userId}`);
   21 |       } catch (error) {
   22 |         console.warn('Cleanup error:', error);
   23 |       }
   24 |     }
   25 |   });
   26 |
   27 |   test('Full user journey: homepage → register → dashboard → settings → sign out → sign in', async ({ page }) => {
   28 |     console.log('Starting complete user journey test');
   29 |     
   30 |     // Step 1: Verify homepage
   31 |     await page.goto('http://localhost:3008');
   32 |     await page.waitForLoadState('networkidle');
   33 |     
   34 |     // Skip loading if present
   35 |     const loadingElement = page.locator('text=Loading...');
   36 |     if (await loadingElement.isVisible()) {
   37 |       await loadingElement.waitFor({ state: 'detached', timeout: 10000 });
   38 |     }
   39 |     
   40 |     await expect(page.locator('h1')).toContainText('MEXC Sniper Bot');
   41 |     console.log('✓ Homepage verification passed');
   42 |     
   43 |     // Step 2: Register user
   44 |     await page.click('text=Get Started');
   45 |     await page.waitForURL('**/auth');
   46 |     
   47 |     // Switch to registration mode
   48 |     await page.click('text=Create account here');
   49 |     await page.waitForTimeout(1000);
   50 |     
   51 |     // Fill registration form
   52 |     await page.fill('#name', 'Test User');
   53 |     await page.fill('#email', TEST_EMAIL);
   54 |     await page.fill('#password', TEST_PASSWORD);
   55 |     
   56 |     // Submit registration
   57 |     await page.click('button[type="submit"]:has-text("Create Account")');
>  58 |     await page.waitForURL('**/dashboard', { timeout: 15000 });
      |                ^ TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
   59 |     
   60 |     // Get user ID for future operations
   61 |     const users = await db.select().from(user).where(eq(user.email, TEST_EMAIL));
   62 |     expect(users).toHaveLength(1);
   63 |     userId = users[0].id;
   64 |     console.log('✓ User registration successful');
   65 |     
   66 |     // Step 3: Verify dashboard access
   67 |     await expect(page).toHaveURL(/.*\/dashboard$/);
   68 |     console.log('✓ Dashboard access verified');
   69 |     
   70 |     // Step 4: Test configuration page (if it exists)
   71 |     try {
   72 |       await page.goto('http://localhost:3008/config');
   73 |       await page.waitForLoadState('networkidle');
   74 |       
   75 |       // Check if config page loads without errors
   76 |       const pageTitle = await page.title();
   77 |       expect(pageTitle).toBeTruthy();
   78 |       console.log('✓ Configuration page accessible');
   79 |     } catch (error) {
   80 |       console.log('ℹ Configuration page not available or not accessible');
   81 |     }
   82 |     
   83 |     // Step 5: Test navigation flow - authenticated user should redirect from homepage
   84 |     await page.goto('http://localhost:3008');
   85 |     await page.waitForURL('**/dashboard', { timeout: 10000 });
   86 |     await expect(page).toHaveURL(/.*\/dashboard$/);
   87 |     console.log('✓ Authentication redirect working');
   88 |     
   89 |     // Step 6: Sign out test
   90 |     // Look for user menu or sign out option
   91 |     const userMenuSelectors = [
   92 |       '[data-testid="user-menu"]',
   93 |       'button:has-text("Sign Out")',
   94 |       'text=Sign Out',
   95 |       '[aria-label="User menu"]',
   96 |       '.user-menu'
   97 |     ];
   98 |     
   99 |     let signOutClicked = false;
  100 |     for (const selector of userMenuSelectors) {
  101 |       try {
  102 |         const element = page.locator(selector);
  103 |         if (await element.isVisible({ timeout: 2000 })) {
  104 |           await element.click();
  105 |           signOutClicked = true;
  106 |           break;
  107 |         }
  108 |       } catch (error) {
  109 |         // Continue to next selector
  110 |       }
  111 |     }
  112 |     
  113 |     if (!signOutClicked) {
  114 |       // Try navigating to auth page which might have sign out option
  115 |       await page.goto('http://localhost:3008/auth');
  116 |       await page.waitForLoadState('networkidle');
  117 |       
  118 |       // Look for sign out button on auth page
  119 |       const signOutButton = page.locator('button:has-text("Sign Out")');
  120 |       if (await signOutButton.isVisible()) {
  121 |         await signOutButton.click();
  122 |         signOutClicked = true;
  123 |       }
  124 |     }
  125 |     
  126 |     if (signOutClicked) {
  127 |       // Wait for redirect to homepage
  128 |       await page.waitForURL('http://localhost:3008', { timeout: 10000 });
  129 |       await expect(page.locator('h1')).toContainText('MEXC Sniper Bot');
  130 |       console.log('✓ Sign out successful');
  131 |       
  132 |       // Step 7: Sign back in
  133 |       await page.click('text=Sign In');
  134 |       await page.waitForURL('**/auth');
  135 |       
  136 |       // Fill sign in form (should be in sign-in mode by default)
  137 |       await page.fill('#email', TEST_EMAIL);
  138 |       await page.fill('#password', TEST_PASSWORD);
  139 |       
  140 |       // Submit sign in
  141 |       await page.click('button[type="submit"]:has-text("Sign In")');
  142 |       await page.waitForURL('**/dashboard', { timeout: 15000 });
  143 |       
  144 |       await expect(page).toHaveURL(/.*\/dashboard$/);
  145 |       console.log('✓ Sign in successful');
  146 |     } else {
  147 |       console.log('ℹ Sign out functionality not easily accessible, skipping sign out/in test');
  148 |     }
  149 |     
  150 |     // Step 8: Performance check
  151 |     const finalRequests: any[] = [];
  152 |     page.on('request', request => {
  153 |       finalRequests.push({
  154 |         url: request.url(),
  155 |         method: request.method()
  156 |       });
  157 |     });
  158 |     
```