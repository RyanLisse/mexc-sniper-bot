"use client";

import { Activity, AlertTriangle, CheckCircle, Pause, Play, Settings, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useStatus } from "../../contexts/status-context";
import { useAutoSnipingExecution } from "../../hooks/use-auto-sniping-execution";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Switch } from "../ui/switch";

/**
 * Simple Auto-Sniping Control Component
 * 
 * This replaces the complex technical dashboard with a user-friendly control panel.
 * Features:
 * - Clear on/off status with visual indicators
 * - Auto-enabled by default
 * - Simple connection status (green/red)
 * - Essential information only
 * - User-friendly error messages
 */

interface SimpleAutoSnipingControlProps {
  className?: string;
  showAdvancedSettings?: boolean;
}

export function SimpleAutoSnipingControl({ 
  className = "",
  showAdvancedSettings = false 
}: SimpleAutoSnipingControlProps) {
  const { status, getOverallStatus } = useStatus();
  const overallStatus = getOverallStatus();
  
  const {
    config,
    isExecutionActive,
    executionStatus,
    activePositionsCount,
    totalPnl,
    successRate,
    dailyTradeCount,
    isLoading,
    isStartingExecution,
    isStoppingExecution,
    error,
    startExecution,
    stopExecution,
    updateConfig,
    refreshData,
    clearError
  } = useAutoSnipingExecution({
    autoRefresh: true,
    refreshInterval: 30000,
    loadOnMount: true,
    includePositions: true,
    includeHistory: false,
    includeAlerts: false,
  });

  const [autoSnipingEnabled, setAutoSnipingEnabled] = useState(true);

  // Sync config with local state
  useEffect(() => {
    if (config?.enabled !== undefined) {
      setAutoSnipingEnabled(config.enabled);
    }
  }, [config?.enabled]);

  // Auto-start execution when component mounts if auto-sniping is enabled
  useEffect(() => {
    const autoStartExecution = async () => {
      if (autoSnipingEnabled && !isExecutionActive && !isLoading && overallStatus === "healthy") {
        try {
          await startExecution();
        } catch (error) {
          console.log("Auto-start execution skipped:", error);
        }
      }
    };

    // Delay auto-start to allow status to stabilize
    const timer = setTimeout(autoStartExecution, 2000);
    return () => clearTimeout(timer);
  }, [autoSnipingEnabled, isExecutionActive, isLoading, overallStatus, startExecution]);

  const handleToggleAutoSniping = useCallback(async (enabled: boolean) => {
    setAutoSnipingEnabled(enabled);
    
    // Update config first
    if (config) {
      await updateConfig({ enabled });
    }
    
    // Then control execution
    if (enabled && !isExecutionActive) {
      await startExecution();
    } else if (!enabled && isExecutionActive) {
      await stopExecution();
    }
  }, [config, isExecutionActive, updateConfig, startExecution, stopExecution]);

  const getConnectionStatus = () => {
    const { network, credentials, trading } = status;
    
    if (!network.connected) {
      return {
        status: "error",
        label: "Network Disconnected",
        description: "Check your internet connection",
        color: "text-red-600",
        bgColor: "bg-red-50 border-red-200",
        icon: AlertTriangle
      };
    }
    
    if (!credentials.hasCredentials || !credentials.isValid) {
      return {
        status: "warning",
        label: "API Setup Required",
        description: "Configure your MEXC API credentials",
        color: "text-yellow-600",
        bgColor: "bg-yellow-50 border-yellow-200",
        icon: Settings
      };
    }
    
    if (!trading.canTrade) {
      return {
        status: "warning",
        label: "Trading Unavailable",
        description: "Check your MEXC account permissions",
        color: "text-yellow-600",
        bgColor: "bg-yellow-50 border-yellow-200",
        icon: AlertTriangle
      };
    }
    
    return {
      status: "ready",
      label: "Ready to Trade",
      description: "All systems operational",
      color: "text-green-600",
      bgColor: "bg-green-50 border-green-200",
      icon: CheckCircle
    };
  };

  const connectionStatus = getConnectionStatus();
  const isReadyToTrade = connectionStatus.status === "ready";
  const pnlValue = Number.parseFloat(totalPnl);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Control Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Auto-Sniping
              </CardTitle>
              <CardDescription>
                Automatically trade new MEXC listings when patterns are detected
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium">
                  {autoSnipingEnabled ? (isExecutionActive ? "Active" : "Starting...") : "Stopped"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {isExecutionActive && `${activePositionsCount} positions`}
                </div>
              </div>
              <Switch
                checked={autoSnipingEnabled}
                onCheckedChange={handleToggleAutoSniping}
                disabled={isLoading || isStartingExecution || isStoppingExecution}
                className="data-[state=checked]:bg-green-600"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connection Status */}
          <div className={`p-3 rounded-lg border ${connectionStatus.bgColor}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <connectionStatus.icon className={`h-5 w-5 ${connectionStatus.color}`} />
                <div>
                  <div className={`font-medium ${connectionStatus.color}`}>
                    {connectionStatus.label}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {connectionStatus.description}
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={refreshData}>
                <Activity className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Trading Status - Only show if ready */}
          {isReadyToTrade && autoSnipingEnabled && (
            <div className="grid grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="text-center">
                <div className={`text-lg font-bold ${pnlValue >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {pnlValue >= 0 ? "+" : ""}{pnlValue.toFixed(2)} USDT
                </div>
                <div className="text-xs text-muted-foreground">Total P&L</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">{activePositionsCount}</div>
                <div className="text-xs text-muted-foreground">Active Trades</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-purple-600">{successRate.toFixed(0)}%</div>
                <div className="text-xs text-muted-foreground">Success Rate</div>
              </div>
            </div>
          )}

          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Badge 
                variant={autoSnipingEnabled && isExecutionActive ? "default" : "secondary"}
                className="flex items-center gap-1"
              >
                {autoSnipingEnabled && isExecutionActive ? (
                  <>
                    <Play className="h-3 w-3" />
                    Running
                  </>
                ) : autoSnipingEnabled && isStartingExecution ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                    Starting
                  </>
                ) : (
                  <>
                    <Pause className="h-3 w-3" />
                    Stopped
                  </>
                )}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              Today: {dailyTradeCount} trades
            </div>
          </div>

          {/* Quick Help */}
          {!isReadyToTrade && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm font-medium text-blue-800">
                {connectionStatus.status === "warning" ? "Setup Required" : "Connection Issue"}
              </div>
              <div className="text-sm text-blue-600 mt-1">
                {connectionStatus.status === "warning" 
                  ? "Go to Settings → API Configuration to set up your MEXC credentials"
                  : "Check your internet connection and try refreshing"}
              </div>
            </div>
          )}

          {/* Advanced Settings Link */}
          {showAdvancedSettings && (
            <div className="pt-2 border-t">
              <Button variant="ghost" size="sm" className="w-full justify-start">
                <Settings className="h-4 w-4 mr-2" />
                Advanced Settings
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default SimpleAutoSnipingControl;