import type { NextRequest } from "next/server";
import { inngest } from "@/src/inngest/client";
import {
  apiResponse,
  createErrorResponse,
  createSuccessResponse,
  createValidationErrorResponse,
  HTTP_STATUS,
} from "@/src/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data = {} } = body;

    if (!action) {
      return apiResponse(
        createValidationErrorResponse("action", "Action is required"),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    let result;

    switch (action) {
      case "comprehensive-safety-check":
        result = await inngest.send({
          name: "safety/monitor",
          data: {
            triggeredBy: "ui",
            timestamp: new Date().toISOString(),
            ...data,
          },
        });
        break;

      case "position-reconciliation":
        result = await inngest.send({
          name: "safety/reconciliation",
          data: {
            triggeredBy: "ui",
            timestamp: new Date().toISOString(),
            ...data,
          },
        });
        break;

      case "toggle-simulation":
        if (typeof data.enabled !== "boolean") {
          return apiResponse(
            createValidationErrorResponse(
              "enabled",
              "enabled boolean value is required for simulation toggle"
            ),
            HTTP_STATUS.BAD_REQUEST
          );
        }

        result = await inngest.send({
          name: "simulation/toggle",
          data: {
            enabled: data.enabled,
            userId: data.userId || "default",
            triggeredBy: "ui",
            timestamp: new Date().toISOString(),
          },
        });
        break;

      case "risk-assessment":
        result = await inngest.send({
          name: "safety/risk-monitor",
          data: {
            triggeredBy: "ui",
            timestamp: new Date().toISOString(),
            ...data,
          },
        });
        break;

      case "emergency-halt":
        if (!data.reason) {
          return apiResponse(
            createValidationErrorResponse(
              "reason",
              "Reason is required for emergency halt"
            ),
            HTTP_STATUS.BAD_REQUEST
          );
        }

        result = await inngest.send({
          name: "safety/emergency-halt",
          data: {
            reason: data.reason,
            triggeredBy: "ui",
            timestamp: new Date().toISOString(),
            userId: data.userId || "default",
          },
        });
        break;

      case "system-health-check":
        result = await inngest.send({
          name: "safety/health-check",
          data: {
            triggeredBy: "ui",
            timestamp: new Date().toISOString(),
            ...data,
          },
        });
        break;

      case "error-recovery":
        if (!data.error || !data.context) {
          return apiResponse(
            createValidationErrorResponse(
              "error, context",
              "Error details and context are required"
            ),
            HTTP_STATUS.BAD_REQUEST
          );
        }

        result = await inngest.send({
          name: "error/recovery-needed",
          data: {
            error: data.error,
            context: data.context,
            severity: data.severity || "medium",
            triggeredBy: "ui",
            timestamp: new Date().toISOString(),
          },
        });
        break;

      default:
        return apiResponse(
          createValidationErrorResponse(
            "action",
            `Unknown safety action: ${action}`
          ),
          HTTP_STATUS.BAD_REQUEST
        );
    }

    return apiResponse(
      createSuccessResponse(
        {
          action,
          eventId: result.ids[0],
          triggeredAt: new Date().toISOString(),
        },
        {
          message: `Safety action '${action}' triggered successfully`,
        }
      )
    );
  } catch (error) {
    console.error("Failed to trigger safety action:", { error: error });
    return apiResponse(
      createErrorResponse("Failed to trigger safety action", {
        error: error instanceof Error ? error.message : String(error),
      }),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function GET(_request: NextRequest) {
  try {
    const availableActions = [
      {
        action: "comprehensive-safety-check",
        description: "Run comprehensive safety check across all systems",
        parameters: {},
        example: {
          action: "comprehensive-safety-check",
          data: {},
        },
      },
      {
        action: "position-reconciliation",
        description:
          "Trigger position reconciliation between local and exchange",
        parameters: {},
        example: {
          action: "position-reconciliation",
          data: {},
        },
      },
      {
        action: "toggle-simulation",
        description: "Enable or disable simulation mode",
        parameters: {
          enabled: "boolean (required)",
          userId: "string (optional)",
        },
        example: {
          action: "toggle-simulation",
          data: {
            enabled: true,
            userId: "user123",
          },
        },
      },
      {
        action: "risk-assessment",
        description: "Trigger immediate risk assessment and monitoring",
        parameters: {},
        example: {
          action: "risk-assessment",
          data: {},
        },
      },
      {
        action: "emergency-halt",
        description: "Activate emergency halt across all trading systems",
        parameters: {
          reason: "string (required)",
          userId: "string (optional)",
        },
        example: {
          action: "emergency-halt",
          data: {
            reason: "Manual emergency halt for system maintenance",
            userId: "admin",
          },
        },
      },
      {
        action: "system-health-check",
        description: "Perform comprehensive system health check",
        parameters: {},
        example: {
          action: "system-health-check",
          data: {},
        },
      },
      {
        action: "error-recovery",
        description: "Trigger error recovery workflow for specific error",
        parameters: {
          error: "object (required) - Error details",
          context: "object (required) - Error context",
          severity: "string (optional) - low, medium, high, critical",
        },
        example: {
          action: "error-recovery",
          data: {
            error: {
              message: "Network timeout occurred",
              code: "NETWORK_TIMEOUT",
            },
            context: {
              service: "mexc_api",
              operation: "fetch_positions",
            },
            severity: "medium",
          },
        },
      },
    ];

    return apiResponse(
      createSuccessResponse({
        availableActions,
        totalActions: availableActions.length,
        endpoint: "/api/triggers/safety",
        methods: ["POST"],
        description:
          "Safety system trigger endpoints for manual control of safety operations",
      })
    );
  } catch (error) {
    console.error("Failed to get safety actions:", { error: error });
    return apiResponse(
      createErrorResponse("Failed to get safety actions"),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
