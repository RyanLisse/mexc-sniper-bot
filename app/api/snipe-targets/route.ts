import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { snipeTargets } from "@/src/db/schema";
import { eq, and } from "drizzle-orm";
import { 
  createSuccessResponse, 
  createErrorResponse, 
  apiResponse, 
  HTTP_STATUS,
  createValidationErrorResponse
} from "@/src/lib/api-response";
import { handleApiError } from "@/src/lib/error-handler";

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
      return apiResponse(
        createValidationErrorResponse(
          'required_fields', 
          'Missing required fields: userId, vcoinId, symbolName'
        ),
        HTTP_STATUS.BAD_REQUEST
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

    return apiResponse(
      createSuccessResponse(result[0], {
        message: "Snipe target created successfully",
      }),
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    console.error("❌ Error creating snipe target:", error);
    return apiResponse(
      createErrorResponse(
        error instanceof Error ? error.message : "Unknown error occurred"
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const status = searchParams.get("status");

    if (!userId) {
      return apiResponse(
        createValidationErrorResponse('userId', 'Missing required parameter: userId'),
        HTTP_STATUS.BAD_REQUEST
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

    return apiResponse(
      createSuccessResponse(targets, {
        count: targets.length,
        status: status || 'all'
      })
    );
  } catch (error) {
    console.error("❌ Error fetching snipe targets:", error);
    return apiResponse(
      createErrorResponse(
        error instanceof Error ? error.message : "Unknown error occurred"
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}