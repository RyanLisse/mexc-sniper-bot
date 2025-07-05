import { and, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { snipeTargets } from "@/src/db/schemas/supabase-auth";

// Create snipe target endpoint
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Basic validation
    if (!body.userId || !body.symbolName) {
      return NextResponse.json(
        {
          success: false,
          error: "userId and symbolName are required",
        },
        { status: 400 }
      );
    }

    // Insert into database
    const result = await db
      .insert(snipeTargets)
      .values({
        userId: body.userId,
        vcoinId: body.vcoinId || body.symbolName,
        symbolName: body.symbolName,
        entryStrategy: body.entryStrategy || "normal",
        entryPrice: body.entryPrice || null,
        positionSizeUsdt: body.positionSizeUsdt || 100,
        takeProfitLevel: body.takeProfitLevel || null,
        takeProfitCustom: body.takeProfitCustom || null,
        stopLossPercent: body.stopLossPercent || null,
        status: body.status || "pending",
        priority: body.priority || 1,
        targetExecutionTime: body.targetExecutionTime || null,
        confidenceScore: body.confidenceScore || null,
        riskLevel: body.riskLevel || "medium",
        createdAt: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: result[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating snipe target:", error);
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
          error: "userId is required",
        },
        { status: 400 }
      );
    }

    // Build query conditions
    const conditions = [eq(snipeTargets.userId, userId)];
    if (status) {
      conditions.push(eq(snipeTargets.status, status));
    }

    // Fetch targets from database
    const targets = await db
      .select()
      .from(snipeTargets)
      .where(and(...conditions))
      .orderBy(desc(snipeTargets.createdAt))
      .limit(100);

    return NextResponse.json({
      success: true,
      data: targets,
      count: targets.length,
    });
  } catch (error) {
    console.error("Error fetching snipe targets:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch snipe targets",
      },
      { status: 500 }
    );
  }
}
