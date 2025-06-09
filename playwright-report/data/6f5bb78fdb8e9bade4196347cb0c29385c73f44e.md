# Test info

- Name: Authentication Integration - Simple Tests >> Backend auth endpoints are working
- Location: /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/auth-integration-simple.spec.ts:88:7

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
    at /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/auth-integration-simple.spec.ts:120:34
```

# Test source

```ts
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
   81 |     const emailError = await page.locator('text=Email is required').isVisible();
   82 |     const passwordError = await page.locator('text=Password is required').isVisible();
   83 |     const anyValidationError = await page.locator(':has-text("required"), :has-text("invalid"), :has-text("error")').count() > 0;
   84 |     
   85 |     expect(emailError || passwordError || anyValidationError).toBeTruthy();
   86 |   });
   87 |
   88 |   test('Backend auth endpoints are working', async ({ page }) => {
   89 |     // Test sign-up endpoint directly
   90 |     const signUpResponse = await page.request.post('/api/auth/sign-up/email', {
   91 |       data: {
   92 |         email: `backend-test-${Date.now()}@example.com`,
   93 |         password: 'BackendTest123!',
   94 |         name: 'Backend Test User',
   95 |       },
   96 |     });
   97 |     
   98 |     console.log('Sign-up response status:', signUpResponse.status());
   99 |     
  100 |     if (!signUpResponse.ok()) {
  101 |       const errorText = await signUpResponse.text();
  102 |       console.log('Sign-up error:', errorText);
  103 |       // Skip the rest of the test if backend isn't configured
  104 |       expect(signUpResponse.status()).toBeGreaterThanOrEqual(400);
  105 |       return;
  106 |     }
  107 |     
  108 |     const signUpData = await signUpResponse.json();
  109 |     expect(signUpData.user).toBeDefined();
  110 |     expect(signUpData.user.email).toContain('backend-test-');
  111 |     
  112 |     const userId = signUpData.user.id;
  113 |     
  114 |     // Test user preferences endpoint
  115 |     const prefsResponse = await page.request.get(`/api/user-preferences?userId=${userId}`);
  116 |     expect(prefsResponse.ok()).toBeTruthy();
  117 |     
  118 |     // Test account balance endpoint with user ID
  119 |     const balanceResponse = await page.request.get(`/api/account/balance?userId=${userId}`);
> 120 |     expect(balanceResponse.ok()).toBeTruthy();
      |                                  ^ Error: expect(received).toBeTruthy()
  121 |     const balanceData = await balanceResponse.json();
  122 |     expect(balanceData.data.credentialsType).toBe('environment-fallback');
  123 |   });
  124 |
  125 |   test('API credentials integration works', async ({ page }) => {
  126 |     // Create a test user first
  127 |     const signUpResponse = await page.request.post('/api/auth/sign-up/email', {
  128 |       data: {
  129 |         email: `creds-test-${Date.now()}@example.com`,
  130 |         password: 'CredsTest123!',
  131 |         name: 'Creds Test User',
  132 |       },
  133 |     });
  134 |     
  135 |     const signUpData = await signUpResponse.json();
  136 |     if (!signUpData.user) {
  137 |       console.log('User creation failed, skipping test');
  138 |       return;
  139 |     }
  140 |     const userId = signUpData.user.id;
  141 |     
  142 |     // Save test API credentials
  143 |     const saveCredsResponse = await page.request.post('/api/api-credentials', {
  144 |       data: {
  145 |         userId,
  146 |         provider: 'mexc',
  147 |         apiKey: 'test_api_key_1234567890_playwright',
  148 |         secretKey: 'test_secret_key_0987654321_playwright',
  149 |       },
  150 |     });
  151 |     
  152 |     expect(saveCredsResponse.ok()).toBeTruthy();
  153 |     const saveCredsData = await saveCredsResponse.json();
  154 |     expect(saveCredsData.success).toBeTruthy();
  155 |     expect(saveCredsData.maskedApiKey).toContain('****');
  156 |     
  157 |     // Retrieve the credentials
  158 |     const getCredsResponse = await page.request.get(`/api/api-credentials?userId=${userId}&provider=mexc`);
  159 |     expect(getCredsResponse.ok()).toBeTruthy();
  160 |     const getCredsData = await getCredsResponse.json();
  161 |     expect(getCredsData.isActive).toBeTruthy();
  162 |     expect(getCredsData.apiKey).toContain('****');
  163 |     
  164 |     // Test account balance now uses user credentials
  165 |     const balanceResponse = await page.request.get(`/api/account/balance?userId=${userId}`);
  166 |     expect(balanceResponse.ok()).toBeTruthy();
  167 |     const balanceData = await balanceResponse.json();
  168 |     expect(balanceData.data.hasUserCredentials).toBeTruthy();
  169 |     expect(balanceData.data.credentialsType).toBe('user-specific');
  170 |   });
  171 |
  172 |   test('User preferences persist and isolate correctly', async ({ page }) => {
  173 |     // Create first user
  174 |     const user1Response = await page.request.post('/api/auth/sign-up/email', {
  175 |       data: {
  176 |         email: `prefs1-${Date.now()}@example.com`,
  177 |         password: 'PrefsTest123!',
  178 |         name: 'Prefs Test User 1',
  179 |       },
  180 |     });
  181 |     const user1Data = await user1Response.json();
  182 |     if (!user1Data.user) {
  183 |       console.log('User 1 creation failed, skipping test');
  184 |       return;
  185 |     }
  186 |     const user1Id = user1Data.user.id;
  187 |     
  188 |     // Create second user
  189 |     const user2Response = await page.request.post('/api/auth/sign-up/email', {
  190 |       data: {
  191 |         email: `prefs2-${Date.now()}@example.com`,
  192 |         password: 'PrefsTest123!',
  193 |         name: 'Prefs Test User 2',
  194 |       },
  195 |     });
  196 |     const user2Data = await user2Response.json();
  197 |     if (!user2Data.user) {
  198 |       console.log('User 2 creation failed, skipping test');
  199 |       return;
  200 |     }
  201 |     const user2Id = user2Data.user.id;
  202 |     
  203 |     // Update user 1 preferences
  204 |     const updateUser1Prefs = await page.request.post('/api/user-preferences', {
  205 |       data: {
  206 |         userId: user1Id,
  207 |         defaultBuyAmountUsdt: 500.0,
  208 |         takeProfitLevel1: 8.0,
  209 |         riskTolerance: 'high',
  210 |       },
  211 |     });
  212 |     expect(updateUser1Prefs.ok()).toBeTruthy();
  213 |     
  214 |     // Get user 1 preferences
  215 |     const user1PrefsResponse = await page.request.get(`/api/user-preferences?userId=${user1Id}`);
  216 |     const user1Prefs = await user1PrefsResponse.json();
  217 |     expect(user1Prefs.defaultBuyAmountUsdt).toBe(500.0);
  218 |     expect(user1Prefs.takeProfitLevels.level1).toBe(8.0);
  219 |     expect(user1Prefs.riskTolerance).toBe('high');
  220 |     
```