import { createSafeLogger } from "../structured-logger";

/**
 * Workflow Cache Manager
 *
 * Handles caching of multi-agent workflow execution results with dependency management
 * and intelligent cache invalidation based on workflow success and confidence metrics.
 *
 * FEATURES:
 * - Workflow result caching with metadata
 * - Dependency-based cache invalidation
 * - Dynamic TTL calculation based on workflow success
 * - Cache validation with age and success checks
 * - Performance tracking for workflow efficiency
 */

import { generateCacheKey, globalCacheManager } from "../cache-manager";
import type {
  AgentCacheConfig,
  WorkflowCacheEntry,
  WorkflowInvalidationCriteria,
} from "./agent-cache-types";

export class WorkflowCache {
  private logger = createSafeLogger("workflow-cache");

  private config: AgentCacheConfig;
  private workflowCache: Map<string, WorkflowCacheEntry> = new Map();

  constructor(config: AgentCacheConfig) {
    this.config = config;
  }

  /**
   * Get cached workflow result
   */
  async getWorkflowResult(
    workflowType: string,
    parameters: Record<string, unknown>
  ): Promise<WorkflowCacheEntry | null> {
    if (!this.config.enableWorkflowCaching) {
      return null;
    }

    const cacheKey = this.generateWorkflowCacheKey(workflowType, parameters);

    try {
      const cached = await globalCacheManager.get<WorkflowCacheEntry>(cacheKey);
      if (!cached) {
        return null;
      }

      // Check if cached workflow is still valid
      if (this.isWorkflowCacheValid(cached)) {
        return cached;
      }
      // Remove invalid cache entry
      await globalCacheManager.delete(cacheKey);
      return null;
    } catch (error) {
      logger.error(`[WorkflowCache] Error getting workflow result for ${workflowType}:`, error);
      return null;
    }
  }

  /**
   * Cache workflow execution result
   */
  async setWorkflowResult(
    workflowType: string,
    parameters: Record<string, unknown>,
    result: WorkflowCacheEntry,
    ttl?: number
  ): Promise<void> {
    if (!this.config.enableWorkflowCaching) {
      return;
    }

    const cacheKey = this.generateWorkflowCacheKey(workflowType, parameters);

    try {
      // Cache with workflow-specific TTL
      const workflowTTL = ttl || this.calculateWorkflowTTL(result);

      await globalCacheManager.set(cacheKey, result, {
        type: "workflow_result",
        ttl: workflowTTL,
        metadata: {
          type: "workflow_result",
          source: "workflow-engine",
          dependencies: result.dependencies,
        },
      });

      // Update workflow cache map for quick access
      this.workflowCache.set(cacheKey, result);
    } catch (error) {
      logger.error(`[WorkflowCache] Error caching workflow result for ${workflowType}:`, error);
    }
  }

  /**
   * Invalidate workflow results by type or dependencies
   */
  async invalidateWorkflowResults(criteria: WorkflowInvalidationCriteria): Promise<number> {
    let invalidated = 0;

    try {
      if (criteria.workflowId) {
        const pattern = new RegExp(`^workflow:${criteria.workflowId}:`);
        invalidated += await globalCacheManager.invalidatePattern(pattern);
      }

      if (criteria.containsAgent) {
        // Invalidate workflows that contain specific agent
        for (const [key, entry] of this.workflowCache.entries()) {
          if (entry.agentSequence.includes(criteria.containsAgent)) {
            await globalCacheManager.delete(key);
            this.workflowCache.delete(key);
            invalidated++;
          }
        }
      }

      if (criteria.maxAge) {
        // Invalidate workflows older than maxAge
        for (const [key, entry] of this.workflowCache.entries()) {
          if (Date.now() - entry.timestamp > criteria.maxAge) {
            await globalCacheManager.delete(key);
            this.workflowCache.delete(key);
            invalidated++;
          }
        }
      }

      logger.info(`[WorkflowCache] Invalidated ${invalidated} workflow results`);
    } catch (error) {
      logger.error("[WorkflowCache] Error invalidating workflow results:", error);
    }

    return invalidated;
  }

  /**
   * Get workflow statistics
   */
  getWorkflowStats() {
    const workflows = Array.from(this.workflowCache.values());
    const totalWorkflows = workflows.length;
    const cachedWorkflows = workflows.filter((w) => w.metadata.success).length;
    const averageExecutionTime =
      workflows.length > 0
        ? workflows.reduce((sum, w) => sum + w.executionTime, 0) / workflows.length
        : 0;

    const timesSaved = workflows.reduce((total, workflow) => {
      // Estimate time saved by caching (assuming 50% time savings on cache hits)
      return total + workflow.executionTime * 0.5;
    }, 0);

    return {
      totalWorkflows,
      cachedWorkflows,
      cacheHitRate: totalWorkflows > 0 ? (cachedWorkflows / totalWorkflows) * 100 : 0,
      averageExecutionTime,
      timesSaved,
    };
  }

  /**
   * Clear all workflow cache entries
   */
  async clearWorkflowCache(): Promise<void> {
    try {
      const pattern = /^workflow:/;
      await globalCacheManager.invalidatePattern(pattern);
      this.workflowCache.clear();
      logger.info("[WorkflowCache] Cleared all workflow cache entries");
    } catch (error) {
      logger.error("[WorkflowCache] Error clearing workflow cache:", error);
    }
  }

  /**
   * Get workflow cache size
   */
  getWorkflowCacheSize(): number {
    return this.workflowCache.size;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Generate cache key for workflow results
   */
  private generateWorkflowCacheKey(
    workflowType: string,
    parameters: Record<string, unknown>
  ): string {
    return generateCacheKey("workflow", workflowType, parameters);
  }

  /**
   * Calculate TTL for workflow cache entries
   */
  private calculateWorkflowTTL(result: WorkflowCacheEntry): number {
    let baseTTL = 10 * 60 * 1000; // 10 minutes base

    // Adjust based on workflow success
    if (!result.metadata.success) {
      baseTTL *= 0.1; // Failed workflows expire quickly
    }

    // Adjust based on confidence
    if (result.metadata.confidence > 80) {
      baseTTL *= 2;
    }

    // Adjust based on error count
    if (result.metadata.errorCount > 0) {
      baseTTL *= Math.max(0.5, 1 - result.metadata.errorCount * 0.1);
    }

    // Adjust based on handoff count (more handoffs = more complex = longer cache)
    if (result.metadata.handoffCount > 3) {
      baseTTL *= 1.5;
    }

    return Math.min(baseTTL, 30 * 60 * 1000); // Max 30 minutes
  }

  /**
   * Check if workflow cache entry is still valid
   */
  private isWorkflowCacheValid(entry: WorkflowCacheEntry): boolean {
    // Check if workflow cache entry is still valid
    const maxAge = 15 * 60 * 1000; // 15 minutes max age
    const age = Date.now() - entry.timestamp;

    return age < maxAge && entry.metadata.success;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AgentCacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
