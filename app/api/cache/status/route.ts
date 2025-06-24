import { NextRequest } from 'next/server';
import { createLogger } from '../../../../src/lib/structured-logger';
import { createApiHandler } from "../../../../src/lib/api-middleware";
import { getCacheHealthStatus, getCacheDashboardData } from "../../../../src/lib/cache-monitoring";
import { globalCacheMonitoring } from "../../../../src/lib/cache-monitoring";

const logger = createLogger('route');

/**
 * GET /api/cache/status
 * Get comprehensive cache system status and health information
 */
export const GET = createApiHandler({
  auth: 'optional',
  rateLimit: 'general',
  logging: true,
})(async (request: NextRequest, context) => {
  try {
    // Get comprehensive cache status
    const healthStatus = await getCacheHealthStatus();
    const dashboardData = await getCacheDashboardData();
    const currentMetrics = await globalCacheMonitoring.getCurrentStatus();

    // Format response data
    const response = {
      health: {
        status: healthStatus.status,
        summary: healthStatus.summary,
        timestamp: Date.now(),
      },
      overview: dashboardData.overview,
      performance: {
        hitRate: currentMetrics.global.hitRate,
        memoryUsage: currentMetrics.performance.totalMemoryUsage,
        responseTime: currentMetrics.performance.responseTimeP95,
        throughput: currentMetrics.performance.throughput,
        errorRate: currentMetrics.performance.errorRate,
      },
      levels: {
        L1: {
          size: currentMetrics.levels.L1.totalSize,
          hitRate: currentMetrics.levels.L1.hitRate,
          memoryUsage: currentMetrics.levels.L1.memoryUsage,
        },
        L2: {
          size: currentMetrics.levels.L2.totalSize,
          hitRate: currentMetrics.levels.L2.hitRate,
          memoryUsage: currentMetrics.levels.L2.memoryUsage,
        },
        L3: {
          size: currentMetrics.levels.L3.totalSize,
          hitRate: currentMetrics.levels.L3.hitRate,
          memoryUsage: currentMetrics.levels.L3.memoryUsage,
        },
      },
      agents: {
        totalAgents: Object.keys(currentMetrics.agents.agentPerformance).length,
        averageHitRate: Object.values(currentMetrics.agents.agentPerformance)
          .reduce((sum, agent) => sum + agent.hitRate, 0) / 
          Math.max(1, Object.keys(currentMetrics.agents.agentPerformance).length),
      },
      apis: {
        totalEndpoints: Object.keys(currentMetrics.apis.endpoints).length,
        averageHitRate: Object.values(currentMetrics.apis.endpoints)
          .reduce((sum, endpoint) => sum + endpoint.hitRate, 0) / 
          Math.max(1, Object.keys(currentMetrics.apis.endpoints).length),
        totalRequestsSaved: currentMetrics.apis.performance.totalRequestsSaved,
      },
      alerts: dashboardData.alerts.map(alert => ({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        timestamp: alert.timestamp,
        resolved: alert.resolved,
      })),
      recommendations: dashboardData.recommendations.map(rec => ({
        id: rec.id,
        type: rec.type,
        priority: rec.priority,
        title: rec.title,
        description: rec.description,
        impact: rec.impact,
        timestamp: rec.timestamp,
      })),
    };

    return context.success(response, {
      cached: false,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('[API] Cache status error:', { error });
    return context.error(
      'Failed to retrieve cache status',
      500,
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }
    );
  }
});