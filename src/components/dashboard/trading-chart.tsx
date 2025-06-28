"use client";

import { useEffect, useState } from "react";
// Direct imports for Recharts - since TradingChart is already lazy-loaded by dynamic-component-loader
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getUnifiedMexcService } from "@/src/services/api/unified-mexc-service-factory";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { ChartContainer } from "../ui/chart";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";

interface TradingChartProps {
  className?: string;
  symbol?: string; // Allow configurable symbol
}

interface ChartDataPoint {
  date: string;
  volume: number;
  trades: number;
  price?: number;
  timestamp: number;
}

// MEXC kline data format: array of values
// [openTime, open, high, low, close, volume, closeTime, quoteAssetVolume, trades, buyBaseAssetVolume, buyQuoteAssetVolume]
type MexcKlineData = [
  number, // openTime
  string, // open
  string, // high
  string, // low
  string, // close
  string, // volume
  number, // closeTime
  string, // quoteAssetVolume
  number, // trades
  string, // buyBaseAssetVolume
  string  // buyQuoteAssetVolume
];

// Real market data fetcher using MEXC API with actual klines data
const fetchMarketData = async (symbol: string = "BTCUSDT", interval: string = "1d", limit: number = 90): Promise<ChartDataPoint[]> => {
  try {
    const mexcService = await getUnifiedMexcService();
    
    // First, try to get actual historical klines data
    console.log("[TradingChart] Fetching real klines data from MEXC API");
    
    try {
      // Use the new getKlines method to get actual historical candlestick data
      const klinesResponse = await (mexcService as any).getKlines?.(symbol, interval, limit);
      
      if (klinesResponse && klinesResponse.success && Array.isArray(klinesResponse.data) && klinesResponse.data.length > 0) {
        console.log("[TradingChart] Using real historical klines data");
        const chartData = convertKlinesToChartData(klinesResponse.data);
        (chartData as any)._dataSource = "real";
        return chartData;
      }
    } catch (klinesError) {
      console.warn("[TradingChart] Klines API call failed, falling back to ticker data:", klinesError);
    }
    
    // Fallback to ticker data approach
    try {
      const tickerResponse = await mexcService.get24hrTicker(symbol);
      if (tickerResponse.success && Array.isArray(tickerResponse.data) && tickerResponse.data.length > 0) {
        console.log("[TradingChart] Using ticker data for historical simulation");
        const chartData = generateHistoricalDataFromTicker(tickerResponse.data[0], limit);
        (chartData as any)._dataSource = "ticker";
        return chartData;
      }
    } catch (tickerError) {
      console.warn("[TradingChart] Ticker API call failed, trying all tickers:", tickerError);
    }
    
    // Try to get all tickers as fallback
    try {
      const allTickersResponse = await mexcService.get24hrTicker();
      if (allTickersResponse.success && Array.isArray(allTickersResponse.data)) {
        const targetTicker = allTickersResponse.data.find((ticker: any) => ticker.symbol === symbol);
        if (targetTicker) {
          console.log("[TradingChart] Found ticker in all tickers response");
          const chartData = generateHistoricalDataFromTicker(targetTicker, limit);
          (chartData as any)._dataSource = "ticker";
          return chartData;
        }
      }
    } catch (allTickersError) {
      console.warn("[TradingChart] All tickers API call failed:", allTickersError);
    }
    
    // Final fallback to realistic demo data
    console.warn("[TradingChart] All API calls failed, using demo data");
    const demoData = generateRealisticDemoData(limit);
    (demoData as any)._dataSource = "demo";
    return demoData;

  } catch (error) {
    console.error("[TradingChart] Failed to fetch market data:", error);
    
    // Fallback to realistic demo data on error
    const demoData = generateRealisticDemoData(limit);
    (demoData as any)._dataSource = "demo";
    return demoData;
  }
};

// Convert MEXC klines data to chart data format
const convertKlinesToChartData = (klinesData: MexcKlineData[]): ChartDataPoint[] => {
  const data: ChartDataPoint[] = [];
  
  // MEXC kline data format: [openTime, open, high, low, close, volume, closeTime, quoteAssetVolume, trades, buyBaseAssetVolume, buyQuoteAssetVolume]
  klinesData.forEach((kline, index) => {
    const [openTime, open, high, low, close, volume, closeTime, quoteAssetVolume, trades] = kline;
    
    const date = new Date(openTime);
    const volumeNum = parseFloat(volume);
    const tradesNum = typeof trades === 'number' ? trades : parseInt(String(trades), 10) || 0;
    const closePrice = parseFloat(close);
    
    data.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      volume: Math.floor(volumeNum),
      trades: tradesNum,
      price: closePrice,
      timestamp: openTime,
    });
  });
  
  // Sort by timestamp to ensure chronological order
  data.sort((a, b) => a.timestamp - b.timestamp);
  
  console.log("[TradingChart] Converted", klinesData.length, "klines to chart data");
  return data;
};

// Generate historical-looking data from current ticker
const generateHistoricalDataFromTicker = (ticker: any, days: number): ChartDataPoint[] => {
  const data: ChartDataPoint[] = [];
  const today = new Date();
  
  // Extract data from MEXC ticker format
  const currentVolume = parseFloat(ticker.volume || ticker.v || "50000");
  const currentPrice = parseFloat(ticker.lastPrice || ticker.price || ticker.c || "50000");
  const currentTrades = parseInt(String(ticker.count || ticker.t || "0"), 10) || Math.floor(currentVolume / 100);

  console.log("[TradingChart] Ticker data:", {
    symbol: ticker.symbol,
    volume: currentVolume,
    price: currentPrice,
    trades: currentTrades,
  });

  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Generate realistic volume variation based on current volume
    const volumeVariation = 0.7 + Math.random() * 0.6; // 70-130% of current volume
    const volume = Math.floor(Math.max(1000, currentVolume * volumeVariation));

    // Generate realistic trade count variation
    const tradesVariation = 0.8 + Math.random() * 0.4; // 80-120% of current trades
    const trades = Math.floor(Math.max(10, currentTrades * tradesVariation));

    // Generate realistic price variation with market-like movements
    const priceVariation = 0.95 + Math.random() * 0.1; // ±5% price variation
    const price = currentPrice * priceVariation;

    data.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      volume: volume,
      trades: trades,
      price: price,
      timestamp: date.getTime(),
    });
  }

  return data;
};

// Generate realistic demo data as final fallback
const generateRealisticDemoData = (days: number): ChartDataPoint[] => {
  const data: ChartDataPoint[] = [];
  const today = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Generate realistic trading volume data with market-like patterns
    const baseVolume = 45000 + Math.random() * 25000;
    const marketCycle = Math.sin((i / days) * Math.PI * 2) * 15000; // Weekly cycle
    const dailyVariation = (Math.random() - 0.5) * 10000;
    
    const volume = Math.floor(Math.max(1000, baseVolume + marketCycle + dailyVariation));

    data.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      volume: volume,
      trades: Math.floor(volume / 85), // More realistic trade count ratio
      price: 50000 + Math.sin(i * 0.2) * 2000 + Math.random() * 1000,
      timestamp: date.getTime(),
    });
  }

  return data;
};

const chartConfig = {
  volume: {
    label: "Volume",
    color: "hsl(var(--chart-1))",
  },
  trades: {
    label: "Trades",
    color: "hsl(var(--chart-2))",
  },
};

export function TradingChart({ className, symbol = "BTCUSDT" }: TradingChartProps) {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("90d");
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"real" | "ticker" | "demo">("real");

  // Map time ranges to API intervals and limits
  const getIntervalAndLimit = (range: "7d" | "30d" | "90d") => {
    switch (range) {
      case "7d":
        return { interval: "1h", limit: 168 }; // 7 days * 24 hours
      case "30d":
        return { interval: "6h", limit: 120 }; // 30 days * 4 intervals per day
      case "90d":
        return { interval: "1d", limit: 90 }; // 90 days
      default:
        return { interval: "1d", limit: 90 };
    }
  };

  // Fetch market data when component mounts or time range changes
  useEffect(() => {
    const loadMarketData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { interval, limit } = getIntervalAndLimit(timeRange);
        const data = await fetchMarketData(symbol, interval, limit);
        
        setChartData(data);
        
        // Determine data source based on how the data was fetched
        // We'll pass this information from the fetchMarketData function
        const dataSourceMetadata = (data as any)._dataSource || "demo";
        setDataSource(dataSourceMetadata);
      } catch (err) {
        console.error("[TradingChart] Error loading market data:", err);
        setError("Failed to load market data");
        setDataSource("demo");
      } finally {
        setIsLoading(false);
      }
    };

    loadMarketData();

    // Set up periodic refresh for real-time data
    const refreshInterval = setInterval(loadMarketData, 60000); // Refresh every minute

    return () => clearInterval(refreshInterval);
  }, [timeRange, symbol]);

  const getDaysDescription = () => {
    switch (timeRange) {
      case "7d":
        return "7 days";
      case "30d":
        return "30 days";
      case "90d":
        return "3 months";
      default:
        return "3 months";
    }
  };

  const getDataSourceIndicator = () => {
    switch (dataSource) {
      case "real":
        return "• Real historical data";
      case "ticker":
        return "• Market data simulation";
      case "demo":
        return "• Demo data";
      default:
        return "";
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-col space-y-0 pb-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            Trading Volume
            {isLoading && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary"></div>
            )}
          </CardTitle>
          <CardDescription>
            {symbol} volume for the last {getDaysDescription()} {getDataSourceIndicator()}
            {error && <span className="text-destructive ml-2">({error})</span>}
          </CardDescription>
        </div>
        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
          <TabsList>
            <TabsTrigger value="90d">Last 3 months</TabsTrigger>
            <TabsTrigger value="30d">Last 30 days</TabsTrigger>
            <TabsTrigger value="7d">Last 7 days</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                content={(props: { active?: boolean; payload?: any[]; label?: string }) => {
                  const { active, payload, label } = props;
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as ChartDataPoint;
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-md">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Date
                            </span>
                            <span className="font-bold text-muted-foreground">
                              {label}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Volume
                            </span>
                            <span className="font-bold">
                              {data.volume.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                              Trades
                            </span>
                            <span className="font-bold">
                              {data.trades.toLocaleString()}
                            </span>
                          </div>
                          {data.price && (
                            <div className="flex flex-col">
                              <span className="text-[0.70rem] uppercase text-muted-foreground">
                                Price
                              </span>
                              <span className="font-bold">
                                ${data.price.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="volume"
                stroke="hsl(var(--chart-1))"
                fillOpacity={1}
                fill="url(#colorVolume)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// Optimized default export for dynamic loading
export { TradingChart as default };
