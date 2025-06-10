# Test info

- Name: MEXC Sniper Bot - Latest Coins and Account Balance Verification >> should display pattern detection and trading signals
- Location: /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/latest-coins-test.spec.ts:289:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('text=Trading Dashboard') to be visible

    at /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/latest-coins-test.spec.ts:292:16
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
  239 |     await page.waitForSelector('text=Trading Dashboard', { timeout: 10000 });
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
> 292 |     await page.waitForSelector('text=Trading Dashboard', { timeout: 10000 });
      |                ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
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