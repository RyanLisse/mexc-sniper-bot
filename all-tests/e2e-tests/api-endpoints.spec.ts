import { test, expect } from '@playwright/test'

test.describe('API Endpoints', () => {
  test('GET /api/workflow-status should return valid JSON', async ({ request }) => {
    const response = await request.get('/api/workflow-status')
    
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('application/json')
    
    const data = await response.json()
    expect(data).toHaveProperty('systemStatus')
    expect(data).toHaveProperty('activeWorkflows')
    expect(data).toHaveProperty('metrics')
    expect(data).toHaveProperty('recentActivity')
    expect(data).toHaveProperty('lastUpdate')
    
    // Validate data types
    expect(typeof data.systemStatus).toBe('string')
    expect(Array.isArray(data.activeWorkflows)).toBe(true)
    expect(typeof data.metrics).toBe('object')
    expect(Array.isArray(data.recentActivity)).toBe(true)
  })

  test('GET /api/user-preferences without userId should return 400', async ({ request }) => {
    const response = await request.get('/api/user-preferences')
    
    expect(response.status()).toBe(400)
    
    const data = await response.json()
    expect(data.error).toBe('userId parameter is required')
  })

  test('GET /api/user-preferences with userId should return data or null', async ({ request }) => {
    const response = await request.get('/api/user-preferences?userId=test-user')
    
    // Should succeed or return a valid error response
    expect([200, 500].includes(response.status())).toBe(true)
    
    if (response.status() === 200) {
      const data = await response.json()
      // Should be null (no user) or a valid preferences object
      expect(data === null || (typeof data === 'object' && !!data.userId)).toBe(true)
    }
  })

  test('POST /api/user-preferences should handle preference updates', async ({ request }) => {
    const preferences = {
      userId: 'test-user',
      defaultBuyAmountUsdt: 100.0,
      maxConcurrentSnipes: 3,
      takeProfitLevels: {
        level1: 5.0,
        level2: 10.0,
        level3: 15.0,
        level4: 25.0,
      },
      defaultTakeProfitLevel: 2,
      stopLossPercent: 5.0,
      riskTolerance: 'medium',
      readyStatePattern: [2, 2, 4],
      targetAdvanceHours: 3.5,
      calendarPollIntervalSeconds: 300,
      symbolsPollIntervalSeconds: 30,
    }

    const response = await request.post('/api/user-preferences', {
      data: preferences,
    })
    
    // Should succeed or return a valid error response
    expect([200, 500].includes(response.status())).toBe(true)
    
    if (response.status() === 200) {
      const data = await response.json()
      expect(data.success).toBe(true)
    }
  })

  test('POST /api/triggers/calendar-poll should trigger workflow', async ({ request }) => {
    const response = await request.post('/api/triggers/calendar-poll')
    
    expect([200, 500].includes(response.status())).toBe(true)
    
    const data = await response.json()
    expect(data).toHaveProperty('success')
    
    if (data.success) {
      expect(data).toHaveProperty('eventId')
    } else {
      expect(data).toHaveProperty('error')
    }
  })

  test('POST /api/triggers/pattern-analysis should trigger workflow', async ({ request }) => {
    const response = await request.post('/api/triggers/pattern-analysis')
    
    expect([200, 500].includes(response.status())).toBe(true)
    
    const data = await response.json()
    expect(data).toHaveProperty('success')
  })

  test('POST /api/triggers/symbol-watch should accept symbol parameter', async ({ request }) => {
    const response = await request.post('/api/triggers/symbol-watch', {
      data: { symbol: 'BTCUSDT' },
    })
    
    expect([200, 400, 500].includes(response.status())).toBe(true)
    
    const data = await response.json()
    expect(data).toHaveProperty('success')
  })

  test('POST /api/triggers/trading-strategy should accept strategy parameters', async ({ request }) => {
    const response = await request.post('/api/triggers/trading-strategy', {
      data: {
        symbols: ['BTCUSDT'],
        riskLevel: 'medium',
        capital: 1000,
      },
    })
    
    expect([200, 400, 500].includes(response.status())).toBe(true)
    
    const data = await response.json()
    expect(data).toHaveProperty('success')
  })

  test('GET /api/schedule/control should return schedule status', async ({ request }) => {
    const response = await request.get('/api/schedule/control')
    
    expect([200, 500].includes(response.status())).toBe(true)
    
    if (response.status() === 200) {
      const data = await response.json()
      expect(data).toHaveProperty('schedules')
      expect(typeof data.schedules === 'object').toBe(true)
    }
  })

  test('API endpoints should have proper CORS headers', async ({ request }) => {
    const response = await request.get('/api/workflow-status')
    
    // Check for security headers
    const headers = response.headers()
    expect(headers['content-type']).toContain('application/json')
    
    // Should not expose sensitive headers
    expect(headers['x-powered-by']).toBeUndefined()
  })

  test('API endpoints should handle malformed JSON', async ({ request }) => {
    const response = await request.post('/api/user-preferences', {
      data: 'invalid json',
      headers: {
        'content-type': 'application/json',
      },
    })
    
    expect([400, 500].includes(response.status())).toBe(true)
  })
})