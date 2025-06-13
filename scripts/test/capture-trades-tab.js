const { chromium } = require('playwright');

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({
    headless: false,
    args: ['--window-size=1600,900']
  });

  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  try {
    console.log('Navigating to demo dashboard...');
    await page.goto('http://localhost:3008/demo-dashboard', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    console.log('Waiting for dashboard to load...');
    await page.waitForTimeout(3000);

    // Click on Recent Trades tab
    const tradesTab = await page.locator('button:has-text("Recent Trades")').first();
    if (await tradesTab.isVisible()) {
      console.log('Clicking Recent Trades tab...');
      await tradesTab.click();
      await page.waitForTimeout(2000);

      console.log('Taking screenshot of recent trades table...');
      await page.screenshot({ 
        path: 'docs/screenshots/recent-trades-table-view.png',
        fullPage: true
      });
    }

    console.log('Screenshot saved successfully!');

  } catch (error) {
    console.error('Error during screenshot capture:', error);
    
    // Take error screenshot
    await page.screenshot({ 
      path: 'docs/screenshots/trades-capture-error.png',
      fullPage: true
    });
    
    console.log('Current URL:', page.url());
  }

  await browser.close();
  console.log('Browser closed.');
})();