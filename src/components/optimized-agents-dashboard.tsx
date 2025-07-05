"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  Calendar,
  CheckCircle,
  RefreshCw,
  Settings,
  Target,
  XCircle,
} from "lucide-react";
import { z } from "zod";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Progress } from "./ui/progress";

// Zod schema for agent status validation
const AgentStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum([
    "calendar",
    "pattern-discovery",
    "symbol-analysis",
    "mexc-api",
    "orchestrator",
  ]),
  status: z.enum(["active", "inactive", "error", "starting", "stopping"]),
  healthScore: z.number().min(0).max(100),
  lastActivity: z.string(),
  performance: z.object({
    uptime: z.number(),
    successRate: z.number(),
    totalOperations: z.number(),
    avgResponseTime: z.number(),
  }),
  currentTask: z.string().optional(),
  errors: z.array(z.string()).default([]),
  capabilities: z.array(z.string()).default([]),
});

type AgentStatus = z.infer<typeof AgentStatusSchema>;

const AgentListSchema = z.object({
  agents: z.array(AgentStatusSchema),
  systemStatus: z.enum(["healthy", "warning", "error"]),
  totalAgents: z.number(),
  activeAgents: z.number(),
  lastUpdate: z.string(),
});

type AgentList = z.infer<typeof AgentListSchema>;

interface OptimizedAgentsDashboardProps {
  className?: string;
  autoRefresh?: boolean;
}

export function OptimizedAgentsDashboard({
  className = "",
  autoRefresh = true,
}: OptimizedAgentsDashboardProps) {
  // Fetch agent statuses
  const {
    data: agentData,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["agents", "status"],
    queryFn: async (): Promise<AgentList> => {
      const response = await fetch("/api/agents/status");
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch agent status");
      }

      // Validate with Zod schema
      try {
        return AgentListSchema.parse(result.data);
      } catch (validationError) {
        console.error("Agent data validation failed:", validationError);
        throw new Error("Invalid agent data format received from API");
      }
    },
    staleTime: 15000,
    refetchInterval: autoRefresh ? 30000 : false,
    retry: 2,
  });

  const getAgentIcon = (type: AgentStatus["type"]) => {
    switch (type) {
      case "calendar":
        return Calendar;
      case "pattern-discovery":
        return Target;
      case "symbol-analysis":
        return BarChart3;
      case "mexc-api":
        return Activity;
      case "orchestrator":
        return Settings;
      default:
        return Bot;
    }
  };

  const getStatusConfig = (status: AgentStatus["status"]) => {
    switch (status) {
      case "active":
        return {
          color: "green",
          icon: CheckCircle,
          text: "Active",
          variant: "default" as const,
        };
      case "error":
        return {
          color: "red",
          icon: XCircle,
          text: "Error",
          variant: "destructive" as const,
        };
      case "starting":
      case "stopping":
        return {
          color: "yellow",
          icon: RefreshCw,
          text: status === "starting" ? "Starting" : "Stopping",
          variant: "secondary" as const,
        };
      default:
        return {
          color: "gray",
          icon: AlertTriangle,
          text: "Inactive",
          variant: "secondary" as const,
        };
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>AI Agent System</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <XCircle className="h-5 w-5 text-red-500" />
            <span className="text-sm text-red-700 dark:text-red-300">
              Failed to load agent status: {error.message}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* System Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bot className="h-5 w-5" />
              <CardTitle>Multi-Agent Trading System</CardTitle>
            </div>
            <div className="flex items-center space-x-2">
              <Badge
                variant={
                  agentData?.systemStatus === "healthy"
                    ? "default"
                    : "secondary"
                }
              >
                {agentData?.systemStatus || "Unknown"}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading || isFetching}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoading || isFetching ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>
          <CardDescription>
            {agentData
              ? `${agentData.activeAgents}/${agentData.totalAgents} agents active • Specialized TypeScript agents for auto-sniping`
              : "Loading agent information..."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Quick Stats */}
          {agentData && (
            <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
              <div className="text-center p-3 border rounded">
                <div className="font-bold text-lg text-green-600">
                  {agentData.activeAgents}
                </div>
                <div className="text-muted-foreground">Active Agents</div>
              </div>
              <div className="text-center p-3 border rounded">
                <div className="font-bold text-lg text-blue-600">
                  {agentData.agents.reduce(
                    (sum, agent) => sum + agent.performance.totalOperations,
                    0
                  )}
                </div>
                <div className="text-muted-foreground">Total Operations</div>
              </div>
              <div className="text-center p-3 border rounded">
                <div className="font-bold text-lg text-purple-600">
                  {(
                    agentData.agents.reduce(
                      (sum, agent) => sum + agent.performance.successRate,
                      0
                    ) / agentData.agents.length
                  ).toFixed(1)}
                  %
                </div>
                <div className="text-muted-foreground">Avg Success Rate</div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && !agentData && (
            <div className="flex items-center space-x-3 p-4">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">
                Loading agent statuses...
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Individual Agent Cards */}
      {agentData && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agentData.agents.map((agent) => {
            const AgentIcon = getAgentIcon(agent.type);
            const statusConfig = getStatusConfig(agent.status);
            const StatusIcon = statusConfig.icon;

            return (
              <Card key={agent.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <AgentIcon className="h-4 w-4" />
                      <CardTitle className="text-base">{agent.name}</CardTitle>
                    </div>
                    <Badge variant={statusConfig.variant}>
                      <StatusIcon
                        className={`h-3 w-3 mr-1 ${agent.status === "starting" || agent.status === "stopping" ? "animate-spin" : ""}`}
                      />
                      {statusConfig.text}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Health Score */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Health Score</span>
                      <span
                        className={`font-medium ${getHealthColor(agent.healthScore)}`}
                      >
                        {agent.healthScore}%
                      </span>
                    </div>
                    <Progress value={agent.healthScore} className="h-2" />
                  </div>

                  {/* Current Task */}
                  {agent.currentTask && (
                    <div className="text-sm">
                      <div className="font-medium text-muted-foreground mb-1">
                        Current Task
                      </div>
                      <div className="text-xs">{agent.currentTask}</div>
                    </div>
                  )}

                  {/* Performance Metrics */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="font-medium text-green-600">
                        {agent.performance.successRate.toFixed(1)}%
                      </div>
                      <div className="text-muted-foreground">Success Rate</div>
                    </div>
                    <div>
                      <div className="font-medium text-blue-600">
                        {agent.performance.avgResponseTime}ms
                      </div>
                      <div className="text-muted-foreground">Avg Response</div>
                    </div>
                    <div>
                      <div className="font-medium text-purple-600">
                        {agent.performance.totalOperations}
                      </div>
                      <div className="text-muted-foreground">Operations</div>
                    </div>
                    <div>
                      <div className="font-medium text-orange-600">
                        {Math.floor(agent.performance.uptime / 3600)}h
                      </div>
                      <div className="text-muted-foreground">Uptime</div>
                    </div>
                  </div>

                  {/* Capabilities */}
                  {agent.capabilities.length > 0 && (
                    <div className="text-xs">
                      <div className="font-medium text-muted-foreground mb-1">
                        Capabilities
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {agent.capabilities
                          .slice(0, 3)
                          .map((capability, index) => (
                            <Badge
                              key={`capability-${capability.replace(/[^a-zA-Z0-9]/g, "")}-${index}`}
                              variant="outline"
                              className="text-xs"
                            >
                              {capability}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Errors */}
                  {agent.errors.length > 0 && (
                    <div className="text-xs">
                      <div className="font-medium text-red-600 mb-1">
                        Recent Errors
                      </div>
                      <div className="text-red-700 dark:text-red-300">
                        {agent.errors[0]}
                      </div>
                    </div>
                  )}

                  {/* Last Activity */}
                  <div className="text-xs text-muted-foreground">
                    Last activity:{" "}
                    {new Date(agent.lastActivity).toLocaleTimeString()}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* System Architecture Info */}
      <Card>
        <CardHeader>
          <CardTitle>System Architecture</CardTitle>
          <CardDescription>
            How the 5 specialized agents work together for auto-sniping
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start space-x-3">
              <Calendar className="h-4 w-4 text-orange-500 mt-0.5" />
              <div>
                <div className="font-medium">Calendar Agent</div>
                <div className="text-muted-foreground">
                  Monitors MEXC calendar for new listing announcements and
                  schedules monitoring workflows
                </div>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Target className="h-4 w-4 text-green-500 mt-0.5" />
              <div>
                <div className="font-medium">Pattern Discovery Agent</div>
                <div className="text-muted-foreground">
                  Detects ready-state patterns (sts:2, st:2, tt:4) with 3.5+
                  hour advance detection
                </div>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <BarChart3 className="h-4 w-4 text-purple-500 mt-0.5" />
              <div>
                <div className="font-medium">Symbol Analysis Agent</div>
                <div className="text-muted-foreground">
                  Performs real-time readiness assessment and market analysis
                  with confidence scoring
                </div>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Activity className="h-4 w-4 text-blue-500 mt-0.5" />
              <div>
                <div className="font-medium">MEXC API Agent</div>
                <div className="text-muted-foreground">
                  Handles all MEXC API interactions, data analysis, and trade
                  execution with AI insights
                </div>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Settings className="h-4 w-4 text-red-500 mt-0.5" />
              <div>
                <div className="font-medium">Orchestrator Agent</div>
                <div className="text-muted-foreground">
                  Coordinates multi-agent workflows, synthesizes results, and
                  handles error recovery
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default OptimizedAgentsDashboard;
