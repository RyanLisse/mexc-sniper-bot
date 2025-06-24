import type { NextRequest } from "next/server";
import {
  apiResponse,
  createErrorResponse,
  createSuccessResponse,
  HTTP_STATUS,
} from "../../../../lib/api-response";
import { authenticatedRoute } from "../../../../lib/auth-decorators";
import type {
  SafetyConfiguration,
  SafetyThresholds,
} from "../../../../schemas/safety-monitoring-schemas";
import { RealTimeSafetyMonitoringService } from "../../../../services/real-time-safety-monitoring-modules";

// Lazy logger initialization to avoid build-time issues
function getLogger() {
  return {
      info: (message: string, context?: any) => console.info('[safety-monitoring-api]', message, context || ''),
      warn: (message: string, context?: any) => console.warn('[safety-monitoring-api]', message, context || ''),
      error: (message: string, context?: any, error?: Error) => console.error('[safety-monitoring-api]', message, context || '', error || ''),
      debug: (message: string, context?: any) => console.debug('[safety-monitoring-api]', message, context || ''),
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
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "status";

  const logger = getLogger();
  console.info("Safety monitoring API GET request", {
    operation: "api_get_request",
    userId: user.id,
    action,
    userAgent: request.headers.get("user-agent"),
    timestamp: new Date().toISOString(),
  });

  try {
    const safetyService = RealTimeSafetyMonitoringService.getInstance();

    switch (action) {
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
        const severity = url.searchParams.get("severity") as
          | "low"
          | "medium"
          | "high"
          | "critical"
          | null;
        const category = url.searchParams.get("category") as
          | "portfolio"
          | "system"
          | "performance"
          | "pattern"
          | "api"
          | null;
        const limit = Number.parseInt(url.searchParams.get("limit") || "50");

        const report = await safetyService.getSafetyReport();
        let alerts = report.activeAlerts;

        // Apply filters
        if (severity) {
          alerts = alerts.filter((alert) => alert.severity === severity);
        }
        if (category) {
          alerts = alerts.filter((alert) => alert.category === category);
        }

        // Limit results
        alerts = alerts.slice(0, limit);

        return apiResponse(
          createSuccessResponse({
            alerts,
            totalCount: report.activeAlerts.length,
            filteredCount: alerts.length,
            filters: { severity, category, limit },
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
            providedAction: action,
          }),
          HTTP_STATUS.BAD_REQUEST
        );
    }
  } catch (error) {
    console.error(
      "Safety monitoring API GET request failed",
      {
        operation: "api_get_request",
        userId: user.id,
        action,
        error: error instanceof Error ? error.message : String(error),
      },
      error instanceof Error ? error : new Error(String(error))
    );

    return apiResponse(
      createErrorResponse(
        `Failed to ${action}: ${error instanceof Error ? error.message : "Unknown error"}`
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

// Action handler type for better type safety
type ActionHandler = (
  body: Record<string, unknown>,
  user: AuthenticatedUser,
  safetyService: RealTimeSafetyMonitoringService
) => Promise<Response>;

// Helper functions to reduce complexity
const validateConfigurationUpdate = (configuration: unknown): Partial<SafetyConfiguration> => {
  if (!configuration || typeof configuration !== "object") {
    throw new Error("Configuration must be an object");
  }

  const validConfigFields = [
    "enabled",
    "monitoringIntervalMs",
    "riskCheckIntervalMs",
    "autoActionEnabled",
    "emergencyMode",
    "alertRetentionHours",
    "thresholds",
  ] as const;

  const configUpdate: Partial<SafetyConfiguration> = {};
  for (const [key, value] of Object.entries(configuration)) {
    if (validConfigFields.includes(key as (typeof validConfigFields)[number])) {
      (configUpdate as Record<string, unknown>)[key] = value;
    }
  }
  return configUpdate;
};

const validateThresholdsUpdate = (thresholds: unknown): Partial<SafetyThresholds> => {
  if (!thresholds || typeof thresholds !== "object") {
    throw new Error("Thresholds must be an object");
  }

  const validThresholdFields = [
    "maxDrawdownPercentage",
    "maxDailyLossPercentage",
    "maxPositionRiskPercentage",
    "maxPortfolioConcentration",
    "minSuccessRatePercentage",
    "maxConsecutiveLosses",
    "maxSlippagePercentage",
    "maxApiLatencyMs",
    "minApiSuccessRate",
    "maxMemoryUsagePercentage",
    "minPatternConfidence",
    "maxPatternDetectionFailures",
  ] as const;

  const thresholdUpdate: Partial<SafetyThresholds> = {};
  for (const [key, value] of Object.entries(thresholds)) {
    if (
      validThresholdFields.includes(key as (typeof validThresholdFields)[number]) &&
      typeof value === "number"
    ) {
      (thresholdUpdate as Record<string, unknown>)[key] = value;
    }
  }
  return thresholdUpdate;
};

// Action handlers to reduce cognitive complexity
const actionHandlers: Record<string, ActionHandler> = {
  start_monitoring: async (_body, user, safetyService) => {
    const logger = getLogger();
    if (safetyService.getMonitoringStatus()) {
      return apiResponse(
        createErrorResponse("Safety monitoring is already active", {
          code: "ALREADY_ACTIVE",
        }),
        HTTP_STATUS.CONFLICT
      );
    }

    await safetyService.startMonitoring();

    console.info("Safety monitoring started via API", {
      operation: "start_monitoring",
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    return apiResponse(
      createSuccessResponse({
        message: "Safety monitoring started successfully",
        isActive: true,
        startedAt: new Date().toISOString(),
      })
    );
  },

  stop_monitoring: async (_body, user, safetyService) => {
    if (!safetyService.getMonitoringStatus()) {
      return apiResponse(
        createErrorResponse("Safety monitoring is not currently active", {
          code: "NOT_ACTIVE",
        }),
        HTTP_STATUS.CONFLICT
      );
    }

    safetyService.stopMonitoring();

    getLogger().info("Safety monitoring stopped via API", {
      operation: "stop_monitoring",
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    return apiResponse(
      createSuccessResponse({
        message: "Safety monitoring stopped successfully",
        isActive: false,
        stoppedAt: new Date().toISOString(),
      })
    );
  },

  update_configuration: async (body, user, safetyService) => {
    const { configuration } = body;

    if (!configuration) {
      return apiResponse(
        createErrorResponse("Configuration is required", {
          message: "Request body must include a 'configuration' field",
          code: "MISSING_CONFIGURATION",
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    try {
      const configUpdate = validateConfigurationUpdate(configuration);
      safetyService.updateConfiguration(configUpdate);

      getLogger().info("Safety configuration updated via API", {
        operation: "update_configuration",
        userId: user.id,
        updatedFields: Object.keys(configUpdate),
        timestamp: new Date().toISOString(),
      });

      return apiResponse(
        createSuccessResponse({
          message: "Configuration updated successfully",
          updatedFields: Object.keys(configUpdate),
          newConfiguration: safetyService.getConfiguration(),
        })
      );
    } catch (error) {
      return apiResponse(
        createErrorResponse("Invalid configuration data", {
          code: "INVALID_CONFIGURATION",
          details: error instanceof Error ? error.message : "Unknown error",
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }
  },

  update_thresholds: async (body, user, safetyService) => {
    const { thresholds } = body;

    if (!thresholds) {
      return apiResponse(
        createErrorResponse("Thresholds are required", {
          message: "Request body must include a 'thresholds' field",
          code: "MISSING_THRESHOLDS",
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    try {
      const thresholdUpdate = validateThresholdsUpdate(thresholds);
      safetyService.updateConfiguration({
        thresholds: { ...safetyService.getConfiguration().thresholds, ...thresholdUpdate },
      });

      getLogger().info("Safety thresholds updated via API", {
        operation: "update_thresholds",
        userId: user.id,
        updatedThresholds: Object.keys(thresholdUpdate),
        timestamp: new Date().toISOString(),
      });

      return apiResponse(
        createSuccessResponse({
          message: "Thresholds updated successfully",
          updatedThresholds: Object.keys(thresholdUpdate),
          newThresholds: safetyService.getConfiguration().thresholds,
        })
      );
    } catch (error) {
      return apiResponse(
        createErrorResponse("Invalid thresholds data", {
          code: "INVALID_THRESHOLDS",
          details: error instanceof Error ? error.message : "Unknown error",
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }
  },

  emergency_response: async (body, user, safetyService) => {
    const { reason } = body;

    if (!reason) {
      return apiResponse(
        createErrorResponse("Emergency reason is required", {
          message: "Request body must include a 'reason' field",
          code: "MISSING_REASON",
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const actions = await safetyService.triggerEmergencyResponse(reason as string);

    getLogger().warn("Emergency response triggered via API", {
      operation: "emergency_response",
      userId: user.id,
      reason,
      actionsExecuted: actions.length,
      timestamp: new Date().toISOString(),
    });

    return apiResponse(
      createSuccessResponse({
        message: "Emergency response triggered successfully",
        reason,
        actionsExecuted: actions,
        triggeredAt: new Date().toISOString(),
      })
    );
  },

  acknowledge_alert: async (body, user, safetyService) => {
    const { alertId } = body;

    if (!alertId) {
      return apiResponse(
        createErrorResponse("Alert ID is required", {
          message: "Request body must include an 'alertId' field",
          code: "MISSING_ALERT_ID",
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const acknowledged = safetyService.acknowledgeAlert(alertId as string);

    if (!acknowledged) {
      return apiResponse(
        createErrorResponse("Alert not found", {
          code: "ALERT_NOT_FOUND",
          alertId,
        }),
        HTTP_STATUS.NOT_FOUND
      );
    }

    getLogger().info("Alert acknowledged via API", {
      operation: "acknowledge_alert",
      userId: user.id,
      alertId,
      timestamp: new Date().toISOString(),
    });

    return apiResponse(
      createSuccessResponse({
        message: "Alert acknowledged successfully",
        alertId,
        acknowledgedAt: new Date().toISOString(),
      })
    );
  },

  clear_acknowledged_alerts: async (_body, user, safetyService) => {
    const logger = getLogger();
    const clearedCount = safetyService.clearAcknowledgedAlerts();

    console.info("Acknowledged alerts cleared via API", {
      operation: "clear_acknowledged_alerts",
      userId: user.id,
      clearedCount,
      timestamp: new Date().toISOString(),
    });

    return apiResponse(
      createSuccessResponse({
        message: "Acknowledged alerts cleared successfully",
        clearedCount,
        clearedAt: new Date().toISOString(),
      })
    );
  },

  force_risk_assessment: async (_body, user, safetyService) => {
    await safetyService.performRiskAssessment();
    const riskMetrics = safetyService.getRiskMetrics();

    getLogger().info("Risk assessment forced via API", {
      operation: "force_risk_assessment",
      userId: user.id,
      overallRiskScore: safetyService.calculateOverallRiskScore(),
      timestamp: new Date().toISOString(),
    });

    return apiResponse(
      createSuccessResponse({
        message: "Risk assessment completed",
        riskMetrics,
        overallRiskScore: safetyService.calculateOverallRiskScore(),
        assessedAt: new Date().toISOString(),
      })
    );
  },
};

/**
 * POST /api/auto-sniping/safety-monitoring
 * Execute safety monitoring actions and configuration updates
 */
export const POST = authenticatedRoute(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return apiResponse(
        createErrorResponse("Action is required", {
          message: "Request body must include an 'action' field",
          code: "MISSING_ACTION",
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const logger = getLogger();
    console.info("Safety monitoring API POST request", {
      operation: "api_post_request",
      userId: user.id,
      action,
      bodyKeys: Object.keys(body),
      timestamp: new Date().toISOString(),
    });

    const safetyService = RealTimeSafetyMonitoringService.getInstance();
    const handler = actionHandlers[action as string];

    if (!handler) {
      return apiResponse(
        createErrorResponse("Invalid action", {
          message:
            "Valid actions: start_monitoring, stop_monitoring, update_configuration, update_thresholds, emergency_response, acknowledge_alert, clear_acknowledged_alerts, force_risk_assessment",
          code: "INVALID_ACTION",
          providedAction: action,
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    return await handler(body, user, safetyService);
  } catch (error) {
    getLogger().error(
      "Safety monitoring API POST request failed",
      {
        operation: "api_post_request",
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      },
      error instanceof Error ? error : new Error(String(error))
    );

    if (error instanceof SyntaxError) {
      return apiResponse(
        createErrorResponse("Invalid JSON in request body", {
          code: "INVALID_JSON",
          details: error.message,
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    return apiResponse(
      createErrorResponse(
        `Request failed: ${error instanceof Error ? error.message : "Unknown error"}`
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});
