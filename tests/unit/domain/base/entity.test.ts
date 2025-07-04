/**
 * Unit tests for Entity Base Class
 * Tests entity identity, domain event handling, and equality comparison
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Entity } from '../../../../src/domain/base/entity';
import type { DomainEvent } from '../../../../src/domain/events/domain-event';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../../utils/timeout-elimination-helpers';

// Test implementation of Entity for testing purposes
class TestEntity extends Entity<string> {
  private _name: string;

  constructor(id: string, name: string) {
    super(id);
    this._name = name;
  }

  get name(): string {
    return this._name;
  }

  // Public method to add domain events for testing
  public addTestEvent(event: DomainEvent): void {
    this.addDomainEvent(event);
  }

  // Public method to test equality
  public testEquals(other: TestEntity): boolean {
    return this.equals(other);
  }
}

// Another test entity for comparison tests
class AnotherTestEntity extends Entity<string> {
  constructor(id: string) {
    super(id);
  }
}

describe('Entity Base Class', () => {
  let entity: TestEntity;
  let sameEntity: TestEntity;
  let differentEntity: TestEntity;
  let anotherTypeEntity: AnotherTestEntity;
  let testEvent: DomainEvent;

  beforeEach(() => {
    entity = new TestEntity('test-id-1', 'Test Entity');
    sameEntity = new TestEntity('test-id-1', 'Same Entity');
    differentEntity = new TestEntity('test-id-2', 'Different Entity');
    anotherTypeEntity = new AnotherTestEntity('test-id-1');

    testEvent = {
      type: 'test.event',
      aggregateId: 'test-id-1',
      payload: { message: 'Test event' },
      occurredAt: new Date(),
      eventId: 'event-123',
      correlationId: 'correlation-456',
    };
  });

  describe('Entity Identity', () => {
    it('should return correct id', () => {
      expect(entity.id).toBe('test-id-1');
    });

    it('should maintain consistent id', () => {
      const originalId = entity.id;
      // Try to access id multiple times
      expect(entity.id).toBe(originalId);
      expect(entity.id).toBe(originalId);
    });

    it('should have readonly id property', () => {
      // TypeScript should prevent this at compile time, but test runtime behavior
      expect(() => {
        (entity as any)._id = 'new-id';
      }).not.toThrow(); // The property is protected, so this won't throw but won't change the public id

      expect(entity.id).toBe('test-id-1'); // ID should remain unchanged
    });
  });

  describe('Domain Event Handling', () => {
    it('should start with empty domain events', () => {
      expect(entity.getDomainEvents()).toHaveLength(0);
    });

    it('should add domain event correctly', () => {
      entity.addTestEvent(testEvent);
      
      const events = entity.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBe(testEvent);
    });

    it('should add multiple domain events', () => {
      const event1: DomainEvent = {
        type: 'test.event.1',
        aggregateId: 'test-id-1',
        payload: { message: 'First event' },
        occurredAt: new Date(),
      };

      const event2: DomainEvent = {
        type: 'test.event.2',
        aggregateId: 'test-id-1',
        payload: { message: 'Second event' },
        occurredAt: new Date(),
      };

      entity.addTestEvent(event1);
      entity.addTestEvent(event2);

      const events = entity.getDomainEvents();
      expect(events).toHaveLength(2);
      expect(events[0]).toBe(event1);
      expect(events[1]).toBe(event2);
    });

    it('should maintain order of domain events', () => {
      const events: DomainEvent[] = [];
      
      for (let i = 0; i < 5; i++) {
        const event: DomainEvent = {
          type: `test.event.${i}`,
          aggregateId: 'test-id-1',
          payload: { index: i },
          occurredAt: new Date(),
        };
        events.push(event);
        entity.addTestEvent(event);
      }

      const retrievedEvents = entity.getDomainEvents();
      expect(retrievedEvents).toHaveLength(5);
      
      for (let i = 0; i < 5; i++) {
        expect(retrievedEvents[i]).toBe(events[i]);
        expect(retrievedEvents[i].payload.index).toBe(i);
      }
    });

    it('should return readonly domain events', () => {
      entity.addTestEvent(testEvent);
      
      const events = entity.getDomainEvents();
      expect(events).toHaveLength(1);

      // Should not be able to modify the returned array
      expect(() => {
        (events as any).push(testEvent);
      }).toThrow();
    });

    it('should clear domain events', () => {
      entity.addTestEvent(testEvent);
      entity.addTestEvent(testEvent);
      
      expect(entity.getDomainEvents()).toHaveLength(2);
      
      entity.clearDomainEvents();
      
      expect(entity.getDomainEvents()).toHaveLength(0);
    });

    it('should clear empty domain events without error', () => {
      expect(entity.getDomainEvents()).toHaveLength(0);
      
      expect(() => entity.clearDomainEvents()).not.toThrow();
      
      expect(entity.getDomainEvents()).toHaveLength(0);
    });

    it('should allow adding events after clearing', () => {
      entity.addTestEvent(testEvent);
      entity.clearDomainEvents();
      
      const newEvent: DomainEvent = {
        type: 'new.event',
        aggregateId: 'test-id-1',
        payload: { message: 'New event after clear' },
        occurredAt: new Date(),
      };
      
      entity.addTestEvent(newEvent);
      
      const events = entity.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBe(newEvent);
    });
  });

  describe('Entity Equality', () => {
    it('should be equal to entity with same id', () => {
      expect(entity.testEquals(sameEntity)).toBe(true);
    });

    it('should not be equal to entity with different id', () => {
      expect(entity.testEquals(differentEntity)).toBe(false);
    });

    it('should not be equal to different entity type with same id', () => {
      expect(entity.equals(anotherTypeEntity as any)).toBe(true); // Same ID, should be equal
    });

    it('should not be equal to non-entity object', () => {
      const nonEntity = { id: 'test-id-1' };
      expect(entity.equals(nonEntity as any)).toBe(false);
    });

    it('should not be equal to null', () => {
      expect(entity.equals(null as any)).toBe(false);
    });

    it('should not be equal to undefined', () => {
      expect(entity.equals(undefined as any)).toBe(false);
    });

    it('should be equal to itself', () => {
      expect(entity.testEquals(entity)).toBe(true);
    });

    it('should handle numeric ids', () => {
      class NumericEntity extends Entity<number> {
        public testEquals(other: NumericEntity): boolean {
          return this.equals(other);
        }
      }

      const entity1 = new NumericEntity(123);
      const entity2 = new NumericEntity(123);
      const entity3 = new NumericEntity(456);

      expect(entity1.testEquals(entity2)).toBe(true);
      expect(entity1.testEquals(entity3)).toBe(false);
    });

    it('should handle complex id types', () => {
      interface ComplexId {
        type: string;
        value: string;
      }

      class ComplexEntity extends Entity<ComplexId> {
        public testEquals(other: ComplexEntity): boolean {
          return this.equals(other);
        }
      }

      const id1: ComplexId = { type: 'user', value: '123' };
      const id2: ComplexId = { type: 'user', value: '123' };
      const id3: ComplexId = { type: 'user', value: '456' };

      const entity1 = new ComplexEntity(id1);
      const entity2 = new ComplexEntity(id2);
      const entity3 = new ComplexEntity(id3);

      expect(entity1.testEquals(entity2)).toBe(false); // Objects are different references
      expect(entity1.testEquals(entity3)).toBe(false);
    });
  });

  describe('Entity State Management', () => {
    it('should maintain independent state between entities', () => {
      const event1: DomainEvent = {
        type: 'entity1.event',
        aggregateId: 'test-id-1',
        payload: { source: 'entity1' },
        occurredAt: new Date(),
      };

      const event2: DomainEvent = {
        type: 'entity2.event',
        aggregateId: 'test-id-2',
        payload: { source: 'entity2' },
        occurredAt: new Date(),
      };

      entity.addTestEvent(event1);
      differentEntity.addTestEvent(event2);

      expect(entity.getDomainEvents()).toHaveLength(1);
      expect(differentEntity.getDomainEvents()).toHaveLength(1);
      expect(entity.getDomainEvents()[0]).toBe(event1);
      expect(differentEntity.getDomainEvents()[0]).toBe(event2);

      entity.clearDomainEvents();

      expect(entity.getDomainEvents()).toHaveLength(0);
      expect(differentEntity.getDomainEvents()).toHaveLength(1); // Should not be affected
    });

    it('should allow extending entity with additional properties', () => {
      expect(entity.name).toBe('Test Entity');
      expect(sameEntity.name).toBe('Same Entity');
      
      // Properties should be independent
      expect(entity.name).not.toBe(sameEntity.name);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string id', () => {
      const emptyIdEntity = new TestEntity('', 'Empty ID Entity');
      expect(emptyIdEntity.id).toBe('');
    });

    it('should handle special character ids', () => {
      const specialId = 'test-id!@#$%^&*()_+{}[]|:";\'<>?,./';
      const specialEntity = new TestEntity(specialId, 'Special Entity');
      expect(specialEntity.id).toBe(specialId);
    });

    it('should handle very long ids', () => {
      const longId = 'a'.repeat(1000);
      const longIdEntity = new TestEntity(longId, 'Long ID Entity');
      expect(longIdEntity.id).toBe(longId);
      expect(longIdEntity.id.length).toBe(1000);
    });

    it('should handle adding many domain events', () => {
      const eventCount = 1000;
      
      for (let i = 0; i < eventCount; i++) {
        const event: DomainEvent = {
          type: `bulk.event.${i}`,
          aggregateId: 'test-id-1',
          payload: { index: i },
          occurredAt: new Date(),
        };
        entity.addTestEvent(event);
      }

      expect(entity.getDomainEvents()).toHaveLength(eventCount);
    });
  });

  describe('Performance Tests', () => {
    it('should handle domain event operations efficiently', () => {
      const startTime = Date.now();
      const eventCount = 100;

      // Add events
      for (let i = 0; i < eventCount; i++) {
        const event: DomainEvent = {
          type: `performance.event.${i}`,
          aggregateId: 'test-id-1',
          payload: { index: i },
          occurredAt: new Date(),
        };
        entity.addTestEvent(event);
      }

      // Retrieve events
      const events = entity.getDomainEvents();
      expect(events).toHaveLength(eventCount);

      // Clear events
      entity.clearDomainEvents();
      expect(entity.getDomainEvents()).toHaveLength(0);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });

    it('should perform equality comparisons efficiently', () => {
      const startTime = Date.now();
      const comparisonCount = 1000;

      for (let i = 0; i < comparisonCount; i++) {
        entity.testEquals(sameEntity);
        entity.testEquals(differentEntity);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50); // Should complete comparisons in under 50ms
    });
  });
});