/**
 * Auto-Sniping Execution Dashboard Component
 *
 * Comprehensive dashboard for controlling and monitoring auto-sniping trade execution.
 * Provides real-time position management, configuration controls, and execution statistics.
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
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Progress } from "@/src/components/ui/progress";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Separator } from "@/src/components/ui/separator";
import { Switch } from "@/src/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { useAutoSnipingExecution } from "@/src/hooks/use-auto-sniping-execution";
import type {
  AutoSnipingConfig,
  ExecutionAlert,
  ExecutionPosition,
} from "@/src/services/auto-sniping-execution-service";
import {
  AlertCircle,
  BarChart3,
  Bell,
  BellOff,
  Clock,
  DollarSign,
  Hash,
  Pause,
  PauseCircle,
  Percent,
  Play,
  PlayCircle,
  RefreshCw,
  Settings,
  Shield,
  Square,
  StopCircle,
  Target,
  TrendingDown,
  TrendingUp,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useState } from "react";

interface AutoSnipingExecutionDashboardProps {
  className?: string;
  autoRefresh?: boolean;
  showControls?: boolean;
}

export function AutoSnipingExecutionDashboard({
  className = "",
  autoRefresh = true,
  showControls = true,
}: AutoSnipingExecutionDashboardProps) {
  const [selectedTab, setSelectedTab] = useState("overview");
  const [configEditMode, setConfigEditMode] = useState(false);
  const [tempConfig, setTempConfig] = useState<Partial<AutoSnipingConfig>>({});

  const {
    report,
    config,
    stats,
    activePositions,
    recentExecutions,
    activeAlerts,
    isExecutionActive,
    executionStatus,
    totalPnl,
    successRate,
    activePositionsCount,
    unacknowledgedAlertsCount,
    dailyTradeCount,
    isLoading,
    isStartingExecution,
    isStoppingExecution,
    isPausingExecution,
    isResumingExecution,
    isClosingPosition,
    isUpdatingConfig,
    error,
    lastUpdated,
    startExecution,
    stopExecution,
    pauseExecution,
    resumeExecution,
    closePosition,
    emergencyCloseAll,
    updateConfig,
    acknowledgeAlert,
    clearAcknowledgedAlerts,
    refreshData,
    clearError,
  } = useAutoSnipingExecution({
    autoRefresh,
    refreshInterval: 15000, // 15 seconds for execution monitoring
    loadOnMount: true,
    includePositions: true,
    includeHistory: true,
    includeAlerts: true,
  });

  // Status indicator component
  const StatusIndicator = ({ status }: { status: string }) => {
    const getStatusProps = (status: string) => {
      switch (status) {
        case "active":
          return { icon: PlayCircle, color: "text-green-500", bg: "bg-green-50" };
        case "paused":
          return { icon: PauseCircle, color: "text-yellow-500", bg: "bg-yellow-50" };
        case "idle":
          return { icon: StopCircle, color: "text-gray-500", bg: "bg-gray-50" };
        case "error":
          return { icon: XCircle, color: "text-red-500", bg: "bg-red-50" };
        default:
          return { icon: Clock, color: "text-gray-400", bg: "bg-gray-50" };
      }
    };

    const { icon: Icon, color, bg } = getStatusProps(status);

    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${bg}`}>
        <Icon className={`h-5 w-5 ${color}`} />
        <span className={`text-sm font-medium ${color}`}>{status.toUpperCase()}</span>
      </div>
    );
  };

  // Position PnL component
  const PnLIndicator = ({ position }: { position: ExecutionPosition }) => {
    const pnl = Number.parseFloat(position.unrealizedPnl);
    const isProfit = pnl >= 0;

    return (
      <div className={`flex items-center gap-1 ${isProfit ? "text-green-600" : "text-red-600"}`}>
        {isProfit ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        <span className="font-medium">
          {isProfit ? "+" : ""}
          {pnl.toFixed(2)} USDT
        </span>
        <span className="text-sm">
          ({position.unrealizedPnlPercentage > 0 ? "+" : ""}
          {position.unrealizedPnlPercentage.toFixed(2)}%)
        </span>
      </div>
    );
  };

  // Execution controls
  const handleToggleExecution = async () => {
    if (isExecutionActive) {
      if (executionStatus === "paused") {
        await resumeExecution();
      } else {
        await pauseExecution();
      }
    } else {
      await startExecution();
    }
  };

  const handleStopExecution = async () => {
    await stopExecution();
  };

  const handleEmergencyStop = async () => {
    const confirmed = window.confirm(
      "This will immediately stop execution and close all active positions. Are you sure?"
    );
    if (confirmed) {
      await emergencyCloseAll();
      await stopExecution();
    }
  };

  const handleClosePosition = async (positionId: string) => {
    const confirmed = window.confirm("Are you sure you want to close this position?");
    if (confirmed) {
      await closePosition(positionId, "manual");
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    await acknowledgeAlert(alertId);
  };

  const handleClearAlerts = async () => {
    await clearAcknowledgedAlerts();
  };

  // Configuration management
  const handleConfigChange = (field: string, value: any) => {
    setTempConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveConfig = async () => {
    const success = await updateConfig(tempConfig);
    if (success) {
      setConfigEditMode(false);
      setTempConfig({});
    }
  };

  const handleCancelConfigEdit = () => {
    setConfigEditMode(false);
    setTempConfig({});
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? Number.parseFloat(value) : value;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Execution Error</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Control Panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Auto-Sniping Execution Control
              </CardTitle>
              <CardDescription>
                Automated trade execution based on pattern detection
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {showControls && (
                <>
                  <Button variant="outline" size="sm" onClick={refreshData} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                  <Button
                    variant={
                      isExecutionActive
                        ? executionStatus === "paused"
                          ? "default"
                          : "secondary"
                        : "default"
                    }
                    size="sm"
                    onClick={handleToggleExecution}
                    disabled={isStartingExecution || isPausingExecution || isResumingExecution}
                  >
                    {isExecutionActive ? (
                      executionStatus === "paused" ? (
                        <>
                          <Play className="h-4 w-4" />
                          Resume
                        </>
                      ) : (
                        <>
                          <Pause className="h-4 w-4" />
                          Pause
                        </>
                      )
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Start
                      </>
                    )}
                  </Button>
                  {isExecutionActive && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleStopExecution}
                      disabled={isStoppingExecution}
                    >
                      <Square className="h-4 w-4" />
                      Stop
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleEmergencyStop}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Shield className="h-4 w-4" />
                    Emergency Stop
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {report && (
            <div className="space-y-6">
              {/* Status Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                  <StatusIndicator status={executionStatus} />
                  <p className="text-sm text-gray-600 mt-2">Execution Status</p>
                </div>
                <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Hash className="h-5 w-5 text-blue-500" />
                    <span className="text-2xl font-bold">{activePositionsCount}</span>
                  </div>
                  <p className="text-sm text-gray-600">Active Positions</p>
                </div>
                <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                  <div
                    className={`flex items-center gap-2 ${Number.parseFloat(totalPnl) >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    <DollarSign className="h-5 w-5" />
                    <span className="text-2xl font-bold">{formatCurrency(totalPnl)}</span>
                  </div>
                  <p className="text-sm text-gray-600">Total P&L</p>
                </div>
                <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Percent className="h-5 w-5 text-purple-500" />
                    <span className="text-2xl font-bold">{successRate.toFixed(1)}%</span>
                  </div>
                  <p className="text-sm text-gray-600">Success Rate</p>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-600">{stats?.totalTrades || 0}</div>
                  <p className="text-sm text-gray-600">Total Trades</p>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600">
                    {stats?.successfulTrades || 0}
                  </div>
                  <p className="text-sm text-gray-600">Successful</p>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-red-600">{stats?.failedTrades || 0}</div>
                  <p className="text-sm text-gray-600">Failed</p>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-orange-600">{dailyTradeCount}</div>
                  <p className="text-sm text-gray-600">Today</p>
                </div>
              </div>

              {lastUpdated && (
                <p className="text-sm text-gray-500">
                  Last updated: {new Date(lastUpdated).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Loading State */}
          {isLoading && !report && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading execution data...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Performance Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Success Rate</span>
                    <span className="text-sm font-medium">{successRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={successRate} className="w-full" />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Daily Trade Progress</span>
                    <span className="text-sm font-medium">
                      {dailyTradeCount}/{config?.maxDailyTrades || 0}
                    </span>
                  </div>
                  <Progress
                    value={
                      config?.maxDailyTrades ? (dailyTradeCount / config.maxDailyTrades) * 100 : 0
                    }
                    className="w-full"
                  />
                </div>
              </div>

              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-lg font-semibold">
                      {stats.averageExecutionTime.toFixed(0)}ms
                    </div>
                    <p className="text-xs text-gray-600">Avg Execution</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-lg font-semibold">{stats.averageSlippage.toFixed(2)}%</div>
                    <p className="text-xs text-gray-600">Avg Slippage</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-lg font-semibold">{stats.maxDrawdown.toFixed(1)}%</div>
                    <p className="text-xs text-gray-600">Max Drawdown</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-lg font-semibold">
                      {stats.averageTradeReturn.toFixed(1)}%
                    </div>
                    <p className="text-xs text-gray-600">Avg Return</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Executions */}
          {recentExecutions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Executions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {recentExecutions.map((execution, index) => (
                      <div key={index} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">
                              {execution.symbol}
                            </Badge>
                            <Badge
                              variant={execution.status === "CLOSED" ? "default" : "secondary"}
                            >
                              {execution.status}
                            </Badge>
                          </div>
                          <PnLIndicator position={execution} />
                        </div>
                        <div className="text-sm text-gray-600">
                          Entry: {formatCurrency(execution.entryPrice)} • Quantity:{" "}
                          {execution.quantity} • Pattern: {execution.patternMatch.patternType}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="positions" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Active Positions ({activePositions.length})
                </CardTitle>
                <CardDescription>Monitor and manage your active trading positions</CardDescription>
              </div>
              {activePositions.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleEmergencyStop}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Close All
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {activePositions.length > 0 ? (
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {activePositions.map((position) => (
                      <div key={position.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-lg">
                              {position.symbol}
                            </Badge>
                            <Badge variant="default">{position.side}</Badge>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleClosePosition(position.id)}
                            disabled={isClosingPosition}
                          >
                            <X className="h-4 w-4" />
                            Close
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                          <div>
                            <p className="text-sm text-gray-600">Entry Price</p>
                            <p className="font-medium">{formatCurrency(position.entryPrice)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Current Price</p>
                            <p className="font-medium">{formatCurrency(position.currentPrice)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Quantity</p>
                            <p className="font-medium">{position.quantity}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">P&L</p>
                            <PnLIndicator position={position} />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span>
                            Pattern: {position.patternMatch.patternType}(
                            {position.patternMatch.confidence}% confidence)
                          </span>
                          <span>Opened: {new Date(position.entryTime).toLocaleString()}</span>
                        </div>

                        {(position.stopLossPrice || position.takeProfitPrice) && (
                          <div className="mt-2 pt-2 border-t text-sm">
                            {position.stopLossPrice && (
                              <span className="text-red-600">
                                SL: {formatCurrency(position.stopLossPrice)}
                              </span>
                            )}
                            {position.stopLossPrice && position.takeProfitPrice && " • "}
                            {position.takeProfitPrice && (
                              <span className="text-green-600">
                                TP: {formatCurrency(position.takeProfitPrice)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-gray-500">No active positions</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Execution Alerts ({activeAlerts.length})
                </CardTitle>
                <CardDescription>Trade execution notifications and system alerts</CardDescription>
              </div>
              {activeAlerts.some((alert) => alert.acknowledged) && (
                <Button variant="outline" size="sm" onClick={handleClearAlerts}>
                  Clear Acknowledged
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {activeAlerts.length > 0 ? (
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {activeAlerts.map((alert: ExecutionAlert) => (
                      <div
                        key={alert.id}
                        className={`border rounded-lg p-3 ${alert.acknowledged ? "bg-gray-50 opacity-60" : "bg-white"}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                alert.severity === "critical"
                                  ? "destructive"
                                  : alert.severity === "error"
                                    ? "destructive"
                                    : alert.severity === "warning"
                                      ? "secondary"
                                      : "outline"
                              }
                            >
                              {alert.severity.toUpperCase()}
                            </Badge>
                            <span className="font-medium">
                              {alert.type.replace("_", " ").toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">
                              {new Date(alert.timestamp).toLocaleTimeString()}
                            </span>
                            {!alert.acknowledged && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAcknowledgeAlert(alert.id)}
                              >
                                <BellOff className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 mt-2">{alert.message}</p>
                        {alert.symbol && (
                          <div className="mt-2">
                            <Badge variant="outline" className="text-xs">
                              {alert.symbol}
                            </Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-gray-500">No active alerts</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Execution Configuration
                </CardTitle>
                <CardDescription>
                  Configure auto-sniping execution parameters and risk management
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {configEditMode ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelConfigEdit}
                      disabled={isUpdatingConfig}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveConfig} disabled={isUpdatingConfig}>
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setConfigEditMode(true)}>
                    Edit Configuration
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {config && (
                <div className="space-y-6">
                  {/* Basic Settings */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Basic Settings</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="enabled">Enable Auto-Sniping</Label>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="enabled"
                            checked={
                              configEditMode
                                ? (tempConfig.enabled ?? config.enabled)
                                : config.enabled
                            }
                            onCheckedChange={(checked) => handleConfigChange("enabled", checked)}
                            disabled={!configEditMode}
                          />
                          <span className="text-sm text-gray-600">
                            {(
                              configEditMode
                                ? (tempConfig.enabled ?? config.enabled)
                                : config.enabled
                            )
                              ? "Enabled"
                              : "Disabled"}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="maxPositions">Maximum Positions</Label>
                        <Input
                          id="maxPositions"
                          type="number"
                          min="1"
                          max="50"
                          value={
                            configEditMode
                              ? (tempConfig.maxPositions ?? config.maxPositions)
                              : config.maxPositions
                          }
                          onChange={(e) =>
                            handleConfigChange("maxPositions", Number.parseInt(e.target.value))
                          }
                          disabled={!configEditMode}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="maxDailyTrades">Maximum Daily Trades</Label>
                        <Input
                          id="maxDailyTrades"
                          type="number"
                          min="1"
                          max="100"
                          value={
                            configEditMode
                              ? (tempConfig.maxDailyTrades ?? config.maxDailyTrades)
                              : config.maxDailyTrades
                          }
                          onChange={(e) =>
                            handleConfigChange("maxDailyTrades", Number.parseInt(e.target.value))
                          }
                          disabled={!configEditMode}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="positionSizeUSDT">Position Size (USDT)</Label>
                        <Input
                          id="positionSizeUSDT"
                          type="number"
                          min="10"
                          step="10"
                          value={
                            configEditMode
                              ? (tempConfig.positionSizeUSDT ?? config.positionSizeUSDT)
                              : config.positionSizeUSDT
                          }
                          onChange={(e) =>
                            handleConfigChange(
                              "positionSizeUSDT",
                              Number.parseFloat(e.target.value)
                            )
                          }
                          disabled={!configEditMode}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Pattern Settings */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Pattern Settings</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="minConfidence">Minimum Confidence (%)</Label>
                        <Input
                          id="minConfidence"
                          type="number"
                          min="0"
                          max="100"
                          value={
                            configEditMode
                              ? (tempConfig.minConfidence ?? config.minConfidence)
                              : config.minConfidence
                          }
                          onChange={(e) =>
                            handleConfigChange("minConfidence", Number.parseFloat(e.target.value))
                          }
                          disabled={!configEditMode}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="enableAdvanceDetection">Enable Advance Detection</Label>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="enableAdvanceDetection"
                            checked={
                              configEditMode
                                ? (tempConfig.enableAdvanceDetection ??
                                  config.enableAdvanceDetection)
                                : config.enableAdvanceDetection
                            }
                            onCheckedChange={(checked) =>
                              handleConfigChange("enableAdvanceDetection", checked)
                            }
                            disabled={!configEditMode}
                          />
                          <span className="text-sm text-gray-600">
                            {(
                              configEditMode
                                ? (tempConfig.enableAdvanceDetection ??
                                  config.enableAdvanceDetection)
                                : config.enableAdvanceDetection
                            )
                              ? "Enabled"
                              : "Disabled"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Risk Management */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Risk Management</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="stopLossPercentage">Stop Loss (%)</Label>
                        <Input
                          id="stopLossPercentage"
                          type="number"
                          min="0"
                          max="50"
                          step="0.5"
                          value={
                            configEditMode
                              ? (tempConfig.stopLossPercentage ?? config.stopLossPercentage)
                              : config.stopLossPercentage
                          }
                          onChange={(e) =>
                            handleConfigChange(
                              "stopLossPercentage",
                              Number.parseFloat(e.target.value)
                            )
                          }
                          disabled={!configEditMode}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="takeProfitPercentage">Take Profit (%)</Label>
                        <Input
                          id="takeProfitPercentage"
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={
                            configEditMode
                              ? (tempConfig.takeProfitPercentage ?? config.takeProfitPercentage)
                              : config.takeProfitPercentage
                          }
                          onChange={(e) =>
                            handleConfigChange(
                              "takeProfitPercentage",
                              Number.parseFloat(e.target.value)
                            )
                          }
                          disabled={!configEditMode}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="maxDrawdownPercentage">Maximum Drawdown (%)</Label>
                        <Input
                          id="maxDrawdownPercentage"
                          type="number"
                          min="5"
                          max="50"
                          step="1"
                          value={
                            configEditMode
                              ? (tempConfig.maxDrawdownPercentage ?? config.maxDrawdownPercentage)
                              : config.maxDrawdownPercentage
                          }
                          onChange={(e) =>
                            handleConfigChange(
                              "maxDrawdownPercentage",
                              Number.parseFloat(e.target.value)
                            )
                          }
                          disabled={!configEditMode}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="slippageTolerancePercentage">Slippage Tolerance (%)</Label>
                        <Input
                          id="slippageTolerancePercentage"
                          type="number"
                          min="0.1"
                          max="5"
                          step="0.1"
                          value={
                            configEditMode
                              ? (tempConfig.slippageTolerancePercentage ??
                                config.slippageTolerancePercentage)
                              : config.slippageTolerancePercentage
                          }
                          onChange={(e) =>
                            handleConfigChange(
                              "slippageTolerancePercentage",
                              Number.parseFloat(e.target.value)
                            )
                          }
                          disabled={!configEditMode}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AutoSnipingExecutionDashboard;
