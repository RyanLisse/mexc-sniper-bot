# Test info

- Name: Authentication Protection Verification >> Anonymous users cannot access protected pages
- Location: /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/auth-protection-simple.spec.ts:10:7

# Error details

```
Error: Timed out 5000ms waiting for expect(locator).toContainText(expected)

Locator: locator('h1')
Expected string: "MEXC Sniper Bot"
Received: <element(s) not found>
Call log:
  - expect.toContainText with timeout 5000ms
  - waiting for locator('h1')

    at /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/auth-protection-simple.spec.ts:42:38
```

# Page snapshot

```yaml
- paragraph: Loading...
- button "Open Tanstack query devtools":
  - img
- alert
- button "Open Next.js Dev Tools":
  - img
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 |
   3 | test.describe('Authentication Protection Verification', () => {
   4 |   
   5 |   test.beforeEach(async ({ page }) => {
   6 |     // Clear any existing session
   7 |     await page.context().clearCookies();
   8 |   });
   9 |
   10 |   test('Anonymous users cannot access protected pages', async ({ page }) => {
   11 |     console.log('🔒 Testing authentication protection...');
   12 |
   13 |     // Test dashboard protection
   14 |     console.log('Testing dashboard protection...');
   15 |     const dashboardResponse = await page.goto('http://localhost:3008/dashboard');
   16 |     
   17 |     // Wait a moment for redirect
   18 |     await page.waitForTimeout(2000);
   19 |     
   20 |     const dashboardUrl = page.url();
   21 |     console.log(`Dashboard access result: ${dashboardUrl}`);
   22 |     
   23 |     // Should be redirected to homepage
   24 |     expect(dashboardUrl).toBe('http://localhost:3008/');
   25 |     console.log('✅ Dashboard properly protected');
   26 |
   27 |     // Test config protection
   28 |     console.log('Testing config protection...');
   29 |     const configResponse = await page.goto('http://localhost:3008/config');
   30 |     
   31 |     // Wait a moment for redirect
   32 |     await page.waitForTimeout(2000);
   33 |     
   34 |     const configUrl = page.url();
   35 |     console.log(`Config access result: ${configUrl}`);
   36 |     
   37 |     // Should be redirected to homepage
   38 |     expect(configUrl).toBe('http://localhost:3008/');
   39 |     console.log('✅ Config properly protected');
   40 |
   41 |     // Verify we're on homepage with expected content
>  42 |     await expect(page.locator('h1')).toContainText('MEXC Sniper Bot', { timeout: 5000 });
      |                                      ^ Error: Timed out 5000ms waiting for expect(locator).toContainText(expected)
   43 |     console.log('✅ Properly redirected to homepage');
   44 |   });
   45 |
   46 |   test('Homepage is accessible to anonymous users', async ({ page }) => {
   47 |     console.log('🏠 Testing homepage access...');
   48 |     
   49 |     await page.goto('http://localhost:3008/');
   50 |     await page.waitForTimeout(2000);
   51 |     
   52 |     // Should stay on homepage
   53 |     expect(page.url()).toBe('http://localhost:3008/');
   54 |     
   55 |     // Should see homepage content
   56 |     await expect(page.locator('h1')).toContainText('MEXC Sniper Bot', { timeout: 5000 });
   57 |     await expect(page.locator('text=Get Started')).toBeVisible({ timeout: 5000 });
   58 |     
   59 |     console.log('✅ Homepage accessible to anonymous users');
   60 |   });
   61 |
   62 |   test('Auth page is accessible to anonymous users', async ({ page }) => {
   63 |     console.log('🔑 Testing auth page access...');
   64 |     
   65 |     await page.goto('http://localhost:3008/auth');
   66 |     await page.waitForTimeout(3000);
   67 |     
   68 |     // Should stay on auth page
   69 |     expect(page.url()).toBe('http://localhost:3008/auth');
   70 |     
   71 |     // Should see auth form
   72 |     await expect(page.locator('form')).toBeVisible({ timeout: 10000 });
   73 |     
   74 |     console.log('✅ Auth page accessible to anonymous users');
   75 |   });
   76 |
   77 |   test('Multiple protected routes are all protected', async ({ page }) => {
   78 |     console.log('🛡️ Testing multiple protected routes...');
   79 |     
   80 |     const protectedRoutes = [
   81 |       '/dashboard',
   82 |       '/config',
   83 |       '/dashboard/settings',
   84 |       '/config/api'
   85 |     ];
   86 |
   87 |     for (const route of protectedRoutes) {
   88 |       console.log(`Testing ${route}...`);
   89 |       
   90 |       await page.goto(`http://localhost:3008${route}`);
   91 |       await page.waitForTimeout(2000);
   92 |       
   93 |       const currentUrl = page.url();
   94 |       console.log(`${route} → ${currentUrl}`);
   95 |       
   96 |       expect(currentUrl).toBe('http://localhost:3008/');
   97 |     }
   98 |     
   99 |     console.log('✅ All protected routes properly redirect');
  100 |   });
  101 |
  102 |   test('Server-side protection works with direct requests', async ({ page }) => {
  103 |     console.log('🌐 Testing server-side protection...');
  104 |     
  105 |     // Test with direct HTTP request to dashboard
  106 |     const dashboardResponse = await page.request.get('http://localhost:3008/dashboard');
  107 |     console.log(`Dashboard response status: ${dashboardResponse.status()}`);
  108 |     
  109 |     // Should get redirect response
  110 |     expect([301, 302, 307, 308]).toContain(dashboardResponse.status());
  111 |     
  112 |     // Test with direct HTTP request to config
  113 |     const configResponse = await page.request.get('http://localhost:3008/config');
  114 |     console.log(`Config response status: ${configResponse.status()}`);
  115 |     
  116 |     // Should get redirect response
  117 |     expect([301, 302, 307, 308]).toContain(configResponse.status());
  118 |     
  119 |     // Test homepage is accessible
  120 |     const homepageResponse = await page.request.get('http://localhost:3008/');
  121 |     console.log(`Homepage response status: ${homepageResponse.status()}`);
  122 |     
  123 |     // Should get success response
  124 |     expect(homepageResponse.status()).toBe(200);
  125 |     
  126 |     console.log('✅ Server-side protection working correctly');
  127 |   });
  128 |
  129 |   test('Middleware protection headers', async ({ page }) => {
  130 |     console.log('📋 Testing middleware protection headers...');
  131 |     
  132 |     const response = await page.request.get('http://localhost:3008/dashboard');
  133 |     
  134 |     console.log(`Status: ${response.status()}`);
  135 |     console.log(`Headers: ${JSON.stringify([...response.headers()])}`);
  136 |     
  137 |     // Should be a redirect
  138 |     expect([301, 302, 307, 308]).toContain(response.status());
  139 |     
  140 |     // Should have location header pointing to homepage
  141 |     const location = response.headers()['location'];
  142 |     console.log(`Location header: ${location}`);
```