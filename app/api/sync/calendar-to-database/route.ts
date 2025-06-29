import { NextRequest, NextResponse } from "next/server";
import { 
  apiResponse, 
  createErrorResponse, 
  createSuccessResponse, 
  HTTP_STATUS 
} from "@/src/lib/api-response";
import { calendarSyncService } from "@/src/services/calendar-to-database-sync";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { 
      userId = "system",
      timeWindowHours = 24,
      forceSync = false,
      dryRun = false 
    } = body;

    console.info('📅 Calendar-to-database sync triggered', {
      userId,
      timeWindowHours,
      forceSync,
      dryRun
    });

    const result = await calendarSyncService.syncCalendarToDatabase(userId, {
      timeWindowHours,
      forceSync,
      dryRun
    });

    if (result.success) {
      return apiResponse(
        createSuccessResponse(result, {
          message: `Sync completed: ${result.created} created, ${result.updated} updated`,
          syncStatus: calendarSyncService.getSyncStatus()
        }),
        HTTP_STATUS.OK
      );
    } else {
      return apiResponse(
        createErrorResponse(
          `Sync failed: ${result.errors.join(', ')}`,
          { ...result }
        ),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  } catch (error) {
    console.error('❌ Calendar sync API error:', error);
    return apiResponse(
      createErrorResponse(
        error instanceof Error ? error.message : 'Unknown sync error'
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function GET() {
  try {
    const status = calendarSyncService.getSyncStatus();
    
    return apiResponse(
      createSuccessResponse(status, {
        message: "Calendar sync status retrieved successfully"
      }),
      HTTP_STATUS.OK
    );
  } catch (error) {
    console.error('❌ Calendar sync status error:', error);
    return apiResponse(
      createErrorResponse(
        error instanceof Error ? error.message : 'Unknown status error'
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}