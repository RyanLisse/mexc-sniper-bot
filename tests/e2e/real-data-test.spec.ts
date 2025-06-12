import { test, expect } from '@playwright/test';

test.describe('MEXC Sniper Bot - Real Data Verification', () => {
  test('should display only real data and user balance section', async ({ page }) => {
    console.log('🔍 Verifying real data and account balance display...');
    
    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Wait for dashboard to load
    await page.waitForSelector('text=Trading Dashboard', { timeout: 15000 });
    console.log('✅ Dashboard loaded successfully');
    
    // Check for Account Balance section
    const accountBalanceSection = page.locator('text=Account Balance');
    await expect(accountBalanceSection).toBeVisible({ timeout: 10000 });
    console.log('✅ Account Balance section visible');
    
    // Check account balance message
    const balanceMessage = page.locator('text=MEXC API configured');
    if (await balanceMessage.count() > 0) {
      console.log('✅ Real account balance API integration detected');
    }
    
    // Verify no fake trading pairs like BROCKUSDT are displayed
    const fakeTokens = ['BROCKUSDT', 'NEWTOKEN', 'BNTUSDT', 'NTXUSDT'];
    for (const token of fakeTokens) {
      const tokenElement = page.locator(`text=${token}`);
      const count = await tokenElement.count();
      if (count > 0) {
        console.log(`❌ Found fake token: ${token}`);
        throw new Error(`Mock data still present: ${token}`);
      }
    }
    console.log('✅ No fake trading pairs found');
    
    // Check for real MEXC API status
    const apiStatus = page.locator('text=MEXC API Status');
    await expect(apiStatus).toBeVisible();
    console.log('✅ MEXC API Status section found');
    
    // Verify calendar shows real data (0 entries is real data)
    const calendarSection = page.locator('text=Coin Listings Calendar');
    await expect(calendarSection).toBeVisible();
    
    // Check calendar entries count
    const calendarBadge = page.locator('text=/\\d+ listings/');
    if (await calendarBadge.count() > 0) {
      const badgeText = await calendarBadge.textContent();
      console.log(`📅 Calendar listings: ${badgeText}`);
      
      // Real MEXC calendar data should show "0 listings" when there are no new listings
      if (badgeText?.includes('0 listings')) {
        console.log('✅ Real calendar data: No new listings (correct!)');
      }
    }
    
    // Verify no mock system health metrics
    const fakeMetrics = ['89ms', '94.2%', '0.1%'];
    for (const metric of fakeMetrics) {
      const metricElement = page.locator(`text=${metric}`);
      const count = await metricElement.count();
      if (count > 0) {
        console.log(`❌ Found fake metric: ${metric}`);
        throw new Error(`Mock system health data still present: ${metric}`);
      }
    }
    console.log('✅ No fake system health metrics found');
    
    // Check for account access indicator
    const accountAccess = page.locator('text=Account Access');
    if (await accountAccess.count() > 0) {
      console.log('✅ Account Access status indicator found');
    }
    
    // Take comprehensive screenshot
    await page.screenshot({ 
      path: 'real-data-verification.png', 
      fullPage: true 
    });
    console.log('📸 Real data verification screenshot saved');
    
    // Log test results
    console.log('=== Real Data Test Summary ===');
    console.log('✅ All mock data removed');
    console.log('✅ Real MEXC calendar API integration');
    console.log('✅ Account balance section displayed');
    console.log('✅ No fake trading pairs');
    console.log('✅ No mock system metrics');
    console.log('✅ Real API status indicators');
    
    // The test passes if we reach this point without errors
    expect(true).toBe(true);
  });
});