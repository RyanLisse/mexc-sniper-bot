import { NextRequest, NextResponse } from "next/server";
import { createLogger } from '../../../../src/lib/structured-logger';
import { db } from "../../../../src/db";
import { snipeTargets } from "../../../../src/db/schema";
import { eq } from "drizzle-orm";

const logger = createLogger('route');

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const body = await request.json();
    const targetId = parseInt(resolvedParams.id);

    if (isNaN(targetId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid snipe target ID",
        },
        { status: 400 }
      );
    }

    // Prepare update data - only include fields that are provided
    const updateData: Record<string, any> = {
      updatedAt: Math.floor(Date.now() / 1000),
    };

    // Add only the fields that are provided in the request
    const allowedFields = [
      "status",
      "actualExecutionTime",
      "executionPrice",
      "actualPositionSize",
      "executionStatus",
      "errorMessage",
      "currentRetries",
      "priority",
      "stopLossPercent",
      "takeProfitLevel",
      "takeProfitCustom",
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const result = await db.update(snipeTargets)
      .set(updateData)
      .where(eq(snipeTargets.id, targetId))
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Snipe target not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result[0],
      message: "Snipe target updated successfully",
    });
  } catch (error) {
    logger.error("❌ Error updating snipe target:", { error: error });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update snipe target",
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const targetId = parseInt(resolvedParams.id);

    if (isNaN(targetId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid snipe target ID",
        },
        { status: 400 }
      );
    }

    const result = await db.select()
      .from(snipeTargets)
      .where(eq(snipeTargets.id, targetId))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Snipe target not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result[0],
    });
  } catch (error) {
    logger.error("❌ Error fetching snipe target:", { error: error });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch snipe target",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const targetId = parseInt(resolvedParams.id);

    if (isNaN(targetId)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid snipe target ID",
        },
        { status: 400 }
      );
    }

    const result = await db.delete(snipeTargets)
      .where(eq(snipeTargets.id, targetId))
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Snipe target not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Snipe target deleted successfully",
    });
  } catch (error) {
    logger.error("❌ Error deleting snipe target:", { error: error });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete snipe target",
      },
      { status: 500 }
    );
  }
}