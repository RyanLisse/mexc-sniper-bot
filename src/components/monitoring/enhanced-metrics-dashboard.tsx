"use client";

/**
 * Enhanced Metrics Dashboard
 *
 * Phase 3 monitoring dashboard component that displays comprehensive
 * performance metrics with real-time updates and alerting capabilities.
 */

import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Shield,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Progress } from "@/src/components/ui/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/src/components/ui/tabs";

interface EnhancedMetrics {
  timestamp: string;
  performance: {
    trading: {
      executionLatency: number;
      orderFillRate: number;
      apiResponseTime: number;
      patternDetectionAccuracy: number;
      riskCalculationTime: number;
      websocketLatency: number;
    };
    system: {
      memoryUsageMB: number;
      cpuUsagePercent: number;
      uptime: number;
    };
    alerts: {
      active: number;
      lastAlert: string | null;
    };
  };
  trading: {
    execution: {
      totalTrades: number;
      successRate: number;
      averageExecutionTime: number;
      averageSlippage: number;
    };
    profitability: {
      totalPnL: number;
      profitableTrades: number;
      averagePnL: number;
      maxDrawdown: number;
    };
    risk: {
      currentExposure: number;
      maxExposure: number;
      riskScore: number;
    };
    patterns: {
      detectionsToday: number;
      averageConfidence: number;
      successRate: number;
    };
  };
  realtime: {
    totalTrades: number;
    successfulTrades: number;
    totalPnL: number;
    currentExposure: number;
    averageExecutionTime: number;
    averageSlippage: number;
  };
  health: {
    status: "healthy" | "degraded" | "unhealthy";
    issues: string[];
    score: number;
  };
}

export function EnhancedMetricsDashboard() {
  const [metrics, setMetrics] = useState<EnhancedMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Fetch metrics data
  const fetchMetrics = async () => {
    try {
      const response = await fetch("/api/monitoring/enhanced-metrics");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setMetrics(data.data);
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch metrics");
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    fetchMetrics();

    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, 10000); // Every 10 seconds
      return () => clearInterval(interval);
    }

    return undefined;
  }, [autoRefresh, fetchMetrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading enhanced metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            <span>Error loading metrics: {error}</span>
          </div>
          <Button onClick={fetchMetrics} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return <div>No metrics data available</div>;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const formatDuration = (ms: number) => {
    return `${ms.toFixed(1)}ms`;
  };

  const getHealthBadgeColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-100 text-green-800";
      case "degraded":
        return "bg-yellow-100 text-yellow-800";
      case "unhealthy":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-4 w-4" />;
      case "degraded":
        return <AlertTriangle className="h-4 w-4" />;
      case "unhealthy":
        return <XCircle className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Enhanced Performance Metrics</h2>
          <p className="text-gray-600">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getHealthBadgeColor(metrics.health.status)}>
            {getHealthIcon(metrics.health.status)}
            <span className="ml-1">{metrics.health.status.toUpperCase()}</span>
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? "Pause" : "Resume"} Auto-refresh
          </Button>
          <Button size="sm" onClick={fetchMetrics}>
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Health Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            System Health Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span>Overall Health</span>
                <span className="text-lg font-semibold">
                  {metrics.health.score}/100
                </span>
              </div>
              <Progress value={metrics.health.score} className="h-3" />
            </div>
            {metrics.health.issues.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 text-red-600">
                  Active Issues:
                </h4>
                <ul className="space-y-1">
                  {metrics.health.issues.map((issue, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Metrics Tabs */}
      <Tabs defaultValue="trading" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trading">Trading</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        {/* Trading Metrics */}
        <TabsContent value="trading" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Trades
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.trading.execution.totalTrades}
                </div>
                <p className="text-xs text-gray-600">
                  Success Rate:{" "}
                  {formatPercentage(metrics.trading.execution.successRate)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  P&L
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${metrics.trading.profitability.totalPnL >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {formatCurrency(metrics.trading.profitability.totalPnL)}
                </div>
                <p className="text-xs text-gray-600">
                  Avg:{" "}
                  {formatCurrency(metrics.trading.profitability.averagePnL)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Execution Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatDuration(
                    metrics.trading.execution.averageExecutionTime
                  )}
                </div>
                <p className="text-xs text-gray-600">
                  Slippage:{" "}
                  {metrics.trading.execution.averageSlippage.toFixed(2)}bp
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Pattern Detection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.trading.patterns.detectionsToday}
                </div>
                <p className="text-xs text-gray-600">
                  Confidence:{" "}
                  {formatPercentage(metrics.trading.patterns.averageConfidence)}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Metrics */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  API Response Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatDuration(metrics.performance.trading.apiResponseTime)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  WebSocket Latency
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatDuration(metrics.performance.trading.websocketLatency)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Pattern Processing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatDuration(
                    metrics.performance.trading.riskCalculationTime
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Risk Metrics */}
        <TabsContent value="risk" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Current Exposure
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold">
                    {formatPercentage(metrics.trading.risk.currentExposure)}
                  </div>
                  <Progress
                    value={metrics.trading.risk.currentExposure}
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Risk Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold">
                    {metrics.trading.risk.riskScore}/100
                  </div>
                  <Progress
                    value={metrics.trading.risk.riskScore}
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Max Drawdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(metrics.trading.profitability.maxDrawdown)}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* System Metrics */}
        <TabsContent value="system" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Memory Usage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold">
                    {metrics.performance.system.memoryUsageMB.toFixed(1)} MB
                  </div>
                  <Progress
                    value={
                      (metrics.performance.system.memoryUsageMB / 1024) * 100
                    }
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Uptime</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.floor(metrics.performance.system.uptime / 3600)}h
                </div>
                <p className="text-xs text-gray-600">
                  {Math.floor((metrics.performance.system.uptime % 3600) / 60)}m
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.performance.alerts.active}
                </div>
                {metrics.performance.alerts.lastAlert && (
                  <p className="text-xs text-gray-600">
                    Last: {metrics.performance.alerts.lastAlert}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
