import { NextRequest, NextResponse } from "next/server";
import { getCoreTrading } from "@/src/services/trading/consolidated/core-trading/base-service";
import { 
  createSuccessResponse, 
  createErrorResponse, 
  apiResponse, 
  HTTP_STATUS 
} from "@/src/lib/api-response";
import { handleApiError } from "@/src/lib/error-handler";

const coreTrading = getCoreTrading();

export async function GET() {
  try {
    // Ensure core trading service is initialized before making any calls
    let initResult;
    try {
      // Check if service needs initialization by calling a simple status check
      const status = await coreTrading.getServiceStatus();
      console.info('[API] Core trading service already initialized');
    } catch (error) {
      if (error instanceof Error && error.message.includes('not initialized')) {
        console.info('[API] Initializing core trading service...');
        initResult = await coreTrading.initialize();
        
        if (!initResult.success) {
          console.error('[API] Core trading service initialization failed:', initResult.error);
          return apiResponse(
            createErrorResponse("Service initialization failed", {
              error: initResult.error,
              message: "Core trading service could not be initialized"
            }),
            HTTP_STATUS.INTERNAL_SERVER_ERROR
          );
        }
        
        console.info('[API] Core trading service initialized successfully');
      } else {
        // Re-throw unexpected errors
        throw error;
      }
    }

    // Now safely get performance metrics
    const report = await coreTrading.getPerformanceMetrics();
    
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
        
        // Initialize if needed
        try {
          if (config) {
            await coreTrading.updateConfig(config);
          }
          var enabledStatus = await coreTrading.getServiceStatus();
        } catch (error) {
          if (error instanceof Error && error.message.includes('not initialized')) {
            await coreTrading.initialize();
            if (config) {
              await coreTrading.updateConfig(config);
            }
            var enabledStatus = await coreTrading.getServiceStatus();
          } else {
            throw error;
          }
        }
        return apiResponse(
          createSuccessResponse(
            { enabled: true, config: enabledStatus },
            { message: "Auto-sniping is always enabled. Configuration updated successfully." }
          ),
          HTTP_STATUS.OK
        );

      case "disable":
        console.info("⏹️ Auto-sniping cannot be disabled. Stopping execution instead.");
        await coreTrading.stopAutoSniping();
        
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
        await coreTrading.updateConfig(config);
        
        const updatedStatus = await coreTrading.getServiceStatus();
        return apiResponse(
          createSuccessResponse(
            { config: updatedStatus },
            { message: "Auto-sniping configuration updated successfully" }
          ),
          HTTP_STATUS.OK
        );

      case "start":
        console.info("▶️ Starting auto-sniping execution");
        
        const currentStatus = await coreTrading.getServiceStatus();
        if (currentStatus.autoSnipingEnabled) {
          return apiResponse(
            createErrorResponse("Auto-sniping is already running", {
              message: "Auto-sniping is already active",
              currentStatus: currentStatus
            }),
            HTTP_STATUS.BAD_REQUEST
          );
        }
        
        const startResult = await coreTrading.startAutoSniping();
        if (!startResult.success) {
          return apiResponse(
            createErrorResponse("Failed to start auto-sniping", {
              message: startResult.error,
              currentStatus: currentStatus
            }),
            HTTP_STATUS.BAD_REQUEST
          );
        }
        
        return apiResponse(
          createSuccessResponse(
            { status: "active" },
            { message: "Auto-sniping execution started successfully" }
          ),
          HTTP_STATUS.OK
        );

      case "stop":
        console.info("⏹️ Stopping auto-sniping execution");
        await coreTrading.stopAutoSniping();
        
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