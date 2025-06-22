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

// Safety status indicator component
function SafetyStatusIndicator({ status }: { status: string }) {
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
}

// Risk score gauge component
function RiskScoreGauge({ score }: { score: number }) {
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
}

// Alert severity badge
function AlertSeverityBadge({ alert }: { alert: SafetyAlert }) {
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
}

// Safety status overview section
function SafetyStatusOverview({
  safetyStatus,
  overallRiskScore,
  alertsCount,
  criticalAlertsCount,
  systemHealthScore,
}: {
  safetyStatus: string;
  overallRiskScore: number;
  alertsCount: number;
  criticalAlertsCount: number;
  systemHealthScore: number;
}) {
  return (
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
            className={`h-5 w-5 ${
              systemHealthScore > 80 
                ? "text-green-500" 
                : systemHealthScore > 60 
                  ? "text-yellow-500" 
                  : "text-red-500"
            }`}
          />
          <span className="text-2xl font-bold">{systemHealthScore}%</span>
        </div>
        <p className="text-sm text-gray-600">System Health</p>
      </div>
    </div>
  );
}

// Risk metrics grid component
interface RiskMetricsData {
  currentDrawdown: number;
  successRate: number;
  consecutiveLosses: number;
  apiLatency: number;
}

function RiskMetricsGrid({ riskMetrics }: { riskMetrics: RiskMetricsData | null }) {
  if (!riskMetrics) return null;

  return (
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
  );
}

// Emergency response panel
function EmergencyResponsePanel({
  emergencyReason,
  onEmergencyReasonChange,
  onEmergencyResponse,
  isTriggeringEmergency,
}: {
  emergencyReason: string;
  onEmergencyReasonChange: (reason: string) => void;
  onEmergencyResponse: () => void;
  isTriggeringEmergency: boolean;
}) {
  return (
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
            onChange={(e) => onEmergencyReasonChange(e.target.value)}
            className="border-red-200"
          />
          <Button
            variant="destructive"
            onClick={onEmergencyResponse}
            disabled={isTriggeringEmergency || !emergencyReason.trim()}
          >
            <ShieldX className="h-4 w-4" />
            Trigger Emergency
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Risk assessment card component
interface SafetyReport {
  recommendations?: string[];
}

function RiskAssessmentCard({
  report,
  overallRiskScore,
  systemHealthScore,
}: {
  report: SafetyReport | null;
  overallRiskScore: number;
  systemHealthScore: number;
}) {
  if (!report) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Risk Assessment
        </CardTitle>
      </CardHeader>
      <CardContent>
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

          {report.recommendations && report.recommendations.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Safety Recommendations</h4>
              <div className="space-y-2">
                {report.recommendations.map((recommendation: string, index: number) => (
                  <Alert key={`safety-rec-${index}-${recommendation.slice(0, 20)}`}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{recommendation}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// System health card component
interface SystemHealthData {
  systemHealth?: {
    executionService: boolean;
    patternMonitoring: boolean;
    emergencySystem: boolean;
    mexcConnectivity: boolean;
  };
}

function SystemHealthCard({ report }: { report: SystemHealthData | null }) {
  if (!report?.systemHealth) return null;

  const getHealthStatus = (isHealthy: boolean) => ({
    text: isHealthy ? "Healthy" : "Failed",
    color: isHealthy ? "text-green-600" : "text-red-600",
  });

  return (
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
            <div className={`text-lg font-semibold ${getHealthStatus(report.systemHealth.executionService).color}`}>
              {getHealthStatus(report.systemHealth.executionService).text}
            </div>
            <p className="text-xs text-gray-600">Execution Service</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className={`text-lg font-semibold ${getHealthStatus(report.systemHealth.patternMonitoring).color}`}>
              {getHealthStatus(report.systemHealth.patternMonitoring).text}
            </div>
            <p className="text-xs text-gray-600">Pattern Monitoring</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className={`text-lg font-semibold ${getHealthStatus(report.systemHealth.emergencySystem).color}`}>
              {getHealthStatus(report.systemHealth.emergencySystem).text}
            </div>
            <p className="text-xs text-gray-600">Emergency System</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className={`text-lg font-semibold ${getHealthStatus(report.systemHealth.mexcConnectivity).color}`}>
              {report.systemHealth.mexcConnectivity ? "Connected" : "Disconnected"}
            </div>
            <p className="text-xs text-gray-600">MEXC API</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Safety alerts tab content
function SafetyAlertsTab({
  activeAlerts,
  onAcknowledgeAlert,
  onClearAlerts,
  isAcknowledgingAlert,
}: {
  activeAlerts: SafetyAlert[];
  onAcknowledgeAlert: (alertId: string) => void;
  onClearAlerts: () => void;
  isAcknowledgingAlert: boolean;
}) {
  return (
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
          <Button variant="outline" size="sm" onClick={onClearAlerts}>
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
                          onClick={() => onAcknowledgeAlert(alert.id)}
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
  );
}

// Safety actions tab content
function SafetyActionsTab({ recentActions }: { recentActions: SafetyAction[] }) {
  const getActionVariant = (result: string) => {
    if (result === "success") return "default";
    if (result === "failed") return "destructive";
    return "secondary";
  };

  return (
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
                      <Badge variant={getActionVariant(action.result)}>
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
  );
}

// Helper component for configuration switches
function ConfigSwitch({
  id,
  label,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center space-x-2">
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
        />
        <span className="text-sm text-gray-600">
          {checked ? "Enabled" : "Disabled"}
        </span>
      </div>
    </div>
  );
}

// Helper component for number inputs
function ConfigNumberInput({
  id,
  label,
  value,
  onChange,
  disabled,
  min,
  max,
  step,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
  min: string;
  max: string;
  step: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number.parseFloat(e.target.value))}
        disabled={disabled}
      />
    </div>
  );
}

// Configuration header with action buttons
function ConfigHeader({
  configEditMode,
  onSaveConfig,
  onCancelConfigEdit,
  onEditConfig,
  isUpdatingConfig,
}: {
  configEditMode: boolean;
  onSaveConfig: () => void;
  onCancelConfigEdit: () => void;
  onEditConfig: () => void;
  isUpdatingConfig: boolean;
}) {
  return (
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
              onClick={onCancelConfigEdit}
              disabled={isUpdatingConfig}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={onSaveConfig} disabled={isUpdatingConfig}>
              Save Changes
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={onEditConfig}>
            Edit Configuration
          </Button>
        )}
      </div>
    </CardHeader>
  );
}

// Safety configuration tab content
function SafetyConfigTab({
  report,
  configEditMode,
  tempConfig,
  onConfigChange,
  onSaveConfig,
  onCancelConfigEdit,
  onEditConfig,
  isUpdatingConfig,
}: {
  report: SafetyReport | null;
  configEditMode: boolean;
  tempConfig: Partial<SafetyConfiguration>;
  onConfigChange: (field: string, value: string | number | boolean | unknown) => void;
  onSaveConfig: () => void;
  onCancelConfigEdit: () => void;
  onEditConfig: () => void;
  isUpdatingConfig: boolean;
}) {
  if (!report) return null;

  // Helper function to update thresholds
  const updateThreshold = (field: string, value: number) => {
    onConfigChange("thresholds", {
      ...tempConfig.thresholds,
      [field]: value,
    });
  };

  // Helper function to get config values
  const getConfigValue = (field: string, defaultValue: boolean | number) => {
    if (!configEditMode) return defaultValue;
    return (tempConfig as Record<string, unknown>)[field] ?? defaultValue;
  };

  const getThresholdValue = (field: string, defaultValue: number) => {
    if (!configEditMode) return defaultValue;
    return tempConfig.thresholds?.[field as keyof typeof tempConfig.thresholds] ?? defaultValue;
  };

  return (
    <Card>
      <ConfigHeader
        configEditMode={configEditMode}
        onSaveConfig={onSaveConfig}
        onCancelConfigEdit={onCancelConfigEdit}
        onEditConfig={onEditConfig}
        isUpdatingConfig={isUpdatingConfig}
      />
      <CardContent>
        <div className="space-y-6">
          {/* Basic Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Basic Settings</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ConfigSwitch
                id="enabled"
                label="Enable Safety Monitoring"
                checked={getConfigValue("enabled", true) as boolean}
                onCheckedChange={(checked) => onConfigChange("enabled", checked)}
                disabled={!configEditMode}
              />
              <ConfigSwitch
                id="autoActionEnabled"
                label="Auto-Actions"
                checked={getConfigValue("autoActionEnabled", false) as boolean}
                onCheckedChange={(checked) => onConfigChange("autoActionEnabled", checked)}
                disabled={!configEditMode}
              />
            </div>
          </div>

          <Separator />

          {/* Risk Thresholds */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Risk Thresholds</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ConfigNumberInput
                id="maxDrawdownPercentage"
                label="Max Drawdown (%)"
                value={getThresholdValue("maxDrawdownPercentage", 15)}
                onChange={(value) => updateThreshold("maxDrawdownPercentage", value)}
                disabled={!configEditMode}
                min="5"
                max="50"
                step="0.5"
              />
              <ConfigNumberInput
                id="minSuccessRatePercentage"
                label="Min Success Rate (%)"
                value={getThresholdValue("minSuccessRatePercentage", 60)}
                onChange={(value) => updateThreshold("minSuccessRatePercentage", value)}
                disabled={!configEditMode}
                min="30"
                max="95"
                step="1"
              />
              <ConfigNumberInput
                id="maxConsecutiveLosses"
                label="Max Consecutive Losses"
                value={getThresholdValue("maxConsecutiveLosses", 5)}
                onChange={(value) => updateThreshold("maxConsecutiveLosses", Math.round(value))}
                disabled={!configEditMode}
                min="2"
                max="20"
                step="1"
              />
              <ConfigNumberInput
                id="maxApiLatencyMs"
                label="Max API Latency (ms)"
                value={getThresholdValue("maxApiLatencyMs", 1000)}
                onChange={(value) => updateThreshold("maxApiLatencyMs", Math.round(value))}
                disabled={!configEditMode}
                min="100"
                max="5000"
                step="100"
              />
            </div>
          </div>
        </div>
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
  const [emergencyReason, setEmergencyReason] = useState("");

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
    error,
    lastUpdated,
    startMonitoring,
    stopMonitoring,
    updateConfiguration,
    triggerEmergencyResponse,
    acknowledgeAlert,
    clearAcknowledgedAlerts,
    refreshData,
    clearError,
  } = useRealTimeSafetyMonitoring({
    autoRefresh,
    refreshInterval: 15000,
    loadOnMount: true,
    includeRecommendations: true,
    includeSystemHealth: true,
  });

  // Event handlers
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

  const handleConfigChange = (field: string, value: string | number | boolean | unknown) => {
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

  const handleEditConfig = () => {
    setConfigEditMode(true);
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
              <SafetyStatusOverview
                safetyStatus={safetyStatus}
                overallRiskScore={overallRiskScore}
                alertsCount={alertsCount}
                criticalAlertsCount={criticalAlertsCount}
                systemHealthScore={systemHealthScore}
              />

              {/* Risk Metrics */}
              <RiskMetricsGrid riskMetrics={riskMetrics} />

              {/* Emergency Response */}
              <EmergencyResponsePanel
                emergencyReason={emergencyReason}
                onEmergencyReasonChange={setEmergencyReason}
                onEmergencyResponse={handleEmergencyResponse}
                isTriggeringEmergency={isTriggeringEmergency}
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
          <RiskAssessmentCard
            report={report}
            overallRiskScore={overallRiskScore}
            systemHealthScore={systemHealthScore}
          />
          <SystemHealthCard report={report} />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <SafetyAlertsTab
            activeAlerts={activeAlerts}
            onAcknowledgeAlert={acknowledgeAlert}
            onClearAlerts={clearAcknowledgedAlerts}
            isAcknowledgingAlert={isAcknowledgingAlert}
          />
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <SafetyActionsTab recentActions={recentActions} />
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <SafetyConfigTab
            report={report}
            configEditMode={configEditMode}
            tempConfig={tempConfig}
            onConfigChange={handleConfigChange}
            onSaveConfig={handleSaveConfig}
            onCancelConfigEdit={handleCancelConfigEdit}
            onEditConfig={handleEditConfig}
            isUpdatingConfig={isUpdatingConfig}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default RealTimeSafetyDashboard;