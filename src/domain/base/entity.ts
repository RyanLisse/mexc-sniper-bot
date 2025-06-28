/**
 * Base Entity class for all domain entities
 * Provides common functionality for entities including domain event handling
 */

import type { DomainEvent, DomainEventPublisher } from "../events/domain-event";

export abstract class Entity<TId> implements DomainEventPublisher {
  protected readonly _id: TId;
  private _domainEvents: DomainEvent[] = [];

  constructor(id: TId) {
    this._id = id;
  }

  get id(): TId {
    return this._id;
  }

  /**
   * Get all uncommitted domain events
   */
  getDomainEvents(): readonly DomainEvent[] {
    return this._domainEvents;
  }

  /**
   * Clear all domain events (typically after publishing)
   */
  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  /**
   * Add a domain event to the uncommitted events list
   */
  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  /**
   * Equality comparison based on ID
   */
  equals(other: Entity<TId>): boolean {
    if (!(other instanceof Entity)) {
      return false;
    }
    return this._id === other._id;
  }
}
