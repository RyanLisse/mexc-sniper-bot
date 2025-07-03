"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Brain,
  Calendar,
  CheckCircle2,
  Clock,
  Pause,
  Play,
  RefreshCw,
  Target,
  Timer,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useToast } from "./ui/use-toast";

interface WorkflowStatus {
  id: string;
  name: string;
  type: "event" | "scheduled";
  status: "running" | "stopped" | "error";
  lastRun?: string;
  nextRun?: string;
  schedule?: string;
  executionCount: number;
  successCount: number;
  errorCount: number;
  avgDuration: number;
  description: string;
  trigger?: string;
}

interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: "success" | "failed" | "running";
  startTime: string;
  duration?: number;
  error?: string;
  result?: any;
  metadata?: {
    type: string;
    message: string;
    symbolName?: string;
    vcoinId?: string;
    level: string;
  };
}

const workflowIcons: Record<string, any> = {
  "poll-mexc-calendar": Calendar,
  "watch-mexc-symbol": Target,
  "analyze-mexc-patterns": TrendingUp,
  "create-mexc-trading-strategy": Brain,
  "scheduled-calendar-monitoring": Calendar,
  "scheduled-pattern-analysis": TrendingUp,
  "scheduled-health-check": Activity,
  "scheduled-daily-report": BarChart3,
  "scheduled-intensive-analysis": Zap,
  "emergency-response-handler": AlertCircle,
};

export function WorkflowManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [executionFilter, setExecutionFilter] = useState<
    "all" | "success" | "failed"
  >("all");

  // Fetch workflow statuses
  const { data: workflows, isLoading: workflowsLoading } = useQuery<
    WorkflowStatus[]
  >({
    queryKey: ["workflow-status"],
    queryFn: async () => {
      try {
        const response = await fetch(
          "/api/workflow-status?format=workflows&includeMetrics=true"
        );
        if (!response.ok) {
          throw new Error("Failed to fetch workflow status");
        }
        const result = await response.json();
        return result.success ? result.data : [];
      } catch (error) {
        console.error("Failed to fetch workflow status:", error);
        throw error;
      }
    },
    refetchInterval: 10000, // Refresh every 10 seconds
    retry: 2,
  });

  // Fetch workflow executions
  const { data: executionsResponse, isLoading: executionsLoading } = useQuery({
    queryKey: ["workflow-executions", selectedWorkflow, executionFilter],
    queryFn: async () => {
      if (!selectedWorkflow) return null;

      const params = new URLSearchParams({
        workflowId: selectedWorkflow,
        status: executionFilter,
        limit: "20",
        offset: "0",
      });

      const response = await fetch(`/api/workflow-executions?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch workflow executions");
      }

      return response.json();
    },
    enabled: !!selectedWorkflow,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const executions = executionsResponse?.success
    ? executionsResponse.data.executions
    : [];

  // Trigger workflow
  const triggerWorkflow = useMutation({
    mutationFn: async (workflowId: string) => {
      const workflow = workflows?.find((w) => w.id === workflowId);
      if (!workflow) throw new Error("Workflow not found");

      let endpoint = "";
      switch (workflowId) {
        case "poll-mexc-calendar":
          endpoint = "/api/triggers/calendar-poll";
          break;
        case "watch-mexc-symbol":
          endpoint = "/api/triggers/symbol-watch";
          break;
        case "analyze-mexc-patterns":
          endpoint = "/api/triggers/pattern-analysis";
          break;
        case "create-mexc-trading-strategy":
          endpoint = "/api/triggers/trading-strategy";
          break;
        case "scheduled-intensive-analysis":
          endpoint = "/api/schedule/control";
          break;
        default:
          throw new Error("No trigger endpoint for this workflow");
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          workflowId === "scheduled-intensive-analysis"
            ? { action: "force_analysis" }
            : {}
        ),
      });

      if (!response.ok) throw new Error("Failed to trigger workflow");
      return response.json();
    },
    onSuccess: async (_, workflowId) => {
      toast({
        title: "Workflow Triggered",
        description: `Successfully triggered ${workflows?.find((w) => w.id === workflowId)?.name}`,
      });

      // Log workflow execution start
      try {
        await fetch("/api/workflow-executions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workflowId,
            type: "manual_trigger",
            message: `Workflow ${workflows?.find((w) => w.id === workflowId)?.name} triggered manually`,
            level: "info",
          }),
        });
      } catch (error) {
        console.warn("Failed to log workflow execution:", error);
      }

      queryClient.invalidateQueries({ queryKey: ["workflow-status"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-executions"] });
    },
    onError: (error) => {
      toast({
        title: "Trigger Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Control scheduled workflows
  const controlScheduledWorkflows = useMutation({
    mutationFn: async (action: "start" | "stop") => {
      // Update all scheduled workflows status
      const scheduledWorkflows =
        workflows?.filter((w) => w.type === "scheduled") || [];
      const promises = scheduledWorkflows.map((workflow) =>
        fetch("/api/workflow-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            workflowId: workflow.id,
          }),
        })
      );

      const responses = await Promise.all(promises);
      const failedResponses = responses.filter((r) => !r.ok);

      if (failedResponses.length > 0) {
        throw new Error(
          `Failed to ${action} ${failedResponses.length} workflow(s)`
        );
      }

      return { action, updatedWorkflows: scheduledWorkflows.length };
    },
    onSuccess: (_result, action) => {
      toast({
        title: `Monitoring ${action === "start" ? "Started" : "Stopped"}`,
        description: `All scheduled workflows have been ${action === "start" ? "started" : "stopped"}`,
      });
      queryClient.invalidateQueries({ queryKey: ["workflow-status"] });
    },
    onError: (error) => {
      toast({
        title: "Control Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatSchedule = (cron: string) => {
    const parts = cron.split(" ");
    if (parts[0] === "*/5") return "Every 5 minutes";
    if (parts[0] === "*/15") return "Every 15 minutes";
    if (parts[0] === "*/30") return "Every 30 minutes";
    if (parts[0] === "0" && parts[1] === "*/2") return "Every 2 hours";
    if (parts[0] === "0" && parts[1] === "9") return "Daily at 9 AM UTC";
    return cron;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "success":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "stopped":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
      case "failed":
      case "error":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  if (workflowsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const eventWorkflows = workflows?.filter((w) => w.type === "event") || [];
  const scheduledWorkflows =
    workflows?.filter((w) => w.type === "scheduled") || [];

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Workflow Control Center</CardTitle>
              <CardDescription>
                Manage and monitor all Inngest workflows
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => controlScheduledWorkflows.mutate("start")}
              >
                <Play className="h-4 w-4 mr-2" />
                Start All Scheduled
              </Button>
              <Button
                variant="outline"
                onClick={() => controlScheduledWorkflows.mutate("stop")}
              >
                <Pause className="h-4 w-4 mr-2" />
                Stop All Scheduled
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Workflow Tabs */}
      <Tabs defaultValue="event" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="event">
            Event-Driven ({eventWorkflows.length})
          </TabsTrigger>
          <TabsTrigger value="scheduled">
            Scheduled ({scheduledWorkflows.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="event" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {eventWorkflows.map((workflow) => {
              const Icon = workflowIcons[workflow.id] || Zap;
              return (
                <Card
                  key={workflow.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    selectedWorkflow === workflow.id
                      ? "ring-2 ring-primary"
                      : ""
                  }`}
                  onClick={() => setSelectedWorkflow(workflow.id)}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-lg">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            {workflow.name}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Trigger: {workflow.trigger}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={getStatusColor(workflow.status)}
                      >
                        {workflow.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {workflow.description}
                      </p>

                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Executions</p>
                          <p className="font-medium">
                            {workflow.executionCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Success</p>
                          <p className="font-medium text-green-500">
                            {workflow.successCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Errors</p>
                          <p className="font-medium text-red-500">
                            {workflow.errorCount}
                          </p>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerWorkflow.mutate(workflow.id);
                        }}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Trigger Now
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {scheduledWorkflows.map((workflow) => {
              const Icon = workflowIcons[workflow.id] || Clock;
              return (
                <Card
                  key={workflow.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    selectedWorkflow === workflow.id
                      ? "ring-2 ring-primary"
                      : ""
                  }`}
                  onClick={() => setSelectedWorkflow(workflow.id)}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-lg">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            {workflow.name}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {formatSchedule(workflow.schedule || "")}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={getStatusColor(workflow.status)}
                      >
                        {workflow.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {workflow.description}
                      </p>

                      <div className="space-y-1 text-sm">
                        {workflow.nextRun && (
                          <div className="flex items-center gap-2">
                            <Timer className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Next run:
                            </span>
                            <span>
                              {new Date(workflow.nextRun).toLocaleTimeString()}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Runs</p>
                          <p className="font-medium">
                            {workflow.executionCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Success</p>
                          <p className="font-medium">
                            {(
                              (workflow.successCount /
                                workflow.executionCount) *
                              100
                            ).toFixed(0)}
                            %
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Avg Time</p>
                          <p className="font-medium">
                            {formatDuration(workflow.avgDuration)}
                          </p>
                        </div>
                      </div>

                      {workflow.id === "scheduled-intensive-analysis" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerWorkflow.mutate(workflow.id);
                          }}
                        >
                          <Zap className="h-3 w-3 mr-1" />
                          Force Analysis
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Execution History */}
      {selectedWorkflow && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Execution History</CardTitle>
                <CardDescription>
                  {workflows?.find((w) => w.id === selectedWorkflow)?.name}
                </CardDescription>
              </div>
              <Select
                value={executionFilter}
                onValueChange={(value: any) => setExecutionFilter(value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              {executionsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">
                    Loading execution history...
                  </span>
                </div>
              ) : !executions || executions.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center text-muted-foreground">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No execution history found</p>
                    <p className="text-xs">
                      Trigger the workflow to see executions
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {executions.map((execution: WorkflowExecution) => (
                    <div
                      key={execution.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {execution.status === "success" && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                        {execution.status === "failed" && (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        {execution.status === "running" && (
                          <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {new Date(execution.startTime).toLocaleString()}
                          </p>
                          {execution.error && (
                            <p className="text-xs text-red-500">
                              {execution.error}
                            </p>
                          )}
                          {execution.result && (
                            <p className="text-xs text-muted-foreground">
                              {execution.result.message ||
                                (execution.result.itemsProcessed &&
                                  `Processed ${execution.result.itemsProcessed} items`) ||
                                "Execution completed successfully"}
                            </p>
                          )}
                          {execution.metadata?.symbolName && (
                            <p className="text-xs text-blue-500">
                              Symbol: {execution.metadata.symbolName}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {execution.duration
                          ? formatDuration(execution.duration)
                          : "Running..."}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
