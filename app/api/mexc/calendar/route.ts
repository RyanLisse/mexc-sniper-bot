import { NextResponse } from "next/server";
import { mexcApi } from "@/src/services/enhanced-mexc-api";
import { 
  createSuccessResponse, 
  createErrorResponse, 
  handleApiError, 
  apiResponse, 
  HTTP_STATUS 
} from "@/src/lib/api-response";

export async function GET() {
  try {
    const calendar = await mexcApi.getCalendar();
    
    // Ensure data is always an array
    const calendarData = Array.isArray(calendar?.data) ? calendar.data : [];
    
    return apiResponse(
      createSuccessResponse(calendarData, {
        count: calendarData.length
      })
    );
  } catch (error) {
    console.error("MEXC calendar fetch failed:", error);
    
    // Always return an empty array on error for consistency
    return apiResponse(
      createSuccessResponse([], {
        error: error instanceof Error ? error.message : "Unknown error",
        count: 0
      })
    );
  }
}