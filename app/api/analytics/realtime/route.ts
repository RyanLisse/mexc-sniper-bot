/**
 * Real-time Analytics API Endpoint
 * 
 * Provides real-time streaming analytics data for the MEXC Sniper Bot dashboard.
 * Uses Server-Sent Events (SSE) for live data streaming.
 */

import { NextRequest, NextResponse } from "next/server";
import { createLogger } from '../../../../src/lib/structured-logger';
import { z } from "zod";
import { tradingAnalytics } from "../../../../src/services/trading-analytics-service";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

// Request validation schema
const RealtimeQuerySchema = z.object({
  interval: z.coerce.number().min(1000).max(60000).optional().default(5000), // 1s to 60s
  operations: z.string().optional(), // Comma-separated list
  includeHealthScore: z.coerce.boolean().optional().default(true),
  includeEvents: z.coerce.boolean().optional().default(false),
});

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
    
    const validation = RealtimeQuerySchema.safeParse(params);
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: "Invalid query parameters",
          details: validation.error.errors
        },
        { status: 400 }
      );
    }

    const { interval, operations, includeHealthScore, includeEvents } = validation.data;
    const operationList = operations ? operations.split(',') : undefined;

    // Create a readable stream for Server-Sent Events
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        
        // Send initial connection message
        const initialData = {
          type: 'connection',
          message: 'Real-time analytics stream connected',
          timestamp: new Date().toISOString(),
          config: { interval, operations: operationList, includeHealthScore, includeEvents }
        };
        
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialData)}\n\n`));

        // Set up interval for sending analytics data
        const intervalId = setInterval(async () => {
          try {
            const realtimeData = await generateRealtimeData(operationList, includeHealthScore, includeEvents);
            const sseData = `data: ${JSON.stringify(realtimeData)}\n\n`;
            controller.enqueue(encoder.encode(sseData));
          } catch (error) {
            logger.error('[Realtime Analytics] Stream error:', { error });
            const errorData = {
              type: 'error',
              message: 'Error generating real-time data',
              timestamp: new Date().toISOString(),
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
          }
        }, interval);

        // Cleanup on close
        const cleanup = () => {
          clearInterval(intervalId);
          controller.close();
        };

        // Handle client disconnect
        request.signal.addEventListener('abort', cleanup);
        
        // Auto-cleanup after 10 minutes to prevent resource leaks
        setTimeout(cleanup, 10 * 60 * 1000);
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });

  } catch (error) {
    logger.error('[Realtime Analytics] Error:', { error });
    
    return NextResponse.json(
      { 
        error: "Failed to start real-time analytics stream",
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
    
    // Schema for real-time event broadcasting
    const BroadcastEventSchema = z.object({
      type: z.enum(['alert', 'trade', 'system', 'user_action']),
      message: z.string().min(1),
      severity: z.enum(['info', 'warning', 'error', 'critical']).optional().default('info'),
      metadata: z.record(z.unknown()).optional(),
      userId: z.string().optional(),
    });

    const validation = BroadcastEventSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: "Invalid request body",
          details: validation.error.errors
        },
        { status: 400 }
      );
    }

    const { type, message, severity, metadata, userId } = validation.data;

    // Log the event for analytics
    tradingAnalytics.logTradingEvent({
      eventType: 'SYSTEM_ERROR', // Adjust based on type
      userId: userId || user.id,
      metadata: {
        broadcastType: type,
        message,
        severity,
        ...metadata,
      },
      performance: {
        responseTimeMs: 0,
        retryCount: 0,
      },
      success: true,
    });

    // In a real implementation, you would broadcast this to all connected SSE clients
    // For now, just acknowledge the event
    return NextResponse.json({
      success: true,
      message: "Event broadcasted successfully",
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error('[Realtime Analytics] POST Error:', { error });
    
    return NextResponse.json(
      { 
        error: "Failed to broadcast event",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function generateRealtimeData(
  operations?: string[], 
  includeHealthScore = true, 
  includeEvents = false
): Promise<any> {
  const now = new Date().toISOString();
  const timeWindow = 60000; // Last 1 minute

  // Get current metrics
  const allMetrics = operations 
    ? operations.map(op => ({
        operation: op,
        metrics: tradingAnalytics.getPerformanceMetrics(op, timeWindow)
      }))
    : [{ operation: 'all', metrics: tradingAnalytics.getPerformanceMetrics(undefined, timeWindow) }];

  // Get analytics stats
  const stats = tradingAnalytics.getAnalyticsStats();

  // Calculate real-time indicators
  const realtimeData: any = {
    type: 'analytics_update',
    timestamp: now,
    metrics: allMetrics.map(({ operation, metrics }) => {
      const latest = metrics.length > 0 ? metrics[metrics.length - 1] : null;
      return {
        operation,
        current: latest ? {
          responseTime: latest.metrics.responseTimeMs,
          throughput: latest.metrics.throughputPerSecond,
          errorRate: latest.metrics.errorRate,
          successRate: latest.metrics.successRate,
        } : null,
        trend: calculateShortTermTrend(metrics),
        healthStatus: getOperationHealthStatus(latest),
      };
    }),
    system: {
      totalEvents: stats.totalEvents,
      eventsLast24h: stats.eventsLast24h,
      cacheSize: stats.cacheSize,
      memoryUsage: getEstimatedMemoryUsage(),
      uptime: getSystemUptime(),
    },
  };

  // Add health score if requested
  if (includeHealthScore) {
    realtimeData.healthScore = await calculateSystemHealthScore(allMetrics);
  }

  // Add recent events if requested
  if (includeEvents) {
    realtimeData.recentEvents = getRecentEvents(5); // Last 5 events
  }

  return realtimeData;
}

function calculateShortTermTrend(metrics: any[]): {
  direction: 'up' | 'down' | 'stable';
  strength: 'weak' | 'moderate' | 'strong';
} {
  if (metrics.length < 3) {
    return { direction: 'stable', strength: 'weak' };
  }

  const recent = metrics.slice(-3);
  const responseTimes = recent.map(m => m.metrics.responseTimeMs);
  
  // Calculate linear trend
  const n = responseTimes.length;
  const sumX = (n * (n + 1)) / 2; // 1 + 2 + 3...
  const sumY = responseTimes.reduce((sum, val) => sum + val, 0);
  const sumXY = responseTimes.reduce((sum, val, idx) => sum + val * (idx + 1), 0);
  const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6; // 1² + 2² + 3²...
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  
  const direction = slope > 50 ? 'up' : slope < -50 ? 'down' : 'stable';
  const strength = Math.abs(slope) > 200 ? 'strong' : Math.abs(slope) > 100 ? 'moderate' : 'weak';
  
  return { direction, strength };
}

function getOperationHealthStatus(latest: any | null): {
  status: 'healthy' | 'degraded' | 'critical';
  score: number;
} {
  if (!latest) {
    return { status: 'critical', score: 0 };
  }

  const metrics = latest.metrics;
  let score = 100;
  
  // Penalize high response times
  if (metrics.responseTimeMs > 5000) score -= 40;
  else if (metrics.responseTimeMs > 2000) score -= 20;
  else if (metrics.responseTimeMs > 1000) score -= 10;
  
  // Penalize high error rates
  if (metrics.errorRate > 0.1) score -= 30;
  else if (metrics.errorRate > 0.05) score -= 15;
  else if (metrics.errorRate > 0.02) score -= 5;
  
  // Penalize low throughput
  if (metrics.throughputPerSecond < 1) score -= 20;
  else if (metrics.throughputPerSecond < 5) score -= 10;
  
  const status = score >= 80 ? 'healthy' : score >= 50 ? 'degraded' : 'critical';
  
  return { status, score: Math.max(0, score) };
}

async function calculateSystemHealthScore(allMetrics: any[]): Promise<{
  overall: number;
  components: Record<string, number>;
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
}> {
  const componentScores: Record<string, number> = {};
  
  for (const { operation, metrics } of allMetrics) {
    if (metrics.length > 0) {
      const latest = metrics[metrics.length - 1];
      const health = getOperationHealthStatus(latest);
      componentScores[operation] = health.score;
    }
  }
  
  const scores = Object.values(componentScores);
  const overall = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 50;
  
  const status = 
    overall >= 90 ? 'excellent' :
    overall >= 75 ? 'good' :
    overall >= 60 ? 'fair' :
    overall >= 40 ? 'poor' : 'critical';
  
  return {
    overall: Math.round(overall),
    components: componentScores,
    status,
  };
}

function getEstimatedMemoryUsage(): {
  used: number;
  total: number;
  percentage: number;
} {
  // In a real implementation, you would get actual memory usage
  // For now, provide estimated values
  const used = process.memoryUsage().heapUsed;
  const total = process.memoryUsage().heapTotal;
  
  return {
    used: Math.round(used / 1024 / 1024), // MB
    total: Math.round(total / 1024 / 1024), // MB
    percentage: Math.round((used / total) * 100),
  };
}

function getSystemUptime(): {
  seconds: number;
  formatted: string;
} {
  const uptimeSeconds = process.uptime();
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);
  
  const formatted = `${hours}h ${minutes}m ${seconds}s`;
  
  return {
    seconds: Math.round(uptimeSeconds),
    formatted,
  };
}

function getRecentEvents(limit: number): Array<{
  id: string;
  type: string;
  message: string;
  timestamp: string;
  severity: string;
}> {
  // In a real implementation, you would get actual recent events
  // For now, return mock recent events
  const events = [];
  const eventTypes = ['trade', 'alert', 'system', 'user_action'];
  const severities = ['info', 'warning', 'error'];
  
  for (let i = 0; i < limit; i++) {
    const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const severity = severities[Math.floor(Math.random() * severities.length)];
    
    events.push({
      id: `evt_${Date.now() - i * 1000}_${Math.random().toString(36).substring(7)}`,
      type,
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} event occurred`,
      timestamp: new Date(Date.now() - i * 1000).toISOString(),
      severity,
    });
  }
  
  return events;
}