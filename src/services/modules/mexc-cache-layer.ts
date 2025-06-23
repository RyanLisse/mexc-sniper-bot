/**
 * MEXC Cache Management Layer
 * 
 * Intelligent caching system for MEXC API responses with TanStack Query optimization.
 * This module provides advanced caching strategies while staying under 500 lines.
 * 
 * Features:
 * - TanStack Query integration
 * - Smart cache invalidation
 * - Memory-efficient storage
 * - Performance monitoring
 * - TypeScript strict mode
 */

import { z } from 'zod';
import type { MexcServiceResponse } from './mexc-api-types';
import { mexcQueryKeys } from './mexc-api-types';

// ============================================================================
// Cache Configuration Schema
// ============================================================================

export const CacheConfigSchema = z.object({
  defaultTTL: z.number().positive("Default TTL must be positive").default(30000),
  maxEntries: z.number().positive("Max entries must be positive").default(1000),
  enableMetrics: z.boolean().default(true),
  enableAutoCleanup: z.boolean().default(true),
  cleanupInterval: z.number().positive("Cleanup interval must be positive").default(60000),
  enableCompression: z.boolean().default(false),
  enablePersistence: z.boolean().default(false),
});

export type CacheConfig = z.infer<typeof CacheConfigSchema>;

// ============================================================================
// Cache Entry and Metrics Types
// ============================================================================

interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  totalRequests: number;
  memoryUsage: number;
  averageResponseTime: number;
  hitRate: number;
}

// ============================================================================
// Cache Key Management
// ============================================================================

type CacheKeyFactory = typeof mexcQueryKeys;

class CacheKeyManager {
  private readonly keyFactories: CacheKeyFactory;

  constructor() {
    this.keyFactories = mexcQueryKeys;
  }

  /**
   * Generate cache key for calendar data
   */
  calendar(): string {
    return this.keyFactories.calendar().join(':');
  }

  /**
   * Generate cache key for symbols data
   */
  symbols(): string {
    return this.keyFactories.symbols().join(':');
  }

  /**
   * Generate cache key for specific symbol
   */
  symbol(symbol: string): string {
    return this.keyFactories.symbol(symbol).join(':');
  }

  /**
   * Generate cache key for ticker data
   */
  ticker(symbol: string): string {
    return this.keyFactories.ticker(symbol).join(':');
  }

  /**
   * Generate cache key for portfolio data
   */
  portfolio(): string {
    return this.keyFactories.portfolio().join(':');
  }

  /**
   * Generate cache key for server time
   */
  serverTime(): string {
    return this.keyFactories.serverTime().join(':');
  }

  /**
   * Generate cache key for exchange info
   */
  exchangeInfo(): string {
    return this.keyFactories.exchangeInfo().join(':');
  }

  /**
   * Generate custom cache key
   */
  custom(parts: string[]): string {
    return ['mexc', 'custom', ...parts].join(':');
  }
}

// ============================================================================
// Main Cache Manager Class
// ============================================================================

export class MexcCacheLayer {
  private readonly config: Required<CacheConfig>;
  private readonly cache: Map<string, CacheEntry>;
  private readonly keyManager: CacheKeyManager;
  private metrics: CacheMetrics;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: CacheConfig = {}) {
    this.config = CacheConfigSchema.parse(config);
    this.cache = new Map();
    this.keyManager = new CacheKeyManager();
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0,
      memoryUsage: 0,
      averageResponseTime: 0,
      hitRate: 0,
    };

    if (this.config.enableAutoCleanup) {
      this.startCleanupTimer();
    }
  }

  // ============================================================================
  // Core Cache Operations
  // ============================================================================

  /**
   * Get cached value with metrics tracking
   */
  get<T>(key: string): T | null {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    const entry = this.cache.get(key);
    
    if (!entry) {
      this.metrics.misses++;
      this.updateHitRate();
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.metrics.misses++;
      this.updateHitRate();
      return null;
    }

    // Update access metrics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.metrics.hits++;
    
    // Update performance metrics
    const responseTime = Date.now() - startTime;
    this.updateAverageResponseTime(responseTime);
    this.updateHitRate();

    return entry.data as T;
  }

  /**
   * Set cache value with TTL and size tracking
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const entryTTL = ttl || this.config.defaultTTL;
    const size = this.estimateSize(data);
    
    // Check if we need to evict entries
    if (this.cache.size >= this.config.maxEntries) {
      this.evictLeastRecentlyUsed();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: entryTTL,
      accessCount: 0,
      lastAccessed: Date.now(),
      size,
    };

    this.cache.set(key, entry);
    this.updateMemoryUsage();
  }

  /**
   * Delete cache entry
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.updateMemoryUsage();
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.updateMemoryUsage();
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry ? !this.isExpired(entry) : false;
  }

  // ============================================================================
  // High-Level API Methods
  // ============================================================================

  /**
   * Get or set calendar data with intelligent caching
   */
  async getOrSetCalendar<T>(
    fetcher: () => Promise<MexcServiceResponse<T>>,
    ttl?: number
  ): Promise<MexcServiceResponse<T>> {
    const key = this.keyManager.calendar();
    const cached = this.get<MexcServiceResponse<T>>(key);
    
    if (cached) {
      return { ...cached, cached: true };
    }

    const result = await fetcher();
    if (result.success) {
      this.set(key, result, ttl);
    }
    
    return result;
  }

  /**
   * Get or set symbols data with caching
   */
  async getOrSetSymbols<T>(
    fetcher: () => Promise<MexcServiceResponse<T>>,
    ttl?: number
  ): Promise<MexcServiceResponse<T>> {
    const key = this.keyManager.symbols();
    const cached = this.get<MexcServiceResponse<T>>(key);
    
    if (cached) {
      return { ...cached, cached: true };
    }

    const result = await fetcher();
    if (result.success) {
      this.set(key, result, ttl);
    }
    
    return result;
  }

  /**
   * Get or set ticker data with caching
   */
  async getOrSetTicker<T>(
    symbol: string,
    fetcher: () => Promise<MexcServiceResponse<T>>,
    ttl?: number
  ): Promise<MexcServiceResponse<T>> {
    const key = this.keyManager.ticker(symbol);
    const cached = this.get<MexcServiceResponse<T>>(key);
    
    if (cached) {
      return { ...cached, cached: true };
    }

    const result = await fetcher();
    if (result.success) {
      this.set(key, result, ttl || 30000); // Shorter TTL for real-time data
    }
    
    return result;
  }

  // ============================================================================
  // Cache Management Utilities
  // ============================================================================

  private isExpired(entry: CacheEntry): boolean {
    return (Date.now() - entry.timestamp) > entry.ttl;
  }

  private evictLeastRecentlyUsed(): void {
    let oldestKey: string | null = null;
    let oldestTime = Number.MAX_SAFE_INTEGER;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.metrics.evictions++;
    }
  }

  private estimateSize(data: unknown): number {
    try {
      return JSON.stringify(data).length * 2; // Rough estimate in bytes
    } catch {
      return 1000; // Default size estimate
    }
  }

  private updateMemoryUsage(): void {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }
    this.metrics.memoryUsage = totalSize;
  }

  private updateHitRate(): void {
    this.metrics.hitRate = this.metrics.totalRequests > 0 
      ? this.metrics.hits / this.metrics.totalRequests 
      : 0;
  }

  private updateAverageResponseTime(responseTime: number): void {
    if (this.metrics.totalRequests === 1) {
      this.metrics.averageResponseTime = responseTime;
    } else {
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) 
        / this.metrics.totalRequests;
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
      }
    }
    this.updateMemoryUsage();
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Get current cache metrics
   */
  getMetrics(): Readonly<CacheMetrics> {
    return { ...this.metrics };
  }

  /**
   * Get cache configuration
   */
  getConfig(): Readonly<Required<CacheConfig>> {
    return { ...this.config };
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Shutdown cache and cleanup timers
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
  }

  /**
   * Get cache key manager for external use
   */
  getKeyManager(): CacheKeyManager {
    return this.keyManager;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createMexcCacheLayer(config?: CacheConfig): MexcCacheLayer {
  return new MexcCacheLayer(config);
}

let globalCacheLayer: MexcCacheLayer | null = null;

export function getMexcCacheLayer(config?: CacheConfig): MexcCacheLayer {
  if (!globalCacheLayer) {
    globalCacheLayer = new MexcCacheLayer(config);
  }
  return globalCacheLayer;
}

export function resetMexcCacheLayer(): void {
  if (globalCacheLayer) {
    globalCacheLayer.shutdown();
    globalCacheLayer = null;
  }
}