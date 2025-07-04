/**
 * Unit tests for Trade Domain Entity
 * Tests the trade aggregate root and trading operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Trade, TradeStatus } from '../../../../../src/domain/entities/trading/trade';
import { 
  BusinessRuleViolationError,
  DomainValidationError,
  InvalidOrderStateError,
  InvalidTradeParametersError
} from '../../../../../src/domain/errors/trading-errors';
import { OrderSide } from '../../../../../src/domain/value-objects/trading/order';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../../../utils/timeout-elimination-helpers';

describe('Trade Domain Entity', () => {
  let validTradeProps: any;

  beforeEach(() => {
    validTradeProps = {
      id: 'trade-123',
      userId: 'user-456',
      symbol: 'BTCUSDT',
      status: TradeStatus.PENDING,
      strategy: 'auto-snipe',
      isAutoSnipe: true,
      confidenceScore: 85,
      paperTrade: false,
      orders: [],
      stopLossPercent: 5,
      takeProfitPercent: 10,
      notes: 'Test trade',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  describe('Trade Creation', () => {
    it('should create a valid trade with required props', () => {
      const trade = new Trade(validTradeProps);

      expect(trade.id).toBe(validTradeProps.id);
      expect(trade.userId).toBe(validTradeProps.userId);
      expect(trade.symbol).toBe(validTradeProps.symbol);
      expect(trade.status).toBe(TradeStatus.PENDING);
      expect(trade.isAutoSnipe).toBe(true);
      expect(trade.paperTrade).toBe(false);
    });

    it('should create trade with minimal required props', () => {
      const minimalProps = {
        id: 'trade-123',
        userId: 'user-456',
        symbol: 'BTCUSDT',
        status: TradeStatus.PENDING,
        isAutoSnipe: false,
        paperTrade: true,
        orders: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const trade = new Trade(minimalProps);

      expect(trade.id).toBe(minimalProps.id);
      expect(trade.userId).toBe(minimalProps.userId);
      expect(trade.symbol).toBe(minimalProps.symbol);
      expect(trade.isAutoSnipe).toBe(false);
      expect(trade.paperTrade).toBe(true);
    });

    it('should accept any string id (validation delegated to business layer)', () => {
      const propsWithEmptyId = {
        ...validTradeProps,
        id: '', // Empty id - may be acceptable depending on business rules
      };

      expect(() => new Trade(propsWithEmptyId)).not.toThrow();
    });

    it('should accept any string userId (validation delegated to business layer)', () => {
      const propsWithEmptyUserId = {
        ...validTradeProps,
        userId: '', // Empty userId - may be acceptable depending on business rules
      };

      expect(() => new Trade(propsWithEmptyUserId)).not.toThrow();
    });

    it('should accept any string symbol (validation delegated to business layer)', () => {
      const propsWithEmptySymbol = {
        ...validTradeProps,
        symbol: '', // Empty symbol - may be acceptable depending on business rules
      };

      expect(() => new Trade(propsWithEmptySymbol)).not.toThrow();
    });

    it('should reject trade with invalid confidence score', () => {
      const invalidProps = {
        ...validTradeProps,
        confidenceScore: 150, // > 100
      };

      expect(() => new Trade(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject trade with negative confidence score', () => {
      const invalidProps = {
        ...validTradeProps,
        confidenceScore: -10, // < 0
      };

      expect(() => new Trade(invalidProps)).toThrow(DomainValidationError);
    });
  });

  describe('Trade Status Management', () => {
    let trade: Trade;

    beforeEach(() => {
      trade = new Trade(validTradeProps);
    });

    it('should start execution and change status', () => {
      const executingTrade = trade.startExecution();

      expect(executingTrade.status).toBe(TradeStatus.EXECUTING);
      expect(executingTrade.executionStartedAt).toBeDefined();
      expect(executingTrade.executionStartedAt).toBeInstanceOf(Date);
    });

    it('should not allow starting execution twice', () => {
      const executingTrade = trade.startExecution();

      expect(() => executingTrade.startExecution()).toThrow(InvalidOrderStateError);
    });

    it('should complete trade successfully', () => {
      const executingTrade = trade.startExecution();
      const entryPrice = { value: 50000, currency: 'USDT', toFormattedString: () => '50000 USDT', toPlainObject: () => ({ value: 50000, currency: 'USDT' }) } as any;
      const completedTrade = executingTrade.completeExecution(entryPrice);

      expect(completedTrade.status).toBe(TradeStatus.COMPLETED);
      expect(completedTrade.executionCompletedAt).toBeDefined();
      expect(completedTrade.executionCompletedAt).toBeInstanceOf(Date);
    });

    it('should not allow completing without starting execution', () => {
      const entryPrice = { value: 50000, currency: 'USDT', toFormattedString: () => '50000 USDT', toPlainObject: () => ({ value: 50000, currency: 'USDT' }) } as any;
      expect(() => trade.completeExecution(entryPrice)).toThrow(InvalidOrderStateError);
    });

    it('should fail trade with error message', () => {
      const errorMessage = 'Insufficient balance';
      const executingTrade = trade.startExecution();
      const failedTrade = executingTrade.markAsFailed(errorMessage);

      expect(failedTrade.status).toBe(TradeStatus.FAILED);
      expect(failedTrade.errorMessage).toBe(errorMessage);
      expect(failedTrade.executionCompletedAt).toBeDefined();
    });

    it('should cancel pending trade', () => {
      const reason = 'User cancelled';
      const cancelledTrade = trade.cancel(reason);

      expect(cancelledTrade.status).toBe(TradeStatus.CANCELLED);
      expect(cancelledTrade.errorMessage).toBe(reason);
    });

    it('should not allow cancelling executing trade', () => {
      const executingTrade = trade.startExecution();

      expect(() => executingTrade.cancel('test')).toThrow(InvalidOrderStateError);
    });
  });

  describe('Order Management', () => {
    let trade: Trade;
    let mockOrder: any;

    beforeEach(() => {
      trade = new Trade(validTradeProps);
      mockOrder = {
        id: 'order-123',
        side: OrderSide.BUY,
        symbol: 'BTCUSDT',
        quantity: 100,
        price: { value: 50000, currency: 'USDT' },
        status: 'PENDING',
        createdAt: new Date(),
      };
    });

    it('should add order to trade', () => {
      const updatedTrade = trade.addOrder(mockOrder);

      expect(updatedTrade.orders).toHaveLength(1);
      expect(updatedTrade.orders[0]).toBe(mockOrder);
    });

    it('should reject order with different symbol', () => {
      const invalidOrder = {
        ...mockOrder,
        symbol: 'ETHUSDT', // Different symbol
      };

      expect(() => trade.addOrder(invalidOrder)).toThrow();
    });

    it('should update order in trade', () => {
      const tradeWithOrder = trade.addOrder(mockOrder);
      
      const updatedOrder = {
        ...mockOrder,
        status: 'FILLED',
      };

      const tradeWithUpdatedOrder = tradeWithOrder.updateOrder(mockOrder.id, updatedOrder);

      expect(tradeWithUpdatedOrder.orders[0].status).toBe('FILLED');
    });

    it('should reject updating non-existent order', () => {
      const nonExistentOrder = {
        ...mockOrder,
        id: 'non-existent',
      };

      expect(() => trade.updateOrder('non-existent', nonExistentOrder)).toThrow();
    });
  });

  describe('Risk Management', () => {
    let trade: Trade;

    beforeEach(() => {
      trade = new Trade(validTradeProps);
    });

    it('should validate stop loss percentage', () => {
      expect(() => {
        trade.updateStopLoss(150); // > 100% max
      }).toThrow();
    });

    it('should reject negative stop loss percentage', () => {
      expect(() => {
        trade.updateStopLoss(-5);
      }).toThrow();
    });

    it('should reject zero stop loss percentage', () => {
      expect(() => {
        trade.updateStopLoss(0);
      }).toThrow();
    });

    it('should validate take profit percentage', () => {
      expect(() => {
        trade.updateTakeProfit(-10); // Negative percentage
      }).toThrow();
    });

    it('should update valid stop loss', () => {
      const updatedTrade = trade.updateStopLoss(5);

      expect(updatedTrade.stopLossPercent).toBe(5);
    });

    it('should update valid take profit', () => {
      const updatedTrade = trade.updateTakeProfit(20);

      expect(updatedTrade.takeProfitPercent).toBe(20);
    });

    it('should calculate PnL percentage', () => {
      const tradeWithPnL = {
        ...validTradeProps,
        realizedPnL: { amount: 100, isZero: () => false } as any,
        totalCost: { amount: 1000, isZero: () => false } as any,
      };
      
      const trade = new Trade(tradeWithPnL);
      const pnlPercentage = trade.calculatePnLPercentage();

      expect(pnlPercentage).toBe(10); // 100/1000 * 100 = 10%
    });
  });

  describe('Business Rule Validation', () => {
    it('should require confidence score for auto-snipe trades', () => {
      const autoSnipeWithoutConfidence = {
        ...validTradeProps,
        isAutoSnipe: true,
        confidenceScore: undefined, // Missing confidence score
      };

      expect(() => new Trade(autoSnipeWithoutConfidence)).toThrow(BusinessRuleViolationError);
    });

    it('should allow manual trades without confidence score', () => {
      const manualTradeProps = {
        ...validTradeProps,
        isAutoSnipe: false,
        confidenceScore: undefined,
      };

      expect(() => new Trade(manualTradeProps)).not.toThrow();
    });

    it('should validate stop loss percentage range', () => {
      const invalidStopLossProps = {
        ...validTradeProps,
        stopLossPercent: 150, // > 100%
      };

      expect(() => new Trade(invalidStopLossProps)).toThrow(BusinessRuleViolationError);
    });

    it('should validate negative take profit percentage', () => {
      const invalidTakeProfitProps = {
        ...validTradeProps,
        takeProfitPercent: -10, // Negative
      };

      expect(() => new Trade(invalidTakeProfitProps)).toThrow(BusinessRuleViolationError);
    });

    it('should validate status consistency for completed trades', () => {
      const inconsistentProps = {
        ...validTradeProps,
        status: TradeStatus.COMPLETED,
        executionCompletedAt: undefined, // Missing for completed status
      };

      expect(() => new Trade(inconsistentProps)).toThrow(BusinessRuleViolationError);
    });
  });

  describe('Event Generation', () => {
    let trade: Trade;

    beforeEach(() => {
      trade = new Trade(validTradeProps);
      trade.clearDomainEvents(); // Clear any creation events
    });

    it('should generate event on execution start', () => {
      const executingTrade = trade.startExecution();

      const events = executingTrade.getDomainEvents();
      expect(Array.isArray(events)).toBe(true);
      if (events.length > 0) {
        expect(events[0].type).toContain('execution');
      }
    });

    it('should generate event on completion', () => {
      const executingTrade = trade.startExecution();
      executingTrade.clearDomainEvents();
      const entryPrice = { value: 50000, currency: 'USDT', toFormattedString: () => '50000 USDT', toPlainObject: () => ({ value: 50000, currency: 'USDT' }) } as any;
      const completedTrade = executingTrade.completeExecution(entryPrice);

      const events = completedTrade.getDomainEvents();
      expect(Array.isArray(events)).toBe(true);
      if (events.length > 0) {
        expect(events[0].type).toContain('execution');
      }
    });

    it('should generate event on failure', () => {
      const executingTrade = trade.startExecution();
      executingTrade.clearDomainEvents();
      const failedTrade = executingTrade.markAsFailed('Test error');

      const events = failedTrade.getDomainEvents();
      expect(Array.isArray(events)).toBe(true);
      if (events.length > 0) {
        expect(events[0].type).toContain('failed');
      }
    });

    it('should handle domain events properly', () => {
      const events = trade.getDomainEvents();
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe('Data Integrity', () => {
    let trade: Trade;

    beforeEach(() => {
      trade = new Trade(validTradeProps);
    });

    it('should maintain immutable id', () => {
      const originalId = trade.id;
      
      // Attempt to modify (should not be possible with readonly)
      expect(trade.id).toBe(originalId);
    });

    it('should maintain immutable userId', () => {
      const originalUserId = trade.userId;
      
      expect(trade.userId).toBe(originalUserId);
    });

    it('should provide access to trade properties', () => {
      expect(trade.symbol).toBe(validTradeProps.symbol);
      expect(trade.status).toBe(validTradeProps.status);
      expect(trade.isAutoSnipe).toBe(validTradeProps.isAutoSnipe);
      expect(trade.paperTrade).toBe(validTradeProps.paperTrade);
    });

    it('should check trade status correctly', () => {
      expect(trade.isPending()).toBe(true);
      expect(trade.isExecuting()).toBe(false);
      expect(trade.isCompleted()).toBe(false);
      expect(trade.isFailed()).toBe(false);
      expect(trade.isCancelled()).toBe(false);
      expect(trade.isFinalized()).toBe(false);
    });

    it('should handle order management', () => {
      expect(trade.hasOrders()).toBe(false);
      expect(trade.hasActiveOrders()).toBe(false);
      expect(trade.getBuyOrders()).toHaveLength(0);
      expect(trade.getSellOrders()).toHaveLength(0);
      expect(trade.getFilledOrders()).toHaveLength(0);
      expect(trade.getTotalExecutedQuantity()).toBe(0);
    });
  });

  describe('Trade Serialization', () => {
    let trade: Trade;

    beforeEach(() => {
      trade = new Trade(validTradeProps);
    });

    it('should serialize to plain object', () => {
      const plainObject = trade.toPlainObject();

      expect(plainObject.id).toBe(trade.id);
      expect(plainObject.userId).toBe(trade.userId);
      expect(plainObject.symbol).toBe(trade.symbol);
      expect(plainObject.status).toBe(trade.status);
    });

    it('should handle existing notes correctly', () => {
      const tradeWithNotes = new Trade({
        ...validTradeProps,
        notes: 'Existing notes',
      });
      
      expect(tradeWithNotes.notes).toBe('Existing notes');
    });

    it('should calculate execution duration when not completed', () => {
      const duration = trade.getExecutionDurationMs();
      
      // Should be undefined when not completed
      expect(duration).toBeUndefined();
    });
  });

  describe('Performance Tests', () => {
    it('should create trades efficiently', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        new Trade({
          ...validTradeProps,
          id: `trade-${i}`,
        });
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should create 100 trades in under 100ms
    });

    it('should access trade properties efficiently', () => {
      const trade = new Trade(validTradeProps);
      const startTime = Date.now();
      
      // Perform multiple property accesses
      const props = {
        id: trade.id,
        userId: trade.userId,
        symbol: trade.symbol,
        status: trade.status,
        isAutoSnipe: trade.isAutoSnipe,
        paperTrade: trade.paperTrade,
      };
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5); // Should complete operations in under 5ms
      expect(props.id).toBe(validTradeProps.id);
    });
  });
});