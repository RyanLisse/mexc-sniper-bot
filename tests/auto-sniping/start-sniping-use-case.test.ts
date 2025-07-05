import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StartSnipingUseCase } from '@/src/application/use-cases/trading/start-sniping-use-case'
import { Trade } from '@/src/domain/entities/trading/trade'
import type { NotificationService, TradingRepository, TradingService } from '@/src/application/interfaces/trading-repository'

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../utils/timeout-utilities';

const createMocks = () => {
  const repo: TradingRepository = {
    saveTrade: vi.fn(),
    findTradeById: vi.fn(),
    findTradesByUserId: vi.fn(),
    findTradesBySymbol: vi.fn(),
    findActiveTradesByUserId: vi.fn(),
    updateTrade: vi.fn(),
    deleteTrade: vi.fn(),
    getTradingMetrics: vi.fn()
  }

  const service: TradingService = {
    executeTrade: vi.fn(),
    getCurrentPrice: vi.fn(),
    canTrade: vi.fn()
  }

  const notify: NotificationService = {
    notifyTradeExecution: vi.fn(),
    notifyTradeCompletion: vi.fn(),
    notifyTradeFailure: vi.fn()
  }

  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }

  return { repo, service, notify, logger }
}

const baseInput = {
  userId: 'user1',
  symbol: 'TESTUSDT',
  confidenceScore: 80,
  positionSizeUsdt: 100,
  paperTrade: true
}

describe('StartSnipingUseCase', () => {
  let useCase: StartSnipingUseCase
  let mocks: ReturnType<typeof createMocks>

  beforeEach(() => {
    mocks = createMocks()
    useCase = new StartSnipingUseCase(
      mocks.repo,
      mocks.service,
      mocks.notify,
      mocks.logger
    )
  })

  it('starts sniping when parameters are valid', async () => {
    const input = { ...baseInput }

    mocks.service.canTrade.mockResolvedValue(true)
    mocks.service.getCurrentPrice.mockResolvedValue(1)
    mocks.repo.findActiveTradesByUserId.mockResolvedValue([])

    const trade = Trade.create({
      userId: input.userId,
      symbol: input.symbol,
      strategy: 'auto-snipe',
      isAutoSnipe: true,
      confidenceScore: input.confidenceScore,
      paperTrade: input.paperTrade
    })

    mocks.repo.saveTrade.mockResolvedValue(trade)
    mocks.repo.updateTrade.mockResolvedValue(trade.startExecution())

    const result = await useCase.execute(input)

    expect(result.success).toBe(true)
    expect(result.tradeId).toBeDefined()
    expect(mocks.repo.saveTrade).toHaveBeenCalled()
    expect(mocks.repo.updateTrade).toHaveBeenCalled()
    expect(mocks.notify.notifyTradeExecution).toHaveBeenCalled()
  })

  it('fails when symbol is not tradeable', async () => {
    const input = { ...baseInput }

    mocks.service.canTrade.mockResolvedValue(false)

    const result = await useCase.execute(input)

    expect(result.success).toBe(false)
    expect(result.error).toMatch('not available for trading')
    expect(mocks.repo.saveTrade).not.toHaveBeenCalled()
  })
})

