/**
 * Safety Monitoring API Action Handlers
 * 
 * Extracted action handlers for safety monitoring API endpoints
 */

import {
  apiResponse,
  createErrorResponse,
  createSuccessResponse,
  HTTP_STATUS,
} from "../../../../lib/api-response";
import type {
  SafetyConfiguration,
  SafetyThresholds,
} from "../../../../schemas/safety-monitoring-schemas";
import type { RealTimeSafetyMonitoringService } from "../../../../services/real-time-safety-monitoring-modules";
import type { PostActionRequest } from "./schemas";

interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
}

// Lazy logger initialization
function getLogger() {
  return {
    info: (message: string, context?: any) =>
      console.info("[safety-monitoring-handlers]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[safety-monitoring-handlers]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[safety-monitoring-handlers]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[safety-monitoring-handlers]", message, context || ""),
  };
}

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

// Action handler type for better type safety
type ActionHandler = (
  body: PostActionRequest,
  user: AuthenticatedUser,
  safetyService: RealTimeSafetyMonitoringService
) => Promise<Response>;

// Action handlers to reduce cognitive complexity
export const actionHandlers: Record<string, ActionHandler> = {
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
    if (body.action !== "update_configuration") {
      return apiResponse(
        createErrorResponse("Invalid action for handler", {
          code: "HANDLER_MISMATCH",
        }),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    if (!body.configuration) {
      return apiResponse(
        createErrorResponse("Configuration is required", {
          message: "Request body must include a 'configuration' field",
          code: "MISSING_CONFIGURATION",
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    try {
      const configUpdate = validateConfigurationUpdate(body.configuration);
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
    if (body.action !== "update_thresholds") {
      return apiResponse(
        createErrorResponse("Invalid action for handler", {
          code: "HANDLER_MISMATCH",
        }),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    if (!body.thresholds) {
      return apiResponse(
        createErrorResponse("Thresholds are required", {
          message: "Request body must include a 'thresholds' field",
          code: "MISSING_THRESHOLDS",
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    try {
      const thresholdUpdate = validateThresholdsUpdate(body.thresholds);
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
    if (body.action !== "emergency_response") {
      return apiResponse(
        createErrorResponse("Invalid action for handler", {
          code: "HANDLER_MISMATCH",
        }),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    const actions = await safetyService.triggerEmergencyResponse(body.reason);

    getLogger().warn("Emergency response triggered via API", {
      operation: "emergency_response",
      userId: user.id,
      reason: body.reason,
      actionsExecuted: actions.length,
      timestamp: new Date().toISOString(),
    });

    return apiResponse(
      createSuccessResponse({
        message: "Emergency response triggered successfully",
        reason: body.reason,
        actionsExecuted: actions,
        triggeredAt: new Date().toISOString(),
      })
    );
  },

  acknowledge_alert: async (body, user, safetyService) => {
    if (body.action !== "acknowledge_alert") {
      return apiResponse(
        createErrorResponse("Invalid action for handler", {
          code: "HANDLER_MISMATCH",
        }),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    const acknowledged = safetyService.acknowledgeAlert(body.alertId);

    if (!acknowledged) {
      return apiResponse(
        createErrorResponse("Alert not found", {
          code: "ALERT_NOT_FOUND",
          alertId: body.alertId,
        }),
        HTTP_STATUS.NOT_FOUND
      );
    }

    getLogger().info("Alert acknowledged via API", {
      operation: "acknowledge_alert",
      userId: user.id,
      alertId: body.alertId,
      timestamp: new Date().toISOString(),
    });

    return apiResponse(
      createSuccessResponse({
        message: "Alert acknowledged successfully",
        alertId: body.alertId,
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
