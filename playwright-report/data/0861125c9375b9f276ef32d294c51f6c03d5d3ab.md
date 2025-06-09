# Test info

- Name: Authentication Integration - Simple Tests >> Auth page loads correctly
- Location: /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/auth-integration-simple.spec.ts:4:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3008/auth
Call log:
  - navigating to "http://localhost:3008/auth", waiting until "load"

    at /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/auth-integration-simple.spec.ts:5:16
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 |
   3 | test.describe('Authentication Integration - Simple Tests', () => {
   4 |   test('Auth page loads correctly', async ({ page }) => {
>  5 |     await page.goto('/auth');
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3008/auth
   6 |     
   7 |     // Check page title and main elements (page may show MEXC Sniper Bot title initially)
   8 |     await expect(page.locator('h1:has-text("MEXC Sniper Bot")')).toBeVisible();
   9 |     
   10 |     // Wait for form to load after hydration
   11 |     await page.waitForTimeout(2000);
   12 |     
   13 |     // Check for email and password inputs (should be visible once loaded)
   14 |     await expect(page.locator('input[type="email"]')).toBeVisible();
   15 |     await expect(page.locator('input[type="password"]')).toBeVisible();
   16 |   });
   17 |
   18 |   test('Dashboard shows anonymous state', async ({ page }) => {
   19 |     await page.goto('/dashboard');
   20 |     
   21 |     // Wait for dashboard to load
   22 |     await page.waitForTimeout(3000);
   23 |     
   24 |     // Should show anonymous badge or sign-in option
   25 |     const hasAnonymous = await page.locator('text=Anonymous').isVisible();
   26 |     const hasSignIn = await page.locator('a:has-text("Sign In")').isVisible();
   27 |     
   28 |     expect(hasAnonymous || hasSignIn).toBeTruthy();
   29 |     
   30 |     // Should still show main dashboard content
   31 |     await expect(page.locator('text=Trading Dashboard')).toBeVisible();
   32 |   });
   33 |
   34 |   test('User can navigate between auth states', async ({ page }) => {
   35 |     await page.goto('/auth');
   36 |     
   37 |     // Wait for page to load and hydrate
   38 |     await page.waitForTimeout(3000);
   39 |     
   40 |     // Should show either Sign In or Create Account initially
   41 |     const hasSignIn = await page.locator('text=Sign In').isVisible();
   42 |     const hasCreateAccount = await page.locator('text=Create Account').isVisible();
   43 |     
   44 |     expect(hasSignIn || hasCreateAccount).toBeTruthy();
   45 |     
   46 |     // Try to find the toggle button
   47 |     const toggleToSignIn = page.locator('button:has-text("Sign in here")');
   48 |     const toggleToSignUp = page.locator('button:has-text("Create account here")');
   49 |     
   50 |     if (await toggleToSignIn.isVisible()) {
   51 |       await toggleToSignIn.click();
   52 |       await expect(page.locator('text=Sign In')).toBeVisible();
   53 |     } else if (await toggleToSignUp.isVisible()) {
   54 |       await toggleToSignUp.click();
   55 |       await expect(page.locator('text=Create Account')).toBeVisible();
   56 |     }
   57 |   });
   58 |
   59 |   test('Form validation works', async ({ page }) => {
   60 |     await page.goto('/auth');
   61 |     
   62 |     // Wait for form to load and hydrate
   63 |     await page.waitForTimeout(3000);
   64 |     
   65 |     // Check if form is loaded
   66 |     const emailInput = page.locator('input[type="email"]');
   67 |     const passwordInput = page.locator('input[type="password"]');
   68 |     const submitButton = page.locator('button[type="submit"]');
   69 |     
   70 |     await expect(emailInput).toBeVisible();
   71 |     await expect(passwordInput).toBeVisible();
   72 |     await expect(submitButton).toBeVisible();
   73 |     
   74 |     // Try to submit empty form
   75 |     await submitButton.click();
   76 |     
   77 |     // Wait for validation to appear
   78 |     await page.waitForTimeout(1000);
   79 |     
   80 |     // Check for any error messages (the specific text may vary)
   81 |     const hasErrors = await page.locator('text="required", text="invalid", text="error"').count() > 0;
   82 |     expect(hasErrors).toBeTruthy();
   83 |   });
   84 |
   85 |   test('Backend auth endpoints are working', async ({ page }) => {
   86 |     // Test sign-up endpoint directly
   87 |     const signUpResponse = await page.request.post('/api/auth/sign-up/email', {
   88 |       data: {
   89 |         email: `backend-test-${Date.now()}@example.com`,
   90 |         password: 'BackendTest123!',
   91 |         name: 'Backend Test User',
   92 |       },
   93 |     });
   94 |     
   95 |     console.log('Sign-up response status:', signUpResponse.status());
   96 |     
   97 |     if (!signUpResponse.ok()) {
   98 |       const errorText = await signUpResponse.text();
   99 |       console.log('Sign-up error:', errorText);
  100 |       // Skip the rest of the test if backend isn't configured
  101 |       expect(signUpResponse.status()).toBeGreaterThanOrEqual(400);
  102 |       return;
  103 |     }
  104 |     
  105 |     const signUpData = await signUpResponse.json();
```