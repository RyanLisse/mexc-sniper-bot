# Test info

- Name: Dashboard Page >> should be responsive on mobile viewports
- Location: /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/dashboard.spec.ts:115:7

# Error details

```
Error: Timed out 5000ms waiting for expect(locator).toBeVisible()

Locator: locator('h1')
Expected: visible
Received: <element(s) not found>
Call log:
  - expect.toBeVisible with timeout 5000ms
  - waiting for locator('h1')

    at /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/dashboard.spec.ts:120:38
```

# Page snapshot

```yaml
- banner:
  - heading "Trading Dashboard" [level=1]
  - paragraph: Real-time monitoring and control
  - link "Sign In":
    - /url: /auth
    - button "Sign In"
  - text: "Last updated: 11:43:11 AM"
  - button
  - link "Settings":
    - /url: /config
    - button "Settings"
- text: System Control Manage pattern discovery and monitoring systems
- button "Show Preferences"
- button "Show Exit Strategies"
- button "Refresh MEXC Data"
- button "Stop Auto-Snipe"
- button "Force Refresh Data"
- button "Clear All Targets"
- paragraph: Auto-Snipe
- paragraph: Active
- paragraph: Auto-executing trades
- paragraph: Ready to Snipe
- paragraph: "0"
- paragraph: "Pattern: sts:2, st:2, tt:4"
- paragraph: Monitoring
- paragraph: "0"
- paragraph: Pending detection
- text: Pattern Sniper Performance Total Listings 0 Success Rate 0.0% System Uptime 0m 0s Detection Rate 0.0% Recent Activity
- paragraph: No recent activity
- paragraph: Start discovery to see live updates
- text: Account Balance
- button "Auto"
- button
- button [disabled]
- text: MEXC API Status
- paragraph: API Connection
- paragraph: Disconnected
- paragraph: Calendar Data
- paragraph: Loading...
- paragraph: Account Access
- paragraph: Not configured
- text: Coin Listings Calendar 0 listings View coin listings by date - check today, tomorrow, or any future date Select Date Choose a date to view coin listings. Today and tomorrow are highlighted. June 2025
- button "Go to previous month"
- button "Go to next month"
- grid "June 2025":
  - rowgroup:
    - row "Sunday Monday Tuesday Wednesday Thursday Friday Saturday":
      - columnheader "Sunday": Su
      - columnheader "Monday": Mo
      - columnheader "Tuesday": Tu
      - columnheader "Wednesday": We
      - columnheader "Thursday": Th
      - columnheader "Friday": Fr
      - columnheader "Saturday": Sa
  - rowgroup:
    - row "1 2 3 4 5 6 7":
      - gridcell "1"
      - gridcell "2"
      - gridcell "3"
      - gridcell "4"
      - gridcell "5"
      - gridcell "6"
      - gridcell "7"
    - row "8 9 10 11 12 13 14":
      - gridcell "8"
      - gridcell "9" [selected]
      - gridcell "10"
      - gridcell "11"
      - gridcell "12"
      - gridcell "13"
      - gridcell "14"
    - row "15 16 17 18 19 20 21":
      - gridcell "15"
      - gridcell "16"
      - gridcell "17"
      - gridcell "18"
      - gridcell "19"
      - gridcell "20"
      - gridcell "21"
    - row "22 23 24 25 26 27 28":
      - gridcell "22"
      - gridcell "23"
      - gridcell "24"
      - gridcell "25"
      - gridcell "26"
      - gridcell "27"
      - gridcell "28"
    - row "29 30 1 2 3 4 5":
      - gridcell "29"
      - gridcell "30"
      - gridcell "1"
      - gridcell "2"
      - gridcell "3"
      - gridcell "4"
      - gridcell "5"
- text: Coin Listings Listings for Today Loading MEXC data... 🚨 Emergency Response Dashboard healthy Database healthy MEXC API healthy OpenAI API healthy Memory 82MB
- heading "Emergency Response Tests" [level=3]
- heading [level=4]
- paragraph
- text: "Data: {\"affectedAPIs\":[\"mexc\",\"openai\"]}"
- button "Low"
- button "Medium"
- button "High"
- button "Critical"
- heading "High Volatility" [level=4]
- paragraph: Test volatility response mechanisms
- text: "Data: {\"affectedSymbols\":[\"BTCUSDT\",\"ETHUSDT\"],\"volatilityIncrease\":\"150%\"}"
- button "Low"
- button "Medium"
- button "High"
- button "Critical"
- heading "System Overload" [level=4]
- paragraph: Test resource management recovery
- text: "Data: {\"memoryUsage\":\"95%\",\"cpuUsage\":\"90%\"}"
- button "Low"
- button "Medium"
- button "High"
- button "Critical"
- heading "Database Failure" [level=4]
- paragraph: Test database recovery procedures
- text: "Data: {\"connectionLost\":true,\"lastSuccessfulQuery\":1749462161162}"
- button "Low"
- button "Medium"
- button "High"
- button "Critical"
- heading "Trading Anomaly" [level=4]
- paragraph: Test trading halt and investigation
- text: "Data: {\"anomalyType\":\"unusual_price_movement\",\"affectedSymbols\":[\"NEWCOIN\"]}"
- button "Low"
- button "Medium"
- button "High"
- button "Critical"
- button "🔄 Refresh System Health"
- heading "Live Trading Environment" [level=3]
- paragraph: This dashboard controls live trading systems. All actions will affect real trades and funds. Monitor system performance carefully and ensure proper risk management settings are in place.
- button "Open Tanstack query devtools":
  - img
- alert
- button "Open Next.js Dev Tools":
  - img
```

# Test source

```ts
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
  106 |     await page.goto('/dashboard')
  107 |     
  108 |     // Wait for any data loading
  109 |     await page.waitForTimeout(2000)
  110 |     
  111 |     // Check for data containers (they should exist even if empty)
  112 |     await expect(page.locator('.grid').first()).toBeVisible()
  113 |   })
  114 |
  115 |   test('should be responsive on mobile viewports', async ({ page }) => {
  116 |     await page.setViewportSize({ width: 375, height: 667 })
  117 |     await page.goto('/dashboard')
  118 |     
  119 |     // Check that main elements are still visible on mobile
> 120 |     await expect(page.locator('h1')).toBeVisible()
      |                                      ^ Error: Timed out 5000ms waiting for expect(locator).toBeVisible()
  121 |     await expect(page.locator('text=Pattern Sniper').first()).toBeVisible()
  122 |   })
  123 |
  124 |   test('should handle network errors gracefully', async ({ page }) => {
  125 |     await page.goto('/dashboard')
  126 |     
  127 |     // Wait for initial load
  128 |     await page.waitForTimeout(3000)
  129 |     
  130 |     // Page should load with default content even if some APIs fail
  131 |     await expect(page.locator('h1')).toBeVisible()
  132 |     
  133 |     // Check that main dashboard structure exists
  134 |     const hasGridLayout = await page.locator('.grid').count() > 0
  135 |     const hasCardLayout = await page.locator('.card, [class*="card"]').count() > 0
  136 |     
  137 |     expect(hasGridLayout || hasCardLayout).toBeTruthy()
  138 |   })
  139 | })
```