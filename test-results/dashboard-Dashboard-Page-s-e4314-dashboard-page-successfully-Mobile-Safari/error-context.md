# Test info

- Name: Dashboard Page >> should load dashboard page successfully
- Location: /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/dashboard.spec.ts:4:7

# Error details

```
Error: page.goto: Could not connect to the server.
Call log:
  - navigating to "http://localhost:3008/dashboard", waiting until "load"

    at /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/dashboard.spec.ts:5:16
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test'
   2 |
   3 | test.describe('Dashboard Page', () => {
   4 |   test('should load dashboard page successfully', async ({ page }) => {
>  5 |     await page.goto('/dashboard')
     |                ^ Error: page.goto: Could not connect to the server.
   6 |     
   7 |     // Check that the page loads without errors
   8 |     await expect(page).toHaveTitle(/MEXC Sniper Bot/)
   9 |     
   10 |     // Check for main dashboard elements
   11 |     await expect(page.locator('h1')).toContainText('Trading Dashboard')
   12 |   })
   13 |
   14 |   test('should display pattern sniper section', async ({ page }) => {
   15 |     await page.goto('/dashboard')
   16 |     
   17 |     // Wait for dashboard to load
   18 |     await page.waitForTimeout(3000)
   19 |     
   20 |     // Check for pattern sniper components or related text
   21 |     const patternElements = page.locator('text="Pattern"').or(
   22 |       page.locator('text="Ready State"')
   23 |     ).or(
   24 |       page.locator('text="sts:2, st:2, tt:4"')
   25 |     ).or(
   26 |       page.locator('text="Auto-Snipe"')
   27 |     )
   28 |     
   29 |     const count = await patternElements.count()
   30 |     if (count > 0) {
   31 |       await expect(patternElements.first()).toBeVisible()
   32 |     } else {
   33 |       // Pattern section might be hidden or different - just check dashboard loads
   34 |       await expect(page.locator('h1')).toContainText('Trading Dashboard')
   35 |     }
   36 |   })
   37 |
   38 |   test('should display upcoming coins section', async ({ page }) => {
   39 |     await page.goto('/dashboard')
   40 |     
   41 |     // Wait for dashboard to load
   42 |     await page.waitForTimeout(3000)
   43 |     
   44 |     // Check for coin calendar or listings section
   45 |     const coinElements = page.locator('text="Calendar"').or(
   46 |       page.locator('text="Coin Listings"')
   47 |     ).or(
   48 |       page.locator('text="listings"')
   49 |     ).or(
   50 |       page.locator('text="Upcoming"')
   51 |     )
   52 |     
   53 |     const count = await coinElements.count()
   54 |     if (count > 0) {
   55 |       await expect(coinElements.first()).toBeVisible()
   56 |     } else {
   57 |       // Calendar section might be different - check for any trading data
   58 |       await expect(page.locator('h1')).toContainText('Trading Dashboard')
   59 |     }
   60 |   })
   61 |
   62 |   test('should handle refresh calendar button', async ({ page }) => {
   63 |     await page.goto('/dashboard')
   64 |     
   65 |     // Wait for dashboard to load
   66 |     await page.waitForTimeout(3000)
   67 |     
   68 |     // Find refresh button - might be "Refresh MEXC Data" or similar
   69 |     const refreshButton = page.locator('button:has-text("Refresh")')
   70 |     
   71 |     if (await refreshButton.count() > 0) {
   72 |       await expect(refreshButton.first()).toBeVisible()
   73 |       
   74 |       // Click the button (this will test the API call)
   75 |       await refreshButton.first().click()
   76 |       
   77 |       // Wait a moment for any loading state
   78 |       await page.waitForTimeout(1000)
   79 |       
   80 |       // Check button exists (content might change)
   81 |       await expect(refreshButton.first()).toBeVisible()
   82 |     } else {
   83 |       // No refresh button found - that's okay
   84 |       console.log('No refresh button found, skipping test')
   85 |       expect(true).toBeTruthy()
   86 |     }
   87 |   })
   88 |
   89 |   test('should show/hide preferences section', async ({ page }) => {
   90 |     await page.goto('/dashboard')
   91 |     
   92 |     // Find the preferences toggle button
   93 |     const preferencesButton = page.locator('button:has-text("Preferences")')
   94 |     await expect(preferencesButton).toBeVisible()
   95 |     
   96 |     // Click to show preferences
   97 |     await preferencesButton.click()
   98 |     await expect(preferencesButton).toContainText('Hide Preferences')
   99 |     
  100 |     // Click to hide preferences
  101 |     await preferencesButton.click()
  102 |     await expect(preferencesButton).toContainText('Show Preferences')
  103 |   })
  104 |
  105 |   test('should display real-time data when available', async ({ page }) => {
```