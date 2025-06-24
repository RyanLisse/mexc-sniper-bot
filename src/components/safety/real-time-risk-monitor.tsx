"use client";

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
  const [currentRisk, setCurrentRisk] = useState({
    riskScore: 23.5,
    portfolioValue: 87500,
    totalExposure: 62800,
    var95: 4200,
    expectedShortfall: 5600,
    maxDrawdown: -2.8,
    sharpeRatio: 1.42,
    volatilityIndex: 34,
  });

  const [riskHistory, setRiskHistory] = useState<RealTimeRiskData[]>([
    {
      timestamp: "09:00",
      riskScore: 18,
      portfolioValue: 87000,
      exposure: 61000,
      volatility: 30,
      var95: 3800,
      drawdown: -1.2,
    },
    {
      timestamp: "09:15",
      riskScore: 21,
      portfolioValue: 87200,
      exposure: 61500,
      volatility: 32,
      var95: 4000,
      drawdown: -1.8,
    },
    {
      timestamp: "09:30",
      riskScore: 19,
      portfolioValue: 87300,
      exposure: 62000,
      volatility: 29,
      var95: 3900,
      drawdown: -1.5,
    },
    {
      timestamp: "09:45",
      riskScore: 25,
      portfolioValue: 87400,
      exposure: 62500,
      volatility: 36,
      var95: 4300,
      drawdown: -2.1,
    },
    {
      timestamp: "10:00",
      riskScore: 23.5,
      portfolioValue: 87500,
      exposure: 62800,
      volatility: 34,
      var95: 4200,
      drawdown: -2.8,
    },
  ]);

  const [positionRisks, _setPositionRisks] = useState<PositionRisk[]>([
    {
      symbol: "BTCUSDT",
      size: 25000,
      riskContribution: 35.2,
      var95: 1500,
      correlation: 0.8,
      timeHeld: 4.5,
      pnl: 850,
    },
    {
      symbol: "ETHUSDT",
      size: 18000,
      riskContribution: 28.6,
      var95: 1200,
      correlation: 0.7,
      timeHeld: 2.1,
      pnl: 320,
    },
    {
      symbol: "ADAUSDT",
      size: 12000,
      riskContribution: 18.5,
      var95: 800,
      correlation: 0.6,
      timeHeld: 1.8,
      pnl: -150,
    },
    {
      symbol: "DOTUSDT",
      size: 7800,
      riskContribution: 12.1,
      var95: 500,
      correlation: 0.5,
      timeHeld: 0.9,
      pnl: 95,
    },
    {
      symbol: "LINKUSDT",
      size: 5000,
      riskContribution: 5.6,
      var95: 300,
      correlation: 0.4,
      timeHeld: 0.3,
      pnl: 45,
    },
  ]);

  const [activeAlerts, _setActiveAlerts] = useState<RiskAlert[]>([
    {
      id: "alert-1",
      type: "volatility_spike",
      severity: "medium",
      message: "Market volatility increased by 15% in the last hour",
      value: 34,
      threshold: 30,
      timestamp: "10:00",
      acknowledged: false,
    },
    {
      id: "alert-2",
      type: "risk_threshold",
      severity: "low",
      message: "Portfolio risk score approaching medium threshold",
      value: 23.5,
      threshold: 25,
      timestamp: "09:55",
      acknowledged: false,
    },
  ]);

  const [stressTestResults, _setStressTestResults] = useState<StressTestResult[]>([
    {
      scenario: "Market Crash (-20%)",
      portfolioLoss: 17500,
      lossPercentage: 20,
      recoveryTime: 48,
      riskScore: 95,
    },
    {
      scenario: "Flash Crash (-10%)",
      portfolioLoss: 8750,
      lossPercentage: 10,
      recoveryTime: 12,
      riskScore: 75,
    },
    {
      scenario: "High Volatility",
      portfolioLoss: 4375,
      lossPercentage: 5,
      recoveryTime: 24,
      riskScore: 60,
    },
    {
      scenario: "Liquidity Crisis",
      portfolioLoss: 6125,
      lossPercentage: 7,
      recoveryTime: 18,
      riskScore: 70,
    },
  ]);

  // Real-time data simulation
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate real-time risk updates
      const newRiskScore = Math.max(
        0,
        Math.min(100, currentRisk.riskScore + (Math.random() - 0.5) * 3)
      );
      const newVolatility = Math.max(
        0,
        Math.min(100, currentRisk.volatilityIndex + (Math.random() - 0.5) * 5)
      );

      setCurrentRisk((prev) => ({
        ...prev,
        riskScore: newRiskScore,
        volatilityIndex: newVolatility,
        var95: Math.round(prev.var95 * (1 + (Math.random() - 0.5) * 0.1)),
      }));

      // Add new data point to history
      const now = new Date();
      const timeString = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

      setRiskHistory((prev) => {
        const newPoint: RealTimeRiskData = {
          timestamp: timeString,
          riskScore: newRiskScore,
          portfolioValue: currentRisk.portfolioValue,
          exposure: currentRisk.totalExposure,
          volatility: newVolatility,
          var95: currentRisk.var95,
          drawdown: currentRisk.maxDrawdown,
        };

        return [...prev.slice(-19), newPoint]; // Keep last 20 points
      });
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [currentRisk]);

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
      {activeAlerts.length > 0 && (
        <div className="space-y-2">
          {activeAlerts.map((alert) => (
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
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={riskHistory}>
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
          </CardContent>
        </Card>

        {/* Position Risk Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Position Risk Contribution</CardTitle>
            <CardDescription>Risk contribution by position</CardDescription>
          </CardHeader>
          <CardContent>
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
                  {positionRisks.map((risk, index) => (
                    <Cell
                      key={generateChartCellKey(index, risk.symbol)}
                      fill={pieColors[index % pieColors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
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
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={riskHistory}>
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
          </CardContent>
        </Card>

        {/* Volatility Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Volatility Index Trend</CardTitle>
            <CardDescription>Market volatility over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={riskHistory}>
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
                {positionRisks.map((position) => (
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
        </CardContent>
      </Card>

      {/* Stress Test Results */}
      <Card>
        <CardHeader>
          <CardTitle>Stress Test Results</CardTitle>
          <CardDescription>Portfolio impact under various stress scenarios</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
