import { NextRequest, NextResponse } from "next/server";
import { AutoSnipingExecutionService } from "../../../../src/services/auto-sniping-execution-service";
import { 
  createSuccessResponse, 
  createErrorResponse, 
  apiResponse, 
  HTTP_STATUS 
} from "../../../../src/lib/api-response";
import { handleApiError } from "../../../../src/lib/error-handler";

const autoSnipingService = AutoSnipingExecutionService.getInstance();

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
    console.error("Auto-sniping config GET error:", error);
    return handleApiError(error, "Failed to get auto-sniping configuration");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, config } = body;

    if (!action) {
      return apiResponse(
        createErrorResponse("Action is required", {
          message: "Please specify action: enable, disable, or update"
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    switch (action) {
      case "enable":
        console.log("🚀 Enabling auto-sniping with config:", config);
        autoSnipingService.enableAutoSniping(config);
        
        return apiResponse(
          createSuccessResponse(
            { enabled: true, config: autoSnipingService.getExecutionReport().config },
            { message: "Auto-sniping enabled successfully" }
          ),
          HTTP_STATUS.OK
        );

      case "disable":
        console.log("⏹️ Disabling auto-sniping");
        autoSnipingService.disableAutoSniping();
        
        return apiResponse(
          createSuccessResponse(
            { enabled: false },
            { message: "Auto-sniping disabled successfully" }
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
        
        console.log("⚙️ Updating auto-sniping config:", config);
        autoSnipingService.updateConfig(config);
        
        return apiResponse(
          createSuccessResponse(
            { config: autoSnipingService.getExecutionReport().config },
            { message: "Auto-sniping configuration updated successfully" }
          ),
          HTTP_STATUS.OK
        );

      case "start":
        console.log("▶️ Starting auto-sniping execution");
        
        if (!autoSnipingService.isReadyForTrading()) {
          return apiResponse(
            createErrorResponse("Auto-sniping is not ready for trading", {
              message: "Auto-sniping must be enabled and not already running",
              currentStatus: autoSnipingService.getExecutionReport().status
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
        console.log("⏹️ Stopping auto-sniping execution");
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
    console.error("Auto-sniping config POST error:", error);
    return handleApiError(error, "Failed to configure auto-sniping");
  }
}