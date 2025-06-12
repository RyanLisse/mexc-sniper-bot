import { NextRequest, NextResponse } from "next/server";
import { mexcApi } from "@/src/services/enhanced-mexc-api";
import { 
  createSuccessResponse, 
  createErrorResponse, 
  handleApiError, 
  apiResponse, 
  HTTP_STATUS 
} from "@/src/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vcoinId = searchParams.get('vcoinId');
    
    const symbolsResponse = vcoinId
      ? await mexcApi.getSymbolsForVcoins(vcoinId.split(','))
      : await mexcApi.getSymbolsV2();
    
    return apiResponse(
      createSuccessResponse(symbolsResponse.data.symbols, {
        count: symbolsResponse.data.symbols.length,
        vcoinId: vcoinId || null
      })
    );
  } catch (error) {
    console.error("MEXC symbols fetch failed:", error);
    
    return apiResponse(
      createErrorResponse(
        error instanceof Error ? error.message : "Unknown error",
        { fallbackData: [] }
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}