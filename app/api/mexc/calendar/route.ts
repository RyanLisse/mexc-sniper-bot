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
    
    return apiResponse(
      createSuccessResponse(calendar.data, {
        count: calendar.data.length
      })
    );
  } catch (error) {
    console.error("MEXC calendar fetch failed:", error);
    
    return apiResponse(
      createErrorResponse(
        error instanceof Error ? error.message : "Unknown error",
        { fallbackData: [] }
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}