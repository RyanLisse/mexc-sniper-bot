import { NextResponse } from "next/server";
import { createSafeLogger } from '../../../../src/lib/structured-logger';
import { getRecommendedMexcService } from "../../../../src/services/mexc-unified-exports";
import { 
  createSuccessResponse, 
  createErrorResponse, 
  apiResponse, 
  HTTP_STATUS 
} from "../../../../src/lib/api-response";

const logger = createSafeLogger('route');

export async function GET() {
  try {
    const mexcService = getRecommendedMexcService();
    const calendarResponse = await mexcService.getCalendarListings();
    
    // Ensure data is always an array
    const calendarData = Array.isArray(calendarResponse.data) ? calendarResponse.data : [];
    
    return apiResponse(
      createSuccessResponse(calendarData, {
        count: calendarData.length,
        cached: calendarResponse.cached,
        executionTimeMs: calendarResponse.executionTimeMs,
        serviceLayer: true,
      })
    );
  } catch (error) {
    logger.error("MEXC calendar fetch failed:", { error: error });
    
    // Always return an empty array on error for consistency
    return apiResponse(
      createSuccessResponse([], {
        error: error instanceof Error ? error.message : "Unknown error",
        count: 0,
        serviceLayer: true,
      })
    );
  }
}