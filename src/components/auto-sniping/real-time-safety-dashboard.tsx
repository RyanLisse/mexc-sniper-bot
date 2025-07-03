"use client";

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
  TrendingUp,
  Zap,
} from "lucide-react";
import { useState } from "react";
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
import { Switch } from "@/src/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";

interface RealTimeSafetyDashboardProps {
  className?: string;
  autoRefresh?: boolean;
  showControls?: boolean;
}

// Mock data for the dashboard
const mockSafetyData = {
  status: "safe",
  riskScore: 15,
  systemHealth: 85,
  alertsCount: 2,
  criticalAlerts: 0,
  activeAlerts: [
    {
      id: "1",
      title: "High Latency Detected",
      message: "API response time increased",
      severity: "medium",
      category: "connectivity",
      riskLevel: 25,
      source: "mexc-api",
      timestamp: new Date().toISOString(),
      acknowledged: false,
      autoActions: []
    }
  ],
  recentActions: [
    {
      id: "1",
      type: "position_adjustment",
      description: "Reduced position size due to volatility",
      result: "success",
      executedAt: new Date().toISOString(),
      details: "Position reduced by 20%"
    }
  ],
  metrics: {
    currentDrawdown: 2.5,
    successRate: 78.5,
    consecutiveLosses: 0,
    apiLatency: 45
  }
};

// Simple status indicator
function SafetyStatusIndicator({ status }: { status: string }) {
  const getStatusProps = (status: string) => {
    switch (status) {
      case "safe":
        return { icon: ShieldCheck, color: "text-green-500", bg: "bg-green-50", text: "SAFE" };
      case "warning":
        return { icon: ShieldAlert, color: "text-yellow-500", bg: "bg-yellow-50", text: "WARNING" };
      case "critical":
        return { icon: ShieldAlert, color: "text-orange-500", bg: "bg-orange-50", text: "CRITICAL" };
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

// Simple risk gauge
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

// Simple alert badge
function AlertSeverityBadge({ severity }: { severity: string }) {
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

  const { variant, icon: Icon } = getSeverityProps(severity);

  return (
    <Badge variant={variant} className="flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {severity.toUpperCase()}
    </Badge>
  );
}

// Status overview section
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
          <Bell className={`h-5 w-5 ${alertsCount > 0 ? "text-red-500" : "text-gray-400"}`} />
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

// Risk metrics grid
function RiskMetricsGrid({ metrics }: { metrics: any }) {
  if (!metrics) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="text-center">
        <div className="text-lg font-bold text-blue-600">
          {metrics.currentDrawdown.toFixed(1)}%
        </div>
        <p className="text-sm text-gray-600">Current Drawdown</p>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-purple-600">
          {metrics.successRate.toFixed(1)}%
        </div>
        <p className="text-sm text-gray-600">Success Rate</p>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-orange-600">{metrics.consecutiveLosses}</div>
        <p className="text-sm text-gray-600">Consecutive Losses</p>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-green-600">{metrics.apiLatency}ms</div>
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

// Risk assessment card
function RiskAssessmentCard({
  overallRiskScore,
  systemHealthScore,
}: {
  overallRiskScore: number;
  systemHealthScore: number;
}) {
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
                <span className="text-sm font-medium">{overallRiskScore.toFixed(1)}/100</span>
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

          <div className="space-y-3">
            <h4 className="text-sm font-medium">Safety Recommendations</h4>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Monitor API latency closely</AlertDescription>
            </Alert>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// System health card
function SystemHealthCard() {
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
            <div className="text-lg font-semibold text-green-600">Healthy</div>
            <p className="text-xs text-gray-600">Execution Service</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className="text-lg font-semibold text-green-600">Healthy</div>
            <p className="text-xs text-gray-600">Pattern Monitoring</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className="text-lg font-semibold text-green-600">Healthy</div>
            <p className="text-xs text-gray-600">Emergency System</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className="text-lg font-semibold text-green-600">Connected</div>
            <p className="text-xs text-gray-600">MEXC API</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Safety alerts tab
function SafetyAlertsTab({
  activeAlerts,
  onAcknowledgeAlert,
  onClearAlerts,
  isAcknowledgingAlert,
}: {
  activeAlerts: any[];
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
              {activeAlerts.map((alert: any) => (
                <div
                  key={alert.id}
                  className={`border rounded-lg p-4 ${alert.acknowledged ? "bg-gray-50 opacity-60" : "bg-white"}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertSeverityBadge severity={alert.severity} />
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

// Safety actions tab
function SafetyActionsTab({ recentActions }: { recentActions: any[] }) {
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
        <CardDescription>Automated and manual safety actions taken by the system</CardDescription>
      </CardHeader>
      <CardContent>
        {recentActions.length > 0 ? (
          <ScrollArea className="h-64">
            <div className="space-y-3">
              {recentActions.map((action: any) => (
                <div key={action.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={getActionVariant(action.result || "pending")}>
                        {action.type.replace("_", " ").toUpperCase()}
                      </Badge>
                      <Badge variant="outline">{action.result?.toUpperCase() || "PENDING"}</Badge>
                    </div>
                    {action.executedAt && (
                      <span className="text-sm text-gray-500">
                        {new Date(action.executedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 mb-1">{action.description}</p>
                  {action.details && <p className="text-xs text-gray-500">{action.details}</p>}
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

// Configuration tab
function SafetyConfigTab({
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Safety Configuration
          </CardTitle>
          <CardDescription>Configure safety monitoring parameters and thresholds</CardDescription>
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
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Basic Settings</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Enable Safety Monitoring</Label>
                <div className="flex items-center space-x-2">
                  <Switch defaultChecked disabled={!configEditMode} />
                  <span className="text-sm text-gray-600">Enabled</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Auto-Actions</Label>
                <div className="flex items-center space-x-2">
                  <Switch disabled={!configEditMode} />
                  <span className="text-sm text-gray-600">Disabled</span>
                </div>
              </div>
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
  const [emergencyReason, setEmergencyReason] = useState("");
  const [monitoringActive, setMonitoringActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Use mock data
  const safetyData = mockSafetyData;

  // Event handlers
  const handleToggleMonitoring = () => {
    setMonitoringActive(!monitoringActive);
  };

  const handleEmergencyResponse = () => {
    if (!emergencyReason.trim()) {
      alert("Please provide a reason for the emergency response");
      return;
    }

    const confirmed = window.confirm(
      `This will trigger an emergency response: "${emergencyReason}". This will halt all trading and close positions. Continue?`
    );

    if (confirmed) {
      console.log("Emergency response triggered:", emergencyReason);
      setEmergencyReason("");
    }
  };

  const handleSaveConfig = () => {
    setConfigEditMode(false);
  };

  const handleCancelConfigEdit = () => {
    setConfigEditMode(false);
  };

  const handleEditConfig = () => {
    setConfigEditMode(true);
  };

  const handleAcknowledgeAlert = (alertId: string) => {
    console.log("Acknowledging alert:", alertId);
  };

  const handleClearAlerts = () => {
    console.log("Clearing acknowledged alerts");
  };

  const refreshData = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  return (
    <div className={`space-y-6 ${className}`}>
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
          <div className="space-y-6">
            {/* Status Overview */}
            <SafetyStatusOverview
              safetyStatus={safetyData.status}
              overallRiskScore={safetyData.riskScore}
              alertsCount={safetyData.alertsCount}
              criticalAlertsCount={safetyData.criticalAlerts}
              systemHealthScore={safetyData.systemHealth}
            />

            {/* Risk Metrics */}
            <RiskMetricsGrid metrics={safetyData.metrics} />

            {/* Emergency Response */}
            <EmergencyResponsePanel
              emergencyReason={emergencyReason}
              onEmergencyReasonChange={setEmergencyReason}
              onEmergencyResponse={handleEmergencyResponse}
              isTriggeringEmergency={false}
            />

            <p className="text-sm text-gray-500">
              Last updated: {new Date().toLocaleString()}
            </p>
          </div>
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
            overallRiskScore={safetyData.riskScore}
            systemHealthScore={safetyData.systemHealth}
          />
          <SystemHealthCard />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <SafetyAlertsTab
            activeAlerts={safetyData.activeAlerts}
            onAcknowledgeAlert={handleAcknowledgeAlert}
            onClearAlerts={handleClearAlerts}
            isAcknowledgingAlert={false}
          />
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <SafetyActionsTab recentActions={safetyData.recentActions} />
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <SafetyConfigTab
            configEditMode={configEditMode}
            onSaveConfig={handleSaveConfig}
            onCancelConfigEdit={handleCancelConfigEdit}
            onEditConfig={handleEditConfig}
            isUpdatingConfig={false}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default RealTimeSafetyDashboard;