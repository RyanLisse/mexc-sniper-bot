const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  try {
    // Go to auth page
    await page.goto('http://localhost:3008/auth');
    await page.waitForLoadState('networkidle');

    // Click sign up
    await page.click('text=Create account here');
    await page.waitForTimeout(500);

    // Fill form
    const email = `test-${Date.now()}@example.com`;
    await page.fill('input[id="name"]', 'Test User');
    await page.fill('input[id="email"]', email);
    await page.fill('input[id="password"]', 'TestPassword123!');

    // Submit
    await page.click('button[type="submit"]:has-text("Create Account")');

    // Wait for dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for data to load

    // Take screenshot
    await page.screenshot({ 
      path: 'docs/screenshots/new-dashboard-ui.png', 
      fullPage: true 
    });

    console.log('✅ Screenshot saved to docs/screenshots/new-dashboard-ui.png');
    console.log(`📧 Created test user: ${email}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
})();