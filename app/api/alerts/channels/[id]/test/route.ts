import { NextRequest, NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { db } from "../../../../../../src/db";
import { NotificationService } from "../../../../../../src/services/notification-providers";
import { validateRequest } from "../../../../../../src/lib/api-auth";
import { handleApiError } from "../../../../../../src/lib/api-response";

const notificationService = new NotificationService(db);

// ==========================================
// POST /api/alerts/channels/[id]/test - Test notification channel
// ==========================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await validateRequest(request);
    // validateRequest already throws if not authenticated, so if we reach here, user is authenticated

    const result = await notificationService.testNotificationChannel(id);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Test notification sent successfully",
        data: {
          messageId: result.messageId,
          response: result.response,
        },
      });
    } else {
      return NextResponse.json({
        success: false,
        error: "Test notification failed",
        details: result.error,
      }, { status: 400 });
    }
  } catch (error) {
    console.error("Error testing notification channel:", error);
    return handleApiError(error);
  }
}