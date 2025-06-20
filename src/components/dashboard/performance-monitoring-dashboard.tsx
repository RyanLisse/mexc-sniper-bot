"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Gauge,
  Server,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

interface CacheMetrics {
  hitRatio: number;
  missRatio: number;
  totalRequests: number;
  avgResponseTime: number;
  redisConnected: boolean;
  valkeyConnected: boolean;
  cacheSize: number;
  evictions: number;
}

interface SystemHealth {
  apiResponseTime: number;
  databaseResponseTime: number;
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  errorRate: number;
  uptime: number;
}

interface PerformanceAlert {
  id: string;
  type: "warning" | "error" | "info";
  message: string;
  timestamp: number;
  resolved: boolean;
}

interface PerformanceMonitoringProps {
  refreshInterval?: number;
}

export default function PerformanceMonitoringDashboard({
  refreshInterval = 5000,
}: PerformanceMonitoringProps) {
  const [cacheMetrics, setCacheMetrics] = useState<CacheMetrics>({
    hitRatio: 85.2,
    missRatio: 14.8,
    totalRequests: 12450,
    avgResponseTime: 2.3,
    redisConnected: true,
    valkeyConnected: true,
    cacheSize: 1024,
    evictions: 23,
  });

  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    apiResponseTime: 145,
    databaseResponseTime: 89,
    memoryUsage: 67.5,
    cpuUsage: 34.2,
    activeConnections: 156,
    errorRate: 0.02,
    uptime: 86400000, // 24 hours in ms
  });

  const [alerts, _setAlerts] = useState<PerformanceAlert[]>([
    {
      id: "1",
      type: "warning",
      message: "Cache hit ratio below 90% threshold",
      timestamp: Date.now() - 300000,
      resolved: false,
    },
    {
      id: "2",
      type: "info",
      message: "Cache warming completed successfully",
      timestamp: Date.now() - 600000,
      resolved: true,
    },
  ]);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      setIsLoading(true);
      try {
        // Simulate fetching real metrics
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Update metrics with slight variations
        setCacheMetrics((prev) => ({
          ...prev,
          hitRatio: Math.max(80, Math.min(95, prev.hitRatio + (Math.random() - 0.5) * 2)),
          totalRequests: prev.totalRequests + Math.floor(Math.random() * 50),
          avgResponseTime: Math.max(
            1,
            Math.min(10, prev.avgResponseTime + (Math.random() - 0.5) * 0.5)
          ),
        }));

        setSystemHealth((prev) => ({
          ...prev,
          apiResponseTime: Math.max(
            50,
            Math.min(500, prev.apiResponseTime + (Math.random() - 0.5) * 20)
          ),
          memoryUsage: Math.max(30, Math.min(90, prev.memoryUsage + (Math.random() - 0.5) * 5)),
          cpuUsage: Math.max(10, Math.min(80, prev.cpuUsage + (Math.random() - 0.5) * 10)),
        }));
      } finally {
        setIsLoading(false);
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  const formatUptime = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const _getHealthStatus = (value: number, thresholds: { warning: number; error: number }) => {
    if (value >= thresholds.error) return "error";
    if (value >= thresholds.warning) return "warning";
    return "healthy";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Performance Monitoring</h2>
          <p className="text-muted-foreground">Real-time system performance and cache metrics</p>
        </div>
        <div className="flex items-center gap-2">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
              <span className="text-sm">Updating...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Live</span>
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {alerts.filter((alert) => !alert.resolved).length > 0 && (
        <div className="space-y-2">
          {alerts
            .filter((alert) => !alert.resolved)
            .map((alert) => (
              <Alert key={alert.id} variant={alert.type === "error" ? "destructive" : "default"}>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Performance Alert</AlertTitle>
                <AlertDescription>{alert.message}</AlertDescription>
              </Alert>
            ))}
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="cache">Cache Metrics</TabsTrigger>
          <TabsTrigger value="system">System Health</TabsTrigger>
          <TabsTrigger value="trends">Performance Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Cache Hit Ratio */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cache Hit Ratio</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cacheMetrics.hitRatio.toFixed(1)}%</div>
                <Progress value={cacheMetrics.hitRatio} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-2">Target: 90%+</p>
              </CardContent>
            </Card>

            {/* API Response Time */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">API Response Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemHealth.apiResponseTime}ms</div>
                <Progress
                  value={Math.min(100, (500 - systemHealth.apiResponseTime) / 5)}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-2">Target: &lt;200ms</p>
              </CardContent>
            </Card>

            {/* System Memory */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                <Gauge className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemHealth.memoryUsage.toFixed(1)}%</div>
                <Progress value={systemHealth.memoryUsage} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {systemHealth.memoryUsage > 80 ? "High usage" : "Normal"}
                </p>
              </CardContent>
            </Card>

            {/* System Uptime */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatUptime(systemHealth.uptime)}</div>
                <div className="flex items-center gap-2 mt-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-600">Healthy</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cache" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cache Connection Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Cache Connection Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Redis/Valkey</span>
                  <div className="flex items-center gap-2">
                    {cacheMetrics.redisConnected ? (
                      <Wifi className="h-4 w-4 text-green-500" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-red-500" />
                    )}
                    <Badge variant={cacheMetrics.redisConnected ? "default" : "destructive"}>
                      {cacheMetrics.redisConnected ? "Connected" : "Disconnected"}
                    </Badge>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  5-second TTL for API responses • Graceful degradation enabled
                </div>
              </CardContent>
            </Card>

            {/* Cache Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Cache Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Hit Ratio</span>
                    <span className="font-medium">{cacheMetrics.hitRatio.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Miss Ratio</span>
                    <span className="font-medium">{cacheMetrics.missRatio.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total Requests</span>
                    <span className="font-medium">
                      {cacheMetrics.totalRequests.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Avg Response Time</span>
                    <span className="font-medium">{cacheMetrics.avgResponseTime.toFixed(1)}ms</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Database Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Database Response Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemHealth.databaseResponseTime}ms</div>
                <Progress
                  value={Math.min(100, (200 - systemHealth.databaseResponseTime) / 2)}
                  className="mt-2"
                />
              </CardContent>
            </Card>

            {/* CPU Usage */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">CPU Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemHealth.cpuUsage.toFixed(1)}%</div>
                <Progress value={systemHealth.cpuUsage} className="mt-2" />
              </CardContent>
            </Card>

            {/* Active Connections */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Active Connections</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{systemHealth.activeConnections}</div>
                <div className="flex items-center gap-2 mt-2">
                  <Activity className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Real-time</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>Historical performance data and trends analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Performance trends visualization would be implemented here</p>
                <p className="text-sm mt-2">
                  Integration with time-series data and charting library
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
