import { NextRequest } from 'next/server';
import { createApiHandler } from "../../../../src/lib/api-middleware";
import { globalCacheManager } from "../../../../src/lib/cache-manager";
import { globalEnhancedAgentCache } from "../../../../src/lib/enhanced-agent-cache";
import { globalAPIResponseCache } from "../../../../src/lib/api-response-cache";
import { globalCacheMonitoring } from "../../../../src/lib/cache-monitoring";

/**
 * GET /api/cache/analytics
 * Get detailed cache analytics and performance metrics
 */
export const GET = createApiHandler({
  auth: 'optional',
  rateLimit: 'general',
  logging: true,
})(async (request: NextRequest, context) => {
  try {
    const url = new URL(request.url);
    const timeRange = url.searchParams.get('timeRange') || '1h';
    const includeDetails = url.searchParams.get('details') === 'true';

    // Calculate time range
    const now = Date.now();
    const timeRangeMs = parseTimeRange(timeRange);
    const startTime = now - timeRangeMs;

    // Collect analytics from all cache layers
    const [
      globalAnalytics,
      agentAnalytics,
      apiAnalytics,
      performanceReport
    ] = await Promise.all([
      globalCacheManager.getAnalytics(),
      globalEnhancedAgentCache.getAnalytics(),
      globalAPIResponseCache.getAnalytics(),
      globalCacheMonitoring.getPerformanceReport(startTime, now)
    ]);

    // Prepare response data
    const response = {
      timeRange: {
        start: startTime,
        end: now,
        duration: timeRangeMs,
        label: timeRange,
      },
      summary: {
        totalRequests: performanceReport.summary.totalRequests,
        cacheHits: performanceReport.summary.cacheHits,
        cacheMisses: performanceReport.summary.cacheMisses,
        hitRate: performanceReport.summary.hitRate,
        memoryUsage: performanceReport.summary.memoryUsage,
        averageResponseTime: performanceReport.summary.averageResponseTime,
        errorRate: performanceReport.summary.errorRate,
      },
      trends: {
        hitRate: performanceReport.trends.hitRateTrend,
        memory: performanceReport.trends.memoryTrend,
        responseTime: performanceReport.trends.responseTrend,
      },
      breakdown: {
        global: {
          performance: globalAnalytics.performance,
          topKeys: globalAnalytics.topKeys.slice(0, 10),
          typeBreakdown: globalAnalytics.typeBreakdown,
        },
        agents: {
          performance: agentAnalytics.agentPerformance,
          workflow: agentAnalytics.workflowEfficiency,
          health: agentAnalytics.healthMonitoring,
        },
        apis: {
          endpoints: apiAnalytics.endpoints,
          performance: apiAnalytics.performance,
          freshness: apiAnalytics.freshness,
        },
      },
      recommendations: {
        global: globalAnalytics.recommendations,
        agents: agentAnalytics.recommendations,
        apis: apiAnalytics.recommendations,
        system: performanceReport.recommendations.map(rec => ({
          type: rec.type,
          priority: rec.priority,
          title: rec.title,
          description: rec.description,
          impact: rec.impact,
          implementation: rec.implementation,
          estimatedImprovement: rec.estimatedImprovement,
        })),
      },
    };

    // Add detailed breakdown if requested
    if (includeDetails) {
      response.breakdown.global.typeBreakdown = globalAnalytics.typeBreakdown;
      
      // Add detailed agent performance
      Object.keys(agentAnalytics.agentPerformance).forEach(agentId => {
        const agent = agentAnalytics.agentPerformance[agentId];
        response.breakdown.agents.performance[agentId] = {
          ...agent,
          cacheEfficiency: calculateCacheEfficiency(agent),
        } as any;
      });

      // Add detailed API endpoint analytics
      Object.keys(apiAnalytics.endpoints).forEach(endpoint => {
        const endpointData = apiAnalytics.endpoints[endpoint];
        response.breakdown.apis.endpoints[endpoint] = {
          ...endpointData,
        } as any;
      });
    }

    return context.success(response, {
      cached: false,
      timestamp: new Date().toISOString(),
      analytics: true,
    });

  } catch (error) {
    console.error('[API] Cache analytics error:', error);
    return context.error(
      'Failed to retrieve cache analytics',
      500,
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }
    );
  }
});

/**
 * POST /api/cache/analytics
 * Generate custom cache analytics report
 */
export const POST = createApiHandler({
  auth: 'required',
  rateLimit: 'auth',
  parseBody: true,
  validation: {
    reportType: 'required',
  },
})(async (request: NextRequest, context) => {
  try {
    const { reportType, parameters = {} } = context.body;

    let report;

    switch (reportType) {
      case 'performance':
        report = await generatePerformanceReport(parameters);
        break;
      case 'efficiency':
        report = await generateEfficiencyReport(parameters);
        break;
      case 'optimization':
        report = await generateOptimizationReport(parameters);
        break;
      case 'health':
        report = await generateHealthReport(parameters);
        break;
      default:
        return context.validationError('reportType', 'Invalid report type');
    }

    return context.success({
      reportType,
      parameters,
      report,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[API] Cache analytics report generation error:', error);
    return context.error(
      'Failed to generate cache analytics report',
      500,
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }
    );
  }
});

// Helper functions

function parseTimeRange(timeRange: string): number {
  const units = {
    'm': 60 * 1000,
    'h': 60 * 60 * 1000,
    'd': 24 * 60 * 60 * 1000,
  };

  const match = timeRange.match(/^(\d+)([mhd])$/);
  if (!match) {
    return 60 * 60 * 1000; // Default to 1 hour
  }

  const [, amount, unit] = match;
  return parseInt(amount) * (units[unit as keyof typeof units] || units.h);
}

function calculateCacheEfficiency(agent: any): number {
  const hitRate = agent.hitRate || 0;
  const responseTime = agent.averageResponseTime || 100;
  const errorRate = agent.errorRate || 0;

  // Efficiency score based on hit rate, response time, and error rate
  const hitRateScore = hitRate; // 0-100
  const responseTimeScore = Math.max(0, 100 - responseTime / 10); // Penalty for slow responses
  const errorRateScore = Math.max(0, 100 - errorRate * 2); // Penalty for errors

  return Math.round((hitRateScore * 0.5 + responseTimeScore * 0.3 + errorRateScore * 0.2));
}

function calculateEndpointEfficiency(endpoint: any): number {
  const hitRate = endpoint.hitRate || 0;
  const responseTime = endpoint.averageResponseTime || 100;
  const errorRate = endpoint.errorRate || 0;

  // Similar calculation to agent efficiency
  const hitRateScore = hitRate;
  const responseTimeScore = Math.max(0, 100 - responseTime / 10);
  const errorRateScore = Math.max(0, 100 - errorRate * 2);

  return Math.round((hitRateScore * 0.5 + responseTimeScore * 0.3 + errorRateScore * 0.2));
}

function generateAgentRecommendations(agentId: string, agent: any): string[] {
  const recommendations: string[] = [];

  if (agent.hitRate < 60) {
    recommendations.push('Consider increasing cache TTL or implementing better caching strategy');
  }

  if (agent.averageResponseTime > 200) {
    recommendations.push('Optimize agent response generation or increase cache priority');
  }

  if (agent.errorRate > 5) {
    recommendations.push('Review agent error handling and implement better retry logic');
  }

  if (agent.totalRequests < 100) {
    recommendations.push('Consider cache warming for this agent if it handles critical operations');
  }

  return recommendations;
}

function generateEndpointRecommendations(endpoint: string, data: any): string[] {
  const recommendations: string[] = [];

  if (data.hitRate < 50) {
    recommendations.push('Increase TTL or implement stale-while-revalidate strategy');
  }

  if (data.averageResponseTime > 1000) {
    recommendations.push('Consider aggressive caching due to slow response times');
  }

  if (endpoint.includes('/mexc/')) {
    recommendations.push('Monitor rate limits and implement request deduplication');
  }

  return recommendations;
}

async function generatePerformanceReport(parameters: any) {
  const timeRange = parseTimeRange(parameters.timeRange || '24h');
  const endTime = Date.now();
  const startTime = endTime - timeRange;

  return await globalCacheMonitoring.getPerformanceReport(startTime, endTime);
}

async function generateEfficiencyReport(parameters: any) {
  const [globalAnalytics, agentAnalytics, apiAnalytics] = await Promise.all([
    globalCacheManager.getAnalytics(),
    globalEnhancedAgentCache.getAnalytics(),
    globalAPIResponseCache.getAnalytics(),
  ]);

  return {
    global: {
      hitRate: globalAnalytics.performance.hitRate,
      memoryEfficiency: calculateMemoryEfficiency(globalAnalytics.performance),
      recommendations: globalAnalytics.recommendations,
    },
    agents: {
      averageEfficiency: Object.values(agentAnalytics.agentPerformance)
        .reduce((sum: number, agent: any) => sum + calculateCacheEfficiency(agent), 0) /
        Math.max(1, Object.keys(agentAnalytics.agentPerformance).length),
      topPerformers: getTopPerformingAgents(agentAnalytics.agentPerformance),
      recommendations: agentAnalytics.recommendations,
    },
    apis: {
      averageEfficiency: Object.values(apiAnalytics.endpoints)
        .reduce((sum: number, endpoint: any) => sum + calculateEndpointEfficiency(endpoint), 0) /
        Math.max(1, Object.keys(apiAnalytics.endpoints).length),
      topPerformers: getTopPerformingEndpoints(apiAnalytics.endpoints),
      recommendations: apiAnalytics.recommendations,
    },
  };
}

async function generateOptimizationReport(parameters: any) {
  const optimizationResults = await globalCacheMonitoring.optimizeCache();
  
  return {
    actions: optimizationResults.actions,
    improvements: optimizationResults.improvements,
    recommendations: await generateOptimizationRecommendations(),
    timestamp: new Date().toISOString(),
  };
}

async function generateHealthReport(parameters: any) {
  const currentStatus = await globalCacheMonitoring.getCurrentStatus();
  const alerts = globalCacheMonitoring.getActiveAlerts();
  const recommendations = globalCacheMonitoring.getCurrentRecommendations();

  return {
    health: currentStatus.health,
    performance: currentStatus.performance,
    alerts: alerts.slice(0, 10), // Top 10 alerts
    recommendations: recommendations.slice(0, 5), // Top 5 recommendations
    timestamp: new Date().toISOString(),
  };
}

function calculateMemoryEfficiency(performance: any): number {
  // Calculate memory efficiency based on hit rate vs memory usage
  const hitRate = performance.hitRate || 0;
  const memoryUsageMB = (performance.memoryUsage || 0) / 1024 / 1024;
  
  // Lower memory usage with higher hit rate = better efficiency
  if (memoryUsageMB === 0) return 0;
  
  return Math.round((hitRate / memoryUsageMB) * 10);
}

function getTopPerformingAgents(agentPerformance: any): any[] {
  return Object.entries(agentPerformance)
    .map(([agentId, data]: [string, any]) => ({
      agentId,
      efficiency: calculateCacheEfficiency(data),
      hitRate: data.hitRate,
      totalRequests: data.totalRequests,
    }))
    .sort((a, b) => b.efficiency - a.efficiency)
    .slice(0, 5);
}

function getTopPerformingEndpoints(endpoints: any): any[] {
  return Object.entries(endpoints)
    .map(([endpoint, data]: [string, any]) => ({
      endpoint,
      efficiency: calculateEndpointEfficiency(data),
      hitRate: data.hitRate,
      totalRequests: data.totalRequests,
    }))
    .sort((a, b) => b.efficiency - a.efficiency)
    .slice(0, 5);
}

async function generateOptimizationRecommendations(): Promise<string[]> {
  const [globalAnalytics, agentAnalytics, apiAnalytics] = await Promise.all([
    globalCacheManager.getAnalytics(),
    globalEnhancedAgentCache.getAnalytics(),
    globalAPIResponseCache.getAnalytics(),
  ]);

  const recommendations: string[] = [];

  // Global recommendations
  if (globalAnalytics.performance.hitRate < 70) {
    recommendations.push('Implement cache warming for frequently accessed data');
  }

  if (globalAnalytics.performance.memoryUsage > 500 * 1024 * 1024) {
    recommendations.push('Enable more aggressive cache cleanup to reduce memory usage');
  }

  // Agent recommendations
  const lowPerformingAgents = Object.entries(agentAnalytics.agentPerformance)
    .filter(([, data]: [string, any]) => data.hitRate < 50)
    .length;

  if (lowPerformingAgents > 0) {
    recommendations.push(`Optimize caching for ${lowPerformingAgents} underperforming agents`);
  }

  // API recommendations
  const slowEndpoints = Object.entries(apiAnalytics.endpoints)
    .filter(([, data]: [string, any]) => data.averageResponseTime > 1000)
    .length;

  if (slowEndpoints > 0) {
    recommendations.push(`Implement aggressive caching for ${slowEndpoints} slow API endpoints`);
  }

  return recommendations;
}