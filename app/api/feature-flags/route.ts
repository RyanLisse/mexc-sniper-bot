/**
 * Feature Flags Management API
 *
 * API endpoints for managing enhanced feature flags with rollout controls,
 * A/B testing, and real-time monitoring.
 */

import type { NextRequest } from "next/server";
import {
  apiResponse,
  createErrorResponse,
  createSuccessResponse,
} from "@/src/lib/api-response";
import {
  EnhancedFeatureFlagConfigSchema,
  enhancedFeatureFlagManager,
  UserContextSchema,
} from "@/src/lib/feature-flags/enhanced-feature-flag-manager";

/**
 * GET /api/feature-flags
 * Returns all feature flags and their configurations
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const url = new URL(request.url);
    const flagName = url.searchParams.get("flag");
    const includeAnalytics = url.searchParams.get("analytics") === "true";

    if (flagName) {
      // Get specific flag configuration
      const flags = enhancedFeatureFlagManager.getAllFlags();
      const flag = flags[flagName];

      if (!flag) {
        return apiResponse(
          createErrorResponse("Feature flag not found", { flagName }),
          404
        );
      }

      let analytics: unknown;
      if (includeAnalytics) {
        analytics = enhancedFeatureFlagManager.getAnalytics(flagName);
      }

      return apiResponse(
        createSuccessResponse({
          flag,
          analytics,
        })
      );
    }

    // Get all flags
    const flags = enhancedFeatureFlagManager.getAllFlags();
    let analytics: unknown;

    if (includeAnalytics) {
      const baseAnalytics = enhancedFeatureFlagManager.getAnalytics();

      // Get analytics for each flag
      const flagAnalytics: Record<string, unknown> = {};
      for (const flagName of Object.keys(flags)) {
        flagAnalytics[flagName] =
          enhancedFeatureFlagManager.getAnalytics(flagName);
      }

      analytics = {
        ...baseAnalytics,
        byFlag: flagAnalytics,
      };
    }

    return apiResponse(
      createSuccessResponse({
        flags,
        analytics,
        count: Object.keys(flags).length,
      })
    );
  } catch (error) {
    console.error("[Feature Flags API] GET Error:", error);
    return apiResponse(
      createErrorResponse("Failed to retrieve feature flags", {
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      500
    );
  }
}

/**
 * POST /api/feature-flags
 * Create a new feature flag or evaluate existing flags for a user
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case "create":
        return handleCreateFlag(data);

      case "evaluate":
        return handleEvaluateFlag(data);

      case "bulk_evaluate":
        return handleBulkEvaluate(data);

      default:
        return apiResponse(
          createErrorResponse("Invalid action", {
            validActions: ["create", "evaluate", "bulk_evaluate"],
          }),
          400
        );
    }
  } catch (error) {
    console.error("[Feature Flags API] POST Error:", error);
    return apiResponse(
      createErrorResponse("Failed to process feature flag request", {
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      500
    );
  }
}

/**
 * PUT /api/feature-flags
 * Update feature flag configuration
 */
export async function PUT(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const { flagName, action, ...updates } = body;

    if (!flagName) {
      return apiResponse(createErrorResponse("Flag name is required"), 400);
    }

    switch (action) {
      case "update":
        enhancedFeatureFlagManager.updateFlag(flagName, updates);
        break;

      case "emergency_disable": {
        const reason = updates.reason || "Emergency disable via API";
        enhancedFeatureFlagManager.emergencyDisable(flagName, reason);
        break;
      }

      case "start_gradual_rollout":
        if (!updates.gradualRolloutConfig) {
          return apiResponse(
            createErrorResponse("Gradual rollout configuration is required"),
            400
          );
        }
        enhancedFeatureFlagManager.startGradualRollout(
          flagName,
          updates.gradualRolloutConfig
        );
        break;

      default:
        return apiResponse(
          createErrorResponse("Invalid action", {
            validActions: [
              "update",
              "emergency_disable",
              "start_gradual_rollout",
            ],
          }),
          400
        );
    }

    // Return updated flag
    const flags = enhancedFeatureFlagManager.getAllFlags();
    const updatedFlag = flags[flagName];

    return apiResponse(
      createSuccessResponse({
        message: "Feature flag updated successfully",
        flag: updatedFlag,
      })
    );
  } catch (error) {
    console.error("[Feature Flags API] PUT Error:", error);
    return apiResponse(
      createErrorResponse("Failed to update feature flag", {
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      500
    );
  }
}

/**
 * DELETE /api/feature-flags
 * Delete a feature flag (not implemented for safety)
 */
export async function DELETE(_request: NextRequest): Promise<Response> {
  return apiResponse(
    createErrorResponse(
      "Feature flag deletion is not supported for safety reasons"
    ),
    405
  );
}

// Helper functions

async function handleCreateFlag(data: unknown): Promise<Response> {
  try {
    const config = EnhancedFeatureFlagConfigSchema.parse({
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: data.createdBy || "api",
    });

    enhancedFeatureFlagManager.registerFlag(config);

    return apiResponse(
      createSuccessResponse({
        message: "Feature flag created successfully",
        flag: config,
      })
    );
  } catch (error) {
    return apiResponse(
      createErrorResponse("Invalid feature flag configuration", {
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      400
    );
  }
}

async function handleEvaluateFlag(data: unknown): Promise<Response> {
  try {
    const { flagName, userContext, defaultValue = false } = data;

    if (!flagName) {
      return apiResponse(createErrorResponse("Flag name is required"), 400);
    }

    const validatedUserContext = UserContextSchema.parse(userContext);
    const evaluation = await enhancedFeatureFlagManager.evaluateFlag(
      flagName,
      validatedUserContext,
      defaultValue
    );

    return apiResponse(
      createSuccessResponse({
        evaluation,
      })
    );
  } catch (error) {
    return apiResponse(
      createErrorResponse("Failed to evaluate feature flag", {
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      400
    );
  }
}

async function handleBulkEvaluate(data: unknown): Promise<Response> {
  try {
    const { flagNames, userContext, defaultValues = {} } = data;

    if (!Array.isArray(flagNames) || flagNames.length === 0) {
      return apiResponse(
        createErrorResponse("Flag names array is required"),
        400
      );
    }

    const validatedUserContext = UserContextSchema.parse(userContext);
    const evaluations: Record<string, unknown> = {};

    // Evaluate all flags
    for (const flagName of flagNames) {
      const defaultValue = defaultValues[flagName] || false;
      try {
        evaluations[flagName] = await enhancedFeatureFlagManager.evaluateFlag(
          flagName,
          validatedUserContext,
          defaultValue
        );
      } catch (error) {
        evaluations[flagName] = {
          flagName,
          enabled: defaultValue,
          strategy: "error",
          userInTargetGroup: false,
          evaluationTime: new Date(),
          metadata: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
        };
      }
    }

    return apiResponse(
      createSuccessResponse({
        evaluations,
        count: Object.keys(evaluations).length,
      })
    );
  } catch (error) {
    return apiResponse(
      createErrorResponse("Failed to evaluate feature flags", {
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      400
    );
  }
}
