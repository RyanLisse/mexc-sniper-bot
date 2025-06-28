"use client";
/**
 * Parameter Optimization Dashboard
 *
 * Main dashboard for the Self-Tuning Parameters System providing real-time
 * monitoring, optimization controls, and performance visualization.
 */

import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  Shield,
  Target,
  TrendingUp,
  Zap,
} from "../ui/optimized-icons";
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

// Additional interface definitions for real API data
interface PerformanceMetricsData {
  timestamp: string;
  operation: string;
  responseTime: number;
  throughput: number;
  errorRate: number;
  successRate: number;
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
}

interface ABTestData {
  id: string;
  name: string;
  description: string;
  status: "running" | "completed" | "failed" | "paused";
  startDate: string;
  endDate?: string;
  variants: any[];
  metrics: {
    totalParticipants: number;
    duration: number;
    significance: number;
    improvementPercent: number;
  };
}

interface SafetyConstraintData {
  id: string;
  name: string;
  description: string;
  type: "threshold" | "range" | "boolean";
  category: "risk" | "performance" | "system";
  severity: "low" | "medium" | "high" | "critical";
  enabled: boolean;
  locked: boolean;
  value: number | boolean;
  defaultValue: number | boolean;
  validation: { min?: number; max?: number };
  currentStatus: "ok" | "warning" | "violation";
  lastChecked: string;
  violationCount: number;
}

interface OptimizationRunData {
  id: string;
  name: string;
  algorithm: string;
  status: "running" | "completed" | "failed" | "stopped";
  startTime: string;
  endTime?: string;
  progress: number;
  currentIteration: number;
  maxIterations: number;
  bestScore: number;
  improvementPercent: number;
  parameters: Record<string, any>;
  objective: string;
  metadata: {
    totalEvaluations: number;
    convergenceReached: boolean;
    executionTime: number;
    resourceUsage: { cpu: number; memory: number };
  };
}

export function ParameterOptimizationDashboard() {
  const [activeOptimizations, setActiveOptimizations] = useState<OptimizationStatus[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [_selectedOptimization, _setSelectedOptimization] = useState<string | null>(null);
  const [refreshInterval, _setRefreshInterval] = useState(5000); // 5 seconds
  const [isLoading, setIsLoading] = useState(true);
  
  // Additional state for real API data
  const [performanceMetricsData, setPerformanceMetricsData] = useState<PerformanceMetricsData[]>([]);
  const [abTestData, setAbTestData] = useState<ABTestData[]>([]);
  const [safetyConstraints, setSafetyConstraints] = useState<SafetyConstraintData[]>([]);
  const [optimizationHistory, setOptimizationHistory] = useState<OptimizationRunData[]>([]);
  const [dataLoadingStates, setDataLoadingStates] = useState({
    performance: false,
    abTests: false,
    safety: false,
    history: false,
  });
  const [dataErrors, setDataErrors] = useState<Record<string, string | null>>({
    performance: null,
    abTests: null,
    safety: null,
    history: null,
  });

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        
        // Reset data errors
        setDataErrors({
          performance: null,
          abTests: null,
          safety: null,
          history: null,
        });

        // Fetch active optimizations
        try {
          const optimizationsResponse = await fetch("/api/tuning/optimizations");
          if (!optimizationsResponse.ok) {
            throw new Error(`Failed to fetch optimizations: ${optimizationsResponse.status}`);
          }
          const optimizations = await optimizationsResponse.json();
          setActiveOptimizations(optimizations);
        } catch (error) {
          console.error("Failed to fetch active optimizations:", error);
          setActiveOptimizations([]);
        }

        // Fetch performance metrics
        try {
          const metricsResponse = await fetch("/api/tuning/performance-metrics");
          if (!metricsResponse.ok) {
            throw new Error(`Failed to fetch performance metrics: ${metricsResponse.status}`);
          }
          const metrics = await metricsResponse.json();
          setPerformanceMetrics(metrics);
        } catch (error) {
          console.error("Failed to fetch performance metrics:", error);
          setPerformanceMetrics(null);
        }

        // Fetch system health
        try {
          const healthResponse = await fetch("/api/tuning/system-health");
          if (!healthResponse.ok) {
            throw new Error(`Failed to fetch system health: ${healthResponse.status}`);
          }
          const health = await healthResponse.json();
          setSystemHealth(health);
        } catch (error) {
          console.error("Failed to fetch system health:", error);
          setSystemHealth(null);
        }
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

  // Fetch additional data for tabs (performance metrics data, A/B tests, safety constraints, history)
  const fetchTabData = async (tabType: string) => {
    setDataLoadingStates(prev => ({ ...prev, [tabType]: true }));
    setDataErrors(prev => ({ ...prev, [tabType]: null }));

    try {
      switch (tabType) {
        case 'performance':
          const perfResponse = await fetch("/api/tuning/performance-metrics/detailed");
          if (!perfResponse.ok) {
            throw new Error(`Failed to fetch detailed performance metrics: ${perfResponse.status}`);
          }
          const perfData = await perfResponse.json();
          setPerformanceMetricsData(perfData);
          break;

        case 'abTests':
          const abTestResponse = await fetch("/api/tuning/ab-tests");
          if (!abTestResponse.ok) {
            throw new Error(`Failed to fetch A/B tests: ${abTestResponse.status}`);
          }
          const abTestData = await abTestResponse.json();
          setAbTestData(abTestData);
          break;

        case 'safety':
          const safetyResponse = await fetch("/api/tuning/safety-constraints");
          if (!safetyResponse.ok) {
            throw new Error(`Failed to fetch safety constraints: ${safetyResponse.status}`);
          }
          const safetyData = await safetyResponse.json();
          setSafetyConstraints(safetyData);
          break;

        case 'history':
          const historyResponse = await fetch("/api/tuning/optimization-history");
          if (!historyResponse.ok) {
            throw new Error(`Failed to fetch optimization history: ${historyResponse.status}`);
          }
          const historyData = await historyResponse.json();
          setOptimizationHistory(historyData);
          break;

        default:
          console.warn(`Unknown tab type: ${tabType}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`Failed to fetch ${tabType} data:`, error);
      setDataErrors(prev => ({ ...prev, [tabType]: errorMessage }));
    } finally {
      setDataLoadingStates(prev => ({ ...prev, [tabType]: false }));
    }
  };

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
      <Tabs defaultValue="control" className="space-y-6" onValueChange={(value) => {
        // Fetch data when tab is clicked (except for control and parameters which don't need additional data)
        if (['performance', 'abTests', 'safety', 'history'].includes(value)) {
          const tabMap: Record<string, string> = {
            'performance': 'performance',
            'ab-testing': 'abTests',
            'safety': 'safety',
            'history': 'history'
          };
          fetchTabData(tabMap[value] || value);
        }
      }}>
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
          {dataLoadingStates.performance ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" />
                <p className="mt-2 text-gray-600">Loading performance metrics...</p>
              </div>
            </div>
          ) : dataErrors.performance ? (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                Failed to load performance metrics: {dataErrors.performance}
                <Button 
                  variant="link" 
                  className="ml-2 p-0 h-auto text-red-600 underline"
                  onClick={() => fetchTabData('performance')}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <PerformanceMetricsView metrics={performanceMetricsData} />
          )}
        </TabsContent>

        <TabsContent value="ab-testing">
          {dataLoadingStates.abTests ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" />
                <p className="mt-2 text-gray-600">Loading A/B tests...</p>
              </div>
            </div>
          ) : dataErrors.abTests ? (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                Failed to load A/B tests: {dataErrors.abTests}
                <Button 
                  variant="link" 
                  className="ml-2 p-0 h-auto text-red-600 underline"
                  onClick={() => fetchTabData('abTests')}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <ABTestResults tests={abTestData} />
          )}
        </TabsContent>

        <TabsContent value="safety">
          {dataLoadingStates.safety ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" />
                <p className="mt-2 text-gray-600">Loading safety constraints...</p>
              </div>
            </div>
          ) : dataErrors.safety ? (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                Failed to load safety constraints: {dataErrors.safety}
                <Button 
                  variant="link" 
                  className="ml-2 p-0 h-auto text-red-600 underline"
                  onClick={() => fetchTabData('safety')}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <SafetyConstraints constraints={safetyConstraints} />
          )}
        </TabsContent>

        <TabsContent value="history">
          {dataLoadingStates.history ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" />
                <p className="mt-2 text-gray-600">Loading optimization history...</p>
              </div>
            </div>
          ) : dataErrors.history ? (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                Failed to load optimization history: {dataErrors.history}
                <Button 
                  variant="link" 
                  className="ml-2 p-0 h-auto text-red-600 underline"
                  onClick={() => fetchTabData('history')}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <OptimizationHistory runs={optimizationHistory} />
          )}
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
