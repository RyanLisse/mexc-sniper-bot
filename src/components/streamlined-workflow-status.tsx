"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Pause,
  Play,
  RefreshCw,
  Target,
  TrendingUp,
} from "lucide-react";
import { z } from "zod";
import { queryKeys } from "../lib/query-client";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";

// Zod schema for workflow status validation
const WorkflowStatusSchema = z.object({
  discoveryRunning: z.boolean(),
  sniperActive: z.boolean(),
  patternDetectionActive: z.boolean().default(false),
  activeTargets: z.number().default(0),
  systemStatus: z.enum(["running", "stopped", "error", "starting", "stopping"]),
  lastUpdate: z.string(),
  performance: z
    .object({
      uptime: z.number(),
      successRate: z.number(),
      totalExecutions: z.number(),
      avgResponseTime: z.number(),
    })
    .optional(),
  recentActivity: z
    .array(
      z.object({
        timestamp: z.string(),
        event: z.string(),
        status: z.enum(["success", "warning", "error"]),
        details: z.string().optional(),
      })
    )
    .default([]),
});

type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;

interface StreamlinedWorkflowStatusProps {
  className?: string;
  autoRefresh?: boolean;
  variant?: "compact" | "card";
}

export function StreamlinedWorkflowStatus({
  className = "",
  autoRefresh = true,
  variant = "card",
}: StreamlinedWorkflowStatusProps) {
  const queryClient = useQueryClient();

  // Workflow status query with validation
  const {
    data: workflow,
    error,
    isLoading,
    isFetching,
    dataUpdatedAt,
  } = useQuery({
    queryKey: queryKeys.status.workflows(),
    queryFn: async (): Promise<WorkflowStatus> => {
      const response = await fetch("/api/workflow-status");
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch workflow status");
      }

      // Validate with Zod and provide defaults
      return WorkflowStatusSchema.parse(
        result.data || {
          discoveryRunning: false,
          sniperActive: false,
          patternDetectionActive: false,
          activeTargets: 0,
          systemStatus: "stopped",
          lastUpdate: new Date().toISOString(),
          recentActivity: [],
        }
      );
    },
    staleTime: 30000, // Increased to 30 seconds to reduce conflicts
    refetchInterval: autoRefresh ? 45000 : false, // Reduced frequency to 45 seconds
    retry: 2,
  });

  // Control mutations
  const controlMutation = useMutation({
    mutationFn: async ({
      action,
      workflowType,
    }: {
      action: "start" | "stop";
      workflowType: string;
    }) => {
      const response = await fetch("/api/workflow-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, workflowType }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || `Failed to ${action} ${workflowType}`);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.status.workflows() });
    },
  });

  const getStatusConfig = () => {
    if (error || workflow?.systemStatus === "error") {
      return {
        color: "red",
        icon: AlertCircle,
        text: "System Error",
        variant: "destructive" as const,
      };
    }

    if (workflow?.systemStatus === "running") {
      return {
        color: "green",
        icon: Activity,
        text: "Active",
        variant: "default" as const,
      };
    }

    if (workflow?.systemStatus === "starting" || workflow?.systemStatus === "stopping") {
      return {
        color: "yellow",
        icon: Clock,
        text: workflow.systemStatus === "starting" ? "Starting" : "Stopping",
        variant: "secondary" as const,
      };
    }

    return {
      color: "gray",
      icon: Pause,
      text: "Stopped",
      variant: "secondary" as const,
    };
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;
  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  const isSystemRunning = workflow?.systemStatus === "running";
  const isAnyWorkflowActive =
    workflow?.discoveryRunning || workflow?.sniperActive || workflow?.patternDetectionActive;

  const handleToggleWorkflow = (workflowType: string, isActive: boolean) => {
    controlMutation.mutate({
      action: isActive ? "stop" : "start",
      workflowType,
    });
  };

  // Compact variant for dashboard headers
  if (variant === "compact") {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <StatusIcon
          className={`h-4 w-4 text-${statusConfig.color}-500 ${isFetching ? "animate-pulse" : ""}`}
        />
        <Badge variant={statusConfig.variant}>{statusConfig.text}</Badge>
        {workflow?.activeTargets && workflow.activeTargets > 0 && (
          <Badge variant="outline" className="text-blue-600">
            <Target className="h-3 w-3 mr-1" />
            {workflow.activeTargets} Targets
          </Badge>
        )}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Auto-Sniping Workflows</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-sm text-red-700 dark:text-red-300">{error.message}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Card variant for detailed display
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <CardTitle>Auto-Sniping Workflows</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={statusConfig.variant}>
              <StatusIcon className={`h-3 w-3 mr-1 ${isFetching ? "animate-spin" : ""}`} />
              {statusConfig.text}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: queryKeys.status.workflows() })
              }
              disabled={isLoading || isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading || isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        <CardDescription>
          {workflow
            ? `System ${workflow.systemStatus} • ${workflow.activeTargets || 0} active target${workflow.activeTargets !== 1 ? "s" : ""}`
            : "Loading workflow information..."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Loading State */}
        {isLoading && !workflow && (
          <div className="flex items-center space-x-3 p-4">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Loading workflow status...</span>
          </div>
        )}

        {/* Workflow Controls */}
        {workflow && (
          <>
            {/* Individual Workflow Status */}
            <div className="space-y-3">
              {/* Coin Discovery */}
              <div className="p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        workflow.discoveryRunning ? "bg-green-500 animate-pulse" : "bg-gray-300"
                      }`}
                    />
                    <span className="font-medium text-sm">Coin Discovery</span>
                    <Badge variant="outline" className="text-xs">
                      {workflow.discoveryRunning ? "Active" : "Stopped"}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleWorkflow("discovery", workflow.discoveryRunning)}
                    disabled={controlMutation.isPending}
                  >
                    {workflow.discoveryRunning ? (
                      <Pause className="h-3 w-3" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Pattern Detection */}
              <div className="p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        workflow.patternDetectionActive
                          ? "bg-blue-500 animate-pulse"
                          : "bg-gray-300"
                      }`}
                    />
                    <span className="font-medium text-sm">Pattern Detection</span>
                    <Badge variant="outline" className="text-xs">
                      {workflow.patternDetectionActive ? "Scanning" : "Idle"}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      handleToggleWorkflow("pattern-detection", workflow.patternDetectionActive)
                    }
                    disabled={controlMutation.isPending}
                  >
                    {workflow.patternDetectionActive ? (
                      <Pause className="h-3 w-3" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Auto Sniper */}
              <div className="p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        workflow.sniperActive ? "bg-red-500 animate-pulse" : "bg-gray-300"
                      }`}
                    />
                    <span className="font-medium text-sm">Auto Sniper</span>
                    <Badge variant="outline" className="text-xs">
                      {workflow.sniperActive ? "Armed" : "Disarmed"}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleWorkflow("sniper", workflow.sniperActive)}
                    disabled={controlMutation.isPending}
                  >
                    {workflow.sniperActive ? (
                      <Pause className="h-3 w-3" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            {workflow.performance && (
              <div className="grid grid-cols-4 gap-3 text-sm">
                <div className="text-center">
                  <div className="font-medium text-green-600 dark:text-green-400">
                    {Math.floor(workflow.performance.uptime / 3600)}h
                  </div>
                  <div className="text-muted-foreground">Uptime</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-blue-600 dark:text-blue-400">
                    {workflow.performance.successRate.toFixed(1)}%
                  </div>
                  <div className="text-muted-foreground">Success</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-purple-600 dark:text-purple-400">
                    {workflow.performance.totalExecutions}
                  </div>
                  <div className="text-muted-foreground">Trades</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-orange-600 dark:text-orange-400">
                    {workflow.performance.avgResponseTime}ms
                  </div>
                  <div className="text-muted-foreground">Response</div>
                </div>
              </div>
            )}

            {/* Recent Activity */}
            {workflow.recentActivity.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Recent Activity</div>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {workflow.recentActivity.slice(0, 3).map((activity, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-2 p-2 text-xs border rounded"
                    >
                      {activity.status === "success" && (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      )}
                      {activity.status === "warning" && (
                        <AlertCircle className="h-3 w-3 text-yellow-500" />
                      )}
                      {activity.status === "error" && (
                        <AlertCircle className="h-3 w-3 text-red-500" />
                      )}
                      <div className="flex-1">
                        <div className="font-medium">{activity.event}</div>
                        <div className="text-muted-foreground">
                          {new Date(activity.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last Update */}
            {lastUpdate && (
              <div className="text-xs text-muted-foreground text-center">
                Last updated: {lastUpdate.toLocaleTimeString()}
                {isFetching && <span className="ml-2 animate-pulse">• Updating</span>}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default StreamlinedWorkflowStatus;
