# Test info

- Name: Simple Authentication Protection >> Dashboard protection works correctly
- Location: /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/simple-auth-protection.spec.ts:25:7

# Error details

```
TimeoutError: page.screenshot: Timeout 10000ms exceeded.
Call log:
  - taking page screenshot
  - waiting for fonts to load...
  - fonts loaded

    at /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/simple-auth-protection.spec.ts:42:18
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 | import { db } from '@/src/db';
   3 | import { user } from '@/src/db/schema';
   4 | import { eq } from 'drizzle-orm';
   5 |
   6 | // Test configuration
   7 | const TEST_EMAIL = `simple-${Date.now()}@example.com`;
   8 | const TEST_PASSWORD = 'TestPass123!';
   9 |
   10 | test.describe('Simple Authentication Protection', () => {
   11 |   let userId: string;
   12 |   
   13 |   test.afterAll(async () => {
   14 |     // Clean up test data
   15 |     if (userId) {
   16 |       try {
   17 |         await db.delete(user).where(eq(user.id, userId));
   18 |         console.log(`Cleaned up test user: ${userId}`);
   19 |       } catch (error) {
   20 |         console.warn('Cleanup error:', error);
   21 |       }
   22 |     }
   23 |   });
   24 |
   25 |   test('Dashboard protection works correctly', async ({ page }) => {
   26 |     console.log('Testing dashboard protection and authentication flow');
   27 |     
   28 |     // Step 1: Try to access dashboard as anonymous user
   29 |     await page.goto('http://localhost:3008/dashboard');
   30 |     await page.waitForLoadState('networkidle', { timeout: 30000 });
   31 |     
   32 |     // Wait for any redirects to complete
   33 |     await page.waitForTimeout(3000);
   34 |     
   35 |     let currentUrl = page.url();
   36 |     console.log(`Dashboard access attempt resulted in: ${currentUrl}`);
   37 |     
   38 |     // Should NOT be on dashboard
   39 |     if (currentUrl.includes('/dashboard')) {
   40 |       console.log('❌ Dashboard is accessible to anonymous users - this is a security issue!');
   41 |       // Take screenshot for debugging
>  42 |       await page.screenshot({ path: 'dashboard-security-issue.png' });
      |                  ^ TimeoutError: page.screenshot: Timeout 10000ms exceeded.
   43 |       throw new Error('Dashboard should not be accessible to anonymous users');
   44 |     } else {
   45 |       console.log('✅ Dashboard properly protected from anonymous access');
   46 |     }
   47 |     
   48 |     // Step 2: Register a user and verify dashboard access
   49 |     await page.goto('http://localhost:3008/auth');
   50 |     await page.waitForLoadState('networkidle');
   51 |     
   52 |     // Wait for auth form
   53 |     await page.waitForSelector('form', { timeout: 10000 });
   54 |     
   55 |     // Switch to registration mode if needed
   56 |     const createAccountBtn = page.locator('text=Create account here');
   57 |     if (await createAccountBtn.isVisible()) {
   58 |       await createAccountBtn.click();
   59 |       await page.waitForTimeout(1000);
   60 |     }
   61 |     
   62 |     // Fill registration form
   63 |     await page.fill('#name', 'Test User');
   64 |     await page.fill('#email', TEST_EMAIL);
   65 |     await page.fill('#password', TEST_PASSWORD);
   66 |     
   67 |     // Submit registration
   68 |     await page.click('button[type="submit"]:has-text("Create Account")');
   69 |     
   70 |     // Wait for registration to complete and redirect
   71 |     await page.waitForTimeout(5000);
   72 |     
   73 |     currentUrl = page.url();
   74 |     console.log(`After registration, URL is: ${currentUrl}`);
   75 |     
   76 |     // If we're on dashboard, great! If not, manually navigate
   77 |     if (!currentUrl.includes('/dashboard')) {
   78 |       await page.goto('http://localhost:3008/dashboard');
   79 |       await page.waitForLoadState('networkidle');
   80 |       await page.waitForTimeout(2000);
   81 |       currentUrl = page.url();
   82 |     }
   83 |     
   84 |     // Now dashboard should be accessible
   85 |     if (currentUrl.includes('/dashboard')) {
   86 |       console.log('✅ Authenticated user can access dashboard');
   87 |     } else {
   88 |       console.log(`❌ Authenticated user cannot access dashboard, currently at: ${currentUrl}`);
   89 |       // Take screenshot for debugging
   90 |       await page.screenshot({ path: 'auth-user-dashboard-issue.png' });
   91 |       throw new Error('Authenticated user should be able to access dashboard');
   92 |     }
   93 |     
   94 |     // Step 3: Verify user was created in database
   95 |     const users = await db.select().from(user).where(eq(user.email, TEST_EMAIL));
   96 |     if (users.length > 0) {
   97 |       userId = users[0].id;
   98 |       console.log(`✅ User successfully created in database with ID: ${userId}`);
   99 |     } else {
  100 |       console.log('⚠️ User not found in database, but authentication might still be working');
  101 |     }
  102 |     
  103 |     // Step 4: Test that homepage redirects authenticated users to dashboard
  104 |     await page.goto('http://localhost:3008');
  105 |     await page.waitForLoadState('networkidle');
  106 |     await page.waitForTimeout(2000);
  107 |     
  108 |     currentUrl = page.url();
  109 |     if (currentUrl.includes('/dashboard')) {
  110 |       console.log('✅ Authenticated users are redirected from homepage to dashboard');
  111 |     } else {
  112 |       console.log(`ℹ️ Homepage does not redirect authenticated users, currently at: ${currentUrl}`);
  113 |     }
  114 |     
  115 |     console.log('✅ Authentication protection test completed successfully!');
  116 |   });
  117 |
  118 |   test('Config page protection works correctly', async ({ page }) => {
  119 |     console.log('Testing config page protection');
  120 |     
  121 |     // Try to access config as anonymous user
  122 |     await page.goto('http://localhost:3008/config');
  123 |     await page.waitForLoadState('networkidle');
  124 |     await page.waitForTimeout(3000);
  125 |     
  126 |     const currentUrl = page.url();
  127 |     console.log(`Config access attempt resulted in: ${currentUrl}`);
  128 |     
  129 |     // Should NOT be on config page
  130 |     if (currentUrl.includes('/config')) {
  131 |       console.log('❌ Config page is accessible to anonymous users - this is a security issue!');
  132 |       await page.screenshot({ path: 'config-security-issue.png' });
  133 |       throw new Error('Config page should not be accessible to anonymous users');
  134 |     } else {
  135 |       console.log('✅ Config page properly protected from anonymous access');
  136 |     }
  137 |   });
  138 | });
```