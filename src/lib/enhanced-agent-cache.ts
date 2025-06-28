/**
 * Enhanced Agent Cache - Refactored Entry Point
 *
 * This file replaces the original 1228-line monolithic enhanced-agent-cache.ts
 * with a clean module-based architecture for better maintainability.
 *
 * ARCHITECTURE:
 * - Modular cache system with single-responsibility components
 * - Clean separation of concerns (response, workflow, health, analytics, warming)
 * - Preserved all original functionality and interfaces
 * - Enhanced type safety with dedicated type modules
 *
 * MODULES:
 * - agent-cache-types.ts: All type definitions and interfaces
 * - agent-response-cache.ts: Individual agent response caching
 * - workflow-cache.ts: Multi-agent workflow result caching
 * - agent-health-cache.ts: Agent health status monitoring
 * - cache-performance-monitor.ts: Performance metrics and tracking
 * - cache-analytics.ts: Comprehensive analytics and reporting
 * - cache-warming.ts: Intelligent cache warming strategies
 * - cache-helpers.ts: Common utilities and helper functions
 */

// Export all types for backward compatibility
export type {
  AgentCacheAnalytics,
  AgentCacheConfig,
  AgentCacheMetrics,
  AgentHealthCache,
  CachedAgentResponse,
  CacheEventData,
  CacheEventHandler,
  CacheInvalidationCriteria,
  CacheMiddleware,
  CachePerformanceMetrics,
  CacheStrategy,
  CacheWarmupConfig,
  WorkflowCacheEntry,
} from "./cache/agent-cache-types";
export { AgentHealthCacheManager } from "./cache/agent-health-cache";
// Export individual services for advanced usage
export { AgentResponseCache } from "./cache/agent-response-cache";
export { CacheAnalyticsManager } from "./cache/cache-analytics";
export { CacheHelpers } from "./cache/cache-helpers";
export { CachePerformanceMonitor } from "./cache/cache-performance-monitor";
export { CacheWarmingManager } from "./cache/cache-warming";
export { WorkflowCache } from "./cache/workflow-cache";

import type { AgentResponse } from "@/src/types/common-interfaces";
import type {
  AgentCacheAnalytics,
  AgentCacheConfig,
  AgentCacheMetrics,
  AgentHealthCache,
  CachedAgentResponse,
  CacheInvalidationCriteria,
  WorkflowCacheEntry,
  WorkflowInvalidationCriteria,
} from "./cache/agent-cache-types";
import { AgentHealthCacheManager } from "./cache/agent-health-cache";
import { AgentResponseCache } from "./cache/agent-response-cache";
import { CacheAnalyticsManager } from "./cache/cache-analytics";
import { CacheHelpers } from "./cache/cache-helpers";
import { CachePerformanceMonitor } from "./cache/cache-performance-monitor";
import { CacheWarmingManager } from "./cache/cache-warming";
import { WorkflowCache } from "./cache/workflow-cache";

/**
 * Main Enhanced Agent Cache - Refactored Implementation
 *
 * Orchestrates all cache modules while maintaining the same public interface
 * for backward compatibility with existing code.
 */
export class EnhancedAgentCache {
  private _logger?: {
    info: (message: string, context?: any) => void;
    warn: (message: string, context?: any) => void;
    error: (message: string, context?: any, error?: Error) => void;
    debug: (message: string, context?: any) => void;
  };
  private get logger() {
    if (!this._logger) {
      this._logger = {
        info: (message: string, context?: any) =>
          console.info("[enhanced-agent-cache]", message, context || ""),
        warn: (message: string, context?: any) =>
          console.warn("[enhanced-agent-cache]", message, context || ""),
        error: (message: string, context?: any, error?: Error) =>
          console.error("[enhanced-agent-cache]", message, context || "", error || ""),
        debug: (message: string, context?: any) =>
          console.debug("[enhanced-agent-cache]", message, context || ""),
      };
    }
    return this._logger;
  }

  private config: AgentCacheConfig;
  private responseCache: AgentResponseCache;
  private workflowCache: WorkflowCache;
  private healthCache: AgentHealthCacheManager;
  private performanceMonitor: CachePerformanceMonitor;
  private analyticsManager: CacheAnalyticsManager;
  private warmingManager: CacheWarmingManager;
  private helpers: CacheHelpers;
  private isInitialized = false;

  constructor(config: Partial<AgentCacheConfig> = {}) {
    this.config = {
      defaultTTL: 5 * 60 * 1000, // 5 minutes
      maxRetries: 3,
      enablePerformanceTracking: true,
      enableWorkflowCaching: true,
      enableHealthCaching: true,
      cacheWarmupEnabled: true,
      ...config,
    };

    // Initialize all cache modules
    this.responseCache = new AgentResponseCache(this.config);
    this.workflowCache = new WorkflowCache(this.config);
    this.healthCache = new AgentHealthCacheManager(this.config);
    this.performanceMonitor = new CachePerformanceMonitor(this.config);

    // Use the performance monitor from response cache for analytics
    this.analyticsManager = new CacheAnalyticsManager(
      this.config,
      this.responseCache.getPerformanceMonitor(),
      this.workflowCache,
      this.healthCache
    );
    this.warmingManager = new CacheWarmingManager(this.config);
    this.helpers = new CacheHelpers(this.config);

    // Initialize cache warming if enabled
    if (this.config.cacheWarmupEnabled) {
      this.warmingManager.initializeCacheWarmup();
    }

    this.isInitialized = true;
  }

  // ============================================================================
  // Public Methods - Delegating to Modular Components
  // ============================================================================

  /**
   * Get cached agent response with enhanced metadata
   */
  async getAgentResponse(
    agentId: string,
    input: string,
    context?: Record<string, unknown>
  ): Promise<CachedAgentResponse | null> {
    return await this.responseCache.getAgentResponse(agentId, input, context);
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
    await this.responseCache.setAgentResponse(agentId, input, response, context, options);
  }

  /**
   * Invalidate agent responses by pattern or dependencies
   */
  async invalidateAgentResponses(criteria: CacheInvalidationCriteria): Promise<number> {
    return await this.responseCache.invalidateAgentResponses(criteria);
  }

  /**
   * Get cached workflow result
   */
  async getWorkflowResult(
    workflowType: string,
    parameters: Record<string, unknown>
  ): Promise<WorkflowCacheEntry | null> {
    return await this.workflowCache.getWorkflowResult(workflowType, parameters);
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
    await this.workflowCache.setWorkflowResult(workflowType, parameters, result, ttl);
  }

  /**
   * Invalidate workflow results by type or dependencies
   */
  async invalidateWorkflowResults(criteria: WorkflowInvalidationCriteria): Promise<number> {
    return await this.workflowCache.invalidateWorkflowResults(criteria);
  }

  /**
   * Get cached agent health status
   */
  async getAgentHealth(agentId: string): Promise<AgentHealthCache | null> {
    return await this.healthCache.getAgentHealth(agentId);
  }

  /**
   * Cache agent health status
   */
  async setAgentHealth(agentId: string, health: AgentHealthCache): Promise<void> {
    await this.healthCache.setAgentHealth(agentId, health);
  }

  /**
   * Get all agent health statuses
   */
  async getAllAgentHealth(): Promise<Map<string, AgentHealthCache>> {
    return await this.healthCache.getAllAgentHealth();
  }

  /**
   * Get health statistics
   */
  async getHealthStatistics(): Promise<{
    healthyAgents: number;
    degradedAgents: number;
    unhealthyAgents: number;
    averageResponseTime: number;
  }> {
    return await this.healthCache.getHealthStatistics();
  }

  /**
   * Get performance metrics for specific agent
   */
  getAgentMetrics(agentId: string): AgentCacheMetrics | null {
    // Use the performance monitor from the response cache which actually tracks hits/misses
    return this.responseCache.getPerformanceMonitor().getAgentMetrics(agentId);
  }

  /**
   * Get all performance metrics
   */
  getAllMetrics(): Map<string, AgentCacheMetrics> {
    // Use the performance monitor from the response cache which actually tracks hits/misses
    return this.responseCache.getPerformanceMonitor().getAllMetrics();
  }

  /**
   * Calculate cache efficiency for agent
   */
  calculateCacheEfficiency(agentId: string): number {
    return this.performanceMonitor.calculateCacheEfficiency(agentId);
  }

  /**
   * Track cache miss for performance metrics
   */
  async trackCacheMiss(agentId: string): Promise<void> {
    await this.performanceMonitor.trackCacheMiss(agentId);
  }

  /**
   * Get comprehensive agent cache analytics
   */
  async getAnalytics(): Promise<AgentCacheAnalytics> {
    return await this.analyticsManager.getAnalytics();
  }

  /**
   * Get performance insights for specific agent
   */
  getAgentInsights(agentId: string): {
    metrics: AgentCacheMetrics | null;
    insights: string[];
    recommendations: string[];
    efficiency: number;
  } {
    return this.analyticsManager.getAgentInsights(agentId);
  }

  /**
   * Export analytics data for external analysis
   */
  async exportAnalytics(): Promise<{
    timestamp: string;
    analytics: AgentCacheAnalytics;
    summary: any;
    rawMetrics: any;
  }> {
    return await this.analyticsManager.exportAnalytics();
  }

  /**
   * Warm up cache with frequently used patterns
   */
  async warmUpAgentCache(
    patterns?: Array<{
      agentId: string;
      input: string;
      context?: Record<string, unknown>;
    }>
  ): Promise<void> {
    await this.warmingManager.warmUpAgentCache(patterns);
  }

  /**
   * Add custom warmup pattern
   */
  addWarmupPattern(pattern: {
    agentId: string;
    input: string;
    context?: Record<string, unknown>;
    priority?: "low" | "medium" | "high";
  }): void {
    this.warmingManager.addWarmupPattern(pattern);
  }

  /**
   * Get warmup statistics
   */
  getWarmupStats(): {
    totalPatterns: number;
    isWarming: boolean;
    lastWarmupTime: number | null;
    warmupInterval: number;
    activePatterns: string[];
  } {
    return this.warmingManager.getWarmupStats();
  }

  /**
   * Update configuration for all modules
   */
  updateConfig(newConfig: Partial<AgentCacheConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update all child modules
    this.responseCache.updateConfig(newConfig);
    this.workflowCache.updateConfig(newConfig);
    this.healthCache.updateConfig(newConfig);
    this.performanceMonitor.updateConfig(newConfig);
    this.analyticsManager.updateConfig(newConfig);
    this.warmingManager.updateConfig(newConfig);
    this.helpers.updateConfig(newConfig);
  }

  /**
   * Initialize cache system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.info("[EnhancedAgentCache] Initializing enhanced agent cache system...");

    // Initialize performance monitoring
    this.performanceMonitor.startTracking();

    // Initialize cache warming if enabled
    if (this.config.cacheWarmupEnabled) {
      this.warmingManager.initializeCacheWarmup();
    }

    this.isInitialized = true;
    console.info("[EnhancedAgentCache] Enhanced agent cache system initialized");
  }

  /**
   * Cleanup and destroy the enhanced agent cache
   */
  async destroy(): Promise<void> {
    console.info("[EnhancedAgentCache] Destroying enhanced agent cache system...");

    // Stop cache warming
    this.warmingManager.stopWarmup();

    // Stop performance monitoring
    this.performanceMonitor.stopTracking();

    this.isInitialized = false;
    console.info("[EnhancedAgentCache] Enhanced agent cache destroyed");
  }
}

// ============================================================================
// Global Enhanced Agent Cache Instance
// ============================================================================

export const globalEnhancedAgentCache = new EnhancedAgentCache({
  defaultTTL: 5 * 60 * 1000,
  maxRetries: 3,
  enablePerformanceTracking: true,
  enableWorkflowCaching: true,
  enableHealthCaching: true,
  cacheWarmupEnabled: true,
});

// ============================================================================
// Cache Integration Utilities
// ============================================================================

/**
 * Enhanced cache decorator for agent methods
 */
export function withAgentCache<_T extends (...args: any[]) => Promise<AgentResponse>>(
  agentId: string,
  options: {
    ttl?: number;
    priority?: "low" | "medium" | "high";
    dependencies?: string[];
  } = {}
) {
  return (_target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]): Promise<AgentResponse> {
      const input = JSON.stringify(args);
      const context = { method: propertyKey, ...args[1] };

      // Try to get from cache first
      const cached = await globalEnhancedAgentCache.getAgentResponse(agentId, input, context);
      if (cached) {
        // Convert CachedAgentResponse to AgentResponse format
        return {
          success: true,
          data: cached.content,
          timestamp: cached.cacheMetadata.originalTimestamp,
          processingTime: 1, // Cached responses are fast
          metadata: cached.metadata,
          confidence: 1.0,
        };
      }

      // Execute original method
      const result = await originalMethod.apply(this, args);

      // Cache the result
      await globalEnhancedAgentCache.setAgentResponse(agentId, input, result, context, options);

      return result;
    };

    return descriptor;
  };
}

/**
 * Initialize agent cache for a specific agent
 */
export async function initializeAgentCache(agentId: string): Promise<void> {
  console.info(`[EnhancedAgentCache] Initializing cache for agent: ${agentId}`);

  // Initialize the global cache if not already done
  await globalEnhancedAgentCache.initialize();

  // Warm up cache for this agent
  await globalEnhancedAgentCache.warmUpAgentCache([
    {
      agentId,
      input: "health_check",
      context: { initialization: true },
    },
  ]);
}
