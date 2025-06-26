import { NextRequest, NextResponse } from "next/server";
import { OptimizedAutoSnipingCore } from "../../../../src/services/trading/optimized-auto-sniping-core";
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
    const report = await autoSnipingService.getExecutionReport();
    
    return apiResponse(
      createSuccessResponse(report, {
        message: "Auto-sniping configuration retrieved successfully"
      }),
      HTTP_STATUS.OK
    );
  } catch (error) {
    console.error("Auto-sniping config GET error:", { error: error });
    return handleApiError(error, { message: "Failed to get auto-sniping configuration" });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, config } = body as { action: string; config?: Record<string, unknown> };

    if (!action) {
      return apiResponse(
        createErrorResponse("Action is required", {
          message: "Please specify action: update, start, or stop"
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    switch (action) {
      case "enable":
        console.info("🚀 Auto-sniping is always enabled. Updating config:", { context: config });
        if (config) {
          autoSnipingService.updateConfig(config);
        }
        
        const enabledReport = await autoSnipingService.getExecutionReport();
        return apiResponse(
          createSuccessResponse(
            { enabled: true, config: enabledReport.config },
            { message: "Auto-sniping is always enabled. Configuration updated successfully." }
          ),
          HTTP_STATUS.OK
        );

      case "disable":
        console.info("⏹️ Auto-sniping cannot be disabled. Stopping execution instead.");
        autoSnipingService.stopExecution();
        
        return apiResponse(
          createSuccessResponse(
            { enabled: true, status: "idle" },
            { message: "Auto-sniping execution stopped. Auto-sniping remains enabled." }
          ),
          HTTP_STATUS.OK
        );

      case "update":
        if (!config) {
          return apiResponse(
            createErrorResponse("Configuration is required for update action", {
              message: "Please provide config object for update"
            }),
            HTTP_STATUS.BAD_REQUEST
          );
        }
        
        console.info("⚙️ Updating auto-sniping config:", { context: config });
        autoSnipingService.updateConfig(config);
        
        const updatedReport = await autoSnipingService.getExecutionReport();
        return apiResponse(
          createSuccessResponse(
            { config: updatedReport.config },
            { message: "Auto-sniping configuration updated successfully" }
          ),
          HTTP_STATUS.OK
        );

      case "start":
        console.info("▶️ Starting auto-sniping execution");
        
        if (!autoSnipingService.isReadyForTrading()) {
          const currentReport = await autoSnipingService.getExecutionReport();
          return apiResponse(
            createErrorResponse("Auto-sniping is not ready for trading", {
              message: "Auto-sniping must not be already running",
              currentStatus: currentReport.status
            }),
            HTTP_STATUS.BAD_REQUEST
          );
        }
        
        await autoSnipingService.startExecution();
        
        return apiResponse(
          createSuccessResponse(
            { status: "active" },
            { message: "Auto-sniping execution started successfully" }
          ),
          HTTP_STATUS.OK
        );

      case "stop":
        console.info("⏹️ Stopping auto-sniping execution");
        autoSnipingService.stopExecution();
        
        return apiResponse(
          createSuccessResponse(
            { status: "idle" },
            { message: "Auto-sniping execution stopped successfully" }
          ),
          HTTP_STATUS.OK
        );

      default:
        return apiResponse(
          createErrorResponse("Invalid action", {
            message: "Action must be one of: enable, disable, update, start, stop",
            availableActions: ["enable", "disable", "update", "start", "stop"]
          }),
          HTTP_STATUS.BAD_REQUEST
        );
    }
  } catch (error) {
    console.error("Auto-sniping config POST error:", { error: error });
    return handleApiError(error, { message: "Failed to configure auto-sniping" });
  }
}