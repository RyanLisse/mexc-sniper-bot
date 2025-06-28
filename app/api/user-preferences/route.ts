import { NextRequest, NextResponse } from 'next/server';
import { db, userPreferences, type NewUserPreferences } from "@/src/db";
import { eq } from 'drizzle-orm';
import {
  createSuccessResponse,
  createErrorResponse,
  apiResponse,
  HTTP_STATUS,
  createValidationErrorResponse
} from "@/src/lib/api-response";
import { 
  withApiErrorHandling, 
  withDatabaseErrorHandling, 
  validateUserId,
  DatabaseConnectionError
} from "@/src/lib/central-api-error-handler";

// GET /api/user-preferences?userId=xxx
export const GET = withApiErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const userId = validateUserId(searchParams.get('userId'));

  const result = await withDatabaseErrorHandling(
    () => db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1),
    'fetch user preferences'
  ) as any[];

  if (result.length === 0) {
    return apiResponse(
      createSuccessResponse(null, {
        message: 'No preferences found for user'
      })
    );
  }

  const prefs = result[0];
  
  // Safe pattern parsing with fallbacks
  let patternParts: number[] = [2, 2, 4]; // Default fallback
  try {
    if (prefs.readyStatePattern && typeof prefs.readyStatePattern === 'string') {
      const parts = prefs.readyStatePattern.split(",").map(Number);
      if (parts.length >= 3 && parts.every((p: number) => !isNaN(p) && p > 0)) {
        patternParts = parts;
      }
    }
  } catch (error) {
    console.warn('[API] Failed to parse readyStatePattern, using defaults:', { 
      pattern: prefs.readyStatePattern, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }

  // Safe JSON parsing helper
  const safeJsonParse = (jsonString: string | null | undefined, fallback: any = undefined) => {
    if (!jsonString || typeof jsonString !== 'string') return fallback;
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.warn('[API] Failed to parse JSON field:', { 
        jsonString: jsonString.substring(0, 100), 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return fallback;
    }
  };

  const response = {
    userId: prefs.userId,
    defaultBuyAmountUsdt: prefs.defaultBuyAmountUsdt,
    maxConcurrentSnipes: prefs.maxConcurrentSnipes,
    takeProfitLevels: {
      level1: prefs.takeProfitLevel1,
      level2: prefs.takeProfitLevel2,
      level3: prefs.takeProfitLevel3,
      level4: prefs.takeProfitLevel4,
      custom: prefs.takeProfitCustom || undefined,
    },
    takeProfitSellQuantities: {
      level1: prefs.sellQuantityLevel1 || 25.0,
      level2: prefs.sellQuantityLevel2 || 25.0,
      level3: prefs.sellQuantityLevel3 || 25.0,
      level4: prefs.sellQuantityLevel4 || 25.0,
      custom: prefs.sellQuantityCustom || 100.0,
    },
    takeProfitCustom: prefs.takeProfitCustom,
    defaultTakeProfitLevel: prefs.defaultTakeProfitLevel,
    stopLossPercent: prefs.stopLossPercent,
    riskTolerance: prefs.riskTolerance as "low" | "medium" | "high",
    readyStatePattern: [patternParts[0] || 2, patternParts[1] || 2, patternParts[2] || 4] as [number, number, number],
    targetAdvanceHours: prefs.targetAdvanceHours,
    calendarPollIntervalSeconds: prefs.calendarPollIntervalSeconds,
    symbolsPollIntervalSeconds: prefs.symbolsPollIntervalSeconds,
    // Enhanced Take Profit Strategy Settings
    takeProfitStrategy: prefs.takeProfitStrategy || "balanced",
    takeProfitLevelsConfig: safeJsonParse(prefs.takeProfitLevelsConfig),
    // Legacy Exit Strategy Settings (for backward compatibility)
    selectedExitStrategy: prefs.selectedExitStrategy || "balanced",
    customExitStrategy: safeJsonParse(prefs.customExitStrategy),
    autoBuyEnabled: prefs.autoBuyEnabled ?? true,
    autoSellEnabled: prefs.autoSellEnabled ?? true,
    autoSnipeEnabled: prefs.autoSnipeEnabled ?? true,
  };

  return apiResponse(
    createSuccessResponse(response)
  );
}, { operation: 'user-preferences-get' });

// POST /api/user-preferences
export const POST = withApiErrorHandling(async (request: NextRequest) => {
  const body = await request.json();
  const { userId, ...data } = body;

  const validatedUserId = validateUserId(userId);

  const updateData: Partial<NewUserPreferences> = {
    userId: validatedUserId,
    updatedAt: new Date(),
  };

    // Map the structured data to database fields
    if (data.defaultBuyAmountUsdt !== undefined) {
      updateData.defaultBuyAmountUsdt = data.defaultBuyAmountUsdt;
    }
    if (data.maxConcurrentSnipes !== undefined) {
      updateData.maxConcurrentSnipes = data.maxConcurrentSnipes;
    }

    // Handle take profit levels - support both structured and direct field access
    if (data.takeProfitLevels) {
      updateData.takeProfitLevel1 = data.takeProfitLevels.level1;
      updateData.takeProfitLevel2 = data.takeProfitLevels.level2;
      updateData.takeProfitLevel3 = data.takeProfitLevels.level3;
      updateData.takeProfitLevel4 = data.takeProfitLevels.level4;
      updateData.takeProfitCustom = data.takeProfitLevels.custom;
    }

    // Handle take profit sell quantities
    if (data.takeProfitSellQuantities) {
      updateData.sellQuantityLevel1 = data.takeProfitSellQuantities.level1;
      updateData.sellQuantityLevel2 = data.takeProfitSellQuantities.level2;
      updateData.sellQuantityLevel3 = data.takeProfitSellQuantities.level3;
      updateData.sellQuantityLevel4 = data.takeProfitSellQuantities.level4;
      updateData.sellQuantityCustom = data.takeProfitSellQuantities.custom;
    }

    // Support direct field access for individual take profit levels with validation
    if (data.takeProfitLevel1 !== undefined) {
      if (data.takeProfitLevel1 < 0) {
        return apiResponse(
          createValidationErrorResponse('takeProfitLevel1', 'Take profit level 1 cannot be negative'),
          HTTP_STATUS.BAD_REQUEST
        );
      }
      updateData.takeProfitLevel1 = data.takeProfitLevel1;
    }
    if (data.takeProfitLevel2 !== undefined) {
      if (data.takeProfitLevel2 < 0) {
        return apiResponse(
          createValidationErrorResponse('takeProfitLevel2', 'Take profit level 2 cannot be negative'),
          HTTP_STATUS.BAD_REQUEST
        );
      }
      updateData.takeProfitLevel2 = data.takeProfitLevel2;
    }
    if (data.takeProfitLevel3 !== undefined) {
      if (data.takeProfitLevel3 < 0) {
        return apiResponse(
          createValidationErrorResponse('takeProfitLevel3', 'Take profit level 3 cannot be negative'),
          HTTP_STATUS.BAD_REQUEST
        );
      }
      updateData.takeProfitLevel3 = data.takeProfitLevel3;
    }
    if (data.takeProfitLevel4 !== undefined) {
      if (data.takeProfitLevel4 < 0) {
        return apiResponse(
          createValidationErrorResponse('takeProfitLevel4', 'Take profit level 4 cannot be negative'),
          HTTP_STATUS.BAD_REQUEST
        );
      }
      updateData.takeProfitLevel4 = data.takeProfitLevel4;
    }
    if (data.takeProfitCustom !== undefined) {
      if (data.takeProfitCustom < 0) {
        return apiResponse(
          createValidationErrorResponse('takeProfitCustom', 'Custom take profit level cannot be negative'),
          HTTP_STATUS.BAD_REQUEST
        );
      }
      updateData.takeProfitCustom = data.takeProfitCustom;
    }

    if (data.defaultTakeProfitLevel !== undefined) {
      updateData.defaultTakeProfitLevel = data.defaultTakeProfitLevel;
    }
    if (data.stopLossPercent !== undefined) {
      updateData.stopLossPercent = data.stopLossPercent;
    }
    if (data.riskTolerance !== undefined) {
      updateData.riskTolerance = data.riskTolerance;
    }
    if (data.readyStatePattern !== undefined) {
      updateData.readyStatePattern = data.readyStatePattern.join(",");
    }
    if (data.targetAdvanceHours !== undefined) {
      updateData.targetAdvanceHours = data.targetAdvanceHours;
    }
    if (data.calendarPollIntervalSeconds !== undefined) {
      updateData.calendarPollIntervalSeconds = data.calendarPollIntervalSeconds;
    }
    if (data.symbolsPollIntervalSeconds !== undefined) {
      updateData.symbolsPollIntervalSeconds = data.symbolsPollIntervalSeconds;
    }

    // Safe JSON stringification helper
    const safeJsonStringify = (obj: any): string | null => {
      if (obj === undefined || obj === null) return null;
      try {
        return JSON.stringify(obj);
      } catch (error) {
        console.warn('[API] Failed to stringify JSON object:', { 
          error: error instanceof Error ? error.message : 'Unknown error',
          objectType: typeof obj
        });
        return null;
      }
    };

    // Enhanced Take Profit Strategy Settings
    if (data.takeProfitStrategy !== undefined) {
      updateData.takeProfitStrategy = data.takeProfitStrategy;
    }
    if (data.takeProfitLevelsConfig !== undefined) {
      const stringified = safeJsonStringify(data.takeProfitLevelsConfig);
      if (stringified !== null) {
        updateData.takeProfitLevelsConfig = stringified;
      }
    }

    // Legacy Exit Strategy Settings (for backward compatibility)
    if (data.selectedExitStrategy !== undefined) {
      updateData.selectedExitStrategy = data.selectedExitStrategy;
    }
    if (data.customExitStrategy !== undefined) {
      const stringified = safeJsonStringify(data.customExitStrategy);
      if (stringified !== null) {
        updateData.customExitStrategy = stringified;
      }
    }
    if (data.autoBuyEnabled !== undefined) {
      updateData.autoBuyEnabled = data.autoBuyEnabled;
    }
    if (data.autoSellEnabled !== undefined) {
      updateData.autoSellEnabled = data.autoSellEnabled;
    }
    if (data.autoSnipeEnabled !== undefined) {
      updateData.autoSnipeEnabled = data.autoSnipeEnabled;
    }

  // Try to update first
  const result = await withDatabaseErrorHandling(
    () => db
      .update(userPreferences)
      .set(updateData)
      .where(eq(userPreferences.userId, validatedUserId))
      .returning(),
    'update user preferences'
  ) as any[];

  if (result.length === 0) {
    // If no rows were updated, create a new record
    const newPrefs: NewUserPreferences = {
      userId: validatedUserId,
        defaultBuyAmountUsdt: data.defaultBuyAmountUsdt || 100.0,
        maxConcurrentSnipes: data.maxConcurrentSnipes || 3,
        takeProfitLevel1: data.takeProfitLevel1 || data.takeProfitLevels?.level1 || 5.0,
        takeProfitLevel2: data.takeProfitLevel2 || data.takeProfitLevels?.level2 || 10.0,
        takeProfitLevel3: data.takeProfitLevel3 || data.takeProfitLevels?.level3 || 15.0,
        takeProfitLevel4: data.takeProfitLevel4 || data.takeProfitLevels?.level4 || 25.0,
        takeProfitCustom: data.takeProfitCustom || data.takeProfitLevels?.custom,
        defaultTakeProfitLevel: data.defaultTakeProfitLevel || 2,
        stopLossPercent: data.stopLossPercent || 5.0,
        riskTolerance: data.riskTolerance || "medium",
        readyStatePattern: data.readyStatePattern?.join(",") || "2,2,4",
        targetAdvanceHours: data.targetAdvanceHours || 3.5,
        calendarPollIntervalSeconds: data.calendarPollIntervalSeconds || 300,
        symbolsPollIntervalSeconds: data.symbolsPollIntervalSeconds || 30,
        // Exit Strategy Settings with defaults
        selectedExitStrategy: data.selectedExitStrategy || "balanced",
        customExitStrategy: data.customExitStrategy ? safeJsonStringify(data.customExitStrategy) : null,
        autoBuyEnabled: data.autoBuyEnabled ?? true,
        autoSellEnabled: data.autoSellEnabled ?? true,
        autoSnipeEnabled: data.autoSnipeEnabled ?? true,
        ...updateData,
      };

    await withDatabaseErrorHandling(
      () => db.insert(userPreferences).values(newPrefs),
      'insert user preferences'
    );
  }

  return apiResponse(
    createSuccessResponse(data, {
      message: 'User preferences updated successfully'
    })
  );
}, { operation: 'user-preferences-post' });