"use client";

/**
 * Portfolio Tab Component
 *
 * Displays portfolio allocation, performance metrics, and asset breakdown.
 * Shows portfolio allocation pie chart and key performance indicators.
 */

import { memo, useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  createTooltipFormatter,
  generateChartCellKey,
  generateListKey,
} from "../../lib/react-utilities";
import type { AnalyticsTabProps } from "../../types/trading-analytics-types";
import { CHART_COLORS } from "../../types/trading-analytics-types";

export const PortfolioTab = memo(function PortfolioTab({
  data,
  formatCurrency,
  formatPercentage,
  getPerformanceColor,
}: AnalyticsTabProps) {
  // Memoize chart data for performance
  const portfolioAllocationData = useMemo(() => {
    if (!data?.portfolioMetrics?.allocations) return [];
    return data.portfolioMetrics.allocations;
  }, [data?.portfolioMetrics?.allocations]);

  // Memoize tooltip formatters
  const percentageTooltipFormatter = useMemo(
    () => createTooltipFormatter((value) => `${value}%`),
    []
  );

  return (
    <div className="space-y-4">
      {/* Portfolio Allocation and Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Portfolio Allocation</CardTitle>
            <CardDescription>
              Current asset allocation breakdown
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={portfolioAllocationData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="percentage"
                  nameKey="asset"
                  label={({ asset, percentage }) => `${asset}: ${percentage}%`}
                >
                  {portfolioAllocationData.map((entry, index) => (
                    <Cell
                      key={generateChartCellKey(index, entry.asset)}
                      fill={
                        CHART_COLORS.PRIMARY[
                          index % CHART_COLORS.PRIMARY.length
                        ]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip formatter={percentageTooltipFormatter} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Portfolio Performance</CardTitle>
            <CardDescription>
              Return metrics and risk indicators
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Return</p>
                <p
                  className={`text-2xl font-bold ${getPerformanceColor(data.portfolioMetrics.totalReturn)}`}
                >
                  {formatCurrency(data.portfolioMetrics.totalReturn)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Return %</p>
                <p
                  className={`text-2xl font-bold ${getPerformanceColor(data.portfolioMetrics.returnPercentage)}`}
                >
                  {formatPercentage(data.portfolioMetrics.returnPercentage)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Beta</p>
                <p className="text-2xl font-bold">
                  {data.portfolioMetrics.beta.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Volatility</p>
                <p className="text-2xl font-bold">
                  {data.portfolioMetrics.volatility.toFixed(2)}%
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Day Change</span>
                  <span
                    className={getPerformanceColor(
                      data.portfolioMetrics.dayChange
                    )}
                  >
                    {formatPercentage(data.portfolioMetrics.dayChange)}
                  </span>
                </div>
                <Progress
                  value={Math.abs(data.portfolioMetrics.dayChange) * 10}
                  className="h-2"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Week Change</span>
                  <span
                    className={getPerformanceColor(
                      data.portfolioMetrics.weekChange
                    )}
                  >
                    {formatPercentage(data.portfolioMetrics.weekChange)}
                  </span>
                </div>
                <Progress
                  value={Math.abs(data.portfolioMetrics.weekChange) * 5}
                  className="h-2"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Month Change</span>
                  <span
                    className={getPerformanceColor(
                      data.portfolioMetrics.monthChange
                    )}
                  >
                    {formatPercentage(data.portfolioMetrics.monthChange)}
                  </span>
                </div>
                <Progress
                  value={Math.abs(data.portfolioMetrics.monthChange) * 2}
                  className="h-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers and Risk Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Performers</CardTitle>
            <CardDescription>
              Best performing assets in portfolio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.portfolioMetrics.topPerformers.map((performer, index) => (
                <div
                  key={generateListKey(performer, index, "symbol")}
                  className="flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-sm">{performer.symbol}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-bold ${getPerformanceColor(performer.return)}`}
                    >
                      {formatPercentage(performer.return)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk Metrics</CardTitle>
            <CardDescription>Portfolio risk assessment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Risk-Adjusted Return</span>
                <span>
                  {data.portfolioMetrics.riskAdjustedReturn.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Sharpe Ratio</span>
                <span>{data.tradingPerformance.sharpeRatio.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Max Drawdown</span>
                <span className="text-red-600">
                  {data.tradingPerformance.maxDrawdown.toFixed(2)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

export default PortfolioTab;
