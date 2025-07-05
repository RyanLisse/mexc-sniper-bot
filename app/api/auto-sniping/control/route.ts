/**
 * Auto-Sniping Control API Route
 *
 * Provides RESTful endpoints for external control of auto-sniping operations.
 * This fulfills the requirements from Vertical Slice 5 in the integration testing mission.
 *
 * Endpoints:
 * - POST /control with action=start: Start auto-sniping
 * - POST /control with action=stop: Stop auto-sniping
 * - POST /control with action=status: Get current status
 * - POST /control with action=emergency_stop: Emergency halt
 */

import type { NextRequest } from "next/server";
import { apiAuthWrapper } from "@/src/lib/api-auth";
import {
  createErrorResponse,
  createSuccessResponse,
} from "@/src/lib/api-response";
import { tradingSystemInitializer } from "@/src/services/startup/trading-system-initializer";
import { getCoreTrading } from "@/src/services/trading/consolidated/core-trading/base-service";

/**
 * POST /api/auto-sniping/control
 * Control auto-sniping operations
 */
export const POST = apiAuthWrapper(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { action, config, reason } = body;

    if (!action) {
      return Response.json(
        createErrorResponse("Action parameter is required", {
          validActions: [
            "start",
            "stop",
            "status",
            "emergency_stop",
            "update_config",
          ],
        }),
        { status: 400 }
      );
    }

    const coreTrading = getCoreTrading();

    switch (action) {
      case "start": {
        console.info("[Auto-Sniping Control] Starting auto-sniping...");

        // Initialize trading system (bridge services) before starting auto-sniping
        try {
          await tradingSystemInitializer.initialize();
          console.info(
            "[Auto-Sniping Control] Trading system initialized successfully"
          );
        } catch (initError) {
          console.error(
            "[Auto-Sniping Control] Failed to initialize trading system:",
            initError
          );
          return Response.json(
            createErrorResponse(
              "Failed to initialize trading system: " +
                (initError instanceof Error
                  ? initError.message
                  : "Unknown error"),
              {
                action: "start",
                timestamp: new Date().toISOString(),
                initializationFailed: true,
              }
            ),
            { status: 500 }
          );
        }

        const result = await coreTrading.startAutoSniping();

        if (result.success) {
          return Response.json(
            createSuccessResponse({
              message: result.message || "Auto-sniping started successfully",
              data: {
                started: true,
                tradingSystemInitialized:
                  tradingSystemInitializer.isSystemInitialized(),
                status: await coreTrading.getServiceStatus(),
                timestamp: new Date().toISOString(),
              },
            })
          );
        } else {
          return Response.json(
            createErrorResponse(
              result.error || "Failed to start auto-sniping",
              {
                action: "start",
                timestamp: new Date().toISOString(),
              }
            ),
            { status: 400 }
          );
        }
      }

      case "stop": {
        console.info("[Auto-Sniping Control] Stopping auto-sniping...");
        const result = await coreTrading.stopAutoSniping();

        if (result.success) {
          return Response.json(
            createSuccessResponse({
              message: result.message || "Auto-sniping stopped successfully",
              data: {
                stopped: true,
                finalStatus: await coreTrading.getServiceStatus(),
                timestamp: new Date().toISOString(),
              },
            })
          );
        } else {
          return Response.json(
            createErrorResponse(result.error || "Failed to stop auto-sniping", {
              action: "stop",
              timestamp: new Date().toISOString(),
            }),
            { status: 400 }
          );
        }
      }

      case "status": {
        const status = await coreTrading.getServiceStatus();

        return Response.json(
          createSuccessResponse({
            message: "Status retrieved successfully",
            data: {
              status,
              tradingSystemInitialized:
                tradingSystemInitializer.isSystemInitialized(),
              timestamp: new Date().toISOString(),
            },
          })
        );
      }

      case "emergency_stop": {
        const stopReason = reason || "Manual emergency stop requested";
        console.warn(
          `[Auto-Sniping Control] Emergency stop requested: ${stopReason}`
        );

        const stopResult = await coreTrading.stopAutoSniping();
        await coreTrading.closeAllPositions(stopReason);

        return Response.json(
          createSuccessResponse({
            message: "Emergency stop executed successfully",
            data: {
              emergencyStopped: true,
              reason: stopReason,
              stopResult,
              timestamp: new Date().toISOString(),
            },
          })
        );
      }

      case "update_config": {
        if (!config) {
          return Response.json(
            createErrorResponse(
              "Config parameter is required for update_config action"
            ),
            { status: 400 }
          );
        }

        const result = await coreTrading.updateConfig(config);

        if (result.success) {
          return Response.json(
            createSuccessResponse({
              message: "Configuration updated successfully",
              data: {
                configUpdated: true,
                newConfig: config,
                timestamp: new Date().toISOString(),
              },
            })
          );
        } else {
          return Response.json(
            createErrorResponse(result.error || "Configuration update failed", {
              action: "update_config",
              config,
            }),
            { status: 400 }
          );
        }
      }

      default:
        return Response.json(
          createErrorResponse("Invalid action specified", {
            action,
            validActions: [
              "start",
              "stop",
              "status",
              "emergency_stop",
              "update_config",
            ],
          }),
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Auto-Sniping Control] API request failed:", { error });
    return Response.json(
      createErrorResponse("Auto-sniping control request failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
});

/**
 * GET /api/auto-sniping/control
 * Get current auto-sniping status (convenience endpoint)
 */
export const GET = apiAuthWrapper(async (_request: NextRequest) => {
  try {
    const coreTrading = getCoreTrading();
    const status = await coreTrading.getServiceStatus();

    return Response.json(
      createSuccessResponse({
        message: "Auto-sniping status retrieved successfully",
        data: {
          status,
          tradingSystemInitialized:
            tradingSystemInitializer.isSystemInitialized(),
          timestamp: new Date().toISOString(),
          endpoints: {
            start: "POST /api/auto-sniping/control with action=start",
            stop: "POST /api/auto-sniping/control with action=stop",
            status: "GET /api/auto-sniping/control or POST with action=status",
            emergency_stop:
              "POST /api/auto-sniping/control with action=emergency_stop",
            update_config:
              "POST /api/auto-sniping/control with action=update_config",
          },
        },
      })
    );
  } catch (error) {
    console.error("[Auto-Sniping Control] Status request failed:", { error });
    return Response.json(
      createErrorResponse("Failed to retrieve auto-sniping status", {
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
});

/**
 * PUT /api/auto-sniping/control
 * Update auto-sniping configuration (convenience endpoint)
 */
export const PUT = apiAuthWrapper(async (request: NextRequest) => {
  try {
    const config = await request.json();

    const coreTrading = getCoreTrading();
    const result = await coreTrading.updateConfig(config);

    if (result.success) {
      return Response.json(
        createSuccessResponse({
          message: "Configuration updated successfully",
          data: {
            configUpdated: true,
            newConfig: config,
            timestamp: new Date().toISOString(),
          },
        })
      );
    } else {
      return Response.json(
        createErrorResponse(result.error || "Configuration update failed", {
          config,
        }),
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("[Auto-Sniping Control] Configuration update failed:", {
      error,
    });
    return Response.json(
      createErrorResponse("Configuration update failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/auto-sniping/control
 * Emergency stop endpoint (convenience)
 */
export const DELETE = apiAuthWrapper(async (request: NextRequest) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    const stopReason = reason || "Emergency stop via DELETE endpoint";
    console.warn(
      `[Auto-Sniping Control] Emergency stop via DELETE: ${stopReason}`
    );

    const coreTrading = getCoreTrading();
    await coreTrading.stopAutoSniping();
    await coreTrading.closeAllPositions(stopReason);

    return Response.json(
      createSuccessResponse({
        message: "Emergency stop executed successfully",
        data: {
          emergencyStopped: true,
          reason: stopReason,
          timestamp: new Date().toISOString(),
        },
      })
    );
  } catch (error) {
    console.error("[Auto-Sniping Control] Emergency stop failed:", { error });
    return Response.json(
      createErrorResponse("Emergency stop failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
});
