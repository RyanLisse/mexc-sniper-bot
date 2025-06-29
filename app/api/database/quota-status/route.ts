/**
 * Database Quota Status & Emergency Management API
 * 
 * This endpoint provides real-time quota monitoring and emergency
 * management capabilities for the database connection pool.
 * 
 * Features:
 * - Real-time quota metrics and alerts
 * - Emergency mode status and controls
 * - Performance recommendations
 * - Quota reset capabilities
 */

import { NextRequest, NextResponse } from "next/server";
import { databaseConnectionPool } from "@/src/lib/database-connection-pool";
import { databaseQuotaMonitor } from "@/src/lib/database-quota-monitor";

interface QuotaStatusResponse {
  status: "healthy" | "warning" | "critical" | "emergency";
  timestamp: string;
  metrics: {
    quotaUtilization: number;
    dataTransferMB: number;
    connectionsActive: number;
    connectionsMax: number;
    cacheHitRate: number;
    avgQueryTime: number;
    requestsThrottled: number;
    batchedRequests: number;
    deduplicatedQueries: number;
  };
  alerts: Array<{
    level: string;
    message: string;
    timestamp: string;
    recommendations: string[];
  }>;
  emergencyMode: {
    active: boolean;
    actionsImplemented: Array<{
      type: string;
      description: string;
      severity: number;
      timestamp: string;
    }>;
  };
  recommendations: string[];
  configuration: {
    maxConnections: number;
    cacheTTL: string;
    quotaLimit: string;
    batchingEnabled: boolean;
    deduplicationEnabled: boolean;
  };
  optimizationSuggestions: string[];
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Get quota status from monitor
    const quotaStatus = databaseQuotaMonitor.getQuotaStatus();
    
    // Get connection pool metrics
    const connectionMetrics = databaseConnectionPool.getConnectionMetrics();
    const cacheMetrics = databaseConnectionPool.getCacheMetrics();
    
    // Determine overall status
    let status: "healthy" | "warning" | "critical" | "emergency" = "healthy";
    if (quotaStatus.metrics.emergencyMode) {
      status = "emergency";
    } else if (quotaStatus.metrics.quotaUtilization > 90) {
      status = "critical";
    } else if (quotaStatus.metrics.quotaUtilization > 70) {
      status = "warning";
    }

    // Generate optimization suggestions
    const optimizationSuggestions = generateOptimizationSuggestions(
      quotaStatus.metrics,
      connectionMetrics,
      cacheMetrics
    );

    const response: QuotaStatusResponse = {
      status,
      timestamp: new Date().toISOString(),
      metrics: {
        quotaUtilization: quotaStatus.metrics.quotaUtilization,
        dataTransferMB: quotaStatus.metrics.dataTransferMB,
        connectionsActive: connectionMetrics.activeConnections,
        connectionsMax: 8, // Current max from connection pool
        cacheHitRate: (cacheMetrics.totalHits / Math.max(cacheMetrics.totalHits + cacheMetrics.totalMisses, 1)) * 100,
        avgQueryTime: connectionMetrics.averageConnectionTime,
        requestsThrottled: 0, // Would need to be tracked
        batchedRequests: connectionMetrics.batchedRequests,
        deduplicatedQueries: connectionMetrics.deduplicatedQueries,
      },
      alerts: quotaStatus.alerts.map(alert => ({
        level: alert.level,
        message: alert.message,
        timestamp: new Date(alert.timestamp).toISOString(),
        recommendations: alert.recommendations,
      })),
      emergencyMode: {
        active: quotaStatus.metrics.emergencyMode,
        actionsImplemented: quotaStatus.emergencyActions.map(action => ({
          type: action.type,
          description: action.description,
          severity: action.severity,
          timestamp: new Date(action.timestamp).toISOString(),
        })),
      },
      recommendations: quotaStatus.recommendations,
      configuration: {
        maxConnections: 8,
        cacheTTL: "30 minutes",
        quotaLimit: "100MB/5min",
        batchingEnabled: true,
        deduplicationEnabled: true,
      },
      optimizationSuggestions,
    };

    return NextResponse.json({
      success: true,
      data: response,
    });

  } catch (error) {
    console.error("Failed to get quota status:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to retrieve quota status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { action, force } = body;

    let result: any = {};

    switch (action) {
      case "emergency_stop":
        // Force emergency mode activation
        databaseQuotaMonitor.updateMetrics({ quotaUtilization: 95 });
        result = { message: "Emergency mode activated" };
        break;

      case "reset_quota":
        // Reset quota tracking (for testing/emergency recovery)
        if (force) {
          databaseQuotaMonitor.forceQuotaReset();
          result = { message: "Quota metrics reset successfully" };
        } else {
          return NextResponse.json(
            { success: false, error: "Force flag required for quota reset" },
            { status: 400 }
          );
        }
        break;

      case "optimize_aggressive":
        // Apply even more aggressive optimizations
        databaseConnectionPool.updateConfig({
          maxConnections: 4, // Further reduce connections
          cacheTTLMs: 3600000, // Extend cache to 1 hour
          maxDataTransferMB: 50, // Reduce quota limit
          maxBatchSize: 100, // Increase batch size
          batchWindowMs: 200, // Increase batch window
        });
        result = { message: "Aggressive optimizations applied" };
        break;

      case "emergency_cache_extend":
        // Extend cache TTL for emergency quota protection
        databaseConnectionPool.updateConfig({
          cacheTTLMs: 7200000, // 2 hours
        });
        result = { message: "Emergency cache extension applied" };
        break;

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action specified" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      result,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Failed to execute quota management action:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to execute action",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Generate optimization suggestions based on current metrics
 */
function generateOptimizationSuggestions(
  quotaMetrics: any,
  connectionMetrics: any,
  cacheMetrics: any
): string[] {
  const suggestions: string[] = [];

  // Quota-based suggestions
  if (quotaMetrics.quotaUtilization > 80) {
    suggestions.push("🚨 CRITICAL: Reduce max connections to emergency level (4 or fewer)");
    suggestions.push("🚨 CRITICAL: Extend cache TTL to 2+ hours");
    suggestions.push("🚨 CRITICAL: Enable aggressive request batching");
    suggestions.push("🚨 CRITICAL: Implement query result compression");
  } else if (quotaMetrics.quotaUtilization > 60) {
    suggestions.push("⚠️ HIGH: Consider reducing connection pool size");
    suggestions.push("⚠️ HIGH: Optimize query patterns for better caching");
    suggestions.push("⚠️ HIGH: Implement query deduplication if not active");
  }

  // Connection-based suggestions
  if (connectionMetrics.activeConnections > 6) {
    suggestions.push("🔌 Reduce max connections - current usage too high for quota efficiency");
  }

  // Cache-based suggestions
  const hitRate = (cacheMetrics.totalHits / Math.max(cacheMetrics.totalHits + cacheMetrics.totalMisses, 1)) * 100;
  if (hitRate < 70) {
    suggestions.push("💾 Improve cache hit rate by extending TTL or optimizing cache keys");
    suggestions.push("💾 Implement more granular caching for frequently accessed data");
  }

  // Performance-based suggestions
  if (connectionMetrics.averageConnectionTime > 2000) {
    suggestions.push("⚡ Optimize slow queries - average response time too high");
    suggestions.push("⚡ Consider implementing query result pagination");
    suggestions.push("⚡ Review and optimize database indexes");
  }

  // Emergency suggestions
  if (quotaMetrics.emergencyMode) {
    suggestions.push("🚨 EMERGENCY: Consider implementing manual query approval");
    suggestions.push("🚨 EMERGENCY: Disable all non-critical background operations");
    suggestions.push("🚨 EMERGENCY: Implement connection queueing with longer delays");
  }

  // General optimization suggestions
  suggestions.push("📊 Monitor quota usage patterns to identify peak usage times");
  suggestions.push("🔧 Consider implementing lazy loading for large datasets");
  suggestions.push("🎯 Focus optimization efforts on highest-frequency operations");

  return suggestions;
}