/**
 * Base interface for all domain events
 * Domain events represent something important that happened in the domain
 */
export interface DomainEvent {
  /** Type identifier for the event */
  readonly type: string;
  /** ID of the aggregate that generated the event */
  readonly aggregateId: string;
  /** Event payload containing relevant data */
  readonly payload: Record<string, any>;
  /** When the event occurred */
  readonly occurredAt: Date;
  /** Optional event ID for tracking */
  readonly eventId?: string;
  /** Optional correlation ID for tracing */
  readonly correlationId?: string;
}

/**
 * Interface for entities that can publish domain events
 */
export interface DomainEventPublisher {
  /** Get all uncommitted domain events */
  getDomainEvents(): readonly DomainEvent[];
  /** Clear all domain events (typically after publishing) */
  clearDomainEvents(): void;
}

/**
 * Interface for handling domain events
 */
export interface DomainEventHandler<T extends DomainEvent = DomainEvent> {
  /** The event type this handler processes */
  readonly eventType: string;
  /** Handle the domain event */
  handle(event: T): Promise<void> | void;
}

/**
 * Event dispatcher for publishing domain events
 */
export interface EventDispatcher {
  /** Publish a single domain event */
  publish<T extends DomainEvent>(event: T): Promise<void>;
  /** Publish multiple domain events */
  publishMany(events: DomainEvent[]): Promise<void>;
  /** Subscribe to domain events of a specific type */
  subscribe<T extends DomainEvent>(eventType: string, handler: DomainEventHandler<T>): void;
  /** Unsubscribe from domain events */
  unsubscribe(eventType: string, handler: DomainEventHandler): void;
}
