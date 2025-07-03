import { apiResponse, createSuccessResponse } from "@/src/lib/api-response";
import { getRecommendedMexcService } from "@/src/services/api/mexc-unified-exports";

export async function GET() {
  try {
    // Add timeout wrapper for service call
    const mexcService = getRecommendedMexcService();

    const calendarResponse = (await Promise.race([
      mexcService.getCalendarListings(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Service timeout")), 8000)
      ),
    ])) as any;

    // Ensure data is always an array
    const calendarData = Array.isArray(calendarResponse?.data)
      ? calendarResponse.data
      : [];

    return apiResponse(
      createSuccessResponse(calendarData, {
        count: calendarData.length,
        cached: calendarResponse?.cached || false,
        executionTimeMs: calendarResponse?.executionTimeMs || 0,
        serviceLayer: true,
      })
    );
  } catch (error) {
    console.error("MEXC calendar fetch failed:", { error: error });

    // Always return empty array with success status to prevent 404/500 errors
    return apiResponse(
      createSuccessResponse([], {
        error:
          error instanceof Error
            ? error.message
            : "Service temporarily unavailable",
        count: 0,
        serviceLayer: true,
        fallback: true,
      })
    );
  }
}
