/**
 * Pattern Monitoring Dashboard Component
 *
 * Real-time pattern detection monitoring dashboard with statistics,
 * recent patterns, alerts, and control functions.
 */

"use client";

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Bell,
  BellOff,
  CheckCircle,
  Clock,
  Eye,
  Play,
  RefreshCw,
  Square,
  Target,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PatternMatch } from "@/src/core/pattern-detection";
import { usePatternMonitoring } from "@/src/hooks/use-pattern-monitoring";
import type { PatternAlert } from "@/src/services/notification/pattern-monitoring-service";

interface PatternMonitoringDashboardProps {
  className?: string;
  autoRefresh?: boolean;
  showControls?: boolean;
}

export function PatternMonitoringDashboard({
  className = "",
  autoRefresh = true,
  showControls = true,
}: PatternMonitoringDashboardProps) {
  const [_expandedAlert, _setExpandedAlert] = useState<string | null>(null);

  const {
    report,
    recentPatterns,
    isLoading,
    isStartingMonitoring,
    isStoppingMonitoring,
    // isDetecting,
    error,
    lastUpdated,
    isMonitoringActive,
    unacknowledgedAlertsCount,
    // loadMonitoringReport,
    startMonitoring,
    stopMonitoring,
    acknowledgeAlert,
    clearAcknowledgedAlerts,
    refreshData,
    clearError,
  } = usePatternMonitoring({
    autoRefresh,
    refreshInterval: 30000,
    loadOnMount: true,
    includePatterns: true,
    patternLimit: 20,
  });

  // Status indicator component
  const StatusIndicator = ({ status }: { status: string }) => {
    const getStatusProps = (status: string) => {
      switch (status) {
        case "healthy":
        case "active":
          return { icon: CheckCircle, color: "text-green-500", bg: "bg-green-50" };
        case "degraded":
        case "warning":
          return { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-50" };
        case "error":
        case "critical":
          return { icon: XCircle, color: "text-red-500", bg: "bg-red-50" };
        default:
          return { icon: Clock, color: "text-gray-400", bg: "bg-gray-50" };
      }
    };

    const { icon: Icon, color, bg } = getStatusProps(status);

    return (
      <div className={`flex items-center gap-2 px-2 py-1 rounded ${bg}`}>
        <Icon className={`h-4 w-4 ${color}`} />
        <span className={`text-sm font-medium ${color}`}>{status.toUpperCase()}</span>
      </div>
    );
  };

  // Pattern type badge component
  const PatternTypeBadge = ({ patternType }: { patternType: string }) => {
    const getTypeProps = (type: string) => {
      switch (type) {
        case "ready_state":
          return { variant: "default" as const, icon: Target };
        case "pre_ready":
          return { variant: "secondary" as const, icon: Eye };
        case "launch_sequence":
          return { variant: "destructive" as const, icon: Zap };
        case "risk_warning":
          return { variant: "outline" as const, icon: AlertTriangle };
        default:
          return { variant: "outline" as const, icon: Activity };
      }
    };

    const { variant, icon: Icon } = getTypeProps(patternType);

    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {patternType.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  // Confidence score component
  const ConfidenceScore = ({ confidence }: { confidence: number }) => {
    const getConfidenceColor = (score: number) => {
      if (score >= 80) return "text-green-600";
      if (score >= 60) return "text-yellow-600";
      return "text-red-600";
    };

    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${getConfidenceColor(confidence).replace("text-", "bg-")}`}
            style={{ width: `${confidence}%` }}
          />
        </div>
        <span className={`text-sm font-medium ${getConfidenceColor(confidence)}`}>
          {confidence.toFixed(0)}%
        </span>
      </div>
    );
  };

  const handleToggleMonitoring = async () => {
    if (isMonitoringActive) {
      await stopMonitoring();
    } else {
      await startMonitoring();
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    await acknowledgeAlert(alertId);
  };

  const handleClearAlerts = async () => {
    await clearAcknowledgedAlerts();
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Pattern Monitoring Error</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Pattern Detection Monitoring
              </CardTitle>
              <CardDescription>Real-time pattern detection and monitoring system</CardDescription>
            </div>
            <div className="flex gap-2">
              {showControls && (
                <>
                  <Button variant="outline" size="sm" onClick={refreshData} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                  <Button
                    variant={isMonitoringActive ? "destructive" : "default"}
                    size="sm"
                    onClick={handleToggleMonitoring}
                    disabled={isStartingMonitoring || isStoppingMonitoring}
                  >
                    {isMonitoringActive ? (
                      <>
                        <Square className="h-4 w-4" />
                        Stop
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        Start
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
            <div className="space-y-4">
              {/* Status Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">System Status</p>
                    <StatusIndicator status={report.status} />
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">Engine Status</p>
                    <StatusIndicator status={report.stats.engineStatus} />
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600">Active Alerts</p>
                    <div className="flex items-center gap-2">
                      <Bell
                        className={`h-4 w-4 ${unacknowledgedAlertsCount > 0 ? "text-red-500" : "text-gray-400"}`}
                      />
                      <span className="text-lg font-semibold">{unacknowledgedAlertsCount}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {report.stats.totalPatternsDetected}
                  </div>
                  <p className="text-sm text-gray-600">Total Patterns</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {report.stats.readyStatePatterns}
                  </div>
                  <p className="text-sm text-gray-600">Ready State</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {report.stats.preReadyPatterns}
                  </div>
                  <p className="text-sm text-gray-600">Pre-Ready</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {report.stats.advanceOpportunities}
                  </div>
                  <p className="text-sm text-gray-600">Advance Ops</p>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Average Confidence</span>
                    <span className="text-sm font-medium">
                      {report.stats.averageConfidence.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={report.stats.averageConfidence} className="w-full" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Detection Rate (per hour)</span>
                    <span className="text-sm font-medium">
                      {report.stats.detectionRate.toFixed(1)}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(report.stats.detectionRate * 10, 100)}
                    className="w-full"
                  />
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
              <span className="ml-2">Loading pattern monitoring data...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Alerts */}
      {report?.activeAlerts && report.activeAlerts.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Active Alerts ({report.activeAlerts.length})
              </CardTitle>
              <CardDescription>Pattern detection alerts and notifications</CardDescription>
            </div>
            {report.activeAlerts.some((alert: PatternAlert) => alert.acknowledged) && (
              <Button variant="outline" size="sm" onClick={handleClearAlerts}>
                Clear Acknowledged
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {report.activeAlerts.map((alert: PatternAlert) => (
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
                              : alert.severity === "high"
                                ? "destructive"
                                : alert.severity === "medium"
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
                    {alert.patterns.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {alert.patterns.slice(0, 3).map((pattern: PatternMatch, idx: number) => (
                          <Badge
                            key={`alert-pattern-${pattern.symbol}-${idx}`}
                            variant="outline"
                            className="text-xs"
                          >
                            {pattern.symbol}
                          </Badge>
                        ))}
                        {alert.patterns.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{alert.patterns.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Recent Patterns */}
      {recentPatterns && recentPatterns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Pattern Detections ({recentPatterns.length})
            </CardTitle>
            <CardDescription>Latest pattern matches and confidence scores</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {recentPatterns.map((pattern: PatternMatch, index: number) => (
                  <div
                    key={`pattern-${pattern.symbol}-${typeof pattern.detectedAt === "number" ? pattern.detectedAt : pattern.detectedAt.getTime()}-${index}`}
                    className="border rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {pattern.symbol}
                        </Badge>
                        <PatternTypeBadge patternType={pattern.patternType} />
                      </div>
                      <ConfidenceScore confidence={pattern.confidence} />
                    </div>

                    {pattern.indicators && (
                      <div className="flex gap-4 text-sm text-gray-600">
                        {pattern.indicators.sts !== undefined && (
                          <span>STS: {pattern.indicators.sts}</span>
                        )}
                        {pattern.indicators.st !== undefined && (
                          <span>ST: {pattern.indicators.st}</span>
                        )}
                        {pattern.indicators.tt !== undefined && (
                          <span>TT: {pattern.indicators.tt}</span>
                        )}
                        {pattern.indicators.advanceHours !== undefined && (
                          <span>Advance: {pattern.indicators.advanceHours}h</span>
                        )}
                      </div>
                    )}

                    <p className="text-sm text-gray-700 mt-2">
                      {pattern.recommendation
                        ? `Recommendation: ${pattern.recommendation}`
                        : "No specific recommendation"}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {report?.recommendations && report.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              System Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {report.recommendations.map((recommendation: string, index: number) => (
                <div
                  key={`recommendation-${index}-${recommendation.slice(0, 20)}`}
                  className="flex items-start gap-2"
                >
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-sm">{recommendation}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PatternMonitoringDashboard;
