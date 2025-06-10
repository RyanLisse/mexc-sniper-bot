# Test info

- Name: MEXC Sniper Bot - Latest Coins and Account Balance Verification >> should show user account balance and trading preferences
- Location: /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/latest-coins-test.spec.ts:112:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('text=Trading Dashboard') to be visible

    at /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/latest-coins-test.spec.ts:116:16
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
  115 |     // Wait for dashboard to load
> 116 |     await page.waitForSelector('text=Trading Dashboard', { timeout: 10000 });
      |                ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
  117 |     
  118 |     // Look for preferences section or button
  119 |     const preferencesButton = page.locator('button:has-text("Preferences")').or(
  120 |       page.locator('button:has-text("Show Preferences")')
  121 |     ).or(
  122 |       page.locator('button:has-text("Settings")')
  123 |     ).or(
  124 |       page.locator('[data-testid="preferences-toggle"]')
  125 |     );
  126 |     
  127 |     let preferencesVisible = false;
  128 |     
  129 |     if (await preferencesButton.count() > 0) {
  130 |       console.log('⚙️ Found preferences button, clicking to show preferences...');
  131 |       await preferencesButton.first().click();
  132 |       await page.waitForTimeout(1000);
  133 |       preferencesVisible = true;
  134 |     } else {
  135 |       console.log('🔍 Looking for existing preferences section...');
  136 |       const preferencesSection = page.locator('text=Trading Configuration').or(
  137 |         page.locator('text=API Configuration')
  138 |       ).or(
  139 |         page.locator('text=User Preferences')
  140 |       );
  141 |       
  142 |       if (await preferencesSection.count() > 0) {
  143 |         preferencesVisible = true;
  144 |         console.log('✅ Found existing preferences section');
  145 |       }
  146 |     }
  147 |     
  148 |     if (preferencesVisible) {
  149 |       // Check for account balance or trading amount settings
  150 |       console.log('💵 Looking for account balance and trading settings...');
  151 |       
  152 |       // Look for balance-related elements
  153 |       const balanceElements = page.locator('text="balance"').or(
  154 |         page.locator('text="Balance"')
  155 |       ).or(
  156 |         page.locator('text="USDT"')
  157 |       ).or(
  158 |         page.locator('text="Amount"')
  159 |       ).or(
  160 |         page.locator('input[type="number"]')
  161 |       ).or(
  162 |         page.locator('text="Buy Amount"')
  163 |       );
  164 |       
  165 |       const balanceCount = await balanceElements.count();
  166 |       console.log(`💰 Found ${balanceCount} balance/amount related elements`);
  167 |       
  168 |       if (balanceCount > 0) {
  169 |         for (let i = 0; i < Math.min(balanceCount, 5); i++) {
  170 |           const element = balanceElements.nth(i);
  171 |           const text = await element.textContent();
  172 |           const value = await element.inputValue().catch(() => '');
  173 |           console.log(`📊 Balance element ${i + 1}: "${text}" ${value ? `(value: ${value})` : ''}`);
  174 |         }
  175 |       }
  176 |       
  177 |       // Look for trading configuration
  178 |       const tradingConfig = page.locator('text="Trading"').or(
  179 |         page.locator('text="Position"')
  180 |       ).or(
  181 |         page.locator('text="Risk"')
  182 |       ).or(
  183 |         page.locator('text="Profit"')
  184 |       );
  185 |       
  186 |       const configCount = await tradingConfig.count();
  187 |       console.log(`⚙️ Found ${configCount} trading configuration elements`);
  188 |       
  189 |       if (configCount > 0) {
  190 |         console.log('✅ Trading configuration is visible');
  191 |       }
  192 |       
  193 |       // Look for API key configuration
  194 |       const apiConfig = page.locator('text="API"').or(
  195 |         page.locator('text="Key"')
  196 |       ).or(
  197 |         page.locator('input[type="password"]')
  198 |       ).or(
  199 |         page.locator('text="MEXC"')
  200 |       );
  201 |       
  202 |       const apiCount = await apiConfig.count();
  203 |       console.log(`🔑 Found ${apiCount} API configuration elements`);
  204 |       
  205 |       if (apiCount > 0) {
  206 |         console.log('✅ API configuration is visible');
  207 |       }
  208 |     }
  209 |     
  210 |     // Check for real-time balance by looking at API calls
  211 |     console.log('🌐 Checking for real-time balance API calls...');
  212 |     
  213 |     // Monitor network requests for balance-related calls
  214 |     page.on('response', response => {
  215 |       const url = response.url();
  216 |       if (url.includes('/api/') && (
```