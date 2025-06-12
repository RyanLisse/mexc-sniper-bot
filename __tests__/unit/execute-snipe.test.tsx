// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePatternSniper } from '@/src/hooks/use-pattern-sniper'

describe('executeSnipe', () => {
  it('uses user preferences for snipe parameters', async () => {
    const prefs = {
      userId: 'user',
      defaultBuyAmountUsdt: 75,
      maxConcurrentSnipes: 1,
      takeProfitLevels: { level1: 5, level2: 10, level3: 15, level4: 25 },
      defaultTakeProfitLevel: 3,
      stopLossPercent: 6,
      riskTolerance: 'medium',
      readyStatePattern: [2,2,4],
      targetAdvanceHours: 3,
      calendarPollIntervalSeconds: 300,
      symbolsPollIntervalSeconds: 30,
      selectedExitStrategy: 'balanced',
      customExitStrategy: undefined,
      autoBuyEnabled: true,
      autoSellEnabled: true,
      autoSnipeEnabled: true,
    }

    const fetchMock = vi.fn((url: string, options?: RequestInit) => {
      if (url.startsWith('/api/user-preferences')) {
        return Promise.resolve({ ok: true, json: async () => prefs })
      }
      if (url.startsWith('/api/snipe-targets')) {
        return Promise.resolve({ ok: true, json: async () => ({ data: { id: 1 } }) })
      }
      if (url.startsWith('/api/mexc/trade')) {
        return Promise.resolve({ ok: true, json: async () => ({ success: true, order: { price: 1, quantity: 1, orderId: '1', status: 'done' } }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: [] }) })
    })
    global.fetch = fetchMock as any

    const client = new QueryClient()
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => usePatternSniper(), { wrapper })

    const target = {
      symbol: 'TEST',
      projectName: 'Test',
      launchTime: new Date(),
      orderParameters: { quantity: '10' },
      vcoinId: 'v1',
      confidence: 0.9,
      discoveredAt: new Date(),
      hoursAdvanceNotice: 1,
    } as any

    await act(async () => {
      await result.current.executeSnipe(target, 'user')
    })

    const call = fetchMock.mock.calls.find(c => c[0] === '/api/snipe-targets')
    expect(call).toBeTruthy()
    const body = JSON.parse((call as any)[1].body as string)
    expect(body.positionSizeUsdt).toBe(prefs.defaultBuyAmountUsdt)
    expect(body.takeProfitLevel).toBe(prefs.defaultTakeProfitLevel)
    expect(body.stopLossPercent).toBe(prefs.stopLossPercent)
  })
})
