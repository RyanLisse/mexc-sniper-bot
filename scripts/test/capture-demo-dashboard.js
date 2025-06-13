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

    // Take screenshot of the coin listings (default tab)
    console.log('Taking screenshot of coin listings board...');
    await page.screenshot({ 
      path: 'docs/screenshots/coin-listings-board-integrated.png',
      fullPage: true
    });

    // Click on Pattern Detection tab
    const patternsTab = await page.locator('button:has-text("Pattern Detection")').first();
    if (await patternsTab.isVisible()) {
      console.log('Clicking Pattern Detection tab...');
      await patternsTab.click();
      await page.waitForTimeout(2000);

      console.log('Taking screenshot of pattern detection view...');
      await page.screenshot({ 
        path: 'docs/screenshots/pattern-detection-integrated.png',
        fullPage: true
      });
    }

    // Click on Active Targets tab
    const targetsTab = await page.locator('button:has-text("Active Targets")').first();
    if (await targetsTab.isVisible()) {
      console.log('Clicking Active Targets tab...');
      await targetsTab.click();
      await page.waitForTimeout(2000);

      console.log('Taking screenshot of active targets...');
      await page.screenshot({ 
        path: 'docs/screenshots/active-targets-view.png',
        fullPage: true
      });
    }

    // Click on Overview tab
    const overviewTab = await page.locator('button:has-text("Overview")').first();
    if (await overviewTab.isVisible()) {
      console.log('Clicking Overview tab...');
      await overviewTab.click();
      await page.waitForTimeout(2000);

      console.log('Taking screenshot of overview...');
      await page.screenshot({ 
        path: 'docs/screenshots/dashboard-overview-complete.png',
        fullPage: true
      });
    }

    console.log('All screenshots saved successfully!');

  } catch (error) {
    console.error('Error during screenshot capture:', error);
    
    // Take error screenshot
    await page.screenshot({ 
      path: 'docs/screenshots/demo-dashboard-error.png',
      fullPage: true
    });
    
    console.log('Current URL:', page.url());
    console.log('Error details:', error.message);
  }

  await browser.close();
  console.log('Browser closed.');
})();