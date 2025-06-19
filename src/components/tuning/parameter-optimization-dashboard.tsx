"use client";

/**
 * Parameter Optimization Dashboard
 *
 * Main dashboard for the Self-Tuning Parameters System providing real-time
 * monitoring, optimization controls, and performance visualization.
 */

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  Shield,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ABTestResults } from "./ab-test-results";
import { OptimizationControlPanel } from "./optimization-control-panel";
import { OptimizationHistory } from "./optimization-history";
import { ParameterMonitor } from "./parameter-monitor";
import { PerformanceMetricsView } from "./performance-metrics-view";
import { SafetyConstraints } from "./safety-constraints";

interface OptimizationStatus {
  id: string;
  status: "running" | "completed" | "failed" | "stopped";
  algorithm: string;
  progress: number;
  currentIteration: number;
  maxIterations: number;
  bestScore: number;
  startTime: Date;
  estimatedCompletion?: Date;
  parametersOptimized: number;
}

interface PerformanceMetrics {
  profitability: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  systemLatency: number;
  errorRate: number;
  patternAccuracy: number;
  riskAdjustedReturn: number;
}

interface SystemHealth {
  overallHealth: "excellent" | "good" | "warning" | "critical";
  components: {
    optimizationEngine: "healthy" | "degraded" | "down";
    parameterManager: "healthy" | "degraded" | "down";
    backtesting: "healthy" | "degraded" | "down";
    abTesting: "healthy" | "degraded" | "down";
  };
  activeOptimizations: number;
  lastOptimization: Date | null;
}

// Mock data for development/demo purposes
const mockPerformanceMetrics = [
  {
    timestamp: new Date().toISOString(),
    operation: "parameter_optimization",
    responseTime: 250,
    throughput: 12.5,
    errorRate: 0.02,
    successRate: 0.98,
    cpuUsage: 45,
    memoryUsage: 512,
    activeConnections: 8,
  },
];

const mockABTests = [
  {
    id: "test-1",
    name: "Take Profit Optimization",
    description: "Testing different take profit strategies",
    status: "completed" as const,
    startDate: "2024-01-01",
    endDate: "2024-01-15",
    variants: [],
    metrics: {
      totalParticipants: 1000,
      duration: 14,
      significance: 95.2,
      improvementPercent: 12.5,
    },
  },
];

const mockSafetyConstraints = [
  {
    id: "max-position-size",
    name: "Maximum Position Size",
    description: "Limit maximum position size to prevent overexposure",
    type: "threshold" as const,
    category: "risk" as const,
    severity: "critical" as const,
    enabled: true,
    locked: true,
    value: 10000,
    defaultValue: 5000,
    validation: { min: 1000, max: 50000 },
    currentStatus: "ok" as const,
    lastChecked: new Date().toISOString(),
    violationCount: 0,
  },
];

const mockOptimizationRuns = [
  {
    id: "run-1",
    name: "Risk Parameter Optimization",
    algorithm: "Bayesian Optimization",
    status: "completed" as const,
    startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    endTime: new Date().toISOString(),
    progress: 100,
    currentIteration: 50,
    maxIterations: 50,
    bestScore: 0.85,
    improvementPercent: 15.2,
    parameters: { riskThreshold: 0.05, positionSize: 5000 },
    objective: "Maximize Sharpe Ratio",
    metadata: {
      totalEvaluations: 500,
      convergenceReached: true,
      executionTime: 3600,
      resourceUsage: { cpu: 45, memory: 512 },
    },
  },
];

export function ParameterOptimizationDashboard() {
  const [activeOptimizations, setActiveOptimizations] = useState<OptimizationStatus[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [_selectedOptimization, _setSelectedOptimization] = useState<string | null>(null);
  const [refreshInterval, _setRefreshInterval] = useState(5000); // 5 seconds
  const [isLoading, setIsLoading] = useState(true);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);

        // Fetch active optimizations
        const optimizationsResponse = await fetch("/api/tuning/optimizations");
        const optimizations = await optimizationsResponse.json();
        setActiveOptimizations(optimizations);

        // Fetch performance metrics
        const metricsResponse = await fetch("/api/tuning/performance-metrics");
        const metrics = await metricsResponse.json();
        setPerformanceMetrics(metrics);

        // Fetch system health
        const healthResponse = await fetch("/api/tuning/system-health");
        const health = await healthResponse.json();
        setSystemHealth(health);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "bg-blue-500";
      case "completed":
        return "bg-green-500";
      case "failed":
        return "bg-red-500";
      case "stopped":
        return "bg-gray-500";
      default:
        return "bg-gray-400";
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case "excellent":
        return "text-green-600";
      case "good":
        return "text-blue-600";
      case "warning":
        return "text-yellow-600";
      case "critical":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const handleOptimizationAction = async (action: string, optimizationId?: string) => {
    try {
      switch (action) {
        case "start":
          // Trigger new optimization
          await fetch("/api/tuning/optimizations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "start" }),
          });
          break;

        case "stop":
          if (optimizationId) {
            await fetch(`/api/tuning/optimizations/${optimizationId}`, {
              method: "DELETE",
            });
          }
          break;

        case "emergency_stop":
          await fetch("/api/tuning/emergency-stop", { method: "POST" });
          break;
      }
    } catch (error) {
      console.error("Failed to perform optimization action:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
          <p className="mt-4 text-gray-600">Loading optimization dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Parameter Optimization</h1>
          <p className="text-gray-600 mt-1">AI-powered self-tuning system for MEXC Sniper Bot</p>
        </div>

        <div className="flex items-center space-x-4">
          <Badge
            variant="outline"
            className={`px-3 py-1 ${systemHealth ? getHealthColor(systemHealth.overallHealth) : ""}`}
          >
            <Activity className="w-4 h-4 mr-1" />
            {systemHealth?.overallHealth || "Unknown"}
          </Badge>

          <Button
            onClick={() => handleOptimizationAction("emergency_stop")}
            variant="destructive"
            className="bg-red-600 hover:bg-red-700"
          >
            <Shield className="w-4 h-4 mr-1" />
            Emergency Stop
          </Button>
        </div>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Optimizations</CardTitle>
            <Zap className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeOptimizations.length}</div>
            <p className="text-xs text-gray-600">
              {activeOptimizations.filter((o) => o.status === "running").length} running
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {performanceMetrics?.riskAdjustedReturn?.toFixed(1) || "0.0"}%
            </div>
            <p className="text-xs text-gray-600">Risk-adjusted return</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pattern Accuracy</CardTitle>
            <Target className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {performanceMetrics?.patternAccuracy
                ? (performanceMetrics.patternAccuracy * 100).toFixed(1)
                : "0.0"}
              %
            </div>
            <p className="text-xs text-gray-600">3.5+ hour detection</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Latency</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performanceMetrics?.systemLatency || 0}ms</div>
            <p className="text-xs text-gray-600">Average response time</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Optimizations Status */}
      {activeOptimizations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="w-5 h-5 mr-2" />
              Active Optimizations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeOptimizations.map((optimization) => (
                <div key={optimization.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(optimization.status)}>
                        {optimization.status}
                      </Badge>
                      <span className="font-medium">{optimization.algorithm}</span>
                      <span className="text-sm text-gray-600">
                        {optimization.parametersOptimized} parameters
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">
                        Best Score: {optimization.bestScore.toFixed(3)}
                      </span>
                      {optimization.status === "running" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOptimizationAction("stop", optimization.id)}
                        >
                          Stop
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>
                        Progress: {optimization.currentIteration}/{optimization.maxIterations}
                      </span>
                      <span>{optimization.progress.toFixed(1)}%</span>
                    </div>
                    <Progress value={optimization.progress} className="h-2" />
                  </div>

                  {optimization.estimatedCompletion && (
                    <p className="text-xs text-gray-500 mt-2">
                      Estimated completion: {optimization.estimatedCompletion.toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="control" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="control">Control Panel</TabsTrigger>
          <TabsTrigger value="parameters">Parameters</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="ab-testing">A/B Testing</TabsTrigger>
          <TabsTrigger value="safety">Safety</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="control">
          <OptimizationControlPanel
            onStartOptimization={() => handleOptimizationAction("start")}
            systemHealth={systemHealth}
          />
        </TabsContent>

        <TabsContent value="parameters">
          <ParameterMonitor />
        </TabsContent>

        <TabsContent value="performance">
          <PerformanceMetricsView metrics={mockPerformanceMetrics} />
        </TabsContent>

        <TabsContent value="ab-testing">
          <ABTestResults tests={mockABTests} />
        </TabsContent>

        <TabsContent value="safety">
          <SafetyConstraints constraints={mockSafetyConstraints} />
        </TabsContent>

        <TabsContent value="history">
          <OptimizationHistory runs={mockOptimizationRuns} />
        </TabsContent>
      </Tabs>

      {/* System Alerts */}
      {systemHealth?.overallHealth === "critical" && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            Critical system issues detected. Optimization capabilities may be limited. Check
            component health and resolve issues before continuing.
          </AlertDescription>
        </Alert>
      )}

      {systemHealth?.overallHealth === "warning" && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            System performance degraded. Some optimization features may be slower than normal.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
