import { NextResponse } from "next/server";
import {
  apiResponse,
  createSuccessResponse,
  HTTP_STATUS,
} from "@/src/lib/api-response";
import { getCoreTrading } from "@/src/services/trading/consolidated/core-trading/base-service";

const coreTrading = getCoreTrading();

export async function GET() {
  try {
    console.info("[API] Auto-sniping status request received");

    // Get current execution report which includes unified status
    let report;
    try {
      report = await coreTrading.getExtendedServiceStatus();
    } catch (error) {
      // If service is not initialized, initialize it first
      if (error instanceof Error && error.message.includes("not initialized")) {
        console.info(
          "[API] Core trading service not initialized, initializing..."
        );
        await coreTrading.initialize();
        report = await coreTrading.getExtendedServiceStatus();
      } else {
        throw error;
      }
    }

    // Structure the status response to match frontend expectations
    const statusData = {
      enabled: true, // Auto-sniping is always enabled
      status: report.status || "idle",
      isActive: report.status === "active",
      isIdle: report.status === "idle",

      // Enhanced target count information
      activeTargets: report.targetCounts?.unified || report.activeTargets || 0,
      readyTargets: report.readyTargets || 0,
      targetCounts: report.targetCounts || {
        memory: 0,
        database: 0,
        unified: 0,
        isConsistent: true,
        source: "consistent",
      },

      // State consistency information
      stateConsistency: report.stateConsistency || {
        isConsistent: true,
        inconsistencies: [],
        recommendedActions: [],
        lastSyncTime: "Never",
      },

      // Frontend-expected fields
      executedToday: report.executedToday || 0,
      successRate: report.successRate || 0,
      totalProfit: report.totalProfit || 0,
      lastExecution: report.lastExecution || new Date().toISOString(),
      safetyStatus: report.safetyStatus || "safe",
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
        isHealthy: report.stateConsistency?.isConsistent ?? true,
        lastHealthCheck: new Date().toISOString(),
        memoryUsage: process.memoryUsage().heapUsed,
        stateConsistency: report.stateConsistency?.isConsistent ?? true,
        targetCountWarning: report.targetCounts?.warning,
      },
    };

    console.info("[API] Auto-sniping status retrieved successfully:", {
      status: statusData.status,
      isActive: statusData.isActive,
      activeTargets: statusData.activeTargets,
      targetConsistency: statusData.stateConsistency.isConsistent,
      executionCount: statusData.executionCount,
    });

    return apiResponse(
      createSuccessResponse(statusData, {
        message: "Auto-sniping status retrieved successfully",
        timestamp: new Date().toISOString(),
      }),
      HTTP_STATUS.OK
    );
  } catch (error) {
    console.error("[API] Auto-sniping status error:", { error });

    // Return fallback status data on error
    return apiResponse(
      createSuccessResponse(
        {
          enabled: true,
          status: "idle",
          isActive: false,
          isIdle: true,

          // Frontend-expected fields with fallback values
          activeTargets: 0,
          readyTargets: 0,
          targetCounts: {
            memory: 0,
            database: 0,
            unified: 0,
            isConsistent: false,
            source: "memory",
            warning: "Service unavailable - using fallback values",
          },
          stateConsistency: {
            isConsistent: false,
            inconsistencies: [
              "Service error - cannot verify state consistency",
            ],
            recommendedActions: [
              "Check service health and restart if necessary",
            ],
            lastSyncTime: "Never",
          },
          executedToday: 0,
          successRate: 0,
          totalProfit: 0,
          lastExecution: new Date().toISOString(),
          safetyStatus: "safe",
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
            stateConsistency: false,
            targetCountWarning: "Service error",
            error: error instanceof Error ? error.message : "Unknown error",
          },
        },
        {
          message: "Auto-sniping status retrieved with fallback data",
          warning: "Service health check failed - using default values",
          timestamp: new Date().toISOString(),
        }
      ),
      HTTP_STATUS.OK
    );
  }
}

// For testing purposes, allow OPTIONS
export async function OPTIONS() {
  return NextResponse.json(
    createSuccessResponse(null, { message: "CORS preflight request" }),
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    }
  );
}
