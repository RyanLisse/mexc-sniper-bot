/**
 * Cache Helper Utilities
 *
 * Common utility functions and helpers used across the cache system.
 * Provides key generation, TTL calculation, validation, and other shared functionality.
 *
 * FEATURES:
 * - Cache key generation utilities
 * - TTL calculation algorithms
 * - Cache validation helpers
 * - Performance scoring utilities
 * - Error handling helpers
 */

import type { AgentResponse } from "@/src/mexc-agents/base-agent";
import { generateCacheKey } from "../cache-manager";
import type {
  AgentCacheConfig,
  CacheInvalidationCriteria,
  WorkflowCacheEntry,
} from "./agent-cache-types";

export class CacheHelpers {
  private config: AgentCacheConfig;

  constructor(config: AgentCacheConfig) {
    this.config = config;
  }

  /**
   * Generate cache key for agent responses
   */
  generateAgentCacheKey(agentId: string, input: string, context?: Record<string, unknown>): string {
    return generateCacheKey("agent", agentId, input, context || {});
  }

  /**
   * Generate cache key for workflow results
   */
  generateWorkflowCacheKey(workflowType: string, parameters: Record<string, unknown>): string {
    return generateCacheKey("workflow", workflowType, parameters);
  }

  /**
   * Generate cache key for agent health status
   */
  generateHealthCacheKey(agentId: string): string {
    return generateCacheKey("health", agentId);
  }

  /**
   * Generate pattern key for cache warming
   */
  generatePatternKey(agentId: string, input: string): string {
    return `${agentId}:${input.substring(0, 50)}`;
  }

  /**
   * Calculate intelligent TTL based on response characteristics
   */
  calculateIntelligentTTL(
    response: AgentResponse,
    agentId: string,
    priority: "low" | "medium" | "high" = "medium"
  ): number {
    let baseTTL = this.config.defaultTTL;

    // Adjust TTL based on response confidence
    if (response.metadata.confidence) {
      const confidence = Number(response.metadata.confidence);
      if (confidence > 80) {
        baseTTL *= 2; // High confidence responses last longer
      } else if (confidence < 50) {
        baseTTL *= 0.5; // Low confidence responses expire faster
      }
    }

    // Adjust TTL based on priority
    switch (priority) {
      case "high":
        baseTTL *= 3;
        break;
      case "low":
        baseTTL *= 0.5;
        break;
      // medium stays as is
    }

    // Agent-specific adjustments
    if (agentId.includes("pattern") || agentId.includes("analysis")) {
      baseTTL *= 1.5; // Analysis results last longer
    }

    // Time-sensitive agent adjustments
    if (agentId.includes("market") || agentId.includes("price")) {
      baseTTL *= 0.3; // Market data expires faster
    }

    return Math.min(baseTTL, 30 * 60 * 1000); // Max 30 minutes
  }

  /**
   * Calculate TTL for workflow cache entries
   */
  calculateWorkflowTTL(result: WorkflowCacheEntry): number {
    let baseTTL = 10 * 60 * 1000; // 10 minutes base

    // Adjust based on workflow success
    if (!result.metadata.success) {
      baseTTL *= 0.1; // Failed workflows expire quickly
    }

    // Adjust based on confidence
    if (result.metadata.confidence > 80) {
      baseTTL *= 2;
    } else if (result.metadata.confidence < 50) {
      baseTTL *= 0.5;
    }

    // Adjust based on error count
    if (result.metadata.errorCount > 0) {
      baseTTL *= Math.max(0.3, 1 - result.metadata.errorCount * 0.1);
    }

    // Adjust based on handoff count (more handoffs = more complex = longer cache)
    if (result.metadata.handoffCount > 3) {
      baseTTL *= 1.5;
    }

    // Adjust based on execution time (longer executions = longer cache)
    if (result.executionTime > 10000) {
      // 10 seconds
      baseTTL *= 1.8;
    }

    return Math.min(baseTTL, 45 * 60 * 1000); // Max 45 minutes
  }

  /**
   * Calculate performance score for agent responses
   */
  calculatePerformanceScore(response: AgentResponse): number {
    let score = 70; // Base score

    // Add points for confidence
    if (response.metadata.confidence) {
      score += Number(response.metadata.confidence) * 0.3;
    }

    // Add points for token efficiency
    if (response.metadata.tokensUsed) {
      const tokenEfficiency = Math.max(0, 100 - Number(response.metadata.tokensUsed) / 50);
      score += tokenEfficiency * 0.1;
    }

    // Add points for execution time
    if (response.metadata.executionTimeMs) {
      const timeEfficiency = Math.max(0, 100 - Number(response.metadata.executionTimeMs) / 100);
      score += timeEfficiency * 0.2;
    }

    // Deduct points for errors
    if (response.metadata.error) {
      score -= 20;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Validate workflow cache entry
   */
  isWorkflowCacheValid(entry: WorkflowCacheEntry): boolean {
    // Check if workflow cache entry is still valid
    const maxAge = 15 * 60 * 1000; // 15 minutes max age
    const age = Date.now() - entry.timestamp;

    // Must be recent and successful
    if (age >= maxAge || !entry.metadata.success) {
      return false;
    }

    // Additional validation: check if confidence is acceptable
    if (entry.metadata.confidence < 30) {
      return false;
    }

    // Check if too many errors occurred
    if (entry.metadata.errorCount > 3) {
      return false;
    }

    return true;
  }

  /**
   * Validate cache invalidation criteria
   */
  validateInvalidationCriteria(criteria: CacheInvalidationCriteria): boolean {
    // Must have at least one criterion
    return !!(
      criteria.agentId ||
      criteria.agentType ||
      criteria.olderThan ||
      criteria.pattern ||
      criteria.tags ||
      criteria.maxAge
    );
  }

  /**
   * Generate cache tags from context
   */
  generateCacheTags(agentId: string, input: string, context?: Record<string, unknown>): string[] {
    const tags: string[] = [agentId];

    // Add context-based tags
    if (context) {
      if (context.priority) {
        tags.push(`priority:${context.priority}`);
      }
      if (context.category) {
        tags.push(`category:${context.category}`);
      }
      if (context.type) {
        tags.push(`type:${context.type}`);
      }
    }

    // Add input-based tags
    if (input.includes("pattern")) {
      tags.push("pattern-analysis");
    }
    if (input.includes("market")) {
      tags.push("market-data");
    }
    if (input.includes("risk")) {
      tags.push("risk-assessment");
    }

    return tags;
  }

  /**
   * Calculate cache entry size estimate
   */
  estimateCacheEntrySize(data: any): number {
    try {
      // Rough estimation based on JSON stringification
      const jsonString = JSON.stringify(data);
      return jsonString.length * 2; // Assume 2 bytes per character for Unicode
    } catch {
      // Fallback estimation
      return 1000; // 1KB default
    }
  }

  /**
   * Format cache key for display
   */
  formatCacheKeyForDisplay(cacheKey: string): string {
    // Truncate long cache keys for better readability
    if (cacheKey.length > 80) {
      return `${cacheKey.substring(0, 40)}...${cacheKey.substring(cacheKey.length - 37)}`;
    }
    return cacheKey;
  }

  /**
   * Parse cache key to extract components
   */
  parseCacheKey(cacheKey: string): {
    type: string;
    agentId?: string;
    component?: string;
    hash?: string;
  } {
    const parts = cacheKey.split(":");

    return {
      type: parts[0] || "unknown",
      agentId: parts[1],
      component: parts[2],
      hash: parts[3],
    };
  }

  /**
   * Sanitize input for cache key generation
   */
  sanitizeForCacheKey(input: string): string {
    return input
      .replace(/[^a-zA-Z0-9_-]/g, "_") // Replace special chars with underscore
      .toLowerCase()
      .substring(0, 100); // Limit length
  }

  /**
   * Check if cache entry should be preloaded
   */
  shouldPreload(agentId: string, input: string, context?: Record<string, unknown>): boolean {
    // Preload high-priority or frequently used patterns
    if (context?.priority === "high") {
      return true;
    }

    // Preload pattern analysis requests
    if (input.includes("pattern") || input.includes("analysis")) {
      return true;
    }

    // Preload market data for active trading
    if (agentId.includes("market") && context?.realtime) {
      return true;
    }

    return false;
  }

  /**
   * Get cache configuration recommendations
   */
  getConfigRecommendations(currentConfig: AgentCacheConfig): string[] {
    const recommendations: string[] = [];

    if (currentConfig.defaultTTL < 60000) {
      recommendations.push("Consider increasing default TTL for better cache efficiency");
    }

    if (currentConfig.defaultTTL > 10 * 60000) {
      recommendations.push("Consider decreasing default TTL to keep data fresh");
    }

    if (!currentConfig.enablePerformanceTracking) {
      recommendations.push("Enable performance tracking for better insights");
    }

    if (!currentConfig.cacheWarmupEnabled) {
      recommendations.push("Enable cache warmup for improved hit rates");
    }

    return recommendations;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AgentCacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
