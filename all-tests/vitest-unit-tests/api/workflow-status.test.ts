import { describe, it, expect } from 'vitest'
import { GET } from '../../../app/api/workflow-status/route'
import { NextRequest } from 'next/server'

describe('/api/workflow-status', () => {
  it('should return workflow status with default values', async () => {
    const request = new NextRequest('http://localhost:3000/api/workflow-status')
    const response = await GET(request)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data).toMatchObject({
      systemStatus: 'stopped',
      activeWorkflows: [],
      metrics: {
        readyTokens: 0,
        totalDetections: 0,
        successfulSnipes: 0,
        totalProfit: 0,
        successRate: 0,
        averageROI: 0,
        bestTrade: 0,
      },
      recentActivity: [],
    })
    expect(data.lastUpdate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('should return valid JSON structure', async () => {
    const request = new NextRequest('http://localhost:3000/api/workflow-status')
    const response = await GET(request)
    
    expect(response.headers.get('content-type')).toContain('application/json')
    
    const data = await response.json()
    expect(typeof data.systemStatus).toBe('string')
    expect(Array.isArray(data.activeWorkflows)).toBe(true)
    expect(Array.isArray(data.recentActivity)).toBe(true)
    expect(typeof data.metrics).toBe('object')
  })
})