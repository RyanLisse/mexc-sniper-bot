import { test, expect } from '@playwright/test';

test.describe('MEXC Sniper Bot - Homepage', () => {
  test('should display homepage with MEXC Sniper Bot title', async ({ page }) => {
    console.log('🏠 Testing homepage functionality...');
    
    // Navigate to homepage  
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Wait for the h1 element with the expected text
    const h1Element = page.locator('h1:has-text("MEXC Sniper Bot")');
    await expect(h1Element).toBeVisible({ timeout: 10000 });
    console.log('✅ Found h1 element with "MEXC Sniper Bot" text');
    
    // Verify the full text content
    const h1Text = await h1Element.textContent();
    expect(h1Text?.trim()).toBe('MEXC Sniper Bot');
    console.log('✅ H1 text content verified');
    
    // Check for key homepage elements
    await expect(page.locator('text=Advanced AI-powered cryptocurrency trading platform')).toBeVisible();
    console.log('✅ Main description visible');
    
    await expect(page.locator('button:has-text("Get Started")')).toBeVisible();
    console.log('✅ Get Started button visible');
    
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
    console.log('✅ Sign In button visible');
    
    // Check for features section
    await expect(page.locator('text=🎯 Pattern Detection')).toBeVisible();
    await expect(page.locator('text=🤖 Multi-Agent System')).toBeVisible();
    await expect(page.locator('text=📊 Real-time Analytics')).toBeVisible();
    console.log('✅ Features section visible');
    
    // Take screenshot
    await page.screenshot({ path: 'homepage-verification.png' });
    console.log('📸 Homepage screenshot saved');
    
    console.log('✅ Homepage test completed successfully');
  });
});