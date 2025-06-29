import { NextRequest, NextResponse } from "next/server";
import { 
  apiResponse, 
  createErrorResponse, 
  createSuccessResponse, 
  HTTP_STATUS 
} from "@/src/lib/api-response";
import { getRecommendedMexcService } from "@/src/services/api/mexc-unified-exports";

export async function GET(request: NextRequest) {
  try {
    const mexcService = getRecommendedMexcService();
    const { searchParams } = new URL(request.url);
    const vcoinId = searchParams.get('vcoinId');
    
    const symbolsResponse = vcoinId
      ? await mexcService.getSymbolsForVcoins(vcoinId.split(','))
      : await mexcService.getSymbolsData();
    
    if (!symbolsResponse.success || !symbolsResponse.data) {
      return apiResponse(
        createErrorResponse(
          symbolsResponse.error || "Failed to fetch symbols",
          { 
            fallbackData: [],
            serviceLayer: true,
            executionTimeMs: 'executionTimeMs' in symbolsResponse ? symbolsResponse.executionTimeMs : undefined,
          }
        ),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
    
    return apiResponse(
      createSuccessResponse(symbolsResponse.data, {
        count: symbolsResponse.data.length,
        vcoinId: vcoinId || null,
        cached: 'cached' in symbolsResponse ? symbolsResponse.cached : undefined,
        executionTimeMs: 'executionTimeMs' in symbolsResponse ? symbolsResponse.executionTimeMs : undefined,
        serviceLayer: true,
      })
    );
  } catch (error) {
    console.error("MEXC symbols fetch failed:", { error: error });
    
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