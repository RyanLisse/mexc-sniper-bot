# Test info

- Name: Authentication Protection Flow >> Session persistence across browser refresh
- Location: /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/auth-protection-flow.spec.ts:301:7

# Error details

```
TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
=========================== logs ===========================
waiting for navigation to "**/dashboard" until "load"
============================================================
    at /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/auth-protection-flow.spec.ts:319:16
```

# Page snapshot

```yaml
- heading "MEXC Sniper Bot" [level=1]
- paragraph: AI-powered cryptocurrency trading platform
- text: Create Account Create your account to start trading with AI-powered strategies Full Name
- textbox "Full Name": Auth Test User
- text: Email Address
- textbox "Email Address": authtest-1749592340471@example.com
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
  219 |     
  220 |     // Try to access config page as anonymous user
  221 |     await page.goto('http://localhost:3008/config');
  222 |     await page.waitForLoadState('networkidle');
  223 |     
  224 |     // Wait for redirect
  225 |     await page.waitForTimeout(2000);
  226 |     
  227 |     const finalUrl = page.url();
  228 |     console.log(`Config access attempt resulted in URL: ${finalUrl}`);
  229 |     
  230 |     // Should be redirected away from config page
  231 |     expect(finalUrl).not.toMatch(/.*\/config$/);
  232 |     console.log('✓ Anonymous user cannot access config page');
  233 |     
  234 |     // Now register a user and test config access
  235 |     await page.goto('http://localhost:3008/auth');
  236 |     await page.waitForLoadState('networkidle');
  237 |     
  238 |     // Register user
  239 |     const createAccountButton = page.locator('text=Create account here');
  240 |     if (await createAccountButton.isVisible()) {
  241 |       await createAccountButton.click();
  242 |       await page.waitForTimeout(1000);
  243 |     }
  244 |     
  245 |     await page.fill('#name', TEST_NAME);
  246 |     await page.fill('#email', TEST_EMAIL);
  247 |     await page.fill('#password', TEST_PASSWORD);
  248 |     
  249 |     await page.click('button[type="submit"]:has-text("Create Account")');
  250 |     await page.waitForURL('**/dashboard', { timeout: 15000 });
  251 |     
  252 |     // Get user ID for cleanup
  253 |     const users = await db.select().from(user).where(eq(user.email, TEST_EMAIL));
  254 |     if (users.length > 0) {
  255 |       userId = users[0].id;
  256 |     }
  257 |     
  258 |     // Try to access config page as authenticated user
  259 |     await page.goto('http://localhost:3008/config');
  260 |     await page.waitForLoadState('networkidle');
  261 |     
  262 |     // Config page should be accessible (or redirect to dashboard if not implemented)
  263 |     const configUrl = page.url();
  264 |     if (configUrl.includes('/config')) {
  265 |       console.log('✓ Authenticated user can access config page');
  266 |     } else if (configUrl.includes('/dashboard')) {
  267 |       console.log('✓ Config page redirects authenticated users to dashboard (page may not be fully implemented)');
  268 |     } else {
  269 |       console.log(`ℹ Unexpected redirect to: ${configUrl}`);
  270 |     }
  271 |   });
  272 |
  273 |   test('Multiple page protection verification', async ({ page }) => {
  274 |     console.log('Testing protection across multiple protected pages');
  275 |     
  276 |     const protectedPages = [
  277 |       '/dashboard',
  278 |       '/config',
  279 |       // Add more protected pages as they're implemented
  280 |     ];
  281 |     
  282 |     // Test each protected page as anonymous user
  283 |     for (const pagePath of protectedPages) {
  284 |       await page.goto(`http://localhost:3008${pagePath}`);
  285 |       await page.waitForLoadState('networkidle');
  286 |       
  287 |       // Wait for redirect
  288 |       await page.waitForTimeout(2000);
  289 |       
  290 |       const finalUrl = page.url();
  291 |       console.log(`Access attempt to ${pagePath} resulted in URL: ${finalUrl}`);
  292 |       
  293 |       // Should be redirected away from protected page
  294 |       expect(finalUrl).not.toMatch(new RegExp(`.*${pagePath.replace('/', '\\/')}$`));
  295 |       console.log(`✓ Anonymous user cannot access ${pagePath}`);
  296 |     }
  297 |     
  298 |     console.log('✅ All protected pages properly secured for anonymous users');
  299 |   });
  300 |
  301 |   test('Session persistence across browser refresh', async ({ page }) => {
  302 |     console.log('Testing session persistence across browser refresh');
  303 |     
  304 |     // Register and authenticate user
  305 |     await page.goto('http://localhost:3008/auth');
  306 |     await page.waitForLoadState('networkidle');
  307 |     
  308 |     const createAccountButton = page.locator('text=Create account here');
  309 |     if (await createAccountButton.isVisible()) {
  310 |       await createAccountButton.click();
  311 |       await page.waitForTimeout(1000);
  312 |     }
  313 |     
  314 |     await page.fill('#name', TEST_NAME);
  315 |     await page.fill('#email', TEST_EMAIL);
  316 |     await page.fill('#password', TEST_PASSWORD);
  317 |     
  318 |     await page.click('button[type="submit"]:has-text("Create Account")');
> 319 |     await page.waitForURL('**/dashboard', { timeout: 15000 });
      |                ^ TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
  320 |     
  321 |     // Get user ID for cleanup
  322 |     const users = await db.select().from(user).where(eq(user.email, TEST_EMAIL));
  323 |     if (users.length > 0) {
  324 |       userId = users[0].id;
  325 |     }
  326 |     
  327 |     console.log('✓ User authenticated and on dashboard');
  328 |     
  329 |     // Refresh the page
  330 |     await page.reload({ waitUntil: 'networkidle' });
  331 |     
  332 |     // Should still be on dashboard (session persisted)
  333 |     await expect(page).toHaveURL(/.*\/dashboard$/);
  334 |     console.log('✓ Session persisted after browser refresh');
  335 |     
  336 |     // Try navigating to homepage - should redirect back to dashboard
  337 |     await page.goto('http://localhost:3008');
  338 |     await page.waitForURL('**/dashboard', { timeout: 10000 });
  339 |     await expect(page).toHaveURL(/.*\/dashboard$/);
  340 |     console.log('✓ Authenticated user still redirected from homepage to dashboard after refresh');
  341 |     
  342 |     console.log('✅ Session persistence test passed!');
  343 |   });
  344 | });
```