/**
 * Execution Order Service Tests
 *
 * Comprehensive test suite for order execution and tracking functionality
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { 
  ExecutionOrderService, 
  executionOrderService,
  type ExecutionOrder,
  type OrderStatusType,
  OrderStatus,
  OrderType,
  OrderSide
} from '@/src/services/execution/execution-order-service';

describe('ExecutionOrderService', () => {
  let service: ExecutionOrderService;

  beforeEach(() => {
    service = new ExecutionOrderService();
  });

  describe('Order Creation', () => {
    it('should create a new order with valid data', async () => {
      const orderData = {
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: 1.5,
        price: 50000,
      };

      const order = await service.createOrder(orderData);

      expect(order).toMatchObject({
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 1.5,
        price: 50000,
        status: 'pending',
        filledQuantity: 0,
      });
      expect(order.id).toMatch(/^order_\d+_[a-z0-9]+$/);
      expect(order.createdAt).toBeGreaterThan(0);
      expect(order.updatedAt).toBeGreaterThan(0);
    });

    it('should create order without price for market orders', async () => {
      const orderData = {
        symbol: 'ETHUSDT',
        side: 'sell' as const,
        type: 'market' as const,
        quantity: 2.0,
      };

      const order = await service.createOrder(orderData);

      expect(order.type).toBe('market');
      expect(order.price).toBeUndefined();
    });

    it('should create order with stop price for stop orders', async () => {
      const orderData = {
        symbol: 'ADAUSDT',
        side: 'buy' as const,
        type: 'stop_limit' as const,
        quantity: 100,
        price: 1.5,
        stopPrice: 1.4,
      };

      const order = await service.createOrder(orderData);

      expect(order.stopPrice).toBe(1.4);
      expect(order.price).toBe(1.5);
    });
  });

  describe('Order Execution', () => {
    it('should execute an order successfully', async () => {
      const order = await service.createOrder({
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: 1.0,
        price: 50000,
      });

      const result = await service.executeOrder(order.id);

      expect(result.success).toBe(true);
      expect(result.orderId).toBe(order.id);
      expect(result.message).toBe('Order executed successfully');
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.order).toBeDefined();
    });

    it('should return error for non-existent order', async () => {
      const result = await service.executeOrder('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Order not found');
      expect(result.error).toContain('Order with ID non-existent-id not found');
    });

    it('should handle execution failures gracefully', async () => {
      // Create an order that will fail during simulation
      const order = await service.createOrder({
        symbol: 'FAILCOIN',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: 1.0,
      });

      // Mock Math.random to trigger rejection scenario
      const originalRandom = Math.random;
      Math.random = () => 0.01; // Force rejection (< 0.05)

      const result = await service.executeOrder(order.id);

      // Restore original Math.random
      Math.random = originalRandom;

      expect(result.success).toBe(false);
      expect(result.message).toBe('Order execution failed');
    });
  });

  describe('Order Status Management', () => {
    it('should update order status successfully', async () => {
      const order = await service.createOrder({
        symbol: 'ETHUSDT',
        side: 'sell' as const,
        type: 'limit' as const,
        quantity: 2.0,
        price: 3000,
      });

      const success = await service.updateOrderStatus(order.id, 'filled', 2.0, 2995);

      expect(success).toBe(true);
      
      const updatedOrder = service.getOrder(order.id);
      expect(updatedOrder?.status).toBe('filled');
      expect(updatedOrder?.filledQuantity).toBe(2.0);
      expect(updatedOrder?.averageFillPrice).toBe(2995);
      expect(updatedOrder?.updatedAt).toBeGreaterThan(order.updatedAt);
    });

    it('should return false for non-existent order status update', async () => {
      const success = await service.updateOrderStatus('non-existent', 'filled');
      expect(success).toBe(false);
    });

    it('should handle partial fills correctly', async () => {
      const order = await service.createOrder({
        symbol: 'ADAUSDT',
        side: 'buy' as const,
        type: 'limit' as const,
        quantity: 100,
        price: 1.5,
      });

      await service.updateOrderStatus(order.id, 'partially_filled', 50, 1.48);

      const updatedOrder = service.getOrder(order.id);
      expect(updatedOrder?.status).toBe('partially_filled');
      expect(updatedOrder?.filledQuantity).toBe(50);
      expect(updatedOrder?.averageFillPrice).toBe(1.48);
    });
  });

  describe('Order Cancellation', () => {
    it('should cancel a pending order', async () => {
      const order = await service.createOrder({
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'limit' as const,
        quantity: 1.0,
        price: 45000,
      });

      const success = await service.cancelOrder(order.id);

      expect(success).toBe(true);
      
      const cancelledOrder = service.getOrder(order.id);
      expect(cancelledOrder?.status).toBe('cancelled');
    });

    it('should not cancel already filled order', async () => {
      const order = await service.createOrder({
        symbol: 'ETHUSDT',
        side: 'sell' as const,
        type: 'market' as const,
        quantity: 1.0,
      });

      // First fill the order
      await service.updateOrderStatus(order.id, 'filled', 1.0, 3000);
      
      // Then try to cancel
      const success = await service.cancelOrder(order.id);

      expect(success).toBe(false);
    });

    it('should return false for non-existent order cancellation', async () => {
      const success = await service.cancelOrder('non-existent-id');
      expect(success).toBe(false);
    });
  });

  describe('Order Retrieval', () => {
    it('should get order by ID', async () => {
      const createdOrder = await service.createOrder({
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: 1.0,
      });

      const retrievedOrder = service.getOrder(createdOrder.id);

      expect(retrievedOrder).toEqual(createdOrder);
    });

    it('should return undefined for non-existent order', () => {
      const order = service.getOrder('non-existent-id');
      expect(order).toBeUndefined();
    });

    it('should get active orders only', async () => {
      // Create multiple orders with different statuses
      const pendingOrder = await service.createOrder({
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'limit' as const,
        quantity: 1.0,
        price: 50000,
      });

      const filledOrder = await service.createOrder({
        symbol: 'ETHUSDT',
        side: 'sell' as const,
        type: 'market' as const,
        quantity: 2.0,
      });

      const cancelledOrder = await service.createOrder({
        symbol: 'ADAUSDT',
        side: 'buy' as const,
        type: 'limit' as const,
        quantity: 100,
        price: 1.5,
      });

      // Update statuses
      await service.updateOrderStatus(filledOrder.id, 'filled', 2.0, 3000);
      await service.cancelOrder(cancelledOrder.id);

      const activeOrders = service.getActiveOrders();

      expect(activeOrders).toHaveLength(1);
      expect(activeOrders[0].id).toBe(pendingOrder.id);
      expect(activeOrders[0].status).toBe('pending');
    });

    it('should get orders by symbol', async () => {
      // Create orders for different symbols
      const btcOrder1 = await service.createOrder({
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: 1.0,
      });

      const btcOrder2 = await service.createOrder({
        symbol: 'BTCUSDT',
        side: 'sell' as const,
        type: 'limit' as const,
        quantity: 0.5,
        price: 55000,
      });

      const ethOrder = await service.createOrder({
        symbol: 'ETHUSDT',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: 2.0,
      });

      const btcOrders = service.getOrdersBySymbol('BTCUSDT');

      expect(btcOrders).toHaveLength(2);
      expect(btcOrders.every(order => order.symbol === 'BTCUSDT')).toBe(true);
      expect(btcOrders.map(order => order.id)).toContain(btcOrder1.id);
      expect(btcOrders.map(order => order.id)).toContain(btcOrder2.id);
      expect(btcOrders.map(order => order.id)).not.toContain(ethOrder.id);
    });
  });

  describe('Order History', () => {
    it('should track order history for completed orders', async () => {
      const order = await service.createOrder({
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: 1.0,
      });

      await service.updateOrderStatus(order.id, 'filled', 1.0, 50000);

      const history = service.getOrderHistory();

      expect(history).toHaveLength(1);
      expect(history[0].id).toBe(order.id);
      expect(history[0].status).toBe('filled');
    });

    it('should limit order history results', async () => {
      // Create and complete multiple orders
      for (let i = 0; i < 5; i++) {
        const order = await service.createOrder({
          symbol: `COIN${i}USDT`,
          side: 'buy' as const,
          type: 'market' as const,
          quantity: 1.0,
        });
        await service.updateOrderStatus(order.id, 'filled', 1.0, 1000);
      }

      const limitedHistory = service.getOrderHistory(3);

      expect(limitedHistory).toHaveLength(3);
    });

    it('should sort order history by update time (newest first)', async () => {
      const order1 = await service.createOrder({
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: 1.0,
      });

      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const order2 = await service.createOrder({
        symbol: 'ETHUSDT',
        side: 'sell' as const,
        type: 'market' as const,
        quantity: 2.0,
      });

      // Complete orders in reverse order
      await service.updateOrderStatus(order2.id, 'filled', 2.0, 3000);
      await service.updateOrderStatus(order1.id, 'filled', 1.0, 50000);

      const history = service.getOrderHistory();

      expect(history[0].id).toBe(order1.id); // Most recently updated
      expect(history[1].id).toBe(order2.id);
    });
  });

  describe('Cleanup Operations', () => {
    it('should clear completed orders from memory', async () => {
      // Create orders with different statuses
      const pendingOrder = await service.createOrder({
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'limit' as const,
        quantity: 1.0,
        price: 50000,
      });

      const filledOrder = await service.createOrder({
        symbol: 'ETHUSDT',
        side: 'sell' as const,
        type: 'market' as const,
        quantity: 2.0,
      });

      const cancelledOrder = await service.createOrder({
        symbol: 'ADAUSDT',
        side: 'buy' as const,
        type: 'limit' as const,
        quantity: 100,
        price: 1.5,
      });

      // Complete some orders
      await service.updateOrderStatus(filledOrder.id, 'filled', 2.0, 3000);
      await service.cancelOrder(cancelledOrder.id);

      const clearedCount = service.clearCompletedOrders();

      expect(clearedCount).toBe(2); // filled and cancelled orders
      expect(service.getOrder(pendingOrder.id)).toBeDefined();
      expect(service.getOrder(filledOrder.id)).toBeUndefined();
      expect(service.getOrder(cancelledOrder.id)).toBeUndefined();
    });
  });

  describe('Schema Validation', () => {
    it('should validate OrderStatus enum values', () => {
      const validStatuses = ['pending', 'placed', 'partially_filled', 'filled', 'cancelled', 'rejected', 'expired'];
      
      validStatuses.forEach(status => {
        expect(() => OrderStatus.parse(status)).not.toThrow();
      });

      expect(() => OrderStatus.parse('invalid_status')).toThrow();
    });

    it('should validate OrderType enum values', () => {
      const validTypes = ['market', 'limit', 'stop_limit', 'stop_market', 'trailing_stop'];
      
      validTypes.forEach(type => {
        expect(() => OrderType.parse(type)).not.toThrow();
      });

      expect(() => OrderType.parse('invalid_type')).toThrow();
    });

    it('should validate OrderSide enum values', () => {
      expect(() => OrderSide.parse('buy')).not.toThrow();
      expect(() => OrderSide.parse('sell')).not.toThrow();
      expect(() => OrderSide.parse('invalid_side')).toThrow();
    });
  });

  describe('Singleton Instance', () => {
    it('should export singleton instance', () => {
      expect(executionOrderService).toBeInstanceOf(ExecutionOrderService);
    });

    it('should maintain state across singleton access', async () => {
      const order = await executionOrderService.createOrder({
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: 1.0,
      });

      const retrievedOrder = executionOrderService.getOrder(order.id);
      expect(retrievedOrder).toEqual(order);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero quantity gracefully', async () => {
      await expect(service.createOrder({
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: 0, // Invalid quantity
      })).rejects.toThrow();
    });

    it('should handle negative prices gracefully', async () => {
      await expect(service.createOrder({
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'limit' as const,
        quantity: 1.0,
        price: -100, // Invalid price
      })).rejects.toThrow();
    });

    it('should handle very large order quantities', async () => {
      const order = await service.createOrder({
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        type: 'market' as const,
        quantity: 999999999.99999999,
      });

      expect(order.quantity).toBe(999999999.99999999);
    });

    it('should handle concurrent order operations', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => 
        service.createOrder({
          symbol: `COIN${i}USDT`,
          side: 'buy' as const,
          type: 'market' as const,
          quantity: 1.0,
        })
      );

      const orders = await Promise.all(promises);

      expect(orders).toHaveLength(10);
      expect(new Set(orders.map(o => o.id)).size).toBe(10); // All unique IDs
    });
  });
});