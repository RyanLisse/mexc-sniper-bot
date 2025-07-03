import { type NextRequest, NextResponse } from "next/server";

// Simplified transaction locks endpoint
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resourceId = searchParams.get("resourceId");
    const ownerId = searchParams.get("ownerId");

    // Mock data
    const locks = [
      {
        id: "1",
        resourceId: resourceId || "resource1",
        ownerId: ownerId || "owner1",
        status: "active",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
    ];

    const responseData = {
      locks,
      queue: [],
      stats: {
        activeLocks: 1,
        expiredLocks: 0,
        queueLength: 0,
        recentlyCompleted: 0,
        recentlyFailed: 0,
      },
    };

    return NextResponse.json({
      success: true,
      data: responseData,
      message: "Transaction locks data retrieved successfully",
    });
  } catch (_error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch lock data",
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

    if (!lockId && !ownerId) {
      return NextResponse.json(
        {
          success: false,
          error: "lockId or ownerId is required",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Lock released successfully",
    });
  } catch (_error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to release locks",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.action || !body.resourceId) {
      return NextResponse.json(
        {
          success: false,
          error: "action and resourceId are required",
        },
        { status: 400 }
      );
    }

    if (body.action === "check") {
      return NextResponse.json({
        success: true,
        data: {
          resourceId: body.resourceId,
          isLocked: false,
          lockInfo: null,
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Invalid action",
      },
      { status: 400 }
    );
  } catch (_error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process request",
      },
      { status: 500 }
    );
  }
}
