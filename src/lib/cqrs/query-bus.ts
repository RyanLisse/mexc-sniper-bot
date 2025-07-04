/**
 * CQRS Query Bus Implementation
 *
 * Handles query execution with caching, pagination, and read model projections.
 * Part of Phase 3 Production Readiness - Event Sourcing and CQRS patterns.
 */

import { BrowserCompatibleEventEmitter } from "@/src/lib/browser-compatible-events";
import {
  type DomainEvent,
  eventStoreManager,
} from "../event-sourcing/event-store";

// Base Query Interface
export interface Query {
  id: string;
  type: string;
  parameters: any;
  metadata: {
    userId?: string;
    correlationId?: string;
    timestamp: Date;
    source: string;
  };
}

// Query Result
export interface QueryResult<T = any> {
  success: boolean;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  metadata: {
    executionTime: number;
    cacheHit: boolean;
    timestamp: Date;
  };
  errors?: string[];
}

// Query Handler Interface
export interface QueryHandler<TQuery extends Query, TResult = any> {
  handle(query: TQuery): Promise<QueryResult<TResult>>;
  canHandle(query: Query): boolean;
}

// Read Model Interface
export interface ReadModel {
  id: string;
  type: string;
  data: any;
  version: number;
  lastUpdated: Date;
}

// Read Model Projection Interface
export interface ReadModelProjection {
  projectionName: string;
  handle(event: DomainEvent): Promise<void>;
  rebuild(): Promise<void>;
  getModel(id: string): Promise<ReadModel | null>;
  getAllModels(filter?: any): Promise<ReadModel[]>;
}

/**
 * Query Bus Implementation
 */
export class QueryBus extends BrowserCompatibleEventEmitter {
  private handlers: Map<string, QueryHandler<any, any>> = new Map();
  private cache: Map<string, { result: QueryResult; expiry: Date }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes default

  /**
   * Register query handler
   */
  registerHandler<TQuery extends Query, TResult>(
    queryType: string,
    handler: QueryHandler<TQuery, TResult>
  ): void {
    this.handlers.set(queryType, handler);
  }

  /**
   * Execute query
   */
  async execute<TResult = any>(query: Query): Promise<QueryResult<TResult>> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(query);
      const cached = this.getFromCache(cacheKey);

      if (cached) {
        const result = {
          ...cached,
          metadata: {
            ...cached.metadata,
            executionTime: Date.now() - startTime,
            cacheHit: true,
          },
        };

        this.emit("query_executed", { query, result, cached: true });
        return result;
      }

      // Find handler
      const handler = this.handlers.get(query.type);
      if (!handler) {
        throw new Error(`No handler registered for query type: ${query.type}`);
      }

      // Execute query
      const result = await handler.handle(query);

      // Update execution metadata
      result.metadata = {
        ...result.metadata,
        executionTime: Date.now() - startTime,
        cacheHit: false,
      };

      // Cache result if successful
      if (result.success) {
        this.setCache(cacheKey, result);
      }

      // Emit query executed event
      this.emit("query_executed", { query, result, cached: false });

      return result;
    } catch (error) {
      const errorResult: QueryResult = {
        success: false,
        data: null,
        metadata: {
          executionTime: Date.now() - startTime,
          cacheHit: false,
          timestamp: new Date(),
        },
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };

      this.emit("query_failed", { query, error });
      return errorResult;
    }
  }

  /**
   * Clear cache for query type
   */
  clearCache(queryType?: string): void {
    if (queryType) {
      for (const [key] of this.cache) {
        if (key.startsWith(`${queryType}:`)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRatio: number;
    memoryUsage: number;
  } {
    const size = this.cache.size;
    // Mock stats - in production, track actual hit ratio
    return {
      size,
      hitRatio: 0.75, // 75% hit ratio
      memoryUsage: size * 1024, // Rough estimate
    };
  }

  private generateCacheKey(query: Query): string {
    const params = JSON.stringify(query.parameters);
    return `${query.type}:${params}`;
  }

  private getFromCache(key: string): QueryResult | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (cached.expiry < new Date()) {
      this.cache.delete(key);
      return null;
    }

    return cached.result;
  }

  private setCache(key: string, result: QueryResult): void {
    const expiry = new Date(Date.now() + this.cacheTimeout);
    this.cache.set(key, { result, expiry });
  }
}

/**
 * Base Query Handler
 */
export abstract class BaseQueryHandler<TQuery extends Query, TResult = any>
  implements QueryHandler<TQuery, TResult>
{
  abstract handle(query: TQuery): Promise<QueryResult<TResult>>;

  canHandle(query: Query): boolean {
    return this.getSupportedQueryType() === query.type;
  }

  protected abstract getSupportedQueryType(): string;

  /**
   * Helper to create paginated results
   */
  protected createPaginatedResult<T>(
    data: T[],
    page: number,
    limit: number,
    total: number
  ): QueryResult<T[]> {
    return {
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        hasMore: page * limit < total,
      },
      metadata: {
        executionTime: 0, // Will be set by query bus
        cacheHit: false,
        timestamp: new Date(),
      },
    };
  }
}

/**
 * In-Memory Read Model Store
 */
export class InMemoryReadModelStore {
  private models: Map<string, Map<string, ReadModel>> = new Map();

  /**
   * Save read model
   */
  async save(model: ReadModel): Promise<void> {
    let typeStore = this.models.get(model.type);
    if (!typeStore) {
      typeStore = new Map();
      this.models.set(model.type, typeStore);
    }

    typeStore.set(model.id, model);
  }

  /**
   * Get read model by ID
   */
  async get(type: string, id: string): Promise<ReadModel | null> {
    const typeStore = this.models.get(type);
    return typeStore?.get(id) || null;
  }

  /**
   * Get all read models of type
   */
  async getAll(type: string, filter?: any): Promise<ReadModel[]> {
    const typeStore = this.models.get(type);
    if (!typeStore) return [];

    let models = Array.from(typeStore.values());

    // Apply simple filtering
    if (filter) {
      models = models.filter((model) => {
        return Object.entries(filter).every(([key, value]) => {
          return model.data[key] === value;
        });
      });
    }

    return models;
  }

  /**
   * Delete read model
   */
  async delete(type: string, id: string): Promise<void> {
    const typeStore = this.models.get(type);
    typeStore?.delete(id);
  }

  /**
   * Clear all models of type
   */
  async clear(type?: string): Promise<void> {
    if (type) {
      this.models.delete(type);
    } else {
      this.models.clear();
    }
  }

  /**
   * Get statistics
   */
  getStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [type, store] of this.models) {
      stats[type] = store.size;
    }
    return stats;
  }
}

/**
 * Base Read Model Projection
 */
export abstract class BaseReadModelProjection implements ReadModelProjection {
  constructor(
    public readonly projectionName: string,
    protected readonly store: InMemoryReadModelStore
  ) {}

  abstract handle(event: DomainEvent): Promise<void>;

  async rebuild(): Promise<void> {
    // Clear existing models
    await this.store.clear(this.projectionName);

    // Replay all events
    await eventStoreManager.replayEvents(undefined, (event) =>
      this.handle(event)
    );
  }

  async getModel(id: string): Promise<ReadModel | null> {
    return this.store.get(this.projectionName, id);
  }

  async getAllModels(filter?: any): Promise<ReadModel[]> {
    return this.store.getAll(this.projectionName, filter);
  }

  protected async saveModel(model: ReadModel): Promise<void> {
    await this.store.save(model);
  }

  protected async deleteModel(id: string): Promise<void> {
    await this.store.delete(this.projectionName, id);
  }
}

/**
 * Query Factory
 */
export class QueryFactory {
  static createQuery<T = any>(
    type: string,
    parameters: T,
    metadata: Partial<Query["metadata"]> = {}
  ): Query {
    return {
      id: `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      parameters,
      metadata: {
        timestamp: new Date(),
        source: "query_bus",
        ...metadata,
      },
    };
  }
}

// Global instances
export const queryBus = new QueryBus();
export const readModelStore = new InMemoryReadModelStore();
