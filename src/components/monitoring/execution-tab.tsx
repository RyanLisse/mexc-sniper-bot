/**
 * Execution Tab Component
 *
 * Displays execution analytics including order execution speed, fill rates,
 * slippage analysis, execution costs, and latency metrics.
 */

import React, { lazy, memo, Suspense, useMemo } from "react";
import { ErrorBoundary } from "../error-boundary";

// Import Recharts components directly to avoid complex dynamic import typing issues
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { generateChartCellKey, generateListKey } from "../../lib/react-utilities";
import type { AnalyticsTabProps } from "../../types/trading-analytics-types";

export const ExecutionTab = memo(function ExecutionTab({
  data,
  formatCurrency,
  formatPercentage,
  getPerformanceColor,
}: AnalyticsTabProps) {
  // Memoize chart data for performance
  const fillRatesData = useMemo(() => {
    if (!data?.executionAnalytics?.fillRates) return [];
    return [
      { name: "Full Fill", value: data.executionAnalytics.fillRates.fullFill },
      { name: "Partial Fill", value: data.executionAnalytics.fillRates.partialFill },
      { name: "No Fill", value: data.executionAnalytics.fillRates.noFill },
    ];
  }, [data?.executionAnalytics?.fillRates]);

  return (
    <div className="space-y-4">
      {/* Execution Speed and Fill Rates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Execution Speed</CardTitle>
            <CardDescription>Order execution latency metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {data.executionAnalytics.orderExecutionSpeed.average.toFixed(0)}ms
                </div>
                <p className="text-xs text-muted-foreground">Average</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {data.executionAnalytics.orderExecutionSpeed.p95.toFixed(0)}ms
                </div>
                <p className="text-xs text-muted-foreground">95th Percentile</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {data.executionAnalytics.orderExecutionSpeed.p99.toFixed(0)}ms
                </div>
                <p className="text-xs text-muted-foreground">99th Percentile</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fill Rates</CardTitle>
            <CardDescription>Order fill success rates</CardDescription>
          </CardHeader>
          <CardContent>
            <ErrorBoundary
              level="component"
              fallback={
                <div className="w-full h-[200px] flex items-center justify-center border border-blue-200 rounded text-blue-600">
                  Fill rates chart temporarily unavailable
                </div>
              }
            >
              <Suspense
                fallback={
                  <div className="w-full h-[200px] animate-pulse bg-gray-100 rounded">
                    Loading chart...
                  </div>
                }
              >
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={fillRatesData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, value }: any) => `${name}: ${value}%`}
                    >
                      {["#8884d8", "#82ca9d", "#ffc658"].map((color, index) => (
                        <Cell key={generateChartCellKey(index, `fill-${color}`)} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Suspense>
            </ErrorBoundary>
          </CardContent>
        </Card>
      </div>

      {/* Slippage, Costs, and Latency */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Slippage Analysis</CardTitle>
            <CardDescription>Trade slippage metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Average</p>
                <p className="text-2xl font-bold">
                  {data.executionAnalytics.slippageMetrics.averageSlippage.toFixed(3)}%
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Maximum</p>
                <p className="text-2xl font-bold text-red-600">
                  {data.executionAnalytics.slippageMetrics.maxSlippage.toFixed(3)}%
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {data.executionAnalytics.slippageMetrics.slippageDistribution.map((dist, index) => (
                <div
                  key={generateListKey(dist, index, "range")}
                  className="flex justify-between items-center"
                >
                  <span className="text-sm">{dist.range}</span>
                  <Badge variant="outline">{dist.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Execution Costs</CardTitle>
            <CardDescription>Breakdown of trading costs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm">Trading Fees</span>
                <span className="font-medium">
                  {formatCurrency(data.executionAnalytics.executionCosts.tradingFees)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Slippage Costs</span>
                <span className="font-medium">
                  {formatCurrency(data.executionAnalytics.executionCosts.slippageCosts)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Market Impact</span>
                <span className="font-medium">
                  {formatCurrency(data.executionAnalytics.executionCosts.marketImpactCosts)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latency Metrics</CardTitle>
            <CardDescription>System latency breakdown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Order to Exchange</span>
                  <span>{data.executionAnalytics.latencyMetrics.orderToExchange.toFixed(1)}ms</span>
                </div>
                <Progress
                  value={data.executionAnalytics.latencyMetrics.orderToExchange}
                  className="h-2"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Market Data</span>
                  <span>
                    {data.executionAnalytics.latencyMetrics.marketDataLatency.toFixed(1)}ms
                  </span>
                </div>
                <Progress
                  value={data.executionAnalytics.latencyMetrics.marketDataLatency * 2}
                  className="h-2"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>System Latency</span>
                  <span>{data.executionAnalytics.latencyMetrics.systemLatency.toFixed(1)}ms</span>
                </div>
                <Progress
                  value={data.executionAnalytics.latencyMetrics.systemLatency * 5}
                  className="h-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

export default ExecutionTab;
