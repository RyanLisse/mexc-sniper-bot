/**
 * Real-time Safety Dashboard Component
 *
 * Comprehensive dashboard for monitoring and controlling the real-time safety system.
 * Provides real-time risk assessment, alert management, and emergency response controls.
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
import { useRealTimeSafetyMonitoring } from "@/src/hooks/use-real-time-safety-monitoring";
import type {
  SafetyAction,
  SafetyAlert,
  SafetyConfiguration,
} from "@/src/services/real-time-safety-monitoring-service";
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Bell,
  BellOff,
  Gauge,
  Heart,
  PlayCircle,
  RefreshCw,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Siren,
  StopCircle,
  Zap,
} from "lucide-react";
import { useState } from "react";

interface RealTimeSafetyDashboardProps {
  className?: string;
  autoRefresh?: boolean;
  showControls?: boolean;
}

// Helper component for safety overview
function SafetyOverview({
  riskMetrics,
  safetyStatus,
  systemHealthScore,
}: {
  riskMetrics: any;
  safetyStatus: string;
  systemHealthScore: number;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{riskMetrics?.overall || 0}%</div>
          <Progress value={riskMetrics?.overall || 0} className="mt-2" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Safety Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant={safetyStatus === "healthy" ? "default" : "destructive"}>
            {safetyStatus}
          </Badge>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{systemHealthScore}%</div>
          <Progress value={systemHealthScore} className="mt-2" />
        </CardContent>
      </Card>
    </div>
  );
}

// Helper component for emergency controls
function EmergencyControls({
  onEmergencyStop,
  isLoading,
}: {
  onEmergencyStop: (reason: string) => void;
  isLoading: boolean;
}) {
  const [emergencyReason, setEmergencyReason] = useState("");

  return (
    <Card className="border-red-200 bg-red-50">
      <CardHeader>
        <CardTitle className="text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Emergency Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="emergency-reason">Emergency Stop Reason</Label>
          <Input
            id="emergency-reason"
            value={emergencyReason}
            onChange={(e) => setEmergencyReason(e.target.value)}
            placeholder="Describe the emergency situation..."
          />
        </div>
        <Button
          variant="destructive"
          onClick={() => onEmergencyStop(emergencyReason)}
          disabled={!emergencyReason.trim() || isLoading}
          className="w-full"
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          Emergency Stop
        </Button>
      </CardContent>
    </Card>
  );
}

export function RealTimeSafetyDashboard({
  className = "",
  autoRefresh = true,
  showControls = true,
}: RealTimeSafetyDashboardProps) {
  const [selectedTab, setSelectedTab] = useState("overview");
  const [configEditMode, setConfigEditMode] = useState(false);
  const [tempConfig, setTempConfig] = useState<Partial<SafetyConfiguration>>({});

  const {
    report,
    riskMetrics,
    activeAlerts,
    recentActions,
    safetyStatus,
    overallRiskScore,
    alertsCount,
    criticalAlertsCount,
    systemHealthScore,
    monitoringActive,
    isLoading,
    isStartingMonitoring,
    isStoppingMonitoring,
    isUpdatingConfig,
    isTriggeringEmergency,
    isAcknowledgingAlert,
    // isClearingAlerts,
    error,
    lastUpdated,
    startMonitoring,
    stopMonitoring,
    updateConfiguration,
    triggerEmergencyResponse,
    acknowledgeAlert,
    clearAcknowledgedAlerts,
    refreshData,
    // checkSystemSafety,
    clearError,
  } = useRealTimeSafetyMonitoring({
    autoRefresh,
    refreshInterval: 15000, // 15 seconds for safety monitoring
    loadOnMount: true,
    includeRecommendations: true,
    includeSystemHealth: true,
  });

  // Safety status indicator component
  const SafetyStatusIndicator = ({ status }: { status: string }) => {
    const getStatusProps = (status: string) => {
      switch (status) {
        case "safe":
          return { icon: ShieldCheck, color: "text-green-500", bg: "bg-green-50", text: "SAFE" };
        case "warning":
          return {
            icon: ShieldAlert,
            color: "text-yellow-500",
            bg: "bg-yellow-50",
            text: "WARNING",
          };
        case "critical":
          return {
            icon: ShieldAlert,
            color: "text-orange-500",
            bg: "bg-orange-50",
            text: "CRITICAL",
          };
        case "emergency":
          return { icon: ShieldX, color: "text-red-500", bg: "bg-red-50", text: "EMERGENCY" };
        default:
          return { icon: Shield, color: "text-gray-400", bg: "bg-gray-50", text: "UNKNOWN" };
      }
    };

    const { icon: Icon, color, bg, text } = getStatusProps(status);

    return (
      <div className={`flex items-center gap-2 px-4 py-3 rounded-lg ${bg}`}>
        <Icon className={`h-6 w-6 ${color}`} />
        <span className={`text-lg font-bold ${color}`}>{text}</span>
      </div>
    );
  };

  // Risk score gauge component
  const RiskScoreGauge = ({ score }: { score: number }) => {
    const getScoreColor = (score: number) => {
      if (score < 25) return "text-green-600";
      if (score < 50) return "text-yellow-600";
      if (score < 75) return "text-orange-600";
      return "text-red-600";
    };

    return (
      <div className="flex flex-col items-center">
        <div className="relative">
          <Gauge className={`h-12 w-12 ${getScoreColor(score)}`} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xs font-bold ${getScoreColor(score)}`}>{score.toFixed(0)}</span>
          </div>
        </div>
        <p className="text-sm text-gray-600 mt-1">Risk Score</p>
      </div>
    );
  };

  // Alert severity badge
  const AlertSeverityBadge = ({ alert }: { alert: SafetyAlert }) => {
    const getSeverityProps = (severity: string) => {
      switch (severity) {
        case "critical":
          return { variant: "destructive" as const, icon: AlertTriangle };
        case "high":
          return { variant: "destructive" as const, icon: AlertCircle };
        case "medium":
          return { variant: "secondary" as const, icon: AlertCircle };
        case "low":
          return { variant: "outline" as const, icon: AlertCircle };
        default:
          return { variant: "outline" as const, icon: AlertCircle };
      }
    };

    const { variant, icon: Icon } = getSeverityProps(alert.severity);

    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {alert.severity.toUpperCase()}
      </Badge>
    );
  };

  // Action handlers
  const handleToggleMonitoring = async () => {
    if (monitoringActive) {
      await stopMonitoring();
    } else {
      await startMonitoring();
    }
  };

  const handleEmergencyResponse = async () => {
    if (!emergencyReason.trim()) {
      alert("Please provide a reason for the emergency response");
      return;
    }

    const confirmed = window.confirm(
      `This will trigger an emergency response: "${emergencyReason}". This will halt all trading and close positions. Continue?`
    );

    if (confirmed) {
      await triggerEmergencyResponse(emergencyReason);
      setEmergencyReason("");
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
    const success = await updateConfiguration(tempConfig);
    if (success) {
      setConfigEditMode(false);
      setTempConfig({});
    }
  };

  const handleCancelConfigEdit = () => {
    setConfigEditMode(false);
    setTempConfig({});
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Safety Monitoring Error</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Safety Control Panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Real-time Safety Monitoring
              </CardTitle>
              <CardDescription>
                Comprehensive risk monitoring and emergency response system
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
                    variant={monitoringActive ? "secondary" : "default"}
                    size="sm"
                    onClick={handleToggleMonitoring}
                    disabled={isStartingMonitoring || isStoppingMonitoring}
                  >
                    {monitoringActive ? (
                      <>
                        <StopCircle className="h-4 w-4" />
                        Stop Monitoring
                      </>
                    ) : (
                      <>
                        <PlayCircle className="h-4 w-4" />
                        Start Monitoring
                      </>
                    )}
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
                  <SafetyStatusIndicator status={safetyStatus} />
                </div>
                <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                  <RiskScoreGauge score={overallRiskScore} />
                </div>
                <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Bell
                      className={`h-5 w-5 ${alertsCount > 0 ? "text-red-500" : "text-gray-400"}`}
                    />
                    <span className="text-2xl font-bold">{alertsCount}</span>
                  </div>
                  <p className="text-sm text-gray-600">Active Alerts</p>
                  {criticalAlertsCount > 0 && (
                    <Badge variant="destructive" className="mt-1">
                      {criticalAlertsCount} Critical
                    </Badge>
                  )}
                </div>
                <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Heart
                      className={`h-5 w-5 ${systemHealthScore > 80 ? "text-green-500" : systemHealthScore > 60 ? "text-yellow-500" : "text-red-500"}`}
                    />
                    <span className="text-2xl font-bold">{systemHealthScore}%</span>
                  </div>
                  <p className="text-sm text-gray-600">System Health</p>
                </div>
              </div>

              {/* Risk Metrics */}
              {riskMetrics && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">
                      {riskMetrics.currentDrawdown.toFixed(1)}%
                    </div>
                    <p className="text-sm text-gray-600">Current Drawdown</p>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-600">
                      {riskMetrics.successRate.toFixed(1)}%
                    </div>
                    <p className="text-sm text-gray-600">Success Rate</p>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-orange-600">
                      {riskMetrics.consecutiveLosses}
                    </div>
                    <p className="text-sm text-gray-600">Consecutive Losses</p>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">
                      {riskMetrics.apiLatency}ms
                    </div>
                    <p className="text-sm text-gray-600">API Latency</p>
                  </div>
                </div>
              )}

              {/* Emergency Response */}
              <Card className="border-red-200 bg-red-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-red-700 flex items-center gap-2">
                    <Siren className="h-5 w-5" />
                    Emergency Response
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Emergency response reason..."
                      value={emergencyReason}
                      onChange={(e) => setEmergencyReason(e.target.value)}
                      className="border-red-200"
                    />
                    <Button
                      variant="destructive"
                      onClick={handleEmergencyResponse}
                      disabled={isTriggeringEmergency || !emergencyReason.trim()}
                    >
                      <ShieldX className="h-4 w-4" />
                      Trigger Emergency
                    </Button>
                  </div>
                </CardContent>
              </Card>

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
              <span className="ml-2">Loading safety monitoring data...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Risk Assessment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Risk Assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              {report && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Overall Risk Score</span>
                        <span className="text-sm font-medium">
                          {overallRiskScore.toFixed(1)}/100
                        </span>
                      </div>
                      <Progress value={overallRiskScore} className="w-full" />
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">System Health</span>
                        <span className="text-sm font-medium">{systemHealthScore}%</span>
                      </div>
                      <Progress value={systemHealthScore} className="w-full" />
                    </div>
                  </div>

                  {/* Recommendations */}
                  {report.recommendations && report.recommendations.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">Safety Recommendations</h4>
                      <div className="space-y-2">
                        {report.recommendations.map((recommendation, index) => (
                          <Alert key={`safety-rec-${index}-${recommendation.slice(0, 20)}`}>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{recommendation}</AlertDescription>
                          </Alert>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* System Health */}
          {report?.systemHealth && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  System Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div
                      className={`text-lg font-semibold ${report.systemHealth.executionService ? "text-green-600" : "text-red-600"}`}
                    >
                      {report.systemHealth.executionService ? "Healthy" : "Failed"}
                    </div>
                    <p className="text-xs text-gray-600">Execution Service</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div
                      className={`text-lg font-semibold ${report.systemHealth.patternMonitoring ? "text-green-600" : "text-red-600"}`}
                    >
                      {report.systemHealth.patternMonitoring ? "Healthy" : "Failed"}
                    </div>
                    <p className="text-xs text-gray-600">Pattern Monitoring</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div
                      className={`text-lg font-semibold ${report.systemHealth.emergencySystem ? "text-green-600" : "text-red-600"}`}
                    >
                      {report.systemHealth.emergencySystem ? "Healthy" : "Failed"}
                    </div>
                    <p className="text-xs text-gray-600">Emergency System</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div
                      className={`text-lg font-semibold ${report.systemHealth.mexcConnectivity ? "text-green-600" : "text-red-600"}`}
                    >
                      {report.systemHealth.mexcConnectivity ? "Connected" : "Disconnected"}
                    </div>
                    <p className="text-xs text-gray-600">MEXC API</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Safety Alerts ({activeAlerts.length})
                </CardTitle>
                <CardDescription>Real-time safety alerts and risk notifications</CardDescription>
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
                    {activeAlerts.map((alert: SafetyAlert) => (
                      <div
                        key={alert.id}
                        className={`border rounded-lg p-4 ${alert.acknowledged ? "bg-gray-50 opacity-60" : "bg-white"}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <AlertSeverityBadge alert={alert} />
                            <Badge variant="outline">{alert.category}</Badge>
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
                                disabled={isAcknowledgingAlert}
                              >
                                <BellOff className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <h4 className="font-medium mb-1">{alert.title}</h4>
                        <p className="text-sm text-gray-700 mb-2">{alert.message}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            Risk Level: {alert.riskLevel}%
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Source: {alert.source}
                          </Badge>
                        </div>
                        {alert.autoActions && alert.autoActions.length > 0 && (
                          <div className="mt-2 text-xs text-blue-600">
                            Auto-actions: {alert.autoActions.length} scheduled
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

        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Recent Safety Actions ({recentActions.length})
              </CardTitle>
              <CardDescription>
                Automated and manual safety actions taken by the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentActions.length > 0 ? (
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {recentActions.map((action: SafetyAction) => (
                      <div key={action.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                action.result === "success"
                                  ? "default"
                                  : action.result === "failed"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {action.type.replace("_", " ").toUpperCase()}
                            </Badge>
                            <Badge variant="outline">
                              {action.result?.toUpperCase() || "PENDING"}
                            </Badge>
                          </div>
                          {action.executedAt && (
                            <span className="text-sm text-gray-500">
                              {new Date(action.executedAt).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 mb-1">{action.description}</p>
                        {action.details && (
                          <p className="text-xs text-gray-500">{action.details}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-gray-500">No recent actions</div>
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
                  Safety Configuration
                </CardTitle>
                <CardDescription>
                  Configure safety monitoring parameters and thresholds
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
              {report && (
                <div className="space-y-6">
                  {/* Basic Settings */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Basic Settings</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="enabled">Enable Safety Monitoring</Label>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="enabled"
                            checked={configEditMode ? (tempConfig.enabled ?? true) : true}
                            onCheckedChange={(checked) => handleConfigChange("enabled", checked)}
                            disabled={!configEditMode}
                          />
                          <span className="text-sm text-gray-600">
                            {(configEditMode ? (tempConfig.enabled ?? true) : true)
                              ? "Enabled"
                              : "Disabled"}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="autoActionEnabled">Auto-Actions</Label>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="autoActionEnabled"
                            checked={
                              configEditMode ? (tempConfig.autoActionEnabled ?? false) : false
                            }
                            onCheckedChange={(checked) =>
                              handleConfigChange("autoActionEnabled", checked)
                            }
                            disabled={!configEditMode}
                          />
                          <span className="text-sm text-gray-600">
                            {(configEditMode ? (tempConfig.autoActionEnabled ?? false) : false)
                              ? "Enabled"
                              : "Disabled"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Risk Thresholds */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Risk Thresholds</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="maxDrawdownPercentage">Max Drawdown (%)</Label>
                        <Input
                          id="maxDrawdownPercentage"
                          type="number"
                          min="5"
                          max="50"
                          step="0.5"
                          value={
                            configEditMode
                              ? (tempConfig.thresholds?.maxDrawdownPercentage ?? 15)
                              : 15
                          }
                          onChange={(e) =>
                            handleConfigChange("thresholds", {
                              ...tempConfig.thresholds,
                              maxDrawdownPercentage: Number.parseFloat(e.target.value),
                            })
                          }
                          disabled={!configEditMode}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="minSuccessRatePercentage">Min Success Rate (%)</Label>
                        <Input
                          id="minSuccessRatePercentage"
                          type="number"
                          min="30"
                          max="95"
                          step="1"
                          value={
                            configEditMode
                              ? (tempConfig.thresholds?.minSuccessRatePercentage ?? 60)
                              : 60
                          }
                          onChange={(e) =>
                            handleConfigChange("thresholds", {
                              ...tempConfig.thresholds,
                              minSuccessRatePercentage: Number.parseFloat(e.target.value),
                            })
                          }
                          disabled={!configEditMode}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="maxConsecutiveLosses">Max Consecutive Losses</Label>
                        <Input
                          id="maxConsecutiveLosses"
                          type="number"
                          min="2"
                          max="20"
                          step="1"
                          value={
                            configEditMode ? (tempConfig.thresholds?.maxConsecutiveLosses ?? 5) : 5
                          }
                          onChange={(e) =>
                            handleConfigChange("thresholds", {
                              ...tempConfig.thresholds,
                              maxConsecutiveLosses: Number.parseInt(e.target.value),
                            })
                          }
                          disabled={!configEditMode}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="maxApiLatencyMs">Max API Latency (ms)</Label>
                        <Input
                          id="maxApiLatencyMs"
                          type="number"
                          min="100"
                          max="5000"
                          step="100"
                          value={
                            configEditMode ? (tempConfig.thresholds?.maxApiLatencyMs ?? 1000) : 1000
                          }
                          onChange={(e) =>
                            handleConfigChange("thresholds", {
                              ...tempConfig.thresholds,
                              maxApiLatencyMs: Number.parseInt(e.target.value),
                            })
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

export default RealTimeSafetyDashboard;
