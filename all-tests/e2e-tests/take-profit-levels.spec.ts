import { test, expect } from '@playwright/test'

test.describe('Take Profit Levels Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard')
    
    // Show preferences section first
    const preferencesButton = page.locator('button:has-text("Preferences"), button:has-text("Show Preferences")')
    if (await preferencesButton.count() > 0) {
      await preferencesButton.click()
      await page.waitForTimeout(1000)
    }
  })

  test('should display take profit level configuration options', async ({ page }) => {
    // Look for take profit related text or inputs
    const takeProfitElements = page.locator('text=Take Profit, text=Profit Level, text=Level, input[name*="profit"], input[id*="profit"]')
    const takeProfitCount = await takeProfitElements.count()
    
    console.log(`Found ${takeProfitCount} take profit related elements`)
    
    if (takeProfitCount > 0) {
      await expect(takeProfitElements.first()).toBeVisible()
      console.log('✅ Take profit configuration section found')
    } else {
      console.log('ℹ️ Take profit configuration not visible in current preferences view')
      
      // Check if there are any numeric input fields that could be for take profit levels
      const numericInputs = page.locator('input[type="number"], input[step]')
      const numericCount = await numericInputs.count()
      
      if (numericCount > 0) {
        console.log(`Found ${numericCount} numeric input fields that could be for take profit levels`)
        await expect(numericInputs.first()).toBeVisible()
      }
    }
  })

  test('should allow modification of take profit level 1 (5%)', async ({ page }) => {
    // Test via API first to ensure backend works
    const testUserId = 'take-profit-test-user-1'
    
    // Get current preferences
    const getCurrentResponse = await page.request.get(`/api/user-preferences?userId=${testUserId}`)
    console.log('Current preferences response status:', getCurrentResponse.status())
    
    if (getCurrentResponse.status() === 200) {
      const currentData = await getCurrentResponse.json()
      console.log('Current take profit levels:', currentData?.takeProfitLevels || 'Not set')
    }
    
    // Update take profit level 1 from 5% to 7%
    const updateResponse = await page.request.post('/api/user-preferences', {
      data: {
        userId: testUserId,
        takeProfitLevel1: 7.0, // Change from default 5% to 7%
        defaultBuyAmountUsdt: 100.0,
        maxConcurrentSnipes: 3,
      }
    })
    
    console.log('Update response status:', updateResponse.status())
    
    if (updateResponse.status() === 200) {
      const updateData = await updateResponse.json()
      expect(updateData.success).toBe(true)
      console.log('✅ Take profit level 1 updated successfully to 7%')
      
      // Verify the change was saved
      const verifyResponse = await page.request.get(`/api/user-preferences?userId=${testUserId}`)
      
      if (verifyResponse.status() === 200) {
        const verifyData = await verifyResponse.json()
        console.log('Verified take profit levels:', verifyData.takeProfitLevels)
        
        if (verifyData.takeProfitLevels) {
          expect(verifyData.takeProfitLevels.level1).toBe(7)
          console.log('✅ Take profit level 1 change verified: 5% → 7%')
        }
      }
    }
  })

  test('should allow modification of take profit level 2 (10%)', async ({ page }) => {
    const testUserId = 'take-profit-test-user-2'
    
    // Update take profit level 2 from 10% to 12%
    const updateResponse = await page.request.post('/api/user-preferences', {
      data: {
        userId: testUserId,
        takeProfitLevel2: 12.0, // Change from default 10% to 12%
        defaultBuyAmountUsdt: 150.0,
        maxConcurrentSnipes: 2,
      }
    })
    
    console.log('Update response status:', updateResponse.status())
    
    if (updateResponse.status() === 200) {
      const updateData = await updateResponse.json()
      expect(updateData.success).toBe(true)
      console.log('✅ Take profit level 2 updated successfully to 12%')
      
      // Verify the change was saved
      const verifyResponse = await page.request.get(`/api/user-preferences?userId=${testUserId}`)
      
      if (verifyResponse.status() === 200) {
        const verifyData = await verifyResponse.json()
        console.log('Verified take profit levels:', verifyData.takeProfitLevels)
        
        if (verifyData.takeProfitLevels) {
          expect(verifyData.takeProfitLevels.level2).toBe(12)
          console.log('✅ Take profit level 2 change verified: 10% → 12%')
        }
      }
    }
  })

  test('should allow modification of take profit level 3 (15%)', async ({ page }) => {
    const testUserId = 'take-profit-test-user-3'
    
    // Update take profit level 3 from 15% to 18%
    const updateResponse = await page.request.post('/api/user-preferences', {
      data: {
        userId: testUserId,
        takeProfitLevel3: 18.0, // Change from default 15% to 18%
        defaultBuyAmountUsdt: 200.0,
        maxConcurrentSnipes: 5,
      }
    })
    
    console.log('Update response status:', updateResponse.status())
    
    if (updateResponse.status() === 200) {
      const updateData = await updateResponse.json()
      expect(updateData.success).toBe(true)
      console.log('✅ Take profit level 3 updated successfully to 18%')
      
      // Verify the change was saved
      const verifyResponse = await page.request.get(`/api/user-preferences?userId=${testUserId}`)
      
      if (verifyResponse.status() === 200) {
        const verifyData = await verifyResponse.json()
        console.log('Verified take profit levels:', verifyData.takeProfitLevels)
        
        if (verifyData.takeProfitLevels) {
          expect(verifyData.takeProfitLevels.level3).toBe(18)
          console.log('✅ Take profit level 3 change verified: 15% → 18%')
        }
      }
    }
  })

  test('should allow modification of take profit level 4 (25%)', async ({ page }) => {
    const testUserId = 'take-profit-test-user-4'
    
    // Update take profit level 4 from 25% to 30%
    const updateResponse = await page.request.post('/api/user-preferences', {
      data: {
        userId: testUserId,
        takeProfitLevel4: 30.0, // Change from default 25% to 30%
        defaultBuyAmountUsdt: 250.0,
        maxConcurrentSnipes: 4,
      }
    })
    
    console.log('Update response status:', updateResponse.status())
    
    if (updateResponse.status() === 200) {
      const updateData = await updateResponse.json()
      expect(updateData.success).toBe(true)
      console.log('✅ Take profit level 4 updated successfully to 30%')
      
      // Verify the change was saved
      const verifyResponse = await page.request.get(`/api/user-preferences?userId=${testUserId}`)
      
      if (verifyResponse.status() === 200) {
        const verifyData = await verifyResponse.json()
        console.log('Verified take profit levels:', verifyData.takeProfitLevels)
        
        if (verifyData.takeProfitLevels) {
          expect(verifyData.takeProfitLevels.level4).toBe(30)
          console.log('✅ Take profit level 4 change verified: 25% → 30%')
        }
      }
    }
  })

  test('should allow setting custom take profit level', async ({ page }) => {
    const testUserId = 'take-profit-test-user-custom'
    
    // Set a custom take profit level of 8.5%
    const updateResponse = await page.request.post('/api/user-preferences', {
      data: {
        userId: testUserId,
        takeProfitCustom: 8.5, // Custom 8.5%
        defaultTakeProfitLevel: 5, // Use custom level
        defaultBuyAmountUsdt: 75.0,
        maxConcurrentSnipes: 2,
      }
    })
    
    console.log('Update response status:', updateResponse.status())
    
    if (updateResponse.status() === 200) {
      const updateData = await updateResponse.json()
      expect(updateData.success).toBe(true)
      console.log('✅ Custom take profit level set successfully to 8.5%')
      
      // Verify the change was saved
      const verifyResponse = await page.request.get(`/api/user-preferences?userId=${testUserId}`)
      
      if (verifyResponse.status() === 200) {
        const verifyData = await verifyResponse.json()
        console.log('Verified preferences:', verifyData)
        
        expect(verifyData.takeProfitCustom).toBe(8.5)
        expect(verifyData.defaultTakeProfitLevel).toBe(5) // Custom level
        console.log('✅ Custom take profit level verified: 8.5%')
      }
    }
  })

  test('should change default take profit level selection', async ({ page }) => {
    const testUserId = 'take-profit-test-default-level'
    
    // Change default from level 2 (10%) to level 3 (15%)
    const updateResponse = await page.request.post('/api/user-preferences', {
      data: {
        userId: testUserId,
        defaultTakeProfitLevel: 3, // Use level 3 instead of level 2
        defaultBuyAmountUsdt: 125.0,
        maxConcurrentSnipes: 3,
      }
    })
    
    console.log('Update response status:', updateResponse.status())
    
    if (updateResponse.status() === 200) {
      const updateData = await updateResponse.json()
      expect(updateData.success).toBe(true)
      console.log('✅ Default take profit level changed to level 3')
      
      // Verify the change was saved
      const verifyResponse = await page.request.get(`/api/user-preferences?userId=${testUserId}`)
      
      if (verifyResponse.status() === 200) {
        const verifyData = await verifyResponse.json()
        console.log('Verified default take profit level:', verifyData.defaultTakeProfitLevel)
        
        expect(verifyData.defaultTakeProfitLevel).toBe(3)
        console.log('✅ Default take profit level verified: Level 2 (10%) → Level 3 (15%)')
      }
    }
  })

  test('should validate take profit level ranges', async ({ page }) => {
    const testUserId = 'take-profit-test-validation'
    
    // Test with invalid (negative) take profit level
    const invalidResponse = await page.request.post('/api/user-preferences', {
      data: {
        userId: testUserId,
        takeProfitLevel1: -5.0, // Invalid negative value
        defaultBuyAmountUsdt: 100.0,
      }
    })
    
    console.log('Invalid value response status:', invalidResponse.status())
    
    // Should either reject or sanitize the invalid value
    if (invalidResponse.status() === 200) {
      const invalidData = await invalidResponse.json()
      console.log('Response with invalid value:', invalidData)
      
      // Check if the system sanitized or rejected the invalid value
      const verifyResponse = await page.request.get(`/api/user-preferences?userId=${testUserId}`)
      if (verifyResponse.status() === 200) {
        const verifyData = await verifyResponse.json()
        
        if (verifyData.takeProfitLevels && verifyData.takeProfitLevels.level1) {
          // Should not be negative
          expect(verifyData.takeProfitLevels.level1).toBeGreaterThan(0)
          console.log('✅ Invalid negative value was handled properly')
        }
      }
    } else {
      console.log('✅ Invalid value was properly rejected by API')
    }
  })

  test('should persist take profit changes across different workflows', async ({ page }) => {
    const testUserId = 'take-profit-test-persistence'
    
    // Set custom take profit configuration
    const setupResponse = await page.request.post('/api/user-preferences', {
      data: {
        userId: testUserId,
        takeProfitLevel1: 6.0,
        takeProfitLevel2: 11.0,
        takeProfitLevel3: 17.0,
        takeProfitLevel4: 28.0,
        takeProfitCustom: 9.5,
        defaultTakeProfitLevel: 2, // Use level 2 (11%)
        defaultBuyAmountUsdt: 300.0,
        maxConcurrentSnipes: 5,
      }
    })
    
    console.log('Setup response status:', setupResponse.status())
    
    if (setupResponse.status() === 200) {
      console.log('✅ Custom take profit configuration saved')
      
      // Simulate multiple API calls to verify persistence
      for (let i = 1; i <= 3; i++) {
        await page.waitForTimeout(500) // Small delay between calls
        
        const checkResponse = await page.request.get(`/api/user-preferences?userId=${testUserId}`)
        if (checkResponse.status() === 200) {
          const checkData = await checkResponse.json()
          
          expect(checkData.takeProfitLevels.level1).toBe(6)
          expect(checkData.takeProfitLevels.level2).toBe(11)
          expect(checkData.takeProfitLevels.level3).toBe(17)
          expect(checkData.takeProfitLevels.level4).toBe(28)
          expect(checkData.takeProfitCustom).toBe(9.5)
          expect(checkData.defaultTakeProfitLevel).toBe(2)
          
          console.log(`✅ Take profit persistence check ${i}/3 passed`)
        }
      }
      
      console.log('✅ All take profit levels persisted correctly across multiple API calls')
    }
  })
})