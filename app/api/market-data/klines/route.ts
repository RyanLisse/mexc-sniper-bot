import { type NextRequest, NextResponse } from "next/server";
import { getUnifiedMexcService } from "@/src/services/api/unified-mexc-service-factory";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol") || "BTCUSDT";
    const interval = searchParams.get("interval") || "1d";
    const limit = parseInt(searchParams.get("limit") || "90");

    console.log("[API] Fetching klines data:", { symbol, interval, limit });

    const mexcService = await getUnifiedMexcService();

    // Use the getKlines method to get actual historical candlestick data
    const klinesResponse = await (mexcService as any).getKlines?.(
      symbol,
      interval,
      limit
    );

    if (klinesResponse?.success && klinesResponse.data?.length > 0) {
      // Transform MEXC kline data to chart format
      const chartData = klinesResponse.data.map((kline: any) => {
        const [
          openTime,
          _open,
          _high,
          _low,
          close,
          volume,
          _closeTime,
          _quoteAssetVolume,
          trades,
        ] = kline;

        return {
          date: new Date(openTime).toISOString().split("T")[0],
          volume: parseFloat(volume),
          trades: trades,
          price: parseFloat(close),
          timestamp: openTime,
        };
      });

      return NextResponse.json({
        success: true,
        data: chartData,
      });
    } else {
      // Fallback to ticker data if klines not available
      console.log("[API] Klines not available, falling back to ticker data");

      const tickerResponse = await mexcService.get24hrTicker(symbol);

      if (
        tickerResponse?.success &&
        Array.isArray(tickerResponse.data) &&
        tickerResponse.data.length > 0
      ) {
        const ticker = tickerResponse.data[0];

        // Generate mock historical data based on current ticker
        const mockData = Array.from({ length: limit }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (limit - i));

          const basePrice = parseFloat(
            ticker.lastPrice || ticker.price || "100"
          );
          const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
          const price = basePrice * (1 + variation);

          return {
            date: date.toISOString().split("T")[0],
            volume:
              parseFloat(ticker.volume || "1000000") *
              (0.8 + Math.random() * 0.4),
            trades: Math.floor(
              parseFloat(String(ticker.count || "5000")) *
                (0.8 + Math.random() * 0.4)
            ),
            price: price,
            timestamp: date.getTime(),
          };
        });

        return NextResponse.json({
          success: true,
          data: mockData,
          fallback: true,
        });
      } else {
        throw new Error("Failed to fetch both klines and ticker data");
      }
    }
  } catch (error) {
    console.error("[API] Error fetching market data:", error);

    // Return mock data as final fallback
    const symbol = new URL(request.url).searchParams.get("symbol") || "BTCUSDT";
    const limit = parseInt(
      new URL(request.url).searchParams.get("limit") || "90"
    );

    const mockData = Array.from({ length: limit }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (limit - i));

      const basePrice = symbol.includes("BTC") ? 45000 : 0.5;
      const variation = (Math.random() - 0.5) * 0.1;
      const price = basePrice * (1 + variation);

      return {
        date: date.toISOString().split("T")[0],
        volume: 1000000 * (0.8 + Math.random() * 0.4),
        trades: Math.floor(5000 * (0.8 + Math.random() * 0.4)),
        price: price,
        timestamp: date.getTime(),
      };
    });

    return NextResponse.json({
      success: true,
      data: mockData,
      error: error instanceof Error ? error.message : "Unknown error",
      fallback: true,
    });
  }
}
