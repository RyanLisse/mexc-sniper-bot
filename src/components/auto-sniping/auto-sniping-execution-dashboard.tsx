/**
 * Auto-Sniping Execution Dashboard Component (Optimized)
 *
 * Optimized dashboard for controlling and monitoring auto-sniping trade execution.
 * Features modular components, type safety, and Zod validation.
 */

"use client";

import { AlertCircle, Zap } from "lucide-react";
import { useCallback, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAutoSnipingExecution } from "@/src/hooks/use-auto-sniping-execution";
import type { AutoSnipingConfig } from "@/src/services/auto-sniping-execution-service";
import { AlertsList } from "./components/alerts-list";
import { ConfigEditor } from "./components/config-editor";
import { ExecutionControls } from "./components/execution-controls";
import { ExecutionStats } from "./components/execution-stats";
import { PerformanceMetrics } from "./components/performance-metrics";
import { PositionsTab } from "./components/positions-tab";
import { RecentExecutions } from "./components/recent-executions";
import type { DashboardProps } from "./schemas/validation-schemas";
import { dashboardPropsSchema } from "./schemas/validation-schemas";
import { formatCurrency } from "./utils/helpers";

interface AutoSnipingExecutionDashboardProps extends DashboardProps {
  // Extending validated props schema
}

export function AutoSnipingExecutionDashboard(props: AutoSnipingExecutionDashboardProps) {
  // Validate props with Zod schema
  const {
    className = "",
    autoRefresh = true,
    showControls = true,
  } = dashboardPropsSchema.parse(props);

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

  // Optimized handler functions with useCallback for performance
  const handleToggleExecution = useCallback(async () => {
    if (isExecutionActive) {
      if (executionStatus === "paused") {
        await resumeExecution();
      } else {
        await pauseExecution();
      }
    } else {
      await startExecution();
    }
  }, [isExecutionActive, executionStatus, resumeExecution, pauseExecution, startExecution]);

  const handleStopExecution = useCallback(async () => {
    await stopExecution();
  }, [stopExecution]);

  const handleEmergencyStop = useCallback(async () => {
    const confirmed = window.confirm(
      "This will immediately stop execution and close all active positions. Are you sure?"
    );
    if (confirmed) {
      await emergencyCloseAll();
      await stopExecution();
    }
  }, [emergencyCloseAll, stopExecution]);

  const handleClosePosition = useCallback(
    async (positionId: string) => {
      const confirmed = window.confirm("Are you sure you want to close this position?");
      if (confirmed) {
        await closePosition(positionId, "manual");
      }
    },
    [closePosition]
  );

  const handleAcknowledgeAlert = useCallback(
    async (alertId: string) => {
      await acknowledgeAlert(alertId);
    },
    [acknowledgeAlert]
  );

  const handleClearAlerts = useCallback(async () => {
    await clearAcknowledgedAlerts();
  }, [clearAcknowledgedAlerts]);

  const handleConfigChange = useCallback((field: string, value: string | number | boolean) => {
    setTempConfig((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSaveConfig = useCallback(async () => {
    const success = await updateConfig(tempConfig);
    if (success) {
      setConfigEditMode(false);
      setTempConfig({});
    }
  }, [updateConfig, tempConfig]);

  const handleCancelConfigEdit = useCallback(() => {
    setConfigEditMode(false);
    setTempConfig({});
  }, []);

  const handleEnterEditMode = useCallback(() => {
    setConfigEditMode(true);
  }, []);

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

          <RecentExecutions recentExecutions={recentExecutions} formatCurrency={formatCurrency} />
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
            onEnterEditMode={handleEnterEditMode}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AutoSnipingExecutionDashboard;
