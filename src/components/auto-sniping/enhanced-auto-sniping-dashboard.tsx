"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { 
  Activity, 
  AlertTriangle, 
  BarChart3, 
  Clock, 
  DollarSign, 
  Loader2, 
  Pause, 
  Play, 
  RefreshCw, 
  Square, 
  Target, 
  TrendingUp,
  Zap 
} from "lucide-react";
import { useAutoSnipingExecution } from "../../hooks/use-auto-sniping-execution";
import { usePatternSniper } from "../../hooks/use-pattern-sniper";

interface SnipeTarget {
  id: string;
  symbol: string;
  projectName: string;
  status: string;
  confidence: number;
  launchTime: string;
  priority: number;
}

export function EnhancedAutoSnipingDashboard() {
  const {
    data: executionData,
    isLoading: executionLoading,
    error: executionError,
    startExecution,
    stopExecution,
    pauseExecution,
    resumeExecution,
    emergencyStop,
    refreshData,
    clearError,
  } = useAutoSnipingExecution();

  const {
    isMonitoring: patternMonitoring,
    readyTargets,
    pendingDetection,
    calendarTargets,
    stats: patternStats,
    startMonitoring: startPatternMonitoring,
    stopMonitoring: stopPatternMonitoring,
    isConnected,
    isLoading: patternLoading,
    errors: patternErrors,
  } = usePatternSniper();

  const [snipeTargets, setSnipeTargets] = useState<SnipeTarget[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(false);

  // Fetch snipe targets from database
  const fetchSnipeTargets = useCallback(async () => {
    setTargetsLoading(true);
    try {
      const response = await fetch("/api/snipe-targets?userId=user123");
      const result = await response.json();
      
      if (result.success) {
        setSnipeTargets(result.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch snipe targets:", error);
    } finally {
      setTargetsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSnipeTargets();
  }, [fetchSnipeTargets]);

  // Handle auto-sniping control
  const handleToggleExecution = async () => {
    if (executionData?.isActive) {
      await stopExecution();
    } else {
      await startExecution();
    }
  };

  const handlePauseResume = async () => {
    if (executionData?.status === "paused") {
      await resumeExecution();
    } else {
      await pauseExecution();
    }
  };

  const handleEmergencyStop = async () => {
    await emergencyStop();
  };

  // Handle pattern monitoring control
  const handleTogglePatternMonitoring = () => {
    if (patternMonitoring) {
      stopPatternMonitoring();
    } else {
      startPatternMonitoring();
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Auto-Sniping Dashboard</h2>
          <p className="text-slate-400">
            Real-time monitoring and control of automated sniping operations
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-400" : "bg-red-400"}`} />
          <span className="text-sm text-slate-400">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Execution Status</p>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge variant={executionData?.isActive ? "default" : "secondary"}>
                    {executionData?.status || "Inactive"}
                  </Badge>
                  {!executionData?.isHealthy && (
                    <Badge variant="destructive">Unhealthy</Badge>
                  )}
                </div>
              </div>
              <Activity className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Active Positions</p>
                <p className="text-2xl font-bold text-green-400">
                  {executionData?.activePositions || 0}
                </p>
              </div>
              <Target className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Today's PnL</p>
                <p className={`text-2xl font-bold ${
                  (executionData?.totalPnl || 0) >= 0 ? "text-green-400" : "text-red-400"
                }`}>
                  {formatCurrency(executionData?.totalPnl || 0)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Success Rate</p>
                <p className="text-2xl font-bold text-purple-400">
                  {formatPercentage(executionData?.successRate || 0)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Display */}
      {(executionError || patternErrors.calendar || patternErrors.symbols) && (
        <Card className="bg-red-500/10 border-red-500/20">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              <span>System Errors</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {executionError && (
              <div className="text-red-300">
                <strong>Execution:</strong> {executionError}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearError}
                  className="ml-2 text-red-300 hover:text-red-100"
                >
                  Clear
                </Button>
              </div>
            )}
            {patternErrors.calendar && (
              <div className="text-red-300">
                <strong>Pattern Detection (Calendar):</strong> {patternErrors.calendar.message}
              </div>
            )}
            {patternErrors.symbols && (
              <div className="text-red-300">
                <strong>Pattern Detection (Symbols):</strong> {patternErrors.symbols.message}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Controls */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>System Controls</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Auto-Sniping Controls */}
            <div className="space-y-3">
              <h4 className="font-medium text-slate-300">Auto-Sniping Execution</h4>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleToggleExecution}
                  disabled={executionLoading}
                  variant={executionData?.isActive ? "destructive" : "default"}
                >
                  {executionLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : executionData?.isActive ? (
                    <Square className="h-4 w-4 mr-2" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  {executionData?.isActive ? "Stop" : "Start"}
                </Button>

                {executionData?.isActive && (
                  <Button
                    onClick={handlePauseResume}
                    disabled={executionLoading}
                    variant="outline"
                  >
                    {executionData?.status === "paused" ? (
                      <Play className="h-4 w-4 mr-2" />
                    ) : (
                      <Pause className="h-4 w-4 mr-2" />
                    )}
                    {executionData?.status === "paused" ? "Resume" : "Pause"}
                  </Button>
                )}

                <Button
                  onClick={handleEmergencyStop}
                  disabled={executionLoading}
                  variant="destructive"
                  size="sm"
                >
                  Emergency Stop
                </Button>
              </div>
            </div>

            {/* Pattern Monitoring Controls */}
            <div className="space-y-3">
              <h4 className="font-medium text-slate-300">Pattern Detection</h4>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleTogglePatternMonitoring}
                  disabled={patternLoading}
                  variant={patternMonitoring ? "destructive" : "default"}
                >
                  {patternLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : patternMonitoring ? (
                    <Square className="h-4 w-4 mr-2" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  {patternMonitoring ? "Stop Detection" : "Start Detection"}
                </Button>

                <Button
                  onClick={refreshData}
                  disabled={executionLoading}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Information Tabs */}
      <Tabs defaultValue="targets" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 bg-slate-800">
          <TabsTrigger value="targets">Ready Targets</TabsTrigger>
          <TabsTrigger value="pending">Monitoring</TabsTrigger>
          <TabsTrigger value="execution">Execution Log</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="targets" className="space-y-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Ready to Snipe ({readyTargets.length})</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchSnipeTargets}
                  disabled={targetsLoading}
                >
                  <RefreshCw className={`h-4 w-4 ${targetsLoading ? "animate-spin" : ""}`} />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {readyTargets.length > 0 ? (
                <div className="space-y-3">
                  {readyTargets.map((target, index) => (
                    <div
                      key={`${target.symbol}-${index}`}
                      className="bg-green-50/5 border border-green-500/20 p-4 rounded-lg"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h3 className="font-bold text-green-400 text-lg">{target.symbol}</h3>
                            <Badge variant="default" className="bg-green-500">READY</Badge>
                          </div>
                          <p className="text-slate-300 mt-1">{target.projectName}</p>
                          <div className="flex items-center space-x-4 mt-2 text-sm text-slate-400">
                            <span>Launch: {target.launchTime.toLocaleString()}</span>
                            <span>Advance: {target.hoursAdvanceNotice.toFixed(1)}h</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Target className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-400 mb-2">No Ready Targets</h3>
                  <p className="text-slate-500">
                    {patternMonitoring ? "Monitoring for new opportunities..." : "Start pattern detection to find targets"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle>Under Monitoring ({pendingDetection.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingDetection.length > 0 ? (
                <div className="space-y-2">
                  {pendingDetection.map((vcoinId) => {
                    const target = calendarTargets.find((t) => t.vcoinId === vcoinId);
                    return target ? (
                      <div
                        key={vcoinId}
                        className="flex justify-between items-center p-3 bg-yellow-50/5 border border-yellow-500/20 rounded"
                      >
                        <div>
                          <span className="font-medium text-yellow-400">{target.symbol}</span>
                          <span className="text-slate-400 ml-2">{target.projectName}</span>
                        </div>
                        <Badge variant="outline" className="border-yellow-500 text-yellow-400">
                          Scanning...
                        </Badge>
                      </div>
                    ) : null;
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-500">No targets currently under monitoring</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="execution" className="space-y-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle>Execution Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">Total Trades:</span>
                  <span className="ml-2 text-white font-medium">
                    {executionData?.totalTrades || 0}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Successful:</span>
                  <span className="ml-2 text-green-400 font-medium">
                    {executionData?.successfulTrades || 0}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Failed:</span>
                  <span className="ml-2 text-red-400 font-medium">
                    {executionData?.failedTrades || 0}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Today's Executions:</span>
                  <span className="ml-2 text-blue-400 font-medium">
                    {executionData?.executedToday || 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>Pattern Detection</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Listings:</span>
                    <span className="text-blue-400">{patternStats?.totalListings || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Monitoring:</span>
                    <span className="text-yellow-400">{patternStats?.pendingDetection || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ready to Snipe:</span>
                    <span className="text-green-400">{patternStats?.readyToSnipe || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Executed:</span>
                    <span className="text-purple-400">{patternStats?.executed || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Performance</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Success Rate:</span>
                    <span className="text-green-400">
                      {formatPercentage(patternStats?.successRate || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">System Health:</span>
                    <Badge variant={executionData?.isHealthy ? "default" : "destructive"}>
                      {executionData?.isHealthy ? "Good" : "Poor"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Connection:</span>
                    <Badge variant={isConnected ? "default" : "destructive"}>
                      {isConnected ? "Online" : "Offline"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}