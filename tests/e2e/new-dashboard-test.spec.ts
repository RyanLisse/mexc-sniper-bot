import { test, expect } from '@playwright/test'

test.describe('New Dashboard UI', () => {
  test('should display new dashboard with sidebar layout', async ({ page }) => {
    // Create a test user account first
    await page.goto('http://localhost:3008/auth')
    
    // Wait for auth page to load
    await page.waitForSelector('text=MEXC Sniper Bot', { timeout: 10000 })
    
    // Click the link to switch to sign up mode
    await page.click('text=Create account here')
    
    // Wait for form to update
    await page.waitForSelector('text=Create Account', { timeout: 5000 })
    
    // Generate test credentials
    const testEmail = `test-${Date.now()}@example.com`
    const testPassword = 'TestPassword123!'
    const testName = 'Test User'
    
    // Fill signup form
    await page.fill('input[id="name"]', testName)
    await page.fill('input[id="email"]', testEmail)
    await page.fill('input[id="password"]', testPassword)
    
    // Submit signup
    await page.click('button[type="submit"]:has-text("Create Account")')
    
    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 })
    
    // Check that dashboard loaded with new layout
    await expect(page.locator('text=MEXC Sniper')).toBeVisible()
    
    // Check sidebar navigation
    await expect(page.locator('text=Dashboard')).toBeVisible()
    await expect(page.locator('text=Sniper Bot')).toBeVisible()
    await expect(page.locator('text=Trading')).toBeVisible()
    await expect(page.locator('text=Portfolio')).toBeVisible()
    await expect(page.locator('text=Analytics')).toBeVisible()
    
    // Check metric cards
    await expect(page.locator('text=Total Balance')).toBeVisible()
    await expect(page.locator('text=New Listings')).toBeVisible()
    await expect(page.locator('text=Active Targets')).toBeVisible()
    await expect(page.locator('text=Win Rate')).toBeVisible()
    
    // Check chart section
    await expect(page.locator('text=Trading Volume')).toBeVisible()
    
    // Check tabs
    await expect(page.locator('text=Overview')).toBeVisible()
    await expect(page.locator('text=Pattern Detection')).toBeVisible()
    
    // Take screenshot
    await page.screenshot({ path: 'new-dashboard-ui.png', fullPage: true })
    
    console.log('✅ New dashboard UI loaded successfully')
  })
})