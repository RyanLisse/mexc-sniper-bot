import { NextRequest, NextResponse } from "next/server";
import { getMexcService } from "@/src/services/mexc-service-layer";
import { 
  createSuccessResponse, 
  createErrorResponse, 
  apiResponse, 
  HTTP_STATUS 
} from "@/src/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const mexcService = getMexcService();
    const { searchParams } = new URL(request.url);
    const vcoinId = searchParams.get('vcoinId');
    
    const symbolsResponse = vcoinId
      ? await mexcService.getSymbolsForVcoins(vcoinId.split(','))
      : await mexcService.getSymbolsData();
    
    if (!symbolsResponse.success) {
      return apiResponse(
        createErrorResponse(
          symbolsResponse.error || "Failed to fetch symbols",
          { 
            fallbackData: [],
            serviceLayer: true,
            executionTimeMs: symbolsResponse.executionTimeMs,
          }
        ),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
    
    return apiResponse(
      createSuccessResponse(symbolsResponse.data, {
        count: symbolsResponse.data.length,
        vcoinId: vcoinId || null,
        cached: symbolsResponse.cached,
        executionTimeMs: symbolsResponse.executionTimeMs,
        serviceLayer: true,
      })
    );
  } catch (error) {
    console.error("MEXC symbols fetch failed:", error);
    
    return apiResponse(
      createErrorResponse(
        error instanceof Error ? error.message : "Unknown error",
        { 
          fallbackData: [],
          serviceLayer: true,
        }
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}