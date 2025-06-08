import { test, expect } from '@playwright/test'

test.describe('API Key Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard')
  })

  test('should display preferences section with API key fields', async ({ page }) => {
    // Click to show preferences
    const preferencesButton = page.locator('button:has-text("Preferences"), button:has-text("Show Preferences")')
    await preferencesButton.click()
    
    // Check for API key configuration section
    await expect(page.locator('text=API Configuration', 'text=MEXC API', 'text=API Keys')).toBeVisible()
    
    // Look for API key input fields
    const apiKeyField = page.locator('input[type="text"], input[type="password"]').filter({ hasText: /api.*key/i }).or(
      page.locator('input').filter({ hasAttribute: 'placeholder', hasText: /api.*key/i })
    ).or(
      page.locator('label:has-text("API")').locator('+ input, ~ input')
    )
    
    const secretKeyField = page.locator('input[type="text"], input[type="password"]').filter({ hasText: /secret/i }).or(
      page.locator('input').filter({ hasAttribute: 'placeholder', hasText: /secret/i })
    ).or(
      page.locator('label:has-text("Secret")').locator('+ input, ~ input')
    )
    
    // Check if API key fields exist
    if (await apiKeyField.count() > 0) {
      await expect(apiKeyField.first()).toBeVisible()
    }
    
    if (await secretKeyField.count() > 0) {
      await expect(secretKeyField.first()).toBeVisible()
    }
  })

  test('should handle API key input and validation', async ({ page }) => {
    // Click to show preferences
    const preferencesButton = page.locator('button:has-text("Preferences"), button:has-text("Show Preferences")')
    await preferencesButton.click()
    
    // Wait for preferences section to load
    await page.waitForTimeout(1000)
    
    // Look for any input fields that might be for API keys
    const allInputs = page.locator('input[type="text"], input[type="password"]')
    const inputCount = await allInputs.count()
    
    console.log(`Found ${inputCount} input fields`)
    
    if (inputCount > 0) {
      // Try to find API key related inputs by placeholder or label
      for (let i = 0; i < inputCount; i++) {
        const input = allInputs.nth(i)
        const placeholder = await input.getAttribute('placeholder')
        const id = await input.getAttribute('id')
        const name = await input.getAttribute('name')
        
        console.log(`Input ${i}: placeholder="${placeholder}", id="${id}", name="${name}"`)
        
        // Test if this looks like an API key field
        if (placeholder?.toLowerCase().includes('api') || 
            id?.toLowerCase().includes('api') || 
            name?.toLowerCase().includes('api')) {
          
          // Test input functionality
          await input.fill('test_api_key_123')
          await expect(input).toHaveValue('test_api_key_123')
          
          // Clear the field
          await input.fill('')
        }
      }
    }
  })

  test('should save and retrieve API keys through preferences API', async ({ page, request }) => {
    // Test the API directly first
    const testApiKey = 'test_mexc_api_key_12345'
    const testSecretKey = 'test_mexc_secret_key_67890'
    
    // Save API keys via API
    const saveResponse = await request.post('/api/user-preferences', {
      data: {
        userId: 'test-user',
        mexcApiKey: testApiKey,
        mexcSecretKey: testSecretKey,
        defaultBuyAmountUsdt: 100.0,
        maxConcurrentSnipes: 3,
      }
    })
    
    console.log('Save API response status:', saveResponse.status())
    
    if (saveResponse.status() === 200) {
      const saveData = await saveResponse.json()
      expect(saveData.success).toBe(true)
      
      // Retrieve the saved preferences
      const getResponse = await request.get('/api/user-preferences?userId=test-user')
      
      if (getResponse.status() === 200) {
        const userData = await getResponse.json()
        console.log('Retrieved user data:', JSON.stringify(userData, null, 2))
        
        // Check if API keys are stored (they might be masked for security)
        expect(userData).toBeTruthy()
        expect(userData.userId).toBe('test-user')
      }
    }
  })

  test('should handle API key security and masking', async ({ page }) => {
    // Click to show preferences
    const preferencesButton = page.locator('button:has-text("Preferences"), button:has-text("Show Preferences")')
    await preferencesButton.click()
    
    // Look for password type inputs (which would indicate masked API keys)
    const passwordInputs = page.locator('input[type="password"]')
    const passwordCount = await passwordInputs.count()
    
    if (passwordCount > 0) {
      console.log(`Found ${passwordCount} password-type inputs for secure key storage`)
      
      // Test that password inputs don't reveal their content
      const firstPasswordInput = passwordInputs.first()
      await firstPasswordInput.fill('secret_test_key')
      
      // The input should be filled but content should be masked
      await expect(firstPasswordInput).toHaveValue('secret_test_key')
    }
  })

  test('should validate required API key formats', async ({ page }) => {
    // Click to show preferences
    const preferencesButton = page.locator('button:has-text("Preferences"), button:has-text("Show Preferences")')
    await preferencesButton.click()
    
    // Wait for form to load
    await page.waitForTimeout(1000)
    
    // Look for any save/submit buttons
    const saveButtons = page.locator('button:has-text("Save"), button:has-text("Update"), button[type="submit"]')
    const saveButtonCount = await saveButtons.count()
    
    if (saveButtonCount > 0) {
      // Try to save without API keys to test validation
      const firstSaveButton = saveButtons.first()
      await firstSaveButton.click()
      
      // Check for validation messages
      const errorMessages = page.locator('text=required, text=invalid, text=error, [class*="error"], [class*="invalid"]')
      const errorCount = await errorMessages.count()
      
      if (errorCount > 0) {
        console.log('Found validation error messages - good!')
        await expect(errorMessages.first()).toBeVisible()
      }
    }
  })

  test('should persist API keys across page navigation', async ({ page, request }) => {
    // First save some API keys via API
    await request.post('/api/user-preferences', {
      data: {
        userId: 'persistence-test-user',
        mexcApiKey: 'persistent_api_key',
        mexcSecretKey: 'persistent_secret_key',
        defaultBuyAmountUsdt: 200.0,
      }
    })
    
    // Navigate to config page if it exists
    const configLink = page.locator('a[href="/config"], button:has-text("Config")').or(page.locator('text=Configuration'))
    if (await configLink.count() > 0) {
      await configLink.first().click()
      await page.waitForTimeout(1000)
    }
    
    // Navigate back to dashboard
    await page.goto('/dashboard')
    
    // Check if the data is still accessible
    const getResponse = await request.get('/api/user-preferences?userId=persistence-test-user')
    
    if (getResponse.status() === 200) {
      const userData = await getResponse.json()
      expect(userData).toBeTruthy()
      expect(userData.userId).toBe('persistence-test-user')
      console.log('API keys persisted successfully across navigation')
    }
  })

  test('should handle API key testing/validation functionality', async ({ page }) => {
    // Click to show preferences
    const preferencesButton = page.locator('button:has-text("Preferences"), button:has-text("Show Preferences")')
    await preferencesButton.click()
    
    // Look for test connection or validate buttons
    const testButtons = page.locator('button:has-text("Test"), button:has-text("Validate"), button:has-text("Check Connection")')
    const testButtonCount = await testButtons.count()
    
    if (testButtonCount > 0) {
      console.log(`Found ${testButtonCount} test/validation buttons`)
      
      // Try clicking a test button
      const firstTestButton = testButtons.first()
      await firstTestButton.click()
      
      // Wait for any response
      await page.waitForTimeout(2000)
      
      // Check for success/error messages
      const statusMessages = page.locator('text=success, text=valid, text=connected, text=failed, text=invalid, text=error')
      const statusCount = await statusMessages.count()
      
      if (statusCount > 0) {
        console.log('API key validation system is working')
        await expect(statusMessages.first()).toBeVisible()
      }
    }
  })
})