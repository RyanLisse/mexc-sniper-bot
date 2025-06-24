/**
 * Performance Analytics API Endpoint
 * 
 * Provides comprehensive performance metrics and analytics for the MEXC Sniper Bot.
 * Integrates with the trading analytics service to deliver real-time performance data.
 */

import { NextRequest, NextResponse } from "next/server";
import { createLogger } from '../../../../src/lib/structured-logger';
import { z } from "zod";
import { tradingAnalytics } from "../../../../src/services/trading-analytics-service";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

// Request validation schemas
const PerformanceQuerySchema = z.object({
  timeframe: z.enum(['1h', '24h', '7d', '30d']).optional().default('24h'),
  userId: z.string().optional(),
  operation: z.string().optional(),
  includeBreakdown: z.coerce.boolean().optional().default(false),
  format: z.enum(['json', 'csv']).optional().default('json'),
});

const timeframeToMs = {
  '1h': 3600000,
  '24h': 86400000,
  '7d': 604800000,
  '30d': 2592000000,
};

const logger = createLogger('route');

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse and validate query parameters
    const url = new URL(request.url);
    const params = Object.fromEntries(url.searchParams.entries());
    
    const validation = PerformanceQuerySchema.safeParse(params);
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: "Invalid query parameters",
          details: validation.error.errors
        },
        { status: 400 }
      );
    }

    const { timeframe, userId, operation, includeBreakdown, format } = validation.data;
    const timeWindow = timeframeToMs[timeframe];

    // Get performance metrics
    const metrics = tradingAnalytics.getPerformanceMetrics(operation, timeWindow);
    
    // Get analytics stats
    const stats = tradingAnalytics.getAnalyticsStats();

    // Generate comprehensive analytics report if requested
    let analyticsReport = null;
    if (includeBreakdown) {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - timeWindow);
      
      analyticsReport = tradingAnalytics.generateAnalyticsReport(
        startTime,
        endTime,
        userId ? { userId } : undefined
      );
    }

    // Calculate additional performance indicators
    const performanceData = {
      overview: {
        timeframe,
        totalEvents: stats.totalEvents,
        eventsInPeriod: stats.eventsLast24h,
        avgEventSize: Math.round(stats.averageEventSize),
        cacheEfficiency: stats.cacheSize > 0 ? (stats.totalEvents / stats.cacheSize).toFixed(2) : 'N/A',
      },
      metrics: {
        current: metrics.length > 0 ? metrics[metrics.length - 1] : null,
        historical: metrics,
        trends: calculateTrends(metrics),
      },
      performance: {
        systemHealth: await getSystemHealthScore(metrics),
        bottlenecks: identifyBottlenecks(metrics),
        recommendations: generatePerformanceRecommendations(metrics, stats),
      },
      ...(analyticsReport && { detailedReport: analyticsReport }),
    };

    // Return data in requested format
    if (format === 'csv') {
      const csvData = convertToCSV(performanceData);
      return new NextResponse(csvData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="performance-${timeframe}-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: performanceData,
      timestamp: new Date().toISOString(),
      query: validation.data,
    });

  } catch (error) {
    logger.error('[Performance Analytics] Error:', error);
    
    return NextResponse.json(
      { 
        error: "Failed to fetch performance analytics",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Schema for custom performance tracking
    const CustomMetricSchema = z.object({
      operation: z.string().min(1),
      responseTime: z.number().min(0),
      success: z.boolean(),
      userId: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
      error: z.string().optional(),
    });

    const validation = CustomMetricSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: "Invalid request body",
          details: validation.error.errors
        },
        { status: 400 }
      );
    }

    const { operation, responseTime, success, userId, metadata, error } = validation.data;

    // Log the custom performance metric
    tradingAnalytics.logApiCall(
      operation,
      responseTime,
      success,
      userId || user.id,
      error,
      metadata
    );

    return NextResponse.json({
      success: true,
      message: "Performance metric logged successfully",
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('[Performance Analytics] POST Error:', error);
    
    return NextResponse.json(
      { 
        error: "Failed to log performance metric",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateTrends(metrics: any[]): {
  responseTime: { trend: 'up' | 'down' | 'stable'; change: number };
  throughput: { trend: 'up' | 'down' | 'stable'; change: number };
  errorRate: { trend: 'up' | 'down' | 'stable'; change: number };
} {
  if (metrics.length < 2) {
    return {
      responseTime: { trend: 'stable', change: 0 },
      throughput: { trend: 'stable', change: 0 },
      errorRate: { trend: 'stable', change: 0 },
    };
  }

  const recent = metrics.slice(-5); // Last 5 data points
  const older = metrics.slice(-10, -5); // Previous 5 data points

  const avgRecent = {
    responseTime: recent.reduce((sum, m) => sum + m.metrics.responseTimeMs, 0) / recent.length,
    throughput: recent.reduce((sum, m) => sum + m.metrics.throughputPerSecond, 0) / recent.length,
    errorRate: recent.reduce((sum, m) => sum + m.metrics.errorRate, 0) / recent.length,
  };

  const avgOlder = older.length > 0 ? {
    responseTime: older.reduce((sum, m) => sum + m.metrics.responseTimeMs, 0) / older.length,
    throughput: older.reduce((sum, m) => sum + m.metrics.throughputPerSecond, 0) / older.length,
    errorRate: older.reduce((sum, m) => sum + m.metrics.errorRate, 0) / older.length,
  } : avgRecent;

  return {
    responseTime: {
      trend: avgRecent.responseTime > avgOlder.responseTime * 1.1 ? 'up' : 
             avgRecent.responseTime < avgOlder.responseTime * 0.9 ? 'down' : 'stable',
      change: ((avgRecent.responseTime - avgOlder.responseTime) / avgOlder.responseTime) * 100,
    },
    throughput: {
      trend: avgRecent.throughput > avgOlder.throughput * 1.1 ? 'up' : 
             avgRecent.throughput < avgOlder.throughput * 0.9 ? 'down' : 'stable',
      change: ((avgRecent.throughput - avgOlder.throughput) / avgOlder.throughput) * 100,
    },
    errorRate: {
      trend: avgRecent.errorRate > avgOlder.errorRate * 1.1 ? 'up' : 
             avgRecent.errorRate < avgOlder.errorRate * 0.9 ? 'down' : 'stable',
      change: ((avgRecent.errorRate - avgOlder.errorRate) / Math.max(avgOlder.errorRate, 0.001)) * 100,
    },
  };
}

async function getSystemHealthScore(metrics: any[]): Promise<{
  score: number;
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  factors: Record<string, number>;
}> {
  if (metrics.length === 0) {
    return {
      score: 50,
      status: 'fair',
      factors: { noData: 0 }
    };
  }

  const latest = metrics[metrics.length - 1];
  const factors = {
    responseTime: Math.max(0, 100 - (latest.metrics.responseTimeMs / 100)), // 100ms = 0 points
    successRate: latest.metrics.successRate * 100,
    throughput: Math.min(100, latest.metrics.throughputPerSecond * 10), // 10 req/s = 100 points
    stability: metrics.length >= 5 ? calculateStability(metrics.slice(-5)) : 50,
  };

  const score = Object.values(factors).reduce((sum, val) => sum + val, 0) / Object.keys(factors).length;
  
  const status = 
    score >= 90 ? 'excellent' :
    score >= 75 ? 'good' :
    score >= 60 ? 'fair' :
    score >= 40 ? 'poor' : 'critical';

  return { score: Math.round(score), status, factors };
}

function calculateStability(metrics: any[]): number {
  const responseTimes = metrics.map(m => m.metrics.responseTimeMs);
  const mean = responseTimes.reduce((sum, val) => sum + val, 0) / responseTimes.length;
  const variance = responseTimes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / responseTimes.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = stdDev / mean;
  
  // Lower coefficient of variation = higher stability
  return Math.max(0, 100 - (coefficientOfVariation * 100));
}

function identifyBottlenecks(metrics: any[]): Array<{
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  impact: string;
}> {
  const bottlenecks: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    impact: string;
  }> = [];
  
  if (metrics.length === 0) return bottlenecks;

  const latest = metrics[metrics.length - 1];
  
  // High response time
  if (latest.metrics.responseTimeMs > 5000) {
    bottlenecks.push({
      type: 'response_time',
      severity: 'high',
      description: `Response time is ${latest.metrics.responseTimeMs}ms, exceeding 5000ms threshold`,
      impact: 'User experience degradation and potential timeouts'
    });
  }

  // Low throughput
  if (latest.metrics.throughputPerSecond < 1) {
    bottlenecks.push({
      type: 'throughput',
      severity: 'medium',
      description: `Low throughput of ${latest.metrics.throughputPerSecond.toFixed(2)} requests/second`,
      impact: 'Reduced system capacity and potential request queuing'
    });
  }

  // High error rate
  if (latest.metrics.errorRate > 0.1) {
    bottlenecks.push({
      type: 'error_rate',
      severity: latest.metrics.errorRate > 0.3 ? 'high' : 'medium',
      description: `Error rate is ${(latest.metrics.errorRate * 100).toFixed(1)}%`,
      impact: 'System reliability issues and failed operations'
    });
  }

  return bottlenecks;
}

function generatePerformanceRecommendations(metrics: any[], stats: any): string[] {
  const recommendations: string[] = [];
  
  if (metrics.length === 0) {
    recommendations.push("Enable performance monitoring to get actionable insights");
    return recommendations;
  }

  const latest = metrics[metrics.length - 1];
  
  if (latest.metrics.responseTimeMs > 3000) {
    recommendations.push("Consider implementing request caching to reduce response times");
    recommendations.push("Review database query optimization and connection pooling");
  }

  if (latest.metrics.errorRate > 0.05) {
    recommendations.push("Investigate error patterns and implement better error handling");
    recommendations.push("Consider implementing circuit breaker pattern for external API calls");
  }

  if (latest.metrics.throughputPerSecond < 5) {
    recommendations.push("Consider scaling up server resources or implementing load balancing");
    recommendations.push("Review code for potential performance bottlenecks");
  }

  if (stats.averageEventSize > 10000) {
    recommendations.push("Consider compressing large event payloads to reduce memory usage");
  }

  if (recommendations.length === 0) {
    recommendations.push("System performance looks good! Continue monitoring for any trends");
  }

  return recommendations;
}

function convertToCSV(data: any): string {
  const headers = ['Timestamp', 'Operation', 'Response Time (ms)', 'Throughput (req/s)', 'Error Rate (%)', 'Success Rate (%)'];
  const rows = [headers.join(',')];
  
  if (data.metrics.historical) {
    for (const metric of data.metrics.historical) {
      rows.push([
        metric.timestamp,
        metric.operation,
        metric.metrics.responseTimeMs.toString(),
        metric.metrics.throughputPerSecond.toFixed(2),
        (metric.metrics.errorRate * 100).toFixed(2),
        (metric.metrics.successRate * 100).toFixed(2),
      ].join(','));
    }
  }
  
  return rows.join('\n');
}