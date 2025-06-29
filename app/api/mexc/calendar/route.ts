import { NextResponse } from "next/server";
import { 
  apiResponse, 
  createErrorResponse, 
  createSuccessResponse, 
  HTTP_STATUS 
} from "@/src/lib/api-response";
import { getRecommendedMexcService } from "@/src/services/api/mexc-unified-exports";

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
    console.error("MEXC calendar fetch failed:", { error: error });
    
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