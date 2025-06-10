# Test info

- Name: Complete User Journey >> Database integrity verification
- Location: /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/full-user-journey.spec.ts:173:7

# Error details

```
TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
=========================== logs ===========================
waiting for navigation to "**/dashboard" until "load"
============================================================
    at /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/full-user-journey.spec.ts:188:16
```

# Page snapshot

```yaml
- heading "MEXC Sniper Bot" [level=1]
- paragraph: AI-powered cryptocurrency trading platform
- text: Create Account Create your account to start trading with AI-powered strategies Full Name
- textbox "Full Name": DB Test User
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
  159 |     // Navigate through key pages to check performance
  160 |     await page.goto('http://localhost:3008/dashboard');
  161 |     await page.waitForLoadState('networkidle');
  162 |     await page.waitForTimeout(2000);
  163 |     
  164 |     const authRequests = finalRequests.filter(r => r.url.includes('/api/auth/'));
  165 |     console.log(`Final performance check - Auth requests: ${authRequests.length}`);
  166 |     
  167 |     // Should not have excessive requests
  168 |     expect(authRequests.length).toBeLessThan(10);
  169 |     
  170 |     console.log('✅ Complete user journey test passed successfully!');
  171 |   });
  172 |
  173 |   test('Database integrity verification', async ({ page }) => {
  174 |     console.log('Testing database operations integrity');
  175 |     
  176 |     // Create test user through the UI
  177 |     await page.goto('http://localhost:3008/auth');
  178 |     await page.waitForLoadState('networkidle');
  179 |     
  180 |     await page.click('text=Create account here');
  181 |     await page.waitForTimeout(1000);
  182 |     
  183 |     await page.fill('#name', 'DB Test User');
  184 |     await page.fill('#email', TEST_EMAIL);
  185 |     await page.fill('#password', TEST_PASSWORD);
  186 |     
  187 |     await page.click('button[type="submit"]:has-text("Create Account")');
> 188 |     await page.waitForURL('**/dashboard', { timeout: 15000 });
      |                ^ TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
  189 |     
  190 |     // Verify user was created in database
  191 |     const users = await db.select().from(user).where(eq(user.email, TEST_EMAIL));
  192 |     expect(users).toHaveLength(1);
  193 |     userId = users[0].id;
  194 |     
  195 |     expect(users[0].email).toBe(TEST_EMAIL);
  196 |     expect(users[0].name).toBe('DB Test User');
  197 |     
  198 |     console.log('✓ Database user creation verified');
  199 |     
  200 |     // Check that user preferences are created with defaults
  201 |     const prefs = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
  202 |     if (prefs.length > 0) {
  203 |       expect(prefs[0].userId).toBe(userId);
  204 |       console.log('✓ User preferences created automatically');
  205 |     } else {
  206 |       console.log('ℹ User preferences not auto-created (may be created on first config save)');
  207 |     }
  208 |     
  209 |     console.log('✅ Database integrity verification passed');
  210 |   });
  211 | });
```