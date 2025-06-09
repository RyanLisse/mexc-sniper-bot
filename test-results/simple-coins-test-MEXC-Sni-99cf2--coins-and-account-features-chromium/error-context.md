# Test info

- Name: MEXC Sniper Bot - Latest Coins Verification >> should display trading dashboard with latest coins and account features
- Location: /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/simple-coins-test.spec.ts:4:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('text=Trading Dashboard') to be visible

    at /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/simple-coins-test.spec.ts:12:16
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
   1 | import { test, expect } from '@playwright/test';
   2 |
   3 | test.describe('MEXC Sniper Bot - Latest Coins Verification', () => {
   4 |   test('should display trading dashboard with latest coins and account features', async ({ page }) => {
   5 |     console.log('🔍 Testing MEXC Trading Dashboard functionality...');
   6 |     
   7 |     // Navigate to dashboard
   8 |     await page.goto('/dashboard');
   9 |     await page.waitForLoadState('networkidle');
   10 |     
   11 |     // Wait for dashboard to load
>  12 |     await page.waitForSelector('text=Trading Dashboard', { timeout: 15000 });
      |                ^ TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
   13 |     console.log('✅ Dashboard loaded successfully');
   14 |     
   15 |     // Check for calendar section
   16 |     const calendarSection = page.locator('text=Coin Listings Calendar');
   17 |     await expect(calendarSection).toBeVisible({ timeout: 10000 });
   18 |     console.log('✅ Coin Calendar section found');
   19 |     
   20 |     // Look for calendar listings count
   21 |     const calendarBadge = page.locator('text=/\\d+ listings/');
   22 |     if (await calendarBadge.count() > 0) {
   23 |       const badgeText = await calendarBadge.textContent();
   24 |       console.log(`📅 Calendar listings: ${badgeText}`);
   25 |     }
   26 |     
   27 |     // Look for MEXC API status
   28 |     const apiStatus = page.locator('text=MEXC API Status');
   29 |     await expect(apiStatus).toBeVisible();
   30 |     console.log('✅ MEXC API Status section found');
   31 |     
   32 |     // Check API connection indicator
   33 |     const connectedIndicator = page.locator('text=Connected');
   34 |     if (await connectedIndicator.count() > 0) {
   35 |       console.log('✅ MEXC API is connected');
   36 |     } else {
   37 |       console.log('⚠️ MEXC API connection status unclear');
   38 |     }
   39 |     
   40 |     // Look for preferences button
   41 |     const preferencesButton = page.locator('button:has-text("Show Preferences")');
   42 |     if (await preferencesButton.count() > 0) {
   43 |       console.log('⚙️ Preferences button found, clicking...');
   44 |       await preferencesButton.click();
   45 |       await page.waitForTimeout(2000);
   46 |       
   47 |       // Check for trading configuration
   48 |       const tradingConfig = page.locator('text=Trading Configuration');
   49 |       if (await tradingConfig.count() > 0) {
   50 |         console.log('✅ Trading Configuration panel visible');
   51 |         
   52 |         // Look for buy amount settings
   53 |         const buyAmountInputs = page.locator('input[type="number"]');
   54 |         const inputCount = await buyAmountInputs.count();
   55 |         console.log(`💰 Found ${inputCount} numeric input fields (likely for trading amounts)`);
   56 |         
   57 |         if (inputCount > 0) {
   58 |           for (let i = 0; i < Math.min(inputCount, 3); i++) {
   59 |             const input = buyAmountInputs.nth(i);
   60 |             const value = await input.inputValue();
   61 |             if (value) {
   62 |               console.log(`📊 Trading amount field ${i + 1}: ${value}`);
   63 |             }
   64 |           }
   65 |         }
   66 |       }
   67 |       
   68 |       // Check for API configuration
   69 |       const apiConfig = page.locator('text=API Configuration');
   70 |       if (await apiConfig.count() > 0) {
   71 |         console.log('✅ API Configuration panel visible');
   72 |       }
   73 |     }
   74 |     
   75 |     // Look for pattern detection elements
   76 |     const patternElements = page.locator('text=Ready to Snipe');
   77 |     if (await patternElements.count() > 0) {
   78 |       console.log('✅ Pattern detection system found');
   79 |       
   80 |       // Check for ready state pattern mention
   81 |       const readyPattern = page.locator('text=sts:2, st:2, tt:4');
   82 |       if (await readyPattern.count() > 0) {
   83 |         console.log('✅ Ready state pattern (sts:2, st:2, tt:4) displayed');
   84 |       }
   85 |     }
   86 |     
   87 |     // Look for monitoring section
   88 |     const monitoringSection = page.locator('text=Monitoring');
   89 |     if (await monitoringSection.count() > 0) {
   90 |       console.log('✅ Monitoring section found');
   91 |     }
   92 |     
   93 |     // Check for system health indicators
   94 |     const systemHealth = page.locator('text=System Health');
   95 |     if (await systemHealth.count() > 0) {
   96 |       console.log('✅ System Health section found');
   97 |     }
   98 |     
   99 |     // Verify pattern sniper status
  100 |     const patternSniper = page.locator('text=Pattern Sniper');
  101 |     if (await patternSniper.count() > 0) {
  102 |       console.log('✅ Pattern Sniper status indicator found');
  103 |     }
  104 |     
  105 |     // Take comprehensive screenshot
  106 |     await page.screenshot({ 
  107 |       path: 'dashboard-comprehensive-test.png', 
  108 |       fullPage: true 
  109 |     });
  110 |     console.log('📸 Comprehensive dashboard screenshot saved');
  111 |     
  112 |     // Final verification - check that we can see actual calendar data
```