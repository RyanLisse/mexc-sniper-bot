"use client";

import {
  Activity,
  AlertCircle,
  CheckCircle,
  PauseCircle,
  PlayCircle,
  Power,
  RefreshCw,
  Shield,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useSafetyMonitoring } from "../hooks/use-safety-monitoring";
import { cn } from "../lib/utils";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

// Helper function to get health status icons
function getHealthIcon(status: string) {
  const iconMap = {
    healthy: <CheckCircle className="h-4 w-4 text-green-500" />,
    online: <CheckCircle className="h-4 w-4 text-green-500" />,
    warning: <AlertCircle className="h-4 w-4 text-yellow-500" />,
    degraded: <AlertCircle className="h-4 w-4 text-yellow-500" />,
    critical: <XCircle className="h-4 w-4 text-red-500" />,
    offline: <XCircle className="h-4 w-4 text-red-500" />,
  };
  return iconMap[status as keyof typeof iconMap] || <Zap className="h-4 w-4 text-gray-500" />;
}

// Helper function to get risk color classes
function getRiskColor(risk: string) {
  const colorMap = {
    low: "text-green-500",
    medium: "text-yellow-500",
    high: "text-orange-500",
    critical: "text-red-500",
  };
  return colorMap[risk as keyof typeof colorMap] || "text-gray-500";
}

// Helper function to format currency
function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

// Helper function to format percentage
function formatPercentage(value: number) {
  return `${value.toFixed(2)}%`;
}

export const SafetyMonitoringDashboard = memo(function SafetyMonitoringDashboard() {
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

  const {
    systemHealth,
    riskMetrics,
    simulationStatus,
    reconciliationStatus,
    isLoading,
    overallHealth,
    emergencyHalt,
    toggleSimulation,
    runSafetyCheck,
    refetchAll,
    isEmergencyHalting,
    isTogglingSimulation,
    isRunningSafetyCheck,
  } = useSafetyMonitoring();

  const handleRefreshAll = useCallback(() => {
    refetchAll();
  }, [refetchAll]);

  const handleEmergencyHalt = useCallback(() => {
    emergencyHalt({ reason: "Manual emergency halt triggered from dashboard" });
  }, [emergencyHalt]);

  const handleToggleSimulation = useCallback(() => {
    toggleSimulation({ enable: !simulationStatus?.active });
  }, [toggleSimulation, simulationStatus?.active]);

  const handleAutoRefreshToggle = useCallback(() => {
    setIsAutoRefresh(!isAutoRefresh);
  }, [isAutoRefresh]);

  const handleSafetyCheck = useCallback(() => {
    runSafetyCheck();
  }, [runSafetyCheck]);

  const renderDashboardHeader = () => (
    <>
      <div>
        <h1 className="text-3xl font-bold">Safety Monitoring</h1>
        <p className="text-muted-foreground">
          Real-time monitoring of all safety systems and risk metrics
        </p>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={handleAutoRefreshToggle}>
            {isAutoRefresh ? (
              <PauseCircle className="h-4 w-4 mr-2" />
            ) : (
              <PlayCircle className="h-4 w-4 mr-2" />
            )}
            Auto Refresh
          </Button>
          <Button variant="outline" onClick={handleRefreshAll} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={handleSafetyCheck}
            disabled={isRunningSafetyCheck}
          >
            <Shield className={cn("h-4 w-4 mr-2", isRunningSafetyCheck && "animate-pulse")} />
            Safety Check
          </Button>
          <Button
            variant="destructive"
            onClick={handleEmergencyHalt}
            disabled={riskMetrics?.emergencyHaltActive || isEmergencyHalting}
          >
            <Power className="h-4 w-4 mr-2" />
            {isEmergencyHalting ? "Halting..." : "Emergency Halt"}
          </Button>
        </div>
      </div>
    </>
  );

  const renderSystemStatusAlert = () => (
    <Alert
      className={cn(
        overallHealth === "healthy" && "border-green-500",
        overallHealth === "warning" && "border-yellow-500",
        overallHealth === "critical" && "border-red-500"
      )}
    >
      {getHealthIcon(overallHealth)}
      <AlertTitle>System Status: {overallHealth.toUpperCase()}</AlertTitle>
      <AlertDescription>
        {systemHealth ? (
          <>
            Last updated: {new Date(systemHealth.lastUpdated).toLocaleString()}
            {" • "}
            {systemHealth.healthyServices}/{systemHealth.totalServices} services healthy
          </>
        ) : (
          "Loading system status..."
        )}
      </AlertDescription>
    </Alert>
  );

  const _renderRiskLevelCard = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Risk Level</CardTitle>
        <Shield className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", getRiskColor(riskMetrics?.currentRisk || "low"))}>
          {riskMetrics?.currentRisk?.toUpperCase() || "UNKNOWN"}
        </div>
        <p className="text-xs text-muted-foreground">
          Risk Score: {riskMetrics?.riskScore || 0}/100
        </p>
      </CardContent>
    </Card>
  );

  const _renderPnLCard = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
        {(riskMetrics?.totalPnL || 0) >= 0 ? (
          <TrendingUp className="h-4 w-4 text-green-500" />
        ) : (
          <TrendingDown className="h-4 w-4 text-red-500" />
        )}
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-2xl font-bold",
            (riskMetrics?.totalPnL || 0) >= 0 ? "text-green-500" : "text-red-500"
          )}
        >
          {formatCurrency(riskMetrics?.totalPnL || 0)}
        </div>
        <p className="text-xs text-muted-foreground">
          Max Drawdown: {formatCurrency(riskMetrics?.maxDrawdown || 0)}
        </p>
      </CardContent>
    </Card>
  );

  const _renderPositionsCard = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Positions</CardTitle>
        <Activity className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{riskMetrics?.activePositions || 0}</div>
        <p className="text-xs text-muted-foreground">
          Limit: {riskMetrics?.maxPositionsAllowed || 0}
        </p>
        <Progress
          value={
            ((riskMetrics?.activePositions || 0) / (riskMetrics?.maxPositionsAllowed || 1)) * 100
          }
          className="mt-2"
        />
      </CardContent>
    </Card>
  );

  const _renderSimulationCard = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Simulation</CardTitle>
        <Badge variant={simulationStatus?.active ? "default" : "secondary"}>
          {simulationStatus?.active ? "ACTIVE" : "INACTIVE"}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {formatCurrency(simulationStatus?.virtualBalance || 0)}
        </div>
        <p className="text-xs text-muted-foreground">Virtual Balance</p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggleSimulation}
          className="mt-2 w-full"
          disabled={isTogglingSimulation}
        >
          {isTogglingSimulation ? "Switching..." : simulationStatus?.active ? "Disable" : "Enable"}
        </Button>
      </CardContent>
    </Card>
  );

  const renderOverviewCards = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {_renderRiskLevelCard()}
      {_renderPnLCard()}
      {_renderPositionsCard()}
      {_renderSimulationCard()}
    </div>
  );

  const renderRiskManagementTab = () => (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Circuit Breaker Status</CardTitle>
          <CardDescription>Automatic trading halts based on risk thresholds</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span>Status:</span>
            <Badge
              variant={riskMetrics?.circuitBreakerStatus === "closed" ? "default" : "destructive"}
            >
              {riskMetrics?.circuitBreakerStatus?.toUpperCase() || "UNKNOWN"}
            </Badge>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span>Emergency Halt:</span>
            <Badge variant={riskMetrics?.emergencyHaltActive ? "destructive" : "secondary"}>
              {riskMetrics?.emergencyHaltActive ? "ACTIVE" : "INACTIVE"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk Metrics</CardTitle>
          <CardDescription>Current risk assessment and position limits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm">
              <span>Risk Score</span>
              <span>{riskMetrics?.riskScore || 0}/100</span>
            </div>
            <Progress value={riskMetrics?.riskScore || 0} className="mt-1" />
          </div>
          <div>
            <div className="flex justify-between text-sm">
              <span>Position Utilization</span>
              <span>
                {riskMetrics?.activePositions || 0} / {riskMetrics?.maxPositionsAllowed || 0}
              </span>
            </div>
            <Progress
              value={
                ((riskMetrics?.activePositions || 0) / (riskMetrics?.maxPositionsAllowed || 1)) *
                100
              }
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSimulationTab = () => (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Simulation Session</CardTitle>
          <CardDescription>Virtual trading environment for safe testing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Status:</span>
            <Badge variant={simulationStatus?.active ? "default" : "secondary"}>
              {simulationStatus?.active ? "RUNNING" : "STOPPED"}
            </Badge>
          </div>
          {simulationStatus?.sessionId && (
            <div className="flex items-center justify-between">
              <span>Session ID:</span>
              <code className="text-sm">{simulationStatus.sessionId.slice(0, 8)}...</code>
            </div>
          )}
          {simulationStatus?.startTime && (
            <div className="flex items-center justify-between">
              <span>Started:</span>
              <span className="text-sm">
                {new Date(simulationStatus.startTime).toLocaleString()}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Virtual Performance</CardTitle>
          <CardDescription>Performance metrics from simulation trading</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Virtual Balance:</span>
            <span className="font-mono">
              {formatCurrency(simulationStatus?.virtualBalance || 0)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Total Trades:</span>
            <span>{simulationStatus?.totalTrades || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Win Rate:</span>
            <span>{formatPercentage(simulationStatus?.winRate || 0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Virtual P&L:</span>
            <span
              className={cn(
                "font-mono",
                (simulationStatus?.virtualPnL || 0) >= 0 ? "text-green-500" : "text-red-500"
              )}
            >
              {formatCurrency(simulationStatus?.virtualPnL || 0)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      {renderDashboardHeader()}
      {renderSystemStatusAlert()}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="risk">Risk Management</TabsTrigger>
          <TabsTrigger value="simulation">Simulation</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {renderOverviewCards()}
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          {renderRiskManagementTab()}
        </TabsContent>

        <TabsContent value="simulation" className="space-y-4">
          {renderSimulationTab()}
        </TabsContent>

        <TabsContent value="reconciliation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Position & Balance Reconciliation</CardTitle>
              <CardDescription>
                Accuracy verification between local data and exchange
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-500">
                    {formatPercentage(reconciliationStatus?.positionAccuracy || 0)}
                  </div>
                  <p className="text-sm text-muted-foreground">Position Accuracy</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-500">
                    {formatPercentage(reconciliationStatus?.balanceAccuracy || 0)}
                  </div>
                  <p className="text-sm text-muted-foreground">Balance Accuracy</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {reconciliationStatus?.discrepanciesFound || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Discrepancies Found</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between">
                  <span>Last Check:</span>
                  <span className="text-sm">
                    {reconciliationStatus?.lastCheck
                      ? new Date(reconciliationStatus.lastCheck).toLocaleString()
                      : "Never"}
                  </span>
                </div>
                <div className="flex justify-between mt-2">
                  <span>Auto Resolved:</span>
                  <span>{reconciliationStatus?.autoResolved || 0}</span>
                </div>
                <div className="flex justify-between mt-2">
                  <span>Manual Resolution Required:</span>
                  <span
                    className={cn(
                      (reconciliationStatus?.manualResolutionRequired || 0) > 0
                        ? "text-yellow-500"
                        : "text-green-500"
                    )}
                  >
                    {reconciliationStatus?.manualResolutionRequired || 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {systemHealth?.services &&
              Object.entries(systemHealth.services).map(([serviceName, service]) => (
                <Card key={serviceName}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium capitalize">
                      {serviceName.replace(/([A-Z])/g, " $1").trim()}
                    </CardTitle>
                    {getHealthIcon(service.status)}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs">Status:</span>
                        <Badge
                          variant={
                            service.status === "online"
                              ? "default"
                              : service.status === "degraded"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {service.status.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs">Health:</span>
                        <span className="text-xs">{service.health}%</span>
                      </div>
                      <Progress value={service.health} className="h-1" />
                      <div className="flex justify-between">
                        <span className="text-xs">Response Time:</span>
                        <span className="text-xs">{service.responseTime}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs">Error Rate:</span>
                        <span className="text-xs">{formatPercentage(service.errorRate)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
});
