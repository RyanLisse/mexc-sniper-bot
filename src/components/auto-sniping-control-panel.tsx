"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Pause, Play, RefreshCw, Settings, Shield, Target } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { queryKeys } from "../lib/query-client";
import { StreamlinedCredentialStatus } from "./streamlined-credential-status";
import { StreamlinedWorkflowStatus } from "./streamlined-workflow-status";
import { Alert, AlertDescription } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";

// Zod schema for auto-sniping configuration
const AutoSnipingConfigSchema = z.object({
  enabled: z.boolean(),
  maxPositionSize: z.number().positive(),
  takeProfitPercentage: z.number().min(0.1).max(100),
  stopLossPercentage: z.number().min(0.1).max(100),
  patternConfidenceThreshold: z.number().min(50).max(100),
  maxConcurrentTrades: z.number().min(1).max(10),
  enableSafetyChecks: z.boolean(),
  enablePatternDetection: z.boolean(),
});

export type AutoSnipingConfig = z.infer<typeof AutoSnipingConfigSchema>;

// Zod schema for sniping status
const SnipingStatusSchema = z.object({
  isActive: z.boolean(),
  activeTargets: z.number(),
  readyTargets: z.number(),
  executedToday: z.number(),
  successRate: z.number(),
  totalProfit: z.number(),
  lastExecution: z.string().optional(),
  safetyStatus: z.enum(["safe", "warning", "critical", "emergency"]),
  patternDetectionActive: z.boolean(),
});

type SnipingStatus = z.infer<typeof SnipingStatusSchema>;

interface AutoSnipingControlPanelProps {
  className?: string;
}

export function AutoSnipingControlPanel({ className = "" }: AutoSnipingControlPanelProps) {
  const queryClient = useQueryClient();
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Fetch sniping status - FIXED: Remove conflicting refetchInterval
  const {
    data: status,
    isLoading: statusLoading,
    error: statusError,
  } = useQuery({
    queryKey: queryKeys.autoSniping.status(),
    queryFn: async (): Promise<SnipingStatus> => {
      const response = await fetch("/api/auto-sniping/status");
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch sniping status");
      }

      return SnipingStatusSchema.parse(result.data);
    },
    staleTime: 10000, // 10 seconds
    retry: 2,
  });

  // Fetch configuration
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: queryKeys.autoSniping.config(),
    queryFn: async (): Promise<AutoSnipingConfig> => {
      const response = await fetch("/api/auto-sniping/config");
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch configuration");
      }

      return AutoSnipingConfigSchema.parse(result.data);
    },
    retry: 2,
  });

  // Control mutations
  const toggleSnipingMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await fetch("/api/auto-sniping/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: enabled ? "start" : "stop" }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || `Failed to ${enabled ? "start" : "stop"} auto-sniping`);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.autoSniping.status() });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (updates: Partial<AutoSnipingConfig>) => {
      const response = await fetch("/api/auto-sniping/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to update configuration");
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.autoSniping.config() });
    },
  });

  const handleToggleSniping = () => {
    toggleSnipingMutation.mutate(!status?.isActive);
  };

  const handleConfigUpdate = (key: keyof AutoSnipingConfig, value: any) => {
    updateConfigMutation.mutate({ [key]: value });
  };

  const getSafetyStatusConfig = () => {
    switch (status?.safetyStatus) {
      case "safe":
        return { color: "green", icon: Shield, text: "Safe" };
      case "warning":
        return { color: "yellow", icon: AlertTriangle, text: "Warning" };
      case "critical":
        return { color: "red", icon: AlertTriangle, text: "Critical" };
      case "emergency":
        return { color: "red", icon: AlertTriangle, text: "Emergency" };
      default:
        return { color: "gray", icon: Shield, text: "Unknown" };
    }
  };

  const safetyConfig = getSafetyStatusConfig();
  const SafetyIcon = safetyConfig.icon;

  if (statusError) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Auto-Sniping Control</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load auto-sniping status: {statusError.message}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* MEXC API Status */}
      <StreamlinedCredentialStatus variant="card" autoRefresh={true} />

      {/* Auto-Sniping Control */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
              <CardTitle>Auto-Sniping Control</CardTitle>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={status?.isActive ? "default" : "secondary"}>
                {status?.isActive ? "Active" : "Stopped"}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  queryClient.invalidateQueries({ queryKey: queryKeys.autoSniping.status() })
                }
                disabled={statusLoading}
              >
                <RefreshCw className={`h-4 w-4 ${statusLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
          <CardDescription>
            {status
              ? `${status.activeTargets} active • ${status.readyTargets} ready • ${status.executedToday} trades today`
              : "Loading auto-sniping status..."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Main Control */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <div className="font-medium">Auto-Sniping System</div>
              <div className="text-sm text-muted-foreground">
                {status?.isActive
                  ? "Actively monitoring for sniping opportunities"
                  : "Ready to start monitoring patterns and executing trades"}
              </div>
            </div>
            <Button
              size="lg"
              onClick={handleToggleSniping}
              disabled={toggleSnipingMutation.isPending}
              className={
                status?.isActive ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
              }
            >
              {status?.isActive ? (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Stop Sniping
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Sniping
                </>
              )}
            </Button>
          </div>

          {/* Status Metrics */}
          {status && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center p-3 border rounded">
                <div className="font-bold text-lg text-blue-600">{status.activeTargets}</div>
                <div className="text-muted-foreground">Active Targets</div>
              </div>
              <div className="text-center p-3 border rounded">
                <div className="font-bold text-lg text-green-600">{status.readyTargets}</div>
                <div className="text-muted-foreground">Ready Targets</div>
              </div>
              <div className="text-center p-3 border rounded">
                <div className="font-bold text-lg text-purple-600">{status.executedToday}</div>
                <div className="text-muted-foreground">Trades Today</div>
              </div>
              <div className="text-center p-3 border rounded">
                <div className="font-bold text-lg text-orange-600">
                  {status.successRate.toFixed(1)}%
                </div>
                <div className="text-muted-foreground">Success Rate</div>
              </div>
            </div>
          )}

          {/* Safety Status */}
          <div
            className={`p-3 border rounded-lg bg-${safetyConfig.color}-50 dark:bg-${safetyConfig.color}-950/20 border-${safetyConfig.color}-200 dark:border-${safetyConfig.color}-800`}
          >
            <div className="flex items-center space-x-2">
              <SafetyIcon className={`h-4 w-4 text-${safetyConfig.color}-600`} />
              <span
                className={`font-medium text-${safetyConfig.color}-700 dark:text-${safetyConfig.color}-300`}
              >
                Safety Status: {safetyConfig.text}
              </span>
            </div>
          </div>

          {/* Quick Configuration */}
          {config && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Quick Configuration</span>
                <Button variant="ghost" size="sm" onClick={() => setShowAdvanced(!showAdvanced)}>
                  <Settings className="h-4 w-4 mr-1" />
                  {showAdvanced ? "Hide" : "Show"} Advanced
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="safety-checks" className="text-sm">
                    Safety Checks
                  </Label>
                  <Switch
                    id="safety-checks"
                    checked={config.enableSafetyChecks}
                    onCheckedChange={(checked) => handleConfigUpdate("enableSafetyChecks", checked)}
                    disabled={updateConfigMutation.isPending}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="pattern-detection" className="text-sm">
                    Pattern Detection
                  </Label>
                  <Switch
                    id="pattern-detection"
                    checked={config.enablePatternDetection}
                    onCheckedChange={(checked) =>
                      handleConfigUpdate("enablePatternDetection", checked)
                    }
                    disabled={updateConfigMutation.isPending}
                  />
                </div>
              </div>

              {showAdvanced && (
                <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                  <div className="space-y-2">
                    <Label className="text-sm">Take Profit %</Label>
                    <div className="text-lg font-medium">{config.takeProfitPercentage}%</div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Stop Loss %</Label>
                    <div className="text-lg font-medium">{config.stopLossPercentage}%</div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Confidence Threshold</Label>
                    <div className="text-lg font-medium">{config.patternConfidenceThreshold}%</div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Max Concurrent</Label>
                    <div className="text-lg font-medium">{config.maxConcurrentTrades}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workflow Status */}
      <StreamlinedWorkflowStatus autoRefresh={true} />
    </div>
  );
}

export default AutoSnipingControlPanel;
