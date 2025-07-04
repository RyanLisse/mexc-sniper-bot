import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db, getUserPreferences } from "@/src/db";
import { userPreferences } from "@/src/db/schemas/auth";
import {
  apiResponse,
  createErrorResponse,
  createSuccessResponse,
  HTTP_STATUS,
} from "@/src/lib/api-response";
import { handleApiError } from "@/src/lib/error-handler";
import { getCoreTrading } from "@/src/services/trading/consolidated/core-trading/base-service";

const coreTrading = getCoreTrading();

/**
 * GET /api/trading-settings
 * Returns current trading settings status and configuration
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");

    if (!userId) {
      return apiResponse(
        createErrorResponse("User ID is required", {
          message: "Please provide userId parameter",
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Get user preferences from database
    const preferences = await getUserPreferences(userId);

    // Get current Core Trading Service status
    const serviceStatus = await coreTrading.getServiceStatus();
    const performanceMetrics = await coreTrading.getPerformanceMetrics();

    const response = {
      userSettings: {
        // Take profit settings
        takeProfitStrategy: preferences?.takeProfitStrategy || "balanced",
        takeProfitLevels: {
          level1: preferences?.takeProfitLevel1 || 5.0,
          level2: preferences?.takeProfitLevel2 || 10.0,
          level3: preferences?.takeProfitLevel3 || 15.0,
          level4: preferences?.takeProfitLevel4 || 25.0,
        },
        customTakeProfitConfig: preferences?.takeProfitLevelsConfig
          ? JSON.parse(preferences.takeProfitLevelsConfig)
          : null,

        // Risk management
        stopLossPercent: preferences?.stopLossPercent || 5.0,
        riskTolerance: preferences?.riskTolerance || "medium",
        maxConcurrentSnipes: preferences?.maxConcurrentSnipes || 3,
        defaultBuyAmount: preferences?.defaultBuyAmountUsdt || 100.0,

        // Automation settings
        autoSnipeEnabled: preferences?.autoSnipeEnabled ?? true,
        autoBuyEnabled: preferences?.autoBuyEnabled ?? true,
        autoSellEnabled: preferences?.autoSellEnabled ?? true,

        // Pattern detection
        readyStatePattern: preferences?.readyStatePattern || "2,2,4",
        targetAdvanceHours: preferences?.targetAdvanceHours || 3.5,
      },

      executionSettings: {
        // Core Trading Service configuration
        paperTradingMode: serviceStatus.paperTradingMode,
        tradingEnabled: serviceStatus.tradingEnabled,
        autoSnipingEnabled: serviceStatus.autoSnipingEnabled,
        maxPositions: serviceStatus.maxPositions,
        currentRiskLevel: serviceStatus.currentRiskLevel,

        // Performance data
        totalPnL: performanceMetrics.totalPnL,
        totalTrades: performanceMetrics.totalTrades,
        successRate: performanceMetrics.successRate,
        uptime: serviceStatus.uptime,
      },

      syncStatus: {
        lastSync: new Date().toISOString(),
        isInSync: true, // We'll determine this by comparing settings
        pendingUpdates: [],
      },
    };

    return apiResponse(
      createSuccessResponse(response, {
        message: "Trading settings retrieved successfully",
      }),
      HTTP_STATUS.OK
    );
  } catch (error) {
    console.error("Trading settings GET error:", error);
    return handleApiError(error, { message: "Failed to get trading settings" });
  }
}

/**
 * POST /api/trading-settings
 * Applies user preferences to Core Trading Service
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userId, settings } = body as {
      action: "sync" | "update" | "reset";
      userId: string;
      settings?: Record<string, unknown>;
    };

    if (!userId) {
      return apiResponse(
        createErrorResponse("User ID is required", {
          message: "Please provide userId",
        }),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    switch (action) {
      case "sync": {
        // Sync user preferences to Core Trading Service
        const preferences = await getUserPreferences(userId);

        if (!preferences) {
          return apiResponse(
            createErrorResponse("User preferences not found", {
              message: `No preferences found for user ${userId}`,
            }),
            HTTP_STATUS.NOT_FOUND
          );
        }

        // Transform user preferences to Core Trading configuration
        const coreConfig = transformPreferencesToCoreConfig(preferences);

        // Apply configuration to Core Trading Service
        const updateResult = await coreTrading.updateConfig(coreConfig);

        if (!updateResult.success) {
          return apiResponse(
            createErrorResponse("Failed to sync settings to execution system", {
              message: updateResult.error,
            }),
            HTTP_STATUS.INTERNAL_SERVER_ERROR
          );
        }

        console.info("🔄 User preferences synced to Core Trading Service:", {
          userId,
          syncedSettings: Object.keys(coreConfig),
        });

        return apiResponse(
          createSuccessResponse(
            {
              syncResult: updateResult,
              appliedConfig: coreConfig,
            },
            { message: "Settings synced to execution system successfully" }
          ),
          HTTP_STATUS.OK
        );
      }

      case "update": {
        if (!settings) {
          return apiResponse(
            createErrorResponse("Settings are required for update action", {
              message: "Please provide settings object",
            }),
            HTTP_STATUS.BAD_REQUEST
          );
        }

        // Update Core Trading Service directly with provided settings
        const updateResult = await coreTrading.updateConfig(settings);

        if (!updateResult.success) {
          return apiResponse(
            createErrorResponse("Failed to update execution system", {
              message: updateResult.error,
            }),
            HTTP_STATUS.INTERNAL_SERVER_ERROR
          );
        }

        // Optionally update user preferences in database
        if (settings.updateDatabase) {
          const transformedPrefs = transformCoreConfigToPreferences(settings);
          await updateUserPreferencesInDatabase(userId, transformedPrefs);
        }

        console.info("⚙️ Trading settings updated:", {
          userId,
          updatedSettings: Object.keys(settings),
        });

        return apiResponse(
          createSuccessResponse(
            { updateResult },
            { message: "Trading settings updated successfully" }
          ),
          HTTP_STATUS.OK
        );
      }

      case "reset": {
        // Reset to default configuration
        const defaultConfig = {
          enablePaperTrading: true,
          maxConcurrentPositions: 3,
          confidenceThreshold: 75,
          stopLossPercent: 5.0,
          takeProfitPercent: 15.0,
          autoSnipingEnabled: false,
        };

        const resetResult = await coreTrading.updateConfig(defaultConfig);

        if (!resetResult.success) {
          return apiResponse(
            createErrorResponse("Failed to reset execution system", {
              message: resetResult.error,
            }),
            HTTP_STATUS.INTERNAL_SERVER_ERROR
          );
        }

        console.info("🔄 Trading settings reset to defaults:", { userId });

        return apiResponse(
          createSuccessResponse(
            { resetResult, defaultConfig },
            { message: "Trading settings reset to defaults" }
          ),
          HTTP_STATUS.OK
        );
      }

      default:
        return apiResponse(
          createErrorResponse("Invalid action", {
            message: "Action must be one of: sync, update, reset",
            availableActions: ["sync", "update", "reset"],
          }),
          HTTP_STATUS.BAD_REQUEST
        );
    }
  } catch (error) {
    console.error("Trading settings POST error:", error);
    return handleApiError(error, {
      message: "Failed to process trading settings request",
    });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Transform user preferences to Core Trading Service configuration
 */
function transformPreferencesToCoreConfig(
  preferences: Partial<typeof userPreferences.$inferSelect>
): Record<string, unknown> {
  const config: Record<string, unknown> = {
    // Position and risk management
    maxConcurrentPositions: preferences.maxConcurrentSnipes || 3,
    maxPositionSize: (preferences.defaultBuyAmountUsdt || 100) / 1000, // Convert to ratio

    // Risk settings
    stopLossPercent: preferences.stopLossPercent || 5.0,

    // Take profit settings
    takeProfitPercent: preferences.takeProfitLevel4 || 25.0, // Use highest level as main target

    // Auto-sniping configuration
    autoSnipingEnabled: preferences.autoSnipeEnabled ?? true,
    confidenceThreshold: 75, // Default for now, could be derived from risk tolerance

    // Pattern detection
    enablePatternDetection: true,
    patternConfig: {
      readyStatePattern: preferences.readyStatePattern || "2,2,4",
      targetAdvanceHours: preferences.targetAdvanceHours || 3.5,
    },

    // Multi-level take profit
    enableMultiPhase: true,
    multiPhaseConfig: {
      levels: [
        { percentage: preferences.takeProfitLevel1 || 5.0, sellPercentage: 25 },
        {
          percentage: preferences.takeProfitLevel2 || 10.0,
          sellPercentage: 35,
        },
        {
          percentage: preferences.takeProfitLevel3 || 15.0,
          sellPercentage: 25,
        },
        {
          percentage: preferences.takeProfitLevel4 || 25.0,
          sellPercentage: 15,
        },
      ],
    },
  };

  // Risk tolerance mapping
  if (preferences.riskTolerance) {
    const riskMapping = {
      low: { confidenceThreshold: 85, maxPositionSize: 0.05 },
      medium: { confidenceThreshold: 75, maxPositionSize: 0.1 },
      high: { confidenceThreshold: 65, maxPositionSize: 0.2 },
    };

    const riskSettings =
      riskMapping[preferences.riskTolerance as keyof typeof riskMapping];
    if (riskSettings) {
      config.confidenceThreshold = riskSettings.confidenceThreshold;
      config.maxPositionSize = riskSettings.maxPositionSize;
    }
  }

  // Custom take profit strategy
  if (preferences.takeProfitLevelsConfig) {
    try {
      const customConfig = JSON.parse(preferences.takeProfitLevelsConfig);
      config.multiPhaseConfig = customConfig;
    } catch (error) {
      console.warn("Failed to parse custom take profit config:", error);
    }
  }

  return config;
}

/**
 * Transform Core Trading config back to user preferences format
 */
function transformCoreConfigToPreferences(
  coreConfig: Record<string, unknown>
): Partial<typeof userPreferences.$inferSelect> {
  return {
    maxConcurrentSnipes: coreConfig.maxConcurrentPositions,
    defaultBuyAmountUsdt:
      typeof coreConfig.maxPositionSize === "number"
        ? coreConfig.maxPositionSize * 1000
        : 100,
    stopLossPercent: coreConfig.stopLossPercent,
    autoSnipeEnabled: coreConfig.autoSnipingEnabled,
    takeProfitLevel4: coreConfig.takeProfitPercent,
  };
}

/**
 * Update user preferences in database
 */
async function updateUserPreferencesInDatabase(
  userId: string,
  updates: Partial<typeof userPreferences.$inferSelect>
): Promise<void> {
  await db
    .update(userPreferences)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(userPreferences.userId, userId));
}
