/**
 * Real-time Dashboard Component
 *
 * Comprehensive dashboard integrating all real-time WebSocket functionality.
 * Displays live agent status, trading data, pattern discovery, and notifications.
 *
 * Features:
 * - Real-time agent monitoring
 * - Live trading data feeds
 * - Pattern discovery alerts
 * - Trading signals display
 * - Performance metrics
 * - Interactive controls
 */

"use client";
import { Alert, AlertDescription, AlertTitle } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Progress } from "@/src/components/ui/progress";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { useLiveTradingData } from "@/src/hooks/use-live-trading-data";
import { useRealTimePatterns } from "@/src/hooks/use-real-time-patterns";
import {
  useAgentStatus,
  useNotifications,
  useWebSocket,
  useWorkflows,
} from "@/src/hooks/use-websocket";
import { useKindeBrowserClient } from "@kinde-oss/kinde-auth-nextjs";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  TrendingUp,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";

// ======================
// Connection Status Component
// ======================

interface ConnectionStatusProps {
  isConnected: boolean;
  state: string;
  metrics: any;
  error: string | null;
  onReconnect: () => void;
}

function ConnectionStatus({
  isConnected,
  state,
  metrics,
  error,
  onReconnect,
}: ConnectionStatusProps) {
  const statusColor = isConnected ? "text-green-600" : "text-red-600";
  const StatusIcon = isConnected ? Wifi : WifiOff;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <StatusIcon className={`h-5 w-5 ${statusColor}`} />
          WebSocket Connection
          <Badge variant={isConnected ? "default" : "destructive"}>{state}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Messages Sent</p>
            <p className="text-lg font-semibold">{metrics?.messagesSent || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Messages Received</p>
            <p className="text-lg font-semibold">{metrics?.messagesReceived || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Subscriptions</p>
            <p className="text-lg font-semibold">{metrics?.subscriptions || 0}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Queued Messages</p>
            <p className="text-lg font-semibold">{metrics?.queuedMessages || 0}</p>
          </div>
        </div>

        {error && (
          <Alert className="mt-4" variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!isConnected && (
          <Button onClick={onReconnect} className="mt-4" variant="outline">
            Reconnect
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ======================
// Agent Status Component
// ======================

function AgentStatusPanel() {
  const { agentStatuses, lastUpdate } = useAgentStatus();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-green-600";
      case "degraded":
        return "text-yellow-600";
      case "unhealthy":
        return "text-red-600";
      case "offline":
        return "text-gray-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return CheckCircle;
      case "degraded":
        return AlertTriangle;
      case "unhealthy":
        return AlertTriangle;
      case "offline":
        return Clock;
      default:
        return Clock;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Agent Status
          <Badge variant="outline">{agentStatuses.length} agents</Badge>
        </CardTitle>
        <CardDescription>
          Real-time status of all 11 AI agents
          {lastUpdate > 0 && (
            <span className="ml-2 text-xs">
              Updated {Math.round((Date.now() - lastUpdate) / 1000)}s ago
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-3">
            {agentStatuses.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No agent data available</p>
            ) : (
              agentStatuses.map((agent) => {
                const StatusIcon = getStatusIcon(agent.status);
                return (
                  <div
                    key={agent.agentId}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <StatusIcon className={`h-4 w-4 ${getStatusColor(agent.status)}`} />
                      <div>
                        <p className="font-medium">{agent.agentType}</p>
                        <p className="text-xs text-muted-foreground">{agent.agentId}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={
                          agent.status === "healthy"
                            ? "default"
                            : agent.status === "degraded"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {agent.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">{agent.responseTime}ms</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ======================
// Trading Data Component
// ======================

function TradingDataPanel() {
  const symbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT"];
  const { prices, getPrice, getTopMovers, lastUpdate } = useLiveTradingData({
    symbols,
    enableOrderBook: true,
    enableSignals: true,
  });

  const gainers = getTopMovers("gainers", 5);
  const losers = getTopMovers("losers", 5);

  const formatPrice = (price: number) => {
    return price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  const formatPercent = (percent: number) => {
    const sign = percent >= 0 ? "+" : "";
    return `${sign}${percent?.toFixed(2)}%`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Live Trading Data
          <Badge variant="outline">{Array.from(prices.keys()).length} symbols</Badge>
        </CardTitle>
        <CardDescription>
          Real-time price feeds from MEXC
          {lastUpdate > 0 && (
            <span className="ml-2 text-xs">
              Updated {Math.round((Date.now() - lastUpdate) / 1000)}s ago
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="watchlist" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
            <TabsTrigger value="gainers">Top Gainers</TabsTrigger>
            <TabsTrigger value="losers">Top Losers</TabsTrigger>
          </TabsList>

          <TabsContent value="watchlist">
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {symbols.map((symbol) => {
                  const price = getPrice(symbol);
                  if (!price) return null;

                  return (
                    <div
                      key={symbol}
                      className="flex items-center justify-between p-2 rounded border"
                    >
                      <div>
                        <p className="font-medium">{symbol}</p>
                        <p className="text-sm text-muted-foreground">
                          Vol: {price.volume?.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono">${formatPrice(price.price)}</p>
                        <p
                          className={`text-sm ${price.changePercent >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {formatPercent(price.changePercent)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="gainers">
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {gainers.map((price) => (
                  <div
                    key={price.symbol}
                    className="flex items-center justify-between p-2 rounded border"
                  >
                    <div>
                      <p className="font-medium">{price.symbol}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono">${formatPrice(price.price)}</p>
                      <p className="text-sm text-green-600">{formatPercent(price.changePercent)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="losers">
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {losers.map((price) => (
                  <div
                    key={price.symbol}
                    className="flex items-center justify-between p-2 rounded border"
                  >
                    <div>
                      <p className="font-medium">{price.symbol}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono">${formatPrice(price.price)}</p>
                      <p className="text-sm text-red-600">{formatPercent(price.changePercent)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ======================
// Pattern Discovery Component
// ======================

function PatternDiscoveryPanel() {
  const { patterns, readyStates, alerts, metrics, dismissAlert } = useRealTimePatterns({
    minConfidence: 0.7,
    enableSignals: true,
    enableAnalytics: true,
  });

  const readySymbols = Array.from(readyStates.values()).filter((rs) => rs.isReady);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Pattern Discovery
          <Badge variant="outline">{patterns.length} patterns</Badge>
        </CardTitle>
        <CardDescription>Real-time AI pattern detection and ready state monitoring</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{readySymbols.length}</p>
            <p className="text-xs text-muted-foreground">Ready Symbols</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{patterns.length}</p>
            <p className="text-xs text-muted-foreground">Total Patterns</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{Math.round(metrics.averageConfidence * 100)}%</p>
            <p className="text-xs text-muted-foreground">Avg Confidence</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{Math.round(metrics.successRate * 100)}%</p>
            <p className="text-xs text-muted-foreground">Success Rate</p>
          </div>
        </div>

        <Tabs defaultValue="alerts" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            <TabsTrigger value="ready">Ready States</TabsTrigger>
            <TabsTrigger value="patterns">Recent Patterns</TabsTrigger>
          </TabsList>

          <TabsContent value="alerts">
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {alerts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No active alerts</p>
                ) : (
                  alerts.map((alert) => (
                    <Alert
                      key={alert.id}
                      className={
                        alert.priority === "critical"
                          ? "border-red-500"
                          : alert.priority === "high"
                            ? "border-orange-500"
                            : ""
                      }
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle className="flex items-center justify-between">
                        {alert.symbol}
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={alert.priority === "critical" ? "destructive" : "secondary"}
                          >
                            {alert.priority}
                          </Badge>
                          <Button size="sm" variant="ghost" onClick={() => dismissAlert(alert.id)}>
                            ×
                          </Button>
                        </div>
                      </AlertTitle>
                      <AlertDescription>
                        {alert.message}
                        <span className="block text-xs mt-1">
                          Confidence: {Math.round(alert.confidence * 100)}%
                        </span>
                      </AlertDescription>
                    </Alert>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="ready">
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {readySymbols.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No symbols ready</p>
                ) : (
                  readySymbols.map((rs) => (
                    <div
                      key={rs.symbol}
                      className="flex items-center justify-between p-2 rounded border border-green-200"
                    >
                      <div>
                        <p className="font-medium">{rs.symbol}</p>
                        <p className="text-xs text-green-600">Ready for Trading</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="default">{Math.round(rs.confidence * 100)}%</Badge>
                        <p className="text-xs text-muted-foreground">
                          {rs.advanceNotice > 0
                            ? `${Math.round(rs.advanceNotice / 1000 / 60)}m advance`
                            : "Live"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="patterns">
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {patterns.slice(0, 10).map((pattern) => (
                  <div
                    key={pattern.patternId}
                    className="flex items-center justify-between p-2 rounded border"
                  >
                    <div>
                      <p className="font-medium">{pattern.symbol}</p>
                      <p className="text-xs text-muted-foreground">
                        {pattern.pattern.type} - {pattern.pattern.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline">
                        {Math.round(pattern.pattern.confidence * 100)}%
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {new Date(pattern.timing.detectedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ======================
// Workflow Status Component
// ======================

function WorkflowPanel() {
  const { workflows, lastUpdate } = useWorkflows();
  const activeWorkflows = Array.from(workflows.values()).filter(
    (w) => w.status === "running" || w.status === "started"
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Active Workflows
          <Badge variant="outline">{activeWorkflows.length} running</Badge>
        </CardTitle>
        <CardDescription>Real-time AI workflow execution status</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-48">
          <div className="space-y-3">
            {activeWorkflows.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No active workflows</p>
            ) : (
              activeWorkflows.map((workflow) => (
                <div key={workflow.workflowId} className="p-3 rounded border">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">{workflow.workflowType}</p>
                    <Badge variant={workflow.status === "running" ? "default" : "secondary"}>
                      {workflow.status}
                    </Badge>
                  </div>
                  <Progress value={workflow.progress} className="mb-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Current: {workflow.currentAgent || "N/A"}</span>
                    <span>{workflow.progress}% complete</span>
                  </div>
                  {workflow.agentsInvolved.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Agents: {workflow.agentsInvolved.join(", ")}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ======================
// Main Dashboard Component
// ======================

export default function RealTimeDashboard() {
  const { user } = useKindeBrowserClient();
  const { isConnected, state, metrics, error, reconnect } = useWebSocket({
    autoConnect: true,
    debug: false,
  });

  const { notifications, unreadCount, markAsRead, clearNotifications } = useNotifications(user?.id);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Real-time Dashboard</h1>
          <p className="text-muted-foreground">
            Live monitoring of AI agents, trading data, and pattern discovery
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAsRead}>
              {unreadCount} notifications
            </Button>
          )}
        </div>
      </div>

      {/* Connection Status */}
      <ConnectionStatus
        isConnected={isConnected}
        state={state}
        metrics={metrics}
        error={error}
        onReconnect={reconnect}
      />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Status */}
        <AgentStatusPanel />

        {/* Trading Data */}
        <TradingDataPanel />

        {/* Pattern Discovery */}
        <PatternDiscoveryPanel />

        {/* Workflows */}
        <WorkflowPanel />
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Recent Notifications
              <Button variant="outline" size="sm" onClick={clearNotifications}>
                Clear All
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-32">
              <div className="space-y-2">
                {notifications.slice(0, 5).map((notification) => (
                  <div key={notification.notificationId} className="p-2 rounded border">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{notification.title}</p>
                      <Badge
                        variant={
                          notification.type === "error"
                            ? "destructive"
                            : notification.type === "warning"
                              ? "secondary"
                              : "default"
                        }
                      >
                        {notification.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{notification.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(notification.timestamp).toLocaleTimeString()}
                    </p>
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
