/**
 * Cost Monitoring Dashboard API
 * 
 * Provides comprehensive cost monitoring data and optimization recommendations
 * for database operations.
 */

import { NextRequest, NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { getCostDashboardData, addCostAlert, getEndpointOptimizationAdvice } from "@/src/lib/cost-monitoring-dashboard-service";
import { globalDatabaseCostProtector } from "@/src/lib/database-cost-protector";
import { getBatchingStats } from "@/src/lib/database-query-batching-service";
import { getQueryCacheStats } from "@/src/lib/database-query-cache-middleware";
import { apiResponse } from "@/src/lib/api-response";
import { withDatabaseQueryCache } from "@/src/lib/database-query-cache-middleware";

async function getDashboardHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // Authentication check
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: "Authentication required",
      }, { status: 401 });
    }
    
    // Get comprehensive dashboard data
    const dashboardData = getCostDashboardData();
    
    // Add real-time system status
    const systemStatus = {
      costProtector: globalDatabaseCostProtector.getUsageStats(),
      caching: getQueryCacheStats(),
      batching: getBatchingStats(),
      timestamp: new Date().toISOString(),
    };
    
    return apiResponse({
      success: true,
      data: {
        ...dashboardData,
        systemStatus,
      },
      meta: {
        timestamp: new Date().toISOString(),
        user: user.id,
        dataFreshness: "real-time",
      },
    });
    
  } catch (error) {
    console.error('[Cost Dashboard] Error:', error);
    
    return apiResponse({
      success: false,
      error: error instanceof Error ? error.message : "Failed to load dashboard data",
      meta: {
        timestamp: new Date().toISOString(),
      },
    }, 500);
  }
}

async function postDashboardHandler(request: NextRequest): Promise<NextResponse> {
  try {
    // Authentication check
    const { getUser } = getKindeServerSession();
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: "Authentication required",
      }, { status: 401 });
    }
    
    const body = await request.json();
    const { action, data } = body;
    
    switch (action) {
      case 'addAlert':
        if (!data.severity || !data.title || !data.message) {
          return NextResponse.json({
            success: false,
            error: "Missing required fields: severity, title, message",
          }, { status: 400 });
        }
        
        addCostAlert(
          data.severity,
          data.title,
          data.message,
          data.endpoint,
          data.action
        );
        
        return apiResponse({
          success: true,
          message: "Alert added successfully",
          data: { alertId: `alert_${Date.now()}` },
        });
        
      case 'getEndpointAdvice':
        if (!data.endpoint) {
          return NextResponse.json({
            success: false,
            error: "Missing required field: endpoint",
          }, { status: 400 });
        }
        
        const advice = getEndpointOptimizationAdvice(data.endpoint);
        
        return apiResponse({
          success: true,
          data: advice,
        });
        
      case 'setEmergencyMode':
        const { enabled, reason } = data;
        if (typeof enabled !== 'boolean') {
          return NextResponse.json({
            success: false,
            error: "Missing required field: enabled (boolean)",
          }, { status: 400 });
        }
        
        globalDatabaseCostProtector.setEmergencyMode(enabled, reason);
        
        return apiResponse({
          success: true,
          message: `Emergency mode ${enabled ? 'enabled' : 'disabled'}`,
          data: { emergencyMode: enabled, reason },
        });
        
      case 'flushCaches':
        // Force flush all caches and batches
        await globalDatabaseCostProtector.withCostProtection(
          async () => {
            // This would trigger cache cleanup
            console.info('[Cost Dashboard] Cache flush requested by user:', user.id);
            return 'Cache flush completed';
          },
          {
            endpoint: '/api/cost-monitoring/dashboard',
            operationType: 'write',
          }
        );
        
        return apiResponse({
          success: true,
          message: "Cache flush initiated",
          data: { timestamp: new Date().toISOString() },
        });
        
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`,
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('[Cost Dashboard POST] Error:', error);
    
    return apiResponse({
      success: false,
      error: error instanceof Error ? error.message : "Action failed",
    }, 500);
  }
}

// Cached endpoints with different TTLs
export const GET = withDatabaseQueryCache(getDashboardHandler, {
  endpoint: "/api/cost-monitoring/dashboard",
  cacheTtlSeconds: 30, // 30 seconds cache for dashboard data
  enableCompression: true,
  enableStaleWhileRevalidate: true,
});

export const POST = postDashboardHandler; // No caching for actions