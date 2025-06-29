import { expect, test } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

// Create screenshots directory
const screenshotsDir = path.join(process.cwd(), 'test-screenshots');

test.beforeAll(async () => {
  try {
    await fs.mkdir(screenshotsDir, { recursive: true });
  } catch (error) {
    console.log('Screenshots directory already exists or error creating it');
  }
});

test.describe('MEXC Sniper Bot Visual Inspection', () => {
  test.setTimeout(60000); // 60 second timeout

  test('Homepage inspection', async ({ page }) => {
    // Navigate to homepage
    console.log('Navigating to homepage...');
    const response = await page.goto('http://localhost:3008', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    // Check response status
    if (response) {
      console.log(`Homepage status: ${response.status()}`);
    }

    // Wait for page to be fully loaded
    await page.waitForLoadState('domcontentloaded');
    
    // Capture console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture network failures
    const networkFailures: string[] = [];
    page.on('requestfailed', request => {
      networkFailures.push(`${request.failure()?.errorText} - ${request.url()}`);
    });

    // Take screenshot
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'homepage.png'),
      fullPage: true 
    });

    // Check for basic elements
    const issues: string[] = [];

    // Check page title
    const title = await page.title();
    console.log(`Page title: ${title}`);

    // Check for main content
    try {
      const mainContent = await page.locator('main').isVisible();
      if (!mainContent) {
        issues.push('Main content area not found');
      }
    } catch (error) {
      issues.push('Error checking main content');
    }

    // Report findings
    console.log('\n=== HOMEPAGE INSPECTION ===');
    console.log(`Console errors: ${consoleErrors.length > 0 ? consoleErrors.join(', ') : 'None'}`);
    console.log(`Network failures: ${networkFailures.length > 0 ? networkFailures.join(', ') : 'None'}`);
    console.log(`Issues found: ${issues.length > 0 ? issues.join(', ') : 'None'}`);
  });

  test('Dashboard page inspection', async ({ page }) => {
    console.log('\nNavigating to dashboard...');
    
    // Try to navigate to dashboard
    const response = await page.goto('http://localhost:3008/dashboard', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    if (response) {
      console.log(`Dashboard status: ${response.status()}`);
    }

    await page.waitForLoadState('domcontentloaded');

    // Capture console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Take screenshot
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'dashboard.png'),
      fullPage: true 
    });

    // Check if redirected to auth
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('/auth')) {
      console.log('Dashboard redirected to auth page (authentication required)');
    }

    // Check for error messages
    const errorMessages = await page.locator('[role="alert"], .error, .error-message').allTextContents();
    if (errorMessages.length > 0) {
      console.log(`Error messages found: ${errorMessages.join(', ')}`);
    }

    console.log('\n=== DASHBOARD INSPECTION ===');
    console.log(`Console errors: ${consoleErrors.length > 0 ? consoleErrors.join(', ') : 'None'}`);
  });

  test('Auth page inspection', async ({ page }) => {
    console.log('\nNavigating to auth page...');
    
    const response = await page.goto('http://localhost:3008/auth', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    if (response) {
      console.log(`Auth page status: ${response.status()}`);
    }

    await page.waitForLoadState('domcontentloaded');

    // Take screenshot
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'auth-page.png'),
      fullPage: true 
    });

    // Check for auth forms
    const issues: string[] = [];
    
    try {
      // Check for sign in elements
      const hasSignInForm = await page.locator('form').count() > 0;
      const hasEmailInput = await page.locator('input[type="email"], input[name="email"]').count() > 0;
      const hasPasswordInput = await page.locator('input[type="password"]').count() > 0;
      const hasSubmitButton = await page.locator('button[type="submit"]').count() > 0;

      if (!hasSignInForm) issues.push('No form found on auth page');
      if (!hasEmailInput) issues.push('No email input found');
      if (!hasPasswordInput) issues.push('No password input found');
      if (!hasSubmitButton) issues.push('No submit button found');

    } catch (error) {
      issues.push('Error checking auth form elements');
    }

    console.log('\n=== AUTH PAGE INSPECTION ===');
    console.log(`Issues found: ${issues.length > 0 ? issues.join(', ') : 'None'}`);
  });

  test('Navigation and interactions test', async ({ page }) => {
    console.log('\nTesting navigation...');
    
    // Start at homepage
    await page.goto('http://localhost:3008', { waitUntil: 'networkidle' });

    // Look for navigation elements
    const navLinks = await page.locator('nav a, header a').allTextContents();
    console.log(`Navigation links found: ${navLinks.length > 0 ? navLinks.join(', ') : 'None'}`);

    // Try clicking on dashboard link if it exists
    try {
      const dashboardLink = page.locator('a[href="/dashboard"], a:has-text("Dashboard")').first();
      if (await dashboardLink.isVisible()) {
        await dashboardLink.click();
        await page.waitForLoadState('networkidle');
        console.log(`Navigated to: ${page.url()}`);
        
        await page.screenshot({ 
          path: path.join(screenshotsDir, 'navigation-result.png'),
          fullPage: true 
        });
      }
    } catch (error) {
      console.log('Could not find or click dashboard link');
    }
  });

  test('Check for common UI issues', async ({ page }) => {
    console.log('\nChecking for common UI issues...');
    
    await page.goto('http://localhost:3008', { waitUntil: 'networkidle' });

    const issues: string[] = [];

    // Check viewport and responsive design
    const viewport = page.viewportSize();
    console.log(`Viewport size: ${viewport?.width}x${viewport?.height}`);

    // Check for broken images
    const images = await page.locator('img').all();
    for (const img of images) {
      const src = await img.getAttribute('src');
      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
      if (naturalWidth === 0 && src) {
        issues.push(`Broken image: ${src}`);
      }
    }

    // Check for layout issues
    const overlappingElements = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const overlaps: string[] = [];
      
      // Simple overlap detection (checking if elements are at exact same position)
      for (let i = 0; i < elements.length; i++) {
        const rect1 = elements[i].getBoundingClientRect();
        if (rect1.width === 0 || rect1.height === 0) continue;
        
        for (let j = i + 1; j < elements.length; j++) {
          const rect2 = elements[j].getBoundingClientRect();
          if (rect2.width === 0 || rect2.height === 0) continue;
          
          if (rect1.left === rect2.left && rect1.top === rect2.top && 
              rect1.width === rect2.width && rect1.height === rect2.height) {
            overlaps.push(`Potential overlap: ${elements[i].tagName} and ${elements[j].tagName}`);
          }
        }
      }
      return overlaps;
    });

    if (overlappingElements.length > 0) {
      issues.push(...overlappingElements.slice(0, 5)); // Limit to first 5
    }

    // Check for z-index issues
    const highZIndexElements = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const highZ: string[] = [];
      
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        const zIndex = parseInt(style.zIndex);
        if (zIndex > 1000) {
          highZ.push(`High z-index (${zIndex}) on ${el.tagName}.${el.className}`);
        }
      });
      
      return highZ;
    });

    if (highZIndexElements.length > 0) {
      issues.push(...highZIndexElements.slice(0, 3));
    }

    console.log('\n=== UI ISSUES CHECK ===');
    console.log(`Issues found: ${issues.length > 0 ? issues.join('\n') : 'None'}`);

    // Take a final screenshot with devtools open to show any console errors
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'final-state.png'),
      fullPage: true 
    });
  });

  test.afterAll(async () => {
    console.log('\n=== TEST SUMMARY ===');
    console.log(`Screenshots saved to: ${screenshotsDir}`);
    console.log('Screenshots taken:');
    console.log('- homepage.png');
    console.log('- dashboard.png');
    console.log('- auth-page.png');
    console.log('- navigation-result.png');
    console.log('- final-state.png');
  });
});