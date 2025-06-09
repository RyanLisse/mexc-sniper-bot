import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { snipeTargets } from "@/src/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      vcoinId,
      symbolName,
      entryStrategy = "market",
      entryPrice,
      positionSizeUsdt,
      takeProfitLevel = 2,
      takeProfitCustom,
      stopLossPercent = 5.0,
      status = "pending",
      priority = 1,
      maxRetries = 3,
      targetExecutionTime,
      confidenceScore = 0.0,
      riskLevel = "medium",
    } = body;

    if (!userId || !vcoinId || !symbolName) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: userId, vcoinId, symbolName",
        },
        { status: 400 }
      );
    }

    const result = await db.insert(snipeTargets).values({
      userId,
      vcoinId,
      symbolName,
      entryStrategy,
      entryPrice,
      positionSizeUsdt,
      takeProfitLevel,
      takeProfitCustom,
      stopLossPercent,
      status,
      priority,
      maxRetries,
      currentRetries: 0,
      targetExecutionTime,
      confidenceScore,
      riskLevel,
    }).returning();

    return NextResponse.json({
      success: true,
      data: result[0],
      message: "Snipe target created successfully",
    });
  } catch (error) {
    console.error("❌ Error creating snipe target:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create snipe target",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const status = searchParams.get("status");

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameter: userId",
        },
        { status: 400 }
      );
    }

    let query = db.select().from(snipeTargets).where(eq(snipeTargets.userId, userId));

    if (status) {
      query = db.select()
        .from(snipeTargets)
        .where(and(
          eq(snipeTargets.userId, userId),
          eq(snipeTargets.status, status)
        ));
    }

    const targets = await query;

    return NextResponse.json({
      success: true,
      data: targets,
    });
  } catch (error) {
    console.error("❌ Error fetching snipe targets:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch snipe targets",
      },
      { status: 500 }
    );
  }
}