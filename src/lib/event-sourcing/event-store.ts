/**
 * Event Store Implementation
 *
 * Core event sourcing infrastructure for Phase 3 Production Readiness.
 * Provides persistent event storage, replay capabilities, and snapshot management.
 */

import { EventEmitter } from "node:events";

// Core Event Sourcing Types
export interface DomainEvent {
  id: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  eventVersion: number;
  payload: any;
  metadata: {
    timestamp: Date;
    correlationId?: string;
    causationId?: string;
    userId?: string;
    source: string;
  };
}

export interface EventMetadata {
  timestamp: Date;
  correlationId?: string;
  causationId?: string;
  userId?: string;
  source: string;
}

export interface AggregateSnapshot {
  aggregateId: string;
  aggregateType: string;
  version: number;
  data: any;
  timestamp: Date;
}

export interface EventStoreConfig {
  snapshotFrequency: number; // Take snapshot every N events
  maxEventsPerRead: number;
  enableSnapshots: boolean;
  compressionEnabled: boolean;
}

/**
 * In-Memory Event Store
 *
 * Production implementation would use PostgreSQL, EventStore, or similar
 */
export class InMemoryEventStore extends EventEmitter {
  private events: Map<string, DomainEvent[]> = new Map();
  private snapshots: Map<string, AggregateSnapshot> = new Map();
  private eventCounter: number = 0;
  private config: EventStoreConfig;

  constructor(config: Partial<EventStoreConfig> = {}) {
    super();
    this.config = {
      snapshotFrequency: 10,
      maxEventsPerRead: 1000,
      enableSnapshots: true,
      compressionEnabled: false,
      ...config,
    };
  }

  /**
   * Append events to the event store
   */
  async appendEvents(
    aggregateId: string,
    expectedVersion: number,
    events: DomainEvent[]
  ): Promise<void> {
    const aggregateEvents = this.events.get(aggregateId) || [];

    // Optimistic concurrency check
    if (aggregateEvents.length !== expectedVersion) {
      throw new Error(
        `Concurrency conflict: expected version ${expectedVersion}, got ${aggregateEvents.length}`
      );
    }

    // Add version numbers to events
    const versionedEvents = events.map((event, index) => ({
      ...event,
      eventVersion: expectedVersion + index + 1,
    }));

    // Store events
    aggregateEvents.push(...versionedEvents);
    this.events.set(aggregateId, aggregateEvents);
    this.eventCounter += events.length;

    // Create snapshot if needed
    if (
      this.config.enableSnapshots &&
      aggregateEvents.length % this.config.snapshotFrequency === 0
    ) {
      await this.createSnapshotPoint(aggregateId);
    }

    // Emit events for projections and read models
    for (const event of versionedEvents) {
      this.emit("event_appended", event);
      this.emit(`event_${event.eventType}`, event);
    }
  }

  /**
   * Get events for an aggregate
   */
  async getEventsForAggregate(
    aggregateId: string,
    fromVersion: number = 0
  ): Promise<DomainEvent[]> {
    const events = this.events.get(aggregateId) || [];
    return events.filter((event) => event.eventVersion > fromVersion);
  }

  /**
   * Get events by type
   */
  async getEventsByType(
    eventType: string,
    fromTimestamp?: Date,
    limit: number = this.config.maxEventsPerRead
  ): Promise<DomainEvent[]> {
    const allEvents: DomainEvent[] = [];

    for (const aggregateEvents of this.events.values()) {
      for (const event of aggregateEvents) {
        if (event.eventType === eventType) {
          if (!fromTimestamp || event.metadata.timestamp >= fromTimestamp) {
            allEvents.push(event);
          }
        }
      }
    }

    // Sort by timestamp
    allEvents.sort((a, b) => a.metadata.timestamp.getTime() - b.metadata.timestamp.getTime());

    return allEvents.slice(0, limit);
  }

  /**
   * Get all events in chronological order
   */
  async getAllEvents(
    fromTimestamp?: Date,
    limit: number = this.config.maxEventsPerRead
  ): Promise<DomainEvent[]> {
    const allEvents: DomainEvent[] = [];

    for (const aggregateEvents of this.events.values()) {
      allEvents.push(...aggregateEvents);
    }

    // Filter by timestamp if provided
    const filteredEvents = fromTimestamp
      ? allEvents.filter((event) => event.metadata.timestamp >= fromTimestamp)
      : allEvents;

    // Sort by timestamp
    filteredEvents.sort((a, b) => a.metadata.timestamp.getTime() - b.metadata.timestamp.getTime());

    return filteredEvents.slice(0, limit);
  }

  /**
   * Save snapshot
   */
  async saveSnapshot(snapshot: AggregateSnapshot): Promise<void> {
    this.snapshots.set(snapshot.aggregateId, snapshot);
    this.emit("snapshot_created", snapshot);
  }

  /**
   * Get latest snapshot for aggregate
   */
  async getLatestSnapshot(aggregateId: string): Promise<AggregateSnapshot | null> {
    return this.snapshots.get(aggregateId) || null;
  }

  /**
   * Get event store statistics
   */
  getStatistics(): {
    totalEvents: number;
    totalAggregates: number;
    totalSnapshots: number;
    averageEventsPerAggregate: number;
  } {
    const totalAggregates = this.events.size;
    const totalSnapshots = this.snapshots.size;
    const averageEventsPerAggregate = totalAggregates > 0 ? this.eventCounter / totalAggregates : 0;

    return {
      totalEvents: this.eventCounter,
      totalAggregates,
      totalSnapshots,
      averageEventsPerAggregate: Math.round(averageEventsPerAggregate * 100) / 100,
    };
  }

  /**
   * Replay events to rebuild read models
   */
  async replayEvents(
    fromTimestamp?: Date,
    eventHandler?: (event: DomainEvent) => Promise<void>
  ): Promise<number> {
    const events = await this.getAllEvents(fromTimestamp);
    let processedCount = 0;

    for (const event of events) {
      if (eventHandler) {
        await eventHandler(event);
      } else {
        // Re-emit for default handlers
        this.emit("event_replayed", event);
        this.emit(`event_${event.eventType}`, event);
      }
      processedCount++;
    }

    return processedCount;
  }

  /**
   * Create snapshot point
   */
  private async createSnapshotPoint(aggregateId: string): Promise<void> {
    const events = this.events.get(aggregateId);
    if (!events || events.length === 0) return;

    const latestEvent = events[events.length - 1];

    // Simple snapshot - in real implementation, this would rebuild aggregate state
    const snapshot: AggregateSnapshot = {
      aggregateId,
      aggregateType: latestEvent.aggregateType,
      version: latestEvent.eventVersion,
      data: {
        eventCount: events.length,
        lastEvent: latestEvent.eventType,
        lastUpdate: latestEvent.metadata.timestamp,
      },
      timestamp: new Date(),
    };

    await this.saveSnapshot(snapshot);
  }

  /**
   * Clear all data (for testing)
   */
  async clear(): Promise<void> {
    this.events.clear();
    this.snapshots.clear();
    this.eventCounter = 0;
    this.removeAllListeners();
  }
}

/**
 * Event Factory
 */
export class EventFactory {
  static createEvent(
    aggregateId: string,
    aggregateType: string,
    eventType: string,
    payload: any,
    metadata: Partial<EventMetadata> = {}
  ): DomainEvent {
    return {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      aggregateId,
      aggregateType,
      eventType,
      eventVersion: 0, // Will be set by event store
      payload,
      metadata: {
        timestamp: new Date(),
        source: "trading_system",
        ...metadata,
      },
    };
  }
}

// Global event store instance
export const eventStore = new InMemoryEventStore();

/**
 * Event Store Manager
 *
 * Higher-level interface for event sourcing operations
 */
export class EventStoreManager {
  constructor(private eventStore: InMemoryEventStore = eventStore) {}

  /**
   * Get aggregate by replaying events
   */
  async getAggregate<T>(
    aggregateId: string,
    aggregateFactory: (events: DomainEvent[]) => T
  ): Promise<T | null> {
    const events = await this.eventStore.getEventsForAggregate(aggregateId);

    if (events.length === 0) {
      return null;
    }

    return aggregateFactory(events);
  }

  /**
   * Save aggregate events
   */
  async saveAggregate(
    aggregateId: string,
    expectedVersion: number,
    events: DomainEvent[]
  ): Promise<void> {
    await this.eventStore.appendEvents(aggregateId, expectedVersion, events);
  }

  /**
   * Subscribe to events
   */
  onEvent(eventType: string, handler: (event: DomainEvent) => void): void {
    this.eventStore.on(`event_${eventType}`, handler);
  }

  /**
   * Subscribe to all events
   */
  onAnyEvent(handler: (event: DomainEvent) => void): void {
    this.eventStore.on("event_appended", handler);
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return this.eventStore.getStatistics();
  }

  /**
   * Get events for aggregate
   */
  async getEventsForAggregate(aggregateId: string): Promise<DomainEvent[]> {
    return this.eventStore.getEventsForAggregate(aggregateId);
  }

  /**
   * Replay events for read model rebuilding
   */
  async replayEvents(
    fromTimestamp?: Date,
    eventHandler?: (event: DomainEvent) => Promise<void>
  ): Promise<number> {
    return this.eventStore.replayEvents(fromTimestamp, eventHandler);
  }
}

// Global event store manager
export const eventStoreManager = new EventStoreManager();
