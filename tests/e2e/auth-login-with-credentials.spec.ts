import { test, expect } from '@playwright/test'

const EMAIL = process.env.TEST_USER_EMAIL
const PASSWORD = process.env.TEST_USER_PASSWORD

// These tests rely on the baseURL configured in playwright.config.ts

test.describe('Login With Credentials', () => {
  test('should log in, reach dashboard and log out', async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, 'TEST_USER_EMAIL and TEST_USER_PASSWORD must be set')

    // Navigate to the auth page using configured baseURL
    await page.goto('/auth')

    // Locate input fields
    const emailInput = page.locator('input[name="email"]').or(
      page.locator('input[type="email"]')
    )
    const passwordInput = page.locator('input[name="password"]').or(
      page.locator('input[type="password"]')
    )

    // Fill credentials
    await emailInput.first().fill(EMAIL!)
    await passwordInput.first().fill(PASSWORD!)

    // Submit form
    const submitButton = page.locator('button:has-text("Sign In")').or(
      page.locator('button[type="submit"]')
    ).or(
      page.locator('button:has-text("Log in")')
    )
    await submitButton.first().click()

    // Wait for dashboard to load
    await page.waitForURL('**/dashboard', { timeout: 15000 })
    await expect(page).toHaveURL(/.*\/dashboard/)

    // Sign out
    const signOutButton = page.locator('button:has-text("Sign Out")').or(
      page.locator('[data-testid="sign-out"]')
    ).or(
      page.locator('text=Sign Out')
    )
    if (await signOutButton.first().isVisible()) {
      await signOutButton.first().click()
    }

    await page.waitForURL('**/auth', { timeout: 15000 })
    await expect(page).toHaveURL(/.*\/auth/)
  })
})
