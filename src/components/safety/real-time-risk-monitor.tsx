"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Percent, Shield, TrendingDown } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { generateChartCellKey } from "../../lib/react-utilities";

// Real-time Risk Monitoring Interfaces
interface RealTimeRiskData {
  timestamp: string;
  riskScore: number;
  portfolioValue: number;
  exposure: number;
  volatility: number;
  var95: number;
  drawdown: number;
}

interface PositionRisk {
  symbol: string;
  size: number;
  riskContribution: number;
  var95: number;
  correlation: number;
  timeHeld: number;
  pnl: number;
}

interface RiskAlert {
  id: string;
  type: "risk_threshold" | "volatility_spike" | "correlation_break" | "liquidity_gap";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
  acknowledged: boolean;
}

interface StressTestResult {
  scenario: string;
  portfolioLoss: number;
  lossPercentage: number;
  recoveryTime: number;
  riskScore: number;
}

/**
 * Real-Time Risk Monitor
 *
 * Advanced real-time risk monitoring component that provides:
 * - Live risk metrics and trends
 * - Position-level risk analysis
 * - Real-time alerts and warnings
 * - Stress testing visualizations
 * - Dynamic risk thresholds
 */
export function RealTimeRiskMonitor() {
  // Local state for risk history
  const [localRiskHistory, setLocalRiskHistory] = useState<RealTimeRiskData[]>([]);

  // Fetch current risk metrics from API
  const { data: currentRisk, isLoading: riskLoading } = useQuery({
    queryKey: ["risk-metrics", "current"],
    queryFn: async () => {
      const response = await fetch("/api/risk/current-metrics");
      if (!response.ok) throw new Error("Failed to fetch risk metrics");
      const result = await response.json();
      return result.success ? result.data : null;
    },
    refetchInterval: 5000, // Update every 5 seconds
    retry: 2,
  });

  // Fetch risk history for trends
  const { data: riskHistory } = useQuery({
    queryKey: ["risk-metrics", "history"],
    queryFn: async () => {
      const response = await fetch("/api/risk/history?period=1h&interval=15m");
      if (!response.ok) throw new Error("Failed to fetch risk history");
      const result = await response.json();
      return result.success ? result.data : [];
    },
    refetchInterval: 30000, // Update every 30 seconds
    retry: 2,
  });

  // Fetch position risks
  const { data: positionRisks } = useQuery({
    queryKey: ["risk-metrics", "positions"],
    queryFn: async () => {
      const response = await fetch("/api/risk/position-analysis");
      if (!response.ok) throw new Error("Failed to fetch position risks");
      const result = await response.json();
      return result.success ? result.data : [];
    },
    refetchInterval: 10000, // Update every 10 seconds
    retry: 2,
  });

  // Fetch active risk alerts
  const { data: activeAlerts } = useQuery({
    queryKey: ["risk-alerts", "active"],
    queryFn: async () => {
      const response = await fetch("/api/risk/alerts?status=active&limit=10");
      if (!response.ok) throw new Error("Failed to fetch risk alerts");
      const result = await response.json();
      return result.success ? result.data : [];
    },
    refetchInterval: 15000, // Update every 15 seconds
    retry: 2,
  });

  // Fetch stress test results
  const { data: stressTestResults } = useQuery({
    queryKey: ["risk-metrics", "stress-tests"],
    queryFn: async () => {
      const response = await fetch("/api/risk/stress-test-results");
      if (!response.ok) throw new Error("Failed to fetch stress test results");
      const result = await response.json();
      return result.success ? result.data : [];
    },
    refetchInterval: 60000, // Update every minute
    retry: 2,
  });

  // Initialize local history with API data
  useEffect(() => {
    if (riskHistory && riskHistory.length > 0) {
      setLocalRiskHistory(riskHistory);
    }
  }, [riskHistory]);

  // Show loading state if critical data is not available
  if (riskLoading || !currentRisk) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="space-y-2">
                <div className="h-4 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted animate-pulse rounded mb-2" />
                <div className="h-2 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading real-time risk data...</p>
        </div>
      </div>
    );
  }

  const getRiskColor = (score: number) => {
    if (score < 25) return "text-green-600";
    if (score < 50) return "text-yellow-600";
    if (score < 75) return "text-orange-600";
    return "text-red-600";
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case "low":
        return "bg-blue-100 text-blue-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "critical":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const pieColors = ["#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

  return (
    <div className="space-y-6">
      {/* Real-Time Alerts */}
      {activeAlerts && activeAlerts.length > 0 && (
        <div className="space-y-2">
          {activeAlerts.map((alert: RiskAlert) => (
            <Alert
              key={alert.id}
              className={`border-${alert.severity === "critical" ? "red" : alert.severity === "high" ? "orange" : "yellow"}-500`}
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{alert.message}</span>
                <div className="flex items-center gap-2">
                  <Badge className={getAlertColor(alert.severity)}>
                    {alert.severity.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{alert.timestamp}</span>
                </div>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Risk Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getRiskColor(currentRisk.riskScore)}`}>
              {currentRisk.riskScore.toFixed(1)}
            </div>
            <Progress value={currentRisk.riskScore} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {currentRisk.riskScore < 25
                ? "Low Risk"
                : currentRisk.riskScore < 50
                  ? "Medium Risk"
                  : currentRisk.riskScore < 75
                    ? "High Risk"
                    : "Critical Risk"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Value at Risk (95%)</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              ${currentRisk.var95.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {((currentRisk.var95 / currentRisk.portfolioValue) * 100).toFixed(1)}% of portfolio
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Portfolio Exposure</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((currentRisk.totalExposure / currentRisk.portfolioValue) * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              ${currentRisk.totalExposure.toLocaleString()} exposed
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Volatility Index</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                currentRisk.volatilityIndex > 50
                  ? "text-red-600"
                  : currentRisk.volatilityIndex > 30
                    ? "text-yellow-600"
                    : "text-green-600"
              }`}
            >
              {currentRisk.volatilityIndex.toFixed(1)}
            </div>
            <Progress value={currentRisk.volatilityIndex} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {currentRisk.volatilityIndex < 30
                ? "Low"
                : currentRisk.volatilityIndex < 50
                  ? "Moderate"
                  : "High"}{" "}
              volatility
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Risk Trends and Position Analysis */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Risk Score Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Score Trend</CardTitle>
            <CardDescription>Real-time risk score over the last hour</CardDescription>
          </CardHeader>
          <CardContent>
            {localRiskHistory && localRiskHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={localRiskHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="riskScore"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ fill: "#ef4444", r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                <div className="text-center">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Loading risk trend data...</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Position Risk Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Position Risk Contribution</CardTitle>
            <CardDescription>Risk contribution by position</CardDescription>
          </CardHeader>
          <CardContent>
            {positionRisks && positionRisks.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={positionRisks}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="riskContribution"
                    label={({ symbol, riskContribution }) =>
                      `${symbol}: ${riskContribution.toFixed(1)}%`
                    }
                  >
                    {positionRisks.map((risk: PositionRisk, index: number) => (
                      <Cell
                        key={generateChartCellKey(index, risk.symbol)}
                        fill={pieColors[index % pieColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                <div className="text-center">
                  <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No position risk data available</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* VaR and Volatility Trends */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* VaR Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Value at Risk Trend</CardTitle>
            <CardDescription>95% VaR over time</CardDescription>
          </CardHeader>
          <CardContent>
            {localRiskHistory && localRiskHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={localRiskHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`$${value?.toLocaleString()}`, "VaR 95%"]} />
                  <Area
                    type="monotone"
                    dataKey="var95"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                <div className="text-center">
                  <TrendingDown className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Loading VaR trend data...</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Volatility Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Volatility Index Trend</CardTitle>
            <CardDescription>Market volatility over time</CardDescription>
          </CardHeader>
          <CardContent>
            {localRiskHistory && localRiskHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={localRiskHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value) => [`${value}%`, "Volatility"]} />
                  <Area
                    type="monotone"
                    dataKey="volatility"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                <div className="text-center">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Loading volatility trend data...</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Position Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Position Risk Analysis</CardTitle>
          <CardDescription>Detailed risk metrics for each position</CardDescription>
        </CardHeader>
        <CardContent>
          {positionRisks && positionRisks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Symbol</th>
                    <th className="text-right p-2">Size</th>
                    <th className="text-right p-2">Risk %</th>
                    <th className="text-right p-2">VaR 95%</th>
                    <th className="text-right p-2">P&L</th>
                    <th className="text-right p-2">Time Held</th>
                    <th className="text-right p-2">Correlation</th>
                  </tr>
                </thead>
                <tbody>
                  {positionRisks.map((position: PositionRisk) => (
                    <tr key={position.symbol} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium">{position.symbol}</td>
                      <td className="p-2 text-right">${position.size.toLocaleString()}</td>
                      <td className="p-2 text-right">
                        <span
                          className={
                            position.riskContribution > 30
                              ? "text-red-600"
                              : position.riskContribution > 20
                                ? "text-yellow-600"
                                : "text-green-600"
                          }
                        >
                          {position.riskContribution.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-2 text-right">${position.var95.toLocaleString()}</td>
                      <td className="p-2 text-right">
                        <span className={position.pnl >= 0 ? "text-green-600" : "text-red-600"}>
                          {position.pnl >= 0 ? "+" : ""}${position.pnl}
                        </span>
                      </td>
                      <td className="p-2 text-right">{position.timeHeld.toFixed(1)}h</td>
                      <td className="p-2 text-right">
                        <Progress value={position.correlation * 100} className="w-16" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <div className="text-center">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No position data available</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stress Test Results */}
      <Card>
        <CardHeader>
          <CardTitle>Stress Test Results</CardTitle>
          <CardDescription>Portfolio impact under various stress scenarios</CardDescription>
        </CardHeader>
        <CardContent>
          {stressTestResults && stressTestResults.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stressTestResults}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="scenario" />
                <YAxis />
                <Tooltip
                  formatter={(value, name) => [
                    name === "portfolioLoss" ? `$${value?.toLocaleString()}` : `${value}%`,
                    name === "portfolioLoss" ? "Portfolio Loss" : "Loss %",
                  ]}
                />
                <Bar dataKey="portfolioLoss" fill="#ef4444" name="Portfolio Loss" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground">
              <div className="text-center">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No stress test results available</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
