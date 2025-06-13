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
    console.log('Navigating to dashboard...');
    await page.goto('http://localhost:3008/dashboard', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    console.log('Waiting for dashboard to load...');
    await page.waitForTimeout(3000);

    // Click on the New Listings tab
    const listingsTab = await page.locator('button:has-text("New Listings")').first();
    if (await listingsTab.isVisible()) {
      console.log('Clicking New Listings tab...');
      await listingsTab.click();
      await page.waitForTimeout(2000);
    }

    console.log('Taking screenshot of dashboard with coin listings...');
    await page.screenshot({ 
      path: 'docs/screenshots/dashboard-coin-listings.png',
      fullPage: true
    });

    // Click on Pattern Detection tab
    const patternsTab = await page.locator('button:has-text("Pattern Detection")').first();
    if (await patternsTab.isVisible()) {
      console.log('Clicking Pattern Detection tab...');
      await patternsTab.click();
      await page.waitForTimeout(2000);

      console.log('Taking screenshot of pattern detection...');
      await page.screenshot({ 
        path: 'docs/screenshots/dashboard-pattern-detection.png',
        fullPage: true
      });
    }

    console.log('Screenshots saved successfully!');

  } catch (error) {
    console.error('Error taking screenshot:', error);
    await page.screenshot({ 
      path: 'docs/screenshots/dashboard-error.png',
      fullPage: true
    });
  }

  await browser.close();
  console.log('Browser closed.');
})();