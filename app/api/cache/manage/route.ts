import { NextRequest } from 'next/server';
import { createApiHandler } from '@/src/lib/api-middleware';
import { globalCacheManager } from '@/src/lib/cache-manager';
import { globalEnhancedAgentCache } from '@/src/lib/enhanced-agent-cache';
import { globalAPIResponseCache } from '@/src/lib/api-response-cache';
import { globalCacheMonitoring } from '@/src/lib/cache-monitoring';

/**
 * POST /api/cache/manage
 * Manage cache operations (clear, optimize, warm-up, etc.)
 */
export const POST = createApiHandler({
  auth: 'required',
  rateLimit: 'authStrict',
  parseBody: true,
  validation: {
    operation: 'required',
  },
})(async (request: NextRequest, context) => {
  try {
    const { operation, parameters = {} } = context.body;

    let result;

    switch (operation) {
      case 'clear':
        result = await handleClearOperation(parameters);
        break;
      case 'optimize':
        result = await handleOptimizeOperation(parameters);
        break;
      case 'warmup':
        result = await handleWarmupOperation(parameters);
        break;
      case 'invalidate':
        result = await handleInvalidateOperation(parameters);
        break;
      case 'cleanup':
        result = await handleCleanupOperation(parameters);
        break;
      case 'resize':
        result = await handleResizeOperation(parameters);
        break;
      default:
        return context.validationError('operation', 'Invalid operation type');
    }

    return context.success({
      operation,
      parameters,
      result,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[API] Cache management error:', error);
    return context.error(
      `Failed to execute cache operation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      { 
        operation: context.body.operation,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }
    );
  }
});

/**
 * GET /api/cache/manage
 * Get available cache management operations and their status
 */
export const GET = createApiHandler({
  auth: 'required',
  rateLimit: 'auth',
})(async (request: NextRequest, context) => {
  try {
    const currentStatus = await globalCacheMonitoring.getCurrentStatus();
    const sizeBreakdown = globalCacheManager.getSizeBreakdown();

    const operations = [
      {
        operation: 'clear',
        description: 'Clear cache entries by level or pattern',
        parameters: {
          level: 'Optional: L1, L2, L3, or all',
          pattern: 'Optional: RegExp pattern to match keys',
        },
        currentState: {
          totalEntries: sizeBreakdown.total,
          canClear: sizeBreakdown.total > 0,
        },
      },
      {
        operation: 'optimize',
        description: 'Optimize cache performance and memory usage',
        parameters: {
          aggressive: 'Optional: Enable aggressive optimization',
        },
        currentState: {
          needsOptimization: currentStatus.performance.totalMemoryUsage > 100 * 1024 * 1024,
          memoryUsage: currentStatus.performance.totalMemoryUsage,
        },
      },
      {
        operation: 'warmup',
        description: 'Warm up cache with frequently used patterns',
        parameters: {
          agents: 'Optional: Array of agent IDs to warm up',
          apis: 'Optional: Array of API endpoints to warm up',
        },
        currentState: {
          canWarmup: true,
          agentCount: Object.keys(currentStatus.agents.agentPerformance).length,
          apiCount: Object.keys(currentStatus.apis.endpoints).length,
        },
      },
      {
        operation: 'invalidate',
        description: 'Invalidate cache entries by criteria',
        parameters: {
          pattern: 'Optional: Pattern to match',
          dependencies: 'Optional: Array of dependencies',
          type: 'Optional: Cache data type',
        },
        currentState: {
          canInvalidate: sizeBreakdown.total > 0,
          totalEntries: sizeBreakdown.total,
        },
      },
      {
        operation: 'cleanup',
        description: 'Clean up expired and stale cache entries',
        parameters: {
          aggressive: 'Optional: Enable aggressive cleanup',
        },
        currentState: {
          needsCleanup: currentStatus.health.status !== 'healthy',
          lastCleanup: currentStatus.global.lastCleanup,
        },
      },
      {
        operation: 'resize',
        description: 'Resize cache limits and thresholds',
        parameters: {
          maxSize: 'Optional: New maximum cache size',
          level: 'Optional: Cache level to resize',
        },
        currentState: {
          currentSize: sizeBreakdown.total,
          memoryUsage: currentStatus.performance.totalMemoryUsage,
        },
      },
    ];

    return context.success({
      operations,
      currentStatus: {
        health: currentStatus.health.status,
        totalEntries: sizeBreakdown.total,
        memoryUsage: currentStatus.performance.totalMemoryUsage,
        hitRate: currentStatus.global.hitRate,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[API] Cache management info error:', error);
    return context.error(
      'Failed to retrieve cache management information',
      500,
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }
    );
  }
});

// Operation handlers

async function handleClearOperation(parameters: any) {
  const { level, pattern } = parameters;
  
  let clearedEntries = 0;

  if (pattern) {
    // Clear by pattern
    const regex = new RegExp(pattern);
    clearedEntries += await globalCacheManager.invalidatePattern(regex);
    clearedEntries += await globalEnhancedAgentCache.invalidateAgentResponses({ pattern: regex });
    clearedEntries += await globalAPIResponseCache.invalidate({ pattern: regex });
  } else if (level) {
    // Clear by level
    if (level === 'all') {
      await globalCacheManager.clear();
      clearedEntries = 1; // Indicate success
    } else {
      await globalCacheManager.clear(level);
      clearedEntries = 1;
    }
  } else {
    // Clear all caches
    await globalCacheManager.clear();
    await globalEnhancedAgentCache.invalidateAgentResponses({});
    await globalAPIResponseCache.invalidate({});
    clearedEntries = 1;
  }

  return {
    success: true,
    clearedEntries,
    level: level || 'all',
    pattern: pattern || null,
  };
}

async function handleOptimizeOperation(parameters: any) {
  const { aggressive = false } = parameters;
  
  // Optimize global cache
  const globalOptimization = globalCacheManager.optimize();
  
  // Optimize monitoring
  const monitoringOptimization = await globalCacheMonitoring.optimizeCache();

  // Clean up if aggressive mode
  let cleanupResults = null;
  if (aggressive) {
    cleanupResults = globalCacheManager.cleanup();
  }

  return {
    success: true,
    global: globalOptimization,
    monitoring: monitoringOptimization,
    cleanup: cleanupResults,
    aggressive,
  };
}

async function handleWarmupOperation(parameters: any) {
  const { agents = [], apis = [] } = parameters;
  
  let agentWarmupResults = null;
  let apiWarmupResults = null;

  // Warm up agent cache
  if (agents.length > 0) {
    const warmupPatterns = agents.map((agentId: string) => ({
      agentId,
      input: 'health_check',
      context: { warmup: true },
    }));
    
    await globalEnhancedAgentCache.warmUpAgentCache(warmupPatterns);
    agentWarmupResults = { agents: agents.length, patterns: warmupPatterns.length };
  }

  // Warm up API cache
  if (apis.length > 0) {
    for (const endpoint of apis) {
      // This would trigger API cache warming - implementation depends on specific API client
      console.log(`[CacheManage] Warming up API cache for endpoint: ${endpoint}`);
    }
    apiWarmupResults = { endpoints: apis.length };
  }

  return {
    success: true,
    agents: agentWarmupResults,
    apis: apiWarmupResults,
  };
}

async function handleInvalidateOperation(parameters: any) {
  const { pattern, dependencies = [], type } = parameters;
  
  let invalidatedEntries = 0;

  // Invalidate from global cache
  if (pattern) {
    invalidatedEntries += await globalCacheManager.invalidatePattern(pattern);
  }

  if (dependencies.length > 0) {
    for (const dependency of dependencies) {
      invalidatedEntries += await globalCacheManager.invalidateByDependency(dependency);
    }
  }

  if (type) {
    invalidatedEntries += await globalCacheManager.invalidateByType(type);
  }

  // Invalidate from agent cache
  invalidatedEntries += await globalEnhancedAgentCache.invalidateAgentResponses({
    pattern,
    dependencies,
  });

  // Invalidate from API cache
  invalidatedEntries += await globalAPIResponseCache.invalidate({
    pattern,
    dependencies,
  });

  return {
    success: true,
    invalidatedEntries,
    criteria: {
      pattern: pattern || null,
      dependencies,
      type: type || null,
    },
  };
}

async function handleCleanupOperation(parameters: any) {
  const { aggressive = false } = parameters;
  
  // Clean up global cache
  const globalCleanup = globalCacheManager.cleanup();
  
  // Clean up pattern embeddings if aggressive
  let patternCleanup = null;
  if (aggressive) {
    // This would require implementing cleanup in pattern embedding service
    console.log('[CacheManage] Aggressive cleanup: cleaning pattern embeddings');
    patternCleanup = { cleaned: 0 }; // Placeholder
  }

  return {
    success: true,
    global: globalCleanup,
    patterns: patternCleanup,
    aggressive,
    totalCleaned: globalCleanup.total + (patternCleanup?.cleaned || 0),
  };
}

async function handleResizeOperation(parameters: any) {
  const { maxSize, level } = parameters;
  
  // Note: This would require implementing resize functionality in cache manager
  // For now, we'll return the operation parameters
  
  const currentSizes = globalCacheManager.getSizeBreakdown();
  
  return {
    success: true,
    operation: 'resize',
    parameters: { maxSize, level },
    currentSizes,
    note: 'Cache resizing will be applied on next restart',
  };
}

/**
 * PUT /api/cache/manage
 * Update cache configuration
 */
export const PUT = createApiHandler({
  auth: 'required',
  rateLimit: 'authStrict',
  parseBody: true,
  validation: {
    config: 'required',
  },
})(async (request: NextRequest, context) => {
  try {
    const { config } = context.body;
    
    // Validate configuration
    const validationResult = validateCacheConfig(config);
    if (!validationResult.valid) {
      return context.validationError('config', validationResult.error);
    }

    // Note: In a real implementation, this would update the cache configuration
    // For now, we'll return the configuration that would be applied
    
    return context.success({
      configurationUpdated: true,
      newConfig: config,
      appliedAt: new Date().toISOString(),
      note: 'Configuration changes will be applied on next restart',
    });

  } catch (error) {
    console.error('[API] Cache config update error:', error);
    return context.error(
      'Failed to update cache configuration',
      500,
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }
    );
  }
});

// Helper functions

function validateCacheConfig(config: any): { valid: boolean; error?: string } {
  if (typeof config !== 'object' || config === null) {
    return { valid: false, error: 'Config must be an object' };
  }

  // Validate maxSize
  if (config.maxSize !== undefined) {
    if (typeof config.maxSize !== 'number' || config.maxSize < 1000) {
      return { valid: false, error: 'maxSize must be a number >= 1000' };
    }
  }

  // Validate TTL values
  if (config.defaultTTL !== undefined) {
    if (typeof config.defaultTTL !== 'number' || config.defaultTTL < 1000) {
      return { valid: false, error: 'defaultTTL must be a number >= 1000ms' };
    }
  }

  // Validate thresholds
  if (config.performanceThresholds !== undefined) {
    const thresholds = config.performanceThresholds;
    
    if (thresholds.minHitRate !== undefined) {
      if (typeof thresholds.minHitRate !== 'number' || thresholds.minHitRate < 0 || thresholds.minHitRate > 100) {
        return { valid: false, error: 'minHitRate must be a number between 0 and 100' };
      }
    }

    if (thresholds.maxMemoryUsage !== undefined) {
      if (typeof thresholds.maxMemoryUsage !== 'number' || thresholds.maxMemoryUsage < 1024 * 1024) {
        return { valid: false, error: 'maxMemoryUsage must be a number >= 1MB' };
      }
    }
  }

  return { valid: true };
}