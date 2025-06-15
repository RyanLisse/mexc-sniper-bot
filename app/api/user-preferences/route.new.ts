/**
 * User Preferences API - Migrated to new middleware system
 * 
 * This is an example migration of the user preferences API to use the new
 * standardized middleware system. Compare with route.ts to see the improvements.
 */

import { NextRequest } from 'next/server';
import { db, userPreferences, type NewUserPreferences } from '@/src/db';
import { eq } from 'drizzle-orm';
import { 
  userHandler,
  publicHandler,
  type ApiContext 
} from '@/src/lib/api-middleware';
import { 
  UserPreferencesQuerySchema,
  CompleteUserPreferencesSchema 
} from '@/src/lib/api-schemas';
import { HTTP_STATUS } from '@/src/lib/api-response';

// GET /api/user-preferences?userId=xxx
export const GET = userHandler('query', {
  validation: UserPreferencesQuerySchema,
  rateLimit: 'auth',
  logging: true,
})(async (request: NextRequest, context: ApiContext) => {
  const userId = context.searchParams.get('userId')!; // Already validated by middleware

  const result = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  if (result.length === 0) {
    return context.success(null, {
      message: 'No preferences found for user'
    });
  }

  const prefs = result[0];
  const patternParts = prefs.readyStatePattern.split(",").map(Number);

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
    takeProfitCustom: prefs.takeProfitCustom,
    defaultTakeProfitLevel: prefs.defaultTakeProfitLevel,
    stopLossPercent: prefs.stopLossPercent,
    riskTolerance: prefs.riskTolerance as "low" | "medium" | "high",
    readyStatePattern: [patternParts[0] || 2, patternParts[1] || 2, patternParts[2] || 4] as [number, number, number],
    targetAdvanceHours: prefs.targetAdvanceHours,
    calendarPollIntervalSeconds: prefs.calendarPollIntervalSeconds,
    symbolsPollIntervalSeconds: prefs.symbolsPollIntervalSeconds,
    // Exit Strategy Settings
    selectedExitStrategy: prefs.selectedExitStrategy || "balanced",
    customExitStrategy: prefs.customExitStrategy ? JSON.parse(prefs.customExitStrategy) : undefined,
    autoBuyEnabled: prefs.autoBuyEnabled ?? true,
    autoSellEnabled: prefs.autoSellEnabled ?? true,
    autoSnipeEnabled: prefs.autoSnipeEnabled ?? true,
  };

  return context.success(response);
});

// POST /api/user-preferences
export const POST = userHandler('body', {
  parseBody: true,
  validation: CompleteUserPreferencesSchema,
  rateLimit: 'auth',
  logging: true,
})(async (request: NextRequest, context: ApiContext) => {
  const { userId, ...data } = context.body;

  const updateData: Partial<NewUserPreferences> = {
    userId,
    updatedAt: new Date(),
  };

  // Map the structured data to database fields with validation already applied
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      switch (key) {
        case 'defaultBuyAmountUsdt':
        case 'maxConcurrentSnipes':
        case 'takeProfitLevel1':
        case 'takeProfitLevel2':
        case 'takeProfitLevel3':
        case 'takeProfitLevel4':
        case 'takeProfitCustom':
        case 'defaultTakeProfitLevel':
        case 'stopLossPercent':
        case 'riskTolerance':
        case 'targetAdvanceHours':
        case 'calendarPollIntervalSeconds':
        case 'symbolsPollIntervalSeconds':
        case 'selectedExitStrategy':
        case 'autoBuyEnabled':
        case 'autoSellEnabled':
        case 'autoSnipeEnabled':
          (updateData as any)[key] = value;
          break;
        case 'readyStatePattern':
          updateData.readyStatePattern = (value as number[]).join(",");
          break;
        case 'customExitStrategy':
          updateData.customExitStrategy = JSON.stringify(value);
          break;
        case 'takeProfitLevels':
          // Handle structured take profit levels
          const levels = value as any;
          if (levels.level1 !== undefined) updateData.takeProfitLevel1 = levels.level1;
          if (levels.level2 !== undefined) updateData.takeProfitLevel2 = levels.level2;
          if (levels.level3 !== undefined) updateData.takeProfitLevel3 = levels.level3;
          if (levels.level4 !== undefined) updateData.takeProfitLevel4 = levels.level4;
          if (levels.custom !== undefined) updateData.takeProfitCustom = levels.custom;
          break;
      }
    }
  });

  // Try to update first
  const result = await db
    .update(userPreferences)
    .set(updateData)
    .where(eq(userPreferences.userId, userId))
    .returning();

  if (result.length === 0) {
    // If no rows were updated, create a new record
    const newPrefs: NewUserPreferences = {
      userId,
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
      selectedExitStrategy: data.selectedExitStrategy || "balanced",
      customExitStrategy: data.customExitStrategy ? JSON.stringify(data.customExitStrategy) : null,
      autoBuyEnabled: data.autoBuyEnabled ?? true,
      autoSellEnabled: data.autoSellEnabled ?? true,
      autoSnipeEnabled: data.autoSnipeEnabled ?? true,
      ...updateData,
    };

    await db.insert(userPreferences).values(newPrefs);
  }

  return context.success(data, {
    message: 'User preferences updated successfully'
  });
});

// OPTIONS for CORS support
export const OPTIONS = publicHandler({
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization'],
  },
})(async (request: NextRequest, context: ApiContext) => {
  // CORS is handled by middleware, this is just a placeholder
  return context.success(null, { message: 'CORS preflight request' });
});