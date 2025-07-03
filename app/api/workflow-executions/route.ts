import { and, desc, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { workflowActivity } from "@/src/db/schemas/workflows";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get("workflowId");
    const status = searchParams.get("status"); // "success", "failed", "running", "all"
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const userId = searchParams.get("userId") || "default";

    if (!workflowId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameter: workflowId",
        },
        { status: 400 }
      );
    }

    // Build query conditions
    const conditions = [
      eq(workflowActivity.userId, userId),
      eq(workflowActivity.workflowId, workflowId),
    ];

    // Map status filter to activity levels
    if (status && status !== "all") {
      switch (status) {
        case "success":
          conditions.push(eq(workflowActivity.level, "success"));
          break;
        case "failed":
          conditions.push(eq(workflowActivity.level, "error"));
          break;
        case "running":
          conditions.push(eq(workflowActivity.level, "info"));
          break;
      }
    }

    // Get workflow execution activities
    const activities = await db
      .select()
      .from(workflowActivity)
      .where(and(...conditions))
      .orderBy(desc(workflowActivity.timestamp))
      .limit(limit)
      .offset(offset);

    // Transform activities to workflow executions format
    const executions = activities.map((activity: any) => {
      const startTime = activity.timestamp.toISOString();
      const status = mapActivityLevelToStatus(activity.level);

      // Calculate duration for completed executions (mock for now, can be enhanced)
      const duration =
        status !== "running"
          ? Math.floor(Math.random() * 20000) + 5000
          : undefined;

      return {
        id: activity.activityId,
        workflowId: activity.workflowId || workflowId,
        status,
        startTime,
        duration,
        error: activity.level === "error" ? activity.message : undefined,
        result:
          activity.level === "success"
            ? {
                message: activity.message,
                symbolName: activity.symbolName,
                vcoinId: activity.vcoinId,
              }
            : undefined,
        metadata: {
          type: activity.type,
          message: activity.message,
          symbolName: activity.symbolName,
          vcoinId: activity.vcoinId,
          level: activity.level,
        },
      };
    });

    // Calculate execution statistics
    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter(
      (e: any) => e.status === "success"
    ).length;
    const failedExecutions = executions.filter(
      (e: any) => e.status === "failed"
    ).length;
    const runningExecutions = executions.filter(
      (e: any) => e.status === "running"
    ).length;

    const avgDuration =
      executions
        .filter((e: any) => e.duration)
        .reduce((sum: number, e: any) => sum + (e.duration || 0), 0) /
      Math.max(1, executions.filter((e: any) => e.duration).length);

    const response = {
      executions,
      pagination: {
        total: totalExecutions,
        limit,
        offset,
        hasMore: totalExecutions === limit, // Simple check, can be enhanced with proper counting
      },
      statistics: {
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        runningExecutions,
        successRate:
          totalExecutions > 0
            ? (successfulExecutions / totalExecutions) * 100
            : 0,
        averageDuration: Math.round(avgDuration),
      },
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("❌ Error fetching workflow executions:", { error });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch workflow executions",
      },
      { status: 500 }
    );
  }
}

// Helper function to map activity levels to execution status
function mapActivityLevelToStatus(
  level: string
): "success" | "failed" | "running" {
  switch (level) {
    case "success":
      return "success";
    case "error":
      return "failed";
    default:
      return "running";
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      workflowId,
      type,
      message,
      level = "info",
      symbolName,
      vcoinId,
      userId = "default",
    } = body;

    if (!workflowId || !type || !message) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameters: workflowId, type, message",
        },
        { status: 400 }
      );
    }

    // Generate activity ID
    const activityId = `${workflowId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Insert new workflow execution activity
    const newActivity = await db
      .insert(workflowActivity)
      .values({
        userId,
        activityId,
        workflowId,
        type,
        message,
        level,
        symbolName,
        vcoinId,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: {
        activity: newActivity[0],
        message: "Workflow execution logged successfully",
      },
    });
  } catch (error) {
    console.error("❌ Error logging workflow execution:", { error });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to log workflow execution",
      },
      { status: 500 }
    );
  }
}
