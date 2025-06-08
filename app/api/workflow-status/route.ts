import { NextRequest, NextResponse } from "next/server";
import { WorkflowStatusService } from "@/src/services/workflow-status-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "default";
    
    const statusService = new WorkflowStatusService(userId);
    const workflowStatus = await statusService.getFullStatus();
    
    return NextResponse.json(workflowStatus);
  } catch (error) {
    console.error("Failed to get workflow status:", error);
    return NextResponse.json(
      {
        error: "Failed to get workflow status",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
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
          throw new Error("Metrics data required for updateMetrics action");
        }
        break;

      case "addActivity":
        if (data?.activity) {
          await statusService.addActivity(data.activity);
          updatedStatus = await statusService.getOrCreateSystemStatus();
        } else {
          throw new Error("Activity data required for addActivity action");
        }
        break;

      case "addWorkflow":
        if (data?.workflowId) {
          updatedStatus = await statusService.updateActiveWorkflows("add", data.workflowId);
        } else {
          throw new Error("Workflow ID required for addWorkflow action");
        }
        break;

      case "removeWorkflow":
        if (data?.workflowId) {
          updatedStatus = await statusService.updateActiveWorkflows("remove", data.workflowId);
        } else {
          throw new Error("Workflow ID required for removeWorkflow action");
        }
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Get full status for response
    const fullStatus = await statusService.getFullStatus();

    return NextResponse.json({
      success: true,
      status: fullStatus,
      message: `Action '${action}' completed successfully`
    });
  } catch (error) {
    console.error("Failed to update workflow status:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update workflow status",
        message: "Workflow status update failed"
      },
      { status: 500 }
    );
  }
}