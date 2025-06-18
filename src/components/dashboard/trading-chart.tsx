"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { ChartContainer, ChartTooltip } from "../ui/chart";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

interface TradingChartProps {
  className?: string;
}

// Generate sample data for the chart
const generateChartData = (days: number) => {
  const data = [];
  const today = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Generate realistic trading volume data
    const baseVolume = 50000 + Math.random() * 30000;
    const variation = Math.sin(i * 0.3) * 10000 + Math.random() * 5000;

    data.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      volume: Math.floor(baseVolume + variation),
      trades: Math.floor((baseVolume + variation) / 100),
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

export function TradingChart({ className }: TradingChartProps) {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("90d");

  const chartData = generateChartData(timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-col space-y-0 pb-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Trading Volume</CardTitle>
          <CardDescription>
            Total volume for the last{" "}
            {timeRange === "7d" ? "7 days" : timeRange === "30d" ? "30 days" : "3 months"}
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
              <ChartTooltip />
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
