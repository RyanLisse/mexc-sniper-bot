import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { snipeTargets } from "@/src/db/schemas/trading";

// Test endpoint to create sample snipe targets
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "test-user";

    // Create sample targets
    const sampleTargets = [
      {
        userId,
        vcoinId: "btc-ready",
        symbolName: "BTCUSDT",
        entryStrategy: "normal",
        positionSizeUsdt: 100,
        status: "pending",
        priority: 1,
        confidenceScore: 85,
        riskLevel: "medium",
        targetExecutionTime: Math.floor((Date.now() + 60 * 60 * 1000) / 1000), // 1 hour from now
        createdAt: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
      },
      {
        userId,
        vcoinId: "eth-ready",
        symbolName: "ETHUSDT",
        entryStrategy: "aggressive",
        positionSizeUsdt: 200,
        status: "ready",
        priority: 2,
        confidenceScore: 92,
        riskLevel: "high",
        targetExecutionTime: Math.floor((Date.now() + 30 * 60 * 1000) / 1000), // 30 minutes from now
        createdAt: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
      },
      {
        userId,
        vcoinId: "sol-monitoring",
        symbolName: "SOLUSDT",
        entryStrategy: "conservative",
        positionSizeUsdt: 150,
        status: "pending",
        priority: 3,
        confidenceScore: 67,
        riskLevel: "low",
        targetExecutionTime: Math.floor(
          (Date.now() + 2 * 60 * 60 * 1000) / 1000
        ), // 2 hours from now
        createdAt: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
      },
    ];

    // Insert all sample targets
    const results = await db
      .insert(snipeTargets)
      .values(sampleTargets)
      .returning();

    return NextResponse.json({
      success: true,
      data: results,
      message: `Created ${results.length} sample snipe targets for user ${userId}`,
    });
  } catch (error) {
    console.error("Error creating sample targets:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create sample targets",
      },
      { status: 500 }
    );
  }
}

// Clean up test targets
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "test-user";

    // Delete all targets for the test user
    const deleted = await db
      .delete(snipeTargets)
      .where(eq(snipeTargets.userId, userId))
      .returning();

    return NextResponse.json({
      success: true,
      message: `Deleted ${deleted.length} targets for user ${userId}`,
    });
  } catch (error) {
    console.error("Error deleting test targets:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete test targets",
      },
      { status: 500 }
    );
  }
}
