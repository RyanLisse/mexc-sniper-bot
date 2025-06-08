import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, POST } from '../../../app/api/user-preferences/route'
import { NextRequest } from 'next/server'

// Mock the database
vi.mock('@/src/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn(),
  },
  userPreferences: {},
}))

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}))

describe('/api/user-preferences', () => {
  describe('GET', () => {
    it('should return 400 if userId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/user-preferences')
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('userId parameter is required')
    })

    it('should return null if no preferences found', async () => {
      const { db } = await import('@/src/db')
      vi.mocked(db.limit).mockResolvedValueOnce([])

      const request = new NextRequest('http://localhost:3000/api/user-preferences?userId=test-user')
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data).toBeNull()
    })

    it('should return formatted preferences if found', async () => {
      const mockPrefs = {
        userId: 'test-user',
        defaultBuyAmountUsdt: 100.0,
        maxConcurrentSnipes: 3,
        takeProfitLevel1: 5.0,
        takeProfitLevel2: 10.0,
        takeProfitLevel3: 15.0,
        takeProfitLevel4: 25.0,
        takeProfitCustom: null,
        defaultTakeProfitLevel: 2,
        stopLossPercent: 5.0,
        riskTolerance: 'medium',
        readyStatePattern: '2,2,4',
        targetAdvanceHours: 3.5,
        calendarPollIntervalSeconds: 300,
        symbolsPollIntervalSeconds: 30,
      }

      const { db } = await import('@/src/db')
      vi.mocked(db.limit).mockResolvedValueOnce([mockPrefs])

      const request = new NextRequest('http://localhost:3000/api/user-preferences?userId=test-user')
      const response = await GET(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.userId).toBe('test-user')
      expect(data.takeProfitLevels.level1).toBe(5.0)
      expect(data.readyStatePattern).toEqual([2, 2, 4])
    })
  })

  describe('POST', () => {
    it('should return 400 if userId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/user-preferences', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(400)
      expect(data.error).toBe('userId is required')
    })

    it('should update existing preferences', async () => {
      const { db } = await import('@/src/db')
      vi.mocked(db.returning).mockResolvedValueOnce([{ id: 1 }])

      const requestBody = {
        userId: 'test-user',
        defaultBuyAmountUsdt: 150.0,
        maxConcurrentSnipes: 5,
      }

      const request = new NextRequest('http://localhost:3000/api/user-preferences', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      })
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should create new preferences if none exist', async () => {
      const { db } = await import('@/src/db')
      vi.mocked(db.returning).mockResolvedValueOnce([])
      vi.mocked(db.values).mockResolvedValueOnce({})

      const requestBody = {
        userId: 'new-user',
        defaultBuyAmountUsdt: 200.0,
      }

      const request = new NextRequest('http://localhost:3000/api/user-preferences', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      })
      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })
})