import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  apiResponse,
  createErrorResponse,
  createSuccessResponse,
  HTTP_STATUS,
} from "../../../../lib/api-response";
import { authenticatedRoute } from "../../../../lib/auth-decorators";
import { RealTimeSafetyMonitoringService } from "../../../../services/real-time-safety-monitoring-modules";
import { actionHandlers } from "./handlers";
import { GetQuerySchema, PostActionSchema } from "./schemas";

// Lazy logger initialization to avoid build-time issues
function getLogger() {
  return {
    info: (message: string, context?: any) =>
      console.info("[safety-monitoring-api]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[safety-monitoring-api]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[safety-monitoring-api]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[safety-monitoring-api]", message, context || ""),
  };
}

interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
}

/**
 * GET /api/auto-sniping/safety-monitoring
 * Get safety monitoring status, reports, and metrics
 */
export const GET = authenticatedRoute(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { searchParams } = new URL(request.url);
    const query = GetQuerySchema.parse({
      action: searchParams.get("action") || undefined,
      severity: searchParams.get("severity") || undefined,
      category: searchParams.get("category") || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    const logger = getLogger();
    console.info("Safety monitoring API GET request", {
      operation: "api_get_request",
      userId: user.id,
      action: query.action,
      filters: { severity: query.severity, category: query.category, limit: query.limit },
      userAgent: request.headers.get("user-agent"),
      timestamp: new Date().toISOString(),
    });

    const safetyService = RealTimeSafetyMonitoringService.getInstance();

    switch (query.action) {
      case "status": {
        // Get basic monitoring status
        const isActive = safetyService.getMonitoringStatus();
        const timerStatus = safetyService.getTimerStatus();

        return apiResponse(
          createSuccessResponse({
            isActive,
            timerOperations: timerStatus,
            lastChecked: new Date().toISOString(),
          })
        );
      }

      case "report": {
        // Get comprehensive safety monitoring report
        const report = await safetyService.getSafetyReport();

        console.info("Safety monitoring report generated", {
          operation: "generate_report",
          userId: user.id,
          overallStatus: report.status,
          riskScore: report.overallRiskScore,
          activeAlertsCount: report.activeAlerts.length,
          systemHealthScore: report.systemHealth.overallHealth,
        });

        return apiResponse(createSuccessResponse(report));
      }

      case "risk-metrics": {
        // Get current risk metrics only
        const riskMetrics = safetyService.getRiskMetrics();

        return apiResponse(
          createSuccessResponse({
            riskMetrics,
            timestamp: new Date().toISOString(),
          })
        );
      }

      case "alerts": {
        // Get active alerts with optional filtering
        const limit = Number.parseInt(query.limit);

        const report = await safetyService.getSafetyReport();
        let alerts = report.activeAlerts;

        // Apply filters
        if (query.severity) {
          alerts = alerts.filter((alert) => alert.severity === query.severity);
        }
        if (query.category) {
          alerts = alerts.filter((alert) => alert.category === query.category);
        }

        // Limit results
        alerts = alerts.slice(0, limit);

        return apiResponse(
          createSuccessResponse({
            alerts,
            totalCount: report.activeAlerts.length,
            filteredCount: alerts.length,
            filters: { severity: query.severity, category: query.category, limit },
          })
        );
      }

      case "system-health": {
        // Get system health status
        const report = await safetyService.getSafetyReport();

        return apiResponse(
          createSuccessResponse({
            systemHealth: report.systemHealth,
            overallRiskScore: report.overallRiskScore,
            status: report.status,
            recommendations: report.recommendations,
            lastUpdated: report.lastUpdated,
          })
        );
      }

      case "configuration": {
        // Get current safety configuration
        const config = safetyService.getConfiguration();

        return apiResponse(
          createSuccessResponse({
            configuration: config,
            isActive: safetyService.getMonitoringStatus(),
          })
        );
      }

      case "timer-status": {
        // Get detailed timer coordination status
        const timerStatus = safetyService.getTimerStatus();

        return apiResponse(
          createSuccessResponse({
            timerOperations: timerStatus,
            isMonitoringActive: safetyService.getMonitoringStatus(),
            currentTime: Date.now(),
          })
        );
      }

      case "check-safety": {
        // Quick safety check
        const isSafe = await safetyService.isSystemSafe();
        const riskMetrics = safetyService.getRiskMetrics();

        return apiResponse(
          createSuccessResponse({
            isSafe,
            overallRiskScore: safetyService.calculateOverallRiskScore(),
            currentDrawdown: riskMetrics.currentDrawdown,
            successRate: riskMetrics.successRate,
            consecutiveLosses: riskMetrics.consecutiveLosses,
            lastChecked: new Date().toISOString(),
          })
        );
      }

      default:
        return apiResponse(
          createErrorResponse("Invalid action parameter", {
            message:
              "Valid actions: status, report, risk-metrics, alerts, system-health, configuration, timer-status, check-safety",
            code: "INVALID_ACTION",
            providedAction: query.action,
          }),
          HTTP_STATUS.BAD_REQUEST
        );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse(
        createErrorResponse("Invalid query parameters", {
          code: "INVALID_QUERY_PARAMS",
          details: error.errors,
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    console.error(
      "Safety monitoring API GET request failed",
      {
        operation: "api_get_request",
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      },
      error instanceof Error ? error : new Error(String(error))
    );

    return apiResponse(
      createErrorResponse(
        `Request failed: ${error instanceof Error ? error.message : "Unknown error"}`
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * POST /api/auto-sniping/safety-monitoring
 * Execute safety monitoring actions and configuration updates
 */
export const POST = authenticatedRoute(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await request.json();
    const validatedBody = PostActionSchema.parse(body);

    const logger = getLogger();
    console.info("Safety monitoring API POST request", {
      operation: "api_post_request",
      userId: user.id,
      action: validatedBody.action,
      bodyKeys: Object.keys(body),
      timestamp: new Date().toISOString(),
    });

    const safetyService = RealTimeSafetyMonitoringService.getInstance();
    const handler = actionHandlers[validatedBody.action];

    if (!handler) {
      return apiResponse(
        createErrorResponse("Invalid action", {
          message:
            "Valid actions: start_monitoring, stop_monitoring, update_configuration, update_thresholds, emergency_response, acknowledge_alert, clear_acknowledged_alerts, force_risk_assessment",
          code: "INVALID_ACTION",
          providedAction: validatedBody.action,
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    return await handler(validatedBody, user, safetyService);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiResponse(
        createErrorResponse("Invalid request body", {
          code: "INVALID_REQUEST_BODY",
          details: error.errors,
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (error instanceof SyntaxError) {
      return apiResponse(
        createErrorResponse("Invalid JSON in request body", {
          code: "INVALID_JSON",
          details: error.message,
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    getLogger().error(
      "Safety monitoring API POST request failed",
      {
        operation: "api_post_request",
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      },
      error instanceof Error ? error : new Error(String(error))
    );

    return apiResponse(
      createErrorResponse(
        `Request failed: ${error instanceof Error ? error.message : "Unknown error"}`
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});