/**
 * Cost Monitoring Statistics API
 * 
 * Lightweight endpoint for basic cost monitoring statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { apiResponse } from "@/src/lib/api-response";
import { globalDatabaseCostProtector } from "@/src/lib/database-cost-protector";
import { globalQueryBatchingService } from "@/src/lib/database-query-batching-service";
import { globalQueryCacheMiddleware, withDatabaseQueryCache } from "@/src/lib/database-query-cache-middleware";

async function getStatsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // Get basic statistics from all systems
    const costStats = globalDatabaseCostProtector.getUsageStats();
    const cacheStats = globalQueryCacheMiddleware.getCacheStats();
    const batchStats = globalQueryBatchingService.getBatchingStats();
    
    // Calculate key metrics
    const totalSavings = (cacheStats.performance.databaseQueriesSaved * 0.001) + 
                        (batchStats.metrics.connectionsSaved * 0.01);
    
    const efficiency = {
      cacheHitRate: cacheStats.cache.hitRate,
      batchingRate: batchStats.metrics.batchingRate,
      overallEfficiency: (cacheStats.cache.hitRate + batchStats.metrics.batchingRate) / 2,
    };
    
    const healthStatus = costStats.emergency.mode ? 'critical' : 
                        (costStats.cost.hourlyRate > costStats.cost.hourlyLimit * 0.8 ? 'warning' : 'healthy');
    
    return apiResponse({
      success: true,
      data: {
        overview: {
          status: healthStatus,
          totalQueries: costStats.queries.lastDay,
          totalCost: parseFloat(costStats.cost.total.toFixed(4)),
          hourlyRate: parseFloat(costStats.cost.hourlyRate.toFixed(4)),
          totalSavings: parseFloat(totalSavings.toFixed(4)),
          emergencyMode: costStats.emergency.mode,
        },
        performance: {
          queries: {
            lastMinute: costStats.queries.lastMinute,
            lastHour: costStats.queries.lastHour,
            limit: costStats.queries.perHourLimit,
            utilizationPercent: parseFloat(((costStats.queries.lastHour / costStats.queries.perHourLimit) * 100).toFixed(2)),
          },
          connections: {
            current: costStats.connections.current,
            limit: costStats.connections.limit,
            utilizationPercent: parseFloat(((costStats.connections.current / costStats.connections.limit) * 100).toFixed(2)),
          },
          cache: {
            hitRate: cacheStats.cache.hitRate,
            totalRequests: cacheStats.cache.totalRequests,
            savedQueries: cacheStats.performance.databaseQueriesSaved,
          },
          batching: {
            batchingRate: batchStats.metrics.batchingRate,
            connectionsSaved: batchStats.metrics.connectionsSaved,
            timeSaved: batchStats.metrics.totalTimeSaved,
          },
        },
        efficiency,
        thresholds: {
          cost: {
            current: costStats.cost.hourlyRate,
            warning: costStats.cost.hourlyLimit * 0.8,
            critical: costStats.cost.hourlyLimit,
          },
          queries: {
            current: costStats.queries.lastHour,
            warning: costStats.queries.perHourLimit * 0.8,
            critical: costStats.queries.perHourLimit,
          },
        },
        recommendations: generateQuickRecommendations(costStats, cacheStats, batchStats),
      },
      meta: {
        timestamp: new Date().toISOString(),
        uptime: costStats.uptime,
        dataSource: 'real-time',
      },
    });
    
  } catch (error) {
    console.error('[Cost Stats] Error:', error);
    
    return apiResponse({
      success: false,
      error: error instanceof Error ? error.message : "Failed to load statistics",
    }, 500);
  }
}

function generateQuickRecommendations(costStats: any, cacheStats: any, batchStats: any): string[] {
  const recommendations: string[] = [];
  
  if (costStats.emergency.mode) {
    recommendations.push('System in emergency mode - reduce non-essential operations');
  }
  
  if (cacheStats.cache.hitRate < 50) {
    recommendations.push('Low cache hit rate - consider increasing TTL values');
  }
  
  if (batchStats.metrics.batchingRate < 30) {
    recommendations.push('Low batching efficiency - enable query batching for read operations');
  }
  
  if (costStats.cost.hourlyRate > costStats.cost.hourlyLimit * 0.7) {
    recommendations.push('Approaching cost limits - implement additional caching');
  }
  
  if (costStats.connections.current > costStats.connections.limit * 0.8) {
    recommendations.push('High connection usage - optimize connection pooling');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('System performance is optimal');
  }
  
  return recommendations;
}

// Export with short cache time for frequently accessed stats
export const GET = withDatabaseQueryCache(getStatsHandler, {
  endpoint: "/api/cost-monitoring/stats",
  cacheTtlSeconds: 15, // 15 seconds cache
  enableCompression: true,
  enableStaleWhileRevalidate: true,
});