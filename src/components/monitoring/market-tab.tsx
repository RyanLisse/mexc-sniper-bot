/**
 * Market Tab Component
 *
 * Displays market analysis including market conditions, sector performance,
 * trading opportunities, correlations, and market trends.
 */

import { TrendingDown, TrendingUp } from "lucide-react";
import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { generateListKey } from "../../lib/react-utilities";
import type { AnalyticsTabProps } from "../../types/trading-analytics-types";

export const MarketTab = memo(function MarketTab({
  data,
  formatCurrency,
  formatPercentage,
  getPerformanceColor,
}: AnalyticsTabProps) {
  return (
    <div className="space-y-4">
      {/* Market Conditions and Sector Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Market Conditions</CardTitle>
            <CardDescription>Current market environment assessment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Trend</p>
                <Badge variant="default" className="capitalize">
                  {data.marketAnalytics.marketConditions.trend}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Volatility</p>
                <Badge variant="secondary" className="capitalize">
                  {data.marketAnalytics.marketConditions.volatility}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sentiment</p>
                <Badge variant="default" className="capitalize">
                  {data.marketAnalytics.marketConditions.sentiment}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fear & Greed</p>
                <p className="text-2xl font-bold">
                  {data.marketAnalytics.marketConditions.fearGreedIndex}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sector Performance</CardTitle>
            <CardDescription>Performance by market sector</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.marketAnalytics.sectorPerformance.map((sector, index) => (
                <div
                  key={generateListKey(sector, index, "sector")}
                  className="flex items-center justify-between"
                >
                  <span className="font-medium">{sector.sector}</span>
                  <div className="flex items-center gap-2">
                    {sector.trend === "up" ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                    <Badge variant={sector.performance > 0 ? "default" : "destructive"}>
                      {formatPercentage(sector.performance)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trading Opportunities, Correlations, and Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Trading Opportunities</CardTitle>
            <CardDescription>Identified trading opportunities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.marketAnalytics.tradingOpportunities.map((opportunity, index) => (
                <div
                  key={generateListKey(opportunity, index, "symbol")}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">{opportunity.symbol}</p>
                    <p className="text-xs text-muted-foreground capitalize">{opportunity.type}</p>
                  </div>
                  <Badge variant="default">{opportunity.confidence}%</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Market Correlations</CardTitle>
            <CardDescription>Portfolio correlation to major assets</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>BTC Correlation</span>
                <span>{data.marketAnalytics.correlationToMarket.btcCorrelation.toFixed(2)}</span>
              </div>
              <Progress value={data.marketAnalytics.correlationToMarket.btcCorrelation * 100} />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>ETH Correlation</span>
                <span>{data.marketAnalytics.correlationToMarket.ethCorrelation.toFixed(2)}</span>
              </div>
              <Progress value={data.marketAnalytics.correlationToMarket.ethCorrelation * 100} />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Overall Market</span>
                <span>
                  {data.marketAnalytics.correlationToMarket.overallCorrelation.toFixed(2)}
                </span>
              </div>
              <Progress value={data.marketAnalytics.correlationToMarket.overallCorrelation * 100} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Market Trends</CardTitle>
            <CardDescription>Current market trend analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.marketAnalytics.marketTrends.map((trend, index) => (
                <div key={generateListKey(trend, index, "trend")} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{trend.trend}</span>
                    <Badge
                      variant={
                        trend.impact === "high"
                          ? "destructive"
                          : trend.impact === "medium"
                            ? "secondary"
                            : "default"
                      }
                    >
                      {trend.impact}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Timeframe: {trend.timeframe}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

export default MarketTab;
