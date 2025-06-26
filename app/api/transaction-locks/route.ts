import { NextRequest, NextResponse } from "next/server";
import { transactionLockService } from "@/src/services/data/transaction-lock-service";
import { db } from "@/src/db";
import { transactionLocks, transactionQueue } from "@/src/db/schema";
import { eq, and, gte, or, desc } from "drizzle-orm";
import {
  TransactionLockQuerySchema,
  ReleaseLockRequestSchema,
  CheckLockRequestSchema,
  TransactionLocksResponseSchema,
  validateApiQuery,
  validateApiBody,
  createValidatedApiResponse,
} from "@/src/schemas/api-validation-schemas";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Validate query parameters
    const queryValidation = validateApiQuery(TransactionLockQuerySchema, searchParams);
    if (!queryValidation.success) {
      return NextResponse.json(
        { success: false, error: queryValidation.error },
        { status: 400 }
      );
    }
    
    const { resourceId, ownerId, status, limit } = queryValidation.data;

    // Build query conditions
    const conditions = [];
    if (resourceId) conditions.push(eq(transactionLocks.resourceId, resourceId));
    if (ownerId) conditions.push(eq(transactionLocks.ownerId, ownerId));
    if (status) conditions.push(eq(transactionLocks.status, status));

    // Get active locks
    const activeLocks = await db.query.transactionLocks.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(transactionLocks.createdAt)],
      limit,
    });

    // Get queue items
    const queueItems = await db.query.transactionQueue.findMany({
      where: eq(transactionQueue.status, "pending"),
      orderBy: [transactionQueue.priority, transactionQueue.queuedAt],
      limit: 20,
    });

    // Get statistics
    const now = new Date();
    const stats = {
      activeLocks: activeLocks.filter(
        (lock: any) => lock.status === "active" && new Date(lock.expiresAt) > now
      ).length,
      expiredLocks: activeLocks.filter(
        (lock: any) => lock.status === "active" && new Date(lock.expiresAt) <= now
      ).length,
      queueLength: queueItems.length,
      recentlyCompleted: activeLocks.filter(
        (lock: any) => lock.status === "released"
      ).length,
      recentlyFailed: activeLocks.filter(
        (lock: any) => lock.status === "failed"
      ).length,
    };

    const responseData = {
      locks: activeLocks,
      queue: queueItems,
      stats,
    };

    return NextResponse.json(
      createValidatedApiResponse(
        responseData,
        TransactionLocksResponseSchema,
        "Transaction locks data retrieved successfully"
      )
    );
  } catch (error) {
    console.error("Transaction locks API error:", { error: error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch lock data",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Validate request parameters
    const requestData = {
      lockId: searchParams.get("lockId") || undefined,
      ownerId: searchParams.get("ownerId") || undefined,
      force: searchParams.get("force") === "true",
    };
    
    const validation = validateApiBody(ReleaseLockRequestSchema, requestData);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }
    
    const { lockId, ownerId, force: forceRelease } = validation.data;

    if (lockId) {
      // Release specific lock
      const success = await transactionLockService.releaseLock(
        lockId,
        undefined,
        forceRelease ? "Force released via API" : undefined
      );

      return NextResponse.json({
        success,
        message: success ? "Lock released successfully" : "Failed to release lock",
      });
    } else if (ownerId) {
      // Force release all locks for owner
      const releasedCount = await transactionLockService.forceReleaseOwnerLocks(ownerId);

      return NextResponse.json({
        success: true,
        message: `Released ${releasedCount} locks for owner ${ownerId}`,
        releasedCount,
      });
    }

    // Fallback (should not reach here due to validation above)
    return NextResponse.json(
      {
        success: false,
        error: "Invalid request parameters",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Transaction locks release error:", { error: error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to release locks",
      },
      { status: 500 }
    );
  }
}

// Get lock status for a specific resource
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = validateApiBody(CheckLockRequestSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }
    
    const { action, resourceId } = validation.data;

    if (action === "check") {

      const lockStatus = await transactionLockService.getLockStatus(resourceId);
      
      return NextResponse.json({
        success: true,
        data: lockStatus,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Invalid action",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Transaction locks API error:", { error: error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process request",
      },
      { status: 500 }
    );
  }
}