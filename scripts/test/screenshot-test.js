const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  try {
    console.log('Navigating to dashboard...');
    await page.goto('http://localhost:3008/dashboard', { waitUntil: 'networkidle' });
    
    // Wait a bit for any dynamic content
    await page.waitForTimeout(3000);
    
    console.log('Taking screenshot...');
    await page.screenshot({ 
      path: 'dashboard-screenshot.png', 
      fullPage: true 
    });
    
    console.log('Screenshot saved as dashboard-screenshot.png');
    
    // Check if calendar component is visible
    const calendarVisible = await page.locator('[data-slot="card"]').first().isVisible();
    console.log('Calendar card visible:', calendarVisible);
    
    // Check for preset buttons
    const buttons = await page.locator('button:has-text("Today")').count();
    console.log('Found "Today" buttons:', buttons);
    
  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: 'error-screenshot.png' });
  } finally {
    await browser.close();
  }
})();