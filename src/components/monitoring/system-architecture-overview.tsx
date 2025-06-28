"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  Network,
  RefreshCw,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createKeyboardClickHandler,
  generateListKey,
  useSkeletonItems,
} from "../../lib/react-utilities";

// Helper type for safety status entries
type SafetyStatusEntry = { passed: boolean; issues: string[]; recommendations: string[] };

interface SystemOverviewData {
  timestamp: string;
  systemStatus: {
    overall: string;
    healthScore: number;
    uptime: number;
    nodeVersion: string;
    memoryUsage: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
  };
  agentArchitecture: {
    totalAgents: number;
    coreAgents: number;
    safetyAgents: number;
    agentTypes: string[];
    agentHealth: Record<string, boolean>;
    agentInteractions: Array<{
      from: string;
      to: string;
      type: string;
    }>;
  };
  orchestrationMetrics: {
    totalExecutions: number;
    successRate: number;
    errorRate: number;
    averageDuration: number;
    lastExecution: string;
    coordinationSystemEnabled: boolean;
    coordinationSystemHealthy: boolean;
  };
  infrastructureHealth: {
    database: {
      status: string;
      responseTime: number;
      details: Record<string, unknown>;
    };
    mexcApi: {
      status: string;
      responseTime: number;
      details: Record<string, unknown>;
    };
    openAi: {
      status: string;
      responseTime: number;
      details: Record<string, unknown>;
    };
  };
  safetyStatus: {
    overall: string;
    simulation: { passed: boolean; issues: string[]; recommendations: string[] };
    riskManager: { passed: boolean; issues: string[]; recommendations: string[] };
    reconciliation: { passed: boolean; issues: string[]; recommendations: string[] };
    errorRecovery: { passed: boolean; issues: string[]; recommendations: string[] };
    summary: string[];
  };
}

export function SystemArchitectureOverview() {
  const [data, setData] = useState<SystemOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const fetchSystemOverview = async () => {
    try {
      const response = await fetch("/api/monitoring/system-overview");
      if (!response.ok) {
        throw new Error("Failed to fetch system overview");
      }
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemOverview();
    const interval = setInterval(fetchSystemOverview, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [fetchSystemOverview]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "healthy":
      case "pass":
      case "successful":
        return "text-green-600";
      case "degraded":
      case "warning":
        return "text-yellow-600";
      case "critical":
      case "unhealthy":
      case "error":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusIcon = (status: string | boolean) => {
    if (typeof status === "boolean") {
      return status ? (
        <CheckCircle className="h-4 w-4 text-green-600" />
      ) : (
        <XCircle className="h-4 w-4 text-red-600" />
      );
    }

    switch (status.toLowerCase()) {
      case "healthy":
      case "pass":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "degraded":
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case "critical":
      case "unhealthy":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatBytes = (bytes: number) => {
    const sizes = ["Bytes", "KB", "MB", "GB"];
    if (bytes === 0) return "0 Bytes";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round((bytes / 1024 ** i) * 100) / 100} ${sizes[i]}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading System Overview...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {useSkeletonItems(3, "h-20 bg-gray-100 rounded animate-pulse").map((item) => (
              <div key={item.key} className={item.className} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            System Overview Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchSystemOverview} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">System Architecture Overview</h2>
        <div className="flex items-center gap-2">
          <Button onClick={fetchSystemOverview} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Badge variant={data.systemStatus.overall === "healthy" ? "default" : "destructive"}>
            {data.systemStatus.overall.toUpperCase()}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="agents">AI Agents</TabsTrigger>
          <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>
          <TabsTrigger value="orchestration">Orchestration</TabsTrigger>
          <TabsTrigger value="safety">Safety Systems</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Health</CardTitle>
                {getStatusIcon(data.systemStatus.overall)}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.systemStatus.healthScore.toFixed(1)}%
                </div>
                <Progress value={data.systemStatus.healthScore} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatUptime(data.systemStatus.uptime)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Node.js {data.systemStatus.nodeVersion}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatBytes(data.systemStatus.memoryUsage.heapUsed)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  of {formatBytes(data.systemStatus.memoryUsage.heapTotal)}
                </p>
                <Progress
                  value={
                    (data.systemStatus.memoryUsage.heapUsed /
                      data.systemStatus.memoryUsage.heapTotal) *
                    100
                  }
                  className="mt-2"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
                <Network className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.agentArchitecture.totalAgents}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.agentArchitecture.coreAgents} core + {data.agentArchitecture.safetyAgents}{" "}
                  safety
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Agent Health Status</CardTitle>
                <CardDescription>Real-time status of all AI agents</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(data.agentArchitecture.agentHealth).map(([agent, healthy]) => (
                  <div
                    key={agent}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedAgent === agent ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"
                    }`}
                    {...createKeyboardClickHandler(() =>
                      setSelectedAgent(selectedAgent === agent ? null : agent)
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(healthy)}
                      <div>
                        <p className="font-medium">{agent.replace(/([A-Z])/g, " $1").trim()}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {agent.includes("risk") ||
                          agent.includes("simulation") ||
                          agent.includes("reconciliation") ||
                          agent.includes("error")
                            ? "Safety Agent"
                            : "Core Agent"}
                        </p>
                      </div>
                    </div>
                    <Badge variant={healthy ? "default" : "destructive"}>
                      {healthy ? "Healthy" : "Unhealthy"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Agent Interactions</CardTitle>
                <CardDescription>Communication flow between agents</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.agentArchitecture.agentInteractions.map((interaction, index) => (
                    <div
                      key={generateListKey(interaction, index, "from")}
                      className="flex items-center gap-3 p-3 rounded-lg border"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{interaction.from}</span>
                          <Zap className="h-3 w-3 text-blue-500" />
                          <span className="font-medium text-sm">{interaction.to}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 capitalize">
                          {interaction.type} communication
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {interaction.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="infrastructure" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(data.infrastructureHealth).map(([service, health]) => (
              <Card key={service}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium capitalize">{service}</CardTitle>
                  {getStatusIcon(health.status)}
                </CardHeader>
                <CardContent>
                  <div className={`text-lg font-bold ${getStatusColor(health.status)}`}>
                    {health.status.toUpperCase()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Response: {health.responseTime}ms
                  </p>
                  <Separator className="my-2" />
                  <div className="space-y-1">
                    {Object.entries(health.details || {}).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{key}:</span>
                        <span>{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="orchestration" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Orchestration Metrics</CardTitle>
                <CardDescription>Workflow execution statistics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Executions</p>
                    <p className="text-2xl font-bold">
                      {data.orchestrationMetrics.totalExecutions}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                    <p className="text-2xl font-bold text-green-600">
                      {(data.orchestrationMetrics.successRate * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Error Rate</p>
                    <p className="text-2xl font-bold text-red-600">
                      {(data.orchestrationMetrics.errorRate * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Duration</p>
                    <p className="text-2xl font-bold">
                      {data.orchestrationMetrics.averageDuration.toFixed(0)}ms
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Coordination System</span>
                    {getStatusIcon(
                      data.orchestrationMetrics.coordinationSystemEnabled &&
                        data.orchestrationMetrics.coordinationSystemHealthy
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Last Execution</span>
                    <span className="text-sm">
                      {new Date(data.orchestrationMetrics.lastExecution).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Performance</CardTitle>
                <CardDescription>Real-time performance indicators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Success Rate</span>
                      <span>{(data.orchestrationMetrics.successRate * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={data.orchestrationMetrics.successRate * 100} />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>System Health</span>
                      <span>{data.systemStatus.healthScore.toFixed(1)}%</span>
                    </div>
                    <Progress value={data.systemStatus.healthScore} />
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Memory Usage</span>
                      <span>
                        {(
                          (data.systemStatus.memoryUsage.heapUsed /
                            data.systemStatus.memoryUsage.heapTotal) *
                          100
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                    <Progress
                      value={
                        (data.systemStatus.memoryUsage.heapUsed /
                          data.systemStatus.memoryUsage.heapTotal) *
                        100
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="safety" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Safety System Status
                {getStatusIcon(data.safetyStatus.overall)}
              </CardTitle>
              <CardDescription>Comprehensive safety monitoring and risk management</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(data.safetyStatus)
                  .filter(([key]) => !["overall", "summary"].includes(key))
                  .map(([system, status]) => (
                    <Card key={system} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center justify-between">
                          {system.replace(/([A-Z])/g, " $1").trim()}
                          {getStatusIcon((status as SafetyStatusEntry).passed)}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Badge
                          variant={(status as SafetyStatusEntry).passed ? "default" : "destructive"}
                        >
                          {(status as SafetyStatusEntry).passed ? "Operational" : "Issues Detected"}
                        </Badge>

                        {(status as SafetyStatusEntry).issues &&
                          (status as SafetyStatusEntry).issues.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-red-600">Issues:</p>
                              {(status as SafetyStatusEntry).issues.map(
                                (issue: string, index: number) => (
                                  <p
                                    key={generateListKey(issue, index)}
                                    className="text-xs text-red-600"
                                  >
                                    • {issue}
                                  </p>
                                )
                              )}
                            </div>
                          )}

                        {(status as SafetyStatusEntry).recommendations &&
                          (status as SafetyStatusEntry).recommendations.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-blue-600">Recommendations:</p>
                              {(status as SafetyStatusEntry).recommendations.map(
                                (rec: string, index: number) => (
                                  <p
                                    key={generateListKey(rec, index)}
                                    className="text-xs text-blue-600"
                                  >
                                    • {rec}
                                  </p>
                                )
                              )}
                            </div>
                          )}
                      </CardContent>
                    </Card>
                  ))}
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">Safety Summary</h4>
                <div className="space-y-1">
                  {data.safetyStatus.summary.map((item, index) => (
                    <p key={generateListKey(item, index)} className="text-sm text-muted-foreground">
                      • {item}
                    </p>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
