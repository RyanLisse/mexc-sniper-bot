/**
 * Unit tests for Order Value Object
 * Tests order creation, validation, status management, and business logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  Order, 
  OrderStatus, 
  OrderSide, 
  OrderType, 
  TimeInForce 
} from '../../../../../src/domain/value-objects/trading/order';
import { DomainValidationError } from '../../../../../src/domain/errors/trading-errors';

describe('Order Value Object', () => {
  let validOrderProps: any;
  let validMarketOrderProps: any;
  let validLimitOrderProps: any;
  let validStopLimitOrderProps: any;

  beforeEach(() => {
    const now = new Date();
    
    // Base valid order props
    validOrderProps = {
      symbol: 'BTCUSDT',
      side: OrderSide.BUY,
      type: OrderType.MARKET,
      status: OrderStatus.PENDING,
      quantity: 0.1,
      timeInForce: TimeInForce.GTC,
      isAutoSnipe: false,
      paperTrade: false,
    };

    // Market order props
    validMarketOrderProps = {
      ...validOrderProps,
      type: OrderType.MARKET,
      quantity: 0.1,
    };

    // Limit order props
    validLimitOrderProps = {
      ...validOrderProps,
      type: OrderType.LIMIT,
      quantity: 0.1,
      price: 50000,
    };

    // Stop-limit order props
    validStopLimitOrderProps = {
      ...validOrderProps,
      type: OrderType.STOP_LIMIT,
      quantity: 0.1,
      price: 50000,
      stopPrice: 48000,
    };
  });

  describe('Order Creation', () => {
    it('should create order with valid market order props', () => {
      const order = Order.create(validMarketOrderProps);

      expect(order.symbol).toBe('BTCUSDT');
      expect(order.side).toBe(OrderSide.BUY);
      expect(order.type).toBe(OrderType.MARKET);
      expect(order.status).toBe(OrderStatus.PENDING);
      expect(order.quantity).toBe(0.1);
      expect(order.timeInForce).toBe(TimeInForce.GTC);
      expect(order.isAutoSnipe).toBe(false);
      expect(order.paperTrade).toBe(false);
      expect(order.id).toBeDefined();
      expect(order.createdAt).toBeInstanceOf(Date);
      expect(order.updatedAt).toBeInstanceOf(Date);
    });

    it('should create order with valid limit order props', () => {
      const order = Order.create(validLimitOrderProps);

      expect(order.type).toBe(OrderType.LIMIT);
      expect(order.price).toBe(50000);
      expect(order.quantity).toBe(0.1);
    });

    it('should create order with valid stop-limit order props', () => {
      const order = Order.create(validStopLimitOrderProps);

      expect(order.type).toBe(OrderType.STOP_LIMIT);
      expect(order.price).toBe(50000);
      expect(order.stopPrice).toBe(48000);
      expect(order.quantity).toBe(0.1);
    });

    it('should create order with quote order quantity', () => {
      const orderProps = {
        ...validOrderProps,
        quantity: undefined,
        quoteOrderQty: 1000,
      };

      const order = Order.create(orderProps);

      expect(order.quoteOrderQty).toBe(1000);
      expect(order.quantity).toBeUndefined();
    });

    it('should create auto-snipe order with confidence score', () => {
      const autoSnipeProps = {
        ...validOrderProps,
        isAutoSnipe: true,
        confidenceScore: 85,
        strategy: 'momentum-snipe',
      };

      const order = Order.create(autoSnipeProps);

      expect(order.isAutoSnipe).toBe(true);
      expect(order.confidenceScore).toBe(85);
      expect(order.strategy).toBe('momentum-snipe');
    });

    it('should create order with optional fields', () => {
      const orderWithOptionals = {
        ...validLimitOrderProps,
        clientOrderId: 'client-123',
        exchangeOrderId: 'exchange-456',
        executedQuantity: 0.05,
        executedPrice: 49500,
        cumulativeQuoteQty: 2475,
        avgPrice: 49500,
        fees: 2.475,
        strategy: 'scalping',
      };

      const order = Order.create(orderWithOptionals);

      expect(order.clientOrderId).toBe('client-123');
      expect(order.exchangeOrderId).toBe('exchange-456');
      expect(order.executedQuantity).toBe(0.05);
      expect(order.executedPrice).toBe(49500);
      expect(order.cumulativeQuoteQty).toBe(2475);
      expect(order.avgPrice).toBe(49500);
      expect(order.fees).toBe(2.475);
      expect(order.strategy).toBe('scalping');
    });
  });

  describe('Order Validation', () => {
    it('should reject order without quantity or quoteOrderQty', () => {
      const invalidProps = {
        ...validOrderProps,
        quantity: undefined,
        quoteOrderQty: undefined,
      };

      expect(() => Order.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject limit order without price', () => {
      const invalidProps = {
        ...validLimitOrderProps,
        price: undefined,
      };

      expect(() => Order.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject stop-limit order without stop price', () => {
      const invalidProps = {
        ...validStopLimitOrderProps,
        stopPrice: undefined,
      };

      expect(() => Order.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject order with executed quantity exceeding order quantity', () => {
      const invalidProps = {
        ...validLimitOrderProps,
        quantity: 0.1,
        executedQuantity: 0.2, // Exceeds order quantity
      };

      expect(() => Order.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject filled order without filled timestamp', () => {
      const invalidProps = {
        ...validLimitOrderProps,
        status: OrderStatus.FILLED,
        filledAt: undefined,
      };

      expect(() => Order.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject cancelled order without cancelled timestamp', () => {
      const invalidProps = {
        ...validLimitOrderProps,
        status: OrderStatus.CANCELLED,
        cancelledAt: undefined,
      };

      expect(() => Order.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject auto-snipe order without confidence score', () => {
      const invalidProps = {
        ...validOrderProps,
        isAutoSnipe: true,
        confidenceScore: undefined,
      };

      expect(() => Order.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject order with empty symbol', () => {
      const invalidProps = {
        ...validOrderProps,
        symbol: '',
      };

      expect(() => Order.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject order with negative quantity', () => {
      const invalidProps = {
        ...validOrderProps,
        quantity: -0.1,
      };

      expect(() => Order.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject order with negative price', () => {
      const invalidProps = {
        ...validLimitOrderProps,
        price: -50000,
      };

      expect(() => Order.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject order with invalid confidence score', () => {
      const invalidProps = {
        ...validOrderProps,
        isAutoSnipe: true,
        confidenceScore: 150, // > 100
      };

      expect(() => Order.create(invalidProps)).toThrow(DomainValidationError);
    });

    it('should reject order with negative confidence score', () => {
      const invalidProps = {
        ...validOrderProps,
        isAutoSnipe: true,
        confidenceScore: -10, // < 0
      };

      expect(() => Order.create(invalidProps)).toThrow(DomainValidationError);
    });
  });

  describe('Order Status Methods', () => {
    let order: Order;
    let filledOrder: Order;
    let cancelledOrder: Order;
    let rejectedOrder: Order;

    beforeEach(() => {
      order = Order.create(validLimitOrderProps);
      
      filledOrder = Order.create({
        ...validLimitOrderProps,
        status: OrderStatus.FILLED,
        filledAt: new Date(),
        executedQuantity: 0.1,
        executedPrice: 50000,
      });

      cancelledOrder = Order.create({
        ...validLimitOrderProps,
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
      });

      rejectedOrder = Order.create({
        ...validLimitOrderProps,
        status: OrderStatus.REJECTED,
        rejectReason: 'Insufficient balance',
      });
    });

    it('should check if order is filled', () => {
      expect(filledOrder.isFilled()).toBe(true);
      expect(order.isFilled()).toBe(false);
    });

    it('should check if order is partially filled', () => {
      const partialOrder = Order.create({
        ...validLimitOrderProps,
        status: OrderStatus.PARTIALLY_FILLED,
        executedQuantity: 0.05,
        executedPrice: 50000,
      });

      expect(partialOrder.isPartiallyFilled()).toBe(true);
      expect(order.isPartiallyFilled()).toBe(false);
    });

    it('should check if order is cancelled', () => {
      expect(cancelledOrder.isCancelled()).toBe(true);
      expect(order.isCancelled()).toBe(false);
    });

    it('should check if order is rejected', () => {
      expect(rejectedOrder.isRejected()).toBe(true);
      expect(order.isRejected()).toBe(false);
    });

    it('should check if order is active', () => {
      expect(order.isActive()).toBe(true);
      expect(filledOrder.isActive()).toBe(false);
      expect(cancelledOrder.isActive()).toBe(false);
    });

    it('should check if order is finalized', () => {
      expect(order.isFinalized()).toBe(false);
      expect(filledOrder.isFinalized()).toBe(true);
      expect(cancelledOrder.isFinalized()).toBe(true);
      expect(rejectedOrder.isFinalized()).toBe(true);
    });
  });

  describe('Order Calculations', () => {
    let order: Order;

    beforeEach(() => {
      order = Order.create({
        ...validLimitOrderProps,
        quantity: 1.0,
        executedQuantity: 0.5,
        executedPrice: 49500,
        avgPrice: 49500,
        fees: 24.75,
      });
    });

    it('should calculate fill percentage', () => {
      expect(order.getFillPercentage()).toBe(50); // 0.5 / 1.0 * 100
    });

    it('should return zero fill percentage when no execution', () => {
      const noExecutionOrder = Order.create(validLimitOrderProps);
      expect(noExecutionOrder.getFillPercentage()).toBe(0);
    });

    it('should get effective price from average price', () => {
      expect(order.getEffectivePrice()).toBe(49500);
    });

    it('should get effective price from executed price when no average', () => {
      const orderWithoutAvg = Order.create({
        ...validLimitOrderProps,
        executedPrice: 49000,
      });

      expect(orderWithoutAvg.getEffectivePrice()).toBe(49000);
    });

    it('should get effective price from order price when no execution', () => {
      const orderWithoutExecution = Order.create(validLimitOrderProps);
      expect(orderWithoutExecution.getEffectivePrice()).toBe(50000);
    });

    it('should calculate total cost including fees', () => {
      const totalCost = order.getTotalCost();
      expect(totalCost).toBe(24774.75); // (0.5 * 49500) + 24.75
    });

    it('should calculate total cost without fees', () => {
      const orderWithoutFees = Order.create({
        ...validLimitOrderProps,
        quantity: 1.0,
        executedQuantity: 0.5,
        executedPrice: 49500,
        avgPrice: 49500,
      });

      const totalCost = orderWithoutFees.getTotalCost();
      expect(totalCost).toBe(24750); // 0.5 * 49500
    });

    it('should return undefined total cost when no execution', () => {
      const noExecutionOrder = Order.create(validLimitOrderProps);
      expect(noExecutionOrder.getTotalCost()).toBeUndefined();
    });
  });

  describe('Order State Transitions', () => {
    let order: Order;

    beforeEach(() => {
      order = Order.create(validLimitOrderProps);
    });

    it('should mark order as submitted', () => {
      const submittedOrder = order.markAsSubmitted('exchange-123');

      expect(submittedOrder.status).toBe(OrderStatus.SUBMITTED);
      expect(submittedOrder.exchangeOrderId).toBe('exchange-123');
      expect(submittedOrder.updatedAt).not.toEqual(order.updatedAt);
      expect(submittedOrder.id).toBe(order.id); // Same order, different instance
    });

    it('should mark order as partially filled', () => {
      const partialOrder = order.markAsPartiallyFilled(0.05, 49500, 2.475);

      expect(partialOrder.status).toBe(OrderStatus.PARTIALLY_FILLED);
      expect(partialOrder.executedQuantity).toBe(0.05);
      expect(partialOrder.executedPrice).toBe(49500);
      expect(partialOrder.avgPrice).toBe(49500);
      expect(partialOrder.fees).toBe(2.475);
      expect(partialOrder.updatedAt).not.toEqual(order.updatedAt);
    });

    it('should mark order as filled', () => {
      const filledOrder = order.markAsFilled(0.1, 50000, 5000, 5.0);

      expect(filledOrder.status).toBe(OrderStatus.FILLED);
      expect(filledOrder.executedQuantity).toBe(0.1);
      expect(filledOrder.executedPrice).toBe(50000);
      expect(filledOrder.avgPrice).toBe(50000);
      expect(filledOrder.cumulativeQuoteQty).toBe(5000);
      expect(filledOrder.fees).toBe(5.0);
      expect(filledOrder.filledAt).toBeInstanceOf(Date);
      expect(filledOrder.updatedAt).not.toEqual(order.updatedAt);
    });

    it('should mark order as cancelled', () => {
      const cancelledOrder = order.markAsCancelled('User requested');

      expect(cancelledOrder.status).toBe(OrderStatus.CANCELLED);
      expect(cancelledOrder.rejectReason).toBe('User requested');
      expect(cancelledOrder.cancelledAt).toBeInstanceOf(Date);
      expect(cancelledOrder.updatedAt).not.toEqual(order.updatedAt);
    });

    it('should mark order as cancelled without reason', () => {
      const cancelledOrder = order.markAsCancelled();

      expect(cancelledOrder.status).toBe(OrderStatus.CANCELLED);
      expect(cancelledOrder.rejectReason).toBeUndefined();
      expect(cancelledOrder.cancelledAt).toBeInstanceOf(Date);
    });

    it('should mark order as rejected', () => {
      const rejectedOrder = order.markAsRejected('Insufficient balance');

      expect(rejectedOrder.status).toBe(OrderStatus.REJECTED);
      expect(rejectedOrder.rejectReason).toBe('Insufficient balance');
      expect(rejectedOrder.updatedAt).not.toEqual(order.updatedAt);
    });

    it('should maintain immutability in state transitions', () => {
      const originalStatus = order.status;
      const originalUpdatedAt = order.updatedAt;

      const submittedOrder = order.markAsSubmitted('exchange-123');

      // Original order should be unchanged
      expect(order.status).toBe(originalStatus);
      expect(order.updatedAt).toEqual(originalUpdatedAt);
      expect(order.exchangeOrderId).toBeUndefined();

      // New order should have updated properties
      expect(submittedOrder.status).toBe(OrderStatus.SUBMITTED);
      expect(submittedOrder.exchangeOrderId).toBe('exchange-123');
    });
  });

  describe('Order from Existing', () => {
    it('should create order from existing props', () => {
      const existingProps = {
        id: 'existing-order-123',
        symbol: 'ETHUSDT',
        side: OrderSide.SELL,
        type: OrderType.LIMIT,
        status: OrderStatus.FILLED,
        quantity: 5.0,
        price: 3000,
        timeInForce: TimeInForce.IOC,
        isAutoSnipe: true,
        confidenceScore: 90,
        paperTrade: true,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        filledAt: new Date('2024-01-02'),
        executedQuantity: 5.0,
        executedPrice: 3000,
      };

      const order = Order.fromExisting(existingProps);

      expect(order.id).toBe('existing-order-123');
      expect(order.symbol).toBe('ETHUSDT');
      expect(order.side).toBe(OrderSide.SELL);
      expect(order.type).toBe(OrderType.LIMIT);
      expect(order.status).toBe(OrderStatus.FILLED);
      expect(order.quantity).toBe(5.0);
      expect(order.price).toBe(3000);
      expect(order.timeInForce).toBe(TimeInForce.IOC);
      expect(order.isAutoSnipe).toBe(true);
      expect(order.confidenceScore).toBe(90);
      expect(order.paperTrade).toBe(true);
      expect(order.filledAt).toEqual(new Date('2024-01-02'));
    });

    it('should validate existing props', () => {
      const invalidExistingProps = {
        id: 'existing-order-123',
        symbol: '', // Invalid empty symbol
        side: OrderSide.BUY,
        type: OrderType.LIMIT,
        status: OrderStatus.PENDING,
        quantity: 1.0,
        timeInForce: TimeInForce.GTC,
        isAutoSnipe: false,
        paperTrade: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(() => Order.fromExisting(invalidExistingProps)).toThrow(DomainValidationError);
    });
  });

  describe('Order Serialization', () => {
    it('should convert to plain object', () => {
      const order = Order.create(validLimitOrderProps);
      const plainObject = order.toPlainObject();

      expect(plainObject.id).toBe(order.id);
      expect(plainObject.symbol).toBe(order.symbol);
      expect(plainObject.side).toBe(order.side);
      expect(plainObject.type).toBe(order.type);
      expect(plainObject.status).toBe(order.status);
      expect(plainObject.quantity).toBe(order.quantity);
      expect(plainObject.price).toBe(order.price);
      expect(plainObject.timeInForce).toBe(order.timeInForce);
      expect(plainObject.isAutoSnipe).toBe(order.isAutoSnipe);
      expect(plainObject.paperTrade).toBe(order.paperTrade);
      expect(plainObject.createdAt).toBe(order.createdAt);
      expect(plainObject.updatedAt).toBe(order.updatedAt);
    });

    it('should include all optional fields in plain object', () => {
      const orderWithOptionals = Order.create({
        ...validLimitOrderProps,
        clientOrderId: 'client-123',
        strategy: 'momentum',
        confidenceScore: 75,
        isAutoSnipe: true,
      });

      const plainObject = orderWithOptionals.toPlainObject();

      expect(plainObject.clientOrderId).toBe('client-123');
      expect(plainObject.strategy).toBe('momentum');
      expect(plainObject.confidenceScore).toBe(75);
      expect(plainObject.isAutoSnipe).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small quantities', () => {
      const smallQuantityOrder = Order.create({
        ...validLimitOrderProps,
        quantity: 0.00000001, // 1 satoshi equivalent
      });

      expect(smallQuantityOrder.quantity).toBe(0.00000001);
      expect(smallQuantityOrder.getFillPercentage()).toBe(0);
    });

    it('should handle very large quantities', () => {
      const largeQuantityOrder = Order.create({
        ...validLimitOrderProps,
        quantity: 1000000000, // 1 billion
      });

      expect(largeQuantityOrder.quantity).toBe(1000000000);
    });

    it('should handle different time in force values', () => {
      const iocOrder = Order.create({
        ...validLimitOrderProps,
        timeInForce: TimeInForce.IOC,
      });

      const fokOrder = Order.create({
        ...validLimitOrderProps,
        timeInForce: TimeInForce.FOK,
      });

      expect(iocOrder.timeInForce).toBe(TimeInForce.IOC);
      expect(fokOrder.timeInForce).toBe(TimeInForce.FOK);
    });

    it('should handle different order sides', () => {
      const buyOrder = Order.create({
        ...validLimitOrderProps,
        side: OrderSide.BUY,
      });

      const sellOrder = Order.create({
        ...validLimitOrderProps,
        side: OrderSide.SELL,
      });

      expect(buyOrder.side).toBe(OrderSide.BUY);
      expect(sellOrder.side).toBe(OrderSide.SELL);
    });

    it('should handle zero fees', () => {
      const zeroFeesOrder = Order.create({
        ...validLimitOrderProps,
        quantity: 1.0,
        executedQuantity: 1.0,
        executedPrice: 50000,
        fees: 0,
      });

      expect(zeroFeesOrder.getTotalCost()).toBe(50000);
    });
  });

  describe('Performance Tests', () => {
    it('should create orders efficiently', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        Order.create({
          ...validLimitOrderProps,
          quantity: i * 0.001,
        });
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500); // Should create 1000 orders in under 500ms
    });

    it('should perform state transitions efficiently', () => {
      const order = Order.create(validLimitOrderProps);
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        order.markAsSubmitted(`exchange-${i}`);
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should perform 1000 transitions in under 100ms
    });

    it('should calculate metrics efficiently', () => {
      const order = Order.create({
        ...validLimitOrderProps,
        quantity: 1.0,
        executedQuantity: 0.5,
        executedPrice: 50000,
        avgPrice: 50000,
        fees: 25,
      });

      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        order.getFillPercentage();
        order.getEffectivePrice();
        order.getTotalCost();
        order.isActive();
        order.isFinalized();
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50); // Should perform 5000 calculations in under 50ms
    });
  });
});