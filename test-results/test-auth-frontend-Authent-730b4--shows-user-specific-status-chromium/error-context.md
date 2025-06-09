# Test info

- Name: Authentication Frontend Integration >> Workflow system shows user-specific status
- Location: /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/test-auth-frontend.spec.ts:232:7

# Error details

```
Error: expect.toBeVisible: Error: strict mode violation: locator('text=Monitoring') resolved to 3 elements:
    1) <p class="text-sm text-slate-400">Real-time monitoring and control</p> aka getByText('Real-time monitoring and')
    2) <div data-slot="card-description" class="text-muted-foreground text-sm">Manage pattern discovery and monitoring systems</div> aka getByText('Manage pattern discovery and')
    3) <p class="text-sm font-medium text-slate-400">Monitoring</p> aka getByText('Monitoring', { exact: true })

Call log:
  - expect.toBeVisible with timeout 5000ms
  - waiting for locator('text=Monitoring')

    at /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/test-auth-frontend.spec.ts:243:51
```

# Page snapshot

```yaml
- banner:
  - heading "Trading Dashboard" [level=1]
  - paragraph: Real-time monitoring and control
  - text: Anonymous
  - link "Sign In":
    - /url: /auth
    - button "Sign In"
  - text: "Last updated: 11:45:07 AM"
  - button
  - link "Settings":
    - /url: /config
    - button "Settings"
- text: System Control Manage pattern discovery and monitoring systems
- button "Show Preferences"
- button "Show Exit Strategies"
- button "Refresh MEXC Data"
- button "Stop Auto-Snipe"
- button "Force Refresh Data"
- button "Clear All Targets"
- paragraph: Auto-Snipe
- paragraph: Active
- paragraph: Auto-executing trades
- paragraph: Ready to Snipe
- paragraph: "0"
- paragraph: "Pattern: sts:2, st:2, tt:4"
- paragraph: Monitoring
- paragraph: "0"
- paragraph: Pending detection
- text: Pattern Sniper Performance Total Listings 0 Success Rate 0.0% System Uptime 0m 0s Detection Rate 0.0% Recent Activity
- paragraph: Watching symbol BTCUSDT (attempt 10)
- paragraph: 12 hours ago
- paragraph: Watching symbol BTCUSDT (attempt 10)
- paragraph: 12 hours ago
- paragraph: Watching symbol BTCUSDT (attempt 10)
- paragraph: 12 hours ago
- paragraph: Watching symbol BTCUSDT (attempt 10)
- paragraph: 12 hours ago
- paragraph: Watching symbol BTCUSDT (attempt 10)
- paragraph: 12 hours ago
- paragraph: Watching symbol BTCUSDT (attempt 10)
- paragraph: 12 hours ago
- paragraph: Watching symbol BTCUSDT (attempt 9)
- paragraph: 12 hours ago
- paragraph: Watching symbol BTCUSDT (attempt 10)
- paragraph: 12 hours ago
- paragraph: Watching symbol BTCUSDT (attempt 9)
- paragraph: 12 hours ago
- paragraph: Watching symbol BTCUSDT (attempt 10)
- paragraph: 12 hours ago
- text: Account Balance
- button "Auto"
- button
- button [disabled]
- text: MEXC API Status
- paragraph: API Connection
- paragraph: Connected
- paragraph: Calendar Data
- paragraph: Loading...
- paragraph: Account Access
- paragraph: Configured
- text: Coin Listings Calendar 0 listings View coin listings by date - check today, tomorrow, or any future date Select Date Choose a date to view coin listings. Today and tomorrow are highlighted. June 2025
- button "Go to previous month"
- button "Go to next month"
- grid "June 2025":
  - rowgroup:
    - row "Sunday Monday Tuesday Wednesday Thursday Friday Saturday":
      - columnheader "Sunday": Su
      - columnheader "Monday": Mo
      - columnheader "Tuesday": Tu
      - columnheader "Wednesday": We
      - columnheader "Thursday": Th
      - columnheader "Friday": Fr
      - columnheader "Saturday": Sa
  - rowgroup:
    - row "1 2 3 4 5 6 7":
      - gridcell "1"
      - gridcell "2"
      - gridcell "3"
      - gridcell "4"
      - gridcell "5"
      - gridcell "6"
      - gridcell "7"
    - row "8 9 10 11 12 13 14":
      - gridcell "8"
      - gridcell "9" [selected]
      - gridcell "10"
      - gridcell "11"
      - gridcell "12"
      - gridcell "13"
      - gridcell "14"
    - row "15 16 17 18 19 20 21":
      - gridcell "15"
      - gridcell "16"
      - gridcell "17"
      - gridcell "18"
      - gridcell "19"
      - gridcell "20"
      - gridcell "21"
    - row "22 23 24 25 26 27 28":
      - gridcell "22"
      - gridcell "23"
      - gridcell "24"
      - gridcell "25"
      - gridcell "26"
      - gridcell "27"
      - gridcell "28"
    - row "29 30 1 2 3 4 5":
      - gridcell "29"
      - gridcell "30"
      - gridcell "1"
      - gridcell "2"
      - gridcell "3"
      - gridcell "4"
      - gridcell "5"
- text: Coin Listings Listings for Today Loading MEXC data... 🚨 Emergency Response Dashboard healthy Database healthy MEXC API healthy OpenAI API healthy Memory 82MB
- heading "Emergency Response Tests" [level=3]
- heading [level=4]
- paragraph
- text: "Data: {\"affectedAPIs\":[\"mexc\",\"openai\"]}"
- button "Low"
- button "Medium"
- button "High"
- button "Critical"
- heading "High Volatility" [level=4]
- paragraph: Test volatility response mechanisms
- text: "Data: {\"affectedSymbols\":[\"BTCUSDT\",\"ETHUSDT\"],\"volatilityIncrease\":\"150%\"}"
- button "Low"
- button "Medium"
- button "High"
- button "Critical"
- heading "System Overload" [level=4]
- paragraph: Test resource management recovery
- text: "Data: {\"memoryUsage\":\"95%\",\"cpuUsage\":\"90%\"}"
- button "Low"
- button "Medium"
- button "High"
- button "Critical"
- heading "Database Failure" [level=4]
- paragraph: Test database recovery procedures
- text: "Data: {\"connectionLost\":true,\"lastSuccessfulQuery\":1749462274720}"
- button "Low"
- button "Medium"
- button "High"
- button "Critical"
- heading "Trading Anomaly" [level=4]
- paragraph: Test trading halt and investigation
- text: "Data: {\"anomalyType\":\"unusual_price_movement\",\"affectedSymbols\":[\"NEWCOIN\"]}"
- button "Low"
- button "Medium"
- button "High"
- button "Critical"
- button "🔄 Refresh System Health"
- heading "Live Trading Environment" [level=3]
- paragraph: This dashboard controls live trading systems. All actions will affect real trades and funds. Monitor system performance carefully and ensure proper risk management settings are in place.
- button "Open Tanstack query devtools":
  - img
- alert
- button "Open Next.js Dev Tools":
  - img
```

# Test source

```ts
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
  226 |     await expect(page.locator('button:has-text("Start Pattern Sniper")')).toBeVisible();
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
> 243 |     await expect(page.locator('text=Monitoring')).toBeVisible();
      |                                                   ^ Error: expect.toBeVisible: Error: strict mode violation: locator('text=Monitoring') resolved to 3 elements:
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