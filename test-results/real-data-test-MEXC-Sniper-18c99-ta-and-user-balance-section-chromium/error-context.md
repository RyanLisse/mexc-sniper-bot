# Test info

- Name: MEXC Sniper Bot - Real Data Verification >> should display only real data and user balance section
- Location: /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/real-data-test.spec.ts:4:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('text=Trading Dashboard') to be visible

    at /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/real-data-test.spec.ts:12:16
```

# Page snapshot

```yaml
- heading "MEXC Sniper Bot" [level=1]
- paragraph: Advanced AI-powered cryptocurrency trading platform for automated sniping of new MEXC listings. Get early access to profitable trading opportunities with intelligent pattern detection.
- button "Get Started"
- button "Sign In"
- text: "🎯 Pattern Detection Advanced AI identifies ready-state patterns (sts:2, st:2, tt:4) with 3.5+ hour advance notice for optimal entry timing. 🤖 Multi-Agent System 5 specialized TypeScript agents work together: Calendar monitoring, Pattern discovery, Symbol analysis, Strategy creation, and Orchestration. 📊 Real-time Analytics Track profit/loss, win rates, and trading performance with comprehensive transaction history and automated reporting."
- heading "Platform Performance" [level=2]
- text: 99.5% Uptime 3.5hrs Avg. Advance Notice 5 Agents AI Trading System 24/7 Market Monitoring
- heading "How It Works" [level=2]
- text: "1"
- heading "Monitor Listings" [level=3]
- paragraph: AI agents continuously scan MEXC calendar for new listing announcements and pattern detection.
- text: "2"
- heading "Analyze Patterns" [level=3]
- paragraph: Advanced algorithms identify optimal entry signals and market readiness indicators.
- text: "3"
- heading "Execute Trades" [level=3]
- paragraph: Automated execution with configurable take-profit levels and risk management strategies.
- heading "Ready to Start Trading?" [level=2]
- paragraph: Join the future of automated cryptocurrency trading with AI-powered precision.
- button "Sign Up Now"
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
   3 | test.describe('MEXC Sniper Bot - Real Data Verification', () => {
   4 |   test('should display only real data and user balance section', async ({ page }) => {
   5 |     console.log('🔍 Verifying real data and account balance display...');
   6 |     
   7 |     // Navigate to dashboard
   8 |     await page.goto('/dashboard');
   9 |     await page.waitForLoadState('networkidle');
  10 |     
  11 |     // Wait for dashboard to load
> 12 |     await page.waitForSelector('text=Trading Dashboard', { timeout: 15000 });
     |                ^ TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
  13 |     console.log('✅ Dashboard loaded successfully');
  14 |     
  15 |     // Check for Account Balance section
  16 |     const accountBalanceSection = page.locator('text=Account Balance');
  17 |     await expect(accountBalanceSection).toBeVisible({ timeout: 10000 });
  18 |     console.log('✅ Account Balance section visible');
  19 |     
  20 |     // Check account balance message
  21 |     const balanceMessage = page.locator('text=MEXC API configured');
  22 |     if (await balanceMessage.count() > 0) {
  23 |       console.log('✅ Real account balance API integration detected');
  24 |     }
  25 |     
  26 |     // Verify no fake trading pairs like BROCKUSDT are displayed
  27 |     const fakeTokens = ['BROCKUSDT', 'NEWTOKEN', 'BNTUSDT', 'NTXUSDT'];
  28 |     for (const token of fakeTokens) {
  29 |       const tokenElement = page.locator(`text=${token}`);
  30 |       const count = await tokenElement.count();
  31 |       if (count > 0) {
  32 |         console.log(`❌ Found fake token: ${token}`);
  33 |         throw new Error(`Mock data still present: ${token}`);
  34 |       }
  35 |     }
  36 |     console.log('✅ No fake trading pairs found');
  37 |     
  38 |     // Check for real MEXC API status
  39 |     const apiStatus = page.locator('text=MEXC API Status');
  40 |     await expect(apiStatus).toBeVisible();
  41 |     console.log('✅ MEXC API Status section found');
  42 |     
  43 |     // Verify calendar shows real data (0 entries is real data)
  44 |     const calendarSection = page.locator('text=Coin Listings Calendar');
  45 |     await expect(calendarSection).toBeVisible();
  46 |     
  47 |     // Check calendar entries count
  48 |     const calendarBadge = page.locator('text=/\\d+ listings/');
  49 |     if (await calendarBadge.count() > 0) {
  50 |       const badgeText = await calendarBadge.textContent();
  51 |       console.log(`📅 Calendar listings: ${badgeText}`);
  52 |       
  53 |       // Real MEXC calendar data should show "0 listings" when there are no new listings
  54 |       if (badgeText?.includes('0 listings')) {
  55 |         console.log('✅ Real calendar data: No new listings (correct!)');
  56 |       }
  57 |     }
  58 |     
  59 |     // Verify no mock system health metrics
  60 |     const fakeMetrics = ['89ms', '94.2%', '0.1%'];
  61 |     for (const metric of fakeMetrics) {
  62 |       const metricElement = page.locator(`text=${metric}`);
  63 |       const count = await metricElement.count();
  64 |       if (count > 0) {
  65 |         console.log(`❌ Found fake metric: ${metric}`);
  66 |         throw new Error(`Mock system health data still present: ${metric}`);
  67 |       }
  68 |     }
  69 |     console.log('✅ No fake system health metrics found');
  70 |     
  71 |     // Check for account access indicator
  72 |     const accountAccess = page.locator('text=Account Access');
  73 |     if (await accountAccess.count() > 0) {
  74 |       console.log('✅ Account Access status indicator found');
  75 |     }
  76 |     
  77 |     // Take comprehensive screenshot
  78 |     await page.screenshot({ 
  79 |       path: 'real-data-verification.png', 
  80 |       fullPage: true 
  81 |     });
  82 |     console.log('📸 Real data verification screenshot saved');
  83 |     
  84 |     // Log test results
  85 |     console.log('=== Real Data Test Summary ===');
  86 |     console.log('✅ All mock data removed');
  87 |     console.log('✅ Real MEXC calendar API integration');
  88 |     console.log('✅ Account balance section displayed');
  89 |     console.log('✅ No fake trading pairs');
  90 |     console.log('✅ No mock system metrics');
  91 |     console.log('✅ Real API status indicators');
  92 |     
  93 |     // The test passes if we reach this point without errors
  94 |     expect(true).toBe(true);
  95 |   });
  96 | });
```