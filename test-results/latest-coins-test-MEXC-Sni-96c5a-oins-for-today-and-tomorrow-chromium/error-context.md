# Test info

- Name: MEXC Sniper Bot - Latest Coins and Account Balance Verification >> should display latest coins for today and tomorrow
- Location: /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/latest-coins-test.spec.ts:10:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('text=Trading Dashboard') to be visible

    at /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/latest-coins-test.spec.ts:14:16
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
   3 | test.describe('MEXC Sniper Bot - Latest Coins and Account Balance Verification', () => {
   4 |   test.beforeEach(async ({ page }) => {
   5 |     // Navigate to the dashboard
   6 |     await page.goto('/dashboard');
   7 |     await page.waitForLoadState('networkidle');
   8 |   });
   9 |
   10 |   test('should display latest coins for today and tomorrow', async ({ page }) => {
   11 |     console.log('🔍 Testing latest coins display for today and tomorrow...');
   12 |     
   13 |     // Wait for the page to load completely
>  14 |     await page.waitForSelector('text=Trading Dashboard', { timeout: 10000 });
      |                ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
   15 |     
   16 |     // Look for coin calendar section
   17 |     const upcomingCoinsSection = page.locator('text=Upcoming Coins').or(
   18 |       page.locator('[data-testid="upcoming-coins"]')
   19 |     ).or(
   20 |       page.locator('text=New Listings')
   21 |     ).or(
   22 |       page.locator('text=Calendar')
   23 |     );
   24 |     
   25 |     // Check if upcoming coins section exists
   26 |     if (await upcomingCoinsSection.count() > 0) {
   27 |       console.log('✅ Found upcoming coins section');
   28 |       await expect(upcomingCoinsSection.first()).toBeVisible();
   29 |       
   30 |       // Look for coin entries with today/tomorrow dates
   31 |       const today = new Date();
   32 |       const tomorrow = new Date(today);
   33 |       tomorrow.setDate(tomorrow.getDate() + 1);
   34 |       
   35 |       const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
   36 |       const tomorrowStr = tomorrow.toISOString().split('T')[0];
   37 |       
   38 |       console.log(`🗓️ Looking for coins launching today (${todayStr}) or tomorrow (${tomorrowStr})`);
   39 |       
   40 |       // Check for date indicators
   41 |       const dateElements = page.locator(`text="${todayStr}"`).or(
   42 |         page.locator(`text="${tomorrowStr}"`)
   43 |       ).or(
   44 |         page.locator('text="hours"')
   45 |       ).or(
   46 |         page.locator('text="minutes"')
   47 |       );
   48 |       
   49 |       const dateCount = await dateElements.count();
   50 |       console.log(`📅 Found ${dateCount} date/time indicators`);
   51 |       
   52 |       if (dateCount > 0) {
   53 |         console.log('✅ Found coins with today/tomorrow launch dates');
   54 |       } else {
   55 |         console.log('⚠️ No specific date indicators found, checking for coin list...');
   56 |         
   57 |         // Look for any coin symbols or names
   58 |         const coinSymbols = page.locator('[class*="symbol"]').or(
   59 |           page.locator('text="USDT"')
   60 |         ).or(
   61 |           page.locator('[data-testid*="coin"]')
   62 |         );
   63 |         
   64 |         const symbolCount = await coinSymbols.count();
   65 |         console.log(`🪙 Found ${symbolCount} coin-related elements`);
   66 |         
   67 |         if (symbolCount > 0) {
   68 |           console.log('✅ Found coin listings');
   69 |           const firstCoin = coinSymbols.first();
   70 |           const coinText = await firstCoin.textContent();
   71 |           console.log(`🎯 Example coin: ${coinText}`);
   72 |         }
   73 |       }
   74 |     } else {
   75 |       console.log('⚠️ Upcoming coins section not found, checking for refresh button...');
   76 |       
   77 |       // Look for refresh calendar button
   78 |       const refreshButton = page.locator('button:has-text("Refresh Calendar")').or(
   79 |         page.locator('button:has-text("Refresh")')
   80 |       ).or(
   81 |         page.locator('[data-testid="refresh-calendar"]')
   82 |       );
   83 |       
   84 |       if (await refreshButton.count() > 0) {
   85 |         console.log('🔄 Found refresh button, clicking to load latest data...');
   86 |         await refreshButton.first().click();
   87 |         
   88 |         // Wait for refresh to complete
   89 |         await page.waitForTimeout(3000);
   90 |         
   91 |         // Check again for upcoming coins
   92 |         const refreshedContent = page.locator('text=Upcoming').or(
   93 |           page.locator('text=Calendar')
   94 |         ).or(
   95 |           page.locator('text=Listings')
   96 |         );
   97 |         
   98 |         if (await refreshedContent.count() > 0) {
   99 |           console.log('✅ Found content after refresh');
  100 |         }
  101 |       }
  102 |     }
  103 |     
  104 |     // Take screenshot for manual verification
  105 |     await page.screenshot({ 
  106 |       path: 'latest-coins-verification.png', 
  107 |       fullPage: true 
  108 |     });
  109 |     console.log('📸 Screenshot saved as latest-coins-verification.png');
  110 |   });
  111 |
  112 |   test('should show user account balance and trading preferences', async ({ page }) => {
  113 |     console.log('💰 Testing account balance and user preferences...');
  114 |     
```