import { NextRequest, NextResponse } from "next/server";
import { WorkflowStatusService } from "../../../src/services/workflow-status-service";
import { 
  createSuccessResponse, 
  createErrorResponse, 
  apiResponse, 
  HTTP_STATUS,
  createValidationErrorResponse
} from "../../../src/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "default";
    
    const statusService = new WorkflowStatusService(userId);
    const workflowStatus = await statusService.getFullStatus();
    
    return apiResponse(
      createSuccessResponse(workflowStatus)
    );
  } catch (error) {
    console.error("Failed to get workflow status:", error);
    
    // Return a fallback status when database is unavailable
    const fallbackStatus = {
      systemStatus: "error",
      lastUpdate: new Date().toISOString(),
      activeWorkflows: [],
      metrics: {
        readyTokens: 0,
        totalDetections: 0,
        successfulSnipes: 0,
        totalProfit: 0,
        successRate: 0,
        averageROI: 0,
        bestTrade: 0,
      },
      recentActivity: [
        {
          id: "error",
          type: "analysis",
          message: "Database connection issue - using fallback mode",
          timestamp: new Date().toISOString(),
          level: "error",
        }
      ],
    };
    
    return apiResponse(
      createErrorResponse("Database connection issue - using fallback mode", {
        fallbackData: fallbackStatus
      }),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data, userId = "default" } = body;

    const statusService = new WorkflowStatusService(userId);
    let updatedStatus;

    switch (action) {
      case "start":
        updatedStatus = await statusService.updateSystemStatus("running");
        await statusService.addActivity({
          type: "analysis",
          message: "System started - monitoring active",
          level: "success"
        });
        break;

      case "stop":
        updatedStatus = await statusService.updateSystemStatus("stopped");
        await statusService.addActivity({
          type: "analysis",
          message: "System stopped",
          level: "info"
        });
        break;

      case "updateMetrics":
        if (data?.metrics) {
          updatedStatus = await statusService.updateMetrics(data.metrics);
        } else {
          return apiResponse(
            createValidationErrorResponse('metrics', 'Metrics data required for updateMetrics action'),
            HTTP_STATUS.BAD_REQUEST
          );
        }
        break;

      case "addActivity":
        if (data?.activity) {
          await statusService.addActivity(data.activity);
          updatedStatus = await statusService.getOrCreateSystemStatus();
        } else {
          return apiResponse(
            createValidationErrorResponse('activity', 'Activity data required for addActivity action'),
            HTTP_STATUS.BAD_REQUEST
          );
        }
        break;

      case "addWorkflow":
        if (data?.workflowId) {
          updatedStatus = await statusService.updateActiveWorkflows("add", data.workflowId);
        } else {
          return apiResponse(
            createValidationErrorResponse('workflowId', 'Workflow ID required for addWorkflow action'),
            HTTP_STATUS.BAD_REQUEST
          );
        }
        break;

      case "removeWorkflow":
        if (data?.workflowId) {
          updatedStatus = await statusService.updateActiveWorkflows("remove", data.workflowId);
        } else {
          return apiResponse(
            createValidationErrorResponse('workflowId', 'Workflow ID required for removeWorkflow action'),
            HTTP_STATUS.BAD_REQUEST
          );
        }
        break;

      default:
        return apiResponse(
          createValidationErrorResponse('action', `Unknown action: ${action}`),
          HTTP_STATUS.BAD_REQUEST
        );
    }

    // Get full status for response
    const fullStatus = await statusService.getFullStatus();

    return apiResponse(
      createSuccessResponse(fullStatus, {
        message: `Action '${action}' completed successfully`
      })
    );
  } catch (error) {
    console.error("Failed to update workflow status:", error);
    return apiResponse(
      createErrorResponse(
        error instanceof Error ? error.message : "Unknown error occurred"
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}