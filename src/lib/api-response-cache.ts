/**
 * API Response Cache
 * Minimal implementation for build optimization
 */

export interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  key: string;
}

export interface CacheConfig {
  defaultTtl: number;
  maxSize: number;
  enabled: boolean;
}

export interface CacheMetadata {
  cacheLevel: string;
  timestamp: number;
  freshness: string;
}

export interface CachedResponse {
  data: any;
  metadata: CacheMetadata;
}

export interface CacheGetOptions {
  method?: string;
  acceptStale?: boolean;
  requiredFreshness?: 'strict' | 'moderate' | 'relaxed';
}

export interface CacheSetOptions {
  method?: string;
  ttl?: number;
  responseTime?: number;
}

class ApiResponseCache {
  protected cache: Map<string, CacheEntry> = new Map();
  protected config: CacheConfig = {
    defaultTtl: 5 * 60 * 1000, // 5 minutes
    maxSize: 1000,
    enabled: true,
  };

  setConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Legacy method - kept for backward compatibility
  set(key: string, data: any, ttl?: number): void {
    if (!this.config.enabled) return;

    // Clean up old entries if cache is full
    if (this.cache.size >= this.config.maxSize) {
      this.cleanup();
    }

    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTtl,
      key,
    };

    this.cache.set(key, entry);
  }

  // Legacy method - kept for backward compatibility
  get(key: string): any | null {
    if (!this.config.enabled) return null;

    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    if (!this.config.enabled) return false;

    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): { size: number; maxSize: number; enabled: boolean } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      enabled: this.config.enabled,
    };
  }
}

// Enhanced API Response Cache with middleware-compatible interface
class GlobalApiResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig = {
    defaultTtl: 5 * 60 * 1000, // 5 minutes
    maxSize: 1000,
    enabled: true,
  };

  setConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Generate cache key from endpoint and parameters
  private generateCacheKey(endpoint: string, parameters: Record<string, any>, options: CacheGetOptions | CacheSetOptions = {}): string {
    const paramStr = Object.keys(parameters).length > 0 ? JSON.stringify(parameters) : '';
    const method = options.method || 'GET';
    return `${method}:${endpoint}:${paramStr}`;
  }

  // Enhanced get method for middleware compatibility
  async get(endpoint: string, parameters: Record<string, any> = {}, options: CacheGetOptions = {}): Promise<CachedResponse | null> {
    if (!this.config.enabled) return null;

    const cacheKey = this.generateCacheKey(endpoint, parameters, options);
    const entry = this.cache.get(cacheKey);
    
    if (!entry) return null;

    const now = Date.now();
    const age = now - entry.timestamp;
    
    // Check if entry is expired
    if (age > entry.ttl) {
      this.cache.delete(cacheKey);
      return null;
    }

    // Determine freshness based on age and requirements
    const freshness = this.calculateFreshness(age, entry.ttl, options.requiredFreshness);
    
    // If freshness requirement is strict and data is stale, return null
    if (options.requiredFreshness === 'strict' && age > entry.ttl * 0.5) {
      if (!options.acceptStale) {
        return null;
      }
    }

    return {
      data: entry.data,
      metadata: {
        cacheLevel: 'memory',
        timestamp: entry.timestamp,
        freshness
      }
    };
  }

  // Enhanced set method for middleware compatibility
  async set(endpoint: string, data: any, parameters: Record<string, any> = {}, options: CacheSetOptions = {}): Promise<void> {
    if (!this.config.enabled) return;

    const cacheKey = this.generateCacheKey(endpoint, parameters, options);
    
    // Clean up old entries if cache is full
    if (this.cache.size >= this.config.maxSize && !this.cache.has(cacheKey)) {
      this.cleanup();
    }

    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl: options.ttl || this.config.defaultTtl,
      key: cacheKey,
    };

    this.cache.set(cacheKey, entry);
  }

  private calculateFreshness(age: number, ttl: number, requiredFreshness?: string): string {
    const ratio = age / ttl;
    
    if (ratio < 0.2) return 'fresh';
    if (ratio < 0.5) return 'good';
    if (ratio < 0.8) return 'stale';
    return 'expired';
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): { size: number; maxSize: number; enabled: boolean } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      enabled: this.config.enabled,
    };
  }
}

export const apiResponseCache = new ApiResponseCache();
export const globalAPIResponseCache = new GlobalApiResponseCache();
