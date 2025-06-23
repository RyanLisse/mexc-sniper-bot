/**
 * Calendar Listings Service Module
 * 
 * Modular service for handling MEXC calendar listings with type safety,
 * Zod validation, caching, and error handling.
 * 
 * Key Features:
 * - Type-safe with Zod schema validation
 * - Efficient caching with TTL
 * - Circuit breaker pattern for reliability
 * - Performance monitoring
 * - Under 500 lines as per requirements
 */

import { z } from 'zod';
import type { MexcServiceResponse } from '../mexc-schemas';
import { instrumentServiceMethod } from '../../lib/opentelemetry-service-instrumentation';
import { toSafeError } from '../../lib/error-type-utils';

// ============================================================================
// Zod Schemas for Type Safety
// ============================================================================

export const CalendarEntrySchema = z.object({
  symbol: z.string().min(1, 'Symbol is required'),
  baseAsset: z.string().min(1, 'Base asset is required'),
  quoteAsset: z.string().min(1, 'Quote asset is required'),
  tradingStartTime: z.number().int().positive('Trading start time must be positive'),
  status: z.enum(['PENDING', 'TRADING', 'BREAK', 'ENDED']),
  priceScale: z.number().int().nonnegative().optional(),
  quantityScale: z.number().int().nonnegative().optional(),
  minNotional: z.string().optional(),
  maxNotional: z.string().optional(),
});

export const CalendarListingsResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(CalendarEntrySchema),
  error: z.string().optional(),
  timestamp: z.number().optional(),
  cached: z.boolean().optional(),
});

export const CalendarFilterSchema = z.object({
  status: z.enum(['PENDING', 'TRADING', 'BREAK', 'ENDED']).optional(),
  baseAsset: z.string().optional(),
  quoteAsset: z.string().optional(),
  fromTime: z.number().int().positive().optional(),
  toTime: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(1000).default(100),
});

// ============================================================================
// Types
// ============================================================================

export type CalendarEntry = z.infer<typeof CalendarEntrySchema>;
export type CalendarListingsResponse = z.infer<typeof CalendarListingsResponseSchema>;
export type CalendarFilter = z.infer<typeof CalendarFilterSchema>;

export interface CalendarListingsConfig {
  apiClient: {
    get: (endpoint: string, params?: Record<string, any>) => Promise<any>;
  };
  cache?: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any, ttl?: number) => Promise<void>;
  };
  circuitBreaker?: {
    execute: <T>(fn: () => Promise<T>) => Promise<T>;
  };
  performanceMonitor?: {
    recordMetric: (name: string, value: number, tags?: Record<string, string>) => void;
  };
  cacheTTL?: number;
}

// ============================================================================
// Service Class
// ============================================================================

export class CalendarListingsService {
  private readonly config: CalendarListingsConfig;
  private readonly cacheTTL: number;
  private readonly cacheKeyPrefix = 'mexc:calendar';

  constructor(config: CalendarListingsConfig) {
    this.config = config;
    this.cacheTTL = config.cacheTTL ?? 30000; // 30 seconds default
  }

  /**
   * Get calendar listings with optional filtering
   */
  @instrumentServiceMethod('calendar-listings', 'getListings')
  async getListings(filter?: CalendarFilter): Promise<CalendarListingsResponse> {
    const startTime = Date.now();
    
    try {
      // Validate input filter
      const validatedFilter = filter ? CalendarFilterSchema.parse(filter) : {};
      
      // Generate cache key
      const cacheKey = this.generateCacheKey(validatedFilter);
      
      // Try cache first
      if (this.config.cache) {
        const cached = await this.getCachedListings(cacheKey);
        if (cached) {
          this.recordMetric('cache_hit', 1, { operation: 'getListings' });
          return cached;
        }
      }

      // Fetch from API
      const response = await this.fetchFromAPI(validatedFilter);
      
      // Cache the result
      if (this.config.cache && response.success) {
        await this.cacheListings(cacheKey, response);
      }

      // Record metrics
      this.recordMetric('response_time', Date.now() - startTime, { operation: 'getListings' });
      this.recordMetric('cache_miss', 1, { operation: 'getListings' });

      return response;
    } catch (error) {
      const safeError = toSafeError(error);
      this.recordMetric('error_count', 1, { operation: 'getListings', error: safeError.name });
      
      return {
        success: false,
        data: [],
        error: safeError.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get active trading pairs from calendar
   */
  @instrumentServiceMethod('calendar-listings', 'getActivePairs')
  async getActivePairs(): Promise<CalendarListingsResponse> {
    return this.getListings({ status: 'TRADING' });
  }

  /**
   * Get upcoming listings
   */
  @instrumentServiceMethod('calendar-listings', 'getUpcomingListings')
  async getUpcomingListings(): Promise<CalendarListingsResponse> {
    const filter: CalendarFilter = {
      status: 'PENDING',
      fromTime: Date.now(),
      limit: 50,
    };
    
    return this.getListings(filter);
  }

  /**
   * Get calendar entry by symbol
   */
  @instrumentServiceMethod('calendar-listings', 'getBySymbol')
  async getBySymbol(symbol: string): Promise<CalendarListingsResponse> {
    if (!symbol || typeof symbol !== 'string') {
      return {
        success: false,
        data: [],
        error: 'Invalid symbol provided',
        timestamp: Date.now(),
      };
    }

    const allListings = await this.getListings();
    if (!allListings.success) {
      return allListings;
    }

    const matchedEntry = allListings.data.find(entry => entry.symbol === symbol.toUpperCase());
    
    return {
      success: true,
      data: matchedEntry ? [matchedEntry] : [],
      timestamp: Date.now(),
    };
  }

  /**
   * Clear calendar cache
   */
  async clearCache(): Promise<void> {
    if (!this.config.cache) return;

    // In a real implementation, you'd want to clear all cache keys with the prefix
    // This is a simplified version
    const keys = [
      this.generateCacheKey({}),
      this.generateCacheKey({ status: 'TRADING' }),
      this.generateCacheKey({ status: 'PENDING' }),
    ];

    await Promise.all(keys.map(key => this.config.cache?.set(key, null, 0)));
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async fetchFromAPI(filter: CalendarFilter): Promise<CalendarListingsResponse> {
    const executeWithCircuitBreaker = this.config.circuitBreaker?.execute ?? ((fn: () => Promise<any>) => fn());

    const rawResponse = await executeWithCircuitBreaker(async () => {
      const params = this.buildAPIParams(filter);
      return this.config.apiClient.get('/api/v3/exchangeInfo', params);
    });

    // Transform and validate the API response
    const transformedData = this.transformAPIResponse(rawResponse);
    
    // Validate with Zod schema
    const validatedData = z.array(CalendarEntrySchema).parse(transformedData);

    return {
      success: true,
      data: validatedData,
      timestamp: Date.now(),
    };
  }

  private async getCachedListings(cacheKey: string): Promise<CalendarListingsResponse | null> {
    if (!this.config.cache) return null;

    try {
      const cached = await this.config.cache.get(cacheKey);
      if (!cached) return null;

      // Validate cached data
      return CalendarListingsResponseSchema.parse(cached);
    } catch (error) {
      // Invalid cached data, ignore and fetch fresh
      return null;
    }
  }

  private async cacheListings(cacheKey: string, response: CalendarListingsResponse): Promise<void> {
    if (!this.config.cache) return;

    const cacheData = {
      ...response,
      cached: true,
    };

    await this.config.cache.set(cacheKey, cacheData, this.cacheTTL);
  }

  private generateCacheKey(filter: CalendarFilter): string {
    const filterString = Object.entries(filter)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join('|');
    
    return `${this.cacheKeyPrefix}:listings:${filterString}`;
  }

  private buildAPIParams(filter: CalendarFilter): Record<string, any> {
    const params: Record<string, any> = {};

    if (filter.limit) {
      params.limit = filter.limit;
    }

    // Add other API-specific parameters as needed
    return params;
  }

  private transformAPIResponse(rawResponse: any): CalendarEntry[] {
    // Transform MEXC API response to our CalendarEntry format
    if (!rawResponse?.symbols || !Array.isArray(rawResponse.symbols)) {
      return [];
    }

    return rawResponse.symbols
      .filter((symbol: any) => symbol.status === 'TRADING')
      .map((symbol: any) => ({
        symbol: symbol.symbol,
        baseAsset: symbol.baseAsset,
        quoteAsset: symbol.quoteAsset,
        tradingStartTime: Date.now(), // API might not provide this
        status: 'TRADING' as const,
        priceScale: symbol.quotePrecision,
        quantityScale: symbol.baseAssetPrecision,
      }));
  }

  private recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    this.config.performanceMonitor?.recordMetric(name, value, {
      service: 'calendar-listings',
      ...tags,
    });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createCalendarListingsService(config: CalendarListingsConfig): CalendarListingsService {
  return new CalendarListingsService(config);
}

// ============================================================================
// Exports
// ============================================================================

export type {
  CalendarListingsConfig,
};