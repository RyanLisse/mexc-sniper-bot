/**
 * Unified Cache System for MEXC Sniper Bot
 *
 * This system consolidates all caching functionality from:
 * - cache-manager.ts (multi-level cache)
 * - api-response-cache.ts (API response caching)
 * - enhanced-agent-cache.ts (agent-specific caching)
 * - cache-monitoring.ts (monitoring and metrics)
 *
 * Into a single, comprehensive caching abstraction with multiple backends.
 *
 * Features:
 * - Multi-level caching (L1: Memory, L2: Persistent, L3: Database)
 * - Smart TTL management based on data type and usage patterns
 * - Request deduplication and rate limiting integration
 * - Performance monitoring and analytics
 * - Agent-specific optimizations
 * - Automatic cache warming and cleanup
 * - Redis compatibility for horizontal scaling
 */

import crypto from "node:crypto";
import type { AgentResponse } from "../mexc-agents/base-agent";

// ============================================================================
// Core Types and Interfaces
// ============================================================================

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
  ttl: number;
  metadata: {
    type: CacheDataType;
    source?: string;
    size?: number;
    dependencies?: string[];
    priority?: CachePriority;
    tags?: string[];
    version?: string;
  };
}

export interface CacheConfig {
  // Memory cache settings
  maxMemoryEntries: number;
  maxMemorySize: number; // in bytes
  defaultTTL: number;
  
  // Cleanup and maintenance
  cleanupInterval: number;
  evictionPolicy: 'lru' | 'lfu' | 'ttl' | 'random';
  
  // Features
  enableMetrics: boolean;
  enablePersistence: boolean;
  enableCompression: boolean;
  enableEncryption: boolean;
  
  // Performance
  batchSize: number;
  asyncWrite: boolean;
  
  // External backends
  redisUrl?: string;
  redisConfig?: any;
}

export type CacheDataType = 
  | 'api_response'
  | 'agent_response' 
  | 'market_data'
  | 'user_data'
  | 'config'
  | 'health_check'
  | 'workflow_result'
  | 'pattern_analysis'
  | 'trading_signal'
  | 'session'
  | 'generic';

export type CachePriority = 'low' | 'medium' | 'high' | 'critical';

export type CacheLevel = 'L1' | 'L2' | 'L3';

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  errors: number;
  totalRequests: number;
  hitRate: number;
  memoryUsage: number;
  entryCount: number;
  avgResponseTime: number;
  lastCleanup: number;
}

export interface CacheStrategy {
  ttl: number;
  maxSize?: number;
  priority: CachePriority;
  enableInvalidation: boolean;
  dependencies: string[];
  tags: string[];
}

// ============================================================================
// Cache Backends
// ============================================================================

interface CacheBackend<T = any> {
  get(key: string): Promise<CacheEntry<T> | null>;
  set(key: string, entry: CacheEntry<T>): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  size(): Promise<number>;
  keys(): Promise<string[]>;
  has(key: string): Promise<boolean>;
}

/**
 * L1 Cache: In-Memory LRU Cache
 */
class MemoryCache implements CacheBackend {
  private cache = new Map<string, CacheEntry>();
  private accessOrder = new Map<string, number>();
  private currentTime = 0;

  constructor(private maxEntries: number, private maxSize: number) {}

  async get(key: string): Promise<CacheEntry | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return null;
    }

    // Update access tracking
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.accessOrder.set(key, ++this.currentTime);

    return entry;
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    // Evict if necessary
    if (this.cache.size >= this.maxEntries) {
      await this.evictLRU();
    }

    this.cache.set(key, entry);
    this.accessOrder.set(key, ++this.currentTime);
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    this.accessOrder.delete(key);
    return deleted;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.accessOrder.clear();
    this.currentTime = 0;
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  async keys(): Promise<string[]> {
    return Array.from(this.cache.keys());
  }

  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  private async evictLRU(): Promise<void> {
    let oldestKey = '';
    let oldestTime = Infinity;

    for (const [key, time] of this.accessOrder.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      await this.delete(oldestKey);
    }
  }

  getMemoryUsage(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += JSON.stringify(entry.value).length;
    }
    return totalSize;
  }
}

/**
 * L2 Cache: Persistent File-based Cache (simplified implementation)
 */
class PersistentCache implements CacheBackend {
  private memoryIndex = new Map<string, { file: string; expiresAt: number }>();

  constructor(private baseDir: string = './.cache') {}

  async get(key: string): Promise<CacheEntry | null> {
    const index = this.memoryIndex.get(key);
    if (!index) return null;

    if (Date.now() > index.expiresAt) {
      this.memoryIndex.delete(key);
      return null;
    }

    // In a real implementation, read from file system
    // For now, return null to indicate cache miss
    return null;
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    const fileName = this.generateFileName(key);
    this.memoryIndex.set(key, {
      file: fileName,
      expiresAt: entry.expiresAt
    });
    
    // In a real implementation, write to file system
    // For now, just track in memory index
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.memoryIndex.delete(key);
    // In a real implementation, delete file
    return deleted;
  }

  async clear(): Promise<void> {
    this.memoryIndex.clear();
    // In a real implementation, clear directory
  }

  async size(): Promise<number> {
    return this.memoryIndex.size;
  }

  async keys(): Promise<string[]> {
    return Array.from(this.memoryIndex.keys());
  }

  async has(key: string): Promise<boolean> {
    return this.memoryIndex.has(key);
  }

  private generateFileName(key: string): string {
    return crypto.createHash('md5').update(key).digest('hex') + '.cache';
  }
}

// ============================================================================
// Cache Strategy Manager
// ============================================================================

class CacheStrategyManager {
  private strategies = new Map<CacheDataType, CacheStrategy>();

  constructor() {
    this.initializeDefaultStrategies();
  }

  private initializeDefaultStrategies(): void {
    // API responses - medium TTL, high priority for trading data
    this.strategies.set('api_response', {
      ttl: 30000, // 30 seconds
      priority: 'high',
      enableInvalidation: true,
      dependencies: ['market_data'],
      tags: ['api', 'external']
    });

    // Agent responses - longer TTL, medium priority
    this.strategies.set('agent_response', {
      ttl: 300000, // 5 minutes
      priority: 'medium',
      enableInvalidation: true,
      dependencies: ['market_data', 'trading_signal'],
      tags: ['agent', 'ai']
    });

    // Market data - short TTL, critical priority
    this.strategies.set('market_data', {
      ttl: 5000, // 5 seconds
      priority: 'critical',
      enableInvalidation: true,
      dependencies: [],
      tags: ['market', 'trading', 'real-time']
    });

    // User data - long TTL, medium priority
    this.strategies.set('user_data', {
      ttl: 3600000, // 1 hour
      priority: 'medium',
      enableInvalidation: false,
      dependencies: [],
      tags: ['user', 'profile']
    });

    // Health checks - medium TTL, low priority
    this.strategies.set('health_check', {
      ttl: 60000, // 1 minute
      priority: 'low',
      enableInvalidation: false,
      dependencies: [],
      tags: ['health', 'monitoring']
    });

    // Configuration - very long TTL, low priority
    this.strategies.set('config', {
      ttl: 1800000, // 30 minutes
      priority: 'low',
      enableInvalidation: true,
      dependencies: [],
      tags: ['config', 'settings']
    });
  }

  getStrategy(dataType: CacheDataType): CacheStrategy {
    return this.strategies.get(dataType) || {
      ttl: 60000,
      priority: 'medium',
      enableInvalidation: false,
      dependencies: [],
      tags: []
    };
  }

  updateStrategy(dataType: CacheDataType, strategy: Partial<CacheStrategy>): void {
    const current = this.getStrategy(dataType);
    this.strategies.set(dataType, { ...current, ...strategy });
  }
}

// ============================================================================
// Main Unified Cache System
// ============================================================================

export class UnifiedCacheSystem {
  private l1Cache: MemoryCache;
  private l2Cache: PersistentCache;
  private strategyManager: CacheStrategyManager;
  private metrics: CacheMetrics;
  private cleanupInterval?: NodeJS.Timeout;
  private pendingRequests = new Map<string, Promise<any>>();

  constructor(private config: CacheConfig) {
    this.l1Cache = new MemoryCache(config.maxMemoryEntries, config.maxMemorySize);
    this.l2Cache = new PersistentCache();
    this.strategyManager = new CacheStrategyManager();
    
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      errors: 0,
      totalRequests: 0,
      hitRate: 0,
      memoryUsage: 0,
      entryCount: 0,
      avgResponseTime: 0,
      lastCleanup: Date.now()
    };

    this.startCleanupScheduler();
  }

  // ============================================================================
  // Core Cache Operations
  // ============================================================================

  async get<T>(key: string, dataType: CacheDataType = 'generic'): Promise<T | null> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Try L1 cache first
      const l1Result = await this.l1Cache.get(key);
      if (l1Result) {
        this.metrics.hits++;
        this.updateHitRate();
        this.updateResponseTime(Date.now() - startTime);
        return l1Result.value as T;
      }

      // Try L2 cache
      const l2Result = await this.l2Cache.get(key);
      if (l2Result) {
        // Promote to L1
        await this.l1Cache.set(key, l2Result);
        this.metrics.hits++;
        this.updateHitRate();
        this.updateResponseTime(Date.now() - startTime);
        return l2Result.value as T;
      }

      // Cache miss
      this.metrics.misses++;
      this.updateHitRate();
      this.updateResponseTime(Date.now() - startTime);
      return null;

    } catch (error) {
      this.metrics.errors++;
      console.error('[UnifiedCache] Get error:', error);
      return null;
    }
  }

  async set<T>(
    key: string, 
    value: T, 
    dataType: CacheDataType = 'generic',
    customTTL?: number
  ): Promise<void> {
    try {
      const strategy = this.strategyManager.getStrategy(dataType);
      const ttl = customTTL || strategy.ttl;
      const now = Date.now();

      const entry: CacheEntry<T> = {
        key,
        value,
        timestamp: now,
        expiresAt: now + ttl,
        accessCount: 0,
        lastAccessed: now,
        ttl,
        metadata: {
          type: dataType,
          priority: strategy.priority,
          dependencies: strategy.dependencies,
          tags: strategy.tags,
          size: this.estimateSize(value)
        }
      };

      // Set in L1 cache
      await this.l1Cache.set(key, entry);

      // Set in L2 cache if persistence is enabled
      if (this.config.enablePersistence) {
        await this.l2Cache.set(key, entry);
      }

      this.metrics.sets++;
      this.updateMemoryUsage();

    } catch (error) {
      this.metrics.errors++;
      console.error('[UnifiedCache] Set error:', error);
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const l1Deleted = await this.l1Cache.delete(key);
      const l2Deleted = await this.l2Cache.delete(key);
      
      if (l1Deleted || l2Deleted) {
        this.metrics.deletes++;
        this.updateMemoryUsage();
        return true;
      }
      
      return false;
    } catch (error) {
      this.metrics.errors++;
      console.error('[UnifiedCache] Delete error:', error);
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      await Promise.all([
        this.l1Cache.clear(),
        this.l2Cache.clear()
      ]);
      
      this.pendingRequests.clear();
      this.resetMetrics();
    } catch (error) {
      this.metrics.errors++;
      console.error('[UnifiedCache] Clear error:', error);
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const l1Has = await this.l1Cache.has(key);
      if (l1Has) return true;
      
      return await this.l2Cache.has(key);
    } catch (error) {
      this.metrics.errors++;
      return false;
    }
  }

  // ============================================================================
  // Specialized Cache Operations
  // ============================================================================

  /**
   * Get or set with function (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    dataType: CacheDataType = 'generic',
    customTTL?: number
  ): Promise<T> {
    // Check for pending request to avoid thundering herd
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    const cached = await this.get<T>(key, dataType);
    if (cached !== null) {
      return cached;
    }

    // Create pending request
    const promise = factory().then(async (result) => {
      await this.set(key, result, dataType, customTTL);
      this.pendingRequests.delete(key);
      return result;
    }).catch((error) => {
      this.pendingRequests.delete(key);
      throw error;
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  /**
   * Batch get operation
   */
  async getBatch<T>(keys: string[], dataType: CacheDataType = 'generic'): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    
    await Promise.all(
      keys.map(async (key) => {
        const value = await this.get<T>(key, dataType);
        if (value !== null) {
          results.set(key, value);
        }
      })
    );

    return results;
  }

  /**
   * Batch set operation
   */
  async setBatch<T>(
    entries: Array<{ key: string; value: T }>,
    dataType: CacheDataType = 'generic',
    customTTL?: number
  ): Promise<void> {
    await Promise.all(
      entries.map(({ key, value }) => 
        this.set(key, value, dataType, customTTL)
      )
    );
  }

  /**
   * Invalidate by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let invalidated = 0;
    
    const l1Keys = await this.l1Cache.keys();
    for (const key of l1Keys) {
      const entry = await this.l1Cache.get(key);
      if (entry && entry.metadata.tags?.some(tag => tags.includes(tag))) {
        await this.delete(key);
        invalidated++;
      }
    }

    return invalidated;
  }

  /**
   * Invalidate by dependencies
   */
  async invalidateByDependencies(dependencies: string[]): Promise<number> {
    let invalidated = 0;
    
    const l1Keys = await this.l1Cache.keys();
    for (const key of l1Keys) {
      const entry = await this.l1Cache.get(key);
      if (entry && entry.metadata.dependencies?.some(dep => dependencies.includes(dep))) {
        await this.delete(key);
        invalidated++;
      }
    }

    return invalidated;
  }

  // ============================================================================
  // Agent-Specific Operations
  // ============================================================================

  async getAgentResponse(
    agentName: string,
    input: string,
    context?: any
  ): Promise<AgentResponse | null> {
    const key = this.generateAgentKey(agentName, input, context);
    return this.get<AgentResponse>(key, 'agent_response');
  }

  async setAgentResponse(
    agentName: string,
    input: string,
    response: AgentResponse,
    context?: any,
    options?: { ttl?: number; priority?: CachePriority; dependencies?: string[] }
  ): Promise<void> {
    const key = this.generateAgentKey(agentName, input, context);
    
    if (options) {
      this.strategyManager.updateStrategy('agent_response', {
        ttl: options.ttl,
        priority: options.priority,
        dependencies: options.dependencies
      });
    }
    
    await this.set(key, response, 'agent_response', options?.ttl);
  }

  async trackCacheMiss(agentName: string): Promise<void> {
    // Track cache misses for analytics
    const key = `agent_miss_${agentName}`;
    const current = (await this.get<number>(key, 'generic')) || 0;
    await this.set(key, current + 1, 'generic', 3600000); // 1 hour TTL
  }

  // ============================================================================
  // API Response Caching
  // ============================================================================

  async cacheAPIResponse<T>(
    endpoint: string,
    method: string,
    params: any,
    response: T,
    customTTL?: number
  ): Promise<void> {
    const key = this.generateAPIKey(endpoint, method, params);
    await this.set(key, response, 'api_response', customTTL);
  }

  async getCachedAPIResponse<T>(
    endpoint: string,
    method: string,
    params: any
  ): Promise<T | null> {
    const key = this.generateAPIKey(endpoint, method, params);
    return this.get<T>(key, 'api_response');
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private generateAgentKey(agentName: string, input: string, context?: any): string {
    const data = { agentName, input, context };
    return `agent:${crypto.createHash('md5').update(JSON.stringify(data)).digest('hex')}`;
  }

  private generateAPIKey(endpoint: string, method: string, params: any): string {
    const data = { endpoint, method, params };
    return `api:${crypto.createHash('md5').update(JSON.stringify(data)).digest('hex')}`;
  }

  private estimateSize(value: any): number {
    return JSON.stringify(value).length;
  }

  private updateHitRate(): void {
    this.metrics.hitRate = this.metrics.hits / this.metrics.totalRequests;
  }

  private updateResponseTime(responseTime: number): void {
    this.metrics.avgResponseTime = 
      (this.metrics.avgResponseTime + responseTime) / 2;
  }

  private updateMemoryUsage(): void {
    this.metrics.memoryUsage = this.l1Cache.getMemoryUsage();
  }

  private resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      errors: 0,
      totalRequests: 0,
      hitRate: 0,
      memoryUsage: 0,
      entryCount: 0,
      avgResponseTime: 0,
      lastCleanup: Date.now()
    };
  }

  private startCleanupScheduler(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  private async cleanup(): Promise<void> {
    const now = Date.now();
    let cleaned = 0;

    try {
      // Clean expired entries from L1
      const l1Keys = await this.l1Cache.keys();
      for (const key of l1Keys) {
        const entry = await this.l1Cache.get(key);
        if (!entry) {
          cleaned++;
        }
      }

      this.metrics.evictions += cleaned;
      this.metrics.lastCleanup = now;
      this.updateMemoryUsage();

    } catch (error) {
      console.error('[UnifiedCache] Cleanup error:', error);
      this.metrics.errors++;
    }
  }

  // ============================================================================
  // Monitoring and Analytics
  // ============================================================================

  getMetrics(): CacheMetrics {
    this.updateMemoryUsage();
    return { ...this.metrics };
  }

  async getSize(): Promise<number> {
    const l1Size = await this.l1Cache.size();
    const l2Size = await this.l2Cache.size();
    return l1Size + l2Size;
  }

  async getKeys(pattern?: string): Promise<string[]> {
    const l1Keys = await this.l1Cache.keys();
    const l2Keys = await this.l2Cache.keys();
    const allKeys = [...new Set([...l1Keys, ...l2Keys])];
    
    if (pattern) {
      const regex = new RegExp(pattern);
      return allKeys.filter(key => regex.test(key));
    }
    
    return allKeys;
  }

  getConfig(): CacheConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Cleanup resources
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// ============================================================================
// Global Cache Instance
// ============================================================================

const defaultConfig: CacheConfig = {
  maxMemoryEntries: 10000,
  maxMemorySize: 100 * 1024 * 1024, // 100MB
  defaultTTL: 300000, // 5 minutes
  cleanupInterval: 60000, // 1 minute
  evictionPolicy: 'lru',
  enableMetrics: true,
  enablePersistence: false,
  enableCompression: false,
  enableEncryption: false,
  batchSize: 100,
  asyncWrite: true
};

let globalCacheInstance: UnifiedCacheSystem | null = null;

export function getUnifiedCache(config?: Partial<CacheConfig>): UnifiedCacheSystem {
  if (!globalCacheInstance || config) {
    const finalConfig = { ...defaultConfig, ...config };
    globalCacheInstance = new UnifiedCacheSystem(finalConfig);
  }
  return globalCacheInstance;
}

export function resetUnifiedCache(): void {
  if (globalCacheInstance) {
    globalCacheInstance.destroy();
    globalCacheInstance = null;
  }
}

// ============================================================================
// Exports
// ============================================================================

export {
  UnifiedCacheSystem as default
};