# Test info

- Name: Authentication Frontend Integration >> Pattern sniper respects user authentication
- Location: /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/test-auth-frontend.spec.ts:213:7

# Error details

```
Error: page.goto: Could not connect to the server.
Call log:
  - navigating to "http://localhost:3008/auth", waiting until "load"

    at signUpUser (/Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/test-auth-frontend.spec.ts:30:14)
    at /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/test-auth-frontend.spec.ts:217:11
```

# Test source

```ts
   1 | import { test, expect, type Page } from '@playwright/test';
   2 |
   3 | async function signInUser(page: Page, email: string, password: string) {
   4 |   // Navigate to auth page
   5 |   await page.goto('/auth');
   6 |   
   7 |   // Wait for page to load and hydrate
   8 |   await page.waitForTimeout(3000);
   9 |   
   10 |   // Make sure we're in sign-in mode
   11 |   const signInLink = page.locator('button:has-text("Sign in here")');
   12 |   if (await signInLink.isVisible()) {
   13 |     await signInLink.click();
   14 |     await page.waitForTimeout(1000);
   15 |   }
   16 |   
   17 |   // Fill in sign-in form
   18 |   await page.fill('input[type="email"]', email);
   19 |   await page.fill('input[type="password"]', password);
   20 |   
   21 |   // Submit form
   22 |   await page.click('button[type="submit"]');
   23 |   
   24 |   // Wait for redirect or success
   25 |   await page.waitForTimeout(3000);
   26 | }
   27 |
   28 | async function signUpUser(page: Page, email: string, password: string, name: string) {
   29 |   // Navigate to auth page
>  30 |   await page.goto('/auth');
      |              ^ Error: page.goto: Could not connect to the server.
   31 |   
   32 |   // Wait for page to load and hydrate
   33 |   await page.waitForTimeout(3000);
   34 |   
   35 |   // Check if we need to switch to sign-up mode
   36 |   const createAccountLink = page.locator('button:has-text("Create account here")');
   37 |   if (await createAccountLink.isVisible()) {
   38 |     await createAccountLink.click();
   39 |     await page.waitForTimeout(1000); // Wait for form to switch
   40 |   }
   41 |   
   42 |   // Check if name field is visible (indicates sign-up mode)
   43 |   const nameField = page.locator('input[id="name"]');
   44 |   if (await nameField.isVisible()) {
   45 |     // Fill in sign-up form
   46 |     await page.fill('input[id="name"]', name);
   47 |     await page.fill('input[type="email"]', email);
   48 |     await page.fill('input[type="password"]', password);
   49 |     
   50 |     // Submit form
   51 |     await page.click('button[type="submit"]');
   52 |   } else {
   53 |     // Use the API directly if UI form isn't working
   54 |     console.log('Sign-up form not available, using API directly');
   55 |     const response = await page.request.post('/api/auth/sign-up/email', {
   56 |       data: { email, password, name }
   57 |     });
   58 |     if (!response.ok()) {
   59 |       throw new Error(`Sign-up failed: ${response.status()}`);
   60 |     }
   61 |   }
   62 |   
   63 |   // Wait for redirect or success
   64 |   await page.waitForTimeout(3000);
   65 | }
   66 |
   67 | test.describe('Authentication Frontend Integration', () => {
   68 |   test('Dashboard shows anonymous user state correctly', async ({ page }) => {
   69 |     await page.goto('/dashboard');
   70 |     
   71 |     // Should show anonymous badge
   72 |     await expect(page.locator('text=Anonymous')).toBeVisible();
   73 |     
   74 |     // Should show sign-in button
   75 |     await expect(page.locator('a:has-text("Sign In")')).toBeVisible();
   76 |     
   77 |     // Should still show public data
   78 |     await expect(page.locator('text=Trading Dashboard')).toBeVisible();
   79 |     await expect(page.locator('text=Pattern Sniper').first()).toBeVisible();
   80 |   });
   81 |
   82 |   test('User can sign up and preferences are created', async ({ page }) => {
   83 |     const testEmail = `test-${Date.now()}@example.com`;
   84 |     const testPassword = 'TestPassword123!';
   85 |     const testName = 'Test User';
   86 |
   87 |     // Test sign-up process
   88 |     await signUpUser(page, testEmail, testPassword, testName);
   89 |     
   90 |     // Should redirect to dashboard or show success
   91 |     await expect(page.url()).toContain('/');
   92 |     
   93 |     // Check if user is authenticated by looking for user email
   94 |     await page.goto('/dashboard');
   95 |     await expect(page.locator(`text=${testEmail}`)).toBeVisible();
   96 |   });
   97 |
   98 |   test('Authenticated user can access and modify preferences', async ({ page }) => {
   99 |     const testEmail = `prefs-test-${Date.now()}@example.com`;
  100 |     
  101 |     // First sign up a new user
  102 |     await signUpUser(page, testEmail, 'TestPassword123!', 'Prefs Test User');
  103 |     
  104 |     // Navigate to dashboard
  105 |     await page.goto('/dashboard');
  106 |     
  107 |     // Open user preferences
  108 |     await page.click('button:has-text("Show Preferences")');
  109 |     
  110 |     // Wait for preferences to load
  111 |     await page.waitForTimeout(2000);
  112 |     
  113 |     // Check that take profit levels are visible
  114 |     await expect(page.locator('text=Take Profit Levels')).toBeVisible();
  115 |     
  116 |     // Check default values
  117 |     await expect(page.locator('text=5%')).toBeVisible(); // Level 1
  118 |     await expect(page.locator('text=10%')).toBeVisible(); // Level 2
  119 |     
  120 |     // Edit levels
  121 |     await page.click('button:has-text("Edit Levels")');
  122 |     
  123 |     // Change level 1
  124 |     const level1Input = page.locator('input').first();
  125 |     await level1Input.fill('7.5');
  126 |     
  127 |     // Save changes
  128 |     await page.click('button:has-text("Save Changes")');
  129 |     
  130 |     // Wait for save
```