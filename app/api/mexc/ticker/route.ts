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
    const symbol = searchParams.get('symbol');
    const symbols = searchParams.get('symbols');
    
    // Handle single symbol ticker
    if (symbol) {
      console.info(`[ticker-api] Fetching ticker for symbol: ${symbol}`);
      
      const tickerResponse = await mexcService.getTicker(symbol);
      
      if (!tickerResponse.success || !tickerResponse.data) {
        console.warn(`[ticker-api] Failed to fetch ticker for ${symbol}:`, tickerResponse.error);
        return apiResponse(
          createErrorResponse(
            tickerResponse.error || `Failed to fetch ticker for ${symbol}`,
            { 
              symbol,
              fallbackData: null,
              serviceLayer: true,
            }
          ),
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
      
      console.info(`[ticker-api] ✅ Successfully fetched ticker for ${symbol}:`, {
        price: tickerResponse.data.price || tickerResponse.data.lastPrice,
        lastPrice: tickerResponse.data.lastPrice || tickerResponse.data.price,
      });
      
      return apiResponse(
        createSuccessResponse([tickerResponse.data], {
          symbol,
          serviceLayer: true,
          cached: 'cached' in tickerResponse ? tickerResponse.cached : undefined,
        })
      );
    }
    
    // Handle multiple symbols ticker
    if (symbols) {
      const symbolList = symbols.split(',').filter(s => s.trim().length > 0);
      console.info(`[ticker-api] Fetching tickers for ${symbolList.length} symbols:`, symbolList);
      
      const tickerResponse = await mexcService.getTicker24hr(symbolList);
      
      if (!tickerResponse.success || !tickerResponse.data) {
        console.warn(`[ticker-api] Failed to fetch tickers for symbols:`, {
          symbols: symbolList,
          error: tickerResponse.error,
        });
        return apiResponse(
          createErrorResponse(
            tickerResponse.error || "Failed to fetch ticker data",
            { 
              symbols: symbolList,
              fallbackData: [],
              serviceLayer: true,
            }
          ),
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
      
      console.info(`[ticker-api] ✅ Successfully fetched ${tickerResponse.data.length} tickers`);
      
      return apiResponse(
        createSuccessResponse(tickerResponse.data, {
          count: tickerResponse.data.length,
          symbols: symbolList,
          serviceLayer: true,
          cached: 'cached' in tickerResponse ? tickerResponse.cached : undefined,
        })
      );
    }
    
    // Handle all tickers (24hr ticker for all symbols)
    console.info("[ticker-api] Fetching all 24hr tickers");
    
    const allTickersResponse = await mexcService.getTicker24hr();
    
    if (!allTickersResponse.success || !allTickersResponse.data) {
      console.warn("[ticker-api] Failed to fetch all tickers:", allTickersResponse.error);
      return apiResponse(
        createErrorResponse(
          allTickersResponse.error || "Failed to fetch all ticker data",
          { 
            fallbackData: [],
            serviceLayer: true,
          }
        ),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
    
    console.info(`[ticker-api] ✅ Successfully fetched ${allTickersResponse.data.length} tickers`);
    
    return apiResponse(
      createSuccessResponse(allTickersResponse.data, {
        count: allTickersResponse.data.length,
        serviceLayer: true,
        cached: 'cached' in allTickersResponse ? allTickersResponse.cached : undefined,
      })
    );
    
  } catch (error) {
    console.error("[ticker-api] Ticker fetch failed:", { error });
    
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