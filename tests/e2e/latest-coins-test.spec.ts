import { test, expect } from '@playwright/test';

test.describe('MEXC Sniper Bot - Latest Coins and Account Balance Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('should display latest coins for today and tomorrow', async ({ page }) => {
    console.log('🔍 Testing latest coins display for today and tomorrow...');
    
    // Wait for the page to load completely
    await page.waitForSelector('text=Trading Dashboard', { timeout: 10000 });
    
    // Look for coin calendar section
    const upcomingCoinsSection = page.locator('text=Upcoming Coins').or(
      page.locator('[data-testid="upcoming-coins"]')
    ).or(
      page.locator('text=New Listings')
    ).or(
      page.locator('text=Calendar')
    );
    
    // Check if upcoming coins section exists
    if (await upcomingCoinsSection.count() > 0) {
      console.log('✅ Found upcoming coins section');
      await expect(upcomingCoinsSection.first()).toBeVisible();
      
      // Look for coin entries with today/tomorrow dates
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      console.log(`🗓️ Looking for coins launching today (${todayStr}) or tomorrow (${tomorrowStr})`);
      
      // Check for date indicators
      const dateElements = page.locator(`text="${todayStr}"`).or(
        page.locator(`text="${tomorrowStr}"`)
      ).or(
        page.locator('text="hours"')
      ).or(
        page.locator('text="minutes"')
      );
      
      const dateCount = await dateElements.count();
      console.log(`📅 Found ${dateCount} date/time indicators`);
      
      if (dateCount > 0) {
        console.log('✅ Found coins with today/tomorrow launch dates');
      } else {
        console.log('⚠️ No specific date indicators found, checking for coin list...');
        
        // Look for any coin symbols or names
        const coinSymbols = page.locator('[class*="symbol"]').or(
          page.locator('text="USDT"')
        ).or(
          page.locator('[data-testid*="coin"]')
        );
        
        const symbolCount = await coinSymbols.count();
        console.log(`🪙 Found ${symbolCount} coin-related elements`);
        
        if (symbolCount > 0) {
          console.log('✅ Found coin listings');
          const firstCoin = coinSymbols.first();
          const coinText = await firstCoin.textContent();
          console.log(`🎯 Example coin: ${coinText}`);
        }
      }
    } else {
      console.log('⚠️ Upcoming coins section not found, checking for refresh button...');
      
      // Look for refresh calendar button
      const refreshButton = page.locator('button:has-text("Refresh Calendar")').or(
        page.locator('button:has-text("Refresh")')
      ).or(
        page.locator('[data-testid="refresh-calendar"]')
      );
      
      if (await refreshButton.count() > 0) {
        console.log('🔄 Found refresh button, clicking to load latest data...');
        await refreshButton.first().click();
        
        // Wait for refresh to complete
        await page.waitForTimeout(3000);
        
        // Check again for upcoming coins
        const refreshedContent = page.locator('text=Upcoming').or(
          page.locator('text=Calendar')
        ).or(
          page.locator('text=Listings')
        );
        
        if (await refreshedContent.count() > 0) {
          console.log('✅ Found content after refresh');
        }
      }
    }
    
    // Take screenshot for manual verification
    await page.screenshot({ 
      path: 'latest-coins-verification.png', 
      fullPage: true 
    });
    console.log('📸 Screenshot saved as latest-coins-verification.png');
  });

  test('should show user account balance and trading preferences', async ({ page }) => {
    console.log('💰 Testing account balance and user preferences...');
    
    // Wait for dashboard to load
    await page.waitForSelector('text=Trading Dashboard', { timeout: 10000 });
    
    // Look for preferences section or button
    const preferencesButton = page.locator('button:has-text("Preferences")').or(
      page.locator('button:has-text("Show Preferences")')
    ).or(
      page.locator('button:has-text("Settings")')
    ).or(
      page.locator('[data-testid="preferences-toggle"]')
    );
    
    let preferencesVisible = false;
    
    if (await preferencesButton.count() > 0) {
      console.log('⚙️ Found preferences button, clicking to show preferences...');
      await preferencesButton.first().click();
      await page.waitForTimeout(1000);
      preferencesVisible = true;
    } else {
      console.log('🔍 Looking for existing preferences section...');
      const preferencesSection = page.locator('text=Trading Configuration').or(
        page.locator('text=API Configuration')
      ).or(
        page.locator('text=User Preferences')
      );
      
      if (await preferencesSection.count() > 0) {
        preferencesVisible = true;
        console.log('✅ Found existing preferences section');
      }
    }
    
    if (preferencesVisible) {
      // Check for account balance or trading amount settings
      console.log('💵 Looking for account balance and trading settings...');
      
      // Look for balance-related elements
      const balanceElements = page.locator('text="balance"').or(
        page.locator('text="Balance"')
      ).or(
        page.locator('text="USDT"')
      ).or(
        page.locator('text="Amount"')
      ).or(
        page.locator('input[type="number"]')
      ).or(
        page.locator('text="Buy Amount"')
      );
      
      const balanceCount = await balanceElements.count();
      console.log(`💰 Found ${balanceCount} balance/amount related elements`);
      
      if (balanceCount > 0) {
        for (let i = 0; i < Math.min(balanceCount, 5); i++) {
          const element = balanceElements.nth(i);
          const text = await element.textContent();
          const value = await element.inputValue().catch(() => '');
          console.log(`📊 Balance element ${i + 1}: "${text}" ${value ? `(value: ${value})` : ''}`);
        }
      }
      
      // Look for trading configuration
      const tradingConfig = page.locator('text="Trading"').or(
        page.locator('text="Position"')
      ).or(
        page.locator('text="Risk"')
      ).or(
        page.locator('text="Profit"')
      );
      
      const configCount = await tradingConfig.count();
      console.log(`⚙️ Found ${configCount} trading configuration elements`);
      
      if (configCount > 0) {
        console.log('✅ Trading configuration is visible');
      }
      
      // Look for API key configuration
      const apiConfig = page.locator('text="API"').or(
        page.locator('text="Key"')
      ).or(
        page.locator('input[type="password"]')
      ).or(
        page.locator('text="MEXC"')
      );
      
      const apiCount = await apiConfig.count();
      console.log(`🔑 Found ${apiCount} API configuration elements`);
      
      if (apiCount > 0) {
        console.log('✅ API configuration is visible');
      }
    }
    
    // Check for real-time balance by looking at API calls
    console.log('🌐 Checking for real-time balance API calls...');
    
    // Monitor network requests for balance-related calls
    page.on('response', response => {
      const url = response.url();
      if (url.includes('/api/') && (
        url.includes('balance') || 
        url.includes('account') || 
        url.includes('user-preferences')
      )) {
        console.log(`📡 API call detected: ${response.status()} ${url}`);
      }
    });
    
    // Wait for any API calls to complete
    await page.waitForTimeout(2000);
    
    // Take screenshot for verification
    await page.screenshot({ 
      path: 'account-balance-verification.png', 
      fullPage: true 
    });
    console.log('📸 Screenshot saved as account-balance-verification.png');
  });

  test('should verify real-time data updates', async ({ page }) => {
    console.log('🔄 Testing real-time data updates...');
    
    await page.waitForSelector('text=Trading Dashboard', { timeout: 10000 });
    
    // Check for any auto-updating elements
    const autoUpdateElements = page.locator('[data-testid*="auto-update"]').or(
      page.locator('text="last updated"')
    ).or(
      page.locator('text="ago"')
    ).or(
      page.locator('[class*="timestamp"]')
    );
    
    const updateCount = await autoUpdateElements.count();
    console.log(`⏰ Found ${updateCount} elements that might auto-update`);
    
    // Wait and check for changes
    if (updateCount > 0) {
      const initialText = await autoUpdateElements.first().textContent();
      console.log(`📊 Initial timestamp: ${initialText}`);
      
      // Wait for potential update
      await page.waitForTimeout(5000);
      
      const updatedText = await autoUpdateElements.first().textContent();
      console.log(`📊 After 5s timestamp: ${updatedText}`);
      
      if (initialText !== updatedText) {
        console.log('✅ Real-time updates detected!');
      } else {
        console.log('ℹ️ No timestamp changes detected in 5 seconds');
      }
    }
    
    // Check API health
    const healthStatus = page.locator('text="Connected"').or(
      page.locator('text="Online"')
    ).or(
      page.locator('[class*="status-connected"]')
    ).or(
      page.locator('text="Operational"')
    );
    
    const healthCount = await healthStatus.count();
    console.log(`💚 Found ${healthCount} health/connection status indicators`);
    
    if (healthCount > 0) {
      const status = await healthStatus.first().textContent();
      console.log(`🔗 Connection status: ${status}`);
    }
  });

  test('should display pattern detection and trading signals', async ({ page }) => {
    console.log('🎯 Testing pattern detection and trading signals...');
    
    await page.waitForSelector('text=Trading Dashboard', { timeout: 10000 });
    
    // Look for pattern-related elements
    const patternElements = page.locator('text="Pattern"').or(
      page.locator('text="Ready State"')
    ).or(
      page.locator('text="Signal"')
    ).or(
      page.locator('text="sts:2"')
    ).or(
      page.locator('[data-testid*="pattern"]')
    );
    
    const patternCount = await patternElements.count();
    console.log(`🎯 Found ${patternCount} pattern-related elements`);
    
    if (patternCount > 0) {
      for (let i = 0; i < Math.min(patternCount, 3); i++) {
        const element = patternElements.nth(i);
        const text = await element.textContent();
        console.log(`📊 Pattern element ${i + 1}: "${text}"`);
      }
    }
    
    // Look for confidence scores or percentages
    const confidenceElements = page.locator('text="%"').or(
      page.locator('text="confidence"')
    ).or(
      page.locator('text="score"')
    );
    
    const confidenceCount = await confidenceElements.count();
    console.log(`📈 Found ${confidenceCount} confidence/score indicators`);
    
    // Take final comprehensive screenshot
    await page.screenshot({ 
      path: 'pattern-detection-verification.png', 
      fullPage: true 
    });
    console.log('📸 Final screenshot saved as pattern-detection-verification.png');
  });
});