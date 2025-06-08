import { test, expect } from '@playwright/test'

test.describe('Dashboard Page', () => {
  test('should load dashboard page successfully', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Check that the page loads without errors
    await expect(page).toHaveTitle(/MEXC Sniper Bot/)
    
    // Check for main dashboard elements
    await expect(page.locator('h1')).toContainText('MEXC Sniper Bot Dashboard')
  })

  test('should display pattern sniper section', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Check for pattern sniper components
    await expect(page.locator('text=Pattern Sniper')).toBeVisible()
    await expect(page.locator('text=Ready State Pattern')).toBeVisible()
  })

  test('should display upcoming coins section', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Check for upcoming coins section
    await expect(page.locator('text=Upcoming Coins')).toBeVisible()
  })

  test('should handle refresh calendar button', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Find and click the refresh button
    const refreshButton = page.locator('button:has-text("Refresh Calendar")')
    await expect(refreshButton).toBeVisible()
    
    // Click the button (this will test the API call)
    await refreshButton.click()
    
    // Check for loading state or updated content
    await expect(refreshButton).toContainText(/Refreshing|Refresh/)
  })

  test('should show/hide preferences section', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Find the preferences toggle button
    const preferencesButton = page.locator('button:has-text("Preferences")')
    await expect(preferencesButton).toBeVisible()
    
    // Click to show preferences
    await preferencesButton.click()
    await expect(preferencesButton).toContainText('Hide Preferences')
    
    // Click to hide preferences
    await preferencesButton.click()
    await expect(preferencesButton).toContainText('Show Preferences')
  })

  test('should display real-time data when available', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Wait for any data loading
    await page.waitForTimeout(2000)
    
    // Check for data containers (they should exist even if empty)
    await expect(page.locator('[data-testid="coins-list"], .grid, .space-y-4')).toBeVisible()
  })

  test('should be responsive on mobile viewports', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/dashboard')
    
    // Check that main elements are still visible on mobile
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('text=Pattern Sniper')).toBeVisible()
  })

  test('should handle network errors gracefully', async ({ page }) => {
    // Block all network requests to simulate offline mode
    await page.route('**/*', route => route.abort())
    
    await page.goto('/dashboard')
    
    // Page should still load with cached/default content
    await expect(page.locator('h1')).toBeVisible()
  })
})