import { NextResponse } from "next/server";
import { OptimizedAutoSnipingCore } from "../../../../src/services/optimized-auto-sniping-core";
import { 
  createSuccessResponse, 
  createErrorResponse, 
  apiResponse, 
  HTTP_STATUS 
} from "../../../../src/lib/api-response";
import { handleApiError } from "../../../../src/lib/error-handler";

const autoSnipingService = OptimizedAutoSnipingCore.getInstance();

export async function GET() {
  try {
    console.info('[API] Auto-sniping status request received');
    
    // Get current execution report which includes status
    const report = await autoSnipingService.getExecutionReport();
    
    // Structure the status response to match frontend expectations
    const statusData = {
      enabled: true, // Auto-sniping is always enabled
      status: report.status || 'idle',
      isActive: report.status === 'active',
      isIdle: report.status === 'idle',
      
      // Frontend-expected fields
      activeTargets: report.activeTargets || 0,
      readyTargets: report.readyTargets || 0,
      executedToday: report.executedToday || 0,
      successRate: report.successRate || 0,
      totalProfit: report.totalProfit || 0,
      lastExecution: report.lastExecution || new Date().toISOString(),
      safetyStatus: report.safetyStatus || 'safe',
      patternDetectionActive: report.patternDetectionActive ?? true,
      
      // Legacy fields for backward compatibility
      executionCount: report.executionCount || 0,
      successCount: report.successCount || 0,
      errorCount: report.errorCount || 0,
      uptime: report.uptime || 0,
      config: {
        maxConcurrentTargets: report.config?.maxConcurrentTargets || 5,
        retryAttempts: report.config?.retryAttempts || 3,
        executionDelay: report.config?.executionDelay || 1000,
      },
      health: {
        isHealthy: true,
        lastHealthCheck: new Date().toISOString(),
        memoryUsage: process.memoryUsage().heapUsed,
      }
    };
    
    console.info('[API] Auto-sniping status retrieved successfully:', {
      status: statusData.status,
      isActive: statusData.isActive,
      executionCount: statusData.executionCount
    });
    
    return apiResponse(
      createSuccessResponse(statusData, {
        message: "Auto-sniping status retrieved successfully",
        timestamp: new Date().toISOString()
      }),
      HTTP_STATUS.OK
    );
  } catch (error) {
    console.error('[API] Auto-sniping status error:', { error });
    
    // Return fallback status data on error
    return apiResponse(
      createSuccessResponse({
        enabled: true,
        status: 'idle',
        isActive: false,
        isIdle: true,
        
        // Frontend-expected fields with fallback values
        activeTargets: 0,
        readyTargets: 0,
        executedToday: 0,
        successRate: 0,
        totalProfit: 0,
        lastExecution: new Date().toISOString(),
        safetyStatus: 'safe',
        patternDetectionActive: true,
        
        // Legacy fields for backward compatibility
        executionCount: 0,
        successCount: 0,
        errorCount: 0,
        uptime: 0,
        config: {
          maxConcurrentTargets: 5,
          retryAttempts: 3,
          executionDelay: 1000,
        },
        health: {
          isHealthy: false,
          lastHealthCheck: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }, {
        message: "Auto-sniping status retrieved with fallback data",
        warning: "Service health check failed - using default values",
        timestamp: new Date().toISOString()
      }),
      HTTP_STATUS.OK
    );
  }
}

// For testing purposes, allow OPTIONS
export async function OPTIONS() {
  return NextResponse.json(
    createSuccessResponse(null, { message: 'CORS preflight request' }), 
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
}