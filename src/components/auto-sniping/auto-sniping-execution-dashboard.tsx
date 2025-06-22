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
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Separator } from "@/src/components/ui/separator";
import { Switch } from "@/src/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { useAutoSnipingExecution } from "@/src/hooks/use-auto-sniping-execution";
import type {
  AutoSnipingConfig,
  ExecutionAlert,
} from "@/src/services/auto-sniping-execution-service";
import {
  AlertCircle,
  Bell,
  BellOff,
  Clock,
  DollarSign,
  Hash,
  Pause,
  Percent,
  Play,
  RefreshCw,
  Settings,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { PerformanceMetrics } from "./components/performance-metrics";
import { PnLIndicator } from "./components/pnl-indicator";
import { PositionsTab } from "./components/positions-tab";
import { StatusIndicator } from "./components/status-indicator";

// Helper functions for reducing complexity
const getAlertBadgeVariant = (severity: string) => {
  if (severity === "critical" || severity === "error") return "destructive";
  if (severity === "warning") return "secondary";
  return "outline";
};

const formatAlertType = (type: string) => {
  return type.replace("_", " ").toUpperCase();
};


interface AutoSnipingExecutionDashboardProps {
  className?: string;
  autoRefresh?: boolean;
  showControls?: boolean;
}

// ExecutionStats component for status overview and metrics
interface ExecutionStatsData {
  totalTrades?: number;
  successfulTrades?: number;
  failedTrades?: number;
  dailyTradeCount?: number;
}

function ExecutionStats({
  executionStatus,
  activePositionsCount,
  totalPnl,
  successRate,
  stats,
  formatCurrency,
}: {
  executionStatus: string;
  activePositionsCount: number;
  totalPnl: string;
  successRate: number;
  stats: ExecutionStatsData | null;
  formatCurrency: (value: string | number) => string;
}) {
  const pnlValue = Number.parseFloat(totalPnl);
  
  return (
    <div className="space-y-4">
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
          <div className={`flex items-center gap-2 ${pnlValue >= 0 ? "text-green-600" : "text-red-600"}`}>
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
          <div className="text-xl font-bold text-green-600">{stats?.successfulTrades || 0}</div>
          <p className="text-sm text-gray-600">Successful</p>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-red-600">{stats?.failedTrades || 0}</div>
          <p className="text-sm text-gray-600">Failed</p>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-orange-600">{stats?.dailyTradeCount || 0}</div>
          <p className="text-sm text-gray-600">Today</p>
        </div>
      </div>
    </div>
  );
}

// ExecutionControls component for controlling execution
function ExecutionControls({
  isExecutionActive,
  executionStatus,
  isLoading,
  isStartingExecution,
  isPausingExecution,
  isResumingExecution,
  isStoppingExecution,
  onRefresh,
  onToggleExecution,
  onStopExecution,
  onEmergencyStop,
  showControls,
}: {
  isExecutionActive: boolean;
  executionStatus: string;
  isLoading: boolean;
  isStartingExecution: boolean;
  isPausingExecution: boolean;
  isResumingExecution: boolean;
  isStoppingExecution: boolean;
  onRefresh: () => void;
  onToggleExecution: () => void;
  onStopExecution: () => void;
  onEmergencyStop: () => void;
  showControls: boolean;
}) {
  if (!showControls) return null;

  const isAnyOperationLoading = isLoading || isStartingExecution || isPausingExecution || 
                                isResumingExecution || isStoppingExecution;

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={isAnyOperationLoading}>
        <RefreshCw className="h-4 w-4" />
      </Button>
      
      {!isExecutionActive ? (
        <Button onClick={onToggleExecution} disabled={isAnyOperationLoading}>
          <Play className="h-4 w-4 mr-2" />
          Start Execution
        </Button>
      ) : (
        <>
          <Button variant="outline" onClick={onToggleExecution} disabled={isAnyOperationLoading}>
            {executionStatus === "paused" ? (
              <>
                <Play className="h-4 w-4 mr-2" />
                Resume
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </>
            )}
          </Button>
          <Button variant="outline" onClick={onStopExecution} disabled={isAnyOperationLoading}>
            Stop
          </Button>
          <Button variant="destructive" onClick={onEmergencyStop} disabled={isAnyOperationLoading}>
            Emergency Stop
          </Button>
        </>
      )}
    </div>
  );
}

// AlertsList component for displaying execution alerts
function AlertsList({
  activeAlerts,
  onAcknowledgeAlert,
  onClearAlerts,
}: {
  activeAlerts: ExecutionAlert[];
  onAcknowledgeAlert: (alertId: string) => void;
  onClearAlerts: () => void;
}) {
  const hasAcknowledgedAlerts = activeAlerts.some((alert) => alert.acknowledged);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Execution Alerts ({activeAlerts.length})
          </CardTitle>
          <CardDescription>Trade execution notifications and system alerts</CardDescription>
        </div>
        {hasAcknowledgedAlerts && (
          <Button variant="outline" size="sm" onClick={onClearAlerts}>
            Clear Acknowledged
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {activeAlerts.length > 0 ? (
          <ScrollArea className="h-96">
            <div className="space-y-3">
              {activeAlerts.map((alert: ExecutionAlert, index: number) => (
                <div
                  key={alert.id || `alert-${index}`}
                  className={`border rounded-lg p-3 ${alert.acknowledged ? "bg-gray-50 opacity-60" : "bg-white"}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={getAlertBadgeVariant(alert.severity)}>
                        {alert.severity.toUpperCase()}
                      </Badge>
                      <span className="font-medium">{formatAlertType(alert.type)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                      {!alert.acknowledged && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onAcknowledgeAlert(alert.id)}
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
  );
}

// ConfigEditor component for managing execution configuration
function ConfigEditor({
  config,
  configEditMode,
  tempConfig,
  isUpdatingConfig,
  onConfigChange,
  onSaveConfig,
  onCancelEdit,
  onEnterEditMode,
}: {
  config: AutoSnipingConfig | null;
  configEditMode: boolean;
  tempConfig: Partial<AutoSnipingConfig>;
  isUpdatingConfig: boolean;
  onConfigChange: (field: string, value: string | number | boolean) => void;
  onSaveConfig: () => void;
  onCancelEdit: () => void;
  onEnterEditMode: () => void;
}) {
  if (!config) return null;

  const getConfigValue = (field: keyof AutoSnipingConfig) => {
    return configEditMode ? (tempConfig[field] ?? config[field]) : config[field];
  };

  return (
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
                onClick={onCancelEdit}
                disabled={isUpdatingConfig}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={onSaveConfig} disabled={isUpdatingConfig}>
                Save Changes
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={onEnterEditMode}>
              Edit Configuration
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
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
                    checked={getConfigValue("enabled") as boolean}
                    onCheckedChange={(checked) => onConfigChange("enabled", checked)}
                    disabled={!configEditMode}
                  />
                  <span className="text-sm text-gray-600">
                    {getConfigValue("enabled") ? "Enabled" : "Disabled"}
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
                  value={getConfigValue("maxPositions") as number}
                  onChange={(e) => onConfigChange("maxPositions", Number.parseInt(e.target.value))}
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
                  value={getConfigValue("maxDailyTrades") as number}
                  onChange={(e) => onConfigChange("maxDailyTrades", Number.parseInt(e.target.value))}
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
                  value={getConfigValue("positionSizeUSDT") as number}
                  onChange={(e) => onConfigChange("positionSizeUSDT", Number.parseFloat(e.target.value))}
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
                  value={getConfigValue("minConfidence") as number}
                  onChange={(e) => onConfigChange("minConfidence", Number.parseFloat(e.target.value))}
                  disabled={!configEditMode}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="enableAdvanceDetection">Enable Advance Detection</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enableAdvanceDetection"
                    checked={getConfigValue("enableAdvanceDetection") as boolean}
                    onCheckedChange={(checked) => onConfigChange("enableAdvanceDetection", checked)}
                    disabled={!configEditMode}
                  />
                  <span className="text-sm text-gray-600">
                    {getConfigValue("enableAdvanceDetection") ? "Enabled" : "Disabled"}
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
                  value={getConfigValue("stopLossPercentage") as number}
                  onChange={(e) => onConfigChange("stopLossPercentage", Number.parseFloat(e.target.value))}
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
                  value={getConfigValue("takeProfitPercentage") as number}
                  onChange={(e) => onConfigChange("takeProfitPercentage", Number.parseFloat(e.target.value))}
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
                  value={getConfigValue("maxDrawdownPercentage") as number}
                  onChange={(e) => onConfigChange("maxDrawdownPercentage", Number.parseFloat(e.target.value))}
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
                  value={getConfigValue("slippageTolerancePercentage") as number}
                  onChange={(e) => onConfigChange("slippageTolerancePercentage", Number.parseFloat(e.target.value))}
                  disabled={!configEditMode}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
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
    refreshInterval: 15000,
    loadOnMount: true,
    includePositions: true,
    includeHistory: true,
    includeAlerts: true,
  });

  // Simple handler functions
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

  const handleConfigChange = (field: string, value: string | number | boolean) => {
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
            <ExecutionControls
              isExecutionActive={isExecutionActive}
              executionStatus={executionStatus}
              isLoading={isLoading}
              isStartingExecution={isStartingExecution}
              isPausingExecution={isPausingExecution}
              isResumingExecution={isResumingExecution}
              isStoppingExecution={isStoppingExecution}
              onRefresh={refreshData}
              onToggleExecution={handleToggleExecution}
              onStopExecution={handleStopExecution}
              onEmergencyStop={handleEmergencyStop}
              showControls={showControls}
            />
          </div>
        </CardHeader>
        <CardContent>
          {report && (
            <div className="space-y-6">
              <ExecutionStats
                executionStatus={executionStatus}
                activePositionsCount={activePositionsCount}
                totalPnl={totalPnl}
                successRate={successRate}
                stats={stats}
                formatCurrency={formatCurrency}
              />

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
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
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
          <PerformanceMetrics
            successRate={successRate}
            dailyTradeCount={dailyTradeCount}
            maxDailyTrades={config?.maxDailyTrades}
            stats={stats}
          />

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
                      <div
                        key={`execution-${execution.symbol}-${execution.timestamp || index}`}
                        className="border rounded-lg p-3"
                      >
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
          <PositionsTab
            activePositions={activePositions}
            isClosingPosition={isClosingPosition}
            onClosePosition={handleClosePosition}
            onEmergencyStop={handleEmergencyStop}
            formatCurrency={formatCurrency}
          />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <AlertsList
            activeAlerts={activeAlerts}
            onAcknowledgeAlert={handleAcknowledgeAlert}
            onClearAlerts={handleClearAlerts}
          />
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <ConfigEditor
            config={config}
            configEditMode={configEditMode}
            tempConfig={tempConfig}
            isUpdatingConfig={isUpdatingConfig}
            onConfigChange={handleConfigChange}
            onSaveConfig={handleSaveConfig}
            onCancelEdit={handleCancelConfigEdit}
            onEnterEditMode={() => setConfigEditMode(true)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AutoSnipingExecutionDashboard;
