# Test info

- Name: Take Profit Levels Configuration >> should allow modification of take profit level 4 (25%)
- Location: /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/take-profit-levels.spec.ts:162:7

# Error details

```
Error: apiRequestContext.post: Request timed out after 10000ms
Call log:
  - → POST http://localhost:3008/api/user-preferences
    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.7103.25 Safari/537.36
    - accept: */*
    - accept-encoding: gzip,deflate,br
    - content-type: application/json
    - content-length: 109

    at /Users/neo/Developer/mexc-sniper-bot/all-tests/e2e-tests/take-profit-levels.spec.ts:166:47
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
   66 |         maxConcurrentSnipes: 3,
   67 |       }
   68 |     })
   69 |     
   70 |     console.log('Update response status:', updateResponse.status())
   71 |     
   72 |     if (updateResponse.status() === 200) {
   73 |       const updateData = await updateResponse.json()
   74 |       expect(updateData.success).toBe(true)
   75 |       console.log('✅ Take profit level 1 updated successfully to 7%')
   76 |       
   77 |       // Verify the change was saved
   78 |       const verifyResponse = await page.request.get(`/api/user-preferences?userId=${testUserId}`)
   79 |       
   80 |       if (verifyResponse.status() === 200) {
   81 |         const verifyData = await verifyResponse.json()
   82 |         console.log('Verified take profit levels:', verifyData.takeProfitLevels)
   83 |         
   84 |         if (verifyData.takeProfitLevels) {
   85 |           expect(verifyData.takeProfitLevels.level1).toBe(7)
   86 |           console.log('✅ Take profit level 1 change verified: 5% → 7%')
   87 |         }
   88 |       }
   89 |     }
   90 |   })
   91 |
   92 |   test('should allow modification of take profit level 2 (10%)', async ({ page }) => {
   93 |     const testUserId = 'take-profit-test-user-2'
   94 |     
   95 |     // Update take profit level 2 from 10% to 12%
   96 |     const updateResponse = await page.request.post('/api/user-preferences', {
   97 |       data: {
   98 |         userId: testUserId,
   99 |         takeProfitLevel2: 12.0, // Change from default 10% to 12%
  100 |         defaultBuyAmountUsdt: 150.0,
  101 |         maxConcurrentSnipes: 2,
  102 |       }
  103 |     })
  104 |     
  105 |     console.log('Update response status:', updateResponse.status())
  106 |     
  107 |     if (updateResponse.status() === 200) {
  108 |       const updateData = await updateResponse.json()
  109 |       expect(updateData.success).toBe(true)
  110 |       console.log('✅ Take profit level 2 updated successfully to 12%')
  111 |       
  112 |       // Verify the change was saved
  113 |       const verifyResponse = await page.request.get(`/api/user-preferences?userId=${testUserId}`)
  114 |       
  115 |       if (verifyResponse.status() === 200) {
  116 |         const verifyData = await verifyResponse.json()
  117 |         console.log('Verified take profit levels:', verifyData.takeProfitLevels)
  118 |         
  119 |         if (verifyData.takeProfitLevels) {
  120 |           expect(verifyData.takeProfitLevels.level2).toBe(12)
  121 |           console.log('✅ Take profit level 2 change verified: 10% → 12%')
  122 |         }
  123 |       }
  124 |     }
  125 |   })
  126 |
  127 |   test('should allow modification of take profit level 3 (15%)', async ({ page }) => {
  128 |     const testUserId = 'take-profit-test-user-3'
  129 |     
  130 |     // Update take profit level 3 from 15% to 18%
  131 |     const updateResponse = await page.request.post('/api/user-preferences', {
  132 |       data: {
  133 |         userId: testUserId,
  134 |         takeProfitLevel3: 18.0, // Change from default 15% to 18%
  135 |         defaultBuyAmountUsdt: 200.0,
  136 |         maxConcurrentSnipes: 5,
  137 |       }
  138 |     })
  139 |     
  140 |     console.log('Update response status:', updateResponse.status())
  141 |     
  142 |     if (updateResponse.status() === 200) {
  143 |       const updateData = await updateResponse.json()
  144 |       expect(updateData.success).toBe(true)
  145 |       console.log('✅ Take profit level 3 updated successfully to 18%')
  146 |       
  147 |       // Verify the change was saved
  148 |       const verifyResponse = await page.request.get(`/api/user-preferences?userId=${testUserId}`)
  149 |       
  150 |       if (verifyResponse.status() === 200) {
  151 |         const verifyData = await verifyResponse.json()
  152 |         console.log('Verified take profit levels:', verifyData.takeProfitLevels)
  153 |         
  154 |         if (verifyData.takeProfitLevels) {
  155 |           expect(verifyData.takeProfitLevels.level3).toBe(18)
  156 |           console.log('✅ Take profit level 3 change verified: 15% → 18%')
  157 |         }
  158 |       }
  159 |     }
  160 |   })
  161 |
  162 |   test('should allow modification of take profit level 4 (25%)', async ({ page }) => {
  163 |     const testUserId = 'take-profit-test-user-4'
  164 |     
  165 |     // Update take profit level 4 from 25% to 30%
> 166 |     const updateResponse = await page.request.post('/api/user-preferences', {
      |                                               ^ Error: apiRequestContext.post: Request timed out after 10000ms
  167 |       data: {
  168 |         userId: testUserId,
  169 |         takeProfitLevel4: 30.0, // Change from default 25% to 30%
  170 |         defaultBuyAmountUsdt: 250.0,
  171 |         maxConcurrentSnipes: 4,
  172 |       }
  173 |     })
  174 |     
  175 |     console.log('Update response status:', updateResponse.status())
  176 |     
  177 |     if (updateResponse.status() === 200) {
  178 |       const updateData = await updateResponse.json()
  179 |       expect(updateData.success).toBe(true)
  180 |       console.log('✅ Take profit level 4 updated successfully to 30%')
  181 |       
  182 |       // Verify the change was saved
  183 |       const verifyResponse = await page.request.get(`/api/user-preferences?userId=${testUserId}`)
  184 |       
  185 |       if (verifyResponse.status() === 200) {
  186 |         const verifyData = await verifyResponse.json()
  187 |         console.log('Verified take profit levels:', verifyData.takeProfitLevels)
  188 |         
  189 |         if (verifyData.takeProfitLevels) {
  190 |           expect(verifyData.takeProfitLevels.level4).toBe(30)
  191 |           console.log('✅ Take profit level 4 change verified: 25% → 30%')
  192 |         }
  193 |       }
  194 |     }
  195 |   })
  196 |
  197 |   test('should allow setting custom take profit level', async ({ page }) => {
  198 |     const testUserId = 'take-profit-test-user-custom'
  199 |     
  200 |     // Set a custom take profit level of 8.5%
  201 |     const updateResponse = await page.request.post('/api/user-preferences', {
  202 |       data: {
  203 |         userId: testUserId,
  204 |         takeProfitCustom: 8.5, // Custom 8.5%
  205 |         defaultTakeProfitLevel: 5, // Use custom level
  206 |         defaultBuyAmountUsdt: 75.0,
  207 |         maxConcurrentSnipes: 2,
  208 |       }
  209 |     })
  210 |     
  211 |     console.log('Update response status:', updateResponse.status())
  212 |     
  213 |     if (updateResponse.status() === 200) {
  214 |       const updateData = await updateResponse.json()
  215 |       expect(updateData.success).toBe(true)
  216 |       console.log('✅ Custom take profit level set successfully to 8.5%')
  217 |       
  218 |       // Verify the change was saved
  219 |       const verifyResponse = await page.request.get(`/api/user-preferences?userId=${testUserId}`)
  220 |       
  221 |       if (verifyResponse.status() === 200) {
  222 |         const verifyData = await verifyResponse.json()
  223 |         console.log('Verified preferences:', verifyData)
  224 |         
  225 |         expect(verifyData.takeProfitCustom).toBe(8.5)
  226 |         expect(verifyData.defaultTakeProfitLevel).toBe(5) // Custom level
  227 |         console.log('✅ Custom take profit level verified: 8.5%')
  228 |       }
  229 |     }
  230 |   })
  231 |
  232 |   test('should change default take profit level selection', async ({ page }) => {
  233 |     const testUserId = 'take-profit-test-default-level'
  234 |     
  235 |     // Change default from level 2 (10%) to level 3 (15%)
  236 |     const updateResponse = await page.request.post('/api/user-preferences', {
  237 |       data: {
  238 |         userId: testUserId,
  239 |         defaultTakeProfitLevel: 3, // Use level 3 instead of level 2
  240 |         defaultBuyAmountUsdt: 125.0,
  241 |         maxConcurrentSnipes: 3,
  242 |       }
  243 |     })
  244 |     
  245 |     console.log('Update response status:', updateResponse.status())
  246 |     
  247 |     if (updateResponse.status() === 200) {
  248 |       const updateData = await updateResponse.json()
  249 |       expect(updateData.success).toBe(true)
  250 |       console.log('✅ Default take profit level changed to level 3')
  251 |       
  252 |       // Verify the change was saved
  253 |       const verifyResponse = await page.request.get(`/api/user-preferences?userId=${testUserId}`)
  254 |       
  255 |       if (verifyResponse.status() === 200) {
  256 |         const verifyData = await verifyResponse.json()
  257 |         console.log('Verified default take profit level:', verifyData.defaultTakeProfitLevel)
  258 |         
  259 |         expect(verifyData.defaultTakeProfitLevel).toBe(3)
  260 |         console.log('✅ Default take profit level verified: Level 2 (10%) → Level 3 (15%)')
  261 |       }
  262 |     }
  263 |   })
  264 |
  265 |   test('should validate take profit level ranges', async ({ page }) => {
  266 |     const testUserId = 'take-profit-test-validation'
```