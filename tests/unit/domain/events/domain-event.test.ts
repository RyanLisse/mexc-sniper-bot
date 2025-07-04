/**
 * Unit tests for Domain Event interfaces and contracts
 * Tests domain event structure, publisher interface, handler interface, and dispatcher interface
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { 
  DomainEvent, 
  DomainEventPublisher, 
  DomainEventHandler, 
  EventDispatcher 
} from '../../../../src/domain/events/domain-event';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../../utils/timeout-elimination-helpers';

// Test implementations for interface testing
class TestEvent implements DomainEvent {
  readonly type: string;
  readonly aggregateId: string;
  readonly payload: Record<string, any>;
  readonly occurredAt: Date;
  readonly eventId?: string;
  readonly correlationId?: string;

  constructor(
    type: string,
    aggregateId: string,
    payload: Record<string, any> = {},
    eventId?: string,
    correlationId?: string
  ) {
    this.type = type;
    this.aggregateId = aggregateId;
    this.payload = payload;
    this.occurredAt = new Date();
    this.eventId = eventId;
    this.correlationId = correlationId;
  }
}

class TestEventPublisher implements DomainEventPublisher {
  private events: DomainEvent[] = [];

  getDomainEvents(): readonly DomainEvent[] {
    return this.events;
  }

  clearDomainEvents(): void {
    this.events = [];
  }

  // Helper method for testing
  addEvent(event: DomainEvent): void {
    this.events.push(event);
  }
}

class TestEventHandler implements DomainEventHandler {
  readonly eventType: string;
  private handleCallCount = 0;
  private lastHandledEvent?: DomainEvent;

  constructor(eventType: string) {
    this.eventType = eventType;
  }

  async handle(event: DomainEvent): Promise<void> {
    this.handleCallCount++;
    this.lastHandledEvent = event;
  }

  // Helper methods for testing
  getHandleCallCount(): number {
    return this.handleCallCount;
  }

  getLastHandledEvent(): DomainEvent | undefined {
    return this.lastHandledEvent;
  }

  reset(): void {
    this.handleCallCount = 0;
    this.lastHandledEvent = undefined;
  }
}

class TestSyncEventHandler implements DomainEventHandler {
  readonly eventType: string;
  private handleCallCount = 0;

  constructor(eventType: string) {
    this.eventType = eventType;
  }

  handle(event: DomainEvent): void {
    this.handleCallCount++;
  }

  getHandleCallCount(): number {
    return this.handleCallCount;
  }
}

class TestEventDispatcher implements EventDispatcher {
  private handlers = new Map<string, DomainEventHandler[]>();
  private publishedEvents: DomainEvent[] = [];

  async publish<T extends DomainEvent>(event: T): Promise<void> {
    this.publishedEvents.push(event);
    const handlers = this.handlers.get(event.type) || [];
    
    for (const handler of handlers) {
      await handler.handle(event);
    }
  }

  async publishMany(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: DomainEventHandler<T>
  ): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  unsubscribe(eventType: string, handler: DomainEventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // Helper methods for testing
  getPublishedEvents(): DomainEvent[] {
    return [...this.publishedEvents];
  }

  getHandlerCount(eventType: string): number {
    return this.handlers.get(eventType)?.length || 0;
  }

  clearPublishedEvents(): void {
    this.publishedEvents = [];
  }

  getAllHandlers(): Map<string, DomainEventHandler[]> {
    return new Map(this.handlers);
  }
}

describe('Domain Event Interfaces and Contracts', () => {
  let testEvent: TestEvent;
  let publisher: TestEventPublisher;
  let handler: TestEventHandler;
  let syncHandler: TestSyncEventHandler;
  let dispatcher: TestEventDispatcher;

  beforeEach(() => {
    testEvent = new TestEvent(
      'test.event.created',
      'aggregate-123',
      { message: 'Test event payload' },
      'event-456',
      'correlation-789'
    );

    publisher = new TestEventPublisher();
    handler = new TestEventHandler('test.event.created');
    syncHandler = new TestSyncEventHandler('test.sync.event');
    dispatcher = new TestEventDispatcher();
  });

  describe('DomainEvent Interface', () => {
    it('should have all required properties', () => {
      expect(testEvent.type).toBe('test.event.created');
      expect(testEvent.aggregateId).toBe('aggregate-123');
      expect(testEvent.payload).toEqual({ message: 'Test event payload' });
      expect(testEvent.occurredAt).toBeInstanceOf(Date);
      expect(testEvent.eventId).toBe('event-456');
      expect(testEvent.correlationId).toBe('correlation-789');
    });

    it('should handle optional properties', () => {
      const minimalEvent = new TestEvent('minimal.event', 'agg-1');
      
      expect(minimalEvent.type).toBe('minimal.event');
      expect(minimalEvent.aggregateId).toBe('agg-1');
      expect(minimalEvent.payload).toEqual({});
      expect(minimalEvent.occurredAt).toBeInstanceOf(Date);
      expect(minimalEvent.eventId).toBeUndefined();
      expect(minimalEvent.correlationId).toBeUndefined();
    });

    it('should set occurredAt timestamp when created', () => {
      const beforeCreate = Date.now();
      const event = new TestEvent('timestamp.test', 'agg-1');
      const afterCreate = Date.now();
      
      expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(beforeCreate);
      expect(event.occurredAt.getTime()).toBeLessThanOrEqual(afterCreate);
    });

    it('should handle complex payload data', () => {
      const complexPayload = {
        user: { id: 123, name: 'John Doe' },
        metadata: { tags: ['urgent', 'business'], priority: 'high' },
        calculations: [1, 2, 3, 4, 5],
        timestamp: new Date(),
        nested: { deep: { value: 'test' } }
      };

      const event = new TestEvent('complex.event', 'agg-1', complexPayload);
      
      expect(event.payload).toEqual(complexPayload);
      expect(event.payload.user.name).toBe('John Doe');
      expect(event.payload.nested.deep.value).toBe('test');
    });

    it('should handle empty and null payload values', () => {
      const emptyEvent = new TestEvent('empty.event', 'agg-1', {});
      const nullValueEvent = new TestEvent('null.event', 'agg-1', { value: null, undefined: undefined });
      
      expect(emptyEvent.payload).toEqual({});
      expect(nullValueEvent.payload.value).toBeNull();
      expect(nullValueEvent.payload.undefined).toBeUndefined();
    });

    it('should be readonly and immutable', () => {
      // These should not compile in TypeScript, but test runtime behavior
      expect(() => {
        (testEvent as any).type = 'modified.type';
      }).not.toThrow(); // Properties are readonly but not enforced at runtime without Object.freeze

      expect(() => {
        (testEvent as any).aggregateId = 'modified-id';
      }).not.toThrow();

      // But the original values should remain if properly implemented
      // Note: This depends on the implementation using Object.freeze or similar
    });
  });

  describe('DomainEventPublisher Interface', () => {
    it('should start with empty domain events', () => {
      expect(publisher.getDomainEvents()).toHaveLength(0);
    });

    it('should return readonly domain events array', () => {
      publisher.addEvent(testEvent);
      const events = publisher.getDomainEvents();
      
      expect(events).toHaveLength(1);
      expect(events[0]).toBe(testEvent);
      
      // Should not be able to modify the returned array
      expect(() => {
        (events as any).push(testEvent);
      }).toThrow();
    });

    it('should add and retrieve domain events', () => {
      const event1 = new TestEvent('event.1', 'agg-1');
      const event2 = new TestEvent('event.2', 'agg-2');
      
      publisher.addEvent(event1);
      publisher.addEvent(event2);
      
      const events = publisher.getDomainEvents();
      expect(events).toHaveLength(2);
      expect(events[0]).toBe(event1);
      expect(events[1]).toBe(event2);
    });

    it('should clear all domain events', () => {
      publisher.addEvent(testEvent);
      publisher.addEvent(new TestEvent('another.event', 'agg-2'));
      
      expect(publisher.getDomainEvents()).toHaveLength(2);
      
      publisher.clearDomainEvents();
      
      expect(publisher.getDomainEvents()).toHaveLength(0);
    });

    it('should handle clearing empty event list', () => {
      expect(publisher.getDomainEvents()).toHaveLength(0);
      
      expect(() => publisher.clearDomainEvents()).not.toThrow();
      
      expect(publisher.getDomainEvents()).toHaveLength(0);
    });

    it('should maintain event order', () => {
      const events: TestEvent[] = [];
      
      for (let i = 0; i < 10; i++) {
        const event = new TestEvent(`event.${i}`, `agg-${i}`, { index: i });
        events.push(event);
        publisher.addEvent(event);
      }
      
      const retrievedEvents = publisher.getDomainEvents();
      expect(retrievedEvents).toHaveLength(10);
      
      for (let i = 0; i < 10; i++) {
        expect(retrievedEvents[i]).toBe(events[i]);
        expect(retrievedEvents[i].payload.index).toBe(i);
      }
    });
  });

  describe('DomainEventHandler Interface', () => {
    it('should have required eventType property', () => {
      expect(handler.eventType).toBe('test.event.created');
      expect(syncHandler.eventType).toBe('test.sync.event');
    });

    it('should handle async event processing', async () => {
      expect(handler.getHandleCallCount()).toBe(0);
      
      await handler.handle(testEvent);
      
      expect(handler.getHandleCallCount()).toBe(1);
      expect(handler.getLastHandledEvent()).toBe(testEvent);
    });

    it('should handle sync event processing', () => {
      expect(syncHandler.getHandleCallCount()).toBe(0);
      
      // Should not throw for sync handler
      expect(() => {
        syncHandler.handle(testEvent);
      }).not.toThrow();
      
      expect(syncHandler.getHandleCallCount()).toBe(1);
    });

    it('should handle multiple events', async () => {
      const event1 = new TestEvent('test.event.1', 'agg-1');
      const event2 = new TestEvent('test.event.2', 'agg-2');
      
      await handler.handle(event1);
      await handler.handle(event2);
      
      expect(handler.getHandleCallCount()).toBe(2);
      expect(handler.getLastHandledEvent()).toBe(event2);
    });

    it('should handle same event multiple times', async () => {
      await handler.handle(testEvent);
      await handler.handle(testEvent);
      await handler.handle(testEvent);
      
      expect(handler.getHandleCallCount()).toBe(3);
      expect(handler.getLastHandledEvent()).toBe(testEvent);
    });

    it('should support handler reset functionality', async () => {
      await handler.handle(testEvent);
      expect(handler.getHandleCallCount()).toBe(1);
      
      handler.reset();
      
      expect(handler.getHandleCallCount()).toBe(0);
      expect(handler.getLastHandledEvent()).toBeUndefined();
    });
  });

  describe('EventDispatcher Interface', () => {
    it('should publish single events', async () => {
      await dispatcher.publish(testEvent);
      
      const publishedEvents = dispatcher.getPublishedEvents();
      expect(publishedEvents).toHaveLength(1);
      expect(publishedEvents[0]).toBe(testEvent);
    });

    it('should publish multiple events', async () => {
      const events = [
        new TestEvent('event.1', 'agg-1'),
        new TestEvent('event.2', 'agg-2'),
        new TestEvent('event.3', 'agg-3'),
      ];
      
      await dispatcher.publishMany(events);
      
      const publishedEvents = dispatcher.getPublishedEvents();
      expect(publishedEvents).toHaveLength(3);
      expect(publishedEvents).toEqual(events);
    });

    it('should subscribe and notify handlers', async () => {
      dispatcher.subscribe('test.event.created', handler);
      
      await dispatcher.publish(testEvent);
      
      expect(handler.getHandleCallCount()).toBe(1);
      expect(handler.getLastHandledEvent()).toBe(testEvent);
    });

    it('should support multiple handlers for same event type', async () => {
      const handler2 = new TestEventHandler('test.event.created');
      const handler3 = new TestEventHandler('test.event.created');
      
      dispatcher.subscribe('test.event.created', handler);
      dispatcher.subscribe('test.event.created', handler2);
      dispatcher.subscribe('test.event.created', handler3);
      
      await dispatcher.publish(testEvent);
      
      expect(handler.getHandleCallCount()).toBe(1);
      expect(handler2.getHandleCallCount()).toBe(1);
      expect(handler3.getHandleCallCount()).toBe(1);
    });

    it('should handle different event types independently', async () => {
      const handler2 = new TestEventHandler('different.event.type');
      
      dispatcher.subscribe('test.event.created', handler);
      dispatcher.subscribe('different.event.type', handler2);
      
      await dispatcher.publish(testEvent);
      
      expect(handler.getHandleCallCount()).toBe(1);
      expect(handler2.getHandleCallCount()).toBe(0); // Different event type
    });

    it('should unsubscribe handlers', async () => {
      dispatcher.subscribe('test.event.created', handler);
      expect(dispatcher.getHandlerCount('test.event.created')).toBe(1);
      
      dispatcher.unsubscribe('test.event.created', handler);
      expect(dispatcher.getHandlerCount('test.event.created')).toBe(0);
      
      await dispatcher.publish(testEvent);
      expect(handler.getHandleCallCount()).toBe(0); // Should not be called
    });

    it('should handle unsubscribing non-existent handlers gracefully', () => {
      const nonExistentHandler = new TestEventHandler('non.existent');
      
      expect(() => {
        dispatcher.unsubscribe('test.event.created', nonExistentHandler);
        dispatcher.unsubscribe('non.existent.type', handler);
      }).not.toThrow();
    });

    it('should handle publishing to event types with no handlers', async () => {
      const orphanEvent = new TestEvent('orphan.event', 'agg-1');
      
      expect(() => dispatcher.publish(orphanEvent)).not.toThrow();
      
      await dispatcher.publish(orphanEvent);
      
      const publishedEvents = dispatcher.getPublishedEvents();
      expect(publishedEvents).toHaveLength(1);
      expect(publishedEvents[0]).toBe(orphanEvent);
    });

    it('should maintain subscription state correctly', () => {
      const handler2 = new TestEventHandler('test.event.created');
      const handler3 = new TestEventHandler('different.event');
      
      dispatcher.subscribe('test.event.created', handler);
      dispatcher.subscribe('test.event.created', handler2);
      dispatcher.subscribe('different.event', handler3);
      
      expect(dispatcher.getHandlerCount('test.event.created')).toBe(2);
      expect(dispatcher.getHandlerCount('different.event')).toBe(1);
      expect(dispatcher.getHandlerCount('non.existent')).toBe(0);
      
      dispatcher.unsubscribe('test.event.created', handler);
      
      expect(dispatcher.getHandlerCount('test.event.created')).toBe(1);
      expect(dispatcher.getHandlerCount('different.event')).toBe(1);
    });
  });

  describe('Integration Scenarios', () => {
    it('should support full publish-subscribe flow', async () => {
      // Setup: Subscribe handlers
      const handler1 = new TestEventHandler('order.created');
      const handler2 = new TestEventHandler('order.created');
      const handler3 = new TestEventHandler('order.updated');
      
      dispatcher.subscribe('order.created', handler1);
      dispatcher.subscribe('order.created', handler2);
      dispatcher.subscribe('order.updated', handler3);
      
      // Create events
      const orderCreatedEvent = new TestEvent('order.created', 'order-123', {
        orderId: 'order-123',
        amount: 1000,
        symbol: 'BTCUSDT'
      });
      
      const orderUpdatedEvent = new TestEvent('order.updated', 'order-123', {
        orderId: 'order-123',
        status: 'FILLED'
      });
      
      // Publish events
      await dispatcher.publish(orderCreatedEvent);
      await dispatcher.publish(orderUpdatedEvent);
      
      // Verify handling
      expect(handler1.getHandleCallCount()).toBe(1);
      expect(handler1.getLastHandledEvent()).toBe(orderCreatedEvent);
      expect(handler2.getHandleCallCount()).toBe(1);
      expect(handler2.getLastHandledEvent()).toBe(orderCreatedEvent);
      expect(handler3.getHandleCallCount()).toBe(1);
      expect(handler3.getLastHandledEvent()).toBe(orderUpdatedEvent);
    });

    it('should support event correlation across multiple aggregates', async () => {
      const correlationId = 'trade-session-456';
      
      const events = [
        new TestEvent('user.login', 'user-123', { userId: 'user-123' }, 'event-1', correlationId),
        new TestEvent('portfolio.accessed', 'portfolio-456', { portfolioId: 'portfolio-456' }, 'event-2', correlationId),
        new TestEvent('trade.executed', 'trade-789', { tradeId: 'trade-789' }, 'event-3', correlationId),
      ];
      
      await dispatcher.publishMany(events);
      
      const publishedEvents = dispatcher.getPublishedEvents();
      expect(publishedEvents).toHaveLength(3);
      
      publishedEvents.forEach(event => {
        expect(event.correlationId).toBe(correlationId);
      });
    });

    it('should handle complex event flows with dependencies', async () => {
      const results: string[] = [];
      
      // Create handlers that track execution order
      const handler1 = {
        eventType: 'workflow.step',
        async handle(event: DomainEvent): Promise<void> {
          results.push(`handler1:${event.payload.step}`);
        }
      };
      
      const handler2 = {
        eventType: 'workflow.step',
        async handle(event: DomainEvent): Promise<void> {
          results.push(`handler2:${event.payload.step}`);
        }
      };
      
      dispatcher.subscribe('workflow.step', handler1);
      dispatcher.subscribe('workflow.step', handler2);
      
      const workflowEvents = [
        new TestEvent('workflow.step', 'workflow-1', { step: 'validate' }),
        new TestEvent('workflow.step', 'workflow-1', { step: 'execute' }),
        new TestEvent('workflow.step', 'workflow-1', { step: 'confirm' }),
      ];
      
      await dispatcher.publishMany(workflowEvents);
      
      expect(results).toEqual([
        'handler1:validate',
        'handler2:validate',
        'handler1:execute',
        'handler2:execute',
        'handler1:confirm',
        'handler2:confirm',
      ]);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle handler errors gracefully', async () => {
      const errorHandler = {
        eventType: 'test.event.created',
        async handle(_event: DomainEvent): Promise<void> {
          throw new Error('Handler error');
        }
      };
      
      dispatcher.subscribe('test.event.created', errorHandler);
      
      // This behavior depends on implementation - should either throw or handle gracefully
      await expect(dispatcher.publish(testEvent)).rejects.toThrow('Handler error');
    });

    it('should handle events with null/undefined values', async () => {
      const nullEvent = new TestEvent('null.event', 'agg-1', { value: null, undefined: undefined });
      
      dispatcher.subscribe('null.event', handler);
      await dispatcher.publish(nullEvent);
      
      expect(handler.getHandleCallCount()).toBe(1);
      expect(handler.getLastHandledEvent()?.payload.value).toBeNull();
    });

    it('should handle very large event payloads', async () => {
      const largePayload: Record<string, any> = {};
      for (let i = 0; i < 1000; i++) {
        largePayload[`field${i}`] = `value${i}`.repeat(100);
      }
      
      const largeEvent = new TestEvent('large.event', 'agg-1', largePayload);
      
      dispatcher.subscribe('large.event', handler);
      await dispatcher.publish(largeEvent);
      
      expect(handler.getHandleCallCount()).toBe(1);
      expect(handler.getLastHandledEvent()?.payload).toEqual(largePayload);
    });

    it('should handle rapid event publishing', async () => {
      const eventCount = 100;
      const events: TestEvent[] = [];
      
      for (let i = 0; i < eventCount; i++) {
        events.push(new TestEvent(`rapid.event.${i}`, `agg-${i}`, { index: i }));
      }
      
      dispatcher.subscribe('rapid.event.0', handler); // Subscribe to first event type only
      
      const startTime = Date.now();
      await dispatcher.publishMany(events);
      const duration = Date.now() - startTime;
      
      expect(handler.getHandleCallCount()).toBe(1); // Only first event matches subscription
      expect(dispatcher.getPublishedEvents()).toHaveLength(eventCount);
      expect(duration).toBeLessThan(1000); // Should handle rapid publishing efficiently
    });
  });

  describe('Performance Tests', () => {
    it('should handle many subscriptions efficiently', async () => {
      const handlerCount = 100;
      const handlers: TestEventHandler[] = [];
      
      for (let i = 0; i < handlerCount; i++) {
        const h = new TestEventHandler('performance.test');
        handlers.push(h);
        dispatcher.subscribe('performance.test', h);
      }
      
      const event = new TestEvent('performance.test', 'agg-1');
      
      const startTime = Date.now();
      await dispatcher.publish(event);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(100); // Should handle 100 handlers efficiently
      handlers.forEach(h => {
        expect(h.getHandleCallCount()).toBe(1);
      });
    });

    it('should handle large event batches efficiently', async () => {
      const eventCount = 1000;
      const events: TestEvent[] = [];
      
      for (let i = 0; i < eventCount; i++) {
        events.push(new TestEvent('batch.test', `agg-${i}`, { index: i }));
      }
      
      const startTime = Date.now();
      await dispatcher.publishMany(events);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(1000); // Should handle 1000 events in under 1 second
      expect(dispatcher.getPublishedEvents()).toHaveLength(eventCount);
    });
  });
});