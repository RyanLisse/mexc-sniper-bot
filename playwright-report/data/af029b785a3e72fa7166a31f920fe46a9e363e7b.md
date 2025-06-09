# Test info

- Name: MEXC Sniper Bot - Latest Coins and Account Balance Verification >> should verify real-time data updates
- Location: /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/latest-coins-test.spec.ts:236:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('text=Trading Dashboard') to be visible

    at /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/latest-coins-test.spec.ts:239:16
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
  217 |         url.includes('balance') || 
  218 |         url.includes('account') || 
  219 |         url.includes('user-preferences')
  220 |       )) {
  221 |         console.log(`📡 API call detected: ${response.status()} ${url}`);
  222 |       }
  223 |     });
  224 |     
  225 |     // Wait for any API calls to complete
  226 |     await page.waitForTimeout(2000);
  227 |     
  228 |     // Take screenshot for verification
  229 |     await page.screenshot({ 
  230 |       path: 'account-balance-verification.png', 
  231 |       fullPage: true 
  232 |     });
  233 |     console.log('📸 Screenshot saved as account-balance-verification.png');
  234 |   });
  235 |
  236 |   test('should verify real-time data updates', async ({ page }) => {
  237 |     console.log('🔄 Testing real-time data updates...');
  238 |     
> 239 |     await page.waitForSelector('text=Trading Dashboard', { timeout: 10000 });
      |                ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
  240 |     
  241 |     // Check for any auto-updating elements
  242 |     const autoUpdateElements = page.locator('[data-testid*="auto-update"]').or(
  243 |       page.locator('text="last updated"')
  244 |     ).or(
  245 |       page.locator('text="ago"')
  246 |     ).or(
  247 |       page.locator('[class*="timestamp"]')
  248 |     );
  249 |     
  250 |     const updateCount = await autoUpdateElements.count();
  251 |     console.log(`⏰ Found ${updateCount} elements that might auto-update`);
  252 |     
  253 |     // Wait and check for changes
  254 |     if (updateCount > 0) {
  255 |       const initialText = await autoUpdateElements.first().textContent();
  256 |       console.log(`📊 Initial timestamp: ${initialText}`);
  257 |       
  258 |       // Wait for potential update
  259 |       await page.waitForTimeout(5000);
  260 |       
  261 |       const updatedText = await autoUpdateElements.first().textContent();
  262 |       console.log(`📊 After 5s timestamp: ${updatedText}`);
  263 |       
  264 |       if (initialText !== updatedText) {
  265 |         console.log('✅ Real-time updates detected!');
  266 |       } else {
  267 |         console.log('ℹ️ No timestamp changes detected in 5 seconds');
  268 |       }
  269 |     }
  270 |     
  271 |     // Check API health
  272 |     const healthStatus = page.locator('text="Connected"').or(
  273 |       page.locator('text="Online"')
  274 |     ).or(
  275 |       page.locator('[class*="status-connected"]')
  276 |     ).or(
  277 |       page.locator('text="Operational"')
  278 |     );
  279 |     
  280 |     const healthCount = await healthStatus.count();
  281 |     console.log(`💚 Found ${healthCount} health/connection status indicators`);
  282 |     
  283 |     if (healthCount > 0) {
  284 |       const status = await healthStatus.first().textContent();
  285 |       console.log(`🔗 Connection status: ${status}`);
  286 |     }
  287 |   });
  288 |
  289 |   test('should display pattern detection and trading signals', async ({ page }) => {
  290 |     console.log('🎯 Testing pattern detection and trading signals...');
  291 |     
  292 |     await page.waitForSelector('text=Trading Dashboard', { timeout: 10000 });
  293 |     
  294 |     // Look for pattern-related elements
  295 |     const patternElements = page.locator('text="Pattern"').or(
  296 |       page.locator('text="Ready State"')
  297 |     ).or(
  298 |       page.locator('text="Signal"')
  299 |     ).or(
  300 |       page.locator('text="sts:2"')
  301 |     ).or(
  302 |       page.locator('[data-testid*="pattern"]')
  303 |     );
  304 |     
  305 |     const patternCount = await patternElements.count();
  306 |     console.log(`🎯 Found ${patternCount} pattern-related elements`);
  307 |     
  308 |     if (patternCount > 0) {
  309 |       for (let i = 0; i < Math.min(patternCount, 3); i++) {
  310 |         const element = patternElements.nth(i);
  311 |         const text = await element.textContent();
  312 |         console.log(`📊 Pattern element ${i + 1}: "${text}"`);
  313 |       }
  314 |     }
  315 |     
  316 |     // Look for confidence scores or percentages
  317 |     const confidenceElements = page.locator('text="%"').or(
  318 |       page.locator('text="confidence"')
  319 |     ).or(
  320 |       page.locator('text="score"')
  321 |     );
  322 |     
  323 |     const confidenceCount = await confidenceElements.count();
  324 |     console.log(`📈 Found ${confidenceCount} confidence/score indicators`);
  325 |     
  326 |     // Take final comprehensive screenshot
  327 |     await page.screenshot({ 
  328 |       path: 'pattern-detection-verification.png', 
  329 |       fullPage: true 
  330 |     });
  331 |     console.log('📸 Final screenshot saved as pattern-detection-verification.png');
  332 |   });
  333 | });
```