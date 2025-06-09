# Test info

- Name: Authentication Frontend Integration >> Pattern sniper respects user authentication
- Location: /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/test-auth-frontend.spec.ts:213:7

# Error details

```
Error: Timed out 5000ms waiting for expect(locator).toBeVisible()

Locator: locator('button:has-text("Start Pattern Sniper")')
Expected: visible
Received: <element(s) not found>
Call log:
  - expect.toBeVisible with timeout 5000ms
  - waiting for locator('button:has-text("Start Pattern Sniper")')

    at /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/test-auth-frontend.spec.ts:226:75
```

# Page snapshot

```yaml
- button "Open Next.js Dev Tools":
  - img
- button "Open issues overlay": 1 Issue
- button "Collapse issues badge":
  - img
- navigation:
  - button "previous" [disabled]:
    - img "previous"
  - text: 1/1
  - button "next" [disabled]:
    - img "next"
- img
- link "Next.js 15.3.2 (stale) Turbopack":
  - /url: https://nextjs.org/docs/messages/version-staleness
  - img
  - text: Next.js 15.3.2 (stale) Turbopack
- img
- dialog "Runtime Error":
  - text: Runtime Error
  - button "Copy Stack Trace":
    - img
  - button "No related documentation found" [disabled]:
    - img
  - link "Learn more about enabling Node.js inspector for server code with Chrome DevTools":
    - /url: https://nextjs.org/docs/app/building-your-application/configuring/debugging#server-side-code
    - img
  - paragraph: "Error: formatCurrency is not defined"
  - paragraph:
    - img
    - text: src/components/account-balance.tsx (116:25) @ AccountBalance
    - button "Open in editor":
      - img
  - text: "114 | {showBalances ? ( 115 | <span className=\"flex items-center\"> > 116 | <TrendingUp className=\"h-5 w-5 text-green-400 mr-2\" />$ | ^ 117 | {formatCurrency(balanceData.totalUsdtValue)} USDT 118 | </span> 119 | ) : ("
  - paragraph: Call Stack 3
  - button "Show 1 ignore-listed frame(s)":
    - text: Show 1 ignore-listed frame(s)
    - img
  - text: AccountBalance
  - button:
    - img
  - text: src/components/account-balance.tsx (116:25) DashboardPage
  - button:
    - img
  - text: app/dashboard/page.tsx (924:11)
- contentinfo:
  - region "Error feedback":
    - paragraph:
      - link "Was this helpful?":
        - /url: https://nextjs.org/telemetry#error-feedback
    - button "Mark as helpful"
    - button "Mark as not helpful"
- 'heading "Application error: a client-side exception has occurred while loading localhost (see the browser console for more information)." [level=2]'
```

# Test source

```ts
  126 |     
  127 |     // Save changes
  128 |     await page.click('button:has-text("Save Changes")');
  129 |     
  130 |     // Wait for save
  131 |     await page.waitForTimeout(1000);
  132 |     
  133 |     // Verify changes were saved
  134 |     await expect(page.locator('text=7.5%')).toBeVisible();
  135 |   });
  136 |
  137 |   test('Account balance component works for authenticated users', async ({ page }) => {
  138 |     const testEmail = `balance-test-${Date.now()}@example.com`;
  139 |     
  140 |     // Sign up and sign in
  141 |     await signUpUser(page, testEmail, 'TestPassword123!', 'Balance Test User');
  142 |     
  143 |     // Navigate to dashboard
  144 |     await page.goto('/dashboard');
  145 |     
  146 |     // Wait for account balance component to load
  147 |     await page.waitForTimeout(3000);
  148 |     
  149 |     // Check that account balance section is visible
  150 |     await expect(page.locator('text=Account Balance')).toBeVisible();
  151 |     
  152 |     // Should show total portfolio value (even if 0)
  153 |     await expect(page.locator('text=Total Portfolio Value')).toBeVisible();
  154 |     
  155 |     // Should have refresh button
  156 |     await expect(page.locator('button').filter({ hasText: 'refresh' })).toBeVisible();
  157 |   });
  158 |
  159 |   test('Data isolation - different users have different preferences', async ({ page, context }) => {
  160 |     // Create first user
  161 |     const user1Email = `isolation1-${Date.now()}@example.com`;
  162 |     await signUpUser(page, user1Email, 'TestPassword123!', 'User 1');
  163 |     
  164 |     await page.goto('/dashboard');
  165 |     await page.click('button:has-text("Show Preferences")');
  166 |     await page.waitForTimeout(1000);
  167 |     
  168 |     // Edit user 1 preferences
  169 |     await page.click('button:has-text("Edit Levels")');
  170 |     const level1Input = page.locator('input').first();
  171 |     await level1Input.fill('15');
  172 |     await page.click('button:has-text("Save Changes")');
  173 |     await page.waitForTimeout(1000);
  174 |     
  175 |     // Sign out user 1
  176 |     // This might require implementing sign-out functionality in the UI
  177 |     
  178 |     // Create second user in new context
  179 |     const page2 = await context.newPage();
  180 |     const user2Email = `isolation2-${Date.now()}@example.com`;
  181 |     await signUpUser(page2, user2Email, 'TestPassword123!', 'User 2');
  182 |     
  183 |     await page2.goto('/dashboard');
  184 |     await page2.click('button:has-text("Show Preferences")');
  185 |     await page2.waitForTimeout(1000);
  186 |     
  187 |     // User 2 should have default preferences (5%, not 15%)
  188 |     await expect(page2.locator('text=5%')).toBeVisible();
  189 |     
  190 |     await page2.close();
  191 |   });
  192 |
  193 |   test('MEXC API integration respects user authentication', async ({ page }) => {
  194 |     const testEmail = `mexc-test-${Date.now()}@example.com`;
  195 |     
  196 |     // Test anonymous access first
  197 |     await page.goto('/dashboard');
  198 |     
  199 |     // Should see MEXC data without authentication
  200 |     await expect(page.locator('text=MEXC API Status')).toBeVisible();
  201 |     
  202 |     // Sign up a user
  203 |     await signUpUser(page, testEmail, 'TestPassword123!', 'MEXC Test User');
  204 |     
  205 |     // Navigate back to dashboard
  206 |     await page.goto('/dashboard');
  207 |     
  208 |     // Should still see MEXC data but now with user context
  209 |     await expect(page.locator('text=MEXC API Status')).toBeVisible();
  210 |     await expect(page.locator(`text=${testEmail}`)).toBeVisible();
  211 |   });
  212 |
  213 |   test('Pattern sniper respects user authentication', async ({ page }) => {
  214 |     const testEmail = `sniper-test-${Date.now()}@example.com`;
  215 |     
  216 |     // Sign up a user
  217 |     await signUpUser(page, testEmail, 'TestPassword123!', 'Sniper Test User');
  218 |     
  219 |     // Navigate to dashboard
  220 |     await page.goto('/dashboard');
  221 |     
  222 |     // Check pattern sniper status
  223 |     await expect(page.locator('text=Pattern Sniper')).toBeVisible();
  224 |     
  225 |     // Should show controls for authenticated user
> 226 |     await expect(page.locator('button:has-text("Start Pattern Sniper")')).toBeVisible();
      |                                                                           ^ Error: Timed out 5000ms waiting for expect(locator).toBeVisible()
  227 |     
  228 |     // User badge should be visible
  229 |     await expect(page.locator(`text=${testEmail}`)).toBeVisible();
  230 |   });
  231 |
  232 |   test('Workflow system shows user-specific status', async ({ page }) => {
  233 |     const testEmail = `workflow-test-${Date.now()}@example.com`;
  234 |     
  235 |     // Sign up a user
  236 |     await signUpUser(page, testEmail, 'TestPassword123!', 'Workflow Test User');
  237 |     
  238 |     // Navigate to dashboard
  239 |     await page.goto('/dashboard');
  240 |     
  241 |     // Check workflow status cards
  242 |     await expect(page.locator('text=Ready to Snipe')).toBeVisible();
  243 |     await expect(page.locator('text=Monitoring')).toBeVisible();
  244 |     await expect(page.locator('text=Executed Snipes')).toBeVisible();
  245 |     
  246 |     // Should show user-specific metrics (even if 0)
  247 |     await expect(page.locator('text=0')).toBeVisible(); // Initial counts should be 0
  248 |   });
  249 |
  250 |   test('Emergency dashboard works with authenticated users', async ({ page }) => {
  251 |     const testEmail = `emergency-test-${Date.now()}@example.com`;
  252 |     
  253 |     // Sign up a user
  254 |     await signUpUser(page, testEmail, 'TestPassword123!', 'Emergency Test User');
  255 |     
  256 |     // Navigate to dashboard
  257 |     await page.goto('/dashboard');
  258 |     
  259 |     // Scroll to emergency dashboard
  260 |     await page.locator('text=Emergency Response Dashboard').scrollIntoViewIfNeeded();
  261 |     
  262 |     // Should be visible for authenticated users
  263 |     await expect(page.locator('text=Emergency Response Dashboard')).toBeVisible();
  264 |   });
  265 | });
```