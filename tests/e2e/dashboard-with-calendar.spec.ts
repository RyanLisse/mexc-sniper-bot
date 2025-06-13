import { test, expect } from '@playwright/test'

test.describe('Dashboard with Calendar Data', () => {
  test('should display dashboard and handle calendar data correctly', async ({ page }) => {
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
    
    // Check that dashboard loaded
    await expect(page.locator('h1')).toContainText('MEXC Sniper Bot')
    
    // Check calendar data is displayed correctly
    await expect(page.locator('text=Coin Listings Calendar')).toBeVisible()
    
    // Check that calendar section shows listings count
    await expect(page.locator('text=/\\d+ listings/')).toBeVisible()
    
    // Check that no calendar errors are displayed
    await expect(page.locator('text=calendar?.filter is not a function')).not.toBeVisible()
    await expect(page.locator('text=calendarData.map is not a function')).not.toBeVisible()
    
    // Check upcoming launches section
    await expect(page.locator('text=System Control')).toBeVisible()
    
    // Check ready targets section
    await expect(page.locator('text=Ready to Snipe')).toBeVisible()
    
    // Take screenshot
    await page.screenshot({ path: 'dashboard-calendar-test.png', fullPage: true })
    
    console.log('✅ Dashboard with calendar data loaded successfully')
  })
})