import { NextRequest, NextResponse } from "next/server";
import { transactionLockService } from "@/src/services/transaction-lock-service";
import { db } from "@/src/db";
import { transactionLocks, transactionQueue } from "@/src/db/schema";
import { eq, and, gte, or, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resourceId = searchParams.get("resourceId");
    const ownerId = searchParams.get("ownerId");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");

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
        (lock) => lock.status === "active" && new Date(lock.expiresAt) > now
      ).length,
      expiredLocks: activeLocks.filter(
        (lock) => lock.status === "active" && new Date(lock.expiresAt) <= now
      ).length,
      queueLength: queueItems.length,
      recentlyCompleted: activeLocks.filter(
        (lock) => lock.status === "released"
      ).length,
      recentlyFailed: activeLocks.filter(
        (lock) => lock.status === "failed"
      ).length,
    };

    return NextResponse.json({
      success: true,
      data: {
        locks: activeLocks,
        queue: queueItems,
        stats,
      },
    });
  } catch (error) {
    console.error("Transaction locks API error:", error);
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
    const lockId = searchParams.get("lockId");
    const ownerId = searchParams.get("ownerId");
    const forceRelease = searchParams.get("force") === "true";

    if (!lockId && !ownerId) {
      return NextResponse.json(
        {
          success: false,
          error: "Either lockId or ownerId is required",
        },
        { status: 400 }
      );
    }

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
  } catch (error) {
    console.error("Transaction locks release error:", error);
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
    const { action, resourceId } = body;

    if (action === "check") {
      if (!resourceId) {
        return NextResponse.json(
          {
            success: false,
            error: "resourceId is required for check action",
          },
          { status: 400 }
        );
      }

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
    console.error("Transaction locks API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process request",
      },
      { status: 500 }
    );
  }
}