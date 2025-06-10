# Test info

- Name: API Key Management >> should handle API key input and validation
- Location: /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/api-keys.spec.ts:39:7

# Error details

```
TimeoutError: locator.click: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('button:has-text("Preferences"), button:has-text("Show Preferences")')

    at /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/api-keys.spec.ts:42:29
```

# Page snapshot

```yaml
- heading "MEXC Sniper Bot" [level=1]
- paragraph: Advanced AI-powered cryptocurrency trading platform for automated sniping of new MEXC listings. Get early access to profitable trading opportunities with intelligent pattern detection.
- button "Get Started"
- button "Sign In"
- text: "🎯 Pattern Detection Advanced AI identifies ready-state patterns (sts:2, st:2, tt:4) with 3.5+ hour advance notice for optimal entry timing. 🤖 Multi-Agent System 5 specialized TypeScript agents work together: Calendar monitoring, Pattern discovery, Symbol analysis, Strategy creation, and Orchestration. 📊 Real-time Analytics Track profit/loss, win rates, and trading performance with comprehensive transaction history and automated reporting."
- heading "Platform Performance" [level=2]
- text: 99.5% Uptime 3.5hrs Avg. Advance Notice 5 Agents AI Trading System 24/7 Market Monitoring
- heading "How It Works" [level=2]
- text: "1"
- heading "Monitor Listings" [level=3]
- paragraph: AI agents continuously scan MEXC calendar for new listing announcements and pattern detection.
- text: "2"
- heading "Analyze Patterns" [level=3]
- paragraph: Advanced algorithms identify optimal entry signals and market readiness indicators.
- text: "3"
- heading "Execute Trades" [level=3]
- paragraph: Automated execution with configurable take-profit levels and risk management strategies.
- heading "Ready to Start Trading?" [level=2]
- paragraph: Join the future of automated cryptocurrency trading with AI-powered precision.
- button "Sign Up Now"
- button "Open Tanstack query devtools":
  - img
- alert
- button "Open Next.js Dev Tools":
  - img
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test'
   2 |
   3 | test.describe('API Key Management', () => {
   4 |   test.beforeEach(async ({ page }) => {
   5 |     await page.goto('/dashboard')
   6 |   })
   7 |
   8 |   test('should display preferences section with API key fields', async ({ page }) => {
   9 |     // Click to show preferences
   10 |     const preferencesButton = page.locator('button:has-text("Preferences"), button:has-text("Show Preferences")')
   11 |     await preferencesButton.click()
   12 |     
   13 |     // Check for API key configuration section - use more specific selector
   14 |     await expect(page.locator('text="MEXC API Status"').first()).toBeVisible()
   15 |     
   16 |     // Look for API key input fields
   17 |     const apiKeyField = page.locator('input[type="text"], input[type="password"]').filter({ hasText: /api.*key/i }).or(
   18 |       page.locator('input[placeholder*="api"]')
   19 |     ).or(
   20 |       page.locator('label:has-text("API")').locator('+ input, ~ input')
   21 |     )
   22 |     
   23 |     const secretKeyField = page.locator('input[type="text"], input[type="password"]').filter({ hasText: /secret/i }).or(
   24 |       page.locator('input[placeholder*="secret"]')
   25 |     ).or(
   26 |       page.locator('label:has-text("Secret")').locator('+ input, ~ input')
   27 |     )
   28 |     
   29 |     // Check if API key fields exist
   30 |     if (await apiKeyField.count() > 0) {
   31 |       await expect(apiKeyField.first()).toBeVisible()
   32 |     }
   33 |     
   34 |     if (await secretKeyField.count() > 0) {
   35 |       await expect(secretKeyField.first()).toBeVisible()
   36 |     }
   37 |   })
   38 |
   39 |   test('should handle API key input and validation', async ({ page }) => {
   40 |     // Click to show preferences
   41 |     const preferencesButton = page.locator('button:has-text("Preferences"), button:has-text("Show Preferences")')
>  42 |     await preferencesButton.click()
      |                             ^ TimeoutError: locator.click: Timeout 10000ms exceeded.
   43 |     
   44 |     // Wait for preferences section to load
   45 |     await page.waitForTimeout(1000)
   46 |     
   47 |     // Look for any input fields that might be for API keys
   48 |     const allInputs = page.locator('input[type="text"], input[type="password"]')
   49 |     const inputCount = await allInputs.count()
   50 |     
   51 |     console.log(`Found ${inputCount} input fields`)
   52 |     
   53 |     if (inputCount > 0) {
   54 |       // Try to find API key related inputs by placeholder or label
   55 |       for (let i = 0; i < inputCount; i++) {
   56 |         const input = allInputs.nth(i)
   57 |         const placeholder = await input.getAttribute('placeholder')
   58 |         const id = await input.getAttribute('id')
   59 |         const name = await input.getAttribute('name')
   60 |         
   61 |         console.log(`Input ${i}: placeholder="${placeholder}", id="${id}", name="${name}"`)
   62 |         
   63 |         // Test if this looks like an API key field
   64 |         if (placeholder?.toLowerCase().includes('api') || 
   65 |             id?.toLowerCase().includes('api') || 
   66 |             name?.toLowerCase().includes('api')) {
   67 |           
   68 |           // Test input functionality
   69 |           await input.fill('test_api_key_123')
   70 |           await expect(input).toHaveValue('test_api_key_123')
   71 |           
   72 |           // Clear the field
   73 |           await input.fill('')
   74 |         }
   75 |       }
   76 |     }
   77 |   })
   78 |
   79 |   test('should save and retrieve API keys through preferences API', async ({ page, request }) => {
   80 |     // Test the API directly first
   81 |     const testApiKey = 'test_mexc_api_key_12345'
   82 |     const testSecretKey = 'test_mexc_secret_key_67890'
   83 |     
   84 |     // Save API keys via API
   85 |     const saveResponse = await request.post('/api/user-preferences', {
   86 |       data: {
   87 |         userId: 'test-user',
   88 |         mexcApiKey: testApiKey,
   89 |         mexcSecretKey: testSecretKey,
   90 |         defaultBuyAmountUsdt: 100.0,
   91 |         maxConcurrentSnipes: 3,
   92 |       }
   93 |     })
   94 |     
   95 |     console.log('Save API response status:', saveResponse.status())
   96 |     
   97 |     if (saveResponse.status() === 200) {
   98 |       const saveData = await saveResponse.json()
   99 |       expect(saveData.success).toBe(true)
  100 |       
  101 |       // Retrieve the saved preferences
  102 |       const getResponse = await request.get('/api/user-preferences?userId=test-user')
  103 |       
  104 |       if (getResponse.status() === 200) {
  105 |         const userData = await getResponse.json()
  106 |         console.log('Retrieved user data:', JSON.stringify(userData, null, 2))
  107 |         
  108 |         // Check if API keys are stored (they might be masked for security)
  109 |         expect(userData).toBeTruthy()
  110 |         expect(userData.userId).toBe('test-user')
  111 |       }
  112 |     }
  113 |   })
  114 |
  115 |   test('should handle API key security and masking', async ({ page }) => {
  116 |     // Click to show preferences
  117 |     const preferencesButton = page.locator('button:has-text("Preferences"), button:has-text("Show Preferences")')
  118 |     if (await preferencesButton.count() > 0) {
  119 |       await preferencesButton.first().click()
  120 |     } else {
  121 |       console.log('Preferences button not found, skipping test')
  122 |       return
  123 |     }
  124 |     
  125 |     // Look for password type inputs (which would indicate masked API keys)
  126 |     const passwordInputs = page.locator('input[type="password"]')
  127 |     const passwordCount = await passwordInputs.count()
  128 |     
  129 |     if (passwordCount > 0) {
  130 |       console.log(`Found ${passwordCount} password-type inputs for secure key storage`)
  131 |       
  132 |       // Test that password inputs don't reveal their content
  133 |       const firstPasswordInput = passwordInputs.first()
  134 |       await firstPasswordInput.fill('secret_test_key')
  135 |       
  136 |       // The input should be filled but content should be masked
  137 |       await expect(firstPasswordInput).toHaveValue('secret_test_key')
  138 |     }
  139 |   })
  140 |
  141 |   test('should validate required API key formats', async ({ page }) => {
  142 |     // Click to show preferences
```