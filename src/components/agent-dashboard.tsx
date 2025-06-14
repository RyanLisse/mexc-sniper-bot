"use client";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { useToast } from "@/src/components/ui/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  Bot,
  Brain,
  Calendar,
  CheckCircle2,
  Clock,
  Pause,
  Play,
  RefreshCw,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useState } from "react";

interface AgentStatus {
  id: string;
  name: string;
  type: string;
  status: "active" | "idle" | "error" | "processing";
  lastActivity: string;
  tasksCompleted: number;
  successRate: number;
  capabilities: string[];
  currentTask?: string;
  metrics?: {
    avgResponseTime: number;
    totalExecutions: number;
    errorRate: number;
  };
}

const agentIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "mexc-api": Bot,
  calendar: Calendar,
  pattern: TrendingUp,
  symbol: Target,
  strategy: Brain,
  orchestrator: Zap,
};

const agentDescriptions: Record<string, string> = {
  "mexc-api": "MEXC exchange API integration and data analysis",
  calendar: "New cryptocurrency listing discovery and monitoring",
  pattern: "Trading pattern detection and early opportunity identification",
  symbol: "Real-time trading readiness assessment",
  strategy: "Trading strategy generation and risk management",
  orchestrator: "Multi-agent workflow coordination",
};

export function AgentDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // Fetch agent statuses
  const { data: agents, isLoading } = useQuery<AgentStatus[]>({
    queryKey: ["agent-status"],
    queryFn: async () => {
      // In a real implementation, this would fetch from an API endpoint
      // For now, we'll return mock data
      return [
        {
          id: "mexc-api",
          name: "MEXC API Agent",
          type: "mexc-api",
          status: "active",
          lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          tasksCompleted: 1248,
          successRate: 98.5,
          capabilities: [
            "API Integration",
            "Data Analysis",
            "Pattern Detection",
            "Data Quality Assessment",
          ],
          currentTask: "Analyzing BTCUSDT market data",
          metrics: {
            avgResponseTime: 245,
            totalExecutions: 1265,
            errorRate: 1.5,
          },
        },
        {
          id: "calendar",
          name: "Calendar Agent",
          type: "calendar",
          status: "processing",
          lastActivity: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
          tasksCompleted: 342,
          successRate: 96.2,
          capabilities: [
            "Listing Discovery",
            "Launch Analysis",
            "Market Assessment",
            "Monitoring Plans",
          ],
          currentTask: "Scanning MEXC calendar for new listings",
          metrics: {
            avgResponseTime: 1200,
            totalExecutions: 355,
            errorRate: 3.8,
          },
        },
        {
          id: "pattern",
          name: "Pattern Discovery Agent",
          type: "pattern",
          status: "idle",
          lastActivity: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          tasksCompleted: 789,
          successRate: 94.3,
          capabilities: [
            "Pattern Detection",
            "Confidence Scoring",
            "Launch Timing",
            "Market Readiness",
          ],
          metrics: {
            avgResponseTime: 3400,
            totalExecutions: 836,
            errorRate: 5.7,
          },
        },
        {
          id: "symbol",
          name: "Symbol Analysis Agent",
          type: "symbol",
          status: "active",
          lastActivity: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
          tasksCompleted: 2156,
          successRate: 97.8,
          capabilities: [
            "Readiness Assessment",
            "Market Analysis",
            "Risk Evaluation",
            "Monitoring Plans",
          ],
          currentTask: "Validating ETHUSDT ready state patterns",
          metrics: {
            avgResponseTime: 890,
            totalExecutions: 2204,
            errorRate: 2.2,
          },
        },
        {
          id: "strategy",
          name: "Strategy Agent",
          type: "strategy",
          status: "idle",
          lastActivity: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          tasksCompleted: 156,
          successRate: 92.1,
          capabilities: [
            "Strategy Generation",
            "Risk Management",
            "Portfolio Optimization",
            "Trading Plans",
          ],
          metrics: {
            avgResponseTime: 5600,
            totalExecutions: 169,
            errorRate: 7.9,
          },
        },
        {
          id: "orchestrator",
          name: "Orchestrator",
          type: "orchestrator",
          status: "active",
          lastActivity: new Date().toISOString(),
          tasksCompleted: 4589,
          successRate: 99.2,
          capabilities: [
            "Workflow Coordination",
            "Error Handling",
            "Performance Tracking",
            "Agent Management",
          ],
          currentTask: "Coordinating multi-agent calendar discovery workflow",
          metrics: {
            avgResponseTime: 120,
            totalExecutions: 4627,
            errorRate: 0.8,
          },
        },
      ];
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Execute agent action
  const executeAgentAction = useMutation({
    mutationFn: async ({ agentId, action }: { agentId: string; action: string }) => {
      // In real implementation, this would call an API endpoint
      console.log(`Executing ${action} on agent ${agentId}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { success: true };
    },
    onSuccess: (_, { agentId, action }) => {
      toast({
        title: "Agent Action Executed",
        description: `${action} action sent to ${agentId} agent`,
      });
      queryClient.invalidateQueries({ queryKey: ["agent-status"] });
    },
    onError: () => {
      toast({
        title: "Action Failed",
        description: "Failed to execute agent action",
        variant: "destructive",
      });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <Activity className="h-4 w-4 text-green-500" />;
      case "processing":
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "processing":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "error":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const formatLastActivity = (timestamp: string) => {
    const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Section */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {agents?.filter((a) => a.status === "active" || a.status === "processing").length ||
                0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              of {agents?.length || 0} total agents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {agents?.reduce((sum, agent) => sum + agent.tasksCompleted, 0).toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">completed successfully</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Avg Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {agents
                ? (
                    agents.reduce((sum, agent) => sum + agent.successRate, 0) / agents.length
                  ).toFixed(1)
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground mt-1">across all agents</p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents?.map((agent) => {
          const Icon = agentIcons[agent.type] || Bot;
          return (
            <Card
              key={agent.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                selectedAgent === agent.id ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => setSelectedAgent(agent.id)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{agent.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {formatLastActivity(agent.lastActivity)}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className={getStatusColor(agent.status)}>
                    {getStatusIcon(agent.status)}
                    <span className="ml-1 capitalize">{agent.status}</span>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {agent.currentTask && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Current: </span>
                      <span className="text-foreground">{agent.currentTask}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Tasks</p>
                      <p className="font-medium">{agent.tasksCompleted.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Success</p>
                      <p className="font-medium">{agent.successRate}%</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        executeAgentAction.mutate({ agentId: agent.id, action: "restart" });
                      }}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Restart
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        executeAgentAction.mutate({
                          agentId: agent.id,
                          action: agent.status === "active" ? "pause" : "resume",
                        });
                      }}
                    >
                      {agent.status === "active" ? (
                        <>
                          <Pause className="h-3 w-3 mr-1" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3 mr-1" />
                          Resume
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Agent Details */}
      {selectedAgent && (
        <Card>
          <CardHeader>
            <CardTitle>Agent Details</CardTitle>
            <CardDescription>
              {agentDescriptions[agents?.find((a) => a.id === selectedAgent)?.type || ""]}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="capabilities">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
                <TabsTrigger value="metrics">Metrics</TabsTrigger>
                <TabsTrigger value="logs">Activity Logs</TabsTrigger>
              </TabsList>

              <TabsContent value="capabilities" className="space-y-4">
                <div className="grid gap-2">
                  {agents
                    ?.find((a) => a.id === selectedAgent)
                    ?.capabilities.map((capability) => (
                      <div
                        key={capability}
                        className="flex items-center gap-2 p-3 bg-muted rounded-lg"
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm">{capability}</span>
                      </div>
                    ))}
                </div>
              </TabsContent>

              <TabsContent value="metrics" className="space-y-4">
                {(() => {
                  const agent = agents?.find((a) => a.id === selectedAgent);
                  return agent?.metrics ? (
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Avg Response Time</p>
                        <p className="text-2xl font-bold">{agent.metrics.avgResponseTime}ms</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Total Executions</p>
                        <p className="text-2xl font-bold">
                          {agent.metrics.totalExecutions.toLocaleString()}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Error Rate</p>
                        <p className="text-2xl font-bold">{agent.metrics.errorRate}%</p>
                      </div>
                    </div>
                  ) : null;
                })()}
              </TabsContent>

              <TabsContent value="logs">
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {/* Mock activity logs */}
                    {Array.from({ length: 10 }, (_, i) => {
                      const timestamp = Date.now() - i * 5 * 60 * 1000;
                      return (
                        <div
                          key={`activity-log-${timestamp}`}
                          className="flex items-start gap-2 p-2 text-sm"
                        >
                          <span className="text-muted-foreground whitespace-nowrap">
                            {new Date(timestamp).toLocaleTimeString()}
                          </span>
                          <span>Executed task: Analysis completed for symbol XYZ</span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
