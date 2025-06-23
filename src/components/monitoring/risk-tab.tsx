/**
 * Risk Tab Component
 * 
 * Displays risk management metrics including risk limits, stress test results,
 * exposure metrics, circuit breaker status, and correlation analysis.
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { memo } from "react";
import { generateListKey } from "../../lib/react-utilities";
import type { AnalyticsTabProps } from "../../types/trading-analytics-types";

export const RiskTab = memo(function RiskTab({
  data,
  formatCurrency,
  formatPercentage,
  getPerformanceColor,
}: AnalyticsTabProps) {
  return (
    <div className="space-y-4">
      {/* Risk Limits and Stress Tests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Risk Limits</CardTitle>
            <CardDescription>Current risk exposure vs limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(data.riskManagement.riskLimits).map(([key, limit]) => (
              <div key={key} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                  <span>
                    {limit.current.toFixed(1)} / {limit.limit.toFixed(1)}%
                  </span>
                </div>
                <Progress
                  value={(limit.current / limit.limit) * 100}
                  className={`h-3 ${
                    (limit.current / limit.limit) > 0.8
                      ? "bg-red-100"
                      : limit.current / limit.limit > 0.6
                        ? "bg-yellow-100"
                        : "bg-green-100"
                  }`}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stress Test Results</CardTitle>
            <CardDescription>Portfolio impact under stress scenarios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(data.riskManagement.stressTestResults).map(([scenario, result]) => (
              <div
                key={scenario}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div>
                  <p className="font-medium capitalize">
                    {scenario.replace(/([A-Z])/g, " $1").trim()}
                  </p>
                  <p className="text-xs text-muted-foreground">Recovery: {result.recovery}</p>
                </div>
                <Badge variant="destructive">{result.impact.toFixed(1)}%</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Exposure, Circuit Breaker, and Correlation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Exposure Metrics</CardTitle>
            <CardDescription>Current exposure and leverage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Exposure</p>
              <p className="text-2xl font-bold">
                {formatCurrency(data.riskManagement.exposureMetrics.totalExposure)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Leverage Ratio</p>
              <p className="text-2xl font-bold">
                {data.riskManagement.exposureMetrics.leverageRatio.toFixed(2)}x
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Margin Utilization</p>
              <p className="text-2xl font-bold">
                {data.riskManagement.exposureMetrics.marginUtilization.toFixed(1)}%
              </p>
              <Progress
                value={data.riskManagement.exposureMetrics.marginUtilization}
                className="mt-2"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Circuit Breaker Status</CardTitle>
            <CardDescription>Emergency halt system status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              {data.riskManagement.circuitBreakerStatus.active ? (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-600" />
              )}
              <span
                className={`font-medium ${
                  data.riskManagement.circuitBreakerStatus.active
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {data.riskManagement.circuitBreakerStatus.active ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Trigger Count</span>
                <span>{data.riskManagement.circuitBreakerStatus.triggerCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Last Triggered</span>
                <span>
                  {new Date(
                    data.riskManagement.circuitBreakerStatus.lastTriggered
                  ).toLocaleDateString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Correlation Matrix</CardTitle>
            <CardDescription>Asset correlation analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.riskManagement.correlationMatrix.map((corr, index) => (
                <div
                  key={generateListKey(corr, index, "pair")}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm">{corr.pair}</span>
                  <Badge
                    variant={
                      corr.correlation > 0.7
                        ? "destructive"
                        : corr.correlation > 0.4
                          ? "secondary"
                          : "default"
                    }
                  >
                    {corr.correlation.toFixed(2)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Risk Score</CardTitle>
            <CardDescription>Overall portfolio risk</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">
                {data.riskManagement.currentRiskScore.toFixed(0)}
              </div>
              <p className="text-sm text-muted-foreground">Current Risk Score</p>
            </div>
            <Progress value={data.riskManagement.currentRiskScore} className="h-4" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Value at Risk</CardTitle>
            <CardDescription>Portfolio VaR</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">
                {formatCurrency(data.riskManagement.portfolioVaR)}
              </div>
              <p className="text-sm text-muted-foreground">95% VaR</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Max Position Size</CardTitle>
            <CardDescription>Position size limit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold">
                {data.riskManagement.maxPositionSize.toFixed(1)}%
              </div>
              <p className="text-sm text-muted-foreground">Max Position Size</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Diversification</CardTitle>
            <CardDescription>Portfolio diversification</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {data.riskManagement.diversificationRatio.toFixed(2)}
              </div>
              <p className="text-sm text-muted-foreground">Diversification Ratio</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

export default RiskTab;