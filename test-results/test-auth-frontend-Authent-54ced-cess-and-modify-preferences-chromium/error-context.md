# Test info

- Name: Authentication Frontend Integration >> Authenticated user can access and modify preferences
- Location: /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/test-auth-frontend.spec.ts:98:7

# Error details

```
Error: expect.toBeVisible: Error: strict mode violation: locator('text=5%') resolved to 8 elements:
    1) <div class="text-2xl font-bold text-green-400">15%</div> aka getByText('15%').first()
    2) <div class="text-xs text-slate-400 mt-1">15% - Safe, quick profits</div> aka getByText('% - Safe, quick profits')
    3) <div class="text-2xl font-bold text-green-400">15%</div> aka getByText('15%').nth(2)
    4) <div class="text-xs text-slate-400 mt-1">15% - Higher risk, higher reward</div> aka getByText('% - Higher risk, higher reward')
    5) <div class="text-2xl font-bold text-green-400">25%</div> aka getByText('25%', { exact: true })
    6) <div class="text-xs text-slate-400 mt-1">25% - Maximum profit potential</div> aka getByText('% - Maximum profit potential')
    7) <div class="text-lg font-semibold text-red-500">5%</div> aka getByText('5%', { exact: true })
    8) <div class="text-xs text-slate-500 mt-2 font-mono">Data: {"memoryUsage":"95%","cpuUsage":"90%"}</div> aka getByText('Data: {"memoryUsage":"95%","')

Call log:
  - expect.toBeVisible with timeout 5000ms
  - waiting for locator('text=5%')

    at /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/test-auth-frontend.spec.ts:117:43
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
  - text: "Last updated: 11:44:49 AM"
  - button
  - link "Settings":
    - /url: /config
    - button "Settings"
- text: System Control Manage pattern discovery and monitoring systems
- button "Hide Preferences"
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
- text: Take Profit Levels Configure your default take profit percentages for different risk levels Conservative 15% 15% - Safe, quick profits Balanced Default 10% 10% - Balanced risk/reward Aggressive 15% 15% - Higher risk, higher reward Very Aggressive 25% 25% - Maximum profit potential Custom Level (Optional) Not set
- button "Edit Levels"
- text: Trading Configuration Your current trading setup and risk management settings Default Buy Amount $100 USDT Max Concurrent Snipes 3 Stop Loss 5% Risk Tolerance MEDIUM Ready State Pattern sts:2, st:2, tt:4 Target Advance Notice 3.5 hours MEXC API Configuration Securely store your MEXC API credentials for automated trading. Your keys are encrypted and stored locally. Account Balance
- button "Auto"
- button
- button [disabled]
- text: MEXC API Status
- paragraph: API Connection
- paragraph: Connected
- paragraph: Calendar Data
- paragraph: 136 entries
- paragraph: Account Access
- paragraph: Configured
- text: Coin Listings Calendar 136 listings View coin listings by date - check today, tomorrow, or any future date Select Date Choose a date to view coin listings. Today and tomorrow are highlighted. June 2025
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
- text: Coin Listings Listings for Today LAY Loomlay 12:00:00 PM SKATE Skate 12:00:00 PM MSDG MSDG 10:00:00 AM TAG Tagger 4:00:00 AM EGL1 EGL1 3:50:00 AM 🚨 Emergency Response Dashboard healthy Database healthy MEXC API healthy OpenAI API healthy Memory 82MB
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
- text: "Data: {\"connectionLost\":true,\"lastSuccessfulQuery\":1749462251208}"
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
   30 |   await page.goto('/auth');
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
> 117 |     await expect(page.locator('text=5%')).toBeVisible(); // Level 1
      |                                           ^ Error: expect.toBeVisible: Error: strict mode violation: locator('text=5%') resolved to 8 elements:
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
```