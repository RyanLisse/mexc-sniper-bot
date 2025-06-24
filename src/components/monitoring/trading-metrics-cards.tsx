/**
 * Trading Metrics Cards Component
 *
 * Displays key trading metrics in a grid of cards.
 * Shows portfolio value, success rate, total trades, risk score, and pattern success.
 */

import { Activity, DollarSign, Shield, Target, Zap } from "lucide-react";
import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { TradingAnalyticsData } from "../../types/trading-analytics-types";

interface TradingMetricsCardsProps {
  data: TradingAnalyticsData;
  formatCurrency: (value: number) => string;
  formatPercentage: (value: number) => string;
  getPerformanceColor: (value: number) => string;
}

export const TradingMetricsCards = memo(function TradingMetricsCards({
  data,
  formatCurrency,
  formatPercentage,
  getPerformanceColor,
}: TradingMetricsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Portfolio Value Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(data.portfolioMetrics.currentValue)}
          </div>
          <p className={`text-xs ${getPerformanceColor(data.portfolioMetrics.dayChange)}`}>
            {formatPercentage(data.portfolioMetrics.dayChange)} today
          </p>
        </CardContent>
      </Card>

      {/* Success Rate Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {data.tradingPerformance.successRate.toFixed(1)}%
          </div>
          <Progress value={data.tradingPerformance.successRate} className="mt-2" />
        </CardContent>
      </Card>

      {/* Total Trades Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.tradingPerformance.totalTrades}</div>
          <p className="text-xs text-muted-foreground">
            {data.tradingPerformance.successfulTrades} successful
          </p>
        </CardContent>
      </Card>

      {/* Risk Score Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">
            {data.riskManagement.currentRiskScore.toFixed(0)}
          </div>
          <Progress value={data.riskManagement.currentRiskScore} className="mt-2" />
        </CardContent>
      </Card>

      {/* Pattern Success Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pattern Success</CardTitle>
          <Zap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {data.patternAnalytics.patternSuccessRate.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">
            {data.patternAnalytics.successfulPatterns} /{" "}
            {data.patternAnalytics.totalPatternsDetected}
          </p>
        </CardContent>
      </Card>
    </div>
  );
});

export default TradingMetricsCards;
