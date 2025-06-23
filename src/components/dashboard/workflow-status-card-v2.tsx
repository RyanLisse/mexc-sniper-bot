"use client";

import { Activity, AlertTriangle, Bot, Loader2, Pause, Play, RefreshCw } from "lucide-react";
import { useStatus } from "../../contexts/status-context-v2";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

/**
 * Workflow Status Card V2
 *
 * Updated to use the centralized StatusContext to eliminate contradictory
 * status messages. This replaces the original WorkflowStatusCard component.
 */

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

interface WorkflowStatusCardV2Props {
  workflowStatus: WorkflowStatus | null;
  isLoading: boolean;
  isDiscoveryRunning: boolean;
  lastRefresh: Date;
  onRefresh: () => void;
  onToggleMonitoring: () => void;
  onRunDiscovery: () => void;
}

export function WorkflowStatusCardV2({
  workflowStatus,
  isLoading,
  isDiscoveryRunning,
  lastRefresh,
  onRefresh,
  onToggleMonitoring,
  onRunDiscovery,
}: WorkflowStatusCardV2Props) {
  const { status, refreshAll, getOverallStatus, getStatusMessage } = useStatus();

  const overallStatus = getOverallStatus();
  const { network, credentials, trading, workflows } = status;

  const getStatusColor = (statusType: string) => {
    switch (statusType) {
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

  const getStatusIcon = (statusType: string) => {
    switch (statusType) {
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

  // Use centralized status for system determination
  const getSystemStatus = () => {
    if (overallStatus === "error") return "error";
    if (overallStatus === "loading") return "stopped";
    if (workflows.discoveryRunning) return "running";
    return workflowStatus?.systemStatus || "stopped";
  };

  const systemStatus = getSystemStatus();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon(systemStatus)}
            <CardTitle className="text-lg">System Status</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onRefresh();
                refreshAll();
              }}
              disabled={isLoading || status.isLoading}
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading || status.isLoading ? "animate-spin" : ""}`}
              />
            </Button>
            <Button
              variant={isDiscoveryRunning ? "destructive" : "default"}
              size="sm"
              onClick={onToggleMonitoring}
              disabled={isLoading || status.isLoading}
            >
              {isLoading || status.isLoading ? (
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
        {/* System Status - Now using centralized status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Discovery System:</span>
          <Badge variant="secondary" className={getStatusColor(systemStatus)}>
            {systemStatus.charAt(0).toUpperCase() + systemStatus.slice(1)}
          </Badge>
        </div>

        {/* Connection Status - Using centralized status to eliminate contradictions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">MEXC API:</span>
            <Badge variant={network.connected && credentials.isValid ? "default" : "destructive"}>
              {network.connected && credentials.isValid ? "Connected" : "Disconnected"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Trading:</span>
            <Badge variant={trading.canTrade ? "default" : "secondary"}>
              {trading.canTrade ? "Can Trade" : "Cannot Trade"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Pattern Sniper:</span>
            <Badge variant={workflows.sniperActive ? "default" : "secondary"}>
              {workflows.sniperActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>

        {/* Overall System Health from Centralized Status */}
        <div className="p-3 rounded-lg border bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Overall Health:</div>
            <Badge
              variant={
                overallStatus === "healthy"
                  ? "default"
                  : overallStatus === "warning"
                    ? "secondary"
                    : overallStatus === "error"
                      ? "destructive"
                      : "outline"
              }
            >
              {overallStatus === "healthy"
                ? "Operational"
                : overallStatus === "warning"
                  ? "Warning"
                  : overallStatus === "error"
                    ? "Error"
                    : "Unknown"}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-1">{getStatusMessage()}</div>
        </div>

        {/* Active Workflows */}
        {workflowStatus?.activeWorkflows?.length || workflows.activeWorkflows.length ? (
          <div>
            <span className="text-sm font-medium">Active Workflows:</span>
            <div className="mt-1 space-y-1">
              {/* Use centralized workflows first, fallback to prop */}
              {(workflows.activeWorkflows.length > 0
                ? workflows.activeWorkflows
                : workflowStatus?.activeWorkflows || []
              ).map((workflow) => (
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
        ) : null}

        {/* Status Timestamps - Using centralized timestamps */}
        <div className="text-xs text-gray-500 space-y-1">
          <div>Last refresh: {lastRefresh.toLocaleTimeString()}</div>
          <div>Network check: {new Date(network.lastChecked).toLocaleTimeString()}</div>
          <div>Credentials check: {new Date(credentials.lastValidated).toLocaleTimeString()}</div>
          {workflowStatus?.lastUpdate && (
            <div>Workflow update: {new Date(workflowStatus.lastUpdate).toLocaleTimeString()}</div>
          )}
        </div>

        {/* Error Information from Centralized Status */}
        {status.syncErrors.length > 0 && (
          <div className="p-2 rounded-md bg-red-50 border border-red-200">
            <div className="text-xs font-medium text-red-800">Recent Issues:</div>
            <div className="text-xs text-red-600 mt-1">
              {status.syncErrors[status.syncErrors.length - 1]}
            </div>
          </div>
        )}

        {/* Quick Action */}
        <Button
          variant="secondary"
          size="sm"
          onClick={onRunDiscovery}
          disabled={isLoading || status.isLoading}
          className="w-full"
        >
          {isLoading || status.isLoading ? (
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

export default WorkflowStatusCardV2;
