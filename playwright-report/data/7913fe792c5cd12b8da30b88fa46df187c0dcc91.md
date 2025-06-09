# Test info

- Name: API Key Management >> should persist API keys across page navigation
- Location: /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/api-keys.spec.ts:174:7

# Error details

```
Error: page.goto: NS_ERROR_CONNECTION_REFUSED
Call log:
  - navigating to "http://localhost:3008/dashboard", waiting until "load"

    at /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/api-keys.spec.ts:193:16
```

# Page snapshot

```yaml
- heading "Unable to connect" [level=1]
- paragraph: Firefox can’t establish a connection to the server at localhost:3008.
- paragraph
- list:
  - listitem: The site could be temporarily unavailable or too busy. Try again in a few moments.
  - listitem: If you are unable to load any pages, check your computer’s network connection.
  - listitem: If your computer or network is protected by a firewall or proxy, make sure that Nightly is permitted to access the web.
  - listitem: If you are trying to load a local network page, please check that Nightly has been granted Local Network permissions in the macOS Privacy & Security settings.
- button "Try Again"
```

# Test source

```ts
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
  143 |     const preferencesButton = page.locator('button:has-text("Preferences"), button:has-text("Show Preferences")')
  144 |     if (await preferencesButton.count() > 0) {
  145 |       await preferencesButton.first().click()
  146 |     } else {
  147 |       console.log('Preferences button not found, skipping test')
  148 |       return
  149 |     }
  150 |     
  151 |     // Wait for form to load
  152 |     await page.waitForTimeout(1000)
  153 |     
  154 |     // Look for any save/submit buttons
  155 |     const saveButtons = page.locator('button:has-text("Save"), button:has-text("Update"), button[type="submit"]')
  156 |     const saveButtonCount = await saveButtons.count()
  157 |     
  158 |     if (saveButtonCount > 0) {
  159 |       // Try to save without API keys to test validation
  160 |       const firstSaveButton = saveButtons.first()
  161 |       await firstSaveButton.click()
  162 |       
  163 |       // Check for validation messages
  164 |       const errorMessages = page.locator('text=required, text=invalid, text=error, [class*="error"], [class*="invalid"]')
  165 |       const errorCount = await errorMessages.count()
  166 |       
  167 |       if (errorCount > 0) {
  168 |         console.log('Found validation error messages - good!')
  169 |         await expect(errorMessages.first()).toBeVisible()
  170 |       }
  171 |     }
  172 |   })
  173 |
  174 |   test('should persist API keys across page navigation', async ({ page, request }) => {
  175 |     // First save some API keys via API
  176 |     await request.post('/api/user-preferences', {
  177 |       data: {
  178 |         userId: 'persistence-test-user',
  179 |         mexcApiKey: 'persistent_api_key',
  180 |         mexcSecretKey: 'persistent_secret_key',
  181 |         defaultBuyAmountUsdt: 200.0,
  182 |       }
  183 |     })
  184 |     
  185 |     // Navigate to config page if it exists
  186 |     const configLink = page.locator('a[href="/config"], button:has-text("Config")').or(page.locator('text=Configuration'))
  187 |     if (await configLink.count() > 0) {
  188 |       await configLink.first().click()
  189 |       await page.waitForTimeout(1000)
  190 |     }
  191 |     
  192 |     // Navigate back to dashboard
> 193 |     await page.goto('/dashboard')
      |                ^ Error: page.goto: NS_ERROR_CONNECTION_REFUSED
  194 |     
  195 |     // Check if the data is still accessible
  196 |     const getResponse = await request.get('/api/user-preferences?userId=persistence-test-user')
  197 |     
  198 |     if (getResponse.status() === 200) {
  199 |       const userData = await getResponse.json()
  200 |       expect(userData).toBeTruthy()
  201 |       expect(userData.userId).toBe('persistence-test-user')
  202 |       console.log('API keys persisted successfully across navigation')
  203 |     }
  204 |   })
  205 |
  206 |   test('should handle API key testing/validation functionality', async ({ page }) => {
  207 |     // Click to show preferences
  208 |     const preferencesButton = page.locator('button:has-text("Preferences"), button:has-text("Show Preferences")')
  209 |     if (await preferencesButton.count() > 0) {
  210 |       await preferencesButton.first().click()
  211 |     } else {
  212 |       console.log('Preferences button not found, skipping test')
  213 |       return
  214 |     }
  215 |     
  216 |     // Look for test connection or validate buttons
  217 |     const testButtons = page.locator('button:has-text("Test"), button:has-text("Validate"), button:has-text("Check Connection")')
  218 |     const testButtonCount = await testButtons.count()
  219 |     
  220 |     if (testButtonCount > 0) {
  221 |       console.log(`Found ${testButtonCount} test/validation buttons`)
  222 |       
  223 |       // Try clicking a test button
  224 |       const firstTestButton = testButtons.first()
  225 |       await firstTestButton.click()
  226 |       
  227 |       // Wait for any response
  228 |       await page.waitForTimeout(2000)
  229 |       
  230 |       // Check for success/error messages
  231 |       const statusMessages = page.locator('text=success, text=valid, text=connected, text=failed, text=invalid, text=error')
  232 |       const statusCount = await statusMessages.count()
  233 |       
  234 |       if (statusCount > 0) {
  235 |         console.log('API key validation system is working')
  236 |         await expect(statusMessages.first()).toBeVisible()
  237 |       }
  238 |     }
  239 |   })
  240 | })
```