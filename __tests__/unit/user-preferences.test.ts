import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getUserPreferences, type UserPreferences } from '@/src/lib/user-preferences'

describe('getUserPreferences', () => {
  const userId = 'test-user'

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns parsed preferences when request succeeds', async () => {
    const prefs: UserPreferences = {
      userId,
      defaultBuyAmountUsdt: 50,
      maxConcurrentSnipes: 1,
      takeProfitLevels: { level1: 5, level2: 10, level3: 15, level4: 25 },
      defaultTakeProfitLevel: 2,
      stopLossPercent: 4,
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

    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => prefs })

    const result = await getUserPreferences(userId)
    expect(result).toEqual(prefs)
    expect(fetch).toHaveBeenCalledWith(`/api/user-preferences?userId=${userId}`)
  })

  it('returns null when request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false })

    const result = await getUserPreferences(userId)
    expect(result).toBeNull()
  })

  it('returns null on network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network'))

    const result = await getUserPreferences(userId)
    expect(result).toBeNull()
  })
})
