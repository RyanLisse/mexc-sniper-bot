"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Play,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import {
  getCacheStrategyStatusColor,
  useCacheMetrics,
  useCacheWarmingTrigger,
} from "../../../hooks/use-cache-metrics";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../ui/card";
import { Progress } from "../../ui/progress";
import { Skeleton } from "../../ui/skeleton";
import { useToast } from "../../ui/use-toast";

// Helper component for status icons
function StrategyStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "active":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "pending":
      return <Clock className="h-4 w-4 text-blue-500" />;
    case "overdue":
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    case "disabled":
      return <RefreshCw className="h-4 w-4 text-gray-500" />;
    default:
      return <RefreshCw className="h-4 w-4 text-gray-500" />;
  }
}

// Helper component for error display
function CacheWarmingError({ error }: { error: unknown }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Cache Warming Control
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Cache Data</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Unknown error occurred"}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

// Type definitions for component props
interface CacheMetrics {
  successRate?: number;
  totalExecutions?: number;
  averageExecutionTime?: number;
}

interface Strategy {
  name: string;
  status: string;
  priority: string;
  frequency: number;
  lastRun?: string;
  nextRun?: string;
}

interface Connection {
  redis?: { connected: boolean; status: string };
  valkey?: { connected: boolean; status: string };
  gracefulDegradation?: {
    fallbackMode: boolean;
    message: string;
  };
}

// Helper component for performance metrics
function PerformanceOverview({
  metrics,
}: {
  metrics: CacheMetrics | undefined;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Success Rate</span>
          <span>{(metrics?.successRate || 0).toFixed(1)}%</span>
        </div>
        <Progress value={metrics?.successRate || 0} className="h-2" />
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold">
          {metrics?.totalExecutions || 0}
        </div>
        <div className="text-sm text-muted-foreground">Total Executions</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold">
          {(metrics?.averageExecutionTime || 0).toFixed(0)}ms
        </div>
        <div className="text-sm text-muted-foreground">Avg Execution Time</div>
      </div>
    </div>
  );
}

// Helper component for strategy list
function StrategyList({
  strategies,
  selectedStrategies,
  onToggleSelection,
  onTriggerStrategy,
  isTriggeringWarming,
}: {
  strategies: Strategy[];
  selectedStrategies: string[];
  onToggleSelection: (name: string) => void;
  onTriggerStrategy: (name: string) => void;
  isTriggeringWarming: boolean;
}) {
  return (
    <div className="space-y-3">
      <h4 className="font-medium">Warming Strategies</h4>
      {strategies.map((strategy) => (
        <div
          key={strategy.name}
          className={`border rounded-lg p-4 transition-colors ${
            selectedStrategies.includes(strategy.name)
              ? "bg-blue-50 border-blue-200"
              : ""
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedStrategies.includes(strategy.name)}
                onChange={() => onToggleSelection(strategy.name)}
                className="rounded"
              />
              <StrategyStatusIcon status={strategy.status} />
              <div>
                <div className="font-medium capitalize">
                  {strategy.name.replace(/-/g, " ")}
                </div>
                <div className="text-sm text-muted-foreground">
                  Priority: {strategy.priority} • Frequency:{" "}
                  {Math.round(strategy.frequency / 60000)}m
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                style={{
                  color: getCacheStrategyStatusColor(
                    strategy.status as
                      | "pending"
                      | "active"
                      | "disabled"
                      | "overdue"
                  ),
                }}
              >
                {strategy.status}
              </Badge>
              <Button
                onClick={() => onTriggerStrategy(strategy.name)}
                disabled={isTriggeringWarming}
                size="sm"
                variant="outline"
                className="flex items-center gap-1"
              >
                <Play className="h-3 w-3" />
                Trigger
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-muted-foreground">Last Run:</span>
              <div className="font-medium">
                {strategy.lastRun
                  ? new Date(strategy.lastRun).toLocaleString()
                  : "Never"}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Next Run:</span>
              <div className="font-medium">
                {strategy.nextRun
                  ? new Date(strategy.nextRun).toLocaleString()
                  : "Not scheduled"}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Helper component for connection status
function ConnectionStatus({
  connection,
}: {
  connection: Connection | undefined;
}) {
  return (
    <div className="border-t pt-4">
      <h4 className="font-medium mb-3">Cache Connection Status</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span>Redis</span>
          </div>
          <div className="flex items-center gap-2">
            {connection?.redis?.connected ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            )}
            <Badge
              variant={connection?.redis?.connected ? "default" : "destructive"}
            >
              {connection?.redis?.status || "Unknown"}
            </Badge>
          </div>
        </div>
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span>Valkey</span>
          </div>
          <div className="flex items-center gap-2">
            {connection?.valkey?.connected ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            )}
            <Badge
              variant={
                connection?.valkey?.connected ? "default" : "destructive"
              }
            >
              {connection?.valkey?.status || "Unknown"}
            </Badge>
          </div>
        </div>
      </div>

      {connection?.gracefulDegradation?.fallbackMode && (
        <Alert className="mt-3">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Fallback Mode Active</AlertTitle>
          <AlertDescription>
            {connection?.gracefulDegradation?.message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export function CacheWarmingControlPanel() {
  const { data, isLoading, error } = useCacheMetrics();
  const { mutate: triggerWarming, isPending: isTriggeringWarming } =
    useCacheWarmingTrigger();
  const { toast } = useToast();
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);

  const handleTriggerStrategy = async (strategyName: string, force = false) => {
    try {
      await triggerWarming(
        { strategy: strategyName, force },
        {
          onSuccess: (result) => {
            toast({
              title: "Cache Warming Triggered",
              description: `Strategy "${strategyName}" executed successfully in ${result.results[0]?.executionTime || 0}ms`,
            });
          },
          onError: (error) => {
            toast({
              title: "Cache Warming Failed",
              description:
                error instanceof Error
                  ? error.message
                  : "Unknown error occurred",
              variant: "destructive",
            });
          },
        }
      );
    } catch (error) {
      console.error("Error triggering cache warming:", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleTriggerMultiple = async () => {
    if (selectedStrategies.length === 0) {
      toast({
        title: "No Strategies Selected",
        description: "Please select at least one strategy to trigger",
        variant: "destructive",
      });
      return;
    }

    try {
      await triggerWarming(
        { strategies: selectedStrategies },
        {
          onSuccess: (result) => {
            toast({
              title: "Cache Warming Triggered",
              description: `${result.triggered}/${result.total} strategies executed successfully`,
            });
            setSelectedStrategies([]);
          },
          onError: (error) => {
            toast({
              title: "Cache Warming Failed",
              description:
                error instanceof Error
                  ? error.message
                  : "Unknown error occurred",
              variant: "destructive",
            });
          },
        }
      );
    } catch (error) {
      console.error("Error triggering multiple strategies:", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const toggleStrategySelection = (strategyName: string) => {
    setSelectedStrategies((prev) =>
      prev.includes(strategyName)
        ? prev.filter((s) => s !== strategyName)
        : [...prev, strategyName]
    );
  };

  if (isLoading) return <CacheWarmingControlSkeleton />;
  if (error) return <CacheWarmingError error={error} />;
  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            <CardTitle>Cache Warming Control</CardTitle>
            <Badge variant={data.warming?.isActive ? "default" : "secondary"}>
              {data.warming?.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {selectedStrategies.length > 0 && (
              <Button
                onClick={handleTriggerMultiple}
                disabled={isTriggeringWarming}
                size="sm"
                className="flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                Trigger Selected ({selectedStrategies.length})
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          Manage cache warming strategies for optimal performance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <PerformanceOverview metrics={data.warming?.metrics} />
        <StrategyList
          strategies={(data.warming?.strategies as Strategy[]) || []}
          selectedStrategies={selectedStrategies}
          onToggleSelection={toggleStrategySelection}
          onTriggerStrategy={handleTriggerStrategy}
          isTriggeringWarming={isTriggeringWarming}
        />
        <ConnectionStatus connection={data.connection} />
        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          Last updated:{" "}
          {data.lastUpdated
            ? new Date(data.lastUpdated).toLocaleString()
            : "Unknown"}
        </div>
      </CardContent>
    </Card>
  );
}

function CacheWarmingControlSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-4" />
                  <div>
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
