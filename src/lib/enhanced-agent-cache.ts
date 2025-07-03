/**
 * Enhanced Agent Cache
 * Minimal implementation for build optimization
 */

export interface AgentCacheEntry {
  agentId: string;
  data: any;
  timestamp: number;
  ttl: number;
  lastAccessed: number;
  accessCount: number;
}

export interface AgentCacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
}

class EnhancedAgentCache {
  private cache: Map<string, AgentCacheEntry> = new Map();
  private stats = {
    hits: 0,
    misses: 0
  };
  private defaultTtl = 10 * 60 * 1000; // 10 minutes
  private maxSize = 500;

  set(key: string, data: any, agentId: string, ttl?: number): void {
    // Cleanup if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLeastRecentlyUsed();
    }

    const entry: AgentCacheEntry = {
      agentId,
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTtl,
      lastAccessed: Date.now(),
      accessCount: 0
    };

    this.cache.set(key, entry);
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access stats
    entry.lastAccessed = Date.now();
    entry.accessCount++;
    this.stats.hits++;

    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clearAgentCache(agentId: string): void {
    for (const [key, entry] of this.cache) {
      if (entry.agentId === agentId) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  getStats(): AgentCacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      totalEntries: this.cache.size,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
      missRate: total > 0 ? (this.stats.misses / total) * 100 : 0,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses
    };
  }

  getAgentEntries(agentId: string): string[] {
    const keys: string[] = [];
    for (const [key, entry] of this.cache) {
      if (entry.agentId === agentId) {
        keys.push(key);
      }
    }
    return keys;
  }

  private evictLeastRecentlyUsed(): void {
    let lruKey: string | undefined;
    let oldestAccess = Number.MAX_SAFE_INTEGER;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }
  }

  setMaxSize(size: number): void {
    this.maxSize = size;
  }

  setDefaultTtl(ttl: number): void {
    this.defaultTtl = ttl;
  }
}

export const enhancedAgentCache = new EnhancedAgentCache();

// Export alias for compatibility
export const globalEnhancedAgentCache = enhancedAgentCache;

// Initialize agent cache function
export function initializeAgentCache(config?: {
  maxSize?: number;
  defaultTtl?: number;
}): EnhancedAgentCache {
  if (config?.maxSize) {
    enhancedAgentCache.setMaxSize(config.maxSize);
  }
  if (config?.defaultTtl) {
    enhancedAgentCache.setDefaultTtl(config.defaultTtl);
  }
  return enhancedAgentCache;
}