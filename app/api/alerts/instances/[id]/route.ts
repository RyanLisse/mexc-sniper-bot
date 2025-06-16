import { NextRequest, NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { db } from "@/src/db";
import { AutomatedAlertingService } from "@/src/services/automated-alerting-service";
import { validateRequest } from "@/src/lib/api-auth";
import { handleApiError } from "@/src/lib/api-response";
import { alertInstances } from "@/src/db/schemas/alerts";
import { eq } from "drizzle-orm";
import { z } from "zod";

const alertingService = new AutomatedAlertingService(db);

// ==========================================
// GET /api/alerts/instances/[id] - Get specific alert instance
// ==========================================
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await validateRequest(request);
    // validateRequest already throws if not authenticated, so if we reach here, user is authenticated

    const alert = await db
      .select()
      .from(alertInstances)
      .where(eq(alertInstances.id, params.id))
      .limit(1);

    if (alert.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Alert instance not found",
      }, { status: 404 });
    }

    const alertInstance = alert[0];

    // Format alert for client consumption
    const formattedAlert = {
      ...alertInstance,
      labels: alertInstance.labels ? JSON.parse(alertInstance.labels) : {},
      additionalData: alertInstance.additionalData ? JSON.parse(alertInstance.additionalData) : {},
      formattedTimestamp: new Date(alertInstance.firstTriggeredAt).toISOString(),
      formattedLastTriggered: new Date(alertInstance.lastTriggeredAt).toISOString(),
      formattedResolvedAt: alertInstance.resolvedAt ? new Date(alertInstance.resolvedAt).toISOString() : null,
      isResolved: !!alertInstance.resolvedAt,
      resolutionTime: alertInstance.resolvedAt ? new Date(alertInstance.resolvedAt).getTime() - new Date(alertInstance.firstTriggeredAt).getTime() : null,
      duration: Date.now() - new Date(alertInstance.firstTriggeredAt).getTime(),
    };

    return NextResponse.json({
      success: true,
      data: formattedAlert,
    });
  } catch (error) {
    console.error("Error fetching alert instance:", error);
    return handleApiError(error);
  }
}

// ==========================================
// PATCH /api/alerts/instances/[id] - Resolve or acknowledge alert
// ==========================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await validateRequest(request);
    // validateRequest already throws if not authenticated, so if we reach here, user is authenticated

    const body = await request.json();
    const { action, notes } = z.object({
      action: z.enum(["resolve", "acknowledge", "suppress"]),
      notes: z.string().optional(),
    }).parse(body);

    // Check if alert exists
    const existingAlert = await db
      .select()
      .from(alertInstances)
      .where(eq(alertInstances.id, params.id))
      .limit(1);

    if (existingAlert.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Alert instance not found",
      }, { status: 404 });
    }

    const alert = existingAlert[0];

    switch (action) {
      case "resolve":
        if (alert.status === "resolved") {
          return NextResponse.json({
            success: false,
            error: "Alert is already resolved",
          }, { status: 400 });
        }

        await alertingService.resolveAlert(
          params.id,
          user.id,
          notes || "Manually resolved by user"
        );

        return NextResponse.json({
          success: true,
          message: "Alert resolved successfully",
        });

      case "acknowledge":
        // Update alert to acknowledged status
        await db
          .update(alertInstances)
          .set({
            status: "acknowledged",
            resolutionNotes: notes,
          })
          .where(eq(alertInstances.id, params.id));

        return NextResponse.json({
          success: true,
          message: "Alert acknowledged successfully",
        });

      case "suppress":
        // Update alert to suppressed status
        await db
          .update(alertInstances)
          .set({
            status: "suppressed",
            resolutionNotes: notes,
          })
          .where(eq(alertInstances.id, params.id));

        return NextResponse.json({
          success: true,
          message: "Alert suppressed successfully",
        });

      default:
        return NextResponse.json({
          success: false,
          error: "Invalid action",
        }, { status: 400 });
    }
  } catch (error) {
    console.error("Error updating alert instance:", error);
    return handleApiError(error);
  }
}