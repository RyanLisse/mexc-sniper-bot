/**
 * Agent Health Cache Manager
 * 
 * Manages caching of agent health status with real-time monitoring capabilities.
 * Provides fast access to agent health metrics with automatic cache invalidation
 * for stale health data.
 * 
 * FEATURES:
 * - Real-time agent health status caching
 * - Automatic stale data invalidation (30 seconds max age)
 * - Health metrics aggregation
 * - Performance monitoring integration
 * - Status classification (healthy, degraded, unhealthy)
 */

import { generateCacheKey, globalCacheManager } from "../cache-manager";
import type {
  AgentCacheConfig,
  AgentHealthCache,
} from "./agent-cache-types";

export class AgentHealthCacheManager {
  private config: AgentCacheConfig;
  private healthCache: Map<string, AgentHealthCache> = new Map();
  private readonly HEALTH_CACHE_TTL = 15000; // 15 seconds TTL for health data
  private readonly STALE_THRESHOLD = 30000; // 30 seconds max age for health data

  constructor(config: AgentCacheConfig) {
    this.config = config;
  }

  /**
   * Get cached agent health status
   */
  async getAgentHealth(agentId: string): Promise<AgentHealthCache | null> {
    if (!this.config.enableHealthCaching) {
      return null;
    }

    const cacheKey = this.generateHealthCacheKey(agentId);

    try {
      const cached = await globalCacheManager.get<AgentHealthCache>(cacheKey);
      if (!cached) {
        return null;
      }

      // Check if health data is fresh enough (max 30 seconds old)
      if (Date.now() - cached.lastCheck < this.STALE_THRESHOLD) {
        return cached;
      }
      // Remove stale health data
      await globalCacheManager.delete(cacheKey);
      this.healthCache.delete(agentId);
      return null;
    } catch (error) {
      console.error(`[AgentHealthCache] Error getting agent health for ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Cache agent health status
   */
  async setAgentHealth(agentId: string, health: AgentHealthCache): Promise<void> {
    if (!this.config.enableHealthCaching) {
      return;
    }

    const cacheKey = this.generateHealthCacheKey(agentId);

    try {
      await globalCacheManager.set(cacheKey, health, {
        type: "health_status",
        ttl: this.HEALTH_CACHE_TTL,
        metadata: {
          type: "health_status",
          source: agentId,
        },
      });

      // Update local health cache
      this.healthCache.set(agentId, health);
    } catch (error) {
      console.error(`[AgentHealthCache] Error caching agent health for ${agentId}:`, error);
    }
  }

  /**
   * Update agent health metrics
   */
  async updateAgentHealth(
    agentId: string,
    metrics: {
      responseTime?: number;
      errorRate?: number;
      cacheHitRate?: number;
      totalRequests?: number;
      successfulRequests?: number;
    }
  ): Promise<void> {
    const existing = await this.getAgentHealth(agentId);
    const now = Date.now();

    const updatedHealth: AgentHealthCache = {
      agentId,
      status: this.calculateHealthStatus(metrics),
      lastCheck: now,
      responseTime: metrics.responseTime ?? existing?.responseTime ?? 0,
      errorRate: metrics.errorRate ?? existing?.errorRate ?? 0,
      cacheHitRate: metrics.cacheHitRate ?? existing?.cacheHitRate ?? 0,
      metadata: {
        uptime: existing?.metadata.uptime ?? now,
        totalRequests: metrics.totalRequests ?? existing?.metadata.totalRequests ?? 0,
        successfulRequests: metrics.successfulRequests ?? existing?.metadata.successfulRequests ?? 0,
        averageResponseTime: this.calculateAverageResponseTime(
          existing?.metadata.averageResponseTime ?? 0,
          metrics.responseTime ?? 0,
          existing?.metadata.totalRequests ?? 0
        ),
      },
    };

    await this.setAgentHealth(agentId, updatedHealth);
  }

  /**
   * Get health status for all cached agents
   */
  async getAllAgentHealth(): Promise<Map<string, AgentHealthCache>> {
    const allHealth = new Map<string, AgentHealthCache>();

    for (const [agentId] of this.healthCache) {
      const health = await this.getAgentHealth(agentId);
      if (health) {
        allHealth.set(agentId, health);
      }
    }

    return allHealth;
  }

  /**
   * Get aggregated health statistics
   */
  async getHealthStatistics(): Promise<{
    totalAgents: number;
    healthyAgents: number;
    degradedAgents: number;
    unhealthyAgents: number;
    averageResponseTime: number;
    overallErrorRate: number;
    systemLoad: number;
  }> {
    const allHealth = await this.getAllAgentHealth();
    const agents = Array.from(allHealth.values());

    const healthyAgents = agents.filter((h) => h.status === "healthy").length;
    const degradedAgents = agents.filter((h) => h.status === "degraded").length;
    const unhealthyAgents = agents.filter((h) => h.status === "unhealthy").length;

    const averageResponseTime = agents.length > 0
      ? agents.reduce((sum, h) => sum + h.responseTime, 0) / agents.length
      : 0;

    const overallErrorRate = agents.length > 0
      ? agents.reduce((sum, h) => sum + h.errorRate, 0) / agents.length
      : 0;

    // Calculate system load based on unhealthy agents ratio
    const systemLoad = agents.length > 0
      ? ((degradedAgents * 0.5 + unhealthyAgents) / agents.length) * 100
      : 0;

    return {
      totalAgents: agents.length,
      healthyAgents,
      degradedAgents,
      unhealthyAgents,
      averageResponseTime,
      overallErrorRate,
      systemLoad,
    };
  }

  /**
   * Remove agent from health cache
   */
  async removeAgentHealth(agentId: string): Promise<void> {
    const cacheKey = this.generateHealthCacheKey(agentId);
    
    try {
      await globalCacheManager.delete(cacheKey);
      this.healthCache.delete(agentId);
    } catch (error) {
      console.error(`[AgentHealthCache] Error removing agent health for ${agentId}:`, error);
    }
  }

  /**
   * Clear all health cache entries
   */
  async clearHealthCache(): Promise<void> {
    try {
      const pattern = /^health:/;
      await globalCacheManager.invalidatePattern(pattern);
      this.healthCache.clear();
      console.log("[AgentHealthCache] Cleared all health cache entries");
    } catch (error) {
      console.error("[AgentHealthCache] Error clearing health cache:", error);
    }
  }

  /**
   * Get health cache size
   */
  getHealthCacheSize(): number {
    return this.healthCache.size;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Generate cache key for health status
   */
  private generateHealthCacheKey(agentId: string): string {
    return generateCacheKey("health", agentId);
  }

  /**
   * Calculate health status based on metrics
   */
  private calculateHealthStatus(metrics: {
    responseTime?: number;
    errorRate?: number;
    cacheHitRate?: number;
  }): "healthy" | "degraded" | "unhealthy" {
    const responseTime = metrics.responseTime ?? 0;
    const errorRate = metrics.errorRate ?? 0;

    // Unhealthy conditions
    if (errorRate > 20 || responseTime > 10000) {
      return "unhealthy";
    }

    // Degraded conditions
    if (errorRate > 5 || responseTime > 5000) {
      return "degraded";
    }

    return "healthy";
  }

  /**
   * Calculate running average response time
   */
  private calculateAverageResponseTime(
    currentAverage: number,
    newResponseTime: number,
    totalRequests: number
  ): number {
    if (totalRequests === 0) {
      return newResponseTime;
    }

    return ((currentAverage * totalRequests) + newResponseTime) / (totalRequests + 1);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AgentCacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}