"use client";

import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Progress } from "../ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Bell,
  Brain,
  CheckCircle,
  Network,
  RefreshCw,
  Shield,
} from "lucide-react";
import { useState } from "react";

interface AlertInstance {
  id: string;
  message: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  source: string;
  status: string;
  firstTriggeredAt: number;
  lastTriggeredAt: number;
  metricValue?: number;
  threshold?: number;
  isResolved: boolean;
  resolutionTime?: number;
}

interface SystemStatus {
  overall: {
    status: "healthy" | "warning" | "critical";
    score: number;
    lastChecked: string;
  };
  services: {
    alerting: {
      status: string;
      isRunning: boolean;
      evaluationInterval: number;
      metricsInBuffer: number;
    };
    anomalyDetection: {
      status: string;
      modelsLoaded: number;
      totalQueuedSamples: number;
    };
    correlation: {
      status: string;
      patternsLoaded: number;
      recentAlertsTracked: number;
    };
  };
  activeAlerts: {
    count: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

interface AnalyticsData {
  insights?: string[];
  summary: {
    totalAlerts: number;
    totalResolved: number;
    averageMTTR?: number;
    alertDistribution: Record<string, number>;
  };
  anomalyDetection: {
    modelsActive: number;
    overallPerformance: {
      averageAccuracy?: number;
      averageFalsePositiveRate?: number;
    };
  };
}

interface AlertAnalytics {
  summary: {
    totalAlerts: number;
    totalResolved: number;
    averageMTTR: number;
    alertDistribution: Record<string, number>;
  };
  anomalyDetection: {
    modelsActive: number;
    overallPerformance: {
      averageAccuracy: number;
      averageFalsePositiveRate: number;
    };
  };
  insights: string[];
}

// Helper functions moved outside component to reduce complexity
const getSeverityColor = (
  severity: string
): "destructive" | "secondary" | "outline" | "default" => {
  switch (severity) {
    case "critical":
      return "destructive";
    case "high":
      return "destructive";
    case "medium":
      return "outline";
    case "low":
      return "secondary";
    case "info":
      return "outline";
    default:
      return "outline";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "healthy":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case "critical":
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    default:
      return <Activity className="h-4 w-4 text-gray-500" />;
  }
};

const formatDuration = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

// Custom hooks for data fetching
const useSystemStatus = (refreshInterval: number) => {
  return useQuery({
    queryKey: ["alerts", "system", "status"],
    queryFn: async (): Promise<SystemStatus> => {
      const response = await fetch("/api/alerts/system/status");
      if (!response.ok) throw new Error("Failed to fetch system status");
      const result = await response.json();
      return result.data;
    },
    refetchInterval: refreshInterval,
  });
};

const useActiveAlerts = (refreshInterval: number) => {
  return useQuery({
    queryKey: ["alerts", "instances", "active"],
    queryFn: async (): Promise<AlertInstance[]> => {
      const response = await fetch("/api/alerts/instances?status=active&limit=20");
      if (!response.ok) throw new Error("Failed to fetch active alerts");
      const result = await response.json();
      return result.data;
    },
    refetchInterval: refreshInterval,
  });
};

const useAlertAnalytics = () => {
  return useQuery({
    queryKey: ["alerts", "analytics"],
    queryFn: async (): Promise<AlertAnalytics> => {
      const response = await fetch("/api/alerts/analytics?bucket=hourly&limit=24");
      if (!response.ok) throw new Error("Failed to fetch analytics");
      const result = await response.json();
      return result.data;
    },
    refetchInterval: 300000, // 5 minutes
  });
};

// System Health Cards Component
interface SystemHealthCardsProps {
  systemStatus: SystemStatus | undefined;
}

const SystemHealthCards = ({ systemStatus }: SystemHealthCardsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">System Health</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{systemStatus?.overall.score || 0}%</div>
          <Progress value={systemStatus?.overall.score || 0} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-2">
            Last checked:{" "}
            {systemStatus?.overall.lastChecked
              ? new Date(systemStatus.overall.lastChecked).toLocaleTimeString()
              : "Unknown"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
          <Bell className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{systemStatus?.activeAlerts.count || 0}</div>
          <div className="flex space-x-2 mt-2">
            {systemStatus?.activeAlerts.critical ? (
              <Badge variant="destructive" className="text-xs">
                {systemStatus.activeAlerts.critical} Critical
              </Badge>
            ) : null}
            {systemStatus?.activeAlerts.high ? (
              <Badge variant="destructive" className="text-xs">
                {systemStatus.activeAlerts.high} High
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">ML Models</CardTitle>
          <Brain className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {systemStatus?.services.anomalyDetection.modelsLoaded || 0}
          </div>
          <p className="text-xs text-muted-foreground">
            {systemStatus?.services.anomalyDetection.totalQueuedSamples || 0} queued samples
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Correlations</CardTitle>
          <Network className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {systemStatus?.services.correlation.patternsLoaded || 0}
          </div>
          <p className="text-xs text-muted-foreground">
            {systemStatus?.services.correlation.recentAlertsTracked || 0} alerts tracked
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

// Extracted tab components to reduce cognitive complexity
function OverviewTab({ analytics }: { analytics: AnalyticsData | undefined }) {
  return (
    <>
      {/* Insights */}
      {analytics?.insights && analytics.insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>System Insights</CardTitle>
            <CardDescription>AI-powered recommendations for system optimization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.insights.map((insight: string) => (
                <Alert key={insight.substring(0, 50)}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{insight}</AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Alert Distribution</CardTitle>
            <CardDescription>Last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics?.summary.alertDistribution && (
              <div className="space-y-2">
                {Object.entries(analytics.summary.alertDistribution).map(([severity, count]) => (
                  <div key={severity} className="flex justify-between items-center">
                    <Badge variant={getSeverityColor(severity)}>
                      {severity.charAt(0).toUpperCase() + severity.slice(1)}
                    </Badge>
                    <span className="font-mono">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>System performance indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Average MTTR</span>
                <span className="font-mono">
                  {analytics?.summary.averageMTTR
                    ? formatDuration(analytics.summary.averageMTTR)
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>ML Accuracy</span>
                <span className="font-mono">
                  {analytics?.anomalyDetection.overallPerformance.averageAccuracy
                    ? `${(analytics.anomalyDetection.overallPerformance.averageAccuracy * 100).toFixed(1)}%`
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>False Positive Rate</span>
                <span className="font-mono">
                  {analytics?.anomalyDetection.overallPerformance.averageFalsePositiveRate
                    ? `${(analytics.anomalyDetection.overallPerformance.averageFalsePositiveRate * 100).toFixed(1)}%`
                    : "N/A"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function AlertsTab({
  activeAlerts,
  alertsLoading,
  onResolveAlert,
}: {
  activeAlerts: AlertInstance[] | undefined;
  alertsLoading: boolean;
  onResolveAlert: (alertId: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Alerts</CardTitle>
        <CardDescription>Current alerts requiring attention</CardDescription>
      </CardHeader>
      <CardContent>
        {alertsLoading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        ) : activeAlerts && activeAlerts.length > 0 ? (
          <div className="space-y-3">
            {activeAlerts.map((alert: AlertInstance) => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <Badge variant={getSeverityColor(alert.severity)}>{alert.severity}</Badge>
                    <span className="font-medium">{alert.message}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Source: {alert.source} • Triggered:{" "}
                    {formatDuration(Date.now() - alert.firstTriggeredAt)} ago
                    {alert.metricValue && <> • Value: {alert.metricValue}</>}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => onResolveAlert(alert.id)}>
                    Resolve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            No active alerts. System is operating normally.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AnalyticsTab({ analytics }: { analytics: AnalyticsData | undefined }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Total Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{analytics?.summary.totalAlerts || 0}</div>
          <p className="text-sm text-muted-foreground">Last 24 hours</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resolution Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {analytics?.summary.totalAlerts
              ? `${((analytics.summary.totalResolved / analytics.summary.totalAlerts) * 100).toFixed(1)}%`
              : "0%"}
          </div>
          <p className="text-sm text-muted-foreground">
            {analytics?.summary.totalResolved || 0} resolved
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ML Models Active</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{analytics?.anomalyDetection.modelsActive || 0}</div>
          <p className="text-sm text-muted-foreground">Anomaly detection models</p>
        </CardContent>
      </Card>
    </div>
  );
}

function ServicesTab({ systemStatus }: { systemStatus: SystemStatus | undefined }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Alert Engine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Status</span>
              {getStatusIcon(systemStatus?.services.alerting.status || "unknown")}
            </div>
            <div className="flex justify-between">
              <span>Running</span>
              <span>{systemStatus?.services.alerting.isRunning ? "Yes" : "No"}</span>
            </div>
            <div className="flex justify-between">
              <span>Evaluation Interval</span>
              <span>{systemStatus?.services.alerting.evaluationInterval || 0}ms</span>
            </div>
            <div className="flex justify-between">
              <span>Buffered Metrics</span>
              <span>{systemStatus?.services.alerting.metricsInBuffer || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Brain className="h-5 w-5 mr-2" />
            Anomaly Detection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Status</span>
              {getStatusIcon(systemStatus?.services.anomalyDetection.status || "unknown")}
            </div>
            <div className="flex justify-between">
              <span>Models Loaded</span>
              <span>{systemStatus?.services.anomalyDetection.modelsLoaded || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Queued Samples</span>
              <span>{systemStatus?.services.anomalyDetection.totalQueuedSamples || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Network className="h-5 w-5 mr-2" />
            Correlation Engine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Status</span>
              {getStatusIcon(systemStatus?.services.correlation.status || "unknown")}
            </div>
            <div className="flex justify-between">
              <span>Patterns Loaded</span>
              <span>{systemStatus?.services.correlation.patternsLoaded || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Alerts Tracked</span>
              <span>{systemStatus?.services.correlation.recentAlertsTracked || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AlertsDashboard() {
  const [selectedTab, setSelectedTab] = useState("overview");
  const refreshInterval = 30000; // 30 seconds

  const {
    data: systemStatus,
    isLoading: statusLoading,
    refetch: refetchStatus,
  } = useSystemStatus(refreshInterval);

  const {
    data: activeAlerts,
    isLoading: alertsLoading,
    refetch: refetchAlerts,
  } = useActiveAlerts(refreshInterval);

  const { data: analytics } = useAlertAnalytics();

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/alerts/instances/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve",
          notes: "Manually resolved from dashboard",
        }),
      });

      if (response.ok) {
        refetchAlerts();
        refetchStatus();
      }
    } catch (error) {
      console.error("Failed to resolve alert:", error);
    }
  };

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading alerting system status...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Automated Alerting System</h1>
          <p className="text-muted-foreground">
            Enterprise-grade alerting with ML-powered anomaly detection
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchStatus();
              refetchAlerts();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Badge variant={systemStatus?.overall.status === "healthy" ? "default" : "destructive"}>
            {getStatusIcon(systemStatus?.overall.status || "unknown")}
            <span className="ml-1">{systemStatus?.overall.status || "Unknown"}</span>
          </Badge>
        </div>
      </div>

      {/* System Health Overview */}
      <SystemHealthCards systemStatus={systemStatus} />

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="alerts">Active Alerts</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <OverviewTab analytics={analytics} />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <AlertsTab
            activeAlerts={activeAlerts}
            alertsLoading={alertsLoading}
            onResolveAlert={resolveAlert}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <AnalyticsTab analytics={analytics} />
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <ServicesTab systemStatus={systemStatus} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
