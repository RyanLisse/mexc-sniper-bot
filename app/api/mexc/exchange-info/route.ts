import type { NextRequest } from "next/server";
import {
  apiResponse,
  createErrorResponse,
  createSuccessResponse,
  HTTP_STATUS,
} from "@/src/lib/api-response";
import { getRecommendedMexcService } from "@/src/services/api/mexc-unified-exports";

export async function GET(_request: NextRequest) {
  try {
    const mexcService = getRecommendedMexcService();

    console.info("[exchange-info-api] Fetching exchange info...");

    const exchangeInfoResponse = await mexcService.getExchangeInfo();

    if (!exchangeInfoResponse.success) {
      console.warn(
        "[exchange-info-api] Failed to fetch exchange info:",
        exchangeInfoResponse.error
      );
      return apiResponse(
        createErrorResponse(
          exchangeInfoResponse.error || "Failed to fetch exchange info",
          {
            fallbackData: { symbols: [] },
            serviceLayer: true,
          }
        ),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    const symbolsCount = exchangeInfoResponse.data?.symbols?.length || 0;
    const usdtPairs =
      exchangeInfoResponse.data?.symbols?.filter(
        (s) => s.quoteAsset === "USDT"
      ) || [];

    console.info(
      `[exchange-info-api] ✅ Successfully fetched exchange info: ${symbolsCount} total symbols, ${usdtPairs.length} USDT pairs`
    );

    return apiResponse(
      createSuccessResponse(exchangeInfoResponse.data, {
        totalSymbols: symbolsCount,
        usdtPairs: usdtPairs.length,
        serviceLayer: true,
        cached:
          "cached" in exchangeInfoResponse
            ? exchangeInfoResponse.cached
            : undefined,
      })
    );
  } catch (error) {
    console.error("[exchange-info-api] Exchange info fetch failed:", { error });

    return apiResponse(
      createErrorResponse(
        error instanceof Error ? error.message : "Unknown error",
        {
          fallbackData: { symbols: [] },
          serviceLayer: true,
        }
      ),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
