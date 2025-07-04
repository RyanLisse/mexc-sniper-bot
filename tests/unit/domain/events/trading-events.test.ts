/**
 * Unit tests for Trading Domain Events
 * Tests trading event interfaces, factory methods, and event structure validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TradeExecutionStartedEvent,
  TradeExecutionCompletedEvent,
  TradeExecutionFailedEvent,
  PositionOpenedEvent,
  PositionClosedEvent,
  PositionModifiedEvent,
  AutoSnipeTriggeredEvent,
  AutoSnipeExecutedEvent,
  TradingStrategyActivatedEvent,
  TradingStrategyDeactivatedEvent,
  StrategyPerformanceUpdatedEvent,
  RiskLimitExceededEvent,
  CircuitBreakerTriggeredEvent,
  ProfitTargetReachedEvent,
  TradingDomainEvent,
  TradingEventFactory,
} from '../../../../src/domain/events/trading-events';

describe('Trading Domain Events', () => {
  let testTimestamp: Date;
  let testTradeId: string;
  let testUserId: string;

  beforeEach(() => {
    testTimestamp = new Date();
    testTradeId = 'trade-123';
    testUserId = 'user-456';
  });

  describe('Trade Execution Events', () => {
    describe('TradeExecutionStartedEvent', () => {
      it('should create valid trade execution started event', () => {
        const payload: TradeExecutionStartedEvent['payload'] = {
          symbol: 'BTCUSDT',
          side: 'BUY',
          orderType: 'MARKET',
          quantity: 1.5,
          isAutoSnipe: false,
        };

        const event: TradeExecutionStartedEvent = {
          type: 'trade.execution.started',
          aggregateId: testTradeId,
          userId: testUserId,
          payload,
          occurredAt: testTimestamp,
          eventId: 'event-123',
        };

        expect(event.type).toBe('trade.execution.started');
        expect(event.aggregateId).toBe(testTradeId);
        expect(event.userId).toBe(testUserId);
        expect(event.payload.symbol).toBe('BTCUSDT');
        expect(event.payload.side).toBe('BUY');
        expect(event.payload.orderType).toBe('MARKET');
        expect(event.payload.quantity).toBe(1.5);
        expect(event.payload.isAutoSnipe).toBe(false);
        expect(event.occurredAt).toBe(testTimestamp);
      });

      it('should handle optional parameters', () => {
        const payload: TradeExecutionStartedEvent['payload'] = {
          symbol: 'ETHUSDT',
          side: 'SELL',
          orderType: 'LIMIT',
          price: 2500.50,
          quoteOrderQty: 1000,
          strategy: 'MeanReversion',
          isAutoSnipe: true,
          confidenceScore: 85.5,
        };

        const event: TradeExecutionStartedEvent = {
          type: 'trade.execution.started',
          aggregateId: testTradeId,
          userId: testUserId,
          payload,
          occurredAt: testTimestamp,
        };

        expect(event.payload.price).toBe(2500.50);
        expect(event.payload.quoteOrderQty).toBe(1000);
        expect(event.payload.strategy).toBe('MeanReversion');
        expect(event.payload.confidenceScore).toBe(85.5);
      });

      it('should handle both BUY and SELL sides', () => {
        const buyPayload: TradeExecutionStartedEvent['payload'] = {
          symbol: 'ADAUSDT',
          side: 'BUY',
          orderType: 'MARKET',
          isAutoSnipe: false,
        };

        const sellPayload: TradeExecutionStartedEvent['payload'] = {
          symbol: 'ADAUSDT',
          side: 'SELL',
          orderType: 'MARKET',
          isAutoSnipe: false,
        };

        expect(buyPayload.side).toBe('BUY');
        expect(sellPayload.side).toBe('SELL');
      });

      it('should handle both MARKET and LIMIT order types', () => {
        const marketPayload: TradeExecutionStartedEvent['payload'] = {
          symbol: 'DOGEUSDT',
          side: 'BUY',
          orderType: 'MARKET',
          isAutoSnipe: false,
        };

        const limitPayload: TradeExecutionStartedEvent['payload'] = {
          symbol: 'DOGEUSDT',
          side: 'BUY',
          orderType: 'LIMIT',
          price: 0.08,
          isAutoSnipe: false,
        };

        expect(marketPayload.orderType).toBe('MARKET');
        expect(limitPayload.orderType).toBe('LIMIT');
        expect(limitPayload.price).toBe(0.08);
      });
    });

    describe('TradeExecutionCompletedEvent', () => {
      it('should create valid trade execution completed event', () => {
        const payload: TradeExecutionCompletedEvent['payload'] = {
          orderId: 'order-789',
          symbol: 'BTCUSDT',
          side: 'BUY',
          executedQuantity: '1.5',
          executedPrice: '45000.00',
          totalCost: 67500.00,
          fees: 67.50,
          executionTimeMs: 150,
          status: 'FILLED',
        };

        const event: TradeExecutionCompletedEvent = {
          type: 'trade.execution.completed',
          aggregateId: testTradeId,
          userId: testUserId,
          payload,
          occurredAt: testTimestamp,
        };

        expect(event.type).toBe('trade.execution.completed');
        expect(event.payload.orderId).toBe('order-789');
        expect(event.payload.symbol).toBe('BTCUSDT');
        expect(event.payload.executedQuantity).toBe('1.5');
        expect(event.payload.executedPrice).toBe('45000.00');
        expect(event.payload.totalCost).toBe(67500.00);
        expect(event.payload.fees).toBe(67.50);
        expect(event.payload.executionTimeMs).toBe(150);
        expect(event.payload.status).toBe('FILLED');
      });

      it('should handle optional slippage information', () => {
        const payload: TradeExecutionCompletedEvent['payload'] = {
          orderId: 'order-790',
          symbol: 'ETHUSDT',
          side: 'SELL',
          executedQuantity: '10.0',
          executedPrice: '2495.75',
          totalCost: 24957.50,
          fees: 24.96,
          executionTimeMs: 200,
          slippagePercent: 0.5,
          status: 'PARTIALLY_FILLED',
        };

        const event: TradeExecutionCompletedEvent = {
          type: 'trade.execution.completed',
          aggregateId: testTradeId,
          userId: testUserId,
          payload,
          occurredAt: testTimestamp,
        };

        expect(event.payload.slippagePercent).toBe(0.5);
        expect(event.payload.status).toBe('PARTIALLY_FILLED');
      });
    });

    describe('TradeExecutionFailedEvent', () => {
      it('should create valid trade execution failed event', () => {
        const payload: TradeExecutionFailedEvent['payload'] = {
          symbol: 'BTCUSDT',
          side: 'BUY',
          reason: 'Insufficient balance',
          errorCode: 'INSUFFICIENT_FUNDS',
          attemptedQuantity: 1.5,
          attemptedPrice: 45000.00,
        };

        const event: TradeExecutionFailedEvent = {
          type: 'trade.execution.failed',
          aggregateId: testTradeId,
          userId: testUserId,
          payload,
          occurredAt: testTimestamp,
        };

        expect(event.type).toBe('trade.execution.failed');
        expect(event.payload.symbol).toBe('BTCUSDT');
        expect(event.payload.reason).toBe('Insufficient balance');
        expect(event.payload.errorCode).toBe('INSUFFICIENT_FUNDS');
        expect(event.payload.attemptedQuantity).toBe(1.5);
        expect(event.payload.attemptedPrice).toBe(45000.00);
      });

      it('should handle minimal failure information', () => {
        const payload: TradeExecutionFailedEvent['payload'] = {
          symbol: 'ETHUSDT',
          side: 'SELL',
          reason: 'Market closed',
        };

        const event: TradeExecutionFailedEvent = {
          type: 'trade.execution.failed',
          aggregateId: testTradeId,
          userId: testUserId,
          payload,
          occurredAt: testTimestamp,
        };

        expect(event.payload.errorCode).toBeUndefined();
        expect(event.payload.attemptedQuantity).toBeUndefined();
        expect(event.payload.attemptedPrice).toBeUndefined();
      });
    });
  });

  describe('Position Management Events', () => {
    describe('PositionOpenedEvent', () => {
      it('should create valid position opened event', () => {
        const payload: PositionOpenedEvent['payload'] = {
          positionId: 'pos-123',
          symbol: 'BTCUSDT',
          entryPrice: 45000.00,
          quantity: 1.5,
          side: 'LONG',
          strategy: 'MeanReversion',
          autoSnipe: false,
        };

        const event: PositionOpenedEvent = {
          type: 'position.opened',
          aggregateId: 'pos-123',
          userId: testUserId,
          payload,
          occurredAt: testTimestamp,
        };

        expect(event.type).toBe('position.opened');
        expect(event.payload.positionId).toBe('pos-123');
        expect(event.payload.symbol).toBe('BTCUSDT');
        expect(event.payload.entryPrice).toBe(45000.00);
        expect(event.payload.quantity).toBe(1.5);
        expect(event.payload.side).toBe('LONG');
        expect(event.payload.strategy).toBe('MeanReversion');
        expect(event.payload.autoSnipe).toBe(false);
      });

      it('should handle optional risk management parameters', () => {
        const payload: PositionOpenedEvent['payload'] = {
          positionId: 'pos-124',
          symbol: 'ETHUSDT',
          entryPrice: 2500.00,
          quantity: 10.0,
          side: 'SHORT',
          strategy: 'Scalping',
          stopLossPercent: 2.0,
          takeProfitPercent: 5.0,
          autoSnipe: true,
          confidenceScore: 92.5,
        };

        const event: PositionOpenedEvent = {
          type: 'position.opened',
          aggregateId: 'pos-124',
          userId: testUserId,
          payload,
          occurredAt: testTimestamp,
        };

        expect(event.payload.stopLossPercent).toBe(2.0);
        expect(event.payload.takeProfitPercent).toBe(5.0);
        expect(event.payload.confidenceScore).toBe(92.5);
        expect(event.payload.side).toBe('SHORT');
      });
    });

    describe('PositionClosedEvent', () => {
      it('should create valid position closed event', () => {
        const payload: PositionClosedEvent['payload'] = {
          positionId: 'pos-123',
          symbol: 'BTCUSDT',
          entryPrice: 45000.00,
          exitPrice: 46500.00,
          quantity: 1.5,
          realizedPnL: 2250.00,
          pnlPercentage: 3.33,
          fees: 22.50,
          holdingTimeMs: 3600000, // 1 hour
          closedBy: 'TAKE_PROFIT',
        };

        const event: PositionClosedEvent = {
          type: 'position.closed',
          aggregateId: 'pos-123',
          userId: testUserId,
          payload,
          occurredAt: testTimestamp,
        };

        expect(event.type).toBe('position.closed');
        expect(event.payload.positionId).toBe('pos-123');
        expect(event.payload.realizedPnL).toBe(2250.00);
        expect(event.payload.pnlPercentage).toBe(3.33);
        expect(event.payload.closedBy).toBe('TAKE_PROFIT');
        expect(event.payload.holdingTimeMs).toBe(3600000);
      });

      it('should handle different close reasons', () => {
        const stopLossPayload: PositionClosedEvent['payload'] = {
          positionId: 'pos-124',
          symbol: 'ETHUSDT',
          entryPrice: 2500.00,
          exitPrice: 2450.00,
          quantity: 10.0,
          realizedPnL: -500.00,
          pnlPercentage: -2.0,
          fees: 25.00,
          holdingTimeMs: 1800000,
          closedBy: 'STOP_LOSS',
        };

        const manualPayload: PositionClosedEvent['payload'] = {
          positionId: 'pos-125',
          symbol: 'ADAUSDT',
          entryPrice: 0.50,
          exitPrice: 0.52,
          quantity: 1000.0,
          realizedPnL: 20.00,
          pnlPercentage: 4.0,
          fees: 1.00,
          holdingTimeMs: 7200000,
          closedBy: 'MANUAL',
        };

        expect(stopLossPayload.closedBy).toBe('STOP_LOSS');
        expect(manualPayload.closedBy).toBe('MANUAL');
        expect(stopLossPayload.realizedPnL).toBeLessThan(0);
        expect(manualPayload.realizedPnL).toBeGreaterThan(0);
      });
    });

    describe('PositionModifiedEvent', () => {
      it('should create valid position modified event', () => {
        const payload: PositionModifiedEvent['payload'] = {
          positionId: 'pos-123',
          symbol: 'BTCUSDT',
          changes: {
            stopLossPercent: { from: 2.0, to: 1.5 },
            takeProfitPercent: { from: 5.0, to: 6.0 },
          },
          modifiedBy: 'USER',
        };

        const event: PositionModifiedEvent = {
          type: 'position.modified',
          aggregateId: 'pos-123',
          userId: testUserId,
          payload,
          occurredAt: testTimestamp,
        };

        expect(event.type).toBe('position.modified');
        expect(event.payload.positionId).toBe('pos-123');
        expect(event.payload.changes.stopLossPercent?.from).toBe(2.0);
        expect(event.payload.changes.stopLossPercent?.to).toBe(1.5);
        expect(event.payload.changes.takeProfitPercent?.from).toBe(5.0);
        expect(event.payload.changes.takeProfitPercent?.to).toBe(6.0);
        expect(event.payload.modifiedBy).toBe('USER');
      });

      it('should handle quantity modifications', () => {
        const payload: PositionModifiedEvent['payload'] = {
          positionId: 'pos-124',
          symbol: 'ETHUSDT',
          changes: {
            quantity: { from: 10.0, to: 8.0 },
          },
          modifiedBy: 'RISK_MANAGEMENT',
        };

        const event: PositionModifiedEvent = {
          type: 'position.modified',
          aggregateId: 'pos-124',
          userId: testUserId,
          payload,
          occurredAt: testTimestamp,
        };

        expect(event.payload.changes.quantity?.from).toBe(10.0);
        expect(event.payload.changes.quantity?.to).toBe(8.0);
        expect(event.payload.modifiedBy).toBe('RISK_MANAGEMENT');
      });
    });
  });

  describe('Auto-Sniping Events', () => {
    describe('AutoSnipeTriggeredEvent', () => {
      it('should create valid auto-snipe triggered event', () => {
        const payload: AutoSnipeTriggeredEvent['payload'] = {
          targetId: 42,
          symbol: 'BTCUSDT',
          confidenceScore: 88.5,
          positionSizeUsdt: 1000.00,
          triggeredBy: 'PATTERN_DETECTION',
          triggerConditions: ['RSI oversold', 'Support level bounce', 'Volume spike'],
        };

        const event: AutoSnipeTriggeredEvent = {
          type: 'auto_snipe.triggered',
          aggregateId: '42',
          userId: testUserId,
          payload,
          occurredAt: testTimestamp,
        };

        expect(event.type).toBe('auto_snipe.triggered');
        expect(event.payload.targetId).toBe(42);
        expect(event.payload.symbol).toBe('BTCUSDT');
        expect(event.payload.confidenceScore).toBe(88.5);
        expect(event.payload.positionSizeUsdt).toBe(1000.00);
        expect(event.payload.triggeredBy).toBe('PATTERN_DETECTION');
        expect(event.payload.triggerConditions).toHaveLength(3);
        expect(event.payload.triggerConditions).toContain('RSI oversold');
      });

      it('should handle different trigger sources', () => {
        const manualPayload: AutoSnipeTriggeredEvent['payload'] = {
          targetId: 43,
          symbol: 'ETHUSDT',
          confidenceScore: 95.0,
          positionSizeUsdt: 2000.00,
          triggeredBy: 'MANUAL',
          triggerConditions: ['User initiated'],
        };

        const scheduledPayload: AutoSnipeTriggeredEvent['payload'] = {
          targetId: 44,
          symbol: 'ADAUSDT',
          confidenceScore: 75.0,
          positionSizeUsdt: 500.00,
          triggeredBy: 'SCHEDULED',
          triggerConditions: ['Time-based trigger', 'Market hours'],
        };

        expect(manualPayload.triggeredBy).toBe('MANUAL');
        expect(scheduledPayload.triggeredBy).toBe('SCHEDULED');
      });
    });

    describe('AutoSnipeExecutedEvent', () => {
      it('should create valid auto-snipe executed event with success', () => {
        const payload: AutoSnipeExecutedEvent['payload'] = {
          targetId: 42,
          symbol: 'BTCUSDT',
          executionResult: {
            success: true,
            orderId: 'order-789',
            executedPrice: 45000.00,
            executedQuantity: 0.022,
          },
          confidenceScore: 88.5,
          executionLatencyMs: 125,
        };

        const event: AutoSnipeExecutedEvent = {
          type: 'auto_snipe.executed',
          aggregateId: '42',
          userId: testUserId,
          payload,
          occurredAt: testTimestamp,
        };

        expect(event.type).toBe('auto_snipe.executed');
        expect(event.payload.targetId).toBe(42);
        expect(event.payload.executionResult.success).toBe(true);
        expect(event.payload.executionResult.orderId).toBe('order-789');
        expect(event.payload.executionResult.executedPrice).toBe(45000.00);
        expect(event.payload.executionLatencyMs).toBe(125);
      });

      it('should handle execution failures', () => {
        const payload: AutoSnipeExecutedEvent['payload'] = {
          targetId: 43,
          symbol: 'ETHUSDT',
          executionResult: {
            success: false,
            error: 'Insufficient balance',
          },
          confidenceScore: 92.0,
          executionLatencyMs: 50,
        };

        const event: AutoSnipeExecutedEvent = {
          type: 'auto_snipe.executed',
          aggregateId: '43',
          userId: testUserId,
          payload,
          occurredAt: testTimestamp,
        };

        expect(event.payload.executionResult.success).toBe(false);
        expect(event.payload.executionResult.error).toBe('Insufficient balance');
        expect(event.payload.executionResult.orderId).toBeUndefined();
        expect(event.payload.executionResult.executedPrice).toBeUndefined();
      });
    });
  });

  describe('Strategy Events', () => {
    describe('TradingStrategyActivatedEvent', () => {
      it('should create valid strategy activated event', () => {
        const payload: TradingStrategyActivatedEvent['payload'] = {
          strategyId: 'strat-123',
          strategyName: 'Mean Reversion',
          symbols: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'],
          parameters: {
            rsiThreshold: 30,
            stopLossPercent: 2.0,
            takeProfitPercent: 5.0,
            maxPositions: 3,
          },
          activatedBy: 'USER',
        };

        const event: TradingStrategyActivatedEvent = {
          type: 'strategy.activated',
          aggregateId: 'strat-123',
          userId: testUserId,
          payload,
          occurredAt: testTimestamp,
        };

        expect(event.type).toBe('strategy.activated');
        expect(event.payload.strategyId).toBe('strat-123');
        expect(event.payload.strategyName).toBe('Mean Reversion');
        expect(event.payload.symbols).toHaveLength(3);
        expect(event.payload.symbols).toContain('BTCUSDT');
        expect(event.payload.parameters.rsiThreshold).toBe(30);
        expect(event.payload.activatedBy).toBe('USER');
      });

      it('should handle system activation', () => {
        const payload: TradingStrategyActivatedEvent['payload'] = {
          strategyId: 'strat-124',
          strategyName: 'Scalping Bot',
          symbols: ['BTCUSDT'],
          parameters: {
            timeframe: '1m',
            profitTarget: 0.1,
            maxDrawdown: 1.0,
          },
          activatedBy: 'SYSTEM',
        };

        expect(payload.activatedBy).toBe('SYSTEM');
      });
    });

    describe('TradingStrategyDeactivatedEvent', () => {
      it('should create valid strategy deactivated event', () => {
        const payload: TradingStrategyDeactivatedEvent['payload'] = {
          strategyId: 'strat-123',
          strategyName: 'Mean Reversion',
          reason: 'User stopped strategy',
          deactivatedBy: 'USER',
          finalMetrics: {
            totalTrades: 25,
            successRate: 68.0,
            totalPnL: 450.75,
            maxDrawdown: 125.50,
          },
        };

        const event: TradingStrategyDeactivatedEvent = {
          type: 'strategy.deactivated',
          aggregateId: 'strat-123',
          userId: testUserId,
          payload,
          occurredAt: testTimestamp,
        };

        expect(event.type).toBe('strategy.deactivated');
        expect(event.payload.strategyId).toBe('strat-123');
        expect(event.payload.reason).toBe('User stopped strategy');
        expect(event.payload.deactivatedBy).toBe('USER');
        expect(event.payload.finalMetrics.totalTrades).toBe(25);
        expect(event.payload.finalMetrics.successRate).toBe(68.0);
        expect(event.payload.finalMetrics.totalPnL).toBe(450.75);
      });

      it('should handle risk management deactivation', () => {
        const payload: TradingStrategyDeactivatedEvent['payload'] = {
          strategyId: 'strat-125',
          strategyName: 'High Risk Strategy',
          reason: 'Maximum drawdown exceeded',
          deactivatedBy: 'RISK_MANAGEMENT',
          finalMetrics: {
            totalTrades: 10,
            successRate: 30.0,
            totalPnL: -500.00,
            maxDrawdown: 500.00,
          },
        };

        expect(payload.deactivatedBy).toBe('RISK_MANAGEMENT');
        expect(payload.finalMetrics.totalPnL).toBeLessThan(0);
      });
    });

    describe('StrategyPerformanceUpdatedEvent', () => {
      it('should create valid strategy performance updated event', () => {
        const payload: StrategyPerformanceUpdatedEvent['payload'] = {
          strategyId: 'strat-123',
          strategyName: 'Mean Reversion',
          metrics: {
            totalTrades: 15,
            successfulTrades: 10,
            successRate: 66.67,
            totalPnL: 275.50,
            unrealizedPnL: 50.25,
            maxDrawdown: 75.00,
            sharpeRatio: 1.25,
            averageExecutionTime: 150,
          },
          timeframe: '24h',
        };

        const event: StrategyPerformanceUpdatedEvent = {
          type: 'strategy.performance.updated',
          aggregateId: 'strat-123',
          userId: testUserId,
          payload,
          occurredAt: testTimestamp,
        };

        expect(event.type).toBe('strategy.performance.updated');
        expect(event.payload.metrics.totalTrades).toBe(15);
        expect(event.payload.metrics.successfulTrades).toBe(10);
        expect(event.payload.metrics.successRate).toBe(66.67);
        expect(event.payload.metrics.sharpeRatio).toBe(1.25);
        expect(event.payload.timeframe).toBe('24h');
      });

      it('should handle different timeframes', () => {
        const timeframes: Array<'1h' | '24h' | '7d' | '30d'> = ['1h', '24h', '7d', '30d'];
        
        timeframes.forEach(timeframe => {
          const payload: StrategyPerformanceUpdatedEvent['payload'] = {
            strategyId: 'strat-123',
            strategyName: 'Test Strategy',
            metrics: {
              totalTrades: 5,
              successfulTrades: 3,
              successRate: 60.0,
              totalPnL: 100.0,
              unrealizedPnL: 0.0,
              maxDrawdown: 25.0,
              averageExecutionTime: 100,
            },
            timeframe,
          };

          expect(payload.timeframe).toBe(timeframe);
        });
      });
    });
  });

  describe('Risk Management Events', () => {
    describe('RiskLimitExceededEvent', () => {
      it('should create valid risk limit exceeded event', () => {
        const payload: RiskLimitExceededEvent['payload'] = {
          limitType: 'DAILY_LOSS',
          currentValue: 1500.00,
          limitValue: 1000.00,
          action: 'BLOCK_TRADES',
          affectedPositions: ['pos-123', 'pos-124'],
        };

        const event: RiskLimitExceededEvent = {
          type: 'risk.limit.exceeded',
          aggregateId: testUserId,
          userId: testUserId,
          payload,
          occurredAt: testTimestamp,
        };

        expect(event.type).toBe('risk.limit.exceeded');
        expect(event.payload.limitType).toBe('DAILY_LOSS');
        expect(event.payload.currentValue).toBe(1500.00);
        expect(event.payload.limitValue).toBe(1000.00);
        expect(event.payload.action).toBe('BLOCK_TRADES');
        expect(event.payload.affectedPositions).toHaveLength(2);
      });

      it('should handle different limit types and actions', () => {
        const limitTypes: Array<'POSITION_SIZE' | 'DAILY_LOSS' | 'DRAWDOWN' | 'EXPOSURE'> = 
          ['POSITION_SIZE', 'DAILY_LOSS', 'DRAWDOWN', 'EXPOSURE'];
        
        const actions: Array<'BLOCK_TRADES' | 'CLOSE_POSITIONS' | 'REDUCE_SIZE' | 'ALERT_ONLY'> = 
          ['BLOCK_TRADES', 'CLOSE_POSITIONS', 'REDUCE_SIZE', 'ALERT_ONLY'];

        limitTypes.forEach(limitType => {
          actions.forEach(action => {
            const payload: RiskLimitExceededEvent['payload'] = {
              limitType,
              currentValue: 100,
              limitValue: 80,
              action,
            };

            expect(payload.limitType).toBe(limitType);
            expect(payload.action).toBe(action);
          });
        });
      });
    });

    describe('CircuitBreakerTriggeredEvent', () => {
      it('should create valid circuit breaker triggered event', () => {
        const blockedUntil = new Date(Date.now() + 300000); // 5 minutes from now

        const payload: CircuitBreakerTriggeredEvent['payload'] = {
          reason: 'Too many failed trades',
          failureCount: 5,
          threshold: 3,
          blockedUntil,
          affectedOperations: ['trade.execution', 'position.opening'],
        };

        const event: CircuitBreakerTriggeredEvent = {
          type: 'circuit_breaker.triggered',
          aggregateId: testUserId,
          userId: testUserId,
          payload,
          occurredAt: testTimestamp,
        };

        expect(event.type).toBe('circuit_breaker.triggered');
        expect(event.payload.reason).toBe('Too many failed trades');
        expect(event.payload.failureCount).toBe(5);
        expect(event.payload.threshold).toBe(3);
        expect(event.payload.blockedUntil).toBe(blockedUntil);
        expect(event.payload.affectedOperations).toContain('trade.execution');
      });
    });
  });

  describe('Profit Target Events', () => {
    describe('ProfitTargetReachedEvent', () => {
      it('should create valid profit target reached event', () => {
        const payload: ProfitTargetReachedEvent['payload'] = {
          positionId: 'pos-123',
          symbol: 'BTCUSDT',
          targetLevel: 1,
          targetPercentage: 5.0,
          currentPnL: 225.50,
          currentPnLPercentage: 5.1,
          action: 'PARTIAL_CLOSE',
          executedQuantity: 0.5,
        };

        const event: ProfitTargetReachedEvent = {
          type: 'profit_target.reached',
          aggregateId: 'pos-123',
          userId: testUserId,
          payload,
          occurredAt: testTimestamp,
        };

        expect(event.type).toBe('profit_target.reached');
        expect(event.payload.positionId).toBe('pos-123');
        expect(event.payload.targetLevel).toBe(1);
        expect(event.payload.targetPercentage).toBe(5.0);
        expect(event.payload.currentPnL).toBe(225.50);
        expect(event.payload.action).toBe('PARTIAL_CLOSE');
        expect(event.payload.executedQuantity).toBe(0.5);
      });

      it('should handle different profit actions', () => {
        const actions: Array<'PARTIAL_CLOSE' | 'FULL_CLOSE' | 'TRAILING_STOP'> = 
          ['PARTIAL_CLOSE', 'FULL_CLOSE', 'TRAILING_STOP'];

        actions.forEach(action => {
          const payload: ProfitTargetReachedEvent['payload'] = {
            positionId: 'pos-124',
            symbol: 'ETHUSDT',
            targetLevel: 2,
            targetPercentage: 10.0,
            currentPnL: 500.00,
            currentPnLPercentage: 10.5,
            action,
          };

          expect(payload.action).toBe(action);
        });
      });
    });
  });

  describe('TradingEventFactory', () => {
    describe('createTradeExecutionStarted', () => {
      it('should create trade execution started event with factory', () => {
        const payload: TradeExecutionStartedEvent['payload'] = {
          symbol: 'BTCUSDT',
          side: 'BUY',
          orderType: 'MARKET',
          quantity: 1.0,
          isAutoSnipe: false,
        };

        const event = TradingEventFactory.createTradeExecutionStarted(
          testTradeId,
          testUserId,
          payload
        );

        expect(event.type).toBe('trade.execution.started');
        expect(event.aggregateId).toBe(testTradeId);
        expect(event.userId).toBe(testUserId);
        expect(event.payload).toBe(payload);
        expect(event.occurredAt).toBeInstanceOf(Date);
        expect(event.eventId).toMatch(/^trade-exec-start-\d+-[a-z0-9]+$/);
      });

      it('should generate unique event IDs', () => {
        const payload: TradeExecutionStartedEvent['payload'] = {
          symbol: 'BTCUSDT',
          side: 'BUY',
          orderType: 'MARKET',
          isAutoSnipe: false,
        };

        const event1 = TradingEventFactory.createTradeExecutionStarted('trade-1', 'user-1', payload);
        const event2 = TradingEventFactory.createTradeExecutionStarted('trade-2', 'user-2', payload);

        expect(event1.eventId).not.toBe(event2.eventId);
        expect(event1.eventId).toMatch(/^trade-exec-start-/);
        expect(event2.eventId).toMatch(/^trade-exec-start-/);
      });
    });

    describe('createTradeExecutionCompleted', () => {
      it('should create trade execution completed event with factory', () => {
        const payload: TradeExecutionCompletedEvent['payload'] = {
          orderId: 'order-123',
          symbol: 'BTCUSDT',
          side: 'BUY',
          executedQuantity: '1.0',
          executedPrice: '45000.00',
          totalCost: 45000.00,
          fees: 45.00,
          executionTimeMs: 200,
          status: 'FILLED',
        };

        const event = TradingEventFactory.createTradeExecutionCompleted(
          testTradeId,
          testUserId,
          payload
        );

        expect(event.type).toBe('trade.execution.completed');
        expect(event.aggregateId).toBe(testTradeId);
        expect(event.userId).toBe(testUserId);
        expect(event.payload).toBe(payload);
        expect(event.eventId).toMatch(/^trade-exec-complete-\d+-[a-z0-9]+$/);
      });
    });

    describe('createPositionOpened', () => {
      it('should create position opened event with factory', () => {
        const payload: PositionOpenedEvent['payload'] = {
          positionId: 'pos-123',
          symbol: 'BTCUSDT',
          entryPrice: 45000.00,
          quantity: 1.0,
          side: 'LONG',
          strategy: 'Test Strategy',
          autoSnipe: false,
        };

        const event = TradingEventFactory.createPositionOpened(
          'pos-123',
          testUserId,
          payload
        );

        expect(event.type).toBe('position.opened');
        expect(event.aggregateId).toBe('pos-123');
        expect(event.userId).toBe(testUserId);
        expect(event.payload).toBe(payload);
        expect(event.eventId).toMatch(/^position-open-\d+-[a-z0-9]+$/);
      });
    });

    describe('createAutoSnipeTriggered', () => {
      it('should create auto-snipe triggered event with factory', () => {
        const payload: AutoSnipeTriggeredEvent['payload'] = {
          targetId: 42,
          symbol: 'BTCUSDT',
          confidenceScore: 85.0,
          positionSizeUsdt: 1000.00,
          triggeredBy: 'PATTERN_DETECTION',
          triggerConditions: ['Test condition'],
        };

        const event = TradingEventFactory.createAutoSnipeTriggered(
          '42',
          testUserId,
          payload
        );

        expect(event.type).toBe('auto_snipe.triggered');
        expect(event.aggregateId).toBe('42');
        expect(event.userId).toBe(testUserId);
        expect(event.payload).toBe(payload);
        expect(event.eventId).toMatch(/^auto-snipe-trigger-\d+-[a-z0-9]+$/);
      });
    });

    describe('createRiskLimitExceeded', () => {
      it('should create risk limit exceeded event with factory', () => {
        const payload: RiskLimitExceededEvent['payload'] = {
          limitType: 'DAILY_LOSS',
          currentValue: 1000.00,
          limitValue: 800.00,
          action: 'BLOCK_TRADES',
        };

        const event = TradingEventFactory.createRiskLimitExceeded(
          'risk-123',
          testUserId,
          payload
        );

        expect(event.type).toBe('risk.limit.exceeded');
        expect(event.aggregateId).toBe('risk-123');
        expect(event.userId).toBe(testUserId);
        expect(event.payload).toBe(payload);
        expect(event.eventId).toMatch(/^risk-limit-\d+-[a-z0-9]+$/);
      });
    });
  });

  describe('Union Type and Type Safety', () => {
    it('should support all event types in TradingDomainEvent union', () => {
      const events: TradingDomainEvent[] = [
        TradingEventFactory.createTradeExecutionStarted('trade-1', 'user-1', {
          symbol: 'BTCUSDT',
          side: 'BUY',
          orderType: 'MARKET',
          isAutoSnipe: false,
        }),
        TradingEventFactory.createTradeExecutionCompleted('trade-1', 'user-1', {
          orderId: 'order-1',
          symbol: 'BTCUSDT',
          side: 'BUY',
          executedQuantity: '1.0',
          executedPrice: '45000.00',
          totalCost: 45000.00,
          fees: 45.00,
          executionTimeMs: 150,
          status: 'FILLED',
        }),
        TradingEventFactory.createPositionOpened('pos-1', 'user-1', {
          positionId: 'pos-1',
          symbol: 'BTCUSDT',
          entryPrice: 45000.00,
          quantity: 1.0,
          side: 'LONG',
          strategy: 'Test',
          autoSnipe: false,
        }),
        TradingEventFactory.createAutoSnipeTriggered('target-1', 'user-1', {
          targetId: 1,
          symbol: 'BTCUSDT',
          confidenceScore: 80.0,
          positionSizeUsdt: 1000.00,
          triggeredBy: 'PATTERN_DETECTION',
          triggerConditions: ['Test'],
        }),
        TradingEventFactory.createRiskLimitExceeded('risk-1', 'user-1', {
          limitType: 'DAILY_LOSS',
          currentValue: 1000.00,
          limitValue: 800.00,
          action: 'BLOCK_TRADES',
        }),
      ];

      expect(events).toHaveLength(5);
      events.forEach(event => {
        expect(event.type).toBeDefined();
        expect(event.aggregateId).toBeDefined();
        expect(event.userId).toBeDefined();
        expect(event.payload).toBeDefined();
        expect(event.occurredAt).toBeInstanceOf(Date);
      });

      // Type discrimination should work
      events.forEach(event => {
        switch (event.type) {
          case 'trade.execution.started':
            expect(event.payload.symbol).toBeDefined();
            expect(event.payload.side).toBeDefined();
            break;
          case 'trade.execution.completed':
            expect(event.payload.orderId).toBeDefined();
            expect(event.payload.executedQuantity).toBeDefined();
            break;
          case 'position.opened':
            expect(event.payload.positionId).toBeDefined();
            expect(event.payload.entryPrice).toBeDefined();
            break;
          case 'auto_snipe.triggered':
            expect(event.payload.targetId).toBeDefined();
            expect(event.payload.confidenceScore).toBeDefined();
            break;
          case 'risk.limit.exceeded':
            expect(event.payload.limitType).toBeDefined();
            expect(event.payload.currentValue).toBeDefined();
            break;
        }
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle events with minimal required data', () => {
      const minimalPayload: TradeExecutionStartedEvent['payload'] = {
        symbol: 'BTC',
        side: 'BUY',
        orderType: 'MARKET',
        isAutoSnipe: false,
      };

      const event = TradingEventFactory.createTradeExecutionStarted(
        'test',
        'user',
        minimalPayload
      );

      expect(event.payload.quantity).toBeUndefined();
      expect(event.payload.price).toBeUndefined();
      expect(event.payload.strategy).toBeUndefined();
    });

    it('should handle events with all optional data', () => {
      const maximalPayload: TradeExecutionStartedEvent['payload'] = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        orderType: 'LIMIT',
        quantity: 1.5,
        quoteOrderQty: 67500.00,
        price: 45000.00,
        strategy: 'Mean Reversion Strategy',
        isAutoSnipe: true,
        confidenceScore: 95.5,
      };

      const event = TradingEventFactory.createTradeExecutionStarted(
        'test',
        'user',
        maximalPayload
      );

      expect(event.payload.quantity).toBe(1.5);
      expect(event.payload.quoteOrderQty).toBe(67500.00);
      expect(event.payload.price).toBe(45000.00);
      expect(event.payload.strategy).toBe('Mean Reversion Strategy');
      expect(event.payload.confidenceScore).toBe(95.5);
    });

    it('should handle numeric edge cases in events', () => {
      const payload: TradeExecutionCompletedEvent['payload'] = {
        orderId: 'order-edge',
        symbol: 'TESTUSDT',
        side: 'BUY',
        executedQuantity: '0.00000001',
        executedPrice: '999999.99',
        totalCost: 0.01,
        fees: 0,
        executionTimeMs: 1,
        slippagePercent: 0.001,
        status: 'FILLED',
      };

      const event = TradingEventFactory.createTradeExecutionCompleted(
        'test',
        'user',
        payload
      );

      expect(event.payload.executedQuantity).toBe('0.00000001');
      expect(event.payload.executedPrice).toBe('999999.99');
      expect(event.payload.totalCost).toBe(0.01);
      expect(event.payload.fees).toBe(0);
      expect(event.payload.slippagePercent).toBe(0.001);
    });

    it('should handle empty arrays and null values where appropriate', () => {
      const payload: AutoSnipeTriggeredEvent['payload'] = {
        targetId: 0,
        symbol: '',
        confidenceScore: 0,
        positionSizeUsdt: 0,
        triggeredBy: 'MANUAL',
        triggerConditions: [],
      };

      const event = TradingEventFactory.createAutoSnipeTriggered(
        '0',
        'user',
        payload
      );

      expect(event.payload.targetId).toBe(0);
      expect(event.payload.symbol).toBe('');
      expect(event.payload.confidenceScore).toBe(0);
      expect(event.payload.triggerConditions).toHaveLength(0);
    });
  });

  describe('Performance Tests', () => {
    it('should create events efficiently through factory', () => {
      const startTime = Date.now();
      const eventCount = 1000;

      for (let i = 0; i < eventCount; i++) {
        TradingEventFactory.createTradeExecutionStarted(`trade-${i}`, `user-${i}`, {
          symbol: 'BTCUSDT',
          side: 'BUY',
          orderType: 'MARKET',
          isAutoSnipe: false,
        });
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(200); // Should create 1000 events in under 200ms
    });

    it('should handle large payload data efficiently', () => {
      const largeConditions = Array.from({ length: 100 }, (_, i) => `Condition ${i}`);
      
      const payload: AutoSnipeTriggeredEvent['payload'] = {
        targetId: 42,
        symbol: 'BTCUSDT',
        confidenceScore: 85.0,
        positionSizeUsdt: 1000.00,
        triggeredBy: 'PATTERN_DETECTION',
        triggerConditions: largeConditions,
      };

      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        TradingEventFactory.createAutoSnipeTriggered(`target-${i}`, `user-${i}`, payload);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should handle large payloads efficiently
    });
  });
});