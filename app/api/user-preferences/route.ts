import { NextRequest, NextResponse } from 'next/server';
import { db, userPreferences, type NewUserPreferences } from '@/src/db';
import { eq } from 'drizzle-orm';

// GET /api/user-preferences?userId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      );
    }

    const result = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(null);
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
      defaultTakeProfitLevel: prefs.defaultTakeProfitLevel,
      stopLossPercent: prefs.stopLossPercent,
      riskTolerance: prefs.riskTolerance as "low" | "medium" | "high",
      readyStatePattern: [patternParts[0] || 2, patternParts[1] || 2, patternParts[2] || 4] as [number, number, number],
      targetAdvanceHours: prefs.targetAdvanceHours,
      calendarPollIntervalSeconds: prefs.calendarPollIntervalSeconds,
      symbolsPollIntervalSeconds: prefs.symbolsPollIntervalSeconds,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] Failed to fetch user preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user preferences' },
      { status: 500 }
    );
  }
}

// POST /api/user-preferences
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, ...data } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const updateData: Partial<NewUserPreferences> = {
      userId,
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
    
    // Support direct field access for individual take profit levels
    if (data.takeProfitLevel1 !== undefined) {
      updateData.takeProfitLevel1 = data.takeProfitLevel1;
    }
    if (data.takeProfitLevel2 !== undefined) {
      updateData.takeProfitLevel2 = data.takeProfitLevel2;
    }
    if (data.takeProfitLevel3 !== undefined) {
      updateData.takeProfitLevel3 = data.takeProfitLevel3;
    }
    if (data.takeProfitLevel4 !== undefined) {
      updateData.takeProfitLevel4 = data.takeProfitLevel4;
    }
    if (data.takeProfitCustom !== undefined) {
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
        takeProfitLevel1: data.takeProfitLevels?.level1 || 5.0,
        takeProfitLevel2: data.takeProfitLevels?.level2 || 10.0,
        takeProfitLevel3: data.takeProfitLevels?.level3 || 15.0,
        takeProfitLevel4: data.takeProfitLevels?.level4 || 25.0,
        takeProfitCustom: data.takeProfitLevels?.custom,
        defaultTakeProfitLevel: data.defaultTakeProfitLevel || 2,
        stopLossPercent: data.stopLossPercent || 5.0,
        riskTolerance: data.riskTolerance || "medium",
        readyStatePattern: data.readyStatePattern?.join(",") || "2,2,4",
        targetAdvanceHours: data.targetAdvanceHours || 3.5,
        calendarPollIntervalSeconds: data.calendarPollIntervalSeconds || 300,
        symbolsPollIntervalSeconds: data.symbolsPollIntervalSeconds || 30,
        ...updateData,
      };

      await db.insert(userPreferences).values(newPrefs);
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[API] Failed to update user preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update user preferences' },
      { status: 500 }
    );
  }
}