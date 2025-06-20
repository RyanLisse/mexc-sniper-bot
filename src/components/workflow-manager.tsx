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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
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
  const [executionFilter, setExecutionFilter] = useState<"all" | "success" | "failed">("all");

  // Fetch workflow statuses
  const { data: workflows, isLoading: workflowsLoading } = useQuery<WorkflowStatus[]>({
    queryKey: ["workflow-status"],
    queryFn: async () => {
      // In real implementation, fetch from API
      return [
        {
          id: "poll-mexc-calendar",
          name: "Calendar Discovery",
          type: "event",
          status: "running",
          lastRun: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          executionCount: 248,
          successCount: 245,
          errorCount: 3,
          avgDuration: 12500,
          description: "Multi-agent calendar discovery for new coin listings",
          trigger: "mexc/calendar.poll",
        },
        {
          id: "watch-mexc-symbol",
          name: "Symbol Watcher",
          type: "event",
          status: "running",
          lastRun: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          executionCount: 1523,
          successCount: 1498,
          errorCount: 25,
          avgDuration: 8900,
          description: "Monitors specific symbols for trading readiness",
          trigger: "mexc/symbol.watch",
        },
        {
          id: "analyze-mexc-patterns",
          name: "Pattern Analysis",
          type: "event",
          status: "running",
          lastRun: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          executionCount: 856,
          successCount: 823,
          errorCount: 33,
          avgDuration: 15600,
          description: "Pattern discovery and validation on symbols",
          trigger: "mexc/patterns.analyze",
        },
        {
          id: "create-mexc-trading-strategy",
          name: "Strategy Creator",
          type: "event",
          status: "running",
          lastRun: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          executionCount: 156,
          successCount: 148,
          errorCount: 8,
          avgDuration: 23400,
          description: "AI-powered trading strategy generation",
          trigger: "mexc/strategy.create",
        },
        {
          id: "scheduled-calendar-monitoring",
          name: "Calendar Monitor",
          type: "scheduled",
          status: "running",
          lastRun: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
          nextRun: new Date(Date.now() + 18 * 60 * 1000).toISOString(),
          schedule: "*/30 * * * *",
          executionCount: 336,
          successCount: 334,
          errorCount: 2,
          avgDuration: 14200,
          description: "Automated calendar polling every 30 minutes",
        },
        {
          id: "scheduled-pattern-analysis",
          name: "Pattern Scanner",
          type: "scheduled",
          status: "running",
          lastRun: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
          nextRun: new Date(Date.now() + 12 * 60 * 1000).toISOString(),
          schedule: "*/15 * * * *",
          executionCount: 672,
          successCount: 668,
          errorCount: 4,
          avgDuration: 18900,
          description: "Regular pattern analysis every 15 minutes",
        },
        {
          id: "scheduled-health-check",
          name: "Health Check",
          type: "scheduled",
          status: "running",
          lastRun: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
          nextRun: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
          schedule: "*/5 * * * *",
          executionCount: 2016,
          successCount: 2012,
          errorCount: 4,
          avgDuration: 450,
          description: "System health monitoring every 5 minutes",
        },
        {
          id: "scheduled-daily-report",
          name: "Daily Report",
          type: "scheduled",
          status: "running",
          lastRun: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
          nextRun: new Date(Date.now() + 16 * 60 * 60 * 1000).toISOString(),
          schedule: "0 9 * * *",
          executionCount: 42,
          successCount: 42,
          errorCount: 0,
          avgDuration: 34500,
          description: "Daily performance report at 9 AM UTC",
        },
        {
          id: "emergency-response-handler",
          name: "Emergency Handler",
          type: "event",
          status: "running",
          lastRun: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
          executionCount: 12,
          successCount: 12,
          errorCount: 0,
          avgDuration: 5600,
          description: "Handles system emergencies and recovery",
          trigger: "mexc/emergency.detected",
        },
      ];
    },
    refetchInterval: 10000,
  });

  // Fetch workflow executions
  const { data: executions } = useQuery<WorkflowExecution[]>({
    queryKey: ["workflow-executions", selectedWorkflow, executionFilter],
    queryFn: async () => {
      if (!selectedWorkflow) return [];

      // Mock execution history
      const mockExecutions: WorkflowExecution[] = [];
      for (let i = 0; i < 20; i++) {
        const status = i % 10 === 0 ? "failed" : i % 5 === 0 ? "running" : "success";
        mockExecutions.push({
          id: `exec-${i}`,
          workflowId: selectedWorkflow,
          status: status as any,
          startTime: new Date(Date.now() - i * 30 * 60 * 1000).toISOString(),
          duration: status === "running" ? undefined : Math.floor(Math.random() * 20000) + 5000,
          error: status === "failed" ? "Connection timeout to MEXC API" : undefined,
          result:
            status === "success"
              ? { itemsProcessed: Math.floor(Math.random() * 100) + 1 }
              : undefined,
        });
      }

      return mockExecutions.filter(
        (exec) => executionFilter === "all" || exec.status === executionFilter
      );
    },
    enabled: !!selectedWorkflow,
  });

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
          workflowId === "scheduled-intensive-analysis" ? { action: "force_analysis" } : {}
        ),
      });

      if (!response.ok) throw new Error("Failed to trigger workflow");
      return response.json();
    },
    onSuccess: (_, workflowId) => {
      toast({
        title: "Workflow Triggered",
        description: `Successfully triggered ${workflows?.find((w) => w.id === workflowId)?.name}`,
      });
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
      const response = await fetch("/api/schedule/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: `${action}_monitoring` }),
      });

      if (!response.ok) throw new Error(`Failed to ${action} monitoring`);
      return response.json();
    },
    onSuccess: (_, action) => {
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
  const scheduledWorkflows = workflows?.filter((w) => w.type === "scheduled") || [];

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Workflow Control Center</CardTitle>
              <CardDescription>Manage and monitor all Inngest workflows</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => controlScheduledWorkflows.mutate("start")}>
                <Play className="h-4 w-4 mr-2" />
                Start All Scheduled
              </Button>
              <Button variant="outline" onClick={() => controlScheduledWorkflows.mutate("stop")}>
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
          <TabsTrigger value="event">Event-Driven ({eventWorkflows.length})</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled ({scheduledWorkflows.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="event" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {eventWorkflows.map((workflow) => {
              const Icon = workflowIcons[workflow.id] || Zap;
              return (
                <Card
                  key={workflow.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    selectedWorkflow === workflow.id ? "ring-2 ring-primary" : ""
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
                          <CardTitle className="text-base">{workflow.name}</CardTitle>
                          <CardDescription className="text-xs">
                            Trigger: {workflow.trigger}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className={getStatusColor(workflow.status)}>
                        {workflow.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">{workflow.description}</p>

                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Executions</p>
                          <p className="font-medium">{workflow.executionCount}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Success</p>
                          <p className="font-medium text-green-500">{workflow.successCount}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Errors</p>
                          <p className="font-medium text-red-500">{workflow.errorCount}</p>
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
                    selectedWorkflow === workflow.id ? "ring-2 ring-primary" : ""
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
                          <CardTitle className="text-base">{workflow.name}</CardTitle>
                          <CardDescription className="text-xs">
                            {formatSchedule(workflow.schedule || "")}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className={getStatusColor(workflow.status)}>
                        {workflow.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">{workflow.description}</p>

                      <div className="space-y-1 text-sm">
                        {workflow.nextRun && (
                          <div className="flex items-center gap-2">
                            <Timer className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Next run:</span>
                            <span>{new Date(workflow.nextRun).toLocaleTimeString()}</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Runs</p>
                          <p className="font-medium">{workflow.executionCount}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Success</p>
                          <p className="font-medium">
                            {((workflow.successCount / workflow.executionCount) * 100).toFixed(0)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Avg Time</p>
                          <p className="font-medium">{formatDuration(workflow.avgDuration)}</p>
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
              <div className="space-y-2">
                {executions?.map((execution) => (
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
                          <p className="text-xs text-red-500">{execution.error}</p>
                        )}
                        {execution.result && (
                          <p className="text-xs text-muted-foreground">
                            Processed {execution.result.itemsProcessed} items
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {execution.duration ? formatDuration(execution.duration) : "Running..."}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
