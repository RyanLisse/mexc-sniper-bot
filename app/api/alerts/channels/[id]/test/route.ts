import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { validateRequest } from "@/src/lib/api-auth";
import { handleApiError } from "@/src/lib/api-response";
import { NotificationService } from "@/src/services/notification/notification-providers";

// ==========================================
// POST /api/alerts/channels/[id]/test - Test notification channel
// ==========================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const _user = await validateRequest(request);
    // validateRequest already throws if not authenticated, so if we reach here, user is authenticated

    // Instantiate service at runtime to prevent build-time issues
    const notificationService = new NotificationService(db);
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
      return NextResponse.json(
        {
          success: false,
          error: "Test notification failed",
          details: result.error,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error testing notification channel:", { error: error });
    return handleApiError(error);
  }
}
