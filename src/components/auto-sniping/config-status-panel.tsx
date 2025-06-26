/**
 * Configuration Status Panel Component
 *
 * Displays real-time system readiness status for auto-sniping functionality.
 * Shows validation results for each component and overall system health.
 */

"use client";

import {
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Settings,
  Shield,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import React, { useState } from "react";
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
import { Progress } from "@/src/components/ui/progress";
import { Separator } from "@/src/components/ui/separator";
import { useConfigValidation } from "@/src/hooks/use-config-validation";
import type { ConfigValidationResult } from "@/src/services/mexc-config-validator";

interface ConfigStatusPanelProps {
  className?: string;
  showDetailedResults?: boolean;
  autoRefresh?: boolean;
}

interface StatusInfo {
  icon: React.ReactNode;
  title: string;
  description: string;
}

// Consolidated status information helper
const getStatusInfo = (status: string, autoSnipingEnabled: boolean): StatusInfo => {
  const statusMap: Record<string, StatusInfo> = {
    ready: {
      icon: <CheckCircle className="h-6 w-6 text-green-500" />,
      title: "System Ready",
      description: `Auto-sniping is ${autoSnipingEnabled ? "enabled" : "disabled"}`,
    },
    partial: {
      icon: <AlertTriangle className="h-6 w-6 text-yellow-500" />,
      title: "Partial Readiness",
      description: `Auto-sniping is ${autoSnipingEnabled ? "enabled" : "disabled"}`,
    },
    not_ready: {
      icon: <XCircle className="h-6 w-6 text-red-500" />,
      title: "System Not Ready",
      description: `Auto-sniping is ${autoSnipingEnabled ? "enabled" : "disabled"}`,
    },
  };

  return statusMap[status] || statusMap.not_ready;
};

// Status display component for overall system status
const StatusDisplay = ({
  status,
  autoSnipingEnabled,
  readinessScore,
}: {
  status: string;
  autoSnipingEnabled: boolean;
  readinessScore: number;
}) => {
  const statusInfo = getStatusInfo(status, autoSnipingEnabled);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {statusInfo.icon}
        <div>
          <h3 className="font-semibold">{statusInfo.title}</h3>
          <p className="text-sm text-muted-foreground">{statusInfo.description}</p>
        </div>
      </div>
      <div className="text-right">
        <div className="text-2xl font-bold">{readinessScore}%</div>
        <p className="text-sm text-muted-foreground">Readiness Score</p>
      </div>
    </div>
  );
};

export function ConfigStatusPanel({
  className = "",
  showDetailedResults = true,
  autoRefresh = false,
}: ConfigStatusPanelProps) {
  const [expandedComponent, setExpandedComponent] = useState<string | null>(null);

  const {
    readinessReport,
    healthStatus,
    isLoading,
    isValidating,
    error,
    lastUpdated,
    generateReadinessReport,
    validateComponent,
    runHealthCheck,
    clearError,
  } = useConfigValidation({
    autoRefresh,
    refreshInterval: 30000,
    loadOnMount: true,
  });

  // Consolidated status information for components
  const getComponentStatusInfo = (status: string, isValid: boolean) => {
    const statusTypes = {
      valid_and_valid: {
        icon: <CheckCircle className="h-5 w-5 text-green-500" />,
        variant: "default" as const,
      },
      warning: {
        icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
        variant: "secondary" as const,
      },
      invalid_or_not_valid: {
        icon: <XCircle className="h-5 w-5 text-red-500" />,
        variant: "destructive" as const,
      },
      default: {
        icon: <Clock className="h-5 w-5 text-gray-400" />,
        variant: "outline" as const,
      },
    };

    if (status === "valid" && isValid) return statusTypes.valid_and_valid;
    if (status === "warning") return statusTypes.warning;
    if (status === "invalid" || !isValid) return statusTypes.invalid_or_not_valid;
    return statusTypes.default;
  };

  // Component icon mapping
  const getComponentIcon = (component: string) => {
    switch (component.toLowerCase()) {
      case "mexc api credentials":
        return <Settings className="h-4 w-4" />;
      case "pattern detection engine":
        return <TrendingUp className="h-4 w-4" />;
      case "safety & risk management":
        return <Shield className="h-4 w-4" />;
      case "trading configuration":
        return <Zap className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  const handleComponentValidation = async (component: string) => {
    // Map display component names to API component names
    const componentMapping: Record<string, string> = {
      "mexc api credentials": "mexc_credentials",
      "pattern detection engine": "pattern_detection",
      "safety & risk management": "safety_systems",
      "trading configuration": "trading_config",
    };

    const componentKey =
      componentMapping[component.toLowerCase()] ||
      component.toLowerCase().replace(/[^a-z0-9]/g, "_");
    await validateComponent(componentKey);
  };

  const handleToggleExpanded = (component: string) => {
    setExpandedComponent(expandedComponent === component ? null : component);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Validation Error</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* System Overview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Auto-Sniping System Status
              </CardTitle>
              <CardDescription>
                Current system readiness for automated trading operations
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={runHealthCheck} disabled={isValidating}>
                <RefreshCw className={`h-4 w-4 ${isValidating ? "animate-spin" : ""}`} />
                Quick Check
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={generateReadinessReport}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Full Validation
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Overall Status */}
          {readinessReport && (
            <div className="space-y-4">
              <StatusDisplay
                status={readinessReport.overallStatus}
                autoSnipingEnabled={readinessReport.autoSnipingEnabled}
                readinessScore={readinessReport.readinessScore}
              />

              <Progress value={readinessReport.readinessScore} className="w-full" />

              {lastUpdated && (
                <p className="text-sm text-muted-foreground">
                  Last updated: {new Date(lastUpdated).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Health Status (when no full report available) */}
          {!readinessReport && healthStatus && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {healthStatus.healthy ? (
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-500" />
                  )}
                  <div>
                    <h3 className="font-semibold">
                      {healthStatus.healthy ? "System Healthy" : "System Issues Detected"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {healthStatus.issues.length} issue(s) found
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{healthStatus.score}%</div>
                  <p className="text-sm text-muted-foreground">Health Score</p>
                </div>
              </div>

              <Progress value={healthStatus.score} className="w-full" />

              {healthStatus.issues.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Issues:</h4>
                  {healthStatus.issues.map((issue, index) => (
                    <div
                      key={`issue-${index}-${issue.slice(0, 20)}`}
                      className="text-sm text-red-600 bg-red-50 p-2 rounded"
                    >
                      {issue}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Loading State */}
          {isLoading && !readinessReport && !healthStatus && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Validating system configuration...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Component Results */}
      {showDetailedResults && readinessReport?.validationResults && (
        <Card>
          <CardHeader>
            <CardTitle>Component Validation Results</CardTitle>
            <CardDescription>Detailed status for each system component</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {readinessReport.validationResults.map(
                (result: ConfigValidationResult, index: number) => (
                  <div
                    key={`${result.component}-${result.status}-${index}`}
                    className="border rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getComponentIcon(result.component)}
                        <div>
                          <h4 className="font-medium flex items-center gap-2">
                            {result.component}
                            <Badge
                              variant={
                                getComponentStatusInfo(result.status, result.isValid).variant
                              }
                            >
                              {result.status}
                            </Badge>
                          </h4>
                          <p className="text-sm text-muted-foreground">{result.message}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getComponentStatusInfo(result.status, result.isValid).icon}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleExpanded(result.component)}
                        >
                          {expandedComponent === result.component ? "Hide" : "Details"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleComponentValidation(result.component)}
                          disabled={isValidating}
                        >
                          <RefreshCw className={`h-3 w-3 ${isValidating ? "animate-spin" : ""}`} />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedComponent === result.component && (
                      <>
                        <Separator className="my-3" />
                        <div className="space-y-2">
                          <div className="text-sm">
                            <strong>Timestamp:</strong>{" "}
                            {new Date(result.timestamp).toLocaleString()}
                          </div>
                          {result.details && (
                            <div className="text-sm">
                              <strong>Details:</strong>
                              <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-auto">
                                {JSON.stringify(result.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {readinessReport?.recommendations && readinessReport.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
            <CardDescription>Suggested actions to improve system readiness</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {readinessReport.recommendations.map((recommendation, index) => (
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

export default ConfigStatusPanel;
