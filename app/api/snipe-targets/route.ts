import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { snipeTargets } from "@/src/db/schema";
import { 
  apiResponse, 
  createErrorResponse, 
  createSuccessResponse, 
  createValidationErrorResponse, 
  HTTP_STATUS
} from "@/src/lib/api-response";
import { validateQueryParams, validateRequestBody } from "@/src/lib/api-validation-middleware";
import { handleApiError } from "@/src/lib/error-handler";
import { 
  CreateSnipeTargetRequestSchema, 
  SnipeTargetQuerySchema 
} from "@/src/schemas/comprehensive-api-validation-schemas";

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const bodyValidation = await validateRequestBody(request, CreateSnipeTargetRequestSchema);
    if (!bodyValidation.success) {
      console.warn('[API] ⚠️ Snipe target creation validation failed:', bodyValidation.error);
      return apiResponse(
        createErrorResponse(bodyValidation.error),
        bodyValidation.statusCode
      );
    }

    const {
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
      targetExecutionTime,
      confidenceScore,
      riskLevel,
    } = bodyValidation.data;

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
    console.error("❌ Error creating snipe target:", { error: error });
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
    // Validate query parameters
    const queryValidation = validateQueryParams(request, SnipeTargetQuerySchema);
    if (!queryValidation.success) {
      console.warn('[API] ⚠️ Snipe target query validation failed:', queryValidation.error);
      return apiResponse(
        createErrorResponse(queryValidation.error),
        queryValidation.statusCode
      );
    }

    const { userId, status, limit, offset } = queryValidation.data;

    let query = db.select().from(snipeTargets).where(eq(snipeTargets.userId, userId));

    if (status) {
      query = db.select()
        .from(snipeTargets)
        .where(and(
          eq(snipeTargets.userId, userId),
          eq(snipeTargets.status, status)
        ));
    }

    // Apply pagination if provided
    if (limit) {
      query = query.limit(limit);
    }
    if (offset) {
      query = query.offset(offset);
    }

    const targets = await query;

    return apiResponse(
      createSuccessResponse(targets, {
        count: targets.length,
        status: status || 'all'
      })
    );
  } catch (error) {
    console.error("❌ Error fetching snipe targets:", { error: error });
    return apiResponse(
      createErrorResponse(
        error instanceof Error ? error.message : "Unknown error occurred"
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}