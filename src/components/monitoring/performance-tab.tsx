/**
 * Performance Tab Component
 *
 * Displays trading performance metrics including P&L trends, performance indicators,
 * best/worst trades, and P&L distribution charts.
 */

import { memo, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { createTooltipFormatter, generateListKey } from "../../lib/react-utilities";
import type { AnalyticsTabProps } from "../../types/trading-analytics-types";

export const PerformanceTab = memo(function PerformanceTab({
  data,
  formatCurrency,
  formatPercentage,
  getPerformanceColor,
}: AnalyticsTabProps) {
  // Memoize chart data for performance
  const chartData = useMemo(() => {
    if (!data?.profitLossAnalytics?.dailyPnL) return [];
    return data.profitLossAnalytics.dailyPnL;
  }, [data?.profitLossAnalytics?.dailyPnL]);

  // Memoize tooltip formatters
  const currencyTooltipFormatter = useMemo(
    () => createTooltipFormatter((value) => formatCurrency(Number(value))),
    [formatCurrency]
  );

  return (
    <div className="space-y-4">
      {/* Daily P&L and Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Daily P&L Trend</CardTitle>
            <CardDescription>Daily profit and loss over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={formatCurrency} />
                <Tooltip
                  formatter={currencyTooltipFormatter}
                  labelFormatter={(date) => `Date: ${date}`}
                />
                <Area
                  type="monotone"
                  dataKey="pnl"
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trading Performance Metrics</CardTitle>
            <CardDescription>Key performance indicators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Win/Loss Ratio</p>
                <p className="text-2xl font-bold">
                  {data.tradingPerformance.winLossRatio.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sharpe Ratio</p>
                <p className="text-2xl font-bold">
                  {data.tradingPerformance.sharpeRatio.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Max Drawdown</p>
                <p className="text-2xl font-bold text-red-600">
                  {data.tradingPerformance.maxDrawdown.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Profit Factor</p>
                <p className="text-2xl font-bold">
                  {data.tradingPerformance.profitFactor.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Performance Breakdown</p>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Trading Volume</span>
                  <span>{formatCurrency(data.tradingPerformance.tradingVolume)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Average Trade Size</span>
                  <span>{formatCurrency(data.tradingPerformance.averageTradeSize)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Average Hold Time</span>
                  <span>{data.tradingPerformance.averageHoldTime.toFixed(1)} hours</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Best/Worst Trades and P&L Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Best Trades</CardTitle>
            <CardDescription>Top performing trades</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.profitLossAnalytics.bestTrades.map((trade, index) => (
                <div
                  key={generateListKey(trade, index, "symbol")}
                  className="flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-sm">{trade.symbol}</p>
                    <p className="text-xs text-muted-foreground">{trade.duration}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">{formatCurrency(trade.pnl)}</p>
                    <p className="text-xs text-muted-foreground">{trade.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Worst Trades</CardTitle>
            <CardDescription>Trades with highest losses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.profitLossAnalytics.worstTrades.map((trade, index) => (
                <div
                  key={generateListKey(trade, index, "symbol")}
                  className="flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-sm">{trade.symbol}</p>
                    <p className="text-xs text-muted-foreground">{trade.duration}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-600">{formatCurrency(trade.pnl)}</p>
                    <p className="text-xs text-muted-foreground">{trade.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>P&L Distribution</CardTitle>
            <CardDescription>Distribution of trade outcomes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.profitLossAnalytics.pnLDistribution.map((dist, index) => (
                <div key={generateListKey(dist, index, "range")} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{dist.range}</span>
                    <span>{dist.percentage}%</span>
                  </div>
                  <Progress value={dist.percentage} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

export default PerformanceTab;
