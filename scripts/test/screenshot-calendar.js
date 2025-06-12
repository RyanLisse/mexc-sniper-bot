const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 800, height: 600 }
  });
  const page = await context.newPage();

  try {
    const filePath = 'file://' + path.resolve('./test-calendar.html');
    console.log('Opening test calendar:', filePath);
    
    await page.goto(filePath);
    await page.waitForTimeout(2000);
    
    console.log('Taking screenshot...');
    await page.screenshot({ 
      path: 'calendar-component-screenshot.png',
      clip: { x: 0, y: 0, width: 400, height: 500 }
    });
    
    console.log('Screenshot saved as calendar-component-screenshot.png');
    
    // Check for preset buttons
    const buttons = await page.locator('button').count();
    console.log('Found buttons:', buttons);
    
    const buttonTexts = await page.locator('button').allTextContents();
    console.log('Button texts:', buttonTexts);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();