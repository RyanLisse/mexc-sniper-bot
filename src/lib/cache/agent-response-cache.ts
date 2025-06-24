/**
 * Agent Response Cache
 *
 * Handles caching of individual agent responses with intelligent TTL calculation,
 * performance tracking, and cache invalidation strategies.
 */

import type { AgentResponse } from "../../mexc-agents/base-agent";
import { generateCacheKey, globalCacheManager } from "../cache-manager";
import type {
  AgentCacheConfig,
  CachedAgentResponse,
  CacheInvalidationCriteria,
  CacheKeyOptions,
} from "./agent-cache-types";

export class AgentResponseCache {
  private logger = {
      info: (message: string, context?: any) => console.info('[agent-response-cache]', message, context || ''),
      warn: (message: string, context?: any) => console.warn('[agent-response-cache]', message, context || ''),
      error: (message: string, context?: any, error?: Error) => console.error('[agent-response-cache]', message, context || '', error || ''),
      debug: (message: string, context?: any) => console.debug('[agent-response-cache]', message, context || ''),
    };

  private config: AgentCacheConfig;

  constructor(config: AgentCacheConfig) {
    this.config = config;
  }

  /**
   * Get cached agent response with metadata
   */
  async getAgentResponse(
    agentId: string,
    input: string,
    context?: Record<string, unknown>
  ): Promise<CachedAgentResponse | null> {
    const cacheKey = this.generateAgentCacheKey(agentId, input, context);

    try {
      const cached = await globalCacheManager.get<AgentResponse>(cacheKey);
      if (!cached) {
        return null;
      }

      // Update hit count for this cache entry
      const hitCount = await this.incrementHitCount(cacheKey);

      // Create enhanced response with cache metadata
      const cachedResponse: CachedAgentResponse = {
        ...cached,
        cacheMetadata: {
          cacheKey,
          cacheLevel: "L1", // Will be determined by cache manager
          cacheTimestamp: Date.now(),
          originalTimestamp: cached.metadata.timestamp
            ? new Date(cached.metadata.timestamp).getTime()
            : Date.now(),
          hitCount,
          performanceScore: this.calculatePerformanceScore(cached),
        },
        metadata: {
          ...cached.metadata,
          fromCache: true,
          cached: true,
        },
      };

      return cachedResponse;
    } catch (error) {
      console.error(`[AgentResponseCache] Error getting agent response for ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Cache agent response with intelligent TTL and dependencies
   */
  async setAgentResponse(
    agentId: string,
    input: string,
    response: AgentResponse,
    context?: Record<string, unknown>,
    options: {
      ttl?: number;
      dependencies?: string[];
      priority?: "low" | "medium" | "high";
    } = {}
  ): Promise<void> {
    const { ttl, dependencies = [], priority = "medium" } = options;
    const cacheKey = this.generateAgentCacheKey(agentId, input, context);

    try {
      // Determine TTL based on response confidence and agent type
      const intelligentTTL = ttl || this.calculateIntelligentTTL(response, agentId, priority);

      // Add agent metadata to the response
      const enhancedResponse: AgentResponse = {
        ...response,
        metadata: {
          ...response.metadata,
          cacheKey,
          cachedAt: new Date().toISOString(),
          dependencies,
          agentId,
        },
      };

      // Cache the response
      await globalCacheManager.set(cacheKey, enhancedResponse, {
        type: "agent_response",
        ttl: intelligentTTL,
        metadata: {
          type: "agent_response",
          source: agentId,
          dependencies,
        },
      });

      console.info(
        `[AgentResponseCache] Cached response for ${agentId} with TTL ${intelligentTTL}ms`
      );
    } catch (error) {
      console.error(`[AgentResponseCache] Error caching agent response for ${agentId}:`, error);
    }
  }

  /**
   * Invalidate agent responses based on criteria
   */
  async invalidateAgentResponses(criteria: CacheInvalidationCriteria): Promise<number> {
    try {
      let deletedCount = 0;

      // Get all keys and filter for agent response pattern
      const pattern = criteria.agentId ? `agent:${criteria.agentId}:` : "agent:";
      const allKeys = globalCacheManager.getCacheKeys();
      const keys = allKeys.filter((key) => key.startsWith(pattern));

      for (const key of keys) {
        let shouldDelete = false;

        // Check age-based criteria
        if (criteria.olderThan) {
          const cached = await globalCacheManager.get<AgentResponse>(key);
          if (cached?.metadata?.timestamp) {
            const age = Date.now() - new Date(cached.metadata.timestamp).getTime();
            shouldDelete = age > criteria.olderThan;
          }
        }

        // Check pattern-based criteria
        if (criteria.pattern && !shouldDelete) {
          shouldDelete = key.includes(criteria.pattern);
        }

        // Check tag-based criteria
        if (criteria.tags && criteria.tags.length > 0 && !shouldDelete) {
          const cached = await globalCacheManager.get<AgentResponse>(key);
          if (cached?.metadata?.tags) {
            const hasMatchingTag = criteria.tags.some((tag) => cached.metadata.tags?.includes(tag));
            shouldDelete = hasMatchingTag;
          }
        }

        // Check agent type criteria
        if (criteria.agentType && !shouldDelete) {
          shouldDelete = key.includes(`agent:${criteria.agentType}:`);
        }

        if (shouldDelete) {
          await globalCacheManager.delete(key);
          deletedCount++;
        }
      }

      console.info(`[AgentResponseCache] Invalidated ${deletedCount} agent responses`);
      return deletedCount;
    } catch (error) {
      console.error("[AgentResponseCache] Error invalidating agent responses:", error);
      return 0;
    }
  }

  /**
   * Batch get multiple agent responses
   */
  async getMultipleAgentResponses(
    requests: Array<{
      agentId: string;
      input: string;
      context?: Record<string, unknown>;
    }>
  ): Promise<Map<string, CachedAgentResponse | null>> {
    const results = new Map<string, CachedAgentResponse | null>();

    const promises = requests.map(async (req) => {
      const key = `${req.agentId}:${req.input}`;
      const response = await this.getAgentResponse(req.agentId, req.input, req.context);
      results.set(key, response);
      return { key, response };
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Get cache statistics for specific agent
   */
  async getAgentCacheStats(agentId: string): Promise<{
    totalKeys: number;
    hitRate: number;
    totalSize: number;
    oldestEntry: number;
    newestEntry: number;
  }> {
    try {
      const pattern = `agent:${agentId}:*`;
      const keys = await globalCacheManager.getKeys(pattern);

      let totalSize = 0;
      let oldestEntry = Date.now();
      let newestEntry = 0;

      for (const key of keys) {
        const cached = await globalCacheManager.get<AgentResponse>(key);
        if (cached) {
          totalSize += JSON.stringify(cached).length;

          const timestamp = cached.metadata?.timestamp
            ? new Date(cached.metadata.timestamp).getTime()
            : Date.now();

          oldestEntry = Math.min(oldestEntry, timestamp);
          newestEntry = Math.max(newestEntry, timestamp);
        }
      }

      return {
        totalKeys: keys.length,
        hitRate: 0, // Will be calculated by performance tracking
        totalSize,
        oldestEntry: oldestEntry === Date.now() ? 0 : oldestEntry,
        newestEntry,
      };
    } catch (error) {
      console.error(`[AgentResponseCache] Error getting cache stats for ${agentId}:`, error);
      return {
        totalKeys: 0,
        hitRate: 0,
        totalSize: 0,
        oldestEntry: 0,
        newestEntry: 0,
      };
    }
  }

  /**
   * Generate cache key for agent response
   */
  generateAgentCacheKey(agentId: string, input: string, context?: Record<string, unknown>): string {
    const contextHash = context ? generateCacheKey(JSON.stringify(context)) : "";
    const inputHash = generateCacheKey(input);
    return `agent:${agentId}:${inputHash}${contextHash ? `:${contextHash}` : ""}`;
  }

  /**
   * Calculate intelligent TTL based on response characteristics
   */
  private calculateIntelligentTTL(
    response: AgentResponse,
    agentId: string,
    priority: "low" | "medium" | "high" = "medium"
  ): number {
    const baseTTL = this.config.defaultTTL;
    let multiplier = 1;

    // Adjust TTL based on response confidence
    if (response.confidence !== undefined) {
      if (response.confidence > 0.9) {
        multiplier *= 2; // High confidence responses cached longer
      } else if (response.confidence < 0.5) {
        multiplier *= 0.5; // Low confidence responses cached shorter
      }
    }

    // Adjust TTL based on response success
    if (!response.success) {
      multiplier *= 0.25; // Error responses cached for short time
    }

    // Adjust TTL based on priority
    switch (priority) {
      case "high":
        multiplier *= 1.5;
        break;
      case "low":
        multiplier *= 0.75;
        break;
      default:
        // medium priority uses base multiplier
        break;
    }

    // Agent-specific adjustments
    if (agentId.includes("critical") || agentId.includes("emergency")) {
      multiplier *= 0.5; // Critical agents need fresh data
    } else if (agentId.includes("cache") || agentId.includes("static")) {
      multiplier *= 3; // Cache-friendly agents can be cached longer
    }

    // Ensure minimum and maximum TTL bounds
    const finalTTL = Math.max(1000, Math.min(baseTTL * multiplier, 3600000)); // 1s to 1hr

    return Math.round(finalTTL);
  }

  /**
   * Calculate performance score for cached response
   */
  private calculatePerformanceScore(response: AgentResponse): number {
    let score = 0.5; // Base score

    // Factor in confidence
    if (response.confidence !== undefined) {
      score += (response.confidence - 0.5) * 0.3;
    }

    // Factor in success
    if (response.success) {
      score += 0.2;
    }

    // Factor in response time (if available)
    if (response.metadata?.responseTime) {
      const responseTime =
        typeof response.metadata.responseTime === "number" ? response.metadata.responseTime : 0;

      if (responseTime < 1000) {
        score += 0.1; // Fast responses get bonus
      } else if (responseTime > 5000) {
        score -= 0.1; // Slow responses get penalty
      }
    }

    // Ensure score is between 0 and 1
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Increment hit count for cache entry
   */
  private async incrementHitCount(cacheKey: string): Promise<number> {
    try {
      const hitCountKey = `${cacheKey}:hits`;
      const currentHits = (await globalCacheManager.get<number>(hitCountKey)) || 0;
      const newHits = currentHits + 1;

      await globalCacheManager.set(hitCountKey, newHits, {
        type: "counter",
        ttl: 86400000, // 24 hours
      });

      return newHits;
    } catch (error) {
      console.error(`[AgentResponseCache] Error incrementing hit count for ${cacheKey}:`, error);
      return 1;
    }
  }

  /**
   * Clear all cached responses for an agent
   */
  async clearAgentCache(agentId: string): Promise<number> {
    try {
      const pattern = `agent:${agentId}:*`;
      const keys = await globalCacheManager.getKeys(pattern);

      let deletedCount = 0;
      for (const key of keys) {
        await globalCacheManager.delete(key);
        deletedCount++;
      }

      console.info(`[AgentResponseCache] Cleared ${deletedCount} entries for agent ${agentId}`);
      return deletedCount;
    } catch (error) {
      console.error(`[AgentResponseCache] Error clearing cache for agent ${agentId}:`, error);
      return 0;
    }
  }

  /**
   * Get configuration
   */
  getConfig(): AgentCacheConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AgentCacheConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}
