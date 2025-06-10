# Test info

- Name: Simplified Authentication Flow >> Authentication state persistence
- Location: /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/simplified-auth-flow.spec.ts:139:7

# Error details

```
TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
=========================== logs ===========================
waiting for navigation to "**/dashboard" until "load"
============================================================
    at /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/simplified-auth-flow.spec.ts:162:16
```

# Page snapshot

```yaml
- heading "MEXC Sniper Bot" [level=1]
- paragraph: AI-powered cryptocurrency trading platform
- text: Create Account Create your account to start trading with AI-powered strategies Full Name
- textbox "Full Name": Test User
- text: Email Address
- textbox "Email Address": test-1749592403194@example.com
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
   62 |     console.log('Testing navigation to auth page');
   63 |     
   64 |     // Wait for page to load
   65 |     await page.waitForLoadState('networkidle');
   66 |     
   67 |     // Skip loading state if present
   68 |     const loadingElement = page.locator('text=Loading...');
   69 |     if (await loadingElement.isVisible()) {
   70 |       await loadingElement.waitFor({ state: 'detached', timeout: 10000 });
   71 |     }
   72 |     
   73 |     // Click "Get Started" button
   74 |     await page.click('text=Get Started');
   75 |     
   76 |     // Wait for navigation
   77 |     await page.waitForURL('**/auth', { timeout: 10000 });
   78 |     
   79 |     // Verify we're on the auth page
   80 |     await expect(page).toHaveURL(/.*\/auth$/);
   81 |     
   82 |     console.log('Navigation to auth page successful');
   83 |   });
   84 |
   85 |   test('User registration flow', async ({ page }) => {
   86 |     console.log('Testing user registration');
   87 |     
   88 |     // Navigate to auth page
   89 |     await page.goto('http://localhost:3008/auth');
   90 |     await page.waitForLoadState('networkidle');
   91 |     
   92 |     // Take screenshot of auth page
   93 |     await page.screenshot({ path: 'debug-auth-page.png', fullPage: true });
   94 |     
   95 |     // Wait for auth form to load
   96 |     await page.waitForSelector('form', { timeout: 10000 });
   97 |     
   98 |     // Check if we need to switch to sign-up mode
   99 |     const createAccountButton = page.locator('text=Create account here');
  100 |     if (await createAccountButton.isVisible()) {
  101 |       console.log('Switching to sign-up mode');
  102 |       await createAccountButton.click();
  103 |       await page.waitForTimeout(1000); // Wait for form to update
  104 |     }
  105 |     
  106 |     // Look for registration form elements
  107 |     const emailInput = page.locator('#email');
  108 |     const passwordInput = page.locator('#password');
  109 |     const nameInput = page.locator('#name');
  110 |     
  111 |     // Wait for form to be ready
  112 |     await emailInput.waitFor({ timeout: 10000 });
  113 |     
  114 |     // Fill registration form
  115 |     await nameInput.fill('Test User');
  116 |     await emailInput.fill(TEST_EMAIL);
  117 |     await passwordInput.fill(TEST_PASSWORD);
  118 |     
  119 |     // Find and click submit button - should be "Create Account"
  120 |     const submitButton = page.locator('button[type="submit"]:has-text("Create Account")');
  121 |     await submitButton.click();
  122 |     
  123 |     // Wait for registration to complete
  124 |     await page.waitForURL('**/dashboard', { timeout: 15000 });
  125 |     
  126 |     // Verify we're on dashboard
  127 |     await expect(page).toHaveURL(/.*\/dashboard$/);
  128 |     
  129 |     // Get user ID for cleanup
  130 |     const users = await db.select().from(user).where(eq(user.email, TEST_EMAIL));
  131 |     if (users.length > 0) {
  132 |       userId = users[0].id;
  133 |       console.log(`User registered successfully with ID: ${userId}`);
  134 |     }
  135 |     
  136 |     console.log('Registration flow completed successfully');
  137 |   });
  138 |
  139 |   test('Authentication state persistence', async ({ page, context }) => {
  140 |     console.log('Testing authentication state persistence');
  141 |     
  142 |     // Register a user first
  143 |     await page.goto('http://localhost:3008/auth');
  144 |     await page.waitForLoadState('networkidle');
  145 |     
  146 |     // Wait for auth form to load
  147 |     await page.waitForSelector('form', { timeout: 10000 });
  148 |     
  149 |     // Switch to sign-up mode
  150 |     const createAccountButton = page.locator('text=Create account here');
  151 |     if (await createAccountButton.isVisible()) {
  152 |       await createAccountButton.click();
  153 |       await page.waitForTimeout(1000);
  154 |     }
  155 |     
  156 |     // Fill and submit registration
  157 |     await page.fill('#name', 'Test User');
  158 |     await page.fill('#email', TEST_EMAIL);
  159 |     await page.fill('#password', TEST_PASSWORD);
  160 |     
  161 |     await page.click('button[type="submit"]:has-text("Create Account")');
> 162 |     await page.waitForURL('**/dashboard', { timeout: 15000 });
      |                ^ TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
  163 |     
  164 |     // Get user ID for cleanup
  165 |     const users = await db.select().from(user).where(eq(user.email, TEST_EMAIL));
  166 |     if (users.length > 0) {
  167 |       userId = users[0].id;
  168 |     }
  169 |     
  170 |     // Now test navigation - authenticated users should be redirected to dashboard
  171 |     await page.goto('http://localhost:3008');
  172 |     await page.waitForURL('**/dashboard', { timeout: 10000 });
  173 |     
  174 |     // Verify redirect happened
  175 |     await expect(page).toHaveURL(/.*\/dashboard$/);
  176 |     
  177 |     console.log('Authentication state persistence verified');
  178 |   });
  179 |
  180 |   test('Network request optimization check', async ({ page }) => {
  181 |     console.log('Testing for redundant network requests');
  182 |     
  183 |     const requests: any[] = [];
  184 |     
  185 |     // Monitor network requests
  186 |     page.on('request', request => {
  187 |       requests.push({
  188 |         url: request.url(),
  189 |         method: request.method(),
  190 |         resourceType: request.resourceType()
  191 |       });
  192 |     });
  193 |     
  194 |     // Load homepage
  195 |     await page.goto('http://localhost:3008');
  196 |     await page.waitForLoadState('networkidle');
  197 |     
  198 |     // Wait a bit more for any delayed requests
  199 |     await page.waitForTimeout(3000);
  200 |     
  201 |     // Analyze requests
  202 |     const authRequests = requests.filter(r => r.url.includes('/api/auth/'));
  203 |     const sessionRequests = authRequests.filter(r => r.url.includes('session') || r.url.includes('get-session'));
  204 |     const duplicateRequests = requests.filter((r, index, arr) => 
  205 |       arr.findIndex(req => req.url === r.url && req.method === r.method) !== index
  206 |     );
  207 |     
  208 |     console.log(`Total requests: ${requests.length}`);
  209 |     console.log(`Auth requests: ${authRequests.length}`);
  210 |     console.log(`Session requests: ${sessionRequests.length}`);
  211 |     console.log(`Duplicate requests: ${duplicateRequests.length}`);
  212 |     
  213 |     // Verify reasonable request counts
  214 |     expect(authRequests.length).toBeLessThan(10);
  215 |     expect(sessionRequests.length).toBeLessThan(5);
  216 |     expect(duplicateRequests.length).toBeLessThan(3);
  217 |     
  218 |     console.log('Network optimization check passed');
  219 |   });
  220 | });
```