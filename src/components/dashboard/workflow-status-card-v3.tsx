"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";
import { queryKeys } from "../../lib/query-client";

/**
 * React Query-based Workflow Status Card
 *
 * Provides real-time workflow monitoring with React Query for better
 * caching, error handling, and automatic updates.
 */

interface WorkflowStatusData {
  discoveryRunning: boolean;
  sniperActive: boolean;
  activeWorkflows: string[];
  systemStatus: "running" | "stopped" | "error" | "starting" | "stopping";
  lastUpdate: string;
  performance?: {
    uptime: number;
    successRate: number;
    totalExecutions: number;
    avgResponseTime: number;
  };
  activeJobs?: {
    id: string;
    name: string;
    status: "running" | "pending" | "completed" | "failed";
    progress?: number;
    duration: number;
  }[];
  recentActivity?: {
    timestamp: string;
    event: string;
    status: "success" | "warning" | "error";
    details?: string;
  }[];
}

interface WorkflowStatusCardProps {
  className?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  showPerformanceMetrics?: boolean;
  showRecentActivity?: boolean;
}

export function WorkflowStatusCardV3({
  className = "",
  autoRefresh = true,
  refreshInterval = 15000, // 15 seconds for workflow updates
  showPerformanceMetrics = true,
  showRecentActivity = true,
}: WorkflowStatusCardProps) {
  const queryClient = useQueryClient();

  // Workflow status query
  const {
    data: workflowData,
    error,
    isLoading,
    isFetching,
    dataUpdatedAt,
  } = useQuery({
    queryKey: queryKeys.status.workflows(),
    queryFn: async (): Promise<WorkflowStatusData> => {
      const response = await fetch("/api/workflow-status");
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch workflow status");
      }

      return result.data || {
        discoveryRunning: false,
        sniperActive: false,
        activeWorkflows: [],
        systemStatus: "stopped",
        lastUpdate: new Date().toISOString(),
      };
    },
    staleTime: 10000, // 10 seconds
    refetchInterval: autoRefresh ? refreshInterval : false,
    refetchIntervalInBackground: false,
    retry: (failureCount, error) => {
      // Conservative retry for workflow status
      return failureCount < 2;
    },
    // Provide fallback data
    placeholderData: {
      discoveryRunning: false,
      sniperActive: false,
      activeWorkflows: [],
      systemStatus: "stopped" as const,
      lastUpdate: new Date().toISOString(),
    },
  });

  // Workflow control mutations
  const startWorkflowMutation = useMutation({
    mutationFn: async (workflowType: string) => {
      const response = await fetch("/api/workflow-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", workflowType }),
      });
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || "Failed to start workflow");
      }
      
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.status.workflows() });
    },
  });

  const stopWorkflowMutation = useMutation({
    mutationFn: async (workflowType: string) => {
      const response = await fetch("/api/workflow-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop", workflowType }),
      });
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || "Failed to stop workflow");
      }
      
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.status.workflows() });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.status.workflows() });
    },
  });

  const handleStartWorkflow = (workflowType: string) => {
    startWorkflowMutation.mutate(workflowType);
  };

  const handleStopWorkflow = (workflowType: string) => {
    stopWorkflowMutation.mutate(workflowType);
  };

  const handleRefresh = () => {
    refreshMutation.mutate();
  };

  const getStatusConfig = () => {
    if (error) {
      return {
        color: "red",
        icon: XCircle,
        bgClass: "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800",
      };
    }

    if (!workflowData) {
      return { 
        color: "gray", 
        icon: Loader2, 
        bgClass: "bg-gray-50 dark:bg-gray-950/20 dark:border-gray-800" 
      };
    }

    switch (workflowData.systemStatus) {
      case "running":
        return {
          color: "green",
          icon: Activity,
          bgClass: "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800",
        };
      case "starting":
      case "stopping":
        return {
          color: "yellow",
          icon: Clock,
          bgClass: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800",
        };
      case "error":
        return {
          color: "red",
          icon: AlertCircle,
          bgClass: "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800",
        };
      case "stopped":
      default:
        return {
          color: "gray",
          icon: Pause,
          bgClass: "bg-gray-50 dark:bg-gray-950/20 dark:border-gray-800",
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;
  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  const isAnyWorkflowRunning = workflowData?.discoveryRunning || workflowData?.sniperActive || false;
  const activeWorkflowCount = workflowData?.activeWorkflows?.length || 0;

  // Handle error state
  if (error) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <CardTitle>Workflow Status</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <XCircle className="h-5 w-5 text-red-500" />
            <span className="text-sm text-red-700 dark:text-red-300">
              {error instanceof Error ? error.message : "Failed to load workflow status"}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <CardTitle>Workflow Status</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Badge
              variant={isAnyWorkflowRunning ? "default" : "secondary"}
              className="flex items-center space-x-1"
            >
              <StatusIcon className={`h-3 w-3 text-${statusConfig.color}-500`} />
              <span>
                {workflowData?.systemStatus === "running" && "Active"}
                {workflowData?.systemStatus === "stopped" && "Stopped"}
                {workflowData?.systemStatus === "starting" && "Starting"}
                {workflowData?.systemStatus === "stopping" && "Stopping"}
                {workflowData?.systemStatus === "error" && "Error"}
              </span>
            </Badge>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleRefresh} 
              disabled={isLoading || refreshMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 ${(isLoading || isFetching) ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        <CardDescription>
          {workflowData
            ? `${activeWorkflowCount} active workflow${activeWorkflowCount !== 1 ? "s" : ""} • System ${workflowData.systemStatus}`
            : "Loading workflow information..."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Loading State */}
        {isLoading && !workflowData && (
          <div className="flex items-center space-x-3 p-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Loading workflow status...</span>
          </div>
        )}

        {/* Workflow Status */}
        {workflowData && (
          <>
            {/* System Status Banner */}
            <div className={`p-3 rounded-lg border ${statusConfig.bgClass}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <StatusIcon className={`h-5 w-5 text-${statusConfig.color}-500 ${isFetching ? "animate-pulse" : ""}`} />
                  <span className={`font-medium text-${statusConfig.color}-600 dark:text-${statusConfig.color}-400`}>
                    Workflow System {workflowData.systemStatus.charAt(0).toUpperCase() + workflowData.systemStatus.slice(1)}
                  </span>
                </div>
                {lastUpdate && (
                  <div className="text-xs text-muted-foreground">
                    {lastUpdate.toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>

            {/* Individual Workflow Status */}
            <div className="grid gap-3 md:grid-cols-2">
              {/* Discovery Workflow */}
              <div className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${workflowData.discoveryRunning ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
                    <span className="font-medium text-sm">Coin Discovery</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => 
                      workflowData.discoveryRunning 
                        ? handleStopWorkflow("discovery")
                        : handleStartWorkflow("discovery")
                    }
                    disabled={startWorkflowMutation.isPending || stopWorkflowMutation.isPending}
                  >
                    {workflowData.discoveryRunning ? (
                      <Pause className="h-3 w-3" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  {workflowData.discoveryRunning ? "Actively scanning for new listings" : "Not running"}
                </div>
              </div>

              {/* Sniper Workflow */}
              <div className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${workflowData.sniperActive ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
                    <span className="font-medium text-sm">Auto Sniper</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => 
                      workflowData.sniperActive 
                        ? handleStopWorkflow("sniper")
                        : handleStartWorkflow("sniper")
                    }
                    disabled={startWorkflowMutation.isPending || stopWorkflowMutation.isPending}
                  >
                    {workflowData.sniperActive ? (
                      <Pause className="h-3 w-3" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  {workflowData.sniperActive ? "Ready to execute trades" : "Not running"}
                </div>
              </div>
            </div>

            {/* Active Jobs */}
            {workflowData.activeJobs && workflowData.activeJobs.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Active Jobs</div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {workflowData.activeJobs.map((job) => (
                    <div key={job.id} className="p-2 border rounded text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{job.name}</span>
                        <div className="flex items-center space-x-2">
                          <Badge 
                            variant={job.status === "running" ? "default" : job.status === "failed" ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {job.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {Math.floor(job.duration / 1000)}s
                          </span>
                        </div>
                      </div>
                      {job.progress !== undefined && (
                        <Progress value={job.progress} className="h-1" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Performance Metrics */}
            {showPerformanceMetrics && workflowData.performance && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="text-center">
                  <div className="font-medium text-green-600 dark:text-green-400">
                    {Math.floor(workflowData.performance.uptime / 3600)}h
                  </div>
                  <div className="text-muted-foreground">Uptime</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-blue-600 dark:text-blue-400">
                    {workflowData.performance.successRate.toFixed(1)}%
                  </div>
                  <div className="text-muted-foreground">Success Rate</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-purple-600 dark:text-purple-400">
                    {workflowData.performance.totalExecutions}
                  </div>
                  <div className="text-muted-foreground">Executions</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-orange-600 dark:text-orange-400">
                    {workflowData.performance.avgResponseTime}ms
                  </div>
                  <div className="text-muted-foreground">Avg Time</div>
                </div>
              </div>
            )}

            {/* Recent Activity */}
            {showRecentActivity && workflowData.recentActivity && workflowData.recentActivity.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Recent Activity</div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {workflowData.recentActivity.slice(0, 5).map((activity, index) => (
                    <div key={index} className="flex items-start space-x-2 p-2 text-xs border rounded">
                      <div className="mt-0.5">
                        {activity.status === "success" && <CheckCircle className="h-3 w-3 text-green-500" />}
                        {activity.status === "warning" && <AlertCircle className="h-3 w-3 text-yellow-500" />}
                        {activity.status === "error" && <XCircle className="h-3 w-3 text-red-500" />}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{activity.event}</div>
                        {activity.details && (
                          <div className="text-muted-foreground">{activity.details}</div>
                        )}
                        <div className="text-muted-foreground">
                          {new Date(activity.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Update Indicator */}
            {isFetching && (
              <div className="text-center">
                <div className="text-xs text-muted-foreground animate-pulse">
                  Updating workflow status...
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default WorkflowStatusCardV3;