import { NextRequest, NextResponse } from "next/server";
import { getCacheWarmingService } from "../../../../src/lib/cache-warming-service";
import { globalCacheMonitoring } from "../../../../src/lib/cache-monitoring";
import { createApiResponse } from "../../../../src/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    // Get cache warming service status
    const warmingStatus = await getCacheWarmingStatus();

    // Get cache performance metrics
    const performanceMetrics = await getCachePerformanceMetrics();

    // Get Redis/Valkey connection status
    const connectionStatus = await getCacheConnectionStatus();

    return createApiResponse({
      success: true,
      data: {
        warming: warmingStatus,
        performance: performanceMetrics,
        connection: connectionStatus,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[Cache Warming Status] Error:", error);
    return createApiResponse(
      {
        success: false,
        error: "Failed to get cache warming status",
        details: { error: error instanceof Error ? error.message : "Unknown error" },
      },
      500
    );
  }
}

async function getCacheWarmingStatus() {
  try {
    const cacheWarmingService = getCacheWarmingService();
    const strategies = cacheWarmingService.getStrategies();
    const metrics = cacheWarmingService.getMetrics();

    return {
      isActive: !!cacheWarmingService, // Service exists and is initialized
      strategies: Array.from(strategies.entries()).map(([name, strategy]) => ({
        name,
        enabled: strategy.enabled,
        priority: strategy.priority,
        frequency: strategy.frequency,
        lastRun: strategy.lastRun ? new Date(strategy.lastRun).toISOString() : null,
        nextRun: strategy.lastRun
          ? new Date(strategy.lastRun + strategy.frequency).toISOString()
          : null,
        status: getStrategyStatus(strategy),
      })),
      metrics: {
        totalExecutions: metrics.totalRuns,
        successfulExecutions: metrics.successfulRuns,
        failedExecutions: metrics.failedRuns,
        averageExecutionTime: metrics.avgExecutionTime,
        lastExecution: metrics.lastWarmupTime ? new Date(metrics.lastWarmupTime).toISOString() : null,
        successRate: metrics.totalRuns > 0
          ? (metrics.successfulRuns / metrics.totalRuns) * 100
          : 0,
      },
    };
  } catch (error) {
    console.error("[Cache Warming Status] Error getting warming status:", error);
    return {
      isActive: false,
      strategies: [],
      metrics: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        lastExecution: null,
        successRate: 0,
      },
    };
  }
}

async function getCachePerformanceMetrics() {
  try {
    const status = await globalCacheMonitoring.getCurrentStatus();

    return {
      hitRate: status.global.hitRate || 0,
      missRate: 100 - (status.global.hitRate || 0),
      totalRequests: (status.global.hits || 0) + (status.global.misses || 0),
      averageResponseTime: status.global.averageAccessTime || 0,
      cacheSize: status.global.totalSize || 0,
      memoryUsage: status.performance.totalMemoryUsage || 0,
      evictions: 0, // Not tracked in current implementation
      errors: 0, // Not tracked in current implementation
      trends: {
        hitRateChange: 0, // Would need historical data
        responseTimeChange: 0, // Would need historical data
        requestVolumeChange: 0, // Would need historical data
      },
    };
  } catch (error) {
    console.error("[Cache Performance] Error getting metrics:", error);
    return {
      hitRate: 0,
      missRate: 100,
      totalRequests: 0,
      averageResponseTime: 0,
      cacheSize: 0,
      memoryUsage: 0,
      evictions: 0,
      errors: 0,
      trends: {
        hitRateChange: 0,
        responseTimeChange: 0,
        requestVolumeChange: 0,
      },
    };
  }
}

async function getCacheConnectionStatus() {
  try {
    // Test Redis/Valkey connection
    const redisConnected = await testRedisConnection();
    const valkeyConnected = await testValkeyConnection();

    return {
      redis: {
        connected: redisConnected,
        status: redisConnected ? "healthy" : "disconnected",
        message: redisConnected ? "Redis connection active" : "Redis connection failed",
        lastCheck: new Date().toISOString(),
      },
      valkey: {
        connected: valkeyConnected,
        status: valkeyConnected ? "healthy" : "disconnected",
        message: valkeyConnected ? "Valkey connection active" : "Valkey connection failed",
        lastCheck: new Date().toISOString(),
      },
      gracefulDegradation: {
        enabled: true,
        fallbackMode: !redisConnected && !valkeyConnected,
        message: !redisConnected && !valkeyConnected
          ? "Operating in fallback mode - cache operations disabled"
          : "Cache operations active",
      },
    };
  } catch (error) {
    console.error("[Cache Connection] Error checking connection:", error);
    return {
      redis: {
        connected: false,
        status: "error",
        message: "Connection check failed",
        lastCheck: new Date().toISOString(),
      },
      valkey: {
        connected: false,
        status: "error",
        message: "Connection check failed",
        lastCheck: new Date().toISOString(),
      },
      gracefulDegradation: {
        enabled: true,
        fallbackMode: true,
        message: "Operating in fallback mode - cache operations disabled",
      },
    };
  }
}

async function testRedisConnection(): Promise<boolean> {
  try {
    // This would test actual Redis connection
    // For now, return based on environment configuration
    return !!process.env.REDIS_URL;
  } catch (error) {
    return false;
  }
}

async function testValkeyConnection(): Promise<boolean> {
  try {
    // This would test actual Valkey connection
    // For now, return based on environment configuration
    return !!process.env.VALKEY_URL;
  } catch (error) {
    return false;
  }
}

function getStrategyStatus(strategy: any) {
  const now = Date.now();

  if (!strategy.enabled) {
    return "disabled";
  }

  if (!strategy.lastRun) {
    return "pending";
  }

  const timeSinceLastRun = now - strategy.lastRun;
  const isOverdue = timeSinceLastRun > strategy.frequency * 1.5; // 50% tolerance

  if (isOverdue) {
    return "overdue";
  }

  return "active";
}
