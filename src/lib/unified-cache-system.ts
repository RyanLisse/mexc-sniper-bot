/**
 * Unified Cache System
 * Thin wrapper around the enhanced unified cache for backward compatibility.
 */

import {
  type EnhancedUnifiedCacheSystem,
  unifiedCache,
} from './enhanced-unified-cache';
import { getLogger } from './structured-logger';

export { EnhancedUnifiedCacheSystem } from './enhanced-unified-cache';

export class UnifiedCacheSystem {
  private cache: EnhancedUnifiedCacheSystem = unifiedCache;

  async get<T>(key: string, namespace?: string): Promise<T | null> {
    return this.cache.get<T>(key, namespace);
  }

  async set<T>(
    key: string,
    value: T,
    namespace?: string,
    ttl?: number
  ): Promise<void> {
    await this.cache.set(key, value, namespace, ttl);
  }

  async delete(key: string, namespace?: string): Promise<void> {
    await this.cache.delete(key, namespace);
  }

  async clear(namespace?: string): Promise<void> {
    await this.cache.clear(namespace);
  }

  logStats(): void {
    const metrics = this.cache.getMetrics();
    getLogger().info('Unified cache stats', metrics);
  }
}

const globalUnifiedCache = new UnifiedCacheSystem();

export function getUnifiedCache(): EnhancedUnifiedCacheSystem {
  return globalUnifiedCache;
}

export default globalUnifiedCache;
