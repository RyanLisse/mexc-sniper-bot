import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExecuteTradeUseCase } from '@/src/application/use-cases/trading/execute-trade-use-case'
import { Trade } from '@/src/domain/entities/trading/trade'
import type { NotificationService, TradingRepository, TradingService } from '@/src/application/interfaces/trading-repository'

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../utils/timeout-elimination-helpers';

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

describe('ExecuteTradeUseCase', () => {
  let useCase: ExecuteTradeUseCase
  let mocks: ReturnType<typeof createMocks>
  let trade: Trade

  beforeEach(() => {
    mocks = createMocks()
    useCase = new ExecuteTradeUseCase(
      mocks.repo,
      mocks.service,
      mocks.notify,
      mocks.logger
    )
    trade = Trade.create({
      userId: 'user1',
      symbol: 'TESTUSDT',
      isAutoSnipe: true,
      confidenceScore: 80,
      paperTrade: true
    })
  })

  it('executes market order successfully', async () => {
    mocks.repo.findTradeById.mockResolvedValue(trade)
    mocks.service.canTrade.mockResolvedValue(true)
    mocks.service.executeTrade.mockResolvedValue({
      success: true,
      data: {
        orderId: 'order123',
        symbol: 'TESTUSDT',
        side: 'BUY',
        type: 'MARKET',
        quantity: '100',
        price: '1',
        status: 'FILLED',
        executedQty: '100',
        timestamp: new Date().toISOString()
      },
      executionTime: 10
    })
    mocks.repo.updateTrade.mockResolvedValue(trade)

    const result = await useCase.execute({
      tradeId: trade.id,
      symbol: 'TESTUSDT',
      side: 'BUY',
      type: 'MARKET',
      quoteOrderQty: 100,
      timeInForce: 'IOC',
      paperTrade: true
    })

    expect(result.success).toBe(true)
    expect(mocks.service.executeTrade).toHaveBeenCalled()
    expect(mocks.notify.notifyTradeExecution).toHaveBeenCalled()
    expect(mocks.repo.updateTrade).toHaveBeenCalled()
  })

  it('handles execution failure and notifies', async () => {
    mocks.repo.findTradeById.mockResolvedValue(trade)
    mocks.service.canTrade.mockResolvedValue(true)
    mocks.service.executeTrade.mockResolvedValue({ success: false, error: 'api fail', executionTime: 5 })
    mocks.repo.updateTrade.mockResolvedValue(trade)

    const result = await useCase.execute({
      tradeId: trade.id,
      symbol: 'TESTUSDT',
      side: 'BUY',
      type: 'MARKET',
      quoteOrderQty: 100,
      timeInForce: 'IOC',
      paperTrade: true
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('api fail')
    expect(mocks.notify.notifyTradeFailure).toHaveBeenCalled()
    expect(mocks.repo.updateTrade).toHaveBeenCalled()
  })

  it('validates input parameters', async () => {
    const result = await useCase.execute({
      tradeId: trade.id,
      symbol: 'TESTUSDT',
      side: 'BUY',
      type: 'MARKET',
      // missing quantity and quoteOrderQty -> should fail
      paperTrade: true
    })

    expect(result.success).toBe(false)
    expect(result.error).toMatch('Either quantity or quoteOrderQty')
  })
})

