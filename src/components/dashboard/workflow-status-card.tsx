"use client";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Activity, AlertTriangle, Bot, Loader2, Pause, Play, RefreshCw } from "lucide-react";

interface WorkflowStatus {
  systemStatus: "running" | "stopped" | "error";
  lastUpdate: string;
  activeWorkflows: string[];
  metrics: {
    readyTokens: number;
    totalDetections: number;
    successfulSnipes: number;
    totalProfit: number;
    successRate: number;
    averageROI: number;
    bestTrade: number;
  };
  recentActivity: Array<{
    id: string;
    type: "pattern" | "calendar" | "snipe" | "analysis";
    message: string;
    timestamp: string;
  }>;
}

interface WorkflowStatusCardProps {
  workflowStatus: WorkflowStatus | null;
  isLoading: boolean;
  isDiscoveryRunning: boolean;
  lastRefresh: Date;
  mexcConnected?: boolean;
  sniperConnected?: boolean;
  onRefresh: () => void;
  onToggleMonitoring: () => void;
  onRunDiscovery: () => void;
}

export function WorkflowStatusCard({
  workflowStatus,
  isLoading,
  isDiscoveryRunning,
  lastRefresh,
  mexcConnected,
  sniperConnected,
  onRefresh,
  onToggleMonitoring,
  onRunDiscovery,
}: WorkflowStatusCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "text-green-600 bg-green-100";
      case "stopped":
        return "text-yellow-600 bg-yellow-100";
      case "error":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
        return <Activity className="h-4 w-4 text-green-600" />;
      case "stopped":
        return <Pause className="h-4 w-4 text-yellow-600" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Bot className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {workflowStatus ? (
              getStatusIcon(workflowStatus.systemStatus)
            ) : (
              <Bot className="h-4 w-4" />
            )}
            <CardTitle className="text-lg">System Status</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant={isDiscoveryRunning ? "destructive" : "default"}
              size="sm"
              onClick={onToggleMonitoring}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isDiscoveryRunning ? (
                <>
                  <Pause className="h-4 w-4 mr-1" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  Start
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* System Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Discovery System:</span>
          <Badge
            variant="secondary"
            className={getStatusColor(workflowStatus?.systemStatus || "stopped")}
          >
            {workflowStatus?.systemStatus || "Unknown"}
          </Badge>
        </div>

        {/* Connection Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">MEXC API:</span>
            <Badge variant={mexcConnected ? "default" : "destructive"}>
              {mexcConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Pattern Sniper:</span>
            <Badge variant={sniperConnected ? "default" : "secondary"}>
              {sniperConnected ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>

        {/* Active Workflows */}
        {workflowStatus?.activeWorkflows && workflowStatus.activeWorkflows.length > 0 && (
          <div>
            <span className="text-sm font-medium">Active Workflows:</span>
            <div className="mt-1 space-y-1">
              {workflowStatus.activeWorkflows.map((workflow) => (
                <Badge
                  key={`workflow-${workflow}-${Date.now()}`}
                  variant="outline"
                  className="text-xs mr-1"
                >
                  {workflow}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Last Update */}
        <div className="text-xs text-gray-500">
          Last refresh: {lastRefresh.toLocaleTimeString()}
          {workflowStatus?.lastUpdate && (
            <span className="block">
              System update: {new Date(workflowStatus.lastUpdate).toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Quick Action */}
        <Button
          variant="secondary"
          size="sm"
          onClick={onRunDiscovery}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Run Discovery Cycle
        </Button>
      </CardContent>
    </Card>
  );
}
