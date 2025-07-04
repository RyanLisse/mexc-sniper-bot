/**
 * Unit tests for AggregateRoot Base Class
 * Tests aggregate root functionality, domain event handling, and modification tracking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AggregateRoot } from '../../../../src/domain/base/aggregate-root';
import type { DomainEvent } from '../../../../src/domain/events/domain-event';

// Test implementation of AggregateRoot for testing purposes
class TestAggregateRoot extends AggregateRoot<string> {
  private _name: string;
  private _version: number;
  private _isModified: boolean = false;

  constructor(id: string, name: string, version: number = 1) {
    super(id);
    this._name = name;
    this._version = version;
  }

  get name(): string {
    return this._name;
  }

  get version(): number {
    return this._version;
  }

  get isModified(): boolean {
    return this._isModified;
  }

  // Business method that modifies the aggregate
  updateName(newName: string): void {
    if (newName !== this._name) {
      this._name = newName;
      this.markAsModified();
      
      // Add domain event
      this.addTestEvent({
        type: 'test.aggregate.name.updated',
        aggregateId: this.id,
        payload: { newName, oldName: this._name },
        occurredAt: new Date(),
      });
    }
  }

  // Business method that modifies version
  incrementVersion(): void {
    this._version++;
    this.markAsModified();
    
    this.addTestEvent({
      type: 'test.aggregate.version.incremented',
      aggregateId: this.id,
      payload: { newVersion: this._version },
      occurredAt: new Date(),
    });
  }

  // Public method to add domain events for testing
  public addTestEvent(event: DomainEvent): void {
    this.addDomainEvent(event);
  }

  // Override markAsModified to track modification state
  protected markAsModified(): void {
    super.markAsModified();
    this._isModified = true;
  }

  // Method to reset modification state for testing
  public resetModificationState(): void {
    this._isModified = false;
  }

  // Method to test equality
  public testEquals(other: TestAggregateRoot): boolean {
    return this.equals(other);
  }

  // Method to manually trigger markAsModified for testing
  public triggerMarkAsModified(): void {
    this.markAsModified();
  }
}

// Another aggregate for testing relationships
class AnotherAggregateRoot extends AggregateRoot<number> {
  private _description: string;

  constructor(id: number, description: string) {
    super(id);
    this._description = description;
  }

  get description(): string {
    return this._description;
  }

  public testEquals(other: AnotherAggregateRoot): boolean {
    return this.equals(other);
  }
}

describe('AggregateRoot Base Class', () => {
  let aggregate: TestAggregateRoot;
  let sameAggregate: TestAggregateRoot;
  let differentAggregate: TestAggregateRoot;
  let anotherTypeAggregate: AnotherAggregateRoot;

  beforeEach(() => {
    aggregate = new TestAggregateRoot('agg-1', 'Test Aggregate', 1);
    sameAggregate = new TestAggregateRoot('agg-1', 'Same Aggregate', 1);
    differentAggregate = new TestAggregateRoot('agg-2', 'Different Aggregate', 1);
    anotherTypeAggregate = new AnotherAggregateRoot(1, 'Another Aggregate');
  });

  describe('AggregateRoot Inheritance', () => {
    it('should inherit from Entity', () => {
      expect(aggregate.id).toBe('agg-1');
      expect(aggregate.getDomainEvents()).toHaveLength(0);
    });

    it('should maintain aggregate-specific properties', () => {
      expect(aggregate.name).toBe('Test Aggregate');
      expect(aggregate.version).toBe(1);
      expect(aggregate.isModified).toBe(false);
    });

    it('should support entity equality comparison', () => {
      expect(aggregate.testEquals(sameAggregate)).toBe(true);
      expect(aggregate.testEquals(differentAggregate)).toBe(false);
    });

    it('should work with different ID types', () => {
      expect(anotherTypeAggregate.id).toBe(1);
      expect(anotherTypeAggregate.description).toBe('Another Aggregate');
    });
  });

  describe('Modification Tracking', () => {
    it('should start unmodified', () => {
      expect(aggregate.isModified).toBe(false);
    });

    it('should track modification when markAsModified is called', () => {
      aggregate.triggerMarkAsModified();
      expect(aggregate.isModified).toBe(true);
    });

    it('should track modifications through business operations', () => {
      expect(aggregate.isModified).toBe(false);
      
      aggregate.updateName('New Name');
      
      expect(aggregate.isModified).toBe(true);
      expect(aggregate.name).toBe('New Name');
    });

    it('should not mark as modified when no change occurs', () => {
      const originalName = aggregate.name;
      
      aggregate.updateName(originalName); // Same name
      
      expect(aggregate.isModified).toBe(false);
    });

    it('should allow resetting modification state', () => {
      aggregate.triggerMarkAsModified();
      expect(aggregate.isModified).toBe(true);
      
      aggregate.resetModificationState();
      expect(aggregate.isModified).toBe(false);
    });

    it('should track multiple modifications', () => {
      aggregate.updateName('First Update');
      expect(aggregate.isModified).toBe(true);
      
      aggregate.resetModificationState();
      expect(aggregate.isModified).toBe(false);
      
      aggregate.incrementVersion();
      expect(aggregate.isModified).toBe(true);
    });
  });

  describe('Domain Event Integration', () => {
    it('should emit domain events during business operations', () => {
      aggregate.updateName('Updated Name');
      
      const events = aggregate.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('test.aggregate.name.updated');
      expect(events[0].aggregateId).toBe('agg-1');
      expect(events[0].payload.newName).toBe('Updated Name');
    });

    it('should emit multiple domain events for multiple operations', () => {
      aggregate.updateName('Updated Name');
      aggregate.incrementVersion();
      
      const events = aggregate.getDomainEvents();
      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('test.aggregate.name.updated');
      expect(events[1].type).toBe('test.aggregate.version.incremented');
    });

    it('should not emit events when no changes occur', () => {
      const originalName = aggregate.name;
      
      aggregate.updateName(originalName);
      
      expect(aggregate.getDomainEvents()).toHaveLength(0);
    });

    it('should clear domain events when requested', () => {
      aggregate.updateName('Updated Name');
      aggregate.incrementVersion();
      
      expect(aggregate.getDomainEvents()).toHaveLength(2);
      
      aggregate.clearDomainEvents();
      
      expect(aggregate.getDomainEvents()).toHaveLength(0);
    });

    it('should maintain domain events after clearing and new operations', () => {
      aggregate.updateName('First Update');
      aggregate.clearDomainEvents();
      
      aggregate.updateName('Second Update');
      
      const events = aggregate.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0].payload.newName).toBe('Second Update');
    });
  });

  describe('Business Logic Operations', () => {
    it('should update name and track changes', () => {
      const originalName = aggregate.name;
      const newName = 'Updated Name';
      
      aggregate.updateName(newName);
      
      expect(aggregate.name).toBe(newName);
      expect(aggregate.name).not.toBe(originalName);
      expect(aggregate.isModified).toBe(true);
    });

    it('should increment version and track changes', () => {
      const originalVersion = aggregate.version;
      
      aggregate.incrementVersion();
      
      expect(aggregate.version).toBe(originalVersion + 1);
      expect(aggregate.isModified).toBe(true);
    });

    it('should handle multiple version increments', () => {
      const originalVersion = aggregate.version;
      
      aggregate.incrementVersion();
      aggregate.incrementVersion();
      aggregate.incrementVersion();
      
      expect(aggregate.version).toBe(originalVersion + 3);
    });

    it('should handle empty string name updates', () => {
      aggregate.updateName('');
      
      expect(aggregate.name).toBe('');
      expect(aggregate.isModified).toBe(true);
    });

    it('should handle special character names', () => {
      const specialName = 'Test!@#$%^&*()_+{}[]|:";\'<>?,./';
      
      aggregate.updateName(specialName);
      
      expect(aggregate.name).toBe(specialName);
      expect(aggregate.isModified).toBe(true);
    });
  });

  describe('Aggregate Identity and State', () => {
    it('should maintain independent state between aggregates', () => {
      aggregate.updateName('Aggregate 1 Name');
      differentAggregate.updateName('Aggregate 2 Name');
      
      expect(aggregate.name).toBe('Aggregate 1 Name');
      expect(differentAggregate.name).toBe('Aggregate 2 Name');
      expect(aggregate.isModified).toBe(true);
      expect(differentAggregate.isModified).toBe(true);
      
      aggregate.clearDomainEvents();
      
      expect(aggregate.getDomainEvents()).toHaveLength(0);
      expect(differentAggregate.getDomainEvents()).toHaveLength(1); // Should not be affected
    });

    it('should handle aggregate reconstruction from existing state', () => {
      // Simulate loading aggregate from persistence
      const existingAggregate = new TestAggregateRoot('existing-1', 'Existing Name', 5);
      
      expect(existingAggregate.id).toBe('existing-1');
      expect(existingAggregate.name).toBe('Existing Name');
      expect(existingAggregate.version).toBe(5);
      expect(existingAggregate.isModified).toBe(false);
      expect(existingAggregate.getDomainEvents()).toHaveLength(0);
    });

    it('should support complex aggregate state changes', () => {
      // Complex business operation
      aggregate.updateName('Step 1');
      aggregate.incrementVersion();
      aggregate.updateName('Step 2');
      aggregate.incrementVersion();
      
      expect(aggregate.name).toBe('Step 2');
      expect(aggregate.version).toBe(3); // Started at 1, incremented twice
      expect(aggregate.isModified).toBe(true);
      expect(aggregate.getDomainEvents()).toHaveLength(4); // 2 name updates + 2 version increments
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle null name updates gracefully', () => {
      expect(() => {
        aggregate.updateName(null as any);
      }).not.toThrow();
      
      expect(aggregate.name).toBe(null);
      expect(aggregate.isModified).toBe(true);
    });

    it('should handle undefined name updates gracefully', () => {
      expect(() => {
        aggregate.updateName(undefined as any);
      }).not.toThrow();
      
      expect(aggregate.name).toBe(undefined);
      expect(aggregate.isModified).toBe(true);
    });

    it('should handle very long names', () => {
      const longName = 'a'.repeat(10000);
      
      aggregate.updateName(longName);
      
      expect(aggregate.name).toBe(longName);
      expect(aggregate.name.length).toBe(10000);
      expect(aggregate.isModified).toBe(true);
    });

    it('should handle rapid state changes', () => {
      for (let i = 0; i < 100; i++) {
        aggregate.updateName(`Name ${i}`);
        aggregate.incrementVersion();
      }
      
      expect(aggregate.name).toBe('Name 99');
      expect(aggregate.version).toBe(101); // Started at 1, incremented 100 times
      expect(aggregate.getDomainEvents()).toHaveLength(200); // 100 name updates + 100 version increments
    });
  });

  describe('Performance Considerations', () => {
    it('should handle many domain events efficiently', () => {
      const startTime = Date.now();
      const operationCount = 1000;
      
      for (let i = 0; i < operationCount; i++) {
        aggregate.updateName(`Name ${i}`);
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete 1000 operations in under 1 second
      expect(aggregate.getDomainEvents()).toHaveLength(operationCount);
    });

    it('should perform equality checks efficiently', () => {
      const startTime = Date.now();
      const comparisonCount = 1000;
      
      for (let i = 0; i < comparisonCount; i++) {
        aggregate.testEquals(sameAggregate);
        aggregate.testEquals(differentAggregate);
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should complete comparisons efficiently
    });

    it('should handle large event collections efficiently', () => {
      // Add many events
      for (let i = 0; i < 1000; i++) {
        aggregate.addTestEvent({
          type: `test.event.${i}`,
          aggregateId: aggregate.id,
          payload: { index: i },
          occurredAt: new Date(),
        });
      }
      
      const startTime = Date.now();
      
      // Test event retrieval
      const events = aggregate.getDomainEvents();
      expect(events).toHaveLength(1000);
      
      // Test event clearing
      aggregate.clearDomainEvents();
      expect(aggregate.getDomainEvents()).toHaveLength(0);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50); // Should handle large collections efficiently
    });
  });

  describe('Integration with Entity Features', () => {
    it('should support all inherited entity functionality', () => {
      // Test domain event functionality inherited from Entity
      const testEvent: DomainEvent = {
        type: 'manual.test.event',
        aggregateId: aggregate.id,
        payload: { message: 'Manual test' },
        occurredAt: new Date(),
      };
      
      aggregate.addTestEvent(testEvent);
      
      expect(aggregate.getDomainEvents()).toHaveLength(1);
      expect(aggregate.getDomainEvents()[0]).toBe(testEvent);
      
      aggregate.clearDomainEvents();
      expect(aggregate.getDomainEvents()).toHaveLength(0);
    });

    it('should maintain entity identity while supporting aggregate features', () => {
      expect(aggregate.id).toBe('agg-1');
      expect(aggregate.testEquals(sameAggregate)).toBe(true);
      expect(aggregate.testEquals(differentAggregate)).toBe(false);
      
      // Modify state
      aggregate.updateName('Modified');
      
      // Identity should remain the same
      expect(aggregate.id).toBe('agg-1');
      expect(aggregate.testEquals(sameAggregate)).toBe(true); // Still same ID
    });
  });
});