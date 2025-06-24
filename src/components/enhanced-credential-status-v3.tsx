"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Database,
  ExternalLink,
  Globe,
  Info,
  Key,
  RefreshCw,
  Settings,
  TrendingDown,
  TrendingUp,
  WifiOff,
  XCircle,
} from "lucide-react";
import React, { useState } from "react";
import { createLogger } from "../lib/structured-logger";
import { Alert, AlertDescription } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { Separator } from "./ui/separator";

/**
 * Enhanced Credential Status Component V3
 *
 * FIXED: Updated to use unified status endpoint to eliminate status contradictions.
 * Previously used enhanced connectivity API directly, which could show conflicting
 * status messages. Now uses unified status resolver for consistent results.
 *
 * Advanced credential status component with comprehensive health monitoring,
 * circuit breaker status, and real-time updates.
 */

interface EnhancedCredentialStatusV3Props {
  showDetailsButton?: boolean;
  showHealthMetrics?: boolean;
  showTrends?: boolean;
  autoRefresh?: boolean;
  className?: string;
}

interface EnhancedConnectivityData {
  connected: boolean;
  hasCredentials: boolean;
  credentialsValid: boolean;
  canAuthenticate: boolean;
  isTestCredentials: boolean;
  credentialSource: "database" | "environment" | "none";
  hasUserCredentials: boolean;
  hasEnvironmentCredentials: boolean;
  connectionHealth: "excellent" | "good" | "fair" | "poor";
  connectionQuality: {
    score: number;
    status: string;
    reasons: string[];
    recommendations: string[];
  };
  metrics: {
    totalChecks: number;
    successRate: number;
    averageLatency: number;
    consecutiveFailures: number;
    uptime: number;
    responseTime?: number;
  };
  circuitBreaker: {
    isOpen: boolean;
    failures: number;
    nextAttemptTime?: string;
    reason?: string;
  };
  alerts: {
    count: number;
    latest?: string;
    severity: "none" | "info" | "warning" | "critical";
    recent: Array<{
      type: string;
      severity: string;
      message: string;
      timestamp: string;
    }>;
  };
  recommendedActions: string[];
  error?: string;
  message: string;
  status:
    | "fully_connected"
    | "credentials_invalid"
    | "test_credentials"
    | "no_credentials"
    | "network_error"
    | "error";
  timestamp: string;
  lastChecked: string;
  nextCheckIn: number;
  trends: {
    period: string;
    healthTrend: "improving" | "stable" | "degrading";
    averageUptime: number;
    statusChanges: number;
    mostCommonIssue?: string;
  };
  monitoring: {
    isActive: boolean;
    intervalMs: number;
    totalStatusUpdates: number;
  };
}

export const EnhancedCredentialStatusV3 = React.memo(function EnhancedCredentialStatusV3({
  showDetailsButton = true,
  showHealthMetrics = true,
  showTrends = false,
  autoRefresh = true,
  className = "",
}: EnhancedCredentialStatusV3Props) {
  const [showDetails, setShowDetails] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  // FIXED: Use unified status endpoint to eliminate contradictions
  const {
    data: connectivity,
    isLoading,
    error,
    refetch,
  } = useQuery<EnhancedConnectivityData>({
    queryKey: ["mexc", "unified-status"],
    queryFn: async () => {
      // Use the new unified status endpoint for consistent results
      const response = await fetch("/api/mexc/unified-status");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();

      // Transform unified response to match expected format
      const unifiedData = result.data;
      return {
        connected: unifiedData.connected,
        hasCredentials: unifiedData.hasCredentials,
        credentialsValid: unifiedData.credentialsValid,
        canAuthenticate: unifiedData.credentialsValid,
        isTestCredentials: unifiedData.isTestCredentials || false,
        credentialSource: unifiedData.credentialSource,
        hasUserCredentials: unifiedData.hasUserCredentials,
        hasEnvironmentCredentials: unifiedData.hasEnvironmentCredentials,
        connectionHealth: unifiedData.connectionHealth || "good",
        connectionQuality: {
          score:
            unifiedData.connectionHealth === "excellent"
              ? 100
              : unifiedData.connectionHealth === "good"
                ? 80
                : unifiedData.connectionHealth === "fair"
                  ? 60
                  : 40,
          status: unifiedData.connectionHealth || "good",
          reasons: unifiedData.recommendations?.slice(0, 3) || [],
          recommendations: unifiedData.recommendations || [],
        },
        metrics: {
          totalChecks: 1,
          successRate: unifiedData.credentialsValid ? 1 : 0,
          averageLatency: unifiedData.responseTime || 0,
          consecutiveFailures: unifiedData.credentialsValid ? 0 : 1,
          uptime: unifiedData.credentialsValid ? 100 : 0,
          responseTime: unifiedData.responseTime,
        },
        circuitBreaker: {
          isOpen: false,
          failures: 0,
        },
        alerts: {
          count: unifiedData.error ? 1 : 0,
          latest: unifiedData.error,
          severity: unifiedData.error ? ("warning" as const) : ("none" as const),
          recent: unifiedData.error
            ? [
                {
                  type: "error",
                  severity: "warning",
                  message: unifiedData.error,
                  timestamp: new Date().toISOString(),
                },
              ]
            : [],
        },
        recommendedActions: unifiedData.recommendations || [],
        error: unifiedData.error,
        message: unifiedData.statusMessage,
        status:
          unifiedData.overallStatus === "healthy"
            ? ("fully_connected" as const)
            : unifiedData.isTestCredentials
              ? ("test_credentials" as const)
              : !unifiedData.hasCredentials
                ? ("no_credentials" as const)
                : !unifiedData.credentialsValid
                  ? ("credentials_invalid" as const)
                  : ("network_error" as const),
        timestamp: unifiedData.lastChecked,
        lastChecked: unifiedData.lastChecked,
        nextCheckIn: 60000,
        trends: {
          period: "last_24_hours",
          healthTrend: "stable" as const,
          averageUptime: unifiedData.credentialsValid ? 100 : 0,
          statusChanges: 0,
        },
        monitoring: {
          isActive: true,
          intervalMs: 60000,
          totalStatusUpdates: 1,
        },
      };
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: autoRefresh ? 60000 : false, // Auto-refetch every minute if enabled
    refetchOnWindowFocus: true,
    retryOnMount: true,
  });

  // Manual refresh handler
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  // FIXED: Force refresh handler using unified endpoint
  const handleForceRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/mexc/unified-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRefresh: true }),
      });
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  // Reset circuit breaker handler (deprecated with unified status)
  const handleResetCircuitBreaker = async () => {
    try {
      // Circuit breaker reset not needed with unified status
      // Just force refresh instead
      await handleForceRefresh();
    } catch (error) {
      logger.error("Failed to reset circuit breaker:", error);
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            <div>
              <div className="font-medium">Checking MEXC connectivity...</div>
              <div className="text-sm text-muted-foreground">
                Running comprehensive validation and health checks
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <div className="font-medium text-red-600">Service Unavailable</div>
                <div className="text-sm text-muted-foreground">
                  {error instanceof Error ? error.message : "Unknown error"}
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!connectivity) return null;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Globe className="h-5 w-5" />
            <span>MEXC API Status</span>
            <MonitoringIndicator connectivity={connectivity} />
          </div>
          <div className="flex items-center space-x-2">
            <StatusBadge connectivity={connectivity} />
            {showDetailsButton && (
              <Button variant="ghost" size="sm" onClick={() => setShowDetails(!showDetails)}>
                <Info className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardTitle>
        <CardDescription className="flex items-center justify-between">
          <span>{connectivity.message}</span>
          <span className="text-xs text-muted-foreground">
            Last checked: {new Date(connectivity.lastChecked).toLocaleTimeString()}
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {/* Main Status Row */}
        <MainStatusRow
          connectivity={connectivity}
          onRefresh={handleRefresh}
          onForceRefresh={handleForceRefresh}
          refreshing={refreshing}
        />

        {/* Circuit Breaker Warning */}
        {connectivity.circuitBreaker.isOpen && (
          <CircuitBreakerAlert
            circuitBreaker={connectivity.circuitBreaker}
            onReset={handleResetCircuitBreaker}
          />
        )}

        {/* Credential Source Information */}
        <CredentialSourceInfo connectivity={connectivity} />

        {/* Health Metrics */}
        {showHealthMetrics && <HealthMetrics connectivity={connectivity} />}

        {/* Alerts */}
        {connectivity.alerts.count > 0 && <AlertsSection alerts={connectivity.alerts} />}

        {/* Detailed Information (expandable) */}
        {showDetails && <DetailedStatusInfo connectivity={connectivity} showTrends={showTrends} />}

        {/* Action Suggestions */}
        <ActionSuggestions connectivity={connectivity} />
      </CardContent>
    </Card>
  );
});

// ============================================================================
// Supporting Components
// ============================================================================

const logger = createLogger("enhanced-credential-status-v3");

function StatusBadge({ connectivity }: { connectivity: EnhancedConnectivityData }) {
  const getStatusConfig = () => {
    switch (connectivity.status) {
      case "fully_connected":
        return {
          variant: "default" as const,
          icon: CheckCircle,
          text: "Connected",
          color: "text-green-500",
        };
      case "test_credentials":
        return {
          variant: "secondary" as const,
          icon: AlertTriangle,
          text: "Test Credentials",
          color: "text-yellow-500",
        };
      case "credentials_invalid":
        return {
          variant: "destructive" as const,
          icon: XCircle,
          text: "Invalid",
          color: "text-red-500",
        };
      case "no_credentials":
        return {
          variant: "outline" as const,
          icon: Key,
          text: "No Credentials",
          color: "text-gray-500",
        };
      case "network_error":
        return {
          variant: "destructive" as const,
          icon: WifiOff,
          text: "Network Error",
          color: "text-red-500",
        };
      default:
        return {
          variant: "destructive" as const,
          icon: AlertCircle,
          text: "Error",
          color: "text-red-500",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="flex items-center space-x-1">
      <Icon className="h-3 w-3" />
      <span>{config.text}</span>
    </Badge>
  );
}

function MonitoringIndicator({ connectivity }: { connectivity: EnhancedConnectivityData }) {
  if (!connectivity.monitoring.isActive) return null;

  return (
    <div className="flex items-center space-x-1">
      <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
      <span className="text-xs text-muted-foreground">Live</span>
    </div>
  );
}

function MainStatusRow({
  connectivity,
  onRefresh,
  onForceRefresh,
  refreshing,
}: {
  connectivity: EnhancedConnectivityData;
  onRefresh: () => void;
  onForceRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Source:</span>
          <Badge variant="outline">{connectivity.credentialSource}</Badge>
        </div>

        <div className="flex items-center space-x-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Health:</span>
          <HealthBadge health={connectivity.connectionHealth} />
        </div>
      </div>

      <div className="flex space-x-2">
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>

        <Button variant="ghost" size="sm" onClick={onForceRefresh} disabled={refreshing}>
          Force Check
        </Button>
      </div>
    </div>
  );
}

function HealthBadge({ health }: { health: string }) {
  const config = {
    excellent: { variant: "default" as const, color: "bg-green-500" },
    good: { variant: "secondary" as const, color: "bg-blue-500" },
    fair: { variant: "secondary" as const, color: "bg-yellow-500" },
    poor: { variant: "destructive" as const, color: "bg-red-500" },
  }[health] || { variant: "outline" as const, color: "bg-gray-500" };

  return (
    <Badge variant={config.variant} className="flex items-center space-x-1">
      <div className={`h-2 w-2 rounded-full ${config.color}`} />
      <span className="capitalize">{health}</span>
    </Badge>
  );
}

function CircuitBreakerAlert({
  circuitBreaker,
  onReset,
}: {
  circuitBreaker: EnhancedConnectivityData["circuitBreaker"];
  onReset: () => void;
}) {
  return (
    <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <div>
          <strong>Circuit Breaker Open:</strong> {circuitBreaker.reason}
          {circuitBreaker.nextAttemptTime && (
            <div className="text-sm text-muted-foreground mt-1">
              Next attempt: {new Date(circuitBreaker.nextAttemptTime).toLocaleString()}
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onReset}>
          Reset
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function CredentialSourceInfo({ connectivity }: { connectivity: EnhancedConnectivityData }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="flex items-center space-x-2">
        <Key className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">User Credentials:</span>
        <Badge variant={connectivity.hasUserCredentials ? "default" : "outline"}>
          {connectivity.hasUserCredentials ? "Configured" : "Not Set"}
        </Badge>
      </div>

      <div className="flex items-center space-x-2">
        <Settings className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">Environment:</span>
        <Badge variant={connectivity.hasEnvironmentCredentials ? "default" : "outline"}>
          {connectivity.hasEnvironmentCredentials ? "Configured" : "Not Set"}
        </Badge>
      </div>
    </div>
  );
}

function HealthMetrics({ connectivity }: { connectivity: EnhancedConnectivityData }) {
  const { metrics, connectionQuality } = connectivity;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Connection Quality</span>
        <span className="text-sm text-muted-foreground">{connectionQuality.score}/100</span>
      </div>

      <Progress value={connectionQuality.score} className="h-2" />

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-muted-foreground">Success Rate</div>
          <div className="font-medium">{(metrics.successRate * 100).toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-muted-foreground">Avg Latency</div>
          <div className="font-medium">{metrics.averageLatency.toFixed(0)}ms</div>
        </div>
        <div>
          <div className="text-muted-foreground">Uptime</div>
          <div className="font-medium">{metrics.uptime.toFixed(1)}%</div>
        </div>
      </div>
    </div>
  );
}

function AlertsSection({ alerts }: { alerts: EnhancedConnectivityData["alerts"] }) {
  const severityConfig = {
    critical: { icon: XCircle, color: "text-red-500" },
    warning: { icon: AlertTriangle, color: "text-yellow-500" },
    info: { icon: Info, color: "text-blue-500" },
    none: { icon: CheckCircle, color: "text-green-500" },
  };

  const config = severityConfig[alerts.severity] || severityConfig.info;
  const Icon = config.icon;

  return (
    <Alert>
      <Icon className={`h-4 w-4 ${config.color}`} />
      <AlertDescription>
        <div className="flex items-center justify-between">
          <div>
            <strong>
              {alerts.count} Alert{alerts.count !== 1 ? "s" : ""}
            </strong>
            {alerts.latest && (
              <div className="text-sm text-muted-foreground mt-1">{alerts.latest}</div>
            )}
          </div>
          <Badge variant="outline">{alerts.severity}</Badge>
        </div>
      </AlertDescription>
    </Alert>
  );
}

function DetailedStatusInfo({
  connectivity,
  showTrends,
}: {
  connectivity: EnhancedConnectivityData;
  showTrends: boolean;
}) {
  return (
    <div className="space-y-4">
      <Separator />

      {/* Connection Quality Details */}
      <div>
        <h4 className="text-sm font-medium mb-2">Connection Analysis</h4>
        <div className="space-y-2">
          {connectivity.connectionQuality.reasons.map((reason, index) => (
            <div key={index} className="text-sm text-muted-foreground flex items-center space-x-2">
              <div className="h-1 w-1 bg-muted-foreground rounded-full" />
              <span>{reason}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Trends */}
      {showTrends && (
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center space-x-2">
            <span>Trends (24h)</span>
            <TrendIcon trend={connectivity.trends.healthTrend} />
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Health Trend</div>
              <div className="font-medium capitalize">{connectivity.trends.healthTrend}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Status Changes</div>
              <div className="font-medium">{connectivity.trends.statusChanges}</div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Alerts */}
      {connectivity.alerts.recent.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Recent Issues</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {connectivity.alerts.recent.slice(0, 3).map((alert, index) => (
              <div key={index} className="text-sm p-2 bg-muted rounded-md">
                <div className="font-medium">{alert.message}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(alert.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  switch (trend) {
    case "improving":
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case "degrading":
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    default:
      return <div className="h-4 w-4 bg-muted-foreground rounded-full" />;
  }
}

function ActionSuggestions({ connectivity }: { connectivity: EnhancedConnectivityData }) {
  if (connectivity.recommendedActions.length === 0) return null;

  return (
    <div>
      <h4 className="text-sm font-medium mb-2">Recommended Actions</h4>
      <div className="space-y-2">
        {connectivity.recommendedActions.slice(0, 3).map((action, index) => (
          <div key={index} className="text-sm text-muted-foreground flex items-start space-x-2">
            <div className="h-1 w-1 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
            <span>{action}</span>
          </div>
        ))}
      </div>

      {connectivity.status === "test_credentials" && (
        <div className="mt-3">
          <Button variant="outline" size="sm" asChild>
            <a href="/settings" className="flex items-center space-x-2">
              <ExternalLink className="h-3 w-3" />
              <span>Configure Real Credentials</span>
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

// Export both named and default for maximum compatibility
export { EnhancedCredentialStatusV3 };
export default EnhancedCredentialStatusV3;
