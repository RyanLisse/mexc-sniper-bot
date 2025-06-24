import { NextRequest, NextResponse } from "next/server";
import { createSafeLogger } from '../../../../../../src/lib/structured-logger';
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { db } from "../../../../../../src/db";
import { NotificationService } from "../../../../../../src/services/notification-providers";
import { validateRequest } from "../../../../../../src/lib/api-auth";
import { handleApiError } from "../../../../../../src/lib/api-response";

// ==========================================
// POST /api/alerts/channels/[id]/test - Test notification channel
// ==========================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Create logger lazily to prevent build-time issues
  let logger: ReturnType<typeof createSafeLogger>;
  try {
    logger = createSafeLogger('route');
  } catch {
    // Fallback to console during build
    logger = { 
      error: console.error.bind(console),
      info: console.log.bind(console),
      warn: console.warn.bind(console),
      debug: console.debug.bind(console)
    } as any;
  }

  try {
    const { id } = await params;
    const user = await validateRequest(request);
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
      return NextResponse.json({
        success: false,
        error: "Test notification failed",
        details: result.error,
      }, { status: 400 });
    }
  } catch (error) {
    logger.error("Error testing notification channel:", { error: error });
    return handleApiError(error);
  }
}