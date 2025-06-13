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
    // First, let's try to sign in with test credentials
    console.log('Navigating to auth page...');
    await page.goto('http://localhost:3008/auth', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    await page.waitForTimeout(2000);

    // Check if we have sign in form
    const emailInput = await page.locator('input[type="email"]').first();
    if (await emailInput.isVisible()) {
      console.log('Filling in test credentials...');
      await emailInput.fill('test@example.com');
      
      const passwordInput = await page.locator('input[type="password"]').first();
      await passwordInput.fill('testpassword123');
      
      const signInButton = await page.locator('button:has-text("Sign in")').first();
      await signInButton.click();
      
      console.log('Attempting to sign in...');
      await page.waitForTimeout(3000);
    }

    // Now try to access dashboard
    console.log('Navigating to dashboard...');
    await page.goto('http://localhost:3008/dashboard', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    console.log('Waiting for dashboard to load...');
    await page.waitForTimeout(3000);

    // Take screenshot of overview
    console.log('Taking screenshot of dashboard overview...');
    await page.screenshot({ 
      path: 'docs/screenshots/dashboard-overview-integrated.png',
      fullPage: true
    });

    // Click on the New Listings tab
    const listingsTab = await page.locator('button:has-text("New Listings")').first();
    if (await listingsTab.isVisible()) {
      console.log('Clicking New Listings tab...');
      await listingsTab.click();
      await page.waitForTimeout(2000);

      console.log('Taking screenshot of coin listings...');
      await page.screenshot({ 
        path: 'docs/screenshots/dashboard-coin-listings-integrated.png',
        fullPage: true
      });
    }

    // Click on Pattern Detection tab
    const patternsTab = await page.locator('button:has-text("Pattern Detection")').first();
    if (await patternsTab.isVisible()) {
      console.log('Clicking Pattern Detection tab...');
      await patternsTab.click();
      await page.waitForTimeout(2000);

      console.log('Taking screenshot of pattern detection...');
      await page.screenshot({ 
        path: 'docs/screenshots/dashboard-pattern-detection-integrated.png',
        fullPage: true
      });
    }

    console.log('All screenshots saved successfully!');

  } catch (error) {
    console.error('Error during process:', error);
    
    // Take error screenshot
    await page.screenshot({ 
      path: 'docs/screenshots/dashboard-capture-error.png',
      fullPage: true
    });
    
    // Also capture console logs
    console.log('Current URL:', page.url());
  }

  await browser.close();
  console.log('Browser closed.');
})();