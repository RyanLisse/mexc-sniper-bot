import { NextRequest, NextResponse } from "next/server";
import { createLogger } from '../../../../src/lib/structured-logger';
import { getRecommendedMexcService } from "../../../../src/services/mexc-unified-exports";
import { 
  createSuccessResponse, 
  createErrorResponse, 
  apiResponse, 
  HTTP_STATUS 
} from "../../../../src/lib/api-response";

const logger = createLogger('route');

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
    logger.error("MEXC symbols fetch failed:", { error: error });
    
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